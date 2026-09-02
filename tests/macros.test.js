/* The Macros tab: targets, the day, the picker, and the arithmetic between
 * them. Everything is asserted against window.RECIPES and the numbers the
 * page actually shows, never against counts or macros written down here —
 * the data is rebuilt too often for a copied answer to stay true. */

module.exports = {
  name: 'Macros',
  async run(t) {
    const p = await t.fresh();

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
          .join() === 'plan,meals,you,help'));
    await p.click('.mday-rail');
    await p.waitForTimeout(80);
    t.ok('and a press anywhere else closes it',
      await p.evaluate(() => document.getElementById('macroMenu').classList.contains('hide')));

    // the tab explains itself by working, not by a paragraph about itself
    t.ok('no explainer paragraph rides along',
      await p.evaluate(() => !document.getElementById('macroNote') &&
        !document.getElementById('mdayTune')));

    // ---- default targets, and the calories derived from them, not stored
    const defP = 180, defF = 50, defC = 50;
    const defKcal = 4 * defP + 4 * defC + 9 * defF;
    /* Meals arrive folded now, so anything reaching for a plate's own
       controls has to open the day first. Each press redraws, so they are
       opened one at a time. */
    const openDay = async (pg) => {
      for (let i = 0; i < 8; i++) {
        const did = await pg.evaluate(() => {
          const b = document.querySelector('#macroSlots [data-mfold][aria-expanded="false"]');
          if (!b) return false;
          b.click();
          return true;
        });
        if (!did) break;
        await pg.waitForTimeout(120);
      }
    };
    const foot = () => p.textContent('#macroFoot');
    t.ok('default targets are 180P / 50F / 50C',
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
    t.ok('fibre and sodium sit under the bars as a floor and a ceiling',
      await p.evaluate(() => {
        const m = [...document.querySelectorAll('.mdelta .mm')];
        return m.length === 2 && m.every((x) => /\d+\/[\d,]+/.test(x.textContent.replace(/\s/g, '')));
      }), await p.textContent('.mdelta'));

    /* Carb cycling. RP does not eat the same thing seven days a week: a
       training day earns more carbohydrate and a rest day gives it back, so
       the WEEK averages to the plan while the days differ. Derived from the
       workouts box, overridden by tapping a day. */
    t.ok('with no workouts named, every day asks for the same thing',
      await p.evaluate(() => {
        const k = [...document.querySelectorAll('.mwk-k')].map((e) => e.textContent);
        return k.length === 7 && new Set(k).size === 1;
      }), await p.textContent('.mweek'));
    await p.click('#macroTargBtn');
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
    await p.click('#macroTargBtn');
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
       plan yet, that same line is the invitation. */
    t.ok('with no plan, the line asks for one',
      /No plan yet/.test(await p.textContent('#macroPlan')) &&
      /Craft my plan/.test(await p.textContent('#macroPlan')),
      await p.textContent('#macroPlan'));

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
    await p.click('#macroTargBtn');
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
        const pr = JSON.parse(localStorage.getItem('bsc.macroProfile'));
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
    await p.click('[data-mpmode="recipes"]');
    await p.waitForTimeout(250);
    await p.selectOption('#mpSec', 'foods');
    await p.waitForTimeout(250);
    t.ok('the plain foods have a lens of their own',
      await p.evaluate(() => {
        const rows = [...document.querySelectorAll('.mpick-row[data-mpick]')];
        return rows.length >= 20 && rows.every((r) => r.dataset.mpick.indexOf('f:') === 0);
      }), await p.evaluate(() => document.querySelectorAll('.mpick-row').length + ' rows'));
    t.ok('and each is offered in a unit a person would use',
      await p.evaluate(() => {
        const rows = [...document.querySelectorAll('.mpick-row[data-mpick]')];
        const txt = rows.map((r) => r.textContent).join(' ');
        // a cup of milk and a spoon of honey, not a spoon of milk or a cup of butter
        return /cup|tbsp|each|oz|can/.test(txt);
      }));
    await p.selectOption('#mpSec', 'meal');
    await p.fill('#mpSearch', 'honey');
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
    await p.click('[data-mpmode="recipes"]');
    await p.waitForTimeout(250);
    t.ok('picking does not close the sheet, it fills a basket',
      await p.evaluate(async () => {
        const rows = [...document.querySelectorAll('.mpick-row[data-mpick]')];
        rows[0].click();
        await new Promise((r) => setTimeout(r, 120));
        return !!document.querySelector('.sheet') &&
          document.querySelectorAll('.mpick-wrap.in').length === 1 &&
          !!document.querySelector('[data-mpdone]');
      }));
    // each pick redraws the list, so every press has to find its row afresh
    t.ok('and several go in before anything is committed',
      await p.evaluate(async () => {
        const tap = async (n) => {
          document.querySelectorAll('.mpick-row[data-mpick]')[n].click();
          await new Promise((r) => setTimeout(r, 120));
        };
        await tap(2);
        await tap(4);
        return document.querySelectorAll('.mpick-wrap.in').length === 3 &&
          /3/.test(document.querySelector('[data-mpdone]').textContent);
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
    t.ok('a second press takes it back out',
      await p.evaluate(async () => {
        document.querySelectorAll('.mpick-row[data-mpick]')[2].click();
        await new Promise((r) => setTimeout(r, 120));
        return document.querySelectorAll('.mpick-wrap.in').length === 2;
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
      await p.evaluate(() => document.querySelectorAll('.mpick-wrap.in').length === 2 &&
        /2/.test((document.querySelector('[data-mpdone]') || {}).textContent || '')));

    const basketWas = await p.evaluate(() =>
      [...document.querySelectorAll('.mpick-wrap.in .mpick-row')].map((r) => r.dataset.mpick));
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
    t.ok('a meal folds and unfolds by its name, and today starts open',
      await p.evaluate(async () => {
        const of = () => [...document.querySelectorAll('#macroSlots [data-mfold]')]
          .find((b) => b.textContent === 'Snacks');
        if (!of() || of().getAttribute('aria-expanded') !== 'true') return false;
        of().click();
        await new Promise((r) => setTimeout(r, 150));
        const shut = of().getAttribute('aria-expanded') === 'false' &&
          !!document.querySelector('.mslot-thin .mthin-n');
        of().click();
        await new Promise((r) => setTimeout(r, 150));
        return shut && of().getAttribute('aria-expanded') === 'true' &&
          !document.querySelector('.mslot-thin');
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
    await p.click('[data-mpmode="recipes"]');
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
    await p.click('[data-mpmode="look"]');
    await p.waitForTimeout(200);
    t.ok('Look up is one box, not a mode inside a mode',
      await p.evaluate(() => !!document.querySelector('#mpLookIn') &&
        document.querySelectorAll('[data-mpmode]').length === 3));
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
    await p.click('#macroTargBtn');
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
    await p.click('#macroTargBtn');
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
    await p.click('[data-mpmode="recipes"]');
    await p.waitForTimeout(200);
    t.ok('the picker sheet opens on the meal', !!(await p.$('#mpList')));
    const sanity = await p.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.mpick-row[data-mpx]'));
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
        .every((row) => {
          const rec = window.RECIPES.find((x) => String(x.id) === row.dataset.mpick);
          return rec.score === null || !!row.querySelector('.leaf');
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
    await p.click('[data-mpmode="recipes"]');
    await p.waitForTimeout(200);
    const picked = await p.evaluate(() => {
      const r = document.querySelector('.mpick-row[data-mpx]');
      return { id: r.dataset.mpick, x: Number(r.dataset.mpx) };
    });
    await p.click('.mpick-row[data-mpx]');
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
    await p.click('#macroTargBtn');
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
    t.ok('every bar names where it stands',
      await p.evaluate(() => Array.from(document.querySelectorAll('.mbrow'))
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
      await p.evaluate(() => Array.from(document.querySelectorAll('.mbrow'))
        .every((d) => Number(d.dataset.planned) <= 100 && Number(d.dataset.eaten) <= 100)));
    await p.click('#macroTargBtn');
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
    await p.click('[data-mpmode="recipes"]');
    await p.waitForTimeout(200);
    await p.selectOption('#mpSec', 'all');
    await p.waitForTimeout(150);
    await p.fill('#mpSearch', estName);
    await p.waitForTimeout(200);
    await p.click('.mpick-row[data-mpick]');
    await p.click('[data-mpdone]');
    await p.waitForTimeout(300);
    t.ok('an estimated recipe carries the tilde on its line',
      await p.evaluate(() => Array.from(document.querySelectorAll('.mitem-mac'))
        .some((el) => el.textContent.indexOf('~') === 0)));
    // the tilde carries it on the plate itself; the footnote under the day was
    // one more line of the app talking about itself
    t.ok('and says so on the plate rather than in a footnote',
      await p.evaluate(() => !document.querySelector('.macro-est')));
    t.ok('while the authored recipe shows none',
      await p.evaluate(() => {
        const first = document.querySelector('[data-meat="b:0"]');
        if (!first) return true; // breakfast pick happened to be estimated too — nothing to assert
        const r = window.RECIPES.find((x) => String(x.id) ===
          String(JSON.parse(localStorage.getItem('bsc.macroDays'))[Object.keys(JSON.parse(localStorage.getItem('bsc.macroDays')))[0]].b[0].id));
        const line = first.closest('.mitem').querySelector('.mitem-mac').textContent;
        return r.est ? line.indexOf('~') === 0 : line.indexOf('~') < 0;
      }));

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
          kcalShown: parseInt(row.querySelector('.mitem-mac').textContent.replace(/[^\d]/, ''), 10),
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
      portions.every((q) => Math.abs(q.kcalShown - q.kcalWant) <= 1),
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

    await q.click('#macroTargBtn');
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
    await q.click('#macroTargBtn');
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
    await q.click('#macroTargBtn');
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
    const narr = () => q.textContent('#macroPlan');
    t.ok('the line names the destination and the distance',
      /185 lb by/.test(await narr()) && /lb to go over 10 weeks/.test(await narr()), await narr());
    t.ok('and asks for mornings before it judges the pace',
      /two weeks of mornings|Two weeks of mornings/i.test(await narr()), await narr());
    t.ok('with Adjust as the way back in, not a standing button',
      await q.evaluate(() => {
        const b2 = document.querySelector('#macroPlan #macroTargBtn');
        return b2 && b2.textContent.trim() === 'Adjust' &&
          !document.querySelector('.mday-head #macroTargBtn');
      }));

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

    t.ok('once there are mornings, the scale gets an opinion',
      /Averaging /.test(await narr()) && /Needs /.test(await narr()), await narr());
    t.ok('and it is behind pace, because a pound a week is not two',
      /behind pace/.test(await narr()), await narr());

    // ---- a favorite never ranks worse for being loved, and wears its star
    await q.click('[data-mslot="b"]');
    await q.click('[data-mpmode="recipes"]');
    await q.waitForTimeout(200);
    const mid = await q.evaluate(() => {
      const rows = [...document.querySelectorAll('.mpick-row[data-mpx]')];
      return { id: rows[Math.min(7, rows.length - 1)].dataset.mpick,
        at: Math.min(7, rows.length - 1) };
    });
    await q.goBack();
    await q.waitForTimeout(250);
    await q.evaluate((id) => {
      const r = window.RECIPES.find((x) => String(x.id) === id);
      window.Store.toggleFav(r.id);
    }, mid.id);
    await q.waitForTimeout(200);
    await q.click('[data-mslot="b"]');
    await q.click('[data-mpmode="recipes"]');
    await q.waitForTimeout(200);
    const after = await q.evaluate((id) => {
      const rows = [...document.querySelectorAll('.mpick-row[data-mpx]')];
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
    /* Every meal the day still had room for. Fill stops once the remaining
       budget is under a hundred calories, so on a tight plan the last meal
       can honestly come back empty. */
    t.ok('every meal the day had room for gets something',
      drafted.perSlot.filter((n) => n >= 1).length >= 3, drafted.perSlot.join(','));
    t.ok('and never the same recipe twice in a day', drafted.unique);
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
    await bar.click('[data-mpmode="look"]');
    await bar.waitForTimeout(200);
    /* Typing a food's name has to show that food. Dozens of recipes list
       honey among their ingredients and every one of them fills a dinner
       better than a spoonful does, so ranked on fit alone the row the search
       was for sinks below a twelve-row box. The word you typed is the whole
       of the question. */
    await bar.fill('#mpLookIn', 'honey');
    await bar.waitForTimeout(400);
    t.ok('searching a food by name puts the food itself on top',
      await bar.evaluate(() => {
        const rows = [...document.querySelectorAll('.mpick-row[data-mpick]')];
        return rows.length > 0 && rows[0].dataset.mpick.indexOf('f:') === 0;
      }));

    for (const q of ['chicken breast', 'honey', 'peanut']) {
      await bar.fill('#mpLookIn', q);
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
    const gapOf = () => bar.evaluate(() => {
      const c = [...document.querySelectorAll('.mslot')].find((x) => x.querySelector('[data-mbal="d"]'));
      const m = c.querySelector('.mslot-v').textContent.match(/(\d+)\s+(over|short)/);
      return m ? Number(m[1]) : 0;
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
        for (let i = cfg.n - 1; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          let w = 204 - cfg.rate * (cfg.n - 1 - i) + jitter[i % 10] * 0.9;
          if (cfg.saltToday && i === 0) w += 2.6;
          ws[key(d)] = Math.round(w * 10) / 10;
          const x = Math.round((1700 / r.macro.kcal) * 8) / 8;
          days[key(d)] = { b: [{ id: r.id, x: (cfg.saltToday && i === 1) ? x * 3 : x, eaten: 1 }] };
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
        const pr = JSON.parse(localStorage.getItem('bsc.macroProfile'));
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

    const early = await lineFor({ n: 9, rate: 1.5 / 7 });
    t.ok('with too few mornings it says what it is waiting for',
      await early.evaluate(() => {
        const el = document.querySelector('.mline');
        return !!el && el.classList.contains('wait') && /more mornings/.test(el.textContent);
      }), await early.textContent('.mline'));
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

    await m.click('#macroTargBtn');
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

    await m.click('#macroTargBtn');
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
      await m.click('[data-mpmode="recipes"]');
      await m.waitForTimeout(250);
      await m.click('.mpick-row[data-mpx]');
      await m.click('[data-mpdone]');
      await m.waitForTimeout(300);
    }

    /* The portion ports into the recipe: the sheet opens at the batch that
       makes the plate — x over servN, snapped to the eighths it prints in. */
    const port = await m.evaluate(() => {
      const b = document.querySelector('.mitem-name');
      const r = window.RECIPES.find((x) => String(x.id) === b.dataset.open);
      return { x: Number(b.dataset.mx), servN: r.servN || 1 };
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
    await m.click('#macroTargBtn');
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
    await z.click('[data-mpmode="recipes"]');
    await z.waitForTimeout(200);
    await z.selectOption('#mpSort', 'protein');
    await z.waitForTimeout(150);
    t.ok('sorting by protein puts the most protein first',
      await z.evaluate(() => {
        const rows = [...document.querySelectorAll('.mpick-row[data-mpx]')];
        const pOf = (r) => window.RECIPES.find((x) => String(x.id) === r.dataset.mpick).macro.p;
        return rows.length > 2 && rows.every((r, i) => i === 0 || pOf(rows[i - 1]) >= pOf(r));
      }));
    await z.selectOption('#mpSort', 'healthy');
    await z.waitForTimeout(150);
    t.ok('and by health score, healthiest first',
      await z.evaluate(() => {
        const rows = [...document.querySelectorAll('.mpick-row[data-mpx]')];
        const sOf = (r) => window.RECIPES.find((x) => String(x.id) === r.dataset.mpick).score;
        return rows.length > 2 && rows.every((r, i) => i === 0 || sOf(rows[i - 1]) >= sOf(r));
      }));

    // the section lens speaks the browse tab's vocabulary
    await z.selectOption('#mpSec', '2-4');
    await z.waitForTimeout(150);
    t.ok('a single section can be looked at on its own',
      await z.evaluate(() => {
        const rows = [...document.querySelectorAll('.mpick-row[data-mpick]')];
        return rows.length && rows.every((r) => {
          const rec = window.RECIPES.find((x) => String(x.id) === r.dataset.mpick);
          return rec.book === 2 && rec.secNum === 4;
        });
      }));
    await z.selectOption('#mpSec', 'meal');
    await z.waitForTimeout(150);

    // one plate on the day, shrunk by hand, put right by the button
    await z.click('.mpick-row[data-mpx]');
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
    t.ok('and only ever offering what the meal draws from',
      await z.evaluate(() => {
        const r = window.RECIPES.find((x) =>
          String(x.id) === document.querySelector('.mitem-name').dataset.open);
        return r.book === 1 && r.secNum === 1;      // breakfast's own sections
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
    await z.click('#macroTargBtn');
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
    await z.click('[data-mpmode="recipes"]');
    await z.waitForTimeout(200);
    t.ok('the meal now draws from exactly the section it ticked',
      await z.evaluate(() => {
        const rows = [...document.querySelectorAll('.mpick-row[data-mpick]')];
        return rows.length && rows.every((r) => {
          const rec = window.RECIPES.find((x) => String(x.id) === r.dataset.mpick);
          return rec.book === 1 && rec.secNum === 6;
        });
      }));

    /* Shares: a meal weighted heavier asks for more of the same dish. */
    const w20 = await z.evaluate(() => {
      const r = document.querySelector('.mpick-row[data-mpx]');
      return { id: r.dataset.mpick, x: Number(r.dataset.mpx) };
    });
    await z.goBack();
    await z.waitForTimeout(250);
    await z.click('#macroTargBtn');
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
    await z.click('[data-mpmode="recipes"]');
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
    await y.click('#macroTargBtn');
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
    await y.click('#macroTargBtn');
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
    await y.click('[data-mpmode="recipes"]');
    await y.waitForTimeout(200);
    await y.click('.mpick-row[data-mpx]');
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
    await y.click('[data-mpmode="recipes"]');
    await y.waitForTimeout(200);
    t.ok('the picker offers the family’s plan when there is one',
      await y.evaluate(() => {
        const o = [...document.querySelectorAll('#mpSec option')].find((x) => x.value === 'family');
        return !!o && /plan \(2\)/.test(o.textContent);
      }));
    await y.selectOption('#mpSec', 'family');
    await y.waitForTimeout(200);
    t.ok('and choosing it shows exactly what the family is having, fit-portioned',
      await y.evaluate((ids) => {
        const rows = [...document.querySelectorAll('.mpick-row[data-mpx]')];
        return rows.length === 2 && rows.every((r) => ids.indexOf(r.dataset.mpick) >= 0);
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
    await a2.click('#syncBtn');
    await a2.waitForTimeout(300);
    t.ok('Google is the way in, said once and not argued for',
      await a2.evaluate(() => {
        const b = document.querySelector('[data-mysync="google"]');
        return !!b && /Sign in with Google/.test(b.textContent) &&
          document.querySelectorAll('.sheet .sync-p').length <= 2;
      }));
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
      await a2.evaluate(() => {
        const outside = performance.getEntriesByType('resource')
          .filter((e) => e.name.indexOf(location.origin) !== 0);
        return outside.length === 0 && localStorage.getItem('bsc.myAccount') === null;
      }), await a2.evaluate(() => performance.getEntriesByType('resource')
        .filter((e) => e.name.indexOf(location.origin) !== 0).map((e) => e.name).join(' ')));
    t.ok('and personal keys still never enter the household document',
      await a2.evaluate(() => JSON.stringify(Object.keys(window.Store.state))
        .indexOf('macro') < 0));

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
    await a2.click('[data-mpmode="recipes"]');
    await a2.waitForTimeout(300);
    t.ok('and opening the picker runs nothing',
      await a2.evaluate(() => !window.__pwned && !document.querySelector('img[src="x"]')));
    await a2.goBack();
    await a2.waitForTimeout(250);
    await a2.click('#macroTargBtn');
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
    await wk.click('#macroTargBtn');
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
      const serve = (f) => {
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
    await fold.click('#macroTargBtn');
    await fold.waitForTimeout(200);
    await fold.click('[data-mtarg="save"]');
    await fold.waitForTimeout(250);
    await fold.click('#macroFill');
    await fold.waitForTimeout(600);
    t.ok('a meal with something on it carries a fold button, an empty one does not',
      await fold.evaluate(() => [...document.querySelectorAll('.mslot')].every((s) => {
        const has = !!s.querySelector('.mslot-fold');
        const items = s.querySelectorAll('.mitem, .mthin').length > 0;
        return has === items;
      })),
      await fold.evaluate(() => [...document.querySelectorAll('.mslot')].map((s) =>
        (s.querySelector('.mslot-name') || {}).textContent + ':' +
        (s.querySelector('.mslot-fold') ? 'fold' : 'none')).join(' | ')));
    t.ok('and it sits on the right of the row, not beside the name',
      await fold.evaluate(() => {
        const s = document.querySelector('.mslot-fold');
        if (!s) return false;
        const row = s.closest('.mslot-h').getBoundingClientRect();
        const b = s.getBoundingClientRect();
        // past the halfway line of its own row
        return b.left > row.left + row.width / 2;
      }));
    /* Six controls across a 375-wide phone. A wrapped "+ Add" doubles the
       height of every meal on the day, which is the exact thing the two-line
       header was built to avoid. */
    t.ok('and no control on that row wraps onto a second line',
      await fold.evaluate(() => [...document.querySelectorAll('.mslot-h')].every((h) =>
        [...h.querySelectorAll('button')].every((b) => b.getBoundingClientRect().height <= 36))),
      await fold.evaluate(() => [...document.querySelectorAll('.mslot-h button')]
        .map((b) => b.textContent.trim().slice(0, 8) + ' ' + Math.round(b.getBoundingClientRect().height))
        .join(' | ')));
    const shutBefore = await fold.evaluate(() =>
      document.querySelectorAll('.mslot-thin').length);
    await fold.click('.mslot-fold');
    await fold.waitForTimeout(300);
    t.ok('and pressing it folds that meal down to its list',
      await fold.evaluate((n) => document.querySelectorAll('.mslot-thin').length === n + 1, shutBefore),
      'thin lists ' + shutBefore + ' → ' +
        await fold.evaluate(() => document.querySelectorAll('.mslot-thin').length));
    t.ok('and the glyph turns to say which way the next press goes',
      await fold.evaluate(() => {
        const b = document.querySelector('.mslot-fold[aria-expanded="false"]');
        return !!b && getComputedStyle(b.querySelector('span')).transform !== 'none';
      }));
    await fold.context().close();

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
        mac: row.querySelector('.mitem-mac').textContent.trim()
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
    await ph.click('#macroTargBtn');
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
    t.ok('the pills carry the same six numbers as the rows and the line under them',
      await ph.evaluate(() => {
        // the sodium pill drops the thousands comma to fit a narrow phone, so
        // compare the two with separators stripped from both sides
        const pills = [...document.querySelectorAll('.mpill')].map((x) => x.textContent.replace(/[\s,]/g, ''));
        const rows = [...document.querySelectorAll('.mbrow[data-macro] .mb-d b')].map((x) => x.textContent);
        const micro = [...document.querySelectorAll('.mdelta .mm')]
          .map((x) => x.textContent.replace(/[^\d\/]/g, ''));
        return pills.length === 6 &&
          rows.every((v, i) => pills[i].indexOf(v) >= 0) &&
          micro.every((v, i) => pills[4 + i].indexOf(v) >= 0);
      }), await ph.evaluate(() => document.querySelector('.mpills').textContent));
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
