/*
 * Section 6 of Around the Table — "Worth the Afternoon".
 *
 * These twelve are NOT from the original recipe books. They were written to
 * fill a hole the data made obvious: across the original 225 recipes, none has
 * more than four steps, none uses yeast, and nothing asks you to knead, braise,
 * temper an egg or thicken a sauce. "In-Depth" almost always meant "leave it in
 * the slow cooker", never "this takes attention".
 *
 * Every ingredient is checked against the storehouse order list, so eleven of
 * the twelve are storehouse-only. The exception is cocoa powder, flagged as a
 * pantry extra — the storehouse carries hot cocoa mix, which is not the same
 * thing and would not work here.
 *
 * Macros are estimated from the ingredients like the rest of Around the Table,
 * and are labelled as estimates in the app.
 *
 * ---------------------------------------------------------------------------
 * Section 9, "Warm Drinks", was added later and for a different reason.
 *
 * Every high-protein drink in Run and Not Be Weary runs on whey, Crio Bru or
 * both, and the storehouse stocks neither. Once the pantry data was corrected
 * to say so, the only storehouse-pure hot drink left in either volume was Hot
 * Cocoa & Marshmallow Cups, which carries four grams of protein and scores 62.
 * That is a hole where a person is most likely to want one filled: the drink
 * you make at nine at night.
 *
 * All six run on non-fat dry milk, which is on the order list, is 36% protein
 * by weight, and has been used for its protein in bread and porridge for a
 * hundred years. Stirred into milk or hot water it takes a mug of cocoa from
 * four grams of protein to seventeen.
 *
 * They score 71 to 80, and they cannot do better. Whey is 80% protein with
 * almost no carbohydrate; dry milk is 36% protein and 52% carbohydrate, which
 * caps a storehouse-only drink at about 40% of its energy from protein. High
 * seventies is the ceiling of the ingredients, not a shortfall in the recipes.
 *
 * They sat at the end of Around the Table for a year, away from the drinks
 * they were written to replace, and the reason was real: a recipe's printed
 * number was its id, favourites and meal plans are keyed by id and synced
 * between phones, and inserting six into Volume One would have renumbered
 * everything after them and silently repointed somebody's saved favourites at
 * other recipes.
 *
 * That is no longer true. The printed number is `no` now and the id is left
 * alone, so a recipe can be moved, renumbered and reprinted without touching
 * anything a phone has saved — which is what the separation was for. So they
 * are where they belong: Power Drinks, in the volume built on protein, beside
 * the seven that need whey and Crio Bru and cannot be made from the order
 * sheet at all.
 *
 * ---------------------------------------------------------------------------
 * Section 10, "Made, Not Bought", came out of counting what actually blocks a
 * recipe. Fourteen ingredients across the collection are not on the storehouse
 * order list, and four of them are the only thing standing between a recipe and
 * a week with no shopping trip at all:
 *
 *   cocoa powder     12 recipes    not makeable — cocoa mix is sugar and milk
 *   BBQ sauce         5 recipes    makeable
 *   gravy mix         5 recipes    makeable
 *   chocolate chips   5 recipes    not makeable
 *   light mayo        3 recipes    makeable
 *
 * The three that are makeable are here. Nothing in them is a substitute in the
 * apologetic sense — a bottle of BBQ sauce is ketchup, sugar, vinegar and onion
 * with the water boiled out of it, and a packet of gravy mix is browned flour
 * and salt. The storehouse carries every part of both.
 *
 * The order list has no vinegar and no black pepper, which is worth knowing
 * before you look at the ingredients and wonder. Ketchup and mustard both carry
 * enough vinegar to do the job, and celery salt covers more ground than it
 * sounds like it should.
 *
 * Once you are making them, put BBQ sauce and gravy back on your Pantry page.
 * The ten recipes that call for them stop asking you to go out.
 */

const SECTION = 'Worth the Afternoon';
const COPYCAT = 'The Copycat Shelf';
const CHOC = 'For the Love of Chocolate';
const DRINKS = 'Warm Drinks';
const MADE = 'Made, Not Bought';

