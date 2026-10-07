/* The food sheet, opened from a plate: what one of it is, the parts of a
 * meal kept together, and an amount in any unit the table weighs the food
 * in, with its nutrients and an Add (mFoodSheetHTML, mFsAmt, mFsState,
 * mFsRefresh). The longer account is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.foodsheet(app) once, as it starts, and keeps what it gives back
 * under the same names. The recipes by id (BY_ID) are read through LIVE
 * (tests/scope.test.js holds the lists to each other). Loaded before
 * app.js.
 */
(window.HiveParts = window.HiveParts || {}).foodsheet = function (app) {
  'use strict';

  // what it reads of the app's, and (LIVE) what the app replaces as it goes: BY_ID
  var S = app.S;
  var fixUnit = app.fixUnit;
  var fmtNum = app.fmtNum;
  var mByGram = app.mByGram;
  var mDialUnit = app.mDialUnit;
  var mMacLine = app.mMacLine;
  var mNextMeal = app.mNextMeal;
  var mPortionText = app.mPortionText;
  var mReadSlots = app.mReadSlots;
  var mSlotName = app.mSlotName;
  var mpLastXs = app.mpLastXs;
  var LIVE = app.LIVE;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function $(id) { return document.getElementById(id); }

  /* ---- the food sheet: an amount, and Add
   *
     Blake: "An amount/unit box and an Add button on the food detail screen,
     plus fibre/sodium and any other nutrients the table has." The amount
     starts where every add starts (what you logged last time, else one of
     it) and can be said in any unit the table weighs the food in; the Add
     goes to the meal the plate was on, or to the meal you choose. */
  /* Grams in one x of a food whose unit is itself a weight: "100 g", which
     is how the USDA and Open Food Facts hand over a food with no household
     measure. It carries no grams of its own, so this page offered it in
     "× 100 g" servings, where 50 typed meant five kilos. The meal's sheet
     reads the same unit the same way (mLabelServing, src/portion.js). */
  function mFsGramUnit(r) {
    var m = r && r.food && !r.grams && /^\s*(\d+(?:\.\d+)?)\s+(?:g|grams?)\s*$/i.exec(String(r.unit || ''));
    return m && Number(m[1]) > 0 ? Number(m[1]) : 0;
  }
  function mFsPer(r) { return r.grams || mFsGramUnit(r); }
  function mFsUnits(r) {
    if (mFsGramUnit(r)) return [{ u: 'g', g: 1 }];
    if (!r.food || !r.grams) return [{ u: mDialUnit(r), g: 0 }];
    var key = String(r.id).slice(2), N = window.Nutrition;
    var f = N && N.FOODS && N.FOODS[key];
    var own = { u: r.unit === 'each' ? 'whole' : String(r.unit), g: r.grams };
    var out = mByGram(r) ? [{ u: 'g', g: 1 }, own] : [own, { u: 'g', g: 1 }];
    if (r.unit === 'g') out = [{ u: 'g', g: 1 }];
    Object.keys((f && f.g) || {}).forEach(function (u) {
      var w = u === 'each' ? 'whole' : u;
      if (!(f.g[u] > 0) || out.some(function (o) { return o.u === w; })) return;
      out.push({ u: w, g: f.g[u] });
    });
    return out;
  }
  function mFsX(r, amt, unit) {
    var n = Number(amt);
    if (!isFinite(n) || n <= 0) return null;
    var per = mFsPer(r);
    var x = unit && unit.g && per ? n * unit.g / per : n;
    return Math.round(x * 10000) / 10000;
  }
  function mFsAmt(r, x, unit) {
    var per = mFsPer(r);
    var n = unit && unit.g && per ? x * per / unit.g : x;
    return unit && unit.u === 'g' ? Math.round(n) : Math.round(n * 100) / 100;
  }
  var MNUTR = [['kcal', 'Calories', ''], ['p', 'Protein', 'g'], ['f', 'Fat', 'g'], ['c', 'Carbs', 'g'],
    ['fib', 'Fibre', 'g'], ['na', 'Sodium', 'mg']];
  function mFsNutrHTML(r, x) {
    var mac = r.macro || {}, known = {};
    var row = function (lab, v, u) {
      return '<div class="mfs-nr"><span>' + esc(lab) + '</span><b>' + v + (u ? ' ' + u : '') + '</b></div>';
    };
    var out = MNUTR.map(function (n) {
      known[n[0]] = 1;
      var v = (Number(mac[n[0]]) || 0) * x;
      // whole grams, as the plate's own line says them; fibre to a tenth
      return row(n[1], n[0] === 'fib' ? String(Math.round(v * 10) / 10) : Math.round(v).toLocaleString(), n[2]);
    });
    // anything else the table carries for it, named as the table names it
    Object.keys(mac).forEach(function (k2) {
      if (known[k2] || typeof mac[k2] !== 'number') return;
      out.push(row(k2, String(Math.round(mac[k2] * x * 10) / 10), ''));
    });
    return out.join('');
  }
  function mFsState(r) {
    var o = S.foodOpen, units = mFsUnits(r);
    var ui = Math.min(units.length - 1, Math.max(0, Number(o.u) || 0));
    var amt = o.amt !== undefined ? o.amt : mFsAmt(r, mpLastXs()[r.id] || 1, units[ui]);
    return { units: units, ui: ui, amt: amt, x: mFsX(r, amt, units[ui]) };
  }
  // the numbers under the box, as it is typed in
  function mFsRefresh() {
    var o = S.foodOpen, r = o && LIVE.BY_ID[o.id], box = $('mfsAmt');
    if (!r || !box) return;
    o.amt = box.value;
    o.u = Number(($('mfsUnit') || {}).value) || 0;
    var st = mFsState(r), now = $('mfsNow'), go = $('mfsAdd');
    if (now) now.innerHTML = st.x ? mFsNutrHTML(r, st.x) : '<div class="mslot-empty">Type how much.</div>';
    if (go) go.disabled = !st.x;
  }

  /* A food, opened from its plate. Recipes have a sheet with steps in it;
     a food has nothing to cook, so this is the sheet that answers the two
     things a plate cannot: what one of it is (a cup, 130 grams), and for a
     meal you kept together, the parts it was made of and what each brought.
     The totals are at the plate's own portion, so they match the row that
     was pressed rather than a nominal "one". */
  function mFoodSheetHTML() {
    var o = S.foodOpen || {}, r = LIVE.BY_ID[o.id];
    if (!r) return '';
    var x = o.x > 0 ? o.x : 1;
    var mac = r.macro || {};
    var parts = r.parts || [];
    var partRows = parts.map(function (pt) {
      /* Each part at the portion it was kept at, scaled by how much of the
         plate is on the day. The part's own record may be gone (a table
         food renamed, an own food deleted), so the macro line is only drawn
         when it can still be worked out. */
      var pr = LIVE.BY_ID[pt.id];
      var px = (Number(pt.x) || 1) * x;
      var amount = pt.unit === 'each' ? fmtNum(px) + ' whole'
        : fmtNum(px) + ' ' + fixUnit(String(pt.unit || 'serving'), px);
      return '<div class="mfs-p">' +
        '<span class="mfs-pn">' + esc(pt.name) + '</span>' +
        '<span class="mfs-px">' + esc(amount) + '</span>' +
        (pr ? '<span class="mfs-pm">' + mMacLine(pr, px) + '</span>' : '') +
      '</div>';
    }).join('');
    return '<div class="scrim no-print" data-close="1">' +
      '<div class="sheet mt-sheet" role="dialog" aria-modal="true" aria-label="' + esc(r.name) + '">' +
        '<div class="sheet-top">' +
          '<div class="sheet-eyebrow">' + (parts.length ? 'A meal you kept' : 'A food') + '</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="mfs-name">' + esc(r.name) + '</div>' +
        '<div class="mfs-one">One of it: ' + esc(mPortionText(r, 1)) + '</div>' +
        /* What the packet declared, kept from the scan that made the food
           (src/camera.js), and said as whose list it is. */
        (r.alg && r.alg.length ? '<div class="mfs-alg"><b>Contains</b> ' + esc(r.alg.join(', ')) +
          ' <span>(Open Food Facts)</span></div>' : '') +
        (partRows ? '<div class="mt-div">What went in</div><div class="mfs-parts">' + partRows + '</div>' : '') +
        (o.onPlate === false ? '' :
          '<div class="mt-div">On your plate: ' + esc(mPortionText(r, x)) + '</div>' +
          '<div class="mk-tot">' + mMacLine(r, x) + '</div>' +
          '<div class="mfs-micro">' +
            '<span>&#127806; ' + (Math.round((mac.fib || 0) * x * 10) / 10) + ' g fibre</span>' +
            '<span>&#129474; ' + Math.round((mac.na || 0) * x).toLocaleString() + ' mg sodium</span>' +
          '</div>') +
        mFsAddHTML(r) +
      '</div></div>';
  }
  function mFsAddHTML(r) {
    var o = S.foodOpen, st = mFsState(r);
    var slots = mReadSlots().list;
    // the plate's own meal when it is still on the plan; otherwise, choose
    var own = !!o.slot && slots.some(function (sl) { return sl.k === o.slot; });
    var sk = own ? o.slot : (o.pick || (mNextMeal() || {}).k || '');
    return '<div class="mt-div">Add ' + (own ? 'more to ' + esc(mSlotName(o.slot)) : 'to a meal') + '</div>' +
      (own ? '' : '<div class="mp-meals mfs-meals">' + slots.map(function (sl) {
        return '<button data-mfsmeal="' + esc(sl.k) + '" aria-pressed="' + (sl.k === sk) + '">' + esc(sl.n) + '</button>';
      }).join('') + '</div>') +
      '<div class="mfs-amt">' +
        '<input id="mfsAmt" type="text" inputmode="decimal" autocomplete="off" aria-label="Amount" value="' +
          esc(String(st.amt)) + '">' +
        (st.units.length > 1
          ? '<select id="mfsUnit" aria-label="Unit">' + st.units.map(function (u, i) {
              return '<option value="' + i + '"' + (i === st.ui ? ' selected' : '') + '>' + esc(u.u) + '</option>';
            }).join('') + '</select>'
          : '<span class="mfs-u">' + esc(st.units[0].u) + '</span>') +
        '<button class="btn-primary" id="mfsAdd" data-mfsadd="' + esc(sk) + '"' + (st.x ? '' : ' disabled') + '>' +
          'Add to ' + esc(mSlotName(sk)) + '</button>' +
      '</div>' +
      '<div class="mfs-nutr" id="mfsNow">' + (st.x ? mFsNutrHTML(r, st.x) : '<div class="mslot-empty">Type how much.</div>') + '</div>';
  }

  return { mFsAmt: mFsAmt, mFsState: mFsState, mFsRefresh: mFsRefresh, mFoodSheetHTML: mFoodSheetHTML };
};
