/* The meal card, as Blake settled it on 2026-10-04.
 *
 * Blake: "My issue is when I add many foods to a single meal. It works but it
 * just feels messy and complicated... it needs to do its same job but feel
 * effortless." Mockup: https://claude.ai/artifact/GV6QBANqtLChvDU9vQAfeB
 *
 * Meals start folded, and folded is three lines: the tick, the name and its
 * calories against its share; what is on it; one calorie bar with the verdict
 * in words. Open, a meal is one line a food with its amount in grams and the
 * kitchen's word; tapping the amount opens that food's panel (steps, slider,
 * lock, swap, pin, star, bin). The scales say what moved and offer Undo; the
 * picker's additions say New; swap is the picker for one. */
const DAY = '2026-10-06';
const LUNCH = ['chicken_breast', 'rice_cooked', 'broccoli', 'black_beans', 'salsa', 'avocado', 'olive_oil'];

const SETUP = (lunch) => {
  localStorage.setItem('sh.allPanels', '0');     // the real card: one panel at a time
  localStorage.setItem('bsc.macroProfile', JSON.stringify({ sex: 'm', age: 43, ft: 5, inch: 11, lb: 192, act: 1.55, goal: 'cut1' }));
  localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 190, f: 70, c: 230 }));
  const f = (k, x, e) => ({ id: 'f:' + k, x: x, eaten: e ? 1 : 0 });
  localStorage.setItem('bsc.macroDays', JSON.stringify({ '2026-10-06': {
    b: [f('greek_yogurt', 1, 1), f('oats', 0.75, 1)],
    l: lunch.map((k) => f(k, 1)),
  } }));
};
const lunchOf = (p) => p.evaluate((d) => JSON.parse(localStorage.getItem('bsc.macroDays'))[d].l, DAY);

