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

/* Two doors, and which one is showing depends on whether there is a plan yet.
   With none, the bottom bar's primary button IS the way in — it used to sit
   there disabled and green at exactly this moment, which is the first thing a
   newcomer met. Once a plan exists the bar goes back to saying Fill and the
   card carries "Adjust my plan" behind its fold. */
async function openPlan(pg) {
  if (await pg.evaluate(() => {
    const b = document.getElementById('macroFill');
    return !!b && b.classList.contains('to-plan') && !b.disabled;
  })) { await pg.click('#macroFill'); await pg.waitForTimeout(250); await revealPlanFields(pg); return; }
  if (!await pg.$('#macroTargBtn')) {
    const handle = await pg.$('.mday-weigh [data-mfold]');
    if (handle) { await handle.click(); await pg.waitForTimeout(250); }
  }
  await pg.click('#macroTargBtn');
  await revealPlanFields(pg);
}

/* A first run opens as four steps with three of them hidden, and Playwright
   will not type into what it cannot see. Nearly every test that touches these
   fields is about something else entirely — carb cycling, the measured burn,
   what Save keeps — so they get the sheet with everything reachable rather
   than a page of Next-tapping in front of the thing they are actually
   asserting. The stepping itself has its own tests, which open the sheet
   without this. */
/* The meal rows and Save fold away on a known profile for the same reason —
   the sheet opens on the plan, not on the editor — so they are opened here
   too. #mtEditor is deliberately NOT: whether the profile form arrives folded
   is a thing tests assert, and the ones that want the boxes press Edit, which
   is what a reader does. */
