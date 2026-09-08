/*
 * Proposes food-db.js entries from the USDA's FoodData Central.
 *
 *   node tools/usda-fetch.js              every food in tools/zone-best.js
 *   node tools/usda-fetch.js salmon cod   just those keys, to check a match
 *   node tools/usda-fetch.js --all        show all candidate matches, not the
 *                                         one picked, when a match looks wrong
 *
 * Writes tools/usda-proposed.md and prints a summary. IT NEVER WRITES
 * food-db.js, and that is deliberate rather than laziness.
 *
 * WHAT IS AUTOMATABLE HERE AND WHAT IS NOT.
 *
 * The six per-100 g numbers are: kcal, protein, carbohydrate, fat, sodium and
 * fibre. Those are the USDA's to state and there is nothing to decide.
 *
 * Everything else in an entry is a judgement and has to be authored:
 *
 *   g      what a cup, an ounce or one of the thing weighs. The USDA offers
 *          portion weights but calls them things like "1 cup, chopped" and
 *          "1 cup, NFS", and picking between those is reading, not fetching.
 *   def    the portion to assume when a line says just "cheddar". This is the
 *          field that once defaulted soy sauce to a CUP — fourteen thousand
 *          milligrams of sodium in one serving, against a MTOP_NA ceiling of
 *          four hundred. A wrong `def` is not a wrong number, it is a wrong
 *          answer to a question nobody asked.
 *   eat    whether the thing can be eaten as it comes. Raw stewing beef has
 *          excellent macros and is not a snack; this flag is what stops the
 *          picker offering it as one.
 *   veg / side / lever / starch
 *          what the food is FOR, which is the vocabulary the solver and the
 *          shelf rail speak.
 *
 * So this script fills in the half that is arithmetic and leaves the half that
 * is judgement blank, with a TODO on every line, so that a missing decision
 * looks missing instead of looking like a default.
 *
 * The key is window.USDA_KEY out of src/config.js — public by design, the
 * comment there explains why.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { WANTED } = require('./zone-best.js');
const { FOODS } = require('./food-db.js');

// src/config.js is browser script, not a module: run it with a window to catch.
global.window = {};
require(path.join(ROOT, 'src', 'config.js'));
const KEY = global.window.USDA_KEY;

if (!KEY) {
  console.error('No USDA_KEY in src/config.js.');
  process.exit(1);
}

/* The reference sets, never Branded. Branded is the barcode aisle: it answers
   "what is in THIS packet", carries whatever the manufacturer declared, and
   would put a brand's rounding into a table the whole book is priced from.
   Foundation and SR Legacy are the measured, generic figures — which is what
   every number already in food-db.js is. */
const DATA_TYPES = ['Foundation', 'SR Legacy'];

/* The USDA quotes per 100 g and names nutrients in full. Sodium and fibre are
   here because food-db carries both and the app scores on both — a table
   without them would score every new food as saltless and fibreless, which
   flatters exactly the foods that do not deserve it. */
function nutrients(list) {
  const out = { kcal: 0, p: 0, c: 0, f: 0, na: 0, fib: 0 };
  (list || []).forEach((n) => {
    const name = n.nutrientName || (n.nutrient && n.nutrient.name) || '';
    const unit = (n.unitName || (n.nutrient && n.nutrient.unitName) || '').toUpperCase();
    const v = n.value === undefined ? n.amount : n.value;
    if (typeof v !== 'number') return;
    /* Three spellings of one number. SR Legacy says "Energy" in KCAL;
       Foundation reports Atwater factors instead and no plain Energy at all,
       which is why cod first came back at zero calories. Specific factors are
       the better of the two — they use the food's own protein/fat/carbohydrate
       coefficients rather than 4/4/9 — so they win where both are given, and
       kilojoules are the last resort. */
    if (name === 'Energy' && unit === 'KCAL') out.kcal = v;
    else if (name === 'Energy (Atwater Specific Factors)' && unit === 'KCAL') out.atwSpec = v;
    else if (name === 'Energy (Atwater General Factors)' && unit === 'KCAL') out.atwGen = v;
    else if (name === 'Energy' && unit === 'KJ') out.kj = v;
    else if (name === 'Protein') out.p = v;
    else if (name === 'Total lipid (fat)') out.f = v;
    else if (name === 'Carbohydrate, by difference') out.c = v;
    else if (name === 'Sodium, Na') out.na = v;
    else if (name === 'Fiber, total dietary') out.fib = v;
  });
  if (!out.kcal) out.kcal = out.atwSpec || out.atwGen || (out.kj ? out.kj / 4.184 : 0);
  delete out.atwSpec; delete out.atwGen; delete out.kj;
  return out;
}

