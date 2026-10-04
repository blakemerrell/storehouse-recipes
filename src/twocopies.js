/* Two copies of My Day on one phone, two tabs or the home-screen app and a
 * browser tab, kept as one: what the other copy wrote to storage is read
 * as if another device had sent it and merged the same way, newest winning
 * part by part (mFoldNow), and a write here first takes in anything still
 * waiting (mFoldDue). The longer account is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.twocopies(app) once, as it starts, and keeps what it gives back
 * under the same names. The storage listener that starts the fold stays in
 * app.js, where it ran, and so does its timer (mFoldTimer), which app.js
 * also reads; the part reaches the timer through LIVE (tests/scope.test.js
 * holds the lists to each other). Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).twocopies = function (app) {
  'use strict';

  // what it reads of the app's, and (LIVE) what the app replaces as it goes: mFoldTimer
  var MSYNC_KEYED = app.MSYNC_KEYED;
  var MSYNC_SIMPLE = app.MSYNC_SIMPLE;
  var S = app.S;
  var mLsJson = app.mLsJson;
  var mMergeRemote = app.mMergeRemote;
  var mNum = app.mNum;
  var mPlainObj = app.mPlainObj;
  var mSyncKey = app.mSyncKey;
  var renderMacros = app.renderMacros;
  var LIVE = app.LIVE;

  /* ------------------------------------------- two copies on one phone
   *
     Two tabs, or the home-screen app and a browser tab, are two copies of My
     Day, and each wrote the whole of what it held on every change. Breakfast
     logged in one and lunch in the other left the day holding lunch: the
     second copy had never heard of the breakfast, and its whole day went
     over the top of it. Blake's call: merge, so nothing is lost and nothing
     needs pressing.
   *
     It is the account's merge, not a second rule. Everything the other copy
     wrote is in storage with its stamps, which is exactly the shape the
     account hands mMergeRemote — newest wins, part by part and day by day —
     so what storage holds is read as if it had come from another device.
     The storage event fires only in the OTHER copies, which are the ones
     that need to hear; it is let settle for a moment, because one change is
     several writes (the value, then its stamp). A write here first takes in
     anything still waiting, so a copy that was asleep does not write its
     stale day over a fresh one before the event has been heard. */
  function mFoldStored() {
    var st = mLsJson('bsc.myStamps');
    if (!mPlainObj(st)) return false;
    var md = {};
    MSYNC_SIMPLE.forEach(function (row) {
      if (mNum(st[row[0]])) md[row[0]] = { v: mLsJson(row[1]), at: st[row[0]] };
    });
    MSYNC_KEYED.forEach(function (row) {
      var m = mLsJson(row.ls), sm = st[row.part];
      if (!mPlainObj(sm)) return;
      if (!mPlainObj(m)) m = {};
      var keys = {}, map = {};
      Object.keys(m).forEach(function (k) { keys[k] = 1; });
      if (row.stamps) Object.keys(sm).forEach(function (k) { keys[k] = 1; });
      Object.keys(keys).forEach(function (k) {
        if (mNum(sm[k])) map[mSyncKey(k)] = { v: row.value(k, m), at: sm[k] };
      });
      md[row.part] = map;
    });
    return mMergeRemote(md);
  }
  function mFoldNow() {
    clearTimeout(LIVE.mFoldTimer);
    LIVE.mFoldTimer = null;
    if (mFoldStored() && S.view === 'macros') renderMacros();
  }
  function mFoldDue() {
    if (!LIVE.mFoldTimer) return;
    clearTimeout(LIVE.mFoldTimer);
    LIVE.mFoldTimer = null;
    mFoldStored();
  }

  return { mFoldNow: mFoldNow, mFoldDue: mFoldDue };
};
