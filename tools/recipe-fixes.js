/*
 * Corrections applied to the original recipe text at build time.
 *
 * The originals in design/project/ are left exactly as they arrived. Anything
 * that needed changing is listed here instead, so it is obvious what was
 * altered and why, and so a corrected original can be dropped in later without
 * unpicking edits made in place.
 *
 * All eighteen entries below are the same problem: a recipe that cooks raw
 * chicken and never says how to know it is done. Two of them are worse — the
 * ingredient list says "cooked" or "shredded" chicken but no step ever cooks
 * it, so following the recipe literally puts raw chicken into a casserole.
 *
 * 165°F is the USDA figure for poultry.
 *
 * The nineteenth is a different kind of wrong, and uses `set` rather than
 * `add`: the step is replaced instead of appended to. No. 006 said "whisk in
 * dry milk powder until dissolved", into a cup of yogurt. It does hydrate —
 * a cup of yogurt is around 200 g of water and two tablespoons of powder is
 * under nine — but tipped in it clumps, and "until dissolved" promises
 * something that does not happen in anything that thick. The six warm drinks
 * added later all turn on the same technique, so the fix is the one they use.
 */

module.exports = [
  { id: 6, step: 1, set: 'Sprinkle the dry milk over the yogurt a little at a time, whisking as you go, and let it stand a minute. Tipped in all at once it clumps and stays that way.' },
  { id: 54, step: 2, add: 'Check the chicken before serving: no pink at the centre, 165°F on a thermometer.' },
  { id: 57, step: 0, add: 'Cut a piece open to check — the chicken should be white through to the middle, 165°F.' },
  { id: 61, step: 0, add: 'Give it longer if the breasts are thick — done means 165°F and no pink at the centre.' },
  { id: 63, step: 1, add: 'If the chicken is not already cooked, cook it through first — 165°F, no pink at the centre.' },
  { id: 66, step: 0, add: 'Check a piece: white all the way through, 165°F.' },
  { id: 73, step: 2, add: 'Thick breasts may want another five minutes. Done means 165°F and clear juices.' },
  { id: 153, step: 1, add: 'Cook the chicken through before it goes into the dish — 165°F, no pink at the centre. The topping bakes faster than raw chicken would.' },
  { id: 156, step: 0, add: 'Check the thickest breast reads 165°F before taking them out.' },
  { id: 160, step: 2, add: 'The chicken must be cooked through — 165°F. Cook it first if it went in raw and diced.' },
  { id: 163, step: 1, add: 'Cook the chicken through first if it is raw — 165°F, no pink at the centre.' },
  { id: 165, step: 1, add: 'Check it is white through the middle, 165°F, before the sauce goes in.' },
  { id: 169, step: 1, add: 'Strips this thin cook quickly, but check one at the thickest point: 165°F, no pink.' },
  { id: 179, step: 1, add: 'Cook it through — 165°F — before it is mixed with the pasta.' },
  { id: 182, step: 0, add: 'Roast until the thickest breast reads 165°F and the juices run clear.' },
  { id: 186, step: 2, add: 'Whole breasts under a blanket of sauce take longer than you expect. Check the thickest one reads 165°F before serving.' },
  { id: 190, step: 1, add: 'Cook and shred the chicken first — 165°F. It will not cook through once it is rolled up and covered in sauce.' },
  { id: 192, step: 2, add: 'Check the chicken is cooked through, 165°F, before serving.' },
  { id: 198, step: 1, add: 'A crisp crust is not proof it is cooked. Check the thickest part reads 165°F.' },
];