module.exports = [
  {
    id: 226, book: 2, secNum: 6, secName: SECTION,
    name: 'Everyday White Bread',
    servings: '2 Loaves (24 Slices)', servN: 24,
    ing: ['5 cups white flour', '1.75 cups warm water', '1 packet yeast', '2 tbsp sugar',
      '3 tbsp non-fat dry milk', '2 tsp salt', '3 tbsp melted butter'],
    steps: [
      'Stir the yeast and sugar into the warm water — warm as a bath, not hot, or it will kill the yeast. Leave it 10 minutes until it foams. If nothing happens, the yeast is dead and it is worth starting again.',
      'Whisk the flour, dry milk and salt together in a large bowl.',
      'Pour in the yeast water and the melted butter. Stir until it comes together into a shaggy, untidy dough.',
      'Turn it onto a floured counter and knead 8 to 10 minutes, adding only enough flour to stop it sticking. It is ready when it is smooth and springs back when you press it.',
      'Put it in a buttered bowl, cover with a cloth, and leave somewhere warm about an hour, until doubled.',
      'Press it down, divide in two, and shape each half into a loaf. Set in buttered pans, cover, and rise again 40 minutes until domed above the rim.',
      'Bake at 375°F for 30 to 35 minutes. It is done when the top is deep gold and the bottom sounds hollow when tapped.',
      'Turn out onto a rack and let it cool before slicing. Cutting it hot tears the crumb.',
    ],
    macro: null, tagline: 'Two Loaves, One Afternoon', score: null, sc: null,
    diff: 'In-Depth', time: '2 hrs 30 mins', extras: null,
  },
  {
    id: 227, book: 2, secNum: 6, secName: SECTION,
    name: 'Soft Buttered Dinner Rolls',
    servings: '15 Rolls', servN: 15,
    ing: ['4 cups white flour', '1.25 cups warm milk', '1 packet yeast', '¼ cup sugar',
      '1 egg', '¼ cup butter', '1.5 tsp salt'],
    steps: [
      'Warm the milk until it is just body temperature. Stir in the yeast and a spoonful of the sugar, and leave 10 minutes until foamy.',
      'Beat the egg with the rest of the sugar and the softened butter.',
      'Combine the flour and salt, then add both the yeast milk and the egg mixture. Mix to a soft dough.',
      'Knead 8 minutes until smooth. This dough stays softer and tackier than bread dough — resist adding much more flour.',
      'Cover and rise 1 hour until doubled.',
      'Divide into 15 pieces. Roll each into a ball under a cupped hand and set them just touching in a buttered dish.',
      'Cover and rise 35 minutes, until they are puffed and pressing against each other.',
      'Bake at 375°F for 15 to 18 minutes until golden. Brush the tops with butter the moment they come out.',
    ],
    macro: null, tagline: 'Pull-Apart Soft', score: null, sc: null,
    diff: 'In-Depth', time: '2 hrs 15 mins', extras: null,
  },
  {
    id: 228, book: 2, secNum: 6, secName: SECTION,
    name: 'Cinnamon Rolls with Vanilla Glaze',
    servings: '12 Rolls', servN: 12,
    ing: ['4 cups white flour', '1 cup warm milk', '1 packet yeast', '½ cup sugar',
      '1 egg', '½ cup butter', '1 tsp salt', '½ cup brown sugar', '2 tbsp cinnamon',
      '1 cup powdered sugar', '1 tsp vanilla'],
    steps: [
      'Warm the milk, stir in the yeast and a spoonful of the sugar, and leave 10 minutes until foamy.',
      'Mix the flour, salt and half the sugar. Add the yeast milk, the egg, and half the butter, softened. Knead 8 minutes to a soft, smooth dough.',
      'Cover and rise 1 hour until doubled.',
      'Roll the dough into a rectangle about 12 by 16 inches, keeping the corners square so the rolls come out even.',
      'Spread the remaining softened butter right to the edges, then scatter over the brown sugar, the rest of the sugar, and the cinnamon.',
      'Roll it up from the long side, snug but not tight. Cut into 12 with a length of thread slid underneath and crossed over — a knife squashes them.',
      'Set cut side up in a buttered dish, cover, and rise 40 minutes until they touch.',
      'Bake at 350°F for 25 to 28 minutes until the middles are cooked through.',
      'Stir the powdered sugar with the vanilla and a spoonful of milk into a pourable glaze, and pour it over while the rolls are still warm.',
    ],
    macro: null, tagline: 'Saturday Morning, Properly', score: null, sc: null,
    diff: 'In-Depth', time: '2 hrs 45 mins', extras: null,
  },
  {
    id: 229, book: 2, secNum: 6, secName: SECTION,
    name: 'Scratch Biscuits & Sausage Gravy',
    servings: '6 Servings (2 Biscuits Each)', servN: 6,
    ing: ['3 cups white flour', '4 tsp baking powder', '1 tsp salt', '½ cup cold butter',
      '1.25 cups milk', '1 lb pork sausage', '¼ cup white flour', '3 cups milk', 'black pepper'],
    steps: [
      'Rub the cold butter into the flour, baking powder and salt until it looks like coarse crumbs with some pea-sized pieces left. Cold butter is what makes the layers.',
      'Stir in the milk just until it holds together. Handle it as little as you can.',
      'Pat the dough out, fold it over on itself three times, then pat to about an inch thick and cut out 12 rounds. Press the cutter straight down — twisting seals the edge and stops the rise.',
      'Bake at 450°F for 12 to 14 minutes until risen and browned.',
      'Meanwhile, brown the sausage in a wide pan, breaking it up. Leave the fat in the pan.',
      'Sprinkle the flour over the sausage and cook it 2 minutes, stirring. This is the step people skip, and it is why gravy tastes of raw flour.',
      'Pour in the milk a splash at a time, stirring smooth after each addition.',
      'Simmer gently 5 to 8 minutes until it coats a spoon. Season well with black pepper — it needs more than you think.',
      'Split the hot biscuits and ladle the gravy over.',
    ],
    macro: null, tagline: 'Sunday Breakfast, The Long Way', score: null, sc: null,
    diff: 'In-Depth', time: '50 mins', extras: null,
  },
  {
    id: 230, book: 2, secNum: 6, secName: SECTION,
    name: 'Braised Beef with Onion Gravy',
    servings: '6 Servings', servN: 6,
    ing: ['2 lbs stewing beef', '2 onions', '2 tbsp vegetable oil', '3 tbsp white flour',
      '3 cups water', '2 lbs potatoes', '¼ cup butter', '½ cup milk', 'salt', 'black pepper'],
    steps: [
      'Pat the beef dry and salt it well. Dry meat browns; wet meat steams.',
      'Heat the oil until it shimmers and brown the beef hard on all sides, in two or three batches so the pan stays hot. Set it aside.',
      'Turn the heat down, add the sliced onions, and cook them 12 to 15 minutes until deep golden and sweet, scraping up the brown bits as they release.',
      'Sprinkle over the flour and cook 1 minute more.',
      'Pour in the water a little at a time, stirring, until you have a smooth gravy.',
      'Return the beef and any juices. Cover and cook at the barest simmer for 2½ hours, until a piece falls apart under a fork. It cannot be rushed — high heat makes it tough, not tender.',
      'Boil the potatoes 20 minutes, then mash with the butter and warmed milk.',
      'Taste the gravy and season. Spoon the beef and plenty of gravy over the mash.',
    ],
    macro: null, tagline: 'Falls Apart Under a Fork', score: null, sc: null,
    diff: 'In-Depth', time: '3 hrs 15 mins', extras: null,
  },
  {
    id: 231, book: 2, secNum: 6, secName: SECTION,
    name: 'Chicken Pot Pie with a Scratch Crust',
    servings: '6 Servings', servN: 6,
    ing: ['2.5 cups white flour', '1 tsp salt', '1 cup cold butter', '6 tbsp cold water',
      '1.5 lbs chicken breast', '1 onion', '3 carrots', '1 can green beans',
      '¼ cup white flour', '3 cups milk', 'black pepper'],
    steps: [
      'Rub the cold butter into the flour and salt, leaving some pieces the size of peas — those are what make the crust flaky.',
      'Sprinkle over the cold water and gather into a dough without kneading. Wrap and rest it in the fridge 30 minutes.',
      'Simmer the chicken in salted water about 15 minutes, until it is no longer pink in the middle, then lift out and cut into pieces. Keep a cup of the cooking liquid.',
      'Cook the diced onion and carrot in a little butter 8 minutes until soft.',
      'Stir in the flour and cook 1 minute, then add the milk slowly, stirring, and the reserved cup of chicken liquid.',
      'Simmer until it thickens enough to hold its shape on a spoon. Season well.',
      'Fold in the chicken and the drained green beans and tip it all into a deep dish. Let it cool a little — a hot filling melts the crust before it can set.',
      'Roll the pastry to fit, lay it over, press the edges down and cut two slits in the middle for steam.',
      'Bake at 400°F for 35 to 40 minutes until the crust is deep gold and the filling bubbles at the slits.',
    ],
    macro: null, tagline: 'The Real Thing, Not the Shortcut', score: null, sc: null,
    diff: 'In-Depth', time: '1 hr 45 mins', extras: null,
  },
  {
    id: 232, book: 2, secNum: 6, secName: SECTION,
    name: 'Peach Cobbler with a Biscuit Top',
    servings: '8 Servings', servN: 8,
    ing: ['1 can peaches (drained)', '½ cup sugar', '1 tsp cinnamon', '1 tbsp white flour',
      '1.5 cups white flour', '2 tsp baking powder', '3 tbsp sugar', '6 tbsp cold butter',
      '¾ cup milk'],
    steps: [
      'Toss the drained peaches with the sugar, cinnamon and the tablespoon of flour, along with a few spoonfuls of their syrup.',
      'Tip into a baking dish and put it in the oven at 400°F for 10 minutes, until the fruit is hot and beginning to bubble. Putting the topping on hot fruit is what cooks its underside.',
      'Meanwhile rub the cold butter into the flour, baking powder and sugar until crumbly.',
      'Stir in the milk to make a thick, shaggy batter — lumpy is right.',
      'Drop it in rough spoonfuls over the hot fruit, leaving gaps for the juice to come through.',
      'Scatter a little more sugar over the top for crunch.',
      'Bake 35 minutes more, until the topping is golden and firm in the middle and the juices bubble thickly at the edges.',
      'Let it stand 15 minutes before serving, or the juice will be thin.',
    ],
    macro: null, tagline: 'Bubbling at the Edges', score: null, sc: null,
    diff: 'In-Depth', time: '1 hr', extras: null,
  },
  {
    id: 233, book: 2, secNum: 6, secName: SECTION,
    name: 'Baked Vanilla Custard',
    servings: '6 Servings', servN: 6,
    ing: ['4 eggs', '2.5 cups milk', '½ cup sugar', '2 tsp vanilla', 'salt', '1 tsp cinnamon'],
    steps: [
      'Heat the milk until it steams and shows a few bubbles at the edge. Do not let it boil.',
      'Whisk the eggs, sugar, vanilla and a pinch of salt together until smooth but not frothy — froth turns into bubbles in the finished custard. The vanilla goes in here rather than into the hot milk, where most of it would boil off.',
      'Pour the hot milk into the eggs in a thin stream, whisking the whole time. Adding it all at once will scramble them.',
      'Pour the mixture through a sieve into a jug. This catches anything that did set and is the difference between silky and grainy.',
      'Divide between six dishes and dust the tops with cinnamon.',
      'Stand the dishes in a roasting tin and pour hot water around them to come halfway up. The water bath keeps the heat gentle and even.',
      'Bake at 325°F for 35 to 40 minutes. They are done when set at the edge and still wobbling slightly in the centre — they firm up as they cool.',
      'Lift them out of the water and chill at least 2 hours before serving.',
    ],
    macro: null, tagline: 'Silky, Set, Just Wobbling', score: null, sc: null,
    diff: 'In-Depth', time: '3 hrs', extras: null,
  },
  {
    id: 234, book: 2, secNum: 6, secName: SECTION,
    name: 'Slow Rice Pudding with Raisins',
    servings: '6 Servings', servN: 6,
    ing: ['1 cup rice', '4 cups milk', '⅓ cup sugar', '½ cup raisins', '2 eggs',
      '1 tsp vanilla', '1 tsp cinnamon', 'salt'],
    steps: [
      'Simmer the rice in 2 cups of water with a pinch of salt until the water is gone, about 15 minutes.',
      'Add the milk and sugar and bring it back to the barest simmer.',
      'Cook uncovered 35 to 40 minutes, stirring often and scraping the bottom. This is the whole recipe — stirring is what makes it creamy, and leaving it will catch and scorch.',
      'Stir in the raisins for the last 10 minutes so they plump without dissolving.',
      'Beat the eggs in a small bowl. Add a ladle of the hot pudding to them slowly, whisking, to warm them through.',
      'Take the pan off the heat and stir the egg mixture back in. Off the heat, or it will scramble.',
      'Stir in the vanilla and cinnamon.',
      'Let it stand 10 minutes to thicken. Good warm, better cold the next day.',
    ],
    macro: null, tagline: 'Stirred, Not Hurried', score: null, sc: null,
    diff: 'In-Depth', time: '1 hr 10 mins', extras: null,
  },
  {
    id: 235, book: 2, secNum: 6, secName: SECTION,
    name: 'Real Caramel Sauce',
    servings: '16 Servings (2 Tbsp Each)', servN: 16,
    ing: ['1 cup sugar', '¼ cup water', '6 tbsp butter', '½ cup evaporated milk', 'salt'],
    steps: [
      'Put the sugar and water in a heavy pan over medium heat and let the sugar dissolve without stirring.',
      'Once it is clear, leave it alone. Swirl the pan now and then, but do not stir — stirring makes it crystallise and go grainy.',
      'Cook 8 to 10 minutes until it turns the colour of a copper penny. Watch it closely at the end; it goes from amber to burnt in seconds.',
      'Take it off the heat and add the butter. It will bubble up hard, so stand back and use a long spoon.',
      'Warm the evaporated milk, then pour it in slowly, whisking. Cold liquid into hot sugar will seize it.',
      'Whisk in a good pinch of salt and return to low heat for a minute if any lumps remain.',
      'Cool in a jar. It thickens as it goes cold, and keeps a fortnight in the fridge.',
    ],
    macro: null, tagline: 'Copper-Penny Colour', score: null, sc: null,
    diff: 'In-Depth', time: '25 mins', extras: null,
  },
  {
    id: 236, book: 2, secNum: 6, secName: SECTION,
    name: 'Browned Butter Cocoa Brownies',
    servings: '16 Squares', servN: 16,
    ing: ['¾ cup butter', '1.25 cups sugar', '¾ cup cocoa powder', '2 eggs',
      '1 tsp vanilla', '½ tsp salt', '¾ cup white flour'],
    steps: [
      'Melt the butter in a light-coloured pan and keep cooking it. It will foam, then quieten, then the solids at the bottom will turn golden and smell of nuts — about 5 minutes. That smell is the whole point.',
      'Take it off the heat at once and whisk in the sugar, cocoa and salt while it is still hot.',
      'Let it cool 5 minutes, or the eggs will cook.',
      'Beat in the eggs one at a time, then keep beating for a full minute until the batter turns thick and glossy. That gloss is what gives brownies their papery top.',
      'Stir in the vanilla.',
      'Fold in the flour just until the last streak disappears. Any more and they turn cakey.',
      'Spread in a lined 8-inch pan and bake at 350°F for 25 minutes. A skewer should come out with moist crumbs, not clean.',
      'Cool completely in the pan before cutting. Warm brownies tear.',
    ],
    macro: null, tagline: 'Glossy Top, Fudgy Middle', score: null, sc: null,
    diff: 'In-Depth', time: '45 mins', extras: 'Cocoa Powder',
  },
  {
    id: 237, book: 2, secNum: 6, secName: SECTION,
    name: 'White Bean & Ham Soup',
    servings: '6 Servings', servN: 6,
    ing: ['2 cans great northern beans', '1 lb sliced ham', '1 onion', '3 carrots',
      '2 tbsp butter', '6 cups water', 'black pepper', 'salt'],
    steps: [
      'Dice the ham. Cook it in the butter over medium heat until the edges catch and brown — that browning is most of the flavour in a soup with this few ingredients.',
      'Add the diced onion and carrot and cook 8 minutes until softened.',
      'Pour in the water, scraping the bottom of the pot clean.',
      'Add one can of the beans, drained, and simmer gently 40 minutes.',
      'Mash the second can of beans to a rough paste and stir it in. It thickens the soup without any flour.',
      'Simmer another 10 minutes, until it has body and coats the spoon.',
      'Season with plenty of black pepper, and salt only at the end — the ham is already salty and it is easy to overshoot.',
    ],
    macro: null, tagline: 'Thickened With Its Own Beans', score: null, sc: null,
    diff: 'In-Depth', time: '1 hr 10 mins', extras: null,
  },

  // ======================= The Copycat Shelf ==============================
  {
    id: 238, book: 2, secNum: 7, secName: COPYCAT,
    name: 'Sweet Pork Barbacoa, Cafe Rio Style',
    servings: '10 Servings', servN: 10,
    ing: ['3 lbs pork roast', '1 cup cola', '1 cup brown sugar', '1 cup salsa',
      '2 tsp chili powder', '1 tsp ground cumin', '2 tsp salt', '1 tbsp vegetable oil'],
    steps: [
      'Cut the pork into large chunks and pat them dry. Salt them well and leave them 20 minutes while the oven heats.',
      'Brown the chunks hard in the oil, in batches. Do not crowd the pan — this browning is where the depth comes from and you cannot get it back later.',
      'Put the pork in a slow cooker with half the cola and cook on low 6 hours, until it shreds under a fork.',
      'Drain off and discard the cooking liquid. This is the step that separates the good version from the greasy one.',
      'Shred the meat with two forks and return it to the pot.',
      'Blend the remaining cola, brown sugar, salsa, chili powder and cumin, and pour it over.',
      'Cook another hour on low, uncovered for the last 20 minutes so the sauce tightens and clings.',
      'Taste for salt. Serve in tortillas, over rice, or in a bowl with beans and lettuce.',
    ],
    macro: null, tagline: 'Browned Hard, Then Braised Sweet', score: null, sc: null,
    diff: 'In-Depth', time: '7 hrs 30 mins', extras: 'Cola, Chili Powder, Cumin',
  },
  {
    id: 239, book: 2, secNum: 7, secName: COPYCAT,
    name: 'Cilantro Lime Rice',
    servings: '8 Servings', servN: 8,
    ing: ['2 cups rice', '4 cups water', '2 tbsp butter', '2 tsp salt', '1 lime', 'cilantro'],
    steps: [
      'Rinse the rice under cold water until the water runs clear. Rinsing is what stops it going sticky.',
      'Melt the butter in the pan and stir the drained rice through it for 2 minutes, until the grains look glassy at the edges.',
      'Add the water and salt, bring to a boil, then turn it to the lowest heat and cover.',
      'Cook 18 minutes without lifting the lid, then take it off the heat and leave it covered another 10.',
      'Fluff with a fork, then fold through the juice of the lime and a good handful of chopped cilantro.',
      'Both go in at the end — cooked lime turns bitter and cooked cilantro turns to nothing.',
    ],
    macro: null, tagline: 'Green, Bright, Never Sticky', score: null, sc: null,
    diff: 'Medium', time: '40 mins', extras: 'Lime, Cilantro',
  },
  {
    id: 240, book: 2, secNum: 7, secName: COPYCAT,
    name: 'Creamy Tomatillo Ranch Dressing',
    servings: '12 Servings (2 Tbsp Each)', servN: 12,
    ing: ['1 cup ranch dressing', '½ cup salsa verde', '¼ cup milk', '1 lime', 'cilantro',
      '1 clove garlic'],
    steps: [
      'Put the ranch, salsa verde and milk in a jug.',
      'Add the juice of the lime, a large handful of cilantro and the peeled garlic clove.',
      'Blend until it is completely smooth and pale green.',
      'Thin with a little more milk if it is thicker than pouring cream.',
      'Chill at least an hour before serving — it tastes sharp and disjointed straight away and comes together cold.',
    ],
    macro: null, tagline: 'The Green Dressing', score: null, sc: null,
    diff: 'Easy', time: '1 hr 10 mins', extras: 'Salsa Verde, Lime, Cilantro, Garlic',
  },
  {
    id: 241, book: 2, secNum: 7, secName: COPYCAT,
    name: 'Crispy Buttermilk Fried Chicken',
    servings: '6 Servings', servN: 6,
    ing: ['3 lbs chicken breasts', '2 cups buttermilk', '3 cups white flour', '2 eggs',
      '2 tbsp paprika', '1 tbsp garlic powder', '1 tbsp onion powder', '2 tsp black pepper',
      '1 tsp dried thyme', '1 tsp dried oregano', '1 tsp mustard powder', '1 tbsp salt',
      '4 cups vegetable oil (for frying)'],
    steps: [
      'Cut the chicken into pieces and soak them in the buttermilk for at least 4 hours, or overnight. This is what makes it tender all the way through.',
      'Mix the flour with the paprika, garlic powder, onion powder, pepper, thyme, oregano, mustard powder and salt. Rub the mixture between your fingers so the spices spread evenly.',
      'Beat the eggs with a splash of the buttermilk in a second bowl.',
      'Lift each piece out of the buttermilk, into the flour, into the egg, then back into the flour. The double coat is where the craggy crust comes from.',
      'Let the coated pieces sit 15 minutes. If you fry them straight away the coating slides off.',
      'Heat the oil to 325°F in a deep heavy pan, no more than a third full. Keep a lid nearby.',
      'Fry in small batches 12 to 15 minutes, turning once, until deep gold. Crowding the pan drops the temperature and gives you greasy chicken.',
      'Check the thickest piece reads 165°F inside, then drain on a rack, not on paper — paper steams the bottom soft.',
      'Salt the moment it comes out of the oil.',
    ],
    macro: null, tagline: 'Craggy, Golden, Worth the Mess', score: null, sc: null,
    diff: 'In-Depth', time: '5 hrs', extras: 'Paprika, Garlic Powder, Onion Powder, Thyme, Oregano, Mustard Powder',
  },
  {
    id: 242, book: 2, secNum: 7, secName: COPYCAT,
    name: 'Steakhouse Rolls with Cinnamon Honey Butter',
    servings: '18 Rolls', servN: 18,
    ing: ['4.5 cups white flour', '1.25 cups warm milk', '1 packet yeast', '⅓ cup sugar',
      '1 egg', '¼ cup butter', '2 tsp salt', '½ cup butter', '¼ cup honey',
      '¼ cup powdered sugar', '1 tsp cinnamon'],
    steps: [
      'Warm the milk to blood heat, stir in the yeast and a spoonful of the sugar, and leave 10 minutes until foamy.',
      'Mix in the egg, the remaining sugar, the quarter cup of melted butter and the salt.',
      'Add the flour a cup at a time until you have a soft dough, then knead 8 minutes until smooth.',
      'Cover and rise 1 hour until doubled.',
      'Roll out to half an inch thick and cut into squares — square is the shape that makes these recognisable.',
      'Set them on a tray with room to spread, cover, and rise 45 minutes.',
      'Bake at 350°F for 12 to 14 minutes, only until barely golden. Overbaked, they lose the pillowy middle.',
      'Beat the half cup of soft butter with the honey, powdered sugar and cinnamon until light and whipped.',
      'Brush the hot rolls with butter and serve with the honey butter alongside.',
    ],
    macro: null, tagline: 'Square, Pillowy, Dangerous', score: null, sc: null,
    diff: 'In-Depth', time: '2 hrs 30 mins', extras: null,
  },
  {
    id: 243, book: 2, secNum: 7, secName: COPYCAT,
    name: 'Sticky Finger Sauce',
    servings: '10 Servings (2 Tbsp Each)', servN: 10,
    ing: ['⅔ cup hot sauce', '1.5 cups brown sugar', '2 tbsp water'],
    steps: [
      'Stir the hot sauce, brown sugar and water together in a small pan.',
      'Bring it to a simmer over medium heat, stirring until the sugar has completely dissolved.',
      'Simmer 4 to 5 minutes until it thickens enough to coat the back of a spoon.',
      'Take it off the heat and let it cool slightly — it thickens more as it stands.',
      'Toss it through hot fried chicken pieces just before serving, so the coating stays crisp underneath.',
    ],
    macro: null, tagline: 'Sweet, Hot, Sticky', score: null, sc: null,
    diff: 'Easy', time: '12 mins', extras: 'Hot Sauce',
  },
  {
    id: 244, book: 2, secNum: 7, secName: COPYCAT,
    name: 'Thick Diner-Style Chili',
    servings: '8 Servings', servN: 8,
    ing: ['2 lbs ground beef', '1 onion', '1 can diced tomatoes', '2 cans tomato sauce',
      '1 can pinto beans', '1 can black beans', '3 carrots', '2 tbsp chili powder',
      '1 tsp ground cumin', '2 cups water', 'salt', 'black pepper'],
    steps: [
      'Brown the ground beef in a large pot, breaking it up small. Drain off the fat.',
      'Add the diced onion and grated carrot and cook 8 minutes until soft. The carrot is the secret — it sweetens the chili without any sugar.',
      'Stir in the chili powder and cumin and cook 1 minute, until they smell toasted rather than dusty.',
      'Add the diced tomatoes, tomato sauce and water and bring to a simmer.',
      'Simmer uncovered 45 minutes, stirring now and then, until it has darkened and thickened.',
      'Add both cans of drained beans and simmer another 15 minutes.',
      'Season with salt and plenty of black pepper. It is better the next day, and better again the day after.',
    ],
    macro: null, tagline: 'Better the Next Day', score: null, sc: null,
    diff: 'Medium', time: '1 hr 20 mins', extras: 'Chili Powder, Cumin',
  },
  {
    id: 245, book: 2, secNum: 7, secName: COPYCAT,
    name: 'Country Store Hash Brown Casserole',
    servings: '10 Servings', servN: 10,
    ing: ['3 lbs potatoes', '2 cups cheddar', '1 cup sour cream', '1 can cream of chicken soup',
      '½ cup butter', '1 onion', '1 tsp salt', 'black pepper'],
    steps: [
      'Grate the potatoes coarsely, then squeeze them dry in a clean cloth. Wet potato steams instead of browning and the casserole goes watery.',
      'Melt the butter and stir it through the potatoes with the finely diced onion.',
      'Mix in the sour cream, the soup, half the cheese, the salt and plenty of pepper.',
      'Spread it into a buttered dish without pressing it down — you want air in it.',
      'Scatter the remaining cheese over the top.',
      'Bake at 350°F for 50 minutes, until it is bubbling at the edges and the top is deeply browned.',
      'Rest 10 minutes before serving so it holds together on the spoon.',
    ],
    macro: null, tagline: 'Squeezed Dry So It Crisps', score: null, sc: null,
    diff: 'Medium', time: '1 hr 15 mins', extras: null,
  },
  {
    id: 246, book: 2, secNum: 7, secName: COPYCAT,
    name: 'Pickle-Brined Chicken Sandwiches',
    servings: '6 Sandwiches', servN: 6,
    ing: ['2 lbs chicken breasts', '1 cup pickle juice', '1 cup white flour', '1 egg',
      '½ cup milk', '2 tsp paprika', '1 tsp black pepper', '2 tsp salt',
      '3 cups vegetable oil (for frying)', '6 hamburger buns', '2 tbsp butter'],
    steps: [
      'Slice the chicken breasts flat and pound them to an even thickness so they cook through at the same rate.',
      'Soak them in the pickle juice for 1 hour. Longer than two and the texture turns rubbery.',
      'Beat the egg with the milk. Mix the flour with the paprika, pepper and salt.',
      'Dip each piece in the egg, then press it firmly into the seasoned flour.',
      'Heat the oil to 350°F in a heavy pan.',
      'Fry 3 to 4 minutes a side until deep gold and cooked through, then drain on a rack.',
      'Butter the cut side of the buns and toast them face down in a dry pan until golden — the buttered toast is what keeps the bun from going soggy.',
      'Build with two pickle slices and nothing else. That is the whole point of it.',
    ],
    macro: null, tagline: 'Two Pickles, Nothing Else', score: null, sc: null,
    diff: 'In-Depth', time: '1 hr 40 mins', extras: 'Pickle Juice, Paprika',
  },
  {
    id: 247, book: 2, secNum: 7, secName: COPYCAT,
    name: 'Honey Mustard Dipping Sauce',
    servings: '8 Servings (2 Tbsp Each)', servN: 8,
    ing: ['½ cup mayo', '2 tbsp honey', '1 tbsp mustard', '2 tbsp BBQ sauce'],
    steps: [
      'Whisk the mayo and honey together until completely smooth.',
      'Add the mustard and the barbecue sauce and whisk again. {r:264} makes the barbecue sauce, if there is no bottle.',
      'Taste it. It should be sweet first, tangy second, smoky underneath — adjust with a little more honey or mustard.',
      'Chill 30 minutes before serving.',
    ],
    macro: null, tagline: 'Sweet First, Tangy Second', score: null, sc: null,
    diff: 'Easy', time: '35 mins', extras: 'BBQ Sauce',
  },

  // ==================== For the Love of Chocolate =========================
  {
    id: 248, book: 2, secNum: 8, secName: CHOC,
    name: 'Thick Bakery-Style Chocolate Chip Cookies',
    servings: '12 Large Cookies', servN: 12,
    ing: ['1 cup butter', '1 cup brown sugar', '½ cup sugar', '2 eggs', '2 tsp vanilla',
      '3 cups white flour', '1 tbsp cornstarch', '1 tsp baking soda', '1 tsp salt',
      '2 cups chocolate chips'],
    steps: [
      'Beat the cold butter with both sugars for a full 3 minutes, until pale and fluffy. Cold butter is what keeps these thick instead of spreading flat.',
      'Beat in the eggs one at a time, then the vanilla.',
      'Whisk the flour, cornstarch, baking soda and salt together. The cornstarch is the whole trick — it makes the middle soft and slightly underdone-looking.',
      'Fold the dry into the wet just until the last streak of flour disappears. Overmixing builds gluten and makes them tough.',
      'Fold in the chocolate chips.',
      'Divide into 12 large mounds, roughly 4 oz each, and pile them tall rather than flattening them.',
      'Chill the mounds at least 2 hours, or overnight. Skipping this is the single most common reason cookies come out flat and greasy.',
      'Bake at 400°F for 10 to 12 minutes. Pull them when the edges are set and the middles still look wet and underbaked.',
      'Leave them on the hot tray 10 minutes to finish cooking through, then move to a rack.',
    ],
    macro: null, tagline: 'Tall, Craggy, Molten Middle', score: null, sc: null,
    diff: 'In-Depth', time: '2 hrs 45 mins', extras: 'Chocolate Chips, Cornstarch',
  },
  {
    id: 249, book: 2, secNum: 8, secName: CHOC,
    name: 'Molten Chocolate Lava Cakes',
    servings: '6 Cakes', servN: 6,
    ing: ['1 cup chocolate chips', '½ cup butter', '3 eggs', '½ cup powdered sugar',
      '¼ cup white flour', '1 tsp vanilla', 'salt'],
    steps: [
      'Butter six ramekins heavily and dust them with sugar. Anything less and the cakes will not turn out.',
      'Melt the chocolate chips and butter together over a pan of barely simmering water, stirring until glossy. Do not let the bowl touch the water or the chocolate will seize.',
      'Whisk the eggs with the powdered sugar and a pinch of salt for 2 minutes, until thick and pale.',
      'Fold the warm chocolate into the eggs, then fold in the flour and vanilla.',
      'Divide between the ramekins and chill 30 minutes. You can hold them here for a day.',
      'Bake at 425°F for 11 to 13 minutes. The edges should be set and the centre should still wobble like a jelly.',
      'This is a recipe about timing, not doneness. A minute too long and you have a very good small chocolate cake and no lava.',
      'Rest 1 minute, run a knife round the edge, and turn out onto plates. Serve at once.',
    ],
    macro: null, tagline: 'A Minute Too Long and It Is Just Cake', score: null, sc: null,
    diff: 'In-Depth', time: '55 mins', extras: 'Chocolate Chips',
  },
  {
    id: 250, book: 2, secNum: 8, secName: CHOC,
    name: 'Chocolate Sheet Cake with Fudge Icing',
    servings: '20 Servings', servN: 20,
    ing: ['2 cups white flour', '2 cups sugar', '1 cup butter', '¼ cup cocoa powder',
      '1 cup water', '½ cup sour cream', '2 eggs', '1 tsp baking soda', '1 tsp salt',
      '½ cup butter', '¼ cup cocoa powder', '6 tbsp milk', '4 cups powdered sugar',
      '1 tsp vanilla'],
    steps: [
      'Whisk the flour, sugar and salt together in a large bowl.',
      'Bring the cup of butter, the quarter cup of cocoa and the water to a boil in a pan, then pour it over the flour mixture and stir smooth.',
      'Beat in the sour cream, eggs and baking soda.',
      'Pour into a greased sheet pan — the batter will be thin, which is correct.',
      'Bake at 350°F for 20 minutes, until a skewer comes out clean.',
      'While it bakes, make the icing: boil the half cup of butter, the second quarter cup of cocoa and the milk together.',
      'Take it off the heat and beat in the powdered sugar and vanilla until pourable and glossy.',
      'Pour the icing over the cake while both are still hot. This is the entire point of the recipe — hot icing on hot cake soaks in and sets to a fudgy shell.',
      'Leave to set at least an hour before cutting.',
    ],
    macro: null, tagline: 'Hot Icing, Hot Cake', score: null, sc: null,
    diff: 'In-Depth', time: '1 hr 45 mins', extras: 'Cocoa Powder',
  },
  {
    id: 251, book: 2, secNum: 8, secName: CHOC,
    name: 'Hot Fudge Sauce',
    servings: '12 Servings (2 Tbsp Each)', servN: 12,
    ing: ['½ cup butter', '⅔ cup cocoa powder', '1.5 cups sugar', '1 cup evaporated milk',
      '1 tsp vanilla', 'salt'],
    steps: [
      'Melt the butter in a heavy pan over low heat.',
      'Whisk in the cocoa and cook it 1 minute — cooking the cocoa in fat is what takes the raw, dusty edge off it.',
      'Add the sugar and evaporated milk and stir until the sugar has dissolved completely. Rub a little between your fingers to check for grit.',
      'Bring to a gentle simmer and cook 6 to 8 minutes, stirring, until it thickens and coats a spoon heavily.',
      'Take it off the heat and stir in the vanilla and a pinch of salt.',
      'Serve hot. It thickens to a spoonable fudge in the fridge and keeps two weeks — warm it gently to pour again.',
    ],
    macro: null, tagline: 'Thick Enough to Coat a Spoon', score: null, sc: null,
    diff: 'Medium', time: '20 mins', extras: 'Cocoa Powder',
  },
  {
    id: 252, book: 2, secNum: 8, secName: CHOC,
    name: 'No-Bake Chocolate Oat Cookies',
    servings: '24 Cookies', servN: 24,
    ing: ['2 cups sugar', '½ cup butter', '½ cup milk', '¼ cup cocoa powder',
      '½ cup peanut butter', '3 cups rolled oats', '1 tsp vanilla', 'salt'],
    steps: [
      'Put the sugar, butter, milk and cocoa in a pan and bring to a rolling boil, stirring.',
      'Boil for exactly 1 minute, timed. Under-boiled and they never set; over-boiled and they turn dry and crumbly. This one minute is the whole recipe.',
      'Take it off the heat and stir in the peanut butter and vanilla until smooth.',
      'Stir in the oats and a pinch of salt, working quickly before it starts to set.',
      'Drop spoonfuls onto waxed paper.',
      'Leave them to set at room temperature about 30 minutes. Do not put them in the fridge, which makes them sweat.',
    ],
    macro: null, tagline: 'Boil One Minute, Exactly', score: null, sc: null,
    diff: 'Easy', time: '40 mins', extras: 'Cocoa Powder',
  },
  {
    id: 253, book: 2, secNum: 8, secName: CHOC,
    name: 'Peanut Butter Buckeyes',
    servings: '36 Pieces', servN: 36,
    ing: ['1.5 cups peanut butter', '½ cup butter', '4 cups powdered sugar', '1 tsp vanilla',
      '2 cups chocolate chips'],
    steps: [
      'Beat the peanut butter with the softened butter and vanilla until smooth.',
      'Work in the powdered sugar a cup at a time until you have a stiff dough that holds its shape.',
      'Roll into balls and set them on a tray. Push a toothpick into each one.',
      'Chill 1 hour until firm. Soft balls fall off the stick straight into the chocolate.',
      'Melt the chocolate chips gently over barely simmering water, stirring until glossy.',
      'Hold each ball by its toothpick and dip it into the chocolate, leaving a circle of peanut butter showing at the top — that bare circle is what makes it a buckeye.',
      'Set back on the tray, smooth over the toothpick hole with a fingertip, and chill until firm.',
    ],
    macro: null, tagline: 'The Bare Circle on Top', score: null, sc: null,
    diff: 'Medium', time: '1 hr 45 mins', extras: 'Chocolate Chips',
  },
  {
    id: 254, book: 2, secNum: 8, secName: CHOC,
    name: 'Old-Fashioned Chocolate Fudge',
    servings: '36 Squares', servN: 36,
    ing: ['3 cups sugar', '1 cup evaporated milk', '½ cup butter', '2 cups chocolate chips',
      '1 tsp vanilla', 'salt'],
    steps: [
      'Butter a square pan and line it with a strip of parchment hanging over two sides.',
      'Bring the sugar, evaporated milk and butter to a boil in a heavy pan, stirring constantly.',
      'Boil 5 minutes, still stirring, without letting it catch. Scorched fudge cannot be rescued.',
      'Take it off the heat and tip in the chocolate chips, vanilla and a pinch of salt.',
      'Stir until every chip has melted and the mixture turns thick, glossy and loses its shine at the edges.',
      'Pour into the pan at once and spread it level — it begins setting immediately.',
      'Leave at room temperature 3 hours to set, then lift out and cut into small squares. It is rich enough that small is the right size.',
    ],
    macro: null, tagline: 'Rich Enough That Small Is Right', score: null, sc: null,
    diff: 'In-Depth', time: '3 hrs 30 mins', extras: 'Chocolate Chips',
  },
  {
    id: 255, book: 2, secNum: 8, secName: CHOC,
    name: 'Chocolate Chip Banana Bread',
    servings: '12 Slices', servN: 12,
    ing: ['3 ripe bananas', '½ cup butter', '¾ cup brown sugar', '2 eggs', '1 tsp vanilla',
      '1.75 cups white flour', '1 tsp baking soda', '1 tsp salt', '1 cup chocolate chips'],
    steps: [
      'Mash the bananas well. They should be heavily freckled or nearly black — underripe bananas make bland bread.',
      'Melt the butter and beat it with the brown sugar.',
      'Beat in the eggs and vanilla, then the mashed banana.',
      'Whisk the flour, baking soda and salt together, then fold them in just until combined.',
      'Toss the chocolate chips in a spoonful of flour before folding them through — floured chips stay suspended instead of sinking to the bottom.',
      'Pour into a lined loaf tin and scatter a few more chips on top.',
      'Bake at 350°F for 55 to 60 minutes, covering the top with foil if it darkens too fast.',
      'Cool in the tin 15 minutes, then turn out. Slicing it hot makes it gummy.',
    ],
    macro: null, tagline: 'Chips That Stay Suspended', score: null, sc: null,
    diff: 'Medium', time: '1 hr 20 mins', extras: 'Chocolate Chips',
  },
  {
    id: 256, book: 2, secNum: 8, secName: CHOC,
    name: 'Chocolate Cream Pie',
    servings: '8 Servings', servN: 8,
    ing: ['1.5 cups white flour', '½ cup cold butter', '4 tbsp cold water', '1 tsp salt',
      '¾ cup sugar', '⅓ cup cocoa powder', '¼ cup cornstarch', '3 cups milk', '4 eggs',
      '2 tbsp butter', '2 tsp vanilla'],
    steps: [
      'Rub the cold butter into the flour and salt, add the water, and gather into a dough. Rest it 30 minutes in the fridge.',
      'Roll it out, line a pie dish, prick the base all over and line it with paper and baking weights.',
      'Bake blind at 400°F for 20 minutes, then remove the weights and bake 8 minutes more until dry and sand-coloured. A raw-bottomed cream pie is a sad thing.',
      'Whisk the sugar, cocoa, cornstarch and a pinch of salt in a pan, then whisk in the milk a little at a time so no lumps form.',
      'Cook over medium heat, whisking constantly, until it thickens and bubbles. Let it bubble a full minute — that is what cooks out the starch.',
      'Beat the egg yolks in a bowl, pour in a ladle of the hot mixture while whisking, then return it all to the pan.',
      'Cook 2 minutes more, still whisking, then take off the heat and stir in the butter and vanilla.',
      'Pour into the cooled crust and press plastic wrap directly onto the surface so no skin forms.',
      'Chill at least 4 hours before cutting.',
    ],
    macro: null, tagline: 'No Skin, No Soggy Bottom', score: null, sc: null,
    diff: 'In-Depth', time: '5 hrs 30 mins', extras: 'Cocoa Powder, Cornstarch',
  },
  {
    id: 257, book: 2, secNum: 8, secName: CHOC,
    name: 'Salted Chocolate Chip Cookie Bars',
    servings: '16 Bars', servN: 16,
    ing: ['¾ cup butter', '1 cup brown sugar', '½ cup sugar', '2 eggs', '2 tsp vanilla',
      '2 cups white flour', '1 tsp baking soda', '1 tsp salt', '1.5 cups chocolate chips'],
    steps: [
      'Melt the butter and let it cool for 5 minutes. Melted rather than creamed butter is what makes these chewy instead of cakey.',
      'Beat in both sugars, then the eggs and vanilla, and keep beating a minute until the mixture looks glossy.',
      'Fold in the flour, baking soda and salt just until combined.',
      'Fold through most of the chocolate chips.',
      'Press into a lined square pan and press the remaining chips into the top.',
      'Sprinkle the top with a little coarse salt.',
      'Bake at 350°F for 25 to 28 minutes, until the edges are golden and the middle is barely set.',
      'Cool completely in the pan before cutting — warm, they fall apart.',
    ],
    macro: null, tagline: 'Chewy, Not Cakey', score: null, sc: null,
    diff: 'Medium', time: '50 mins', extras: 'Chocolate Chips',
  },
  {
    id: 258, book: 1, secNum: 6, secName: 'Power Drinks',
    name: 'Vanilla & Cinnamon Steamer',
    servings: '1 Mug', servN: 1,
    ing: ['⅔ cup non-fat dry milk', '1.5 cups hot water', '1 tsp vanilla', '1 tsp cinnamon',
      '1 tsp honey'],
    steps: [
      'Put the dry milk and cinnamon in a mug and add about two tablespoons of cold water. Stir to a smooth paste. This is the whole trick — dry milk tipped straight into hot water seizes into lumps that never come out.',
      'Heat the rest of the water until it steams. Do not boil it; boiled milk skins and tastes scorched.',
      'Pour the hot water in slowly, stirring as you go.',
      'Stir in the vanilla and honey and drink it hot.',
    ],
    macro: null, tagline: 'Paste First, Then the Hot Water', score: null, sc: null,
    diff: 'Easy', time: '4 mins', extras: null,
  },
  {
    id: 259, book: 1, secNum: 6, secName: 'Power Drinks',
    name: 'Fortified Hot Cocoa',
    servings: '1 Mug', servN: 1,
    ing: ['⅔ cup non-fat dry milk', '½ packet hot cocoa mix', '1.5 cups hot water',
      '1 tsp cinnamon'],
    steps: [
      'Stir the dry milk, half the cocoa packet and the cinnamon together in a mug while they are still dry, so the cinnamon has something to cling to.',
      'Add two tablespoons of cold water and work it to a smooth paste with the back of a spoon.',
      'Pour in the hot water a little at a time, stirring, until it is thin enough to drink.',
      'Taste before adding the rest of the packet. Half is usually enough — the dry milk is already sweet, and the second half costs more sugar than it adds flavour.',
    ],
    macro: null, tagline: 'Half the Packet, Four Times the Protein', score: null, sc: null,
    diff: 'Easy', time: '4 mins', extras: null,
  },
  {
    id: 260, book: 1, secNum: 6, secName: 'Power Drinks',
    name: 'Iced Vanilla & Cinnamon Milk',
    servings: '1 Tall Glass', servN: 1,
    ing: ['½ cup non-fat dry milk', '½ cup 2% milk', '1 cup cold water', '1 tsp vanilla',
      '½ tsp cinnamon', 'ice'],
    steps: [
      'Whisk the dry milk and cinnamon into the ½ cup of cold milk until there is not a lump left. Cold takes longer than hot — keep going.',
      'Stir in the water and the vanilla.',
      'Leave it in the fridge 20 minutes if you can. It thickens slightly and the cinnamon stops sitting on top.',
      'Pour over ice.',
    ],
    macro: null, tagline: 'Better After Twenty Minutes Cold', score: null, sc: null,
    diff: 'Easy', time: '5 mins', extras: null,
  },
  {
    id: 261, book: 1, secNum: 6, secName: 'Power Drinks',
    name: 'Morning Oat Steamer',
    servings: '1 Large Mug', servN: 1,
    ing: ['½ cup non-fat dry milk', '¼ cup oat flour', '½ cup 2% milk', '1 cup hot water',
      '1 tsp cinnamon', '1 tsp honey'],
    steps: [
      'Whisk the oat flour, dry milk and cinnamon into the cold milk until smooth.',
      'Pour it into a small pan and bring it up slowly, stirring the whole time. It will thicken as the oat flour cooks — about three minutes.',
      'Thin it with the hot water until it pours rather than mounds. How much you need depends on how fine your oat flour is.',
      'Stir in the honey off the heat. It is breakfast rather than a drink; a spoon is not cheating.',
    ],
    macro: null, tagline: 'Thickens as It Goes', score: null, sc: null,
    diff: 'Easy', time: '8 mins', extras: null,
  },
  {
    id: 262, book: 1, secNum: 6, secName: 'Power Drinks',
    name: 'Salted Brown Sugar Steamer',
    servings: '1 Mug', servN: 1,
    ing: ['½ cup non-fat dry milk', '½ cup 2% milk', '1 cup hot water', '2 tsp brown sugar',
      '1 tsp vanilla', '½ tsp cinnamon', 'pinch salt'],
    steps: [
      'Melt the brown sugar with a splash of the milk in a small pan over low heat, and let it bubble for a minute until it smells like caramel rather than like sugar.',
      'Whisk in the rest of the cold milk, the dry milk, the cinnamon and the salt, off the heat, until smooth.',
      'Add the hot water and bring it back to steaming, stirring. Do not let it boil.',
      'Stir in the vanilla last. Heat drives it off, so anything added earlier is wasted.',
    ],
    macro: null, tagline: 'Let the Sugar Catch First', score: null, sc: null,
    diff: 'Easy', time: '7 mins', extras: null,
  },
  {
    id: 263, book: 1, secNum: 6, secName: 'Power Drinks',
    name: 'Peanut Butter Cocoa',
    servings: '1 Mug', servN: 1,
    ing: ['½ cup non-fat dry milk', '½ packet hot cocoa mix', '2 tsp peanut butter',
      '1.5 cups hot water', '½ tsp cinnamon'],
    steps: [
      'Put the peanut butter in the mug on its own and stir in two tablespoons of the hot water until it loosens into a sauce. Add it to everything else at once and it stays a lump on the bottom.',
      'Stir in the dry milk, the cocoa and the cinnamon.',
      'Add the rest of the hot water slowly, stirring, until it is smooth.',
      'It separates as it stands. Stir it again halfway down the mug.',
    ],
    macro: null, tagline: 'Loosen the Peanut Butter First', score: null, sc: null,
    diff: 'Easy', time: '4 mins', extras: null,
  },
  /* ---- five cold ones -------------------------------------------------
   *
   * The six above are five hot drinks and one iced, which is a section that
   * only works from October. These are the summer half, and the half a person
   * reaches for after something rather than before bed.
   *
   * Same trick underneath: non-fat dry milk is on the order list and is 36%
   * protein, so it is what turns a glass of milk into something worth calling
   * a power drink. Cottage cheese does the same job harder — blended it stops
   * being cottage cheese entirely, and No. 271 carries more protein than any
   * storehouse-only drink in the book.
   *
   * Every one is off the order sheet. Nothing here needs whey, Crio Bru, a
   * protein powder or a trip anywhere.
   */
  {
    id: 267, book: 1, secNum: 6, secName: 'Power Drinks',
    name: 'Banana Malt Milk',
    servings: '1 Tall Glass', servN: 1,
    ing: ['1 frozen banana', '½ cup non-fat dry milk', '½ cup 2% milk', '½ cup cold water',
      '2 tsp honey', '½ tsp cinnamon'],
    steps: [
      'Peel the banana before you freeze it. Frozen in the skin it is a job for a knife and a bad mood.',
      'Blend the banana, dry milk, milk, honey and cinnamon until there is no grain left in it.',
      'It thickens as it stands. Drink it inside ten minutes or add a splash more milk and stir.',
    ],
    macro: null, tagline: 'Freeze the Banana Peeled', score: null, sc: null,
    diff: 'Easy', time: '4 mins', extras: null,
  },
  {
    id: 268, book: 1, secNum: 6, secName: 'Power Drinks',
    name: 'Peanut Butter Banana Shake',
    servings: '1 Tall Glass', servN: 1,
    ing: ['1 frozen banana', '1 tbsp peanut butter', '½ cup non-fat dry milk',
      '1 cup cold water', '½ tsp cinnamon'],
    steps: [
      'Blend everything at once. Peanut butter behaves in a blender the way it does not in a mug — there is nothing to loosen first.',
      'Stop while it is still thick enough to hold the mark of a spoon.',
    ],
    macro: null, tagline: 'Thick Enough to Hold a Spoon Mark', score: null, sc: null,
    diff: 'Easy', time: '4 mins', extras: null,
  },
  {
    id: 269, book: 1, secNum: 6, secName: 'Power Drinks',
    name: 'Apple Pie Milk',
    servings: '1 Tall Glass', servN: 1,
    ing: ['½ cup applesauce', '½ cup non-fat dry milk', '½ cup 2% milk', '½ cup cold water',
      '2 tsp brown sugar', '1 tsp cinnamon', 'ice'],
    steps: [
      'Whisk the dry milk into the applesauce first. It is thick enough to grind the lumps out against the side of the bowl, which milk alone will not do.',
      'Stir in the milk, the brown sugar and the cinnamon.',
      'Pour over ice. Cold and thin, it tastes like the last spoonful of the pie rather than the filling.',
    ],
    macro: null, tagline: 'Start With the Applesauce', score: null, sc: null,
    diff: 'Easy', time: '4 mins', extras: null,
  },
  {
    id: 270, book: 1, secNum: 6, secName: 'Power Drinks',
    name: 'Cold Oat & Cinnamon Milk',
    servings: '1 Tall Glass', servN: 1,
    ing: ['¼ cup oats', '½ cup non-fat dry milk', '1 cup 2% milk', '1 tsp honey',
      '1 tsp cinnamon'],
    steps: [
      'Soak the oats in the cup of milk in the fridge for at least an hour, and overnight if you have it. This is the whole recipe; everything after it takes a minute.',
      'Blend the lot — oats, milk, dry milk, honey and cinnamon — until smooth.',
      'Strain it through a sieve if you want it thin. Skip that and it is closer to a drinkable porridge, which is the better breakfast of the two.',
    ],
    macro: null, tagline: 'Soak It the Night Before', score: null, sc: null,
    diff: 'Easy', time: '5 mins', extras: null,
  },
  {
    id: 271, book: 1, secNum: 6, secName: 'Power Drinks',
    name: 'Chocolate Cottage Cheese Shake',
    servings: '1 Tall Glass', servN: 1,
    ing: ['¾ cup cottage cheese', '1 packet hot cocoa mix', '½ cup 2% milk',
      '1 cup cold water', 'ice'],
    steps: [
      'Blend the cottage cheese with the milk on its own until it is completely smooth. Not nearly — completely. Any curd left at this stage is still there at the end.',
      'Add the cocoa mix and the ice, and blend again. Cottage cheese is doing the work here — it carries more protein than any other drink in this section without any dry milk at all.',
      'Nobody who drinks this can tell it is cottage cheese, which is the only reason it is worth doing.',
    ],
    macro: null, tagline: 'Blend the Curd Out First', score: null, sc: null,
    diff: 'Easy', time: '5 mins', extras: null,
  },
  {
    id: 264, book: 2, secNum: 9, secName: MADE,
    name: 'Everyday BBQ Sauce',
    servings: 'About 1½ Cups (12 × 2 tbsp)', servN: 12,
    ing: ['1 tbsp butter', '½ onion (grated)', '1 cup ketchup', '⅓ cup brown sugar',
      '2 tbsp mustard', '1 tbsp honey', '¼ cup water', '½ tsp salt', '½ tsp celery salt (optional)'],
    steps: [
      'Grate the onion on the coarse side of a box grater — chopped is fine but you will taste the pieces. Cook it in the butter over low heat for 8 minutes, until it has gone soft and slightly gold and stopped smelling sharp. This is the whole difference between this and stirring ketchup into sugar. A bottle gets its depth from smoke flavouring; this gets it from onion cooked past soft, and there is no shortcut on high heat.',
      'Stir in the ketchup, brown sugar, mustard, honey, water, salt and celery salt. There is no vinegar on the storehouse list and none is needed — the ketchup and the mustard between them bring plenty.',
      'Bring it to a bare simmer and leave it there 15 to 20 minutes, stirring now and then so the sugar does not catch on the bottom. It should end up thick enough that a spoon drawn across the pan leaves a line for a second before it closes.',
      'Take it off and let it cool. It thickens again cold, so stop while it still looks slightly loose. In a jar in the fridge it keeps two weeks.',
    ],
    makes: ['bbq_sauce'],
    macro: null, tagline: 'The Onion Does What the Smoke Would', score: null, sc: null,
    diff: 'Easy', time: '30 mins', extras: null,
  },
  {
    id: 265, book: 2, secNum: 9, secName: MADE,
    name: 'Pan Gravy, Brown or Pale',
    servings: 'About 2½ Cups (8 Servings)', servN: 8,
    ing: ['3 tbsp butter (or the fat from the pan)', '3 tbsp flour', '2 cups water (or the juices from the roast)',
      '½ cup milk', '½ tsp salt', '¼ tsp celery salt (optional)'],
    steps: [
      'Melt the butter in a wide pan over medium heat and whisk in the flour. Now decide which gravy you want. For a brown gravy to go with beef, keep whisking for 4 or 5 minutes until it smells like toast and has gone the colour of peanut butter. For a pale gravy for chicken, stop after a minute, while it is still blond. Either way it has to cook — raw flour is the reason packet gravy tastes like paste, and this is the minute that fixes it.',
      'Take the pan off the heat before any liquid goes near it. Add the water a splash at a time, whisking each splash smooth before the next. Hot roux and a cup of cold liquid all at once is exactly how you get lumps, and the first half-cup is the part that matters.',
      'Back on medium heat with the milk stirred in. It will look far too thin for a while and then thicken all at once as it comes to the boil. Let it bubble two minutes to lose the floury edge.',
      'Now salt it. Taste first — if you used the juices off a roast it may need none at all. Too thick, add liquid; too thin, let it simmer down. Do not add more flour to a finished gravy, it will not cook out.',
    ],
    makes: ['gravy_mix'],
    macro: null, tagline: 'Brown the Flour and Nothing Lumps', score: null, sc: null,
    diff: 'Easy', time: '12 mins', extras: null,
  },
  {
    id: 266, book: 2, secNum: 9, secName: MADE,
    name: 'Lighter Mayo',
    servings: 'About 1¼ Cups (10 Servings)', servN: 10,
    ing: ['1 cup cottage cheese', '¼ cup mayo', '1 tsp mustard', '¼ tsp salt'],
    steps: [
      'Blend the cottage cheese on its own until it is not curds any more — a full minute, which is longer than it feels like it should take. Stop early and it stays grainy, and nothing added afterwards will hide that.',
      'Add the mayo, mustard and salt and blend a few seconds more, just enough to bring it together.',
      'Give it an hour in the fridge. It firms up and the cottage cheese taste settles back into the mayo.',
      'It is not mayonnaise and it will not pass off a spoon. In tuna, in egg salad, on a sandwich, it does the same job for about a third of the fat and several times the protein.',
    ],
    makes: ['light_mayo'],
    macro: null, tagline: 'Blend It Longer Than You Think', score: null, sc: null,
    diff: 'Easy', time: '5 mins', extras: null,
  },

  /* Breadcrumbs. The fourth thing in this section, and the one that was most
     obviously missing: two recipes in the book call for half a cup of them and
     the storehouse does not carry a box. Somebody making the meatball feast on
     a Sunday finds that out standing at the counter with the beef already out.

     Bread is on the standard order, so this needs nothing at all. */
  {
    id: 272, book: 2, secNum: 9, secName: MADE,
    name: 'Breadcrumbs, Dry or Soft',
    servings: 'About 1½ Cups (6 Servings)', servN: 6,
    ing: ['6 bread slices', '½ tsp salt'],
    steps: [
      'Decide which kind first. Soft crumbs go into meatballs and meatloaf, where the job is holding moisture. Dry crumbs go on top of things, where the job is going crisp. The same bread makes either.',
      'Soft: tear fresh bread and pulse it a few seconds at a time in a blender. Stale bread will not do this, it powders. Use them the same day — in a covered jar they go mouldy in three.',
      'Dry: slices straight on the oven rack at 300°F for 15 to 20 minutes, turning once, until they snap rather than bend. Cool them completely before crushing, in a blender or in a bag with a rolling pin — warm bread tears instead of shattering.',
      'Dry, faster: an air fryer does the same job in about 6 minutes at 350°F, and does it better, because the moving air dries the bread through instead of toasting the outside first. Give the slices one layer and shake the basket once. Then cool them and put them through a food processor, which is the one thing that gets crumbs even — a blender leaves half of it powder and half of it lumps.',
      'Salt and nothing else. Crumbs seasoned in the jar are a decision made weeks early; unseasoned ones go into anything. Dry crumbs keep a month with the lid on, and heels and crusts are the right bread for this.',
    ],
    makes: ['breadcrumbs'],
    macro: null, tagline: 'The Ends of the Loaf, Kept', score: null, sc: null,
    diff: 'Easy', time: '20 mins', extras: null,
  },

  /* -------------------------------------------------------------------------
   * Five more, chosen by counting.
   *
   * Every ingredient in the collection was ranked by how many recipes want it
   * and whether the storehouse order covers it. These five are the ones the
   * book asks for most often that a cook could make from the order instead —
   * forty-nine recipes between them, and none of them needs anything the
   * standard list does not already carry.
   *
   * They are here for the evening when the tortillas ran out, not as a claim
   * that homemade is better. Two of them are plainly worse than the packet and
   * say so.
   * --------------------------------------------------------------------- */

  /* Seventeen recipes want tortillas — more than any other made-able thing in
     either volume. Three ingredients, all on the order. */
  {
    id: 273, book: 2, secNum: 9, secName: MADE,
    name: 'Flour Tortillas',
    servings: '8 Tortillas', servN: 8,
    ing: ['2 cups flour', '⅓ cup oil', '¾ cup warm water', '1 tsp salt'],
    steps: [
      'Stir the flour and salt, pour in the oil, and rub it through until it looks like damp sand. Oil before water is what keeps them soft; flour that meets water first goes tough.',
      'Add the warm water, bring it together, and knead two minutes until it stops sticking. It should feel like an earlobe — too dry, wet your hands; too sticky, a spoonful of flour.',
      'Cover it and leave it 20 minutes. It is not rising, it is the gluten letting go, and it is the difference between a dough you can roll thin and one that springs back every time.',
      'Divide into 8 balls and roll each as thin as you can, a quarter turn between passes so they stay round. Thin is the whole thing; a thick one is a flatbread.',
      'Dry skillet, medium-high, no oil. About 45 seconds until bubbles rise and the underside freckles, then 30 seconds on the other side. Longer and it is a cracker. Stack them under a towel as they come off — the steam is what softens them.',
    ],
    makes: ['tortilla', 'tortilla_small'],
    macro: null, tagline: 'Rest the Dough or Fight It', score: null, sc: null,
    diff: 'Medium', time: '45 mins', extras: null,
  },

  /* Fourteen recipes call for the box. The box is flour, a raising agent, sugar
     and salt, and this is that in the proportions the box uses. */
  {
    id: 274, book: 2, secNum: 9, secName: MADE,
    name: 'Pancake & Waffle Mix',
    servings: 'About 4 Cups Dry Mix (8 Servings)', servN: 8,
    ing: ['4 cups flour', '3 tbsp sugar', '2 tbsp baking powder', '2 tsp salt'],
    steps: [
      'Whisk all four together thoroughly — a full minute, not a few turns. Baking powder that is not evenly spread makes some pancakes rise and others sit there, and you will not be able to tell which is which until they are in the pan.',
      'Keep it in a jar with the lid on. Six months is fine; after that the baking powder starts giving up and they come out flat.',
      'To use it: 1 cup of mix, 1 cup of milk, 1 egg, 2 tablespoons of melted butter. Stir it until the dry patches are gone and then stop — batter that has been beaten smooth makes tough pancakes. Lumps are correct.',
      'Let the batter stand five minutes before the first one goes in the pan. For waffles, add another tablespoon of oil; a waffle needs more fat than a pancake or it welds itself to the iron.',
      'Medium heat, and turn each pancake when the bubbles on top stop closing over. One flip only.',
    ],
    makes: ['pancake_mix'],
    macro: null, tagline: 'Lumps Are Correct', score: null, sc: null,
    diff: 'Easy', time: '5 mins', extras: null,
  },

  /* Seven recipes open a can of it, and it is a white sauce with chicken in it.
     Cheaper, far less salt, and better — this is the one on the list that is
     genuinely an improvement rather than a substitute. */
  {
    id: 275, book: 2, secNum: 9, secName: MADE,
    name: 'Cream of Chicken Soup',
    servings: 'About 1½ Cups — one can’s worth (6 Servings)', servN: 6,
    ing: ['3 tbsp butter', '3 tbsp flour', '1 cup milk', '½ cup water', '5 oz canned chicken', '½ tsp salt'],
    steps: [
      'Melt the butter over medium heat and whisk in the flour. Let it cook a full minute, bubbling, before anything else happens. Raw flour is what makes a sauce taste like paste, and a minute is all it takes.',
      'Off the heat, add the milk a splash at a time, whisking each one smooth before the next. The first half-cup is the part that decides whether it is lump-free; after that you can pour.',
      'Back on the heat with the water. Stir until it comes to the boil and thickens — it will look thin for a long while and then arrive all at once.',
      'Drain the chicken, break it up small, and stir it in with the salt. Simmer two minutes more.',
      'This is one can. Use it anywhere a recipe opens one, straight in, no dilution. It is thicker than the tin when cold and loosens the moment it is heated.',
      'Half the salt of the canned version and about a third of the price, and unlike most things on this list it is simply better. Keeps four days in the fridge; it does not freeze well, as the sauce splits.',
    ],
    makes: ['cream_soup_chx'],
    macro: null, tagline: 'A White Sauce With Chicken In It', score: null, sc: null,
    diff: 'Easy', time: '12 mins', extras: null,
  },

  /* Seven recipes call for the instant. Potatoes are on the order and cost a
     fraction of the box. */
  {
    id: 276, book: 2, secNum: 9, secName: MADE,
    name: 'Mashed Potatoes, in Place of Instant',
    servings: '4 Servings (About 3 Cups)', servN: 4,
    ing: ['2 lbs potatoes', '½ cup milk', '3 tbsp butter', '1 tsp salt'],
    steps: [
      'Peel and cut the potatoes into pieces of roughly the same size — two inches or so. Uneven pieces mean the small ones are falling apart while the big ones are still hard in the middle.',
      'Start them in cold salted water, not boiling. Dropped into boiling water the outsides cook long before the centres, and you get a lumpy mash however hard you work at it afterwards.',
      'Simmer 15 to 20 minutes, until a knife meets no resistance. Drain them and stand them in the hot empty pan a minute — the steam coming off is water that would otherwise end up in the mash. Warm the milk and butter before they go in; cold dairy stiffens it.',
      'Mash, then stop. Potato has a great deal of starch in it and working it hard turns it to glue — this is the one dish where a stand mixer makes things worse. A masher, a fork, or a ricer if you have one.',
      'Where a recipe wants two cups of instant made up, this quantity stands in for it. It is wetter than the instant and holds together less under a topping, so for a shepherd\u2019s pie let it cool a little first.',
    ],
    makes: ['instant_potato', 'mashed_potato'],
    macro: null, tagline: 'Cold Water, Warm Milk', score: null, sc: null,
    diff: 'Easy', time: '30 mins', extras: null,
  },

  /* Four recipes finish with syrup. It is sugar and water. */
  {
    id: 277, book: 2, secNum: 9, secName: MADE,
    name: 'Pancake Syrup',
    servings: 'About 1 Cup (8 Servings)', servN: 8,
    ing: ['1 cup brown sugar', '½ cup water', '2 tbsp butter'],
    steps: [
      'Brown sugar and water into a small pan. Stir it over medium heat only until the sugar has gone — after that, leave it alone. Stirring a boiling sugar syrup is how it turns grainy.',
      'Let it boil three minutes without touching it. It will look far too thin. Sugar syrup does almost all of its thickening as it cools, and a syrup that looks right in the pan sets like a toffee in the jug.',
      'Off the heat, stir in the butter until it disappears. That is what makes it taste like syrup rather than like sweet water.',
      'It thickens as it cools and keeps a month in the fridge. Warm it before it goes on anything — cold syrup on a hot pancake is a bad trade.',
      'It is not maple and does not pretend to be. What it is, is the difference between pancakes and no pancakes on a morning when the bottle is empty.',
    ],
    makes: ['syrup'],
    macro: null, tagline: 'Three Minutes and Leave It Alone', score: null, sc: null,
    diff: 'Easy', time: '8 mins', extras: null,
  },
];
