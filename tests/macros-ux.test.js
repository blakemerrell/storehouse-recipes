/* Nourish as it is used day to day: the daily loop, the look and feel
 * (sizes, the bar's words, quiet by default), and insight (charts to read,
 * meals again, a food by the amount).
 *
 * Part of the Nourish suite, split out of tests/macros.test.js: the page
 * helpers and the plan every page starts with are in tests/fixtures/nourish.js. */
const { nourish } = require('./fixtures/nourish.js');

module.exports = nourish({
  name: 'Macros — the daily loop, look and feel, insight',
  async suite(t) {
    /* ---- the daily loop ---------------------------------------------------
     * Protein that leaves room for carbs, food logged as eaten by the hour of
     * its meal, one search for foods and recipes, the basket's − and +, "to
     * go" until the day is over, and portions that start at what you had last
     * time. All on a fixed clock — a Wednesday at half past one, with Monday,
     * Wednesday and Friday for lifting — because half of it is about what
     * time it is, and a suite that passes at breakfast and fails after dinner
     * is testing the hour it was run at. */
    {
      const ctx = await t.browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      await ctx.route(/api\.nal\.usda\.gov/, (r) => r.abort());
      const pg = await ctx.newPage();
      pg.on('pageerror', (e) => t.ok('no uncaught error on the page', false, e.message));
      await pg.clock.install({ time: new Date(2026, 8, 30, 13, 30, 0) });
      await pg.goto(t.base + 'index.html');
      const WED = '2026-09-30', TUE = '2026-09-29', THU = '2026-10-01';
      const base = { sex: 'm', age: 44, ft: 5, inch: 10, lb: 212, act: 1.2, goal: 'cut1', goalLb: 0, goalBy: '',
        workouts: 3, steps: 6000, train: [0, 2, 4] };
      /* A week of mornings at 212 up to and including today, so the plan card
         is folded and the scale agrees with the profile. */
      const seed = async (o) => {
        await pg.evaluate(([o, base]) => {
          const p2 = (n) => (n < 10 ? '0' : '') + n;
          const key = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
          localStorage.clear();
          localStorage.setItem('bsc.hintDone', '1');
          const ws = {};
          for (let i = 0; i <= 6; i++) { const d = new Date(); d.setDate(d.getDate() - i); ws[key(d)] = 212; }
          localStorage.setItem('bsc.macroWeights', JSON.stringify(ws));
          localStorage.setItem('bsc.macroProfile', JSON.stringify(Object.assign({}, base, o.pr || {})));
          localStorage.setItem('bsc.macroTargets', JSON.stringify(o.t || { p: 212, f: 64, c: 77, auto: 1, set: key(new Date()) }));
          if (o.days) localStorage.setItem('bsc.macroDays', JSON.stringify(o.days));
          if (o.favs) localStorage.setItem('bsc.favs', JSON.stringify(o.favs));
          if (o.done) localStorage.setItem('bsc.macroDone', JSON.stringify(o.done));
          if (o.train) localStorage.setItem('bsc.train', JSON.stringify(o.train));
          if (o.myFoods) localStorage.setItem('bsc.myFoods', JSON.stringify(o.myFoods));
        }, [o || {}, base]);
        await pg.reload();
        await pg.waitForTimeout(300);
        await pg.click('.tab[data-view="macros"]');
        await pg.waitForTimeout(300);
      };
      const at = async (y, mo, d, h, mi) => {
        await pg.clock.setSystemTime(new Date(y, mo, d, h, mi || 0, 0));
      };
      const stored = (k) => pg.evaluate((k) => (JSON.parse(localStorage.getItem('bsc.macroDays') || '{}')[k]) || {}, k);
      /* The meal opened (one is open at a time), then its own + — the way a
         thumb reaches it. */
      const openMeal = async (sk) => {
        await pg.evaluate((sk) => {
          const b = document.querySelector('#macroSlots [data-mfold="' + sk + '"][aria-expanded="false"]');
          if (b) b.click();
        }, sk);
        await pg.waitForTimeout(150);
        await pg.evaluate((sk) => {
          const a = document.querySelector('[data-mslot="' + sk + '"]');
          a.scrollIntoView({ block: 'center' });
          a.click();
        }, sk);
        await pg.waitForTimeout(400);
      };
      const search = async (q) => {
        await pg.fill('#mpFind', q);
        await pg.waitForTimeout(400);
      };
      const rows = () => pg.evaluate(() => [...document.querySelectorAll('#mpList .mpick-row[data-mpick]')]
        .map((r) => ({ id: r.dataset.mpick, x: Number(r.dataset.mpx), name: r.querySelector('.mp-name').textContent.replace('★', '').trim() })));
      const foodsBand = () => pg.evaluate(() => {
        const out = []; let on = false;
        [...document.querySelectorAll('#mpList > *')].forEach((el) => {
          if (el.classList.contains('mt-div')) { on = /^Foods/.test(el.textContent); return; }
          const b = on && el.querySelector('.mpick-row[data-mpick]');
          if (b) out.push(b.dataset.mpick);
        });
        return out;
      });
      const addFood = async (sk, q, id) => {
        await openMeal(sk);
        await search(q);
        await pg.click('#mpList .mpick-row[data-mpick="' + id + '"]');
        await pg.waitForTimeout(150);
        await pg.click('[data-mpdone]');
        await pg.waitForTimeout(500);
      };

      /* ---- protein ---------------------------------------------------------
       * Blake: "Default ~1 g per lb of goal weight (or of lean mass if body
       * fat is known), never more than 1 g/lb of total weight; plus a 'Protein
       * level' choice on the plan step (Moderate / High / Very high)." */
      await seed({});
      const prot = (pr) => pg.evaluate((pr) => window.__macroLab.protein(pr), pr);
      const plan = (pr) => pg.evaluate((pr) => window.__macroLab.plan(pr), pr);
      const P = {};
      for (const goalLb of [0, 185]) {
        for (const level of ['mod', 'high', 'vhigh']) P[goalLb + level] = (await prot(Object.assign({}, base, { goalLb, prot: level }))).g;
      }
      t.ok('212 lb with no goal weight: 170, 212 and 233 g of protein at Moderate, High and Very high',
        P['0mod'] === 170 && P['0high'] === 212 && P['0vhigh'] === 233, JSON.stringify(P));
      t.ok('aiming at 185 lb: 148, 185 and 222 g — counted against the goal, not today',
        P['185mod'] === 148 && P['185high'] === 185 && P['185vhigh'] === 222, JSON.stringify(P));
      const never = await prot(base);
      t.ok('a profile that never chose a level is on High', never.level === 'high' && never.g === 212, JSON.stringify(never));
      const lean = await prot(Object.assign({}, base, { bf: 25, goalLb: 185 }));
      t.ok('a typed body fat counts protein against the lean mass, ahead of the goal weight',
        lean.g === 159 && Math.round(lean.ref) === 159, JSON.stringify(lean));
      const guess = await prot(Object.assign({}, base, { bf: 0 }));
      t.ok('and an estimated body fat does not: a guess is not "known"', guess.g === 212, JSON.stringify(guess));
      const light = { sex: 'f', age: 35, ft: 5, inch: 4, lb: 120, act: 1.375, goal: 'gain', goalLb: 130, goalBy: '', workouts: 3, steps: 8000 };
      const lh = await prot(light);
      const lv = await prot(Object.assign({}, light, { prot: 'vhigh' }));
      const lm = await prot(Object.assign({}, light, { prot: 'mod' }));
      t.ok('a light person aiming up is never asked for more than a gram a pound of what she weighs (1.1 on Very high)',
        lh.g === 120 && lv.g === 132 && lm.g === 104, JSON.stringify([lh.g, lv.g, lm.g]));
      const pNo = await plan(base), pGoal = await plan(Object.assign({}, base, { goalLb: 185 }));
      t.ok('a goal weight hands the protein it saves to carbohydrate, at the same calories',
        pNo.p === 212 && pGoal.p === 185 && pGoal.kcal === pNo.kcal && pGoal.c === pNo.c + 27, JSON.stringify({ pNo, pGoal }));
      let squeezeOk = true; const squeezed = [];
      for (const extra of [{ goal: 'cut2', prot: 'vhigh' }, { goal: 'cut2', prot: 'mod', goalLb: 185 },
        { goal: 'cut2', prot: 'high', goalLb: 150 }, { goal: 'cut2', prot: 'vhigh', lb: 150, sex: 'f', ft: 5, inch: 3 }]) {
        const pr = Object.assign({}, base, extra);
        const pl = await plan(pr), pt = await prot(pr);
        squeezed.push([pl.p, pt.g, pt.floor, Math.round(pt.ref)]);
        if (!(pl.p <= pt.g && pl.p >= pt.floor && pl.p >= 0.7 * pt.ref)) squeezeOk = false;
      }
      t.ok('a squeezed cut eases protein, but never under 0.8 g a pound of its reference', squeezeOk, JSON.stringify(squeezed));

      /* The level on the plan step, stored with the profile like the rest of it. */
      await pg.click('#macroMore');
      await pg.waitForTimeout(150);
      await pg.click('[data-mmore="plan"]');
      await pg.waitForTimeout(400);
      const lvl = await pg.evaluate(() => ({
        btns: [...document.querySelectorAll('[data-mtprot]')].map((b) => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')),
        why: (document.getElementById('mtProtWhy') || {}).textContent || '',
        save: !!document.querySelector('#mtSave:not(.hide)'),
      }));
      t.ok('the plan sheet offers Moderate, High and Very high, High chosen',
        lvl.btns.join() === 'Moderate,High*,Very high', JSON.stringify(lvl));
      t.ok('and says what the grams are counted against', /1 g a pound of your weight \(212 lb\)/.test(lvl.why), lvl.why);
      await pg.click('[data-mtprot="mod"]');
      await pg.waitForTimeout(250);
      const modNow = await pg.evaluate(() => ({ p: document.getElementById('mtTileP').textContent,
        save: !!document.querySelector('#mtSave:not(.hide)') }));
      t.ok('Moderate moves the protein tile, and brings Save with it', modNow.p === '170' && modNow.save && !lvl.save, JSON.stringify({ lvl, modNow }));
      await pg.click('[data-mtarg="save"]');
      await pg.waitForTimeout(400);
      const kept = await pg.evaluate(() => ({ pr: JSON.parse(localStorage.getItem('bsc.macroProfile')).prot,
        t: JSON.parse(localStorage.getItem('bsc.macroTargets')).p }));
      t.ok('and Save keeps the level in the profile and the grams in the plan', kept.pr === 'mod' && kept.t === 170, JSON.stringify(kept));
      const merged = await pg.evaluate(() => {
        const pr = JSON.parse(localStorage.getItem('bsc.macroProfile'));
        pr.prot = 'vhigh';
        window.__macroLab.merge({ pr: { v: pr, at: Date.now() + 60000 } });
        return window.__macroLab.profile().prot;
      });
      t.ok('and the level travels between devices with the rest of the profile', merged === 'vhigh', merged);

      /* ---- added = planned, whatever the hour -----------------------------
       * First Blake: "Added to a current or past meal = eaten at once". Then,
       * after living with it (2026-09-27): "Why when I add a dish does it
       * mark it as eaten?... I want to tick it complete." So every add is a
       * plan, on any day and at any hour; the tick makes it eaten. The meal
       * opening times still stand — the day's verdict waits on them. */
      await seed({});
      const opens = await pg.evaluate(() => window.__macroLab.opens());
      t.ok('breakfast is open from midnight, lunch from eleven, dinner from five, and a trailing snack all day',
        JSON.stringify(opens) === JSON.stringify([{ k: 'b', at: 0 }, { k: 'l', at: 660 }, { k: 'd', at: 1020 }, { k: 's', at: 0 }]),
        JSON.stringify(opens));
      await addFood('b', 'banana', 'f:banana');
      t.ok('at half past one, food added to breakfast arrives planned', ((await stored(WED)).b || [])[0].eaten === 0,
        JSON.stringify(await stored(WED)));
      await addFood('l', 'banana', 'f:banana');
      t.ok('and to lunch, the meal you are on, planned too', ((await stored(WED)).l || [])[0].eaten === 0, JSON.stringify(await stored(WED)));
      await addFood('d', 'banana', 'f:banana');
      t.ok('but dinner, still to come, stays a plan', ((await stored(WED)).d || [])[0].eaten === 0, JSON.stringify(await stored(WED)));
      /* The look: eaten in ink beside its tick, planned lighter, nothing struck.
         Breakfast and lunch ticked by hand, the way they become eaten now. */
      await pg.evaluate(() => { const c = document.querySelector('[data-meat="b:0"]'); if (c && !c.checked) c.click(); });
      await pg.waitForTimeout(200);
      await pg.evaluate(() => { const c = document.querySelector('[data-meat="l:0"]'); if (c && !c.checked) c.click(); });
      await pg.waitForTimeout(200);
      const look = await pg.evaluate(() => {
        const toRgb = (s) => {
          const m = s.match(/oklch\(([\d.]+)%? ([\d.]+) ([\d.]+)/);
          if (m) {
            let L = Number(m[1]); if (L > 1) L /= 100;
            const C = Number(m[2]), h = Number(m[3]) * Math.PI / 180, a = C * Math.cos(h), b = C * Math.sin(h);
            const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3,
              ss = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
            const lin = [4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * ss, -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * ss,
              -0.0041960863 * l - 0.7034186147 * mm + 1.7076147010 * ss];
            return lin.map((v) => Math.max(0, Math.min(1, v)));
          }
          const n = (s.match(/[\d.]+/g) || []).slice(0, 3).map((v) => Number(v) / 255);
          return n.map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
        };
        const lum = (s) => { const c = toRgb(s); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
        const bgOf = (el) => {
          for (let e = el; e; e = e.parentElement) {
            const b = getComputedStyle(e).backgroundColor;
            if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b;
          }
          return 'rgb(255, 255, 255)';
        };
        const ratio = (el) => {
          const a = lum(getComputedStyle(el).color), b = lum(bgOf(el));
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        };
        const ate = document.querySelector('.mitem.eaten .mitem-name');
        const plan = document.querySelector('.mitem:not(.eaten) .mitem-name');
        return {
          ateLine: ate && getComputedStyle(ate).textDecorationLine,
          ateTick: !!document.querySelector('.mitem.eaten .mitem-ate:checked'),
          ateRatio: ate && ratio(ate), planRatio: plan && ratio(plan),
        };
      });
      t.ok('an eaten plate is ink beside its tick, with no line through it',
        look.ateLine === 'none' && look.ateTick && look.ateRatio > 10, JSON.stringify(look));
      t.ok('and a planned one is lighter, still at 4.5:1 or better',
        look.planRatio >= 4.5 && look.planRatio < look.ateRatio - 2, JSON.stringify(look));
      /* Folded, the same: a tick in ink, never a strike. */
      await pg.reload();
      await pg.waitForTimeout(300);
      await pg.click('.tab[data-view="macros"]');
      await pg.waitForTimeout(300);
      const thin = await pg.evaluate(() => {
        const ate = document.querySelector('.mthin.eaten');
        const plan = document.querySelector('.mthin:not(.eaten)');
        return {
          ateTick: ate && ate.querySelector('.mthin-ok').textContent,
          ateLine: ate && getComputedStyle(ate.querySelector('.mthin-n')).textDecorationLine,
          planTick: plan && plan.querySelector('.mthin-ok').textContent,
          planColor: plan && getComputedStyle(plan.querySelector('.mthin-n')).color,
          ateColor: ate && getComputedStyle(ate.querySelector('.mthin-n')).color,
        };
      });
      t.ok('a folded meal marks eaten food with a ✓ and no strike, and planned food with neither',
        thin.ateTick === '✓' && thin.ateLine === 'none' && thin.planTick === 'planned' && thin.planColor !== thin.ateColor,
        JSON.stringify(thin));
      /* The tick still toggles, both ways. */
      await openMeal('d');
      await pg.goBack();
      await pg.waitForTimeout(300);
      const tick = () => pg.evaluate(() => document.querySelector('[data-meat="d:0"]').click());
      await tick();
      await pg.waitForTimeout(200);
      const on = ((await stored(WED)).d || [])[0].eaten;
      await tick();
      await pg.waitForTimeout(200);
      const off = ((await stored(WED)).d || [])[0].eaten;
      t.ok('and a tap still marks a plate eaten, and back', on === 1 && off === 0, on + ' then ' + off);
      /* Fill is the app suggesting, never you saying you ate. */
      await pg.evaluate(() => { document.getElementById('macroSweep').click(); });
      await pg.waitForTimeout(200);
      await pg.click('#macroFill');
      await pg.waitForTimeout(800);
      const drafted = await stored(WED);
      const drafts = [].concat(...Object.keys(drafted).map((sk) => (drafted[sk] || []).filter((it) => it.by === 'f')));
      t.ok('Fill drafts stay planned, even on meals whose time has come',
        drafts.length > 0 && drafts.every((it) => it.eaten === 0), JSON.stringify(drafted));
      /* A day behind you is all eaten; a day ahead is all plan. */
      await pg.selectOption('#macroDaySel', TUE);
      await pg.waitForTimeout(300);
      await addFood('d', 'banana', 'f:banana');
      t.ok('on yesterday, dinner arrives planned too', ((await stored(TUE)).d || [])[0].eaten === 0, JSON.stringify(await stored(TUE)));
      await pg.selectOption('#macroDaySel', THU);
      await pg.waitForTimeout(300);
      await addFood('b', 'banana', 'f:banana');
      t.ok('and on tomorrow, even breakfast is a plan', ((await stored(THU)).b || [])[0].eaten === 0, JSON.stringify(await stored(THU)));
      await pg.selectOption('#macroDaySel', WED);
      await pg.waitForTimeout(300);
      /* At quarter to eleven lunch has not started; at five past, it has. */
      await at(2026, 8, 30, 10, 45);
      const early = await pg.evaluate((k) => [window.__macroLab.addsEaten(k, 'l'), window.__macroLab.addsEaten(k, 'd')], WED);
      await at(2026, 8, 30, 17, 5);
      const late = await pg.evaluate((k) => [window.__macroLab.addsEaten(k, 'l'), window.__macroLab.addsEaten(k, 'd')], WED);
      t.ok('and the hour never makes an add eaten', early.join() === '0,0' && late.join() === '0,0',
        JSON.stringify({ early, late }));
      await at(2026, 8, 30, 13, 30);

      /* ---- one search ------------------------------------------------------
       * Blake: "Any word order; ★ and recent foods ranked first, then exact,
       * then word-starts; common variants (oatmeal/oats, yoghurt/yogurt) and
       * one-letter typos still match. Recipes search the same way." */
      await seed({ favs: ['f:egg'] });
      await openMeal('d');
      const oatMash = await pg.evaluate(() => (window.RECIPES.find((r) => /vanilla/i.test(r.name) && /\boat/i.test(r.name)) || {}).name);
      await search('vanilla oat');
      t.ok('"vanilla oat" finds ' + oatMash + ', whose name has the two words apart',
        !!oatMash && (await rows()).some((r) => r.name === oatMash), JSON.stringify((await rows()).slice(0, 6)));
      await search('oat vanilla');
      t.ok('in either order', (await rows()).some((r) => r.name === oatMash));
      await search('egg');
      const eggs = await foodsBand();
      t.ok('"egg" puts the starred Eggs first, above Eggplant',
        eggs[0] === 'f:egg' && eggs.indexOf('f:eggplant') > 0, JSON.stringify(eggs));
      await search('yoghurt');
      t.ok('"yoghurt" finds yogurt', (await rows()).some((r) => /yogurt/i.test(r.name)), JSON.stringify((await rows()).slice(0, 4)));
      await search('chiken');
      t.ok('"chiken", one letter short, still finds chicken', (await rows()).some((r) => /chicken/i.test(r.name)),
        JSON.stringify((await rows()).slice(0, 4)));
      await search('rice');
      const rice = await foodsBand();
      const riceName = ((await rows()).find((r) => r.id === rice[0]) || {}).name;
      t.ok('and a real match outranks a one-letter guess', riceName === 'Rice', JSON.stringify({ rice, riceName }));
      /* "rce" is one letter off "rice", so only the four-letter rule keeps it
         from being guessed at; "chk" could never match chicken by any rule,
         and passed with the rule deleted. */
      await search('rce');
      t.ok('but a three-letter word is not guessed at', (await rows()).every((r) => !/^rice$/i.test(r.name)),
        JSON.stringify((await rows()).slice(0, 4)));
      await pg.goBack();
      await pg.waitForTimeout(300);
      /* The Recipes tab asks the same matcher. */
      await pg.click('.tab[data-view="browse"]');
      await pg.waitForTimeout(300);
      await pg.fill('#search', 'oats');
      await pg.waitForTimeout(400);
      const oats = await pg.evaluate(() => [...document.querySelectorAll('.card-name')].map((n) => n.textContent));
      t.ok('"oats" on the Recipes tab finds the oatmeal', oats.some((n) => /oatmeal/i.test(n)), oats.slice(0, 8).join(' | '));
      await pg.fill('#search', 'oat vanilla');
      await pg.waitForTimeout(400);
      const ov = await pg.evaluate(() => [...document.querySelectorAll('.card-name')].map((n) => n.textContent));
      t.ok('and any word order there too, the named dish first', ov[0] === oatMash, ov.slice(0, 4).join(' | '));
      await pg.fill('#search', '');
      await pg.click('.tab[data-view="macros"]');
      await pg.waitForTimeout(300);

      /* ---- the basket's − and + on a food ---------------------------------
       * "f:egg" has a colon of its own, and the step's id was cut at the
       * first one. */
      await openMeal('d');
      await search('egg');
      await pg.click('#mpList .mpick-row[data-mpick="f:egg"]');
      await pg.waitForTimeout(150);
      await pg.click('[data-mpbasket]');
      await pg.waitForTimeout(200);
      const eggX = () => pg.evaluate(() => {
        const r = [...document.querySelectorAll('.mp-basket .mpb-row')].find((x) => x.querySelector('[data-mbstep^="f:egg:"]'));
        return r ? r.querySelector('.mpb-x > span').textContent : '';
      });
      const x0 = await eggX();
      await pg.click('[data-mbstep="f:egg:1"]');
      await pg.waitForTimeout(150);
      const x1 = await eggX();
      await pg.click('[data-mbstep="f:egg:-1"]');
      await pg.click('[data-mbstep="f:egg:-1"]');
      await pg.waitForTimeout(150);
      const x2 = await eggX();
      t.ok('+ and − change a single food’s amount in the basket', x0 === '×1' && x1 === '×2' && x2 === '×1' && x0 !== x1,
        [x0, x1, x2].join(' → '));
      await pg.goBack();
      await pg.waitForTimeout(300);

      /* ---- portions start at last time ------------------------------------
       * Blake: "Default to what you had last time (else 1 serving); 'fits the
       * meal' becomes a one-tap chip beside it." */
      await seed({ favs: ['f:egg'], days: { [TUE]: { b: [{ id: 'f:egg', x: 6, eaten: 1 }] } } });
      await openMeal('d');
      await search('egg');
      const eggRow = (await rows()).find((r) => r.id === 'f:egg');
      const chip = await pg.evaluate(() => {
        const c = document.querySelector('#mpList [data-mpfit="f:egg"]');
        return c ? { x: Number(c.dataset.mpx), text: c.textContent } : null;
      });
      t.ok('a food you had yesterday is offered at what you had: six eggs', eggRow && eggRow.x === 6, JSON.stringify(eggRow));
      t.ok('with what fits the meal on a chip beside it', !!chip && chip.x > 0 && chip.x !== 6 && /^Fits: /.test(chip.text),
        JSON.stringify(chip));
      await search('banana');
      const ban = (await rows()).find((r) => r.id === 'f:banana');
      t.ok('and one never logged is offered at one', ban && ban.x === 1, JSON.stringify(ban));
      await search('egg');
      await pg.click('#mpList [data-mpfit="f:egg"]');
      await pg.waitForTimeout(150);
      await pg.click('[data-mpdone]');
      await pg.waitForTimeout(500);
      const fitted = ((await stored(WED)).d || []).find((it) => it.id === 'f:egg');
      t.ok('one tap on the chip adds the amount that fits', fitted && Math.abs(fitted.x - chip.x) < 1e-6,
        JSON.stringify({ fitted, chip }));
      await openMeal('s');
      await search('egg');
      await pg.click('#mpList .mpick-row[data-mpick="f:egg"]');
      await pg.waitForTimeout(150);
      await pg.click('[data-mpbasket]');
      await pg.waitForTimeout(200);
      /* Moved off whatever it arrived at first, so the chip has something to
         put right whatever the fit came to. */
      for (let i = 0; i < 4; i++) { await pg.click('[data-mbstep="f:egg:1"]'); await pg.waitForTimeout(80); }
      const bChip = await pg.evaluate(() => {
        const c = document.querySelector('.mp-basket [data-mpfit="f:egg"]');
        return c ? Number(c.dataset.mpx) : null;
      });
      if (bChip) {
        await pg.click('.mp-basket [data-mpfit="f:egg"]');
        await pg.waitForTimeout(150);
      }
      await pg.click('[data-mpdone]');
      await pg.waitForTimeout(500);
      const snack = ((await stored(WED)).s || []).find((it) => it.id === 'f:egg');
      t.ok('and in the basket the chip moves what you picked to what fits', bChip > 0 && snack && Math.abs(snack.x - bChip) < 1e-6,
        JSON.stringify({ bChip, snack }));

      /* ---- to go, until the day is over ----------------------------------
       * Blake: "No verdict on today until it's closed or dinner time has
       * passed; 'Lifting day · 96 g carbs' before training, 'Trained ✓ 5:40
       * pm' after; 'Rest day' label; a readable lifting mark on the week
       * strip." */
      const halfDay = { [WED]: { b: [{ id: 'f:egg', x: 3, eaten: 1 }], l: [{ id: 'f:banana', x: 2, eaten: 1 }] } };
      await seed({ days: halfDay });
      const strip = () => pg.evaluate(() => {
        const d = document.querySelector('.mwk-d.now');
        return { cls: d.className, word: d.querySelector('.mwk-s').textContent.trim() };
      });
      const s1 = await strip();
      const want = await pg.evaluate(() => { const T = window.__macroLab.targets(); return Math.round(4 * T.p + 4 * T.c + 9 * T.f); });
      const got = await pg.evaluate(() => Math.round(window.__macroLab.read().tot.kcal));
      /* Blake, 2026-09-27: "The 27 to go text under the bar at the top. It
         can go away." The ring says what is left; the strip says nothing
         until the day is judged, and never "under" before then. */
      t.ok('at half past one, today carries no word under it, and is not called "under"',
        s1.word === '' && !/\bunder\b/.test(s1.cls), JSON.stringify({ s1, want, got }));
      await pg.click('#macroMore');
      await pg.waitForTimeout(150);
      await pg.click('[data-mmore="went"]');
      await pg.waitForTimeout(400);
      const went = await pg.evaluate(() => document.querySelector('.ds-sheet').innerText.replace(/\s+/g, ' '));
      t.ok('and the day card counts down rather than judging',
        /How the day is going/i.test(went) && /kcal to go/.test(went) && /g protein to go/.test(went) &&
        !/short on protein|Calories landed/.test(went), went.slice(0, 200));
      await pg.goBack();
      await pg.waitForTimeout(300);
      await at(2026, 8, 30, 21, 10);
      await pg.reload();
      await pg.waitForTimeout(300);
      await pg.click('.tab[data-view="macros"]');
      await pg.waitForTimeout(300);
      const s2 = await strip();
      /* No words under the strip at all (Blake: "It's visual for a reason"),
         so the verdict comes back as the day's colour, not a word. */
      t.ok('once dinner time has passed, the verdict comes back, as colour and no word', s2.word === '' && /\bunder\b/.test(s2.cls), JSON.stringify(s2));
      await at(2026, 8, 30, 13, 30);
      await seed({ days: halfDay, done: { [WED]: Date.now() } });
      const s3 = await strip();
      t.ok('and a day you have closed is judged whatever the hour', s3.word === '' && /\bunder\b/.test(s3.cls), JSON.stringify(s3));
      await seed({ days: { [WED]: { b: [{ id: 'f:egg', x: 40, eaten: 1 }] } } });
      const s4 = await strip();
      t.ok('but over is over at any hour, because that is already a fact', s4.word === '' && /\bover\b/.test(s4.cls), JSON.stringify(s4));
      await seed({ days: Object.assign({ [TUE]: { b: [{ id: 'f:egg', x: 3, eaten: 1 }] } }, halfDay) });
      await pg.selectOption('#macroDaySel', TUE);
      await pg.waitForTimeout(300);
      const s5 = await strip();
      t.ok('and a day behind you keeps its verdict, as colour', s5.word === '' && /\bunder\b/.test(s5.cls), JSON.stringify(s5));

      /* The folded card's word on training. */
      const trainSeed = (wo) => ({ act: 'b1', pr: { ld: [0, 2, 4], qz: 1 }, wo: wo || {},
        ms: { b1: { n: 'Full body', acc: 4, days: [{ n: 'Full Body A', s: [{ e: 'db-bench', n: 3 }] },
          { n: 'Full Body B', s: [{ e: 'goblet', n: 3 }] }, { n: 'Full Body C', s: [{ e: 'db-row', n: 3 }] }] } } });
      await seed({ days: halfDay, train: trainSeed() });
      const sumT = () => pg.evaluate(() => ((document.querySelector('.mw-sum-t') || {}).textContent || '').replace(/\s+/g, ' '));
      const carbs = await pg.evaluate((k) => window.__macroLab.dayTargets(k).c, WED);
      const before = await sumT();
      t.ok('a lifting day not yet trained says so, with its carbs: "Lifting day · ' + carbs + ' g carbs"',
        before === 'Lifting day · ' + carbs + ' g carbs', before);
      const st = new Date(2026, 8, 30, 17, 40).getTime();
      await at(2026, 8, 30, 21, 0);
      await seed({ days: halfDay, train: trainSeed({ w1: { id: 'w1', n: 'Full Body A', st, en: st + 2400000, dk: WED,
        x: [{ e: 'db-bench', s: [{ w: 60, r: 8, t: st + 60000 }] }] } }) });
      const after = await sumT();
      t.ok('and once the workout is logged: "Trained ✓ 5:40 pm"', after === 'Trained ✓ 5:40 pm', after);
      await at(2026, 9, 1, 9, 0);
      await seed({ train: trainSeed() });
      const rest = await sumT();
      t.ok('a day off says "Rest day"', rest === 'Rest day', rest);
      const marks = await pg.evaluate(() => [...document.querySelectorAll('.mwk-d')].map((d) =>
        (d.querySelector('.mwk-lift') ? 'L' : '-') + (/lifting day/.test(d.getAttribute('aria-label')) ? 'a' : '-')));
      const liftBox = await pg.evaluate(() => { const r = document.querySelector('.mwk-lift').getBoundingClientRect(); return [r.width, r.height]; });
      t.ok('the week strip marks Monday, Wednesday and Friday with a dumbbell, and says "lifting day" to a listener',
        marks.join() === 'La,--,La,--,La,--,--' && liftBox[0] >= 10, JSON.stringify({ marks, liftBox }));
      t.ok('and the dumbbell sits inside the day\u2019s box, at its foot, not beside the letter',
        await pg.evaluate(() => { const l = document.querySelector('.mwk-lift'); const b = l && l.closest('.mwk-b');
          if (!b || l.closest('.mwk-w')) return false; const r = l.getBoundingClientRect(), br = b.getBoundingClientRect();
          return r.bottom <= br.bottom && r.top > br.top + br.height / 2; }));
      await ctx.close();
    }

    /* ---- look and feel: sizes, the bar's words, quiet by default ---------
     * Blake's decisions for the tab, 2026-09-27: "≥44 px tap targets
     * everywhere (arrows stay in the corner), minimum 13 px text / 15 px
     * body, and darker tinted pre-filled numbers"; "Nourish gets a big
     * '+ Add food' and labelled icons"; "notes only when something changed,
     * as one short line with 'why?' to expand; settings help behind ⓘ"; and
     * one date form, month first, with button words that never break. On a
     * fixed clock, a Wednesday at half past one, as the daily loop is. */
    {
      const ctx = await t.browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      await ctx.route(/api\.nal\.usda\.gov/, (r) => r.abort());
      const pg = await ctx.newPage();
      pg.on('pageerror', (e) => t.ok('no uncaught error on the page', false, e.message));
      await pg.clock.install({ time: new Date(2026, 8, 30, 13, 30, 0) });
      await pg.goto(t.base + 'index.html');
      const WED = '2026-09-30', MON = '2026-09-28';
      const seed = async (o) => {
        await pg.evaluate((o) => {
          const p2 = (n) => (n < 10 ? '0' : '') + n;
          const key = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
          localStorage.clear();
          localStorage.setItem('bsc.hintDone', '1');
          const ws = {};
          for (let i = 0; i <= 6; i++) { const d = new Date(); d.setDate(d.getDate() - i); ws[key(d)] = 212; }
          localStorage.setItem('bsc.macroWeights', JSON.stringify(o.ws || ws));
          localStorage.setItem('bsc.macroProfile', JSON.stringify(Object.assign({ sex: 'm', age: 44, ft: 5, inch: 10,
            lb: 212, act: 1.2, goal: 'cut1', goalLb: 0, goalBy: '', workouts: 3, steps: 6000, train: [0, 2, 4] }, o.pr || {})));
          localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 212, f: 64, c: 77, auto: 1, set: key(new Date()) }));
          if (o.days) localStorage.setItem('bsc.macroDays', JSON.stringify(o.days));
        }, o || {});
        await pg.reload();
        await pg.waitForTimeout(300);
        await pg.click('.tab[data-view="macros"]');
        await pg.waitForTimeout(300);
      };
      const lived = {
        [MON]: { b: [{ id: 'f:egg', x: 2, eaten: 1 }], l: [{ id: 'f:banana', x: 1, eaten: 1 }],
          d: [{ id: 'f:chicken_breast', x: 1, eaten: 1 }, { id: 'f:broccoli', x: 1, eaten: 1 }], s: [{ id: 'f:almonds', x: 1, eaten: 1 }] },
        [WED]: { b: [{ id: 'f:egg', x: 2, eaten: 1 }, { id: 'f:banana', x: 1, eaten: 1 }], l: [{ id: 'f:greek_yogurt', x: 1, eaten: 0 }] },
      };
      await seed({ days: lived });

      /* Every control a thumb wide: its short side at least 44, or — for a
         word inside a line of text — a reach that is, drawn with ::after so
         the words do not move. */
      const small = (scope) => pg.evaluate((scope) => {
        const root = document.querySelector(scope);
        const out = [];
        root.querySelectorAll('button, input:not([type=hidden]), select, summary').forEach((e) => {
          const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
          if (!r.width || !r.height || cs.visibility === 'hidden' || e.closest('[aria-hidden="true"], .hide, [hidden]')) return;
          /* The strip under each plate (bin, lock, portion, keys, tick) is
             34 on a phone, by Blake's call (2026-09-27): "Just make those
             buttons smaller. So the serving box has more room". Its own
             floor is asserted at 320 on a touch phone, near the top of this
             file. The meal's own verbs are that size too, by his call the
             same day: "Just use icons and the box size that is in the
             meal/food card uses." */
          if (e.closest('.mitem-r3, .mslot-acts')) return;
          const af = getComputedStyle(e, '::after');
          const ext = af.content !== 'none' && af.position === 'absolute';
          const short = Math.min(Math.max(r.width, ext ? parseFloat(af.width) || 0 : 0),
            Math.max(r.height, ext ? parseFloat(af.height) || 0 : 0));
          if (short < 43.5) out.push((e.id || e.className || e.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
        });
        return out;
      }, scope);
      await pg.click('#macroOpenAll');
      await pg.waitForTimeout(300);
      const daySmall = await small('#view-macros');
      t.ok('every control on the day is a thumb wide, the plate strip apart', daySmall.length === 0, daySmall.join(' | '));

      /* No type under 13 px on the day, the drawn score in the leaf apart. */
      const tiny = (scope) => pg.evaluate((scope) => {
        const out = [];
        const w = document.createTreeWalker(document.querySelector(scope), NodeFilter.SHOW_TEXT);
        let n;
        while ((n = w.nextNode())) {
          const e = n.parentElement;
          if (!n.textContent.trim() || !e || e.closest('svg, .leaf-n, .leaf-sr, .vis-hidden, [aria-hidden="true"], .hide, [hidden]')) continue;
          const r = e.getBoundingClientRect();
          if (!r.width) continue;
          const fs = parseFloat(getComputedStyle(e).fontSize);
          if (fs < 12.95) out.push(fs + 'px "' + n.textContent.trim().slice(0, 20) + '"');
        }
        return out;
      }, scope);
      const dayTiny = await tiny('#view-macros');
      t.ok('no type on the day is under 13 px', dayTiny.length === 0, dayTiny.slice(0, 8).join(' | '));

      /* The bar: four tools, each its drawing and its word, and Add food the
         big one in the far corner. */
      const bar = await pg.evaluate(() => {
        const tools = [...document.querySelectorAll('.mday-acts .mday-tool')].map((b) => ({
          w: (b.querySelector('.mday-w') || {}).textContent, svg: !!b.querySelector('svg.mday-ic'),
          stroke: b.querySelector('svg') ? getComputedStyle(b.querySelector('svg')).stroke : '' }));
        const add = document.getElementById('macroAdd').getBoundingClientRect();
        const fill = document.getElementById('macroFill').getBoundingClientRect();
        const others = [...document.querySelectorAll('.mday-acts .mday-tool')].map((b) => b.getBoundingClientRect());
        return { tools, addText: document.getElementById('macroAdd').textContent.trim(),
          addH: add.height, addW: add.width, fillW: fill.width,
          biggest: others.every((o) => o.width * o.height < add.width * add.height),
          corner: add.right >= fill.right && add.bottom >= Math.max(...others.map((o) => o.bottom)) };
      });
      t.ok('the bar’s tools each carry their word under a drawn icon: Rebalance, Close all, Sweep, Copy day',
        bar.tools.map((x) => x.w).join() === 'Rebalance,Close all,Sweep,Copy day' && bar.tools.every((x) => x.svg && x.stroke !== 'none'),
        JSON.stringify(bar.tools));
      t.ok('and "+ Add food" is the big one, labelled, in the far corner',
        bar.addText === 'Add food' && bar.addH >= 48 && bar.biggest && bar.corner && bar.addW >= bar.fillW - 1, JSON.stringify(bar));
      await pg.click('#macroOpenAll');
      await pg.waitForTimeout(250);
      t.ok('and the expander says what it will do next: Open all once the day is shut',
        await pg.evaluate(() => document.querySelector('#macroOpenAll .mday-w').textContent === 'Open all'));
      /* Drawn icons, each named aloud. They had a word under the drawing
         too until Blake (2026-09-27): "Just use icons and the box size that
         is in the meal/food card uses." */
      const verbs = await pg.evaluate(() => [...document.querySelectorAll('.mslot-acts button')].map((b) =>
        !!b.querySelector('svg.mday-ic') + ':' + (b.getAttribute('aria-label') || '')));
      t.ok('a meal’s verbs are drawn icons, each named aloud, the plus included',
        verbs.length > 0 && verbs.every((v) => /^true:\S/.test(v)) && verbs.some((v) => /^true:Add food/.test(v)), verbs.join(' | '));

      /* Copy says it copied, and the drawing stays put. */
      const copied = await pg.evaluate(() => {
        navigator.clipboard.writeText = () => Promise.resolve();
        const b = document.getElementById('macroCopy');
        b.click();
        return new Promise((ok) => setTimeout(() => ok({ w: b.querySelector('.mday-w').textContent, svg: !!b.querySelector('svg') }), 50));
      });
      t.ok('Copy day says Copied under its icon, and keeps the icon', copied.w === 'Copied' && copied.svg, JSON.stringify(copied));

      /* The numbers filled in for you: warm, and about 5:1 on the box. */
      await pg.evaluate(() => { const a = document.querySelector('[data-mslot="d"]'); a.scrollIntoView({ block: 'center' }); a.click(); });
      await pg.waitForTimeout(400);
      const ph = await pg.evaluate(() => {
        const inp = document.getElementById('mpFind');
        const cv = document.createElement('canvas'); cv.width = cv.height = 1;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        const rgb = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
        const lum = (c) => { const v = rgb(c).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
        const ps = getComputedStyle(inp, '::placeholder');
        const a = lum(ps.color), b = lum(getComputedStyle(inp).backgroundColor);
        const c = rgb(ps.color);
        return { ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), warm: c[0] > c[2], op: ps.opacity };
      });
      t.ok('pre-filled words in a box read at 4.5:1 or better, warm, at full opacity',
        ph.ratio >= 4.5 && ph.warm && ph.op === '1', JSON.stringify(ph));
      const pickSmall = await small('#modalRoot');
      t.ok('and every control on the food sheet is a thumb wide, the × and the stars too', pickSmall.length === 0, pickSmall.join(' | '));
      const pickTiny = await tiny('#modalRoot');
      t.ok('with no type under 13 px', pickTiny.length === 0, pickTiny.slice(0, 8).join(' | '));
      await pg.goBack();
      await pg.waitForTimeout(300);

      /* One date form, month first; and button words that never break, down
         to a 320-wide phone. */
      const opts = await pg.evaluate(() => [...document.getElementById('macroDaySel').options].map((o) => o.text));
      t.ok('the day box says "Mon, Sep 28", month first, and "Today · Sep 30"',
        opts.indexOf('Mon, Sep 28') >= 0 && opts.indexOf('Today · Sep 30') >= 0 &&
        opts.every((o) => !/\b\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(o)), opts.join(' | '));
      await pg.setViewportSize({ width: 320, height: 700 });
      await pg.selectOption('#macroDaySel', MON);
      await pg.waitForTimeout(400);
      const broken = await pg.evaluate(() => {
        const out = [];
        document.querySelectorAll('#view-macros button').forEach((b) => {
          if (!b.getBoundingClientRect().width || b.closest('.hide, [aria-hidden="true"]')) return;
          const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
          let n;
          while ((n = w.nextNode())) {
            const re = /\S+/g; let m;
            while ((m = re.exec(n.textContent))) {
              const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
              const lines = new Set([...rg.getClientRects()].map((q) => Math.round(q.top)));
              if (lines.size > 1) out.push(m[0]);
            }
          }
        });
        return { out, fill: document.getElementById('macroFill').textContent };
      });
      t.ok('no button breaks a word, "' + broken.fill + '" included, at 320 wide', broken.out.length === 0 &&
        /Complete the day|Mark all complete/.test(broken.fill), JSON.stringify(broken));
      await pg.setViewportSize({ width: 390, height: 844 });
      await pg.click('#macroMore');
      await pg.click('[data-mmore="went"]');
      await pg.waitForTimeout(400);
      const wentT = await pg.evaluate(() => (document.querySelector('.ds-sheet .sheet-name, .ds-sheet h2, .ds-t') || document.querySelector('.ds-sheet')).textContent);
      t.ok('and the day card is titled month first: "Mon, Sep 28"', /Mon, Sep 28/.test(wentT) && !/Monday/.test(wentT), wentT.slice(0, 80));
      await pg.goBack();
      await pg.waitForTimeout(300);

      /* Settings help behind an i: the paragraph is there, shut, and the i
         opens it where it stands. */
      await pg.click('#macroMore');
      await pg.click('[data-mmore="foods"]');
      await pg.waitForTimeout(400);
      const fpShut = await pg.evaluate(() => { const t2 = document.getElementById('mi-fp'); return !!t2 && t2.hidden && !/Tap anything you eat/.test(document.querySelector('.sheet').innerText); });
      await pg.click('[data-minfo="fp"]');
      await pg.waitForTimeout(100);
      const fpOpen = await pg.evaluate(() => ({ shown: /Tap anything you eat/.test(document.querySelector('.sheet').innerText),
        exp: document.querySelector('[data-minfo="fp"]').getAttribute('aria-expanded') }));
      t.ok('the foods sheet keeps its paragraph behind an i, and the i opens it in place', fpShut && fpOpen.shown && fpOpen.exp === 'true',
        JSON.stringify({ fpShut, fpOpen }));
      await pg.click('.sheet-x');
      await pg.waitForTimeout(300);
      await pg.click('#macroMore');
      await pg.click('[data-mmore="plan"]');
      await pg.waitForTimeout(400);
      await pg.click('[data-mtmfold]');
      await pg.waitForTimeout(250);
      const mealsCap = await pg.evaluate(() => ({ shut: !/The kind steers the picker/.test(document.querySelector('.sheet').innerText),
        i: !!document.querySelector('[data-minfo="meals"]') }));
      await pg.click('[data-minfo="meals"]');
      await pg.waitForTimeout(100);
      t.ok('and so does the plan’s meals editor',
        mealsCap.shut && mealsCap.i && await pg.evaluate(() => /The kind steers the picker/.test(document.querySelector('.sheet').innerText)),
        JSON.stringify(mealsCap));
      const planSmall = await small('#modalRoot');
      t.ok('and every control on the plan sheet is a thumb wide', planSmall.length === 0, planSmall.join(' | '));
      await pg.goBack();
      await pg.waitForTimeout(300);

      /* A steady note is news once. On pace, the morning card says the
         target in one line with "why?" for the rest; the next morning, with
         nothing changed, it says nothing; a changed target or verdict brings
         it back. */
      const coachSeed = async () => {
        await pg.evaluate(() => {
          const p2 = (n) => (n < 10 ? '0' : '') + n;
          const key = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
          localStorage.clear();
          localStorage.setItem('bsc.hintDone', '1');
          const ws = {}, jit = [0, 0.3, -0.2, 0.4, -0.3, 0.1, -0.1, 0.2, -0.4, 0.3];
          for (let i = 29; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            ws[key(d)] = Math.round((204 - (1.5 / 7) * (29 - i) + jit[i % 10] * 0.9) * 10) / 10;
          }
          localStorage.setItem('bsc.macroWeights', JSON.stringify(ws));
          const goal = new Date(); goal.setDate(goal.getDate() + 126);
          localStorage.setItem('bsc.macroProfile', JSON.stringify({ sex: 'm', age: 41, ft: 5, inch: 11, lb: 204,
            act: 1.55, goal: 'cut1', goalLb: 175, goalBy: key(goal), workouts: 4, steps: 8000 }));
        });
        await pg.reload();
        await pg.waitForTimeout(300);
        await pg.evaluate(() => {
          const plan = window.__macroLab.plan(window.__macroLab.profile());
          if (plan) localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: plan.p, f: plan.f, c: plan.c }));
        });
        await pg.reload();
        await pg.waitForTimeout(300);
        await pg.click('.tab[data-view="macros"]');
        await pg.waitForTimeout(300);
      };
      const coach = () => pg.evaluate(() => {
        const el = document.querySelector('#macroWeigh .mline.calm');
        if (!el) return null;
        const sub = el.querySelector('.mline-s');
        return { t: el.querySelector('.mline-t').innerText, why: !!el.querySelector('.m-why'),
          subShown: !!sub && !sub.hidden && sub.getClientRects().length > 0 };
      });
      await coachSeed();
      const c1 = await coach();
      t.ok('a steady morning note is one line, its reason behind "why?"',
        !!c1 && c1.why && !c1.subShown && /Your target/.test(c1.t), JSON.stringify(c1));
      await pg.click('#macroWeigh .m-why');
      await pg.waitForTimeout(100);
      const c1b = await coach();
      t.ok('and "why?" opens the reason in place', !!c1b && c1b.subShown, JSON.stringify(c1b));
      await pg.clock.setSystemTime(new Date(2026, 9, 1, 8, 0, 0));
      await pg.reload();
      await pg.waitForTimeout(300);
      await pg.click('.tab[data-view="macros"]');
      await pg.waitForTimeout(300);
      const c2 = await coach();
      t.ok('the next morning, nothing having changed, it says nothing', c2 === null, JSON.stringify(c2));
      await pg.evaluate(() => {
        const s0 = JSON.parse(localStorage.getItem('bsc.macroCoachSeen'));
        s0.sig = 'calm:1:late';
        localStorage.setItem('bsc.macroCoachSeen', JSON.stringify(s0));
      });
      await pg.reload();
      await pg.waitForTimeout(300);
      await pg.click('.tab[data-view="macros"]');
      await pg.waitForTimeout(300);
      const c3 = await coach();
      t.ok('and once what it says has changed, it says it again', !!c3 && /Your target/.test(c3.t), JSON.stringify(c3));
      await pg.clock.setSystemTime(new Date(2026, 8, 30, 13, 30, 0));

      /* The chart's how-to-read-it is behind an i too. */
      await pg.click('[data-mchartopen]');
      await pg.waitForTimeout(300);
      const note = await pg.evaluate(() => {
        const t2 = document.getElementById('mi-mc-weight');
        return { shut: !!t2 && t2.hidden, i: !!document.querySelector('[data-minfo="mc-weight"]') };
      });
      t.ok('and so is what a chart means', note.shut && note.i, JSON.stringify(note));
      await pg.goBack();
      await pg.waitForTimeout(300);
      await ctx.close();
    }

    /* ---- insight: charts to read, meals again, a food by the amount ------
     * Blake's decisions, 2026-09-27: "Readable round-number axes, weight
     * trend line over faint daily dots, 1M/3M/6M/All ranges, tap/drag for
     * values"; "Recents per meal (dinner shows dinner foods), 'Copy from
     * another day' on each meal, and a date picker beyond two weeks"; and
     * "an amount/unit box and an Add button on the food detail screen, plus
     * fibre/sodium and any other nutrients the table has". The same fixed
     * Wednesday at half past one. */
    {
      const ctx = await t.browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      await ctx.route(/api\.nal\.usda\.gov/, (r) => r.abort());
      const pg = await ctx.newPage();
      pg.on('pageerror', (e) => t.ok('no uncaught error on the page', false, e.message));
      await pg.clock.install({ time: new Date(2026, 8, 30, 13, 30, 0) });
      await pg.goto(t.base + 'index.html');
      const WED = '2026-09-30', MON = '2026-09-28', FAR = '2026-08-21', OLD = '2026-05-01';
      const days = {
        [OLD]: { d: [{ id: 'f:potato', x: 1, eaten: 1 }] },
        [FAR]: { d: [{ id: 'f:chicken_breast', x: 1.5, eaten: 1 }, { id: 'f:broccoli', x: 2, eaten: 1 }] },
        [MON]: { b: [{ id: 'f:oats', x: 1, eaten: 1 }, { id: 'f:egg', x: 2, eaten: 1 }],
          d: [{ id: 'f:salmon', x: 1, eaten: 1 }, { id: 'f:rice_cooked', x: 1, eaten: 1 }] },
        '2026-09-29': { b: [{ id: 'f:banana', x: 1, eaten: 1 }, { id: 'f:greek_yogurt', x: 1, eaten: 1 }, { id: 'f:almonds', x: 1, eaten: 1 }] },
        [WED]: { b: [{ id: 'f:egg', x: 3, eaten: 1 }] },
      };
      await pg.evaluate((days) => {
        const p2 = (n) => (n < 10 ? '0' : '') + n;
        const key = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
        localStorage.clear();
        localStorage.setItem('bsc.hintDone', '1');
        /* Five months of mornings, a pound or so of noise around a steady
           loss, and a few missed. */
        const ws = {};
        for (let i = 150; i >= 0; i--) {
          if (i % 11 === 3) continue;
          const d = new Date(); d.setDate(d.getDate() - i);
          ws[key(d)] = Math.round((224 - 15 * (150 - i) / 150 + Math.sin(i * 1.7) * 1.2) * 10) / 10;
        }
        localStorage.setItem('bsc.macroWeights', JSON.stringify(ws));
        const goal = new Date(); goal.setDate(goal.getDate() + 120);
        localStorage.setItem('bsc.macroProfile', JSON.stringify({ sex: 'm', age: 44, ft: 5, inch: 10, lb: 212, act: 1.2,
          goal: 'cut1', goalLb: 195, goalBy: key(goal), workouts: 3, steps: 6000, train: [0, 2, 4] }));
        localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 200, f: 64, c: 180 }));
        localStorage.setItem('bsc.macroDays', JSON.stringify(days));
      }, days);
      await pg.reload();
      await pg.waitForTimeout(300);
      await pg.click('.tab[data-view="macros"]');
      await pg.waitForTimeout(300);
      const stored = (k) => pg.evaluate((k) => (JSON.parse(localStorage.getItem('bsc.macroDays') || '{}')[k]) || null, k);

      /* ---- the weight chart ------------------------------------------- */
      await pg.click('[data-mchartopen]');
      await pg.waitForTimeout(300);
      const chart = () => pg.evaluate(() => {
        const svg = document.querySelector('.mc-svg');
        if (!svg) return null;
        const vb = svg.viewBox.baseVal, w = svg.getBoundingClientRect().width;
        const ticks = [...svg.querySelectorAll('text.mc-ax')].map((x) => x.textContent).filter((x) => /^-?[\d.]+$/.test(x)).map(Number);
        const fs = parseFloat(getComputedStyle(svg.querySelector('text.mc-ax')).fontSize);
        return { days: svg.querySelectorAll('circle.mc-day').length, dots: svg.querySelectorAll('circle:not(.mc-hl)').length,
          line: (svg.querySelector('polyline.mc-line').getAttribute('points') || '').split(' ').length,
          ticks, px: fs * w / vb.width, read: (document.querySelector('.mc-read') || {}).textContent || '',
          rng: [...document.querySelectorAll('[data-mcrng]')].map((b) => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(' ') };
      });
      const all = await chart();
      const step = all.ticks.length > 1 ? all.ticks[1] - all.ticks[0] : 0;
      t.ok('the weight chart draws the seven-day average as its line over a faint dot for every morning',
        all.days > 120 && all.line === all.days && all.dots === all.days, JSON.stringify(all).slice(0, 200));
      t.ok('on a round-number axis: ' + all.ticks.join(', '),
        all.ticks.length >= 3 && [1, 2, 2.5, 5, 10].indexOf(step) >= 0 &&
        all.ticks.every((v) => Math.abs(v / step - Math.round(v / step)) < 1e-6), JSON.stringify(all.ticks));
      t.ok('with its labels at least 12 px on the phone (' + all.px.toFixed(1) + ')', all.px >= 12, String(all.px));
      t.ok('and 1M, 3M, 6M and All above it, All to begin with', all.rng === '1M 3M 6M All*', all.rng);
      t.ok('the line above the chart reads the latest morning and its average',
        /^Latest: Sep 30 · [\d.]+ lb · average [\d.]+$/.test(all.read), all.read);
      await pg.click('[data-mcrng="1m"]');
      await pg.waitForTimeout(200);
      const m1 = await chart();
      t.ok('a month is a month of mornings', m1.days >= 25 && m1.days <= 31 && m1.rng === '1M* 3M 6M All', JSON.stringify(m1).slice(0, 160));
      /* A finger on the chart reads out the morning under it, with a ring
         on the point; dragged, the reading follows. */
      const box = await pg.evaluate(() => { const r = document.querySelector('.mc-svg').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
      await pg.mouse.move(box.x + box.w * 0.3, box.y + box.h / 2);
      await pg.mouse.down();
      const r1 = await pg.evaluate(() => ({ t: document.querySelector('.mc-read').textContent,
        cx: Number(document.querySelector('.mc-hl').getAttribute('cx')) }));
      await pg.mouse.move(box.x + box.w * 0.8, box.y + box.h / 2, { steps: 4 });
      const r2 = await pg.evaluate(() => ({ t: document.querySelector('.mc-read').textContent,
        cx: Number(document.querySelector('.mc-hl').getAttribute('cx')) }));
      await pg.mouse.up();
      t.ok('a finger on the chart reads the morning under it, ringed: "' + r1.t + '"',
        /^(Aug|Sep) \d+ · [\d.]+ lb · average [\d.]+$/.test(r1.t) && r1.cx > 0, JSON.stringify(r1));
      t.ok('and dragging along it follows the finger: "' + r2.t + '"', r2.t !== r1.t && r2.cx > r1.cx, JSON.stringify(r2));
      /* The other three charts read the same way. */
      for (const which of ['off', 'jump', 'rate']) {
        await pg.click('[data-mchart="' + which + '"]');
        await pg.waitForTimeout(200);
        await pg.click('[data-mcrng="all"]');
        await pg.waitForTimeout(200);
        const c = await chart();
        const st2 = c && c.ticks.length > 1 ? Math.round((c.ticks[1] - c.ticks[0]) * 1000) / 1000 : 0;
        const b2 = await pg.evaluate(() => { const r = document.querySelector('.mc-svg').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
        await pg.mouse.click(b2.x + b2.w * 0.5, b2.y + b2.h / 2);
        const rd = await pg.evaluate(() => document.querySelector('.mc-read').textContent);
        t.ok('the ' + which + ' chart too: round ticks, readable labels, a reading under the finger ("' + rd + '")',
          !!c && c.px >= 12 && c.ticks.length >= 3 && /^(0\.1|0\.2|0\.25|0\.5|1|2|2\.5|5)$/.test(String(st2)) &&
          /^(Apr|May|Jun|Jul|Aug|Sep) \d+ · .+ lb/.test(rd), JSON.stringify({ c, st2, rd }).slice(0, 240));
      }
      await pg.goBack();
      await pg.waitForTimeout(300);

      /* ---- this meal's recents first ---------------------------------- */
      const recent = () => pg.evaluate(() => {
        const out = []; let on = false;
        [...document.querySelectorAll('#mpList > *')].forEach((el) => {
          if (el.classList.contains('mt-div')) { on = /^Recent/.test(el.textContent); return; }
          const b = on && el.querySelector('.mpick-row[data-mpick]');
          if (b) out.push(b.dataset.mpick);
        });
        return out;
      });
      const openAdd = async (sk) => {
        await pg.evaluate((sk) => {
          const b = document.querySelector('#macroSlots [data-mfold="' + sk + '"][aria-expanded="false"]');
          if (b) b.click();
        }, sk);
        await pg.waitForTimeout(150);
        await pg.evaluate((sk) => { const a = document.querySelector('[data-mslot="' + sk + '"]'); a.scrollIntoView({ block: 'center' }); a.click(); }, sk);
        await pg.waitForTimeout(400);
      };
      await openAdd('d');
      const dinnerRecent = await recent();
      t.ok('adding to dinner, the recent list opens on what you had at dinner: salmon and rice first',
        dinnerRecent[0] === 'f:salmon' && dinnerRecent[1] === 'f:rice_cooked', dinnerRecent.join(' '));
      await pg.goBack();
      await pg.waitForTimeout(300);
      await openAdd('b');
      const bRecent = await recent();
      t.ok('and adding to breakfast, on what you had at breakfast',
        ['f:banana', 'f:greek_yogurt', 'f:almonds'].every((id, i) => bRecent[i] === id), bRecent.join(' '));
      await pg.goBack();
      await pg.waitForTimeout(300);

      /* ---- a meal from another day, and further back than a fortnight --- */
      await pg.evaluate(() => {
        const b = document.querySelector('#macroSlots [data-mfold="d"][aria-expanded="false"]');
        if (b) b.click();
      });
      await pg.waitForTimeout(150);
      await pg.evaluate(() => { const b = document.querySelector('[data-mfrom="d"]'); b.scrollIntoView({ block: 'center' }); b.click(); });
      await pg.waitForTimeout(400);
      const sheet = await pg.evaluate(() => ({
        days: [...document.querySelectorAll('.mcf-day .mcf-d')].map((x) => x.textContent),
        box: !!document.getElementById('mcfDate'), min: (document.getElementById('mcfDate') || {}).min }));
      t.ok('each meal has "From another day": the latest days it had food, newest first, and a date box',
        sheet.days[0] === 'Mon, Sep 28' && sheet.days.indexOf('Fri, Aug 21') > 0 && sheet.box, JSON.stringify(sheet));
      t.ok('and the date box reaches back four months, not two weeks', sheet.min === '2026-06-03', sheet.min);
      await pg.fill('#mcfDate', FAR);
      await pg.dispatchEvent('#mcfDate', 'change');
      await pg.waitForTimeout(300);
      const farCard = await pg.evaluate(() => { const c = document.querySelector('.mcf-day'); return c ? c.innerText.replace(/\s+/g, ' ') : ''; });
      t.ok('a day picked in the box shows that day’s dinner', /Fri, Aug 21/.test(farCard) && /Chicken/i.test(farCard) && /Add all 2/.test(farCard), farCard);
      await pg.click('.mcf-day [data-mcopy="' + FAR + '"]');
      await pg.waitForTimeout(400);
      const dWed = await stored(WED);
      t.ok('one tap puts it on this dinner at the amounts it was, planned, since dinner is still to come',
        !!dWed && JSON.stringify((dWed.d || []).map((it) => [it.id, it.x, it.eaten])) === JSON.stringify([['f:chicken_breast', 1.5, 0], ['f:broccoli', 2, 0]]),
        JSON.stringify(dWed));
      t.ok('and the day it came from is still there after the write: a month back is kept now',
        !!(await stored(FAR)) && !(await stored(OLD)), JSON.stringify([await stored(FAR), await stored(OLD)]));
      /* Copied to a meal whose time has come, what lands on it is still a plan. */
      await pg.evaluate(() => {
        const b = document.querySelector('#macroSlots [data-mfold="b"][aria-expanded="false"]');
        if (b) b.click();
      });
      await pg.waitForTimeout(200);
      await pg.evaluate(() => { const b = document.querySelector('[data-mfrom="b"]'); b.scrollIntoView({ block: 'center' }); b.click(); });
      await pg.waitForTimeout(300);
      await pg.click('[data-mcopy="' + MON + '"]');
      await pg.waitForTimeout(400);
      const after = (await stored(WED)).b || [];
      t.ok('copied to a meal whose time has come, it arrives planned',
        after.length === 3 && after.filter((it) => it.id === 'f:oats').every((it) => it.eaten === 0) &&
          after[after.length - 1].eaten === 0, JSON.stringify(after));

      /* The day box: the fortnight, then any day by date. */
      const selOpts = await pg.evaluate(() => [...document.getElementById('macroDaySel').options].map((o) => o.value));
      t.ok('the day box keeps its three weeks and ends on "Earlier day…"',
        selOpts.length === 22 && selOpts[selOpts.length - 1] === 'pick', selOpts.slice(-3).join(' '));
      await pg.selectOption('#macroDaySel', 'pick');
      await pg.waitForTimeout(200);
      const pickOpen = await pg.evaluate(() => !document.querySelector('.mday-pick').classList.contains('hide'));
      await pg.fill('#macroDayPick', FAR);
      await pg.dispatchEvent('#macroDayPick', 'change');
      await pg.waitForTimeout(400);
      const onFar = await pg.evaluate(() => ({ sel: document.getElementById('macroDaySel').value,
        text: document.getElementById('macroDaySel').selectedOptions[0].text,
        shut: document.querySelector('.mday-pick').classList.contains('hide'),
        plates: [...document.querySelectorAll('#macroSlots .mthin-n, #macroSlots .mitem-name')].map((x) => x.textContent) }));
      t.ok('"Earlier day…" opens a date box, and a date six weeks back goes there',
        pickOpen && onFar.sel === FAR && onFar.text === 'Fri, Aug 21' && onFar.shut && onFar.plates.some((x) => /Chicken/i.test(x)),
        JSON.stringify(onFar));
      await pg.click('#macroPrev');
      await pg.waitForTimeout(300);
      t.ok('and the arrow walks on back from there', await pg.evaluate(() => document.getElementById('macroDaySel').value) === '2026-08-20');
      await pg.selectOption('#macroDaySel', WED);
      await pg.waitForTimeout(300);

      /* ---- the food sheet: an amount, its units, Add, every nutrient ---- */
      await pg.evaluate(() => {
        const b = document.querySelector('#macroSlots [data-mfold="b"][aria-expanded="false"]');
        if (b) b.click();
      });
      await pg.waitForTimeout(150);
      await pg.evaluate(() => { const a = document.querySelector('#macroSlots [data-mfood="f:egg"]'); a.scrollIntoView({ block: 'center' }); a.click(); });
      await pg.waitForTimeout(400);
      const fs1 = await pg.evaluate(() => ({
        amt: document.getElementById('mfsAmt').value,
        units: [...(document.getElementById('mfsUnit') || { options: [] }).options].map((o) => o.text),
        add: (document.getElementById('mfsAdd') || {}).textContent,
        nutr: [...document.querySelectorAll('.mfs-nr span')].map((x) => x.textContent) }));
      t.ok('the food sheet has an amount box, starting at what you had last time (3 whole), with its units',
        fs1.amt === '3' && fs1.units[0] === 'whole' && fs1.units.indexOf('g') > 0 && fs1.units.indexOf('cup') > 0, JSON.stringify(fs1));
      t.ok('and lists calories, protein, fat, carbs, fibre and sodium for that amount',
        fs1.nutr.join() === 'Calories,Protein,Fat,Carbs,Fibre,Sodium', fs1.nutr.join());
      t.ok('and an Add button for the meal it was opened from', fs1.add === 'Add to Breakfast', fs1.add);
      await pg.selectOption('#mfsUnit', { label: 'g' });
      await pg.waitForTimeout(250);
      t.ok('the same eggs said in grams: 150', await pg.evaluate(() => document.getElementById('mfsAmt').value) === '150');
      await pg.fill('#mfsAmt', '100');
      await pg.waitForTimeout(150);
      const kc = await pg.evaluate(() => document.querySelector('.mfs-nr b').textContent);
      t.ok('typing an amount moves the numbers under it (100 g of egg: ' + kc + ' kcal)', /^1[34]\d$/.test(kc), kc);
      await pg.click('#mfsAdd');
      await pg.waitForTimeout(400);
      const bAfter = (await stored(WED)).b || [];
      const added = bAfter[bAfter.length - 1];
      t.ok('Add puts it on breakfast at that amount, planned until ticked',
        bAfter.length === 4 && added.id === 'f:egg' && Math.abs(added.x - 2) < 0.001 && added.eaten === 0,
        JSON.stringify(bAfter));
      await ctx.close();
    }
  },
});
