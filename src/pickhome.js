/* The picker's home list, in one place (mpHomeBodyHTML): the bands in
 * order, worked out once per list; the way to a food the storehouse has
 * never heard of; and redrawing only the list while you type, never the
 * sheet, with the shelf rail following the query (refreshMacroPicker). The
 * longer account is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.pickhome(app) once, as it starts, and keeps what it gives back
 * under the same names. What you logged last time and what you reach for
 * (MP_LASTX, MP_KNOWN) stay declared in app.js; the part fills them each
 * list, through LIVE (tests/scope.test.js holds the lists to each other).
 * Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).pickhome = function (app) {
  'use strict';

  // what it reads of the app's, and (LIVE) what the app replaces as it goes: MP_KNOWN, MP_LASTX
  var S = app.S;
  var keepingFocus = app.keepingFocus;
  var mDay = app.mDay;
  var mDayTargets = app.mDayTargets;
  var mQueryKind = app.mQueryKind;
  var mQueryTopHTML = app.mQueryTopHTML;
  var mViewKey = app.mViewKey;
  var mpComboHTML = app.mpComboHTML;
  var mpElseHTML = app.mpElseHTML;
  var mpFitsHTML = app.mpFitsHTML;
  var mpKnownIds = app.mpKnownIds;
  var mpLastXs = app.mpLastXs;
  var mpNamedHTML = app.mpNamedHTML;
  var mpPinsHTML = app.mpPinsHTML;
  var mpQ = app.mpQ;
  var mpRecentHTML = app.mpRecentHTML;
  var mpShelvesHTML = app.mpShelvesHTML;
  var LIVE = app.LIVE;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function $(id) { return document.getElementById(id); }

  /* Only the list under the search box redraws while you type — redrawing the
     sheet would fight the cursor for the input. refreshPreview() set the
     pattern. */
  /* The way to a food the storehouse has never heard of.
   *
     The live lookup has been in here all along — it is what fills a packet's
     numbers in from the USDA — but the only thing that ever called it was the
     search box inside the "Look up" tile, and the tiles went in v283. The
     function survived; the door did not. So typing a food the book does not
     stock ended at "Nothing matches american cheese." with the one thing that
     could have answered it sitting a function call away, and the app looked
     like it had lost a feature it had merely stopped offering.
   *
     A row rather than an automatic fetch: the tables are somebody else's
     server and every keystroke is not a question. Three characters because
     that is what the old box asked for, and a barcode is left to mQueryTopHTML
     — it already offers that one, and two rows saying "look this up" is the
     tile problem coming back in miniature. */
  function mpLookFootHTML() {
    var q = S.mpQuery.trim();
    if (q.length < 3 || mQueryKind(q).k === 'barcode') return '';
    /* The row that asked is gone; the fetch happens on its own now. Blake:
       "when I do a food search, why doesn't it automatically show me foods
       from the database that are best matches?" — and the note on the input
       handler had described exactly that all along ("they answer when they
       answer, underneath, and only once you have stopped typing long enough
       to mean it") without anything ever calling mLookNet but a button.
     *
       The objection the button existed for is real and is answered by the
       debounce rather than by a tap: somebody else's server sees one request
       per word you finish, not one per keystroke. mLookNet already drops
       late replies, so a slow answer to "tam" cannot land on top of the
       results for "tamale". The retry lives in the failure text. */
    return '<div id="nfResults"></div>';
  }

  /* The home list, in ONE place.
   *
     It was composed twice — once when the sheet is drawn and once on every
     keystroke — and the two copies are exactly the kind of pair this app has
     been bitten by all week: they have to agree, nothing makes them, and a
     row added to one is a row missing from the other for as long as nobody
     notices. */
  function mpHomeBodyHTML() {
    var shown = {};
    /* Composed in one order and PRINTED in another, and the difference is
       load-bearing.
     *
       `shown` is claimed in composition order, so whichever band runs first
       owns a dish and the ones after it step over. The closers have to run
       before Fits best or Fits best would list the very foods that close the
       meal and leave the band with nothing to say.
     *
       But on screen it is the other way round. Blake: "real food then macro
       fill/math suggestions". An untouched meal opening on three single foods
       put the arithmetic above the cooking — the recipes are what a meal
       actually is, and they were a quarter of a phone screen further down
       than the levers that close it. So the claim order is unchanged and the
       output order is reversed, which costs nothing and moves the dishes up.
     *
       The alternative was suppressing the closers on an untouched meal, and
       it was worse: it deleted a three-tap way to land the macros exactly, on
       the one screen where somebody eating to a number wants it most. */
    LIVE.MP_KNOWN = mpKnownIds();
    LIVE.MP_LASTX = mpLastXs();
    var named = mpNamedHTML(shown);
    var pins = mpPinsHTML(shown);
    var recent = mpRecentHTML(shown);
    var closers = mpComboHTML(shown);
    var fits = mpFitsHTML(shown);
    /* The USDA's answers come straight after the foods in the app that the
       words found, not under every recipe: Blake picked the search list in
       mockup I (2026-10-07), and "chicken breast" had put the one USDA row
       below twenty-two recipes. The box is drawn here empty and filled when
       the USDA answers, so the rows under it move down when the answer
       lands; under the foods they move far less than a screen of recipes
       would have hidden it. */
    var look = mpLookFootHTML();
    var body = named + look + pins + recent + fits + closers + mpElseHTML(shown);
    /* Judged on the ROWS, not on the string. A barcode with nothing behind it
       draws a band and no rows, and so does a shelf crossed with a lens that
       has nothing in it — and the Fits band now keeps its divider either way,
       because the lens and the order live on it and they are the way back out
       of the thing that emptied the list. Counting characters would read
       either of those as a list with something in it. Every band writes the
       rows it drew into `shown`, so that is the count. */
    if (!Object.keys(shown).length) {
      body += '<div class="mslot-empty">' + (mpQ()
        ? 'Nothing matches ' + esc(S.mpQuery.trim()) + '.'
        : S.mpShelf || S.mpSec !== 'meal'
          ? 'Nothing here in this lens.'
          : 'Nothing to offer for this meal yet.') + '</div>';
    }
    return mQueryTopHTML(S.mpQuery, mDay(mViewKey()), mDayTargets(mViewKey()),
      { k: S.macroPick.slot, w: S.macroPick.w }) + body;
  }

  /* Rebuilds ONLY the list, never the sheet.
   *
     This is what keeps the search box alive across a keystroke: the input is
     a sibling of #mpList, not inside it, so replacing the list cannot take
     the focus or the caret with it. A renderModal here would redraw the box
     mid-word.
   *
     Dispatches on mode because #mpList now exists in two of them and holds
     different things: the resting screen's four narrowed bands, or the
     Recipes lens's own ranked list. */
  /* The rail follows the query, and nothing else.
   *
     refreshMacroPicker rebuilds ONLY the list — that is what keeps the search
     box alive across a keystroke — so the chips went on describing the pool
     as it was before you typed. They are rebuilt here when the query changes
     and only then: a chip press re-renders the list too, and rebuilding the
     rail under a thumb that has just pressed one would take the press with
     it. The rail remembers what it was built for, so the comparison lives on
     the element rather than in a variable that can go stale behind a sheet
     being closed and opened. */
  function mRailSync() {
    var rail = $('mpShelves');
    if (!rail) return;
    var q = mpQ();
    if (rail.getAttribute('data-q') === q) return;
    keepingFocus(function () {
      var tmp = document.createElement('div');
      tmp.innerHTML = mpShelvesHTML();
      var next = tmp.firstChild;
      if (!next) return;
      next.setAttribute('data-q', q);
      rail.parentNode.replaceChild(next, rail);
    });
  }

  function refreshMacroPicker() {
    var el = $('mpList');
    if (!el) return;
    mRailSync();

    el.innerHTML = mpHomeBodyHTML();
  }

  return { mpHomeBodyHTML: mpHomeBodyHTML, refreshMacroPicker: refreshMacroPicker };
};
