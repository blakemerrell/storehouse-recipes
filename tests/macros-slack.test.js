/* A week rather than one day seven times, salt in the arithmetic, the fold
 * on a meal, the slack from a finished meal going to the meals ahead, a
 * skipped meal handing its share over, and the verb an empty meal offers.
 *
 * Part of the Nourish suite, split out of tests/macros.test.js: the page
 * helpers and the plan every page starts with are in tests/fixtures/nourish.js. */
const { nourish, openPlan, openDay } = require('./fixtures/nourish.js');

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
    /* The meal as a card (Blake, 2026-10-04, "the RP Diet way"): on arrival
       every meal is folded to its day card, and every one of them — an empty
       one too — has the same door into it. This used to say only a meal with
       food on it carried a handle; an empty meal had no way to open because
       it had nothing to show, and now opening it is how you fill it. */
    t.ok('every meal arrives as a day card with its door, an empty one too, and no plate on the day',
      await fold.evaluate(() => [...document.querySelectorAll('#macroSlots .mslot')].every((s) =>
        s.classList.contains('mday-card') &&
        s.querySelectorAll('.mslot-head.mday-cardb[data-mfold][aria-expanded="false"]').length === 1)) &&
        await fold.evaluate(() => document.querySelectorAll('#macroSlots .mitem').length === 0),
      await fold.evaluate(() => [...document.querySelectorAll('.mslot')].map((s) =>
        (s.querySelector('.mslot-name') || {}).textContent + ':' + s.className +
        (s.querySelector('.mslot-head[data-mfold]') ? ' handle' : ' none')).join(' | ')));
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
       out there, and pressing the dot marks the meal eaten.
     *
       Since 2026-10-04 the day card holds no plate at all — the head is the
       whole card: the name, its pill of words, and the meal's own pills. */
    t.ok('and the handle is the head, carrying the meal’s own numbers',
      await fold.evaluate(() => {
        const b = document.querySelector('.mslot-head[data-mfold]');
        if (!b) return false;
        const row = b.closest('.mslot-h').getBoundingClientRect();
        const r = b.getBoundingClientRect();
        return r.width >= row.width * 0.7 && !!b.querySelector('.mcard-p .mmp') &&
          !!b.querySelector('.mslot-name') && !!b.querySelector('.mcard-pill') &&
          !b.closest('.mslot').querySelector('.mslot-items, .mitem');
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
    /* Nothing on the card wraps. Measured on the card's two lines rather than
       on the row: the day card (2026-10-04) is deliberately two lines tall —
       the name with its words, then the meal's pills — so "the row is one
       line high" stopped being the claim. What still is: the name and its
       pill share one line, the four pills share one more, and every control
       in the head row that is not the door or the dot stays key-sized. */
    t.ok('and no control on that row wraps onto a second line',
      await fold.evaluate(() => [...document.querySelectorAll('#macroSlots .mday-card')].every((c) => {
        const t2 = c.querySelector('.mcard-t'), nm = c.querySelector('.mslot-name'), pl = c.querySelector('.mcard-pill');
        const mids = [...c.querySelectorAll('.mcard-p .mmp')].map((m) => { const r = m.getBoundingClientRect(); return r.top + r.height / 2; });
        const nr = nm.getBoundingClientRect(), pr = pl.getBoundingClientRect();
        return !!t2 && t2.getBoundingClientRect().height <= 36 &&
          Math.abs((nr.top + nr.height / 2) - (pr.top + pr.height / 2)) <= 8 &&
          mids.length === 4 && Math.max(...mids) - Math.min(...mids) <= 8 &&
          [...c.querySelectorAll('.mslot-h button')].every((b) =>
            b.classList.contains('mslot-head') || b.classList.contains('mday-dot') ||
            b.getBoundingClientRect().height <= 36);
      })),
      await fold.evaluate(() => [...document.querySelectorAll('#macroSlots .mday-card')]
        .map((c) => 'line ' + Math.round(c.querySelector('.mcard-t').getBoundingClientRect().height) + ' pills [' +
          [...c.querySelectorAll('.mcard-p .mmp')].map((m) => Math.round(m.getBoundingClientRect().top)).join(',') + ']').join('  ')));
    const shutBefore = await fold.evaluate(() =>
      document.querySelectorAll('#macroSlots .mday-card').length);
    /* The whole head is the door — the approved mockup's words.
     *
       The name was the only fold target and nobody could find it: 78x14 of
       uppercase text adrift in a 378x45 row. Probed at 60% ACROSS THE ROW,
       which is dead space at the old size and inside the head at the new one
       — measuring from the name's own box would land inside the button
       either way and pass against the bug, which is exactly what the first
       version of this test did.
     *
       Measured on the DAY CARD now: since 2026-10-04 the open meal's head is
       a back arrow, a thumb square, and the wide door is the folded card's. */
    const headGeo = await fold.evaluate(() => {
      const h = document.querySelector('.mslot.mday-card .mslot-h').getBoundingClientRect();
      const b = document.querySelector('.mslot.mday-card [data-mfold]').getBoundingClientRect();
      return { rowW: Math.round(h.width), headW: Math.round(b.width), headH: Math.round(b.height),
        x: h.left + h.width * 0.6, y: b.top + 12 };
    });
    t.ok('the head fills the row rather than sitting in it',
      headGeo.headW > headGeo.rowW * 0.7, JSON.stringify(headGeo));
    await fold.mouse.click(headGeo.x, headGeo.y);
    await fold.waitForTimeout(350);
    const opened = await fold.evaluate(() => ({
      focus: document.getElementById('view-macros').classList.contains('m-focus'),
      screen: document.querySelectorAll('#macroSlots .mslot.mscreen.mscreen-focus').length,
      cards: document.querySelectorAll('#macroSlots .mday-card').length,
      /* the day steps aside: its header, the weigh-in, the bar, the other meals */
      shown: ['.mday-stick', '#macroWeigh', '.mday-acts'].filter((q) => {
        const e = document.querySelector(q); return e && getComputedStyle(e).display !== 'none'; })
        .concat([...document.querySelectorAll('#macroSlots .mslot:not(.mscreen-focus)')]
          .filter((e) => getComputedStyle(e).display !== 'none').map(() => 'another meal')),
    }));
    t.ok('so a thumb landing well away from the word still opens the meal, as its own screen',
      opened.focus && opened.screen === 1 && opened.cards === shutBefore - 1 && opened.shown.length === 0,
      JSON.stringify(opened));

    /* The open meal's head (2026-10-04): a back arrow at the left, the dot,
       the meal's name, then the scales and the ⋯ — and only those two push,
       together, to the right edge. This was "the verbs read left to right
       and only the plus pushes" about the acts row under an open meal; that
       row is gone, its verbs moved behind the ⋯ as words, and Add is the
       foot's line of its own. */
    const headRow = await fold.evaluate(() => {
      const h = document.querySelector('.mscreen-focus .mscreen-h');
      if (!h) return null;
      const rb = h.getBoundingClientRect(), cs = getComputedStyle(h);
      const k = [...h.children].map((c) => {
        const r = c.getBoundingClientRect();
        return { c: c.className.split(' ').slice(0, 2).join('.'), l: c.getAttribute('aria-label') || '',
          x: Math.round(r.x - rb.x), w: Math.round(r.width), h: Math.round(r.height),
          right: Math.round(rb.right - r.right) };
      });
      return { pad: parseFloat(cs.paddingLeft), padR: parseFloat(cs.paddingRight),
        gap: parseFloat(cs.columnGap) || 0, kids: k };
    });
    const backK = headRow && headRow.kids[0];
    t.ok('the open meal’s head starts with a back arrow, a thumb square, at its left edge',
      !!backK && /mscreen-back/.test(backK.c) && /^Back to the day/.test(backK.l) &&
        backK.w >= 44 && backK.h >= 44 && backK.x <= headRow.pad + 1 &&
        await fold.evaluate(() => { const b = document.querySelector('.mscreen-focus .mscreen-back');
          return !!b && b.getAttribute('aria-expanded') === 'true' && !!b.querySelector('svg') && !b.textContent.trim(); }),
      JSON.stringify(headRow));
    t.ok('and only the scales and the ⋯ push, together, to the right edge',
      !!headRow && headRow.kids.length === 5 &&
        /mslot-bal/.test(headRow.kids[3].c) && /mscreen-i/.test(headRow.kids[4].c) &&
        headRow.kids[4].x - (headRow.kids[3].x + headRow.kids[3].w) <= headRow.gap + 1 &&
        headRow.kids[4].right <= headRow.padR + 1 &&
        await fold.evaluate(() => { const a = document.querySelector('.mscreen-focus .mscreen-foot .mslot-add');
          const f = a && a.closest('.mscreen-foot');
          const cam = f && f.querySelector('[data-mscan]');
          /* Add is the foot's own line: everything the foot has but the camera */
          return !!a && !!cam && a.getBoundingClientRect().width >=
            f.getBoundingClientRect().width - cam.getBoundingClientRect().width - 48; }),
      JSON.stringify(headRow));

    /* On the narrowest phone in common use. Blake (2026-09-27): "get all the
       buttons on the food tag into a single row", and then "Just use icons".
       The head's controls are still drawings alone on one row, each named for
       a screen reader — and a thumb square now, the 44 floor. The verbs that
       moved behind the ⋯ (2026-10-04) are an icon WITH a word each, which is
       the new design's choice; they keep the thumb's height and stay inside
       their menu. */
    await fold.setViewportSize({ width: 360, height: 720 });
    await fold.waitForTimeout(150);
    await fold.click('.mscreen-focus [data-mmenu]');
    await fold.waitForTimeout(250);
    const narrow = await fold.evaluate(() => {
      const h = document.querySelector('.mscreen-focus .mscreen-h');
      const bs = [...h.querySelectorAll('button')];
      const menu = document.querySelector('.mscreen-focus .mscreen-menu');
      const mb = menu ? menu.getBoundingClientRect() : null;
      const ms = menu ? [...menu.querySelectorAll('button')] : [];
      return {
        n: bs.length,
        rows: new Set(bs.map((b) => { const r = b.getBoundingClientRect(); return Math.round((r.top + r.height / 2) / 8); })).size,
        worded: bs.filter((b) => b.textContent.trim()).length,
        unnamed: bs.filter((b) => !/\w/.test(b.getAttribute('aria-label') || '') ||
          (!b.classList.contains('mday-dot') && !b.querySelector('svg'))).length,
        offThumb: bs.filter((b) => { const r = b.getBoundingClientRect(); return r.width < 43 || r.height < 43; }).length,
        menu: ms.map((b) => { const r = b.getBoundingClientRect();
          return { t: b.textContent.trim(), h: Math.round(r.height), svg: !!b.querySelector('svg'),
            inside: r.left >= mb.left - 1 && r.right <= mb.right + 1 }; }),
      };
    });
    t.ok('a meal’s verbs are drawings on one row at 360px, each a thumb wide and named',
      narrow.n >= 4 && narrow.rows === 1 && narrow.worded === 0 && narrow.unnamed === 0 && narrow.offThumb === 0 &&
        narrow.menu.length >= 2 && narrow.menu.every((m) => m.t && m.svg && m.h >= 44 && m.inside),
      JSON.stringify(narrow));
    await fold.setViewportSize({ width: 375, height: 720 });
    await fold.waitForTimeout(150);
    /* The phone's back comes home to the day (the {mf:1} history entry). */
    await fold.goBack();
    await fold.waitForTimeout(350);
    t.ok('and the phone’s back gesture brings the day back, every meal a card again',
      await fold.evaluate(() => !document.getElementById('view-macros').classList.contains('m-focus') &&
        !document.querySelector('#macroSlots .mscreen') &&
        getComputedStyle(document.querySelector('.mday-acts')).display !== 'none'),
      await fold.evaluate(() => document.getElementById('view-macros').className + ' screens ' +
        document.querySelectorAll('#macroSlots .mscreen').length));

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
    /* The pills are on the DAY CARD since the RP-style day (2026-10-04) —
       the open meal shows capsules instead and no head pills — so the day is
       read folded, every meal a card, which is how it arrives. */
    const asked = async (pg) => { await pg.evaluate(() => {
      const b = document.querySelector('#macroSlots .mscreen-back');
      if (b) b.click();
    }); await pg.waitForTimeout(250); return pg.evaluate(() => {
      const out = {};
      [...document.querySelectorAll('.mslot.mday-card')].forEach((card) => {
        const nm = (card.querySelector('.mslot-name') || {}).textContent;
        if (!nm) return;
        out[nm] = [...card.querySelectorAll('.mcard-p .mmp')].map((e) => ({
          want: Number(e.dataset.want),
          spent: e.classList.contains('spent') }));
      });
      return out;
    }); };

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
    /* Eaten with the MEAL's tick: there is no per-plate tick since the
       RP-style day (Blake, 2026-10-04: "No individual foods ticks... I'll
       complete the whole meal"), and breakfast holds the one plate. A
       selector that finds nothing here does not fail: it silently eats
       nothing and the cascade guards below go red for reasons that have
       nothing to do with the cascade — so the tick is asserted pressed. */
    await overPg.click('#macroSlots [data-mdot="b"]');
    await overPg.waitForTimeout(600);
    t.ok('the meal tick ate the one plate on breakfast',
      await overPg.evaluate(() => document.querySelector('[data-mdot="b"]').getAttribute('aria-pressed') === 'true'),
      await overPg.evaluate(() => JSON.stringify(Object.values(JSON.parse(localStorage.getItem('bsc.macroDays')))[0].b)));
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
      /* Against the reading BEFORE breakfast was eaten: the was-number this
         compared with is gone from the pill, and `undefined !== null` let
         the old guard pass on nothing. No pill rises, and at least one is
         lowered or spent. */
      !!lunch && !!beforeAte.Lunch && lunch.length === beforeAte.Lunch.length && lunch.length > 0 &&
        lunch.every((p2, i) => p2.spent || p2.want <= beforeAte.Lunch[i].want) &&
        lunch.some((p2, i) => p2.spent || p2.want < beforeAte.Lunch[i].want),
      JSON.stringify({ before: beforeAte.Lunch, after: lunch }));
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
    /* Opened first: the delete is behind a food's ⋯ and the Skip behind the
       meal's ⋯ on the OPEN meal (2026-10-04), so a folded Snacks has neither
       on the page to press. */
    await skipPg3.evaluate(() => {
      const h = [...document.querySelectorAll('#macroSlots [data-mfold]')]
        .find((b) => ((b.querySelector('.mslot-name') || {}).textContent || '') === 'Snacks');
      if (h && h.getAttribute('aria-expanded') === 'false') h.click();
    });
    await skipPg3.waitForTimeout(450);
    /* Empty it, then skip it — you do not skip a meal you have put food on,
       you delete the food. */
    for (let i = 0; i < 6; i++) {
      const gone = await skipPg3.evaluate(() => {
        const m = document.querySelector('[data-mfmenu^="s:"]');
        if (!m) return true;
        if (m.getAttribute('aria-expanded') !== 'true') m.click();
        return false;
      });
      if (gone) break;
      await skipPg3.waitForTimeout(200);
      await skipPg3.evaluate(() => { const d = document.querySelector('[data-mdel^="s:"]'); if (d) d.click(); });
      await skipPg3.waitForTimeout(300);
    }
    await skipPg3.evaluate(() => {
      const m = document.querySelector('[data-mmenu="s"]');
      if (m && m.getAttribute('aria-expanded') !== 'true') m.click();
    });
    await skipPg3.waitForTimeout(250);
    await skipPg3.evaluate(() => {
      const b = document.querySelector('[data-mskip="s"]');
      if (b) b.click();
    });
    await skipPg3.waitForTimeout(550);
    t.ok('the empty snack was skipped from its meal menu',
      await skipPg3.evaluate(() => !!document.querySelector('#macroSlots .mslot-skipped')),
      await skipPg3.evaluate(() => [...document.querySelectorAll('#macroSlots .mslot')].map((x) => x.className).join(' | ')));
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
    /* Eaten with the MEAL's tick: there is no per-plate tick since the
       RP-style day (Blake, 2026-10-04: "No individual foods ticks... I'll
       complete the whole meal"), and breakfast holds the one plate. A
       selector that finds nothing here does not fail: it silently eats
       nothing and the cascade guard below goes red for reasons that have
       nothing to do with the cascade. */
    await underPg.click('#macroSlots [data-mdot="b"]');
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
    /* An empty meal opens like any other since the RP-style day (2026-10-04),
       and its verbs are behind the ⋯ on its head, so it is opened and the
       menu shown the way a thumb would before they are read. */
    await emptyPg.click('#macroSlots .mday-card [data-mfold]');
    await emptyPg.waitForTimeout(300);
    await emptyPg.click('.mscreen-focus [data-mmenu]');
    await emptyPg.waitForTimeout(250);
    const emptyVerbs = await emptyPg.evaluate(() => {
      const card = document.querySelector('#macroSlots .mscreen-focus');
      if (!card || card.querySelector('.mitem')) return null;
      const row = card.querySelector('.mslot-acts');
      return {
        /* By spoken name: the verbs carry a word now, but the name is the
           contract a screen reader hears. */
        verbs: row ? [...row.querySelectorAll('button')].map((b) => ({
          t: b.getAttribute('aria-label') || '', off: b.disabled, word: b.textContent.trim(),
          svg: !!b.querySelector('svg'),
          w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) })) : null,
        skipInHeader: !!card.querySelector('.mslot-h [data-mskip]'),
        scales: !!card.querySelector('[data-mbal]'),
        addLine: (() => { const a = card.querySelector('.mscreen-foot .mslot-add[data-mslot]');
          return a ? Math.round(a.getBoundingClientRect().width) : 0; })(),
      };
    });
    /* Skip, "From another day" and Add (2026-09-27: a meal again, in one
       tap, is what an empty meal most wants). */
    /* Add is the foot's own line on the open meal since 2026-10-04, and the
       scales are drawn only when there is something to balance. */
    t.ok('an empty meal offers Skip, not two verbs it cannot use',
      !!emptyVerbs && !!emptyVerbs.verbs && emptyVerbs.verbs.length === 2 &&
        /skip/i.test(emptyVerbs.verbs[0].t) && !emptyVerbs.verbs[0].off &&
        /* at the START of a name: Repeat's is "... from another day" */
        !emptyVerbs.verbs.some((v) => /^(another|balance)/i.test(v.t)) && !emptyVerbs.scales,
      JSON.stringify(emptyVerbs));
    t.ok('and skip is no longer a glyph in the header',
      !!emptyVerbs && !emptyVerbs.skipInHeader, JSON.stringify(emptyVerbs));
    /* This was "each is a small square key at the right" — Blake
       (2026-09-27): "Just use icons and the box size that is in the
       meal/food card uses." The RP-style meal (2026-10-04) moved them behind
       the ⋯ as an icon with a word each, a thumb tall; Add is the wide line
       at the foot. */
    t.ok('and each is an icon with its word, a thumb tall, with Add a line of its own',
      !!emptyVerbs && !!emptyVerbs.verbs && emptyVerbs.verbs.every((v) => v.svg && v.word && v.h >= 44) &&
        emptyVerbs.addLine > 200,
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
      allOpen > 1 && await fold.evaluate(() => !document.getElementById('view-macros').classList.contains('m-focus') &&
        [...document.querySelectorAll('#macroSlots .mscreen')].every((m) => getComputedStyle(m).display !== 'none')),
      String(allOpen));
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
      const b = [...document.querySelectorAll('#macroSlots .mslot')][i].querySelector('[data-mfold]');
      if (b) b.click();
    }, n);
    await openThe(0);
    await fold.waitForTimeout(320);
    await openThe(1);
    await fold.waitForTimeout(320);
    const openNow = await fold.evaluate(() =>
      [...document.querySelectorAll('#macroSlots [data-mfold][aria-expanded="true"]')]
        .map((b) => (b.closest('.mslot').querySelector('.mslot-name') || {}).textContent));
    t.ok('but opening a meal by its head shuts the one that was open',
      openNow.length === 1, JSON.stringify(openNow));

    /* On THAT card. Opening a meal shuts the others now, so the number of
       cards on the day is not a count of what this press did. The folded
       meal is its day card again (2026-10-04): no plates, the pill words. */
    t.ok('and pressing it folds that meal down to its card',
      await fold.evaluate(() => {
        const s0 = document.querySelectorAll('#macroSlots .mslot')[0];
        const b = s0.querySelector('.mslot-head[data-mfold]');
        return b.getAttribute('aria-expanded') === 'false' &&
          s0.classList.contains('mday-card') && !!b.querySelector('.mcard-pill') && !s0.querySelector('.mitem');
      }),
      'cards ' + shutBefore + ' → ' +
        await fold.evaluate(() => document.querySelectorAll('#macroSlots .mday-card').length));
    /* The chevron says which way the next press goes. On the meal as a card
       (2026-10-04) the next press goes INTO the meal, its own screen, so the
       shut card's chip points the way a list row's does — onward, unturned —
       and the open meal says "back" with an arrow at its left instead of a
       turned-over chevron. This was "points down when shut, turned over when
       open", the notification shade's grammar for an accordion that is no
       longer one. */
    const cue = await fold.evaluate(() => {
      const shut = document.querySelector('.mslot-head[aria-expanded="false"] .mfold-cue');
      const back = document.querySelector('.mslot-head[aria-expanded="true"]');
      return {
        shutTf: shut ? getComputedStyle(shut).transform : 'missing',
        shutGlyph: shut ? shut.textContent : '',
        back: back ? { cls: back.className, svg: !!back.querySelector('svg'), cue: !!back.querySelector('.mfold-cue'),
          l: back.getAttribute('aria-label') || '' } : null,
      };
    });
    t.ok('a shut meal’s chevron points onward, into the meal',
      cue.shutTf === 'none' && cue.shutGlyph === '›', JSON.stringify(cue));
    t.ok('and an open one says back with an arrow rather than a turned-over chevron',
      !!cue.back && /mscreen-back/.test(cue.back.cls) && cue.back.svg && !cue.back.cue && /^Back to the day/.test(cue.back.l),
      JSON.stringify(cue.back));
    await fold.evaluate(() => {
      const b = document.querySelector('.mslot-head[aria-expanded="true"]');
      if (b) b.click();
    });
    await fold.waitForTimeout(300);
    /* Measured back on the day: while a meal is its own screen the cards
       are not drawn, and a box of nothing is not a chip. */
    const cueBox = await fold.evaluate(() => {
      const shut = document.querySelector('.mslot-head[aria-expanded="false"] .mfold-cue');
      const box = shut && shut.getBoundingClientRect();
      // a round chip, not a bare glyph: a real box with a full radius
      return { round: !!shut && parseFloat(getComputedStyle(shut).borderRadius) > 0
        && box.width > 14 && Math.abs(box.width - box.height) < 2,
        w: box ? box.width : 0, h: box ? box.height : 0 };
    });
    t.ok('and it wears a round chip rather than sitting there as a bare mark',
      cueBox.round, JSON.stringify(cueBox));
    /* The folded list went with the meal card, and the food names with the
       RP-style day card (2026-10-04): shut, a meal says how many foods and
       how it stands in words, over its own pills. Leaves and names are on
       the open plates, and the name of each food is still a door. */
    const named = await fold.evaluate(() => [...document.querySelectorAll('#macroSlots .mday-card.filled')]
      .map((c) => ({ pill: (c.querySelector('.mcard-pill') || {}).textContent || '',
        pills: c.querySelectorAll('.mcard-p .mmp').length, names: !!c.querySelector('.mitem-name, .mcard-nm') })));
    t.ok('a folded meal says its count of foods and its standing in words, over its pills',
      named.length > 0 && named.every((c) => /^\d+ foods? · (Over targets|Under targets|Targets met|Eaten)$/.test(c.pill) &&
        c.pills === 4 && !c.names), JSON.stringify(named));
    await fold.evaluate(() => { const b = document.querySelector('.mslot-head[aria-expanded="false"]'); if (b) b.click(); });
    await fold.waitForTimeout(300);
    /* This was "the card's one line is under the whole head" — a rule
       between the head and the open card's list. The open meal (2026-10-04)
       is its own screen with no such line; what holds is that its plates
       start under its head rather than across it. */
    t.ok('and the open meal’s plates sit under its head, not across it',
      await fold.evaluate(() => {
        const head = document.querySelector('.mscreen-focus .mscreen-h');
        const list = document.querySelector('.mscreen-focus .mslot-items');
        return !!head && !!list && list.getBoundingClientRect().top >= head.getBoundingClientRect().bottom - 1;
      }),
      await fold.evaluate(() => { const h = document.querySelector('.mscreen-focus .mscreen-h'), l = document.querySelector('.mscreen-focus .mslot-items');
        return 'head ' + (h ? Math.round(h.getBoundingClientRect().bottom) : '-') + ', list ' + (l ? Math.round(l.getBoundingClientRect().top) : '-'); }));
    const door = await fold.evaluate(() => {
      const n = document.querySelector('.mscreen-focus .mfood .mitem-name');
      if (!n) return null;
      return { tag: n.tagName, id: n.dataset.open || n.dataset.mfood || '',
        food: n.dataset.mfood !== undefined, name: n.textContent.trim() };
    });
    t.ok('a food’s name is a door, not a label',
      !!door && door.tag === 'BUTTON' && door.id !== '', JSON.stringify(door));
    await fold.evaluate(() => document.querySelector('.mscreen-focus .mfood .mitem-name').scrollIntoView({ block: 'center' }));
    await fold.waitForTimeout(250);
    await fold.click('.mscreen-focus .mfood .mitem-name');
    await fold.waitForTimeout(300);
    t.ok('and pressing it opens what it names',
      await fold.evaluate((d) => {
        const sheet = document.querySelector('.sheet, #modal:not(.hide)');
        if (!sheet) return false;
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
    const box = (sel) => reachPage.evaluate((s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    }, sel);
    /* The bar's own button and the day card's door, measured on the day —
       the bar steps aside while a meal is open (2026-10-04). */
    const reach = { coarse: await reachPage.evaluate(() => matchMedia('(pointer: coarse)').matches),
      bar: await box('.mday-acts button:not(#macroFill)'), seam: await box('#macroSlots .mday-card .mslot-head') };
    await reachPage.click('#macroSlots .mday-card [data-mfold]');
    await reachPage.waitForTimeout(300);
    await reachPage.click('.mscreen-focus [data-mmenu]');
    await reachPage.waitForTimeout(250);
    Object.assign(reach, {
      add: await box('.mscreen-focus .mslot-add'), retry: await box('.mscreen-focus .mslot-try'),
      icon: await box('.mscreen-focus .mscreen-h [data-mmenu]'), back: await box('.mscreen-focus .mscreen-back'),
      /* a plate's own key */
      key: await box('.mscreen-focus .mfood-amt .mstep-keys button') });
    /* Against the BAR, not against a number — and then against a PLATE KEY
       (Blake, 2026-09-27: "Just use icons and the box size that is in the
       meal/food card uses").
     *
       The RP-style meal (2026-10-04): the head's icons are a thumb square,
       the verbs behind the ⋯ are an icon with a word and a thumb tall, Add
       is a wide line a thumb tall, and the plate's − and + are bigger still.
       Everything a finger presses on the meal is at the 44 floor now. */
    t.ok('the card’s verbs are a plate key’s size on a finger, the bar’s tools a thumb tall',
      reach.coarse && reach.add && reach.retry && reach.bar && reach.key && reach.icon &&
        reach.add.h >= 44 && reach.add.w > 200 &&
        reach.retry.h >= 44 && reach.icon.h >= 44 && reach.icon.w >= 44 &&
        reach.key.h >= 44 && reach.bar.h >= 44,
      JSON.stringify(reach));
    /* The head is the handle and stays a thumb's worth, whatever the verbs
       below it do — it is the control you press most and the one nobody could
       find when it was the width of a word. The way back out is a thumb
       square too. */
    t.ok('and the head is a thumb tall as well, being the handle',
      !!reach.seam && reach.seam.h >= 44 && !!reach.back && reach.back.h >= 44 && reach.back.w >= 44,
      JSON.stringify({ seam: reach.seam, back: reach.back }));
    /* The plus says nothing to the eye but its shape, so it has to say the
       rest out loud — and it names the meal, which "+ Add" never did. */
    t.ok('the bare plus still tells a screen reader what it adds to',
      await reachPage.evaluate(() => [...document.querySelectorAll('.mslot-add')].length > 0 &&
        [...document.querySelectorAll('.mslot-add')]
          .every((b) => /^Add food to .+/.test(b.getAttribute('aria-label') || ''))),
      await reachPage.evaluate(() => (document.querySelector('.mslot-add') || {})
        .getAttribute && document.querySelector('.mslot-add').getAttribute('aria-label')));
    await reachPage.context().close();
  },
});
