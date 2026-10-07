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
  var mUsdaBarcode = app.mUsdaBarcode;
  var mQueryKind = app.mQueryKind;
  var LIVE = app.LIVE;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function $(id) { return document.getElementById(id); }

  /* A barcode, asked of Open Food Facts and then, if it does not know the
     packet or knows it without a nutrition table, of the USDA's packaged
     foods (mUsdaBarcode). Neither knowing it is said as that. A USDA that
     cannot be reached, or has no key here, leaves Open Food Facts' answer
     standing: "did not answer" is never upgraded to "does not exist". */
  function mBarcodeLookup(code) {
    return mOffLookup(code).catch(function (err) {
      var why = err && err.message;
      if (why !== 'none' && why !== 'nonutrition') throw err;
      return mUsdaBarcode(code).catch(function (u) {
        if (u && u.message === 'none' && why === 'none') throw new Error('nowhere');
        throw err;
      });
    });
  }
  function mOffLookup(code) {
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
      encodeURIComponent(code) + '.json?fields=product_name,brands,nutriments,serving_size,allergens_tags,' +
      'nutriscore_grade,nova_group,nova_groups_markers,nutrient_levels,ingredients_analysis_tags,' +
      'additives_tags,ingredients_text,ingredients_text_en' +
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
      /* Sodium and fiber on the same basis as the rest, from the same reply:
         they were always in it, and thrown away. Open Food Facts keeps sodium
         in grams, and sometimes only salt, which is sodium times 2.5. One the
         packet does not give stays null, so the form leaves its box empty
         rather than printing a 0 nobody read off a label. */
      var na = per('sodium').v, sa = per('salt').v, fb = per('fiber').v;
      var naMg = typeof na === 'number' ? na * 1000 : typeof sa === 'number' ? sa / 2.5 * 1000 : null;
      return [{
        name: [p.brands, p.product_name].filter(Boolean).join(' ') || ('Barcode ' + code),
        unit: e.serving ? (p.serving_size || 'serving') : '100 g',
        kcal: num2(e.v), p: num2(pr2.v), f: num2(fa.v), c: num2(ca.v),
        na: naMg === null ? null : Math.round(naMg), fib: typeof fb === 'number' ? Math.round(fb * 10) / 10 : null,
        alg: mAllergens(p.allergens_tags),
        off: mOffMore(p),
        code: String(code),
        note: 'Open Food Facts'
      }];
    });
  }

  /* What the packet declares, in plain words. Open Food Facts tags them
     "en:peanuts", "en:sesame-seeds"; a tag in another language is kept as
     its word. A short list on purpose: this is the label's "Contains" line,
     not a medical record, and twenty tags on a phone is a paragraph. */
  var ALLERGEN_WORD = { nuts: 'tree nuts', soybeans: 'soy', 'sesame-seeds': 'sesame', crustaceans: 'shellfish',
    'sulphur-dioxide-and-sulphites': 'sulphites' };
  function mAllergens(tags) {
    var out = [];
    (Array.isArray(tags) ? tags : []).forEach(function (t) {
      var w = String(t || '').replace(/^[a-z]{2}:/, '');
      w = ALLERGEN_WORD[w] || w.replace(/-/g, ' ');
      if (w && out.indexOf(w) < 0 && out.length < 8) out.push(w);
    });
    return out;
  }

  /* The rest of what Open Food Facts says about a packet, read the way the
     mockup Blake picked (2026-10-07, "D") shows it: the two grades, the
     traffic lights, what the ingredients say about it, and the ingredients
     themselves. Every part is optional and most US packets lack some of it,
     so an absent answer is left out rather than guessed at: no grade is no
     badge, an unknown vegetarian status is no tag, and "no additives" is
     only said when there is an ingredient list for that to be true of.
   *
     A Leaf score is deliberately not among them. It was tuned for a plate
     of food (tools/score-lib.js) and gives a can of cola 48, "worth
     eating": three of its six parts are full marks for a modest calorie
     count, no fat and no salt, which is a plate's virtue and a soda's whole
     description. The Nutri-Score grades the same can E. */
  function mOffMore(p) {
    var out = {};
    var ns = String(p.nutriscore_grade || '').toLowerCase();
    if (/^[a-e]$/.test(ns)) out.ns = ns;
    var nova = Number(p.nova_group);
    if (nova >= 1 && nova <= 4) out.nova = Math.round(nova);
    var lv = p.nutrient_levels || {}, levels = {};
    ['fat', 'saturated-fat', 'sugars', 'salt'].forEach(function (k) {
      if (/^(low|moderate|high)$/.test(lv[k])) levels[k] = lv[k];
    });
    if (Object.keys(levels).length) out.lv = levels;
    var an = Array.isArray(p.ingredients_analysis_tags) ? p.ingredients_analysis_tags : [];
    var has = function (t) { return an.indexOf('en:' + t) >= 0; };
    var tags = [];
    if (has('vegan')) tags.push('Vegan');
    else if (has('vegetarian')) tags.push('Vegetarian');
    else if (has('non-vegetarian')) tags.push('Not vegetarian');
    if (has('palm-oil')) tags.push('Palm oil');
    else if (has('palm-oil-free')) tags.push('No palm oil');
    else if (has('may-contain-palm-oil')) tags.push('May contain palm oil');
    var ingr = String(p.ingredients_text_en || p.ingredients_text || '').replace(/\s+/g, ' ').trim().slice(0, 1200);
    var adds = Array.isArray(p.additives_tags) ? p.additives_tags.map(mAdditive) : [];
    if (adds.length) tags.push(adds.length === 1 ? '1 additive: ' + adds[0] : adds.length + ' additives');
    else if (ingr && Array.isArray(p.additives_tags)) tags.push('No additives');
    if (tags.length) out.tags = tags;
    if (adds.length > 1) out.adds = adds.slice(0, 12);
    if (ingr) out.ingr = ingr;
    /* What made it NOVA 4, in Open Food Facts' own markers: an ingredient,
       an additive or the kind of food. Said in words, so the line can say
       why and the ingredients can be marked where the words appear. */
    var mk = p.nova_groups_markers && p.nova_groups_markers['4'];
    if (out.nova === 4 && Array.isArray(mk)) {
      var why = [];
      mk.forEach(function (m) {
        if (!Array.isArray(m) || m.length < 2) return;
        var w = m[0] === 'additives' ? mAdditive(m[1]) : String(m[1] || '').replace(/^[a-z]{2}:/, '').replace(/-/g, ' ');
        if (w && why.indexOf(w) < 0 && why.length < 6) why.push(w);
      });
      if (why.length) out.why = why;
    }
    return out;
  }

  /* An additive by the name on an American label rather than its E number.
     The common ones only; anything else keeps its number, which is at
     least searchable. */
  var ADDITIVE = { e100: 'turmeric colour', e101: 'riboflavin', e102: 'Yellow 5', e110: 'Yellow 6', e120: 'carmine',
    e129: 'Red 40', e133: 'Blue 1', e150: 'caramel colour', e160a: 'beta-carotene', e160b: 'annatto', e160c: 'paprika extract',
    e171: 'titanium dioxide', e200: 'sorbic acid', e202: 'potassium sorbate', e211: 'sodium benzoate', e250: 'sodium nitrite',
    e260: 'acetic acid', e270: 'lactic acid', e282: 'calcium propionate', e296: 'malic acid', e300: 'vitamin C',
    e306: 'tocopherols', e319: 'TBHQ', e320: 'BHA', e321: 'BHT', e322: 'lecithin', e330: 'citric acid',
    e331: 'sodium citrate', e339: 'sodium phosphate', e341: 'calcium phosphate', e407: 'carrageenan', e412: 'guar gum',
    e415: 'xanthan gum', e440: 'pectin', e450: 'diphosphates', e460: 'cellulose', e466: 'cellulose gum',
    e471: 'mono- and diglycerides', e472e: 'DATEM', e481: 'sodium stearoyl lactylate', e500: 'sodium carbonates',
    e500ii: 'baking soda', e509: 'calcium chloride', e551: 'silicon dioxide', e621: 'MSG', e627: 'disodium guanylate',
    e631: 'disodium inosinate', e950: 'acesulfame K', e951: 'aspartame', e955: 'sucralose', e1422: 'modified starch' };
  function mAdditive(tag) {
    var t = String(tag || '').replace(/^[a-z]{2}:/, '').toLowerCase();
    return ADDITIVE[t] || ADDITIVE[t.replace(/^(e\d+)[a-z]*$/, '$1')] || t.toUpperCase();
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
    if (why === 'nowhere') return (code || 'That') + ' is not in Open Food Facts or the USDA\u2019s packaged foods. Type what it was below.';
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
