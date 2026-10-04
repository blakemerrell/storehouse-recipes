/* The plan sheet's words: which plan the four buttons describe, named by
 * what happens to you rather than what a gym calls it (MGOAL_WORDS), the
 * line under each goal card (mtGoalWhat), and the status line over the
 * gram boxes, one fact and no lecture (mtPlanLine). The longer account is
 * with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.goalwords(app) once, as it starts, and keeps what it gives back
 * under the same names. Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).goalwords = function (app) {
  'use strict';

  // what it reads of the app's
  var MGOALS = app.MGOALS;
  var mBurn = app.mBurn;

  /* Which plan the four buttons describe. Read by the sheet and by the tests,
     which hold every key against a button rather than keeping their own copy. */
  /* Named by what happens to you, not by what a gym calls it. "Hard cut",
     "Steady cut", "Maintain" and "Lean gain" were four pieces of vocabulary
     that explain themselves only to somebody who has already been told what
     they mean, sitting on the one screen a newcomer cannot get past. */
  var MGOAL_WORDS = {
    cut2: 'Lose weight quickly', cut1: 'Lose weight steadily',
    keep: 'Stay about where I am', gain: 'Put weight on slowly'
  };

  /* The line under each goal card. "Lose weight steadily — About 1 lb a
     week" sat over an answer working the same goal out as "about 1.4 lb a
     week off" for a 190 lb man: the goals are a share of what you weigh
     (MGOALS), and the card said a figure for nobody. So it says yours,
     rounded the way the answer rounds it, and the plain words only until
     there is a weight to take a share of. */
  var MGOAL_SAY = {
    cut2: ['About 1&frac12; lb a week.', ' Hard to keep up for long.'],
    cut1: ['About 1 lb a week.', ' The pace most people finish.'],
    keep: ['Eat what you burn.', ''],
    gain: ['About &frac12; lb a week.', '']
  };
  function mtGoalWhat(val, pr) {
    var say = MGOAL_SAY[val], rate = (MGOALS[val] || {}).rate;
    if (!say) return '';
    if (!rate || !(pr && pr.lb > 0)) return say[0] + say[1];
    return 'About ' + Math.round(Math.abs(rate) * pr.lb * 10) / 10 + ' lb a week.' + say[1];
  }

  /* The status line over the gram boxes. The boxes are the plan's one
     rendering, so this speaks only when something needs saying: the profile
     cannot compute yet, or the arithmetic had to floor the carbs. */
  /* One fact, no lecture attached: a hard cut runs below the rate a body
     spends doing nothing. Worth knowing you are there; not the app's business
     to argue about it. */
  function mtPlanLine(plan, pr) {
    if (!plan) return 'Fill in who you are.';
    /* The real basal rate, not tdee/act — which is only the basal rate when
       the activity dial is what built the tdee, and is not on the told path.
       This line is the one place the plan says it is under what a body spends
       lying still, so it has to be under the right number. */
    var b = pr ? mBurn(pr) : null;
    var bmr = b ? b.bmr : null;
    if (bmr !== null && plan.kcal < bmr) {
      // written as step one writes it, so the two read as the one number they are
      return 'Below your ' + Math.round(bmr).toLocaleString() + ' kcal at rest.';
    }
    return '';
  }

  return { mtGoalWhat: mtGoalWhat, mtPlanLine: mtPlanLine, MGOAL_WORDS: MGOAL_WORDS };
};
