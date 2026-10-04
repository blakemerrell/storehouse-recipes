/* Walking the plan sheet's setup: one step shown at a time (mtwGo), what
 * each step says back once answered (mtSaidBase, mtSaidGoal, mtSaidBurn),
 * the rows of the meals editor and the sections a custom meal draws from
 * (mtMealRow, mtSecsHTML), and the profile read back off the sheet
 * (mtProfileFromDom). The longer account is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.plansteps(app) once, as it starts, and keeps what it gives back
 * under the same names. The counter that keys a new meal row (mtMealSeq)
 * stays in app.js, where the tap that adds a row reads it. Loaded before
 * app.js.
 */
(window.HiveParts = window.HiveParts || {}).plansteps = function (app) {
  'use strict';

  // what it reads of the app's
  var BOOKS = app.BOOKS;
  var MGOALS = app.MGOALS;
  var SEC_SHORT = app.SEC_SHORT;
  var kcalOf = app.kcalOf;
  var mAllSections = app.mAllSections;
  var mBurn = app.mBurn;
  var mGoalPace = app.mGoalPace;
  var mPlanCalc = app.mPlanCalc;
  var mProtLevel = app.mProtLevel;
  var mReadProfile = app.mReadProfile;
  var mSlotW = app.mSlotW;
  var mtRefreshPlan = app.mtRefreshPlan;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function $(id) { return document.getElementById(id); }

  /* Show one step and hide the rest, and say where you are in three places:
     the pips, the Back button, and what Next is called on the last one. */
  function mtwGo(n) {
    var steps = document.querySelectorAll('[data-mtwstep]');
    if (!steps.length) return;
    var last = steps.length;
    n = Math.max(1, Math.min(last, n));
    Array.prototype.forEach.call(steps, function (sc) {
      sc.hidden = Number(sc.dataset.mtwstep) !== n;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.mtw-pip'), function (p, i) {
      p.className = 'mtw-pip' + (i + 1 === n ? ' on' : i + 1 < n ? ' done' : '');
    });
    var back = document.querySelector('[data-mtw="back"]');
    if (back) back.hidden = (n === 1);
    /* The last step is the plan itself and carries its own Save, so Next
       steps aside there rather than becoming a second button that does the
       same thing through a different path. */
    var next = document.querySelector('[data-mtw="next"]');
    if (next) next.hidden = (n === last);
    var fin = document.querySelector('[data-mtw="done"]');
    if (fin) fin.hidden = (n !== last);
    /* Each step is a screen of its own, so it starts at the top of itself
       rather than wherever the last one had been scrolled to. */
    var sheet = document.querySelector('.mt-sheet');
    if (sheet) sheet.scrollTop = 0;
    mtRefreshPlan();
  }

  /* What a step says back once it has been answered.
   *
     The figures are the same mBurn the plan is built from — nothing here is
     computed twice or rounded differently — and the line under them says what
     the figure is FOR, which is most of the difference between a form and a
     guide. Both return nothing at all until there is enough answered to say
     something true, so a half-filled step is quiet rather than wrong. */
  function mtSaidBase(pr) {
    var b = mBurn(pr);
    if (!b) return '';
    /* bmr × 1.2 and not b.base, which is two different quantities wearing one
       name: with nothing said about steps or sessions it is the whole day
       through the activity dial, and after that it is the resting rate plus
       the little that moving about adds. Reading it here gave a man of 43 a
       resting burn of 2,757 — and then step two, having been told about his
       steps, called the same idea 2,135. One figure, said once, both times.
     *
       And "at rest" is the basal rate, everywhere. This said 2,135 at rest
       while the plan step, under the same words, warned about going below
       1779 — two numbers for one phrase, a sheet apart. So rest is the basal
       rate, and bmr × 1.2 goes by what it is: the day sitting still, which
       step two breaks out under that name. */
    return mtwOut(b.bmr, 'kcal at rest &middot; ' + Math.round(b.bmr * 1.2).toLocaleString() +
      ' sitting still', 'What your body spends before you move.');
  }

  /* One answer box, the same shape on every step: the number, what it is,
     and one line on what it is for. */
  function mtwOut(n, unit, sub) {
    return '<div class="mtw-head"><b>' + Math.round(n).toLocaleString() + '</b> ' + unit + '</div>' +
      (sub ? '<p class="mtw-for">' + sub + '</p>' : '');
  }

  /* The nearest of the wizard's three words to a stored activity dial, so a
     profile made on the five-line select still lights one of them. */
  function mtActNear(act) {
    var a = Number(act) || 1.2;
    return a < 1.29 ? 1.2 : a < 1.47 ? 1.375 : 1.55;
  }

  /* What the goal step says back: the day's calories, and how far under or
     over the burn that is, in pounds a week. */
  function mtSaidGoal(pr) {
    var b = mBurn(pr), plan = mPlanCalc(pr);
    if (!b || !plan) return '';
    /* kcalOf the rounded grams, not plan.kcal: the plan step's tiles add
       the grams up, and the two were a calorie apart — 1,707 on one screen,
       1706 on the next. One calorie, said once. */
    var kcal = kcalOf(plan);
    var diff = Math.round(b.tdee) - kcal;
    var pace = mGoalPace(pr);
    var perWeek = pace ? pace.perWeek : (MGOALS[pr.goal] || MGOALS.cut1).rate * pr.lb;
    var lbs = Math.round(Math.abs(perWeek) * 10) / 10;
    var line = diff > 0
      ? diff.toLocaleString() + ' under what you burn &mdash; about ' + lbs + ' lb a week off.'
      : diff < 0
      ? Math.abs(diff).toLocaleString() + ' over what you burn &mdash; about ' + lbs + ' lb a week on.'
      : 'What you burn, so the scale holds.';
    return mtwOut(kcal, 'kcal a day', line);
  }

  function mtSaidBurn(pr) {
    var b = mBurn(pr);
    if (!b) return '';
    var part = function (n, what) {
      return '<div class="mtw-part"><b>' + Math.round(n).toLocaleString() + '</b><i>' + what + '</i></div>';
    };
    /* "Moving about", not "walking about": the middle part is the job or the
       steps, whichever says more (see mBurn), and an active job is not a walk. */
    return mtwOut(b.tdee, 'kcal a day', 'Everything else works from this: eat under it and you lose.') +
      (b.told
        ? '<div class="mtw-parts">' + part(b.base, 'sitting still') +
          part(b.steps, 'moving about') + part(b.train, 'exercising') + '</div>'
        : '');
  }

  /* The checklist a custom meal draws from: every live section, grouped by
     volume — the same list the browse filter shows, from the same data. */
  /* The short name a section goes by. The printed names run to seven words
     — "Speedy Weekday Breakfasts & Morning Treats" — which is a title, not a
     label, and thirteen of them stacked is a wall. */
  function mSecLabel(sec) { return SEC_SHORT[sec.key] || sec.name; }

  /* What a custom meal draws from, said in a line: three names and a count.
     This is what the row shows once the choosing is done. */
  function mtSecSummary(checked) {
    if (!checked.length) return 'No sections chosen';
    var names = [];
    mAllSections().forEach(function (sec) {
      if (checked.indexOf(sec.key) >= 0) names.push(mSecLabel(sec));
    });
    var head = names.slice(0, 3).join(' \u00b7 ');
    return names.length > 3 ? head + ' + ' + (names.length - 3) + ' more' : head;
  }

  /* The checklist, and the one-line summary it folds into. Both are always in
     the DOM — Save reads the boxes whether or not they are on screen — and
     only one of them is ever visible. A list of thirteen ticks has done its
     job the moment the ticking is over; after that it is a wall between you
     and the next meal. */
  function mtSecsHTML(checked, open) {
    var out = '<div class="mtm-secs' + (open ? '' : ' hide') + '">', bk = 0;
    mAllSections().forEach(function (sec) {
      if (sec.book !== bk) {
        out += '<span class="mtm-secs-b">' +
          esc(sec.book === 3 ? 'Ours' : BOOKS[sec.book].short) + '</span>';
        bk = sec.book;
      }
      out += '<label class="mtm-sec"><input type="checkbox" value="' + esc(sec.key) + '"' +
        (checked.indexOf(sec.key) >= 0 ? ' checked' : '') + '> ' + esc(mSecLabel(sec)) + '</label>';
    });
    out += '<button class="ghost mtm-secdone" data-mtsec="done">Done</button></div>';
    return out +
      '<button class="mtm-secsum' + (open ? ' hide' : '') + '" data-mtsec="show">' +
        '<span class="mtm-secsum-t">' + esc(mtSecSummary(checked)) + '</span>' +
        '<span class="mtm-secsum-e">Change</span>' +
      '</button>';
  }

  function mtMealRow(s) {
    var kinds = [['b', 'Breakfasts'], ['l', 'Lunches'], ['d', 'Dinners'],
      ['s', 'Snacks & drinks'], ['x', 'Choose sections…']];
    /* The five controls live in their own nowrap row, so a meal is always
       exactly one line — shrinking to fit rather than shedding its × onto
       the line below — and the sections checklist sits under it, outside
       the flexbox entirely. */
    return '<div class="mtm-row" data-mtmk="' + esc(s.k) + '">' +
      '<div class="mtm-main">' +
        '<button class="ghost mtm-move" data-mtmeal="up" aria-label="Move up">&uarr;</button>' +
        '<input class="txt mtm-name" value="' + esc(s.n) + '" placeholder="Name the meal" aria-label="Meal name">' +
        '<select class="mtm-type" data-prev="' + esc(s.t) + '" aria-label="What kind of meal">' +
          kinds.map(function (o) {
            return '<option value="' + o[0] + '"' + (o[0] === s.t ? ' selected' : '') + '>' + o[1] + '</option>';
          }).join('') + '</select>' +
        /* The meal's share of the day. Weights, not strict percentages — 35
           against 10 means dinner reaches for three and a half snacks' worth. */
        '<label class="mtm-share-l"><input class="mtm-share" type="number" min="1" max="99" ' +
          'inputmode="numeric" value="' + mSlotW(s) + '" aria-label="Share of the day">%</label>' +
        '<button class="day-x mtm-del" data-mtmeal="del" aria-label="Remove this meal">&times;</button>' +
      '</div>' +
      (s.t === 'x' ? mtSecsHTML(s.secs || [], !(s.secs && s.secs.length)) : '') +
    '</div>';
  }

  /* What the profile boxes currently say, read straight off the sheet — the
     inputs are the draft, so a re-render cannot eat half-typed numbers. */
  /* Merged onto what is stored, never built fresh from the DOM.
   *
     This function can only report what the sheet has boxes for, and
     mWriteProfile is a bare setItem — so every Save was silently dropping
     whatever the DOM did not carry. `train`, the days carb cycling swings on,
     was the casualty: set the days by hand, change anything else, press Save,
     and they snapped back to whatever the workout count implies, with nothing
     said. Weight would have been the second, now that its box goes away once
     the scale has something to say — an absent box reads as 0 through `n`,
     which would have wiped the fallback the first plan is built on.
   *
     Merged onto mReadProfile — the resolved profile, weight and all — and not
     onto the raw store. The absent weight box IS the case mReadProfile exists
     for: once the scale has answered, the sheet states that fact instead of
     offering a box, so the fallback `n` reaches for has to be the same fact.
     Reaching into the raw store got the stale typed number instead, and the
     sheet opened on the scale's plan and then flipped to the stale one the
     moment any other control was touched — the fifteen-pound drift described
     above mScaleLb, back through a side door, with the weight row still
     saying it came from the weigh-ins. What the weight is has one definition
     and mReadProfile is where it lives. */
  function mtProfileFromDom() {
    var n = function (id, fb) {
      var el = $(id);
      if (!el) return fb;
      return Number(el.value) || 0;
    };
    var stored = mReadProfile();
    var sexBtn = document.querySelector('[data-mtsex][aria-pressed="true"]');
    var goalBtn = document.querySelector('[data-mtgoal][aria-pressed="true"]');
    var out = {};
    Object.keys(stored).forEach(function (k) { out[k] = stored[k]; });
    out.sex = sexBtn ? sexBtn.dataset.mtsex : stored.sex;
    out.age = n('mtAge', stored.age);
    out.ft = n('mtFt', stored.ft);
    out.inch = n('mtIn', stored.inch);
    out.lb = n('mtLb', stored.lb);
    out.bf = n('mtBf', stored.bf);
    out.act = Number(($('mtAct') || {}).value) || stored.act || 1.55;
    out.goal = goalBtn ? goalBtn.dataset.mtgoal : stored.goal;
    var extBtn = document.querySelector('[data-mtext][aria-pressed="true"]');
    out.extFill = extBtn ? extBtn.dataset.mtext === '1' : !!stored.extFill;
    var protBtn = document.querySelector('[data-mtprot][aria-pressed="true"]');
    out.prot = protBtn ? protBtn.dataset.mtprot : mProtLevel(stored);
    out.goalLb = n('mtGoalLb', stored.goalLb);
    out.goalBy = $('mtGoalBy') ? ($('mtGoalBy').value || '') : (stored.goalBy || '');
    out.workouts = n('mtWorkouts', stored.workouts);
    out.steps = n('mtSteps', stored.steps);
    return out;
  }

  return { mtwGo: mtwGo, mtSaidBase: mtSaidBase, mtActNear: mtActNear, mtSaidGoal: mtSaidGoal, mtSaidBurn: mtSaidBurn, mtSecSummary: mtSecSummary, mtSecsHTML: mtSecsHTML, mtMealRow: mtMealRow, mtProfileFromDom: mtProfileFromDom };
};
