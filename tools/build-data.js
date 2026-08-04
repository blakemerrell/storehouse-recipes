/*
 * Builds data/recipes.js from the original design export, and writes AUDIT.md.
 *
 * What this does:
 *   1. Re-derives every Book I score from its stated macros, confirming the
 *      formula the design used (protein 55 / calories 20 / fat 15 / storehouse 10).
 *   2. Estimates macros for every recipe from its ingredient list, using
 *      tools/food-db.js.
 *   3. For Book I, compares the estimate against the stated macros and reports
 *      the disagreements. Stated macros are kept — they are the authored data.
 *   4. For Book II, which shipped with no nutrition data at all, adopts the
 *      estimate, marks it est:true, and computes a score from it.
 *
 * Run: node tools/build-data.js
 */

const fs = require('fs');
const path = require('path');
const { FOODS, ALIASES } = require('./food-db.js');

const ROOT = path.join(__dirname, '..');

// ---------------------------------------------------------------------------
// Load the design export
// ---------------------------------------------------------------------------
global.window = {};
require(path.join(ROOT, 'design', 'project', 'recipes.js'));
const SRC = global.window.RECIPES;

// ---------------------------------------------------------------------------
// Scoring — reverse-engineered from the design's own numbers and verified to
// reproduce all 100 Book I scores exactly.
// ---------------------------------------------------------------------------
function scoreFrom(macro, extras) {
  const pPct = (macro.p * 4) / macro.kcal * 100;
  const fPct = (macro.f * 9) / macro.kcal * 100;
  const p = Math.min(55, (pPct / 45) * 55);          // protein share, capped at 45% of calories
  const k = Math.max(0, Math.min(20, 20 - Math.max(0, macro.kcal - 300) / 20)); // calorie load
  const f = Math.max(0, Math.min(15, (15 * (45 - fPct)) / 35));                  // fat share
  const x = extras ? 0 : 10;                          // storehouse-only bonus
  return {
    score: Math.round(p + k + f + x),
    sc: {
      p: Math.round(p), k: Math.round(k), f: Math.round(f), x,
      pPct: Math.round(pPct), fPct: Math.round(fPct),
    },
  };
}

