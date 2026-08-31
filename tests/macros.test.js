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
        return /^Today ·/.test(s.options[s.selectedIndex].text) && s.options.length === 14;
      }));

    // the explainer lives behind the ?, not on every visit's screen
    t.ok('the explainer waits behind the ?',
      await p.evaluate(() => document.getElementById('macroNote').classList.contains('hide')));
    await p.click('#macroInfo');
    await p.waitForTimeout(100);
    t.ok('and the ? opens it',
      await p.evaluate(() => !document.getElementById('macroNote').classList.contains('hide') &&
        document.getElementById('macroInfo').getAttribute('aria-expanded') === 'true'));
    await p.click('#macroInfo');
    await p.waitForTimeout(100);

    // ---- default targets, and the calories derived from them, not stored
    const defP = 180, defF = 50, defC = 50;
    const defKcal = 4 * defP + 4 * defC + 9 * defF;
    const foot = () => p.textContent('#macroFoot');
    t.ok('default targets are 180P / 50F / 50C',
      new RegExp('/ ' + defP + ' g').test(await foot()) &&
      new RegExp('/ ' + defF + ' g').test(await foot()) &&
      new RegExp('/ ' + defC + ' g').test(await foot()), await foot());
    t.ok('the calorie line is derived 4/4/9 from the targets',
      (await foot()).indexOf('of ' + defKcal + ' kcal') >= 0, await foot());
    /* Calories get the bar, macros get the dials — a budget spent along a
       line, three ratios read against each other. The bar also replaced the
       running remainder that used to sit under all six meals, which was text
       doing a chart's job over and over. */
    t.ok('and the day’s calories are a chart, not six lines of prose',
      await p.evaluate(() => !!document.querySelector('.mkcal-track .mkcal-ate') &&
        !document.querySelector('.mslot-left')));

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
    await p.waitForTimeout(200);
    const picked = await p.evaluate(() => {
      const r = document.querySelector('.mpick-row[data-mpx]');
      return { id: r.dataset.mpick, x: Number(r.dataset.mpx) };
    });
    await p.click('.mpick-row[data-mpx]');
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
      await p.evaluate(() => document.querySelector('.mdial').dataset.eaten === '0'));
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
      await p.evaluate(() => Number(document.querySelector('.mdial').dataset.eaten) > 0));
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
        document.querySelector('.mdial').dataset.eaten === '0' &&
        !document.querySelector('#macroSlots .mday-stop.done')));

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
    t.ok('a busted macro says over, in the over state',
      await p.evaluate(() => {
        const over = document.querySelector('.mdial.over');
        return !!over && / g over/.test(over.textContent);
      }), await foot());
    /* Colour is the verdict, not the eating. A day 10 g past its protein
       target must not draw the same ring as one that landed on it — which
       is exactly what happened while green meant "eaten": both sweeps clamp
       at 100%, so over and on-the-nose were the same picture. */
    t.ok('every dial names where it stands',
      await p.evaluate(() => Array.from(document.querySelectorAll('.mdial'))
        .every((d) => ['under', 'on', 'over'].indexOf(d.dataset.state) >= 0)));
    t.ok('and an overshoot reads over even with every plate eaten',
      await p.evaluate(() => {
        const d = document.querySelector('.mdial.over');
        return d && d.dataset.state === 'over' && Number(d.dataset.planned) === 100;
      }));
    /* Protein is the one macro a cut wants overshot, so its band runs to
       110%; fat and carbs turn at the line. The fit scorer has always judged
       them that way and the dial must not contradict it. */
    t.ok('protein gets a wider band than fat and carbs',
      await p.evaluate(() => {
        const pctOf = (d) => {
          const m2 = d.querySelector('.mbar-of').textContent.match(/(\d+) \/ (\d+)/);
          return 100 * Number(m2[1]) / Number(m2[2]);
        };
        return Array.from(document.querySelectorAll('.mdial')).every((d) =>
          d.dataset.state !== 'over' ||
          pctOf(d) > (/Protein/.test(d.textContent) ? 110 : 100));
      }));
    t.ok('the dial caps at full rather than sweeping twice round',
      await p.evaluate(() => Array.from(document.querySelectorAll('.mdial'))
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
    await p.waitForTimeout(200);
    await p.selectOption('#mpSec', 'all');
    await p.waitForTimeout(150);
    await p.fill('#mpSearch', estName);
    await p.waitForTimeout(200);
    await p.click('.mpick-row');
    await p.waitForTimeout(300);
    t.ok('an estimated recipe carries the tilde on its line',
      await p.evaluate(() => Array.from(document.querySelectorAll('.mitem-mac'))
        .some((el) => el.textContent.indexOf('~') === 0)));
    t.ok('and the footer says what the tilde means',
      await p.evaluate(() => !!document.querySelector('.macro-est')));
    t.ok('while the authored recipe shows none',
      await p.evaluate(() => {
        const first = document.querySelector('[data-meat="b:0"]');
        if (!first) return true; // breakfast pick happened to be estimated too — nothing to assert
        const r = window.RECIPES.find((x) => String(x.id) ===
          String(JSON.parse(localStorage.getItem('bsc.macroDays'))[Object.keys(JSON.parse(localStorage.getItem('bsc.macroDays')))[0]].b[0].id));
        const line = first.closest('.mitem').querySelector('.mitem-mac').textContent;
        return r.est ? line.indexOf('~') === 0 : line.indexOf('~') < 0;
      }));

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
    t.ok('the day survives a reload',
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
      /work themselves out/i.test(await q.textContent('#mtPlan')),
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
      const items = ['b', 'l', 'd', 's'].map((k) => day[k]);
      const ids = [].concat(...items).map((i) => String(i.id));
      const tot = { p: 0, f: 0, c: 0 };
      ids.forEach((id, n) => {
        const r = window.RECIPES.find((x) => String(x.id) === id);
        const x = [].concat(...items)[n].x;
        tot.p += r.macro.p * x; tot.f += r.macro.f * x; tot.c += r.macro.c * x;
      });
      return {
        perSlot: items.map((i) => i.length),
        unique: new Set(ids).size === ids.length,
        tot,
        fillDisabled: document.getElementById('macroFill').disabled,
      };
    });
    t.ok('every meal gets something', drafted.perSlot.every((n) => n >= 1), drafted.perSlot.join(','));
    t.ok('and never the same recipe twice in a day', drafted.unique);
    t.ok('the draft chases the protein target',
      drafted.tot.p >= 0.6 * planP, Math.round(drafted.tot.p) + ' of ' + planP);
    t.ok('without blowing the fat budget wide open',
      drafted.tot.f <= planF + 30, Math.round(drafted.tot.f) + ' vs ' + planF);
    t.ok('a full day leaves the button nothing to do', drafted.fillDisabled);

    // only the empty meals are drafted — what you placed is yours
    const keepIds = await q.evaluate(() => {
      const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
      const day = days[Object.keys(days)[0]];
      return { b: String(day.b[0].id), d: String(day.d[0].id), s: String(day.s[0].id) };
    });
    await q.click('[data-mdel="l:0"]');
    await q.waitForTimeout(200);
    await q.click('#macroFill');
    await q.waitForTimeout(300);
    t.ok('refilling touches only the meal that was emptied',
      await q.evaluate((keep) => {
        const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
        const day = days[Object.keys(days)[0]];
        return day.l.length === 1 && String(day.b[0].id) === keep.b &&
          String(day.d[0].id) === keep.d && String(day.s[0].id) === keep.s;
      }, keepIds));

    await q.context().close();

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
      await m.waitForTimeout(250);
      await m.click('.mpick-row[data-mpx]');
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
    const beforeP = await m.evaluate(() => document.querySelector('.mbar-nums').textContent);
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
      (await m.evaluate(() => document.querySelector('.mbar-nums').textContent)) === beforeP);

    await m.context().close();

    /* ---- lenses, locks, and the rebalancer ------------------------------ */
    const z = await t.fresh();
    await z.click('.tab[data-view="macros"]');
    await z.waitForTimeout(150);

    // the picker's sort is a lens: order changes, portions stay
    await z.click('[data-mslot="b"]');
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
        const rows = [...document.querySelectorAll('.mpick-row')];
        return rows.length && rows.every((r) => {
          const rec = window.RECIPES.find((x) => String(x.id) === r.dataset.mpick);
          return rec.book === 2 && rec.secNum === 4;
        });
      }));
    await z.selectOption('#mpSec', 'meal');
    await z.waitForTimeout(150);

    // one plate on the day, shrunk by hand, put right by the button
    await z.click('.mpick-row[data-mpx]');
    await z.waitForTimeout(300);
    for (let i = 0; i < 20; i++) await z.click('[data-mstep="b:0:down"]');
    await z.waitForTimeout(150);
    const leftBefore = await z.evaluate(() =>
      Number(document.querySelector('.mbar-nums').textContent.match(/(\d+) g left/)[1]));
    await z.click('#macroRebal');
    await z.waitForTimeout(250);
    t.ok('Rebalance grows a shrunken plate back toward the day',
      await z.evaluate(() => document.querySelector('.mstep-x').textContent !== '×¼'),
      await z.textContent('.mstep-x'));
    t.ok('and the day is nearer its protein than before',
      await z.evaluate((was) => {
        const m2 = document.querySelector('.mbar-nums').textContent.match(/(\d+) g (left|over)/);
        return m2[2] === 'over' ? true : Number(m2[1]) < was;
      }, leftBefore), 'was ' + leftBefore + ' g left');

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
    await z.waitForTimeout(200);
    t.ok('the meal now draws from exactly the section it ticked',
      await z.evaluate(() => {
        const rows = [...document.querySelectorAll('.mpick-row')];
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
    await y.waitForTimeout(200);
    await y.click('.mpick-row[data-mpx]');
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
      copied && /Weight: 188\.6 lb/.test(copied) && /Total: \d+ kcal/.test(copied) &&
      /Target: \d+ kcal/.test(copied) && /×/.test(copied),
      (copied || '').slice(0, 120));
    t.ok('and names every meal that has something on it',
      await y.evaluate((txt) => {
        const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
        const day = days[Object.keys(days)[0]];
        const slots = JSON.parse(localStorage.getItem('bsc.macroSlots'));
        return slots.list.every((s2) => !(day[s2.k] || []).length || txt.indexOf(s2.n + ':') >= 0);
      }, copied));

    await y.context().close();
  },
};
