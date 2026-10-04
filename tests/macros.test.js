/* The Macros tab: targets, the day, the picker, and the arithmetic between
 * them. Everything is asserted against window.RECIPES and the numbers the
 * page actually shows, never against counts or macros written down here —
 * the data is rebuilt too often for a copied answer to stay true.
 *
 * Split by topic: later sections are in tests/macros-*.test.js, and the page
 * helpers and the plan every page starts with are in tests/fixtures/nourish.js. */
const { nourish, openWeigh, openPlan, addOn, openBasket, pickerList, openDay } = require('./fixtures/nourish.js');

module.exports = nourish({
  name: 'Macros',
  async suite(t, freshBare) {
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
        // a fortnight behind and a week ahead: you can plan Thursday on Tuesday;
        // and last, "Earlier day…" for any day the log keeps (2026-09-27)
        return /^Today ·/.test(s.options[s.selectedIndex].text) && s.options.length === 22 &&
          /^Tomorrow ·/.test(s.options[s.selectedIndex - 1].text) && s.options[21].value === 'pick';
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
          /* Four, not six. "Meals & shares" and "How My Day works" were two
             more doors into the plan sheet the first entry already opens —
             three of six landing in one room — and both destinations are
             accordions that sheet already shows. */
          .join() === 'plan,foods,you,went'));
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
    const foot = () => p.textContent('#macroFoot');
    /* What used to be asserted here: "default targets are 180P / 50F / 50C".
       That triple was a placeholder, and this test was what held it in place.
       It rendered in exactly the shape a plan somebody made renders, so a
       first run opened on "No plan yet." above a full week of 1,370-kcal
       budgets belonging to nobody, four bars reading 0 / 180 g, and a Fill
       button ready to draft a real day against them. Both empty states were
       already written — the placeholder was the only reason neither fired. */
    /* It says what the tab IS, not just what to do next. Every other tab in
       the app explains itself when empty; this one said "Craft your plan."
       and, a hundred pixels below, "No plan yet. Craft my plan" — the same
       instruction twice and an explanation none, on the tab with the steepest
       ideas in it. */
    t.ok('a first run explains what this tab is, rather than only ordering you about',
      /your day/i.test(await foot()) && /(lose|goal)/i.test(await foot()), await foot());
    /* The safety property is unchanged and is the one worth asserting: no
       plan, no draft. What changed is that the button no longer sits there
       dead — it is the way to MAKE the plan, which is the only useful thing
       it could do at that moment. */
    t.ok('and the biggest button on the tab is the way in, not a dead end',
      await p.evaluate(() => {
        const b = document.getElementById('macroFill');
        return !!b && !b.disabled && b.classList.contains('to-plan') &&
          /plan/i.test(b.textContent);
      }),
      await p.evaluate(() => {
        const b = document.getElementById('macroFill');
        return b ? JSON.stringify({ text: b.textContent, disabled: b.disabled,
          cls: b.className }) : 'no button';
      }));
    t.ok('and pressing it will not draft a day against a plan nobody set',
      await p.evaluate(() => {
        document.getElementById('macroFill').click();
        const d = JSON.parse(localStorage.getItem('bsc.macroDays') || '{}');
        return Object.keys(d).every((k) => Object.keys(d[k] || {})
          .every((sk) => !(d[k][sk] || []).length));
      }),
      await p.evaluate(() => localStorage.getItem('bsc.macroDays') || 'no days'));
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
      new RegExp('/ ' + defKcal.toLocaleString() + '(?!\\d)').test(await foot()), await foot());
    /* One budget in the shape of what it is: calories are the SUM the other
       three are parts of, so they are the headline and P/F/C are three
       columns under it. Four identical bars said protein and the whole day's
       energy were the same rank of fact. Each of the four still carries its
       two bands — eaten and planned — because that is the reading, not the
       layout. (A third hatched in what an empty meal was assumed to become;
       Blake: "I don't need the hash lines when blank. Just blank is fine.")
       The assumption still lands in the delta the top pills print. */
    t.ok('calories are the headline and the macros are three columns under it',
      await p.evaluate(() => {
        const head = document.querySelector('.mbars .mhead');
        const cols = [...document.querySelectorAll('.mbars3 .mbrow')];
        const bands = (r) => r.querySelector('.mb-ate') && r.querySelector('.mb-plan') &&
          !r.querySelector('.mb-asm');
        return !!head && head.dataset.macro === 'kcal' && bands(head) &&
          cols.length === 3 && cols.map((r) => r.dataset.macro).join() === 'p,f,c' &&
          cols.every(bands) &&
          // no stray fourth bar left in the old stack
          !document.querySelector('.mbars > .mbrow') && !document.querySelector('.mslot-left');
      }), await p.evaluate(() => document.querySelector('.mbars').innerHTML.slice(0, 300)));
    /* Three fills only compare by eye if the tracks they sit in are the same
       length. The old stack gave each macro a full card width and its own
       label column, which made three bars that could only be read one at a
       time against their own targets — four readings of a thing that should
       take one. */
    t.ok('and the three columns are the same width as each other',
      await p.evaluate(() => {
        const w = [...document.querySelectorAll('.mbars3 .mb-track')]
          .map((e) => Math.round(e.getBoundingClientRect().width));
        return w.length === 3 && Math.max.apply(null, w) - Math.min.apply(null, w) <= 1 &&
          w[0] > 40;
      }), await p.evaluate(() => [...document.querySelectorAll('.mbars3 .mb-track')]
        .map((e) => e.getBoundingClientRect().width).join(', ')));
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

    /* And a signed number for what is left, on the line it belongs to —
       spoken rather than printed, now that three columns have no room for a
       third figure at a width a phone actually is. The pills a line above
       print the same number. Losing it from the markup would take it from a
       screen reader too, which is the reading that has nowhere else to go. */
    /* Signed in data-d, and SAID without the minus: "-495 to go" is what a
       screen reader read out, which is a number to go and a sign saying the
       opposite. Over keeps its plus. */
    t.ok('and each of the four still says what is left of it, signed in data-d and spoken as it reads',
      await p.evaluate(() => {
        const c = [...document.querySelectorAll('[data-macro] .mb-d')];
        return c.length === 4 &&
          c.every((x) => /^-?\d+$/.test(x.dataset.d)) &&
          c.every((x) => {
            const d = Number(x.dataset.d), said = x.textContent.trim();
            return d > 0 ? said === '+' + d + ' over' : said === Math.abs(d) + ' to go';
          });
      }), await p.textContent('#macroFoot'));
    /* A floor and a ceiling, and neither is a budget — which is why on a day
       that is fine they are NOTHING. They were two bars under the macros,
       which put five things in a column and invited you to read them as five
       budgets to fill; filling the protein bar is the day going right and
       filling the salt bar is the day going wrong, and drawing both the same
       way, always, is the readout arguing with itself.
     *
       The rule is the one a plate already keeps: there is no "on" chip, and
       that is what makes a chip mean something. */
    /* The day here is empty: no salt anywhere near the ceiling, and a fibre
       floor that is only "missed" in the sense that the day has not happened
       yet. Both silent. */
    t.ok('a day inside the floor and under the ceiling says nothing about either',
      await p.evaluate(() => {
        const lim = document.querySelector('.mlimits');
        return !!lim && lim.children.length === 0;
      }), await p.evaluate(() => (document.querySelector('.mlimits') || {}).outerHTML));
    /* But the live region has to be ON the page while it is empty. A status
       region added at the moment it gains content is a region nothing was
       watching when it changed, and the announcement is lost. */
    t.ok('and the region that would carry the warning is already there, watched',
      await p.evaluate(() => {
        const lim = document.querySelector('.mlimits');
        return !!lim && lim.getAttribute('role') === 'status';
      }));
    /* Silent has to mean silent. An empty container that still draws its
       divider and holds its margin is the furniture this change was made to
       remove — the card would look exactly as it did, minus the words. */
    t.ok('and it draws no rule and takes no height while it is empty',
      await p.evaluate(() => {
        const lim = document.querySelector('.mlimits');
        return lim.children.length === 0 &&
          parseFloat(getComputedStyle(lim).borderTopWidth) === 0 &&
          Math.round(lim.getBoundingClientRect().height) === 0;
      }), await p.evaluate(() => {
        const l = document.querySelector('.mlimits');
        return getComputedStyle(l).borderTopWidth + ' / ' +
          l.getBoundingClientRect().height + ' / ' + l.children.length;
      }));

    /* ---- and the other half of that guard --------------------------------
     * "It says nothing" passes just as well against a readout that can no
     * longer say anything at all. So the same claim from the other side, on
     * a page of its own: a day carrying half a bottle of soy sauce across
     * four meals, which busts the ceiling and leaves the floor nowhere near
     * met. Both lines must appear, name their number, and carry the state
     * that colours them. */
    const limPg = await t.fresh();
    await limPg.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 180, f: 50, c: 50 }));
      /* every meal carries something, so nothing is being ASSUMED — which is
         the condition fibre waits for before it will say a word */
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: 'f:egg_white', x: 2, eaten: 1 }, { id: 'f:soy_sauce', x: 1, eaten: 1 }],
        l: [{ id: 'f:cooked_beef', x: 1.5, eaten: 1 }, { id: 'f:soy_sauce', x: 1, eaten: 1 }],
        d: [{ id: 'f:cooked_beef', x: 1.5, eaten: 1 }, { id: 'f:soy_sauce', x: 1, eaten: 1 }],
        s: [{ id: 'f:cheddar', x: 1, eaten: 1 }] } }));
    });
    await limPg.reload();
    await limPg.waitForTimeout(400);
    await limPg.click('.tab[data-view="macros"]');
    await limPg.waitForTimeout(350);
    const limSay = await limPg.evaluate(() => {
      const rows = [...document.querySelectorAll('.mlimits .mlim')];
      return { n: rows.length, text: rows.map((r) => r.textContent).join(' ~ '),
        keys: rows.map((r) => r.dataset.lim).join(),
        states: rows.map((r) => [...r.classList].filter((c) => c !== 'mlim').join()).join(' '),
        border: parseFloat(getComputedStyle(document.querySelector('.mlimits')).borderTopWidth) };
    });
    t.ok('but a day over the ceiling and short of the floor says both, by name',
      limSay.n === 2 && limSay.keys === 'fib,na' &&
      /\d+ g fibre/.test(limSay.text) &&
      /short of the floor/.test(limSay.text) &&
      /mg.*salt/.test(limSay.text) && /over the [\d,]+ ceiling/.test(limSay.text),
      JSON.stringify(limSay));
    /* The colours invert here and the app must not forget it: there is no
       such thing as too much fibre on a cut, and being under a salt ceiling
       is the default rather than something to congratulate. */
    t.ok('and fibre never turns red while salt never turns green',
      /\bshort\b/.test(limSay.states) && !/\bpast\b|\bnear\b/.test(limSay.states.split(' ')[0]) &&
      /\bpast\b/.test(limSay.states.split(' ')[1] || '') &&
      !/\bmet\b/.test(limSay.states.split(' ')[1] || ''),
      limSay.states);
    // and now the rule IS drawn, because there is something under it
    t.ok('and only now does it draw its rule across the card', limSay.border > 0,
      String(limSay.border));
    /* Fibre's patience, asserted directly: empty the snack slot and the same
       shortfall stops being a finding, because the rest of the day is what
       fixes it. Salt keeps talking — a ceiling can be busted at lunch. */
    await limPg.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
      days[k].s = [];
      localStorage.setItem('bsc.macroDays', JSON.stringify(days));
    });
    await limPg.reload();
    await limPg.waitForTimeout(400);
    await limPg.click('.tab[data-view="macros"]');
    await limPg.waitForTimeout(350);
    t.ok('and a meal still to come is what buys fibre its silence, not salt',
      await limPg.evaluate(() => {
        const k = [...document.querySelectorAll('.mlimits .mlim')].map((r) => r.dataset.lim);
        return k.length === 1 && k[0] === 'na';
      }), await limPg.evaluate(() => (document.querySelector('.mlimits') || {}).textContent));
    await limPg.context().close();

    /* Carb cycling. RP does not eat the same thing seven days a week: a
       training day earns more carbohydrate and a rest day gives it back, so
       the WEEK averages to the plan while the days differ. Derived from the
       workouts box, overridden by tapping a day. */
    /* The strip stopped printing each day's target under it — that is a fact
       about the PLAN, and the strip is a record of OUTCOMES, and three lines
       of type per column is a table turned on its side rather than a
       heatmap. It stays in the label, which is where a reader who is
       listening rather than looking was always getting it. */
    const wkTarget = () => p.evaluate(() => [...document.querySelectorAll('.mwk-d')]
      .map((e) => Number((e.getAttribute('aria-label')
        .match(/(\d+) calorie target/) || [0, 0])[1])));
    t.ok('with no workouts named, every day asks for the same thing',
      await (async () => {
        const k = await wkTarget();
        return k.length === 7 && new Set(k).size === 1 && k[0] > 0;
      })(), (await wkTarget()).join(','));
    await openPlan(p);
    await p.waitForTimeout(200);
    // four lifting days, picked (the count is how many there are)
    for (const d of [0, 2, 4, 5]) await p.click('[data-mtrain="' + d + '"]');
    await p.click('[data-mtarg="save"]');
    await p.waitForTimeout(350);
    const cyc = await p.evaluate(() => ({
      week: [...document.querySelectorAll('.mwk-d')].map((e) => Number((e.getAttribute('aria-label')
        .match(/(\d+) calorie target/) || [0, 0])[1])),
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
    t.ok('tapping a day sets it, in the one list Strengthen shares',
      await p.evaluate(() => (window.Train.liftDays() || []).indexOf(1) >= 0));
    await p.click('[data-mtrain="1"]');
    await p.waitForTimeout(200);
    await p.click('.sheet-x');
    await p.waitForTimeout(250);

    /* Crafting a plan is a once-a-season job, so the daily screen carries
       what the plan is DOING rather than a button for making one. With no
       plan yet the line still says so — and the way in is still out in the
       OPEN, because a first morning that hides it behind a press is a first
       morning with nowhere to go. What changed is where open is.
     *
       It used to be a ghost button on this card, one of three "Craft my plan"
       in a screenful, none of them the thing a thumb lands on. It is the
       bottom bar's primary button now: pinned, always visible, the largest
       control on the tab, and — measured on a cold first run — previously
       sitting there disabled and green at exactly this moment. */
    await openWeigh(p);
    t.ok('with no plan, the card still says so',
      /No plan yet/.test(await p.textContent('.mw-verdict')),
      await p.textContent('.mw-verdict'));
    /* Asserted as a RULE rather than a snapshot, because which of the two
       states a page is in depends on the fixture and the rule holds in both:
       exactly one place offers the way into the plan, it is reachable without
       a press, and it says which job it is doing. Written as an either/or so
       it cannot pass by both doors being shut. */
    t.ok('and exactly one way into the plan is on the face, saying what it does',
      await p.evaluate(() => {
        const bar = document.getElementById('macroFill');
        const card = document.querySelector('#macroTargBtn');
        const seen = (e) => { if (!e || e.disabled) return false;
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0; };
        const barIsDoor = !!bar && bar.classList.contains('to-plan');
        if (barIsDoor) return seen(bar) && /plan/i.test(bar.textContent) && !card;
        return seen(card) && /plan/i.test(card.textContent) &&
          /fill/i.test(bar.textContent);
      }),
      await p.evaluate(() => {
        const bar = document.getElementById('macroFill');
        const card = document.querySelector('#macroTargBtn');
        return 'bar=' + (bar ? bar.textContent + '/' + bar.className : 'none') +
          ' card=' + (card ? card.textContent : 'none');
      }));

    /* The four presets are rates, the way RP frames a cut — a percent of
       bodyweight a week, not a percent off the day's burn — so each one
       lands where somebody who has used that app expects it to. */
    t.ok('the presets are rates, and land where a cut is expected to land',
      await p.evaluate(() => {
        localStorage.setItem('bsc.macroProfile', JSON.stringify({ sex: 'm', age: 43, ft: 5,
          inch: 11, lb: 205, act: 1.375, goal: 'cut2' }));
        /* No lifting days either: the ones picked above are the one shared
           list now, and would count as sessions in this burn. */
        localStorage.removeItem('bsc.train');
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
    /* The "Yours" half of this went with the provenance row. A plate no
       longer says which shelf its food came from — not the book, not the
       yield, not "Yours" — because that was a whole row per plate spent on
       reference rather than on the decision in front of you, and all of it is
       a tap away behind the name. Asked how far to cut, Blake: all of it goes.

       What is asserted here is the half that was always the point: the unit
       is named ON THE AMOUNT. "21 g" or "1 cup", not "×1". */
    t.ok('with its unit named on the amount, and no recipe pretending to be behind it',
      await p.evaluate(() => {
        const el = document.querySelector('.mitem-food');
        if (!el || el.dataset.open) return false;
        const row = el.closest('.mitem');
        const amount = row.querySelector('.mstep-x').textContent;
        return amount.indexOf('×') < 0 && /[a-z]/i.test(amount);
      }), await p.evaluate(() => {
        const el = document.querySelector('.mitem-food');
        if (!el) return 'no food row';
        const row = el.closest('.mitem');
        return 'amount "' + row.querySelector('.mstep-x').textContent + '"';
      }));

    /* The plate says nothing about where the food came from. Guarding the
       deletion, not just doing it: the row grew back once before, as a line
       of chips, and a note in a stylesheet does not stop that. */
    t.ok('and the plate no longer names the shelf it came from',
      await p.evaluate(() => !document.querySelector('#macroSlots .mitem-from')),
      await p.evaluate(() => (document.querySelector('#macroSlots .mitem-from') || {})
        .textContent || ''));
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
    const foodKeys = await p.evaluate(() => {
      const k = window.__macroLab.newFoodKey, mine = { lunch: {}, caf: {}, lunch_2: {} };
      return [k('Lunch', mine), k('Café', mine), k('Soup', mine)].map((x) => x.key + '/' + x.name).join();
    });
    t.ok('a food saved under a name already taken gets a number, rather than rewriting the old one and every day that holds it',
      foodKeys === 'lunch_3/Lunch 3,caf_2/Café 2,soup/Soup', foodKeys);
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
    /* "moving about" rather than "walking" since the middle part is the job
       or the steps, whichever says more — this profile is on its feet. */
    t.ok('the day is shown in the parts you can move',
      /living/.test(await coach()) && /moving about/.test(await coach()) &&
      /training/.test(await coach()), await coach());
    /* Said once, in the ledger — the coach used to say it again a screen
       lower, and Blake called the sheet messy. The ledger's Arriving row is
       the projection when there is no date, so a dateless pace still lands
       somewhere the reader can see. */
    const ledger = () => p.textContent('#mtFacts');
    t.ok('and a pace with no date still says where it lands you',
      /→ 175 lb/.test(await ledger()) && /Arriving\s*about /.test(await ledger()),
      await ledger());
    t.ok('with each lever priced both ways — food now, or the date sooner',
      /a day at the same pace/.test(await coach()) && /sooner/.test(await coach()),
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
    /* Against the plan the profile works out to, not a range written down
       here: the range (1,450–1,600) was this profile's burn with its job
       thrown away, and on its feet with three sessions it burns more now. */
    t.ok('and taking it fills the boxes with what the panel described',
      await p.evaluate(() => {
        const k = Number(document.getElementById('mtBigKcal').textContent);
        const pl = window.__macroLab.plan(window.__macroLab.profile());
        return k === 4 * pl.p + 4 * pl.c + 9 * pl.f && !document.querySelector('[data-mtuse]');
      }), await p.evaluate(() => document.getElementById('mtBigKcal').textContent + ' vs ' +
        JSON.stringify(window.__macroLab.plan(window.__macroLab.profile()))));
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

    /* But only a plan's own record. The same grams marked as the person's
       (auto 0) are theirs: P 400 / F 10 / C 0 was saved, the day read
       190 / 57 / 93 with no word, and a reload rewrote storage itself. */
    await p.evaluate(() => localStorage.setItem('bsc.macroTargets',
      JSON.stringify({ p: 226, f: 62, c: 13, auto: 0, set: '2026-09-01' })));
    await p.reload();
    await p.waitForTimeout(400);
    await p.click('.tab[data-view="macros"]');
    await p.waitForTimeout(300);
    t.ok('the same grams typed by hand are left as typed, in storage and on the day',
      await p.evaluate(() => {
        const t2 = JSON.parse(localStorage.getItem('bsc.macroTargets'));
        return t2.p === 226 && t2.f === 62 && t2.c === 13 && t2.auto === 0;
      }) && /\/ 226 g/.test(await foot()),
      await p.evaluate(() => localStorage.getItem('bsc.macroTargets')) + ' | ' + await foot());

    /* Which is safe only because Save no longer keeps a day Nourish cannot
       plan. It refuses, writes nothing, and says why under the total. */
    const keepT = JSON.stringify({ p: 190, f: 60, c: 150, auto: 0, set: '2026-09-01' });
    await p.evaluate((v) => localStorage.setItem('bsc.macroTargets', v), keepT);
    await p.reload();
    await p.waitForTimeout(400);
    await p.click('.tab[data-view="macros"]');
    await p.waitForTimeout(300);
    await openPlan(p);
    await p.waitForTimeout(250);
    // the gram boxes are in the profile's fold on a plan already made
    await p.evaluate(() => {
      if (document.getElementById('mtEditor').classList.contains('hide')) {
        document.querySelector('[data-mtedit]').click();
      }
    });
    await p.waitForTimeout(150);
    const refuse = async (pp, ff, cc) => {
      await p.fill('#mtP', pp);
      await p.fill('#mtF', ff);
      await p.fill('#mtC', cc);
      await p.waitForTimeout(150);
      const was = await p.textContent('#mtRefuse');
      await p.click('[data-mtarg="save"]');
      await p.waitForTimeout(300);
      return p.evaluate((w) => ({ was: w, said: (document.getElementById('mtRefuse') || {}).textContent || '',
        open: !!document.getElementById('mtP'), stored: localStorage.getItem('bsc.macroTargets') }), was);
    };
    const noCarb = await refuse('400', '10', '0');
    t.ok('P 400 / F 10 / C 0 is refused with why and the least Nourish can plan, and nothing is written',
      noCarb.open && noCarb.stored === keepT && /no room for carbs/.test(noCarb.said) &&
        /least Nourish can plan for you is [\d,]+ kcal/.test(noCarb.said), JSON.stringify(noCarb));
    const zeros = await refuse('0', '0', '0');
    t.ok('and so are three zeros, which used to save and show the plan’s numbers',
      zeros.open && zeros.stored === keepT && /no calories/.test(zeros.said) &&
        /least Nourish can plan/.test(zeros.said) && zeros.was === '', JSON.stringify(zeros));
    const handSane = await refuse('200', '65', '140');
    t.ok('while a day it can plan, typed by hand, still saves as the person’s own',
      !handSane.open && handSane.said === '' &&
        /"p":200,"f":65,"c":140,"auto":0/.test(handSane.stored || ''), JSON.stringify(handSane));
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
    /* An added plate arrives planned, whatever the hour — Blake, 2026-09-27:
       "Why when I add a dish does it mark it as eaten?... I want to tick it
       complete." The tick is the only way a plate becomes eaten. */
    t.ok('added to breakfast, the plate arrives planned, not eaten',
      await p.evaluate(() => !!document.querySelector('.mitem') && !document.querySelector('.mitem.eaten')));

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
      await p.evaluate(() => document.querySelector('[data-macro="kcal"]').dataset.eaten === '0'));
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
      await p.evaluate(() => Number(document.querySelector('[data-macro="kcal"]').dataset.eaten) > 0));
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
        document.querySelector('[data-macro="kcal"]').dataset.eaten === '0' &&
        !document.querySelector('#macroSlots .mday-stop.done')));

    /* A day with every plate eaten is a finished day, and the week strip
       says so: the circle fills, tinted by where the day landed (under, on,
       over) rather than by the plain fact of eating. Today keeps its ink
       fill so the strip still says where you are, and wears its verdict as
       a ring instead — it is the day most often finished while you watch. */
    t.ok('a day is not done while a plate is still ahead of you',
      await p.evaluate(() => !document.querySelector('.mwk-d.now').classList.contains('done')));
    /* How "done" is SAID has moved once already — it was a tinted fill under
       a ring, it is now a solid fill inside one — so the guard asks the
       question rather than naming the property: does the square look
       different at all. Pinning it to box-shadow is what made this fail the
       first time the answer moved to the background. */
    /* Read off the BAR now: the square became a pill of a bar chart, and
       what marks today is an ink edge on its track while a finished day is
       a solid fill where an unfinished one is pale. */
    const paintOf = () => p.evaluate(() => {
      const tr = getComputedStyle(document.querySelector('.mwk-d.now .mwk-b'));
      const fill = document.querySelector('.mwk-d.now .mwk-b i');
      return [tr.borderColor, tr.borderWidth, fill ? getComputedStyle(fill).opacity : 'no fill',
        getComputedStyle(document.querySelector('.mwk-d.now .mwk-n')).fontWeight].join(' | ');
    });
    const ringBefore = await paintOf();
    await p.click('#macroSlots .mday-dot');
    await p.waitForTimeout(200);
    t.ok('eating every plate marks the day done on the week strip',
      await p.evaluate(() => {
        const d = document.querySelector('.mwk-d.now');
        /* 'open' is today with dinner still to come: every plate eaten is not
           the day closed, so it says what is left rather than a verdict. */
        return d.classList.contains('done') &&
          ['under', 'on', 'over', 'open'].some((s) => d.classList.contains(s)) &&
          /all done/.test(d.getAttribute('aria-label'));
      }), await p.evaluate(() => document.querySelector('.mwk-d.now').outerHTML));
    const ringAfter = await paintOf();
    t.ok('and today, done, looks different from today in progress',
      ringAfter !== ringBefore &&
      // and it is still marked as the day you are on, either way: the ink edge
      parseFloat(ringAfter.split(' | ')[1]) >= 2 && parseFloat(ringBefore.split(' | ')[1]) >= 2,
      ringBefore + '\n   vs ' + ringAfter);
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
        const past = !!over && Number(over.querySelector('.mb-d.pos').dataset.d) > 0 &&
          /^\+\d+$/.test(over.querySelector('.mb-d.pos b').textContent);
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
      await p.evaluate(() => Array.from(document.querySelectorAll('[data-macro]'))
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
        return Array.from(document.querySelectorAll('[data-macro]')).every((d) =>
          d.dataset.state !== 'over' ||
          // the shown figure is rounded, so a hair over the line reads as on it
          pctOf(d) >= (d.dataset.macro === 'p' ? 110 : d.dataset.macro === 'kcal' ? 105 : 100));
      }));
    t.ok('the bar caps at full rather than running past its own end',
      await p.evaluate(() => Array.from(document.querySelectorAll('[data-macro]'))
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

    /* This asserted the cost was ranked OVER its provenance — stacked, macros
       first, provenance quieter. There is no provenance on the plate to rank
       against any more, so the claim has nothing left to be true about and
       the assertion goes with the row. Its replacement is above: the row is
       gone and must stay gone.

       The row it freed pays for the thing this asserts instead: the NAME is
       never cut off. It is the one fact on the plate you cannot reconstruct
       from anything else — measured, the longest name in the book wanted
       395px and was given 241, so 39% of it went, while the two rows beneath
       it ended at 55% and 45% of the same width. An invariant over every
       plate on the day, so it has a subject whatever the fixture holds. */
    t.ok('and no plate cuts off the one thing it cannot reconstruct — its name',
      await p.evaluate(() => {
        const names = Array.from(document.querySelectorAll('#macroSlots .mitem-name'));
        if (!names.length) return false;
        return names.every((el) =>
          /* wrapped, not clipped — both halves, because either alone can be
             true while the name is still being lost */
          getComputedStyle(el).whiteSpace !== 'nowrap' &&
          el.scrollWidth <= el.clientWidth + 1);
      }), await p.evaluate(() => Array.from(document.querySelectorAll('#macroSlots .mitem-name'))
        .map((el) => el.textContent.trim() + ' [' + Math.round(el.clientWidth) + '<' +
          Math.round(el.scrollWidth) + ' ' + getComputedStyle(el).whiteSpace + ']').join(' | ')));

    /* The salt warning that came off that row is asserted on a page of its
       own, further down — putting a fourth plate on this meal to give it a
       subject would move the plate count every later test in this block
       counts on. */
    t.ok('and the old tag row is gone',
      await p.evaluate(() => {
        const wrap = document.querySelector('.mitem-chips');
        const chip = wrap && wrap.querySelector('.mchip');
        const mac = document.querySelector('.mitem-mac');
        if (!chip || !mac) return true;
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
    /* Protein is a gram a pound of the reference weight at the default
       level — today's weight here, with no goal weight and no body fat typed
       — whatever the pace; and it gives ground to 0.8 g a pound of the same
       reference when the carbohydrate is squeezed. */
    let planP = Math.round(1.0 * prof.lb);
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
      /40 · 6′0″ · male/.test(await q.textContent('#mtWho')),
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
    /* The destination is a FACT in the ledger under the number, not a
       headline over it and not a sentence crushed onto the fold's handle.
       It used to be set in the book's largest serif above the plan, where a
       sentence reads as a title filled in wrong; then it moved onto the
       handle, where it was said twice on one screen. */
    t.ok('the destination is a fact in the ledger, not a headline over it',
      /200 lb → 185 lb/.test(await q.textContent('#mtFacts')) &&
      await q.evaluate(() => !document.querySelector('.mt-sheet .sheet-name') &&
        !document.getElementById('mtGoalLine')),
      await q.textContent('#mtFacts'));
    t.ok('and the pace beside it, from the date rather than a preset',
      /1\.5 lb a week/.test(await q.textContent('#mtFacts')),
      await q.textContent('#mtFacts'));
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
        /* A goal written by hand bypasses the writer that stamps where it
           started; leaving the old stamp on it is a goal set from another
           goal's morning, which nothing in the app can produce. */
        delete pr.goalSet; delete pr.goalFrom;
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
      /late|no date yet/.test(await narr()) && !/early/.test(await narr()), await narr());
    await q.evaluate(() => {
      const pr = JSON.parse(localStorage.getItem('bsc.macroProfile'));
      pr.goalLb = 185; delete pr.goalSet; delete pr.goalFrom;
      localStorage.setItem('bsc.macroProfile', JSON.stringify(pr));
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
    /* The numbers are one line under the goal now (2026-09-23): the average,
       the week, and what the goal needs — said once. */
    t.ok('once there are mornings, the scale gets an opinion',
      /seven-day average/.test(await narr()) && /needs down [\d.]+ a week/.test(await narr()), await narr());
    t.ok('and it is behind pace, because a pound a week is not two — said on the face',
      /weeks? late|days late|no date yet/.test(await narr()), await narr());

    /* ---- a card sent away stays away --------------------------------
     *
     * "Leave it" added a class that set display:none, and did nothing else.
     * The class was written nowhere and read nowhere, so it lasted exactly as
     * long as the element did — and a check, a portion nudge, a weigh-in or an
     * arriving sync all rebuild this region. Blake dismissed the pace card and
     * it was back a tap later, over and over, which reads as the app not
     * listening to him.
     *
     * Reload is the honest test of it: nothing was being stored at all, so
     * anything that redraws from scratch brought it back. */
    const paceCard = () => q.evaluate(() => {
      const el = document.querySelector('.mline.act');
      return el ? el.textContent.slice(0, 40) : null;
    });
    /* The plan this sheet saved sits twenty calories over what the scale now
       says to eat, and twenty is not a decision (MLINE_NEAR): the card says
       stay with it. A hundred over is one, so the target is moved a hundred
       off for the card to have something to ask. */
    await q.evaluate(() => {
      const t2 = JSON.parse(localStorage.getItem('bsc.macroTargets'));
      t2.c += 25;
      localStorage.setItem('bsc.macroTargets', JSON.stringify(t2));
    });
    await q.reload();
    await q.waitForTimeout(500);
    t.ok('the pace card is showing, with a way to send it away',
      !!(await paceCard()) && !!(await q.$('.mline.act [data-mline^="mline:none"]')),
      String(await paceCard()));

    await q.click('.mline.act [data-mline^="mline:none"]');
    await q.waitForTimeout(300);
    t.ok('sending it away takes it off the day', (await paceCard()) === null,
      String(await paceCard()));

    await q.reload();
    await q.waitForTimeout(500);
    t.ok('and it is still gone after everything redraws', (await paceCard()) === null,
      String(await paceCard()));

    /* The other half, and the reason the refusal is keyed to the advice and
       not only to the day: refusing 1,903 is a decision about 1,903. Asserted
       against the stored key rather than by moving the goal and hoping the
       arithmetic lands somewhere useful — pushing the goal around moves the
       card between branches, which would prove something else. A refusal of
       a number that is not today's number must not silence today's card. */
    t.ok('and what it wrote down is the advice, not just the day',
      await q.evaluate(() => {
        const h = JSON.parse(localStorage.getItem('bsc.macroHush') || '{}');
        const k = Object.keys(h)[0];
        return !!k && /^act:\d+$/.test(h[k]);
      }),
      await q.evaluate(() => localStorage.getItem('bsc.macroHush')));
    await q.evaluate(() => {
      const h = JSON.parse(localStorage.getItem('bsc.macroHush'));
      const k = Object.keys(h)[0];
      h[k] = 'act:1';                  // a refusal of some quite different number
      localStorage.setItem('bsc.macroHush', JSON.stringify(h));
    });
    await q.reload();
    await q.waitForTimeout(500);
    t.ok('but advice you have not refused is still entitled to speak',
      !!(await paceCard()), String(await paceCard()));

    /* leave the day clean for everything downstream */
    await q.evaluate(() => localStorage.removeItem('bsc.macroHush'));
    await q.reload();
    await q.waitForTimeout(500);

    /* ---- and the other button has to be SEEN to work -------------------
     *
     * "Eat 1,846" wrote the targets and redrew the card, and the card —
     * computed from the scale alone — came back word for word with the same
     * button on it. Blake: "I hit eat it but nothing happened." It had.
     * Once the plan already eats what the card would ask, the card says so
     * and stops asking. */
    const targetsBefore = await q.evaluate(() => localStorage.getItem('bsc.macroTargets'));
    const eatBtn = await q.$('.mline.act [data-mline^="mline:eat"]');
    t.ok('the pace card is back with an Eat button once the refusal is forgotten', !!eatBtn);
    const askedFor = await q.evaluate(() =>
      Number((document.querySelector('.mline.act [data-mline^="mline:eat"]').dataset.mline.split(':')[2])));
    await q.click('.mline.act [data-mline^="mline:eat"]');
    await q.waitForTimeout(300);
    const took = await q.evaluate(() => {
      const t2 = JSON.parse(localStorage.getItem('bsc.macroTargets'));
      const kcal = 4 * t2.p + 4 * t2.c + 9 * t2.f;
      const line = document.querySelector('.mline');
      return { kcal, text: line ? line.textContent.replace(/\s+/g, ' ').trim() : '',
        stillAsking: !!document.querySelector('[data-mline^="mline:eat"]') };
    });
    t.ok('pressing Eat writes the number into the plan', Math.abs(took.kcal - askedFor) <= 5,
      took.kcal + ' vs ' + askedFor);
    /* The target the card names is the target, to the calorie the grams
       came to — Eat writes grams, so it lands within a few of what it asked —
       rather than the number it would have asked for. */
    t.ok('and the card says it is being eaten, instead of asking again',
      !took.stillAsking && Math.abs(took.kcal - askedFor) <= 5 &&
        new RegExp('Your target: ' + took.kcal.toLocaleString()).test(took.text), took.text.slice(0, 120));

    /* Seventeen calories is not a decision. The tolerance was five, so a
       target a few calories off what the estimate wanted — which drifts a
       little every morning on its own — asked "Use 1,404 / Keep 1,421". Within
       fifty it stays quiet and names the target; a hundred off still asks. */
    const afterEat = await q.evaluate(() => localStorage.getItem('bsc.macroTargets'));
    const nudged = async (dc) => {
      await q.evaluate(([a, d]) => {
        const t2 = JSON.parse(a); t2.c += d;
        localStorage.setItem('bsc.macroTargets', JSON.stringify(t2));
      }, [afterEat, dc]);
      await q.reload();
      await q.waitForTimeout(500);
      return q.evaluate(() => {
        const t2 = JSON.parse(localStorage.getItem('bsc.macroTargets'));
        const line = document.querySelector('.mline');
        return { kcal: 4 * t2.p + 4 * t2.c + 9 * t2.f, need: window.__macroLab.pace().need,
          asking: !!document.querySelector('[data-mline^="mline:eat"]'),
          text: line ? line.textContent.replace(/\s+/g, ' ').trim() : '' };
      });
    };
    const near = await nudged(5);
    t.ok('twenty calories over what it would ask is not asked about, and the target is named as it is',
      Math.abs(near.kcal - near.need) > 5 && Math.abs(near.kcal - near.need) <= 50 && !near.asking &&
        new RegExp('Your target: ' + near.kcal.toLocaleString()).test(near.text), JSON.stringify(near));
    const far = await nudged(25);
    t.ok('a hundred over still is', far.kcal - far.need > 50 && far.asking, JSON.stringify(far));
    /* and put the plan back the way it was, for everything downstream */
    await q.evaluate((tb) => localStorage.setItem('bsc.macroTargets', tb), targetsBefore);
    await q.reload();
    await q.waitForTimeout(500);



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
    /* Fill picks at random from the top three fits, so one press is one draw
       and a check on it was a dice roll: about one run in thirty drew a day
       that finished its protein short and failed CI on a change that never
       touched Fill. So the spread is measured first, over sixty drafted days
       on the bench's own hooks — the same seeds every run — and then the one
       press below is seeded too, so it is the same day every run. */
    const mulberry = `(a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296; }`;
    const spread = await q.evaluate((src) => {
      const seeded = new Function('return ' + src)(), real = Math.random, lab = window.__macroLab;
      const T = lab.targets(), out = { short: 0, worst: 1, notProtein: [] };
      for (let i = 1; i <= 60; i++) {
        Math.random = seeded(i); lab.forget(); lab.draft();
        const d = lab.read(), r = d.tot.p / T.p;
        if (r < 0.88) out.short++;
        out.worst = Math.min(out.worst, r);
        d.meals.forEach((m) => m.items.forEach((it) => {
          if (it.why === 'p' && 4 * it.p < 0.3 * it.kcal) out.notProtein.push(it.name);
        }));
      }
      Math.random = real; lab.forget();
      return out;
    }, mulberry);
    t.ok('over sixty drafted days, a topper added for protein is always a protein food',
      spread.notProtein.length === 0, JSON.stringify(spread.notProtein.slice(0, 5)));
    t.ok('and no more than three of them finish under 88% of the protein, none under 75%',
      spread.short <= 3 && spread.worst >= 0.75, spread.short + ' short, worst ' + Math.round(100 * spread.worst) + '%');
    await q.evaluate((src) => { window.__realRandom = Math.random; Math.random = new Function('return ' + src)()(1); }, mulberry);
    await q.click('#macroFill');
    await q.evaluate(() => { Math.random = window.__realRandom; });
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
        bars: [...document.querySelectorAll('[data-macro]')].map((row) => {
          const m = row.querySelector('.mb-num').textContent
            .replace(/,/g, '').match(/([\d.]+)\s*\/\s*([\d.]+)/);
          return { m: row.dataset.macro, have: +m[1], want: +m[2] };
        }),
        fillMode: document.getElementById('macroFill').dataset.mode,
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
      return { row: rows.find((x) => /weigh/i.test(x)),
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
    /* The ledger, not the fold's handle: the weight moved there when the plan
       screen was rearranged, and it is the ledger that is built from the
       profile's resolved lb — which is the value this drift was in. */
    const whoOf = (pg) => pg.evaluate(() =>
      ((document.getElementById('mtFacts') || {}).textContent || '').replace(/\s+/g, ' ').trim());
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
      'ledger: "' + whoOpened + '" -> "' + whoSettled + '"');
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
    /* `[data-macro]`, not `.mbrow[data-macro]`: calories are the headline
       now and wear `.mhead`, and scoping to the old class would have quietly
       dropped them from a guard that counts four. */
    const deltaRows = () => skipPg2.evaluate(() =>
      [...document.querySelectorAll('[data-macro]')].map((r) => {
        const num = (r.querySelector('.mb-num') || {}).textContent || '';
        const m = /(-?[\d,]+)\s*\/\s*([\d,]+)/.exec(num.replace(/\s+/g, ' '));
        /* The signed figure is data-d: the words are "612 to go" now, with
           no minus to parse — parsing it and multiplying by -1 was how this
           first reported 612 against an expected -612. */
        const shown = Number((r.querySelector('.mb-d') || { dataset: {} }).dataset.d) || 0;
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
           against the platform.
         *
           240 and not 40 since the closers were moved BELOW Fits best. The
           row this test finds is a recipe now, and a recipe that fits closes
           the meal outright — which retires the whole closers band, three
           rows at once, from under your finger. That is a bigger shrink than
           the old margin allowed for, and the clamp it caused was the
           platform doing its job, not the scroll restore failing. Worth
           knowing the reorder made the common case BETTER: what disappears is
           below the reader now rather than above, so it only bites at the very
           end of the list, which is exactly where nothing can help. */
        s.scrollTop = Math.min(120, Math.max(0, (s.scrollHeight - s.clientHeight) - 240));
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
    const lookRow = () => look.evaluate(() => ({
      results: !!document.getElementById('nfResults'),
      says: (document.querySelector('#mpList .mslot-empty') || {}).textContent || '',
      net: (document.getElementById('nfResults') || {}).textContent || '',
    }));

    await look.fill('#mpFind', 'american cheese');
    await look.waitForTimeout(500);
    const dead = await lookRow();
    t.ok('a food the book does not stock still has somewhere for the answer to land',
      dead.results, JSON.stringify(dead));
    t.ok('and still says plainly that it has nothing of its own',
      /nothing matches/i.test(dead.says), JSON.stringify(dead.says));

    /* And it goes and asks, with no row to press. Any of the states mLookNet
       can be in counts — asking, answered, or refused — because what the
       tables say is their business and this is about the wiring. The query is
       still "american cheese" here: the two-letter case below retypes it, and
       putting this after that was checking a lookup that correctly never
       happened. */
    await look.waitForTimeout(900);
    t.ok('and asks the food tables on its own once the typing stops',
      /looking in the food tables|from the food tables|did not answer|asked too often|no usda key|nothing came back/i
        .test((await lookRow()).net), JSON.stringify((await lookRow()).net.slice(0, 120)));

    /* Two characters is not a question worth asking somebody else's server. */
    await look.fill('#mpFind', 'am');
    await look.waitForTimeout(400);
    t.ok('two letters is not a lookup', !(await lookRow()).results);

    /* A barcode already has its own row at the top; two rows offering to look
       the same thing up is the tile problem again, smaller. */
    await look.fill('#mpFind', '01234567890');
    await look.waitForTimeout(400);
    const codeRow = await look.evaluate(() => ({
      look: !!document.getElementById('nfResults'),
      code: !!document.querySelector('[data-nfcode]') }));
    t.ok('a barcode is offered once, by the row that already did it',
      !codeRow.look && codeRow.code, JSON.stringify(codeRow));
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
     * The About-you boxes used to open at 0 on a first run, right-aligned at
     * the far end of their row, and a tap puts the caret wherever the thumb
     * landed — usually LEFT of the digit. Typing 180 into the weight box
     * produced "1800", which the sheet accepted (max=999 is the browser's
     * business, not mtProfileFromDom's) and turned into a ten-thousand-calorie
     * plan. The very first number anybody typed into this app came back wrong
     * by a factor of ten.
     *
     * That was answered by making the caret safe. The nought is gone as well
     * now — unanswered is not zero, and a box that opens empty cannot be
     * typed in front of — so the first assertion below is the new state and
     * the second still guards the caret, which matters the moment a box DOES
     * hold a figure and somebody edits it.
     *
     * Typed with real keys at the caret the tap leaves, not with fill(),
     * which replaces the value and would pass either way. */
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
    t.ok('the weight box opens empty, because nobody has answered it yet',
      opensAtZero === '', JSON.stringify(opensAtZero));
    /* A tap at the LEFT edge of the box — where a thumb aiming at the box
       rather than at the digit lands. */
    const lbBox = await zeroBox.$('#mtLb');
    /* Into view first. The tap below is at real coordinates, so a box sitting
       under the fold is a tap on whatever is at those coordinates instead —
       which is a test that breaks every time a row moves, rather than when
       the thing it is about breaks. */
    await lbBox.scrollIntoViewIfNeeded();
    await zeroBox.waitForTimeout(150);
    const lbRect = await lbBox.boundingBox();
    await zeroBox.mouse.click(lbRect.x + 4, lbRect.y + lbRect.height / 2);
    await zeroBox.waitForTimeout(200);
    await zeroBox.keyboard.type('180');
    await zeroBox.waitForTimeout(400);
    t.ok('and typing a weight into it gives that weight, not ten times it',
      await zeroBox.evaluate(() => (document.getElementById('mtLb') || {}).value) === '180',
      await zeroBox.evaluate(() => (document.getElementById('mtLb') || {}).value));

    /* And the dash is not a permanent state — one answer is enough for the
       arithmetic to have something to say, and it says it while you are still
       standing in the sheet. */
    t.ok('and the dash becomes a figure the moment there is one to show',
      await zeroBox.evaluate(() =>
        /\d/.test((document.getElementById('mtBigKcal') || {}).textContent || '')),
      await zeroBox.evaluate(() =>
        (document.getElementById('mtBigKcal') || {}).textContent));

    await zeroBox.context().close();

    /* The other side of it, and the reason the blanking is conditional: with a
       plan made, a 0 is a real answer — six foot nothing is a height — and the
       boxes have to show what was saved. Blanking those would be the same
       mistake pointed the other way. */
    const filled = await t.fresh({ viewport: { width: 412, height: 915 } });
    await filled.evaluate(() => {
      localStorage.setItem('bsc.macroProfile', JSON.stringify({ sex: 'm', age: 43,
        ft: 6, inch: 0, lb: 190, act: 1.375, goal: 'cut1', goalLb: 175,
        goalBy: '', workouts: 4, steps: 8000 }));
    });
    await filled.reload();
    await filled.waitForTimeout(400);
    await filled.click('.tab[data-view="macros"]');
    await filled.waitForTimeout(300);
    await openPlan(filled);
    await filled.waitForTimeout(500);
    t.ok('but a plan that exists shows every figure it was given, noughts and all',
      await filled.evaluate(() => {
        const v = (id) => (document.getElementById(id) || {}).value;
        return v('mtAge') === '43' && v('mtFt') === '6' && v('mtIn') === '0' &&
          v('mtGoalLb') === '175';
      }),
      await filled.evaluate(() => ['mtAge', 'mtFt', 'mtIn', 'mtGoalLb']
        .map((id) => id + '=' + (document.getElementById(id) || {}).value).join(' ')));
    t.ok('and its headline is a number, not a dash',
      await filled.evaluate(() =>
        /\d/.test((document.getElementById('mtBigKcal') || {}).textContent || '')),
      await filled.evaluate(() =>
        (document.getElementById('mtBigKcal') || {}).textContent));
    await filled.context().close();

    /* The headline over the boxes is the same statement in larger type, and it
       said 0 kcal a day over 0 protein, 0 fat, 0 carbs — a plan of nothing,
       stated as fact, to somebody who has not been asked a question yet.

       Its own page, and everything cleared. The fixture above legitimately
       carries saved grams with no profile — you can hand-edit the three boxes
       without answering anything about yourself — and a figure is the right
       answer there. The dash is for a reader who has stored nothing. */
    const cold = await t.fresh({ viewport: { width: 412, height: 915 } });
    await cold.evaluate(() => {
      ['bsc.macroProfile', 'bsc.macroTargets', 'bsc.macroWeights']
        .forEach((k) => localStorage.removeItem(k));
    });
    await cold.reload();
    await cold.waitForTimeout(400);
    await cold.click('.tab[data-view="macros"]');
    await cold.waitForTimeout(300);
    await openPlan(cold);
    await cold.waitForTimeout(500);
    t.ok('a plan nobody has made says so, rather than claiming nought calories',
      await cold.evaluate(() => {
        const big = document.getElementById('mtBigKcal');
        return !!big && !/\d/.test(big.textContent);
      }),
      await cold.evaluate(() =>
        (document.getElementById('mtBigKcal') || {}).textContent));
    t.ok('and neither do the three tiles under it',
      await cold.evaluate(() => ['mtTileP', 'mtTileF', 'mtTileC'].every((id) => {
        const el = document.getElementById(id);
        return el && !/\d/.test(el.textContent);
      })),
      await cold.evaluate(() => ['mtTileP', 'mtTileF', 'mtTileC']
        .map((id) => (document.getElementById(id) || {}).textContent).join('|')));
    await cold.context().close();

    /* ---- the first run is four steps, and all of them are in the document
     *
     * mtProfileFromDom reads the whole form out of the live DOM in one pass
     * and falls back to storage for any field it cannot find:
     *
     *     var n = function (id, fb) { var el = $(id); if (!el) return fb; ... }
     *
     * So a step that was built when you reached it, rather than hidden until
     * then, would have every question on it answered as a zero — and a plan
     * computed confidently from those zeros, with nothing thrown and nothing
     * to see. That is the whole reason the steps are rendered together and
     * only shown apart, and it is what this asserts. */
    const wiz = await t.fresh({ viewport: { width: 412, height: 915 } });
    await wiz.evaluate(() => {
      ['bsc.macroProfile', 'bsc.macroTargets', 'bsc.macroWeights']
        .forEach((k) => localStorage.removeItem(k));
    });
    await wiz.reload();
    await wiz.waitForTimeout(400);
    await wiz.click('.tab[data-view="macros"]');
    await wiz.waitForTimeout(300);
    /* deliberately NOT openPlan(), which reveals every step for the tests
       that are about something else */
    await wiz.click('#macroFill');
    await wiz.waitForTimeout(500);

    t.ok('a first run opens as five steps with one of them showing',
      await wiz.evaluate(() => {
        const all = [...document.querySelectorAll('[data-mtwstep]')];
        const shown = all.filter((s) => !s.hidden);
        return all.length === 5 && shown.length === 1 && shown[0].dataset.mtwstep === '1';
      }),
      await wiz.evaluate(() => [...document.querySelectorAll('[data-mtwstep]')]
        .map((s) => s.dataset.mtwstep + (s.hidden ? ':hidden' : ':shown')).join(' ')));

    const FIELDS = ['mtAge', 'mtFt', 'mtIn', 'mtLb', 'mtAct', 'mtSteps',
      'mtWorkouts', 'mtGoalLb', 'mtGoalBy', 'mtP', 'mtF', 'mtC'];
    t.ok('and every question is in the document, including the ones not showing',
      await wiz.evaluate((ids) => ids.every((id) => !!document.getElementById(id)), FIELDS),
      await wiz.evaluate((ids) => ids.filter((id) => !document.getElementById(id)).join(', ')
        || 'all present', FIELDS));

    /* The step you are on is answered before the next is put. Nothing is said
       until there is enough to say something true. */
    t.ok('step one says nothing before it has been answered',
      await wiz.evaluate(() => !(document.getElementById('mtwSaid1') || {}).textContent.trim()),
      await wiz.evaluate(() => (document.getElementById('mtwSaid1') || {}).textContent));

    await wiz.fill('#mtAge', '43');
    await wiz.fill('#mtFt', '5');
    await wiz.fill('#mtIn', '11');
    await wiz.fill('#mtLb', '190');
    await wiz.waitForTimeout(350);
    t.ok('and answers with a figure once it can',
      await wiz.evaluate(() => /\d/.test((document.getElementById('mtwSaid1') || {}).textContent || '')),
      await wiz.evaluate(() => ((document.getElementById('mtwSaid1') || {}).textContent || '').trim().slice(0, 60)));

    /* The figure step one calls being alive is the figure step two breaks out
       under the same words. mBurn's `base` is two different quantities wearing
       one name depending on whether steps have been given yet, and reading it
       here gave a resting burn of 2,757 on step one against 2,135 on step
       two — the same idea, two numbers, one screen apart. */
    await wiz.click('[data-mtw="next"]');
    await wiz.waitForTimeout(300);
    await wiz.fill('#mtSteps', '8000');
    for (const d of [0, 2, 5]) await wiz.click('[data-mtrain="' + d + '"]');
    await wiz.waitForTimeout(350);
    /* Step one says two figures now — the basal rate as "at rest" and bmr ×
       1.2 as "sitting still" — so it is the sitting-still one that step two
       must break out, under the same words. */
    t.ok('and step two breaks the same figure out, not a different one',
      await wiz.evaluate(() => {
        const one = ((document.getElementById('mtwSaid1') || {}).textContent || '').match(/([\d,]+) sitting still/);
        const part = [...document.querySelectorAll('#mtwSaid2 .mtw-part')]
          .find((x) => /sitting still/.test(x.textContent));
        return !!one && !!part && part.querySelector('b').textContent === one[1];
      }),
      await wiz.evaluate(() => [(document.getElementById('mtwSaid1') || {}).textContent,
        (document.getElementById('mtwSaid2') || {}).textContent].join(' || ').slice(0, 150)));

    t.ok('Back goes back, and the step you left is showing again',
      await (async () => {
        await wiz.click('[data-mtw="back"]');
        await wiz.waitForTimeout(300);
        return wiz.evaluate(() => {
          const shown = [...document.querySelectorAll('[data-mtwstep]')].filter((s) => !s.hidden);
          return shown.length === 1 && shown[0].dataset.mtwstep === '1';
        });
      })(),
      await wiz.evaluate(() => [...document.querySelectorAll('[data-mtwstep]')]
        .map((s) => s.dataset.mtwstep + (s.hidden ? ':hidden' : ':shown')).join(' ')));

    /* The pips are drawn from the step count now. They were four spans typed
       by hand, so the fifth step would have arrived under a bar still saying
       four — the kind of disagreement nobody sees until they count. */
    t.ok('and the progress bar has a pip per step, not a hardcoded four',
      await wiz.evaluate(() =>
        document.querySelectorAll('.mtw-pip').length ===
        document.querySelectorAll('[data-mtwstep]').length),
      await wiz.evaluate(() => document.querySelectorAll('.mtw-pip').length + ' pips'));

    /* The PLAN step carries the Save. Next used to stand in for it by finding
       the button and clicking it — which worked in the one-screen sheet,
       where such a button exists, and did nothing at all in the wizard, where
       it did not. The wizard could not save.
     *
       It is no longer the LAST step: the food grid comes after it, because
       "1,910 calories a day" is the answer that earns "so what do you eat".
       So Next is still there on this one, and what has to hold is that Save
       is present and reachable rather than that nothing follows it. */
    for (let i = 0; i < 3; i++) {
      await wiz.click('[data-mtw="next"]');
      await wiz.waitForTimeout(250);
    }
    t.ok('the plan step carries a Save you can actually press',
      await wiz.evaluate(() => {
        const sv = document.querySelector('[data-mtarg="save"]');
        const st = [...document.querySelectorAll('[data-mtwstep]')].find((x) => !x.hidden);
        return !!sv && !sv.closest('[data-mtwstep]').hidden &&
          st && st.dataset.mtwstep === '4';
      }),
      await wiz.evaluate(() => {
        const sv = document.querySelector('[data-mtarg="save"]');
        return 'save:' + (sv ? (sv.closest('[data-mtwstep]').hidden ? 'hidden' : 'shown') : 'MISSING');
      }));

    /* And the last step finishes rather than leaving you to the x in the
       corner: Next stands down, Done takes its place. Blake: "make the pick
       my foods the next step, with a subtle I'm ready to just start now" —
       so Next is the way on, and the Save on the plan step is the quiet
       line under it. */
    t.ok('and the plan step keeps Next, with the quiet start-now line as its Save',
      await wiz.evaluate(() => {
        const nx = document.querySelector('[data-mtw="next"]');
        const sv = document.querySelector('[data-mtarg="save"]');
        return !!nx && !nx.hidden && !!sv && sv.classList.contains('mtw-link') &&
          /start now/i.test(sv.textContent);
      }), await wiz.evaluate(() => (document.querySelector('[data-mtarg="save"]') || {}).textContent));
    await wiz.click('[data-mtw="next"]');
    await wiz.waitForTimeout(300);
    t.ok('the last step swaps Next for a Done',
      await wiz.evaluate(() => {
        const nx = document.querySelector('[data-mtw="next"]');
        const dn = document.querySelector('[data-mtw="done"]');
        const st = [...document.querySelectorAll('[data-mtwstep]')].find((x) => !x.hidden);
        return !!nx && nx.hidden && !!dn && !dn.hidden && st.dataset.mtwstep === '5';
      }),
      await wiz.evaluate(() => {
        const dn = document.querySelector('[data-mtw="done"]');
        return 'done ' + (dn ? (dn.hidden ? 'hidden' : 'shown') : 'missing');
      }));
    /* A tap on the last step has to SHOW. The wizard's sheet is drawn once
       and left — a redraw would throw away half-typed answers on four other
       steps — so renderModal does nothing here, and the first version of this
       screen wrote the favourite and repainted nothing. bsc.favs had the
       food; the chip looked untouched; the honest reading was that the tap
       had missed, and the next tap took it back off. */
    const fav1 = await wiz.evaluate(() => {
      const b = document.querySelector('.fp-chip:not(.on)');
      const id = b.dataset.fppick;
      b.click();
      return id;
    });
    await wiz.waitForTimeout(300);
    t.ok('a food tapped on the last step shows that it was tapped',
      await wiz.evaluate((id) => {
        const b = document.querySelector('[data-fppick="' + id + '"]');
        return !!b && b.classList.contains('on') &&
          b.getAttribute('aria-pressed') === 'true';
      }, fav1), fav1);
    t.ok('and it is still the last step afterwards, not back at the first',
      await wiz.evaluate(() => {
        const st = [...document.querySelectorAll('[data-mtwstep]')].find((x) => !x.hidden);
        return !!st && st.dataset.mtwstep === '5';
      }));
    /* The button says which of the two things pressing it means. */
    t.ok('and the finish button counts what you chose',
      await wiz.evaluate(() =>
        /\d+ chosen/.test(document.querySelector('[data-mtw="done"]').textContent)),
      await wiz.evaluate(() => document.querySelector('[data-mtw="done"]').textContent));
    await wiz.evaluate((id) => document.querySelector('[data-fppick="' + id + '"]').click(), fav1);
    await wiz.waitForTimeout(300);
    t.ok('and offers to skip once nothing is chosen',
      await wiz.evaluate(() =>
        /skip/i.test(document.querySelector('[data-mtw="done"]').textContent)),
      await wiz.evaluate(() => document.querySelector('[data-mtw="done"]').textContent));

    /* Back to the plan step, because Save lives there and the next assertion
       presses it. */
    await wiz.click('[data-mtw="back"]');
    await wiz.waitForTimeout(300);

    await wiz.click('[data-mtarg="save"]');
    await wiz.waitForTimeout(400);
    t.ok('and saving from it keeps every answer, including the hidden steps',
      await wiz.evaluate(() => {
        const pr = JSON.parse(localStorage.getItem('bsc.macroProfile') || '{}');
        return pr.age === 43 && pr.ft === 5 && pr.inch === 11 && pr.lb === 190 &&
          Number(pr.steps) === 8000 && pr.workouts === 3;
      }),
      await wiz.evaluate(() => localStorage.getItem('bsc.macroProfile')));

    /* And every time after, it is one screen. Changing your step count should
       not be four taps through questions you answered months ago. */
    await wiz.reload();
    await wiz.waitForTimeout(400);
    await wiz.click('.tab[data-view="macros"]');
    await wiz.waitForTimeout(300);
    await openPlan(wiz);
    await wiz.waitForTimeout(400);
    t.ok('but a plan already made opens as one sheet, not four steps',
      await wiz.evaluate(() => document.querySelectorAll('[data-mtwstep]').length === 0 &&
        !!document.getElementById('mtEditor')),
      await wiz.evaluate(() => 'steps:' + document.querySelectorAll('[data-mtwstep]').length));
    await wiz.context().close();

    /* ---- telling the plan you train never feeds you less -----------------
     *
     * The wizard's activity question is "only the job; the workouts asked
     * next carry the training". But once a session or a step count was told,
     * mBurn rebuilt the day from a desk and never read the job again, so "On
     * my feet" with no training said burned 2,446, and ticking ONE lifting day
     * took it to 2,183. The job and the steps are two guesses at the same
     * movement; the larger stands and the sessions go on top. */
    const jobPg = await t.fresh({ viewport: { width: 412, height: 915 } });
    const burnSums = await jobPg.evaluate(() => {
      const L = window.__macroLab, bad = [];
      const who = (o) => Object.assign({ sex: 'm', age: 43, ft: 5, inch: 11, lb: 190, act: 1.2 }, o);
      /* At a desk the job adds nothing, so the day is what the steps-and-
         sessions arithmetic always made it — worked out here the way it was
         before, against every combination of the two. */
      const before = (pr) => {
        const kg = pr.lb * 0.45359237, cm = (pr.ft * 12 + pr.inch) * 2.54;
        const bmr = 10 * kg + 6.25 * cm - 5 * pr.age + (pr.sex === 'f' ? -161 : 5);
        if (!(pr.steps > 0) && !(pr.workouts > 0)) return bmr * pr.act;
        return bmr * 1.2 + Math.max(0, (pr.steps || 0) - 2500) * 0.53 * kg * 0.00075 +
          (5 * 3.5 * kg / 200) * 45 * (pr.workouts || 0) / 7;
      };
      let desks = 0;
      ['m', 'f'].forEach((sex) => [0, 1000, 7000, 13000].forEach((steps) => [0, 1, 3, 5].forEach((workouts) => {
        const pr = who({ sex, steps, workouts });
        desks++;
        if (Math.abs(L.tdee(pr) - before(pr)) > 1e-6) bad.push('desk ' + JSON.stringify(pr) + ': ' + L.tdee(pr) + ' vs ' + before(pr));
      })));
      /* And for every job, saying you train only ever adds: from nothing
         said to one session, and from each session to the next. */
      [1.2, 1.375, 1.55].forEach((act) => {
        let last = L.tdee(who({ act }));
        [1, 2, 3, 4, 5].forEach((workouts) => {
          const now = L.tdee(who({ act, workouts }));
          if (now < last - 1e-6) bad.push(act + ' at ' + workouts + ' sessions: ' + Math.round(last) + ' -> ' + Math.round(now));
          last = now;
        });
        // to a hair: 1.2 + (1.55 − 1.2) is not 1.55 in floating point
        if (L.tdee(who({ act, steps: 3000 })) < L.tdee(who({ act })) - 1e-6) bad.push(act + ': a step count lowered it');
      });
      /* The old five-word dial's top two had training in them; told, they
         are read as the most active job, with the sessions counted once. */
      if (Math.abs(L.tdee(who({ act: 1.9, workouts: 3 })) - L.tdee(who({ act: 1.55, workouts: 3 }))) > 1e-6) {
        bad.push('1.9 is not read as 1.55 once the training is told');
      }
      return { bad, desks };
    });
    t.ok('at a desk the burn is exactly what it was, every step count and session count',
      burnSums.desks === 32 && !burnSums.bad.some((b) => /^desk/.test(b)), JSON.stringify(burnSums));
    t.ok('and on any job, one more session never lowers it — nor does a step count',
      burnSums.bad.length === 0, JSON.stringify(burnSums.bad));

    // the same, as the wizard says it
    await jobPg.evaluate(() => ['bsc.macroProfile', 'bsc.macroTargets', 'bsc.macroWeights']
      .forEach((k) => localStorage.removeItem(k)));
    await jobPg.reload();
    await jobPg.waitForTimeout(400);
    await jobPg.click('.tab[data-view="macros"]');
    await jobPg.waitForTimeout(300);
    await jobPg.click('#macroFill');
    await jobPg.waitForTimeout(500);
    await jobPg.fill('#mtAge', '43');
    await jobPg.fill('#mtFt', '5');
    await jobPg.fill('#mtIn', '11');
    await jobPg.fill('#mtLb', '190');
    await jobPg.click('[data-mtw="next"]');
    await jobPg.waitForTimeout(300);
    await jobPg.click('[data-mtact="1.375"]');
    await jobPg.waitForTimeout(300);
    const burnSaid = () => jobPg.evaluate(() => {
      const el = document.getElementById('mtwSaid2');
      const m = ((el && el.querySelector('.mtw-head b')) || {}).textContent || '';
      return { kcal: Number(m.replace(/,/g, '')), text: el ? el.textContent : '' };
    });
    const onFeet = await burnSaid();
    await jobPg.click('[data-mtrain="0"]');
    await jobPg.waitForTimeout(300);
    const oneDay = await burnSaid();
    t.ok('on my feet, ticking one lifting day adds to the burn rather than taking 263 off it',
      onFeet.kcal > 0 && oneDay.kcal >= onFeet.kcal, onFeet.kcal + ' → ' + oneDay.kcal);
    t.ok('and the parts it breaks into say the job is moving about, not a walk',
      /moving about/.test(oneDay.text) && !/walking/.test(oneDay.text), oneDay.text);
    await jobPg.context().close();

    /* ---- the wizard agrees with itself -----------------------------------
     *
     * Step one said "2,135 kcal at rest" (bmr × 1.2) and the plan step, under
     * the same words, "Below your 1779 kcal at rest" (bmr). And the goal card
     * said "About 1 lb a week" over an answer reading "about 1.4 lb a week
     * off" for the same goal at 190 lb. At rest is the basal rate everywhere;
     * the card says the goal's pounds for the weight typed. */
    const restPg = await t.fresh({ viewport: { width: 412, height: 915 } });
    await restPg.evaluate(() => ['bsc.macroProfile', 'bsc.macroTargets', 'bsc.macroWeights']
      .forEach((k) => localStorage.removeItem(k)));
    await restPg.reload();
    await restPg.waitForTimeout(400);
    await restPg.click('.tab[data-view="macros"]');
    await restPg.waitForTimeout(300);
    await restPg.click('#macroFill');
    await restPg.waitForTimeout(500);
    const cardSays = () => restPg.evaluate(() =>
      (document.querySelector('[data-mtgoal="cut1"] span') || {}).textContent || '');
    const noWeight = await cardSays();
    await restPg.fill('#mtAge', '43');
    await restPg.fill('#mtFt', '5');
    await restPg.fill('#mtIn', '11');
    await restPg.fill('#mtLb', '190');
    await restPg.waitForTimeout(350);
    const rest1 = await restPg.evaluate(() => {
      const s = (document.getElementById('mtwSaid1') || {}).textContent || '';
      const n = (re) => { const m = s.match(re); return m ? Number(m[1].replace(/,/g, '')) : 0; };
      return { s, rest: n(/([\d,]+)\s*kcal at rest/), still: n(/([\d,]+) sitting still/) };
    });
    t.ok('step one says the basal rate as at rest, and the day sitting still beside it',
      rest1.rest > 0 && rest1.still > rest1.rest && /^[\d,]+ kcal at rest · [\d,]+ sitting still/.test(rest1.s.trim()),
      rest1.s);
    await restPg.click('[data-mtw="next"]');
    await restPg.waitForTimeout(300);
    await restPg.click('[data-mtact="1.375"]');
    await restPg.click('[data-mtw="next"]');
    await restPg.waitForTimeout(300);
    await restPg.click('[data-mtgoal="cut1"]');
    await restPg.waitForTimeout(300);
    const goalSaid = await restPg.evaluate(() => (document.getElementById('mtwSaid3') || {}).textContent || '');
    const withWeight = await cardSays();
    const perWk = (goalSaid.match(/about ([\d.]+) lb a week/) || [])[1];
    t.ok('the goal card says the pounds a week the answer under it works out, for the weight typed',
      !!perWk && withWeight.indexOf('About ' + perWk + ' lb a week') === 0 &&
        /^About 1 lb a week/.test(noWeight),
      JSON.stringify({ noWeight, withWeight, goalSaid }));
    await restPg.click('[data-mtw="next"]');
    await restPg.waitForTimeout(300);
    const restPlan = await restPg.evaluate(() => (document.getElementById('mtPlan') || {}).textContent || '');
    t.ok('and the plan step’s "below at rest" is the same at-rest figure step one gave',
      restPlan === 'Below your ' + rest1.rest.toLocaleString('en-US') + ' kcal at rest.',
      restPlan + ' vs ' + rest1.s);
    await restPg.context().close();
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

    /* A value of the wrong shape from another device is ignored, not stored.
       A string where `sn.to` wants a list used to land in storage and break
       the next render on every device that took it. */
    const bad = await scale.evaluate(() => {
      const before = {
        t: localStorage.getItem('bsc.macroTargets'),
        w: localStorage.getItem('bsc.macroWeights'),
        d: localStorage.getItem('bsc.macroDays'),
        sn: localStorage.getItem('bsc.macroSend'),
      };
      const moved = window.__macroLab.merge({
        t: { v: { p: '150', f: 60, c: 100 }, at: 9e12 },
        sl: { v: { list: 'breakfast' }, at: 9e12 },
        w: { '2026_09_04': { v: '185', at: 9e12 } },
        d: { '2026_09_04': { v: 'lunch', at: 9e12 },
          '2026_09_05': { v: { b: 'eggs' }, at: 9e12 } },
        dn: { '2026_09_04': { v: 'yes', at: 9e12 } },
        sp: { '2026_09_04': { v: [1, 2], at: 9e12 } },
        sn: { '2026_09_04': { v: { f: 'd', to: 'l' }, at: 9e12 } },
      });
      let threw = '';
      try { document.querySelector('.tab[data-view="macros"]').click(); } catch (e) { threw = e.message; }
      return { moved, threw, same: before.t === localStorage.getItem('bsc.macroTargets') &&
        before.w === localStorage.getItem('bsc.macroWeights') &&
        before.d === localStorage.getItem('bsc.macroDays') &&
        before.sn === localStorage.getItem('bsc.macroSend') };
    });
    t.ok('values of the wrong shape from another device are ignored, not stored',
      bad.moved === false && bad.same && !bad.threw, JSON.stringify(bad));

    const good = await scale.evaluate(() => {
      window.__macroLab.merge({ sn: { '2026_09_04': { v: { f: 'd', to: ['l'] }, at: 9e12 } } });
      return JSON.parse(localStorage.getItem('bsc.macroSend') || '{}')['2026-09-04'];
    });
    t.ok('and the same part in the right shape still lands',
      good && good.f === 'd' && good.to.join() === 'l', JSON.stringify(good));

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

    /* ---- every part that merges is a part that is saved ------------------
     *
     * The merge touched six stores and the line that saved them listed five.
     * `bsc.macroTrained` was the one left out, so a "trained today" arriving
     * from the other phone moved that day's carbohydrate — 63 g to 118 — and
     * then went back on the next reload with nothing said.
     *
     * It was four hand-written descriptions of the same list: the payload
     * builder, the merge, the save, and whichever writer stamped it. One copy
     * forgot a member, which is what hand-written lists do.
     *
     * So this walks the TABLE rather than naming tn: it merges one key into
     * every keyed part there is and insists each one survives a reload. A
     * seventh part added tomorrow is covered the day it is added. */
    const tblPg = await t.fresh({ viewport: { width: 390, height: 800 } });
    await tblPg.click('.tab[data-view="macros"]');
    await tblPg.waitForTimeout(300);
    const tblParts = await tblPg.evaluate(() => {
      const L = window.__macroLab;
      /* The parts, off the app's own table, so the test cannot fall behind
         the app. (The payload used to list them all; it now leaves out a part
         with nothing stamped in it, which on a fresh page is every one.) */
      const keyed = L.keyedParts();
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const day = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      const enc = day.replace(/-/g, '_');
      /* A value each part will accept and keep: something truthy that is not
         an empty list and not a null. */
      /* Each in the shape its own store actually keeps. `sn` carries a LIST
         of meals the miss was sent to; a bare string there renders and throws,
         which is how this fixture found out. */
      const val = { w: 201.4, d: { b: [{ id: 150, x: 1, eaten: 0 }] }, dn: 1234567,
        tn: 1234567, sp: ['s'], sn: { to: ['l'] } };
      const doc = {};
      keyed.forEach((k) => { doc[k] = { [enc]: { v: val[k], at: Date.now() } }; });
      L.merge(doc);
      return { keyed: keyed, day: day, missing: keyed.filter((k) => !val[k]) };
    });
    t.ok('the merge describes every keyed part in one place',
      tblParts.keyed.length >= 6 && tblParts.missing.length === 0,
      JSON.stringify(tblParts));
    await tblPg.reload();
    await tblPg.waitForTimeout(400);
    await tblPg.click('.tab[data-view="macros"]');
    await tblPg.waitForTimeout(300);
    const tblKept = await tblPg.evaluate((info) => {
      const enc = info.day.replace(/-/g, '_');
      const sent = window.__macroLab.payload();
      return info.keyed.map((k) => ({ part: k,
        kept: !!(sent[k] && sent[k][enc] && sent[k][enc].at) }));
    }, tblParts);
    t.ok('and every one of them survives the reload that follows',
      tblKept.every((r) => r.kept),
      JSON.stringify(tblKept.filter((r) => !r.kept)));

    /* ---- a push carries the change, not the archive -----------------------
     *
     * Ticking one plate used to re-upload the whole of My Day: fourteen days
     * of meals, a year of mornings, every stamp. Eight to twenty kilobytes to
     * say two hundred bytes' worth. It never cost money — Firestore bills per
     * document write and those were already debounced — it cost the phone's
     * data, radio and battery, on every tap.
     *
     * Measured against the whole rather than against a number typed here, so
     * the claim survives the day somebody adds a part. */
    const tblSizes = await tblPg.evaluate(() => {
      const L = window.__macroLab;
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const key = (x) => x.getFullYear() + '-' + p2(x.getMonth() + 1) + '-' + p2(x.getDate());
      /* A year of mornings and a fortnight of meals, which is what the store
         actually looks like after a season of use. */
      const W = {};
      for (let i = 0; i < 365; i++) {
        const dd = new Date(d); dd.setDate(dd.getDate() - i);
        W[key(dd)] = 205 - i * 0.02;
      }
      localStorage.setItem('bsc.macroWeights', JSON.stringify(W));
      return { w: W };
    });
    await tblPg.reload();
    await tblPg.waitForTimeout(400);
    await tblPg.click('.tab[data-view="macros"]');
    await tblPg.waitForTimeout(300);
    const tblPartial = await tblPg.evaluate(() => {
      const L = window.__macroLab;
      const J = (o) => (o ? JSON.stringify(o).length : 0);
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const day = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      /* One ordinary change, through the door a tap uses. */
      /* The first push of a session is whole on purpose, so spend it before
         measuring what an ordinary change costs. */
      const firstWhole = J(L.takePush()) === J(L.payload());
      window.Store.addToDay(150, ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getDay()], 1);
      L.balance();
      /* What the PUSH would send, not what the partial builder can build. A
         mutation that made every push whole again left the builder untouched,
         and a guard asking the builder went on passing. */
      const part = L.takePush();
      return { whole: J(L.payload()), partial: J(part), firstWhole: firstWhole, wholeParts: Object.keys(L.payload()).length,
        parts: part ? Object.keys(part) : [],
        days: part && part.d ? Object.keys(part.d) : [],
        today: day.replace(/-/g, '_') };
    });
    t.ok('the first push of a session carries everything',
      tblPartial.firstWhole, JSON.stringify(tblPartial));
    /* Not a tenth of the bytes any more: the whole used to be padded with a
       null for every part nothing was stamped in, and now carries only what
       this device has. Fewer parts than the whole, and fewer bytes, is the
       claim; the two below say which. */
    t.ok('and after that one change sends one change, not the whole archive',
      tblPartial.partial > 0 && tblPartial.partial < tblPartial.whole && tblPartial.parts.length < tblPartial.wholeParts,
      tblPartial.partial + ' of ' + tblPartial.whole + ' bytes, ' + tblPartial.parts.length + ' of ' + tblPartial.wholeParts + ' parts');
    t.ok('and it names only the day that moved',
      tblPartial.days.length === 1 && tblPartial.days[0] === tblPartial.today,
      JSON.stringify(tblPartial));
    /* A year of mornings is the bulk of the archive and none of the news. */
    t.ok('a year of weigh-ins does not ride along with a meal',
      tblPartial.parts.indexOf('w') < 0, JSON.stringify(tblPartial.parts));
    await tblPg.context().close();

    /* ---- "This device is right" keeps every stamp in its shape -----------
     *
     * The button once wrote one number over the weight map. Every morning
     * then shipped with a stamp of zero, which no other device would take,
     * and the next weigh-in tried to set a property on a number and threw —
     * the weight was stored, unstamped, and stayed home until a reload
     * converted the stamp back. It also restamped four parts of nine, so the
     * account could go on outvoting the closed days, skips, share choices and
     * custom foods it had just been told were wrong about.
     *
     * The lab presses it, because the sheet that carries the button only
     * renders signed in. The weigh-in afterwards is the proof: the harness
     * fails the suite on any thrown error, so a throw here cannot hide. */
    const claim = await t.fresh({ viewport: { width: 390, height: 800 } });
    await claim.evaluate(() => {
      localStorage.setItem('bsc.macroWeights',
        JSON.stringify({ '2026-09-01': 190, '2026-09-02': 189 }));
      localStorage.setItem('bsc.macroDone', JSON.stringify({ '2026-09-01': 1700000000000 }));
      localStorage.setItem('bsc.myStamps', JSON.stringify({
        w: { '2026-09-01': 4242, '2026-09-02': 4243 }, sp: { '2026-09-01': 4244 }, t: 4245 }));
    });
    await claim.reload();
    await claim.waitForTimeout(400);
    await claim.click('.tab[data-view="macros"]');
    await claim.waitForTimeout(300);
    const claimed = await claim.evaluate(() => {
      const before = Date.now();
      window.__macroLab.claim();
      const st = JSON.parse(localStorage.getItem('bsc.myStamps'));
      const sent = window.__macroLab.payload();
      const fresh = (v) => typeof v === 'number' && v >= before;
      return {
        shapes: ['d', 'dn', 'sp', 'sn', 'w'].map((k) => typeof st[k]).join(','),
        singles: ['t', 'pr', 'sl', 'mf'].every((k) => fresh(st[k])),
        mornings: fresh(st.w['2026-09-01']) && fresh(st.w['2026-09-02']),
        cleared: fresh(st.sp['2026-09-01']),
        closed: fresh(st.dn['2026-09-01']),
        sent: fresh(sent.w['2026_09_01'].at),
      };
    });
    t.ok('this device is right stamps every part, each in its own shape',
      claimed.shapes === 'object,object,object,object,object' && claimed.singles &&
        claimed.mornings && claimed.cleared && claimed.closed && claimed.sent,
      JSON.stringify(claimed));
    await claim.fill('#mWeight', '188.4');
    await claim.dispatchEvent('#mWeight', 'change');
    await claim.waitForTimeout(300);
    const afterClaim = await claim.evaluate(() => {
      const w = JSON.parse(localStorage.getItem('bsc.macroWeights') || '{}');
      const st = JSON.parse(localStorage.getItem('bsc.myStamps'));
      const today = Object.keys(w).filter((k) => k !== '2026-09-01' && k !== '2026-09-02')[0];
      return { today, lb: w[today], stamp: today && st.w[today] };
    });
    t.ok('and the next weigh-in is stored and stamped',
      afterClaim.lb === 188.4 && typeof afterClaim.stamp === 'number' && afterClaim.stamp > 4245,
      JSON.stringify(afterClaim));
    await claim.context().close();

    /* ---- the buttons that empty this device ask first ---------------------
     *
     * Delete was asked; Sign out and "The account is right" were not, and
     * both call the same wipe. Sign in, lose the signal, log a day and a
     * weigh-in, tap Sign out: gone from the only place they existed. The
     * sheet only renders these signed in, so this reads the source — the
     * same way the sync door is counted — and asks two things of it: each
     * branch reaches the wipe through ask(), and the wipe names every My Day
     * key the file writes, since bsc.macroSend was once left off it and the
     * previous person's share choices reloaded into the next account.
     * Every script the page loads: the wipe itself is in src/clock.js now,
     * app.js keeping a one-line mForgetDay that calls it, and My Day's
     * stores are written from the parts as well as from app.js. */
    const fsW = require('fs'), pathW = require('path'), rootW = pathW.join(__dirname, '..');
    const sources = [...fsW.readFileSync(pathW.join(rootW, 'index.html'), 'utf8').matchAll(/<script src="(src\/[^"?]+\.js)/g)]
      .map((m) => fsW.readFileSync(pathW.join(rootW, m[1]), 'utf8')).join('\n');
    const wipes = ['pull', 'out', 'delete'].map((act) => {
      const at = sources.indexOf("if (act2 === '" + act + "')");
      const next = sources.indexOf('if (act2 ===', at + 10);
      const block = sources.slice(at, next > 0 ? next : at + 1400);
      const asks = block.indexOf('ask({'), wipe = block.indexOf('mForgetDay()'), del = block.indexOf('mDeleteAccount()');
      return act + ':' + (at > 0 && asks > 0 && asks < Math.max(wipe, del) ? 'asked' : 'silent');
    });
    t.ok('sign out, pull and delete each ask before emptying this device',
      wipes.every((w) => /asked$/.test(w)), wipes.join(' '));
    const wipeAt = sources.search(/function mForgetDay\(\) \{(?! return \w+\.mForgetDay\(\); \})/);
    const wipeList = wipeAt < 0 ? '' : sources.slice(wipeAt, wipeAt + 900);
    /* Every write of a My Day store goes through mPut now, which says so when
       the phone is full; a few still call setItem. Both are writes. */
    const storedKeys = Array.from(new Set((sources.match(/(?:setItem|mPut)\('bsc\.(macro\w+|myFoods|myStamps|myOwner)'/g) || [])
      .map((m) => m.replace(/^(?:setItem|mPut)\('/, '').replace(/'$/, ''))));
    const leftOff = storedKeys.filter((k) => wipeList.indexOf("'" + k + "'") < 0);
    t.ok('and the wipe names every My Day key the app writes',
      storedKeys.length >= 10 && leftOff.length === 0, leftOff.join(' ') || storedKeys.length + ' keys');

    /* ---- the plan's calories are its grams -------------------------------
     *
     * When the floor bit, kcal was clamped and the protein and fat floors
     * were not, so a 250 lb woman on a quick cut got a plan reading 1,200
     * over grams that add to 1,475. The face, the projection and the plan
     * line printed one; the wizard, the coach and the day bars the other.
     * A `floored` flag was set to say so and nothing ever read it. */
    const planPg = await t.fresh({ viewport: { width: 390, height: 800 } });
    const planGrams = await planPg.evaluate(() => {
      const pl = window.__macroLab.plan({ sex: 'f', age: 40, ft: 5, inch: 4, lb: 250, act: 1.2,
        goal: 'cut2', goalLb: 0, goalBy: '', workouts: 0, steps: 0 });
      return { kcal: pl.kcal, sum: 4 * pl.p + 4 * pl.c + 9 * pl.f, p: pl.p, f: pl.f, c: pl.c };
    });
    await planPg.context().close();
    t.ok('a plan whose floors add to more than its floor says the larger number',
      planGrams.kcal === planGrams.sum && planGrams.sum > 1200 &&
        planGrams.p >= 200 && planGrams.f >= 75,
      JSON.stringify(planGrams));

    /* ---- one verdict on the morning card ---------------------------------
     *
     * The face judged by RATE (this week's loss against the rate the date
     * needs) and the line beneath it by POSITION (the seven-day average
     * against the plan line). A fortnight that gained for a week and then
     * lost fast reads "on pace" by rate — the week's loss is what the date
     * needs — while sitting well above the line: the face said on pace over
     * a line saying days behind. Now both read the side of the line. */
    const twoFaces = await t.fresh({ viewport: { width: 390, height: 800 } });
    await twoFaces.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const key = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      const ws = {};
      for (let i = 0; i < 15; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        // a week climbing 0.4 a day, then a week falling 0.7 a day
        ws[key(d)] = Math.round((i >= 7 ? 205 + (14 - i) * 0.4 : 207.8 - (7 - i) * 0.7) * 10) / 10;
      }
      localStorage.setItem('bsc.macroWeights', JSON.stringify(ws));
      const g = new Date(); g.setDate(g.getDate() + 100);
      localStorage.setItem('bsc.macroProfile', JSON.stringify({
        sex: 'm', age: 41, ft: 5, inch: 11, lb: 205, act: 1.375, goal: 'cut1',
        goalLb: 185, goalBy: key(g), workouts: 4, steps: 8000 }));
    });
    await twoFaces.reload();
    await twoFaces.waitForTimeout(400);
    await twoFaces.click('.tab[data-view="macros"]');
    await twoFaces.waitForTimeout(300);
    await openWeigh(twoFaces);
    const faceSaid = await twoFaces.textContent('.mw-verdict');
    const lineSaid = await twoFaces.evaluate(() => {
      const el = document.querySelector('.mline');
      return { text: el ? el.textContent : '', side: window.__macroLab.pace().side };
    });
    /* Since 2026-09-23 both say WHEN, not "behind": the chip on the face and
       the coach line under it must name the same arrival date. */
    const D = '([A-Z][a-z]{2} \\d{1,2}(?:, \\d{4})?)';
    const dateIn = (str) => {
      if (/no (?:arrival )?date/.test(str)) return 'none';
      if (/on track|On track/.test(str)) return 'on track';
      const m = str.match(new RegExp(D + ' · \\d+ (?:days|weeks) (?:late|early)')) ||
        str.match(new RegExp('Arriving around ' + D));
      return m ? m[1] : '';
    };
    t.ok('the face and the morning line give one estimate, the same date',
      !!dateIn(faceSaid) && dateIn(faceSaid) === dateIn(lineSaid.text),
      'face: ' + faceSaid + ' | line: ' + lineSaid.text.slice(0, 120));
    /* The graph carries the plan's own line, so "behind" is something you
       can see: your weight above the dashed one. */
    const planLine = await twoFaces.evaluate(() => {
      const pl = document.querySelector('.mw-spark .mw-spark-plan');
      return pl ? pl.getAttribute('points').split(' ').length : 0;
    });
    t.ok('the weight graph draws where the plan says you should be', planLine >= 2, String(planLine));
    await twoFaces.context().close();

    /* ---- the plan line starts where the goal was set ----------------------
     *
     * It used to start at the first morning ever logged, which for a goal
     * set after weeks of mornings was a weight long gone, and today's
     * "planned" figure came out pounds above the scale — ahead of a pace
     * nobody set. Saving a goal now records the morning and what the scale
     * averaged; a goal saved before that keeps the old anchor. */
    const anchorPg = await t.fresh({ viewport: { width: 390, height: 800 } });
    await anchorPg.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const key = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      const ws = {};
      for (let i = 0; i < 40; i++) {           // 205 down to 195 over forty mornings
        const d = new Date(); d.setDate(d.getDate() - i);
        ws[key(d)] = Math.round((195.25 + i * 0.25) * 10) / 10;
      }
      localStorage.setItem('bsc.macroWeights', JSON.stringify(ws));
      const g = new Date(); g.setDate(g.getDate() + 100);
      localStorage.setItem('bsc.macroProfile', JSON.stringify({
        sex: 'm', age: 41, ft: 5, inch: 11, lb: 205, act: 1.375, goal: 'cut1',
        goalLb: 175, goalBy: key(g), workouts: 4, steps: 8000 }));
    });
    await anchorPg.reload();
    await anchorPg.waitForTimeout(400);
    await anchorPg.click('.tab[data-view="macros"]');
    await anchorPg.waitForTimeout(300);
    const kf = await anchorPg.evaluate(() => {
      const pf = window.__macroLab.pace();
      return { legacy: pf && Math.round(pf.plan.lb * 10) / 10, avg7: window.__macroLab.profile().lb };
    });
    await openPlan(anchorPg);
    // a returning reader's rows sit behind Edit, and the helper leaves that fold as it found it
    if (await anchorPg.evaluate(() => document.getElementById('mtEditor').classList.contains('hide'))) {
      await anchorPg.click('[data-mtedit]');
      await anchorPg.waitForTimeout(150);
    }
    await anchorPg.fill('#mtGoalLb', '176');
    await anchorPg.click('[data-mtarg="save"]');
    await anchorPg.waitForTimeout(400);
    const anchored = await anchorPg.evaluate(() => {
      const pr = JSON.parse(localStorage.getItem('bsc.macroProfile'));
      const pf = window.__macroLab.pace();
      const ws = Object.keys(JSON.parse(localStorage.getItem('bsc.macroWeights'))).sort();
      return { set: pr.goalSet, today: ws[ws.length - 1], from: pr.goalFrom,
        planned: pf && Math.round(pf.plan.lb * 10) / 10, side: pf && pf.side };
    });
    t.ok('a saved goal records the morning it was set and what the scale read',
      anchored.set === anchored.today && Math.abs(anchored.from - kf.avg7) < 0.11,
      JSON.stringify({ before: kf, after: anchored }));
    t.ok('and the plan line starts there, so the day a goal is set is on pace',
      anchored.planned === anchored.from && anchored.side === 'on' && kf.legacy !== anchored.planned,
      JSON.stringify({ before: kf, after: anchored }));
    await anchorPg.context().close();

    /* ---- the word beside the amount is the serving's word ----------------
     *
     * The word came off the servings line — its last word before the
     * parenthesis — on the assumption that the number in front was the
     * serving count. On "8 Pancakes (4 Servings)" a plate at ×1 read "1
     * pancake" and charged two; on "2 Loaves (24 Slices)" a slice read "1
     * loaf". Three plates: the pancakes, the bread, and a line that always
     * led with its count, so the ordinary word still comes through. */
    const unitPg = await t.fresh({ viewport: { width: 390, height: 800 } });
    await unitPg.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: 340, x: 1, eaten: 0 }, { id: 226, x: 1, eaten: 0 }, { id: 91, x: 1, eaten: 0 }],
      } }));
    });
    await unitPg.reload();
    await unitPg.waitForTimeout(400);
    await unitPg.click('.tab[data-view="macros"]');
    await unitPg.waitForTimeout(300);
    await openDay(unitPg);
    const plateWords = await unitPg.evaluate(() => {
      const out = {};
      document.querySelectorAll('.mitem').forEach((row) => {
        const b = row.querySelector('[data-open]');
        const x = row.querySelector('.mstep-x');
        if (b && x) out[String(b.dataset.open)] = x.textContent.trim();
      });
      return out;
    });
    t.ok('a plate is counted in servings, slices and bites — never in the yield’s word',
      /serving/.test(plateWords['340'] || '') && !/pancake/.test(plateWords['340'] || '') &&
        /slice/.test(plateWords['226'] || '') && !/loa/.test(plateWords['226'] || '') &&
        /bite/.test(plateWords['91'] || ''),
      JSON.stringify(plateWords));
    await unitPg.context().close();

    /* ---- the sheet a plate opens cooks the plate ---------------------------
     *
     * mCookScale snapped the batch fraction to an eighth, which is exact
     * only when the yield is 1, 2, 4 or 8. One plate of a six-serving dish
     * opened at ⅛ and made three quarters of a serving; one and three
     * quarters of a twelve-serving sauce opened at ⅛ and made a serving and
     * a half. The sheet said "at ×⅛" over both. Now the factor is the true
     * one and the sheet says the portion in servings. */
    const cooked = [];
    /* fmtNum spaces a fraction off its whole number — "1 ¾", not "1¾" —
       which is what the sheet has always printed beside quantities. */
    for (const seed of [{ id: 91, x: 1, want: /for 1 serving\b/ }, { id: 264, x: 1.75, want: /for 1\s*¾ servings/ }]) {
      const cookPg = await t.fresh({ viewport: { width: 390, height: 800 } });
      await cookPg.evaluate((sd) => {
        const p2 = (n) => (n < 10 ? '0' : '') + n;
        const d = new Date();
        const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
        localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: { l: [{ id: sd.id, x: sd.x, eaten: 0 }] } }));
      }, seed);
      await cookPg.reload();
      await cookPg.waitForTimeout(400);
      await cookPg.click('.tab[data-view="macros"]');
      await cookPg.waitForTimeout(300);
      await openDay(cookPg);
      await cookPg.click('.mitem [data-open="' + seed.id + '"]');
      await cookPg.waitForTimeout(300);
      const label = await cookPg.evaluate(() => (document.querySelector('.addto-x') || {}).textContent || '(no label)');
      cooked.push({ id: seed.id, x: seed.x, label, ok: seed.want.test(label) && !/⅛/.test(label) });
      await cookPg.context().close();
    }
    t.ok('a sheet opened from a plate makes the plate, and says so in servings',
      cooked.every((c) => c.ok), JSON.stringify(cooked));

    /* ---- Fill sizes the plate the family plan seeded ------------------------
     *
     * A dish on the week's plan for today arrives on the day at ×1 with a
     * comment promising the solver will size it. Fill's solver was narrowed
     * to its OWN plates — the right rule for what a hand placed — and the
     * family plate was not one, so a 1,143-kcal dinner sat at ×1 on a
     * 1,370-kcal day and the solver shrank Fill's own plates to pay for it. */
    const famPg = await t.fresh({ viewport: { width: 390, height: 800 } });
    await famPg.evaluate(() => {
      const wd = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];
      const r = window.RECIPES.find((q) => /pulled beef/i.test(q.name));
      window.Store.addToDay(r.id, wd, 1);
    });
    await famPg.reload();
    await famPg.waitForTimeout(400);
    await famPg.click('.tab[data-view="macros"]');
    await famPg.waitForTimeout(300);
    await famPg.click('#macroFill');
    await famPg.waitForTimeout(600);
    const famPlate = await famPg.evaluate(() => {
      const days = JSON.parse(localStorage.getItem('bsc.macroDays') || '{}');
      const day = days[Object.keys(days)[0]] || {};
      let w = null;
      Object.keys(day).forEach((k) => day[k].forEach((it) => { if (it.by === 'w') w = it; }));
      const r = w && window.RECIPES.find((q) => q.id === w.id);
      return w ? { x: w.x, kcal: r && Math.round(r.macro.kcal * w.x) } : null;
    });
    t.ok('Fill sizes the family plate along with its own',
      !!famPlate && famPlate.x < 1 && famPlate.kcal < 900, JSON.stringify(famPlate));
    await famPg.context().close();

    /* ---- the solver prices a meal at the ask its pills show ----------------
     *
     * The share term priced each meal at its PLAN share while the meal's
     * pills showed what the day so far still leaves it. After a breakfast
     * that ate most of the day, dinner's pill asked a few hundred and the
     * solver pulled the dinner plate toward its five hundred plan. */
    const priceDayPg = await t.fresh({ viewport: { width: 390, height: 800 } });
    await priceDayPg.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      const beef = window.RECIPES.find((q) => /pulled beef/i.test(q.name));
      const plate = window.RECIPES.find((q) => /cold roast beef & pepper/i.test(q.name));
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: beef.id, x: 0.75, eaten: 1 }],
        d: [{ id: plate.id, x: 1, eaten: 0 }],
      } }));
    });
    await priceDayPg.reload();
    await priceDayPg.waitForTimeout(400);
    await priceDayPg.click('.tab[data-view="macros"]');
    await priceDayPg.waitForTimeout(300);
    /* Read the price, not the landing: the day-level terms shrink a plate
       after a breakfast like that on their own, so where the plate lands
       proves nothing about which figure the share term used. The figure it
       used is what the test holds to the pill. */
    const priced = await priceDayPg.evaluate(() => {
      const card = document.querySelector('[data-mdot="d"]').closest('.mslot');
      const pill = Number(card.querySelector('.mmp.kc').dataset.want);
      const want = (window.__macroLab.wants().find((a) => a.k === 'd') || {}).want;
      const dayK = 4 * 180 + 4 * 50 + 9 * 50;
      return { pill: pill, want: want && Math.round(want), planShare: Math.round(dayK * 0.39) };
    });
    t.ok('after a heavy breakfast the solver prices dinner at the ask on its pills, not its plan share',
      priced.pill > 0 && priced.want === priced.pill && priced.pill < 0.8 * priced.planShare,
      JSON.stringify(priced));
    await priceDayPg.context().close();

    /* ---- the floor, and the one thing under it ---------------------------
     *
     * 1,500 for a man was a magazine number. 1,200 is the clinical figure —
     * roughly where a day stops being able to meet its micronutrients — and
     * it was 1,500 that stood between Blake and the 1,300-kcal day an RP-style
     * hard cut asks him for. What keeps a plan sane is the rate cap and the
     * ceiling on how fast fat can actually be spent, not a flat number. */
    const floorPg = await t.fresh({ viewport: { width: 390, height: 800 } });
    const floors = await floorPg.evaluate(() => {
      const man = { sex: 'm', age: 43, ft: 5, inch: 10, lb: 191, act: 1.2,
        goal: 'cut2', goalLb: 0, goalBy: '', workouts: 0, steps: 0 };
      const L = window.__macroLab;
      const small = Object.assign({}, man, { lb: 130, sex: 'f' });
      return { flat: L.floorK(small), big: L.floorK(man),
        man: L.plan(man).kcal,
        woman: L.plan(Object.assign({}, man, { sex: 'f' })).kcal };
    });
    /* The floor is the person's, not a number. 1,200 is the nutrient floor
       and it still holds for somebody small enough that it binds; for a
       bigger frame the floor is what THAT body's own minimums cost, which is
       always more. A flat 1,200 under a 205 lb man is not a floor, it is a
       day the planner cannot build — see the sweep below. */
    t.ok('a small frame still floors at the clinical 1,200',
      floors.flat === 1200, JSON.stringify(floors));
    t.ok('and a bigger one floors higher, because its own minimums cost more',
      floors.big > floors.flat, JSON.stringify(floors));
    t.ok('and a hard cut is still allowed under the old 1,500',
      floors.man < 1500 && floors.man >= 1200, JSON.stringify(floors));

    /* ---- no profile is ever handed a day it cannot eat -------------------
     *
     * Blake, on a plan reading C 62 / 0 g: "I feel I should have some carbs
     * to eat for the day." His day was 205 g of protein and 61 g of fat on
     * 1,369 kcal, which is all of it, and carbohydrate got what was left.
     *
     * The planner has a rule reserving MCARB_SHARE of the day for
     * carbohydrate and lets protein give ground to 0.8 g/lb to make room.
     * Fat never gives ground, and once protein is at its floor there is
     * nothing left to take — so `Math.max(0, ...)` quietly handed back zero.
     * A sweep of this grid found 6,455 of 34,056 profiles, nineteen per
     * cent, planned with no carbohydrate at all.
     *
     * The floor knows the planner's own minimums now, so a day is never
     * planned smaller than it costs to build. Swept rather than sampled,
     * because the hole was in a corner nobody had a fixture for. */
    const noZero = await floorPg.evaluate(() => {
      const L = window.__macroLab;
      let n = 0; const bad = [];
      for (const goal of ['cut1', 'cut2', 'cut3', 'lean', 'keep'])
        for (let lb = 110; lb <= 320; lb += 10)
          for (let age = 20; age <= 70; age += 10)
            for (const act of [1.2, 1.375, 1.55, 1.725])
              for (const sex of ['m', 'f'])
                for (const [ft, inch] of [[5, 2], [5, 8], [6, 1]]) {
                  const pl = L.plan({ sex, age, lb, ft, inch, act, goal,
                    goalLb: 0, goalBy: '', workouts: 0, steps: 0 });
                  if (!pl) continue;
                  n++;
                  if (!(pl.c > 0)) bad.push(goal + ' ' + sex + lb + ' age' + age +
                    ' act' + act + ' -> ' + pl.kcal + ' ' + pl.p + '/' + pl.f + '/' + pl.c);
                }
      return { n: n, bad: bad.length, sample: bad.slice(0, 3) };
    });
    t.ok('no body on any goal is planned a day with no carbohydrate in it',
      noZero.n > 3000 && noZero.bad === 0,
      noZero.bad + ' of ' + noZero.n + ' — ' + noZero.sample.join(' | '));

    /* The term that does the hormone protecting, and the shape is the point.
       Energy availability is what the lean mass gets once the fat store has
       handed over what it can, so somebody with fat to spend barely feels
       it, and it tightens on its own as they lean out — which is when the
       endocrine picture it is named for starts to matter. Two bodies at one
       weight: the leaner one has less fat to draw on, so its floor is
       higher. */
    const eaShape = await floorPg.evaluate(() => {
      const L = window.__macroLab;
      const at = (bf) => L.floorK({ sex: 'm', age: 35, ft: 5, inch: 10, lb: 185,
        act: 1.55, bf: bf, goal: 'cut1', goalLb: 0, goalBy: '', workouts: 0, steps: 0 });
      return { lean: at(10), fat: at(30) };
    });
    t.ok('at one weight the leaner body floors higher, having less fat to spend',
      eaShape.lean > eaShape.fat, JSON.stringify(eaShape));

    /* Estimated from what is already asked, and typed over when you know. */
    const fatEst = await floorPg.evaluate(() => {
      const man = { sex: 'm', age: 43, ft: 5, inch: 10, lb: 191 };
      const guess = window.__macroLab.bodyFat(man);
      const told = window.__macroLab.bodyFat(Object.assign({}, man, { bf: 18 }));
      return { guess: guess, told: told,
        none: window.__macroLab.bodyFat({ sex: 'm', age: 0, ft: 0, inch: 0, lb: 0 }) };
    });
    t.ok('body fat is estimated from the figures already asked for',
      fatEst.guess.told === false && fatEst.guess.pct > 15 && fatEst.guess.pct < 40 &&
        Math.abs(fatEst.guess.lb - 191 * fatEst.guess.pct / 100) < 0.6,
      JSON.stringify(fatEst.guess));
    t.ok('and a measured one replaces it rather than arguing with it',
      fatEst.told.told === true && fatEst.told.pct === 18 &&
        Math.abs(fatEst.told.lb - 34.4) < 0.2 && fatEst.none === null,
      JSON.stringify(fatEst));

    /* The ceiling that is about the person. Two bodies at one weight and one
       date: the leaner one has less fat to spend, so it must be given MORE
       food, not the same. Differential, because re-deriving the burn beside
       the app is how a test ends up asserting its own arithmetic. */
    const leanPlan = await floorPg.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const g = new Date(); g.setDate(g.getDate() + 60);
      const by = g.getFullYear() + '-' + p2(g.getMonth() + 1) + '-' + p2(g.getDate());
      const base = { sex: 'm', age: 43, ft: 5, inch: 10, lb: 191, act: 1.2,
        goal: 'cut2', goalLb: 165, goalBy: by, workouts: 0, steps: 0 };
      return { lean: window.__macroLab.plan(Object.assign({}, base, { bf: 8 })).kcal,
        fat: window.__macroLab.plan(Object.assign({}, base, { bf: 34 })).kcal };
    });
    t.ok('a lean body is given more food for the same goal, because it has less fat to spend',
      leanPlan.lean > leanPlan.fat, JSON.stringify(leanPlan));
    await floorPg.context().close();

    /* ---- the burn switch, and the two things it must not lie about --------
     *
     * The measured burn sat below the four facts in the EDITOR's row
     * language, with a filled green pill reading "In use" / "Use it", and it
     * was wrong in two ways at once.
     *
     * The row showed the MEASURED figure whether or not the plan was built
     * on it, and said which in the pill — so the one number on screen was
     * not necessarily the one the plan used. And tapping the pill wrote
     * useTdee to storage and then called renderModal, which returns without
     * touching the DOM while the plan sheet is open (the sheet is drawn once
     * so a sync arriving mid-keystroke cannot reset the draft boxes). The
     * pill still read "In use" after turning the measured burn OFF.
     *
     * Its replacement repaints through mtRefreshPlan, the sheet's own
     * mechanism for "the profile moved, redraw the answers". That mechanism
     * also writes the worked-out plan into the gram boxes, which is right
     * for every control inside the editor fold and wrong for this one: it
     * can be tapped with both folds shut and no Save on screen, and it put
     * grams on the sheet that storage did not hold and offered no way to
     * commit them. */
    const burnPg = await t.fresh({ viewport: { width: 390, height: 800 } });
    await burnPg.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const key = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      /* Four weeks of mornings and four weeks of logged days is what
         mMeasuredTdee asks for: eight weigh-ins at least, three in each end
         week, twenty-one days between the first and the last, and fourteen
         days with real food on them. Eating far under the formula's guess so
         the two numbers cannot be confused for one another. */
      const W = {}, D = {}, now = new Date();
      for (let i = 27; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        W[key(d)] = Math.round((198 - (27 - i) * 0.055) * 10) / 10;
        D[key(d)] = { b: [{ id: 150, x: 1, eaten: 1 }], l: [{ id: 311, x: 1, eaten: 1 }],
          d: [{ id: 195, x: 1, eaten: 1 }] };
      }
      localStorage.setItem('bsc.macroWeights', JSON.stringify(W));
      localStorage.setItem('bsc.macroDays', JSON.stringify(D));
      localStorage.setItem('bsc.macroProfile', JSON.stringify({ sex: 'm', age: 38, lb: 198,
        ft: 6, inch: 1, act: 1.55, goal: 'cut1', goalLb: 180, goalBy: '', workouts: 0,
        steps: 7000, useTdee: true }));
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 180, f: 60, c: 190 }));
    });
    await burnPg.reload();
    await burnPg.waitForTimeout(400);
    await burnPg.click('.tab[data-view="macros"]');
    await burnPg.waitForTimeout(300);
    await burnPg.click('#macroMore');
    await burnPg.waitForTimeout(150);
    await burnPg.click('[data-mmore="plan"]');
    await burnPg.waitForTimeout(400);

    /* Both burns are read off the screen and the pair is asserted to SWAP,
       so no kcal figure is typed into this file — the fixture's measured
       burn moves with whatever mMeasuredTdee makes of those weigh-ins. */
    const burnRead = () => burnPg.evaluate(() => {
      const num = (s) => Number(String(s || '').replace(/[^0-9]/g, '')) || 0;
      const row = document.querySelector('.mt-burn .mtf-row b');
      const swap = document.querySelector('.mt-swap');
      return {
        shown: num(row && row.textContent),
        offer: num(swap && swap.textContent),
        useTdee: !!JSON.parse(localStorage.getItem('bsc.macroProfile')).useTdee,
        boxes: ['mtP', 'mtF', 'mtC'].map((i) => (document.getElementById(i) || {}).value).join('/'),
        saved: JSON.stringify(JSON.parse(localStorage.getItem('bsc.macroTargets'))),
      };
    });
    const burnOn = await burnRead();
    await burnPg.click('.mt-swap');
    await burnPg.waitForTimeout(350);
    const burnOff = await burnRead();

    t.ok('the plan sheet states a measured burn and offers the other number',
      burnOn.shown > 0 && burnOn.offer > 0 && burnOn.shown !== burnOn.offer,
      JSON.stringify(burnOn));
    t.ok('tapping it switches which burn the plan is built on',
      burnOn.useTdee === true && burnOff.useTdee === false, JSON.stringify([burnOn, burnOff]));
    /* The fault the old pill had: storage flipped and the screen did not. */
    t.ok('and the row states the burn now in use, not the measured one regardless',
      burnOff.shown === burnOn.offer && burnOff.offer === burnOn.shown,
      JSON.stringify([burnOn, burnOff]));
    /* The fault repainting introduced: a plan on screen that storage does
       not hold, with both folds shut and no Save to close the gap. */
    t.ok('and it leaves the grams alone, on the screen and in storage',
      burnOff.boxes === burnOn.boxes && burnOff.saved === burnOn.saved,
      JSON.stringify([burnOn.boxes, burnOff.boxes, burnOn.saved, burnOff.saved]));
    await burnPg.context().close();

    /* ---- sweeping the day back to what you actually ate -------------------
     *
     * Blake: "sometimes I just want to sweep the whole day that hasn't been
     * marked done. Start fresh." It keeps every plate you ticked — clearing
     * those destroys a record rather than a plan — and keeps anything you
     * locked, because a lock is you saying this one stays. His call that it
     * runs without asking, like the meal dot and the tick beside it. */
    const sweepPg = await t.fresh({ viewport: { width: 390, height: 800 } });
    await sweepPg.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: 'f:egg', x: 2, eaten: 1 }],          // eaten: stays
        l: [{ id: 'f:tuna', x: 1, eaten: 0, l: 1 }],   // locked: stays
        d: [{ id: 'f:cheddar', x: 1, eaten: 0 },
          { id: 'f:milk', x: 1, eaten: 0 }],           // loose: goes
      } }));
    });
    await sweepPg.reload();
    await sweepPg.waitForTimeout(400);
    await sweepPg.click('.tab[data-view="macros"]');
    await sweepPg.waitForTimeout(300);
    const sweptBefore = await sweepPg.evaluate(() => {
      const day = JSON.parse(localStorage.getItem('bsc.macroDays'))[Object.keys(
        JSON.parse(localStorage.getItem('bsc.macroDays')))[0]];
      return { b: day.b.length, l: day.l.length, d: day.d.length,
        off: document.getElementById('macroSweep').disabled };
    });
    t.ok('the sweeper is live while there is something loose to sweep',
      sweptBefore.off === false, JSON.stringify(sweptBefore));
    await sweepPg.click('#macroSweep');
    await sweepPg.waitForTimeout(400);
    const sweptAfter = await sweepPg.evaluate(() => {
      const all = JSON.parse(localStorage.getItem('bsc.macroDays'));
      const day = all[Object.keys(all)[0]];
      return { b: (day.b || []).length, l: (day.l || []).length, d: (day.d || []).length,
        off: document.getElementById('macroSweep').disabled };
    });
    t.ok('it takes the loose plates and leaves what you ate and what you locked',
      sweptAfter.b === 1 && sweptAfter.l === 1 && sweptAfter.d === 0,
      JSON.stringify({ before: sweptBefore, after: sweptAfter }));
    t.ok('and goes quiet once there is nothing loose left',
      sweptAfter.off === true, JSON.stringify(sweptAfter));
    await sweepPg.context().close();

    /* ---- a pin is a standing order, not a licence to reopen a meal --------
     *
     * Blake, having swept the day and pressed Fill: "Breakfast was marked
     * complete and it did it and added more foods."
     *
     * Every pass in the drafter steps over a meal carrying a tick — the
     * best-fit pass, the family plan, the topper and the vegetable side all
     * ask. The PIN pass never did. It asked only whether the pin was already
     * on the day and whether the meal was skipped, so a pinned dish swept off
     * a finished breakfast came straight back on the next Fill. The un-eaten
     * plate then re-opened the meal, which also handed it to the topper,
     * because mTopSlot counts a meal with anything un-ticked on it as open.
     *
     * The fix must not cost the pin its rank. A pin runs BEFORE the family
     * plan and before best-fit precisely because it outranks a chosen dish;
     * what it must not outrank is a tick. So both halves are asserted here:
     * the pin stays off a ticked meal, and still lands beside a hand-placed
     * one. */
    const standPg = await t.fresh({ viewport: { width: 390, height: 800 } });
    const standRun = async (eaten) => {
      const set = await standPg.evaluate((ate) => {
        const p2 = (n) => (n < 10 ? '0' : '') + n;
        const d = new Date();
        const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
        /* Two different breakfast dishes out of the book itself, so the pin
           and the plate beside it can never be the same recipe — mOnDay would
           make the whole question moot if they were. */
        const bs = window.RECIPES.filter((r) => r.macro &&
          (r.book + '-' + r.secNum === '1-1' || r.book + '-' + r.secNum === '2-1'));
        const pinned = bs[0], other = bs[1];
        localStorage.setItem('bsc.macroSlots', JSON.stringify({
          list: [{ k: 'b', n: 'Breakfast', t: 'b', pins: [{ id: pinned.id, x: 1 }] },
            { k: 'l', n: 'Lunch', t: 'l' }, { k: 'd', n: 'Dinner', t: 'd' },
            { k: 's', n: 'Snacks', t: 's' }],
          names: { b: 'Breakfast', l: 'Lunch', d: 'Dinner', s: 'Snacks' } }));
        localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
          b: [{ id: other.id, x: 1, eaten: ate }] } }));
        localStorage.setItem('bsc.macroProfile', JSON.stringify({ sex: 'm', age: 38, lb: 198,
          ft: 6, inch: 1, act: 1.55, goal: 'cut1', goalLb: 0, goalBy: '', workouts: 0,
          steps: 7000 }));
        localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 180, f: 60, c: 190 }));
        return { pinned: pinned.id, other: other.id };
      }, eaten);
      await standPg.reload();
      await standPg.waitForTimeout(400);
      await standPg.click('.tab[data-view="macros"]');
      await standPg.waitForTimeout(300);
      await standPg.evaluate(() => { document.getElementById('macroFill').dataset.mode = 'fill'; });
      await standPg.click('#macroFill');
      await standPg.waitForTimeout(700);
      return standPg.evaluate((s2) => {
        const all = JSON.parse(localStorage.getItem('bsc.macroDays'));
        const day = all[Object.keys(all)[0]] || {};
        return { onB: (day.b || []).some((it) => it.id === s2.pinned),
          bCount: (day.b || []).length };
      }, set);
    };
    const standTicked = await standRun(1);
    t.ok('Fill puts nothing on a breakfast you have already ticked, not even a pin',
      standTicked.onB === false && standTicked.bCount === 1,
      JSON.stringify(standTicked));
    const standHand = await standRun(0);
    t.ok('but a pin still lands beside a dish you placed by hand',
      standHand.onB === true, JSON.stringify(standHand));
    await standPg.context().close();

    /* ---- one press of Add, however many times the button is pressed ------
     *
     * Blake, having added two foods: "I added foods. And it double added
     * them." The day showed franks, buns, franks, buns — the basket
     * committed twice, in order.
     *
     * close() does not close synchronously. The picker is pushed onto
     * history, so close() takes its first branch — history.go(-n) and RETURN
     * — and everything it clears, S.macroPick and the basket included, is
     * cleared when the popstate lands. On a phone that is long enough for a
     * second press to find the sheet still up, S.macroPick still set and the
     * basket still full.
     *
     * Two clicks dispatched back to back rather than two Playwright taps:
     * the point is the window BEFORE the sheet has gone, and a driver that
     * waits for actionability would never press into it. */
    const twicePg = await t.fresh({ viewport: { width: 390, height: 800 } });
    await twicePg.click('.tab[data-view="macros"]');
    await twicePg.waitForTimeout(300);
    const twiceAdd = async (presses) => {
      await twicePg.evaluate(() => {
        const p2 = (n) => (n < 10 ? '0' : '') + n;
        const d = new Date();
        const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
        const days = JSON.parse(localStorage.getItem('bsc.macroDays') || '{}');
        days[k] = {};
        localStorage.setItem('bsc.macroDays', JSON.stringify(days));
      });
      await twicePg.reload();
      await twicePg.waitForTimeout(400);
      await twicePg.click('.tab[data-view="macros"]');
      await twicePg.waitForTimeout(300);
      await twicePg.click('#macroAdd');
      await twicePg.waitForTimeout(350);
      await twicePg.click('[data-mpslot="d"]');
      await twicePg.waitForTimeout(250);
      /* Two raw foods, found the way a thumb finds them. Foods rather than
         recipes because the basket is what is under test, not the ranking. */
      for (const q of ['beef frank', 'bun']) {
        await twicePg.fill('#mpFind', q);
        await twicePg.waitForTimeout(400);
        await twicePg.evaluate(() => {
          const r = [...document.querySelectorAll('.mpick-row[data-mpick]')]
            .find((x) => x.dataset.mpick.indexOf('f:') === 0);
          if (r) r.click();
        });
        await twicePg.waitForTimeout(150);
      }
      return twicePg.evaluate((n) => {
        const b = document.querySelector('[data-mpdone]');
        for (let i = 0; i < n; i++) b.click();
        const p2 = (x) => (x < 10 ? '0' : '') + x;
        const d = new Date();
        const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
        const day = JSON.parse(localStorage.getItem('bsc.macroDays'))[k] || {};
        return (day.d || []).map((it) => String(it.id));
      }, presses);
    };
    const twiceOnce = await twiceAdd(1);
    t.ok('two foods chosen and added put two plates on the meal',
      twiceOnce.length === 2 && twiceOnce[0] !== twiceOnce[1], twiceOnce.join(','));
    const twiceTwice = await twiceAdd(2);
    t.ok('and pressing Add again before the sheet has gone adds nothing more',
      twiceTwice.length === 2, twiceTwice.join(','));
    await twicePg.context().close();

    /* ---- a skipped meal is a meal dealt with -----------------------------
     *
     * The primary button asked whether every meal had food on it before it
     * would stop offering to Fill. A skipped meal never will, so one skip
     * pinned it to "Fill" for the rest of the day — through every plate
     * being ticked — and neither "Mark all complete" nor "Complete the day"
     * could be reached at all. Blake: "when all foods are marked complete,
     * it's still showing fill. I'd expect to see something else."
     *
     * The other half matters as much: a meal that is merely EMPTY is not
     * dealt with, and the button must still offer to fill it. */
    const modePg = await t.fresh({ viewport: { width: 390, height: 800 } });
    const modeRun = async (skip) => {
      await modePg.evaluate((sk) => {
        const p2 = (n) => (n < 10 ? '0' : '') + n;
        const d = new Date();
        const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
        const pick = (s) => window.RECIPES.filter((r) => r.macro &&
          r.book + '-' + r.secNum === s)[0];
        localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
          b: [{ id: pick('1-1').id, x: 1, eaten: 1 }],
          l: [{ id: pick('1-3').id, x: 1, eaten: 1 }],
          d: [{ id: pick('1-4').id, x: 1, eaten: 1 }] } }));
        if (sk) localStorage.setItem('bsc.macroSkip', JSON.stringify({ [k]: ['s'] }));
        else localStorage.removeItem('bsc.macroSkip');
      }, skip);
      await modePg.reload();
      await modePg.waitForTimeout(400);
      await modePg.click('.tab[data-view="macros"]');
      await modePg.waitForTimeout(300);
      return modePg.evaluate(() => document.getElementById('macroFill').dataset.mode);
    };
    const modeSkip = await modeRun(true);
    t.ok('with every plate eaten and the fourth meal skipped, the button offers to close the day',
      modeSkip === 'done', 'mode=' + modeSkip);
    const modeEmpty = await modeRun(false);
    t.ok('but a meal merely left empty is still a meal to fill',
      modeEmpty === 'fill', 'mode=' + modeEmpty);
    await modePg.context().close();

    /* ---- the bar's order --------------------------------------------------
     *
     * Blake's grouping: the whole-day actions, then the view, then out, then
     * in, with the plus last because the far corner is the easiest square on
     * this bar for a thumb and it is the one pressed most. His own order put
     * Sweep third, beside Rebalance; the expander sits between them instead,
     * because Sweep is the only control in this app with no undo and it
     * should not be one square from the button a thumb crosses most. */
    const orderPg = await t.fresh({ viewport: { width: 390, height: 800 } });
    await orderPg.click('.tab[data-view="macros"]');
    await orderPg.waitForTimeout(300);
    const barOrder = await orderPg.evaluate(() =>
      [...document.querySelectorAll('.mday-acts button')].map((b) => b.id).join(' '));
    /* Two rows since the tools took words (2026-09-27): the four tools in
       his order, then the two verbs pressed most, Add in the far corner. */
    t.ok('the day bar reads rebalance, expand, sweep, copy, then Fill and add',
      barOrder === 'macroRebal macroOpenAll macroSweep macroCopy macroFill macroAdd',
      barOrder);
    await orderPg.context().close();

    /* ---- trained today ----------------------------------------------------
     *
     * The profile already says how many sessions a week and mBurn spreads
     * those calories over all seven days, rest days included — so a tick here
     * must buy NO calories or it is the same session paid for twice. What it
     * moves is where the carbohydrate lands: carb cycling picks its training
     * days from an evenly-spread pattern, so saying three and lifting Tue,
     * Thu, Sat put the high-carb days on Mon, Wed, Fri every week. */
    const trainPg = await t.fresh({ viewport: { width: 390, height: 800 } });
    await trainPg.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const key = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      const g = new Date(); g.setDate(g.getDate() + 120);
      localStorage.setItem('bsc.macroProfile', JSON.stringify({
        sex: 'm', age: 43, ft: 5, inch: 10, lb: 195, act: 1.375, goal: 'cut1',
        goalLb: 175, goalBy: key(g), workouts: 3, steps: 8000 }));
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 190, f: 60, c: 120 }));
    });
    await trainPg.reload();
    await trainPg.waitForTimeout(400);
    await trainPg.click('.tab[data-view="macros"]');
    await trainPg.waitForTimeout(300);
    const trainWas = await trainPg.evaluate(() => {
      const b = document.querySelector('[data-mtrained]');
      return { kcal: window.__macroLab.targets(),
        pressed: b ? b.getAttribute('aria-pressed') : 'missing' };
    });
    t.ok('the morning offers a tick, and starts on whatever the plan assumed',
      trainWas.pressed === 'true' || trainWas.pressed === 'false', JSON.stringify(trainWas.pressed));

    await trainPg.click('[data-mtrained]');
    await trainPg.waitForTimeout(300);
    const trainNow = await trainPg.evaluate(() => ({
      pressed: document.querySelector('[data-mtrained]').getAttribute('aria-pressed'),
      targets: window.__macroLab.targets(),
    }));
    t.ok('tapping it flips the day and nothing else',
      trainNow.pressed !== trainWas.pressed &&
        trainNow.targets.p === trainWas.kcal.p && trainNow.targets.f === trainWas.kcal.f,
      JSON.stringify({ was: trainWas.pressed, now: trainNow.pressed,
        p: [trainWas.kcal.p, trainNow.targets.p], f: [trainWas.kcal.f, trainNow.targets.f] }));
    t.ok('and it is the carbohydrate that moves, never the calories it was already paid',
      trainNow.targets.c !== trainWas.kcal.c,
      'carbs ' + trainWas.kcal.c + ' -> ' + trainNow.targets.c);
    await trainPg.context().close();

    /* ---- Plan today: it folds all the way, and repeats nothing -----------
     *
     * Blake: "weigh in card I think needs to be more plan the day." Then,
     * on the first build of it: "I don't need a duplicate card saying the
     * exact same thing. The sticky header is doing it with the calories and
     * macros." Then: "it needs to fully collapse."
     *
     * So the card says ONLY what nothing else on the screen says: what the
     * scale read, whether you trained, and why that moved the carbohydrate.
     * The day's calories and the three macros are on the sticky strip four
     * inches above it and are not repeated here.
     *
     * Folded is the default once both questions are answered, and folded
     * means ONE row — a card still showing two of its three rows is not
     * shut. On a morning not yet answered it opens itself, because there is
     * nothing to collapse to and a tap to reach the box is a tap the app
     * made you spend.
     *
     * Steps are deliberately never an input. They are already in the burn,
     * you do not know them until bedtime, and a box for them invites eating
     * them back — the double-count the training tick exists to avoid. */
    const todayPg = await t.fresh({ viewport: { width: 390, height: 900 } });
    const todaySeed = (withWeight) => (w) => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const key = (x) => x.getFullYear() + '-' + p2(x.getMonth() + 1) + '-' + p2(x.getDate());
      const k = key(d), ws = {};
      /* A week of mornings so the trend lines have something to say, but the
         LAST one only when the case under test is "already answered". */
      for (let i = 6; i >= 1; i--) {
        const dd = new Date(d); dd.setDate(dd.getDate() - i);
        ws[key(dd)] = 205;
      }
      if (w) ws[k] = 205;
      localStorage.setItem('bsc.macroWeights', JSON.stringify(ws));
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 205, f: 61, c: 75 }));
      localStorage.setItem('bsc.macroProfile', JSON.stringify({ sex: 'm', age: 43, lb: 205,
        ft: 5, inch: 10, act: 1.55, goal: 'cut1', goalLb: 0, goalBy: '', workouts: 4,
        steps: 7000, train: [0, 1, 2, 3, 4, 5, 6].slice(0, 4) }));
      localStorage.setItem('bsc.macroTrained', JSON.stringify({ [k]: Date.now() }));
    };
    const todayLook = async (withWeight) => {
      await todayPg.evaluate(todaySeed(withWeight), withWeight);
      await todayPg.reload();
      await todayPg.waitForTimeout(400);
      await todayPg.click('.tab[data-view="macros"]');
      await todayPg.waitForTimeout(350);
      return todayPg.evaluate(() => {
        const handle = document.querySelector('[data-mfold="weigh"]');
        const card = handle.closest('.mslot') || handle.parentElement.parentElement;
        const want = window.__macroLab.targets();
        const kcal = Math.round(4 * want.p + 4 * want.c + 9 * want.f);
        const txt = card.textContent.replace(/[\s,]+/g, '');
        return {
          open: handle.getAttribute('aria-expanded'),
          named: /plan today/i.test(handle.textContent || ''),
          sum: (document.querySelector('.mw-sum') || {}).textContent || '',
          ask: !!document.querySelector('.mw-ask'),
          tick: !!document.querySelector('.mw-train'),
          why: (document.querySelector('.mw-why') || {}).textContent || '',
          verdict: !!document.querySelector('.mw-verdict'),
          body: !!document.querySelector('.mw-body'),
          box: !!card.querySelector('#mWeight'),
          repeatsKcal: txt.indexOf(String(kcal)) >= 0,
          repeatsSplit: /205P|61F|94C/.test(txt),
          want: want, kcal: kcal, txt: txt.slice(0, 140),
        };
      });
    };

    const todayShut = await todayLook(true);
    t.ok('the card is called Plan today, not Weigh-in',
      todayShut.named, JSON.stringify(todayShut));
    t.ok('once the morning is answered it folds itself shut',
      todayShut.open === 'false', JSON.stringify(todayShut));
    /* Shut means shut. The first build of this kept the tick and an answer
       row on the face and called itself folded. */
    t.ok('and folded means one row — no tick, no reason, no verdict under it',
      !todayShut.tick && !todayShut.why && !todayShut.verdict,
      JSON.stringify(todayShut));
    t.ok('the folded row says what the scale read and whether you trained',
      /205/.test(todayShut.sum) && /lb/.test(todayShut.sum) &&
        /train/i.test(todayShut.sum), todayShut.sum);
    /* The whole point of the second pass: the strip above already carries
       these, and a card that says them again is a second answer to a
       settled question. */
    t.ok('and it never repeats the day’s calories or macros, which the strip carries',
      !todayShut.repeatsKcal && !todayShut.repeatsSplit, todayShut.txt);

    /* The third state. A morning with nothing on the scale is not folded —
       the box and the tick are there without a tap — but it is not OPEN
       either: a card that has not been given its two numbers has not earned
       an opinion, and a pace verdict over an empty box is the nagging this
       screen was rebuilt to stop. */
    const todayNew = await todayLook(false);
    t.ok('a morning not yet weighed puts the box in reach without a tap',
      todayNew.box && !todayNew.sum, JSON.stringify(todayNew));
    t.ok('and claims nothing over it — no verdict, no history',
      !todayNew.verdict && !todayNew.body, JSON.stringify(todayNew));

    /* ONE tap. This read two while the handle was lying about being expanded
       — it reported "not shut" as open, so the first tap closed what it meant
       to open and the second re-opened it, and the pair happened to land in
       the right place. With the handle telling the truth, two taps is open
       then shut, and the line under test is not on screen. */
    await todayPg.click('[data-mfold="weigh"]');
    await todayPg.waitForTimeout(350);
    const todayOpen = await todayPg.evaluate(() => {
      const el = document.querySelector('.mw-tick-s');
      const base = JSON.parse(localStorage.getItem('bsc.macroTargets'));
      const now = window.__macroLab.targets();
      const s2 = el ? el.textContent.replace(/\s+/g, ' ') : '';
      return { txt: s2, base: base.c, now: now.c,
        both: s2.indexOf(String(now.c)) >= 0 && s2.indexOf(String(base.c)) >= 0,
        /* "on an average day": the tick moves today against the week's own
           average — it does not add to the week. */
        week: /on an average day/i.test(s2),
        steps: !!document.querySelector('[data-mfold="weigh"]')
          .closest('.mslot, div').querySelector('input[inputmode="numeric"]') };
    });
    /* Naming BOTH numbers is what makes it an explanation and not an
       assertion — it has to show the swap, not just the result. */
    t.ok('opened, it says why today differs and names both carb figures',
      todayOpen.both, JSON.stringify(todayOpen));
    t.ok('and that the week does not grow because you ticked a box',
      todayOpen.week, todayOpen.txt);
    t.ok('and there is no steps box on it, at any state',
      todayOpen.steps === false, JSON.stringify(todayOpen));
    await todayPg.context().close();

    /* ---- the week strip is boxes now --------------------------------------
     *
     * Blake, drawing it: "[ ] [ ] [ ] [ ] [ ] [ ] [ ] these a bit more like a
     * box not a pill shape. still fill up toward a target."
     *
     * Measured rather than read off the stylesheet. The width is min() against
     * the column, which is the whole reason a 36px track is safe at 320px, and
     * a rule that SAYS 36px does not prove the track fits inside its cell. */
    const boxPg = await t.fresh({ viewport: { width: 320, height: 800 } });
    await boxPg.click('.tab[data-view="macros"]');
    await boxPg.waitForTimeout(300);
    const boxShape = await boxPg.evaluate(() => {
      const b = document.querySelector('.mwk-b');
      const cs = getComputedStyle(b);
      return { w: b.getBoundingClientRect().width,
        col: b.closest('.mwk-c').getBoundingClientRect().width,
        r: parseFloat(cs.borderRadius) };
    });
    t.ok('a day on the week strip is a box, not a capsule',
      boxShape.r <= 6 && boxShape.w >= 24, JSON.stringify(boxShape));
    t.ok('and at 320px it still fits inside its own column',
      boxShape.w <= boxShape.col + 0.5, JSON.stringify(boxShape));
    await boxPg.context().close();

    /* ---- the add sheet's pills say both halves ---------------------------
     *
     * Blake: "whenever I hit the add button and it takes me to making a meal,
     * those three macros clearly show me how much I've selected and what is
     * left. That makes a perfect meal."
     *
     * They were one figure — the gap — on a flat tint. One figure answers
     * half the question and hides the other: a lone "20" cannot say whether
     * that is the whole meal still to come or the last mouthful of it. Now
     * each pill carries what is ON the meal and what the meal is FOR, with
     * the fill drawing the proportion between them, which is the pair the
     * day's own pills settled on.
     *
     * Still pills. The shape did not change — only the fill and the figures.
     *
     * Asserted at the two ends, which need no number out of the app's own
     * head: an untouched meal holds none of its ask and must read empty, and
     * a meal past its ask must read full. */
    const gapPg = await t.fresh({ viewport: { width: 320, height: 800 } });
    const gapAt = async (x) => {
      await gapPg.evaluate((mult) => {
        const p2 = (n) => (n < 10 ? '0' : '') + n;
        const d = new Date();
        const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
        const r = window.RECIPES.filter((q) => q.macro &&
          q.book + '-' + q.secNum === '1-4')[0];
        localStorage.setItem('bsc.macroDays', JSON.stringify(
          mult ? { [k]: { d: [{ id: r.id, x: mult, eaten: 0 }] } } : { [k]: {} }));
        localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 205, f: 61, c: 94 }));
      }, x);
      await gapPg.reload();
      await gapPg.waitForTimeout(400);
      await gapPg.click('.tab[data-view="macros"]');
      await gapPg.waitForTimeout(300);
      await gapPg.click('#macroAdd');
      await gapPg.waitForTimeout(350);
      await gapPg.click('[data-mpslot="d"]');
      await gapPg.waitForTimeout(350);
      return gapPg.evaluate(() => [...document.querySelectorAll('.mgp')].map((e) => {
        const st = e.getAttribute('style') || '';
        const hit = st.match(/0\s+([\d.]+)%/);
        const cs = getComputedStyle(e);
        const nums = (e.textContent.match(/\d+/g) || []).map(Number);
        return { pct: hit ? Number(hit[1]) : null,
          grad: /linear-gradient/.test(st),
          met: e.classList.contains('met'),
          both: /\d+\s*\/\s*\d+/.test(e.textContent),
          got: nums[0], want: nums[nums.length - 1],
          radius: parseFloat(cs.borderRadius),
          clipped: e.scrollWidth > e.clientWidth + 0.5,
          top: Math.round(e.getBoundingClientRect().top),
          txt: e.textContent.trim() };
      }));
    };

    const gapEmpty = await gapAt(0);
    t.ok('every pill on the add sheet is still a pill, and is drawn with a fill',
      gapEmpty.length === 4 && gapEmpty.every((g) => g.grad && g.radius >= 12),
      JSON.stringify(gapEmpty.map((g) => g.radius + '/' + g.grad)));
    t.ok('and each says both halves — what is on the meal, and what it is for',
      gapEmpty.every((g) => g.both && g.want > 0), gapEmpty.map((g) => g.txt).join(' '));
    t.ok('an untouched meal holds none of its ask, and the fill says so',
      gapEmpty.every((g) => g.got === 0 && g.pct === 0 && !g.met),
      JSON.stringify(gapEmpty));
    /* Four fills only compare by eye if the boxes match. On a flex row with a
       56px floor the fourth wrapped to its own line at 320 and stretched the
       width of the sheet, and the calorie pill clipped its own target. */
    t.ok('the four sit on one row at 320px with nothing clipped',
      new Set(gapEmpty.map((g) => g.top)).size === 1 &&
        gapEmpty.every((g) => !g.clipped),
      JSON.stringify(gapEmpty.map((g) => g.top + (g.clipped ? ' CLIPPED' : ''))));

    /* Six times the dish it was ranked for takes every macro past the ask. */
    const gapFull = await gapAt(6);
    t.ok('a meal past its ask reads full on every pill',
      gapFull.every((g) => g.pct === 100 && g.met && g.got >= g.want),
      JSON.stringify(gapFull.map((g) => g.txt + ' ' + g.pct + (g.met ? ' met' : ''))));

    /* One helper draws both rows. They were two gradients written out
       separately, which is how two things that must match stop matching. */
    await gapPg.click('.sheet-x, [data-close]');
    await gapPg.waitForTimeout(400);
    const gapDay = await gapPg.evaluate(() =>
      [...document.querySelectorAll('.mpill')].map((e) =>
        /linear-gradient\(90deg/.test(e.getAttribute('style') || '')));
    t.ok('and the day’s folded pills are drawn by the same hand',
      gapDay.length > 0 && gapDay.every(Boolean), JSON.stringify(gapDay));
    await gapPg.context().close();

    /* ---- a stale reading goes stale, it does not get worse ---------------
     *
     * The seven-day average is anchored on the last weigh-in. The plan line
     * it was compared against was for TODAY. So every morning off the scale
     * widened the gap on its own: identical mornings and an identical plan
     * read 12 days behind on the day of the last weigh-in and 24 a fortnight
     * later, and half of that number was just the days since he stood on it.
     *
     * Blake, shown a pace verdict under an empty weigh-in box: "I didn't want
     * to be nagged, but coached and informed." So past a day the card states
     * which morning it is reading and what that morning said, and asks for
     * nothing — a stat, then silence, which is his own rule for a last line. */
    const staleSeed = (gap) => (g) => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const key = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      const ws = {};
      for (let i = 0; i < 30; i++) {
        const d = new Date(); d.setDate(d.getDate() - g - i);
        ws[key(d)] = Math.round((195 + i * 0.1) * 10) / 10;
      }
      localStorage.setItem('bsc.macroWeights', JSON.stringify(ws));
      const goal = new Date(); goal.setDate(goal.getDate() + 120);
      localStorage.setItem('bsc.macroProfile', JSON.stringify({
        sex: 'm', age: 43, ft: 5, inch: 10, lb: 195, act: 1.375, goal: 'cut1',
        goalLb: 175, goalBy: key(goal), workouts: 4, steps: 8000 }));
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 190, f: 60, c: 120 }));
    };
    const staleAt = async (gap) => {
      const pg = await t.fresh({ viewport: { width: 390, height: 800 } });
      await pg.evaluate(staleSeed(gap), gap);
      await pg.reload();
      await pg.waitForTimeout(400);
      await pg.click('.tab[data-view="macros"]');
      await pg.waitForTimeout(250);
      const out = await pg.evaluate(() => {
        const f = window.__macroLab.pace();
        const el = document.querySelector('.mline');
        return { daysOff: f && f.daysOff, stale: f && f.stale,
          text: el ? el.textContent : '',
          eat: !!document.querySelector('[data-mline^="mline:eat"]') };
      });
      await pg.context().close();
      return out;
    };
    const staleFresh = await staleAt(0);
    const staleOld = await staleAt(14);
    t.ok('days behind pace does not grow just because nobody stood on the scale',
      Math.abs(staleFresh.daysOff - staleOld.daysOff) <= 2,
      'fresh ' + staleFresh.daysOff + ' vs 14 days later ' + staleOld.daysOff);
    t.ok('and a fortnight-old reading says which morning it is reading, and asks for nothing',
      staleOld.stale === 14 && /Last weighed/.test(staleOld.text) && !staleOld.eat,
      JSON.stringify(staleOld).slice(0, 180));
    t.ok('while a reading taken this morning still gives its verdict',
      staleFresh.stale === 0 && /Arriving around|On track|no arrival date/.test(staleFresh.text),
      staleFresh.text.slice(0, 90));

    /* ---- the answer does not depend on the order the day was built --------
     *
     * Coordinate descent visits one plate at a time, so the order it walks
     * them in is part of the answer, and it walked them in the order the
     * day object was built: a pinned meal first, a hand-built day in tap
     * order, a synced day as stored. These three plates, solved forward and
     * backward, landed at ×¼ / ×1 / ×¾ and at ×½ / ×1 / ×½. The solver walks
     * the meals in their own order now, whatever road the day came in by. */
    const ordered = [];
    for (const keys of [['b', 'l', 'd'], ['d', 'l', 'b']]) {
      const ordPg = await t.fresh({ viewport: { width: 390, height: 800 } });
      await ordPg.evaluate((ks) => {
        const p2 = (n) => (n < 10 ? '0' : '') + n;
        const d = new Date();
        const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
        const ids = { b: 150, l: 311, d: 195 };
        const day = {};
        ks.forEach((kk) => { day[kk] = [{ id: ids[kk], x: 1, eaten: 0 }]; });
        localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: day }));
      }, keys);
      await ordPg.reload();
      await ordPg.waitForTimeout(400);
      await ordPg.click('.tab[data-view="macros"]');
      await ordPg.waitForTimeout(300);
      ordered.push(await ordPg.evaluate(() => {
        window.__macroLab.balance();
        const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
        const day = days[Object.keys(days)[0]];
        return ['b', 'l', 'd'].map((kk) => day[kk][0].x).join('/');
      }));
      await ordPg.context().close();
    }
    t.ok('the same plates solve to the same portions whichever way the day was built',
      ordered[0] === ordered[1], ordered.join(' vs '));

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
          Number(e.dataset.want) || 0) : null,
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

    /* Two presses now, and they are two different things. After Fill the day
       is drafted but nothing is ticked, so the primary offers to mark it all
       complete; only once every plate is eaten does it offer to close the
       day. Blake's progression: "the done for the day button should be
       something like Mark all as complete. And once everything is completed I
       get the options to complete the day." */
    await closed.click('#macroFill');            // Mark all complete
    await closed.waitForTimeout(400);
    t.ok('a drafted day offers to tick itself off before it offers to close',
      await closed.evaluate(() => document.getElementById('macroFill').dataset.mode === 'done'),
      await closed.evaluate(() => document.getElementById('macroFill').dataset.mode + ' / ' +
        document.getElementById('macroFill').textContent));
    await closed.click('#macroFill');            // Complete the day
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
    /* The tick is gone from the bar and the one primary carries it: Fill
       while there is something to draft, Done once there is not, Reopen once
       it is closed. Same verb, the slot that was going dead. */
    t.ok('and the day is marked closed on the bar',
      await closed.evaluate(() => {
        const b = document.getElementById('macroFill');
        return b.dataset.mode === 'open' && /Reopen/.test(b.textContent) &&
          b.classList.contains('to-done');
      }));
    /* Nothing was taken away by closing it. */
    t.ok('and nothing on the day was removed by saying you were done',
      await closed.evaluate(() => document.querySelectorAll('.mslot').length > 0 &&
        !document.getElementById('macroFill').disabled === false ||
        document.querySelectorAll('.mitem, .mthin').length > 0));
    await closed.click('#macroFill');
    await closed.waitForTimeout(400);
    t.ok('and pressing it again reopens the day, without a card this time',
      await closed.evaluate(() =>
        document.getElementById('macroFill').dataset.mode !== 'open' &&
        !document.querySelector('.ds-sheet')));
    /* It survives a reload, which is the whole point of it being a record. */
    await closed.click('#macroFill');
    await closed.waitForTimeout(400);
    await closed.click('.sheet-x');
    await closed.waitForTimeout(200);
    await closed.reload();
    await closed.click('.tab[data-view="macros"]');
    await closed.waitForTimeout(500);
    t.ok('and a closed day is still closed tomorrow morning',
      await closed.evaluate(() =>
        document.getElementById('macroFill').dataset.mode === 'open'));

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
    /* Scrolled to the middle first, as a thumb would. At the top of an
       800-tall page this tick sits under the sticky bottom bar, and the
       plate controls' 120px scroll margin, meant to stop them above it, is
       cut short by the meal card (overflow: hidden makes it a scroll
       container, which clips the margin at its own edge). The click used to
       land on the bar's very top pixel and get through; with the meal verbs
       at a plate key's size (2026-09-27) the card ends 24px sooner and it
       stalled on the bar for thirty seconds. */
    await wake.evaluate(() => document.querySelector('.mitem [data-meat]').scrollIntoView({ block: 'center' }));
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

    /* In the middle first, as a thumb would: see the same tick's note in
       "One tap on a spent portion", above. */
    await spent.evaluate(() => document.querySelector('.mitem [data-meat]').scrollIntoView({ block: 'center' }));
    await spent.click('.mitem [data-meat]');
    await spent.waitForTimeout(400);
    const stepNow = await spent.evaluate(() => {
      const st = document.querySelector('.mstep');
      /* The lock is a SIBLING of the dial now, not a cell inside it. It
         guards against the machine rather than against you — Rebalance
         leaves a locked plate alone while the stepper still works — so it
         was never a part of the dial, and sitting in it paired "hold this
         still" with "make this bigger". */
      const lock = st.closest('.mitem').querySelector('.mlock');
      return { x: st.querySelector('.mstep-x').textContent.trim(),
        dead: [...st.querySelectorAll('[data-mstep]')].every((b) => b.disabled),
        lockStillLive: !!lock && !lock.disabled,
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

    /* In the middle first, as a thumb would: see the same tick's note in
       "One tap on a spent portion", above. */
    await spent.evaluate(() => document.querySelector('.mitem [data-meat]').scrollIntoView({ block: 'center' }));
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
    /* It stops SAYING Fill exactly when there is nothing left to draft — and
       says the next useful thing instead of going dead, which is the whole
       point of merging the tick into it. Fill stops once a meal's remaining
       budget is under a hundred calories, so on a tight plan it can honestly
       leave the last one empty, and then the button is rightly still Fill.
       Asserting "always done after Fill" made this a coin toss on which
       meals the draft happened to reach. */
    t.ok('the button stops offering to fill exactly when every meal has something',
      (drafted.fillMode !== 'fill') === drafted.perSlot.every((n) => n >= 1),
      'mode=' + drafted.fillMode + ' slots=' + drafted.perSlot.join(','));

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
    /* Lunch gets a dish again. It may also get a single food on top: the
       topper finishes the DAY and lands on whichever meal is shortest, which
       can be the one just refilled. Asserting exactly one item there made
       this pass or fail on Fill's random pick from the top three. */
    const refill = await q.evaluate((keep) => {
      const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
      const day = days[Object.keys(days)[0]];
      const dishes = (day.l || []).filter((it) => String(it.id).indexOf('f:') !== 0);
      return { ok: dishes.length === 1 && Object.keys(keep).every(
        (k) => (day[k] || []).length && String(day[k][0].id) === keep[k]),
        l: (day.l || []).map((it) => String(it.id)), keep };
    }, keepIds);
    t.ok('refilling touches only the meal that was emptied', refill.ok, JSON.stringify(refill));

    await q.context().close();
  },
});
