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

  /* ---- the audit the alfredo bake set off ------------------------------
   *
   * No. 190 turned out to have four faults, and the question was how many
   * others had the same ones. Eight classes were swept; five of them were
   * almost entirely noise and are worth naming so nobody re-runs them
   * expecting a haul: "bakes with no oven temperature" was seven slow-cooker
   * recipes where roast is a noun; "ground meat with no doneness cue" was
   * forty recipes that all say "brown the beef"; "eggs with no cue for set"
   * was mostly cakes and puddings where the egg is a binder; and four of the
   * eight title-promise hits do the thing under another word — spooning tuna
   * into a hollowed tomato is stuffing it.
   *
   * What survived reading is below.
   */

  /* Six more pastas cooked twice, which is the alfredo bake's third fault.
     Boiled to done and then baked for another twenty minutes, which is how a
     casserole turns to paste. Two minutes short is the whole fix, and the
     reason has to be on the page or the next person "corrects" it back. */
  { id: 63, step: 0, set: 'Preheat oven to 350°F. Boil the pasta two minutes short of the packet time — it finishes in the oven, and pasta boiled soft first bakes to mush.' },
  { id: 160, step: 0, set: 'Preheat oven to 350°F. Boil the pasta two minutes short of the packet time; it finishes in the oven. Cook and dice the chicken first — 165°F — because twenty-five minutes under a blanket of soup will not cook it.' },
  { id: 163, step: 0, set: 'Preheat oven to 350°F. Boil the macaroni two minutes short of the packet time, and add the broccoli for the last three so it keeps some bite. Both finish in the oven.' },
  { id: 170, step: 0, set: 'Preheat oven to 350°F. Boil the macaroni two minutes short of the packet time — it finishes in the oven.' },
  { id: 184, step: 0, set: 'Preheat oven to 350°F. Boil the spaghetti two minutes short of the packet time — it finishes in the oven.' },
  { id: 192, step: 0, set: 'Preheat oven to 350°F. Boil the pasta two minutes short of the packet time; it finishes in the oven. Cook and dice the chicken first — 165°F. Raw breast stirred into sauce and baked twenty-five minutes is not reliably done.' },

  /* No. 205 is the alfredo bake's first and fourth faults in one recipe:
     "Make cheese sauce with milk, flour, cheddar" is the same instruction
     that sent the owner to look it up elsewhere, and the ham is called
     glazed and never glazed. Both fixed, and the potatoes get the parboil
     they need — sliced raw potato does not cook through under sauce in
     forty-five minutes, which is the other thing this recipe was quietly
     wrong about. */
  {
    id: 194,
    time: '70 mins',
    ing: ['2 lb sliced ham', '2 lbs potatoes (sliced thin)', '2 cups milk', '2 tbsp flour',
      '2 tbsp butter', '1.5 cups cheddar', '¼ cup brown sugar', '1 tsp mustard', 'salt', 'pepper'],
    steps: [
      'Heat the oven to 375°F. Slice the potatoes as thin as you can — a quarter inch or less — and simmer them in salted water for 8 minutes. They will not cook through under the sauce otherwise, however long you give them.',
      'Melt the butter in a saucepan over medium-low, whisk in the flour and let it cook a full minute — it should look like wet sand. Add the milk a splash at a time, whisking smooth after each, and let it come to a bare simmer until it thickens.',
      'Off the heat, stir in a cup of the cheddar a handful at a time. Off the heat matters: boiled, cheese goes grainy and the fat splits out. Salt and pepper it, and taste — under sauce, thin potato needs more salt than seems right.',
      'Layer the drained potatoes and the sauce in a buttered dish, finishing with sauce, and scatter the last half cup of cheddar over. Bake 40 minutes, until a knife goes through the middle with no resistance and the top has browned.',
      'Meanwhile the glaze the title promises: stir the brown sugar and mustard together, spread it over the ham slices in a second dish, and give them 15 minutes in the same oven until the sugar has gone shiny and dark at the edges. Serve them with the potatoes.'
    ]
  },

  /* No. 135 could not be made at all. "Make thick pancake batter" from one
     cup of dry mix and nothing wet — the ingredient list has sausages, mix
     and syrup, and no liquid anywhere. The batter is the recipe. */
  {
    id: 124,
    ing: ['4 cooked sausage links', '1 cup pancake mix', '½ cup milk', '1 tbsp oil', '¼ cup syrup'],
    steps: [
      'Whisk the pancake mix with the milk into a batter thicker than you would pour for pancakes — it has to cling to a sausage rather than run off it. Add the milk a little at a time; you can always loosen it.',
      'Heat the oil in a skillet over medium. Dip each sausage in the batter, turning it to coat, and fry 2 minutes a side until golden all round.',
      'Serve with the syrup.'
    ]
  },

  /* No. 215's pudding had no liquid either: the box wants milk, and all the
     milk in the ingredient list is already in the cake batter. */
  {
    id: 204,
    /* Eggs. A box cake mix without them does not set, and the first pass at
       fixing this recipe gave it milk and butter and left the eggs out — the
       packet guard caught that later. */
    ing: ['1 box chocolate cake mix', '3 eggs', '3 cups milk', '½ cup butter', '1 pkg chocolate pudding mix'],
    steps: [
      'Heat the oven to 350°F and butter a 9x13 dish.',
      'Whisk the cake mix with the 3 eggs, 1¼ cups of the milk and the melted butter until smooth.',
      'In a second bowl, whisk the pudding mix with the remaining 1¾ cups of milk for two minutes until it thickens. Do not cook it — it goes in soft.',
      'Pour the cake batter into the dish, spoon the pudding over in blobs, and drag a knife through both once or twice. Two or three passes, not twenty: swirl it too far and it is one colour again.',
      'Bake 28 minutes. The pudding stays fudgy, so a skewer will not come out clean — go by the cake around it, which should spring back.'
    ]
  },

  /* Two pastries with no water in them and no method. Flour and butter alone
     is not a dough; it is crumbs. */
  {
    id: 212,
    ing: ['2 fresh apples (quartered)', '1.5 cups flour', '½ cup butter', '4 tbsp cold water',
      '¼ cup sugar', '1 tsp cinnamon', 'salt'],
    steps: [
      'Heat the oven to 375°F.',
      'Rub the cold butter into the flour and a pinch of salt with your fingertips until it looks like coarse crumbs, then stir in the cold water a tablespoon at a time until it just holds together in a ball. Stop there — a pastry worked smooth goes tough.',
      'Rest the dough 15 minutes, then roll it out and cut it into four squares.',
      'Wrap each apple quarter in a square, pinching the seams shut, and sit them seam-down on a baking sheet. Mix the sugar with the cinnamon and scatter it over.',
      'Bake 25 minutes, until the pastry is golden and a skewer slides into the apple without resistance.'
    ]
  },
  {
    id: 218,
    ing: ['1.5 cups flour', '½ cup butter', '4 tbsp cold water', 'salt',
      '1 pkg chocolate pudding mix', '2 cups milk'],
    steps: [
      'Heat the oven to 375°F. Rub the cold butter into the flour and a pinch of salt until it looks like coarse crumbs, then stir in the cold water a tablespoon at a time until it just comes together. Rest it 15 minutes.',
      'Roll it out, line a pie dish, and prick the base all over with a fork. Bake 15 minutes until dry and pale gold. Pricking is what stops the base rising into a dome under the filling.',
      'Whisk the pudding mix with the milk for two minutes until it thickens, pour it into the cooled crust, and chill 2 hours before cutting.'
    ]
  },

  /* A pot roast in a dry slow cooker. Eight hours on low with nothing in the
     pot is not braising, and it is the only recipe in the collection that
     asks for it. */
  {
    id: 191,
    steps: [
      'Sear the roast hard on both sides in a hot skillet, 3 minutes a side. This is where the colour and most of the flavour of the gravy comes from, and a slow cooker cannot do it.',
      'Put the roast and the quartered potatoes in the slow cooker with 1 cup of water and a good pinch of salt, and cook on LOW for 8 hours until a fork twists in the meat with no effort.',
      'Simmer the carrots in a skillet with the brown sugar, the butter and a splash of water for 15 minutes, until the liquid has gone syrupy and coats them.',
      'Rest the roast 10 minutes before slicing it across the grain. The liquid left in the cooker makes {r:265}, poured over.'
    ]
  },

  /* "Crispy Potato Diggers", roasted for 25 minutes in the same pan as
     broccoli, which is ash by then. And "Crispy Baked Chicken" with nothing
     on it to crisp. Both titles were promising a texture the method had no
     way to produce. */
  {
    id: 154,
    steps: [
      'Heat the oven to 425°F. Hotter than it said: 400 steams cubed potato as often as it crisps it.',
      'Toss the potatoes and carrots with the oil, salt and pepper and spread them out on a sheet pan in one layer — crowded, they steam. Roast 20 minutes.',
      'Add the sliced franks and the broccoli, toss everything together, and give it 10 minutes more. The broccoli only needs that; put it in at the start and it is ash by the end.',
      'The potatoes are done when a corner crushes under a spoon and the outside has gone golden and rough.'
    ]
  },
  /* Kept short: this one is also one of the eight on the handout, which is
     two sheets and no more, and the first draft of this step pushed page one
     to 11.76in of an 11in page. */
  { id: 156, step: 0, set: 'Heat the oven to 425°F. Pat the chicken dry, rub it with oil, salt and pepper, and bake 22 minutes on a rack — dry skin in a hot oven is what crisps it. Check the thickest reads 165°F.' },

  /* Instant mashed potatoes, four times, with no quantity and no pointer at
     the recipe that replaces them. The packet knows the ratio; the reader
     standing at the counter with a scoop does not. */
  { id: 62, step: 1, set: 'Make up the instant potatoes — about 2 cups of flakes to 2 cups of boiling water and a splash of milk, or whatever the tub says. Out of flakes? {r:276} does it from the potatoes on the order.' },
  { id: 72, step: 1, set: 'Make up the mashed potatoes from the flakes — about 2 cups of flakes to 2 cups of boiling water and a splash of milk, or whatever the tub says. Out of flakes? {r:276} does it from the potatoes on the order.' },
  { id: 156, step: 1, set: 'Make up the mashed potatoes with the butter and milk, 2 cups of flakes to 2 cups of boiling water. No flakes? {r:276}.' },
  { id: 171, step: 2, add: 'Out of instant potato flakes? {r:276} makes mashed potatoes from the potatoes on the order.' },

  /* Two the sweep flagged that turned out to be half right.
   *
   * No. 208 does make its glaze — the word "glaze" is simply not in the
   * method — but it brushes a quarter cup of brown sugar onto a roast and
   * gives it fifty minutes, which is long enough for sugar to burn black.
   * Late, and twice, is how a glaze goes on.
   *
   * No. 80 says "make chocolate pudding" over an ingredient list whose first
   * line is a serving of chocolate pudding. It is an assembly recipe and the
   * pudding is somebody else's job — so it says whose. */
  { id: 197, step: 1, set: 'Puree the peaches with the brown sugar and mustard. Keep it back for now: brushed on at the start it has fifty minutes to burn, and burnt sugar is bitter all the way through.' },
  { id: 197, step: 2, set: 'Bake the pork roast at 375°F for 35 minutes, then brush the glaze over and give it 15 minutes more, brushing again halfway. Done is 145°F at the thickest part, and it wants 10 minutes\' rest before slicing.' },
  { id: 89, step: 0, set: 'Make up the chocolate pudding — a packet whisked with 2 cups of milk for two minutes, or {r:202} if you would rather it was already portioned.' },

  /* And the last two the "make X" guard turned up once it existed. A PB&J is
     not a mystery, but "make 4 PB&J sandwiches" is still the only instruction
     on a page somebody may be reading because they have not cooked much; and
     the churro batter is No. 135's fault a second time, with the liquid
     already on the list this time but no hint of how much. */
  { id: 134, step: 0, set: 'Spread the peanut butter on four slices and the jam on the other four, sandwich them, and cut each into quarters.' },
  { id: 209, step: 0, set: 'Whisk the pancake mix with the milk into a batter thick enough to hold its shape on a spoon — thicker than pancake batter. Add the milk a little at a time; loosening it is easy and thickening it is not.' },

  /* ---- the whole-collection sweep ---------------------------------------
   *
   * Asked for after the audit: read every recipe, say whether the method is
   * clear, and add the "better with a few extras" block wherever a few
   * ordinary spices would genuinely change the dish.
   *
   * Two scans. The first looked for cooked recipes missing two or more of
   * {a time, a heat level, a doneness cue} — 33 of them, against 108 that a
   * cruder "short method" test had flagged, nearly all of which were cold
   * assembly and perfectly clear. "Scoop cottage cheese into a bowl" is a
   * complete instruction. The second looked for savoury recipes with no
   * aromatic anywhere and sweet ones with no warm spice: 143.
   *
   * The lifts are written to an ordinary spice cupboard — garlic, onion,
   * oregano, basil, Italian seasoning, cumin, chili powder, paprika, thyme,
   * bay, nutmeg, soy sauce, Worcestershire, hot sauce, lemon, parmesan. None
   * of it is on the storehouse order, none of it is required, and the recipe
   * above each block still has to be worth cooking without any of it.
   */

  /* Scrambled eggs, four times, with a time and no heat and no idea what
     done looks like. Three minutes on a hot pan is rubber; the cue is what
     matters. */
  { id: 32, step: 0, set: 'Scramble the eggs in a buttered skillet over medium-low heat, stirring slowly, about 3 minutes — pull them while they still look slightly wet, because they carry on cooking in the pan.' },
  { id: 32, lift: { with: 'Hot sauce, cumin, fresh onion',
    steps: ['A pinch of cumin over the beans while they warm, and a few dashes of hot sauce into the salsa.',
      'A tablespoon of finely diced raw onion on top gives it the crunch a soft bowl is missing.'] } },
  { id: 36, step: 1, set: 'Add the beaten eggs and scramble over medium-low, stirring slowly, about 3 minutes — take them off while they still look a little wet.' },
  { id: 50, step: 0, set: 'Scramble the eggs in a buttered skillet over medium-low heat, about 3 minutes, and stop while they are still glossy.' },
  { id: 112, step: 0, set: 'Scramble the eggs in a buttered skillet over medium-low heat, about 3 minutes, stopping while they still look slightly wet.' },
  { id: 112, lift: { with: 'Hot sauce, cumin, fresh cilantro, lime',
    steps: ['A pinch of cumin into the eggs as they cook, and hot sauce at the table.',
      'Chopped cilantro and a squeeze of lime over the top. A breakfast taco without acid tastes flat however good the eggs are.'] } },

  /* Oats and porridge: "boil for N minutes" with no heat and no thickness. */
  { id: 37, step: 0, set: 'Simmer the oats in 1 cup of water over medium heat for about 3 minutes, stirring, until they thicken and the water has gone.' },
  { id: 115, step: 0, set: 'Simmer the oats and milk over medium heat for about 5 minutes, stirring often so the milk does not catch, until thick enough to hold a spoon-track for a second.' },
  { id: 115, lift: { with: 'Nutmeg, vanilla, a pinch of salt',
    steps: ['A pinch of salt in with the milk. Unsalted porridge tastes of nothing and no amount of honey fixes it.',
      'A scrape of nutmeg and a few drops of vanilla with the cinnamon.'] } },

  { id: 77, step: 2, set: 'Broil 1 to 2 minutes, watching it the whole time — it goes from bubbling to burnt in about twenty seconds.' },

  /* Skillet meals with a time and no heat. */
  { id: 62, step: 0, set: 'Brown the beef in a skillet over medium-high, breaking it up, about 8 minutes, until no pink is left. Drain the fat.' },
  { id: 62, lift: { with: 'Onion, garlic, thyme, Worcestershire',
    steps: ['Soften a diced onion with the beef, and a clove of minced garlic for the last minute.',
      'A splash of Worcestershire and a pinch of dried thyme into the browned beef. Shepherd\'s pie without either tastes like mince under mash, which is what this is trying not to be.'] } },
  { id: 67, step: 0, set: 'Brown the ground beef over medium-high, breaking it up, about 8 minutes, until no pink is left. Drain the fat.' },
  { id: 67, lift: { with: 'Garlic, ginger, sesame oil, chili flakes',
    steps: ['Minced garlic and ginger into the pan for the last minute of browning, not at the start — both burn.',
      'A teaspoon of sesame oil off the heat at the end, and chili flakes to taste. Sesame oil cooked hard loses the thing you added it for.'] } },
  { id: 70, step: 0, set: 'Cook the diced chicken with the salsa in a skillet over medium heat, about 10 minutes, until the chicken is 165°F and the salsa has thickened around it.' },
  { id: 70, lift: { with: 'Cumin, smoked paprika, lime, cilantro',
    steps: ['A teaspoon each of cumin and smoked paprika onto the chicken before it goes in the pan. Smoked paprika is what makes this taste chipotle rather than salsa-coloured.',
      'Lime squeezed over and cilantro scattered at the end.'] } },
  { id: 71, step: 0, set: 'Sauté the sliced peppers, onions and carrots over medium-high, about 8 minutes, until the edges have taken colour and the carrot has lost its squeak.' },
  { id: 71, lift: { with: 'Garlic, oregano, smoked paprika, hot sauce',
    steps: ['Garlic and a teaspoon of oregano in for the last minute with the vegetables.',
      'Smoked paprika over the pork as it warms through, and hot sauce at the table.'] } },
  { id: 64, step: 0, set: 'Brown the beef with the drained pinto beans and ¼ cup salsa over medium-high, about 8 minutes, until no pink is left and the liquid has cooked down.' },
  { id: 64, lift: { with: 'Cumin, chili powder, garlic, onion',
    steps: ['A diced onion in first, then a teaspoon each of cumin and chili powder with the beef. The recipe is called spicy and has nothing in it that is.',
      'A clove of garlic for the last minute.'] } },
  { id: 68, step: 0, set: 'Boil the macaroni and broccoli together about 8 minutes, until the pasta is just tender and the broccoli still has some bite; drain.' },
  { id: 68, lift: { with: 'Garlic, black pepper, parmesan, lemon',
    steps: ['A clove of minced garlic and plenty of black pepper stirred into the soup before it meets the pasta.',
      'Parmesan and a squeeze of lemon at the end. Condensed soup is salty and flat; acid is what lifts it.'] } },

  /* Three the clarity scan turned up that are not toast.
   *
   * No. 134 lists "2 soft-boiled eggs" and no step ever boils one, which is
   * the cooked-chicken fault in a gentler place — and soft-boiled is the one
   * egg where the timing is the whole recipe. No. 207 stirs sour cream into a
   * hot pan, which splits it. No. 140 boils franks that are already cooked. */
  { id: 123, step: 1, set: 'Soft-boil the eggs: lower them into water already at a rolling boil, 6 minutes exactly for a set white and a runny yolk, then run them under cold water for a few seconds so they stop cooking. Serve with the soldiers for dipping.' },
  { id: 196, step: 1, set: 'Brown the beef over medium-high, about 8 minutes, and drain it. Turn the heat right down before the sour cream goes in — boiled, it splits into grains and oil and will not come back. Stir in the soup first, then the sour cream off the heat. No mushroom soup? {r:275} is the same job from the order.' },
  { id: 196, lift: { with: 'Onion, garlic, paprika, Worcestershire',
    steps: ['A diced onion softened before the beef, garlic in at the end of browning.',
      'A teaspoon of paprika and a splash of Worcestershire with the soup. Stroganoff without paprika is beef in white sauce.'] } },
  { id: 129, step: 0, set: 'Franks are already cooked, so this is only heating them through: simmer 6 minutes, or grill them turning often until the skins blister and split.' },

  /* ---- lifts, by family --------------------------------------------------
     Pasta and red sauce. The same three things every time, because it is the
     same dish underneath: something allium, something green and dried, and
     something salty and hard at the end. */
  { id: 155, lift: { with: 'Onion, garlic, oregano, basil, parmesan',
    steps: ['Soften a diced onion before the beef and add two cloves of garlic once it has browned.',
      'A teaspoon each of dried oregano and basil into the sauce, and let it simmer the full ten minutes with them in — dried herbs need time in liquid to give anything up.',
      'Parmesan at the table.'] } },
  { id: 151, lift: { with: 'Onion, garlic, oregano, parmesan',
    steps: ['A diced onion with the beef and a clove of garlic at the end.',
      'A teaspoon of oregano into the tomato sauce, and parmesan over the cheddar before the lid goes on.'] } },
  { id: 165, lift: { with: 'Garlic, oregano, chili flakes, parmesan',
    steps: ['Two cloves of garlic and a teaspoon of oregano into the tomato sauce.',
      'Chili flakes to taste and parmesan at the table.'] } },
  { id: 141, lift: { with: 'Garlic, oregano, parmesan, chili flakes',
    steps: ['A clove of garlic and a teaspoon of oregano stirred into the tomato soup — canned soup is sweet, and the herbs are what stop it tasting like a dessert.',
      'Parmesan and chili flakes over the bowls.'] } },
  { id: 170, lift: { with: 'Onion, garlic, mustard, Worcestershire',
    steps: ['A diced onion with the beef, garlic at the end.',
      'A teaspoon of mustard and a splash of Worcestershire with the ketchup. That combination is what makes a cheeseburger taste of a cheeseburger.'] } },
  { id: 174, lift: { with: 'Onion, garlic, oregano, parmesan',
    steps: ['Onion and garlic with the beef, oregano into the sauce.',
      'Parmesan folded through the cheddar on top.'] } },

  /* Cream-soup casseroles. Condensed soup is salty, sweet and flat; every one
     of these wants aromatics at the front and acid at the end. */
  { id: 160, lift: { with: 'Onion, garlic, thyme, lemon, parmesan',
    steps: ['Soften a diced onion and two cloves of garlic and stir them through the soup.',
      'A pinch of dried thyme in, and a squeeze of lemon over the top when it comes out. Acid is what a cream-soup bake is always missing.'] } },
  { id: 163, lift: { with: 'Garlic, mustard powder, black pepper, parmesan',
    steps: ['A clove of garlic and half a teaspoon of mustard powder into the sauce — mustard makes cheddar taste more of cheddar without tasting of mustard.',
      'Plenty of black pepper, and parmesan mixed into the cheddar.'] } },
  { id: 153, lift: { with: 'Onion, garlic, thyme, black pepper',
    steps: ['A diced onion and a clove of garlic softened and stirred into the soup.',
      'A good pinch of dried thyme and more black pepper than seems right. Pot pie is a thyme dish.'] } },
  { id: 161, lift: { with: 'Onion, garlic, paprika, hot sauce',
    steps: ['A diced onion with the beef and garlic at the end.',
      'A teaspoon of paprika into the soup, and hot sauce at the table.'] } },

  /* Chowders and soups. */
  { id: 144, lift: { with: 'Onion, garlic, thyme, bay, black pepper',
    steps: ['Soften a diced onion in the butter before anything else goes in, with a clove of garlic for the last minute.',
      'A bay leaf and a pinch of thyme in with the milk, fished out before serving. Potato and milk on their own taste of almost nothing; this is the whole difference.'] } },
  { id: 147, lift: { with: 'Onion, garlic, cumin, smoked paprika, lime',
    steps: ['A diced onion softened in the butter, garlic after.',
      'A teaspoon each of cumin and smoked paprika with the milk, and lime squeezed over the bowls.'] } },
  { id: 133, lift: { with: 'Black pepper, hot sauce, parsley',
    steps: ['Canned soup is under-seasoned in one direction only: black pepper, and a few dashes of hot sauce.',
      'Chopped parsley over the top if you have it.'] } },

  /* Roasts and slow cookers. */
  { id: 157, lift: { with: 'Garlic, rosemary, black pepper',
    steps: ['Cut slits in the pork and push slivers of garlic into them before it goes in the cooker.',
      'A branch of rosemary in with it, and black pepper over the top. Pork and applesauce is a sweet pairing and wants something woody against it.'] } },
  { id: 171, lift: { with: 'Onion, garlic, thyme, black pepper',
    steps: ['A sliced onion under the roast and two cloves of garlic in the soup.',
      'Thyme and black pepper over the meat before it goes in.'] } },
  { id: 175, lift: { with: 'Garlic, rosemary, thyme',
    steps: ['Rub the sliced roast with garlic, rosemary and thyme before searing.',
      'Toss the carrots and potatoes in the same before they roast — the herbs are doing more work on the vegetables than on the beef.'] } },
  { id: 181, lift: { with: 'Onion, garlic, smoked paprika, cider vinegar',
    steps: ['A sliced onion under the beef and garlic in with the sauce.',
      'A teaspoon of smoked paprika, and a splash of cider vinegar stirred through the pulled meat at the end. Bottled barbecue sauce is sweet; vinegar is what cuts it.'] } },

  /* Sheet pans and roasted chicken. */
  { id: 54, lift: { with: 'Garlic powder, paprika, oregano, lemon',
    steps: ['A teaspoon each of garlic powder, paprika and oregano tossed with the oil before it all goes on the pan.',
      'Lemon squeezed over the lot as it comes out of the oven.'] } },
  { id: 132, lift: { with: 'Onion powder, garlic powder, Worcestershire, pickles',
    steps: ['Work a teaspoon each of onion and garlic powder and a splash of Worcestershire into the beef before forming the patties.',
      'Pickle slices in the sliders. A cheeseburger without something sharp is just meat and bread.'] } },
  { id: 154, lift: { with: 'Garlic powder, smoked paprika, oregano',
    steps: ['Toss the potatoes and carrots with a teaspoon each of garlic powder and smoked paprika as well as the oil.',
      'A pinch of oregano over everything for the last ten minutes.'] } },

  /* Melts, wraps and cold salads — all of them short of acid or allium. */
  { id: 126, lift: { with: 'Fresh garlic, mustard, black pepper',
    steps: ['Mash a crushed clove of garlic into the butter you spread on the outside. Garlic butter is the difference between a toasted sandwich and a good one.',
      'A thin scrape of mustard inside, and black pepper on the tomato.'] } },
  { id: 138, lift: { with: 'Garlic, oregano, chili flakes, parmesan',
    steps: ['Garlic butter on the outside, oregano stirred into the spaghetti sauce.',
      'Parmesan with the cheddar, chili flakes if you like it hot.'] } },
  { id: 139, lift: { with: 'Onion, celery, lemon, dill, black pepper',
    steps: ['Finely diced raw onion and celery into the tuna mix. Tuna salad is a texture problem before it is a flavour one.',
      'Lemon, dill and black pepper — the lemon especially, which is what stops mayo tasting heavy.'] } },
  { id: 130, lift: { with: 'Onion, lemon, dill, black pepper',
    steps: ['A tablespoon of finely diced onion and a squeeze of lemon into the tuna.',
      'Dill and black pepper. Every good tuna salad is tuna, something sharp, and something crunchy.'] } },
  { id: 148, lift: { with: 'Onion, lemon, dill',
    steps: ['Diced onion into the chicken mix and a squeeze of lemon over the hollowed tomatoes before filling.',
      'Dill through the mayo.'] } },
  { id: 15, lift: { with: 'Lemon, black pepper, red onion',
    steps: ['A squeeze of lemon and plenty of black pepper over the salad.',
      'Thin-sliced red onion, which gives a cold salad the bite that ranch alone does not.'] } },
  { id: 127, lift: { with: 'Chives, garlic powder, hot sauce, bacon bits',
    steps: ['Garlic powder into the butter, chives over the top.',
      'Hot sauce and bacon bits on the bar. A potato bar is a topping problem, so the answer is more toppings.'] } },
  { id: 131, lift: { with: 'Mustard powder, garlic powder, black pepper',
    steps: ['Half a teaspoon of mustard powder and a pinch of garlic powder into the milk before the cheese goes in.',
      'Black pepper at the end. Stovetop mac is mild by design and takes seasoning better than people expect.'] } },
  { id: 140, lift: { with: 'Cumin, chili powder, garlic, lime',
    steps: ['Cumin and chili powder into the chicken before it is rolled.',
      'Lime over the taquitos as they come out of the pan.'] } },
  { id: 143, lift: { with: 'Red onion, cilantro, chili flakes',
    steps: ['Thin-sliced red onion over the barbecue sauce before the cheese.',
      'Cilantro and chili flakes after it comes out.'] } },
  { id: 168, lift: { with: 'Onion, garlic, thyme, Worcestershire',
    steps: ['A diced onion softened with the beef and garlic at the end.',
      'Thyme and a splash of Worcestershire into the meat before the potato goes on. This is the same seasoning as No. 063 because it is the same dish, done properly.'] } },
  { id: 174, lift: { with: 'Cumin, chili powder, garlic, lime',
    steps: ['Cumin and chili powder into the beans and rice.',
      'Garlic in the tomato sauce, lime over the top.'] } },

  /* No. 062 is called Lemon Pepper Chicken and its ingredient list contains
     neither. Black pepper is on the storehouse order, so it goes in the
     recipe; lemon is not, so it goes in the lift. Half a promise kept for
     free, and the other half named. */
  { id: 61, step: 0, set: 'Heat the oven to 400°F. Season the chicken well on both sides with salt and a lot of black pepper — more than looks sensible, since this is half of what the title is promising — and bake 20 minutes. Give it longer if the breasts are thick; done means 165°F and no pink at the centre.' },
  { id: 61, lift: { with: 'Lemon, garlic powder',
    steps: ['Lemon zest into the pepper rub and the juice squeezed over as it comes out of the oven. That is the other half of the name.',
      'A teaspoon of garlic powder in the rub.'] } },

  /* The rest of the meal sections. */
  { id: 12, lift: { with: 'Lemon, dill, red onion',
    steps: ['Lemon and dill into the mayo before it meets the tuna.',
      'A little finely diced red onion for bite.'] } },
  { id: 21, lift: { with: 'Lemon, celery, onion, dill',
    steps: ['Diced celery and onion for crunch — a chicken salad is mostly texture.',
      'Lemon and dill through the mayo.'] } },
  { id: 72, lift: { with: 'Onion, garlic, bay, thyme, Worcestershire',
    steps: ['Brown the stew meat first, then simmer it with a quartered onion, two cloves of garlic, a bay leaf and a pinch of thyme. Meat simmered in plain water tastes like meat simmered in plain water.',
      'A splash of Worcestershire at the end.'] } },
  { id: 58, lift: { with: 'Onion, garlic, smoked paprika, oregano',
    steps: ['A diced onion softened with the beef, garlic at the end.',
      'A teaspoon of smoked paprika and one of oregano with the chili powder. Chili powder alone is one note; these are the other two.'] } },
  { id: 158, lift: { with: 'Onion, garlic, smoked paprika, oregano',
    steps: ['Onion with the beef, garlic after.',
      'Smoked paprika and oregano into the pot with the beans.'] } },
  { id: 193, lift: { with: 'Onion, garlic, smoked paprika, cocoa',
    steps: ['Onion and garlic with the beef.',
      'Smoked paprika, and a tablespoon of cocoa powder into the pot. Cocoa in chili does not taste of chocolate; it makes the whole thing taste deeper and older than it is.'] } },
  { id: 59, lift: { with: 'Onion, smoked paprika, cider vinegar',
    steps: ['Smoked paprika over the potatoes before they roast.',
      'A splash of cider vinegar and some raw diced onion through the pulled pork. Sweet sauce needs sharp things against it.'] } },
  { id: 162, lift: { with: 'Red onion, cider vinegar',
    steps: ['A splash of cider vinegar stirred through the pulled pork — bottled barbecue sauce is sweet and vinegar is what cuts it.',
      'Thin-sliced raw red onion on the buns.'] } },
  { id: 60, lift: { with: 'Lemon, soy sauce, sesame oil, spring onion',
    steps: ['Lemon or a little soy sauce over the rice while it is still warm, so it soaks in.',
      'A few drops of sesame oil and sliced spring onion at the end.'] } },
  { id: 63, lift: { with: 'Onion, garlic, oregano, parmesan',
    steps: ['Onion and garlic softened and stirred into the spaghetti sauce, with a teaspoon of oregano.',
      'Parmesan over the top before it bakes.'] } },
  { id: 136, lift: { with: 'Garlic powder, hot sauce, spring onion',
    steps: ['Garlic powder and a few dashes of hot sauce into the ranch.',
      'Sliced spring onion in the wrap.'] } },
  { id: 142, lift: { with: 'Mustard, black pepper, dill',
    steps: ['Mustard mixed into the mayo — ham and mustard is the whole point of a ham wrap.',
      'Black pepper and a little dill.'] } },
  { id: 146, lift: { with: 'Mustard, black pepper',
    steps: ['A scrape of mustard inside. Ham, cheese and something sweet needs a sharp corner or it is just sweet.',
      'Black pepper over the peaches.'] } },
  { id: 164, lift: { with: 'Onion, garlic, cumin, cilantro, lime',
    steps: ['Onion and garlic with the beef, and a teaspoon of cumin beyond the taco seasoning.',
      'Cilantro and lime over the top out of the oven.'] } },
  { id: 190, lift: { with: 'Onion, garlic, cumin, cilantro, lime',
    steps: ['Onion and garlic into the chicken filling, cumin with the seasoning.',
      'Cilantro and lime at the end.'] } },
  { id: 166, lift: { with: 'Onion, garlic, oregano, parmesan',
    steps: ['A clove of garlic and a spoon of grated parmesan into the meatball mix.',
      'Onion and oregano into the marinara while it simmers.'] } },
  { id: 177, lift: { with: 'Garlic, rosemary, black pepper',
    steps: ['Garlic and rosemary rubbed over the pork before it roasts.',
      'Black pepper into the applesauce — a sweet sauce against a savoury roast wants something to argue with.'] } },
  { id: 182, lift: { with: 'Garlic powder, thyme, black pepper, lemon',
    steps: ['Garlic powder, thyme and black pepper rubbed over the chicken before roasting.',
      'Lemon squeezed over at the table.'] } },
  { id: 184, lift: { with: 'Onion, garlic, oregano, parmesan',
    steps: ['Onion and garlic with the beef, oregano into the sauce.',
      'Parmesan folded into the sour cream layer.'] } },
  { id: 186, lift: { with: 'Onion, garlic, mustard, thyme, parmesan',
    steps: ['A teaspoon of mustard into the cream soup — mustard is what makes cordon bleu taste like cordon bleu.',
      'Onion, garlic and thyme in with it, parmesan on top.'] } },
  { id: 188, lift: { with: 'Onion, garlic, thyme, Worcestershire',
    steps: ['Onion and garlic with the beef, thyme into the gravy.',
      'A splash of Worcestershire before the topping goes on.'] } },
  { id: 191, lift: { with: 'Onion, garlic, bay, thyme, black pepper',
    steps: ['A quartered onion and two cloves of garlic in the cooker with the roast, and a bay leaf.',
      'Thyme and black pepper over the meat before searing.'] } },
  { id: 192, lift: { with: 'Onion, garlic, oregano, parmesan',
    steps: ['Onion and garlic in the tomato sauce, oregano with them.',
      'Parmesan over the top.'] } },
  { id: 198, lift: { with: 'Garlic powder, paprika, black pepper, hot sauce',
    steps: ['Garlic powder, paprika and plenty of black pepper into the flour before dredging. Seasoned flour is the difference between fried chicken and fried breading.',
      'A few dashes of hot sauce into the milk you dip it in.'] } },
  { id: 199, lift: { with: 'Onion, garlic, bay, thyme, Worcestershire',
    steps: ['A quartered onion, garlic and a bay leaf in with the beef.',
      'Thyme and a splash of Worcestershire into the tomato sauce.'] } },

  /* ---- No. 235, reported by the owner as confusing -----------------------
   *
   * He was right, and it is confusing for four separate reasons.
   *
   * "Mix cake batter in 9x13 dish" — out of what? The ingredient list is a
   * box of cake mix, a packet of pudding mix and hot water. A boxed mix wants
   * eggs, oil and water of its own, none of which is listed, so the first
   * real instruction cannot be carried out at all. Same fault as No. 205's
   * cheese sauce: the recipe knows what it means and never says it.
   *
   * Then it tells you to pour two cups of hot water over a dish of cake
   * batter, which looks like a mistake, and does not say the one thing that
   * makes it not a mistake: this is a self-saucing pudding. The water and the
   * dry pudding mix sink while the cake rises through them, and what comes
   * out is cake on top and hot fudge underneath. Nobody who has not seen it
   * before will believe the instruction without being told why.
   *
   * It also does not say DO NOT STIR, which is the one way to ruin it, and it
   * gives no doneness cue for a dish whose whole point is that the middle
   * stays liquid — so "until a skewer comes out clean" would be exactly wrong
   * and thirty minutes is the only guidance offered.
   *
   * And it is called Bowls, makes "6 Bowls", and never portions anything into
   * a bowl.
   */
  {
    id: 224,
    time: '45 mins',
    ing: ['1 box chocolate cake mix', '3 eggs', '½ cup vegetable oil', '1 cup water',
      '1 pkg chocolate pudding mix', '2 cups hot water'],
    steps: [
      'Heat the oven to 350°F. Butter a 9x13 dish.',
      'Make the cake batter the way the box asks — usually the mix with 3 eggs, ½ cup oil and 1 cup water, beaten smooth. Check your box; they vary. Spread it in the dish.',
      'Sprinkle the dry pudding mix evenly over the batter. Straight from the packet, not made up — it is the sauce, and it needs to be dry going in.',
      'Now pour the 2 cups of hot water gently over the whole thing, over the back of a spoon so it does not dig channels. It will look completely wrong: a dish of batter under an inch of water. That is right. Do not stir it. Stirring is the one thing that ruins this.',
      'Bake 30 to 35 minutes. What happens in the oven is that the water and pudding sink while the cake rises through them, so it comes out as cake on top with hot fudge underneath. Done is a top that looks like cake and springs back at the edges, with the middle still visibly loose — a skewer will not come out clean and is not supposed to.',
      'Let it stand 10 minutes, then spoon into bowls, digging down so each one gets sauce from the bottom. This is why it is bowls and not slices.'
    ],
    lift: {
      with: 'Instant coffee, flaky salt, vanilla ice cream',
      steps: [
        'A teaspoon of instant coffee dissolved into the hot water before it goes over. It does not taste of coffee; it makes the chocolate taste more like chocolate.',
        'A pinch of flaky salt over each bowl, and ice cream while it is still hot.'
      ]
    }
  },

  /* ---- four more of what No. 235 was ------------------------------------
   *
   * Asked how many recipes are like the Hot Fudge Cake. Scanning for
   * packaged mixes used without the things the packet needs found nineteen,
   * of which twelve were my own regex matching "cake mix" inside "pancake
   * mix", and three more name the water in a step rather than on the list,
   * which is untidy but followable. Four are the real thing.
   */

  /* A box cake, baked, with no eggs and no oil anywhere — the same fault as
     No. 235 and the same fix. The frosting is also three ingredients whipped
     with no method and no order, and butter whipped straight from the fridge
     into cocoa gives you cocoa-coloured lumps. */
  {
    id: 205,
    time: '50 mins',
    ing: ['1 box yellow cake mix', '3 eggs', '½ cup vegetable oil', '1 cup milk',
      '½ cup butter (softened)', '½ cup cocoa powder', '2 cups powdered sugar', 'vanilla', 'salt'],
    steps: [
      'Heat the oven to 350°F and butter a 9x13 dish.',
      'Make the cake batter as the box asks, but with the milk in place of the water — it is a box mix either way and milk makes it taste less like one. Usually that is the mix, 3 eggs, ½ cup oil and 1 cup milk, beaten 2 minutes.',
      'Bake 25 to 30 minutes, until the top springs back and a skewer in the middle comes out with a crumb or two and no wet batter. Let it cool completely in the dish. Frosting a warm cake slides it off.',
      'For the frosting, beat the softened butter on its own until it is pale and fluffy — a minute or two, and it must be soft or the cocoa will not go in smoothly. Sift in the cocoa and powdered sugar a bit at a time, then a splash of vanilla and a pinch of salt.',
      'Spread over the cooled cake.'
    ]
  },

  /* "Mix batter" over an ingredient line reading "chocolate chips/cake mix",
     which is one line trying to be two ingredients and an either-or. */
  {
    id: 120,
    ing: ['2 cups pancake mix', '1 cup milk', '1 egg', '¼ cup chocolate chips'],
    steps: [
      'Heat the oven to 375°F and butter a 12-cup mini muffin tin.',
      'Whisk the pancake mix with the milk and the egg into a batter a little thicker than you would pour for pancakes, then fold in the chocolate chips. Lumps are fine; beaten smooth makes them tough.',
      'Fill each cup about two-thirds and bake 12 minutes, until risen and dry to a fingertip in the middle.'
    ]
  },

  /* A gravy packet in a slow cooker with nothing to dissolve it in, and a
     gravy packet made up with no quantity given. Both are the same shape as
     the instant-potato entries above: the packet knows, the person standing
     at the counter does not. */
  { id: 195, step: 1, set: 'Put the patties in the slow cooker with the sliced onions, whisk the gravy packet into 1½ cups of water and pour it over, and cook on LOW for 4 hours. Dry powder in a slow cooker will not make gravy — it needs the water. No packet? Use plain water and make {r:265} from the liquid at the end.' },
  { id: 182, step: 1, set: 'Make up the mashed potatoes — about 3 cups of flakes to 3 cups of boiling water and a splash of milk — and whisk the gravy packet into 1 cup of cold water before heating it, or it goes lumpy. No packet? {r:265}, stopped while the flour is still blond, is the pale gravy this wants.' },

  /* Two real ones from the safety sweep, out of thirty-nine flagged. The
     other thirty-seven say "Brown beef", which is a doneness cue; the scan
     only knew "browned" and "until brown". Reading them is the only way to
     tell, which is the lesson of every sweep in this file. */
  { id: 65, step: 2, set: 'Bake on a sheet pan at 375°F for 45 minutes, turning the vegetables once. Pork is done at 145°F at the thickest point, with a faint blush still in it — cooked to grey it is dry, and this is the one meat where people routinely overshoot. Rest it 5 minutes before portioning.' },
  /* This step was written for No. 072, the buffalo chicken, and landed on
     No. 071 by a one-digit slip of mine — id 73 instead of 74. It told a
     sheet-pan roast to fry its chicken in a skillet and then toss it in hot
     sauce and ranch, neither of which the recipe has. Found by reading the
     book rather than by any check, which is why the guard below now exists. */
  { id: 73, step: 0, set: 'Heat the oven to 400°F.' },
  { id: 74, step: 0, set: 'Cook the diced chicken in a skillet over medium-high for about 8 minutes, until no pink is left and a piece cut open at the thickest part reads 165°F, then toss it with the hot sauce and ranch while it is still hot — the sauce clings to hot chicken and slides off cold.' },

  /* ---- reading all 277, batch 1: Nos. 001-046 ---------------------------
   *
   * Not a scan. Every recipe read against the six things a scan could not
   * check: quantities usable, a doneness cue where something cooks, a warning
   * where there is one way to ruin it, titles delivering what they promise,
   * yields matching what the method makes, and safe temperatures for meat.
   *
   * Eleven in this batch. Two of them do not work as written.
   */

  /* Raw grated potato pressed into a muffin cup, an egg cracked on top, and
     twenty minutes. The egg sets in twelve; the potato is still raw at
     twenty-five. The crust has to go in on its own first, which is the
     difference between this recipe working and not. */
  { id: 38, step: 2, set: 'Bake the potato shells on their own for 15 minutes first, until the edges are going gold. Raw grated potato will not cook through in the time an egg needs — it comes out crunchy in the wrong way. Then crack an egg into each and season with salt and pepper.' },
  { id: 38, step: 3, set: 'Back in at 375°F for 12 to 14 minutes, until the whites are set and the yolks still soft. Give them 3 minutes more if you want the yolk hard.' },

  /* Cubed raw potato and raw ground beef in a pan together for ten minutes,
     "until crispy/cooked" — a slash where the two foods disagree. Potato
     wants fifteen minutes and beef wants eight, so the potato goes in first. */
  { id: 43, step: 0, set: 'Fry the cubed potatoes in a little oil over medium-high for about 10 minutes first, turning them, until they are gold and give under a spoon. Then add the ground beef and cook 6 to 8 minutes more, breaking it up, until no pink is left. Both in at once leaves you raw potato and overcooked beef.' },

  /* Both hard-boiled egg recipes list the eggs already boiled and never say
     how, which is fine for somebody who knows and no use at all to somebody
     who does not. It is also the one egg with a definite answer. */
  { id: 4, step: 0, set: 'Hard-boil the eggs if they are not already: lower them into water at a rolling boil, 10 minutes for a firm yolk with no grey ring, then straight into cold water for a minute — that is what makes them peel. Peel them.' },
  { id: 17, step: 0, set: 'Hard-boil the eggs if they are not already — 10 minutes in water at a rolling boil, then a minute in cold water, which is what makes them peel. Peel them into a bowl.' },

  /* Gelatin whipped while it is still hot liquid does nothing at all: it
     needs to be part-set before there is anything for the beaters to hold
     air in. The recipe is called a cloud and cannot make one. */
  { id: 96, time: '1 hr 15 mins', steps: [
    'Dissolve the gelatin in 1 cup of hot water and stir until no grains are left on the bottom.',
    'Stir in the dry milk, then chill 45 minutes to an hour, until it is as thick as raw egg white and mounds slightly on a spoon. Whipping it hot does nothing — there is nothing yet for the air to hold on to.',
    'Now whip it 3 minutes with a hand mixer, until it has doubled and gone pale, then chill 1 hour more to set.'] },

  /* An omelet called fluffy, made by whisking eggs and pouring them in. */
  { id: 45, step: 0, set: 'Whisk the eggs hard for a good 30 seconds, until they are pale and frothy with bubbles on top — that air is the whole of "fluffy", and it goes flat if the pan is not ready. Fold in the cottage cheese and pepper at the end, gently.' },

  /* A crisp is not raw oats on hot fruit. */
  { id: 80, step: 2, set: 'Toast the oats in a dry pan for 2 to 3 minutes until they smell nutty, then sprinkle them over. Raw oats on warm apple go slack; the crisp in the title is toasted oats.' },

  /* Cues and heats the scan could not supply. */
  { id: 34, step: 2, set: 'Pour into the waffle iron and cook about 4 minutes, but go by the steam rather than the clock — a waffle is done when the steam coming out of the sides has mostly stopped. Irons vary more than recipes admit.' },
  { id: 42, step: 0, set: 'Simmer the oats in 1 cup of water over medium heat for about 3 minutes, stirring, until they thicken and the water has gone.' },
  { id: 49, step: 0, set: 'Microwave the oats in 1 cup of water for 2 minutes, in a bowl at least twice as big as it needs to be — oats and water climb the sides and go over.' },
  { id: 48, step: 1, set: 'Cook the sausage and onions in a skillet over medium heat for about 5 minutes, breaking the sausage up, until no pink is left in it.' },
  { id: 48, step: 3, set: 'Bake at 350°F for 18 minutes, until the egg is set at the centre and does not wobble when you nudge the tin.' },

  /* ---- reading all 277, batch 2: Nos. 047-100 ---------------------------
   * Four more, and one of them is a burn risk rather than a matter of taste.
   */

  /* Two drinks say to put hot liquid in a blender and put the lid on. Steam
     expands, the lid goes, and what comes out is a scalding cocoa across the
     ceiling and whoever was holding it. This is the one genuinely dangerous
     instruction in the collection. */
  { id: 26, step: 2, set: 'Blend on high 15 seconds until frothy — but let the Crio Bru cool for five minutes first, or leave the lid cracked with a towel over it. A sealed blender of near-boiling liquid builds steam and lifts its own lid, and what comes out goes over whoever is holding it.' },
  { id: 47, step: 1, set: 'Let the Crio Bru stand five minutes off the boil, then blend it with the whey, brown sugar and salt for 15 seconds. Hot liquid in a sealed blender builds steam and blows the lid off — if it must go in hot, leave the lid cracked and cover it with a folded towel.' },

  /* A fluff with nothing whipped in it. Same fault as No. 044 and the same
     answer: gelatin has to be part-set before it will hold air. */
  { id: 78, time: '2 hrs 15 mins', steps: [
    'Dissolve the gelatin packet in 1 cup of boiling water, stirring until no grains are left.',
    'Whisk in the chocolate whey.',
    'Chill 45 minutes, until it has thickened to about the consistency of raw egg white — it will not whip before that, and this is the step the recipe was missing.',
    'Whip 2 to 3 minutes with a hand mixer until pale and doubled, then refrigerate 90 minutes until set.'] },

  /* ---- reading all 277, batch 3: Nos. 101-145 ---------------------------
   *
   * Five recipes name their main ingredient with no amount at all — "Waffle
   * mix", "Rolled oats", "Pancake mix", "broccoli", "green beans" — which is
   * the base of the dish in three cases. Scanning for unquantified lines
   * found 23; the other eighteen are "dash vanilla", "pinch brown sugar",
   * sour cream as a topping, cilantro as a garnish and lollipop sticks, all
   * of which are right as they are. A quantity is only missing when its
   * absence leaves you guessing.
   */
  { id: 101, ing: ['2 cups waffle mix', '2 eggs', '1 cup milk', '2 tbsp butter', '1 can peaches', '1 tsp cinnamon', '¼ cup syrup'] },
  { id: 102, ing: ['2 cups rolled oats', '2 cups milk', '2 eggs', '2 tbsp butter', '1 tsp cinnamon', '½ cup brown sugar', '¼ cup raisins'] },
  { id: 104, ing: ['3 cups pancake mix', '1.5 cups milk', '1 egg', '2 tbsp butter', 'syrup'] },
  { id: 68, ing: ['2 lbs chicken breast', '16 oz macaroni', '1 can cream of chicken', '1 lb broccoli'] },
  { id: 72, ing: ['1.2 lbs stewing beef', '2 cups instant potatoes', '1 can green beans'] },

  /* And the glaze No. 113 drizzles is never made — butter and brown sugar sit
     on the list and step four calls the result a glaze without ever having
     mixed one. */
  { id: 102, step: 3, set: 'Melt the butter with the brown sugar in a small pan over low heat, stirring, until the sugar has dissolved into it — about a minute. That is the glaze. Drizzle it over the top while the bake is still warm so it soaks in.' },

  /* A pound of dry macaroni with one cup of cheese and a quarter cup of milk
     is not a sauce, it is dry pasta with cheese in it. The alfredo bake's
     second fault, at a smaller scale. */
  { id: 131, ing: ['1 pkg (16 oz) macaroni', '2.5 cups cheddar', '1 cup milk', '4 tbsp butter', '4 sliced beef franks'] },
  { id: 131, step: 2, set: 'Melt the butter into the drained pasta, then add the milk and the cheddar a handful at a time over low heat, stirring until each lot has gone before the next. Off a hard boil — cheese boiled into milk goes grainy. Stir the frank coins through at the end.' },

  /* Ground beef is the one meat where the temperature is not optional: a
     whole cut is sterile inside, a patty has its outside ground through it. */
  { id: 132, step: 1, add: 'Ground beef wants 160°F all the way through, not the pink middle a steak can have — grinding puts the outside of the meat on the inside.' },

  /* ---- reading all 277, batches 4 and 5: Nos. 146-277 -------------------
   * Nine more. Three of them cannot produce what they describe.
   */

  /* A pound of dry macaroni, one can of soup and half a cup of milk. That is
     the alfredo bake's second fault again — not enough sauce by half. */
  { id: 141, ing: ['16 oz macaroni', '2 cans tomato soup', '1 cup milk', '1 cup cheddar'] },

  /* Raw cubed potato and sliced franks in a pan together for twelve minutes.
     The franks are already cooked and the potato is not; twelve minutes is
     the frank's time, not the potato's. */
  { id: 149, step: 0, set: 'Fry the cubed potatoes in a little oil over medium heat for 12 to 15 minutes first, turning them, until a corner crushes under a spoon. Then add the onion and the frank coins and give it 5 minutes more — the franks are already cooked and only want colour. Serve with ketchup.' },

  /* Diced raw chicken, ten minutes, no check. */
  { id: 167, step: 0, set: 'Sauté the peppers, onions and diced chicken over medium-high about 10 minutes, until the chicken is white through and a piece cut at the thickest point reads 165°F.' },

  /* A cup of raw rice in a slow cooker for six hours. Rice is done in forty
     minutes and then keeps drinking: six hours turns the soup into a solid
     block of starch that has absorbed all four cups of water. */
  { id: 173, step: 0, set: 'Put the chicken, carrots, onions and water into the slow cooker — but keep the rice back. A cup of raw rice given six hours drinks every drop of the liquid and turns the soup into a solid block.' },
  { id: 173, step: 1, set: 'Cook on LOW 6 hours, then lift the chicken out and shred it. Stir the rice in for the last 45 minutes only, or cook it separately and add it to the bowls — either works; six hours in the pot does not.' },

  /* Two cans of green beans given eight hours in a slow cooker. They were
     cooked in the can before they went in. */
  { id: 199, step: 0, set: 'Place the stewing beef, quartered potatoes and tomato sauce in the slow cooker. Keep the green beans out — they are cooked already, in the can, and eight hours turns them to threads.' },
  { id: 199, step: 1, set: 'Cook on LOW for 8 hours until the beef falls apart, then stir the drained green beans through and give them 10 minutes to warm.' },

  /* A pudding with no milk. The packet guard missed this one because the
     ingredient says "1 pkg vanilla pudding" and not "pudding mix" — which is
     why the guard now matches both. */
  { id: 210, ing: ['3 ripe bananas (sliced)', '1 pkg vanilla pudding mix', '2 cups milk', '1 cup oats', '½ cup butter', '¼ cup sugar'] },
  { id: 210, step: 1, set: 'Whisk the pudding mix with the 2 cups of cold milk for two minutes until it thickens, then layer it with the banana slices in the dish.' },

  /* Flour, peanut butter and butter, and nothing else. That is not a cookie
     dough — it is 1½ cups of dry flour with half a cup of fat, which will not
     come together into a ball however long you mix it. It wants sugar, an
     egg and a raising agent, and then it is a thumbprint cookie. */
  {
    id: 213,
    time: '25 mins',
    ing: ['1.5 cups flour', '½ cup peanut butter', '½ cup butter (softened)', '¾ cup sugar',
      '1 egg', '½ tsp baking powder', 'salt', '¼ cup strawberry jam'],
    steps: [
      'Heat the oven to 350°F.',
      'Beat the softened butter, peanut butter and sugar together until light, then beat in the egg.',
      'Stir in the flour, baking powder and a pinch of salt until it comes together into a soft dough. Flour and fat alone will not — it needs the sugar and the egg to bind, which is the difference between a dough and a bowl of crumbs.',
      'Roll into 12 balls, set them well apart on a lined sheet, and press a deep thumbprint into each.',
      'Spoon jam into the hollows and bake 12 to 14 minutes, until the edges are set and just colouring. They firm up as they cool.'
    ]
  },

  /* Cocoa on the ingredient list and never used, and the milk doing the work
     of both. */
  { id: 214, step: 1, set: 'Mix in the cocoa and the milk until it comes together into a fudgy dough that holds a shape when squeezed. Add the milk a teaspoon at a time — too much and it will not hold a stick.' },

  /* You cannot melt cocoa powder. Cocoa is a dry powder and butter and sugar
     alone will seize into a paste; it needs liquid to become a sauce you can
     dip a banana in. */
  { id: 220, ing: ['2 bananas (halved)', '¼ cup cocoa powder', '¼ cup butter', '¼ cup sugar',
    '2 tbsp milk', '4 wooden sticks'] },
  { id: 220, step: 1, set: 'Melt the butter in a small pan over low heat, then whisk in the sugar, the cocoa and the milk until it is glossy and pours off the spoon in a ribbon. Cocoa is a dry powder — without the milk it seizes into a paste you cannot dip anything in.' },
];
