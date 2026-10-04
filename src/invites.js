/* Invites, and the pantry this phone shares: an invite link kept until
 * this device knows who it is (mInviteGet, mInviteSet), asked about before
 * it is used and then redeemed (mInviteTry); whether the shared pantry is
 * this account's alone (mHouseAlone); the way back into a pantry after a
 * mistyped code (mJoinBack); and the account told of a join once it is
 * real (mHouseWatch). The longer account is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.invites(app) once, as it starts, and keeps what it gives back
 * under the same names. Whether an invite is on its way (mInviteBusy) stays
 * declared in app.js, which reads it elsewhere; the part reaches it, and
 * the account's record and answer, through LIVE (tests/scope.test.js holds
 * the lists to each other). Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).invites = function (app) {
  'use strict';

  // what it reads of the app's, and (LIVE) what the app replaces as it goes: mAcctHouse, mHouseTellNext, mInviteBusy, mSyncDoc
  var S = app.S;
  var ask = app.ask;
  var mAccount = app.mAccount;
  var mHouseTell = app.mHouseTell;
  var renderAll = app.renderAll;
  var LIVE = app.LIVE;

  /* ------------------------------------------------------------ invites
   *
     A link from somebody's "Invite someone" arrives as ?invite=<token>. It is
     kept in localStorage straight away, because signing in on a phone leaves
     the page and comes back, and anything held only in memory would not make
     the trip. It is spent the first time this device knows who it is. */
  /* The invite said yes to, and whether the question is up. An invite link
     used to join the moment it was opened by anyone signed in: moved out of
     their own shared pantry, their plan, recipes and pantry handed to
     whoever sent it, and their other phones told to follow, with no word on
     screen. A link is somebody else's intent until you say it is yours. */
  var mInviteOk = '', mInviteAsking = false;
  function mInviteGet() {
    try { return localStorage.getItem('bsc.invite') || ''; } catch (e) { return ''; }
  }
  function mInviteSet(tok) {
    try {
      if (tok) localStorage.setItem('bsc.invite', tok); else localStorage.removeItem('bsc.invite');
    } catch (e) { /* private mode: held for this page only */ }
  }
  function mInviteTry() {
    var tok = mInviteGet();
    if (!tok || LIVE.mInviteBusy || !mAccount() || !window.Store.redeem) return;
    if (mInviteOk !== tok) {
      if (mInviteAsking) return;
      mInviteAsking = true;
      var cur = window.Store.house;
      ask({ title: 'Join this shared pantry?',
        body: 'You opened an invite link. Joining shares the meal plan, your recipes and the pantry on this phone with everyone in it.' +
          (cur ? ' You will leave the pantry you share now.' : ''),
        ok: 'Join' }, function (yes) {
        mInviteAsking = false;
        if (!yes) { mInviteSet(''); S.inviteMsg = ''; renderAll(); return; }
        mInviteOk = tok;
        mInviteTry();
      });
      return;
    }
    LIVE.mInviteBusy = true;
    LIVE.mHouseTellNext = true;
    window.Store.redeem(tok).then(function () {
      mInviteSet('');
      LIVE.mInviteBusy = false;
      S.inviteMsg = 'You joined the pantry.';
      renderAll();
    }, function (err) {
      LIVE.mInviteBusy = false;
      LIVE.mHouseTellNext = false;
      var why = err && err.message;
      /* A network failure keeps the invite for the next try; a refusal from
         the invite itself does not, or it would be refused on every load. */
      if (why === 'spent' || why === 'gone') mInviteSet('');
      S.inviteMsg = why === 'spent' ? 'That invite has been used or has expired. Ask for a new link.'
        : why === 'gone' ? 'That invite link is not valid. Ask for a new one.'
          : 'Could not join the pantry yet. It will try again when there is signal.';
      renderAll();
    });
  }

  /* Whether the pantry this phone shares is this account's alone: on its
     members list and nobody else. Phones without an account are never on
     the list, so an empty one may have anybody in it. */
  function mHouseAlone() {
    var me = mAccount(), m = window.Store.members || [];
    return !!me && m.length > 0 && m.every(function (u) { return u === me.uid; });
  }
  /* A code typed from inside a pantry that is nobody's. connect() lets a
     code like that go and says so, which from the screen with no pantry is
     the whole answer; from inside one it would take the phone out of the
     pantry it was in as well, to sit alone with the message, for one wrong
     digit. Back into that one, and the message said there. */
  function mJoinBack() {
    var b = S.joinBack, st = window.Store.status;
    if (!b) return;
    if (window.Store.house) { if (st === 'synced') S.joinBack = null; return; }
    if (st !== 'local') return;
    S.joinBack = null;
    S.joinMsg = window.Store.statusNote;
    // once the connect that missed has finished with it, not from inside it
    setTimeout(function () { if (!window.Store.house) window.Store.join(b.code, true, b.mine); }, 0);
  }
  /* Called on every Store change. A join typed here, or a pantry made here,
     becomes the account's once the server has confirmed it exists — not
     before, or a mistyped code would be written over the real one. */
  function mHouseWatch() {
    if (!LIVE.mHouseTellNext || !LIVE.mSyncDoc || !mAccount()) return;
    var st = window.Store.status, code = window.Store.house;
    if (!code) { if (st === 'local') LIVE.mHouseTellNext = false; return; }
    if (st !== 'synced') return;
    /* Still the household the account already has: nothing to tell yet. An
       invite taken from inside another pantry set the flag before the join
       was through, and the old pantry's next word spent it — so the account
       was never told, and every open after asked "Use your account's pantry?" */
    if (code === LIVE.mAcctHouse) return;
    LIVE.mHouseTellNext = false;
    mHouseTell(code);
  }

  return { mInviteGet: mInviteGet, mInviteSet: mInviteSet, mInviteTry: mInviteTry, mHouseAlone: mHouseAlone, mJoinBack: mJoinBack, mHouseWatch: mHouseWatch };
};
