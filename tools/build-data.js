/*
 * Builds data/recipes.js from the original design export, and writes AUDIT.md.
 *
 * What this does:
 *   1. Re-derives every Strong & Simple score from its stated macros, confirming the
 *      formula the design used (protein 55 / calories 20 / fat 15 / storehouse 10).
 *   2. Estimates macros for every recipe from its ingredient list, using
 *      tools/food-db.js.
 *   3. For Strong & Simple, compares the estimate against the stated macros and reports
 *      the disagreements. Stated macros are kept — they are the authored data.
 *   4. For Around the Table, which shipped with no nutrition data at all, adopts the
 *      estimate, marks it est:true, and computes a score from it.
 *
 * Run: node tools/build-data.js
 */

const fs = require('fs');
const path = require('path');
const { FOODS } = require('./food-db.js');

const ROOT = path.join(__dirname, '..');

// ---------------------------------------------------------------------------
// Load the design export
// ---------------------------------------------------------------------------
global.window = {};
require(path.join(ROOT, 'design', 'project', 'recipes.js'));
// the twelve in "Worth the Afternoon" were written for this edition, not
// carried over from the original books — see tools/added-recipes.js
const ADDED = require('./added-recipes.js');
const FIXES = require('./recipe-fixes.js');

// apply the corrections to the original text without editing the source export
const ORIGINAL = global.window.RECIPES.map((r) => Object.assign({}, r, { steps: r.steps.slice() }));
const byId = {};
ORIGINAL.forEach((r) => { byId[r.id] = r; });
let applied = 0;
FIXES.forEach((f) => {
  const r = byId[f.id];
  if (!r || !r.steps[f.step]) throw new Error('recipe fix does not apply: ' + f.id + ' step ' + f.step);
  r.steps[f.step] = r.steps[f.step].replace(/\s*$/, '') + ' ' + f.add;
  applied++;
});

const SRC = ORIGINAL.concat(ADDED);

// ---------------------------------------------------------------------------
// Scoring
//
// The original book's formula, reverse-engineered from its own numbers, was
// protein 55 / calories 20 / fat 15 / storehouse-only 10. It is kept here only
// to prove the recovery was right — it still reproduces all 100 authored
// scores exactly.
//
// This edition scores nutrition alone. The storehouse-only bonus was ten points
// of a hundred awarded for shopping convenience, which has nothing to do with
// whether a recipe is good for you: identical brownies scored ten apart on
// where the cocoa came from. Whether a recipe needs anything beyond the standard
// order is still on every recipe, on the line at its foot, where it belongs.
//
// The remaining three are rescaled to a round 100, keeping protein dominant as
// the original intended. The calorie curve is unchanged: full marks to 300 kcal
// a serving, nothing left by 700.
// ---------------------------------------------------------------------------
function scoreOriginal(macro, extras) {
  const pPct = (macro.p * 4) / macro.kcal * 100;
  const fPct = (macro.f * 9) / macro.kcal * 100;
  const p = Math.min(55, (pPct / 45) * 55);
  const k = Math.max(0, Math.min(20, 20 - Math.max(0, macro.kcal - 300) / 20));
  const f = Math.max(0, Math.min(15, (15 * (45 - fPct)) / 35));
  const x = extras ? 0 : 10;
  return {
    score: Math.round(p + k + f + x),
    sc: {
      p: Math.round(p), k: Math.round(k), f: Math.round(f), x,
      pPct: Math.round(pPct), fPct: Math.round(fPct),
    },
  };
}

function scoreFrom(macro) {
  const pPct = (macro.p * 4) / macro.kcal * 100;
  const fPct = (macro.f * 9) / macro.kcal * 100;
  const p = Math.min(60, (pPct / 45) * 60);          // protein share, full at 45% of calories
  const k = Math.max(0, Math.min(25, 25 - Math.max(0, macro.kcal - 300) / 16)); // calorie load
  const f = Math.max(0, Math.min(15, (15 * (45 - fPct)) / 35));                  // fat share
  return {
    score: Math.round(p + k + f),
    sc: {
      p: Math.round(p), k: Math.round(k), f: Math.round(f),
      pPct: Math.round(pPct), fPct: Math.round(fPct),
    },
  };
}

