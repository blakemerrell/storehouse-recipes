/* A week rather than one day seven times, salt in the arithmetic, the fold
 * on a meal, the slack from a finished meal going to the meals ahead, a
 * skipped meal handing its share over, and the verb an empty meal offers.
 *
 * Part of the Nourish suite, split out of tests/macros.test.js: the page
 * helpers and the plan every page starts with are in tests/fixtures/nourish.js. */
const { nourish, openPlan } = require('./fixtures/nourish.js');

module.exports = nourish({
  name: 'Macros — salt, a meal\'s fold, and handing slack on',
  async suite(t) {
    /* ---- a week, not the same day seven times --------------------------- */
    const wk = await t.fresh();
    await wk.click('.tab[data-view="macros"]');
    await wk.waitForTimeout(180);
    const drafted3 = [];
    for (let d = 0; d < 3; d++) {
      await wk.click('#macroFill');
      await wk.waitForTimeout(320);
      drafted3.push(await wk.evaluate(() => {
        const D = JSON.parse(localStorage.getItem('bsc.macroDays') || '{}');
        const k = Object.keys(D).sort();
        const day = D[k[k.length - 1]] || {};
        const out = [];
        ['b', 'l', 'd', 's'].forEach((sk) => (day[sk] || []).forEach((it) => out.push(String(it.id))));
        return out;
      }));
      if (d < 2) { await wk.click('#macroNext'); await wk.waitForTimeout(220); }
    }
    /* Fill knew only about the day in front of it, so seven drafted days ran
       to nineteen distinct dishes and served one of them four times. A cook
       notices that long before they notice a macro. Consecutive days must not
       share a plate — unless the section is too thin to offer another, which
       is why this asks about the days either side and not about the week. */
    const sharedAdjacent = drafted3[0].filter((x) => drafted3[1].indexOf(x) >= 0)
      .concat(drafted3[1].filter((x) => drafted3[2].indexOf(x) >= 0));
    t.ok('two days running are not the same day twice',
      sharedAdjacent.length === 0, sharedAdjacent.join(',') || 'nothing shared');
    t.ok('and each of them still got fed',
      drafted3.every((d) => d.length >= 3), drafted3.map((d) => d.length).join(','));

    /* ---- salt is part of the arithmetic now ----------------------------- */
    /* On a hard cut, and only there. The default plan is roomy enough that
       the chooser never has to reach for the salted end of the book, so a day
       drafted against it proves nothing — both assertions below passed with
       the guards deliberately removed until this profile was put in front of
       them. A hard cut is where protein crowds a day small enough that the
       cheapest way to hit it is a salty one. */
    await wk.evaluate(() => {
      localStorage.setItem('bsc.macroProfile', JSON.stringify({
        sex: 'm', age: 41, ft: 5, inch: 11, lb: 204, act: 1.55,
        goal: 'cut2', goalLb: 0, goalBy: '', workouts: 4, steps: 8000 }));
      localStorage.removeItem('bsc.macroTargets');
      localStorage.removeItem('bsc.macroDays');
    });
    await wk.reload();
    await wk.waitForTimeout(380);
    await wk.click('.tab[data-view="macros"]');
    await wk.waitForTimeout(180);
    await openPlan(wk);
    await wk.waitForTimeout(280);
    await wk.evaluate(() => {
      const g = document.querySelector('[data-mtgoal="cut2"]');
      if (g && !g.disabled) g.click();
    });
    await wk.waitForTimeout(160);
    await wk.evaluate(() => { const u = document.querySelector('[data-mtuse]'); if (u) u.click(); });
    await wk.waitForTimeout(160);
    await wk.click('[data-mtarg="save"]');
    await wk.waitForTimeout(320);
    const hardCut = await wk.evaluate(() =>
      JSON.parse(localStorage.getItem('bsc.macroTargets') || 'null'));
    t.ok('the day under test really is a hard cut',
      hardCut && hardCut.p >= 190, JSON.stringify(hardCut));
    for (let d = 0; d < 4; d++) {
      await wk.click('#macroFill');
      await wk.waitForTimeout(320);
      if (d < 3) { await wk.click('#macroNext'); await wk.waitForTimeout(220); }
    }

    /* Chasing protein, the portion solver took a chicken salad carrying
       fourteen hundred milligrams a serving to four servings: five and a half
       grams of sodium out of one bowl, twice the day's ceiling, every macro
       bar green. Sodium was not in the penalty it was minimising, so nothing
       objected. No single plate on a drafted day may carry the whole day's
       ceiling by itself. */
    const worst = await wk.evaluate(() => {
      const D = JSON.parse(localStorage.getItem('bsc.macroDays') || '{}');
      let top = 0;
      Object.keys(D).forEach((k) => ['b', 'l', 'd', 's'].forEach((sk) => (D[k][sk] || []).forEach((it) => {
        const r = window.RECIPES.find((x) => String(x.id) === String(it.id));
        if (r && r.macro) top = Math.max(top, r.macro.na * it.x);
      })));
      return Math.round(top);
    });
    t.ok('no one plate on a drafted day carries the whole day\'s salt',
      worst < 2300, worst + ' mg on a single plate');

    /* A topper is a spoonful to finish a day. A cup of soy sauce is a hundred
       and thirty-five calories at fifteen grams of protein per hundred —
       denser than chicken breast on paper — and fourteen thousand milligrams
       of sodium, and it scored beautifully until the ceiling was written
       down.
     *
       Opportunistic, and known to be: a topper is only placed when the dishes
       leave a gap worth closing, so some drafts carry none and this passes by
       having nothing to judge. It is here to catch the regression when it
       does fire, not to prove it cannot. The guard it watches is a stated
       ceiling in the code, not an emergent property to be sampled for. */
    const topSalt = await wk.evaluate(() => {
      const D = JSON.parse(localStorage.getItem('bsc.macroDays') || '{}');
      const N = (window.Nutrition || {}).FOODS || {};
      /* A second copy of mFoodServing, and it has to track it: the app chose
         to count cheddar in whole cheeses until the table's own stated
         portion was honoured, and this copy went on pricing the old unit and
         reporting salt for a serving nobody was eating. Where the table
         states the unit, the table wins — here as there. */
      const serve = (f) => {
        if (f.def && f.def.unit && f.g && f.g[f.def.unit]) return f.g[f.def.unit];
        const u = f.g || {}; let best = null;
        Object.keys(u).forEach((k2) => {
          const g = u[k2]; if (!g) return;
          const miss = Math.abs((f.kcal || 0) * g / 100 - 130) + (k2 === 'each' ? -25 : 0);
          if (!best || miss < best.miss) best = { g, miss };
        });
        return best ? best.g : 100;
      };
      let top = 0;
      Object.keys(D).forEach((k) => ['b', 'l', 'd', 's'].forEach((sk) => (D[k][sk] || []).forEach((it) => {
        const id = String(it.id);
        if (id.indexOf('f:') !== 0 || id.indexOf('f:my:') === 0) return;
        const f = N[id.slice(2)]; if (!f) return;
        top = Math.max(top, (f.na || 0) * serve(f) / 100 * it.x);
      })));
      return Math.round(top);
    });
    t.ok('and a topper never brings a condiment\'s worth of salt with it',
      topSalt <= 400, topSalt + ' mg from a single food');

    await wk.context().close();

    /* ---- the fold on a meal ----------------------------------------------
     * The meal name has always folded the meal and nothing said so, and the
     * name is at the far left of a phone, which is the one place a thumb is
     * not. So the handle is a button over on the right with the other
     * controls — and the row it joins was already carrying five things, so
     * what this mostly guards is that a sixth did not break it. */
    const fold = await t.fresh({ viewport: { width: 375, height: 720 } });
    await fold.click('.tab[data-view="macros"]');
    await fold.waitForTimeout(200);
    await openPlan(fold);
    await fold.waitForTimeout(200);
    await fold.click('[data-mtarg="save"]');
    await fold.waitForTimeout(250);
    await fold.click('#macroFill');
    await fold.waitForTimeout(600);
    t.ok('a meal with something on it carries a handle, an empty one does not',
      await fold.evaluate(() => [...document.querySelectorAll('.mslot')].every((s) => {
        const has = !!s.querySelector('.mslot-head[data-mfold]');
        const items = s.querySelectorAll('.mitem, .mthin').length > 0;
        return has === items;
      })),
      await fold.evaluate(() => [...document.querySelectorAll('.mslot')].map((s) =>
        (s.querySelector('.mslot-name') || {}).textContent + ':' +
        (s.querySelector('.mslot-head[data-mfold]') ? 'handle' : 'none')).join(' | ')));
    /* The handle is the HEAD. This used to assert the opposite — "the handle
       is the seam, not a button in the header", a strip below the row running
       the full width of the card — because the header was carrying three icon
       buttons and a button cannot hold buttons. The approved mockup says the
       other thing in as many words ("the whole head is the door"), so the
       verbs went to the foot of the open meal and the header became the door.
       These two assertions are not re-aimed proxies; they are the old
       decision, replaced by the one that overruled it.
     *
       It does not reach the card's left edge and should not: the dot lives
       out there, and pressing the dot marks the meal eaten. */
    t.ok('and the handle is the head, carrying the meal\u2019s own numbers',
      await fold.evaluate(() => {
        const b = document.querySelector('.mslot-head[data-mfold]');
        if (!b) return false;
        const row = b.closest('.mslot-h').getBoundingClientRect();
        const r = b.getBoundingClientRect();
        const plate = b.closest('.mslot').querySelector('.mslot-items, .mslot-thin');
        return r.width >= row.width * 0.7 && !!b.querySelector('.mmp') &&
          !!b.querySelector('.mslot-name') &&
          !!plate && plate.getBoundingClientRect().top >= r.bottom - 1;
      }),
      await fold.evaluate(() => {
        const b = document.querySelector('.mslot-head[data-mfold]');
        const row = b.closest('.mslot-h').getBoundingClientRect();
        return 'head ' + Math.round(b.getBoundingClientRect().width) + 'px of row ' +
          Math.round(row.width) + 'px, pills ' + b.querySelectorAll('.mmp').length;
      }));
    /* And the header carries nothing else to press. The reason the old rule
       existed — a row of icon buttons crowding the name — still holds; only
       the remedy changed. The dot is the one exception, and it is the meal's
       own tick. */
    t.ok('and the header carries nothing to press but the door and the dot',
      await fold.evaluate(() => [...document.querySelectorAll('.mslot > .mslot-h')]
        .every((h) => [...h.querySelectorAll('button')].every((b) =>
          b.classList.contains('mslot-head') || b.classList.contains('mday-dot') ||
          b.hasAttribute('data-mskip')))),
      await fold.evaluate(() => [...document.querySelectorAll('.mslot > .mslot-h')]
        .map((h) => [...h.querySelectorAll('button')].map((b) => b.className.split(' ')[0]).join('+'))
        .join(' | ')));
    /* Six controls across a 375-wide phone. A wrapped "+ Add" doubles the
       height of every meal on the day, which is the exact thing the two-line
       header was built to avoid. */
    /* Measured on the ROW, not on every button in it. The height of a
       control was a proxy for "nothing wrapped", and it stopped
       distinguishing the two the moment the name button was deliberately
       stretched to fill the row — a 45px tap target is the fix for a header
       nobody could hit, not a wrap. The row's own height is the thing the
       claim was ever about: one line of controls, whatever their boxes. */
    t.ok('and no control on that row wraps onto a second line',
      await fold.evaluate(() => [...document.querySelectorAll('.mslot-h')].every((h) =>
        h.getBoundingClientRect().height <= 64 &&
        [...h.querySelectorAll('button')].every((b) =>
          b.classList.contains('mslot-head') || b.classList.contains('mslot-name') ||
          /* the dot is a thumb's reach around a nine-pixel face, by design */
          b.classList.contains('mday-dot') ||
          b.getBoundingClientRect().height <= 36))),
      await fold.evaluate(() => [...document.querySelectorAll('.mslot-h')]
        .map((h) => 'row ' + Math.round(h.getBoundingClientRect().height) + ' [' +
          [...h.querySelectorAll('button')].map((b) => b.textContent.trim().slice(0, 6) + ' ' +
            Math.round(b.getBoundingClientRect().height)).join(' | ') + ']').join('  ')));
    const shutBefore = await fold.evaluate(() =>
      document.querySelectorAll('.mslot-thin').length);
    await fold.click('.mslot-head[data-mfold]');
    await fold.waitForTimeout(300);
    /* The whole head is the door — the approved mockup's words.
     *
       The name was the only fold target and nobody could find it: 78x14 of
       uppercase text adrift in a 378x45 row. Probed at 60% ACROSS THE ROW,
       which is dead space at the old size and inside the head at the new one
       — measuring from the name's own box would land inside the button
       either way and pass against the bug, which is exactly what the first
       version of this test did. */
    const headGeo = await fold.evaluate(() => {
      const h = document.querySelector('.mslot .mslot-h').getBoundingClientRect();
      const b = document.querySelector('.mslot [data-mfold]').getBoundingClientRect();
      return { rowW: Math.round(h.width), headW: Math.round(b.width), headH: Math.round(b.height),
        x: h.left + h.width * 0.6, y: b.top + 12 };
    });
    t.ok('the head fills the row rather than sitting in it',
      headGeo.headW > headGeo.rowW * 0.7, JSON.stringify(headGeo));
    const thinWas = await fold.evaluate(() => document.querySelectorAll('.mslot-thin').length);
    await fold.mouse.click(headGeo.x, headGeo.y);
    await fold.waitForTimeout(350);
    t.ok('so a thumb landing well away from the word still works the fold',
      await fold.evaluate((n) => document.querySelectorAll('.mslot-thin').length !== n, thinWas),
      'thin lists ' + thinWas + ' -> ' +
        await fold.evaluate(() => document.querySelectorAll('.mslot-thin').length));

    /* The verbs read left to right, and only the plus pushes.
     *
       All three carried margin-left:auto from their years in the header,
       where the first of them shoved the cluster against the right edge. Flex
       hands every auto margin a share of the free space, so in the acts row
       Another and Balance were each given sixty-one pixels of nothing to
       their left and the row read as three buttons scattered across it. */
    const actsRow = await fold.evaluate(() => {
      const row = document.querySelector('.mslot-acts');
      if (!row) return null;
      const rb = row.getBoundingClientRect();
      const k = [...row.children].map((c) => {
        const r = c.getBoundingClientRect();
        return { t: c.getAttribute('aria-label') || c.textContent.replace(/\s+/g, ' ').trim(),
          add: c.classList.contains('add'),
          x: Math.round(r.x - rb.x), w: Math.round(r.width),
          right: Math.round(rb.right - r.right) };
      });
      const cs = getComputedStyle(row);
      return { pad: parseFloat(cs.paddingLeft), gap: parseFloat(cs.columnGap) || 0, kids: k };
    });
    t.ok('the first verb starts at the left edge of its row',
      !!actsRow && actsRow.kids[0].x <= actsRow.pad + 1, JSON.stringify(actsRow));
    /* Measured off the real boxes and the real gap, not off a guess at how
       wide nine characters are — the first version of this used a character
       count and passed with the bug still in, which the mutation caught. */
    /* The plus by what it is rather than by position or word: it spent a
       day third, ending the first of two rows, and has had no word since the
       verbs became drawings alone (2026-09-27). */
    t.ok('and the plus is the only one that pushes, to the right edge',
      !!actsRow &&
        actsRow.kids[1].x - (actsRow.kids[0].x + actsRow.kids[0].w) <= actsRow.gap + 1 &&
        actsRow.kids.filter((k) => k.add).length === 1 &&
        actsRow.kids.find((k) => k.add).right <= actsRow.pad + 1,
      JSON.stringify(actsRow));

    /* All of a meal's verbs on one row, on the narrowest phone in common
       use, each its drawing alone in a plate key's box. Blake (2026-09-27):
       "get all the buttons on the food tag into a single row", and then,
       after they had been an icon over a word a fifth of the row wide: "Just
       use icons and the box size that is in the meal/food card uses." Each
       still has a name a screen reader can say. */
    await fold.setViewportSize({ width: 360, height: 720 });
    await fold.waitForTimeout(150);
    const narrow = await fold.evaluate(() => {
      const key = document.querySelector('#macroSlots .mitem-r3 .mstep-keys button');
      const kb = key ? key.getBoundingClientRect() : null;
      return [...document.querySelectorAll('.mslot-acts')].map((row) => {
        const bs = [...row.querySelectorAll('button')];
        return {
          n: bs.length,
          rows: new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top))).size,
          worded: bs.filter((b) => b.textContent.trim()).length,
          unnamed: bs.filter((b) => !/\w/.test(b.getAttribute('aria-label') || '') || !b.querySelector('svg')).length,
          offKey: kb ? bs.filter((b) => { const r = b.getBoundingClientRect();
            return Math.abs(r.width - kb.width) > 1 || Math.abs(r.height - kb.height) > 1; }).length : -1,
        };
      });
    });
    t.ok('a meal\u2019s verbs are drawings on one row at 360px, each a plate key\u2019s size and named',
      narrow.length > 0 && narrow.some((r) => r.n >= 4) &&
        narrow.every((r) => r.rows === 1 && r.worded === 0 && r.unnamed === 0 && r.offKey === 0),
      JSON.stringify(narrow));
    await fold.setViewportSize({ width: 375, height: 720 });
    await fold.waitForTimeout(150);

    /* ---- the slack from a finished meal goes to the meals ahead ----------
     * A meal's denominator was a fixed slice of the day by weight: eat a
     * breakfast a thousand calories over and Lunch and Dinner went on asking
     * for 483 and 677 as though nothing had happened. The day strip knew; the
     * meals never found out, and Rebalance solved toward a plan the day could
     * no longer pay for.
     *
     * What is LEFT is the targets less what has actually been EATEN — not
     * less what is merely plated, because a dinner you have not had is a plan
     * and a plan cannot use up a day — split across the meals still to come
     * by the same weights the plan uses. A finished meal keeps its plan,
     * because "1,425 against a 387 plan" is the sentence you want tomorrow.
     *
     * Asserted as relationships, never as figures: the arithmetic is the
     * app's and a copied number would only pin today's food table. */
    const askPg = async (x) => {
      const pg = await t.fresh({ viewport: { width: 412, height: 915 } });
      await pg.click('.tab[data-view="macros"]');
      await pg.waitForTimeout(250);
      await pg.evaluate((mult) => {
        const big = window.RECIPES.filter((r) => r.macro && r.macro.kcal > 400)[0];
        const p2 = (n) => (n < 10 ? '0' : '') + n;
        const d = new Date();
        const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
        /* Food on every meal: an EMPTY meal draws its verdict chip instead of
           pills, so a day of empty meals has nothing here to read. */
        localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]:
          { b: [{ id: big.id, x: mult, eaten: 0 }],
            l: [{ id: big.id, x: 1, eaten: 0 }],
            d: [{ id: big.id, x: 1, eaten: 0 }],
            s: [{ id: big.id, x: 1, eaten: 0 }] } }));
      }, x);
      await pg.reload();
      await pg.waitForTimeout(400);
      await pg.click('.tab[data-view="macros"]');
      await pg.waitForTimeout(400);
      return pg;
    };
    const asked = (pg) => pg.evaluate(() => {
      const out = {};
      [...document.querySelectorAll('.mslot')].forEach((card) => {
        const nm = (card.querySelector('.mslot-name') || {}).textContent;
        if (!nm) return;
        out[nm] = [...card.querySelectorAll('.mmp')].map((e) => ({
          want: Number(e.dataset.want),
          spent: e.classList.contains('spent') }));
      });
      return out;
    });

    const overPg = await askPg(3);
    const beforeAte = await asked(overPg);
    /* Said against the plan itself rather than against the absence of a
       was-number, which is what this used to read and which is gone. Stronger
       for it: "nothing is marked as moved" is satisfied by an app that never
       marks anything, while this compares the figure on the card to the share
       the weights actually give it. */
    const plansNow = await overPg.evaluate(() => {
      const T = window.__macroLab.targets();
      const dayK = 4 * T.p + 4 * T.c + 9 * T.f;
      const list = JSON.parse(localStorage.getItem('bsc.macroSlots') || 'null');
      const ws = (list && list.list ? list.list : []).map((sl) => ({
        n: sl.n, w: typeof sl.w === 'number' ? sl.w : 20 }));
      const sum = ws.reduce((a, x) => a + x.w, 0) || 1;
      const out = {};
      ws.forEach((x) => { out[x.n] = Math.round(dayK * (x.w / sum)); });
      return out;
    });
    t.ok('before anything is eaten, every meal is asked for exactly its plan share',
      Object.keys(beforeAte).length > 2 &&
      Object.keys(plansNow).every((n) => !beforeAte[n] ||
        Math.abs(beforeAte[n][0].want - plansNow[n]) <= 2),
      JSON.stringify({ shown: beforeAte, share: plansNow }));

    /* Eat the oversized breakfast. */
    await overPg.evaluate(() => {
      const h = [...document.querySelectorAll('#macroSlots [data-mfold]')]
        .find((b) => ((b.querySelector('.mslot-name') || {}).textContent || '') === 'Breakfast');
      if (h && h.getAttribute('aria-expanded') === 'false') h.click();
    });
    await overPg.waitForTimeout(400);
    await overPg.evaluate(() => {
      /* The tick IS the checkbox now — it was an <input> nested inside a
         styled span, which drew a box around a box and, being 0x0, could
         not be clicked by a test either. A selector that finds nothing
         here does not fail: it silently eats nothing and the three
         cascade guards below go red for reasons that have nothing to do
         with the cascade. */
      const tick = document.querySelector('.mslot .mitem-ate');
      if (tick) tick.click();
    });
    await overPg.waitForTimeout(600);
    const afterAte = await asked(overPg);
    const lunch = afterAte.Lunch, brek = afterAte.Breakfast;
    /* Read across the pills, not off the first one. After a breakfast that
       size the day's calories and carbs are gone outright — those pills are
       spent and carry no plan to compare against — and the macro that still
       has something left is where the lowering is visible. */
    /* Lowered, or gone entirely. A breakfast this size does not just shrink
       the day, it spends it — and a pill the day cannot pay for is the most
       lowered a pill can be. */
    t.ok('eating a meal over its share lowers what the meals ahead are asked for',
      !!lunch && lunch.every((p2) => p2.spent || (p2.was !== null && p2.want < Number(p2.was))) &&
        lunch.some((p2) => p2.spent || p2.was !== null),
      JSON.stringify(lunch));
    /* And the plan is shown ONLY where it moved. A macro whose share came
       out the same — fat, here, because that breakfast was huge but lean —
       carries nothing, because repeating a number back to itself is noise on
       a row that has four of them. */
    /* The rule about never repeating a plan back to itself went with the
       was-numbers it was about — there is no second figure on a pill to
       repeat anything. What survives is the claim underneath it, and it is
       the one that matters: a meal already eaten is HISTORY, so the day
       moving does not move it. Read before and after rather than off the
       rendering. */
    t.ok('while the meal that was eaten keeps its own plan, being history',
      !!brek && !!beforeAte.Breakfast && brek.length === beforeAte.Breakfast.length &&
      brek.every((p2, i) => p2.want === beforeAte.Breakfast[i].want),
      JSON.stringify({ before: beforeAte.Breakfast, after: brek }));
    /* Carbs are gone for the day after that breakfast — and three meals
       printing 0/0 would be true and useless. */
    t.ok('a macro the day cannot pay for says so rather than showing a nought',
      !!lunch && lunch.some((p2) => p2.spent), JSON.stringify(lunch));
    await overPg.context().close();

    /* ---- a skipped meal hands its share over ------------------------------
     * The share is divided among the meals still in play, and a meal you have
     * said you are not eating is not one of them — which is the whole point of
     * the skip, and the same rule the plan already used. It has to hold here
     * too, or the day would go on reserving a quarter of itself for food that
     * is never coming. */
    const skipPg3 = await askPg(1);
    const lunchBefore = (await asked(skipPg3)).Lunch;
    /* Opened first: both the delete and the Skip live in the acts row at the
       foot of an OPEN meal, and one meal is open at a time now — so a folded
       Snacks has neither on the page to press. */
    await skipPg3.evaluate(() => {
      const h = [...document.querySelectorAll('#macroSlots [data-mfold]')]
        .find((b) => ((b.querySelector('.mslot-name') || {}).textContent || '') === 'Snacks');
      if (h && h.getAttribute('aria-expanded') === 'false') h.click();
    });
    await skipPg3.waitForTimeout(450);
    /* Empty it, then skip it — you do not skip a meal you have put food on,
       you delete the food. */
    await skipPg3.evaluate(() => {
      [...document.querySelectorAll('[data-mdel]')]
        .filter((d) => d.dataset.mdel.indexOf('s:') === 0).forEach((d) => d.click());
    });
    await skipPg3.waitForTimeout(450);
    await skipPg3.evaluate(() => {
      const b = document.querySelector('[data-mskip="s"]');
      if (b) b.click();
    });
    await skipPg3.waitForTimeout(550);
    const lunchAfter = (await asked(skipPg3)).Lunch;
    t.ok('skipping a meal raises what the meals still in play are asked for',
      !!lunchBefore && !!lunchAfter && lunchAfter[1].want > lunchBefore[1].want,
      JSON.stringify({ before: lunchBefore, after: lunchAfter }));
    await skipPg3.context().close();

    const underPg = await askPg(0.25);
    /* Read BEFORE, act, read AFTER — the way the skip test above does it.
       This used to compare a pill's want against the little was-number
       rendered beside it, which is gone: Blake, on his own day, "those little
       numbers under the pills? I don't know what they mean." Leaning on a
       rendering artifact for the 'before' also meant the test could only see
       what the renderer chose to admit. */
    const lightBefore = (await asked(underPg)).Lunch;
    await underPg.evaluate(() => {
      const h = [...document.querySelectorAll('#macroSlots [data-mfold]')]
        .find((b) => ((b.querySelector('.mslot-name') || {}).textContent || '') === 'Breakfast');
      if (h && h.getAttribute('aria-expanded') === 'false') h.click();
    });
    await underPg.waitForTimeout(400);
    await underPg.evaluate(() => {
      /* The tick IS the checkbox now — it was an <input> nested inside a
         styled span, which drew a box around a box and, being 0x0, could
         not be clicked by a test either. A selector that finds nothing
         here does not fail: it silently eats nothing and the three
         cascade guards below go red for reasons that have nothing to do
         with the cascade. */
      const tick = document.querySelector('.mslot .mitem-ate');
      if (tick) tick.click();
    });
    await underPg.waitForTimeout(600);
    const light = (await asked(underPg)).Lunch;
    /* Guarded on the plan being there at all. Number(null) is 0, so without
       it an app that had stopped redistributing entirely would satisfy
       "bigger than nothing" — which is exactly what it did the first time
       this was mutated. */
    /* Guarded on both readings existing. Number(null) is 0, so without it an
       app that had stopped redistributing entirely would satisfy "bigger than
       nothing" — which is exactly what it did the first time this was
       mutated. */
    t.ok('and leaving food on a plate raises what the meals ahead are asked for',
      !!lightBefore && !!light && lightBefore.length === light.length &&
      light.some(function (p2, i) { return p2.want > lightBefore[i].want; }),
      JSON.stringify({ before: lightBefore, after: light }));
    await underPg.context().close();

    /* ---- an empty meal offers the verb it has ----------------------------
     * Another means "not that one, what else" and Balance means "solve these
     * against each other". Neither is a question you have about a meal with
     * nothing on it, and drawn anyway they were two dead buttons on every
     * empty meal of every empty day. Skip is the verb that meal DOES have,
     * and it used to sit in the header wearing a ⊘ nobody reads as a word.
     *
     * Its own page, unfilled: the fold page above has food on every meal by
     * the time it gets here, which is the one state this cannot be asked in.
     */
    const emptyPg = await t.fresh({ viewport: { width: 412, height: 915 } });
    await emptyPg.click('.tab[data-view="macros"]');
    await emptyPg.waitForTimeout(300);
    const emptyVerbs = await emptyPg.evaluate(() => {
      const card = [...document.querySelectorAll('.mslot')]
        .find((c) => !c.querySelector('.mitem') && !c.querySelector('.mthin'));
      if (!card) return null;
      const row = card.querySelector('.mslot-acts');
      const rb = row ? row.getBoundingClientRect() : null, cs = row ? getComputedStyle(row) : null;
      return {
        /* By spoken name: the verbs are drawings alone. */
        verbs: row ? [...row.querySelectorAll('button')].map((b) => ({
          t: b.getAttribute('aria-label') || '', off: b.disabled, add: b.classList.contains('add'),
          w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height),
          right: Math.round(rb.right - b.getBoundingClientRect().right) })) : null,
        rowW: row ? Math.round(rb.width) : 0,
        pad: row ? parseFloat(cs.paddingRight) : 0,
        skipInHeader: !!card.querySelector('.mslot-h [data-mskip]'),
      };
    });
    /* Skip, "From another day" and Add (2026-09-27: a meal again, in one
       tap, is what an empty meal most wants). */
    t.ok('an empty meal offers Skip, not two verbs it cannot use',
      !!emptyVerbs && emptyVerbs.verbs.length === 3 &&
        /skip/i.test(emptyVerbs.verbs[0].t) && !emptyVerbs.verbs[0].off &&
        /* at the START of a name: Repeat's is "... from another day" */
        !emptyVerbs.verbs.some((v) => /^(another|balance)/i.test(v.t)),
      JSON.stringify(emptyVerbs));
    t.ok('and skip is no longer a glyph in the header',
      !!emptyVerbs && !emptyVerbs.skipInHeader, JSON.stringify(emptyVerbs));
    /* Small square keys, not slabs. Shared equally, the three were a third
       of the row each; Blake (2026-09-27): "The skip, repeat, add, buttons
       are way to big", and then "Just use icons and the box size that is in
       the meal/food card uses." One size, a plate key's (at most 36 on any
       pointer), with Add alone at the right edge, as on every meal. */
    t.ok('and each is a small square key, with Add alone at the right',
      !!emptyVerbs && emptyVerbs.verbs.every((v) => v.w === emptyVerbs.verbs[0].w && v.h === v.w && v.w <= 36) &&
        emptyVerbs.verbs[emptyVerbs.verbs.length - 1].add &&
        emptyVerbs.verbs[emptyVerbs.verbs.length - 1].right <= emptyVerbs.pad + 1,
      JSON.stringify(emptyVerbs));
    await emptyPg.context().close();

    /* One meal open at a time — the other half of the mockup's sentence. Six
       open meals is six screenfuls of steppers between you and the one you
       are filling, which is the thing the fold was for. */
    await fold.click('#macroOpenAll');
    await fold.waitForTimeout(300);
    const allOpen = await fold.evaluate(() =>
      document.querySelectorAll('#macroSlots [data-mfold][aria-expanded="true"]').length);
    t.ok('the bar can still open every meal at once, deliberately',
      allOpen > 1, String(allOpen));
    /* Shut everything from the bar first. The accordion only fires on the way
       OPEN — pressing a head while every meal is open just closes that one,
       which is what the first version of this test measured and why it read
       two meals open at the end. */
    if (allOpen > 0) { await fold.click('#macroOpenAll'); await fold.waitForTimeout(300); }
    t.ok('and shut every meal again',
      await fold.evaluate(() =>
        document.querySelectorAll('#macroSlots [data-mfold][aria-expanded="true"]').length === 0),
      String(await fold.evaluate(() =>
        document.querySelectorAll('#macroSlots [data-mfold][aria-expanded="true"]').length)));
    const openThe = (n) => fold.evaluate((i) => {
      const b = [...document.querySelectorAll('#macroSlots [data-mfold]')][i];
      if (b) b.click();
    }, n);
    await openThe(0);
    await fold.waitForTimeout(320);
    await openThe(1);
    await fold.waitForTimeout(320);
    const openNow = await fold.evaluate(() =>
      [...document.querySelectorAll('#macroSlots [data-mfold][aria-expanded="true"]')]
        .map((b) => (b.querySelector('.mslot-name') || {}).textContent));
    t.ok('but opening a meal by its head shuts the one that was open',
      openNow.length === 1, JSON.stringify(openNow));

    /* On THAT card. Opening a meal shuts the others now, so the number of
       thin lists on the day is not a count of what this press did. */
    t.ok('and pressing it folds that meal down to its list',
      await fold.evaluate(() => {
        const b = document.querySelector('.mslot-head[data-mfold]');
        return b.getAttribute('aria-expanded') === 'false' &&
          !!b.closest('.mslot').querySelector('.mslot-thin');
      }),
      'thin lists ' + shutBefore + ' → ' +
        await fold.evaluate(() => document.querySelectorAll('.mslot-thin').length));
    /* The chevron says which way the next press goes, in the direction the
       notification shade taught: DOWN on a shut meal means "this opens",
       UP on an open one means "this shuts". It used to point sideways when
       shut, which says neither — so this asserts the two states differ AND
       which one is which, not merely that something rotates. */
    const cue = await fold.evaluate(() => {
      const shut = document.querySelector('.mslot-head[aria-expanded="false"] .mfold-cue');
      const open = document.querySelector('.mslot-head[aria-expanded="true"] .mfold-cue');
      const box = shut && shut.getBoundingClientRect();
      return {
        shutTf: shut ? getComputedStyle(shut).transform : 'missing',
        openTf: open ? getComputedStyle(open).transform : 'missing',
        // a round chip, not a bare glyph: a real box with a full radius
        round: !!shut && parseFloat(getComputedStyle(shut).borderRadius) > 0
          && box.width > 14 && Math.abs(box.width - box.height) < 2,
      };
    });
    t.ok('a shut meal’s chevron points down, the way it does on the phone',
      cue.shutTf === 'none', 'shut transform ' + cue.shutTf);
    t.ok('and an open one is turned over to say the next press shuts it',
      cue.openTf !== 'none' && cue.openTf !== 'missing', 'open transform ' + cue.openTf);
    t.ok('and it wears a round chip rather than sitting there as a bare mark',
      cue.round, JSON.stringify(cue));
    /* Folded, each thing on the meal keeps its leaf as its bullet. Folding
       used to take the scores away with the plates, which meant the one screen
       where several meals get scanned at once was the screen with no quality
       on it at all. A food you entered yourself has no score and takes a plain
       mark in the same column, so nothing shifts left when one turns up. */
    await fold.evaluate(() => {
      const b = document.querySelector('.mslot-head[aria-expanded="true"]');
      if (b) b.click();
    });
    await fold.waitForTimeout(300);
    const bullets = await fold.evaluate(() => {
      const thin = [...document.querySelectorAll('.mthin')];
      return {
        rows: thin.length,
        marked: thin.filter((x) => x.querySelector('.leaf, .mthin-dot')).length,
        columns: new Set([...document.querySelectorAll('.mthin .leaf, .mthin .mthin-dot')]
          .map((x) => Math.round(x.getBoundingClientRect().left))).size,
        smaller: (() => {
          const f = document.querySelector('.mthin .leaf');
          const o = document.querySelector('.mitem .leaf');
          if (!f || !o) return true;
          return f.getBoundingClientRect().height < o.getBoundingClientRect().height;
        })()
      };
    });
    t.ok('a folded meal keeps a mark on every line it carries',
      bullets.rows > 0 && bullets.marked === bullets.rows, JSON.stringify(bullets));
    t.ok('and they line up in one column, score or no score',
      bullets.columns === 1, bullets.columns + ' columns');
    /* Smaller than an open plate's leaf, so a shut meal stays a list rather
       than becoming a second stack of cards. */
    t.ok('and are smaller than the leaf an open plate wears', bullets.smaller);
    /* Inverted, deliberately. The line used to sit ABOVE the meal's numbers,
       because the numbers were a strip of their own below the header and the
       line was the top of that strip. The numbers are inside the head now and
       the head is the door, so the line belongs under the whole thing: a door
       has one edge, not a crease across the middle of it. */
    t.ok('and the card\'s one line is under the whole head, not across it',
      await fold.evaluate(() => {
        const head = document.querySelector('.mslot-head');
        const list = document.querySelector('.mslot-items, .mslot-thin');
        return parseFloat(getComputedStyle(head).borderTopWidth) === 0 &&
          parseFloat(getComputedStyle(list).borderTopWidth) > 0;
      }),
      await fold.evaluate(() => 'head ' +
        getComputedStyle(document.querySelector('.mslot-head')).borderTopWidth + ', list ' +
        getComputedStyle(document.querySelector('.mslot-items, .mslot-thin')).borderTopWidth));

    /* A shut meal is still a list of food, and going to the recipe should not
       cost you opening the meal first. The name on a folded row is the same
       door the open plate's name is — same attributes, same delegated
       handler — so the only thing worth asserting is that it IS one and that
       pressing it lands on the recipe it names. */
    const door = await fold.evaluate(() => {
      const n = document.querySelector('.mslot-thin .mthin-n');
      if (!n) return null;
      return { tag: n.tagName, id: n.dataset.open || n.dataset.mfood || '',
        food: n.dataset.mfood !== undefined, name: n.textContent.trim() };
    });
    t.ok('a folded meal’s name is a door, not a label',
      !!door && door.tag === 'BUTTON' && door.id !== '', JSON.stringify(door));
    /* Recipes open the recipe sheet; a food you entered opens the food sheet.
       Whichever this row is, pressing it has to leave the day behind. */
    /* In the middle of the screen first: the bar is two rows since its
       tools took their words (2026-09-27), and at 375x720 with the readout
       open the first shut row sat under it. */
    await fold.evaluate(() => document.querySelector('.mslot-thin .mthin-n').scrollIntoView({ block: 'center' }));
    await fold.waitForTimeout(250);
    await fold.click('.mslot-thin .mthin-n');
    await fold.waitForTimeout(300);
    t.ok('and pressing it opens what it names, without opening the meal first',
      await fold.evaluate((d) => {
        const sheet = document.querySelector('.sheet, #modal:not(.hide)');
        if (!sheet) return false;
        // the thing that opened has to be the thing that was pressed
        return sheet.textContent.indexOf(d.name.slice(0, 12)) !== -1;
      }, door),
      await fold.evaluate(() => {
        const s = document.querySelector('.sheet, #modal:not(.hide)');
        return s ? s.textContent.trim().slice(0, 90) : 'no sheet opened';
      }));
    await fold.context().close();

    /* The three controls on a meal lost their boxes, which is the point — but
       a border is also how a control used to claim its size, and the reach has
       to survive the paint going away. So on a finger they are bigger than
       they ever were boxed, and this is the assertion that says so: the rule
       that grants it lives in a `pointer: coarse` block, and a rule in there
       is invisible to every test that forgets to bring a touchscreen. It went
       missing once already without anything going red. */
    const reachPage = await t.fresh({ viewport: { width: 390, height: 800 },
      hasTouch: true, isMobile: true });
    await reachPage.click('.tab[data-view="macros"]');
    await reachPage.waitForTimeout(200);
    await openPlan(reachPage);
    await reachPage.waitForTimeout(150);
    await reachPage.click('[data-mtarg="save"]');
    await reachPage.waitForTimeout(250);
    await reachPage.click('#macroFill');
    await reachPage.waitForTimeout(600);
    const reach = await reachPage.evaluate(() => {
      const box = (sel) => {
        const e = document.querySelector(sel);
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      };
      return { coarse: matchMedia('(pointer: coarse)').matches,
        add: box('.mslot-add'), retry: box('.mslot-try'), seam: box('.mslot-head'),
        /* a plate's own key, which the card's verbs are drawn the size of */
        key: box('#macroSlots .mitem-r3 .mstep-keys button'),
        /* The bar's own button, measured rather than written down. */
        bar: box('.mday-acts button:not(#macroFill)') };
    });
    /* Against the BAR, not against a number.
     *
       This used to read `h >= 30`, and the card's verbs are 29 now — Blake
       picked them off a mockup that showed them beside the bar they are
       matching, because the card and the bar were drawing the same three
       controls two different ways. A literal floor would have failed by one
       pixel and told us nothing; what the rule actually is, now, is "the same
       button in both places", and that is a claim that cannot drift. */
    /* Against a PLATE KEY now, on a finger. The bar's tools are an icon over
       a word and a thumb tall (Blake, 2026-09-27: "\u226544 px tap targets
       everywhere"); the card's verbs were too, until Blake: "The buttons are
       still to big to me. Just use icons and the box size that is in the
       meal/food card uses." So what they must match is the plate's key
       beside them, measured, and the bar keeps its 44. */
    t.ok('the card\u2019s verbs are a plate key\u2019s size on a finger, the bar\u2019s tools a thumb tall',
      reach.coarse && reach.add && reach.retry && reach.bar && reach.key &&
        Math.abs(reach.add.h - reach.key.h) <= 1 && Math.abs(reach.add.w - reach.key.w) <= 1 &&
        Math.abs(reach.retry.h - reach.key.h) <= 1 && reach.key.h >= 34 && reach.bar.h >= 44,
      JSON.stringify(reach));
    /* The head is the handle and stays a thumb's worth, whatever the verbs
       below it do — it is the control you press most and the one nobody could
       find when it was the width of a word. */
    t.ok('and the head is a thumb tall as well, being the handle',
      !!reach.seam && reach.seam.h >= 30, JSON.stringify(reach.seam));
    /* The plus says nothing to the eye but its shape, so it has to say the
       rest out loud — and it names the meal, which "+ Add" never did. */
    t.ok('the bare plus still tells a screen reader what it adds to',
      await reachPage.evaluate(() => [...document.querySelectorAll('.mslot-add')]
        .every((b) => /^Add food to .+/.test(b.getAttribute('aria-label') || ''))),
      await reachPage.evaluate(() => (document.querySelector('.mslot-add') || {})
        .getAttribute('aria-label')));
    await reachPage.context().close();
  },
});
