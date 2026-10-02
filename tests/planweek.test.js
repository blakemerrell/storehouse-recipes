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
    /* A Sunday morning: every day of the week is still ahead, so a plan
       written in this test is never a plan for a day already gone. */
    await p.clock.setFixedTime(new Date(2026, 8, 27, 9, 0, 0));
    await p.reload();
    await p.waitForTimeout(900);
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));

    /* Tuesday already has a dinner; the answers are remembered from last time. */
    const tueId = await p.evaluate(() => {
      localStorage.setItem('sh.pw', JSON.stringify({ days: ['mon', 'tue', 'wed', 'thu', 'fri'], ppl: 4, bud: 60, t: 45, avoid: ['Pork'] }));
      /* Buying everything is Plan's step 1 now: I keep my own. */
      window.Store.setOpt('store', false);
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
      return { days: on('days'), ppl: on('ppl'), t: on('t'), avoid: on('avoid'), 
        bud: (document.getElementById('pwBudV') || {}).textContent };
    });
    t.ok('Plan my week opens on the questions, with last time’s answers',
      q.days.join() === 'mon,tue,wed,thu,fri' && q.ppl.join() === '4' && q.t.join() === '45' && q.avoid.join() === 'Pork' &&
        q.bud === '$60', JSON.stringify(q));

    /* The screen: the count follows the answers, a typed ingredient comes
       off, and too few to fill the nights holds the button back. */
    const cnt = () => p.evaluate(() => Number(document.querySelector('.pw-cnt b').textContent));
    const n0 = await cnt();
    await p.fill('#pwIng', 'onio');
    await p.waitForTimeout(150);
    await p.click('#pwSug [data-pwing]');
    await p.waitForTimeout(200);
    const n1 = await cnt();
    const chip = await p.evaluate(() => (document.querySelector('[data-pwingx]') || {}).dataset || {});
    await p.click('[data-pwq="prot"][data-pwv="Meatless"]');
    await p.click('[data-pwq="t"][data-pwv="20"]');
    await p.waitForTimeout(200);
    const tight = await p.evaluate(() => ({ n: Number(document.querySelector('.pw-cnt b').textContent),
      dis: document.querySelector('.pw-bar .pw-go').disabled, say: document.querySelector('.pw-cnt span').textContent }));
    t.ok('the count drops as an ingredient is left out, and too few holds the button back',
      n1 < n0 && chip.pwingx === 'onion' && tight.n < 4 && tight.dis && /loosen/.test(tight.say),
      JSON.stringify({ n0, n1, chip, tight }));
    await p.click('[data-pwingx="onion"]');
    await p.click('[data-pwq="prot"][data-pwv="Meatless"]');
    await p.click('[data-pwq="t"][data-pwv="45"]');
    await p.waitForTimeout(200);
    t.ok('and undoing them brings the same count back', await cnt() === n0);

    await p.click('[data-pwpick]');
    await p.waitForTimeout(400);
    t.ok('Pick my dinners closes the sheet onto the week', await p.evaluate(() => !document.querySelector('.pw-sheet')));
    /* The week, read back: the nights asked for, each with its dinner. */
    const read = () => p.evaluate((tue) => ['mon', 'wed', 'thu', 'fri'].map((d) => {
      const e = window.Store.day(d).find((x) => String(x.id) !== String(tue));
      return e ? { day: d.toUpperCase(), id: String(e.id) } : null;
    }).filter(Boolean), tueId);
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
      return { bad, usd, sum: document.getElementById('planSum').textContent };
    }, [picks, DINNER]);
    t.ok('a dinner on each night asked for that had none, Tuesday left alone',
      picks.length === 4 && picks.map((x) => x.day).join() === 'MON,WED,THU,FRI', JSON.stringify(picks));
    t.ok('every one is a dinner, fits 45 minutes, and leaves out pork',
      check.bad.length === 0, check.bad.join('; '));
    t.ok('none repeats', new Set(picks.map((x) => x.id)).size === picks.length, JSON.stringify(picks));
    t.ok('the week comes in under the budget, and the week says what it comes to',
      check.usd <= 60 && /~\$\d+/.test(check.sum) && /to buy/.test(check.sum),
      JSON.stringify({ usd: check.usd, sum: check.sum }));

    await p.click('#planGrid [data-pswap][data-day="wed"]');
    await p.waitForTimeout(250);
    const after = await read();
    t.ok('↻ on the week swaps that one night and nothing else',
      after[1].id !== picks[1].id && after[0].id === picks[0].id && after[2].id === picks[2].id && after[1].day === 'WED',
      JSON.stringify({ was: picks.map((x) => x.id), now: after.map((x) => x.id) }));

    await p.click('#planNext [data-stepgo="list"]');
    await p.waitForTimeout(300);
    const list = await p.evaluate(() => {
      const lines = [...document.querySelectorAll('#view-list .list-group.where-b .list-line')].map((l) => (l.querySelector('.list-usd') || {}).textContent || '');
      const sum = lines.reduce((n, v) => n + (/^\$/.test(v) ? Number(v.slice(1)) : 0), 0);
      return { lines: lines.length, priced: lines.filter(Boolean).length, sum, head: document.getElementById('listCount').textContent,
        first: (document.querySelector('.list-group-title') || {}).textContent || '', titles: [...document.querySelectorAll('.list-group-title')].map((g) => g.textContent) };
    });
    t.ok('the list is every ingredient, each priced, and what it says to buy is its lines added up',
      list.lines > 5 && list.priced >= list.lines * 0.6 && Math.abs(Number((list.head.match(/~\$(\d+(?:\.\d+)?)/) || [])[1]) - list.sum) <= list.lines,
      JSON.stringify(list));
    t.ok('buying everything (I keep my own), the list opens on what to buy, with no storehouse order in it',
      /^To buy$/i.test(list.first.trim()) && !list.titles.some((g) => /storehouse/i.test(g)), JSON.stringify(list.titles));
    await p.click('#listNext [data-stepgo="plan"]');
    await p.waitForTimeout(250);

    /* The picker has chance in it, so one run proves little: forty weeks,
       each held to every rule. */
    const many = await p.evaluate(() => {
      const W = window.__pw, bad = [];
      const a = { days: ['mon', 'tue', 'wed', 'thu', 'fri'], ppl: 4, bud: 45, t: 45, prot: [], kind: [], fit: false, avoid: ['Pork', 'Beans'], ing: [], rec: 0, shelf: false };
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

    const f = await p.evaluate(() => {
      const W = window.__pw, bad = [];
      const base = { days: ['mon'], ppl: 4, bud: 150, t: 0, prot: [], kind: [], fit: false, avoid: [], ing: [], rec: 0, shelf: true };
      const all = W.pool(base, false).length;
      const chick = W.pool(Object.assign({}, base, { prot: ['Chicken'] }), false);
      if (!chick.length || chick.some((r) => W.prot(r) !== 'Chicken')) bad.push('protein');
      const sun = W.pool(Object.assign({}, base, { kind: ['Sunday'] }), false);
      if (!sun.length || sun.some((r) => r.book + '-' + r.secNum !== '2-4')) bad.push('kind');
      const onion = W.pool(Object.assign({}, base, { ing: ['onion'] }), false);
      if (!(onion.length < all) || onion.some((r) => r.ingp.some((i) => i.k === 'onion'))) bad.push('ingredient');
      const cap = W.fit();
      // judged on protein for the calories, since a plate can be more or less than a serving
      const fit = W.pool(Object.assign({}, base, { fit: 1 }), false);
      if (!(fit.length < all) || fit.some((r) => r.macro.p / r.macro.kcal < cap.p / cap.kc)) bad.push('fit');
      const high = W.pool(Object.assign({}, base, { fit: 2 }), false);
      if (!(high.length < all) || high.some((r) => 4 * r.macro.p / r.macro.kcal < 0.4)) bad.push('high protein');
      if (W.pool(Object.assign({}, base, { fit: true }), false).length !== fit.length) bad.push('an answer saved as true is Hits it');
      const quick = Object.assign({}, base, { t: 20 });
      if (!(W.pool(quick, false).length < W.pool(quick, true).length)) bad.push('the weekend lifts the time limit');
      localStorage.setItem('sh.pwHist', JSON.stringify({ [String(chick[0].id)]: new Date().toISOString().slice(0, 10) }));
      if (W.pool(Object.assign({}, base, { rec: 2 }), false).some((r) => r.id === chick[0].id)) bad.push('recent');
      if (!W.pool(base, false).some((r) => r.id === chick[0].id)) bad.push('repeats are fine lets it back');
      localStorage.removeItem('sh.pwHist');
      localStorage.setItem('sh.pw', JSON.stringify({ n: 3 }));
      if (W.answers().days.join() !== 'mon,tue,wed') bad.push('old answers: ' + W.answers().days.join());
      return { bad, all };
    });
    t.ok('each filter keeps only what it says: protein, kind of night, an ingredient, Nourish, time, recent',
      f.bad.length === 0, JSON.stringify(f));

    const plan = await p.evaluate(() => ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
      .map((d) => window.Store.day(d).map((e) => String(e.id)).join('+')));
    t.ok('the week holds each dinner on its night and Tuesday’s as it was',
      plan[0] === after[0].id && plan[1] === String(tueId) && plan[2] === after[1].id && plan[4] === after[3].id && plan[5] === '' && plan[6] === '',
      JSON.stringify(plan));

    /* Blake's plan: 210 g of protein in about 1,650 cal, so a dinner's third
       is 550 cal and 70 g. Held to one printed serving, the chip let nothing
       in ("I toggled on that selector and nothing was presented"): the best
       dinner in the books is 69 g a serving. A plate sized to the protein
       does it, and High protein lets in more for Fill my day to top up. */
    await p.evaluate(() => localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 210, c: 90, f: 50 })));
    const hp = await p.evaluate(() => {
      const W = window.__pw, cap = W.fit();
      const base = { days: ['mon'], ppl: 4, bud: 150, t: 0, prot: [], kind: [], fit: 0, avoid: [], ing: [], rec: 0, shelf: true };
      const all = W.pool(base, true);
      const hits = W.pool(Object.assign({}, base, { fit: 1 }), true), high = W.pool(Object.assign({}, base, { fit: 2 }), true);
      const plates = hits.map((r) => W.plate(r, cap));
      return { cap, oneServing: all.filter((r) => r.macro.kcal <= cap.kc && r.macro.p >= cap.p).length, hits: hits.length, high: high.length,
        offPlates: plates.filter((pl) => !pl || pl.kc > cap.kc * 1.02 || pl.p < cap.p * 0.97).map((pl) => pl && [pl.x, pl.kc, pl.p]) };
    });
    t.ok('70 g of protein in 550 cal: one printed serving can’t fill four nights, a plate sized to it can, each plate within the calories',
      hp.cap.kc === 550 && hp.cap.p === 70 && hp.oneServing < 4 && hp.hits >= 4 && hp.offPlates.length === 0, JSON.stringify(hp));
    t.ok('and High protein lets in more, for Fill my day to top up', hp.high > hp.hits, JSON.stringify(hp));

    // on the screen: both chips with their counts, and each dinner says its plate (Saturday and Sunday are still free)
    await p.evaluate(() => localStorage.setItem('sh.pw', JSON.stringify({ days: ['sat', 'sun'], ppl: 4, bud: 150, t: 0 })));
    await p.click('#planMyWeek');
    await p.waitForTimeout(300);
    await p.evaluate(() => { const b = document.querySelector('[data-pwq="fit"][data-pwv="1"]'); b.scrollIntoView({ block: 'center' }); });
    await p.click('[data-pwq="fit"][data-pwv="1"]');
    await p.waitForTimeout(200);
    const scr = await p.evaluate(() => ({
      label: document.querySelector('[data-pwq="fit"]').closest('.pw-q').querySelector('.pw-ql').textContent,
      chips: [...document.querySelectorAll('[data-pwq="fit"]')].map((b) => b.textContent.trim() + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')),
      n: Number(document.querySelector('.pw-cnt b').textContent), dis: document.querySelector('.pw-bar .pw-go').disabled }));
    t.ok('the question says the dinner’s share, and the chips say how many each lets in',
      /550 cal · 70 g protein/.test(scr.label) && scr.chips[0] === 'Don’t mind' && /^Hits 70 g protein \d+\*$/.test(scr.chips[1]) && /^High protein \d+$/.test(scr.chips[2]),
      JSON.stringify(scr));
    t.ok('Hits 70 g protein leaves dinners to pick from', scr.n > 0, JSON.stringify(scr));
    if (!scr.dis) {
      await p.click('.pw-bar .pw-go');
      await p.waitForTimeout(400);
      /* The plate is on the day's sheet now: open each dinner from the week. */
      const plates = await p.evaluate(async () => {
        const out = [];
        for (const b of document.querySelectorAll('#planGrid .day-item:not(.lo) [data-dayopen]')) {
          b.click();
          await new Promise((r) => setTimeout(r, 150));
          out.push({ plate: (document.querySelector('.dsh-sheet .pw-plate') || {}).textContent || '' });
          document.querySelector('.dsh-sheet .sheet-x').click();
          await new Promise((r) => setTimeout(r, 150));
        }
        return out;
      });
      t.ok('each dinner’s sheet says the plate that meets the plan',
        plates.length > 0 && plates.every((x) => /^Your plate: \d+(\.\d)? servings? · \d+ cal · \d+ g protein$/.test(x.plate)), JSON.stringify(plates));
    } else t.ok('there were enough dinners to pick', false, JSON.stringify(scr));
    await p.evaluate(() => { localStorage.removeItem('bsc.macroTargets'); localStorage.removeItem('sh.pw'); });
    t.ok('with no error on the page', errs.length === 0, errs.join(' | '));
    await p.context().close();
  },
};
