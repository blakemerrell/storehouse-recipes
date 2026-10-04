/* Keeping the plan sheet in step as you change it: the answer redrawn
 * (mtRefreshAnswer, mtDash, mtRefusal), the meals' shares added up
 * (mtmShowTotal), Save shown when there is something to save (mtSyncSave),
 * and the worked-out plan written into the gram boxes (mtRefreshPlan). The
 * longer account is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.planlive(app) once, as it starts, and keeps what it gives back
 * under the same names. Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).planlive = function (app) {
  'use strict';

  // what it reads of the app's
  var MCARB_EAT = app.MCARB_EAT;
  var kcalOf = app.kcalOf;
  var mCoachHTML = app.mCoachHTML;
  var mFloorK = app.mFloorK;
  var mGoalNote = app.mGoalNote;
  var mGoalPace = app.mGoalPace;
  var mPlanCalc = app.mPlanCalc;
  var mTdee = app.mTdee;
  var mtFactsHTML = app.mtFactsHTML;
  var mtGoalWhat = app.mtGoalWhat;
  var mtMealSumHTML = app.mtMealSumHTML;
  var mtPlanLine = app.mtPlanLine;
  var mtProfileFromDom = app.mtProfileFromDom;
  var mtProtSay = app.mtProtSay;
  var mtSaidBase = app.mtSaidBase;
  var mtSaidBurn = app.mtSaidBurn;
  var mtSaidGoal = app.mtSaidGoal;
  var mtSecSummary = app.mtSecSummary;
  var mtStatusHTML = app.mtStatusHTML;
  var mtWhoLine = app.mtWhoLine;

  function $(id) { return document.getElementById(id); }

  /* A plan nobody has made yet is not a plan of zero calories. Shown as a
     dash until the boxes have something in them, in the render and here both
     — this reads the boxes back, so without it the first keystroke anywhere
     in the sheet wrote every zero straight back onto the headline. */
  function mtDash(v) {
    return v ? String(v) : '<span class="mt-none">\u2014</span>';
  }

  /* The headline follows the boxes, whichever way they were filled in. */
  function mtRefreshAnswer() {
    var gv = function (id) { return Math.max(0, Math.round(Number(($(id) || {}).value) || 0)); };
    var t = { p: gv('mtP'), f: gv('mtF'), c: gv('mtC') };
    /* innerHTML, because the empty state is a marked-up dash rather than a
       number. Everything through here is either a figure this file computed
       or that span; none of it is anyone's text. */
    var set = function (id, v) { var el = $(id); if (el) el.innerHTML = v; };
    set('mtBigKcal', mtDash(kcalOf(t)));
    set('mtTileP', mtDash(t.p)); set('mtTileF', mtDash(t.f)); set('mtTileC', mtDash(t.c));
    set('mtKcal', kcalOf(t) ? '= ' + kcalOf(t) + ' kcal' : '\u2014');
    set('mtWho', mtWhoLine(mtProfileFromDom()));
    // a refusal is about the grams it refused; new grams are a new question
    set('mtRefuse', '');
  }

  /* Why Save will not keep these grams, or '' when it will.
   *
     Hand-typed grams used to be saved and then replaced in silence: P 400 /
     F 10 / C 0 read "= 1690 kcal" under the boxes, Save closed the sheet, and
     the day came up 190 / 57 / 93 — the read-time heal had decided the day
     could not be eaten and served the plan instead. Zeros saved as zeros and
     the day showed the plan's 1,569. The heal was right that Nourish cannot
     plan those days; it was wrong to say so by changing the numbers. So the
     same tests are asked here, before anything is written, and the answer is
     a line under the total: what is wrong, and the least Nourish can plan.
   *
     The tests are the heal's — no calories at all, calories under mFloorK,
     or carbohydrate under MCARB_EAT of the day — and like the heal they need
     a profile to mean anything: without one there is no plan to serve in
     their place, and three zeros are simply what "no plan yet" is (a first
     run finished without an answer saves exactly that). The plan's own
     grams always pass: they are what the heal would serve anyway. */
  function mtRefusal(t, pr, mine) {
    if (!mine || mTdee(pr) === null) return '';
    var kc = kcalOf(t), least = mFloorK(pr);
    var tail = ' The least Nourish can plan for you is ' + least.toLocaleString() + ' kcal.';
    if (!kc) return 'Those grams come to no calories, so there is no day to save.' + tail;
    if (kc < least) return 'That is a day of ' + kc.toLocaleString() + ' kcal.' + tail;
    if (4 * t.c < MCARB_EAT * kc) {
      return 'That leaves no room for carbs: a day of ' + kc.toLocaleString() + ' kcal needs ' +
        Math.ceil(MCARB_EAT * kc / 4) + ' g or more.' + tail;
    }
    return '';
  }

  /* The summary says what the ticks say, the moment they say it. */
  function mtSecSumSync(row) {
    if (!row) return;
    var el = row.querySelector('.mtm-secsum-t');
    if (!el) return;
    var on = [];
    Array.prototype.forEach.call(row.querySelectorAll('.mtm-secs input:checked'),
      function (cb) { on.push(cb.value); });
    el.textContent = mtSecSummary(on);
  }

  /* The running total under the meal shares. It never rewrites the boxes —
     fields that rescale each other mid-edit fight the fingers typing them —
     it only says what they add to now, and that Save squares the books. */
  function mtmShowTotal() {
    var el = $('mtmTotal');
    if (!el) return;
    var sum = 0;
    Array.prototype.forEach.call(document.querySelectorAll('#mtMeals .mtm-share'), function (i) {
      sum += Math.max(0, Math.round(Number(i.value) || 0));
    });
    /* Which way you are off, not merely that you are. Save squares the books
       either way, so the number is for your judgement, not a gate. */
    el.className = 'mtm-total ' + (sum === 100 ? 'ok' : 'off');
    el.innerHTML = sum === 100
      ? '<b>100%</b> — spot on.'
      : '<b>' + sum + '%</b> — ' + Math.abs(100 - sum) + '% ' + (sum > 100 ? 'over' : 'short') +
        '. Save scales ' + (sum > 100 ? 'down' : 'up') + ' to 100.';
    /* The handle says how many meals and at what shares, so it goes stale
       the moment a row is added, removed, or renumbered. Kept in step here
       rather than at three call sites, because every one of them is an edit
       to the rows this reads. */
    var sum2 = $('mtMealSum');
    if (sum2) sum2.innerHTML = mtMealSumHTML();
  }

  /* Save belongs to whatever is open. Both folds shut is a screen being
     read, and a read has nothing to commit. */
  function mtSyncSave() {
    var sv = $('mtSave');
    if (!sv) return;
    var open = function (id) { var e = $(id); return e && !e.classList.contains('hide'); };
    /* The protein level sits on the answer, outside both folds, so a press
       there has to bring Save with it or the choice could not be kept. */
    var moved = !!document.querySelector('.mt-prot[data-moved]');
    sv.classList.toggle('hide', !(open('mtEditor') || open('mtMealsWrap') || moved));
  }

  /* One model, one Save. The first version had a "Use this plan" button above
     a "Save" button below, and the natural last press — Save, at the foot of
     the sheet — quietly committed the OLD gram boxes over the plan just
     applied. Two commit buttons on one sheet is a trap; now the plan writes
     straight into the boxes as the profile changes, and Save keeps whatever
     the boxes say, hand-typed or worked out. */
  /* `holdBoxes` is for the one profile control that lives OUTSIDE the editor
     fold: the burn switch among the facts. Every other caller is a question
     the reader is looking at with Save on screen, so writing the worked-out
     plan into the gram boxes hands them an answer they can commit. The burn
     switch can be tapped with both folds shut and no Save anywhere, and
     rewriting the boxes there put 197/59/86 on a sheet whose storage still
     held 180/60/190 and offered no way to close the gap — a screen stating a
     plan the app is not on, which is the whole fault this layout ended.
     Tapping it changes what the facts and the status line say; the grams wait
     for a Save to be asked for. */
  function mtRefreshPlan(holdBoxes) {
    var prNow = mtProfileFromDom();
    var plan = mPlanCalc(prNow);
    /* This caption is an answer to the gram boxes — it says when THEY sit
       under what a body spends lying still. Held boxes mean nothing it
       describes has moved, and writing it anyway warned about a plan that
       was not on the screen. */
    var el = $('mtPlan');
    if (el && !holdBoxes) el.innerHTML = mtPlanLine(plan, prNow);
    /* The ledger, the pace line and the fold's handle are all answers to
       the boxes below them, so they follow the boxes rather than waiting for
       a Save. A screen showing last month's goal above this month's plan is
       the disagreement this layout exists to end. */
    var fx = $('mtFacts');
    if (fx) { fx.innerHTML = mtFactsHTML(prNow); fx.classList.toggle('hide', !fx.innerHTML); }
    var sx = $('mtStatus');
    if (sx) { sx.innerHTML = mtStatusHTML(prNow); sx.classList.toggle('hide', !sx.innerHTML); }
    var wl = $('mtWho');
    if (wl) wl.innerHTML = mtWhoLine(prNow);
    var gn = $('mtGoalNote');
    if (gn) gn.innerHTML = mGoalNote(prNow);
    var co = $('mtCoach');
    if (co) co.innerHTML = mCoachHTML(prNow);
    var pw = $('mtProtWhy');
    if (pw) pw.innerHTML = mtProtSay(prNow);
    /* The wizard's two answers are computed from the same profile as the rest
       and go stale the same way, so they are refreshed with it. */
    var s1 = $('mtwSaid1');
    if (s1) s1.innerHTML = mtSaidBase(prNow);
    var s2 = $('mtwSaid2');
    if (s2) s2.innerHTML = mtSaidBurn(prNow);
    var s3 = $('mtwSaid3');
    if (s3) s3.innerHTML = mtSaidGoal(prNow);
    var gs = $('mtGoalSeg');
    if (gs) {
      var dated = !!mGoalPace(prNow);
      gs.classList.toggle('spent', dated);
      /* and each card's pounds a week, which follow the weight being typed */
      Array.prototype.forEach.call(gs.querySelectorAll('[data-mtgoal]'), function (b2) {
        b2.disabled = dated;
        var gw = b2.querySelector('span');
        if (gw) gw.innerHTML = mtGoalWhat(b2.dataset.mtgoal, prNow);
      });
    }
    if (!plan || holdBoxes) { mtRefreshAnswer(); return; }
    if ($('mtP')) { $('mtP').value = plan.p; $('mtF').value = plan.f; $('mtC').value = plan.c; }
    mtRefreshAnswer();
  }

  return { mtDash: mtDash, mtRefreshAnswer: mtRefreshAnswer, mtRefusal: mtRefusal, mtSecSumSync: mtSecSumSync, mtmShowTotal: mtmShowTotal, mtSyncSave: mtSyncSave, mtRefreshPlan: mtRefreshPlan };
};
