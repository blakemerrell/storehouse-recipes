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

module.exports = {
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
