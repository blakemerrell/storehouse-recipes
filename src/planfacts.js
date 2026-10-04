/* What the plan sheet says about your plan: what the protein is counted
 * against (mtProtSay), who the plan is for (mtWhoLine), the facts under
 * the answer (mtFactsHTML), the one line that speaks only when something
 * needs doing (mtStatusHTML), the meals in one line (mtMealSumHTML), and
 * the coach's note (mCoachHTML, mGoalNote). The longer account is with the
 * code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.planfacts(app) once, as it starts, and keeps what it gives back
 * under the same names. Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).planfacts = function (app) {
  'use strict';

  // what it reads of the app's
  var MGOAL_WORDS = app.MGOAL_WORDS;
  var MLINE_NEAR = app.MLINE_NEAR;
  var MPROT_LEVELS = app.MPROT_LEVELS;
  var MSTEP_BASE = app.MSTEP_BASE;
  var M_MONS = app.M_MONS;
  var kcalOf = app.kcalOf;
  var mBurn = app.mBurn;
  var mGoalPace = app.mGoalPace;
  var mLever = app.mLever;
  var mMeasuredRowHTML = app.mMeasuredRowHTML;
  var mPaceFacts = app.mPaceFacts;
  var mPlanCalc = app.mPlanCalc;
  var mPretty = app.mPretty;
  var mProject = app.mProject;
  var mProtGrams = app.mProtGrams;
  var mProtLevel = app.mProtLevel;
  var mProtRefLb = app.mProtRefLb;
  var mReadSlots = app.mReadSlots;
  var mReadTargets = app.mReadTargets;
  var mSlotW = app.mSlotW;
  var mWeightStats = app.mWeightStats;
  var todayKey = app.todayKey;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function $(id) { return document.getElementById(id); }

  /* What the protein grams are counted against, in one line under the
     level. Says so when the level's own ceiling held it, and when the plan
     eased it to keep a squeezed cut's carbohydrate — the tile above is the
     plan's figure, and a caption quoting a different one would be two
     answers on one screen. */
  function mtProtSay(pr) {
    if (!pr || !(Number(pr.lb) > 0)) return '';
    var L = MPROT_LEVELS[mProtLevel(pr)];
    var ref = mProtRefLb(pr);
    var what = Number(pr.bf) > 0 ? 'lean mass' : Number(pr.goalLb) > 0 ? 'goal weight' : 'weight';
    var g = mProtGrams(pr);
    var plan = mPlanCalc(pr);
    /* No gram figure of its own: the tile above says it, and a stored plan
       made at last week's weight would have the two disagreeing by a gram. */
    var said = String(L.per) + ' g a pound of your ' + what + ' (' + Math.round(ref) + ' lb)';
    if (L.per * ref > L.cap * pr.lb + 0.5) {
      said += ', held to ' + String(L.cap) + ' g a pound of what you weigh';
    }
    if (plan && plan.p < g) said += '; eased to ' + plan.p + ' g to leave room for carbs';
    return said + '.';
  }

  /* The one line your profile collapses to once it computes. */
  function mtWhoLine(pr) {
    if (!mPlanCalc(pr)) return 'Tell me about you';
    /* What the fold is hiding, so you can decide without opening it. The
       goal used to be said here; it is a fact in the ledger above now, and
       saying it twice on one screen was how the two came to disagree. What
       belongs on the handle is the answers behind it. */
    var bits = [pr.age, pr.ft + '\u2032' + pr.inch + '\u2033',
      pr.sex === 'f' ? 'female' : 'male'];
    if (pr.steps) bits.push(Number(pr.steps).toLocaleString() + ' steps');
    if (pr.workouts) bits.push(pr.workouts +
      (Number(pr.workouts) === 1 ? ' session' : ' sessions') + ' a week');
    return bits.join(' \u00b7 ');
  }

  /* The four things the sheet is opened to read: where you are going, how
     fast, when you get there, and what the scale actually says.
   *
     Three of them used to be crushed into one two-line box above the meal
     editor, and the fourth was not on this screen at all — it lived only on
     My Day, so the plan could be read end to end without ever meeting the
     evidence for or against it. A ledger, because these are facts and not
     controls: label left, value right, one per line, nothing to press. */
  function mtFactsHTML(pr) {
    var rows = [];
    var st = mWeightStats();
    var pace = mGoalPace(pr);
    var pj = mProject(pr);
    var fact = function (lab, val) {
      return '<div class="mtf-row"><span>' + lab + '</span><b>' + val + '</b></div>';
    };
    var lb = function (v) { return (Math.round(v * 10) / 10).toLocaleString() + ' lb'; };
    /* The profile's weight, which mReadProfile has already resolved to what
       the scale says — NOT a second read of mWeightStats. Two routes to one
       number is how the sheet came to open on the scale's plan and then flip
       to the stale typed one the moment any other control was touched. */
    var now = pr.lb;

    if (pr.goalLb && now) {
      rows.push(fact('Going from', lb(now) + ' \u2192 ' + lb(pr.goalLb)));
    } else if (MGOAL_WORDS[pr.goal]) {
      rows.push(fact('Aiming to', esc(MGOAL_WORDS[pr.goal])));
    }

    /* A named date sets the pace; without one the plan's own pace is what
       there is. Direction is already in the line above, so this is a rate. */
    var per = pace ? pace.perWeek : pj ? pj.perWeek : null;
    if (per !== null) {
      var v = Math.round(Math.abs(per) * 10) / 10;
      rows.push(fact('At', v ? v + ' lb a week' : 'holding steady'));
    }

    /* Where the plan lands you, not the day you asked for — they differ
       whenever a cap bit, and the one that is true is the one worth reading. */
    if (pj) {
      rows.push(fact('Arriving', 'about ' + M_MONS[pj.when.getMonth()] + ' ' +
        pj.when.getDate()));
    } else if (pace) {
      rows.push(fact('Arriving', esc(mPretty(pr.goalBy))));
    }

    /* The weight here is `now` — the profile's resolved lb — and NOT a second
       read of mWeightStats.avg7, even though mReadProfile defines one as the
       other. Two routes to one number is the whole fault this screen was
       rearranged to end: they agree until something breaks the resolution,
       and then the sheet states one weight and plans from another. Only the
       RATE comes off the stats, because nothing else carries it. */
    if (st && now) {
      var w = lb(now);
      if (st.dWeek !== null) {
        var d = Math.round(Math.abs(st.dWeek) * 10) / 10;
        w += Math.abs(st.dWeek) < 0.05 ? ', holding steady'
          : ', ' + (st.dWeek < 0 ? 'down ' : 'up ') + d + ' a week';
      }
      rows.push(fact('Averaging now', w));
    }

    /* Last, because it is the one fact that carries its own caption, and a
       caption reads as a note on the row above it — never as a heading for
       whatever comes next. */
    rows.push(mMeasuredRowHTML(pr));

    return rows.join('');
  }

  /* The one line on the sheet that speaks only when something needs doing.
     On pace it says nothing at all — a plan you are keeping to has no news —
     and what it does say is mPaceFacts, the same arithmetic My Day's morning
     line is drawn from. */
  function mtStatusHTML(pr) {
    /* The same estimate the morning card gives, in the same words, so the
       sheet and the card never read two different stories about one goal. */
    var f = mPaceFacts(todayKey(), pr);
    if (!f || !f.plan.per) return '';
    var boxes = $('mtP')
      ? { p: Number($('mtP').value) || 0, f: Number($('mtF').value) || 0, c: Number($('mtC').value) || 0 }
      : mReadTargets();
    var cur = kcalOf(boxes);
    var fmt = function (n) { return Number(n).toLocaleString(); };
    var eating = f.need !== null && cur > 0 && Math.abs(cur - f.need) <= MLINE_NEAR;
    var goalD = f.goalWord;
    if (!f.arriveD && f.slow) {
      return '<b>\u25CE No arrival date yet.</b> You\u2019re ' + (f.plan.per < 0 ? 'down' : 'up') +
        ' about ' + f.slow + ' lb a week these three weeks, too slow to date.';
    }
    if (!f.arriveD) {
      return '<b>\u25CE No arrival date yet.</b> Your weight\u2019s been ' +
        (f.rate3 !== null && Math.abs(f.rate3) >= 0.15 ? (f.rate3 > 0 ? 'going up' : 'going down') : 'flat') +
        ' these three weeks.';
    }
    if (f.lateDays > 6) {
      var speeds = f.need !== null && cur > 0 &&
        (f.plan.per < 0 ? f.need < cur - MLINE_NEAR : f.need > cur + MLINE_NEAR);
      return '<b>\u25B2 Arriving around ' + f.arrive + ', not ' + goalD + '.</b>' +
        (eating ? (f.capped ? ' This target is already as ' + (f.capHigh ? 'much as your body can put to use.'
          : 'low as it\u2019s safe to go.') : ' This target brings it back.')
          : speeds ? (f.capped ? ' The lowest it\u2019s safe to go is ' + fmt(f.need) + '.'
            : ' ' + fmt(f.need) + ' a day brings it back to ' + goalD + '.') : '');
    }
    if (f.lateDays < -6) {
      var slows = f.need !== null && cur > 0 &&
        (f.plan.per < 0 ? f.need > cur + MLINE_NEAR : f.need < cur - MLINE_NEAR);
      /* Early with nothing to offer is nothing to do: the sheet stays quiet,
         the way the card's last line speaks only when something needs doing. */
      return slows ? '<b>\u25BC Arriving around ' + f.arrive + ', ahead of ' + goalD + '.</b>' +
        ' You could eat ' + fmt(f.need) + ' and still make it.' : '';
    }
    return '';
  }

  /* What the meals fold says on its handle: how many, and the shares. That
     is what anybody opens it to check, so checking it should not cost the
     opening. Read off the live rows while they exist, because those are the
     draft — storage is a version of this screen that may be one edit old. */
  function mtMealSumHTML() {
    var rows = document.querySelectorAll('#mtMeals .mtm-row');
    var ws = [];
    if (rows.length) {
      Array.prototype.forEach.call(rows, function (r) {
        ws.push(Math.max(0, Math.round(Number(r.querySelector('.mtm-share').value) || 0)));
      });
    } else {
      mReadSlots().list.forEach(function (sl) { ws.push(mSlotW(sl)); });
    }
    if (!ws.length) return 'No meals yet';
    var N = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
      'Nine', 'Ten', 'Eleven', 'Twelve'];
    return (N[ws.length] || ws.length) + (ws.length === 1 ? ' meal' : ' meals') +
      ' \u00b7 ' + ws.join(' / ') + '%';
  }

  function mPaceWords(pace) {
    var v = Math.round(Math.abs(pace.perWeek) * 10) / 10;
    return (pace.perWeek > 0.05 ? '\u2212' : pace.perWeek < -0.05 ? '+' : '') +
      (v ? v + ' lb a week' : 'holding');
  }

  function mWeeksWords(w) {
    var v = Math.round(w * 10) / 10;
    return v + (v === 1 ? ' week' : ' weeks');
  }

  /* The panel that answers "what would happen if". Three things, in the
     order somebody asks them: what your day costs and which parts you can
     move; where the plan you have chosen lands you and when; and what one
     more lever is worth — said both ways, because more walking either buys
     food at the same pace or the same food sooner, and people mean different
     ones. */
  function mCoachHTML(pr) {
    var b = mBurn(pr);
    if (!b) return '';
    /* Four rows at most, in the ledger's own voice. Blake, on the sheet:
       "Craft my plan pages still looks messy" — this block was five rows of
       shouting labels, a lands-you line the ledger above already said, and
       an italic paragraph of advice. What is left is what the ledger cannot
       say: what you burn, what one more lever buys, and the formula's own
       plan when it differs from the boxes. */
    var out = [];
    var kc = function (n) { return Math.round(n).toLocaleString(); };
    out.push('<div class="mco-row"><span class="mco-k">You burn</span><span class="mco-v">' +
      '<b>' + kc(b.tdee) + '</b> a day' +
      (b.told
        ? ' &middot; ' + kc(b.base) + ' living, ' + kc(b.steps) + ' moving about, ' + kc(b.train) + ' training'
        : ' &mdash; fill in steps and sessions to see the parts') +
      '</span></div>');

    var pj = mProject(pr);
    if (b.told && pj) {
      var kg = pr.lb * 0.45359237;
      /* What 2,000 more steps would do to the burn mBurn works out, rather
         than a price per step of its own: on your feet all day, the job is
         already the bigger guess at how much you move, and steps under it
         buy nothing — so the lever must not promise food the box would not
         give. At a desk this is the same 2,000 steps it always was. */
      var stepK = mBurn(Object.assign({}, pr,
        { steps: Math.max(Number(pr.steps) || 0, MSTEP_BASE) + 2000 })).tdee - b.tdee;
      var sessK = (5 * 3.5 * kg / 200) * 45 / 7;
      var says = function (label, lev) {
        return '<div class="mco-row"><span class="mco-k">' + label + '</span><span class="mco-v">' +
          '<b>+' + lev.kcal + ' kcal</b> a day at the same pace' +
          (lev.weeks && lev.weeks > 0.15
            ? ', or ' + mWeeksWords(lev.weeks) + ' sooner on the same food'
            : '') + '</span></div>';
      };
      if (stepK >= 1) out.push(says('2,000 more steps', mLever(pr, stepK)));
      out.push(says('One more session', mLever(pr, sessK)));
    }
    /* The panel describes a plan the boxes below may not be showing: the
       boxes hold what was last saved, and follow the profile only while it
       is being typed. Rather than overwrite a day somebody meant, offer it. */
    var plan = mPlanCalc(pr);
    /* Against what the boxes say, not what storage holds — the offer is
       about the day in front of you, and it should go quiet the moment you
       take it rather than waiting for a save. */
    var cur = $('mtP')
      ? { p: Math.round(Number($('mtP').value) || 0), f: Math.round(Number($('mtF').value) || 0),
        c: Math.round(Number($('mtC').value) || 0) }
      : mReadTargets();
    if (plan && (plan.p !== cur.p || plan.f !== cur.f || plan.c !== cur.c)) {
      out.push('<div class="mco-row"><span class="mco-k">The formula says</span><span class="mco-v">' +
        '<b>' + kcalOf(plan).toLocaleString() + '</b> kcal &middot; ' + plan.p + 'P / ' + plan.f + 'F / ' +
        plan.c + 'C ' +
        '<button class="ghost mco-use" data-mtuse="1">Use it</button></span></div>');
    }
    return '<div class="mco">' + out.join('') + '</div>';
  }

  /* The line under it: the pace that implies, the commitments beside it, and
     a word when the arithmetic had to be talked down. */
  function mGoalNote(pr) {
    var pace = mGoalPace(pr);
    if (!pace) return 'Give a weight and a date and they set your pace for you. Leave the date blank and the choices above set it instead.';
    /* The pace, and the warning if the pace cannot be had. It used to
       finish with "3× a week · 7,000 steps a day" — the answers from the
       rows above, read back to the person who typed them. */
    var bits = [Math.abs(Math.round(pace.lbs * 10) / 10) + ' lb over ' +
      Math.round(pace.days / 7) + ' weeks \u2014 ' + mPaceWords(pace)];
    var warn = '';
    if (pace.capped && pace.realWeeks) {
      /* Say when you would actually arrive rather than only that the date
         slips. A date you cannot meet is worth knowing; the one you can
         meet is worth more. */
      var arrive = new Date();
      arrive.setDate(arrive.getDate() + Math.round(pace.realWeeks * 7));
      warn = '<span class="mt-warn">That needs ' +
        (Math.round(Math.abs(pace.wanted) * 10) / 10) + ' lb a week, more than a body ' +
        'gives up without giving up muscle with it. Held to ' +
        (Math.round(Math.abs(pace.perWeek) * 10) / 10) + ' &mdash; arriving about ' +
        M_MONS[arrive.getMonth()] + ' ' + arrive.getDate() + '.</span>';
    }
    return esc(bits.join(' \u00b7 ')) + warn;
  }

  return { mtProtSay: mtProtSay, mtWhoLine: mtWhoLine, mtFactsHTML: mtFactsHTML, mtStatusHTML: mtStatusHTML, mtMealSumHTML: mtMealSumHTML, mCoachHTML: mCoachHTML, mGoalNote: mGoalNote };
};
