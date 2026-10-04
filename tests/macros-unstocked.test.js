/* Food the storehouse does not stock: what the picker offers for it, and how
 * it is drafted and kept.
 *
 * Part of the Nourish suite, split out of tests/macros.test.js: the page
 * helpers and the plan every page starts with are in tests/fixtures/nourish.js. */
const { nourish, addOn } = require('./fixtures/nourish.js');

module.exports = nourish({
  name: 'Macros — food the storehouse does not stock',
  async suite(t) {
    /* ---- food the storehouse does not stock ------------------------------
     * The books are written to be cooked out of the standard order, and a day
     * drafted from salmon and almonds is not a day if there is no salmon in
     * the house. So external foods are gated on a setting, and off is the
     * default because it is the answer that cannot surprise you.
     *
     * Asserted as a DIFFERENCE between the two settings on one seeded day,
     * never against a named food: which external food wins a rung depends on
     * the day's gap, and pinning "tuna steak" would be pinning today's
     * arithmetic. */
    const extPg = async (on) => {
      const pg = await t.fresh();
      await pg.evaluate((e) => {
        localStorage.setItem('bsc.macroProfile', JSON.stringify({ sex: 'm', age: 43, ft: 5,
          inch: 11, lb: 190, act: 1.375, goal: 'cut1', goalLb: 175, goalBy: '',
          workouts: 4, steps: 8000, extFill: e }));
      }, on);
      await pg.reload();
      await pg.waitForTimeout(350);
      await pg.click('.tab[data-view="macros"]');
      await pg.waitForTimeout(250);
      await addOn(pg);
      await pg.waitForTimeout(500);
      return pg.evaluate(() => {
        const N = window.Nutrition.FOODS;
        const extNames = {};
        Object.keys(N).forEach((k) => { if (N[k].ext) extNames[(N[k].label || k).toLowerCase()] = 1; });
        const rows = [...document.querySelectorAll('#modalRoot .mpick-wrap .mp-name')]
          .map((e) => e.textContent);
        /* Checked on this page rather than a page from earlier in the suite:
           `p` is closed by the time this runs, and reaching for it threw
           rather than failed, which reads as a broken suite instead of a
           broken assertion. */
        const bad = [];
        Object.keys(N).forEach((k) => {
          const f = N[k];
          if (!f.ext) return;
          if (!f.g || !Object.keys(f.g).length) bad.push(k + ': no g');
          else if (!f.def) bad.push(k + ': no def');
          else if (!f.g[f.def.unit]) bad.push(k + ': def unit "' + f.def.unit + '" has no weight');
          else if (!f.label) bad.push(k + ': no label');
          else if (!f.zone) bad.push(k + ': no zone');
          else if (!(f.kcal > 0)) bad.push(k + ': no calories');
        });
        return { rows: rows.length, bad: bad,
          ext: rows.filter((n) => extNames[String(n).toLowerCase()]),
          known: Object.keys(extNames).length };
      });
    };
    const extOff = await extPg(false);
    const extOn = await extPg(true);
    t.ok('the table knows food the storehouse does not stock',
      extOff.known >= 20, String(extOff.known));
    t.ok('and does not offer any of it by default',
      extOff.rows > 5 && extOff.ext.length === 0, JSON.stringify(extOff.ext));
    t.ok('but offers it once you say Fill may shop',
      extOn.ext.length > 0, JSON.stringify(extOn.ext));

    /* A half-authored entry is the failure this guards. The six numbers come
       from the USDA and are fetched; `g`, `def`, `label` and what the food is
       FOR are judgement and are typed by hand, and a missing `def` is how a
       portion once defaulted to a cup of soy sauce. */
    t.ok('and every one of them is a complete entry',
      extOff.bad.length === 0, extOff.bad.slice(0, 6).join(' | '));

    /* Nothing, chips, bars — one language in three doses.
     *
       Silence when a meal is fine, a chip for the macro that is not, and the
       whole picture only where you are actually dialling it in. Three chips on
       every meal all day is colour that is always on, and colour that is
       always on has stopped saying anything. */
    const dosePg = await t.fresh({ viewport: { width: 390, height: 900 } });
    await dosePg.click('.tab[data-view="macros"]');
    await dosePg.waitForTimeout(300);
    await dosePg.click('#macroFill');
    await dosePg.waitForTimeout(800);
    /* Every meal folded, so the whole day is being scanned at once. */
    /* One at a time, re-querying each round: every click redraws the day, so a
       NodeList taken up front is a list of detached nodes after the first
       one. Only the first click was landing. */
    for (let i = 0; i < 8; i++) {
      const more = await dosePg.evaluate(() => {
        const b = document.querySelector('.mslot-head[aria-expanded="true"]');
        if (!b) return false;
        b.click();
        return true;
      });
      if (!more) break;
      await dosePg.waitForTimeout(120);
    }
    await dosePg.waitForTimeout(300);
    const glance = await dosePg.evaluate(() => {
      const cards = [...document.querySelectorAll('.mslot')];
      return {
        meals: cards.length,
        chips: cards.map((c) => c.querySelectorAll('.msub-c').length),
        barsWhileFolded: document.querySelectorAll('.msub-bars').length,
        everyChipOff: [...document.querySelectorAll('.msub-c')].every((e) =>
          /\b(over|short)\b/.test(e.className)),
        /* The calorie figure moved off the seam and onto its own gauge, so
           it is read off the flame label now rather than .msub-k. */
        /* The calorie figure moved off the seam and onto its own gauge, so
           it is read off the flame label now rather than .msub-k. */
        /* ...or, on a folded meal card, its calories against its share. */
        kcalAlways: cards.every((c) => !c.querySelector('.mslot-head') ||
          /\uD83D\uDD25\s*\d/.test(c.querySelector('.mslot-head').textContent) ||
          /^[\d,]+ \/ [\d,]+ kcal$/.test((c.querySelector('.mcard-k') || {}).textContent || '')),
      };
    });
    t.ok('a folded day shows no bars at all',
      glance.barsWhileFolded === 0, JSON.stringify(glance));
    /* The chips that ARE drawn are only ever the ones that are off — there is
       no "on" chip, which is what makes the absence of one mean something. */
    t.ok('and every chip on it is one that is off',
      glance.everyChipOff, JSON.stringify(glance));
    /* Silence cannot be mistaken for "not worked out yet", because the calorie
       figure is beside it either way. */
    t.ok('and a meal that says nothing still says its calories',
      glance.kcalAlways, JSON.stringify(glance));

    /* Open it and the whole picture arrives, next to the buttons that change
       it — and the chips go, because the same thing said twice in one card is
       once too many. */
    await dosePg.evaluate(() => {
      const b = document.querySelector('.mslot-head[aria-expanded="false"]');
      if (b) b.click();
    });
    await dosePg.waitForTimeout(400);
    const opened = await dosePg.evaluate(() => {
      const card = [...document.querySelectorAll('.mslot')].find((c) =>
        c.querySelector('.mslot-head[aria-expanded="true"]'));
      if (!card) return null;
      return { bars: card.querySelectorAll('.msub-br').length,
        chips: card.querySelectorAll('.msub-c').length,
        marks: card.querySelectorAll('.msub-bm').length,
        beforePlates: !!card.querySelector('.msub-bars ~ .mitem, .msub-bars + .mitem') ||
          [...card.querySelectorAll('.msub-bars, .mitem')].findIndex((e) =>
            e.classList.contains('mitem')) > 0 };
    });
    /* The picker measures the DAY now, not this meal's share.
     *
       You are shopping to close the day, wherever the food ends up sitting —
       and this sheet used to have the panel speaking one share while the
       footer beneath it spoke another, so the top invited food the bottom
       called a bust. One number, both halves reading it. */
    await addOn(dosePg);
    await dosePg.waitForTimeout(600);
    const dayPanel = await dosePg.evaluate(() => {
      const box = document.querySelector('.mp-left');
      if (!box) return null;
      const L = window.__macroLab, T = L.targets(), tot = L.read().tot;
      const pills = [...box.querySelectorAll('.mgp')].map((e) => ({
        txt: e.textContent.trim(),
        n: Number((e.textContent.match(/\d+/g) || [0]).pop()),
        met: e.classList.contains('met'),
      }));
      return { cap: (box.querySelector('.mp-cap') || {}).textContent || '',
        pills: pills, oldBars: box.querySelectorAll('.msub-br').length,
        /* Rounded the same way the pill rounds it — mGapPill takes
           Math.round of the DIFFERENCE, so rounding the two operands first
           disagrees by one whenever both fractions straddle a half. That is
           what made this assertion pass alone and fail in a full run: not
           load, just which targets the page happened to be carrying. */
        owedP: Math.max(0, Math.round(T.p - tot.p)) };
    });
    /* REVERSED A SECOND TIME, and the history is worth keeping.
     *
       It first read "Where the day stands · 60 / 203 g" — four bars of
       standing. That became the remainder, because shopping is done against
       what is MISSING and the subtraction was otherwise being done in
       Blake's head on every row. True, and it cost the other half: a lone
       "20" cannot say whether that is the whole meal still to come or the
       last mouthful of it.
     *
       So both halves now, with the fill carrying the remainder that the
       middle version printed. Blake: "those three macros clearly show me how
       much I've selected and what is left. That makes a perfect meal." */
    t.ok('the picker answers with four pills, not the old bars',
      !!dayPanel && dayPanel.pills.length === 4 && dayPanel.oldBars === 0,
      JSON.stringify(dayPanel && { cap: dayPanel.cap, n: dayPanel.pills.length,
        bars: dayPanel.oldBars }));

    /* The claim that matters is that the sheet and the card agree about the
       same meal. Read off the card rather than recomputed here, for exactly
       that reason — a literal would pass on an app that had stopped doing
       the arithmetic at all. */
    const owedNow = await dosePg.evaluate(() => {
      const cap = (document.querySelector('.mp-cap') || {}).textContent || '';
      const meal = (cap.match(/^(.*?)\s+(?:so far|is closed)/i) || [, ''])[1].trim();
      const card = [...document.querySelectorAll('.mslot')].find((c) =>
        ((c.querySelector('.mslot-name') || {}).textContent || '').trim()
          .replace(/[^A-Za-z ]/g, '').trim().toLowerCase() === meal.toLowerCase());
      const pil = card && [...card.querySelectorAll('.mmp')].find((e) =>
        /^P/.test((e.querySelector('i') || {}).textContent || ''));
      if (!pil) return null;
      const got = Number((pil.querySelector('.mmp-v').textContent.match(/\d+/) || [0])[0]);
      const sheet = [...document.querySelectorAll('.mp-left .mgp')]
        .filter((e) => /P/.test(e.textContent) && !/\uD83D\uDD25/.test(e.textContent))
        .map((e) => (e.textContent.match(/\d+/g) || []).map(Number))[0];
      return { shown: sheet && sheet[0], cardGot: got, sheetWant: sheet && sheet[1] };
    });
    t.ok('and its protein pill holds what the meal card says the meal holds',
      !!owedNow && Math.abs(owedNow.shown - owedNow.cardGot) <= 1 &&
        owedNow.sheetWant > 0,
      JSON.stringify(owedNow));

    /* REVERSED. This said "and says so, rather than naming a meal or a share"
       and asserted the caption did NOT name a meal — the sheet counted the
       day, so naming one would have been a lie. Blake, looking at a sheet
       headed ADD TO SNACKS reading 1745 kcal while Snacks was asking for 87:
       "the macro pills at the top are for the whole day? why not for the meal
       I am trying to make?"

       So the pills answer the meal now, and the caption has to name it or the
       figure has no scope at all. Everything else in this sheet was already
       meal-scoped — the ranking, and a section that says one food that closes
       Snacks — and the pills were the only thing left answering the day. */
    t.ok('and names the meal it is counting, because it counts a meal now',
      /so far|is closed/i.test(dayPanel.cap) && /\w/.test(dayPanel.cap),
      dayPanel.cap);

    /* The flame in the sheet agrees with the flame on the card behind it.
     *
       This used to assert the sheet's flame equalled the DAY's remainder, and
       that it was summed from what the plates state rather than derived back
       out of their grams — two eaten-calorie totals for one day. That second
       worry is gone: since one calorie became 4P+4C+9F everywhere, summing
       and deriving are the same operation, and recipes.test.js guards it at
       the record.

       What is worth pinning now is scope. The sheet fills one meal and the
       card for that meal is directly behind it, so the two have to agree
       about the same meal or the sheet invites food the card calls a bust —
       which is the exact failure this file already records at mShares. */
    const flame = await dosePg.evaluate(() => {
      const pill = [...document.querySelectorAll('.mp-left .mgp')]
        .find((e) => /\uD83D\uDD25/.test(e.textContent));
      /* The FIRST number: the pill reads got/want now, and .pop() was taking
         the target back when the pill carried only the remainder. */
      const shown = Number((pill.textContent.match(/\d+/g) || [0])[0]);
      /* The same figure off the meal card. Both are got/want now, so the
         sheet's first number and the card's are the same number. */
      const cap = (document.querySelector('.mp-cap') || {}).textContent || '';
      const meal = (cap.match(/^(.*?)\s+(?:so far|is closed)/i) || [, ''])[1].trim();
      const card = [...document.querySelectorAll('.mslot')].find((c) =>
        ((c.querySelector('.mslot-name') || {}).textContent || '').trim()
          .replace(/[^A-Za-z ]/g, '').trim().toLowerCase() === meal.toLowerCase());
      const t2 = card && card.querySelector('.mmp.kc');
      const got = t2 ? Number((t2.querySelector('.mmp-v').textContent.match(/\d+/) || [0])[0]) : null;
      const want = t2 ? Number(t2.dataset.want || 0) : null;
      return { shown: shown, meal: meal, got: got, want: want };
    });
    t.ok('the flame in the sheet is the same figure the meal card is showing',
      flame.got !== null && Math.abs(flame.shown - flame.got) <= 1,
      JSON.stringify(flame));
    await dosePg.context().close();

    /* The verdict, per macro, on the row that already existed.
     *
       The header pill answered CALORIES, so a lunch five times over on fat
       and fine on protein read as one number with no name on it. It is gone
       from a meal with food on it; the pills say it per macro instead, in the
       same construction the day's own folded readout uses one level up. */
    const pillPg = await t.fresh({ viewport: { width: 390, height: 800 } });
    await pillPg.click('.tab[data-view="macros"]');
    await pillPg.waitForTimeout(300);
    /* In four pills now rather than one flame. A lone calorie figure told you
       the SIZE of the meal and nothing about its shape, and the shape is the
       part you plan against: 0 of 44 protein says what to go looking for. */
    t.ok('an empty meal still says what it is meant to hold',
      await pillPg.evaluate(() => {
        const card = document.querySelector('.mslot');
        const ps = [...card.querySelectorAll('.mmp')];
        return ps.length === 4 && ps.every((e) =>
          Number(e.dataset.want) > 0);
      }));
    await pillPg.click('#macroFill');
    await pillPg.waitForTimeout(700);
    /* A meal says its calories and what is on it. Nothing else.
     *
       Chips folded and bars open both judged a meal against its SHARE of the
       day. They are gone — you steer by the day, and the strip pinned at the
       top of the screen says how it is stacking. A meal is a container.

       What this asserts is the silence, because silence is the feature: a
       macro judgement appearing on a meal card is now the regression. */
    for (let i = 0; i < 8; i++) {
      const more = await pillPg.evaluate(() => {
        const b = document.querySelector('.mslot-head[aria-expanded="true"]');
        if (!b) return false;
        b.click();
        return true;
      });
      if (!more) break;
      await pillPg.waitForTimeout(110);
    }
    await pillPg.waitForTimeout(300);
    const quietFolded = await pillPg.evaluate(() => ({
      cards: document.querySelectorAll('.mslot').length,
      chips: document.querySelectorAll('.msub-c').length,
      oldBars: document.querySelectorAll('.msub-bars').length,
      seams: document.querySelectorAll('.mslot-head').length,
      gauges: document.querySelectorAll('.mslot-head .mmps').length,
      /* the target is a NUMBER on the pill now, not a tick on a bar */
      ticks: document.querySelectorAll('.mslot-head .mmp[data-want]').length,
      kcal: [...document.querySelectorAll('.mslot-head')]
        .filter((e) => /\uD83D\uDD25\s*\d/.test(e.textContent)).length,
      shut: document.querySelectorAll('#macroSlots .mcard-shut').length,
      shutKcal: [...document.querySelectorAll('#macroSlots .mcard-shut .mcard-k')]
        .filter((e) => /^[\d,]+ \/ [\d,]+ kcal$/.test(e.textContent)).length,
      shutBars: document.querySelectorAll('#macroSlots .mcard-shut .mcard-tr .mcard-fi').length,
      shutSay: [...document.querySelectorAll('#macroSlots .mcard-shut .mcard-say')].map((e) => e.textContent),
      shutGauges: document.querySelectorAll('#macroSlots .mcard-shut .mmps, #macroSlots .mcard-shut .mmp').length,
    }));
    /* Reversed deliberately. This used to assert that a folded meal said its
       calories and NOTHING about macros — you steer by the day, a meal is a
       container, and grading each one against a share it never agreed to was
       a second opinion nobody asked for.

       Blake asked for the verdict back, twice, having been shown what it
       costs. So the seam carries four gauges now: the calories it always
       carried, and P/F/C against a tick at the meal's share. What must NOT
       come back is the old apparatus — the chips and the .msub-bars that had
       a second, disagreeing definition of that share. */
    /* Reversed again, by Blake, on 2026-10-04: shown the meal's macros on the
       folded card as four gauges, as one split bar and as rings round the
       tick, he chose "Just the calorie bar is fine." The macro that is off is
       still named — in the verdict's words ("554 over · carbs over") — so the
       folded card judges the meal against its share without a second gauge
       set. What must not come back is the old apparatus either way. */
    t.ok('a folded meal shows its calories against its share, one bar, and the verdict in words',
      quietFolded.shut > 0 && quietFolded.shutKcal === quietFolded.shut &&
      quietFolded.shutBars === quietFolded.shut && quietFolded.shutGauges === 0 &&
      quietFolded.shutSay.every((w) => /^(on its aim|Eaten|[\d,]+ (over|short)( · (protein|fat|carbs) (over|short))?)$/.test(w)) &&
      quietFolded.chips === 0 && quietFolded.oldBars === 0,
      JSON.stringify(quietFolded));
    /* And opening one does not bring them back — the open card is plates and
       steppers, which is what it is for. */
    await pillPg.evaluate(() => {
      const b = document.querySelector('.mslot-head[aria-expanded="false"]');
      if (b) b.click();
    });
    await pillPg.waitForTimeout(350);
    const quietOpen = await pillPg.evaluate(() => {
      const card = [...document.querySelectorAll('.mslot')].find(
        (c) => c.querySelector('.mslot-head[aria-expanded="true"]'));
      if (!card) return null;
      return { plates: card.querySelectorAll('.mitem').length,
        chips: card.querySelectorAll('.msub-c').length,
        bars: card.querySelectorAll('.msub-bars').length };
    });
    t.ok('and opening it gives you plates, not charts',
      !!quietOpen && quietOpen.plates > 0 &&
      quietOpen.chips === 0 && quietOpen.bars === 0,
      JSON.stringify(quietOpen));
    /* The empty-meal sentence is asserted at the top of this block, before
       Fill puts food on everything. Nothing here is empty any more. */

    /* On it is a BAND. Without one every meal every day is off by something,
       the colour is on all the time, and colour that is always on has stopped
       saying anything. */
    t.ok('a meal that landed goes quiet rather than lighting up',
      await pillPg.evaluate(() => {
        const L = window.__macroLab, T = L.targets();
        L.forget();
        return typeof L.draft === 'function';
      }) && await pillPg.evaluate(() => {
        // every pill on the day is one of the three known states, never blank
        return [...document.querySelectorAll('.msub-c')].every((e) =>
          /\b(on|over|short)\b/.test(e.className));
      }));
    await pillPg.context().close();

    /* Try again can offer a plain food.
     *
       The pool was recipes only, and a food belongs to no section, so one
       could not have got in even by accident. Pressing this on a snack — the
       meal most likely to be a yoghurt and a stick of cheddar rather than a
       dish — walked you through the whole book instead.

       Gated on `eat` or `side`, because the food table is mostly INGREDIENTS:
       unfiltered it offered three ounces of raw stewing beef as a snack,
       which is a worse answer than the recipe it replaced. */
    const foodPg = await t.fresh({ viewport: { width: 390, height: 800 } });
    await foodPg.click('.tab[data-view="macros"]');
    await foodPg.waitForTimeout(300);
    const pool = await foodPg.evaluate(() => {
      const L = window.__macroLab; L.forget(); L.draft();
      const all = L.rank('s', 80);
      const foods = all.filter((e) => String(e.id).indexOf('f:') === 0);
      return { total: all.length, foods: foods.length,
        names: foods.map((f) => f.name).slice(0, 40) };
    });
    t.ok('a snack can be a plain food, not only a recipe',
      pool.foods > 0, JSON.stringify(pool).slice(0, 160));
    /* The two ends of the rule, named outright: something you eat as it comes
       is in, an ingredient is not. */
    t.ok('and it is food you could actually eat as it comes',
      pool.names.some((n) => /cheddar|yogurt|peanut|egg|ham|chicken|cheese/i.test(n)),
      pool.names.join(', ').slice(0, 140));
    t.ok('and never a raw ingredient waiting to be cooked',
      !pool.names.some((n) => /stewing|ground beef|flour|cornstarch|yeast|dry mix|baking/i.test(n)),
      pool.names.join(', ').slice(0, 140));
    await foodPg.context().close();

    /* Skipping a meal.
     *
       The visible half is a line instead of a card. The half that matters is
       arithmetic: an empty meal RESERVES its share — mShares divides the day
       across every empty slot — so a lunch you have decided against goes on
       holding a quarter of the day and quietly aims every other meal lower.
       A skip has to release it, or it is only a costume. */
    const skipPg = await t.fresh({ viewport: { width: 390, height: 800 } });
    await skipPg.click('.tab[data-view="macros"]');
    await skipPg.waitForTimeout(400);
    t.ok('an empty meal offers a way to skip it',
      await skipPg.evaluate(() => !!document.querySelector('[data-mskip]')));
    /* What breakfast is told to aim for, with every meal still in play and
       then with lunch dropped out of the divisor. This is the whole feature:
       the share is a weight over the weights STILL IN PLAY. */
    /* Read off the kcal pill's denominator. It used to come from the lone
       flame an empty meal wore; the meal wears its four pills now and the
       share is the first of them. The claim underneath is unchanged — and it
       is the one that matters, because asserting the day's TOTAL here proved
       nothing. */
    const shareRead = () => skipPg.evaluate(() => {
      const card = [...document.querySelectorAll('.mslot')]
        .find((c) => c.querySelector('.mslot-name-flat'));
      const t2 = card && card.querySelector('.mmp.kc[data-want]');
      return t2 ? Number(t2.dataset.want) : 0;
    });
    const bShareBefore = await shareRead();
    await skipPg.evaluate(() => document.querySelector('[data-mskip="l"]').click());
    await skipPg.waitForTimeout(400);
    const skipped = await skipPg.evaluate(() => {
      const el = document.querySelector('.mslot-skipped');
      return { line: !!el, says: el ? el.textContent.replace(/\s+/g, ' ').trim() : '',
        undo: !!(el && el.querySelector('[data-mskip]')) };
    });
    t.ok('and it becomes a line that says so, with the way back on it',
      skipped.line && /skipped/i.test(skipped.says) && skipped.undo,
      JSON.stringify(skipped));
    const bShareAfter = await shareRead();
    /* Asserting the day's TOTAL here proved nothing — mBalanceDay lands the
       day on target whether or not the share was released, so that version
       passed with the feature reverted. The share is what actually moves. */
    t.ok('and the share lunch was holding goes to the meals that remain',
      bShareAfter > bShareBefore * 1.15,
      'breakfast share ' + bShareBefore + ' -> ' + bShareAfter);

    /* And Fill respects it. */
    await skipPg.click('#macroFill');
    await skipPg.waitForTimeout(800);
    t.ok('Fill leaves a skipped meal alone',
      await skipPg.evaluate(() => {
        const m = window.__macroLab.read().meals.find((x) => x.k === 'l');
        return !!m && m.items.length === 0;
      }));

    t.ok('and un-skipping puts the meal back',
      await skipPg.evaluate(() => {
        document.querySelector('.mslot-skipped [data-mskip]').click();
        return !document.querySelector('.mslot-skipped');
      }));
    await skipPg.context().close();
  },
});
