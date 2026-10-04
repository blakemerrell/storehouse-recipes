/* The plan sheet itself: the step-by-step setup for a first plan, and for
 * a plan you have, the answer, the facts under it and the editor folded
 * beneath (macroTargetsHTML). The longer account is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.plansheet(app) once, as it starts, and keeps what it gives back
 * under the same names. Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).plansheet = function (app) {
  'use strict';

  // what it reads of the app's
  var MGOAL_WORDS = app.MGOAL_WORDS;
  var MPROT_WORDS = app.MPROT_WORDS;
  var M_WDAY = app.M_WDAY;
  var S = app.S;
  var kcalOf = app.kcalOf;
  var mBlockN = app.mBlockN;
  var mBodyFat = app.mBodyFat;
  var mCanSync = app.mCanSync;
  var mCoachHTML = app.mCoachHTML;
  var mFavDoneLabel = app.mFavDoneLabel;
  var mFavPickBodyHTML = app.mFavPickBodyHTML;
  var mGoalNote = app.mGoalNote;
  var mGoalPace = app.mGoalPace;
  var mInfoBtn = app.mInfoBtn;
  var mInfoText = app.mInfoText;
  var mMeasuredRowHTML = app.mMeasuredRowHTML;
  var mPlanCalc = app.mPlanCalc;
  var mProtLevel = app.mProtLevel;
  var mReadProfile = app.mReadProfile;
  var mReadSlots = app.mReadSlots;
  var mReadTargets = app.mReadTargets;
  var mScaleLb = app.mScaleLb;
  var mTrainDays = app.mTrainDays;
  var mTrainNSay = app.mTrainNSay;
  var mTrainRowHTML = app.mTrainRowHTML;
  var mtActNear = app.mtActNear;
  var mtDash = app.mtDash;
  var mtFactsHTML = app.mtFactsHTML;
  var mtGoalWhat = app.mtGoalWhat;
  var mtMealRow = app.mtMealRow;
  var mtMealSumHTML = app.mtMealSumHTML;
  var mtPlanLine = app.mtPlanLine;
  var mtProtSay = app.mtProtSay;
  var mtSaidBase = app.mtSaidBase;
  var mtSaidBurn = app.mtSaidBurn;
  var mtSaidGoal = app.mtSaidGoal;
  var mtStatusHTML = app.mtStatusHTML;
  var mtWhoLine = app.mtWhoLine;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function macroTargetsHTML() {
    var t = mReadTargets();
    var pr = mReadProfile();
    var plan = mPlanCalc(pr);
    /* With nothing stored the DAY shows no plan and says so — but this is the
       sheet where a plan gets made, so it opens on the one the profile works
       out to rather than on three zeros. Proposing is not asserting: nothing
       is written until Save, and with no profile to work from there is still
       nothing to propose and the boxes stay empty.
     *
       Without this the boxes read 0/0/0 and Save stored three zeros, which
       then came back out of mReadTargets repaired to a real plan by the
       below-the-floor correction — the right numbers arriving by accident,
       from a screen that had shown the wrong ones. */
    if (!kcalOf(t) && plan) t = { p: plan.p, f: plan.f, c: plan.c };
    /* A ledger row: what it is on the left, what it says on the right. One
       fact per line, values right-aligned into a column — the arrangement
       that cannot wrap the way a row of labelled boxes wraps on a phone. */
    /* And the left half NAMES the right. The label was a bare span, so a
       screen reader reached the weight box and said "edit text, 180" with no
       word of what the number was. Not a <label for>, because one row can
       hold two boxes (feet and inches) or a group of buttons: every control
       the row holds is labelled by the row's words, and a box that carries a
       unit by the unit as well — "Height ft", "Height in". The controls are
       built before the row that holds them, so they say {{lab}} and the row
       fills it in with its own id. */
    var rowN = 0;
    var row = function (label, valueHTML, stack) {
      var lid = 'mtlL' + (++rowN);
      return '<div class="mtl-row' + (stack ? ' stack' : '') + '">' +
        '<span class="mtl-lab" id="' + lid + '">' + label + '</span>' +
        '<span class="mtl-val">' + valueHTML.replace(/\{\{lab\}\}/g, lid) + '</span></div>';
    };
    var box = function (id, v, unit) {
      /* Unanswered is not zero. On a first visit nine of these read 0 before
         the reader had typed anything — an answer stated where there is none,
         and the worse of the two on a phone besides: tap a box holding 0,
         type 43, and you get 043. Blank until there is something to say.

         Only while there is no plan. Once one exists a 0 is a real answer —
         six foot nothing is a height — and blanking it would be the same
         mistake pointed the other way. */
      var blank = !v && !plan;
      return '<input type="number" id="' + id + '" min="0" max="999" step="1" inputmode="numeric" ' +
        'aria-labelledby="{{lab}}' + (unit ? ' ' + id + 'U' : '') + '" value="' +
        (blank ? '' : (v || v === 0 ? v : '')) + '">' + (unit ? '<span class="mtl-u" id="' + id + 'U">' + unit + '</span>' : '');
    };
    var seg = function (attr, val, opts, off) {
      return '<span class="seg mt-seg" role="group" aria-labelledby="{{lab}}">' + opts.map(function (o) {
        return '<button data-' + attr + '="' + o[0] + '" aria-pressed="' + String(o[0] === val) + '"' +
          (off ? ' disabled' : '') + '>' + o[1] + '</button>';
      }).join('') + '</span>';
    };
    var acts = [
      [1.2, 'Mostly sitting'],
      [1.375, 'On my feet some, or 1&ndash;3 workouts a week'],
      [1.55, 'Active job, or 3&ndash;5 workouts'],
      [1.725, 'Hard training 6&ndash;7 days'],
      [1.9, 'Physical job plus hard training']
    ];
    /* The form in the groups a first-timer is asked them in.
     *
       Named pieces rather than one run of string, because the same rows have
       to make two shapes: four steps on a first run, and one scrolling sheet
       every time after that. The wording lives here and only here, so neither
       shape owns it.

       Every id is the id it has always had, and that is load-bearing:
       mtProfileFromDom reads the whole form out of the live DOM in one pass
       and falls back to storage for anything it cannot find. A field that is
       off-screen must therefore still be IN the document, or the plan is
       computed from zeros for every question not currently showing. The
       wizard hides steps. It never removes them. */
    /* The rows, without captions. Blake: "I want simplicity and intelligent
       outputs with few clicks" — the sentence under every field was the
       first thing to go, in both shapes of this sheet. The ids are the ids:
       the wizard and the one-screen editor are never on the page together,
       so the same id in both is one element either way, and
       mtProfileFromDom reads it the same. */
    var bfNow = mBodyFat(pr);
    var rowsAbout =
      row('You are', seg('mtsex', pr.sex, [['m', 'Male'], ['f', 'Female']])) +
      row('Age', box('mtAge', pr.age, 'years')) +
      row('Height', box('mtFt', pr.ft, 'ft') + box('mtIn', pr.inch, 'in')) +
      /* Asked for only until the scale can answer. Two boxes for one number is
         how they came to disagree; once there are mornings in the log this
         states what they say instead of inviting a second opinion nothing
         would ever read. */
      row('Weight today', mScaleLb()
        ? '<span class="mtl-fact">' + mScaleLb() + '</span>' +
          '<span class="mtl-u">lb &middot; from your weigh-ins</span>'
        : box('mtLb', pr.lb, 'lb')) +
      /* Estimated from the three answers above, and stated as an estimate:
         the formula carries about four points of error either way, which is
         the difference between a fair ceiling and a wrong one on a lean
         frame. Typing a measured one replaces it. */
      row('Body fat <span class="mtl-opt">(optional)</span>',
        box('mtBf', pr.bf, '%') +
        (bfNow && !bfNow.told
          ? '<span class="mtl-u">about ' + bfNow.pct + '% estimated</span>' : ''));
    /* Three words for the day's activity instead of a five-line dropdown
       that was cut off mid-word on a phone. The workouts asked next carry
       the training; this is only the job. The select every other reader of
       the profile knows stays in the document, hidden, and the three
       buttons set it. */
    var ACT3 = [[1.2, 'At a desk'], [1.375, 'On my feet'], [1.55, 'Active job']];
    var rowsMove =
      row('A normal day, you are mostly', seg('mtact', mtActNear(pr.act), ACT3), true) +
      '<select id="mtAct" class="hide" aria-hidden="true" tabindex="-1">' + acts.map(function (a) {
        return '<option value="' + a[0] + '"' + (mtActNear(pr.act) === a[0] ? ' selected' : '') + '>' + a[1] + '</option>';
      }).join('') + '</select>' +
      /* One list of lifting days, the same one Strengthen's block shows, and
         the sessions a week are simply how many of them there are. Blake: "why
         do i have to play matching games. why not centralize the selection?"
         There used to be a count here and a set of days under it, and a third
         copy on the block. */
      (mCanSync() ? row('Sync with Strengthen',
        '<span class="seg mt-seg" role="group" aria-labelledby="{{lab}}">' + [[1, 'On'], [0, 'Off']].map(function (o) {
          var on = (pr.syncTrain === false ? 0 : 1) === o[0];
          return '<button type="button" data-mtsync="' + o[0] + '" aria-pressed="' + on + '">' + o[1] + '</button>';
        }).join('') + '</span>' +
        '<span class="mt-ld-s">' + (pr.syncTrain === false ? 'You set each day yourself'
          : 'Your plan and logged workouts set each day') + '</span>', true) : '') +
      row('Training days', (mBlockN()
          /* A block running: its days are set on the block, where the count
             is held to its sessions. Shown here, changed there, one tap. */
          ? '<span class="mt-ld">' + mTrainDays().map(function (i) { return '<i>' + M_WDAY[i] + '</i>'; }).join('') + '</span>' +
            '<button type="button" class="mt-ld-go" data-mgotrain="1">Change days</button>'
          : mTrainRowHTML()) +
        '<input type="hidden" id="mtWorkouts" value="' + (mTrainDays().length || Number(pr.workouts) || 0) + '">' +
        '<span class="mt-ld-s" id="mtTrainN">' + mTrainNSay(mTrainDays().length) + '</span>', true) +
      row('Steps a day <span class="mtl-opt">(optional)</span>',
        '<input type="number" id="mtSteps" min="0" max="99999" step="500" ' +
        'inputmode="numeric" aria-labelledby="{{lab}}" value="' + (pr.steps || '') + '">');
    var rowDays = '';
    var fold = function (title, inner, open) {
      return '<details class="mt-fold"' + (open ? ' open' : '') + '><summary>' + title + '</summary>' + inner + '</details>';
    };

    /* The four kinds, as a stack that has room to say what each one does
       rather than four words in a row that do not.
     *
       "Hard cut", "Steady cut", "Maintain", "Lean gain" were four pieces of
       gym vocabulary on controls that explain themselves to nobody who has
       not already been told. The data attributes are unchanged, so every
       handler and test that presses one still finds it.

       With a weight and a date named, these are along for the ride — pressing
       them used to do nothing at all, silently, which is the worst thing a
       control can do. They go properly inert and say who is in charge. */
    var goalPick = function (val, title, what) {
      var on = pr.goal === val, off = !!mGoalPace(pr);
      return '<button class="mt-pick' + (on ? ' on' : '') + '" data-mtgoal="' + val + '"' +
        ' aria-pressed="' + String(on) + '"' + (off ? ' disabled' : '') + '>' +
        '<b>' + title + '</b><span>' + what + '</span></button>';
    };
    /* In three named pieces, because the wizard folds the second behind a
       tap and leaves the third out: the picks, the weight-and-date pace, and
       the coach's lines. One sentence under each card — Blake asked for
       simplicity, and the second sentence was a lecture. */
    var goalPicksHTML =
      '<div class="mt-picks' + (mGoalPace(pr) ? ' spent' : '') + '" id="mtGoalSeg">' +
        goalPick('cut2', MGOAL_WORDS.cut2, mtGoalWhat('cut2', pr)) +
        goalPick('cut1', MGOAL_WORDS.cut1, mtGoalWhat('cut1', pr)) +
        goalPick('keep', MGOAL_WORDS.keep, mtGoalWhat('keep', pr)) +
        goalPick('gain', MGOAL_WORDS.gain, mtGoalWhat('gain', pr)) +
        '<button class="ghost mt-byfeel" data-mtfree="1">A weight and a date are setting your pace &mdash; ' +
          'choose one of these instead</button>' +
      '</div>';
    var goalPaceHTML =
      row('What weight would you like to reach?', box('mtGoalLb', pr.goalLb, 'lb')) +
      row('When would you like to get there?',
        '<input type="date" id="mtGoalBy" aria-labelledby="{{lab}}" value="' + esc(pr.goalBy || '') + '">') +
      '<div class="mt-cap" id="mtGoalNote">' + mGoalNote(pr) + '</div>';
    var qGoal = goalPicksHTML + goalPaceHTML + '<div id="mtCoach">' + mCoachHTML(pr) + '</div>';

    /* What Fill is allowed to shop from. The books are written to be cooked
       out of the storehouse order, and a day drafted from salmon and almonds
       is not a day if there is no salmon in the house. But Blake will happily
       stop at a shop on the way home, and said so — so it is a question with
       two honest answers rather than a rule. Storehouse-only is the default
       because it is the one that cannot surprise you.

       Searching and logging an outside food is never gated. Looking one up is
       how you decide to go and buy it. */
    var qPrefs =
      row('Should Nourish only suggest your staples?',
        seg('mtext', pr.extFill ? '1' : '0', [['0', 'Yes'], ['1', 'No']]));

    /* How much protein, as three words rather than a number to type. It sits
       under the tiles it moves, on the answer rather than in the editor,
       because it is the one question here whose answer you can see change:
       press Very high and the carbohydrate tile gives the grams back. The
       line under it says what the grams are counted against, since "1 g a
       pound" of a goal weight and of today's weight are different days. */
    var rowProt =
      '<div class="mt-prot">' +
        row('Protein level', seg('mtprot', mProtLevel(pr), MPROT_WORDS), true) +
        '<div class="mt-cap" id="mtProtWhy">' + mtProtSay(pr) + '</div>' +
      '</div>';

    /* The boxes are the plan's one rendering: they follow the profile, take a
       hand edit, and Save keeps whatever they say. */
    var qGrams =
      '<div class="mt-cap" id="mtPlan">' + mtPlanLine(plan) + '</div>' +
      row('Protein', box('mtP', t.p, 'g')) +
      row('Fat', box('mtF', t.f, 'g')) +
      row('Carbs', box('mtC', t.c, 'g')) +
      '<div class="mtl-row mtl-sum"><span class="mtl-lab">That is a day of</span>' +
        '<span class="mtl-val" id="mtKcal">' + (kcalOf(t) ? '= ' + kcalOf(t) + ' kcal' : '—') + '</span></div>' +
      // why Save kept nothing, when it keeps nothing (mtRefusal)
      '<div class="mt-cap" id="mtRefuse" role="alert"></div>';

    /* Open on the answer, not on the form. A profile that cannot compute yet
       has no answer to show, so a first run gets the wizard instead — the same
       rows, asked four at a time, each group answering before the next is put. */
    var shut = plan ? ' hide' : '';

    var answerHTML =
      '<div class="mt-answer">' +
        '<div class="mt-big"><span id="mtBigKcal">' + mtDash(kcalOf(t)) + '</span>' +
          '<small>calories a day</small></div>' +
        '<div class="mt-tiles">' +
          '<span class="mt-tile"><b id="mtTileP">' + mtDash(t.p) + '</b><i>Protein</i></span>' +
          '<span class="mt-tile"><b id="mtTileF">' + mtDash(t.f) + '</b><i>Fat</i></span>' +
          '<span class="mt-tile"><b id="mtTileC">' + mtDash(t.c) + '</b><i>Carbs</i></span>' +
        '</div>' +
      '</div>';

    /* The goal belongs under the number it produced, not over it as a display
       line. A sentence in the book's largest serif, where every other sheet
       carries a title, read as a title filled in wrong. */
    /* The handle on the profile fold. It used to carry the goal in the
       book's caption face with the profile beneath it. The goal is a fact in
       the ledger now — said once — so what is left on the handle is the
       fold's name and the answers it is hiding. */
    var whoHTML =
      '<button class="mt-who" data-mtedit="1" aria-expanded="' + (plan ? 'false' : 'true') +
        '" aria-controls="mtEditor">' +
        '<span class="mt-whotext">' +
          '<span class="mt-foldname">About you</span>' +
          '<span id="mtWho">' + mtWhoLine(pr) + '</span>' +
        '</span>' +
        '<span class="mt-editw">Edit</span>' +
      '</button>';

    /* And the handle on the meals fold. Six rows of five controls each took
       about three fifths of a screen you set once and then read for a year.
       It folds to the one line anybody opens it to check, and opens to
       exactly what was there before. */
    var mealHeadFor = function (open) {
      return '<button class="mt-who" data-mtmfold="1" aria-expanded="' + (open ? 'true' : 'false') +
        '" aria-controls="mtMealsWrap">' +
        '<span class="mt-whotext">' +
          '<span class="mt-foldname">The day&rsquo;s meals</span>' +
          '<span id="mtMealSum">' + mtMealSumHTML() + '</span>' +
        '</span>' +
        '<span class="mt-editw">Edit</span>' +
      '</button>';
    };
    var mealsFor = function (open) {
      return '<div id="mtMealsWrap" class="mt-editor' + (open ? '' : ' hide') + '">' +
        '<div class="mt-div m-divi">Kind and share' + mInfoBtn('meals', 'What kind and share mean') + '</div>' +
        mInfoText('meals', 'The kind steers the picker; the share is each meal&rsquo;s slice of the day.', 'mt-cap') +
        '<div id="mtMeals">' + mReadSlots().list.map(mtMealRow).join('') + '</div>' +
        '<div class="mtm-total" id="mtmTotal"></div>' +
        '<div class="sync-row"><button class="ghost" data-mtmeal="add">+ Add a meal</button></div>' +
      '</div>';
    };
    var mealHeadHTML = mealHeadFor(!plan);
    var mealsHTML = mealsFor(!plan);

    /* One Save, and it belongs to whichever fold is open rather than sitting
       at the foot of a form nobody was filling in. A screen you are only
       reading has nothing to commit, and a button that commits what you have
       not touched will eventually commit something you did not mean. */
    var saveHTML = function (hid) {
      return '<div class="sync-row mt-save' + (hid ? ' hide' : '') + '" id="mtSave">' +
        '<button class="btn-primary" data-mtarg="save">Save</button>' +
        '<button class="ghost" data-mtarg="cancel">Cancel</button>' +
      '</div>';
    };

    /* The one place the tab explains itself, folded away. It used to be a
       paragraph on the daily screen behind a ?, which is a paragraph in front
       of somebody who has read it forty times. */
    var helpHTML =
      '<details class="sync-fold mt-help" id="mtHelp"><summary>How Nourish works</summary>' +
        /* Four lines. It was nine, three of them headed by a glyph, and
           Blake called the sheet messy; the four that are left are the four
           verbs the tab has, and the rest is learned by looking. */
        '<dl class="mt-steps">' +
          '<dt>Fill my day</dt><dd>Drafts every empty meal at once, favourites first when they fit.</dd>' +
          '<dt>Rebalance</dt><dd>Re-sizes the plates you have not eaten or locked, back onto target.</dd>' +
          '<dt>Lock &middot; Pin</dt><dd>Lock holds a portion through a rebalance. Pin puts a dish on every new day at that portion.</dd>' +
          '<dt>Training days</dt><dd>Earn extra carbs; rest days give them back. The week averages to the plan.</dd>' +
        '</dl>' +
      '</details>';

    var shell = function (inner) {
      return '<div class="scrim no-print" data-close="1">' +
        '<div class="sheet mt-sheet" role="dialog" aria-modal="true" aria-label="Your plan">' +
          '<div class="sheet-top">' +
            '<div class="sheet-eyebrow">Your plan</div>' +
            '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
          '</div>' + inner +
        '</div></div>';
    };

    /* ---------------------------------------------------------------- first run
     *
       Four steps, all of them rendered and three of them hidden. That is not a
       style: mtProfileFromDom reads the whole form out of the live DOM in one
       pass and falls back to storage for any field it cannot find, so a step
       taken out of the document would have its questions answered as zeros and
       a plan computed confidently from them.

       The who-line and the measured row come too, hidden, for the same reason
       — every id the rest of the file looks up still exists. The answer block
       is on step four and nowhere else, because two of it would be two
       elements with one id. */
    if (!plan) {
      var STEPS = 5;
      var step = function (n, title, body, said) {
        return '<section class="mtw-step" data-mtwstep="' + n + '"' + (n === 1 ? '' : ' hidden') + '>' +
          '<h3 class="mtw-h">' + title + '</h3>' + body +
          '<div class="mtw-said" id="mtwSaid' + n + '">' + (said || '') + '</div>' +
        '</section>';
      };
      /* The wizard's shape: one screen at a time, the settings that are not
         questions folded behind a tap. */
      var wMove = rowsMove;
      var wGoal = goalPicksHTML + fold('Reach a weight by a date', goalPaceHTML);
      return shell(
        /* Drawn from the step count rather than written out. Four pips were
           typed by hand here, so a fifth step would have arrived with a bar
           that still said four — the kind of disagreement nobody sees until
           they count. */
        '<div class="mtw-bar" aria-hidden="true">' +
          (function () {
            var out = '';
            for (var i = 1; i <= STEPS; i++) {
              out += '<span class="mtw-pip' + (i === 1 ? ' on' : '') + '"></span>';
            }
            return out;
          })() +
        '</div>' +
        '<div class="mtw-keep hide">' + mMeasuredRowHTML(pr) + whoHTML + '</div>' +
        '<div id="mtEditor" class="mt-editor">' +
          step(1, 'About you', rowsAbout, mtSaidBase(pr)) +
          step(2, 'How you move', wMove, mtSaidBurn(pr)) +
          step(3, 'What you&rsquo;re after', wGoal, mtSaidGoal(pr)) +
          /* The answer, once. It was the headline and the tiles and then the
             same three numbers again as boxes, a "= 2158 kcal" line, a
             storehouse toggle and the six-row meal editor, on one screen.
             Now: the number, the meals with an Edit, one door for anyone who
             wants to override. Next goes on to the foods — Blake: "make the
             pick my foods the next step, with a subtle I'm ready to just
             start now, I'll pick foods later" — and that quiet line is the
             Save: it writes the plan and lands on the day. The storehouse
             toggle lives in the editor, under the gear. */
          step(4, 'Your plan',
            answerHTML + rowProt + mealHeadFor(false) + mealsFor(false) +
            '<details class="mt-fold" id="mtAdjust"><summary>Adjust the numbers</summary>' + qGrams + '</details>' +
            '<div class="mt-save" id="mtSave">' +
              '<button class="mtw-link" data-mtarg="save">I&rsquo;m ready &mdash; start now, pick foods later</button>' +
            '</div>', '') +
          /* The food comes last, after the plan has paid for the question.
             "1,910 calories a day" is the answer that earns "so what do you
             eat" — asked before it, the same screen is a survey.
           *
             Skippable in one tap, and it says so. The table's own defaults
             carry anybody who skips, and the picker dials the rest in as they
             use it, which was Blake's instinct before it was a step: "as I
             use it I dial it in as they show up as suggestions". */
          step(5, 'What do you actually eat?',
            '<div class="mt-cap">Tap anything you eat regularly. Nourish leans ' +
              'toward these when it suggests food &mdash; it never stops offering ' +
              'anything else, and you can change your mind on any food later.</div>' +
            mFavPickBodyHTML(), '') +
        '</div>' +
        '<div class="mtw-nav">' +
          '<button class="ghost" data-mtw="back" hidden>&lsaquo; Back</button>' +
          '<button class="btn-primary" data-mtw="next">Next &rsaquo;</button>' +
          /* The last step has no Next to press, and a step you can only leave
             by the × in the corner is a step that looks unfinished. */
          '<button class="btn-primary" data-mtw="done" hidden>' +
            mFavDoneLabel() + '</button>' +
        '</div>' +
        /* Off the path, but reachable: the gear's "How My Day works" opens
           this sheet asking for it, and a first-run reader deserves an
           answer too. */
        '<div class="' + (S.mtOpen === 'help' ? '' : 'hide') + '">' + helpHTML + '</div>'
      );
    }

    /* ------------------------------------------------------- and every time after
       One screen. Changing your step count should not be four taps through
       questions you answered months ago. */
    return shell(
      answerHTML + rowProt +
      '<div class="mt-facts' + (mtFactsHTML(pr) ? '' : ' hide') + '" id="mtFacts">' +
        mtFactsHTML(pr) + '</div>' +
      '<div class="mt-status' + (mtStatusHTML(pr) ? '' : ' hide') + '" id="mtStatus" role="status">' +
        mtStatusHTML(pr) + '</div>' +
      whoHTML +
      /* The same rows the wizard asks, one screen, nothing folded that a
         returning reader came to change: the training days and the
         weight-and-date pace sit open here, because Edit is the tap that
         said "I want at those". */
      '<div id="mtEditor" class="mt-editor' + shut + '">' +
        '<div class="mt-div">About you</div>' + rowsAbout +
        '<div class="mt-div">How you move</div>' + rowsMove + rowDays +
        '<div class="mt-div">What you&rsquo;re after</div>' + qGoal +
        '<div class="mt-div">Where your meals come from</div>' + qPrefs +
        '<div class="mt-div">Adjust the numbers</div>' + qGrams +
      '</div>' + mealHeadHTML + mealsHTML + saveHTML(!!plan) + helpHTML
    );
  }

  return { macroTargetsHTML: macroTargetsHTML };
};