module.exports = {
  name: 'The meal card: folded, one line a food, the panel behind the amount',
  async run(t) {
    const p = await t.fresh({ viewport: { width: 390, height: 844 } });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.clock.setFixedTime(new Date(2026, 9, 6, 11, 30, 0));
    await p.reload();
    await p.waitForTimeout(700);
    await p.evaluate(SETUP, LUNCH);
    await p.reload();
    await p.waitForTimeout(900);
    await p.click('.tab[data-view="macros"]');
    await p.waitForTimeout(600);

    /* ---- folded ---- */
    let shut = await p.evaluate(() => {
      const c = document.querySelector('[data-mfold="l"]').closest('.mslot');
      return { shut: c.classList.contains('mcard-shut'), expanded: c.querySelector('[data-mfold]').getAttribute('aria-expanded'),
        rows: c.querySelectorAll('.mcard-row').length, n: (c.querySelector('.mcard-n') || {}).textContent,
        k: (c.querySelector('.mcard-k') || {}).textContent, names: (c.querySelector('.mcard-names') || {}).textContent,
        say: (c.querySelector('.mcard-say') || {}).textContent, bar: !!c.querySelector('.mcard-tr .mcard-fi'),
        over: c.classList.contains('is-over') };
    });
    t.ok('a filled meal starts folded: no food lines, just the card', shut.shut && shut.expanded === 'false' && shut.rows === 0, JSON.stringify(shut));
    t.ok('folded, it says how many foods and its calories against its share', shut.n === '7 foods' && /^[\d,]+ \/ [\d,]+ kcal$/.test(shut.k), JSON.stringify(shut));
    t.ok('the first three foods by name, then how many more', /^Chicken breasts?, cooked rice, broccoli\+4 more$/.test(shut.names), shut.names);
    t.ok('one calorie bar, and the verdict in words', shut.bar && shut.over && /^[\d,]+ over · (protein|fat|carbs) over$/.test(shut.say), JSON.stringify(shut));

    /* ---- open ---- */
    await p.click('[data-mfold="l"]');
    await p.waitForTimeout(250);
    const open = await p.evaluate(() => {
      const c = document.querySelector('[data-mfold="l"]').closest('.mslot');
      return { open: c.classList.contains('mcard-open'),
        amts: [...c.querySelectorAll('.mcard-row .mcard-amt')].map((b) => b.textContent),
        ticks: c.querySelectorAll('.mcard-row [data-meat]').length, panels: c.querySelectorAll('.mcard-panel').length,
        add: !!c.querySelector('.mcard-add[data-mslot="l"]'), bal: !!c.querySelector('[data-mbal="l"]') };
    });
    t.ok('open, one line a food, each with its own eaten tick', open.open && open.amts.length === 7 && open.ticks === 7 && open.panels === 0, JSON.stringify(open));
    t.ok('the amount is grams with the kitchen word', open.amts[0] === '140 g · 1 cup' && open.amts.every((a) => /^\d[\d,]* g · /.test(a)), JSON.stringify(open.amts));
    t.ok('the foot has Add a food and the scales', open.add && open.bal, JSON.stringify(open));

    /* ---- the panel ---- */
    await p.click('[data-mamt="l:0"]');
    await p.waitForTimeout(200);
    let pan = await p.evaluate(() => {
      const pn = document.querySelector('.mcard-panel');
      return pn && { lock: !!pn.querySelector('[data-mlock="l:0"]'), swap: !!pn.querySelector('[data-mswap="l:0"]'),
        pin: !!pn.querySelector('[data-mpin="l:0"]'), del: !!pn.querySelector('[data-mdel="l:0"]'),
        steps: pn.querySelectorAll('[data-mstep^="l:0:"]').length, slide: !!pn.querySelector('[data-mslide="l:0"]'),
        big: pn.querySelector('.mcard-big').textContent, open: document.querySelector('[data-mamt="l:0"]').getAttribute('aria-expanded') };
    });
    t.ok('tapping the amount opens that food: steps, slider, lock, swap, pin, bin', pan && pan.lock && pan.swap && pan.pin && pan.del && pan.steps === 2 && pan.slide && pan.open === 'true', JSON.stringify(pan));
    t.ok('the panel leads with the grams', pan && /^140 g/.test(pan.big), JSON.stringify(pan));
    await p.click('[data-mamt="l:2"]');
    await p.waitForTimeout(200);
    pan = await p.evaluate(() => [...document.querySelectorAll('.mcard-panel [data-mdel]')].map((b) => b.dataset.mdel));
    t.ok('one panel at a time', pan.length === 1 && pan[0] === 'l:2', JSON.stringify(pan));
    await p.click('[data-mamt="l:2"]');
    await p.waitForTimeout(200);
    t.ok('tapping it again shuts it', await p.evaluate(() => !document.querySelector('.mcard-panel')));

    /* the steps are the plate's own */
    await p.click('[data-mamt="l:1"]');
    const x0 = (await lunchOf(p))[1].x;
    await p.click('[data-mstep="l:1:up"]');
    await p.waitForTimeout(200);
    const x1 = (await lunchOf(p))[1].x;
    t.ok('the + in the panel steps the portion, and the panel stays open', x1 > x0 && await p.evaluate(() => !!document.querySelector('.mcard-panel [data-mstep="l:1:up"]')), x0 + ' -> ' + x1);
    /* the slider walks the same steps and writes on letting go */
    await p.evaluate(() => {
      const s = document.querySelector('[data-mslide="l:1"]');
      s.value = String(Number(s.value) + 3);
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(250);
    const x2 = (await lunchOf(p))[1].x;
    t.ok('the slider writes a bigger portion when let go', x2 > x1, x1 + ' -> ' + x2);

    /* ---- the scales, with a lock ---- */
    await p.click('[data-mamt="l:5"]');
    await p.click('[data-mlock="l:5"]');
    await p.waitForTimeout(150);
    const before = await lunchOf(p);
    await p.click('[data-mbal="l"]');
    await p.waitForTimeout(400);
    const after = await lunchOf(p);
    const bal = await p.evaluate(() => ({
      moved: [...document.querySelectorAll('#macroSlots .mcard-row.moved')].map((r) => r.querySelector('.mcard-was').textContent),
      undo: !!document.querySelector('[data-mbalundo="l"]'),
      say: (document.querySelector('.mcard-foot .mcard-say') || {}).textContent, panels: document.querySelectorAll('.mcard-panel').length }));
    const changed = after.filter((it, i) => it.x !== before[i].x).length;
    t.ok('the locked avocado holds through the scales', after[5].x === before[5].x && after[5].l === 1, JSON.stringify(after[5]));
    t.ok('what moved is marked with what it was', changed > 0 && bal.moved.length === changed && bal.moved.every((w) => /^was \d[\d,]* g · /.test(w)), JSON.stringify(bal));
    t.ok('and the foot offers Undo, saying how many moved', bal.undo && new RegExp('^' + changed + ' amounts? changed').test(bal.say) && bal.panels === 0, JSON.stringify(bal));
    await p.click('[data-mbalundo="l"]');
    await p.waitForTimeout(250);
    const undone = await lunchOf(p);
    t.ok('Undo puts every amount back, and the marks go', undone.every((it, i) => it.x === before[i].x) &&
      await p.evaluate(() => !document.querySelector('#macroSlots .mcard-row.moved') && !document.querySelector('[data-mbalundo]')), JSON.stringify(undone.map((i) => i.x)));

    /* ---- swap is the picker for one ---- */
    await p.click('[data-mamt="l:1"]');
    await p.click('[data-mswap="l:1"]');
    await p.waitForTimeout(400);
    const eyebrow = await p.evaluate(() => (document.querySelector('.mp-sheet .sheet-eyebrow') || {}).textContent || '');
    t.ok('swap opens the picker, titled for the plate', /^Swap Cooked rice · /.test(eyebrow), eyebrow);
    const pick = await p.evaluate(() => {
      const b = [...document.querySelectorAll('.mp-sheet [data-mpick]')].find((x) => x.dataset.mpick !== 'f:rice_cooked');
      return b ? b.dataset.mpick : null;
    });
    await p.click('.mp-sheet [data-mpick="' + pick + '"]');
    await p.waitForTimeout(200);
    await p.click('[data-mpdone]');
    await p.waitForTimeout(500);
    const sw = await lunchOf(p);
    const fresh = await p.evaluate(() => [...document.querySelectorAll('#macroSlots .mcard-row.fresh')].map((r) => r.querySelector('.mcard-new') && r.querySelector('.mitem-name').textContent));
    t.ok('what was picked takes the plate\'s place; nothing is added', sw.length === 7 && sw[1].id === pick && sw[0].id === 'f:chicken_breast', JSON.stringify(sw.map((i) => i.id)));
    t.ok('and it is marked New', fresh.length === 1, JSON.stringify(fresh));

    /* ---- adding several from the picker ---- */
    await p.click('[data-mslot="l"]');
    await p.waitForTimeout(400);
    const two = await p.evaluate(() => {
      const ids = [...document.querySelectorAll('.mp-sheet [data-mpick]')].map((b) => b.dataset.mpick);
      return [...new Set(ids)].slice(0, 2);
    });
    for (const id of two) { await p.click('.mp-sheet [data-mpick="' + id + '"]'); await p.waitForTimeout(150); }
    await p.click('[data-mpdone]');
    await p.waitForTimeout(500);
    const added = await lunchOf(p);
    const fresh2 = await p.evaluate(() => document.querySelectorAll('#macroSlots .mcard-row.fresh').length);
    t.ok('two picked land on lunch, both marked New', added.length === 9 && fresh2 === 2, added.length + ' plates, ' + fresh2 + ' new');

    /* ---- the folded tick ---- */
    await p.click('[data-mfold="l"]');
    await p.waitForTimeout(250);
    await p.click('[data-mdot="l"]');
    await p.waitForTimeout(250);
    const ate = await lunchOf(p);
    const eatSay = await p.evaluate(() => (document.querySelector('[data-mfold="l"]').closest('.mslot').querySelector('.mcard-say') || {}).textContent);
    t.ok('the tick on a folded meal marks every food on it eaten', ate.every((it) => it.eaten) && eatSay === 'Eaten', eatSay);

    t.ok('no page errors', errs.length === 0, errs.join(' | '));
    await p.context().close();
  },
};
