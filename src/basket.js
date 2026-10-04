/* The picker's basket: everything waiting to be added, listed where it can
 * be seen, with what is already on the meal; what the basket will do to
 * the meal and the day, said before you commit it; and the bar along the
 * bottom that carries both (mBasketBarHTML). The longer account is with the
 * code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.basket(app) once, as it starts, and keeps what it gives back
 * under the same name. The recipes by id (BY_ID) are read through LIVE
 * (tests/scope.test.js holds the lists to each other). Loaded before
 * app.js.
 */
(window.HiveParts = window.HiveParts || {}).basket = function (app) {
  'use strict';

  // what it reads of the app's, and (LIVE) what the app replaces as it goes: BY_ID
  var S = app.S;
  var fmtNum = app.fmtNum;
  var idOf = app.idOf;
  var kcalOf = app.kcalOf;
  var mDay = app.mDay;
  var mDayTargets = app.mDayTargets;
  var mFitWords = app.mFitWords;
  var mGauge = app.mGauge;
  var mMacLine = app.mMacLine;
  var mMealAsk = app.mMealAsk;
  var mPortion = app.mPortion;
  var mPortionText = app.mPortionText;
  var mReadSlots = app.mReadSlots;
  var mSlotOf = app.mSlotOf;
  var mViewKey = app.mViewKey;
  var mpFitX = app.mpFitX;
  var LIVE = app.LIVE;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Everything waiting, listed where it can be seen. The lists themselves
     tick what is in the basket, but a thing you have just named yourself is
     on no list yet — and a basket you cannot see is a basket you commit by
     surprise. */
  /* What is ALREADY on the meal you are adding to.
   *
     The bar along the bottom lists the basket, and only once something is in
     it — so a meal you had half-built was invisible from the sheet you build
     it in. Blake: "when I open the meal picker I can't see what I have
     already picked... I'd like to see the contents of that meal if there are
     contents already selected."
   *
     Two different statements, so two different panels: this is what the meal
     holds, the basket is what is about to join it. Same row shape so they
     read as one family, a different heading colour so they are never mistaken
     for each other — the basket's green means "about to be added", and
     nothing here is about to be anything.
   *
     In the BAR, not in the scroll. It began as a panel under the sticky
     header and Blake moved it: "I want this basket to fold into the footer.
     If there are foods already on that meal I meant to see them in the sticky
     footer basket." Which is right — what the meal holds and what is about to
     join it are the same question asked a second apart, and the bar is where
     the answer was already kept. It also gives the list back the ~200px the
     panel was spending on something you read once. */
  function mMealOnItems() {
    if (!S.macroPick || !S.macroPick.slot) return [];
    return (mDay(mViewKey())[S.macroPick.slot] || []).filter(function (it) {
      return LIVE.BY_ID[it.id];
    });
  }

  function mMealOnHTML() {
    var items = mMealOnItems();
    if (!items.length) return '';
    var nm = mSlotOf(mReadSlots(), S.macroPick.slot);
    var show = items.slice(0, 4), rest = items.length - show.length;
    return '<div class="mp-basket-h mp-on-h">Already on ' +
      esc((nm && nm.n) || 'this meal') + ' &middot; ' + items.length + '</div>' +
      show.map(function (it) {
        var r = LIVE.BY_ID[it.id];
        return '<div class="mpb-row">' +
          '<span class="mpb-b">' +
            '<span class="mpb-n">' + esc(r.name) + '</span>' +
            '<span class="mpb-m">' + mMacLine(r, it.x) + '</span>' +
          '</span>' +
          '<span class="mpb-por">' + esc(mPortionText(r, it.x)) + '</span>' +
        '</div>';
      }).join('') +
      (rest > 0 ? '<div class="mpb-more">and ' + rest + ' more</div>' : '');
  }

  function mBasketListHTML() {
    var ids = Object.keys(S.mpBasket);
    var on = mMealOnHTML();
    /* Neutral while the basket is empty. The green wash means "about to be
       added" wherever it appears in this sheet, and a drawer holding only
       what is ALREADY on the plate must not wear it. With both halves in
       there the tint is the basket's and the two headings carry the rest. */
    if (!ids.length) return on ? '<div class="mp-basket mp-basket-on">' + on + '</div>' : '';
    /* Its own row, not the picker's. The list already ticks what is in the
       basket; repeating the whole row here — stepper, star and all — put the
       same plate on screen twice with two sets of controls. */
    return '<div class="mp-basket">' + on +
      '<div class="mp-basket-h">In the basket &middot; ' +
      ids.length + '</div>' + ids.map(function (k) {
        var r = LIVE.BY_ID[idOf(k)];
        if (!r) return '';
        var x = S.mpBasket[k];
        /* The fitting amount beside what is in the basket, while they
           differ: picked at what you had last time, one tap to what the meal
           has room for. */
        var fx = mpFitX(r);
        var fitB = fx > 0 && Math.abs(fx - x) > 1e-6
          ? '<button class="mp-fitx mpb-fit no-print" data-mpfit="' + esc(String(r.id)) +
            '" data-mpx="' + fx + '" aria-pressed="false" aria-label="Change to the amount that fits this meal, ' +
            esc(mPortion(r, fx).head) + '"><span>Fits: ' + esc(mFitWords(r, fx)) + '</span></button>'
          : '';
        return '<div class="mpb-row">' +
          '<span class="mpb-b">' +
            '<span class="mpb-n">' + esc(r.name) + '</span>' +
            '<span class="mpb-m">' + mMacLine(r, x) + '</span>' + fitB +
          '</span>' +
          '<span class="mpb-x no-print">' +
            '<button data-mbstep="' + esc(String(r.id)) + ':-1" aria-label="Smaller">&minus;</button>' +
            '<span>&times;' + fmtNum(x) + '</span>' +
            '<button data-mbstep="' + esc(String(r.id)) + ':1" aria-label="Bigger">+</button>' +
            /* Its own attribute, not a second data-mpick. Carrying the list
               row's attribute made the two indistinguishable to focusKey: after
               an add, the focus restore looked up
               [data-mpick=<id>][data-mpx=<x>], found TWO, and took the first in
               document order — this one, which sits at the top of the sheet.
               Focusing it scrolled the scrim to 0, so every add threw the list
               back to the top from wherever you had scrolled to. */
            '<button class="mpb-out" data-mpout="' + esc(String(r.id)) +
              '" aria-label="Take out of the basket">&times;</button>' +
          '</span>' +
        '</div>';
      }).join('') + '</div>';
  }

  /* What the basket will do to the meal, said before you commit it rather
     than discovered afterwards on the plate. */
  /* The basket and what it costs, together, on the bar along the bottom.
   *
     The list of what you have picked used to sit in the SCROLL, above the
     rows, and grow as you picked: measured, 71px after one thing, 119 after
     two, 167 after three. Two costs, both felt. The rows slid down under the
     finger on every tap — preserving scrollTop is what does that, since the
     content above the list got taller — and once you had scrolled past it the
     panel was off-screen (measured at y -106), so the one thing it exists to
     answer, "what have I got", could not be answered without scrolling back.
   *
     It is folded into the bar now: shut it costs nothing and the readout is
     the summary; open it lists what is in there, over the list rather than
     inside it, capped so it can never take the screen. Shut again on every
     open of the sheet, because a basket you have not filled yet has nothing
     to say. */
  function mBasketBarHTML() {
    var foot = mBasketFootHTML();
    if (!foot) return '';
    return '<div class="mp-bar">' +
      (S.mpBasketOpen ? mBasketListHTML() : '') + foot + '</div>';
  }

  function mBasketFootHTML() {
    var ids = Object.keys(S.mpBasket);
    /* An empty basket used to take the whole bar with it, so a meal you had
       half-built showed nothing anywhere: the plates were on the day behind
       the sheet and the sheet said nothing about them. The bar speaks for the
       MEAL now when the basket has nothing to say — same handle, same drawer,
       and no Add, because a button that adds nothing is still not a button. */
    if (!ids.length) {
      var onItems = mMealOnItems();
      if (!onItems.length) return '';
      var ot = { kcal: 0, p: 0, f: 0, c: 0 };
      onItems.forEach(function (it) {
        var r0 = LIVE.BY_ID[it.id];
        if (!r0 || !r0.macro) return;
        ['kcal', 'p', 'f', 'c'].forEach(function (m) {
          ot[m] += (r0.macro[m] || 0) * it.x;
        });
      });
      var onm = mSlotOf(mReadSlots(), S.macroPick.slot);
      return '<div class="mp-foot mp-foot-on">' +
        '<button class="mp-foot-t" data-mpbasket="1" aria-expanded="' +
          (S.mpBasketOpen ? 'true' : 'false') + '" aria-label="' +
          (S.mpBasketOpen ? 'Hide what is on this meal' : 'Show what is on this meal') + '">' +
          '<span class="mp-foot-b">' +
            '<span class="mp-foot-m">On ' + esc((onm && onm.n) || 'this meal') +
              ' &middot; ' + Math.round(ot.kcal) + ' kcal &middot; ' +
              Math.round(ot.p) + 'P &middot; ' + Math.round(ot.f) + 'F &middot; ' +
              Math.round(ot.c) + 'C</span>' +
            '<span class="mp-foot-n">' + esc(mBasketNames(onItems.map(function (it) {
              return String(it.id);
            }))) + '</span>' +
          '</span>' +
          '<span class="mp-foot-c' + (S.mpBasketOpen ? ' open' : '') +
            '" aria-hidden="true">&#8964;</span>' +
        '</button>' +
      '</div>';
    }
    var t = { kcal: 0, p: 0, f: 0, c: 0 }, est = false;
    ids.forEach(function (k) {
      var r = LIVE.BY_ID[idOf(k)];
      if (!r || !r.macro) return;
      var x = S.mpBasket[k];
      t.kcal += (r.macro.kcal || 0) * x; t.p += (r.macro.p || 0) * x;
      t.f += (r.macro.f || 0) * x; t.c += (r.macro.c || 0) * x;
      if (r.est) est = true;
    });
    /* Judged against the same thing the bars above it are drawn against, and
       measuring the same quantity.
     *
       It used to weigh the BASKET ALONE against mShares — the room left for
       one more thing — while the panel twenty pixels above drew committed
       PLUS basket against the meal's plan share. Two quantities, two
       denominators, one sheet: the top invited food the bottom called a bust.

       The plan share is the one to keep, and not by preference. The card
       behind this sheet uses it, and so does the balance button on that card,
       whose own comment rejects mShares for this job with the regression it
       caused written into it — a meal sitting exactly on target told its
       target was nearly zero. A picker that spoke the remainder would have
       invited roughly double what that button then solved away.

       mRank still asks mShares, and should: "what fits the room left" is a
       real question and a different one. It decides what to OFFER. This
       decides whether the meal you are building lands. */
    var k = mViewKey();
    var targets = mDayTargets(k);
    var busts = false, over = 0;
    if (targets.p || targets.f || targets.c) {
      /* Against what the meal is ASKING for, by the card's rule — the pills
         above this bar read the ask and the footer read the plan's first
         share, so a basket at 491 of a 229 ask was "over" in four pills and
         silent here, because 491 is under 556 × 1.07. */
      var ask2 = mMealAsk(S.macroPick.slot, targets, mReadSlots());
      var sh = ask2 ? (ask2.now || ask2.plan) : null;
      if (sh && sh.kcal > 0) {
        var held = 0;
        (mDay(k)[S.macroPick.slot] || []).forEach(function (it) {
          var r2 = LIVE.BY_ID[it.id];
          if (r2 && r2.macro) held += (r2.macro.kcal || 0) * it.x;
        });
        over = Math.round(held + t.kcal - sh.kcal);
        var gz2 = mGauge(held + t.kcal, sh.kcal, kcalOf(targets));
        busts = !!gz2 && gz2.st === 'x';
      }
    }
    /* The commit button lives here now, beside the number it commits.
     *
       It is still gated on a basket with something in it — this whole
       function returns early on an empty one — because a button that adds
       nothing is not a button, and a test pins that contract. What changed is
       only WHERE it sits once it exists: on the bar already pinned to the
       bottom of the viewport rather than at the top of a header that scrolls
       away while you fill the basket it commits. */
    /* The readout is the handle. It already says what the basket comes to, so
       pressing it to see what that is made of is the shortest sentence the
       sheet can offer — and it puts a second control on the bar without
       adding a second thing to read. */
    return '<div class="mp-foot' + (busts ? ' busts' : '') + '">' +
      '<button class="mp-foot-t" data-mpbasket="1" aria-expanded="' +
        (S.mpBasketOpen ? 'true' : 'false') + '" aria-label="' +
        (S.mpBasketOpen ? 'Hide what is in the basket' : 'Show what is in the basket') + '">' +
        '<span class="mp-foot-b">' +
          '<span class="mp-foot-m">' +
            (busts ? '<i class="mp-foot-l">Over this meal by ' + over + '</i> &middot; ' : '') +
            (est ? '~' : '') + Math.round(t.kcal) + ' kcal &middot; ' +
            Math.round(t.p) + 'P &middot; ' + Math.round(t.f) + 'F &middot; ' +
            Math.round(t.c) + 'C</span>' +
          /* The names, on the bar. The list behind this button has always
             existed and Blake never found it — "I see I have a qty but I
             don't see what they are" — because the only thing pointing at it
             was a ‹, a LEFT-pointing chevron on a drawer that opens upward,
             sitting beside a number instead of beside what it reveals. The
             same mistake the meal fold made in v211: the mark was not on the
             edge that moves.

             Two names and a count. Three fits when they are short and does
             not when one of them is "Genius Gourmet Sparkling Protein Fruit
             Punch", and a bar that reflows as you pick is worse than one that
             always says the same amount. The drawer keeps the rest, and keeps
             the quantities, which are the part you adjust least. */
          '<span class="mp-foot-n">' + esc(mBasketNames(ids)) + '</span>' +
        '</span>' +
        '<span class="mp-foot-c' + (S.mpBasketOpen ? ' open' : '') +
          '" aria-hidden="true">&#8964;</span>' +
      '</button>' +
      '<button class="mp-done" data-mpdone="1">Add ' + ids.length + '</button>' +
    '</div>';
  }

  /* Two names and a tally. Not every name: the bar has one line for them and
     the longest food in Blake's own basket is forty-three characters. */
  function mBasketNames(ids) {
    var names = [];
    ids.forEach(function (bk) {
      var r = LIVE.BY_ID[idOf(bk)];
      if (r) names.push(r.name);
    });
    if (!names.length) return '';
    if (names.length <= 2) return names.join(', ');
    return names.slice(0, 2).join(', ') + ' +' + (names.length - 2) + ' more';
  }

  return { mBasketBarHTML: mBasketBarHTML };
};
