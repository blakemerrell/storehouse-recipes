/* The personal half of the sharing sheet (mAccountBlockHTML): whether you
 * are signed in, what the account carries, and the buttons that sign in,
 * sign out, pull the account's copy and delete it all. The household half
 * above it is shared; this half is yours. The longer account is with the
 * code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.account(app) once, as it starts, and keeps what it gives back
 * under the same name. The sync's state and whether the account has
 * answered (S_SYNC_STATE, mAuthKnown) stay declared in app.js; the part
 * reads them through LIVE (tests/scope.test.js holds the lists to each
 * other). Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).account = function (app) {
  'use strict';

  // what it reads of the app's, and (LIVE) what the app replaces as it goes: S_SYNC_STATE, mAuthKnown
  var S = app.S;
  var mAccount = app.mAccount;
  var mSuspectAccount = app.mSuspectAccount;
  var mSyncAway = app.mSyncAway;
  var LIVE = app.LIVE;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* The personal half of the sharing sheet. The household above is shared
     with people by reading them a code; this is carried between devices by
     being you, which is why it is an account and not a code — a weight
     history is not a thing to guard with a secret meant to be read aloud. */
  function mAccountBlockHTML() {
    var who = mAccount();
    var waiting = !who && !LIVE.mAuthKnown && mSuspectAccount();
    var away = mSyncAway();
    var word = { off: 'On this device only', connecting: 'Connecting\u2026',
      on: 'Synced', error: 'Cannot reach the server' }[LIVE.S_SYNC_STATE];
    var body;
    if (waiting) {
      body = '<p class="sync-p">Finding your account&hellip;</p>';
    } else if (away) {
      body = '<p class="sync-p">Signed in, but this phone can&rsquo;t reach the server. ' +
        'What you log is kept here and goes to your account when there&rsquo;s signal.</p>' +
        '<div class="sync-row"><button class="ghost" data-mysync="retry">Try again</button></div>';
    } else if (!window.Store.configured) {
      body = '<p class="sync-p">No server behind this copy.</p>';
    } else if (who) {
      body = '<div class="sync-who">Signed in as <strong>' +
        esc(who.email || who.name) + '</strong></div>' +
        /* Two devices used apart before they were ever joined arrive with two
           different days and no shared history to reconcile them by. The merge
           is newest-wins part by part, which is right forever after and
           arbitrary the first time — so the tie-breaker stays, folded away.
           It is a once-ever button, and it was taking three paragraphs and
           two thirds of the sheet to say so. */
        '<details class="sync-fold"><summary>The two devices disagree</summary>' +
          '<div class="sync-row">' +
            '<button class="ghost" data-mysync="push">This device is right</button>' +
            '<button class="ghost" data-mysync="pull">The account is right</button>' +
          '</div>' +
        '</details>' +
        '<div class="sync-row">' +
          '<button class="ghost" data-mysync="out">Sign out of this device</button></div>' +
        /* Signing out leaves everything where it is; this does not, and the two
           sit next to each other, so it says which is which. */
        '<div class="sync-row sync-note">' +
          '<a href="privacy/" target="_blank" rel="noopener">What is stored, and where</a></div>' +
        '<details class="sync-fold"><summary>Delete my account</summary>' +
          '<p class="sync-note">Removes your weigh-ins, your food log, your plan ' +
            'and any foods you added, from this device and from the account. ' +
            'It cannot be undone, and it does not touch a shared plan you are ' +
            'joined to \u2014 that belongs to the household, not to you.</p>' +
          '<div class="sync-row">' +
            '<button class="ghost danger" data-mysync="delete">Delete my account</button>' +
          '</div>' +
        '</details>';
    } else {
      body = (S.mySent
        ? '<div class="sync-warn">Open the link sent to <strong>' + esc(S.myJoin) + '</strong>.</div>'
        : '') +
        /* Google draws its own button in here, because the flow that keeps
           sign-in on this page can only be started from Google's button. Ours
           stays underneath as the fallback, hidden the moment theirs lands —
           so a browser that cannot reach the host still has a way in, and
           nobody is left looking at an empty box. */
        '<div class="sync-row">' +
          '<div id="myGoogleBtn" class="sync-gbtn"></div>' +
          '<button class="btn-primary" id="myGoogleFallback" data-mysync="google">' +
            'Sign in with Google</button>' +
        '</div>' +
        /* Google drawing its button is not the same as Google accepting it:
           on an origin the client does not allow, the button appears and then
           refuses, and the only sign is a line in the console nobody is
           reading. That is not a hypothetical — the console warns it deletes
           clients unused for six months. So the old way in stays reachable,
           quietly, whenever theirs is the one on screen. */
        '<button class="sync-alt hide" id="myGoogleAlt" data-mysync="google">' +
          'Trouble signing in? Try the older way</button>' +
        /* Kept, because a Google account is not a thing everybody has and this
           is going out to strangers — but folded, because for nearly everybody
           the button above is the entire answer. */
        '<details class="sync-fold"><summary>No Google account?</summary>' +
          '<div class="sync-row">' +
            '<input class="txt" id="myJoin" type="email" inputmode="email" ' +
              'placeholder="your email address" aria-label="Email address" value="' +
              esc(S.myJoin) + '">' +
            '<button class="ghost" data-mysync="email">Send a link</button>' +
          '</div>' +
        '</details>';
    }
    return body +
      (S.myNote ? '<div class="sync-warn">' + esc(S.myNote) + '</div>' : '') +
      (S.myErr ? '<div class="sync-warn">' + esc(S.myErr) + '</div>' : '') +
      /* Only once there is an account to have a state. Signed out, this said
         "on this device only" directly above the pantry card saying exactly
         the same words about a different thing, which reads as one status
         stuttering rather than two facts. The button already says the state. */
      (who || waiting || away
        ? '<div class="sync-status"><span class="dot' +
          (LIVE.S_SYNC_STATE === 'on' ? ' on' : LIVE.S_SYNC_STATE === 'error' ? ' off'
            : LIVE.S_SYNC_STATE === 'connecting' ? ' wait' : '') + '"></span>' + esc(word) + '</div>'
        : '');
  }

  return { mAccountBlockHTML: mAccountBlockHTML };
};
