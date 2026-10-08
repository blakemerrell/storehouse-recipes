/* A meal opened in its own tray on the day (Blake, 2026-10-08).
 *
 * Blake, dialling his evening snack in its sheet: "How am I supposed to see
 * how this meal and the daily macros at the same time? Maybe I just need a
 * way to go back having a tray on the main meal screen where I can adjust
 * the foods that have been added in that area so I can see the meal macros
 * and the day macros at the same time." So a meal with food on it opens in
 * place: its rows, with the sheet's dials, inside its tray, under the day's
 * pills pinned at the top. "+ Add food" goes on into the sheet; an empty
 * meal opens the sheet at once.
 *
 * Also here, two plates that read wrong on his day the same evening: a
 * scanned can, "1 1 can (335 ml)", and a USDA food whose dial said
 * ", NS as t" (src/portion.js, mLabelServing). */
const DAY = '2026-10-08';

const SETUP = () => {
  localStorage.setItem('bsc.macroProfile', JSON.stringify({ sex: 'm', age: 43, ft: 5, inch: 11, lb: 192, act: 1.55, goal: 'cut1' }));
  localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 190, f: 70, c: 230 }));
  localStorage.setItem('bsc.macroSlots', JSON.stringify({ list: [{ k: 'b', n: 'Breakfast', t: 'b' }, { k: 'l', n: 'Lunch', t: 'l' },
    { k: 'd', n: 'Dinner', t: 'd' }, { k: 's', n: 'Snacks', t: 's' }], names: { b: 'Breakfast', l: 'Lunch', d: 'Dinner', s: 'Snacks' } }));
  localStorage.setItem('bsc.myFoods', JSON.stringify({
    spark: { name: 'Sparkling Protein', unit: '1 can (335 ml)', kcal: 124, p: 30, f: 0, c: 1 },
    fries: { name: 'Potato, french fries, from fresh, fried', unit: '1 order, NS as to size', kcal: 202, p: 0, f: 16, c: 16 } }));
  const f = (k, x) => ({ id: 'f:' + k, x: x, eaten: 0 });
  localStorage.setItem('bsc.macroDays', JSON.stringify({ '2026-10-08': {
    l: [f('chicken_breast', 1), f('green_beans', 1), f('apple', 1)],
    d: [f('egg', 2)],
    s: [{ id: 'f:my:spark', x: 1, eaten: 0 }, { id: 'f:my:fries', x: 1, eaten: 0 }] } }));
};
const mealOf = (p, sk) => p.evaluate((a) => JSON.parse(localStorage.getItem('bsc.macroDays'))[a[0]][a[1]] || [], [DAY, sk]);
const pillsOf = (p, sel) => p.evaluate((s) => (document.querySelector(s) || {}).textContent || '', sel);
const tray = (sk) => '#macroSlots .mtray:has([data-mday="' + sk + '"])';

