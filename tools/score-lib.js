/*
 * The nutrition score, on its own so that three things can share it: the build
 * that scores the 266 printed recipes, the browser that scores the ones you
 * write yourself, and anyone auditing either.
 */

/*
 * This edition's score. Five things, out of 100.
 *
 * The first three are the original book's, rescaled. The last two are new, and
 * are the reason this was worth redoing: the old score awarded nothing for
 * fiber and counted salt as free, in a collection built on canned chicken,
 * canned soup and boxed mixes. A can of tuna with mayonnaise scored 98 while a
 * pot of beans and vegetables scored in the sixties. Sodium and fiber are
 * estimated from the ingredients for every recipe in both volumes, including
 * the ones whose calories and protein were authored.
 */
function scoreFrom(macro) {
  const pPct = (macro.p * 4) / macro.kcal * 100;
  const fPct = (macro.f * 9) / macro.kcal * 100;
  const na = macro.na || 0;
  const fib = macro.fib || 0;
  const clamp = (x, hi) => Math.max(0, Math.min(hi, x));

  const p = clamp((pPct / 45) * 30, 30);              // protein share of energy
  const k = clamp(20 - Math.max(0, macro.kcal - 300) / 25, 20);  // calorie load
  const f = clamp((10 * (45 - fPct)) / 35, 10);       // fat share of energy
  const s = clamp(25 * (1200 - na) / 900, 25);        // sodium: full to 300 mg, nothing by 1200
  const b = clamp(15 * (fib / 7), 15);                // fiber: full marks at 7 g

  return {
    score: Math.round(p + k + f + s + b),
    sc: {
      p: Math.round(p), k: Math.round(k), f: Math.round(f), s: Math.round(s), b: Math.round(b),
      pPct: Math.round(pPct), fPct: Math.round(fPct), na: Math.round(na), fib: Math.round(fib * 10) / 10,
    },
  };
}

/*
 * Everything a recipe's ingredient list is worth: calories and macros per
 * serving, sodium, fiber, and the parsed lines the shopping list adds up.
 * The build uses this for the printed books; the app uses it the moment you
 * finish typing a recipe of your own, so both are measured the same way.
 */
function nutritionFor(ing, servN, extras, parseLine, FOODS, SPICE_NAMES) {
  let kcal = 0, p = 0, c = 0, f = 0, na = 0, fib = 0;
  const unmatched = [], assumed = [], items = [];
  const names = String(extras || '').toLowerCase().split(/,\s*/).map((x) => x.trim()).filter(Boolean);

  (ing || []).forEach((line) => {
    const r = parseLine(line);
    if (!r) return;
    if (r.unmatched) { unmatched.push(r.unmatched); return; }
    if (r.assumed) assumed.push(line + ' \u2014 ' + r.assumed);
    const food = FOODS[r.key];
    const k = r.grams / 100;
    kcal += food.kcal * k; p += food.p * k; c += food.c * k; f += food.f * k;
    na += (food.na || 0) * k; fib += (food.fib || 0) * k;
    const it = { k: r.key, g: Math.round(r.grams * 10) / 10, u: r.unit || '' };
    if (food.split) it.a = SPICE_NAMES[r.alias] || r.alias;
    if (names.some((n) => line.toLowerCase().indexOf(n) >= 0)) it.x = 1;
    items.push(it);
  });

  const n = servN && servN > 0 ? servN : 1;
  return {
    perServing: {
      kcal: Math.round(kcal / n), p: Math.round(p / n), c: Math.round(c / n), f: Math.round(f / n),
      na: Math.round(na / n), fib: Math.round((fib / n) * 10) / 10,
    },
    items, unmatched, assumed,
  };
}

module.exports = { scoreFrom, nutritionFor };
