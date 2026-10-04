/* The meal, the RP Diet way (Blake, 2026-10-04).
 *
 * Blake: "I miss the layout from the [RP] diet app from 2023." The day is a
 * list of meal cards; a meal opens as its own screen ("In it's own screen");
 * every food is a card whose amount bar — lock, grams, −, + — is always there.
 * Ours, on purpose: the macro pills ("our macro pills are better design"), no
 * picture box, no tick on a food ("Let's dial in the qty. And I'll complete
 * the whole meal"), no meal times. Mockup:
 * https://claude.ai/artifact/YCPumXnc1bDUA5EDkzwuhY */
const DAY = '2026-10-06';
const LUNCH = ['chicken_breast', 'rice_cooked', 'broccoli', 'black_beans', 'salsa', 'avocado', 'olive_oil'];

const SETUP = (lunch) => {
  localStorage.setItem('bsc.macroProfile', JSON.stringify({ sex: 'm', age: 43, ft: 5, inch: 11, lb: 192, act: 1.55, goal: 'cut1' }));
  localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 190, f: 70, c: 230 }));
  const f = (k, x, e) => ({ id: 'f:' + k, x: x, eaten: e ? 1 : 0 });
  const wrap = window.RECIPES.find((r) => /Buffalo Chicken Lettuce/i.test(r.name)) || window.RECIPES.find((r) => r.macro && r.name.length > 24);
  localStorage.setItem('bsc.macroDays', JSON.stringify({ '2026-10-06': {
    b: [f('greek_yogurt', 1, 1), f('oats', 0.75, 1)],
    l: lunch.map((k) => f(k, 1)),
    d: [{ id: wrap.id, x: 1, eaten: 0 }, f('whey', 1)],
  } }));
};
const mealOf = (p, sk) => p.evaluate((a) => JSON.parse(localStorage.getItem('bsc.macroDays'))[a[0]][a[1]], [DAY, sk]);

