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
    await p.click('.tab[data-view="macros"]');
    await p.waitForTimeout(150);
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
    t.ok('nothing is eaten yet, so the eaten fill is empty',
      await p.evaluate(() => parseFloat(document.querySelector('.mbar-eaten').style.width) === 0));
    await p.click('[data-meat="b:0"]');
    await p.waitForTimeout(150);
    t.ok('ticking a meal marks it eaten',
      await p.evaluate(() => !!document.querySelector('.mitem.eaten')));
    t.ok('and the eaten fill takes on width',
      await p.evaluate(() => parseFloat(document.querySelector('.mbar-eaten').style.width) > 0));
    await p.click('[data-meat="b:0"]');
    await p.waitForTimeout(150);
    t.ok('unticking reverses it',
      await p.evaluate(() => !document.querySelector('.mitem.eaten') &&
        parseFloat(document.querySelector('.mbar-eaten').style.width) === 0));

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
        const over = document.querySelector('.mbar.over');
        return !!over && / g over/.test(over.textContent);
      }), await foot());
    t.ok('the bar caps at full rather than overflowing',
      await p.evaluate(() => Array.from(document.querySelectorAll('.mbar-track i'))
        .every((i) => parseFloat(i.style.width) <= 100)));
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
    await p.click('[data-mpall="1"]');
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
      /age, height and weight/i.test(await q.textContent('#mtPlan')),
      await q.textContent('#mtPlan'));

    // the same arithmetic the app claims: Mifflin–St Jeor × activity × goal
    const prof = { lb: 200, ftIn: 72, age: 40, act: 1.55 };
    const bmr = 10 * (prof.lb * 0.45359237) + 6.25 * (prof.ftIn * 2.54) - 5 * prof.age + 5;
    const kcal = Math.round(bmr * prof.act * 0.75);          // hard cut = −25%
    const planP = Math.round(1.10 * prof.lb);
    const planF = Math.round(Math.max(0.3 * prof.lb, 0.25 * kcal / 9));
    const planC = Math.max(0, Math.round((kcal - 4 * planP - 9 * planF) / 4));

    await q.fill('#mtAge', String(prof.age));
    await q.fill('#mtFt', '6');
    await q.fill('#mtIn', '0');
    await q.fill('#mtLb', String(prof.lb));
    await q.selectOption('#mtAct', '1.55');
    await q.click('[data-mtgoal="cut2"]');
    await q.waitForTimeout(150);
    t.ok('the plan line shows the arithmetic the app promises',
      (await q.textContent('#mtPlan')).indexOf(kcal + ' kcal · ' + planP + 'P / ' + planF + 'F / ' + planC + 'C') >= 0,
      await q.textContent('#mtPlan') + ' — wanted ' + kcal + '/' + planP + '/' + planF + '/' + planC);

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
  },
};