/* Rounded the way the table already rounds: calories and sodium whole, the
   macros to a tenth. Reading 22.5 g of protein off a chicken breast is the
   precision a kitchen has; 22.47 is precision it does not. */
function tidy(n) {
  return {
    kcal: Math.round(n.kcal),
    p: Math.round(n.p * 10) / 10,
    c: Math.round(n.c * 10) / 10,
    f: Math.round(n.f * 10) / 10,
    na: Math.round(n.na),
    fib: Math.round(n.fib * 10) / 10,
  };
}

/* Closest description to what was asked for, rather than whatever the search
   ranked first. FDC's relevance is loose enough that a query for a raw fillet
   returns the breaded frozen one above it. Scored on how much of the query
   the description actually contains, with a preference for Foundation (fewer
   foods, better measured) and a penalty for the preparations nobody asked
   for. */
function pick(foods, want) {
  const words = want.q.toLowerCase().split(/[\s,()]+/).filter((w) => w.length > 2);
  const scored = foods.map((f) => {
    const d = String(f.description || '').toLowerCase();
    let s = words.filter((w) => d.indexOf(w) >= 0).length;
    /* SR Legacy ahead of Foundation, which is the opposite of what you would
       guess from the names. Foundation is newer but it is INDIVIDUAL LAB
       SAMPLES: its raw cod carries 299 mg of sodium against SR Legacy's 54,
       because some particular fillet had been treated. SR Legacy is the
       composite standard-reference table — which is what every figure already
       in food-db.js is, so mixing the two would put two different kinds of
       number in one column. */
    if (f.dataType === 'SR Legacy') s += 0.5;
    /* Asked raw, given cooked, is a different food by weight — that is the
       whole reason the storehouse table counts meat raw. */
    if (want.raw && /\b(cooked|boiled|baked|fried|roasted|breaded|canned)\b/.test(d)) s -= 2;
    if (/\bbaby food|infant|dietary supplement\b/.test(d)) s -= 5;
    return { f, s, d };
  }).sort((a, b) => b.s - a.s);
  return scored;
}

function search(q) {
  return fetch('https://api.nal.usda.gov/fdc/v1/foods/search?api_key=' +
    encodeURIComponent(KEY), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, pageSize: 25, dataType: DATA_TYPES }),
    }).then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
}

const args = process.argv.slice(2);
const showAll = args.includes('--all');
const only = args.filter((a) => a[0] !== '-');
const list = only.length ? WANTED.filter((w) => only.includes(w.key)) : WANTED;

if (!list.length) {
  console.error('Nothing matched. Keys are in tools/zone-best.js.');
  process.exit(1);
}

