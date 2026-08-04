/*
 * Food reference table for estimating recipe macros.
 *
 * Every entry is per 100 g: kcal, protein (p), carbohydrate (c), fat (f).
 * Values are standard reference figures (USDA FoodData Central rounded to the
 * nearest sensible figure for a home kitchen). Where a storehouse item has no
 * single obvious match, the note field records what was assumed.
 *
 * `g` holds gram weights for the units the recipes actually use. `each` is the
 * weight of one countable item ("1 apple", "3 eggs"). `def` is what to assume
 * when a line carries no quantity at all ("butter", "cheddar") — see
 * build-data.js for how unquantified lines are handled.
 *
 * Meat weights are raw, because that is how the recipes state them.
 */

const FOODS = {
  // ---- Dairy & eggs -------------------------------------------------------
  milk:            { kcal: 50,  p: 3.3,  c: 4.8,  f: 2.0,  g: { cup: 244, tbsp: 15, tsp: 5 }, note: '2% milk' },
  dry_milk:        { kcal: 358, p: 36,   c: 52,   f: 0.8,  g: { cup: 68, tbsp: 4.3 }, note: 'non-fat dry milk powder' },
  evaporated_milk: { kcal: 134, p: 6.8,  c: 10,   f: 7.6,  g: { cup: 252, can: 340 } },
  cottage_cheese:  { kcal: 84,  p: 11,   c: 4.3,  f: 2.3,  g: { cup: 226, tbsp: 14 }, note: '2% cottage cheese' },
  cheddar:         { kcal: 403, p: 23,   c: 3.1,  f: 33,   g: { cup: 113, tbsp: 7, oz: 28.35, each: 28 }, def: { qty: 0.5, unit: 'cup' }, note: 'shredded; "cheddar slice" = 28 g' },
  cream_cheese:    { kcal: 350, p: 6,    c: 5.5,  f: 34,   g: { cup: 232, tbsp: 14.5 } },
  sour_cream:      { kcal: 198, p: 2.4,  c: 4.6,  f: 19.4, g: { cup: 230, tbsp: 14.4 }, def: { qty: 2, unit: 'tbsp' } },
  vanilla_yogurt:  { kcal: 85,  p: 4.9,  c: 13.8, f: 1.3,  g: { cup: 245, tbsp: 15 }, note: 'lowfat vanilla yogurt' },
  butter:          { kcal: 717, p: 0.85, c: 0.06, f: 81,   g: { cup: 227, tbsp: 14.2, tsp: 4.7, each: 113 }, def: { qty: 1, unit: 'tbsp' } },
  spray_butter:    { kcal: 0,   p: 0,    c: 0,    f: 0,    g: { cup: 200, tbsp: 5 }, note: 'spray butter, treated as zero' },
  egg:             { kcal: 143, p: 12.6, c: 0.7,  f: 9.5,  g: { each: 50, cup: 243 }, note: 'whole large egg, 50 g' },
  egg_white:       { kcal: 52,  p: 10.9, c: 0.7,  f: 0.2,  g: { cup: 243, tbsp: 15, each: 33 } },

  // ---- Meat & fish --------------------------------------------------------
  chicken_breast:  { kcal: 120, p: 22.5, c: 0,    f: 2.6,  g: { lb: 453.6, oz: 28.35, cup: 140, each: 174 }, note: 'raw boneless skinless breast' },
  chicken_canned:  { kcal: 130, p: 23,   c: 0,    f: 3.5,  g: { can: 120, oz: 28.35, cup: 140 }, note: 'canned chicken; plain "1 can" = 5 oz can drained, since the books write "(12.5 oz)" when they mean the large can' },
  ground_beef:     { kcal: 250, p: 17.2, c: 0,    f: 20,   g: { lb: 453.6, oz: 28.35, cup: 225 }, note: 'raw 85/15' },
  beef_roast:      { kcal: 250, p: 17.5, c: 0,    f: 19.5, g: { lb: 453.6, oz: 28.35, cup: 225 }, note: 'raw chuck roast' },
  stewing_beef:    { kcal: 210, p: 19,   c: 0,    f: 14.5, g: { lb: 453.6, oz: 28.35, cup: 225 } },
  cooked_beef:     { kcal: 250, p: 26,   c: 0,    f: 16,   g: { lb: 453.6, oz: 28.35, cup: 225 }, note: 'cooked shredded beef' },
  roast_beef_deli: { kcal: 130, p: 21,   c: 1,    f: 4,    g: { lb: 453.6, oz: 28.35, each: 28 } },
  pork_roast:      { kcal: 230, p: 17,   c: 0,    f: 18,   g: { lb: 453.6, oz: 28.35, cup: 225 }, note: 'raw pork shoulder' },
  ham:             { kcal: 145, p: 16.6, c: 1.5,  f: 8,    g: { lb: 453.6, oz: 28.35, cup: 140, each: 28 }, note: 'sliced deli ham' },
  pork_sausage:    { kcal: 325, p: 12,   c: 1,    f: 30,   g: { lb: 453.6, oz: 28.35, each: 45 }, note: 'raw pork sausage; 1 link = 45 g' },
  beef_frank:      { kcal: 290, p: 10.6, c: 4,    f: 26,   g: { lb: 453.6, oz: 28.35, each: 45 } },
  tuna:            { kcal: 116, p: 26,   c: 0,    f: 0.8,  g: { can: 120, oz: 28.35, cup: 154 }, note: 'canned in water, 5 oz can drained = 120 g' },

  // ---- Beans --------------------------------------------------------------
  black_beans:     { kcal: 91,  p: 6,    c: 16.6, f: 0.3,  g: { can: 250, cup: 172 }, note: 'canned, drained' },
  pinto_beans:     { kcal: 88,  p: 5.5,  c: 16,   f: 0.8,  g: { can: 250, cup: 171 } },
  white_beans:     { kcal: 92,  p: 6.4,  c: 16.5, f: 0.4,  g: { can: 250, cup: 179 }, note: 'Great Northern, canned' },
  refried_beans:   { kcal: 90,  p: 5.5,  c: 15,   f: 1.2,  g: { can: 440, cup: 238 } },
  pork_and_beans:  { kcal: 94,  p: 4.8,  c: 17.7, f: 0.9,  g: { can: 440, cup: 253 } },

  // ---- Grains, flours, mixes ---------------------------------------------
  oats:            { kcal: 379, p: 13.2, c: 67.7, f: 6.5,  g: { cup: 80, tbsp: 5 }, note: 'dry rolled oats' },
  oat_flour:       { kcal: 404, p: 14.7, c: 65.7, f: 9.1,  g: { cup: 92, tbsp: 6 } },
  flour:           { kcal: 364, p: 10.3, c: 76.3, f: 1,    g: { cup: 125, tbsp: 8 }, note: 'all-purpose' },
  rice_dry:        { kcal: 365, p: 7.1,  c: 80,   f: 0.7,  g: { cup: 185 } },
  rice_cooked:     { kcal: 130, p: 2.7,  c: 28,   f: 0.3,  g: { cup: 158 } },
  pancake_mix:     { kcal: 366, p: 9,    c: 73,   f: 4.5,  g: { cup: 125 }, def: { qty: 1, unit: 'cup' }, note: 'dry complete mix; waffle mix treated the same' },
  pasta:           { kcal: 371, p: 13,   c: 74.7, f: 1.5,  g: { lb: 453.6, oz: 28.35, cup: 105, pkg: 453.6 }, note: 'dry pasta' },
  bread:           { kcal: 265, p: 9,    c: 49,   f: 3.2,  g: { each: 28, cup: 45 }, note: '1 slice = 28 g' },
  wheat_bread:     { kcal: 247, p: 13,   c: 41,   f: 3.4,  g: { each: 28, cup: 45 } },
  tortilla:        { kcal: 306, p: 8.2,  c: 51.4, f: 7.1,  g: { each: 45 }, note: 'flour tortilla, 8 in' },
  tortilla_small:  { kcal: 306, p: 8.2,  c: 51.4, f: 7.1,  g: { each: 30 } },
  bun:             { kcal: 279, p: 9.5,  c: 50,   f: 4.2,  g: { each: 52 }, note: 'hamburger / hot dog bun' },
  slider_bun:      { kcal: 279, p: 9.5,  c: 50,   f: 4.2,  g: { each: 30 } },
  breadcrumbs:     { kcal: 395, p: 13.4, c: 72,   f: 5.3,  g: { cup: 108, tbsp: 7 } },
  cereal_o:        { kcal: 386, p: 7,    c: 80,   f: 4.5,  g: { cup: 37 }, note: "Honey Nut O's" },
  biscuit_dough:   { kcal: 320, p: 6.6,  c: 48,   f: 11,   g: { can: 454, each: 57 }, def: { qty: 1, unit: 'can' }, note: 'refrigerated biscuit dough' },

  // ---- Potatoes -----------------------------------------------------------
  potato:          { kcal: 77,  p: 2,    c: 17.5, f: 0.1,  g: { lb: 453.6, cup: 150, each: 173 }, note: 'raw; 1 medium = 173 g' },
  instant_potato:  { kcal: 357, p: 8,    c: 81,   f: 0.4,  g: { cup: 60 }, note: 'dry flakes' },
  mashed_potato:   { kcal: 113, p: 2,    c: 17,   f: 4.2,  g: { cup: 210 }, note: 'prepared with milk and butter' },

  // ---- Vegetables ---------------------------------------------------------
  carrot:          { kcal: 41,  p: 0.9,  c: 9.6,  f: 0.2,  g: { lb: 453.6, cup: 128, can: 250, each: 61 } },
  green_beans:     { kcal: 20,  p: 1.2,  c: 4.1,  f: 0.1,  g: { can: 240, cup: 125 }, def: { qty: 1, unit: 'can' }, note: 'canned, drained' },
  corn:            { kcal: 81,  p: 2.6,  c: 19,   f: 1,    g: { can: 240, cup: 165 }, note: 'canned, drained' },
  broccoli:        { kcal: 34,  p: 2.8,  c: 6.6,  f: 0.4,  g: { lb: 453.6, cup: 91 }, def: { qty: 1, unit: 'lb' } },
  lettuce:         { kcal: 15,  p: 1.4,  c: 2.9,  f: 0.2,  g: { cup: 47, each: 600, oz: 28.35 }, def: { qty: 2, unit: 'cup' }, note: '1 head = 600 g' },
  onion:           { kcal: 40,  p: 1.1,  c: 9.3,  f: 0.1,  g: { cup: 160, each: 110 }, def: { qty: 0.5, unit: 'each' } },
  tomato:          { kcal: 18,  p: 0.9,  c: 3.9,  f: 0.2,  g: { cup: 180, each: 123 }, def: { qty: 1, unit: 'each' }, note: '1 large = 182 g, handled by the parser' },
  tomato_canned:   { kcal: 32,  p: 1.5,  c: 7,    f: 0.2,  g: { can: 411, cup: 240 }, note: 'canned diced tomatoes' },
  bell_pepper:     { kcal: 26,  p: 1,    c: 6,    f: 0.3,  g: { lb: 453.6, cup: 149, each: 119 }, def: { qty: 1, unit: 'each' } },
  cucumber:        { kcal: 15,  p: 0.65, c: 3.6,  f: 0.1,  g: { cup: 133, each: 300 }, def: { qty: 0.5, unit: 'each' } },
  garlic:          { kcal: 149, p: 6.4,  c: 33,   f: 0.5,  g: { each: 3, tsp: 2.8, tbsp: 8.4 }, def: { qty: 1, unit: 'each' } },

  // ---- Fruit --------------------------------------------------------------
  apple:           { kcal: 52,  p: 0.3,  c: 14,   f: 0.2,  g: { cup: 125, each: 182 } },
  banana:          { kcal: 89,  p: 1.1,  c: 22.8, f: 0.3,  g: { cup: 150, each: 118 } },
  orange:          { kcal: 47,  p: 0.9,  c: 11.8, f: 0.1,  g: { cup: 165, each: 140 } },
  grapes:          { kcal: 69,  p: 0.7,  c: 18,   f: 0.2,  g: { cup: 151, each: 5 } },
  peaches_canned:  { kcal: 54,  p: 0.6,  c: 14,   f: 0.1,  g: { can: 425, cup: 244 }, note: 'canned in juice; plain "1 can" = 15 oz' },
  pears_canned:    { kcal: 60,  p: 0.4,  c: 15.6, f: 0.1,  g: { can: 425, cup: 244 } },
  applesauce:      { kcal: 68,  p: 0.2,  c: 17.5, f: 0.2,  g: { jar: 680, cup: 244, can: 680 } },
  raisins:         { kcal: 299, p: 3.1,  c: 79,   f: 0.5,  g: { cup: 145, tbsp: 9 } },
  fruit_generic:   { kcal: 60,  p: 0.7,  c: 15,   f: 0.2,  g: { cup: 150, each: 140 }, def: { qty: 1, unit: 'cup' }, note: 'unspecified fresh/frozen fruit' },

  // ---- Sauces, condiments, sweeteners -------------------------------------
  salsa:           { kcal: 29,  p: 1.5,  c: 6,    f: 0.2,  g: { cup: 260, tbsp: 16, jar: 453 }, def: { qty: 0.25, unit: 'cup' } },
  tomato_sauce:    { kcal: 24,  p: 1.2,  c: 5.3,  f: 0.2,  g: { can: 425, cup: 245 } },
  spaghetti_sauce: { kcal: 60,  p: 1.6,  c: 9.6,  f: 1.8,  g: { jar: 680, can: 680, cup: 245 } },
  tomato_soup:     { kcal: 70,  p: 1.6,  c: 14,   f: 1.2,  g: { can: 298, cup: 245 }, note: 'condensed' },
  cream_soup_chx:  { kcal: 90,  p: 2.4,  c: 7.5,  f: 5.6,  g: { can: 298, cup: 245 }, note: 'condensed cream of chicken' },
  cream_soup_mush: { kcal: 82,  p: 1.6,  c: 6.5,  f: 5.3,  g: { can: 298, cup: 245 }, note: 'condensed cream of mushroom' },
  soup_rts:        { kcal: 45,  p: 2.5,  c: 6,    f: 1.2,  g: { can: 540, cup: 245 }, note: 'ready-to-serve chicken rotini soup' },
  ketchup:         { kcal: 101, p: 1.0,  c: 25,   f: 0.1,  g: { cup: 240, tbsp: 17 }, def: { qty: 1, unit: 'tbsp' } },
  mustard:         { kcal: 66,  p: 3.7,  c: 5.8,  f: 3.3,  g: { cup: 249, tbsp: 15 }, def: { qty: 1, unit: 'tbsp' } },
  mayo:            { kcal: 680, p: 1,    c: 0.6,  f: 75,   g: { cup: 220, tbsp: 14 }, def: { qty: 1, unit: 'tbsp' } },
  light_mayo:      { kcal: 233, p: 0.5,  c: 6.7,  f: 23,   g: { cup: 230, tbsp: 15 }, note: '35 kcal per tablespoon' },
  ranch:           { kcal: 430, p: 1.3,  c: 6.6,  f: 45,   g: { cup: 240, tbsp: 15 } },
  light_ranch:     { kcal: 220, p: 1,    c: 10,   f: 19,   g: { cup: 240, tbsp: 15 } },
  bbq_sauce:       { kcal: 172, p: 0.8,  c: 40.8, f: 0.6,  g: { cup: 280, tbsp: 17 } },
  soy_sauce:       { kcal: 53,  p: 8,    c: 4.9,  f: 0.6,  g: { cup: 255, tbsp: 16 }, def: { qty: 1, unit: 'tbsp' } },
  hot_sauce:       { kcal: 11,  p: 0.5,  c: 1.8,  f: 0.4,  g: { cup: 240, tbsp: 15 }, def: { qty: 1, unit: 'tbsp' } },
  gravy_mix:       { kcal: 350, p: 8,    c: 68,   f: 4,    g: { pkg: 25, tbsp: 8 } },
  syrup:           { kcal: 260, p: 0,    c: 65,   f: 0,    g: { cup: 315, tbsp: 20 }, def: { qty: 2, unit: 'tbsp' } },
  honey:           { kcal: 304, p: 0.3,  c: 82,   f: 0,    g: { cup: 339, tbsp: 21 } },
  jam:             { kcal: 278, p: 0.4,  c: 69,   f: 0,    g: { cup: 320, tbsp: 20 } },
  peanut_butter:   { kcal: 588, p: 25,   c: 20,   f: 50,   g: { cup: 258, tbsp: 16 } },
  oil:             { kcal: 884, p: 0,    c: 0,    f: 100,  g: { cup: 218, tbsp: 13.6 }, def: { qty: 1, unit: 'tbsp' } },

  // ---- Baking & sweets ----------------------------------------------------
  sugar:           { kcal: 387, p: 0,    c: 100,  f: 0,    g: { cup: 200, tbsp: 12.5, tsp: 4.2 } },
  brown_sugar:     { kcal: 380, p: 0,    c: 98,   f: 0,    g: { cup: 220, tbsp: 13.8, tsp: 4.6 }, def: { qty: 1, unit: 'tsp' } },
  powdered_sugar:  { kcal: 389, p: 0,    c: 100,  f: 0,    g: { cup: 120, tbsp: 7.5 } },
  cinnamon_sugar:  { kcal: 380, p: 0.2,  c: 98,   f: 0.1,  g: { cup: 200, tbsp: 12.5, tsp: 4.2 }, def: { qty: 1, unit: 'tbsp' } },
  cocoa:           { kcal: 228, p: 19.6, c: 58,   f: 13.7, g: { cup: 86, tbsp: 5.4, tsp: 1.8 } },
  chocolate_chips: { kcal: 480, p: 4.2,  c: 63,   f: 30,   g: { cup: 170, tbsp: 10.6 } },
  cake_mix:        { kcal: 420, p: 4,    c: 80,   f: 9,    g: { box: 432, cup: 120 }, note: 'dry mix' },
  cake_baked:      { kcal: 380, p: 4,    c: 53,   f: 17,   g: { each: 900, cup: 100 }, note: 'one baked 9x13 cake = 900 g' },
  pudding_mix:     { kcal: 370, p: 0,    c: 92,   f: 0.4,  g: { pkg: 96, cup: 150 }, note: 'dry instant pudding mix' },
  pudding_made:    { kcal: 111, p: 2,    c: 19,   f: 3,    g: { each: 140, cup: 240 }, note: 'prepared pudding, 1 serving = 140 g' },
  gelatin_flavored:{ kcal: 380, p: 7,    c: 88,   f: 0,    g: { pkg: 85, each: 85 }, note: 'dry flavored gelatin' },
  gelatin_plain:   { kcal: 335, p: 85,   c: 0,    f: 0,    g: { pkg: 7, each: 7 }, note: 'unflavored gelatin packet' },
  cocoa_mix:       { kcal: 400, p: 6,    c: 78,   f: 8,    g: { pkg: 28, each: 28 } },
  baking_powder:   { kcal: 53,  p: 0,    c: 28,   f: 0,    g: { tsp: 4.6, tbsp: 13.8 } },

  // ---- Supplements & drinks ----------------------------------------------
  whey:            { kcal: 400, p: 80,   c: 8,    f: 5,    g: { each: 32, scoop: 32, cup: 120, tbsp: 8 }, note: '1 scoop = 32 g' },
  crio_bru:        { kcal: 2,   p: 0.3,  c: 0.3,  f: 0.1,  g: { cup: 240, oz: 29.6 }, note: 'brewed cacao, essentially calorie-free' },
  water:           { kcal: 0,   p: 0,    c: 0,    f: 0,    g: { cup: 240, oz: 29.6, tbsp: 15, each: 240 } },

  // ---- Free items (seasonings, non-food) ---------------------------------
  free:            { kcal: 0,   p: 0,    c: 0,    f: 0,    g: { cup: 100, tbsp: 6, tsp: 2, each: 1, pkg: 1 }, note: 'seasonings, sweeteners and non-food items' },
  cinnamon:        { kcal: 247, p: 4,    c: 81,   f: 1.2,  g: { cup: 124, tbsp: 7.8, tsp: 2.6 }, def: { qty: 1, unit: 'tsp' } },
};

