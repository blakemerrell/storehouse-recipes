/* The day's summary card: the one you get for closing a day, and the one
 * the menu opens for any day. A sentence first, then the numbers that
 * back it (mSummaryHTML). The longer account is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.summary(app) once, as it starts, and keeps what it gives back
 * under the same names. Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).summary = function (app) {
  'use strict';

  // what it reads of the app's
  var mDayJudged = app.mDayJudged;
  var mDaySummary = app.mDaySummary;
  var mLongDate = app.mLongDate;
  var mVerdict = app.mVerdict;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* The card you get for closing a day, and the one the menu opens for any
     day. Deltas signed and named the way the pills are — over and short, not
     plus and minus — so the two say the same thing in the same words. */
  /* The card you get for closing a day, and the one the menu opens for any
     day.
   *
     A sentence before a number. At nine at night the useful thing is what
     kind of day it was; the arithmetic is the evidence for it, not the
     headline. Everything below is read back through mTotals and mDayTargets —
     the same two the pills at the top use — so the card and the strip cannot
     come to different conclusions about what you ate. */
  function mSummaryHTML(k) {
    var s = mDaySummary(k);
    var title = mLongDate(k);
    var dk = s.got - s.want;

    /* One clause about the thing that actually went wrong, in the order a
       person notices it: did you eat the day, then did you get the protein. */
    var says;
    /* Today with dinner still to come is not a day that went anywhere yet:
       what is left is the news, and only over — already true, whatever comes
       next — keeps its warning. See mDayJudged. */
    var open = !mDayJudged(k);
    var pLeft = s.rows[0].want - s.rows[0].got;
    var toGo = open && s.any && mVerdict('kcal', s.got, s.want) !== 'over' && s.got < s.want;
    if (open && !s.any) {
      says = 'Nothing written down yet.';
    } else if (toGo) {
      says = '<b>' + (s.want - s.got).toLocaleString() + ' kcal to go</b>' +
        (pLeft > 0 ? ' and <b>' + pLeft + ' g protein to go</b>.' : ', with the protein already in.');
    } else if (open && pLeft > 20 && dk > s.want * 0.12) {
      says = 'Over by <b>' + Math.abs(dk) + '</b> already, with <b>' + pLeft + ' g protein to go</b>.';
    } else if (!s.any) {
      says = 'Nothing was written down on this day.';
    } else if (s.thin && !open) {
      says = 'Only <b>' + s.got.toLocaleString() + '</b> written down. Either a very light day ' +
        'or one that stopped being logged — this cannot tell those apart, and does not guess.';
    } else if (dk > s.want * 0.12 && s.rows[0].got - s.rows[0].want < -20) {
      says = 'Over by <b>' + Math.abs(dk) + '</b> and <b>' +
        Math.abs(s.rows[0].got - s.rows[0].want) + ' g short on protein</b>. ' +
        'The calories went somewhere that was not protein.';
    } else if (dk > s.want * 0.12) {
      says = '<b>' + Math.abs(dk) + ' over</b>, with the protein where it should be.';
    } else if (s.rows[0].got - s.rows[0].want < -20) {
      says = open ? 'The calories are in, with <b>' + pLeft + ' g protein to go</b>.'
        : 'Calories landed, but <b>' + Math.abs(s.rows[0].got - s.rows[0].want) +
          ' g short on protein</b>.';
    } else if (mVerdict('kcal', s.got, s.want) === 'on' && mVerdict('p', s.rows[0].got, s.rows[0].want) === 'on') {
      says = 'On the day and on the protein. <b>Nothing to fix.</b>';
    } else {
      says = 'Close enough on both.';
    }

    /* The ring carries the OVERSHOOT as well as the fill. A bar that stops at
       a hundred per cent cannot tell fourteen hundred from twenty-one; past
       target this keeps going on an inner track, so busting the day looks
       like busting the day. */
    var R = 55, C = 2 * Math.PI * R, R2 = 41, C2 = 2 * Math.PI * R2;
    var pct = s.want ? s.got / s.want : 0;
    var over = Math.max(0, Math.min(1, pct - 1));
    /* The bars' verdict, not one of its own: this ring went red at 105%
       over a bar that called the same day on target, under a line that said
       "Close enough". */
    var dayV = mVerdict('kcal', s.got, s.want);
    var ringCol = dayV === 'over' ? 'var(--dial-over)' : dayV === 'under' ? 'var(--ochre)' : 'var(--green)';
    var ring = '<div class="ds-ring"><svg viewBox="0 0 132 132" aria-hidden="true">' +
      '<circle class="t" cx="66" cy="66" r="' + R + '"></circle>' +
      '<circle class="f" cx="66" cy="66" r="' + R + '" stroke="' + ringCol + '" ' +
        'stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' +
        (C * (1 - Math.min(1, pct))).toFixed(1) + '"></circle>' +
      (over > 0 ? '<circle class="o" cx="66" cy="66" r="' + R2 + '" stroke-dasharray="' +
        C2.toFixed(1) + '" stroke-dashoffset="' + (C2 * (1 - over)).toFixed(1) + '"></circle>' : '') +
      '</svg><span class="ds-ring-m"><b>' + s.got.toLocaleString() + '</b>' +
      '<i>of ' + s.want.toLocaleString() + '</i></span></div>';

    /* Protein, day by day. The week's fact, sitting inside the day. */
    var pips = '<div class="ds-pips">' + s.week.map(function (w) {
      /* Nor is today's protein a miss while there is a dinner to come. */
      var c = w.hit === null ? '' : w.hit ? (w.today ? ' today' : ' hit') : (w.today && open ? '' : ' miss');
      return '<span class="ds-pip' + c + '"></span>';
    }).join('') + '</div><div class="ds-sub">protein, day by day</div>';

    /* A mark where the target sits, so "how far past" is a distance you can
       see rather than a subtraction you have to do. */
    var bars = s.rows.map(function (r) {
      var top = Math.max(r.got, r.want) * 1.15 || 1;
      var bust = r.got > r.want * 1.08;
      return '<div class="ds-m"><span class="ds-mk ' + r.kk + '">' +
        r.kk.toUpperCase() + '</span>' +
        '<span class="ds-mt"><span class="ds-mb ' + (bust ? 'bust' : r.kk) + '" style="width:' +
          (100 * r.got / top).toFixed(1) + '%"></span>' +
          '<span class="ds-mk-t" style="left:' + (100 * r.want / top).toFixed(1) + '%"></span>' +
        '</span>' +
        '<span class="ds-mv"><b>' + r.got + '</b> / ' + r.want + ' g</span></div>';
    }).join('');

    var top = 1;
    s.week.forEach(function (w) { if (w.kcal) top = Math.max(top, w.kcal, w.want); });
    top = top * 1.12;
    var week = '<div class="ds-week">' + s.week.map(function (w) {
      if (w.kcal === null) {
        return '<span class="ds-wk none" title="' + esc(w.k) + ' — nothing logged">' +
          '<i style="height:8px"></i></span>';
      }
      return '<span class="ds-wk' + (w.today ? ' today' : '') +
        (w.v === 'over' ? ' over' : '') + '" title="' + esc(w.k) + ' — ' +
        w.kcal.toLocaleString() + ' of ' + w.want.toLocaleString() + '">' +
        '<i style="height:' + (100 * w.kcal / top).toFixed(1) + '%"></i></span>';
    }).join('') + '<span class="ds-line" style="top:' +
      (100 - 100 * s.want / top).toFixed(1) + '%"><span>target</span></span></div>' +
      '<div class="ds-days">' + s.week.map(function (w) {
        return '<span' + (w.today ? ' class="today"' : '') + '>' + esc(w.lab) + '</span>';
      }).join('') + '</div>';

    /* The palette's own four (--split-a to -d in src/style.css), so a dark
       screen can repaint them and each is deep enough to carry the paper
       share written on it — the first two used to be too light to. */
    var COL = ['var(--split-a)', 'var(--split-b)', 'var(--split-c)', 'var(--split-d)'];
    var split = s.meals.length
      ? '<div class="ds-split">' + s.meals.map(function (m, i) {
          var pc = m.kcal / (s.mTot || 1);
          return '<span style="flex:' + m.kcal + ' 1 0;background:' + COL[i % 4] + '">' +
            (pc > 0.14 ? esc(m.n.slice(0, 1)) + ' ' + Math.round(pc * 100) + '%' : '') + '</span>';
        }).join('') + '</div>' +
        '<div class="ds-splitl"><span>' + esc(s.meals.map(function (m) { return m.n; }).join(' · ')) +
        '</span><span><b>' + Math.round(100 * s.biggest.kcal / (s.mTot || 1)) + '%</b> in ' +
        esc(s.biggest.n.toLowerCase()) + '</span></div>'
      : '';

    var dv = s.got - s.avg;
    var facts = '<div class="ds-facts">' +
      (s.avg ? '<div class="ds-fact"><em>' + (dv > 0 ? '+' : '') + dv + '</em><span>against your ' +
        'seven-day average of <b>' + s.avg.toLocaleString() + '</b></span></div>' : '') +
      (s.kept ? '<div class="ds-fact"><em>' + s.onP + '/' + s.kept + '</em><span>days on protein, ' +
        'of the ones you wrote down</span></div>' : '') +
    '</div>';

    return '<div class="scrim no-print" data-close="1">' +
      '<div class="sheet ds-sheet" role="dialog" aria-modal="true" aria-label="How the day went">' +
        '<div class="sheet-top">' +
          '<div class="sheet-eyebrow">' + (open ? 'How the day is going' : 'How the day went') + '</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="ds-day">' + esc(title) + '</div>' +
        '<p class="ds-says">' + says + '</p>' +
        (s.any
          ? '<div class="ds-hero">' + ring +
              (toGo
                ? '<div class="ds-side"><div class="ds-d togo">' + (s.want - s.got).toLocaleString() + '</div>' +
                  '<div class="ds-sub">calories to go</div>' + pips
                : '<div class="ds-side"><div class="ds-d ' +
                  mVerdict('kcal', s.got, s.want) + '">' +
                  (dk > 0 ? '+' : '') + dk + '</div>' +
                  '<div class="ds-sub">calories against target</div>' + pips) +
              '</div>' +
            '</div>' +
            '<div class="ds-macros">' + bars + '</div>' +
            '<div class="ds-blk"><div class="ds-h">The seven days to here</div>' + week + '</div>' +
            (split ? '<div class="ds-blk"><div class="ds-h">Where the day went</div>' +
              split + '</div>' : '') +
            (facts.indexOf('ds-fact') > 0
              ? '<div class="ds-blk"><div class="ds-h">Against your week</div>' + facts + '</div>'
              : '')
          : '') +
        '<div class="sync-row"><button class="btn-primary sheet-done">Done</button></div>' +
      '</div>' +
    '</div>';
  }

  return { mSummaryHTML: mSummaryHTML };
};
