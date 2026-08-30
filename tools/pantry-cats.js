/*
 * Which shelf each food belongs on.
 *
 * Kept apart from food-db.js on purpose: that file is nutrition, checked
 * against reference figures, and this is shelving — a judgement about where a
 * cook looks for a thing. The two change for different reasons.
 *
 * The categories are the storehouse's own order list, so the pantry a reader
 * opens matches the sheet they order from. Most of these were matched against
 * that list automatically; the ones the matcher could not do, or did wrongly,
 * are set by hand. It matched on any shared word, which put every sauce under
 * canned vegetables, peanut butter under dairy, and egg whites under bread.
 *
 * water and free are deliberately absent. Neither is a thing you keep.
 */

/* What the storehouse does not carry.
 *
 * This used to be worked out rather than written down, and that is how a
 * reader ended up making his own breadcrumbs on a Sunday with no warning from
 * the book. An item counted as stocked unless some recipe had named it in its
 * own `extras` line — so the whole storehouse list was a by-product of whether
 * authors had remembered to annotate, and anything nobody annotated was
 * silently declared available. Breadcrumbs are in two recipes and neither said
 * so, so the app told him everything was on the standard order. The storehouse
 * does not sell breadcrumbs.
 *
 * Four more were wrong the same way, celery salt worst of all: it is an
 * ingredient of the BBQ sauce recipe, which exists precisely so that somebody
 * with only the storehouse order can still make barbecue sauce.
 *
 * Declared now, in one place, next to the shelving — which is the same kind of
 * judgement and gets read by the same person. A declaration can still be
 * wrong, but it is wrong somewhere you can see it. Checked against the
 * storehouse page printed in the book by tests/recipes.test.js.
 */
const NOT_STOCKED = {
  // named on the order sheet nowhere, and used by recipes
  breadcrumbs: 'the storehouse carries bread, not crumbs',
  celery_salt: 'seasonings are cinnamon, black pepper, salt and vanilla',
  spray_butter: 'butter, yes; the spray tin, no',
  bbq_sauce: 'condiments run to ketchup and mustard',
  chocolate_chips: 'cake mixes and cocoa, not chips',
  cocoa: 'hot cocoa mix is stocked; cocoa powder is not',
  cola: 'no soft drinks',
  cornstarch: 'flour is stocked; cornstarch is not',
  crio_bru: 'a roasted cacao brew, bought outside',
  garlic: 'fresh produce, but not garlic',
  gravy_mix: 'no packet gravies',
  hot_sauce: 'no hot sauce',
  light_mayo: 'plain mayo is stocked; the light one is not',
  light_ranch: 'plain ranch is stocked; the light one is not',
  parmesan: 'the storehouse cheese is cheddar',
  salsa_verde: 'red salsa only',
  soy_sauce: 'no soy sauce',
  whey: 'the storehouse protein is non-fat dry milk',
  // stocked nowhere and used by nothing, but wrong is wrong
  cream_cheese: 'the dairy list stops at sour cream',
  biscuit_dough: 'nothing refrigerated in a tube',
};

