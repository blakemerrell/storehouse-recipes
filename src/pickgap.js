/* What is still wanted, as the picker says it: everything on the day plus
 * the basket, in grams (mDayEaten); the day's gap in the pills the day
 * already speaks; what the meal being filled still wants, not the day's
 * remainder (mMealLeft); and what one meal holds with the basket waiting
 * to join it (mMealHolds). The longer account is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.pickgap(app) once, as it starts, and keeps what it gives back
 * under the same names. The recipes by id (BY_ID) are read through LIVE
 * (tests/scope.test.js holds the lists to each other). Loaded before
 * app.js.
 */
(window.HiveParts = window.HiveParts || {}).pickgap = function (app) {
  'use strict';

  // what it reads of the app's, and (LIVE) what the app replaces as it goes: BY_ID
  var MGAUGE = app.MGAUGE;
  var MPILL_TONE = app.MPILL_TONE;
  var S = app.S;
  var idOf = app.idOf;
  var kcalOf = app.kcalOf;
  var mDay = app.mDay;
  var mDayTargets = app.mDayTargets;
  var mFillPill = app.mFillPill;
  var mGauge = app.mGauge;
  var mMealAsk = app.mMealAsk;
  var mReadSlots = app.mReadSlots;
  var mSlotOf = app.mSlotOf;
  var mViewKey = app.mViewKey;
  var LIVE = app.LIVE;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* What this meal still has room for. mShares works the day's remainder into
     a share per empty meal; this is that share, in the words the plate rows
     already use. */
  /* The DAY, and what the basket would do to it.
   *
     It used to draw this meal against this meal's share. That is gone with
     the chips and the bars on the cards, and for the same reason: a share is
     a planning device, not a thing anybody eats against. You are shopping to
     close the DAY, wherever the food ends up sitting.

     Which also settles an argument this sheet was having with itself. The
     panel spoke one share and the footer under it spoke another, so the top
     invited food the bottom called a bust. There is one number now and both
     halves read it.

     The basket counts before it is committed, because a tick redraws this
     whole sheet — and the bars visibly redrawing WITHOUT moving, while the
     line directly beneath them changed by that same tick, is one gesture
     answered twice with the bigger drawing stale. Whole grams the day is
     still owed, and what the basket would take off that. */
  /* Everything on the day plus everything in the basket, in grams.
   *
     Extracted because the bars and the three-food combo underneath them have
     to be answering the same question. When each worked out the day's
     position for itself the combo could offer food the bars called a bust,
     which is the same argument the panel and the footer used to have. */
  /* Calories are carried, not re-derived.
   *
     4P + 4C + 9F is how a TARGET becomes calories — a target is grams and has
     no other answer. A plate is different: it states its own energy, and that
     is the number mTotals sums for the day bar. Deriving it again here made
     the picker and the day bar disagree about the same day — 1,655 against
     1,554 on an ordinary one, and 250 against nothing at all for a food typed
     in with only its calories, which has no grams to derive from and so was
     invisible to the sheet that exists to say what is left. */
  function mDayEaten(k) {
    var day = mDay(k);
    var sub = { p: 0, f: 0, c: 0, kcal: 0 };
    var addTo = function (r, x) {
      if (!r || !r.macro) return;
      sub.p += (r.macro.p || 0) * x;
      sub.f += (r.macro.f || 0) * x;
      sub.c += (r.macro.c || 0) * x;
      sub.kcal += (r.macro.kcal || 0) * x;
    };
    /* Every meal on the day, not just the one being filled — the gap is the
       day's, and food added here counts against it wherever it lands. */
    Object.keys(day).forEach(function (sk) {
      (day[sk] || []).forEach(function (it) { addTo(LIVE.BY_ID[it.id], it.x); });
    });
    Object.keys(S.mpBasket).forEach(function (bk) {
      addTo(LIVE.BY_ID[idOf(bk)], S.mpBasket[bk]);
    });
    return sub;
  }

  /* What the day is still owed, in the pills the day already speaks.
   *
     It was four bars reading "60 / 203 g" — where the day STANDS. Standing
     is the right question for the strip pinned at the top of My Day, and the
     wrong one here: in this sheet you are shopping, and shopping is done
     against what is missing. The subtraction was being done in your head on
     every row.

     Owed, not signed. The day's own pills carry +12 / −47 because the day
     can be over as well as under; a thing you are still owed cannot be
     negative, so it floors at nothing and turns green when there is nothing
     left of it — the same green a landed macro wears everywhere else.

     The basket counts before it is committed. A tick redraws this whole
     sheet, and pills that visibly redrew WITHOUT moving while the line under
     them changed would be one gesture answered twice. */
  /* The label is looked up rather than passed in. It was passed at eight call
     sites, four of them spelling calories as a flame — so when the meal head,
     the plate and the day bars all settled on the word "kcal", this sheet
     went on saying it in an emoji and the app had two spellings again, which
     is the thing that change existed to end. One table, MGAUGE, and nothing
     left to keep in step by hand. */
  /* Kin to the day's pills and now drawn the same way: the NUMBER is the gap
     and the FILL is the proportion, which is exactly the pair the folded day
     row settled on.
   *
     The stylesheet used to argue the opposite — flat tint here, proportional
     fill there, "two different questions should not wear identical clothes".
     The argument was wrong in the same way the folded row's was before it:
     twenty grams of protein reads the same whether it is the whole meal or
     the last mouthful of it, and the fill is the only thing that says which.
     Blake: "make it so that the macro bar at the top of this card works like
     the other pills when crafting meals." */
  function mGapPill(m, got, want, dayT) {
    var done = want > 0 && got >= want, lbl = m;
    MGAUGE.forEach(function (g) { if (g[0] === m) lbl = g[1]; });
    /* The meal card's own rule (mGauge), so one meal cannot be "on" on the
       card and "under" in the sheet opened from it. The comment here used to
       claim exactly that while the code judged by the day bars' band instead
       — a lunch at 80% of its share read on, on, on, on on the card and four
       unders in the sheet. dayT is the day's target for this macro, which the
       card's band is partly relative to. */
    var pct = want > 0 ? Math.min(100, 100 * got / want) : 0;
    var gz = want > 0 ? mGauge(got, want, dayT) : null;
    var state = !gz ? 'quiet' : { u: 'under', o: 'on', x: 'over' }[gz.st];
    /* Both halves, the way the day's pills say them: what is on the meal, and
       what the meal is for. Blake: "those three macros clearly show me how
       much I've selected and what is left. That makes a perfect meal." The
       gap used to be the only figure, which answered the second half and hid
       the first — and a lone "20" cannot say whether that is the whole meal
       or the last mouthful of it. */
    return mFillPill('mgp' + (done ? ' met' : ''), MPILL_TONE[state], pct,
      '<span class="mb-' + m + '">' + lbl + '</span>' +
      '<b>' + Math.round(got) + '</b><u>/' + Math.round(want) + '</u>');
  }

  /* What the MEAL this sheet is filling still wants — not the day's remainder.
   *
     The function was already called mMealLeft and its first two lines read
     mDayTargets and mDayEaten: named for the meal, returning the day. Blake,
     looking at a sheet headed ADD TO SNACKS showing 1745 kcal: "the macro
     pills at the top are for the whole day? why not for the meal I am trying
     to make?" Snacks was asking for 87. Everything else in the sheet was
     already meal-scoped — the ranking, and a section that literally says one
     food that closes Snacks — so the pills were the only thing answering a
     different question, twenty times larger.

     It matters more since the cascade than it would have last week: a meal's
     ask is no longer a fixed slice of the day. Overrun dinner and Snacks is
     asking for less than its plan; share a light breakfast onto it and Snacks
     is asking for more. The day's remainder cannot show either.

     want − got, which is exactly what the meal card's own pills draw, so the
     sheet and the card behind it cannot disagree about the same meal. */
  function mMealLeft() {
    var k = mViewKey();
    var targets = mDayTargets(k);
    if (!targets.p && !targets.f && !targets.c) return '';
    var slots = mReadSlots();
    var sk = S.macroPick && S.macroPick.slot;
    var ask = sk ? mMealAsk(sk, targets, slots) : null;
    var want = ask ? (ask.now || ask.plan) : null;
    if (!want) {
      /* No meal to speak for — the day is the honest fallback, and says so. */
      var dsub = mDayEaten(k);
      return '<div class="mp-cap">The day so far</div>' +
        '<div class="mgps">' +
          mGapPill('kcal', dsub.kcal, kcalOf(targets), kcalOf(targets)) +
          mGapPill('p', dsub.p, targets.p, targets.p) +
          mGapPill('f', dsub.f, targets.f, targets.f) +
          mGapPill('c', dsub.c, targets.c, targets.c) +
        '</div>';
    }
    var got = mMealHolds(k, sk);
    var nm = mSlotOf(slots, sk).n || 'This meal';
    var closed = ['kcal', 'p', 'f', 'c'].every(function (m) {
      return (want[m] || 0) - (got[m] || 0) <= 0;
    });
    return '<div class="mp-cap">' + esc(closed ? nm + ' is closed' : nm + ' so far') + '</div>' +
      '<div class="mgps">' +
        mGapPill('kcal', got.kcal, want.kcal || 0, kcalOf(targets)) +
        mGapPill('p', got.p, want.p || 0, targets.p) +
        mGapPill('f', got.f, want.f || 0, targets.f) +
        mGapPill('c', got.c, want.c || 0, targets.c) +
      '</div>';
  }

  /* Everything already on one meal, plus the basket waiting to join it. The
     basket belongs here and not in the day's version: it is destined for THIS
     meal, so it is what this meal will hold the moment you press Add. */
  function mMealHolds(k, sk) {
    var day = mDay(k);
    var sub = { p: 0, f: 0, c: 0, kcal: 0 };
    var addTo = function (r, x) {
      if (!r || !r.macro) return;
      sub.p += (r.macro.p || 0) * x; sub.f += (r.macro.f || 0) * x;
      sub.c += (r.macro.c || 0) * x; sub.kcal += (r.macro.kcal || 0) * x;
    };
    (day[sk] || []).forEach(function (it) { addTo(LIVE.BY_ID[it.id], it.x); });
    Object.keys(S.mpBasket).forEach(function (bk) {
      addTo(LIVE.BY_ID[idOf(bk)], S.mpBasket[bk]);
    });
    return sub;
  }

  return { mDayEaten: mDayEaten, mMealLeft: mMealLeft, mMealHolds: mMealHolds };
};
