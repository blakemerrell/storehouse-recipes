/* Skip on the meal's card, and where each card starts (Blake, 2026-10-10).
 *
 * "I need a way to easily skip a meal on the main day menu. Somehow that got
 * buried in the food selector." It was in the meal sheet's ⋯, and only on an
 * empty meal, because a skip counts only on an empty one. So the card has ⊘:
 * an empty meal skips at once, a meal with food on it asks on the card, and
 * either way the toast has Undo — he chose "clear it, with Undo". A skipped
 * meal's row says Put back. A meal anything was eaten from has no ⊘.
 *
 * And the cards' three views (tests/daylines.test.js steps them): each
 * starts where he chose ("B") — an eaten meal on Status, the next meal on
 * Details, the rest on Foods — and paper shows every meal whole.
 * Mockup: https://claude.ai/artifact/Vn1dzLvzzUgVBxKNPdUc8c */
const DAY = '2026-10-10';

const SETUP = () => {
  localStorage.setItem('bsc.macroProfile', JSON.stringify({ sex: 'm', age: 43, ft: 5, inch: 11, lb: 192, act: 1.55, goal: 'cut1' }));
  localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 190, f: 70, c: 230 }));
  localStorage.setItem('bsc.macroSlots', JSON.stringify({ list: [{ k: 'b', n: 'Breakfast', t: 'b' }, { k: 'l', n: 'Lunch', t: 'l' },
    { k: 'd', n: 'Dinner', t: 'd' }, { k: 's', n: 'Snacks', t: 's' }], names: { b: 'Breakfast', l: 'Lunch', d: 'Dinner', s: 'Snacks' } }));
  const f = (k, x, e) => ({ id: 'f:' + k, x: x, eaten: e ? 1 : 0 });
  localStorage.setItem('bsc.macroDays', JSON.stringify({ '2026-10-10': {
    b: [f('greek_yogurt', 1, 1), f('oats', 0.75, 1)],
    l: [f('chicken_breast', 1), f('green_beans', 1), f('apple', 1)],
    d: [{ id: 66, x: 1, eaten: 0 }, f('egg', 2)],
    s: [] } }));
};
const dayOf = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem('bsc.macroDays'))[k], DAY);
const skips = (p) => p.evaluate((k) => (JSON.parse(localStorage.getItem('bsc.macroSkip') || '{}')[k]) || [], DAY);
const card = (sk) => '#macroSlots .mtray[data-mslot="' + sk + '"]';
const wantOf = (p, sk) => p.evaluate((sel) => Number((document.querySelector(sel + ' .mtray-caps .mcap') || { dataset: {} }).dataset.want), card(sk));

