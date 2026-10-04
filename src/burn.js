/* What a day costs and where the plan lands you: the burn, from Mifflin–St
 * Jeor and the parts you can move, steps and sessions (mBurn,
 * MSTEP_BASE); what each finished day came to, kept for months (MINTAKE,
 * MINTAKE_DAYS, mLogIntake); the burn measured from the scale and the log
 * rather than assumed (mMeasuredTdee, mTdee); where the plan lands you and
 * when, and what one more lever is worth (mProject, mLever); a goal with a
 * date (mGoalPace); and the plan itself, a day of calories shaped by the
 * plan's rules (mSplitKcal, mPlanCalc). The longer account is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.burn(app) once, as it starts, and keeps what it gives back
 * under the same names. The weight log (MWEIGHTS) is declared further
 * down app.js, so the part reads it through LIVE (tests/scope.test.js
 * holds the lists to each other). Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).burn = function (app) {
  'use strict';

  // what it reads of the app's, and (LIVE) what the app replaces as it goes: MWEIGHTS
  var MCARB_EAT = app.MCARB_EAT;
  var MCARB_SHARE = app.MCARB_SHARE;
  var MDAYS = app.MDAYS;
  var MFAT_FLOOR = app.MFAT_FLOOR;
  var MFAT_MAX = app.MFAT_MAX;
  var MGOALS = app.MGOALS;
  var dayKey = app.dayKey;
  var kcalOf = app.kcalOf;
  var keyDate = app.keyDate;
  var mBodyFat = app.mBodyFat;
  var mDayN = app.mDayN;
  var mDoneAt = app.mDoneAt;
  var mFloorK = app.mFloorK;
  var mProtFloorG = app.mProtFloorG;
  var mProtGrams = app.mProtGrams;
  var mPut = app.mPut;
  var mTotals = app.mTotals;
  var todayKey = app.todayKey;
  var LIVE = app.LIVE;

  /* Mifflin–St Jeor for the base burn, an activity multiplier for the day, the
     goal for the swing. Protein by bodyweight and goal; fat at a quarter of
     the calories but never under 0.3 g/lb, which is the floor hormones care
     about; carbs are whatever calories are left. On a very hard cut the
     leftovers can go negative — carbs floor at zero and the calories follow
     the grams, so the plan never promises a number they do not add up to. */
  /* A day's burn before the goal touches it — null until the profile can say. */
  /* What a day costs, broken into the parts you can actually move.
   *
     The activity multiplier was a single vague dial — "active job, or 3-5
     workouts" — and the steps and sessions asked for underneath it were
     decorative: stored, printed back, and never once added up. Somebody
     asking what ten thousand steps buys them was being asked a question the
     app then ignored.
   *
     So the day is built rather than multiplied. A sedentary body costs about
     1.2 times its basal rate; walking costs roughly 0.53 kcal per kilo per
     kilometre, which at three-quarters of a metre a step is 0.037 kcal a
     step for a 205 lb man — 370 for ten thousand; and resistance training
     runs about 5 METs, near 366 kcal for a 45-minute session at that weight.
   *
     Built that way Blake's day comes to 2,539 kcal. His multiplier said
     2,540. The point was never a different number — it was a number with
     handles on it. */
  /* And then the handles threw the job away. Once a step count or a session
     was told, the day was rebuilt from 1.2 — a desk — and the activity dial
     the wizard had just asked ("On my feet") was never read again. So ticking
     one lifting day took 263 kcal OFF somebody on their feet all day: 2,446
     with no training said, 2,183 with one session. The dial's own words say
     it is only the job, and that the workouts carry the training.
   *
     The job and the step count are two guesses at one thing — how much you
     move in a day outside training — so the larger of them stands, and the
     sessions go on top. Telling the plan you train can only ever add. The job
     is read up to 1.55 here because the old five-word dial's 1.725 and 1.9
     had training inside them, and the training is counted on its own now.
     At a desk the job adds nothing, so a desk day is exactly what it was.
   *
     `steps` is that larger guess — what moving about adds to sitting still —
     and `base` stays sitting still, so the parts still add up to the day. */
  var MSTEP_BASE = 2500;          // steps a sedentary day already contains
  var MJOB_MAX = 1.55;            // the most of the dial that is the job alone

  function mBurn(pr) {
    if (!pr.age || !pr.lb || !(pr.ft * 12 + pr.inch)) return null;
    var kg = pr.lb * 0.45359237;
    var cm = (pr.ft * 12 + pr.inch) * 2.54;
    var bmr = 10 * kg + 6.25 * cm - 5 * pr.age + (pr.sex === 'f' ? -161 : 5);
    var told = (Number(pr.steps) || 0) > 0 || (Number(pr.workouts) || 0) > 0;
    if (!told) {
      // nothing said about steps or sessions, so the old dial still answers
      return { bmr: bmr, base: bmr * pr.act, steps: 0, train: 0, tdee: bmr * pr.act, told: false };
    }
    var base = bmr * 1.2;
    var perStep = 0.53 * kg * 0.00075;
    var walked = Math.max(0, (Number(pr.steps) || 0) - MSTEP_BASE) * perStep;
    var job = bmr * Math.max(0, Math.min(Number(pr.act) || 1.2, MJOB_MAX) - 1.2);
    var steps = Math.max(job, walked);
    var train = (5 * 3.5 * kg / 200) * 45 * (Number(pr.workouts) || 0) / 7;
    return { bmr: bmr, base: base, steps: steps, train: train,
      tdee: base + steps + train, told: true };
  }

  /* What you actually burn, measured rather than assumed.
   *
     Mifflin–St Jeor is a population average, and an individual routinely sits
     two or three hundred calories either side of it — which on a cut is the
     difference between arriving in December and arriving in March. But the
     day already knows what you ate and the scale already knows what happened,
     and those two together say what you burn without any equation about your
     height at all:
   *
       burn = what you ate  −  what you stored
   *
     with a pound of body mass taken at 3500 kcal. Eat 2000 and lose a pound a
     week and you are burning 2500; eat 2000 and gain one and you are burning
     1500.
   *
     Two guards against believing noise. Weight is read as the average of the
     first week against the average of the last, never two single mornings —
     a Tuesday against a Tuesday is mostly water and yesterday's salt. And it
     will not answer at all under three weeks of overlap, because a fortnight
     of scale noise can manufacture several hundred calories of imaginary
     burn. */
  var MTDEE_MIN_DAYS = 21;

  /* What each finished day came to, kept long after the day itself.
   *
     The measured burn is calories in against weight change, and the two
     sides were read over different stretches: weight from the first week
     ever logged — up to a year back — against food from the last fourteen
     days, because that is all the day log keeps. Somebody who lost twenty
     pounds in the spring and has held steady since read as burning 3,000 on
     2,400 a day. So each past day's total is kept here, one number a day
     for four months, and the burn compares food and weight over the SAME
     weeks.
   *
     Only days behind you: today is not over, and counted as a whole day at
     breakfast it read as a fast. Only food marked eaten — or everything on a
     day you closed — because a plan is not a meal. Kept on this device, from
     the days this device has seen; the days themselves sync, so any device
     opened at least once a fortnight keeps the whole record. */
  var MINTAKE_DAYS = 120;
  var MINTAKE = (function () {
    try {
      var v = JSON.parse(localStorage.getItem('bsc.macroIntake'));
      if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    } catch (e) { /* none yet */ }
    return {};
  })();

  function mLogIntake() {
    var today = todayKey(), moved = false;
    Object.keys(MDAYS).forEach(function (k) {
      if (k >= today) return;
      var tot = mTotals(MDAYS[k]);
      var kc = mDoneAt(k) ? tot.all.kcal : tot.eaten.kcal;
      var v = kc > 400 ? Math.round(kc) : 0;
      if (v && MINTAKE[k] !== v) { MINTAKE[k] = v; moved = true; }
      if (!v && MINTAKE[k]) { delete MINTAKE[k]; moved = true; }
    });
    var cut = new Date(); cut.setDate(cut.getDate() - MINTAKE_DAYS);
    var cutK = dayKey(cut);
    Object.keys(MINTAKE).forEach(function (k) { if (k < cutK) { delete MINTAKE[k]; moved = true; } });
    if (moved) {
      mPut('bsc.macroIntake', MINTAKE);
    }
  }

  /* The last eight weeks at most: long enough to see through water, short
     enough to be about the body you have now. */
  var MTDEE_WINDOW = 56;

  function mMeasuredTdee() {
    mLogIntake();
    var dayN = mDayN;
    var todayN = dayN(todayKey());
    var iKeys = Object.keys(MINTAKE).filter(function (k) {
      return todayN - dayN(k) <= MTDEE_WINDOW;
    }).sort();
    if (iKeys.length < 14) return null;
    var firstN = dayN(iKeys[0]), lastN = dayN(iKeys[iKeys.length - 1]);
    if (lastN - firstN < MTDEE_MIN_DAYS) return null;

    /* A week at each end OF THE FOOD'S OWN STRETCH, and the distance between
       their middles — the span the weight change happened over, and the
       span the food was eaten over, the same span. */
    var head = [], tail = [];
    Object.keys(LIVE.MWEIGHTS).forEach(function (k) {
      var n = dayN(k), w = LIVE.MWEIGHTS[k];
      if (!(w > 0)) return;
      if (n >= firstN && n - firstN < 7) head.push(w);
      if (n <= lastN && lastN - n < 7) tail.push(w);
    });
    if (head.length < 3 || tail.length < 3) return null;
    var mean = function (a) {
      return a.reduce(function (s0, x) { return s0 + x; }, 0) / a.length;
    };
    var days = (lastN - 3) - (firstN + 3);
    if (days < 14) return null;

    var kcals = iKeys.map(function (k) { return MINTAKE[k]; });
    var eaten = mean(kcals);
    var dLb = mean(tail) - mean(head);          // positive means gained
    var burn = eaten - (dLb * 3500 / days);
    if (!isFinite(burn) || burn < 800 || burn > 6000) return null;
    return {
      tdee: Math.round(burn), days: days, meals: kcals.length,
      eaten: Math.round(eaten), lb: Math.round(dLb * 10) / 10
    };
  }

  function mTdee(pr) {
    /* Measured beats estimated, once you have said so — the formula is only
       ever a stand-in for this number. */
    if (pr && pr.useTdee) {
      var m = mMeasuredTdee();
      if (m) return m.tdee;
    }
    var b = mBurn(pr);
    return b === null ? null : b.tdee;
  }

  /* Where the current plan lands you, and when. The same equation the date
     solves backwards, solved forwards: pick a pace, get a date. */
  function mProject(pr) {
    var plan = mPlanCalc(pr);
    if (!plan || !pr.goalLb || !pr.lb) return null;
    var lbs = pr.lb - pr.goalLb;
    if (Math.abs(lbs) < 0.5) return null;
    var tdee = mTdee(pr);
    var perWeek = (tdee - plan.kcal) * 7 / 3500;
    if (lbs > 0 ? perWeek <= 0.05 : perWeek >= -0.05) return null;
    var weeks = lbs / perWeek;
    if (weeks <= 0 || weeks > 260) return null;
    var d = new Date();
    d.setDate(d.getDate() + Math.round(weeks * 7));
    return { perWeek: perWeek, weeks: weeks, when: d, lbs: lbs };
  }

  /* What one more lever is worth, said both ways — because both are true and
     people mean different ones. More walking either buys food at the same
     pace, or the same food sooner. */
  function mLever(pr, extraKcal) {
    var pj = mProject(pr);
    var out = { kcal: Math.round(extraKcal), weeks: null };
    if (pj) {
      var faster = pj.perWeek + (pj.lbs > 0 ? 1 : -1) * extraKcal * 7 / 3500;
      var w2 = pj.lbs / faster;
      if (w2 > 0) out.weeks = pj.weeks - w2;
    }
    return out;
  }

  /* A goal with a date does its own arithmetic: the pounds between here and
     there, over the weeks between now and then, at 3500 kcal to the pound.
     It beats a preset because it is answerable — you either arrive or you
     do not — and it is what the preset was standing in for.
   *
     Capped at 1% of bodyweight a week. Past that a cut stops being a cut and
     starts costing muscle, and the sheet says so rather than quietly writing
     a number nobody should eat to. */
  function mGoalPace(pr) {
    if (!pr.goalLb || !pr.goalBy || !pr.lb) return null;
    var tdee = mTdee(pr);
    if (tdee === null) return null;
    var days = Math.round((keyDate(pr.goalBy) - keyDate(todayKey())) / 86400000);
    if (!isFinite(days) || days < 7) return null;
    var lbs = pr.lb - pr.goalLb;
    var wanted = lbs / (days / 7);

    /* Two caps, and the one that used to be here was the weaker of them.
     *
     * A pound a week per hundred of bodyweight sounds careful until you do
     * the arithmetic on a big frame: at 205 lb it allows 2.05 lb a week,
     * which is a 1,025 kcal deficit — forty percent of the day's burn, and
     * three hundred calories BELOW what the body spends lying still. The app
     * was writing that plan and then wondering why no real meal would fit
     * inside it: sixty percent of the calories went to protein, three
     * percent to carbs, and every suggestion came back a quarter portion.
     *
     * So the rate cap keeps its place, and a second sits in front of it: the
     * deficit may not take the day under the floor the plan lives at
     * (mFloorK — 1,500 for a man, 1,200 for a woman). Whichever bites first
     * wins, and the plan says so. The morning line keeps a stricter floor of
     * its own, never under the basal rate; see mPaceFacts. */
    var floorK = mFloorK(pr);
    var maxOff = Math.max(0, tdee - floorK);
    /* And no faster than the fat can supply it. This is the cap that is
       actually about the person rather than about an average. */
    var fat = mBodyFat(pr);
    if (fat) maxOff = Math.min(maxOff, fat.lb * MFAT_MAX);
    var maxOn = 0.20 * tdee;                       // gaining, the other way
    var capRate = pr.lb * (lbs >= 0 ? 0.01 : 0.005);
    var capKcal = (lbs >= 0 ? maxOff : maxOn) * 7 / 3500;
    var cap = Math.min(capRate, capKcal);

    var perWeek = wanted;
    var capped = Math.abs(perWeek) > cap;
    if (capped) perWeek = perWeek > 0 ? cap : -cap;
    /* When the date cannot be met, the honest thing is to say when it can. */
    var realWeeks = perWeek ? Math.abs(lbs / perWeek) : null;
    return { days: days, lbs: lbs, perWeek: perWeek, capped: capped,
      kcal: perWeek * 3500 / 7, realWeeks: realWeeks,
      floorK: floorK, wanted: wanted };
  }

  /* A day of `kcal` shaped like `t`, by the plan's own rules.
   *
     The Eat button used to hold protein at its grams, take a quarter of the
     change from fat and the rest from carbohydrate — and a cut deep enough
     left carbohydrate under twelve percent, which mReadTargets reads as a
     day nobody can eat and replaces with the plan on the very next read. So
     the button did nothing, and offered itself again. The plan's order:
     carbohydrate keeps the eatable line, protein gives ground to its floor
     first, fat to its floor last. mFloorK is priced at exactly those
     floors, so any kcal at or over it has a split. */
  function mSplitKcal(kcal, t, pr) {
    var lb = pr && pr.lb > 0 ? pr.lb : 0;
    var pMin = lb ? mProtFloorG(pr) : 0;
    var fMin = lb ? Math.max(1, Math.round(MFAT_FLOOR * lb)) : 0;
    var now = kcalOf(t);
    var p = t.p;
    var f = Math.max(Math.min(t.f, fMin), Math.round(t.f + (kcal - now) * 0.25 / 9));
    /* To the eatable line, not the plan's own share: protein is what a cut
       protects, so it gives only what the day needs to stay eatable. A gram
       over the line, so rounding cannot land it a hair under. */
    var minC = Math.ceil(MCARB_EAT * kcal / 4) + 1;
    if ((kcal - 4 * p - 9 * f) / 4 < minC) {
      p = Math.max(pMin, Math.floor((kcal - 9 * f - 4 * minC) / 4));
    }
    if ((kcal - 4 * p - 9 * f) / 4 < minC) {
      f = Math.max(fMin, Math.round((kcal - 4 * p - 4 * minC) / 9));
    }
    var c = Math.max(0, Math.round((kcal - 4 * p - 9 * f) / 4));
    return { p: Math.max(0, p), f: Math.max(0, f), c: c };
  }

  function mPlanCalc(pr) {
    var tdee = mTdee(pr);
    if (tdee === null) return null;
    var g = MGOALS[pr.goal] || MGOALS.cut1;
    var pace = mGoalPace(pr);
    /* One engine, two ways in: a date works out the rate it needs, a preset
       names one outright. Both arrive here as pounds a week. */
    var perWeek = pace ? pace.perWeek : g.rate * pr.lb;
    /* A preset cut asks the same of the fat store that a dated goal is
       allowed to. mGoalPace caps a deficit at what the fat can supply
       (MFAT_MAX a pound a day); the presets never asked, so a lean 200 lb
       man on the hard cut was planned 999 under his burn against a ceiling
       of 660 — while the same two pounds a week reached through a date came
       out 340 kcal higher. One ceiling, whichever way in. */
    if (!pace && perWeek > 0) {
      var fatP = mBodyFat(pr);
      if (fatP) perWeek = Math.min(perWeek, fatP.lb * MFAT_MAX * 7 / 3500);
    }
    var kcal = Math.max(mFloorK(pr), Math.round(tdee - perWeek * 3500 / 7));
    var p = mProtGrams(pr);
    var f = Math.round(Math.max(MFAT_FLOOR * pr.lb, 0.25 * kcal / 9));
    /* Protein and fat first, but not to the last calorie. A day left with
       three percent of itself for carbohydrate is a day no dinner in the
       book fits inside, and the picker can only answer it with quarter
       portions. Protein gives ground before the plate does — down to 0.8 g
       a pound of its reference, which is still more than a cut needs. */
    var minC = Math.round(MCARB_SHARE * kcal / 4);
    if ((kcal - 4 * p - 9 * f) / 4 < minC) {
      var room = kcal - 9 * f - 4 * minC;
      p = Math.max(mProtFloorG(pr), Math.round(room / 4));
    }
    var c = Math.max(0, Math.round((kcal - 4 * p - 9 * f) / 4));
    /* Said once, off the grams. A floor can lift the day but not lower the
       protein and fat floors under it, and a plan that printed 1,200 over
       grams adding to 1,475 was two answers to one question — the face and
       the projection read one, the bars and the wizard the other. */
    return { kcal: kcalOf({ p: p, f: f, c: c }), p: p, f: f, c: c };
  }

  return { mBurn: mBurn, mLogIntake: mLogIntake, mMeasuredTdee: mMeasuredTdee, mTdee: mTdee, mProject: mProject, mLever: mLever, mGoalPace: mGoalPace, mSplitKcal: mSplitKcal, mPlanCalc: mPlanCalc, MSTEP_BASE: MSTEP_BASE, MINTAKE_DAYS: MINTAKE_DAYS, MINTAKE: MINTAKE };
};
