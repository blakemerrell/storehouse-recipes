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
  function mNutrients(list) {
    var out = { kcal: 0, p: 0, f: 0, c: 0 }, kc = {};
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
        var per = best ? best.gramWeight / 100 : 1;
        var unit = best ? String(best.disseminationText).replace(/^1\s+/, '') : '100 g';
        var src = f.dataType === 'Branded' ? (f.brandOwner || 'packaged')
          : f.dataType === 'Survey (FNDDS)' ? 'survey' : 'reference';
        return { name: f.description, unit: unit,
          kcal: Math.round(n.kcal * per), p: Math.round(n.p * per),
          f: Math.round(n.f * per), c: Math.round(n.c * per),
          src: src, note: best ? 'the USDA, ' + best.gramWeight + ' g' : 'the USDA' };
      }).filter(function (x) { return x.kcal || x.p || x.f || x.c; });
    });
  }

  return { mNutrients: mNutrients, mFoodSearch: mFoodSearch };
};
