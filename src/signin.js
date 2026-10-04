/* Signed in, and keeping up: the listener on your record that starts at
 * sign-in and takes in what the account sends (mSyncStart), asking again
 * once there is signal (mSyncRetry, mWatchUser), the push of what changed
 * here (mSyncPush), and everything of yours gone from both ends
 * (mDeleteAccount). The longer account is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.signin(app) once, as it starts, and keeps what it gives back
 * under the same names. Whether the server could be reached
 * (mSyncUnreachable) stays declared in app.js, and so do the record, its
 * listener and timer, what is dirty and whether the account has been
 * heard from; the part reaches all of those through LIVE
 * (tests/scope.test.js holds the lists to each other). The two listeners
 * that retry on signal and on coming back to the app stay in app.js, where
 * they ran. Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).signin = function (app) {
  'use strict';

  // what it reads of the app's, and (LIVE) what the app replaces as it goes: mAuthKnown, mClkSent, mDirtyAll, mSyncDoc, mSyncHeard, mSyncOff, mSyncTimer, mSyncUnreachable
  var MCLOCK_ID = app.MCLOCK_ID;
  var S = app.S;
  var dinerKeep = app.dinerKeep;
  var dinerWatch = app.dinerWatch;
  var mAccount = app.mAccount;
  var mAccountMark = app.mAccountMark;
  var mBootTargets = app.mBootTargets;
  var mClockHear = app.mClockHear;
  var mCreditWeek = app.mCreditWeek;
  var mForgetDay = app.mForgetDay;
  var mHouseReconcile = app.mHouseReconcile;
  var mInviteTry = app.mInviteTry;
  var mMergeRemote = app.mMergeRemote;
  var mOwner = app.mOwner;
  var mSetOwner = app.mSetOwner;
  var mSuspectAccount = app.mSuspectAccount;
  var mSyncState = app.mSyncState;
  var mSyncTake = app.mSyncTake;
  var mTrainSig = app.mTrainSig;
  var pwFitCaps = app.pwFitCaps;
  var renderMacros = app.renderMacros;
  var renderModal = app.renderModal;
  var LIVE = app.LIVE;

  var mSyncAsking = false;

  /* Signal back, or the app back in front of you: try again.
   *
     A signed-in phone opened with no signal asked once, failed, and then
     never asked again. mAuthKnown was true after that first answer, and
     every later mSyncStart — the Sync button, a sheet — read it as "we
     already know nobody is signed in". The household half of sync.js
     retried on 'online'; My Day and Strengthen did not, so nothing logged in
     the basement reached the account until the app was killed and reopened.
     Only the unreachable case retries; a device that got an answer has one. */
  function mSyncRetry() {
    if (mSyncAsking || !LIVE.mSyncUnreachable || !mSuspectAccount()) return;
    mSyncStart();
  }

  /* Hearing about sign-in and sign-out from the SDK, once it can be heard.
     Asked at boot, it gave up silently with no signal, and nothing asked
     again once there was one. */
  var mUserWatch = false;
  function mWatchUser() {
    if (mUserWatch || !window.Store.onUser) return;
    mUserWatch = true;
    Promise.resolve(window.Store.onUser(function () { mSyncStart(); })).then(function (ok) {
      if (ok === false) mUserWatch = false;
    });
  }

  function mSyncStart() {
    if (LIVE.mSyncOff) { LIVE.mSyncOff(); LIVE.mSyncOff = null; LIVE.mSyncDoc = null; }
    if (window.Train) window.Train.attach(null);
    if (!window.Store || !window.Store.configured) {
      LIVE.mAuthKnown = true;
      mSyncState('off');
      return;
    }
    if (!mAccount()) {
      /* Nobody is signed in as far as this page can see — but if the device
         remembers an account, the SDK may simply not have loaded yet, and
         saying "signed out" now would be a guess. Ask, then answer. And ask
         again after an attempt that could not reach anybody: that answer
         was "no signal", not "nobody". */
      if (mSuspectAccount() && (!LIVE.mAuthKnown || LIVE.mSyncUnreachable)) {
        if (mSyncAsking) return;
        mSyncAsking = true;
        window.Store.ready().then(function () {
          mSyncAsking = false;
          LIVE.mAuthKnown = true;
          /* The device's answer, corrected by the real one.
           *
             This flag decides whether Firebase loads at all, so it is written
             locally at sign-in and believed at boot. Believed is the problem:
             it was never checked again. Android clears site data on a PWA it
             considers idle, and the flag and the session do not have to go
             together — leaving a device that says "I have an account",
             loads the SDK, finds nobody, and quietly signs in anonymously
             underneath while showing the signed-out sheet. Which reads as a
             sign-in that did not take. Now the truth wins on every load. */
          mAccountMark();
          LIVE.mSyncUnreachable = false;                 // the server answered
          mWatchUser();
          if (mAccount()) mSyncStart();
          /* The device said it had an account and the server says otherwise.
             That is the drift this whole re-affirmation exists to catch, so
             it has to reach the gear and not just the sheet. */
          else mSyncState('off');
        }, function () {
          mSyncAsking = false;
          LIVE.mAuthKnown = true;
          LIVE.mSyncUnreachable = true;
          mSyncState('error');
        });
        return;
      }
      LIVE.mAuthKnown = true;
      /* Signed out, or unreachable and this device remembers an account.
         Only the second of those is worth a warning, and only that one keeps
         the error it already has. */
      mSyncState(LIVE.mSyncUnreachable && mSuspectAccount() ? 'error' : 'off');
      return;
    }
    mSyncState('connecting');
    window.Store.ready().then(function (db) {
      LIVE.mAuthKnown = true;
      LIVE.mSyncUnreachable = false;             // it answered
      mAccountMark();                       // the truth, again, now that it is knowable
      var uid = window.Store.uid();
      if (!uid || !mAccount()) {
        // the answer is known now even though it is "nobody"; say so
        mSyncState('off');
        return;
      }
      /* Carrying the day up into an account is for one case only: the
         anonymous identity this device has been using all along becoming a
         named one. If what is here belonged to somebody else, this device
         takes what the account has and offers it nothing. */
      var owner = mOwner();
      var mine = !owner || owner === uid;
      if (!mine) {
        mForgetDay();
        if (S.view === 'macros') renderMacros();
      }
      mSetOwner(uid);
      if (window.Store.enrol) window.Store.enrol();
      dinerWatch();
      mInviteTry();
      LIVE.mSyncHeard = false;
      LIVE.mSyncDoc = db.collection('users').doc(uid);
      /* Train keeps its log in the same document, under `train`, and rides
         this listener rather than opening a second one on the same record. */
      /* Its workouts go a year to a record under this one (see attach in
         train.js), and moving them out of this record needs Firestore's
         delete marker, which only the loaded SDK has. */
      if (window.Train) window.Train.attach(LIVE.mSyncDoc, window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue);
      /* includeMetadataChanges for the same reason as the household
         listener in sync.js: the step from a cache answer to a server answer
         changes no data, and without it that step is never heard. */
      LIVE.mSyncOff = LIVE.mSyncDoc.onSnapshot({ includeMetadataChanges: true }, function (snap) {
        var data = snap.exists ? (snap.data() || {}) : null;
        /* Only when the server actually answered. A snapshot served from the
           local cache is Firestore handing back what this device already had,
           and calling that "Synced" told you the other phone had your day
           when nothing had left the building. The household half of this app
           has always checked; My Day never did, so the two sides of one
           screen gave different answers to the same question. */
        mSyncState(snap.metadata && snap.metadata.fromCache ? 'connecting' : 'on');
        var live = !(snap.metadata && snap.metadata.fromCache);
        if (live) mHouseReconcile(data || {});
        /* Strengthen's half moves Nourish too — the lifting days, and the
           workouts that make a day a training day — and nothing redrew for
           it: a session logged on the other phone left this one's day on its
           rest-day carbs until something else happened to draw. */
        mClockHear(data, snap.metadata && snap.metadata.hasPendingWrites);
        var trWas = mTrainSig();
        if (window.Train) window.Train.remote(data && data.train, live);
        var trMoved = mTrainSig() !== trWas;
        if (trMoved) mCreditWeek();
        if (!data || !data.myday) {
          if (live) { mBootTargets(); LIVE.mSyncHeard = true; mSyncPush(true); }
          if (trMoved && S.view === 'macros') renderMacros();
          return;
        }
        /* Targets from another of your devices move the dinner you share. */
        var capWas = JSON.stringify(pwFitCaps());
        if ((mMergeRemote(data.myday) || trMoved) && S.view === 'macros') renderMacros();
        if (JSON.stringify(pwFitCaps()) !== capWas) dinerKeep();
        if (live) mBootTargets();
        // the account's copy is in: now what is newer here can go up, all of it
        if (live && !LIVE.mSyncHeard) { LIVE.mSyncHeard = true; mSyncPush(true); }
        if (S.syncOpen) renderModal();
      }, function () { mSyncState('error'); });
    }, function () { mSyncState('error'); });
  }

  /* Everything of yours, gone from both ends.

     The remote record first, through the sync layer, and this device's copy
     inside it — mForgetDay wipes the local stores AND the module-level
     objects the payload is rebuilt from, which matters: clearing storage
     alone would leave the next push to write it all straight back up.

     The household is deliberately untouched, but for your name on its
     members list, which Store.deleteAccount takes off. It is a shared thing,
     the rules do not permit deleting it, and taking a spouse's meal plan
     away because you closed your own account would be a surprise nobody
     asked for. */
  function mDeleteAccount() {
    if (!window.Store || !window.Store.deleteAccount) return Promise.reject(new Error('no-account'));
    return window.Store.deleteAccount(function () {
      if (LIVE.mSyncOff) { LIVE.mSyncOff(); LIVE.mSyncOff = null; }
      LIVE.mSyncDoc = null;
      if (window.Train) window.Train.attach(null);
      mForgetDay();
      return null;
    }).then(function () {
      mSyncState('local');
      mAccountMark();
      if (S.view === 'macros') renderMacros();
      if (S.syncOpen) renderModal();
    });
  }

  function mSyncPush(now) {
    if (!LIVE.mSyncDoc) return;
    /* `now` is also "and whole". Its three callers are the moments a partial
       push cannot answer for: the first sight of the document, a document
       with nothing in it, and a device that has just been handed the day. */
    if (now) LIVE.mDirtyAll = true;
    // before the account has answered, changes wait, marked; its first answer sends them
    if (!LIVE.mSyncHeard) return;
    clearTimeout(LIVE.mSyncTimer);
    LIVE.mSyncTimer = setTimeout(function () {
      // signed out or deleted in the meantime: nothing to send it to
      if (!LIVE.mSyncDoc) return;
      var body = mSyncTake();
      if (!body) { mSyncState('on'); return; }
      var out = { myday: body };
      /* And the server's own time, under this device's name, so mClockHear
         can tell how far out this device's clock is. Absent from an SDK that
         cannot give one, which only costs the correction. */
      var fv = window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue;
      if (fv && typeof fv.serverTimestamp === 'function') {
        out.clk = { by: MCLOCK_ID, at: fv.serverTimestamp() };
        LIVE.mClkSent = Date.now();
      }
      LIVE.mSyncDoc.set(out, { merge: true }).then(function () {
        mSyncState('on');
      }, function () {
        /* A write that never landed leaves this device unable to say what the
           far end is missing, so the next one says everything. */
        LIVE.mDirtyAll = true;
        mSyncState('error');
      });
    }, now ? 0 : 900);
  }

  return { mSyncRetry: mSyncRetry, mWatchUser: mWatchUser, mSyncStart: mSyncStart, mDeleteAccount: mDeleteAccount, mSyncPush: mSyncPush };
};
