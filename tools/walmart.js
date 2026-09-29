/*
 * The Walmart product each food is bought as, for the shopping list's
 * "Add to Walmart cart".
 *
 * [item number, grams in one pack, what the pack is]. The item number is the
 * one in the product's walmart.com address; the cart link is
 * walmart.com/sc/cart/addToCart?items=ID_QTY,ID_QTY (the link MacroRx used),
 * and the number of packs is the grams the week needs over the grams in one,
 * rounded up. Picked 2026-09-29 from walmart.com grocery search, store brand
 * where there is one. Meat sold by weight and produce sold each carry a
 * typical pack; the cart shows the real price.
 *
 * A food not here gets a Walmart grocery search instead, and a household can
 * paste the right item number in the app; that one wins.
 */
module.exports = {
  // meat
  chicken_breast: ['10414680', 1361, 'Great Value boneless skinless chicken breasts, 3 lb (frozen)'],
  ground_beef: ['15136791', 454, '80/20 ground beef, 1 lb roll'],
  stewing_beef: ['39944478', 454, 'Lean beef stew meat, about 1 lb'],
  beef_roast: ['55446514', 1060, 'Beef chuck roast, 2 to 2.7 lb'],
  pork_roast: ['737451680', 1134, 'Smithfield boneless pork shoulder roast'],
  pork_sausage: ['46575468', 454, 'Great Value pork sausage roll, 1 lb'],
  ham: ['19276135', 454, 'Land O’Frost sliced ham, 1 lb'],
  beef_frank: ['51258923', 340, 'Bar-S beef franks, 8 count'],
  chicken_canned: ['39098615', 354, 'Great Value chunk chicken breast, 12.5 oz can'],
  tuna: ['33867594', 142, 'Great Value chunk light tuna, 5 oz can'],
  // dairy & eggs
  cheddar: ['10452370', 227, 'Great Value shredded mild cheddar, 8 oz'],
  butter: ['26954458', 454, 'Great Value salted butter, 4 sticks'],
  milk: ['10450115', 3900, 'Great Value 2% milk, gallon'],
  sour_cream: ['12335111', 454, 'Great Value sour cream, 16 oz'],
  cottage_cheese: ['10315022', 454, 'Great Value small curd cottage cheese, 16 oz'],
  egg: ['103020312', 600, 'Great Value large white eggs, 12 count'],
  evaporated_milk: ['10534163', 354, 'Great Value evaporated milk, 12 oz can'],
  // produce
  onion: ['10447842', 1361, 'Yellow onions, 3 lb bag'],
  potato: ['10447839', 2268, 'Russet potatoes, 5 lb bag'],
  carrot: ['10535757', 907, 'Whole carrots, 2 lb bag'],
  bell_pepper: ['44390945', 160, 'Green bell pepper, each'],
  broccoli: ['51259378', 340, 'Broccoli crown, each'],
  tomato: ['44390944', 62, 'Roma tomato, each'],
  lettuce: ['10402650', 600, 'Iceberg lettuce, each'],
  cucumber: ['44390954', 300, 'Cucumber, each'],
  garlic: ['44391100', 50, 'Garlic bulb, each'],
  lime: ['44391008', 67, 'Lime, each'],
  cilantro: ['160597260', 70, 'Cilantro, 1 bunch'],
  avocado: ['44390949', 170, 'Hass avocado, each'],
  jalapeno: ['44391018', 14, 'Jalapeño, each'],
  // cans & jars
  green_beans: ['10448318', 411, 'Great Value cut green beans, 14.5 oz can'],
  corn: ['10315427', 432, 'Great Value whole kernel corn, 15.25 oz can'],
  black_beans: ['10534038', 425, 'Great Value black beans, 15 oz can'],
  white_beans: ['10534042', 439, 'Great Value great northern beans, 15.5 oz can'],
  tomato_sauce: ['10415500', 425, 'Great Value tomato sauce, 15 oz can'],
  tomato_canned: ['15544054', 411, 'Great Value fire roasted diced tomatoes, 14.5 oz can'],
  spaghetti_sauce: ['19758051', 680, 'Great Value traditional pasta sauce, 24 oz'],
  cream_soup_chx: ['10314959', 298, 'Great Value cream of chicken soup, 10.5 oz'],
  cream_soup_mush: ['10314960', 298, 'Great Value cream of mushroom soup, 10.5 oz'],
  salsa: ['3562572626', 680, 'Great Value thick and chunky salsa, medium'],
  applesauce: ['14562669', 1361, 'Great Value applesauce, 48 oz jar'],
  peaches_canned: ['51091576', 432, 'Great Value sliced peaches, 15.25 oz can'],
  pickles: ['548915008', 680, 'Great Value kosher dill spears'],
  pepperoncini: ['185310896', 340, 'Great Value whole pepperoncini, 12 oz'],
  enchilada_sauce: ['10313183', 283, 'Old El Paso mild red enchilada sauce, 10 oz'],
  // grains, bread & baking
  pasta: ['10534115', 454, 'Great Value spaghetti, 16 oz'],
  rice_dry: ['10315394', 907, 'Great Value long grain rice, 32 oz'],
  flour: ['10403017', 2268, 'Great Value all-purpose flour'],
  tortilla: ['339860540', 567, 'Great Value burrito flour tortillas, 20 oz'],
  tortilla_small: ['953466267', 400, 'Great Value soft taco flour tortillas'],
  corn_tortilla: ['361076448', 750, 'Great Value white corn tortillas, 30 count'],
  bun: ['10450104', 312, 'Great Value hamburger buns, 8 count'],
  breadcrumbs: ['10315089', 425, 'Great Value plain bread crumbs, 15 oz'],
  instant_potato: ['22734174', 757, 'Great Value instant mashed potatoes, 26.7 oz'],
  pancake_mix: ['10314920', 907, 'Great Value complete pancake & waffle mix'],
  baking_powder: ['16627955', 230, 'Great Value baking powder, 8.1 oz'],
  yeast: ['13448681', 21, 'Fleischmann’s active dry yeast, 3 pack'],
  sugar: ['10315162', 1814, 'Great Value granulated sugar, 4 lb'],
  powdered_sugar: ['10315011', 907, 'Great Value powdered sugar, 2 lb'],
  honey: ['20647992', 340, 'Great Value honey, 12 oz bear'],
  vanilla: ['10314950', 59, 'Great Value pure vanilla extract, 2 fl oz'],
  // condiments, sauces, mixes
  oil: ['10451002', 1360, 'Great Value vegetable oil, 48 oz'],
  salt: ['10448316', 737, 'Great Value iodized salt, 26 oz'],
  mustard: ['43711099', 567, 'Great Value yellow mustard, 20 oz'],
  ketchup: ['172196409', 907, 'Great Value ketchup, 32 oz'],
  soy_sauce: ['10315653', 443, 'Great Value soy sauce, 15 oz'],
  bbq_sauce: ['593927194', 510, 'Great Value original BBQ sauce, 18 oz'],
  hot_sauce: ['14089344', 354, 'Frank’s RedHot original'],
  ranch: ['16618888', 473, 'Great Value ranch dressing, 16 oz'],
  light_ranch: ['10413982', 473, 'Hidden Valley light ranch'],
  worcestershire: ['12157940', 296, 'Great Value Worcestershire sauce, 10 oz'],
  taco_seasoning: ['379517847', 28, 'Great Value taco seasoning, 1 oz'],
  gravy_mix: ['10314968', 25, 'Great Value brown gravy mix, 0.87 oz'],
  guacamole: ['930622688', 227, 'Wholly Guacamole classic'],
  pico_de_gallo: ['387591794', 283, 'Freshness Guaranteed pico de gallo, 10 oz'],
};

/* Foods the book makes rather than buys, bought as what they are made from:
   [the food bought, grams bought per gram made]. Cooked rice is about a third
   dry rice by weight; the rest are the raw cut. */
module.exports.AS = {
  rice_cooked: ['rice_dry', 0.35],
  cilantro_lime_rice: ['rice_dry', 0.35],
  mashed_potato: ['potato', 1],
  sweet_pork: ['pork_roast', 1],
  carne_asada: ['flank_steak', 1],
  pickle_juice: ['pickles', 0],
};
