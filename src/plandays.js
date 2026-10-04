/* Two rows of the plan sheet: the burn the plan is built on, measured or
 * by the formula, with the tap that switches (mMeasuredRowHTML), and the
 * seven training-day toggles, with what they say about your block and the
 * one place the days are written (mTrainRowHTML, mTrainNSay, mSetTrainDays,
 * mDaysChanged). The longer account is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.plandays(app) once, as it starts, and keeps what it gives back
 * under the same names. Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).plandays = function (app) {
  'use strict';

  // what it reads of the app's
  var mBurn = app.mBurn;
  var mLbWord = app.mLbWord;
  var mMeasuredTdee = app.mMeasuredTdee;
  var mPlanCalc = app.mPlanCalc;
  var mReadProfile = app.mReadProfile;
  var mTargRec = app.mTargRec;
  var mTrainDays = app.mTrainDays;
  var mWriteProfile = app.mWriteProfile;
  var mWriteTargets = app.mWriteTargets;

  /* Offered only once it can be trusted, and never taken without being
     asked for — a number that quietly redrew somebody's whole plan on the
     twenty-first morning would be the app changing its mind about them
     behind their back. */
  /* The burn the plan is built on, written as a fact like the four above it.
     It used to sit below them in the EDITOR's row language — a ledger row
     with a rule under it, and a filled green pill for the only saturated
     colour on a page of quiet type. The rule fell between the number and
     the caption explaining it, so the evidence read as a heading for the
     cards below rather than as a note on the row above.

     It also showed the measured figure whether or not the plan used it, and
     said which in a pill. The row states the number the plan is ACTUALLY
     built on now, and the caption underneath carries the other one and the
     tap that switches. */
  function mMeasuredRowHTML(pr) {
    var m = mMeasuredTdee();
    if (!m) return '';
    var on = !!pr.useTdee;
    var formula = mBurn(pr);
    var other = formula ? Math.round(formula.tdee) : null;
    /* Nothing to offer and nothing to compare against: without the formula
       there is one number, and a switch to nowhere is worse than no switch. */
    if (!other) return '';
    var used = on ? m.tdee : other;
    /* The caption says where the number in use came from; the tap beside it
       names the number it would switch to. Neither repeats the other, so
       both fit on two lines beside each other at 390px. */
    var cap = on
      ? 'From ' + m.days + ' days: ' + m.eaten.toLocaleString() + ' kcal a day, ' +
        (m.lb === 0 ? 'no change on the scale' : mLbWord(m.lb)) + '.'
      : 'By the formula, from your size and how you move.';
    return '<div class="mt-burn">' +
      '<div class="mtf-row"><span>Burning</span><b>' +
        used.toLocaleString() + ' kcal a day</b></div>' +
      '<div class="mt-burn-c"><span>' + cap + '</span>' +
        '<button class="mt-swap" data-mtdee="' + (on ? '0' : '1') + '">Use ' +
          (on ? 'the formula&rsquo;s ' + other.toLocaleString()
              : 'the measured ' + m.tdee.toLocaleString()) +
        '</button></div>' +
    '</div>';
  }

  function mTrainNSay(n) {
    var b = mBlockN();
    /* Only claim "one for each session" when it is true. A new block with
       more or fewer sessions than the days already picked says so, and says
       where to fix it. */
    if (b && n !== b) {
      return (n ? n + ' a week' : 'None picked') + ' \u00b7 your block has ' + b +
        (b === 1 ? ' session' : ' sessions') + ', so pick ' + b;
    }
    return (n ? n + ' a week' : 'None picked') + (b ? ' \u00b7 one for each session of your block' : ' \u00b7 the same days as Strengthen');
  }
  function mBlockN() {
    try { return window.Train && window.Train.blockSessions ? window.Train.blockSessions() : 0; } catch (e) { return 0; }
  }
  /* The one place the lifting days are written: Strengthen's store, which
     the account carries, or the profile when Strengthen is not loaded. */
  function mSetTrainDays(days) {
    days = days.slice().sort(function (a, b) { return a - b; });
    var pr = mReadProfile();
    try { if (window.Train && window.Train.setLiftDays) window.Train.setLiftDays(days); } catch (e) { /* Strengthen is not up */ }
    /* The profile's copy too, even with Strengthen holding the list: it is
       what stands in once the list is empty, and a stale one brought back
       every day you had just cleared. */
    pr.train = days;
    pr.workouts = days.length;
    mWriteProfile(pr);
    mDaysChanged();
  }
  /* The plan's own grams are worked out from how many sessions a week you
     lift — mBurn counts them — so a change of lifting days is a change of
     plan. It was not treated as one: days picked in Strengthen after the plan
     was made moved the profile's count and nothing else, and the plan went on
     being the one made for no training at all. Blake's newcomer, Maintain,
     three days picked second: 2,219 kcal and 234 g carbs every day, where the
     same three days picked first gave 2,379 and 334 on a lifting day. The
     plan sheet said "3 sessions a week" over numbers made for none.
   *
     Only the plan's own grams (auto). Numbers somebody typed into the boxes
     are theirs, and the days change which of their days are lifting days
     without touching what they typed. */
  function mDaysChanged() {
    var rec = mTargRec();
    if (!rec || rec.auto === 0) return false;
    var fresh = mPlanCalc(mReadProfile());
    if (!fresh) return false;
    if (Number(rec.p) === fresh.p && Number(rec.f) === fresh.f && Number(rec.c) === fresh.c) return false;
    mWriteTargets(Object.assign({}, rec, { p: fresh.p, f: fresh.f, c: fresh.c }));
    return true;
  }
  /* Seven toggles, Monday first. Derived from the workouts box until one is
     pressed; from then on the list is yours. */
  function mTrainRowHTML() {
    var on = mTrainDays();
    var L = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    var FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return '<span class="mtrain" id="mtTrain">' + L.map(function (w, i) {
      var lit = on.indexOf(i) >= 0;
      return '<button data-mtrain="' + i + '" aria-pressed="' + (lit ? 'true' : 'false') +
        '" aria-label="' + FULL[i] + (lit ? ', training day' : '') + '">' + w + '</button>';
    }).join('') + '</span>';
  }

  return { mMeasuredRowHTML: mMeasuredRowHTML, mTrainNSay: mTrainNSay, mBlockN: mBlockN, mSetTrainDays: mSetTrainDays, mDaysChanged: mDaysChanged, mTrainRowHTML: mTrainRowHTML };
};