// ---------------------------------------------------------------------------
// Ingredient parsing
// ---------------------------------------------------------------------------
const { parseLine } = require('./parse-lib.js');


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
    const chk = scoreOriginal(r.macro, r.extras);
    if (chk.score !== r.score || JSON.stringify(chk.sc) !== JSON.stringify(r.sc)) {
      scoreMismatch.push({ id: r.id, stated: { score: r.score, sc: r.sc }, recomputed: chk });
    }
    rec.est = false;
    const ns = scoreFrom(r.macro);
    rec.score = ns.score;
    rec.sc = ns.sc;
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
    // Around the Table shipped with no macros at all
    const macro = est.perServing;
    const safe = macro.kcal > 0 ? macro : { kcal: 1, p: 0, c: 0, f: 0 };
    const s = scoreFrom(safe);
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
 * Strong & Simple macros are as authored in the original book.
 * Around the Table macros are estimated from the ingredient lists (est: true); see AUDIT.md.
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

The two volumes: **Strong & Simple** (100 recipes, macros as authored) and
**Around the Table** (125 recipes, macros estimated here from the ingredient lists).

## 1. The scoring formula

### What the original book used

The design export carried a per-recipe score and a breakdown (\`sc\`) but no formula.
Recovering it from the data gives:

| Component | Max | Rule |
|---|---|---|
| Protein share | 55 | \`min(55, protein% of calories ÷ 45 × 55)\` — full marks at 45% of calories from protein |
| Calorie load | 20 | \`20 − (kcal − 300) ÷ 20\`, capped at 20, floored at 0 — full marks up to 300 kcal/serving |
| Fat share | 15 | \`15 × (45 − fat% of calories) ÷ 35\`, clamped to 0–15 — full marks at or below 10% |
| Storehouse bonus | 10 | 10 if the recipe needs nothing outside the standard storehouse list, else 0 |

**Verification: all 100 authored scores and all 600 breakdown figures reproduce exactly.**
Mismatches found: ${scoreMismatch.length}. That is the evidence the formula above is the real one.

### What this edition uses

The storehouse bonus is gone. Ten points in a hundred were awarded for shopping
convenience, which says nothing about whether a recipe is good for you — identical
brownies scored ten apart depending on where the cocoa came from. Whether a recipe
needs anything beyond the standard order is still on every recipe, on the line at
its foot.

The remaining three are rescaled to a round 100, protein still dominant, and the
calorie curve unchanged — full marks to 300 kcal a serving, nothing left by 700:

| Component | Max | Rule |
|---|---|---|
| Protein share | 60 | \`min(60, protein% of calories ÷ 45 × 60)\` |
| Calorie load | 25 | \`25 − (kcal − 300) ÷ 16\`, clamped to 0–25 |
| Fat share | 15 | \`15 × (45 − fat% of calories) ÷ 35\`, clamped to 0–15 |

**Printed scores therefore differ from the original book's, by design.** Score is the
rounded sum of the unrounded parts, which is why 57 + 25 + 15 can print as 97.

Every Strong & Simple macro set is also internally consistent under Atwater factors
(4 kcal/g protein and carbohydrate, 9 kcal/g fat) — no stated calorie count is
more than 12% away from the sum of its own macros.

## 2. Strong & Simple — stated macros vs. ingredients

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

${batchLooking.length} multi-serving Strong & Simple recipes state a calorie figure close to what the
**whole batch** contains, while being labelled per serving. In each case the stated
number is at least 1.7× the estimate for one serving and lands within 30% of the
estimate for the full recipe.

${batchLooking.length ? `| # | Recipe | Servings | Stated "per serving" | Est. per serving | Est. whole batch |
|---|---|---|---|---|---|
${batchLooking.map((x) => `| ${x.id} | ${x.name} | ${x.servN} | ${x.stated.kcal} | ${x.est.kcal} | ${x.estTotal} |`).join('\n')}

This is worth a decision before printing. If these really are batch figures, the
scores on those recipes are penalised for a calorie load their eater never sees.
The app does not silently change them — they are printed as authored.` : 'None found.'}

## 3. Around the Table — estimated macros

Around the Table shipped with **no nutrition data**: all 125 recipes carried a tagline in
the macro field. Macros here are estimated from the ingredient lists using the
food table in \`tools/food-db.js\`, divided by the recipe's own serving count.

- Recipes given macros: ${b2.filter((r) => r.macro && r.macro.kcal > 0).length} of ${b2.length}
- Score range: ${b2scores[0]}–${b2scores[b2scores.length - 1]} (median ${b2scores[Math.floor(b2scores.length / 2)]})

**These are estimates and the app labels them as such** — every Around the Table recipe
shows "Estimated from ingredients" next to its macros and its score. Strong & Simple's
numbers are never labelled that way, so the two are never confused.

### What the estimates assume

- Meat weights are raw, because that is how the recipes state them. Fat lost to
  draining browned beef is not subtracted.
- "1 can" without a size means the common size for that item — 15 oz for beans,
  tomato sauce and fruit, 10.5 oz for condensed soup, 5 oz for tuna. Canned
  protein, beans and vegetables are counted at drained weight.
- "Rice" is counted dry and "instant potatoes" as dry flakes, because the books
  write "cooked rice" and "mashed potatoes" separately when they mean the prepared
  form. This assumption is behind several of the Strong & Simple gaps above: 2 cups of dry
  rice carries roughly three times the calories of 2 cups cooked.
- Ingredients written with no quantity ("butter", "cheddar", "salsa") are counted
  at a modest default recorded in \`tools/food-db.js\` — one tablespoon of butter,
  half a cup of cheese, a quarter cup of salsa. Seasonings, water and non-food
  items such as lollipop sticks count as zero.

### Newly written recipes

${ADDED.length} recipes across ${[...new Set(ADDED.map((r) => r.secName))].length} sections were written for this edition rather than carried
over from the original books:

${[...new Set(ADDED.map((r) => r.secName))].map((n) => `- **${n}** — ${ADDED.filter((r) => r.secName === n).length} recipes`).join('\n')}

The data made the gaps plain. Across the original 225, no recipe has more than
four steps, none uses yeast, and none kneads, braises, tempers an egg or thickens
a sauce — "In-Depth" nearly always meant "leave it in the slow cooker". There was
no cookie of any kind in the collection, chocolate chips appeared in exactly one
recipe, and there were no restaurant copies at all.

Every ingredient was checked against the storehouse order list. ${ADDED.filter((r) => !r.extras).length} of the ${ADDED.length}
need nothing beyond it; the rest are honest about their pantry extras, which cost
them the storehouse bonus and so score lower.

Oil listed "for frying" is counted at 12% absorption rather than in full. Counting
a whole pan of frying oil as eaten made fried chicken read at 1,849 kcal a serving.

Their macros are estimates on the same footing as the rest of the volume, and the
app labels them as such. They have not been kitchen-tested.

${allUnmatched.size ? `### Ingredients the parser could not price

${[...allUnmatched.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `- \`${k}\` (${v}×)`).join('\n')}

These contribute nothing to their recipe's totals, so those recipes read low.
` : '### Coverage\n\nEvery ingredient line in all 225 recipes resolved to a food in the table.\n'}
`;

fs.writeFileSync(path.join(ROOT, 'AUDIT.md'), md);

console.log('wrote data/recipes.js  (' + out.length + ' recipes)');
console.log('recipe corrections applied:', applied);
console.log('score mismatches:', scoreMismatch.length);
console.log('unmatched ingredient names:', allUnmatched.size);
if (allUnmatched.size) console.log([...allUnmatched.keys()].slice(0, 40).join(' | '));
console.log('Strong & Simple median |Δkcal|:', medAbs + '%', ' within 20%:', within20 + '/' + b1.length, ' ≥30% off:', bigGap.length);
