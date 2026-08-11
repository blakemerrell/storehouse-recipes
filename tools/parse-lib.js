/*
 * Turns an ingredient line into a food key and a weight in grams.
 *
 * Shared by build-data.js, which uses it to work out macros, and
 * check-recipes.js, which uses it to check kitchen ratios. One implementation
 * so the two can never disagree about what "1 can peaches" weighs.
 */

const { FOODS, ALIASES } = require('./food-db.js');

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

/* Returns the food key, and the alias that matched. The alias matters for the
   zero-calorie seasonings, which all share one food key and so have to be told
   apart on the shopping list by the words the recipe used. */
function lookupAlias(name) {
  const n = name.trim();
  if (ALIASES[n]) return { key: ALIASES[n], alias: n };
  for (const k of ALIAS_KEYS) {
    // whole-word containment so "ham" does not match "graham"
    const re = new RegExp('(^|[^a-z])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z])');
    if (re.test(n)) return { key: ALIASES[k], alias: k };
  }
  return null;
}

function lookupFood(name) {
  const hit = lookupAlias(name);
  return hit ? hit.key : null;
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

  const hit = lookupAlias(foodName);
  if (!hit) return { unmatched: foodName, raw };
  const key = hit.key;
  const food = FOODS[key];

  // ---- work out grams --------------------------------------------------
  let grams;
  let used = null;               // the unit this line was actually counted in
  if (vagueUnit) {
    const v = VAGUE[vagueUnit];
    grams = vagueUnit === 'splash' ? v * (food.g.tbsp || 15)
      : vagueUnit === 'handful' ? v * (food.g.cup || 100)
        : v * (food.g.tsp || 2);
  } else if (explicit && (unit === 'can' || unit === 'pkg' || unit === 'box' || unit === 'jar')) {
    used = unit;
    const per = explicit.u === 'oz' ? 28.35 : explicit.u === 'lb' ? 453.6 : 1;
    grams = (qty === null ? 1 : qty) * explicit.n * per * (DRAIN[key] || 1);
  } else {
    if (qty === null) {
      if (!food.def) return { key, grams: 0, alias: hit.alias, unit: null, assumed: 'treated as a garnish' };
      qty = food.def.qty;
      unit = food.def.unit;
    }
    if (!unit) unit = 'each';
    let per;
    if (unit === 'g') per = 1;
    else if (unit === 'oz') per = 28.35;
    else if (unit === 'lb') per = 453.6;
    else per = food.g[unit];
    /* A spoon the table does not list is derived from the one it does: three
       teaspoons to a tablespoon, sixteen tablespoons to a cup. Honey is the
       one that showed this up — its table has cup and tbsp and no tsp, and
       "1 tsp honey" fell through to the blind substitute below, which offered
       `cup` first. A teaspoon of honey was being counted as a cup of it: 7 g
       read as 339 g, and a mug of warm milk came out at twelve hundred
       calories with nothing printed to say so.

       So the volume units convert, and `cup` is no longer a thing any unit may
       silently become. What is left in the blind list is containers, which is
       the case it was written for — "1 can" of something the table sizes by
       the each. Nothing in the book took this path either way. */
    if (per === undefined) {
      const cup = food.g.cup, tbsp = food.g.tbsp, tsp = food.g.tsp;
      if (unit === 'tsp') per = tbsp !== undefined ? tbsp / 3 : cup !== undefined ? cup / 48 : undefined;
      else if (unit === 'tbsp') per = cup !== undefined ? cup / 16 : tsp !== undefined ? tsp * 3 : undefined;
      else if (unit === 'cup') per = tbsp !== undefined ? tbsp * 16 : tsp !== undefined ? tsp * 48 : undefined;
    }
    if (per === undefined) {
      per = food.g.each || food.g.can || food.g.pkg || food.g.box || food.g.jar;
      if (per === undefined) return { unmatched: foodName + ' [unit ' + unit + ']', raw };
    }
    grams = qty * per * sizeMult;
    used = unit;
  }

  // Oil for deep frying is mostly left in the pan. Counting all of it makes a
  // fried dish read like a stick of butter; food takes up roughly an eighth.
  if (key === 'oil' && /for frying|to fry|for the pan/i.test(raw)) grams *= 0.12;

  return { key, grams, alias: hit.alias, unit: used };
}

/** Convenience wrapper: returns { key, grams } or null if unreadable. */
function gramsFor(line) {
  const r = parseLine(line);
  if (!r || r.unmatched || !r.grams) return null;
  return r;
}

module.exports = { parseLine, gramsFor, FOODS, ALIASES };
