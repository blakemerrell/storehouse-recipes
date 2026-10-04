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
  var mStepX = app.mStepX;
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
    /* The meal card, as Blake and the mockup settled it on 2026-10-04
       (https://claude.ai/artifact/GV6QBANqtLChvDU9vQAfeB).
     *
       Blake, on the card it replaced: "It works but it just feels messy and
       complicated... it needs to do its same job but feel effortless." A
       seven-food lunch was 93 buttons. Nothing has been taken away; it has
       moved behind a tap.
     *
       Shut, a meal is three lines: the tick, the name and what it comes to
       against its share; what is on it; one calorie bar and the verdict in
       words ("554 over · carbs over"). Blake chose the calorie bar alone over
       the macros as bars, as one split bar, or as rings round the tick.
     *
       Open, it is one line a food: the leaf, the name (still the door to the
       recipe or the food), the amount in grams with the kitchen's word — "140
       g · 1 cup", because Blake weighs — the calories, and the tick. Tapping
       the amount opens that one food's panel: the typed portion and its
       steps, a slider along the same steps, the macros and salt, and the
       food's verbs as icons — lock, swap, pin, star, the why chip and the bin.
       One panel at a time. */
    var LOCK_SM = '<svg class="mcard-lk" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.4" y="7" width="9.2" height="6.4" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.6 7V5.1a2.4 2.4 0 0 1 4.8 0V7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
    var CARET = '<svg class="mcard-caret" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 6.5 8 10l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var ICO = function (d) {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + d + '</g></svg>';
    };
    var I_LOCK = ICO('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>');
    var I_OPEN = ICO('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.6-1.7"/>');
    var I_SWAP = ICO('<path d="M4 8h13"/><path d="M14 4.5 17.5 8 14 11.5"/><path d="M20 16H7"/><path d="M10 12.5 6.5 16l3.5 3.5"/>');
    var I_PIN = ICO('<path d="M8.5 3.5h7M12 3.5v6.4M9.6 9.9c-.6 2.5-2.2 4-3.9 4.6h12.6c-1.7-.6-3.3-2.1-3.9-4.6Z"/><path d="M12 14.5v6"/>');
    var I_STAR = ICO('<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8Z"/>');
    var I_BIN = ICO('<path d="M4 7h16"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l1 12.5h9l1-12.5"/><path d="M10.5 11v5"/><path d="M13.5 11v5"/>');

    var fmtK = function (n) { return Math.round(n).toLocaleString('en-US'); };
    /* What the amount button says: the weight first, then the kitchen's word.
       mPortion already knows both; it just leads with whichever the food is
       counted in. A recipe weighs what mServeG says a serving weighs. */
    var amtText = function (r, x) {
      var p = mPortion(r, x);
      if (/\d g$/.test(p.head)) return p.head + (p.detail ? ' · ' + p.detail : '');
      if (/^\d[\d,]* g$/.test(p.detail || '')) return p.detail + ' · ' + p.head;
      var sg = !r.food && mServeG(r);
      if (sg && sg.g > 0) return (sg.est ? '~' : '') + Math.round(sg.g * x) + ' g · ' + p.head;
      return p.head;
    };
    /* The weight over the kitchen's word, stacked, so both fit beside a
       long name; the dot between them is kept for the words, hidden to the
       eye. */
    var amtStack = function (amt) {
      var at = amt.indexOf(' \u00b7 ');
      if (at < 0) return '<span class="mcard-g">' + esc(amt) + '</span>';
      return '<span class="mcard-stk"><span class="mcard-g">' + esc(amt.slice(0, at)) + '</span><i class="mcard-dot"> \u00b7 </i>' +
        '<span class="mcard-u">' + esc(amt.slice(at + 3)) + '</span></span>';
    };
    /* Every amount the steppers can reach from here, for the slider: down to
       the smallest, and up to three times where it sits (or twelve steps). */
    var slideXs = function (r, x) {
      var xs = [], v = x, i, nv;
      for (i = 0; i < 400; i++) {
        nv = mStepX(r, v, -1);
        if (!(nv > 0) || nv >= v) break;
        xs.unshift(nv); v = nv;
      }
      xs.push(x);
      var top = Math.max(x * 3, (xs[0] || x) * 12);
      for (v = x, i = 0; i < 400; i++) {
        nv = mStepX(r, v, 1);
        if (!(nv > v)) break;
        xs.push(nv); v = nv;
        if (nv >= top) break;
      }
      return xs;
    };
    /* Shut or open, a meal says one sentence about how it sits. */
    var verdict = function (sub, aim, eatenAll, n) {
      if (!n) return { cls: '', say: 'Nothing yet' };
      if (eatenAll) return { cls: 'is-eaten', say: 'Eaten' };
      if (!aim) return { cls: '', say: '' };
      var aimK = aim.kcal || (4 * (aim.p || 0) + 9 * (aim.f || 0) + 4 * (aim.c || 0));
      if (!(aimK > 0)) return { cls: '', say: '' };
      var dk = sub.kcal - aimK;
      var devs = [['protein', 'p'], ['fat', 'f'], ['carbs', 'c']].map(function (m) {
        var a = aim[m[1]] || 0;
        return [m[0], a > 0 ? (sub[m[1]] - a) / a : 0];
      }).sort(function (a, b) { return Math.abs(b[1]) - Math.abs(a[1]); });
      if (Math.abs(dk) <= aimK * 0.05 && Math.abs(devs[0][1]) <= 0.15) return { cls: 'is-on', say: 'on its aim' };
      return { cls: dk > aimK * 0.08 ? 'is-over' : 'is-short',
        say: (dk >= 0 ? fmtK(dk) + ' over' : fmtK(-dk) + ' short') +
          (Math.abs(devs[0][1]) > 0.15 ? ' · ' + devs[0][0] + (devs[0][1] > 0 ? ' over' : ' short') : '') };
    };
    /* What Balance moved and what the picker just put down, on this meal, if
       the plates are still the plates they were (a sync can reorder them). */
    /* One food's panel open at a time. 'sh.allPanels' is for the test runner
       alone: the suites that exercise the steps, the lock, the pin and the
       typed portion were written before those moved behind the amount, and
       what they test is what the controls DO, so the runner opens every
       panel. The meal card's own tests turn it off. */
    var panelOpen = function (tag) {
      if (S.mAmt === undefined) {
        try { S.mAmt = localStorage.getItem('sh.allPanels') === '1' ? '*' : ''; } catch (e) { S.mAmt = ''; }
      }
      return S.mAmt === '*' || S.mAmt === tag;
    };
    var marksFor = function (sk, items) {
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
    };

    var panelHTML = function (sk, r, it, tag, pinned, onPlan) {
      var port = mPortion(r, it.x);
      var amtAll = amtText(r, it.x), amtCut = amtAll.indexOf(' · ');
      var amtParts = amtCut < 0 ? [amtAll, ''] : [amtAll.slice(0, amtCut), amtAll.slice(amtCut + 3)];
      var spent = it.eaten && S.mEdit !== tag;
      var xs = slideXs(r, it.x), at = xs.indexOf(it.x);
      var sg = !r.food && mServeG(r);
      return '<div class="mcard-panel no-print" role="group" aria-label="' + esc(r.name) + '">' +
        '<div class="mcard-ptop">' +
          /* Grams first, then the measure (Blake, 2026-10-04: "Grams first and
             then shows me the real measurement"). A recipe's weight is the
             batch button, which weighs the batch when tapped. */
          (sg ? '' : '<b class="mcard-big num">' + esc(amtParts[0]) + '</b>') +
          (sg ? '<button class="mitem-uom mitem-bw mcard-bigbw' + (sg.est ? ' est' : '') + '" data-mbatch="' + tag +
            '" aria-expanded="' + (S.mBatchOpen === tag ? 'true' : 'false') + '" aria-label="' +
            (sg.est ? 'About ' : '') + Math.round(sg.g * it.x) + ' grams on this plate — weigh the batch">' +
            (sg.est ? '~' : '') + Math.round(sg.g * it.x) + ' g</button>' : '') +
        '</div>' +
        /* The kitchen's word is the chip on the cost line, where the eye
           already is: the dial is in grams, "1 cup" is how you measure it. */
        '<div class="mcard-pmac mitem-r2">' + mWhyChip(it, tag) +
          (amtParts[1] ? '<span class="mitem-uom">' + esc(amtParts[1]) + '</span>' : (!sg && port.detail ? '<span class="mitem-uom">' + esc(port.detail) + '</span>' : '')) +
          '<span class="mitem-mac">' + mMacLine(r, it.x) + '</span>' + mSaltChip(r, it.x) + '</div>' +
        mWhyStrip(it, tag) + mBatchStrip(r, it, tag) +
        /* Eaten is a record, not a dial: once ticked, the steps go quiet and
           one tap on the number hands them back. The number is a button and
           pressing it lets you type one — the dial never got you to thirty
           nuts or 185 grams. .mstep and .mstep-x keep their names: they are
           what the portion tests reach for. */
        '<div class="mcard-dial">' +
          '<span class="mstep' + (spent ? ' spent' : '') + '">' +
            (S.mType === tag
              ? '<span class="mstep-x mitem-amt mitem-typing">' +
                  '<input class="mstep-in" type="text" inputmode="decimal" autocomplete="off" data-mtypein="' + tag + '" ' +
                    'aria-label="Portion, in ' + esc(mDialUnit(r)) + '" value="' + esc(String(mTypedFromX(r, it.x))) + '">' +
                  '<i>' + esc(mDialUnit(r)) + '</i></span>'
              : spent
              ? '<button class="mstep-x mitem-amt mstep-wake" data-medit="' + tag + '" title="Correct this portion">' + esc(mPortion(r, it.x).head) + '</button>'
              : '<button class="mstep-x mitem-amt mstep-type" data-mtype="' + tag + '" title="Type a portion">' + esc(mPortion(r, it.x).head) + '</button>') +
            '<span class="mstep-keys">' +
              '<button data-mstep="' + tag + ':down"' + (spent ? ' disabled' : '') + ' aria-label="Smaller portion">&minus;</button>' +
              '<button data-mstep="' + tag + ':up"' + (spent ? ' disabled' : '') + ' aria-label="Bigger portion">+</button>' +
            '</span>' +
          '</span>' +
        '</div>' +
        (xs.length > 1
          ? '<input type="range" class="mcard-slide" data-mslide="' + tag + '" min="0" max="' + (xs.length - 1) +
            '" step="1" value="' + Math.max(0, at) + '"' + (spent ? ' disabled' : '') +
            ' data-xs="' + xs.join(',') + '" data-ls="' + esc(xs.map(function (v) { return amtText(r, v); }).join('|')) + '"' +
            ' aria-label="Portion of ' + esc(r.name) + '" aria-valuetext="' + esc(amtText(r, it.x)) + '">'
          : '') +
        '<div class="mcard-icons">' +
          /* The lock guards against the MACHINE, not you: Balance and
             Rebalance leave a locked plate alone, the steps still work. */
          (onPlan ? '<button class="mcard-i mlock" data-mlock="' + tag + '" aria-pressed="' + (it.l ? 'true' : 'false') +
            '" aria-label="' + (it.l ? 'Unlock for Rebalance' : 'Lock against Rebalance') + '" title="' +
            (it.l ? 'Kept through Rebalance: tap to let it move' : 'Keep this amount through Rebalance') + '">' + (it.l ? I_LOCK : I_OPEN) + '</button>' : '') +
          (onPlan ? '<button class="mcard-i mswap" data-mswap="' + tag + '" aria-label="Swap ' + esc(r.name) + ' for something else" title="Swap">' + I_SWAP + '</button>' : '') +
          /* The pin is the routine: this food on this meal on every new day.
             Unpinning stops tomorrow, not today. */
          (onPlan ? '<button class="mcard-i mpin" data-mpin="' + tag + '" aria-pressed="' + (pinned ? 'true' : 'false') +
            '" aria-label="' + (pinned ? 'Unpin from this meal' : 'Pin to this meal every day') + '" title="' +
            (pinned ? 'On this meal every day: tap to unpin' : 'Pin to this meal every day') + '">' + I_PIN + '</button>' : '') +
          (mCanFav(r) ? '<button class="mcard-i mfav" data-mfav="' + esc(String(r.id)) + '" aria-pressed="' + (mIsFav(r) ? 'true' : 'false') +
            '" aria-label="' + (mIsFav(r) ? 'Remove from favourites' : 'Keep as a favourite') + '" title="Favourite">' + I_STAR + '</button>' : '') +
          '<button class="mcard-i mdel" data-mdel="' + tag + '" aria-label="Remove ' + esc(r.name) + '" title="Remove">' + I_BIN + '</button>' +
        '</div>' +
      '</div>';
    };

    var slotCard = function (sk, name, onPlan) {
      var items = day[sk] || [];
      /* Rows map over the STORED array so data attributes carry storage
         indexes; an unresolvable id (a deleted own recipe) renders as nothing
         but is never purged, the same bargain renderPlan strikes. */
      var srec = null;
      slots.list.forEach(function (s) { if (s.k === sk) srec = s; });
      var pins = (srec && srec.pins) || [];
      var marks = marksFor(sk, items);
      var rows = items.map(function (it, i) {
        var r = LIVE.BY_ID[it.id];
        if (!r) return '';
        var tag = sk + ':' + i;
        var pinned = pins.some(function (p) { return p.id === it.id; });
        var open = panelOpen(tag);
        var was = marks.was[i], fresh = !!marks.fresh[i];
        var amt = amtText(r, it.x);
        var kc = r.macro ? Math.round((r.macro.kcal || 0) * it.x) : 0;
        var sub = was !== undefined ? '<small class="mcard-was">was ' + esc(amtText(r, was)) + '</small>'
          : it.l ? '<small class="mcard-held">' + LOCK_SM + ' kept</small>'
          : pinned ? '<small class="mcard-held">pinned to ' + esc(name.toLowerCase()) + '</small>' : '';
        return '<div class="mitem mcard-row' + (it.eaten ? ' eaten' : '') + (it.l ? ' held' : '') +
            (was !== undefined ? ' moved' : fresh ? ' fresh' : '') + (open ? ' open' : '') + '">' +
          '<div class="mcard-line">' +
          /* The leaf keeps its slot even with no score, so every name in a
             meal starts at one left edge. */
          (r.score === null || r.score === undefined
            ? '<span class="leaf-sm leaf-gap" aria-hidden="true"></span>' : leaf(r.score, 'leaf-sm')) +
          '<span class="mitem-nm">' +
            /* A recipe's name opens the recipe; a food's opens the food. */
            (r.food
              ? '<button class="mitem-name mitem-food" data-mfood="' + esc(String(r.id)) + '" data-mx="' + it.x + '" data-mfslot="' + esc(sk) + '">' + esc(r.name) + '</button>'
              : '<button class="mitem-name" data-open="' + esc(String(r.id)) + '" data-mx="' + it.x + '">' + esc(r.name) + '</button>') +
            (fresh ? '<span class="mcard-new">New</span>' : '') + sub +
          '</span>' +
          '<button class="mcard-amt num no-print" data-mamt="' + tag + '" aria-expanded="' + (open ? 'true' : 'false') +
            '" aria-label="' + esc(r.name) + ', ' + esc(amt) + ': portion and tools">' +
            (it.l ? LOCK_SM : '') + amtStack(amt) + CARET + '</button>' +
          '<span class="mcard-amt-p print-only">' + esc(amt) + '</span>' +
          '<span class="mcard-kc num">' + kc + '</span>' +
          '<input class="mitem-ate" type="checkbox" data-meat="' + tag + '"' + (it.eaten ? ' checked' : '') +
            (ahead ? ' disabled' : '') + ' aria-label="Eaten">' +
          '</div>' +
          /* The panel is inside the food's own box, under its line. */
          (open ? panelHTML(sk, r, it, tag, pinned, onPlan) : '') +
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
      var eatenAll = items.length && items.every(function (it) {
        return it.eaten || !LIVE.BY_ID[it.id];
      });
      var folded = !!(items.length && S.mFold[sk]);
      var ask = mMealAsk(sk, targets, slots);
      var aim = ask ? (ask.now || ask) : null;
      var aimK = aim ? (aim.kcal || (4 * (aim.p || 0) + 9 * (aim.f || 0) + 4 * (aim.c || 0))) : 0;
      var said = verdict(sub, aim, eatenAll, items.length);
      var pillsSay = mMealPillsSay(sub, ask, targets);

      /* Skipped: one struck line with the way back on it, carrying the
         chooser for where its share goes (the largest cascade there is). */
      if (onPlan && !items.length && mSkipped(k, sk)) {
        var skSend = mCascadeLineHTML(sk, targets, slots);
        return '<div class="mslot mslot-skipped' + (skSend ? ' mslot-skipped-c' : '') + '">' +
          '<div class="mslot-skip-h">' +
            '<span class="mslot-skip-n">' + esc(name) + '</span>' +
            '<span class="mslot-skip-w">' +
              (skSend ? 'skipped' : 'skipped &middot; its share went to the rest') + '</span>' +
            '<button class="ghost mslot-unskip no-print" data-mskip="' + esc(sk) + '" ' +
              'aria-label="Put ' + esc(name) + ' back">Undo</button>' +
          '</div>' + skSend +
        '</div>';
      }

      /* The dot marks the whole meal eaten, and press it again it is not.
         It is the tick on the shut card and on the open one alike. */
      var dot = '<button class="mday-dot no-print" data-mdot="' + esc(sk) + '"' +
        (items.length && !ahead ? '' : ' disabled') +
        ' aria-pressed="' + (eatenAll ? 'true' : 'false') + '"' +
        ' aria-label="' + (eatenAll ? 'Mark ' + esc(name) + ' not eaten' : 'Mark all of ' + esc(name) + ' eaten') + '"></button>';

      if (folded && rows) {
        var names = items.map(function (it) { var r2 = LIVE.BY_ID[it.id]; return r2 ? r2.name : ''; }).filter(Boolean);
        var nameLine = names.length === 1
          ? names[0] + ' · ' + amtText(LIVE.BY_ID[items[0].id], items[0].x)
          : names.slice(0, 3).map(function (n, i) { return i ? n.toLowerCase() : n; }).join(', ');
        var pct = aimK > 0 ? Math.min(100, sub.kcal * 100 / aimK) : 0;
        var heldN = items.filter(function (it) { return it.l && LIVE.BY_ID[it.id]; }).length;
        return '<div class="mslot mday-stop filled mcard-shut ' + said.cls + (eatenAll ? ' done' : '') + '">' +
          '<div class="mslot-h">' + dot +
            '<button class="mslot-head mcard-head" data-mfold="' + esc(sk) + '" aria-expanded="false" aria-label="Open ' +
              esc(name) + (pillsSay ? ' — ' + esc(pillsSay) : '') + '">' +
              '<span class="mcard-t">' +
                '<span class="mslot-name">' + esc(name) + '</span>' +
                (names.length > 1 ? '<span class="mcard-n">' + names.length + ' foods</span>' : '') +
                '<span class="mcard-k num"><b>' + fmtK(sub.kcal) + '</b>' + (aimK ? ' / ' + fmtK(aimK) + ' kcal' : ' kcal') + '</span>' +
                '<span class="mfold-cue" aria-hidden="true">&#8964;</span>' +
              '</span>' +
              '<span class="mcard-names"><span class="mcard-nm">' + esc(nameLine) + '</span>' +
                (names.length > 3 ? '<span class="mcard-more">+' + (names.length - 3) + ' more</span>' : '') +
                /* Held, said where the holding can be seen: lock the dinner
                   you promised, fold the card, press Rebalance — and see
                   what will be spared. */
                (heldN ? '<span class="mcard-kept">' + LOCK_SM + heldN + ' kept</span>' : '') + '</span>' +
              '<span class="mcard-v"><span class="mcard-tr"><span class="mcard-fi" style="width:' + pct.toFixed(1) + '%"></span></span>' +
                '<span class="mcard-say num">' + esc(said.say) + '</span></span>' +
            '</button>' +
          '</div>' +
        '</div>';
      }

      return '<div class="mslot mday-stop mcard-open' + (items.length ? ' filled' : '') + (eatenAll ? ' done' : '') + '">' +
        '<div class="mslot-h">' + dot +
          /* The whole head is the door; it carries the meal's four pills. */
          (rows
            ? '<button class="mslot-head" data-mfold="' + esc(sk) + '" aria-expanded="true" aria-label="Fold ' +
              esc(name) + (pillsSay ? ' — ' + esc(pillsSay) : '') + '">' +
              '<span class="mslot-name">' + esc(name) + '</span>' +
              '<span class="mslot-sp"></span>' +
              '<span class="mslot-tail">' +
                mMealPillsHTML(sub, ask, targets, !eatenAll, !rows) +
                '<span class="mfold-cue" aria-hidden="true">&#8964;</span>' +
              '</span></button>'
            : '<span class="mslot-name mslot-name-flat">' + esc(name) + '</span>' +
              (pillsSay ? '<span class="vis-hidden">' + esc(pillsSay) + '</span>' : '') +
              '<span class="mslot-sp"></span>' +
              '<span class="mslot-tail">' + mMealPillsHTML(sub, ask, targets, !eatenAll, !rows) + '</span>') +
        '</div>' +
        '<div class="mslot-items">' +
          rows +
          (onPlan
            ? '<button class="mcard-add mslot-add no-print" data-mslot="' + esc(sk) + '" aria-label="Add food to ' + esc(name) + '">' +
                mIcon('plus') + '<span>Add a food to ' + esc(name.toLowerCase()) + '…</span></button>' +
              /* The meal's own verbs, at its foot. The scales lead with what
                 the meal is doing in words; after a balance the same place
                 says what moved and offers it back. */
              '<div class="mslot-acts mcard-foot no-print">' +
                (marks.snap
                  ? '<button class="ghost mcard-undo" data-mbalundo="' + esc(sk) + '">Undo</button>' +
                    '<span class="mcard-say">' + (marks.n ? marks.n + (marks.n === 1 ? ' amount' : ' amounts') + ' changed, marked above' : 'Already as close as it gets') + '</span>'
                  : items.length
                  ? '<button class="mslot-act mslot-bal mcard-bal" data-mbal="' + esc(sk) + '"' + (items.length >= 2 ? '' : ' disabled') +
                      ' aria-label="Balance the portions on ' + esc(name) + '" title="Solve these portions against this meal’s share">' + mIcon('scales') + '</button>' +
                    '<span class="mcard-say ' + said.cls + '">' + esc(said.say) + '</span>'
                  : '<span class="mcard-say">Nothing on ' + esc(name.toLowerCase()) + ' yet</span>') +
                '<span class="mcard-verbs">' +
                  (items.length
                    ? '<button class="mslot-act mslot-try" data-mtry="' + esc(sk) + '" aria-label="Another suggestion for ' + esc(name) +
                        '" title="Another suggestion — walks down the best-fit list">' + mIcon('another') + '</button>'
                    : '<button class="mslot-act mslot-skip" data-mskip="' + esc(sk) + '" aria-label="Skip ' + esc(name) +
                        ' today" title="Not eating this today — its share goes to the other meals">' + mIcon('skip') + '</button>') +
                  (items.length >= 2
                    ? '<button class="mslot-act mslot-keep" data-mkeep="' + esc(sk) + '" aria-label="Save these plates as one food you can reuse" ' +
                      'title="Save these plates as one food you can reuse">' + mIcon('keep') + '</button>' : '') +
                  '<button class="mslot-act mslot-from" data-mfrom="' + esc(sk) + '" aria-label="Repeat ' + esc(name) +
                    ' from another day" title="Copy this meal from another day">' + mIcon('fromday') + '</button>' +
                '</span>' +
              '</div>'
            : '') +
          /* Inside the fold, and last: a question about this meal that
             shutting the meal dismisses. */
          (onPlan ? mCascadeLineHTML(sk, targets, slots) : '') +
        '</div>' +
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