module.exports = {
  name: 'The meal, the RP way: day cards, a meal as its own screen, a card a food',
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

    /* ---- the day: meal cards ---- */
    const card = await p.evaluate(() => {
      const c = document.querySelector('[data-mfold="l"]').closest('.mslot');
      return { day: c.classList.contains('mday-card'), expanded: c.querySelector('[data-mfold]').getAttribute('aria-expanded'),
        foods: c.querySelectorAll('.mfood').length, pill: (c.querySelector('.mcard-pill') || {}).textContent,
        pills: c.querySelectorAll('.mcard-p .mmp').length, tick: !!c.querySelector('.mday-dot[data-mdot="l"]'),
        noTime: !/\d:\d\d/.test(c.textContent) };
    });
    t.ok('a meal on the day is a card: tick, name, a pill, our four pills, no time', card.day && card.expanded === 'false' && card.foods === 0 &&
      /^7 foods · Over targets$/.test(card.pill) && card.pills === 4 && card.tick && card.noTime, JSON.stringify(card));

    /* ---- its own screen ---- */
    await p.click('[data-mfold="l"]');
    await p.waitForTimeout(400);
    const scr = await p.evaluate(() => {
      const v = document.getElementById('view-macros');
      const c = document.querySelector('.mscreen-focus');
      const vis = (sel) => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none'; };
      return { focus: v.classList.contains('m-focus'), card: !!c, head: vis('.mday-stick'), bar: vis('.mday-acts'),
        others: [...document.querySelectorAll('#macroSlots > .mslot')].filter((x) => x !== c && getComputedStyle(x).display !== 'none').length,
        caps: c && c.querySelectorAll('.mcap').length, capTxt: c && c.querySelector('.mcap').textContent,
        foods: c && c.querySelectorAll('.mfood').length, bal: !!(c && c.querySelector('[data-mbal="l"]')),
        add: !!(c && c.querySelector('.mscreen-foot [data-mslot="l"]')), cam: !!(c && c.querySelector('.mscreen-foot [data-mscan="l"]')),
        ticks: c ? c.querySelectorAll('.mfood [data-meat], .mfood input[type=checkbox]').length : -1 };
    });
    t.ok('tapping it opens the meal as its own screen: the day header, the bar and the other meals step aside',
      scr.focus && scr.card && !scr.head && !scr.bar && scr.others === 0, JSON.stringify(scr));
    t.ok('the screen carries the meal\'s four pills against its share, the scales, Add foods and the camera',
      scr.caps === 4 && /^🔥[\d,]+\/[\d,]+$/.test(scr.capTxt) && scr.bal && scr.add && scr.cam, JSON.stringify(scr));
    t.ok('every food is a card, and no food has a tick of its own', scr.foods === 7 && scr.ticks === 0, JSON.stringify(scr));

    /* ---- a food card: the amount bar is always there ---- */
    const food = await p.evaluate(() => {
      const c = document.querySelector('.mscreen-focus .mfood');
      return { name: c.querySelector('.mitem-name').textContent, chip: (c.querySelector('.mfood-chip') || {}).textContent,
        lock: !!c.querySelector('.mfood-amt [data-mlock="l:0"]'), val: c.querySelector('.mfood-amt .mstep-x').textContent,
        keys: c.querySelectorAll('.mfood-amt [data-mstep^="l:0:"]').length, pic: !!c.querySelector('img, .mfood-pic'),
        menu: !!c.querySelector('[data-mfmenu="l:0"]') };
    });
    t.ok('a food card: its name, the kitchen measure, and lock · grams · − · + always showing',
      /^Chicken breasts?$/.test(food.name) && food.chip === '1 cup' && food.lock && food.val === '140 g' && food.keys === 2 && food.menu, JSON.stringify(food));
    t.ok('and no picture box', !food.pic, JSON.stringify(food));
    const x0 = (await mealOf(p, 'l'))[0].x;
    await p.click('[data-mstep="l:0:up"]');
    await p.waitForTimeout(200);
    const x1 = (await mealOf(p, 'l'))[0].x;
    t.ok('+ dials it up five grams, and the screen stays', Math.round(x1 * 140) === Math.round(x0 * 140) + 5 &&
      await p.evaluate(() => document.getElementById('view-macros').classList.contains('m-focus')), x0 + ' -> ' + x1);
    await p.click('[data-mfmenu="l:1"]');
    await p.waitForTimeout(200);
    const menu = await p.evaluate(() => [...document.querySelectorAll('.mfood-menu button')].map((b) => b.textContent.trim()));
    t.ok('⋯ on a food holds Swap, Pin and Remove', menu.join() === 'Swap,Pin,Remove', JSON.stringify(menu));
    /* one row at phone width, Remove at the far end, apart from the others */
    const mrow = await p.evaluate(() => {
      const bs = [...document.querySelectorAll('.mfood-menu button')].map((b) => b.getBoundingClientRect());
      return { rows: new Set(bs.map((r) => Math.round(r.top))).size, within: Math.round(bs[1].left - bs[0].right), apart: Math.round(bs[2].left - bs[1].right) };
    });
    t.ok('and they sit on one row, Remove standing apart', mrow.rows === 1 && mrow.apart > mrow.within, JSON.stringify(mrow));
    await p.click('[data-mfmenu="l:1"]');

    /* ---- the scales, with a lock ---- */
    await p.click('[data-mlock="l:5"]');
    await p.waitForTimeout(150);
    const before = await mealOf(p, 'l');
    await p.click('[data-mbal="l"]');
    await p.waitForTimeout(400);
    const after = await mealOf(p, 'l');
    const changed = after.filter((it, i) => it.x !== before[i].x).length;
    const bal = await p.evaluate(() => ({ was: [...document.querySelectorAll('.mfood.moved .mfood-chip.was')].map((e) => e.textContent),
      say: (document.querySelector('.mscreen-say') || {}).textContent, undo: !!document.querySelector('[data-mbalundo="l"]') }));
    t.ok('the locked avocado holds through the scales', after[5].x === before[5].x && after[5].l === 1, JSON.stringify(after[5]));
    t.ok('what moved says what it was, and Undo is offered', changed > 0 && bal.was.length === changed &&
      bal.was.every((w) => /^was \d[\d,]* g$/.test(w)) && bal.undo, JSON.stringify(bal));
    await p.click('[data-mbalundo="l"]');
    await p.waitForTimeout(250);
    t.ok('Undo puts every amount back', (await mealOf(p, 'l')).every((it, i) => it.x === before[i].x));

    /* ---- the meal's ⋯ ---- */
    await p.click('[data-mmenu="l"]');
    await p.waitForTimeout(200);
    const mm = await p.evaluate(() => [...document.querySelectorAll('.mscreen-menu button')].map((b) => b.getAttribute('data-mtry') !== null ? 'try' : b.getAttribute('data-mkeep') !== null ? 'keep' : b.getAttribute('data-mfrom') !== null ? 'from' : '?'));
    t.ok('the meal\'s ⋯ holds Try another, Save meal and Repeat a day', mm.join() === 'try,keep,from', JSON.stringify(mm));
    await p.click('[data-mmenu="l"]');

    /* ---- the camera goes straight to the scanner; back from the picker is the meal ---- */
    await p.click('[data-mscan="l"]');
    await p.waitForTimeout(400);
    t.ok('the camera opens the picker on the scanner', await p.evaluate(() => !!document.querySelector('.mp-sheet #scanRoot')));
    await p.goBack();
    await p.waitForTimeout(400);
    t.ok('and back from it lands on the meal, not the day',
      await p.evaluate(() => !document.querySelector('.mp-sheet') && document.getElementById('view-macros').classList.contains('m-focus')));

    /* ---- printed from a meal's own screen, the whole day goes on paper ---- */
    const paper = await p.evaluate(() => {
      window.dispatchEvent(new Event('beforeprint'));
      const during = [...document.querySelectorAll('#macroSlots > .mslot.filled')].map((c) => c.classList.contains('mscreen') && c.querySelectorAll('.mfood').length > 0);
      window.dispatchEvent(new Event('afterprint'));
      return { during, back: document.getElementById('view-macros').classList.contains('m-focus') };
    });
    t.ok('printing from a meal\'s own screen puts every meal on paper open, and gives the screen back after',
      paper.during.length >= 3 && paper.during.every(Boolean) && paper.back, JSON.stringify(paper));

    /* ---- the tick completes the whole meal ---- */
    await p.click('.mscreen-focus [data-mdot="l"]');
    await p.waitForTimeout(250);
    t.ok('the meal\'s tick marks every food on it eaten', (await mealOf(p, 'l')).every((it) => it.eaten));

    /* ---- back is the day ---- */
    await p.goBack();
    await p.waitForTimeout(400);
    const home = await p.evaluate(() => ({ focus: document.getElementById('view-macros').classList.contains('m-focus'),
      pill: (document.querySelector('[data-mfold="l"]').closest('.mslot').querySelector('.mcard-pill') || {}).textContent }));
    t.ok('the phone\'s back comes home to the day, lunch now saying Eaten', !home.focus && /Eaten$/.test(home.pill), JSON.stringify(home));

    /* ---- a scoop: grams first, in quarters; nothing cut short ---- */
    await p.click('[data-mfold="d"]');
    await p.waitForTimeout(300);
    for (let i = 0; i < 3; i++) { await p.click('[data-mstep="d:1:down"]'); await p.waitForTimeout(150); }
    const whey = await p.evaluate((d) => {
      const c = document.querySelectorAll('.mscreen-focus .mfood')[1];
      return { x: JSON.parse(localStorage.getItem('bsc.macroDays'))[d].d[1].x, val: c.querySelector('.mstep-x').textContent, chip: c.querySelector('.mfood-chip').textContent,
        clipped: [...document.querySelectorAll('.mscreen-focus .mstep-x, .mscreen-focus .mfood-chip, .mscreen-focus .mitem-name')].filter((e) => {
          /* the text itself against its box: an enlarged tap area (a ::after
             reach) widens scrollWidth without hiding a letter */
          const rg = document.createRange(); rg.selectNodeContents(e);
          const tw = rg.getBoundingClientRect().width, b = e.getBoundingClientRect();
          const cs = getComputedStyle(e);
          return tw > b.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 1 && cs.overflow !== 'visible';
        }).map((e) => e.textContent) };
    }, DAY);
    t.ok('a scoop steps in quarters, grams first and the scoop on the chip', whey.x === 0.25 && whey.val === '8 g' && whey.chip === '¼ scoop', JSON.stringify(whey));
    t.ok('and nothing on the screen is cut short, a long recipe name included', whey.clipped.length === 0, JSON.stringify(whey.clipped));

    t.ok('no page errors', errs.length === 0, errs.join(' | '));
    await p.context().close();
  },
};
