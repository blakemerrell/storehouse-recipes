/* The Macros tab: targets, the day, the picker, and the arithmetic between
 * them. Everything is asserted against window.RECIPES and the numbers the
 * page actually shows, never against counts or macros written down here —
 * the data is rebuilt too often for a copied answer to stay true. */

/* The way into the plan lives behind the morning card's press now that the
   weigh-in and the plan card are one card: on the face while there is no plan
   to adjust, folded away with the rest of the evidence once there is. Every
   test that used to reach straight for the button opens the card first, the
   way a thumb would. */
/* The morning card sits SHUT until a weight is entered — the trend, the week
   and the pace are evidence for a number, and before there is a number there
   is nothing for them to be evidence of. So anything reading .mw-verdict has
   to open the card first; it used to be on the face and is now behind the
   same handle the meals wear. */
async function openWeigh(pg) {
  if (await pg.$('.mw-verdict')) return;
  const h = await pg.$('.mday-weigh [data-mfold]');
  if (h) { await h.click(); await pg.waitForTimeout(250); }
}

async function openPlan(pg) {
  if (!await pg.$('#macroTargBtn')) {
    const handle = await pg.$('.mday-weigh [data-mfold]');
    if (handle) { await handle.click(); await pg.waitForTimeout(250); }
  }
  await pg.click('#macroTargBtn');
}

  /* The picker's resting list. It used to be reached by pressing one of three
     tiles — Scan / Look up / Recipes — each of which drew a whole different
     screen. Two of those are gone: one box on the resting screen does both
     jobs, so "go to the list" is now "make sure no chip is filtering it".
     Kept as a helper rather than deleted from twenty-four call sites, because
     every one of them means "get me to the list" and that is worth still
     being able to say. */
  /* Puts a RECIPE on the plate, not whatever row is first. The picker's list
     holds single foods beside dishes now, and a food plate is opened by a
     different attribute and has no entry in window.RECIPES — so tests that go
     on to read the recipe behind the plate have to ask for one. */
  /* Opens the basket on the bar. It is shut when a sheet opens — a basket you
     have not filled has nothing to say — and it holds the rows a test needs to
     count or click. The readout on the bar is the handle. */
  /* Opens the picker on the first meal.
   *
     The add button sits at the foot of the open meal now, and a card that
     happens to end near the bottom of a short screen leaves it under the
     pinned bar. A thumb just scrolls on; Playwright scrolls only far enough
     to touch the nearest edge, which is the edge the bar is on. Verified that
     every add button — the last meal's included — clears the bar at some
     scroll position, so this is the harness catching up with the layout, not
     a control a reader cannot reach. */
  async function addOn(pg) {
    /* The add button lives at the foot of the OPEN meal, so a folded one has
       none to press — which is the point of putting the verbs there, but it
       means a day that arrives folded gets opened first, the way a thumb
       would do it. */
    await pg.evaluate(() => {
      if (document.querySelector('.mslot-add')) return;
      const b = document.querySelector('#macroSlots [data-mfold][aria-expanded="false"]');
      if (b) b.click();
    });
    await pg.waitForTimeout(250);
    /* Centred, not "if needed". The minimal scroll is to the nearest edge,
       and on a short screen the nearest edge is the one the pinned bar sits
       on — so the button arrives in view and under the bar, and the click
       waits thirty seconds for a hit target that never comes. */
    await pg.evaluate(() => {
      const a = document.querySelector('.mslot-add');
      if (a) a.scrollIntoView({ block: 'center' });
    });
    await pg.waitForTimeout(200);
    await pg.click('.mslot-add');
  }

  async function openBasket(pg) {
    const t2 = await pg.$('[data-mpbasket]');
    if (!t2) return;
    if (await pg.evaluate(() => (document.querySelector('[data-mpbasket]') || {})
      .getAttribute('aria-expanded') === 'true')) return;
    await pg.click('[data-mpbasket]');
    await pg.waitForTimeout(250);
  }

  async function pickRecipe(pg) {
    await pg.evaluate(() => {
      const r = [...document.querySelectorAll('.mpick-row[data-mpx]')]
        .find((x) => !/^f:/.test(x.dataset.mpick));
      if (r) r.click();
    });
    await pg.waitForTimeout(200);
  }

  async function pickerList(pg) {
    await pg.evaluate(() => {
      const on = document.querySelector('.mp-shelf.on[data-mpshelf]');
      if (on && on.dataset.mpshelf) on.click();
    });
    await pg.waitForTimeout(200);
  }

module.exports = {
  name: 'Macros',
  async run(t) {
    /* Every page in this suite starts with a plan on it. A page without one no
       longer invents targets — the bars say "Craft your plan." and Fill is
       disabled — so a test that wants a working day has to set one, the way a
       user does. Wrapping t.fresh rather than editing thirty-nine call sites:
       the harness builds a new `t` per suite, so this reaches nothing else,
       and a scripted rename across that many lines is how test names have been
       corrupted here before.
     *
       The first-run tests take their page from bare(), which is the whole
       point of them — they are the ones asserting that an unplanned day says
       so. */
    const freshBare = t.fresh.bind(t);
    t.fresh = async (opts) => {
      const pg = await freshBare(opts);
      await pg.evaluate(() => localStorage.setItem('bsc.macroTargets',
        JSON.stringify({ p: 180, f: 50, c: 50 })));
      await pg.reload();
      await pg.evaluate(() => document.fonts.ready);
      return pg;
    };

    const p = await freshBare();

    // ---- the tab exists and swaps the view like the other five
    await p.click('.tab[data-view="macros"]');
    await p.waitForTimeout(150);
    t.ok('the Macros tab shows its view and hides the rest',
      await p.evaluate(() =>
        !document.getElementById('view-macros').classList.contains('hide') &&
        document.getElementById('view-browse').classList.contains('hide') &&
        document.querySelector('.tab[data-view="macros"]').getAttribute('aria-selected') === 'true'));

    t.ok('four meal slots on the day',
      await p.evaluate(() => document.querySelectorAll('.mslot').length) === 4);
    t.ok('the day selector starts on Today and holds the whole fortnight',
      await p.evaluate(() => {
        const s = document.getElementById('macroDaySel');
        // a fortnight behind and a week ahead: you can plan Thursday on Tuesday
        return /^Today ·/.test(s.options[s.selectedIndex].text) && s.options.length === 21 &&
          /^Tomorrow ·/.test(s.options[s.selectedIndex - 1].text);
      }));

    // the two morning verbs are the bar; everything else folded behind the ⋯
    t.ok('the day carries two buttons, not a row of five',
      await p.evaluate(() => {
        const a = document.querySelector('.mday-acts');
        return !!document.getElementById('macroFill') && !!document.getElementById('macroRebal') &&
          getComputedStyle(a).position === 'sticky' &&
          document.getElementById('macroMenu').classList.contains('hide');
      }));
    await p.click('#macroMore');
    await p.waitForTimeout(80);
    t.ok('and the gear opens where the day is set up',
      await p.evaluate(() => !document.getElementById('macroMenu').classList.contains('hide') &&
        document.getElementById('macroMore').getAttribute('aria-expanded') === 'true' &&
        [...document.querySelectorAll('#macroMenu [data-mmore]')].map((b) => b.dataset.mmore)
          .join() === 'plan,meals,you,went,help'));
    await p.click('.mday-rail');
    await p.waitForTimeout(80);
    t.ok('and a press anywhere else closes it',
      await p.evaluate(() => document.getElementById('macroMenu').classList.contains('hide')));

    // the tab explains itself by working, not by a paragraph about itself
    t.ok('no explainer paragraph rides along',
      await p.evaluate(() => !document.getElementById('macroNote') &&
        !document.getElementById('mdayTune')));

    // ---- a first run has no plan, then one that is set and its derived calories
    const defP = 180, defF = 50, defC = 50;
    const defKcal = 4 * defP + 4 * defC + 9 * defF;
    /* Meals arrive folded now, so anything reaching for a plate's own
       controls has to open the day first. Each press redraws, so they are
       opened one at a time. */
    /* One meal opens at a time now, so clicking each shut head in turn only
       walks the open one along the day. The bar's own control is how you have
       them all open at once — the deliberate override the accordion leaves
       standing. */
    const openDay = async (pg) => {
      for (let i = 0; i < 3; i++) {
        const shut = await pg.evaluate(() =>
          !!document.querySelector('#macroSlots [data-mfold][aria-expanded="false"]'));
        if (!shut) break;
        await pg.click('#macroOpenAll');
        await pg.waitForTimeout(200);
      }
    };
    const foot = () => p.textContent('#macroFoot');
    /* What used to be asserted here: "default targets are 180P / 50F / 50C".
       That triple was a placeholder, and this test was what held it in place.
       It rendered in exactly the shape a plan somebody made renders, so a
       first run opened on "No plan yet." above a full week of 1,370-kcal
       budgets belonging to nobody, four bars reading 0 / 180 g, and a Fill
       button ready to draft a real day against them. Both empty states were
       already written — the placeholder was the only reason neither fired. */
    t.ok('a first run says there is no plan rather than inventing one',
      /Craft your plan/.test(await foot()), await foot());
    t.ok('and Fill will not draft a day against a plan nobody set',
      await p.evaluate(() => document.getElementById('macroFill').disabled));
    t.ok('and no empty meal is handed a calorie budget of its own',
      await p.evaluate(() => !document.querySelector('#macroSlots [data-mv="empty"]')));

    // a plan that IS set reads back off the bars, calories derived not stored
    await p.evaluate((tg) => localStorage.setItem('bsc.macroTargets', JSON.stringify(tg)),
      { p: defP, f: defF, c: defC });
    await p.reload();
    await p.click('.tab[data-view="macros"]');
    await p.waitForTimeout(250);
    t.ok('a plan that is set shows its three targets on the bars',
      new RegExp('/ ' + defP + ' g').test(await foot()) &&
      new RegExp('/ ' + defF + ' g').test(await foot()) &&
      new RegExp('/ ' + defC + ' g').test(await foot()), await foot());
    t.ok('the calorie line is derived 4/4/9 from the targets',
      new RegExp('/ ' + defKcal + '(?!\\d)').test(await foot()), await foot());
    /* Four bars, one budget: calories are the fourth line of the same thing
       rather than a different chart in a different place. Each carries three
       bands — eaten, planned, and the hatched share of a meal still empty. */
    t.ok('the day is four bars, not three dials and a chart',
      await p.evaluate(() => {
        const rows = [...document.querySelectorAll('.mbars .mbrow')];
        return rows.length === 4 &&
          rows.map((r) => r.dataset.macro).join() === 'kcal,p,f,c' &&
          rows.every((r) => r.querySelector('.mb-ate') && r.querySelector('.mb-plan') &&
            r.querySelector('.mb-asm')) &&
          !document.querySelector('.mslot-left');
      }));
    /* A band, not a line. Two grams of fat past a sixty-one gram target is
       landing on it, not busting it — the old rule turned red on the first
       gram over and made a day that was fine look like a day that was not. */
    t.ok('a macro within ten grams of target reads as on it',
      await p.evaluate(() => {
        const st = (m, plan, target) => {
          const diff = plan - target, pct = 100 * plan / target;
          const near = m === 'kcal' ? Math.abs(diff) <= target * 0.03 : Math.abs(diff) <= 10;
          const overAt = m === 'p' ? 110 : m === 'kcal' ? 105 : 100;
          return near ? 'on' : pct > overAt ? 'over' : pct >= 90 ? 'on' : 'under';
        };
        return st('f', 63, 61) === 'on' &&        // two grams over is on target
          st('p', 213, 223) === 'on' &&           // ten under is on target
          st('kcal', 1783, 1709) === 'on' &&      // four per cent is rounding
          st('c', 83, 67) === 'over' &&           // a quarter over is not
          st('c', 40, 67) === 'under' &&
          st('kcal', 1900, 1709) === 'over';
      }));

    /* And a signed number for what is left, on the row it belongs to. It
       began as one line under the bars ("N g left" said four times in four
       places), then moved onto the rows so a row reads have / want / left
       without the eye hopping down to a legend. Fibre and sodium keep the
       line under the bars because they are a floor and a ceiling, not a
       budget with a "left". */
    t.ok('and each row says what is left of it, signed',
      await p.evaluate(() => {
        const c = [...document.querySelectorAll('.mbrow[data-macro] .mb-d')];
        return c.length === 4 && c.every((x) => /^[+-]?\d+$/.test(x.querySelector('b').textContent));
      }), await p.textContent('#macroFoot'));
    /* Bars now, under a hairline and on a lighter track than the four above:
       same family, lesser rank. What must never happen is the two being drawn
       like the macros, because a full bar means the opposite here — filling
       the protein bar is progress, filling the SALT bar is a warning. */
    t.ok('fibre and sodium sit under the bars as a floor and a ceiling',
      await p.evaluate(() => {
        const m = [...document.querySelectorAll('.mlimits .mlim')];
        return m.length === 2 && m.every((x) =>
          /\d+\/[\d,]+/.test(x.querySelector('.mb-num').textContent.replace(/\s/g, '')));
      }), await p.textContent('.mlimits'));
    t.ok('and they are quieter than the four, under a divider of their own',
      await p.evaluate(() => {
        const lim = document.querySelector('.mlimits');
        const thin = parseFloat(getComputedStyle(lim.querySelector('.mb-track')).height);
        const thick = parseFloat(getComputedStyle(
          document.querySelector('.mbrow[data-macro] .mb-track')).height);
        return thin < thick && parseFloat(getComputedStyle(lim).borderTopWidth) > 0;
      }));
    /* The colours invert here and the app must not forget it: there is no such
       thing as too much fibre on a cut, and being under a salt ceiling is the
       default rather than something to congratulate. */
    t.ok('fibre never turns red and salt never turns green',
      await p.evaluate(() => {
        const cls = (sel) => [...(document.querySelector(sel) || { classList: [] }).classList];
        const fib = cls('.mlimits .mlim:first-child');
        const na = cls('.mlimits .mlim:last-child');
        return fib.indexOf('past') < 0 && fib.indexOf('near') < 0 &&
          na.indexOf('met') < 0;
      }), await p.evaluate(() => [...document.querySelectorAll('.mlimits .mlim')]
        .map((x) => x.className).join(' | ')));

    /* Carb cycling. RP does not eat the same thing seven days a week: a
       training day earns more carbohydrate and a rest day gives it back, so
       the WEEK averages to the plan while the days differ. Derived from the
       workouts box, overridden by tapping a day. */
    t.ok('with no workouts named, every day asks for the same thing',
      await p.evaluate(() => {
        const k = [...document.querySelectorAll('.mwk-k')].map((e) => e.textContent);
        return k.length === 7 && new Set(k).size === 1;
      }), await p.textContent('.mweek'));
    await openPlan(p);
    await p.waitForTimeout(200);
    await p.fill('#mtWorkouts', '4');
    await p.click('[data-mtarg="save"]');
    await p.waitForTimeout(350);
    const cyc = await p.evaluate(() => ({
      week: [...document.querySelectorAll('.mwk-k')].map((e) => Number(e.textContent)),
      train: [...document.querySelectorAll('.mwk-d')].map((e) => e.classList.contains('train')),
      base: (() => {
        const t2 = JSON.parse(localStorage.getItem('bsc.macroTargets')) || { p: 180, f: 50, c: 50 };
        return 4 * t2.p + 4 * t2.c + 9 * t2.f;
      })(),
    }));
    t.ok('four workouts make four bigger days and three smaller ones',
      cyc.train.filter(Boolean).length === 4 &&
      new Set(cyc.week).size === 2 &&
      Math.max.apply(null, cyc.week) > cyc.base &&
      Math.min.apply(null, cyc.week) < cyc.base,
      cyc.week.join(',') + ' around ' + cyc.base);
    /* The whole point: the week still adds up to the plan. Rounding each of
       seven days to whole grams is allowed to drift a few calories. */
    t.ok('and the week still averages to the plan',
      Math.abs(cyc.week.reduce((a, b) => a + b, 0) - 7 * cyc.base) <= 20,
      cyc.week.reduce((a, b) => a + b, 0) + ' vs ' + 7 * cyc.base);
    // protein holds steady; the carbohydrate carries the swing
    t.ok('protein does not move with the cycle, carbs do',
      await p.evaluate(() => {
        const num = (m) => {
          const r = document.querySelector('.mbrow[data-macro="' + m + '"] .mb-num');
          return Number(r.textContent.split('/')[1].replace(/\D/g, ''));
        };
        const t2 = JSON.parse(localStorage.getItem('bsc.macroTargets')) || { p: 180, f: 50, c: 50 };
        return num('p') === t2.p && num('f') === t2.f && num('c') !== t2.c;
      }));
    // and a day can be flipped by hand without the workouts box undoing it
    await openPlan(p);
    await p.waitForTimeout(200);
    await p.click('[data-mtrain="1"]');
    await p.waitForTimeout(250);
    t.ok('tapping a day sets it, and the list is kept as its own',
      await p.evaluate(() =>
        JSON.parse(localStorage.getItem('bsc.macroProfile')).train.indexOf(1) >= 0));
    await p.click('[data-mtrain="1"]');
    await p.waitForTimeout(200);
    await p.click('.sheet-x');
    await p.waitForTimeout(250);

    /* Crafting a plan is a once-a-season job, so the daily screen carries
       what the plan is DOING rather than a button for making one. With no
       plan yet, that same line is the invitation — and it is on the FACE of
       the morning card, because a first morning that hides the way in behind
       a press is a first morning with nowhere to go. */
    await openWeigh(p);
    t.ok('with no plan, the line asks for one, out in the open',
      /No plan yet/.test(await p.textContent('.mw-verdict')) &&
      /Craft my plan/.test(await p.textContent('.mw-verdict')),
      await p.textContent('.mw-verdict'));

    /* The four presets are rates, the way RP frames a cut — a percent of
       bodyweight a week, not a percent off the day's burn — so each one
       lands where somebody who has used that app expects it to. */
    t.ok('the presets are rates, and land where a cut is expected to land',
      await p.evaluate(() => {
        localStorage.setItem('bsc.macroProfile', JSON.stringify({ sex: 'm', age: 43, ft: 5,
          inch: 11, lb: 205, act: 1.375, goal: 'cut2' }));
        return true;
      }));
    await p.reload();
    await p.waitForTimeout(300);
    await openPlan(p);
    await p.waitForTimeout(250);
    const kcalNow = () => p.evaluate(() => Number(document.getElementById('mtBigKcal').textContent));
    const RATE = { cut2: 0.010, cut1: 0.0075, keep: 0, gain: -0.0025 };
    for (const key of ['cut2', 'cut1', 'keep', 'gain']) {
      await p.evaluate(() => {
        if (document.getElementById('mtEditor').classList.contains('hide')) {
          document.querySelector('[data-mtedit]').click();
        }
      });
      await p.click('[data-mtgoal="' + key + '"]');
      await p.waitForTimeout(200);
      const want = await p.evaluate((r) => {
        /* The profile as the APP reads it: bodyweight comes off the scale
           now, and bsc.macroProfile holds only the fallback for a plan made
           before there was a log. Reading storage here tests a body the
           fixture may have spent thirty mornings losing. */
        const pr = window.__macroLab.profile();
        const kg = pr.lb * 0.45359237, cm = (pr.ft * 12 + pr.inch) * 2.54;
        const tdee = (10 * kg + 6.25 * cm - 5 * pr.age + 5) * pr.act;
        return Math.max(1500, Math.round(tdee - r * pr.lb * 3500 / 7));
      }, RATE[key]);
      /* Within a few kcal: the headline is the sum of the rounded gram
         boxes, not the raw target, which is the whole point of the boxes
         being the plan's one rendering. */
      t.ok('  ' + key + ' is the rate it claims', Math.abs(await kcalNow() - want) <= 8,
        await kcalNow() + ' vs ' + want);
    }
    t.ok('a hard cut lands where a hard cut is expected — near fifteen hundred',
      (await kcalNow()) > 0 && await p.evaluate(async () => {
        document.querySelector('[data-mtgoal="cut2"]').click();
        await new Promise((r) => setTimeout(r, 200));
        const k = Number(document.getElementById('mtBigKcal').textContent);
        return k >= 1400 && k <= 1600;
      }), await kcalNow());
    await p.click('.sheet-x');
    await p.waitForTimeout(250);
    await p.evaluate(() => localStorage.removeItem('bsc.macroProfile'));
    await p.reload();
    await p.waitForTimeout(300);

    /* A day rarely divides into six whole recipes. What fills the last two
       hundred calories is a spoon of honey or half a tin of tuna — and the
       food table those recipes are costed from was already in the browser
       with no door on it. */
    await p.click('[data-mslot="l"]');
    await pickerList(p);
    await p.waitForTimeout(250);
    /* The lens, not the rail. A macro chip narrows to things that are mostly
       that macro and then ranks them by FIT, so on a main meal a dish beats a
       spoonful and 🥩 gives ten recipes and one tin of tuna — the right answer
       to "what protein should I eat" and the wrong one to "show me the plain
       foods". That second question is about KIND, and the lens is where kind
       lives, beside "Every recipe".
     *
       I cut this option when the rail shipped, assuming the chips replaced
       it. They do not, and the failure looked like flakiness for three
       attempts before the app was asked what it was actually showing. */
    await p.selectOption('#mpSec', 'foods');
    await p.waitForTimeout(300);
    t.ok('the plain foods have a lens of their own',
      await p.evaluate(() => {
        const rows = [...document.querySelectorAll('#mpList .mpick-row[data-mpick]')];
        return rows.length >= 20 && rows.every((r) => r.dataset.mpick.indexOf('f:') === 0);
      }), await p.evaluate(() =>
        document.querySelectorAll('#mpList .mpick-row').length + ' rows'))
    t.ok('and each is offered in a unit a person would use',
      await p.evaluate(() => {
        const rows = [...document.querySelectorAll('#mpList .mpick-row[data-mpick]')];
        const txt = rows.map((r) => r.textContent).join(' ');
        // a cup of milk and a spoon of honey, not a spoon of milk or a cup of butter
        return rows.length > 0 && /cup|tbsp|each|oz|can/.test(txt);
      }));
    await p.selectOption('#mpSec', 'meal');
    await p.waitForTimeout(250);
    await p.fill('#mpFind', 'honey');
    await p.waitForTimeout(250);
    t.ok('and a search reaches them from any lens, since typing it says enough',
      await p.evaluate(() => {
        const rows = [...document.querySelectorAll('.mpick-row[data-mpick]')];
        return rows.some((r) => /honey/i.test(r.textContent));
      }));
    /* "Honey" also matches a recipe with honey in it, which is correct and
       not what we are after here. */
    const honeyRow = await p.evaluate(() => {
      const r = [...document.querySelectorAll('.mpick-row[data-mpick]')]
        .find((x) => x.dataset.mpick.indexOf('f:') === 0 && /honey/i.test(x.textContent));
      return r ? r.dataset.mpick : null;
    });
    t.ok('a food is addable like anything else', honeyRow && honeyRow.indexOf('f:') === 0, honeyRow);
    await p.evaluate(() => {
      [...document.querySelectorAll('.mpick-row[data-mpick]')]
        .find((x) => x.dataset.mpick.indexOf('f:') === 0 && /honey/i.test(x.textContent)).click();
    });
    await p.click('[data-mpdone]');
    await p.waitForTimeout(300);
    t.ok('and lands on the day carrying its own macros',
      await p.evaluate(() => {
        const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
        const day = days[Object.keys(days)[0]];
        return (day.l || []).some((it) => String(it.id).indexOf('f:') === 0);
      }));
    /* The unit sits on the stepper, beside the buttons that change it —
       "1 cup", not "×1". Where it came from stays a chip. */
    t.ok('with its unit named on the amount, and no recipe pretending to be behind it',
      await p.evaluate(() => {
        const el = document.querySelector('.mitem-food');
        if (!el || el.dataset.open) return false;
        const row = el.closest('.mitem');
        const chips = [...row.querySelectorAll('.mitem-chips .mchip')].map((c) => c.textContent);
        const amount = row.querySelector('.mstep-x').textContent;
        return chips.indexOf('Yours') >= 0 &&
          amount.indexOf('×') < 0 && /[a-z]/i.test(amount);
      }), await p.evaluate(() => {
        const el = document.querySelector('.mitem-food');
        if (!el) return 'no food row';
        const row = el.closest('.mitem');
        return row.querySelector('.mitem-chips').textContent + ' || amount "' +
          row.querySelector('.mstep-x').textContent + '"';
      }));
    /* The name is a door, though — the same door a recipe's name is. A food
       used to be a dead label, which left a five-part salad that had been
       kept together reading as one word with no way back to what was in it.
       Pressing it opens the food: what one of it is, and its parts. */
    await p.click('.mitem-food');
    await p.waitForTimeout(250);
    t.ok('pressing a food\'s name opens the food',
      await p.evaluate(() => {
        const sheet = document.querySelector('.mfs-name');
        return !!sheet && /honey/i.test(sheet.textContent) &&
          !!document.querySelector('.mfs-one') && !!document.querySelector('.mk-tot');
      }), await p.evaluate(() => (document.getElementById('modalRoot') || {}).textContent || ''));
    await p.keyboard.press('Escape');
    await p.waitForTimeout(200);
    t.ok('and Escape closes it like any other sheet',
      await p.evaluate(() => !document.querySelector('.mfs-name')));
    t.ok('while the collection itself is untouched — a spoon of honey is not a recipe',
      await p.evaluate(() => window.RECIPES.every((r) => String(r.id).indexOf('f:') !== 0)));
    await p.evaluate(() => {
      const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
      const day = days[Object.keys(days)[0]];
      day.l = [];
      localStorage.setItem('bsc.macroDays', JSON.stringify(days));
    });
    await p.reload();
    await p.waitForTimeout(300);

    /* ---- the basket ------------------------------------------------------
     * A meal assembled from parts — a scoop of whey, a splash of half and
     * half, a spoon of honey — used to cost one full trip through this sheet
     * per part, because picking anything closed it. */
    await p.click('[data-mslot="s"]');
    await pickerList(p);
    await p.waitForTimeout(250);
    /* Seen in the BASKET, not necessarily still in the list. A picked row can
       legitimately leave: the closers band is computed net of the basket, so
       the food that closed the meal stops being a closer the moment it goes
       in. The claim is that the sheet stays open and you can see what you
       took — which the basket panel answers whether or not the row survived
       its band. */
    t.ok('picking does not close the sheet, it fills a basket',
      await p.evaluate(async () => {
        const rows = [...document.querySelectorAll('.mpick-row[data-mpick]')];
        rows[0].click();
        await new Promise((r) => setTimeout(r, 150));
        /* Counted off the bar, which is where the basket lives now and is
           always on screen; the list of what is in it is behind the press. */
        return !!document.querySelector('.sheet') &&
          /\b1\b/.test((document.querySelector('[data-mpdone]') || {}).textContent || '') &&
          !!document.querySelector('[data-mpdone]');
      }));
    // each pick redraws the list, so every press has to find its row afresh
    /* Picked by taking whatever row is NOT yet in the basket, never by index:
       every pick re-ranks the bands, so the row that was third is not third
       afterwards — and a row that has entered the basket can leave the list
       entirely when the band it sat in is computed net of the basket. */
    t.ok('and several go in before anything is committed',
      await p.evaluate(async () => {
        for (let i = 0; i < 2; i++) {
          const row = [...document.querySelectorAll('.mpick-wrap:not(.in) .mpick-row[data-mpick]')][0];
          if (!row) break;
          row.click();
          await new Promise((r) => setTimeout(r, 160));
        }
        return /\b3\b/.test(document.querySelector('[data-mpdone]').textContent);
      }));
    // and the day has not been touched yet — nothing lands until the ✓
    t.ok('the day stays untouched until it is told to add them',
      await p.evaluate(() => {
        const days = JSON.parse(localStorage.getItem('bsc.macroDays') || '{}');
        const day = days[Object.keys(days)[0]] || {};
        return (day.s || []).length === 0;
      }));
    t.ok('the foot says what the basket will cost before it costs it',
      await p.evaluate(() => {
        const f = document.querySelector('.mp-foot');
        return !!f && /\d+ kcal/.test(f.textContent) && /\d+P/.test(f.textContent);
      }), await p.evaluate(() => (document.querySelector('.mp-foot') || {}).textContent));
    // pressed again, a row comes back out rather than doubling up
    /* Out through the basket's own control, which is the one that is always
       on screen: the list row it came from may have left with its band. */
    await openBasket(p);
    t.ok('a second press takes it back out',
      await p.evaluate(async () => {
        document.querySelector('.mpb-out').click();
        await new Promise((r) => setTimeout(r, 160));
        return document.querySelectorAll('.mpb-out').length === 2;
      }));
    /* A side trip to name something must not throw away what is already
       collected. The form draws over the picker rather than replacing it. */
    await p.click('[data-mpnew]');
    await p.waitForTimeout(250);
    t.ok('naming a new food draws over the picker rather than closing it',
      await p.evaluate(() => !!document.querySelector('#nfName')));
    await p.click('[data-nf="cancel"]');
    await p.waitForTimeout(250);
    t.ok('and backing out of it leaves the basket exactly as it was',
      await p.evaluate(() => document.querySelectorAll('.mpb-out').length === 2 &&
        /2/.test((document.querySelector('[data-mpdone]') || {}).textContent || '')));

    /* Read off the basket panel, which lists what is actually in it. The list
       rows are a view of the pool and a picked one can drop out of its band. */
    const basketWas = await p.evaluate(() =>
      [...document.querySelectorAll('.mpb-out')].map((r) => r.dataset.mpout));
    await p.click('[data-mpdone]');
    await p.waitForTimeout(300);
    t.ok('and the ✓ lands the whole basket on the meal at once',
      await p.evaluate((was) => {
        const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
        const day = days[Object.keys(days)[0]];
        const got = (day.s || []).map((i) => String(i.id));
        return got.length === was.length && was.every((id) => got.indexOf(id) >= 0) &&
          !document.querySelector('.sheet');
      }, basketWas), JSON.stringify(basketWas));
    /* A meal folds to what was on it. Today never folds itself — collapsing
       a meal the instant its last plate was ticked took the untick with it. */
    /* Found by its NAME inside the head, not by the head's whole text: the
       head carries the meal's pills now, so its textContent is the name and
       four sets of figures. And asserted on THAT card rather than on the
       absence of every thin list on the day — opening one meal shuts the
       others, so there is nearly always a thin list somewhere. */
    t.ok('a meal folds and unfolds by its head, and today starts open',
      await p.evaluate(async () => {
        const of = () => [...document.querySelectorAll('#macroSlots [data-mfold]')]
          .find((b) => ((b.querySelector('.mslot-name') || {}).textContent || '') === 'Snacks');
        if (!of() || of().getAttribute('aria-expanded') !== 'true') return false;
        of().click();
        await new Promise((r) => setTimeout(r, 150));
        const shut = of().getAttribute('aria-expanded') === 'false' &&
          !!of().closest('.mslot').querySelector('.mslot-thin .mthin-n');
        of().click();
        await new Promise((r) => setTimeout(r, 150));
        return shut && of().getAttribute('aria-expanded') === 'true' &&
          !of().closest('.mslot').querySelector('.mslot-thin');
      }));

    // and a fresh sheet starts empty rather than inheriting the last one
    await p.click('[data-mslot="l"]');
    await p.waitForTimeout(250);
    t.ok('the next meal opens with an empty basket',
      await p.evaluate(() => !document.querySelector('[data-mpdone]') &&
        !document.querySelector('.mpick-wrap.in')));
    await p.goBack();
    await p.waitForTimeout(250);
    await p.evaluate(() => {
      const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
      days[Object.keys(days)[0]].s = [];
      localStorage.setItem('bsc.macroDays', JSON.stringify(days));
    });
    await p.reload();
    await p.waitForTimeout(300);

    /* Food no book and no table has heard of — a tamale from a cart. The day
       has to add up, and a plate you cannot log is a plate that quietly makes
       every number on the screen wrong. */
    await p.click('[data-mslot="d"]');
    await pickerList(p);
    await p.waitForTimeout(250);
    t.ok('the picker offers a way to name something it has never heard of',
      await p.evaluate(() => {
        document.querySelector('#mpSec').value = 'foods';
        document.querySelector('#mpSec').dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }));
    await p.waitForTimeout(250);

    /* The three ways in are the sheet's first screen, and each one is one tap
       from + Add. Looking it up beats guessing, and neither host is touched
       until asked — a reader who never opens this box still fetches nothing. */
    await pickerList(p);
    await p.waitForTimeout(200);
    t.ok('Look up is one box, not a mode inside a mode',
      await p.evaluate(() => !!document.querySelector('#mpFind') &&
        !!document.querySelector('.mp-cam[data-mpmode="scan"]')));
    await p.click('[data-mpmode="scan"]');
    await p.waitForTimeout(200);
    t.ok('and Scan opens the lens with the typed number beside it',
      await p.evaluate(() => !!document.querySelector('#scanRoot') &&
        !!document.querySelector('[data-nf="code"]') && !!document.querySelector('#nfFind')));
    t.ok('and asking with an empty box says so rather than reaching out',
      await p.evaluate(async () => {
        document.querySelector('[data-nf="code"]').click();
        await new Promise((r) => setTimeout(r, 150));
        return /Type the number/.test(document.getElementById('nfResults').textContent) &&
          performance.getEntriesByType('resource')
            .every((e) => e.name.indexOf(location.origin) === 0);
      }));
    await p.click('[data-mpnew]');
    await p.waitForTimeout(250);
    /* Safari has no barcode reader and will not grow one, so the decoder is
       in here rather than on somebody's CDN. Proved against a barcode built
       to spec, at three sizes, which needs no camera and no luck. */
    t.ok('the app can read a barcode it has never seen, at any scale',
      await p.evaluate(() => {
        const L = ['0001101','0011001','0010011','0111101','0100011','0110001',
                   '0101111','0111011','0110111','0001011'];
        const G = ['0100111','0110011','0011011','0100001','0011101','0111001',
                   '0000101','0010001','0001001','0010111'];
        const PAT = ['000000','001011','001101','001110','010011','011001',
                     '011100','010101','010110','011010'];
        const code = '0038000138416';                 // a real UPC, checksum and all
        const d = code.split('').map(Number);
        let bits = '101';
        for (let i = 1; i <= 6; i++) bits += (PAT[d[0]][i - 1] === '0' ? L : G)[d[i]];
        bits += '01010';
        for (let i = 7; i < 13; i++) {
          bits += L[d[i]].split('').map((b) => (b === '1' ? '0' : '1')).join('');
        }
        bits += '101';
        return [2, 3, 5].every((scale) => {
          const row = [];
          for (let q = 0; q < 10 * scale; q++) row.push(255);
          for (const b of bits) for (let s2 = 0; s2 < scale; s2++) row.push(b === '1' ? 20 : 235);
          for (let q = 0; q < 10 * scale; q++) row.push(255);
          return window.__ean(row) === code;
        });
      }));
    t.ok('and a scrambled one is refused rather than guessed at',
      await p.evaluate(() => {
        const junk = [];
        for (let i = 0; i < 400; i++) junk.push(i % 7 < 3 ? 20 : 235);
        return window.__ean(junk) === null;
      }));
    t.ok('which asks what it is called and what is in it',
      await p.evaluate(() => !!document.querySelector('#nfName') &&
        !!document.querySelector('#nfKcal') && !!document.querySelector('#nfP')));
    await p.click('[data-nf="save"]');
    await p.waitForTimeout(200);
    t.ok('a nameless one is refused, since it could never be found again',
      /needs a name/i.test(await p.textContent('#nfNote')));
    await p.fill('#nfName', 'Chicken tamale');
    await p.fill('#nfUnit', 'tamale');
    await p.click('[data-nf="save"]');
    await p.waitForTimeout(200);
    t.ok('and one with no numbers at all is refused too',
      /at least the calories/i.test(await p.textContent('#nfNote')));
    /* Macros but no calories: the calories follow rather than leaving the
       day's headline short by a whole plate. */
    await p.fill('#nfP', '10');
    await p.fill('#nfF', '12');
    await p.fill('#nfC', '25');
    await p.click('[data-nf="save"]');
    await p.waitForTimeout(350);
    /* Named from inside the picker, so it joins the basket rather than the
       day — the picker is still open underneath, and anything already
       collected is still waiting in it. */
    // it lands in the basket card, which is visible whatever list you are in
    await openBasket(p);
    t.ok('a food named here joins the basket, not the day behind it',
      await p.evaluate(() => !!document.querySelector('.mp-basket .mpb-row') &&
        !!document.querySelector('[data-mpdone]') && !document.querySelector('#nfName')));
    await p.click('[data-mpdone]');
    await p.waitForTimeout(350);
    t.ok('it lands on the meal that asked for it',
      await p.evaluate(() => {
        const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
        const day = days[Object.keys(days)[0]];
        return (day.d || []).some((it) => String(it.id) === 'f:my:chicken_tamale');
      }));
    t.ok('with its calories worked out from the macros given',
      await p.evaluate(() => {
        const r = window.RECIPES.concat([]).length &&
          document.querySelector('.mitem-mac');
        const mine = JSON.parse(localStorage.getItem('bsc.myFoods'));
        return mine.chicken_tamale.kcal === 4 * 10 + 4 * 25 + 9 * 12;
      }), await p.evaluate(() => localStorage.getItem('bsc.myFoods')));
    t.ok('and it is there for next time, in its own words',
      await p.evaluate(() => {
        const el = [...document.querySelectorAll('.mitem-food')]
          .find((x) => /Chicken tamale/.test(x.textContent));
        // its own unit, on the amount where the buttons that change it are
        return !!el && /tamale/.test(el.closest('.mitem').querySelector('.mstep-x').textContent);
      }));
    await p.evaluate(() => {
      const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
      const day = days[Object.keys(days)[0]];
      day.d = [];
      localStorage.setItem('bsc.macroDays', JSON.stringify(days));
      localStorage.removeItem('bsc.myFoods');
    });
    await p.reload();
    await p.waitForTimeout(300);

    /* Steps and sessions were stored, printed back, and never added up —
       somebody asking what ten thousand steps buys was asking a question the
       app ignored. The day is built from its parts now, so they are levers. */
    await p.evaluate(() => {
      localStorage.setItem('bsc.macroProfile', JSON.stringify({ sex: 'm', age: 43, ft: 5,
        inch: 11, lb: 205, act: 1.375, goal: 'cut2', goalLb: 175, goalBy: '',
        workouts: 3, steps: 7000 }));
    });
    await p.reload();
    await p.waitForTimeout(300);
    await openPlan(p);
    await p.waitForTimeout(250);
    await p.evaluate(() => {
      if (document.getElementById('mtEditor').classList.contains('hide')) {
        document.querySelector('[data-mtedit]').click();
      }
    });
    await p.waitForTimeout(150);
    const coach = () => p.textContent('#mtCoach');
    t.ok('the day is shown in the parts you can move',
      /living/.test(await coach()) && /walking/.test(await coach()) &&
      /training/.test(await coach()), await coach());
    t.ok('and a pace with no date still says where it lands you',
      /Lands you|LANDS YOU/i.test(await coach()) && /at 175 lb around/.test(await coach()),
      await coach());
    t.ok('with each lever priced both ways — food now, or the date sooner',
      /to eat at the same pace/.test(await coach()) && /sooner/.test(await coach()),
      await coach());
    const before = await p.evaluate(() => Number(document.getElementById('mtBigKcal').textContent));
    await p.fill('#mtSteps', '13000');
    await p.waitForTimeout(250);
    t.ok('walking further really does buy more food at the same pace',
      await p.evaluate((b2) => Number(document.getElementById('mtBigKcal').textContent) > b2, before),
      before + ' → ' + await p.evaluate(() => document.getElementById('mtBigKcal').textContent));
    await p.fill('#mtSteps', '7000');
    await p.waitForTimeout(200);
    /* The panel describes a plan the boxes may not be showing, so it offers
       it rather than overwriting a day somebody meant. */
    t.ok('a plan the boxes are not showing is offered rather than forced',
      await p.evaluate(() => !!document.querySelector('[data-mtuse]')));
    await p.click('[data-mtuse]');
    await p.waitForTimeout(200);
    t.ok('and taking it fills the boxes with what the panel described',
      await p.evaluate(() => {
        const k = Number(document.getElementById('mtBigKcal').textContent);
        return k >= 1450 && k <= 1600 && !document.querySelector('[data-mtuse]');
      }), await p.evaluate(() => document.getElementById('mtBigKcal').textContent));
    await p.click('.sheet-x');
    await p.waitForTimeout(250);
    await p.evaluate(() => localStorage.removeItem('bsc.macroProfile'));
    await p.reload();
    await p.waitForTimeout(300);

    /* A day saved before the deficit was capped is still in storage being
       served every morning, and it can sit below what the body burns at
       rest. Reading it corrects it back up to what the same profile works
       out to now — and leaves a hand-typed, edible plan alone. */
    t.ok('a saved plan from before the caps is corrected on the way out of storage',
      await p.evaluate(() => {
        localStorage.setItem('bsc.macroProfile', JSON.stringify({ sex: 'm', age: 43, ft: 5,
          inch: 11, lb: 205, act: 1.375, goal: 'cut1', goalLb: 175, goalBy: '2026-12-01' }));
        localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 226, f: 62, c: 13 }));
        return true;
      }));
    await p.reload();
    await p.waitForTimeout(400);
    t.ok('so the day it serves clears the floor, with room left to eat',
      await p.evaluate(() => {
        const t2 = JSON.parse(localStorage.getItem('bsc.macroTargets'));
        const kc = 4 * t2.p + 4 * t2.c + 9 * t2.f;
        return kc >= 1500 && 4 * t2.c >= 0.14 * kc;
      }), await p.evaluate(() => localStorage.getItem('bsc.macroTargets')));
    await p.evaluate(() => {
      localStorage.removeItem('bsc.macroProfile');
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 150, f: 40, c: 60 }));
    });
    await p.reload();
    await p.waitForTimeout(300);
    t.ok('and a plan typed by hand, with no profile behind it, is left alone',
      await p.evaluate(() => localStorage.getItem('bsc.macroTargets').indexOf('150') >= 0));

    // ---- edit the targets; they hold across a reload
    await openPlan(p);
    await p.waitForTimeout(150);
    await p.fill('#mtP', '150');
    await p.fill('#mtF', '40');
    await p.fill('#mtC', '60');
    t.ok('the kcal line follows the boxes as they are typed',
      (await p.textContent('#mtKcal')).indexOf(String(4 * 150 + 4 * 60 + 9 * 40)) >= 0,
      await p.textContent('#mtKcal'));
    await p.click('[data-mtarg="save"]');
    await p.waitForTimeout(300);
    t.ok('saved targets land in the footer',
      /\/ 150 g/.test(await foot()) && /\/ 40 g/.test(await foot()) && /\/ 60 g/.test(await foot()),
      await foot());
    await p.reload();
    await p.waitForTimeout(300);
    t.ok('a refresh lands back on the tab you were on, not on Recipes',
      await p.evaluate(() => !document.getElementById('view-macros').classList.contains('hide') &&
        document.querySelector('.tab[data-view="macros"]').getAttribute('aria-selected') === 'true'));
    t.ok('targets survive a reload',
      /\/ 150 g/.test(await foot()), await foot());

    // ---- the picker: ranked rows, sane suggestions, protein at the top
    await p.click('[data-mslot="b"]');
    await pickerList(p);
    await p.waitForTimeout(200);
    t.ok('the picker sheet opens on the meal', !!(await p.$('#mpList')));
    /* Recipe rows only. The list is one list now and holds single foods
       beside dishes, so a lookup in window.RECIPES comes back undefined for
       "f:tuna" — and these four assertions are about the RECIPE ranking. Food
       ids carry a prefix; recipe ids are numbers. */
    const sanity = await p.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.mpick-row[data-mpx]'))
        .filter((r) => !/^f:/.test(r.dataset.mpick));
      const macsOf = (r) => window.RECIPES.find((x) => String(x.id) === r.dataset.mpick).macro;
      const ppk = (r) => { const m = macsOf(r); return m.kcal ? m.p / m.kcal : 0; };
      const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
      return {
        n: rows.length,
        maxX: Math.max.apply(null, rows.map((r) => Number(r.dataset.mpx))),
        top: mean(rows.slice(0, 5).map(ppk)),
        bottom: mean(rows.slice(-5).map(ppk)),
      };
    });
    t.ok('the picker has rows to rank', sanity.n > 5, sanity.n + ' rows');
    t.ok('and every row it can score wears its leaf',
      await p.evaluate(() => Array.from(document.querySelectorAll('.mpick-row[data-mpx]'))
        .filter((r) => !/^f:/.test(r.dataset.mpick))
        .every((row) => {
          const rec = window.RECIPES.find((x) => String(x.id) === row.dataset.mpick);
          return !rec || rec.score === null || !!row.querySelector('.leaf');
        })));
    t.ok('no suggested portion exceeds ×3', sanity.maxX <= 3, '×' + sanity.maxX);
    t.ok('the top of the ranking carries more protein per calorie than the bottom',
      sanity.top > sanity.bottom, sanity.top.toFixed(4) + ' vs ' + sanity.bottom.toFixed(4));

    // ---- the back gesture closes the sheet without leaving the app
    await p.goBack();
    await p.waitForTimeout(250);
    t.ok('back closes the picker and stays on the day',
      await p.evaluate(() => !document.querySelector('#mpList') &&
        !document.getElementById('view-macros').classList.contains('hide')));

    // ---- add the top suggestion; the footer moves by exactly x times the recipe
    await p.click('[data-mslot="b"]');
    await pickerList(p);
    await p.waitForTimeout(200);
    /* A RECIPE row, deliberately: everything below multiplies the recipe's own
       macros by the portion, and the list holds single foods beside dishes
       now, so taking the first row can hand back "f:tuna" and every lookup in
       window.RECIPES then comes back undefined. */
    const picked = await p.evaluate(() => {
      const r = [...document.querySelectorAll('.mpick-row[data-mpx]')]
        .find((x) => !/^f:/.test(x.dataset.mpick));
      return { id: r.dataset.mpick, x: Number(r.dataset.mpx) };
    });
    await p.evaluate((id) => {
      [...document.querySelectorAll('.mpick-row[data-mpx]')]
        .find((x) => x.dataset.mpick === id).click();
    }, picked.id);
    await p.waitForTimeout(200);
    await p.click('[data-mpdone]');
    await p.waitForTimeout(300);
    const shown = async () => {
      const f = await foot();
      const m = f.match(/(\d+) \/ 150 g/);
      return m ? Number(m[1]) : NaN;
    };
    const expectP = (x) => p.evaluate(([id, mult]) =>
      Math.round(window.RECIPES.find((r) => String(r.id) === id).macro.p * mult), [picked.id, x]);
    t.ok('one item on the breakfast slot',
      await p.evaluate(() => document.querySelectorAll('.mitem').length) === 1);
    t.ok('planned protein is the recipe times the suggested portion',
      (await shown()) === (await expectP(picked.x)),
      (await shown()) + ' shown, ' + (await expectP(picked.x)) + ' expected at ×' + picked.x);

    // ---- the stepper moves a quarter serving at a time and the totals follow
    await p.click('[data-mstep="b:0:up"]');
    await p.waitForTimeout(150);
    t.ok('a step up moves the planned grams by a quarter serving',
      (await shown()) === (await expectP(picked.x + 0.25)),
      (await shown()) + ' vs ' + (await expectP(picked.x + 0.25)));
    await p.click('[data-mstep="b:0:down"]');
    await p.waitForTimeout(150);
    for (let i = 0; i < 20; i++) await p.click('[data-mstep="b:0:down"]');
    await p.waitForTimeout(150);
    t.ok('the portion clamps at a quarter, not zero',
      (await p.textContent('.mstep-x')).indexOf('¼') >= 0, await p.textContent('.mstep-x'));
    t.ok('and the totals clamp with it',
      (await shown()) === (await expectP(0.25)),
      (await shown()) + ' vs ' + (await expectP(0.25)));

    // ---- eaten: the tick fills the bar and the line-through arrives
    t.ok('nothing is eaten yet, so the eaten sweep is empty',
      await p.evaluate(() => document.querySelector('.mbrow').dataset.eaten === '0'));
    t.ok('a planned but uneaten meal is still ahead of you on the rail',
      await p.evaluate(() => {
        const st = document.querySelector('#macroSlots .mday-stop.filled');
        return st && !st.classList.contains('done');
      }));
    await p.click('[data-meat="b:0"]');
    await p.waitForTimeout(150);
    t.ok('ticking a meal marks it eaten',
      await p.evaluate(() => !!document.querySelector('.mitem.eaten')));
    /* The point of running the day down a line is seeing what is behind
       you, and the dot is how it says so. */
    t.ok('and fills its dot on the rail',
      await p.evaluate(() => {
        const st = document.querySelector('.mitem.eaten').closest('.mday-stop');
        return st.classList.contains('done');
      }));
    t.ok('and the eaten sweep takes on a share of the dial',
      await p.evaluate(() => Number(document.querySelector('.mbrow').dataset.eaten) > 0));
    await p.click('[data-meat="b:0"]');
    await p.waitForTimeout(150);
    /* The dot said a meal was behind you but could never be told so, and no
       keyboard or screen reader knew it was there. Now it is the fastest way
       to say "ate all of that". */
    t.ok('the dot is a real control, named for what it does',
      await p.evaluate(() => {
        const b2 = document.querySelector('#macroSlots .mday-dot');
        return b2 && b2.tagName === 'BUTTON' && /Mark /.test(b2.getAttribute('aria-label'));
      }));
    await p.click('#macroSlots .mday-dot');
    await p.waitForTimeout(200);
    t.ok('pressing it eats the whole meal',
      await p.evaluate(() => {
        const st = document.querySelector('#macroSlots .mday-stop.filled');
        return st.classList.contains('done') &&
          Array.from(st.querySelectorAll('.mitem')).every((i) => i.classList.contains('eaten')) &&
          st.querySelector('.mday-dot').getAttribute('aria-pressed') === 'true';
      }));
    await p.click('#macroSlots .mday-dot');
    await p.waitForTimeout(200);
    t.ok('and pressing it again gives the meal back',
      await p.evaluate(() => {
        const st = document.querySelector('#macroSlots .mday-stop.filled');
        return !st.classList.contains('done') && !st.querySelector('.mitem.eaten');
      }));
    t.ok('an empty meal has nothing to press',
      await p.evaluate(() => Array.from(document.querySelectorAll('#macroSlots .mday-stop'))
        .every((st) => !!st.querySelector('.mitem') ||
          st.querySelector('.mday-dot').disabled)));
    t.ok('unticking reverses it, dot and all',
      await p.evaluate(() => !document.querySelector('.mitem.eaten') &&
        document.querySelector('.mbrow').dataset.eaten === '0' &&
        !document.querySelector('#macroSlots .mday-stop.done')));

    /* A day with every plate eaten is a finished day, and the week strip
       says so: the circle fills, tinted by where the day landed (under, on,
       over) rather than by the plain fact of eating. Today keeps its ink
       fill so the strip still says where you are, and wears its verdict as
       a ring instead — it is the day most often finished while you watch. */
    t.ok('a day is not done while a plate is still ahead of you',
      await p.evaluate(() => !document.querySelector('.mwk-d.now').classList.contains('done')));
    const ringBefore = await p.evaluate(() => getComputedStyle(document.querySelector('.mwk-d.now .mwk-n')).boxShadow);
    await p.click('#macroSlots .mday-dot');
    await p.waitForTimeout(200);
    t.ok('eating every plate marks the day done on the week strip',
      await p.evaluate(() => {
        const d = document.querySelector('.mwk-d.now');
        return d.classList.contains('done') &&
          ['under', 'on', 'over'].some((s) => d.classList.contains(s)) &&
          /all done/.test(d.getAttribute('aria-label'));
      }), await p.evaluate(() => document.querySelector('.mwk-d.now').outerHTML));
    t.ok('and today, done, looks different from today in progress',
      await p.evaluate((before) => {
        const n = document.querySelector('.mwk-d.now .mwk-n');
        const cs = getComputedStyle(n);
        return cs.boxShadow !== before && cs.boxShadow !== 'none';
      }, ringBefore), ringBefore);
    t.ok('an empty day is never done, whatever the strip says of it',
      await p.evaluate(() => [...document.querySelectorAll('.mwk-d:not(.now)')]
        .every((d) => !d.classList.contains('done'))));
    await p.click('#macroSlots .mday-dot');
    await p.waitForTimeout(200);
    t.ok('and giving the meal back takes the day off done',
      await p.evaluate(() => !document.querySelector('.mwk-d.now').classList.contains('done')));

    /* Whether a plate fits the day and whether it is worth eating are two
       questions, and the second used to need the recipe opened. */
    t.ok('a plate wears its nutrition score',
      await p.evaluate(() => {
        const lf = document.querySelector('.mitem .leaf');
        if (!lf) return false;
        const n = Number(lf.querySelector('.leaf-n').textContent);
        const day = JSON.parse(localStorage.getItem('bsc.macroDays'));
        const id = String(day[Object.keys(day)[0]].b[0].id);
        return n === window.RECIPES.find((r) => String(r.id) === id).score;
      }));
    t.ok('and the leaf says what it means, for anyone who cannot read the colour',
      await p.evaluate(() => /out of 100/.test(
        document.querySelector('.mitem .leaf').getAttribute('aria-label'))));

    // the name opens the recipe; the back gesture walks home to the day
    await p.click('.mitem-name');
    await p.waitForTimeout(250);
    t.ok('tapping the name opens the recipe itself',
      await p.evaluate(() => {
        const s = document.querySelector('.sheet-name');
        const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
        const day = days[Object.keys(days)[0]];
        const r = window.RECIPES.find((x) => String(x.id) === String(day.b[0].id));
        return !!s && s.textContent === r.name;
      }));
    await p.goBack();
    await p.waitForTimeout(250);
    t.ok('and back lands on the day, with nothing phantom-ticked',
      await p.evaluate(() => !document.querySelector('.sheet') &&
        !document.getElementById('view-macros').classList.contains('hide') &&
        !document.querySelector('.mitem.eaten')));

    // ---- over budget: shrink the targets under what is planned
    await openPlan(p);
    await p.waitForTimeout(150);
    await p.fill('#mtP', '1');
    await p.fill('#mtF', '1');
    await p.fill('#mtC', '1');
    await p.click('[data-mtarg="save"]');
    await p.waitForTimeout(300);
    // the bar carries the state, its own row's delta carries how far past you are
    t.ok('a busted macro says over, in the over state',
      await p.evaluate(() => {
        const over = document.querySelector('.mbrow.over');
        const past = !!over && /^\+\d+$/.test(over.querySelector('.mb-d.pos b').textContent);
        return !!over && past;
      }), await foot());
    /* Colour is the verdict, not the eating. A day 10 g past its protein
       target must not draw the same ring as one that landed on it — which
       is exactly what happened while green meant "eaten": both sweeps clamp
       at 100%, so over and on-the-nose were the same picture. */
    /* The four budget rows. The floor and the ceiling below them are bars
       too, but they are not budgets and carry no under/on/over — that is the
       whole point of them being drawn differently. */
    t.ok('every bar names where it stands',
      await p.evaluate(() => Array.from(document.querySelectorAll('.mbrow[data-macro]'))
        .every((d) => ['under', 'on', 'over'].indexOf(d.dataset.state) >= 0)));
    t.ok('and an overshoot reads over even with every plate eaten',
      await p.evaluate(() => {
        const d = document.querySelector('.mbrow.over');
        return d && d.dataset.state === 'over' && Number(d.dataset.planned) === 100;
      }));
    /* Protein is the one macro a cut wants overshot, so its band runs to
       110%; fat and carbs turn at the line. The fit scorer has always judged
       them that way and the dial must not contradict it. */
    t.ok('protein gets a wider band than fat and carbs',
      await p.evaluate(() => {
        const pctOf = (d) => {
          const m2 = d.querySelector('.mb-num').textContent.match(/(\d+) \/ (\d+)/);
          return 100 * Number(m2[1]) / Number(m2[2]);
        };
        return Array.from(document.querySelectorAll('.mbrow')).every((d) =>
          d.dataset.state !== 'over' ||
          // the shown figure is rounded, so a hair over the line reads as on it
          pctOf(d) >= (d.dataset.macro === 'p' ? 110 : d.dataset.macro === 'kcal' ? 105 : 100));
      }));
    t.ok('the bar caps at full rather than running past its own end',
      await p.evaluate(() => Array.from(document.querySelectorAll('.mbrow[data-macro]'))
        .every((d) => Number(d.dataset.planned) <= 100 && Number(d.dataset.eaten) <= 100)));
    await openPlan(p);
    await p.waitForTimeout(150);
    await p.fill('#mtP', '150');
    await p.fill('#mtF', '40');
    await p.fill('#mtC', '60');
    await p.click('[data-mtarg="save"]');
    await p.waitForTimeout(300);

    // ---- the estimate tilde follows estimated recipes and only those
    const estName = await p.evaluate(() =>
      window.RECIPES.find((r) => r.est && r.macro && r.macro.p + r.macro.c + r.macro.f > 0).name);
    await p.click('[data-mslot="l"]');
    await pickerList(p);
    await p.waitForTimeout(200);
    await p.selectOption('#mpSec', 'all');
    await p.waitForTimeout(150);
    await p.fill('#mpFind', estName);
    await p.waitForTimeout(200);
    await p.click('.mpick-row[data-mpick]');
    await p.click('[data-mpdone]');
    await p.waitForTimeout(300);
    /* Reversed on purpose. A plate used to wear "~ estimated" and its macro
       line a leading tilde — but two thirds of the book is estimated from
       the food table rather than a label, so the mark was on most rows most
       of the time. A hedge that is always on is not a hedge; it is noise
       taking the width the numbers needed, and with it gone the four figures
       sit on the tag row instead of wrapping under it.

       Blake's call, in his words: "our food estimates just need to be
       reliable". The `est` field is still on the record — only the apology
       is gone — so nothing here stops it being said again somewhere it
       would mean something. */
    t.ok('the numbers do not apologise for themselves',
      await p.evaluate(() =>
        !document.querySelector('#view-macros .mchip[class]:not([hidden])') ||
        (!Array.from(document.querySelectorAll('#view-macros .mchip'))
          .some((el) => /estimated/i.test(el.textContent)) &&
         !Array.from(document.querySelectorAll('.mitem-mac'))
          .some((el) => el.textContent.trim().indexOf('~') === 0))),
      await p.evaluate(() => Array.from(document.querySelectorAll('#view-macros .mchip'))
        .map((e) => e.textContent.trim()).join(' | ')));

    /* And the four numbers made it onto the tag row, which is the point of
       having removed it. */
    t.ok('and the macros sit on the tag row rather than wrapping under it',
      await p.evaluate(() => {
        const wrap = document.querySelector('.mitem-chips');
        const chip = wrap && wrap.querySelector('.mchip');
        const mac = document.querySelector('.mitem-mac');
        if (!chip || !mac) return false;
        /* a plate carrying a salt warning is allowed its second line — the
           warning is worth more than the tidiness */
        if (wrap.querySelector('.mchip.salty')) return true;
        return Math.abs(chip.getBoundingClientRect().top -
          mac.getBoundingClientRect().top) < 6;
      }));
    // the tilde carries it on the plate itself; the footnote under the day was
    // one more line of the app talking about itself
    t.ok('and says so on the plate rather than in a footnote',
      await p.evaluate(() => !document.querySelector('.macro-est')));
    /* This used to read "while the authored recipe shows none", and it
       contradicted the assertion directly above it: that one says the tilde
       was removed from every row, this one said an `est` row still wears one.
       It only ever passed down its other branch, because Volume One's
       recipes were est:false and so took the "no tilde" path — the est half
       of it had been dead since the tilde came off.

       Both halves are now the same half. Every recipe is computed from its
       ingredients, so `est` is true everywhere and there is no "authored
       recipe" left to contrast with. What survives is the claim that
       actually holds: no row apologises, whatever it was built from. */
    t.ok('and no row apologises, whatever its numbers were built from',
      await p.evaluate(() => {
        const macs = Array.from(document.querySelectorAll('.mitem-mac'));
        if (!macs.length) return true;   // one-plate meal: the seam says it instead
        return macs.every((el) => el.textContent.trim().indexOf('~') !== 0);
      }),
      await p.evaluate(() => Array.from(document.querySelectorAll('.mitem-mac'))
        .map((e) => e.textContent.trim()).join(' | ')));

    /* The portion and the calories beside it are two readings of the same
       number, and for years they disagreed: the calories charged for x
       servings while the words next to them announced x × the recipe's whole
       yield, so 1¾ of a six-bite batch read as "10½ servings". Nothing pinned
       the two to each other, which is how a six-fold overstatement sat on the
       card without a red test. This is that pin. */
    const portions = await p.evaluate(() => {
      const FR = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3,
        '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };
      const count = (txt) => {
        const m = txt.trim().match(/^(\d+)?\s*([½¼¾⅓⅔⅛⅜⅝⅞])?/);
        if (!m || (!m[1] && !m[2])) return null;
        return (m[1] ? parseInt(m[1], 10) : 0) + (m[2] ? FR[m[2]] : 0);
      };
      const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
      const day = days[Object.keys(days)[0]];
      const out = [];
      document.querySelectorAll('.mitem').forEach((row) => {
        const box = row.querySelector('[data-meat]');
        if (!box) return;
        const parts = box.dataset.meat.split(':');
        const it = (day[parts[0]] || [])[+parts[1]];
        if (!it) return;
        const r = window.RECIPES.find((q) => String(q.id) === String(it.id));
        if (!r || !r.macro) return;                       // a food, priced elsewhere
        out.push({
          name: r.name, x: it.x, servN: r.servN || 1,
          shown: count(row.querySelector('.mstep-x').textContent),
          words: row.querySelector('.mstep-x').textContent.trim(),
          kcalShown: row.querySelector('.mitem-mac')
            ? parseInt(row.querySelector('.mitem-mac').textContent.replace(/[^\d]/, ''), 10)
            : null,
          kcalWant: Math.round(r.macro.kcal * it.x)
        });
      });
      return out;
    });
    const mismatched = portions.filter((q) => Math.abs(q.shown - q.x) > 0.001);
    t.ok('the portion on a plate is the portion its calories were charged for',
      portions.length > 0 && mismatched.length === 0,
      mismatched.length
        ? mismatched.map((q) => q.name + ': says "' + q.words + '", eating ' + q.x).join(' | ')
        : portions.length + ' plates checked');
    t.ok('and the calories beside it are that portion priced',
      portions.length > 0 && portions.every((q) => Math.abs(q.kcalShown - q.kcalWant) <= 1),
      portions.map((q) => q.name + ' ' + q.kcalShown + '/' + q.kcalWant).join(' | '));

    // ---- the day is stored under the LOCAL date and survives a reload
    const stored = await p.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const key = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
      return { keys: Object.keys(days), local: key, items: days[key] ? days[key].b.length + days[key].l.length : -1 };
    });
    t.ok('the day is keyed by the local calendar date',
      stored.keys.length === 1 && stored.keys[0] === stored.local, stored.keys.join(','));
    t.ok('both meals are in it', stored.items === 2, String(stored.items));
    await p.reload();
    await p.waitForTimeout(300);
    await p.click('.tab[data-view="macros"]');
    await p.waitForTimeout(150);
    // a reloaded day arrives folded; the plates are there behind the fold
    t.ok('the day survives a reload, folded',
      await p.evaluate(() => document.querySelectorAll('.mslot-thin .mthin').length) === 2);
    await openDay(p);
    t.ok('and opening it shows both plates with their controls',
      await p.evaluate(() => document.querySelectorAll('.mitem').length) === 2);

    // ---- days older than the window are pruned on the next write
    await p.evaluate(() => {
      const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
      days['2020-01-01'] = { b: [{ id: window.RECIPES[0].id, x: 1, eaten: 0 }], l: [], d: [], s: [] };
      localStorage.setItem('bsc.macroDays', JSON.stringify(days));
    });
    await p.reload();                       // the app reads days once, at boot
    await p.waitForTimeout(300);
    await p.click('.tab[data-view="macros"]');
    await p.waitForTimeout(150);
    await openDay(p);
    await p.click('[data-meat="b:0"]');     // any write prunes
    await p.waitForTimeout(200);
    t.ok('a stale day is gone after the next write, today kept',
      await p.evaluate(() => {
        const keys = Object.keys(JSON.parse(localStorage.getItem('bsc.macroDays')));
        return keys.indexOf('2020-01-01') < 0 && keys.length === 1;
      }));

    // ---- personal means personal: nothing macro rides in the household state
    t.ok('the synced Store carries no macro data',
      await p.evaluate(() => {
        const s = JSON.stringify(Object.keys(window.Store.state));
        return s.indexOf('macro') < 0;
      }));

    await p.context().close();

    /* ---- the plan calculator, favorites, and Fill my day ------------------
     * A second fresh page: this chapter is about deriving the targets and
     * drafting the day, and it must not inherit the hand-made day above. */
    const q = await t.fresh();
    await q.click('.tab[data-view="macros"]');
    await q.waitForTimeout(150);

    await openPlan(q);
    await q.waitForTimeout(200);
    t.ok('an empty profile asks for the numbers rather than inventing a plan',
      /fill in who you are/i.test(await q.textContent('#mtPlan')),
      await q.textContent('#mtPlan'));

    /* The same arithmetic the app claims: Mifflin–St Jeor for the basal rate,
       an activity multiplier for the day, and then a RATE — a cut is a pound
       a week per hundred of bodyweight, the way RP frames it, not a flat
       percentage off the day. A percentage scales wrong: the same quarter
       off gives a big man a comfortable day and a small woman a dangerous
       one. */
    const prof = { lb: 200, ftIn: 72, age: 40, act: 1.55 };
    const bmr = 10 * (prof.lb * 0.45359237) + 6.25 * (prof.ftIn * 2.54) - 5 * prof.age + 5;
    const tdee = bmr * prof.act;
    const perWeek = 0.01 * prof.lb;                          // hard cut = 1%/wk
    const kcal = Math.max(1500, Math.round(tdee - perWeek * 3500 / 7));
    let planP = Math.round(1.10 * prof.lb);
    const planF = Math.round(Math.max(0.3 * prof.lb, 0.25 * kcal / 9));
    const minC = Math.round(0.15 * kcal / 4);
    if ((kcal - 4 * planP - 9 * planF) / 4 < minC) {
      planP = Math.max(Math.round(0.8 * prof.lb),
        Math.round((kcal - 9 * planF - 4 * minC) / 4));
    }
    const planC = Math.max(0, Math.round((kcal - 4 * planP - 9 * planF) / 4));

    await q.fill('#mtAge', String(prof.age));
    await q.fill('#mtFt', '6');
    await q.fill('#mtIn', '0');
    await q.fill('#mtLb', String(prof.lb));
    await q.selectOption('#mtAct', '1.55');
    await q.click('[data-mtgoal="cut2"]');
    await q.waitForTimeout(150);
    /* The boxes are the plan's one rendering now — the old separate preview
       line could disagree with them by a rounding kcal, and did. A complete
       profile leaves the status line silent and the kcal readout summing the
       boxes themselves. */
    t.ok('a complete profile leaves the status line with nothing to say',
      (await q.textContent('#mtPlan')).trim() === '', await q.textContent('#mtPlan'));
    t.ok('and one kcal figure, summed from the boxes',
      (await q.textContent('#mtKcal')).indexOf('= ' + (4 * planP + 4 * planC + 9 * planF) + ' kcal') >= 0,
      await q.textContent('#mtKcal'));

    /* The plan and the gram boxes are ONE model: the plan writes into the
       boxes as the profile changes, and the single Save commits the boxes.
       (v1 had a second "Use this plan" button, and Save after it silently
       restored the old grams — the exact trap a two-commit sheet lays.) */
    t.ok('the plan fills the gram boxes as the profile is typed',
      await q.evaluate(([p2, f2, c2]) =>
        mtP.value === String(p2) && mtF.value === String(f2) && mtC.value === String(c2),
        [planP, planF, planC]),
      await q.evaluate(() => [mtP.value, mtF.value, mtC.value].join('/')) +
        ' — wanted ' + planP + '/' + planF + '/' + planC);
    await q.click('[data-mtarg="save"]');
    await q.waitForTimeout(300);
    const qfoot = () => q.textContent('#macroFoot');
    t.ok('and Save carries the plan into the targets',
      new RegExp('/ ' + planP + ' g').test(await qfoot()) &&
      new RegExp('/ ' + planF + ' g').test(await qfoot()) &&
      new RegExp('/ ' + planC + ' g').test(await qfoot()), await qfoot());
    t.ok('and remembers who you are for next time',
      await q.evaluate(() => JSON.parse(localStorage.getItem('bsc.macroProfile')).lb === 200));

    /* Answer first: once the plan computes, the sheet opens on the number and
       the form folds behind one line. The first visit, with nothing to
       compute from, opens the form instead — there is no answer to lead with. */
    await openPlan(q);
    await q.waitForTimeout(250);
    t.ok('a known profile opens on the answer, with the form folded away',
      await q.evaluate(() => document.getElementById('mtEditor').classList.contains('hide') &&
        document.querySelector('.mt-who').getAttribute('aria-expanded') === 'false'));
    t.ok('the headline is the day, in calories and grams',
      await q.evaluate(([k, p2, f2, c2]) =>
        document.getElementById('mtBigKcal').textContent === String(k) &&
        document.getElementById('mtTileP').textContent === String(p2) &&
        document.getElementById('mtTileF').textContent === String(f2) &&
        document.getElementById('mtTileC').textContent === String(c2),
        [4 * planP + 4 * planC + 9 * planF, planP, planF, planC]));
    t.ok('and one line says who it was worked out for',
      /40 · 6′0″ · 200 lb/.test(await q.textContent('#mtWho')),
      await q.textContent('#mtWho'));
    await q.click('[data-mtedit]');
    await q.waitForTimeout(150);
    t.ok('Edit unfolds the ledger',
      await q.evaluate(() => !document.getElementById('mtEditor').classList.contains('hide')));
    t.ok('where every fact has its own line',
      await q.evaluate(() => document.querySelectorAll('#mtEditor .mtl-row').length >= 6));
    await q.fill('#mtP', '175');
    await q.waitForTimeout(150);
    t.ok('and a hand-typed gram moves the headline with it',
      await q.evaluate(([f2, c2]) =>
        document.getElementById('mtTileP').textContent === '175' &&
        document.getElementById('mtBigKcal').textContent === String(4 * 175 + 4 * c2 + 9 * f2),
        [planF, planC]));
    /* A goal with a date does its own arithmetic — the deficit falls out of
       the pounds and the weeks rather than out of a preset. */
    await q.fill('#mtGoalLb', '185');
    const inTen = await q.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date(); d.setDate(d.getDate() + 70);
      return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
    });
    await q.fill('#mtGoalBy', inTen);
    await q.waitForTimeout(200);
    /* The destination sits under the number it produced, at caption size —
       set in the book's largest serif above it, a sentence read as a title
       filled in wrong, and said again what the day already said. */
    t.ok('the destination is a caption under the number, not a headline over it',
      /185 lb by/.test(await q.textContent('#mtGoalLine')) &&
      await q.evaluate(() => {
        const g = document.getElementById('mtGoalLine');
        return !!g.closest('.mt-who') && !document.querySelector('.mt-sheet .sheet-name');
      }), await q.textContent('#mtGoalLine'));
    t.ok('and the pace it implies — 15 lb over ten weeks is 1.5 a week',
      /15 lb over 10 weeks/.test(await q.textContent('#mtGoalNote')) &&
      /1\.5 lb a week/.test(await q.textContent('#mtGoalNote')), await q.textContent('#mtGoalNote'));
    t.ok('which sets the calories from the goal, not from the preset',
      await q.evaluate(() => {
        const kc = Number(document.getElementById('mtBigKcal').textContent);
        // 1.5 lb a week is 750 kcal a day under a ~2900 kcal burn for this profile
        return kc > 1900 && kc < 2400;
      }), await q.textContent('#mtBigKcal'));
    await q.fill('#mtGoalLb', '120');
    await q.waitForTimeout(200);
    /* The old cap was on the RATE, and a rate cap is no cap at all on a big
       frame: 1% of 205 lb is 2.05 lb a week, a 1,025 kcal deficit, three
       hundred calories BELOW basal — and the app wrote that plan, then could
       only fill it with quarter portions. The deficit is capped now, and the
       plan says when you would really arrive. */
    t.ok('an impossible pace is held, and the plan says when you would really arrive',
      /more than a body gives up/.test(await q.textContent('#mtGoalNote')) &&
      /arriving about /.test(await q.textContent('#mtGoalNote')),
      await q.textContent('#mtGoalNote'));
    t.ok('and no plan it writes is ever under the floor it keeps',
      await q.evaluate(() =>
        Number(document.getElementById('mtBigKcal').textContent) >= 1500),
      await q.textContent('#mtBigKcal'));
    t.ok('nor one with no room left to eat carbohydrate',
      await q.evaluate(() => {
        const k = Number(document.getElementById('mtBigKcal').textContent);
        return 4 * Number(document.getElementById('mtC').value) >= 0.14 * k;
      }), await q.evaluate(() => document.getElementById('mtC').value + 'g of ' +
        document.getElementById('mtBigKcal').textContent));
    /* Two controls for one decision, one of them silently dead. */
    /* Dimming was not enough. They still took the press, still lit up, and
       still changed nothing — which is worse than being plainly out of use. */
    t.ok('the four presets are properly out of use, not merely faded',
      await q.evaluate(() => {
        const seg = document.getElementById('mtGoalSeg');
        return seg.classList.contains('spent') &&
          Array.from(seg.querySelectorAll('[data-mtgoal]')).every((b2) => b2.disabled);
      }));
    t.ok('and there is a button to put them back in charge',
      await q.evaluate(() => {
        const b2 = document.querySelector('[data-mtfree]');
        return b2 && b2.offsetParent !== null;
      }));
    const wasKcal = await q.textContent('#mtBigKcal');
    await q.click('[data-mtfree]');
    await q.waitForTimeout(200);
    t.ok('pressing it drops the deadline and hands the presets back',
      await q.evaluate(() => {
        const seg = document.getElementById('mtGoalSeg');
        return document.getElementById('mtGoalBy').value === '' &&
          !seg.classList.contains('spent') &&
          Array.from(seg.querySelectorAll('[data-mtgoal]')).every((b2) => !b2.disabled);
      }));
    t.ok('keeping the goal weight, which is not the thing you tired of',
      await q.evaluate(() => document.getElementById('mtGoalLb').value !== ''));
    await q.click('[data-mtgoal="keep"]');
    await q.waitForTimeout(200);
    t.ok('and now a preset actually moves the day',
      (await q.textContent('#mtBigKcal')) !== wasKcal,
      wasKcal + ' → ' + await q.textContent('#mtBigKcal'));
    await q.fill('#mtGoalLb', '');
    await q.fill('#mtGoalBy', '');
    await q.waitForTimeout(200);

    await q.click('.sheet-x');
    await q.waitForTimeout(250);

    /* With a goal and a date, the line says the destination, the distance
       and — once the scale has two weeks to compare — whether it agrees. */
    await openPlan(q);
    await q.waitForTimeout(250);
    // a known profile opens on the answer, so unfold the ledger to reach the goal
    await q.evaluate(() => {
      if (document.getElementById('mtEditor').classList.contains('hide')) {
        document.querySelector('[data-mtedit]').click();
      }
    });
    await q.waitForTimeout(150);
    await q.fill('#mtGoalLb', '185');
    const tenWeeks = await q.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date(); d.setDate(d.getDate() + 70);
      return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
    });
    await q.fill('#mtGoalBy', tenWeeks);
    await q.click('[data-mtarg="save"]');
    await q.waitForTimeout(300);
    const narr = async () => { await openWeigh(q); return q.textContent('.mw-verdict'); };
    /* Both facts, in the shorter words: "15 lb in 10 weeks" says what "15 lb
       to go over 10 weeks" said, and is short enough that the pace verdict
       stays on the line it is a verdict about rather than dropping to one of
       its own. The claim here is the destination and the distance, not the
       preposition between them. */
    t.ok('the line names the destination and the distance',
      /185 lb by/.test(await narr()) && /15 lb in 10 weeks/.test(await narr()), await narr());
    /* It used to add "Two weeks of mornings and this says whether you are on
       pace" here — the app explaining itself, which is the one thing the copy
       is not for. With nothing to judge yet it simply claims no verdict. */
    t.ok('and claims no verdict until the scale has one, without explaining why',
      !/mornings|on pace|behind pace|ahead of pace/i.test(await narr()), await narr());
    await openWeigh(q);
    t.ok('with the way back into the plan behind the press, not standing on the face',
      await q.evaluate(() => {
        const face = document.querySelector('.mw-verdict #macroTargBtn');
        const body = document.querySelector('.mw-body #macroTargBtn');
        return !face && !!body && /Adjust/.test(body.textContent) &&
          !document.querySelector('.mday-head #macroTargBtn');
      }),
      await q.evaluate(() => 'face:' + !!document.querySelector('.mw-verdict #macroTargBtn') +
        ' body:' + ((document.querySelector('.mw-body #macroTargBtn') || {}).textContent || 'none')));

    /* Two weeks of mornings, losing a pound a week against a goal that needs
       about two — the line should say so rather than flatter it. */
    await q.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const ws = {};
      for (let i = 0; i < 16; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        ws[d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate())] =
          Math.round((200 + i * 0.14) * 10) / 10;
      }
      localStorage.setItem('bsc.macroWeights', JSON.stringify(ws));
    });
    await q.reload();
    await q.waitForTimeout(400);
    /* A goal above your weight is still a goal. Both sides of the verdict are
       normalized to "progress toward it", so the bar to clear stays positive
       — negating it told somebody trying to gain that standing still, or
       losing, was ahead of pace. */
    t.ok('a gain goal is judged on gaining, not on any movement at all',
      await q.evaluate(() => {
        const p2 = (n) => (n < 10 ? '0' : '') + n;
        const by = new Date(); by.setDate(by.getDate() + 70);
        const pr = JSON.parse(localStorage.getItem('bsc.macroProfile'));
        pr.goalLb = pr.lb + 10;            // ten pounds ON, ten weeks
        pr.goalBy = by.getFullYear() + '-' + p2(by.getMonth() + 1) + '-' + p2(by.getDate());
        localStorage.setItem('bsc.macroProfile', JSON.stringify(pr));
        const ws = {};
        for (let i = 0; i < 16; i++) {     // losing half a pound a week
          const d = new Date(); d.setDate(d.getDate() - i);
          ws[d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate())] =
            Math.round((pr.lb + i * 0.07) * 10) / 10;
        }
        localStorage.setItem('bsc.macroWeights', JSON.stringify(ws));
        return true;
      }));
    await q.reload();
    await q.waitForTimeout(400);
    t.ok('and losing weight against a gain goal reads behind, not ahead',
      /behind pace/.test(await narr()) && !/ahead of pace/.test(await narr()), await narr());
    await q.evaluate(() => {
      const pr = JSON.parse(localStorage.getItem('bsc.macroProfile'));
      pr.goalLb = 185; localStorage.setItem('bsc.macroProfile', JSON.stringify(pr));
    });
    await q.reload();
    await q.waitForTimeout(400);

    /* The verdict and the arithmetic behind it sit on opposite sides of the
       fold, and deliberately so: "behind pace" is the line you steer by, so
       it is on the face; "Averaging 200.2 lb, down 0.5 a week. Needs 1.5."
       is the evidence for it, and evidence lives behind the press with the
       rest of the evidence. So this pair reads both sides. */
    const detail = async () => {
      if (!await q.$('.mw-body')) {
        const h = await q.$('.mday-weigh [data-mfold]');
        if (h) { await h.click(); await q.waitForTimeout(300); }
      }
      return q.textContent('.mw-body');
    };
    t.ok('once there are mornings, the scale gets an opinion',
      /Averaging /.test(await detail()) && /Needs /.test(await detail()), await detail());
    t.ok('and it is behind pace, because a pound a week is not two — said on the face',
      /behind pace/.test(await narr()), await narr());

    // ---- a favorite never ranks worse for being loved, and wears its star
    await q.click('[data-mslot="b"]');
    await pickerList(q);
    await q.waitForTimeout(200);
    /* A recipe from the middle of the ranking. Recipes only, because the line
       below looks it up in window.RECIPES to star it — the list carries
       single foods too now, and a food id finds nothing there. */
    const mid = await q.evaluate(() => {
      const rows = [...document.querySelectorAll('.mpick-row[data-mpx]')]
        .filter((r) => !/^f:/.test(r.dataset.mpick));
      const at = Math.min(7, rows.length - 1);
      return { id: rows[at].dataset.mpick, at: at };
    });
    await q.goBack();
    await q.waitForTimeout(250);
    await q.evaluate((id) => {
      const r = window.RECIPES.find((x) => String(x.id) === id);
      window.Store.toggleFav(r.id);
    }, mid.id);
    await q.waitForTimeout(200);
    await q.click('[data-mslot="b"]');
    await pickerList(q);
    await q.waitForTimeout(200);
    const after = await q.evaluate((id) => {
      const rows = [...document.querySelectorAll('.mpick-row[data-mpx]')]
        .filter((r) => !/^f:/.test(r.dataset.mpick));
      const at = rows.findIndex((r) => r.dataset.mpick === id);
      return { at, starred: at >= 0 && rows[at].textContent.indexOf('★') >= 0 };
    }, mid.id);
    t.ok('a favorite moves up the picker, or at worst holds its place',
      after.at >= 0 && after.at <= mid.at, after.at + ' from ' + mid.at);
    t.ok('and wears its star in the list', after.starred);
    await q.goBack();
    await q.waitForTimeout(250);

    // ---- Fill my day drafts every empty meal as one coherent combination
    await q.click('#macroFill');
    await q.waitForTimeout(300);
    const drafted = await q.evaluate(() => {
      const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
      const day = days[Object.keys(days)[0]];
      // days are lazily keyed, and a tight budget can leave a meal unfilled
      const items = ['b', 'l', 'd', 's'].map((k) => day[k] || []);
      const ids = [].concat(...items).map((i) => String(i.id));
      const tot = { p: 0, f: 0, c: 0 };
      /* Recipes only. A drafted day can carry a topper — a single food, which
         lives in the food table and not in RECIPES — so a lookup that assumed
         every id was a recipe would throw the moment one appeared. The totals
         below therefore understate a topped-up day, which is safe: every
         assertion on them is a floor on protein or a ceiling on fat. */
      ids.forEach((id, n) => {
        const r = window.RECIPES.find((x) => String(x.id) === id);
        if (!r || !r.macro) return;
        const x = [].concat(...items)[n].x;
        tot.p += r.macro.p * x; tot.f += r.macro.f * x; tot.c += r.macro.c * x;
      });
      return {
        perSlot: items.map((i) => i.length),
        unique: new Set(ids).size === ids.length,
        tot,
        foods: ids.filter((id) => id.indexOf('f:') === 0).length,
        bars: [...document.querySelectorAll('.mbrow[data-macro]')].map((row) => {
          const m = row.querySelector('.mb-num').textContent
            .replace(/,/g, '').match(/([\d.]+)\s*\/\s*([\d.]+)/);
          return { m: row.dataset.macro, have: +m[1], want: +m[2] };
        }),
        fillDisabled: document.getElementById('macroFill').disabled,
      };
    });
    /* EVERY meal, not most of them.
     *
       This asserted "at least three of four" and passed for months over a
       real bug: the room check sat inside the fill loop and read the day's
       remaining live, so the dishes Fill had just drafted were the reason the
       next meal got refused — and meals are walked in order, so it was always
       the last one. Measured over thirty runs, a five-meal day came back with
       an empty meal 47% of the time. The draft is resized by mBalanceDay a
       few lines later, so those dishes were never final and never a reason to
       refuse anybody.
       An assertion loose enough to accommodate the bug is how the bug got to
       stay. A day that starts empty gets every meal drafted. */
    t.ok('every meal on the plan gets something, not just most of them',
      drafted.perSlot.every((n) => n >= 1), drafted.perSlot.join(','));
    t.ok('and never the same recipe twice in a day', drafted.unique);

    /* Fill is an offer to build out the EMPTY meals. It was resizing the full
       ones too: a hand-placed 1,139 kcal Slow-Cooker Pulled Beef on dinner at
       one serving came back at ×0.25 after a single press, and the day then
       read 184/180 P in green while being some 850 kcal wrong. Nothing could
       tell whose a plate was — every free-list frees whatever is neither
       eaten nor locked — so Fill signs its own work now and asks only for
       that back.
     *
       The dish is chosen from the data rather than named, and the assertion
       is that the portion is UNCHANGED, not that it is any particular number:
       a literal would pass against an app that had stopped solving at all. */
    const mine = await t.fresh();
    const heavy = await mine.evaluate(() => {
      const r = window.RECIPES.filter((x) => x.macro && x.macro.kcal > 700)
        .sort((a, b) => b.macro.kcal - a.macro.kcal)[0];
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.macroDays',
        JSON.stringify({ [k]: { b: [], l: [], d: [{ id: r.id, x: 1, eaten: 0 }], s: [] } }));
      return { id: r.id, kcal: r.macro.kcal };
    });
    await mine.reload();
    await mine.waitForTimeout(400);
    await mine.click('.tab[data-view="macros"]');
    await mine.waitForTimeout(300);
    await mine.click('#macroFill');
    await mine.waitForTimeout(900);
    const kept = await mine.evaluate(() => {
      const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
      const day = days[Object.keys(days)[0]];
      return { x: day.d[0].x, by: day.d[0].by,
        others: ['b', 'l', 's'].reduce((n, k) => n + (day[k] || []).length, 0) };
    });
    t.ok('Fill leaves a plate you placed by hand at the portion you placed it',
      kept.x === 1, JSON.stringify({ heavy: heavy.kcal, after: kept.x }));
    t.ok('and does not sign it, because it is not Fill’s',
      kept.by === undefined, String(kept.by));
    /* The other half: a fix that simply stopped the solver would pass the two
       above and break Fill. */
    t.ok('and still fills every empty meal around it',
      kept.others >= 3, String(kept.others));

    /* Rebalance is deliberately NOT narrowed. Pressing ⚖ is asking the
       machine to move things; answering "only my own" would be refusing the
       request. This is what stops the fix above from growing too broad. */
    await mine.click('#macroRebal');
    await mine.waitForTimeout(700);
    const rebal = await mine.evaluate(() => {
      const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
      return days[Object.keys(days)[0]].d[0].x;
    });
    t.ok('but Rebalance, which you pressed, may still move it',
      rebal !== 1, 'x after rebalance: ' + rebal);

    /* Bodyweight was stored twice and the two disagreed: a falling weigh-in
       log, and a `lb` in the profile that only the plan sheet has ever
       written. Every target built on bodyweight was worked out against the
       stale one and nothing said so.
     *
       Asserted differentially rather than against a number: two pages with
       the SAME profile weight and different logs must produce different
       plans, and the heavier log the higher protein. A literal here would
       pass against an app that had stopped reading the scale at all, which
       is the whole bug. */
    const sotPage = async (lbNow) => {
      const pg = await t.fresh();
      await pg.evaluate((lb) => {
        const p2 = (n) => (n < 10 ? '0' : '') + n;
        const w = {};
        for (let i = 13; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          w[d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate())] = lb;
        }
        localStorage.setItem('bsc.macroWeights', JSON.stringify(w));
        localStorage.setItem('bsc.macroProfile', JSON.stringify({ sex: 'm', age: 43, ft: 5,
          inch: 11, lb: 205, act: 1.375, goal: 'cut1', goalLb: 0, goalBy: '',
          workouts: 4, steps: 8000, train: ['mo', 'we', 'fr'] }));
        localStorage.removeItem('bsc.macroTargets');
      }, lbNow);
      await pg.reload();
      await pg.waitForTimeout(350);
      await pg.click('.tab[data-view="macros"]');
      await pg.waitForTimeout(250);
      await openPlan(pg);
      await pg.waitForTimeout(350);
      return pg;
    };
    const planBoxes = (pg) => pg.evaluate(() =>
      ['mtP', 'mtF', 'mtC'].map((id) => Number((document.getElementById(id) || {}).value) || 0));

    const lightLog = await sotPage(150);
    const heavyLog = await sotPage(240);
    const lightPlan = await planBoxes(lightLog);
    const heavyPlan = await planBoxes(heavyLog);
    t.ok('the plan is built on the scale, not the weight typed into the sheet',
      lightPlan[0] !== heavyPlan[0],
      'protein light ' + lightPlan[0] + ' vs heavy ' + heavyPlan[0] + ' (profile says 205 in both)');
    t.ok('and it follows the scale the right way round',
      heavyPlan[0] > lightPlan[0], heavyPlan[0] + ' > ' + lightPlan[0]);

    /* Two boxes for one number is how they came to disagree, so once the log
       can answer, the sheet states it instead of asking again. */
    const scaleSot = await lightLog.evaluate(() => {
      const rows = [...document.querySelectorAll('.mtl-row')]
        .map((r) => r.textContent.replace(/\s+/g, ' ').trim());
      return { row: rows.find((x) => /^Weight/.test(x)),
        input: !!document.getElementById('mtLb'),
        stored: (JSON.parse(localStorage.getItem('bsc.macroProfile')) || {}).lb };
    });
    t.ok('the sheet states the weight from the log rather than asking for it again',
      !scaleSot.input && /150/.test(scaleSot.row), JSON.stringify(scaleSot));

    /* Save rebuilt the profile from the DOM over a bare setItem, so it
       silently dropped everything the sheet has no box for — the training
       days were being lost on every save, and the fallback weight was about
       to join them now that its box is gone.
     *
       The weight it keeps is the LOG'S, not the stale typed one. The absent
       box falls back to mReadProfile, which is where what-the-weight-is is
       defined; falling back to the raw store instead wrote 205 back over a
       log that had been saying 150 for a fortnight, and the number the sheet
       had just been built from was not the number Save committed. */
    await lightLog.click('[data-mtarg="save"]');
    await lightLog.waitForTimeout(600);
    const kept2 = await lightLog.evaluate(() => {
      const pr = JSON.parse(localStorage.getItem('bsc.macroProfile')) || {};
      return { lb: pr.lb, train: (pr.train || []).join(','), steps: pr.steps };
    });
    t.ok('and Save keeps what the sheet has no box for, at the weight the log states',
      kept2.train === 'mo,we,fr' && kept2.lb === 150, JSON.stringify(kept2));

    /* ---- and the sheet never slips back to the stale weight ---------------
     * The weight box goes away once the log can answer — so mtProfileFromDom
     * has no #mtLb to read and falls back. Falling back to the raw store got
     * the very number the log supersedes: the sheet OPENED on the scale's
     * plan and then flipped to the stale one the moment any other control was
     * touched, with the weight row still crediting the weigh-ins underneath
     * it. Age is the control used here because it is the one least related to
     * weight on the sheet — changing it and changing it straight back has to
     * leave the proposal exactly where it started. */
    /* ---- a comma is not a weight ------------------------------------------
     * The box was type=number, and a number input EATS a comma before any
     * script sees it: "80,5" arrived as "805", a real number that passed
     * every guard and stored eight hundred and five pounds — doubling the
     * day's calories off a seven-day average that had just moved four hundred
     * pounds. Blake does not write weights with commas, so a comma is not a
     * weight to interpret; it is a keystroke that means the entry is wrong.
     * It can only be refused if it survives to be seen, which is why the box
     * is text with a decimal keypad rather than a number.
     *
     * Typed with real keys, because the entire bug lives in what the browser
     * does to a keystroke before the value is ever read. fill() sets the
     * value directly and would prove nothing. */
    /* Built here rather than borrowed from sotPage, which leaves the plan
       sheet open over the box this is about. */
    const wPage = await t.fresh({ viewport: { width: 412, height: 915 } });
    await wPage.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const w = {};
      for (let i = 9; i >= 1; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        w[d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate())] = 205;
      }
      localStorage.setItem('bsc.macroWeights', JSON.stringify(w));
      localStorage.setItem('bsc.macroProfile', JSON.stringify({ sex: 'm', age: 43, ft: 5,
        inch: 11, lb: 205, act: 1.375, goal: 'cut1', goalLb: 175, goalBy: '',
        workouts: 4, steps: 8000 }));
    });
    await wPage.reload();
    await wPage.waitForTimeout(400);
    await wPage.click('.tab[data-view="macros"]');
    await wPage.waitForTimeout(400);
    const wState = () => wPage.evaluate(() => {
      const d = new Date(), q = (n) => (n < 10 ? '0' : '') + n;
      const key = d.getFullYear() + '-' + q(d.getMonth() + 1) + '-' + q(d.getDate());
      return { box: (document.getElementById('mWeight') || {}).value,
        note: ((document.getElementById('mWeightNote') || {}).textContent || '').trim(),
        stored: (JSON.parse(localStorage.getItem('bsc.macroWeights') || '{}'))[key] };
    });
    const wType = async (txt) => {
      await wPage.click('#mWeight');
      await wPage.evaluate(() => { const e = document.getElementById('mWeight'); e.value = ''; });
      await wPage.keyboard.type(txt);
      await wPage.waitForTimeout(850);
    };
    await wType('185');
    const wGood = await wState();
    t.ok('a plain weight is taken', wGood.stored === 185 && !wGood.note, JSON.stringify(wGood));
    await wType('80,5');
    const wComma = await wState();
    t.ok('a comma is shown back to you rather than swallowed',
      wComma.box === '80,5', JSON.stringify(wComma));
    t.ok('and it is refused, not read as eight hundred and five',
      !!wComma.note && wComma.stored === 185, JSON.stringify(wComma));
    await wType('205.4');
    const wPoint = await wState();
    t.ok('a point still works', wPoint.stored === 205.4, JSON.stringify(wPoint));
    await wPage.context().close();

    const slip = await sotPage(150);
    const whoOf = (pg) => pg.evaluate(() =>
      ((document.getElementById('mtWho') || {}).textContent || '').replace(/\s+/g, ' ').trim());
    const openedOn = await planBoxes(slip);
    const whoOpened = await whoOf(slip);
    /* The editor is folded away while there is a plan to show, so the boxes
       are reached the way a thumb reaches them: by pressing Edit. */
    await slip.click('[data-mtedit]');
    await slip.waitForTimeout(200);
    await slip.fill('#mtAge', '44');
    await slip.waitForTimeout(300);
    await slip.fill('#mtAge', '43');
    await slip.waitForTimeout(300);
    const settledOn = await planBoxes(slip);
    const whoSettled = await whoOf(slip);
    t.ok('touching another control does not swap the scale weight for the stale one',
      whoSettled.indexOf('150') >= 0 && whoSettled.indexOf('205') < 0,
      'who: "' + whoOpened + '" -> "' + whoSettled + '"');
    t.ok('so the plan it proposes is still the plan it opened on',
      openedOn.join() === settledOn.join(), openedOn.join() + ' -> ' + settledOn.join());
    await slip.context().close();

    /* ---- the commit button rides the bar, not the header -----------------
     * The one control that commits a basket used to sit in .sheet-top, the
     * first element of the sheet, which has no position — so it scrolled off
     * the top the moment you moved down the list to fill the basket it
     * commits. Meanwhile the only element pinned to the bottom of the
     * viewport, where a thumb actually rests, carried no control at all.
     *
     * Measured in a coarse-pointer context at 320px, the narrowest the app
     * supports, because that is where the bar is tallest and the button
     * nearest the edge. */
    const barPg = await t.fresh({ viewport: { width: 320, height: 844 },
      hasTouch: true, isMobile: true });
    await barPg.click('.tab[data-view="macros"]');
    await barPg.waitForTimeout(250);
    await addOn(barPg);
    await barPg.waitForTimeout(400);
    t.ok('the sheet header no longer carries the thing that commits',
      await barPg.evaluate(() => !document.querySelector('.sheet-top [data-mpdone]')));
    await barPg.evaluate(() => { document.querySelectorAll('.mpick-row[data-mpick]')[0].click(); });
    await barPg.waitForTimeout(400);
    const pinnedBar = await barPg.evaluate(() => {
      const f = document.querySelector('.mp-foot');
      const d = document.querySelector('[data-mpdone]');
      if (!f || !d) return null;
      const fr = f.getBoundingClientRect(), dr = d.getBoundingClientRect();
      return { inFoot: !!f.querySelector('[data-mpdone]'),
        count: document.querySelectorAll('[data-mpdone]').length,
        footBottom: Math.round(fr.bottom), view: window.innerHeight,
        btnH: Math.round(dr.height), fullBleed: Math.round(fr.width) === window.innerWidth,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    t.ok('it is on the bar pinned to the bottom of the screen',
      !!pinnedBar && pinnedBar.inFoot && pinnedBar.footBottom === pinnedBar.view,
      JSON.stringify(pinnedBar));
    /* One in the document, or focus restore picks whichever comes first. */
    t.ok('and there is exactly one of it', pinnedBar && pinnedBar.count === 1,
      JSON.stringify(pinnedBar && pinnedBar.count));
    /* The picker had never been named in the coarse-pointer block at all. */
    t.ok('a thumb can hit it', pinnedBar && pinnedBar.btnH >= 44,
      String(pinnedBar && pinnedBar.btnH));
    t.ok('and the bar reaches both edges without scrolling the page sideways',
      pinnedBar && pinnedBar.fullBleed && pinnedBar.overflowX === 0,
      JSON.stringify(pinnedBar));

    /* Scrolled to the very end, the bar must not be sitting on the last row —
       a pinned bar that hides what it is pinned over trades one unreachable
       control for another. */
    await barPg.evaluate(() => { const s = document.querySelector('.scrim'); s.scrollTop = s.scrollHeight; });
    await barPg.waitForTimeout(300);
    const footGeo = await barPg.evaluate(() => {
      const f = document.querySelector('.mp-foot').getBoundingClientRect();
      const rows = [...document.querySelectorAll('.mpick-row')];
      return { hidden: rows.filter((r) => {
        const b = r.getBoundingClientRect();
        return b.bottom > f.top + 1 && b.top < f.bottom;
      }).length };
    });
    t.ok('and at the end of the list it covers nothing',
      footGeo.hidden === 0, JSON.stringify(footGeo));

    /* THE ONE THAT NEARLY SHIPPED. Sticky only ever pulls an element UP from
       where the flow put it, and the phone rule gives every sheet
       min-height:100% — so on a list of one row the bar sat wherever the
       content ended, measured 438px of empty sheet below it. Harmless while
       it was two lines of grey text. Not harmless once it is the only way to
       commit. */
    await pickerList(barPg);
    await barPg.waitForTimeout(400);
    await barPg.fill('#mpFind', 'zzzzzqqq');
    await barPg.waitForTimeout(500);
    const shortList = await barPg.evaluate(() => {
      const f = document.querySelector('.mp-foot');
      if (!f) return null;
      const fr = f.getBoundingClientRect();
      return { rows: document.querySelectorAll('.mpick-row').length,
        gapBelow: Math.round(window.innerHeight - fr.bottom) };
    });
    /* Two rows, not one: a query that matches nothing now carries a way on
       from there — "look it up in the food tables" above "type it in
       yourself". The claim being made here is the BAR's, and it is
       gapBelow; the row count is only how the test says "this list does not
       reach the fold". */
    t.ok('a list too short to fill the screen still puts the bar on the bottom of it',
      !!shortList && shortList.rows <= 2 && shortList.gapBelow === 0,
      JSON.stringify(shortList));
    await barPg.context().close();

    /* ---- ticking a plate must not truncate what you ate ------------------
     * An eaten portion becomes `<button class="mstep-x mstep-wake">` so it can
     * be tapped to correct. `.mstep button` is 0-1-1 and `.mstep-x` is 0-1-0,
     * so every box property on the former beat the latter: `flex: none` and
     * `width: 44px` shrank the cell to a key's size, and `.mstep-x`'s own
     * 20px of padding left 24px for the words. "2 ½ cups" rendered "2 ½ c".
     *
     * THIS RULE HAS NOW CAUGHT THAT ELEMENT THREE TIMES — twice on font-size
     * (15px, then 18px) and once on width. The first two fixes scoped
     * font-size alone and left the box unscoped, which is why there was a
     * third. Asserted as an invariant rather than a measurement: ticking
     * changes the state of a plate, never the words on it.
     *
     * Coarse pointer, because that is where the 44px box rules live. */
    const wakePg = await t.fresh({ viewport: { width: 412, height: 915 },
      hasTouch: true, isMobile: true });
    await wakePg.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: { b: [],
        l: [{ id: 'f:egg_white', x: 2.5, eaten: 0 }, { id: 'f:applesauce', x: 0.75, eaten: 0 }],
        d: [], s: [] } }));
    });
    await wakePg.reload();
    await wakePg.waitForTimeout(400);
    await wakePg.click('.tab[data-view="macros"]');
    await wakePg.waitForTimeout(300);
    await wakePg.evaluate(() => {
      const b = document.querySelector('#macroSlots [data-mfold][aria-expanded="false"]');
      if (b) b.click();
    });
    await wakePg.waitForTimeout(400);
    const portionCells = () => wakePg.evaluate(() =>
      [...document.querySelectorAll('.mstep-x')].map((e) => ({
        text: e.textContent.trim(), w: Math.round(e.getBoundingClientRect().width),
        clipped: e.scrollWidth > e.clientWidth + 1 })));
    const before2 = await portionCells();
    for (let i = 0; i < 4; i++) {
      const did = await wakePg.evaluate(() => {
        const c = document.querySelector('#macroSlots input[data-meat]:not(:checked)');
        if (!c) return false;
        c.click();
        return true;
      });
      if (!did) break;
      await wakePg.waitForTimeout(350);
    }
    const eatenPortion = await portionCells();
    t.ok('a plate reads the same words once it is eaten',
      before2.length > 1 && eatenPortion.length === before2.length &&
      before2.every((x, i) => x.text === eatenPortion[i].text),
      JSON.stringify({ before: before2, after: eatenPortion }));
    t.ok('and the portion is not clipped down to a key’s width',
      eatenPortion.length > 0 && eatenPortion.every((x, i) => !x.clipped && x.w === before2[i].w),
      JSON.stringify(eatenPortion));
    await wakePg.context().close();

    /* ---- a skipped meal is not still coming -----------------------------
     * From Blake's screenshots: the bar read "1802 / 1745" and the number on
     * the same row read "+930". Both cannot be true. The meal cards summed to
     * 1802 against 1745, so the bar was right and the delta was wrong — by
     * 873 kcal, which is almost exactly half the day.
     *
     * The delta is `on the day + ASSUMED - target`, and mAssumed counted
     * every meal with no food on it as one still to come. Four of his six
     * were SKIPPED, which is the opposite claim: skipping says the food is
     * not coming and hands the share to the rest. So half the day's target
     * was being added back as food he had already said he was not eating.
     *
     * Asserted as the invariant rather than against his numbers: once no meal
     * is both empty and expected, there is nothing left to assume, so the
     * delta IS got minus target. */
    const skipPg2 = await t.fresh();
    await skipPg2.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        l: [{ id: 'f:egg_white', x: 1.5, eaten: 1 }, { id: 'f:cheddar', x: 0.5, eaten: 1 }],
        d: [{ id: 'f:cooked_beef', x: 2, eaten: 1 }, { id: 'f:potato', x: 1.5, eaten: 1 }] } }));
    });
    await skipPg2.reload();
    await skipPg2.waitForTimeout(400);
    await skipPg2.click('.tab[data-view="macros"]');
    await skipPg2.waitForTimeout(300);
    const deltaRows = () => skipPg2.evaluate(() =>
      [...document.querySelectorAll('.mbrow[data-macro]')].map((r) => {
        const num = (r.querySelector('.mb-num') || {}).textContent || '';
        const m = /(-?[\d,]+)\s*\/\s*([\d,]+)/.exec(num.replace(/\s+/g, ' '));
        /* The minus is already in the string — parsing it AND multiplying by
           -1 turned every negative delta positive, which is how this first
           reported 612 against an expected -612. */
        const shown = Number(String((r.querySelector('.mb-d') || {}).textContent || '')
          .replace(/[^\-\d]/g, '')) || 0;
        return m ? { k: r.dataset.macro, got: Number(m[1].replace(/,/g, '')),
          target: Number(m[2].replace(/,/g, '')), shown: shown } : null;
      }).filter(Boolean));

    /* With empty meals still on the day the delta SHOULD differ from
       got − target — that is what the assumption is for, and asserting
       otherwise here would pass with the assumption deleted entirely. */
    const emptyDelta = await deltaRows();
    t.ok('an empty meal is still expected, so the delta is not just what is on the day',
      emptyDelta.length === 4 && emptyDelta.some((r) => r.shown !== r.got - r.target),
      JSON.stringify(emptyDelta));

    /* Now skip everything that is still empty. */
    await skipPg2.evaluate(async () => {
      for (let i = 0; i < 8; i++) {
        const b = [...document.querySelectorAll('#macroSlots [data-mskip]')]
          .find((x) => !/undo/i.test(x.textContent));
        if (!b) break;
        b.click();
        await new Promise((r) => setTimeout(r, 180));
      }
    });
    await skipPg2.waitForTimeout(500);
    const skipDelta = await deltaRows();
    t.ok('and once it is skipped it is not expected any more',
      skipDelta.length === 4 &&
      skipDelta.every((r) => Math.abs(r.shown - (r.got - r.target)) <= 1),
      JSON.stringify(skipDelta));
    /* The bar and the number beside it are one reading of one day. */
    t.ok('so the bar and the number on its own row agree',
      skipDelta.every((r) => (r.got > r.target) === (r.shown > 0) || r.got === r.target),
      JSON.stringify(skipDelta));
    await skipPg2.context().close();

    /* ---- adding does not throw the list back to the top ------------------
     * The basket's remove button used to carry `data-mpick` — the same
     * attribute the list row carries. After an add there were two elements
     * answering the same focus key, and focusKey takes the FIRST in document
     * order: the basket copy, which sits at the top of the sheet. Focusing it
     * scrolled the scrim to 0, so every add threw the list back to the top
     * from wherever you had scrolled to.
     *
     * MUST BE A REAL POINTER CLICK. `element.click()` from page script never
     * moves focus, so focusKey has nothing to restore and the bug is
     * invisible — a probe driven that way reports a preserved scroll against
     * broken code. */
    const jumpPg = await t.fresh({ viewport: { width: 320, height: 640 } });
    await jumpPg.click('.tab[data-view="macros"]');
    await jumpPg.waitForTimeout(250);
    await addOn(jumpPg);
    await jumpPg.waitForTimeout(500);
    /* One thing in the basket first: the duplicate key only ever existed once
       an add had drawn the basket panel. */
    await jumpPg.evaluate(() => {
      document.querySelectorAll('#modalRoot .mpick-row[data-mpick]')[0].click();
    });
    await jumpPg.waitForTimeout(400);
    /* Asserted on the attribute itself, not on a live duplicate count: a
       freshly added row usually RE-RANKS OUT of its band, so counting matches
       finds one either way and passes against the bug. (It did — caught by
       mutating the fix back in and watching this stay green.) */
    await openBasket(jumpPg);
    const dupKeys = await jumpPg.evaluate(() => {
      const outs = [...document.querySelectorAll('.mpb-out')];
      return { n: outs.length, borrowing: outs.filter((b) => b.hasAttribute('data-mpick')).length };
    });
    t.ok('the basket’s remove control does not answer the list row’s attribute',
      dupKeys.n > 0 && dupKeys.borrowing === 0, JSON.stringify(dupKeys));

    await jumpPg.evaluate(() => { document.querySelector('.scrim').scrollTop = 300; });
    await jumpPg.waitForTimeout(200);
    const target = await jumpPg.evaluate(() => {
      const w = [...document.querySelectorAll('#modalRoot .mpick-wrap')]
        .find((x) => !x.classList.contains('in') &&
          x.getBoundingClientRect().top > 90 && x.getBoundingClientRect().bottom < 560);
      if (!w) return null;
      const r = w.querySelector('.mpick-row').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + 12 };
    });
    if (target) await jumpPg.mouse.click(target.x, target.y);
    await jumpPg.waitForTimeout(450);
    const heldScroll = await jumpPg.evaluate(() =>
      Math.round(document.querySelector('.scrim').scrollTop));
    t.ok('and adding it leaves the list where you were reading it',
      !!target && heldScroll === 300, 'scrollTop ' + heldScroll + ' (was 300)');
    await jumpPg.context().close();

    /* ---- the basket rides the bar, and a pick holds your place ------------
     * It used to sit in the SCROLL above the rows and grow as you picked —
     * measured at 71px after one thing, 119 after two, 167 after three — so
     * the list slid down under the finger on every tap, and once you had
     * scrolled past it the panel was off-screen (y -106) and the one question
     * it answers, "what have I got", needed scrolling back to ask.
     *
     * Two things had to change together for the place to hold. The panel came
     * out of the flow, and a picked row stopped VANISHING: it left the closers
     * band once it was in the basket and then fit worse, so it fell out of the
     * ranking too — the list went 13 rows to 10 over three taps and
     * `.mpick-wrap.in` was never once on screen. */
    /* 412x915, a Pixel, and NOT the narrow phone: at 320 the list is long
       enough that a picked row can survive inside the top ten by itself, so
       the tick assertion passes with the fix reverted. Mutation said so. */
    const barPg2 = await t.fresh({ viewport: { width: 412, height: 915 } });
    await barPg2.click('.tab[data-view="macros"]');
    await barPg2.waitForTimeout(250);
    await addOn(barPg2);
    await barPg2.waitForTimeout(500);
    t.ok('the basket is not in the list, and the bar is shut to start with',
      await barPg2.evaluate(() => !document.querySelector('.mp-basket')));

    const heldAt = [];
    for (let i = 0; i < 3; i++) {
      /* Scroll as far as this sheet allows and READ BACK what it gave: a
         sheet shorter than the ask clamps, and comparing against the ask
         rather than the result would report a failure the browser had no
         choice about. */
      const at = await barPg2.evaluate(() => {
        const s = document.querySelector('.scrim');
        /* Deliberately short of the end. Scrolled to the very bottom of a list
           that then gets shorter, the browser must clamp and no amount of
           care can hold the position — asserting there would be asserting
           against the platform. */
        s.scrollTop = Math.min(120, (s.scrollHeight - s.clientHeight) - 40);
        return Math.round(s.scrollTop);
      });
      await barPg2.waitForTimeout(200);
      const box = await barPg2.evaluate(() => {
        const w = [...document.querySelectorAll('#mpList .mpick-wrap:not(.in)')]
          .find((x) => x.getBoundingClientRect().top > 120 &&
            x.getBoundingClientRect().bottom < window.innerHeight - 90);
        if (!w) return null;
        const r = w.querySelector('.mpick-row').getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + 12 };
      });
      if (!box) break;
      /* A REAL pointer click: a scripted one never moves focus, and the focus
         restore is half of what used to move the list. */
      await barPg2.mouse.click(box.x, box.y);
      await barPg2.waitForTimeout(400);
      heldAt.push({ was: at, now: await barPg2.evaluate(() =>
        Math.round(document.querySelector('.scrim').scrollTop)) });
    }
    t.ok('adding something leaves the list where you were reading it',
      heldAt.length === 3 && heldAt.every((h) => h.now === h.was),
      JSON.stringify(heldAt));
    /* The ✓ and the green wash a picked row wears had nothing to wear them
       while picked rows disappeared. */
    t.ok('and the row you picked stays, wearing its tick',
      await barPg2.evaluate(() =>
        document.querySelectorAll('#mpList .mpick-wrap.in').length === 3));

    const railBar = await barPg2.evaluate(() => {
      const bar = document.querySelector('.mp-bar').getBoundingClientRect();
      return { bottom: Math.round(bar.bottom), view: window.innerHeight,
        h: Math.round(bar.height), basket: !!document.querySelector('.mp-basket') };
    });
    t.ok('the bar stays on the bottom of the screen and stays shut',
      railBar.bottom === railBar.view && !railBar.basket, JSON.stringify(railBar));

    await barPg2.click('[data-mpbasket]');
    await barPg2.waitForTimeout(350);
    t.ok('and pressing what it costs shows what it is made of',
      await barPg2.evaluate(() => {
        const bar = document.querySelector('.mp-bar').getBoundingClientRect();
        const bk = document.querySelector('.mp-basket');
        return !!bk && bk.querySelectorAll('.mpb-row').length === 3 &&
          Math.round(bar.bottom) === window.innerHeight &&
          bar.height <= window.innerHeight * 0.6;
      }));
    await barPg2.context().close();

    /* ---- searching narrows the list instead of replacing it --------------
     * Every day / Recent / the closers / Fits best were emitted only in the
     * home branch, and typing switched you out of it — so the moment you went
     * looking for something, the thinking the sheet had done for you
     * vanished. That is most of what "bouncing around" was.
     *
     * Now one box sits on the resting screen, the four bands narrow, and
     * anything else the query finds is appended underneath. */
    /* ---- an unplanned day offers whole servings, never half ones ----------
     * With targets of 0/0/0 every share is 0 and D falls to its floor, which
     * leaves the fit nothing to weigh but the overshoot term — and that is
     * smallest at the smallest portion it is allowed to try. So every ranked
     * row came back at ×½: the picker offered half a serving of everything
     * and a tap logged half a serving nobody had asked for, on the one kind
     * of day the app has already promised not to invent numbers on. */
    const noPlan = await freshBare();
    await noPlan.click('.tab[data-view="macros"]');
    await noPlan.waitForTimeout(250);
    await addOn(noPlan);
    await noPlan.waitForTimeout(500);
    await noPlan.fill('#mpFind', 'chicken');
    await noPlan.waitForTimeout(400);
    const unplannedRows = await noPlan.evaluate(() =>
      [...document.querySelectorAll('.mpick-row[data-mpx]')].map((r) => ({
        x: Number(r.dataset.mpx),
        t: r.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) })));
    t.ok('a day with no plan still has rows to offer',
      unplannedRows.length > 0, JSON.stringify(unplannedRows.slice(0, 3)));
    t.ok('and every one of them is a whole serving, not a half',
      unplannedRows.every((r) => r.x === 1),
      JSON.stringify(unplannedRows.filter((r) => r.x !== 1).slice(0, 5)));
    await noPlan.context().close();

    /* ---- the rail counts what you typed ----------------------------------
     * The chips were built from the whole pool whatever was in the box, so a
     * search left a row of shelves describing a list that had moved on — and
     * the one question you have while typing is WHERE the hits are. The
     * mockup's words: searching turns the chips into counts instead of
     * blanking them.
     *
     * Asserted on the arithmetic rather than on a number: All has to equal
     * what the other chips add up to, whatever the food table happens to hold
     * this week. */
    const railPg2 = await t.fresh({ viewport: { width: 412, height: 915 } });
    await railPg2.click('.tab[data-view="macros"]');
    await railPg2.waitForTimeout(300);
    await addOn(railPg2);
    await railPg2.waitForTimeout(500);
    const railOf = () => railPg2.evaluate(() =>
      [...document.querySelectorAll('.mp-shelf')].map((c) => ({
        k: c.dataset.mpshelf,
        n: (c.querySelector('.mp-shn') || {}).textContent || null })));
    const restingRail = await railOf();
    t.ok('a resting rail carries no counts',
      restingRail.length > 2 && restingRail.every((c) => c.n === null),
      JSON.stringify(restingRail));
    await railPg2.fill('#mpFind', 'bean');
    await railPg2.waitForTimeout(600);
    const typedRail = await railOf();
    const allChip = typedRail.filter((c) => c.k === '')[0];
    const rest = typedRail.filter((c) => c.k !== '');
    t.ok('typing turns them into counts',
      !!allChip && allChip.n !== null && rest.length > 0 && rest.every((c) => c.n !== null),
      JSON.stringify(typedRail));
    /* Guarded on the counts existing at all: Number(null) is 0, so without
       this an app that had stopped counting would satisfy "0 equals 0". */
    t.ok('and the counts add up to what All says',
      !!allChip && allChip.n !== null &&
        Number(allChip.n) === rest.reduce((s2, c) => s2 + Number(c.n), 0),
      JSON.stringify(typedRail));
    await railPg2.fill('#mpFind', '');
    await railPg2.waitForTimeout(600);
    /* And it had them to take away — otherwise this is green on an app that
       never counted. */
    t.ok('and clearing the box takes the counts away again',
      typedRail.some((c) => c.n !== null) &&
        (await railOf()).every((c) => c.n === null), JSON.stringify(await railOf()));

    /* ---- an order is a question about a long list -------------------------
     * The mockup: sorts only appear on Recipes, because a shelf of nine
     * vegetables does not need one. Both the control and the sorting itself
     * read one function — a hidden control still steering the order is an
     * invisible setting, which is the shape of half the bugs this app has had.
     */
    const sortWhen = async (fn) => {
      await fn();
      await railPg2.waitForTimeout(600);
      return railPg2.evaluate(() => ({
        lens: !!document.getElementById('mpSec'),
        sort: !!document.getElementById('mpSort') }));
    };
    t.ok('browsing recipes offers an order',
      (await sortWhen(async () => railPg2.selectOption('#mpSec', 'all'))).sort,
      'lens=all');
    t.ok('a shelf of single foods does not',
      !(await sortWhen(async () => railPg2.selectOption('#mpSec', 'foods'))).sort,
      'lens=foods');
    /* And the way back out survives a lens with nothing in it. Press a food
       shelf while the lens says "Every recipe" and you have asked for a
       recipe that is a vegetable: the band used to return nothing and take
       the lens with it, leaving no way to undo what emptied the list. */
    const stranded = await sortWhen(async () => {
      await railPg2.selectOption('#mpSec', 'all');
      await railPg2.waitForTimeout(400);
      await railPg2.evaluate(() => {
        const ch = document.querySelector('.mp-shelf[data-mpshelf="veg"]');
        if (ch) ch.click();
      });
    });
    t.ok('and an empty lens keeps the control that undoes it',
      stranded.lens && !stranded.sort, JSON.stringify(stranded));
    t.ok('and says so rather than showing a heading over nothing',
      await railPg2.evaluate(() =>
        document.querySelectorAll('.mpick-row[data-mpick]').length === 0 &&
        /nothing here in this lens/i.test(document.getElementById('mpList').textContent)),
      await railPg2.evaluate(() =>
        document.getElementById('mpList').textContent.replace(/\s+/g, ' ').trim().slice(0, 70)));
    await railPg2.context().close();

    /* ---- every control in the picker is a thumb's width ------------------
     * The mockup asks for it in three words — "Every control 44px" — and the
     * picker had never had the pass: measured at 412 and at 320 it came back
     * with twenty-seven under it, including the × that gets you out of the
     * sheet at 21x22, the camera at 36, the two selects at 23 and every shelf
     * chip at 40. The chips had been held at 40 deliberately, to keep the
     * rail from standing taller than the search box — and the search box was
     * 33 and under the line itself, so the rail was being measured against
     * something that was also wrong.
     *
     * A standing count rather than a list of sizes: a rule the whole sheet
     * has to keep is worth a test that notices a NEW control breaking it, and
     * naming today's controls would only ever check today's. */
    for (const vp of [{ width: 412, height: 915 }, { width: 320, height: 568 }]) {
      const tapPg = await t.fresh({ viewport: vp, hasTouch: true, isMobile: true });
      await tapPg.click('.tab[data-view="macros"]');
      await tapPg.waitForTimeout(300);
      await addOn(tapPg);
      await tapPg.waitForTimeout(500);
      const undersized = await tapPg.evaluate(() => {
        const out = [];
        document.querySelectorAll('#modalRoot button, #modalRoot select, #modalRoot input')
          .forEach((e) => {
            const r = e.getBoundingClientRect();
            if (!r.width || !r.height) return;              // not drawn
            if (Math.min(r.width, r.height) >= 44) return;
            out.push(((e.className && String(e.className).split(' ')[0]) || e.id || e.tagName) +
              ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
          });
        return out;
      });
      t.ok('every control in the picker is at least 44px at ' + vp.width,
        undersized.length === 0, JSON.stringify(undersized));
      await tapPg.context().close();
    }

    /* ---- a food the storehouse has never heard of -------------------------
     * The live lookup was in the app the whole time — it is what fills a
     * packet's numbers in from the USDA — but the only thing that called it
     * was the search box inside the "Look up" tile, and the tiles went in
     * v283. So typing a food the book does not stock ended at "Nothing
     * matches american cheese." and there was no way on from there. Blake
     * hit it looking for American cheese, which the table does not carry and
     * the tables do.
     *
     * The click asserts the WIRING, not the USDA: the row is pressed and the
     * container underneath it must say it is asking. What the tables answer
     * is their business and not something a test should wait on. */
    const look = await t.fresh({ viewport: { width: 412, height: 915 } });
    await look.click('.tab[data-view="macros"]');
    await look.waitForTimeout(250);
    await addOn(look);
    await look.waitForTimeout(600);
    const lookRow = () => look.evaluate(() => {
      const b = document.querySelector('[data-mplook]');
      return { there: !!b, q: b ? b.dataset.mplook : null,
        results: !!document.getElementById('nfResults'),
        says: (document.querySelector('#mpList .mslot-empty') || {}).textContent || '' };
    });

    await look.fill('#mpFind', 'american cheese');
    await look.waitForTimeout(500);
    const dead = await lookRow();
    t.ok('a food the book does not stock still offers somewhere to go',
      dead.there && dead.q === 'american cheese' && dead.results, JSON.stringify(dead));
    t.ok('and still says plainly that it has nothing of its own',
      /nothing matches/i.test(dead.says), JSON.stringify(dead.says));

    /* Two characters is not a question worth asking somebody else's server. */
    await look.fill('#mpFind', 'am');
    await look.waitForTimeout(400);
    t.ok('two letters is not a lookup', !(await lookRow()).there);

    /* A barcode already has its own row at the top; two rows offering to look
       the same thing up is the tile problem again, smaller. */
    await look.fill('#mpFind', '01234567890');
    await look.waitForTimeout(400);
    const codeRow = await look.evaluate(() => ({
      look: !!document.querySelector('[data-mplook]'),
      code: !!document.querySelector('[data-nfcode]') }));
    t.ok('a barcode is offered once, by the row that already did it',
      !codeRow.look && codeRow.code, JSON.stringify(codeRow));

    /* And the row is actually wired to the lookup. */
    await look.fill('#mpFind', 'american cheese');
    await look.waitForTimeout(500);
    await look.click('[data-mplook]');
    await look.waitForTimeout(120);
    t.ok('pressing it asks the food tables',
      await look.evaluate(() =>
        /looking in the food tables/i.test(document.getElementById('nfResults').textContent)),
      await look.evaluate(() => document.getElementById('nfResults').textContent));
    await look.context().close();

    /* ---- a barcode you TYPE is a barcode you asked about -------------------
     * The picker offers "Look up <number>" for anything that parses as a
     * barcode, and pressing it did nothing at all. It routes through
     * mScanGot, whose first line is a guard against a late decode arriving
     * after the camera has been stopped — and a typed number has no camera
     * behind it, so the guard ate the request. It ate it even WITH a working
     * camera: the handler renders the scan sheet and calls straight through,
     * while mScanStart only sets mCam once getUserMedia resolves, so mCam is
     * still null on the very next line. The row had never worked.
     *
     * Asserted on the asking, not on the answer: Open Food Facts is somebody
     * else's server and whether it knows a given packet is not this suite's
     * business. */
    const codePg = await t.fresh({ viewport: { width: 412, height: 915 } });
    await codePg.click('.tab[data-view="macros"]');
    await codePg.waitForTimeout(250);
    await addOn(codePg);
    await codePg.waitForTimeout(600);
    await codePg.fill('#mpFind', '028400090896');
    await codePg.waitForTimeout(500);
    const codeOffer = await codePg.evaluate(() => {
      const b = document.querySelector('[data-nfcode]');
      return { there: !!b, text: b ? b.textContent.replace(/\s+/g, ' ').trim() : '' };
    });
    t.ok('a typed barcode is offered as a lookup', codeOffer.there, JSON.stringify(codeOffer));
    await codePg.click('[data-nfcode]');
    await codePg.waitForTimeout(250);
    t.ok('and pressing it actually asks, rather than opening a blank scanner',
      await codePg.evaluate(() => {
        const r = document.getElementById('nfResults');
        return !!r && /looking up/i.test(r.textContent);
      }),
      await codePg.evaluate(() => {
        const r = document.getElementById('nfResults');
        return 'scanSheet=' + !!document.getElementById('scanRoot') +
          ' nfResults=' + JSON.stringify(r ? r.textContent.trim() : null);
      }));
    await codePg.context().close();

    /* ---- printing a day opens it, instead of throwing -------------------
     * `mOnPaper` was assigned in both print handlers and never declared, and
     * under 'use strict' that throws. It threw on the line BEFORE
     * renderMacros(), so the unfold-for-paper pass never ran: a day with a
     * folded meal printed as dish names with no numbers on them — the exact
     * thing the comment above the handler says it exists to prevent — and
     * every print from My Day raised two uncaught ReferenceErrors.
     *
     * Asserted through the events rather than a real print dialog, which is
     * what beforeprint/afterprint are for. */
    const paper = await t.fresh({ viewport: { width: 412, height: 915 } });
    const paperErrs = [];
    paper.on('pageerror', (e) => paperErrs.push(e.message));
    await paper.click('.tab[data-view="macros"]');
    await paper.waitForTimeout(250);
    await paper.click('#macroFill');
    await paper.waitForTimeout(700);
    await paper.evaluate(() => {
      const h = document.querySelector('.mslot [data-mfold]');
      if (h) h.click();
    });
    await paper.waitForTimeout(400);
    const foldedBefore = await paper.evaluate(() => document.querySelectorAll('.mslot-thin').length);
    t.ok('a meal can be folded, so the printer has something to open',
      foldedBefore > 0, String(foldedBefore));
    paperErrs.length = 0;
    await paper.emulateMedia({ media: 'print' });
    await paper.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await paper.waitForTimeout(500);
    const onPaper = await paper.evaluate(() => document.querySelectorAll('.mslot-thin').length);
    t.ok('the day opens for the printer rather than throwing',
      paperErrs.length === 0 && onPaper === 0,
      'errors ' + JSON.stringify(paperErrs) + ' folded-on-paper ' + onPaper);
    await paper.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await paper.waitForTimeout(400);
    t.ok('and closes again afterwards, still without throwing',
      paperErrs.length === 0 &&
        await paper.evaluate(() => document.querySelectorAll('.mslot-thin').length) > 0,
      JSON.stringify(paperErrs));
    await paper.context().close();

    /* ---- the first number a new reader types --------------------------
     * The About-you boxes open at 0 on a first run, right-aligned at the far
     * end of their row, and a tap puts the caret wherever the thumb landed —
     * usually LEFT of the digit. Typing 180 into the weight box produced
     * "1800", which the sheet accepted (max=999 is the browser's business,
     * not mtProfileFromDom's) and turned into a ten-thousand-calorie plan.
     * The very first number anybody types into this app came back wrong by a
     * factor of ten. Typed with real keys at the caret the tap leaves, not
     * with fill(), which replaces the value and would pass either way. */
    const zeroBox = await t.fresh({ viewport: { width: 412, height: 915 } });
    await zeroBox.evaluate(() => localStorage.removeItem('bsc.macroProfile'));
    await zeroBox.reload();
    await zeroBox.waitForTimeout(400);
    await zeroBox.click('.tab[data-view="macros"]');
    await zeroBox.waitForTimeout(300);
    await openPlan(zeroBox);
    await zeroBox.waitForTimeout(500);
    const opensAtZero = await zeroBox.evaluate(() =>
      (document.getElementById('mtLb') || {}).value);
    t.ok('the weight box opens at a nought nobody has answered yet',
      opensAtZero === '0', JSON.stringify(opensAtZero));
    /* A tap at the LEFT edge of the box — where a thumb aiming at the box
       rather than at the digit lands. */
    const lbBox = await zeroBox.$('#mtLb');
    const lbRect = await lbBox.boundingBox();
    await zeroBox.mouse.click(lbRect.x + 4, lbRect.y + lbRect.height / 2);
    await zeroBox.waitForTimeout(200);
    await zeroBox.keyboard.type('180');
    await zeroBox.waitForTimeout(400);
    t.ok('and typing a weight into it gives that weight, not ten times it',
      await zeroBox.evaluate(() => (document.getElementById('mtLb') || {}).value) === '180',
      await zeroBox.evaluate(() => (document.getElementById('mtLb') || {}).value));
    await zeroBox.context().close();

    /* ---- "Fill from" governs drafting, not looking ------------------------
     * The setting says what the SOLVER may shop from — a day drafted out of
     * salmon that is not in the house is not a day. It was also gating the
     * "Single foods" lens and the typed-word pool, so all twenty-eight
     * outside foods vanished from the one lens whose whole job is "let me
     * look through the shelf" — while the same foods came straight back the
     * moment you typed their name. A shelf disagreeing with its own search
     * box. Three comments in the file say the gate is about drafting; only
     * the four drafting pools should hold it, and this asserts BOTH halves,
     * because deleting the gate outright would be the worse bug. */
    const extGate = async (extFill) => {
      const pg = await t.fresh({ viewport: { width: 412, height: 915 } });
      await pg.evaluate((e) => {
        localStorage.setItem('bsc.macroProfile', JSON.stringify({ sex: 'm', age: 43,
          ft: 5, inch: 11, lb: 190, act: 1.375, goal: 'cut1', goalLb: 0, goalBy: '',
          workouts: 4, steps: 8000, extFill: e }));
      }, extFill);
      await pg.reload();
      await pg.waitForTimeout(400);
      await pg.click('.tab[data-view="macros"]');
      await pg.waitForTimeout(300);
      await addOn(pg);
      await pg.waitForTimeout(600);
      await pg.evaluate(() => {
        const sel = document.getElementById('mpSec');
        if (sel) { sel.value = 'foods'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      });
      await pg.waitForTimeout(500);
      const out = await pg.evaluate(() => {
        const N = window.Nutrition.FOODS;
        const isExt = (id) => id.indexOf('f:') === 0 && N[id.slice(2)] && !!N[id.slice(2)].ext;
        const rows = [...document.querySelectorAll('.mpick-row[data-mpick]')]
          .map((r) => r.dataset.mpick);
        const lev = window.__macroLab.levers();
        const levIds = [].concat(lev.p || [], lev.f || [], lev.c || []).map((x) => x.id);
        return { browse: rows.filter(isExt).length, shelf: rows.length,
          drafting: levIds.filter(isExt).length };
      });
      await pg.context().close();
      return out;
    };
    const gateShut = await extGate(false);
    const gateOpen = await extGate(true);
    /* Counted, not named: the list is capped at forty plus whatever is held,
       and no individual outside food is guaranteed to survive that cap — the
       closers come off a different bench in the two settings and claim
       different rows into `shown`. What is not a matter of ranking is whether
       ANY of them can appear, and before this that number was flatly zero. */
    t.ok('the shelf shows the outside foods even when Fill may not shop for them',
      gateShut.browse > 20, JSON.stringify(gateShut));
    t.ok('and shows about as many of them either way',
      Math.abs(gateShut.browse - gateOpen.browse) <= 4,
      JSON.stringify({ shut: gateShut, open: gateOpen }));
    /* The half that must NOT change: deleting the gate would be worse than
       the bug, because a drafted day would send you shopping. */
    t.ok('while the solver still refuses to draft from them',
      gateShut.drafting === 0 && gateOpen.drafting > 0,
      JSON.stringify({ shutDraft: gateShut.drafting, openDraft: gateOpen.drafting }));

    /* ---- the lens and the order keep the focus that changed them ----------
     * Both selects used to sit in .mp-controls, a sibling of #mpList, where
     * redrawing the list could not touch them. They moved onto the "Fits best
     * / On the shelf" divider, which mpFitsHTML returns as PART of the list —
     * so the redraw destroyed the very select that asked for it and focus
     * fell to the body. A keyboard or screen-reader user had to tab from the
     * top of the sheet back down again for every change. focusKey already
     * falls back to #id; nothing was holding on. */
    const lensPg = await t.fresh({ viewport: { width: 412, height: 915 } });
    await lensPg.click('.tab[data-view="macros"]');
    await lensPg.waitForTimeout(250);
    await addOn(lensPg);
    await lensPg.waitForTimeout(600);
    const held = [];
    for (const [id, val] of [['mpSec', 'all'], ['mpSort', 'protein']]) {
      await lensPg.focus('#' + id);
      await lensPg.selectOption('#' + id, val);
      await lensPg.waitForTimeout(350);
      held.push(await lensPg.evaluate((i) => ({
        id: i, active: document.activeElement ? document.activeElement.id || document.activeElement.tagName : 'NONE',
        value: (document.getElementById(i) || {}).value }), id));
    }
    t.ok('changing the lens leaves the focus on the lens',
      held[0].active === 'mpSec' && held[0].value === 'all', JSON.stringify(held[0]));
    t.ok('and changing the order leaves it on the order',
      held[1].active === 'mpSort' && held[1].value === 'protein', JSON.stringify(held[1]));
    await lensPg.context().close();

    const findPg = await t.fresh({ viewport: { width: 412, height: 915 } });
    await findPg.click('.tab[data-view="macros"]');
    await findPg.waitForTimeout(250);
    await addOn(findPg);
    await findPg.waitForTimeout(500);
    const bandsOf = () => findPg.evaluate(() =>
      [...document.querySelectorAll('#mpList .mt-div')].map((e) => e.textContent));
    const resting = await bandsOf();
    t.ok('the resting screen has a search box on it',
      await findPg.evaluate(() => !!document.getElementById('mpFind')));
    t.ok('and ranked bands under it', resting.length > 0, JSON.stringify(resting));

    /* A word taken from a row the ranking itself chose, so the assertion is
       that the band SURVIVES being searched — never a literal dish, which
       would be pinning today's arithmetic. */
    /* A word from a RECIPE in the ranked bands, not from whatever row is
       first: a food that matches by name is hoisted into its own "Foods" band
       ahead of everything, so a word taken from row one tests the hoist
       rather than the survival of the ranking. */
    const word = await findPg.evaluate(() => {
      const row = [...document.querySelectorAll('#mpList .mpick-wrap')]
        .find((w) => {
          const b = w.querySelector('.mpick-row');
          return b && !/^f:/.test(b.dataset.mpick);
        });
      const n = row ? (row.querySelector('.mp-name') || {}).textContent || '' : '';
      return (n.split(/[\s,&]+/).find((w2) => w2.length > 4) || '').toLowerCase();
    });
    await findPg.fill('#mpFind', word);
    await findPg.waitForTimeout(450);
    const narrowed = await bandsOf();
    t.ok('typing keeps the ranked bands rather than throwing them away',
      !!word && narrowed.length > 0 &&
      narrowed.some((b) => resting.indexOf(b) >= 0), word + ' -> ' + JSON.stringify(narrowed));

    /* And it still reaches what the bands do not hold. Salmon is deliberately
       kept out of the ranked pool by the storehouse gate; searching must find
       it anyway, because looking a thing up is how you decide to buy it. */
    await findPg.fill('#mpFind', 'salmon');
    await findPg.waitForTimeout(450);
    t.ok('and still finds what the bands were never going to offer',
      await findPg.evaluate(() => [...document.querySelectorAll('#mpList .mp-name')]
        .some((e) => /salmon/i.test(e.textContent))));

    /* THE CONSTRAINT THE WHOLE DESIGN RESTS ON: the box is a SIBLING of
       #mpList, and a keystroke rebuilds only the list. Replacing the sheet
       would redraw the input mid-word. Typed with a real keyboard and the
       caret put back inside the word, because page.fill() would not notice. */
    await findPg.evaluate(() => {
      const i = document.getElementById('mpFind');
      i.focus();
      i.setSelectionRange(3, 3);
    });
    await findPg.keyboard.type('x');
    await findPg.waitForTimeout(400);
    const typedState = await findPg.evaluate(() => ({
      active: document.activeElement.id,
      caret: document.activeElement.selectionStart,
      val: document.activeElement.value }));
    t.ok('and a keystroke leaves the caret where you put it',
      typedState.active === 'mpFind' && typedState.caret === 4 && typedState.val === 'salxmon',
      JSON.stringify(typedState));

    /* Home had no empty state at all — every band returns '' when it has
       nothing, so a query matching nothing rendered a silence. */
    await findPg.fill('#mpFind', 'zzzqqqxx');
    await findPg.waitForTimeout(400);
    t.ok('and a query that matches nothing says so',
      await findPg.evaluate(() => {
        const e = document.querySelector('#mpList .mslot-empty');
        return !!e && /zzzqqqxx/.test(e.textContent);
      }));
    /* ---- the shelf rail --------------------------------------------------
     * Chips that narrow the same list the search box narrows, so the two
     * compose: 🥩 with "chicken" typed is the chicken that is mostly protein.
     * That is why a chip is a filter and not a mode — Recipes as a MODE could
     * never have been crossed with a macro.
     *
     * Measured at 320, the narrowest width supported, because that is where
     * the rail is tightest and the chips nearest the edge. */
    await findPg.context().close();
    const railPg = await t.fresh({ viewport: { width: 320, height: 844 },
      hasTouch: true, isMobile: true });
    await railPg.click('.tab[data-view="macros"]');
    await railPg.waitForTimeout(250);
    await addOn(railPg);
    await railPg.waitForTimeout(500);
    const railInfo = await railPg.evaluate(() => {
      const rail = document.getElementById('mpShelves');
      if (!rail) return null;
      const chips = [...rail.querySelectorAll('[data-mpshelf]')];
      return { n: chips.length,
        labels: chips.map((c) => c.getAttribute('aria-label') || c.textContent.trim()),
        tap: Math.min(...chips.map((c) => Math.round(c.getBoundingClientRect().height))),
        scrolls: rail.scrollWidth - rail.clientWidth > 1,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    t.ok('the picker has a shelf rail', !!railInfo && railInfo.n >= 5, JSON.stringify(railInfo));
    /* A thumb target, and the rail — not the page — is what scrolls sideways. */
    t.ok('and its chips are a thumb’s worth, without pushing the page sideways',
      railInfo.tap >= 40 && railInfo.pageOverflow === 0, JSON.stringify(railInfo));

    /* An 🫒 Oils chip that filters to one row is worse than no chip: it looks
       like the app has nothing when what it has is one oil. Every chip drawn
       has to find something. */
    const shelved = await railPg.evaluate(async () => {
      const out = {};
      const chips = [...document.querySelectorAll('[data-mpshelf]')]
        .map((c) => c.dataset.mpshelf).filter((k) => k);
      for (const k of chips) {
        document.querySelector('[data-mpshelf="' + k + '"]').click();
        await new Promise((r) => setTimeout(r, 120));
        out[k] = document.querySelectorAll('#mpList .mpick-wrap').length;
      }
      return out;
    });
    t.ok('and every chip it draws actually finds something',
      Object.keys(shelved).length > 0 &&
      Object.keys(shelved).every((k) => shelved[k] > 0), JSON.stringify(shelved));

    /* Composed with the box, which is the whole reason it is a filter. */
    await railPg.evaluate(() => {
      const v = document.querySelector('[data-mpshelf="veg"]');
      if (v && v.getAttribute('aria-pressed') !== 'true') v.click();
    });
    await railPg.waitForTimeout(300);
    await railPg.fill('#mpFind', 'bean');
    await railPg.waitForTimeout(450);
    t.ok('a chip and a query narrow together, not one instead of the other',
      await railPg.evaluate(() => {
        const rows = [...document.querySelectorAll('#mpList .mp-name')].map((e) => e.textContent);
        return rows.length > 0 && rows.every((n) => /bean/i.test(n));
      }),
      await railPg.evaluate(() =>
        [...document.querySelectorAll('#mpList .mp-name')].map((e) => e.textContent).join(' | ')));

    /* Same constraint as the keystroke path: pressing a chip repaints the
       list, never the sheet, or the search box would be redrawn mid-word. */
    await railPg.evaluate(() => {
      const i = document.getElementById('mpFind');
      i.focus();
      i.setSelectionRange(2, 2);
    });
    await railPg.keyboard.type('X');
    await railPg.waitForTimeout(350);
    t.ok('and typing after pressing one keeps both the caret and the chip',
      await railPg.evaluate(() => document.activeElement.id === 'mpFind' &&
        document.activeElement.selectionStart === 3 &&
        (document.querySelector('.mp-shelf.on') || {}).dataset.mpshelf === 'veg'));

    /* A recipe used to be unshelvable: mShelfKey returned '' for anything
       without a food flag, which was all 316 of them, so every macro chip
       would have hidden the whole book.
     *
       ASSERTED ON A MACRO CHIP, never the Recipes one. Recipes filters on
       `!r.food` and never asks mShelfKey at all, so it stays green with the
       shelving reverted — I wrote it that way first and only found out by
       mutating the fix back in. A dish under 🥩 is the thing that cannot
       happen unless a recipe can be shelved. */
    await railPg.evaluate(() => {
      const i = document.getElementById('mpFind');
      i.value = '';
      i.dispatchEvent(new Event('input', { bubbles: true }));
      const p2 = document.querySelector('[data-mpshelf="protein"]');
      if (p2) p2.click();
    });
    await railPg.waitForTimeout(400);
    t.ok('and a recipe can sit on a macro shelf, not just a single food',
      await railPg.evaluate(() => {
        const rows = [...document.querySelectorAll('#mpList .mpick-wrap .mpick-row')];
        /* A dish, not a food: food ids are prefixed, recipe ids are numbers. */
        return rows.some((r) => !/^f:/.test(r.dataset.mpick));
      }),
      await railPg.evaluate(() => [...document.querySelectorAll('#mpList .mpick-wrap .mpick-row')]
        .map((r) => r.dataset.mpick).join(',')));
    await railPg.context().close();

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
        kcalAlways: cards.every((c) => !c.querySelector('.mslot-head') ||
          /\uD83D\uDD25\s*\d/.test(c.querySelector('.mslot-head').textContent)),
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
    /* Reversed deliberately. It read "Where the day stands · 60 / 203 g" —
       four bars of standing. Standing is the right question for the strip at
       the top of My Day and the wrong one in this sheet, where you are
       shopping: shopping is done against what is MISSING, and the
       subtraction was being done in Blake's head on every row. */
    t.ok('the picker says what the day is still OWED, as pills',
      !!dayPanel && dayPanel.pills.length === 4 && dayPanel.oldBars === 0,
      JSON.stringify(dayPanel && { cap: dayPanel.cap, n: dayPanel.pills.length,
        bars: dayPanel.oldBars }));

    /* And it is the remainder, computed the same way the bench computes it —
       never a literal, which would pass on an app that had stopped
       subtracting at all. */
    t.ok('and the protein pill is the target less what is on the day',
      !!dayPanel && dayPanel.pills.some((x) => x.n === dayPanel.owedP),
      JSON.stringify({ owed: dayPanel && dayPanel.owedP,
        pills: dayPanel && dayPanel.pills.map((x) => x.txt) }));

    t.ok('and says so, rather than naming a meal or a share',
      /still to fill/i.test(dayPanel.cap) && !/share/i.test(dayPanel.cap), dayPanel.cap);

    /* The flame agrees with the day bar, because both read the calories the
       plates STATE. This sheet used to derive them back out of the grams —
       4P + 4C + 9F — which is how a target becomes calories, a target being
       grams and having no other answer, but not how a plate does. So the same
       day carried two eaten-calorie totals, and a food typed in with only its
       calories had no grams to derive from and counted as nothing at all. */
    const flame = await dosePg.evaluate(() => {
      const L = window.__macroLab, T = L.targets(), tot = L.read().tot;
      const pill = [...document.querySelectorAll('.mp-left .mgp')]
        .find((e) => /🔥/.test(e.textContent));
      return { shown: Number((pill.textContent.match(/\d+/g) || [0]).pop()),
        stated: Math.max(0, Math.round(Math.round(4 * T.p + 4 * T.c + 9 * T.f) - tot.kcal)),
        derived: Math.max(0, Math.round(Math.round(4 * T.p + 4 * T.c + 9 * T.f)
          - (4 * tot.p + 4 * tot.c + 9 * tot.f))) };
    });
    t.ok('the flame counts the calories the plates state, as the day bar does',
      flame.shown === flame.stated, JSON.stringify(flame));
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
          /\/\s*\d/.test((e.querySelector('.mmp-t') || {}).textContent || ''));
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
      ticks: document.querySelectorAll('.mslot-head .mmp-t').length,
      kcal: [...document.querySelectorAll('.mslot-head')]
        .filter((e) => /\uD83D\uDD25\s*\d/.test(e.textContent)).length,
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
    t.ok('a folded meal shows its calories and its macros against the plan',
      quietFolded.cards > 0 && quietFolded.kcal > 0 &&
      quietFolded.gauges > 0 && quietFolded.ticks === quietFolded.gauges * 4 &&
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
      const t2 = card && card.querySelector('.mmp.kc .mmp-t');
      return t2 ? Number(t2.textContent.replace(/[^0-9]/g, '')) : 0;
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

    /* ---- and the un-skip reaches the other phone -------------------------
     * Half of a sync bug lives on the sending side. Un-skipping the last
     * skipped meal deletes the day's entry from MSKIP, and the payload was
     * built by walking MSKIP — so the day stopped being mentioned at all.
     * The document is written with merge: true, so an unmentioned day leaves
     * the server's copy of the skip standing: the other phone kept the meal
     * struck out and Fill kept walking past it.
     *
     * Asserted on the payload and then through the merge, because a test
     * that only exercised the merge would have passed throughout — the
     * empty-list branch it relies on was correct all along and simply never
     * received anything to run on. */
    const wire = await t.fresh({ viewport: { width: 390, height: 800 } });
    await wire.click('.tab[data-view="macros"]');
    await wire.waitForTimeout(300);
    const spOf = (pg) => pg.evaluate(() => {
      const sp = window.__macroLab.payload().sp || {};
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const enc = (d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()))
        .replace(/-/g, '_');
      return { has: Object.prototype.hasOwnProperty.call(sp, enc),
        v: sp[enc] ? sp[enc].v : null, at: sp[enc] ? sp[enc].at : 0 };
    });
    await wire.evaluate(() => document.querySelector('[data-mskip="l"]').click());
    await wire.waitForTimeout(350);
    const sentSkip = await spOf(wire);
    t.ok('skipping a meal is something the payload says out loud',
      sentSkip.has && (sentSkip.v || []).indexOf('l') >= 0, JSON.stringify(sentSkip));
    await wire.evaluate(() => {
      const u = document.querySelector('.mslot-skipped [data-mskip]');
      if (u) u.click();
    });
    await wire.waitForTimeout(350);
    const sentBack = await spOf(wire);
    t.ok('and so is taking it back — an empty list, not a silence',
      sentBack.has && Array.isArray(sentBack.v) && sentBack.v.length === 0 &&
        sentBack.at > 0, JSON.stringify(sentBack));

    /* The receiving half, fed exactly what the sending half now emits. */
    const landed = await wire.evaluate((wireSp) => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const key = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      const enc = key.replace(/-/g, '_');
      /* This phone still believes the meal is skipped, stamped older than the
         un-skip the other one is sending. */
      localStorage.setItem('bsc.macroSkip', JSON.stringify({ [key]: ['l'] }));
      const st = JSON.parse(localStorage.getItem('bsc.myStamps') || '{}');
      st.sp = st.sp || {}; st.sp[key] = wireSp.at - 1000;
      localStorage.setItem('bsc.myStamps', JSON.stringify(st));
      return { before: JSON.parse(localStorage.getItem('bsc.macroSkip')),
        enc: enc, at: wireSp.at };
    }, sentBack);
    await wire.reload();
    await wire.waitForTimeout(400);
    const merged = await wire.evaluate((info) => {
      const doc = { sp: {} };
      doc.sp[info.enc] = { v: [], at: info.at };
      window.__macroLab.merge(doc);
      return JSON.parse(localStorage.getItem('bsc.macroSkip') || '{}');
    }, landed);
    t.ok('so the other phone stops striking the meal out',
      !Object.keys(merged).length || !(merged[Object.keys(merged)[0]] || []).length,
      'before ' + JSON.stringify(landed.before) + ' after ' + JSON.stringify(merged));
    await wire.context().close();

    /* ---- a morning you cleared stays cleared, on both phones --------------
     * The weight log was stamped as ONE value, the way the profile is. One
     * stamp for a whole map can say "mine is newer" and nothing else — so a
     * merge that replaced wholesale would drop every morning the newer phone
     * had not seen, and the merge that shipped unioned instead. Union has no
     * way to express a morning taken away, so clearing a weigh-in here and
     * opening the other phone brought it straight back. Since v271 that also
     * moves the targets, because the plan is built on the seven-day average.
     *
     * Stamped per morning now, like the day log and the closed days, with
     * zero meaning "no weigh-in for this morning" exactly as zero means
     * "reopened" over there. */
    const scale = await t.fresh({ viewport: { width: 390, height: 800 } });
    await scale.click('.tab[data-view="macros"]');
    await scale.waitForTimeout(300);
    const wPayload = (pg) => pg.evaluate(() => {
      const w = window.__macroLab.payload().w || {};
      const out = {};
      Object.keys(w).forEach((k) => { out[k.replace(/_/g, '-')] = w[k]; });
      return out;
    });
    const seedW = (pg, map, stampAt) => pg.evaluate((a) => {
      localStorage.setItem('bsc.macroWeights', JSON.stringify(a.map));
      const st = JSON.parse(localStorage.getItem('bsc.myStamps') || '{}');
      st.w = {};
      Object.keys(a.map).forEach((k) => { st.w[k] = a.at; });
      localStorage.setItem('bsc.myStamps', JSON.stringify(st));
    }, { map: map, at: stampAt });

    await seedW(scale, { '2026-09-01': 190, '2026-09-02': 189 }, 1000);
    await scale.reload();
    await scale.waitForTimeout(400);
    await scale.click('.tab[data-view="macros"]');
    await scale.waitForTimeout(300);

    /* Clearing a morning is a value the payload carries, not an absence. */
    const cleared = await scale.evaluate(() => {
      window.__macroLab.merge({ w: { '2026_09_02': { v: 0, at: 5000 } } });
      return { stored: JSON.parse(localStorage.getItem('bsc.macroWeights')),
        sent: window.__macroLab.payload().w['2026_09_02'] };
    });
    t.ok('a cleared morning is a zero the payload states, not a key it drops',
      cleared.stored['2026-09-02'] === undefined && cleared.sent &&
        cleared.sent.v === 0 && cleared.sent.at === 5000, JSON.stringify(cleared));

    /* And it does not come back on the next push from the other phone. */
    const resurrect = await scale.evaluate(() => {
      window.__macroLab.merge({ w: { '2026_09_01': { v: 190, at: 6000 },
        '2026_09_02': { v: 189, at: 4000 } } });
      return JSON.parse(localStorage.getItem('bsc.macroWeights'));
    });
    t.ok('and an older push carrying it again does not raise it',
      resurrect['2026-09-02'] === undefined && resurrect['2026-09-01'] === 190,
      JSON.stringify(resurrect));

    /* Weighing again on that date is newer, so it wins. */
    const relog = await scale.evaluate(() => {
      window.__macroLab.merge({ w: { '2026_09_02': { v: 187.5, at: 9000 } } });
      return JSON.parse(localStorage.getItem('bsc.macroWeights'));
    });
    t.ok('and standing on the scale again puts it back',
      relog['2026-09-02'] === 187.5, JSON.stringify(relog));

    /* The property that ruled out replacing the map wholesale: a phone that
       was offline when this morning was logged sends a NEWER map without it,
       and this morning must survive that. */
    const keptW = await scale.evaluate(() => {
      window.__macroLab.merge({ w: { '2026_09_03': { v: 186, at: 20000 } } });
      return JSON.parse(localStorage.getItem('bsc.macroWeights'));
    });
    t.ok('a newer phone that never saw a morning does not erase it',
      keptW['2026-09-01'] === 190 && keptW['2026-09-03'] === 186, JSON.stringify(keptW));

    /* A phone still on the old build pushes the old single-stamped shape.
       It cannot express a deletion, so it is unioned exactly as before —
       guessing a deletion from an absent key would erase every morning that
       phone has not heard of. */
    const legacy = await scale.evaluate(() => {
      window.__macroLab.merge({ w: { v: { '2026-08-30': 192 }, at: 999999 } });
      return JSON.parse(localStorage.getItem('bsc.macroWeights'));
    });
    t.ok('and a phone on the old build is still understood',
      legacy['2026-08-30'] === 192 && legacy['2026-09-01'] === 190, JSON.stringify(legacy));
    await scale.context().close();

    /* The upgrade itself: a device arriving with one number where the map now
       goes. Read as a map that number swallows every write in silence, so it
       is converted at load with the old stamp standing for every morning
       already logged. */
    const upgrade = await t.fresh({ viewport: { width: 390, height: 800 } });
    await upgrade.evaluate(() => {
      localStorage.setItem('bsc.macroWeights',
        JSON.stringify({ '2026-09-01': 190, '2026-09-02': 189 }));
      localStorage.setItem('bsc.myStamps', JSON.stringify({ w: 4242 }));
    });
    await upgrade.reload();
    await upgrade.waitForTimeout(400);
    await upgrade.click('.tab[data-view="macros"]');
    await upgrade.waitForTimeout(300);
    const converted = await upgrade.evaluate(() => {
      const st = JSON.parse(localStorage.getItem('bsc.myStamps'));
      const sent = window.__macroLab.payload().w;
      return { shape: typeof st.w, stamps: st.w,
        sent01: sent['2026_09_01'], sent02: sent['2026_09_02'] };
    });
    t.ok('a device upgrading turns its one weight stamp into one per morning',
      converted.shape === 'object' && converted.stamps['2026-09-01'] === 4242 &&
        converted.sent01.v === 190 && converted.sent02.at === 4242,
      JSON.stringify(converted));
    await upgrade.context().close();

    /* ---- Balance solves against the share the card is printing ------------
     * The meal's pills say what the meal is owed; the ⚖ on the same card
     * solves the plates toward it. Those were two different sums: the pills
     * drop a meal you have skipped and left empty, and the button divided by
     * every slot on the day regardless. So on a day with skips the button
     * pulled a meal to roughly half of the target printed an inch above it,
     * then the pills called it short. Asserted against the pills' own printed
     * denominator rather than a computed share, because the pills are what
     * the reader is looking at when they press it. */
    /* Seeded rather than Filled: mFill picks at random from its top three, so
       a day it builds is a different day each run — and this assertion is a
       comparison between two days that have to be identical apart from the
       skips. The two dishes come out of window.RECIPES at run time, never
       written down here. */
    const balDay = async (skips) => {
      const pg = await t.fresh({ viewport: { width: 390, height: 800 } });
      await pg.click('.tab[data-view="macros"]');
      await pg.waitForTimeout(250);
      await pg.evaluate(() => {
        /* Protein-dense and small, so the solver's answer is an interior one
           it has to think about. Given two carb-heavy dishes it drives both
           days to the ×¼ floor — the same answer for opposite reasons, which
           tells a comparison nothing. */
        const two = window.RECIPES.filter((r) => r.macro && r.macro.kcal > 40)
          .sort((a, b) => (b.macro.p / b.macro.kcal) - (a.macro.p / a.macro.kcal))
          .slice(0, 2);
        const d = new Date();
        const p2 = (n) => (n < 10 ? '0' : '') + n;
        const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
        localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]:
          { b: [], l: two.map((r) => ({ id: r.id, x: 1, eaten: 0 })), d: [], s: [] } }));
      });
      await pg.reload();
      await pg.waitForTimeout(400);
      await pg.click('.tab[data-view="macros"]');
      await pg.waitForTimeout(350);
      for (const sk of skips) {
        await pg.evaluate((s2) => {
          const b = document.querySelector('[data-mskip="' + s2 + '"]');
          if (b) b.click();
        }, sk);
        await pg.waitForTimeout(250);
      }
      return pg;
    };
    /* Found by its NAME, and opened first. The Balance button moved to the
       foot of the OPEN meal, so a folded lunch carries no [data-mbal] to find
       the card by — and with one meal open at a time, lunch is usually the
       folded one. The pills are read off the head either way. */
    const lunchOf = (pg) => pg.evaluate(() => {
      const card = [...document.querySelectorAll('.mslot')]
        .find((c) => ((c.querySelector('.mslot-name') || {}).textContent || '') === 'Lunch');
      const head = card && card.querySelector('[data-mfold]');
      if (head && head.getAttribute('aria-expanded') === 'false') head.click();
      const L = window.__macroLab.read();
      const meal = L.meals.find((m) => m.k === 'l') || { items: [] };
      return {
        want: card ? [...card.querySelectorAll('.mmp')].map((e) =>
          Number(((e.querySelector('.mmp-t') || {}).textContent || '').replace('/', '')) || 0) : null,
        kcal: Math.round(meal.items.reduce((n, i) => n + i.kcal * i.x, 0)),
        xs: meal.items.map((i) => i.x).join(','),
      };
    });

    const plain = await balDay([]);
    /* Every other meal skipped, so lunch's share is the whole day against the
       quarter of it the old sum handed out — far enough apart that a step of
       an eighth cannot land on both. */
    const withSkips = await balDay(['b', 'd', 's']);
    const plainBefore = await lunchOf(plain);
    const skipBefore = await lunchOf(withSkips);
    t.ok('skipping the other meals raises what lunch is asked to hold',
      !!plainBefore.want && !!skipBefore.want && skipBefore.want[0] > plainBefore.want[0],
      JSON.stringify({ plain: plainBefore.want, skipped: skipBefore.want }));

    /* The bug, stated as a comparison. The pills already dropped a skipped
       empty meal from the sum; the button divided by every slot regardless —
       so the SAME two dishes solved to exactly the same portions on both of
       these days, while the cards above them printed different targets. */
    /* lunchOf has already opened each lunch, which is what puts its Balance
       button on the page at all. */
    await plain.click('[data-mbal="l"]');
    await withSkips.click('[data-mbal="l"]');
    await plain.waitForTimeout(700);
    await withSkips.waitForTimeout(700);
    const plainAfter = await lunchOf(plain);
    const skipAfter = await lunchOf(withSkips);
    t.ok('so balancing aims at the raised share, not the whole-day one',
      skipAfter.kcal > plainAfter.kcal,
      JSON.stringify({ plain: plainAfter, skipped: skipAfter }));
    await plain.context().close();
    await withSkips.context().close();

    /* Done for the day.
     *
       A statement, not a change: nothing is deleted, food can still be added,
       and pressing it again takes it back. The card comes up on the way in
       and not on the way out — closing is the moment you want to be told how
       it went, reopening is only a correction. */
    const closed = await t.fresh({ viewport: { width: 390, height: 800 } });
    await closed.click('.tab[data-view="macros"]');
    await closed.waitForTimeout(300);
    await closed.click('#macroFill');
    await closed.waitForTimeout(600);
    const barFits = await closed.evaluate(() => {
      const bar = document.querySelector('.mday-acts');
      const fill = document.getElementById('macroFill');
      return { wraps: bar.scrollWidth > bar.clientWidth + 1,
        fill: Math.round(fill.getBoundingClientRect().width),
        label: fill.scrollWidth <= fill.clientWidth + 1 };
    });
    /* Six controls on one bar was the ask; keeping the word "Fill" readable
       is the part that has to survive it. */
    t.ok('six controls still fit the bar on a phone, with Fill still a word',
      !barFits.wraps && barFits.label && barFits.fill > 60, JSON.stringify(barFits));

    await closed.click('#macroDone');
    await closed.waitForTimeout(500);
    const dayCard = await closed.evaluate(() => {
      const sh = document.querySelector('.ds-sheet');
      if (!sh) return null;
      const num = (el) => Number((el.textContent.replace(/,/g, '').match(/\d+/) || [0])[0]);
      return {
        says: sh.querySelector('.ds-says').textContent.trim(),
        ring: num(sh.querySelector('.ds-ring-m b')),
        macros: [...sh.querySelectorAll('.ds-mk')].map((e) => e.textContent.trim()).join(),
        targetMarks: sh.querySelectorAll('.ds-mk-t').length,
        weekBars: sh.querySelectorAll('.ds-wk').length,
        targetLine: !!sh.querySelector('.ds-line'),
        pips: sh.querySelectorAll('.ds-pip').length,
        split: sh.querySelectorAll('.ds-split span').length,
        biggest: (sh.querySelector('.ds-splitl b') || {}).textContent || ''
      };
    });
    /* A sentence before a number: at nine at night the useful thing is what
       kind of day it was, and the arithmetic is the evidence for it. */
    /* Not "contains a number" — a day that went well says "On the day and on
       the protein. Nothing to fix.", and demanding a digit there was asking
       the sentence to be a statistic, which is the thing it is not. */
    t.ok('closing the day says what kind of day it was, in words',
      !!dayCard && dayCard.says.length > 12 && / /.test(dayCard.says.trim()),
      JSON.stringify(dayCard));
    t.ok('and shows the day as a ring, three macros and seven days',
      dayCard.macros === 'P,F,C' && dayCard.weekBars === 7 && dayCard.ring > 0,
      JSON.stringify(dayCard));
    /* The three things that make it readable rather than a list of numbers:
       a mark where each target sits, a target line across the week, and the
       day broken down by meal. */
    t.ok('and marks where each target sits, so overshoot is a distance',
      dayCard.targetMarks === 3, JSON.stringify(dayCard));
    t.ok('and draws the target across the week rather than narrating it',
      dayCard.targetLine, JSON.stringify(dayCard));
    t.ok('and says how much of the day landed in one meal',
      dayCard.split > 0 && /%/.test(dayCard.biggest), JSON.stringify(dayCard));
    t.ok('and carries the week\u2019s protein record inside the day',
      dayCard.pips === 7, JSON.stringify(dayCard));
    /* A day never written down is a gap in the record, not a day the protein
       was missed on — the same rule the week bars follow. Reading blanks as
       misses is the exact lie this card exists not to tell. */
    t.ok('and an unlogged day is a gap, not a miss',
      await closed.evaluate(() => {
        const gap = [...document.querySelectorAll('.ds-pip')].filter((e) =>
          !e.className.match(/hit|miss|today/));
        if (!gap.length) return true;                 // a fully logged week
        return getComputedStyle(gap[0]).borderStyle.indexOf('dashed') === 0;
      }));
    /* The numbers are read back through the same two functions the pills use,
       so the card and the strip cannot disagree about what you ate. */
    t.ok('and its numbers are the ones already on the screen',
      await closed.evaluate(() => {
        const got = document.querySelectorAll('.ds-mv')[0].textContent;
        const L = window.__macroLab;
        const tot = L.read().tot, T = L.targets();
        const nums = got.replace(/,/g, '').match(/\d+/g) || [];
        return Number(nums[0]) === Math.round(tot.p) && Number(nums[1]) === Math.round(T.p);
      }));
    /* The Done button has to actually be a button. It shipped with
       data-close="1" and nothing else, and data-close turns out to be
       decorative everywhere it appears — the modal closes on .scrim and
       .sheet-x. It was wearing a wire that was never connected. */
    await closed.click('.ds-sheet .sheet-done');
    /* close() unwinds the history entries the sheet pushed, and that lands on
       popstate — so the card is gone a tick later, not on the same line as
       the click. Checking synchronously said "still open" about a button that
       works perfectly. */
    await closed.waitForTimeout(350);
    t.ok('and the Done button closes the card',
      await closed.evaluate(() => !document.querySelector('.ds-sheet')));
    await closed.waitForTimeout(300);
    t.ok('and the day is marked closed on the bar',
      await closed.evaluate(() => {
        const b = document.getElementById('macroDone');
        return b.getAttribute('aria-pressed') === 'true' && b.classList.contains('done');
      }));
    /* Nothing was taken away by closing it. */
    t.ok('and nothing on the day was removed by saying you were done',
      await closed.evaluate(() => document.querySelectorAll('.mslot').length > 0 &&
        !document.getElementById('macroFill').disabled === false ||
        document.querySelectorAll('.mitem, .mthin').length > 0));
    await closed.click('#macroDone');
    await closed.waitForTimeout(400);
    t.ok('and pressing it again reopens the day, without a card this time',
      await closed.evaluate(() =>
        document.getElementById('macroDone').getAttribute('aria-pressed') === 'false' &&
        !document.querySelector('.ds-sheet')));
    /* It survives a reload, which is the whole point of it being a record. */
    await closed.click('#macroDone');
    await closed.waitForTimeout(400);
    await closed.click('.sheet-x');
    await closed.waitForTimeout(200);
    await closed.reload();
    await closed.click('.tab[data-view="macros"]');
    await closed.waitForTimeout(500);
    t.ok('and a closed day is still closed tomorrow morning',
      await closed.evaluate(() =>
        document.getElementById('macroDone').getAttribute('aria-pressed') === 'true'));

    /* The menu opens the same card for a day you have not closed. */
    await closed.click('#macroMore');
    await closed.waitForTimeout(120);
    await closed.click('[data-mmore="went"]');
    await closed.waitForTimeout(400);
    t.ok('and the menu opens it for whatever day you are looking at',
      await closed.evaluate(() => !!document.querySelector('.ds-sheet')));
    await closed.click('.sheet-x');
    await closed.waitForTimeout(200);

    /* The merge rule, which is where the trap is. Zero means REOPENED, and
       the general merge above skips falsy values — so a reopen would have been
       silently undone by any device that still remembered the close. */
    t.ok('reopening a day travels; it is not overwritten by the close it undid',
      await closed.evaluate(() => {
        const k = Object.keys(JSON.parse(localStorage.getItem('bsc.macroDone') || '{}'))[0];
        if (!k) return false;
        const enc = k.replace(/-/g, '_');
        const later = Date.now() + 60000;
        const before = JSON.parse(localStorage.getItem('bsc.macroDone'))[k];
        window.Store.__mergeProbe = null;
        // hand the app a remote that says "reopened, and more recently"
        const moved = window.__macroLab.merge
          ? window.__macroLab.merge({ dn: { [enc]: { v: 0, at: later } } }) : 'no hook';
        const after = JSON.parse(localStorage.getItem('bsc.macroDone'))[k];
        return moved !== 'no hook' ? (before > 0 && after === 0) : 'no hook';
      }) === true,
      'needs a merge hook on the lab');
    await closed.context().close();

    /* One tap on a spent portion hands the stepper back.
     *
       Correcting a portion after ticking used to be untick, adjust, re-tick —
       three actions for the ordinary case of having eaten more than planned.
       It is still a deliberate act, it is just no longer a chore. */
    const wake = await t.fresh({ viewport: { width: 390, height: 800 } });
    await wake.click('.tab[data-view="macros"]');
    await wake.waitForTimeout(300);
    await wake.click('#macroFill');
    await wake.waitForTimeout(600);
    await wake.evaluate(() => {
      const b = document.querySelector('.mslot-head[aria-expanded="false"]');
      if (b) b.click();
    });
    await wake.waitForTimeout(300);
    /* the type BEFORE it is eaten, to compare against after */
    const typeWas = await wake.evaluate(() => {
      const c = getComputedStyle(document.querySelector('.mstep-x'));
      return { size: c.fontSize, weight: c.fontWeight };
    });
    await wake.click('.mitem [data-meat]');
    await wake.waitForTimeout(400);
    t.ok('a locked portion offers a way back in',
      await wake.evaluate(() => !!document.querySelector('.mstep-wake')));
    /* And it does not change SIZE on the way.
     *
       Ticking a plate made its portion jump from 12px to 15px, because the
       way back in is a <button> and `.mstep button` sets 15px for the − and +
       keys — more specific than .mstep-x, so the row's own size lost. The one
       row that should look like it has settled down instead shouted. Same
       type, eaten or not. */
    t.ok('and the portion does not grow just because it was eaten',
      await wake.evaluate((was) => {
        const c = getComputedStyle(document.querySelector('.mstep-x'));
        return c.fontSize === was.size && c.fontWeight === was.weight;
      }, typeWas),
      await wake.evaluate(() => {
        const c = getComputedStyle(document.querySelector('.mstep-x'));
        return 'eaten ' + c.fontSize + '/' + c.fontWeight;
      }));
    await wake.click('.mstep-wake');
    await wake.waitForTimeout(400);
    const woke = await wake.evaluate(() => {
      const st = document.querySelector('.mstep');
      return { live: [...st.querySelectorAll('[data-mstep]')].every((b) => !b.disabled),
        grey: st.classList.contains('spent'),
        stillEaten: !!document.querySelector('.mitem [data-meat]:checked') };
    });
    t.ok('and one tap wakes it, without unticking the meal',
      woke.live && !woke.grey && woke.stillEaten, JSON.stringify(woke));
    /* And it actually moves — waking it is no use if the press is still
       refused by the handler's own rule. */
    t.ok('and the portion can then be changed',
      await wake.evaluate(() => {
        const was = document.querySelector('.mstep-x').textContent.trim();
        document.querySelector('[data-mstep$=":up"]').click();
        return document.querySelector('.mstep-x').textContent.trim() !== was;
      }));

    /* Ten "not that one"s is disagreement, not exhaustion — a lunch has forty
       recipes and the cursor wraps long before you run out. So the meal stops
       being confined to its own sections, and says so, because a roast beef
       breakfast arriving unannounced reads as a fault. */
    const argued = await t.fresh({ viewport: { width: 390, height: 800 } });
    await argued.click('.tab[data-view="macros"]');
    await argued.waitForTimeout(300);
    await argued.click('#macroFill');
    await argued.waitForTimeout(600);
    /* No assertion on a LABEL any more. It said "everywhere", which only means
       something to somebody who already knows a meal is normally fenced to its
       own sections — and that fence has no marker of its own, so the word was
       naming the exit from a room nobody had been told they were in. What is
       asserted below is the thing that actually matters and always did: that
       the pool really does get wider. */
    /* And the widening is real, not just a caption: what it offers now has to
       be reachable from outside that meal's own sections. */
    t.ok('and the pool it draws from is genuinely wider',
      await argued.evaluate(() => {
        const L = window.__macroLab;
        return L.rank('b', 40).length > L.rank('l', 40).length ||
          window.RECIPES.filter((r) => r.book === 1 && r.secNum === 1).length < 40;
      }));
    await argued.context().close();
    await wake.context().close();

    /* Nobody asked the app for three servings.
     *
       Undershoot is judged against the meal's share and overshoot against the
       DAY's remaining, which is right for the day and blind for the meal: at
       breakfast, with nothing eaten, one dish could claim all the day's
       protein and be charged nothing. The ranking really did offer ×3 of a
       271 kcal plate — 813 kcal — for a meal whose share was 381. That is
       where a lot of overeating starts: not a plan going wrong later, a
       number too big when it was first put in front of you.

       So a suggestion may run over its share, because meals are not equal,
       but not without limit. Measured on the day the cap went in: meals off
       their share fell 813 → 427 kcal and the day's protein got BETTER. */
    const roomy = await t.fresh({ viewport: { width: 390, height: 800 } });
    await roomy.click('.tab[data-view="macros"]');
    await roomy.waitForTimeout(300);
    const over = await roomy.evaluate(() => {
      const L = window.__macroLab;
      L.forget();
      const T = L.targets();
      const dayK = 4 * T.p + 4 * T.c + 9 * T.f;
      const meals = L.read().meals;
      let wSum = 0; meals.forEach((m) => { wSum += m.w; });
      const worst = [];
      meals.forEach((m) => {
        const share = dayK * m.w / wSum;
        L.rank(m.k, 12).forEach((e) => {
          const ratio = (e.kcal * e.x) / share;
          if (ratio > worst.ratio || !worst.length) worst.push({ name: e.name, x: e.x,
            kcal: Math.round(e.kcal * e.x), share: Math.round(share), ratio: +ratio.toFixed(2) });
        });
      });
      worst.sort((a, b) => b.ratio - a.ratio);
      return worst.slice(0, 3);
    });
    /* 1.15 is the cap plus room for the rounding in a quarter-serving grid —
       what is being asserted is that nothing is offered at close to DOUBLE
       the meal it belongs to, which is what used to happen. */
    t.ok('no meal is offered a portion wildly over its own share',
      over.every((w) => w.ratio <= 1.35),
      JSON.stringify(over));
    await roomy.context().close();

    /* A plate you have eaten is a record, not a dial.
     *
       Resizing what you already ate is editing the past, so the stepper goes
       quiet on the tick — and comes back on the untick, because nothing here
       is one-way. The lock goes with it: Rebalance already skips anything
       eaten, so on that row it was a button with nothing to guard. */
    const spent = await t.fresh({ viewport: { width: 390, height: 800 } });
    await spent.click('.tab[data-view="macros"]');
    await spent.waitForTimeout(300);
    await spent.click('#macroFill');
    await spent.waitForTimeout(600);
    // open a meal so a plate and its stepper are on screen
    await spent.evaluate(() => {
      const b = document.querySelector('.mslot-head[aria-expanded="false"]');
      if (b) b.click();
    });
    await spent.waitForTimeout(300);
    const stepWas = await spent.evaluate(() => {
      const st = document.querySelector('.mstep');
      return { x: st.querySelector('.mstep-x').textContent.trim(),
        live: [...st.querySelectorAll('[data-mstep]')].every((b) => !b.disabled),
        grey: st.classList.contains('spent') };
    });
    t.ok('an uneaten plate can still be resized', stepWas.live && !stepWas.grey,
      JSON.stringify(stepWas));

    await spent.click('.mitem [data-meat]');
    await spent.waitForTimeout(400);
    const stepNow = await spent.evaluate(() => {
      const st = document.querySelector('.mstep');
      return { x: st.querySelector('.mstep-x').textContent.trim(),
        dead: [...st.querySelectorAll('[data-mstep]')].every((b) => b.disabled),
        lockStillLive: !st.querySelector('.mlock').disabled,
        grey: st.classList.contains('spent'),
        /* the STEPPER's own buttons, not the first button in the strip — that
           is the lock, and it is faded by a rule of its own, so reading it
           here passed with the fix reverted and proved nothing. */
        faded: [...st.querySelectorAll('[data-mstep]')]
          .every((b) => parseFloat(getComputedStyle(b).opacity) < 0.6) };
    });
    t.ok('ticking it eaten locks the portion', stepNow.dead && stepNow.grey,
      JSON.stringify(stepNow));
    /* The lock is a different job — it holds a food steady while the other
       meals rebalance around it, which is still worth saying about a plate
       you have eaten. Only the servings lock. */
    t.ok('but the lock is left alone, because it does a different job',
      stepNow.lockStillLive, JSON.stringify(stepNow));
    t.ok('and greys it, rather than leaving it looking live', stepNow.faded,
      JSON.stringify(stepNow));
    /* Still readable: the number is the whole point of keeping the row. */
    t.ok('and the portion it was eaten at is still on the card',
      stepNow.x === stepWas.x && stepNow.x.length > 0, stepWas.x + ' -> ' + stepNow.x);

    /* The rule sits in the handler as well as the markup, because a disabled
       attribute is paint — anything that reaches the delegated handler by
       another road still has to be refused. */
    t.ok('and the day does not move even if the press gets through',
      await spent.evaluate(() => {
        const st = document.querySelector('.mstep');
        const was = st.querySelector('.mstep-x').textContent.trim();
        const b = st.querySelector('[data-mstep$=":up"]');
        b.disabled = false;               // the paint comes off
        b.click();
        const now = document.querySelector('.mstep .mstep-x').textContent.trim();
        return was === now;
      }));

    await spent.click('.mitem [data-meat]');
    await spent.waitForTimeout(400);
    t.ok('unticking hands the stepper back',
      await spent.evaluate(() => {
        const st = document.querySelector('.mstep');
        return !st.classList.contains('spent') &&
          [...st.querySelectorAll('[data-mstep]')].every((b) => !b.disabled);
      }));
    await spent.context().close();


    /* The bench measures the shipped code or it measures nothing.
     *
       window.__macroLab.draft() exists so a few thousand days can be drafted
       without a render between them — Fill picks at random from the top three
       fits, so comparing two settings honestly means running both over the
       same days, and that is only affordable with the screen out of the way.
       The risk that buys is a bench that quietly stops being the button. So:
       same seed, same empty day, both routes, same plates at the same
       portions. Its own page, because it drafts and discards days and the
       tests after this one are reading the day it would leave behind. */
    const lab = await t.fresh({ viewport: { width: 390, height: 800 } });
    await lab.click('.tab[data-view="macros"]');
    await lab.waitForTimeout(300);
    t.ok('the bench drafts the same day the button does',
      await lab.evaluate(() => {
        const L = window.__macroLab;
        if (!L) return 'no lab';
        const seeded = (a) => () => {
          a |= 0; a = a + 0x6D2B79F5 | 0;
          let t = Math.imul(a ^ a >>> 15, 1 | a);
          t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
        const real = Math.random;
        const plates = () => L.read().meals.map((m) =>
          m.k + ':' + m.items.map((i) => i.id + '@' + i.x).join(',')).join('|');
        Math.random = seeded(7); L.forget(); L.draft();
        const viaLab = plates();
        /* The button disables itself once every meal has food, and forget()
           empties the day without redrawing — so the disabled flag is left
           over from the render before it. Clear it; what is under test is the
           draft, not the button's own enabling. */
        Math.random = seeded(7); L.forget();
        document.getElementById('macroFill').disabled = false;
        document.getElementById('macroFill').click();
        const viaBtn = plates();
        Math.random = real;
        return viaLab === viaBtn && viaLab.indexOf('@') > 0 ? true : viaLab + ' !== ' + viaBtn;
      }) === true,
      await lab.evaluate(() => 'see above'));
    await lab.context().close();

    /* The guard that survived the move, and has to.
     *
       Refusing a meal over a portion that has not been settled yet is wrong;
       refusing a day that is already accounted for is right. Press Fill at
       nine at night with everything logged and it should add nothing at all.
       So the question is still asked — once, up front, about what the day
       already held rather than about the draft being written. Delete it and
       this goes red. */
    const noRoom = await t.fresh({ viewport: { width: 390, height: 800 } });
    await noRoom.evaluate(() => localStorage.setItem('bsc.macroTargets',
      JSON.stringify({ p: 5, f: 2, c: 5 })));   // 58 kcal of room: under the floor
    await noRoom.reload();
    await noRoom.click('.tab[data-view="macros"]');
    await noRoom.waitForTimeout(400);
    await noRoom.click('#macroFill');
    await noRoom.waitForTimeout(500);
    t.ok('a day with no room left is not filled with food anyway',
      await noRoom.evaluate(() =>
        document.querySelectorAll('.mitem, .mthin').length === 0),
      await noRoom.evaluate(() =>
        document.querySelectorAll('.mitem, .mthin').length + ' plates drafted'));
    await noRoom.context().close();
    t.ok('the draft chases the protein target',
      drafted.tot.p >= 0.6 * planP, Math.round(drafted.tot.p) + ' of ' + planP);
    t.ok('without blowing the fat budget wide open',
      drafted.tot.f <= planF + 30, Math.round(drafted.tot.f) + ' vs ' + planF);
    /* Disabled exactly when there is nothing left to draft. Fill stops once a
       meal's remaining budget is under a hundred calories, so on a tight plan
       it can honestly leave the last one empty — and then the button is
       rightly still live. Asserting "always disabled after Fill" made this a
       coin toss on which meals the draft happened to reach. */
    t.ok('the button goes quiet exactly when every meal has something',
      drafted.fillDisabled === drafted.perSlot.every((n) => n >= 1),
      'disabled=' + drafted.fillDisabled + ' slots=' + drafted.perSlot.join(','));

    /* One press has to produce a day you could actually eat to. Four dishes
       sized against their own shares land the day near the target but not on
       it, so Fill settles the portions and then closes what is left with a
       single food. Judged against the app's OWN target for the day, which is
       the cycled one — the base plan is not what any single day is aiming at.
       The tolerance is a real day's worth of slack, not a rounding error. */
    const kcalBar = drafted.bars.find((b) => b.m === 'kcal');
    const pBar = drafted.bars.find((b) => b.m === 'p');
    t.ok('a drafted day lands on the day\'s own calorie target',
      Math.abs(kcalBar.have - kcalBar.want) <= kcalBar.want * 0.10,
      kcalBar.have + ' of ' + kcalBar.want);
    t.ok('and does not leave the protein behind to get there',
      pBar.have >= pBar.want * 0.88, pBar.have + ' of ' + pBar.want + ' g');
    /* A topper finishes a day; it does not become the day. */
    t.ok('and tops up with at most a couple of single foods',
      drafted.foods <= 2, drafted.foods + ' foods');

    /* Only the empty meals are drafted — what you placed is yours. Recorded
       per meal that actually has something, since a tight plan can leave one
       of them empty and that is not this assertion's business. */
    const keepIds = await q.evaluate(() => {
      const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
      const day = days[Object.keys(days)[0]];
      const out = {};
      ['b', 'd', 's'].forEach((k) => {
        if ((day[k] || []).length) out[k] = String(day[k][0].id);
      });
      return out;
    });
    await q.click('[data-mdel="l:0"]');
    await q.waitForTimeout(200);
    await q.click('#macroFill');
    await q.waitForTimeout(300);
    t.ok('refilling touches only the meal that was emptied',
      await q.evaluate((keep) => {
        const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
        const day = days[Object.keys(days)[0]];
        return day.l.length === 1 && Object.keys(keep).every(
          (k) => (day[k] || []).length && String(day[k][0].id) === keep[k]);
      }, keepIds));

    await q.context().close();

    /* ---- adding from the bar, balancing, and keeping --------------------- */
    const bar = await t.fresh();
    await bar.click('.tab[data-view="macros"]');
    await bar.waitForTimeout(200);
    t.ok('everything you do to today is one row of the bar',
      await bar.evaluate(() => {
        const b2 = [...document.querySelectorAll('.mday-acts button')]
          .filter((x) => !x.classList.contains('hide')).map((x) => x.id);
        return b2.indexOf('macroAdd') >= 0 && b2.indexOf('macroRebal') >= 0 &&
          document.querySelector('.mday-acts').getBoundingClientRect().height < 70;
      }));
    /* The two switches for the whole screen — open every meal, set up My
       Day — sit beside the title, on the far right, at every width. They
       spent a version down on the bar with the morning's verbs, where
       "open everything" read as something you do to a meal. */
    t.ok('open-all and the gear sit on the far right of the title row',
      await bar.evaluate(() => {
        const head = document.querySelector('.mday-head');
        const all = document.getElementById('macroOpenAll'), gear = document.getElementById('macroMore');
        const next = document.getElementById('macroNext');
        if (!head.contains(all) || !head.contains(gear)) return false;
        const h = head.getBoundingClientRect(), a = all.getBoundingClientRect(), g = gear.getBoundingClientRect();
        return a.left > next.getBoundingClientRect().right + 40 && g.left >= a.right &&
          h.right - g.right < 24;
      }), await bar.evaluate(() => {
        const r = (id) => Math.round(document.getElementById(id).getBoundingClientRect().left);
        return 'next ' + r('macroNext') + ' all ' + r('macroOpenAll') + ' gear ' + r('macroMore') +
          ' head ' + Math.round(document.querySelector('.mday-head').getBoundingClientRect().right);
      }));
    /* And the scanner is drawn, not an emoji: the camera glyph came in the
       phone's own colours, the one thing on the bar off the palette. */
    t.ok('the scan button is a drawn icon in the ink colour',
      await bar.evaluate(() => {
        const b2 = document.getElementById('macroScan');
        return !!b2.querySelector('svg.mday-svg') && !/📷/.test(b2.textContent);
      }));

    /* Opened from the bar, the sheet has to ask which meal — and answer it
       first, with the one you have not finished eating. */
    await bar.click('#macroAdd');
    await bar.waitForTimeout(300);
    t.ok('the bar asks which meal, and guesses the one you mean',
      await bar.evaluate(() => {
        const chips = [...document.querySelectorAll('[data-mpslot]')];
        const on = document.querySelector('[data-mpslot][aria-pressed="true"]');
        return chips.length >= 4 && !!on;
      }));
    await bar.click('[data-mpslot="d"]');
    await bar.waitForTimeout(250);
    t.ok('and choosing a different one re-aims the whole sheet',
      /Dinner/i.test(await bar.textContent('.sheet-eyebrow')));

    // three raw foods onto dinner, through the one box
    await pickerList(bar);
    await bar.waitForTimeout(200);
    /* Typing a food's name has to show that food. Dozens of recipes list
       honey among their ingredients and every one of them fills a dinner
       better than a spoonful does, so ranked on fit alone the row the search
       was for sinks below a twelve-row box. The word you typed is the whole
       of the question. */
    await bar.fill('#mpFind', 'honey');
    await bar.waitForTimeout(400);
    t.ok('searching a food by name puts the food itself on top',
      await bar.evaluate(() => {
        const rows = [...document.querySelectorAll('.mpick-row[data-mpick]')];
        return rows.length > 0 && rows[0].dataset.mpick.indexOf('f:') === 0;
      }));

    for (const q of ['chicken breast', 'honey', 'peanut']) {
      await bar.fill('#mpFind', q);
      await bar.waitForTimeout(400);
      await bar.evaluate(() => {
        const r = [...document.querySelectorAll('.mpick-row[data-mpick]')]
          .find((x) => x.dataset.mpick.indexOf('f:') === 0);
        if (r) r.click();
      });
      await bar.waitForTimeout(180);
    }
    await bar.click('[data-mpdone]');
    await bar.waitForTimeout(350);
    const openDinner = async () => {
      for (let i = 0; i < 4; i++) {
        if (!await bar.evaluate(() => !!document.querySelector('.mslot-thin'))) break;
        await bar.click('#macroOpenAll');
        await bar.waitForTimeout(180);
      }
    };
    await openDinner();
    t.ok('a meal of parts offers to be balanced and to be kept',
      await bar.evaluate(() => !!document.querySelector('[data-mbal="d"]') &&
        !!document.querySelector('[data-mkeep="d"]')));

    /* Knock the portions out of shape, then solve them. The target of a meal
       is its weight's worth of the DAY — not what is left of the day after
       it, which is the picker's question and would solve a meal already on
       target down to a quarter of itself. */
    await bar.evaluate(() => {
      for (let i = 0; i < 8; i++) {
        const b2 = document.querySelector('[data-mstep$=":up"]');
        if (b2) b2.click();
      }
    });
    await bar.waitForTimeout(350);
    /* Read off the day itself rather than off a label. The header pill used
       to carry "N over" and this parsed it; the pill is now only on an empty
       meal, because the macro pills on the row say it per macro instead. The
       thing being tested was never the wording. */
    const gapOf = () => bar.evaluate(() => {
      const L = window.__macroLab, T = L.targets(), day = L.read();
      const dayK = 4 * T.p + 4 * T.c + 9 * T.f;
      let sumW = 0;
      day.meals.forEach((m) => { sumW += m.w; });
      const me = day.meals.find((m) => m.k === 'd');
      if (!me) return 0;
      let kc = 0;
      me.items.forEach((it) => { kc += it.kcal * it.x; });
      return Math.abs(Math.round(kc - dayK * me.w / sumW));
    });
    const wasOff = await gapOf();
    await bar.click('[data-mbal="d"]');
    await bar.waitForTimeout(500);
    const nowOff = await gapOf();
    t.ok('balancing a meal moves it toward its share, not away',
      nowOff < wasOff / 2, wasOff + ' off -> ' + nowOff + ' off');

    /* Kept to yourself means kept to yourself: the household document is
       where recipes live, and four scanned packets are not everyone's. */
    await bar.click('[data-mkeep="d"]');
    await bar.waitForTimeout(300);
    await bar.fill('#mkName', 'Chicken Rice Bowl');
    await bar.click('[data-mkdo="mine"]');
    await bar.waitForTimeout(450);
    t.ok('keeping it to yourself puts it in your account, not the household',
      await bar.evaluate(() =>
        JSON.stringify(window.Store.state.mine || {}).indexOf('Chicken Rice Bowl') < 0 &&
        (localStorage.getItem('bsc.myFoods') || '').indexOf('Chicken Rice Bowl') >= 0));
    t.ok('and the parts collapse into the one thing they were describing',
      await bar.evaluate(() => {
        const d = JSON.parse(localStorage.getItem('bsc.macroDays'));
        const day = d[Object.keys(d)[0]];
        return day.d.length === 1 && String(day.d[0].id).indexOf('f:my:') === 0;
      }));
    await bar.context().close();

    /* ---- three foods that close the meal ---------------------------------
     * A food taking most of its energy from ONE macro is a knob you can turn
     * without disturbing the other two, and three of them reach any P/F/C
     * combination exactly. The panel is that, made tappable. */
    const comboAt = async (seed) => {
      const pg = await t.fresh();
      await pg.evaluate((cfg) => {
        const p2 = (n) => (n < 10 ? '0' : '') + n;
        const key = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
        const days = {};
        for (let i = 8; i >= 1; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          days[key(d)] = cfg.hist
            ? { b: cfg.hist.map((id) => ({ id: id, x: 1, eaten: 1 })), l: [], d: [], s: [] }
            : { b: [], l: [], d: [], s: [] };
        }
        days[key(new Date())] = { b: [], l: [], d: [], s: [] };
        const g = new Date(); g.setDate(g.getDate() + 120);
        localStorage.setItem('bsc.macroDays', JSON.stringify(days));
        localStorage.setItem('bsc.macroProfile', JSON.stringify({
          sex: 'm', age: 41, ft: 5, inch: 11, lb: 204, act: 1.55, goal: 'cut1',
          goalLb: 175, goalBy: key(g), workouts: 4, steps: 8000,
        }));
      }, seed || {});
      await pg.reload();
      await pg.waitForTimeout(400);
      await pg.click('.tab[data-view="macros"]');
      await pg.waitForTimeout(250);
      await addOn(pg);       // breakfast
      await pg.waitForTimeout(300);
      return pg;
    };

    /* The foods that close the meal are rows in the list now, not a panel of
       their own — read the way the list is read: a heading, then every row
       under it until the next heading. */
    const closersOf = (pg) => pg.evaluate(() => {
      const kids = [...document.querySelectorAll('#modalRoot .mt-div, #modalRoot .mpick-wrap')];
      let on = false;
      const out = { cap: null, names: [], prot: 0, panel: !!document.querySelector('.mcombo') };
      for (const el of kids) {
        if (el.classList.contains('mt-div')) {
          if (on) break;
          if (/that closes?\b/.test(el.textContent)) { on = true; out.cap = el.textContent; }
          continue;
        }
        if (!on) continue;
        out.names.push((el.querySelector('.mp-name') || {}).textContent);
        const m = /(\d+)P/.exec(el.textContent);
        if (m) out.prot += Number(m[1]);
      }
      return out;
    });

    const comboPage = await comboAt();
    const cbo = await closersOf(comboPage);
    t.ok('the picker offers three foods, one per macro, as rows in the list',
      cbo.names.length === 3, JSON.stringify(cbo));
    /* Blake: "instead of the three foods that close the day, just put them in
       my suggested foods area." No second way to read a food, no second way
       to add one. */
    t.ok('and no panel of its own above the list',
      !cbo.panel && /^Three foods that close /.test(cbo.cap || ''), JSON.stringify(cbo.cap));

    /* The bug this had on its first outing: pointed at the DAY it asked three
       foods to BE a day. Every portion pegged at the ×4 ceiling -- four cans
       of tuna -- and still came up short, because no three foods are 180 g of
       protein. It is aimed at the meal's share of the gap.
     *
       Summed off the rows the page actually renders, which is also the check
       that the rows carry the combo's own portions rather than a ranked
       one. */
    const cboFit = await comboPage.evaluate((p) => {
      const t2 = window.__macroLab.targets();
      return { p: p, day: t2.p, share: t2.p / 4 };
    }, cbo.prot);
    t.ok('and it is a meal, not the whole day, asked of three foods',
      cboFit.p > cboFit.share * 0.6 && cboFit.p < cboFit.day * 0.6, JSON.stringify(cboFit));

    /* Purity says oil is the best fat lever on the shelf, at 100%. It is also
       not breakfast. A food you can eat as it comes outranks a thing that
       goes ON food, and the rung below is where the oil lives. */
    t.ok('and no rung opens on a condiment while there is a food for it',
      cbo.names.length === 3 &&
      cbo.names.every((n) => !/^(Oil|Butter|Mayo|Light mayo|Ranch|Light ranch)$/.test(n)),
      cbo.names.join(' | '));
    /* The control for the history test below, taken while this page is still
       open and from the same source, so the two are comparable. */
    const noHistLevers = await comboPage.evaluate(() =>
      (window.__macroLab.closers() || []).map((c) => c.name));
    await comboPage.context().close();

    /* Reproduced from the shape of Blake's own screenshot: a day whose fat
       is mostly spent by the evening, so the last meal's fat rung has
       nothing left to move and drops out. Two earlier guesses at this seed
       both produced three rungs, and the test passed on the three-branch
       while the two-branch — the one that was actually broken — went
       unexercised. */
    const comboPage2 = await t.fresh();
    await comboPage2.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      const g = new Date(); g.setDate(g.getDate() + 120);
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: 'f:cheddar', x: 1, eaten: 1 }, { id: 'f:egg', x: 3, eaten: 1 }],
        l: [{ id: 'f:peanut_butter', x: 2, eaten: 1 }], d: [], s: [] } }));
      localStorage.setItem('bsc.macroProfile', JSON.stringify({
        sex: 'm', age: 41, ft: 5, inch: 11, lb: 204, act: 1.55, goal: 'cut1', goalLb: 175,
        goalBy: g.getFullYear() + '-' + p2(g.getMonth() + 1) + '-' + p2(g.getDate()),
        workouts: 4, steps: 8000 }));
    });
    await comboPage2.reload();
    await comboPage2.waitForTimeout(400);
    await comboPage2.click('.tab[data-view="macros"]');
    await comboPage2.waitForTimeout(300);
    const lastAdd = await comboPage2.$$('.mslot-add');
    await lastAdd[lastAdd.length - 1].click();
    await comboPage2.waitForTimeout(400);

    /* The heading says how many foods are actually under it. A meal whose
       protein is already covered gets two levers, and the old panel read
       "Three foods for dinner" over two rows.
     *
       Pinned to FEWER THAN THREE and to the words agreeing with the count,
       never to exactly two: the targets are carb-cycled by weekday, so a rest
       day's smaller carb gap closes a second rung and only one is offered.
       The seed cannot control the weekday, so the assertion must not depend
       on it — and it is still not vacuous, because the broken branch said
       "Three" over whatever it drew. */
    const counted = await closersOf(comboPage2);
    t.ok('the heading counts the foods actually under it',
      counted.names.length > 0 && counted.names.length < 3 && (
        (counted.names.length === 2 && /^Two foods that close /.test(counted.cap)) ||
        (counted.names.length === 1 && /^One food that closes /.test(counted.cap))),
      JSON.stringify(counted));
    await comboPage2.context().close();

    /* Slots are yours to name, so no food carries a `breakfast` flag -- what
       orders the rungs is what you have put in THIS meal before. The control
       above shares every other condition, so a failure here is the history
       and nothing else. */
    /* Read off the bench, not the rendered rows. A food you ate yesterday is
       claimed by "Recent" and deduped out of the closers band, so the DOM
       stopped being able to show which rung it opened — which is a rendering
       fact, and this assertion is about the rule. */
    const histPage = await comboAt({ hist: ['f:egg_white', 'f:salsa'] });
    const withHist = await histPage.evaluate(() =>
      (window.__macroLab.closers() || []).map((c) => c.name));
    t.ok('a week of egg whites at breakfast puts egg whites at the top of it',
      withHist[0] === 'Egg whites' && noHistLevers[0] !== 'Egg whites',
      'no history: ' + noHistLevers.join(' | ') + ' -- with: ' + withHist.join(' | '));

    /* Ordinary rows: tapping one puts it in the BASKET at the portion the
       band offered, and touches nothing on the plate. Food arriving on the
       plate with no ✓ in between would be the only thing in this sheet that
       commits itself.
     *
       The add-all button went with the panel and is not missed — the basket
       accumulates and the bar along the bottom totals what it will add. */
    const offered = (await closersOf(histPage)).names.length;
    for (let i = 0; i < offered; i++) {
      await histPage.evaluate((nm) => {
        const row = [...document.querySelectorAll('#modalRoot .mpick-wrap')]
          .find((w) => (w.querySelector('.mp-name') || {}).textContent === nm &&
            !w.classList.contains('in'));
        if (row) row.querySelector('.mpick-row').click();
      }, (await closersOf(histPage)).names[0]);
      await histPage.waitForTimeout(300);
    }
    await openBasket(histPage);
    t.ok('tapping them fills the basket and leaves the plate alone',
      offered > 0 && await histPage.evaluate((n) => {
        const d = JSON.parse(localStorage.getItem('bsc.macroDays') || '{}');
        const p2 = (x) => (x < 10 ? '0' : '') + x;
        const dd = new Date();
        const k = dd.getFullYear() + '-' + p2(dd.getMonth() + 1) + '-' + p2(dd.getDate());
        return document.querySelectorAll('.mpb-out').length === n &&
          ((d[k] || {}).b || []).length === 0;
      }, offered),
      'offered ' + offered + ', basket ' +
      await histPage.evaluate(() => document.querySelectorAll('.mpb-out').length));

    /* And once the basket covers the share, more foods to close it is not
       help — the heading goes with them. */
    t.ok('and it stops offering once there is nothing left to close',
      (await closersOf(histPage)).cap === null);
    await histPage.context().close();

    /* ---- the meal's four gauges ------------------------------------------
     * Calories and P/F/C on the meal's own seam, each read against a tick
     * where the plan is. */
    const gaugePage = await t.fresh();
    await gaugePage.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      const g = new Date(); g.setDate(g.getDate() + 120);
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: 'f:egg', x: 3, eaten: 1 }, { id: 'f:cheddar', x: 0.25, eaten: 1 }],
        l: [{ id: 'f:chicken_breast', x: 1, eaten: 0 }],
        d: [], s: [] } }));
      localStorage.setItem('bsc.macroProfile', JSON.stringify({
        sex: 'm', age: 41, ft: 5, inch: 11, lb: 204, act: 1.55, goal: 'cut1',
        goalLb: 175, goalBy: g.getFullYear() + '-' + p2(g.getMonth() + 1) + '-' + p2(g.getDate()),
        workouts: 4, steps: 8000,
      }));
    });
    await gaugePage.reload();
    await gaugePage.waitForTimeout(400);
    await gaugePage.click('.tab[data-view="macros"]');
    await gaugePage.waitForTimeout(350);

    const gz = await gaugePage.evaluate(() => {
      const out = [];
      document.querySelectorAll('.mslot').forEach((card) => {
        const nm = card.querySelector('.mslot-name');
        const gg = card.querySelector('.mmps');
        out.push({
          name: nm ? nm.textContent : '',
          /* No food on the plate. NOT "has no .mitem rows" — the accordion
             keeps every meal but one folded, and a folded meal renders no
             rows either. The honest signal is the fold handle: a meal with
             food gets a head you can fold, an empty one has nothing to hide
             and renders its name flat. */
          empty: !!card.querySelector('.mslot-name-flat'),
          hasGauges: !!gg,
          planned: !!gg && gg.classList.contains('planned'),
          bars: gg ? [...gg.querySelectorAll('.mmp')].map((o) => ({
            l: o.querySelector('i').textContent + o.querySelector('b').textContent,
            st: (o.className.match(/mmp(?: kc)? (\w+)/) || [, ''])[1],
            /* the fill is painted as a gradient stop, so the proportion is
               read off the paint rather than off a width */
            fill: parseFloat((o.style.background.match(/0 ([\d.]+)%/) || [, 0])[1]),
            tick: parseFloat((o.querySelector('.mmp-t').textContent.match(/[\d.]+/) || [0])[0]),
          })) : [],
        });
      });
      return out;
    });
    const fed = gz.filter((c) => c.hasGauges);
    /* Selected by having no item rows. Filtering on "has no gauges" and then
       asserting it has no gauges was a tautology, and it passed happily with
       the gauges drawn on every empty meal. */
    const noFood = gz.filter((c) => c.empty);

    t.ok('a meal with food carries four gauges, calories among them',
      fed.length >= 2 && fed.every((c) => c.bars.length === 4 &&
        /\uD83D\uDD25\s*\d/.test(c.bars[0].l)),
      JSON.stringify(fed.map((c) => c.name + ':' + c.bars.length)));

    /* A length needs something to be long against. It was a tick on a bar;
       it is the target written out on the pill now — "128/316" — which says
       the number the tick could only point at. Every pill must carry one. */
    t.ok('and every pill states the target it is filling toward',
      fed.length > 0 && fed.every((c) => c.bars.every((g) => g.tick > 0)),
      JSON.stringify(fed[0] && fed[0].bars));

    /* A plate past its share runs the fill pastPlan the tick, and the tick stays
       put — a bar pinned at its own maximum cannot say HOW far past. */
    const pastPlan = [];
    fed.forEach((c) => c.bars.forEach((g) => { if (g.st === 'x') pastPlan.push(g); }));
    t.ok('a plate past the plan says how far past, not merely that it is',
      pastPlan.length > 0 && pastPlan.every((g) => g.fill >= 99 && g.tick < 99),
      JSON.stringify(pastPlan));

    /* Colour says whether it matters; length says how much. They may not
       contradict — a short bar painted green is unreadable.
     *
       Asked of whatever the seed happened to draw, this proved nothing: the
       cap only bites in a narrow window and no plate on an arbitrary day
       lands in it. So it asks the rule directly. A five-meal day gives each
       meal a fifth of the target, and the day-relative floor alone would
       forgive a miss of a tenth of the DAY — which is half of that meal's
       whole share. Half short is not "landed" however little it moves the
       day. */
    const bandRule = await gaugePage.evaluate(() => {
      const day = 200, want = day * 0.2;            // 40 g, a fifth of the day
      const at = (frac) => window.__macroLab.gauge(want * frac, want, day).st;
      return { half: at(0.55), most: at(0.85), on: at(1.0), past: at(1.6) };
    });
    t.ok('and nothing is painted landed while its bar is nowhere near the tick',
      bandRule.half === 'u' && bandRule.most === 'o' &&
      bandRule.on === 'o' && bandRule.past === 'x', JSON.stringify(bandRule));

    /* Planned but not eaten draws faded — a full-looking dinner at eleven in
       the morning otherwise reads as food you have already had. */
    t.ok('a meal planned but not eaten draws faded, an eaten one solid',
      fed.some((c) => c.planned) && fed.some((c) => !c.planned),
      JSON.stringify(fed.map((c) => c.name + (c.planned ? ':faded' : ':solid'))));

    /* Blake: "I don't like the at it's share. it's not intuitive to me." The
       number survives; the vocabulary does not. */
    t.ok('an empty meal says what it is for with no vocabulary to learn',
      noFood.length > 0 && noFood.every((c) => c.bars.length === 4) &&
      !(await gaugePage.evaluate(() => /at its share/i.test(document.body.textContent))),
      JSON.stringify(noFood.map((c) => c.name + ':' + c.bars.length)));

    /* Reversed, deliberately. This asserted that an empty meal draws NO
       tracks — "four at zero times five meals is what the morning would open
       on" — and Blake asked for the opposite: a meal you have not filled is
       precisely the meal you need the numbers for, because they are what you
       plan against. The noise the old rule was guarding against is handled
       instead by the strip being drawn at planned weight, so a morning of
       untouched meals reads quietly rather than as twenty-four accusations. */
    t.ok('an empty meal draws its pills, faded, so the morning reads quietly',
      noFood.length > 0 && noFood.every((c) => c.hasGauges && c.planned),
      JSON.stringify(noFood.map((c) => c.name + (c.planned ? ':faded' : ':SOLID'))));

    /* The gauges went on the header row first and rendered BREAKFAST as
       BREAKFAS. They live on the seam for that reason. */
    t.ok('and the meal keeps its whole name at phone width',
      await gaugePage.evaluate(() =>
        [...document.querySelectorAll('.mslot-name')]
          .every((n) => n.scrollWidth <= n.clientWidth + 1)),
      await gaugePage.evaluate(() => [...document.querySelectorAll('.mslot-name')]
        .filter((n) => n.scrollWidth > n.clientWidth + 1).map((n) => n.textContent).join(', ')));
    await gaugePage.context().close();

    /* ---- a tinyPhone's targets44 ---------------------------------------------------
     * The lock was 34x33, the keys 44 wide but 33 tall, and the eaten
     * checkbox a 46 px label wrapped around a 17 px box — the thing that
     * LOOKED like the target and the thing that WAS one were different
     * sizes. Measured on a real phone viewport, not asserted from the CSS,
     * because `width` inside a flex row is only a suggestion: a plate with a
     * long yield noun squeezed all three to 36 while the rule still said 44. */
    const tinyPhone = await t.fresh({ viewport: { width: 320, height: 900 }, hasTouch: true, isMobile: true });
    await tinyPhone.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      const g = new Date(); g.setDate(g.getDate() + 120);
      /* a recipe as well as a food, so the long yield noun is in play */
      const long = (window.RECIPES.find((r) => /container|meal prep/i.test(r.servings || '')) ||
        window.RECIPES.find((r) => r.macro && r.macro.kcal > 200) || {}).id;
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: 'f:whey', x: 1, eaten: 0 }].concat(long ? [{ id: long, x: 1.75, eaten: 0 }] : []),
        l: [], d: [], s: [] } }));
      localStorage.setItem('bsc.macroProfile', JSON.stringify({
        sex: 'm', age: 41, ft: 5, inch: 11, lb: 204, act: 1.55, goal: 'cut1', goalLb: 175,
        goalBy: g.getFullYear() + '-' + p2(g.getMonth() + 1) + '-' + p2(g.getDate()),
        workouts: 4, steps: 8000 }));
    });
    await tinyPhone.reload();
    await tinyPhone.waitForTimeout(400);
    await tinyPhone.click('.tab[data-view="macros"]');
    await tinyPhone.waitForTimeout(300);
    await tinyPhone.click('[data-mfold="b"]');
    await tinyPhone.waitForTimeout(350);

    const targets44 = await tinyPhone.evaluate(() => {
      const els = [...document.querySelectorAll('.mstep .mlock, .mstep button[data-mstep], .mtick')];
      const small = els.map((e) => {
        const b = e.getBoundingClientRect();
        return { w: Math.round(b.width), h: Math.round(b.height),
          what: e.className.split(' ')[0] || e.tagName };
      }).filter((x) => x.w < 44 || x.h < 44);
      return { n: els.length, small: small };
    });
    t.ok('every control on a plate is a thumb wide at the narrowest phone',
      targets44.n >= 4 && targets44.small.length === 0,
      JSON.stringify(targets44));

    /* And the row still fits — 44 px targets that overflow are not a fix. */
    t.ok('and the row still fits without scrolling sideways',
      await tinyPhone.evaluate(() =>
        [...document.querySelectorAll('.mrow2')].every((e) => e.scrollWidth <= e.clientWidth + 1) &&
        document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await tinyPhone.context().close();

    /* ---- what is held, said where it can be seen -------------------------
     * Lock the dinner you promised the family, fold the card, press
     * Rebalance. The whole gesture happens on the folded view, and the
     * folded view used to carry no sign of the lock at all. */
    const heldPage = await t.fresh();
    await heldPage.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      const g = new Date(); g.setDate(g.getDate() + 120);
      /* Two plates, so Rebalance has something to move the difference ONTO —
         with one plate and that plate held there is nothing to solve, and the
         test would pass on an app that had simply given up. */
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: 'f:egg_white', x: 2, eaten: 0 }, { id: 'f:cheddar', x: 1, eaten: 0 }],
        l: [], d: [], s: [] } }));
      localStorage.setItem('bsc.macroProfile', JSON.stringify({
        sex: 'm', age: 41, ft: 5, inch: 11, lb: 204, act: 1.55, goal: 'cut1',
        goalLb: 175, goalBy: g.getFullYear() + '-' + p2(g.getMonth() + 1) + '-' + p2(g.getDate()),
        workouts: 4, steps: 8000,
      }));
    });
    await heldPage.reload();
    await heldPage.waitForTimeout(400);
    await heldPage.click('.tab[data-view="macros"]');
    await heldPage.waitForTimeout(300);
    await heldPage.click('[data-mfold="b"]');           // open breakfast
    await heldPage.waitForTimeout(300);
    const heldOk = await heldPage.evaluate(() => document.querySelectorAll('[data-mlock]').length > 0);
    t.ok('an open plate offers the lock', heldOk);

    await heldPage.click('[data-mlock]');
    await heldPage.waitForTimeout(300);
    t.ok('and tapping it is recorded on the plate, not just drawn',
      await heldPage.evaluate(() => {
        const d = JSON.parse(localStorage.getItem('bsc.macroDays') || '{}');
        const day = d[Object.keys(d).sort().pop()] || {};
        return (day.b || []).some((it) => it.l);
      }));

    await heldPage.click('[data-mfold="b"]');           // fold it again
    await heldPage.waitForTimeout(300);
    t.ok('and the fold still says which food is being held',
      await heldPage.evaluate(() => {
        const thin = document.querySelectorAll('.mslot-thin .mthin');
        return thin.length > 0 && document.querySelectorAll('.mslot-thin .mthin-l').length === 1;
      }), await heldPage.evaluate(() =>
        (document.querySelector('.mslot-thin') || {}).textContent || 'no folded list'));

    /* The point of the mark: Rebalance is about to skip that plate, and you
       are looking at the folded card when you press it. */
    t.ok('and Rebalance leaves the held plate at the size it was held at',
      await heldPage.evaluate(() => {
        const read = () => {
          const d = JSON.parse(localStorage.getItem('bsc.macroDays') || '{}');
          return (d[Object.keys(d).sort().pop()] || {}).b || [];
        };
        const was = read().filter((it) => it.l).map((it) => it.x);
        const btn = document.getElementById('macroRebal');
        if (!btn || btn.disabled) return false;
        btn.click();
        const now = read().filter((it) => it.l).map((it) => it.x);
        return was.length > 0 && was.join() === now.join();
      }));
    await heldPage.context().close();

    /* ---- one query, not two ---------------------------------------------
     * There were two search boxes with near-identical placeholders — "Search
     * a food or a dish…" and "Search a dish or ingredient…" — backed by two
     * separate state fields. Typing a word into one and switching to the
     * other threw the word away and asked for it again. */
    const oneQ = await comboAt();
    await pickerList(oneQ);
    await oneQ.waitForTimeout(350);
    await oneQ.fill('#mpFind', 'chicken');
    await oneQ.waitForTimeout(500);
    const lookHits = await oneQ.evaluate(() =>
      document.querySelectorAll('#mpList [data-mpick]').length);

    await pickerList(oneQ);
    await oneQ.waitForTimeout(450);
    t.ok('a word typed in one box is still there in the other',
      await oneQ.evaluate(() => (document.getElementById('mpFind') || {}).value === 'chicken'),
      JSON.stringify(await oneQ.evaluate(() => (document.getElementById('mpFind') || {}).value)));

    /* And it is the same word doing the same work, not merely the same
       string sitting in a box: both lists answer to it. */
    t.ok('and it is narrowing the other list too',
      lookHits > 0 && await oneQ.evaluate(() =>
        document.querySelectorAll('#mpList [data-mpick]').length > 0 &&
        [...document.querySelectorAll('#mpList .mp-name')]
          .some((n) => /chicken/i.test(n.textContent))));
    await oneQ.context().close();

    /* ---- a control that cannot do anything is not a control ---------------
     * The meal name was a fold button on an EMPTY meal too, where there is
     * nothing to fold: `folded` is gated on items.length and the seam only
     * exists `if (rows)`, so the press did nothing you could see. It wrote
     * S.mFold[sk] regardless, and mFoldFor stops Fill from clearing it — so
     * pressing an empty meal's name and then pressing Fill brought that one
     * meal back FOLDED, with no steppers, while every other meal opened. */
    const deadFold = await t.fresh();
    await deadFold.evaluate(() => {
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
    await deadFold.reload();
    await deadFold.waitForTimeout(400);
    await deadFold.click('.tab[data-view="macros"]');
    await deadFold.waitForTimeout(300);

    t.ok('an empty meal\u2019s name is not offered as a fold handle',
      await deadFold.evaluate(() =>
        document.querySelectorAll('.mslot').length > 0 &&
        !document.querySelector('.mslot .mslot-name[data-mfold]')));

    /* The consequence, which is what actually bit: press it, then Fill. */
    await deadFold.click('.mslot .mslot-name');
    await deadFold.waitForTimeout(300);
    await deadFold.click('#macroFill');
    await deadFold.waitForTimeout(700);
    const afterFill = await deadFold.evaluate(() =>
      [...document.querySelectorAll('.mslot')]
        .filter((c) => c.querySelector('.mslot-name'))
        .map((c) => ({ n: c.querySelector('.mslot-name').textContent.trim(),
          steppers: c.querySelectorAll('[data-mstep]').length })));
    t.ok('and pressing it before Fill does not bring one meal back folded',
      afterFill.length >= 3 && afterFill.every((m) => m.steppers > 0),
      JSON.stringify(afterFill));
    await deadFold.context().close();

    /* ---- what closes the day, on arrival ---------------------------------
     * The sheet used to open on six things eaten lately and a way to go
     * looking. The one thing it never offered was the answer to the question
     * it was opened with — what would close the day — even though the app
     * has worked that out for every dish since the tab existed. It was an
     * option inside a sort dropdown, two taps and a mode away. */
    /* Seeded with a RECIPE eaten yesterday, not a food: it lands in Recent
       and is also in the meal's own ranked pool, so the two bands genuinely
       compete for it. Without that overlap the dedupe check below is
       vacuous — which it was, and a mutation removing the dedupe left the
       suite green. */
    const fitsPg = await t.fresh();
    /* Two-phase: settle the day first, ask the fit engine which dish it
       would put FIRST, and make that the thing eaten yesterday. Anything
       less than rank one is not enough — the band draws ten, so a recent
       sitting fiftieth never competes and the dedupe has nothing to do.
       (Seeded at rank 200 first; the mutation still passed.) */
    await fitsPg.evaluate(() => {
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
    await fitsPg.reload();
    await fitsPg.waitForTimeout(400);
    await fitsPg.click('.tab[data-view="macros"]');
    await fitsPg.waitForTimeout(300);
    const seedId = await fitsPg.evaluate(() => {
      const top = window.__macroLab.rank('b', 1);
      return top && top.length ? top[0].id : null;
    });
    await fitsPg.evaluate((rid) => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const key = (o) => { const d = new Date(); d.setDate(d.getDate() - o);
        return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
      const g = new Date(); g.setDate(g.getDate() + 120);
      localStorage.setItem('bsc.macroDays', JSON.stringify({
        [key(1)]: { b: [{ id: rid, x: 1, eaten: 1 }], l: [], d: [], s: [] },
        [key(0)]: { b: [], l: [], d: [], s: [] } }));
      localStorage.setItem('bsc.macroProfile', JSON.stringify({
        sex: 'm', age: 41, ft: 5, inch: 11, lb: 204, act: 1.55, goal: 'cut1', goalLb: 175,
        goalBy: g.getFullYear() + '-' + p2(g.getMonth() + 1) + '-' + p2(g.getDate()),
        workouts: 4, steps: 8000 }));
    }, seedId);
    await fitsPg.reload();
    await fitsPg.waitForTimeout(400);
    await fitsPg.click('.tab[data-view="macros"]');
    await fitsPg.waitForTimeout(300);
    await addOn(fitsPg);
    await fitsPg.waitForTimeout(500);
    const fits = await fitsPg.evaluate(() => {
      const bands = [...document.querySelectorAll('.sheet .mt-div')].map((d) => d.textContent);
      const under = (label) => {
        const d = [...document.querySelectorAll('.sheet .mt-div')]
          .find((x) => new RegExp(label, 'i').test(x.textContent));
        if (!d) return [];
        const out = []; let el = d.nextElementSibling;
        while (el && !el.classList.contains('mt-div')) {
          const b = el.querySelector('[data-mpick]');
          if (b) out.push({ id: b.dataset.mpick, x: Number(b.dataset.mpx) });
          el = el.nextElementSibling;
        }
        return out;
      };
      const all = [...document.querySelectorAll('.sheet [data-mpick]')].map((b) => b.dataset.mpick);
      return { bands: bands, fits: under('Fits best'), recent: under('Recent'),
        dupes: all.filter((x, i) => all.indexOf(x) !== i) };
    });
    t.ok('the sheet opens with what fits the day, no mode to pick first',
      fits.bands.some((b) => /Fits best/i.test(b)) && fits.fits.length >= 5,
      JSON.stringify({ bands: fits.bands, n: fits.fits.length }));

    /* The same dish under two headings is a list that is not thinking. The
       first clause proves the two bands were actually competing: the recent
       dish IS in this meal's ranked pool, so only the dedupe keeps it from
       being drawn twice. */
    const couldClash = await fitsPg.evaluate((rid) =>
      window.__macroLab.rank('b', 10).some((e) => String(e.id) === String(rid)), seedId);
    t.ok('and no dish is drawn twice under two headings',
      couldClash && fits.recent.length > 0 && fits.dupes.length === 0,
      JSON.stringify({ couldClash: couldClash, recent: fits.recent.length,
        dupes: fits.dupes }));

    /* The portions are solved, not defaulted — the whole point is that the
       row arrives at the size that fills the gap. */
    t.ok('and every row arrives at a portion the fit worked out',
      fits.fits.length > 0 && fits.fits.every((e) => e.x > 0) &&
      fits.fits.some((e) => e.x !== 1),
      JSON.stringify(fits.fits.map((e) => e.x)));

    /* And it really is ranked, not merely listed: the bench scores the same
       pool and the band must agree with its order. */
    t.ok('and the band is in the order the fit engine ranks them',
      await fitsPg.evaluate((shown) => {
        const ranked = window.__macroLab.rank('b', 60);
        if (!ranked || !ranked.length) return false;
        const pos = {};
        ranked.forEach((e, i) => { pos[String(e.id)] = i; });
        const seq = shown.map((e) => pos[String(e.id)]).filter((n) => n !== undefined);
        if (seq.length < 3) return false;
        for (let i = 1; i < seq.length; i++) if (seq[i] < seq[i - 1]) return false;
        return true;
      }, fits.fits),
      JSON.stringify(fits.fits.map((e) => e.id)));
    await fitsPg.context().close();

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
    const emptyCard = await trimPg.evaluate(() => {
      const cards = [...document.querySelectorAll('.mslot')].filter((c) =>
        c.querySelector('.mslot-name-flat') || (!c.querySelector('.mitem') &&
          c.querySelector('.mslot-acts')));
      const c = cards[0];
      if (!c) return null;
      const items = c.querySelector('.mslot-items');
      return {
        dash: !!c.querySelector('.mslot-empty'),
        emDash: /\u2014/.test(c.textContent),
        /* what the items box actually holds on an empty meal: the verbs and
           nothing else */
        kids: items ? [...items.children].map((k) => k.className) : [],
      };
    });
    t.ok('an empty meal draws no placeholder row',
      !!emptyCard && !emptyCard.dash && !emptyCard.emDash, JSON.stringify(emptyCard));
    t.ok('and holds nothing but its verbs',
      !!emptyCard && emptyCard.kids.length === 1 && /mslot-acts/.test(emptyCard.kids[0]),
      JSON.stringify(emptyCard));
    await trimPg.context().close();

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
        const t2 = c.querySelector('.mmp.kc .mmp-t');
        if (n && t2) out[n.trim()] = Number(t2.textContent.replace(/[^0-9]/g, ''));
      });
      return out;
    });
    const czLine = (pg) => pg.evaluate(() => {
      const el = document.querySelector('.mcasc');
      return el ? { head: el.querySelector('.mcasc-t').textContent,
        sub: el.querySelector('.mcasc-s').textContent,
        czBtns: [...el.querySelectorAll('[data-msend]')].map((b) => b.textContent.trim()) } : null;
    });

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

    const czL1 = await czLine(casc);
    t.ok('a meal that misses by enough says so, under itself',
      !!czL1 && /Breakfast went \d+ under/.test(czL1.head), JSON.stringify(czL1));
    /* The word matters and was chosen twice over. Not "czSpread across" — that
       reads as an even split, which is not what happens. */
    t.ok('and says the slack went by size, not evenly',
      !!czL1 && /by size/.test(czL1.sub) && !/evenly/.test(czL1.sub), JSON.stringify(czL1));
    t.ok('and offers every meal still open, and only those',
      !!czL1 && czL1.czBtns.filter((b) => /Share with/.test(b)).length === 3 &&
      !czL1.czBtns.some((b) => /Breakfast/.test(b)), JSON.stringify(czL1));

    /* Aiming it. Tapping one meal hands it the lot and puts the others back
       on their own plan — the whole point of being able to aim it at all. */
    const czBtns = await casc.$$('.mcasc [data-msend]');
    for (const b of czBtns) {
      if (/Dinner/.test(await b.textContent())) { await b.click(); break; }
    }
    await casc.waitForTimeout(350);
    const czAimed = await czReadAsk(casc);
    t.ok('tapping one meal hands it the lot',
      czAimed.Dinner > czSpread.Dinner && czAimed.Lunch < czSpread.Lunch &&
      czAimed.Snacks < czSpread.Snacks, JSON.stringify(czAimed));
    t.ok('and the others go back to exactly their own plan, not to nothing',
      czAimed.Lunch > 0 && czAimed.Snacks > 0 &&
      Math.abs((czAimed.Lunch + czAimed.Dinner + czAimed.Snacks) -
        (czSpread.Lunch + czSpread.Dinner + czSpread.Snacks)) <= 2,
      JSON.stringify({ czAimed, czSpread }));
    const czL2 = await czLine(casc);
    t.ok('and the czLine says where it went',
      !!czL2 && /Shared with Dinner/.test(czL2.sub), JSON.stringify(czL2));

    /* Don't share: every meal keeps its plan and the day is allowed to end
       short. On a cut that is frequently the one you want — a light breakfast
       is progress, not a debt to spend. */
    const czOffBtn = await casc.$('.mcasc [data-msend="off"]');
    await czOffBtn.click();
    await casc.waitForTimeout(350);
    const czHeld = await czReadAsk(casc);
    t.ok('and declining to share leaves every meal on its own plan',
      czHeld.Lunch < czSpread.Lunch && czHeld.Dinner < czSpread.Dinner &&
      czHeld.Snacks < czSpread.Snacks, JSON.stringify(czHeld));
    t.ok('and says the day will end short rather than naming an attitude',
      /You keep the \d+/.test((await czLine(casc)).sub), JSON.stringify(await czLine(casc)));

    /* It survives a reload, because the choice is a fact about the day and
       not a thing this render happened to be holding. */
    await casc.reload();
    await casc.waitForTimeout(500);
    await casc.click('.tab[data-view="macros"]');
    await casc.waitForTimeout(350);
    t.ok('and the choice is still there after a reload',
      JSON.stringify(await czReadAsk(casc)) === JSON.stringify(czHeld),
      JSON.stringify(await czReadAsk(casc)));
    await casc.context().close();

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
      const t2 = sn && sn.querySelector('.mmp.kc .mmp-t');
      return { ask: t2 ? Number(t2.textContent.replace(/[^0-9]/g, '')) : 0,
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

    /* ---- the box answers a number -----------------------------------------
     * Every recipe in the two printed volumes carries a number, on the card,
     * the page and the contents. Standing over the open book at No. 142, the
     * fastest way in is to type 142 — and it was wired to nothing. */
    const numQ = await comboAt();
    await pickerList(numQ);
    await numQ.waitForTimeout(350);

    /* The expectation is computed from the data, never written down here: a
       literal name would pass on an app that had stopped reading .no. */
    const want142 = await numQ.evaluate(() => {
      const r = window.RECIPES.find((x) => x.book !== 3 && Number(x.no || x.id) === 142);
      return r ? r.name : null;
    });
    await numQ.fill('#mpFind', '142');
    await numQ.waitForTimeout(500);
    t.ok('typing a recipe number puts that recipe at the top',
      !!want142 && await numQ.evaluate((nm) => {
        const band = document.querySelector('#mpList .mt-div');
        const first = document.querySelector('#mpList .mp-name');
        return !!band && /Recipe no\. 142/.test(band.textContent) &&
          !!first && first.textContent === nm;
      }, want142),
      want142 + ' — got ' + await numQ.evaluate(() =>
        (document.querySelector('#mpList .mp-name') || {}).textContent));

    /* The Ours shelf numbers itself from 1 at every boot, so the FIRST
       household recipe collides with printed No. 1 immediately.
     *
       Asked at 142 this proved nothing: the shelf is empty in a fresh
       profile, so there was no collision to detect and the check passed with
       the book-3 guard deleted. It seeds a household recipe and asks at the
       number that actually collides. */
    await numQ.evaluate(() => {
      const mine = JSON.parse(localStorage.getItem('bsc.mine') || '{}');
      mine.ucollide1 = { id: 'ucollide1', book: 3, secNum: 1, secName: 'Ours',
        name: 'Household Collision Test Loaf', servings: '1 Serving', servN: 1,
        ing: ['flour'], steps: ['bake'], time: '0 mins', diff: 'Easy',
        macro: { kcal: 300, p: 20, c: 30, f: 8, na: 200, fib: 2 } };
      localStorage.setItem('bsc.mine', JSON.stringify(mine));
    });
    await numQ.reload();
    await numQ.waitForTimeout(400);
    await numQ.click('.tab[data-view="macros"]');
    await numQ.waitForTimeout(250);
    await addOn(numQ);
    await numQ.waitForTimeout(300);
    await pickerList(numQ);
    await numQ.waitForTimeout(300);

    /* window.RECIPES is the BASE array the data file ships (app.js:26 keeps
       the rebuilt list, with Ours folded in, module-scoped) — so the shelf
       has to be confirmed through the interface, by searching for it. */
    await numQ.fill('#mpFind', 'Household Collision');
    await numQ.waitForTimeout(500);
    const seeded = await numQ.evaluate(() =>
      [...document.querySelectorAll('#mpList .mp-name')]
        .some((n) => /Household Collision Test Loaf/.test(n.textContent)));

    const printedNo1 = await numQ.evaluate(() => {
      const r = window.RECIPES.find((x) => Number(x.no || x.id) === 1);
      return r ? r.name : null;      // BASE is printed-only, which is the point
    });
    await numQ.fill('#mpFind', '1');
    await numQ.waitForTimeout(500);
    t.ok('and it is the printed book\u2019s number, not the Ours shelf\u2019s',
      seeded && !!printedNo1 && await numQ.evaluate((nm) => {
        const first = document.querySelector('#mpList .mp-name');
        return !!first && first.textContent === nm;
      }, printedNo1),
      'shelf seeded: ' + seeded + ', printed No.1 is ' + printedNo1 + ', got ' +
      await numQ.evaluate(() =>
        (document.querySelector('#mpList .mp-name') || {}).textContent));

    /* Eight digits is nobody's recipe number. It is a barcode, and typing one
       is the same request the camera makes. */
    await numQ.fill('#mpFind', '012345678901');
    await numQ.waitForTimeout(500);
    t.ok('and eight digits or more is read as a barcode instead',
      await numQ.evaluate(() => {
        const band = document.querySelector('#mpList .mt-div');
        const row = document.querySelector('[data-nfcode]');
        return !!band && /Barcode/.test(band.textContent) &&
          !!row && row.dataset.nfcode === '012345678901';
      }));

    /* A mistyped digit must not blank the screen. The band is drawn ABOVE
       whatever the list was going to say, never instead of it. */
    await numQ.fill('#mpFind', '999');
    await numQ.waitForTimeout(500);
    t.ok('and a number nobody has still says something',
      await numQ.evaluate(() => {
        const el = document.getElementById('mpList');
        return el.textContent.trim().length > 0 &&
          !document.querySelector('#mpList .mt-div');
      }), await numQ.evaluate(() =>
        document.getElementById('mpList').textContent.trim().slice(0, 80)));
    await numQ.context().close();

    /* ---- Look up browses, instead of waiting to be told a word -----------
     * It opened on a search box and nothing else: no way in unless you
     * already knew what you wanted to type. */
    const lookPage = await comboAt();
    await pickerList(lookPage);
    await lookPage.waitForTimeout(400);
    /* The Look up screen that grouped foods under Protein / Carbs / Fats is
       gone; the shelf rail asks the same question and asks it of dishes too,
       so the foods are harvested one chip at a time. Pressed from the test
       rather than inside one evaluate(), because each press re-renders the
       list and a node captured beforehand is detached by the next round. */
    /* The LENS says foods, the CHIP says which macro — the two compose, and
       between them they are the old browse screen's question. The chip alone
       is not: on a planned day Fits best ranks by fit and a dish out-fits a
       spoonful, so 🍚 on its own answers with ten recipes and no foods, which
       is the right answer to "what carbohydrate should I eat" and not to
       "show me the carbohydrate foods". */
    await lookPage.selectOption('#mpSec', 'foods');
    await lookPage.waitForTimeout(250);
    const lk = { heads: [], rows: {} };
    for (const [key, head] of [['protein', 'Protein'], ['carb', 'Carbs'], ['fat', 'Fats']]) {
      if (!(await lookPage.$('[data-mpshelf="' + key + '"]'))) continue;
      await lookPage.click('[data-mpshelf="' + key + '"]');
      await lookPage.waitForTimeout(250);
      lk.heads.push(head);
      lk.rows[head] = await lookPage.evaluate(() =>
        [...document.querySelectorAll('#mpList .mpick-row[data-mpick]')]
          .map((r) => r.dataset.mpick).filter((id) => /^f:/.test(id)));
      await lookPage.click('[data-mpshelf="' + key + '"]');
      await lookPage.waitForTimeout(200);
    }
    t.ok('the lens and the rail together file foods by macro, protein first',
      lk.heads.join('/') === 'Protein/Carbs/Fats' &&
      lk.heads.every((h) => lk.rows[h].length > 0),
      JSON.stringify(lk.heads) + ' ' + JSON.stringify(
        lk.heads.map((h) => lk.rows[h].length)));

    /* Classed by where the calories come from, not by grams -- a cup of milk
       carries more grams of carbohydrate than fat and is not a fat. */
    const misfiled = await lookPage.evaluate((rows) => {
      /* Read the macros off the rendered rows rather than out of the app --
         a check that asks the code under test for its own answer proves
         nothing. Every row prints "62P · 2F · 0C". */
      const bad = [];
      Object.keys(rows).forEach((h) => {
        const want = h === 'Protein' ? 'p' : h === 'Carbs' ? 'c' : 'f';
        rows[h].forEach((id) => {
          const btn = document.querySelector('[data-mpick="' + id + '"]');
          const txt = btn ? btn.textContent : '';
          const g = (l) => { const m = new RegExp('(\\d+)' + l).exec(txt); return m ? +m[1] : 0; };
          const kp = g('P') * 4, kf = g('F') * 9, kc = g('C') * 4;
          if (!(kp + kf + kc)) return;
          /* A row PRINTS whole grams; the app files on the unrounded ones.
             Mushrooms are 3.1 g protein against 3.3 g carbohydrate per 100 g,
             so a 70 g cup renders "2P · 2C" and the tie-break here picks
             protein while the app correctly picks carbohydrate. Within one
             gram of a tie the rendered row simply cannot say which shelf is
             right, so it is not evidence either way — the same reason the
             gap-row painting check skips its band edges. */
          const rank = [kp, kf, kc].sort((a, b) => b - a);
          if (rank[0] - rank[1] <= 4) return;
          const dom = kp >= kf && kp >= kc ? 'p' : (kf >= kc ? 'f' : 'c');
          if (dom !== want) bad.push(h + ':' + id);
        });
      });
      return bad;
    }, lk ? lk.rows : {});
    t.ok('and every food is filed under the macro its calories come from',
      !!lk && lk.rows.Protein.length > 2 && lk.rows.Carbs.length > 2 &&
        lk.rows.Fats.length > 2 && misfiled.length === 0,
      misfiled.join(' '));

    /* Oil is the purest fat on the shelf and it is not dinner. A thing that
       goes ON food sits under the food, in this list and on the combo's
       rungs both -- same rule, stated once. */
    const lkFats = lk ? lk.rows.Fats : [];
    /* The RULE, not two ids. It used to name oil and cheddar, and which
       particular foods reach a fit-ranked list of forty is not the claim —
       the claim is that anything you put ON food sits below everything you
       eat as it comes. Asserted over the whole list, which is also stronger:
       one condiment out of place fails it. */
    const condOrder = await lookPage.evaluate((ids) => {
      const N = window.Nutrition.FOODS;
      let lastFood = -1, firstCond = 1e9, conds = 0;
      ids.forEach((id, i) => {
        const f = N[String(id).replace(/^f:/, '')];
        if (!f) return;
        if (f.eat || f.side) lastFood = i;
        else { conds++; firstCond = Math.min(firstCond, i); }
      });
      return { lastFood: lastFood, firstCond: firstCond, conds: conds, n: ids.length };
    }, lkFats);
    t.ok('and the condiments sit under the foods, not over them',
      condOrder.n > 4 && condOrder.conds > 0 && condOrder.firstCond > condOrder.lastFood,
      JSON.stringify(condOrder) + ' ' + lkFats.join(' '));

    /* And the search it used to be is still the search it is. */
    await lookPage.fill('#mpFind', 'honey');
    await lookPage.waitForTimeout(400);
    /* It used to require NO headings, because the old Look up screen threw
       the ranked bands away the moment you typed. Keeping them is the point
       of the rework, so the claim is now the one that always mattered: the
       thing you named leads, and the list is about it. */
    t.ok('and typing still narrows it to what you typed',
      await lookPage.evaluate(() => {
        const el = document.getElementById('mpList');
        const first = el.querySelector('.mpick-row[data-mpick] .mp-name');
        return el.querySelectorAll('[data-mpick]').length > 0 &&
          !!first && /honey/i.test(first.textContent);
      }), await lookPage.evaluate(() =>
        document.getElementById('mpList').textContent.slice(0, 120)));
    await lookPage.context().close();

    /* ---- the charts, behind the bars ------------------------------------
     * Its own page, because the history has to be seeded before boot. */
    const chartPage = await t.fresh();
    await chartPage.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const key = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      const ws = {}, days = {};
      const norm = window.RECIPES.find((x) => x.macro && x.macro.kcal > 300 && x.macro.na < 200);
      const salty = window.RECIPES.find((x) => x.macro && x.macro.kcal > 300 && x.macro.na > 900);
      const jit = [0, 0.4, -0.3, 0.5, -0.2, 0.1, -0.4, 0.3, -0.1, 0.2];
      for (let i = 39; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        let w = 204 - (1.5 / 7) * (39 - i) + jit[i % 10] * 0.6;
        if (i % 9 === 0 && i < 39) w += 2.4;
        ws[key(d)] = Math.round(w * 10) / 10;
        const r = (i % 9 === 1) ? salty : norm;
        days[key(d)] = { b: [{ id: r.id, x: Math.round((1700 / r.macro.kcal) * 8) / 8, eaten: 1 }] };
      }
      const goal = new Date(); goal.setDate(goal.getDate() + 120);
      localStorage.setItem('bsc.macroWeights', JSON.stringify(ws));
      localStorage.setItem('bsc.macroDays', JSON.stringify(days));
      localStorage.setItem('bsc.macroProfile', JSON.stringify({
        sex: 'm', age: 41, ft: 5, inch: 11, lb: 204, act: 1.55, goal: 'cut1',
        goalLb: 175, goalBy: key(goal), workouts: 4, steps: 8000,
      }));
    });
    await chartPage.reload();
    await chartPage.waitForTimeout(400);
    await chartPage.click('.tab[data-view="macros"]');
    await chartPage.waitForTimeout(250);
    await chartPage.click('[data-mchartopen]');
    await chartPage.waitForTimeout(300);
    t.ok('the bars open onto their own history',
      await chartPage.evaluate(() => !!document.querySelector('.mc-sheet') &&
        document.querySelectorAll('[data-mchart]').length === 4));

    const chart = async (which) => {
      await chartPage.click('[data-mchart="' + which + '"]');
      await chartPage.waitForTimeout(200);
      return chartPage.evaluate(() => ({
        pts: document.querySelectorAll('.mc-svg circle').length,
        flagged: document.querySelectorAll('.mc-sig').length,
        salt: document.querySelectorAll('.mc-salt').length,
        plan: !!document.querySelector('.mc-plan'),
      }));
    };

    /* Baseline limits held across a cut saturate — you leave the band in week
       two and every morning after reads as "outside", which flags thirty
       points and means none of them. Weight is for looking at; Off plan is
       the chart that signals. */
    const wc = await chart('weight');
    t.ok('the weight chart draws the plan beside it and flags nothing',
      wc.pts === 40 && wc.plan && wc.flagged === 0,
      JSON.stringify(wc));

    const oc = await chart('off');
    t.ok('the off-plan chart carries limits and speaks rarely',
      oc.pts === 40 && oc.flagged > 0 && oc.flagged < 8, JSON.stringify(oc));

    /* A storehouse pantry is over the public sodium line most days, so a
       fixed threshold marked every point and said nothing. Salt is judged
       against your own usual, and only where a jump followed it. */
    const jc = await chart('jump');
    t.ok('the day-to-day chart marks some mornings as salt, not all of them',
      jc.salt > 0 && jc.salt < jc.pts / 3, JSON.stringify(jc));

    const rc = await chart('rate');
    t.ok('and the rate chart draws once there is a fortnight of it', rc.pts > 20);

    /* ---- a gap is not a moving range ------------------------------------
     * Miss a fortnight of mornings and the next reading is a fortnight of
     * drift. Pairing it with the last one before the gap and calling the
     * difference a "day-to-day change" inflates mR-bar, which widens every
     * limit on every chart and makes the salt warning fire LESS often --
     * the failure is silent and points the wrong way. Thirty consecutive
     * mornings, a fortnight away, then six more. */
    const gapPage = await t.fresh();
    await gapPage.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const key = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      const ws = {}, days = {};
      const r = window.RECIPES.find((x) => x.macro && x.macro.kcal > 300);
      const jit = [0, 0.3, -0.2, 0.4, -0.3, 0.1, -0.1, 0.2, -0.4, 0.3];
      const at = (i) => { const d = new Date(); d.setDate(d.getDate() - i); return key(d); };
      [].concat(
        Array.from({ length: 30 }, (_, n) => 49 - n),   // 49..20, consecutive
        Array.from({ length: 6 }, (_, n) => 5 - n),     // 5..0, after the gap
      ).forEach((i) => {
        ws[at(i)] = Math.round((204 - 0.2 * (49 - i) + jit[i % 10]) * 10) / 10;
        days[at(i)] = { b: [{ id: r.id, x: 1, eaten: 1 }] };
      });
      localStorage.setItem('bsc.macroWeights', JSON.stringify(ws));
      localStorage.setItem('bsc.macroDays', JSON.stringify(days));
      const goal = new Date(); goal.setDate(goal.getDate() + 120);
      localStorage.setItem('bsc.macroProfile', JSON.stringify({
        sex: 'm', age: 41, ft: 5, inch: 11, lb: 204, act: 1.55, goal: 'cut1',
        goalLb: 175, goalBy: key(goal), workouts: 4, steps: 8000,
      }));
    });
    await gapPage.reload();
    await gapPage.waitForTimeout(400);
    await gapPage.click('.tab[data-view="macros"]');
    await gapPage.waitForTimeout(250);
    await gapPage.click('[data-mchartopen]');
    await gapPage.waitForTimeout(300);
    await gapPage.click('[data-mchart="jump"]');
    await gapPage.waitForTimeout(200);
    const gc = await gapPage.evaluate(() => Array.prototype.map.call(
      document.querySelectorAll('.mc-svg circle title'), (el) => el.textContent));

    /* Every assertion carries its own length check: an empty list makes
       .every() true, which is exactly how a broken chart passes a test. */
    t.ok('the pair that straddles the gap is not plotted as a day-to-day change',
      gc.length === 34, 'points: ' + gc.length);

    /* And the harm the limits take: bridged, that one ~3 lb "overnight
       change" sits far outside its own upper limit and flags -- while
       dragging mR-bar up under every other chart's limits with it. */
    t.ok('and nothing on the chart reads as a signal, because nothing is one',
      await gapPage.evaluate(() => document.querySelectorAll('.mc-sig').length) === 0);

    /* The consequence the limits actually turn on: with the gap bridged, a
       fortnight of loss enters mR-bar as one ~3 lb overnight change. */
    t.ok('and no plotted overnight change is a fortnight of drift in disguise',
      gc.length > 0 && gc.every((s) => Math.abs(parseFloat(s.split('\u00b7').pop())) < 2),
      gc.filter((s) => Math.abs(parseFloat(s.split('\u00b7').pop())) >= 2).join(' | '));

    await gapPage.click('[data-mchart="weight"]');
    await gapPage.waitForTimeout(200);
    t.ok('while the weight chart still plots every morning there was one',
      await gapPage.evaluate(() => document.querySelectorAll('.mc-svg circle').length) === 36);
    await gapPage.context().close();

    await chartPage.goBack();
    await chartPage.waitForTimeout(250);
    t.ok('the back gesture closes it like every other sheet',
      await chartPage.evaluate(() => !document.querySelector('.mc-sheet')));
    await chartPage.context().close();

    /* ---- the morning line -----------------------------------------------
     * One sentence about what to do, and most mornings it says nothing to
     * do. Its own page, because every state needs a different history seeded
     * underneath it and the app reads those once, at boot. */
    const lineFor = async (seed) => {
      const pg = await t.fresh();
      await pg.evaluate((cfg) => {
        const p2 = (n) => (n < 10 ? '0' : '') + n;
        const key = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
        const ws = {}, days = {};
        const r = window.RECIPES.find((x) => x.macro && x.macro.kcal > 300 && x.macro.na > 400);
        const jitter = [0, 0.3, -0.2, 0.4, -0.3, 0.1, -0.1, 0.2, -0.4, 0.3];
        const gap = cfg.gapDays || 0;         // mornings missed just before today
        const prevI = gap + 1;                // so the last morning there WAS one
        for (let i = cfg.n - 1; i >= 0; i--) {
          if (i > 0 && i <= gap) continue;    // the fortnight away
          const d = new Date(); d.setDate(d.getDate() - i);
          let w = 204 - cfg.rate * (cfg.n - 1 - i) + jitter[i % 10] * 0.9;
          if (cfg.saltToday && i === 0) w += 2.6;
          ws[key(d)] = Math.round(w * 10) / 10;
          const x = Math.round((1700 / r.macro.kcal) * 8) / 8;
          days[key(d)] = { b: [{ id: r.id, x: (cfg.saltToday && i === prevI) ? x * 3 : x, eaten: 1 }] };
        }
        localStorage.setItem('bsc.macroWeights', JSON.stringify(ws));
        localStorage.setItem('bsc.macroDays', JSON.stringify(days));
        const goal = new Date(); goal.setDate(goal.getDate() + 126);
        localStorage.setItem('bsc.macroProfile', JSON.stringify({
          sex: 'm', age: 41, ft: 5, inch: 11, lb: 204, act: 1.55, goal: 'cut1',
          goalLb: cfg.noGoal ? 0 : 175, goalBy: cfg.noGoal ? '' : key(goal),
          workouts: 4, steps: 8000,
        }));
      }, seed);
      await pg.reload();
      await pg.waitForTimeout(400);
      await pg.click('.tab[data-view="macros"]');
      await pg.waitForTimeout(250);
      return pg;
    };

    const onPace = await lineFor({ n: 30, rate: 1.5 / 7 });
    t.ok('on pace, the line says there is nothing to do',
      await onPace.evaluate(() => {
        const el = document.querySelector('.mline');
        return !!el && el.classList.contains('calm') &&
          /Nothing to change/.test(el.textContent) &&
          !el.querySelector('[data-mline]');          // no decision, so no buttons
      }), await onPace.textContent('.mline'));
    await onPace.context().close();

    /* The one that stops you acting. Cutting calories after a salty Tuesday
       is the mistake the whole apparatus exists to prevent. */
    const salty = await lineFor({ n: 30, rate: 1.5 / 7, saltToday: true });
    t.ok('a jump the sodium explains is named as salt, not fat',
      await salty.evaluate(() => {
        const el = document.querySelector('.mline');
        return !!el && el.classList.contains('noise') && /salt, not fat/.test(el.textContent) &&
          !el.querySelector('[data-mline]');
      }), await salty.textContent('.mline'));
    await salty.context().close();

    /* The same claim, after a fortnight away. "Up 2.6 lb -- that is salt,
       not fat" is the one line in the app whose whole job is to stop you
       cutting; aimed at a fortnight of regain and pinned on a dinner two
       weeks gone, it stops you acting on something you should act on. The
       control above it holds every other thing equal, so a failure here is
       the gap and nothing else. */
    const gapCtl = await lineFor({ n: 30, rate: 0, saltToday: true });
    t.ok('a salty morning against yesterday still reads as salt',
      /salt, not fat/.test(await gapCtl.textContent('.mline')),
      await gapCtl.textContent('.mline'));
    await gapCtl.context().close();

    const gapped = await lineFor({ n: 30, rate: 0, saltToday: true, gapDays: 14 });
    const gapLine = await gapped.textContent('.mline');
    t.ok('but the same morning after a fortnight away is not blamed on a dinner',
      gapLine.length > 0 && !/salt, not fat/.test(gapLine), gapLine);
    await gapped.context().close();

    const slow = await lineFor({ n: 30, rate: 0.6 / 7 });
    const behind = await slow.textContent('.mline');
    t.ok('behind pace, it offers a number and the option to ignore it',
      await slow.evaluate(() => {
        const el = document.querySelector('.mline');
        return !!el && el.classList.contains('act') && /behind pace/.test(el.textContent) &&
          el.querySelectorAll('[data-mline]').length === 2;
      }), behind);
    /* A line that says "eat 1,278" is not advice. Whatever it offers has to
       clear the basal rate and stay within a quarter of the day's burn. */
    t.ok('and never asks for less than a body should be asked for',
      await slow.evaluate(() => {
        const b = document.querySelector('[data-mline^="mline:eat"]');
        const want = Number(b.dataset.mline.split(':')[2]);
        /* The profile as the APP reads it: bodyweight comes off the scale
           now, and bsc.macroProfile holds only the fallback for a plan made
           before there was a log. Reading storage here tests a body the
           fixture may have spent thirty mornings losing. */
        const pr = window.__macroLab.profile();
        const kg = pr.lb * 0.45359237, cm = (pr.ft * 12 + pr.inch) * 2.54;
        const bmr = 10 * kg + 6.25 * cm - 5 * pr.age + 5;
        return want >= bmr;
      }), behind);
    // taking it rewrites the grams, and protein is not what gives way
    const heldP = await slow.evaluate(() => (JSON.parse(
      localStorage.getItem('bsc.macroTargets')) || { p: 180 }).p);
    await slow.click('[data-mline^="mline:eat"]');
    await slow.waitForTimeout(300);
    t.ok('taking it moves the carbs and leaves the protein alone',
      await slow.evaluate((wasP) => {
        const b = JSON.parse(localStorage.getItem('bsc.macroTargets'));
        return b.p === wasP;
      }, heldP), await slow.evaluate(() => localStorage.getItem('bsc.macroTargets')));
    await slow.context().close();

    /* It used to draw "7 more mornings and this will say whether you are on
       pace" here, with a progress count under it — a line whose content was
       that it had no content, first thing every morning for a fortnight. A
       line that cannot answer is not a smaller answer.

       Note the failure message reads the CARD, not the line: asking for the
       text of an element that should not exist is a thirty-second timeout
       rather than a red test, which is how this one announced itself. */
    const early = await lineFor({ n: 9, rate: 1.5 / 7 });
    t.ok('with too few mornings to judge, it says nothing at all',
      await early.evaluate(() => !document.querySelector('.mline')),
      await early.evaluate(() => (document.querySelector('.mline') || {}).textContent || ''));

    /* Nothing of it survives, not just the outer box — and the first thing
       in the card is the weigh-in, which was the complaint: it was one of
       the first things read, every morning, and it never said anything.

       (The check this replaced looked for .mline-wrap / .mline-box. Neither
       class has ever existed, so it passed whatever the code did.) */
    t.ok('and nothing of the line is left in the card above the plate',
      await early.evaluate(() => {
        const card = document.querySelector('.mw, .mweigh') || document.body;
        return card.querySelectorAll('[class*="mline"]').length === 0 &&
          /WEIGH/i.test(card.textContent) && !/more mornings|on pace/i.test(card.textContent);
      }), await early.evaluate(() =>
        (document.querySelector('.mw, .mweigh') || document.body).textContent.slice(0, 100)));
    await early.context().close();

    /* No date named means no pace to be off — but the burn is the most useful
       thing here and it does not need one. Treating a goal date as the price
       of admission to your own numbers was the bug. */
    const noGoal = await lineFor({ n: 30, rate: 1.5 / 7, noGoal: true });
    t.ok('with no goal date it still says what you burn and what that is worth',
      await noGoal.evaluate(() => {
        const el = document.querySelector('.mline');
        return !!el && /burning about/.test(el.textContent) &&
          /lb a week/.test(el.textContent);
      }), await noGoal.evaluate(() => {
        const el = document.querySelector('.mline');
        return el ? el.textContent : '(no line)';
      }));
    await noGoal.context().close();

    // and nothing at all when there is neither a goal nor enough to measure
    const bare = await lineFor({ n: 5, rate: 1.5 / 7, noGoal: true });
    t.ok('and nothing at all when it has neither',
      await bare.evaluate(() => !document.querySelector('.mline')));
    await bare.context().close();

    /* ---- the weigh-in card ----------------------------------------------
     * Its own page again: weight history is seeded wholesale and the app
     * reads its store once at boot, so the seeding needs a clean reload. */
    const w = await t.fresh();
    await w.click('.tab[data-view="macros"]');
    await w.waitForTimeout(150);

    t.ok('the plan button invites rather than administrates',
      (await w.textContent('#macroTargBtn')).trim() === 'Craft my plan',
      await w.textContent('#macroTargBtn'));

    // one morning's number, filed under the local date at one decimal
    await w.fill('#mWeight', '187.45');
    await w.dispatchEvent('#mWeight', 'change');
    await w.waitForTimeout(200);
    const logged = await w.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const key = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      const ws = JSON.parse(localStorage.getItem('bsc.macroWeights'));
      return { keys: Object.keys(ws), val: ws[key] };
    });
    t.ok('a weigh-in lands under the local date, rounded to a tenth',
      logged.keys.length === 1 && logged.val === 187.5, JSON.stringify(logged));
    t.ok('and the first stop of the day fills in',
      await w.evaluate(() => document.getElementById('macroWeigh').classList.contains('done')));

    // typing alone is enough — the quiet save runs without leaving the box
    await w.fill('#mWeight', '186.2');
    await w.waitForTimeout(900);
    t.ok('a weight saves itself as it is typed, no blur required',
      await w.evaluate(() => {
        const ws = JSON.parse(localStorage.getItem('bsc.macroWeights'));
        return ws[Object.keys(ws)[0]] === 186.2;
      }));

    /* The scale's box is a draft. A sync emit landing mid-keystroke used to
       replace what was typed with the last saved value, while the pending
       save still held the typed one — box and store disagreeing until the
       next render, with further digits landing on the restored old ones. */
    await w.click('#mWeight');
    await w.evaluate(() => {
      const el = document.getElementById('mWeight');
      el.focus();
      el.value = '191.3';
      window.Store.emit && window.Store.emit();
    });
    await w.evaluate(() => window.dispatchEvent(new Event('resize')));
    await w.waitForTimeout(150);
    t.ok('a re-render mid-keystroke does not eat what is being typed',
      await w.evaluate(() => document.getElementById('mWeight').value === '191.3'),
      await w.evaluate(() => document.getElementById('mWeight').value));
    await w.evaluate(() => { document.getElementById('mWeight').blur(); });
    await w.waitForTimeout(150);

    // an emptied box un-logs the day
    await w.fill('#mWeight', '');
    await w.dispatchEvent('#mWeight', 'change');
    await w.waitForTimeout(200);
    t.ok('clearing the box un-logs the morning',
      await w.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('bsc.macroWeights'))).length === 0));

    /* twenty mornings of a working cut: 0.2 lb a day, latest today. The same
       arithmetic the card claims, done independently here: seven-day average
       190.6, the week before averages 192.0, so the week reads down 1.4. */
    await w.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const ws = {};
      for (let i = 0; i < 20; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        ws[d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate())] =
          Math.round((190 + i * 0.2) * 10) / 10;
      }
      localStorage.setItem('bsc.macroWeights', JSON.stringify(ws));
    });
    await w.reload();
    await w.waitForTimeout(300);
    await w.click('.tab[data-view="macros"]');
    await w.waitForTimeout(150);
    const card = () => w.textContent('#macroWeigh');
    /* Folded, the card is the number you type and the average — the whole job
       most mornings. The trend and the sparkline are behind the same press
       the meals use. */
    t.ok('folded, the card carries the average and nothing else',
      /190\.6 lb avg/.test(await card()) && !/since/.test(await card()), await card());
    await w.click('#macroWeigh [data-mfold]');
    await w.waitForTimeout(200);
    t.ok('the headline is the seven-day average',
      /seven-day average 190\.6/.test(await card()), await card());
    t.ok('the week is judged average against average',
      /down 1\.4 lb on the week before/.test(await card()), await card());
    t.ok('and the whole arc since the first morning is there',
      /down 3\.8 lb since/.test(await card()), await card());
    t.ok('with a sparkline once there is a line to draw',
      await w.evaluate(() => !!document.querySelector('.mw-spark polyline')));

    // ‹ shows yesterday's number in the box, filed where it belongs
    await w.click('#macroPrev');
    await w.waitForTimeout(150);
    t.ok('a missed morning can be read and edited under its own day',
      await w.evaluate(() => Number(document.getElementById('mWeight').value) === 190.2),
      await w.evaluate(() => document.getElementById('mWeight').value));

    // and the selector jumps straight to a day the arrows would take five taps to reach
    const fiveBack = await w.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date(); d.setDate(d.getDate() - 5);
      return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
    });
    await w.selectOption('#macroDaySel', fiveBack);
    await w.waitForTimeout(150);
    t.ok('the day selector jumps, and the day it lands on is really that day',
      await w.evaluate(() => Number(document.getElementById('mWeight').value) === 191),
      await w.evaluate(() => document.getElementById('mWeight').value));

    await w.context().close();

    /* ---- the day's meals are the reader's to shape --------------------- */
    const m = await t.fresh();
    await m.click('.tab[data-view="macros"]');
    await m.waitForTimeout(150);

    await openPlan(m);
    await m.waitForTimeout(200);
    t.ok('the sheet starts with the four meals everyone starts with',
      await m.evaluate(() => document.querySelectorAll('#mtMeals .mtm-row').length) === 4);

    // a morning brew, added and walked to the top of the day
    await m.click('[data-mtmeal="add"]');
    await m.waitForTimeout(100);
    await m.fill('#mtMeals .mtm-row:last-child .mtm-name', 'Crio Brü');
    for (let i = 0; i < 4; i++) {
      await m.evaluate(() => {
        const row = [...document.querySelectorAll('#mtMeals .mtm-row')]
          .find((r) => r.querySelector('.mtm-name').value === 'Crio Brü');
        row.querySelector('.mtm-move').click();
      });
      await m.waitForTimeout(50);
    }
    t.ok('a new meal can be walked to the top of the day',
      await m.evaluate(() =>
        document.querySelector('#mtMeals .mtm-row .mtm-name').value === 'Crio Brü'));
    await m.click('[data-mtarg="save"]');
    await m.waitForTimeout(300);
    const slotNames = () => m.evaluate(() =>
      [...document.querySelectorAll('#macroSlots .mslot-name')].map((n) => n.textContent));
    t.ok('the day now has five meals, the brew first',
      (await slotNames()).length === 5 && (await slotNames())[0] === 'Crio Brü',
      (await slotNames()).join(' | '));

    await openPlan(m);
    await m.waitForTimeout(200);
    t.ok('and the shape survives a reopen',
      await m.evaluate(() => {
        const rows = document.querySelectorAll('#mtMeals .mtm-row');
        return rows.length === 5 && rows[0].querySelector('.mtm-name').value === 'Crio Brü';
      }));
    await m.click('.sheet-x');
    await m.waitForTimeout(300);

    // put something on the brew and on Lunch, for the two tests that follow
    for (const which of [0, 2]) {
      await m.evaluate((n) => document.querySelectorAll('[data-mslot]')[n].click(), which);
      await pickerList(m);
      await m.waitForTimeout(250);
      /* A RECIPE, because what follows opens the plate as a recipe and scales
         it by servN. The list holds single foods beside dishes now, so taking
         the first row can put a spoonful on the plate and the lookup then
         finds nothing. */
      await m.evaluate(() => {
        const r = [...document.querySelectorAll('.mpick-row[data-mpx]')]
          .find((x) => !/^f:/.test(x.dataset.mpick));
        if (r) r.click();
      });
      await m.waitForTimeout(200);
      await m.click('[data-mpdone]');
      await m.waitForTimeout(300);
    }

    /* The portion ports into the recipe: the sheet opens at the batch that
       makes the plate — x over servN, snapped to the eighths it prints in. */
    const port = await m.evaluate(() => {
      const b = [...document.querySelectorAll('.mitem-name')]
        .find((x) => x.dataset.open && !/^f:/.test(x.dataset.open));
      const r = window.RECIPES.find((x) => String(x.id) === b.dataset.open);
      return { x: Number(b.dataset.mx), servN: r.servN || 1, id: b.dataset.open };
    });
    const snapped = Math.max(0.125, Math.round(port.x / port.servN * 8) / 8);
    const fmt = (n) => {
      const wh = Math.floor(n + 1e-9); const e8 = Math.round((n - wh) * 8);
      if (e8 === 0) return String(wh || 0); if (e8 === 8) return String(wh + 1);
      return (wh ? wh + ' ' : '') + { 1: '⅛', 2: '¼', 3: '⅜', 4: '½', 5: '⅝', 6: '¾', 7: '⅞' }[e8];
    };
    await m.click('.mitem-name');
    await m.waitForTimeout(250);
    t.ok('opening a plate opens its recipe at the batch that makes the portion',
      (await m.textContent('.scaler-val')).trim() === fmt(snapped) + '×',
      (await m.textContent('.scaler-val')) + ' — wanted ' + fmt(snapped) + '× (x' + port.x + ', serves ' + port.servN + ')');
    await m.goBack();
    await m.waitForTimeout(250);

    /* Removing a meal from the plan does not remove its history: the plate
       logged under Lunch keeps its card and keeps counting. */
    const beforeP = await m.evaluate(() => document.querySelector('.mb-num').textContent);
    await openPlan(m);
    await m.waitForTimeout(200);
    await m.evaluate(() => {
      const row = [...document.querySelectorAll('#mtMeals .mtm-row')]
        .find((r) => r.querySelector('.mtm-name').value === 'Lunch');
      row.querySelector('[data-mtmeal="del"]').click();
    });
    await m.waitForTimeout(100);
    await m.click('[data-mtarg="save"]');
    await m.waitForTimeout(300);
    t.ok('a removed meal with food on the day keeps its card',
      await m.evaluate(() => {
        const names = [...document.querySelectorAll('#macroSlots .mslot-name')].map((n) => n.textContent);
        return names.length === 5 && names.indexOf('Lunch') === 4;
      }), (await slotNames()).join(' | '));
    t.ok('but loses its Add button — it is history, not a plan',
      await m.evaluate(() => {
        const cards = document.querySelectorAll('#macroSlots .mslot');
        return !cards[cards.length - 1].querySelector('.mslot-add');
      }));
    t.ok('and its grams still count',
      (await m.evaluate(() => document.querySelector('.mb-num').textContent)) === beforeP);

    await m.context().close();

    /* ---- lenses, locks, and the rebalancer ------------------------------ */
    const z = await t.fresh();
    await z.click('.tab[data-view="macros"]');
    await z.waitForTimeout(150);

    // the picker's sort is a lens: order changes, portions stay
    await z.click('[data-mslot="b"]');
    await pickerList(z);
    await z.waitForTimeout(200);
    /* The RANKED band only, and its recipe rows only.
     *
       An order is a lens on the ranking, and the ranking is what "Fits best"
       holds. Pins sit above it under "Every day" and stay there whatever the
       order says — a pin means always, and a sort must not outrank it — so
       reading every row on the screen would test the composition rather than
       the sort. */
    const rankedRows = () => z.evaluate(() => {
      const out = [];
      let inBand = false;
      [...document.querySelectorAll('#mpList > *')].forEach((el) => {
        if (el.classList.contains('mt-div')) { inBand = /^Fits best|^On the shelf/.test(el.textContent); return; }
        if (!inBand) return;
        const b = el.querySelector('.mpick-row[data-mpx]');
        if (b && !/^f:/.test(b.dataset.mpick)) out.push(b.dataset.mpick);
      });
      return out;
    });
    await z.selectOption('#mpSort', 'protein');
    await z.waitForTimeout(250);
    const byP = await rankedRows();
    t.ok('sorting by protein puts the most protein first',
      byP.length > 2 && await z.evaluate((ids) => {
        const pOf = (id) => window.RECIPES.find((x) => String(x.id) === id).macro.p;
        return ids.every((id, i) => i === 0 || pOf(ids[i - 1]) >= pOf(id));
      }, byP), byP.length + ' ranked rows');
    await z.selectOption('#mpSort', 'healthy');
    await z.waitForTimeout(250);
    const byH = await rankedRows();
    t.ok('and by health score, healthiest first',
      byH.length > 2 && await z.evaluate((ids) => {
        const sOf = (id) => window.RECIPES.find((x) => String(x.id) === id).score;
        return ids.every((id, i) => i === 0 || sOf(ids[i - 1]) >= sOf(id));
      }, byH), byH.length + ' ranked rows');

    // the section lens speaks the browse tab's vocabulary
    await z.selectOption('#mpSec', '2-4');
    await z.waitForTimeout(150);
    /* The lens drives the RANKED band's pool. Pins, recents and the closers
       are their own bands with their own reasons for being there — a pin is
       always offered, which is what a pin means — so the claim is about what
       the ranking draws from, not about every row on the screen. */
    t.ok('a single section can be looked at on its own',
      await z.evaluate(() => {
        const rows = [];
        let inBand = false;
        [...document.querySelectorAll('#mpList > *')].forEach((el) => {
          if (el.classList.contains('mt-div')) { inBand = /^Fits best|^On the shelf/.test(el.textContent); return; }
          if (!inBand) return;
          const b = el.querySelector('.mpick-row[data-mpick]');
          if (b) rows.push(b.dataset.mpick);
        });
        return rows.length > 0 && rows.every((id) => {
          if (/^f:/.test(id)) return false;
          const rec = window.RECIPES.find((x) => String(x.id) === id);
          return rec && rec.book === 2 && rec.secNum === 4;
        });
      }));
    await z.selectOption('#mpSec', 'meal');
    await z.waitForTimeout(150);

    // one plate on the day, shrunk by hand, put right by the button
    await pickRecipe(z);
    await z.click('[data-mpdone]');
    await z.waitForTimeout(300);
    for (let i = 0; i < 20; i++) await z.click('[data-mstep="b:0:down"]');
    await z.waitForTimeout(150);
    // how far the day is off its protein, signed, straight from its row
    const protGap = () => z.evaluate(() =>
      Number(document.querySelector('.mbrow[data-macro="p"] .mb-d b').textContent));
    const leftBefore = await protGap();
    await z.click('#macroRebal');
    await z.waitForTimeout(250);
    t.ok('Rebalance grows a shrunken plate back toward the day',
      await z.evaluate(() => document.querySelector('.mstep-x').textContent !== '×¼'),
      await z.textContent('.mstep-x'));
    t.ok('and the day is nearer its protein than before',
      Math.abs(await protGap()) < Math.abs(leftBefore),
      'was ' + leftBefore + ', now ' + (await protGap()));

    /* "Not that, what else?" — the commonest move there is, and until now it
       meant deleting a plate and reopening the picker. Try again walks down
       the ranked list a step at a time. */
    const firstPick = await z.evaluate(() =>
      document.querySelector('.mitem-name').dataset.open);
    await z.click('[data-mtry="b"]');
    await z.waitForTimeout(250);
    const second = await z.evaluate(() =>
      document.querySelector('.mitem-name').dataset.open);
    t.ok('Try again swaps the plate for another one',
      second && second !== firstPick, firstPick + ' → ' + second);
    await z.click('[data-mtry="b"]');
    await z.waitForTimeout(250);
    const third = await z.evaluate(() =>
      document.querySelector('.mitem-name').dataset.open);
    t.ok('and again walks a further step, not back to the first',
      third && third !== second && third !== firstPick,
      [firstPick, second, third].join(' → '));
    t.ok('leaving exactly one plate on the meal each time',
      await z.evaluate(() => {
        const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
        return days[Object.keys(days)[0]].b.length === 1;
      }));
    /* A plain food is a legitimate answer here — they were added to Try again
       deliberately, because a day rarely divides into whole recipes — so the
       claim is that whatever it offered came from the meal's own pool: a
       recipe from breakfast's sections, or a food you can eat as it comes. */
    t.ok('and only ever offering what the meal draws from',
      await z.evaluate(() => {
        const id = document.querySelector('.mitem-name').dataset.open;
        if (/^f:/.test(id)) {
          const f = window.Nutrition.FOODS[String(id).replace(/^f:/, '')];
          return !!f && !!(f.eat || f.side);
        }
        const r = window.RECIPES.find((x) => String(x.id) === id);
        return !!r && r.book === 1 && r.secNum === 1;   // breakfast's own sections
      }));

    // the lock holds against the machine, not the hand
    await z.click('[data-mlock="b:0"]');
    await z.waitForTimeout(150);
    t.ok('a plate can be locked', await z.evaluate(() =>
      document.querySelector('[data-mlock="b:0"]').getAttribute('aria-pressed') === 'true'));
    for (let i = 0; i < 20; i++) await z.click('[data-mstep="b:0:down"]');
    await z.waitForTimeout(150);
    t.ok('a locked plate is not the machine\u2019s to swap, nor joined by another',
      await z.evaluate(async () => {
        const before = document.querySelector('.mitem-name').dataset.open;
        const n = document.querySelectorAll('.mitem').length;
        document.querySelector('[data-mtry="b"]').click();
        await new Promise((r) => setTimeout(r, 250));
        return document.querySelector('.mitem-name').dataset.open === before &&
          document.querySelectorAll('.mitem').length === n;
      }));
    t.ok('the stepper still obeys the hand on a locked plate',
      (await z.textContent('.mstep-x')).indexOf('¼') >= 0);
    t.ok('but Rebalance has nothing left to move, and says so',
      await z.evaluate(() => document.getElementById('macroRebal').disabled));

    // a custom meal draws from exactly the boxes it ticked
    await openPlan(z);
    await z.waitForTimeout(200);
    await z.selectOption('#mtMeals .mtm-row:first-child .mtm-type', 'x');
    await z.waitForTimeout(150);
    t.ok('choosing sections unfolds the checklist',
      await z.evaluate(() => {
        const l = document.querySelector('#mtMeals .mtm-row .mtm-secs');
        return l && !l.classList.contains('hide');
      }));
    /* Thirteen ticks have done their job the moment the ticking is over.
       Done folds them into a line that says what was chosen, and Change
       brings them back — the wall is not left standing between the meals. */
    await z.evaluate(() => {
      document.querySelectorAll('#mtMeals .mtm-row:first-child .mtm-secs input').forEach((cb) => {
        cb.checked = ['1-6', '1-2'].indexOf(cb.value) >= 0;
        cb.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
    await z.click('#mtMeals .mtm-row:first-child [data-mtsec="done"]');
    await z.waitForTimeout(150);
    t.ok('Done folds the checklist into what it chose',
      await z.evaluate(() => {
        const row = document.querySelector('#mtMeals .mtm-row:first-child');
        return row.querySelector('.mtm-secs').classList.contains('hide') &&
          !row.querySelector('.mtm-secsum').classList.contains('hide') &&
          /Snacks/.test(row.querySelector('.mtm-secsum-t').textContent) &&
          /Power Drinks/.test(row.querySelector('.mtm-secsum-t').textContent);
      }), await z.textContent('#mtMeals .mtm-row:first-child .mtm-secsum-t'));
    await z.click('#mtMeals .mtm-row:first-child [data-mtsec="show"]');
    await z.waitForTimeout(150);
    t.ok('and Change brings them back',
      await z.evaluate(() => !document.querySelector('#mtMeals .mtm-row:first-child .mtm-secs')
        .classList.contains('hide')));
    await z.evaluate(() => {
      document.querySelectorAll('#mtMeals .mtm-row:first-child .mtm-secs input').forEach((cb) => {
        cb.checked = cb.value === '1-6';        // Power Drinks alone
      });
    });
    await z.click('[data-mtarg="save"]');
    await z.waitForTimeout(300);
    await z.click('[data-mslot="b"]');
    await pickerList(z);
    await z.waitForTimeout(200);
    /* Every RECIPE the ranking offers comes from that section. Single foods
       ride along in every meal's pool by design — a day rarely divides into
       whole recipes — and pins and recents are their own bands with their own
       reasons, so the claim is about what the ranking draws from. */
    t.ok('the meal now draws from exactly the section it ticked',
      await z.evaluate(() => {
        const ids = [];
        let inBand = false;
        [...document.querySelectorAll('#mpList > *')].forEach((el) => {
          if (el.classList.contains('mt-div')) { inBand = /^Fits best|^On the shelf/.test(el.textContent); return; }
          if (!inBand) return;
          const b = el.querySelector('.mpick-row[data-mpick]');
          if (b) ids.push(b.dataset.mpick);
        });
        const recs = ids.filter((id) => !/^f:/.test(id));
        return recs.length > 0 && recs.every((id) => {
          const rec = window.RECIPES.find((x) => String(x.id) === id);
          return rec && rec.book === 1 && rec.secNum === 6;
        });
      }));

    /* Shares: a meal weighted heavier asks for more of the same dish. */
    const w20 = await z.evaluate(() => {
      const r = document.querySelector('.mpick-row[data-mpx]');
      return { id: r.dataset.mpick, x: Number(r.dataset.mpx) };
    });
    await z.goBack();
    await z.waitForTimeout(250);
    await openPlan(z);
    await z.waitForTimeout(200);
    /* The kind defaults are 20/25/35/10 — a 90 — and the save that switched
       breakfast to custom sections has already squared them to 100, so what
       shows here is the rescaled quartet. */
    t.ok('every meal shows its share of the day, squared to 100',
      await z.evaluate(() =>
        [...document.querySelectorAll('.mtm-share')].map((i) => i.value).join(',') === '22,28,39,11'),
      await z.evaluate(() => [...document.querySelectorAll('.mtm-share')].map((i) => i.value).join(',')));
    await z.fill('#mtMeals .mtm-row:first-child .mtm-share', '60');
    await z.click('[data-mtarg="save"]');
    await z.waitForTimeout(300);
    await z.click('[data-mslot="b"]');
    await pickerList(z);
    await z.waitForTimeout(200);
    const w60 = await z.evaluate((id) => {
      const r = [...document.querySelectorAll('.mpick-row[data-mpx]')].find((x) => x.dataset.mpick === id);
      return r ? Number(r.dataset.mpx) : null;
    }, w20.id);
    t.ok('a bigger share asks for a bigger portion of the same dish',
      w60 !== null && w60 >= w20.x, '×' + w20.x + ' → ×' + w60);

    await z.context().close();

    /* ---- shares that square to 100, pins, and the family's plan --------- */
    const y = await t.fresh();
    await y.click('.tab[data-view="macros"]');
    await y.waitForTimeout(150);

    // shares normalize on Save, and the total line tells the truth meanwhile
    await openPlan(y);
    await y.waitForTimeout(200);
    t.ok('the total says the sum and which way it leans',
      /90%/.test(await y.textContent('#mtmTotal')) &&
      /10% short/.test(await y.textContent('#mtmTotal')), await y.textContent('#mtmTotal'));
    for (let i = 1; i <= 4; i++) {
      await y.fill('#mtMeals .mtm-row:nth-child(' + i + ') .mtm-share', '10');
    }
    t.ok('and follows the boxes as they change',
      /40%/.test(await y.textContent('#mtmTotal')) &&
      /60% short/.test(await y.textContent('#mtmTotal')), await y.textContent('#mtmTotal'));
    await y.fill('#mtMeals .mtm-row:nth-child(1) .mtm-share', '80');
    await y.waitForTimeout(100);
    t.ok('and says over when it is over',
      /110%/.test(await y.textContent('#mtmTotal')) &&
      /10% over/.test(await y.textContent('#mtmTotal')), await y.textContent('#mtmTotal'));
    await y.fill('#mtMeals .mtm-row:nth-child(1) .mtm-share', '10');
    await y.waitForTimeout(100);
    await y.click('[data-mtarg="save"]');
    await y.waitForTimeout(300);
    await openPlan(y);
    await y.waitForTimeout(200);
    t.ok('Save rescales equal shares to a clean hundred',
      await y.evaluate(() =>
        [...document.querySelectorAll('.mtm-share')].map((i) => i.value).join(',') === '25,25,25,25'),
      await y.evaluate(() => [...document.querySelectorAll('.mtm-share')].map((i) => i.value).join(',')));
    t.ok('and says so', /100%/.test(await y.textContent('#mtmTotal')) &&
      /spot on/.test(await y.textContent('#mtmTotal')), await y.textContent('#mtmTotal'));
    await y.click('.sheet-x');
    await y.waitForTimeout(300);

    // pin a plate; a brand-new today arrives with it already served
    await y.click('[data-mslot="b"]');
    await pickerList(y);
    await y.waitForTimeout(200);
    await pickRecipe(y);
    await y.click('[data-mpdone]');
    await y.waitForTimeout(300);
    const pinned = await y.evaluate(() => {
      const b = document.querySelector('.mitem-name');
      return { id: b.dataset.open, x: Number(b.dataset.mx) };
    });
    await y.click('[data-mpin="b:0"]');
    await y.waitForTimeout(200);
    t.ok('the pin takes hold on the plate and in the meal',
      await y.evaluate((id) => {
        const btn = document.querySelector('[data-mpin="b:0"]');
        const slots = JSON.parse(localStorage.getItem('bsc.macroSlots'));
        const b = slots.list.find((s) => s.k === 'b');
        return btn.getAttribute('aria-pressed') === 'true' &&
          b.pins && b.pins.length === 1 && String(b.pins[0].id) === id;
      }, pinned.id));
    await y.evaluate(() => localStorage.removeItem('bsc.macroDays'));   // tomorrow, in effect
    await y.reload();
    await y.waitForTimeout(400);
    await openDay(y);
    t.ok('a new day wakes up with the routine already on it',
      await y.evaluate(([id, x]) => {
        const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
        const day = days[Object.keys(days)[0]];
        return day.b.length === 1 && String(day.b[0].id) === id && day.b[0].x === x &&
          document.querySelector('[data-mpin="b:0"]').getAttribute('aria-pressed') === 'true';
      }, [pinned.id, pinned.x]));
    await y.click('[data-mpin="b:0"]');
    await y.waitForTimeout(200);
    t.ok('unpinning stops tomorrow but keeps today’s copy',
      await y.evaluate(() => {
        const slots = JSON.parse(localStorage.getItem('bsc.macroSlots'));
        const b = slots.list.find((s) => s.k === 'b');
        return (!b.pins || !b.pins.length) && document.querySelectorAll('.mitem').length === 1;
      }));

    // the family's plan feeds in as a picker lens, portioned for your targets
    const famIds = await y.evaluate(() => {
      const wd = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];
      const picks = window.RECIPES.filter((r) => r.book === 2 && r.secNum === 3).slice(0, 2);
      picks.forEach((r) => window.Store.addToDay(r.id, wd, 1));
      return picks.map((r) => String(r.id));
    });
    await y.waitForTimeout(300);
    await y.click('[data-mslot="d"]');
    await pickerList(y);
    await y.waitForTimeout(200);
    t.ok('the picker offers the family’s plan when there is one',
      await y.evaluate(() => {
        const o = [...document.querySelectorAll('#mpSec option')].find((x) => x.value === 'family');
        return !!o && /plan \(2\)/.test(o.textContent);
      }));
    await y.selectOption('#mpSec', 'family');
    await y.waitForTimeout(200);
    /* Exactly the family's two, in the band the lens drives. The other bands
       answer their own questions — a pin is offered whatever lens you are
       standing in — so "exactly what the family is having" is a claim about
       the ranking. */
    t.ok('and choosing it shows exactly what the family is having, fit-portioned',
      await y.evaluate((ids) => {
        const rows = [];
        let inBand = false;
        [...document.querySelectorAll('#mpList > *')].forEach((el) => {
          if (el.classList.contains('mt-div')) { inBand = /^Fits best|^On the shelf/.test(el.textContent); return; }
          if (!inBand) return;
          const b = el.querySelector('.mpick-row[data-mpx]');
          if (b) rows.push(b.dataset.mpick);
        });
        return rows.length === 2 && rows.every((id) => ids.indexOf(id) >= 0);
      }, famIds));

    /* The day, as plain text, for typing into whatever else you keep. */
    await y.goBack();                       // the family picker is still up
    await y.waitForTimeout(250);
    await y.click('#macroFill');
    await y.waitForTimeout(400);

    /* A personal portion must not become the household's batch. A recipe
       opened from My Day arrives scaled to make one plate — an eighth of a
       roast, say — and that used to be the size planned for the family. */
    await y.evaluate(() => {
      const r = window.RECIPES.find((x) => (x.servN || 1) >= 4 && x.macro);
      window.__probe = r.id;
      window.Store.state.plan.mon = [];
    });
    await y.click('.mitem-name');
    await y.waitForTimeout(300);
    const cook = await y.evaluate(() => {
      const v = document.querySelector('.scaler-val');
      return v ? v.textContent.trim() : '';
    });
    await y.click('[data-add][data-day="mon"]');
    await y.waitForTimeout(300);
    t.ok('the week is only ever planned in sizes the week understands',
      await y.evaluate(() => {
        const SC = [1, 2, 3, 4, 0.5];
        return window.Store.day('mon').every((e) => SC.indexOf(e.x) >= 0);
      }), 'sheet was at ' + cook + ', week got ' +
        await y.evaluate(() => JSON.stringify(window.Store.day('mon').map((e) => e.x))));
    await y.goBack();
    await y.waitForTimeout(250);

    await y.fill('#mWeight', '188.6');
    await y.dispatchEvent('#mWeight', 'change');
    await y.waitForTimeout(250);
    const copied = await y.evaluate(() => {
      let got = null;
      navigator.clipboard.writeText = (t2) => { got = t2; return Promise.resolve(); };
      document.getElementById('macroCopy').click();
      return got;
    });
    t.ok('the copy carries the weight, the plates and the totals',
      /* Portions in words, not multipliers: whatever this is pasted into
         knows what a serving is and has never heard of ×0.75. */
      copied && /Weight: 188\.6 lb/.test(copied) && /Total: \d+ kcal/.test(copied) &&
      /Target: \d+ kcal/.test(copied) && /\([\d½¼¾⅓⅔⅛⅜⅝⅞][^)]*\)/.test(copied),
      (copied || '').slice(0, 120));
    t.ok('and names every meal that has something on it',
      await y.evaluate((txt) => {
        const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
        const day = days[Object.keys(days)[0]];
        const slots = JSON.parse(localStorage.getItem('bsc.macroSlots'));
        return slots.list.every((s2) => !(day[s2.k] || []).length || txt.indexOf(s2.n + ':') >= 0);
      }, copied));

    /* ---- whose day it is ------------------------------------------------
     * The whole app works without an account, on the device it is open on.
     * An account does one thing: it lets a second device know you. And the
     * thing it guards is a weight history, so it is guarded by whose it is
     * rather than by a code that can be read aloud or forwarded. */
    const a2 = await t.fresh();
    await a2.click('.tab[data-view="macros"]');
    await a2.waitForTimeout(200);
    t.ok('the whole tab works with nobody signed in',
      await a2.evaluate(() => document.querySelectorAll('.mslot').length === 4));
    /* One sheet, two cards, split by whose it is: your day is private and
       carried between your own devices; the pantry is shared with people by a
       code. The distinction is the point, so it is drawn by heading rather
       than by paragraphs of explanation. */
    /* Everything fetched up to HERE is what a reader who never signs in
       causes. Taken before the sheet is opened, because opening the sheet is
       not "never signing in" — it is asking to. */
    const bootOutside = await a2.evaluate(() => performance.getEntriesByType('resource')
      .filter((e) => e.name.indexOf(location.origin) !== 0).map((e) => e.name));
    await a2.click('#syncBtn');
    await a2.waitForTimeout(300);
    t.ok('Google is the way in, said once and not argued for',
      await a2.evaluate(() => {
        const b = document.querySelector('[data-mysync="google"]');
        return !!b && /Sign in with Google/.test(b.textContent) &&
          document.querySelectorAll('.sheet .sync-p').length <= 2;
      }));
    /* ---- signing in without leaving the page ----------------------------
     * Firebase's own Google sign-in leaves for the firebaseapp.com origin and
     * comes back, keeping its handshake in that origin's storage — which
     * every current browser partitions, so the trip back read an empty box
     * and the app fell through to an anonymous account. Pressing the button
     * appeared to do nothing at all.
     *
     * Google Identity Services never leaves the page, so there is no second
     * origin to be partitioned. But their script is a third-party host, and a
     * visitor with no account must still fetch nothing from anywhere — so it
     * is fetched when the sheet opens and never at boot. offline.test.js
     * holds the boot half; this holds the rest. */
    await a2.waitForTimeout(2600);
    const gis = await a2.evaluate(() => {
      const seen = (el) => !!el && el.getBoundingClientRect().height > 0;
      const slot = document.getElementById('myGoogleBtn');
      return {
        drew: !!slot && slot.innerHTML.length > 0,
        ours: seen(document.getElementById('myGoogleFallback')),
        alt: seen(document.getElementById('myGoogleAlt'))
      };
    });
    /* Whichever way it went, exactly one way in is on offer and it is not
       none — the test does not require Google to be reachable from wherever
       this is running. */
    t.ok('there is one way in on screen, whether or not Google answered',
      (gis.drew ? !gis.ours : gis.ours), JSON.stringify(gis));
    /* Google DRAWING a button is not Google accepting it: on an origin the
       client does not allow, the button appears and then refuses, and the
       only sign is a console line nobody reads. The console deletes clients
       unused for six months, so this is not hypothetical. */
    t.ok('and when Google drew it, the older way is still reachable',
      !gis.drew || gis.alt, JSON.stringify(gis));
    /* The client ID is public and belongs in the page. The SECRET beside it
       in the console belongs to servers, and a web app that ships one has
       given it away. */
    t.ok('a client id is configured, and no secret rides along with it',
      await a2.evaluate(() => !!window.GOOGLE_CLIENT_ID &&
        /\.apps\.googleusercontent\.com$/.test(window.GOOGLE_CLIENT_ID)),
      await a2.evaluate(() => String(window.GOOGLE_CLIENT_ID || '').slice(-30)));

    t.ok('and the two cards say whose each one is',
      await a2.evaluate(() => {
        const txt = document.querySelector('.sheet').textContent;
        return /Your day/.test(txt) && /Private to you/.test(txt) &&
          /Your pantry/.test(txt) && /family, friends/.test(txt) &&
          !document.getElementById('macroDevices');
      }), await a2.textContent('.sheet'));
    // the email fallback is kept for people with no Google account, folded away
    t.ok('the email way in waits behind a fold',
      await a2.evaluate(() => {
        const d = document.querySelector('.sync-fold');
        return !!d && !d.open && !!d.querySelector('#myJoin');
      }));
    await a2.evaluate(() => { document.querySelector('.sync-fold').open = true; });
    await a2.fill('#myJoin', 'not-an-email');
    await a2.click('[data-mysync="email"]');
    await a2.waitForTimeout(250);
    t.ok('a malformed address is refused before anything is sent',
      /does not look like an email/i.test(await a2.textContent('.sheet')));

    /* The old private code guarded this with a secret somebody could recite.
       Nothing should be reading it any more. */
    t.ok('no shareable code decides who can read a day now',
      await a2.evaluate(() => {
        const src = document.querySelector('script[src*="app.js"]');
        return !!src && localStorage.getItem('bsc.myCode') === null;
      }));
    /* Asking who somebody is means loading Firebase from another host, and
       doing that on every page load would put a request to gstatic in front
       of every reader who never signs in — the property this app has kept
       since it was built. A device that signed in remembers so locally; only
       that one goes looking. */
    t.ok('a visitor with no account fetches nothing from another host',
      bootOutside.length === 0 &&
        await a2.evaluate(() => localStorage.getItem('bsc.myAccount') === null),
      bootOutside.join(' '));
    /* And once the sheet IS opened, exactly one host may be reached and it is
       the one that draws the sign-in button. Naming it is the point: the old
       assertion covered the whole session, so it would have gone red for the
       right reason and been read as "nothing may ever be fetched", when what
       the app actually promises is that a reader who never asks to sign in
       never phones home. Anything else appearing here is a regression. */
    t.ok('and opening the sheet reaches Google, and nowhere else',
      await a2.evaluate(() => {
        const hosts = [...new Set(performance.getEntriesByType('resource')
          .filter((e) => e.name.indexOf(location.origin) !== 0)
          .map((e) => new URL(e.name).hostname))];
        return hosts.every((h) => h === 'accounts.google.com' || h === 'ssl.gstatic.com');
      }),
      await a2.evaluate(() => [...new Set(performance.getEntriesByType('resource')
        .filter((e) => e.name.indexOf(location.origin) !== 0)
        .map((e) => new URL(e.name).hostname))].join(', ')));
    t.ok('and personal keys still never enter the household document',
      await a2.evaluate(() => JSON.stringify(Object.keys(window.Store.state))
        .indexOf('macro') < 0));

    /* ---- knowing without asking ---------------------------------------
     *
     * The complaint this answers is "I cannot tell if I am signed in." The
     * sheet has always known; you had to open it to be told, which is two
     * presses to learn a thing that ought to be ambient. So the gear carries
     * the answer — but only the half worth interrupting for. */

    /* Nobody who has not signed in should ever meet a warning about an
       account they do not have. This is also the boot promise: finding out
       must not cost them a request to another host. */
    t.ok('a visitor with no account is never warned about one',
      await a2.evaluate(() => {
        const g = document.getElementById('macroMore');
        const w = document.getElementById('macroWho');
        return !!g && !g.classList.contains('mday-warn') && !!w && w.textContent === '';
      }));

    /* A device that HAS an account and cannot reach the server. Firebase is
       cut off at the wire rather than stubbed, so ready() rejects the way it
       would on a train — the path that used to set 'error' and tell nobody. */
    /* Its own context, not t.fresh: cutting the wire makes the page throw on
       purpose, and t.fresh fails a test for any thrown error — rightly, for
       every page that is not this one. */
    const goneCtx = await t.browser.newContext({ viewport: { width: 390, height: 800 } });
    const gone = await goneCtx.newPage();
    // only Firebase. Leave the rest of gstatic alone, or Google's own sign-in
    // script breaks on its assets and throws about something unrelated.
    await gone.route(/firebasejs|firebaseio|identitytoolkit|firestore\.googleapis/,
      async (r) => { await r.abort(); });
    await gone.goto(t.base + 'index.html');
    await gone.evaluate(() => { localStorage.clear(); localStorage.setItem('bsc.myAccount', '1'); });
    await gone.reload({ waitUntil: 'networkidle' });
    await gone.click('.tab[data-view="macros"]');
    /* NOT asserted: that the gear stays quiet in the second before Firebase
       answers. The rule is in mSyncTrouble ('off' warns only once mAuthKnown)
       and it is the reason a signed-in phone does not flash a warning on
       every boot — but the window is not observable through this harness.
       reload() waits on the very script the test is holding, so by the time
       the page can be measured the answer has already arrived. Chasing it
       buys a flaky test for a one-second state; the rule stands on review. */
    await gone.waitForTimeout(2200);
    t.ok('a device whose day cannot reach its account says so on the gear',
      await gone.evaluate(() => {
        const g = document.getElementById('macroMore');
        return !!g && g.classList.contains('mday-warn');
      }),
      await gone.evaluate(() => (document.getElementById('macroMore') || {}).className));
    /* The dot has to be visible, not merely classed — it is drawn by ::after
       and a rule that never landed would fail silently. */
    t.ok('and the mark is actually painted, not just named',
      await gone.evaluate(() => {
        const g = document.getElementById('macroMore');
        const a = g && getComputedStyle(g, '::after');
        return !!a && a.content !== 'none' && parseFloat(a.width) > 4;
      }));
    /* What the sheet says in this state is NOT asserted here, and the reason
       is worth writing down: a later mSyncStart overwrites 'error' with 'off'
       (that path re-runs once mAuthKnown is true and falls through to the
       signed-out branch), so the sheet reads "On this device only" whether or
       not the reject handler fired. An assertion here would pass against the
       bug as happily as against the fix. The gear above is pinned; the
       wording needs the overwrite fixed first. */
    await goneCtx.close();

    /* The invariant the refactor bought, asserted on the source itself.
       Nine sites each remembered to redraw the sheet and two forgot, which is
       not a bug you fix — it is a shape you stop building. Two matches: the
       declaration, and the one setter that tells anybody. */
    const doors = await a2.evaluate(async () => {
      const src = document.querySelector('script[src*="app.js"]').src;
      const txt = await (await fetch(src)).text();
      return (txt.match(/S_SYNC_STATE\s*=\s/g) || []).length;
    });
    t.ok('every sync transition still goes through the one door that tells you',
      doors === 2, doors + ' assignments — one of them is not the setter');

    /* ---- what the security review found -------------------------------
     *
     * A household code is meant to be read aloud, so anyone who has ever
     * heard one can write to that document forever — which makes everything
     * coming back from it input rather than data. sane() used to check four
     * fields and keep the whole object, so secNum arrived exactly as somebody
     * else typed it and went into an HTML attribute in two of these screens. */
    await a2.evaluate(() => {
      const payload = '"></option></select><img src=x onerror="window.__pwned=1">';
      const mine = { evil: { book: 3, name: 'Rolls', ing: ['a'], steps: ['b'],
        secNum: payload, secName: payload } };
      localStorage.setItem('bsc.mine', JSON.stringify(mine));
    });
    await a2.reload();
    await a2.waitForTimeout(400);
    t.ok('a hostile secNum never survives the door',
      await a2.evaluate(() => window.RECIPES.every((r) => typeof r.secNum === 'number')),
      await a2.evaluate(() => JSON.stringify(window.RECIPES
        .filter((r) => typeof r.secNum !== 'number').map((r) => r.secNum))));
    await a2.click('.tab[data-view="macros"]');
    await a2.waitForTimeout(200);
    await a2.click('[data-mslot="b"]');
    await pickerList(a2);
    await a2.waitForTimeout(300);
    t.ok('and opening the picker runs nothing',
      await a2.evaluate(() => !window.__pwned && !document.querySelector('img[src="x"]')));
    await a2.goBack();
    await a2.waitForTimeout(250);
    await openPlan(a2);
    await a2.waitForTimeout(300);
    await a2.evaluate(() => {
      if (document.getElementById('mtEditor').classList.contains('hide')) {
        document.querySelector('[data-mtedit]').click();
      }
      const sel = document.querySelector('#mtMeals .mtm-row .mtm-type');
      if (sel) { sel.value = 'x'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    await a2.waitForTimeout(300);
    t.ok('nor does unfolding the section checklist',
      await a2.evaluate(() => !window.__pwned && !document.querySelector('img[src="x"]')));
    await a2.evaluate(() => localStorage.removeItem('bsc.mine'));

    /* Signing out has to take the day with it, or the next person to sign in
       on this device inherits a stranger's weight history — and publishes it
       into their own account, where its owner can never reach it again. */
    /* The clearing itself needs a real signed-in account to exercise, which
       is why tests/sync.test.js is kept out of the default run — it talks to
       live Firestore. What is checkable here is the promise the sheet makes,
       since the old copy told people the opposite of what now happens. */
    t.ok('the sheet no longer promises that nothing is deleted',
      await a2.evaluate(() => {
        const src = document.documentElement.innerHTML;
        return src.indexOf('Nothing is deleted anywhere') < 0;
      }));

    await a2.context().close();

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
        return { t: c.textContent.replace(/\s+/g, ' ').trim(),
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
    t.ok('and the plus is the only one that pushes, to the right edge',
      !!actsRow &&
        actsRow.kids[1].x - (actsRow.kids[0].x + actsRow.kids[0].w) <= actsRow.gap + 1 &&
        actsRow.kids[actsRow.kids.length - 1].right <= actsRow.pad + 1,
      JSON.stringify(actsRow));

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
          want: Number(((e.querySelector('.mmp-t') || {}).textContent || '').replace('/', '')),
          was: (e.querySelector('.mmp-was') || {}).textContent || null,
          spent: e.classList.contains('spent') }));
      });
      return out;
    });

    const overPg = await askPg(3);
    const beforeAte = await asked(overPg);
    t.ok('before anything is eaten, no meal is asked for anything but its plan',
      Object.keys(beforeAte).length > 2 &&
        Object.values(beforeAte).every((ps) => ps.every((p2) => p2.was === null)),
      JSON.stringify(beforeAte));

    /* Eat the oversized breakfast. */
    await overPg.evaluate(() => {
      const h = [...document.querySelectorAll('#macroSlots [data-mfold]')]
        .find((b) => ((b.querySelector('.mslot-name') || {}).textContent || '') === 'Breakfast');
      if (h && h.getAttribute('aria-expanded') === 'false') h.click();
    });
    await overPg.waitForTimeout(400);
    await overPg.evaluate(() => {
      const tick = document.querySelector('.mslot .mtick input');
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
    /* And where a plan IS shown it differs from the number beside it —
       repeating a figure back to itself is noise on a row with four of them.
       The undereat case below is what proves a plan gets shown at all; this
       is the rule about when it should not be. */
    t.ok('and the plan is never repeated back as the number it replaced',
      !!lunch && lunch.every((p2) => p2.was === null || Number(p2.was) !== p2.want),
      JSON.stringify(lunch));
    t.ok('while the meal that was eaten keeps its own plan, being history',
      !!brek && brek.every((p2) => p2.was === null), JSON.stringify(brek));
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
    await underPg.evaluate(() => {
      const h = [...document.querySelectorAll('#macroSlots [data-mfold]')]
        .find((b) => ((b.querySelector('.mslot-name') || {}).textContent || '') === 'Breakfast');
      if (h && h.getAttribute('aria-expanded') === 'false') h.click();
    });
    await underPg.waitForTimeout(400);
    await underPg.evaluate(() => {
      const tick = document.querySelector('.mslot .mtick input');
      if (tick) tick.click();
    });
    await underPg.waitForTimeout(600);
    const light = (await asked(underPg)).Lunch;
    /* Guarded on the plan being there at all. Number(null) is 0, so without
       it an app that had stopped redistributing entirely would satisfy
       "bigger than nothing" — which is exactly what it did the first time
       this was mutated. */
    t.ok('and leaving food on a plate raises what the meals ahead are asked for',
      !!light && light.some((p2) => p2.was !== null && p2.want > Number(p2.was)),
      JSON.stringify(light));
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
      return {
        verbs: row ? [...row.querySelectorAll('button')].map((b) => ({
          t: b.textContent.replace(/\s+/g, ' ').trim(), off: b.disabled })) : null,
        skipInHeader: !!card.querySelector('.mslot-h [data-mskip]'),
      };
    });
    t.ok('an empty meal offers Skip, not two verbs it cannot use',
      !!emptyVerbs && emptyVerbs.verbs.length === 2 &&
        /skip/i.test(emptyVerbs.verbs[0].t) && !emptyVerbs.verbs[0].off &&
        !emptyVerbs.verbs.some((v) => /another|balance/i.test(v.t)),
      JSON.stringify(emptyVerbs));
    t.ok('and skip is no longer a glyph in the header',
      !!emptyVerbs && !emptyVerbs.skipInHeader, JSON.stringify(emptyVerbs));
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
    t.ok('the card\u2019s verbs are the same button the bottom bar draws',
      reach.coarse && reach.add && reach.retry && reach.bar &&
        reach.add.h === reach.bar.h && reach.retry.h === reach.bar.h &&
        reach.add.w === reach.bar.w,
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

    /* ---- a portion is measured in what the food is measured in -----------
     * Blake: "that cheddar cheese unit is weird. i don't eat a whole cheddar
     * cheese." He was right, and the table already knew: the entry carries a
     * `def` of half a cup, and the code was overruling it with a guess that
     * picked whichever unit landed nearest 130 kcal — a 28 g slice, rendered
     * as "1 whole". Ketchup, mustard, soy and hot sauce were all defaulting
     * to a CUP for the same reason. Where the table states a portion, the
     * table wins. */
    const units = await t.fresh();
    /* Read off the PLATE, not off a re-derivation. The first version of this
       asked window.MFOODS, which the app does not expose, so it passed while
       proving nothing — the same vacuous-green trap the batch test above
       exists to avoid. Put the cheese on a day and read what the card says. */
    const put = await units.evaluate(() => {
      const F = (window.Nutrition || {}).FOODS || {};
      if (!F.cheddar) return null;
      const d = new Date();
      const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
        '-' + String(d.getDate()).padStart(2, '0');
      const days = {}; days[k] = { b: [{ id: 'f:cheddar', x: 1, eaten: 0 }] };
      localStorage.setItem('bsc.macroDays', JSON.stringify(days));
      return { def: F.cheddar.def && F.cheddar.def.unit, has: Object.keys(F.cheddar.g || {}) };
    });
    await units.reload();
    await units.click('.tab[data-view="macros"]');
    await units.waitForTimeout(400);
    for (let i = 0; i < 3; i++) {
      if (!await units.evaluate(() => !!document.querySelector('.mslot-thin'))) break;
      await units.click('#macroOpenAll');
      await units.waitForTimeout(200);
    }
    const said = await units.evaluate(() => {
      const x = document.querySelector('.mstep-x');
      return x ? x.textContent.trim() : null;
    });
    t.ok('the table states a portion for cheddar, and it is not a whole cheese',
      !!put && put.def && put.def !== 'each', JSON.stringify(put));
    t.ok('and the plate counts it in that, not in whole cheeses',
      !!said && said.indexOf('whole') < 0 && said.indexOf(put.def) >= 0,
      'the card says "' + said + '", the table says ' + (put && put.def));
    await units.context().close();

    /* ---- opening a day that was left scrolled ----------------------------
     * The one that actually bit. The browser puts the old scroll position
     * back before the app has drawn anything, so the fold is asked to work
     * before it has ever seen the top of the page — and the gap it needs used
     * to fall back to the card's own computed bottom margin, which is the
     * margin the fold itself wrote a frame earlier. Every frame read its own
     * output and added to it: 183px became 37,691px in under two seconds, and
     * My Day was a screenful of blank paper with the day far above it.
     *
     * Two things hold it now. The app opens at the top, because a restored
     * scroll position belongs to a page that did not exist yet. And there is
     * no fallback at all — with no honest gap the card does not fold. */
    const reopen = await t.fresh({ viewport: { width: 412, height: 915 },
      hasTouch: true, isMobile: true });
    await reopen.click('.tab[data-view="macros"]');
    await reopen.waitForTimeout(200);
    await openPlan(reopen);
    await reopen.waitForTimeout(150);
    await reopen.click('[data-mtarg="save"]');
    await reopen.waitForTimeout(250);
    await reopen.click('#macroFill');
    await reopen.waitForTimeout(700);
    const beforeReopen = await reopen.evaluate(() => document.documentElement.scrollHeight);
    await reopen.evaluate(() => window.scrollTo(0, 600));
    await reopen.waitForTimeout(400);
    await reopen.reload();
    await reopen.waitForTimeout(1000);
    const back = await reopen.evaluate(() => {
      const st = document.querySelector('.mday-stick');
      const items = [...document.querySelectorAll('.mitem, .mthin')];
      return { y: Math.round(window.scrollY), page: document.documentElement.scrollHeight,
        margin: parseFloat((st && st.style.marginBottom) || 0) || 0,
        restoration: history.scrollRestoration,
        onScreen: items.filter((e) => {
          const r = e.getBoundingClientRect();
          return r.bottom > 0 && r.top < window.innerHeight;
        }).length };
    });
    t.ok('reopening a day that was left scrolled starts it at the top',
      back.y === 0 && back.restoration === 'manual',
      'y=' + back.y + ' restoration=' + back.restoration);
    /* The failure was unbounded growth, so what matters is that the page did
       not BALLOON — it is legitimately shorter, because the meals come back
       folded. */
    t.ok('and the page has not run away with itself',
      back.page < beforeReopen + 300 && back.margin < 400,
      'page ' + beforeReopen + ' → ' + back.page + ', margin ' + back.margin + 'px');
    t.ok('and the day is on the screen rather than far above it',
      back.onScreen > 0, 'plates on screen: ' + back.onScreen);
    /* And it must settle, not creep: the old bug grew on every frame, so a
       second look a beat later is the difference between fixed and slower. */
    await reopen.waitForTimeout(1200);
    const settled = await reopen.evaluate(() => document.documentElement.scrollHeight);
    t.ok('and it is still that size a second later, not creeping',
      settled === back.page, back.page + ' → ' + settled);
    await reopen.context().close();

    /* ---- a portion of a batch --------------------------------------------
     * The two tests above ride on whatever Fill happened to draft, and a day
     * of single-serving plates would pass them while proving nothing: only a
     * recipe that makes SEVERAL could ever show the fault. So this one puts a
     * known batch on a known day and reads the card back.
     *
     * The case, exactly as it appeared on Blake's phone: a recipe that makes
     * six, eaten one and three quarters. The card said "10½ servings" — the
     * portion times the whole yield — while the calories on the same line
     * charged for 1¾. Six times too much, on every batch recipe in the book. */
    const batch = await t.fresh();
    const bat = await batch.evaluate(() => {
      const r = window.RECIPES.find((q) => q.servN === 6 && q.macro && q.macro.kcal > 0)
        || window.RECIPES.find((q) => (q.servN || 1) > 1 && q.macro && q.macro.kcal > 0);
      const d = new Date();
      const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
        '-' + String(d.getDate()).padStart(2, '0');
      const days = {}; days[k] = { b: [{ id: r.id, x: 1.75, eaten: 0 }] };
      localStorage.setItem('bsc.macroDays', JSON.stringify(days));
      return { name: r.name, servN: r.servN, kcal: r.macro.kcal, servings: r.servings };
    });
    await batch.reload();
    await batch.click('.tab[data-view="macros"]');
    await batch.waitForTimeout(300);
    // a meal that already has something on it opens shut; the plate is behind that
    for (let i = 0; i < 3; i++) {
      if (!await batch.evaluate(() => !!document.querySelector('.mslot-thin'))) break;
      await batch.click('#macroOpenAll');
      await batch.waitForTimeout(200);
    }
    const batCard = await batch.evaluate(() => {
      const row = document.querySelector('.mitem');
      if (!row) return null;
      return {
        amount: row.querySelector('.mstep-x').textContent.trim(),
        chips: [...row.querySelectorAll('.mchip')].map((c) => c.textContent.trim()),
        mac: (row.querySelector('.mitem-mac') || {}).textContent || ''
      };
    });
    t.ok('a plate holding part of a batch says the part, not the batch',
      !!batCard && batCard.amount.indexOf('1') === 0 && /¾/.test(batCard.amount) &&
        batCard.amount.indexOf(String(bat.servN)) < 0,
      bat.name + ' (' + bat.servings + ') at ×1¾ shows "' + (batCard && batCard.amount) + '"');
    t.ok('and the calories on that line are for the part as well',
      !!batCard && Math.abs(parseInt(batCard.mac.replace(/[^\d]/, ''), 10) -
        Math.round(bat.kcal * 1.75)) <= 1,
      (batCard && batCard.mac) + ' — wanted ' + Math.round(bat.kcal * 1.75) + ' kcal');
    t.ok('while what the recipe makes is said once, as its own tag',
      !!batCard && batCard.chips.some((c) => c === 'makes ' + bat.servN),
      (batCard && batCard.chips.join(' | ')));
    await batch.context().close();

    /* ---- the fold ---------------------------------------------------------
     * On a phone the sticky readout — week strip, four bars, fibre and salt —
     * is a third of the screen, and scrolling down to dinner meant reading
     * dinner through a letterbox. As the page scrolls it closes onto one row
     * of pills carrying the same six numbers; back at the top it opens again.
     *
     * It closes by degrees, not at a line. How far shut the card is comes
     * straight from the scroll position, so there is no threshold anywhere
     * for the two states to flap across — the same scroll position always
     * gives the same card, whichever way you arrived at it, which is what
     * the two-threshold version was buying with hysteresis. `.shrunk` marks
     * the far end of the fold and nothing in between. */
    const ph = await t.fresh({ viewport: { width: 390, height: 720 } });
    await ph.click('.tab[data-view="macros"]');
    await ph.waitForTimeout(200);
    await openPlan(ph);
    await ph.waitForTimeout(200);
    await ph.click('[data-mtarg="save"]');
    await ph.waitForTimeout(250);
    await ph.click('#macroFill');
    await ph.waitForTimeout(500);
    for (let i = 0; i < 4; i++) {
      if (!await ph.evaluate(() => !!document.querySelector('.mslot-thin'))) break;
      await ph.click('#macroOpenAll');
      await ph.waitForTimeout(180);
    }
    t.ok('at the top of the day the readout is open and the pills are put away',
      await ph.evaluate(() => {
        const st = document.querySelector('.mday-stick');
        const pills = document.querySelector('.mpills');
        return !st.classList.contains('shrunk') &&
          getComputedStyle(pills).opacity === '0' &&
          getComputedStyle(document.querySelector('.mbars')).opacity === '1';
      }), await ph.evaluate(() => 'pills opacity ' +
        getComputedStyle(document.querySelector('.mpills')).opacity));
    t.ok('the pills carry the same six numbers as the rows and the bars under them',
      await ph.evaluate(() => {
        const pills = [...document.querySelectorAll('.mpill')].map((x) => x.textContent.replace(/[\s,]/g, ''));
        const rows = [...document.querySelectorAll('.mbrow[data-macro] .mb-d b')].map((x) => x.textContent);
        /* The limit pills carry the figure only — the fill says the
           proportion, so a denominator would say it twice, and dropping it is
           what buys every pill the same width. The open bars keep both. */
        const lim = [...document.querySelectorAll('.mlimits .mlim .mb-num b')]
          .map((x) => x.textContent.replace(/[\s,]/g, ''));
        return pills.length === 6 &&
          rows.every((v, i) => pills[i].indexOf(v) >= 0) &&
          lim.every((v, i) => pills[4 + i].indexOf(v) >= 0);
      }), await ph.evaluate(() => document.querySelector('.mpills').textContent));
    /* And each one is its own bar. This is the whole reason the row exists in
       this form: folded, the number gives the gap and the fill gives the
       proportion, so "under" stops being four identical greys. */
    t.ok('and each pill is filled to the same point as the bar it stands for',
      await ph.evaluate(() => {
        const pct = (el) => {
          const m = (el.getAttribute('style') || '').match(/0 ([\d.]+)%/);
          return m ? parseFloat(m[1]) : null;
        };
        const pills = [...document.querySelectorAll('.mpill')];
        const rows = [...document.querySelectorAll('.mbrow[data-macro]')];
        const okMacro = rows.every((r, i) =>
          pct(pills[i]) !== null && Math.abs(pct(pills[i]) - Number(r.dataset.planned)) <= 1);
        const lims = [...document.querySelectorAll('.mlimits .mlim')];
        const okLim = lims.every((r, i) => {
          const n = r.querySelector('.mb-num').textContent.replace(/[^\d/]/g, '').split('/');
          const want = Math.min(100, 100 * Number(n[0]) / Number(n[1]));
          return pct(pills[4 + i]) !== null && Math.abs(pct(pills[4 + i]) - want) <= 1;
        });
        return okMacro && okLim;
      }),
      await ph.evaluate(() => [...document.querySelectorAll('.mpill')]
        .map((x) => x.textContent.trim() + ((x.getAttribute('style') || '').match(/0 [\d.]+%/) || [''])[0])
        .join(' | ')));
    /* Folding must not change what the day is said to be: a pill filled green
       above a bar coloured red would be two opinions of one number. */
    t.ok('and wears the same verdict, so folding says nothing new',
      await ph.evaluate(() => {
        const tone = (el) => ((el.getAttribute('style') || '').match(/--dial-(\w+)-pale|--mlim-(\w+)-pale/) || [])[0] || '';
        const pills = [...document.querySelectorAll('.mpill')];
        const rows = [...document.querySelectorAll('.mbrow[data-macro]')];
        return rows.every((r, i) => tone(pills[i]).indexOf(r.dataset.state) >= 0);
      }),
      await ph.evaluate(() => [...document.querySelectorAll('.mbrow[data-macro]')]
        .map((r, i) => r.dataset.state + '/' +
          (((document.querySelectorAll('.mpill')[i].getAttribute('style') || '')
            .match(/--[\w-]+-pale/) || [''])[0])).join(' | ')));
    const stickH = await ph.evaluate(() => document.querySelector('.mday-stick').getBoundingClientRect().height);
    /* The fold is a scroll effect and nothing else: the page must be exactly
       as tall after it as before, and the plates must stay where they were.
       The first version took the hidden bars' height out of the flow, so
       every plate jumped up ~140px in one frame — the "flash" Blake saw
       right before the collapse. */
    const pageBefore = await ph.evaluate(() => document.documentElement.scrollHeight);
    const railAtTop = await ph.evaluate(() => document.querySelector('.mday-rail').getBoundingClientRect().top);
    const foldAt = Math.ceil(stickH) + 100;
    // where the rail lands if the scroll moves it and nothing else does
    const railBefore = railAtTop - foldAt;
    await ph.evaluate((y) => window.scrollTo(0, y), foldAt);
    await ph.waitForTimeout(250);
    t.ok('scrolling into the day folds the readout to one row of pills',
      await ph.evaluate(() => {
        const st = document.querySelector('.mday-stick');
        return st.classList.contains('shrunk') &&
          getComputedStyle(document.querySelector('.mpills')).opacity === '1' &&
          getComputedStyle(document.querySelector('.mbars')).opacity === '0' &&
          getComputedStyle(document.querySelector('.mweek')).visibility === 'hidden';
      }), await ph.evaluate(() => document.querySelector('.mday-stick').className + ' y=' + window.scrollY));
    const shrunkH = await ph.evaluate(() => document.querySelector('.mday-stick').getBoundingClientRect().height);
    t.ok('and the folded readout is well under half the height of the open one',
      shrunkH < stickH / 2, 'open ' + Math.round(stickH) + 'px, folded ' + Math.round(shrunkH) + 'px');
    t.ok('folding moves nothing: same scroll position, same page height, plates where they were',
      await ph.evaluate((args) => {
        const rail = document.querySelector('.mday-rail').getBoundingClientRect().top;
        return window.scrollY === args.y &&
          document.documentElement.scrollHeight === args.page &&
          Math.abs(rail - args.rail) < 1;
      }, { y: foldAt, page: pageBefore, rail: railBefore }),
      await ph.evaluate((args) => 'y=' + window.scrollY + '/' + args.y + ' page=' +
        document.documentElement.scrollHeight + '/' + args.page + ' rail=' +
        Math.round(document.querySelector('.mday-rail').getBoundingClientRect().top) + '/' + Math.round(args.rail),
      { y: foldAt, page: pageBefore, rail: railBefore }));
    t.ok('the fold still fits on one line — pills never wrap',
      await ph.evaluate(() => {
        const tops = [...document.querySelectorAll('.mpill')].map((x) => Math.round(x.getBoundingClientRect().top));
        return new Set(tops).size === 1;
      }));
    /* The row may scroll sideways as a last resort, but a clipped sixth pill
       reads as a bug, so on the narrowest phone in the house (375) the six
       must fit edge to edge on a wide day — Blake's own example figures, which
       are about as long as the six numbers get. */
    t.ok('and all six fit a 375-wide phone even on a day of three-digit deltas',
      await ph.evaluate(() => {
        const row = document.querySelector('.mpills');
        const vals = ['+159', '-24', '+12', '+37', '8', '1474'];
        row.querySelectorAll('.mpill b').forEach((el, i) => { el.textContent = vals[i]; });
        // the six pills end to end, against what the row would have on a
        // phone 15px narrower than this one
        const ps = row.querySelectorAll('.mpill');
        const span = ps[ps.length - 1].getBoundingClientRect().right - ps[0].getBoundingClientRect().left;
        return span <= row.clientWidth - (390 - 375);
      }), await ph.evaluate(() => {
        const ps = document.querySelectorAll('.mpill');
        const span = ps[ps.length - 1].getBoundingClientRect().right - ps[0].getBoundingClientRect().left;
        return 'pills ' + Math.round(span) + 'px of ' + (document.querySelector('.mpills').clientWidth - 15) + 'px';
      }));
    /* Half-way down, the card is half shut: both halves of the readout on
       screen at once, one fading out as the other fades in. This is the
       whole point of the change — the old fold had no state between open
       and shut, so there was nothing here to see. */
    const half = await ph.evaluate((args) => {
      window.scrollTo(0, args.span / 2);
      return new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => {
        const st = document.querySelector('.mday-stick');
        ok({
          p: parseFloat(st.style.getPropertyValue('--fold') || 0),
          card: st.getBoundingClientRect().height,
          bars: parseFloat(getComputedStyle(document.querySelector('.mbars')).opacity),
          pills: parseFloat(getComputedStyle(document.querySelector('.mpills')).opacity),
          shrunk: st.classList.contains('shrunk')
        });
      })));
    }, { span: await ph.evaluate(() => {
      const f = document.getElementById('macroFold');
      return f.scrollHeight - document.getElementById('macroPills').offsetHeight;
    }) });
    t.ok('half-way down the card is half shut, with both readouts on screen',
      half.p > 0.3 && half.p < 0.7 && !half.shrunk &&
        half.bars > 0.2 && half.bars < 0.8 && half.pills > 0.2 && half.pills < 0.8 &&
        half.card > shrunkH && half.card < stickH,
      JSON.stringify({ p: +half.p.toFixed(2), card: Math.round(half.card),
        bars: +half.bars.toFixed(2), pills: +half.pills.toFixed(2) }));
    /* No threshold means no hysteresis to get wrong: a scroll position gives
       the same card whichever direction you reached it from. The old fold
       needed two lines precisely because this was not true of it. */
    const fromAbove = await ph.evaluate((y) => {
      window.scrollTo(0, 900);
      return new Promise((ok) => setTimeout(() => {
        window.scrollTo(0, y);
        requestAnimationFrame(() => requestAnimationFrame(() =>
          ok(document.querySelector('.mday-stick').getBoundingClientRect().height)));
      }, 120));
    }, Math.round(await ph.evaluate(() => {
      const f = document.getElementById('macroFold');
      return (f.scrollHeight - document.getElementById('macroPills').offsetHeight) / 2;
    })));
    t.ok('and the same scroll position gives the same card from either direction',
      Math.abs(fromAbove - half.card) < 1,
      'coming down ' + Math.round(half.card) + 'px, coming back up ' + Math.round(fromAbove) + 'px');
    /* The failure mode of a fold that runs every frame is not a flash, it is
       a creep: if the margin gives back a pixel less than the card takes out,
       the page shortens a little on every frame and the plates crawl under
       the finger. Watch every frame of a slow scroll, not just the ends. */
    await ph.evaluate(() => window.scrollTo(0, 0));
    await ph.waitForTimeout(250);
    await ph.evaluate(() => {
      const rail = document.querySelector('.mday-rail');
      const railPage = () => rail.getBoundingClientRect().top + (window.scrollY || 0);
      window.__w = { page: document.documentElement.scrollHeight, rail: railPage(), worst: 0, stop: false };
      const tick = () => {
        if (window.__w.stop) return;
        window.__w.worst = Math.max(window.__w.worst,
          Math.abs(document.documentElement.scrollHeight - window.__w.page),
          Math.abs(railPage() - window.__w.rail));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await ph.mouse.move(200, 500);
    for (let i = 0; i < 14; i++) { await ph.mouse.wheel(0, 20); await ph.waitForTimeout(35); }
    await ph.waitForTimeout(200);
    const window_innerHeightGuess = 720;   // the viewport this page was opened at
    const creep = await ph.evaluate(() => { window.__w.stop = true; return window.__w.worst; });
    t.ok('and no frame of the fold moves the page or the plates by so much as a pixel',
      creep < 1, 'worst drift seen mid-fold: ' + creep.toFixed(1) + 'px');

    /* A phone resizes while you scroll — iOS collapses the URL bar and the
       viewport loses forty pixels mid-gesture, over and over. That used to
       re-measure the room under the card, and the card is position:sticky:
       once the page has scrolled it is pinned to the top of the screen and
       nowhere near its place in the flow, so "the distance down to the next
       card" stopped being a margin and became most of the page. Each wrong
       reading went into a margin that made the next one wronger — twelve
       pixels became two thousand in two resizes, and My Day turned into
       blank paper below the plates. */
    await ph.evaluate(() => window.scrollTo(0, 260));
    await ph.waitForTimeout(250);
    const beforeR = await ph.evaluate(() => ({
      page: document.documentElement.scrollHeight,
      margin: parseFloat(document.querySelector('.mday-stick').style.marginBottom) || 0
    }));
    for (let i = 0; i < 3; i++) {
      await ph.setViewportSize({ width: 390, height: 680 });
      await ph.waitForTimeout(180);
      await ph.setViewportSize({ width: 390, height: 720 });
      await ph.waitForTimeout(180);
    }
    const afterR = await ph.evaluate(() => {
      const st = document.querySelector('.mday-stick');
      const r = st.getBoundingClientRect();
      return {
        page: document.documentElement.scrollHeight,
        margin: parseFloat(st.style.marginBottom) || 0,
        cardOnScreen: r.bottom > 0 && r.top < window.innerHeight,
        platesOnScreen: [...document.querySelectorAll('.mitem')]
          .filter((e) => { const q = e.getBoundingClientRect(); return q.bottom > 0 && q.top < window.innerHeight; }).length
      };
    });
    t.ok('resizing while scrolled — a phone hiding its URL bar — leaves the page where it was',
      afterR.page === beforeR.page && Math.abs(afterR.margin - beforeR.margin) < 1,
      'page ' + beforeR.page + ' → ' + afterR.page +
      ', margin ' + Math.round(beforeR.margin) + ' → ' + Math.round(afterR.margin));
    t.ok('and the day is still on the screen rather than above a field of margin',
      afterR.cardOnScreen && afterR.platesOnScreen > 0,
      'card on screen: ' + afterR.cardOnScreen + ', plates on screen: ' + afterR.platesOnScreen);
    /* The room under the card is two margins in the stylesheet, and a margin
       is small. Anything else means it has been measured off the page again. */
    t.ok('and the room the fold hands back is still the size of a margin',
      afterR.margin > 0 && afterR.margin < 400, afterR.margin + 'px');

    /* Twice now My Day has gone blank on a phone, and both times it looked
       identical from the outside: the day scrolled off the top of a screenful
       of empty paper. Both times the cause was a number that had no business
       being believed going into the card's bottom margin.
     *
       So this stops testing the causes and tests the consequence. Make the
       fold measure something absurd — a card three thousand pixels tall,
       which is what a bad reading looks like — and the fold must decline to
       fold at all rather than hand back three thousand pixels of margin. One
       frame unfolded is the price; the tab is what the alternative costs. */
    await ph.evaluate(() => {
      const st = document.createElement('style');
      st.id = 'absurd';
      st.textContent = '#macroFold { min-height: 3000px; }';
      document.head.appendChild(st);
    });
    await ph.evaluate(() => window.scrollTo(0, 0));
    await ph.waitForTimeout(250);
    const sane = await ph.evaluate(() => document.documentElement.scrollHeight);
    /* The card is measured once and remembered, so the absurd size has to be
       forced into a fresh reading — a resize is what throws the old one away,
       and a resize is also exactly when a phone takes a bad one. */
    await ph.evaluate(() => window.dispatchEvent(new Event('resize')));
    await ph.waitForTimeout(200);
    await ph.evaluate(() => window.scrollTo(0, 500));
    await ph.waitForTimeout(350);
    const absurd = await ph.evaluate(() => {
      const st = document.querySelector('.mday-stick');
      const items = [...document.querySelectorAll('.mitem, .mthin')];
      return {
        margin: parseFloat(st.style.marginBottom) || 0,
        page: document.documentElement.scrollHeight,
        onScreen: items.filter((e) => {
          const r = e.getBoundingClientRect();
          return r.bottom > 0 && r.top < window.innerHeight;
        }).length
      };
    });
    t.ok('a fold that measures something absurd refuses to fold at all',
      absurd.margin <= window_innerHeightGuess,
      'margin ' + absurd.margin + 'px');
    t.ok('and the day is still on the screen, which is the whole point',
      absurd.onScreen > 0 || absurd.page <= sane + 3200,
      'plates on screen ' + absurd.onScreen + ', page ' + sane + ' → ' + absurd.page);
    await ph.evaluate(() => {
      const st = document.getElementById('absurd');
      if (st) st.remove();
    });
    await ph.evaluate(() => window.scrollTo(0, 0));
    await ph.waitForTimeout(300);

    await ph.evaluate(() => window.scrollTo(0, 0));
    await ph.waitForTimeout(250);
    t.ok('back at the top the readout opens again',
      await ph.evaluate(() => !document.querySelector('.mday-stick').classList.contains('shrunk')));
    t.ok('and opening hands the room back — page height and rail exactly as at the start',
      await ph.evaluate((args) =>
        document.documentElement.scrollHeight === args.page &&
        Math.abs(document.querySelector('.mday-rail').getBoundingClientRect().top - args.rail) < 1 &&
        document.querySelector('.mday-stick').style.marginBottom === '',
      { page: pageBefore, rail: railAtTop }),
      await ph.evaluate(() => 'page=' + document.documentElement.scrollHeight + ' rail=' +
        Math.round(document.querySelector('.mday-rail').getBoundingClientRect().top) +
        ' margin="' + document.querySelector('.mday-stick').style.marginBottom + '"'));
    /* A slow thumb through the fold, ten pixels a frame, the way it is
       actually met on a phone. One toggle each way, and between any two
       frames the plates move by the scroll step and nothing more. */
    const thumb = await ph.evaluate(() => {
      const st = document.querySelector('.mday-stick');
      window.__toggles = 0;
      new MutationObserver(() => { window.__toggles++; })
        .observe(st, { attributes: true, attributeFilter: ['class'] });
      return st.getBoundingClientRect().height;
    });
    const steps = Math.ceil(thumb / 10) + 12;
    const jumps = [];
    let last = await ph.evaluate(() => document.querySelector('.mday-rail').getBoundingClientRect().top);
    for (let i = 0; i < steps; i++) {
      await ph.mouse.wheel(0, 10);
      await ph.waitForTimeout(40);
      const now = await ph.evaluate(() => document.querySelector('.mday-rail').getBoundingClientRect().top);
      jumps.push(Math.round(last - now));
      last = now;
    }
    const downToggles = await ph.evaluate(() => window.__toggles);
    t.ok('a slow thumb down through the fold folds it once',
      downToggles === 1 && await ph.evaluate(() => document.querySelector('.mday-stick').classList.contains('shrunk')),
      'toggles=' + downToggles + ' y=' + await ph.evaluate(() => window.scrollY));
    t.ok('and no frame on the way moved the plates by more than the thumb did',
      jumps.every((j) => j >= 0 && j <= 12), 'per-step rail moves: ' + jumps.join(' '));
    for (let i = 0; i < steps; i++) {
      await ph.mouse.wheel(0, -10);
      await ph.waitForTimeout(40);
      const now = await ph.evaluate(() => document.querySelector('.mday-rail').getBoundingClientRect().top);
      jumps.push(Math.round(now - last));
      last = now;
    }
    const upToggles = await ph.evaluate(() => window.__toggles);
    t.ok('and back up opens it once, again without a jump',
      upToggles === 2 && jumps.every((j) => j >= 0 && j <= 12) &&
        await ph.evaluate(() => !document.querySelector('.mday-stick').classList.contains('shrunk')),
      'toggles=' + upToggles + ' y=' + await ph.evaluate(() => window.scrollY) + ' moves: ' + jumps.join(' '));
    await ph.evaluate(() => window.scrollTo(0, 0));
    await ph.waitForTimeout(250);
    await ph.evaluate((y) => window.scrollTo(0, y), foldAt);
    await ph.waitForTimeout(250);
    /* The pills answer a tap only when the card is all the way shut — while
       the bars are still on screen they are the thing under the finger. */
    t.ok('the folded pills are what takes the tap, not the bars behind them',
      await ph.evaluate(() => getComputedStyle(document.querySelector('.mpills')).pointerEvents === 'auto' &&
        document.elementFromPoint(60, document.querySelector('.mpills').getBoundingClientRect().top + 10)
          .closest('[data-mpills]') !== null));
    await ph.click('.mpills');
    /* It glides back rather than jumping, so this waits for the scroll to
       arrive instead of assuming it already has. */
    await ph.waitForFunction(() => window.scrollY === 0, null, { timeout: 3000 });
    await ph.waitForTimeout(150);
    t.ok('pressing the pills takes you back to the top, where the readout is open',
      await ph.evaluate(() => window.scrollY === 0 &&
        !document.querySelector('.mday-stick').classList.contains('shrunk')),
      await ph.evaluate(() => 'y=' + window.scrollY + ' ' + document.querySelector('.mday-stick').className));
    /* Leaving the tab must not carry the fold to the next one, and the fold
       waits until the whole open readout has scrolled by — earlier, and the
       pills would sit over a band of nothing the bars had not yet covered. */
    await ph.click('.tab[data-view="browse"]');
    await ph.waitForTimeout(200);
    await ph.evaluate(() => window.scrollTo(0, 320));
    await ph.waitForTimeout(250);
    await ph.click('.tab[data-view="macros"]');
    await ph.waitForTimeout(250);
    await ph.evaluate(() => window.scrollTo(0, 0));
    await ph.waitForTimeout(250);
    t.ok('coming back to My Day at the top finds the readout open',
      await ph.evaluate(() => !document.querySelector('.mday-stick').classList.contains('shrunk')));
    await ph.context().close();

    /* Someone who has asked for less motion gets the switch back rather than
       the glide: the card is open or it is shut, with the two thresholds
       that keep an instant fold from chasing itself. */
    const still = await t.fresh({ viewport: { width: 390, height: 720 }, reducedMotion: 'reduce' });
    await still.click('.tab[data-view="macros"]');
    await still.waitForTimeout(200);
    const stillSpan = await still.evaluate(() => {
      const f = document.getElementById('macroFold');
      return f.scrollHeight - document.getElementById('macroPills').offsetHeight;
    });
    await still.evaluate((y) => window.scrollTo(0, y), Math.round(stillSpan / 2));
    await still.waitForTimeout(250);
    t.ok('asking for less motion trades the glide for the old switch — no half-shut card',
      await still.evaluate(() => {
        const st = document.querySelector('.mday-stick');
        const p = parseFloat(st.style.getPropertyValue('--fold') || 0);
        return p === 0 || p === 1;
      }), await still.evaluate(() => 'fold=' + (document.querySelector('.mday-stick').style.getPropertyValue('--fold') || '0')));
    await still.context().close();

    const wide = await t.fresh();
    await wide.click('.tab[data-view="macros"]');
    await wide.waitForTimeout(200);
    /* The fold runs over exactly the height it takes out of the card, which
       is what keeps the first plate glued to the underside of it the whole
       way down instead of sliding out from behind it. */
    const wideSpan = await wide.evaluate(() => {
      const f = document.getElementById('macroFold');
      return f.scrollHeight - document.getElementById('macroPills').offsetHeight;
    });
    await wide.evaluate(() => window.scrollTo(0, 500));
    await wide.waitForTimeout(250);
    t.ok('a day is fully folded once it has given up its own height to the scroll',
      await wide.evaluate((span) =>
        document.querySelector('.mday-stick').classList.contains('shrunk') === (window.scrollY >= span),
      wideSpan),
      await wide.evaluate((span) => 'y=' + window.scrollY + ' span=' + Math.round(span) + ' ' +
        document.querySelector('.mday-stick').className, wideSpan));
    await wide.context().close();
  },
};
