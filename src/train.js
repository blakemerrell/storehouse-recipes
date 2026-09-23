/* ---------------------------------------------------------------------------
 * Train — a lifting block, the logger you carry into the gym, and what the
 * two add up to.
 *
 * Two apps' ideas in one tab, and a third thing neither of them does:
 *
 *   the block    Renaissance Periodization's mesocycle. A split built from
 *                the days you have and the kit you own; each muscle starting
 *                near the least volume that reliably grows it; sets moved
 *                week to week by how the last session actually felt; reps in
 *                reserve stepping from 3 down to 0; a deload to finish.
 *   the logger   Strong's. Set by set, last time's numbers beside this time's
 *                boxes, a rest timer that starts itself when you tick a set,
 *                plates worked out, a warm-up ramp, records as they fall.
 *   the review   What you did, held against what the research says — as a
 *                formula, not an opinion. Blake: "Review is simply review
 *                based on inputs and outputs compared to best science
 *                available. Should be pretty formulaic." It is, and every
 *                rule in it names the paper it came from.
 *
 * Personal, like My Day. Kept on this device, and carried by the account —
 * /users/{uid}, field `train` — once somebody is signed in, through the one
 * listener app.js already holds on that document. The household never sees
 * any of it.
 *
 * Loaded BEFORE app.js. app.js calls in through window.Train, and hands over
 * the things it owns — the back gesture, the confirm dialog, the day's
 * "trained" tick — through window.Hive, which it sets once it has booted.
 * ------------------------------------------------------------------------- */