(async () => {
  const rows = [];
  const problems = [];
  for (let i = 0; i < list.length; i++) {
    const w = list[i];
    if (FOODS[w.key]) {
      problems.push(w.key + ': already in food-db.js — remove it from zone-best.js or rename the key');
      continue;
    }
    let d;
    try {
      d = await search(w.q);
    } catch (e) {
      problems.push(w.key + ': ' + e.message);
      continue;
    }
    const scored = pick(d.foods || [], w);
    if (!scored.length) { problems.push(w.key + ': no match for "' + w.q + '"'); continue; }
    const best = scored[0];
    const n = tidy(nutrients(best.f.foodNutrients));
    if (!n.kcal && !n.p && !n.c && !n.f) {
      problems.push(w.key + ': matched "' + best.f.description + '" but it carries no macros');
      continue;
    }
    /* Does the stated energy agree with its own macros? 4/4/9 is not exact —
       fibre and alcohol both break it — but a row that disagrees by more than
       a fifth is usually a bad match or a missing nutrient rather than a
       quirk, and this is the check that would have caught cod coming back at
       zero calories. */
    /* Fibre is carbohydrate the body largely does not burn, so charging it at
       4 kcal/g overstates every vegetable — spinach came out 29% "wrong" on
       the first run purely because two thirds of its carbohydrate is fibre.
       Counted at 2, which is the convention, and taken out of the carbohydrate
       it is part of. */
    const derived = 4 * n.p + 4 * Math.max(0, n.c - n.fib) + 2 * n.fib + 9 * n.f;
    const off = n.kcal ? Math.round(((derived - n.kcal) / n.kcal) * 100) : 999;
    if (Math.abs(off) > 20) {
      problems.push(w.key + ': "' + best.f.description + '" states ' + n.kcal +
        ' kcal but its macros come to ' + Math.round(derived) + ' (' + off + '%) — check the match');
    }
    rows.push({ w, n, off, desc: best.f.description, id: best.f.fdcId, type: best.f.dataType,
      alts: scored.slice(1, showAll ? 8 : 3).map((s) => s.f.description) });
    process.stdout.write('.');
    /* Courteous rather than necessary: the default allowance is a thousand an
       hour and this is eighty. */
    await new Promise((r) => setTimeout(r, 120));
  }
  process.stdout.write('\n');

  const lines = [];
  lines.push('# Proposed food-db entries');
  lines.push('');
  lines.push('Generated by `node tools/usda-fetch.js` from `tools/zone-best.js`.');
  lines.push('');
  lines.push('The six numbers on each line are the USDA\'s, per 100 g. **Everything after');
  lines.push('them is a TODO** — `g`, `def`, `label` and the what-it-is-for flags are');
  lines.push('judgement and are not fetched. Check the matched description before taking a');
  lines.push('line: the query is written to hit one preparation and the search is loose.');
  lines.push('');
  lines.push('| key | matched | set | kcal | P | C | F | Na | fib |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  rows.forEach(({ w, n, desc, type }) => {
    lines.push('| `' + w.key + '` | ' + desc + ' | ' + type + ' | ' +
      n.kcal + ' | ' + n.p + ' | ' + n.c + ' | ' + n.f + ' | ' + n.na + ' | ' + n.fib + ' |');
  });
  lines.push('');
  lines.push('## Entries to author');
  lines.push('');
  lines.push('```js');
  rows.forEach(({ w, n, desc, id }) => {
    lines.push('  // ' + desc + '  (FDC ' + id + ')');
    lines.push('  ' + w.key + ': { /* TODO flags */ kcal: ' + n.kcal + ', p: ' + n.p +
      ', c: ' + n.c + ', f: ' + n.f + ', na: ' + n.na + ', fib: ' + n.fib +
      ', g: { /* TODO */ }, label: ' + JSON.stringify(w.label) +
      ', zone: ' + JSON.stringify(w.block.toLowerCase()) + ' },');
  });
  lines.push('```');
  if (rows.some((r) => r.alts.length)) {
    lines.push('');
    lines.push('## Runners-up, in case a match is wrong');
    lines.push('');
    rows.forEach(({ w, alts }) => {
      if (alts.length) lines.push('- **' + w.key + '** — ' + alts.join(' · '));
    });
  }
  if (problems.length) {
    lines.push('');
    lines.push('## Problems');
    lines.push('');
    problems.forEach((p) => lines.push('- ' + p));
  }
  fs.writeFileSync(path.join(__dirname, 'usda-proposed.md'), lines.join('\n') + '\n');

  console.log('proposed ' + rows.length + ' of ' + list.length +
    (problems.length ? ', ' + problems.length + ' problem' + (problems.length === 1 ? '' : 's') : ''));
  problems.forEach((p) => console.log('  ! ' + p));
  console.log('wrote tools/usda-proposed.md');
})();
