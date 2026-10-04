/* The kitchen travels with the account: the household code is kept on
 * /users/{uid} as `house`, so a second device signed in as you opens on
 * your book and not an empty one. Telling the account the code
 * (mHouseTell), and squaring what the account says with what this device
 * holds (mHouseReconcile), which joins, asks, or makes a kitchen only for
 * a device with something worth keeping. The longer account is with the
 * code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.kitchen(app) once, as it starts, and keeps what it gives back
 * under the same names. The account's record (mSyncDoc), its answer
 * (mAcctHouse) and the flag for a join on its way (mHouseTellNext) stay
 * declared in app.js, which reads them elsewhere; the part reaches those,
 * and mInviteBusy, through LIVE (tests/scope.test.js holds the lists to
 * each other). Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).kitchen = function (app) {
  'use strict';

  // what it reads of the app's, and (LIVE) what the app replaces as it goes: mAcctHouse, mHouseTellNext, mInviteBusy, mSyncDoc
  var ask = app.ask;
  var LIVE = app.LIVE;

  /* The kitchen travels with the account.
   *
     Signing in used to carry My Day and nothing else. Favorites, recipes of
     your own, the weeks and the pantry live in the household document, which
     a device reaches only by holding its code — so a second device signed in
     as you opened on an empty book and looked like a sync that had done
     nothing. Blake: "when i logged into the app on my PC i expect to see
     exactly what is on my phone."
   *
     So the account keeps the code, as `house` on /users/{uid}. Absent means
     no device has ever told it one; '' means somebody signed in chose to stop
     sharing, and is not to be undone by the next device that opens. */

  var mHouseAsked = false;      // one question a session, not one a snapshot
  var mHouseMaking = false;

  function mHouseTell(code) {
    LIVE.mAcctHouse = code;
    if (LIVE.mSyncDoc) LIVE.mSyncDoc.set({ house: code }, { merge: true }).catch(function () { /* next snapshot retries */ });
  }

  /* Whether this device holds anything that would be lost if it stayed on this
     device. A fresh one does not, and must not make a kitchen for the account
     just by being opened first — that would be an empty kitchen standing in
     front of the real one on the phone. */
  function mHouseWorthKeeping() {
    var st = window.Store.state;
    var some = function (o) { return o && Object.keys(o).length > 0; };
    if (st.favs && st.favs.length) return true;
    if (some(st.mine) || some(st.edits) || some(st.pantry) || some(st.pantryNew)) return true;
    return Object.keys(st.weeks || {}).some(function (k) {
      var plan = st.weeks[k].plan || {};
      return Object.keys(plan).some(function (d) { return (plan[d] || []).length; });
    });
  }

  /* Only ever from a server answer: a cached snapshot that lacks `house`
     is not an account that lacks one. */
  function mHouseReconcile(data) {
    var has = Object.prototype.hasOwnProperty.call(data, 'house') && typeof data.house === 'string';
    var theirs = has ? data.house : '';
    var mine = window.Store.house;
    LIVE.mAcctHouse = has ? theirs : undefined;
    /* A join, a new pantry or an invite is on its way from this device. The
       account hears about it once it is real; until then the account's old
       answer is not a disagreement to act on. */
    if (LIVE.mHouseTellNext || LIVE.mInviteBusy) return;
    if (!has) {
      if (mine) { mHouseTell(mine); return; }
      /* Once. Snapshots keep arriving while the transaction is out, and each
         would otherwise draw a second pantry for the same person. */
      if (!mHouseMaking && mHouseWorthKeeping()) {
        mHouseMaking = true;
        LIVE.mHouseTellNext = true;
        window.Store.createHousehold().then(function () { mHouseMaking = false; },
          function () { mHouseMaking = false; });
      }
      return;
    }
    if (!theirs || theirs === mine) return;
    if (!mine) { window.Store.join(theirs); return; }
    if (mHouseAsked) return;
    mHouseAsked = true;
    ask({
      title: 'Use your account’s pantry?',
      body: 'This device is sharing ' + mine + '. Your account uses ' + theirs +
        '. Switching brings what is on this device along with it.',
      ok: 'Switch this device'
    }, function (yes) { if (yes) window.Store.join(theirs); });
  }

  return { mHouseTell: mHouseTell, mHouseReconcile: mHouseReconcile };
};
