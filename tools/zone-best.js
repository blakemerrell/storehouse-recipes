/*
 * The foods worth eating that the storehouse does not stock.
 *
 * Source: the Zone food-block table Blake supplied — Food / Category / Block
 * (Carbohydrate, Protein, Fat) / reference portion / Rating (Best, Fair,
 * Poor). Only the Best-rated rows are here, and only the ones the app did not
 * already know: 123 rows rated Best, of which food-db.js already carried a
 * little over forty.
 *
 * WHAT THE ZONE TABLE CAN AND CANNOT TELL US.
 *
 * A Zone block fixes exactly ONE macro per food — a carbohydrate block is 9 g
 * of carbohydrate, a protein block 7 g of protein, a fat block 1.5 g of fat —
 * and says nothing whatever about the other two. "Salmon, 1½ oz" means 7 g of
 * protein; the fat, which is the entire reason to eat salmon, is absent. So
 * the table is a CURATION and not a nutrition source. It says what is worth
 * eating and roughly what a portion looks like. The numbers come from the
 * USDA, the same place every other figure in food-db.js came from.
 *
 * `q` is the FoodData Central query, written in the shape SR Legacy actually
 * describes things ("Fish, salmon, Atlantic, wild, raw") rather than the shape
 * a person would say it, because the search is loose and a bare "salmon"
 * returns a dozen preparations of which one is the one meant.
 *
 * `block` is the Zone column, kept because it is the macro axis the picker's
 * shelf rail wants and it is somebody's considered judgement rather than
 * something derived from the numbers. `cat` is the Zone category, kept for the
 * same reason — it is the finer shelf.
 *
 * `raw` records the form the query asks for. It matters: the storehouse table
 * counts meat raw because the recipes state it raw, and mixing raw and cooked
 * weights in one table is how a portion silently doubles.
 */

