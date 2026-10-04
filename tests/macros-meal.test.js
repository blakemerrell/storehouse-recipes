/* A row read against what the day is owed, the picker speaking for the meal
 * it fills, the plate contained, the cascade and the chooser, the figures
 * inside the bar, how far off rather than which side, skipping a meal, pills
 * the same size, and the cap.
 *
 * Part of the Nourish suite, split out of tests/macros.test.js: the page
 * helpers and the plan every page starts with are in tests/fixtures/nourish.js. */
const { nourish, openBasket, pickerList, openDay } = require('./fixtures/nourish.js');

/* Opens one meal the way a thumb does, if it is not open already. Since the
   RP-style day (Blake, 2026-10-04) every meal arrives as a folded day card —
   except one still asking where its overflow goes — and a meal's plates and
   verbs are only on its open screen. */
async function openMeal(pg, sk) {
  const b = await pg.$('#macroSlots [data-mfold="' + sk + '"][aria-expanded="false"]');
  if (b) { await b.click(); await pg.waitForTimeout(300); }
}

module.exports = nourish({
  name: 'Macros — a meal: its rows, the plate, the cascade, skipping, the cap',
  async suite(t) {
    /* ---- a row read against what the day is owed -------------------------
     * The numbers on a row used to be facts about the dish. They are facts
     * about the dish AGAINST YOUR DAY now: green where this portion lands a
     * macro, warm where it busts one, silent where it does neither. */
    const gapRow = await t.fresh();
    await gapRow.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      const g = new Date(); g.setDate(g.getDate() + 120);
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: { b: [], l: [], d: [], s: [] } }));
      localStorage.setItem('bsc.macroProfile', JSON.stringify({
        sex: 'm', age: 41, ft: 5, inch: 11, lb: 204, act: 1.55, goal: 'cut1', goalLb: 175,
        goalBy: g.getFullYear() + '-' + p2(g.getMonth() + 1) + '-' + p2(g.getDate()),
        workouts: 4, steps: 8000 }));
    });
    await gapRow.reload();
    await gapRow.waitForTimeout(400);
    await gapRow.click('.tab[data-view="macros"]');
    await gapRow.waitForTimeout(300);
    /* A row is judged against what the day still OWES, so the day has to be
       most of the way built before a portion can land or bust anything.
     *
       This used to run on an empty day and still saw a mix — but only because
       targets were the 180/50/50 placeholder, and for the 204 lb man this test
       sets up, 1,370 kcal sits under the 1,500 floor. The correction that
       exists to catch exactly that never ran, because the early return in
       mReadTargets handed the placeholder back before it could. With a real
       plan the gap on an empty day is wider than any single portion and every
       row goes silent, which is the honest answer to a day nobody has started.
     *
       So breakfast and snacks are built and lunch and dinner left empty. Two
       meals owed is the shape this feature is for: a list saying which dishes
       close what is left.
     *
       Seeded rather than Filled, because Fill picks at random from its top
       three and the gap it leaves is a different gap every run. The judgement
       needs that gap in a WINDOW — under a band and every row lands, well
       over one and every row goes silent — so a random day flipped this
       assertion between pass and fail with nothing in the code changing.
       Dishes are taken in id order and added until what is owed sits between
       one band and a bit over two, which is the shape the sentence above
       describes, arrived at on purpose. */
    await gapRow.evaluate(() => {
      const T = window.__macroLab.targets();
      const band = Math.max(3, T.p * 0.1);
      const pool = window.RECIPES.filter((r) => r.macro && r.macro.p > 0)
        .sort((a, b) => a.id - b.id);
      const put = { b: [], l: [], d: [], s: [] };
      let got = 0;
      for (const r of pool) {
        if (T.p - (got + r.macro.p) < band) continue;   // never fill the gap shut
        put[put.b.length <= put.s.length ? 'b' : 's'].push({ id: r.id, x: 1, eaten: 0 });
        got += r.macro.p;
        if (T.p - got <= 2.2 * band) break;
      }
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: put }));
    });
    await gapRow.reload();
    await gapRow.waitForTimeout(400);
    await gapRow.click('.tab[data-view="macros"]');
    await gapRow.waitForTimeout(300);
    /* Said out loud, so that a day which failed to reach the window fails
       HERE, naming the setup, instead of further down where it would read as
       the judgement being broken. */
    const gapWindow = await gapRow.evaluate(() => {
      const T = window.__macroLab.targets(), tot = window.__macroLab.read().tot;
      const band = Math.max(3, T.p * 0.1);
      return { owed: Math.round(T.p - tot.p), band: Math.round(band),
        ok: (T.p - tot.p) > band && (T.p - tot.p) <= 2.4 * band };
    });
    /* ---- two cards carrying more than they earned ------------------------
     *
     * Blake, off a screenshot of his own day: the weigh-in card announces a
     * seven-day average, a week's trend, a goal date, the pounds remaining
     * and a pace verdict — under the words "not yet". Four lines of evidence
     * for a number he had not entered. And every empty meal wore an em dash
     * on a line of its own. */
    const trimPg = await t.fresh();
    await trimPg.evaluate(() => {
      const d = new Date();
      const g = new Date(); g.setDate(g.getDate() + 120);
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      localStorage.setItem('bsc.macroProfile', JSON.stringify({ sex: 'm', age: 41, ft: 5, inch: 11,
        lb: 204, act: 1.55, goal: 'cut1', goalLb: 175,
        goalBy: g.getFullYear() + '-' + p2(g.getMonth() + 1) + '-' + p2(g.getDate()),
        workouts: 4, steps: 8000 }));
      localStorage.removeItem('bsc.macroDays');
      localStorage.removeItem('bsc.macroWeights');
    });
    await trimPg.reload();
    await trimPg.waitForTimeout(400);
    await trimPg.click('.tab[data-view="macros"]');
    await trimPg.waitForTimeout(400);

    const shutState = await trimPg.evaluate(() => ({
      verdict: !!document.querySelector('.mw-verdict'),
      body: !!document.querySelector('.mw-body'),
      box: !!document.querySelector('#mWeight'),
      cue: !!document.querySelector('.mday-weigh .mslot-name .mfold-cue'),
    }));
    t.ok('a morning with no weight on it claims nothing yet',
      !shutState.verdict && !shutState.body, JSON.stringify(shutState));
    t.ok('but the box to enter one is right there, on the one row it has',
      shutState.box && shutState.cue, JSON.stringify(shutState));

    /* Entering it is what opens the card: you have just handed it the number,
       which is the one moment the evidence is worth the room. */
    await trimPg.fill('#mWeight', '204.6');
    await trimPg.press('#mWeight', 'Enter');
    await trimPg.waitForTimeout(450);
    const savedState = await trimPg.evaluate(() => ({
      verdict: !!document.querySelector('.mw-verdict'),
      body: !!document.querySelector('.mw-body'),
      says: (document.querySelector('.mw-verdict') || {}).textContent || '',
    }));
    t.ok('saving a weight opens the card and it answers',
      savedState.verdict && savedState.body && /175 lb by/.test(savedState.says),
      JSON.stringify(savedState));

    /* And after that the row is the handle, which is the gesture the meal
       cards already teach. */
    await trimPg.click('.mday-weigh .mslot-name');
    await trimPg.waitForTimeout(350);
    t.ok('and after that the row shuts it again',
      await trimPg.evaluate(() => !document.querySelector('.mw-body')));

    /* The dash. Asserted on the ROW COUNT and not merely on the character,
       because the point was the 26 px it took on every empty meal of every
       empty day, not the glyph. */
    /* Restated for the RP-style day (Blake, 2026-10-04): on the day an empty
       meal is its card and nothing under it \u2014 one row with "Nothing yet" on
       its pill, no items box, no dash. Opened, it is the meal's own screen:
       the capsules, the one line saying nothing is on it, and the verbs in
       the foot (Add foods and the camera), still with no dash row. */
    const emptyCard = await trimPg.evaluate(() => {
      const c = [...document.querySelectorAll('#macroSlots .mslot.mday-card')]
        .find((x) => !x.classList.contains('filled'));
      if (!c) return null;
      return {
        sk: (c.querySelector('[data-mfold]') || { dataset: {} }).dataset.mfold,
        dash: !!c.querySelector('.mslot-empty'),
        emDash: /\u2014/.test(c.textContent),
        items: !!c.querySelector('.mslot-items'),
        pill: (c.querySelector('.mcard-pill') || {}).textContent || '',
      };
    });
    t.ok('an empty meal draws no placeholder row',
      !!emptyCard && !emptyCard.dash && !emptyCard.emDash && !emptyCard.items &&
        emptyCard.pill === 'Nothing yet', JSON.stringify(emptyCard));
    if (emptyCard) {
      await trimPg.click('[data-mfold="' + emptyCard.sk + '"][aria-expanded="false"]');
      await trimPg.waitForTimeout(300);
    }
    const emptyOpen = await trimPg.evaluate(() => {
      const c = document.querySelector('#macroSlots .mslot.mscreen');
      if (!c) return null;
      const items = c.querySelector('.mslot-items');
      const foot = c.querySelector('.mscreen-foot');
      return {
        dash: !!c.querySelector('.mslot-empty'),
        emDash: /\u2014/.test((items || {}).textContent || ''),
        kids: items ? [...items.children].map((k) => k.className) : [],
        foot: foot ? [...foot.children].map((k) => k.className) : [],
      };
    });
    t.ok('and holds nothing but its verbs',
      !!emptyOpen && !emptyOpen.dash && !emptyOpen.emDash &&
        emptyOpen.kids.length === 2 && /mcaps/.test(emptyOpen.kids[0]) && /mscreen-empty/.test(emptyOpen.kids[1]) &&
        emptyOpen.foot.length === 2 && /mslot-add/.test(emptyOpen.foot[0]) && /mscreen-cam/.test(emptyOpen.foot[1]),
      JSON.stringify(emptyOpen));
    await trimPg.context().close();

    /* ---- the picker speaks for the meal it is filling ---------------------
     *
     * Blake, on a sheet headed ADD TO SNACKS showing 1745 kcal while Snacks
     * was asking for 87: "the macro pills at the top are for the whole day?
     * why not for the meal I am trying to make?" The function was already
     * called mMealLeft and its first two lines read mDayTargets/mDayEaten. */
    const pk = await t.fresh();
    await pk.evaluate(() => {
      const d = new Date();
      const k = d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) +
        '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: { b: [], l: [], d: [], s: [] } }));
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 180, f: 50, c: 50 }));
    });
    await pk.reload();
    await pk.waitForTimeout(400);
    await pk.click('.tab[data-view="macros"]');
    await pk.waitForTimeout(350);
    /* Snacks opened on its own screen (RP style, 2026-10-04): on a day with
       nothing on it Open all has nothing it counts as shut, so the meal is
       opened the way a thumb does it. */
    await openMeal(pk, 's');
    await pk.click('.mslot-add[data-mslot="s"]');
    await pk.waitForTimeout(450);

    const pkRead = await pk.evaluate(() => {
      const pills = [...document.querySelectorAll('.mp-left .mgp')]
        .map((e) => Number((e.textContent.match(/\d+/g) || [0]).pop()));
      const T = window.__macroLab.targets();
      const tot = window.__macroLab.read().tot;
      return { pills: pills, cap: (document.querySelector('.mp-cap') || {}).textContent || '',
        dayKcal: Math.round(4 * T.p + 4 * T.c + 9 * T.f - tot.kcal),
        dayP: Math.round(T.p - tot.p) };
    });
    t.ok('the sheet names the meal it is filling', /Snacks/i.test(pkRead.cap), pkRead.cap);
    /* The load-bearing one. On an untouched day the DAY's remainder is the
       whole target, and a snack's share is a fraction of it — so a pill still
       reading the day's number is caught here and nowhere else. Asserted as
       "much smaller", not "different", because a scope bug that happened to
       be off by one would still be a scope bug. */
    t.ok('and its pills are the meal\u2019s share, not the whole day\u2019s',
      pkRead.pills[0] > 0 && pkRead.pills[0] < pkRead.dayKcal * 0.6 &&
      pkRead.pills[1] > 0 && pkRead.pills[1] < pkRead.dayP * 0.6,
      JSON.stringify(pkRead));

    /* Sticky: the target and the search box, and NOT the shelves. All three
       is 280 px of a 560 px sheet. */
    const pkStick = await pk.evaluate(() => {
      const st = document.querySelector('.mp-stick');
      if (!st) return { none: true };
      return { pills: !!st.querySelector('.mp-left'), find: !!st.querySelector('#mpFind'),
        shelves: !!st.querySelector('[data-mpshelf]'),
        pos: getComputedStyle(st).position };
    });
    t.ok('the meal\u2019s target and the search box are pinned',
      pkStick.pos === 'sticky' && pkStick.pills && pkStick.find, JSON.stringify(pkStick));
    t.ok('and the shelves are not, because a filter is set once and read past',
      pkStick.shelves === false, JSON.stringify(pkStick));

    /* The basket bar says WHAT, not only how many. */
    await pickerList(pk);
    await pk.waitForTimeout(250);
    const pkName = await pk.evaluate(() => {
      const row = document.querySelector('.mpick-row[data-mpick]');
      const nm = row ? (row.querySelector('.mp-name') || {}).textContent || '' : '';
      if (row) row.click();
      return nm.trim();
    });
    await pk.waitForTimeout(350);
    const pkFoot = await pk.evaluate(() => ({
      names: (document.querySelector('.mp-foot-n') || {}).textContent || '',
      chevOpen: !!document.querySelector('.mp-foot-c.open'),
      done: (document.querySelector('.mp-done') || {}).textContent || '',
    }));
    t.ok('the basket bar names what is in it',
      !!pkName && pkFoot.names.length > 0 &&
      pkFoot.names.slice(0, 12) === pkName.slice(0, 12),
      JSON.stringify({ picked: pkName, bar: pkFoot.names }));
    /* Shut, the chevron points at what it opens — the drawer rises from the
       bar. It used to be a left-pointing ‹ rotated to point DOWN, which is
       why the list behind it went unfound. */
    t.ok('and its chevron points up at the drawer while the drawer is shut',
      pkFoot.chevOpen === false, JSON.stringify(pkFoot));
    await pk.click('.mp-foot-t');
    await pk.waitForTimeout(300);
    t.ok('and turns over once the drawer is open',
      await pk.evaluate(() => !!document.querySelector('.mp-foot-c.open')));
    await pk.context().close();

    /* ---- the plate, contained --------------------------------------------
     *
     * Blake, on the open meal: "it feels off to me. does not flow. why do I
     * feel that way when interacting with it?" Three rows per plate at three
     * different left edges, and the two loudest boxes on the card — the
     * stepper slab and the tick — belonging to the two things he touches
     * least, while the name he reads every time carried no weight.
     *
     * He also ruled out the obvious fix: "I have the skip, add, share,
     * balance, lock, borrow... all those are things I want and use. They just
     * need to be organized better." So nothing was removed. What changed is
     * that a plate is now its own block, which is what says its controls act
     * on IT rather than on the meal or on the day. */
    const platePg = await t.fresh();
    await platePg.evaluate(() => {
      const d = new Date();
      const k = d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) +
        '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
      /* A scored recipe AND a bare food, deliberately: the leaf badge is the
         thing that used to shift one name 28 px right of the other. */
      const rec = (window.RECIPES.find((r) => r.score > 0 && r.macro && r.macro.kcal > 150) || {}).id;
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: 'f:egg', x: 3, eaten: 0 }].concat(rec ? [{ id: rec, x: 1, eaten: 0 }] : []),
        l: [], d: [], s: [] } }));
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 180, f: 50, c: 50 }));
    });
    await platePg.reload();
    await platePg.waitForTimeout(400);
    await platePg.click('.tab[data-view="macros"]');
    await platePg.waitForTimeout(350);
    await openDay(platePg);
    await platePg.waitForTimeout(250);

    /* Restated for the RP-style meal (Blake, 2026-10-04): every food is its
       own card with its amount bar always showing — lock, amount, − and + —
       and its swap, pin and remove behind its ⋯. There is no tick on a food
       any more ("No individual foods ticks... Let's dial in the qty. And I'll
       complete the whole meal"); the meal's tick in its head is the one that
       says eaten. What Blake asked of the old plate still holds where it still
       means something: one left edge for every name, leaf or no leaf, the
       tick says what it does and is told by its fill, and nothing that acts
       on the meal sits inside a food. */
    const plated = await platePg.evaluate(() => {
      const rows = [...document.querySelectorAll('#macroSlots .mscreen .mfood')];
      if (rows.length < 2) return { few: rows.length };
      const shown = (e) => !!e && e.getBoundingClientRect().height > 0;
      const dot = document.querySelector('#macroSlots .mscreen-h [data-mdot="b"]');
      return {
        n: rows.length,
        nameLefts: rows.map((r) => Math.round(r.querySelector('.mitem-name').getBoundingClientRect().left)),
        leaves: rows.map((r) => !!r.querySelector('.leaf-sm .leaf-n')),
        noFoodTick: rows.every((r) => !r.querySelector('input[type="checkbox"], [data-meat], [data-mdot]')),
        mealTick: !!dot && /eaten/i.test(dot.getAttribute('aria-label') || ''),
        mealVerbsOutside: rows.every((r) => !r.querySelector('[data-mbal], [data-mskip], [data-mslot], [data-mtry], [data-mkeep]')),
        bar: rows.every((r) => {
          const amt = r.querySelector('.mfood-amt');
          return shown(amt) && shown(amt.querySelector('[data-mlock]')) && shown(amt.querySelector('.mstep-x')) &&
            shown(amt.querySelector('[data-mstep$=":down"]')) && shown(amt.querySelector('[data-mstep$=":up"]'));
        }),
      };
    });
    t.ok('the plate is seeded with a scored recipe and a bare food',
      plated.n >= 2 && plated.leaves.indexOf(true) >= 0 && plated.leaves.indexOf(false) >= 0,
      JSON.stringify(plated));
    t.ok('every plate’s name starts at the same edge, leaf or no leaf',
      new Set(plated.nameLefts).size === 1, JSON.stringify(plated.nameLefts));
    t.ok('no food carries a tick of its own; the meal’s tick says what it does',
      plated.noFoodTick && plated.mealTick, JSON.stringify(plated));
    t.ok('every food shows its amount bar — lock, amount, − and + — without a tap',
      plated.bar, JSON.stringify(plated));
    t.ok('and no meal verb sits inside a food',
      plated.mealVerbsOutside, JSON.stringify(plated));

    /* Swap, pin and remove are behind the food's own ⋯, and the lock and the
       steps are on its bar — everything that changes this food is on its
       card. (Was: the panel behind the amount, 2026-10-04 meal card.) */
    await platePg.evaluate(() => document.querySelector('#macroSlots [data-mfmenu="b:0"]').click());
    await platePg.waitForTimeout(250);
    const panel = await platePg.evaluate(() => {
      const card = document.querySelector('#macroSlots [data-mfmenu="b:0"]');
      const f = card && card.closest('.mfood');
      const mn = f && f.querySelector('.mfood-menu');
      if (!mn) return null;
      return ['.mfood-amt .mstep', '.mfood-amt [data-mlock="b:0"]', '.mfood-menu [data-mpin="b:0"]',
        '.mfood-menu [data-mdel="b:0"]', '.mfood-menu [data-mswap="b:0"]']
        .filter((sel) => !f.querySelector(sel));
    });
    t.ok('everything that changes this food lives on its card',
      panel && panel.length === 0, JSON.stringify(panel));
    await platePg.evaluate(() => document.querySelector('#macroSlots [data-mfmenu="b:0"]').click());
    await platePg.waitForTimeout(250);

    /* Blake: "might need a shadow of a checkmark on that checkmark box so i
       know it is something i am to check" — and the STATE is told by the
       fill, not by the mark getting darker. The box is the meal's tick now
       (2026-10-04): unticked it still draws its ring, and ticking it fills. */
    const ghost = await platePg.evaluate(() => {
      const sel = '#macroSlots [data-mdot="b"]';
      const read = () => {
        const s = getComputedStyle(document.querySelector(sel), '::before');
        return { ring: s.borderTopColor, fill: s.backgroundColor, pressed: document.querySelector(sel).getAttribute('aria-pressed') };
      };
      const off = read();
      document.querySelector(sel).click();
      return { off: off };
    });
    await platePg.waitForTimeout(300);
    ghost.on = await platePg.evaluate(() => {
      const d = document.querySelector('#macroSlots [data-mdot="b"]');
      const s = getComputedStyle(d, '::before');
      return { ring: s.borderTopColor, fill: s.backgroundColor, pressed: d.getAttribute('aria-pressed') };
    });
    const unseen = (c) => /transparent/.test(c) || /,\s*0\)$/.test(c);
    t.ok('an unticked meal still draws its tick, so the box says what it is for',
      !unseen(ghost.off.ring) && ghost.off.pressed === 'false', JSON.stringify(ghost));
    t.ok('and ticking it is said by the FILL, not by the mark getting darker',
      ghost.on.pressed === 'true' && ghost.off.fill !== ghost.on.fill && !unseen(ghost.on.fill),
      JSON.stringify(ghost));
    await platePg.context().close();

    /* And it does not cost height, which nothing here was checking.
     *
       The rebuild shipped once at 160 px a plate against the 104 it replaced
       — the control row wrapping onto two lines, because a 44px indent left
       290 px for 308 px of dial and targets. The suite was entirely silent:
       every assertion was about structure and none about the one thing a
       six-meal day actually feels. It was caught by measuring the previous
       commit in a worktree, after a mockup built with 26 px controls had me
       claim the opposite in a commit message.

       Asserted as ONE ROW rather than as a pixel budget: the height follows
       from the targets and the padding and will move again, but the control
       strip folding in half is the failure, and it is the same failure at any
       size. Measured on a touch viewport, because the 44 px rule that causes
       it only applies there. */
    const rowFit = await t.fresh({ viewport: { width: 390, height: 900 }, hasTouch: true, isMobile: true });
    await rowFit.evaluate(() => {
      const d = new Date();
      const k = d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) +
        '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
      const rec = (window.RECIPES.find((r) => r.score > 0 && r.macro && r.macro.kcal > 150) || {}).id;
      /* The plate that actually broke it, off Blake's own phone. A food typed
         in from a label carries whatever unit the label used, and this one is
         a sentence: three of them render "3 1 skillet cooked slice (15 g)",
         a 298px dial that left nothing for three 44px targets. The first
         version of this test used "3 whole" and "1 serving" and passed
         happily while his breakfast was folding in half. */
      localStorage.setItem('bsc.myFoods', JSON.stringify({
        bacon_bb: { name: "Butcher's Box Uncured Bacon",
          unit: '1 skillet cooked slice (15 g)', kcal: 71, p: 2, f: 7, c: 0 } }));
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: 'f:egg', x: 3, eaten: 0 }]
          .concat(rec ? [{ id: rec, x: 1, eaten: 0 }] : [])
          .concat([{ id: 'f:my:bacon_bb', x: 3, eaten: 0 }]),
        l: [], d: [], s: [] } }));
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 180, f: 50, c: 50 }));
    });
    await rowFit.reload();
    await rowFit.waitForTimeout(400);
    await rowFit.click('.tab[data-view="macros"]');
    await rowFit.waitForTimeout(350);
    await openDay(rowFit);
    await rowFit.waitForTimeout(250);
    /* One row for the amount bar, even with a label sentence for a unit: the
       amount gives way before the bar folds in half. Restated 2026-10-04 (RP
       style): the food's name and chips have their own lines on its card, so
       the strip that must not fold is the amount bar — lock, amount, −, +. */
    const fit = await rowFit.evaluate(() => {
      const rows = [...document.querySelectorAll('#macroSlots .mfood-amt')];
      if (!rows.length) return { none: true };
      return rows.map((r) => {
        const kids = [...r.querySelectorAll(':scope > *, .mstep > *, .mstep-keys > *')]
          .filter((k) => !k.classList.contains('mstep') && !k.classList.contains('mstep-keys') &&
            getComputedStyle(k).display !== 'none');
        const tops = kids.map((k) => k.getBoundingClientRect());
        const mid = (b) => b.top + b.height / 2;
        const m0 = mid(tops[0]);
        return { h: Math.round(r.getBoundingClientRect().height), n: kids.length,
          oneLine: tops.every((b) => Math.abs(mid(b) - m0) < 14),
          fits: r.scrollWidth <= r.clientWidth + 1 };
      });
    });
    t.ok('a food sits on one line at phone width, a long unit and all',
      !fit.none && fit.length >= 3 && fit.every((r) => r.oneLine && r.fits && r.n >= 4),
      JSON.stringify(fit));
    await rowFit.context().close();

    /* ---- the cascade -----------------------------------------------------
     *
     * A meal that comes in light or heavy changes what every meal after it is
     * asked for. That has always happened, on every render, in silence. These
     * cover the part that is new: saying so, and letting it be czAimed.
     *
     * Seeded by id and by hand throughout. A drafted day would put whatever
     * Fill happened to pick under the assertions, and the one time a test in
     * this file read a drafted day it passed with the bug it was written for
     * put straight back. */
    const casc = await t.fresh();
    const czCascPlan = await casc.evaluate(() => {
      const d = new Date();
      const k = d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) +
        '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: 'f:egg', x: 1, eaten: 0 }], l: [], d: [], s: [] } }));
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 180, f: 50, c: 50 }));
      return k;
    });
    await casc.reload();
    await casc.waitForTimeout(400);
    await casc.click('.tab[data-view="macros"]');
    await casc.waitForTimeout(400);

    const czReadAsk = (pg) => pg.evaluate(() => {
      const out = {};
      document.querySelectorAll('.mslot').forEach((c) => {
        const n = (c.querySelector('.mslot-name') || {}).textContent;
        /* Folded, the ask is on the day card's pills; open (2026-10-04, RP
           style) the head carries no pills and the kcal capsule says it. */
        const t2 = c.querySelector('.mmp.kc[data-want]') || c.querySelector('.mcaps .mcap[data-want]');
        if (n && t2) out[n.trim()] = Number(t2.dataset.want);
      });
      return out;
    });
    const czLine = (pg) => pg.evaluate(() => {
      const el = document.querySelector('.mcasc');
      return el ? { head: el.querySelector('.mcasc-t').textContent,
        sub: el.querySelector('.mcasc-s').textContent,
        shut: el.classList.contains('shut'),
        h: Math.round(el.getBoundingClientRect().height),
        /* Which meals are ticked, by name, so a checkbox list can be
           asserted as a set rather than as a row of button captions. */
        on: [...el.querySelectorAll('.mcasc-row[aria-checked="true"] .mcasc-nm')]
          .map((n) => n.textContent.replace(/at its (floor|ceiling)/, '').trim()),
        czBtns: [...el.querySelectorAll('[data-msend]')].map((b) => b.textContent.trim()) } : null;
    });
    const czTick = async (pg, name) => {
      const rows = await pg.$$('.mcasc .mcasc-row');
      for (const r of rows) {
        if (new RegExp(name).test(await r.textContent())) { await r.click(); break; }
      }
      await pg.waitForTimeout(350);
    };

    /* By SIZE, and the claim has to be about what each meal GAINED.
     *
       This first read "dinner is asked for more than snacks", which is true
       of the plans before anything happens and stays true under an even
       split — it survived the mutation that spread the slack equally, which
       is the whole behaviour it was written to pin. An assertion that cannot
       fail is not evidence.

       So: measure the plans first, with breakfast on the day but NOT eaten,
       then finish it and measure again. The difference is the slack, and
       under an even split those three differences are identical. */
    const czPlans = await czReadAsk(casc);
    await casc.click('.mday-dot[data-mdot="b"]');
    await casc.waitForTimeout(400);
    /* The line lives INSIDE the meal's fold now — Blake's call, because a
       question about a meal should not outlive shutting that meal. So the
       meal has to be open to be read, exactly as it is on his phone when he
       finishes one. */
    await openDay(casc);
    await casc.waitForTimeout(250);
    const czSpread = await czReadAsk(casc);
    const czGain = {
      l: czSpread.Lunch - czPlans.Lunch,
      d: czSpread.Dinner - czPlans.Dinner,
      s: czSpread.Snacks - czPlans.Snacks
    };
    t.ok('the slack lands by size — dinner GAINS more of it than snacks',
      czGain.d > czGain.l + 1 && czGain.l > czGain.s + 1,
      JSON.stringify({ czPlans, czSpread, czGain }));
    /* And by the same proportion, which is the other half of "by size": each
       meal grows by the same fraction of itself, so the day keeps its shape.
       An even split makes a snack half again as big and barely moves dinner. */
    t.ok('and every meal grows by the same proportion of itself',
      Math.abs((czGain.d / czPlans.Dinner) - (czGain.s / czPlans.Snacks)) < 0.04,
      JSON.stringify({ dinner: czGain.d / czPlans.Dinner, snacks: czGain.s / czPlans.Snacks }));

    /* ---- the chooser ---------------------------------------------------
     *
       It was a row of ghost buttons reading "Share with Dinner", each
       toggling when pressed a second time, with "Don't share" at the foot in
       different words for what is plainly this list's None. Blake asked for
       "a list of check boxes — share all or steal all, or select the meals
       that I want to share or steal from", so it is a set now: every box
       ticked is the default, and clearing one takes that meal out. */
    const czAll = await czLine(casc);
    t.ok('every meal left is offered, and starts ticked',
      !!czAll && czAll.on.length === 3 &&
      ['Lunch', 'Dinner', 'Snacks'].every((n) => czAll.on.indexOf(n) >= 0),
      JSON.stringify(czAll));

    /* Aiming it, the way a checkbox list aims: take the others out. Ticking
       ONE meal hands it the lot and leaves the rest on their own plan. */
    await czTick(casc, 'Lunch');
    await czTick(casc, 'Snacks');
    const czAimed = await czReadAsk(casc);
    t.ok('leaving one meal ticked hands it the lot',
      czAimed.Dinner > czSpread.Dinner && czAimed.Lunch < czSpread.Lunch &&
      czAimed.Snacks < czSpread.Snacks, JSON.stringify(czAimed));
    t.ok('and the others go back to exactly their own plan, not to nothing',
      czAimed.Lunch > 0 && czAimed.Snacks > 0, JSON.stringify(czAimed));

    /* A cleared box must not pay. It used to: the tapped meals were walked
       in tap order, each absorbing all it could, and whatever was LEFT was
       handed to the meals you had not tapped — which makes a tick mean
       "first in the queue" rather than "this one". Unticked Lunch and Snacks
       are on their own plan to the pound here, not somewhere between. */
    t.ok('and an unticked meal pays nothing at all',
      Math.abs(czAimed.Lunch - czPlans.Lunch) <= 2 &&
      Math.abs(czAimed.Snacks - czPlans.Snacks) <= 2,
      JSON.stringify({ czAimed, czPlans }));

    /* One checkbox idiom in the app, not one per surface. These rows are
       16px where the plate's tick is 34, and they were drawn by the same
       trick — a mark parked at `transparent` — so they ghost the same way or
       the two surfaces teach different things about what a box means. */
    const czBox = await casc.evaluate(() => {
      const pick = (on) => document.querySelector('.mcasc-row[aria-checked="' + on + '"] .mcasc-box');
      const rd = (e) => e && { mark: getComputedStyle(e).color,
        fill: getComputedStyle(e).backgroundColor };
      return { off: rd(pick('false')), on: rd(pick('true')) };
    });
    t.ok('and a cleared row on the chooser draws its tick too, like the plate does',
      !!czBox.off && !!czBox.on && !/transparent|,\s*0\)$/.test(czBox.off.mark) &&
      czBox.off.fill !== czBox.on.fill, JSON.stringify(czBox));

    /* The line ends on where the DAY lands, not on what the app did. Blake:
       "I kind of want something that will let me know what's going to happen
       now that I've overeaten or under eaten." "Shared with Dinner" is the
       app's own bookkeeping in the app's own vocabulary. */
    const czL2 = await czLine(casc);
    t.ok('and the line says where the day lands, not what it did',
      !!czL2 && /lands on plan|day ends \d+ (over|short)/.test(czL2.sub) &&
      !/Shared with|Borrowed from/.test(czL2.sub), JSON.stringify(czL2));

    /* None: every meal keeps its plan and the day is allowed to end short.
       On a cut that is frequently the one you want — a light breakfast is
       progress, not a debt to spend. */
    await casc.click('.mcasc [data-msend="none"]');
    await casc.waitForTimeout(350);
    const czHeld = await czReadAsk(casc);
    t.ok('and None leaves every meal on its own plan',
      czHeld.Lunch < czSpread.Lunch && czHeld.Dinner < czSpread.Dinner &&
      czHeld.Snacks < czSpread.Snacks, JSON.stringify(czHeld));
    t.ok('and says so, with where the day lands',
      /No meal grows/.test((await czLine(casc)).sub) &&
      /day ends \d+ short|lands on plan/.test((await czLine(casc)).sub),
      JSON.stringify(await czLine(casc)));
    t.ok('and no box is ticked', (await czLine(casc)).on.length === 0,
      JSON.stringify(await czLine(casc)));

    /* All puts it back to the default spread. */
    await casc.click('.mcasc [data-msend="all"]');
    await casc.waitForTimeout(350);
    const czBack = await czReadAsk(casc);
    t.ok('and All puts every meal back on the spread',
      Math.abs(czBack.Dinner - czSpread.Dinner) <= 2 &&
      Math.abs(czBack.Snacks - czSpread.Snacks) <= 2,
      JSON.stringify({ czBack, czSpread }));

    /* The spill, which is the half of the old behaviour a checkbox cannot
       keep.
     *
       Tapped meals used to be walked in tap order, each absorbing all it
       could, and whatever was LEFT was handed to the meals you had NOT
       tapped. With one uncapped meal ticked that is invisible — it absorbs
       the lot and there is nothing to spill — so this ticks the SMALLEST
       meal on its own. Snacks is 5% of the day and cannot grow past twice
       its share, so most of the surplus has nowhere to go, and where it goes
       is the whole question: onto meals whose boxes are clear, or nowhere.
     *
       Nowhere is the answer, and the card says how much. */
    await casc.click('.mcasc [data-msend="none"]');
    await casc.waitForTimeout(350);
    await czTick(casc, 'Snacks');
    const czOne = await czReadAsk(casc);
    const czOneLine = await czLine(casc);
    t.ok('the one ticked meal takes all it can hold',
      czOne.Snacks > czSpread.Snacks + 1, JSON.stringify({ czOne, czSpread }));
    t.ok('and the meals whose boxes are clear stay on their own plan to the pound',
      Math.abs(czOne.Lunch - czPlans.Lunch) <= 2 &&
      Math.abs(czOne.Dinner - czPlans.Dinner) <= 2,
      JSON.stringify({ czOne, czPlans }));
    t.ok('and the card says how far off the day now lands, rather than hiding it',
      /day ends \d+ short/.test(czOneLine.sub) &&
      /at the ceiling/.test(czOneLine.sub), JSON.stringify(czOneLine));

    await casc.click('.mcasc [data-msend="all"]');
    await casc.waitForTimeout(350);

    /* ---- and then it gets out of the way -------------------------------
       Blake: "when it's done how can I collapse that card so it's not so
       prominent?" The day is already right before any of this is read — the
       share lands on render — so once it has been looked at, the apparatus
       for changing it has no business taking a third of the screen. */
    const czOpenH = (await czLine(casc)).h;
    await casc.click('.mcasc [data-msend="ack"]');
    await casc.waitForTimeout(350);
    const czShut = await czLine(casc);
    t.ok('Done folds it to one line, and a much shorter card',
      !!czShut && czShut.shut && czShut.h < czOpenH / 2 && czShut.on.length === 0,
      JSON.stringify({ open: czOpenH, shut: czShut && czShut.h }));
    t.ok('and the folded line still says what happened and where it lands',
      /went \d+ (over|under) its share/.test(czShut.head) &&
      /lands on plan|day ends \d+ (over|short)/.test(czShut.sub),
      JSON.stringify(czShut));

    /* Stored, not held in a class. Blake dismissed the pace card and it was
       back a tap later, because its state was a CSS class and every redraw
       wiped it; `ack` rides in bsc.macroSend beside the choice itself. The
       reload is the honest test — anything that redraws from scratch brought
       the old one back. */
    await casc.reload();
    await casc.waitForTimeout(500);
    await casc.click('.tab[data-view="macros"]');
    await casc.waitForTimeout(400);
    await openDay(casc);
    await casc.waitForTimeout(250);
    t.ok('and it is still folded after everything redraws',
      !!(await czLine(casc)) && (await czLine(casc)).shut,
      JSON.stringify(await czLine(casc)));

    await casc.click('.mcasc [data-msend="open"]');
    await casc.waitForTimeout(350);
    const czReopen = await czLine(casc);
    t.ok('and the line reopens on the same three choices',
      !!czReopen && !czReopen.shut && czReopen.on.length === 3,
      JSON.stringify(czReopen));

    /* Shutting the meal takes the line with it.
     *
       It used to sit OUTSIDE the card so that a folded meal could still say
       what its miss did. Blake, off his own day: "the overage tag is still
       seen even after I closed the meal tag... as soon as I select that share
       or steal, I'd expect the macro pills to update and then when I close
       the card it's not seen any more." Shutting a meal is how you say you
       are done with it. The pills keep the answer, and they are on the header,
       which a shut card keeps. */
    await casc.click('#macroSlots [data-mfold="b"]');
    await casc.waitForTimeout(350);
    t.ok('shutting the meal takes its line with it',
      await casc.evaluate(() => !document.querySelector('.mcasc')));
    t.ok('and the pills on the shut header still carry the answer',
      await casc.evaluate(() => {
        const c = [...document.querySelectorAll('.mslot')].filter((x) =>
          /Dinner/.test((x.querySelector('.mslot-name') || {}).textContent || ''))[0];
        /* Dinner is still open from Open all, and an open meal's head
           carries no pills since 2026-10-04 (RP style) — its kcal capsule
           holds the same ask. */
        const t2 = c && (c.querySelector('.mmp.kc[data-want]') || c.querySelector('.mcaps .mcap[data-want]'));
        return !!t2 && Number(t2.dataset.want) > 0;
      }));
    await openDay(casc);
    await casc.waitForTimeout(250);

    /* It survives a reload, because the choice is a fact about the day and
       not a thing this render happened to be holding.
     *
       Self-contained on purpose: it used to compare against whatever state
       the tests above happened to leave behind, so re-ordering them broke an
       assertion that was not about ordering. It makes its own distinctive
       choice, reads the numbers, and reloads. */
    await czTick(casc, 'Snacks');                 // take one meal out of the set
    const czPinned = await czReadAsk(casc);
    await casc.reload();
    await casc.waitForTimeout(500);
    await casc.click('.tab[data-view="macros"]');
    await casc.waitForTimeout(350);
    t.ok('and the choice is still there after a reload',
      JSON.stringify(await czReadAsk(casc)) === JSON.stringify(czPinned),
      JSON.stringify({ now: await czReadAsk(casc), was: czPinned }));
    await casc.context().close();

    /* ---- the figures live inside the bar -------------------------------
     *
       Blake's layout: "Pills for the bar charts with text in the pill. And
       full color as the bar." The bar was a stripe under a caption, so the
       fill got whatever width the numbers beside it did not want.
     *
       The words are drawn TWICE — ink over the unfilled part, paper over the
       filled part, the paper copy clipped at exactly the eaten edge. That is
       the only arrangement in which a figure sitting on a partial fill is
       legible at both ends, and it is worth a guard because it broke twice
       while I was building it: both times a rule further down the stylesheet
       outranked the paper copy's own colour and painted the number out. The
       fat bar read "F  / 61 g" with the 106 missing. */
    const pil = await t.fresh();
    await pil.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n; const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 204, f: 61, c: 72 }));
      localStorage.setItem('bsc.macroSlots', JSON.stringify({ list: [
        { k: 'a', n: 'Breakfast', t: 'b', w: 30 }, { k: 'l', n: 'Lunch', t: 'l', w: 35 },
        { k: 'd', n: 'Dinner', t: 'd', w: 35 }] }));
      /* Eight tablespoons of butter EATEN puts fat far past its target and a
         full pill on screen; an uneaten plate gives the planned band; an
         empty meal gives the assumed hatching. All three in one render. */
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        a: [{ id: 'f:butter', x: 8, eaten: 1 }], l: [{ id: 'f:egg', x: 3 }], d: [] } }));
    });
    await pil.reload();
    await pil.waitForTimeout(450);
    await pil.click('.tab[data-view="macros"]');
    await pil.waitForTimeout(450);
    /* Resolved through the page, so the comparison is between two colours
       and not between two spellings of one. */
    const pilToken = (name) => pil.evaluate((v) => {
      const el = document.createElement('span');
      el.style.color = 'var(' + v + ')';
      document.body.appendChild(el);
      const c = getComputedStyle(el).color;
      el.remove();
      return c;
    }, name);
    const pilPaper = await pilToken('--paper');
    /* what is written on an ochre fill: see the "under" rule beside .mb-on */
    const pilOnOchre = await pilToken('--on-ochre');
    const pilRead = await pil.evaluate((paper) => {
      const out = {};
      document.querySelectorAll('[data-macro]').forEach((el) => {
        const track = el.querySelector('.mb-track');
        const ink = el.querySelector('.mb-w:not(.mb-on)');
        const pap = el.querySelector('.mb-w.mb-on');
        const col = (n, sel) => n && n.querySelector(sel)
          ? getComputedStyle(n.querySelector(sel)).color : '';
        out[el.dataset.macro] = {
          state: el.dataset.state,
          fill: parseFloat(track ? track.style.getPropertyValue('--f') : 'NaN'),
          /* both layers, and the words in each */
          inkWords: ink ? ink.textContent.replace(/\s+/g, ' ').trim() : null,
          papWords: pap ? pap.textContent.replace(/\s+/g, ' ').trim() : null,
          /* the paper copy is paper, figure and all */
          papFig: col(pap, '.mb-num b'), papUnit: col(pap, '.mb-num'),
          /* and how well it reads on the fill it is clipped to */
          papCr: (function () {
            const ate = el.querySelector('.mb-ate');
            const fig = pap && pap.querySelector('.mb-num b');
            if (!ate || !fig) return 0;
            // any CSS colour, oklch included, to sRGB bytes, by painting it
            const lum = (c) => {
              const cv = document.createElement('canvas'); cv.width = cv.height = 1;
              const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 1, 1);
              const v = [].slice.call(x.getImageData(0, 0, 1, 1).data, 0, 3).map((u) => {
                u /= 255; return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
              });
              return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
            };
            const a = lum(getComputedStyle(fig).color), b = lum(getComputedStyle(ate).backgroundColor);
            return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          })(),
          /* the ink copy is not */
          inkFig: col(ink, '.mb-num b'),
          /* the clip follows the EATEN edge, not the end of the whole fill */
          clip: pap ? getComputedStyle(pap).clipPath : '',
          /* eaten and planned survive; the hatched assumption does not */
          bands: ['mb-ate', 'mb-plan']
            .filter((c) => !!el.querySelector('.' + c)).length,
          hatch: !!el.querySelector('.mb-asm'),
          /* nothing spills out of the pill */
          spills: ink && track
            ? ink.getBoundingClientRect().right > track.getBoundingClientRect().right + 1 : null,
          h: Math.round((track || el).getBoundingClientRect().height)
        };
      });
      return out;
    }, pilPaper);
    /* Calories are a ring now (Blake, 2026-09-27, mockup A); the pills are
       the three macros, stacked beside it. */
    const pilAll = ['p', 'f', 'c'].map((m) => pilRead[m]);

    t.ok('the three macro bars are pills with the figures inside them, twice over',
      pilAll.length === 3 && pilAll.every((b) => b.inkWords && b.papWords &&
        b.inkWords === b.papWords && /\d/.test(b.inkWords)),
      JSON.stringify(pilAll.map((b) => b.inkWords)));

    /* The one that kept breaking. A full pill is solid colour end to end, so
       its paper copy is the only legible one — and if any rule repaints that
       figure, the figure is gone.
     *
       Paper, except over the ochre of a pill still under its target, where
       paper was 3.4:1 and the copy takes the ink the lit tab takes on the
       same colour (--on-ochre). Either way the figure and its unit wear the
       one colour meant for that fill, and it reads on the fill at 4.5:1 or
       better — which is what "legible" was always standing in for. */
    const pilOver = (b) => (b.state === 'under' ? pilOnOchre : pilPaper);
    t.ok('the paper copy is paper THROUGHOUT, figure included (ink on ochre), and reads on its fill',
      pilAll.every((b) => b.papFig === pilOver(b) && b.papUnit === pilOver(b) && b.papCr >= 4.5),
      JSON.stringify(pilAll.map((b) => b.state + ' fig:' + b.papFig + ' ' + b.papCr.toFixed(2) + ':1')));
    t.ok('and the ink copy is not paper, or the unfilled end would be blank',
      pilAll.every((b) => b.inkFig && b.inkFig !== pilPaper),
      JSON.stringify(pilAll.map((b) => b.inkFig)));

    /* A bar filled to its end and one filled to nothing, in the same render:
       whichever way round it is, one of the two copies is doing the reading. */
    t.ok('the day under test has both a full pill and an almost empty one',
      pilAll.some((b) => b.fill >= 99) && pilAll.some((b) => b.fill <= 5),
      JSON.stringify(pilAll.map((b) => b.state + ':' + b.fill + '%')));

    t.ok('the paper copy is clipped to the fill rather than painted over it',
      pilAll.every((b) => /inset\(/.test(b.clip)), JSON.stringify(pilAll.map((b) => b.clip)));

    /* Eaten and planned are two different claims — food, and intention —
       and both are things you have put on the day yourself. A flat
       single-colour pill would have thrown that away to gain nothing. */
    t.ok('eaten and planned are still separate bands',
      pilAll.every((b) => b.bands === 2), JSON.stringify(pilAll.map((b) => b.bands)));

    /* The third band was the hatching, and it is gone. It drew what an EMPTY
       meal is assumed to become, which on a morning covered most of four
       bars and was the one band with nothing on it to act on. The assumption
       has not gone — it is still in the delta the top pills print — only the
       hatching has. */
    t.ok('and an empty meal no longer hatches itself across the bar',
      pilAll.every((b) => b.hatch === false),
      JSON.stringify(pilAll.map((b) => b.state + ':' + b.hatch)));

    t.ok('nothing spills out of a pill, and the calorie ring is the tallest thing beside them',
      pilAll.every((b) => b.spills === false) &&
      pilRead.kcal.h > pilRead.p.h && pilRead.p.h === pilRead.c.h,
      JSON.stringify(['p', 'f', 'c', 'kcal'].map((m) => m + ':' + pilRead[m].h)));
    t.ok('and the ring keeps the pill\u2019s two bands, eaten and planned',
      pilRead.kcal.bands === 2 && pilRead.kcal.hatch === false, JSON.stringify(pilRead.kcal));
    await pil.context().close();

    /* ---- how far off, not merely which side ----------------------------
     *
       Blake, on his own week: "Right now I'm just seeing a lot of red and
       even though I'm close on some days I'm over so it's red." The square
       carried a verdict and nothing else, so a day 3% past its target drew
       the same red as a day 43% past it.
     *
       Widening the threshold does not fix that. Wherever the line is put,
       the day one calorie past it looks exactly like the day four hundred
       past it — moving a threshold moves the cliff. So the square carries a
       rail with the target marked on it, at the same place on all seven, and
       the verdict colour stays exactly as it was. */
    const spk = await t.fresh();
    const spkR = [1.05, 1.45, 0.75, 0.60];
    await spk.evaluate((ratios) => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const key = (o) => { const d = new Date(); d.setDate(d.getDate() + o);
        return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
      /* LAST week, Monday first, and every one of its days already past.
       *
         The strip draws the Monday-to-Sunday week the viewed day sits in, and
         this used to seed "the last four days" — which lands four cells in
         that week on most days and ONE of them on a Monday, when today is
         the first cell and the other six have not happened. Four tests
         therefore passed six days in seven, and went red on the seventh for
         a reason that had nothing to do with the code. Seeded against last
         week's Monday there is no such day. */
      const back = ((new Date().getDay() + 6) % 7) + 7;
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 204, f: 61, c: 72 }));
      localStorage.setItem('bsc.macroSlots', JSON.stringify({ list: [
        { k: 'a', n: 'Breakfast', t: 'b', w: 30 }, { k: 'l', n: 'Lunch', t: 'l', w: 35 },
        { k: 'd', n: 'Dinner', t: 'd', w: 35 }] }));
      /* Butter, because one food at a chosen multiple lands a day on an
         exact fraction of its target and nothing here is about the food. */
      const days = {};
      ratios.forEach((r, i) => {
        days[key(i - back)] = {
          a: [{ id: 'f:butter', x: 4 * 4.134 * r, eaten: 1 }], l: [], d: [] };
      });
      localStorage.setItem('bsc.macroDays', JSON.stringify(days));
    }, spkR);
    await spk.reload();
    await spk.waitForTimeout(450);
    await spk.click('.tab[data-view="macros"]');
    await spk.waitForTimeout(450);
    // and look at that week, so the strip is drawing the days just seeded
    await spk.selectOption('#macroDaySel', await spk.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date(); d.setDate(d.getDate() - (((new Date().getDay() + 6) % 7) + 7));
      return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
    }));
    await spk.waitForTimeout(350);
    /* Heights now, not widths: the rail became a bar standing in a chart
       cell, with the target a hairline across the week. Everything below
       is measured up from the track's foot. */
    const spkRead = await spk.evaluate(() => [...document.querySelectorAll('.mwk-d')].map((d) => {
      const fill = d.querySelector('.mwk-b i'), rail = d.querySelector('.mwk-b');
      const mark = d.querySelector('.mwk-g');
      const lab = d.getAttribute('aria-label') || '';
      const ate = Number((lab.match(/, (\d+) (?:eaten|on the day)/) || [])[1] || 0);
      const tgt = Number((lab.match(/(\d+) calorie target/) || [])[1] || 0);
      return { pct: tgt ? ate / tgt : 0,
        verdict: (d.className.match(/\b(under|on|over)\b/) || [''])[0],
        /* Measured in pixels, because a percentage is what the code wrote and
           pixels are what an eye is given. */
        px: fill ? fill.getBoundingClientRect().height : null,
        railPx: rail ? rail.getBoundingClientRect().height : null,
        markPx: (mark && rail)
          ? rail.getBoundingClientRect().bottom - mark.getBoundingClientRect().bottom : null };
    }));
    const spkFed = spkRead.filter((d) => d.pct > 0);
    t.ok('every day with food on it carries a rail, and the empty ones do not',
      spkFed.length === 4 && spkFed.every((d) => d.px !== null) &&
      spkRead.filter((d) => !d.pct).every((d) => d.px === null),
      JSON.stringify(spkRead.map((d) => Math.round(d.pct * 100) + '%:' +
        (d.px === null ? 'none' : Math.round(d.px)))));

    /* The whole point: two days that are both "over" are told apart. */
    const spkNear = spkFed.filter((d) => d.pct > 1.02 && d.pct < 1.12)[0];
    const spkFar = spkFed.filter((d) => d.pct > 1.3)[0];
    t.ok('two days that are both over read as different distances',
      !!spkNear && !!spkFar && spkNear.verdict === 'over' && spkFar.verdict === 'over' &&
      spkFar.px - spkNear.px >= 6,
      JSON.stringify({ near: spkNear && Math.round(spkNear.px),
        far: spkFar && Math.round(spkFar.px), rail: spkFed[0].railPx }));

    /* The mark is where the target is, and that is the whole legend: the
       fill has either passed the notch or it has not.
     *
       Asserted as a RELATIONSHIP rather than by seeding a day at exactly
       100% of target. The first version fed a chosen multiple of one food
       and demanded the fill land on the mark — the multiple drifted 4%, the
       "on target" day arrived at 104%, and the assertion failed for
       arithmetic reasons with nothing to do with the rail. What a reader
       uses is the side, not the pixel. */
    t.ok('a day under its target stops short of the mark, and one over passes it',
      spkFed.length === 4 &&
      spkFed.filter((d) => d.pct < 0.98).every((d) => d.px < d.markPx - 1) &&
      /* And a day only a whisker over is not evidence either way. The fill
         is 0.66 of the track per unit of target and the mark sits at 0.66 of
         it, so at 109% the two are a pixel apart — inside the rendering's
         own noise, and inside the 4% the butter multiple drifts by. Same
         reasoning as the sentence above, pointed at the other end: what a
         reader uses is the side, and a day this close has no side. */
      spkFed.filter((d) => d.pct > 1.15).every((d) => d.px > d.markPx + 1),
      JSON.stringify(spkFed.map((d) => Math.round(d.pct * 100) + '%: fill ' +
        Math.round(d.px) + ' vs mark ' + Math.round(d.markPx))));

    /* The mark is in the same place on all seven, so the week reads across as
       well as down — seven rails each scaled to their own day would be seven
       charts, not one. */
    t.ok('and the target line sits at the same height on every bar',
      spkFed.every((d) => Math.abs(d.markPx - spkFed[0].markPx) <= 1),
      JSON.stringify(spkFed.map((d) => Math.round(d.markPx))));

    /* And the verdict colour is untouched: this adds distance, it does not
       replace the thing that was already working. */
    t.ok('the verdict colours are still there underneath',
      spkFed.every((d) => !!d.verdict) &&
      spkFed.filter((d) => d.verdict === 'over').length >= 2 &&
      spkFed.filter((d) => d.verdict === 'under').length >= 1,
      JSON.stringify(spkFed.map((d) => Math.round(d.pct * 100) + '%:' + d.verdict)));
    await spk.context().close();

    /* ---- skipping a meal ------------------------------------------------
     *
       Blake: "with skip, should I also be able to tell it where to send the
       macros and calories?" He could not, and not because the chooser
       refused him: it renders inside .mslot-items and the skipped-meal
       branch returns before that exists, so it was unreachable. The row just
       announced the handout as done — "its share went to the rest".
     *
       Its own page, because a skip is the largest cascade the day makes: a
       whole meal's share, handed out at once. */
    const skp = await t.fresh();
    await skp.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n; const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 204, f: 61, c: 72 }));
      localStorage.setItem('bsc.macroSlots', JSON.stringify({ list: [
        { k: 'a', n: 'Wake Up', t: 's', w: 15 }, { k: 'b', n: 'Breakfast', t: 'b', w: 25 },
        { k: 'c', n: 'Snacks', t: 's', w: 5 }, { k: 'l', n: 'Lunch', t: 'l', w: 20 },
        { k: 'd', n: 'Dinner', t: 'd', w: 30 }, { k: 'f', n: 'Evening Snack', t: 's', w: 5 }] }));
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        a: [{ id: 'f:egg', x: 2, eaten: 1 }], b: [{ id: 'f:egg', x: 3, eaten: 1 }],
        c: [], l: [], d: [], f: [] } }));
    });
    await skp.reload();
    await skp.waitForTimeout(450);
    await skp.click('.tab[data-view="macros"]');
    await skp.waitForTimeout(400);
    const skAsk = (pg) => pg.evaluate(() => {
      const o = {};
      document.querySelectorAll('.mslot').forEach((c) => {
        const n = (c.querySelector('.mslot-name') || {}).textContent;
        const t2 = c.querySelector('.mmp.kc[data-want]') || c.querySelector('.mcaps .mcap[data-want]');
        if (n && t2) o[n.trim()] = Number(t2.dataset.want);
      });
      return o;
    });
    const skCard = (pg) => pg.evaluate(() => {
      const el = document.querySelector('.mcasc');
      if (!el) return null;
      return { inSkip: !!el.closest('.mslot-skipped'),
        shut: el.classList.contains('shut'),
        h: Math.round(el.getBoundingClientRect().height),
        head: (el.querySelector('.mcasc-t') || {}).textContent,
        said: (el.querySelector('.mcasc-s') || {}).textContent,
        on: [...el.querySelectorAll('.mcasc-row[aria-checked="true"] .mcasc-nm')]
          .map((n) => n.textContent.replace(/at its (floor|ceiling)/, '').trim()),
        /* Each row's own share and what it is asked for, so an assertion can
           say "back to its share" rather than guessing a figure. */
        rows: [...el.querySelectorAll('.mcasc-row')].map((r) => ({
          n: (r.querySelector('.mcasc-nm') || {}).textContent
            .replace(/at its (floor|ceiling)/, '').trim(),
          was: Number(((r.querySelector('.mcasc-was') || {}).textContent || '')
            .split('\u2192')[0].trim()),
          on: r.getAttribute('aria-checked') === 'true' })) };
    });
    const skBefore = await skAsk(skp);
    /* Skip is in the open meal's ⋯ menu since the RP-style meal screen
       (Blake, 2026-10-04): Lunch is opened, its menu pressed, then Skip. */
    await openMeal(skp, 'l');
    await skp.click('#macroSlots [data-mmenu="l"]');
    await skp.waitForTimeout(300);
    await skp.click('#macroSlots [data-mskip="l"]');
    await skp.waitForTimeout(500);
    const skAfter = await skAsk(skp);
    const skOpen = await skCard(skp);

    t.ok('skipping a meal offers the same chooser, on the skipped row itself',
      !!skOpen && skOpen.inSkip && !skOpen.shut && skOpen.on.length === 3,
      JSON.stringify(skOpen));
    t.ok('and it names the meal and what skipping it frees',
      !!skOpen && /Skipping Lunch frees \d+/.test(skOpen.head), JSON.stringify(skOpen));

    /* You cannot send freed calories backwards in time. A skipped meal's
       weight comes out of the denominator so its food goes to the meals
       still AHEAD of you — which used to raise the target on meals already
       eaten and closed: Wake Up went 248 to 310 hours after it was finished,
       and its bar then read 62 short of something the day never asked it
       for. Nothing moved; the figure beside it was a false claim about the
       past. */
    t.ok('and a meal already eaten keeps the target the day actually asked it for',
      skAfter['Wake Up'] === skBefore['Wake Up'] &&
      skAfter.Breakfast === skBefore.Breakfast,
      JSON.stringify({ before: skBefore, after: skAfter }));
    t.ok('while the meals still ahead of you take the freed share',
      skAfter.Dinner > skBefore.Dinner + 1 && skAfter.Snacks > skBefore.Snacks + 1,
      JSON.stringify({ before: skBefore, after: skAfter }));

    /* And it can be steered, which is the whole ask. Take Dinner out and it
       goes back to its own plan while the two small meals hit their ceiling
       — a meal never grows past twice its share — so most of a whole meal's
       worth has nowhere to go, and the card says how much. */
    const skRows = await skp.$$('.mcasc .mcasc-row');
    for (const r of skRows) {
      if (/Dinner/.test(await r.textContent())) { await r.click(); break; }
    }
    await skp.waitForTimeout(450);
    const skAimed = await skAsk(skp);
    const skLine = await skCard(skp);
    /* Back to its own share — and its own share, for a meal still ahead of
       you on a day with a skip in it, already counts the skipped meal's
       weight. That is upstream of this card, in mMealShare, and it is there
       for a reason the file records: Fill sizes a plate to the post-skip
       share, so a share that still divided by the skipped meal called that
       plate "over". mAssumed copies the same rule.
     *
       So the checkbox governs the CASCADE — the part mPlaceLeft hands out,
       357 of Dinner's 480 here — and not the denominator. Asserted against
       the row's own `was` rather than against the pre-skip ask, because the
       row is telling the truth about what it covers and the test should pin
       that truth rather than a tidier one. */
    const skDin = skLine.rows.filter((r) => r.n === 'Dinner')[0];
    t.ok('unticking a meal puts it back on the share its own row states',
      !!skDin && !skDin.on && Math.abs(skAimed.Dinner - skDin.was) <= 2 &&
      skAimed.Dinner < skAfter.Dinner - 100 &&
      skAimed.Snacks > skAfter.Snacks + 1,
      JSON.stringify({ skAimed, skAfter, row: skDin }));
    t.ok('and the card says how much of the freed meal has nowhere to go',
      /day ends \d+ short/.test(skLine.said) && /at the ceiling/.test(skLine.said),
      JSON.stringify(skLine));

    /* Then it folds, and the skipped row is a line again. */
    const skH = skLine.h;
    await skp.click('.mcasc [data-msend="ack"]');
    await skp.waitForTimeout(450);
    const skShut = await skCard(skp);
    t.ok('Done folds it back into the skipped row',
      !!skShut && skShut.inSkip && skShut.shut && skShut.h < skH / 2,
      JSON.stringify({ open: skH, shut: skShut && skShut.h }));
    t.ok('and the row stops claiming the share simply went to the rest',
      await skp.evaluate(() => {
        const w = document.querySelector('.mslot-skipped .mslot-skip-w');
        return !!w && !/went to the rest/.test(w.textContent);
      }),
      await skp.evaluate(() => (document.querySelector('.mslot-skipped .mslot-skip-w') || {}).textContent));

    await skp.context().close();

    /* ---- the question survives ARRIVING at the day ----------------------
     *
       On a meal WITH FOOD, which is where the fold is: a skipped meal's card
       sits on its own row and was never at risk, and writing this against
       one is how the first version of this guard passed while the bug stood.
     *
       The card lives inside the meal's fold, which is Blake's call and the
       right one — a question about a meal should not outlive shutting that
       meal. But arriving at the day is not shutting it. Everything with food
       on it folds on arrival, the finished meal carrying the card has food
       on it, and so the card was folded away before it had ever been read:
       every reload, every tab switch, every return to My Day. Blake's own
       screenshot, a lunch 750 over its share, no card anywhere.
     *
       This arrives the way a thumb arrives — reload, press the tab — and
       calls no helper to open anything. The cascade block above opens the
       meal by hand and would pass with the card unreachable, which is how it
       stayed unreachable through two redesigns of the thing. */
    const arv = await t.fresh();
    await arv.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n; const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 204, f: 61, c: 72 }));
      localStorage.setItem('bsc.macroSlots', JSON.stringify({ list: [
        { k: 'b', n: 'Breakfast', t: 'b', w: 25 }, { k: 'l', n: 'Lunch', t: 'l', w: 35 },
        { k: 'd', n: 'Dinner', t: 'd', w: 40 }] }));
      // a breakfast of eight tablespoons of butter, eaten: far over its share
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: 'f:butter', x: 8, eaten: 1 }], l: [{ id: 'f:egg', x: 1 }], d: [] } }));
    });
    const arrive = async () => {
      await arv.reload();
      await arv.waitForTimeout(500);
      await arv.click('.tab[data-view="macros"]');
      await arv.waitForTimeout(450);
      return arv.evaluate(() => {
        const el = document.querySelector('.mcasc');
        const bk = [...document.querySelectorAll('.mslot')].filter((x) =>
          /breakfast/i.test((x.querySelector('.mslot-name') || {}).textContent || ''))[0];
        return { card: el ? (el.querySelector('.mcasc-t') || {}).textContent : null,
          open: !!(bk && bk.querySelector('.mslot-items')) };
      });
    };
    const arv1 = await arrive();
    t.ok('the meal holding an unanswered question is open the moment you arrive',
      !!arv1.card && arv1.open && /went \d+ over its share/.test(arv1.card),
      JSON.stringify(arv1));

    /* ...and once answered it stops holding the meal open, which is what
       answering it was for. The pills keep the result. */
    await arv.click('.mcasc [data-msend="ack"]');
    await arv.waitForTimeout(400);
    const arv2 = await arrive();
    t.ok('and once answered it folds away like any other finished meal',
      !arv2.card && !arv2.open, JSON.stringify(arv2));
    await arv.context().close();

    /* ---- a skipped meal with nothing to hand out is still a ROW ---------
     *
       Only the LAST finished meal carries a cascade, so most skipped meals
       have no card — and that is the branch I broke. The row and the card
       were one element; when the card moved in, the flex layout stayed on
       the outer box and the row became a bare block, so it only laid itself
       out when a card happened to be there to pull it into shape. Blake's
       phone read "Snacksskipped" with the Undo shoved against the words. */
    const skb = await t.fresh();
    await skb.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n; const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 204, f: 61, c: 72 }));
      localStorage.setItem('bsc.macroSlots', JSON.stringify({ list: [
        { k: 'b', n: 'Breakfast', t: 'b', w: 30 }, { k: 'l', n: 'Lunch', t: 'l', w: 30 },
        { k: 'f', n: 'Evening Snack', t: 's', w: 40 }] }));
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: { b: [], l: [], f: [] } }));
      // the LAST meal, so there is nothing after it and no cascade to carry
      localStorage.setItem('bsc.macroSkip', JSON.stringify({ [k]: ['f'] }));
    });
    await skb.reload();
    await skb.waitForTimeout(450);
    await skb.click('.tab[data-view="macros"]');
    await skb.waitForTimeout(400);
    const skbRow = await skb.evaluate(() => {
      const el = document.querySelector('.mslot-skipped');
      if (!el) return null;
      const h = el.querySelector('.mslot-skip-h');
      const n = el.querySelector('.mslot-skip-n'), w = el.querySelector('.mslot-skip-w');
      const u = el.querySelector('.mslot-unskip');
      return { card: !!el.querySelector('.mcasc'),
        row: !!h && getComputedStyle(h).display === 'flex',
        gap: Math.round(w.getBoundingClientRect().left - n.getBoundingClientRect().right),
        undoInside: u.getBoundingClientRect().right <= el.getBoundingClientRect().right + 1,
        onOneLine: Math.abs(n.getBoundingClientRect().top - u.getBoundingClientRect().top) < 30 };
    });
    t.ok('a skipped meal with no cascade to show is still laid out as a row',
      !!skbRow && !skbRow.card && skbRow.row && skbRow.gap >= 6 &&
      skbRow.undoInside && skbRow.onOneLine, JSON.stringify(skbRow));
    await skb.context().close();

    /* ---- pills the same size, always --------------------------------------
     *
     * Blake: "Can I get uniform pills on the meal cards, always the same
     * size?" They were shrink-to-fit, so 🔥600/98 wore a narrower box than
     * 🔥1104/586 and the four boxes landed somewhere different on every card.
     *
     * Run on a deliberately HEAVY day, and that is the whole point of it. The
     * first version of this ran on the ordinary day above and passed with a
     * spread of zero while the live app was 16.4 px apart: the numbers were
     * small enough to sit inside the floor, so the floor was all it ever
     * measured. What broke it was `.mmp-was` — the little "this is what the
     * meal used to be asked for" figure — sitting INLINE inside the pill, so
     * a pill whose target had moved was 75.4 px against an unmoved 59. The
     * numbers that say "the day moved under you" were the ones breaking the
     * alignment they were drawn on.
     *
     * So: four-digit calories, three-digit protein, and a share just moved,
     * which is the hardest day the app can be asked to keep uniform. */
    const pzWideDay = await t.fresh();
    await pzWideDay.evaluate(() => {
      const d = new Date();
      const k = d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) +
        '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: 'f:egg', x: 28, eaten: 1 }], l: [{ id: 'f:egg', x: 30, eaten: 0 }],
        d: [{ id: 'f:egg', x: 34, eaten: 0 }], s: [{ id: 'f:egg', x: 26, eaten: 0 }] } }));
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 300, f: 120, c: 400 }));
    });
    await pzWideDay.reload();
    await pzWideDay.waitForTimeout(400);
    await pzWideDay.click('.tab[data-view="macros"]');
    await pzWideDay.waitForTimeout(400);
    /* The pills are on the day cards since the RP-style day (Blake,
       2026-10-04) — an open meal wears capsules instead — so every meal is
       shut here, including the one arrival leaves open to ask where its
       overflow goes. */
    for (let i = 0; i < 6; i++) {
      const b = await pzWideDay.$('#macroSlots [data-mfold][aria-expanded="true"]');
      if (!b) break;
      await b.click();
      await pzWideDay.waitForTimeout(250);
    }
    const pzWide = await pzWideDay.evaluate(() => {
      const kc = [], mac = [];
      document.querySelectorAll('.mslot .mmp').forEach((e) => {
        const w = Math.round(e.getBoundingClientRect().width * 10) / 10;
        (e.classList.contains('kc') ? kc : mac).push({ w: w, t: e.textContent.trim() });
      });
      const ends = (a) => a.slice().sort((x, y) => x.w - y.w);
      const sp = (a) => a.length ? ends(a)[a.length - 1].w - ends(a)[0].w : 0;
      return { kc: kc.length, mac: mac.length, kcSpread: sp(kc), macSpread: sp(mac),
        widestKc: ends(kc)[kc.length - 1], widestMac: ends(mac)[mac.length - 1] };
    });
    /* Said out loud: a green that came from an easy day is what let the real
       one through, so the day has to be hard before the widths mean anything.
       Hard means FOUR DIGITS — numbers big enough that a pill would overflow
       its floor if the floor were the only thing holding it. (This used to
       check that a was-number was rendered; those are gone, and the digits
       were always the better proxy anyway.) */
    t.ok('the widths are measured on a day whose numbers are big enough to matter',
      pzWide.kc >= 4 && /\d{4}/.test(pzWide.widestKc.t), JSON.stringify(pzWide));
    t.ok('every calorie pill in the day is exactly as wide as every other',
      pzWide.kcSpread === 0, JSON.stringify(pzWide));
    t.ok('and so is every macro pill', pzWide.macSpread === 0, JSON.stringify(pzWide));
    await pzWideDay.context().close();

    /* ---- the cap ---------------------------------------------------------
     * Only snacks left and a large surplus: without a ceiling the card asks
     * for a six-hundred-calorie snack. The rule came out of Blake's own word
     * for it — you cannot borrow from a meal that has nothing to lend, and
     * you cannot hand a snack a dinner. */
    const czCapPg = await t.fresh();
    await czCapPg.evaluate(() => {
      const d = new Date();
      const k = d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) +
        '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
      /* Breakfast, lunch and dinner all finished and all tiny, so almost the
         whole day is still unspent with only snacks to put it in. */
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: 'f:egg', x: 1, eaten: 1 }],
        l: [{ id: 'f:egg', x: 1, eaten: 1 }],
        d: [{ id: 'f:egg', x: 1, eaten: 1 }], s: [] } }));
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 180, f: 50, c: 50 }));
    });
    await czCapPg.reload();
    await czCapPg.waitForTimeout(400);
    await czCapPg.click('.tab[data-view="macros"]');
    await czCapPg.waitForTimeout(400);
    const czCapped = await czCapPg.evaluate(() => {
      const cards = [...document.querySelectorAll('.mslot')];
      const sn = cards.filter((c) => /Snacks/.test((c.querySelector('.mslot-name') || {}).textContent || ''))[0];
      const t2 = sn && sn.querySelector('.mmp.kc[data-want]');
      return { ask: t2 ? Number(t2.dataset.want) : 0,
        marked: !!(sn && sn.querySelector('.mmp.kc.mmp-cap')) };
    });
    /* Snacks plan on a 1,000 kcal day at weight 10 of 90 is about 111, so the
       ceiling is about 222. The day has well over a thousand spare. */
    t.ok('a snack is never asked to be a dinner',
      czCapped.ask > 0 && czCapped.ask < 400, JSON.stringify(czCapped));
    t.ok('and the pill says the number is a limit and not an answer',
      czCapped.marked, JSON.stringify(czCapped));
    await czCapPg.context().close();

    /* ------------------------------------------------- one calorie on a day
     *
     * The bug this pins, in the place a person would see it: the day's own
     * calorie figure against the day's own macros. `mTotals` SUMMED each
     * plate's kcal while every target it is compared to was DERIVED as
     * 4p+4c+9f, so a day could hold 1504 calories and 1516 calories at the
     * same time and no screen admitted it.
     *
     * Seeded with RECIPES, by id, and not with whatever Fill drafted. The
     * first version of this test read a drafted day and passed with the bug
     * put back — the draft had reached mostly for single foods, which travel
     * a different road into a day and were never the broken one. A test of a
     * path the bug cannot reach is worth nothing, and this one only found out
     * because it was mutated.
     *
     * Six plates, because the error is a few calories each and only a stack
     * of them clears the rounding. */
    const calPage = await t.fresh();
    const calSeeded = await calPage.evaluate(() => {
      const d = new Date();
      const k = d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) +
        '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
      /* Whichever six the collection actually has, taken in book order so the
         choice cannot drift with the data: real recipes, real macros. */
      const ids = window.RECIPES
        .filter((r) => r.macro && r.macro.kcal > 100 && (r.macro.p || r.macro.c || r.macro.f))
        .slice(0, 6).map((r) => r.id);
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: ids[0], x: 1, eaten: 1 }, { id: ids[1], x: 1, eaten: 1 }],
        l: [{ id: ids[2], x: 1, eaten: 1 }, { id: ids[3], x: 1, eaten: 0 }],
        d: [{ id: ids[4], x: 1, eaten: 0 }], s: [{ id: ids[5], x: 1, eaten: 0 }] } }));
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 180, f: 50, c: 50 }));
      return ids.length;
    });
    t.ok('the calorie day is seeded with six real recipes', calSeeded === 6, 'got ' + calSeeded);
    await calPage.reload();
    await calPage.waitForTimeout(400);
    await calPage.click('.tab[data-view="macros"]');
    await calPage.waitForTimeout(350);
    const oneCalDay = await calPage.evaluate(() => {
      const r = window.__macroLab.read().tot;
      const der = 4 * r.p + 4 * r.c + 9 * r.f;
      return { kcal: Math.round(r.kcal), derived: Math.round(der),
        gap: Math.round(Math.abs(der - r.kcal)) };
    });
    /* A calorie of slack per plate and no more. Each plate's kcal is a whole
       number, so six of them can land a few calories off the sum of the
       unrounded macros. The two definitions were about twelve apart on a day
       of this size; anything of that order is the bug returning. */
    t.ok('a day holds one calorie figure, not two',
      oneCalDay.kcal > 400 && oneCalDay.gap <= 6, JSON.stringify(oneCalDay));
    await calPage.context().close();

    t.ok('the day is built to leave a gap the size a portion can be judged against',
      gapWindow.ok, JSON.stringify(gapWindow));
    /* Lunch opened first: the add is at the foot of the open meal (RP style,
       2026-10-04). */
    await openMeal(gapRow, 'l');
    await gapRow.click('.mslot-add[data-mslot="l"]');
    await gapRow.waitForTimeout(450);
    await pickerList(gapRow);
    await gapRow.waitForTimeout(500);

    /* Every claim is recomputed from the rendered number and the bench's own
       gap, so the colouring has to AGREE with the arithmetic rather than
       merely exist. */
    const painted = await gapRow.evaluate(() => {
      const T = window.__macroLab.targets();
      const tot = window.__macroLab.read().tot;
      const owed = { p: Math.max(0, T.p - tot.p), f: Math.max(0, T.f - tot.f),
        c: Math.max(0, T.c - tot.c) };
      const band = (m) => Math.max(3, (T[m] || 0) * 0.1);
      const wrong = [];
      let lands = 0, busts = 0, plain = 0;
      document.querySelectorAll('#mpList .mgc').forEach((el) => {
        const v = Number((el.textContent.match(/\d+/) || [0])[0]);
        const m = el.querySelector('i').className.replace('mb-', '');
        /* The row PRINTS a rounded gram count; the app CLASSIFIED the
           unrounded contribution. A dish sitting within half a gram of a band
           edge can legitimately render one side of it and be coloured by the
           other, and such a row is not evidence about the rule either way.
           Same rounding family as mGapPill taking Math.round of the
           difference while a test rounded the operands. */
        const edge = Math.min(Math.abs(v - (owed[m] + band(m))),
          Math.abs(Math.abs(v - owed[m]) - band(m)));
        if (owed[m] > 0 && edge <= 1) return;
        const want = !(owed[m] > 0) ? ''
          : v > owed[m] + band(m) ? 'busts'
          : Math.abs(v - owed[m]) <= band(m) ? 'lands' : '';
        const got = el.classList.contains('busts') ? 'busts'
          : el.classList.contains('lands') ? 'lands' : '';
        if (got !== want) wrong.push(m + ' ' + v + ' owed ' + Math.round(owed[m]) +
          ' want ' + (want || 'plain') + ' got ' + (got || 'plain'));
        if (got === 'lands') lands++; else if (got === 'busts') busts++; else plain++;
      });
      return { wrong: wrong.slice(0, 4), lands: lands, busts: busts, plain: plain };
    });
    t.ok('every macro on a row is painted to match the arithmetic',
      painted.wrong.length === 0 && (painted.lands + painted.busts + painted.plain) > 20,
      JSON.stringify(painted));

    /* Colour has to discriminate, or it says nothing.
     *
     * This has been adjusted twice and the second time said what the first
     * should have: the shape was wrong, not the number. It began as a STRICT
     * majority of silence and sat one row from failing for months; making the
     * recipe macros more accurate tipped it 27/25 to 26/26, and deriving the
     * calorie tipped it again to 27/25 the other way. Both times `wrong` came
     * back empty — every mark on the page correct, the test red anyway.
     *
     * A knife-edge on a count is not what anyone meant. #mpList is ranked by
     * fit, so the head of it is dense with dishes that land BY DESIGN, and
     * roughly half the marks carrying colour is a healthy list rather than a
     * broken one. What is actually being guarded is the two ENDS: nothing
     * coloured means the feature is not running, everything coloured means
     * the colour carries no information. So the claim is a band, wide enough
     * that ordinary data movement cannot cross it and narrow enough that
     * either failure does. */
    const lit = painted.lands + painted.busts;
    const share = lit / (lit + painted.plain);
    t.ok('and colour is neither on everything nor on nothing',
      lit + painted.plain > 20 && share >= 0.1 && share <= 0.9,
      Math.round(share * 100) + '% lit — ' + JSON.stringify(painted));

    /* And something is actually judged — all-plain would satisfy the two
       checks above and would mean the feature was not running. */
    t.ok('and something on the list is judged either way',
      painted.lands + painted.busts > 0, JSON.stringify(painted));

    /* Only CANDIDATES are judged against the gap.
     *
       A plate already on the day is counted IN that gap — mDayEaten walks
       the whole day — so painting it against the remainder is circular: the
       plate turns warm for busting a gap it is itself the reason for. A row
       in the basket is counted before it is committed, so the same applies.
       Both state what they are; neither is graded. */
    await pickerList(gapRow);
    await gapRow.waitForTimeout(300);
    const basketBtn = await gapRow.$('[data-mpick]');
    if (basketBtn) { await basketBtn.click(); await gapRow.waitForTimeout(350); }
    t.ok('a plate on the day and a row in the basket are never graded against it',
      await gapRow.evaluate(() =>
        document.querySelectorAll('.mpb-m .mgc.lands, .mpb-m .mgc.busts').length === 0 &&
        document.querySelectorAll('.mitem-mac .mgc.lands, .mitem-mac .mgc.busts').length === 0),
      await gapRow.evaluate(() => 'basket ' +
        document.querySelectorAll('.mpb-m .mgc.lands, .mpb-m .mgc.busts').length + ', plates ' +
        document.querySelectorAll('.mitem-mac .mgc.lands, .mitem-mac .mgc.busts').length));

    /* ...and the basket really did get a row, so the check above had
       something to be wrong about. */
    await openBasket(gapRow);
    t.ok('and the basket actually had a row to not grade',
      await gapRow.evaluate(() => document.querySelectorAll('.mpb-m').length > 0));

    /* The badge is rare by construction: it needs a real gap AND a row that
       lands all three at once AND does half the work. */
    const badges = await gapRow.evaluate(() => ({
      n: document.querySelectorAll('#mpList .mp-closes').length,
      rows: document.querySelectorAll('#mpList [data-mpick]').length,
    }));
    t.ok('and the closes badge stays rare enough to mean something',
      badges.rows > 10 && badges.n <= Math.ceil(badges.rows * 0.25), JSON.stringify(badges));
    await gapRow.context().close();
  },
});
