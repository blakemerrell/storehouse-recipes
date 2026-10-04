/* The day as plain text, for typing into something else: weight first,
 * then every plate with its portion and numbers, then the totals
 * (mDayText), and the button that copies it (mCopyDay). The longer account
 * is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.daycopy(app) once, as it starts, and keeps what it gives back
 * under the same names. The recipe index, which the app replaces as it
 * goes, is read through LIVE (tests/scope.test.js holds the lists to each
 * other). Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).daycopy = function (app) {
  'use strict';

  // what it reads of the app's, and (LIVE) what the app replaces as it goes: BY_ID
  var MWEIGHTS = app.MWEIGHTS;
  var kcalOf = app.kcalOf;
  var keyDate = app.keyDate;
  var mDay = app.mDay;
  var mDayTargets = app.mDayTargets;
  var mLongDate = app.mLongDate;
  var mPortionText = app.mPortionText;
  var mReadSlots = app.mReadSlots;
  var mTotals = app.mTotals;
  var mViewKey = app.mViewKey;
  var LIVE = app.LIVE;

  /* The day as plain text, for typing into something else. Phones hand the
     clipboard around better than they hand files around, and Google Fit's
     own entry is manual anyway — so this is the day laid out the way you
     would read it into another app: weight first, then every plate with its
     portion and its numbers, then the totals. */
  function mDayText(k) {
    var day = mDay(k);
    var slots = mReadSlots();
    var d = keyDate(k);
    var out = ['Nourish \u2014 ' + mLongDate(k) + ' ' + d.getFullYear()];
    if (MWEIGHTS[k]) out.push('Weight: ' + MWEIGHTS[k] + ' lb');
    out.push('');
    var named = [];
    slots.list.forEach(function (sl) { named.push([sl.k, sl.n]); });
    Object.keys(day).forEach(function (sk) {
      if (!named.some(function (n) { return n[0] === sk; })) named.push([sk, slots.names[sk] || 'Meal']);
    });
    named.forEach(function (pair) {
      var items = (day[pair[0]] || []).filter(function (it) { return LIVE.BY_ID[it.id]; });
      if (!items.length) return;
      out.push(pair[1] + ':');
      var mt = { kcal: 0, p: 0, f: 0, c: 0 };
      items.forEach(function (it) {
        var r = LIVE.BY_ID[it.id];
        var mac = r.macro || {};
        mt.kcal += (mac.kcal || 0) * it.x; mt.p += (mac.p || 0) * it.x;
        mt.f += (mac.f || 0) * it.x; mt.c += (mac.c || 0) * it.x;
        /* The same portion words the card uses, from the same function \u2014 the
           line here had its own copy of the servN multiplication and so its
           own copy of the overstatement that came with it. */
        out.push('  ' + (it.eaten ? '[x] ' : '[ ] ') + r.name +
          ' (' + mPortionText(r, it.x) + ')' +
          ' \u2014 ' + Math.round((mac.kcal || 0) * it.x) + ' kcal, ' +
          Math.round((mac.p || 0) * it.x) + 'g protein, ' +
          Math.round((mac.f || 0) * it.x) + 'g fat, ' +
          Math.round((mac.c || 0) * it.x) + 'g carbs');
      });
      /* The meal's own line. Anything you are typing this into logs a meal at
         a time — Google Fit included — so the subtotal has to be here rather
         than added up on a thumb. */
      if (items.length > 1) {
        out.push('  = ' + Math.round(mt.kcal) + ' kcal, ' + Math.round(mt.p) +
          'g protein, ' + Math.round(mt.f) + 'g fat, ' + Math.round(mt.c) + 'g carbs');
      }
    });
    var tot = mTotals(day), t = mDayTargets(k);
    out.push('');
    out.push('Total: ' + Math.round(tot.all.kcal) + ' kcal, ' + Math.round(tot.all.p) +
      'g protein, ' + Math.round(tot.all.f) + 'g fat, ' + Math.round(tot.all.c) + 'g carbs');
    out.push('Target: ' + kcalOf(t) + ' kcal, ' + t.p + 'g protein, ' + t.f + 'g fat, ' + t.c + 'g carbs');
    /* And the day's training, with the times, so a workout goes into the
       other app at the hour it happened. Only when there was some. */
    var tr = window.Train && window.Train.dayText ? window.Train.dayText(k) : [];
    if (tr && tr.length) { out.push(''); out = out.concat(tr); }
    return out.join('\n');
  }

  /* execCommand is the fallback because the async clipboard API is refused
     outside a secure context and on some in-app browsers — and this button
     is most wanted on exactly those. */
  function mCopyDay(btn) {
    var text = mDayText(mViewKey());
    /* What the button was before it was pressed, which is a glyph in a slot
       the width of a glyph. It used to put back the WORDS "Copy as text" —
       the comment said "the name it shipped with" and the name it shipped
       with is \u2398 — so one press turned an icon into a three-word label
       that wrapped onto three lines and climbed out of the bottom bar, and
       stayed that way for good. */
    /* Only the word under the icon changes, and back: the drawing stays
       where it is so the bar does not jump. */
    var w = btn.querySelector('.mday-w') || btn;
    var was = btn.getAttribute('data-was') || w.textContent;
    if (!btn.getAttribute('data-was')) btn.setAttribute('data-was', was);
    var said = function (ok) {
      w.textContent = ok ? 'Copied' : 'Press and hold';
      setTimeout(function () { w.textContent = btn.getAttribute('data-was'); }, 2200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { said(true); }, function () { said(false); });
      return;
    }
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    said(ok);
  }

  return { mCopyDay: mCopyDay };
};