const WANTED = [
  // ---- Fish and seafood. Entirely absent from the storehouse table, and the
  // leanest protein on the list — which is what a cut is short of.
  { key: 'salmon',        q: 'Fish, salmon, Atlantic, wild, raw',        block: 'Protein', cat: 'Fish and Seafood', raw: 1, label: 'Salmon' },
  { key: 'cod',           q: 'Fish, cod, Atlantic, raw',                 block: 'Protein', cat: 'Fish and Seafood', raw: 1, label: 'Cod' },
  { key: 'halibut',       q: 'Fish, halibut, Atlantic and Pacific, raw', block: 'Protein', cat: 'Fish and Seafood', raw: 1, label: 'Halibut' },
  { key: 'tilapia',       q: 'Fish, tilapia, raw',                       block: 'Protein', cat: 'Fish and Seafood', raw: 1, label: 'Tilapia' },
  { key: 'tuna_steak',    q: 'Fish, tuna, yellowfin, fresh, raw',        block: 'Protein', cat: 'Fish and Seafood', raw: 1, label: 'Tuna steak' },
  { key: 'trout',         q: 'Fish, trout, rainbow, farmed, raw',        block: 'Protein', cat: 'Fish and Seafood', raw: 1, label: 'Trout' },
  { key: 'haddock',       q: 'Fish, haddock, raw',                       block: 'Protein', cat: 'Fish and Seafood', raw: 1, label: 'Haddock' },
  { key: 'snapper',       q: 'Fish, snapper, mixed species, raw',        block: 'Protein', cat: 'Fish and Seafood', raw: 1, label: 'Snapper' },
  { key: 'mackerel',      q: 'Fish, mackerel, Atlantic, raw',            block: 'Protein', cat: 'Fish and Seafood', raw: 1, label: 'Mackerel' },
  { key: 'catfish',       q: 'Fish, catfish, channel, farmed, raw',      block: 'Protein', cat: 'Fish and Seafood', raw: 1, label: 'Catfish' },
  { key: 'sardines',      q: 'Fish, sardine, Atlantic, canned in oil, drained solids with bone', block: 'Protein', cat: 'Fish and Seafood', label: 'Sardines' },
  { key: 'shrimp',        q: 'Crustaceans, shrimp, mixed species, raw',  block: 'Protein', cat: 'Fish and Seafood', raw: 1, label: 'Shrimp' },
  { key: 'crab',          q: 'Crustaceans, crab, blue, raw',             block: 'Protein', cat: 'Fish and Seafood', raw: 1, label: 'Crab meat' },
  { key: 'lobster',       q: 'Crustaceans, lobster, northern, raw',      block: 'Protein', cat: 'Fish and Seafood', raw: 1, label: 'Lobster' },
  { key: 'scallops',      q: 'Mollusks, scallop, mixed species, raw',    block: 'Protein', cat: 'Fish and Seafood', raw: 1, label: 'Scallops' },
  { key: 'clams',         q: 'Mollusks, clam, mixed species, raw',       block: 'Protein', cat: 'Fish and Seafood', raw: 1, label: 'Clams' },
  { key: 'calamari',      q: 'Mollusks, squid, mixed species, raw',      block: 'Protein', cat: 'Fish and Seafood', raw: 1, label: 'Calamari' },

  // ---- Meat and poultry the storehouse does not carry.
  { key: 'turkey_breast',   q: 'Turkey, breast, meat only, raw',            block: 'Protein', cat: 'Meat and Poultry', raw: 1, label: 'Turkey breast' },
  { key: 'turkey_deli',     q: 'Turkey breast, low salt, prepackaged or deli', block: 'Protein', cat: 'Meat and Poultry', label: 'Sliced turkey breast' },
  { key: 'turkey_ground',   q: 'Turkey, ground, 93% lean, 7% fat, raw',     block: 'Protein', cat: 'Meat and Poultry', raw: 1, label: 'Ground turkey' },
  { key: 'turkey_bacon',    q: 'Turkey bacon, cooked',                      block: 'Protein', cat: 'Meat and Poultry', label: 'Turkey bacon' },
  { key: 'canadian_bacon',  q: 'Canadian bacon, cooked',                    block: 'Protein', cat: 'Meat and Poultry', label: 'Canadian bacon' },
  { key: 'ground_beef_lean', q: 'Beef, ground, 93% lean meat, 7% fat, raw', block: 'Protein', cat: 'Meat and Poultry', raw: 1, label: 'Lean ground beef' },

  // ---- Protein-rich dairy and eggs.
  { key: 'greek_yogurt',  q: 'Yogurt, Greek, plain, lowfat',              block: 'Protein', cat: 'Protein-Rich Dairy', label: 'Greek yogurt' },
  { key: 'plain_yogurt',  q: 'Yogurt, plain, low fat',                    block: 'Protein', cat: 'Protein-Rich Dairy', label: 'Plain yogurt' },
  { key: 'egg_sub',       q: 'Egg substitute, liquid',                     block: 'Protein', cat: 'Eggs', label: 'Egg substitute' },

  // ---- Oils, nuts and spreads. The Oils shelf holds exactly one food today.
  { key: 'olive_oil',     q: 'Oil, olive, salad or cooking',              block: 'Fat', cat: 'Oils, Nuts, and Spreads', label: 'Olive oil' },
  { key: 'almonds',       q: 'Nuts, almonds',                              block: 'Fat', cat: 'Oils, Nuts, and Spreads', label: 'Almonds' },
  { key: 'almond_butter', q: 'Nuts, almond butter, plain, without salt added', block: 'Fat', cat: 'Oils, Nuts, and Spreads', label: 'Almond butter' },
  { key: 'walnuts',       q: 'Nuts, walnuts, english',                     block: 'Fat', cat: 'Oils, Nuts, and Spreads', label: 'Walnuts' },
  { key: 'cashews',       q: 'Nuts, cashew nuts, raw',                     block: 'Fat', cat: 'Oils, Nuts, and Spreads', label: 'Cashews' },
  { key: 'macadamia',     q: 'Nuts, macadamia nuts, raw',                  block: 'Fat', cat: 'Oils, Nuts, and Spreads', label: 'Macadamia nuts' },
  { key: 'peanuts',       q: 'Peanuts, all types, raw',                    block: 'Fat', cat: 'Oils, Nuts, and Spreads', label: 'Peanuts' },
  { key: 'avocado',       q: 'Avocados, raw, all commercial varieties',    block: 'Fat', cat: 'Oils, Nuts, and Spreads', raw: 1, label: 'Avocado' },
  { key: 'olives',        q: 'Olives, ripe, canned (small-extra large)',   block: 'Fat', cat: 'Oils, Nuts, and Spreads', label: 'Olives' },
  { key: 'tahini',        q: 'Seeds, sesame butter, tahini, from roasted and toasted kernels', block: 'Fat', cat: 'Oils, Nuts, and Spreads', label: 'Tahini' },

  // ---- Vegetables. The rail's biggest shelf, and the reason it is currently
  // nine rows deep instead of forty.
  { key: 'asparagus',     q: 'Asparagus, raw',                block: 'Carbohydrate', cat: 'Cooked Vegetables', raw: 1, label: 'Asparagus' },
  { key: 'brussels',      q: 'Brussels sprouts, raw',         block: 'Carbohydrate', cat: 'Cooked Vegetables', raw: 1, label: 'Brussels sprouts' },
  { key: 'cauliflower',   q: 'Cauliflower, raw',              block: 'Carbohydrate', cat: 'Cooked Vegetables', raw: 1, label: 'Cauliflower' },
  { key: 'cabbage',       q: 'Cabbage, raw',                  block: 'Carbohydrate', cat: 'Cooked Vegetables', raw: 1, label: 'Cabbage' },
  { key: 'kale',          q: 'Kale, raw',                     block: 'Carbohydrate', cat: 'Cooked Vegetables', raw: 1, label: 'Kale' },
  { key: 'spinach',       q: 'Spinach, raw',                  block: 'Carbohydrate', cat: 'Raw Vegetables', raw: 1, label: 'Spinach' },
  { key: 'swiss_chard',   q: 'Chard, swiss, raw',             block: 'Carbohydrate', cat: 'Cooked Vegetables', raw: 1, label: 'Swiss chard' },
  { key: 'collards',      q: 'Collards, raw',                 block: 'Carbohydrate', cat: 'Cooked Vegetables', raw: 1, label: 'Collard greens' },
  { key: 'bok_choy',      q: 'Cabbage, chinese (pak-choi), raw', block: 'Carbohydrate', cat: 'Cooked Vegetables', raw: 1, label: 'Bok choy' },
  { key: 'zucchini',      q: 'Squash, summer, zucchini, includes skin, raw', block: 'Carbohydrate', cat: 'Cooked Vegetables', raw: 1, label: 'Zucchini' },
  { key: 'yellow_squash', q: 'Squash, summer, crookneck and straightneck, raw', block: 'Carbohydrate', cat: 'Cooked Vegetables', raw: 1, label: 'Yellow squash' },
  { key: 'spaghetti_squash', q: 'Squash, winter, spaghetti, raw',   block: 'Carbohydrate', cat: 'Cooked Vegetables', raw: 1, label: 'Spaghetti squash' },
  { key: 'eggplant',      q: 'Eggplant, raw',                 block: 'Carbohydrate', cat: 'Cooked Vegetables', raw: 1, label: 'Aubergine' },
  { key: 'mushrooms',     q: 'Mushrooms, white, raw',         block: 'Carbohydrate', cat: 'Cooked Vegetables', raw: 1, label: 'Mushrooms' },
  { key: 'okra',          q: 'Okra, raw',                     block: 'Carbohydrate', cat: 'Cooked Vegetables', raw: 1, label: 'Okra' },
  { key: 'leeks',         q: 'Leeks, (bulb and lower leaf-portion), raw', block: 'Carbohydrate', cat: 'Cooked Vegetables', raw: 1, label: 'Leeks' },
  { key: 'artichoke',     q: 'Artichokes, (globe or french), raw', block: 'Carbohydrate', cat: 'Cooked Vegetables', raw: 1, label: 'Artichokes' },
  { key: 'turnip',        q: 'Turnips, raw',                  block: 'Carbohydrate', cat: 'Cooked Vegetables', raw: 1, label: 'Turnips' },
  { key: 'turnip_greens', q: 'Turnip greens, raw',            block: 'Carbohydrate', cat: 'Cooked Vegetables', raw: 1, label: 'Turnip greens' },
  { key: 'celery',        q: 'Celery, raw',                   block: 'Carbohydrate', cat: 'Raw Vegetables', raw: 1, label: 'Celery' },
  { key: 'radish',        q: 'Radishes, raw',                 block: 'Carbohydrate', cat: 'Raw Vegetables', raw: 1, label: 'Radishes' },
  { key: 'romaine',       q: 'Lettuce, cos or romaine, raw',  block: 'Carbohydrate', cat: 'Raw Vegetables', raw: 1, label: 'Romaine lettuce' },
  { key: 'snow_peas',     q: 'Peas, edible-podded, raw',      block: 'Carbohydrate', cat: 'Raw Vegetables', raw: 1, label: 'Snow peas' },
  { key: 'bean_sprouts',  q: 'Beans, mung, mature seeds, sprouted, raw', block: 'Carbohydrate', cat: 'Raw Vegetables', raw: 1, label: 'Bean sprouts' },
  { key: 'alfalfa',       q: 'Alfalfa seeds, sprouted, raw',  block: 'Carbohydrate', cat: 'Raw Vegetables', raw: 1, label: 'Alfalfa sprouts' },
  { key: 'water_chestnut', q: 'Water chestnuts, chinese, (matai), raw', block: 'Carbohydrate', cat: 'Raw Vegetables', raw: 1, label: 'Water chestnuts' },
  { key: 'bamboo_shoots', q: 'Bamboo shoots, raw',            block: 'Carbohydrate', cat: 'Raw Vegetables', raw: 1, label: 'Bamboo shoots' },
  { key: 'watercress',    q: 'Watercress, raw',               block: 'Carbohydrate', cat: 'Raw Vegetables', raw: 1, label: 'Watercress' },
  { key: 'endive',        q: 'Endive, raw',                   block: 'Carbohydrate', cat: 'Raw Vegetables', raw: 1, label: 'Endive' },
  { key: 'jalapeno',      q: 'Peppers, jalapeno, raw',        block: 'Carbohydrate', cat: 'Raw Vegetables', raw: 1, label: 'Jalapeños' },
  { key: 'sauerkraut',    q: 'Sauerkraut, canned, solids and liquids', block: 'Carbohydrate', cat: 'Cooked Vegetables', label: 'Sauerkraut' },
  { key: 'hummus',        q: 'Hummus, commercial',            block: 'Carbohydrate', cat: 'Raw Vegetables', label: 'Hummus' },
  { key: 'chickpeas',     q: 'Chickpeas (garbanzo beans, bengal gram), mature seeds, canned', block: 'Carbohydrate', cat: 'Cooked Vegetables', label: 'Chickpeas' },
  { key: 'kidney_beans',  q: 'Beans, kidney, red, mature seeds, canned', block: 'Carbohydrate', cat: 'Cooked Vegetables', label: 'Kidney beans' },
  { key: 'lentils',       q: 'Lentils, mature seeds, cooked, boiled, without salt', block: 'Carbohydrate', cat: 'Cooked Vegetables', label: 'Lentils' },

  // ---- Fruit.
  { key: 'blueberries',   q: 'Blueberries, raw',              block: 'Carbohydrate', cat: 'Fruits', raw: 1, label: 'Blueberries' },
  { key: 'strawberries',  q: 'Strawberries, raw',             block: 'Carbohydrate', cat: 'Fruits', raw: 1, label: 'Strawberries' },
  { key: 'raspberries',   q: 'Raspberries, raw',              block: 'Carbohydrate', cat: 'Fruits', raw: 1, label: 'Raspberries' },
  { key: 'blackberries',  q: 'Blackberries, raw',             block: 'Carbohydrate', cat: 'Fruits', raw: 1, label: 'Blackberries' },
  { key: 'cherries',      q: 'Cherries, sweet, raw',          block: 'Carbohydrate', cat: 'Fruits', raw: 1, label: 'Cherries' },
  { key: 'apricots',      q: 'Apricots, raw',                 block: 'Carbohydrate', cat: 'Fruits', raw: 1, label: 'Apricots' },
  { key: 'peach',         q: 'Peaches, raw',                  block: 'Carbohydrate', cat: 'Fruits', raw: 1, label: 'Peaches' },
  { key: 'pear',          q: 'Pears, raw',                    block: 'Carbohydrate', cat: 'Fruits', raw: 1, label: 'Pears' },
  { key: 'plum',          q: 'Plums, raw',                    block: 'Carbohydrate', cat: 'Fruits', raw: 1, label: 'Plums' },
  { key: 'nectarine',     q: 'Nectarines, raw',               block: 'Carbohydrate', cat: 'Fruits', raw: 1, label: 'Nectarines' },
  { key: 'kiwi',          q: 'Kiwifruit, green, raw',         block: 'Carbohydrate', cat: 'Fruits', raw: 1, label: 'Kiwi' },
  { key: 'grapefruit',    q: 'Grapefruit, raw, pink and red and white, all areas', block: 'Carbohydrate', cat: 'Fruits', raw: 1, label: 'Grapefruit' },
  { key: 'tangerine',     q: 'Tangerines, (mandarin oranges), raw', block: 'Carbohydrate', cat: 'Fruits', raw: 1, label: 'Tangerines' },

  // ---- Grains the table rates Best. Both are already close cousins of things
  // the storehouse stocks, so they are here only because the Zone list
  // distinguishes them.
  { key: 'barley',        q: 'Barley, pearled, raw',          block: 'Carbohydrate', cat: 'Grains', label: 'Pearl barley' },
];

module.exports = { WANTED: WANTED };
