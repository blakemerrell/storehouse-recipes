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
  var M_MONS = app.M_MONS;
  var S = app.S;
  var keyDate = app.keyDate;
  var mBasketBarHTML = app.mBasketBarHTML;
  var mDay = app.mDay;
  var mMealLeft = app.mMealLeft;
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
    S.mpBasketOpen = false;
    S.mpMode = mode || 'home';
    S.mpBasket = {};
    pushSheet({ m: 1 });
    renderModal();
  }

  /* The chooser, shown only when the sheet was opened from the bar. Coming in
     through a meal's own + Add has already answered the question, and asking
     it again would be the app forgetting what you just told it. */
  function mMealPickHTML() {
    if (!S.mpFromBar) return '';
    var day = mDay(mViewKey());
    return '<div class="mp-meals">' + mReadSlots().list.map(function (sl) {
      var n = (day[sl.k] || []).length;
      return '<button data-mpslot="' + esc(sl.k) + '" aria-pressed="' +
        (sl.k === S.macroPick.slot ? 'true' : 'false') + '">' + esc(sl.n) +
        (n ? '<i>' + n + '</i>' : '') + '</button>';
    }).join('') + '</div>';
  }

  /* The picker sheet: search plus a meal/all toggle, over a list ranked by
     fit. Search narrows what is ranked; it does not outrank the fit, because
     somebody typing "chicken" into a macro picker still wants the portion
     that suits the day, not the best textual match at any size. */
  function macroPickerHTML() {
    var name = S.macroPick.n;
    var d = keyDate(mViewKey());
    var head = '<div class="sheet-top">' +
        /* Swapping is the same sheet for one pick, and it says which plate. */
        '<div class="sheet-eyebrow">' + (S.mpSwap ? 'Swap ' + esc(S.mpSwap.n) + ' · ' : 'Add to ' + esc(name) + ' · ') +
          M_MONS[d.getMonth()] + ' ' + d.getDate() + '</div>' +
        /* The count chip and the Add button both left this header for the bar
           along the bottom. They were the first thing in the sheet and the
           header has no position, so the one control that commits a basket
           scrolled off the moment you moved down the list to fill it — while
           the one element pinned to the bottom of the screen, where a thumb
           actually rests, carried no control at all. The chip did not follow
           them: "Add 3" already carries the count, and the basket panel above
           already lists what the three are. */
        '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
      '</div>';
    /* The basket rides above whatever list you are in, not only on the first
       screen. Searching, ticking three things and being unable to see which
       three is the complaint that put it here — a count in the header is not
       an answer to "what have I got". */
    var wrap = function (inner) {
      return '<div class="scrim no-print" data-close="1">' +
        /* mp-sheet, and only this sheet: a column, so the bar along the
           bottom can be pushed to the bottom of a SHORT one. Sticky only ever
           pulls an element up from where the flow put it, and the phone rule
           gives every sheet min-height:100%, so a list of two rows left the
           bar floating mid-card with 438 measured pixels of empty sheet below
           it. Harmless while it was two lines of grey text; not harmless now
           that it is the only way to commit. Nine other sheets share .sheet
           and none of them want this. */
        '<div class="sheet mp-sheet" role="dialog" aria-modal="true" aria-label="Add to ' + esc(name) + '">' +
        head + mMealPickHTML() + inner + mBasketBarHTML() + '</div></div>';
    };

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

    /* 'look' and 'recipes' are gone. Each was a whole screen that replaced
       the ranked bands with a flat list, and each had its own search box:
       three boxes, three states, and typing in any of them threw away the
       thinking the sheet had done. One box on the resting screen does both
       jobs now, and the section lens that only 'recipes' could offer rides
       the Fits best divider.
     *
       They fall through to home rather than being errors, because S.mpMode
       can still hold either — a phone that reloads mid-session, or an old
       value read back from anywhere. */
    /* Everything that is not the camera. 'look' and 'recipes' used to be two
       more branches here and land in the same place now, which is why this is
       a fall-through rather than a test for 'home': S.mpMode can still hold
       either — a phone that reloads mid-session, an old value read back from
       anywhere — and neither should be an error. */
    {
      /* What is left of the meal, said once at the top. It is the number you
         are shopping against, and it used to be readable only by closing the
         sheet you opened to go shopping. */
      var rem = mMealLeft();
      /* One set, threaded through the bands in the order they are drawn, so
         a dish that is pinned AND recent AND the best fit appears once —
         under the first heading that has a claim on it. */
      /* The answer to a typed number or barcode belongs IN the list, at the
         top of it: it is a result, not a chrome. It sat in a sibling div so
         the keystroke path could repaint it separately, which cost a special
         case in refreshMacroPicker and put it outside the element every other
         row lives in. Rebuilt with the list now, for free. */
      /* Home had no empty state at all: every band returns '' when it has
         nothing, so a query that matches nothing rendered the gap panel and
         the type-it-in row with a silence between them. */
      var body = mpHomeBodyHTML();
      return wrap(
        /* Pinned: what the meal still wants, and the box you search with.
         *
           Blake: "make the top sticky so the filter icons and search bar and
           macros stay in view." All three is 280 px of a 560 px sheet — half
           the screen held still on a list whose whole job is to be scrolled.
           So two of the three. The search box earns it by being the main
           control and the first thing lost to a flick. The pills earn it now
           they count THIS meal: pinned, they fall toward zero as you pick, so
           you can watch the meal close without scrolling back up.

           The shelves are left to scroll. A filter is something you set and
           then read past, and keeping them costs 75 px on every screen to
           save one scroll-up per change of mind. */
        '<div class="mp-stick">' +
        (rem ? '<div class="mp-left">' + rem + '</div>' : '') +
        /* One box, in the sheet you were already looking at. Its results do
           not replace what is under it — the bands narrow and anything else
           the query finds is appended, so the thinking the sheet did for you
           survives being searched. */
        /* The camera sits INSIDE the field rather than beside it. As a flex
           sibling it drops onto its own row on every phone — the narrow rule
           gives .txt flex-basis 100% — and costs another 35px of a header
           that has to earn every pixel. */
        '<div class="mp-controls mp-find">' +
          '<input type="search" class="txt" id="mpFind" ' +
            'placeholder="Search, barcode, or recipe no.&hellip;" ' +
            'aria-label="Search" value="' + esc(S.mpQuery) + '">' +
          (navigator.mediaDevices && navigator.mediaDevices.getUserMedia
            ? '<button class="mp-cam" data-mpmode="scan" aria-label="Scan a barcode">' +
              mpIcon('scan') + '</button>' : '') +
        '</div>' +
        '</div>' +
        mpShelvesHTML() +
        '<div id="mpList">' + body + '</div>' +
        '<button class="mpick-row mpick-new" data-mpnew="1">' +
          '<span class="mp-body"><span class="mp-name">&#43; Type it in yourself</span></span></button>');
    }

  }

  return { mNextMeal: mNextMeal, mOpenPicker: mOpenPicker, macroPickerHTML: macroPickerHTML };
};
