/* The week you are in, seven blocks wide (mWeekHTML): each day's letter,
 * its date, and the colour of how it went, with the target's place along
 * each square's rail (MWK_GOAL). No words on it: the colour is the verdict,
 * and the button's label says it to a listener. The longer account is with
 * the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.weekstrip(app) once, as it starts, and keeps what it gives back
 * under the same name. Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).weekstrip = function (app) {
  'use strict';

  // what it reads of the app's
  var MDAYS = app.MDAYS;
  var M_MONS = app.M_MONS;
  var M_WDAYS = app.M_WDAYS;
  var dayKey = app.dayKey;
  var kcalOf = app.kcalOf;
  var keyDate = app.keyDate;
  var mDay = app.mDay;
  var mDayDone = app.mDayDone;
  var mDayJudged = app.mDayJudged;
  var mDayTargets = app.mDayTargets;
  var mEarliestKey = app.mEarliestKey;
  var mIsTrainingDay = app.mIsTrainingDay;
  var mLatestKey = app.mLatestKey;
  var mTotals = app.mTotals;
  var mVerdict = app.mVerdict;

  /* The strip carries no words (Blake, 2026-09-27: "It's visual for a
     reason"): each day's verdict is its colour, and the button's label says
     it to a listener. */

  /* The week you are in, seven blocks wide: each day's letter, its date, and
     the colour of how it went. The dropdown could only be read one option at
     a time, so "how did this week go" meant opening it seven times. Days
     ahead of today are shown but not reachable — the day is a record, not a
     diary you write forward into. */
  /* Where the target sits along each square's rail, as a fraction of it. Two
     thirds: enough of the rail before it to read a half-eaten day, enough
     after it to tell 103% from 140%. */
  var MWK_GOAL = 0.66;

  function mWeekHTML(k, todayK) {
    var cur = keyDate(k);
    var mon = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate());
    mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));       // week starts Monday
    var out = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
      var dk = dayKey(d);
      var ahead = dk > mLatestKey(), tooOld = dk < mEarliestKey();
      /* Each day's own target, because a training day is not asking for the
         same thing as a rest day — a strip showing one number for all seven
         would be describing a plan nobody is on. */
      var tK = kcalOf(mDayTargets(dk));
      var train = mIsTrainingDay(dk);
      var dayObj = MDAYS[dk] ? mDay(dk) : null;
      var gotRaw = dayObj ? mTotals(dayObj).all.kcal : 0;
      var got = Math.round(gotRaw);
      /* The bars' verdict, on the unrounded figure the bars judge: rounding
         here first put a day at 2,130.25 of 2,000 "over" on the bar and
         "close" on the strip. Rounded only for what is printed. */
      var state = !got || !tK ? '' : ' ' + mVerdict('kcal', gotRaw, tK);
      /* A ring is a day in progress; a filled circle is a day that has been
         eaten to the end. The colour is the same verdict either way — under,
         on, or over its target — so the week reads at a glance. */
      var done = dayObj ? mDayDone(dayObj) : false;
      /* No words under the week at all. Blake: "Didn't need the words close
         or over or whatever either under that week chart. It's visual for a
         reason." The bar's fill and colour are the verdict; the label still
         says it to a listener. */
      var word = '';
      /* A day still being eaten says what is left rather than how it went,
         and its colour steps aside with the word. */
      /* No word while it is still being eaten. Blake: "The 27 to go text
         under the bar at the top. It can go away." The ring above already
         says what is left; the strip only speaks once the day is judged. */
      if (dk === k && state && state !== ' over' && got < tK && !mDayJudged(dk)) {
        state = ' open';
      }
      /* How FAR off, inside the square that already says which side of the
         line it fell on.
       *
         Blake: "Right now I'm just seeing a lot of red and even though I'm
         close on some days I'm over so it's red." He is right, and the
         threshold is not the fix: a day one calorie past the line looks
         exactly like a day four hundred past it wherever the line is put.
         Moving a threshold moves the cliff; this removes it.
       *
         The goal sits two thirds along the rail on every square, so the
         seven marks line up and a day can be read against its neighbours as
         well as against its own target. That leaves the last third for the
         overshoot: 151% of target fills the rail, and anything past that
         pins — by which point the colour has said everything the length
         could add. */
      /* A bar now, not a square with a rail in it. Blake: "make the heat
         map icons a pill bar chart for how the day did, subtle target line
         and gradient blue to green to ochre" — and the gradient is what the
         rail's comment above was reaching for: no cliff at all. The fill
         rises through one gradient fixed to the track, blue at the foot,
         green across the target line, ochre above it, so the colour at the
         tip IS the distance, and a day at 104% is a green bar a hair past
         the line rather than a red square. */
      var spark = '';
      if (got && tK) {
        var ratio = got / tK;
        spark = '<i style="height:' + Math.min(100, ratio * 100 * MWK_GOAL).toFixed(1) + '%"></i>';
      }
      out.push('<button class="mwk-d' + (dk === k ? ' now' : '') + state +
        (train ? ' train' : '') + (done ? ' done' : '') + '"' +
        (ahead || tooOld ? ' disabled' : '') +
        ' data-mweek="' + dk + '" aria-pressed="' + (dk === k ? 'true' : 'false') + '"' +
        ' aria-label="' + M_WDAYS[d.getDay()] + ' ' + M_MONS[d.getMonth()] + ' ' + d.getDate() +
        (train ? ', lifting day' : '') + ', ' + tK + ' calorie target' +
        (got ? ', ' + got + (done ? ' eaten, all done' : ' on the day') : '') + '">' +
        /* A lifting day wears a small dumbbell beside its letter. It was a
           middle dot the size of a full stop, in ochre, which nobody could be
           expected to decode; the button's label says "lifting day" for
           anyone listening, and the title says it to a pointer. */
        '<span class="mwk-w">' + M_WDAYS[d.getDay()].slice(0, 1) + '</span>' +
        /* The track and the target line are on every day, food or not, so
           the seven lines read as one line across the week. A lifting day's
           dumbbell sits inside the box at its foot, over the fill (Blake's
           pick B, 2026-09-27), not beside the letter. */
        '<span class="mwk-c" aria-hidden="true">' +
          '<span class="mwk-b">' + spark +
            (train ? '<svg class="mwk-lift" viewBox="0 0 14 8" aria-hidden="true">' +
              '<title>Lifting day</title>' +
              '<path d="M1 2.5v3M3.2 1v6M10.8 1v6M13 2.5v3M3.2 4h7.6" fill="none" ' +
                'stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' : '') +
          '</span><span class="mwk-g"></span>' +
        '</span>' +
        '<span class="mwk-n"><b>' + d.getDate() + '</b></span>' +
        '<span class="mwk-s">' + (word || '&nbsp;') + '</span>' +
      '</button>');
    }
    return out.join('');
  }

  return { mWeekHTML: mWeekHTML };
};
