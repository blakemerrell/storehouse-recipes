/* Looking a code or a name up: a barcode in the open food databases
 * (mBarcodeLookup), what a failed lookup says, in one place (mLookSay), the
 * rows an answer becomes (mLookupRows), and the food tables asked once you
 * have stopped typing, one request per word, late answers dropped
 * (mpLookSoon, mLookNet). The longer account is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.lookup(app) once, as it starts, and keeps what it gives back
 * under the same names. The answers kept so far and the count that drops
 * late ones (MLOOKUP, mLookSeq) stay declared in app.js; the part reaches
 * them through LIVE (tests/scope.test.js holds the lists to each other).
 * Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).lookup = function (app) {
  'use strict';

  // what it reads of the app's, and (LIVE) what the app replaces as it goes: MLOOKUP, mLookSeq
  var BUILD = app.BUILD;
  var S = app.S;
  var mFoodSearch = app.mFoodSearch;
  var mQueryKind = app.mQueryKind;
  var LIVE = app.LIVE;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function $(id) { return document.getElementById(id); }

  function mBarcodeLookup(code) {
    /* Open Food Facts asks callers to say who they are. A browser cannot set
       its own User-Agent, so their documented alternative is to name the app
       in the query — which costs nothing and is the difference between
       being a known caller and being anonymous traffic to be throttled.
     *
       Fifteen product reads a minute per address is the published limit, and
       a supermarket aisle is exactly where somebody scans four things in a
       row, so being turned away has to read as "wait a moment" rather than
       as "this is broken". Their full-text search lives in a separate
       service and is not part of this API, which is why the searching here
       is the USDA's job and the barcodes are theirs. */
    var url = 'https://world.openfoodfacts.org/api/v2/product/' +
      encodeURIComponent(code) + '.json?fields=product_name,brands,nutriments,serving_size' +
      '&app_name=' + encodeURIComponent('Hive and Hearth') +
      '&app_version=' + encodeURIComponent(BUILD);
    return fetch(url).then(function (r) {
      if (r.status === 429 || r.status === 503) throw new Error('toofast');
      return r.json();
    }).then(function (d) {
      var p = d && d.product;
      if (!p) throw new Error('none');
      var nu = p.nutriments || {};
      /* One basis for all four figures. Each used to fall back on its own —
         per serving where the packet gave one, per 100 g where it did not —
         and the label was chosen from the energy alone, so a product listing
         calories per serving and protein only per 100 g arrived as one row
         mixing the two under "per serving". Per serving only when every
         figure the packet gives has a serving value; otherwise all of them
         per 100 g, which is the one basis Open Food Facts always fills. */
      var has = function (k, b) { return typeof nu[k + '_' + b] === 'number'; };
      var serving = has('energy-kcal', 'serving') &&
        ['proteins', 'fat', 'carbohydrates'].every(function (k) {
          return has(k, 'serving') || !has(k, '100g');
        });
      var per = function (k) { return { v: nu[k + (serving ? '_serving' : '_100g')], serving: serving }; };
      var e = per('energy-kcal');
      var pr2 = per('proteins'), fa = per('fat'), ca = per('carbohydrates');
      /* A great many products in Open Food Facts are photographs and a name
         with no nutrition table behind them yet. Every figure comes back
         missing, and rounding a missing figure gives zero — which would put
         a plate on the day claiming to be free, and quietly wrong the whole
         day's arithmetic. Missing is not zero, and has to say so. */
      var known = [e.v, pr2.v, fa.v, ca.v].some(function (v) { return typeof v === 'number'; });
      if (!known) throw new Error('nonutrition');
      var num2 = function (v) { return typeof v === 'number' ? Math.round(v) : 0; };
      return [{
        name: [p.brands, p.product_name].filter(Boolean).join(' ') || ('Barcode ' + code),
        unit: e.serving ? (p.serving_size || 'serving') : '100 g',
        kcal: num2(e.v), p: num2(pr2.v), f: num2(fa.v), c: num2(ca.v),
        note: 'Open Food Facts'
      }];
    });
  }

  /* What a failed lookup says, in one place. It was written out three times
     — the picker's search, the barcode scan and the new-food form — and the
     copies had drifted: the scan called every failure "not in Open Food
     Facts", including no signal at all, which sent people to type in a
     product the database did have. `code` is the barcode, when there is one. */
  function mLookSay(err, code) {
    var why = err && err.message;
    if (why === 'nokey') return 'No USDA key in src/config.js, so only barcodes can be looked up.';
    if (why === 'toofast') return (code ? 'Open Food Facts is asking us to slow down.' : 'Asked too often just now.') +
      ' Wait a minute, or type it in below.';
    if (why === 'nonutrition') return (code ? code + ' is in Open Food Facts, but' : 'That one is known, but') +
      ' with no nutrition table yet. Read it off the packet below.';
    if (why === 'none') return (code || 'That') + ' is not in Open Food Facts. Type what it was below.';
    return (code ? 'Open Food Facts' : 'The food tables') + ' did not answer. Type it in below, or try again.';
  }

  function mLookupRows(list) {
    if (!list.length) return '<div class="mslot-empty">Nothing came back.</div>';
    return list.map(function (x, i) {
      LIVE.MLOOKUP[i] = x;
      return '<button class="mpick-row" data-nfpick="' + i + '">' +
        '<span class="mp-body"><span class="mp-name">' + esc(x.name) + '</span>' +
        '<span class="mp-fit">' + x.kcal + ' kcal &middot; ' + x.p + 'P &middot; ' + x.f +
        'F &middot; ' + x.c + 'C per ' + esc(x.unit) +
        (x.src ? ' <span class="mp-src">' + esc(x.src) + '</span>' : '') +
        '</span></span></button>';
    }).join('');
  }

  /* One request per word you finish typing, not one per keystroke.
   *
     600ms because it has to outlast the gap between two letters typed by a
     thumb and not feel like a pause. The query is re-read when the timer
     fires rather than captured when it is set, so backspacing to something
     shorter than three characters cancels the request that was in flight for
     the longer one. */
  var mpLookTimer = null;
  function mpLookSoon() {
    if (mpLookTimer) clearTimeout(mpLookTimer);
    mpLookTimer = setTimeout(function () {
      mpLookTimer = null;
      if (!S.macroPick) return;                    // the sheet closed under it
      var q = (S.mpQuery || '').trim();
      if (q.length < 3 || mQueryKind(q).k === 'barcode') return;
      if (!$('nfResults')) return;                 // nothing on screen wants it
      mLookNet(q);
    }, 600);
  }

  function mLookNet(term) {
    var mine = ++LIVE.mLookSeq;
    var res = $('nfResults');
    if (!res) return;
    res.innerHTML = '<div class="mslot-empty">Looking in the food tables&hellip;</div>';
    LIVE.MLOOKUP = {};
    mFoodSearch(term, false).then(function (list) {
      if (mine !== LIVE.mLookSeq || !$('nfResults')) return;
      $('nfResults').innerHTML = list.length
        ? '<div class="mt-div">From the food tables</div>' + mLookupRows(list) : '';
    }, function (err) {
      if (mine !== LIVE.mLookSeq || !$('nfResults')) return;
      $('nfResults').innerHTML = '<div class="mslot-empty">' + esc(mLookSay(err)) + '</div>' +
        /* The one place a tap is still the right answer: the network failed
           and only you know whether it is worth asking again. */
        (err && err.message === 'nokey' ? ''
          : '<button class="mpick-row mpick-new" data-mplook="' + esc(term) +
            '"><span class="mp-body"><span class="mp-name">Try the food tables again' +
            '</span></span></button>');
    });
  }

  return { mBarcodeLookup: mBarcodeLookup, mLookSay: mLookSay, mLookupRows: mLookupRows, mpLookSoon: mpLookSoon, mLookNet: mLookNet };
};
