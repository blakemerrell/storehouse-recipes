/*
 * Sanity-checks recipes against standard kitchen ratios.
 *
 * This does not taste anything. What it can do is catch the errors that make a
 * recipe fail outright — too little yeast to rise, dough too dry to come
 * together, baking soda with no acid to react against, a custard that will
 * never set — by working every recipe back to grams and comparing the ratios
 * to the ranges standard baking references agree on.
 *
 * Run: node tools/check-recipes.js [--all]
 */

const path = require('path');
const { gramsFor } = require('./parse-lib.js');

const ROOT = path.join(__dirname, '..');
global.window = {};
require(path.join(ROOT, 'data', 'recipes.js'));
const ALL = global.window.RECIPES;

const ONLY_ADDED = !process.argv.includes('--all');
const RECIPES = ONLY_ADDED ? ALL.filter((r) => r.id >= 226) : ALL;

// ---------------------------------------------------------------------------
// Reference ranges. Sources are the ones bakers actually agree on: baker's
// percentages for yeasted dough, standard chemical-leavening rates per cup of
// flour, and classic custard egg-to-dairy ratios.
// ---------------------------------------------------------------------------
const RULES = {
  hydration:   { lo: 0.52, hi: 0.78, what: 'liquid as a share of flour weight' },
  saltPct:     { lo: 0.010, hi: 0.030, what: 'salt as a share of flour weight' },
  yeastPer500: { lo: 4, hi: 18, what: 'g yeast per 500 g flour' },
  bpPerCup:    { lo: 0.75, hi: 2.0, what: 'tsp baking powder per cup of flour' },
  bsPerCup:    { lo: 0.2, hi: 0.85, what: 'tsp baking soda per cup of flour' },
  custardEggs: { lo: 1.2, hi: 3.2, what: 'eggs per cup of dairy' },
};

// things acidic enough to set baking soda off
const ACIDS = ['brown sugar', 'sour cream', 'buttermilk', 'banana', 'cocoa', 'honey',
  'jam', 'applesauce', 'yogurt', 'molasses', 'vinegar', 'lemon', 'lime'];

