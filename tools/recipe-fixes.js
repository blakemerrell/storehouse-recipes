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
  /* ---- five recipes you could not follow ------------------------------
   * Three of them list flour, baking powder, milk and butter and then never
   * touch any of it: "Make biscuit dough" is not a method, it is the name of
   * one. Two more say "make quick pancake cornbread flatbread on skillet",
   * which names three different breads in one sentence and gives no liquid,
   * no pan and no heat.
   *
   * The cornbread is also not cornbread. There is no cornmeal in pancake mix
   * and none on the order list. What the storehouse does have is canned corn,
   * so these are now a corn skillet bread that actually contains corn — the
   * honest version of what the title was already promising, and better beside
   * a bowl of chili than a plain pancake would be.
   *
   * The biscuit ratio is the same in all three, because it is the same dough:
   * 2 cups flour, 1 tbsp baking powder, 4 tbsp butter, ¾ cup milk. Rubbed in
   * cold and barely mixed, which is the whole difference between a drop
   * biscuit and a scone.
   */
  {
    id: 107,
    name: 'Cheesy Sausage & Egg Biscuit Cups',
    time: '35 mins',
    ing: ['2 cups flour', '1 tbsp baking powder', '4 tbsp butter', '¾ cup milk',
      '3 eggs', '4 oz sausage', '¼ cup cheddar', 'salt'],
    steps: [
      'Heat the oven to 375°F and butter six cups of a muffin tin.',
      'Cook the sausage in a skillet, breaking it up, until no pink is left. Drain it.',
      'Rub the cold butter into the flour, baking powder and a teaspoon of salt with your fingertips until it looks like coarse crumbs. Stir in the milk with a fork until it just comes together — a few dry patches are better than a smooth dough.',
      'Press a golf ball of dough into each cup and up the sides to make a shell.',
      'Divide the sausage between the shells, beat the eggs and pour them over, and top with the cheddar.',
      'Bake 20 minutes, until the egg is set and the edges are golden.',
    ],
  },
  {
    id: 180,
    steps: [
      'Simmer the beef, potatoes, carrots and onion in 3 cups of water in a Dutch oven for 1 hour.',
      'Rub the cold butter into the flour, baking powder and a teaspoon of salt until it looks like coarse crumbs, then stir in the milk with a fork until it just holds together. Do not knead it — drop biscuits are light because the dough is barely mixed.',
      'Drop the dough over the stew in rough spoonfuls, leaving gaps for the steam, and bake uncovered at 375°F for 20 minutes. They are done when the tops are golden and one pulled open at the middle is dry rather than sticky.',
    ],
  },
  {
    id: 188,
    ing: ['1.5 lbs ground beef', '1 can corn', '1 can green beans', '1 can carrots',
      '1 pkg beef gravy mix', '2 cups flour', '1 tbsp baking powder', '4 tbsp butter',
      '¾ cup milk', 'salt'],
    steps: [
      'Heat the oven to 375°F.',
      'Brown the beef and drain it. Drain the vegetables, stir them in, and make up the gravy as the packet says.',
      'Rub the cold butter into the flour, baking powder and a teaspoon of salt until crumbly, then stir in the milk until it just comes together.',
      'Spoon the beef into a baking dish, drop the dough over it in rough spoonfuls, and bake 25 minutes until the topping is golden and dry at the centre.',
    ],
  },
  {
    id: 158,
    name: 'Mild Beef & Bean Chili with Corn Skillet Bread',
    ing: ['1.5 lbs ground beef', '2 cans pinto beans', '1 can tomato sauce',
      '1 can diced tomatoes', '1 cup pancake mix', '1 can corn', '1 egg', '½ cup milk',
      '1 tbsp vegetable oil'],
    steps: [
      'Brown the beef 8 minutes, breaking it up, and drain it. Add the beans, tomato sauce and diced tomatoes and simmer 20 minutes.',
      'Meanwhile whisk the pancake mix with the egg and milk into a thick batter — closer to muffin batter than pancake batter — and fold in the drained corn.',
      'Heat the oil in a skillet over medium. Pour the batter in, cover, and cook 6 to 8 minutes until the top is set, then flip it and give it 3 minutes more.',
      'Cut it into wedges and serve with the chili. It is not cornbread, since there is no cornmeal in pancake mix, but with the corn through it it does the same job beside a bowl of chili.',
    ],
  },
  {
    id: 193,
    name: 'Hearty Country Beef Chili & Corn Skillet Bread',
    ing: ['2 lbs ground beef', '2 cans pinto beans', '1 can tomato sauce', '1 cup cheddar',
      '2 cups pancake mix', '1 can corn', '2 eggs', '1 cup milk'],
    steps: [
      'Simmer the beef, beans and tomato sauce 30 minutes.',
      'Heat the oven to 400°F and butter a 9-inch pan. Whisk the pancake mix with the eggs and milk into a thick batter, then fold in the drained corn.',
      'Bake 20 to 25 minutes, until the top is golden and a knife in the middle comes out clean.',
      'Serve the chili topped with the cheddar, with the bread cut into squares alongside.',
    ],
  },

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
