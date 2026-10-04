/* A meal from another day: what a meal on that day held (mCopyItems), a
 * meal's name (mSlotName), and the sheet that offers them, day by day
 * (mCopyFromHTML). The longer account is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.copyfrom(app) once, as it starts, and keeps what it gives back
 * under the same names. The recipes by id (BY_ID) are read through LIVE
 * (tests/scope.test.js holds the lists to each other). Loaded before
 * app.js.
 */
(window.HiveParts = window.HiveParts || {}).copyfrom = function (app) {
  'use strict';

  // what it reads of the app's, and (LIVE) what the app replaces as it goes: BY_ID
  var MDAYS = app.MDAYS;
  var S = app.S;
  var mEarliestKey = app.mEarliestKey;
  var mIcon = app.mIcon;
  var mLatestKey = app.mLatestKey;
  var mLongDate = app.mLongDate;
  var mPortionText = app.mPortionText;
  var mPretty = app.mPretty;
  var mReadSlots = app.mReadSlots;
  var mViewKey = app.mViewKey;
  var todayKey = app.todayKey;
  var LIVE = app.LIVE;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---- a meal from another day
   *
     Repeat a meal fast: the same meal on a day behind you, whole, in one
     tap. Blake: "'Copy from another day' on each meal, and a date picker
     beyond two weeks." The list is the latest days that had food on this
     meal; the date box reaches any day the log keeps. Each plate comes at
     the amount it was, and whether it arrives eaten is the rule every add
     follows (mAddsEaten): a meal whose time has come is eaten, a later one
     planned. */
  function mCopyItems(fromK, sk) {
    return ((MDAYS[fromK] || {})[sk] || []).filter(function (it) {
      return LIVE.BY_ID[it.id] && Number(it.x) > 0;
    });
  }
  function mSlotName(sk) {
    var slots = mReadSlots(), n = slots.names[sk] || 'Meal';
    slots.list.forEach(function (sl) { if (sl.k === sk) n = sl.n; });
    return n;
  }
  function mCopyCardHTML(fromK, sk) {
    var items = mCopyItems(fromK, sk), kc = 0;
    items.forEach(function (it) { kc += ((LIVE.BY_ID[it.id].macro || {}).kcal || 0) * it.x; });
    return '<div class="mcf-day">' +
      '<div class="mcf-h"><span class="mcf-d">' + esc(mLongDate(fromK)) + '</span>' +
        (items.length ? '<span class="mcf-k">' + Math.round(kc).toLocaleString() + ' kcal</span>' : '') + '</div>' +
      (items.length
        ? '<ul class="mcf-items">' + items.map(function (it) {
            var r = LIVE.BY_ID[it.id];
            return '<li><span class="mcf-n">' + esc(r.name) + '</span>' +
              '<span class="mcf-x">' + esc(mPortionText(r, it.x)) + '</span></li>';
          }).join('') + '</ul>' +
          '<button class="ghost mcf-go" data-mcopy="' + fromK + '">' + mIcon('plus') +
            (items.length === 1 ? 'Add it' : 'Add all ' + items.length) + '</button>'
        : '<div class="mslot-empty">Nothing on ' + esc(mSlotName(sk)) + ' that day.</div>') +
    '</div>';
  }
  function mCopyFromHTML() {
    var o = S.mCopyFrom || {}, k = mViewKey(), sk = o.slot, name = mSlotName(sk);
    var today = todayKey(), recent = [];
    Object.keys(MDAYS).sort().reverse().forEach(function (dk) {
      if (dk === k || dk > today || recent.length >= 7) return;
      if (mCopyItems(dk, sk).length) recent.push(dk);
    });
    var picked = o.day && o.day !== k ? o.day : '';
    return '<div class="scrim no-print" data-close="1">' +
      '<div class="sheet mt-sheet mcf-sheet" role="dialog" aria-modal="true" aria-label="' +
        esc(name) + ' from another day">' +
        '<div class="sheet-top">' +
          '<div class="sheet-eyebrow">To ' + esc(name) + ' &middot; ' + esc(mPretty(k)) + '</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="mfs-name">' + esc(name) + ' from another day</div>' +
        '<label class="mcf-pick">Any day <input type="date" id="mcfDate" min="' + mEarliestKey() +
          '" max="' + mLatestKey() + '" value="' + picked + '"></label>' +
        (picked ? mCopyCardHTML(picked, sk) : '') +
        (recent.length
          ? '<div class="mt-div">Lately</div>' + recent.filter(function (dk) { return dk !== picked; })
              .map(function (dk) { return mCopyCardHTML(dk, sk); }).join('')
          : picked ? '' : '<div class="mslot-empty">Nothing on ' + esc(name) + ' in the days behind you yet.</div>') +
      '</div></div>';
  }

  return { mCopyItems: mCopyItems, mSlotName: mSlotName, mCopyFromHTML: mCopyFromHTML };
};
