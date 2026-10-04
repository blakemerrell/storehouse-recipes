/* Combos: why a combo works when a recipe does not. A food that takes most
 * of its energy from one macro is a lever (egg whites for protein, ranch for
 * fat, salsa for carbohydrate), and three levers can hit any share of a
 * meal exactly where scaling one dish cannot. mLevers finds them, and
 * mComboFor builds the meal from them. The longer account is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.combos(app) once, as it starts, handing over what it reads of
 * the app's, MFOODS through LIVE since the foods are rebuilt as recipes
 * change (tests/scope.test.js holds the lists to each other), and keeps
 * mLevers and mComboFor under their own names. Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).combos = function (app) {
  'use strict';

  // what it reads of the app's, and (LIVE) what the app replaces as it goes: MFOODS
  var MDAYS = app.MDAYS;
  var mExtOk = app.mExtOk;
  var mFoodMealOK = app.mFoodMealOK;
  var LIVE = app.LIVE;

  /* ---------------------------------------------------------------- combos
   *
     Why a combo works when a recipe does not.
   *
     Scaling a barbacoa moves protein, fat and carbohydrate together — one
     knob wired to three dials — so the solver can land the meal's calories
     and still miss every macro under them. A food that takes most of its
     energy from ONE macro is a lever: move it and the other two barely
     stir. Three levers are three independent knobs, and three knobs can hit
     any share exactly. That is the whole idea, and it is the reason
     mBalanceDay struggles on a day of ordinary dishes.

     Egg whites are 90% protein by calories, ranch 93% fat, salsa 75% carb
     at twenty-nine calories a hundred grams. Cheddar and beef roast are
     NOT protein levers whatever they feel like — 74% and 71% of their
     energy is fat, which is worth knowing before you build a steak dinner
     to hit a protein number.

     `lever` is a flag of its own and not a reuse of `eat`, because the best
     fat levers are the condiments — oil, butter, dressing — and those were
     deliberately kept out of `eat` on the grounds that they go ON food
     rather than being food. In a combo that is exactly their job. */
  var MLEV_PURE = 0.6;          // a lever earns the name at 60% of its calories
  var MLEV_MIN = 0.25;          // below a quarter portion it is a garnish, not a lever
  var MLEV_MAX = 4;

  function mLeverDom(r) {
    var m = r && r.macro;
    if (!m) return null;
    var kp = (m.p || 0) * 4, kf = (m.f || 0) * 9, kc = (m.c || 0) * 4;
    var tot = kp + kf + kc;
    if (!(tot > 0)) return null;
    var d = kp >= kf && kp >= kc ? 'p' : (kf >= kc ? 'f' : 'c');
    var pur = (d === 'p' ? kp : d === 'f' ? kf : kc) / tot;
    return pur >= MLEV_PURE ? { d: d, pur: pur } : null;
  }

  /* The bench, built once. Sorted by purity so the first choice on each rung
     is the cleanest lever available and ‹ › walks down toward the ones that
     bring more baggage with them. */
  var MLEVERS = null;
  /* What the cached bench was built FROM, so it cannot outlive its inputs.
   *
     Two things move it. MFOODS is rebuilt whenever a food of your own is
     saved, and the external-food setting decides whether half the fat rungs
     exist at all — a cache built while the setting was off would go on
     offering three-quarters of a tablespoon of Oil after it was turned on,
     with nothing to say why. Keyed rather than cleared, because clearing
     relies on remembering every place either input changes and this file
     already carries one comment about a cache that went stale exactly that
     way. */
  var MLEVERS_ON = null;
  function mLevers() {
    var levKey = LIVE.MFOODS.length + ':' + (mExtOk() ? 1 : 0);
    if (MLEVERS_ON !== levKey) { MLEVERS = null; MLEVERS_ON = levKey; }
    if (!MLEVERS) {
      MLEVERS = { p: [], f: [], c: [] };
      LIVE.MFOODS.forEach(function (r) {
        /* The rungs the closers band is built from. Gated with the rest, so
           the opt-in turns the whole vocabulary on at once rather than the
           picker recommending an almond the draft may not use. */
        if (r.ext && !mExtOk()) return;
        if (!(r.eat || r.side || r.lever)) return;
        if (!r.macro || (r.macro.kcal || 0) < 8) return;
        var dm = mLeverDom(r);
        if (!dm) return;
        MLEVERS[dm.d].push({ r: r, pur: dm.pur });
      });
      /* Sorted by purity ALONE this built canned tuna, applesauce and a
         spoon of oil — three perfect levers and nothing anybody would eat.
         The purest fat source on the shelf is oil, at a hundred per cent, and
         that is exactly the problem: purity measures how cleanly a food moves
         one macro, not whether it is food.

         So something you would eat as part of a meal outranks a condiment
         even when the condiment is cleaner. Cheddar at 74% fat comes before
         oil at 100%; the oil is still there, one tap down the rung, for the
         day you want the fat and not the cheese. `lever`-only is precisely
         the set of things that go ON food rather than being it, which is why
         that flag is the one to sort behind. */
      ['p', 'f', 'c'].forEach(function (d) {
        MLEVERS[d].sort(function (a, b) {
          var af = (a.r.eat || a.r.side) ? 1 : 0, bf = (b.r.eat || b.r.side) ? 1 : 0;
          return (bf - af) || (b.pur - a.pur);
        });
      });
    }
    return MLEVERS;
  }

  /* A portion that hits `want` grams of macro `m`, snapped to the quarter
     steps the stepper already moves in, and refused outright below a quarter
     — a tenth of a serving of dressing is a rounding error wearing a name. */
  function mLeverX(r, m, want) {
    var per = (r.macro && r.macro[m]) || 0;
    if (!(per > 0) || !(want > 0)) return 0;
    var x = Math.round((want / per) * 4) / 4;
    if (x < MLEV_MIN) return 0;
    return Math.min(MLEV_MAX, x);
  }

  /* Build one. `pick` carries an index per rung so ‹ › can walk a rung
     without disturbing the other two — the sizes resize around whatever you
     land on, which is the point of choosing.
   *
     Protein first because it is the macro worth being exact about and the
     bench is thinnest there; then carbohydrate, then fat, because the fat
     lever is the purest of the three and so the best thing to close with.
     Two passes: sizing the carb lever moves the fat total a little, and one
     more sweep takes the residual out. */
  /* How often each food has landed in THIS meal before.
   *
     Purity is the right answer to "what moves one macro cleanly" and the
     wrong answer to "what do you eat in the morning". Canned tuna is the
     purest protein on the shelf you can eat as it comes, and offering it at
     seven a.m. is how a panel gets ignored.

     The fix is not a `breakfast: 1` flag on the food table. The slots are
     yours to name and reorder — a food tagged for breakfast would be the app
     deciding what breakfast is on the one screen where you already decided.
     What orders the rungs instead is what you have actually put in this meal
     before. It opens on purity and becomes yours. */
  function mSlotSeen(slot) {
    var seen = {};
    if (!slot) return seen;
    Object.keys(MDAYS).forEach(function (k) {
      ((MDAYS[k] || {})[slot] || []).forEach(function (it) {
        seen[it.id] = (seen[it.id] || 0) + 1;
      });
    });
    return seen;
  }

  function mComboFor(share, pick, slot) {
    var bench = mLevers();
    if (slot) {
      var seen = mSlotSeen(slot);
      var by = {};
      ['p', 'f', 'c'].forEach(function (m) {
        /* A copy — mLevers() hands back the one cached bench, and sorting it
           in place would reorder every other reader by whichever meal asked
           last. */
        by[m] = bench[m].filter(function (e) {
          return mFoodMealOK(e.r, slot);
        }).sort(function (a, b) {
          /* History first, then the ladder's own order — BOTH of its terms.
             Sorting on history-then-purity alone quietly dropped the rule
             that a food outranks a condiment, and breakfast came back
             offering three quarters of a tablespoon of oil: oil is 100% fat
             and cheddar is 74%, which is exactly why purity cannot be the
             last word on its own. */
          var af = (a.r.eat || a.r.side) ? 1 : 0, bf = (b.r.eat || b.r.side) ? 1 : 0;
          return ((seen[b.r.id] || 0) - (seen[a.r.id] || 0)) || (bf - af) || (b.pur - a.pur);
        });
      });
      bench = by;
    }
    var chosen = [];
    ['p', 'c', 'f'].forEach(function (m) {
      var rung = bench[m];
      if (!rung.length) return;
      var i = ((pick && pick[m]) || 0) % rung.length;
      chosen.push({ m: m, r: rung[i].r, x: 0 });
    });
    if (!chosen.length) return null;
    var pass, held;
    for (pass = 0; pass < 2; pass++) {
      chosen.forEach(function (c) {
        held = { p: 0, f: 0, c: 0 };
        chosen.forEach(function (o) {
          if (o === c || !o.x) return;
          held.p += (o.r.macro.p || 0) * o.x;
          held.f += (o.r.macro.f || 0) * o.x;
          held.c += (o.r.macro.c || 0) * o.x;
        });
        c.x = mLeverX(c.r, c.m, (share[c.m] || 0) - held[c.m]);
      });
    }
    return chosen.filter(function (c) { return c.x > 0; });
  }

  /* Everything a meal is allowed to be offered — recipes from its sections,
     plus the plain foods a person eats without cooking them.
   *
     One function because there are two callers and they must not drift: Try
     again, and the bench's rank() that exists to explain what Try again did.
     A diagnostic reporting a pool the app does not have is worse than no
     diagnostic, and the first version of this WAS two copies — a test meant
     to pin the ingredient rule passed with the real gate removed, because it
     was only ever reading the bench's copy of it.

     The food table is mostly ingredients: flour, cornstarch, yeast, raw
     stewing beef. Unfiltered it offered three ounces of raw chuck as a snack,
     which is a worse answer than the recipe it replaced. `eat` says you can
     eat it as it comes; `side` is already on the vegetables. Condiments are
     in neither on purpose — butter and honey go ON food. */
  /* Whether Fill may draft food the storehouse does not stock.
   *
     Off unless it is turned on, and off is the honest default: a day built
     out of salmon and almonds is not a day if there is no salmon in the
     house. Turned on, it is the right answer for a Blake who is happy to
     stop at a shop on the way home — which is exactly how he asked for it.
   *
     This gates DRAFTING only. Searching and logging an external food is
     always allowed, because looking one up is how you decide to go and buy
     it. */

  return { mLevers: mLevers, mComboFor: mComboFor };
};
