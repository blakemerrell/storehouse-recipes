/* My Day, drawn: renderMacros, which keeps the weight box's focus across a
 * redraw, the day picker (mDayPick), and the day itself (mRenderDay), its
 * week strip, weigh-in card, meals with their plates, pills and the line
 * that says where the slack went, and the foot. The longer account is with
 * the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.myday(app) once, as it starts, and keeps what it gives back
 * under the same names. The recipes by id (BY_ID) are replaced as they
 * change, the day last drawn (mDrawnToday) is set as it draws, and
 * MCASCADE_MIN is declared further down app.js, so the part reaches those
 * through LIVE (tests/scope.test.js holds the lists to each other). Loaded
 * before app.js.
 */
(window.HiveParts = window.HiveParts || {}).myday = function (app) {
  'use strict';

  // what it reads of the app's, and (LIVE) what the app replaces as it goes: BY_ID, MCASCADE_MIN, mDrawnToday
  var MDAYS = app.MDAYS;
  var MWEIGHTS = app.MWEIGHTS;
  var M_MONS = app.M_MONS;
  var S = app.S;
  var WGAPI = app.WGAPI;
  var dayKey = app.dayKey;
  var kcalOf = app.kcalOf;
  var leaf = app.leaf;
  var mAhead = app.mAhead;
  var mBatchStrip = app.mBatchStrip;
  var mCanFav = app.mCanFav;
  var mCascadeLineHTML = app.mCascadeLineHTML;
  var mDay = app.mDay;
  var mDayTargets = app.mDayTargets;
  var mDialUnit = app.mDialUnit;
  var mDialFromX = app.mDialFromX;
  var mDialG = app.mDialG;
  var mDialMeasure = app.mDialMeasure;
  var mDialText = app.mDialText;
  var mDoneAt = app.mDoneAt;
  var mEarliestKey = app.mEarliestKey;
  var mEditDay = app.mEditDay;
  var mFillRoom = app.mFillRoom;
  var mFoldForget = app.mFoldForget;
  var mIcon = app.mIcon;
  var mIsFav = app.mIsFav;
  var mLatestKey = app.mLatestKey;
  var mLongDate = app.mLongDate;
  var mMacLine = app.mMacLine;
  var mMarkAccountUI = app.mMarkAccountUI;
  var mMealAsk = app.mMealAsk;
  var mMealPillsSay = app.mMealPillsSay;
  var mReadSlots = app.mReadSlots;
  var mSaltChip = app.mSaltChip;
  var mServeG = app.mServeG;
  var mSkipped = app.mSkipped;
  var mSnapTargets = app.mSnapTargets;
  var mViewKey = app.mViewKey;
  var mWeekHTML = app.mWeekHTML;
  var mWhyChip = app.mWhyChip;
  var mWhyStrip = app.mWhyStrip;
  var macroFootHTML = app.macroFootHTML;
  var macroWeighHTML = app.macroWeighHTML;
  var syncShrunk = app.syncShrunk;
  var todayKey = app.todayKey;
  var LIVE = app.LIVE;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function $(id) { return document.getElementById(id); }

  /* Redrawing the day removes the box the weight is typed into, and removing
     a focused input fires blur, and blur fires change, and change asks for
     another redraw — arriving in the middle of the first one, whose own
     removal then finds its node already gone. The browser says so plainly:
     "the node to be removed is no longer a child of this node". One redraw
     at a time. */
  var mRendering = false;
  function renderMacros() {
    if (mRendering) return;
    LIVE.mDrawnToday = todayKey();
    mSnapTargets();
    mRendering = true;
    try { mRenderDay(); } finally { mRendering = false; }
  }

  function mDayPick(open) {
    var row = $('macroDayPick').closest('.mday-pick');
    row.classList.toggle('hide', !open);
    if (!open) return;
    var inp = $('macroDayPick');
    inp.value = mViewKey();
    inp.focus();
    try { if (inp.showPicker) inp.showPicker(); } catch (e) { /* the box itself is the way in */ }
  }

  /* ---- one meal, as the tray and the sheet both read it ---- */

  var LOCK_SM = '<svg class="mcard-lk" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.4" y="7" width="9.2" height="6.4" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.6 7V5.1a2.4 2.4 0 0 1 4.8 0V7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  var ICO = function (d) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + d + '</g></svg>';
  };
  var I_LOCK = ICO('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>');
  var I_OPEN = ICO('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.6-1.7"/>');
  var I_SWAP = ICO('<path d="M4 8h13"/><path d="M14 4.5 17.5 8 14 11.5"/><path d="M20 16H7"/><path d="M10 12.5 6.5 16l3.5 3.5"/>');
  var I_PIN = ICO('<path d="M8.5 3.5h7M12 3.5v6.4M9.6 9.9c-.6 2.5-2.2 4-3.9 4.6h12.6c-1.7-.6-3.3-2.1-3.9-4.6Z"/><path d="M12 14.5v6"/>');
  var I_STAR = ICO('<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8Z"/>');
  var I_WEIGH = ICO('<path d="M4 20h16l-2-11H6z"/><circle cx="12" cy="6" r="2"/><path d="M10 14h4"/>');
  var I_BIN = ICO('<path d="M4 7h16"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l1 12.5h9l1-12.5"/><path d="M10.5 11v5"/><path d="M13.5 11v5"/>');
  var I_DOTS = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></g></svg>';
  var I_MINUS = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var I_PLUS = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2v8M2 6h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var I_UP = ICO('<path d="M6 15l6-6 6 6"/>');
  var I_DOWN = ICO('<path d="M6 9l6 6 6-6"/>');

  var fmtK = function (n) { return Math.round(n).toLocaleString('en-US'); };

  /* Millilitres beside a cup or a spoon, for eyeballing with a measuring
     jug: "1 ½ cups · 355 mL". Read off the measure as it is printed
     (fmtNum's eighths), so the two can never disagree. US cup and spoons. */
  var ML_PER = { cup: 236.6, cups: 236.6, tbsp: 14.8, tsp: 4.9 };
  var EIGHTHS = { '⅛': 0.125, '¼': 0.25, '⅜': 0.375, '½': 0.5, '⅝': 0.625, '¾': 0.75, '⅞': 0.875 };
  function mlOf(measure) {
    var m = /^(\d+)?\s?([⅛¼⅜½⅝¾⅞])?\s+(cups?|tbsp|tsp)$/.exec(String(measure || ''));
    if (!m || (!m[1] && !m[2])) return '';
    var ml = ((m[1] ? Number(m[1]) : 0) + (m[2] ? EIGHTHS[m[2]] : 0)) * ML_PER[m[3]];
    return (ml >= 50 ? Math.round(ml / 5) * 5 : Math.max(1, Math.round(ml))) + ' mL';
  }

  /* What Balance moved and what the picker just put down, on this meal, if
     the plates are still the plates they were (a sync can reorder them). */
  function marksFor(k, sk, items) {
    var m = S.mMarks, out = { was: {}, fresh: {}, snap: null, n: 0 };
    if (!m || m.k !== k || m.sk !== sk) return out;
    Object.keys(m.was || {}).forEach(function (i) {
      var w = m.was[i];
      if (items[i] && String(items[i].id) === String(w.id) && items[i].x !== w.x) { out.was[i] = w.x; out.n++; }
    });
    Object.keys(m.fresh || {}).forEach(function (i) {
      if (items[i] && String(items[i].id) === String(m.fresh[i])) out.fresh[i] = 1;
    });
    if (m.snap) out.snap = m.snap;
    return out;
  }

  /* The meal's four, against its share: the figure over the target, filled
     toward it and coloured by where it stands. */
  function capsHTML(sub, aim, spent, capped) {
    if (!aim) return '';
    spent = spent || {};
    var c = [['kcal', '🔥', ''], ['p', 'P', 'mb-p'], ['f', 'F', 'mb-f'], ['c', 'C', 'mb-c']].map(function (x) {
      /* A macro the day can no longer pay for says so: a dashed pill and the
         figure on the plate (or a dash), never "N/0" — the old day pills'
         rule (mMealPillsHTML), kept for the sheet. The words "none left" went
         from the face on 2026-10-06 (Blake: "Remove the text 'none left' from
         in the pills"): cut to "none l" by a narrow pill, they were the
         loudest thing on a meal with nothing to do. The dash and the dashed
         edge say it; a screen reader still hears it. */
      if (spent[x[0]]) {
        var hv = sub[x[0]] || 0;
        return '<span class="mcap spent" data-want="0"><span class="mcap-t num"><i class="' + x[2] + '">' + x[1] + '</i>' +
          (hv > 0 ? fmtK(hv) : '&mdash;') + '<span class="vis-hidden"> none left</span></span></span>';
      }
      var have = sub[x[0]] || 0, a = x[0] === 'kcal' ? (aim.kcal || (4 * aim.p + 9 * aim.f + 4 * aim.c)) : (aim[x[0]] || 0);
      var pct = a > 0 ? Math.min(100, have * 100 / a) : 0;
      var cls = x[0] !== 'p' && have > a * 1.08 ? 'over' : have >= a * 0.92 ? 'on' : '';
      /* The calorie pill of a meal asked for as much (or as little) as a meal
         can be: the number is the limit the arithmetic ran into, not its
         answer — the old day pills' mark (mmp-cap), kept. */
      if (capped && x[0] === 'kcal') cls += ' mcap-max';
      return '<span class="mcap ' + cls + '" data-want="' + Math.round(a) + '"' +
        (capped && x[0] === 'kcal' ? ' title="The most this meal can be asked for"' : '') + '><span class="mcap-fl" style="width:' + pct.toFixed(1) + '%"></span>' +
        '<span class="mcap-t num"><i class="' + x[2] + '">' + x[1] + '</i>' + fmtK(have) + '<em>/' + fmtK(a) + '</em></span></span>';
    });
    /* In twos, so that when the sheet's row has to break (a big meal, a
       narrow phone) it breaks into two and two rather than leaving carbs
       alone on a line of its own; the day's trays lay the four out on their
       own grid and never see the pairs. */
    return '<span class="mcaps-two">' + c[0] + c[1] + '</span><span class="mcaps-two">' + c[2] + c[3] + '</span>';
  }

  /* Everything the tray and the sheet say about one meal, worked out once. */
  function mMealModel(k, sk, name, onPlan, day, targets, slots) {
    var items = day[sk] || [];
    var srec = null;
    slots.list.forEach(function (s) { if (s.k === sk) srec = s; });
    var sub = { kcal: 0, p: 0, f: 0, c: 0 };
    items.forEach(function (it) {
      var r = LIVE.BY_ID[it.id];
      if (!r || !r.macro) return;
      sub.kcal += (r.macro.kcal || 0) * it.x; sub.p += (r.macro.p || 0) * it.x;
      sub.f += (r.macro.f || 0) * it.x; sub.c += (r.macro.c || 0) * it.x;
    });
    var eatenAll = !!items.length && items.every(function (it) { return it.eaten || !LIVE.BY_ID[it.id]; });
    var live = items.filter(function (it) { return LIVE.BY_ID[it.id]; }).length;
    if (!onPlan && !live) return null;        // a bygone meal with nothing left says nothing
    var ask = mMealAsk(sk, targets, slots);
    var aim = ask ? (ask.now || ask) : null;
    /* The tick completes the whole meal, and pressed again it is not. */
    var dot = '<button class="mday-dot no-print" data-mdot="' + esc(sk) + '"' +
      (items.length && !mAhead(k) ? '' : ' disabled') +
      ' aria-pressed="' + (eatenAll ? 'true' : 'false') + '"' +
      ' aria-label="' + (eatenAll ? 'Mark ' + esc(name) + ' not eaten' : 'Mark all of ' + esc(name) + ' eaten') + '"></button>';
    return { k: k, sk: sk, name: name, onPlan: onPlan, items: items, pins: (srec && srec.pins) || [],
      sub: sub, ask: ask, aim: aim, eatenAll: eatenAll, live: live, dot: dot,
      pillsSay: mMealPillsSay(sub, ask, targets) };
  }

  /* One food in the meal sheet: its name (the door to the recipe or the
     food), the kitchen measure and what it costs in small print, and the
     dial — −, the grams, + — with ⋯ for the rest. Eaten is a record, not a
     dial: the keys go quiet and a tap on the grams hands them back.
     .mstep, .mstep-x and .mstep-in keep their names — they are what the
     portion tests reach for. */
  function foodRowHTML(M, r, it, i, mk) {
    var sk = M.sk, tag = sk + ':' + i;
    var pinned = M.pins.some(function (p) { return p.id === it.id; });
    var was = mk.was[i], fresh = !!mk.fresh[i];
    var spent = it.eaten && S.mEdit !== tag;
    var menuOpen = S.mMenu === tag;
    var sg = !r.food && mServeG(r);
    var measure = mDialMeasure(r, it.x);
    var dialU = mDialG(r) ? 'g' : mDialUnit(r);
    return '<div class="mitem mfood mrow' + (it.eaten ? ' eaten' : '') + (it.l ? ' held' : '') +
        (was !== undefined ? ' moved' : fresh ? ' fresh' : '') + (S.mpSwap && S.mpSwap.slot === sk && S.mpSwap.i === i ? ' swapping' : '') + '">' +
      (S.mpSwap && S.mpSwap.slot === sk && S.mpSwap.i === i
        ? '<div class="mrow-swap">Tap its replacement below<button class="ghost" data-mswapx="1">Cancel</button></div>' : '') +
      '<div class="mrow-n">' +
        '<span class="mitem-nm">' + (r.food
          ? '<button class="mitem-name mitem-food" data-mfood="' + esc(String(r.id)) + '" data-mx="' + it.x + '" data-mfslot="' + esc(sk) + '">'
          : '<button class="mitem-name" data-open="' + esc(String(r.id)) + '" data-mx="' + it.x + '">') +
          (r.score === null || r.score === undefined ? '' : leaf(r.score, 'leaf-sm')) +
          '<span class="mrow-nm">' + esc(r.name) + '</span></button>' +
          (fresh ? '<span class="mrow-mk new">New</span>' : '') +
          (it.l ? '<span class="mrow-mk kept">' + LOCK_SM + 'Kept</span>' : '') +
          (pinned ? '<span class="mrow-mk kept">Pinned</span>' : '') +
        '</span>' +
        '<span class="mrow-m mitem-r2">' + (measure ? '<span class="mitem-uom">' + esc(measure) + '</span> &middot; ' : '') +
          '<span class="mitem-mac">' + mMacLine(r, it.x) + '</span>' + mSaltChip(r, it.x) + mWhyChip(it, tag) + '</span>' +
      '</div>' +
      /* Typing opens an EMPTY box with the amount shown faint behind it, so
         what you type is the amount. Opened holding the number, it relied on
         the phone selecting it, and an iPhone often does not: Blake had to
         type "005" to get 5 g of oil. Left empty, it changes nothing. */
      '<span class="mstep mrow-dial no-print' + (spent ? ' spent' : '') + '">' +
        '<button class="mrow-k" data-mstep="' + tag + ':down"' + (spent ? ' disabled' : '') + ' aria-label="Less ' + esc(r.name) + '">' + I_MINUS + '</button>' +
        '<span class="mrow-g">' +
          (S.mType === tag
            ? '<span class="mstep-x mitem-amt mitem-typing"><input class="mstep-in" type="text" inputmode="decimal" autocomplete="off" data-mtypein="' + tag + '" ' +
                'aria-label="' + esc(r.name) + ', in ' + esc(dialU) + '" value="" placeholder="' + esc(String(mDialFromX(r, it.x))) + '"><i>' + esc(dialU) + '</i></span>'
            : '<button class="mstep-x mitem-amt ' + (spent ? 'mstep-wake" data-medit="' : 'mstep-type" data-mtype="') + tag + '" aria-label="' +
                esc(r.name) + ', ' + esc(mDialText(r, it.x)) + '. ' + (spent ? 'Correct it' : 'Type an amount') + '">' + esc(mDialText(r, it.x)) + '</button>') +
          '<small>' + (was !== undefined ? 'was ' + esc(mDialText(r, was)) : '') + '</small>' +
        '</span>' +
        '<button class="mrow-k" data-mstep="' + tag + ':up"' + (spent ? ' disabled' : '') + ' aria-label="More ' + esc(r.name) + '">' + I_PLUS + '</button>' +
      '</span>' +
      (M.onPlan ? '<button class="mrow-more mfood-more no-print" data-mfmenu="' + tag + '" aria-haspopup="true" aria-expanded="' + menuOpen + '" aria-label="More for ' + esc(r.name) + '">' + I_DOTS + '</button>' : '<span></span>') +
      // the why and Weigh the batch open the row's full width, under it
      mWhyStrip(it, tag) + mBatchStrip(r, it, tag) +
      (menuOpen ? '<div class="mfood-menu mrow-menu no-print" role="menu">' +
        '<button class="mfood-mi mlock" role="menuitem" data-mlock="' + tag + '" aria-pressed="' + (it.l ? 'true' : 'false') + '">' +
          (it.l ? I_OPEN + 'Let it move' : I_LOCK + 'Lock the amount') + '</button>' +
        '<button class="mfood-mi mswap" role="menuitem" data-mswap="' + tag + '">' + I_SWAP + 'Swap</button>' +
        '<button class="mfood-mi mpin" role="menuitem" data-mpin="' + tag + '" aria-pressed="' + (pinned ? 'true' : 'false') + '" aria-label="' +
          (pinned ? 'Unpin from ' + esc(M.name) : 'Pin to ' + esc(M.name) + ' every day') + '">' + I_PIN + (pinned ? 'Unpin' : 'Pin to ' + esc(M.name)) + '</button>' +
        (mCanFav(r) ? '<button class="mfood-mi mfav" role="menuitem" data-mfav="' + esc(String(r.id)) + '" aria-pressed="' + (mIsFav(r) ? 'true' : 'false') + '">' +
          I_STAR + (mIsFav(r) ? 'Remove from favourites' : 'Favourite') + '</button>' : '') +
        (sg ? '<button class="mfood-mi" role="menuitem" data-mbatch="' + tag + '">' + I_WEIGH + 'Weigh the batch</button>' : '') +
        '<button class="mfood-mi mdel" role="menuitem" data-mdel="' + tag + '" aria-label="Remove ' + esc(r.name) + '">' + I_BIN + 'Remove</button>' +
      '</div>' : '') +
    '</div>';
  }

  /* The meal sheet's own half: its header (the tick, the name and the
     meal's ⋯), the pills, and the tray of its foods along the bottom. The
     picker between them is picksheet.js's.
   *
     Blake, 2026-10-05: the foods "at the bottom. The top needs to be sticky
     so I can see the scanner... and the search... Obviously the macro pill
     so I can see that the foods that I'm selecting are auto balancing as I
     select them." The rows used to sit between the pills and the search and
     scrolled away the moment you went looking for something; in a tray
     pinned to the bottom they stay in sight while you pick. Balance and
     Done ride in it, "so it's not at the very top where my thumb has to
     stretch to reach it", which is why ⚖ and × left the header. The line
     under the pills went too: "I can see visually in the pills what I need
     to do still." Mockup: https://claude.ai/artifact/TQTp3xjDsvsEabnWYfFF7y */
  function mMealSheetParts(sk) {
    var k = mViewKey(), day = mDay(k), targets = mDayTargets(k), slots = mReadSlots();
    var rec = null;
    slots.list.forEach(function (s) { if (s.k === sk) rec = s; });
    var name = rec ? rec.n : (slots.names[sk] || 'Meal');
    var M = mMealModel(k, sk, name, !!rec, day, targets, slots);
    if (!M) M = mMealModel(k, sk, name, true, day, targets, slots);
    var items = M.items, mk = marksFor(k, sk, items);
    var skipped = !items.length && mSkipped(k, sk);
    var menuOpen = S.mMenu === 'meal:' + sk;
    var head = '<div class="msh-h">' +
        (skipped ? '<span class="msh-gap"></span>' : M.dot) +
        '<span class="msh-t"><span class="mslot-name">' + esc(name) + '</span><small>' + esc(mLongDate(k)) + '</small></span>' +
        (skipped || !M.onPlan ? '<button class="msh-i sheet-x" data-close="1" aria-label="Close">&times;</button>' :
          '<button class="msh-i" data-mmenu="' + esc(sk) + '" aria-haspopup="true" aria-expanded="' + menuOpen + '" aria-label="More for ' + esc(name) + '">' + I_DOTS + '</button>') +
        (menuOpen ? '<div class="mfood-menu msh-menu no-print" role="menu">' +
          (items.length
            ? '<button class="mfood-mi mslot-try" role="menuitem" data-mtry="' + esc(sk) + '">' + mIcon('another') + 'Try another</button>'
            : '<button class="mfood-mi mslot-skip" role="menuitem" data-mskip="' + esc(sk) + '">' + mIcon('skip') + 'Skip today</button>') +
          (items.length >= 2 ? '<button class="mfood-mi mslot-keep" role="menuitem" data-mkeep="' + esc(sk) + '" aria-label="Save these plates as one food you can reuse">' + mIcon('keep') + 'Save meal</button>' : '') +
          '<button class="mfood-mi mslot-from" role="menuitem" data-mfrom="' + esc(sk) + '" aria-label="Repeat ' + esc(name) + ' from another day">' + mIcon('fromday') + 'Repeat a day</button>' +
        '</div>' : '') +
      '</div>';
    if (skipped) {
      return { name: name, head: head, skipped: true,
        body: '<div class="msh-skipped">' + esc(name) + ' is skipped today. Its share went to the rest.' +
          '<button class="ghost mslot-unskip" data-mskip="' + esc(sk) + '">Put ' + esc(name) + ' back</button></div>' };
    }
    var stick = '<div class="mcaps">' + capsHTML(M.sub, M.aim, M.ask && M.ask.spent, !!(M.ask && M.ask.capped)) + '</div>';
    var rows = items.map(function (it, i) {
      var r = LIVE.BY_ID[it.id];
      return r ? foodRowHTML(M, r, it, i, mk) : '';
    }).join('');
    rows = '<div class="mrows mslot-items">' + (rows || '<div class="mscreen-empty">Nothing on ' + esc(name.toLowerCase()) + ' yet. Tap a food above.</div>') + '</div>';
    return { name: name, head: head, stick: stick, skipped: false, onPlan: M.onPlan, rows: rows,
      tray: sheetTrayHTML(M, mk, rows) };
  }

  /* The tray: shut, the foods as a strip of chips, newest first, each with
     its amount, ↑ or ↓ when the last re-fit moved it and a lock when you set
     it; open, the rows themselves with their dials. Either way Balance and
     Done under them. Shut until asked, so the list keeps the screen. */
  function sheetTrayHTML(M, mk, rows) {
    var sk = M.sk, open = !!S.mTrayOpen;
    var live = [];
    M.items.forEach(function (it, i) { if (LIVE.BY_ID[it.id]) live.push(i); });
    var n = live.length;
    var said = n + (n === 1 ? ' food' : ' foods') + ' &middot; ' + fmtK(M.sub.kcal) + ' kcal';
    var body;
    if (open) {
      body = '<div class="msh-trh"><span class="msh-trt"><b>On ' + esc(M.name) + '</b><small class="num">' + said + '</small></span>' +
          '<button class="msh-i" data-mtray="0" aria-expanded="true" aria-label="Hide the foods on ' + esc(M.name) + '">' + I_DOWN + '</button></div>' +
        '<div class="msh-trrows">' + rows + '</div>';
    } else {
      var chips = live.slice().reverse().map(function (i) {
        var it = M.items[i], r = LIVE.BY_ID[it.id], was = mk.was[i];
        var arrow = was === undefined ? '' : it.x > was ? '&uarr;' : '&darr;';
        return '<button class="msh-chip' + (mk.fresh[i] ? ' fresh' : '') + '" data-mtray="1" aria-label="' + esc(r.name) + ', ' +
            esc(mDialText(r, it.x)) + '. Show the foods on ' + esc(M.name) + '">' +
          '<span class="msh-chn">' + esc(r.name) + '</span>' +
          '<span class="msh-chg num">' + (it.l ? LOCK_SM : '') + esc(mDialText(r, it.x)) + (arrow ? '<em>' + arrow + '</em>' : '') + '</span></button>';
      }).join('');
      body = '<div class="msh-trc">' +
          '<button class="msh-trn" data-mtray="1" aria-expanded="false" aria-label="' + said.replace('&middot;', 'and') + ' on ' + esc(M.name) + '. Show them">' +
            '<b class="num">' + n + '</b><small>' + (n === 1 ? 'food' : 'foods') + '</small></button>' +
          '<span class="msh-chips">' + (chips || '<span class="msh-none">Tap a food above to put it here.</span>') + '</span>' +
          '<button class="msh-i" data-mtray="1" aria-expanded="false" aria-label="Show the foods on ' + esc(M.name) + '">' + I_UP + '</button></div>';
    }
    /* A food's ⋯ opens upward, over the list; while it is open the rows stop
       scrolling inside the tray, or the menu is cut off at the tray's edge. */
    var menuing = open && String(S.mMenu || '').indexOf(sk + ':') === 0;
    return '<div class="msh-tray no-print' + (open ? ' open' : '') + (menuing ? ' menuing' : '') + '">' + body +
      '<div class="msh-acts">' +
        '<button class="msh-bal" data-mbal="' + esc(sk) + '"' + (n ? '' : ' disabled') +
          ' aria-label="Balance every food on ' + esc(M.name) + ', the amounts you set included">' + mIcon('scales') + 'Balance</button>' +
        '<button class="btn-primary msh-done sheet-done">Done</button>' +
      '</div></div>';
  }

  function mRenderDay() {
    var todayK = todayKey();
    var k = mViewKey();
    /* Midnight passed while the tab sat on a day. Forward was already
       handled; backward matters more — the oldest day the tab keeps falls
       out of the window at midnight, and an edit to it would have been
       written and then pruned away by the same save. */
    if (k > mLatestKey() || k < mEarliestKey()) { S.macroDate = null; k = todayK; }
    /* The day is a control, not a caption: every day the tab remembers, named
       the way you would say it, with the arrows for single steps either side. */
    var opts = [];
    for (var step = 7; step > -14; step--) {
      var od = new Date();
      od.setDate(od.getDate() + step);
      var ok = dayKey(od);
      /* Month first, the one form the app writes a date in: "Mon, Sep 28",
         or the word for it when there is one. */
      var word = step === 0 ? 'Today' : step === -1 ? 'Yesterday'
        : step === 1 ? 'Tomorrow' : '';
      opts.push('<option value="' + ok + '"' + (ok === k ? ' selected' : '') + '>' +
        (word ? word + ' &middot; ' + M_MONS[od.getMonth()] + ' ' + od.getDate() : mLongDate(ok)) + '</option>');
    }
    /* A day further back than the list, reached by the date box or the
       arrows, is named at the foot so the box still says where you are; and
       the last entry opens the date box, for any day the log keeps. */
    var listFrom = new Date(); listFrom.setDate(listFrom.getDate() - 13);
    if (k < dayKey(listFrom)) opts.push('<option value="' + k + '" selected>' + mLongDate(k) + '</option>');
    opts.push('<option value="pick">Earlier day\u2026</option>');
    $('macroDaySel').innerHTML = opts.join('');
    var dp = $('macroDayPick');
    if (dp) { dp.min = mEarliestKey(); dp.max = mLatestKey(); }
    $('macroPrev').disabled = k <= mEarliestKey();
    $('macroNext').disabled = k >= mLatestKey();
    $('macroWeek').innerHTML = mWeekHTML(k, todayK);
    /* A day you are planning rather than living looks identical otherwise,
       and quietly ticking Thursday's breakfast off on Tuesday is exactly the
       mistake that would cost. */
    $('view-macros').classList.toggle('mday-ahead', mAhead(k));

    var targets = mDayTargets(k);
    var slots = mReadSlots();

    /* A new today arrives with the routine already on it: anything pinned to
       a meal is placed at its pinned portion the first time today is looked
       at. Only today, and only when the day does not exist yet — history and
       half-built days are never re-seeded, and unpinning tomorrow is done by
       unpinning, not by deleting today's copy. */
    /* `===`, as the comment says: `>=` wrote the routine onto every future
       day merely browsed to — a write to a day nobody asked to change, sent
       to the account. Planning a future day still gets its pins, from Fill,
       which runs the pin pass itself. */
    /* And unstamped. The pins are this device's guess at a day it has not
       seen, not a change to it, and a guess stamped "now" beat the real day:
       a second device opened at lunch drew before its first word from the
       account, found no today, placed the routine, stamped it newer than the
       breakfast logged on the phone that morning, and sent it — and a day
       travels whole, so breakfast was gone on both. Unstamped, the seeded
       day is never sent on its own and the account's copy of today, when it
       comes, simply replaces it. The first real edit stamps it, pins and all. */
    if (k === todayK && !MDAYS[k]) {
      var anyPins = false;
      slots.list.forEach(function (s) { if (s.pins && s.pins.length) anyPins = true; });
      if (anyPins) {
        mEditDay(k, function (day0) {
          slots.list.forEach(function (s) {
            (s.pins || []).forEach(function (p) {
              if (LIVE.BY_ID[p.id]) (day0[s.k] = day0[s.k] || []).push({ id: p.id, x: p.x || 1, eaten: 0 });
            });
          });
        }, true);
      }
    }
    var day = mDay(k);

    /* Nothing to draft once every meal has something on it — or before there
       is a plan to draft against. Fill reads mDayTargets and portion-solves
       against whatever comes back, so with nothing set it would build a real
       day out of real recipes and present it as the answer to a question
       nobody asked.
     *
       But it does not sit there DEAD and green either. Driven cold, the first
       thing this tab shows a newcomer is the biggest, brightest control on
       the screen, disabled, with nothing saying why — and behind it the whole
       of My Day: the targets, the favourites, the best fits, and now the
       family's own week. Every one of those is reached through this button.
       A front door that cannot be opened and will not say so is the worst
       thing in the app, and it costs one branch to fix: with no plan, the
       button IS the way to make one, and says so. */
    /* One button, saying the next thing the day needs.
     *
       It used to be Fill beside a tick, and Fill went DEAD the moment every
       meal had something on it: the biggest, brightest control on the screen,
       disabled, for most of the day — the same fault the paragraph above
       describes for the no-plan case and fixes only there. Blake: "when all
       the foods are check marked I get to see a complete button for a day
       instead of a fill, because fill at that point doesn't make sense
       anymore."
     *
       Four states in order of what is left to do: make a plan, draft the
       day, close it, reopen it. The tick that used to carry the last two is
       gone from the bar; this is the same verb in the slot that was going to
       waste. */
    var fillBtn = $('macroFill');
    var noPlan = !kcalOf(targets);
    /* A skipped meal counts as dealt with. It asked only whether every meal
       had food on it, and a skipped meal never will — so one skip pinned the
       button to "Fill" for the rest of the day, through every plate being
       ticked, and neither "Mark all complete" nor "Complete the day" could
       ever be reached. Blake: "when all foods are marked complete, it's still
       showing fill. I'd expect to see something else." */
    /* And a day with no room left has nothing to fill either. An empty
       snack on a day already over its calories kept the button on "Fill",
       which then added nothing — pressed three times, it stayed "Fill", and
       "Mark all complete" could only be reached by skipping the snack. Asked
       by the same test Fill asks itself. */
    var nothingToFill = !noPlan && (mFillRoom(day, targets) < 100 ||
      slots.list.every(function (s) {
        return (day[s.k] || []).length || mSkipped(mViewKey(), s.k);
      }));
    var dayDone = mDoneAt(mViewKey()) > 0;
    var future = mViewKey() > todayKey();
    /* Is there a plate left to tick? Blake: "the done for the day button
       should be something like Mark all as complete. And once everything is
       completed I get the options to complete the day." Which is better than
       what this slot shipped with this morning: Done appeared as soon as
       every meal had FOOD, so it could be pressed having eaten nothing. Now
       the two are separate steps and each one is the literal next thing. */
    /* Two different counts, and conflating them left the sweeper lit with
       nothing it was willing to take: a LOCKED un-eaten plate can still be
       ticked, so it counts toward "mark all complete", but the sweeper
       leaves it alone, so it must not count toward "there is something to
       sweep". The test caught this by locking one. */
    var unticked = 0, loose = 0;
    slots.list.forEach(function (s0) {
      var pinned0 = (s0.pins || []).map(function (pn) { return String(pn.id); });
      (day[s0.k] || []).forEach(function (it) {
        if (!it.eaten) unticked++;
        // what the sweep would take: not eaten, not locked, not pinned
        if (!it.eaten && !it.l && pinned0.indexOf(String(it.id)) < 0) loose++;
      });
    });
    var mode = noPlan ? 'plan' : dayDone ? 'open'
      : !nothingToFill ? 'fill' : unticked ? 'tickall' : 'done';
    var SAY = { plan: 'Craft my plan', fill: 'Fill', tickall: 'Mark all complete',
      done: 'Complete the day', open: 'Reopen the day' };
    var TELL = {
      plan: 'Craft my plan — Nourish needs one before it can draft anything',
      fill: 'Fill the day',
      tickall: 'Mark every plate on the day as eaten',
      done: 'I am done for today',
      open: 'Day closed — press to reopen it'
    };
    fillBtn.classList.toggle('to-plan', noPlan);
    fillBtn.classList.toggle('to-done', mode === 'done' || mode === 'open');
    fillBtn.classList.toggle('to-tick', mode === 'tickall');
    fillBtn.dataset.mode = mode;
    if (fillBtn.textContent !== SAY[mode]) fillBtn.textContent = SAY[mode];
    fillBtn.setAttribute('aria-label', TELL[mode]);
    fillBtn.title = TELL[mode];
    /* A day that has not happened cannot be finished with, and there is
       nothing to draft against on it either. */
    fillBtn.disabled = future && mode !== 'fill';

    /* The gear and its menu are static markup, so a state change paints them
       once and they stay painted. Painting again here costs a class check and
       covers the day this header stops being static. */
    mMarkAccountUI();

    // and nothing to re-size when every plate is eaten, locked, or absent
    var freeCount = 0;
    Object.keys(day).forEach(function (sk) {
      (day[sk] || []).forEach(function (it) {
        var r = LIVE.BY_ID[it.id];
        if (!it.eaten && !it.l && r && r.macro) freeCount++;
      });
    });
    $('macroRebal').disabled = !freeCount;
    /* Any day, tomorrow included. Blake swept tomorrow's plan to start it
       again and nothing happened: the button was switched off on every
       future day, with nothing to say why — and planning a day ahead is
       exactly when you want to clear it. */
    $('macroSweep').disabled = !loose;

    /* One tray per meal on the plan, then one for anything a bygone meal
       left on this day — removed from the plan is not removed from history.
     *
       Blake, 2026-10-04, of the RP-style day: "Way to fat and tall... hard
       to know where to add food... Many ways." So the day is small trays:
       the meal's tick, its name, its calories against its share, and its
       foods as small lines. The tick is the only control on a tray; a tap
       anywhere else opens the meal's sheet (data-mopen), which is the one
       place food is added or changed. Mockup (Tray A):
       https://claude.ai/artifact/SseR1TPa4JAFNanYYsGP4k */
    var ahead = mAhead(k);
    var trayHTML = function (sk, name, onPlan) {
      var M = mMealModel(k, sk, name, onPlan, day, targets, slots);
      if (!M) return '';
      var items = M.items;

      /* Skipped: one line. Its way back is in its sheet; the chooser for
         where its share goes (the largest cascade there is) rides under it. */
      if (onPlan && !items.length && mSkipped(k, sk)) {
        /* With the card under it asking where the share goes, the line does
           not claim it simply went to the rest. */
        var skSend = mCascadeLineHTML(sk, targets, slots);
        return '<button class="mtray-skip" data-mopen="' + esc(sk) + '" aria-label="' + esc(name) + ', skipped. Open it">' +
            '<span class="mtray-n">' + esc(name) + '</span>' +
            '<span class="mtray-sw">' + (skSend ? 'skipped' : 'skipped &middot; its share went to the rest') + '</span>' +
          '</button>' + skSend;
      }

      /* Each food in the kitchen's words first and its weight after (Blake,
         2026-10-05: "If I just want to eyeball it I can... The grams is there
         for sure if I want to weigh it"): a cup or a spoon with its mL, a
         count, ounces; a food with no measure but its weight shows that. */
      var lines = items.map(function (it) {
        var r = LIVE.BY_ID[it.id];
        if (!r) return '';
        var byG = mDialG(r);
        var kitchen = byG ? mDialMeasure(r, it.x) : mDialText(r, it.x);
        var weight = byG ? mDialText(r, it.x) : mDialMeasure(r, it.x);
        if (kitchen === weight) kitchen = '';
        var ml = mlOf(kitchen);
        return '<span class="mtray-f"><span class="mtray-fn">' + esc(r.name) + '</span>' +
          (kitchen ? '<span class="mtray-fm"><b>' + esc(kitchen) + '</b>' + (ml ? '<small><i> &middot; </i>' + ml + '</small>' : '') + '</span>' : '') +
          '<em class="num">' + esc(weight) + '</em></span>';
      }).join('');
      return '<div class="mslot mtray' + (items.length ? ' filled' : '') + (M.eatenAll ? ' done' : '') + '">' +
          M.dot +
          '<button class="mtray-b" data-mopen="' + esc(sk) + '" aria-label="Open ' + esc(name) +
            (M.pillsSay ? ' — ' + esc(M.pillsSay) : '') + '">' +
            '<span class="mtray-h"><span class="mtray-n">' + esc(name) + '</span>' +
              (M.aim ? '' : '<span class="mtray-k num"><b>' + fmtK(M.sub.kcal) + '</b> kcal</span>') + '</span>' +
            /* The meal's pills, small: what it holds against its share, the
               way its sheet says it (Blake: "adding back the subtle pills
               that show me that meal's calories and macros"). An empty meal
               shows them too: 0 of its share is what it is for. */
            (M.aim ? '<span class="mtray-caps">' + capsHTML(M.sub, M.aim, M.ask && M.ask.spent, !!(M.ask && M.ask.capped)) + '</span>' : '') +
            '<span class="mtray-fs">' + (lines || '<span class="mtray-f mtray-none">Nothing yet</span>') + '</span>' +
          '</button>' +
        '</div>' + (onPlan ? mCascadeLineHTML(sk, targets, slots) : '');
    };
    var html = slots.list.map(function (s) { return trayHTML(s.k, s.n, true); }).join('');
    var onPlanKeys = slots.list.map(function (s) { return s.k; });
    Object.keys(day).forEach(function (sk) {
      if (onPlanKeys.indexOf(sk) < 0) html += trayHTML(sk, slots.names[sk] || 'Meal', false);
    });
    $('macroSlots').innerHTML = html;

    var readout = macroFootHTML(day, targets, slots);
    $('macroFoot').innerHTML = readout.foot;
    /* Contents only — the region itself must outlive the redraw or it
       announces nothing. */
    $('macroLimits').innerHTML = readout.limits;
    /* The pills are the folded copy of the bars, so they are rebuilt with
       them. The row itself is static markup and keeps its own handler; only
       what is inside it changes. */
    $('macroPills').innerHTML = readout.pills;
    /* The scale's box is a draft like the join code and the picker's search:
       a sync emit arriving mid-keystroke must not replace "187.4" with the
       last saved value while the pending save still holds what was typed. */
    var wIn = $('macroWeigh').querySelector('#mWeight');
    var wDraft = wIn && document.activeElement === wIn ? wIn.value : null;
    $('macroWeigh').innerHTML = macroWeighHTML(k);
    if (WGAPI.week) WGAPI.week();
    if (wDraft !== null) {
      var wBack = $('macroWeigh').querySelector('#mWeight');
      if (wBack) { wBack.value = wDraft; wBack.focus(); }
    }
    // the first stop of the day fills in once the scale has been read
    $('macroWeigh').classList.toggle('done', MWEIGHTS[k] > 0);

    /* A day with a different plan is a card of a different height, so the
       fold's measurements go out with the markup they were taken from and
       the card is laid out again from the scroll position it is at. Without
       this, ticking a meal off while the card is folded would leave it
       clipped to yesterday's numbers. */
    mFoldForget();
    syncShrunk();
  }

  return { renderMacros: renderMacros, mDayPick: mDayPick, mMealSheetParts: mMealSheetParts };
};
