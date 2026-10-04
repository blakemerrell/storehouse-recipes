/* The day's budget: what everything on the day comes to, eaten or not
 * (mTotals); whether the day is finished (mDayDone); how much of the day
 * each meal deserves (MSLOT_W, mSlotW); and what this meal should reach
 * for against what the day can still absorb (mShares). The longer account
 * is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.budget(app) once, as it starts, and keeps what it gives back
 * under the same names. The recipes by id (BY_ID) are replaced as the
 * recipes change, so the part reads them through LIVE (tests/scope.test.js
 * holds the lists to each other). Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).budget = function (app) {
  'use strict';

  // what it reads of the app's, and (LIVE) what the app replaces as it goes: BY_ID
  var mReadSlots = app.mReadSlots;
  var mSkipped = app.mSkipped;
  var mViewKey = app.mViewKey;
  var LIVE = app.LIVE;

  /* Everything on the day counts against the budget, eaten or not — putting a
     dinner on the plan is committing its grams, and the picker must not offer
     the same grams twice. Eaten is tracked separately for the bars. */
  function mTotals(day) {
    /* Sodium and fibre ride along. Every recipe has carried both since the
       book was built — they feed the leaf score — and neither has ever been
       shown on a day, which is how the app came to draft 3,400 mg days
       without mentioning it. */
    var all = { p: 0, f: 0, c: 0, kcal: 0, na: 0, fib: 0 };
    var eaten = { p: 0, f: 0, c: 0, kcal: 0, na: 0, fib: 0 };
    var est = false;
    /* Over the day's own keys, not the current meal list: a plate logged
       under a meal since removed from the plan still went into a mouth. */
    Object.keys(day).forEach(function (sk) {
      (day[sk] || []).forEach(function (it) {
        var r = LIVE.BY_ID[it.id];
        if (!r || !r.macro) return;
        if (r.est) est = true;
        ['p', 'f', 'c', 'kcal', 'na', 'fib'].forEach(function (m) {
          var v = (r.macro[m] || 0) * it.x;
          all[m] += v;
          if (it.eaten) eaten[m] += v;
        });
      });
    });
    return { all: all, eaten: eaten, est: est };
  }

  /* A day is finished when everything on it has been eaten. Plates whose
     food is gone from the table do not count either way — they cannot be
     ticked, so they must not keep a day open forever. An empty day is not
     finished, it is empty. */
  function mDayDone(day) {
    var n = 0, left = 0;
    Object.keys(day).forEach(function (sk) {
      (day[sk] || []).forEach(function (it) {
        if (!LIVE.BY_ID[it.id]) return;
        n++;
        if (!it.eaten) left++;
      });
    });
    return n > 0 && left === 0;
  }

  /* How much of the day each meal deserves. Split evenly, a before-bed snack
     was offered a plate the size of dinner's; these are the thumbs on the
     scale. Editable per meal under Craft my plan; the numbers are weights,
     not a percentage that must sum to anything. */
  var MSLOT_W = { b: 20, l: 25, d: 35, s: 10, x: 15 };
  function mSlotW(slot) {
    var w = Number(slot.w);
    return w > 0 ? w : (MSLOT_W[slot.t] || 15);
  }

  /* What THIS meal should reach for, and what the day can still absorb.
     R is the day's remaining grams, floored at zero. T is the meal's share
     of it — R split over the still-empty slots by their weights, so dinner
     reaches for dinner's portion of what is left and a snack for a snack's —
     and D normalizes penalties to the size of the target so the weights mean
     the same thing whether the target is 50 grams or 180. */
  function mShares(day, targets, slot) {
    var tot = mTotals(day);
    var w = slot ? mSlotW(slot) : 1;
    var sumW = 0, counted = false;
    var dk = mViewKey();
    mReadSlots().list.forEach(function (s) {
      var isThis = slot && s.k === slot.k;
      /* A skipped meal claims nothing. This is the whole point of the skip:
         an empty meal reserves its share and drags every other meal down to
         make room for food that is never coming. */
      if (!isThis && mSkipped(dk, s.k)) return;
      if (!(day[s.k] || []).length || isThis) {
        sumW += mSlotW(s);
        if (isThis) counted = true;
      }
    });
    if (slot && !counted) sumW += w;    // a bygone meal still being served
    if (!sumW) sumW = w;
    var frac = w / sumW;
    var R = {}, T = {}, D = {};
    ['p', 'f', 'c'].forEach(function (m) {
      R[m] = Math.max(0, targets[m] - tot.all[m]);
      T[m] = R[m] * frac;
      D[m] = Math.max(1, targets[m]);
    });
    return { R: R, T: T, D: D };
  }

  return { mTotals: mTotals, mDayDone: mDayDone, mSlotW: mSlotW, mShares: mShares };
};
