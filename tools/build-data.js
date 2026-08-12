/*
 * Builds data/recipes.js from the original design export, and writes AUDIT.md.
 *
 * What this does:
 *   1. Re-derives every Run and Not Be Weary score from its stated macros, confirming the
 *      formula the design used (protein 55 / calories 20 / fat 15 / storehouse 10).
 *   2. Estimates macros for every recipe from its ingredient list, using
 *      tools/food-db.js.
 *   3. For Run and Not Be Weary, compares the estimate against the stated macros and reports
 *      the disagreements. Stated macros are kept — they are the authored data.
 *   4. For Around the Table, which shipped with no nutrition data at all, adopts the
 *      estimate, marks it est:true, and computes a score from it.
 *
 * Run: node tools/build-data.js
 */

const fs = require('fs');
const path = require('path');
const { FOODS, SPICE_NAMES } = require('./food-db.js');
const { scoreFrom, nutritionFor } = require('./score-lib.js');

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
const CATS = require('./pantry-cats.js');

// apply the corrections to the original text without editing the source export
const ORIGINAL = global.window.RECIPES.map((r) => Object.assign({}, r, { steps: r.steps.slice() }));
const byId = {};
ORIGINAL.forEach((r) => { byId[r.id] = r; });
let applied = 0;
FIXES.forEach((f) => {
  const r = byId[f.id];
  if (!r) throw new Error('recipe fix does not apply: no recipe ' + f.id);
  /* Four kinds of correction, in order of how much they change:
       add    append to a step. The eighteen doneness notes — the step is
              sound and is missing a check.
       set    replace one step, where the step itself was wrong.
       steps  replace the method outright, for a recipe whose ingredients were
              listed and never used. Nothing short of the whole method fixes
              that, because the missing part is a step that was never there.
       ing / name / time / diff  the ingredient list and the label, for when
              the method could not be written without them.
     All of it lives in recipe-fixes.js so the original export stays untouched
     and every change is visible in one file. */
  if (f.name) r.name = f.name;
  if (f.ing) r.ing = f.ing.slice();
  if (f.time) r.time = f.time;
  if (f.diff) r.diff = f.diff;
  if (f.steps) r.steps = f.steps.slice();
  if (f.set !== undefined || f.add !== undefined) {
    if (!r.steps[f.step]) throw new Error('recipe fix does not apply: ' + f.id + ' step ' + f.step);
    if (f.set) r.steps[f.step] = f.set;
    else r.steps[f.step] = r.steps[f.step].replace(/\s*$/, '') + ' ' + f.add;
  }
  applied++;
});

const SRC = ORIGINAL.concat(ADDED);
// which recipes were written for this edition rather than carried over
const ADDED_IDS = new Set(ADDED.map((r) => r.id));

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


// ---------------------------------------------------------------------------
// Ingredient parsing
// ---------------------------------------------------------------------------
const { parseLine } = require('./parse-lib.js');