/*
 * Ingredient name -> food key. Matching is done on the longest alias that the
 * ingredient text starts with or contains, so order in this object does not
 * matter but specificity does: "cream of chicken soup" must exist alongside
 * "chicken" and wins because it is longer.
 */
const ALIASES = {
  // dairy & eggs
  'milk': 'milk', '2% milk': 'milk', 'cold milk': 'milk', 'splash milk': 'milk', 'whole milk': 'milk',
  'dry milk': 'dry_milk', 'dry milk powder': 'dry_milk', 'non-fat dry milk': 'dry_milk', 'nonfat dry milk': 'dry_milk',
  'evaporated milk': 'evaporated_milk',
  'cottage cheese': 'cottage_cheese', 'cottage/cream cheese': 'cottage_cheese',
  'cream cheese': 'cream_cheese',
  'cheddar': 'cheddar', 'cheddar cheese': 'cheddar', 'cheddar slices': 'cheddar', 'cheddar slice': 'cheddar', 'cheese': 'cheddar',
  'sour cream': 'sour_cream',
  'vanilla yogurt': 'vanilla_yogurt', 'yogurt': 'vanilla_yogurt',
  'butter': 'butter', 'melted butter': 'butter', 'spray butter': 'spray_butter',
  'egg': 'egg', 'eggs': 'egg', 'hard-boiled eggs': 'egg', 'hard boiled eggs': 'egg', 'soft-boiled eggs': 'egg',
  'scrambled eggs': 'egg', 'egg whites': 'egg_white', 'egg white': 'egg_white',

  // meat & fish
  'chicken breast': 'chicken_breast', 'chicken breasts': 'chicken_breast',
  'canned chicken': 'chicken_canned', 'chicken': 'chicken_canned',
  'ground beef': 'ground_beef',
  'beef roast': 'beef_roast', 'roast beef': 'roast_beef_deli', 'sliced roast beef': 'roast_beef_deli',
  'stewing beef': 'stewing_beef', 'cooked shredded beef': 'cooked_beef', 'shredded beef': 'cooked_beef',
  'pork roast': 'pork_roast', 'shredded pork roast': 'pork_roast',
  'ham': 'ham', 'sliced ham': 'ham', 'diced ham': 'ham',
  'sausage': 'pork_sausage', 'pork sausage': 'pork_sausage', 'cooked pork sausage': 'pork_sausage',
  'cooked sausage links': 'pork_sausage', 'sausage links': 'pork_sausage',
  'beef franks': 'beef_frank', 'beef frank': 'beef_frank', 'sliced beef franks': 'beef_frank', 'franks': 'beef_frank',
  'tuna': 'tuna',

  // beans
  'black beans': 'black_beans', 'pinto beans': 'pinto_beans',
  'great northern beans': 'white_beans', 'white beans': 'white_beans',
  'refried beans': 'refried_beans', 'pork and beans': 'pork_and_beans',

  // grains
  'oats': 'oats', 'rolled oats': 'oats', 'oat flour': 'oat_flour',
  'flour': 'flour',
  'rice': 'rice_dry', 'cooked rice': 'rice_cooked',
  'pancake mix': 'pancake_mix', 'waffle mix': 'pancake_mix',
  'macaroni': 'pasta', 'ribbon pasta': 'pasta', 'spaghetti': 'pasta', 'pasta': 'pasta', 'rotini': 'pasta',
  'bread': 'bread', 'bread slices': 'bread', 'bread slice': 'bread', 'slices bread': 'bread',
  'wheat bread': 'wheat_bread',
  'tortillas': 'tortilla', 'tortilla': 'tortilla', 'small tortillas': 'tortilla_small',
  'buns': 'bun', 'hamburger buns': 'bun', 'hot dog buns': 'bun', 'slider buns': 'slider_bun',
  'breadcrumbs': 'breadcrumbs',
  "honey nut o's": 'cereal_o', 'honey nut os': 'cereal_o', 'cereal': 'cereal_o',
  'biscuit dough': 'biscuit_dough',

  // potatoes
  'potatoes': 'potato', 'potato': 'potato', 'cubed potatoes': 'potato', 'diced potatoes': 'potato',
  'grated potatoes': 'potato', 'grated potato': 'potato', 'russet potatoes': 'potato',
  'baked potatoes': 'potato', 'fried cubed potatoes': 'potato',
  'instant potatoes': 'instant_potato', 'mashed potatoes': 'mashed_potato',

  // vegetables
  'carrots': 'carrot', 'carrot': 'carrot', 'chopped carrots': 'carrot',
  'green beans': 'green_beans', 'corn': 'corn', 'broccoli': 'broccoli', 'cooked broccoli': 'broccoli',
  'lettuce': 'lettuce', 'chopped lettuce': 'lettuce', 'shredded lettuce': 'lettuce',
  'lettuce leaves': 'lettuce', 'head lettuce': 'lettuce',
  'onion': 'onion', 'onions': 'onion',
  'tomato': 'tomato', 'tomatoes': 'tomato', 'diced tomatoes': 'tomato_canned',
  'bell pepper': 'bell_pepper', 'bell peppers': 'bell_pepper',
  'cucumber': 'cucumber', 'cucumbers': 'cucumber', 'diced cucumber': 'cucumber', 'diced cucumbers': 'cucumber',
  'cucumber spears': 'cucumber', 'fresh cucumber slices': 'cucumber',
  'garlic': 'garlic',

  // fruit
  'apple': 'apple', 'apples': 'apple', 'diced apple': 'apple', 'sliced apple': 'apple', 'fresh apples': 'apple',
  'banana': 'banana', 'bananas': 'banana', 'sliced banana': 'banana', 'mashed banana': 'banana',
  'mashed bananas': 'banana', 'frozen banana': 'banana', 'ripe bananas': 'banana',
  'orange': 'orange', 'oranges': 'orange', 'fresh orange': 'orange',
  'grapes': 'grapes', 'fresh grapes': 'grapes',
  'peaches': 'peaches_canned', 'pears': 'pears_canned',
  'applesauce': 'applesauce', 'raisins': 'raisins',
  'fresh fruit': 'fruit_generic', 'frozen fruit': 'fruit_generic', 'crushed fruit': 'fruit_generic',
  'fruit': 'fruit_generic', 'fresh grapes/fruit': 'grapes',

  // sauces & condiments
  'salsa': 'salsa', 'tomato sauce': 'tomato_sauce', 'spaghetti sauce': 'spaghetti_sauce',
  'tomato soup': 'tomato_soup',
  'cream of chicken': 'cream_soup_chx', 'cream of chicken soup': 'cream_soup_chx',
  'cream of mushroom': 'cream_soup_mush', 'cream of mushroom soup': 'cream_soup_mush',
  'chicken rotini soup': 'soup_rts',
  'ketchup': 'ketchup',
  'mustard': 'mustard', 'yellow mustard': 'mustard', 'mustard/salsa': 'mustard',
  'mayo': 'mayo', 'light mayo': 'light_mayo', 'pb': 'peanut_butter', 'peanut butter': 'peanut_butter',
  'ranch dressing': 'ranch', 'ranch': 'ranch', 'light ranch': 'light_ranch',
  'bbq sauce': 'bbq_sauce', 'soy sauce': 'soy_sauce', 'hot sauce': 'hot_sauce',
  'brown gravy mix': 'gravy_mix', 'chicken gravy mix': 'gravy_mix', 'beef gravy mix': 'gravy_mix', 'gravy mix': 'gravy_mix',
  'syrup': 'syrup', 'honey': 'honey',
  'jam': 'jam', 'strawberry jam': 'jam', 'raspberry jam': 'jam', 'jelly': 'jam',
  'oil': 'oil',

  // baking & sweets
  'sugar': 'sugar', 'brown sugar': 'brown_sugar', 'powdered sugar': 'powdered_sugar',
  'cinnamon sugar': 'cinnamon_sugar',
  'cocoa': 'cocoa', 'cocoa powder': 'cocoa',
  'chocolate chips': 'chocolate_chips', 'chocolate chips/cake mix': 'chocolate_chips',
  'cake mix': 'cake_mix', 'chocolate cake mix': 'cake_mix', 'yellow cake mix': 'cake_mix',
  'yellow cake': 'cake_baked', 'baked chocolate cake': 'cake_baked', 'chocolate cake': 'cake_baked',
  'pudding mix': 'pudding_mix', 'chocolate pudding mix': 'pudding_mix', 'vanilla pudding mix': 'pudding_mix',
  'vanilla pudding': 'pudding_made', 'chocolate pudding': 'pudding_made',
  'strawberry gelatin': 'gelatin_flavored', 'gelatin': 'gelatin_plain',
  'hot cocoa mix': 'cocoa_mix', 'packets hot cocoa mix': 'cocoa_mix',
  'baking powder': 'baking_powder',

  // supplements & drinks
  'whey': 'whey', 'chocolate whey': 'whey', 'vanilla whey': 'whey', 'whey protein': 'whey',
  'crio bru': 'crio_bru', 'brewed crio bru': 'crio_bru', 'chilled crio bru': 'crio_bru',
  'chilled brewed crio bru': 'crio_bru', 'hot crio bru': 'crio_bru', 'cold crio bru': 'crio_bru',
  'water': 'water', 'hot water': 'water', 'boiling water': 'water', 'ice': 'water',

  // free
  'salt': 'free', 'pepper': 'free', 'black pepper': 'free', 'sea salt': 'free', 'salt/pepper': 'free',
  'paprika': 'free', 'cumin': 'free', 'garlic powder': 'free', 'chili spices': 'free',
  'vanilla': 'free', 'vanilla extract': 'free', 'sweetener': 'free', 'stevia': 'free',
  'lime juice': 'free', 'creatine': 'free',
  'lollipop sticks': 'free', 'wooden sticks': 'free',
  'cinnamon': 'cinnamon',
};

module.exports = { FOODS, ALIASES };
