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
 *
 * The last group is not a correction at all. Ten recipes call for a bottle of
 * barbecue sauce or a packet of gravy mix, neither of which the storehouse
 * carries and both of which it has every part of. Recipes 264 and 265 are those
 * two, and these entries are the cross-reference from the recipes that want
 * them. Nine of the ten are here; the tenth is No. 247, which was written for
 * this collection rather than carried over, so it is edited in place instead.
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
      'Brown the beef and drain it. Drain the vegetables, stir them in, and make up the gravy as the packet says. No packet? {r:265}, browned dark and made with a cup of water, does the same job.',
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
      '2 cups pancake mix', '1 can corn', '2 eggs', '1 cup milk', '1 tbsp butter'],
    steps: [
      'Simmer the beef, beans and tomato sauce 30 minutes.',
      'Heat the oven to 400°F with a 9-inch oven-safe skillet inside it and the butter in the skillet. Meanwhile whisk the pancake mix with the eggs and milk into a thick batter — closer to muffin batter than pancake batter — and fold in the drained corn.',
      'Pour the batter into the hot skillet. It should hiss. That is where the crust on a skillet bread comes from, and a cold pan will not give you one. Bake 20 to 25 minutes, until the top is golden and a knife in the middle comes out clean. No oven-safe skillet? A buttered cake pan works — you lose the crust, not the bread.',
      'Serve the chili topped with the cheddar, with the bread cut into wedges alongside. It is not cornbread, since there is no cornmeal in pancake mix, but with a can of corn through it it does the same job beside a bowl of chili.',
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

  /* ---- pointers to Made, Not Bought ------------------------------------
   * Barbecue sauce and gravy mix are the two ingredients that block the most
   * recipes on their own — five each — and both are makeable from the order
   * list. Recipes 264 and 265 do that. These ten are where a person finds out.
   *
   * The gravy ones are not all the same sentence, because a packet is used four
   * different ways across them: whisked into water and poured over a roast,
   * made separately alongside, used as the braising liquid, and cooked in with
   * the meat. Only the first has an obvious drop-in replacement. The others get
   * told to cook in plain water and make the gravy from what is in the pot at
   * the end, which is what the packet was standing in for anyway.
   */
  { id: 59, step: 0, add: 'No bottle in the house? {r:264} makes barbecue sauce from the storehouse shelf.' },
  { id: 143, step: 1, add: 'No bottle in the house? {r:264} makes barbecue sauce from the storehouse shelf.' },
  { id: 162, step: 0, add: 'No bottle in the house? {r:264} makes barbecue sauce from the storehouse shelf.' },
  { id: 181, step: 0, add: 'No bottle in the house? {r:264} makes barbecue sauce from the storehouse shelf.' },
  { id: 176, step: 2, add: 'No packet? Pour a cup of plain water over instead, and make {r:265} at the end from the liquid in the cooker.' },
  { id: 182, step: 1, add: 'No packet? {r:265}, stopped while the flour is still blond, is the pale gravy this wants. Use the juices from the roasting tin.' },
  { id: 187, step: 0, add: 'No packet? Simmer the beef and onions in 2 cups of plain water instead, and turn that liquid into gravy at the end with {r:265}.' },
  { id: 195, step: 1, add: 'No packet? Put a cup of water in with them instead and make {r:265} from what is in the cooker at the end.' },

  /* ---- ingredients that were bought and never used ---------------------
   *
   * Found by a reader cooking the meatball feast, who got to the end with a
   * can of green beans still on the counter. The ingredient list asked for it,
   * the method never mentioned it, and there was nothing on the page to say
   * whether it had been forgotten or whether he had missed a line.
   *
   * A sweep of all two hundred and seventy-one turned up five like it — every
   * ingredient line checked against every word of its own method, allowing for
   * the ones covered collectively ("mix ingredients", "make 4 PB&J
   * sandwiches") and for seasoning nobody narrates. Five is not many, and each
   * one costs somebody a tin or a stick of butter and a minute of standing
   * there wondering.
   *
   * Each is given the shortest instruction that makes the list true. Nothing
   * is added to the ingredients and nothing is taken away, so the macros, the
   * score and the shopping list are all untouched — these were already being
   * counted. They just were not being cooked. */
  { id: 106, step: 1, add: 'Butter the dish first — that is what the two tablespoons are for, and a bake this eggy will weld itself to a dry one.' },
  { id: 177, step: 1, add: 'Heat the green beans through in their own liquid while the noodles boil, then drain them.' },
  { id: 178, step: 2, add: 'Heat the green beans through, drain them, and put them on the table alongside — a plate of nothing but spaghetti is the reason the can is on the list.' },
  { id: 189, step: 1, add: 'Cut the carrots into thick batons and season them alongside the potatoes; they roast in the same time.' },

  /* The rest of the same sweep. Smaller than the five above — a condiment
     nobody was told to put on the table, a seasoning never called for, the
     milk a boxed cake mix needs — but each one is an ingredient somebody
     bought and then had to guess about, which is the same failure at a lower
     price. Two of them are a burrito bar and a taco bar with the salsa left in
     the fridge. */
  { id: 38, step: 2, add: 'Season each one with salt and pepper before it goes in.' },
  { id: 52, step: 3, add: 'Mustard or salsa on the side; it wants something sharp against the beef and potato.' },
  { id: 53, step: 2, add: 'Chopped tomatoes over the top, added the day you eat it rather than now — they weep if they sit.' },
  { id: 103, step: 2, add: 'Salsa out beside them.' },
  { id: 119, step: 1, add: 'Salt and pepper the egg as it sets.' },
  { id: 128, step: 2, add: 'Sour cream too.' },
  { id: 135, step: 1, add: 'Salsa on the side, or spooned in before they are rolled.' },
  { id: 152, step: 2, add: 'Salsa out with them.' },
  { id: 168, step: 2, add: 'Stir the butter into them while they are hot — that is the difference between a topping and a paste.' },
  { id: 205, step: 1, add: 'Make the mix up with the milk rather than water; it is a box mix either way, and this is the part that stops it tasting like one.' },
  { id: 217, step: 0, add: 'Beat the waffle mix, milk and egg together first and let the batter stand a couple of minutes.' },

  /* ---- the two recipes that ask for breadcrumbs -------------------------
   *
   * The same reader, the same evening, one step earlier: half a cup of
   * breadcrumbs, and the storehouse does not carry a box of them. Bread is on
   * the standard order, so the recipe for making them is now in Made, Not
   * Bought and both meatball recipes point at it. */
  /* Celery salt is not on the storehouse order — a fact that was hidden until
     the list was declared rather than inferred. Both of these exist so that
     somebody with only the order can still make the thing, so neither may
     depend on something the order does not carry. It stays in as an
     improvement and is now marked optional. */
  /* ---- the three that open a can of mushroom soup --------------------
   *
   * Cream of mushroom is on the storehouse order, so these are no different
   * from any other recipe until the day it is not on the shelf — and unlike
   * every other tin in the book there is no making it, because the order
   * carries no mushrooms. {r:275} does, because canned chicken is on the list.
   *
   * So each of these says what to reach for instead. Not the same sentence
   * three times: the soup is doing a different job in each one, and in the
   * pork roast it is not a soup at all, it is the gravy. */
  { id: 161, step: 2, add: 'No mushroom soup? {r:275} layers in exactly the same way, and {r:265} made pale does the binding just as well.' },
  { id: 171, step: 1, add: 'The soup is the gravy here, and {r:265} is a better one — make it pale, with the juices from the tin once the roast is out. {r:275} works too if you want it thicker.' },
  { id: 196, step: 1, add: 'No mushroom soup? {r:275} is the closer swap; {r:265} made pale is the leaner one. Either way the sour cream goes in off the heat, or it splits.' },

  { id: 166, step: 0, add: 'No breadcrumbs in the cupboard? {r:272} makes them from bread, which is on the order.' },
  { id: 178, step: 0, add: 'No breadcrumbs in the cupboard? {r:272} makes them from bread, which is on the order.' },

  /* ---- four titles that promise something the recipe has not got --------
   *
   * Found by a reader looking at No. 084 and asking where the rice crisp
   * was. It is a fair question: the title says "with Rice Crisp" and the
   * recipe is whey, cocoa and two tablespoons of water. Nothing crisp, no
   * rice, and no step that could have held either.
   *
   * Three more read the same way. A pancake stack that calls itself
   * buttermilk and is made with milk. Cocoa cups that promise marshmallows
   * and contain cinnamon. A casserole named for rotini that is made with the
   * ribbon pasta the storehouse actually carries.
   *
   * The fix is the title in every case, not the ingredients. None of the four
   * missing things — crisp rice cereal, buttermilk, marshmallows, rotini — is
   * on the storehouse order, and the promise this book makes is that its
   * recipes come off that order. Adding them to keep four titles would break
   * the thing the titles are attached to.
   *
   * Each new name is taken from what the method already does: No. 084 says
   * "until dark fudge paste forms", so it is a fudge slurry.
   */
  { id: 100, name: 'Protein Cocoa Fudge Slurry' },
  { id: 104, name: 'Fluffy Pancake Stack' },
  { id: 211, name: 'Hot Cocoa & Cinnamon Cups' },
  { id: 160, name: 'Creamy Chicken Pasta Casserole' },

  /* ---- eleven things you were sent to the shop for and never told to use --
   *
   * Reported by the owner after cooking No. 190, the alfredo bake. He was
   * confused by the cheese sauce, went and asked elsewhere how to make one,
   * and came back with a better dish than the book describes.
   *
   * Four separate faults in that one recipe, and the same shape underneath
   * all of them: the recipe knows what it wants and does not say it.
   *
   *   - "Whisk evaporated milk, butter, and cheese into sauce" is one line
   *     doing four jobs. No heat, no order, no thickener, no cue for done.
   *     Cheddar whisked into evaporated milk with nothing starchy stays thin
   *     or splits, which is exactly what happened.
   *   - There was not enough of it. Two cups of sauce for a pound of dry
   *     pasta and two pounds of chicken, where a baked pasta wants twice
   *     that, and then twenty minutes in the oven takes more.
   *   - Parmesan is on the shopping list for this recipe and appears in no
   *     ingredient line and no step. He added it himself, on top, which is
   *     where it belongs and where the recipe should have said.
   *   - The pasta is cooked twice: boiled to done, then baked for twenty
   *     minutes more.
   *
   * The other ten are the third fault on its own — an ingredient the reader
   * is told to buy and then never told to use. Taco seasoning in five,
   * garlic powder and Italian seasoning in one, cumin, Worcestershire, and
   * parmesan again in the meatball feast.
   *
   * This is the green bean problem in a different field. The guard written
   * for that one reads the ingredient list; "buy this elsewhere" is a
   * separate list, so none of these was ever covered. tests/recipes.test.js
   * now reads both.
   *
   * None of the eleven can be made from the order — the storehouse carries
   * salt, celery salt, cinnamon and cinnamon sugar, and no other seasoning at
   * all — so every one of them stays an extra. What changes is that the
   * method now says where it goes and how much.
   */
  {
    id: 179,
    time: '45 mins',
    /* Nothing bought elsewhere any more: the parmesan that was the only thing
       on this list is optional now, so the alfredo bake is a recipe you can
       cook out of the order alone. */
    extras: null,
    ing: ['2 lbs chicken breast', '16 oz ribbon pasta', '2 cans evaporated milk',
      '½ cup butter', '¼ cup flour', '2½ cups cheddar',
      '½ cup breadcrumbs', 'salt and pepper'],
    /* Parmesan started out in the ingredient list here, which was the wrong
       answer to the right problem: it made the recipe unfollowable without a
       trip to the shop. The dish is good on cheddar — that is the point of the
       book — and the parmesan belongs where anything off the order belongs,
       under a heading that says it is optional. */
    lift: {
      with: 'Parmesan, fresh garlic, Italian seasoning',
      steps: [
        'Soften 3 or 4 minced garlic cloves in the butter for a minute before the flour. Garlic in the fat tastes of the dish; garlic added late tastes of garlic.',
        'Swap half a cup of cheddar for grated parmesan, and keep half back for the top. Salt the sauce after it goes in — parmesan is saltier.',
        'A teaspoon of Italian seasoning with the cheese, and a pinch of nutmeg if you have it.',
      ]
    },
    /* Written short on purpose. The first version of this rewrite said all of
       the same things at twice the length and came out 935px tall against 720
       of paper — off the bottom of its own page even at the 0.85 squeeze
       floor, which is the packer telling you the recipe does not fit the book.
       Every instruction below survived the cut; only the words did not. */
    steps: [
      'Heat the oven to 375°F. Boil the pasta in well-salted water, but stop two minutes short of the packet time — it finishes in the oven, and pasta boiled soft first bakes to mush. Save a mug of the water.',
      'Salt and pepper the chicken and cook it in a wide skillet over medium-high, about 6 minutes a side. Done is 165°F, or white through with clear juices. Rest 5 minutes, then slice. Keep the skillet.',
      'Melt the butter in the same skillet over medium-low. Whisk the flour in and cook it a full minute — it will look like wet sand, and that minute is what stops the sauce tasting of raw flour. Add the evaporated milk a splash at a time, whisking smooth after each, until it thickens at a bare simmer.',
      'Off the heat — boiled, cheese turns grainy and splits — stir in two cups of cheddar a handful at a time. Loosen with pasta water if it is thicker than pouring cream. Salt until it tastes slightly too strong; a pound of pasta is about to dilute it.',
      'Fold the pasta and chicken through, tip into a buttered 9x13 dish, and scatter the last half cup of cheddar and the breadcrumbs over. No crumbs? {r:272} makes them, and an air fryer makes better ones than an oven.',
      'Bake 20 minutes, until it bubbles at the edges and the top has colour. Stand 5 minutes before serving or the first spoonful runs.'
    ]
  },
  { id: 178,
    extras: null,
    lift: {
      with: 'Parmesan, fresh garlic',
      steps: [
        'A clove of minced garlic and a tablespoon of grated parmesan into the meatball mix, with the egg and crumbs. Both are in there before it cooks, which is where they do the most.',
        'Parmesan grated over each plate at the table, not into the pot. It stops tasting of anything after ten minutes in a sauce.',
      ]
    } },
  { id: 58, step: 1,
    add: 'This is where the cumin goes: a teaspoon of it with the chili powder. Chili powder is mostly mild, and cumin is what makes a pot of beans taste like chili rather than like tomatoes.' },
  { id: 151, step: 2,
    add: 'Stir in a teaspoon of garlic powder and a teaspoon of Italian seasoning here — both are on the list for this recipe, and stirred into the sauce is the only place they do anything.' },
  { id: 145, step: 0,
    add: 'Add 2 tbsp taco seasoning and ¼ cup water to the browned beef and let it bubble a minute until it clings. Seasoning tipped over the top at the end sits on the meat instead of in it.' },
  { id: 164, step: 1,
    add: 'Stir 2 tbsp taco seasoning into the beef with the tomato sauce, and let it simmer a minute before it is layered.' },
  { id: 172, step: 1,
    add: 'Add 2 tbsp taco seasoning with the salsa and beans, and give it a minute to come together.' },
  { id: 190, step: 1,
    add: 'Toss the shredded chicken with 2 tbsp taco seasoning and a splash of water before it goes in the tortillas — this is what makes it taste of enchilada rather than of plain chicken.' },
  { id: 200, step: 1,
    add: '"Seasoned" means it: 2 tbsp taco seasoning and ¼ cup water stirred into the browned beef for a minute, until the liquid has gone and the meat is coated.' },
  { id: 176, step: 0,
    add: 'Rub the roast with a tablespoon of Worcestershire before it goes in the pan. It is on the list for this recipe, it is what gives the gravy its savoury depth, and searing it on is better than pouring it over later.' },
];
