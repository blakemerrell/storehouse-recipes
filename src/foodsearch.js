/* Looking a food up instead of guessing at it: the food tables' answer,
 * Foundation foods first, read into the numbers this app keeps
 * (mNutrients), and the search itself (mFoodSearch). The longer account is
 * with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.foodsearch(app) once, as it starts, and keeps what it gives
 * back under the same names. Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).foodsearch = function (app) {
  'use strict';

  /* Looking it up instead of guessing at it.
   *
     Two sources, because they answer different questions. The USDA's
     FoodData Central knows what a chicken tamale is, in the sense of what is
     in one on average — generic, cooked, unbranded food, which is most of
     what anybody eats and none of what carries a barcode. Open Food Facts
     knows the packet in your hand by its number.
   *
     Neither is asked anything until you ask. A reader who never opens this
     box never touches either host, which is the property the whole app has
     kept and its offline test insists on. */
  /* Foundation foods — the USDA's newest, most carefully measured set —
     often give no plain "Energy" at all, only "Energy (Atwater General
     Factors)" and "Energy (Atwater Specific Factors)", and read by the plain
     name alone they listed at 0 kcal. The plain figure wins where there is
     one, then the specific factors, then the general. The stored food is
     worked out from its macros on save either way; this is what the list
     shows before then. */
  /* Sodium and fiber too (2026-10-07). Every answer the USDA gives carries
     them, from 14 lines for a packet to 75 for a reference food, and this
     kept four: Blake's butter replacement came in at 1,200 mg of sodium per
     100 g and went onto his day as none, under a salt cap the meal sheet
     weighs every food against. */
  function mNutrients(list) {
    // sodium and fiber stay null when the answer has none: missing is not zero
    var out = { kcal: 0, p: 0, f: 0, c: 0, na: null, fib: null }, kc = {};
    (list || []).forEach(function (n) {
      var name = n.nutrientName || (n.nutrient && n.nutrient.name) || '';
      var unit = (n.unitName || (n.nutrient && n.nutrient.unitName) || '').toUpperCase();
      var v = n.value === undefined ? n.amount : n.value;
      if (typeof v !== 'number') return;
      if (unit === 'KCAL' && /^Energy\b/.test(name)) {
        kc[/Specific/.test(name) ? 'spec' : /General/.test(name) ? 'gen' : 'plain'] = v;
      }
      else if (name === 'Protein') out.p = v;
      else if (name === 'Total lipid (fat)') out.f = v;
      else if (name === 'Carbohydrate, by difference') out.c = v;
      else if (name === 'Sodium, Na' && unit === 'MG') out.na = v;
      else if (name === 'Fiber, total dietary' && unit === 'G') out.fib = v;
    });
    out.kcal = kc.plain !== undefined ? kc.plain : kc.spec !== undefined ? kc.spec : kc.gen || 0;
    return out;
  }

  function mFoodSearch(q, packaged) {
    var key = window.USDA_KEY || '';
    if (!key) return Promise.reject(new Error('nokey'));
    /* Generic or packaged, because they are different questions. FNDDS and
       SR Legacy are cooked, unbranded food — including everything the survey
       files under "Restaurant, ..." — and Branded is the barcode aisle. There
       is no restaurant filter as such; restaurant dishes live inside the
       generic set under that prefix, and the source is shown so you can see
       which kind of answer you are looking at. */
    var types = packaged ? ['Branded'] : ['Survey (FNDDS)', 'SR Legacy', 'Foundation'];
    /* Asked as a POST, because the query string is a minefield here. The
       list of data sets has to keep its commas as separators, and
       encodeURIComponent leaves parentheses alone — legal in a URL, and yet
       the gateway answers "Survey (FNDDS)" with a bare nginx 400 the moment
       any browser-shaped header is attached, which is every request the app
       will ever make. The POST body takes the list as a list and none of
       that arises. Preflight is answered. */
    return fetch('https://api.nal.usda.gov/fdc/v1/foods/search?api_key=' +
      encodeURIComponent(key), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, pageSize: 40, dataType: types })
      }).then(function (r) {
      if (!r.ok) throw new Error('http');
      return r.json();
    }).then(function (d) {
      /* The API's idea of relevance is loose — a search for "tamale" comes
         back with "Candy, gummy" in it — and the same dish appears once per
         data set, so "Restaurant, Latino, tamale, pork" arrives twice. Keep
         only what actually mentions what was asked for, and only once. */
      var words = q.toLowerCase().split(/\s+/).filter(function (w) { return w.length > 2; });
      var seen = {};
      return (d.foods || []).filter(function (f) {
        var desc = String(f.description || '').toLowerCase();
        if (words.length && !words.some(function (w) { return desc.indexOf(w) >= 0; })) return false;
        if (seen[desc]) return false;
        seen[desc] = 1;
        return true;
      }).slice(0, 12).map(function (f) {
        var n = mNutrients(f.foodNutrients);
        /* The USDA quotes per hundred grams and then, usually, tells you what
           one of the thing actually weighs — a tamale is 140 g, "1 item, any
           size". Offer the item rather than the hundred grams: nobody eats a
           hundred grams of tamale, they eat a tamale. */
        var best = null;
        (f.foodMeasures || []).forEach(function (m) {
          var t = String(m.disseminationText || '');
          if (!m.gramWeight || /not specified/i.test(t)) return;
          if (!best || (m.rank || 99) < (best.rank || 99)) best = m;
        });
        /* The weight rides in the serving's own words, "1 cup, diced
           (165 g)", the way a label prints it, so the food it becomes dials
           in grams (mLabelServing) instead of in servings of an unknown
           weight. A packet says its serving outright (mUsdaServing). */
        var bs = f.dataType === 'Branded' ? mUsdaServing(f) : null;
        var per = bs ? bs.per : best ? best.gramWeight / 100 : 1;
        var unit = bs ? bs.unit : best ? mUsdaMeasure(best.disseminationText) +
          ' (' + Math.round(best.gramWeight) + ' g)' : '100 g';
        var src = f.dataType === 'Branded' ? (f.brandOwner || 'packaged')
          : f.dataType === 'Survey (FNDDS)' ? 'survey' : 'reference';
        return { name: f.description, unit: unit,
          kcal: Math.round(n.kcal * per), p: Math.round(n.p * per),
          f: Math.round(n.f * per), c: Math.round(n.c * per),
          na: mPer(n.na, per, 1), fib: mPer(n.fib, per, 10),
          src: src, note: 'the USDA' };
      }).filter(function (x) { return x.kcal || x.p || x.f || x.c; });
    });
  }

  /* The USDA's household measure with its count in front and its own
     aside taken off: "1 medium (2-1/4\" to 3-1/4\" dia)" has a bracket
     already, and a second one for the weight is a serving no reader of
     labels (mLabelServing) can parse, which the plate then printed as
     "1 1 medium (…)". */
  function mUsdaMeasure(t) {
    var s = String(t || '').replace(/\s*\([^)]*\)/g, '').trim();
    return /^\d/.test(s) ? s : '1 ' + (s || 'serving');
  }
  // a figure per 100 g scaled to the serving and rounded to 1/to; one never given stays null
  function mPer(v, per, to) { return typeof v === 'number' ? Math.round(v * per * to) / to : null; }

  /* A packet's serving as its label says it: "2 Tbsp (32 g)". The USDA
     keeps every packet's nutrients per 100 g and its serving beside them,
     and only a serving given in grams can be turned into one. */
  function mUsdaServing(f) {
    var g = Number(f.servingSize);
    if (!(g > 0) || !/^(g|grm|gram|grams)$/i.test(String(f.servingSizeUnit || ''))) return null;
    // its own aside off, as with a reference food's measure (mUsdaMeasure): "1 cup (8 fl oz)"
    var hh = String(f.householdServingFullText || '').replace(/\s*\([^)]*\)/g, '').trim();
    var w = Math.round(g * 10) / 10;
    return { per: g / 100, unit: hh && /^\d/.test(hh) ? hh + ' (' + w + ' g)' : w + ' g' };
  }
  // the USDA's packets are named in capitals: "CREAMY PEANUT BUTTER"
  function mTitle(s) {
    s = String(s || '').trim();
    if (s !== s.toUpperCase()) return s;
    return s.toLowerCase().replace(/(^|[\s\-\/(&])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
  }

  /* A barcode the USDA knows. Open Food Facts is asked first and is the one
     with the photographs and the allergens, but it is written by volunteers
     and thinner on American shelves: a probe of the live services on
     2026-10-06 found a US peanut butter there under the name "Yellowfin
     Tuna", at a sixth of its calories, while the USDA's packaged foods —
     the manufacturers' own label data — had it right by its barcode alone.
     So a barcode Open Food Facts cannot answer is asked here before anyone
     is told to type it in.
   *
     The search is full text, so what comes back is held to the number: only
     a packet whose own barcode is this one, leading zeros aside (a scan
     reads a 12-digit UPC as 13 digits with a nought in front). */
  function mUsdaBarcode(code) {
    var key = window.USDA_KEY || '';
    if (!key) return Promise.reject(new Error('nokey'));
    var digits = String(code || '').replace(/\D/g, '');
    var bare = function (x) { return String(x || '').replace(/\D/g, '').replace(/^0+/, ''); };
    var q = digits.length === 13 && digits.charAt(0) === '0' ? digits.slice(1) : digits;
    return fetch('https://api.nal.usda.gov/fdc/v1/foods/search?api_key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, pageSize: 5, dataType: ['Branded'] })
    }).then(function (r) {
      if (!r.ok) throw new Error('http');
      return r.json();
    }).then(function (d) {
      var f = (d.foods || []).filter(function (x) { return bare(x.gtinUpc) && bare(x.gtinUpc) === bare(digits); })[0];
      if (!f) throw new Error('none');
      var n = mNutrients(f.foodNutrients), bs = mUsdaServing(f) || { per: 1, unit: '100 g' }, per = bs.per;
      if (!(n.kcal || n.p || n.f || n.c)) throw new Error('nonutrition');
      return [{
        name: [mTitle(f.brandName || f.brandOwner), mTitle(f.description)].filter(Boolean).join(' '),
        unit: bs.unit,
        kcal: Math.round(n.kcal * per), p: Math.round(n.p * per), f: Math.round(n.f * per), c: Math.round(n.c * per),
        na: mPer(n.na, per, 1), fib: mPer(n.fib, per, 10),
        // per 100 g, for weighing against Open Food Facts' answer (src/lookup.js, mTwoAnswers)
        k100: n.kcal || null, per100: { na: n.na, fib: n.fib },
        src: 'USDA packaged foods', note: 'the USDA\u2019s packaged foods'
      }];
    });
  }

  return { mNutrients: mNutrients, mFoodSearch: mFoodSearch, mUsdaBarcode: mUsdaBarcode };
};
