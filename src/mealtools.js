/* One meal at a time: its portions solved against its own share, never
 * moving what is eaten or locked (mBalanceMeal), and the meal kept as a
 * food of your own (mSaveMeal). The longer account is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.mealtools(app) once, as it starts, and keeps what it gives back
 * under the same names. The recipe index, which the app replaces as it
 * goes, is read through LIVE (tests/scope.test.js holds the lists to each
 * other). Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).mealtools = function (app) {
  'use strict';

  // what it reads of the app's, and (LIVE) what the app replaces as it goes: BY_ID
  var MW = app.MW;
  var fmtNum = app.fmtNum;
  var kcalOf = app.kcalOf;
  var keepingFocus = app.keepingFocus;
  var mBuildFoods = app.mBuildFoods;
  var mDay = app.mDay;
  var mDayTargets = app.mDayTargets;
  var mEditDay = app.mEditDay;
  var mLadder = app.mLadder;
  var mMealAsk = app.mMealAsk;
  var mNewFoodKey = app.mNewFoodKey;
  var mReadMyFoods = app.mReadMyFoods;
  var mReadSlots = app.mReadSlots;
  var mViewKey = app.mViewKey;
  var mWriteMyFoods = app.mWriteMyFoods;
  var renderMacros = app.renderMacros;
  var LIVE = app.LIVE;

  /* Solve the portions of one meal against that meal's own share.
   *
     Rebalance does this for the whole day, where the question is "which of
     twelve plates gives way". Here the question is the one you actually have
     after putting chicken, rice and broccoli on a plate: how much of each.
     Same weights the picker fits with, same eighth-of-a-portion steps, and
     the same two exemptions — what you have eaten and what you have locked
     are not the machine's to move. */
  function mBalanceMeal(sk) {
    var k = mViewKey();
    var targets = mDayTargets(k);
    var slots = mReadSlots();
    mEditDay(k, function (day) {
      var free = (day[sk] || []).filter(function (it) {
        var r = LIVE.BY_ID[it.id];
        return !it.eaten && !it.l && r && r.macro && r.macro.kcal > 0;
      });
      if (!free.length) return;
      /* The meal's FULL share of the day, not what is left of the day after
         it. mShares answers the picker's question — "how much room is there
         for one more thing" — and subtracts what this meal already holds. Ask
         it here and a meal sitting exactly on target is told its target is
         nearly zero, and gets solved down to a quarter of itself. Which is
         what happened: 545 kcal, on target, balanced to 252 and called short.
         The target of a meal is its weight's worth of the day.
     *
         And that weight's worth is mMealShare's to say, not this function's.
         It was worked out here a second time — over EVERY slot, where
         mMealShare drops the ones you have skipped and left empty — so on a
         day with skips the button solved a meal to roughly half of what the
         pills directly above it were printing as its share. Same button, same
         card, two answers. A skipped meal is not still coming; the pills, the
         verdict, the basket foot and the day's assumption all already know
         that, and now so does the one control that acts on it.
     *
         Null means the meal is not in the slot list at all, which the card
         this button sits on cannot be — there is nothing to solve against, so
         nothing is solved rather than a share being invented. */
      /* Toward what the meal is asked for NOW, not what it was planned for.
       *
         This is the button Blake had in mind when he asked to see the slack
         move: solving dinner to a 677-kcal plan after a breakfast that ran a
         thousand over would push the day further past itself while claiming
         to balance it. Aimed at the live share, the plates walk toward the
         number on the card — which is also the first time this button has
         shown what it was aiming at. */
      var ask = mMealAsk(sk, targets, slots);
      if (!ask) return;
      var sh = ask.now;
      var T = { p: sh.p, f: sh.f, c: sh.c };
      var pen = function () {
        var got = { p: 0, f: 0, c: 0 };
        (day[sk] || []).forEach(function (it) {
          var r = LIVE.BY_ID[it.id];
          if (!r || !r.macro) return;
          got.p += (r.macro.p || 0) * it.x;
          got.f += (r.macro.f || 0) * it.x;
          got.c += (r.macro.c || 0) * it.x;
        });
        var sum = 0;
        ['p', 'f', 'c'].forEach(function (m) {
          var D = Math.max(1, T[m]);
          sum += MW[m][0] * Math.max(0, T[m] - got[m]) / D;
          sum += MW[m][1] * Math.max(0, got[m] - T[m]) / D;
        });
        return sum;
      };
      for (var pass = 0; pass < 4; pass++) {
        var moved = false;
        free.forEach(function (it) {
          var was = it.x, best = it.x, bestPen = pen();
          /* The same per-plate ladder mBalanceDay uses — see mLadder. */
          var rungs = mLadder(LIVE.BY_ID[it.id], it.x);
          for (var i = 0; i < rungs.length; i++) {
            it.x = rungs[i];
            var pv = pen();
            if (pv < bestPen - 1e-9) { bestPen = pv; best = rungs[i]; }
          }
          it.x = best;
          if (best !== was) moved = true;
        });
        if (!moved) break;
      }
    });
    keepingFocus(renderMacros);
  }

  /* Everything on one meal, kept as one thing.
   *
     Assembled meals are the case recipes were always for — four scanned
     packets that go together every Tuesday are a dish, they just have not
     been named yet. The macros come from the parts as they stand rather than
     from re-reading the ingredient text, because the parts already carry
     measured numbers and re-deriving them would only lose accuracy. */
  function mSaveMeal(sk, name, share) {
    var day = mDay(mViewKey());
    var items = (day[sk] || []).filter(function (it) { return LIVE.BY_ID[it.id]; });
    if (!items.length || !name) return null;
    var mac = { kcal: 0, p: 0, f: 0, c: 0, na: 0, fib: 0 };
    var ing = [], parts = [], est = false;
    items.forEach(function (it) {
      var r = LIVE.BY_ID[it.id];
      ['kcal', 'p', 'f', 'c', 'na', 'fib'].forEach(function (m) {
        mac[m] += ((r.macro || {})[m] || 0) * it.x;
      });
      if (r.est) est = true;
      var unit = r.food ? r.unit : 'serving';
      ing.push(fmtNum(it.x) + ' \u00d7 ' + unit + ' ' + r.name);
      /* The parts keep their own id, amount and unit so the kept meal can be
         opened later and read back as what it was \u2014 not just as a total. */
      parts.push({ id: it.id, x: it.x, name: r.name, unit: unit });
    });
    ['kcal', 'p', 'f', 'c', 'na', 'fib'].forEach(function (m) { mac[m] = Math.round(mac[m]); });

    if (share) {
      /* Onto the Ours shelf, where it gets everything a recipe gets — the
         picker's fit ranking, portion scaling, the printed book. And where
         everyone with the pantry code can see it, which is why this is asked
         rather than assumed. */
      var id = window.Store.newRecipeId();
      window.Store.saveRecipe({
        id: id, own: true, book: 3, secNum: 1, secName: 'Ours',
        name: name, servings: '1 Serving', servN: 1, time: '0 mins', diff: 'Easy',
        ing: ing, steps: [], extras: '', macro: mac, est: est, typedMacro: true
      });
      return id;
    }
    /* Or into your own foods, which live in your account and go nowhere near
       the household. One of it is one plate — the whole meal as it stood —
       and it remembers its parts, sodium and fibre, so the kept salad still
       reads as beans, dressing and greens when you open it next Tuesday. */
    var mine = mReadMyFoods(), fresh = mNewFoodKey(name, mine), key = fresh.key;
    name = fresh.name;
    /* kx: the calories no gram accounts for. mBuildFoods works a food's
       calories out from its grams whenever it has any, and a part that was
       only ever a number of calories — "700 at a friend's" — has none, so a
       kept lunch of that plus a chicken breast came back as the chicken
       breast: 858 kcal saved, 164 counted. Carried beside the grams so the
       rebuild can add it back, and only when it is more than rounding. */
    var kx = mac.kcal - kcalOf({ p: mac.p, f: mac.f, c: mac.c });
    mine[key] = { name: name, unit: 'plate', kcal: mac.kcal, p: mac.p, f: mac.f, c: mac.c,
      na: mac.na, fib: mac.fib, parts: parts };
    if (kx >= 5) mine[key].kx = kx;
    mWriteMyFoods(mine);
    mBuildFoods();
    return 'f:my:' + key;
  }

  return { mBalanceMeal: mBalanceMeal, mSaveMeal: mSaveMeal };
};