(function () {
  'use strict';

  function hive() { return window.Hive || null; }
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function plain(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function fin(v) { return typeof v === 'number' && isFinite(v); }
  function readLS(k) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function writeLS(k, v) {
    try {
      if (v === null || v === undefined) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(v));
    } catch (e) { /* private mode: this session only */ }
  }
  /* Firestore refuses a write carrying `undefined` anywhere in it, and takes
     the whole write down with it, while localStorage quietly drops the key —
     so a workout that saved perfectly here would never reach the other
     device. A JSON round trip is the cheapest way to be sure. */
  function clean(v) { return JSON.parse(JSON.stringify(v)); }
  function newId() {
    // letters and digits only: these become map keys in Firestore
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function dayKey(d) {
    // the local calendar, never toISOString(), which is UTC
    var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  }
  var DAY_MS = 864e5;

  /* ------------------------------------------------------------ the muscles
   *
   * With Renaissance Periodization's volume landmarks: hard sets a week, for
   * somebody a few years in. MEV is the least that reliably grows the muscle;
   * MRV the most they expect you to recover from.
   *
   * These are RP's published starting estimates (Israetel, Hoffmann & Smith),
   * not measurements. They are practitioner numbers laid over the
   * dose-response research, and people land a long way either side of them.
   * So they are only where a block STARTS and the ceiling it stops climbing
   * at. Everything between is moved by what you report. A zero MEV means the
   * big compound lifts are thought to cover that muscle on their own. */
  var MUSCLES = [
    { k: 'chest', n: 'Chest', mev: 8, mrv: 22 },
    { k: 'back', n: 'Back', mev: 10, mrv: 25 },
    { k: 'quads', n: 'Quads', mev: 8, mrv: 20 },
    { k: 'hams', n: 'Hamstrings', mev: 6, mrv: 20 },
    { k: 'glutes', n: 'Glutes', mev: 0, mrv: 16 },
    { k: 'side', n: 'Side delts', mev: 8, mrv: 26 },
    { k: 'rear', n: 'Rear delts', mev: 6, mrv: 22 },
    { k: 'front', n: 'Front delts', mev: 0, mrv: 12 },
    { k: 'biceps', n: 'Biceps', mev: 8, mrv: 26 },
    { k: 'triceps', n: 'Triceps', mev: 6, mrv: 18 },
    { k: 'calves', n: 'Calves', mev: 8, mrv: 20 },
    { k: 'traps', n: 'Traps', mev: 0, mrv: 26 },
    { k: 'abs', n: 'Core', mev: 0, mrv: 25 }
  ];
  var MUS = {};
  MUSCLES.forEach(function (m) { MUS[m.k] = m; });

  /* ---------------------------------------------------------- the exercises
   *
   *   id, name, muscle, kind (c compound / i isolation), equipment, pattern,
   *   rep range low, high
   *
   * Equipment is bb barbell, db dumbbell, mc machine, cb cable, sm smith,
   * bw bodyweight. The pattern is what a split asks for when it wants a
   * particular KIND of chest press rather than any chest press, so that a
   * full-body day does not draw two flat presses.
   *
   * The rep ranges sit inside five to thirty, where load barely matters to
   * growth provided the set goes close to failure (Schoenfeld et al. 2017).
   * Library order is preference order within a muscle: the generator takes
   * the first that fits the kit, so a pulldown comes before a pull-up —
   * it loads in five-pound steps, and plenty of people cannot do five
   * pull-ups in week one.
   *
   * Heavy barbell work sits low in it, because a set of twenty back squats is
   * limited by breathing before the legs. Laterals, calves and the small
   * muscles sit high, because a set of six laterals is mostly momentum.
   *
   * Sets count toward the listed muscle only. That is the convention the
   * landmarks above were written in — a bench press is chest volume, and the
   * triceps' MEV already assumes it is being done. */
  var LIB_ROWS = [
    ['bb-bench', 'Barbell Bench Press', 'chest', 'c', 'bb', 'flat', 6, 10],
    ['db-bench', 'Dumbbell Bench Press', 'chest', 'c', 'db', 'flat', 8, 12],
    ['mc-press', 'Machine Chest Press', 'chest', 'c', 'mc', 'flat', 8, 12],
    ['bb-incline', 'Incline Barbell Press', 'chest', 'c', 'bb', 'incline', 6, 10],
    ['db-incline', 'Incline Dumbbell Press', 'chest', 'c', 'db', 'incline', 8, 12],
    ['sm-incline', 'Smith Machine Incline Press', 'chest', 'c', 'sm', 'incline', 8, 12],
    ['dip', 'Dip', 'chest', 'c', 'bw', 'dip', 6, 15],
    ['pushup', 'Deficit Push-Up', 'chest', 'c', 'bw', 'flat', 10, 25],
    ['cb-fly', 'Cable Fly', 'chest', 'i', 'cb', 'fly', 10, 15],
    ['pec-deck', 'Pec Deck', 'chest', 'i', 'mc', 'fly', 10, 15],
    ['db-fly', 'Dumbbell Fly', 'chest', 'i', 'db', 'fly', 10, 15],

    ['lat-pd', 'Lat Pulldown', 'back', 'c', 'cb', 'vert', 8, 12],
    ['pullup', 'Pull-Up', 'back', 'c', 'bw', 'vert', 5, 12],
    ['lat-pd-n', 'Close-Grip Pulldown', 'back', 'c', 'cb', 'vert', 8, 12],
    ['chinup', 'Chin-Up', 'back', 'c', 'bw', 'vert', 5, 12],
    ['bb-row', 'Barbell Row', 'back', 'c', 'bb', 'horiz', 6, 10],
    ['mc-row', 'Chest-Supported Machine Row', 'back', 'c', 'mc', 'horiz', 8, 12],
    ['cb-row', 'Seated Cable Row', 'back', 'c', 'cb', 'horiz', 8, 12],
    ['db-row', 'One-Arm Dumbbell Row', 'back', 'c', 'db', 'horiz', 8, 12],
    ['db-cs-row', 'Chest-Supported Dumbbell Row', 'back', 'c', 'db', 'horiz', 8, 12],
    ['db-pullover', 'Dumbbell Pullover', 'back', 'i', 'db', 'iso', 10, 15],
    ['cb-straight', 'Straight-Arm Pulldown', 'back', 'i', 'cb', 'iso', 10, 15],

    ['bb-squat', 'Back Squat', 'quads', 'c', 'bb', 'squat', 6, 10],
    ['hack', 'Hack Squat', 'quads', 'c', 'mc', 'squat', 8, 12],
    ['bb-front', 'Front Squat', 'quads', 'c', 'bb', 'squat', 6, 10],
    ['sm-squat', 'Smith Machine Squat', 'quads', 'c', 'sm', 'squat', 8, 12],
    ['leg-press', 'Leg Press', 'quads', 'c', 'mc', 'machine', 8, 15],
    ['belt-squat', 'Belt Squat', 'quads', 'c', 'mc', 'machine', 8, 12],
    ['db-bss', 'Bulgarian Split Squat', 'quads', 'c', 'db', 'single', 8, 12],
    ['goblet', 'Goblet Squat', 'quads', 'c', 'db', 'squat', 8, 15],
    ['db-lunge', 'Walking Lunge', 'quads', 'c', 'db', 'single', 8, 12],
    ['db-stepup', 'Dumbbell Step-Up', 'quads', 'c', 'db', 'single', 8, 12],
    ['leg-ext', 'Leg Extension', 'quads', 'i', 'mc', 'ext', 10, 15],

    ['bb-rdl', 'Romanian Deadlift', 'hams', 'c', 'bb', 'hinge', 6, 10],
    ['db-rdl', 'Dumbbell Romanian Deadlift', 'hams', 'c', 'db', 'hinge', 8, 12],
    ['bb-sldl', 'Stiff-Legged Deadlift', 'hams', 'c', 'bb', 'hinge', 6, 10],
    ['bb-dl', 'Deadlift', 'hams', 'c', 'bb', 'hinge', 5, 8],
    ['good-am', 'Good Morning', 'hams', 'c', 'bb', 'hinge', 8, 12],
    ['lying-curl', 'Lying Leg Curl', 'hams', 'i', 'mc', 'curl', 10, 15],
    ['seated-curl', 'Seated Leg Curl', 'hams', 'i', 'mc', 'curl', 10, 15],
    ['nordic', 'Nordic Curl', 'hams', 'i', 'bw', 'curl', 5, 10],
    ['ball-curl', 'Stability-Ball Leg Curl', 'hams', 'i', 'bw', 'curl', 10, 20],

    ['hip-thrust', 'Barbell Hip Thrust', 'glutes', 'c', 'bb', 'thrust', 8, 12],
    ['mc-thrust', 'Machine Hip Thrust', 'glutes', 'c', 'mc', 'thrust', 8, 12],
    ['db-thrust', 'Dumbbell Hip Thrust', 'glutes', 'c', 'db', 'thrust', 10, 15],
    ['back-ext', '45° Back Extension', 'glutes', 'i', 'bw', 'iso', 10, 20],
    ['abduct', 'Hip Abduction Machine', 'glutes', 'i', 'mc', 'iso', 12, 20],
    ['cb-kick', 'Cable Kickback', 'glutes', 'i', 'cb', 'iso', 12, 20],

    ['db-lat', 'Dumbbell Lateral Raise', 'side', 'i', 'db', 'raise', 12, 20],
    ['cb-lat', 'Cable Lateral Raise', 'side', 'i', 'cb', 'raise', 12, 20],
    ['mc-lat', 'Machine Lateral Raise', 'side', 'i', 'mc', 'raise', 12, 20],
    ['cb-upright', 'Cable Upright Row', 'side', 'i', 'cb', 'raise', 10, 15],

    ['rev-deck', 'Reverse Pec Deck', 'rear', 'i', 'mc', 'fly', 12, 20],
    ['face-pull', 'Face Pull', 'rear', 'i', 'cb', 'fly', 12, 20],
    ['db-rear', 'Bent-Over Rear Delt Fly', 'rear', 'i', 'db', 'fly', 12, 20],
    ['cb-rear', 'Cable Rear Delt Fly', 'rear', 'i', 'cb', 'fly', 12, 20],

    ['bb-ohp', 'Overhead Press', 'front', 'c', 'bb', 'press', 6, 10],
    ['db-ohp', 'Seated Dumbbell Shoulder Press', 'front', 'c', 'db', 'press', 8, 12],
    ['mc-ohp', 'Machine Shoulder Press', 'front', 'c', 'mc', 'press', 8, 12],
    ['db-front', 'Dumbbell Front Raise', 'front', 'i', 'db', 'raise', 10, 15],

    ['bb-curl', 'Barbell Curl', 'biceps', 'i', 'bb', '', 8, 12],
    ['ez-curl', 'EZ-Bar Curl', 'biceps', 'i', 'bb', '', 8, 12],
    ['db-curl', 'Dumbbell Curl', 'biceps', 'i', 'db', '', 10, 15],
    ['inc-curl', 'Incline Dumbbell Curl', 'biceps', 'i', 'db', '', 10, 15],
    ['hammer', 'Hammer Curl', 'biceps', 'i', 'db', '', 10, 15],
    ['cb-curl', 'Cable Curl', 'biceps', 'i', 'cb', '', 10, 15],
    ['preacher', 'Machine Preacher Curl', 'biceps', 'i', 'mc', '', 10, 15],

    ['pushdown', 'Cable Pushdown', 'triceps', 'i', 'cb', '', 10, 15],
    ['cb-oh-ext', 'Overhead Cable Extension', 'triceps', 'i', 'cb', '', 10, 15],
    ['skull', 'EZ-Bar Skull Crusher', 'triceps', 'i', 'bb', '', 8, 12],
    ['db-oh-ext', 'Overhead Dumbbell Extension', 'triceps', 'i', 'db', '', 10, 15],
    ['mc-tri', 'Machine Triceps Extension', 'triceps', 'i', 'mc', '', 10, 15],
    ['cgbp', 'Close-Grip Bench Press', 'triceps', 'c', 'bb', '', 6, 10],
    ['bench-dip', 'Bench Dip', 'triceps', 'c', 'bw', '', 10, 20],

    ['calf-stand', 'Standing Calf Raise', 'calves', 'i', 'mc', '', 10, 20],
    ['calf-seat', 'Seated Calf Raise', 'calves', 'i', 'mc', '', 12, 20],
    ['calf-lp', 'Leg Press Calf Raise', 'calves', 'i', 'mc', '', 10, 20],
    ['calf-db', 'Single-Leg Dumbbell Calf Raise', 'calves', 'i', 'db', '', 10, 20],

    ['db-shrug', 'Dumbbell Shrug', 'traps', 'i', 'db', '', 10, 15],
    ['bb-shrug', 'Barbell Shrug', 'traps', 'i', 'bb', '', 10, 15],
    ['cb-shrug', 'Cable Shrug', 'traps', 'i', 'cb', '', 12, 20],

    ['cb-crunch', 'Cable Crunch', 'abs', 'i', 'cb', '', 10, 20],
    ['hang-raise', 'Hanging Leg Raise', 'abs', 'i', 'bw', '', 8, 15],
    ['ab-wheel', 'Ab Wheel Rollout', 'abs', 'i', 'bw', '', 8, 15],
    ['mc-crunch', 'Machine Crunch', 'abs', 'i', 'mc', '', 10, 20],
    ['crunch', 'Crunch', 'abs', 'i', 'bw', '', 12, 25],
    ['pallof', 'Pallof Press', 'abs', 'i', 'cb', '', 10, 15],
    ['dead-bug', 'Dead Bug', 'abs', 'i', 'bw', '', 8, 12],
    ['bird-dog', 'Bird Dog', 'abs', 'i', 'bw', '', 8, 12]
  ];

  /* ------------------------------------------------------------ the back
   *
   * What each exercise asks of the lower back, in three ways a back can
   * object: F loaded bending (the spine rounding, or held rounded, under
   * weight — bent-over rows, the bottom of a deep squat, deadlifts, crunches),
   * C compression (weight pressing down through it — a bar on the shoulders,
   * shoulder pads, heavy dumbbells at your sides), X extension (arching under
   * load). A capital is a lot of it, a small letter some.
   *
   * With "protect my back" on, a capital in any of your triggers keeps that
   * exercise out of every block; a small letter lets it in but ranks it
   * below one that asks nothing, and puts a cue on it. Nothing is hidden
   * from the picker — you can still choose any of them; they say what they
   * load.
   *
   * These are judgements from the movement, not measurements of your spine.
   * What suits a particular back is for the physio who has examined it; the
   * avoid list is where their answer goes. */
  var BACK = {
    'bb-row': 'Fc', 'cb-row': 'f', 'db-row': 'f', 'db-pullover': 'x',
    'bb-squat': 'FC', 'bb-front': 'fC', 'sm-squat': 'fc', 'goblet': 'fc', 'hack': 'c',
    'leg-press': 'f', 'db-bss': 'c', 'db-lunge': 'c', 'db-stepup': 'c',
    'bb-rdl': 'F', 'db-rdl': 'F', 'bb-sldl': 'F', 'bb-dl': 'FC', 'good-am': 'F',
    'hip-thrust': 'x', 'mc-thrust': 'x', 'db-thrust': 'x', 'back-ext': 'Fx',
    'db-rear': 'f', 'bb-ohp': 'Cx', 'calf-stand': 'C',
    'db-shrug': 'c', 'bb-shrug': 'C', 'cb-shrug': 'c',
    'cb-crunch': 'F', 'hang-raise': 'F', 'mc-crunch': 'F', 'crunch': 'F', 'ab-wheel': 'X'
  };
  var BACK_CUE = {
    f: 'Stop each rep before your lower back starts to round.',
    c: 'Brace before every rep, and leave it out on a day your back is cranky.',
    x: 'Finish with your glutes, not by arching your lower back.'
  };
  var LIB = {}, LIB_LIST = [];
  LIB_ROWS.forEach(function (r, i) {
    var ex = { id: r[0], n: r[1], m: r[2], k: r[3], q: r[4], p: r[5], rr: [r[6], r[7]], o: i, bk: BACK[r[0]] || '' };
    LIB[ex.id] = ex;
    LIB_LIST.push(ex);
  });

  var EQUIP = { bb: 'Barbell', db: 'Dumbbell', mc: 'Machine', cb: 'Cable', sm: 'Smith machine', bw: 'Bodyweight' };

  /* What you have to train with. The generator only draws from these. */
  var KITS = {
    gym: { n: 'Full gym', eq: ['bb', 'db', 'mc', 'cb', 'sm', 'bw'] },
    bar: { n: 'Barbell & dumbbells', eq: ['bb', 'db', 'bw'] },
    db: { n: 'Dumbbells only', eq: ['db', 'bw'] }
  };

  /* ------------------------------------------------------------ the splits
   *
   * One per number of days, each slot "muscle/kind/pattern". Every muscle
   * lands at least twice a week wherever the days allow it. Frequency barely
   * matters once weekly sets are equal (Schoenfeld, Grgic & Krieger 2019),
   * but a muscle hit once has to take its whole week's sets in one sitting,
   * and the last of twelve chest sets in a row is not doing what the first
   * one did. Big lifts go first, while you are fresh enough to load them. */
  var SPLITS = {
    2: { n: 'Full body', days: [
      ['Full Body A', ['quads/c/squat', 'chest/c/flat', 'back/c/vert', 'hams/i/curl', 'side/i', 'triceps/i', 'calves/i']],
      ['Full Body B', ['hams/c/hinge', 'back/c/horiz', 'chest/c/incline', 'quads/i', 'side/i', 'biceps/i', 'abs/i']]
    ] },
    3: { n: 'Full body', days: [
      ['Full Body A', ['quads/c/squat', 'chest/c/flat', 'back/c/vert', 'hams/i/curl', 'side/i', 'biceps/i']],
      ['Full Body B', ['hams/c/hinge', 'back/c/horiz', 'chest/c/incline', 'quads/i', 'rear/i', 'triceps/i', 'calves/i']],
      ['Full Body C', ['quads/c/single', 'back/c/vert', 'chest/c/flat', 'hams/i/curl', 'side/i', 'triceps/i', 'abs/i']]
    ] },
    4: { n: 'Upper / lower', days: [
      ['Upper A', ['chest/c/flat', 'back/c/vert', 'chest/i/fly', 'back/c/horiz', 'side/i', 'triceps/i', 'biceps/i']],
      ['Lower A', ['quads/c/squat', 'hams/c/hinge', 'quads/i', 'hams/i/curl', 'calves/i', 'abs/i']],
      ['Upper B', ['back/c/horiz', 'chest/c/incline', 'back/c/vert', 'side/i', 'rear/i', 'biceps/i', 'triceps/i']],
      ['Lower B', ['hams/i/curl', 'quads/c/machine', 'glutes/c/thrust', 'quads/i', 'calves/i', 'abs/i']]
    ] },
    5: { n: 'Upper / lower / push / pull / legs', days: [
      ['Upper', ['chest/c/flat', 'back/c/vert', 'back/c/horiz', 'side/i', 'triceps/i', 'biceps/i']],
      ['Lower', ['quads/c/squat', 'hams/c/hinge', 'quads/i', 'calves/i', 'abs/i']],
      ['Push', ['chest/c/incline', 'front/c/press', 'chest/i/fly', 'side/i', 'triceps/i']],
      ['Pull', ['back/c/vert', 'back/c/horiz', 'rear/i', 'biceps/i', 'traps/i']],
      ['Legs', ['hams/i/curl', 'quads/c/machine', 'glutes/c/thrust', 'quads/i', 'calves/i']]
    ] },
    6: { n: 'Push / pull / legs, twice', days: [
      ['Push A', ['chest/c/flat', 'front/c/press', 'chest/i/fly', 'side/i', 'triceps/i']],
      ['Pull A', ['back/c/vert', 'back/c/horiz', 'rear/i', 'biceps/i', 'traps/i']],
      ['Legs A', ['quads/c/squat', 'hams/c/hinge', 'quads/i', 'calves/i', 'abs/i']],
      ['Push B', ['chest/c/incline', 'chest/c/flat', 'side/i', 'triceps/i', 'side/i']],
      ['Pull B', ['back/c/horiz', 'back/c/vert', 'rear/i', 'biceps/i', 'biceps/i']],
      ['Legs B', ['hams/i/curl', 'quads/c/machine', 'glutes/c/thrust', 'quads/i', 'calves/i', 'abs/i']]
    ] }
  };

  /* What you tell it after a session, in RP's words, and what each answer
     is worth to next week's sets. A good session is a positive number; a
     session that has run past what you can recover from is a negative one.
     See feedback() for how they add up. */
  var SORE = ['Healed early', 'Just in time', 'Still sore'];
  var SORE_W = ['recovered early', 'healed just in time', 'still sore'];
  var SORE_V = [1, 0, -1];
  var PUMP = ['Low', 'Moderate', 'Great'];
  var PUMP_W = ['low pump', 'moderate pump', 'great pump'];
  var PUMP_V = [1, 0, -1];
  var WORK = ['Easy', 'About right', 'Pushed my limits', 'Too much'];
  var WORK_W = ['felt easy', 'workload about right', 'pushed your limits', 'too much'];
  var WORK_V = [1, 0, -1, -2];
  var JOINT = ['None', 'Some', 'A lot'];

  /* ------------------------------------------------------------ the sources
   *
   * Every rule in the review points at one of these. Journals and years
   * rather than volume and page, because the point is to be findable. */
  var REFS = {
    vol17: ['Schoenfeld, Ogborn & Krieger (2017)', 'Dose-response relationship between weekly resistance training volume and increases in muscle mass. Journal of Sports Sciences.',
      'More weekly sets, more growth. Under five sets a week grew the least; ten or more the most.'],
    vol24: ['Pelland et al. (2024)', 'The resistance training dose response: meta-regressions of weekly volume and frequency on hypertrophy and strength. SportRxiv preprint.',
      'Growth keeps rising with sets, but each extra set buys less than the one before.'],
    freq19: ['Schoenfeld, Grgic & Krieger (2019)', 'How many times per week should a muscle be trained to maximize muscle hypertrophy? Journal of Sports Sciences.',
      'With weekly sets equal, training a muscle once or three times a week grows it about the same.'],
    freq16: ['Schoenfeld, Ogborn & Krieger (2016)', 'Effects of resistance training frequency on measures of muscle hypertrophy. Sports Medicine.',
      'Twice a week beat once a week in the studies available then, mostly because it carried more sets.'],
    fail23: ['Refalo et al. (2023)', 'Influence of resistance training proximity-to-failure on skeletal muscle hypertrophy. Sports Medicine.',
      'Going all the way to failure grew about as much as stopping a rep or two short.'],
    fail24: ['Robinson et al. (2024)', 'Exploring the dose-response relationship between estimated resistance training proximity to failure, strength gain, and muscle hypertrophy. Sports Medicine.',
      'Growth improves the closer a set ends to failure. Strength cares much less.'],
    load17: ['Schoenfeld, Grgic, Ogborn & Krieger (2017)', 'Strength and hypertrophy adaptations between low- vs. high-load resistance training. Journal of Strength and Conditioning Research.',
      'Light and heavy loads grow muscle alike when sets go close to failure. Heavy wins for strength.'],
    rest16: ['Schoenfeld et al. (2016)', 'Longer interset rest periods enhance muscle strength and hypertrophy in resistance-trained men. Journal of Strength and Conditioning Research.',
      'Three minutes between sets grew more than one minute.'],
    rest24: ['Singer et al. (2024)', 'Give it a rest: a Bayesian meta-analysis on the effect of inter-set rest interval duration on muscle hypertrophy. Frontiers in Sports and Active Living.',
      'Resting longer than about 60 seconds is slightly better for growth; past 90 seconds it hardly matters.'],
    rir16: ['Helms et al. (2016)', 'Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training. Strength and Conditioning Journal.',
      'Reps in reserve: how many more you could have done. Lifters guess it well near failure and badly far from it.'],
    rp21: ['Israetel, Hoffmann & Smith (2021)', 'Scientific Principles of Hypertrophy Training. Renaissance Periodization.',
      'The volume landmarks (MEV, MRV) and the feedback-driven set progression. Practitioner guidance, not a trial.'],
    deload24: ['Coleman et al. (2024)', 'Gaining more from doing less? The effects of a one-week deload period during supervised resistance training on muscular adaptations. PeerJ.',
      'A week off mid-program did not change muscle growth. Deloads are about fatigue and joints, not about growing more.'],
    bickel11: ['Bickel, Cross & Bamman (2011)', 'Exercise dosing to retain resistance training adaptations in young and older adults. Medicine & Science in Sports & Exercise.',
      'After sixteen weeks of training, one session a week kept strength and size for eight months: younger lifters on a ninth of the sets, older lifters needing about a third to keep their muscle.'],
    spiering21: ['Spiering et al. (2021)', 'Maintaining physical performance: the minimal dose of exercise needed to preserve endurance and strength over time. Journal of Strength and Conditioning Research.',
      'Strength and muscle can be kept on as little as one session a week and a set or so per exercise, provided the load stays heavy; older adults need about two sessions.'],
    iversen21: ['Iversen et al. (2021)', 'No time to lift? Designing time-efficient training programs for strength and hypertrophy: a narrative review. Sports Medicine.',
      'For short sessions: favour lifts that train several muscles, pair exercises for different muscles, and keep weekly sets modest \u2014 about four hard sets a muscle a week still builds strength.'],
    who20: ['Bull et al. (2020)', 'World Health Organization 2020 guidelines on physical activity and sedentary behaviour. British Journal of Sports Medicine.',
      'Adults: 150\u2013300 minutes a week of moderate activity, or 75\u2013150 vigorous, plus muscle strengthening on two or more days.'],
    compendium11: ['Ainsworth et al. (2011)', 'Compendium of Physical Activities: a second update of codes and MET values. Medicine & Science in Sports & Exercise.',
      'Golf walking with clubs is about 4\u20135 METs, in a cart about 3.5; 3 to 6 METs counts as moderate.'],
    hayden21: ['Hayden et al. (2021)', 'Exercise therapy for chronic low back pain. Cochrane Database of Systematic Reviews.',
      'Exercise probably reduces pain in long-running low back pain compared with no treatment; no one kind of exercise stands out.'],
    long04: ['Long, Donelson & Fung (2004)', 'Does it matter which exercise? A randomized control trial of exercise for low back pain. Spine.',
      'People whose back pain eased in one direction of movement did better with exercise matched to it \u2014 the idea behind steering clear of what sets yours off.'],
    epley: ['Epley (1985)', 'Poundage chart. Boyd Epley Workout.',
      'Estimated one-rep max = weight × (1 + reps ÷ 30). Least trustworthy past about twelve reps.']
  };

  /* ---------------------------------------------------------------- storage
   *
   * Everything that travels lives in one object, T, with a stamp beside each
   * piece so two devices can agree on which copy is newer without asking a
   * server to referee:
   *
   *   pr   settings — units, bar, rest times, sound
   *   act  which block is running
   *   ms   blocks, keyed by id
   *   wo   finished workouts, keyed by id
   *   cx   exercises you made yourself, keyed by id
   *   ax   activity outside the gym — golf, walks — keyed by id
   *
   * The workout in progress is NOT in T. It belongs to the phone in your
   * hand at the gym, not to the account, and syncing half a set to a laptop
   * at home helps nobody. It is written on every keystroke, so a phone that
   * locks, dies or reloads mid-session comes back to the same set. */
  var LS_T = 'bsc.train', LS_TS = 'bsc.trainStamps', LS_LIVE = 'sh.trainLive', LS_SUB = 'sh.trainSub';

  function defaultsPr(p) {
    p = plain(p) ? p : {};
    var u = p.u === 'kg' ? 'kg' : 'lb';
    return {
      u: u,
      bar: fin(p.bar) && p.bar >= 0 ? p.bar : (u === 'kg' ? 20 : 45),
      // Compound and isolation rest. Three minutes on the big lifts is where
      // Schoenfeld et al. (2016) saw the difference; ninety seconds is past
      // the point Singer et al. (2024) found it stops mattering.
      rc: fin(p.rc) && p.rc > 0 ? p.rc : 180,
      ri: fin(p.ri) && p.ri > 0 ? p.ri : 90,
      /* Between the two halves of a pair. A minute each way leaves each
         muscle about two and three-quarter minutes between its own sets,
         which is the whole trick of pairing. */
      rp: fin(p.rp) && p.rp > 0 ? p.rp : 60,
      snd: p.snd === 0 ? 0 : 1,
      // what you train for: grow the muscle, or keep the strength you have
      goal: p.goal === 'keep' ? 'keep' : 'grow',
      // minutes a session may take, warm-up included; 0 is no limit
      min: [30, 40, 45, 60, 75].indexOf(p.min) >= 0 ? p.min : 0,
      // what sets your back off, as the letters BACK uses; '' is not protecting it
      bk: typeof p.bk === 'string' ? p.bk.replace(/[^fcx]/g, '').slice(0, 3) : '',
      // what you do outside the gym
      hab: Array.isArray(p.hab) ? p.hab.filter(function (h) { return !!HABITS[h]; }) : [],
      // exercises you never want suggested again
      avoid: Array.isArray(p.avoid) ? p.avoid.filter(function (e) { return typeof e === 'string'; }).slice(0, 200) : []
    };
  }

  /* Activity outside the gym, and what it counts as. Golf is moderate
     exercise by the Compendium's numbers either way — about 4–5 METs on foot,
     3.5 in a cart, where moderate starts at 3 — so both count toward the
     weekly target minute for minute. */
  var HABITS = {
    golfw: { n: 'Golf, walking', btn: 'Golf (walked)', min: 240 },
    golfc: { n: 'Golf, cart', btn: 'Golf (cart)', min: 240 },
    walk: { n: 'Walk', btn: 'Walk', min: 30 },
    other: { n: 'Other cardio', btn: 'Cardio', min: 30 }
  };
  function blankT() { return { pr: defaultsPr(null), act: '', ms: {}, wo: {}, cx: {}, ax: {} }; }
  function blankTS() { return { pr: 0, act: 0, ms: {}, wo: {}, cx: {}, ax: {} }; }
  var PARTS = ['ms', 'wo', 'cx', 'ax'];

  function loadT() {
    var t = readLS(LS_T), out = blankT();
    if (plain(t)) {
      out.pr = defaultsPr(t.pr);
      out.act = typeof t.act === 'string' ? t.act : '';
      PARTS.forEach(function (p) {
        if (!plain(t[p])) return;
        Object.keys(t[p]).forEach(function (k) {
          if (t[p][k] && SHAPE[p](t[p][k])) out[p][k] = t[p][k];
        });
      });
    }
    return out;
  }
  function loadTS() {
    var s = readLS(LS_TS), out = blankTS();
    if (!plain(s)) return out;
    out.pr = fin(s.pr) ? s.pr : 0;
    out.act = fin(s.act) ? s.act : 0;
    PARTS.forEach(function (p) { if (plain(s[p])) out[p] = s[p]; });
    return out;
  }

  /* What a value from another device has to look like before it is let in.
     A wrong-shaped one is ignored as if it never came; the next push from a
     device that has it right corrects the record. */
  var SHAPE = {
    /* Bounded as well as shaped. Everything downstream loops over weeks,
       days and sets, so a block claiming a million weeks or a slot of a
       million sets — a corrupt record, an old build's bug — would hang the
       phone that drew it rather than merely look wrong. */
    ms: function (v) {
      return plain(v) && Array.isArray(v.days) && v.days.length > 0 && v.days.length <= 7 &&
        fin(v.acc) && v.acc >= 1 && v.acc <= 12 &&
        v.days.every(function (d) {
          return plain(d) && Array.isArray(d.s) && d.s.length <= 20 && d.s.every(function (s) {
            return plain(s) && typeof s.e === 'string' && fin(s.n) && s.n >= 1 && s.n <= 10;
          });
        });
    },
    wo: function (v) {
      return plain(v) && fin(v.st) && Array.isArray(v.x) && v.x.every(function (x) {
        return plain(x) && typeof x.e === 'string' && Array.isArray(x.s) && x.s.every(function (s) {
          return plain(s) && fin(s.w) && fin(s.r);
        });
      });
    },
    cx: function (v) { return plain(v) && typeof v.n === 'string' && !!MUS[v.m]; },
    ax: function (v) {
      return plain(v) && fin(v.st) && !!HABITS[v.k] && fin(v.min) && v.min > 0 && v.min <= 720;
    }
  };

  var T = loadT();
  var TS = loadTS();
  var REV = 0;                           // bumped on every change; the index below keys on it

  function saveT() {
    REV++;
    writeLS(LS_T, T);
    writeLS(LS_TS, TS);
  }

  /* A change, recorded. The stamp is what makes it win on the other device;
     the dirty mark is what makes it the only thing sent. */
  function stamp(part, key) {
    var now = Date.now();
    if (key === undefined) {
      TS[part] = now;
      dirty[part] = true;
    } else {
      TS[part][key] = now;
      if (dirty[part] !== true) { dirty[part] = dirty[part] || {}; dirty[part][key] = 1; }
    }
    saveT();
    push();
  }

  /* ------------------------------------------------------------------ sync
   *
   * The same bargain My Day strikes (see mSyncPayload in app.js), in
   * miniature: newest wins, key by key; a deletion travels as a null with a
   * stamp, because an absent key cannot say "gone"; after the first push of
   * a session only what moved is sent.
   *
   * One difference, on purpose. The first push waits for the server's own
   * answer to have been merged. set(merge:true) does not compare stamps — it
   * writes what it is given — so a device that had been asleep for a week
   * and pushed before it listened would put its week-old copy of a workout
   * back over the one you edited yesterday, on the server, where the other
   * phone's stamps could no longer save it. Listening first means the whole
   * push carries the newer copy of everything. */
  var doc = null, dirty = {}, dirtyAll = true, pushTimer = null, heard = false;

  function attach(d) {
    doc = d || null;
    heard = false;
    dirtyAll = true;
    clearTimeout(pushTimer);
  }

  function payload(whole) {
    var out = {}, any = false;
    ['pr', 'act'].forEach(function (p) {
      if (!whole && !dirty[p]) return;
      out[p] = { v: T[p], at: TS[p] || 0 };
      any = true;
    });
    PARTS.forEach(function (p) {
      var keys = {};
      if (whole || dirty[p] === true) {
        Object.keys(T[p]).forEach(function (k) { keys[k] = 1; });
        Object.keys(TS[p]).forEach(function (k) { keys[k] = 1; });
      } else if (dirty[p]) {
        Object.keys(dirty[p]).forEach(function (k) { keys[k] = 1; });
      }
      var map = {};
      Object.keys(keys).forEach(function (k) {
        map[k] = { v: T[p][k] || null, at: TS[p][k] || 0 };
      });
      if (Object.keys(map).length) { out[p] = map; any = true; }
    });
    return any ? clean(out) : null;
  }

  function take() {
    var body = payload(dirtyAll);
    dirtyAll = false;
    dirty = {};
    return body;
  }

  function push(now) {
    if (!doc || !heard) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      if (!doc) return;
      var body = take();
      if (!body) return;
      doc.set({ train: body }, { merge: true }).catch(function () {
        // a write that never landed leaves no way to say what the far end
        // is missing, so the next one says everything
        dirtyAll = true;
      });
    }, now ? 0 : 900);
  }

  /* Newest wins, piece by piece. True when anything here changed. */
  function merge(tr) {
    if (!plain(tr)) return false;
    var moved = false;
    if (plain(tr.pr) && fin(tr.pr.at) && tr.pr.at > (TS.pr || 0) && plain(tr.pr.v)) {
      T.pr = defaultsPr(tr.pr.v); TS.pr = tr.pr.at; moved = true;
    }
    if (plain(tr.act) && fin(tr.act.at) && tr.act.at > (TS.act || 0) && typeof tr.act.v === 'string') {
      T.act = tr.act.v; TS.act = tr.act.at; moved = true;
    }
    PARTS.forEach(function (p) {
      var from = plain(tr[p]) ? tr[p] : {};
      Object.keys(from).forEach(function (k) {
        var r = from[k];
        if (!plain(r) || !fin(r.at) || !(r.at > (TS[p][k] || 0))) return;
        if (r.v !== null && !SHAPE[p](r.v)) return;
        if (r.v === null) delete T[p][k]; else T[p][k] = r.v;
        TS[p][k] = r.at;
        moved = true;
      });
    });
    if (moved) saveT();
    return moved;
  }

  /* What the account says, handed over by app.js's listener. `live` is
     false for an answer served from this device's own cache. */
  function remote(tr, live) {
    var moved = tr ? merge(tr) : false;
    if (live && !heard && doc) {
      heard = true;
      dirtyAll = true;
      push(true);
    }
    if (moved) drawIfShowing();
  }

  /* Everything of yours, gone from this device: sign-out, account deletion,
     or somebody else signing in here. The same moments My Day forgets its
     own, and for the same reason — the next push would otherwise carry this
     person's training into the next person's account. */
  function forget() {
    T = blankT();
    TS = blankTS();
    dirty = {};
    dirtyAll = true;
    clearTimeout(pushTimer);
    [LS_T, LS_TS, LS_LIVE].forEach(function (k) { writeLS(k, null); });
    LIVE = null;
    REV++;
    stopWake();
    drawIfShowing();
  }

  /* --------------------------------------------------------------- lookups */
  function lib(id) {
    if (LIB[id]) return LIB[id];
    var c = T.cx[id];
    if (c) {
      var k = c.k === 'c' ? 'c' : 'i';
      return { id: id, n: c.n, m: c.m, k: k, q: EQUIP[c.q] ? c.q : 'mc', p: '',
        rr: k === 'c' ? [8, 12] : [10, 15], own: true, o: 1e4 };
    }
    return { id: id, n: 'Unknown exercise', m: 'chest', k: 'i', q: 'mc', p: '', rr: [8, 12], o: 1e5 };
  }
  function musOf(id) { return lib(id).m; }
  function allEx() {
    return LIB_LIST.concat(Object.keys(T.cx).map(lib));
  }

  var LIVE = readLS(LS_LIVE);
  if (!plain(LIVE) || !Array.isArray(LIVE.x)) LIVE = null;
  function setLive(v) { LIVE = v; writeLS(LS_LIVE, v); }
  function saveLive() { writeLS(LS_LIVE, LIVE); }

  /* The workouts, sorted and indexed once per change rather than walked on
     every lookup — the block view asks the same questions dozens of times a
     draw. */
  var IX = null;
  function ix() {
    if (IX && IX.rev === REV) return IX;
    var list = Object.keys(T.wo).map(function (k) { return T.wo[k]; })
      .filter(function (w) { return w && fin(w.st); })
      .sort(function (a, b) { return a.st - b.st; });
    var slot = {};
    list.forEach(function (w) {
      if (w.ms) slot[w.ms + ':' + w.w + ':' + w.d] = w;       // the latest wins
    });
    /* Records in the same pass. Walked in time order, so a record is a set
       that beat everything BEFORE it — and the first time you do a lift is
       not a record, because there was nothing to beat. That keeps the star
       meaning something. */
    var best = {}, prs = {};
    list.forEach(function (wo) {
      var out = [];
      var before = {};
      wo.x.forEach(function (x) { if (!before[x.e]) before[x.e] = best[x.e] || null; });
      wo.x.forEach(function (x) {
        var had = before[x.e];
        var now = best[x.e] || { e1: 0, w: 0, r: 0, vol: 0 };
        var hit = had ? beats(had, x.s, wo.u) : '';
        x.s.forEach(function (s) {
          var w = conv(s.w, wo.u);
          now.e1 = Math.max(now.e1, e1rm(w, s.r));
          now.w = Math.max(now.w, w);
          now.r = Math.max(now.r, s.r);
          now.vol = Math.max(now.vol, w * s.r);
        });
        best[x.e] = now;
        if (hit) out.push({ e: x.e, what: hit });
      });
      prs[wo.id] = out;
    });
    IX = { rev: REV, list: list, slot: slot, best: best, prs: prs };
    return IX;
  }
  function woFor(ms, w, d) { return ix().slot[ms.id + ':' + w + ':' + d] || null; }
  function exIn(wo, e) {
    for (var i = 0; i < wo.x.length; i++) if (wo.x[i].e === e) return wo.x[i];
    return null;
  }

  /* ------------------------------------------------------------- the maths */

  /* Weights are stored in the unit they were lifted in and shown in the one
     you read in now, so switching to kilograms does not rewrite a year of
     history in pounds. */
  function conv(w, from) {
    var to = T.pr.u;
    if (!fin(w) || from === to || (from !== 'kg' && from !== 'lb')) return w;
    var v = from === 'kg' ? w * 2.20462 : w / 2.20462;
    return Math.round(v * 2) / 2;
  }
  function inc(ex) {
    if (T.pr.u === 'kg') return ex.q === 'db' ? 2 : 2.5;
    return 5;
  }
  function roundTo(w, step) { return Math.round(w / step) * step; }
  function fmtN(v) {
    if (!fin(v)) return '';
    var r = Math.round(v * 10) / 10;
    return String(r % 1 ? r.toFixed(1) : r);
  }
  function fmtBig(v) { return Math.round(v).toLocaleString('en-US'); }

  /* Epley. Reps only, not reps plus what you had left: the app does not see
     how close you went, and an estimate built on a guess about effort is two
     guesses. So this underestimates a set left well short of failure, the
     same way for every set, which is what a trend line needs. */
  function e1rm(w, r) {
    if (!fin(w) || !fin(r) || w <= 0 || r <= 0) return 0;
    return r === 1 ? w : w * (1 + r / 30);
  }
  function bestE1(sets, u) {
    var b = 0;
    sets.forEach(function (s) { var v = e1rm(conv(s.w, u), s.r); if (v > b) b = v; });
    return b;
  }
  function topSet(sets, u) {
    var t = null;
    sets.forEach(function (s) {
      var w = conv(s.w, u);
      if (!t || w > t.w || (w === t.w && s.r > t.r)) t = { w: w, r: s.r };
    });
    return t;
  }

  /* Reps in reserve for a week of the block. Three at the start, none at the
     end, evenly between: the ramp RP runs, and the region Robinson et al.
     (2024) found most of the growth in. Heavy barbell and Smith lifts stop
     at one — Refalo et al. (2023) saw nothing gained by the last rep, and
     the last rep of a heavy squat is the one that goes wrong. */
  function isKeep(ms) { return !!ms && ms.goal === 'keep'; }
  /* A block to keep strength has no deload week — nothing accumulates at a
     maintenance dose — so its weeks are all working weeks. */
  function accOf(ms) {
    if (isKeep(ms)) return ms.acc;
    return fin(ms.dlw) ? Math.min(ms.acc, ms.dlw) : ms.acc;
  }
  function weeksOf(ms) { return isKeep(ms) ? ms.acc : accOf(ms) + 1; }
  /* Keeping holds effort steady at about two reps short on the big lifts and
     one on the small ones: heavy enough that strength has a reason to stay,
     far enough from failure that it never costs a round of golf. */
  function rirFor(ms, w) {
    var n = accOf(ms);
    if (w >= n) return null;
    if (isKeep(ms)) return 2;
    if (n <= 1) return 2;
    return Math.round(3 * (1 - w / (n - 1)));
  }
  function exRir(ex, rir, keep) {
    if (rir === null) return null;
    if (keep && ex.k !== 'c') return Math.max(0, rir - 1);
    return ex.k === 'c' && (ex.q === 'bb' || ex.q === 'sm') ? Math.max(1, rir) : rir;
  }
  function restFor(ex) { return ex.k === 'c' ? T.pr.rc : T.pr.ri; }

  /* The last time this exercise was done properly: not in a deload, where
     the weights are light on purpose and would drag next week's down. */
  function lastPerf(e, before) {
    var list = ix().list;
    for (var i = list.length - 1; i >= 0; i--) {
      var w = list[i];
      if (before && w.st >= before) continue;
      if (w.dl) continue;
      var x = exIn(w, e);
      if (x && x.s.length) return { s: x.s, u: w.u, st: w.st };
    }
    return null;
  }

  /* What to lift next time, by the rule every logbook app runs: double
     progression. Reached the top of the range on your best set? Add the
     smallest jump the kit allows and expect about two fewer reps — each rep
     is worth roughly three per cent of a max by Epley, and a jump is about
     five. Didn't? Same weight, one more rep, which is what dropping one rep
     in reserve a week asks of you anyway. */
  function target(ex, ms, w, d, dl) {
    var src = null;
    if (ms && w > 0) {
      var pw = woFor(ms, w - 1, d);
      var px = pw && !pw.dl && exIn(pw, ex.id);
      if (px && px.s.length) src = { s: px.s, u: pw.u };
    }
    if (!src) src = lastPerf(ex.id);
    if (!src) return { tw: null, tr: null, prev: [] };
    var prev = src.s.map(function (s) { return { w: conv(s.w, src.u), r: s.r }; });
    var top = topSet(src.s, src.u);
    var step = inc(ex);
    if (dl) {
      /* Half the sets, and the weights of week one — RP's deload is less of
         everything, not nothing, so the groove is kept while the fatigue
         drains. */
      var first = ms && woFor(ms, 0, d);
      var fx = first && exIn(first, ex.id);
      var ft = fx && fx.s.length ? topSet(fx.s, first.u) : null;
      var fw = ft ? ft.w : top.w * 0.9;
      return { tw: fw > 0 ? roundTo(fw, step) : top.w, tr: ex.rr[0], prev: prev };
    }
    if (ex.q === 'bw' && !(top.w > 0)) return { tw: 0, tr: top.r + 1, prev: prev };
    if (top.r >= ex.rr[1]) {
      return { tw: roundTo(top.w + step, step), tr: Math.max(ex.rr[0], top.r - 2), prev: prev };
    }
    return { tw: top.w, tr: Math.min(ex.rr[1], top.r + 1), prev: prev };
  }

  /* How sore that muscle got after the session, as reported at the next
     session that trained it. RP asks before you train, about last time, and
     so does this. */
  function soreAfter(wo, m) {
    var list = ix().list;
    for (var i = 0; i < list.length; i++) {
      var w = list[i];
      if (w.st <= wo.st || w.st - wo.st > 14 * DAY_MS) continue;
      var v = w.sr && w.sr[m];
      if (fin(v)) return v;
    }
    return undefined;
  }

  /* Whether the muscle got WEAKER on the same exercises week over week. With
     one rep less in reserve every week, a muscle recovering from its sets
     should be doing a little more each time. Doing three per cent less is the
     plainest sign on offer that the sets have run ahead of recovery. */
  function regressed(ms, w, d, m) {
    if (w < 1) return false;
    var a = woFor(ms, w - 1, d), b = woFor(ms, w, d);
    if (!a || !b) return false;
    return b.x.some(function (x) {
      if (musOf(x.e) !== m) return false;
      var p = exIn(a, x.e);
      if (!p) return false;
      var ea = bestE1(p.s, a.u), eb = bestE1(x.s, b.u);
      return ea > 0 && eb < ea * 0.97;
    });
  }

  /* RP's set progression, written as a sum rather than a feeling.
   *
   * Three answers, each worth +1, 0 or less: recovered early is +1, a low
   * pump is +1, an easy session is +1; the other end of each is −1 (or −2
   * for "too much"). The total says how many sets to add next week:
   *
   *     2 or more   +2      the muscle is asking for more
   *     0 or 1      +1      the standard step up
   *     −1          hold
   *     −2 or less  −1      you are past what you recover from
   *
   * And four hard stops that no amount of pump overrides: still sore going
   * in, joints that hurt a lot, or measurably weaker than last week all hold
   * the sets where they are; a workload of "too much" takes one away.
   *
   * No answers at all is a total of zero: one more set, the default step. */
  function feedback(ms, w, d, m) {
    var wo = woFor(ms, w, d);
    if (!wo) return { d: 0, why: 'Held — last week’s session was not logged.' };
    var fb = (wo.fb && wo.fb[m]) || {};
    var sr = soreAfter(wo, m);
    var score = 0, said = [];
    if (fin(sr) && SORE_V[sr] !== undefined) { score += SORE_V[sr]; said.push(SORE_W[sr]); }
    if (fin(fb.p) && PUMP_V[fb.p] !== undefined) { score += PUMP_V[fb.p]; said.push(PUMP_W[fb.p]); }
    if (fin(fb.k) && WORK_V[fb.k] !== undefined) { score += WORK_V[fb.k]; said.push(WORK_W[fb.k]); }
    var dl = score >= 2 ? 2 : score >= 0 ? 1 : score === -1 ? 0 : -1;
    var stop = '';
    if (fb.k === 3) dl = -1;
    else if (sr === 2 && dl > 0) dl = 0;
    if (fb.j === 2 && dl > 0) { dl = 0; stop = 'joints hurt'; }
    if (dl > 0 && regressed(ms, w, d, m)) { dl = 0; stop = 'you were weaker than the week before'; }
    return {
      d: dl,
      body: (said.length ? said.join(', ') : 'no feedback given, so the standard step') +
        (stop ? '; held because ' + stop : '')
    };
  }

  function whyHead(dl) {
    return dl > 0 ? '+' + dl + ' set' + (dl > 1 ? 's' : '') : dl < 0 ? '\u2212' + (-dl) + ' set' : 'Held';
  }

  /* Keeping: the sets stay where they are. Two things move them. A session
     that was too much, or hurt, takes one away. Strength sliding two weeks
     running adds one back — at a maintenance dose there is little room
     below it, and Spiering et al. (2021) put the answer to lost strength in
     more work or heavier work, not less. */
  function keepFeedback(ms, w, d, m) {
    var wo = woFor(ms, w, d);
    if (!wo) return { d: 0, body: '' };
    var fb = (wo.fb && wo.fb[m]) || {};
    if (fb.k === 3) return { d: -1, body: 'last week\u2019s workload was too much' };
    if (fb.j === 2) return { d: -1, body: T.pr.bk ? 'your back or joints hurt last week' : 'your joints hurt last week' };
    if (w >= 1 && regressed(ms, w, d, m) && regressed(ms, w - 1, d, m)) {
      return { d: 1, body: 'strength slipped two weeks running' };
    }
    return { d: 0, body: '' };
  }

  /* Add or take sets one at a time: added to the exercise with the fewest,
     taken from the one with the most. Six on one exercise is a ceiling —
     past that it is a new exercise's job. */
  function spread(arr, idxs, dl) {
    var guard = 20;
    while (dl > 0 && guard--) {
      var lo = null;
      idxs.forEach(function (i) { if (arr[i] < 6 && (lo === null || arr[i] < arr[lo])) lo = i; });
      if (lo === null) break;
      arr[lo]++; dl--;
    }
    while (dl < 0 && guard--) {
      var hi = null;
      idxs.forEach(function (i) { if (arr[i] > 1 && (hi === null || arr[i] > arr[hi])) hi = i; });
      if (hi === null) break;
      arr[hi]--; dl++;
    }
  }

  function totals(ms, sets) {
    var t = {};
    ms.days.forEach(function (day, d) {
      day.s.forEach(function (s, i) { var m = musOf(s.e); t[m] = (t[m] || 0) + sets[d][i]; });
    });
    return t;
  }

  /* Every slot's sets for week W, walked forward from week one so that each
     week is last week plus what last week's feedback said. Nothing about
     the progression is stored: it is a function of what was logged, so
     editing or deleting a workout moves the plan with it. */
  function setsFor(ms, W) {
    var keep = isKeep(ms);
    var cur = ms.days.map(function (d) { return d.s.map(function (s) { return Math.max(1, s.n); }); });
    var why = ms.days.map(function (d) { return d.s.map(function () { return keep ? '' : 'Week one: RP\u2019s starting volume.'; }); });
    if (!keep && W >= accOf(ms)) {
      return {
        sets: cur.map(function (a) { return a.map(function (n) { return Math.max(1, Math.ceil(n / 2)); }); }),
        why: cur.map(function (a) { return a.map(function () {
          return 'Deload — half of week one’s sets at week one’s weights, well short of failure.';
        }); })
      };
    }
    for (var w = 1; w <= W; w++) {
      var tot = totals(ms, cur);
      var next = cur.map(function (a) { return a.slice(); });
      var wy = cur.map(function (a) { return a.map(function () { return ''; }); });
      /* eslint-disable no-loop-func */
      ms.days.forEach(function (day, d) {
        var by = {};
        day.s.forEach(function (s, i) { var m = musOf(s.e); (by[m] = by[m] || []).push(i); });
        Object.keys(by).forEach(function (m) {
          var f = keep ? keepFeedback(ms, w - 1, d, m) : feedback(ms, w - 1, d, m);
          var dl = f.d, extra = '';
          var roof = MUS[m].mrv;
          if (!keep && dl > 0 && tot[m] + dl > roof) {
            dl = Math.max(0, roof - tot[m]);
            extra += ' Capped at ' + roof + ' sets a week, RP\u2019s MRV for ' + MUS[m].n.toLowerCase() + '.';
          }
          /* And never past the minutes you said a session could take: a set
             that would not fit is a set that would not get done. */
          if (dl > 0 && ms.min) {
            var fits = dl;
            while (fits > 0) {
              var trial = next[d].slice();
              spread(trial, by[m], fits);
              if (estDay(day, trial) <= ms.min) break;
              fits--;
            }
            if (fits < dl) extra += ' Held to fit your ' + ms.min + '-minute session.';
            dl = fits;
          }
          spread(next[d], by[m], dl);
          tot[m] += dl;
          var said = f.body ? whyHead(dl) + ' \u2014 ' + f.body + '.' + extra : extra.trim();
          by[m].forEach(function (i) { wy[d][i] = said; });
        });
      });
      cur = next;
      why = wy;
    }
    return { sets: cur, why: why };
  }

  /* One session of the block, as it should be done: exercises, sets, reps in
     reserve, and the weight and reps to aim for. */
  function plan(ms, w, d) {
    var dl = w >= accOf(ms);
    var sf = setsFor(ms, Math.min(w, accOf(ms)));
    var rir = rirFor(ms, w);
    var day = ms.days[d];
    return {
      w: w, d: d, n: day.n, deload: dl, rir: rir,
      x: day.s.map(function (s, i) {
        var ex = lib(s.e);
        var t = target(ex, ms, w, d, dl);
        return { e: s.e, sets: sf.sets[d][i], rr: ex.rr, rest: restFor(ex), rir: exRir(ex, rir, isKeep(ms)),
          tw: t.tw, tr: t.tr, prev: t.prev, why: sf.why[d][i], p: s.p || 0 };
      })
    };
  }

  /* The next session of the block that has neither been logged nor skipped. */
  function nextSlot(ms) {
    var sk = Array.isArray(ms.sk) ? ms.sk : [];
    for (var w = 0; w < weeksOf(ms); w++) {
      for (var d = 0; d < ms.days.length; d++) {
        if (!woFor(ms, w, d) && sk.indexOf(w + ':' + d) < 0) return { w: w, d: d };
      }
    }
    return null;
  }

  /* ------------------------------------------------------------ generator */

  /* The exercise a slot gets: right muscle, kit you own, the kind and
     pattern asked for if possible, and not one this block already uses if
     there is any other choice. Library order is preference order, so the
     plain version of each lift comes first. */
  /* Whether an exercise is out, for this back and this avoid list. A capital
     in any of your triggers keeps it out; so does your saying never. */
  function barred(ex, pf) {
    if (!pf) return false;
    if (pf.avoid && pf.avoid.indexOf(ex.id) >= 0) return true;
    var bk = pf.bk || '';
    for (var i = 0; i < bk.length; i++) if (ex.bk.indexOf(bk[i].toUpperCase()) >= 0) return true;
    return false;
  }
  /* How much it asks of this back, as a ranking penalty. Some of a trigger
     costs a lot; any other load costs a little, so that with protection on
     the version that asks nothing of the back wins a tie — a seated press
     over a standing one, a chest-supported row over a bent-over one. */
  function backCost(ex, pf) {
    var bk = pf && pf.bk;
    if (!bk || !ex.bk) return 0;
    var c = 0;
    for (var i = 0; i < ex.bk.length; i++) {
      var ch = ex.bk[i], low = ch.toLowerCase();
      if (bk.indexOf(low) >= 0) c += 20;
      else c += ch === low ? 3 : 6;
    }
    return c;
  }
  /* The cue a moderately loading exercise carries for your back, if any. */
  function backCue(ex) {
    var bk = T.pr.bk;
    if (!bk || !ex.bk) return '';
    for (var i = 0; i < bk.length; i++) if (ex.bk.indexOf(bk[i]) >= 0) return BACK_CUE[bk[i]];
    return '';
  }

  function pickEx(m, k, p, eq, used, seed, pf) {
    var cand = allEx().filter(function (ex) { return ex.m === m && eq.indexOf(ex.q) >= 0 && !barred(ex, pf); });
    if (!cand.length) return null;
    var score = function (ex) {
      return (ex.k === k ? 0 : 100) + (p && ex.p !== p ? 10 : 0) + backCost(ex, pf) + ex.o / 1000;
    };
    cand.sort(function (a, b) { return score(a) - score(b); });
    var fresh = cand.filter(function (ex) { return !used[ex.id]; });
    var pool = fresh.length ? fresh : cand;
    var best = score(pool[0]);
    var tier = pool.filter(function (ex) { return Math.floor(score(ex)) === Math.floor(best); });
    return tier[(seed || 0) % tier.length];
  }

  /* Keeping, not building.
   *
   * Strength that has been built takes far less to keep than it took to
   * build: in Bickel et al. (2011) one session a week at a fraction of the
   * sets held it for eight months, and Spiering et al. (2021) put the floor at
   * about one session and a set or so per exercise — provided the loads stay
   * heavy. Older lifters need a little more, which is why this is two or
   * three sessions rather than one.
   *
   * So: full body, every big movement each session, three sets (two when
   * there are three days), sets ending about two reps short of failure, and
   * no climb in volume and no deload — there is nothing accumulating to
   * recover from. The muscles are paired so that one rests while the other
   * works (the "+" joins a slot to the one after it); that is what fits a
   * whole body into forty minutes without cutting the rest either muscle
   * gets. Squat, hinge-free hip work, a push and a pull, and a core slot that
   * trains the trunk to resist movement rather than to bend. */
  var KEEP_SPLITS = {
    2: { n: 'Keep strength', days: [
      ['Strength A', ['quads/c/squat+', 'back/c/horiz', 'chest/c/flat+', 'hams/i/curl', 'front/c/press+', 'abs/i']],
      ['Strength B', ['glutes/c/thrust+', 'back/c/vert', 'quads/c/single+', 'chest/c/incline', 'side/i+', 'abs/i']]
    ] },
    3: { n: 'Keep strength', days: [
      ['Strength A', ['quads/c/squat+', 'back/c/horiz', 'chest/c/flat+', 'hams/i/curl', 'side/i+', 'abs/i']],
      ['Strength B', ['glutes/c/thrust+', 'back/c/vert', 'chest/c/incline+', 'quads/i', 'biceps/i+', 'triceps/i']],
      ['Strength C', ['quads/c/single+', 'back/c/horiz', 'front/c/press+', 'hams/i/curl', 'rear/i+', 'abs/i']]
    ] }
  };

  /* ------------------------------------------------------------- the clock
   *
   * How long a session takes, estimated rather than promised: three quarters
   * of a minute a set, the rest the settings give it between straight sets,
   * the paired rest between the halves of a pair, a minute to move between
   * exercises, five to warm up. Close enough to plan a lunch hour around. */
  function estDay(day, sets) {
    var t = 5, groups = {};
    var straight = function (sl, n) { return n * 0.75 + Math.max(0, n - 1) * restFor(lib(sl.e)) / 60 + 1; };
    day.s.forEach(function (sl, i) {
      var n = sets ? sets[i] : sl.n;
      if (sl.p) { (groups[sl.p] = groups[sl.p] || []).push({ sl: sl, n: n }); return; }
      t += straight(sl, n);
    });
    Object.keys(groups).forEach(function (g) {
      var list = groups[g];
      // a pair that has lost its other half is a straight set again
      if (list.length < 2) { t += straight(list[0].sl, list[0].n); return; }
      var tot = list.reduce(function (a, b) { return a + b.n; }, 0);
      t += tot * 0.75 + Math.max(0, tot - 1) * T.pr.rp / 60 + 1;
    });
    return Math.round(t);
  }

  var REGION = { quads: 'l', hams: 'l', glutes: 'l', calves: 'l', chest: 'u', front: 'u', side: 'u',
    triceps: 'u', back: 'p', rear: 'p', biceps: 'p', traps: 'p', abs: 'c' };

  /* Make a day fit the minutes you have, in the order that costs least:
     pair what is not paired yet (a push beside a pull, legs beside arms),
     then take isolation work to two sets, then the big lifts to two, then
     drop exercises from the end — the ones for a muscle you did not ask to
     bring up first — until it fits or three are left. */
  function fitDay(day, min, pri) {
    if (!min || estDay(day) <= min) return;
    var g = day.s.reduce(function (m, sl) { return Math.max(m, sl.p || 0); }, 0);
    day.s.forEach(function (a, i) {
      if (a.p) return;
      for (var j = i + 1; j < day.s.length; j++) {
        var b = day.s[j];
        if (b.p || REGION[musOf(a.e)] === REGION[musOf(b.e)]) continue;
        g++; a.p = g; b.p = g;
        var moved = day.s.splice(j, 1)[0];
        day.s.splice(i + 1, 0, moved);
        break;
      }
    });
    var trim = function (kind) {
      day.s.forEach(function (sl) {
        if (estDay(day) > min && lib(sl.e).k === kind && sl.n > 2) sl.n = 2;
      });
    };
    trim('i');
    trim('c');
    var guard = 20;
    while (estDay(day) > min && day.s.length > 3 && guard--) {
      var at = -1;
      for (var k = day.s.length - 1; k >= 0 && at < 0; k--) {
        if ((pri || []).indexOf(musOf(day.s[k].e)) < 0 && lib(day.s[k].e).k === 'i') at = k;
      }
      if (at < 0) at = day.s.length - 1;
      var gone = day.s.splice(at, 1)[0];
      if (gone.p) day.s.forEach(function (sl) { if (sl.p === gone.p) delete sl.p; });
    }
  }

  /* A block, from your answers.
   *
   * To grow: week one's sets per muscle start at RP's MEV, moved two for
   * experience and two more for a muscle you want to bring up, then spread
   * across the slots that muscle has. Never under two per exercise, because
   * one set a week is not enough for the feedback to mean anything. And never
   * so high that a set a week would carry it past MRV before the deload.
   *
   * To keep: the splits above, as they stand.
   *
   * Either way, then made to fit the minutes you have and kept clear of what
   * your back has said no to. */
  function build(o) {
    var keep = o.goal === 'keep';
    var split = keep ? KEEP_SPLITS[o.dpw >= 3 ? 3 : 2] : SPLITS[o.dpw] || SPLITS[4];
    var eq = (KITS[o.kit] || KITS.gym).eq;
    var pf = { bk: o.bk || '', avoid: o.avoid || [] };
    var used = {};
    var days = split.days.map(function (row) {
      var s = [], g = 0, open = false;
      row[1].forEach(function (tok) {
        var join = tok.charAt(tok.length - 1) === '+';
        var t = tok.replace(/\+$/, '').split('/');
        var ex = pickEx(t[0], t[1], t[2] || '', eq, used, o.seed || 0, pf);
        if (!ex) { open = false; return; }
        used[ex.id] = 1;
        var sl = { e: ex.id, n: 2 };
        if (open) { sl.p = g; open = false; }
        else if (join) { g++; sl.p = g; open = true; }
        s.push(sl);
      });
      // a pair whose other half found no exercise is not a pair
      s.forEach(function (sl) {
        if (sl.p && s.filter(function (x) { return x.p === sl.p; }).length < 2) delete sl.p;
      });
      return { n: row[0], s: s };
    });
    var acc;
    if (keep) {
      acc = [4, 6, 8, 10, 12].indexOf(o.acc) >= 0 ? o.acc : 8;
      days.forEach(function (day) { day.s.forEach(function (sl) { sl.n = o.dpw >= 3 ? 2 : 3; }); });
    } else {
      acc = Math.max(2, Math.min(6, o.acc || 4));
      var by = {};
      days.forEach(function (day) {
        day.s.forEach(function (sl) { var m = musOf(sl.e); (by[m] = by[m] || []).push(sl); });
      });
      var lvl = [-2, 0, 2][o.lvl] || 0;
      Object.keys(by).forEach(function (m) {
        var mu = MUS[m], list = by[m], n = list.length;
        var want = mu.mev + lvl + ((o.pri || []).indexOf(m) >= 0 ? 2 : 0);
        want = Math.min(want, mu.mrv - (acc - 1));
        want = Math.max(want, n * 2);
        var base = Math.floor(want / n), extra = want - base * n;
        list.forEach(function (sl, i) { sl.n = Math.min(5, base + (i < extra ? 1 : 0)); });
      });
    }
    var min = [30, 40, 45, 60, 75].indexOf(o.min) >= 0 ? o.min : 0;
    days.forEach(function (day) { fitDay(day, min, o.pri); });
    return {
      id: newId(), n: split.n + ' · ' + (keep ? Math.min(3, Math.max(2, o.dpw)) : o.dpw) + ' days' + (min ? ' · ' + min + ' min' : ''),
      at: Date.now(), goal: keep ? 'keep' : 'grow', min: min,
      acc: acc, lvl: o.lvl || 0, kit: o.kit || 'gym', dpw: keep ? Math.min(3, Math.max(2, o.dpw)) : o.dpw,
      pri: keep ? [] : (o.pri || []).slice(),
      seed: o.seed || 0, days: days, sk: []
    };
  }

  /* ---------------------------------------------------------------- records */
  function zeroRec() { return { e1: 0, w: 0, r: 0, vol: 0 }; }

  /* Everything logged for a lift, or everything before a moment — the second
     only for the workout still open, which is not in the index yet. */
  function records(e, upto) {
    if (!upto) return ix().best[e] || zeroRec();
    var best = zeroRec();
    ix().list.forEach(function (wo) {
      if (wo.st >= upto) return;
      var x = exIn(wo, e);
      if (!x) return;
      x.s.forEach(function (s) {
        var w = conv(s.w, wo.u);
        best.e1 = Math.max(best.e1, e1rm(w, s.r));
        best.w = Math.max(best.w, w);
        best.r = Math.max(best.r, s.r);
        best.vol = Math.max(best.vol, w * s.r);
      });
    });
    return best;
  }

  /* Which records these sets break, in words, or '' for none. Reps count as
     a record only on a bodyweight lift with nothing added — ten reps with
     half the weight is not a better set. */
  function beats(had, sets, u) {
    if (!(had.e1 > 0 || had.r > 0)) return '';
    var hit = { e1: false, w: false, r: false };
    sets.forEach(function (s) {
      var w = conv(fin(s.w) ? s.w : 0, u), r = fin(s.r) ? s.r : 0;
      if (had.e1 > 0 && e1rm(w, r) > had.e1 + 0.01) hit.e1 = true;
      if (had.w > 0 && w > had.w) hit.w = true;
      if (!(w > 0) && !(had.w > 0) && r > had.r) hit.r = true;
    });
    return [hit.w ? 'heaviest' : '', hit.e1 ? 'best e1RM' : '', hit.r ? 'most reps' : '']
      .filter(Boolean).join(', ');
  }

  /* Records set by a workout, against everything logged before it began. */
  function prsIn(wo) {
    var known = ix().prs[wo.id];
    if (known && T.wo[wo.id] === wo) return known;
    var out = [];
    wo.x.forEach(function (x) {
      var hit = beats(records(x.e, wo.st), x.s, wo.u);
      if (hit) out.push({ e: x.e, what: hit });
    });
    return out;
  }

  /* ---------------------------------------------------------------- review
   *
   * The formula. Inputs are what you logged; outputs are what your lifts did;
   * each rule is a line from the research and says which line. It does not
   * know your goals, your sleep or your joints, and it says so rather than
   * pretending. */
  /* Which week the review reads.
   *
   * In a block, the block's own week: the latest one with every session
   * logged or skipped, from its first session up to the next week's first,
   * so a workout done outside the block that week counts too. A rolling
   * seven days was the first answer, and it cut training weeks in half — on
   * a Monday-to-Saturday rota, a review read on a Tuesday lost Monday's
   * session and called chest neglected on a week it got eight sets. Deload
   * weeks are skipped: their volume is low on purpose.
   *
   * With no block, the last seven days, which is the only week there is. */
  function reviewWindow(now) {
    var list = ix().list;
    var ms = active();
    if (ms) {
      var sk = Array.isArray(ms.sk) ? ms.sk : [];
      var starts = {};
      list.forEach(function (w) {
        if (w.ms === ms.id && fin(w.w) && w.w >= 0 && w.w < accOf(ms) && !w.dl) {
          if (starts[w.w] === undefined || w.st < starts[w.w]) starts[w.w] = w.st;
        }
      });
      var weeks = Object.keys(starts).map(Number).sort(function (a, b) { return a - b; });
      if (weeks.length) {
        var done = weeks.filter(function (w) {
          return ms.days.every(function (_, d) { return woFor(ms, w, d) || sk.indexOf(w + ':' + d) >= 0; });
        });
        var pick = done.length ? done[done.length - 1] : weeks[weeks.length - 1];
        var from = starts[pick];
        var later = weeks.filter(function (w) { return w > pick; });
        var to = later.length ? starts[later[0]] : now + 1;
        return {
          wos: list.filter(function (w) { return w.st >= from && w.st < to && !w.dl; }),
          label: 'Week ' + (pick + 1) + ' of your block',
          partial: !done.length,
          pick: pick
        };
      }
    }
    var first = list[0];
    return {
      wos: list.filter(function (w) { return w.st >= now - 7 * DAY_MS && w.st <= now; }),
      label: 'The last seven days',
      partial: !!first && now - first.st < 6 * DAY_MS,
      age: first ? Math.max(1, Math.round((now - first.st) / DAY_MS)) : 0
    };
  }

  function review(now) {
    now = now || Date.now();
    var win = reviewWindow(now);
    var wos = win.wos;
    var mus = {};
    var reps = { n: 0, out: 0 };
    var rests = { c: [], i: [] }, restBy = {};
    wos.forEach(function (wo) {
      wo.x.forEach(function (x) {
        var ex = lib(x.e), m = ex.m;
        var r = mus[m] = mus[m] || { sets: 0, days: {} };
        r.sets += x.s.length;
        if (x.s.length) r.days[wo.dk || dayKey(new Date(wo.st))] = 1;
        x.s.forEach(function (s, i) {
          reps.n++;
          if (s.r < 5 || s.r > 30) reps.out++;
          if (i > 0 && fin(s.t) && fin(x.s[i - 1].t) && s.t && x.s[i - 1].t) {
            var gap = (s.t - x.s[i - 1].t) / 1000;
            // a set takes about forty seconds; what is left is the rest
            if (gap > 20 && gap < 900) {
              var rest = Math.max(0, gap - 40);
              rests[ex.k === 'c' ? 'c' : 'i'].push(rest);
              (restBy[x.e] = restBy[x.e] || []).push(rest);
            }
          }
        });
      });
    });

    var ms = active();
    var inBlock = {};
    if (ms) ms.days.forEach(function (d) { d.s.forEach(function (s) { inBlock[musOf(s.e)] = 1; }); });
    /* Graded against what you are training for. Keeping is judged by the
       keeping research, not by the growing research — six sets a week is a
       failing grade for growth and a comfortable one for maintenance. */
    var keep = ms ? isKeep(ms) : T.pr.goal === 'keep';

    var rows = MUSCLES.filter(function (m) { return mus[m.k] || inBlock[m.k]; }).map(function (m) {
      var r = mus[m.k] || { sets: 0, days: {} };
      var st = keep ? (r.sets < 3 ? 'low' : 'good')
        : r.sets < 5 ? 'low' : r.sets < 10 ? 'fair' : r.sets <= 20 ? 'good' : 'high';
      return { k: m.k, n: m.n, sets: r.sets, days: Object.keys(r.days).length, mev: m.mev, mrv: m.mrv, st: st };
    });

    var checks = [];
    if (!wos.length) {
      checks.push({ st: 'info', t: 'Nothing logged in the last seven days',
        b: 'The review reads the last week of finished workouts. Log one and this fills in.', refs: [] });
      var ac0 = activityCheck(now, 0);
      if (ac0) checks.push(ac0);
      return { rows: rows, checks: checks, n: 0, prog: progress(now), label: win.label, keep: keep };
    }

    /* A week that is not over cannot be graded as a week. Half of one, with
       the other sessions still to come, would call half the body neglected,
       which is a true count and a false verdict. */
    var young = win.partial;
    var notYet = win.pick !== undefined
      ? 'Week ' + (win.pick + 1) + ' of your block is not finished, so this is not a whole week yet.'
      : 'Your log is ' + (win.age === 1 ? 'a day' : win.age + ' days') + ' old, so this is not a whole week yet.';
    var low = rows.filter(function (r) { return r.sets > 0 && r.sets < 5; });
    var high = rows.filter(function (r) { return r.sets > 20; });
    var none = rows.filter(function (r) { return !r.sets; });
    var inRange = rows.filter(function (r) { return r.sets >= 10 && r.sets <= 20; });
    var thin = rows.filter(function (r) { return r.sets < 3; });
    if (keep) checks.push({
      st: young ? 'info' : thin.length ? 'look' : 'good',
      t: 'Enough to keep it?',
      b: young
        ? notYet + ' Keeping strength takes about three hard, heavy sets a muscle a week or more; read this again once a full week is in.'
        : thin.length
          ? names(thin) + (thin.length > 1 ? ' are' : ' is') + ' under three hard sets this week. Maintenance takes little, but not nothing: strength held on a fraction of the training that built it, not on none.'
          : 'Every muscle got three or more hard sets. Strength that has been built held for months on about a third of the training that built it \u2014 less for younger lifters, a little more for older \u2014 as long as the loads stayed heavy.',
      refs: ['bickel11', 'spiering21', 'iversen21']
    });
    else checks.push({
      st: young ? 'info' : low.length || none.length ? 'look' : 'good',
      t: 'Weekly sets per muscle',
      b: young
        ? notYet + ' Ten to twenty hard sets a muscle a week is where the evidence is strongest; read this again once a full week is in.'
        : (inRange.length ? inRange.length + ' of ' + rows.length + ' muscles are in the 10–20 hard sets a week the evidence favours. ' : '') +
        (low.length ? names(low) + (low.length > 1 ? ' are' : ' is') + ' under five, where growth was smallest. ' : '') +
        (none.length ? names(none) + ' had no direct sets this week. ' : '') +
        (high.length ? names(high) + (high.length > 1 ? ' are' : ' is') + ' over twenty — it can still pay, at a shrinking rate, if you are recovering. ' : '') +
        (!low.length && !none.length && !high.length && !inRange.length ? 'Every muscle is between five and ten: enough to grow, and more would likely grow more. ' : ''),
      refs: ['vol17', 'vol24', 'rp21']
    });

    var once = rows.filter(function (r) { return r.days === 1 && r.sets >= 6; });
    checks.push({
      st: young ? 'info' : once.length ? 'look' : 'good',
      t: 'How often each muscle is trained',
      b: young ? 'Needs a full week of log to say. Twice a week per muscle is the practical default; with sets equal, how you split them matters little.'
        : once.length
        ? names(once) + ' got ' + (once.length > 1 ? 'their' : 'its') + ' sets in a single day. With sets equal, frequency barely matters — but splitting them over two days keeps the later sets from being done tired.'
        : 'Every muscle with real volume was trained on at least two days, or has few enough sets that one day holds them.',
      refs: ['freq19', 'freq16']
    });

    var outPct = reps.n ? Math.round(100 * reps.out / reps.n) : 0;
    checks.push({
      st: outPct > 20 ? 'look' : 'good',
      t: 'Reps per set',
      b: outPct
        ? outPct + '% of sets fell outside 5–30 reps. Inside that band load barely matters to growth when the set ends close to failure; outside it the evidence is thinner.'
        : 'Every set landed between 5 and 30 reps, the band where load barely matters to growth.',
      refs: ['load17']
    });

    /* Judged lift by lift. One median across every compound lift let two
       minutes on the bench hide forty seconds on the rows, which is the lift
       being short-changed. */
    var mc = median(rests.c), mi = median(rests.i);
    var rushed = Object.keys(restBy).filter(function (e) {
      var a = restBy[e];
      return a.length >= 2 && median(a) < (lib(e).k === 'c' ? 60 : 45);
    });
    var rushedN = function (c) {
      return rushed.filter(function (e) { return (lib(e).k === 'c') === c; })
        .map(function (e) { return lib(e).n; }).join(', ');
    };
    var shortC = !!rushedN(true), shortI = !!rushedN(false);
    checks.push({
      st: !rests.c.length && !rests.i.length ? 'info' : shortC || shortI ? 'look' : 'good',
      t: 'Rest between sets',
      b: !rests.c.length && !rests.i.length
        ? 'Rest is measured from when you tick one set to when you tick the next. Tick sets as you finish them and this fills in.'
        : 'Typical rest: ' + (rests.c.length ? clock(mc) + ' on compound lifts' : '') +
          (rests.c.length && rests.i.length ? ', ' : '') + (rests.i.length ? clock(mi) + ' on isolation work' : '') + '. ' +
          (shortC ? 'Under a minute between sets on ' + rushedN(true) + ' costs a little growth — longer rest let people do more on the next set. ' : '') +
          (shortI ? 'Under 45 seconds on ' + rushedN(false) + ' is shorter than most studies tested. ' : '') +
          (!shortC && !shortI ? 'Long enough that the next set is not being cut short.' : ''),
      refs: ['rest16', 'rest24']
    });

    checks.push({
      st: 'info',
      t: 'How close to failure',
      b: keep
        ? 'Keeping asks for about two reps in reserve on the big lifts and one on the small ones. This app cannot see how close you went \u2014 only you can \u2014 so it does not grade it. What keeps strength is the load staying heavy; going to failure adds little but fatigue.'
        : 'The block asks for ' + (ms ? 'reps in reserve stepping from 3 to 0' : 'sets ending 0\u20133 reps short of failure') +
        '. This app cannot see how close you went \u2014 only you can \u2014 so it does not grade it. Growth improves the closer a set ends to failure, and the last rep or two add little but fatigue.',
      refs: keep ? ['spiering21', 'fail23', 'rir16'] : ['fail24', 'fail23', 'rir16']
    });

    var sore = {}, joints = [];
    wos.forEach(function (wo) {
      Object.keys(wo.sr || {}).forEach(function (m) { if (wo.sr[m] === 2) sore[m] = 1; });
      Object.keys(wo.fb || {}).forEach(function (m) { if (wo.fb[m] && wo.fb[m].j === 2) joints.push(m); });
    });
    var soreL = Object.keys(sore);
    if (soreL.length || joints.length) {
      checks.push({
        st: 'look',
        t: 'Recovery',
        b: (soreL.length ? 'Still sore going into a session: ' + soreL.map(mname).join(', ') + '. The block holds those sets rather than adding. ' : '') +
          (joints.length ? (T.pr.bk ? 'Back or joints' : 'Joints') + ' hurt a lot on ' + uniq(joints).map(mname).join(', ') + ' \u2014 worth swapping the exercise before adding anything to it.' : ''),
        refs: ['rp21']
      });
    }

    /* Your back, as you reported it at the start of each session. Graded
       only on what you said; the app has no other way to know. */
    if (T.pr.bk) {
      var said = wos.filter(function (wo) { return fin(wo.bk); });
      var bad = said.filter(function (wo) { return wo.bk === 2; }).length;
      var tight = said.filter(function (wo) { return wo.bk === 1; }).length;
      checks.push({
        st: !said.length ? 'info' : bad ? 'look' : 'good',
        t: 'Your back',
        b: !said.length
          ? 'Each session asks how your back is before you start. Answer it and this keeps the tally.'
          : (bad ? 'Sore going into ' + bad + ' session' + (bad > 1 ? 's' : '') + ' this week. ' +
              'If it keeps happening, the pattern matters more than any one day \u2014 worth taking to a physio, along with which exercises came before it. '
            : tight ? 'Tight on ' + tight + ' of ' + said.length + ', never sore. ' : 'Good going into every session this week. ') +
            'Exercise helps most backs with long-running trouble; which exercises suit yours is the individual part.',
        refs: ['hayden21', 'long04']
      });
    }

    /* Minutes against what you said you have. */
    var budget = (ms && ms.min) || T.pr.min;
    if (budget) {
      var lens = wos.filter(function (wo) { return wo.en > wo.st; }).map(function (wo) { return (wo.en - wo.st) / 60000; });
      if (lens.length) {
        var typ = Math.round(median(lens));
        checks.push({
          st: typ > budget * 1.15 ? 'look' : 'good',
          t: 'Time per session',
          b: 'Typical session: ' + typ + ' minutes against your ' + budget + '. ' +
            (typ > budget * 1.15
              ? 'Running long. Pairing more exercises, or two sets instead of three on the small ones, gives time back with little lost.'
              : 'Inside it. Paired sets and fewer, harder sets are what make a short session work.'),
          refs: ['iversen21']
        });
      }
    }

    var ac = activityCheck(now, wos.length);
    if (ac) checks.push(ac);

    var prog = progress(now);
    if (prog.n && keep) {
      checks.push({
        st: prog.fall.length ? 'look' : 'good',
        t: 'Is your strength holding?',
        b: prog.held + ' of ' + prog.n + ' lifts done at least twice in the last four weeks are holding or up on estimated max. ' +
          (prog.fall.length
            ? 'Down two sessions running: ' + prog.fall.map(function (e) { return lib(e).n; }).join(', ') + '. The block adds a set back when that happens; if it keeps sliding, look at sleep and what else the week asked of you first.'
            : 'Nothing has slid two sessions running, which is what keeping looks like.'),
        refs: ['spiering21', 'epley']
      });
    } else if (prog.n) {
      checks.push({
        st: prog.fall.length ? 'look' : 'good',
        t: 'Are the lifts going up?',
        b: prog.up + ' of ' + prog.n + ' lifts done at least twice in the last four weeks are up on estimated max' +
          (prog.flat ? ', ' + prog.flat + ' flat' : '') + (prog.down ? ', ' + prog.down + ' down' : '') + '. ' +
          (prog.fall.length
            ? 'Down two sessions running: ' + prog.fall.map(function (e) { return lib(e).n; }).join(', ') + '. With reps in reserve falling each week that is the classic sign of fatigue outrunning recovery — RP would deload rather than push on.'
            : 'Nothing has slid two sessions in a row, so there is no sign of fatigue outrunning recovery.') +
          /* The estimate cannot see effort, and inside a block effort rises
             on purpose. Said, rather than let a climbing line be read as all
             new muscle. */
          (ms ? ' Some of any rise inside a block is the reps in reserve coming down rather than new strength \u2014 the first week of one block against the first week of the next is the cleaner comparison.' : ''),
        refs: ['rp21', 'epley', 'deload24']
      });
    }
    return { rows: rows, checks: checks, n: wos.length, prog: prog, label: win.label, keep: keep };
  }

  /* Cardio, from what you logged outside the gym, against the WHO's 150 to
     300 moderate minutes a week — and the two strength days it also asks
     for, which the workouts supply. Shown once you have said you golf or
     walk, or have logged either. */
  function activityCheck(now, lifts) {
    var wk = axWeek(now);
    if (!T.pr.hab.length && !wk.min) return null;
    var parts = Object.keys(wk.by).map(function (k) { return HABITS[k].n.toLowerCase() + ' ' + dur(wk.by[k] * 60000); });
    return {
      st: wk.min >= 150 && lifts >= 2 ? 'good' : wk.min ? 'look' : 'info',
      t: 'Cardio outside the gym',
      b: (wk.min ? dur(wk.min * 60000) + ' in the last seven days (' + parts.join(', ') + ')' : 'Nothing logged in the last seven days') +
        ' against the 150 moderate minutes a week the WHO recommends' +
        (lifts >= 2 ? ', and ' + lifts + ' strength sessions against its two. ' : '. ') +
        (wk.min >= 150 ? 'Covered.' : wk.min ? (150 - wk.min) + ' minutes short \u2014 a couple of walks would do it.'
          : 'Log a round or a walk with the buttons on Block and this counts it.') +
        ' Golf counts, cart or walking: both are moderate by the Compendium\u2019s numbers.',
      refs: ['who20', 'compendium11']
    };
  }

  /* Estimated max, first session against the latest, for every lift done at
     least twice in four weeks. Bodyweight lifts with nothing added are
     measured in reps instead. */
  function progress(now) {
    var from = now - 28 * DAY_MS;
    var per = {};
    ix().list.forEach(function (wo) {
      if (wo.st < from || wo.st > now || wo.dl) return;
      wo.x.forEach(function (x) {
        if (!x.s.length) return;
        var v = bestE1(x.s, wo.u);
        if (!(v > 0)) v = Math.max.apply(null, x.s.map(function (s) { return s.r; }));
        (per[x.e] = per[x.e] || []).push(v);
      });
    });
    var out = { n: 0, up: 0, flat: 0, down: 0, held: 0, fall: [], lifts: [] };
    Object.keys(per).forEach(function (e) {
      var v = per[e];
      if (v.length < 2) return;
      out.n++;
      var ch = v[v.length - 1] / v[0] - 1;
      if (ch > 0.01) out.up++; else if (ch < -0.01) out.down++; else out.flat++;
      if (ch >= -0.03) out.held++;
      var k = v.length;
      if (k >= 3 && v[k - 1] < v[k - 2] * 0.99 && v[k - 2] < v[k - 3] * 0.99) out.fall.push(e);
      out.lifts.push({ e: e, ch: ch, n: k });
    });
    out.lifts.sort(function (a, b) { return b.ch - a.ch; });
    return out;
  }

  function median(a) {
    if (!a.length) return 0;
    var s = a.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
  function mname(k) { return MUS[k] ? MUS[k].n : k; }
  function names(rows) {
    var n = rows.map(function (r) { return r.n; });
    return n.length < 3 ? n.join(' and ') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
  }
  function clock(s) {
    s = Math.max(0, Math.round(s));
    return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }
  function dur(ms) {
    var m = Math.max(1, Math.round(ms / 60000));
    return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60 < 10 ? '0' : '') + (m % 60);
  }
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function when(ts) {
    var d = new Date(ts);
    return DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()];
  }
  function shortDate(ts) { var d = new Date(ts); return MON[d.getMonth()] + ' ' + d.getDate(); }

  function active() {
    var ms = T.act && T.ms[T.act];
    return ms || null;
  }
  function volOf(wo) {
    var v = 0;
    wo.x.forEach(function (x) { x.s.forEach(function (s) { v += conv(s.w, wo.u) * s.r; }); });
    return v;
  }
  function setsOf(wo) { return wo.x.reduce(function (n, x) { return n + x.s.length; }, 0); }

  /* ------------------------------------------------------------------ state */
  var S = {
    sub: (function () {
      try {
        var v = localStorage.getItem(LS_SUB);
        return ['block', 'history', 'lifts', 'review'].indexOf(v) >= 0 ? v : 'block';
      } catch (e) { return 'block'; }
    })(),
    gen: null,            // the builder's answers; see gen()
    draft: null,          // a block being put together, before it is started
    sheet: null,          // whichever sheet is up
    q: '', qm: '',        // the picker's search and muscle
    arm: '',              // a two-tap confirm, armed
    own: null             // the make-your-own form in the picker
  };

  /* ------------------------------------------------------------ the logger */

  function liveFromPlan(ms, w, d) {
    var p = plan(ms, w, d);
    return {
      id: newId(), st: Date.now(), n: p.n, u: T.pr.u, ms: ms.id, w: w, d: d,
      dl: p.deload ? 1 : 0, rir: p.rir,
      x: p.x.map(function (s) { return liveEx(s.e, s.sets, s); }),
      sr: {}, fb: {}, rs: null, keep: isKeep(ms) ? 1 : 0
    };
  }

  function liveEx(e, n, s) {
    var ex = lib(e);
    s = s || target(ex, null, 0, 0, false);
    var prev = s.prev || [];
    var sets = [];
    for (var i = 0; i < Math.max(1, n); i++) {
      var pv = prev[i] || prev[prev.length - 1] || null;
      sets.push({ w: '', r: '', t: 0,
        tw: fin(s.tw) ? s.tw : null, tr: fin(s.tr) ? s.tr : null,
        pw: pv ? pv.w : null, pr: pv ? pv.r : null });
    }
    return { e: e, rr: ex.rr.slice(), rir: s.rir === undefined ? null : s.rir, rest: restFor(ex), s: sets,
      p: s.p || 0 };
  }

  /* The other half of a pair, if it is still in the workout. */
  function partner(i) {
    var x = LIVE.x[i];
    if (!x || !x.p) return -1;
    for (var j = 0; j < LIVE.x.length; j++) if (j !== i && LIVE.x[j].p === x.p) return j;
    return -1;
  }
  /* A1, A2, B1… in the order the pairs appear, so the labels read down the
     page. Unpaired exercises have none. */
  function pairLabels() { return slotLabels(LIVE.x); }

  function startPlanned(ms, w, d) {
    if (LIVE) return;
    setLive(liveFromPlan(ms, w, d));
    S.sub = 'block';
    draw();
    wake();
    scrollTop();
  }
  function startEmpty() {
    if (LIVE) return;
    setLive({ id: newId(), st: Date.now(), n: 'Workout', u: T.pr.u, ms: '', w: -1, d: -1, dl: 0, rir: null,
      x: [], sr: {}, fb: {}, rs: null });
    S.sub = 'block';
    draw();
    wake();
    scrollTop();
  }
  function scrollTop() {
    var v = $('view-train');
    if (v && v.getBoundingClientRect().top < 0) window.scrollTo(0, v.offsetTop);
  }

  /* Muscles in this session that were trained in the last ten days: the ones
     worth asking "how did that heal" about. Only in a block, where the
     answer moves something. */
  function soreAsk() {
    if (!LIVE || !LIVE.ms) return [];
    var ms = T.ms[LIVE.ms];
    if (!ms) return [];
    var want = uniq(LIVE.x.map(function (x) { return musOf(x.e); }));
    var list = ix().list;
    return want.filter(function (m) {
      for (var i = list.length - 1; i >= 0; i--) {
        var w = list[i];
        if (LIVE.st - w.st > 10 * DAY_MS) break;
        if (w.x.some(function (x) { return musOf(x.e) === m && x.s.length; })) return true;
      }
      return false;
    });
  }

  /* A muscle is ready for its feedback once every set of it in this session
     has been ticked. Asked then, while the pump is still there to judge. */
  function fbReady(m) {
    if (!LIVE || !LIVE.ms) return false;
    var any = false;
    for (var i = 0; i < LIVE.x.length; i++) {
      var x = LIVE.x[i];
      if (musOf(x.e) !== m) continue;
      any = true;
      if (x.s.some(function (s) { return !s.t; })) return false;
    }
    return any;
  }
  function lastOfMuscle(i) {
    var m = musOf(LIVE.x[i].e);
    for (var j = LIVE.x.length - 1; j >= 0; j--) if (musOf(LIVE.x[j].e) === m) return j === i;
    return false;
  }

  /* What an empty box means, which is what it shows greyed and what a tick
     takes. The weight follows what you actually lifted earlier in this
     session before any plan — change the bar on set one and the rest follow
     — then the target, then last time. Reps follow the target first, since
     the plan knows what week it is. */
  function ghost(xi, si) {
    var x = LIVE.x[xi], s = x.s[si], ex = lib(x.e);
    var cw = null, cr = null;
    for (var j = si - 1; j >= 0; j--) {
      var e = x.s[j];
      if (cw === null) cw = numIn(e.w);
      if (cr === null) cr = numIn(e.r);
      if (cw !== null && cr !== null) break;
    }
    var w = cw !== null ? cw : fin(s.tw) ? s.tw : fin(s.pw) ? s.pw : ex.q === 'bw' ? 0 : null;
    var r = fin(s.tr) ? s.tr : cr !== null ? cr : fin(s.pr) ? s.pr : null;
    return { w: w, r: r };
  }

  function numIn(v) {
    var n = parseFloat(String(v === null || v === undefined ? '' : v).replace(',', '.'));
    return fin(n) ? n : null;
  }

  /* Ticking a set with the boxes empty takes what they were showing — the
     target, or last time's — the way Strong does. Most sets are done as
     planned, and typing 185 and 8 forty times a week is the chore that makes
     people stop logging. */
  function tick(xi, si) {
    var x = LIVE.x[xi], s = x && x.s[si];
    if (!s) return;
    if (s.t) { s.t = 0; saveLive(); draw(); return; }
    var w = numIn(s.w), r = numIn(s.r), g = ghost(xi, si);
    if (w === null) w = g.w;
    if (r === null) r = g.r;
    if (w === null || r === null || r <= 0) {
      S.flash = xi + ':' + si;
      draw();
      var el = $((w === null ? 'trw-' : 'trr-') + xi + '-' + si);
      if (el) el.focus();
      return;
    }
    s.w = w; s.r = r; s.t = Date.now();
    var more = LIVE.x.some(function (y) { return y.s.some(function (z) { return !z.t; }); });
    /* In a pair, the rest after a set is the short one: the other half goes
       next, and it is resting this muscle while it works. */
    if (more) startRest(partner(xi) >= 0 ? T.pr.rp : x.rest);
    saveLive();
    audioPrime();
    draw();
  }

  /* ------------------------------------------------------------ rest timer
   *
   * Kept as an end time rather than a countdown, so a phone that locks in the
   * middle of it — which is every phone, every set — comes back to the right
   * number instead of the number it had when the screen went dark. */
  function startRest(sec) {
    LIVE.rs = { end: Date.now() + sec * 1000, dur: sec, rung: 0 };
  }
  function restLeft() {
    if (!LIVE || !LIVE.rs) return null;
    return Math.ceil((LIVE.rs.end - Date.now()) / 1000);
  }
  function drawRest() {
    var bar = $('trRest');
    if (!bar) return;
    var left = restLeft();
    if (left === null || left < -8) {
      if (!bar.classList.contains('hide')) { bar.classList.add('hide'); bar.innerHTML = ''; }
      return;
    }
    var done = left <= 0;
    var pct = done ? 100 : Math.max(0, Math.min(100, 100 * (1 - left / LIVE.rs.dur)));
    bar.classList.remove('hide');
    bar.classList.toggle('tr-rest-done', done);
    var html = '<div class="tr-rest-fill" style="width:' + pct.toFixed(1) + '%"></div>' +
      '<div class="tr-rest-in">' +
        '<span class="tr-rest-t" role="timer" aria-live="off">' + (done ? 'Rest’s up' : 'Rest ' + clock(left)) + '</span>' +
        '<span class="tr-rest-b">' +
          (done ? '' : '<button class="tr-rest-btn" data-t="rest" data-v="-15" aria-label="Fifteen seconds less">−15</button>' +
            '<button class="tr-rest-btn" data-t="rest" data-v="15" aria-label="Fifteen seconds more">+15</button>') +
          '<button class="tr-rest-btn" data-t="rest" data-v="skip">' + (done ? 'Close' : 'Skip') + '</button>' +
        '</span>' +
      '</div>';
    if (bar.innerHTML !== html) bar.innerHTML = html;
    if (done && !LIVE.rs.rung) {
      LIVE.rs.rung = 1;
      saveLive();
      ring();
    }
  }

  var AC = null;
  /* Browsers only let a page make sound after a tap, so the audio is woken on
     the tap that ticks a set and is ready by the time the rest runs out. */
  function audioPrime() {
    try {
      if (!AC) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (C) AC = new C();
      }
      if (AC && AC.state === 'suspended') AC.resume();
    } catch (e) { AC = null; }
  }
  function ring() {
    try { if (navigator.vibrate) navigator.vibrate([180, 90, 180]); } catch (e) { /* not on this device */ }
    if (!AC || !T.pr.snd) return;
    try {
      [0, 0.28].forEach(function (at) {
        var o = AC.createOscillator(), g = AC.createGain(), t0 = AC.currentTime + at;
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
        o.connect(g); g.connect(AC.destination);
        o.start(t0); o.stop(t0 + 0.25);
      });
    } catch (e) { /* no sound: the bar and the buzz still say it */ }
  }

  /* The screen stays on while a workout is open. A phone that locks between
     every set is a phone you unlock forty times a session. */
  var WAKE = null;
  function wake() {
    if (!LIVE || WAKE || !navigator.wakeLock || document.hidden) return;
    navigator.wakeLock.request('screen').then(function (l) {
      WAKE = l;
      l.addEventListener('release', function () { WAKE = null; });
    }, function () { /* refused: the phone locks as it always did */ });
  }
  function stopWake() {
    if (WAKE) { try { WAKE.release(); } catch (e) { /* already gone */ } WAKE = null; }
  }

  var TICKER = null;
  function ticking() {
    if (LIVE && !TICKER) TICKER = setInterval(onTick, 1000);
    if (!LIVE && TICKER) { clearInterval(TICKER); TICKER = null; }
  }
  function onTick() {
    if (!LIVE) { ticking(); return; }
    var el = $('trElapsed');
    if (el) el.textContent = clock((Date.now() - LIVE.st) / 1000);
    drawRest();
  }

  /* Finishing: what is kept, and what is dropped. A set never ticked was never
     done, as far as the log is concerned. */
  function finished() {
    var wo = {
      id: LIVE.id, st: LIVE.st, en: Date.now(), dk: dayKey(new Date(LIVE.st)),
      n: LIVE.n, u: LIVE.u, ms: LIVE.ms || '', w: LIVE.w, d: LIVE.d, dl: LIVE.dl ? 1 : 0,
      x: LIVE.x.map(function (x) {
        return { e: x.e, s: x.s.filter(function (s) { return s.t; }).map(function (s) {
          return { w: numIn(s.w) || 0, r: numIn(s.r) || 0, t: s.t };
        }) };
      }).filter(function (x) { return x.s.length; }),
      sr: LIVE.sr || {}, fb: LIVE.fb || {}
    };
    if (fin(LIVE.bk)) wo.bk = LIVE.bk;
    return clean(wo);
  }

  function saveWorkout() {
    var wo = finished();
    if (!wo.x.length) return false;
    T.wo[wo.id] = wo;
    stamp('wo', wo.id);
    setLive(null);
    stopWake();
    /* And My Day hears about it. Its "trained today" tick moves where the
       day's carbohydrate lands, and it used to be a thing you had to
       remember to press after the gym. The workout is the press. */
    var h = hive();
    if (h && h.trained) { try { h.trained(wo.dk); } catch (e) { /* My Day is not up */ } }
    return wo;
  }

  /* ---------------------------------------------------------------- render */
  function drawIfShowing() {
    var v = $('view-train');
    if (v && !v.classList.contains('hide')) draw();
    else markTab();
  }

  /* app.js calls this whenever the whole page redraws, which includes every
     household change arriving from the other phone. A redraw while a number
     is half typed would be felt as the box fighting back, so an outside
     redraw waits until the finger is out of the box. */
  function render() {
    var a = document.activeElement;
    if (a && a.closest && (a.closest('#view-train') || a.closest('#trainRoot')) &&
        (a.tagName === 'INPUT' || a.tagName === 'SELECT')) {
      markTab();
      return;
    }
    draw();
  }

  function markTab() {
    var tab = document.querySelector('.tab[data-view="train"]');
    if (tab) tab.classList.toggle('tr-tab-live', !!LIVE);
  }

  function draw() {
    var root = $('trBody');
    if (!root) return;
    var head = $('trHead');
    if (head) {
      head.innerHTML = '<button class="ghost" data-t="settings">Settings</button>';
    }
    var html = segHTML();
    if (LIVE && S.sub !== 'block') {
      html += '<button class="tr-back" data-t="sub" data-v="block">Workout in progress · <span>' +
        esc(LIVE.n) + '</span> — back to it</button>';
    }
    if (S.sub === 'block') html += LIVE ? liveHTML() : blockHTML();
    else if (S.sub === 'history') html += historyHTML();
    else if (S.sub === 'lifts') html += liftsHTML();
    else html += reviewHTML();
    root.innerHTML = html;
    S.flash = '';
    drawRest();
    drawSheet();
    markTab();
    ticking();
    if (LIVE) wake();
  }

  function segHTML() {
    var tabs = [['block', LIVE ? 'Workout' : 'Block'], ['history', 'History'], ['lifts', 'Lifts'], ['review', 'Review']];
    return '<div class="seg tr-seg" role="group" aria-label="Train">' + tabs.map(function (t) {
      return '<button data-t="sub" data-v="' + t[0] + '" aria-pressed="' + (S.sub === t[0]) + '">' + t[1] + '</button>';
    }).join('') + '</div>';
  }

  function chips(t, cur, opts, extra) {
    return '<div class="tr-chips" role="group">' + opts.map(function (o) {
      var on = Array.isArray(cur) ? cur.indexOf(o[0]) >= 0 : String(cur) === String(o[0]);
      return '<button class="tr-chip" data-t="' + t + '" data-v="' + esc(o[0]) + '"' + (extra || '') +
        ' aria-pressed="' + on + '">' + esc(o[1]) + '</button>';
    }).join('') + '</div>';
  }

  function targetStr(s, ex) {
    if (fin(s.tw) && fin(s.tr)) {
      return (s.tw > 0 ? fmtN(s.tw) + ' ' + T.pr.u + ' × ' : ex.q === 'bw' ? 'bodyweight × ' : '') + s.tr;
    }
    if (ex.q === 'bw') return 'bodyweight, add weight past ' + ex.rr[1];
    return 'pick a weight for ' + ex.rr[0] + '–' + ex.rr[1];
  }
  /* The week's effort as a sentence. "About 0 reps in reserve" is a
     roundabout way to say failure, so the last hard week says failure. */
  function rirSay(r) {
    if (r === 0) return 'take working sets to failure, or a rep short on the heavy barbell lifts';
    return 'finish working sets with about ' + r + ' rep' + (r === 1 ? '' : 's') + ' in reserve';
  }
  function rirStr(r) { return r === null || r === undefined ? 'deload' : r + ' RIR'; }

  /* ------------------------------------------------------ the block screen */
  /* Said once, where the eye lands after Save, and gone at the next tap. */
  function savedHTML() {
    var wo = S.justSaved && T.wo[S.justSaved];
    if (!wo) return '';
    var prs = prsIn(wo).length;
    return '<div class="tr-saved" role="status"><span>Saved \u00b7 ' + esc(wo.n) + ' \u00b7 ' + setsOf(wo) + ' sets' +
      (prs ? ' \u00b7 <span class="tr-pr">\u2605 ' + prs + ' record' + (prs === 1 ? '' : 's') + '</span>' : '') + '</span>' +
      '<button class="tr-lnk" data-t="wosheet" data-id="' + esc(wo.id) + '">See it</button></div>';
  }

  function blockHTML() {
    var ms = active();
    if (S.draft) return draftHTML();
    if (!ms) return savedHTML() + actStrip() + genHTML();
    var nx = nextSlot(ms);
    var acc = accOf(ms);
    var html = savedHTML() + '<div class="tr-card">' +
      '<div class="tr-eyebrow">Your block</div>' +
      '<div class="tr-title">' + esc(ms.n) + '</div>';
    if (nx) {
      var rir = rirFor(ms, nx.w);
      html += '<div class="tr-sub">Week ' + (nx.w + 1) + ' of ' + weeksOf(ms) + ' · ' +
        (rir === null ? 'deload week' : rirSay(rir)) + '</div>';
    } else {
      html += '<div class="tr-sub">Every session of this block is done.</div>';
    }
    html += weekGrid(ms, nx) + '</div>';

    if (nx) {
      var p = plan(ms, nx.w, nx.d);
      var mins = estDay(ms.days[nx.d], p.x.map(function (x) { return x.sets; }));
      html += '<div class="tr-card tr-next">' +
        '<div class="tr-eyebrow">Next \u00b7 week ' + (nx.w + 1) + ' \u00b7 about ' + mins + ' min</div>' +
        '<div class="tr-title">' + esc(p.n) + '</div>' +
        planList(p) +
        '<div class="tr-acts">' +
          '<button class="btn-primary" data-t="start" data-w="' + nx.w + '" data-d="' + nx.d + '">Start workout</button>' +
          '<button class="ghost" data-t="skip" data-w="' + nx.w + '" data-d="' + nx.d + '">Skip this one</button>' +
        '</div>' +
      '</div>';
    } else {
      html += doneHTML(ms);
    }
    html += actStrip();
    html += '<div class="tr-acts tr-foot">' +
      '<button class="ghost" data-t="empty">Log a workout outside the block</button>' +
      (nx && nx.w < acc && !isKeep(ms) ? '<button class="ghost" data-t="deloadnow">Deload now</button>' : '') +
      '<button class="ghost" data-t="endblock">End this block</button>' +
    '</div>';
    return html;
  }

  function weekGrid(ms, nx) {
    var sk = Array.isArray(ms.sk) ? ms.sk : [];
    var html = '<div class="tr-grid" role="table" aria-label="Sessions in this block" style="--n:' + ms.days.length + '">' +
      '<div class="tr-grow" role="row"><span class="tr-gh" role="columnheader"></span>' +
      ms.days.map(function (d) { return '<span class="tr-gh" role="columnheader">' + esc(d.n) + '</span>'; }).join('') + '</div>';
    for (var w = 0; w < weeksOf(ms); w++) {
      html += '<div class="tr-grow" role="row"><span class="tr-gw" role="rowheader">' +
        (w >= accOf(ms) ? 'Deload' : 'Wk ' + (w + 1)) + '</span>';
      for (var d = 0; d < ms.days.length; d++) {
        var wo = woFor(ms, w, d);
        var isNext = nx && nx.w === w && nx.d === d;
        var skipped = !wo && sk.indexOf(w + ':' + d) >= 0;
        var cls = wo ? 'done' : isNext ? 'next' : skipped ? 'skip' : '';
        var lab = wo ? shortDate(wo.st) : isNext ? 'Next' : skipped ? 'Skipped' : '';
        html += '<button class="tr-gc ' + cls + '" role="cell" data-t="plansheet" data-w="' + w + '" data-d="' + d + '" ' +
          'aria-label="Week ' + (w + 1) + ', ' + esc(ms.days[d].n) + (lab ? ': ' + lab : '') + '">' +
          (wo ? '✓ ' : '') + esc(lab) + '</button>';
      }
      html += '</div>';
    }
    return html + '</div>';
  }

  /* Why the sets are what they are, said once per muscle — it is the
     muscle's number that moved, and saying it under both of that muscle's
     exercises read as two decisions. Week one has nothing to explain. */
  function planList(p) {
    var said = {};
    var labels = slotLabels(p.x);
    return '<ol class="tr-plan">' + p.x.map(function (s, i) {
      var ex = lib(s.e);
      var why = p.w > 0 && !said[ex.m] ? s.why : '';
      said[ex.m] = 1;
      var cue = backCue(ex);
      return '<li><div class="tr-pl-top"><span class="tr-pl-n">' +
          (labels[i] ? '<span class="tr-pair">' + labels[i] + '</span>' : '') + esc(ex.n) + '</span>' +
        '<span class="tr-pl-s">' + s.sets + ' × ' + ex.rr[0] + '–' + ex.rr[1] + '</span></div>' +
        '<div class="tr-pl-meta">' + esc(mname(ex.m)) + ' · ' + esc(targetStr(s, ex)) +
          ' · ' + rirStr(s.rir) + '</div>' +
        (cue ? '<div class="tr-cue">' + esc(cue) + '</div>' : '') +
        (why ? '<div class="tr-why">' + esc(mname(ex.m) + ': ' + why) + '</div>' : '') + '</li>';
    }).join('') + '</ol>';
  }

  /* ------------------------------------------------- outside the gym
   *
   * Golf and walks, logged in a tap and counted toward the week's cardio.
   * Shown only once you have said you do them. */
  function axWeek(now) {
    now = now || Date.now();
    var mins = 0, by = {};
    Object.keys(T.ax).forEach(function (k) {
      var a = T.ax[k];
      if (!a || a.st < now - 7 * DAY_MS || a.st > now) return;
      mins += a.min;
      by[a.k] = (by[a.k] || 0) + a.min;
    });
    return { min: mins, by: by };
  }
  function actStrip() {
    if (!T.pr.hab.length) return '';
    var wk = axWeek();
    return '<div class="tr-card tr-actv">' +
      '<div class="tr-actv-h"><span class="tr-ql">Outside the gym \u00b7 last 7 days</span>' +
        '<span class="tr-actv-n">' + (wk.min ? dur(wk.min * 60000) : 'nothing yet') + '</span></div>' +
      '<div class="tr-chips">' + T.pr.hab.map(function (h) {
        return '<button class="tr-chip" data-t="axnew" data-v="' + h + '">+ ' + esc(HABITS[h].btn) + '</button>';
      }).join('') + '</div></div>';
  }

  function doneHTML(ms) {
    var wos = ix().list.filter(function (w) { return w.ms === ms.id; });
    var prs = 0;
    wos.forEach(function (w) { prs += prsIn(w).length; });
    var lifts = {};
    wos.forEach(function (w) {
      if (w.dl) return;
      w.x.forEach(function (x) {
        var v = bestE1(x.s, w.u);
        if (!(v > 0)) return;
        var l = lifts[x.e] = lifts[x.e] || { a: v, b: v };
        l.b = v;
      });
    });
    var ups = Object.keys(lifts).map(function (e) { return { e: e, ch: lifts[e].b / lifts[e].a - 1 }; })
      .filter(function (l) { return l.ch !== 0; })
      .sort(function (a, b) { return b.ch - a.ch; }).slice(0, 6);
    return '<div class="tr-card">' +
      '<div class="tr-eyebrow">Block complete</div>' +
      '<div class="tr-title">' + wos.length + ' sessions · ' + prs + ' record' + (prs === 1 ? '' : 's') + '</div>' +
      (ups.length ? '<ul class="tr-ups">' + ups.map(function (l) {
        return '<li><span>' + esc(lib(l.e).n) + '</span><span class="' + (l.ch > 0 ? 'up' : 'down') + '">' +
          (l.ch > 0 ? '+' : '−') + Math.abs(Math.round(l.ch * 100)) + '% e1RM</span></li>';
      }).join('') + '</ul>' : '') +
      '<div class="tr-note">The next block starts back near the minimum and climbs again. RP’s reasoning: volume you needed at the end of this one is more than you need at the start of the next, once the deload has let the fatigue go.</div>' +
      '<div class="tr-acts"><button class="btn-primary" data-t="again">Build the next block</button></div>' +
    '</div>';
  }

  var LVL = [[0, 'Under a year'], [1, '1–3 years'], [2, '3+ years']];
  var TRIG = [['f', 'Bending forward or sitting'], ['c', 'Weight on my spine'], ['x', 'Arching back']];

  /* The builder's answers, started from what you told it last time — your
     goal, your minutes, your back and your habits are yours, not the
     block's, and should not have to be said twice. */
  function gen() {
    if (!S.gen) {
      var p = T.pr, keep = p.goal === 'keep';
      S.gen = { goal: p.goal, dpw: keep ? 2 : 4, kit: 'gym', lvl: 1, acc: keep ? 8 : 4, pri: [],
        min: p.min, bk: p.bk, hab: p.hab.slice() };
    }
    return S.gen;
  }

  function q(label, body, hint) {
    return '<div class="tr-q"><div class="tr-ql">' + label + '</div>' + body +
      (hint ? '<div class="tr-hint">' + esc(hint) + '</div>' : '') + '</div>';
  }

  function genHTML() {
    var g = gen(), keep = g.goal === 'keep';
    return '<div class="tr-card">' +
      '<div class="tr-eyebrow">Build a block</div>' +
      '<div class="tr-title">' + (keep ? 'Keep the strength you have, in the time you have'
        : 'A few weeks of training, planned to get harder') + '</div>' +
      '<div class="tr-note">' + (keep
        ? 'Full body, heavy enough that strength has a reason to stay, paired so it fits your minutes, and steady from week to week — no climbing volume, no deload.'
        : 'It builds a split, starts each muscle near the least volume that reliably grows it, and after every session asks how it felt — which is what decides next week’s sets.') + '</div>' +
      q('Training for', chips('g-goal', g.goal, [['keep', 'Keep my strength'], ['grow', 'Build muscle']]),
        keep ? 'Maintenance: a fraction of the work it took to build.' : 'RP-style: volume climbs week to week, then a deload.') +
      q('Days a week', chips('g-dpw', g.dpw, keep ? [[2, '2'], [3, '3']] : [[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']]),
        keep ? (g.dpw >= 3 ? 'Three shorter full-body sessions.' : 'Two full-body sessions.') : SPLITS[g.dpw].n) +
      q('Time per session', chips('g-min', g.min, [[30, '30 min'], [40, '40 min'], [60, '60 min'], [0, 'No limit']]),
        g.min ? 'Warm-up included. It pairs exercises and trims sets to fit, and never adds a set that would not.' : '') +
      q('What you have', chips('g-kit', g.kit, Object.keys(KITS).map(function (k) { return [k, KITS[k].n]; }))) +
      (keep ? '' : q('Lifting for', chips('g-lvl', g.lvl, LVL))) +
      q('Length', keep
        ? chips('g-acc', g.acc, [[6, '6 weeks'], [8, '8 weeks'], [10, '10 weeks']])
        : chips('g-acc', g.acc, [[3, '4 weeks'], [4, '5 weeks'], [5, '6 weeks'], [6, '7 weeks']]),
        keep ? 'Then build another with fresh exercises. No deload week at this dose.' : 'Including a lighter deload week at the end.') +
      q('Protect my back from <span class="tr-opt">optional</span>', chips('g-bk', g.bk.split(''), TRIG),
        g.bk ? 'Lifts that load your back that way are left out. Ones that load it a little come with a cue.'
          : 'Leave these off if your back is fine.') +
      q('Outside the gym <span class="tr-opt">optional</span>',
        chips('g-hab', g.hab, Object.keys(HABITS).map(function (k) { return [k, HABITS[k].n]; })),
        g.hab.length ? 'Counted as your cardio in the review; log a round or a walk in one tap.' : '') +
      (keep ? '' : q('Bring up <span class="tr-opt">up to three, optional</span>',
        chips('g-pri', g.pri, MUSCLES.map(function (m) { return [m.k, m.n]; })))) +
      '<div class="tr-acts"><button class="btn-primary" data-t="build">Build my block</button>' +
        '<button class="ghost" data-t="empty">Just log a workout</button></div>' +
    '</div>' + howHTML(g);
  }

  /* How it works, for the block you are about to build: the goal decides
     most of it, and your back and your golf each add a paragraph. */
  function howHTML(g) {
    var keep = g.goal === 'keep';
    var golf = g.hab.indexOf('golfw') >= 0 || g.hab.indexOf('golfc') >= 0;
    var out = '<details class="tr-how"><summary>How ' + (keep ? 'keeping' : 'the block') + ' works</summary>';
    if (keep) {
      out += '<p><b>Sets.</b> Three per exercise on two days a week, two on three — about six hard sets a muscle a week. Strength that has been built takes far less to keep than it took to build: one study held it for eight months on one session a week and a fraction of the sets. Older lifters need a little more, which is why this is two sessions, not one.</p>' +
        '<p><b>Effort.</b> About two reps short of failure on the big lifts, one on the small ones. Heavy is the part that keeps strength; failure is not.</p>' +
        '<p><b>Pairs.</b> One muscle rests while another works — a leg movement beside a row, a press beside a leg curl — with a minute between the halves, which leaves each muscle nearly three minutes between its own sets. That is how a whole body fits in forty minutes.</p>' +
        '<p><b>Weights.</b> Still double progression: when the top of the rep range comes easily, the weight goes up. Keeping is not standing still.</p>' +
        '<p><b>When it changes.</b> A session that was too much, or hurt, takes a set away next week. Strength sliding two weeks running puts one back. Otherwise it holds.</p>';
    } else {
      out += '<p><b>Sets.</b> Week one starts each muscle near RP’s MEV — the least that reliably grows it. After each session you rate the pump and the workload, and next time you train that muscle you say how well it healed. Those answers add up to next week’s change: usually one more set, two if the muscle is plainly asking for more, none or one fewer if you are not recovering. It never goes past RP’s MRV, or past your minutes.</p>' +
        '<p><b>Why ask about soreness at all?</b> It is a rough signal — it follows how new an exercise is more than how much it grew — which is why it is one vote of three, and why getting weaker overrules all of them.</p>' +
        '<p><b>Effort.</b> Sets end 3 reps short of failure in week one and step down to 0 by the last hard week. Heavy barbell lifts stop at 1.</p>' +
        '<p><b>Weights.</b> Hit the top of the rep range and the weight goes up by the smallest jump; otherwise aim for one more rep at the same weight.</p>' +
        '<p><b>Deload.</b> The last week is half the sets at week one’s weights. It is there to let fatigue drain, not to grow — one trial found a week off changed growth not at all.</p>';
    }
    if (g.bk) {
      out += '<p><b>Your back.</b> ' + (g.bk.indexOf('f') >= 0
        ? 'Loaded bending is left out — deadlifts, Romanian deadlifts, good mornings, bent-over rows, back squats and crunches. Hip work comes from hip thrusts and leg curls, rows are chest-supported, and the core slot trains your trunk to resist moving rather than to bend: Pallof presses, dead bugs, bird dogs. '
        : 'Lifts that load your back the way you said are left out, and the ones that load it a little carry a cue. ') +
        'Each session starts by asking how your back is, and a bad answer changes what the session asks of you.</p>';
    }
    if (golf) {
      out += '<p><b>Golf.</b> Address is a forward bend and the swing a twist at speed, so golf loads your back too. That is why the core work resists rotation. A heavy leg session the day before a round is worth avoiding — the app does not know your tee times, so that part is yours.</p>';
    }
    out += '<p class="tr-fine">' + (keep ? 'The maintenance doses come from studies of groups, not of you — the review watches whether your strength actually holds.'
      : 'The landmarks are Renaissance Periodization’s published estimates, not measurements of you. That is what the feedback is for.') +
      (g.bk ? ' Which movements suit your back is a question for a physio who has examined it; anything they rule out goes on your never list in Settings.' : '') + '</p>';
    return out + '</details>';
  }

  /* A1, A2, B1… for a list of slots, in the order the pairs appear. A pair
     that has lost its other half is not labelled. */
  function slotLabels(list) {
    var seen = {}, next = 0;
    return list.map(function (sl) {
      if (!sl.p || list.filter(function (x) { return x.p === sl.p; }).length < 2) return '';
      if (!seen[sl.p]) seen[sl.p] = { l: String.fromCharCode(65 + next++), n: 0 };
      return seen[sl.p].l + (++seen[sl.p].n);
    });
  }

  function draftHTML() {
    var ms = S.draft;
    var tot = totals(ms, ms.days.map(function (d) { return d.s.map(function (s) { return s.n; }); }));
    return '<div class="tr-card">' +
      '<div class="tr-eyebrow">Your block, before it starts</div>' +
      '<div class="tr-title">' + esc(ms.n) + '</div>' +
      '<div class="tr-sub">' + weeksOf(ms) + ' weeks · ' + esc(KITS[ms.kit].n.toLowerCase()) +
        ' · tap an exercise to swap it</div>' +
      ms.days.map(function (day, d) {
        var labels = slotLabels(day.s);
        var mins = estDay(day);
        return '<div class="tr-dday"><div class="tr-dday-h">' + esc(day.n) +
            '<span class="tr-mins' + (ms.min && mins > ms.min ? ' over' : '') + '">about ' + mins + ' min</span></div>' +
          day.s.map(function (s, i) {
            var ex = lib(s.e);
            var cue = backCue(ex);
            return '<div class="tr-drow">' +
              (labels[i] ? '<span class="tr-pair">' + labels[i] + '</span>' : '') +
              '<button class="tr-dex" data-t="dswap" data-d="' + d + '" data-i="' + i + '">' +
                '<span class="tr-dex-n">' + esc(ex.n) + '</span>' +
                '<span class="tr-dex-m">' + esc(mname(ex.m)) + ' · ' + ex.rr[0] + '–' + ex.rr[1] + ' reps' +
                  (cue ? ' · <span class="tr-cue-in">' + esc(cue) + '</span>' : '') + '</span></button>' +
              '<span class="tr-step">' +
                '<button data-t="dset" data-d="' + d + '" data-i="' + i + '" data-v="-1" aria-label="One set fewer">−</button>' +
                '<span>' + s.n + ' set' + (s.n === 1 ? '' : 's') + '</span>' +
                '<button data-t="dset" data-d="' + d + '" data-i="' + i + '" data-v="1" aria-label="One set more">+</button>' +
              '</span>' +
              '<button class="tr-x" data-t="ddel" data-d="' + d + '" data-i="' + i + '" aria-label="Remove ' + esc(ex.n) + '">&times;</button>' +
            '</div>';
          }).join('') +
          '<button class="tr-add" data-t="dadd" data-d="' + d + '">+ Add an exercise</button>' +
        '</div>';
      }).join('') +
      '<div class="tr-vol"><div class="tr-ql">' + (isKeep(ms) ? 'Sets per muscle each week' : 'Week one, sets per muscle') + '</div>' +
        Object.keys(tot).map(function (m) {
          return '<span class="tr-volc">' + esc(mname(m)) + ' <b>' + tot[m] + '</b></span>';
        }).join('') + '</div>' +
      '<div class="tr-acts"><button class="btn-primary" data-t="begin">Start this block</button>' +
        '<button class="ghost" data-t="shuffle">Different exercises</button>' +
        '<button class="ghost" data-t="undraft">Back</button></div>' +
    '</div>';
  }

  /* -------------------------------------------------------- the live screen */
  function liveHTML() {
    var L = LIVE;
    var ms = L.ms ? T.ms[L.ms] : null;
    var html = '<div class="tr-live-h">' +
      '<div><div class="tr-eyebrow">' + (ms ? (L.dl ? 'Deload' : 'Week ' + (L.w + 1)) + ' · ' + esc(ms.n) : 'Workout') + '</div>' +
        '<div class="tr-title">' + esc(L.n) + ' <span class="tr-clock" id="trElapsed">' +
          clock((Date.now() - L.st) / 1000) + '</span></div>' +
        (ms ? '<div class="tr-sub">' + (L.dl ? 'Light and easy: stop every set well short of failure.'
          : rirSay(L.rir).charAt(0).toUpperCase() + rirSay(L.rir).slice(1) + '.') + '</div>' : '') +
      '</div>' +
      '<button class="btn-primary" data-t="finish">Finish</button>' +
    '</div>';

    /* Your back, asked first, when you have said to protect it. A cranky
       morning changes what today should be; nerve symptoms change whether
       today should be at all. */
    if (T.pr.bk) {
      html += '<div class="tr-card tr-ask"><div class="tr-fbrow"><span class="tr-fbm">Back today</span>' +
        chips('bk', fin(L.bk) ? L.bk : '', [[0, 'Good'], [1, 'Tight'], [2, 'Sore']]) + '</div>' +
        (L.bk === 1 ? '<div class="tr-note">Warm up a little longer, keep the first set of anything for your legs light, and stop any lift that makes it worse.</div>' : '') +
        (L.bk === 2 ? '<div class="tr-note tr-warn">Skip the lower-body lifts today \u2014 swap or remove them \u2014 and keep to what feels fine. Pain, numbness or tingling running down a leg means stop: that is the nerve, and it is a question for your physio, not for this app.</div>' : '') +
      '</div>';
    }

    var ask = soreAsk();
    if (ask.length) {
      html += '<div class="tr-card tr-ask"><div class="tr-ql">Since you last trained them, how did they heal?</div>' +
        ask.map(function (m) {
          return '<div class="tr-fbrow"><span class="tr-fbm">' + esc(mname(m)) + '</span>' +
            chips('sore', fin(L.sr[m]) ? L.sr[m] : '', SORE.map(function (t, i) { return [i, t]; }), ' data-m="' + m + '"') + '</div>';
        }).join('') + '</div>';
    }

    var labels = pairLabels();
    L.x.forEach(function (x, i) {
      html += exCard(x, i, labels[i]);
      var m = musOf(x.e);
      if (lastOfMuscle(i) && fbReady(m)) html += fbCard(m);
    });
    html += '<div class="tr-acts tr-foot">' +
      '<button class="ghost" data-t="addex">+ Add an exercise</button>' +
      '<button class="ghost danger" data-t="discard">Discard workout</button>' +
    '</div>';
    return html;
  }

  function exCard(x, i, label) {
    var ex = lib(x.e);
    var mate = label ? LIVE.x[partner(i)] : null;
    var cue = backCue(ex);
    var rows = x.s.map(function (s, j) {
      var g = ghost(i, j);
      var ph = g.w !== null ? fmtN(g.w) : '';
      var rph = g.r !== null ? String(g.r) : ex.rr[0] + '–' + ex.rr[1];
      var prev = fin(s.pw) && fin(s.pr) ? fmtN(s.pw) + ' × ' + s.pr : '—';
      var flash = S.flash === i + ':' + j;
      return '<div class="tr-set' + (s.t ? ' done' : '') + (flash ? ' flash' : '') + '">' +
        '<span class="tr-sn">' + (j + 1) + '</span>' +
        '<span class="tr-prev">' + prev + '</span>' +
        '<input class="tr-in" id="trw-' + i + '-' + j + '" data-in="w" data-x="' + i + '" data-s="' + j + '" ' +
          'inputmode="decimal" autocomplete="off" placeholder="' + esc(ph) + '" value="' + esc(s.w) + '" ' +
          'aria-label="Set ' + (j + 1) + ' weight in ' + T.pr.u + '">' +
        '<input class="tr-in" id="trr-' + i + '-' + j + '" data-in="r" data-x="' + i + '" data-s="' + j + '" ' +
          'inputmode="numeric" autocomplete="off" placeholder="' + esc(rph) + '" value="' + esc(s.r) + '" ' +
          'aria-label="Set ' + (j + 1) + ' reps">' +
        '<button class="tr-tick" data-t="tick" data-x="' + i + '" data-s="' + j + '" aria-pressed="' + !!s.t + '" ' +
          'aria-label="' + (s.t ? 'Undo set ' : 'Done with set ') + (j + 1) + '">✓</button>' +
      '</div>';
    }).join('');
    var heavy = ex.q === 'bb' || ex.q === 'sm';
    return '<div class="tr-card tr-ex' + (label ? ' tr-paired' : '') + '">' +
      '<div class="tr-ex-h">' +
        (label ? '<span class="tr-pair" aria-label="Pair ' + label + '">' + label + '</span>' : '') +
        '<button class="tr-ex-n" data-t="exsheet" data-e="' + esc(x.e) + '">' + esc(ex.n) + '</button>' +
        '<span class="tr-ex-m">' + esc(mname(ex.m)) + ' \u00b7 ' + ex.rr[0] + '\u2013' + ex.rr[1] + ' reps' +
          (x.rir !== null && x.rir !== undefined ? ' \u00b7 ' + x.rir + ' RIR' : '') +
          (mate ? ' \u00b7 alternate with ' + esc(lib(mate.e).n) + ', ' + clock(T.pr.rp) + ' between'
            : ' \u00b7 rest ' + clock(x.rest)) + '</span>' +
        (cue ? '<span class="tr-cue">' + esc(cue) + '</span>' : '') +
      '</div>' +
      '<div class="tr-set tr-set-h" aria-hidden="true"><span>Set</span><span>Previous</span><span>' + T.pr.u + '</span><span>Reps</span><span></span></div>' +
      rows +
      '<div class="tr-ex-a">' +
        '<button class="tr-lnk" data-t="addset" data-x="' + i + '">+ Set</button>' +
        (x.s.length > 1 ? '<button class="tr-lnk" data-t="dropset" data-x="' + i + '">− Set</button>' : '') +
        (ex.k === 'c' && ex.q !== 'bw' ? '<button class="tr-lnk" data-t="warm" data-x="' + i + '">Warm-up</button>' : '') +
        (heavy ? '<button class="tr-lnk" data-t="plates" data-x="' + i + '">Plates</button>' : '') +
        '<button class="tr-lnk" data-t="swap" data-x="' + i + '">Swap</button>' +
        '<button class="tr-lnk" data-t="rmex" data-x="' + i + '">Remove</button>' +
      '</div>' +
    '</div>';
  }

  /* Keeping asks two questions, not three: a pump is how RP judges whether a
     muscle got enough to grow, and growing is not the job. */
  function fbCard(m) {
    var f = LIVE.fb[m] || {};
    return '<div class="tr-card tr-ask"><div class="tr-ql">' + esc(mname(m)) + ' done \u2014 how was it?</div>' +
      (LIVE.keep ? '' : '<div class="tr-fbrow"><span class="tr-fbm">Pump</span>' +
        chips('fb', fin(f.p) ? f.p : '', PUMP.map(function (t, i) { return [i, t]; }), ' data-m="' + m + '" data-f="p"') + '</div>') +
      '<div class="tr-fbrow"><span class="tr-fbm">Workload</span>' +
        chips('fb', fin(f.k) ? f.k : '', WORK.map(function (t, i) { return [i, t]; }), ' data-m="' + m + '" data-f="k"') + '</div>' +
      '<div class="tr-fbrow"><span class="tr-fbm">' + (T.pr.bk ? 'Back &amp; joints' : 'Joints') + '</span>' +
        chips('fb', fin(f.j) ? f.j : '', JOINT.map(function (t, i) { return [i, t]; }), ' data-m="' + m + '" data-f="j"') + '</div>' +
    '</div>';
  }

  /* ------------------------------------------------------------- history */
  function historyHTML() {
    var list = ix().list.slice();
    Object.keys(T.ax).forEach(function (k) { if (T.ax[k]) list.push({ ax: T.ax[k], st: T.ax[k].st }); });
    list.sort(function (a, b) { return b.st - a.st; });
    if (!list.length) {
      return '<div class="empty">Finished workouts land here. Start one from Block.</div>';
    }
    return '<div class="tr-hist">' + list.map(function (wo) {
      if (wo.ax) {
        var a = wo.ax;
        return '<button class="tr-card tr-hrow tr-hax" data-t="axsheet" data-id="' + esc(a.id) + '">' +
          '<span class="tr-h-top"><span class="tr-h-n">' + esc(HABITS[a.k].n) + '</span>' +
            '<span class="tr-h-d">' + when(a.st) + '</span></span>' +
          '<span class="tr-h-meta">' + dur(a.min * 60000) + ' \u00b7 counts toward your week\u2019s cardio</span>' +
        '</button>';
      }
      var prs = prsIn(wo).length;
      return '<button class="tr-card tr-hrow" data-t="wosheet" data-id="' + esc(wo.id) + '">' +
        '<span class="tr-h-top"><span class="tr-h-n">' + esc(wo.n) + '</span>' +
          '<span class="tr-h-d">' + when(wo.st) + '</span></span>' +
        '<span class="tr-h-meta">' + dur((wo.en || wo.st) - wo.st) + ' · ' + setsOf(wo) + ' sets · ' +
          fmtBig(volOf(wo)) + ' ' + T.pr.u + (prs ? ' · <span class="tr-pr">★ ' + prs + ' record' + (prs === 1 ? '' : 's') + '</span>' : '') +
        '</span>' +
        '<span class="tr-h-x">' + wo.x.map(function (x) {
          return esc(x.s.length + ' × ' + lib(x.e).n);
        }).join('<br>') + '</span>' +
      '</button>';
    }).join('') + '</div>';
  }

  /* --------------------------------------------------------------- lifts */
  function liftsHTML() {
    var per = {};
    ix().list.forEach(function (wo) {
      wo.x.forEach(function (x) {
        var p = per[x.e] = per[x.e] || { n: 0, last: 0 };
        p.n++;
        p.last = wo.st;
      });
    });
    var keys = Object.keys(per).sort(function (a, b) { return per[b].last - per[a].last; });
    if (!keys.length) return '<div class="empty">Every lift you log gets its own page here: records, and a line of your estimated max over time.</div>';
    return '<div class="tr-lifts">' + keys.map(function (e) {
      var ex = lib(e), r = records(e);
      var best = r.e1 > 0 ? fmtN(Math.round(r.e1)) + ' ' + T.pr.u : r.r + ' reps';
      return '<button class="tr-card tr-lrow" data-t="exsheet" data-e="' + esc(e) + '">' +
        '<span class="tr-l-n">' + esc(ex.n) + '</span>' +
        '<span class="tr-l-m">' + esc(mname(ex.m)) + ' · ' + per[e].n + ' session' + (per[e].n === 1 ? '' : 's') +
          ' · last ' + shortDate(per[e].last) + '</span>' +
        '<span class="tr-l-b"><span class="tr-l-bl">' + (r.e1 > 0 ? 'best e1RM' : 'best') + '</span>' + best + '</span>' +
      '</button>';
    }).join('') + '</div>';
  }

  /* -------------------------------------------------------------- review */
  var ICON = { good: '✓', look: '!', info: 'i' };
  var WORD = { good: 'On track', look: 'Worth a look', info: 'For information' };
  function reviewHTML() {
    var r = review();
    /* Keeping is drawn on its own scale: a band from three sets up, and no
       RP landmarks, which are about growing. */
    var max = r.keep ? Math.max(12, r.rows.reduce(function (m, x) { return Math.max(m, x.sets); }, 0) + 1)
      : Math.max(26, r.rows.reduce(function (m, x) { return Math.max(m, x.sets, x.mrv); }, 0));
    var band = r.keep ? [3, max - 3] : [10, 20];
    var pct = function (v) { return (100 * v / max).toFixed(2) + '%'; };
    var html = '<div class="tr-card">' +
      '<div class="tr-eyebrow">' + esc(r.label) + '</div>' +
      '<div class="tr-title">' + r.n + ' workout' + (r.n === 1 ? '' : 's') + ', held against the research</div>' +
      '<div class="tr-note">Every line below is a rule with a source. It grades what can be measured from your log and says so when something cannot be.</div>';
    if (r.rows.length) {
      html += '<div class="tr-vbars" role="table" aria-label="Hard sets per muscle this week">' +
        '<div class="tr-vkey" aria-hidden="true"><span class="tr-vk-band"></span> ' +
          (r.keep ? '3 or more hard sets, enough to keep strength' : '10\u201320 sets, where the evidence is strongest' +
          '<span class="tr-vk-tick"></span> RP\u2019s MEV and MRV') + '</div>' +
        r.rows.map(function (row) {
          return '<div class="tr-vrow" role="row" title="' + esc(row.n + ': ' + row.sets + ' sets on ' + row.days +
            ' day' + (row.days === 1 ? '' : 's') + ' · MEV ' + row.mev + ' · MRV ' + row.mrv) + '">' +
            '<span class="tr-vn" role="rowheader">' + esc(row.n) + '</span>' +
            '<span class="tr-vt" role="cell">' +
              '<span class="tr-vband" style="left:' + pct(band[0]) + ';width:' + pct(band[1] - band[0]) + '"></span>' +
              (!r.keep && row.mev ? '<span class="tr-vtick" style="left:' + pct(row.mev) + '"></span>' : '') +
              (!r.keep ? '<span class="tr-vtick" style="left:' + pct(row.mrv) + '"></span>' : '') +
              (row.sets ? '<span class="tr-vbar" style="width:' + pct(row.sets) + '"></span>' : '') +
            '</span>' +
            '<span class="tr-vv" role="cell">' + row.sets + '</span>' +
          '</div>';
        }).join('') + '</div>';
    }
    html += '</div>';
    html += r.checks.map(function (c) {
      return '<div class="tr-card tr-check tr-' + c.st + '">' +
        '<div class="tr-ck-h"><span class="tr-ck-i" aria-hidden="true">' + ICON[c.st] + '</span>' +
          '<span class="tr-ck-t">' + esc(c.t) + '</span><span class="tr-ck-w">' + WORD[c.st] + '</span></div>' +
        '<div class="tr-ck-b">' + esc(c.b) + '</div>' +
        (c.refs.length ? '<div class="tr-ck-r">' + c.refs.map(function (k) {
          return '<button class="tr-lnk tr-ref" data-t="ref" data-v="' + k + '">' + esc(REFS[k][0]) + '</button>';
        }).join(' · ') + '</div>' : '') +
      '</div>';
    }).join('');
    html += '<details class="tr-how" id="trRefs"><summary>Where the numbers come from</summary>' +
      '<dl class="tr-refs">' + Object.keys(REFS).map(function (k) {
        return '<dt id="tr-ref-' + k + '">' + esc(REFS[k][0]) + '</dt>' +
          '<dd><i>' + esc(REFS[k][1]) + '</i><br>' + esc(REFS[k][2]) + '</dd>';
      }).join('') + '</dl>' +
      '<p class="tr-fine">What this cannot do: it counts direct sets only, the way the landmarks are written; it cannot see reps in reserve; and it knows nothing about your sleep, food or stress, which move recovery more than any of this. The research gives ranges and trends across groups of people, not a prescription for one.</p>' +
    '</details>';
    return html;
  }

  /* ---------------------------------------------------------------- sheets
   *
   * Drawn into their own root, but opened and closed through app.js, so the
   * back gesture treats them exactly as it treats a recipe: back closes the
   * sheet and leaves you in the app. */
  function openSheet(sh) {
    var h = hive();
    if (!S.sheet && h && h.openSheet) h.openSheet();
    S.sheet = sh;
    S.arm = '';
    drawSheet();
    var x = document.querySelector('#trainRoot .sheet-x');
    if (x) x.focus();
  }
  /* Gone from the screen at once, and the history entry unwound behind it.
     Waiting for the popstate to come back round before clearing it left a
     frame of the old sheet over whatever the button had just started. */
  function closeSheet() {
    var h = hive();
    var had = !!S.sheet;
    sheetClosed();
    if (had && h && h.closeSheet) h.closeSheet();
  }
  function sheetClosed() {
    if (!S.sheet) return;
    S.sheet = null;
    S.arm = '';
    S.own = null;
    S.never = false;
    drawSheet();
  }

  function drawSheet() {
    var root = $('trainRoot');
    if (!root) return;
    var sh = S.sheet;
    if (!sh) { if (root.innerHTML) root.innerHTML = ''; return; }
    var body = '';
    if (sh.k === 'pick') body = pickHTML(sh);
    else if (sh.k === 'ex') body = exSheetHTML(sh);
    else if (sh.k === 'wo') body = woSheetHTML(sh);
    else if (sh.k === 'plates') body = platesHTML(sh);
    else if (sh.k === 'warm') body = warmHTML(sh);
    else if (sh.k === 'finish') body = finishHTML(sh);
    else if (sh.k === 'plan') body = planSheetHTML(sh);
    else if (sh.k === 'set') body = settingsHTML();
    else if (sh.k === 'axnew') body = axNewHTML(sh);
    else if (sh.k === 'ax') body = axSheetHTML(sh);
    root.innerHTML = '<div class="scrim no-print" data-t="close">' +
      '<div class="sheet tr-sheet" role="dialog" aria-modal="true" aria-label="' + esc(sh.title || 'Train') + '">' +
        '<div class="sheet-top"><div class="sheet-eyebrow">' + esc(sh.eyebrow || '') + '</div>' +
          '<button class="sheet-x" data-t="close" aria-label="Close">&times;</button></div>' +
        body +
      '</div></div>';
  }

  function pickHTML(sh) {
    var q = S.q.toLowerCase().trim();
    var list = allEx().filter(function (ex) {
      if (S.qm && ex.m !== S.qm) return false;
      if (q && ex.n.toLowerCase().indexOf(q) < 0 && mname(ex.m).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) {
      /* What your back has ruled out sinks to the foot of its muscle rather
         than vanishing: it is still yours to choose, it just says why not. */
      return MUSCLES.indexOf(MUS[a.m]) - MUSCLES.indexOf(MUS[b.m]) ||
        (barred(a, T.pr) ? 1 : 0) - (barred(b, T.pr) ? 1 : 0) || a.o - b.o;
    });
    var own = S.own;
    var old = (sh.mode === 'swap' && LIVE && LIVE.x[sh.x]) ? LIVE.x[sh.x].e
      : (sh.mode === 'dswap' && S.draft) ? S.draft.days[sh.d].s[sh.i].e : '';
    return '<div class="sheet-name tr-sn2">' + esc(sh.title) + '</div>' +
      (old ? '<div class="tr-chips tr-never"><button class="tr-chip" data-t="never" aria-pressed="' + !!S.never + '">' +
        'Never suggest ' + esc(lib(old).n) + ' again</button></div>' : '') +
      '<input class="txt tr-search" id="trPickQ" type="search" placeholder="Search exercises" value="' + esc(S.q) + '" aria-label="Search exercises">' +
      chips('pickm', S.qm, [['', 'All']].concat(MUSCLES.map(function (m) { return [m.k, m.n]; }))) +
      '<div class="tr-picks">' + (list.length ? list.map(function (ex) {
        var warn = T.pr.avoid.indexOf(ex.id) >= 0 ? 'on your never list'
          : barred(ex, { bk: T.pr.bk }) ? 'loads your back' : backCue(ex) ? 'some back load' : '';
        return '<button class="tr-pick" data-t="pickex" data-e="' + esc(ex.id) + '">' +
          '<span class="tr-pk-n">' + esc(ex.n) + (warn ? ' <span class="tr-pk-w">' + warn + '</span>' : '') + '</span>' +
          '<span class="tr-pk-m">' + esc(mname(ex.m)) + ' \u00b7 ' + esc(EQUIP[ex.q] || '') + (ex.own ? ' \u00b7 yours' : '') + '</span></button>';
      }).join('') : '<div class="tr-note">Nothing by that name.</div>') + '</div>' +
      (own
        ? '<div class="tr-own"><div class="tr-ql">Make your own</div>' +
            '<input class="txt" id="trOwnN" placeholder="Name" value="' + esc(own.n) + '" aria-label="Name">' +
            '<div class="tr-own-r">' +
              '<select id="trOwnM" aria-label="Muscle">' + MUSCLES.map(function (m) {
                return '<option value="' + m.k + '"' + (own.m === m.k ? ' selected' : '') + '>' + esc(m.n) + '</option>';
              }).join('') + '</select>' +
              '<select id="trOwnQ" aria-label="Equipment">' + Object.keys(EQUIP).map(function (k) {
                return '<option value="' + k + '"' + (own.q === k ? ' selected' : '') + '>' + esc(EQUIP[k]) + '</option>';
              }).join('') + '</select>' +
              '<select id="trOwnK" aria-label="Kind">' +
                '<option value="c"' + (own.k === 'c' ? ' selected' : '') + '>Compound</option>' +
                '<option value="i"' + (own.k !== 'c' ? ' selected' : '') + '>Isolation</option></select>' +
            '</div>' +
            '<div class="tr-acts"><button class="btn-primary" data-t="ownsave">Add it</button></div></div>'
        : '<div class="tr-acts"><button class="ghost" data-t="own">Not here? Make your own</button></div>');
  }

  function sessionsOf(e) {
    var out = [];
    ix().list.forEach(function (wo) {
      var x = exIn(wo, e);
      if (x && x.s.length) out.push({ wo: wo, x: x });
    });
    return out;
  }

  function exSheetHTML(sh) {
    var e = sh.e, ex = lib(e);
    var ss = sessionsOf(e);
    var r = records(e);
    var byReps = !(r.e1 > 0);
    var series = ss.map(function (s) {
      return { t: s.wo.st, v: byReps ? Math.max.apply(null, s.x.s.map(function (z) { return z.r; })) : bestE1(s.x.s, s.wo.u) };
    });
    var html = '<div class="sheet-name tr-sn2">' + esc(ex.n) + '</div>' +
      '<div class="tr-sub">' + esc(mname(ex.m)) + ' · ' + esc(EQUIP[ex.q] || '') + ' · ' +
        ex.rr[0] + '–' + ex.rr[1] + ' reps</div>';
    if (!ss.length) return html + '<div class="tr-note">Not logged yet. Records and a chart appear after the first session.</div>';
    html += '<div class="tr-recs">' +
      rec('Best e1RM', r.e1 > 0 ? fmtN(Math.round(r.e1)) + ' ' + T.pr.u : '—') +
      rec('Heaviest', r.w > 0 ? fmtN(r.w) + ' ' + T.pr.u : '—') +
      rec('Most reps', r.r) +
      rec('Best set', r.vol > 0 ? fmtBig(r.vol) + ' ' + T.pr.u : '—') +
    '</div>';
    html += '<div class="tr-ql tr-chart-h">' + (byReps ? 'Best set, in reps' : 'Estimated one-rep max') + ' · per session</div>';
    html += series.length >= 2 ? chartSVG(series, byReps)
      : '<div class="tr-note">Two sessions and this draws.</div>';
    html += '<div class="tr-ql tr-chart-h">Sessions</div><ol class="tr-sess">' + ss.slice().reverse().slice(0, 20).map(function (s) {
      return '<li><span class="tr-ss-d">' + when(s.wo.st) + '</span><span class="tr-ss-s">' + s.x.s.map(function (z) {
        return (conv(z.w, s.wo.u) > 0 ? fmtN(conv(z.w, s.wo.u)) + ' × ' : '') + z.r;
      }).join(', ') + '</span></li>';
    }).join('') + '</ol>';
    return html;
  }
  function rec(l, v) { return '<div class="tr-rec"><span class="tr-rec-l">' + l + '</span><span class="tr-rec-v">' + v + '</span></div>'; }

  /* One line, one colour, the same drawing as My Day's weight chart so the two
     read as one app: ink line, hairline grid, three rounded ticks, the first
     and last dates under it, a title on every point for the value. */
  function chartSVG(series, byReps) {
    var W = 600, H = 190, PL = 44, PR = 10, PT = 12, PB = 22;
    var vals = series.map(function (s) { return s.v; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi - lo < 1) { hi += 1; lo -= 1; }
    var pad = (hi - lo) * 0.12; lo = Math.max(0, lo - pad); hi += pad;
    var px = function (i) { return PL + i * (W - PL - PR) / Math.max(1, series.length - 1); };
    var py = function (v) { return PT + (H - PT - PB) * (1 - (v - lo) / (hi - lo)); };
    var out = [];
    [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1].forEach(function (v) {
      out.push('<line x1="' + PL + '" x2="' + (W - PR) + '" y1="' + py(v).toFixed(1) + '" y2="' + py(v).toFixed(1) + '" class="mc-grid"/>');
      out.push('<text x="' + (PL - 6) + '" y="' + (py(v) + 3.5).toFixed(1) + '" text-anchor="end" class="mc-ax">' + Math.round(v) + '</text>');
    });
    out.push('<polyline class="mc-line tr-line" points="' + series.map(function (s, i) {
      return px(i).toFixed(1) + ',' + py(s.v).toFixed(1);
    }).join(' ') + '"/>');
    series.forEach(function (s, i) {
      out.push('<circle cx="' + px(i).toFixed(1) + '" cy="' + py(s.v).toFixed(1) + '" r="4" class="tr-dot"><title>' +
        esc(when(s.t)) + ' · ' + (byReps ? s.v + ' reps' : Math.round(s.v) + ' ' + T.pr.u) + '</title></circle>');
    });
    var last = series[series.length - 1];
    out.push('<text x="' + (px(series.length - 1) - 8).toFixed(1) + '" y="' + (py(last.v) - 9).toFixed(1) +
      '" text-anchor="end" class="mc-ax tr-end">' + (byReps ? last.v : Math.round(last.v)) + '</text>');
    [0, series.length - 1].forEach(function (i) {
      out.push('<text x="' + px(i).toFixed(1) + '" y="' + (H - 5) + '" text-anchor="' + (i ? 'end' : 'start') +
        '" class="mc-ax">' + esc(shortDate(series[i].t)) + '</text>');
    });
    return '<svg class="mc-svg tr-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
      esc((byReps ? 'Best reps' : 'Estimated one-rep max') + ' over ' + series.length + ' sessions, from ' +
        Math.round(series[0].v) + ' to ' + Math.round(last.v)) + '">' + out.join('') + '</svg>';
  }

  function woSheetHTML(sh) {
    var wo = T.wo[sh.id];
    if (!wo) return '<div class="tr-note">That workout has gone.</div>';
    var prs = prsIn(wo);
    var armed = S.arm === 'del:' + wo.id;
    return '<div class="sheet-name tr-sn2">' + esc(wo.n) + '</div>' +
      '<div class="tr-sub">' + when(wo.st) + ' · ' + dur((wo.en || wo.st) - wo.st) + ' · ' + setsOf(wo) + ' sets · ' +
        fmtBig(volOf(wo)) + ' ' + T.pr.u + '</div>' +
      (prs.length ? '<div class="tr-prs">' + prs.map(function (p) {
        return '<div>★ ' + esc(lib(p.e).n) + ' — ' + esc(p.what) + '</div>';
      }).join('') + '</div>' : '') +
      wo.x.map(function (x) {
        return '<div class="tr-wx"><button class="tr-lnk tr-wx-n" data-t="exsheet" data-e="' + esc(x.e) + '">' + esc(lib(x.e).n) + '</button>' +
          '<ol class="tr-wx-s">' + x.s.map(function (s) {
            var w = conv(s.w, wo.u);
            return '<li>' + (w > 0 ? fmtN(w) + ' ' + T.pr.u + ' × ' : '') + s.r +
              (e1rm(w, s.r) > 0 ? ' <span class="tr-e1">e1RM ' + Math.round(e1rm(w, s.r)) + '</span>' : '') + '</li>';
          }).join('') + '</ol></div>';
      }).join('') +
      '<div class="tr-acts"><button class="ghost danger" data-t="delwo" data-id="' + esc(wo.id) + '">' +
        (armed ? 'Tap again to delete for good' : 'Delete this workout') + '</button></div>';
  }

  /* Plates for one side of the bar, heaviest first. Whatever cannot be made
     from the plates there are is said, rather than rounded away. */
  function plateMath(total, bar, unit) {
    var set = unit === 'kg' ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5];
    var side = (total - bar) / 2;
    var out = [];
    if (!(side > 0)) return { plates: out, left: 0, under: total < bar };
    var left = side;
    set.forEach(function (p) {
      while (left >= p - 1e-9) { out.push(p); left = Math.round((left - p) * 1000) / 1000; }
    });
    return { plates: out, left: left, under: false };
  }

  function platesHTML(sh) {
    var w = numIn(sh.w);
    var pm = w === null ? null : plateMath(w, T.pr.bar, T.pr.u);
    return '<div class="sheet-name tr-sn2">Plates</div>' +
      '<div class="tr-own-r"><input class="txt" id="trPlateW" inputmode="decimal" value="' + esc(w === null ? '' : fmtN(w)) + '" aria-label="Total weight">' +
        '<span class="tr-sub">' + T.pr.u + ' on a ' + fmtN(T.pr.bar) + ' ' + T.pr.u + ' bar</span></div>' +
      (pm === null ? '<div class="tr-note">Type the total weight.</div>'
        : pm.under ? '<div class="tr-note">That is less than the bar.</div>'
          : '<div class="tr-plates">' + (pm.plates.length ? pm.plates.map(function (p) {
            return '<span class="tr-plate p' + String(p).replace('.', '_') + '">' + fmtN(p) + '</span>';
          }).join('') : '<span class="tr-note">Just the bar.</span>') + '</div>' +
            '<div class="tr-sub">Each side' + (pm.left > 0 ? ' — ' + fmtN(pm.left * 2) + ' ' + T.pr.u + ' short with standard plates' : '') + '.</div>');
  }

  /* A warm-up that rehearses the lift without tiring it: half the working
     weight for eight, then fewer reps as it climbs. None of these count as
     sets; they are not logged. */
  function warmHTML(sh) {
    var x = LIVE && LIVE.x[sh.x];
    if (!x) return '';
    var ex = lib(x.e);
    var s0 = x.s[0] || {};
    var w = numIn(s0.w);
    if (w === null) w = fin(s0.tw) ? s0.tw : fin(s0.pw) ? s0.pw : null;
    if (!(w > 0)) return '<div class="sheet-name tr-sn2">Warm-up</div><div class="tr-note">Put a weight in the first set and the ramp works itself out from it.</div>';
    var step = inc(ex);
    var bb = ex.q === 'bb' || ex.q === 'sm';
    var rows = [];
    if (bb && T.pr.bar < w * 0.5) rows.push([T.pr.bar, 10]);
    [[0.5, 8], [0.7, 4], [0.85, 2]].forEach(function (r) {
      var v = roundTo(w * r[0], step);
      if (bb && v < T.pr.bar) return;
      if (rows.length && v <= rows[rows.length - 1][0]) return;
      rows.push([v, r[1]]);
    });
    return '<div class="sheet-name tr-sn2">Warm-up for ' + esc(ex.n) + '</div>' +
      '<div class="tr-sub">Working weight ' + fmtN(w) + ' ' + T.pr.u + '. These are not logged.</div>' +
      '<ol class="tr-warm">' + rows.map(function (r) {
        var pm = bb ? plateMath(r[0], T.pr.bar, T.pr.u) : null;
        return '<li><b>' + fmtN(r[0]) + ' ' + T.pr.u + ' × ' + r[1] + '</b>' +
          (pm ? '<span class="tr-sub"> ' + (pm.plates.length ? pm.plates.map(fmtN).join(' + ') + ' a side' : 'the bar') + '</span>' : '') + '</li>';
      }).join('') + '</ol>';
  }

  function finishHTML() {
    if (!LIVE) return '';
    var wo = finished();
    var open = LIVE.x.reduce(function (n, x) { return n + x.s.filter(function (s) { return !s.t; }).length; }, 0);
    var prs = prsIn(wo);
    var missing = [];
    if (LIVE.ms) {
      uniq(wo.x.map(function (x) { return musOf(x.e); })).forEach(function (m) {
        var f = LIVE.fb[m] || {};
        if ((!LIVE.keep && !fin(f.p)) || !fin(f.k)) missing.push(m);
      });
    }
    if (!wo.x.length) {
      return '<div class="sheet-name tr-sn2">Nothing ticked yet</div>' +
        '<div class="tr-note">Only ticked sets are saved, and there are none. Keep going, or discard the workout.</div>' +
        '<div class="tr-acts"><button class="btn-primary" data-t="close">Keep going</button>' +
          '<button class="ghost danger" data-t="discardnow">' + (S.arm === 'discard' ? 'Tap again to discard' : 'Discard it') + '</button></div>';
    }
    return '<div class="sheet-name tr-sn2">' + esc(LIVE.n) + '</div>' +
      '<div class="tr-recs">' +
        rec('Time', dur(Date.now() - LIVE.st)) + rec('Sets', setsOf(wo)) +
        rec('Volume', fmtBig(volOf(wo)) + ' ' + T.pr.u) + rec('Records', prs.length) +
      '</div>' +
      (prs.length ? '<div class="tr-prs">' + prs.map(function (p) {
        return '<div>★ ' + esc(lib(p.e).n) + ' — ' + esc(p.what) + '</div>';
      }).join('') + '</div>' : '') +
      (open ? '<div class="tr-note">' + open + ' set' + (open === 1 ? ' was' : 's were') + ' never ticked and will not be saved.</div>' : '') +
      (missing.length ? '<div class="tr-ask"><div class="tr-ql">Before you go — next week’s sets come from these</div>' +
        missing.map(function (m) {
          var f = LIVE.fb[m] || {};
          return (LIVE.keep ? '' : '<div class="tr-fbrow"><span class="tr-fbm">' + esc(mname(m)) + ' pump</span>' +
              chips('fb', fin(f.p) ? f.p : '', PUMP.map(function (t, i) { return [i, t]; }), ' data-m="' + m + '" data-f="p"') + '</div>') +
            '<div class="tr-fbrow"><span class="tr-fbm">' + esc(mname(m)) + ' workload</span>' +
              chips('fb', fin(f.k) ? f.k : '', WORK.map(function (t, i) { return [i, t]; }), ' data-m="' + m + '" data-f="k"') + '</div>';
        }).join('') + '</div>' : '') +
      '<div class="tr-note">Saving marks ' + (wo.dk === dayKey(new Date()) ? 'today' : 'that day') + ' as a training day in My Day.</div>' +
      '<div class="tr-acts"><button class="btn-primary" data-t="save">Save workout</button>' +
        '<button class="ghost" data-t="close">Keep going</button></div>';
  }

  function planSheetHTML(sh) {
    var ms = active();
    if (!ms || !ms.days[sh.d]) return '';
    var p = plan(ms, sh.w, sh.d);
    var wo = woFor(ms, sh.w, sh.d);
    return '<div class="sheet-name tr-sn2">' + esc(p.n) + '</div>' +
      '<div class="tr-sub">' + (p.deload ? 'Deload week' : 'Week ' + (sh.w + 1) + ' · ' + p.rir + ' RIR') +
        (wo ? ' · done ' + when(wo.st) : '') + '</div>' +
      planList(p) +
      '<div class="tr-acts">' +
        (wo ? '<button class="ghost" data-t="wosheet" data-id="' + esc(wo.id) + '">See what you did</button>' : '') +
        (!LIVE ? '<button class="btn-primary" data-t="start" data-w="' + sh.w + '" data-d="' + sh.d + '">' + (wo ? 'Do it again' : 'Start this one') + '</button>' : '') +
      '</div>';
  }

  var AGO = [[0, 'Today'], [1, 'Yesterday'], [2, '2 days ago'], [3, '3 days ago']];
  function axNewHTML(sh) {
    var h = HABITS[sh.h];
    var opts = [15, 30, 45, 60, 90, 120, 180, 240, 300].map(function (m) { return [m, m < 60 ? m + ' min' : dur(m * 60000)]; });
    return '<div class="sheet-name tr-sn2">' + esc(h.n) + '</div>' +
      q('How long', chips('axmin', sh.min, opts)) +
      q('When', chips('axago', sh.ago, AGO)) +
      '<div class="tr-acts"><button class="btn-primary" data-t="axsave">Log it</button></div>';
  }
  function axSheetHTML(sh) {
    var a = T.ax[sh.id];
    if (!a) return '<div class="tr-note">That has gone.</div>';
    return '<div class="sheet-name tr-sn2">' + esc(HABITS[a.k].n) + '</div>' +
      '<div class="tr-sub">' + when(a.st) + ' \u00b7 ' + dur(a.min * 60000) + '</div>' +
      '<div class="tr-acts"><button class="ghost danger" data-t="axdel" data-id="' + esc(a.id) + '">' +
        (S.arm === 'axdel:' + a.id ? 'Tap again to delete' : 'Delete') + '</button></div>';
  }

  function jsonSize() {
    try { return JSON.stringify(payload(true) || {}).length; } catch (e) { return 0; }
  }

  function settingsHTML() {
    var p = T.pr;
    var kb = Math.round(jsonSize() / 1024);
    /* You first: what the next block is built around, and what the review
       reads your week against. A block already running keeps what it was
       built with; these shape the next one. */
    return '<div class="sheet-name tr-sn2">Train settings</div>' +
      q('Training for', chips('s-goal', p.goal, [['keep', 'Keep my strength'], ['grow', 'Build muscle']])) +
      q('Time per session', chips('s-min', p.min, [[30, '30 min'], [40, '40 min'], [60, '60 min'], [0, 'No limit']]),
        'Used for your next block.') +
      q('Protect my back from', chips('s-bk', p.bk.split(''), TRIG),
        p.bk ? 'Your next block leaves out lifts that load your back that way.' : 'Off.') +
      q('Outside the gym', chips('s-hab', p.hab, Object.keys(HABITS).map(function (k) { return [k, HABITS[k].n]; }))) +
      q('Never suggest', p.avoid.length ? '<div class="tr-chips">' + p.avoid.map(function (e) {
        return '<button class="tr-chip on" data-t="s-unavoid" data-v="' + esc(e) + '" aria-label="Allow ' + esc(lib(e).n) + ' again">' +
          esc(lib(e).n) + ' &times;</button>';
      }).join('') + '</div>' : '<div class="tr-sub">Nothing yet. When you swap an exercise out, you can say never again.</div>') +
      '<div class="tr-q"><div class="tr-ql">Weights in</div>' + chips('s-u', p.u, [['lb', 'Pounds'], ['kg', 'Kilograms']]) + '</div>' +
      '<div class="tr-q"><div class="tr-ql">Bar</div>' +
        chips('s-bar', p.bar, p.u === 'kg' ? [[20, '20 kg'], [15, '15 kg'], [10, '10 kg']] : [[45, '45 lb'], [35, '35 lb'], [25, '25 lb']]) + '</div>' +
      '<div class="tr-q"><div class="tr-ql">Rest on compound lifts</div>' +
        chips('s-rc', p.rc, [[90, '1:30'], [120, '2:00'], [150, '2:30'], [180, '3:00'], [240, '4:00']]) + '</div>' +
      '<div class="tr-q"><div class="tr-ql">Rest on isolation work</div>' +
        chips('s-ri', p.ri, [[60, '1:00'], [75, '1:15'], [90, '1:30'], [120, '2:00']]) + '</div>' +
      '<div class="tr-q"><div class="tr-ql">Rest between paired sets</div>' +
        chips('s-rp', p.rp, [[45, '0:45'], [60, '1:00'], [75, '1:15'], [90, '1:30']]) + '</div>' +
      '<div class="tr-q"><div class="tr-ql">When rest is up</div>' + chips('s-snd', p.snd, [[1, 'Beep and buzz'], [0, 'Buzz only']]) + '</div>' +
      '<div class="tr-q"><div class="tr-ql">Your training data</div>' +
        '<div class="tr-sub">Kept on this device. Sign in under My Day → ⚙ → Sync &amp; sharing and it travels with your account, the same as your day.</div>' +
        '<div class="tr-sub">' + Object.keys(T.wo).length + ' workouts · about ' + kb + ' KB' +
          (kb > 600 ? ' — getting close to the 1 MB an account record can hold. Export a copy, then delete old workouts.' : '') + '</div>' +
        '<div class="tr-acts"><button class="ghost" data-t="export">Export a copy</button>' +
          '<label class="ghost tr-file">Restore from a copy<input type="file" id="trImport" accept="application/json,.json" hidden></label></div>' +
        (S.imp ? '<div class="tr-note">That file holds ' + Object.keys(S.imp.wo).length + ' workouts and ' +
          Object.keys(S.imp.ms).length + ' blocks. Restoring replaces everything in Train on this device and in your account.</div>' +
          '<div class="tr-acts"><button class="btn-primary danger" data-t="impgo">Replace with the copy</button></div>' : '') +
        (S.impErr ? '<div class="tr-note">' + esc(S.impErr) + '</div>' : '') +
      '</div>';
  }

  /* ---------------------------------------------------------------- actions */
  function toggleIn(list, v) {
    var out = list.slice(), at = out.indexOf(v);
    if (at >= 0) out.splice(at, 1); else out.push(v);
    return out;
  }

  function setSub(v) {
    S.sub = v;
    try { localStorage.setItem(LS_SUB, v); } catch (e) { /* private mode */ }
    draw();
  }

  function editBlock(ms) {
    T.ms[ms.id] = clean(ms);
    stamp('ms', ms.id);
  }

  function beginDraft() {
    var ms = clean(S.draft);
    ms.at = Date.now();
    ms.st = dayKey(new Date());
    T.ms[ms.id] = ms;
    T.act = ms.id;
    stamp('ms', ms.id);
    stamp('act');
    S.draft = null;
    draw();
  }

  function onPick(e) {
    var sh = S.sheet;
    if (!sh) return;
    /* Never again: onto the list, so no future block suggests it — and out
       of every day of this one, not just the one it was swapped on. */
    var gone = sh.mode === 'swap' && LIVE && LIVE.x[sh.x] ? LIVE.x[sh.x].e
      : sh.mode === 'dswap' && S.draft ? S.draft.days[sh.d].s[sh.i].e : '';
    if (S.never && gone && gone !== e && T.pr.avoid.indexOf(gone) < 0) {
      T.pr.avoid = T.pr.avoid.concat(gone);
      stamp('pr');
    }
    var everywhere = !!(S.never && gone);
    if (sh.mode === 'add' && LIVE) {
      LIVE.x.push(liveEx(e, 3));
      saveLive();
    } else if (sh.mode === 'swap' && LIVE && LIVE.x[sh.x]) {
      var old = LIVE.x[sh.x];
      var nx = liveEx(e, old.s.length);
      nx.rir = old.rir;
      nx.p = old.p || 0;
      // what was already done stays done, under the new name
      old.s.forEach(function (s, j) { if (s.t && nx.s[j]) nx.s[j] = s; });
      LIVE.x[sh.x] = nx;
      /* In a block, a swap is a swap for the rest of the block: the reason
         to swap is almost always the exercise, not the day. */
      if (LIVE.ms && T.ms[LIVE.ms]) {
        var ms = clean(T.ms[LIVE.ms]);
        var slot = ms.days[LIVE.d] && ms.days[LIVE.d].s.filter(function (s) { return s.e === old.e; })[0];
        if (slot) slot.e = e;
        if (everywhere) ms.days.forEach(function (d) { d.s.forEach(function (s) { if (s.e === old.e) s.e = e; }); });
        if (slot || everywhere) editBlock(ms);
      }
      saveLive();
    } else if (sh.mode === 'dswap' && S.draft) {
      S.draft.days[sh.d].s[sh.i].e = e;
      if (everywhere) S.draft.days.forEach(function (d) { d.s.forEach(function (s) { if (s.e === gone) s.e = e; }); });
    } else if (sh.mode === 'dadd' && S.draft) {
      S.draft.days[sh.d].s.push({ e: e, n: 2 });
    }
    closeSheet();
    draw();
  }

  function exportCopy() {
    var blob = new Blob([JSON.stringify({ app: 'hive-train', v: 1, at: Date.now(), train: T }, null, 1)],
      { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'train-' + dayKey(new Date()) + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function readImport(file) {
    var fr = new FileReader();
    fr.onload = function () {
      S.imp = null; S.impErr = '';
      try {
        var d = JSON.parse(fr.result);
        var t = d && d.train;
        if (!plain(t) || !plain(t.wo) || !plain(t.ms)) throw new Error('shape');
        var n = blankT();
        n.pr = defaultsPr(t.pr);
        n.act = typeof t.act === 'string' ? t.act : '';
        PARTS.forEach(function (p) {
          Object.keys(t[p] || {}).forEach(function (k) {
            if (/^[a-z0-9]+$/i.test(k) && t[p][k] && SHAPE[p](t[p][k])) n[p][k] = t[p][k];
          });
        });
        S.imp = n;
      } catch (e) {
        S.impErr = 'That file is not a copy exported from Train.';
      }
      drawSheet();
    };
    fr.readAsText(file);
  }

  /* A restore wins everywhere: every piece is stamped now, and anything this
     device knew of that the copy does not have is stamped gone, so the other
     device follows rather than resurrecting it. */
  function applyImport() {
    var n = S.imp;
    if (!n) return;
    var now = Date.now();
    PARTS.forEach(function (p) {
      Object.keys(T[p]).concat(Object.keys(TS[p])).forEach(function (k) { TS[p][k] = now; });
      Object.keys(n[p]).forEach(function (k) { TS[p][k] = now; });
    });
    TS.pr = now; TS.act = now;
    T = n;
    S.imp = null;
    dirtyAll = true;
    saveT();
    push(true);
    closeSheet();
    draw();
  }

  function act(el) {
    var t = el.getAttribute('data-t');
    var v = el.getAttribute('data-v');
    var num = function (a) { return Number(el.getAttribute(a)); };
    var ms;

    if (t !== 'save') S.justSaved = '';
    if (t === 'close') { closeSheet(); return; }
    if (t === 'sub') { setSub(v); return; }
    if (t === 'ref') {
      var box = $('trRefs'), dt = $('tr-ref-' + v);
      if (box) box.open = true;
      if (dt) {
        dt.scrollIntoView({ block: 'center' });
        dt.classList.add('tr-hl');
        setTimeout(function () { dt.classList.remove('tr-hl'); }, 1600);
      }
      return;
    }
    if (t === 'settings') { S.imp = null; S.impErr = ''; openSheet({ k: 'set', eyebrow: 'Train', title: 'Settings' }); return; }

    // the generator
    var g = gen();
    if (t === 'g-goal') {
      g.goal = v === 'keep' ? 'keep' : 'grow';
      // each goal has its own sensible days and length
      if (g.goal === 'keep') { g.dpw = Math.min(3, Math.max(2, g.dpw)); g.acc = 8; } else { g.acc = 4; }
      draw(); return;
    }
    if (t === 'g-dpw') { g.dpw = Number(v); draw(); return; }
    if (t === 'g-min') { g.min = Number(v); draw(); return; }
    if (t === 'g-kit') { g.kit = v; draw(); return; }
    if (t === 'g-lvl') { g.lvl = Number(v); draw(); return; }
    if (t === 'g-acc') { g.acc = Number(v); draw(); return; }
    if (t === 'g-bk') { g.bk = toggleIn(g.bk.split(''), v).sort().join(''); draw(); return; }
    if (t === 'g-hab') { g.hab = toggleIn(g.hab, v); draw(); return; }
    if (t === 'g-pri') {
      var pri = g.pri, at = pri.indexOf(v);
      if (at >= 0) pri.splice(at, 1);
      else { pri.push(v); if (pri.length > 3) pri.shift(); }
      draw(); return;
    }
    if (t === 'build') {
      /* What you said about yourself outlives this block: the next one, the
         review and the logger's back check all read it from here. */
      T.pr.goal = g.goal; T.pr.min = g.min; T.pr.bk = g.bk; T.pr.hab = g.hab.slice();
      stamp('pr');
      g.seed = 0;
      S.draft = build(Object.assign({ avoid: T.pr.avoid }, g));
      draw(); scrollTop(); return;
    }
    if (t === 'shuffle') {
      g.seed = (g.seed || 0) + 1;
      var keepId = S.draft.id;
      S.draft = build(Object.assign({ avoid: T.pr.avoid }, g));
      S.draft.id = keepId;
      draw(); return;
    }
    if (t === 'undraft') { S.draft = null; draw(); return; }
    if (t === 'begin') { beginDraft(); return; }
    if (t === 'dset') {
      var sl = S.draft.days[num('data-d')].s[num('data-i')];
      sl.n = Math.max(1, Math.min(6, sl.n + Number(v)));
      draw(); return;
    }
    if (t === 'ddel') { S.draft.days[num('data-d')].s.splice(num('data-i'), 1); draw(); return; }
    if (t === 'dswap') {
      var cur = lib(S.draft.days[num('data-d')].s[num('data-i')].e);
      S.q = ''; S.qm = cur.m;
      openSheet({ k: 'pick', mode: 'dswap', d: num('data-d'), i: num('data-i'), eyebrow: 'Swap', title: 'Swap ' + cur.n });
      return;
    }
    if (t === 'dadd') {
      S.q = ''; S.qm = '';
      openSheet({ k: 'pick', mode: 'dadd', d: num('data-d'), eyebrow: 'Add', title: 'Add to ' + S.draft.days[num('data-d')].n });
      return;
    }
    if (t === 'again') {
      ms = active();
      if (ms) {
        var wasKeep = isKeep(ms);
        S.gen = {
          goal: wasKeep ? 'keep' : 'grow',
          dpw: wasKeep ? Math.min(3, Math.max(2, ms.dpw || 2)) : SPLITS[ms.dpw] ? ms.dpw : Math.min(6, Math.max(2, ms.days.length)),
          kit: KITS[ms.kit] ? ms.kit : 'gym',
          lvl: [0, 1, 2].indexOf(ms.lvl) >= 0 ? ms.lvl : 1,
          acc: wasKeep ? ([6, 8, 10].indexOf(ms.acc) >= 0 ? ms.acc : 8) : Math.min(6, Math.max(3, ms.acc)),
          pri: (Array.isArray(ms.pri) ? ms.pri : []).filter(function (m) { return MUS[m]; }).slice(0, 3),
          min: T.pr.min, bk: T.pr.bk, hab: T.pr.hab.slice(),
          // a fresh set of exercises, so the next block is not the last one again
          seed: (ms.seed || 0) + 1
        };
      }
      T.act = '';
      stamp('act');
      draw(); return;
    }

    // the block
    if (t === 'start') {
      ms = active();
      if (!ms) return;
      if (S.sheet) closeSheet();
      startPlanned(ms, num('data-w'), num('data-d'));
      return;
    }
    if (t === 'empty') { startEmpty(); return; }
    if (t === 'plansheet') {
      ms = active();
      openSheet({ k: 'plan', w: num('data-w'), d: num('data-d'), eyebrow: ms ? ms.n : '', title: 'Session' });
      return;
    }
    if (t === 'skip') {
      ms = clean(active());
      ms.sk = (ms.sk || []).concat(num('data-w') + ':' + num('data-d'));
      editBlock(ms);
      draw(); return;
    }
    if (t === 'deloadnow' || t === 'endblock') {
      var h = hive();
      var go = function () {
        ms = active();
        if (!ms) return;
        if (t === 'deloadnow') {
          var nx = nextSlot(ms);
          var c = clean(ms);
          c.dlw = nx ? nx.w : c.acc;
          editBlock(c);
        } else {
          T.act = '';
          stamp('act');
        }
        draw();
      };
      var q = t === 'deloadnow'
        ? { title: 'Deload from this week?', body: 'The rest of this week becomes the deload: half the sets, lighter, well short of failure. Worth it when the lifts are sliding or everything aches.', ok: 'Deload now' }
        : { title: 'End this block?', body: 'Its workouts stay in History and Lifts. You can build a new block straight away.', ok: 'End it', danger: true };
      if (h && h.ask) h.ask(q, function (yes) { if (yes) go(); });
      else if (window.confirm(q.title)) go();
      return;
    }

    // the logger
    if (t === 'tick') { tick(num('data-x'), num('data-s')); return; }
    if (t === 'rest') {
      if (!LIVE || !LIVE.rs) return;
      if (v === 'skip') LIVE.rs = null;
      else { LIVE.rs.end += Number(v) * 1000; LIVE.rs.dur = Math.max(1, LIVE.rs.dur + Number(v)); }
      saveLive(); drawRest(); return;
    }
    if (t === 'addset') {
      var xa = LIVE.x[num('data-x')];
      var ls = xa.s[xa.s.length - 1] || {};
      xa.s.push({ w: '', r: '', t: 0, tw: ls.tw, tr: ls.tr, pw: ls.pw, pr: ls.pr });
      saveLive(); draw(); return;
    }
    if (t === 'dropset') {
      var xd = LIVE.x[num('data-x')];
      for (var k = xd.s.length - 1; k >= 0; k--) { if (!xd.s[k].t) { xd.s.splice(k, 1); break; } }
      saveLive(); draw(); return;
    }
    if (t === 'rmex') { LIVE.x.splice(num('data-x'), 1); saveLive(); draw(); return; }
    if (t === 'swap') {
      var cx = lib(LIVE.x[num('data-x')].e);
      S.q = ''; S.qm = cx.m;
      openSheet({ k: 'pick', mode: 'swap', x: num('data-x'), eyebrow: 'Swap', title: 'Swap ' + cx.n });
      return;
    }
    if (t === 'addex') { S.q = ''; S.qm = ''; openSheet({ k: 'pick', mode: 'add', eyebrow: 'Add', title: 'Add an exercise' }); return; }
    if (t === 'warm') { openSheet({ k: 'warm', x: num('data-x'), eyebrow: 'Warm-up', title: 'Warm-up' }); return; }
    if (t === 'plates') {
      var px = LIVE.x[num('data-x')];
      var open = px.s.filter(function (s) { return !s.t; })[0] || px.s[0];
      var pw = numIn(open.w);
      if (pw === null) pw = fin(open.tw) ? open.tw : fin(open.pw) ? open.pw : null;
      openSheet({ k: 'plates', w: pw, eyebrow: 'Plate calculator', title: 'Plates' });
      return;
    }
    if (t === 'bk') {
      LIVE.bk = LIVE.bk === Number(v) ? undefined : Number(v);
      if (LIVE.bk === undefined) delete LIVE.bk;
      saveLive(); draw(); return;
    }
    if (t === 'sore') {
      var m = el.getAttribute('data-m');
      if (LIVE.sr[m] === Number(v)) delete LIVE.sr[m]; else LIVE.sr[m] = Number(v);
      saveLive(); draw(); return;
    }
    if (t === 'fb') {
      var fm = el.getAttribute('data-m'), ff = el.getAttribute('data-f');
      var f = LIVE.fb[fm] = LIVE.fb[fm] || {};
      if (f[ff] === Number(v)) delete f[ff]; else f[ff] = Number(v);
      saveLive();
      if (S.sheet && S.sheet.k === 'finish') drawSheet(); else draw();
      return;
    }
    if (t === 'finish') { openSheet({ k: 'finish', eyebrow: 'Finish', title: 'Finish workout' }); return; }
    if (t === 'save') {
      var wo = saveWorkout();
      closeSheet();
      if (wo) S.justSaved = wo.id;
      draw();
      return;
    }
    if (t === 'discard' || t === 'discardnow') {
      if (t === 'discardnow') {
        if (S.arm !== 'discard') { S.arm = 'discard'; drawSheet(); return; }
        setLive(null); stopWake(); closeSheet(); draw(); return;
      }
      var hh = hive();
      var drop = function () { setLive(null); stopWake(); draw(); };
      var qq = { title: 'Discard this workout?', body: 'Nothing from it is saved.', ok: 'Discard', danger: true };
      if (hh && hh.ask) hh.ask(qq, function (yes) { if (yes) drop(); });
      else if (window.confirm(qq.title)) drop();
      return;
    }

    // the picker
    if (t === 'never') { S.never = !S.never; drawSheet(); return; }
    if (t === 'pickm') { S.qm = v; drawSheet(); return; }
    if (t === 'pickex') { onPick(el.getAttribute('data-e')); return; }
    if (t === 'own') { S.own = { n: S.q, m: S.qm || 'chest', q: 'mc', k: 'i' }; drawSheet(); return; }
    if (t === 'ownsave') {
      var nm = ($('trOwnN').value || '').trim();
      if (!nm) { $('trOwnN').focus(); return; }
      var id = 'cx' + newId();
      T.cx[id] = { n: nm.slice(0, 60), m: $('trOwnM').value, q: $('trOwnQ').value, k: $('trOwnK').value };
      stamp('cx', id);
      S.own = null;
      onPick(id);
      return;
    }

    // the records
    if (t === 'exsheet') { openSheet({ k: 'ex', e: el.getAttribute('data-e'), eyebrow: 'Lift', title: lib(el.getAttribute('data-e')).n }); return; }
    if (t === 'wosheet') { openSheet({ k: 'wo', id: el.getAttribute('data-id'), eyebrow: 'Workout', title: 'Workout' }); return; }
    if (t === 'delwo') {
      var wid = el.getAttribute('data-id');
      if (S.arm !== 'del:' + wid) { S.arm = 'del:' + wid; drawSheet(); return; }
      delete T.wo[wid];
      stamp('wo', wid);
      closeSheet();
      draw();
      return;
    }

    // outside the gym
    if (t === 'axnew') {
      openSheet({ k: 'axnew', h: v, min: HABITS[v].min, ago: 0, eyebrow: 'Outside the gym', title: 'Log ' + HABITS[v].n });
      return;
    }
    if (t === 'axmin' && S.sheet) { S.sheet.min = Number(v); drawSheet(); return; }
    if (t === 'axago' && S.sheet) { S.sheet.ago = Number(v); drawSheet(); return; }
    if (t === 'axsave' && S.sheet) {
      var sh = S.sheet;
      // noon on the day, so "yesterday" never lands on the wrong side of midnight
      var day = new Date(); day.setDate(day.getDate() - sh.ago); day.setHours(12, 0, 0, 0);
      var at2 = sh.ago ? day.getTime() : Date.now();
      var aid = newId();
      T.ax[aid] = { id: aid, st: at2, k: sh.h, min: sh.min };
      stamp('ax', aid);
      closeSheet();
      draw(); return;
    }
    if (t === 'axsheet') { openSheet({ k: 'ax', id: el.getAttribute('data-id'), eyebrow: 'Outside the gym', title: 'Activity' }); return; }
    if (t === 'axdel') {
      var xid = el.getAttribute('data-id');
      if (S.arm !== 'axdel:' + xid) { S.arm = 'axdel:' + xid; drawSheet(); return; }
      delete T.ax[xid];
      stamp('ax', xid);
      closeSheet();
      draw(); return;
    }

    // settings
    if (t === 's-goal') { T.pr.goal = v === 'keep' ? 'keep' : 'grow'; S.gen = null; stamp('pr'); drawSheet(); draw(); return; }
    if (t === 's-min') { T.pr.min = Number(v); S.gen = null; stamp('pr'); drawSheet(); draw(); return; }
    if (t === 's-bk') { T.pr.bk = toggleIn(T.pr.bk.split(''), v).sort().join(''); S.gen = null; stamp('pr'); drawSheet(); draw(); return; }
    if (t === 's-hab') { T.pr.hab = toggleIn(T.pr.hab, v); S.gen = null; stamp('pr'); drawSheet(); draw(); return; }
    if (t === 's-unavoid') { T.pr.avoid = T.pr.avoid.filter(function (x) { return x !== v; }); stamp('pr'); drawSheet(); return; }
    if (t === 's-rp') { T.pr.rp = Number(v); stamp('pr'); drawSheet(); return; }
    if (t === 's-u') {
      var was = T.pr.u;
      T.pr.u = v;
      if (v !== was) T.pr.bar = v === 'kg' ? 20 : 45;
      stamp('pr'); drawSheet(); draw(); return;
    }
    if (t === 's-bar') { T.pr.bar = Number(v); stamp('pr'); drawSheet(); return; }
    if (t === 's-rc') { T.pr.rc = Number(v); stamp('pr'); drawSheet(); return; }
    if (t === 's-ri') { T.pr.ri = Number(v); stamp('pr'); drawSheet(); return; }
    if (t === 's-snd') { T.pr.snd = Number(v); stamp('pr'); drawSheet(); return; }
    if (t === 'export') { exportCopy(); return; }
    if (t === 'impgo') { applyImport(); return; }
  }

  /* ------------------------------------------------------------------ wiring */
  function wire() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest && e.target.closest('[data-t]');
      if (!el) return;
      if (!el.closest('#view-train') && !el.closest('#trainRoot')) return;
      // the scrim closes only when it is the scrim itself that was pressed
      if (el.classList.contains('scrim') && e.target !== el) return;
      e.preventDefault();
      act(el);
    });
    document.addEventListener('input', function (e) {
      var el = e.target;
      if (!el || !el.getAttribute) return;
      if (el.id === 'trPickQ') { S.q = el.value; redrawPicks(); return; }
      if (el.id === 'trPlateW' && S.sheet && S.sheet.k === 'plates') {
        S.sheet.w = el.value;
        var pos = el.selectionStart;
        drawSheet();
        var n = $('trPlateW');
        if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e2) { /* number inputs */ } }
        return;
      }
      if (el.id === 'trOwnN' && S.own) { S.own.n = el.value; return; }
      var f = el.getAttribute('data-in');
      if (!f || !LIVE) return;
      var x = LIVE.x[Number(el.getAttribute('data-x'))];
      var s = x && x.s[Number(el.getAttribute('data-s'))];
      if (!s) return;
      s[f] = el.value.replace(/[^0-9.,]/g, '').slice(0, 7);
      saveLive();
    });
    document.addEventListener('change', function (e) {
      var el = e.target;
      if (el && el.id === 'trImport' && el.files && el.files[0]) readImport(el.files[0]);
      if (el && S.own && (el.id === 'trOwnM' || el.id === 'trOwnQ' || el.id === 'trOwnK')) {
        S.own[{ trOwnM: 'm', trOwnQ: 'q', trOwnK: 'k' }[el.id]] = el.value;
      }
    });
    /* Enter in a reps box ticks the set, which is the next thing a hand does
       anyway. */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && S.sheet) { closeSheet(); return; }
      var el = e.target;
      if (e.key === 'Enter' && el && el.getAttribute && el.getAttribute('data-in') === 'r' && LIVE) {
        e.preventDefault();
        el.blur();
        tick(Number(el.getAttribute('data-x')), Number(el.getAttribute('data-s')));
      }
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { wake(); drawRest(); }
    });
  }

  /* The picker's list alone, so typing into its search box keeps the box. */
  function redrawPicks() {
    var root = $('trainRoot');
    if (!root || !S.sheet || S.sheet.k !== 'pick') return;
    var tmp = document.createElement('div');
    tmp.innerHTML = pickHTML(S.sheet);
    var fresh = tmp.querySelector('.tr-picks'), old = root.querySelector('.tr-picks');
    if (fresh && old) old.replaceWith(fresh);
  }

  wire();

  window.Train = {
    render: render,
    attach: attach,
    remote: remote,
    forget: forget,
    sheetClosed: sheetClosed,
    /* For the tests, and for anyone reading the numbers off a console: the
       pure parts, which take data and give data. */
    _: {
      build: build, plan: plan, setsFor: setsFor, feedback: feedback, target: target,
      e1rm: e1rm, plateMath: plateMath, review: review, merge: merge, payload: payload,
      rirFor: rirFor, nextSlot: nextSlot, prsIn: prsIn, lib: lib, SPLITS: SPLITS, MUS: MUS,
      estDay: estDay, barred: barred, KEEP_SPLITS: KEEP_SPLITS, HABITS: HABITS, weeksOf: weeksOf,
      state: function () { return { T: T, TS: TS, LIVE: LIVE, S: S }; },
      reload: function () { T = loadT(); TS = loadTS(); LIVE = readLS(LS_LIVE); REV++; }
    }
  };
})();
