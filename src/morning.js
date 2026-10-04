/* The morning card and the day's lines: the card itself, the scale's word
 * against the plan with whatever is worth doing about it, most mornings
 * nothing (mMorningHTML, MLINE_NEAR); one line of it, with its reason
 * folded behind "why?" (mLineHTML); and quiet by default, the small "i"
 * and "why?" buttons and the text they open (MINFO, mInfoBtn, mWhyBtn,
 * mInfoText), a note that only says what it has not said before, and
 * whether Strengthen is up to open the weekly check-in (mWeekOn). The
 * longer account is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.morning(app) once, as it starts, and keeps what it gives back
 * under the same names. Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).morning = function (app) {
  'use strict';

  // what it reads of the app's
  var MSALT_DAY = app.MSALT_DAY;
  var MSALT_JUMP = app.MSALT_JUMP;
  var kcalOf = app.kcalOf;
  var mAhead = app.mAhead;
  var mBurn = app.mBurn;
  var mDayTargets = app.mDayTargets;
  var mHushed = app.mHushed;
  var mIsTrainingDay = app.mIsTrainingDay;
  var mJump = app.mJump;
  var mLsJson = app.mLsJson;
  var mMeasuredTdee = app.mMeasuredTdee;
  var mPaceFacts = app.mPaceFacts;
  var mPlanWeight = app.mPlanWeight;
  var mPretty = app.mPretty;
  var mReadProfile = app.mReadProfile;
  var mReadTargets = app.mReadTargets;
  var mSodiumOn = app.mSodiumOn;
  var mTrainDays = app.mTrainDays;
  var todayKey = app.todayKey;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Two places, one function, because the two lines it can draw belong on
     opposite sides of the fold.
   *
     `where` is 'face' or 'body'. The salt line is EVIDENCE — it exists to
     explain a number, and Blake's rule for this card has always been that
     what you do daily stays out and what is evidence for it goes behind the
     press. It was the deliberate exception, on the face because it is the
     only line in the app that says do NOT act on the number above it. He has
     now lived with it: "I don't like the persistent salt notice... I think it
     is interesting once, but should collapse into the rest of the card that
     carries the weight trend line." So it joins the trend line and the pace
     arithmetic behind the press.
   *
     The suppression it was doing stays. On a morning the salt explains, the
     FACE says nothing at all rather than falling through to "you are behind
     pace, eat less" — which is the advice the salt line existed to stop. A
     quiet face and an explanation one tap away, which is silence beating a
     stat and a stat beating a verdict, in that order. */
  /* How far the number the line would ask for may sit from the target before
     it is worth asking. It was five, so the morning asked "Dropping to 1,404
     brings it back to Dec 1 — Use 1,404 / Keep 1,421" over seventeen
     calories, and asked again the next morning over twenty: the estimate
     under it moves a few calories a day on its own. Fifty is about a
     twentieth of a pound a week — inside what a scale can see — and the
     sheet's status line (mtStatusHTML) holds to the same number. */
  var MLINE_NEAR = 50;

  function mMorningHTML(k, where) {
    var body = where === 'body';
    if (mAhead(k)) return '';                     // a morning that has not happened
    /* And not a morning that has been and gone. Every figure on this card —
       the seven-day average, the days off pace, what to eat to get back on
       it — is computed from where you stand NOW, not from where you stood on
       the day being looked at. Drawn over Sunday it said Sunday was eighteen
       days behind pace, which was neither true of Sunday nor something Sunday
       could be talked into doing anything about; the button offered to
       rewrite today's targets from a card sitting on a closed day.

       It also could not be sent away there, and that followed from the same
       fault rather than being a second one: the refusal is stored against the
       day it was made on, so dismissing it on Sunday silenced Sunday and left
       every other past day still carrying it. */
    var pr = mReadProfile();
    var meas = mMeasuredTdee();

    /* Salt first, because it is the one that stops you doing something. A
       jump the app can explain is a jump you should not act on, and this is
       true long before there is enough history to measure a burn. */
    var jump = mJump(k);
    if (jump && jump.d >= MSALT_JUMP) {
      var yest = mSodiumOn(jump.prevKey);
      if (yest >= MSALT_DAY) {
        /* The face keeps quiet on a salt morning; the explanation is in the
           fold. Returning '' here is the suppression, not an oversight. */
        if (!body) return '';
        var big = jump.d > jump.url;
        return mLineHTML('noise', '\uD83E\uDDC2',
          '<b>Up ' + (Math.round(jump.d * 10) / 10) + ' lb \u2014 that is salt, not fat.</b> ' +
          esc(mPretty(jump.prevKey)) + ' was ' + yest.toLocaleString() + ' mg.',
          /* Two different true things, and claiming the wrong one would be
             worse than saying nothing: a jump inside your usual range needs
             no explaining, and one outside it needs this one. */
          big
            ? 'Bigger than your usual ' + (Math.round(jump.url * 10) / 10) +
              ' lb overnight \u2014 and the salt accounts for it. The seven-day average is what to watch.'
            : 'Inside your usual overnight range of ' + (Math.round(jump.url * 10) / 10) + ' lb.',
          null, 'salt');
      }
    }
    /* Past the salt line there is nothing the fold wants: everything below is
       what to DO, which belongs on the face. */
    if (body) return '';

    /* Everything below is about where you stand NOW — the seven-day average,
       the days off pace, the number to eat to get back on it — so it is only
       true of today and is only drawn there. Below the salt card and not at
       the top of the function on purpose: mJump compares a day to the morning
       before it, so "Up 2.3 lb, that is salt, not fat" IS about the day being
       looked at and is worth reading about last Tuesday. Guarding the whole
       function took that away too, which was a wider cut than the fault. */
    if (k !== todayKey()) return '';

    /* Then pace, which needs a plan to be off. */
    var plan = mPlanWeight(k, pr);

    /* No date named, so there is no pace to be off — but there is still the
       most useful thing this whole apparatus computes. A burn measured from
       what you ate and what the scale did says what your deficit actually is,
       and that is worth knowing whether or not you have named a day to arrive
       on. Saying nothing here was treating a goal date as the price of
       admission to your own numbers. */
    if (!plan) {
      if (!meas) return '';
      var ate = meas.eaten, gap = meas.tdee - ate;
      var lbWk = Math.round(gap * 7 / 3500 * 10) / 10;
      // said again only when the direction it reads changes
      if (mCoachQuiet(k, 'burn:' + (lbWk > 0.2 ? 'off' : lbWk < -0.2 ? 'on' : 'keep'))) return '';
      return mLineHTML(Math.abs(lbWk) < 0.2 ? 'wait' : 'calm', '\u25CE',
        '<b>You are burning about ' + meas.tdee.toLocaleString() + ' a day</b> and eating ' +
        ate.toLocaleString() + '.',
        lbWk > 0.2 ? 'That is ' + lbWk + ' lb a week off, measured over ' + meas.days + ' days.'
          : lbWk < -0.2 ? 'That is ' + Math.abs(lbWk) + ' lb a week on, measured over ' +
            meas.days + ' days.'
            : 'Which is maintenance, measured over ' + meas.days + ' days.', null, 'coach');
    }

    /* Not enough history to say anything, so it says nothing.
     *
       This used to draw a line reading "7 more mornings and this will say
       whether you are on pace", with a progress count under it. Its content
       was that it had no content, and it sat above the plate for a
       fortnight — the first thing read every morning, every morning saying
       wait. A line that cannot answer is not a smaller answer; it is the
       question taking up the room. */
    var pf = mPaceFacts(k);
    if (!pf) return '';
    var off = pf.off, need = pf.need, capped = pf.capped, arrive = pf.arrive;
    /* With carb cycling on, the number this offers is the week's average and
       no single day will read it back — a training day runs higher and a rest
       day lower. Pressing a button marked 1,853 and watching the bar say
       1,667 is the app appearing to ignore you, so it says which it means. */
    var cyc = mTrainDays().length > 0 && mTrainDays().length < 7 ? ' a day on average' : '';

    /* The number already taken. Pressing "Eat 1,846" wrote the targets and
       redrew the card — and the card, computed from the scale alone, came
       back word for word with the same button. Blake: "I hit eat it but
       nothing happened." It had; nothing said so. Once the plan already eats
       what the card would ask, there is no decision left, so the card says
       what is being done and stops asking. */
    /* Nothing here was measured today. The average is of a morning that has
       been and gone, and the honest thing is to say which morning and what it
       read — not to hand down a verdict on it, and not to ask anybody to eat
       a number worked out from it. Blake, on being shown a pace verdict under
       an empty weigh-in box: "I didn't want to be nagged, but coached and
       informed." A stat, then silence, which is his own rule for the last
       line of a card. */
    /* Coached, in plain words. Blake, on "Eating 1,667 a day on average. 28
       days behind pace — this is the number that lands on time": "Am I
       eating that much? Should I be eating that much? It is unclear to me
       what it is even talking about." It was his TARGET, said as though it
       were a report of his eating, with three ideas in one sentence. So
       every line now opens on the target by that name, then says where you
       stand, then what to do — to you, the way a coach would: "Build it
       more like that. Make it personal like you are coaching me." */
    var cur = kcalOf(mReadTargets());
    var todayT = kcalOf(mDayTargets(k));
    var fmt = function (n) { return Number(n).toLocaleString(); };
    /* With carb cycling the target is a week's average and today reads
       differently; saying so here stops "1,667" and the bar's "1,745" from
       looking like two answers. */
    var target = function (n) {
      var tn = cyc && Math.abs(todayT - n) > 5
        ? ' <span class="mline-q">(' + fmt(todayT) + ' today, ' +
          (mIsTrainingDay(k) ? 'a training day' : 'a rest day') + ')</span>' : '';
      return '<b>Your target: ' + fmt(n) + ' a day</b>' + tn;
    };
    /* Where you'll land, not how far behind you are. Blake: "How about not
       telling me I'm behind but that my target date estimate has moved from
       when to when." The date you set is the anchor; the estimate is the
       three-week rate (mRate3). Within a week of the goal, it is on track. */
    var goalD = pf.goalWord;
    var est = (function () {
      if (!pf.plan.per) {
        var lbOff = Math.round(Math.abs(off) * 10) / 10;
        return pf.side === 'on' ? 'You’re holding your weight.'
          : 'You’re ' + lbOff + ' lb ' + (off > 0 ? 'over' : 'under') + ' your weight.';
      }
      if (!pf.arriveD && pf.slow) {
        return 'You’re ' + (pf.plan.per < 0 ? 'down' : 'up') + ' about ' + pf.slow +
          ' lb a week these three weeks. Too slow yet to give a date.';
      }
      if (!pf.arriveD) {
        return (pf.rate3 !== null && Math.abs(pf.rate3) >= 0.15 && !pf.toward
          ? 'Your weight’s gone ' + (pf.rate3 > 0 ? 'up' : 'down') + ' these three weeks'
          : 'Your weight’s been flat these three weeks') + ', so there’s no arrival date yet.';
      }
      if (pf.lateDays > 6) return 'Arriving around <b>' + arrive + '</b>, not ' + goalD + '.';
      if (pf.lateDays < -6) return 'Arriving around <b>' + arrive + '</b>, ahead of ' + goalD + '.';
      return 'On track for <b>' + goalD + '</b>.';
    })();
    var late = pf.plan.per && (!pf.arriveD || pf.lateDays > 6);
    var early = pf.plan.per && pf.arriveD && pf.lateDays < -6;

    if (pf.stale > 1) {
      if (mHushed(k, 'stale:' + pf.st.lastKey)) return '';
      return mLineHTML('wait', '◎',
        '<b>Last weighed ' + esc(mPretty(pf.st.lastKey)) + ': ' +
        (Math.round(pf.st.latest * 10) / 10) + ' lb.</b>',
        'Step on the scale when you can, and the coaching picks up from there.',
        [['Not now', 'mline:none:stale:' + pf.st.lastKey]]);
    }
    /* The steady lines — at your goal, or on a target that is working — are
       news once: the day they first say it. After that they are said again
       only when the target or the verdict moves. The lines that ask for a
       decision are not these; they ask until answered. */
    var pace = late ? 'late' : early ? 'early' : 'on';
    if (pf.plan.daysLeft <= 0) {
      if (mCoachQuiet(k, 'goal:' + pr.goalLb)) return '';
      return mLineHTML('calm', '✓', '<b>You’re at your goal: ' + pr.goalLb + ' lb.</b>',
        'Set a new goal when you’re ready.', null, 'coach');
    }
    var eating = need !== null && cur > 0 && Math.abs(cur - need) <= MLINE_NEAR;
    /* Your target is your target: inside MLINE_NEAR the number this would
       ask for can be fifty off it, and naming that one as "Your target"
       would be naming a number nothing on the screen is eating to. */
    var head = target(cur);
    /* Taking the number already: say where it lands and leave it there. */
    if (eating) {
      /* The number it lands on drifts a few calories a day as the weeks
         move; to the nearest fifty is what counts as it having changed. */
      if (mCoachQuiet(k, 'eat:' + Math.round(need / 50) * 50 + ':' + pace)) return '';
      return mLineHTML('calm', late ? '▲' : early ? '▼' : '✓', head,
        est + ' ' + (late && capped
          ? (pf.capHigh ? 'This is already as much as your body can put to use — stay with it.'
            : 'This is already as low as it’s safe to go — stay with it.')
          : late ? 'Stay with it \u2014 this target is set to land on ' + goalD + '.'
            : early ? 'Keep it up.' : 'Stay with it.'), null, 'coach');
    }
    /* The offer follows the ESTIMATE, not the position on the plan line, so
       the words and the button never disagree: a date running late is offered
       the number that brings it back (less food on a cut, more on a gain),
       and one running early is offered the room. */
    var speeds = need !== null && cur > 0 &&
      (pf.plan.per < 0 ? need < cur - MLINE_NEAR : need > cur + MLINE_NEAR);
    var slows = need !== null && cur > 0 &&
      (pf.plan.per < 0 ? need > cur + MLINE_NEAR : need < cur - MLINE_NEAR);
    if (late && speeds) {
      if (mHushed(k, 'act:' + need)) return '';
      var why = meas && mBurn(pr) && Math.abs(meas.tdee - mBurn(pr).tdee) > 100
        ? ' Your body is burning about ' + fmt(meas.tdee) + ' a day, not the ' +
          fmt(Math.round(mBurn(pr).tdee)) + ' the formula guessed.' : '';
      return mLineHTML('act', '▲', head,
        est + why + ' ' + (capped
          ? (pf.capHigh ? 'The most your body can put to use is ' : 'The lowest it’s safe to go is ') +
            fmt(need) + ' — that brings the date closer, not all the way.'
          : (need < cur ? 'Dropping to ' : 'Raising it to ') + fmt(need) + ' brings it back to ' + goalD + '.'),
        [['Use ' + fmt(need), 'mline:eat:' + need],
          [cur > 0 ? 'Keep ' + fmt(cur) : 'Not now', 'mline:none:act:' + need]]);
    }
    if (early && slows) {
      var room = need;
      if (mHushed(k, 'ahead:' + room)) return '';
      var more = room > cur;
      return mLineHTML('ahead', '▼', head,
        est + ' ' + (more ? 'You could eat ' + fmt(room) + ' and still make it.'
          : fmt(room) + ' a day lands you right on ' + goalD + '.'),
        [['Use ' + fmt(room), 'mline:eat:' + room],
          [cur > 0 ? 'Keep ' + fmt(cur) : 'Not now', 'mline:none:ahead:' + room]]);
    }
    if (mCoachQuiet(k, 'calm:' + cur + ':' + pace)) return '';
    return mLineHTML('calm', late ? '◎' : '✓', head,
      est + ' Keep eating ' + fmt(cur) + ' a day.', null, 'coach');
  }

  /* `why`, when given, keys a line whose reason is folded behind "why?":
     the line says what happened, and the explanation opens in place. */
  function mLineHTML(kind, icon, text, sub, acts, why) {
    return '<div class="mline ' + kind + '" role="status">' +
      '<span class="mline-i" aria-hidden="true">' + icon + '</span>' +
      '<span class="mline-b">' +
        '<span class="mline-t">' + text + (sub && why ? ' ' + mWhyBtn(why) : '') + '</span>' +
        (sub ? (why ? mInfoText(why, sub, 'mline-s') : '<span class="mline-s">' + sub + '</span>') : '') +
        (acts ? '<span class="mline-a no-print">' + acts.map(function (a, i) {
          return '<button class="' + (i ? 'ghost' : 'btn-primary') + '" data-mline="' +
            esc(a[1]) + '">' + esc(a[0]) + '</button>';
        }).join('') + '</span>' : '') +
      '</span>' +
    '</div>';
  }

  /* ---- quiet by default
   *
     Help that never changes is behind an i, and a reason is behind "why?":
     both open in place, and stay open for the rest of the visit. They are
     toggled where they stand rather than by a redraw, so opening one never
     moves the sheet under the finger. Blake: "notes only when something
     changed, as one short line with 'why?' to expand; settings help behind
     \u24d8". */
  var MINFO = {};
  function mInfoBtn(key, label) {
    var open = !!MINFO[key];
    return '<button type="button" class="m-info" data-minfo="' + esc(key) + '" aria-controls="mi-' + esc(key) +
      '" aria-expanded="' + open + '" aria-label="' + esc(label || 'What this means') + '">' +
      '<span aria-hidden="true">i</span></button>';
  }
  function mWhyBtn(key) {
    return '<button type="button" class="m-why" data-minfo="' + esc(key) + '" aria-controls="mi-' + esc(key) +
      '" aria-expanded="' + !!MINFO[key] + '">why?</button>';
  }
  function mInfoText(key, html, cls) {
    return '<span class="m-info-t ' + (cls || '') + '" id="mi-' + esc(key) + '"' +
      (MINFO[key] ? '' : ' hidden') + '>' + html + '</span>';
  }
  /* A note that says the same thing it said on an earlier day says nothing
     new: it is shown on the day it first says it, and again only once what
     it says has changed. Remembered on this phone only — it is about what
     this screen has shown, not about the plan. */
  function mCoachQuiet(k, sig) {
    var seen = mLsJson('bsc.macroCoachSeen') || {};
    if (seen.sig === sig && seen.k && seen.k < k) return true;
    if (seen.sig !== sig) {
      try { localStorage.setItem('bsc.macroCoachSeen', JSON.stringify({ sig: sig, k: k })); } catch (e) { /* private mode */ }
    }
    return false;
  }

  // whether Strengthen is up to open the weekly check-in it draws
  function mWeekOn() { return !!(window.Train && window.Train.openCheckin); }

  return { mMorningHTML: mMorningHTML, mLineHTML: mLineHTML, mInfoBtn: mInfoBtn, mWhyBtn: mWhyBtn, mInfoText: mInfoText, mWeekOn: mWeekOn, MLINE_NEAR: MLINE_NEAR, MINFO: MINFO };
};
