/* Adding from the bar, the three foods that close a meal, the meal's four
 * gauges, controls that belong together and controls that do nothing, one
 * query rather than two, what closes the day on arrival, the box that
 * answers a number, and Look up. The last two use comboAt, set up with the
 * closing foods, so they sit in this file after them, in their original
 * order.
 *
 * Part of the Nourish suite, split out of tests/macros.test.js: the page
 * helpers and the plan every page starts with are in tests/fixtures/nourish.js. */
const { nourish, addOn, asPlanned, openBasket, pickerList } = require('./fixtures/nourish.js');

module.exports = nourish({
  name: 'Macros — the picker: the bar, closing a meal, a typed number, Look up',
  async suite(t) {
    /* ---- adding from the bar, balancing, and keeping --------------------- */
    const bar = await t.fresh();
    await bar.click('.tab[data-view="macros"]');
    await bar.waitForTimeout(200);
    /* Two rows since the tools took their words (2026-09-27): the four
       tools, then Fill and Add food. Still one bar, and it still leaves the
       day most of the screen. */
    t.ok('everything you do to today is in the bar, in two rows',
      await bar.evaluate(() => {
        const b2 = [...document.querySelectorAll('.mday-acts button')]
          .filter((x) => !x.classList.contains('hide')).map((x) => x.id);
        const rows = new Set([...document.querySelectorAll('.mday-acts button')]
          .map((x) => Math.round(x.getBoundingClientRect().top)));
        return b2.indexOf('macroAdd') >= 0 && b2.indexOf('macroRebal') >= 0 && rows.size === 2 &&
          document.querySelector('.mday-acts').getBoundingClientRect().height < 120;
      }), await bar.evaluate(() => Math.round(document.querySelector('.mday-acts').getBoundingClientRect().height) + 'px'));
    /* The gear keeps the title row; opening every meal went down to the bar.
       It is a thing you do WHILE reading the day, with the thumb already at
       the bottom of the screen — Blake: "the auto expander button at the very
       top, I think I want to move to the bottom rail." The gear stays up
       there because setting the day up is not something you do mid-scroll. */
    t.ok('the gear keeps the title row and the expander went to the bar',
      await bar.evaluate(() => {
        const head = document.querySelector('.mday-head');
        const acts = document.querySelector('.mday-acts');
        const all = document.getElementById('macroOpenAll'), gear = document.getElementById('macroMore');
        if (!head.contains(gear) || !acts.contains(all)) return false;
        const h = head.getBoundingClientRect(), g = gear.getBoundingClientRect();
        return g.left > document.getElementById('macroNext').getBoundingClientRect().right &&
          h.right - g.right < 24;
      }), await bar.evaluate(() =>
        'gear in head ' + document.querySelector('.mday-head').contains(document.getElementById('macroMore')) +
        ' / expander in bar ' + document.querySelector('.mday-acts').contains(document.getElementById('macroOpenAll'))));
    /* The bar's barcode button has gone — it opened the same sheet the plus
       opens, one step further in, and that sheet carries a camera in its own
       search field. Blake: "the plus button and the scanner button are the
       same thing. In both cases I should be able to open up and scan
       something right away." So the claim is now about the sheet: one door,
       and the lens inside it. */
    t.ok('the bar has no second door to the same sheet',
      await bar.evaluate(() => !document.getElementById('macroScan')));

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
    await asPlanned(bar, 'd');
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
        const pr = { sex: 'm', age: 41, ft: 5, inch: 11, lb: 204, act: 1.55, goal: 'cut1',
          goalLb: 175, goalBy: key(g), workouts: 4, steps: 8000 };
        localStorage.setItem('bsc.macroProfile', JSON.stringify(pr));
        /* The plan this profile actually asks for, written down rather than
           left to the suite's 180/50/50 placeholder. That placeholder used to
           be rewritten on read, because 1,370 fell under the old 1,500 floor
           for a man — so this fixture has always run against the profile's
           real plan, by accident. With the floor at the clinical 1,200 the
           placeholder stands, the meal's gaps shrink, and a band that offers
           one food per OPEN macro correctly offered two. State the plan. */
        const plan = window.__macroLab.plan(pr);
        localStorage.setItem('bsc.macroTargets',
          JSON.stringify({ p: plan.p, f: plan.f, c: plan.c }));
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

    /* Two rules, and this pins the second one.
     *
       A food may now carry `meals`, which GATES the meals it can be offered
       at unasked -- canned tuna is not breakfast, and no amount of protein
       per calorie was ever going to work that out. See tools/food-db.js. What
       ORDERS the foods that pass that gate is still, and only, what you have
       put in THIS meal before. Slots are still yours to name: a meal you made
       yourself has no kind to judge against and is never gated at all.
     *
       Whey rather than egg whites, which this used to seed with. Egg whites
       are the purest protein the breakfast gate admits, so they now open the
       band on their own and the assertion could no longer tell history from
       the default -- it passed against itself. The seed has to be a food the
       ordering must MOVE, and it also has to clear MLEV_PURE or it is not on
       the bench to be moved: cottage cheese reads like a breakfast protein
       and is 52% of its calories, so it never appears at all.
       The control above shares every other condition, so a failure here is
       the history and nothing else. */
    /* Read off the bench, not the rendered rows. A food you ate yesterday is
       claimed by "Recent" and deduped out of the closers band, so the DOM
       stopped being able to show which rung it opened — which is a rendering
       fact, and this assertion is about the rule. */
    const histPage = await comboAt({ hist: ['f:whey', 'f:salsa'] });
    const withHist = await histPage.evaluate(() =>
      (window.__macroLab.closers() || []).map((c) => c.name));
    t.ok('a week of whey at breakfast puts whey at the top of it',
      withHist[0] === 'Whey protein' && noHistLevers[0] !== 'Whey protein',
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
          /* A meal with nothing on it prints its TARGET where a fed one
             prints its plate, so the strip says which end it is speaking
             from. NOT `.empty` — that is a global utility class carrying
             60px of padding, and wearing it grew every blank meal's header
             from 38px to 156. */
          blank: !!gg && gg.classList.contains('mmps-blank'),
          /* Every figure's resolved colour, so "quiet" can be asserted
             against a real reference rather than against whatever colour
             some other meal happens to be wearing. */
          inks: gg ? [...gg.querySelectorAll('.mmp-v')]
            .map((v) => getComputedStyle(v).color) : [],
          bars: gg ? [...gg.querySelectorAll('.mmp')].map((o) => ({
            l: o.querySelector('i').textContent + o.querySelector('.mmp-v').textContent,
            v: Number(o.querySelector('.mmp-v').textContent),
            st: (o.className.match(/mmp(?: kc)? (\w+)/) || [, ''])[1],
            /* The fill is the rail under the figure. It used to be painted
               as a gradient stop on the pill itself and read off the paint;
               it is a width on a real element now, which is the same number
               in the place an eye can also see it. */
            fill: parseFloat(((o.querySelector('.mmp-tr i') || {}).style || {}).width || 0),
            tick: parseFloat(o.dataset.want || 0),
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

    /* The target lives in two places now and must not drift. It came off the
       glyph — 7.5px at 55% opacity was not a comparison, it was a rumour —
       and landed in two: data-want, for anything mechanical, and the head's
       own aria-label, in words, which is the first time this strip has been
       readable to a screen reader at all. Two spellings of one fact is how
       facts diverge, so the suite reads both and insists they agree. */
    t.ok('and what the pills claim is what the head says out loud',
      await gaugePage.evaluate(() => {
        const heads = [...document.querySelectorAll('#macroSlots .mslot-head')]
          .filter((h) => h.querySelector('.mmp[data-want]'));
        if (!heads.length) return false;
        return heads.every((head) => {
          const said = head.getAttribute('aria-label') || '';
          return [...head.querySelectorAll('.mmp[data-want]')].every((pl) => {
            const got = (pl.querySelector('.mmp-v') || {}).textContent.trim();
            return said.indexOf(got + ' of ' + pl.dataset.want) >= 0;
          });
        });
      }),
      await gaugePage.evaluate(() => {
        const head = document.querySelector('#macroSlots .mslot-head');
        if (!head) return 'no head';
        return (head.getAttribute('aria-label') || '') + ' || pills ' +
          [...head.querySelectorAll('.mmp[data-want]')].map((pl) =>
            (pl.querySelector('.mmp-v') || {}).textContent.trim() + '/' + pl.dataset.want).join(' ');
      }));

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

    /* Reversed twice, and this is the second one.
     *
       It first asserted that an empty meal draws NO tracks — "four at zero
       times five meals is what the morning would open on". Blake asked for
       the opposite: the meal you have not filled is precisely the one you
       need the numbers for. So it drew four pills, faded, all reading 0.

       And that was still not the number. The target lived in the LENGTH of
       the rail, which says nothing when the fill is nought, and in data-want
       and a screen-reader sentence — every audience but the one holding the
       phone. Blake, on his own breakfast: "I can't see what my target macros
       are from the main screen. I simply want this breakfast to show a
       greyed out target number instead of zeros."

       So a blank meal PRINTS what it is for. Mutation-proof by construction:
       print `got` there instead of `want` and every figure goes to nought
       while data-want does not, and the first clause fails. */
    t.ok('a meal with nothing on it prints its target, not four noughts',
      noFood.length > 0 && noFood.every((c) => c.blank && c.bars.length === 4 &&
        c.bars.every((g) => g.tick > 0 && g.v === g.tick)),
      JSON.stringify(noFood.map((c) => c.name + ' ' +
        c.bars.map((g) => g.v + '/' + g.tick).join(' '))));

    /* And a fed meal still prints the plate. Without this the one above is
       satisfied by printing the target everywhere, which would be the same
       screen with the other number missing. */
    t.ok('while a meal with food on it still prints the food',
      fed.length > 0 && fed.some((c) => c.bars.some((g) => g.v !== g.tick)),
      JSON.stringify(fed.map((c) => c.name + ' ' +
        c.bars.map((g) => g.v + '/' + g.tick).join(' '))));

    /* Quiet, still. A blank meal wears no verdict colour: six untouched
       meals would otherwise draw twenty-four ochre "short" marks first thing
       in the morning, about food the day has not got to yet. The colour
       arrives with the food, which is when it starts meaning something. */
    /* Resolved through the same engine the pills are, so the comparison is
       between two colours and not between two spellings of one. */
    const greyRef = await gaugePage.evaluate(() => {
      const el = document.createElement('span');
      el.style.color = 'var(--muted)';
      document.body.appendChild(el);
      const c = getComputedStyle(el).color;
      el.remove();
      return c;
    });
    t.ok('and it reads quietly — every figure the same grey, no verdict',
      noFood.length > 0 && noFood.every((c) => c.inks.length === 4 &&
        c.inks.every((x) => x === greyRef)),
      JSON.stringify({ grey: greyRef, blank: noFood.map((c) => c.name + ':' + c.inks.join('|')) }));

    /* ...and the colour does arrive with the food, or the rule above is
       satisfied by painting the whole strip grey for ever. */
    t.ok('while a fed meal wears its verdict in colour',
      fed.length > 0 && fed.some((c) => c.inks.some((x) => x !== greyRef)),
      JSON.stringify(fed.map((c) => c.name + ':' + c.inks.join('|'))));

    /* The header does not grow to make room for it. This is the whole reason
       the figure went INTO the pill rather than beside it or under it: at 390
       the four groups fit exactly as they are, and a blank meal's row is the
       same height as a fed one's. */
    t.ok('and a blank meal is the same height as a fed one',
      await gaugePage.evaluate(() => {
        const hs = [...document.querySelectorAll('.mslot')]
          .filter((s2) => s2.querySelector('.mmps'))
          .map((s2) => Math.round(s2.querySelector('.mslot-h').getBoundingClientRect().height));
        return hs.length > 1 && Math.max.apply(null, hs) === Math.min.apply(null, hs);
      }),
      await gaugePage.evaluate(() => [...document.querySelectorAll('.mslot')]
        .filter((s2) => s2.querySelector('.mmps'))
        .map((s2) => ((s2.querySelector('.mslot-name') || {}).textContent || '').trim() + ':' +
          Math.round(s2.querySelector('.mslot-h').getBoundingClientRect().height)).join(' ')));

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

    /* 34, not the 44 the rest of the app holds. Blake, off the built row:
       "Smaller buttons. A but less space between buttons. Wider serving box"
       — and a plate is the one surface where that trade is affordable,
       because every control on it repeats something reachable at full size
       somewhere else: the bin and the lock in the recipe, the portion by
       typing it, the tick by the meal's own. 34 clears the 24px floor with
       room, and the figure is asserted as a FLOOR so the next design pass
       can go up but not quietly back to nothing. */
    const targets44 = await tinyPhone.evaluate(() => {
      /* Every control the plate has, wherever the layout has most recently
         put it: the verbs on the name row and the strip, the two stepper
         keys, the portion box and the tick. A selector that no longer
         matches is a size rule with nothing to check, and this one has been
         re-pointed twice now — so it names ALL of them rather than the two
         that happened to be interesting the day it was written. */
      const els = [...document.querySelectorAll(
        '.mitem-r1 .mic, .mitem-r3 .mic, .mstep button[data-mstep], ' +
        '.mitem-r3 .mitem-amt, .mitem-ate')];
      const small = els.map((e) => {
        const b = e.getBoundingClientRect();
        return { w: Math.round(b.width), h: Math.round(b.height),
          what: e.className.split(' ')[0] || e.tagName };
      }).filter((x) => x.w < 34 || x.h < 34);
      return { n: els.length, small: small };
    });
    t.ok('every control on a plate is a thumb wide at the narrowest phone',
      targets44.n >= 4 && targets44.small.length === 0,
      JSON.stringify(targets44));

    /* One line, and the tick clear of the + key. With the strip at 44 and
       the dial allowed to shrink below what it holds (min-width: 0), a 360
       phone drew the tick over the last 15px of +, and a thumb on the edge
       of + ticked the plate eaten (2026-09-27). Blake: "Just make those
       buttons smaller. So the serving box has more room". Asserted at 320,
       the tightest the strip has to fit, on every plate, the long yield noun
       included. */
    const strip320 = await tinyPhone.evaluate(() => [...document.querySelectorAll('#macroSlots .mitem-r3')].map((r) => {
      const R = (e) => e.getBoundingClientRect();
      const keys = r.querySelectorAll('.mstep-keys button');
      const plus = keys[keys.length - 1], ate = r.querySelector('.mitem-ate'), bin = r.querySelector('.mic');
      if (!plus || !ate || !bin) return { missing: true };
      const sameLine = Math.abs(R(ate).top - R(bin).top) < 3;
      return { sameLine, clear: !sameLine || R(ate).left >= R(plus).right,
        gap: Math.round(R(ate).left - R(plus).right), amt: Math.round(R(r.querySelector('.mitem-amt')).width) };
    }));
    t.ok('a plate\u2019s strip fits one line at 320, the tick clear of the + key',
      strip320.length >= 2 && strip320.every((x) => !x.missing && x.sameLine && x.clear),
      JSON.stringify(strip320));

    /* And the meal's own verbs, drawn without words. At 320 a fifth of the
       row was narrower than "Another", which came out as "Anot..."; Blake
       (2026-09-27): "Just show icons", and then icons everywhere, in a plate
       key's box. Each still has a name a screen reader can say. */
    const verbs320 = await tinyPhone.evaluate(() => {
      const row = document.querySelector('#macroSlots .mslot-acts');
      if (!row) return null;
      const bs = [...row.querySelectorAll('button')];
      return {
        n: bs.length,
        rows: new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top))).size,
        worded: bs.filter((b) => { const w = b.querySelector('span'); return w && w.getBoundingClientRect().width > 0; }).length,
        drawn: bs.filter((b) => { const g = b.querySelector('svg'); return g && g.getBoundingClientRect().width > 0; }).length,
        unnamed: bs.filter((b) => !/\w/.test(b.getAttribute('aria-label') || '')).map((b) => b.className),
      };
    });
    t.ok('at 320 a meal\u2019s verbs are drawings on one row, each named aloud',
      !!verbs320 && verbs320.n >= 4 && verbs320.rows === 1 && verbs320.worded === 0 &&
        verbs320.drawn === verbs320.n && verbs320.unnamed.length === 0,
      JSON.stringify(verbs320));

    /* ...and the glyph inside it is the size it is meant to be.
     *
       Blake asked for smaller icons and the commit that delivered them
       changed nothing on a phone: a second copy of the rule survived from
       the two-row plate, a bulk selector rename pointed it at the new row,
       and being further down the stylesheet it won. The change shipped, the
       tests passed, and the icons were the same size — which is the worst
       way for a change to fail, because nothing anywhere says so.
     *
       Asserted as a CEILING rather than an exact figure: the size is a
       design call and will move again. What must not happen is a second rule
       quietly setting it somewhere else. */
    t.ok('and the glyph inside it is the size the plate asks for, not a leftover',
      await tinyPhone.evaluate(() => {
        const g = [...document.querySelectorAll('.mitem-r1 .mic svg, .mitem-r3 .mic svg')];
        return g.length >= 3 && g.every((e) => Math.round(e.getBoundingClientRect().width) <= 18);
      }),
      await tinyPhone.evaluate(() => [...new Set(
        [...document.querySelectorAll('.mitem-r1 .mic svg, .mitem-r3 .mic svg')]
          .map((e) => Math.round(e.getBoundingClientRect().width)))].join(', ')));

    /* The star reaches everything a plate can hold.
     *
       Blake, on a breakfast of it: "I am not seeing a star on Greek yogurt.
       Why?" The control asked whether the thing was a recipe, so it was
       drawn for half of what a plate can carry and skipped the half he adds
       most — a food out of the reference table. Nothing was stopping it;
       Store.toggleFav takes an id and keeps a list of them.
     *
       The plate here holds `f:whey`, which is exactly that kind of food. */
    const foodStar = await tinyPhone.evaluate(() =>
      !!document.querySelector('.mitem [data-mfav="f:whey"]'));
    t.ok('a food from the table wears a star, the same as a recipe', foodStar);
    if (foodStar) {
      await tinyPhone.click('.mitem [data-mfav="f:whey"]');
      await tinyPhone.waitForTimeout(250);
      t.ok('and tapping it keeps the food',
        await tinyPhone.evaluate(() => window.Store.isFav('f:whey') === true &&
          document.querySelector('.mitem [data-mfav="f:whey"]')
            .getAttribute('aria-pressed') === 'true'));
      /* Put it back, so the rows below are measured on the same plate the
         rows above were. */
      await tinyPhone.click('.mitem [data-mfav="f:whey"]');
      await tinyPhone.waitForTimeout(250);
    }

    /* And the row still fits — targets that overflow are not a fix. */
    t.ok('and the row still fits without scrolling sideways',
      await tinyPhone.evaluate(() =>
        [...document.querySelectorAll('.mitem-r2')].every((e) => e.scrollWidth <= e.clientWidth + 1) &&
        document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    /* "A portion either fits or gets its own row; it never gets clipped" —
       the rule this file has stated twice and enforced neither time. It was
       false here: the 380px block gave the dial `flex: 1 1 100%` and the 54%
       cap three hundred lines up quietly outranked it, so the dial took a
       whole line and was squeezed onto half of it. Measured at 320, "1
       serving" wanted 58px of text, got 46, and reached the screen as "1
       servin". A portion that silently loses its last letters is the app
       misreporting what you ate, which is the one thing this tab is for. */
    t.ok('and no portion on it is clipped, on the narrowest phone there is',
      await tinyPhone.evaluate(() =>
        [...document.querySelectorAll('#macroSlots .mstep-x')].length > 0 &&
        [...document.querySelectorAll('#macroSlots .mstep-x')].every((e) =>
          e.scrollWidth <= e.clientWidth + 1 && e.scrollHeight <= e.clientHeight + 1)),
      await tinyPhone.evaluate(() =>
        [...document.querySelectorAll('#macroSlots .mstep-x')].map((e) =>
          JSON.stringify(e.textContent.trim()) + ' box ' + Math.round(e.clientWidth) + 'x' +
          Math.round(e.clientHeight) + ' needs ' + e.scrollWidth + 'x' + e.scrollHeight).join(' | ')));
    await tinyPhone.context().close();

    /* ---- and the spacing says which controls belong together -------------
     * The stylesheet has claimed "two groups, and air between them" since the
     * chrome came off this row, and for a while it was not true: measured at
     * 390, the white between the three glyphs was 29px and the white between
     * the dial and the first of them was 24. The gap INSIDE the group was
     * wider than the gap AROUND it, so proximity argued against the grouping
     * and the row read as five scattered things. Blake, off his own phone:
     * "work on the spacing of the buttons".
     *
     * Measured rather than read off the CSS, because the gap is not in the
     * CSS: it is 44 minus the glyph, and the glyph is set three rules away.
     * That is exactly why nothing here caught it the first time. */
    const spacePhone = await t.fresh({ viewport: { width: 390, height: 900 }, hasTouch: true, isMobile: true });
    await spacePhone.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: 'f:whey', x: 1, eaten: 0 }], l: [], d: [], s: [] } }));
    });
    await spacePhone.reload();
    await spacePhone.waitForTimeout(400);
    await spacePhone.click('.tab[data-view="macros"]');
    await spacePhone.waitForTimeout(300);
    await spacePhone.click('[data-mfold="b"]');
    await spacePhone.waitForTimeout(300);
    const spacing = await spacePhone.evaluate(() => {
      const row = document.querySelector('#macroSlots .mitem-r3');
      if (!row) return null;
      const dial = row.querySelector('.mstep');
      /* The verbs are a group of their own at the HEAD of the strip now —
         bin and lock. `.mitem-acts2` held three of them at the far end when
         the plate was two rows; pin went up to the name row with the star
         when it became three bands. */
      const acts = row.querySelector('.mitem-verbs');
      if (!dial || !acts) return null;
      /* One line only. Wrapped — which is what a narrow phone does — the
         group is on a row of its own and proximity is settled by the line
         break instead. */
      if (Math.abs(dial.getBoundingClientRect().top -
        acts.getBoundingClientRect().top) > 2) return { wrapped: true };
      /* Measured on the boxes since the pair became boxes (2026-09-27): the
         edge the eye sees is the button's now, not the drawing inside it. */
      const g = [...acts.querySelectorAll('.mic')].map((e) => e.getBoundingClientRect());
      if (g.length < 2) return null;
      const within = Math.round(g[1].left - g[0].right);
      /* The air AFTER the group, since the group leads the strip now. */
      const between = Math.round(dial.getBoundingClientRect().left - g[1].right);
      return { within, between, box: Math.round(g[0].width) };
    });
    /* Two verbs must sit closer together than one of them is a TARGET wide —
       they are neighbours, not a scattered row.
     *
       It used to be measured against the glyph, and that was a rule the
       glyph had to be inflated to satisfy: a 44px target with a 16px icon
       has 28px of its own padding, so "gap smaller than the icon" forces the
       icon to at least 22 whatever it looks like. It was 24 for exactly that
       reason until Blake said "the icons in the new meal tabs can be
       smaller", which is his call to make and not an arithmetic one. The
       grouping is still asserted, and by the pair of rules that actually
       carry it: adjacent (this) and closer to each other than to the next
       group (below). */
    t.ok('two verbs sit within a target of each other, not scattered',
      !!spacing && (spacing.wrapped || spacing.within <= 44),
      JSON.stringify(spacing));
    /* And, on this day, the grouping still reads the way round it claims. */
    t.ok('and the air inside the group is less than the air around it',
      !!spacing && (spacing.wrapped || spacing.within < spacing.between),
      JSON.stringify(spacing));
    /* The other half of the same bargain: the boxes are the plate's size, not
       a smaller one bought to win the spacing argument. 34 is Blake's call —
       "Smaller buttons. A but less space between buttons" — and the floor is
       asserted here so the NEXT spacing problem cannot be solved by shrinking
       a target again, which is how the glyph got to 24 the first time. */
    t.ok('and it bought that without shrinking a single target',
      await spacePhone.evaluate(() => [...document.querySelectorAll('#macroSlots .mitem-r1 .mic, #macroSlots .mitem-r3 .mic')]
        .every((e) => { const b = e.getBoundingClientRect();
          return Math.round(b.width) >= 34 && Math.round(b.height) >= 34; })),
      await spacePhone.evaluate(() => [...document.querySelectorAll('#macroSlots .mitem-r1 .mic, #macroSlots .mitem-r3 .mic')]
        .map((e) => { const b = e.getBoundingClientRect();
          return Math.round(b.width) + 'x' + Math.round(b.height); }).join(' ')));
    await spacePhone.context().close();

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
          const c = el.querySelector('[data-mpfit]');
          if (b) out.push({ id: b.dataset.mpick, x: Number(b.dataset.mpx), fit: c ? Number(c.dataset.mpx) : null });
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

    /* The portions are still solved — but offered beside the row, not as it.
       Blake: "Default to what you had last time (else 1 serving); 'fits the
       meal' becomes a one-tap chip beside it." So the row arrives at what you
       have, and the chip at what the fit engine worked out. */
    const fitRank = await fitsPg.evaluate(() => {
      const o = {}; window.__macroLab.rank('b', 60).forEach((e) => { o[String(e.id)] = e.x; }); return o;
    });
    t.ok('and every row arrives at what you have, with the fitted portion on a chip beside it',
      fits.fits.length > 0 && fits.fits.every((e) => e.x > 0) &&
      fits.fits.some((e) => e.fit && e.fit !== e.x) &&
      fits.fits.every((e) => e.fit === null || Math.abs(e.fit - fitRank[e.id]) < 1e-6),
      JSON.stringify(fits.fits.map((e) => [e.x, e.fit, fitRank[e.id]])));

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
  },
});