const CATS = {
  // Canned meats
  chicken_canned: 'Canned meats',
  cooked_beef: 'Canned meats',
  pork_and_beans: 'Canned meats',
  tuna: 'Canned meats',

  // Canned soups
  cream_soup_chx: 'Canned soups',
  cream_soup_mush: 'Canned soups',
  soup_rts: 'Canned soups',
  tomato_canned: 'Canned soups',
  tomato_sauce: 'Canned soups',
  tomato_soup: 'Canned soups',

  // Canned fruit
  applesauce: 'Canned fruit',
  peaches_canned: 'Canned fruit',
  pears_canned: 'Canned fruit',

  // Canned veg
  corn: 'Canned veg',
  green_beans: 'Canned veg',
  spaghetti_sauce: 'Canned veg',

  // Beans, rice, potatoes
  black_beans: 'Beans, rice, potatoes',
  instant_potato: 'Beans, rice, potatoes',
  pinto_beans: 'Beans, rice, potatoes',
  refried_beans: 'Beans, rice, potatoes',
  rice_cooked: 'Beans, rice, potatoes',
  rice_dry: 'Beans, rice, potatoes',
  white_beans: 'Beans, rice, potatoes',

  // Meat
  beef_frank: 'Meat',
  beef_roast: 'Meat',
  chicken_breast: 'Meat',
  ground_beef: 'Meat',
  ham: 'Meat',
  pork_roast: 'Meat',
  pork_sausage: 'Meat',
  roast_beef_deli: 'Meat',
  stewing_beef: 'Meat',

  // Dairy and eggs
  butter: 'Dairy and eggs',
  cheddar: 'Dairy and eggs',
  parmesan: 'Dairy and eggs',
  cottage_cheese: 'Dairy and eggs',
  cream_cheese: 'Dairy and eggs',
  egg: 'Dairy and eggs',
  egg_white: 'Dairy and eggs',
  milk: 'Dairy and eggs',
  sour_cream: 'Dairy and eggs',
  spray_butter: 'Dairy and eggs',
  vanilla_yogurt: 'Dairy and eggs',

  // Fresh
  apple: 'Fresh',
  banana: 'Fresh',
  bell_pepper: 'Fresh',
  broccoli: 'Fresh',
  carrot: 'Fresh',
  cucumber: 'Fresh',
  fruit_generic: 'Fresh',
  garlic: 'Fresh',
  grapes: 'Fresh',
  lettuce: 'Fresh',
  mashed_potato: 'Fresh',
  onion: 'Fresh',
  orange: 'Fresh',
  potato: 'Fresh',
  tomato: 'Fresh',

  // Flour and pasta
  flour: 'Flour and pasta',
  oat_flour: 'Flour and pasta',
  pancake_mix: 'Flour and pasta',
  pasta: 'Flour and pasta',

  // Cereal
  cereal_o: 'Cereal',
  oats: 'Cereal',

  // Baking
  baking_powder: 'Baking',
  baking_soda: 'Baking',
  biscuit_dough: 'Baking',
  chocolate_chips: 'Baking',
  cocoa: 'Baking',
  cornstarch: 'Baking',
  evaporated_milk: 'Baking',
  oil: 'Baking',
  raisins: 'Baking',
  yeast: 'Baking',

  // Sugars
  brown_sugar: 'Sugars',
  powdered_sugar: 'Sugars',
  sugar: 'Sugars',

  // Seasonings
  celery_salt: 'Seasonings',
  cinnamon: 'Seasonings',
  cinnamon_sugar: 'Seasonings',
  salt: 'Seasonings',

  // Condiments
  bbq_sauce: 'Condiments',
  gravy_mix: 'Condiments',
  honey: 'Condiments',
  hot_sauce: 'Condiments',
  jam: 'Condiments',
  ketchup: 'Condiments',
  light_mayo: 'Condiments',
  light_ranch: 'Condiments',
  mayo: 'Condiments',
  mustard: 'Condiments',
  peanut_butter: 'Condiments',
  ranch: 'Condiments',
  salsa: 'Condiments',
  salsa_verde: 'Condiments',
  soy_sauce: 'Condiments',
  syrup: 'Condiments',

  // Drinks and desserts
  cake_baked: 'Drinks and desserts',
  cake_mix: 'Drinks and desserts',
  cocoa_mix: 'Drinks and desserts',
  cola: 'Drinks and desserts',
  crio_bru: 'Drinks and desserts',
  dry_milk: 'Drinks and desserts',
  gelatin_flavored: 'Drinks and desserts',
  gelatin_plain: 'Drinks and desserts',
  pudding_made: 'Drinks and desserts',
  pudding_mix: 'Drinks and desserts',
  whey: 'Drinks and desserts',

  // Bread
  bread: 'Bread',
  breadcrumbs: 'Bread',
  bun: 'Bread',
  slider_bun: 'Bread',
  tortilla: 'Bread',
  tortilla_small: 'Bread',
  wheat_bread: 'Bread',
};

module.exports = { CATS: CATS, NOT_STOCKED: NOT_STOCKED };
