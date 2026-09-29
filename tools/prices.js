/*
 * What a food typically costs, in US dollars per 100 g, at a Walmart in 2026.
 *
 * Plan My Week uses these to keep a week of dinners under a budget and to put
 * a rough total on its shopping list. They are estimates, written once from
 * ordinary shelf prices (a 5 lb bag of potatoes, a family pack of chicken,
 * store-brand cans) rather than looked up live: Blake chose to keep the app
 * self-contained. A household can correct any of them in the app, and the
 * correction wins.
 *
 * Dried spices are not here: they count as already in the cupboard (see
 * DRIED_SPICE in build-data.js). A food missing from this table is simply not
 * counted, and the total says "about".
 */
module.exports = {
  // meat
  chicken_breast: 0.66, ground_beef: 1.21, ground_beef_lean: 1.43, stewing_beef: 1.30, beef_roast: 1.15,
  pork_roast: 0.55, pork_sausage: 0.90, ham: 0.90, beef_frank: 0.70, flank_steak: 1.90,
  carne_asada: 2.40, sweet_pork: 0.80, chicken_canned: 1.05, tuna: 0.95,
  // dairy & eggs
  cheddar: 1.05, butter: 1.10, milk: 0.10, sour_cream: 0.45, cottage_cheese: 0.55, egg: 0.55,
  evaporated_milk: 0.35,
  // produce
  onion: 0.26, potato: 0.20, carrot: 0.33, bell_pepper: 0.65, broccoli: 0.40, tomato: 0.45,
  lettuce: 0.45, cucumber: 0.35, garlic: 1.00, lime: 0.37, cilantro: 1.50, avocado: 0.49,
  jalapeno: 0.45,
  // cans & jars
  green_beans: 0.25, corn: 0.25, black_beans: 0.22, pinto_beans: 0.22, white_beans: 0.25,
  tomato_sauce: 0.18, tomato_canned: 0.20, spaghetti_sauce: 0.29, cream_soup_chx: 0.40,
  cream_soup_mush: 0.40, salsa: 0.44, applesauce: 0.40, peaches_canned: 0.30, pickles: 0.45,
  pepperoncini: 0.80, enchilada_sauce: 0.35, pickle_juice: 0.10,
  // grains, bread & baking
  pasta: 0.26, rice_dry: 0.18, rice_cooked: 0.08, flour: 0.10, tortilla: 0.55, tortilla_small: 0.55,
  corn_tortilla: 0.40, bun: 0.35, breadcrumbs: 0.60, instant_potato: 1.10, mashed_potato: 0.25,
  pancake_mix: 0.35, baking_powder: 1.00, yeast: 3.00, sugar: 0.14, brown_sugar: 0.30,
  powdered_sugar: 0.35, honey: 1.00, vanilla: 8.00, cilantro_lime_rice: 0.15,
  // condiments, sauces, mixes
  oil: 0.30, salt: 0.10, mustard: 0.40, ketchup: 0.30, soy_sauce: 0.50, bbq_sauce: 0.35,
  hot_sauce: 0.60, ranch: 0.60, light_ranch: 0.60, tomatillo_ranch: 0.65, worcestershire: 0.90,
  taco_seasoning: 3.00, gravy_mix: 3.00, guacamole: 1.00, pico_de_gallo: 0.45,
};
