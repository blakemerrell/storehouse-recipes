/* Trays and the meal sheet (Blake, 2026-10-04).
 *
 * Blake, of the RP-style day: "The main page is worse now. Way to fat and
 * tall... hard to know where to add food... Many ways." So the day is small
 * trays (the meal's tick, its name, its calories against its share, its foods
 * as small lines) and a meal opens as ONE sheet: its pills, its foods dialled
 * in grams ("I dial in grams of food not kitchen measurements"), and the
 * picker under them, where a tap puts a food straight on the meal. No basket,
 * no "Add N", no per-meal Add, no Open all. Mockup:
 * https://claude.ai/artifact/SseR1TPa4JAFNanYYsGP4k */
const DAY = '2026-10-06';
const LUNCH = ['chicken_breast', 'rice_cooked', 'broccoli', 'black_beans', 'salsa', 'avocado', 'olive_oil'];

const SETUP = (lunch) => {
  localStorage.setItem('bsc.macroProfile', JSON.stringify({ sex: 'm', age: 43, ft: 5, inch: 11, lb: 192, act: 1.55, goal: 'cut1' }));
  localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 190, f: 70, c: 230 }));
  localStorage.setItem('bsc.macroSlots', JSON.stringify({ list: [{ k: 'w', n: 'Wake Up', t: 's' }, { k: 'b', n: 'Breakfast', t: 'b' },
    { k: 'l', n: 'Lunch', t: 'l' }, { k: 'd', n: 'Dinner', t: 'd' }], names: { w: 'Wake Up', b: 'Breakfast', l: 'Lunch', d: 'Dinner' } }));
  localStorage.setItem('bsc.macroSkip', JSON.stringify({ '2026-10-06': ['w'] }));
  const f = (k, x, e) => ({ id: 'f:' + k, x: x, eaten: e ? 1 : 0 });
  const wrap = window.RECIPES.find((r) => /Buffalo Chicken Lettuce/i.test(r.name)) || window.RECIPES.find((r) => r.macro && r.name.length > 24);
  localStorage.setItem('bsc.macroDays', JSON.stringify({
    '2026-10-05': { d: [f('banana', 1, 1), f('egg', 2, 1)] },
    '2026-10-06': {
      b: [f('greek_yogurt', 1, 1), f('oats', 0.75, 1)],
      l: lunch.map((k) => f(k, 1)),
      d: [{ id: wrap.id, x: 1, eaten: 0 }, f('whey', 1)],
    } }));
};
// the meal's rows live in its tray along the bottom (2026-10-05), which opens shut
const openTray = async (p) => {
  if (await p.$('#modalRoot .msh-tray:not(.open) .msh-trn')) { await p.click('#modalRoot .msh-tray .msh-trn'); await p.waitForTimeout(250); }
};
const mealOf = (p, sk) => p.evaluate((a) => JSON.parse(localStorage.getItem('bsc.macroDays'))[a[0]][a[1]] || [], [DAY, sk]);