module.exports = {
  name: 'A meal opened on the day: its foods dialled under the day’s pills',
  async run(t) {
    const p = await t.fresh({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await p.clock.setFixedTime(new Date(2026, 9, 8, 10, 0, 0));
    await p.reload();
    await p.waitForTimeout(600);
    await p.evaluate(SETUP);
    await p.reload();
    await p.waitForTimeout(900);
    await p.click('.tab[data-view="macros"]');
    await p.waitForTimeout(500);

    /* ---- shut, a tray says what it holds; a tap opens it where it is ---- */
    const shut = await p.evaluate(() => {
      const b = document.querySelector('#macroSlots [data-mday="l"]');
      return { door: !!b, expanded: b && b.getAttribute('aria-expanded'), say: b && b.getAttribute('aria-label'),
        rows: document.querySelectorAll('#macroSlots .mrow').length,
        empty: !!document.querySelector('#macroSlots [data-mopen="b"]:not([data-mday])') };
    });
    t.ok('a meal with food on it opens in place, and its tray says so; an empty one does not',
      shut.door && shut.expanded === 'false' && /^Open Lunch here to change its foods/.test(shut.say) && shut.rows === 0 && shut.empty,
      JSON.stringify(shut));

    await p.click('#macroSlots [data-mday="l"]');
    await p.waitForTimeout(300);
    const open = await p.evaluate((sel) => {
      const tr = document.querySelector(sel);
      const rows = tr ? [...tr.querySelectorAll('.mrow')] : [];
      const pills = document.getElementById('macroPills');
      return { sheet: !!document.querySelector('#modalRoot .msheet'), open: !!tr && tr.classList.contains('open'), rows: rows.length,
        dials: rows.every((r) => r.querySelector('[data-mstep$=":down"]') && r.querySelector('[data-mstep$=":up"]') &&
          r.querySelector('[data-mtype]') && r.querySelector('[data-mfmenu]')),
        caps: tr ? tr.querySelectorAll('.mtray-caps .mcap').length : 0,
        dayPills: !!pills && pills.offsetParent !== null && /\d/.test(pills.textContent),
        add: !!(tr && tr.querySelector('.mtray-add[data-mopen="l"]')), bal: !!(tr && tr.querySelector('[data-mbal="l"]')),
        fold: (tr.querySelector('[data-mday="l"]') || {}).getAttribute('aria-expanded') };
    }, tray('l'));
    t.ok('tapped, Lunch opens in its own tray on the day, not in a sheet over it', !open.sheet && open.open && open.fold === 'true', JSON.stringify(open));
    t.ok('one row a food, each with −, its amount, + and ⋯', open.rows === 3 && open.dials, JSON.stringify(open));
    t.ok('the meal’s pills on its tray and the day’s pills on the page, both there at once', open.caps === 4 && open.dayPills, JSON.stringify(open));
    t.ok('with Balance and "+ Add food" at its foot', open.add && open.bal, JSON.stringify(open));

    /* + moves the meal and the day together, and the amount is yours */
    const meal0 = await pillsOf(p, tray('l') + ' .mtray-caps'), day0 = await pillsOf(p, '#macroPills');
    const x0 = (await mealOf(p, 'l'))[0].x;
    await p.click('#macroSlots [data-mstep="l:0:up"]');
    await p.waitForTimeout(300);
    const l1 = await mealOf(p, 'l');
    const meal1 = await pillsOf(p, tray('l') + ' .mtray-caps'), day1 = await pillsOf(p, '#macroPills');
    t.ok('+ on the chicken dials it up five grams, there on the day, and it is Kept', Math.round(l1[0].x * 140) === Math.round(x0 * 140) + 5 && l1[0].l === 1,
      JSON.stringify(l1[0]));
    t.ok('and the meal’s pills and the day’s move with it', meal1 !== meal0 && day1 !== day0, JSON.stringify({ meal0, meal1, day0, day1 }));
    t.ok('the tray stays open through it', await p.evaluate((sel) => !!document.querySelector(sel + '.open'), tray('l')));

    /* an amount typed in the tray */
    await p.click('#macroSlots [data-mtype="l:1"]');
    await p.waitForTimeout(200);
    const box = await p.evaluate(() => { const b = document.querySelector('#macroSlots .mtray.open .mstep-in'); return !!b && document.activeElement === b; });
    await p.keyboard.type('150');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(300);
    const beans = await p.evaluate(() => (document.querySelector('#macroSlots [data-mtype="l:1"]') || {}).textContent);
    t.ok('tapping an amount opens a box in the tray, focused, and what is typed is the amount', box && beans === '150 g' && (await mealOf(p, 'l'))[1].l === 1,
      JSON.stringify({ box, beans }));

    /* a food's ⋯ opens in the tray and a tap elsewhere puts it away */
    await p.click('#macroSlots [data-mfmenu="l:2"]');
    await p.waitForTimeout(200);
    const menu = await p.evaluate(() => [...document.querySelectorAll('#macroSlots .mrow-menu .mfood-mi')].map((b) => b.textContent.trim()));
    await p.click(tray('l') + ' .mtray-caps');
    await p.waitForTimeout(200);
    t.ok('⋯ on a food in the tray holds the sheet’s verbs, and closes on a tap elsewhere',
      menu.join('|') === 'Lock the amount|Swap|Pin to Lunch|Favourite|Remove' && !(await p.$('#macroSlots .mrow-menu')), JSON.stringify(menu));

    /* "+ Add food": the sheet, on its list, the foods tucked into its chips */
    await p.evaluate((sel) => document.querySelector(sel + ' .mtray-add').scrollIntoView({ block: 'center' }), tray('l'));
    await p.click(tray('l') + ' .mtray-add');
    await p.waitForTimeout(400);
    const add = await p.evaluate(() => {
      const s = document.querySelector('#modalRoot .msheet');
      const strip = s && s.querySelector('.msh-tray .msh-trc');
      return { sheet: !!s, on: !!(s && s.querySelector('.msh-on')), strip: !!strip && getComputedStyle(strip).display !== 'none',
        chips: s ? s.querySelectorAll('.msh-chip').length : 0, find: !!(s && s.querySelector('#mpFind')) };
    });
    t.ok('"+ Add food" opens the meal’s sheet on its list, the foods tucked into the chips along the bottom',
      add.sheet && !add.on && add.strip && add.chips === 3 && add.find, JSON.stringify(add));
    await p.click('#modalRoot .msh-done');
    await p.waitForTimeout(400);
    t.ok('and Done lands back on the day with Lunch still open', !(await p.$('#modalRoot .msheet')) && !!(await p.$(tray('l') + '.open')));

    /* one open at a time; the header folds */
    await p.click('#macroSlots [data-mday="d"]');
    await p.waitForTimeout(300);
    const two = await p.evaluate(() => [...document.querySelectorAll('#macroSlots .mtray.open [data-mday]')].map((b) => b.dataset.mday));
    t.ok('opening Dinner folds Lunch: one tray open at a time', two.join() === 'd', JSON.stringify(two));
    await p.click('#macroSlots [data-mday="d"]');
    await p.waitForTimeout(300);
    const folded = await p.evaluate((sel) => ({ open: document.querySelectorAll('#macroSlots .mtray.open').length,
      lines: document.querySelectorAll(sel + ' .mtray-f').length }), tray('d'));
    t.ok('and a tap on its header folds it back to its lines', folded.open === 0 && folded.lines === 1, JSON.stringify(folded));

    /* an empty meal: nothing to change here, so straight to its sheet */
    await p.evaluate(() => { const b = document.querySelector('#macroSlots [data-mopen="b"]'); b.scrollIntoView({ block: 'center' }); b.click(); });
    await p.waitForTimeout(400);
    t.ok('an empty meal’s tray opens its sheet at once', !!(await p.$('#modalRoot .msheet')) && !(await p.$('#macroSlots .mtray.open')));
    await p.click('#modalRoot .msh-done');
    await p.waitForTimeout(300);

    /* ---- two plates that read wrong ---- */
    const snack = await p.evaluate((sel) => [...document.querySelectorAll(sel + ' .mtray-f')].map((l) => l.textContent.replace(/\s+/g, ' ').trim()), tray('s'));
    t.ok('a can said "1 can (335 ml)" reads "1 can" on the day, not "1 1 can (335 ml)"',
      snack.some((l) => /^Sparkling Protein\s*1 can$/.test(l)) && !snack.some((l) => /1 1 can/.test(l)), JSON.stringify(snack));
    await p.click('#macroSlots [data-mday="s"]');
    await p.waitForTimeout(300);
    const fries = await p.evaluate(() => (document.querySelector('#macroSlots [data-mtype="s:1"]') || {}).textContent);
    t.ok('and the USDA’s "1 order, NS as to size" dials as "1 order", its shrug left out', fries === '1 order', fries);
  },
};
