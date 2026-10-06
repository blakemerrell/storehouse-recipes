// One-off probe: what USDA FoodData Central and Open Food Facts actually send back.
// Run by .github/workflows/api-probe.yml on the scratch branch claude/api-probe only.
const KEY = process.env.USDA_KEY;
const FDC = 'https://api.nal.usda.gov/fdc/v1';
const OFF = 'https://world.openfoodfacts.org/api/v2/product/';
const UA = { 'User-Agent': 'HiveAndHearth-probe/1.0 (github actions; one-off field survey)' };

const out = (s) => console.log(s);
const hr = (t) => out('\n==================== ' + t + ' ====================');
const short = (v, n = 300) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s && s.length > n ? s.slice(0, n) + '…' : s; };

async function fdcSearch(body) {
  const r = await fetch(FDC + '/foods/search?api_key=' + KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  out('HTTP ' + r.status + '  search ' + JSON.stringify(body));
  return r.json();
}
async function fdcFood(id) {
  const r = await fetch(FDC + '/food/' + id + '?api_key=' + KEY);
  out('HTTP ' + r.status + '  food/' + id);
  return r.json();
}
async function offProduct(code) {
  const r = await fetch(OFF + code + '.json', { headers: UA });
  out('HTTP ' + r.status + '  OFF product ' + code);
  return r.json();
}
function nutrientLines(list) {
  return (list || []).map((n) => {
    const name = n.nutrientName || (n.nutrient && n.nutrient.name);
    const unit = n.unitName || (n.nutrient && n.nutrient.unitName);
    const v = n.value !== undefined ? n.value : n.amount;
    return '   ' + name + ': ' + v + ' ' + String(unit || '').toLowerCase();
  }).join('\n');
}
function topKeys(o) { return Object.keys(o || {}).join(', '); }

async function searchHit(label, body) {
  hr(label);
  const d = await fdcSearch(body);
  out('totalHits: ' + d.totalHits);
  const f = (d.foods || [])[0];
  if (!f) { out('(no foods)'); return null; }
  out('fields on a search hit: ' + topKeys(f));
  ['description', 'fdcId', 'dataType', 'foodCategory', 'brandOwner', 'brandName', 'gtinUpc', 'servingSize', 'servingSizeUnit',
    'householdServingFullText', 'packageWeight', 'marketCountry', 'publishedDate', 'ingredients']
    .forEach((k) => { if (f[k] !== undefined) out(k + ': ' + short(f[k], 400)); });
  if (f.foodMeasures && f.foodMeasures.length) {
    out('foodMeasures (' + f.foodMeasures.length + '):');
    f.foodMeasures.forEach((m) => out('   ' + m.disseminationText + ' = ' + m.gramWeight + ' g' + (m.rank ? '  (rank ' + m.rank + ')' : '')));
  }
  out('foodNutrients (' + (f.foodNutrients || []).length + ', per 100 g):');
  out(nutrientLines(f.foodNutrients));
  return f;
}

async function foodDetail(label, id) {
  hr(label);
  const d = await fdcFood(id);
  out('fields on the full record: ' + topKeys(d));
  out('foodNutrients: ' + (d.foodNutrients || []).length);
  if (d.labelNutrients) {
    out('labelNutrients (the package label, per serving):');
    Object.keys(d.labelNutrients).forEach((k) => out('   ' + k + ': ' + d.labelNutrients[k].value));
  }
  if (d.foodPortions && d.foodPortions.length) {
    out('foodPortions (' + d.foodPortions.length + '):');
    d.foodPortions.slice(0, 15).forEach((p) => out('   ' + [p.amount, p.measureUnit && p.measureUnit.name !== 'undetermined' ? p.measureUnit.name : '', p.modifier || '', p.portionDescription || ''].filter(Boolean).join(' ') + ' = ' + p.gramWeight + ' g'));
  }
  if (d.inputFoods && d.inputFoods.length) out('inputFoods (what it is made of): ' + d.inputFoods.length);
  if (d.foodAttributes && d.foodAttributes.length) out('foodAttributes: ' + short(d.foodAttributes.map((a) => (a.name || '') + ' ' + (a.value || '')), 400));
  if (d.foodUpdateLog) out('foodUpdateLog entries: ' + d.foodUpdateLog.length);
  return d;
}

async function offShow(label, code) {
  hr(label);
  const d = await offProduct(code);
  out('status: ' + d.status + '  ' + (d.status_verbose || ''));
  const p = d.product;
  if (!p) return null;
  const keys = Object.keys(p);
  out('fields on the product: ' + keys.length);
  ['product_name', 'brands', 'quantity', 'serving_size', 'serving_quantity', 'categories', 'labels', 'countries',
    'nutriscore_grade', 'nova_group', 'ecoscore_grade', 'nutrient_levels', 'allergens_tags', 'traces_tags',
    'ingredients_text', 'ingredients_analysis_tags', 'additives_tags', 'stores', 'image_front_url', 'image_nutrition_url',
    'image_ingredients_url', 'last_modified_t', 'completeness', 'data_quality_warnings_tags']
    .forEach((k) => { if (p[k] !== undefined && p[k] !== '') out(k + ': ' + short(p[k], 500)); });
  const nu = p.nutriments || {};
  const per100 = Object.keys(nu).filter((k) => k.endsWith('_100g'));
  const perServ = Object.keys(nu).filter((k) => k.endsWith('_serving'));
  out('nutriments per 100 g (' + per100.length + '):');
  per100.forEach((k) => out('   ' + k.replace('_100g', '') + ': ' + nu[k] + ' ' + (nu[k.replace('_100g', '_unit')] || '')));
  out('nutriments per serving: ' + perServ.length + (perServ.length ? '  (' + perServ.map((k) => k.replace('_serving', '') + '=' + nu[k]).join(', ') + ')' : ''));
  out('every product field name: ' + keys.sort().join(', '));
  return p;
}

(async () => {
  if (!KEY) { out('no USDA key'); process.exit(1); }
  const t0 = Date.now();

  // 1. The food Blake looked up this morning, as the app asks for it (generic data sets)
  const butter = await searchHit('USDA · generic food, as the app searches: "butter replacement without fat powder"',
    { query: 'butter replacement without fat powder', dataType: ['Survey (FNDDS)', 'SR Legacy', 'Foundation'], pageSize: 1 });
  if (butter) await foodDetail('USDA · the same food, full record (food/' + butter.fdcId + ')', butter.fdcId);

  // 2. A generic food with household measures
  await searchHit('USDA · generic food with measures: "chicken breast grilled"',
    { query: 'chicken breast grilled', dataType: ['Survey (FNDDS)'], pageSize: 1 });

  // 3. A packaged (Branded) food
  const pb = await searchHit('USDA · packaged food: "creamy peanut butter"',
    { query: 'creamy peanut butter', dataType: ['Branded'], pageSize: 1 });
  let upc = null;
  if (pb) {
    upc = pb.gtinUpc;
    await foodDetail('USDA · the same packaged food, full record (food/' + pb.fdcId + ')', pb.fdcId);
    // 4. Can USDA answer a BARCODE? (a fallback when Open Food Facts does not know one)
    hr('USDA · looking up that barcode (' + upc + ') by number');
    const byCode = await fdcSearch({ query: upc, dataType: ['Branded'], pageSize: 3 });
    out('totalHits: ' + byCode.totalHits);
    (byCode.foods || []).forEach((f) => out('   ' + f.gtinUpc + '  ' + f.brandOwner + ' · ' + f.description));
  }

  // 5. Open Food Facts on the same US product, then a well-known European one, then an unknown code
  if (upc) await offShow('Open Food Facts · the same peanut butter by barcode (' + upc + ')', upc);
  await offShow('Open Food Facts · Nutella 400 g (3017620422003)', '3017620422003');
  await offShow('Open Food Facts · a store-brand US product: Great Value creamy peanut butter (078742370842)', '078742370842');
  hr('Open Food Facts · a barcode it does not know (0000000000017)');
  const none = await offProduct('0000000000017');
  out('status: ' + none.status + '  ' + (none.status_verbose || ''));

  hr('done in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
})().catch((e) => { console.error('probe failed: ' + e.message); process.exit(1); });
