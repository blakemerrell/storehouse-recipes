/* Plan my week: a few questions, the week's dinners, and what they cost.
 *
 * Chantel, trying Tapcook: answer some questions and get a list of meals to
 * make for the week. Every figure here is worked out from window.RECIPES and
 * window.PANTRY, never typed in, so the test follows the book and the prices. */

const DINNER = ['1-4', '2-3', '2-4'];

module.exports = {
  name: 'Plan my week',
  async run(t) {
    const p = await t.fresh({ viewport: { width: 390, height: 844 } });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));

    /* Tuesday already has a dinner; the answers are remembered from last time. */
    const tueId = await p.evaluate(() => {
      localStorage.setItem('sh.pw', JSON.stringify({ n: 5, ppl: 4, bud: 60, t: 45, avoid: ['Pork'], shelf: false }));
      const r = window.RECIPES.find((x) => x.book === 2 && x.secNum === 3);
      window.Store.addToDay(r.id, 'tue', 1);
      return r.id;
    });
    await p.click('.tab[data-view="plan"]');
    await p.waitForTimeout(300);
    await p.click('#planMyWeek');
    await p.waitForTimeout(300);

    const q = await p.evaluate(() => {
      const on = (q) => [...document.querySelectorAll('[data-pwq="' + q + '"][aria-pressed="true"]')].map((b) => b.dataset.pwv);
      return { n: on('n'), ppl: on('ppl'), t: on('t'), avoid: on('avoid'), shelf: on('shelf'),
        bud: (document.getElementById('pwBudV') || {}).textContent };
    });
    t.ok('Plan my week opens on the questions, with last time’s answers',
      q.n.join() === '5' && q.ppl.join() === '4' && q.t.join() === '45' && q.avoid.join() === 'Pork' &&
        q.shelf.join() === '0' && q.bud === '$60', JSON.stringify(q));

    await p.click('[data-pwgo="2"]');
    await p.waitForTimeout(300);
    const read = () => p.evaluate(() => [...document.querySelectorAll('.pw-meal')].map((m) => ({
      day: m.querySelector('.pw-day').textContent,
      id: m.querySelector('[data-pwopen]').dataset.pwopen })));
    const picks = await read();

    const check = await p.evaluate(([picks, DINNER]) => {
      const byId = (id) => window.RECIPES.find((r) => String(r.id) === String(id));
      const P = window.PANTRY;
      const mins = (r) => { const s = String(r.time || ''), h = s.match(/(\d+(?:\.\d+)?)\s*hr/), m = s.match(/(\d+)\s*min/);
        return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0) || 60; };
      const pork = ['pork_roast', 'pork_sausage', 'ham', 'sweet_pork'];
      let usd = 0;
      const bad = [];
      picks.forEach((pk) => {
        const r = byId(pk.id);
        const dinner = DINNER.indexOf(r.book + '-' + r.secNum) >= 0 ||
          (r.book === 2 && r.secNum === 7 && !(r.makes || []).length && r.macro.kcal >= 350);
        if (!dinner) bad.push(r.name + ' is not a dinner');
        if (mins(r) > 45) bad.push(r.name + ' takes ' + mins(r));
        if (/pork|\bham\b|sausage|carnitas|bacon/i.test(r.name) || r.ingp.some((it) => pork.indexOf(it.k) >= 0)) bad.push(r.name + ' has pork');
        const x = Math.max(1, Math.round((4 / (Number(r.servN) || 4)) * 2) / 2);
        r.ingp.forEach((it) => {
          if (!it.k || it.k === 'water' || it.k === 'free' || it.o) return;
          const pr = P[it.k] && P[it.k].usd;
          if (pr) usd += it.g * x * pr / 100;
        });
      });
      return { bad, usd, sum: (document.querySelector('.pw-sum') || {}).textContent || '' };
    }, [picks, DINNER]);
    t.ok('five dinners, on the five nights that had none, Tuesday left alone',
      picks.length === 5 && picks.map((x) => x.day).join() === 'MON,WED,THU,FRI,SAT', JSON.stringify(picks));
    t.ok('every one is a dinner, fits 45 minutes, and leaves out pork',
      check.bad.length === 0, check.bad.join('; '));
    t.ok('none repeats', new Set(picks.map((x) => x.id)).size === picks.length, JSON.stringify(picks));
    t.ok('the week comes in under the budget, and says the same total it adds up to',
      check.usd <= 60 && new RegExp('about \\$' + Math.round(check.usd) + '\\b').test(check.sum) && /under \$60/.test(check.sum),
      JSON.stringify({ usd: check.usd, sum: check.sum }));

    await p.click('[data-pwswap="1"]');
    await p.waitForTimeout(250);
    const after = await read();
    t.ok('↻ swaps that one night and nothing else',
      after[1].id !== picks[1].id && after[0].id === picks[0].id && after[2].id === picks[2].id && after[1].day === 'WED',
      JSON.stringify({ was: picks.map((x) => x.id), now: after.map((x) => x.id) }));

    await p.click('[data-pwgo="3"]');
    await p.waitForTimeout(300);
    const list = await p.evaluate(() => {
      const lines = [...document.querySelectorAll('.pw-li')].map((l) => l.querySelector('.pw-p').textContent);
      const sum = lines.reduce((n, v) => n + (/^\$/.test(v) ? Number(v.slice(1)) : 0), 0);
      return { lines: lines.length, sum, head: (document.querySelector('.pw-sum') || {}).textContent || '',
        first: (document.querySelector('.pw-grp') || {}).textContent || '' };
    });
    t.ok('the shopping list is every ingredient, priced, and its total is its lines added up',
      list.lines > 5 && Math.abs(Number((list.head.match(/\$(\d+(?:\.\d+)?)/) || [])[1]) - list.sum) <= list.lines,
      JSON.stringify(list));
    t.ok('buying everything, it is one list to buy, not a storehouse shelf with prices on it',
      /^To buy$/i.test(list.first.trim()) && await p.evaluate(() => document.querySelectorAll('.pw-grp').length === 1), list.first);

    /* The picker has chance in it, so one run proves little: forty weeks,
       each held to every rule. */
    const many = await p.evaluate(() => {
      const W = window.__pw, bad = [];
      const a = { n: 5, ppl: 4, bud: 45, t: 45, avoid: ['Pork', 'Beans'], shelf: false };
      const cheapest5 = W.pool(a).map((r) => W.cost([{ r, x: Math.max(1, Math.round((4 / (Number(r.servN) || 4)) * 2) / 2) }], false))
        .sort((x, y) => x - y).slice(0, 5).reduce((n, v) => n + v, 0);
      /* A budget with little room over the cheapest possible week, so it is
         the budget that decides, not the picker's taste for cheap dinners. */
      a.bud = Math.ceil(cheapest5 * 1.15);
      for (let run = 0; run < 40; run++) {
        const picks = [];
        for (let i = 0; i < 5; i++) { const nx = W.next(a, picks, []); if (!nx) break; picks.push(nx); }
        const ids = picks.map((e) => e.r.id);
        if (new Set(ids).size !== ids.length) bad.push('repeat in run ' + run);
        picks.forEach((e) => { if (W.avoids(e.r, a.avoid)) bad.push(e.r.name + ' breaks a leave-out'); });
        const usd = W.cost(picks, false);
        if (cheapest5 <= a.bud && usd > a.bud + 0.01) bad.push('run ' + run + ' costs ' + usd.toFixed(2));
      }
      return { bad, cheapest5 };
    });
    t.ok('forty runs: never a repeat, never a leave-out, never over a budget that five dinners can meet',
      many.bad.length === 0, JSON.stringify(many).slice(0, 300));

    await p.click('[data-pwadd]');
    await p.waitForTimeout(400);
    const plan = await p.evaluate(() => ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
      .map((d) => window.Store.day(d).map((e) => String(e.id)).join('+')));
    t.ok('Add puts each dinner on its night and leaves Tuesday’s as it was',
      plan[0] === after[0].id && plan[1] === String(tueId) && plan[2] === after[1].id && plan[5] === after[4].id && plan[6] === '',
      JSON.stringify(plan));
    t.ok('and the sheet closes onto the week', await p.evaluate(() => !document.querySelector('.pw-sheet')));
    t.ok('with no error on the page', errs.length === 0, errs.join(' | '));
    await p.context().close();
  },
};