module.exports = {
  name: 'Trays and the meal sheet: one way to add food, grams for everything',
  async run(t) {
    const p = await t.fresh({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
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

    /* ---- the day: trays ---- */
    const day = await p.evaluate(() => {
      const tr = [...document.querySelectorAll('#macroSlots .mtray')];
      const lunch = document.querySelector('[data-mopen="l"]').closest('.mtray');
      const lines = [...lunch.querySelectorAll('.mtray-f')].map((x) => x.textContent);
      return { trays: tr.length, skip: document.querySelectorAll('#macroSlots .mtray-skip').length,
        skipText: (document.querySelector('.mtray-skip') || {}).textContent,
        lines: lines, grams: lines.every((l) => / g$/.test(l)),
        caps: lunch.querySelectorAll('.mtray-caps .mcap').length,
        measured: lines.filter((l) => /(cups?|tbsp|whole|lb)/.test(l)).length,
        tick: !!lunch.querySelector('.mday-dot[data-mdot="l"]'),
        controls: lunch.querySelectorAll('button').length,
        add: !!document.getElementById('macroAdd'), openAll: !!document.getElementById('macroOpenAll'),
        bar: [...document.querySelectorAll('.mday-acts button')].filter((b) => b.offsetParent).map((b) => b.id) };
    });
    t.ok('the day is one small tray a meal, and a skipped meal is one line', day.trays === 3 && day.skip === 1 &&
      /Wake Up/i.test(day.skipText) && /skipped/.test(day.skipText), JSON.stringify(day));
    t.ok('a tray: the tick, the meal\u2019s four pills, and its foods as lines ending in grams', day.tick && day.lines.length === 7 &&
      day.grams && day.caps === 4, JSON.stringify(day));
    t.ok('each food in the kitchen\u2019s words before its weight (Blake: "if I just want to eyeball it I can")', day.measured === 7, JSON.stringify(day.lines));
    t.ok('and nothing else to press on it: the tick and the tray itself', day.controls === 2, JSON.stringify(day));
    t.ok('the bar is Rebalance, Sweep, Copy day and the one primary: no Add food, no Open all', !day.add && !day.openAll &&
      day.bar.join() === 'macroRebal,macroSweep,macroCopy,macroFill', JSON.stringify(day.bar));

    /* ---- the sheet ---- */
    await p.click('[data-mopen="l"]');
    await p.waitForTimeout(500);
    const shut = await p.evaluate(() => ({ chips: document.querySelectorAll('#modalRoot .msh-tray .msh-chip').length,
      rows: document.querySelectorAll('#modalRoot .mrows .mrow').length }));
    t.ok('the sheet opens with its foods in the tray along the bottom, shut: one chip a food', shut.chips === 7 && shut.rows === 0, JSON.stringify(shut));
    await openTray(p);
    const sh = await p.evaluate(() => {
      const s = document.querySelector('#modalRoot .msheet');
      if (!s) return null;
      const rows = [...s.querySelectorAll('.mrows .mrow')];
      return { caps: s.querySelectorAll('.msh-top .mcap').length, rows: rows.length,
        ticks: s.querySelectorAll('.mrows [data-meat], .mrows .mday-dot').length,
        dial: rows.every((r) => r.querySelector('[data-mstep$=":down"]') && r.querySelector('[data-mstep$=":up"]') && r.querySelector('[data-mfmenu]') &&
          / g$/.test(r.querySelector('.mstep-x').textContent)),
        find: !!s.querySelector('.msh-find #mpFind'), shelves: !!s.querySelector('.msh-find #mpShelves'),
        basket: !!s.querySelector('[data-mpdone], [data-mpbasket]'), tall: Math.max.apply(null, rows.map((r) => r.offsetHeight)) };
    });
    t.ok('opened, the tray is one row a food, under the meal\'s four pills', !!sh && sh.caps === 4 && sh.rows === 7, JSON.stringify(sh));
    t.ok('every food: − grams + and ⋯, and no tick of its own', sh && sh.dial && sh.ticks === 0, JSON.stringify(sh));
    t.ok('the rows are compact', sh && sh.tall <= 72, JSON.stringify(sh));
    t.ok('under them, the picker: the search box and the shelves, and no basket or Add', sh && sh.find && sh.shelves && !sh.basket, JSON.stringify(sh));

    /* + dials five grams */
    const x0 = (await mealOf(p, 'l'))[0].x;
    await p.click('#modalRoot [data-mstep="l:0:up"]');
    await p.waitForTimeout(250);
    const x1 = (await mealOf(p, 'l'))[0].x;
    const g = await p.evaluate(() => document.querySelector('#modalRoot [data-mtype="l:0"]').textContent);
    t.ok('+ dials it up five grams, in the sheet', Math.round(x1 * 140) === Math.round(x0 * 140) + 5 &&
      g === Math.round(x1 * 140) + ' g' && !!(await p.$('#modalRoot .msheet')), JSON.stringify({ x0, x1, g }));
    t.ok('and an amount you dial is yours: Kept, so the re-fit works around it', (await mealOf(p, 'l'))[0].l === 1);

    /* the food's ⋯ */
    await p.click('#modalRoot [data-mfmenu="l:5"]');
    await p.waitForTimeout(250);
    const menu = await p.evaluate(() => [...document.querySelectorAll('#modalRoot .mrow-menu .mfood-mi')].map((b) => b.textContent.trim()));
    t.ok('⋯ on a food holds Lock, Swap, Pin, Favourite and Remove', menu.join('|') === 'Lock the amount|Swap|Pin to Lunch|Favourite|Remove', JSON.stringify(menu));
    await p.click('#modalRoot .mrow-menu [data-mlock="l:5"]');
    await p.waitForTimeout(250);
    t.ok('Lock holds the avocado, and the menu closes', (await mealOf(p, 'l'))[5].l === 1 &&
      !(await p.$('#modalRoot .mrow-menu')), '');

    /* Balance, in the tray: everything moves again, what you set included,
       and what moved says what it was. No Undo (Blake: "No need for undo.
       I can simply remove that from my tray"). */
    const before = await mealOf(p, 'l');
    await p.click('#modalRoot .msh-tray [data-mbal="l"]');
    await p.waitForTimeout(400);
    const after = await mealOf(p, 'l');
    const bal = await p.evaluate(() => ({ was: [...document.querySelectorAll('#modalRoot .mrow-g small')].filter((s) => /^was /.test(s.textContent)).length,
      undo: !!document.querySelector('#modalRoot [data-mbalundo], #modalRoot .mcard-undo') }));
    const changed = after.filter((it, i) => it.x !== before[i].x).length;
    t.ok('Balance lets go of what you kept and locked: nothing on the meal is held after it', after.every((it) => !it.l), JSON.stringify(after));
    t.ok('what moved says what it was, and there is no Undo', changed > 0 && bal.was === changed && !bal.undo, JSON.stringify({ changed, bal }));

    /* the meal's ⋯ */
    await p.click('#modalRoot [data-mmenu="l"]');
    await p.waitForTimeout(250);
    const mm = await p.evaluate(() => [...document.querySelectorAll('#modalRoot .msh-menu .mfood-mi')].map((b) => b.textContent.trim()));
    t.ok('the meal\'s ⋯ holds Try another, Save meal and Repeat a day', mm.join('|') === 'Try another|Save meal|Repeat a day', JSON.stringify(mm));
    await p.click('#modalRoot .msh-t');
    await p.waitForTimeout(200);
    t.ok('a tap elsewhere closes it', !(await p.$('#modalRoot .msh-menu')));

    /* the tick, in the sheet, completes the meal; Done goes back to the day */
    await p.click('#modalRoot .msh-h [data-mdot="l"]');
    await p.waitForTimeout(300);
    t.ok('the sheet\'s tick marks every food on the meal eaten', (await mealOf(p, 'l')).every((it) => it.eaten));
    const spent = await p.evaluate(() => [...document.querySelectorAll('#modalRoot [data-mstep="l:0:up"]')].every((b) => b.disabled));
    t.ok('and an eaten meal\'s dials go quiet', spent);
    await p.click('#modalRoot .msheet .msh-done');
    await p.waitForTimeout(400);
    t.ok('Done goes back to the day, the tray ticked', !(await p.$('#modalRoot .msheet')) &&
      await p.evaluate(() => document.querySelector('[data-mopen="l"]').closest('.mtray').classList.contains('done')));

    /* ---- adding: one tap, straight onto the meal ---- */
    await p.click('[data-mopen="d"]');
    await p.waitForTimeout(500);
    await openTray(p);
    const n0 = (await mealOf(p, 'd')).length;
    const ban = await p.$('#modalRoot [data-mpick="f:banana"]');
    t.ok('Recent offers what dinner has had', !!ban);
    if (ban) {
      await p.click('#modalRoot [data-mpick="f:banana"]');
      await p.waitForTimeout(400);
      const d1 = await mealOf(p, 'd');
      const on = await p.evaluate(() => ({ pressed: (document.querySelector('#modalRoot [data-mpick="f:banana"]') || {}).getAttribute('aria-pressed'),
        row: [...document.querySelectorAll('#modalRoot .mrows .mrow')].some((r) => /Banana/i.test(r.textContent) && r.classList.contains('fresh')) }));
      t.ok('a tap puts it on dinner at once, at what you had last time, marked New in the tray',
        d1.length === n0 + 1 && d1[d1.length - 1].id === 'f:banana' && d1[d1.length - 1].x === 1 && on.pressed === 'true' && on.row, JSON.stringify({ d1, on }));
      await p.click('#modalRoot [data-mpick="f:banana"]');
      await p.waitForTimeout(400);
      t.ok('a second tap takes it back off', (await mealOf(p, 'd')).length === n0);
    }

    /* Swap: the marked plate is replaced by the next tap */
    await p.click('#modalRoot [data-mfmenu="d:1"]');
    await p.waitForTimeout(200);
    await p.click('#modalRoot .mrow-menu [data-mswap="d:1"]');
    await p.waitForTimeout(300);
    t.ok('Swap marks the plate and says what to do', !!(await p.$('#modalRoot .mrow.swapping .mrow-swap')));
    await p.click('#modalRoot [data-mpick="f:banana"]');
    await p.waitForTimeout(400);
    const sw = await mealOf(p, 'd');
    t.ok('and the next tap takes its place', sw.length === n0 && sw[1].id === 'f:banana', JSON.stringify(sw));

    /* grams for everything, each by its own step */
    const st = await p.evaluate(() => {
      const r = [...document.querySelectorAll('#modalRoot .mrows .mrow')];
      return r.map((x) => x.querySelector('.mstep-x').textContent);
    });
    await p.click('#modalRoot [data-mstep="d:0:up"]');
    await p.waitForTimeout(250);
    const st2 = await p.evaluate(() => document.querySelector('#modalRoot [data-mtype="d:0"]').textContent);
    const g0 = parseInt(st[0].replace(/[^\d]/g, ''), 10), g1 = parseInt(st2.replace(/[^\d]/g, ''), 10);
    t.ok('a recipe dials in grams from its serving weight, five at a time', /^~?[\d,]+ g$/.test(st[0]) && g1 - g0 >= 1 && g1 - g0 <= 5 && g1 % 5 === 0, JSON.stringify({ st, st2 }));

    /* the pins: the header and pills always; the search under them once scrolled */
    await p.evaluate(() => { const s = document.querySelector('#modalRoot .scrim'); s.scrollTop = 900; });
    await p.waitForTimeout(250);
    const pin = await p.evaluate(() => {
      const top = document.querySelector('#modalRoot .msh-top').getBoundingClientRect();
      const find = document.querySelector('#modalRoot .msh-find').getBoundingClientRect();
      const sheet = document.querySelector('#modalRoot .msheet').getBoundingClientRect();
      const scrim = document.querySelector('#modalRoot .scrim');
      return { scrolled: scrim.scrollTop, topAt: Math.round(top.top), findAt: Math.round(find.top), topBottom: Math.round(top.bottom), sheetTop: Math.round(sheet.top) };
    });
    t.ok('scrolled, the meal\'s header and pills stay pinned, and the search and shelves under them',
      pin.scrolled > 200 && pin.topAt <= 2 && Math.abs(pin.findAt - pin.topBottom) <= 2, JSON.stringify(pin));
    const trayAt = await p.evaluate(() => Math.round(innerHeight - document.querySelector('#modalRoot .msh-tray').getBoundingClientRect().bottom));
    t.ok('and the tray stays pinned along the bottom, Balance and Done under the thumb', Math.abs(trayAt) <= 2 &&
      !!(await p.$('#modalRoot .msh-tray .msh-bal')) && !!(await p.$('#modalRoot .msh-tray .msh-done')), String(trayAt));

    /* a recipe's name opens the recipe; back lands on the meal's sheet */
    await p.evaluate(() => { const s = document.querySelector('#modalRoot .scrim'); s.scrollTop = 0; });
    await p.click('#modalRoot .mrows [data-open]');
    await p.waitForTimeout(400);
    const rec = await p.evaluate(() => !document.querySelector('#modalRoot .msheet') && !!document.querySelector('#modalRoot .sheet'));
    await p.goBack();
    await p.waitForTimeout(400);
    t.ok('a recipe\'s name opens the recipe, and back lands on the meal\'s sheet', rec && !!(await p.$('#modalRoot .msheet')));

    /* Whey: a quarter scoop, said in grams */
    await p.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('bsc.macroDays'));
      d['2026-10-06'].d = [{ id: 'f:whey', x: 1, eaten: 0 }];
      localStorage.setItem('bsc.macroDays', JSON.stringify(d));
    });
    await p.reload();
    await p.waitForTimeout(800);
    await p.click('.tab[data-view="macros"]');
    await p.waitForTimeout(500);
    await p.click('[data-mopen="d"]');
    await p.waitForTimeout(400);
    await openTray(p);
    const wi = (await mealOf(p, 'd')).findIndex((it) => it.id === 'f:whey');
    let whey = null;
    if (wi >= 0) {
      await p.click('#modalRoot [data-mstep="d:' + wi + ':down"]');
      await p.waitForTimeout(250);
      whey = await p.evaluate((i) => ({ val: document.querySelector('#modalRoot [data-mtype="d:' + i + '"]').textContent,
        m: document.querySelectorAll('#modalRoot .mrows .mrow')[i].querySelector('.mitem-uom').textContent }), wi);
    }
    t.ok('a scoop steps a quarter at a time and says it in grams, the scoop in the small print', !!whey && whey.val === '24 g' && whey.m === '¾ scoop', JSON.stringify(whey));

    t.ok('no page errors', errs.length === 0, errs.join(' | '));
  },
};
