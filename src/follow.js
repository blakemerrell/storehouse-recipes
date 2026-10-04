/* Targets follow the scale: once a week, the plan is worked out again from
 * what the scale and the log say, and the targets move with it unless you
 * have said to leave them alone (mFollowScale, mTargRec); and the notice
 * that says so, for three days or until it is answered (mMovedHTML). The
 * longer account is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.follow(app) once, as it starts, and keeps what it gives back
 * under the same names. The weight log (MWEIGHTS) is read through LIVE
 * (tests/scope.test.js holds the lists to each other). Loaded before
 * app.js.
 */
(window.HiveParts = window.HiveParts || {}).follow = function (app) {
  'use strict';

  // what it reads of the app's, and (LIVE) what the app replaces as it goes: MWEIGHTS
  var MSTAMPS = app.MSTAMPS;
  var dayKey = app.dayKey;
  var kcalOf = app.kcalOf;
  var keyDate = app.keyDate;
  var mLineHTML = app.mLineHTML;
  var mPlanCalc = app.mPlanCalc;
  var mReadProfile = app.mReadProfile;
  var mReadTargets = app.mReadTargets;
  var mWriteTargets = app.mWriteTargets;
  var todayKey = app.todayKey;
  var LIVE = app.LIVE;

  /* ------------------------------------------------ targets follow the scale
   *
     The plan card worked its calories out from this week's weight; the bars
     scored the day against the grams saved when Save was last pressed. Ten
     pounds later those were two different days, on one screen. Blake chose
     to have the saved targets follow the scale once a week, the way RP
     adjusts, and to be told when they move.
   *
     The record carries three things beside the grams:
       auto   1 when the grams are the plan's own; 0 when somebody typed their
              own numbers into the boxes, which are theirs and are left alone.
              Absent on a record saved before this — treated as the plan's,
              since the boxes are filled from the plan, and the notice's Undo
              is there for the one that was not.
       set    the day the grams were last decided, by anybody.
       moved  what the last weekly change was, for the notice: from and to in
              kcal, the day, and the grams before, so Undo can put them back.
   *
     Only on a week with a weigh-in in it. With nothing new on the scale the
     plan cannot have moved, and a "change" worked out from a stale average
     would only be the formula disagreeing with itself. */
  var MTARG_WEEK = 7;
  function mTargRec() {
    try {
      var v = JSON.parse(localStorage.getItem('bsc.macroTargets'));
      return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
    } catch (e) { return null; }
  }
  function mDaysSince(k) { return Math.round((keyDate(todayKey()) - keyDate(k)) / 86400000); }

  function mFollowScale() {
    var rec = mTargRec();
    if (!rec || rec.auto === 0) return false;
    var set = rec.set || (MSTAMPS.t ? dayKey(new Date(MSTAMPS.t)) : '');
    if (!set || mDaysSince(set) < MTARG_WEEK) return false;
    var recent = Object.keys(LIVE.MWEIGHTS).some(function (k) {
      return LIVE.MWEIGHTS[k] > 0 && mDaysSince(k) < MTARG_WEEK;
    });
    if (!recent) return false;
    var fresh = mPlanCalc(mReadProfile());
    if (!fresh) return false;
    var cur = mReadTargets();
    /* A change worth a sentence. Two grams of protein and twenty calories
       is the formula's rounding, not the body. */
    if (Math.abs(kcalOf(fresh) - kcalOf(cur)) < 25 && Math.abs(fresh.p - cur.p) < 3) return false;
    mWriteTargets({ p: fresh.p, f: fresh.f, c: fresh.c, auto: 1, set: todayKey(),
      moved: { from: kcalOf(cur), to: kcalOf(fresh), on: todayKey(),
        prev: { p: cur.p, f: cur.f, c: cur.c } } });
    return true;
  }

  /* The notice, for three days after a change or until answered. */
  function mMovedHTML() {
    var rec = mTargRec();
    var mv = rec && rec.moved;
    if (!mv || mv.ok || !mv.on || mDaysSince(mv.on) > 3) return '';
    return mLineHTML('calm', '\u21bb',
      '<b>Targets updated for your weight.</b> ' + Number(mv.from).toLocaleString() +
        ' \u2192 ' + Number(mv.to).toLocaleString() + ' kcal a day.',
      '', [['OK', 'mline:moved:ok'], ['Undo', 'mline:moved:undo']]);
  }

  return { mTargRec: mTargRec, mFollowScale: mFollowScale, mMovedHTML: mMovedHTML };
};