function tspOf(r, name) {
  let tsp = 0;
  r.ing.forEach((line) => {
    if (!new RegExp(name, 'i').test(line)) return;
    const m = line.match(/^(\d+(?:\.\d+)?)?\s*([½¼¾⅓⅔⅛⅜⅝⅞])?\s*(tbsp|tsp)/i);
    if (!m) return;
    const FR = { '½': .5, '¼': .25, '¾': .75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': .125, '⅜': .375, '⅝': .625, '⅞': .875 };
    const n = (m[1] ? parseFloat(m[1]) : 0) + (m[2] ? FR[m[2]] : 0);
    tsp += /tbsp/i.test(m[3]) ? n * 3 : n;
  });
  return tsp;
}

function totals(r) {
  const t = { flour: 0, liquid: 0, fat: 0, sugar: 0, eggs: 0, yeast: 0, salt: 0, dairy: 0 };
  r.ing.forEach((line) => {
    const g = gramsFor(line);
    if (!g) return;
    const k = g.key;
    if (k === 'flour' || k === 'oat_flour') t.flour += g.grams;
    // eggs count as liquid in baker's math, butter partly so
    if (k === 'milk' || k === 'water' || k === 'evaporated_milk') t.liquid += g.grams;
    if (k === 'egg') t.liquid += g.grams;
    // cap the fat contribution: a recipe's butter may be filling or topping,
    // not dough, and the checker cannot tell which from the ingredient list
    if (k === 'butter' || k === 'oil') t.liquid += Math.min(g.grams, 60) * 0.2;
    if (k === 'milk' || k === 'evaporated_milk') t.dairy += g.grams;
    if (k === 'butter' || k === 'oil') t.fat += g.grams;
    if (/sugar|honey/.test(k)) t.sugar += g.grams;
    if (k === 'egg') t.eggs += g.grams / 50;
    if (k === 'yeast') t.yeast += g.grams;
  });
  // salt is a "free" food with no weight, so read it off the text
  t.salt = tspOf(r, 'salt') * 6;   // 1 tsp table salt ≈ 6 g
  t.flourCups = t.flour / 125;
  return t;
}

const findings = [];
function flag(r, severity, msg) { findings.push({ r, severity, msg }); }

RECIPES.forEach((r) => {
  const t = totals(r);
  const text = (r.ing.join(' ') + ' ' + r.steps.join(' ')).toLowerCase();
  const isBake = t.flour > 60;

  // ---- yeasted dough --------------------------------------------------
  if (t.yeast > 0) {
    const hyd = t.liquid / t.flour;
    if (hyd < RULES.hydration.lo) flag(r, 'FAIL', `dough too dry — ${(hyd * 100).toFixed(0)}% ${RULES.hydration.what} (want ${RULES.hydration.lo * 100}–${RULES.hydration.hi * 100}%)`);
    else if (hyd > RULES.hydration.hi) flag(r, 'WARN', `dough very wet — ${(hyd * 100).toFixed(0)}% hydration`);

    const yp = (t.yeast / t.flour) * 500;
    if (yp < RULES.yeastPer500.lo) flag(r, 'FAIL', `not enough yeast — ${yp.toFixed(1)} ${RULES.yeastPer500.what}`);
    else if (yp > RULES.yeastPer500.hi) flag(r, 'WARN', `heavy on yeast — ${yp.toFixed(1)} g per 500 g flour`);

    const sp = t.salt / t.flour;
    if (t.salt === 0) flag(r, 'FAIL', 'yeasted dough with no salt — it will taste flat and over-rise');
    else if (sp < RULES.saltPct.lo) flag(r, 'WARN', `low salt — ${(sp * 100).toFixed(1)}% of flour weight`);
    else if (sp > RULES.saltPct.hi) flag(r, 'WARN', `high salt — ${(sp * 100).toFixed(1)}% of flour weight, may slow the rise`);

    if (!/knead/i.test(text)) flag(r, 'WARN', 'yeasted dough but no kneading step');
    if (!/rise|doubled|prove|proof/i.test(text)) flag(r, 'FAIL', 'yeasted dough with no rise');
  }

  // ---- chemical leavening ---------------------------------------------
  const bp = tspOf(r, 'baking powder');
  const bs = tspOf(r, 'baking soda');
  if (isBake && bp > 0) {
    const per = bp / t.flourCups;
    if (per < RULES.bpPerCup.lo) flag(r, 'WARN', `light on baking powder — ${per.toFixed(2)} ${RULES.bpPerCup.what}`);
    if (per > RULES.bpPerCup.hi) flag(r, 'WARN', `heavy on baking powder — ${per.toFixed(2)} tsp per cup, can taste metallic`);
  }
  if (isBake && bs > 0) {
    const per = bs / t.flourCups;
    if (per > RULES.bsPerCup.hi) flag(r, 'WARN', `heavy on baking soda — ${per.toFixed(2)} tsp per cup of flour, can taste soapy`);
    const acid = ACIDS.find((a) => text.includes(a));
    if (!acid) flag(r, 'FAIL', 'baking soda with nothing acidic to react with — it will not lift, and will taste of soda');
  }
  if (isBake && bp === 0 && bs === 0 && t.yeast === 0 && /\bcake\b|muffin|biscuit|scone|bread/i.test(r.name)) {
    flag(r, 'WARN', 'a raised bake with no leavening of any kind');
  }

  // ---- custards --------------------------------------------------------
  const starchSet = /rice|bread|cornstarch|flour/i.test(r.ing.join(' '));
  if (/custard|flan/i.test(r.name) && !starchSet && t.eggs > 0 && t.dairy > 0) {
    const per = t.eggs / (t.dairy / 244);
    if (per < RULES.custardEggs.lo) flag(r, 'FAIL', `too few eggs to set — ${per.toFixed(1)} ${RULES.custardEggs.what}`);
    if (per > RULES.custardEggs.hi) flag(r, 'WARN', `egg-heavy custard — ${per.toFixed(1)} eggs per cup of dairy, may turn rubbery`);
  }

  // ---- food safety and technique --------------------------------------
  if (/\bchicken\b/i.test(r.name) && /fry|bake|roast|grill/i.test(text)) {
    if (!/165|cooked through|no longer pink|juices run clear/i.test(text)) {
      flag(r, 'WARN', 'chicken with no doneness cue given');
    }
  }
  const deepFrying = /\d\s*cups?\s+(vegetable\s+)?oil/i.test(r.ing.join(' '));
  if (deepFrying) {
    if (!/\b3[0-9]{2}\s*°?f/i.test(text)) flag(r, 'WARN', 'frying without a stated oil temperature');
  }
  if (/\btemper(?:ing|ed)?\b|pour[^.]{0,60}into the eggs/i.test(text) && !/whisk|stirring|beating/i.test(text)) {
    flag(r, 'WARN', 'eggs tempered without a stated whisking action');
  }

  // ---- oven temperatures ----------------------------------------------
  // Only count a figure as an oven or oil setting when something actually sets
  // it there. A doneness reading ("165°F on a thermometer") is not an oven temp,
  // and testing for that negatively kept letting cases through.
  const temps = [...text.matchAll(/(?:oven to|bake at|bake it at|roast at|fry at|heat the oil to|preheat to|at)\s*(\d{3})\s*°?\s*f/gi)]
    .map((m) => +m[1]);
  temps.forEach((tp) => {
    if (tp < 200 || tp > 500) flag(r, 'FAIL', `oven temperature out of range: ${tp}°F`);
  });
  if (isBake && temps.length === 0 && /bake/i.test(text)) {
    flag(r, 'FAIL', 'says to bake but gives no temperature');
  }

  // ---- times must be stated -------------------------------------------
  if (/bake|simmer|fry|boil/i.test(text) && !/\d+\s*(to\s*\d+\s*)?(minute|min|hour|hr)/i.test(text)) {
    flag(r, 'WARN', 'a cooking step with no time given');
  }
});

// ---------------------------------------------------------------------------
const fails = findings.filter((f) => f.severity === 'FAIL');
const warns = findings.filter((f) => f.severity === 'WARN');
console.log(`checked ${RECIPES.length} recipes`);
console.log(`  ${fails.length} would fail as written`);
console.log(`  ${warns.length} worth a second look\n`);
[...fails, ...warns].forEach((f) => {
  console.log(`${f.severity}  ${String(f.r.id).padStart(3)}  ${f.r.name.slice(0, 40).padEnd(40)}  ${f.msg}`);
});
process.exitCode = fails.length ? 1 : 0;