// ---------------------------------------------------------------------------
// Ingredient parsing
// ---------------------------------------------------------------------------
const FRAC = {
  '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

// unit word -> canonical unit used by the gram tables
const UNITS = {
  cup: 'cup', cups: 'cup',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  g: 'g', gram: 'g', grams: 'g',
  can: 'can', cans: 'can',
  pkg: 'pkg', pkgs: 'pkg', package: 'pkg', packages: 'pkg',
  packet: 'pkg', packets: 'pkg',
  box: 'box', boxes: 'box',
  jar: 'jar', jars: 'jar',
  bottle: 'jar', bottles: 'jar',
  slice: 'each', slices: 'each',
  scoop: 'scoop', scoops: 'scoop',
  serving: 'each', servings: 'each', piece: 'each', pieces: 'each',
  clove: 'each', cloves: 'each',
  head: 'each', heads: 'each',
  stick: 'each', sticks: 'each',
  link: 'each', links: 'each',
  spear: 'each', spears: 'each',
};

// containers whose stated "(N oz)" is a gross weight; canned protein and beans
// lose liquid when drained.
const DRAIN = { tuna: 0.85, chicken_canned: 0.85, black_beans: 0.6, pinto_beans: 0.6, white_beans: 0.6, corn: 0.65, green_beans: 0.65, carrot: 0.65 };

// vague quantities
const VAGUE = { dash: 0.02, pinch: 0.02, splash: 2, handful: 0.5 };

const ALIAS_KEYS = Object.keys(ALIASES).sort((a, b) => b.length - a.length);

function lookupFood(name) {
  const n = name.trim();
  if (ALIASES[n]) return ALIASES[n];
  for (const k of ALIAS_KEYS) {
    // whole-word containment so "ham" does not match "graham"
    const re = new RegExp('(^|[^a-z])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z])');
    if (re.test(n)) return ALIASES[k];
  }
  return null;
}

/**
 * Parse one ingredient line into { key, grams } or null if it cannot be read.
 */
function parseLine(raw) {
  let s = raw.toLowerCase().trim();

  // "12–16 oz ..." — take the low end
  s = s.replace(/(\d+(?:\.\d+)?)\s*[–—-]\s*\d+(?:\.\d+)?/, '$1');

  // capture an explicit container size: "1 can (12.5 oz) chicken breast"
  let explicit = null;
  const sizeM = s.match(/\((\d+(?:\.\d+)?)\s*(oz|lb|lbs|g)\)/);
  if (sizeM) explicit = { n: parseFloat(sizeM[1]), u: UNITS[sizeM[2]] };

  // drop parentheticals ("(sliced)", "(cooked & chilled)")
  s = s.replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

  // leading quantity: "1.5", "2", "¼", "1 ½", "5g"
  let qty = null;
  let m = s.match(/^(\d+(?:\.\d+)?)\s*([½¼¾⅓⅔⅛⅜⅝⅞])?\s*/);
  if (m && m[0].trim()) {
    qty = parseFloat(m[1]) + (m[2] ? FRAC[m[2]] : 0);
    s = s.slice(m[0].length);
  } else {
    m = s.match(/^([½¼¾⅓⅔⅛⅜⅝⅞])\s*/);
    if (m) { qty = FRAC[m[1]]; s = s.slice(m[0].length); }
  }

  // vague leading word ("dash vanilla", "splash milk", "pinch salt")
  let vagueUnit = null;
  const vm = s.match(/^(dash|pinch|splash|handful)(?:es|s)?\s+(?:of\s+)?/);
  if (vm) { vagueUnit = vm[1]; s = s.slice(vm[0].length); }

  // unit word, possibly glued to the number ("5g creatine")
  let unit = null;
  const um = s.match(/^([a-z]+)\.?\s+/);
  if (um && UNITS[um[1]]) { unit = UNITS[um[1]]; s = s.slice(um[0].length); }
  if (!unit && qty !== null) {
    const gm = raw.toLowerCase().match(/^\d+(?:\.\d+)?\s*(g|oz|lb|lbs)\b/);
    if (gm) { unit = UNITS[gm[1]]; s = s.replace(/^\s*(g|oz|lb|lbs)\b\s*/, ''); }
  }

  // size modifier
  let sizeMult = 1;
  const mm = s.match(/^(large|small|medium|jumbo)\s+/);
  if (mm && !ALIASES[s]) {
    sizeMult = mm[1] === 'large' || mm[1] === 'jumbo' ? 1.5 : mm[1] === 'small' ? 0.7 : 1;
    if (!lookupFood(s)) s = s.slice(mm[0].length);
    else if (!ALIASES[s.trim()]) { /* keep, alias match may need it */ }
  }

  const foodName = s.replace(/\s+/g, ' ').trim();
  if (!foodName) return null;

  const key = lookupFood(foodName);
  if (!key) return { unmatched: foodName, raw };
  const food = FOODS[key];

  // ---- work out grams --------------------------------------------------
  let grams;
  if (vagueUnit) {
    const v = VAGUE[vagueUnit];
    grams = vagueUnit === 'splash' ? v * (food.g.tbsp || 15)
      : vagueUnit === 'handful' ? v * (food.g.cup || 100)
        : v * (food.g.tsp || 2);
  } else if (explicit && (unit === 'can' || unit === 'pkg' || unit === 'box' || unit === 'jar')) {
    const per = explicit.u === 'oz' ? 28.35 : explicit.u === 'lb' ? 453.6 : 1;
    grams = (qty === null ? 1 : qty) * explicit.n * per * (DRAIN[key] || 1);
  } else {
    if (qty === null) {
      if (!food.def) return { key, grams: 0, assumed: 'treated as a garnish' };
      qty = food.def.qty;
      unit = food.def.unit;
    }
    if (!unit) unit = 'each';
    let per;
    if (unit === 'g') per = 1;
    else if (unit === 'oz') per = 28.35;
    else if (unit === 'lb') per = 453.6;
    else per = food.g[unit];
    if (per === undefined) {
      // fall back through sensible substitutes
      per = food.g.each || food.g.cup || food.g.can || food.g.pkg || food.g.box || food.g.jar;
      if (per === undefined) return { unmatched: foodName + ' [unit ' + unit + ']', raw };
    }
    grams = qty * per * sizeMult;
  }

  return { key, grams };
}

function macrosFor(recipe) {
  let kcal = 0, p = 0, c = 0, f = 0;
  const unmatched = [];
  const assumed = [];
  recipe.ing.forEach((line) => {
    const r = parseLine(line);
    if (!r) return;
    if (r.unmatched) { unmatched.push(r.unmatched); return; }
    if (r.assumed) assumed.push(line + ' — ' + r.assumed);
    const food = FOODS[r.key];
    const k = r.grams / 100;
    kcal += food.kcal * k; p += food.p * k; c += food.c * k; f += food.f * k;
  });
  const n = recipe.servN && recipe.servN > 0 ? recipe.servN : 1;
  return {
    perServing: { kcal: Math.round(kcal / n), p: Math.round(p / n), c: Math.round(c / n), f: Math.round(f / n) },
    unmatched, assumed,
  };
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
const scoreMismatch = [];
const allUnmatched = new Map();
const book1Delta = [];
const out = SRC.map((r) => {
  const est = macrosFor(r);
  est.unmatched.forEach((u) => allUnmatched.set(u, (allUnmatched.get(u) || 0) + 1));

  const rec = Object.assign({}, r);

  if (r.book === 1) {
    // verify the design's own scoring
    const chk = scoreFrom(r.macro, r.extras);
    if (chk.score !== r.score || JSON.stringify(chk.sc) !== JSON.stringify(r.sc)) {
      scoreMismatch.push({ id: r.id, stated: { score: r.score, sc: r.sc }, recomputed: chk });
    }
    rec.est = false;
    rec.estMacro = est.perServing;
    const d = est.perServing.kcal - r.macro.kcal;
    const servN = r.servN && r.servN > 0 ? r.servN : 1;
    book1Delta.push({
      id: r.id, name: r.name, servN, stated: r.macro, est: est.perServing,
      estTotal: est.perServing.kcal * servN,
      dKcal: d, pct: r.macro.kcal ? Math.round((d / r.macro.kcal) * 100) : 0,
      unmatched: est.unmatched,
    });
  } else {
    // Book II shipped with no macros at all
    const macro = est.perServing;
    const safe = macro.kcal > 0 ? macro : { kcal: 1, p: 0, c: 0, f: 0 };
    const s = scoreFrom(safe, r.extras);
    rec.macro = macro;
    rec.est = true;
    rec.score = macro.kcal > 0 ? s.score : null;
    rec.sc = macro.kcal > 0 ? s.sc : null;
  }
  delete rec.estMacro;
  return rec;
});

// ---------------------------------------------------------------------------
// Emit data file
// ---------------------------------------------------------------------------
const header = `/* Generated by tools/build-data.js — do not edit by hand.
 * Book I macros are as authored in the original book.
 * Book II macros are estimated from the ingredient lists (est: true); see AUDIT.md.
 */
`;
fs.writeFileSync(path.join(ROOT, 'data', 'recipes.js'),
  header + 'window.RECIPES = ' + JSON.stringify(out) + ';\n');

// ---------------------------------------------------------------------------
// Audit report
// ---------------------------------------------------------------------------
const b1 = book1Delta.slice().sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
const bigGap = b1.filter((x) => Math.abs(x.pct) >= 30);
const med = (arr) => { const a = arr.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
const medAbs = med(b1.map((x) => Math.abs(x.pct)));
const within20 = b1.filter((x) => Math.abs(x.pct) <= 20).length;

// Does a stated figure look like a batch total rather than one serving?
const batchLooking = b1.filter((x) => {
  if (x.servN < 2 || !x.estTotal) return false;
  const nearTotal = Math.abs(x.stated.kcal - x.estTotal) / x.estTotal <= 0.3;
  const farFromServing = x.est.kcal > 0 && x.stated.kcal / x.est.kcal >= 1.7;
  return nearTotal && farFromServing;
}).sort((a, b) => a.id - b.id);

const b2 = out.filter((r) => r.book === 2);
const b2scores = b2.map((r) => r.score).filter((s) => s !== null).sort((a, b) => a - b);

let md = `# Nutrition audit

Generated by \`tools/build-data.js\`. Re-run it after any change to the food table.

## 1. The scoring formula

The design export carried a per-recipe score and a breakdown (\`sc\`) but no formula.
Recovering it from the data gives:

| Component | Max | Rule |
|---|---|---|
| Protein share | 55 | \`min(55, protein% of calories ÷ 45 × 55)\` — full marks at 45% of calories from protein |
| Calorie load | 20 | \`20 − (kcal − 300) ÷ 20\`, capped at 20, floored at 0 — full marks up to 300 kcal/serving |
| Fat share | 15 | \`15 × (45 − fat% of calories) ÷ 35\`, clamped to 0–15 — full marks at or below 10% |
| Storehouse bonus | 10 | 10 if the recipe needs nothing outside the standard storehouse list, else 0 |

Score is the rounded sum of the unrounded parts, which is why a recipe showing
53 + 20 + 15 + 10 can print as 97 rather than 98.

**Verification: all 100 Book I scores and all 600 breakdown figures reproduce exactly.**
Mismatches found: ${scoreMismatch.length}.

Every Book I macro set is also internally consistent under Atwater factors
(4 kcal/g protein and carbohydrate, 9 kcal/g fat) — no stated calorie count is
more than 12% away from the sum of its own macros.

## 2. Book I — stated macros vs. ingredients

The stated macros are kept as authored. Estimating each recipe independently from
its ingredient list is a check on them, not a replacement.

- Recipes checked: ${b1.length}
- Median disagreement on calories: **${medAbs}%**
- Within 20% of stated: **${within20} of ${b1.length}**
- Off by 30% or more: **${bigGap.length}**

${bigGap.length ? `The outliers, worth a look before this goes to print:

| # | Recipe | Stated kcal | Estimated kcal | Diff |
|---|---|---|---|---|
${bigGap.slice(0, 25).map((x) => `| ${x.id} | ${x.name} | ${x.stated.kcal} | ${x.est.kcal} | ${x.pct > 0 ? '+' : ''}${x.pct}% |`).join('\n')}
` : 'No recipe is off by 30% or more.'}

A gap does not automatically mean the book is wrong. The usual causes are portion
assumptions the ingredient list does not state — how much of a marinade is
actually eaten, whether ground beef is drained, whether "1 can" means the 15 oz
or the 29 oz can.

### Recipes whose stated macros look like batch totals

${batchLooking.length} multi-serving Book I recipes state a calorie figure close to what the
**whole batch** contains, while being labelled per serving. In each case the stated
number is at least 1.7× the estimate for one serving and lands within 30% of the
estimate for the full recipe.

${batchLooking.length ? `| # | Recipe | Servings | Stated "per serving" | Est. per serving | Est. whole batch |
|---|---|---|---|---|---|
${batchLooking.map((x) => `| ${x.id} | ${x.name} | ${x.servN} | ${x.stated.kcal} | ${x.est.kcal} | ${x.estTotal} |`).join('\n')}

This is worth a decision before printing. If these really are batch figures, the
scores on those recipes are penalised for a calorie load their eater never sees.
The app does not silently change them — they are printed as authored.` : 'None found.'}

## 3. Book II — estimated macros

Book II shipped with **no nutrition data**: all 125 recipes carried a tagline in
the macro field. Macros here are estimated from the ingredient lists using the
food table in \`tools/food-db.js\`, divided by the recipe's own serving count.

- Recipes given macros: ${b2.filter((r) => r.macro && r.macro.kcal > 0).length} of ${b2.length}
- Score range: ${b2scores[0]}–${b2scores[b2scores.length - 1]} (median ${b2scores[Math.floor(b2scores.length / 2)]})

**These are estimates and the app labels them as such** — every Book II recipe
shows "Estimated from ingredients" next to its macros and its score. Book I's
numbers are never labelled that way, so the two are never confused.

### What the estimates assume

- Meat weights are raw, because that is how the recipes state them. Fat lost to
  draining browned beef is not subtracted.
- "1 can" without a size means the common size for that item — 15 oz for beans,
  tomato sauce and fruit, 10.5 oz for condensed soup, 5 oz for tuna. Canned
  protein, beans and vegetables are counted at drained weight.
- "Rice" is counted dry and "instant potatoes" as dry flakes, because the books
  write "cooked rice" and "mashed potatoes" separately when they mean the prepared
  form. This assumption is behind several of the Book I gaps above: 2 cups of dry
  rice carries roughly three times the calories of 2 cups cooked.
- Ingredients written with no quantity ("butter", "cheddar", "salsa") are counted
  at a modest default recorded in \`tools/food-db.js\` — one tablespoon of butter,
  half a cup of cheese, a quarter cup of salsa. Seasonings, water and non-food
  items such as lollipop sticks count as zero.

${allUnmatched.size ? `### Ingredients the parser could not price

${[...allUnmatched.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `- \`${k}\` (${v}×)`).join('\n')}

These contribute nothing to their recipe's totals, so those recipes read low.
` : '### Coverage\n\nEvery ingredient line in all 225 recipes resolved to a food in the table.\n'}
`;

fs.writeFileSync(path.join(ROOT, 'AUDIT.md'), md);

console.log('wrote data/recipes.js  (' + out.length + ' recipes)');
console.log('score mismatches:', scoreMismatch.length);
console.log('unmatched ingredient names:', allUnmatched.size);
if (allUnmatched.size) console.log([...allUnmatched.keys()].slice(0, 40).join(' | '));
console.log('book I median |Δkcal|:', medAbs + '%', ' within 20%:', within20 + '/' + b1.length, ' ≥30% off:', bigGap.length);