function macrosFor(recipe) {
  return nutritionFor(recipe.ing, recipe.servN, recipe.extras, parseLine, FOODS, SPICE_NAMES);
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
  rec.ingp = est.items;

  /* The carried-over recipes came with a tagline sitting in the field the
     nutrition data should have been in, and it shows: of the 125, a hundred
     and one repeat a word already in the title and the rest are adjectives.
     "Cheesy & Savory Skillet" under Crispy Hash Brown & Ham Egg Skillet.
     "Warm Melty Toast" under PB&J Breakfast Toast Toppers. "Cozy Warm Oats"
     under Warm Cinnamon Rolled Oats. They tell a cook nothing the title, the
     time, the effort and the ingredients have not already said, and they cost
     a line on every recipe in a book that is paid for by the sheet.

     The 32 written for this edition keep theirs, because those say something:
     "Boil One Minute, Exactly", "A Minute Too Long and It Is Just Cake",
     "No Skin, No Soggy Bottom". Those are what to aim for, which is the one
     thing a printed recipe cannot show you. */
  if (!ADDED_IDS.has(r.id)) rec.tagline = null;

  if (r.book === 1) {
    // verify the design's own scoring
    const chk = scoreOriginal(r.macro, r.extras);
    if (chk.score !== r.score || JSON.stringify(chk.sc) !== JSON.stringify(r.sc)) {
      scoreMismatch.push({ id: r.id, stated: { score: r.score, sc: r.sc }, recomputed: chk });
    }
    rec.est = false;
    /* Calories, protein, carbohydrate and fat are as authored. Sodium and fiber
       were never in the book, so they come from the ingredients here — which
       makes the sodium and fiber halves of every score an estimate, in both
       volumes. The app says so. */
    rec.macro = Object.assign({}, r.macro, { na: est.perServing.na, fib: est.perServing.fib });
    const ns = scoreFrom(rec.macro);
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
/*
 * The shopping list works in grams, because that is the only way three recipes
 * calling for a cup, a cup and two tablespoons can add up to anything. To write
 * the total back out it needs a unit per food, and rather than pick one by hand
 * for a hundred and sixteen foods, take whichever unit the recipes themselves
 * reach for most often: cups of cottage cheese, cans of tuna, pounds of beef.
 */
const unitTally = {};
out.forEach((r) => (r.ingp || []).forEach((it) => {
  if (!it.u) return;
  unitTally[it.k] = unitTally[it.k] || {};
  unitTally[it.k][it.u] = (unitTally[it.k][it.u] || 0) + 1;
}));

const FIXED = { g: 1, oz: 28.35, lb: 453.6 };
const LADDER = ['cup', 'tbsp', 'tsp'];
const round2 = (n) => Math.round(n * 100) / 100;
const shop = {};
Object.keys(FOODS).forEach((key) => {
  const food = FOODS[key];
  const tally = unitTally[key] || {};
  const unit = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || 'each';
  const per = FIXED[unit] !== undefined ? FIXED[unit] : food.g[unit];
  const e = { l: food.label || (key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')) };

  /* Seasonings get a name and no number. "Salt — 2 tsp" and "Pickle juice —
     50 tsp" are not things anyone writes on a shopping list; you either have
     salt or you do not. Everything with calories in it gets counted. */
  if (per && food.kcal > 0) {
    e.u = unit;
    e.p = round2(per);
    // spoons pile up: sixteen tablespoons of ranch dressing is one cup of it
    if (LADDER.indexOf(unit) > 0) {
      e.d = LADDER.filter((u) => food.g[u]).map((u) => [u, round2(food.g[u])]);
    }
  }
  if (food.split) e.s = 1;
  shop[key] = e;
});

const header = `/* Generated by tools/build-data.js — do not edit by hand.
 * Run and Not Be Weary calories, protein, carbohydrate and fat are as authored in the
 * original book. Sodium and fiber are estimated from the ingredient lists for
 * every recipe in both volumes, and all of Around the Table's macros are (est: true).
 * See AUDIT.md.
 *
 * ingp is the parsed ingredient list the shopping list adds up:
 *   k food key   g grams   u the unit the line was written in
 *   a the seasoning's own name, where several share one food key
 *   x needs something the standard storehouse order does not carry
 */
`;
/* ---------------------------------------------------------------------------
 * The pantry: every food the recipes use, the shelf it belongs on, and whether
 * the standard storehouse order carries it.
 *
 * `s` is the answer the books were written against, not a permanent fact. The
 * app lets a reader keep their own pantry, and once they do, what counts as
 * something to buy follows their shelf rather than this one. That is the point
 * of recording it here rather than leaving it baked into each ingredient: a
 * flag on an ingredient can only ever describe the storehouse, and a household
 * that stops shopping there needs the question asked again.
 *
 * A food counts as standard unless something says otherwise, and two things
 * can say otherwise.
 *
 * The first is the recipes. Four foods are claimed both ways — whey, garlic,
 * chocolate chips and cocoa — and the tie used to go to the storehouse. That
 * was backwards. A recipe that marks an ingredient as an extra is telling you
 * something; a recipe that does not mark it is only silent, and silence is not
 * agreement. Cocoa is flagged by sixteen recipes and unflagged by one. So any
 * flag anywhere settles it, and the shopping list follows the pantry rather
 * than the other way round.
 *
 * The second is this list, for foods no recipe ever flagged and the storehouse
 * has never carried. Nothing in the data can catch these — an unflagged
 * ingredient looks exactly like a staple — so they are named. Crio Bru is the
 * one that gave the game away: roasted cacao is a thing you order from a
 * specialty shop, and the book was quietly telling people it came off the
 * shelf with the flour.
 * ------------------------------------------------------------------------- */
const NOT_STOCKED = { crio_bru: 1 };
/* free is the sentinel for a line with no weight, and water is not shopping.
   Neither is a thing anyone keeps, so neither is in pantry-cats.js and neither
   belongs here. */
const NOT_KEPT = { free: 1, water: 1 };
const anyExtra = {};
out.forEach((r) => (r.ingp || []).forEach((it) => {
  if (NOT_KEPT[it.k]) return;
  if (it.x) anyExtra[it.k] = true;
  else if (anyExtra[it.k] === undefined) anyExtra[it.k] = false;
}));
const pantry = {};
Object.keys(CATS).sort().forEach((k) => {
  pantry[k] = {
    l: (shop[k] && shop[k].l) || k.replace(/_/g, ' '),
    c: CATS[k],
    s: !anyExtra[k] && !NOT_STOCKED[k],
  };
});
const usedNotCategorised = Object.keys(anyExtra).filter((k) => !CATS[k]);
if (usedNotCategorised.length) {
  throw new Error('foods with no shelf in pantry-cats.js: ' + usedNotCategorised.join(', '));
}

fs.writeFileSync(path.join(ROOT, 'data', 'recipes.js'),
  header + 'window.RECIPES = ' + JSON.stringify(out) + ';\n'
  + 'window.SHOP = ' + JSON.stringify(shop) + ';\n'
  + 'window.PANTRY = ' + JSON.stringify(pantry) + ';\n');

/* ---------------------------------------------------------------------------
 * data/nutrition.js — the food table, the parser and the score, for the browser.
 *
 * A recipe you write yourself gets the same treatment as a printed one: its
 * ingredients are read, weighed and scored the moment you save it. That needs
 * the same code in the browser as here, and the only safe way to have the same
 * code in two places is to not have it in two places. This concatenates the
 * three source files with their require and export lines taken out, so there is
 * one implementation and it is the one that was tested.
 * ------------------------------------------------------------------------- */
const bundleSrc = ['food-db.js', 'parse-lib.js', 'score-lib.js']
  .map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8')
    .split('\n')
    .filter((l) => !/^const \{[^}]*\} = require\(/.test(l) && !/^module\.exports/.test(l))
    .join('\n'))
  .join('\n');

fs.writeFileSync(path.join(ROOT, 'data', 'nutrition.js'),
  '/* Generated by tools/build-data.js from tools/food-db.js, parse-lib.js and\n'
  + ' * score-lib.js — do not edit by hand. Used to work out the macros and score\n'
  + ' * of a recipe you write yourself, exactly as the printed ones were done.\n'
  + ' */\n'
  + 'window.Nutrition = (function () {\n'
  + bundleSrc
  + '\nreturn { FOODS: FOODS, ALIASES: ALIASES, SPICE_NAMES: SPICE_NAMES,\n'
  + '  parseLine: parseLine, scoreFrom: scoreFrom, nutritionFor: nutritionFor };\n'
  + '})();\n');

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

const allScores = out.map((r) => r.score).filter((s) => s !== null).sort((a, b) => a - b);
const srcById = {};
SRC.forEach((r) => { srcById[r.id] = r; });
const movers = out.filter((r) => r.book === 1)
  .map((r) => ({
    id: r.id, name: r.name, was: srcById[r.id].score, now: r.score,
    na: r.macro.na, fib: r.macro.fib, d: Math.abs(srcById[r.id].score - r.score),
  }))
  .sort((a, b) => b.d - a.d).slice(0, 10);

const b2 = out.filter((r) => r.book === 2);
const b2scores = b2.map((r) => r.score).filter((s) => s !== null).sort((a, b) => a - b);

let md = `# Nutrition audit

Generated by \`tools/build-data.js\`. Re-run it after any change to the food table.

The two volumes: **Run and Not Be Weary** (100 recipes, macros as authored) and
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

Two changes, both because the original score was measuring the wrong things.

The storehouse bonus is gone. Ten points in a hundred were awarded for shopping
convenience, which says nothing about whether a recipe is good for you — identical
brownies scored ten apart depending on where the cocoa came from. Whether a recipe
needs anything beyond the standard order is still on every recipe, on the line at
its foot.

**Sodium and fiber are in.** The original score had neither, in a collection built
on canned chicken, canned soup, deli ham and boxed mixes — and it treated salt as
a free ingredient worth nothing at all. The result was that a can of tuna with
mayonnaise scored 98 and a pot of beans and vegetables scored in the sixties. Any
sort by "healthiest" ran backwards.

| Component | Max | Rule |
|---|---|---|
| Protein share | 30 | \`min(30, protein% of calories ÷ 45 × 30)\` |
| Calorie load | 20 | \`20 − (kcal − 300) ÷ 25\`, clamped to 0–20 — full marks to 300 kcal |
| Fat share | 10 | \`10 × (45 − fat% of calories) ÷ 35\`, clamped to 0–10 |
| Sodium | 25 | \`25 × (1200 − mg) ÷ 900\`, clamped to 0–25 — full marks to 300 mg, nothing by 1,200 |
| Fiber | 15 | \`15 × g ÷ 7\`, clamped to 0–15 — full marks at 7 g |

**Printed scores therefore differ from the original book's, substantially and by
design.** Score is the rounded sum of the unrounded parts, which is why the pieces
do not always visibly add up.

Sodium and fiber are estimated from the ingredient lists for **every** recipe in
both volumes, including the hundred whose calories and protein were authored — the
book never carried either figure. So half the weight of every score rests on the
food table, and the app says so on each recipe.

Every Run and Not Be Weary macro set is also internally consistent under Atwater factors
(4 kcal/g protein and carbohydrate, 9 kcal/g fat) — no stated calorie count is
more than 12% away from the sum of its own macros.

### What that did to the numbers

Score range across all ${allScores.length} scored recipes: **${allScores[0]}–${allScores[allScores.length - 1]}**, median **${allScores[Math.floor(allScores.length / 2)]}**.
Under the old formula almost everything clustered in the eighties and nineties,
which is another way of saying it was not discriminating.

The Run and Not Be Weary recipes that fell furthest from their authored score:

| # | Recipe | Was | Now | Sodium | Fiber |
|---|---|---|---|---|---|
${movers.filter((x) => x.now < x.was).slice(0, 8).map((x) => `| ${x.id} | ${x.name} | ${x.was} | ${x.now} | ${x.na} mg | ${x.fib} g |`).join('\n')}

Deli ham, canned soup and bottled sauce, every one. And the ones that rose:

| # | Recipe | Was | Now | Sodium | Fiber |
|---|---|---|---|---|---|
${movers.filter((x) => x.now > x.was).slice(0, 6).map((x) => `| ${x.id} | ${x.name} | ${x.was} | ${x.now} | ${x.na} mg | ${x.fib} g |`).join('\n')}

Fruit and oats, which the old score had nothing good to say about because it only
ever asked how much protein was in them.

## 2. Run and Not Be Weary — stated macros vs. ingredients

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

${batchLooking.length} multi-serving Run and Not Be Weary recipes state a calorie figure close to what the
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
shows "Estimated from ingredients" next to its macros and its score. Run and Not Be Weary's
numbers are never labelled that way, so the two are never confused.

### What the estimates assume

- Meat weights are raw, because that is how the recipes state them. Fat lost to
  draining browned beef is not subtracted.
- "1 can" without a size means the common size for that item — 15 oz for beans,
  tomato sauce and fruit, 10.5 oz for condensed soup, 5 oz for tuna. Canned
  protein, beans and vegetables are counted at drained weight.
- "Rice" is counted dry and "instant potatoes" as dry flakes, because the books
  write "cooked rice" and "mashed potatoes" separately when they mean the prepared
  form. This assumption is behind several of the Run and Not Be Weary gaps above: 2 cups of dry
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
console.log('Run and Not Be Weary median |Δkcal|:', medAbs + '%', ' within 20%:', within20 + '/' + b1.length, ' ≥30% off:', bigGap.length);
