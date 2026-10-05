/* The food picker's sheet: which meal it is filling when opened from the
 * bar, the next one by the clock (mNextMeal); opening it (mOpenPicker);
 * the meal chooser, shown only when it was opened from the bar; and the
 * sheet itself, search over a list ranked by fit (macroPickerHTML). The
 * longer account is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.picksheet(app) once, as it starts, and keeps what it gives back
 * under the same names. Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).picksheet = function (app) {
  'use strict';

  // what it reads of the app's
  var S = app.S;
  var mDay = app.mDay;
  var mMealSheetParts = app.mMealSheetParts;
  var mNowMins = app.mNowMins;
  var mReadSlots = app.mReadSlots;
  var mSlotOpens = app.mSlotOpens;
  var mSlotSecs = app.mSlotSecs;
  var mSlotW = app.mSlotW;
  var mViewKey = app.mViewKey;
  var mpHomeBodyHTML = app.mpHomeBodyHTML;
  var mpIcon = app.mpIcon;
  var mpShelvesHTML = app.mpShelvesHTML;
  var pushSheet = app.pushSheet;
  var rememberOpener = app.rememberOpener;
  var renderModal = app.renderModal;
  var todayKey = app.todayKey;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Which meal the sheet is filling, when you opened it from the bar rather
     than from a meal: the first one not finished — starting, today, at the
     meal whose time it is. It started at the top of the day and was said to
     need no clock, and "Add food" at six in the evening on a day with
     nothing on it opened "Add to Breakfast". The meal whose time it is is
     the latest to have opened (mSlotOpens); from there the walk goes on to
     the end of the day and comes round to the first unfinished, as it was. */
  function mNextMeal() {
    var vk = mViewKey(), day = mDay(vk), slots = mReadSlots(), list = slots.list, pick = null;
    var from = 0;
    if (vk === todayKey()) {
      var now = mNowMins(), best = -1;
      list.forEach(function (sl, i) {
        var at = mSlotOpens(list, i);
        if (at <= now && at > best) { best = at; from = i; }
      });
    }
    var open = function (sl) {
      var items = day[sl.k] || [];
      return !items.length || !items.every(function (it) { return it.eaten; });
    };
    list.slice(from).concat(list.slice(0, from)).forEach(function (sl) {
      if (!pick && open(sl)) pick = sl;
    });
    return pick || list[list.length - 1];
  }

  function mOpenPicker(slotKey, mode) {
    var srec = null;
    mReadSlots().list.forEach(function (sl) { if (sl.k === slotKey) srec = sl; });
    if (!srec) srec = mNextMeal();
    if (!srec) return;
    rememberOpener();
    S.macroPick = { slot: srec.k, n: srec.n, secs: mSlotSecs(srec), w: mSlotW(srec) };
    S.mpSec = 'meal';
    S.mpSort = 'fit';
    /* ONE query. There were two — S.mpQuery behind the Recipes box and
       S.mpLook behind the Look up box — with near-identical placeholders and
       no shared state, so typing "chicken" into one and switching to the
       other silently threw the word away and asked for it again. */
    S.mpQuery = '';
    S.mpShelf = '';
    S.mpMode = mode || 'home';
    /* What a tap put on the meal during THIS visit, by id: the rows that
       wear the ✓, and what a second tap takes back off (app.js). */
    S.mpBasket = {};
    S.mpAt = {};
    S.mpSwap = null;
    S.mMenu = '';
    S.mType = null;
    pushSheet({ m: 1 });
    renderModal();
  }

  /* The meal sheet: the ONE place food is added or changed.
   *
     Blake, 2026-10-04: "ONE way to add and select food" — there were four
     and more (the day bar's Add food, each meal's Add foods, its camera,
     Fill, the picker's basket). So a meal opens here, from its tray: the
     meal's own header (its tick, Balance, its ⋯), its pills against its
     share, and its foods as compact rows dialled in grams (myday.js,
     mMealSheetParts); then the picker as it always was — the search with
     the barcode in it, the shelves, Recent, Fits best — where a tap puts a
     food straight onto the meal. No basket and no "Add N": what you tap is
     on the meal, and a second tap takes it back off.
   *
     Pinned: the header and the pills always (Blake: "make the top sticky so
     the filter icons and search bar and macros stay in view"), and the
     search box and the shelves under them once the foods have scrolled
     away — all three this time, because the rows are small enough to leave
     the list most of the screen. --msh-top is the pinned header's height,
     measured after each draw (app.js), so the second pin sits under it.
   *
     Mockup: https://claude.ai/artifact/SseR1TPa4JAFNanYYsGP4k */
  function macroPickerHTML() {
    var sk = S.macroPick.slot;
    var P = mMealSheetParts(sk);
    var wrap = function (inner) {
      return '<div class="scrim no-print" data-close="1">' +
        '<div class="sheet mp-sheet msheet" role="dialog" aria-modal="true" aria-label="' + esc(P.name) + '">' +
        '<div class="msh-top">' + P.head + (P.stick || '') + '</div>' + inner + '</div></div>';
    };
    if (P.skipped) return wrap(P.body);

    if (S.mpMode === 'scan') {
      /* One way back, because the three tiles that used to offer it are gone.
         It says where it goes rather than naming a mode nobody chose. */
      return wrap('<button class="mp-back" data-mpmode="home">&lsaquo; Back to the list</button>' +
        '<div id="scanRoot"></div>' +
        '<div class="mp-controls">' +
          '<input type="search" class="txt" id="nfFind" inputmode="numeric" ' +
            'placeholder="&hellip;or type the number" aria-label="Barcode number">' +
          '<button class="ghost" data-nf="code">Go</button>' +
        '</div>' +
        '<div id="nfResults"></div>' +
        '<button class="mpick-row mpick-new" data-mpnew="1">' +
          '<span class="mp-body"><span class="mp-name">&#43; Type it in yourself</span></span></button>');
    }

    /* Everything that is not the camera. 'look' and 'recipes' fall through
       to here: S.mpMode can still hold either — a phone that reloads
       mid-session, an old value read back from anywhere — and neither
       should be an error. */
    var body = mpHomeBodyHTML();
    return wrap(P.rows +
      /* The camera sits INSIDE the field rather than beside it. As a flex
         sibling it drops onto its own row on every phone. */
      '<div class="mp-stick msh-find">' +
        '<div class="mp-controls mp-find">' +
          '<input type="search" class="txt" id="mpFind" ' +
            'placeholder="Search, barcode, or recipe no.&hellip;" ' +
            'aria-label="Search" value="' + esc(S.mpQuery) + '">' +
          (navigator.mediaDevices && navigator.mediaDevices.getUserMedia
            ? '<button class="mp-cam" data-mpmode="scan" aria-label="Scan a barcode">' +
              mpIcon('scan') + '</button>' : '') +
        '</div>' +
        mpShelvesHTML() +
      '</div>' +
      '<div id="mpList">' + body + '</div>' +
      '<button class="mpick-row mpick-new" data-mpnew="1">' +
        '<span class="mp-body"><span class="mp-name">&#43; Type it in yourself</span></span></button>');
  }

  return { mNextMeal: mNextMeal, mOpenPicker: mOpenPicker, macroPickerHTML: macroPickerHTML };
};