async function revealPlanFields(pg) {
  await pg.evaluate(() => {
    document.querySelectorAll('[data-mtwstep]').forEach((s) => { s.hidden = false; });
    // and the wizard's folds — the pace rows, the training days, the gram boxes
    document.querySelectorAll('.mt-sheet details').forEach((d) => { d.open = true; });
    // the activity select is hidden behind three words on a first run; the
    // tests that pick a multiplier off it are about the multiplier
    ['mtMealsWrap', 'mtSave', 'mtAct'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('hide');
    });
  });
  await pg.waitForTimeout(80);
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
    t.ok('and each of the four still says what is left of it, signed',
      await p.evaluate(() => {
        const c = [...document.querySelectorAll('[data-macro] .mb-d')];
        return c.length === 4 &&
          c.every((x) => /^[+-]?\d+$/.test(x.querySelector('b').textContent)) &&
          c.every((x) => /\b(to go|over)$/.test(x.textContent.trim()));
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
    await p.fill('#mtWorkouts', '4');
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
    t.ok('tapping a day sets it, and the list is kept as its own',
      await p.evaluate(() =>
        JSON.parse(localStorage.getItem('bsc.macroProfile')).train.indexOf(1) >= 0));
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
        return d.classList.contains('done') &&
          ['under', 'on', 'over'].some((s) => d.classList.contains(s)) &&
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
      /behind pace/.test(await narr()) && !/ahead of pace/.test(await narr()), await narr());
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
    t.ok('once there are mornings, the scale gets an opinion',
      /Averaging /.test(await detail()) && /Needs /.test(await detail()), await detail());
    t.ok('and it is behind pace, because a pound a week is not two — said on the face',
      /behind pace/.test(await narr()), await narr());

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
    t.ok('and the card says it is being eaten, instead of asking again',
      !took.stillAsking && new RegExp('Eating ' + askedFor.toLocaleString()).test(took.text), took.text.slice(0, 120));
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
    await wiz.fill('#mtWorkouts', '3');
    await wiz.waitForTimeout(350);
    t.ok('and step two breaks the same figure out, not a different one',
      await wiz.evaluate(() => {
        const one = ((document.getElementById('mtwSaid1') || {}).textContent || '').match(/[\d,]+/);
        const two = ((document.getElementById('mtwSaid2') || {}).textContent || '').match(/[\d,]+/g);
        return !!one && !!two && two.indexOf(one[0]) >= 0;
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
    /* Reversed deliberately. It read "Where the day stands · 60 / 203 g" —
       four bars of standing. Standing is the right question for the strip at
       the top of My Day and the wrong one in this sheet, where you are
       shopping: shopping is done against what is MISSING, and the
       subtraction was being done in Blake's head on every row. */
    t.ok('the picker says what the day is still OWED, as pills',
      !!dayPanel && dayPanel.pills.length === 4 && dayPanel.oldBars === 0,
      JSON.stringify(dayPanel && { cap: dayPanel.cap, n: dayPanel.pills.length,
        bars: dayPanel.oldBars }));

    /* And it is a remainder rather than a target — still computed and never a
       literal, which would pass on an app that had stopped subtracting at
       all. The quantity changed with the scope: it was the DAY's target less
       what the day holds, and is now this MEAL's ask less what the meal
       holds. Read off the meal card rather than recomputed here, because the
       claim that matters is that the two agree. */
    const owedNow = await dosePg.evaluate(() => {
      const cap = (document.querySelector('.mp-cap') || {}).textContent || '';
      const meal = (cap.match(/^(.*?)\s+(?:still wants|is closed)/i) || [, ''])[1].trim();
      const card = [...document.querySelectorAll('.mslot')].find((c) =>
        ((c.querySelector('.mslot-name') || {}).textContent || '').trim()
          .replace(/[^A-Za-z ]/g, '').trim().toLowerCase() === meal.toLowerCase());
      const pil = card && [...card.querySelectorAll('.mmp')].find((e) =>
        /^P/.test((e.querySelector('i') || {}).textContent || ''));
      if (!pil) return null;
      const got = Number((pil.querySelector('.mmp-v').textContent.match(/\d+/) || [0])[0]);
      const want = Number(pil.dataset.want || 0);
      const shown = [...document.querySelectorAll('.mp-left .mgp')]
        .filter((e) => /P/.test(e.textContent) && !/\uD83D\uDD25/.test(e.textContent))
        .map((e) => Number((e.textContent.match(/\d+/g) || [0]).pop()))[0];
      return { shown: shown, cardLeft: Math.max(0, want - got) };
    });
    t.ok('and the protein pill is this meal\u2019s ask less what the meal holds',
      !!owedNow && Math.abs(owedNow.shown - owedNow.cardLeft) <= 1,
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
      /still wants|is closed/i.test(dayPanel.cap) && /\w/.test(dayPanel.cap),
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
      const shown = Number((pill.textContent.match(/\d+/g) || [0]).pop());
      /* The same figure off the meal card: its calorie pill is got/want, and
         what the sheet reports is what is left of that. */
      const cap = (document.querySelector('.mp-cap') || {}).textContent || '';
      const meal = (cap.match(/^(.*?)\s+(?:still wants|is closed)/i) || [, ''])[1].trim();
      const card = [...document.querySelectorAll('.mslot')].find((c) =>
        ((c.querySelector('.mslot-name') || {}).textContent || '').trim()
          .replace(/[^A-Za-z ]/g, '').trim().toLowerCase() === meal.toLowerCase());
      const t2 = card && card.querySelector('.mmp.kc');
      const got = t2 ? Number((t2.querySelector('.mmp-v').textContent.match(/\d+/) || [0])[0]) : null;
      const want = t2 ? Number(t2.dataset.want || 0) : null;
      return { shown: shown, meal: meal, got: got, want: want,
        cardLeft: (got === null ? null : Math.max(0, want - got)) };
    });
    t.ok('the flame in the sheet is the same gap the meal card is showing',
      flame.cardLeft !== null && Math.abs(flame.shown - flame.cardLeft) <= 1,
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
     * previous person's share choices reloaded into the next account. */
    const sources = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'app.js'), 'utf8');
    const wipes = ['pull', 'out', 'delete'].map((act) => {
      const at = sources.indexOf("if (act2 === '" + act + "')");
      const next = sources.indexOf('if (act2 ===', at + 10);
      const block = sources.slice(at, next > 0 ? next : at + 1400);
      const asks = block.indexOf('ask({'), wipe = block.indexOf('mForgetDay()'), del = block.indexOf('mDeleteAccount()');
      return act + ':' + (at > 0 && asks > 0 && asks < Math.max(wipe, del) ? 'asked' : 'silent');
    });
    t.ok('sign out, pull and delete each ask before emptying this device',
      wipes.every((w) => /asked$/.test(w)), wipes.join(' '));
    const wipeList = sources.slice(sources.indexOf('function mForgetDay()'), sources.indexOf('function mForgetDay()') + 900);
    const storedKeys = Array.from(new Set((sources.match(/setItem\('bsc\.(macro\w+|myFoods|myStamps|myOwner)'/g) || [])
      .map((m) => m.replace(/^setItem\('/, '').replace(/'$/, ''))));
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
    t.ok('the face and the morning line give one verdict, the side of the line',
      lineSaid.side === 'behind' && /behind pace/.test(faceSaid) && !/on pace|ahead of pace/.test(faceSaid) &&
        /behind pace/.test(lineSaid.text),
      'face: ' + faceSaid + ' | line: ' + lineSaid.text.slice(0, 80));
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
      return { floor: window.__macroLab.floorK(),
        man: window.__macroLab.plan(man).kcal,
        woman: window.__macroLab.plan(Object.assign({}, man, { sex: 'f' })).kcal };
    });
    t.ok('the floor is the clinical 1,200, for anybody',
      floors.floor === 1200, JSON.stringify(floors));
    t.ok('and a hard cut is allowed under the old 1,500',
      floors.man < 1500 && floors.man >= 1200, JSON.stringify(floors));

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
        pressed: b ? b.getAttribute('aria-pressed') : 'missing',
        day: b ? b.dataset.mtrained : null };
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
      staleOld.stale === 14 && /Last weighed/.test(staleOld.text) &&
        /14 mornings since/.test(staleOld.text) && !staleOld.eat,
      JSON.stringify(staleOld).slice(0, 180));
    t.ok('while a reading taken this morning still gives its verdict',
      staleFresh.stale === 0 && /behind pace|Nothing to change|ahead of pace/.test(staleFresh.text),
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
      const g = [...acts.querySelectorAll('.mic svg')].map((e) => e.getBoundingClientRect());
      if (g.length < 2) return null;
      const within = Math.round(g[1].left - g[0].right);
      /* The air AFTER the group, since the group leads the strip now. */
      const between = Math.round(dial.getBoundingClientRect().left - g[1].right);
      return { within, between, glyph: Math.round(g[0].width) };
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

    /* ---- the picker speaks for the meal it is filling ---------------------
     *
     * Blake, on a sheet headed ADD TO SNACKS showing 1745 kcal while Snacks
     * was asking for 87: "the macro pills at the top are for the whole day?
     * why not for the meal I am trying to make?" The function was already
     * called mMealLeft and its first two lines read mDayTargets/mDayEaten. */
    const pk = await t.fresh();
    await pk.evaluate(() => {
      const d = new Date();
      const k = d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) +
        '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: { b: [], l: [], d: [], s: [] } }));
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 180, f: 50, c: 50 }));
    });
    await pk.reload();
    await pk.waitForTimeout(400);
    await pk.click('.tab[data-view="macros"]');
    await pk.waitForTimeout(350);
    await openDay(pk);
    await pk.click('.mslot-add[data-mslot="s"]');
    await pk.waitForTimeout(450);

    const pkRead = await pk.evaluate(() => {
      const pills = [...document.querySelectorAll('.mp-left .mgp')]
        .map((e) => Number((e.textContent.match(/\d+/g) || [0]).pop()));
      const T = window.__macroLab.targets();
      const tot = window.__macroLab.read().tot;
      return { pills: pills, cap: (document.querySelector('.mp-cap') || {}).textContent || '',
        dayKcal: Math.round(4 * T.p + 4 * T.c + 9 * T.f - tot.kcal),
        dayP: Math.round(T.p - tot.p) };
    });
    t.ok('the sheet names the meal it is filling', /Snacks/i.test(pkRead.cap), pkRead.cap);
    /* The load-bearing one. On an untouched day the DAY's remainder is the
       whole target, and a snack's share is a fraction of it — so a pill still
       reading the day's number is caught here and nowhere else. Asserted as
       "much smaller", not "different", because a scope bug that happened to
       be off by one would still be a scope bug. */
    t.ok('and its pills are the meal\u2019s share, not the whole day\u2019s',
      pkRead.pills[0] > 0 && pkRead.pills[0] < pkRead.dayKcal * 0.6 &&
      pkRead.pills[1] > 0 && pkRead.pills[1] < pkRead.dayP * 0.6,
      JSON.stringify(pkRead));

    /* Sticky: the target and the search box, and NOT the shelves. All three
       is 280 px of a 560 px sheet. */
    const pkStick = await pk.evaluate(() => {
      const st = document.querySelector('.mp-stick');
      if (!st) return { none: true };
      return { pills: !!st.querySelector('.mp-left'), find: !!st.querySelector('#mpFind'),
        shelves: !!st.querySelector('[data-mpshelf]'),
        pos: getComputedStyle(st).position };
    });
    t.ok('the meal\u2019s target and the search box are pinned',
      pkStick.pos === 'sticky' && pkStick.pills && pkStick.find, JSON.stringify(pkStick));
    t.ok('and the shelves are not, because a filter is set once and read past',
      pkStick.shelves === false, JSON.stringify(pkStick));

    /* The basket bar says WHAT, not only how many. */
    await pickerList(pk);
    await pk.waitForTimeout(250);
    const pkName = await pk.evaluate(() => {
      const row = document.querySelector('.mpick-row[data-mpick]');
      const nm = row ? (row.querySelector('.mp-name') || {}).textContent || '' : '';
      if (row) row.click();
      return nm.trim();
    });
    await pk.waitForTimeout(350);
    const pkFoot = await pk.evaluate(() => ({
      names: (document.querySelector('.mp-foot-n') || {}).textContent || '',
      chevOpen: !!document.querySelector('.mp-foot-c.open'),
      done: (document.querySelector('.mp-done') || {}).textContent || '',
    }));
    t.ok('the basket bar names what is in it',
      !!pkName && pkFoot.names.length > 0 &&
      pkFoot.names.slice(0, 12) === pkName.slice(0, 12),
      JSON.stringify({ picked: pkName, bar: pkFoot.names }));
    /* Shut, the chevron points at what it opens — the drawer rises from the
       bar. It used to be a left-pointing ‹ rotated to point DOWN, which is
       why the list behind it went unfound. */
    t.ok('and its chevron points up at the drawer while the drawer is shut',
      pkFoot.chevOpen === false, JSON.stringify(pkFoot));
    await pk.click('.mp-foot-t');
    await pk.waitForTimeout(300);
    t.ok('and turns over once the drawer is open',
      await pk.evaluate(() => !!document.querySelector('.mp-foot-c.open')));
    await pk.context().close();

    /* ---- the plate, contained --------------------------------------------
     *
     * Blake, on the open meal: "it feels off to me. does not flow. why do I
     * feel that way when interacting with it?" Three rows per plate at three
     * different left edges, and the two loudest boxes on the card — the
     * stepper slab and the tick — belonging to the two things he touches
     * least, while the name he reads every time carried no weight.
     *
     * He also ruled out the obvious fix: "I have the skip, add, share,
     * balance, lock, borrow... all those are things I want and use. They just
     * need to be organized better." So nothing was removed. What changed is
     * that a plate is now its own block, which is what says its controls act
     * on IT rather than on the meal or on the day. */
    const platePg = await t.fresh();
    await platePg.evaluate(() => {
      const d = new Date();
      const k = d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) +
        '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
      /* A scored recipe AND a bare food, deliberately: the leaf badge is the
         thing that used to shift one name 28 px right of the other. */
      const rec = (window.RECIPES.find((r) => r.score > 0 && r.macro && r.macro.kcal > 150) || {}).id;
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: 'f:egg', x: 3, eaten: 0 }].concat(rec ? [{ id: rec, x: 1, eaten: 0 }] : []),
        l: [], d: [], s: [] } }));
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 180, f: 50, c: 50 }));
    });
    await platePg.reload();
    await platePg.waitForTimeout(400);
    await platePg.click('.tab[data-view="macros"]');
    await platePg.waitForTimeout(350);
    await openDay(platePg);
    await platePg.waitForTimeout(250);

    const plated = await platePg.evaluate(() => {
      const rows = [...document.querySelectorAll('.mitem')];
      if (rows.length < 2) return { few: rows.length };
      const card = rows[0].closest('.mslot');
      const cs = getComputedStyle(rows[0]), cardCs = getComputedStyle(card);
      return {
        n: rows.length,
        /* contained: its own ground and its own edge, different from the card
           it sits in — which is what makes "inside this box" mean anything */
        ownGround: cs.backgroundColor !== cardCs.backgroundColor,
        ownEdge: parseFloat(cs.borderTopWidth) > 0 && parseFloat(cs.borderRadius) > 0,
        /* every name starts at the same x, leaf or no leaf */
        nameLefts: rows.map((r) => Math.round(r.querySelector('.mitem-name').getBoundingClientRect().left)),
        leaves: rows.map((r) => !!r.querySelector('.leaf-md .leaf-n')),
        /* the tick ENDS the plate, on the side a thumb is */
        tickLast: rows.every((r) => {
          const ate = r.querySelector('.mitem-ate'), keys = r.querySelector('.mstep-keys');
          return ate && keys &&
            ate.getBoundingClientRect().left > keys.getBoundingClientRect().right;
        }),
        /* and it says what it does — in its spoken label, not in ink. Blake,
           on the built row: "Remove 'ate it'. Just the check box." The word
           was the only thing on the strip that named itself, and a tick in
           the eaten position is not a thing anybody misreads. Screen readers
           still get the sentence. */
        tickSpoken: rows.every((r) => {
          const a = r.querySelector('.mitem-ate');
          return !!a && /\w/.test(a.getAttribute('aria-label') || '');
        }),
        tickBare: rows.every((r) => {
          const a = r.querySelector('.mitem-ate');
          return !!a && a.tagName === 'INPUT' && !r.querySelector('.mitem-ate *');
        }),
        /* and every control that acts on this food is inside this food's box */
        contained: rows.every((r) => ['.mitem-ate', '.mstep', '.mlock', '.mpin', '.mdel']
          .every((sel) => !!r.querySelector(sel))),
        /* three bands, each answering one question */
        bands: rows.every((r) => ['.mitem-r1', '.mitem-r2', '.mitem-r3']
          .every((sel) => !!r.querySelector(sel))),
        /* while the ones that act on the meal are not */
        mealVerbsOutside: rows.every((r) => !r.querySelector('[data-mbal], [data-mskip], [data-mslot]')),
      };
    });
    t.ok('the plate is seeded with a scored recipe and a bare food',
      plated.n >= 2 && plated.leaves.indexOf(true) >= 0 && plated.leaves.indexOf(false) >= 0,
      JSON.stringify(plated));
    /* The complaint, made measurable, and it survives the leaf moving back to
       the front: a badge drawn for a recipe and absent for a food cannot be
       the thing a column starts on. The slot is kept empty on a food so both
       start their names in the same place. */
    t.ok('every plate\u2019s name starts at the same edge, leaf or no leaf',
      new Set(plated.nameLefts).size === 1, JSON.stringify(plated.nameLefts));

    /* Reversed, on Blake's layout: "[lock][serving size][-][+]......[check
       box]". The tick used to lead the row, which put the state of the plate
       — the thing pressed most on it — in the corner furthest from a thumb,
       at 21px. It ends the row now. */
    t.ok('the tick ends the plate, on the side a thumb is, and says what it does',
      plated.tickLast && plated.tickSpoken, JSON.stringify(plated));
    /* Blake, on the first build of this strip: "why a check box in side a
       box?" It was an <input> hidden inside a styled <span> that drew a
       second edge saying what the first one said — and, being 0x0, the real
       control could not be clicked by a test or by a coordinate either. The
       box IS the checkbox now. */
    t.ok('and the tick is the box, not a box drawn around a box',
      plated.tickBare, JSON.stringify(plated));

    /* Blake: "might need a shadow of a checkmark on that checkmark box so i
       know it is something i am to check." An empty square sitting beside
       the − and + keys — same size, same outline, no glyph — reads as a
       third key whose label fell off, not as something to press.
     *
       Two things have to hold at once, and the second is what makes the
       first safe: the mark is DRAWN when unticked, and the STATE is still
       told by the fill. A ghost mark on a box whose only other cue is the
       same mark, darker, is how you build a checkbox nobody can read. */
    const ghost = await platePg.evaluate(() => {
      const t0 = document.querySelector('.mitem-ate');
      const read = () => ({ mark: getComputedStyle(t0, '::after').color,
        fill: getComputedStyle(t0).backgroundColor });
      const off = read();
      t0.click();
      return { off: off, on: read() };
    });
    await platePg.waitForTimeout(300);
    const unseen = (c) => /transparent/.test(c) || /,\s*0\)$/.test(c);
    t.ok('an unticked plate still draws its tick, so the box says what it is for',
      !unseen(ghost.off.mark), JSON.stringify(ghost));
    t.ok('and ticking it is said by the FILL, not by the mark getting darker',
      ghost.off.fill !== ghost.on.fill && !unseen(ghost.on.fill) &&
      ghost.off.mark !== ghost.on.mark, JSON.stringify(ghost));
    t.ok('and the plate reads in three bands: what it is, what is in it, what you can do',
      plated.bands, JSON.stringify(plated));
    t.ok('a plate is a block of its own, not a strip of the card',
      plated.ownGround && plated.ownEdge, JSON.stringify(plated));
    /* The scope, structurally: everything that acts on this food is in this
       food's box, and nothing that acts on the meal is. */
    t.ok('everything that changes this food lives inside this food\u2019s box',
      plated.contained && plated.mealVerbsOutside, JSON.stringify(plated));
    await platePg.context().close();

    /* And it does not cost height, which nothing here was checking.
     *
       The rebuild shipped once at 160 px a plate against the 104 it replaced
       — the control row wrapping onto two lines, because a 44px indent left
       290 px for 308 px of dial and targets. The suite was entirely silent:
       every assertion was about structure and none about the one thing a
       six-meal day actually feels. It was caught by measuring the previous
       commit in a worktree, after a mockup built with 26 px controls had me
       claim the opposite in a commit message.

       Asserted as ONE ROW rather than as a pixel budget: the height follows
       from the targets and the padding and will move again, but the control
       strip folding in half is the failure, and it is the same failure at any
       size. Measured on a touch viewport, because the 44 px rule that causes
       it only applies there. */
    const rowFit = await t.fresh({ viewport: { width: 390, height: 900 }, hasTouch: true, isMobile: true });
    await rowFit.evaluate(() => {
      const d = new Date();
      const k = d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) +
        '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
      const rec = (window.RECIPES.find((r) => r.score > 0 && r.macro && r.macro.kcal > 150) || {}).id;
      /* The plate that actually broke it, off Blake's own phone. A food typed
         in from a label carries whatever unit the label used, and this one is
         a sentence: three of them render "3 1 skillet cooked slice (15 g)",
         a 298px dial that left nothing for three 44px targets. The first
         version of this test used "3 whole" and "1 serving" and passed
         happily while his breakfast was folding in half. */
      localStorage.setItem('bsc.myFoods', JSON.stringify({
        bacon_bb: { name: "Butcher's Box Uncured Bacon",
          unit: '1 skillet cooked slice (15 g)', kcal: 71, p: 2, f: 7, c: 0 } }));
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: 'f:egg', x: 3, eaten: 0 }]
          .concat(rec ? [{ id: rec, x: 1, eaten: 0 }] : [])
          .concat([{ id: 'f:my:bacon_bb', x: 3, eaten: 0 }]),
        l: [], d: [], s: [] } }));
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 180, f: 50, c: 50 }));
    });
    await rowFit.reload();
    await rowFit.waitForTimeout(400);
    await rowFit.click('.tab[data-view="macros"]');
    await rowFit.waitForTimeout(350);
    await openDay(rowFit);
    await rowFit.waitForTimeout(250);
    const fit = await rowFit.evaluate(() => {
      const rows = [...document.querySelectorAll('.mitem-r3')];
      if (!rows.length) return { none: true };
      return rows.map((r) => {
        const kids = [...r.children];
        /* Height against the tallest child, and nothing else. Counting
           distinct tops was tried twice and is wrong twice over: the children
           are 44 and 46 tall in a centred row, so their tops differ by a
           pixel while plainly sharing a line, and bucketing those tops then
           mis-reports whenever the bucket boundary falls between them. A row
           that has wrapped is a row taller than the tallest thing in it.
         *
           Its CONTENT height, though. The strip carries a rule and six
           pixels of padding above it now — the band separator — and measuring
           the border box against the children reported every plate as folded
           in half when all four controls were plainly on one line at top=7.
           A row's own padding is not a second row. */
        const cs = getComputedStyle(r);
        const widest = Math.max.apply(null, kids.map((k) =>
          Math.round(k.getBoundingClientRect().height)));
        const h = Math.round(r.getBoundingClientRect().height -
          parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) -
          parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth));
        return { h: h, widest: widest, wrapped: h > widest + 4 };
      });
    });
    /* And they are not boxes.
     *
       Blake on the first version of this row: "buttons are too big. And not
       spread out well and are out of balance with the rest of the text on the
       card." It was not the touch targets — those are 44px and stay 44px, and
       there is a test above that measures them. It was that every one of them
       was a bordered, filled box, so five outlines sat under a 14px name and
       a 10px macro line and the plate read as a keypad. A glyph with a
       generous invisible margin is the same thing to a thumb and a quieter
       thing to an eye.

       Measured on the CONTROLS rather than on the plate, because the plate's
       own block is a box on purpose — that containment is what says which
       scope these controls belong to. */
    const chrome = await rowFit.evaluate(() => {
      const boxy = (e) => {
        const c = getComputedStyle(e);
        return parseFloat(c.borderTopWidth) > 0 || parseFloat(c.borderLeftWidth) > 0 ||
          (c.backgroundColor !== 'rgba(0, 0, 0, 0)' && c.backgroundColor !== 'transparent');
      };
      const verbs = [...document.querySelectorAll('.mitem-r1 .mic, .mitem-r3 .mic')];
      const amt = document.querySelector('.mitem-r3 .mitem-amt');
      const keys = [...document.querySelectorAll('.mitem-r3 .mstep-keys button')];
      const first = document.querySelector('.mitem-r3 .mic');
      const ate = document.querySelector('.mitem-r3 .mitem-ate');
      const strip = document.querySelector('.mitem-r3');
      return {
        verbsBoxed: verbs.filter(boxy).map((e) => e.className).slice(0, 4),
        verbsN: verbs.length,
        amtBoxed: !!amt && boxy(amt),
        keysBoxed: keys.length > 0 && keys.every(boxy),
        /* the verbs at one end, the tick at the other */
        spread: (first && ate && strip)
          ? Math.round(ate.getBoundingClientRect().left - first.getBoundingClientRect().right)
          : -1
      };
    });
    /* Blake, on an earlier version of this row: "buttons are too big. And not
       spread out well and are out of balance with the rest of the text on the
       card." The VERBS keep that answer — bin, lock, pin, star are glyphs
       with generous invisible margins, the same thing to a thumb and a
       quieter thing to an eye. */
    t.ok('the verbs are glyphs, not boxes',
      chrome.verbsN >= 3 && chrome.verbsBoxed.length === 0, JSON.stringify(chrome));
    /* ...and the PORTION is boxed, on his newer one: "Outline the serving
       size in a box as well. With +/- on the right side of it." It is the
       control you operate rather than a verb you press once, and boxing it is
       what makes the three pieces read as one dial. */
    t.ok('while the portion and its two keys are boxed, being the thing you operate',
      chrome.amtBoxed && chrome.keysBoxed, JSON.stringify(chrome));
    /* The verbs at one end and the tick at the other, with the dial between:
       "not spread out well" was five boxes left-packed into a strip. */
    t.ok('and the strip is spread — verbs one end, the tick the other',
      chrome.spread > 40, JSON.stringify(chrome));

    t.ok('a plate\u2019s controls sit on one row at phone width',
      !fit.none && fit.length >= 3 && fit.every((r) => !r.wrapped),
      JSON.stringify(fit));
    await rowFit.context().close();

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
        const t2 = c.querySelector('.mmp.kc[data-want]');
        if (n && t2) out[n.trim()] = Number(t2.dataset.want);
      });
      return out;
    });
    const czLine = (pg) => pg.evaluate(() => {
      const el = document.querySelector('.mcasc');
      return el ? { head: el.querySelector('.mcasc-t').textContent,
        sub: el.querySelector('.mcasc-s').textContent,
        shut: el.classList.contains('shut'),
        h: Math.round(el.getBoundingClientRect().height),
        /* Which meals are ticked, by name, so a checkbox list can be
           asserted as a set rather than as a row of button captions. */
        on: [...el.querySelectorAll('.mcasc-row[aria-checked="true"] .mcasc-nm')]
          .map((n) => n.textContent.replace(/at its (floor|ceiling)/, '').trim()),
        czBtns: [...el.querySelectorAll('[data-msend]')].map((b) => b.textContent.trim()) } : null;
    });
    const czTick = async (pg, name) => {
      const rows = await pg.$$('.mcasc .mcasc-row');
      for (const r of rows) {
        if (new RegExp(name).test(await r.textContent())) { await r.click(); break; }
      }
      await pg.waitForTimeout(350);
    };

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
    /* The line lives INSIDE the meal's fold now — Blake's call, because a
       question about a meal should not outlive shutting that meal. So the
       meal has to be open to be read, exactly as it is on his phone when he
       finishes one. */
    await openDay(casc);
    await casc.waitForTimeout(250);
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

    /* ---- the chooser ---------------------------------------------------
     *
       It was a row of ghost buttons reading "Share with Dinner", each
       toggling when pressed a second time, with "Don't share" at the foot in
       different words for what is plainly this list's None. Blake asked for
       "a list of check boxes — share all or steal all, or select the meals
       that I want to share or steal from", so it is a set now: every box
       ticked is the default, and clearing one takes that meal out. */
    const czAll = await czLine(casc);
    t.ok('every meal left is offered, and starts ticked',
      !!czAll && czAll.on.length === 3 &&
      ['Lunch', 'Dinner', 'Snacks'].every((n) => czAll.on.indexOf(n) >= 0),
      JSON.stringify(czAll));

    /* Aiming it, the way a checkbox list aims: take the others out. Ticking
       ONE meal hands it the lot and leaves the rest on their own plan. */
    await czTick(casc, 'Lunch');
    await czTick(casc, 'Snacks');
    const czAimed = await czReadAsk(casc);
    t.ok('leaving one meal ticked hands it the lot',
      czAimed.Dinner > czSpread.Dinner && czAimed.Lunch < czSpread.Lunch &&
      czAimed.Snacks < czSpread.Snacks, JSON.stringify(czAimed));
    t.ok('and the others go back to exactly their own plan, not to nothing',
      czAimed.Lunch > 0 && czAimed.Snacks > 0, JSON.stringify(czAimed));

    /* A cleared box must not pay. It used to: the tapped meals were walked
       in tap order, each absorbing all it could, and whatever was LEFT was
       handed to the meals you had not tapped — which makes a tick mean
       "first in the queue" rather than "this one". Unticked Lunch and Snacks
       are on their own plan to the pound here, not somewhere between. */
    t.ok('and an unticked meal pays nothing at all',
      Math.abs(czAimed.Lunch - czPlans.Lunch) <= 2 &&
      Math.abs(czAimed.Snacks - czPlans.Snacks) <= 2,
      JSON.stringify({ czAimed, czPlans }));

    /* One checkbox idiom in the app, not one per surface. These rows are
       16px where the plate's tick is 34, and they were drawn by the same
       trick — a mark parked at `transparent` — so they ghost the same way or
       the two surfaces teach different things about what a box means. */
    const czBox = await casc.evaluate(() => {
      const pick = (on) => document.querySelector('.mcasc-row[aria-checked="' + on + '"] .mcasc-box');
      const rd = (e) => e && { mark: getComputedStyle(e).color,
        fill: getComputedStyle(e).backgroundColor };
      return { off: rd(pick('false')), on: rd(pick('true')) };
    });
    t.ok('and a cleared row on the chooser draws its tick too, like the plate does',
      !!czBox.off && !!czBox.on && !/transparent|,\s*0\)$/.test(czBox.off.mark) &&
      czBox.off.fill !== czBox.on.fill, JSON.stringify(czBox));

    /* The line ends on where the DAY lands, not on what the app did. Blake:
       "I kind of want something that will let me know what's going to happen
       now that I've overeaten or under eaten." "Shared with Dinner" is the
       app's own bookkeeping in the app's own vocabulary. */
    const czL2 = await czLine(casc);
    t.ok('and the line says where the day lands, not what it did',
      !!czL2 && /lands on plan|day ends \d+ (over|short)/.test(czL2.sub) &&
      !/Shared with|Borrowed from/.test(czL2.sub), JSON.stringify(czL2));

    /* None: every meal keeps its plan and the day is allowed to end short.
       On a cut that is frequently the one you want — a light breakfast is
       progress, not a debt to spend. */
    await casc.click('.mcasc [data-msend="none"]');
    await casc.waitForTimeout(350);
    const czHeld = await czReadAsk(casc);
    t.ok('and None leaves every meal on its own plan',
      czHeld.Lunch < czSpread.Lunch && czHeld.Dinner < czSpread.Dinner &&
      czHeld.Snacks < czSpread.Snacks, JSON.stringify(czHeld));
    t.ok('and says so, with where the day lands',
      /No meal grows/.test((await czLine(casc)).sub) &&
      /day ends \d+ short|lands on plan/.test((await czLine(casc)).sub),
      JSON.stringify(await czLine(casc)));
    t.ok('and no box is ticked', (await czLine(casc)).on.length === 0,
      JSON.stringify(await czLine(casc)));

    /* All puts it back to the default spread. */
    await casc.click('.mcasc [data-msend="all"]');
    await casc.waitForTimeout(350);
    const czBack = await czReadAsk(casc);
    t.ok('and All puts every meal back on the spread',
      Math.abs(czBack.Dinner - czSpread.Dinner) <= 2 &&
      Math.abs(czBack.Snacks - czSpread.Snacks) <= 2,
      JSON.stringify({ czBack, czSpread }));

    /* The spill, which is the half of the old behaviour a checkbox cannot
       keep.
     *
       Tapped meals used to be walked in tap order, each absorbing all it
       could, and whatever was LEFT was handed to the meals you had NOT
       tapped. With one uncapped meal ticked that is invisible — it absorbs
       the lot and there is nothing to spill — so this ticks the SMALLEST
       meal on its own. Snacks is 5% of the day and cannot grow past twice
       its share, so most of the surplus has nowhere to go, and where it goes
       is the whole question: onto meals whose boxes are clear, or nowhere.
     *
       Nowhere is the answer, and the card says how much. */
    await casc.click('.mcasc [data-msend="none"]');
    await casc.waitForTimeout(350);
    await czTick(casc, 'Snacks');
    const czOne = await czReadAsk(casc);
    const czOneLine = await czLine(casc);
    t.ok('the one ticked meal takes all it can hold',
      czOne.Snacks > czSpread.Snacks + 1, JSON.stringify({ czOne, czSpread }));
    t.ok('and the meals whose boxes are clear stay on their own plan to the pound',
      Math.abs(czOne.Lunch - czPlans.Lunch) <= 2 &&
      Math.abs(czOne.Dinner - czPlans.Dinner) <= 2,
      JSON.stringify({ czOne, czPlans }));
    t.ok('and the card says how far off the day now lands, rather than hiding it',
      /day ends \d+ short/.test(czOneLine.sub) &&
      /at the ceiling/.test(czOneLine.sub), JSON.stringify(czOneLine));

    await casc.click('.mcasc [data-msend="all"]');
    await casc.waitForTimeout(350);

    /* ---- and then it gets out of the way -------------------------------
       Blake: "when it's done how can I collapse that card so it's not so
       prominent?" The day is already right before any of this is read — the
       share lands on render — so once it has been looked at, the apparatus
       for changing it has no business taking a third of the screen. */
    const czOpenH = (await czLine(casc)).h;
    await casc.click('.mcasc [data-msend="ack"]');
    await casc.waitForTimeout(350);
    const czShut = await czLine(casc);
    t.ok('Done folds it to one line, and a much shorter card',
      !!czShut && czShut.shut && czShut.h < czOpenH / 2 && czShut.on.length === 0,
      JSON.stringify({ open: czOpenH, shut: czShut && czShut.h }));
    t.ok('and the folded line still says what happened and where it lands',
      /went \d+ (over|under) its share/.test(czShut.head) &&
      /lands on plan|day ends \d+ (over|short)/.test(czShut.sub),
      JSON.stringify(czShut));

    /* Stored, not held in a class. Blake dismissed the pace card and it was
       back a tap later, because its state was a CSS class and every redraw
       wiped it; `ack` rides in bsc.macroSend beside the choice itself. The
       reload is the honest test — anything that redraws from scratch brought
       the old one back. */
    await casc.reload();
    await casc.waitForTimeout(500);
    await casc.click('.tab[data-view="macros"]');
    await casc.waitForTimeout(400);
    await openDay(casc);
    await casc.waitForTimeout(250);
    t.ok('and it is still folded after everything redraws',
      !!(await czLine(casc)) && (await czLine(casc)).shut,
      JSON.stringify(await czLine(casc)));

    await casc.click('.mcasc [data-msend="open"]');
    await casc.waitForTimeout(350);
    const czReopen = await czLine(casc);
    t.ok('and the line reopens on the same three choices',
      !!czReopen && !czReopen.shut && czReopen.on.length === 3,
      JSON.stringify(czReopen));

    /* Shutting the meal takes the line with it.
     *
       It used to sit OUTSIDE the card so that a folded meal could still say
       what its miss did. Blake, off his own day: "the overage tag is still
       seen even after I closed the meal tag... as soon as I select that share
       or steal, I'd expect the macro pills to update and then when I close
       the card it's not seen any more." Shutting a meal is how you say you
       are done with it. The pills keep the answer, and they are on the header,
       which a shut card keeps. */
    await casc.click('#macroSlots [data-mfold="b"]');
    await casc.waitForTimeout(350);
    t.ok('shutting the meal takes its line with it',
      await casc.evaluate(() => !document.querySelector('.mcasc')));
    t.ok('and the pills on the shut header still carry the answer',
      await casc.evaluate(() => {
        const c = [...document.querySelectorAll('.mslot')].filter((x) =>
          /Dinner/.test((x.querySelector('.mslot-name') || {}).textContent || ''))[0];
        const t2 = c && c.querySelector('.mmp.kc[data-want]');
        return !!t2 && Number(t2.dataset.want) > 0;
      }));
    await openDay(casc);
    await casc.waitForTimeout(250);

    /* It survives a reload, because the choice is a fact about the day and
       not a thing this render happened to be holding.
     *
       Self-contained on purpose: it used to compare against whatever state
       the tests above happened to leave behind, so re-ordering them broke an
       assertion that was not about ordering. It makes its own distinctive
       choice, reads the numbers, and reloads. */
    await czTick(casc, 'Snacks');                 // take one meal out of the set
    const czPinned = await czReadAsk(casc);
    await casc.reload();
    await casc.waitForTimeout(500);
    await casc.click('.tab[data-view="macros"]');
    await casc.waitForTimeout(350);
    t.ok('and the choice is still there after a reload',
      JSON.stringify(await czReadAsk(casc)) === JSON.stringify(czPinned),
      JSON.stringify({ now: await czReadAsk(casc), was: czPinned }));
    await casc.context().close();

    /* ---- the figures live inside the bar -------------------------------
     *
       Blake's layout: "Pills for the bar charts with text in the pill. And
       full color as the bar." The bar was a stripe under a caption, so the
       fill got whatever width the numbers beside it did not want.
     *
       The words are drawn TWICE — ink over the unfilled part, paper over the
       filled part, the paper copy clipped at exactly the eaten edge. That is
       the only arrangement in which a figure sitting on a partial fill is
       legible at both ends, and it is worth a guard because it broke twice
       while I was building it: both times a rule further down the stylesheet
       outranked the paper copy's own colour and painted the number out. The
       fat bar read "F  / 61 g" with the 106 missing. */
    const pil = await t.fresh();
    await pil.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n; const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 204, f: 61, c: 72 }));
      localStorage.setItem('bsc.macroSlots', JSON.stringify({ list: [
        { k: 'a', n: 'Breakfast', t: 'b', w: 30 }, { k: 'l', n: 'Lunch', t: 'l', w: 35 },
        { k: 'd', n: 'Dinner', t: 'd', w: 35 }] }));
      /* Eight tablespoons of butter EATEN puts fat far past its target and a
         full pill on screen; an uneaten plate gives the planned band; an
         empty meal gives the assumed hatching. All three in one render. */
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        a: [{ id: 'f:butter', x: 8, eaten: 1 }], l: [{ id: 'f:egg', x: 3 }], d: [] } }));
    });
    await pil.reload();
    await pil.waitForTimeout(450);
    await pil.click('.tab[data-view="macros"]');
    await pil.waitForTimeout(450);
    /* Resolved through the page, so the comparison is between two colours
       and not between two spellings of one. */
    const pilPaper = await pil.evaluate(() => {
      const el = document.createElement('span');
      el.style.color = 'var(--paper)';
      document.body.appendChild(el);
      const c = getComputedStyle(el).color;
      el.remove();
      return c;
    });
    const pilRead = await pil.evaluate((paper) => {
      const out = {};
      document.querySelectorAll('[data-macro]').forEach((el) => {
        const track = el.querySelector('.mb-track');
        const ink = el.querySelector('.mb-w:not(.mb-on)');
        const pap = el.querySelector('.mb-w.mb-on');
        const col = (n, sel) => n && n.querySelector(sel)
          ? getComputedStyle(n.querySelector(sel)).color : '';
        out[el.dataset.macro] = {
          state: el.dataset.state,
          fill: parseFloat(track ? track.style.getPropertyValue('--f') : 'NaN'),
          /* both layers, and the words in each */
          inkWords: ink ? ink.textContent.replace(/\s+/g, ' ').trim() : null,
          papWords: pap ? pap.textContent.replace(/\s+/g, ' ').trim() : null,
          /* the paper copy is paper, figure and all */
          papFig: col(pap, '.mb-num b'), papUnit: col(pap, '.mb-num'),
          /* the ink copy is not */
          inkFig: col(ink, '.mb-num b'),
          /* the clip follows the EATEN edge, not the end of the whole fill */
          clip: pap ? getComputedStyle(pap).clipPath : '',
          /* eaten and planned survive; the hatched assumption does not */
          bands: ['mb-ate', 'mb-plan']
            .filter((c) => !!el.querySelector('.' + c)).length,
          hatch: !!el.querySelector('.mb-asm'),
          /* nothing spills out of the pill */
          spills: ink && track
            ? ink.getBoundingClientRect().right > track.getBoundingClientRect().right + 1 : null,
          h: track ? Math.round(track.getBoundingClientRect().height) : null
        };
      });
      return out;
    }, pilPaper);
    const pilAll = Object.keys(pilRead).map((m) => pilRead[m]);

    t.ok('all four bars are pills with the figures inside them, twice over',
      pilAll.length === 4 && pilAll.every((b) => b.inkWords && b.papWords &&
        b.inkWords === b.papWords && /\d/.test(b.inkWords)),
      JSON.stringify(pilAll.map((b) => b.inkWords)));

    /* The one that kept breaking. A full pill is solid colour end to end, so
       its paper copy is the only legible one — and if any rule repaints that
       figure, the figure is gone. */
    t.ok('the paper copy is paper THROUGHOUT, figure included',
      pilAll.every((b) => b.papFig === pilPaper && b.papUnit === pilPaper),
      JSON.stringify(pilAll.map((b) => b.state + ' fig:' + b.papFig)));
    t.ok('and the ink copy is not paper, or the unfilled end would be blank',
      pilAll.every((b) => b.inkFig && b.inkFig !== pilPaper),
      JSON.stringify(pilAll.map((b) => b.inkFig)));

    /* A bar filled to its end and one filled to nothing, in the same render:
       whichever way round it is, one of the two copies is doing the reading. */
    t.ok('the day under test has both a full pill and an almost empty one',
      pilAll.some((b) => b.fill >= 99) && pilAll.some((b) => b.fill <= 5),
      JSON.stringify(pilAll.map((b) => b.state + ':' + b.fill + '%')));

    t.ok('the paper copy is clipped to the fill rather than painted over it',
      pilAll.every((b) => /inset\(/.test(b.clip)), JSON.stringify(pilAll.map((b) => b.clip)));

    /* Eaten and planned are two different claims — food, and intention —
       and both are things you have put on the day yourself. A flat
       single-colour pill would have thrown that away to gain nothing. */
    t.ok('eaten and planned are still separate bands',
      pilAll.every((b) => b.bands === 2), JSON.stringify(pilAll.map((b) => b.bands)));

    /* The third band was the hatching, and it is gone. It drew what an EMPTY
       meal is assumed to become, which on a morning covered most of four
       bars and was the one band with nothing on it to act on. The assumption
       has not gone — it is still in the delta the top pills print — only the
       hatching has. */
    t.ok('and an empty meal no longer hatches itself across the bar',
      pilAll.every((b) => b.hatch === false),
      JSON.stringify(pilAll.map((b) => b.state + ':' + b.hatch)));

    t.ok('nothing spills out of a pill, and the headline is the tallest',
      pilAll.every((b) => b.spills === false) &&
      pilRead.kcal.h > pilRead.p.h && pilRead.p.h === pilRead.c.h,
      JSON.stringify(pilAll.map((b) => b.h)));
    await pil.context().close();

    /* ---- how far off, not merely which side ----------------------------
     *
       Blake, on his own week: "Right now I'm just seeing a lot of red and
       even though I'm close on some days I'm over so it's red." The square
       carried a verdict and nothing else, so a day 3% past its target drew
       the same red as a day 43% past it.
     *
       Widening the threshold does not fix that. Wherever the line is put,
       the day one calorie past it looks exactly like the day four hundred
       past it — moving a threshold moves the cliff. So the square carries a
       rail with the target marked on it, at the same place on all seven, and
       the verdict colour stays exactly as it was. */
    const spk = await t.fresh();
    const spkR = [1.05, 1.45, 0.75, 0.60];
    await spk.evaluate((ratios) => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const key = (o) => { const d = new Date(); d.setDate(d.getDate() + o);
        return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
      /* LAST week, Monday first, and every one of its days already past.
       *
         The strip draws the Monday-to-Sunday week the viewed day sits in, and
         this used to seed "the last four days" — which lands four cells in
         that week on most days and ONE of them on a Monday, when today is
         the first cell and the other six have not happened. Four tests
         therefore passed six days in seven, and went red on the seventh for
         a reason that had nothing to do with the code. Seeded against last
         week's Monday there is no such day. */
      const back = ((new Date().getDay() + 6) % 7) + 7;
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 204, f: 61, c: 72 }));
      localStorage.setItem('bsc.macroSlots', JSON.stringify({ list: [
        { k: 'a', n: 'Breakfast', t: 'b', w: 30 }, { k: 'l', n: 'Lunch', t: 'l', w: 35 },
        { k: 'd', n: 'Dinner', t: 'd', w: 35 }] }));
      /* Butter, because one food at a chosen multiple lands a day on an
         exact fraction of its target and nothing here is about the food. */
      const days = {};
      ratios.forEach((r, i) => {
        days[key(i - back)] = {
          a: [{ id: 'f:butter', x: 4 * 4.134 * r, eaten: 1 }], l: [], d: [] };
      });
      localStorage.setItem('bsc.macroDays', JSON.stringify(days));
    }, spkR);
    await spk.reload();
    await spk.waitForTimeout(450);
    await spk.click('.tab[data-view="macros"]');
    await spk.waitForTimeout(450);
    // and look at that week, so the strip is drawing the days just seeded
    await spk.selectOption('#macroDaySel', await spk.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date(); d.setDate(d.getDate() - (((new Date().getDay() + 6) % 7) + 7));
      return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
    }));
    await spk.waitForTimeout(350);
    /* Heights now, not widths: the rail became a bar standing in a chart
       cell, with the target a hairline across the week. Everything below
       is measured up from the track's foot. */
    const spkRead = await spk.evaluate(() => [...document.querySelectorAll('.mwk-d')].map((d) => {
      const fill = d.querySelector('.mwk-b i'), rail = d.querySelector('.mwk-b');
      const mark = d.querySelector('.mwk-g');
      const lab = d.getAttribute('aria-label') || '';
      const ate = Number((lab.match(/, (\d+) (?:eaten|on the day)/) || [])[1] || 0);
      const tgt = Number((lab.match(/(\d+) calorie target/) || [])[1] || 0);
      return { pct: tgt ? ate / tgt : 0,
        verdict: (d.className.match(/\b(under|on|over)\b/) || [''])[0],
        /* Measured in pixels, because a percentage is what the code wrote and
           pixels are what an eye is given. */
        px: fill ? fill.getBoundingClientRect().height : null,
        railPx: rail ? rail.getBoundingClientRect().height : null,
        markPx: (mark && rail)
          ? rail.getBoundingClientRect().bottom - mark.getBoundingClientRect().bottom : null };
    }));
    const spkFed = spkRead.filter((d) => d.pct > 0);
    t.ok('every day with food on it carries a rail, and the empty ones do not',
      spkFed.length === 4 && spkFed.every((d) => d.px !== null) &&
      spkRead.filter((d) => !d.pct).every((d) => d.px === null),
      JSON.stringify(spkRead.map((d) => Math.round(d.pct * 100) + '%:' +
        (d.px === null ? 'none' : Math.round(d.px)))));

    /* The whole point: two days that are both "over" are told apart. */
    const spkNear = spkFed.filter((d) => d.pct > 1.02 && d.pct < 1.12)[0];
    const spkFar = spkFed.filter((d) => d.pct > 1.3)[0];
    t.ok('two days that are both over read as different distances',
      !!spkNear && !!spkFar && spkNear.verdict === 'over' && spkFar.verdict === 'over' &&
      spkFar.px - spkNear.px >= 6,
      JSON.stringify({ near: spkNear && Math.round(spkNear.px),
        far: spkFar && Math.round(spkFar.px), rail: spkFed[0].railPx }));

    /* The mark is where the target is, and that is the whole legend: the
       fill has either passed the notch or it has not.
     *
       Asserted as a RELATIONSHIP rather than by seeding a day at exactly
       100% of target. The first version fed a chosen multiple of one food
       and demanded the fill land on the mark — the multiple drifted 4%, the
       "on target" day arrived at 104%, and the assertion failed for
       arithmetic reasons with nothing to do with the rail. What a reader
       uses is the side, not the pixel. */
    t.ok('a day under its target stops short of the mark, and one over passes it',
      spkFed.length === 4 &&
      spkFed.filter((d) => d.pct < 0.98).every((d) => d.px < d.markPx - 1) &&
      /* And a day only a whisker over is not evidence either way. The fill
         is 0.66 of the track per unit of target and the mark sits at 0.66 of
         it, so at 109% the two are a pixel apart — inside the rendering's
         own noise, and inside the 4% the butter multiple drifts by. Same
         reasoning as the sentence above, pointed at the other end: what a
         reader uses is the side, and a day this close has no side. */
      spkFed.filter((d) => d.pct > 1.15).every((d) => d.px > d.markPx + 1),
      JSON.stringify(spkFed.map((d) => Math.round(d.pct * 100) + '%: fill ' +
        Math.round(d.px) + ' vs mark ' + Math.round(d.markPx))));

    /* The mark is in the same place on all seven, so the week reads across as
       well as down — seven rails each scaled to their own day would be seven
       charts, not one. */
    t.ok('and the target line sits at the same height on every bar',
      spkFed.every((d) => Math.abs(d.markPx - spkFed[0].markPx) <= 1),
      JSON.stringify(spkFed.map((d) => Math.round(d.markPx))));

    /* And the verdict colour is untouched: this adds distance, it does not
       replace the thing that was already working. */
    t.ok('the verdict colours are still there underneath',
      spkFed.every((d) => !!d.verdict) &&
      spkFed.filter((d) => d.verdict === 'over').length >= 2 &&
      spkFed.filter((d) => d.verdict === 'under').length >= 1,
      JSON.stringify(spkFed.map((d) => Math.round(d.pct * 100) + '%:' + d.verdict)));
    await spk.context().close();

    /* ---- skipping a meal ------------------------------------------------
     *
       Blake: "with skip, should I also be able to tell it where to send the
       macros and calories?" He could not, and not because the chooser
       refused him: it renders inside .mslot-items and the skipped-meal
       branch returns before that exists, so it was unreachable. The row just
       announced the handout as done — "its share went to the rest".
     *
       Its own page, because a skip is the largest cascade the day makes: a
       whole meal's share, handed out at once. */
    const skp = await t.fresh();
    await skp.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n; const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 204, f: 61, c: 72 }));
      localStorage.setItem('bsc.macroSlots', JSON.stringify({ list: [
        { k: 'a', n: 'Wake Up', t: 's', w: 15 }, { k: 'b', n: 'Breakfast', t: 'b', w: 25 },
        { k: 'c', n: 'Snacks', t: 's', w: 5 }, { k: 'l', n: 'Lunch', t: 'l', w: 20 },
        { k: 'd', n: 'Dinner', t: 'd', w: 30 }, { k: 'f', n: 'Evening Snack', t: 's', w: 5 }] }));
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        a: [{ id: 'f:egg', x: 2, eaten: 1 }], b: [{ id: 'f:egg', x: 3, eaten: 1 }],
        c: [], l: [], d: [], f: [] } }));
    });
    await skp.reload();
    await skp.waitForTimeout(450);
    await skp.click('.tab[data-view="macros"]');
    await skp.waitForTimeout(400);
    const skAsk = (pg) => pg.evaluate(() => {
      const o = {};
      document.querySelectorAll('.mslot').forEach((c) => {
        const n = (c.querySelector('.mslot-name') || {}).textContent;
        const t2 = c.querySelector('.mmp.kc[data-want]');
        if (n && t2) o[n.trim()] = Number(t2.dataset.want);
      });
      return o;
    });
    const skCard = (pg) => pg.evaluate(() => {
      const el = document.querySelector('.mcasc');
      if (!el) return null;
      return { inSkip: !!el.closest('.mslot-skipped'),
        shut: el.classList.contains('shut'),
        h: Math.round(el.getBoundingClientRect().height),
        head: (el.querySelector('.mcasc-t') || {}).textContent,
        said: (el.querySelector('.mcasc-s') || {}).textContent,
        on: [...el.querySelectorAll('.mcasc-row[aria-checked="true"] .mcasc-nm')]
          .map((n) => n.textContent.replace(/at its (floor|ceiling)/, '').trim()),
        /* Each row's own share and what it is asked for, so an assertion can
           say "back to its share" rather than guessing a figure. */
        rows: [...el.querySelectorAll('.mcasc-row')].map((r) => ({
          n: (r.querySelector('.mcasc-nm') || {}).textContent
            .replace(/at its (floor|ceiling)/, '').trim(),
          was: Number(((r.querySelector('.mcasc-was') || {}).textContent || '')
            .split('\u2192')[0].trim()),
          on: r.getAttribute('aria-checked') === 'true' })) };
    });
    const skBefore = await skAsk(skp);
    await skp.click('#macroSlots [data-mskip="l"]');
    await skp.waitForTimeout(500);
    const skAfter = await skAsk(skp);
    const skOpen = await skCard(skp);

    t.ok('skipping a meal offers the same chooser, on the skipped row itself',
      !!skOpen && skOpen.inSkip && !skOpen.shut && skOpen.on.length === 3,
      JSON.stringify(skOpen));
    t.ok('and it names the meal and what skipping it frees',
      !!skOpen && /Skipping Lunch frees \d+/.test(skOpen.head), JSON.stringify(skOpen));

    /* You cannot send freed calories backwards in time. A skipped meal's
       weight comes out of the denominator so its food goes to the meals
       still AHEAD of you — which used to raise the target on meals already
       eaten and closed: Wake Up went 248 to 310 hours after it was finished,
       and its bar then read 62 short of something the day never asked it
       for. Nothing moved; the figure beside it was a false claim about the
       past. */
    t.ok('and a meal already eaten keeps the target the day actually asked it for',
      skAfter['Wake Up'] === skBefore['Wake Up'] &&
      skAfter.Breakfast === skBefore.Breakfast,
      JSON.stringify({ before: skBefore, after: skAfter }));
    t.ok('while the meals still ahead of you take the freed share',
      skAfter.Dinner > skBefore.Dinner + 1 && skAfter.Snacks > skBefore.Snacks + 1,
      JSON.stringify({ before: skBefore, after: skAfter }));

    /* And it can be steered, which is the whole ask. Take Dinner out and it
       goes back to its own plan while the two small meals hit their ceiling
       — a meal never grows past twice its share — so most of a whole meal's
       worth has nowhere to go, and the card says how much. */
    const skRows = await skp.$$('.mcasc .mcasc-row');
    for (const r of skRows) {
      if (/Dinner/.test(await r.textContent())) { await r.click(); break; }
    }
    await skp.waitForTimeout(450);
    const skAimed = await skAsk(skp);
    const skLine = await skCard(skp);
    /* Back to its own share — and its own share, for a meal still ahead of
       you on a day with a skip in it, already counts the skipped meal's
       weight. That is upstream of this card, in mMealShare, and it is there
       for a reason the file records: Fill sizes a plate to the post-skip
       share, so a share that still divided by the skipped meal called that
       plate "over". mAssumed copies the same rule.
     *
       So the checkbox governs the CASCADE — the part mPlaceLeft hands out,
       357 of Dinner's 480 here — and not the denominator. Asserted against
       the row's own `was` rather than against the pre-skip ask, because the
       row is telling the truth about what it covers and the test should pin
       that truth rather than a tidier one. */
    const skDin = skLine.rows.filter((r) => r.n === 'Dinner')[0];
    t.ok('unticking a meal puts it back on the share its own row states',
      !!skDin && !skDin.on && Math.abs(skAimed.Dinner - skDin.was) <= 2 &&
      skAimed.Dinner < skAfter.Dinner - 100 &&
      skAimed.Snacks > skAfter.Snacks + 1,
      JSON.stringify({ skAimed, skAfter, row: skDin }));
    t.ok('and the card says how much of the freed meal has nowhere to go',
      /day ends \d+ short/.test(skLine.said) && /at the ceiling/.test(skLine.said),
      JSON.stringify(skLine));

    /* Then it folds, and the skipped row is a line again. */
    const skH = skLine.h;
    await skp.click('.mcasc [data-msend="ack"]');
    await skp.waitForTimeout(450);
    const skShut = await skCard(skp);
    t.ok('Done folds it back into the skipped row',
      !!skShut && skShut.inSkip && skShut.shut && skShut.h < skH / 2,
      JSON.stringify({ open: skH, shut: skShut && skShut.h }));
    t.ok('and the row stops claiming the share simply went to the rest',
      await skp.evaluate(() => {
        const w = document.querySelector('.mslot-skipped .mslot-skip-w');
        return !!w && !/went to the rest/.test(w.textContent);
      }),
      await skp.evaluate(() => (document.querySelector('.mslot-skipped .mslot-skip-w') || {}).textContent));

    await skp.context().close();

    /* ---- the question survives ARRIVING at the day ----------------------
     *
       On a meal WITH FOOD, which is where the fold is: a skipped meal's card
       sits on its own row and was never at risk, and writing this against
       one is how the first version of this guard passed while the bug stood.
     *
       The card lives inside the meal's fold, which is Blake's call and the
       right one — a question about a meal should not outlive shutting that
       meal. But arriving at the day is not shutting it. Everything with food
       on it folds on arrival, the finished meal carrying the card has food
       on it, and so the card was folded away before it had ever been read:
       every reload, every tab switch, every return to My Day. Blake's own
       screenshot, a lunch 750 over its share, no card anywhere.
     *
       This arrives the way a thumb arrives — reload, press the tab — and
       calls no helper to open anything. The cascade block above opens the
       meal by hand and would pass with the card unreachable, which is how it
       stayed unreachable through two redesigns of the thing. */
    const arv = await t.fresh();
    await arv.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n; const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 204, f: 61, c: 72 }));
      localStorage.setItem('bsc.macroSlots', JSON.stringify({ list: [
        { k: 'b', n: 'Breakfast', t: 'b', w: 25 }, { k: 'l', n: 'Lunch', t: 'l', w: 35 },
        { k: 'd', n: 'Dinner', t: 'd', w: 40 }] }));
      // a breakfast of eight tablespoons of butter, eaten: far over its share
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: 'f:butter', x: 8, eaten: 1 }], l: [{ id: 'f:egg', x: 1 }], d: [] } }));
    });
    const arrive = async () => {
      await arv.reload();
      await arv.waitForTimeout(500);
      await arv.click('.tab[data-view="macros"]');
      await arv.waitForTimeout(450);
      return arv.evaluate(() => {
        const el = document.querySelector('.mcasc');
        const bk = [...document.querySelectorAll('.mslot')].filter((x) =>
          /breakfast/i.test((x.querySelector('.mslot-name') || {}).textContent || ''))[0];
        return { card: el ? (el.querySelector('.mcasc-t') || {}).textContent : null,
          open: !!(bk && bk.querySelector('.mslot-items')) };
      });
    };
    const arv1 = await arrive();
    t.ok('the meal holding an unanswered question is open the moment you arrive',
      !!arv1.card && arv1.open && /went \d+ over its share/.test(arv1.card),
      JSON.stringify(arv1));

    /* ...and once answered it stops holding the meal open, which is what
       answering it was for. The pills keep the result. */
    await arv.click('.mcasc [data-msend="ack"]');
    await arv.waitForTimeout(400);
    const arv2 = await arrive();
    t.ok('and once answered it folds away like any other finished meal',
      !arv2.card && !arv2.open, JSON.stringify(arv2));
    await arv.context().close();

    /* ---- a skipped meal with nothing to hand out is still a ROW ---------
     *
       Only the LAST finished meal carries a cascade, so most skipped meals
       have no card — and that is the branch I broke. The row and the card
       were one element; when the card moved in, the flex layout stayed on
       the outer box and the row became a bare block, so it only laid itself
       out when a card happened to be there to pull it into shape. Blake's
       phone read "Snacksskipped" with the Undo shoved against the words. */
    const skb = await t.fresh();
    await skb.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n; const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 204, f: 61, c: 72 }));
      localStorage.setItem('bsc.macroSlots', JSON.stringify({ list: [
        { k: 'b', n: 'Breakfast', t: 'b', w: 30 }, { k: 'l', n: 'Lunch', t: 'l', w: 30 },
        { k: 'f', n: 'Evening Snack', t: 's', w: 40 }] }));
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: { b: [], l: [], f: [] } }));
      // the LAST meal, so there is nothing after it and no cascade to carry
      localStorage.setItem('bsc.macroSkip', JSON.stringify({ [k]: ['f'] }));
    });
    await skb.reload();
    await skb.waitForTimeout(450);
    await skb.click('.tab[data-view="macros"]');
    await skb.waitForTimeout(400);
    const skbRow = await skb.evaluate(() => {
      const el = document.querySelector('.mslot-skipped');
      if (!el) return null;
      const h = el.querySelector('.mslot-skip-h');
      const n = el.querySelector('.mslot-skip-n'), w = el.querySelector('.mslot-skip-w');
      const u = el.querySelector('.mslot-unskip');
      return { card: !!el.querySelector('.mcasc'),
        row: !!h && getComputedStyle(h).display === 'flex',
        gap: Math.round(w.getBoundingClientRect().left - n.getBoundingClientRect().right),
        undoInside: u.getBoundingClientRect().right <= el.getBoundingClientRect().right + 1,
        onOneLine: Math.abs(n.getBoundingClientRect().top - u.getBoundingClientRect().top) < 30 };
    });
    t.ok('a skipped meal with no cascade to show is still laid out as a row',
      !!skbRow && !skbRow.card && skbRow.row && skbRow.gap >= 6 &&
      skbRow.undoInside && skbRow.onOneLine, JSON.stringify(skbRow));
    await skb.context().close();

    /* ---- pills the same size, always --------------------------------------
     *
     * Blake: "Can I get uniform pills on the meal cards, always the same
     * size?" They were shrink-to-fit, so 🔥600/98 wore a narrower box than
     * 🔥1104/586 and the four boxes landed somewhere different on every card.
     *
     * Run on a deliberately HEAVY day, and that is the whole point of it. The
     * first version of this ran on the ordinary day above and passed with a
     * spread of zero while the live app was 16.4 px apart: the numbers were
     * small enough to sit inside the floor, so the floor was all it ever
     * measured. What broke it was `.mmp-was` — the little "this is what the
     * meal used to be asked for" figure — sitting INLINE inside the pill, so
     * a pill whose target had moved was 75.4 px against an unmoved 59. The
     * numbers that say "the day moved under you" were the ones breaking the
     * alignment they were drawn on.
     *
     * So: four-digit calories, three-digit protein, and a share just moved,
     * which is the hardest day the app can be asked to keep uniform. */
    const pzWideDay = await t.fresh();
    await pzWideDay.evaluate(() => {
      const d = new Date();
      const k = d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) +
        '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: 'f:egg', x: 28, eaten: 1 }], l: [{ id: 'f:egg', x: 30, eaten: 0 }],
        d: [{ id: 'f:egg', x: 34, eaten: 0 }], s: [{ id: 'f:egg', x: 26, eaten: 0 }] } }));
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 300, f: 120, c: 400 }));
    });
    await pzWideDay.reload();
    await pzWideDay.waitForTimeout(400);
    await pzWideDay.click('.tab[data-view="macros"]');
    await pzWideDay.waitForTimeout(400);
    await openDay(pzWideDay);
    await pzWideDay.waitForTimeout(250);
    const pzWide = await pzWideDay.evaluate(() => {
      const kc = [], mac = [];
      document.querySelectorAll('.mslot .mmp').forEach((e) => {
        const w = Math.round(e.getBoundingClientRect().width * 10) / 10;
        (e.classList.contains('kc') ? kc : mac).push({ w: w, t: e.textContent.trim() });
      });
      const ends = (a) => a.slice().sort((x, y) => x.w - y.w);
      const sp = (a) => a.length ? ends(a)[a.length - 1].w - ends(a)[0].w : 0;
      return { kc: kc.length, mac: mac.length, kcSpread: sp(kc), macSpread: sp(mac),
        widestKc: ends(kc)[kc.length - 1], widestMac: ends(mac)[mac.length - 1] };
    });
    /* Said out loud: a green that came from an easy day is what let the real
       one through, so the day has to be hard before the widths mean anything.
       Hard means FOUR DIGITS — numbers big enough that a pill would overflow
       its floor if the floor were the only thing holding it. (This used to
       check that a was-number was rendered; those are gone, and the digits
       were always the better proxy anyway.) */
    t.ok('the widths are measured on a day whose numbers are big enough to matter',
      pzWide.kc >= 4 && /\d{4}/.test(pzWide.widestKc.t), JSON.stringify(pzWide));
    t.ok('every calorie pill in the day is exactly as wide as every other',
      pzWide.kcSpread === 0, JSON.stringify(pzWide));
    t.ok('and so is every macro pill', pzWide.macSpread === 0, JSON.stringify(pzWide));
    await pzWideDay.context().close();

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
      const t2 = sn && sn.querySelector('.mmp.kc[data-want]');
      return { ask: t2 ? Number(t2.dataset.want) : 0,
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
        const prL = { sex: 'm', age: 41, ft: 5, inch: 11, lb: 204, act: 1.55, goal: 'cut1',
          goalLb: cfg.noGoal ? 0 : 175, goalBy: cfg.noGoal ? '' : key(goal),
          workouts: 4, steps: 8000 };
        localStorage.setItem('bsc.macroProfile', JSON.stringify(prL));
      }, seed);
      await pg.reload();
      await pg.waitForTimeout(400);
      /* The plan this profile asks for, taken from the app rather than
         computed beside it. The profile states 204 lb and thirty mornings of
         weigh-ins put the body at 201.8, so a plan worked out here from the
         typed figure is a plan for somebody else — and "taking it leaves the
         protein alone" then compares two different people's protein.
       *
         The suite's 180/50/50 placeholder used to be rewritten on read,
         because 1,370 fell under the old 1,500 floor for a man. At the
         clinical 1,200 it stands, so a fixture that wants a coherent plan
         has to say so. */
      await pg.evaluate(() => {
        const plan = window.__macroLab.plan(window.__macroLab.profile());
        if (plan) localStorage.setItem('bsc.macroTargets',
          JSON.stringify({ p: plan.p, f: plan.f, c: plan.c }));
      });
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
    /* Behind the press now. It is evidence for a number rather than a thing
       to do, and Blake asked for it with the trend line: "I don't like the
       persistent salt notice... it is interesting once." */
    t.ok('a salty morning says nothing on the face, where a verdict would go',
      await salty.evaluate(() => !document.querySelector('.mw-verdict ~ .mline, .mslot-h ~ .mline')),
      await salty.evaluate(() => (document.querySelector('.mline') || {}).textContent || '(none)'));
    await openWeigh(salty);
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
    await openWeigh(gapCtl);
    t.ok('a salty morning against yesterday still reads as salt',
      /salt, not fat/.test(await gapCtl.textContent('.mline')),
      await gapCtl.textContent('.mline'));
    await gapCtl.context().close();

    const gapped = await lineFor({ n: 30, rate: 0, saltToday: true, gapDays: 14 });
    await openWeigh(gapped);
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
    /* It used to assert the offer cleared the BASAL RATE, which was this
       line keeping a floor of its own — and that floor sat ABOVE the plan, so
       on a day already behind pace the card offered more food than the plan
       and called it the lowest it goes. Blake's call was that the plan is
       whatever meets the goal, so the line now lives under the plan's floor:
       the nutrient floor, then what the fat store can actually supply. */
    t.ok('and never asks for less than the plan itself is allowed to be',
      await slow.evaluate(() => {
        const b = document.querySelector('[data-mline^="mline:eat"]');
        const want = Number(b.dataset.mline.split(':')[2]);
        return want >= window.__macroLab.floorK();
      }), behind);
    t.ok('and never offers MORE than the plan while saying it is the least it can',
      await slow.evaluate(() => {
        const b = document.querySelector('[data-mline^="mline:eat"]');
        const want = Number(b.dataset.mline.split(':')[2]);
        const t2 = JSON.parse(localStorage.getItem('bsc.macroTargets'));
        const plan = 4 * t2.p + 4 * t2.c + 9 * t2.f;
        /* Only when it is capped does it claim to be a floor. An uncapped
           number is an answer to the date, and may be anything. */
        return !/as low as this goes/.test(document.querySelector('.mline').textContent) ||
          want <= plan;
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
      }, heldP),
      'was p=' + heldP + ' now ' + await slow.evaluate(() => localStorage.getItem('bsc.macroTargets')));
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

    /* The invitation is on the bar while there is nothing to adjust; the card
       only offers "Adjust my plan", and only once there is one. Two labels,
       each naming the thing it actually does — the card used to say "Craft my
       plan" whether or not a plan existed. */
    /* Invites, wherever it is showing. "Craft" while nothing has been
       crafted; "Adjust" only once a profile stands behind the numbers. And
       only one of them at a time — there used to be three in a screenful. */
    t.ok('the plan button invites rather than administrates',
      await w.evaluate(() => {
        const bar = document.getElementById('macroFill');
        const card = document.querySelector('#macroTargBtn');
        const doors = [bar && bar.classList.contains('to-plan') ? bar : null, card]
          .filter(Boolean);
        return doors.length === 1 && /^Craft my plan$/.test(doors[0].textContent.trim());
      }),
      await w.evaluate(() => {
        const bar = document.getElementById('macroFill');
        const card = document.querySelector('#macroTargBtn');
        return 'bar=' + (bar ? bar.textContent + '/' + bar.className : 'none') +
          ' card=' + (card ? card.textContent : 'none');
      }));

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
    /* The cup is on the chip now and the weight on the dial — a food
       measured by the cup is dialled by the gram — so the word the table
       chose is read off the chip, and the dial is checked for the thing it
       must not say. */
    const said = await units.evaluate(() => {
      const x = document.querySelector('.mstep-x'), u = document.querySelector('.mitem-uom');
      return x ? { dial: x.textContent.trim(), chip: u ? u.textContent.trim() : '' } : null;
    });
    t.ok('the table states a portion for cheddar, and it is not a whole cheese',
      !!put && put.def && put.def !== 'each', JSON.stringify(put));
    t.ok('and the plate counts it in that, not in whole cheeses',
      !!said && said.dial.indexOf('whole') < 0 && said.chip.indexOf(put.def) >= 0,
      'the card says ' + JSON.stringify(said) + ', the table says ' + (put && put.def));
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

    /* ---- how far a portion goes ------------------------------------------
     * Blake, logging his lunch: "the limit on the qty I can select. Is it
     * limiting me to 4 nuts and won't let me add more." It was — and his day
     * had bacon at 4 slices, gummies at 4 pieces and ground beef at 4 oz, all
     * pinned on the same ceiling. Both steppers carried their own copy of
     * Math.min(4, x + 0.25): a sane ceiling for a multiple of a SERVING, and
     * a nonsense one for a count of a THING. */
    const qty = await t.fresh();
    const qtyFood = await qty.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      /* Blake's own case, seeded the way he made it: a food of his own,
         counted in a unit you cannot have a quarter of. The single foods the
         table ships are measured in grams and cups and never hit this. */
      localStorage.setItem('bsc.myFoods', JSON.stringify({
        corn_nuts: { name: 'Corn nuts', unit: 'nut', kcal: 4, p: 0, f: 0.2, c: 0.6 } }));
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 190, f: 55, c: 120 }));
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: 'f:my:corn_nuts', x: 1, eaten: 0 }], l: [], d: [], s: [] } }));
      return { id: 'f:my:corn_nuts', unit: 'nut', name: 'Corn nuts' };
    });
    await qty.reload();
    await qty.waitForTimeout(400);
    await qty.click('.tab[data-view="macros"]');
    await qty.waitForTimeout(300);
    await qty.evaluate(() => {
      const b = document.querySelector('#macroSlots [data-mfold][aria-expanded="false"]');
      if (b) b.click();
    });
    await qty.waitForTimeout(300);
    const readX = () => qty.evaluate(() => {
      const days = JSON.parse(localStorage.getItem('bsc.macroDays') || '{}');
      const k = Object.keys(days).sort().pop();
      return ((days[k] || {}).b || [])[0].x;
    });
    for (let i = 0; i < 12; i++) {
      await qty.click('#macroSlots [data-mstep$=":up"]');
      await qty.waitForTimeout(60);
    }
    const climbed = await readX();
    t.ok('a countable food climbs past four rather than stopping on it',
      climbed > 4, JSON.stringify({ food: qtyFood, x: climbed }));
    /* And it climbs in whole ones: a quarter of a nut is not a portion, it is
       an arithmetic accident. */
    /* Twelve presses from one, a whole nut each: thirteen. Asserted exactly,
       because "more than four" alone would pass on a stepper that had merely
       had its ceiling raised while still counting in quarters. */
    t.ok('and it climbs in whole ones, not in quarters',
      climbed === 13, JSON.stringify({ unit: qtyFood.unit, x: climbed }));
    t.ok('and the plate says so in the food own word',
      /13\s*nuts?/.test(await qty.textContent('#macroSlots .mstep-x')),
      await qty.textContent('#macroSlots .mstep-x'));
    /* The floor still holds: a portion never steps to nothing. */
    for (let i = 0; i < 40; i++) {
      await qty.click('#macroSlots [data-mstep$=":down"]');
      await qty.waitForTimeout(40);
    }
    t.ok('and it never steps down to nothing',
      (await readX()) > 0, JSON.stringify({ x: await readX() }));
    await qty.context().close();

    /* ---- what it weighs --------------------------------------------------
     * Blake: "sometimes it's just easier for me to measure the food on a scale
     * than using cups." A cup of oats is a range; 40 g of oats is 40 g. The
     * weight was on the plate until the provenance row was deleted and took
     * mPortion's detail with it — named as that removal's cost at the time,
     * and then found in use, which is the right order. It is back beside the
     * cost rather than beside the shelf the food came from. */
    const wg = await t.fresh();
    await wg.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 190, f: 55, c: 120 }));
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: 'f:cheddar', x: 1, eaten: 0 }], l: [], d: [], s: [] } }));
    });
    await wg.reload();
    await wg.waitForTimeout(400);
    await wg.click('.tab[data-view="macros"]');
    await wg.waitForTimeout(300);
    await wg.evaluate(() => {
      const b = document.querySelector('#macroSlots [data-mfold][aria-expanded="false"]');
      if (b) b.click();
    });
    await wg.waitForTimeout(300);
    const weighed = await wg.evaluate(() => {
      const row = document.querySelector('#macroSlots .mitem');
      /* It has its own chip on the facts band now, ahead of the figures —
         the weight is how you MEASURE the plate, so it leads the line that
         says what the plate is. */
      const g = row.querySelector('.mitem-uom');
      const mac = row.querySelector('.mitem-mac');
      if (!g || !mac) return null;
      const gb = g.getBoundingClientRect(), mb = mac.getBoundingClientRect();
      return { text: g.textContent.trim(),
        portion: (row.querySelector('.mstep-x') || {}).textContent.trim(),
        /* on the cost line, not on a line of its own */
        sameLine: Math.abs(gb.top - mb.top) < 6,
        quieter: parseFloat(getComputedStyle(g).fontSize) <=
          parseFloat(getComputedStyle(mac).fontSize) };
    });
    /* Turned around since: the weight is the number on the dial, because a
       food measured by the cup is dialled by the gram, and the cup it came
       in is the chip on the cost line. */
    t.ok('a plate measured in cups is dialled by the gram',
      !!weighed && /^\d+\s*g$/.test(weighed.portion), JSON.stringify(weighed));
    t.ok('and the cup it came in is the chip beside it',
      !!weighed && /cup/.test(weighed.text), JSON.stringify(weighed));
    t.ok('and it says it on the cost line, where the eye already is',
      !!weighed && weighed.sameLine, JSON.stringify(weighed));
    t.ok('and quieter than the cost, being how you measure it rather than what it costs',
      !!weighed && weighed.quieter, JSON.stringify(weighed));
    /* And a tap is at most five grams, to the next point on the five-gram
       grid: a cup of cheddar is 113 g and goes to 115, not to 120. The chip
       only moves when the weight crosses an eighth of a cup; the dial moves
       every time. */
    await wg.click('#macroSlots [data-mstep$=":up"]');
    await wg.waitForTimeout(250);
    t.ok('and a tap moves the weight up to the next five grams',
      await wg.evaluate((was) => {
        const x = document.querySelector('#macroSlots .mstep-x');
        return !!x && parseInt(x.textContent, 10) === Math.floor(parseInt(was, 10) / 5) * 5 + 5;
      }, weighed.portion),
      weighed.portion + ' → ' + await wg.evaluate(() => (document.querySelector('#macroSlots .mstep-x') || {}).textContent));
    await wg.context().close();

    /* ---- typing a portion ------------------------------------------------
     * Blake: "why even have a cap? Probably can remove it for foods." Right,
     * and the cap was never what stopped him: thirty nuts is twenty-nine taps
     * and a hundred and eighty-five grams is seven hundred and forty. The dial
     * gets you from one to two. A logger has to let you say the number.
     *
     * The unit stays beside the box and only the count is typed, so there is
     * nothing to parse and no way for a bare number to mean two things. */
    const typ = await t.fresh();
    await typ.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.myFoods', JSON.stringify({
        corn_nuts: { name: 'Corn nuts', unit: 'nut', kcal: 4, p: 0, f: 0.2, c: 0.6 },
        rice: { name: 'Rice, cooked', unit: 'g', kcal: 130, p: 2.7, f: 0.3, c: 28 } }));
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 190, f: 55, c: 120 }));
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: 'f:my:corn_nuts', x: 1, eaten: 0 },
            { id: 'f:my:rice', x: 1, eaten: 0 }], l: [], d: [], s: [] } }));
    });
    await typ.reload();
    await typ.waitForTimeout(400);
    await typ.click('.tab[data-view="macros"]');
    await typ.waitForTimeout(300);
    await typ.evaluate(() => {
      const b = document.querySelector('#macroSlots [data-mfold][aria-expanded="false"]');
      if (b) b.click();
    });
    await typ.waitForTimeout(300);
    const plate = (n) => typ.evaluate((i) => {
      const e = document.querySelectorAll('#macroSlots .mitem')[i];
      return { portion: (e.querySelector('.mstep-x') || {}).textContent.trim(),
        mac: (e.querySelector('.mitem-mac') || {}).textContent };
    }, n);

    await typ.click('#macroSlots .mitem:nth-of-type(1) [data-mtype]');
    await typ.waitForTimeout(200);
    t.ok('tapping a portion opens a box holding the number that was there',
      (await typ.inputValue('#macroSlots .mstep-in')) === '1',
      await typ.inputValue('#macroSlots .mstep-in'));
    await typ.fill('#macroSlots .mstep-in', '30');
    await typ.keyboard.press('Enter');
    await typ.waitForTimeout(300);
    const nuts = await plate(0);
    t.ok('and typing thirty makes it thirty, in the food own word',
      /^30\s*nuts?$/.test(nuts.portion), JSON.stringify(nuts));
    t.ok('and the cost follows it rather than the number alone moving',
      /^120 kcal/.test(nuts.mac), JSON.stringify(nuts));

    /* Grams are the case where the number on screen is NOT x: mPortion shows
       r.grams * x, so typing 185 and storing 185 would store a hundred and
       eighty-five portions of it. */
    await typ.click('#macroSlots .mitem:nth-of-type(2) [data-mtype]');
    await typ.waitForTimeout(200);
    t.ok('a food measured in grams opens on its grams, not on its multiplier',
      (await typ.inputValue('#macroSlots .mstep-in')) === '100',
      await typ.inputValue('#macroSlots .mstep-in'));
    await typ.fill('#macroSlots .mstep-in', '185');
    await typ.keyboard.press('Enter');
    await typ.waitForTimeout(300);
    const rice = await plate(1);
    t.ok('and typing its grams shows those grams back', /^185\s*g$/.test(rice.portion),
      JSON.stringify(rice));
    t.ok('and 185 g of it costs 185 g worth', /^233 kcal/.test(rice.mac),
      JSON.stringify(rice));
    t.ok('and what is stored is the multiplier, not the weight',
      await typ.evaluate(() => {
        const d = JSON.parse(localStorage.getItem('bsc.macroDays'));
        const k = Object.keys(d).sort().pop();
        return (d[k].b.filter((i) => i.id === 'f:my:rice')[0] || {}).x === 1.85;
      }),
      await typ.evaluate(() => {
        const d = JSON.parse(localStorage.getItem('bsc.macroDays'));
        const k = Object.keys(d).sort().pop();
        return JSON.stringify(d[k].b);
      }));

    /* Nonsense is not a portion. An empty box or a stray letter leaves the
       plate as it was rather than writing a nought and quietly taking the
       food off the day arithmetic. */
    await typ.click('#macroSlots .mitem:nth-of-type(1) [data-mtype]');
    await typ.waitForTimeout(200);
    await typ.fill('#macroSlots .mstep-in', 'abc');
    await typ.keyboard.press('Enter');
    await typ.waitForTimeout(300);
    t.ok('and nonsense typed into it changes nothing',
      /^30\s*nuts?$/.test((await plate(0)).portion), JSON.stringify(await plate(0)));
    await typ.click('#macroSlots .mitem:nth-of-type(1) [data-mtype]');
    await typ.waitForTimeout(200);
    await typ.fill('#macroSlots .mstep-in', '0');
    await typ.keyboard.press('Enter');
    await typ.waitForTimeout(300);
    t.ok('and nor does a nought, which is not a portion either',
      /^30\s*nuts?$/.test((await plate(0)).portion), JSON.stringify(await plate(0)));

    /* And the solver may now PROPOSE a size a food actually comes in.
     *
       Asserted by making it climb, not by leaving a big number alone: the
       descent starts from the plate's current size and only moves if a rung
       beats it, so a hand-set thirty survives the old quarter-to-four ladder
       too — on a day still under target, where bigger always scores better.
       That made the first version of this test pass against the very code it
       was written to catch. Starting LOW is what separates them: the old
       ladder could not offer more than four of anything, whatever the day
       wanted. */
    await typ.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [{ id: 'f:my:corn_nuts', x: 1, eaten: 0 }], l: [], d: [], s: [] } }));
    });
    await typ.reload();
    await typ.waitForTimeout(400);
    await typ.click('.tab[data-view="macros"]');
    await typ.waitForTimeout(300);
    await typ.evaluate(() => {
      const b = document.querySelector('#macroSlots [data-mfold][aria-expanded="false"]');
      if (b) b.click();
    });
    await typ.waitForTimeout(300);
    await typ.click('#macroRebal');
    await typ.waitForTimeout(700);
    const reb = await plate(0);
    t.ok('Rebalance can offer more of a food than a dish ceiling ever allowed',
      Number((reb.portion.match(/[\d.]+/) || [0])[0]) > 4, JSON.stringify(reb));
    await typ.context().close();

    /* ---- the family week, on the day ------------------------------------
     * The two halves of this app had never spoken. The Plan tab keeps a week
     * of meals for the house — shared with whoever holds the code — and My Day
     * kept a private day measured against a cut, and neither read the other.
     * You could plan Tuesday's dinner on one screen and, on Tuesday, press
     * Fill on the other and be handed something else.
     *
     * Blake: "seeding my day with family recipes planned for that day would be
     * good... auto fill a day based on my favorites and best fits." So Fill
     * now means: draft my day, starting from what the family already decided.
     *
     * The week is dateless by design — "Monday is a slot, not a date" — so the
     * join is the weekday, and it is a READ. The day may take from the week;
     * the week must never notice. */
    const fam = await t.fresh();
    const famPick = await fam.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      const g = new Date(); g.setDate(g.getDate() + 120);
      /* A dinner, so the slot it lands on is decided by its own section and
         can be checked rather than assumed. */
      const dinner = window.RECIPES.find((r) => r.macro && r.macro.kcal > 250 &&
        ['1-4', '2-3', '2-4'].indexOf(r.book + '-' + r.secNum) >= 0);
      const wd = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getDay()];
      const weeks = { w1: { name: 'This Week', ord: 0, plan: {}, checked: {} } };
      weeks.w1.plan[wd] = [{ i: dinner.id, x: 1 }];
      localStorage.setItem('bsc.weeks', JSON.stringify(weeks));
      localStorage.setItem('bsc.active', 'w1');
      localStorage.setItem('bsc.macroProfile', JSON.stringify({
        sex: 'm', age: 43, ft: 5, inch: 11, lb: 204, act: 1.55, goal: 'cut1', goalLb: 175,
        goalBy: g.getFullYear() + '-' + p2(g.getMonth() + 1) + '-' + p2(g.getDate()),
        workouts: 4, steps: 8000 }));
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {} }));
      return { id: dinner.id, name: dinner.name, weekday: wd, kcal: dinner.macro.kcal };
    });
    await fam.reload();
    await fam.waitForTimeout(400);
    await fam.click('.tab[data-view="macros"]');
    await fam.waitForTimeout(300);
    await fam.click('#macroFill');
    await fam.waitForTimeout(600);

    const famDay = await fam.evaluate((want) => {
      const days = JSON.parse(localStorage.getItem('bsc.macroDays') || '{}');
      const k = Object.keys(days).sort().pop();
      const day = days[k] || {};
      const where = Object.keys(day).filter((sk) => (day[sk] || [])
        .some((it) => it.id === want.id));
      const plate = (day[where[0]] || []).filter((it) => it.id === want.id)[0];
      const all = Object.keys(day).reduce((n, sk) => n + (day[sk] || []).length, 0);
      return { on: where, plate: plate || null, plates: all,
        weekUntouched: localStorage.getItem('bsc.weeks') };
    }, famPick);

    t.ok('Fill puts the dish the family planned for today on the day',
      famDay.on.length === 1, JSON.stringify({ famPick, on: famDay.on }));
    /* Its section decides the meal — the same map Fill steers by. A dinner
       recipe does not land on breakfast. */
    t.ok('and on the meal its own section names, not the first one going',
      famDay.on[0] === 'd', JSON.stringify(famDay.on));
    /* Marked, so a plate knows where it came from — beside 'f' for fill. */
    t.ok('and the plate says it came from the week',
      !!famDay.plate && famDay.plate.by === 'w', JSON.stringify(famDay.plate));
    /* The portion is not left at the 1x it was placed with: mBalanceDay sizes
       every plate on the finished day at once, which is the only place that
       can see what the rest of the day came to. This is the "solved to fit my
       macros" half of the answer. */
    t.ok('and its portion is solved against the day rather than left at one',
      !!famDay.plate && famDay.plate.x > 0, JSON.stringify(famDay.plate));
    /* Fill still did its own job around it. */
    t.ok('and the rest of the day is drafted around it',
      famDay.plates > 1, JSON.stringify({ plates: famDay.plates }));
    /* The week belongs to the house. Reading it must not edit it. */
    t.ok('and the family\u2019s week is not touched by any of it',
      (() => { const w2 = JSON.parse(famDay.weekUntouched || '{}');
        const pl = ((w2.w1 || {}).plan || {})[famPick.weekday] || [];
        return pl.length === 1 && (pl[0].i || pl[0]) === famPick.id; })(),
      famDay.weekUntouched);

    /* And it does not overwrite a meal you have already dealt with. */
    await fam.evaluate((want) => {
      const days = JSON.parse(localStorage.getItem('bsc.macroDays') || '{}');
      const k = Object.keys(days).sort().pop();
      const other = window.RECIPES.find((r) => r.macro && r.id !== want.id);
      localStorage.setItem('bsc.macroDays', JSON.stringify({
        [k]: { d: [{ id: other.id, x: 1, eaten: 1 }] } }));
      window.__other = other.id;
    }, famPick);
    await fam.reload();
    await fam.waitForTimeout(400);
    await fam.click('.tab[data-view="macros"]');
    await fam.waitForTimeout(300);
    await fam.click('#macroFill');
    await fam.waitForTimeout(600);
    t.ok('and a meal already eaten is left exactly as it was',
      await fam.evaluate((want) => {
        const days = JSON.parse(localStorage.getItem('bsc.macroDays') || '{}');
        const k = Object.keys(days).sort().pop();
        const d = (days[k] || {}).d || [];
        return d.length === 1 && d[0].id !== want.id && d[0].eaten === 1;
      }, famPick),
      await fam.evaluate(() => {
        const days = JSON.parse(localStorage.getItem('bsc.macroDays') || '{}');
        const k = Object.keys(days).sort().pop();
        return JSON.stringify((days[k] || {}).d || []);
      }));
    await fam.context().close();

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
        from: (row.querySelector('.mitem-from') || {}).textContent || '',
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
    /* And what the recipe MAKES is no longer said here at all. The yield went
       with the book and the portion detail when the provenance row was
       deleted: it is a cooking fact rather than an eating one, and the plate
       is the eating. "Makes 4" is on the recipe, behind the name.

       The distinction this leaves is the one that was always doing the work,
       and it is asserted directly above: the plate says the PART, not the
       batch. A row that said "1¾ servings" and "makes 8" in the same breath
       was offering two numbers for one question. */
    t.ok('while what the recipe makes is no longer said on the plate',
      !!batCard && batCard.from === '' &&
      batCard.amount.indexOf('makes') < 0 && batCard.mac.indexOf('makes') < 0,
      'from "' + (batCard && batCard.from) + '" amount "' +
        (batCard && batCard.amount) + '" mac "' + (batCard && batCard.mac) + '"');
    await batch.context().close();

    /* ---- the one thing on that row worth keeping -------------------------
     * The salt warning came off the provenance row rather than going with it:
     * it is the only one of those four that was a WARNING and not a label, so
     * it moved up beside the figures, which is where the other things a plate
     * costs you already are.
     *
     * It stopped being a chip on the way, and that is the bug. At 74x16 inside
     * an 11px-tall .mitem-from carrying overflow:hidden it overhung 2.5px top
     * and bottom, and both were shaved off — so the border drawn to mark it as
     * a warning reached the screen as two loose vertical strokes either side
     * of the words: "RUN │1,079 mg salt│". The comment in the stylesheet was
     * proud of that border for months.
     *
     * A known salty recipe on a known day, for the same reason the batch above
     * gets one: the shared fixture's plates are whatever Fill drafted, and a
     * day of unsalted ones would pass this while proving nothing. */
    const saltPage = await t.fresh();
    const salt = await saltPage.evaluate(() => {
      const r = window.RECIPES.find((q) => q.macro && q.macro.na > 900);
      if (!r) return null;
      const d = new Date();
      const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
        '-' + String(d.getDate()).padStart(2, '0');
      const days = {}; days[k] = { b: [{ id: r.id, x: 1, eaten: 0 }] };
      localStorage.setItem('bsc.macroDays', JSON.stringify(days));
      return { name: r.name, na: r.macro.na };
    });
    t.ok('the book still holds a plate salty enough to warn about',
      !!salt, JSON.stringify(salt));
    await saltPage.reload();
    await saltPage.click('.tab[data-view="macros"]');
    await saltPage.waitForTimeout(300);
    for (let i = 0; i < 3; i++) {
      if (!await saltPage.evaluate(() => !!document.querySelector('.mslot-thin'))) break;
      await saltPage.click('#macroOpenAll');
      await saltPage.waitForTimeout(200);
    }
    t.ok('a salty plate says so in words, whole, inside its own box on every edge',
      await saltPage.evaluate(() => {
        const el = document.querySelector('#macroSlots .msalt');
        if (!el) return false;
        const meta = el.closest('.mitem-r2');
        const mb = meta.getBoundingClientRect(), sb = el.getBoundingClientRect();
        return /mg salt/.test(el.textContent) &&
          /* Nothing of it clipped, on either axis. The chip it replaces failed
             on the VERTICAL, which is the axis nobody thinks to check — and
             the reason it was invisible for so long is that the horizontal
             was fine. */
          sb.top >= mb.top - 0.5 && sb.bottom <= mb.bottom + 0.5 &&
          sb.left >= mb.left - 0.5 && sb.right <= mb.right + 0.5 &&
          el.scrollWidth <= el.clientWidth + 1 &&
          el.scrollHeight <= el.clientHeight + 1;
      }),
      await saltPage.evaluate(() => {
        const el = document.querySelector('#macroSlots .msalt');
        if (!el) return 'no salt warning drawn';
        const box = (e) => { const b = e.getBoundingClientRect();
          return [b.top, b.bottom, b.left, b.right].map(Math.round).join(','); };
        return el.textContent.trim() + ' salt[' + box(el) + '] meta[' +
          box(el.closest('.mitem-r2')) + ']';
      }));
    /* And it is a warning rather than a label, said by the ink now that there
       is no border left to say it. */
    t.ok('and says it in the warning colour, not in the colour of the figures',
      await saltPage.evaluate(() => {
        const el = document.querySelector('#macroSlots .msalt');
        const mac = document.querySelector('#macroSlots .mitem-mac');
        if (!el || !mac) return false;
        return getComputedStyle(el).color !== getComputedStyle(mac).color;
      }));
    await saltPage.context().close();

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
        const rows = [...document.querySelectorAll('[data-macro] .mb-d b')].map((x) => x.textContent);
        /* The limit pills carry the figure only — the fill says the
           proportion, so a denominator would say it twice, and dropping it is
           what buys every pill the same width. The open bars keep both.
         *
           The limit ROWS are gone from the card unless one of them is off,
           so they cannot be the source here: `lim` would be empty and
           `[].every()` is true, which is a guard that passes hardest when
           the thing it guards has been deleted. So the last two pills are
           asserted on their own terms — the glyph that names which limit,
           and a figure — and any row that IS showing must agree with its
           pill. */
        const lim = [...document.querySelectorAll('.mlimits .mlim')].map((r) =>
          ({ k: r.dataset.lim, v: (r.querySelector('.mlim-t b').textContent
            .match(/[\d,]+/) || [''])[0].replace(/,/g, '') }));
        const IDX = { fib: 4, na: 5 };
        return pills.length === 6 &&
          rows.length === 4 && rows.every((v, i) => pills[i].indexOf(v) >= 0) &&
          /🌾\d/.test(pills[4]) && /🧂\d/.test(pills[5]) &&
          lim.every((x) => pills[IDX[x.k]].indexOf(x.v) >= 0);
      }), await ph.evaluate(() => document.querySelector('.mpills').textContent));
    /* And each one is its own bar. This is the whole reason the row exists in
       this form: folded, the number gives the gap and the fill gives the
       proportion, so "under" stops being four identical greys. */
    /* Across the whole row, and the two limits set apart from the four
       that matter most. Measured at 375, the narrowest phone the row was
       ever sized for, and the row must not scroll there. */
    await ph.setViewportSize({ width: 375, height: 720 });
    await ph.waitForTimeout(200);
    const laid = await ph.evaluate(() => {
      const row = document.querySelector('.mpills').getBoundingClientRect();
      const ps = [...document.querySelectorAll('.mpill')].map((p) => p.getBoundingClientRect());
      const w = ps.slice(0, 4).map((r) => Math.round(r.width));
      return { n: ps.length, macroWidths: w,
        equal: Math.max.apply(null, w) - Math.min.apply(null, w) <= 1,
        fillsRow: Math.round(row.right - ps[ps.length - 1].right) <= 1,
        breakBeforeLimits: Math.round(ps[4].left - ps[3].right) >= 8,
        scrolls: document.querySelector('.mpills').scrollWidth >
          document.querySelector('.mpills').clientWidth + 1 };
    });
    t.ok('the four macro pills share the row equally and reach its far edge',
      laid.n === 6 && laid.equal && laid.fillsRow, JSON.stringify(laid));
    t.ok('with a break before fibre and salt, and no sideways scroll on a 375 phone',
      laid.breakBeforeLimits && !laid.scrolls, JSON.stringify(laid));
    await ph.setViewportSize({ width: 390, height: 720 });
    await ph.waitForTimeout(200);
    t.ok('and each pill is filled to the same point as the bar it stands for',
      await ph.evaluate(() => {
        const pct = (el) => {
          const m = (el.getAttribute('style') || '').match(/0 ([\d.]+)%/);
          return m ? parseFloat(m[1]) : null;
        };
        const pills = [...document.querySelectorAll('.mpill')];
        const rows = [...document.querySelectorAll('[data-macro]')];
        const okMacro = rows.every((r, i) =>
          pct(pills[i]) !== null && Math.abs(pct(pills[i]) - Number(r.dataset.planned)) <= 1);
        /* The two limit pills are checked against the caps themselves,
           because the rows that used to carry a denominator only appear when
           one of them is off — and a comparison against an absent row is a
           comparison that always holds. The sodium ceiling is fixed; the
           fibre floor is 14 g per 1000 kcal of the day's own target, which
           the headline prints. */
        const tK = Number((document.querySelector('.mhead .mb-num').textContent
          .match(/\/\s*([\d,]+)/) || [0, 0])[1].replace(/,/g, ''));
        const CAP = { 4: Math.round(tK * 14 / 1000), 5: 2300 };
        const okLim = [4, 5].every((i) => {
          const got = Number((pills[i].textContent.match(/[\d,]+/) || ['0'])[0].replace(/,/g, ''));
          const want = Math.min(100, 100 * got / CAP[i]);
          return CAP[i] > 0 && pct(pills[i]) !== null && Math.abs(pct(pills[i]) - want) <= 1;
        });
        return okMacro && rows.length === 4 && okLim;
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
        const rows = [...document.querySelectorAll('[data-macro]')];
        return rows.every((r, i) => tone(pills[i]).indexOf(r.dataset.state) >= 0);
      }),
      await ph.evaluate(() => [...document.querySelectorAll('[data-macro]')]
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
    /* Measured on a real 375 viewport now. The old proxy — the pills' span
       against "this row minus 15px" on a 390 page — assumed the pills keep
       their natural width, and since the four macro pills share the row
       they always span all of it. The honest check is the narrow phone
       itself: no sideways scroll, and the last pill inside the row. */
    await ph.setViewportSize({ width: 375, height: 720 });
    await ph.waitForTimeout(200);
    t.ok('and all six fit a 375-wide phone even on a day of three-digit deltas',
      await ph.evaluate(() => {
        const row = document.querySelector('.mpills');
        const vals = ['+159', '-24', '+12', '+37', '8', '1474'];
        row.querySelectorAll('.mpill b').forEach((el, i) => { el.textContent = vals[i]; });
        const ps = row.querySelectorAll('.mpill');
        return row.scrollWidth <= row.clientWidth + 1 &&
          ps[ps.length - 1].getBoundingClientRect().right <= row.getBoundingClientRect().right + 1;
      }), await ph.evaluate(() => {
        const row = document.querySelector('.mpills');
        return 'row scrolls ' + row.scrollWidth + 'px of ' + row.clientWidth + 'px';
      }));
    await ph.setViewportSize({ width: 390, height: 720 });
    await ph.waitForTimeout(200);
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

    /* ---- the plan screen, rearranged ------------------------------------
     *
     * Three things moved. The plan became four facts you can read; the meal
     * editor — six rows of five controls, about three fifths of the screen —
     * folded to the one line anybody opens it to check; and Save went with
     * it, because a screen you are only reading has nothing to commit.
     *
     * The fourth fact is the one that was not on this screen at all: where
     * the scale says you actually stand. It lived only on My Day, so the plan
     * could be read end to end without ever meeting the evidence for it. */
    const planPage = async (drift) => {
      const pg = await t.fresh();
      await pg.evaluate((dr) => {
        const p2 = (n) => (n < 10 ? '0' : '') + n;
        const key = (off) => {
          const d = new Date(); d.setDate(d.getDate() + off);
          return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
        };
        const ws = {};
        // twenty mornings, drifting `dr` lb a day off a 205 lb start
        for (let i = 19; i >= 0; i--) ws[key(-i)] = Math.round((205 - (19 - i) * dr) * 10) / 10;
        localStorage.setItem('bsc.macroWeights', JSON.stringify(ws));
        localStorage.setItem('bsc.macroProfile', JSON.stringify({ sex: 'm', age: 43, ft: 5,
          inch: 11, lb: 205, act: 1.375, goal: 'cut1', goalLb: 185, goalBy: key(70),
          workouts: 3, steps: 8000 }));
        localStorage.removeItem('bsc.macroTargets');
      }, drift);
      await pg.reload();
      await pg.waitForTimeout(400);
      await pg.click('.tab[data-view="macros"]');
      await pg.waitForTimeout(350);
      return pg;
    };
    /* Opened the way a thumb opens it, NOT through openPlan — that helper
       unfolds everything on purpose, and what is folded is the thing under
       test here. */
    const openPlanShut = async (pg) => {
      if (!await pg.$('#macroTargBtn')) {
        const h = await pg.$('.mday-weigh [data-mfold]');
        if (h) { await h.click(); await pg.waitForTimeout(250); }
      }
      await pg.click('#macroTargBtn');
      await pg.waitForTimeout(350);
    };

    // flat on the scale against a plan that wants a pound a week: planShut
    const planShut = await planPage(0);
    const planMorn = await planShut.evaluate(() => {
      const el = document.querySelector('.mline.act .mline-t');
      return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    });
    t.ok('My Day says how many days off pace you are',
      /\d+ days (behind|ahead of) pace/.test(planMorn), planMorn);

    await openPlanShut(planShut);
    const planLedger = () => planShut.evaluate(() => {
      const el = document.getElementById('mtFacts');
      return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    });
    const led0 = await planLedger();
    t.ok('the plan sheet opens on four facts: where to, how fast, when, and where you stand',
      /Going from\s*205 lb → 185 lb/.test(led0) && /At\s*\d/.test(led0) &&
      /Arriving/.test(led0) && /Averaging now\s*205 lb/.test(led0), led0);

    /* One arithmetic, two screens. They used to be worked out separately,
       which is two chances to disagree about one fact — and on the calorie
       bar and the week strip they already had. */
    const planSays = await planShut.evaluate(() => {
      const el = document.getElementById('mtStatus');
      return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    });
    const dayCount = (str) => (str.match(/(\d+) days/) || [])[1];
    t.ok('and the pace line beneath them is the SAME count My Day gave, not a second one',
      !!dayCount(planSays) && dayCount(planSays) === dayCount(planMorn),
      'sheet: "' + planSays + '" vs day: "' + planMorn + '"');

    /* Both folds shut, so there is nothing on screen that Save could commit. */
    const pl_shutState = () => planShut.evaluate(() => ({
      who: document.getElementById('mtEditor').classList.contains('hide'),
      meals: document.getElementById('mtMealsWrap').classList.contains('hide'),
      save: document.getElementById('mtSave').classList.contains('hide'),
      rows: document.querySelectorAll('#mtMeals .mtm-row').length,
      handle: document.getElementById('mtMealSum').textContent.replace(/\s+/g, ' ').trim()
    }));
    const st0 = await pl_shutState();
    t.ok('the meal editor arrives folded, with its rows still in the document',
      st0.meals && st0.who && st0.rows >= 4, JSON.stringify(st0));
    t.ok('and its handle says how many meals and at what shares',
      /^\w+ meals · (\d+ \/ )+\d+%$/.test(st0.handle), st0.handle);
    t.ok('with nothing being edited, there is no Save to press', st0.save,
      JSON.stringify(st0));

    await planShut.click('[data-mtmfold]');
    await planShut.waitForTimeout(200);
    const st1 = await pl_shutState();
    t.ok('opening the meals unfolds them and brings Save back with them',
      !st1.meals && !st1.save && st1.who, JSON.stringify(st1));
    await planShut.click('[data-mtmfold]');
    await planShut.waitForTimeout(200);
    t.ok('and shutting them takes it away again', (await pl_shutState()).save);
    await planShut.click('[data-mtedit]');
    await planShut.waitForTimeout(200);
    const st2 = await pl_shutState();
    t.ok('the other fold brings it back just the same', !st2.who && !st2.save,
      JSON.stringify(st2));

    /* Editing the goal moves the planLedger with it — the whole point of putting
       the facts and the boxes on one screen is that they cannot disagree. */
    await planShut.fill('#mtGoalLb', '175');
    await planShut.waitForTimeout(300);
    t.ok('and a goal typed into the open fold moves the facts above it',
      /→ 175 lb/.test(await planLedger()), await planLedger());
    await planShut.context().close();

    /* On pace, it says nothing at all. A plan you are keeping to has no news,
       and the last line of a card speaks only when something needs doing. */
    const onPacePg = await planPage((20 / 89) * (19 / 16));
    await openPlanShut(onPacePg);
    t.ok('a plan being kept to says nothing where the pace line would be',
      await onPacePg.evaluate(() => {
        const el = document.getElementById('mtStatus');
        return !!el && !el.textContent.trim() && el.classList.contains('hide');
      }), await onPacePg.evaluate(() =>
        (document.getElementById('mtStatus') || {}).textContent));
    t.ok('though the four facts are still there to read',
      /Averaging now/.test(await onPacePg.evaluate(() =>
        document.getElementById('mtFacts').textContent)));
    await onPacePg.context().close();

    /* ---- a food logged with nothing but its calories ------------------- */
    /* Eating out is the one entry that arrives as a single number, and the
       summary sheet used to lose it whole. mDaySummary derived the day's
       energy as 4P + 4C + 9F, so a 700 kcal salad carrying no macros came to
       nothing: the sheet said "Nothing was written down on this day" directly
       underneath a day bar reading 700. A plate states its own energy and the
       bar has always carried it; this pins the sheet to the same reading of
       the same day. */
    const outPg = await t.fresh();
    await outPg.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.myFoods', JSON.stringify({
        cafe_rio_salad: { name: 'Cafe Rio salad', unit: 'salad', kcal: 700, p: 0, f: 0, c: 0 },
      }));
      localStorage.setItem('bsc.macroDays', JSON.stringify({
        [k]: { b: [{ id: 'f:my:cafe_rio_salad', x: 1, eaten: 1 }] },
      }));
    });
    await outPg.reload();
    await outPg.evaluate(() => document.fonts.ready);
    await outPg.click('.tab[data-view="macros"]');
    await outPg.waitForTimeout(250);
    const outDay = (await outPg.innerText('#view-macros')).replace(/\s+/g, ' ');
    t.ok('the day bar counts a food logged with only its calories',
      /700 \/ 1,370 kcal/.test(outDay), outDay.slice(0, 200));

    /* Through the menu, because this day has one meal on it and five empty:
       the primary still reads Fill there, and pressing it would draft a day
       rather than close one. "How today went" opens the same card for any
       day, closed or not, which is what this is about. */
    await outPg.click('#macroMore');
    await outPg.waitForTimeout(120);
    await outPg.click('[data-mmore="went"]');
    await outPg.waitForTimeout(400);
    const outSheet = (await outPg.innerText('#modalRoot')).replace(/\s+/g, ' ');
    t.ok('and the summary does not call that day blank',
      !/Nothing was written down/.test(outSheet), outSheet.slice(0, 200));
    t.ok('and the summary reads the same calories the bar does',
      /700/.test(outSheet) && /1,370/.test(outSheet), outSheet.slice(0, 200));
    await outPg.context().close();

    /* ---- a pin survives an emptied day, and does not shut the meal ------ */
    /* Two faults, found dogfooding. Pins were placed in one moment only --
       the first time a day was ever looked at -- and an emptied day keeps its
       key as an object with empty arrays, which is truthy, so that branch
       never ran again and the pin was gone for good. And a pin counted as the
       meal being spoken for, so seven calories of Crio Bru pinned to breakfast
       made Fill step over breakfast entirely. */
    const pinPg = await t.fresh();
    await pinPg.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.macroSlots', JSON.stringify({
        list: [{ k: 'b', n: 'Breakfast', t: 'b', pins: [{ id: 'f:crio_bru', x: 1 }] },
          { k: 'l', n: 'Lunch', t: 'l' }, { k: 'd', n: 'Dinner', t: 'd' },
          { k: 's', n: 'Snacks', t: 's' }],
        names: { b: 'Breakfast', l: 'Lunch', d: 'Dinner', s: 'Snacks' } }));
      // the day EXISTS and is empty -- what deleting every plate leaves behind
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: { b: [], l: [], d: [], s: [] } }));
    });
    await pinPg.reload();
    await pinPg.evaluate(() => document.fonts.ready);
    await pinPg.click('.tab[data-view="macros"]');
    await pinPg.waitForTimeout(300);
    t.ok('an emptied day is not re-seeded with its pins just by arriving',
      !/Crio Bru/.test(await pinPg.innerText('#view-macros')));

    await pinPg.click('#macroFill');
    await pinPg.waitForTimeout(900);
    const pinDay = (await pinPg.innerText('#view-macros')).replace(/\s+/g, ' ');
    t.ok('but Fill puts the pin back, because a pin is a standing instruction',
      /Crio Bru/.test(pinDay), pinDay.slice(0, 200));

    /* The pin must not be the whole of breakfast. Read off the bench rather
       than the card's own number, which is formatted with a comma. */
    const bKcal = await pinPg.evaluate(() => {
      const day = window.__macroLab.read ? null : null;
      const rows = [...document.querySelectorAll('.mday-stop')];
      const b = rows.find((r) => /BREAKFAST/i.test(r.innerText));
      const m = b && b.innerText.replace(/,/g, '').match(/(\d{2,5})\s*\u{1F525}/u);
      return m ? Number(m[1]) : null;
    });
    t.ok('and fills the meal around it rather than counting it as done',
      bKcal !== null && bKcal > 100, 'breakfast came to ' + bKcal + ' kcal');
    /* And a pin that has been EATEN closes the meal like anything else.
       The carve-out above was written for pins — "a pin says I have this
       every day, not this meal is finished" — and forgot a pin can be ticked
       like any other plate. A meal holding one eaten pin read as empty to the
       drafter, and Fill put a second dish on a breakfast that was over. */
    await pinPg.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.macroDays', JSON.stringify({
        [k]: { b: [{ id: 'f:crio_bru', x: 1, eaten: 1 }], l: [], d: [], s: [] } }));
    });
    await pinPg.reload();
    await pinPg.evaluate(() => document.fonts.ready);
    await pinPg.click('.tab[data-view="macros"]');
    await pinPg.waitForTimeout(300);
    await pinPg.click('#macroFill');
    await pinPg.waitForTimeout(900);
    t.ok('and Fill adds nothing to a meal whose pin has been eaten',
      await pinPg.evaluate(() => {
        const p2 = (n) => (n < 10 ? '0' : '') + n;
        const d = new Date();
        const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
        const day = JSON.parse(localStorage.getItem('bsc.macroDays') || '{}')[k] || {};
        return (day.b || []).length === 1 && day.b[0].id === 'f:crio_bru';
      }),
      await pinPg.evaluate(() => {
        const p2 = (n) => (n < 10 ? '0' : '') + n;
        const d = new Date();
        const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
        const day = JSON.parse(localStorage.getItem('bsc.macroDays') || '{}')[k] || {};
        return JSON.stringify(day.b || []);
      }));
    await pinPg.context().close();

    /* ---- "What do you actually eat" ------------------------------------ */
    /* The favourite star laid out as a grid, so the ranker has something to
       go on before there is any history. It asserts the WIRING — a tap leaves
       a favourite behind, and picking food the storehouse does not carry says
       so and turns shopping on — not which foods are on which shelf, which is
       the food table's business and changes. */
    const fpPg = await t.fresh();
    await fpPg.click('.tab[data-view="macros"]');
    await fpPg.waitForTimeout(200);
    await fpPg.click('#macroMore');
    await fpPg.waitForTimeout(120);
    await fpPg.click('[data-mmore="foods"]');
    await fpPg.waitForTimeout(400);

    const fpShape = await fpPg.evaluate(() => ({
      shelves: document.querySelectorAll('.fp-shelf').length,
      chips: document.querySelectorAll('.fp-chip').length,
      more: document.querySelectorAll('[data-fpmore]').length,
    }));
    t.ok('the food screen groups the table onto its shelves',
      fpShape.shelves > 2 && fpShape.chips > 20, JSON.stringify(fpShape));
    /* Truncated, or the table's hundred-plus foods are one endless column. */
    t.ok('and a long shelf offers the rest rather than printing it',
      fpShape.more > 0, JSON.stringify(fpShape));

    const grew = await (async () => {
      await fpPg.click('[data-fpmore]');
      await fpPg.waitForTimeout(300);
      return fpPg.evaluate(() => document.querySelectorAll('.fp-chip').length);
    })();
    t.ok('and asking for them gives them', grew > fpShape.chips,
      fpShape.chips + ' -> ' + grew);

    /* A tap is the star, which is the whole point: it costs no new ranking. */
    const fpTap = await fpPg.evaluate(() => {
      const b = [...document.querySelectorAll('.fp-chip:not(.on)')][0];
      const id = b.dataset.fppick;
      b.click();
      return id;
    });
    await fpPg.waitForTimeout(300);
    t.ok('tapping a food keeps it as a favourite',
      await fpPg.evaluate((id) => {
        const on = document.querySelector('[data-fppick="' + id + '"]');
        return !!on && on.classList.contains('on') &&
          on.getAttribute('aria-pressed') === 'true';
      }, fpTap), fpTap);

    /* Choosing food the storehouse does not carry turns Fill-may-shop on --
       a favourite the drafter can never use is a tap that did nothing -- and
       the sheet says so rather than letting you find out by noticing. */
    const fpExt = await fpPg.evaluate(() => {
      const b = [...document.querySelectorAll('.fp-chip.ext:not(.on)')][0];
      if (!b) return null;
      b.click();
      return true;
    });
    await fpPg.waitForTimeout(300);
    t.ok('picking food the storehouse lacks turns shopping on, and says so',
      !fpExt || await fpPg.evaluate(() =>
        !!document.querySelector('.fp-note') &&
        JSON.parse(localStorage.getItem('bsc.macroProfile') || '{}').extFill === true),
      await fpPg.evaluate(() => (document.querySelector('.fp-note') || {}).textContent || '(no note)'));
    /* And it has a door. close() clears every sheet flag there is, and this
       one was added without being added to it — so x and the backdrop both
       called close(), close() left S.favPick standing, and renderModal drew
       the grid straight back. Blake, stuck inside it: "when I click done or
       try to exit out of this screen it doesn't let me go anywhere." The note
       above that block in close() describes this exact failure, from the last
       time somebody made it. */
    await fpPg.evaluate(() => document.querySelector('.sheet-x').click());
    await fpPg.waitForTimeout(400);
    t.ok('the food screen closes on the x',
      await fpPg.evaluate(() => !document.querySelector('.fp-shelf')));

    await fpPg.click('#macroMore');
    await fpPg.waitForTimeout(120);
    await fpPg.click('[data-mmore="foods"]');
    await fpPg.waitForTimeout(400);
    await fpPg.evaluate(() => {
      const b = document.querySelector('.fp-chip:not(.on)');
      if (b) b.click();
    });
    await fpPg.waitForTimeout(300);
    await fpPg.evaluate(() => document.querySelector('.sync-row .btn-primary').click());
    await fpPg.waitForTimeout(400);
    t.ok('and on its own Done, with food chosen',
      await fpPg.evaluate(() => !document.querySelector('.fp-shelf')));
    t.ok('and the day is reachable again behind it',
      await fpPg.evaluate(() => !!document.getElementById('macroFill')));
    /* The wizard's own finish, which takes a different road out — its own
       handler rather than the sheet-done class — and has to arrive anyway. */
    await fpPg.evaluate(() => {
      ['bsc.macroProfile', 'bsc.macroTargets'].forEach((k) => localStorage.removeItem(k));
    });
    await fpPg.reload();
    await fpPg.waitForTimeout(400);
    await fpPg.click('.tab[data-view="macros"]');
    await fpPg.waitForTimeout(250);
    await fpPg.click('#macroFill');
    await fpPg.waitForTimeout(400);
    for (let i = 0; i < 4; i++) {
      await fpPg.click('[data-mtw="next"]');
      await fpPg.waitForTimeout(220);
    }
    await fpPg.click('[data-mtw="done"]');
    await fpPg.waitForTimeout(400);
    t.ok('and the first run lets go when its last step is finished',
      await fpPg.evaluate(() => !document.querySelector('[data-mtwstep]')));
    await fpPg.context().close();

    /* ---- the cascade card's rows are about THIS meal's miss ------------ */
    /* They showed each meal's plan share against its current ask, which
       folds in every meal finished so far — so under "Lunch went 216 under"
       the rows summed to 850, and the sign on each was chosen by whether
       lunch went over rather than by which way the row moved: "573 -> 524
       +49". Blake, with before/after screenshots: "the macro is shifting
       after I click Complete". Two assertions, one per fault: the deltas add
       up to the miss, and every sign points the way its arrow does. */
    const ccPg = await t.fresh();
    await ccPg.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 205, f: 62, c: 133 }));
      localStorage.setItem('bsc.macroSlots', JSON.stringify({ list: [
        { k: 'w', n: 'Wake Up', t: 'b', w: 15 }, { k: 'b', n: 'Breakfast', t: 'b', w: 25 },
        { k: 'l', n: 'Lunch', t: 'l', w: 20 }, { k: 'd', n: 'Dinner', t: 'd', w: 30 },
        { k: 'e', n: 'Evening Snack', t: 's', w: 10 }],
        names: { w: 'Wake Up', b: 'Breakfast', l: 'Lunch', d: 'Dinner', e: 'Evening Snack' } }));
      // two meals already over their share, lunch finished light
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        w: [{ id: 27, x: 1, eaten: 1 }], b: [{ id: 28, x: 1, eaten: 1 }, { id: 'f:egg', x: 2, eaten: 1 }],
        l: [{ id: 'f:egg_white', x: 1.25, eaten: 1 }], d: [], e: [] } }));
    });
    await ccPg.reload();
    await ccPg.evaluate(() => document.fonts.ready);
    await ccPg.click('.tab[data-view="macros"]');
    await ccPg.waitForTimeout(400);
    const cc = await ccPg.evaluate(() => {
      const el = document.querySelector('.mcasc');
      if (!el) return null;
      const head = (el.querySelector('.mcasc-t') || {}).textContent || '';
      const miss = Number((head.match(/(\d+) (under|over)/) || [])[1]);
      const rows = [...el.querySelectorAll('.mcasc-row[aria-checked="true"]')].map((r) => {
        const w = (r.querySelector('.mcasc-was') || {}).textContent || '';
        const was = Number(w.split('\u2192')[0].trim()), now = Number(w.split('\u2192')[1].trim());
        const dTxt = (r.querySelector('.mcasc-d') || {}).textContent || '';
        return { was, now, sign: dTxt.charAt(0), d: Number(dTxt.replace(/[^\d]/g, '')) };
      });
      return { head, miss, rows };
    });
    t.ok('the cascade card appears under a lunch that finished light',
      !!cc && /under/.test(cc.head) && cc.rows.length > 0, JSON.stringify(cc));
    /* Within a few calories of rounding, and only when nothing is capped —
       a capped meal cannot take its full part, and the landing line says so. */
    t.ok('and its rows add up to the miss the heading names',
      !!cc && Math.abs(cc.rows.reduce((a, r) => a + r.d, 0) - cc.miss) <= cc.rows.length + 1,
      !!cc && cc.rows.map((r) => r.d).join(' + ') + ' vs ' + cc.miss);
    t.ok('and every sign points the way its own arrow does',
      !!cc && cc.rows.every((r) => (r.now > r.was && r.sign === '+') ||
        (r.now < r.was && r.sign === '\u2212') || r.now === r.was),
      !!cc && JSON.stringify(cc.rows));
    await ccPg.context().close();

    { /* own scope: run(t) is one function and its names are spoken for */
    /* ---- two things a fourteen-day audit found on Blake's own plan ------ */
    /* Snacks drew from Worth the Afternoon and the Copycat Shelf, so its
       Fits best opened on a braise and Fill put taco beef in an evening
       snack; and the picker's portion cap counts in the food's own unit,
       which for the vegetables is the pound, so Wake Up was offered a bag of
       broccoli as a protein source. Pinned against the rendered picker. */
    const auPg = await t.fresh();
    await auPg.evaluate(() => {
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 205, f: 62, c: 133 }));
      localStorage.setItem('bsc.macroSlots', JSON.stringify({ list: [
        { k: 'w', n: 'Wake Up', t: 'b', w: 12 }, { k: 'b', n: 'Breakfast', t: 'b', w: 23 },
        { k: 's', n: 'Snacks', t: 's', w: 8 }, { k: 'l', n: 'Lunch', t: 'l', w: 22 },
        { k: 'd', n: 'Dinner', t: 'd', w: 27 }, { k: 'e', n: 'Evening Snack', t: 's', w: 8 }],
        names: { w: 'Wake Up', b: 'Breakfast', s: 'Snacks', l: 'Lunch', d: 'Dinner', e: 'Evening Snack' } }));
    });
    await auPg.reload();
    await auPg.evaluate(() => document.fonts.ready);
    await auPg.click('.tab[data-view="macros"]');
    await auPg.waitForTimeout(300);
    const fitsOf = async (slotKey) => {
      await auPg.click('[data-mslot="' + slotKey + '"]');
      await auPg.waitForTimeout(500);
      const rows = await auPg.evaluate(() => {
        const ds = [...document.querySelectorAll('#mpList .mt-div')];
        const h = ds.find((d) => /fits best|on the shelf/i.test(d.innerText));
        const out = []; let n = h && h.nextElementSibling;
        while (n && !n.classList.contains('mt-div')) {
          const b = n.querySelector && n.querySelector('.mpick-row');
          if (b) {
            const id = b.dataset.mpick, x = Number(b.dataset.mpx);
            const r = window.RECIPES.find((rr) => String(rr.id) === id);
            out.push({ id, x, sec: r ? r.book + '-' + r.secNum : null, food: !r,
              grams: r ? null : (b.querySelector('.mp-fit') || {}).textContent });
          }
          n = n.nextElementSibling;
        }
        return out;
      });
      await auPg.evaluate(() => document.querySelector('.sheet-x').click());
      await auPg.waitForTimeout(250);
      return rows;
    };
    const auSnack = await fitsOf('s');
    t.ok('a snack slot is never offered a dish from Worth the Afternoon or the Copycat Shelf',
      auSnack.length > 0 && auSnack.every((r) => r.sec !== '2-6' && r.sec !== '2-7'),
      JSON.stringify(auSnack.map((r) => r.sec)));
    /* Read the gram figure off the row's own fit line: a food's portion is
       stated there as "×1 lb" or "×2 each", and the plate it makes is what
       the fit line prices. Four hundred grams is the ceiling in the code. */
    const auWake = await fitsOf('w');
    const heavy = await auPg.evaluate((rows) => rows.filter((r) => r.food).map((r) => r.grams), auWake);
    t.ok('and no single food is offered as a dish beyond a plateful',
      !/\d\s*lb\b/.test(heavy.join(' | ')) || heavy.every((g) => {
        const m = /×\s*([\d\s¼½¾⅓⅔]+)\s*lb/.exec(g || '');
        if (!m) return true;
        const n = m[1].replace(/\s/g, '').replace('½', '.5').replace('¼', '.25').replace('¾', '.75');
        return Number(n) * 453.6 <= 400;
      }), JSON.stringify(heavy));
    await auPg.context().close();
    }

    /* ---- the solver prices where food lands, not only how much ---------- */
    /* Fill is random, so this pins mBalanceDay directly on a built day: a
       dinner holding three servings of one dish beside an empty lunch. With
       nothing pricing the meal shares, the balancer had no reason to move
       calories from dinner to lunch — the day's totals are the same either
       way — and on Blake's plan the last meal came in at 0.59 of its share as
       a result. With the share term it does. Deterministic: no draw. */
    { const shPg = await t.fresh();
    const shWas = await shPg.evaluate(() => {
      const p2 = (n) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 205, f: 62, c: 133 }));
      const dish = window.RECIPES.find((r) => r.book === 2 && r.secNum === 3 && r.macro && r.macro.kcal > 350);
      const lunch = window.RECIPES.find((r) => r.book === 2 && r.secNum === 2 && r.macro && r.macro.kcal > 300);
      localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
        b: [], l: [{ id: lunch.id, x: 0.5, eaten: 0, by: 'f' }],
        d: [{ id: dish.id, x: 3, eaten: 0, by: 'f' }], s: [] } }));
      return { dish: dish.id, lunch: lunch.id, k };
    });
    await shPg.reload();
    await shPg.evaluate(() => document.fonts.ready);
    await shPg.click('.tab[data-view="macros"]');
    await shPg.waitForTimeout(300);
    const shAfter = await shPg.evaluate((w) => {
      window.__macroLab.balance();
      const day = JSON.parse(localStorage.getItem('bsc.macroDays'))[w.k];
      return { dinnerX: day.d[0].x, lunchX: day.l[0].x };
    }, shWas);
    /* The first of these holds with the share term zeroed — a day over its
       target shrinks its biggest plate whatever prices the meals — so it is
       the setting, not the evidence. The second is the evidence: with the
       term at nought the lunch stays at half a serving, mutation-proved. */
    t.ok('balancing a day over target brings the three-serving dinner down',
      shAfter.dinnerX < 3, 'dinner ×' + shAfter.dinnerX);
    t.ok('and the share term moves food onto the lunch beside it, not only off the dinner',
      shAfter.lunchX > 0.5, 'lunch ×' + shAfter.lunchX);
    await shPg.context().close(); }

    /* Dialled by the gram.
     *
       Blake weighs, and asked for it outright: "adjust grams with the +/-
       and show the serving size where the grams are being shown now." A food
       measured by the cup or the spoon shows its weight on the dial and its
       kitchen unit on the chip; a tap moves five grams; typing types grams.
       A food that comes in ones — an egg — still counts in ones. */
    {
      const gp = await t.fresh();
      await gp.click('.tab[data-view="macros"]');
      await gp.waitForTimeout(300);
      const cup = await gp.evaluate(() => {
        const r = window.__macroLab.foods().find((f) => /chicken breast/i.test(f.name));
        const egg = window.__macroLab.foods().find((f) => f.unit === 'each' && /^eggs?$/i.test(f.name));
        return { id: r && r.id, grams: r && r.grams, unit: r && r.unit, egg: egg && egg.id };
      });
      t.ok('chicken breast is a cup in the table', cup.unit === 'cup' && cup.grams > 0, JSON.stringify(cup));
      await gp.evaluate(([id, egg]) => {
        const p2 = (n) => (n < 10 ? '0' : '') + n;
        const d = new Date();
        const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
        localStorage.setItem('bsc.macroDays', JSON.stringify({ [k]: {
          b: [{ id: egg, x: 2, eaten: 0 }], l: [{ id: id, x: 1, eaten: 0 }], d: [], s: [] } }));
      }, [cup.id, cup.egg]);
      await gp.reload();
      await gp.click('.tab[data-view="macros"]');
      await gp.waitForTimeout(400);
      /* One fold at a time: a click redraws the card, and the rest of a list
         taken before the click are elements that are no longer on the page. */
      for (let i = 0; i < 8; i++) {
        const more = await gp.evaluate(() => {
          const b = document.querySelector('#macroSlots [data-mfold][aria-expanded="false"]');
          if (b) b.click();
          return !!b;
        });
        await gp.waitForTimeout(200);
        if (!more) break;
      }
      /* Opening one meal folds the others, so a row is read with its meal
         opened first. */
      const row = async (slot) => {
        await gp.evaluate((s) => {
          const b = document.querySelector('#macroSlots [data-mfold="' + s + '"][aria-expanded="false"]');
          if (b) b.click();
        }, slot);
        await gp.waitForTimeout(200);
        return gp.evaluate((s) => {
          const it = document.querySelector('[data-meat^="' + s + ':0"]').closest('.mitem');
          return { dial: it.querySelector('.mstep-x').textContent.trim(),
            chip: (it.querySelector('.mitem-uom') || {}).textContent || '' };
        }, slot);
      };
      const c0 = await row('l');
      t.ok('a cup of chicken shows its weight on the dial', /^\d+ g$/.test(c0.dial), JSON.stringify(c0));
      t.ok('and the cup on the chip', /1 cup/.test(c0.chip), JSON.stringify(c0));
      await gp.click('[data-mstep="l:0:up"]');
      await gp.waitForTimeout(150);
      const c1 = await row('l');
      t.ok('a tap moves it five grams', parseInt(c1.dial, 10) === parseInt(c0.dial, 10) + 5, c0.dial + ' → ' + c1.dial);
      /* 145 g is 1.04 cups: the chip rounds to the eighth and says "1 cup" —
         the live site said "1 cups", plural by the unrounded number. */
      t.ok('and the chip still says one cup, not one cups', /^1 cup$/.test(c1.chip), JSON.stringify(c1));
      /* And keeps moving. 145 of a 140 g cup is 1.0357 of it, which times
         140 is 144.998 — one grid point short of the dial — and the second
         tap landed on 145 again. Blake: "it stops at a number and won't go
         past." Ten taps, fifty grams, on the one food he eats most. */
      for (let i = 0; i < 9; i++) await gp.click('[data-mstep="l:0:up"]');
      await gp.waitForTimeout(200);
      const c10 = await row('l');
      t.ok('and ten taps are fifty grams, not one tap and a wall',
        parseInt(c10.dial, 10) === parseInt(c0.dial, 10) + 50, c0.dial + ' → ' + c10.dial + ' after ten taps');
      await gp.click('[data-mtype="l:0"]');
      await gp.waitForTimeout(100);
      await gp.fill('.mstep-in', '185');
      await gp.press('.mstep-in', 'Enter');
      await gp.waitForTimeout(200);
      const c2 = await row('l');
      const stored = await gp.evaluate(() => {
        const days = JSON.parse(localStorage.getItem('bsc.macroDays'));
        return days[Object.keys(days)[0]].l[0].x;
      });
      t.ok('typing 185 is a hundred and eighty-five grams', c2.dial === '185 g', JSON.stringify(c2));
      t.ok('stored as a share of the cup, not as servings', Math.abs(stored * cup.grams - 185) < 0.6, stored + ' × ' + cup.grams);
      const e0 = await row('b');
      t.ok('but an egg still counts in ones', /^2 whole$/.test(e0.dial) && /\d+ g/.test(e0.chip), JSON.stringify(e0));
      await gp.context().close();
    }
  },
};
