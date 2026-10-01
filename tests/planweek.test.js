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
      /* Buying everything is Plan's step 1 now: Store only. */
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
    t.ok('a dinner on each night asked for that had none, Tuesday left alone',
      picks.length === 4 && picks.map((x) => x.day).join() === 'MON,WED,THU,FRI', JSON.stringify(picks));
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
    t.ok('buying everything (Store only), the list opens on what to buy, with no storehouse order in it',
      /^To buy$/i.test(list.first.trim()) && await p.evaluate(() => ![...document.querySelectorAll('.pw-grp')].some((g) => /storehouse/i.test(g.textContent))), list.first);

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

    await p.click('[data-pwadd]');
    await p.waitForTimeout(400);
    const plan = await p.evaluate(() => ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
      .map((d) => window.Store.day(d).map((e) => String(e.id)).join('+')));
    t.ok('Add puts each dinner on its night and leaves Tuesday’s as it was',
      plan[0] === after[0].id && plan[1] === String(tueId) && plan[2] === after[1].id && plan[4] === after[3].id && plan[5] === '' && plan[6] === '',
      JSON.stringify(plan));
    t.ok('and the sheet closes onto the week', await p.evaluate(() => !document.querySelector('.pw-sheet')));

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
    /* "Hits my plan", not "Hits 70 g protein", now that a household can
       hold more than one plan: whose it is is the thing to say. */
    t.ok('the question says the dinner’s share, and the chips say how many each lets in',
      /550 cal · 70 g protein/.test(scr.label) && scr.chips[0] === 'Don’t mind' && /^Hits my plan \d+\*$/.test(scr.chips[1]) && /^High protein \d+$/.test(scr.chips[2]),
      JSON.stringify(scr));
    t.ok('with nobody else sharing, there is no chip for anybody else and none for both',
      scr.chips.length === 3 && !scr.chips.some((c) => /both|everyone|’s plan/.test(c)), JSON.stringify(scr));
    t.ok('Hits my plan leaves dinners to pick from', scr.n > 0, JSON.stringify(scr));
    if (!scr.dis) {
      await p.click('.pw-bar .pw-go');
      await p.waitForTimeout(300);
      const plates = await p.evaluate(() => [...document.querySelectorAll('.pw-meal')].map((m) => ({
        lo: /Leftovers/.test(m.textContent), plate: (m.querySelector('.pw-plate') || {}).textContent || '' })));
      t.ok('each dinner says the plate that meets the plan',
        plates.length > 0 && plates.every((x) => /^Your plate: \d+(\.\d)? servings? · \d+ cal · \d+ g protein$/.test(x.plate)), JSON.stringify(plates));
    } else t.ok('there were enough dinners to pick', false, JSON.stringify(scr));

    /* Blake: "Fits my Nourish plan is applicable to me right now, but what
       if my wife has a different plan?" She shares a dinner's numbers with
       the household (household.test.js has that half), and every phone in
       it gets a chip for her plan and one for both. Seeded here as sync
       leaves the household's copy on a phone, bsc.diners — with Blake's own
       entry in it too, as his phone would see it, which is not a second plan
       beside the one his own targets make. */
    const share = { sarah1: { n: 'Sarah', kc: 400, p: 40 }, blake1: { n: 'Blake', kc: 900, p: 20 } };
    const openSheet = async (pw) => {
      await p.evaluate(([d, a]) => {
        localStorage.setItem('bsc.diners', JSON.stringify(d));
        localStorage.setItem('bsc.myOwner', 'blake1');
        localStorage.setItem('sh.pw', JSON.stringify(a));
      }, [share, pw]);
      await p.reload();
      await p.waitForTimeout(400);
      if (!await p.$('#planMyWeek:visible')) { await p.click('.tab[data-view="plan"]'); await p.waitForTimeout(300); }
      await p.click('#planMyWeek');
      await p.waitForTimeout(300);
    };
    const fitQ = () => p.evaluate(() => {
      const W = window.__pw, mine = W.fit(), d = window.Store.diners(), s = d.sarah1;
      // what the chips count from: every other answer as it is, Nourish left out
      const pool = W.pool(Object.assign({}, W.answers(), { fit: 0 }), false);
      const meets = (r, c) => r.macro && r.macro.kcal > 0 && (r.macro.p || 0) / r.macro.kcal >= c.p / c.kc;
      const q = document.querySelector('[data-pwq="fit"]').closest('.pw-q');
      return { mine, s,
        N: pool.filter((r) => meets(r, mine)).length, M: pool.filter((r) => meets(r, s)).length,
        K: pool.filter((r) => meets(r, mine) && meets(r, s)).length,
        H: pool.filter((r) => r.macro && r.macro.kcal > 0 && 4 * (r.macro.p || 0) / r.macro.kcal >= 0.4).length,
        small: q.querySelector('.pw-ql small').textContent,
        chips: [...q.querySelectorAll('[data-pwq="fit"]')].map((b) => b.textContent.trim() + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')) };
    });
    await openSheet({ days: ['sat', 'sun'], ppl: 4, bud: 150, t: 0, fit: 3 });
    const two = await fitQ();
    t.ok('two plans: a chip for mine, one for hers, one for both and High protein, each with how many it lets in',
      JSON.stringify(two.chips) === JSON.stringify(['Don’t mind', 'Hits my plan ' + two.N, 'Hits Sarah’s plan ' + two.M,
        'Hits both ' + two.K + '*', 'High protein ' + two.H]), JSON.stringify(two));
    t.ok('the question says both shares, and my own entry in the household is not a third plan',
      two.small === 'You ' + two.mine.kc + ' cal · ' + two.mine.p + ' g · Sarah ' + two.s.kc + ' cal · ' + two.s.p + ' g' &&
        !two.chips.some((c) => /Blake/.test(c)), JSON.stringify(two));
    t.ok('both lets in no more than either plan alone, and leaves dinners to pick', two.K <= Math.min(two.N, two.M) && two.K > 0,
      JSON.stringify(two));
    await p.click('.pw-bar .pw-go');
    await p.waitForTimeout(300);
    const both = await p.evaluate(() => {
      const W = window.__pw, mine = W.fit(), s = window.Store.diners().sarah1;
      const byId = (id) => window.RECIPES.find((r) => String(r.id) === String(id));
      const say = (who, pl) => who + ' plate: ' + pl.x + (pl.x === 1 ? ' serving' : ' servings') + ' · ' + pl.kc + ' cal · ' + pl.p + ' g protein';
      return [...document.querySelectorAll('.pw-meal')].map((m) => {
        const r = byId(m.querySelector('[data-pwopen]').dataset.pwopen);
        return { name: r.name, mine: r.macro.p / r.macro.kcal >= mine.p / mine.kc, hers: r.macro.p / r.macro.kcal >= s.p / s.kc,
          plates: [...m.querySelectorAll('.pw-plate')].map((x) => x.textContent),
          want: [say('Your', W.plate(r, mine)), say('Sarah’s', W.plate(r, s))] };
      });
    });
    t.ok('every dinner picked under Hits both meets both plans', both.length > 0 && both.every((x) => x.mine && x.hers),
      JSON.stringify(both));
    t.ok('and says two plates, mine and hers, each sized to its own share',
      both.every((x) => JSON.stringify(x.plates) === JSON.stringify(x.want)), JSON.stringify(both));

    /* A name comes from the household document, which anybody holding the
       code can write to: it is text on every phone, never markup. With a
       third person sharing, both becomes everyone's. */
    share.evil1 = { n: '<img src=x onerror=__pwX=1>', kc: 500, p: 45 };
    await openSheet({ days: ['sat', 'sun'], ppl: 4, bud: 150, t: 0, fit: 'u:evil1' });
    const three = await p.evaluate(() => ({
      chips: [...document.querySelectorAll('[data-pwq="fit"]')].map((b) => b.textContent.trim() + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')),
      small: document.querySelector('[data-pwq="fit"]').closest('.pw-q').querySelector('.pw-ql small').textContent }));
    t.ok('three plans: a chip each, and Hits everyone’s in place of Hits both',
      three.chips.some((c) => /^Hits everyone’s \d+$/.test(c)) && !three.chips.some((c) => /^Hits both/.test(c)) &&
        three.chips.some((c) => /^Hits Sarah’s plan \d+$/.test(c)), JSON.stringify(three));
    await p.click('.pw-bar .pw-go');
    await p.waitForTimeout(300);
    const evil = await p.evaluate(() => ({ img: document.querySelectorAll('.pw-sheet img').length, ran: window.__pwX,
      plate: (document.querySelector('.pw-plate') || {}).textContent || '' }));
    t.ok('a name with markup in it is shown as the text it is, on the chip, the question and the plate, and nothing runs',
      three.chips.some((c) => c === 'Hits <img src=x onerror=__pwX=1>’s plan ' + c.split(' ').pop().replace('*', '') + '*') &&
        /<img src=x onerror=__pwX=1> 500 cal · 45 g/.test(three.small) &&
        /^<img src=x onerror=__pwX=1>’s plate: /.test(evil.plate) && evil.img === 0 && evil.ran === undefined, JSON.stringify({ three, evil }));

    // answers saved before somebody stopped sharing, and the ones saved before there were plans at all
    const saved = await p.evaluate(() => [true, 1, 2, 3, 'u:sarah1', 'u:gone1', 'u:blake1'].map((fit) => {
      localStorage.setItem('sh.pw', JSON.stringify({ fit }));
      return window.__pw.answers().fit;
    }));
    t.ok('a saved answer keeps working: on is mine, a plan still shared stays, one no longer shared (or my own) is Don’t mind',
      JSON.stringify(saved) === JSON.stringify([1, 1, 2, 3, 'u:sarah1', 0, 0]), JSON.stringify(saved));
    await p.evaluate(() => { localStorage.removeItem('bsc.diners'); localStorage.setItem('sh.pw', JSON.stringify({ fit: 3 })); });
    await p.reload();
    await p.waitForTimeout(300);
    t.ok('and both, with nobody else sharing any more, is my plan', await p.evaluate(() => window.__pw.answers().fit) === 1);
    await p.evaluate(() => { localStorage.removeItem('bsc.macroTargets'); localStorage.removeItem('sh.pw'); localStorage.removeItem('bsc.myOwner'); });
    t.ok('with no error on the page', errs.length === 0, errs.join(' | '));
    await p.context().close();
  },
};
