/* What the picker's box was asked when what was typed is not a name: a
 * number of calories or grams (mQueryKind), and the band that answers it,
 * drawn above the rest of the list (mQueryTopHTML). The longer account is
 * with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.query(app) once, as it starts, and keeps what it gives back
 * under the same names. The recipes (RECIPES) are replaced as they change,
 * so the part reads them through LIVE (tests/scope.test.js holds the lists
 * to each other). Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).query = function (app) {
  'use strict';

  // what it reads of the app's, and (LIVE) what the app replaces as it goes: RECIPES
  var fmtNum = app.fmtNum;
  var mDefaultX = app.mDefaultX;
  var mMacLine = app.mMacLine;
  var mRank = app.mRank;
  var mSaltNote = app.mSaltNote;
  var mpRowHTML = app.mpRowHTML;
  var LIVE = app.LIVE;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* What the box was asked, when what was typed is not a name.
   *
     A recipe number is the fastest way in that exists, and it was not wired
     to anything. Every recipe in the two printed volumes carries one — "No.
     142" on the card, on the page and in the contents — so a person standing
     over the open book already has the answer in front of them and had to
     type its title instead.

     Books 1 and 2 only, deliberately. The Ours shelf gets its numbers
     assigned at boot (`if (r.book === 3) r.no = ++n`), starting again at 1,
     so Ours No. 1 and the printed No. 1 are two different dishes wearing the
     same badge. Only one of those numbers is printed on a page, and that is
     the one somebody is reading off.

     Eight digits or more is nobody's recipe number; it is a barcode, and the
     scanner already knows what to do with one. Typing it is the same act as
     pointing a camera at it, so it gets the same answer. */
  function mQueryKind(q) {
    var t = String(q || '').trim();
    if (/^[0-9]{8,}$/.test(t)) return { k: 'barcode', v: t };
    if (/^[0-9]{1,3}$/.test(t)) return { k: 'no', v: parseInt(t, 10) };
    return { k: 'text', v: t };
  }

  function mNumberHit(n) {
    var hit = null;
    LIVE.RECIPES.forEach(function (r) {
      /* Ours numbers are not printed on anything, so they are not what a
         person reading a number off a page has typed.
       *
         Honest note: this clause is belt-and-braces, not the thing doing the
         work. rebuild() lays the printed books down first and pushes the
         shelf after, so first-match already answers with the printed one —
         deleting this line leaves the suite green, which is how that was
         found out. It stays because it states the rule; if the order ever
         changes it becomes the rule. */
      if (hit || r.book === 3) return;
      if (Number(r.no || r.id) === n) hit = r;
    });
    return hit;
  }

  /* The band that answers a number, drawn above whatever the list was going
     to say. It does not replace the list: the number may be a typo, and a
     picker that goes blank on a mistyped digit is worse than one that shows
     you the recipe you meant plus everything else. */
  function mQueryTopHTML(q, day, targets, pick) {
    var kind = mQueryKind(q);
    if (kind.k === 'barcode') {
      return '<div class="mt-div">Barcode</div>' +
        '<button class="mpick-row mpick-new" data-nfcode="' + esc(kind.v) + '">' +
          '<span class="mp-body"><span class="mp-name">Look up ' + esc(kind.v) + '</span>' +
          '</span></button>';
    }
    if (kind.k !== 'no') return '';
    var r = mNumberHit(kind.v);
    if (!r) return '';
    var e = mRank([r], day, targets, pick)[0];
    var x0 = mDefaultX(r);
    return '<div class="mt-div">Recipe no. ' + esc(String(kind.v)) + '</div>' +
      mpRowHTML(r, x0, e && e.score === null ? 'no data'
        : '&times;' + fmtNum(x0) + ' &middot; ' + mMacLine(r, x0, true) + mSaltNote(r, x0),
        e && e.score !== null ? e.x : null);
  }

  return { mQueryKind: mQueryKind, mQueryTopHTML: mQueryTopHTML };
};