module.exports = {
  name: 'Skip on the meal card, and where each card starts',
  async run(t) {
    const p = await t.fresh({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await p.clock.setFixedTime(new Date(2026, 9, 10, 12, 0, 0));
    await p.reload();
    await p.waitForTimeout(600);
    await p.evaluate(SETUP);
    await p.reload();
    await p.waitForTimeout(900);
    await p.click('.tab[data-view="macros"]');
    await p.waitForTimeout(500);

    /* ---- where each card starts ---- */
    const start = await p.evaluate(() => [...document.querySelectorAll('#macroSlots .mtray[data-mslot]')].map((c) => ({
      k: c.dataset.mslot, v: (c.className.match(/\bmv-(\d)/) || [])[1], beads: c.querySelectorAll('.mbd').length,
      skip: !!c.querySelector('[data-mskipask]'), door: !!c.querySelector('.mtray-b[data-mopen]') })));
    t.ok('the eaten breakfast starts on Status with its four circles; Lunch, next, on Details; Dinner and the empty Snacks on Foods',
      start.map((c) => c.k + c.v).join() === 'b1,l3,d2,s2' && start[0].beads === 4 && start.slice(1).every((c) => !c.beads), JSON.stringify(start));
    t.ok('every card keeps its door to the meal, Status too', start.every((c) => c.door), JSON.stringify(start));
    t.ok('a meal anything was eaten from has no ⊘; the others do', !start[0].skip && start.slice(1).every((c) => c.skip), JSON.stringify(start));

    /* ---- an empty meal skips at once, with Undo ---- */
    const lunchWant0 = await wantOf(p, 'l');
    await p.click('[data-mskipask="s"]');
    await p.waitForTimeout(300);
    const toast1 = await p.evaluate(() => { const el = document.getElementById('mToast'); return { shown: !el.hidden, text: el.textContent, undo: !!el.querySelector('[data-mskipundo]') }; });
    t.ok('⊘ on the empty Snacks skips it at once: no question, and a toast with Undo',
      (await skips(p)).join() === 's' && !(await p.$('.mtray-ask')) && toast1.shown && /^Snacks skipped\.Undo$/.test(toast1.text) && toast1.undo, JSON.stringify(toast1));
    const row = await p.evaluate(() => {
      const el = document.querySelector('#macroSlots .mtray-skip');
      return el && { door: (el.querySelector('[data-mopen]') || { dataset: {} }).dataset.mopen, back: (el.querySelector('[data-mskip]') || {}).textContent };
    });
    t.ok('and its row says skipped, opens its sheet, and has Put back on it', !!row && row.door === 's' && row.back === 'Put back', JSON.stringify(row));
    const lunchWant1 = await wantOf(p, 'l');
    t.ok('its share goes to the meals still open: Lunch is asked for more', lunchWant1 > lunchWant0, JSON.stringify({ lunchWant0, lunchWant1 }));
    await p.click('#mToast [data-mskipundo]');
    await p.waitForTimeout(300);
    t.ok('Undo puts it back', (await skips(p)).length === 0 && !(await p.$('#macroSlots .mtray-skip')) && (await wantOf(p, 'l')) === lunchWant0);

    /* Put back, on the row */
    await p.click('[data-mskipask="s"]');
    await p.waitForTimeout(300);
    await p.click('#macroSlots .mtray-skip [data-mskip="s"]');
    await p.waitForTimeout(300);
    t.ok('and Put back on the row puts it back too', (await skips(p)).length === 0 && !!(await p.$(card('s'))));

    /* ---- a meal with food on it asks first, on its card ---- */
    const d0 = (await dayOf(p)).d;
    await p.click('[data-mskipask="d"]');
    await p.waitForTimeout(250);
    const ask = await p.evaluate((sel) => {
      const a = document.querySelector(sel + ' .mtray-ask');
      return a && { text: a.querySelector('p').textContent, go: (a.querySelector('[data-mskipgo]') || {}).textContent, no: (a.querySelector('[data-mskipno]') || {}).textContent };
    }, card('d'));
    t.ok('⊘ on Dinner asks on the card first, saying what goes and where its share goes',
      !!ask && ask.text === 'Skip Dinner today? Its 2 planned foods come off, and its share goes to Lunch and Snacks.' &&
      ask.go === 'Skip Dinner' && ask.no === 'Keep it' && (await skips(p)).length === 0, JSON.stringify(ask));
    await p.click('[data-mskipno="d"]');
    await p.waitForTimeout(250);
    t.ok('Keep it closes the question, nothing changed, and the focus goes back to ⊘',
      !(await p.$('.mtray-ask')) && JSON.stringify((await dayOf(p)).d) === JSON.stringify(d0) &&
      await p.evaluate(() => document.activeElement && document.activeElement.dataset.mskipask === 'd'));
    await p.click('[data-mskipask="d"]');
    await p.waitForTimeout(250);
    await p.click('[data-mskipgo="d"]');
    await p.waitForTimeout(300);
    const gone = await dayOf(p);
    t.ok('Skip Dinner takes its food off and skips it, and the toast says so with Undo',
      (gone.d || []).length === 0 && (await skips(p)).join() === 'd' &&
      /^Dinner skipped, and its 2 foods came off\.Undo$/.test(await p.evaluate(() => document.getElementById('mToast').textContent)), JSON.stringify(gone.d));
    await p.click('#mToast [data-mskipundo]');
    await p.waitForTimeout(300);
    t.ok('Undo puts its food back as it was, and the skip comes off',
      JSON.stringify((await dayOf(p)).d) === JSON.stringify(d0) && (await skips(p)).length === 0, JSON.stringify((await dayOf(p)).d));

    /* ---- paper shows every meal whole ---- */
    await p.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await p.waitForTimeout(200);
    const paper = await p.evaluate(() => [...document.querySelectorAll('#macroSlots .mtray[data-mslot]')].map((c) => (c.className.match(/\bmv-(\d)/) || [])[1]).join());
    await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await p.waitForTimeout(200);
    const back = await p.evaluate(() => [...document.querySelectorAll('#macroSlots .mtray[data-mslot]')].map((c) => (c.className.match(/\bmv-(\d)/) || [])[1]).join());
    // the empty Snacks has nothing to show on either, and stays as it was drawn
    t.ok('printing shows every meal with food on Details, and the cards go back after', paper === '3,3,3,2' && back === '1,3,2,2', JSON.stringify({ paper, back }));

    /* ---- the narrowest phone: one line a head, a thumb a button, no sideways scroll ---- */
    await p.setViewportSize({ width: 320, height: 760 });
    for (const v of [1, 2, 3]) {
      for (const sk of ['l', 'd']) {
        for (let i = 0; i < 3 && await p.$eval(card(sk) + ' [data-mview]', (e) => e.dataset.mv) !== String(v); i++) {
          await p.click(card(sk) + ' [data-mview]');
          await p.waitForTimeout(150);
        }
      }
      const fit = await p.evaluate(() => {
        const heads = [...document.querySelectorAll('#macroSlots .mtray-hr')].map((h) => Math.round(h.getBoundingClientRect().height));
        const small = [...document.querySelectorAll('#macroSlots button')].filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width && r.height && Math.min(r.width, r.height) < 43.5 && !e.classList.contains('mtray-b') && !e.classList.contains('mtray-fn');
        }).map((e) => e.className + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
        return { heads, small, wide: document.documentElement.scrollWidth };
      });
      t.ok('at 320 px on view ' + v + ': every head one line, every button a thumb, nothing sideways',
        fit.heads.every((h) => h <= 50) && !fit.small.length && fit.wide <= 320, JSON.stringify(fit));
    }
  },
};
