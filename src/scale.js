/* What the scale says against the plan: the numbers a cut reads, the
 * seven-day average first (mWeightStats), drawn small (mSparkSVG); up,
 * down or holding, and dates said plainly (mLbWord, mPretty, mLongDate);
 * the plan in a line for the morning card and the arithmetic behind it
 * (mPlanFace, mPlanDetail); where the plan said the scale would be today
 * (mPlanWeight); the day-to-day jump and the salt that explains one
 * (mJump, mSodiumOn, MSALT_JUMP, MSALT_DAY); and the pace, the rate and
 * the date it lands (mPaceFacts). The longer account is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.scale(app) once, as it starts, and keeps what it gives back
 * under the same names. Two of what it reads (MC_GAP, MGOAL_WORDS) are
 * declared further down app.js, so it reads them through LIVE
 * (tests/scope.test.js holds the lists to each other). Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).scale = function (app) {
  'use strict';

  // what it reads of the app's, and (LIVE) what the app replaces as it goes: MC_GAP, MGOAL_WORDS
  var MDAYS = app.MDAYS;
  var MFAT_MAX = app.MFAT_MAX;
  var MWEIGHTS = app.MWEIGHTS;
  var M_MONS = app.M_MONS;
  var M_WDAYS = app.M_WDAYS;
  var kcalOf = app.kcalOf;
  var keyDate = app.keyDate;
  var mBodyFat = app.mBodyFat;
  var mDayN = app.mDayN;
  var mFloorK = app.mFloorK;
  var mGoalPace = app.mGoalPace;
  var mMeasuredTdee = app.mMeasuredTdee;
  var mPlanCalc = app.mPlanCalc;
  var mReadProfile = app.mReadProfile;
  var mReadTargets = app.mReadTargets;
  var mTargRec = app.mTargRec;
  var mTdee = app.mTdee;
  var mTotals = app.mTotals;
  var mcDaysApart = app.mcDaysApart;
  var todayKey = app.todayKey;
  var LIVE = app.LIVE;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* The numbers a cut actually reads. The seven-day average is the headline —
     a single morning is water and yesterday's salt — and the week is judged
     average against average, not spike against spike. */
  function mWeightStats() {
    var keys = Object.keys(MWEIGHTS).sort();
    if (!keys.length) return null;
    var dayN = mDayN;
    var lastN = dayN(keys[keys.length - 1]);
    var w7 = [], prev7 = [];
    keys.forEach(function (k) {
      var back = lastN - dayN(k);
      if (back < 7) w7.push(MWEIGHTS[k]);
      else if (back < 14) prev7.push(MWEIGHTS[k]);
    });
    var avg = function (a) { return a.reduce(function (s, x) { return s + x; }, 0) / a.length; };
    var last = keys[keys.length - 1];
    return {
      n: keys.length, latest: MWEIGHTS[last], lastKey: last, firstKey: keys[0],
      /* Mornings since the scale last had anything to say. Every figure below
         is anchored on that morning rather than on today, so anything that
         compares them to today has to know how far apart they are. */
      staleDays: Math.max(0, mDayN(todayKey()) - lastN),
      avg7: avg(w7),
      dWeek: prev7.length ? avg(w7) - avg(prev7) : null,
      dStart: MWEIGHTS[last] - MWEIGHTS[keys[0]]
    };
  }

  function mSparkSVG() {
    var keys = Object.keys(MWEIGHTS).sort().slice(-60);
    if (keys.length < 2) return '';
    var dayN = mDayN;
    var x0 = dayN(keys[0]), x1 = dayN(keys[keys.length - 1]);
    var lo = Infinity, hi = -Infinity;
    keys.forEach(function (k) {
      if (MWEIGHTS[k] < lo) lo = MWEIGHTS[k];
      if (MWEIGHTS[k] > hi) hi = MWEIGHTS[k];
    });
    /* Where the plan says you should be, on the same scale, dashed. "Behind"
       was a word; with the line it is something you can see — your weight
       sitting above it. Only across the days the plan covers. */
    var pr = mReadProfile(), planPts = [];
    if (pr.goalLb && pr.goalBy) {
      keys.forEach(function (k) {
        var pw = mPlanWeight(k, pr);
        if (!pw || (pr.goalSet && k < pr.goalSet)) return;
        planPts.push([k, pw.lb]);
        if (pw.lb < lo) lo = pw.lb;
        if (pw.lb > hi) hi = pw.lb;
      });
    }
    if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }   // a flat line should look flat, not jagged
    var W = 280, H = 44;
    var xy = function (k, lb) {
      var x = (dayN(k) - x0) / (x1 - x0) * W;
      var y = 3 + (H - 6) * (1 - (lb - lo) / (hi - lo));
      return x.toFixed(1) + ',' + y.toFixed(1);
    };
    var pts = keys.map(function (k) { return xy(k, MWEIGHTS[k]); });
    return '<svg class="mw-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
      (planPts.length > 1 ? '<polyline class="mw-spark-plan" points="' +
        planPts.map(function (q) { return xy(q[0], q[1]); }).join(' ') +
        '" fill="none" stroke-width="1.2" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>' : '') +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' +
      (planPts.length > 1 ? '<div class="mw-spark-k"><i class="me"></i>your weight <i class="pl"></i>the plan</div>' : '');
  }

  function mLbWord(d) {
    var v = Math.round(Math.abs(d) * 10) / 10;
    return d <= -0.05 ? 'down ' + v + ' lb' : d >= 0.05 ? 'up ' + v + ' lb' : 'holding steady';
  }

  function mPretty(k) {
    var d = keyDate(k);
    return M_MONS[d.getMonth()] + ' ' + d.getDate();
  }
  /* The long form, "Mon, Sep 28", as Strengthen writes it. */
  function mLongDate(k) {
    var d = keyDate(k);
    return M_WDAYS[d.getDay()].slice(0, 3) + ', ' + M_MONS[d.getMonth()] + ' ' + d.getDate();
  }

  /* The plan, in two lines, where a button used to sit.
   *
   * Crafting a plan is a thing you do every few months; a button for it had
   * prime daily real estate and said nothing the rest of the time. What
   * belongs there is what the plan is doing FOR you — the destination, how
   * far off it is, and whether the scale agrees you are getting there — with
   * the way in tucked on the end. When there is no plan, the same line is
   * the invitation to make one, which is the only moment a button was ever
   * the right answer. */

  /* The plan in one line, for the face of the morning card: the goal, the
     gap, and whether the scale agrees. That is the fact you steer by, and it
     is the only part of the plan that earns a place on a screen you open
     every day — the arithmetic behind the verdict is evidence, and evidence
     goes behind the press with the rest of the evidence.
   *
     What used to sit here and no longer does: "Two weeks of mornings and
     this says whether you are on pace." That is the app explaining itself,
     which is the one thing the copy is not for. Before there are two weeks
     of mornings the card simply does not claim a verdict. */
  function mPlanFace() {
    var pr = mReadProfile();
    var plan = mPlanCalc(pr);
    if (!plan) return { has: false, html: 'No plan yet.' };
    var pace = mGoalPace(pr);
    var dayK = (mTargRec() ? kcalOf(mReadTargets()) : plan.kcal).toLocaleString();
    /* A goal with a date under a week out, or gone. The plan stops working
       out a rate then, and the card used to fall back to the no-goal line —
       "name a weight and a date" — directly above "On pace for 190 lb by
       Sep 27", which is a weight and a date. */
    if (!pace && pr.goalLb && pr.goalBy) {
      var gd = keyDate(pr.goalBy);
      var left = Math.round((gd - keyDate(todayKey())) / 86400000);
      return { has: true, html: '<b>' + pr.goalLb + ' lb by ' + M_MONS[gd.getMonth()] + ' ' +
        gd.getDate() + '</b> &middot; ' +
        (left < 0 ? 'the date has passed' : left === 0 ? 'today' : left + (left === 1 ? ' day' : ' days') + ' left') +
        ' &middot; ' + dayK + ' kcal a day' };
    }
    if (!pace) {
      return { has: true, html: '<b>' + esc(LIVE.MGOAL_WORDS[pr.goal] || LIVE.MGOAL_WORDS.cut1) +
        /* The saved day, which is what the bars score against. The live
           calculation drifts from it between weekly updates, and one card
           showing two numbers for one day was the thing being fixed. */
        '</b> &middot; ' + (mTargRec() ? kcalOf(mReadTargets()) : plan.kcal).toLocaleString() +
        ' kcal a day &middot; name a weight and a date to track the arrival' };
    }
    var st0 = mWeightStats();
    var now0 = st0 ? st0.avg7 : pr.lb;
    var togo0 = Math.round((now0 - pr.goalLb) * 10) / 10;
    var weeks0 = Math.max(1, Math.round(pace.days / 7));
    var d0 = keyDate(pr.goalBy);
    var out = '<b>' + pr.goalLb + ' lb by ' + M_MONS[d0.getMonth()] + ' ' + d0.getDate() +
      /* "30.3 lb in 19 weeks" rather than "30.3 lb to go over 19 weeks":
         same two facts, five words shorter, and short enough that the pace
         verdict stays on the line it is a verdict about instead of dropping
         to one of its own. */
      '</b> &middot; ' + Math.abs(togo0) + ' lb in ' + weeks0 +
      (weeks0 === 1 ? ' week' : ' weeks');
    /* The same side the morning line acts on. This used to judge by the
       week's RATE against the rate the date needs, while the line beneath
       it judged by POSITION against the plan line — and five pounds behind
       the line while losing fast this week read "on pace" over "12 days
       behind pace". One question, one answer: where you stand. */
    var pf0 = mPaceFacts(todayKey());
    if (pf0) {
      /* The estimate, not a verdict: when you'll get there against the date
         you set. */
      var word0 = mArriveChip(pf0);
      var tone0 = /late|no date|off|a week/.test(word0) ? 'behind' : /early/.test(word0) ? 'ahead' : 'on';
      out += ' <span class="mw-chip ' + tone0 + '">' + word0 + '</span>';
    }
    return { has: true, html: out };
  }

  /* The arithmetic the verdict came out of, for behind the press. Silent
     until the scale has an opinion: one week of mornings is water, not a
     trend, and a line that says so is a line about the app. */
  function mPlanDetail() {
    /* Every number the card has, said once: where the average is, which way
       the week went, and what the goal needs. It was four lines, and the
       average was in all four. */
    var pr = mReadProfile();
    var st = mWeightStats();
    if (!st || st.n < 2) return '';
    var parts = [(Math.round(st.avg7 * 10) / 10) + ' lb seven-day average'];
    if (st.dWeek !== null) parts.push(mLbWord(st.dWeek) + ' this week');
    var pace = mPlanCalc(pr) ? mGoalPace(pr) : null;
    if (pace && st.dWeek !== null) {
      var togo = st.avg7 - pr.goalLb;
      var weeks = Math.max(1, pace.days / 7);
      var need = Math.round(Math.abs(togo) / weeks * 10) / 10;
      if (need >= 0.1) parts.push('needs ' + (togo > 0 ? 'down ' : 'up ') + need + ' a week');
    }
    return parts.join(' &middot; ');
  }

  /* One sentence, and most mornings it says nothing to do.
   *
     Everything above it — the limits, the moving range, the measured burn —
     exists to earn that word. A chart that tells you you are fine is doing
     more work than one that tells you to try harder, because the failure on
     a cut is not laziness. It is cutting calories after a salty Tuesday and
     then wondering why the week went badly. Deming called that tampering:
     reacting to routine variation makes a process worse, not better. */
  var MSALT_JUMP = 1.0;                 // lb overnight worth explaining
  var MSALT_DAY = 2800;                 // mg the day before that explains it

  /* What the plan said the scale would read today. Anchored on the morning
     the goal was set, at what the scale averaged that morning — a
     measurement, not the weight typed into the profile, which is a memory.
     It used to anchor on the FIRST morning ever logged, which is the same
     thing for a goal set on day one and a year-old number for a goal set
     after a year of mornings: 205 in January, 185 now, a new goal of 175,
     and today's "planned" weight came out at 197 — twelve pounds ahead of
     a pace nobody set. A goal saved before this was recorded keeps the
     first logged morning, since nothing better is known about it. */
  function mPlanWeight(k, pr) {
    if (!pr.goalLb || !pr.goalBy) return null;
    var keys = Object.keys(MWEIGHTS).sort();
    if (!keys.length) return null;
    var dayN = mDayN;
    var set = pr.goalSet && pr.goalFrom > 0;
    var startK = set ? pr.goalSet : keys[0];
    var startLb = set ? pr.goalFrom : MWEIGHTS[keys[0]];
    var from = dayN(startK), to = dayN(pr.goalBy), now = dayN(k);
    if (to <= from) return null;
    var span = to - from;
    var per = (pr.goalLb - startLb) / span;      // lb a day, negative on a cut
    /* The line stops at the goal. Carried on past the date it kept falling
       — a goal of 190 ten days gone was "planning" 186.7, so arriving at 190
       read as ten days behind and was told to eat less. */
    var at = Math.min(now, to);
    return { lb: startLb + per * (at - from), per: per, daysLeft: to - now };
  }

  /* The day-to-day jump, and how big a jump is ordinary for this person.
     Wheeler's moving range: the limit is 3.268 times its own average. */
  function mJump(k) {
    var keys = Object.keys(MWEIGHTS).sort();
    var at = keys.indexOf(k);
    if (at < 1) return null;
    /* Same rule as the charts: a pair that straddles a gap is not a moving
       range. This one decides whether an overnight change is worth
       mentioning, so bridging a fortnight here quietly RAISES the bar for
       "unusual" and the morning stops saying anything. */
    var mr = [];
    for (var i = 1; i < keys.length; i++) {
      if (mcDaysApart(keys[i - 1], keys[i]) > LIVE.MC_GAP) continue;
      mr.push(Math.abs(MWEIGHTS[keys[i]] - MWEIGHTS[keys[i - 1]]));
    }
    if (mr.length < 5) return null;
    // and the jump itself is only a jump if it is against yesterday
    if (mcDaysApart(keys[at - 1], k) > LIVE.MC_GAP) return null;
    var bar = mr.reduce(function (a, b) { return a + b; }, 0) / mr.length;
    return {
      d: MWEIGHTS[k] - MWEIGHTS[keys[at - 1]],
      bar: bar, url: 3.268 * bar, prevKey: keys[at - 1]
    };
  }

  function mSodiumOn(k) {
    if (!MDAYS[k]) return 0;
    return Math.round(mTotals(MDAYS[k]).all.na);
  }

  /* Where the scale stands against the plan, as numbers rather than as a card.
   *
     Two screens say this: the morning line on My Day, and the plan sheet.
     They used to work it out separately, which is two chances to disagree
     about one fact — and they already had, on the calorie bar. One place
     computes it; both places read it. Today only, because every figure in it
     is about where you stand NOW. */
  /* A date, the way a person says it: "Feb 17", with the year when it is
     not this one — a slow rate once put an arrival four years out as
     "Sep 24", two days from now. */
  function mDateWord(d) {
    /* The year only when the date is far enough off to be ambiguous: "Jan 20"
       in September means this coming January. */
    var far = Math.abs(d - new Date()) > 330 * 86400000;
    return M_MONS[d.getMonth()] + ' ' + d.getDate() + (far ? ', ' + d.getFullYear() : '');
  }

  /* Pounds a week over the last three weeks: the latest week's mean against
     the mean of the week two weeks before it, halved. Null without three
     mornings in each. */
  function mRate3() {
    var keys = Object.keys(MWEIGHTS).filter(function (k) { return MWEIGHTS[k] > 0; }).sort();
    if (!keys.length) return null;
    var dayN = mDayN;
    var lastN = dayN(keys[keys.length - 1]);
    var a = [], b = [];
    keys.forEach(function (k) {
      var back = lastN - dayN(k);
      if (back < 7) a.push(MWEIGHTS[k]);
      else if (back >= 14 && back < 21) b.push(MWEIGHTS[k]);
    });
    if (a.length < 3 || b.length < 3) return null;
    var mean = function (x) { return x.reduce(function (s0, v) { return s0 + v; }, 0) / x.length; };
    return (mean(a) - mean(b)) / 2;
  }

  /* "Feb 17 · 4 weeks late", "on track", or no date — the estimate as a
     chip, for the open card. */
  function mArriveChip(pf) {
    if (!pf.plan.per) return pf.side === 'on' ? 'on track' : pf.side === 'behind' ? 'off your weight' : 'on track';
    if (!pf.arriveD) return pf.slow ? (pf.plan.per < 0 ? 'down ' : 'up ') + pf.slow + ' lb a week' : 'no date yet';
    var d = pf.lateDays;
    if (Math.abs(d) <= 6) return 'on track';
    var span = Math.abs(d) >= 14 ? Math.round(Math.abs(d) / 7) + ' weeks' : Math.abs(d) + ' days';
    return pf.arrive + ' \u00b7 ' + span + (d > 0 ? ' late' : ' early');
  }

  function mPaceFacts(k, draft) {
    k = k || todayKey();
    /* The saved profile, unless a sheet is holding an unsaved one. The plan
       screen previews what an edit would do, and a pace line that answered
       for the old goal while the ledger above it answered for the new one
       would be the two-sources bug again, one field apart. */
    var pr = draft || mReadProfile();
    var st = mWeightStats();
    var plan = mPlanWeight(k, pr);
    if (!plan || !st || st.n < 14) return null;
    var meas = mMeasuredTdee();
    var jump = mJump(k);

    /* Measured against the plan line ON THE MORNING THE AVERAGE IS OF, not
       against today's.
     *
       avg7 is anchored on the last weigh-in; plan.lb moves every day. Compared
       across that gap the difference grew on its own: identical mornings and
       an identical plan, read the day of the last weigh-in, said 12 days
       behind, and read a fortnight later said 24. Half of that number was
       just the days since he stood on the scale, and the card never said so.
       A stale reading should go stale, not get worse. */
    var atPlan = mPlanWeight(st.lastKey, pr) || plan;
    var off = st.avg7 - atPlan.lb;                // positive means heavier than planned
    var daysOff = plan.per ? Math.round(off / -plan.per) : 0;
    /* The measured burn whenever there is one, whatever the plan's switch
       says — deliberately. The switch decides what the PLAN is built on; this
       line's job is to notice when the plan is not landing, and the only
       evidence of that is the measurement: behind pace while eating to a
       formula plan means the formula is wrong for you. It names the burn it
       used ("burn measures ..."), and Eat N is saved as your own choice, so
       the weekly follow does not put the formula's number back over it. */
    var burn = meas ? meas.tdee : mTdee(pr);
    /* A floor of this line's own, because a line that says "eat 1,278" is
       not advice — it is arithmetic with nobody reading it. Never under the
       basal rate, never more than a quarter off the day's burn. It is
       stricter than the plan calculator's floor (mFloorK), so a plan written
       under that one can already sit below this, and then the number here
       is the least the line will ask for, not a cut. When the honest number
       is capped, the date is what moves, and the line says so. */
    /* Under a week out, or past, there is no rate to ask for: the plan
       itself stops working one out (mGoalPace), and dividing what is left by
       one day produced numbers like 2,533 to "land on time" on a date gone. */
    var rawNeed = burn === null || plan.daysLeft < 7 ? null
      : burn - (st.avg7 - pr.goalLb) * 3500 / plan.daysLeft;
    /* The same floor the plan lives under, because two floors meant this line
       could offer MORE food than the plan while calling itself the lowest it
       goes — 1,904 against a 1,514 plan, on a day already behind pace. It kept
       max(basal, three quarters of the burn), which is a defensible rule about
       health and the wrong rule for a line whose whole job is to say what
       reaching the goal costs. Nutrient floor, then the fat ceiling. */
    var fatF = mBodyFat(pr);
    var floor = mFloorK(pr);
    if (fatF && burn !== null) floor = Math.max(floor, burn - fatF.lb * MFAT_MAX);
    /* And the plan's own speed limits, which this line did not know about.
       mGoalPace will not plan a cut faster than 1% of bodyweight a week, nor
       a gain faster than half that or a fifth over the burn; this line asked
       for 1,565 on a plan capped at 1,804 (2.5 lb a week), and on a gain goal
       with nothing above it at all said "Eat 5,202". Same limits, both ways. */
    var lbNow = pr.lb > 0 ? pr.lb : 0;
    var ceil = Infinity;
    if (burn !== null && lbNow) {
      if (plan.per < 0) floor = Math.max(floor, burn - lbNow * 0.01 * 3500 / 7);
      else if (plan.per > 0) ceil = burn + Math.min(lbNow * 0.005 * 3500 / 7, 0.20 * burn);
    }
    var capped = rawNeed !== null && (rawNeed < floor || rawNeed > ceil);
    var capHigh = capped && rawNeed > ceil;
    /* Rounded UP off the floor, never down onto it: a number printed a
       calorie under the basal rate is still a number under the basal rate. */
    var need = rawNeed === null ? null
      : capHigh ? Math.floor(ceil) : capped ? Math.ceil(floor) : Math.round(rawNeed);
    /* Everything below is read TOWARD the goal, so a gain goal is judged on
       gaining: heavier than the line is behind on a cut and ahead on a
       gain. daysOff already carried the sign through plan.per; side and the
       arrival did not, and told somebody putting weight on that being
       heavier than planned was behind. */
    /* Holding a weight (per 0) has no "ahead": off the line either way is
       off it. It read a gain of 1.8 lb a week as "0 days ahead of pace". */
    var toward = plan.per < 0 ? off : plan.per > 0 ? -off : Math.abs(off);   // positive means behind
    var closing = st.dWeek === null ? null : (plan.per < 0 ? -st.dWeek : st.dWeek);
    /* When you will actually get there, at the rate the scale is moving.
       Blake: "How about not telling me I'm behind but that my target date
       estimate has moved from when to when." Read over THREE weeks — this
       week's average against the one two weeks before — because one week's
       change is mostly water, and an estimate built on it would move by a
       month after a salty weekend. Compared against the date you set, which
       does not move, rather than yesterday's estimate, which would. */
    var rate3 = mRate3();
    var close3 = rate3 === null ? closing : (plan.per < 0 ? -rate3 : rate3);
    var arrive = null, arriveD = null;
    if (close3 !== null && close3 > 0.05 && pr.goalLb) {
      var wk = Math.abs(st.avg7 - pr.goalLb) / close3;
      if (wk <= 260) {
        arriveD = new Date();
        arriveD.setDate(arriveD.getDate() + Math.round(wk * 7));
        arrive = mDateWord(arriveD);
      }
    }
    var lateDays = arriveD && pr.goalBy
      ? Math.round((arriveD - keyDate(pr.goalBy)) / 86400000) : null;
    /* Too slow to date. Down 0.2 lb a week on a plan that needs 1.8 put the
       arrival at "Sep 11, 2029 · 138 weeks late" — true arithmetic on three
       weeks of mostly water, and no use to anyone. Over a year late, or
       five years out, the card gives the rate instead of a date. */
    var slow = null;
    if (close3 !== null && close3 > 0.05 && pr.goalLb && (!arriveD || lateDays > 365)) {
      slow = Math.round(close3 * 10) / 10 || 0.1;
      arrive = arriveD = lateDays = null;
    }
    /* The band around the plan, from the same moving ranges. Inside it there
       is nothing to decide, and saying so is the whole job. */
    /* Never narrower than half a pound: a run of identical mornings has a
       moving range of nothing, and a band of nothing called 0.1 lb off the
       line "behind" — a scale's last digit is not a verdict. */
    var band = jump ? Math.max(0.5, 2.660 * jump.bar) : 3;
    var rate = st.dWeek === null ? null : Math.round(st.dWeek * 10) / 10;
    return {
      pr: pr, st: st, plan: plan, meas: meas, burn: burn,
      off: off, band: band, daysOff: daysOff, stale: st.staleDays,
      need: need, capped: capped, capHigh: capHigh, arrive: arrive, rate: rate,
      arriveD: arriveD, lateDays: lateDays, rate3: rate3, slow: slow, goalWord: pr.goalBy ? mDateWord(keyDate(pr.goalBy)) : '',
      /* Moving the way the goal goes, this week. */
      toward: closing !== null && closing > 0,
      side: toward > band ? 'behind' : toward < -band ? 'ahead' : 'on'
    };
  }

  return { mWeightStats: mWeightStats, mSparkSVG: mSparkSVG, mLbWord: mLbWord, mPretty: mPretty, mLongDate: mLongDate, mPlanFace: mPlanFace, mPlanDetail: mPlanDetail, mPlanWeight: mPlanWeight, mJump: mJump, mSodiumOn: mSodiumOn, mPaceFacts: mPaceFacts, MSALT_JUMP: MSALT_JUMP, MSALT_DAY: MSALT_DAY };
};
