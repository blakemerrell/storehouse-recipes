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
  var mAnyShut = app.mAnyShut;
  var mBatchStrip = app.mBatchStrip;
  var mCanFav = app.mCanFav;
  var mCascadeLineHTML = app.mCascadeLineHTML;
  var mDay = app.mDay;
  var mDayTargets = app.mDayTargets;
  var mDialUnit = app.mDialUnit;
  var mDoneAt = app.mDoneAt;
  var mEarliestKey = app.mEarliestKey;
  var mEditDay = app.mEditDay;
  var mFillRoom = app.mFillRoom;
  var mFoldForget = app.mFoldForget;
  var mIcon = app.mIcon;
  var mIsFav = app.mIsFav;
  var mLastFinished = app.mLastFinished;
  var mLatestKey = app.mLatestKey;
  var mLongDate = app.mLongDate;
  var mMacLine = app.mMacLine;
  var mMarkAccountUI = app.mMarkAccountUI;
  var mMealAsk = app.mMealAsk;
  var mMealPillsHTML = app.mMealPillsHTML;
  var mMealPillsSay = app.mMealPillsSay;
  var mPortion = app.mPortion;
  var mPortionText = app.mPortionText;
  var mReadSlots = app.mReadSlots;
  var mSaltChip = app.mSaltChip;
  var mSendOf = app.mSendOf;
  var mServeG = app.mServeG;
  var mSkipped = app.mSkipped;
  var mSnapTargets = app.mSnapTargets;
  var mTypedFromX = app.mTypedFromX;
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

    /* The fold is decided when you ARRIVE at a day, and not again. Working it
       out live meant a meal collapsed under the hand that had just finished
       ticking it — and computing it from "is this eaten" made every tick a
       potential disappearing act. So: everything with food on it starts
       folded, the meal you were last working on stays open, and after that
       nothing folds unless you fold it. */
    if (S.mFoldFor !== k) {
      S.mFoldFor = k;
      var keepWeigh = S.mFold.weigh;
      S.mFold = {};
      if (keepWeigh !== undefined) S.mFold.weigh = keepWeigh;
      /* ...and the meal holding an unanswered question stays open too.
       *
         The cascade card lives INSIDE the meal's fold, which is Blake's own
         call and the right one: "as soon as I select that share or steal
         I'd expect the macro pills to update, and then when I close the card
         it's not seen any more." A question about a meal should not outlive
         shutting that meal.
       *
         But arriving at the day is not shutting it. Everything with food on
         it folds on arrival, the finished meal carrying the card has food on
         it, and so the card was folded away before it had been read once —
         every reload, every tab switch, every return to My Day. Blake, on a
         day whose lunch ran 750 over: no card anywhere. The one screen that
         would tell him where the overflow went was reachable only in the
         same session he ticked the meal off in, which is why the whole thing
         has been redesigned twice by somebody who had never seen it at rest.
       *
         Answered is different. Done sets `ack`, the card becomes one line,
         and this stops holding the meal open — which is the point of having
         answered it. */
      var askK = '';
      var ev0 = mLastFinished(targets, slots);
      if (ev0 && Math.abs(ev0.miss) >= LIVE.MCASCADE_MIN) {
        var sn0 = mSendOf(k);
        if (!(sn0 && sn0.f === ev0.k && sn0.ack)) askK = ev0.k;
      }
      slots.list.forEach(function (s2) {
        S.mFold[s2.k] = (day[s2.k] || []).length > 0 &&
          s2.k !== S.mTouched && s2.k !== askK;
      });
      Object.keys(day).forEach(function (sk2) {
        if (S.mFold[sk2] === undefined) S.mFold[sk2] = (day[sk2] || []).length > 0;
      });
    }

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

    /* One card per meal on the plan, then a card for anything a bygone meal
       left on this day — removed from the plan is not removed from history. */
    var ahead = mAhead(k);
    var slotCard = function (sk, name, onPlan) {
      var items = day[sk] || [];
      /* Rows map over the STORED array so data attributes carry storage
         indexes; an unresolvable id (a deleted own recipe) renders as nothing
         but is never purged, the same bargain renderPlan strikes. */
      var srec = null;
      slots.list.forEach(function (s) { if (s.k === sk) srec = s; });
      var pins = (srec && srec.pins) || [];
      var rows = items.map(function (it, i) {
        var r = LIVE.BY_ID[it.id];
        if (!r) return '';
        var tag = sk + ':' + i;
        var pinned = pins.some(function (p) { return p.id === it.id; });
        // what you are having. What there was to have — the yield — went with
        // the provenance row, and mYieldText with it: this was its only caller.
        var port = mPortion(r, it.x);
        /* The tick and the name are separate targets on purpose: the box says
           "I ate it", the name opens the recipe to see what "it" is. When the
           two shared a label, reading the recipe cost you a phantom tick. */
        /* Two columns. On the left the plate says what it is: the tick, the
           name (clipped rather than wrapped — a long name must not push the
           controls off a phone), and under them the arithmetic with the pin
           and the lock. On the right, always in the same place, the portion
           dial and the bin.
         *
           The bin is a bin and not another ×. Two × glyphs on one row, one
           meaning "times one" and the other "gone", is a misread waiting to
           happen on a thumb-sized target. */
        /* One plate, contained.
         *
           It used to be three rows with three different left edges — name and
           its icons, then chips and the arithmetic, then a stepper slab and a
           tick box. Blake: "it feels off to me. does not flow." The diagnosis
           that stuck was that the card was built out of CONTROLS with the
           content squeezed between them, and that the loudest boxes on it —
           the stepper and the tick — were the two things touched least often,
           while the name read every time carried no weight at all.

           He also ruled out the easy fix: "I have the skip, add, share,
           balance, lock, borrow... all those are things I want and use. They
           just need to be organized better." So nothing was removed.

           The plate is its own block, and everything inside it obviously
           belongs to it. That containment is the scope system: this block is
           THIS FOOD, the verbs at the card's foot are THIS MEAL, the borrow
           line is THE DAY — three scopes that previously looked identical and
           sat in one card. Word labels were drawn for the same job and
           dropped; the box says it without spending three rows per meal.

           Row one is the food: are you done with it, what is it, is it worth
           eating. Row two is today's portion and what it costs. */
        /* Three bands, and each answers one question.
         *
           Blake's layout, after a round of drawings: "Box. Outline.
           [Image][leaf score][name]......[pin][fav] / Practical uom. Cal PFC
           / [lock][serving size][-][+]......[check box]".
         *
           WHAT IS THIS — the leaf leads the row at full size, the name runs
           to the two controls that keep it: pin for the routine, the star
           for the book. WHAT IS IN IT — the weight and the four figures,
           indented under the name so they read as belonging to it. WHAT CAN
           I DO — one outlined strip carrying every verb that acts on this
           plate, with the portion boxed and its steppers joined to its right
           so the three things that change the amount read as one control.
         *
           The check moves to the far end of that strip and gains a word. It
           is the thing pressed most on the row and it was a 21px square in
           the corner furthest from a thumb, which is exactly backwards.
         *
           There is no image slot, because there are no images: 335 recipes
           and 221 foods, not a photograph among them. The leaf is what a
           plate has, and it is the better token anyway — it carries a number
           worth reading. */
        return '<div class="mitem' + (it.eaten ? ' eaten' : '') +
            (it.l ? ' held' : '') + '">' +
          '<div class="mitem-r1">' +
            /* The slot is kept even when there is no score to put in it.
               A badge drawn for a recipe and absent for a food cannot be the
               thing a column starts on: it puts two plates of one meal at two
               different left edges, which is a thing you feel without being
               able to name it. This file has the note already, from the last
               time the leaf led a row — and leading it again is exactly how
               the fault comes back. */
            (r.score === null || r.score === undefined
              ? '<span class="leaf-md leaf-gap" aria-hidden="true"></span>'
              : leaf(r.score, 'leaf-md')) +
            /* A recipe's name opens the recipe. A food's name opens the
               food: what one of it is, and — for a meal you kept together —
               the parts it was made of. It used to be a dead label, which
               left a five-part salad reading as one word and no way back. */
            /* The name, and — on a food Fill added — why, beside it: a chip
               that drops under the name only when the name is long. Blake:
               the endive logic is fine, "it's just invisible in the app". */
            '<span class="mitem-nm">' +
            (r.food
              ? '<button class="mitem-name mitem-food" data-mfood="' + esc(String(r.id)) +
                '" data-mx="' + it.x + '" data-mfslot="' + esc(sk) + '">' + esc(r.name) + '</button>'
              : '<button class="mitem-name" data-open="' + esc(String(r.id)) +
                '" data-mx="' + it.x + '">' + esc(r.name) + '</button>') +
            '</span>' +
            '<span class="mitem-keep no-print">' +
              /* The pin is the routine: this food on this meal on every new
                 day — the Crio Brü that opens every morning without being
                 asked. Unpinning stops tomorrow, not today. */
              (onPlan ? '<button class="mic mpin" data-mpin="' + tag + '" aria-pressed="' +
                (pinned ? 'true' : 'false') + '" aria-label="' +
                (pinned ? 'Unpin from this meal' : 'Pin to this meal every day') + '">' +
                '<svg viewBox="0 0 16 16" aria-hidden="true">' +
                  '<path d="M5.4 2.6h5.2M8 2.6v4.3M6.4 6.9c-.4 1.7-1.5 2.7-2.6 3.1h8.4' +
                    'c-1.1-.4-2.2-1.4-2.6-3.1Z" fill="none" stroke="currentColor" ' +
                    'stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/>' +
                  '<path d="M8 10v3.4" fill="none" stroke="currentColor" ' +
                    'stroke-width="1.2" stroke-linecap="round"/>' +
                '</svg></button>' : '') +
              /* The star, new here. It lived only in the picker, which meant
                 you could keep a dish while shopping for it and not on the
                 day you actually ate it — and the day you ate it is the day
                 you know. A table food is not yours to star; one of your own
                 is. */
              (mCanFav(r) ? '<button class="mic mfav" data-mfav="' + esc(String(r.id)) +
                '" aria-pressed="' + (mIsFav(r) ? 'true' : 'false') + '" aria-label="' +
                (mIsFav(r) ? 'Remove from favourites' : 'Keep as a favourite') + '">' +
                '<svg viewBox="0 0 16 16" aria-hidden="true">' +
                  '<path d="M8 2.2l1.8 3.7 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4L2.2 6.5l4-.6Z" ' +
                    'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>' +
                '</svg></button>' : '') +
            '</span>' +
          '</div>' +
          mWhyStrip(it, tag) +
          mBatchStrip(r, it, tag) +
          /* What it is in the kitchen, and what it costs you.
           *
             The weight leads, because Blake weighs: "sometimes it's just
             easier for me to measure the food on a scale than using cups."
             A cup of oats is a range and 40 g of oats is 40 g, and every one
             of the foods in the table carries unit-to-gram weights.
           *
             The salt is a sibling of the figures, not inside them: the four
             numbers keep their own nowrap so they drop to a second line
             whole rather than breaking across two. */
          /* The "why" chip leads the figures' row rather than sharing the
             name's: Blake, seeing names wrap around it, "add that new Fill's
             pick pill or added for fiber pill to the row below it" — with the
             strip it opens sitting above, under the name. */
          '<div class="mitem-r2">' +
            mWhyChip(it, tag) +
            (function () {
              /* A recipe's plate says what it weighs: the thing you put on
                 the scale. A tap weighs the batch or says how it was got. */
              var sg = mServeG(r);
              if (!sg) return port.detail ? '<span class="mitem-uom">' + esc(port.detail) + '</span>' : '';
              return '<button class="mitem-uom mitem-bw' + (sg.est ? ' est' : '') + '" data-mbatch="' + tag +
                '" aria-expanded="' + (S.mBatchOpen === tag ? 'true' : 'false') + '" aria-label="' +
                (sg.est ? 'About ' : '') + Math.round(sg.g * it.x) + ' grams on this plate">' +
                (sg.est ? '~' : '') + Math.round(sg.g * it.x) + ' g</button>';
            })() +
            '<span class="mitem-mac">' + mMacLine(r, it.x) + '</span>' +
            mSaltChip(r, it.x) +
          '</div>' +
          '<div class="mitem-r3 no-print">' +
            /* The two verbs in a group of their own, tight together, with the
               dial's own air after them. Proximity is the only thing saying
               these two belong to each other rather than to the portion
               beside them — spaced like everything else they read as one
               left-packed strip, which is what Blake called "not spread out
               well" the last time this row was built. */
            '<span class="mitem-verbs">' +
            '<button class="mic mdel" data-mdel="' + tag + '" aria-label="Remove ' + esc(r.name) + '">' +
              '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.2a1 1 0 0 0 1 .8h3.8a1 1 0 0 0 1-.8l.6-8.2" ' +
              'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</button>' +
            /* The lock guards against the MACHINE, not you — Rebalance leaves
               a locked plate alone but the stepper still works — so it sits
               beside the bin rather than inside the dial. Live even on an
               eaten plate: holding a food steady while the rest of the day
               moves around it is still worth saying afterwards. */
            (onPlan ? '<button class="mic mlock" data-mlock="' + tag + '" aria-pressed="' +
              (it.l ? 'true' : 'false') + '" aria-label="' +
              (it.l ? 'Unlock for Rebalance' : 'Lock against Rebalance') + '">' +
              '<svg viewBox="0 0 16 16" aria-hidden="true">' +
                '<rect x="3.4" y="7" width="9.2" height="6.4" rx="1.6" fill="none" ' +
                  'stroke="currentColor" stroke-width="1.2"/>' +
                '<path d="M5.6 7V5.1a2.4 2.4 0 0 1 4.8 0V7" fill="none" ' +
                  'stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
              '</svg></button>' : '') +
            '</span>' +
            /* Eaten is a record, not a dial. Once the tick is on, this plate
               is a thing that happened, and resizing what you already ate is
               editing the past — so the stepper goes quiet. One tap on the
               number hands it back.
             *
               The number is a button and pressing it lets you type one. The
               dial got you from one to two; it never got you to thirty nuts
               or a hundred and eighty-five grams. */
            /* The portion and its two steppers, together, in that order.
             *
               Blake: "Outline the serving size in a box as well. With +/- on
               the right side of it." Which is also the better grouping: the
               three things that change the amount now read as one control
               rather than as a number with a button on either side of it.
             *
               Still inside .mstep, and the figure still wears .mstep-x. Those
               two names are what fifteen tests reach for — typing a portion,
               stepping it, what it wraps to, what an eaten plate does to it —
               and not one of them is about where on the card it sits. Moving
               the element out of its own container to rearrange it is how a
               layout change turns into a behaviour change. */
            '<span class="mstep' + (it.eaten && S.mEdit !== tag ? ' spent' : '') + '">' +
              /* Eaten is a record, not a dial. Once the tick is on, this plate
                 is a thing that happened, and resizing what you already ate is
                 editing the past — so the stepper goes quiet. One tap on the
                 number hands it back.
               *
                 The number is a button and pressing it lets you type one. The
                 dial got you from one to two; it never got you to thirty nuts
                 or a hundred and eighty-five grams. */
              (S.mType === tag
                ? '<span class="mstep-x mitem-amt mitem-typing">' +
                    '<input class="mstep-in" type="text" inputmode="decimal" ' +
                      'autocomplete="off" data-mtypein="' + tag + '" ' +
                      'aria-label="Portion, in ' + esc(mDialUnit(r)) + '" ' +
                      'value="' + esc(String(mTypedFromX(r, it.x))) + '">' +
                    '<i>' + esc(mDialUnit(r)) + '</i>' +
                  '</span>'
                : it.eaten && S.mEdit !== tag
                ? '<button class="mstep-x mitem-amt mstep-wake" data-medit="' + tag +
                  '" title="Correct this portion">' + esc(port.head) + '</button>'
                : '<button class="mstep-x mitem-amt mstep-type" data-mtype="' + tag +
                  '" title="Type a portion">' + esc(port.head) + '</button>') +
              '<span class="mstep-keys">' +
                '<button data-mstep="' + tag + ':down"' + (it.eaten && S.mEdit !== tag ? ' disabled' : '') +
                  ' aria-label="Smaller portion">&minus;</button>' +
                '<button data-mstep="' + tag + ':up"' + (it.eaten && S.mEdit !== tag ? ' disabled' : '') +
                  ' aria-label="Bigger portion">+</button>' +
              '</span>' +
            '</span>' +
            /* The thing pressed most, at the end of the strip. It was a 21px
               box in the top-left corner — the state of the plate, given the
               smallest target and the furthest reach — then a labelled
               button, and now the box on its own: Blake, on the labelled
               one, "why a check box inside a box?" Quite. The input IS the
               control and it is drawn at full size; a frame around a
               checkbox is a second edge saying what the first one said. */
            '<input class="mitem-ate" type="checkbox" data-meat="' + tag + '"' +
              (it.eaten ? ' checked' : '') + (ahead ? ' disabled' : '') +
              ' aria-label="Eaten">' +
          '</div>' +
        '</div>';
      }).join('');
      if (!onPlan && !rows) return '';        // a bygone meal with nothing left says nothing
      var sub = { kcal: 0, p: 0, f: 0, c: 0 };
      items.forEach(function (it) {
        var r = LIVE.BY_ID[it.id];
        if (!r || !r.macro) return;
        sub.kcal += (r.macro.kcal || 0) * it.x; sub.p += (r.macro.p || 0) * it.x;
        sub.f += (r.macro.f || 0) * it.x; sub.c += (r.macro.c || 0) * it.x;
      });
      /* Three states on the rail, not two. A hollow dot is a meal with
         nothing on it; an ochre one is a meal planned and still ahead of
         you; a filled one is a meal you have eaten. The last was the whole
         point of running the day down a line — what is behind you — and it
         was the one state never wired up. */
      var eatenAll = items.length && items.every(function (it) {
        return it.eaten || !LIVE.BY_ID[it.id];
      });
      /* Folded by default on a day that is over, never on the one you are
         living. Folding the moment a meal was fully ticked collapsed it under
         the hand that ticked it — and took away the untick. S.mFold holds
         only what you have pressed, so it never has to be cleaned up. */
      var folded = !!(items.length && S.mFold[sk]);
      var addBtn = '<button class="mslot-act add mslot-add" data-mslot="' + esc(sk) + '" ' +
        'aria-label="Add food to ' + esc(name) + '" title="Add food">' + mIcon('plus') + '</button>';
      /* Said once, used by whichever of the two headers this meal draws. */
      var pillsSay = mMealPillsSay(sub, mMealAsk(sk, targets, slots), targets);

      /* Skipped. One line instead of a card, struck through, with the way
         back on it — a day where lunch is visibly not happening tells you
         more later than a day where lunch simply is not there. Drawn before
         the card rather than instead of parts of it, because a skipped meal
         has no numbers, no plates and nothing to fold.
       *
         ...but it does have a WHOLE MEAL'S worth of calories to hand out,
         which is the largest cascade there is, and this row used to announce
         the handout as a fait accompli: "its share went to the rest". Blake:
         "with skip, should I also be able to tell it where to send the
         macros and calories?" He could not — and not because the chooser
         refused him, but because it was unreachable: it renders inside
         .mslot-items, and this branch returns before that exists. So the
         line carries it. Folded, the card is itself one line, which is what
         this row already was. */
      if (onPlan && !items.length && mSkipped(k, sk)) {
        var skSend = mCascadeLineHTML(sk, targets, slots);
        return '<div class="mslot mslot-skipped' + (skSend ? ' mslot-skipped-c' : '') + '">' +
          '<div class="mslot-skip-h">' +
            '<span class="mslot-skip-n">' + esc(name) + '</span>' +
            /* The row says only that it is skipped once the card below it is
               saying where the food went. Two sentences about one handout,
               one of them vague, is how the old row read. */
            '<span class="mslot-skip-w">' +
              (skSend ? 'skipped' : 'skipped &middot; its share went to the rest') + '</span>' +
            '<button class="ghost mslot-unskip no-print" data-mskip="' + esc(sk) + '" ' +
              'aria-label="Put ' + esc(name) + ' back">Undo</button>' +
          '</div>' + skSend +
        '</div>';
      }

      return '<div class="mslot mday-stop' + (items.length ? ' filled' : '') +
        (eatenAll ? ' done' : '') + '">' +
        /* The dot was a pseudo-element: it could say a meal was behind you
           but never be told so, and no keyboard or screen reader knew it was
           there at all. It is a button now — press it and the whole meal is
           eaten, press it again and it is not. */

        /* Two lines, because five things will not fit across a phone: the
           name, the verdict and the controls up top, what the meal actually
           comes to underneath. One row made the Add button wrap and doubled
           the height of every meal on the day. */
        '<div class="mslot-h">' +
          /* The dot came off the rail and onto the card, because it was never
             decoration: pressing it marks the whole meal eaten. Losing the
             line it hung from must not lose the control with it. */
          '<button class="mday-dot no-print" data-mdot="' + esc(sk) + '"' +
            (items.length && !ahead ? '' : ' disabled') +
            ' aria-pressed="' + (eatenAll ? 'true' : 'false') + '"' +
            ' aria-label="' + (eatenAll ? 'Mark ' + esc(name) + ' not eaten'
              : 'Mark all of ' + esc(name) + ' eaten') + '"></button>' +
          /* The name is the handle. A meal you have eaten is history — its
             steppers and locks have nothing left to do — so it folds down to
             a list of what was on it, and anything still ahead of you stays
             open. Pressing the name overrides either way.
           *
             The name still folds it, and always has — that target is the
             width of the word and costs nothing to keep. But the name is at
             the far LEFT of a phone, which is the one place a thumb is not,
             and it never said the meal could fold in the first place. The
             handle that says so lives over on the right, below. */
          /* ...but only while there is something to fold.
           *
             On an EMPTY meal the name was still a fold button, and pressing
             it did nothing you could see — `folded` is gated on items.length
             and the seam only exists `if (rows)`, so the card did not move.
             The handler wrote S.mFold[sk] all the same, and mFoldFor stops
             Fill from clearing it. So: press an empty meal's name, press
             Fill, and that one meal comes back FOLDED with no steppers while
             every other meal opens. Measured — 157px and zero steppers
             against 193px and two.

             The fix is the honest one rather than clearing the flag later: a
             control that cannot do anything should not be a control. */
          /* The whole head is the door.
           *
             The mockup Blake approved says it in those words, and its card is
             one <button> carrying the name, the cue AND the meal's pills. The
             app had the name as a button instead — 11.5px of uppercase text,
             a 78x14 target adrift in a 378x45 row — because the row was
             carrying three icon buttons and a button cannot hold buttons. So
             the verbs moved to the foot of the open meal, where the mockup
             has them and where they read as words, and the head became what
             it looks like: the thing you press to open the meal.
           *
             The dot stays outside it. It marks the whole meal eaten, which is
             an action of its own, and the mockup's dot is decoration only
             because the mockup never modelled that control. */
          (rows
            /* The label carries the meal's numbers now, because nothing else
               can. The pills are aria-hidden and always were; the head is a
               <button>, and a button's accessible name comes from its own
               aria-label and overrides everything inside it — so marking up
               the pills would not have helped even before they were hidden.
               A screen reader has been getting "Open Breakfast" and not one
               figure off the card since this header was built. */
            ? '<button class="mslot-head" data-mfold="' + esc(sk) + '" aria-expanded="' +
              (folded ? 'false' : 'true') + '" aria-label="' +
              (folded ? 'Open ' : 'Fold ') + esc(name) +
              (pillsSay ? ' — ' + esc(pillsSay) : '') + '">' +
              /* One line: the name, then the meal's numbers, then the mark.
               *
                 They were stacked — name on top, pills beneath — which gave
                 every meal a two-row header and pushed the plates down by the
                 height of a row times six meals. On the line with the name
                 they read as what they are: this meal, and how it is going.
                 The name gives way first when the row runs out, because a
                 clipped word still says which meal it is and a clipped number
                 says nothing at all. */
              '<span class="mslot-name">' + esc(name) + '</span>' +
              '<span class="mslot-sp"></span>' +
              /* The numbers and the mark travel together. Loose, the mark
                 wrapped on its own the moment the row ran out — a chevron
                 alone on a second line, under nothing, belonging to nothing.
                 As one piece they either both sit beside the name or both
                 take the next line, and the mark is at the right of whichever
                 line they are on. */
              '<span class="mslot-tail">' +
                mMealPillsHTML(sub, mMealAsk(sk, targets, slots), targets, !eatenAll, !rows) +
                '<span class="mfold-cue" aria-hidden="true">&#8964;</span>' +
              '</span>' +
              '</button>'
            /* An empty meal wears the same four pills as a full one.
             *
               It used to get a single flame and a calorie figure, which told
               you the size of the meal and nothing about its shape — and the
               shape is the part you plan against. A meal you have not filled
               is precisely the meal you need the numbers for: 0 of 44 protein
               says what to go looking for, 🔥387 does not.
             *
               No mark on the end, because there is nothing behind it to fold.
               The strip is drawn at planned weight either way, so a day of
               six untouched meals reads as six quiet rows rather than
               twenty-four accusations. */
            /* An empty meal has no button to hang a label on, so it says the
               same sentence in a span only a reader hears. It is the meal
               MOST worth hearing — an empty one is the one you are about to
               fill, and "0 of 44 protein" is what tells you what to go
               looking for. */
            : '<span class="mslot-name mslot-name-flat">' + esc(name) + '</span>' +
              (pillsSay ? '<span class="vis-hidden">' + esc(pillsSay) + '</span>' : '') +
              '<span class="mslot-sp"></span>' +
              '<span class="mslot-tail">' +
                mMealPillsHTML(sub, mMealAsk(sk, targets, slots), targets, !eatenAll, !rows) +
              '</span>') +
          /* Only where there is something to solve. One plate has a stepper
             and needs no algebra; two or more is the question this answers,
             and a button on every meal from breakfast onward would be four
             buttons a day that nothing was ever pressed on. */

          /* No label. It said "everywhere", which only means something to
             somebody who already knows a meal is normally fenced to its own
             sections — and that fence has no marker of its own, so the word
             was naming the exit from a room nobody had been told they were
             in. The widening still happens; it just stops announcing itself
             in a vocabulary of one word. The suggestions ARE the message. */

          /* A plus, not "+ Add". Everybody knows what a plus does, and the
             word was the widest thing on a row that has too much on it. The
             label the word used to give is now the button's own, said to a
             screen reader instead of to the eye — and said better, because it
             names the meal the food is going on. */

        '</div>' +
        /* What the meal comes to, in the same four colours the bars use. */
        /* The handle is the bar the fold actually happens at. A boxed caret up
           in the header read as a third action button beside Add and the
           retry, and on a meal that also carries the scale it made four boxes
           fighting over one row. This is the seam instead: the meal's own
           numbers, sitting exactly where the plates appear and disappear,
           with a small mark on the end saying which way the next press goes.
           Full width, so the target is the whole strip rather than a glyph. */
        (folded
          ? '<div class="mslot-thin">' + items.map(function (it) {
              var r2 = LIVE.BY_ID[it.id];
              if (!r2) return '';
              return '<div class="mthin' + (it.eaten ? ' eaten' : '') + '">' +
                /* Its leaf, as the bullet. Shut, this is the only place the
                   score survives — and a shut meal is exactly when several of
                   them are being read at once. */
                (r2.score === null || r2.score === undefined
                  ? '<span class="mthin-dot" aria-hidden="true">&middot;</span>'
                  : leaf(r2.score, 'leaf-sm')) +
                /* The same door the open plate's name is. A shut meal is
                   still a list of food, and the name of a thing you are about
                   to cook has to be pressable whichever way the card is
                   folded — going to the recipe should not cost you opening
                   the meal first. The delegated handlers on #macroSlots
                   already answer both of these, so the row needs nothing of
                   its own; it only has to be the same shape. */
                (r2.food
                  ? '<button class="mthin-n mitem-food" data-mfood="' + esc(String(r2.id)) +
                    '" data-mx="' + it.x + '" data-mfslot="' + esc(sk) + '">' + esc(r2.name) + '</button>'
                  : '<button class="mthin-n" data-open="' + esc(String(r2.id)) +
                    '" data-mx="' + it.x + '">' + esc(r2.name) + '</button>') +
                /* The same portion words the open plate uses — "1 cup ·
                   130 g", "1½ servings" — so a folded meal reads as food
                   rather than as multipliers. */
                /* Held, said where the holding is visible.
                 *
                   The lock lives on the open plate, beside the portion it
                   holds still. Shut, the row carried no sign of it at all —
                   so the ordinary gesture (lock the dinner you promised the
                   family, fold the card, press Rebalance) gave back a day
                   with no way to see what had been spared. Eaten already
                   marks itself here; held had nothing.

                   Beside the portion, because that is where it sits on the
                   open plate and a fold should not move things. */
                '<span class="mthin-x">' + esc(mPortionText(r2, it.x)) +
                  (it.l ? ' <span class="mthin-l" role="img" aria-label="held through Rebalance"'
                    + ' title="Held through Rebalance">&#128274;</span>' : '') +
                '</span>' +
                /* Eaten is a tick in the tick's own column, and the name in
                   ink. It was a rule through the name, which reads as
                   deleted — and the plan was the one in ink, so the food you
                   had not eaten yet looked more real than the food you had.
                   Blake: "Eaten shows a ✓ in normal text, planned looks
                   lighter; no strike-through." */
                (it.eaten
                  ? '<span class="mthin-ok" role="img" aria-label="eaten">&#10003;</span>'
                  : '<span class="mthin-ok is-plan"><span class="vis-hidden">planned</span></span>') +
                '</div>';
            }).join('') + '</div>'
          : '<div class="mslot-items">' +
            /* Open is where the ± buttons are, so it is where the whole
               picture belongs — directly above the thing that changes it.
             *
               An empty meal gets NOTHING here, where it used to get an em
               dash on a line of its own. The dash said what the pills on the
               header already say — a meal reading 🔥0/262 is plainly empty —
               and it said it in about 26 px, on every empty meal, of every
               empty day, which is most of what tomorrow looks like. On a
               six-meal day that is over 150 px of placeholder before any food
               is reached. The card goes from three rows to two, and the row
               it loses is the one that was nothing. */
            rows +
            /* The verbs, at the foot of the meal they act on.
             *
               They were three icon buttons in the header, which is what
               stopped the header being a button and left the fold target the
               width of the word "BREAKFAST". Down here they are words: a ⚖
               and a ↻ are a guess every time until you have pressed them
               once, and the row they used to crowd is now the thing you press
               to open the meal. They are also only drawn on an OPEN meal,
               which is the only state they mean anything in — you cannot
               balance plates you cannot see. */
            (onPlan
              ? '<div class="mslot-acts no-print">' +
                /* Only the verbs this meal can actually use.
                 *
                   An EMPTY meal gets Skip instead of the other two. "Another"
                   means "not that one, what else" and "Balance" means "solve
                   these against each other", and neither is a question you
                   have about a meal with nothing on it — drawn anyway they
                   were two dead buttons on every empty meal of every empty
                   day, which is most of what tomorrow looks like. Skip is the
                   verb that meal DOES have, and it was over in the header
                   wearing a ⊘ that nobody reads as a word. The mockup's own
                   rule: controls that cannot act are not drawn.
                 *
                   And you still do not skip a meal you have put food on —
                   you delete the food. */
                (items.length
                  ? '<button class="mslot-act mslot-try" data-mtry="' + esc(sk) + '"' +
                      /* Named aloud, since the meal's verbs are drawn
                         without their words. */
                      ' aria-label="Another suggestion for ' + esc(name) + '"' +
                      ' title="Another suggestion \u2014 walks down the best-fit list">' +
                      mIcon('another') + '</button>' +
                    '<button class="mslot-act mslot-bal" data-mbal="' + esc(sk) + '"' +
                      (items.length >= 2 ? '' : ' disabled') +
                      ' aria-label="Balance the portions on ' + esc(name) + '"' +
                      ' title="Solve these portions against this meal\u2019s macros">' +
                      mIcon('scales') + '</button>'
                  : '<button class="mslot-act mslot-skip" data-mskip="' + esc(sk) + '" ' +
                      'aria-label="Skip ' + esc(name) + ' today" ' +
                      'title="Not eating this today \u2014 its share goes to the other meals">' +
                      mIcon('skip') + '</button>') +
                /* Keeping several plates as one thing is a verb, and this is
                   where this meal's verbs live.
                 *
                   It was a full-width dashed slab between the last plate and
                   this row — as tall as a plate, drawn in the ochre a control
                   is drawn in, competing with the food above it for a thing
                   you do to a meal maybe twice. The scope system the plate was
                   rebuilt around says it plainly: the block is THIS FOOD, this
                   row is THIS MEAL, the cascade line is THE DAY. A slab
                   floating between the plates and the verbs belonged to
                   neither. It is still only drawn where it can act. */
                /* One row, always. Blake: "get all the buttons on the food
                   tag into a single row", and then "Just use icons and the
                   box size that is in the meal/food card uses." Each verb is
                   its drawing alone, in a plate key's box; its spoken name
                   and tooltip say the rest. Save is these plates kept as one
                   food you can reuse (a chain: kept together), Repeat is this
                   meal copied from another day. Add is last, alone at the
                   right edge, where the thumb already goes. */
                (items.length >= 2
                  ? '<button class="mslot-act mslot-keep" data-mkeep="' + esc(sk) + '" ' +
                    'aria-label="Save these plates as one food you can reuse" ' +
                    'title="Save these plates as one food you can reuse">' +
                    mIcon('keep') + '</button>' : '') +
                /* The same meal on another day, whole, in one tap. */
                '<button class="mslot-act mslot-from" data-mfrom="' + esc(sk) + '" ' +
                  'aria-label="Repeat ' + esc(name) + ' from another day" ' +
                  'title="Copy this meal from another day">' + mIcon('fromday') + '</button>' +
                addBtn +
                '</div>'
              : '') +
            /* INSIDE the fold, and last. It was outside the card on the
               reasoning that a folded meal should still be able to say what
               its miss did — which was wrong about what folding means. Blake,
               on his own day: "the overage tag is still seen even after I
               closed the meal tag". Shutting a meal is how you say you are
               done with it, and the line is a question about that meal; a
               question that outlives being dismissed is a nag. The pills
               carry the answer afterwards, and they are on the header, which
               a folded card keeps. */
            (onPlan ? mCascadeLineHTML(sk, targets, slots) : '') +
          '</div>') +
      '</div>';
    };
    var html = slots.list.map(function (s) { return slotCard(s.k, s.n, true); }).join('');
    var onPlanKeys = slots.list.map(function (s) { return s.k; });
    Object.keys(day).forEach(function (sk) {
      if (onPlanKeys.indexOf(sk) < 0) html += slotCard(sk, slots.names[sk] || 'Meal', false);
    });
    $('macroSlots').innerHTML = html;

    var shut = mAnyShut();
    /* The word says what the next press does, and the chevrons point the
       way the cards will go: apart to open, together to shut. */
    var oa = $('macroOpenAll'), oaw = shut ? 'Open all' : 'Close all';
    if (oa.getAttribute('data-w') !== oaw) {
      oa.setAttribute('data-w', oaw);
      oa.title = shut ? 'Open every meal' : 'Close every meal';
      oa.querySelector('.mday-w').textContent = oaw;
      oa.querySelector('path').setAttribute('d', shut ? 'M6 7.5 10 3.5l4 4M6 12.5l4 4 4-4'
        : 'M6 3.5l4 4 4-4M6 16.5l4-4 4 4');
    }

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

  return { renderMacros: renderMacros, mDayPick: mDayPick };
};
