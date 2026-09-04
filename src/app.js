/* ---------------------------------------------------------------------------
 * Hive & Hearth Recipes
 * Browse, plan a week, build a shopping list, print the book.
 * ------------------------------------------------------------------------- */
(function () {
  'use strict';

  /* Which build this is, read off the ?v= that index.html loads this file with,
     so it can never drift from the truth by being forgotten. Shown in the
     Sharing sheet: when a change is pushed and a phone still looks the same,
     that number answers whether the phone has it yet or the deploy is late. */
  var BUILD = (function () {
    var s = document.querySelector('script[src*="app.js"]');
    var m = s && /[?&]v=([\w.-]+)/.exec(s.getAttribute('src') || '');
    return m ? m[1] : 'dev';
  })();

  /* What the collection is called, in one place. It appears on both covers,
     both title pages, both back covers, the browser tab and the home screen,
     and it has already been renamed once — a volume in this repository went
     from Strong & Simple to Run and Not Be Weary and the change had to be
     chased through nine files. Not twice. */
  var APP_NAME = 'Hive & Hearth';
  var APP_LINE = 'Recipes';           // the second line on a cover

  var BASE = window.RECIPES || [];    // the 271 in the two printed books
  var SHOP = window.SHOP || {};       // food key -> shopping-list name and unit
  var RECIPES = BASE;                 // those, with your changes, plus your own
  var BY_ID = {};

  /* The printed recipes are read-only; a change to one is stored beside it and
     laid over the top here, so the book's own version is never lost and can be
     put back by deleting the change. Recipes written here follow after. */
  function rebuild() {
    var st = window.Store.state;
    var edits = st.edits || {}, mine = st.mine || {};
    RECIPES = BASE.map(function (r) {
      return edits[r.id] ? Object.assign({}, r, edits[r.id], { id: r.id, edited: true }) : r;
    });
    Object.keys(mine).map(function (k) { return mine[k]; })
      .sort(function (a, b) {
        return String(a.secName).localeCompare(String(b.secName)) || String(a.id).localeCompare(String(b.id));
      })
      .forEach(function (r) { RECIPES.push(r); });
    BY_ID = {};
    var n = 0;
    RECIPES.forEach(function (r) {
      if (r.book === 3) r.no = ++n;
      BY_ID[r.id] = r;
    });
    mBuildFoods();          // and the plain foods, addable but never shelved
  }

  /* The hundred and seventeen plain foods the recipes are costed from, made
     addable in their own right.
   *
     A day rarely divides into six whole recipes. What fills the last two
     hundred calories is a spoon of honey, an apple, half a tin of tuna — and
     until now the only way to log one was to find a recipe that happened to
     contain it. The food table was already in the browser, being used to
     price everything else; it just had no door.
   *
     They are shaped as recipes so nothing downstream has to learn a second
     kind of thing — the totals, the copy, the pins, the dials all keep
     working — but they are NOT in RECIPES, so they never appear in the
     collection, the printed book or the shopping list, none of which are
     about a spoon of honey. */
  var MFOODS = [];

  function mFoodName(key, f) {
    if (f.label) return f.label;
    return key.replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); });
  }

  /* Which unit to call one of. Aim near a hundred and thirty calories: a cup
     of milk, a tablespoon of honey, one apple — rather than a cup of butter
     or a tablespoon of milk, which is what any single fixed unit produces. */
  function mFoodServing(f) {
    /* Where the table says what a portion of this IS, that is the answer, and
       it was being ignored. Twenty-eight foods carry a `def` written by
       somebody who knew the food, and the guess below was overruling all of
       them: cheddar came out as "1 whole" — a whole cheddar cheese — because
       a 28 g slice happened to land nearest the calorie target, and ketchup,
       mustard, soy and hot sauce all defaulted to a CUP.
     *
       Only the unit is taken, not the quantity. A `def` of half a cup means
       half of the unit this food is counted in, and the portion is the
       stepper's business — the fit scorer picks it against the day, the way
       it does for everything else. What the table settles here is the WORD:
       cheese is measured in cups, ketchup in spoons, and neither of them
       comes as a whole one. */
    if (f.def && f.def.unit && f.g && f.g[f.def.unit]) {
      return { unit: f.def.unit, grams: f.g[f.def.unit] };
    }
    var units = f.g || {};
    var best = null;
    Object.keys(units).forEach(function (u) {
      var grams = units[u];
      if (!grams) return;
      var kcal = (f.kcal || 0) * grams / 100;
      var miss = Math.abs(kcal - 130) + (u === 'each' ? -25 : 0);   // a whole one reads best
      if (!best || miss < best.miss) best = { unit: u, grams: grams, miss: miss };
    });
    return best || { unit: 'g', grams: 100 };
  }

  /* Food you ate that no book and no table has heard of.
   *
     The collection is a cookbook and the food table is what its recipes are
     costed from; neither has heard of a tamale bought from a cart. But the
     day has to add up, and a plate you cannot log is a plate that quietly
     makes every number on the screen wrong. So: a name, whatever you know of
     its macros, and it joins the single foods for good — typed once, tapped
     ever after. */
  function mReadMyFoods() {
    try {
      var v = JSON.parse(localStorage.getItem('bsc.myFoods'));
      if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    } catch (e) { /* private mode or corrupt */ }
    return {};
  }
  function mWriteMyFoods(v) {
    try { localStorage.setItem('bsc.myFoods', JSON.stringify(v)); }
    catch (e) { /* private mode: this session only */ }
    mStamp('mf');
  }

  /* A star, kept where the thing it stars is kept.
   *
     The book's favourites belong to the household — everyone on the code sees
     the same stars, which is the point of them. Your own foods do not: they
     live in your account, and putting "f:my:chicken_tamale" into the shared
     document to mark it would post the name of your food to everybody with
     the code. So a personal food carries its own star, in its own record. */
  function mIsFav(r) {
    return r.food ? !!r.fav : window.Store.isFav(r.id);
  }

  function mToggleFav(r) {
    if (!r.food) { window.Store.toggleFav(r.id); return; }
    var key = String(r.id).indexOf('f:my:') === 0 ? String(r.id).slice(5) : '';
    if (!key) return;                   // a table food is not yours to star
    var mine = mReadMyFoods();
    if (!mine[key]) return;
    mine[key].fav = !mine[key].fav;
    mWriteMyFoods(mine);
    mBuildFoods();
  }

  function mBuildFoods() {
    MFOODS = [];
    var mine = mReadMyFoods();
    Object.keys(mine).forEach(function (key) {
      var f = mine[key];
      if (!f || typeof f !== 'object') return;
      /* A meal you kept to yourself remembers what went into it. The parts
         ride along as their own list so the plate can open and show them
         (a salad that was five things and became one line was the complaint),
         and they double as the ingredient lines the search reads, so "beans"
         still finds the salad they went into. */
      var parts = Array.isArray(f.parts) ? f.parts.filter(function (pt) {
        return pt && typeof pt === 'object' && pt.name;
      }).map(function (pt) {
        return { id: pt.id, x: Number(pt.x) || 1, name: String(pt.name),
          unit: String(pt.unit || 'serving') };
      }) : [];
      var name = String(f.name || 'Something');
      var rec = {
        id: 'f:my:' + key, food: true, book: 0, secNum: 0, secName: 'Single foods',
        name: name, servings: '1 ' + String(f.unit || 'serving'),
        servN: 1, unit: String(f.unit || 'serving'),
        ing: parts.length ? parts.map(function (pt) {
          return fmtNum(pt.x) + ' × ' + pt.unit + ' ' + pt.name;
        }) : [name],
        parts: parts,
        steps: [], est: true, score: null, diff: 'Easy', time: '0 mins', fav: !!f.fav,
        macro: { kcal: Number(f.kcal) || 0, p: Number(f.p) || 0,
          c: Number(f.c) || 0, f: Number(f.f) || 0,
          na: Number(f.na) || 0, fib: Number(f.fib) || 0 }
      };
      MFOODS.push(rec);
      BY_ID[rec.id] = rec;
    });
    var N = window.Nutrition;
    if (!N || !N.FOODS) return;
    Object.keys(N.FOODS).forEach(function (key) {
      var f = N.FOODS[key];
      if (!f || f.split || !(f.kcal > 0 || f.p > 0)) return;      // 'free' stands for seasonings
      var sv = mFoodServing(f);
      var per = sv.grams / 100;
      var name = mFoodName(key, f);
      /* grams rides along so a plate can say "1 cup · 130 g": a unit alone
         is a meaningful portion for an egg, not for "1 serving" of beans. */
      MFOODS.push({
        id: 'f:' + key, food: true, side: !!f.side, eat: !!f.eat, book: 0, secNum: 0, secName: 'Single foods',
        name: name, servings: '1 ' + sv.unit, servN: 1, unit: sv.unit, grams: sv.grams,
        ing: [name], steps: [], est: true, score: null, diff: 'Easy', time: '0 mins',
        macro: {
          kcal: Math.round((f.kcal || 0) * per), p: Math.round((f.p || 0) * per * 10) / 10,
          c: Math.round((f.c || 0) * per * 10) / 10, f: Math.round((f.f || 0) * per * 10) / 10,
          na: Math.round((f.na || 0) * per), fib: Math.round((f.fib || 0) * per * 10) / 10
        }
      });
      BY_ID[MFOODS[MFOODS.length - 1].id] = MFOODS[MFOODS.length - 1];
    });
    MFOODS.sort(function (a2, b2) { return a2.name.localeCompare(b2.name); });
  }

  var DAYS = [
    ['mon', 'Monday', 'Mon'], ['tue', 'Tuesday', 'Tue'], ['wed', 'Wednesday', 'Wed'],
    ['thu', 'Thursday', 'Thu'], ['fri', 'Friday', 'Fri'], ['sat', 'Saturday', 'Sat'],
    ['sun', 'Sunday', 'Sun']
  ];

  /* The Macros tab's default meals. Slots organize the day; the arithmetic is
     daily — a breakfast is not scolded for failing to be a whole day. The
     day's actual meal list is the reader's to shape under Craft my plan
     (a morning brew, an afternoon snack, one before bed); these four are only
     where everyone starts, and their keys are load-bearing — days already
     saved under b/l/d/s must keep meaning what they meant. [key, name, type] */
  var MSLOT_DEFS = [['b', 'Breakfast', 'b'], ['l', 'Lunch', 'l'], ['d', 'Dinner', 'd'], ['s', 'Snacks', 's']];

  /* Which sections count as "this meal" in the picker's default filter, keyed
     book-secNum. Not a new field on the recipes: the sections are already
     meal-shaped, and a map here can be corrected without a data rebuild. The
     snack list is broad on purpose — a treat is a snack, and the fit ranking
     is what sinks it on a cut, not the filter. */
  var MEAL_SECS = {
    b: ['1-1', '2-1'],
    l: ['1-3', '2-2'],
    d: ['1-4', '2-3', '2-4'],
    s: ['1-2', '1-5', '1-6', '2-5', '2-6', '2-7', '2-8']
  };

  var BOOKS = {
    1: {
      /* Doctrine and Covenants 89:20 — the Word of Wisdom's own promise, and the
         only name on the shelf where the title and the food make the same claim.
         What protein and fiber buy you is the afternoon. */
      name: 'Run and Not Be Weary', short: 'RUN',
      blurb: '{N1} recipes built on protein, fiber and staying full, with primary ingredients from the bishops’\u00a0storehouse. Every one carries real macros and a computed nutrition score.',
      epigraph: {
        t: ['And shall run and not be weary,', 'and shall walk and not faint.'],
        r: 'Doctrine and Covenants 89:20',
      },
    },
    2: {
      name: 'Around the Table', short: 'TABLE',
      blurb: '{N2} family recipes with primary ingredients from the bishops’\u00a0storehouse: three‑minute breakfasts to Sunday roasts, by way of an afternoon at the stove, the restaurant favourites worked out at home, and a section for chocolate alone.',
      epigraph: {
        t: ['And did eat their meat with gladness', 'and singleness of heart.'],
        r: 'Acts 2:46',
      },
    },
    3: {
      name: 'Ours', short: 'OURS',
      blurb: 'The ones we worked out ourselves, or were given, or changed until they were right. This volume grows; the other two do not.'
    }
  };

  /* The combined edition. Not a fourth volume — the same recipes as one object,
     for anyone spiral-binding them rather than folding two booklets. It needs
     its own cover copy because every word of Volume One's is about being one
     of two. */
  var ONE_BOOK = {
    name: APP_NAME + ' ' + APP_LINE,
    blurb: '{N} recipes with primary ingredients from the bishops\u2019\u00a0storehouse, ' +
      'in two parts: {n1} built on protein and fiber, and {n2} for the family table.',
    epigraph: {
      t: ['And shall run and not be weary,', 'and shall walk and not faint.'],
      r: 'Doctrine and Covenants 89:20',
    },
  };

  /* And the same courtesy for the view that is not a book. Someone opening the
     app for the first time lands here, and until this line existed the whole
     answer to "what are the two volumes" was the words "two volumes" in the
     bar at the top. */
  var COLLECTION_BLURB = 'Two volumes, with primary ingredients from the bishops’\u00a0storehouse. Run and ' +
    'Not Be Weary is {n1} recipes built on protein and fiber; Around the Table is {n2} ' +
    'family recipes, from three-minute breakfasts to Sunday roasts.';

  /* ------------------------------------------------------------------------
   * The counts in those four blurbs.
   *
   * Every one of them used to be typed out — "One hundred recipes", "One
   * hundred sixty-six", "Two hundred and seventy-one" — and every one of them
   * was correct on the day it was written. Then six drinks were added, then
   * five more, and the numbers stayed where they were: the browse heading said
   * a hundred while the count under it said a hundred and eleven, and the same
   * wrong sentence was printed on the cover and the title page of the book. A
   * number nobody can see going stale, on the one page you pay a copy shop to
   * make permanent.
   *
   * So the blurbs hold a token and the collection holds the number. {n1} and
   * {n2} are the two volumes, {n} is whatever is being printed; the capital
   * forms start a sentence. The rest of the app already counts this way —
   * the header, the browse count, the contents page — and these were the last
   * four places carrying a second copy of the answer.
   * --------------------------------------------------------------------- */
  var ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
    'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
    'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  var TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy',
    'eighty', 'ninety'];

  function spell(n) {
    n = Math.max(0, Math.round(n || 0));
    if (n > 999) return String(n);         // no book is going to reach this
    var small = function (x) {
      if (x < 20) return ONES[x];
      return TENS[Math.floor(x / 10)] + (x % 10 ? '-' + ONES[x % 10] : '');
    };
    if (n < 100) return small(n) || 'no';
    var h = ONES[Math.floor(n / 100)] + ' hundred';
    return n % 100 ? h + ' and ' + small(n % 100) : h;
  }

  /* Mid-sentence English prefers "a hundred and eleven" to "one hundred and
     eleven"; the start of a sentence takes the capital and keeps the "one". */
  function fillCounts(s, list) {
    var by = { 1: 0, 2: 0, 3: 0 };
    (list || []).forEach(function (r) { if (by[r.book] !== undefined) by[r.book]++; });
    return String(s).replace(/\{([nN])([123]?)\}/g, function (_, c, b) {
      var w = spell(b ? by[b] : (list || []).length);
      if (c === 'N') return w.charAt(0).toUpperCase() + w.slice(1);
      return w.replace(/^one hundred/, 'a hundred');
    });
  }

  /* What the section picker calls each section. The full names are written
     for a printed contents page, where "Low-Calorie Cut Snacks & Late-Night
     Treats" has a line to itself and room to spare. In a native picker on a
     phone they wrap to two lines each and twelve of them becomes a wall you
     have to read rather than scan. These are for the picker alone — the book,
     the headings and the section pages all keep the full name. */
  /* Keyed by book and section number, which is the part that moves. Warm
     Drinks was section 2-9 until its six recipes went to Power Drinks in
     Volume One; Made, Not Bought slid up from 2-10 to fill the gap, and this
     list did not. Filtering on "Warm Drinks" returned three sauces.

     tests/browse.test.js now holds the two lists against the sections that
     actually exist, so an orphaned key or a section with no label fails rather
     than mislabelling a filter. */
  var SEC_SHORT = {
    '1-1': 'Breakfasts', '1-2': 'Snacks', '1-3': 'Lunch', '1-4': 'Dinner',
    '1-5': 'Best Before Bed', '1-6': 'Power Drinks', '1-7': 'Batch Prep',
    '2-1': 'Weekday Breakfasts', '2-2': 'Lunches & Wraps', '2-3': 'Weeknight Dinners',
    '2-4': 'Sunday Feasts', '2-5': 'Treats & Desserts', '2-6': 'Worth the Afternoon',
    '2-7': 'The Copycat Shelf', '2-8': 'Chocolate', '2-9': 'Made, Not Bought'
  };

  var SEC_NOTE = {
    '1-1': 'Enough protein that eleven o’clock is not a problem.',
    '1-2': 'Small, cold, and nothing to cook.',
    '1-3': 'Cold, assembled, and enough to be a meal.',
    '1-4': 'Cooked tonight, eaten tonight.',
    '1-5': 'Slow protein late on, and nothing that will keep you up.',
    '1-6': 'Brews, shakes and smoothies, when a cup is easier than a plate.',
    '1-7': 'Cook once, eat the week.',
    '2-1': 'Weekday mornings, on the clock.',
    '2-2': 'Lunches, wraps, and the after‑school hour.',
    '2-3': 'Weeknight dinners the children will actually finish.',
    '2-4': 'Sunday, when there is time to do it properly.',
    '2-5': 'Sweets, made from what is on the shelf.',
    '2-6': 'Nothing quick here. Bread that rises, gravy that thickens, custard that sets.',
    '2-7': 'The restaurant version, worked out at home.',
    '2-8': 'For when only chocolate will do.',
    '2-9': 'The three bottles the storehouse does not carry, made from what it does.'
  };

  /* One line under each part title in the combined edition, doing the job the
     volume blurb does on a cover it no longer has. */
  var SEC_PART = {
    1: 'Built on protein, fiber and staying full.',
    2: 'The family table, from three-minute breakfasts to Sunday roasts.',
  };

  var FRAC = {
    '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3,
    '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875
  };

  // ------------------------------------------------------------------ utils
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function $(id) { return document.getElementById(id); }

  /* A printed recipe's id is its number in the book. One you wrote is a string.
     Both arrive from the DOM as text, so put each back the way it started. */
  function idOf(v) { return /^\d+$/.test(v) ? Number(v) : v; }

  /* What to print on the recipe. The book's own number for the printed ones;
     for yours, where it falls in your volume. */
  function no(r) { return String(r.no || r.id).padStart(3, '0'); }

  /* The score, in a leaf.
   *
   * Three bands, because a number on its own is a number and a colour is a
   * glance: green worth eating often, blue worth eating, dark grey worth
   * knowing about. The thresholds sit either side of the median, which is 60
   * across the 271, so the bands divide the collection rather than flattering
   * it. Drawn rather than set in a font so it prints as a shape at any size.
   */
  function scoreBand(n) { return n >= 70 ? 'good' : n >= 45 ? 'ok' : 'low'; }

  function leaf(n, cls) {
    if (n === null || n === undefined) return '';
    /* The band is in the colour and, now, in the words. Green, blue and grey
       were the whole of it, so the one thing the collection sorts by was the
       one thing a reader who cannot separate those colours could not read —
       and a title attribute never reaches a screen reader on a span. The
       number is the honest label; the band is what it means. */
    var band = scoreBand(n);
    var says = 'Nutrition score ' + n + ' out of 100, ' +
      (band === 'good' ? 'worth eating often' : band === 'ok' ? 'worth eating' : 'worth knowing about');
    return '<span class="leaf leaf-' + band + (cls ? ' ' + cls : '') + '" ' +
      'role="img" aria-label="' + says + '" title="' + says + '">' +
      /* A blade with shoulders, a pointed tip and a stem that kicks left at the
         base — the shape a leaf actually is, rather than the pointed oval that
         reads as an eye. No midrib: it ran straight through the number. */
      '<svg viewBox="0 0 44 54" aria-hidden="true" focusable="false">' +
        '<path class="leaf-body" d="M22 2C17 9 5 16 5 26c0 9 7 15 17 18 10-3 17-9 17-18 0-10-12-17-17-24Z"/>' +
        '<path class="leaf-stem" d="M22 44c0 4-1 6-3.5 7.5"/>' +
      '</svg>' +
      '<span class="leaf-n">' + n + '</span>' +
      '<span class="leaf-sr">out of 100</span>' +
    '</span>';
  }

  function fmtNum(n) {
    if (!isFinite(n)) return '';
    var whole = Math.floor(n + 1e-9);
    var eighths = Math.round((n - whole) * 8);
    if (eighths === 0) return String(whole || 0);
    if (eighths === 8) return String(whole + 1);
    var map = { 1: '⅛', 2: '¼', 3: '⅜', 4: '½', 5: '⅝', 6: '¾', 7: '⅞' };
    return (whole ? whole + ' ' : '') + map[eighths];
  }

  /* Units that read wrong when a scaled quantity crosses one: "2 cup" -> "2 cups",
     "½ cups" -> "½ cup". Abbreviations such as tsp, tbsp and oz never change. */
  var PLURAL = {
    cup: 'cups', can: 'cans', slice: 'slices', clove: 'cloves', package: 'packages',
    packet: 'packets', stick: 'sticks', pint: 'pints', quart: 'quarts', scoop: 'scoops',
    head: 'heads', bunch: 'bunches', link: 'links', spear: 'spears', lb: 'lbs', box: 'boxes',
    serving: 'servings', plate: 'plates', egg: 'eggs', piece: 'pieces'
  };
  var SINGULAR = {};
  Object.keys(PLURAL).forEach(function (k) { SINGULAR[PLURAL[k]] = k; });

  /* The nouns the books actually yield in — "6 Small Oat Bites", "4 Wrap
     Rolls", "2 Loaves" — read off the servings lines in data/recipes.js
     rather than guessed at. Deliberately NOT merged into PLURAL above:
     that map is also run over ingredient text, where "1 cake flour" doubled
     would come out "2 cakes flour". A yield is not an ingredient. */
  var YIELDS = {
    bite: 'bites', bowl: 'bowls', roll: 'rolls', sandwich: 'sandwiches',
    glass: 'glasses', mug: 'mugs', square: 'squares', burrito: 'burritos',
    cookie: 'cookies', jar: 'jars', quesadilla: 'quesadillas', pop: 'pops',
    popsicle: 'popsicles', half: 'halves', pancake: 'pancakes', taco: 'tacos',
    boat: 'boats', meal: 'meals', taquito: 'taquitos', wrap: 'wraps',
    pizza: 'pizzas', tomato: 'tomatoes', sub: 'subs', dumpling: 'dumplings',
    waffle: 'waffles', loaf: 'loaves', cake: 'cakes', bar: 'bars',
    tortilla: 'tortillas', container: 'containers'
  };
  var YIELD_ONE = {};
  Object.keys(YIELDS).forEach(function (k) { YIELD_ONE[YIELDS[k]] = k; });

  // plural above one, singular at or below it: "1¾ bites", "¾ bite"
  function mFixNoun(w, n) {
    return n > 1 ? (YIELDS[w] || PLURAL[w] || w) : (YIELD_ONE[w] || SINGULAR[w] || w);
  }

  function fixUnit(rest, n) {
    var m = rest.match(/^([a-z]+)\b/i);
    if (!m) return rest;
    var w = m[1], lower = w.toLowerCase(), want;
    if (n > 1) want = PLURAL[lower] || (SINGULAR[lower] ? lower : null);
    else want = SINGULAR[lower] || (PLURAL[lower] ? lower : null);
    if (!want || want === lower) return rest;
    return want + rest.slice(w.length);
  }

  function scaleIng(str, f) {
    if (f === 1) return str;
    var m = str.match(/^(\d+(?:\.\d+)?)\s*([½¼¾⅓⅔⅛⅜⅝⅞])?\s+/) ||
      str.match(/^([½¼¾⅓⅔⅛⅜⅝⅞])\s+/);
    if (!m) return str;
    var base;
    if (FRAC[m[1]] !== undefined) base = FRAC[m[1]];
    else base = parseFloat(m[1]) + (m[2] ? FRAC[m[2]] : 0);
    if (!base) return str;
    var scaled = base * f;
    return fmtNum(scaled) + ' ' + fixUnit(str.slice(m[0].length), scaled);
  }

  /* The same line by weight. Every recipe already carries a gram figure per
     ingredient — it is what the scores and the shopping list are computed from
     — so this is showing work that was always there rather than new arithmetic.
     ingp runs parallel to ing across all 271 recipes; the tests hold that.

     What gets stripped is the written amount and, where the ingredient is
     measured by volume, the unit word and any parenthetical sizing after it:
     "1 can (5 oz) tuna" is 121 g of tuna and the tin is no longer the point.
     Countables keep their trailing note, because "119 g bell pepper (halved)"
     still wants halving. The eighty-six lines with no weight — a dash of
     vanilla, salt, pepper — are left exactly as written, since rendering them
     as 0 g would be worse than saying nothing. */
  function gramIng(str, it, f) {
    if (!it || !it.g) return str;
    var m = str.match(/^(\d+(?:\.\d+)?)\s*([½¼¾⅓⅔⅛⅜⅝⅞])?\s+/) ||
      str.match(/^([½¼¾⅓⅔⅛⅜⅝⅞])\s+/);
    var rest = m ? str.slice(m[0].length) : str;
    if (it.u && it.u !== 'each') {
      rest = rest.replace(new RegExp('^' + it.u + 's?\\b\\s*(\\([^)]*\\))?\\s*', 'i'), '');
    }
    var g = it.g * f;
    // a tenth of a gram of cinnamon is spurious precision; ten grams of flour is not
    return (g >= 10 ? Math.round(g) : Math.round(g * 10) / 10) + ' g ' + rest;
  }

  /* Units the shopping list writes out. Anything countable is rounded up and
     shown as a bare number — you cannot buy four fifths of a tin. */
  var UNIT_WORD = { each: '', cup: 'cup', tbsp: 'tbsp', tsp: 'tsp', lb: 'lb', oz: 'oz', g: 'g',
    can: 'can', pkg: 'pkg', box: 'box', jar: 'jar', scoop: 'scoop' };
  var WHOLE = { each: 1, can: 1, pkg: 1, box: 1, jar: 1 };

  function shopQty(grams, unit, per, ladder) {
    if (!unit || !per) return '';
    /* Spoons stop being a useful way to say it somewhere around eight of them:
       "8 tbsp ranch dressing" is half a cup, and "16 tbsp" is a cup. Six stays
       six, because a quarter of a cup is not clearer than four tablespoons. */
    if (ladder) {
      for (var i = ladder.length - 1; i >= 0; i--) {
        if (ladder[i][0] !== unit) continue;
        while (i > 0 && grams / per >= 8) { i--; unit = ladder[i][0]; per = ladder[i][1]; }
        break;
      }
    }
    var n = grams / per;
    if (WHOLE[unit]) n = Math.max(1, Math.ceil(n - 0.15));
    else if (n < 0.06) return '';                     // a trace of something
    var num = fmtNum(n);
    var word = UNIT_WORD[unit];
    if (!word) return num;
    return num + ' ' + fixUnit(word, n);
  }

  function macroLine(r) {
    if (!r.macro) return '';
    return r.macro.kcal + ' kcal · ' + r.macro.p + 'g protein · ' +
      r.macro.c + 'g carbs · ' + r.macro.f + 'g fat';
  }
  function diffLabel(d) { return d === 'In-Depth' ? 'In-depth' : d; }

  // ------------------------------------------------------------------ state
  var S = {
    /* The tab you were on is the tab you come back to. A refresh that threw
       somebody tracking their day back onto the recipe grid read as the app
       forgetting them; device-local like sh.units, because which tab you
       live on is yours, not the household's. */
    view: (function () {
      try {
        var v = localStorage.getItem('sh.view');
        return ['browse', 'plan', 'macros', 'list', 'pantry', 'book'].indexOf(v) >= 0 ? v : 'browse';
      } catch (e) { return 'browse'; }
    })(),
    bookF: 'all', secF: 'all', diffF: 'all', pantryF: 'all',
    favOnly: false, qy: '', sort: 'book', openId: null, scale: 1, printSet: 'all',
    /* Cups or grams. Persisted on the device rather than shared, because it is
       a preference about reading, not about the plan — one of you can cook by
       weight while the other cooks by cup without either overruling the other. */
    units: (function () {
      try { return localStorage.getItem('sh.units') === 'grams' ? 'grams' : 'cups'; }
      catch (e) { return 'cups'; }
    })(),
    syncOpen: false, pendingCode: '', joinDraft: '', why: false,
    /* The Macros tab. macroDate null means "today, worked out at render time",
       so a phone left open across midnight lands on the new day by itself;
       an explicit key means the reader pressed ‹ and wants to stay there. */
    macroDate: null, macroPick: null, macroTargOpen: false, newFood: null, mpQuery: '',
    /* A food opened from its plate: {id, x}. Foods have no recipe sheet, so
       this is the sheet that answers "what is one of it, and what went in". */
    foodOpen: null,
    myJoin: '', mySent: false, myErr: '', myNote: '',
    mpSec: 'meal', mpSort: 'fit',
    /* Which of the three ways in the picker is showing. It opens on 'home',
       where the ways are the screen — scanning used to be the fourth button
       on a second sheet, which is three taps of ceremony in front of the
       fastest way to name a food. */
    mpMode: 'home', mpLook: '', mpFromBar: false,
    /* Which meals you have pressed open or shut, against the default of
       folding one you have eaten. Ephemeral: a new day starts fresh. */
    mFold: {}, mFoldFor: '', mTouched: '', mtOpen: '',
    chartOpen: false, chartWhich: 'weight', keepMeal: '',
    /* What the picker has been told to add, before it is told to stop. A meal
       assembled from parts — a scoop of whey, a splash of half and half, a
       spoon of honey — used to cost one full trip through this sheet per
       part, because picking anything closed it. The basket holds them all
       and one ✓ commits the lot. Keyed id -> portion. */
    mpBasket: {},
    /* How far down each meal's ranked list Try again has walked, keyed day
       and meal. Ephemeral on purpose: tomorrow starts at the top again. */
    mTry: {},
    /* Which eaten plate has had its portion woken up for a correction. One at
       a time, and never persisted: it is a gesture, not a setting. */
    mEdit: '',
    /* Which day's summary card is open, or '' for none. A day key rather than
       a boolean, because the card can be opened for any day from the menu and
       not only for the one just closed. */
    mDoneOpen: ''
  };

  // ------------------------------------------------------------------ browse
  /** "1 hr 20 mins" -> 80. Used for sorting by how long something takes. */
  function timeMins(r) {
    var h = r.time.match(/(\d+(?:\.\d+)?)\s*hr/i);
    var m = r.time.match(/(\d+)\s*min/i);
    return (h ? parseFloat(h[1]) * 60 : 0) + (m ? parseInt(m[1], 10) : 0);
  }

  var SORTS = {
    book: null,
    /* a missing score sorts last rather than to the top */
    healthy: function (a, b) { return (b.score === null ? -1 : b.score) - (a.score === null ? -1 : a.score); },
    protein: function (a, b) { return ((b.macro && b.macro.p) || 0) - ((a.macro && a.macro.p) || 0); },
    quick: function (a, b) { return timeMins(a) - timeMins(b); }
  };

  /* Why a recipe matched, which is not the same question as whether it did.
     3 its name, 2 an ingredient, 1 only its section, 0 not at all.

     Searching "breakfast" used to return fifty recipes of which seven were
     named for one — the other forty-three came along because their section is
     called Morning Brews & High-Protein Breakfasts, and arrived interleaved
     with the ones actually wanted. Section is still worth matching, because
     "chocolate" ought to find the chocolate section, but it is the weakest
     reason to appear and belongs at the bottom rather than in the middle. */
  function matchRank(r, qs) {
    if (r.name.toLowerCase().indexOf(qs) >= 0) return 3;
    if (r.ing.join(' ').toLowerCase().indexOf(qs) >= 0) return 2;
    if (r.secName.toLowerCase().indexOf(qs) >= 0) return 1;
    return 0;
  }

  function filtered() {
    var qs = S.qy.trim().toLowerCase();
    return RECIPES.filter(function (r) {
      if (S.bookF !== 'all' && r.book !== S.bookF) return false;
      if (S.secF !== 'all' && (r.book + '-' + r.secNum + '-' + r.secName) !== S.secF) return false;
      if (S.diffF !== 'all' && r.diff !== S.diffF) return false;
      if (S.pantryF === 'base' && missingFor(r).length) return false;
      if (S.pantryF === 'extras' && !missingFor(r).length) return false;
      if (S.favOnly && !window.Store.isFav(r.id)) return false;
      if (qs && !matchRank(r, qs)) return false;
      return true;
    }).sort(function (a, b) {
      /* While searching, how well a recipe matches outranks book order — but
         not a sort the reader chose on purpose. Asking for "most protein" and
         getting relevance instead would be the app overruling them. */
      if (qs) {
        var d = matchRank(b, qs) - matchRank(a, qs);
        if (d) return d;
      }
      return SORTS[S.sort] ? SORTS[S.sort](a, b) : 0;
    });
  }

  function ours() {
    return RECIPES.filter(function (r) { return r.book === 3; });
  }

  /* The three words on the storehouse filter, which had been wrong twice over.
     "Needs pantry extras" arrived before the Pantry tab did, and once that tab
     existed the same word meant two opposite things one tab apart: the tab is
     what you keep, the filter meant what you do not. And the labels described
     the storehouse when the pantry had become the thing actually answering —
     take Crio Bru off your shelf and this filter changes behaviour while its
     wording does not.

     So it follows the pantry, exactly as the line at the foot of every recipe
     already does through shelfName(). Untouched, it talks about the storehouse,
     because that is true out of the box. Edit your pantry and it talks about
     your shelf, because that is true from then on. */
  function renderPantryFilterLabels() {
    var mine = window.Store.pantryChanged();
    var sel = $('pantrySel');
    var words = mine
      ? ['Everything', "Only what's on my shelf", 'Needs a shop']
      : ['Everything', 'Storehouse items only', 'Needs something bought elsewhere'];
    ['all', 'base', 'extras'].forEach(function (v, i) {
      var o = sel.querySelector('option[value="' + v + '"]');
      if (o) o.textContent = words[i];
    });
    sel.setAttribute('aria-label', mine ? 'What you keep' : 'Storehouse items');
  }

  function renderSections() {
    /* Grouped by volume rather than prefixed with it. Every option used to
       begin "Run and Not Be Weary · " or "Around the Table · ", which on a
       phone is twenty characters of the same words twelve times over, pushing
       the part you are actually reading past the edge of the picker. An
       optgroup says it once and iOS and Android both render it as a heading. */
    var sel = $('secSel');
    var seen = {}, opts = ['<option value="all">All sections</option>'], lastBook = null;
    RECIPES.forEach(function (r) {
      var key = r.book + '-' + r.secNum + '-' + r.secName;
      if (seen[key]) return;
      seen[key] = 1;
      if (S.bookF !== 'all' && r.book !== S.bookF) return;
      if (r.book !== lastBook) {
        if (lastBook !== null) opts.push('</optgroup>');
        opts.push('<optgroup label="' + esc((BOOKS[r.book] || BOOKS[3]).name) + '">');
        lastBook = r.book;
      }
      opts.push('<option value="' + esc(key) + '">' +
        esc(SEC_SHORT[r.book + '-' + r.secNum] || r.secName) + '</option>');
    });
    if (lastBook !== null) opts.push('</optgroup>');
    sel.innerHTML = opts.join('');
    sel.value = S.secF;
    if (sel.value !== S.secF) { S.secF = 'all'; sel.value = 'all'; }

    // the third volume only exists once there is something in it
    var n = ours().length;
    $('bookOurs').classList.toggle('hide', !n);
    /* The Ours card is written by renderDownloads, which draws the whole
       shelf — writing into it from here would clobber its markup. */
    if (!n && S.printSet === '3') S.printSet = 'all';
    if (!n && S.bookF === 3) { S.bookF = 'all'; }
    document.querySelector('.brand-sub').textContent =
      RECIPES.length + ' recipes · ' + (n ? 'three volumes' : 'two volumes');
  }

  function renderBrowse() {
    var list = filtered();
    $('browseTitle').textContent = BOOKS[S.bookF] ? BOOKS[S.bookF].name : 'The whole collection';
    var order = { healthy: ' · healthiest first', protein: ' · most protein first', quick: ' · quickest first' };
    var qs = S.qy.trim().toLowerCase();
    /* Not while searching. Once you have typed "chicken" the heading is no
       longer about a book and the line under it is in the way of the answer. */
    $('browseBlurb').textContent = qs ? ''
      : fillCounts(BOOKS[S.bookF] ? BOOKS[S.bookF].blurb : COLLECTION_BLURB, RECIPES);
    /* Say how many are here on their own merits and how many arrived because
       their section is named for the search. Without it, "breakfast" returning
       fifty recipes reads as fifty breakfasts, and the reader scrolls looking
       for the mistake. */
    var loose = qs ? list.filter(function (r) { return matchRank(r, qs) === 1; }).length : 0;
    $('browseCount').textContent = list.length + (list.length === 1 ? ' recipe' : ' recipes') +
      (loose ? ' · ' + (list.length - loose) + ' matching, ' + loose + ' more from sections named for it'
             : (order[S.sort] || ''));
    $('browseEmpty').classList.toggle('hide', list.length !== 0);

    /* Section headings down the grid.
     *
     * The collection is two hundred and seventy-seven cards and, in book
     * order, it is also fourteen sections that mean something — Breakfasts,
     * then Snacks, then Lunch. None of that was on the page: the card says
     * RUN · 042 and nothing says why 042 sits between 041 and 043, so
     * scrolling the whole collection was scrolling a wall.
     *
     * Only in book order, and only when there is more than one section in
     * what is showing. Sorted by score or by time the recipes are no longer
     * in sections, and a divider claiming otherwise would be a lie about the
     * order underneath it. Searching, the same. */
    var secKey = function (r) { return r.book + '-' + r.secNum; };
    var secCount = {};
    list.forEach(function (r) { secCount[secKey(r)] = (secCount[secKey(r)] || 0) + 1; });
    var showSecs = S.sort === 'book' && !qs && Object.keys(secCount).length > 1;
    var lastSec = null;

    $('grid').innerHTML = list.map(function (r) {
      var head = '';
      if (showSecs && secKey(r) !== lastSec) {
        lastSec = secKey(r);
        var n = secCount[lastSec];
        head = '<div class="grid-sec">' +
          '<span class="grid-sec-b">' + esc(BOOKS[r.book].short) + '</span>' +
          '<b>' + esc(SEC_SHORT[lastSec] || r.secName) + '</b>' +
          '<span class="grid-sec-n">' + n + '</span>' +
          (SEC_NOTE[lastSec] ? '<span class="grid-sec-s">' + esc(SEC_NOTE[lastSec]) + '</span>' : '') +
        '</div>';
      }
      var fav = window.Store.isFav(r.id);
      var chip = r.score === null
        ? '<span class="chip plain">' + esc(diffLabel(r.diff)) + '</span>'
        : leaf(r.score);
      /* esc, like every other interpolation on this card. A recipe id is
         generated locally and is safe — but a recipe arriving from the shared
         household document was typed by somebody else, and the whole point of
         a household is that it holds other people's writing. */
      var card = '<button class="card" data-open="' + esc(r.id) + '">' +
        '<span class="card-top">' +
          '<span class="card-num">' + BOOKS[r.book].short + ' · ' + no(r) + '</span>' +
          '<span class="card-fav">' + (fav ? '★ Saved' : '') + '</span>' +
        '</span>' +
        '<span class="card-name">' + esc(r.name) + '</span>' +
        '<span class="card-sub">' + esc(r.tagline || macroLine(r)) + '</span>' +
        '<span class="card-foot">' +
          '<span class="card-meta">' + esc(r.time + ' · ' + r.servings.split(' (')[0]) + '</span>' +
          chip +
        '</span>' +
      '</button>';
      return head + card;
    }).join('');
  }

  // ---------------------------------------------------------------- planning
  /* Everything in the week, once each. The same recipe on two days at different
     sizes is one shopping trip for the sum of the two. */
  function planEntries() {
    var out = [], at = {};
    DAYS.forEach(function (d) {
      window.Store.day(d[0]).forEach(function (e) {
        if (!BY_ID[e.id]) return;
        if (at[e.id] === undefined) { at[e.id] = out.length; out.push({ r: BY_ID[e.id], x: e.x }); }
        else out[at[e.id]].x += e.x;
      });
    });
    return out;
  }

  function planIds() {
    return planEntries().map(function (e) { return e.r.id; });
  }

  /* The strip of weeks above the grid. Everything to do with which week is
     showing lives here; the grid below never knows there is more than one. */
  function renderWeeks() {
    var weeks = window.Store.weeks();
    var active = window.Store.activeWeek();

    $('weekTitle').textContent = active.name;
    $('weekBar').innerHTML = weeks.map(function (w) {
      var n = planCount(w.id);
      return '<button class="wk" data-week="' + esc(w.id) + '" aria-pressed="' + w.active + '">' +
        esc(w.name) + '<span class="wk-n">' + (n || '&mdash;') + '</span></button>';
    }).join('') +
      '<button class="wk wk-add" data-neww="new" title="Start an empty week">+ Week</button>' +
      '<button class="wk wk-add" data-neww="copy" title="Copy the week showing into a new one">+ Copy</button>';

    // there is nothing to delete down to — one week always stays
    $('deleteWeek').classList.toggle('hide', weeks.length < 2);

  }

  function planCount(id) {
    var st = window.Store.state;
    var plan = id === st.active ? st.plan : ((st.weeks[id] || {}).plan || {});
    var seen = [];
    DAYS.forEach(function (d) {
      (plan[d[0]] || []).forEach(function (e) {
        var rid = e && typeof e === 'object' ? e.i : e;
        /* BY_ID, like planEntries and renderPlan already do. Deleting one of
           your own recipes leaves its id on whatever days it was on, so the
           chip on the week counted a meal the week could no longer show. */
        if (BY_ID[rid] && seen.indexOf(rid) < 0) seen.push(rid);
      });
    });
    return seen.length;
  }

  // taps cycle through these, so a Sunday roast for twice the family is two taps
  var SCALES = [1, 2, 3, 4, 0.5];

  function renderPlan() {
    renderWeeks();
    $('planGrid').innerHTML = DAYS.map(function (d) {
      var list = window.Store.day(d[0]).filter(function (e) { return BY_ID[e.id]; });
      var items = list.map(function (e) {
        var r = BY_ID[e.id];
        return '<div class="day-item">' +
          '<span class="day-item-name">' + esc(r.name) + '</span>' +
          '<button class="day-x no-print" data-drop="' + e.id + '" data-day="' + d[0] + '" ' +
            'aria-label="Remove ' + esc(r.name) + '">&times;</button>' +
          '<button class="day-x2 no-print" data-mult="' + e.id + '" data-day="' + d[0] + '" ' +
            'title="How many times the recipe — the shopping list follows">' +
            '&times;' + fmtNum(e.x) + '</button>' +
        '</div>';
      }).join('');
      return '<div class="day">' +
        '<div class="day-name">' + d[1] + '</div>' +
        '<div class="day-body">' + items +
          (list.length ? '' : '<div class="day-empty">&mdash;</div>') +
        '</div></div>';
    }).join('');
  }

  // ----------------------------------------------------------------- macros
  /* An RP-Diet-style day, kept as simple as the idea: targets in grams, four
     meals, tick off what you eat. The picker below suggests a portion of each
     recipe sized to what the day still needs.
   *
   * Everything here is deliberately personal and deliberately local. The keys
   * are read and written in this file rather than through sync.js, because the
   * LS map there is precisely the list of things saveLocal() mirrors into the
   * household document — and a personal cut diary must never ride along into
   * the merge and join paths. sh.units set the precedent for "device-local,
   * app-owned"; these follow it under the bsc. prefix. */

  /* ------------------------------------------------------------------------
   * My Day, on your other devices.
   *
   * The household sync in sync.js shares one plan between people. This shares
   * one day between DEVICES belonging to one person, which is a different
   * promise and deserves a different door: a private code, its own document,
   * and nothing of it in the family's.
   *
   * It rides on the same collection because the rule that guards it is the
   * right rule already — a document addressed by a secret code, fetchable
   * only by someone who has the code, never listable. A second collection
   * would need those rules written again and deployed, to say the same thing.
   *
   * Every part carries the moment it was written, and days carry one each, so
   * a phone that has been in a pocket all day cannot land and wipe an evening
   * entered on the desk. Newer wins, part by part.
   * --------------------------------------------------------------------- */
  var S_SYNC_STATE = 'off';

  /* Every transition through one door.
   *
     This was nine bare assignments, and each site separately remembered to
     redraw the sheet. Two forgot, and both failures were silent: a push that
     could not be saved set 'error' and told nobody, so a sheet left open went
     on saying Synced over a day that had not been written; and the load that
     never arrives set 'error' under a sheet still reading "Connecting…",
     which is the one word that promises it is still trying.

     A state nobody is told about is not a state, it is a variable. So the
     assignment and the telling are the same act now, and there is one place
     left to forget rather than nine. */
  function mSyncState(next) {
    S_SYNC_STATE = next;
    mMarkAccountUI();
    if (S.syncOpen) renderModal();
  }

  /* Whether the day is failing to reach the account it belongs to.
   *
     Only ever true for a device that HAS one. Someone who has never signed in
     has not lost anything, and finding that out must not cost them a call to
     Firebase — the flag is read from storage, and the network is never asked.

     'off' counts only once mAuthKnown: before we have asked, "nobody is
     signed in" is a guess, and a warning built on a guess is worse than none. */
  function mSyncTrouble() {
    if (!mSuspectAccount()) return false;
    if (S_SYNC_STATE === 'error') return true;
    return S_SYNC_STATE === 'off' && mAuthKnown;
  }

  /* The mark on the gear, and the line under the menu item that names who.
   *
     The gear is quiet while it works. A dot that is always lit says nothing —
     it is furniture — so this one appears only when there is something to
     act on, and its absence is the good news. The menu underneath answers the
     other half in words, one press away, in both directions: who you are, or
     that you are nobody yet. It says nothing at all until the SDK has
     answered, because "Not signed in" before we have asked is a lie that
     happens to be true half the time. */
  function mMarkAccountUI() {
    var g = $('macroMore');
    if (g) {
      var bad = mSyncTrouble();
      // a no-op toggle still rewrites the attribute, and something is watching
      if (g.classList.contains('mday-warn') !== bad) g.classList.toggle('mday-warn', bad);
    }
    var el = $('macroWho');
    if (el) {
      var who = mAccount();
      var says = who ? (who.email || who.name || 'Signed in')
        : (mAuthKnown ? 'Not signed in' : '');
      if (el.textContent !== says) el.textContent = says;
    }
  }

  var MSTAMPS = (function () {
    try { return JSON.parse(localStorage.getItem('bsc.myStamps')) || {}; }
    catch (e) { return {}; }
  })();

  function mStamp(part, sub) {
    var now = Date.now();
    if (sub) {
      /* Per-key stamps, for the parts that are maps of days rather than one
         value: the day log, and which days you have closed. Keyed by part
         rather than hardcoded to 'd', so two of them can coexist without one
         quietly writing into the other's stamps. */
      MSTAMPS[part] = MSTAMPS[part] || {};
      MSTAMPS[part][sub] = now;
    } else MSTAMPS[part] = now;
    try { localStorage.setItem('bsc.myStamps', JSON.stringify(MSTAMPS)); } catch (e) { /* private */ }
    mSyncPush();
  }

  /* This used to be a private code, which was the right shape for one person
     with two phones and the wrong shape the moment the app went to a
     congregation. A code can be read aloud, forwarded, or guessed, and what
     it was guarding is a weight history. It is an account now: the document
     is the signed-in person's own, and the rule that guards it is whose it
     is rather than what you can recite. */
  function mAccount() { return window.Store.user ? window.Store.user() : null; }

  /* Whether the question "who is signed in?" can be answered yet. It cannot
     until Firebase has loaded, and Firebase loads asynchronously — so a
     device that IS signed in shows the signed-out sheet for the moment in
     between, which reads as "there is no way to sign out" rather than as
     "wait". Say wait. */
  var mAuthKnown = false;
  function mSuspectAccount() {
    try { return localStorage.getItem('bsc.myAccount') === '1'; } catch (e) { return false; }
  }

  /* This device has an account, remembered without asking the network — the
     one thing that has to be known before deciding whether to reach for it. */
  /* Whose day is on this device. Written beside the data rather than kept in
     the account, because it has to be answerable before the network is. */
  function mOwner() {
    try { return localStorage.getItem('bsc.myOwner') || ''; } catch (e) { return ''; }
  }
  function mSetOwner(uid) {
    try {
      if (uid) localStorage.setItem('bsc.myOwner', uid);
      else localStorage.removeItem('bsc.myOwner');
    } catch (e) { /* private mode */ }
  }

  /* Signing out has to take the day with it.
   *
     It did not, and the next person to sign in on the same device inherited
     it: mSyncStart pushes once on connect, mSyncPayload reads whatever is
     still in memory and in storage, and Firestore accepts it because the
     write is honestly authenticated as the new person. A weight history and a
     food log would land in a stranger's account and follow them onto their
     own devices, where the person it belonged to could never reach it again.
     Clearing storage alone is not enough — the payload is rebuilt from the
     module-level copies, so those have to go too. */
  function mForgetDay() {
    ['bsc.macroDays', 'bsc.macroWeights', 'bsc.myStamps', 'bsc.macroTargets',
      'bsc.macroProfile', 'bsc.macroSlots', 'bsc.myFoods', 'bsc.myOwner',
      'bsc.macroDone', 'bsc.macroSkip'].forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) { /* private mode */ }
    });
    Object.keys(MDAYS).forEach(function (k) { delete MDAYS[k]; });
    Object.keys(MWEIGHTS).forEach(function (k) { delete MWEIGHTS[k]; });
    Object.keys(MSTAMPS).forEach(function (k) { delete MSTAMPS[k]; });
    Object.keys(MDONE).forEach(function (k) { delete MDONE[k]; });
    Object.keys(MSKIP).forEach(function (k) { delete MSKIP[k]; });
  }

  function mAccountMark() {
    try {
      if (mAccount()) localStorage.setItem('bsc.myAccount', '1');
      else localStorage.removeItem('bsc.myAccount');
    } catch (e) { /* private mode: this session only */ }
  }

  /* What this device would send. Read fresh each time so it never ships a
     stale copy of something edited in another tab. */
  function mSyncPayload() {
    var days = {};
    Object.keys(MDAYS).forEach(function (k) {
      days[k.replace(/-/g, '_')] = { v: MDAYS[k], at: (MSTAMPS.d || {})[k] || 0 };
    });
    /* Per day, like the day log — so closing Monday here and Tuesday there
       leaves both closed, instead of the newer write erasing the older. */
    var done = {};
    Object.keys(MDONE).forEach(function (k) {
      done[k.replace(/-/g, '_')] = { v: mDoneAt(k), at: (MSTAMPS.dn || {})[k] || 0 };
    });
    var skip = {};
    Object.keys(MSKIP).forEach(function (k) {
      skip[k.replace(/-/g, '_')] = { v: MSKIP[k], at: (MSTAMPS.sp || {})[k] || 0 };
    });
    var raw = function (key) {
      try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
    };
    return {
      mf: { v: raw('bsc.myFoods'), at: MSTAMPS.mf || 0 },
      t: { v: raw('bsc.macroTargets'), at: MSTAMPS.t || 0 },
      pr: { v: raw('bsc.macroProfile'), at: MSTAMPS.pr || 0 },
      sl: { v: raw('bsc.macroSlots'), at: MSTAMPS.sl || 0 },
      w: { v: MWEIGHTS, at: MSTAMPS.w || 0 },
      d: days,
      dn: done,
      sp: skip
    };
  }

  /* Newer wins, part by part. Returns true when anything here changed, so the
     caller knows whether to redraw. Pure enough to test without a network. */
  function mMergeRemote(md) {
    if (!md) return false;
    var moved = false;
    var take = function (part, key, apply) {
      var r = md[part];
      if (!r || !r.v || !(r.at > (MSTAMPS[part] || 0))) return;
      apply(r.v);
      MSTAMPS[part] = r.at;
      moved = true;
    };
    take('mf', 'bsc.myFoods', function (v) {
      try { localStorage.setItem('bsc.myFoods', JSON.stringify(v)); } catch (e) { /* private */ }
    });
    take('t', 'bsc.macroTargets', function (v) {
      try { localStorage.setItem('bsc.macroTargets', JSON.stringify(v)); } catch (e) { /* private */ }
    });
    take('pr', 'bsc.macroProfile', function (v) {
      try { localStorage.setItem('bsc.macroProfile', JSON.stringify(v)); } catch (e) { /* private */ }
    });
    take('sl', 'bsc.macroSlots', function (v) {
      try { localStorage.setItem('bsc.macroSlots', JSON.stringify(v)); } catch (e) { /* private */ }
    });
    take('w', 'bsc.macroWeights', function (v) {
      Object.keys(v).forEach(function (k) { MWEIGHTS[k] = v[k]; });
      try { localStorage.setItem('bsc.macroWeights', JSON.stringify(MWEIGHTS)); } catch (e) { /* private */ }
    });
    Object.keys(md.d || {}).forEach(function (enc) {
      var k = enc.replace(/_/g, '-');
      var r = md.d[enc];
      if (!r || !r.v || !(r.at > ((MSTAMPS.d || {})[k] || 0))) return;
      MDAYS[k] = r.v;
      MSTAMPS.d = MSTAMPS.d || {};
      MSTAMPS.d[k] = r.at;
      moved = true;
    });
    /* Which days are closed, per day and newest-wins — the same shape as the
       log above it. Note `r.v` is NOT required to be truthy here the way it
       is elsewhere: zero is the value that means "I reopened this", and a
       merge that skipped falsy values would let a reopen be undone by any
       device that still remembered the close. */
    Object.keys(md.dn || {}).forEach(function (enc) {
      var k = enc.replace(/_/g, '-');
      var r = md.dn[enc];
      if (!r || r.v === undefined || !(r.at > ((MSTAMPS.dn || {})[k] || 0))) return;
      MDONE[k] = Number(r.v) || 0;
      MSTAMPS.dn = MSTAMPS.dn || {};
      MSTAMPS.dn[k] = r.at;
      moved = true;
    });
    Object.keys(md.sp || {}).forEach(function (enc) {
      var k = enc.replace(/_/g, '-');
      var r = md.sp[enc];
      // an empty list is a real answer here — it means "I un-skipped them all"
      if (!r || !Array.isArray(r.v) || !(r.at > ((MSTAMPS.sp || {})[k] || 0))) return;
      if (r.v.length) MSKIP[k] = r.v.slice(); else delete MSKIP[k];
      MSTAMPS.sp = MSTAMPS.sp || {};
      MSTAMPS.sp[k] = r.at;
      moved = true;
    });
    if (moved) {
      try {
        localStorage.setItem('bsc.macroDays', JSON.stringify(MDAYS));
        localStorage.setItem('bsc.macroDone', JSON.stringify(MDONE));
        localStorage.setItem('bsc.macroSkip', JSON.stringify(MSKIP));
        localStorage.setItem('bsc.myStamps', JSON.stringify(MSTAMPS));
      } catch (e) { /* private mode: this session only */ }
    }
    return moved;
  }

  var mSyncDoc = null, mSyncOff = null, mSyncTimer = null;
  function mSyncStart() {
    if (mSyncOff) { mSyncOff(); mSyncOff = null; mSyncDoc = null; }
    if (!window.Store || !window.Store.configured) {
      mAuthKnown = true;
      mSyncState('off');
      return;
    }
    if (!mAccount()) {
      /* Nobody is signed in as far as this page can see — but if the device
         remembers an account, the SDK may simply not have loaded yet, and
         saying "signed out" now would be a guess. Ask, then answer. */
      if (mSuspectAccount() && !mAuthKnown) {
        window.Store.ready().then(function () {
          mAuthKnown = true;
          /* The device's answer, corrected by the real one.
           *
             This flag decides whether Firebase loads at all, so it is written
             locally at sign-in and believed at boot. Believed is the problem:
             it was never checked again. Android clears site data on a PWA it
             considers idle, and the flag and the session do not have to go
             together — leaving a device that says "I have an account",
             loads the SDK, finds nobody, and quietly signs in anonymously
             underneath while showing the signed-out sheet. Which reads as a
             sign-in that did not take. Now the truth wins on every load. */
          mAccountMark();
          if (mAccount()) mSyncStart();
          /* The device said it had an account and the server says otherwise.
             That is the drift this whole re-affirmation exists to catch, so
             it has to reach the gear and not just the sheet. */
          else mSyncState('off');
        }, function () {
          mAuthKnown = true;
          mSyncState('error');
        });
        return;
      }
      mAuthKnown = true;
      mSyncState('off');
      return;
    }
    mSyncState('connecting');
    window.Store.ready().then(function (db) {
      mAuthKnown = true;
      mAccountMark();                       // the truth, again, now that it is knowable
      var uid = window.Store.uid();
      if (!uid || !mAccount()) {
        // the answer is known now even though it is "nobody"; say so
        mSyncState('off');
        return;
      }
      /* Carrying the day up into an account is for one case only: the
         anonymous identity this device has been using all along becoming a
         named one. If what is here belonged to somebody else, this device
         takes what the account has and offers it nothing. */
      var owner = mOwner();
      var mine = !owner || owner === uid;
      if (!mine) {
        mForgetDay();
        if (S.view === 'macros') renderMacros();
      }
      mSetOwner(uid);
      mSyncDoc = db.collection('users').doc(uid);
      mSyncOff = mSyncDoc.onSnapshot(function (snap) {
        var data = snap.exists ? (snap.data() || {}) : null;
        mSyncState('on');
        if (!data || !data.myday) { mSyncPush(true); return; }
        if (mMergeRemote(data.myday) && S.view === 'macros') renderMacros();
        if (S.syncOpen) renderModal();
      }, function () { mSyncState('error'); });
      mSyncPush(true);
    }, function () { mSyncState('error'); });
  }

  function mSyncPush(now) {
    if (!mSyncDoc) return;
    clearTimeout(mSyncTimer);
    mSyncTimer = setTimeout(function () {
      mSyncDoc.set({ myday: mSyncPayload() }, { merge: true }).then(function () {
        mSyncState('on');
      }, function () { mSyncState('error'); });
    }, now ? 0 : 900);
  }

  function dayKey(d) {
    /* Built from the local calendar, never toISOString() — that is UTC, and it
       files an evening snack in Mountain time under tomorrow. */
    var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  }
  function todayKey() { return dayKey(new Date()); }
  function keyDate(k) {
    var m = k.split('-');
    return new Date(Number(m[0]), Number(m[1]) - 1, Number(m[2]));
  }
  function mViewKey() { return S.macroDate || todayKey(); }

  /* Today plus thirteen days behind it. Enough to look back over a week and
     change your mind about the one before; not enough to become a diary the
     browser has to carry forever. YYYY-MM-DD sorts as it dates, so the prune
     is one string comparison. */
  function mEarliestKey() {
    var d = new Date();
    d.setDate(d.getDate() - 13);
    return dayKey(d);
  }

  /* How far forward the day travels. A week is as far as a plan is worth
     making: the shopping happens on a horizon like that, and pinned routine
     lands on a day the moment you first look at it, so a fortnight of empty
     Thursdays would be a fortnight of half-written days you never meant. */
  function mLatestKey() {
    var d = new Date();
    d.setDate(d.getDate() + 7);
    return dayKey(d);
  }

  /* A day you have not lived yet. You can plan one — put food on it, fill it,
     rebalance it — but you cannot have eaten it, and the scale has nothing to
     say about a morning that has not happened. */
  function mAhead(k) { return k > todayKey(); }

  function mReadTargets() {
    var t = null;
    try {
      var raw = JSON.parse(localStorage.getItem('bsc.macroTargets'));
      if (raw && isFinite(raw.p) && isFinite(raw.f) && isFinite(raw.c)) {
        t = { p: Number(raw.p), f: Number(raw.f), c: Number(raw.c) };
      }
    } catch (e) { /* private mode or a corrupt value — the defaults stand */ }
    if (!t) return { p: 180, f: 50, c: 50 };
    /* A day saved before the deficit was capped can be below what the body
       spends at rest — the arithmetic that wrote it has since been fixed,
       but the number it wrote is still sitting in storage being served every
       morning. Only that case is corrected, and only back up to what the
       same profile works out to now; a plan somebody typed by hand and can
       actually eat is left exactly as they typed it. */
    var pr = mReadProfile();
    var tdee = mTdee(pr);
    /* Two ways a stored day can be uneatable, and the total is only one of
       them. 226P/62F/13C comes to 1,514 kcal — over the floor, and still a
       day with three percent of itself left for everything that is not
       protein or fat, which no dinner in the book fits inside. A deliberate
       very-low-carb day typed by hand would be corrected once by this too;
       that is the price of not serving a day nobody can eat. */
    var starved = 4 * t.c < 0.12 * kcalOf(t);
    if (tdee !== null && (kcalOf(t) < mFloorK(pr) || starved)) {
      var fresh = mPlanCalc(pr);
      if (fresh && (kcalOf(fresh) > kcalOf(t) || fresh.c > t.c)) {
        t = { p: fresh.p, f: fresh.f, c: fresh.c };
        mWriteTargets(t);
      }
    }
    return t;
  }
  function mWriteTargets(t) {
    mStamp('t');
    try { localStorage.setItem('bsc.macroTargets', JSON.stringify(t)); }
    catch (e) { /* private mode: the render reads defaults, nothing breaks */ }
  }

  /* The days live in memory and persist best-effort, so a browser that refuses
     localStorage still gets a working tab for the session. */
  var MDAYS = (function () {
    try {
      var d = JSON.parse(localStorage.getItem('bsc.macroDays'));
      if (d && typeof d === 'object' && !Array.isArray(d)) return d;
    } catch (e) { /* fall through */ }
    return {};
  })();

  /* Which meals a day holds, and what each is called. list is the day as the
     reader shaped it; names remembers every key that ever had one, so a meal
     removed from the plan can still caption the plates it left on old days. */
  function mReadSlots() {
    try {
      var s = JSON.parse(localStorage.getItem('bsc.macroSlots'));
      if (s && s.list && s.list.length) return s;
    } catch (e) { /* private mode or corrupt — the defaults below */ }
    var names = {};
    MSLOT_DEFS.forEach(function (d) { names[d[0]] = d[1]; });
    return {
      list: MSLOT_DEFS.map(function (d) { return { k: d[0], n: d[1], t: d[2] }; }),
      names: names
    };
  }
  function mWriteSlots(s) {
    mStamp('sl');
    try { localStorage.setItem('bsc.macroSlots', JSON.stringify(s)); }
    catch (e) { /* private mode */ }
  }

  /* Every section there is, in book order, straight off the live data — the
     same source the browse filter reads, so the two can never drift apart. */
  /* Every consumer of this escapes the key. It is built from secNum, which
     arrives from the household document, and a section key that reaches an
     HTML attribute unescaped is a script tag in somebody else's app. sane()
     in sync.js now rebuilds the record rather than trusting it, which is the
     fix that holds; this is the one that holds if that one is ever loosened. */
  function mAllSections() {
    var seen = {}, out = [];
    RECIPES.forEach(function (r) {
      var key = r.book + '-' + r.secNum;
      if (!seen[key]) { seen[key] = true; out.push({ key: key, book: r.book, name: r.secName }); }
    });
    return out;
  }

  /* Which sections a meal draws from. The four kinds are named bundles of
     sections; 'x' means the reader chose their own boxes under Craft my plan.
     A custom set that lost all its boxes falls back to snacks rather than to
     a meal that can hold nothing. */
  function mSlotSecs(slot) {
    if (slot.t === 'x' && slot.secs && slot.secs.length) return slot.secs;
    return MEAL_SECS[slot.t] || MEAL_SECS.s;
  }

  function mDay(k) {
    // a fresh object when the day is empty — browsing ‹ › never writes a key
    return MDAYS[k] || {};
  }

  function mEditDay(k, fn) {
    var day = MDAYS[k] || (MDAYS[k] = {});
    fn(day);
    /* Only the past falls out of the window. A plan for Thursday is not a
       stale record, and pruning by one bound would have eaten it. */
    var floor = mEarliestKey(), roof = mLatestKey();
    Object.keys(MDAYS).forEach(function (dk) {
      if (dk < floor || dk > roof) delete MDAYS[dk];
    });
    try { localStorage.setItem('bsc.macroDays', JSON.stringify(MDAYS)); }
    catch (e) { /* in-memory only for this session */ }
    mStamp('d', k);
  }

  function kcalOf(t) { return Math.round(4 * t.p + 4 * t.c + 9 * t.f); }

  /* Which days you train, and what that does to the day.
   *
     RP does not eat the same thing seven days a week: a training day earns
     more carbohydrate and a rest day gives it back, so the WEEK averages to
     the plan while the days differ. Protein and fat hold steady — protein is
     the thing a cut protects and fat has a floor — so the carbohydrate
     carries the whole swing.
   *
     The days themselves are derived from the workouts-a-week already in the
     profile, spread evenly from Monday, and then overridden by tapping. The
     override is stored as its own list so a change to workouts-a-week does
     not silently rearrange days somebody has set by hand. */
  var MCYCLE_SWING = 0.25;         // a training day's carbs, over the average

  function mTrainDefault(n) {
    var out = [];
    n = Math.max(0, Math.min(7, Math.round(Number(n) || 0)));
    if (!n) return out;
    // evenly spread across Mon..Sun, so 3 lands on Mon/Wed/Fri rather than Mon/Tue/Wed
    for (var i = 0; i < n; i++) out.push(Math.round(i * 7 / n) % 7);
    return out.sort(function (a, b) { return a - b; });
  }

  /* Monday-based index, because a training week starts on Monday and
     getDay() starts on Sunday. */
  function mWkIx(d) { return (d.getDay() + 6) % 7; }

  function mTrainDays() {
    var pr = mReadProfile();
    if (pr.train && Object.prototype.toString.call(pr.train) === '[object Array]') {
      return pr.train.filter(function (n) { return n >= 0 && n <= 6; });
    }
    return mTrainDefault(pr.workouts);
  }

  /* The targets for one day rather than for every day. With no training days
     — or with all seven — there is nothing to cycle and this is the plan. */
  function mDayTargets(k) {
    var base = mReadTargets();
    var train = mTrainDays();
    var T = train.length, R = 7 - T;
    if (!T || !R || !base.c) return base;
    var hard = train.indexOf(mWkIx(keyDate(k))) >= 0;
    /* Whatever the training days gain, the rest days give back, so seven of
       these still add up to seven of the plan. */
    var f = hard ? (1 + MCYCLE_SWING) : (1 - MCYCLE_SWING * T / R);
    return { p: base.p, f: base.f, c: Math.max(0, Math.round(base.c * f)) };
  }

  function mIsTrainingDay(k) {
    var train = mTrainDays();
    return train.length > 0 && train.length < 7 && train.indexOf(mWkIx(keyDate(k))) >= 0;
  }

  function mReadProfile() {
    try {
      var pr = JSON.parse(localStorage.getItem('bsc.macroProfile'));
      if (pr && typeof pr === 'object') return pr;
    } catch (e) { /* private mode or corrupt */ }
    return { sex: 'm', age: 0, ft: 0, inch: 0, lb: 0, act: 1.55, goal: 'cut1',
      goalLb: 0, goalBy: '', workouts: 0, steps: 0 };
  }
  function mWriteProfile(pr) {
    mStamp('pr');
    try { localStorage.setItem('bsc.macroProfile', JSON.stringify(pr)); }
    catch (e) { /* private mode */ }
  }

  /* The four plans. kcal is the swing off maintenance; prot is grams per pound
     of bodyweight. The cuts carry more protein than maintenance because a
     deficit is when muscle is easiest to lose and protein is what argues for
     keeping it. */
  /* The four, as Renaissance Periodization frames them: a cut is a RATE, not
     a percentage off the day's burn.
   *
     This matters because the two scale differently. A flat quarter off the
     day gives a 205 lb man 1,905 kcal and a 120 lb woman 1,200 — the same
     fraction, wildly different propositions. A pound a week per hundred of
     bodyweight gives him 1,515 and her 1,000, which is the number the
     literature actually argues about, and which is what an app that says
     "hard cut" is expected to mean.
   *
     RP's own tiers run about 0.5% of bodyweight a week for slow, 0.75% for
     moderate and 1% for aggressive, and they stop there: past a percent, the
     weight coming off stops being mostly fat. Lean gain is slower still.
     rate is bodyweight fraction per week; positive takes weight off. */
  var MGOALS = {
    cut2: { rate: 0.0100, prot: 1.10 },
    cut1: { rate: 0.0075, prot: 1.00 },
    keep: { rate: 0.0000, prot: 0.85 },
    gain: { rate: -0.0025, prot: 0.90 }
  };

  /* The floor under every plan this app will write. It is an absolute
     number, not a fraction of anything: a quarter off a big man's day is a
     different proposition from a quarter off a small woman's, and the danger
     is in the absolute.
   *
     It used to be the basal rate, which sounds stricter and is — too strict
     to say what a hard cut means. A hard cut IS below basal; that is the
     whole of what makes it hard. What made the old below-basal day
     uneatable was not the calories but the split: protein held 1.1 g a pound
     whatever was left, so three percent of the day remained for everything
     else. Protein gives ground now, so the floor can be honest about what a
     cut is and the plate still fills. */
  function mFloorK(pr) { return pr.sex === 'f' ? 1200 : 1500; }

  /* Mifflin–St Jeor for the base burn, an activity multiplier for the day, the
     goal for the swing. Protein by bodyweight and goal; fat at a quarter of
     the calories but never under 0.3 g/lb, which is the floor hormones care
     about; carbs are whatever calories are left. On a very hard cut the
     leftovers can go negative — carbs floor at zero and `floored` says so
     rather than silently promising calories the grams do not add up to. */
  /* A day's burn before the goal touches it — null until the profile can say. */
  /* What a day costs, broken into the parts you can actually move.
   *
     The activity multiplier was a single vague dial — "active job, or 3-5
     workouts" — and the steps and sessions asked for underneath it were
     decorative: stored, printed back, and never once added up. Somebody
     asking what ten thousand steps buys them was being asked a question the
     app then ignored.
   *
     So the day is built rather than multiplied. A sedentary body costs about
     1.2 times its basal rate; walking costs roughly 0.53 kcal per kilo per
     kilometre, which at three-quarters of a metre a step is 0.037 kcal a
     step for a 205 lb man — 370 for ten thousand; and resistance training
     runs about 5 METs, near 366 kcal for a 45-minute session at that weight.
   *
     Built that way Blake's day comes to 2,539 kcal. His multiplier said
     2,540. The point was never a different number — it was a number with
     handles on it. */
  var MSTEP_BASE = 2500;          // steps a sedentary day already contains

  function mBurn(pr) {
    if (!pr.age || !pr.lb || !(pr.ft * 12 + pr.inch)) return null;
    var kg = pr.lb * 0.45359237;
    var cm = (pr.ft * 12 + pr.inch) * 2.54;
    var bmr = 10 * kg + 6.25 * cm - 5 * pr.age + (pr.sex === 'f' ? -161 : 5);
    var told = (Number(pr.steps) || 0) > 0 || (Number(pr.workouts) || 0) > 0;
    if (!told) {
      // nothing said about steps or sessions, so the old dial still answers
      return { bmr: bmr, base: bmr * pr.act, steps: 0, train: 0, tdee: bmr * pr.act, told: false };
    }
    var base = bmr * 1.2;
    var perStep = 0.53 * kg * 0.00075;
    var steps = Math.max(0, (Number(pr.steps) || 0) - MSTEP_BASE) * perStep;
    var train = (5 * 3.5 * kg / 200) * 45 * (Number(pr.workouts) || 0) / 7;
    return { bmr: bmr, base: base, steps: steps, train: train,
      tdee: base + steps + train, told: true };
  }

  /* What you actually burn, measured rather than assumed.
   *
     Mifflin–St Jeor is a population average, and an individual routinely sits
     two or three hundred calories either side of it — which on a cut is the
     difference between arriving in December and arriving in March. But the
     day already knows what you ate and the scale already knows what happened,
     and those two together say what you burn without any equation about your
     height at all:
   *
       burn = what you ate  −  what you stored
   *
     with a pound of body mass taken at 3500 kcal. Eat 2000 and lose a pound a
     week and you are burning 2500; eat 2000 and gain one and you are burning
     1500.
   *
     Two guards against believing noise. Weight is read as the average of the
     first week against the average of the last, never two single mornings —
     a Tuesday against a Tuesday is mostly water and yesterday's salt. And it
     will not answer at all under three weeks of overlap, because a fortnight
     of scale noise can manufacture several hundred calories of imaginary
     burn. */
  var MTDEE_MIN_DAYS = 21;

  function mMeasuredTdee() {
    var wKeys = Object.keys(MWEIGHTS).sort();
    if (wKeys.length < 8) return null;
    var dayN = function (k) { return Math.round(keyDate(k).getTime() / 86400000); };
    var lastN = dayN(wKeys[wKeys.length - 1]);
    var firstN = dayN(wKeys[0]);
    var span = lastN - firstN;
    if (span < MTDEE_MIN_DAYS) return null;

    /* A week at each end, and the distance between their middles — which is
       the span the weight change actually happened over. */
    var head = [], tail = [];
    wKeys.forEach(function (k) {
      if (dayN(k) - firstN < 7) head.push(MWEIGHTS[k]);
      if (lastN - dayN(k) < 7) tail.push(MWEIGHTS[k]);
    });
    if (head.length < 3 || tail.length < 3) return null;
    var mean = function (a) {
      return a.reduce(function (s, x) { return s + x; }, 0) / a.length;
    };
    var midHead = firstN + 3, midTail = lastN - 3;
    var days = midTail - midHead;
    if (days < 14) return null;

    /* Only days you actually put food on count, and every one of them has to
       be inside the window — an untouched day is a day you did not log, not a
       day you fasted, and averaging zeros in would invent a deficit. */
    var kcals = [];
    Object.keys(MDAYS).forEach(function (k) {
      var n = dayN(k);
      if (n < firstN || n > lastN) return;
      var t = mTotals(MDAYS[k]).all.kcal;
      if (t > 400) kcals.push(t);
    });
    if (kcals.length < 14) return null;

    var eaten = mean(kcals);
    var dLb = mean(tail) - mean(head);          // positive means gained
    var burn = eaten - (dLb * 3500 / days);
    if (!isFinite(burn) || burn < 800 || burn > 6000) return null;
    return {
      tdee: Math.round(burn), days: days, meals: kcals.length,
      eaten: Math.round(eaten), lb: Math.round(dLb * 10) / 10
    };
  }

  function mTdee(pr) {
    /* Measured beats estimated, once you have said so — the formula is only
       ever a stand-in for this number. */
    if (pr && pr.useTdee) {
      var m = mMeasuredTdee();
      if (m) return m.tdee;
    }
    var b = mBurn(pr);
    return b === null ? null : b.tdee;
  }

  /* Where the current plan lands you, and when. The same equation the date
     solves backwards, solved forwards: pick a pace, get a date. */
  function mProject(pr) {
    var plan = mPlanCalc(pr);
    if (!plan || !pr.goalLb || !pr.lb) return null;
    var lbs = pr.lb - pr.goalLb;
    if (Math.abs(lbs) < 0.5) return null;
    var tdee = mTdee(pr);
    var perWeek = (tdee - plan.kcal) * 7 / 3500;
    if (lbs > 0 ? perWeek <= 0.05 : perWeek >= -0.05) return null;
    var weeks = lbs / perWeek;
    if (weeks <= 0 || weeks > 260) return null;
    var d = new Date();
    d.setDate(d.getDate() + Math.round(weeks * 7));
    return { perWeek: perWeek, weeks: weeks, when: d, lbs: lbs };
  }

  /* What one more lever is worth, said both ways — because both are true and
     people mean different ones. More walking either buys food at the same
     pace, or the same food sooner. */
  function mLever(pr, extraKcal) {
    var pj = mProject(pr);
    var out = { kcal: Math.round(extraKcal), weeks: null };
    if (pj) {
      var faster = pj.perWeek + (pj.lbs > 0 ? 1 : -1) * extraKcal * 7 / 3500;
      var w2 = pj.lbs / faster;
      if (w2 > 0) out.weeks = pj.weeks - w2;
    }
    return out;
  }

  /* A goal with a date does its own arithmetic: the pounds between here and
     there, over the weeks between now and then, at 3500 kcal to the pound.
     It beats a preset because it is answerable — you either arrive or you
     do not — and it is what the preset was standing in for.
   *
     Capped at 1% of bodyweight a week. Past that a cut stops being a cut and
     starts costing muscle, and the sheet says so rather than quietly writing
     a number nobody should eat to. */
  function mGoalPace(pr) {
    if (!pr.goalLb || !pr.goalBy || !pr.lb) return null;
    var tdee = mTdee(pr);
    if (tdee === null) return null;
    var days = Math.round((keyDate(pr.goalBy) - keyDate(todayKey())) / 86400000);
    if (!isFinite(days) || days < 7) return null;
    var lbs = pr.lb - pr.goalLb;
    var wanted = lbs / (days / 7);
    var bmr = tdee / (pr.act || 1);

    /* Three caps, and the one that used to be here was the weakest of them.
     *
     * A pound a week per hundred of bodyweight sounds careful until you do
     * the arithmetic on a big frame: at 205 lb it allows 2.05 lb a week,
     * which is a 1,025 kcal deficit — forty percent of the day's burn, and
     * three hundred calories BELOW what the body spends lying still. The app
     * was writing that plan and then wondering why no real meal would fit
     * inside it: sixty percent of the calories went to protein, three
     * percent to carbs, and every suggestion came back a quarter portion.
     *
     * So the rate cap keeps its place, but two more sit in front of it: no
     * more than a quarter off the day's burn, and never a day under the
     * basal rate. Whichever bites first wins, and the plan says so. */
    var floorK = mFloorK(pr);
    var maxOff = Math.max(0, tdee - floorK);
    var maxOn = 0.20 * tdee;                       // gaining, the other way
    var capRate = pr.lb * (lbs >= 0 ? 0.01 : 0.005);
    var capKcal = (lbs >= 0 ? maxOff : maxOn) * 7 / 3500;
    var cap = Math.min(capRate, capKcal);

    var perWeek = wanted;
    var capped = Math.abs(perWeek) > cap;
    if (capped) perWeek = perWeek > 0 ? cap : -cap;
    /* When the date cannot be met, the honest thing is to say when it can. */
    var realWeeks = perWeek ? Math.abs(lbs / perWeek) : null;
    return { days: days, lbs: lbs, perWeek: perWeek, capped: capped,
      kcal: perWeek * 3500 / 7, realWeeks: realWeeks,
      floorK: floorK, wanted: wanted };
  }

  function mPlanCalc(pr) {
    var tdee = mTdee(pr);
    if (tdee === null) return null;
    var g = MGOALS[pr.goal] || MGOALS.cut1;
    var pace = mGoalPace(pr);
    /* One engine, two ways in: a date works out the rate it needs, a preset
       names one outright. Both arrive here as pounds a week. */
    var perWeek = pace ? pace.perWeek : g.rate * pr.lb;
    var kcal = Math.max(mFloorK(pr), Math.round(tdee - perWeek * 3500 / 7));
    var protPerLb = pace
      ? (perWeek > 0.05 ? (perWeek > pr.lb * 0.009 ? 1.10 : 1.00)
        : perWeek < -0.05 ? 0.90 : 0.85)
      : g.prot;
    var p = Math.round(protPerLb * pr.lb);
    var f = Math.round(Math.max(0.3 * pr.lb, 0.25 * kcal / 9));
    /* Protein and fat first, but not to the last calorie. A day left with
       three percent of itself for carbohydrate is a day no dinner in the
       book fits inside, and the picker can only answer it with quarter
       portions. Protein gives ground before the plate does — down to 0.8 g
       a pound, which is still more than a cut needs. */
    var minC = Math.round(0.15 * kcal / 4);
    if ((kcal - 4 * p - 9 * f) / 4 < minC) {
      var room = kcal - 9 * f - 4 * minC;
      p = Math.max(Math.round(0.8 * pr.lb), Math.round(room / 4));
    }
    var c = Math.max(0, Math.round((kcal - 4 * p - 9 * f) / 4));
    return { kcal: kcal, p: p, f: f, c: c, floored: kcal - 4 * p - 9 * f < 0 };
  }

  /* The scale, once a day if you feel like it. Weights keep their own store
     with their own horizon: a day of meals is stale in two weeks, but a weight
     trend is the whole point of writing the number down, so these live for a
     year. Same privacy bargain as the rest of the tab — this phone only. */
  /* Which days you have said you are finished with.
   *
     Keyed day -> the moment you closed it, so the card can say when and a
     zero can mean "reopened" rather than "never closed" — which is what lets
     a reopen travel between devices instead of being silently re-closed by
     whichever one still remembers the original. */
  var MDONE = (function () {
    try {
      var d = JSON.parse(localStorage.getItem('bsc.macroDone'));
      if (d && typeof d === 'object' && !Array.isArray(d)) return d;
    } catch (e) { /* fall through */ }
    return {};
  })();
  function mDoneAt(k) { return Number(MDONE[k]) || 0; }
  function mSetDone(k, on) {
    MDONE[k] = on ? Date.now() : 0;
    try { localStorage.setItem('bsc.macroDone', JSON.stringify(MDONE)); } catch (e) { /* private */ }
    mStamp('dn', k);
  }

  /* Meals you have said you are not eating today.
   *
     Keyed day -> the slot keys skipped, with a stamp beside them so a skip
     travels the way a closed day does. Not a scalar on the day object: the
     day is a map of slot -> plates and half the app walks it with
     `(day[k] || []).forEach`, so a stray number in there is a thrown error
     three files away.

     It has to reach the arithmetic and not only the card. An empty meal still
     RESERVES its share — mShares divides the day across every empty slot — so
     a lunch you have decided against goes on holding a quarter of the day and
     quietly aims every other meal lower. Skipping releases it. */
  var MSKIP = (function () {
    try {
      var d = JSON.parse(localStorage.getItem('bsc.macroSkip'));
      if (d && typeof d === 'object' && !Array.isArray(d)) return d;
    } catch (e) { /* fall through */ }
    return {};
  })();
  function mSkipped(k, sk) {
    var a = MSKIP[k];
    return !!a && a.indexOf(sk) >= 0;
  }
  function mSetSkip(k, sk, on) {
    var a = (MSKIP[k] || []).filter(function (x) { return x !== sk; });
    if (on) a.push(sk);
    if (a.length) MSKIP[k] = a; else delete MSKIP[k];
    try { localStorage.setItem('bsc.macroSkip', JSON.stringify(MSKIP)); } catch (e) { /* private */ }
    mStamp('sp', k);
  }

  var MWEIGHTS = (function () {
    try {
      var w = JSON.parse(localStorage.getItem('bsc.macroWeights'));
      if (w && typeof w === 'object' && !Array.isArray(w)) return w;
    } catch (e) { /* fall through */ }
    return {};
  })();

  function mWriteWeight(k, lb) {
    if (lb) MWEIGHTS[k] = Math.round(lb * 10) / 10;
    else delete MWEIGHTS[k];              // clearing the box un-logs the day
    var d = new Date();
    d.setDate(d.getDate() - 399);
    var floor = dayKey(d);
    Object.keys(MWEIGHTS).forEach(function (wk) { if (wk < floor) delete MWEIGHTS[wk]; });
    try { localStorage.setItem('bsc.macroWeights', JSON.stringify(MWEIGHTS)); }
    catch (e) { /* in-memory only for this session */ }
    mStamp('w');
  }

  /* The numbers a cut actually reads. The seven-day average is the headline —
     a single morning is water and yesterday's salt — and the week is judged
     average against average, not spike against spike. */
  function mWeightStats() {
    var keys = Object.keys(MWEIGHTS).sort();
    if (!keys.length) return null;
    var dayN = function (k) { return Math.round(keyDate(k).getTime() / 86400000); };
    var lastN = dayN(keys[keys.length - 1]);
    var w7 = [], prev7 = [];
    keys.forEach(function (k) {
      var back = lastN - dayN(k);
      if (back < 7) w7.push(MWEIGHTS[k]);
      else if (back < 14) prev7.push(MWEIGHTS[k]);
    });
    var avg = function (a) { return a.reduce(function (s, x) { return s + x; }, 0) / a.length; };
    var last = keys[keys.length - 1];
    return {
      n: keys.length, latest: MWEIGHTS[last], lastKey: last, firstKey: keys[0],
      avg7: avg(w7),
      dWeek: prev7.length ? avg(w7) - avg(prev7) : null,
      dStart: MWEIGHTS[last] - MWEIGHTS[keys[0]]
    };
  }

  function mSparkSVG() {
    var keys = Object.keys(MWEIGHTS).sort().slice(-60);
    if (keys.length < 2) return '';
    var dayN = function (k) { return Math.round(keyDate(k).getTime() / 86400000); };
    var x0 = dayN(keys[0]), x1 = dayN(keys[keys.length - 1]);
    var lo = Infinity, hi = -Infinity;
    keys.forEach(function (k) {
      if (MWEIGHTS[k] < lo) lo = MWEIGHTS[k];
      if (MWEIGHTS[k] > hi) hi = MWEIGHTS[k];
    });
    if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }   // a flat line should look flat, not jagged
    var W = 280, H = 44;
    var pts = keys.map(function (k) {
      var x = (dayN(k) - x0) / (x1 - x0) * W;
      var y = 3 + (H - 6) * (1 - (MWEIGHTS[k] - lo) / (hi - lo));
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    return '<svg class="mw-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  }

  function mLbWord(d) {
    var v = Math.round(Math.abs(d) * 10) / 10;
    return d <= -0.05 ? 'down ' + v + ' lb' : d >= 0.05 ? 'up ' + v + ' lb' : 'holding steady';
  }

  function mPretty(k) {
    var d = keyDate(k);
    return M_MONS[d.getMonth()] + ' ' + d.getDate();
  }

  /* The plan, in two lines, where a button used to sit.
   *
   * Crafting a plan is a thing you do every few months; a button for it had
   * prime daily real estate and said nothing the rest of the time. What
   * belongs there is what the plan is doing FOR you — the destination, how
   * far off it is, and whether the scale agrees you are getting there — with
   * the way in tucked on the end. When there is no plan, the same line is
   * the invitation to make one, which is the only moment a button was ever
   * the right answer. */
  /* Whether the scale agrees with the plan, in two words. Both sides are
     normalized to "progress toward the goal", so the bar to clear is always
     the positive one. Negating it for a gain goal made every threshold
     negative, which told somebody trying to put weight ON that standing
     still — or losing — was ahead of pace. */
  function mPaceVerdict(st, togo, weeks) {
    if (!st || st.dWeek === null) return null;
    var need = Math.abs(togo) / weeks;
    var moving = -st.dWeek;                         // pounds off per week
    var got = togo >= 0 ? moving : -moving;         // ...toward the goal
    return got >= need * 1.15 ? ['ahead of pace', 'good']
      : got >= need * 0.85 ? ['on pace', 'good'] : ['behind pace', 'off'];
  }

  /* The plan in one line, for the face of the morning card: the goal, the
     gap, and whether the scale agrees. That is the fact you steer by, and it
     is the only part of the plan that earns a place on a screen you open
     every day — the arithmetic behind the verdict is evidence, and evidence
     goes behind the press with the rest of the evidence.
   *
     What used to sit here and no longer does: "Two weeks of mornings and
     this says whether you are on pace." That is the app explaining itself,
     which is the one thing the copy is not for. Before there are two weeks
     of mornings the card simply does not claim a verdict. */
  function mPlanFace() {
    var pr = mReadProfile();
    var plan = mPlanCalc(pr);
    if (!plan) return { has: false, html: 'No plan yet.' };
    var pace = mGoalPace(pr);
    if (!pace) {
      return { has: true, html: '<b>' + esc(MGOAL_WORDS[pr.goal] || MGOAL_WORDS.cut1) +
        '</b> &middot; ' + plan.kcal + ' kcal a day &middot; name a weight and a date to track the arrival' };
    }
    var st0 = mWeightStats();
    var now0 = st0 ? st0.avg7 : pr.lb;
    var togo0 = Math.round((now0 - pr.goalLb) * 10) / 10;
    var weeks0 = Math.max(1, Math.round(pace.days / 7));
    var d0 = keyDate(pr.goalBy);
    var out = '<b>' + pr.goalLb + ' lb by ' + M_MONS[d0.getMonth()] + ' ' + d0.getDate() +
      '</b> &middot; ' + Math.abs(togo0) + ' lb to go over ' + weeks0 +
      (weeks0 === 1 ? ' week' : ' weeks');
    var v0 = mPaceVerdict(st0, togo0, weeks0);
    if (v0) out += ' <span class="mplan-v ' + v0[1] + '">' + v0[0] + '</span>';
    return { has: true, html: out };
  }

  /* The arithmetic the verdict came out of, for behind the press. Silent
     until the scale has an opinion: one week of mornings is water, not a
     trend, and a line that says so is a line about the app. */
  function mPlanDetail() {
    var pr = mReadProfile();
    if (!mPlanCalc(pr)) return '';
    var pace = mGoalPace(pr);
    var st = mWeightStats();
    if (!pace || !st || st.dWeek === null) return '';
    var togo = Math.round((st.avg7 - pr.goalLb) * 10) / 10;
    var weeks = Math.max(1, Math.round(pace.days / 7));
    return 'Averaging ' + (Math.round(st.avg7 * 10) / 10) + ' lb, ' + mLbWord(st.dWeek) +
      ' a week. Needs ' + (Math.round(Math.abs(togo) / weeks * 10) / 10) + '.';
  }


  /* One sentence, and most mornings it says nothing to do.
   *
     Everything above it — the limits, the moving range, the measured burn —
     exists to earn that word. A chart that tells you you are fine is doing
     more work than one that tells you to try harder, because the failure on
     a cut is not laziness. It is cutting calories after a salty Tuesday and
     then wondering why the week went badly. Deming called that tampering:
     reacting to routine variation makes a process worse, not better. */
  var MSALT_JUMP = 1.0;                 // lb overnight worth explaining
  var MSALT_DAY = 2800;                 // mg the day before that explains it

  /* What the plan said the scale would read today. Anchored on the first
     morning that was logged rather than on the weight typed into the profile
     — one is a measurement and the other is a memory. */
  function mPlanWeight(k, pr) {
    if (!pr.goalLb || !pr.goalBy) return null;
    var keys = Object.keys(MWEIGHTS).sort();
    if (!keys.length) return null;
    var dayN = function (x) { return Math.round(keyDate(x).getTime() / 86400000); };
    var from = dayN(keys[0]), to = dayN(pr.goalBy), now = dayN(k);
    if (to <= from) return null;
    var span = to - from;
    var per = (pr.goalLb - MWEIGHTS[keys[0]]) / span;      // lb a day, negative on a cut
    return { lb: MWEIGHTS[keys[0]] + per * (now - from), per: per, daysLeft: to - now };
  }

  /* The day-to-day jump, and how big a jump is ordinary for this person.
     Wheeler's moving range: the limit is 3.268 times its own average. */
  function mJump(k) {
    var keys = Object.keys(MWEIGHTS).sort();
    var at = keys.indexOf(k);
    if (at < 1) return null;
    var mr = [];
    for (var i = 1; i < keys.length; i++) mr.push(Math.abs(MWEIGHTS[keys[i]] - MWEIGHTS[keys[i - 1]]));
    if (mr.length < 5) return null;
    var bar = mr.reduce(function (a, b) { return a + b; }, 0) / mr.length;
    return {
      d: MWEIGHTS[k] - MWEIGHTS[keys[at - 1]],
      bar: bar, url: 3.268 * bar, prevKey: keys[at - 1]
    };
  }

  function mSodiumOn(k) {
    if (!MDAYS[k]) return 0;
    return Math.round(mTotals(MDAYS[k]).all.na);
  }

  function mMorningHTML(k) {
    if (mAhead(k)) return '';                     // a morning that has not happened
    var pr = mReadProfile();
    var st = mWeightStats();
    var meas = mMeasuredTdee();

    /* Salt first, because it is the one that stops you doing something. A
       jump the app can explain is a jump you should not act on, and this is
       true long before there is enough history to measure a burn. */
    var jump = mJump(k);
    if (jump && jump.d >= MSALT_JUMP) {
      var yest = mSodiumOn(jump.prevKey);
      if (yest >= MSALT_DAY) {
        var big = jump.d > jump.url;
        return mLineHTML('noise', '\uD83E\uDDC2',
          '<b>Up ' + (Math.round(jump.d * 10) / 10) + ' lb \u2014 that is salt, not fat.</b> ' +
          esc(mPretty(jump.prevKey)) + ' was ' + yest.toLocaleString() + ' mg.',
          /* Two different true things, and claiming the wrong one would be
             worse than saying nothing: a jump inside your usual range needs
             no explaining, and one outside it needs this one. */
          big
            ? 'Bigger than your usual ' + (Math.round(jump.url * 10) / 10) +
              ' lb overnight \u2014 and the salt accounts for it. The seven-day average is what to watch.'
            : 'Inside your usual overnight range of ' + (Math.round(jump.url * 10) / 10) + ' lb.');
      }
    }

    /* Then pace, which needs a plan to be off. */
    var plan = mPlanWeight(k, pr);

    /* No date named, so there is no pace to be off — but there is still the
       most useful thing this whole apparatus computes. A burn measured from
       what you ate and what the scale did says what your deficit actually is,
       and that is worth knowing whether or not you have named a day to arrive
       on. Saying nothing here was treating a goal date as the price of
       admission to your own numbers. */
    if (!plan) {
      if (!meas) return '';
      var ate = meas.eaten, gap = meas.tdee - ate;
      var lbWk = Math.round(gap * 7 / 3500 * 10) / 10;
      return mLineHTML(Math.abs(lbWk) < 0.2 ? 'wait' : 'calm', '\u25CE',
        '<b>You are burning about ' + meas.tdee.toLocaleString() + ' a day</b> and eating ' +
        ate.toLocaleString() + '.',
        lbWk > 0.2 ? 'That is ' + lbWk + ' lb a week off, measured over ' + meas.days + ' days.'
          : lbWk < -0.2 ? 'That is ' + Math.abs(lbWk) + ' lb a week on, measured over ' +
            meas.days + ' days.'
            : 'Which is maintenance, measured over ' + meas.days + ' days.');
    }

    if (!st || st.n < 14) {
      var have = st ? st.n : 0;
      var days = Object.keys(MDAYS).filter(function (dk) {
        return mTotals(MDAYS[dk]).all.kcal > 400;
      }).length;
      return mLineHTML('wait', '\u25F7',
        (14 - have > 0 ? (14 - have) + ' more mornings' : 'A few more logged days') +
        ' and this will say whether you are on pace.',
        have + ' of 14 weigh-ins &middot; ' + days + ' of 14 days logged');
    }

    var off = st.avg7 - plan.lb;                  // positive means heavier than planned
    var perWeek = plan.per * 7;
    var daysOff = plan.per ? Math.round(off / -plan.per) : 0;
    var burn = meas ? meas.tdee : mTdee(pr);
    /* Where you land at the rate you are actually going, and what it would
       take to land where you meant to. */
    /* The same three caps the plan calculator lives under, because a line
       that says "eat 1,278" is not advice — it is arithmetic with nobody
       reading it. Never under the basal rate, never more than a quarter off
       the day's burn. When the honest number is capped, the date is what
       moves, and the line says so instead of pretending. */
    var bmr = mBurn(pr) ? mBurn(pr).bmr : null;
    var rawNeed = burn === null ? null
      : burn - (st.avg7 - pr.goalLb) * 3500 / Math.max(1, plan.daysLeft);
    var floor = Math.max(bmr || 0, burn === null ? 0 : burn * 0.75);
    var capped = rawNeed !== null && rawNeed < floor;
    /* Rounded UP off the floor, never down onto it: a number printed a
       calorie under the basal rate is still a number under the basal rate. */
    var need = rawNeed === null ? null
      : capped ? Math.ceil(floor) : Math.round(rawNeed);
    var arrive = null;
    if (st.dWeek !== null && st.dWeek < -0.05) {
      var wk = Math.ceil((st.avg7 - pr.goalLb) / -st.dWeek);
      var ad = new Date();
      ad.setDate(ad.getDate() + wk * 7);
      arrive = M_MONS[ad.getMonth()] + ' ' + ad.getDate();
    }

    /* The band around the plan, from the same moving ranges. Inside it there
       is nothing to decide, and saying so is the whole job. */
    var band = jump ? 2.660 * jump.bar : 3;
    var rate = st.dWeek === null ? null : Math.round(st.dWeek * 10) / 10;
    var rateWord = rate === null ? '' : 'Down ' + Math.abs(rate) + ' lb a week';
    /* With carb cycling on, the number this offers is the week's average and
       no single day will read it back — a training day runs higher and a rest
       day lower. Pressing a button marked 1,853 and watching the bar say
       1,667 is the app appearing to ignore you, so it says which it means. */
    var cyc = mTrainDays().length > 0 && mTrainDays().length < 7 ? ' a day on average' : '';

    if (off > band) {
      return mLineHTML('act', '\u25B2',
        '<b>' + Math.abs(daysOff) + ' days behind pace.</b>' +
        (meas ? ' Your burn measures <b>' + meas.tdee.toLocaleString() + '</b>, not the ' +
          Math.round(mBurn(pr) ? mBurn(pr).tdee : meas.tdee).toLocaleString() +
          ' the formula assumed.' : ''),
        (arrive ? 'At this rate you arrive ' + arrive + '. ' : '') +
        (need === null ? ''
          : capped
            ? 'Landing on time would want less than a body should be asked for, so ' +
              (need.toLocaleString() + ' is as low as this goes \u2014 the date is what moves.')
            : 'Landing on time wants about ' + need.toLocaleString() + ' kcal' + cyc + '.') +
        (cyc ? ' Training days run higher than that and rest days lower.' : ''),
        need ? [['Eat ' + need.toLocaleString(), 'mline:eat:' + need],
          ['Leave it', 'mline:none']] : null);
    }
    if (off < -band) {
      var room = need;
      return mLineHTML('ahead', '\u25BC',
        '<b>' + Math.abs(daysOff) + ' days ahead of pace.</b>' +
        (room ? ' You could eat <b>' + room.toLocaleString() + '</b>' + cyc +
          ' and still arrive on time.' : ''),
        rateWord + (rate === null ? '' : ' \u2014 faster than you asked for') + '.' +
        (cyc ? ' Training days run higher than that and rest days lower.' : ''),
        room ? [['Eat ' + room.toLocaleString(), 'mline:eat:' + room],
          ['Keep going', 'mline:none']] : null);
    }
    return mLineHTML('calm', '\u2713',
      '<b>Nothing to change.</b> On pace for ' + pr.goalLb + ' lb by ' +
      esc(mPretty(pr.goalBy)) + '.',
      (rateWord ? rateWord + ' \u00b7 ' : '') +
      (meas ? 'burn measures ' + meas.tdee.toLocaleString() : 'formula burn ' +
        (burn === null ? '\u2014' : Math.round(burn).toLocaleString())));
  }

  function mLineHTML(kind, icon, text, sub, acts) {
    return '<div class="mline ' + kind + '" role="status">' +
      '<span class="mline-i" aria-hidden="true">' + icon + '</span>' +
      '<span class="mline-b">' +
        '<span class="mline-t">' + text + '</span>' +
        (sub ? '<span class="mline-s">' + sub + '</span>' : '') +
        (acts ? '<span class="mline-a no-print">' + acts.map(function (a, i) {
          return '<button class="' + (i ? 'ghost' : 'btn-primary') + '" data-mline="' +
            esc(a[1]) + '">' + esc(a[0]) + '</button>';
        }).join('') + '</span>' : '') +
      '</span>' +
    '</div>';
  }

  function macroWeighHTML(k) {
    var v = MWEIGHTS[k];
    var st = mWeightStats();
    var body;
    if (st && st.n >= 2) {
      var r1 = Math.round(st.latest * 10) / 10 + ' lb on ' + mPretty(st.lastKey) +
        ' &middot; seven-day average ' + (Math.round(st.avg7 * 10) / 10);
      var r2 = (st.dWeek === null ? '' : mLbWord(st.dWeek) + ' on the week before &middot; ') +
        mLbWord(st.dStart) + ' since ' + mPretty(st.firstKey);
      /* What the plan is aiming for, so the trend has something to be judged
         against: the gap between the day's burn and the day's targets, read
         at 3500 kcal to the pound. */
      var pace = '';
      var tdee = mTdee(mReadProfile());
      if (tdee !== null) {
        var rate = (tdee - kcalOf(mReadTargets())) * 7 / 3500;
        if (Math.abs(rate) >= 0.2) {
          pace = '<div class="mw-stat">the plan expects about ' +
            Math.round(Math.abs(rate) * 10) / 10 + ' lb a week ' + (rate > 0 ? 'off' : 'on') + '</div>';
        }
      }
      body = '<div class="mw-stat">' + r1 + '</div><div class="mw-stat">' + r2 + '</div>' +
        pace + mSparkSVG();
    } else {
      body = '<div class="mw-stat">The seven-day average appears here.</div>';
    }
    /* ---- the morning card ----
     * The same card the meals wear, and now the whole morning rather than
     * half of it. The weigh-in and the plan were two cards saying one thing:
     * one held the number, the other held what the number meant, and reading
     * the second meant carrying the first down the screen to it. Together
     * they took about two hundred pixels before the day reached any food.
     *
     * What is on the face is what you do every morning and the one line that
     * says whether it is working. What is behind the press is the evidence
     * for that line — the average, the week, the sparkline, and the way in to
     * change the plan. Crafting a plan is a once-a-season job and does not
     * get a permanent seat; the press is the same one the meal cards wear,
     * so the gesture is already learned by the time it is needed here, and
     * "Craft my plan" stays in the gear as a second way in.
     *
     * The one exception on the face is the morning line, and it earns it by
     * being rare and by being the only line in the app that ever tells you
     * NOT to act on the number above it. A salt jump you cannot see is a
     * salt jump you cut calories over. */
    var shut = S.mFold.weigh !== false;
    var face = mPlanFace();
    var detail = mPlanDetail();
    if (detail) body = '<div class="mw-stat">' + detail + '</div>' + body;
    var head = st && st.n >= 2
      ? Math.round(st.avg7 * 10) / 10 + ' lb avg' +
        (st.dWeek === null ? '' : ' &middot; ' + mLbWord(st.dWeek) + ' this week')
      : '';
    var ahead = mAhead(k);
    return '<div class="mslot-h">' +
        '<button class="mday-dot no-print" data-mdot="weigh"' + (ahead ? ' disabled' : '') +
          ' aria-label="Log this morning&rsquo;s weight"></button>' +
        '<button class="mslot-name" data-mfold="weigh" aria-expanded="' +
          (shut ? 'false' : 'true') + '">Weigh-in</button>' +
        (head ? '<span class="mw-avg">' + head + '</span>' : '') +
        (ahead
          ? '<span class="mw-avg mw-later">not yet</span>'
          : '<label class="mt-lab no-print">Weight <input type="number" id="mWeight" min="0" max="1500" ' +
            'step="0.1" inputmode="decimal" value="' + (v || '') + '"> lb</label>') +
      '</div>' +
      /* The plan, one line, on the face — and the same handle the meals wear,
         on the seam rather than in the header: this line is the last thing
         above what folds away, so the mark on the end of it is sitting at the
         edge that moves.
       *
         With no plan yet the line is the invitation instead, and then it is
         not a handle at all: it carries a button of its own, and a button
         inside a button is not a thing. The name still folds the card. */
      (face.has
        ? '<button class="mw-verdict" data-mfold="weigh" aria-expanded="' +
          (shut ? 'false' : 'true') + '" aria-label="' +
          (shut ? 'Open the trend and the plan' : 'Fold the trend and the plan') + '">' +
          face.html + '<span class="mfold-cue" aria-hidden="true">&#8964;</span></button>'
        : '<div class="mw-verdict">' + face.html +
          ' <button class="ghost mplan-go no-print" id="macroTargBtn">Craft my plan</button></div>') +
      mMorningHTML(k) +
      (shut ? '' : '<div class="mw-body">' + body +
        (face.has
          ? '<div class="mw-adj no-print">' +
            '<button class="ghost mplan-go" id="macroTargBtn">Adjust my plan</button></div>'
          : '') +
      '</div>');
  }

  /* Everything on the day counts against the budget, eaten or not — putting a
     dinner on the plan is committing its grams, and the picker must not offer
     the same grams twice. Eaten is tracked separately for the bars. */
  function mTotals(day) {
    /* Sodium and fibre ride along. Every recipe has carried both since the
       book was built — they feed the leaf score — and neither has ever been
       shown on a day, which is how the app came to draft 3,400 mg days
       without mentioning it. */
    var all = { p: 0, f: 0, c: 0, kcal: 0, na: 0, fib: 0 };
    var eaten = { p: 0, f: 0, c: 0, kcal: 0, na: 0, fib: 0 };
    var est = false;
    /* Over the day's own keys, not the current meal list: a plate logged
       under a meal since removed from the plan still went into a mouth. */
    Object.keys(day).forEach(function (sk) {
      (day[sk] || []).forEach(function (it) {
        var r = BY_ID[it.id];
        if (!r || !r.macro) return;
        if (r.est) est = true;
        ['p', 'f', 'c', 'kcal', 'na', 'fib'].forEach(function (m) {
          var v = (r.macro[m] || 0) * it.x;
          all[m] += v;
          if (it.eaten) eaten[m] += v;
        });
      });
    });
    return { all: all, eaten: eaten, est: est };
  }

  /* A day is finished when everything on it has been eaten. Plates whose
     food is gone from the table do not count either way — they cannot be
     ticked, so they must not keep a day open forever. An empty day is not
     finished, it is empty. */
  function mDayDone(day) {
    var n = 0, left = 0;
    Object.keys(day).forEach(function (sk) {
      (day[sk] || []).forEach(function (it) {
        if (!BY_ID[it.id]) return;
        n++;
        if (!it.eaten) left++;
      });
    });
    return n > 0 && left === 0;
  }

  /* How much of the day each meal deserves. Split evenly, a before-bed snack
     was offered a plate the size of dinner's; these are the thumbs on the
     scale. Editable per meal under Craft my plan; the numbers are weights,
     not a percentage that must sum to anything. */
  var MSLOT_W = { b: 20, l: 25, d: 35, s: 10, x: 15 };
  function mSlotW(slot) {
    var w = Number(slot.w);
    return w > 0 ? w : (MSLOT_W[slot.t] || 15);
  }

  /* What THIS meal should reach for, and what the day can still absorb.
     R is the day's remaining grams, floored at zero. T is the meal's share
     of it — R split over the still-empty slots by their weights, so dinner
     reaches for dinner's portion of what is left and a snack for a snack's —
     and D normalizes penalties to the size of the target so the weights mean
     the same thing whether the target is 50 grams or 180. */
  function mShares(day, targets, slot) {
    var tot = mTotals(day);
    var w = slot ? mSlotW(slot) : 1;
    var sumW = 0, counted = false;
    var dk = mViewKey();
    mReadSlots().list.forEach(function (s) {
      var isThis = slot && s.k === slot.k;
      /* A skipped meal claims nothing. This is the whole point of the skip:
         an empty meal reserves its share and drags every other meal down to
         make room for food that is never coming. */
      if (!isThis && mSkipped(dk, s.k)) return;
      if (!(day[s.k] || []).length || isThis) {
        sumW += mSlotW(s);
        if (isThis) counted = true;
      }
    });
    if (slot && !counted) sumW += w;    // a bygone meal still being served
    if (!sumW) sumW = w;
    var frac = w / sumW;
    var R = {}, T = {}, D = {};
    ['p', 'f', 'c'].forEach(function (m) {
      R[m] = Math.max(0, targets[m] - tot.all[m]);
      T[m] = R[m] * frac;
      D[m] = Math.max(1, targets[m]);
    });
    return { R: R, T: T, D: D };
  }

  /* Fill your share, never bust the day.
   *
   * Undershoot is judged against the MEAL's share T — a breakfast is not
   * blamed for failing to deliver the whole day's protein — but overshoot is
   * judged against the DAY's remaining R, because a portion that spends grams
   * the day no longer has is a problem no matter which meal spends them. That
   * one asymmetry is what makes the same formula behave at nine in the morning
   * (share = a quarter of the day, ×1 of a normal breakfast scores high) and
   * at nine at night (share = exactly the gap, the picker chases it).
   *
   * The weights are the cut, written down: protein is the only macro that is
   * expensive to leave on the table (1.00 under vs 0.55 for fat and carbs),
   * and going over on fat or carbs costs about twice what undershooting them
   * does (1.20 vs 0.55). Protein overshoot is mildly charged (0.35) so nobody
   * is told to eat three chicken dinners at bedtime.       [under, over]
   *
   * Fat and carbs were once 0.10 under against 2.00 over — twenty to one, on
   * the theory that busting a cut is the thing to fear. Measured over ten
   * drafted days at each of the four goals, that theory cost 250 to 350
   * calories a day and, on a hard cut, 52 grams of protein; it bought nothing,
   * because not one day at any weighting went over on fat or carbohydrate.
   * There was no bust to protect against. Two to one keeps the instinct —
   * under still beats over on a cut — at a price the day can pay. */
  var MW = { p: [1.00, 0.35], f: [0.55, 1.20], c: [0.55, 1.20] };

  /* Half a serving up to three. x is servings EATEN, not batches cooked, so
     there is no cap tied to servN — three servings of a six-serving roast is a
     plate, and a dessert at any x sinks on its own fat and carbs. */
  var MX = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

  /* How far over its own share a single suggested portion may go.
   *
     Undershoot is judged against the meal's share and overshoot against the
     DAY's remaining, which is right for the day and blind for the meal: at
     breakfast, with nothing eaten yet, one dish can claim all of the day's
     protein and be charged nothing for it. The ranking did exactly that — it
     offered three servings of a 271 kcal plate, 813 kcal, for a meal whose
     share was 381.

     Nobody asked the app for that and it is where a lot of overeating starts:
     not a plan gone wrong later, a number too big when it was first put in
     front of you. So a portion may run over its share, because meals are not
     equal and the day still has to be filled — but not without limit.

     1.15 is measured, not chosen: swept over 600 seeded days at 1.15 / 1.25 /
     1.35 / 1.5 / 1.75 / 2.0 against no cap at all. It gives the best meal
     balance (meals off their share 813 -> 427 kcal), better protein than no
     cap (5.3 -> 4.8 g), and a third as many oversized plates as the next
     setting up. It costs about 16 kcal a day of precision on the day's total,
     which is the honest price of not stuffing the day through one meal.

     Only the SUGGESTION is bound. mBalanceDay does its own sizing against the
     whole day and is deliberately left alone: it is what lets the day still
     reach its protein, and constraining it costs about 14 g a day, which is
     measured and not worth it. */
  var MX_OVER = 1.15;

  function macroFit(r, R, T, D) {
    var best = null, smallest = null;
    // the share in calories, which is the thing a portion can be too big for
    var roof = MX_OVER * (4 * (T.p || 0) + 4 * (T.c || 0) + 9 * (T.f || 0));
    var kc = (r.macro && r.macro.kcal) || 0;
    for (var i = 0; i < MX.length; i++) {
      var x = MX[i], pen = 0;
      for (var m in MW) {
        var s = (r.macro[m] || 0) * x;
        pen += MW[m][0] * Math.max(0, T[m] - s) / D[m];
        pen += MW[m][1] * Math.max(0, s - R[m]) / D[m];
      }
      var sc = Math.round(100 * (1 - pen));
      // strict >, walking x upward: a tie keeps the smaller portion. On a cut,
      // when two sizes score the same, eat less.
      if (!smallest) smallest = { x: x, score: sc };
      if (roof > 0 && kc * x > roof) continue;
      if (!best || sc > best.score) best = { x: x, score: sc };
    }
    /* A dish bigger than the roof at even the smallest portion still has to
       come back with something — a meal with no answer is worse than a large
       one, and the ranking will sink it on its own merits. */
    return best || smallest;
  }

  /* The two the fit scorer never knew about.
   *
     Six days drafted by Fill my day averaged 3,408 mg of sodium against a
     2,300 mg guideline, and 12 g of fibre against 18 — and not one of the six
     reached the fibre floor. The scorer was choosing honestly against protein,
     fat and carbohydrate and blind to both, so it kept picking the salty
     option when two plates fit the macros equally well.
   *
     Small on purpose. This is a thumb on the scale between plates that
     already fit, in the same weight class as the favourite bonus — not a
     second opinion loud enough to argue a cut out of its protein. A plate is
     judged per hundred calories, so a big serving is not punished for being
     big. */
  /* A plate salty enough to matter on its own says so.
   *
     A thumb on the ranking cannot fix this pantry: the median recipe here is
     128 mg of sodium per 100 kcal against a line of about 115, only 125 of
     277 sit under it, and one serving of the worst is 2,096 mg — most of a
     day's ceiling in a single plate. Penalising hard enough to avoid that
     would quietly hide half the book. So the ranking nudges, and the plate
     that is actually the problem is named. */
  var MSALT_FLAG = 800;                 // a third of the day's ceiling, on one plate

  function mSaltChip(r, x) {
    var na = Math.round(((r.macro || {}).na || 0) * x);
    if (na < MSALT_FLAG) return '';
    return '<span class="mchip salty">' + na.toLocaleString() + ' mg salt</span>';
  }

  function mSaltNote(r, x) {
    var na = Math.round(((r.macro || {}).na || 0) * x);
    return na < MSALT_FLAG ? '' : ' <span class="mp-salt">' + na.toLocaleString() + ' mg salt</span>';
  }

  function mSaltFibre(r, x) {
    var mac = r.macro || {};
    var kcal = (mac.kcal || 0) * x;
    if (kcal < 40) return 0;                    // too small to say anything about
    var per100 = 100 / kcal;
    var na = (mac.na || 0) * x * per100;        // mg per 100 kcal
    var fib = (mac.fib || 0) * x * per100;      // g per 100 kcal
    /* 2300 mg against ~2000 kcal is about 115 mg per 100 kcal, and 14 g per
       1000 kcal is 1.4 g per 100. Those are the lines; the score is how far
       either side of them a plate sits, clamped so one outlier cannot decide
       a meal on its own. */
    var salt = Math.max(-6, Math.min(2, (115 - na) / 40));
    var fibre = Math.max(-2, Math.min(4, (fib - 1.4) * 2));
    return salt + fibre;
  }

  function mRank(list, day, targets, slot) {
    var sh = mShares(day, targets, slot);
    var ranked = [], flat = [];
    list.forEach(function (r) {
      if (r.macro && ((r.macro.p || 0) + (r.macro.c || 0) + (r.macro.f || 0)) > 0) {
        var fit = macroFit(r, sh.R, sh.T, sh.D);
        /* A few points for a favorite: enough that the meal you love wins the
           near-tie against the one you have never made, never enough to argue
           a dessert into a cut. The fit still owns the ranking. */
        ranked.push({ r: r, x: fit.x,
          score: fit.score + (mIsFav(r) ? 6 : 0) + mSaltFibre(r, fit.x) });
      } else {
        // reachable, honest, and unranked — a recipe with no numbers cannot
        // be sorted by them
        flat.push({ r: r, x: 1, score: null });
      }
    });
    ranked.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      var pa = a.r.macro.kcal ? a.r.macro.p / a.r.macro.kcal : 0;
      var pb = b.r.macro.kcal ? b.r.macro.p / b.r.macro.kcal : 0;
      return (pb - pa) || (a.r.book - b.r.book) || ((a.r.no || 0) - (b.r.no || 0));
    });
    return ranked.concat(flat);
  }

  var M_WDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var M_MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* One line of an item's arithmetic: "~415 kcal · 43P · 6F · 42C". The tilde
     carries the honesty of est through the multiplication — figures estimated
     from a food table do not become label-accurate by being scaled. */
  /* The same four numbers everywhere they appear, with the letters carrying
     the macro's own colour. Identity, not status — a P is the same red on a
     plate, in the picker and in the basket, which is what lets the eye find
     the protein without reading the line. */
  function mMacLine(r, x) {
    var mac = r.macro || {};
    return (r.est ? '~' : '') + Math.round((mac.kcal || 0) * x) + ' kcal · ' +
      Math.round((mac.p || 0) * x) + '<i class="mb-p">P</i> · ' +
      Math.round((mac.f || 0) * x) + '<i class="mb-f">F</i> · ' +
      Math.round((mac.c || 0) * x) + '<i class="mb-c">C</i>';
  }

  /* What one portion of this is CALLED, in the recipe's own words. A recipe's
     servings line is a yield — "6 Small Oat Bites", "4 Servings", "2 Loaves"
     — and the noun on the end of it is the name of one of them. The last word
     is what keeps it short enough to sit on the stepper: a day counted in
     "Meal Prep Containers" is counted in containers. A food carries its unit
     outright. */
  function mUnitWord(r) {
    if (r.food) return String(r.unit || 'serving');
    // a parenthetical or an aside after a dash describes the yield, it is not the yield
    var s = String(r.servings || '').split(' (')[0].split('—')[0].split('–')[0];
    // strip the count off the front — digits, fractions and an optional "about"
    s = s.replace(/^\s*(?:about\s+)?[\d\s.\/¼-¾⅐-⅞-]*/i, '');
    var w = (s.match(/[A-Za-z][A-Za-z'’]*\s*$/) || [''])[0].trim().toLowerCase();
    return w || 'serving';
  }

  /* How much of a plate this is, in two halves.
   *
     `head` is the portion itself — "1¾ bites", "¾ serving", "1 cup" — and
     goes on the stepper, beside the buttons that change it. `detail` is
     whatever else is worth knowing about that much: a weight, or how many
     things went into a meal you kept together. A bare unit was the original
     complaint — "serving" next to a kept-together salad said nothing about
     how much salad.
   *
     `x` is servings EATEN, so the portion is x of them and nothing else.
     This used to multiply by servN as well, which counted the recipe's whole
     yield a second time: a plate holding 1¾ of a six-bite batch announced
     itself as "10½ servings" while the macro line beside it — correctly —
     charged for 1¾. Every macro, bar and solver in the app has always used x
     straight, so only this line was ever wrong; it was wrong on every recipe
     that makes more than one serving. */
  function mPortion(r, x) {
    var unit = mUnitWord(r);
    var grams = r.grams ? Math.round(r.grams * x) : 0;
    if (unit === 'g') return { head: (grams || Math.round(100 * x)) + ' g', detail: '' };
    var head = unit === 'each' ? fmtNum(x) + ' whole'
      : fmtNum(x) + ' ' + (r.food ? fixUnit(unit, x) : mFixNoun(unit, x));
    if (r.parts && r.parts.length) {
      return { head: head, detail: r.parts.length + (r.parts.length === 1 ? ' part' : ' parts') };
    }
    return { head: head, detail: grams ? grams + ' g' : '' };
  }

  // the whole phrase, for the places that have room for it
  function mPortionText(r, x) {
    var p = mPortion(r, x);
    return p.detail ? p.head + ' · ' + p.detail : p.head;
  }

  /* What the recipe makes, which is the other half of "1¾ of what": the
     stepper says how much you are having, this says how much there was.
     Only worth saying when it makes more than one — "makes 1" is noise. */
  function mYieldText(r) {
    return (!r.food && r.servN > 1) ? 'makes ' + fmtNum(r.servN) : '';
  }

  /* The week you are in, seven buttons wide: each day's letter, its date, and
     what it actually came to. The dropdown could only be read one option at a
     time, so "how did this week go" meant opening it seven times. Days ahead
     of today are shown but not reachable — the day is a record, not a diary
     you write forward into. */
  function mWeekHTML(k, todayK) {
    var cur = keyDate(k);
    var mon = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate());
    mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));       // week starts Monday
    var out = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
      var dk = dayKey(d);
      var ahead = dk > mLatestKey(), tooOld = dk < mEarliestKey();
      /* Each day's own target, because a training day is not asking for the
         same thing as a rest day — a strip showing one number for all seven
         would be describing a plan nobody is on. */
      var tK = kcalOf(mDayTargets(dk));
      var train = mIsTrainingDay(dk);
      var dayObj = MDAYS[dk] ? mDay(dk) : null;
      var got = dayObj ? Math.round(mTotals(dayObj).all.kcal) : 0;
      var state = !got || !tK ? '' :
        got > tK * 1.02 ? ' over' : got >= tK * 0.9 ? ' on' : ' under';
      /* A ring is a day in progress; a filled circle is a day that has been
         eaten to the end. The colour is the same verdict either way — under,
         on, or over its target — so the week reads at a glance. */
      var done = dayObj ? mDayDone(dayObj) : false;
      out.push('<button class="mwk-d' + (dk === k ? ' now' : '') + state +
        (train ? ' train' : '') + (done ? ' done' : '') + '"' +
        (ahead || tooOld ? ' disabled' : '') +
        ' data-mweek="' + dk + '" aria-pressed="' + (dk === k ? 'true' : 'false') + '"' +
        ' aria-label="' + M_WDAYS[d.getDay()] + ' ' + M_MONS[d.getMonth()] + ' ' + d.getDate() +
        (train ? ', training day' : '') + ', ' + tK + ' calorie target' +
        (got ? ', ' + got + (done ? ' eaten, all done' : ' on the day') : '') + '">' +
        '<span class="mwk-w">' + M_WDAYS[d.getDay()].slice(0, 1) + '</span>' +
        '<span class="mwk-n">' + d.getDate() + '</span>' +
        '<span class="mwk-k">' + (tK || '&middot;') + '</span>' +
      '</button>');
    }
    return out.join('');
  }

  /* Redrawing the day removes the box the weight is typed into, and removing
     a focused input fires blur, and blur fires change, and change asks for
     another redraw — arriving in the middle of the first one, whose own
     removal then finds its node already gone. The browser says so plainly:
     "the node to be removed is no longer a child of this node". One redraw
     at a time. */
  var mRendering = false;
  function renderMacros() {
    if (mRendering) return;
    mRendering = true;
    try { mRenderDay(); } finally { mRendering = false; }
  }

  function mRenderDay() {
    var todayK = todayKey();
    var k = mViewKey();
    /* Midnight passed while the tab sat on a day. Forward was already
       handled; backward matters more — the oldest day the tab keeps falls
       out of the window at midnight, and an edit to it would have been
       written and then pruned away by the same save. */
    if (k > mLatestKey() || k < mEarliestKey()) { S.macroDate = null; k = todayK; }
    /* The day is a control, not a caption: every day the tab remembers, named
       the way you would say it, with the arrows for single steps either side. */
    var opts = [];
    for (var step = 7; step > -14; step--) {
      var od = new Date();
      od.setDate(od.getDate() + step);
      var ok = dayKey(od);
      var word = step === 0 ? 'Today' : step === -1 ? 'Yesterday'
        : step === 1 ? 'Tomorrow' : M_WDAYS[od.getDay()];
      opts.push('<option value="' + ok + '"' + (ok === k ? ' selected' : '') + '>' +
        word + ' &middot; ' + M_MONS[od.getMonth()] + ' ' + od.getDate() + '</option>');
    }
    $('macroDaySel').innerHTML = opts.join('');
    $('macroPrev').disabled = k <= mEarliestKey();
    $('macroNext').disabled = k >= mLatestKey();
    $('macroWeek').innerHTML = mWeekHTML(k, todayK);
    /* A day you are planning rather than living looks identical otherwise,
       and quietly ticking Thursday's breakfast off on Tuesday is exactly the
       mistake that would cost. */
    $('view-macros').classList.toggle('mday-ahead', mAhead(k));

    var targets = mDayTargets(k);
    var slots = mReadSlots();

    /* A new today arrives with the routine already on it: anything pinned to
       a meal is placed at its pinned portion the first time today is looked
       at. Only today, and only when the day does not exist yet — history and
       half-built days are never re-seeded, and unpinning tomorrow is done by
       unpinning, not by deleting today's copy. */
    if (k >= todayK && !MDAYS[k]) {
      var anyPins = false;
      slots.list.forEach(function (s) { if (s.pins && s.pins.length) anyPins = true; });
      if (anyPins) {
        mEditDay(k, function (day0) {
          slots.list.forEach(function (s) {
            (s.pins || []).forEach(function (p) {
              if (BY_ID[p.id]) (day0[s.k] = day0[s.k] || []).push({ id: p.id, x: p.x || 1, eaten: 0 });
            });
          });
        });
      }
    }
    var day = mDay(k);

    /* The fold is decided when you ARRIVE at a day, and not again. Working it
       out live meant a meal collapsed under the hand that had just finished
       ticking it — and computing it from "is this eaten" made every tick a
       potential disappearing act. So: everything with food on it starts
       folded, the meal you were last working on stays open, and after that
       nothing folds unless you fold it. */
    if (S.mFoldFor !== k) {
      S.mFoldFor = k;
      var keepWeigh = S.mFold.weigh;
      S.mFold = {};
      if (keepWeigh !== undefined) S.mFold.weigh = keepWeigh;
      slots.list.forEach(function (s2) {
        S.mFold[s2.k] = (day[s2.k] || []).length > 0 && s2.k !== S.mTouched;
      });
      Object.keys(day).forEach(function (sk2) {
        if (S.mFold[sk2] === undefined) S.mFold[sk2] = (day[sk2] || []).length > 0;
      });
    }

    // nothing to draft once every meal has something on it
    $('macroFill').disabled = slots.list.every(function (s) { return (day[s.k] || []).length; });

    /* The gear and its menu are static markup, so a state change paints them
       once and they stay painted. Painting again here costs a class check and
       covers the day this header stops being static. */
    mMarkAccountUI();

    // and nothing to re-size when every plate is eaten, locked, or absent
    var freeCount = 0;
    Object.keys(day).forEach(function (sk) {
      (day[sk] || []).forEach(function (it) {
        var r = BY_ID[it.id];
        if (!it.eaten && !it.l && r && r.macro) freeCount++;
      });
    });
    $('macroRebal').disabled = !freeCount;

    /* The tick fills in when the day is closed, and a future day cannot be
       finished with — you have not had it yet. */
    var doneBtn = $('macroDone');
    var isDone = mDoneAt(mViewKey()) > 0;
    doneBtn.disabled = mViewKey() > todayKey();
    if (doneBtn.getAttribute('aria-pressed') !== String(isDone)) {
      doneBtn.setAttribute('aria-pressed', String(isDone));
    }
    if (doneBtn.classList.contains('done') !== isDone) doneBtn.classList.toggle('done', isDone);
    doneBtn.title = isDone ? 'Day closed \u2014 press to reopen' : 'I am done for today';

    /* One card per meal on the plan, then a card for anything a bygone meal
       left on this day — removed from the plan is not removed from history. */
    var ahead = mAhead(k);
    var slotCard = function (sk, name, onPlan) {
      var items = day[sk] || [];
      /* Rows map over the STORED array so data attributes carry storage
         indexes; an unresolvable id (a deleted own recipe) renders as nothing
         but is never purged, the same bargain renderPlan strikes. */
      var srec = null;
      slots.list.forEach(function (s) { if (s.k === sk) srec = s; });
      var pins = (srec && srec.pins) || [];
      var rows = items.map(function (it, i) {
        var r = BY_ID[it.id];
        if (!r) return '';
        var tag = sk + ':' + i;
        var pinned = pins.some(function (p) { return p.id === it.id; });
        // what you are having, and what there was to have
        var port = mPortion(r, it.x);
        var yieldT = mYieldText(r);
        /* The tick and the name are separate targets on purpose: the box says
           "I ate it", the name opens the recipe to see what "it" is. When the
           two shared a label, reading the recipe cost you a phantom tick. */
        /* Two columns. On the left the plate says what it is: the tick, the
           name (clipped rather than wrapped — a long name must not push the
           controls off a phone), and under them the arithmetic with the pin
           and the lock. On the right, always in the same place, the portion
           dial and the bin.
         *
           The bin is a bin and not another ×. Two × glyphs on one row, one
           meaning "times one" and the other "gone", is a misread waiting to
           happen on a thumb-sized target. */
        return '<div class="mitem' + (it.eaten ? ' eaten' : '') + '">' +
          /* Three lines, the shape RP uses and the shape a plate wants: what
             it is, where it came from and how much of it, then what it costs,
             then the one control that changes any of that.
           *
             The bin is a bin and not another ×. Two × glyphs on one row, one
             meaning "times one" and the other "gone", is a misread waiting to
             happen on a thumb-sized target. */
          '<span class="mitem-r1">' +
            /* The score, on the plate. Knowing a thing fits the day and
               knowing it is worth eating are different questions, and the
               second one was only answerable by opening the recipe. */
            leaf(r.score, 'leaf-sm') +
            /* A recipe's name opens the recipe. A food's name opens the
               food: what one of it is, and — for a meal you kept together —
               the parts it was made of. It used to be a dead label, which
               left a five-part salad reading as one word and no way back. */
            (r.food
              ? '<button class="mitem-name mitem-food" data-mfood="' + esc(String(r.id)) +
                '" data-mx="' + it.x + '">' + esc(r.name) + '</button>'
              : '<button class="mitem-name" data-open="' + esc(String(r.id)) +
                '" data-mx="' + it.x + '">' + esc(r.name) + '</button>') +
            '<span class="mitem-acts no-print">' +
              /* The pin is the routine: pinned to this meal, at this portion,
                 on every new day — the Crio Brü that opens every morning
                 without being asked. Unpinning stops tomorrow, not today. */
              (onPlan ? '<button class="mpin" data-mpin="' + tag + '" aria-pressed="' +
                (pinned ? 'true' : 'false') + '" aria-label="' +
                (pinned ? 'Unpin from this meal' : 'Pin to this meal every day') + '">&#128204;</button>' : '') +
              '<button class="mdel" data-mdel="' + tag + '" aria-label="Remove ' + esc(r.name) + '">' +
                '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.2a1 1 0 0 0 1 .8h3.8a1 1 0 0 0 1-.8l.6-8.2" ' +
                'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
              '</button>' +
            '</span>' +
          '</span>' +
          /* Where it came from, how much it makes, and what it costs — one
             row. The four numbers used to be a line of their own underneath;
             they carry no pill border here, so among a row of labels the
             thing without a border is the data. They wrap onto their own
             line when the tags fill the width, which is the same thing the
             old layout did, just not every time. */
          '<span class="mitem-chips">' +
            // the book's short name — its full title is half a phone wide
            '<span class="mchip">' + esc(r.food ? 'Yours' : (r.book === 3 ? 'OURS' : BOOKS[r.book].short)) + '</span>' +
            (yieldT ? '<span class="mchip">' + esc(yieldT) + '</span>' : '') +
            (port.detail ? '<span class="mchip">' + esc(port.detail) + '</span>' : '') +
            (r.est ? '<span class="mchip">~ estimated</span>' : '') +
            mSaltChip(r, it.x) +
            '<span class="mitem-mac">' + mMacLine(r, it.x) + '</span>' +
          '</span>' +
          /* The amount on one side, the tick on the other, with room between.
             Eating a plate and resizing one are different verbs, and they
             were sharing a strip of thumb: the tick sat at the near end of
             the stepper, exactly where a thumb reaching for "smaller" lands.
           *
             The lock stays with the amount, beside the number it holds still.
             It guards against the MACHINE, not you: Rebalance leaves a locked
             plate alone, but the stepper still works. */
          '<span class="mrow2 no-print">' +
            /* Eaten is a record, not a dial.
             *
               Once the tick is on, this plate is a thing that happened, and
               resizing what you already ate is editing the past — so the
               stepper goes quiet.

               The LOCK stays live. It is a different job — it holds a food
               steady while the other meals are rebalanced around it — and
               that is a thing you may still want to say about a plate you
               have already eaten. Only the servings lock.
               Untick and the stepper comes back; nothing here is one-way. */
            '<span class="mstep' + (it.eaten && S.mEdit !== tag ? ' spent' : '') + '">' +
              '<button class="mlock" data-mlock="' + tag + '" aria-pressed="' +
                (it.l ? 'true' : 'false') + '" aria-label="' +
                (it.l ? 'Unlock for Rebalance' : 'Lock against Rebalance') + '">&#128274;</button>' +
              /* The portion, in the units it is a portion OF. It read "×1¾"
                 for as long as the tab has existed, which names the
                 arithmetic and not the food — and left "one and three
                 quarters of WHAT?" with no answer anywhere on the card. */
              /* Eaten, this is the way back in. Correcting a portion after
                 the fact used to be untick, adjust, re-tick — three actions
                 for the ordinary case of eating more than you planned. One
                 tap on the number now hands the stepper back, which is still
                 a deliberate act and no longer a chore. */
              (it.eaten && S.mEdit !== tag
                ? '<button class="mstep-x mstep-wake" data-medit="' + tag +
                  '" title="Correct this portion">' + esc(port.head) + '</button>'
                : '<span class="mstep-x">' + esc(port.head) + '</span>') +
              '<button data-mstep="' + tag + ':down"' + (it.eaten && S.mEdit !== tag ? ' disabled' : '') +
                ' aria-label="Smaller portion">&minus;</button>' +
              '<button data-mstep="' + tag + ':up"' + (it.eaten && S.mEdit !== tag ? ' disabled' : '') +
                ' aria-label="Bigger portion">+</button>' +
            '</span>' +
            '<label class="mtick"><input type="checkbox" data-meat="' + tag + '"' +
              (it.eaten ? ' checked' : '') + (ahead ? ' disabled' : '') +
              ' aria-label="Eaten"></label>' +
          '</span>' +
        '</div>';
      }).join('');
      if (!onPlan && !rows) return '';        // a bygone meal with nothing left says nothing
      var sub = { kcal: 0, p: 0, f: 0, c: 0 };
      items.forEach(function (it) {
        var r = BY_ID[it.id];
        if (!r || !r.macro) return;
        sub.kcal += (r.macro.kcal || 0) * it.x; sub.p += (r.macro.p || 0) * it.x;
        sub.f += (r.macro.f || 0) * it.x; sub.c += (r.macro.c || 0) * it.x;
      });
      /* Three states on the rail, not two. A hollow dot is a meal with
         nothing on it; an ochre one is a meal planned and still ahead of
         you; a filled one is a meal you have eaten. The last was the whole
         point of running the day down a line — what is behind you — and it
         was the one state never wired up. */
      var eatenAll = items.length && items.every(function (it) {
        return it.eaten || !BY_ID[it.id];
      });
      /* Folded by default on a day that is over, never on the one you are
         living. Folding the moment a meal was fully ticked collapsed it under
         the hand that ticked it — and took away the untick. S.mFold holds
         only what you have pressed, so it never has to be cleaned up. */
      var folded = !!(items.length && S.mFold[sk]);

      /* Skipped. One line instead of a card, struck through, with the way
         back on it — a day where lunch is visibly not happening tells you
         more later than a day where lunch simply is not there. Drawn before
         the card rather than instead of parts of it, because a skipped meal
         has no numbers, no plates and nothing to fold. */
      if (onPlan && !items.length && mSkipped(k, sk)) {
        return '<div class="mslot mslot-skipped">' +
          '<span class="mslot-skip-n">' + esc(name) + '</span>' +
          '<span class="mslot-skip-w">skipped &middot; its share went to the rest</span>' +
          '<button class="ghost mslot-unskip no-print" data-mskip="' + esc(sk) + '" ' +
            'aria-label="Put ' + esc(name) + ' back">Undo</button>' +
        '</div>';
      }

      return '<div class="mslot mday-stop' + (items.length ? ' filled' : '') +
        (eatenAll ? ' done' : '') + '">' +
        /* The dot was a pseudo-element: it could say a meal was behind you
           but never be told so, and no keyboard or screen reader knew it was
           there at all. It is a button now — press it and the whole meal is
           eaten, press it again and it is not. */

        /* Two lines, because five things will not fit across a phone: the
           name, the verdict and the controls up top, what the meal actually
           comes to underneath. One row made the Add button wrap and doubled
           the height of every meal on the day. */
        '<div class="mslot-h">' +
          /* The dot came off the rail and onto the card, because it was never
             decoration: pressing it marks the whole meal eaten. Losing the
             line it hung from must not lose the control with it. */
          '<button class="mday-dot no-print" data-mdot="' + esc(sk) + '"' +
            (items.length && !ahead ? '' : ' disabled') +
            ' aria-pressed="' + (eatenAll ? 'true' : 'false') + '"' +
            ' aria-label="' + (eatenAll ? 'Mark ' + esc(name) + ' not eaten'
              : 'Mark all of ' + esc(name) + ' eaten') + '"></button>' +
          /* The name is the handle. A meal you have eaten is history — its
             steppers and locks have nothing left to do — so it folds down to
             a list of what was on it, and anything still ahead of you stays
             open. Pressing the name overrides either way.
           *
             The name still folds it, and always has — that target is the
             width of the word and costs nothing to keep. But the name is at
             the far LEFT of a phone, which is the one place a thumb is not,
             and it never said the meal could fold in the first place. The
             handle that says so lives over on the right, below. */
          '<button class="mslot-name" data-mfold="' + esc(sk) + '" aria-expanded="' +
            (folded ? 'false' : 'true') + '">' + esc(name) + '</button>' +
          mVerdictHTML(sk, items, onPlan, targets, slots) +
          /* Only where there is something to solve. One plate has a stepper
             and needs no algebra; two or more is the question this answers,
             and a button on every meal from breakfast onward would be four
             buttons a day that nothing was ever pressed on. */
          (onPlan && items.length >= 2
            ? '<button class="mslot-ic mslot-bal no-print" data-mbal="' + esc(sk) + '" ' +
              'aria-label="Balance ' + esc(name) + ' to its share" ' +
              'title="Solve these portions against this meal\u2019s macros">&#9878;</button>' : '') +
          /* Said out loud, because an answer from outside this meal's own
             sections is exactly what was asked for and exactly what looks
             like a fault if it turns up unexplained. */
          (onPlan && mWideOpen(sk)
            ? '<span class="mslot-wide" title="After ten tries this meal is ' +
              'choosing from every section">everywhere</span>' : '') +
          (onPlan ? '<button class="mslot-ic mslot-try no-print' +
            (mWideOpen(sk) ? ' wide' : '') + '" data-mtry="' + esc(sk) + '" ' +
            'aria-label="Another suggestion for ' + esc(name) + '" ' +
            'title="Another suggestion — walks down the best-fit list">&#8635;</button>' : '') +
          /* A plus, not "+ Add". Everybody knows what a plus does, and the
             word was the widest thing on a row that has too much on it. The
             label the word used to give is now the button's own, said to a
             screen reader instead of to the eye — and said better, because it
             names the meal the food is going on. */
          (onPlan ? '<button class="mslot-ic mslot-add no-print" data-mslot="' + esc(sk) + '" ' +
            'aria-label="Add food to ' + esc(name) + '">&#43;</button>' : '') +
          /* Only on a meal with nothing on it. You do not skip a meal you have
             already put food on — you delete the food — and a button that
             appears on every meal all day is a button in the way of the ones
             pressed daily. */
          (onPlan && !items.length
            ? '<button class="mslot-ic mslot-skip no-print" data-mskip="' + esc(sk) + '" ' +
              'aria-label="Skip ' + esc(name) + ' today" ' +
              'title="Not eating this today \u2014 its share goes to the other meals">' +
              '&#8856;</button>' : '') +
        '</div>' +
        /* What the meal comes to, in the same four colours the bars use. */
        /* The handle is the bar the fold actually happens at. A boxed caret up
           in the header read as a third action button beside Add and the
           retry, and on a meal that also carries the scale it made four boxes
           fighting over one row. This is the seam instead: the meal's own
           numbers, sitting exactly where the plates appear and disappear,
           with a small mark on the end saying which way the next press goes.
           Full width, so the target is the whole strip rather than a glyph. */
        (rows ? '<button class="mslot-sub" data-mfold="' + esc(sk) + '" aria-expanded="' +
            (folded ? 'false' : 'true') + '" aria-label="' +
            (folded ? 'Open ' : 'Fold ') + esc(name) + '">' +
          '<span>' + Math.round(sub.kcal) + '</span>' +
          '<span><i class="mb-p">P</i>' + Math.round(sub.p) + '</span>' +
          '<span><i class="mb-f">F</i>' + Math.round(sub.f) + '</span>' +
          '<span><i class="mb-c">C</i>' + Math.round(sub.c) + '</span>' +
          '<span class="mfold-cue" aria-hidden="true">&#8964;</span>' +
        '</button>' : '') +
        (folded
          ? '<div class="mslot-thin">' + items.map(function (it) {
              var r2 = BY_ID[it.id];
              if (!r2) return '';
              return '<div class="mthin' + (it.eaten ? ' eaten' : '') + '">' +
                /* Its leaf, as the bullet. Shut, this is the only place the
                   score survives — and a shut meal is exactly when several of
                   them are being read at once. */
                (r2.score === null || r2.score === undefined
                  ? '<span class="mthin-dot" aria-hidden="true">&middot;</span>'
                  : leaf(r2.score, 'leaf-sm')) +
                /* The same door the open plate's name is. A shut meal is
                   still a list of food, and the name of a thing you are about
                   to cook has to be pressable whichever way the card is
                   folded — going to the recipe should not cost you opening
                   the meal first. The delegated handlers on #macroSlots
                   already answer both of these, so the row needs nothing of
                   its own; it only has to be the same shape. */
                (r2.food
                  ? '<button class="mthin-n mitem-food" data-mfood="' + esc(String(r2.id)) +
                    '" data-mx="' + it.x + '">' + esc(r2.name) + '</button>'
                  : '<button class="mthin-n" data-open="' + esc(String(r2.id)) +
                    '" data-mx="' + it.x + '">' + esc(r2.name) + '</button>') +
                /* The same portion words the open plate uses — "1 cup ·
                   130 g", "1½ servings" — so a folded meal reads as food
                   rather than as multipliers. */
                '<span class="mthin-x">' + esc(mPortionText(r2, it.x)) + '</span></div>';
            }).join('') + '</div>'
          : '<div class="mslot-items">' + (rows || '<div class="mslot-empty">&mdash;</div>') +
            /* Under the plates, not in the header: it is a thing you do once
               to a meal you have got right, not a control you reach past
               every day. */
            (onPlan && items.length >= 2
              ? '<button class="mslot-keep no-print" data-mkeep="' + esc(sk) + '">' +
                '&#43; Keep these as one thing</button>' : '') +
          '</div>') +
      '</div>';
    };
    var html = slots.list.map(function (s) { return slotCard(s.k, s.n, true); }).join('');
    var onPlanKeys = slots.list.map(function (s) { return s.k; });
    Object.keys(day).forEach(function (sk) {
      if (onPlanKeys.indexOf(sk) < 0) html += slotCard(sk, slots.names[sk] || 'Meal', false);
    });
    $('macroSlots').innerHTML = html;

    var shut = mAnyShut();
    $('macroOpenAll').setAttribute('aria-pressed', shut ? 'false' : 'true');
    $('macroOpenAll').setAttribute('aria-label', shut ? 'Open every meal' : 'Close every meal');
    $('macroOpenAll').innerHTML = shut ? '&#9776;' : '&#9783;';

    var readout = macroFootHTML(day, targets, slots);
    $('macroFoot').innerHTML = readout.foot;
    /* The pills are the folded copy of the bars, so they are rebuilt with
       them. The row itself is static markup and keeps its own handler; only
       what is inside it changes. */
    $('macroPills').innerHTML = readout.pills;
    /* The scale's box is a draft like the join code and the picker's search:
       a sync emit arriving mid-keystroke must not replace "187.4" with the
       last saved value while the pending save still holds what was typed. */
    var wIn = $('macroWeigh').querySelector('#mWeight');
    var wDraft = wIn && document.activeElement === wIn ? wIn.value : null;
    $('macroWeigh').innerHTML = macroWeighHTML(k);
    if (wDraft !== null) {
      var wBack = $('macroWeigh').querySelector('#mWeight');
      if (wBack) { wBack.value = wDraft; wBack.focus(); }
    }
    // the first stop of the day fills in once the scale has been read
    $('macroWeigh').classList.toggle('done', MWEIGHTS[k] > 0);

    /* A day with a different plan is a card of a different height, so the
       fold's measurements go out with the markup they were taken from and
       the card is laid out again from the scroll position it is at. Without
       this, ticking a meal off while the card is folded would leave it
       clipped to yesterday's numbers. */
    mFoldForget();
    syncShrunk();
  }

  /* What the day would come to if the meals with nothing on them landed on
     their share of it. An unplanned lunch is not a lunch you will skip — it
     is one you have not decided yet — and counting it as zero made a day
     half-planned at nine in the morning read as a catastrophe. It is drawn
     as its own hatched band so it is never mistaken for food. */
  function mAssumed(day, targets, slots) {
    var out = { p: 0, f: 0, c: 0, kcal: 0 };
    var sumW = 0;
    slots = slots || mReadSlots();
    slots.list.forEach(function (s) { sumW += mSlotW(s); });
    if (!sumW) return out;
    slots.list.forEach(function (s) {
      if ((day[s.k] || []).length) return;
      var fr = mSlotW(s) / sumW;
      ['p', 'f', 'c'].forEach(function (m) { out[m] += targets[m] * fr; });
    });
    out.kcal = kcalOf(out);
    return out;
  }

  /* Whether a meal wants you, at a glance. The arithmetic for a meal's own
     share has existed since the picker was built, but it only ever showed
     INSIDE the picker — so the only way to learn that dinner was two hundred
     short was to open dinner and go shopping. Now the header says it. */
  function mVerdictHTML(sk, items, onPlan, targets, slots) {
    if (!targets.p && !targets.f && !targets.c) return '';
    /* Over the meals that are actually happening. A skipped meal releases its
       share to the rest — that is what the skip DOES — so a pill still
       dividing by it would call a breakfast "over" when Fill had deliberately
       made it bigger. The card and the planner have to be dividing by the
       same number, or they are describing different days. */
    var me = null, sumW = 0, vk = mViewKey();
    slots.list.forEach(function (s) {
      if (s.k !== sk && mSkipped(vk, s.k)) return;
      sumW += mSlotW(s);
      if (s.k === sk) me = s;
    });
    if (!me || !sumW) return '';
    var tK = kcalOf(targets) * mSlotW(me) / sumW;
    if (!items.length) {
      return onPlan
        ? '<span class="mslot-v" data-mv="empty">at its share &middot; ' + Math.round(tK) + '</span>'
        : '';
    }
    var got = 0;
    items.forEach(function (it) {
      var r = BY_ID[it.id];
      if (r && r.macro) got += (r.macro.kcal || 0) * it.x;
    });
    var d = Math.round(got - tK);
    var eatenAll = items.every(function (it) { return it.eaten || !BY_ID[it.id]; });
    if (Math.abs(d) <= tK * 0.1) {
      return '<span class="mslot-v on" data-mv="on">' + (eatenAll ? 'eaten &middot; on target' : 'on target') + '</span>';
    }
    return '<span class="mslot-v ' + (d < 0 ? 'short' : 'over') + '" data-mv="' + (d < 0 ? 'short' : 'over') + '">' +
      Math.abs(d) + (d < 0 ? ' short' : ' over') + '</span>';
  }

  /* Whether anything on the day is folded shut — which is what the open-all
     button offers to change, so it says what it will do next rather than
     what it did last. */
  function mAnyShut() {
    var day = mDay(mViewKey()), shut = false;
    mReadSlots().list.forEach(function (s2) {
      if ((day[s2.k] || []).length && S.mFold[s2.k]) shut = true;
    });
    Object.keys(day).forEach(function (sk2) {
      if ((day[sk2] || []).length && S.mFold[sk2]) shut = true;
    });
    return shut;
  }

  /* ------------------------------------------------------ the charts
   * Four process behaviour charts over the mornings and the meals, behind
   * the bars they belong to. Wheeler's arithmetic throughout: the centre
   * comes from the values, the spread from the moving ranges, and the limits
   * sit 2.660 average moving ranges either side of the centre.
   *
   * Limits are taken from a BASELINE — the first three weeks — and held flat
   * afterwards, rather than recomputed over everything. Recomputing lets the
   * limits chase the trend until nothing can ever be outside them, which on
   * a cut means the chart goes quiet exactly when it should be speaking.
   */
  var MC_KEYS = [
    ['weight', 'Weight'], ['off', 'Off plan'], ['jump', 'Day to day'], ['rate', 'Rate']
  ];

  function mcMean(a) {
    return a.reduce(function (s2, x) { return s2 + x; }, 0) / (a.length || 1);
  }
  function mcRanges(v) {
    var o = [];
    for (var i = 1; i < v.length; i++) o.push(Math.abs(v[i] - v[i - 1]));
    return o;
  }
  function mcLimits(v) {
    if (v.length < 5) return null;
    var base = v.slice(0, Math.min(21, v.length));
    var bar = mcMean(mcRanges(base)), cl = mcMean(base);
    return { cl: cl, bar: bar, unpl: cl + 2.660 * bar, lnpl: cl - 2.660 * bar };
  }

  /* The series each chart draws, and the sentence under it. Every one can
     come back empty, and says why rather than drawing an empty box. */
  function mcSeries(which) {
    var keys = Object.keys(MWEIGHTS).sort();
    var pr = mReadProfile();
    var vals = keys.map(function (k) { return MWEIGHTS[k]; });
    if (which === 'weight') {
      if (vals.length < 2) return { need: 'Two mornings on the scale and this draws.' };
      var plan = [];
      var okPlan = true;
      keys.forEach(function (k) {
        var pw = mPlanWeight(k, pr);
        if (!pw) okPlan = false; else plan.push(pw.lb);
      });
      /* No limits on this one. Baseline limits held across a cut saturate —
         you leave the band in week two and every morning after is "outside",
         which flags thirty points and means none of them. Weight is the chart
         you came to look at; Off plan is the one that signals. */
      return {
        v: vals, keys: keys, lim: null, plan: okPlan ? plan : null, dp: 1,
        note: okPlan ? 'The dashed line is the plan. The gap between them is the whole story.'
          : 'Name a weight and a date under the gear and the plan draws alongside.'
      };
    }
    if (which === 'off') {
      var res = [], ok2 = true;
      keys.forEach(function (k) {
        var pw = mPlanWeight(k, pr);
        if (!pw) { ok2 = false; return; }
        res.push(Math.round((MWEIGHTS[k] - pw.lb) * 100) / 100);
      });
      if (!ok2 || res.length < 5) {
        return { need: ok2 ? 'Five mornings and this draws.'
          : 'This one needs a goal weight and a date, under the gear.' };
      }
      return { v: res, keys: keys, lim: mcLimits(res), zero: true, dp: 1,
        note: 'Zero is on pace. Above the line is losing slower than you meant to.' };
    }
    if (which === 'jump') {
      if (vals.length < 6) return { need: 'Six mornings and this draws.' };
      var mr = mcRanges(vals), mkeys = keys.slice(1);
      var bar = mcMean(mr.slice(0, Math.min(21, mr.length)));
      /* Salty relative to YOUR days, not to a public ceiling. A storehouse
         pantry runs over 2,300 mg most days, so a fixed line marked every
         point on the chart and told you nothing. What moves the scale is a
         day well above your own usual, followed by a jump big enough to
         notice — both, or it is not an explanation. */
      var mine = [];
      Object.keys(MDAYS).forEach(function (dk) {
        var na = mSodiumOn(dk);
        if (na > 0) mine.push(na);
      });
      mine.sort(function (a, b) { return a - b; });
      var mid = mine.length ? mine[Math.floor(mine.length / 2)] : MSALT_DAY;
      var high = Math.max(MSALT_DAY, mid * 1.3);
      var salt = mkeys.map(function (k, i) {
        return mr[i] > bar && mSodiumOn(keys[i]) >= high;   // the day BEFORE the jump
      });
      return { v: mr, keys: mkeys, salt: salt, dp: 1,
        lim: { cl: bar, bar: bar, unpl: 3.268 * bar, lnpl: 0 },
        note: 'Overnight change. Ochre points follow a day well above your own usual salt.' };
    }
    if (vals.length < 15) return { need: 'A fortnight of mornings and this draws.' };
    var rate = [], rkeys = [];
    for (var i = 13; i < vals.length; i++) {
      rate.push(Math.round((mcMean(vals.slice(i - 6, i + 1)) -
        mcMean(vals.slice(i - 13, i - 6))) * 100) / 100);
      rkeys.push(keys[i]);
    }
    return { v: rate, keys: rkeys, lim: mcLimits(rate), zero: true, dp: 1,
      note: 'A week against the week before it. A working cut sits below zero.' };
  }

  function mcChartSVG(sr) {
    var W = 600, H = 190, PL = 40, PR = 8, PT = 10, PB = 20;
    var lo = Infinity, hi = -Infinity;
    var see = function (v) { if (v < lo) lo = v; if (v > hi) hi = v; };
    sr.v.forEach(see);
    if (sr.lim) { see(sr.lim.unpl); see(sr.lim.lnpl); }
    if (sr.plan) sr.plan.forEach(see);
    if (sr.zero) see(0);
    if (hi - lo < 0.5) { hi += 0.5; lo -= 0.5; }
    var pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
    var px = function (i) { return PL + i * (W - PL - PR) / Math.max(1, sr.v.length - 1); };
    var py = function (v) { return PT + (H - PT - PB) * (1 - (v - lo) / (hi - lo)); };
    var out = [];
    var rule = function (v, cls) {
      out.push('<line x1="' + PL + '" x2="' + (W - PR) + '" y1="' + py(v).toFixed(1) +
        '" y2="' + py(v).toFixed(1) + '" class="' + cls + '"/>');
    };
    [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1].forEach(function (v) {
      rule(v, 'mc-grid');
      out.push('<text x="' + (PL - 6) + '" y="' + (py(v) + 3.5).toFixed(1) +
        '" text-anchor="end" class="mc-ax">' + v.toFixed(sr.dp) + '</text>');
    });
    if (sr.zero) rule(0, 'mc-zero');
    if (sr.lim) { rule(sr.lim.unpl, 'mc-lim'); rule(sr.lim.lnpl, 'mc-lim'); rule(sr.lim.cl, 'mc-cl'); }
    if (sr.plan) {
      out.push('<polyline class="mc-plan" points="' + sr.plan.map(function (v, i) {
        return px(i).toFixed(1) + ',' + py(v).toFixed(1); }).join(' ') + '"/>');
    }
    out.push('<polyline class="mc-line" points="' + sr.v.map(function (v, i) {
      return px(i).toFixed(1) + ',' + py(v).toFixed(1); }).join(' ') + '"/>');
    sr.v.forEach(function (v, i) {
      var out2 = sr.lim && (v > sr.lim.unpl || v < sr.lim.lnpl);
      var sa = sr.salt && sr.salt[i];
      out.push('<circle cx="' + px(i).toFixed(1) + '" cy="' + py(v).toFixed(1) + '" r="' +
        (out2 || sa ? 3.4 : 2) + '" class="' +
        (sa ? 'mc-salt' : out2 ? 'mc-sig' : 'mc-dot') + '"><title>' +
        esc(mPretty(sr.keys[i])) + ' \u00b7 ' + v.toFixed(sr.dp) + '</title></circle>');
    });
    [0, sr.v.length - 1].forEach(function (i) {
      out.push('<text x="' + px(i).toFixed(1) + '" y="' + (H - 5) + '" text-anchor="' +
        (i ? 'end' : 'start') + '" class="mc-ax">' + esc(mPretty(sr.keys[i])) + '</text>');
    });
    return '<svg class="mc-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
      esc(sr.note) + '">' + out.join('') + '</svg>';
  }

  /* Naming it, and choosing who gets it. Asked rather than assumed, because
     the two answers go to different places: the Ours shelf is the household's
     and your own foods are yours, and neither is obviously the right home for
     four scanned packets. */
  function mKeepHTML() {
    var sk = S.keepMeal, day = mDay(mViewKey());
    var items = (day[sk] || []).filter(function (it) { return BY_ID[it.id]; });
    var mac = { kcal: 0, p: 0, f: 0, c: 0 };
    items.forEach(function (it) {
      var r = BY_ID[it.id];
      ['kcal', 'p', 'f', 'c'].forEach(function (m) { mac[m] += ((r.macro || {})[m] || 0) * it.x; });
    });
    var slots = mReadSlots(), nm = slots.names[sk] || 'Meal';
    slots.list.forEach(function (sl) { if (sl.k === sk) nm = sl.n; });
    return '<div class="scrim no-print" data-close="1">' +
      '<div class="sheet mt-sheet" role="dialog" aria-modal="true" aria-label="Keep this meal">' +
        '<div class="sheet-top">' +
          '<div class="sheet-eyebrow">Keep ' + esc(nm.toLowerCase()) + '</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="mtl-row"><span class="mtl-lab">Call it</span>' +
          '<span class="mtl-val"><input type="text" id="mkName" ' +
            'placeholder="Morning Crio Br\u00fc" aria-label="What to call it"></span></div>' +
        '<div class="mk-parts">' + items.map(function (it) {
          var r = BY_ID[it.id];
          return '<div class="mk-p"><span>' + esc(r.name) + '</span><span>&times;' +
            fmtNum(it.x) + '</span></div>';
        }).join('') + '</div>' +
        '<div class="mk-tot">' + Math.round(mac.kcal) + ' kcal &middot; ' +
          Math.round(mac.p) + 'P &middot; ' + Math.round(mac.f) + 'F &middot; ' +
          Math.round(mac.c) + 'C</div>' +
        '<div class="mt-div">Where it goes</div>' +
        '<div class="sync-row">' +
          '<button class="btn-primary" data-mkdo="share">Add to Ours</button>' +
          '<button class="ghost" data-mkdo="mine">Keep it to myself</button>' +
        '</div>' +
        '<div class="mt-cap">Ours is a recipe everyone with the pantry code can see. ' +
          'The other stays in your account.</div>' +
        '<div class="mt-cap" id="mkNote"></div>' +
      '</div></div>';
  }

  /* A food, opened from its plate. Recipes have a sheet with steps in it;
     a food has nothing to cook, so this is the sheet that answers the two
     things a plate cannot: what one of it is (a cup, 130 grams), and for a
     meal you kept together, the parts it was made of and what each brought.
     The totals are at the plate's own portion, so they match the row that
     was pressed rather than a nominal "one". */
  function mFoodSheetHTML() {
    var o = S.foodOpen || {}, r = BY_ID[o.id];
    if (!r) return '';
    var x = o.x > 0 ? o.x : 1;
    var mac = r.macro || {};
    var parts = r.parts || [];
    var partRows = parts.map(function (pt) {
      /* Each part at the portion it was kept at, scaled by how much of the
         plate is on the day. The part's own record may be gone (a table
         food renamed, an own food deleted), so the macro line is only drawn
         when it can still be worked out. */
      var pr = BY_ID[pt.id];
      var px = (Number(pt.x) || 1) * x;
      var amount = pt.unit === 'each' ? fmtNum(px) + ' whole'
        : fmtNum(px) + ' ' + fixUnit(String(pt.unit || 'serving'), px);
      return '<div class="mfs-p">' +
        '<span class="mfs-pn">' + esc(pt.name) + '</span>' +
        '<span class="mfs-px">' + esc(amount) + '</span>' +
        (pr ? '<span class="mfs-pm">' + mMacLine(pr, px) + '</span>' : '') +
      '</div>';
    }).join('');
    return '<div class="scrim no-print" data-close="1">' +
      '<div class="sheet mt-sheet" role="dialog" aria-modal="true" aria-label="' + esc(r.name) + '">' +
        '<div class="sheet-top">' +
          '<div class="sheet-eyebrow">' + (parts.length ? 'A meal you kept' : 'A food') + '</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="mfs-name">' + esc(r.name) + '</div>' +
        '<div class="mfs-one">One of it: ' + esc(mPortionText(r, 1)) + '</div>' +
        (partRows ? '<div class="mt-div">What went in</div><div class="mfs-parts">' + partRows + '</div>' : '') +
        '<div class="mt-div">On your plate: ' + esc(mPortionText(r, x)) + '</div>' +
        '<div class="mk-tot">' + mMacLine(r, x) + '</div>' +
        '<div class="mfs-micro">' +
          '<span>&#127806; ' + (Math.round((mac.fib || 0) * x * 10) / 10) + ' g fibre</span>' +
          '<span>&#129474; ' + Math.round((mac.na || 0) * x).toLocaleString() + ' mg sodium</span>' +
        '</div>' +
        (r.est ? '<div class="mt-cap">~ estimated from the food table, not a label.</div>' : '') +
      '</div></div>';
  }

  function macroChartHTML() {
    var sr = mcSeries(S.chartWhich);
    var body = sr.need
      ? '<div class="mslot-empty">' + esc(sr.need) + '</div>'
      : mcChartSVG(sr) + '<div class="mc-note">' + esc(sr.note) + '</div>' +
        (sr.lim ? '<div class="mc-note">Limits ' + sr.lim.lnpl.toFixed(1) + ' to ' +
          sr.lim.unpl.toFixed(1) + ', from the first three weeks. ' +
          'A point outside them is a change rather than a Tuesday.</div>' : '');
    return '<div class="scrim no-print" data-close="1">' +
      '<div class="sheet mc-sheet" role="dialog" aria-modal="true" aria-label="The numbers over time">' +
        '<div class="sheet-top">' +
          '<div class="sheet-eyebrow">Over time</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="mc-tabs">' + MC_KEYS.map(function (t) {
          return '<button data-mchart="' + t[0] + '" aria-pressed="' +
            (S.chartWhich === t[0] ? 'true' : 'false') + '">' + t[1] + '</button>';
        }).join('') + '</div>' +
        body +
      '</div></div>';
  }

  /* Two pieces of the same readout, because they live in two boxes: the bars
     are inside the part of the card that folds away, and the pills are what
     it folds into, outside it. They are built together because they are the
     same six numbers and neither is worth computing twice. */
  function macroFootHTML(day, targets, slots) {
    if (!targets.p && !targets.f && !targets.c) {
      return { foot: '<div class="macro-none">Craft your plan.</div>', pills: '' };
    }
    var tot = mTotals(day);
    var asm = mAssumed(day, targets, slots);

    /* Four bars, not three dials and a bar underneath. Calories are the
       fourth line of the same budget, and reading them off a different shape
       in a different place made the day two readouts instead of one.
     *
     * Colour says WHERE YOU STAND and shade says HOW MUCH IS ALREADY EATEN:
     *
     *   solid    eaten
     *   pale     planned, not yet eaten
     *   hatched  assumed, because that meal is still empty
     *   grey     nothing has claimed it
     *
     * ochre under target, green landed in the band, red past it. Protein's
     * band runs to 110% because protein is the one macro a cut wants you to
     * overshoot; fat and carbs turn at the line, and calories get two per
     * cent of rounding grace. The fit scorer has always judged them that way
     * and the readout must not contradict the thing filling the day. */
    /* Calories get the flame, not a fourth letter: P, F and C are the three
       things food is made of and the flame is what the three add up to. */
    var ROWS = [['kcal', '\uD83D\uDD25', 'Calories', ''], ['p', 'P', 'Protein', ' g'],
      ['f', 'F', 'Fat', ' g'], ['c', 'C', 'Carbs', ' g']];
    var tK = kcalOf(targets);
    /* What is left of each, signed: under is negative, over is positive. It
       is the one figure that adds the assumption in \u2014 an empty meal counted
       at its share \u2014 because "how far off will the day land" is the question
       it answers, where the bar's own number answers "what is on it". */
    var left = {};
    ROWS.forEach(function (row) {
      var m = row[0];
      var target = m === 'kcal' ? tK : targets[m];
      left[m] = Math.round((m === 'kcal' ? tot.all.kcal : tot.all[m]) + asm[m] - target);
    });
    function signed(v) { return (v > 0 ? '+' : '') + v; }
    function sign(v) { return v > 0 ? 'pos' : v < 0 ? 'neg' : 'nil'; }
    /* Each row's verdict and how full it is, kept as the bars are built so the
       folded pills can wear the same two. Folding the card must not change
       what the day is said to be — the pills are the same reading, a line
       high, not a second opinion. */
    var barState = {}, barPct = {};
    var bars = ROWS.map(function (row) {
      var m = row[0];
      var target = Math.max(1, m === 'kcal' ? tK : targets[m]);
      var ate = m === 'kcal' ? tot.eaten.kcal : tot.eaten[m];
      var plan = m === 'kcal' ? tot.all.kcal : tot.all[m];
      var assume = asm[m];
      /* The number is what is ACTUALLY on the day; the hatched band beside it
         is what an empty meal is assumed to become. Adding the assumption
         into the figure made "how much have I got" unanswerable — you could
         not tell food from expectation. The delta below is where the two are
         added up, because that is the question it answers. */
      var full = Math.round(plan);
      /* And the colour follows that same number, not the assumption. A bar
         reading 0 / 180 has no business being green because four empty meals
         are expected to cover it — the state must describe the bar you are
         looking at. The assumption is the delta's job, and only the delta's. */
      var pct = 100 * plan / target;
      /* A band, not a line. The old rule turned red the moment a macro
         crossed its target by anything at all — two grams of fat on a
         sixty-one gram target drew the same alarm as being a quarter over on
         carbohydrate, which is not what either of those days is. Ten grams
         either side of a macro counts as landing on it; calories get three
         per cent, because ten calories is a rounding error rather than a
         tolerance.
       *
         Protein keeps its wider ceiling on top of that: it is the one macro
         a cut wants you to overshoot, so it holds on target to 110%. */
      var diff = plan - target;
      var near = m === 'kcal' ? Math.abs(diff) <= target * 0.03 : Math.abs(diff) <= 10;
      var overAt = m === 'p' ? 110 : m === 'kcal' ? 105 : 100;
      var state = near ? 'on' : pct > overAt ? 'over' : pct >= 90 ? 'on' : 'under';
      barState[m] = state;
      barPct[m] = Math.min(100, pct);
      var wAte = Math.min(100, 100 * ate / target);
      var wPlan = Math.min(100 - wAte, 100 * (plan - ate) / target);
      var wAsm = Math.min(100 - wAte - wPlan, 100 * assume / target);
      return '<div class="mbrow ' + state + '" data-macro="' + m + '" data-state="' + state +
          '" data-eaten="' + Math.round(wAte) + '" data-planned="' +
          Math.round(Math.min(100, 100 * plan / target)) + '">' +
        '<span class="mb-k mb-' + m + '" aria-hidden="true">' + row[1] + '</span>' +
        '<span class="mb-track">' +
          '<i class="mb-ate" style="width:' + wAte.toFixed(1) + '%"></i>' +
          '<i class="mb-plan" style="width:' + wPlan.toFixed(1) + '%"></i>' +
          '<i class="mb-asm" style="width:' + wAsm.toFixed(1) + '%"></i>' +
        '</span>' +
        '<span class="mb-num"><b>' + full + '</b> / ' +
          (m === 'kcal' ? tK : targets[m]) + esc(row[3]) + '</span>' +
        '<span class="vis-hidden">' + row[2] + '</span>' +
        /* What is left sits on the row it belongs to. It used to be a fifth
           line of four signed numbers under the bars, which meant reading a
           bar and then hunting its delta on the line below. Same figure, on
           the same line as the bar it explains. */
        '<span class="mb-d ' + sign(left[m]) + '"><b>' + signed(left[m]) + '</b>' +
          '<span class="vis-hidden">' + (left[m] > 0 ? ' over' : ' to go') + '</span></span>' +
      '</div>';
    }).join('');

    /* A floor and a ceiling, not two more budgets — which is why they are a
       line rather than two more bars. Fibre is what makes a cut survivable
       and we come up short on it most days; sodium is half again over the
       guideline on a day this app fills, and it is also what moves the scale
       overnight without moving any fat. */
    var naCap = 2300;
    var fibFloor = Math.round(tK * 14 / 1000);          // 14 g per 1000 kcal
    var na = Math.round(tot.all.na), fib = Math.round(tot.all.fib);
    /* A floor and a ceiling, drawn as bars now \u2014 and never coloured like the
       four above them. Filling the protein bar is progress; filling the SALT
       bar is a warning, and the same paint on both would say the opposite of
       what it means. So:
     *
       Fibre NEVER turns red. Over a floor is still good \u2014 there is no such
       thing as too much fibre on a cut \u2014 so the only two states are short
       and met.
     *
       Salt NEVER turns green. Staying under a ceiling is the default, not an
       achievement, so it is quiet until it is within a fifth of the cap,
       then it warns, then it is over. Green there would congratulate you for
       having eaten nothing in particular.
     *
       One fill, not the eaten-and-planned pair the macro rows carry: two
       shades on a lesser row is detail nobody reads. */
    var fibState = fib >= fibFloor ? 'met' : 'short';
    var naState = na > naCap ? 'past' : na >= naCap * 0.8 ? 'near' : 'quiet';
    var limitRow = function (glyph, state, dCls, val, cap, unit, name) {
      var d = val - cap;
      return '<div class="mbrow mlim ' + state + '">' +
        '<span class="mb-k" aria-hidden="true">' + glyph + '</span>' +
        '<span class="mb-track"><i class="mlim-f" style="width:' +
          Math.min(100, 100 * val / cap).toFixed(1) + '%"></i></span>' +
        '<span class="mb-num"><b>' + val.toLocaleString() + '</b> / ' +
          cap.toLocaleString() + unit + '</span>' +
        '<span class="vis-hidden">' + name + '</span>' +
        '<span class="mb-d ' + dCls + '"><b>' + (d > 0 ? '+' : '') + d.toLocaleString() +
          '</b></span>' +
      '</div>';
    };
    var micro =
      /* Short of the floor is quiet, not alarming: it is a thing to fix at
         dinner, not a thing you did wrong. Clearing it is the green. */
      limitRow('\uD83C\uDF3E', fibState, fibState === 'met' ? 'nil' : 'neg',
        fib, fibFloor, ' g', 'of fibre') +
      limitRow('\uD83E\uDDC2', naState, naState === 'past' ? 'pos' : 'neg',
        na, naCap, ' mg', 'of sodium');

    /* The same six numbers folded into one row of pills, for when the page
       has scrolled and the bars would be eating the screen. Four signed
       deltas, then fibre and sodium against their floor and ceiling.
       Pressing the row scrolls back up to the bars it stands in for. */
    /* Each pill IS its own bar. Folded, the row used to give the gap and never
       the proportion — minus twenty-four reads the same whether you are five
       per cent off or half a day off, and four pills all reading "under" in
       the same grey say nothing about which one still has a third of the day
       in it.
     *
       There is no room to draw a bar beside the number: six of these only
       just fit a 375-wide phone. But a pill is already a rounded box with a
       background, so it does not need one drawn inside it — it fills left to
       right instead, and costs nothing. The fill is the PALE tone the open
       bars use for planned-not-eaten, because a solid one would win the
       contrast fight against the number sitting on it; and it stops at full,
       so over target fills the pill and lets the figure carry the overshoot,
       which is the rule the bars already follow.
     *
       Verdict and fill both come from the row above, so folding the card
       cannot change what the day is said to be.
     *
       And the denominators go. The fill says the proportion now, so "/2300"
       says it a second time — and dropping it is what buys every pill the
       same width, which is the point: six fills only compare by eye if the
       boxes match. The open bars keep both numbers. */
    var fillPill = function (cls, tone, pct, body) {
      return '<span class="mpill ' + cls + '" style="background:linear-gradient(90deg,' +
        tone + ' 0 ' + pct.toFixed(1) + '%,var(--paper-soft) ' + pct.toFixed(1) + '%)">' +
        body + '</span>';
    };
    var TONE = { under: 'var(--dial-under-pale)', on: 'var(--dial-on-pale)',
      over: 'var(--dial-over-pale)', short: 'var(--dial-under-pale)',
      met: 'var(--dial-on-pale)', quiet: 'var(--mlim-quiet-pale)',
      near: 'var(--dial-under-pale)', past: 'var(--dial-over-pale)' };
    var pills = ROWS.map(function (row) {
      var m = row[0];
      return fillPill(sign(left[m]), TONE[barState[m]] || TONE.under, barPct[m] || 0,
        '<span class="mb-' + m + '">' + row[1] + '</span><b>' + signed(left[m]) + '</b>');
    }).join('') +
      fillPill('mpill-m ' + fibState, TONE[fibState], Math.min(100, 100 * fib / fibFloor),
        '🌾<b>' + fib + '</b>') +
      /* no thousands separator: the comma is four pixels, and four pixels is
         the difference between six pills fitting a 375-wide phone and a
         clipped sixth one, which reads as a bug */
      fillPill('mpill-m ' + naState, TONE[naState], Math.min(100, 100 * na / naCap),
        '🧂<b>' + na + '</b>');

    /* The bars are the door to their own history. Tapping the summary to see
       the detail costs no navigation and puts the two in the same place. */
    return {
      foot: '<button class="mbars" data-mchartopen="1" aria-label="See these over time">' +
          bars + '<span class="mbars-more" aria-hidden="true">&rsaquo;</span></button>' +
        '<div class="mlimits" role="status">' + micro + '</div>',
      pills: pills
    };
  }

  /* The picker sheet: search plus a meal/all toggle, over a list ranked by
     fit. Search narrows what is ranked; it does not outrank the fit, because
     somebody typing "chicken" into a macro picker still wants the portion
     that suits the day, not the best textual match at any size. */
  /* What the household is cooking on this weekday, per the active week's
     plan. The family plan has no dates — Monday is just Monday — so the
     macro day borrows its weekday. Nothing new to enter anywhere: if the
     family planned it, it is on offer, portioned for your own targets. */
  function mFamilyIds(k) {
    var wd = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][keyDate(k).getDay()];
    var ids = [];
    window.Store.day(wd).forEach(function (e) {
      if (BY_ID[e.id] && ids.indexOf(e.id) < 0) ids.push(e.id);
    });
    return ids;
  }

  /* The three ways to name a piece of food, as the first thing the sheet
     says rather than as modes buried behind each other. Scanning is one tap
     from + Add; it used to be four. */
  var MP_ICON = {
    // a barcode, a magnifier, a stack of pages — drawn rather than borrowed
    // from a font, because the glyphs that mean these things are not in every
    // face and the fallbacks are boxes
    scan: '<path d="M2 3v10M4.5 3v10M7 3v7M9.5 3v10M12 3v7M14 3v10"/>',
    look: '<circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2 14 14"/>',
    recipes: '<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M5 6h6M5 8.5h6M5 11h3.5"/>'
  };
  var MP_WAYS = [['scan', 'Scan'], ['look', 'Look up'], ['recipes', 'Recipes']];

  function mpIcon(k) {
    return '<svg class="mp-way-i" viewBox="0 0 16 16" aria-hidden="true" fill="none" ' +
      'stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' +
      MP_ICON[k] + '</svg>';
  }

  function mpWaysHTML(big) {
    return '<div class="mp-ways' + (big ? ' big' : '') + '">' + MP_WAYS.map(function (w) {
      /* No camera, no Scan. Offering a way in that cannot open is worse than
         two ways, and this is the one device question the sheet can answer
         before being asked. */
      if (w[0] === 'scan' && !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return '';
      return '<button class="mp-way' + (S.mpMode === w[0] ? ' on' : '') + '" data-mpmode="' + w[0] + '">' +
        mpIcon(w[0]) + '<span class="mp-way-t">' + w[1] + '</span></button>';
    }).join('') + '</div>';
  }

  /* One row, wherever it is listed. The picker, the look-up and the recent
     list all offer the same thing — a dish at a portion — so they offer it
     in the same shape, and the shape knows whether it is already in the
     basket. */
  function mpRowHTML(r, x, fitText) {
    var inB = S.mpBasket[r.id] !== undefined;
    var inB2 = mIsFav(r);
    if (inB) x = S.mpBasket[r.id];
    var fit = fitText !== undefined && fitText !== null ? fitText
      : '&times;' + fmtNum(x) + (r.food ? ' ' + esc(r.unit) : '') + ' &middot; ' +
        mMacLine(r, x) + mSaltNote(r, x);
    return '<div class="mpick-wrap' + (inB ? ' in' : '') + '">' +
      '<button class="mpick-row" data-mpick="' + esc(String(r.id)) + '" data-mpx="' + x + '"' +
        ' aria-pressed="' + (inB ? 'true' : 'false') + '">' +
        '<span class="mp-tick" aria-hidden="true">' + (inB ? '&#10003;' : '&#43;') + '</span>' +
        leaf(r.score, 'leaf-sm') +
        '<span class="mp-body">' +
          '<span class="mp-name">' +
            (mIsFav(r) ? '<span class="mp-fav">&#9733;</span> ' : '') +
            esc(r.name) + '</span>' +
          '<span class="mp-fit">' + fit + '</span>' +
        '</span>' +
      '</button>' +
      /* The star is a control here, not a badge. Finding a thing once and
         having to find it again tomorrow is the whole reason to keep one. */
      '<span class="mp-side no-print">' +

        (r.food && String(r.id).indexOf('f:my:') !== 0 ? '' :
          '<button class="mp-star" data-mpfav="' + esc(String(r.id)) + '" aria-pressed="' +
            (inB2 ? 'true' : 'false') + '" aria-label="' +
            (inB2 ? 'Remove from favorites' : 'Keep as a favorite') + '">&#9733;</button>') +
      '</span>' +
    '</div>';
  }

  /* What you ate lately, newest first, one row each. The everyday case is a
     thing you have already named once — the tamale from last week — and it
     should not need any of the three ways to reach. */
  function mpRecentHTML() {
    var seen = {}, out = [];
    var keys = Object.keys(MDAYS).sort().reverse();
    keys.forEach(function (k) {
      var day = MDAYS[k] || {};
      Object.keys(day).forEach(function (sk) {
        (day[sk] || []).forEach(function (it) {
          if (seen[it.id] || out.length >= 6) return;
          var r = BY_ID[it.id];
          if (!r) return;
          seen[it.id] = 1;
          out.push({ r: r, x: it.x });
        });
      });
    });
    if (!out.length) return '';
    return '<div class="mt-div">Recent</div>' + out.map(function (e) {
      return mpRowHTML(e.r, e.x);
    }).join('');
  }

  /* Everything waiting, listed where it can be seen. The lists themselves
     tick what is in the basket, but a thing you have just named yourself is
     on no list yet — and a basket you cannot see is a basket you commit by
     surprise. */
  function mBasketListHTML() {
    var ids = Object.keys(S.mpBasket);
    if (!ids.length) return '';
    /* Its own row, not the picker's. The list already ticks what is in the
       basket; repeating the whole row here — stepper, star and all — put the
       same plate on screen twice with two sets of controls. */
    return '<div class="mp-basket"><div class="mp-basket-h">In the basket &middot; ' +
      ids.length + '</div>' + ids.map(function (k) {
        var r = BY_ID[idOf(k)];
        if (!r) return '';
        var x = S.mpBasket[k];
        return '<div class="mpb-row">' +
          '<span class="mpb-b">' +
            '<span class="mpb-n">' + esc(r.name) + '</span>' +
            '<span class="mpb-m">' + mMacLine(r, x) + '</span>' +
          '</span>' +
          '<span class="mpb-x no-print">' +
            '<button data-mbstep="' + esc(String(r.id)) + ':-1" aria-label="Smaller">&minus;</button>' +
            '<span>&times;' + fmtNum(x) + '</span>' +
            '<button data-mbstep="' + esc(String(r.id)) + ':1" aria-label="Bigger">+</button>' +
            '<button class="mpb-out" data-mpick="' + esc(String(r.id)) + '" data-mpx="' + x +
              '" aria-label="Take out of the basket">&times;</button>' +
          '</span>' +
        '</div>';
      }).join('') + '</div>';
  }

  /* What the basket will do to the meal, said before you commit it rather
     than discovered afterwards on the plate. */
  function mBasketFootHTML() {
    var ids = Object.keys(S.mpBasket);
    if (!ids.length) return '';
    var t = { kcal: 0, p: 0, f: 0, c: 0 }, est = false;
    ids.forEach(function (k) {
      var r = BY_ID[idOf(k)];
      if (!r || !r.macro) return;
      var x = S.mpBasket[k];
      t.kcal += (r.macro.kcal || 0) * x; t.p += (r.macro.p || 0) * x;
      t.f += (r.macro.f || 0) * x; t.c += (r.macro.c || 0) * x;
      if (r.est) est = true;
    });
    var targets = mDayTargets(mViewKey());
    var busts = false, over = 0;
    if (targets.p || targets.f || targets.c) {
      var T = mShares(mDay(mViewKey()), targets,
        { k: S.macroPick.slot, w: S.macroPick.w }).T;
      over = Math.round(t.kcal - kcalOf(T));
      busts = over > kcalOf(T) * 0.07;
    }
    return '<div class="mp-foot' + (busts ? ' busts' : '') + '">' +
      '<span class="mp-foot-l">' + (busts ? 'Over this meal by ' + over : 'Adds') + '</span>' +
      '<span class="mp-foot-m">' + (est ? '~' : '') + Math.round(t.kcal) + ' kcal &middot; ' +
        Math.round(t.p) + 'P &middot; ' + Math.round(t.f) + 'F &middot; ' +
        Math.round(t.c) + 'C</span>' +
    '</div>';
  }

  /* Which meal the sheet is filling, when you opened it from the bar rather
     than from a meal. Defaults to the first one you have not finished eating,
     which is nearly always the one you mean and needs no clock to work out. */
  function mNextMeal() {
    var day = mDay(mViewKey()), slots = mReadSlots(), pick = null;
    slots.list.forEach(function (sl) {
      if (pick) return;
      var items = day[sl.k] || [];
      if (!items.length || !items.every(function (it) { return it.eaten; })) pick = sl;
    });
    return pick || slots.list[slots.list.length - 1];
  }

  function mOpenPicker(slotKey, mode) {
    var srec = null;
    mReadSlots().list.forEach(function (sl) { if (sl.k === slotKey) srec = sl; });
    if (!srec) srec = mNextMeal();
    if (!srec) return;
    rememberOpener();
    S.macroPick = { slot: srec.k, n: srec.n, secs: mSlotSecs(srec), w: mSlotW(srec) };
    S.mpSec = 'meal';
    S.mpSort = 'fit';
    S.mpQuery = '';
    S.mpMode = mode || 'home';
    S.mpLook = '';
    S.mpBasket = {};
    pushSheet({ m: 1 });
    renderModal();
  }

  /* The chooser, shown only when the sheet was opened from the bar. Coming in
     through a meal's own + Add has already answered the question, and asking
     it again would be the app forgetting what you just told it. */
  function mMealPickHTML() {
    if (!S.mpFromBar) return '';
    var day = mDay(mViewKey());
    return '<div class="mp-meals">' + mReadSlots().list.map(function (sl) {
      var n = (day[sl.k] || []).length;
      return '<button data-mpslot="' + esc(sl.k) + '" aria-pressed="' +
        (sl.k === S.macroPick.slot ? 'true' : 'false') + '">' + esc(sl.n) +
        (n ? '<i>' + n + '</i>' : '') + '</button>';
    }).join('') + '</div>';
  }

  function macroPickerHTML() {
    var name = S.macroPick.n;
    var d = keyDate(mViewKey());
    var n = Object.keys(S.mpBasket).length;
    var head = '<div class="sheet-top">' +
        '<div class="sheet-eyebrow">Add to ' + esc(name) + ' · ' +
          M_MONS[d.getMonth()] + ' ' + d.getDate() + '</div>' +
        (n ? '<span class="mp-cnt" aria-label="' + n + ' waiting">&#129386; ' + n + '</span>' +
          '<button class="mp-done" data-mpdone="1">Add ' + n + '</button>' : '') +
        '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
      '</div>';
    /* The basket rides above whatever list you are in, not only on the first
       screen. Searching, ticking three things and being unable to see which
       three is the complaint that put it here — a count in the header is not
       an answer to "what have I got". */
    var wrap = function (inner) {
      return '<div class="scrim no-print" data-close="1">' +
        '<div class="sheet" role="dialog" aria-modal="true" aria-label="Add to ' + esc(name) + '">' +
        head + mMealPickHTML() + mBasketListHTML() + inner + mBasketFootHTML() + '</div></div>';
    };

    if (S.mpMode === 'home') {
      /* What is left of the meal, said once at the top. It is the number you
         are shopping against, and it used to be readable only by closing the
         sheet you opened to go shopping. */
      var rem = mMealLeft();
      return wrap(
        (rem ? '<div class="mp-left">' + rem + '</div>' : '') +
        mpWaysHTML(true) +
        mpRecentHTML() +
        '<button class="mpick-row mpick-new" data-mpnew="1">' +
          '<span class="mp-body"><span class="mp-name">&#43; Type it in yourself</span></span></button>');
    }

    if (S.mpMode === 'scan') {
      return wrap(mpWaysHTML() +
        '<div id="scanRoot"></div>' +
        '<div class="mp-controls">' +
          '<input type="search" class="txt" id="nfFind" inputmode="numeric" ' +
            'placeholder="&hellip;or type the number" aria-label="Barcode number">' +
          '<button class="ghost" data-nf="code">Go</button>' +
        '</div>' +
        '<div id="nfResults"></div>' +
        '<button class="mpick-row mpick-new" data-mpnew="1">' +
          '<span class="mp-body"><span class="mp-name">&#43; Type it in yourself</span></span></button>');
    }

    if (S.mpMode === 'look') {
      return wrap(mpWaysHTML() +
        '<div class="mp-controls">' +
          '<input type="search" class="txt" id="mpLookIn" placeholder="Search a food or a dish&hellip;" ' +
            'aria-label="Search" value="' + esc(S.mpLook) + '">' +
        '</div>' +
        '<div id="mpLookList">' + mpLookHTML() + '</div>' +
        '<div id="nfResults"></div>' +
        '<button class="mpick-row mpick-new" data-mpnew="1">' +
          '<span class="mp-body"><span class="mp-name">&#43; Type it in yourself</span></span></button>');
    }

    var fam = mFamilyIds(mViewKey());
    return wrap(mpWaysHTML() +
        '<div class="mp-controls">' +
          '<input type="search" class="txt" id="mpSearch" placeholder="Search a dish or ingredient&hellip;" ' +
            'aria-label="Search" value="' + esc(S.mpQuery) + '">' +
          /* The same section vocabulary the Recipes tab speaks, so filling
             Dinner can peek at just the Sunday Feasts without leaving the
             fit-ranked portions behind. */
          '<select id="mpSec" aria-label="Which recipes">' +
            '<option value="meal"' + (S.mpSec === 'meal' ? ' selected' : '') + '>For this meal</option>' +
            (fam.length ? '<option value="family"' + (S.mpSec === 'family' ? ' selected' : '') +
              '>On the family\u2019s plan (' + fam.length + ')</option>' : '') +
            '<option value="all"' + (S.mpSec === 'all' ? ' selected' : '') + '>Every recipe</option>' +
            '<option value="foods"' + (S.mpSec === 'foods' ? ' selected' : '') + '>Single foods</option>' +
            (function () {
              var out = '', bk = 0;
              mAllSections().forEach(function (sec) {
                if (sec.book !== bk) {
                  out += (bk ? '</optgroup>' : '') + '<optgroup label="' +
                    esc(sec.book === 3 ? 'Ours' : BOOKS[sec.book].name) + '">';
                  bk = sec.book;
                }
                out += '<option value="' + esc(sec.key) + '"' + (S.mpSec === sec.key ? ' selected' : '') + '>' +
                  esc(sec.name) + '</option>';
              });
              return out + (bk ? '</optgroup>' : '');
            })() +
          '</select>' +
          '<select id="mpSort" aria-label="Order">' +
            '<option value="fit"' + (S.mpSort === 'fit' ? ' selected' : '') + '>Best fit</option>' +
            '<option value="protein"' + (S.mpSort === 'protein' ? ' selected' : '') + '>Most protein</option>' +
            '<option value="healthy"' + (S.mpSort === 'healthy' ? ' selected' : '') + '>Healthiest</option>' +
          '</select>' +
        '</div>' +
        '<div id="mpList">' + mpListHTML() + '</div>');
  }

  /* What this meal still has room for. mShares works the day's remainder into
     a share per empty meal; this is that share, in the words the plate rows
     already use. */
  function mMealLeft() {
    var targets = mDayTargets(mViewKey());
    if (!targets.p && !targets.f && !targets.c) return '';
    var T = mShares(mDay(mViewKey()), targets, { k: S.macroPick.slot, w: S.macroPick.w }).T;
    return Math.round(kcalOf(T)) + ' kcal &middot; ' + Math.round(T.p) + 'P &middot; ' +
      Math.round(T.f) + 'F &middot; ' + Math.round(T.c) + 'C left for this meal';
  }

  /* One box, one list. Your own foods and the book's recipes together, each
     saying where it came from, because "do I already have this?" and "what
     does the USDA call it?" are the same question asked once. The food
     tables answer underneath, when they answer. */
  function mpLookHTML() {
    var qs = S.mpLook.trim().toLowerCase();
    if (!qs) return '';
    var day = mDay(mViewKey());
    var targets = mDayTargets(mViewKey());
    var pick = { k: S.macroPick.slot, w: S.macroPick.w };
    var pool = [];
    MFOODS.forEach(function (r) { if (r.name.toLowerCase().indexOf(qs) >= 0) pool.push(r); });
    RECIPES.forEach(function (r) { if (matchRank(r, qs)) pool.push(r); });
    if (!pool.length) return '<div class="mslot-empty">Nothing of yours matches.</div>';
    /* The food you named goes first. Ranked purely on fit, a spoon of honey
       loses to a dozen recipes that merely list honey among their
       ingredients, and the row you typed the word for never appears — this
       box is twelve rows deep. Fit still orders the foods, and orders the
       recipes under them. */
    var ranked = mRank(pool, day, targets, pick);
    var hits = [], rest = [];
    ranked.forEach(function (e) { (e.r.food ? hits : rest).push(e); });
    return hits.concat(rest).slice(0, 12).map(function (e) {
      var r = e.r, xx = S.mpBasket[r.id] !== undefined ? S.mpBasket[r.id] : e.x;
      return mpRowHTML(r, e.x,
        '<span class="mp-src">' + (r.food ? 'Yours' : 'Recipe') + '</span> &times;' + fmtNum(xx) +
        (r.food ? ' ' + esc(r.unit) : '') + ' &middot; ' + mMacLine(r, xx));
    }).join('');
  }

  function mpListHTML() {
    var qs = S.mpQuery.trim().toLowerCase();
    var fam = S.mpSec === 'family' ? mFamilyIds(mViewKey()) : null;
    var pool = S.mpSec === 'foods' ? [] : RECIPES.filter(function (r) {
      var sk = r.book + '-' + r.secNum;
      if (S.mpSec === 'meal' && S.macroPick.secs.indexOf(sk) < 0) return false;
      if (fam && fam.indexOf(r.id) < 0) return false;
      if (!fam && S.mpSec !== 'meal' && S.mpSec !== 'all' && sk !== S.mpSec) return false;
      if (qs && !matchRank(r, qs)) return false;
      return true;
    });
    /* A spoon of honey is not in any section, so it answers to its own lens
       — and to a search from any of them, because somebody typing "honey"
       into a meal picker has already said what they want. */
    if (S.mpSec === 'foods' || qs) {
      MFOODS.forEach(function (r) {
        if (qs && r.name.toLowerCase().indexOf(qs) < 0) return;
        pool.push(r);
      });
    }
    var rows = mRank(pool, mDay(mViewKey()), mDayTargets(mViewKey()),
      { k: S.macroPick.slot, w: S.macroPick.w });
    /* Sorting is a lens, not a different picker: every row keeps the portion
       the fit worked out, whatever order the rows arrive in. */
    if (S.mpSort === 'protein') {
      rows.sort(function (a, b) {
        return (((b.r.macro && b.r.macro.p) || 0) - ((a.r.macro && a.r.macro.p) || 0));
      });
    }
    if (S.mpSort === 'healthy') {
      rows.sort(function (a, b) {
        return (b.r.score === null ? -1 : b.r.score) - (a.r.score === null ? -1 : a.r.score);
      });
    }
    /* A name match beats a fit score. Forty recipes list honey among their
       ingredients, so ranking the spoon of honey against them on how well it
       fills a dinner buries the one row the search was for under forty ways
       to bake with it. Typing a food's name is the whole of the question —
       the foods that answer it go first, in whatever order the lens left
       them, and the recipes follow. */
    if (qs) {
      var hits = [], rest = [];
      rows.forEach(function (e) { (e.r.food ? hits : rest).push(e); });
      rows = hits.concat(rest);
    }
    rows = rows.slice(0, 40);
    var own = '<button class="mpick-row mpick-new" data-mpnew="1">' +
      '<span class="mp-body"><span class="mp-name">&#43; Something else</span>' +
      '</span></button>';
    if (!rows.length) {
      return own + '<div class="mslot-empty">Nothing else matches' +
        (S.mpSec === 'meal' ? ' &mdash; try Every recipe.' : '.') + '</div>';
    }
    /* Always there, at the foot of whatever the list is: "none of these" is
       a thought you have after reading the list, not before. */
    return rows.map(function (e) {
      var r = e.r, xx = S.mpBasket[r.id] !== undefined ? S.mpBasket[r.id] : e.x;
      return mpRowHTML(r, e.x, e.score === null ? 'no data'
        : '&times;' + fmtNum(xx) + (r.food ? ' ' + esc(r.unit) : '') +
          ' &middot; ' + mMacLine(r, xx) + mSaltNote(r, xx));
    }).join('') + own;
  }

  /* Only the list under the search box redraws while you type — redrawing the
     sheet would fight the cursor for the input. refreshPreview() set the
     pattern. */
  function refreshMacroPicker() {
    var el = $('mpList');
    if (el) el.innerHTML = mpListHTML();
  }

  /* Which plan the four buttons describe. Read by the sheet and by the tests,
     which hold every key against a button rather than keeping their own copy. */
  var MGOAL_WORDS = { cut2: 'Hard cut', cut1: 'Steady cut', keep: 'Maintain', gain: 'Lean gain' };

  /* The status line over the gram boxes. The boxes are the plan's one
     rendering, so this speaks only when something needs saying: the profile
     cannot compute yet, or the arithmetic had to floor the carbs. */
  /* One fact, no lecture attached: a hard cut runs below the rate a body
     spends doing nothing. Worth knowing you are there; not the app's business
     to argue about it. */
  function mtPlanLine(plan, pr) {
    if (!plan) return 'Fill in who you are.';
    var tdee = pr ? mTdee(pr) : null;
    var bmr = tdee === null ? null : tdee / (pr.act || 1);
    if (bmr !== null && plan.kcal < bmr) {
      return 'Below your ' + Math.round(bmr) + ' kcal at rest.';
    }
    return '';
  }

  /* The personal half of the sharing sheet. The household above is shared
     with people by reading them a code; this is carried between devices by
     being you, which is why it is an account and not a code — a weight
     history is not a thing to guard with a secret meant to be read aloud. */
  function mAccountBlockHTML() {
    var who = mAccount();
    var waiting = !who && !mAuthKnown && mSuspectAccount();
    var word = { off: 'On this device only', connecting: 'Connecting\u2026',
      on: 'Synced', error: 'Cannot reach the server' }[S_SYNC_STATE];
    var body;
    if (waiting) {
      body = '<p class="sync-p">Finding your account&hellip;</p>';
    } else if (!window.Store.configured) {
      body = '<p class="sync-p">No server behind this copy.</p>';
    } else if (who) {
      body = '<div class="sync-who">Signed in as <strong>' +
        esc(who.email || who.name) + '</strong></div>' +
        /* Two devices used apart before they were ever joined arrive with two
           different days and no shared history to reconcile them by. The merge
           is newest-wins part by part, which is right forever after and
           arbitrary the first time — so the tie-breaker stays, folded away.
           It is a once-ever button, and it was taking three paragraphs and
           two thirds of the sheet to say so. */
        '<details class="sync-fold"><summary>The two devices disagree</summary>' +
          '<div class="sync-row">' +
            '<button class="ghost" data-mysync="push">This device is right</button>' +
            '<button class="ghost" data-mysync="pull">The account is right</button>' +
          '</div>' +
        '</details>' +
        '<div class="sync-row">' +
          '<button class="ghost" data-mysync="out">Sign out of this device</button></div>';
    } else {
      body = (S.mySent
        ? '<div class="sync-warn">Open the link sent to <strong>' + esc(S.myJoin) + '</strong>.</div>'
        : '') +
        /* Google draws its own button in here, because the flow that keeps
           sign-in on this page can only be started from Google's button. Ours
           stays underneath as the fallback, hidden the moment theirs lands —
           so a browser that cannot reach the host still has a way in, and
           nobody is left looking at an empty box. */
        '<div class="sync-row">' +
          '<div id="myGoogleBtn" class="sync-gbtn"></div>' +
          '<button class="btn-primary" id="myGoogleFallback" data-mysync="google">' +
            'Sign in with Google</button>' +
        '</div>' +
        /* Google drawing its button is not the same as Google accepting it:
           on an origin the client does not allow, the button appears and then
           refuses, and the only sign is a line in the console nobody is
           reading. That is not a hypothetical — the console warns it deletes
           clients unused for six months. So the old way in stays reachable,
           quietly, whenever theirs is the one on screen. */
        '<button class="sync-alt hide" id="myGoogleAlt" data-mysync="google">' +
          'Trouble signing in? Try the older way</button>' +
        /* Kept, because a Google account is not a thing everybody has and this
           is going out to strangers — but folded, because for nearly everybody
           the button above is the entire answer. */
        '<details class="sync-fold"><summary>No Google account?</summary>' +
          '<div class="sync-row">' +
            '<input class="txt" id="myJoin" type="email" inputmode="email" ' +
              'placeholder="your email address" aria-label="Email address" value="' +
              esc(S.myJoin) + '">' +
            '<button class="ghost" data-mysync="email">Send a link</button>' +
          '</div>' +
        '</details>';
    }
    return body +
      (S.myNote ? '<div class="sync-warn">' + esc(S.myNote) + '</div>' : '') +
      (S.myErr ? '<div class="sync-warn">' + esc(S.myErr) + '</div>' : '') +
      /* Only once there is an account to have a state. Signed out, this said
         "on this device only" directly above the pantry card saying exactly
         the same words about a different thing, which reads as one status
         stuttering rather than two facts. The button already says the state. */
      (who || waiting
        ? '<div class="sync-status"><span class="dot' +
          (S_SYNC_STATE === 'on' ? ' on' : S_SYNC_STATE === 'error' ? ' off'
            : S_SYNC_STATE === 'connecting' ? ' wait' : '') + '"></span>' + esc(word) + '</div>'
        : '');
  }

  /* Looking it up instead of guessing at it.
   *
     Two sources, because they answer different questions. The USDA's
     FoodData Central knows what a chicken tamale is, in the sense of what is
     in one on average — generic, cooked, unbranded food, which is most of
     what anybody eats and none of what carries a barcode. Open Food Facts
     knows the packet in your hand by its number.
   *
     Neither is asked anything until you ask. A reader who never opens this
     box never touches either host, which is the property the whole app has
     kept and its offline test insists on. */
  function mNutrients(list) {
    var out = { kcal: 0, p: 0, f: 0, c: 0 };
    (list || []).forEach(function (n) {
      var name = n.nutrientName || (n.nutrient && n.nutrient.name) || '';
      var unit = (n.unitName || (n.nutrient && n.nutrient.unitName) || '').toUpperCase();
      var v = n.value === undefined ? n.amount : n.value;
      if (typeof v !== 'number') return;
      if (name === 'Energy' && unit === 'KCAL') out.kcal = v;
      else if (name === 'Protein') out.p = v;
      else if (name === 'Total lipid (fat)') out.f = v;
      else if (name === 'Carbohydrate, by difference') out.c = v;
    });
    return out;
  }

  function mFoodSearch(q, packaged) {
    var key = window.USDA_KEY || '';
    if (!key) return Promise.reject(new Error('nokey'));
    /* Generic or packaged, because they are different questions. FNDDS and
       SR Legacy are cooked, unbranded food — including everything the survey
       files under "Restaurant, ..." — and Branded is the barcode aisle. There
       is no restaurant filter as such; restaurant dishes live inside the
       generic set under that prefix, and the source is shown so you can see
       which kind of answer you are looking at. */
    var types = packaged ? ['Branded'] : ['Survey (FNDDS)', 'SR Legacy', 'Foundation'];
    /* Asked as a POST, because the query string is a minefield here. The
       list of data sets has to keep its commas as separators, and
       encodeURIComponent leaves parentheses alone — legal in a URL, and yet
       the gateway answers "Survey (FNDDS)" with a bare nginx 400 the moment
       any browser-shaped header is attached, which is every request the app
       will ever make. The POST body takes the list as a list and none of
       that arises. Preflight is answered. */
    return fetch('https://api.nal.usda.gov/fdc/v1/foods/search?api_key=' +
      encodeURIComponent(key), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, pageSize: 40, dataType: types })
      }).then(function (r) {
      if (!r.ok) throw new Error('http');
      return r.json();
    }).then(function (d) {
      /* The API's idea of relevance is loose — a search for "tamale" comes
         back with "Candy, gummy" in it — and the same dish appears once per
         data set, so "Restaurant, Latino, tamale, pork" arrives twice. Keep
         only what actually mentions what was asked for, and only once. */
      var words = q.toLowerCase().split(/\s+/).filter(function (w) { return w.length > 2; });
      var seen = {};
      return (d.foods || []).filter(function (f) {
        var desc = String(f.description || '').toLowerCase();
        if (words.length && !words.some(function (w) { return desc.indexOf(w) >= 0; })) return false;
        if (seen[desc]) return false;
        seen[desc] = 1;
        return true;
      }).slice(0, 12).map(function (f) {
        var n = mNutrients(f.foodNutrients);
        /* The USDA quotes per hundred grams and then, usually, tells you what
           one of the thing actually weighs — a tamale is 140 g, "1 item, any
           size". Offer the item rather than the hundred grams: nobody eats a
           hundred grams of tamale, they eat a tamale. */
        var best = null;
        (f.foodMeasures || []).forEach(function (m) {
          var t = String(m.disseminationText || '');
          if (!m.gramWeight || /not specified/i.test(t)) return;
          if (!best || (m.rank || 99) < (best.rank || 99)) best = m;
        });
        var per = best ? best.gramWeight / 100 : 1;
        var unit = best ? String(best.disseminationText).replace(/^1\s+/, '') : '100 g';
        var src = f.dataType === 'Branded' ? (f.brandOwner || 'packaged')
          : f.dataType === 'Survey (FNDDS)' ? 'survey' : 'reference';
        return { name: f.description, unit: unit,
          kcal: Math.round(n.kcal * per), p: Math.round(n.p * per),
          f: Math.round(n.f * per), c: Math.round(n.c * per),
          src: src, note: best ? 'the USDA, ' + best.gramWeight + ' g' : 'the USDA' };
      }).filter(function (x) { return x.kcal || x.p || x.f || x.c; });
    });
  }

  /* ------------------------------------------------------------------------
   * Reading a barcode with the camera.
   *
   * Safari has no barcode reader of its own and is not going to grow one to
   * suit us, so on an iPhone the choice was a decoder from somebody else's
   * CDN or none at all. This app has fetched nothing from another host since
   * it was built — the typefaces and the engravings are all in here — and a
   * hundred and fifty lines is a smaller price than breaking that.
   *
   * EAN-13 and UPC-A, which is EAN-13 with a nought in front. Ninety-five
   * modules: a guard, six digits, a centre guard, six digits, a guard. Each
   * digit is four runs of black and white adding to seven modules, so a digit
   * can be read from the four run-lengths alone without knowing the scale —
   * which is what makes this survive a phone held at arm's length rather than
   * needing the barcode squared up at a fixed distance.
   *
   * The left six carry the first digit in their parity, and the checksum
   * catches what the thresholding gets wrong. A frame that does not decode
   * simply is not one; the next arrives in a sixtieth of a second.
   * --------------------------------------------------------------------- */
  var EAN_L = ['3211', '2221', '2122', '1411', '1132', '1231', '1114', '1312', '1213', '3112'];
  var EAN_PARITY = { '000000': 0, '001011': 1, '001101': 2, '001110': 3, '010011': 4,
    '011001': 5, '011100': 6, '010101': 7, '010110': 8, '011010': 9 };

  function mRuns(row) {
    var mid = 0, i;
    for (i = 0; i < row.length; i++) mid += row[i];
    mid /= row.length;
    var runs = [], cur = row[0] < mid, len = 0;
    for (i = 0; i < row.length; i++) {
      var dark = row[i] < mid;
      if (dark === cur) len++;
      else { runs.push({ dark: cur, len: len }); cur = dark; len = 1; }
    }
    runs.push({ dark: cur, len: len });
    return runs;
  }

  function mDigitAt(runs, i) {
    if (i + 4 > runs.length) return null;
    var total = 0, k;
    for (k = 0; k < 4; k++) total += runs[i + k].len;
    if (total < 4) return null;
    var unit = total / 7, pat = '';
    for (k = 0; k < 4; k++) {
      var m = Math.round(runs[i + k].len / unit);
      if (m < 1 || m > 4) return null;
      pat += m;
    }
    var odd = EAN_L.indexOf(pat);
    if (odd >= 0) return { d: odd, parity: '0' };
    var even = EAN_L.indexOf(pat.split('').reverse().join(''));
    if (even >= 0) return { d: even, parity: '1' };
    return null;
  }

  function mDecodeRuns(runs) {
    for (var s = 0; s + 59 <= runs.length; s++) {
      if (!runs[s].dark) continue;
      if ((runs[s].len + runs[s + 1].len + runs[s + 2].len) / 3 < 0.7) continue;
      var left = [], par = '', i = s + 3, r, n;
      for (n = 0; n < 6; n++) { r = mDigitAt(runs, i); if (!r) break; left.push(r.d); par += r.parity; i += 4; }
      if (left.length !== 6) continue;
      i += 5;                                   // the centre guard, five runs
      var right = [];
      for (n = 0; n < 6; n++) { r = mDigitAt(runs, i); if (!r) break; right.push(r.d); i += 4; }
      if (right.length !== 6 || !(par in EAN_PARITY)) continue;
      var digits = [EAN_PARITY[par]].concat(left, right);
      var sum = 0;
      for (n = 0; n < 12; n++) sum += digits[n] * (n % 2 ? 3 : 1);
      if ((10 - (sum % 10)) % 10 !== digits[12]) continue;   // the checksum decides
      return digits.join('');
    }
    return null;
  }

  function mDecodeRow(row) {
    return mDecodeRuns(mRuns(row)) ||
      mDecodeRuns(mRuns(Array.prototype.slice.call(row).reverse()));
  }

  /* Several lines across the middle of the frame, because a barcode is never
     quite level and one of them will cross it cleanly. */
  function mDecodeFrame(img, w, h) {
    for (var f = 0.35; f <= 0.66; f += 0.06) {
      var y = Math.floor(h * f), row = [], x;
      for (x = 0; x < w; x++) {
        var o = (y * w + x) * 4;
        row.push((img[o] * 299 + img[o + 1] * 587 + img[o + 2] * 114) / 1000);
      }
      var got = mDecodeRow(row);
      if (got) return got;
    }
    return null;
  }

  window.__ean = mDecodeRow;      // so the tests can read a barcode without a camera

  function mBarcodeLookup(code) {
    /* Open Food Facts asks callers to say who they are. A browser cannot set
       its own User-Agent, so their documented alternative is to name the app
       in the query — which costs nothing and is the difference between
       being a known caller and being anonymous traffic to be throttled.
     *
       Fifteen product reads a minute per address is the published limit, and
       a supermarket aisle is exactly where somebody scans four things in a
       row, so being turned away has to read as "wait a moment" rather than
       as "this is broken". Their full-text search lives in a separate
       service and is not part of this API, which is why the searching here
       is the USDA's job and the barcodes are theirs. */
    var url = 'https://world.openfoodfacts.org/api/v2/product/' +
      encodeURIComponent(code) + '.json?fields=product_name,brands,nutriments,serving_size' +
      '&app_name=' + encodeURIComponent('Hive and Hearth') +
      '&app_version=' + encodeURIComponent(BUILD);
    return fetch(url).then(function (r) {
      if (r.status === 429 || r.status === 503) throw new Error('toofast');
      return r.json();
    }).then(function (d) {
      var p = d && d.product;
      if (!p) throw new Error('none');
      var nu = p.nutriments || {};
      var per = function (k) {
        var v = nu[k + '_serving'];
        return typeof v === 'number' ? { v: v, serving: true } : { v: nu[k + '_100g'], serving: false };
      };
      var e = per('energy-kcal');
      var pr2 = per('proteins'), fa = per('fat'), ca = per('carbohydrates');
      /* A great many products in Open Food Facts are photographs and a name
         with no nutrition table behind them yet. Every figure comes back
         missing, and rounding a missing figure gives zero — which would put
         a plate on the day claiming to be free, and quietly wrong the whole
         day's arithmetic. Missing is not zero, and has to say so. */
      var known = [e.v, pr2.v, fa.v, ca.v].some(function (v) { return typeof v === 'number'; });
      if (!known) throw new Error('nonutrition');
      var num2 = function (v) { return typeof v === 'number' ? Math.round(v) : 0; };
      return [{
        name: [p.brands, p.product_name].filter(Boolean).join(' ') || ('Barcode ' + code),
        unit: e.serving ? (p.serving_size || 'serving') : '100 g',
        kcal: num2(e.v), p: num2(pr2.v), f: num2(fa.v), c: num2(ca.v),
        note: 'Open Food Facts'
      }];
    });
  }

  function mLookupRows(list) {
    if (!list.length) return '<div class="mslot-empty">Nothing came back.</div>';
    return list.map(function (x, i) {
      MLOOKUP[i] = x;
      return '<button class="mpick-row" data-nfpick="' + i + '">' +
        '<span class="mp-body"><span class="mp-name">' + esc(x.name) + '</span>' +
        '<span class="mp-fit">' + x.kcal + ' kcal &middot; ' + x.p + 'P &middot; ' + x.f +
        'F &middot; ' + x.c + 'C per ' + esc(x.unit) +
        (x.src ? ' <span class="mp-src">' + esc(x.src) + '</span>' : '') +
        '</span></span></button>';
    }).join('');
  }

  var MLOOKUP = {};

  /* The food tables, asked once you have stopped typing. Late answers are
     dropped rather than drawn: a slow reply to "tam" must not land on top of
     the results for "tamale". */
  var mLookTimer = null, mLookSeq = 0;
  function mLookNet(term) {
    var mine = ++mLookSeq;
    var res = $('nfResults');
    if (!res) return;
    res.innerHTML = '<div class="mslot-empty">Looking in the food tables&hellip;</div>';
    MLOOKUP = {};
    mFoodSearch(term, false).then(function (list) {
      if (mine !== mLookSeq || !$('nfResults')) return;
      $('nfResults').innerHTML = list.length
        ? '<div class="mt-div">From the food tables</div>' + mLookupRows(list) : '';
    }, function (err) {
      if (mine !== mLookSeq || !$('nfResults')) return;
      $('nfResults').innerHTML = '<div class="mslot-empty">' +
        (err && err.message === 'nokey' ? 'No USDA key in src/config.js.'
          : err && err.message === 'toofast' ? 'Asked too often just now.'
            : 'The food tables did not answer.') + '</div>';
    });
  }

  /* The camera, held over a packet. Native BarcodeDetector where a browser
     has one, because it is better at this than we are; the decoder above
     where it does not, which is every iPhone. */
  var mCam = null;

  function mScanStop() {
    if (mCam && mCam.stream) mCam.stream.getTracks().forEach(function (t) { t.stop(); });
    if (mCam && mCam.raf) cancelAnimationFrame(mCam.raf);
    mCam = null;
    var el = $('scanRoot');
    if (el) el.innerHTML = '';
  }

  function mScanStart() {
    var root = $('scanRoot');
    if (!root) return;                  // the sheet moved on before we got here
    root.innerHTML = '<div class="scan-wrap">' +
      '<video id="scanVid" playsinline muted></video>' +
      '<div class="scan-line"></div>' +
      '<div class="scan-say" id="scanSay">Hold the barcode across the line</div>' +
      '<button class="ghost scan-x" data-scan="stop">Stop</button>' +
      '</div>';
    var vid = $('scanVid');
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var det = null;
    if (window.BarcodeDetector) {
      try { det = new window.BarcodeDetector({ formats: ['ean_13', 'upc_a', 'ean_8', 'upc_e'] }); }
      catch (e) { det = null; }
    }
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }
    }).then(function (stream) {
      mCam = { stream: stream, raf: 0 };
      vid.srcObject = stream;
      vid.play();
      var tick = function () {
        if (!mCam) return;
        mCam.raf = requestAnimationFrame(tick);
        if (!vid.videoWidth) return;
        var w = Math.min(640, vid.videoWidth);
        var h = Math.round(vid.videoHeight * w / vid.videoWidth);
        canvas.width = w; canvas.height = h;
        ctx.drawImage(vid, 0, 0, w, h);
        var found = null;
        if (det) {
          det.detect(canvas).then(function (list) {
            if (list && list.length) mScanGot(list[0].rawValue);
          }, function () { det = null; });
        } else {
          try { found = mDecodeFrame(ctx.getImageData(0, 0, w, h).data, w, h); }
          catch (e) { found = null; }
          if (found) mScanGot(found);
        }
      };
      tick();
    }, function (err) {
      /* The answer can arrive after the question is gone. Scan opens the lens
         the moment the mode is chosen, so leaving the mode — or the sheet —
         before the permission prompt resolves tears this element out from
         under the reply, and writing to it then threw. */
      var say = $('scanSay');
      if (!say) return;
      say.textContent = err && err.name === 'NotAllowedError'
        ? 'The camera was not allowed. Type the number instead.'
        : 'No camera here. Type the number instead.';
    });
  }

  function mScanGot(code) {
    if (!mCam || !code) return;
    mScanStop();
    if ($('nfFind')) $('nfFind').value = code;
    var res = $('nfResults');
    if (res) res.innerHTML = '<div class="mslot-empty">Looking up ' + esc(code) + '&hellip;</div>';
    MLOOKUP = {};
    mBarcodeLookup(String(code).replace(/\D/g, '')).then(function (list) {
      if ($('nfResults')) $('nfResults').innerHTML = mLookupRows(list);
    }, function (err) {
      if ($('nfResults')) {
        $('nfResults').innerHTML = '<div class="mslot-empty">' + esc(code) +
          (err && err.message === 'nonutrition'
            ? ' is in Open Food Facts, but with no nutrition table yet. Read it off the packet below.'
            : err && err.message === 'toofast'
              ? ' — Open Food Facts is asking us to slow down. Wait a minute, or read the packet below.'
              : ' is not in Open Food Facts. Type what it was below.') + '</div>';
      }
    });
  }

  function mNewFoodHTML() {
    /* Arriving with the numbers already known — off a barcode or a food
       table — or arriving empty, which is the same form either way. */
    var pre = (S.newFood && S.newFood.pre) || null;
    var box = function (id, label, unit, ph, v) {
      return '<div class="mtl-row"><span class="mtl-lab">' + label + '</span>' +
        '<span class="mtl-val"><input type="number" id="' + id + '" min="0" max="9999" ' +
        'step="1" inputmode="numeric" placeholder="' + (ph || '') + '"' +
        (v || v === 0 ? ' value="' + esc(String(v)) + '"' : '') + '>' +
        (unit ? '<span class="mtl-u">' + unit + '</span>' : '') + '</span></div>';
    };
    return '<div class="scrim no-print" data-close="1">' +
      '<div class="sheet mt-sheet" role="dialog" aria-modal="true" aria-label="Add a food">' +
        '<div class="sheet-top">' +
          '<div class="sheet-eyebrow">' + (pre ? 'How much?' : 'Type it in') + '</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
        '</div>' +
        (pre && pre.note
          ? '<div class="mt-cap">From ' + esc(pre.note) + '</div>' : '') +
        '<div class="mtl-row"><span class="mtl-lab">Called</span>' +
          '<span class="mtl-val"><input type="text" id="nfName" ' +
            'placeholder="Chicken tamale" aria-label="What it is called" value="' +
            esc((pre && pre.name) || '') + '"></span></div>' +
        '<div class="mtl-row"><span class="mtl-lab">One of them is</span>' +
          '<span class="mtl-val"><input type="text" id="nfUnit" ' +
            'placeholder="tamale" aria-label="What one of them is called" value="' +
            esc((pre && pre.unit) || '') + '"></span></div>' +
        box('nfKcal', 'Calories', 'kcal', '250', pre && pre.kcal) +
        box('nfP', 'Protein', 'g', '10', pre && pre.p) +
        box('nfF', 'Fat', 'g', '12', pre && pre.f) +
        box('nfC', 'Carbs', 'g', '25', pre && pre.c) +
        '<div class="mt-cap" id="nfNote"></div>' +
        '<div class="sync-row">' +
          '<button class="btn-primary" data-nf="save">Add it to the day</button>' +
          '<button class="ghost" data-nf="cancel">Cancel</button>' +
        '</div>' +
      '</div></div>';
  }

  /* Seven toggles, Monday first. Derived from the workouts box until one is
     pressed; from then on the list is yours. */
  /* Offered only once it can be trusted, and never taken without being
     asked for — a number that quietly redrew somebody's whole plan on the
     twenty-first morning would be the app changing its mind about them
     behind their back. */
  function mMeasuredRowHTML(pr) {
    var m = mMeasuredTdee();
    if (!m) return '';
    var on = !!pr.useTdee;
    var formula = mBurn(pr);
    return '<div class="mtl-row mt-meas">' +
      '<span class="mtl-lab">Measured burn</span>' +
      '<span class="mtl-val">' +
        '<span class="mt-meas-n"><b>' + m.tdee.toLocaleString() + '</b> kcal' +
          (formula ? ' <i>vs ' + Math.round(formula.tdee).toLocaleString() +
            ' by the formula</i>' : '') + '</span>' +
        '<button class="mt-meas-b" data-mtdee="' + (on ? '0' : '1') +
          '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
          (on ? 'In use' : 'Use it') + '</button>' +
      '</span>' +
    '</div>' +
    '<div class="mt-cap mt-meas-c">From ' + m.days + ' days: ' +
      m.eaten.toLocaleString() + ' kcal a day across ' + m.meals + ' of them, and ' +
      (m.lb === 0 ? 'no change on the scale'
        : mLbWord(m.lb) + ' on the scale') + '.</div>';
  }

  function mTrainRowHTML() {
    var on = mTrainDays();
    var L = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    var FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return '<span class="mtrain" id="mtTrain">' + L.map(function (w, i) {
      var lit = on.indexOf(i) >= 0;
      return '<button data-mtrain="' + i + '" aria-pressed="' + (lit ? 'true' : 'false') +
        '" aria-label="' + FULL[i] + (lit ? ', training day' : '') + '">' + w + '</button>';
    }).join('') + '</span>';
  }

  /* The card you get for closing a day, and the one the menu opens for any
     day. Deltas signed and named the way the pills are — over and short, not
     plus and minus — so the two say the same thing in the same words. */
  /* The card you get for closing a day, and the one the menu opens for any
     day.
   *
     A sentence before a number. At nine at night the useful thing is what
     kind of day it was; the arithmetic is the evidence for it, not the
     headline. Everything below is read back through mTotals and mDayTargets —
     the same two the pills at the top use — so the card and the strip cannot
     come to different conclusions about what you ate. */
  function mSummaryHTML(k) {
    var s = mDaySummary(k);
    var d = keyDate(k);
    var title = M_WDAYS[d.getDay()] + ', ' + M_MONS[d.getMonth()] + ' ' + d.getDate();
    var dk = s.got - s.want;

    /* One clause about the thing that actually went wrong, in the order a
       person notices it: did you eat the day, then did you get the protein. */
    var says;
    if (!s.any) {
      says = 'Nothing was written down on this day.';
    } else if (s.thin) {
      says = 'Only <b>' + s.got.toLocaleString() + '</b> written down. Either a very light day ' +
        'or one that stopped being logged — this cannot tell those apart, and does not guess.';
    } else if (dk > s.want * 0.12 && s.rows[0].got - s.rows[0].want < -20) {
      says = 'Over by <b>' + Math.abs(dk) + '</b> and <b>' +
        Math.abs(s.rows[0].got - s.rows[0].want) + ' g short on protein</b>. ' +
        'The calories went somewhere that was not protein.';
    } else if (dk > s.want * 0.12) {
      says = '<b>' + Math.abs(dk) + ' over</b>, with the protein where it should be.';
    } else if (s.rows[0].got - s.rows[0].want < -20) {
      says = 'Calories landed, but <b>' + Math.abs(s.rows[0].got - s.rows[0].want) +
        ' g short on protein</b>.';
    } else if (Math.abs(dk) <= s.want * 0.05) {
      says = 'On the day and on the protein. <b>Nothing to fix.</b>';
    } else {
      says = 'Close enough on both.';
    }

    /* The ring carries the OVERSHOOT as well as the fill. A bar that stops at
       a hundred per cent cannot tell fourteen hundred from twenty-one; past
       target this keeps going on an inner track, so busting the day looks
       like busting the day. */
    var R = 55, C = 2 * Math.PI * R, R2 = 41, C2 = 2 * Math.PI * R2;
    var pct = s.want ? s.got / s.want : 0;
    var over = Math.max(0, Math.min(1, pct - 1));
    var ringCol = pct > 1.05 ? 'var(--dial-over)' : pct < 0.9 ? 'var(--ochre)' : 'var(--green)';
    var ring = '<div class="ds-ring"><svg viewBox="0 0 132 132" aria-hidden="true">' +
      '<circle class="t" cx="66" cy="66" r="' + R + '"></circle>' +
      '<circle class="f" cx="66" cy="66" r="' + R + '" stroke="' + ringCol + '" ' +
        'stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' +
        (C * (1 - Math.min(1, pct))).toFixed(1) + '"></circle>' +
      (over > 0 ? '<circle class="o" cx="66" cy="66" r="' + R2 + '" stroke-dasharray="' +
        C2.toFixed(1) + '" stroke-dashoffset="' + (C2 * (1 - over)).toFixed(1) + '"></circle>' : '') +
      '</svg><span class="ds-ring-m"><b>' + s.got.toLocaleString() + '</b>' +
      '<i>of ' + s.want.toLocaleString() + '</i></span></div>';

    /* Protein, day by day. The week's fact, sitting inside the day. */
    var pips = '<div class="ds-pips">' + s.week.map(function (w) {
      var c = w.hit === null ? '' : w.hit ? (w.today ? ' today' : ' hit') : ' miss';
      return '<span class="ds-pip' + c + '"></span>';
    }).join('') + '</div><div class="ds-sub">protein, day by day</div>';

    /* A mark where the target sits, so "how far past" is a distance you can
       see rather than a subtraction you have to do. */
    var bars = s.rows.map(function (r) {
      var top = Math.max(r.got, r.want) * 1.15 || 1;
      var bust = r.got > r.want * 1.08;
      return '<div class="ds-m"><span class="ds-mk ' + r.kk + '">' +
        r.kk.toUpperCase() + '</span>' +
        '<span class="ds-mt"><span class="ds-mb ' + (bust ? 'bust' : r.kk) + '" style="width:' +
          (100 * r.got / top).toFixed(1) + '%"></span>' +
          '<span class="ds-mk-t" style="left:' + (100 * r.want / top).toFixed(1) + '%"></span>' +
        '</span>' +
        '<span class="ds-mv"><b>' + r.got + '</b> / ' + r.want + ' g</span></div>';
    }).join('');

    var top = 1;
    s.week.forEach(function (w) { if (w.kcal) top = Math.max(top, w.kcal, w.want); });
    top = top * 1.12;
    var week = '<div class="ds-week">' + s.week.map(function (w) {
      if (w.kcal === null) {
        return '<span class="ds-wk none" title="' + esc(w.k) + ' — nothing logged">' +
          '<i style="height:8px"></i></span>';
      }
      return '<span class="ds-wk' + (w.today ? ' today' : '') +
        (w.kcal > w.want ? ' over' : '') + '" title="' + esc(w.k) + ' — ' +
        w.kcal.toLocaleString() + ' of ' + w.want.toLocaleString() + '">' +
        '<i style="height:' + (100 * w.kcal / top).toFixed(1) + '%"></i></span>';
    }).join('') + '<span class="ds-line" style="top:' +
      (100 - 100 * s.want / top).toFixed(1) + '%"><span>target</span></span></div>' +
      '<div class="ds-days">' + s.week.map(function (w) {
        return '<span' + (w.today ? ' class="today"' : '') + '>' + esc(w.lab) + '</span>';
      }).join('') + '</div>';

    var COL = ['var(--ochre)', 'oklch(0.58 0.09 40)', 'var(--green)', 'oklch(0.52 0.07 70)'];
    var split = s.meals.length
      ? '<div class="ds-split">' + s.meals.map(function (m, i) {
          var pc = m.kcal / (s.mTot || 1);
          return '<span style="flex:' + m.kcal + ' 1 0;background:' + COL[i % 4] + '">' +
            (pc > 0.14 ? esc(m.n.slice(0, 1)) + ' ' + Math.round(pc * 100) + '%' : '') + '</span>';
        }).join('') + '</div>' +
        '<div class="ds-splitl"><span>' + esc(s.meals.map(function (m) { return m.n; }).join(' · ')) +
        '</span><span><b>' + Math.round(100 * s.biggest.kcal / (s.mTot || 1)) + '%</b> in ' +
        esc(s.biggest.n.toLowerCase()) + '</span></div>'
      : '';

    var dv = s.got - s.avg;
    var facts = '<div class="ds-facts">' +
      (s.avg ? '<div class="ds-fact"><em>' + (dv > 0 ? '+' : '') + dv + '</em><span>against your ' +
        'seven-day average of <b>' + s.avg.toLocaleString() + '</b></span></div>' : '') +
      (s.kept ? '<div class="ds-fact"><em>' + s.onP + '/' + s.kept + '</em><span>days on protein, ' +
        'of the ones you wrote down</span></div>' : '') +
    '</div>';

    return '<div class="scrim no-print" data-close="1">' +
      '<div class="sheet ds-sheet" role="dialog" aria-modal="true" aria-label="How the day went">' +
        '<div class="sheet-top">' +
          '<div class="sheet-eyebrow">How the day went</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="ds-day">' + esc(title) + '</div>' +
        '<p class="ds-says">' + says + '</p>' +
        (s.any
          ? '<div class="ds-hero">' + ring +
              '<div class="ds-side"><div class="ds-d ' +
                (Math.abs(dk) <= s.want * 0.05 ? 'on' : dk > 0 ? 'over' : 'under') + '">' +
                (dk > 0 ? '+' : '') + dk + '</div>' +
                '<div class="ds-sub">calories against target</div>' + pips +
              '</div>' +
            '</div>' +
            '<div class="ds-macros">' + bars + '</div>' +
            '<div class="ds-blk"><div class="ds-h">The seven days to here</div>' + week + '</div>' +
            (split ? '<div class="ds-blk"><div class="ds-h">Where the day went</div>' +
              split + '</div>' : '') +
            (facts.indexOf('ds-fact') > 0
              ? '<div class="ds-blk"><div class="ds-h">Against your week</div>' + facts + '</div>'
              : '')
          : '') +
        '<div class="sync-row"><button class="btn-primary" data-close="1">Done</button></div>' +
      '</div>' +
    '</div>';
  }

  function macroTargetsHTML() {
    var t = mReadTargets();
    var pr = mReadProfile();
    var plan = mPlanCalc(pr);
    /* A ledger row: what it is on the left, what it says on the right. One
       fact per line, values right-aligned into a column — the arrangement
       that cannot wrap the way a row of labelled boxes wraps on a phone. */
    var row = function (label, valueHTML) {
      return '<div class="mtl-row"><span class="mtl-lab">' + label + '</span>' +
        '<span class="mtl-val">' + valueHTML + '</span></div>';
    };
    var box = function (id, v, unit) {
      return '<input type="number" id="' + id + '" min="0" max="999" step="1" inputmode="numeric" value="' +
        (v || v === 0 ? v : '') + '">' + (unit ? '<span class="mtl-u">' + unit + '</span>' : '');
    };
    var seg = function (attr, val, opts, off) {
      return '<span class="seg mt-seg" role="group">' + opts.map(function (o) {
        return '<button data-' + attr + '="' + o[0] + '" aria-pressed="' + String(o[0] === val) + '"' +
          (off ? ' disabled' : '') + '>' + o[1] + '</button>';
      }).join('') + '</span>';
    };
    var acts = [
      [1.2, 'Mostly sitting'],
      [1.375, 'On my feet some, or 1&ndash;3 workouts a week'],
      [1.55, 'Active job, or 3&ndash;5 workouts'],
      [1.725, 'Hard training 6&ndash;7 days'],
      [1.9, 'Physical job plus hard training']
    ];
    /* Open on the answer, not on the form — but a profile that cannot compute
       yet has no answer to show, so the first visit opens the editor. */
    var shut = plan ? ' hide' : '';
    return '<div class="scrim no-print" data-close="1">' +
      '<div class="sheet mt-sheet" role="dialog" aria-modal="true" aria-label="Your plan">' +
        '<div class="sheet-top">' +
          '<div class="sheet-eyebrow">Your plan</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
        '</div>' +

        /* The answer first. What you open this sheet for on an ordinary day is
           the number, not the form that made it. */
        '<div class="mt-answer">' +
          '<div class="mt-big"><span id="mtBigKcal">' + kcalOf(t) + '</span>' +
            '<small>kcal a day</small></div>' +
          '<div class="mt-tiles">' +
            '<span class="mt-tile"><b id="mtTileP">' + t.p + '</b><i>Protein</i></span>' +
            '<span class="mt-tile"><b id="mtTileF">' + t.f + '</b><i>Fat</i></span>' +
            '<span class="mt-tile"><b id="mtTileC">' + t.c + '</b><i>Carbs</i></span>' +
          '</div>' +
        '</div>' +
        /* The goal belongs under the number it produced, not over it as a
           display line. A sentence set in the book's largest serif, where
           every other sheet carries a title, read as a title that had been
           filled in wrong — and it said again what the day already says. */
        mMeasuredRowHTML(pr) +
        '<button class="mt-who" data-mtedit="1" aria-expanded="' + (plan ? 'false' : 'true') + '">' +
          '<span class="mt-whotext">' +
            '<span class="mt-goal" id="mtGoalLine">' + esc(mGoalLine(pr)) + '</span>' +
            '<span id="mtWho">' + mtWhoLine(pr) + '</span>' +
          '</span>' +
          '<span class="mt-editw">Edit</span>' +
        '</button>' +
        '<div id="mtEditor" class="mt-editor' + shut + '">' +
          '<div class="mt-div">About you</div>' +
          '<div class="mtl-seg">' + seg('mtsex', pr.sex, [['m', 'Male'], ['f', 'Female']]) + '</div>' +
          row('Age', box('mtAge', pr.age, '')) +
          row('Height', box('mtFt', pr.ft, 'ft') + box('mtIn', pr.inch, 'in')) +
          row('Weight', box('mtLb', pr.lb, 'lb')) +
          row('Most days', '<select id="mtAct">' + acts.map(function (a) {
            return '<option value="' + a[0] + '"' + (Number(pr.act) === a[0] ? ' selected' : '') + '>' + a[1] + '</option>';
          }).join('') + '</select>') +
          '<div class="mt-div">What you are after</div>' +
          /* A date and a weight beat a preset: you either arrive or you do
             not, and the deficit falls out of the arithmetic. The four kinds
             stay for anyone who would rather not name a day. */
          row('Get to', box('mtGoalLb', pr.goalLb, 'lb')) +
          row('By', '<input type="date" id="mtGoalBy" value="' + esc(pr.goalBy || '') + '">') +
          row('Workouts a week', box('mtWorkouts', pr.workouts, '')) +
          /* Which days those workouts fall on. Spread from the number above
             until you say otherwise, and then held as a list of its own so
             changing the number does not rearrange days set by hand. The
             carbohydrate follows: more on a training day, less on a rest one,
             and the week still averages to the plan. */
          row('Training days', mTrainRowHTML()) +
          row('Steps a day', '<input type="number" id="mtSteps" min="0" max="99999" step="500" ' +
            'inputmode="numeric" value="' + (pr.steps || '') + '">') +
          /* With a weight and a date, those two are the plan and these four
             are along for the ride — pressing them used to do nothing at
             all, silently, which is the worst thing a control can do. They
             go quiet and say who is in charge instead. */
          /* Dimming them was not enough: they still took the press, still lit
             up, and still changed nothing — a control that answers and then
             does nothing is worse than one that is plainly out of use. They
             are properly inert now, and the way to make them live again is a
             button rather than a fact you have to work out. */
          '<div class="mtl-seg' + (mGoalPace(pr) ? ' spent' : '') + '" id="mtGoalSeg">' +
            seg('mtgoal', pr.goal,
              [['cut2', MGOAL_WORDS.cut2], ['cut1', MGOAL_WORDS.cut1], ['keep', MGOAL_WORDS.keep], ['gain', MGOAL_WORDS.gain]],
              !!mGoalPace(pr)) +
            '<button class="ghost mt-byfeel" data-mtfree="1">The date is setting the pace &mdash; ' +
              'choose by feel instead</button>' +
          '</div>' +
          '<div class="mt-cap" id="mtGoalNote">' + mGoalNote(pr) + '</div>' +
          '<div id="mtCoach">' + mCoachHTML(pr) + '</div>' +
          '<div class="mt-div">The day&rsquo;s grams</div>' +
          /* The boxes are the plan's one rendering: they follow the profile,
             take a hand edit, and Save keeps whatever they say. */
          '<div class="mt-cap" id="mtPlan">' + mtPlanLine(plan) + '</div>' +
          row('Protein', box('mtP', t.p, 'g')) +
          row('Fat', box('mtF', t.f, 'g')) +
          row('Carbs', box('mtC', t.c, 'g')) +
          '<div class="mtl-row mtl-sum"><span class="mtl-lab">A day</span>' +
            '<span class="mtl-val" id="mtKcal">= ' + kcalOf(t) + ' kcal</span></div>' +
        '</div>' +
        '<div class="mt-div">The day&rsquo;s meals</div>' +
        '<div class="mt-cap">The kind steers the picker; the share is each meal&rsquo;s slice of the day.</div>' +
        '<div id="mtMeals">' + mReadSlots().list.map(mtMealRow).join('') + '</div>' +
        '<div class="mtm-total" id="mtmTotal"></div>' +
        '<div class="sync-row"><button class="ghost" data-mtmeal="add">+ Add a meal</button></div>' +
        '<div class="sync-row">' +
          '<button class="btn-primary" data-mtarg="save">Save</button>' +
          '<button class="ghost" data-mtarg="cancel">Cancel</button>' +
        '</div>' +
        /* The one place the tab explains itself, folded away. It used to be a
           paragraph on the daily screen behind a ?, which is a paragraph in
           front of somebody who has read it forty times. */
        '<details class="sync-fold mt-help" id="mtHelp"><summary>How My Day works</summary>' +
          '<dl class="mt-steps">' +
            '<dt>Weigh in</dt><dd>The seven-day average is the number that moves, not any one morning.</dd>' +
            '<dt>Fill my day</dt><dd>Drafts every empty meal at once, favourites first when they fit.</dd>' +
            '<dt>&#8635;</dt><dd>Another suggestion for that meal, down the best-fit list.</dd>' +
            '<dt>Rebalance</dt><dd>Re-sizes the plates you have not eaten or locked, back onto target.</dd>' +
            '<dt>&#128274;</dt><dd>Holds a portion where you set it. Rebalance leaves it alone.</dd>' +
            '<dt>&#128204;</dt><dd>Puts the dish on every new day, at that portion.</dd>' +
            '<dt>Training days</dt><dd>Earn extra carbs; rest days give them back. The week averages to the plan.</dd>' +
            '<dt>Hatched bar</dt><dd>A meal with nothing on it yet, counted at its share.</dd>' +
          '</dl>' +
        '</details>' +
      '</div></div>';
  }

  /* The checklist a custom meal draws from: every live section, grouped by
     volume — the same list the browse filter shows, from the same data. */
  /* The short name a section goes by. The printed names run to seven words
     — "Speedy Weekday Breakfasts & Morning Treats" — which is a title, not a
     label, and thirteen of them stacked is a wall. */
  function mSecLabel(sec) { return SEC_SHORT[sec.key] || sec.name; }

  /* What a custom meal draws from, said in a line: three names and a count.
     This is what the row shows once the choosing is done. */
  function mtSecSummary(checked) {
    if (!checked.length) return 'No sections chosen';
    var names = [];
    mAllSections().forEach(function (sec) {
      if (checked.indexOf(sec.key) >= 0) names.push(mSecLabel(sec));
    });
    var head = names.slice(0, 3).join(' \u00b7 ');
    return names.length > 3 ? head + ' + ' + (names.length - 3) + ' more' : head;
  }

  /* The checklist, and the one-line summary it folds into. Both are always in
     the DOM — Save reads the boxes whether or not they are on screen — and
     only one of them is ever visible. A list of thirteen ticks has done its
     job the moment the ticking is over; after that it is a wall between you
     and the next meal. */
  function mtSecsHTML(checked, open) {
    var out = '<div class="mtm-secs' + (open ? '' : ' hide') + '">', bk = 0;
    mAllSections().forEach(function (sec) {
      if (sec.book !== bk) {
        out += '<span class="mtm-secs-b">' +
          esc(sec.book === 3 ? 'Ours' : BOOKS[sec.book].short) + '</span>';
        bk = sec.book;
      }
      out += '<label class="mtm-sec"><input type="checkbox" value="' + esc(sec.key) + '"' +
        (checked.indexOf(sec.key) >= 0 ? ' checked' : '') + '> ' + esc(mSecLabel(sec)) + '</label>';
    });
    out += '<button class="ghost mtm-secdone" data-mtsec="done">Done</button></div>';
    return out +
      '<button class="mtm-secsum' + (open ? ' hide' : '') + '" data-mtsec="show">' +
        '<span class="mtm-secsum-t">' + esc(mtSecSummary(checked)) + '</span>' +
        '<span class="mtm-secsum-e">Change</span>' +
      '</button>';
  }

  function mtMealRow(s) {
    var kinds = [['b', 'Breakfasts'], ['l', 'Lunches'], ['d', 'Dinners'],
      ['s', 'Snacks & drinks'], ['x', 'Choose sections…']];
    /* The five controls live in their own nowrap row, so a meal is always
       exactly one line — shrinking to fit rather than shedding its × onto
       the line below — and the sections checklist sits under it, outside
       the flexbox entirely. */
    return '<div class="mtm-row" data-mtmk="' + esc(s.k) + '">' +
      '<div class="mtm-main">' +
        '<button class="ghost mtm-move" data-mtmeal="up" aria-label="Move up">&uarr;</button>' +
        '<input class="txt mtm-name" value="' + esc(s.n) + '" placeholder="Name the meal" aria-label="Meal name">' +
        '<select class="mtm-type" data-prev="' + esc(s.t) + '" aria-label="What kind of meal">' +
          kinds.map(function (o) {
            return '<option value="' + o[0] + '"' + (o[0] === s.t ? ' selected' : '') + '>' + o[1] + '</option>';
          }).join('') + '</select>' +
        /* The meal's share of the day. Weights, not strict percentages — 35
           against 10 means dinner reaches for three and a half snacks' worth. */
        '<label class="mtm-share-l"><input class="mtm-share" type="number" min="1" max="99" ' +
          'inputmode="numeric" value="' + mSlotW(s) + '" aria-label="Share of the day">%</label>' +
        '<button class="day-x mtm-del" data-mtmeal="del" aria-label="Remove this meal">&times;</button>' +
      '</div>' +
      (s.t === 'x' ? mtSecsHTML(s.secs || [], !(s.secs && s.secs.length)) : '') +
    '</div>';
  }

  // keeps two meals added in the same millisecond from sharing a key
  var mtMealSeq = 0;

  /* What the profile boxes currently say, read straight off the sheet — the
     inputs are the draft, so a re-render cannot eat half-typed numbers. */
  function mtProfileFromDom() {
    var n = function (id) { return Number(($(id) || {}).value) || 0; };
    var sexBtn = document.querySelector('[data-mtsex][aria-pressed="true"]');
    var goalBtn = document.querySelector('[data-mtgoal][aria-pressed="true"]');
    return {
      sex: sexBtn ? sexBtn.dataset.mtsex : 'm',
      age: n('mtAge'), ft: n('mtFt'), inch: n('mtIn'), lb: n('mtLb'),
      act: Number(($('mtAct') || {}).value) || 1.55,
      goal: goalBtn ? goalBtn.dataset.mtgoal : 'cut1',
      goalLb: n('mtGoalLb'), goalBy: ($('mtGoalBy') || {}).value || '',
      workouts: n('mtWorkouts'), steps: n('mtSteps')
    };
  }

  /* One model, one Save. The first version had a "Use this plan" button above
     a "Save" button below, and the natural last press — Save, at the foot of
     the sheet — quietly committed the OLD gram boxes over the plan just
     applied. Two commit buttons on one sheet is a trap; now the plan writes
     straight into the boxes as the profile changes, and Save keeps whatever
     the boxes say, hand-typed or worked out. */
  /* The one line your profile collapses to once it computes. */
  function mtWhoLine(pr) {
    if (!mPlanCalc(pr)) return 'Tell me about you';
    // the goal line above carries the pace, so this is just who it is for
    var bits = mGoalPace(pr) ? [] : [MGOAL_WORDS[pr.goal] || MGOAL_WORDS.cut1];
    return bits.concat([pr.age, pr.ft + '\u2032' + pr.inch + '\u2033',
      pr.lb + ' lb']).join(' \u00b7 ');
  }

  function mPaceWords(pace) {
    var v = Math.round(Math.abs(pace.perWeek) * 10) / 10;
    return (pace.perWeek > 0.05 ? '\u2212' : pace.perWeek < -0.05 ? '+' : '') +
      (v ? v + ' lb a week' : 'holding');
  }

  /* The sentence at the top of the sheet: what this day is in service of.
     A goal you can miss is worth more than a preset you cannot. */
  /* The destination, in the size of a caption. */
  function mGoalLine(pr) {
    var pace = mGoalPace(pr);
    if (!pace) return '';
    var d = keyDate(pr.goalBy);
    return pr.goalLb + ' lb by ' + M_MONS[d.getMonth()] + ' ' + d.getDate() +
      ' \u00b7 ' + mPaceWords(pace);
  }

  /* The line under it: the pace that implies, the commitments beside it, and
     a word when the arithmetic had to be talked down. */
  /* The panel that answers "what would happen if". Three things, in the
     order somebody asks them: what your day costs and which parts you can
     move; where the plan you have chosen lands you and when; and what one
     more lever is worth — said both ways, because more walking either buys
     food at the same pace or the same food sooner, and people mean different
     ones. */
  function mWeeksWords(w) {
    var v = Math.round(w * 10) / 10;
    return v + (v === 1 ? ' week' : ' weeks');
  }

  function mCoachHTML(pr) {
    var b = mBurn(pr);
    if (!b) return '';
    var out = [];
    var kc = function (n) { return Math.round(n); };
    out.push('<div class="mco-row"><span class="mco-k">Your day</span><span class="mco-v">' +
      (b.told
        ? kc(b.base) + ' living &middot; ' + kc(b.steps) + ' walking &middot; ' +
          kc(b.train) + ' training = <b>' + kc(b.tdee) + '</b> kcal'
        : '<b>' + kc(b.tdee) + '</b> kcal &mdash; fill in steps and sessions to see the parts') +
      '</span></div>');

    var pj = mProject(pr);
    if (pj) {
      var slip = mGoalPace(pr) && mGoalPace(pr).capped;
      out.push('<div class="mco-row"><span class="mco-k">Lands you</span><span class="mco-v">' +
        'at <b>' + pr.goalLb + ' lb</b> around <b>' + M_MONS[pj.when.getMonth()] + ' ' +
        pj.when.getDate() + '</b> &middot; ' + mWeeksWords(Math.round(pj.weeks)) + ' at ' +
        (Math.round(Math.abs(pj.perWeek) * 100) / 100) + ' lb a week' +
        (slip ? ' &mdash; later than the date you asked for' : '') + '</span></div>');
    }

    if (b.told && pj) {
      var kg = pr.lb * 0.45359237;
      var stepK = 2000 * 0.53 * kg * 0.00075;
      var sessK = (5 * 3.5 * kg / 200) * 45 / 7;
      var says = function (label, lev) {
        return '<div class="mco-row"><span class="mco-k">' + label + '</span><span class="mco-v">' +
          '<b>+' + lev.kcal + ' kcal</b> to eat at the same pace' +
          (lev.weeks && lev.weeks > 0.15
            ? ', or the same food <b>' + mWeeksWords(lev.weeks) + '</b> sooner'
            : '') + '</span></div>';
      };
      out.push(says('2,000 more steps', mLever(pr, stepK)));
      out.push(says('One more session', mLever(pr, sessK)));
    }
    /* The panel describes a plan the boxes below may not be showing: the
       boxes hold what was last saved, and follow the profile only while it
       is being typed. Rather than overwrite a day somebody meant, offer it. */
    var plan = mPlanCalc(pr);
    /* Against what the boxes say, not what storage holds — the offer is
       about the day in front of you, and it should go quiet the moment you
       take it rather than waiting for a save. */
    var cur = $('mtP')
      ? { p: Math.round(Number($('mtP').value) || 0), f: Math.round(Number($('mtF').value) || 0),
        c: Math.round(Number($('mtC').value) || 0) }
      : mReadTargets();
    if (plan && (plan.p !== cur.p || plan.f !== cur.f || plan.c !== cur.c)) {
      out.push('<div class="mco-row"><span class="mco-k">This plan</span><span class="mco-v">' +
        '<b>' + kcalOf(plan) + '</b> kcal &middot; ' + plan.p + 'P / ' + plan.f + 'F / ' +
        plan.c + 'C ' +
        '<button class="ghost mco-use" data-mtuse="1">Use it</button></span></div>');
    }
    /* One line about the thing people give up first and miss most. */
    if (pj && Math.abs(pj.perWeek) > pr.lb * 0.008) {
      out.push('<div class="mco-row mco-note">At this pace the protein and the sleep are ' +
        'what keep the loss to fat &mdash; the walking costs least to add and is the first ' +
        'thing to raise before cutting the food further.</div>');
    }
    return '<div class="mco">' + out.join('') + '</div>';
  }

  function mGoalNote(pr) {
    var pace = mGoalPace(pr);
    if (!pace) return 'Name a weight and a date and they set the pace instead.';
    var bits = [Math.abs(Math.round(pace.lbs * 10) / 10) + ' lb over ' +
      Math.round(pace.days / 7) + ' weeks \u2014 ' + mPaceWords(pace)];
    if (pr.workouts) bits.push(pr.workouts + '\u00d7 a week');
    if (pr.steps) bits.push(Number(pr.steps).toLocaleString() + ' steps a day');
    var warn = '';
    if (pace.capped && pace.realWeeks) {
      /* Say when you would actually arrive rather than only that the date
         slips. A date you cannot meet is worth knowing; the one you can
         meet is worth more. */
      var arrive = new Date();
      arrive.setDate(arrive.getDate() + Math.round(pace.realWeeks * 7));
      warn = '<span class="mt-warn">That needs ' +
        (Math.round(Math.abs(pace.wanted) * 10) / 10) + ' lb a week, more than a body ' +
        'gives up without giving up muscle with it. Held to ' +
        (Math.round(Math.abs(pace.perWeek) * 10) / 10) + ' &mdash; arriving about ' +
        M_MONS[arrive.getMonth()] + ' ' + arrive.getDate() + '.</span>';
    }
    return esc(bits.join(' \u00b7 ')) + warn;
  }

  /* The headline follows the boxes, whichever way they were filled in. */
  function mtRefreshAnswer() {
    var gv = function (id) { return Math.max(0, Math.round(Number(($(id) || {}).value) || 0)); };
    var t = { p: gv('mtP'), f: gv('mtF'), c: gv('mtC') };
    var set = function (id, v) { var el = $(id); if (el) el.textContent = v; };
    set('mtBigKcal', kcalOf(t));
    set('mtTileP', t.p); set('mtTileF', t.f); set('mtTileC', t.c);
    set('mtKcal', '= ' + kcalOf(t) + ' kcal');
    set('mtWho', mtWhoLine(mtProfileFromDom()));
  }

  /* The summary says what the ticks say, the moment they say it. */
  function mtSecSumSync(row) {
    if (!row) return;
    var el = row.querySelector('.mtm-secsum-t');
    if (!el) return;
    var on = [];
    Array.prototype.forEach.call(row.querySelectorAll('.mtm-secs input:checked'),
      function (cb) { on.push(cb.value); });
    el.textContent = mtSecSummary(on);
  }

  /* The running total under the meal shares. It never rewrites the boxes —
     fields that rescale each other mid-edit fight the fingers typing them —
     it only says what they add to now, and that Save squares the books. */
  function mtmShowTotal() {
    var el = $('mtmTotal');
    if (!el) return;
    var sum = 0;
    Array.prototype.forEach.call(document.querySelectorAll('#mtMeals .mtm-share'), function (i) {
      sum += Math.max(0, Math.round(Number(i.value) || 0));
    });
    /* Which way you are off, not merely that you are. Save squares the books
       either way, so the number is for your judgement, not a gate. */
    el.className = 'mtm-total ' + (sum === 100 ? 'ok' : 'off');
    el.innerHTML = sum === 100
      ? '<b>100%</b> — spot on.'
      : '<b>' + sum + '%</b> — ' + Math.abs(100 - sum) + '% ' + (sum > 100 ? 'over' : 'short') +
        '. Save scales ' + (sum > 100 ? 'down' : 'up') + ' to 100.';
  }

  function mtRefreshPlan() {
    var prNow = mtProfileFromDom();
    var plan = mPlanCalc(prNow);
    var el = $('mtPlan');
    if (el) el.innerHTML = mtPlanLine(plan, prNow);
    var gl = $('mtGoalLine');
    if (gl) { gl.textContent = mGoalLine(prNow); gl.classList.toggle('hide', !mGoalLine(prNow)); }
    var gn = $('mtGoalNote');
    if (gn) gn.innerHTML = mGoalNote(prNow);
    var co = $('mtCoach');
    if (co) co.innerHTML = mCoachHTML(prNow);
    var gs = $('mtGoalSeg');
    if (gs) {
      var dated = !!mGoalPace(prNow);
      gs.classList.toggle('spent', dated);
      Array.prototype.forEach.call(gs.querySelectorAll('[data-mtgoal]'),
        function (b2) { b2.disabled = dated; });
    }
    if (!plan) { mtRefreshAnswer(); return; }
    if ($('mtP')) { $('mtP').value = plan.p; $('mtF').value = plan.f; $('mtC').value = plan.c; }
    mtRefreshAnswer();
  }

  function mOnDay(day, id) {
    var found = false;
    Object.keys(day).forEach(function (sk) {
      (day[sk] || []).forEach(function (it) { if (it.id === id) found = true; });
    });
    return found;
  }

  /* What the days either side of this one already hold.
   *
     Fill knew what was on the day it was drafting and nothing else, so
     "press it again for a different day" was true within a day and false
     across a week: seven drafted days ran to thirty plates and nineteen
     dishes, one of them served four times. A cook notices that long before
     they notice a macro.
   *
     Three days in each direction, not seven — the pool of dishes that are
     both lean enough and clean enough for a hard cut is small, and a week-long
     memory would empty it and leave meals blank. Three is far enough apart
     that a repeat reads as a rotation rather than a rut. Both directions,
     because days can be drafted in any order and Thursday planned before
     Wednesday should still not echo it. */
  var MNEAR_DAYS = 3;

  function mNearIds(k) {
    var out = {}, base = keyDate(k);
    for (var d = -MNEAR_DAYS; d <= MNEAR_DAYS; d++) {
      if (!d) continue;
      var t = new Date(base.getFullYear(), base.getMonth(), base.getDate() + d);
      var day = MDAYS[dayKey(t)];
      if (!day) continue;
      Object.keys(day).forEach(function (sk) {
        (day[sk] || []).forEach(function (it) { out[it.id] = 1; });
      });
    }
    return out;
  }

  /* The batch that makes exactly your portion: your servings over the
     recipe's, snapped to the eighths the quantities print in. ×2½ of a
     one-jar shake is 2½ jars; two plates of a four-plate roast is half
     the roast. */
  function mCookScale(x, servN) {
    return Math.max(0.125, Math.round(x / (servN || 1) * 8) / 8);
  }

  /* Draft the empty meals in one press. Slots fill in day order, each seeing
     what the ones before it took, so the four picks land as a combination
     rather than four separate best breakfasts. Only EMPTY slots are touched —
     what you placed yourself is your business — and each pick comes from the
     top three fits at random, so pressing it again offers a different day
     rather than insisting on the same one. Favorites carry their ranking
     bonus here too, which is what "favorites first when they fit" means. */
  /* The draft itself, with no screen attached.
   *
     Split out so the bench can run a few thousand days without a render
     between each one — see window.__macroLab. Splitting rather than copying:
     a second copy of this would drift from the first, and the whole point of
     measuring is that the thing measured is the thing that ships. */
  function mDraftDay() {
    var targets = mDayTargets(mViewKey());
    var near = mNearIds(mViewKey());
    mEditDay(mViewKey(), function (day) {
      /* Whether this day has room for a draft at all — asked once, and asked
         of what was already on it.
       *
         This check used to sit inside the loop and read the day's remaining
         live, which meant the dishes Fill had just placed were the reason the
         next meal got refused. Meals are walked in order, so it was always the
         ones at the bottom: an evening snack last in the list came up empty on
         nearly half of all runs, and pressing Fill again sometimes filled it,
         which is the tell — nothing about that meal had changed.

         Those dishes were never final. Every one of them is resized by
         mBalanceDay a few lines down; the draft overshoots by design, and its
         own comment says so. Refusing a meal over a portion that has not been
         settled yet is refusing it over a number that does not exist.

         What does justify refusing is a day already accounted for — press Fill
         at nine at night with everything logged and it should add nothing. So
         that is the question, and it can only be asked from up here, before
         the draft has had a chance to answer it for us. */
      var had = mTotals(day).all;
      var room = 4 * Math.max(0, targets.p - had.p) +
        4 * Math.max(0, targets.c - had.c) +
        9 * Math.max(0, targets.f - had.f);
      if (room < 100) return;

      mReadSlots().list.forEach(function (s) {
          if ((day[s.k] || []).length) return;
          // you said you are not eating this one
          if (mSkipped(mViewKey(), s.k)) return;
          var secs = mSlotSecs(s);
          var inSec = RECIPES.filter(function (r) {
            return secs.indexOf(r.book + '-' + r.secNum) >= 0 && !mOnDay(day, r.id);
          });
          /* What the neighbouring days have not already used — but only while
             that leaves something to choose from. A meal left empty to avoid a
             repeat is a worse answer than the repeat. */
          var fresh = inSec.filter(function (r) { return !near[r.id]; });
          var pool = fresh.length ? fresh : inSec;
          var ranked = mRank(pool, day, targets, s).filter(function (e) { return e.score !== null; });
          if (!ranked.length) return;
          var top = ranked.slice(0, 3);
          var pick = top[Math.floor(Math.random() * top.length)];
          (day[s.k] = day[s.k] || []).push({ id: pick.r.id, x: pick.x, eaten: 0 });
      });

      /* Settle the portions before asking whether anything is missing. Each
         dish was sized against its own share while the slots were still being
         filled, so the raw draft usually sits ON or over the day — the gap
         only opens once the plates are solved against the finished day. A
         topper chosen before that would be answering a question nobody asked;
         one chosen after gets sized in the second pass along with everything
         else it now sits beside. */
      mBalanceDay(day, targets);

      var moved = mSideUp(day, targets, near);
      if (mTopUp(day, targets, near) || moved) mBalanceDay(day, targets);
    });
  }

  function mFillDay() { mDraftDay(); renderMacros(); }

  /* The topper: honey on the oatmeal, butter for the fat, cottage cheese for
     the protein the dishes did not carry.
   *
     One dish per meal leaves a day short. Four plates chosen to fit their own
     share land 300-odd calories under the target at every goal, and there is
     no fifth meal to put the rest in — the book has the food, the day has run
     out of slots to serve it on. Which is how anybody actually eats: the meal
     is the dish plus the thing you added to it.
   *
     So after the dishes are placed, the gap is closed with a single food
     rather than a second recipe. It is judged day-level — under and over both
     measured against what the day still has room for, the same stance
     Rebalance takes — because a topper exists to finish the day, not to fill
     a share of it. The same salt-and-fibre nudge applies, which is what keeps
     the fruit and the cottage cheese ahead of the soy sauce.
   *
     Two at most, and only onto a meal still in the future: a day topped up
     five times is not a meal plan, and adding food to a breakfast already
     eaten would be the app claiming he ate it. */
  var MTOP_GAP = 120;         // a gap smaller than this is not worth a topper
  var MTOP_MIN = 40;          // a serving under this is a seasoning, not a topper
  var MTOP_MAX = 2;
  /* A topper has to be food, and the fit score alone cannot tell the
     difference. A cup of soy sauce is a hundred and thirty-five calories at
     fifteen grams of protein per hundred — denser than chicken breast, on
     paper — and fourteen thousand milligrams of sodium, which is six days'
     worth. It cleared the calorie floor, scored beautifully against a protein
     gap, and the salt-and-fibre nudge that was supposed to catch it is
     clamped at six points, because it was built to separate two dinners and
     not to veto a condiment. So the ceiling is stated outright rather than
     left to a ranking: a spoonful added to finish a day cannot carry more
     salt than the meals it is finishing, and never more than the day has
     left. */
  var MTOP_NA = 400;

  /* The side of vegetables.
   *
     Seventeen hard-cut days in twenty-eight were finishing under the fibre
     line, and no weight in the portion solver could fix it: a solver resizes
     what is on the plate, and if none of the four dishes brought fibre there
     is nothing to make bigger. The day needed another thing on it.
   *
     Which is how anyone actually eats a cut — the meat, and a pile of
     vegetables beside it. So when the day comes in under the line, a side is
     added: steamed broccoli, peppers, carrots, a tomato. They cost almost
     nothing in calories, which is the whole reason this works where a fifth
     dish would not.
   *
     Ranked on fibre per calorie, with the salt it brings charged against it.
     That prefers peppers to green beans without being told to: a pound of
     peppers carries nine grams of fibre and eighteen milligrams of sodium, a
     can of beans six grams and five hundred. The density floor keeps it to
     vegetables and fruit — a potato is mostly not fibre, and a day short of
     roughage does not want more starch. */
  var MFIB_PER_K = 14;          // grams per thousand calories, the strip's own line
  var MSIDE_GAP = 4;            // a shortfall smaller than this is not worth a side
  var MSIDE_DENS = 6;           // g of fibre per 100 kcal to count as a vegetable
  var MSIDE_MAX = 2;
  /* What a milligram of sodium costs in grams of fibre, per hundred calories.
     Ranked on fibre alone the pass took canned green beans six times a month
     — thirteen grams of fibre per hundred calories, the best in the building,
     and five hundred milligrams of salt a tin with it, which moved the median
     day from twelve hundred milligrams to eighteen. At a hundred to one a
     pound of peppers wins on its own merits and the tin has to earn its
     place. */
  var MSIDE_NA_W = 100;

  function mSideSlot(day) {
    // the meal with the least roughage on it, and still open to changing
    var list = mReadSlots().list, best = null;
    list.forEach(function (s) {
      var items = day[s.k] || [], open = false, fib = 0;
      items.forEach(function (it) {
        var r = BY_ID[it.id];
        if (!it.eaten) open = true;
        if (r && r.macro) fib += (r.macro.fib || 0) * it.x;
      });
      if (!items.length || !open) return;
      if (!best || fib < best.fib) best = { s: s, fib: fib };
    });
    return best ? best.s : null;
  }

  function mSideUp(day, targets, near) {
    var added = 0;
    var floor = (4 * targets.p + 4 * targets.c + 9 * targets.f) * MFIB_PER_K / 1000;
    for (var n = 0; n < MSIDE_MAX; n++) {
      var tot = mTotals(day);
      var gap = floor - (tot.all.fib || 0);
      if (gap < MSIDE_GAP) return added;
      var slot = mSideSlot(day);
      if (!slot) return added;
      var naRoom = Math.max(0, MNA_CAP - (tot.all.na || 0));
      var best = null;
      MFOODS.forEach(function (r) {
        var mac = r.macro || {};
        if (!r.side) return;
        if (!(mac.fib > 0) || !(mac.kcal > 0)) return;
        if (mac.fib * 100 / mac.kcal < MSIDE_DENS) return;
        if (mOnDay(day, r.id) || (near && near[r.id])) return;
        /* The smallest helping on the ladder that closes the gap — and if
           none of them does, the largest, because most of a shortfall closed
           beats none of it. */
        var x = MX[MX.length - 1], i;
        for (i = 0; i < MX.length; i++) {
          if (mac.fib * MX[i] >= gap) { x = MX[i]; break; }
        }
        if ((mac.na || 0) * x > naRoom) return;
        /* Ranked on fibre per calorie outright, not on the picker's
           salt-and-fibre reading. That reading is clamped at four points of
           fibre, which every vegetable here reaches, so it called a pound of
           peppers and an apple equally good and then took whichever came
           first alphabetically. Seventeen apples in twenty-eight days, and
           the fibre got WORSE — an apple spends ninety-five calories to buy
           four grams, and the solver pays for those calories by shrinking the
           dishes that were carrying the fibre already.
         *
           And fibre per calorie alone is not enough of a test either: ranked
           on it, the pass reached for cinnamon and cocoa, which are fibrous
           the way a spice is fibrous. A side has to be something you would
           put on a plate, so the food itself says whether it is one. */
        var sc = mac.fib * 100 / mac.kcal - (mac.na * 100 / mac.kcal) / MSIDE_NA_W;
        if (!best || sc > best.score) best = { r: r, x: x, score: sc };
      });
      if (!best) return added;
      (day[slot.k] = day[slot.k] || []).push({ id: best.r.id, x: best.x, eaten: 0 });
      added++;
    }
    return added;
  }

  function mTopSlot(day, targets) {
    var list = mReadSlots().list, sumW = 0, best = null;
    var dayKcal = 4 * targets.p + 4 * targets.c + 9 * targets.f;
    list.forEach(function (s) { sumW += mSlotW(s); });
    if (!sumW) return null;
    list.forEach(function (s) {
      var items = day[s.k] || [], open = false, have = 0;
      items.forEach(function (it) {
        var r = BY_ID[it.id];
        if (!it.eaten) open = true;
        if (r && r.macro) have += (r.macro.kcal || 0) * it.x;
      });
      // a meal with nothing on it is Fill's job; one already eaten is closed
      if (!items.length || !open) return;
      var gap = dayKcal * (mSlotW(s) / sumW) - have;
      if (!best || gap > best.gap) best = { s: s, gap: gap };
    });
    return best ? best.s : null;
  }

  function mTopUp(day, targets, near) {
    var added = 0;
    for (var n = 0; n < MTOP_MAX; n++) {
      var tot = mTotals(day), R = {}, D = {};
      ['p', 'f', 'c'].forEach(function (m) {
        R[m] = Math.max(0, targets[m] - tot.all[m]);
        D[m] = Math.max(1, targets[m]);
      });
      if (4 * R.p + 4 * R.c + 9 * R.f < MTOP_GAP) return added;
      var slot = mTopSlot(day, targets);
      if (!slot) return added;
      var best = null;
      var naRoom = Math.min(MTOP_NA, Math.max(0, 2300 - (tot.all.na || 0)));
      MFOODS.forEach(function (r) {
        var mac = r.macro || {};
        if ((mac.kcal || 0) < MTOP_MIN) return;
        if (((mac.p || 0) + (mac.c || 0) + (mac.f || 0)) <= 0) return;
        if (mOnDay(day, r.id) || (near && near[r.id])) return;
        var fit = macroFit(r, R, R, D);
        // priced at the portion actually being added, not per hundred grams
        if ((mac.na || 0) * fit.x > naRoom) return;
        var sc = fit.score + mSaltFibre(r, fit.x);
        if (!best || sc > best.score) best = { r: r, x: fit.x, score: sc };
      });
      if (!best) return added;
      (day[slot.k] = day[slot.k] || []).push({ id: best.r.id, x: best.x, eaten: 0 });
      added++;
    }
    return added;
  }

  /* Re-size the plates still in play so the day lands back on target. Keeps
     every dish exactly where it is — swapping food is Fill my day's job, and
     a button that quietly replaced your dinner would be the app overruling
     you — and never touches what is eaten (the past has no portion control)
     or what is locked (the dinner you promised the family).
   *
   * The judging is the picker's own weights applied to the WHOLE day against
     the targets — no fair shares here, because the plates already exist and
     the only question left is how big each should be. Coordinate descent in
     quarter steps: each free plate in turn tries every size and keeps the one
     that hurts the day least, until a pass moves nothing. Ties keep the
     smaller portion, as everywhere else on a cut. */
  var MX_ALL = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4];

  /* The day's sodium ceiling, and what going past it costs the solver. The
     cap is the ordinary guideline the bars already show. The weight is set
     against the macro weights either side of it: a day a full ceiling over
     carries the same penalty as missing every gram of protein, which is
     enough to lose an argument about a fourth serving and not enough to
     starve a day of the protein it is for. */
  var MNA_CAP = 2300;
  var MNA_W = 1.0;


  function mBalanceDay(day, targets) {
    var free = [];
    Object.keys(day).forEach(function (sk) {
      (day[sk] || []).forEach(function (it) {
        var r = BY_ID[it.id];
        if (!it.eaten && !it.l && r && r.macro) free.push(it);
      });
    });
    if (!free.length) return;
    var pen = function () {
      var tot = mTotals(day);
      var s = 0;
      ['p', 'f', 'c'].forEach(function (mm) {
        var D = Math.max(1, targets[mm]);
        s += MW[mm][0] * Math.max(0, targets[mm] - tot.all[mm]) / D;
        s += MW[mm][1] * Math.max(0, tot.all[mm] - targets[mm]) / D;
      });
      /* Salt, because the solver was blind to it and a portion is exactly
         where that blindness costs most. Chasing protein, it took a chicken
         salad carrying fourteen hundred milligrams a serving to four
         servings — five and a half grams of sodium out of one bowl, more than
         twice the day's whole ceiling, and every macro bar green. Nothing in
         the arithmetic objected because sodium was not in it.
       *
         Only overshoot is priced. There is no virtue in a day coming in
         under on salt the way there is in hitting protein, so this is a
         ceiling and not a target: free until the day reaches it, then steep
         enough that a fourth serving of the salty thing loses to a third of
         something else. */
      s += MNA_W * Math.max(0, (tot.all.na || 0) - MNA_CAP) / MNA_CAP;
      return s;
    };
    for (var pass = 0; pass < 3; pass++) {
      var moved = false;
      free.forEach(function (it) {
        var was = it.x, best = it.x, bestPen = pen();
        for (var i = 0; i < MX_ALL.length; i++) {
          it.x = MX_ALL[i];
          var pv = pen();
          if (pv < bestPen - 1e-9) { bestPen = pv; best = MX_ALL[i]; }
        }
        it.x = best;
        if (best !== was) moved = true;
      });
      if (!moved) break;
    }
  }

  function mRebalance() {
    var targets = mDayTargets(mViewKey());
    mEditDay(mViewKey(), function (day) { mBalanceDay(day, targets); });
    renderMacros();
  }

  /* The day as plain text, for typing into something else. Phones hand the
     clipboard around better than they hand files around, and Google Fit's
     own entry is manual anyway — so this is the day laid out the way you
     would read it into another app: weight first, then every plate with its
     portion and its numbers, then the totals. */
  function mDayText(k) {
    var day = mDay(k);
    var slots = mReadSlots();
    var d = keyDate(k);
    var out = ['My Day \u2014 ' + M_WDAYS[d.getDay()] + ', ' + M_MONS[d.getMonth()] + ' ' +
      d.getDate() + ' ' + d.getFullYear()];
    if (MWEIGHTS[k]) out.push('Weight: ' + MWEIGHTS[k] + ' lb');
    out.push('');
    var named = [];
    slots.list.forEach(function (sl) { named.push([sl.k, sl.n]); });
    Object.keys(day).forEach(function (sk) {
      if (!named.some(function (n) { return n[0] === sk; })) named.push([sk, slots.names[sk] || 'Meal']);
    });
    named.forEach(function (pair) {
      var items = (day[pair[0]] || []).filter(function (it) { return BY_ID[it.id]; });
      if (!items.length) return;
      out.push(pair[1] + ':');
      var mt = { kcal: 0, p: 0, f: 0, c: 0 };
      items.forEach(function (it) {
        var r = BY_ID[it.id];
        var mac = r.macro || {};
        mt.kcal += (mac.kcal || 0) * it.x; mt.p += (mac.p || 0) * it.x;
        mt.f += (mac.f || 0) * it.x; mt.c += (mac.c || 0) * it.x;
        /* The same portion words the card uses, from the same function \u2014 the
           line here had its own copy of the servN multiplication and so its
           own copy of the overstatement that came with it. */
        out.push('  ' + (it.eaten ? '[x] ' : '[ ] ') + r.name +
          ' (' + mPortionText(r, it.x) + ')' +
          ' \u2014 ' + Math.round((mac.kcal || 0) * it.x) + ' kcal, ' +
          Math.round((mac.p || 0) * it.x) + 'g protein, ' +
          Math.round((mac.f || 0) * it.x) + 'g fat, ' +
          Math.round((mac.c || 0) * it.x) + 'g carbs');
      });
      /* The meal's own line. Anything you are typing this into logs a meal at
         a time — Google Fit included — so the subtotal has to be here rather
         than added up on a thumb. */
      if (items.length > 1) {
        out.push('  = ' + Math.round(mt.kcal) + ' kcal, ' + Math.round(mt.p) +
          'g protein, ' + Math.round(mt.f) + 'g fat, ' + Math.round(mt.c) + 'g carbs');
      }
    });
    var tot = mTotals(day), t = mDayTargets(k);
    out.push('');
    out.push('Total: ' + Math.round(tot.all.kcal) + ' kcal, ' + Math.round(tot.all.p) +
      'g protein, ' + Math.round(tot.all.f) + 'g fat, ' + Math.round(tot.all.c) + 'g carbs');
    out.push('Target: ' + kcalOf(t) + ' kcal, ' + t.p + 'g protein, ' + t.f + 'g fat, ' + t.c + 'g carbs');
    if (tot.est) out.push('(~ figures are estimated from a food table, not a label.)');
    return out.join('\n');
  }

  /* execCommand is the fallback because the async clipboard API is refused
     outside a secure context and on some in-app browsers — and this button
     is most wanted on exactly those. */
  function mCopyDay(btn) {
    var text = mDayText(mViewKey());
    var said = function (ok) {
      btn.textContent = ok ? 'Copied' : 'Press and hold to copy';
      // back to the name it shipped with, not a second one invented here
      setTimeout(function () { btn.textContent = 'Copy as text'; }, 2200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { said(true); }, function () { said(false); });
      return;
    }
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    said(ok);
  }

  /* Another suggestion for one meal, and then the next one after that.
   *
   * Fill my day drafts everything at once and picks at random from the top
   * three; the picker is for when you know what you want. Between them sits
   * the commonest move of all — "not that, what else?" — which until now
   * meant deleting a plate and opening the picker to take the next line down.
   *
   * So this walks the ranked list a step at a time, keeping a cursor per
   * meal per day, and leaves alone the three kinds of plate that are not the
   * machine's to swap: what you have eaten, what you have locked, and what
   * you have pinned, because a pin is a standing instruction and this would
   * only be arguing with it. */
  /* Solve the portions of one meal against that meal's own share.
   *
     Rebalance does this for the whole day, where the question is "which of
     twelve plates gives way". Here the question is the one you actually have
     after putting chicken, rice and broccoli on a plate: how much of each.
     Same weights the picker fits with, same eighth-of-a-portion steps, and
     the same two exemptions — what you have eaten and what you have locked
     are not the machine's to move. */
  function mBalanceMeal(sk) {
    var k = mViewKey();
    var targets = mDayTargets(k);
    var slots = mReadSlots(), srec = null;
    slots.list.forEach(function (sl) { if (sl.k === sk) srec = sl; });
    mEditDay(k, function (day) {
      var free = (day[sk] || []).filter(function (it) {
        var r = BY_ID[it.id];
        return !it.eaten && !it.l && r && r.macro && r.macro.kcal > 0;
      });
      if (!free.length) return;
      /* The meal's FULL share of the day, not what is left of the day after
         it. mShares answers the picker's question — "how much room is there
         for one more thing" — and subtracts what this meal already holds. Ask
         it here and a meal sitting exactly on target is told its target is
         nearly zero, and gets solved down to a quarter of itself. Which is
         what happened: 545 kcal, on target, balanced to 252 and called short.
         The target of a meal is its weight's worth of the day. */
      var sumW = 0;
      slots.list.forEach(function (s2) { sumW += mSlotW(s2); });
      var frac = sumW ? mSlotW(srec || { }) / sumW : 1;
      var T = { p: targets.p * frac, f: targets.f * frac, c: targets.c * frac };
      var pen = function () {
        var got = { p: 0, f: 0, c: 0 };
        (day[sk] || []).forEach(function (it) {
          var r = BY_ID[it.id];
          if (!r || !r.macro) return;
          got.p += (r.macro.p || 0) * it.x;
          got.f += (r.macro.f || 0) * it.x;
          got.c += (r.macro.c || 0) * it.x;
        });
        var sum = 0;
        ['p', 'f', 'c'].forEach(function (m) {
          var D = Math.max(1, T[m]);
          sum += MW[m][0] * Math.max(0, T[m] - got[m]) / D;
          sum += MW[m][1] * Math.max(0, got[m] - T[m]) / D;
        });
        return sum;
      };
      for (var pass = 0; pass < 4; pass++) {
        var moved = false;
        free.forEach(function (it) {
          var was = it.x, best = it.x, bestPen = pen();
          for (var i = 0; i < MX_ALL.length; i++) {
            it.x = MX_ALL[i];
            var pv = pen();
            if (pv < bestPen - 1e-9) { bestPen = pv; best = MX_ALL[i]; }
          }
          it.x = best;
          if (best !== was) moved = true;
        });
        if (!moved) break;
      }
    });
    keepingFocus(renderMacros);
  }

  /* Everything on one meal, kept as one thing.
   *
     Assembled meals are the case recipes were always for — four scanned
     packets that go together every Tuesday are a dish, they just have not
     been named yet. The macros come from the parts as they stand rather than
     from re-reading the ingredient text, because the parts already carry
     measured numbers and re-deriving them would only lose accuracy. */
  function mSaveMeal(sk, name, share) {
    var day = mDay(mViewKey());
    var items = (day[sk] || []).filter(function (it) { return BY_ID[it.id]; });
    if (!items.length || !name) return null;
    var mac = { kcal: 0, p: 0, f: 0, c: 0, na: 0, fib: 0 };
    var ing = [], parts = [], est = false;
    items.forEach(function (it) {
      var r = BY_ID[it.id];
      ['kcal', 'p', 'f', 'c', 'na', 'fib'].forEach(function (m) {
        mac[m] += ((r.macro || {})[m] || 0) * it.x;
      });
      if (r.est) est = true;
      var unit = r.food ? r.unit : 'serving';
      ing.push(fmtNum(it.x) + ' \u00d7 ' + unit + ' ' + r.name);
      /* The parts keep their own id, amount and unit so the kept meal can be
         opened later and read back as what it was \u2014 not just as a total. */
      parts.push({ id: it.id, x: it.x, name: r.name, unit: unit });
    });
    ['kcal', 'p', 'f', 'c', 'na', 'fib'].forEach(function (m) { mac[m] = Math.round(mac[m]); });

    if (share) {
      /* Onto the Ours shelf, where it gets everything a recipe gets — the
         picker's fit ranking, portion scaling, the printed book. And where
         everyone with the pantry code can see it, which is why this is asked
         rather than assumed. */
      var id = window.Store.newRecipeId();
      window.Store.saveRecipe({
        id: id, own: true, book: 3, secNum: 1, secName: 'Ours',
        name: name, servings: '1 Serving', servN: 1, time: '0 mins', diff: 'Easy',
        ing: ing, steps: [], extras: '', macro: mac, est: est, typedMacro: true
      });
      return id;
    }
    /* Or into your own foods, which live in your account and go nowhere near
       the household. One of it is one plate — the whole meal as it stood —
       and it remembers its parts, sodium and fibre, so the kept salad still
       reads as beans, dressing and greens when you open it next Tuesday. */
    var key = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') ||
      ('x' + Date.now().toString(36));
    var mine = mReadMyFoods();
    mine[key] = { name: name, unit: 'plate', kcal: mac.kcal, p: mac.p, f: mac.f, c: mac.c,
      na: mac.na, fib: mac.fib, parts: parts };
    mWriteMyFoods(mine);
    mBuildFoods();
    return 'f:my:' + key;
  }

  /* How many "not that one"s it takes before a meal is allowed to look
     outside its own sections. */
  var MTRY_WIDE = 10;

  /* Everything a meal is allowed to be offered — recipes from its sections,
     plus the plain foods a person eats without cooking them.
   *
     One function because there are two callers and they must not drift: Try
     again, and the bench's rank() that exists to explain what Try again did.
     A diagnostic reporting a pool the app does not have is worse than no
     diagnostic, and the first version of this WAS two copies — a test meant
     to pin the ingredient rule passed with the real gate removed, because it
     was only ever reading the bench's copy of it.

     The food table is mostly ingredients: flour, cornstarch, yeast, raw
     stewing beef. Unfiltered it offered three ounces of raw chuck as a snack,
     which is a worse answer than the recipe it replaced. `eat` says you can
     eat it as it comes; `side` is already on the vegetables. Condiments are
     in neither on purpose — butter and honey go ON food. */
  function mMealPool(slot, wide) {
    var secs = wide ? mAllSecs() : mSlotSecs(slot);
    var pool = RECIPES.filter(function (r) {
      return secs.indexOf(r.book + '-' + r.secNum) >= 0;
    });
    MFOODS.forEach(function (r) { if (r.eat || r.side) pool.push(r); });
    return pool;
  }

  /* Every section there is, from the data rather than from a list here — a
     book gaining a section should not need this remembering. */
  var M_ALL_SECS = null;
  function mAllSecs() {
    if (!M_ALL_SECS) {
      var seen = {};
      RECIPES.forEach(function (r) { seen[r.book + '-' + r.secNum] = 1; });
      M_ALL_SECS = Object.keys(seen);
    }
    return M_ALL_SECS;
  }

  /* Whether this meal has been opened up, for the card to say so. */
  /* The cursor is zero-based — the first press stores 0 — so the tenth press
     stores 9. Both readers compare against the same expression rather than
     each doing its own arithmetic and disagreeing by one. */
  function mWideOpen(sk) {
    return (S.mTry[mViewKey() + ':' + sk] || 0) >= MTRY_WIDE - 1;
  }

  /* How the day landed, and where it sits in the week.
   *
     Everything here is read back through mTotals and mDayTargets — the same
     two the pills at the top of the screen use — so the card and the strip
     can never disagree about what you ate. It computes nothing of its own.

     Seven days back from the one being looked at, not Monday-to-Sunday: on a
     Wednesday a calendar week is three days and answers nothing. */
  function mDaySummary(k) {
    var T = mDayTargets(k);
    var day = mDay(k);
    var tot = mTotals(day).all;
    var kcal = function (o) { return 4 * (o.p || 0) + 4 * (o.c || 0) + 9 * (o.f || 0); };
    var got = Math.round(kcal(tot)), want = Math.round(kcal(T));

    var rows = [
      { n: 'Protein', kk: 'p', got: Math.round(tot.p), want: Math.round(T.p) },
      { n: 'Fat', kk: 'f', got: Math.round(tot.f), want: Math.round(T.f) },
      { n: 'Carbs', kk: 'c', got: Math.round(tot.c), want: Math.round(T.c) }
    ];

    /* Where the day actually went. The one number you cannot read off the
       cards is how much of it landed in a single meal. */
    var meals = [];
    mReadSlots().list.forEach(function (s) {
      var kc = 0;
      (day[s.k] || []).forEach(function (it) {
        var r = BY_ID[it.id];
        if (r && r.macro) kc += (r.macro.kcal || 0) * it.x;
      });
      if (kc > 0) meals.push({ n: s.n, kcal: Math.round(kc) });
    });
    var mTot = 0, biggest = null;
    meals.forEach(function (m) {
      mTot += m.kcal;
      if (!biggest || m.kcal > biggest.kcal) biggest = m;
    });

    /* The week behind it, each day against ITS OWN target — a day on a
       different plan is not made to look like a miss. A day never filled in
       draws nothing: nothing logged is a gap in the record, not a day of no
       food, and counting it as a zero would quietly tell you the cut is going
       better than it is. */
    var week = [], onP = 0, kept = 0, sumK = 0;
    var d = keyDate(k);
    for (var i = 6; i >= 0; i--) {
      var dd = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
      var dk = dayKey(dd);
      var dt = mTotals(mDay(dk)).all;
      var dT = mDayTargets(dk);
      var has = (dt.p + dt.f + dt.c) > 0;
      var hit = null;
      if (has) {
        kept++;
        sumK += kcal(dt);
        hit = Math.abs(dt.p - dT.p) <= Math.max(10, dT.p * 0.08) ? 1 : 0;
        if (hit) onP++;
      }
      week.push({ k: dk, kcal: has ? Math.round(kcal(dt)) : null,
        want: Math.round(kcal(dT)), hit: hit, today: dk === k,
        lab: M_WDAYS[dd.getDay()].slice(0, 1) });
    }

    /* A day barely written down is not a day of great restraint, and this is
       the one state these cards usually lie about. It does not guess which it
       was — it says it cannot tell. */
    var thin = got > 0 && got < want * 0.45;
    return { rows: rows, week: week, onP: onP, kept: kept, meals: meals,
      biggest: biggest, mTot: mTot, got: got, want: want, thin: thin,
      avg: kept ? Math.round(sumK / kept) : 0,
      any: (tot.p + tot.f + tot.c) > 0 };
  }

  function mTryAgain(sk) {
    var k = mViewKey();
    S.mTouched = sk;                   // keep the meal you are cycling open
    S.mFold[sk] = false;
    var targets = mDayTargets(k);
    var slots = mReadSlots();
    var srec = null;
    slots.list.forEach(function (sl) { if (sl.k === sk) srec = sl; });
    if (!srec) return;
    var pins = (srec.pins || []).map(function (pn) { return pn.id; });
    var cursorKey = k + ':' + sk;

    mEditDay(k, function (day) {
      var had = (day[sk] || []).length;
      var keep = (day[sk] || []).filter(function (it) {
        return it.eaten || it.l || pins.indexOf(it.id) >= 0;
      });
      /* Nothing here is the machine's to swap, so there is nothing to try
         again at. Adding a second plate instead would be answering a
         question nobody asked — and would quietly hand Rebalance something
         to move on a meal that was deliberately pinned down. */
      if (had && keep.length === had) return;
      /* Whatever is being swapped out is out. The cursor starts at the top of
         a list the removed plate has just rejoined, so the first press could
         hand you back the very thing you pressed it to be rid of — "not that
         one" answered with that one. */
      var dropped = (day[sk] || []).filter(function (it) {
        return keep.indexOf(it) < 0;
      }).map(function (it) { return it.id; });
      day[sk] = keep;
      /* Ten presses is not exhaustion — a lunch has forty-odd recipes to walk
         and the cursor wraps long before you run out. It is disagreement.
         You have said "not that one" ten times, which is the clearest signal
         anybody gives that the sections this meal is allowed to look at are
         not where the answer is. So it stops being allowed to look only there.

         It stays open for the rest of the day on that meal, and says so on
         the card — a roast beef breakfast arriving unannounced reads as a
         bug rather than as an answer to what you asked for. */
      var tries = (S.mTry[cursorKey] === undefined ? -1 : S.mTry[cursorKey]) + 1;
      var pool = mMealPool(srec, tries >= MTRY_WIDE - 1).filter(function (r) {
        return !mOnDay(day, r.id) && dropped.indexOf(r.id) < 0;
      });

      var ranked = mRank(pool, day, targets, srec).filter(function (e) { return e.score !== null; });
      if (!ranked.length) return;
      S.mTry[cursorKey] = tries;
      var pick = ranked[tries % ranked.length];
      day[sk].push({ id: pick.r.id, x: pick.x, eaten: 0 });
    });
    keepingFocus(renderMacros);
  }

  function mNavDay(step) {
    var d = keyDate(mViewKey());
    d.setDate(d.getDate() + step);
    var k = dayKey(d);
    if (k > mLatestKey() || k < mEarliestKey()) return;
    S.macroDate = k === todayKey() ? null : k;
    S.mEdit = '';                    // a different day, a different plate
    renderMacros();
  }

  // ----------------------------------------------------------- shopping list
  /* The list works in grams and converts back at the end. It is the only way
     "1 cup", "1 cup" and "2 tbsp" of the same thing can come to 2¼ cups, and it
     is what lets one line cover a diced apple and a sliced one. Which food a
     line is, and how much of it, were worked out at build time — see
     tools/build-data.js — so the browser only has to add up. */
  function buildList() {
    var entries = planEntries();
    var bucket = {};
    entries.forEach(function (e) {
      (e.r.ingp || []).forEach(function (it) {
        var s = SHOP[it.k];
        if (!s || it.k === 'water') return;
        /* "(optional)" means you are not being sent out for it. */
        if (it.o) return;
        // seasonings share one food key, so they go by their own name instead
        /* The food key, and nothing about which heading it lands under.
        
           It used to be prefixed with the heading — base| or extra| — which
           made a ticked item's identity depend on where it was filed. Take
           something off your pantry shelf mid-shop and every tick against it
           vanished, because "base|ground beef" and "extra|ground beef" are two
           different things to a checklist and one thing to a person. Nothing
           needed the prefix: a food key can only be under one heading at a
           time, so there was never a collision for it to prevent. */
        var key = s.s ? it.a : it.k;
        if (!bucket[key]) {
          bucket[key] = {
            key: key, extra: true, g: 0,
            unit: s.u, per: s.p, lad: s.d,
            label: s.s ? it.a.charAt(0).toUpperCase() + it.a.slice(1) : s.l
          };
        }
        /* One line per thing, and the same predicate every other part of the
           app uses to answer the same question. This used to be decided
           per-recipe, so a recipe that called chocolate chips an extra and one
           that did not put them on the list twice; asking the shelf instead
           fixed that and introduced a quieter fault, because asking the shelf
           is not the whole question.
           
           A line the food table cannot weigh carries the key "free" — every
           seasoning shares it — and the pantry has never heard of "free", so
           it defaults to kept. That is right for salt and vanilla, which the
           storehouse does carry. It is wrong for the ones the recipe itself
           marked as an extra: five grams of creatine came out of a Crio Bru
           drink and landed under "From the storehouse", telling a reader the
           storehouse stocks creatine. It does not.
           
           itemNeedsBuying reads the recipe's own flag for those and the shelf
           for everything else, and it is what the coloured ingredient line and
           the "Also needs" foot already use. One question, one answer. */
        bucket[key].extra = itemNeedsBuying(it);
        bucket[key].g += it.g * e.x;
      });
    });
    var group = function (title, wantExtra) {
      var items = Object.keys(bucket).map(function (k) { return bucket[k]; })
        .filter(function (b) { return b.extra === wantExtra; })
        .sort(function (a, b) { return a.label.localeCompare(b.label); });
      items.forEach(function (b) { b.qty = shopQty(b.g, b.unit, b.per, b.lad); });
      return { title: title, items: items };
    };
    return {
      groups: [group(window.Store.pantryChanged() ? 'Already on your shelf' : 'From the storehouse', false),
               group('To pick up', true)]
        .filter(function (g) { return g.items.length; }),
      recipeCount: entries.length
    };
  }

  function renderList() {
    var built = buildList();

    var total = built.groups.reduce(function (n, g) { return n + g.items.length; }, 0);
    // which week this list came out of — there can be several
    $('listWeek').textContent = window.Store.activeWeek().name;
    $('listCount').textContent = total
      ? total + ' items · ' + built.recipeCount + (built.recipeCount === 1 ? ' recipe' : ' recipes')
      : '';
    $('listEmpty').classList.toggle('hide', total !== 0);
    $('listBody').innerHTML = built.groups.map(function (g) {
      return '<div class="list-group">' +
        '<div class="list-group-title">' + esc(g.title) + '</div>' +
        '<div class="list-items">' + g.items.map(function (it) {
          var on = window.Store.isChecked(it.key);
          return '<label class="list-row' + (on ? ' done' : '') + '">' +
            '<input type="checkbox" data-check="' + esc(it.key) + '"' + (on ? ' checked' : '') + '>' +
            '<span>' + esc(it.label) + '</span>' +
            '<span class="qty">' + esc(it.qty) + '</span>' +
          '</label>';
        }).join('') + '</div></div>';
    }).join('');
  }

  // ------------------------------------------------------------- print book
  function printPool() {
    if (S.printSet === 'one') return RECIPES.filter(function (r) { return r.book !== 3; });
    if (/^[123]$/.test(S.printSet)) {
      var b = Number(S.printSet);
      return RECIPES.filter(function (r) { return r.book === b; });
    }
    if (S.printSet === 'fav') return RECIPES.filter(function (r) { return window.Store.isFav(r.id); });
    if (S.printSet === 'plan') return planIds().map(function (id) { return BY_ID[id]; }).filter(Boolean);
    return RECIPES;
  }

  // ---- the pieces a page is built from -----------------------------------
  var YEAR = '2026';
  /* The cover's own year. Roman on a cover and plain everywhere else: the back
     cover and the running furniture are read, and MMXXVI is a thing you look at
     rather than a thing you read. Written out rather than converted, because
     one line a year beats a function nobody will remember exists. */
  var ROMAN_YEAR = 'MMXXVI';
  /* Roman on the cover and the title page, which is what a formal title page
     does with a volume number. Only three of them will ever exist, so a
     numeral-to-roman function would be three lines of arithmetic guarding a
     lookup of three entries. */
  var ORDINAL = { 1: 'I', 2: 'II', 3: 'III' };

  function volumeLine(vol) {
    if (vol.single || vol.grouped || !ORDINAL[vol.book]) return '';
    var of = ours().length ? 'III' : 'II';
    return 'Volume ' + ORDINAL[vol.book] + ' of ' + of;
  }

  /* The skep, drawn once here rather than fetched. icons/hive.svg is the same
     drawing, but it is an icon: it carries the app's paper as a background rect
     and is sized for a 32px tab. This is the printer's version of it — no
     ground, stroked in the book's own accent, and it must not depend on a file
     load, because a cover with a hole in it is worse than a cover with no mark
     at all. The viewBox is cropped to the drawing so the mark can be sized by
     its own height rather than by the padding around it. */
  function skepHTML(px) {
    return '<svg class="skep" width="' + Math.round(px * 332 / 240) + '" height="' + px +
      '" viewBox="90 140 332 240" aria-hidden="true">' +
      '<path d="M136 366c0-152 34-206 120-206s120 54 120 206"/>' +
      '<path d="M192 186q64-26 128 0"/>' +
      '<path d="M164 236q92-32 184 0"/>' +
      '<path d="M148 288q108-32 216 0"/>' +
      '<path d="M104 366h304"/>' +
      '<path class="skep-door" d="M230 366v-22q0-26 26-26t26 26v22z"/>' +
    '</svg>';
  }

  /* A French rule — a heavy line with a hairline beneath it. It is the oldest
     formal device in typesetting and it is doing the work a second typeface
     would otherwise have to do. */
  function fruleHTML() { return '<span class="frule"><i></i><i></i></span>'; }

  /* The code on the back cover. Built by tools/build-qr.js and inlined here, so
     it needs no network at the moment of rendering — the same rule the fonts
     and the engravings follow, and for the same reason: nothing in a printed
     page may depend on somebody else's uptime.

     Absent rather than empty if data/qr.js has not been built. A back cover
     with a hole and a caption pointing at it is worse than one without. */
  function qrHTML() {
    if (!window.APP_QR) return '';
    return '<div class="bc-qr">' +
      '<div class="bc-qr-img">' + window.APP_QR + '</div>' +
      '<div class="bc-qr-line">Every recipe here, on your phone &mdash; with a shopping ' +
        'list that builds itself.</div>' +
      '<div class="bc-qr-cap">Scan to open</div>' +
    '</div>';
  }

  function coverHTML(vol, title, sub, foot) {
    var vl = volumeLine(vol);
    return '<div class="pg"><div class="pg-cover">' +
      '<div class="pg-cover-top">' +
        (vol.single
          /* On the combined edition the title is the series name, so the
             eyebrow cannot also be — it read as a stutter. It says which of
             the three printings you are holding, which is the one thing the
             cover could not otherwise tell you. */
          ? '<div class="pg-eyebrow">Complete in one volume</div>'
          : '<div class="pg-eyebrow">' + esc(APP_NAME) + '</div>' +
            '<div class="pg-eyebrow">' + esc(APP_LINE) + '</div>') +
      '</div>' +
      '<div class="pg-cover-mid">' +
        skepHTML(52) +
        fruleHTML() +
        '<div class="pg-title">' + esc(title) + '</div>' +
        fruleHTML() +
        '<div class="pg-sub">' + esc(sub) + '</div>' +
        (vl ? '<div class="pg-vol">' + esc(vl) + '</div>' : '') +
      '</div>' +
      /* The year rides with the book, not with the volume line. It was gated on
         `vl`, which is empty for the combined edition — so the one cover that
         is not a volume of anything came out with no year on it at all. A week
         of somebody's meal plan still does not want one. */
      '<div class="pg-foot">' + esc(foot) +
        (vol.grouped ? '' : ' &middot; ' + ROMAN_YEAR) + '</div>' +
    '</div></div>';
  }

  /* The right-hand page behind the cover. A cover is a thing you look at; this
     is the page that says what the book is.

     The foot of it used to carry three paragraphs of small print: where the
     ingredients come from, where the macros come from, and what the thing was
     typeset in. All of it was already said properly two pages later, in How to
     read this book, and saying it twice made the second telling sound like an
     apology for the first. One sentence was worse than redundant — it explained
     that the macros were "as recorded for Run and Not Be Weary and worked out
     from the ingredients everywhere else", which is a sentence written from
     outside both volumes and read from inside one of them, where "everywhere
     else" points at nothing you are holding.

     So: the verse the volume is named for, and nothing else. It is the one
     thing on the page that could not be moved somewhere more useful. */
  function titlePageHTML(vol, title, sub, epi) {
    var vl = volumeLine(vol);
    return '<div class="pg"><div class="pg-title-page">' +
      '<div class="tp-top">' +
        '<div class="pg-eyebrow">' + esc(APP_NAME + ' ' + APP_LINE) + '</div>' +
        '<div class="tp-name">' + esc(title) + '</div>' +
        '<div class="tp-sub">' + esc(sub) + '</div>' +
        (vl ? '<div class="tp-vol">' + esc(vl) + '</div>' : '') +
      '</div>' +
      (epi ? '<div class="tp-epi">' +
        '<div class="tp-epi-t">' + epi.t.map(esc).join('<br>') + '</div>' +
        '<div class="tp-epi-r">' + esc(epi.r) + '</div>' +
      '</div>' : '') +
    '</div></div>';
  }

  /* The back cover: what is in this volume, at a glance, so the book can be
     picked off a shelf and put back without opening it. */
  function backCoverHTML(vol, title) {
    var secs = [];
    vol.list.forEach(function (r) {
      var last = secs[secs.length - 1];
      if (last && last.name === r.secName) last.n++;
      else secs.push({ num: r.secNum, name: r.secName, n: 1 });
    });
    var vl = volumeLine(vol);
    var other = vol.book === 1 ? BOOKS[2].name : BOOKS[1].name;
    if (vol.single) secs.forEach(function (x, i) { x.num = i + 1; });

    return '<div class="pg"><div class="pg-back">' +
      '<div class="bc-top">' +
        '<div class="pg-eyebrow">' + esc(APP_NAME + ' ' + APP_LINE) + '</div>' +
        '<div class="bc-name">' + esc(title) + '</div>' +
      '</div>' +
      '<div class="bc-list">' +
        secs.map(function (s) {
          return '<div class="bc-row"><span class="bc-no">' + esc(s.num) + '</span>' +
            '<span class="bc-sec">' + esc(s.name) + '</span>' +
            '<span class="bc-n">' + s.n + '</span></div>';
        }).join('') +
      '</div>' +
      /* Two paragraphs used to sit between the contents and the foot: one
         asserting that every recipe had been checked against the order list and
         against the ratios a kitchen runs on, and one explaining the score. The
         second is said properly in How to read a recipe, four pages in. The
         first is the sound of somebody describing their own work — a back cover
         tells a person what is inside, and "we were careful" is not a thing
         inside.

         What is there instead is the code, which is the same job done honestly:
         it does not describe the book, it hands you the rest of it. The line
         under it is not decoration — a bare QR tells you to scan and not why,
         and nobody scans a code to find out what it was for.

         It goes here rather than on the title page because a title page is
         ceremonial and this is a machine part. That page carries the verse and
         nothing else on purpose. */
      qrHTML() +
      '<div class="bc-foot">' +
        (vol.grouped || vol.single ? '' : '<p>The companion volume is <strong>' + esc(other) + '</strong>.</p>') +
        '<p>' + vol.list.length + (vol.list.length === 1 ? ' recipe' : ' recipes') +
          (vl ? ' &middot; ' + esc(vl) : '') + ' &middot; ' + YEAR + '</p>' +
      '</div>' +
    '</div></div>';
  }

  /* The page where one part becomes the next in the combined edition. Built
     like the section openers it sits among — no folio, centred, quiet — so the
     book has one vocabulary of divider page rather than two. */
  function partHTML(book) {
    return '<div class="pg"><div class="pg-open pg-part"><div class="pg-open-txt">' +
      skepHTML(34) +
      fruleHTML() +
      '<div class="sec-band-n">Part ' + ORDINAL[book] + '</div>' +
      '<div class="pg-open-t">' + esc(BOOKS[book].name).replace(/-/g, '-\u2060') + '</div>' +
      '<div class="pg-open-s">' + esc(SEC_PART[book] || '') + '</div>' +
      fruleHTML() +
    '</div></div></div>';
  }

  // a page with nothing on it, so the sheet count comes out right for folding
  function blankHTML() { return '<div class="pg"></div>'; }

  function bandHTML(r, count, no) {
    return '<div class="sec-band">' +
      '<div class="sec-band-n">Section ' + (no || r.secNum) + '</div>' +
      '<div class="sec-band-t">' + esc(r.secName) + '</div>' +
      '<div class="sec-band-s">' + esc(SEC_NOTE[r.book + '-' + r.secNum] || '') +
        ' · ' + count + (count === 1 ? ' recipe' : ' recipes') + '</div>' +
    '</div>';
  }

  /* Sections find their art by slugifying their own name, so the tie between
     a picture and a section is the section's name rather than a list kept in
     step by hand. Rename a section and its picture follows, or stops being
     found — which is the honest outcome, and visible immediately. */
  function slug(s) {
    return s.toLowerCase().replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function secArt(r) {
    return (window.SECTION_ART || {})[slug(r.secName)] || null;
  }

  /* A section that has a picture opens on a page of its own: the illustration,
     then the same heading the inline band carries, so the two read as the same
     furniture at two sizes. No folio, like the front matter — a page that is
     not part of the numbered run should not claim a number. */
  function openerHTML(r, count, art, no) {
    return '<div class="pg"><div class="pg-open">' +
      '<div class="pg-open-art"><img src="' + esc(art) + '" alt=""></div>' +
      '<div class="pg-open-txt">' +
        '<div class="sec-band-n">Section ' + (no || r.secNum) + '</div>' +
        /* A word joiner after each hyphen, so a compound never splits at its
           own hyphen: balance was setting "Zero-Cook & Grab- / and-Go Fuel",
           which reads as a hyphenation fault rather than a line break. With
           the joiner the only legal breaks are the spaces, and balance picks
           the best of those. */
        '<div class="pg-open-t">' + esc(r.secName).replace(/-/g, '-\u2060') + '</div>' +
        '<div class="pg-rule"></div>' +
        '<div class="pg-open-s">' + esc(SEC_NOTE[r.book + '-' + r.secNum] || '') + '</div>' +
        '<div class="pg-open-n">' + count + (count === 1 ? ' recipe' : ' recipes') + '</div>' +
      '</div>' +
    '</div></div>';
  }

  /* ---- what this household would have to go out for -----------------------
     Every ingredient carries x:1 when the storehouse did not stock it, and
     that answer is baked into the books. It is a fact about a shop, though,
     and the useful question in a kitchen is whether you have the thing in. So
     the flag becomes a default and the pantry answers over the top of it: keep
     the storehouse list untouched and nothing changes, tick things off it and
     the recipes follow you.

     free is a line with no weight, water is not shopping, and neither belongs
     on a list of what to buy. */
  function inPantry(key) {
    var d = (window.PANTRY || {})[key];
    /* A key the pantry has never heard of defaults to kept, not to missing.
       Seasonings all share the "free" food key and go by their own name, so
       they are not in the pantry at all — defaulting those to missing put salt
       and vanilla on the shopping list under "to pick up", which is both wrong
       and exactly what the old flag never did. */
    return window.Store.pantryHas(key, d ? d.s : true);
  }

  /* Would you have to go out for this one parsed ingredient?
   *
   * One answer, asked in two places: the foot of a recipe lists what to buy,
   * and the ingredient lines themselves are marked. Those used to be two
   * separate pieces of reasoning, and they disagreed — the foot named paprika
   * while the line sat in the same colour as the flour above it, because the
   * foot had been taught about flagged seasonings and the line had not. Two
   * rules for one question will drift again, so there is one.
   *
   * A `free` line is a seasoning priced at nothing. Most are the salt and
   * pepper and cinnamon the storehouse carries and are rightly silent; `x`
   * marks the ones it does not. */
  function itemNeedsBuying(it) {
    if (!it || !it.k) return false;
    if (it.o) return false;            // "(optional)" on the line      // a line the food table could not place
    if (it.k === 'free') return !!it.x;
    return it.k !== 'water' && !inPantry(it.k);
  }

  function missingFor(r) {
    var out = [], seen = {};
    (r.ingp || []).forEach(function (it) {
      if (!itemNeedsBuying(it)) return;
      if (it.k === 'free') {
        var extra = it.a || 'a seasoning';
        if (!seen[extra]) { seen[extra] = 1; out.push(extra); }
        return;
      }
      if (it.k === 'water' || inPantry(it.k)) return;
      var d = (window.PANTRY || {})[it.k];
      var label = d ? d.l : (it.a || String(it.k).replace(/_/g, ' '));
      if (!seen[label]) { seen[label] = 1; out.push(label); }
    });
    return out;
  }

  /* Whether a written ingredient line is something you would have to go out
     for. ingp runs parallel to ing, so line i asks about food i. */
  function lineNeedsBuying(r, ix) {
    return itemNeedsBuying((r.ingp || [])[ix]);
  }

  // "storehouse" is only the right word while the shelf is still the storehouse's
  function shelfName() { return window.Store.pantryChanged() ? 'your pantry' : 'the storehouse'; }

  function recipeHTML(r) {
    return '<div class="rp">' +
      '<div class="rp-top">' +
        '<span class="rp-num">No. ' + no(r) + '</span>' +
        '<span class="rp-meta">' +
          esc(r.servings.split(' (')[0] + ' · ' + r.time + ' · ' + diffLabel(r.diff)) +
          leaf(r.score, 'leaf-print') +
        '</span>' +
      '</div>' +
      '<div class="rp-name">' + esc(r.name) + '</div>' +
      (r.tagline ? '<div class="rp-tag">' + esc(r.tagline) + '</div>' : '') +
      '<div class="rp-cols">' +
        '<div><div class="rp-h">Ingredients</div><div class="rp-ing">' +
          /* Anything not on the shelf is set in the accent the book already
             uses for its numbers and headings, so it is picked out in the list
             itself rather than only named in the line at the foot. Colour is
             not carrying this on its own — the foot still spells the same
             items out in words — so a black-and-white print loses nothing. */
          r.ing.map(function (i, ix) {
            return '<div' + (lineNeedsBuying(r, ix) ? ' class="ing-buy"' : '') + '>' +
              esc(i) + makerHTML(r, ix, false) + '</div>';
          }).join('') +
        '</div></div>' +
        '<div><div class="rp-h">Method</div><div class="rp-steps">' +
          r.steps.map(function (t, i) {
            /* Not a button: this one is the printed page. Paper gets the
               number, which is what a number in a book is for. */
            return '<div class="rp-step"><div class="rp-step-n">' + (i + 1) + '</div>' +
              '<div class="rp-step-t">' + xref(esc(t), false) + '</div></div>';
          }).join('') +
        '</div>' + liftHTML(r, false) + '</div>' +
      '</div>' +
      '<div class="rp-foot">' +
        '<span>' + esc(macroLine(r)) + '</span>' +
        /* Recomputed against the pantry rather than read off r.extras, so a
           recipe that was entirely storehouse says so only while that is still
           true — and starts naming what to buy the moment it is not. */
        '<span>' + esc((function () {
          var m = missingFor(r);
          return m.length ? 'Also needs: ' + m.join(', ')
            : (window.Store.pantryChanged() ? 'All on your shelf' : 'All storehouse items');
        })()) + '</span>' +
      '</div>' +
    '</div>';
  }

  /* ---- measuring -------------------------------------------------------
     How tall a recipe ends up is a question only the browser can answer —
     it depends on the fonts that actually loaded and where the text wraps.
     So render the blocks offscreen at the exact printed width, read their
     heights, and pack from real numbers rather than guesses. */
  var MEASURE = null;
  function measurer() {
    if (!MEASURE) {
      MEASURE = document.createElement('div');
      // "pg" so it inherits the exact printed width and padding; "no-print"
      // so this scratch element can never turn into a blank sheet of paper
      MEASURE.className = 'pg no-print';
      MEASURE.setAttribute('aria-hidden', 'true');
      MEASURE.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden;' +
        'min-height:0;height:auto;box-shadow:none;pointer-events:none';
      document.body.appendChild(MEASURE);
    }
    return MEASURE;
  }

  function measure(items) {
    var m = measurer();
    // each block gets its own wrapper so the ".rp + .rp" separator never
    // applies here — separators are added by the packer instead
    m.innerHTML = '<div class="pg-run"><span>A</span><span class="pg-run-sec">B</span></div>' +
      '<div class="pg-flow">' + items.map(function (it) {
        return '<div>' + it.html + '</div>';
      }).join('') + '</div>' +
      '<div class="pg-fol">1</div>';

    var flow = m.querySelector('.pg-flow');
    for (var i = 0; i < items.length; i++) {
      items[i].h = flow.children[i].getBoundingClientRect().height;
    }

    var runEl = m.querySelector('.pg-run');
    var folEl = m.querySelector('.pg-fol');
    var chrome = runEl.getBoundingClientRect().height +
      parseFloat(getComputedStyle(runEl).marginBottom) +
      folEl.getBoundingClientRect().height +
      parseFloat(getComputedStyle(folEl).paddingTop);

    // read the recipe separator off the stylesheet rather than hardcoding it
    m.innerHTML = '<div class="pg-flow">' + recipeHTML(RECIPES[0]) + recipeHTML(RECIPES[0]) + '</div>';
    var two = m.querySelector('.pg-flow').children;
    // margin is kept apart from padding+border: only the margin can be widened
    // later to even out a page, the rest is fixed by the rule itself
    var sepMargin = parseFloat(getComputedStyle(two[1]).marginTop);
    var sep = two[1].getBoundingClientRect().height - two[0].getBoundingClientRect().height + sepMargin;

    // and the section band's bottom margin
    m.innerHTML = '<div class="pg-flow">' + bandHTML(RECIPES[0], 1) + '</div>';
    var bandGap = parseFloat(getComputedStyle(m.querySelector('.sec-band')).marginBottom);

    m.innerHTML = '';
    return { chrome: chrome, sep: sep, sepMargin: sepMargin, bandGap: bandGap };
  }

  /* Fill each page with as many recipes as genuinely fit. A recipe is never
     split across a page, and a section heading never sits alone at the foot
     of one. */
  function pack(items, avail, m) {
    var pages = [], cur = [], h = 0;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var isBand = it.type === 'band';
      var isHead = isBand || it.type === 'tochead' || it.type === 'fmhead';
      // a recipe following another recipe carries the separator rule
      var lead = (!isHead && cur.length && cur[cur.length - 1].type === 'recipe') ? m.sep : 0;
      var need = it.h + lead + (isBand ? m.bandGap : 0);
      // keep a heading with at least the first entry under it
      if (isHead && items[i + 1]) need += items[i + 1].h;

      if (cur.length && h + need > avail) { pages.push(cur); cur = []; h = 0; lead = 0; need = it.h + (isBand ? m.bandGap : 0); }
      cur.push(it);
      h += it.h + lead + (isBand ? m.bandGap : 0);
    }
    if (cur.length) pages.push(cur);
    return pages;
  }


  /* ---- front matter ----------------------------------------------------
     Reference pages that belong in a book people cook from: how to read a
     recipe, the temperatures that matter, weights and swaps, and what the
     storehouse actually carries. Built as blocks and packed like everything
     else, so a page can never overflow. */
  var STOREHOUSE = [
    ['Canned meats', 'Fully cooked beef · Beef stew · Chili · Pork and beans · Tuna · Chicken breast pieces'],
    ['Canned soups', 'Chicken rotini · Cream of chicken · Cream of mushroom · Tomato'],
    ['Canned fruit', 'Applesauce · Peaches · Pears'],
    ['Canned veg', 'Corn · Green beans · Diced tomatoes · Tomato sauce · Spaghetti sauce'],
    ['Beans, rice, potatoes', 'Black beans · Pinto beans · Great Northern beans · Dry pinto beans · Refried beans · Instant potatoes · Rice'],
    ['Meat', 'Beef franks · Ground beef · Pork sausage · Stewing beef · Beef roast · Chicken breasts · Sliced ham · Pork roast'],
    ['Dairy and eggs', 'Butter · Cheddar · Cottage cheese · Eggs · 2% milk · Sour cream · Vanilla yogurt'],
    ['Fresh', 'Apples · Bananas · Grapes · Oranges · Cucumbers · Lettuce · Bell peppers · Broccoli · Carrots · Onions · Potatoes · Tomatoes'],
    ['Flour and pasta', 'White flour · Pancake and waffle mix · Macaroni · Ribbon pasta · Spaghetti · Mac and cheese'],
    ['Cereal', 'Rolled oats · Honey nut o’s · Raisin bran'],
    ['Baking', 'Baking powder · Baking soda · Yeast · Evaporated milk · Raisins · Vegetable oil'],
    ['Sugars', 'Brown · Granulated · Powdered'],
    ['Seasonings', 'Cinnamon · Black pepper · Salt · Vanilla'],
    ['Condiments', 'Ketchup · Mustard · Mayo · Ranch · Salsa · Honey · Jams · Peanut butter · Syrup · Black olives'],
    ['Drinks and desserts', 'Non-fat dry milk · Hot cocoa · Gelatin · Puddings · Cake mixes'],
    ['Bread', 'White · Whole wheat · Hamburger buns · Hot dog buns · Tortillas'],
  ];

  function frontMatterItems(vol) {
    var b = [];
    var block = function (html) { b.push({ type: 'fmblock', html: '<div class="fm-block">' + html + '</div>' }); };
    var head = function (html) { b.push({ type: 'fmhead', html: '<div class="fm-block">' + html + '</div>' }); };

    /* Ours needs none of it. Four pages explaining a book you wrote yourself
       would be four pages telling you what you already know. */
    if (vol.book === 3) {
      head('<div class="fm-title">Ours</div>' +
        '<div class="fm-lede">Written at this table rather than carried over.</div>');
      block('<div class="fm-p">These follow the same shape as the two printed volumes — a number, a ' +
        'serving count, a time, an effort and a score out of 100. Calories, sodium, fiber and carbohydrate are worked ' +
        'out from the ingredients using the same table, so a score here means what a score there ' +
        'means.</div>');
      return b;
    }

    head('<div class="fm-title">How to read a recipe</div>' +
      /* Named in full here and on the two covers, and nowhere else. It is the
         ordinary courtesy of a first mention: forty-odd later ones say "the
         storehouse" and read fine, because by then you have been told which.

         "Everything here is built from what the storehouse actually carries"
         is what this said, and it was not true — thirty-eight of Volume One's
         hundred recipes need something the storehouse does not stock, which is
         why every recipe carries a line at its foot saying so. "Actually" was
         arguing with somebody, too. Nobody had said otherwise. */
      '<div class="fm-lede">Primary ingredients come from the bishops’&nbsp;storehouse order.</div>');
    /* In the book itself, because the book outlives the website and travels
       further than it — a spiral-bound copy on somebody's counter carries no
       footer and no address bar. */
    block('<div class="fm-p fm-fine">This is not an official product of The Church of Jesus ' +
      'Christ of Latter-day Saints and is not affiliated with or endorsed by the Church. It is ' +
      'a family\u2019s own collection, built from what their bishops\u2019&nbsp;storehouse ' +
      'carries.</div>');

    block('<div class="fm-sub">The number</div>' +
      '<div class="fm-p">Every recipe has one, running from 001 straight through both volumes. ' +
      'The contents at the front of each book lists them in order with its page.</div>');

    block('<div class="fm-sub">Effort</div>' +
      '<div class="fm-table">' +
      '<div>Easy</div><div>No real cooking, or one pan and a few minutes.</div>' +
      '<div>Medium</div><div>A hot stove and some timing, but nothing that can go badly wrong.</div>' +
      '<div>In-depth</div><div>An afternoon, or a long slow oven, or a technique worth learning.</div>' +
      '</div>');

    block('<div class="fm-sub">The line under the title</div>' +
      '<div class="fm-p">Servings, time, effort, and a nutrition score out of 100. Six things make it up: ' +
      'how much of the energy comes from protein (27 points, full marks at 45%), how many calories a ' +
      'serving carries (18, full marks up to 300), how much of the energy comes from fat (8, full marks ' +
      'at or below a tenth), how much sodium a serving carries (22, full marks to 300 mg and nothing left ' +
      'by 1,200), how much fiber (13, full marks at 7 g), and how much of the energy is carbohydrate ' +
      'that arrived without any (12).</div>' +
      '<div class="fm-p">That last one is not a carbohydrate count. Oats and frosting are both ' +
      'carbohydrate, and a number that cannot tell them apart is worse than no number. A gram of fiber ' +
      'covers ten grams of carbohydrate — roughly the ratio a whole food comes in — and only what is ' +
      'left over costs anything. A bowl of oats loses nothing; a mug of hot milk and brown sugar loses ' +
      'all twelve.</div>' +
      '<div class="fm-p">Sodium, fiber and carbohydrate are worked out from the ingredients rather than ' +
      'measured, in both volumes. Canned goods carry the salt; that is most of what the sodium figure is ' +
      'telling you.</div>' +
      '<div class="fm-p">It measures one thing only. A high score does not mean a dish is good, and a low ' +
      'one does not mean it is bad — a plate of fudge scores badly and is still fudge. Whether a recipe ' +
      'needs anything beyond the standard order is a separate question, answered on the line at its foot.</div>');

    block('<div class="fm-sub">Also needs</div>' +
      '<div class="fm-p">The line at the foot of each recipe. Either it says everything is on the standard ' +
      'list, or it names exactly what is not, so you know before you start rather than halfway through.</div>' +
      '<div class="fm-sub">Servings</div>' +
      '<div class="fm-p">Written for a household. Halving or doubling most of these is safe; baking is the ' +
      'exception, where the ratios are doing real work.</div>');

    head('<div class="fm-title">Temperatures and doneness</div>' +
      '<div class="fm-lede">Colour is not a reliable guide. A thermometer in the thickest part is.</div>');
    block('<div class="fm-table">' +
      '<div class="fm-key">165°F</div><div>Chicken and turkey, every cut, and anything reheated</div>' +
      '<div class="fm-key">160°F</div><div>Ground beef and ground pork; egg dishes and casseroles</div>' +
      '<div class="fm-key">145°F</div><div>Whole cuts of beef and pork, then rested three minutes</div>' +
      '<div class="fm-key">40–140°F</div><div>The range food should not sit in. Two hours out is the limit.</div>' +
      '</div>');

    block('<div class="fm-warn">Chicken is the one to be careful with. A crisp crust, clear juices or a ' +
      'long time in the oven are not proof it is done — thick breasts under a sauce take far longer than ' +
      'they look. Where a recipe cooks chicken, it says what to check for.</div>' +
      '<div class="fm-sub">Ovens lie</div>' +
      '<div class="fm-p">Most run hot or cold by a good margin. Check five minutes before the stated time ' +
      'the first time you make something, and write the real time in the margin.</div>');

    head('<div class="fm-title">Weights and swaps</div>' +
      '<div class="fm-lede">One cup, level, unpacked unless it says otherwise.</div>');
    block('<div class="fm-table">' +
      '<div class="fm-key">125 g</div><div>Flour, one cup</div>' +
      '<div class="fm-key">200 g</div><div>Granulated sugar, one cup</div>' +
      '<div class="fm-key">220 g</div><div>Brown sugar, one cup, packed</div>' +
      '<div class="fm-key">120 g</div><div>Powdered sugar, one cup</div>' +
      '<div class="fm-key">227 g</div><div>Butter, one cup — two sticks</div>' +
      '<div class="fm-key">80 g</div><div>Rolled oats, one cup</div>' +
      '<div class="fm-key">244 g</div><div>Milk or water, one cup</div>' +
      '<div class="fm-key">7 g</div><div>Yeast, one packet — 2¼ teaspoons</div>' +
      '</div>');

    block('<div class="fm-sub">When you are missing something</div>' +
      '<div class="fm-table">' +
      '<div>Buttermilk</div><div>A cup of milk with a spoonful of vinegar or lemon juice, left ten minutes</div>' +
      '<div>Self-raising flour</div><div>A cup of flour with 1½ teaspoons baking powder and a pinch of salt</div>' +
      '<div>One egg</div><div>In a bake, three tablespoons of applesauce — not in a custard, where the egg is the point</div>' +
      '<div>Cake flour</div><div>A cup of flour with two tablespoons taken out and two of cornstarch put back</div>' +
      '<div>Sour cream</div><div>Plain yogurt, in most things that are not baked</div>' +
      '</div>');

    head('<div class="fm-title">What the storehouse carries</div>' +
      '<div class="fm-lede">The standard order. Anything a recipe needs beyond this is named at its foot.</div>');
    // Chunked so it can flow across a page, but the label column is a fixed
    // width in CSS, so every chunk lines up with every other one. Left to size
    // itself, each piece picked its own width and the list looked scattered.
    for (var i = 0; i < STOREHOUSE.length; i += 6) {
      block('<div class="fm-table fm-pantry">' + STOREHOUSE.slice(i, i + 6).map(function (row) {
        return '<div>' + esc(row[0]) + '</div><div>' + esc(row[1]) + '</div>';
      }).join('') + '</div>');
    }

    return b;
  }

  /* ---- contents --------------------------------------------------------
     Built after the recipe pages are packed, so every page number is already
     known. Contents pages carry no folio of their own — like the cover — which
     is what keeps the numbering from shifting as the list grows. */
  function tocHeadHTML(name) {
    return '<div class="toc-head">' + esc(name) + '</div>';
  }
  function tocRowHTML(r, page) {
    return '<div class="toc-row">' +
      '<span class="toc-no">' + no(r) + '</span>' +
      '<span class="toc-name">' + esc(r.name) + '</span>' +
      '<span class="toc-dots"></span>' +
      '<span class="toc-pg">' + page + '</span>' +
    '</div>';
  }

  function buildContents(packed, vol, m, avail) {
    /* Which page each recipe landed on. Counted the same way the folio is —
       skipping openers — or the contents would point a page or eight past
       where the recipe actually is. */
    var pageOf = {}, folio = 0;
    packed.forEach(function (pageItems) {
      if (pageItems.opener) return;
      folio++;
      pageItems.forEach(function (x) { if (x.type === 'recipe') pageOf[x.r.id] = folio; });
    });

    var items = [], lastSec = null;
    vol.list.forEach(function (r) {
      var key = r.book + '-' + r.secNum;
      if (!vol.grouped && key !== lastSec) {
        lastSec = key;
        items.push({ type: 'tochead', html: tocHeadHTML(r.secName) });
      }
      items.push({ type: 'tocrow', html: tocRowHTML(r, pageOf[r.id]) });
    });
    if (!items.length) return [];

    measure(items);
    return pack(items, avail, m).map(function (col) {
      return '<div class="pg">' +
        '<div class="pg-run"><span>' +
          esc(vol.grouped || vol.single ? vol.title : BOOKS[vol.book].name) + '</span>' +
          '<span class="pg-run-sec">Contents</span></div>' +
        '<div class="toc-cols"><div class="toc-col">' +
          col.map(function (x) { return x.html; }).join('') +
        '</div></div>' +
      '</div>';
    });
  }

  function buildBook() {
    var pool = printPool();
    if (!pool.length) return [];
    var grouped = S.printSet === 'fav' || S.printSet === 'plan';

    // "Both books" really means two books — each volume opens on its own
    // cover and is numbered from page one.
    var volumes;
    /* One book, both parts. The two-volume build below is still the default;
       this is the edition you take to a copy shop to be spiral bound, where a
       back cover a third of the way in and a second set of front matter would
       read as a printing fault rather than as two books. */
    if (S.printSet === 'one') {
      volumes = [{ book: 1, list: pool, grouped: false, single: true }];
    } else if (grouped || /^[123]$/.test(S.printSet)) {
      volumes = [{ book: grouped ? 1 : Number(S.printSet), list: pool, grouped: grouped }];
    } else {
      volumes = [1, 2, 3].map(function (b) {
        return { book: b, list: pool.filter(function (r) { return r.book === b; }), grouped: false };
      }).filter(function (v) { return v.list.length; });
    }

    var out = [];
    volumes.forEach(function (vol) {
      /* Runs, not one flat list. A section with a picture opens on its own
         page, and everything after it therefore starts on a fresh page too —
         so its recipes are packed on their own rather than continuing from
         the tail of the previous section. Sections without a picture keep the
         inline band and flow on as before, which is what keeps a volume with
         no art rendering exactly as it did.

         The cost is real and worth naming: a section boundary that used to be
         a rule mid-page is now a page break, so the tail of the last page of
         every section is given up. That is the price of an opener, and it is
         paid in paper. */
      var items = [];
      var runs = [{ opener: null, items: [] }];
      var lastSec = null, lastBook = null;
      /* In the combined edition the sections are numbered straight through:
         Volume Two's "Section 1" would otherwise appear on page 60 of a book
         that already had one. Built up front so a section knows its number
         wherever it is printed — band, opener and contents all read it here. */
      var secNo = {}, running = 0;
      vol.list.forEach(function (r) {
        var k = r.book + '-' + r.secNum;
        if (secNo[k] === undefined) secNo[k] = vol.single ? ++running : r.secNum;
      });
      vol.list.forEach(function (r) {
        var key = r.book + '-' + r.secNum;
        /* Where the parts turn. The volume covers cannot be reused — they say
           "Volume I of II" and name a companion — so the join gets a page of
           its own that says what it is. */
        if (vol.single && r.book !== lastBook) {
          lastBook = r.book;
          runs.push({ opener: partHTML(r.book), items: [] });
        }
        if (!vol.grouped && key !== lastSec) {
          lastSec = key;
          var n = vol.list.filter(function (x) { return x.book === r.book && x.secNum === r.secNum; }).length;
          var art = secArt(r);
          var no = secNo[key];
          if (art) {
            runs.push({ opener: openerHTML(r, n, art, no), items: [] });
          } else {
            var band = { type: 'band', html: bandHTML(r, n, no), r: r };
            runs[runs.length - 1].items.push(band);
            items.push(band);
          }
        }
        var rec = { type: 'recipe', html: recipeHTML(r), r: r };
        runs[runs.length - 1].items.push(rec);
        items.push(rec);
      });
      runs = runs.filter(function (run) { return run.opener || run.items.length; });

      var m = measure(items);
      // a couple of pixels of slack absorbs any rounding between screen and print
      var avail = 7.5 * 96 - m.chrome - 4;

      /* An opener page joins the packed run as an empty page carrying its HTML
         on the side. Empty so that everything walking these pages to find
         where a recipe landed — the contents, in particular — steps over it
         without needing to know it exists; present so that it still takes up
         a leaf and the folio after it counts correctly. It prints no number
         itself, the way a section opening does in any book. */
      var packed = [];
      runs.forEach(function (run) {
        if (run.opener) {
          var page = [];
          page.opener = run.opener;
          packed.push(page);
        }
        pack(run.items, avail, m).forEach(function (p) { packed.push(p); });
      });

      var title = vol.single ? ONE_BOOK.name
        : vol.grouped ? (S.printSet === 'fav' ? 'Favorites' : 'This Week')
        : BOOKS[vol.book].name;
      vol.title = title;
      /* Counted off vol.list rather than the whole collection, because that is
         what this cover is the cover of. Printing Volume One alone and
         printing it as half of the combined edition are different books with
         different numbers on them, and the sentence should say the one it is
         on. */
      var sub = fillCounts(vol.single ? ONE_BOOK.blurb
        : vol.grouped ? (S.printSet === 'fav' ? 'The ones worth keeping.' : 'The week’s cooking, in order.')
        : BOOKS[vol.book].blurb, vol.list);
      var volStart = out.length;
      out.push({ kind: 'cover', html: coverHTML(vol, title, sub,
        vol.list.length + (vol.list.length === 1 ? ' recipe' : ' recipes')) });
      out.push({ kind: 'title', html: titlePageHTML(vol, title, sub,
        vol.single ? ONE_BOOK.epigraph : vol.grouped ? null : BOOKS[vol.book].epigraph) });

      if (!vol.grouped) {
        var fm = frontMatterItems(vol);
        measure(fm);
        pack(fm, avail, m).forEach(function (col) {
          out.push({ kind: 'front', html: '<div class="pg">' +
            '<div class="pg-run"><span>' + esc(vol.single ? ONE_BOOK.name : BOOKS[vol.book].name) + '</span>' +
              '<span class="pg-run-sec">Before you start</span></div>' +
            '<div class="toc-cols"><div class="toc-col">' +
              col.map(function (x) { return x.html; }).join('') +
            '</div></div>' +
          '</div>' });
        });
      }

      // worth a contents page once a volume is long enough to need flipping
      if (vol.list.length >= 12) {
        buildContents(packed, vol, m, avail).forEach(function (html) {
          out.push({ kind: 'contents', html: html });
        });
      }

      /* Openers sit outside the numbering, the way the front matter does. They
         are real leaves and a reader turns past them, but they neither carry a
         number nor advance one — otherwise a volume whose first section has a
         picture would open on an unnumbered leaf and its first printed folio
         would be 2, leaving a book with no page one in it. */
      var folio = 0;
      packed.forEach(function (pageItems) {
        if (pageItems.opener) { out.push({ kind: 'open', html: pageItems.opener }); return; }
        var idx = folio++;

        var first = pageItems.filter(function (x) { return x.r; })[0];
        var sec = first ? first.r.secName : '';

        /* A section whose first recipe fills most of a page on its own leaves
           the heading with nowhere to go: 71 points of heading and a 639-point
           recipe will not share 666 points of page, and no amount of packing
           changes that. Rather than strand a small heading at the top of an
           otherwise blank page, give the section a title page and let it look
           like it was meant. Three sections need one, all of them long-recipe
           ones. */
        if (pageItems.length === 1 && pageItems[0].type === 'band') {
          out.push({
            kind: 'page',
            html: '<div class="pg"><div class="pg-flow sec-open">' + pageItems[0].html + '</div>' +
              '<div class="pg-fol">' + (idx + 1) + '</div></div>'
          });
          return;
        }

        /* Share whatever room is left over between the recipes instead of
           leaving it all in a heap at the foot of the page. Capped, because a
           page holding two recipes has room to spare and pushing them apart
           by all of it would look worse than the gap it fixes. */
        var used = 0, gaps = 0;
        pageItems.forEach(function (x, i) {
          used += x.h;
          if (x.type === 'band') used += m.bandGap;
          else if (i && pageItems[i - 1].type === 'recipe') { used += m.sep; gaps++; }
        });
        var extra = gaps ? Math.max(0, Math.min(28, (avail - used) / gaps)) : 0;

        var body = pageItems.map(function (x, i) {
          if (extra && x.type === 'recipe' && i && pageItems[i - 1].type === 'recipe') {
            return x.html.replace('<div class="rp">',
              '<div class="rp" style="margin-top:' + (m.sepMargin + extra).toFixed(1) + 'px">');
          }
          return x.html;
        }).join('');

        out.push({
          kind: 'page',
          html: '<div class="pg">' +
            '<div class="pg-run"><span>' +
              esc(vol.grouped ? title : BOOKS[first ? first.r.book : vol.book].name) + '</span>' +
              '<span class="pg-run-sec">' + esc(sec) + '</span></div>' +
            '<div class="pg-flow">' + body + '</div>' +
            '<div class="pg-fol">' + (idx + 1) + '</div>' +
          '</div>'
        });
      });

      /* A folded booklet is made of sheets, and a sheet is four pages. Pad with
         blanks so the last one comes out whole — otherwise the printer either
         adds the blanks itself, wherever it likes, or refuses the file. The
         back cover goes last, so the padding sits in front of it, which is
         where a blank page in a book belongs. */
      var sofar = out.length - volStart + 1;              // + the back cover
      for (var pad = (4 - (sofar % 4)) % 4; pad > 0; pad--) {
        out.push({ kind: 'blank', html: blankHTML() });
      }
      out.push({ kind: 'back', html: backCoverHTML(vol, title) });
    });
    return out;
  }

  /* The last word on whether a page fits.
   *
   * The packer works from measured heights and is right about them, but it can
   * be handed something it cannot solve: two of the 271 recipes are taller on
   * their own than a page's text area. There is nowhere to move them to, so the
   * packer put them on a page and the printed page — which is a fixed 7.5in with
   * overflow hidden — quietly ate the difference. What went was the page number,
   * and the bottom margin with it. On screen it never showed, because a screen
   * page is min-height and simply grows.
   *
   * So: after the pages are in the document, measure each one against the paper
   * and set the overrun ones very slightly smaller until they fit. Two or three
   * percent, on two pages in a hundred and forty-two. Re-measured each time
   * rather than calculated, because shrinking type re-wraps it and the height
   * does not fall in proportion.
   */
  /* The gap left on this sheet, measured the way the loop below measures it. */
  function roomFor(pg, flow) {
    var PAPER = 7.5 * 96;
    var pgTop = pg.getBoundingClientRect().top + parseFloat(getComputedStyle(pg).paddingTop);
    var below = 0, seen = false;
    Array.prototype.forEach.call(pg.children, function (c) {
      if (c === flow || c.contains(flow)) { seen = true; return; }
      if (seen) below += c.getBoundingClientRect().height;
    });
    return (pgTop + PAPER) - flow.getBoundingClientRect().top - below;
  }

  function fitToPaper() {
    var PAPER = 7.5 * 96;
    var squeezed = [];
    var over = [];
    /* Measure at true size. On a narrow screen .pg carries
       transform: scale(var(--pgscale)), and getBoundingClientRect reports the
       transformed box — so every page measured smaller than it is against a
       PAPER constant that is not scaled, and nothing was ever found to
       overrun. The first render escaped it because --pgscale is not set until
       afterwards; every render after that was measuring a phantom. The same
       trap is already noted one rule above .pg.no-print in the stylesheet,
       where it was caught for the packer and missed here. */
    var root = document.documentElement;
    var hadScale = root.style.getPropertyValue('--pgscale');
    root.style.setProperty('--pgscale', '1');
    void root.offsetHeight;
    Array.prototype.forEach.call($('pages').querySelectorAll('.pg'), function (pg, i) {
      /* Whatever this page's content lives in — a run of recipes, a cover, a
         title page, a back cover. Any of them can be handed more than fits. */
      var flow = pg.querySelector('.pg-flow, .pg-back, .pg-title-page, .pg-cover');
      if (!flow) return;
      var z = 1;
      for (var tries = 0; tries < 5; tries++) {
        /* Measure the gap rather than adding up the parts: getBoundingClientRect
           leaves margins out, and the running head's 15px bottom margin is
           exactly the sort of thing that makes a page overflow by a hair. */
        var pgTop = pg.getBoundingClientRect().top + parseFloat(getComputedStyle(pg).paddingTop);
        // the folio's own box already includes its padding; do not count it twice
        // anything below the content, such as the folio, is not room
        var below = 0, seen = false;
        Array.prototype.forEach.call(pg.children, function (c) {
          if (c === flow || c.contains(flow)) { seen = true; return; }
          if (seen) below += c.getBoundingClientRect().height;
        });
        var room = (pgTop + PAPER) - flow.getBoundingClientRect().top - below;
        /* The rendered box, not scrollHeight: scrollHeight is in the element's
           own coordinates and does not shrink when zoom does, so each pass
           thought nothing had happened and shrank it again. */
        var h = flow.getBoundingClientRect().height;
        if (h <= room) break;
        if (z <= 0.85) { break; }   // the floor; shrinking further is unreadable
        z = Math.max(0.85, z * ((room / h) - 0.004));
        flow.style.zoom = z;
      }
      if (z !== 1) squeezed.push({ page: i + 1, zoom: Math.round(z * 1000) / 1000 });
      /* Past the floor and still too tall. The slot clips with overflow:hidden,
         so this used to leave the bottom of a recipe off the paper with nothing
         to show for it — you found out at the stove, from a method that stops
         mid-sentence. Say so where somebody is about to press print. */
      if (flow.getBoundingClientRect().height > roomFor(pg, flow) + 0.5) {
        over.push(i + 1);
      }
    });
    if (hadScale) root.style.setProperty('--pgscale', hadScale);
    else root.style.removeProperty('--pgscale');
    if (squeezed.length && window.console) {
      console.log('set slightly smaller to fit the page: ' +
        squeezed.map(function (s) { return 'p' + s.page + ' at ' + s.zoom; }).join(', '));
    }
    return { squeezed: squeezed, over: over };
  }

  function renderBook() {
    var t0 = performance.now();
    var pages = buildBook();
    var pool = printPool();
    renderDownloads();
    /* How many recipes, and how much paper. It used to also report the average
       recipes a page, which is a number that came out of the packer rather than
       a number anyone standing at a printer needs. */
    $('printNote').textContent = pool.length
      ? pool.length + (pool.length === 1 ? ' recipe · ' : ' recipes · ') +
        pages.length + ' pages at 5.5″ × 8.5″'
      : 'Nothing to print yet.';
    /* Each sheet is labelled on screen with where it falls in the run. The
       preview scrolls under a sticky header that is a fifth of a phone screen
       tall, so the top of every page slides out of sight as you reach it, and
       a book with no visible page numbers gives a reader no way to tell a page
       break from something that has been cut off. Saying "Sheet 7 of 104"
       above the paper answers that without changing the paper.

       .no-print, because it is scaffolding around the book and not part of
       it. */
    var total = pages.length;
    $('pages').innerHTML = pages.map(function (p, i) {
      return '<div class="pgslot-wrap">' +
        '<div class="pglabel no-print">Sheet ' + (i + 1) + ' of ' + total + '</div>' +
        '<div class="pgslot">' + p.html + '</div>' +
      '</div>';
    }).join('');
    var fitted = fitToPaper();
    /* Appended rather than folded into the line above, because the fitting can
       only run once the pages are on screen and the line is written before
       that. A page past the floor is clipped by the slot's overflow:hidden, so
       without this the foot of a recipe simply is not there — found at the
       stove, in a method that stops mid-sentence. */
    if (fitted.over.length) {
      $('printNote').textContent += ' · too long for the sheet on page ' +
        fitted.over.join(', ') + ' — the foot of it will not print';
    }
    fitPages();
    if (window.console && performance.now() - t0 > 1200) {
      console.log('book render took ' + Math.round(performance.now() - t0) + 'ms');
    }
  }

  /* How tall the header is, for anything that has to sit under it.
   *
   * CSS cannot ask another element for its height, so the section dividers
   * carried the answer as a number: top: 56px. That was a guess at one
   * viewport and wrong at all of them — 60 on a laptop, so four pixels of the
   * divider hid behind the header, and 94 on a phone, where the brand and the
   * tabs stack, so the divider pinned nearly forty pixels underneath and was
   * simply invisible. It read as a feature that had not been built for
   * mobile.
   *
   * Measured on load and on every resize, which is also when it changes: the
   * only thing that alters the header's height is the width it has. */
  function syncStick() {
    var tb = document.querySelector('.topbar');
    if (!tb) return;
    document.documentElement.style.setProperty(
      '--topbar-h', Math.round(tb.getBoundingClientRect().height) + 'px');
  }

  /* ---- My Day's readout, folding with the scroll ----

     Once the page has scrolled, the week and the four bars give way to one
     row of pills, so the card stops eating a third of a phone while you are
     down among the plates.

     It used to be a switch. At a threshold the open half was set to
     display:none and the pills appeared in its place — which is a hard
     on/off that nothing can animate, and which needed a second threshold
     lower down so that the fold and the unfold could not chase each other
     across the same line.

     It is a fraction now. `p` is how far shut the card is, taken straight
     from the scroll position: 0 at the top, 1 once you have scrolled one
     readout's worth. The card closes under the finger at the speed of the
     scroll, and since p is a pure function of scrollY — the same y always
     gives the same card — there is no threshold left anywhere for the two
     states to flap across.

     The distance is the height the fold takes out, which is what makes the
     card's bottom edge sit still: for every pixel you scroll the card loses
     a pixel, so the first plate stays glued to the underside of it the
     whole way down instead of sliding out from behind it.

     Two things make it safe to do this on every frame.

     THE PAGE MUST NOT MOVE. The height the fold takes out of the card goes
     into the card's bottom margin, so everything below keeps its page
     position and nothing has to be compensated for. Margin is the right
     place for it because margin has no background and takes no taps: the
     plates scroll up through that gap and can be read and pressed there.

     AND NOTHING IS MEASURED DURING A FRAME. The geometry is taken once,
     while the card is open and still, and every frame after that is four
     writes and no reads. Chromium's scroll anchoring answers a height
     change above the anchor by moving the scroll position; a measurement
     taken between two writes sees that compensation and reports a lie,
     which is how the old fold ended up chasing its own tail. Nothing is
     read, so there is nothing to be lied to about. */
  var foldRaf = 0;
  var foldGeo = null;   // the two heights; thrown away when the card is rebuilt
  var foldGap = -1;     // the room under the card; a fact about the stylesheet

  function mFoldForget() { foldGeo = null; }

  /* Someone who has asked for less motion gets the switch back. The fold
     still happens — it is what makes the card small — but it happens all at
     once, with the two thresholds that keep an instant fold from chasing
     itself. */
  function mReduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function mFoldGeo() {
    if (foldGeo) return foldGeo;
    var fold = $('macroFold'), pills = $('macroPills');
    if (!fold || !pills) return null;
    /* Measured at the fold's NATURAL height, fractions and all. scrollHeight
       and offsetHeight are whole numbers, and a box whose real height is
       174.5 measures as 175 — half a pixel the lock never gives back, which
       is a pixel of page appearing and disappearing under the finger in the
       middle of a fold. So ask the layout, not the content.
     *
       If the box happens to be clipped right now, uncover it for the reading
       and put it straight back. Nothing is painted in between: this is one
       synchronous burst inside a single task, and it happens once per
       rebuild rather than once per frame. */
    var was = fold.style.height;
    if (was) fold.style.height = '';
    var open = fold.getBoundingClientRect().height;
    var shut = pills.getBoundingClientRect().height;
    if (was) fold.style.height = was;
    /* A tab that is not on screen measures nothing. Don't remember that as
       the size of the card — a span of zero folds it shut on the first
       pixel of the next scroll.
     *
       And nothing bigger than the screen is a reading either. This card is a
       header: it is a couple of hundred pixels on the tallest phone, and a
       measurement claiming otherwise was taken of something that was not the
       card — mid-layout, mid-rotation, or mid-whatever a browser does that
       this code has not met yet. The number goes into a margin, and a margin
       taken from a bad number is a screenful of blank paper with the day
       somewhere above it. Refusing to remember it costs one frame unfolded;
       believing it costs the tab. */
    if (open <= 0 || open > window.innerHeight) return null;
    foldGeo = { open: open, shut: shut,
      span: Math.max(1, Math.min(open - shut, window.innerHeight)) };
    return foldGeo;
  }

  /* `.shrunk` marks the far end of the fold, and is written only when it
     actually changes: a class attribute set to the value it already had is
     still a change to anything watching the card, and this runs on every
     frame of every scroll. */
  function mMarkShut(st, on) {
    if (on !== st.classList.contains('shrunk')) st.classList.toggle('shrunk', on);
  }

  function mSetFold(st, p) {
    var fold = $('macroFold'), pills = $('macroPills');
    if (!fold || !pills) return;
    if (p <= 0) {
      /* Open: hand every inline value back, so the card is laid out by the
         stylesheet again and whatever we measure next is a clean number.
         Only when there is something to hand back, though: at the top of the
         page this runs on every scroll event, and writing the same class and
         the same styles over and over is work nobody asked for — and a class
         written to the value it already had still counts as a change to
         anything watching the card. The margin stands for the set: all four
         are written together and cleared together. */
      mMarkShut(st, false);
      if (st.style.marginBottom) {
        st.style.removeProperty('--fold');
        st.style.marginBottom = '';
        fold.style.height = '';
      }
      /* The room under the card: its own bottom margin collapses with the
         top margin of the card below it, so the 4px in the stylesheet is not
         what actually stands between them — and the margin we write from it
         is never smaller, so from then on it is ours that wins the collapse.
       *
         It has to be measured rather than read off the two margins, because
         what collapses here is not just those two — the card below hands its
         own child's top margin outward — so the space that ends up between
         them is not a number written anywhere in the stylesheet.
       *
         But it is only measurable AT THE TOP OF THE PAGE, and that guard is
         the whole point of this block. The card is position:sticky: the
         moment the page has scrolled it is pinned to the top of the screen
         and nowhere near its place in the flow, so "the distance down to the
         next card" stops being a margin and becomes most of the page. Blake
         got a blank My Day out of exactly that — a resize handler re-measured
         this while he was scrolled, and each wrong gap went into a margin
         that made the next reading wronger still: 12px became 2164px in two
         resizes, and the day became two thousand pixels of blank paper below
         the plates. A phone resizes constantly while you scroll, because iOS
         collapses the URL bar.
       *
         So: only at the top, only while none of our own inline margin is on
         the card to be read back, once, and clamped — a gap is a margin, so
         it is small or it is wrong. */
      if (foldGap < 0 && !st.style.marginBottom &&
          (window.scrollY || window.pageYOffset || 0) <= 0) {
        /* Whatever actually follows the card, rather than a card named here:
           the plan card that used to sit there has been folded into the
           weigh-in, and a gap measured against a node that no longer renders
           is a gap of zero and an eight-pixel step on every fold. */
        var next = st.nextElementSibling;
        // a tab that is not on screen has no gap to read; wait for one that has
        if (next && st.getBoundingClientRect().height > 0) {
          foldGap = Math.max(0, Math.min(64,
            next.getBoundingClientRect().top - st.getBoundingClientRect().bottom));
        }
      }
      return;
    }
    var g = mFoldGeo();
    if (!g) return;
    /* No honest gap, no fold. This line used to fall back to the card's own
       computed bottom margin, which is THE MARGIN THIS CODE WROTE ON THE LAST
       FRAME — so once the app opened already scrolled, and the gap therefore
       never got its one honest reading at the top, every frame read back its
       own output and added to it. 183px became 37,691px in under two seconds,
       the page grew with it, and My Day was a screenful of blank paper with
       the day far above. That is the bug Blake saw on a phone and then on a
       MacBook: "it was like the app had scrolled WAY WAY WAY far away".
     *
       There is no safe fallback here, because every number within reach at
       this moment is downstream of something we wrote. So there is none: the
       card simply stays open until the top of the page has been seen once,
       which takes one scroll and costs nothing but a fold that waits. */
    if (foldGap < 0) return;
    var gap = foldGap;
    st.style.setProperty('--fold', String(p));
    /* The box loses `p * span` and the margin below gives back exactly that
       much. The sum is the same at every p, which is the whole trick: the
       page is one height all the way down, so nothing under the card moves
       and there is nothing for scroll anchoring to answer. */
    /* Unrounded, and paired: what the box gives up, the margin takes back, so
       the two always add to the same number. Rounding either one on its own
       is what puts them a pixel apart. */
    var give = g.span * p;
    /* The last gate before it reaches the page. Everything above bounds the
       measurement; this bounds the CONSEQUENCE, because the failure this
       guards against has now happened twice and both times it looked the
       same from the outside: a My Day of blank paper with the day scrolled
       off the top of it. A fold that hands back more than a screen has got
       its sums wrong whatever the reason, and the honest answer to a sum
       this code cannot trust is to stop folding and show the day. */
    if (!(give >= 0) || give > window.innerHeight) {
      foldGeo = null;
      mMarkShut(st, false);
      st.style.removeProperty('--fold');
      st.style.marginBottom = '';
      fold.style.height = '';
      return;
    }
    fold.style.height = (g.open - give) + 'px';
    st.style.marginBottom = (gap + give) + 'px';
    mMarkShut(st, p >= 1);
  }

  function syncShrunk() {
    foldRaf = 0;
    var st = document.querySelector('.mday-stick');
    if (!st) return;
    /* Leaving My Day unfolds its readout, so coming back starts at the top
       with the bars open rather than with a fold left over from last time. */
    if (S.view !== 'macros') { mSetFold(st, 0); return; }
    var g = mFoldGeo();
    if (!g) return;
    var y = window.scrollY || window.pageYOffset || 0;
    var p = y / g.span;
    if (p < 0) p = 0; else if (p > 1) p = 1;
    if (mReduced()) p = st.classList.contains('shrunk') ? (y < 60 ? 0 : 1) : (y > g.open ? 1 : 0);
    mSetFold(st, p);
  }

  function onScrollShrink() {
    if (foldRaf) return;
    foldRaf = requestAnimationFrame(syncShrunk);
  }

  /* A resize changes the two heights — a narrower card wraps to more rows —
     and it can arrive without a scroll to follow it.
   *
     It does NOT touch the gap. The gap is two margins in the stylesheet, and
     those do not move when the window does; throwing it away here is what
     made a phone re-measure it mid-scroll, which is the whole story written
     against the reading of it above. A resize on a phone is usually not even
     a resize: it is the URL bar collapsing while you scroll. */
  function onResizeFold() {
    if (!document.querySelector('.mday-stick')) return;
    foldGeo = null;
    syncShrunk();
  }

  /* A 5.5in page is wider than a phone. Scale it down to fit rather than
     letting the whole document scroll sideways. Printing ignores this. */
  function fitPages() {
    var avail = document.documentElement.clientWidth - 32;
    var pageW = 5.5 * 96;
    var scale = window.innerWidth <= 860 ? Math.min(1, avail / pageW) : 1;
    document.documentElement.style.setProperty('--pgscale', String(scale));
  }

  function expandAndPrint() { window.print(); }

  /* The books are rendered to PDF ahead of time by tools/print-books.js and
     shipped with the app, so getting a printable file is a download rather than
     an argument with the print dialog about paper size, margins, headers and
     scaling. The dialog is still there for the selections that cannot be made
     ahead of time — your favorites, this week, and recipes of your own. */
  var READY_MADE = {
    all: { file: 'Both-Books.pdf', label: 'Both books', pages: 240 },
    one: { file: 'Hive-and-Hearth-Recipes.pdf', label: 'One book', pages: 236 },
    1: { file: 'Run-and-Not-Be-Weary.pdf', label: 'Run and Not Be Weary', pages: 104, booklet: true },
    2: { file: 'Around-the-Table.pdf', label: 'Around the Table', pages: 136, booklet: true }
  };

  /* The shelf, in the order somebody chooses from it: the whole thing first,
     then the two volumes, then the two you assemble yourself. */
  var PRINT_CARDS = [
    { set: 'all', what: 'Both books', sub: 'Two booklets' },
    { set: 'one', what: 'Everything in one', sub: 'One spine' },
    { set: '1', what: 'Run and Not Be Weary', sub: 'Volume One' },
    { set: '2', what: 'Around the Table', sub: 'Volume Two' },
  ];

  /* And the three that are not books.
   *
   * These were cards on the shelf beside the covers, at the same size and with
   * the same weight, and they were the worst thing on the screen: a numeral in
   * a dashed box reads as a picture that failed to load, and "Pick to print"
   * next to "Nothing picked yet" is two different dead states side by side.
   * They are not books and should not be book-shaped. A line of text under the
   * shelf says what they are and costs nothing. */
  var PRINT_PICKED = [
    { set: 'fav', what: 'Favorites' },
    { set: 'plan', what: null },
    { set: '3', what: 'Ours' }
  ];

  function renderDownloads() {
    /* The ready-made files were rendered from the printed collection and know
       nothing about a recipe somebody wrote last week or a printed one they
       corrected. The preview counts those in, so the two disagree silently —
       a preview saying 168 pages over a button offering 160, and whoever
       pressed it got a book without their own recipes in it and no word about
       why. Said once, under the shelf, rather than on every cover. */
    var own = Object.keys(window.Store.state.mine || {}).length +
      Object.keys(window.Store.state.edits || {}).length;
    var mine = Object.keys(window.Store.state.mine || {}).length;
    var favs = RECIPES.filter(function (x) { return window.Store.isFav(x.id); }).length;
    /* planIds(), not planCount() — planCount takes a week id and answers 0 for
       undefined, so the card said "Nothing picked yet" over a week with
       recipes in it. */
    var week = planIds().length;

    $('printRows').innerHTML = PRINT_CARDS.map(function (c) {
      var r = READY_MADE[c.set];
      if (!r) return '';
      var on = S.printSet === c.set;

      /* The cover shows it; the button under it hands it over.
       *
       * The card was the download to begin with — one tap, one file — and that
       * is a tap that does something irreversible-looking to somebody who only
       * wanted a closer look. Picking a book and taking it are two different
       * intentions, so they are two different controls: the cover selects, the
       * preview below redraws, and the button says what you get. */
      return '<div class="bk-slot">' +
        '<button type="button" class="bk-card' + (on ? ' on' : '') + '"' +
        ' data-print="' + esc(c.set) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        '<span class="bk-face">' +
          '<img class="bk-cover" src="art/covers/' + esc(c.set) + '.webp" alt="" loading="lazy">' +
        '</span>' +
        '<span class="bk-what">' + esc(c.what) + '</span>' +
        '<span class="bk-sub">' + esc(c.sub) + '</span>' +
      '</button>' +
      '<a class="bk-get" download href="print/' + esc(r.file) + '" data-get="' + esc(c.set) + '">' +
        'PDF &middot; ' + r.pages + ' pages</a>' +
      /* The folded version hangs below: a second thing to do with the same
         book, wanted by far fewer people. */
      (r.booklet
        ? '<a class="bk-fold" download href="print/' +
            esc(r.file.replace(/\.pdf$/, '-booklet.pdf')) + '" data-fold="' + esc(c.set) + '" ' +
            'title="Two pages to a sheet, in folding order — print double-sided, fold, staple">' +
            'fold &amp; staple &middot; ' + (r.pages / 4) + '</a>'
        : '') +
      '</div>';
    }).join('');

    /* The picked sets: one line, no covers. Each says how many are in it, so
       the count that used to be a numeral in a box is still there — as a fact
       in a sentence rather than as a picture of nothing. */
    $('printPicked').innerHTML = PRINT_PICKED.map(function (c) {
      if (c.set === '3' && !mine) return '';
      var n = c.set === 'fav' ? favs : c.set === 'plan' ? week : mine;
      var what = c.what === null ? window.Store.activeWeek().name : c.what;
      var on = S.printSet === c.set;
      return '<button type="button" class="pk' + (on ? ' on' : '') + '"' +
        ' data-print="' + esc(c.set) + '" aria-pressed="' + (on ? 'true' : 'false') + '"' +
        (c.set === 'plan' ? ' id="printPlan"' : '') +
        (c.set === '3' ? ' id="printOurs"' : '') + '>' +
        esc(what) + '<span class="pk-n">' + n + '</span></button>';
    }).join('') +
      /* The dialog is the only way to get these, and it prints whatever is laid
         out below — so it appears once the set is chosen, not before. Offering
         it beside an unchosen set would print the wrong book onto real paper. */
      (READY_MADE[S.printSet] ? '' :
        '<button type="button" class="ghost pk-go" id="doPrint">Print&hellip;</button>');

    $('dlOwn').classList.toggle('hide', !own);
    if (own) {
      $('dlOwn').textContent = 'The covers are the published books. The ' + own +
        (own === 1 ? ' recipe you have written or corrected is' :
                     ' recipes you have written or corrected are') +
        ' not in them — use Ours or Favorites below to print a copy that has them.';
    }

    /* Only where it makes sense to offer. Somebody printing this week's plan
       is printing four pages for the fridge, and being asked fifty dollars for
       a bound book at that moment reads as not paying attention. */
    $('orderBook').classList.toggle('hide', !READY_MADE[S.printSet]);
    var dp = $('doPrint');
    if (dp) dp.addEventListener('click', expandAndPrint);
  }

  // --------------------------------------------------------------- detail
  /* The nutrition panel.
   *
   * The score is a sum of five things, and a sum tells you nothing about which
   * of the five it came from — a 60 that is short on sodium and a 60 that is
   * short on protein are different dinners. So show the parts: what each one
   * measured, how much of it the recipe earned, and a bar you can read without
   * doing the division. The bar takes its colour from its own share, so the
   * component that is dragging the score down is the one that looks different.
   */
  /* The maxima come from the scorer, which is where the weights are decided.
     They were written out again here, and a weight changed in one place and
     not the other draws every bar in the panel against the wrong length —
     silently, and looking perfectly reasonable. */
  var W = (window.Nutrition && window.Nutrition.MAX) ||
    { p: 27, k: 18, f: 8, s: 22, b: 13, c: 12 };

  /* ------------------------------------------------------------------------
   * One recipe pointing at another.
   *
   * Nine steps already did this — "No packet? Recipe 265, browned dark, does
   * the same job" — and every one of them had the number typed into the
   * sentence. Which worked exactly until the collection was renumbered, at
   * which point all ten sent the reader to the wrong page, silently, in the
   * printed book. Recipe 265 became recipe 270 and nothing said so.
   *
   * So a step writes {r:265} — the id, which never moves — and the number is
   * filled in where the sentence is drawn, from the same table the contents
   * page is built from. In print it reads "Recipe 270". In the app it is the
   * same words and you can press them.
   * --------------------------------------------------------------------- */
  function xref(text, live) {
    return String(text).replace(/\{r:(\d+)\}/g, function (whole, id) {
      var t = BY_ID[id];
      /* A reference to something that is not there any more. Better a sentence
         that reads a little short than one that sends somebody looking for a
         page that does not exist. */
      if (!t) return 'another recipe';
      var label = 'Recipe ' + String(t.no || t.id).padStart(3, '0');
      if (!live) return label;
      return '<button class="xref" data-open="' + esc(t.id) + '" ' +
        'title="' + esc(t.name) + '">' + esc(label) + '</button>';
    });
  }

  /* Steps carry markup only where xref put it, so the text is escaped first
     and the reference substituted after — never the other way round. */
  function stepHTML(t) { return xref(esc(t), true); }

  /* "Better with a few extras".
   *
   * Everything above this block comes off the storehouse order, and the recipe
   * has to be worth cooking with only that — the whole promise of the book is
   * that the order is enough. But most kitchens have a jar of something, and a
   * cook with garlic and a wedge of parmesan should not have to guess where
   * they would go.
   *
   * So: named, numbered from where the method left off, and separate. Never
   * counted in the macros, never on the shopping list. A recipe that needs its
   * lift to be any good is a recipe that has not been written properly yet. */
  function liftHTML(r, live) {
    var L = r.lift;
    if (!L || !L.steps || !L.steps.length) return '';
    var n = (r.steps || []).length;

    /* On paper it is one dense paragraph; on screen it is numbered steps.
       Same words either way — this is typesetting, not a second copy of the
       text. A screen scrolls and a page does not, and the first version of
       this set the alfredo bake 935px tall against 720 of paper, off the
       bottom of its own sheet even squeezed to the floor. Circles and the gaps
       between them are what a page cannot afford. */
    if (!live) {
      return '<div class="lift"><span class="lift-h">Better with</span> ' +
        '<span class="lift-w">' + esc(L.with) + '</span> ' +
        '<span class="lift-p">' + L.steps.map(function (t) {
          return xref(esc(t), false);
        }).join(' ') + '</span></div>';
    }

    return '<div class="lift">' +
      '<div class="lift-h">Better with a few extras</div>' +
      '<div class="lift-w">' + esc(L.with) + '</div>' +
      '<div class="lift-steps">' + L.steps.map(function (t, i) {
        return '<div class="lift-step"><div class="lift-step-n">' + (n + i + 1) + '</div>' +
          '<div class="lift-step-t">' + xref(esc(t), true) + '</div></div>';
      }).join('') + '</div>' +
    '</div>';
  }

  /* An ingredient this collection has a recipe for.
   *
   * Fifty ingredient lines name something Made, Not Bought produces, and the
   * only version of this that scales is the ingredient line carrying the link
   * itself. The alternative was fifty hand-written sentences, which is the
   * same paragraph printed fifty times and still silent on the fifty-first.
   *
   * Not shown inside Made, Not Bought: a tortilla recipe pointing at the
   * tortilla recipe is noise, and so is the gravy telling you where to get
   * gravy. */
  function makerFor(r, ix) {
    var M = window.MAKERS;
    var it = (r.ingp || [])[ix];
    if (!M || !it || !it.k) return null;
    var id = M[it.k];
    if (!id || id === r.id) return null;
    var t = BY_ID[id];
    return t && t.secName !== r.secName ? t : null;
  }

  /* Rendered small and after the line rather than around it, because the
     ingredient is what somebody is reading down the column for. On paper it is
     the number alone — there is nothing to press, and "Recipe" in front of it
     four times in one list is four words nobody needs. */
  function makerHTML(r, ix, live) {
    var t = makerFor(r, ix);
    if (!t) return '';
    var num = String(t.no || t.id).padStart(3, '0');
    if (!live) return ' <i class="ing-make">' + num + '</i>';
    return ' <button class="ing-make" data-open="' + esc(t.id) + '" ' +
      'title="' + esc('Make it yourself: ' + t.name) + '">' + num + '</button>';
  }

  function scoreParts(r) {
    return [
      { k: 'Protein', ab: 'Prot', v: r.sc.pPct + '%', p: r.sc.p, max: W.p, t: r.sc.pPct + '% of the calories come from protein' },
      { k: 'Calories', ab: 'Cal', v: r.macro.kcal, p: r.sc.k, max: W.k, t: r.macro.kcal + ' kcal a serving' },
      { k: 'Fat', ab: 'Fat', v: r.sc.fPct + '%', p: r.sc.f, max: W.f, t: r.sc.fPct + '% of the calories come from fat' },
      { k: 'Sodium', ab: 'Sod', v: r.sc.na + ' mg', p: r.sc.s, max: W.s, t: r.sc.na + ' mg of sodium a serving' },
      { k: 'Fiber', ab: 'Fib', v: r.sc.fib + ' g', p: r.sc.b, max: W.b, t: r.sc.fib + ' g of fiber a serving' },
      /* Named for what it measures rather than for carbohydrate, because
         carbohydrate is not what costs the points. A recipe can be most of the
         way to a hundred grams of it and lose nothing here, so long as the
         fiber came with it. */
      { k: 'Refined carbs', ab: 'Carb', v: r.sc.cPct + '%', p: r.sc.c, max: W.c,
        t: r.sc.cPct + '% of the calories are carbohydrate with no fiber beside it' }
    ];
  }

  function nutritionHTML(r) {
    if (r.score === null || !r.sc) return '';

    /* Shut, this is a score and a line of figures. No chart: a bar you have to
       decode is not a summary, and every version that tried to be both ended up
       taller than the recipe it belonged to.

       The reasoning lives behind the leaf, where it can afford to be legible —
       one part per row, what the recipe actually did, how far that got it, and
       a bar you can read across at a glance. Nobody is charged for it until
       they ask, and the leaf is what they will press when they wonder. */
    var parts = scoreParts(r);
    var bandOf = function (c) {
      var share = c.max ? c.p / c.max : 0;
      return share >= 0.8 ? 'good' : share >= 0.45 ? 'ok' : 'low';
    };

    /* Each track is the same length and fills by the share of that part's
       points the recipe earned, so six rows can be compared straight down the
       column. What each part is worth is in the number beside it — tracks
       scaled to the weights made fat, at ten points, too short to read. */
    var why = S.why
      ? '<div class="nut-why">' +
          '<div class="why-head">Why ' + r.score + ' out of 100</div>' +
          parts.map(function (c) {
            var b = bandOf(c);
            return '<div class="why-part">' +
              '<div class="why-top">' +
                '<b>' + esc(c.k) + '</b>' +
                '<span class="why-fact">' + esc(c.t) + '</span>' +
                '<span class="why-pts wp-' + b + '">' + c.p + '<u>/' + c.max + '</u></span>' +
              '</div>' +
              '<div class="why-bar"><i class="nb-' + b + '" style="width:' +
                ((c.max ? c.p / c.max : 0) * 100).toFixed(1) + '%"></i></div>' +
            '</div>';
          }).join('') +
          '<div class="why-note">Protein and fiber earn points. Calories, fat, ' +
            'sodium and refined carbs spend them. A gram of fiber covers ten ' +
            'grams of carbohydrate, so oats cost nothing here and sugar costs ' +
            'the lot. Every figure is an estimate from a food table, not a ' +
            'label.</div>' +
        '</div>'
      : '';

    var m = r.macro;
    return '<div class="nut nut-' + scoreBand(r.score) + (S.why ? ' nut-open' : '') + '">' +
      /* The leaf is the control. It is the thing you are already looking at
         when you wonder why, so it is the thing that answers. */
      '<button class="nut-leaf" data-why aria-expanded="' + (S.why ? 'true' : 'false') +
        '" title="' + (S.why ? 'Hide the breakdown' : 'Why this score?') + '">' +
        leaf(r.score, 'leaf-big') +
      '</button>' +
      '<div class="nut-body">' +
        why +
        /* Whole grams. These are estimates off a food table, so 28.5g of protein
           claims a precision that is not there — and the half gram was the
           difference between one line and two on a phone. Fiber keeps its
           decimal below a gram, where rounding would print 0.2g as none. */
        '<div class="nut-foot" title="' + esc(m.kcal + ' kcal, ' + m.p + 'g protein, ' +
          m.c + 'g carbohydrate, ' + m.f + 'g fat, ' + m.na + ' mg sodium, ' + m.fib + 'g fiber') + '">' +
          [m.kcal + ' kcal', Math.round(m.p) + 'g P', Math.round(m.c) + 'g C',
            Math.round(m.f) + 'g F', m.na + 'mg S',
            (m.fib < 1 ? m.fib : Math.round(m.fib)) + 'g Fib']
            .map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('<i>&middot;</i>') +
        '</div>' +
        /* A leaf gives no sign it can be pressed, and a control nobody finds is
           a control nobody has. Shut, there is room to spare under the leaf, so
           saying it in words costs nothing. */
        '<button class="nut-ask" data-why aria-expanded="' + (S.why ? 'true' : 'false') + '">' +
          (S.why ? 'Hide the breakdown' : 'Why this score?') +
        '</button>' +
      '</div>' +
    '</div>';
  }

  /* ------------------------------------------------------------ focus
   * Keeping the keyboard where the hands left it.
   *
   * Every control in here changes state and then re-renders its whole
   * container with innerHTML, which throws away the element that was pressed.
   * With a mouse nobody notices. On a keyboard the focus falls to the body, so
   * ticking one thing off the shopping list means tabbing back through
   * everything above it to reach the next — and the same for scaling a recipe,
   * changing units, or opening the breakdown.
   *
   * The control is found again by its own data attributes, which are what make
   * it that control rather than another one: the tick for milk is
   * [data-check="milk"] before the render and after it.
   */
  var FOCUS_ATTRS = ['data-check', 'data-add', 'data-day', 'data-fav', 'data-why',
    'data-scale', 'data-units', 'data-sync', 'data-edit', 'data-open', 'data-close',
    'data-poff', 'data-week', 'data-neww', 'data-mult', 'data-drop', 'data-ed', 'data-tab',
    'data-mslot', 'data-meat', 'data-mstep', 'data-mdel', 'data-mpick', 'data-mtarg', 'data-mlock', 'data-mpin', 'data-mtry', 'data-mdot', 'data-medit', 'data-mskip',
    'data-mtsex', 'data-mtgoal', 'data-mtedit', 'data-mtsec', 'data-mtfree', 'data-mtuse', 'data-mysync', 'data-mpnew', 'data-nf', 'data-nfpick', 'data-scan',
    'data-mmore', 'data-mpmode', 'data-mbstep', 'data-mpdone', 'data-mweek', 'data-mfold', 'data-mtrain', 'data-mtdee', 'data-mpfav', 'data-mline', 'data-mchart', 'data-mchartopen', 'data-mpslot', 'data-mbal', 'data-mkeep', 'data-mkdo', 'data-mfood', 'data-mpills'];

  function focusKey(el) {
    if (!el || el === document.body || !el.getAttribute) return null;
    var parts = [];
    FOCUS_ATTRS.forEach(function (a) {
      if (el.hasAttribute && el.hasAttribute(a)) {
        parts.push('[' + a + '="' + String(el.getAttribute(a)).replace(/"/g, '\\"') + '"]');
      }
    });
    if (parts.length) return parts.join('');
    return el.id ? '#' + el.id : null;
  }

  /* Which control opened the overlay that is up. Focus is moved into a sheet
     when it opens and Escape closes it — both already true — but closing it
     dropped the keyboard on the body, so leaving a recipe meant tabbing back
     down the whole collection to reach the card you had just been on. */
  var opener = null;
  function rememberOpener() { opener = focusKey(document.activeElement); }
  function restoreOpener() {
    if (!opener) return;
    var el;
    try { el = document.querySelector(opener); } catch (e) { el = null; }
    opener = null;
    if (el && el.focus) el.focus();
  }

  function keepingFocus(fn) {
    var key = focusKey(document.activeElement);
    fn();
    if (!key) return;
    var back;
    try { back = document.querySelector(key); } catch (e) { back = null; }
    if (back && back.focus) back.focus();
  }

  function renderModalInner() {
    /* Read by the service-worker reload in index.html, which must not throw
       away a recipe somebody is in the middle of typing. */
    window.__editing = !!S.editId;
    var root = $('modalRoot');

    // a re-render triggered by a sync update should not scroll the sheet back
    // to the top, lose a half-typed code, or reroll the suggested one
    var prev = root.querySelector('.scrim');
    var keepScroll = prev ? prev.scrollTop : 0;
    var draft = root.querySelector('#joinCode');
    if (draft) S.joinDraft = draft.value;
    // same bargain for the picker's search: a sync emit must not eat the query
    var mq = root.querySelector('#mpSearch');
    if (mq) S.mpQuery = mq.value;

    /* Re-rendering the editor would throw away half-typed text, so it is drawn
       once when it opens and left alone; the only thing that redraws is the
       nutrition preview under the ingredients. */
    if (S.editId) {
      if (!prev || !prev.querySelector('.ed-sheet')) {
        root.innerHTML = editorHTML();
        document.body.style.overflow = 'hidden';
        var nm = root.querySelector('#edName');
        if (nm) nm.focus();
      }
      return;
    }

    if (S.syncOpen) {
      root.innerHTML = syncHTML();
      document.body.style.overflow = 'hidden';
      var j = root.querySelector('#joinCode');
      if (j) j.value = S.joinDraft;
      if (keepScroll) root.querySelector('.scrim').scrollTop = keepScroll;
      return;
    }

    if (S.newFood) {
      if (!prev || !prev.querySelector('#nfName')) {
        root.innerHTML = mNewFoodHTML();
        document.body.style.overflow = 'hidden';
        var nn = root.querySelector('#nfName');
        if (nn) nn.focus();
      }
      return;
    }

    if (S.keepMeal) {
      if (!prev || !prev.querySelector('#mkName')) {
        root.innerHTML = mKeepHTML();
        document.body.style.overflow = 'hidden';
        var mk = root.querySelector('#mkName');
        if (mk) mk.focus();
      }
      return;
    }

    if (S.chartOpen) {
      root.innerHTML = macroChartHTML();
      document.body.style.overflow = 'hidden';
      if (keepScroll) root.querySelector('.scrim').scrollTop = keepScroll;
      return;
    }

    if (S.foodOpen) {
      root.innerHTML = mFoodSheetHTML();
      if (!root.innerHTML) { S.foodOpen = null; }       // the food is gone; nothing to show
      else {
        document.body.style.overflow = 'hidden';
        if (keepScroll) root.querySelector('.scrim').scrollTop = keepScroll;
        return;
      }
    }

    if (S.macroPick) {
      /* The camera is a live device, not markup: re-rendering the sheet
         underneath it would tear down the stream and start a second one on
         every keystroke elsewhere. So scan mode is drawn once, and left. */
      var already = prev && prev.querySelector('#scanVid');
      if (!(S.mpMode === 'scan' && already)) {
        root.innerHTML = macroPickerHTML();
        document.body.style.overflow = 'hidden';
        if (keepScroll) root.querySelector('.scrim').scrollTop = keepScroll;
        // Scan is a way in, not a button inside one: choosing it opens the lens
        if (S.mpMode === 'scan' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          mScanStart();
        }
        var lk = root.querySelector('#mpLookIn');
        if (lk && S.mpLook) { lk.focus(); lk.setSelectionRange(lk.value.length, lk.value.length); }
      }
      return;
    }

    /* How the day went. Read-only, so unlike the sheets below it there is
       nothing to protect from a redraw — it can be rebuilt whenever. */
    if (S.mDoneOpen) {
      root.innerHTML = mSummaryHTML(S.mDoneOpen);
      document.body.style.overflow = 'hidden';
      root.classList.remove('hide');
      var xb = root.querySelector('.sheet-x');
      if (xb) xb.focus();
      return;
    }

    if (S.macroTargOpen) {
      /* Drawn once and left alone, like the editor: the profile boxes are a
         draft, and a sync emit arriving mid-keystroke must not reset them to
         whatever is saved. */
      if (!prev || !prev.querySelector('.mt-sheet')) {
        root.innerHTML = macroTargetsHTML();
        document.body.style.overflow = 'hidden';
        mtmShowTotal();
      }
      return;
    }

    var r = S.openId ? BY_ID[S.openId] : null;
    if (!r) { root.innerHTML = ''; document.body.style.overflow = ''; return; }
    document.body.style.overflow = 'hidden';

    var f = S.scale;
    var fav = window.Store.isFav(r.id);
    /* fmtNum for every size, not just the halves: a recipe opened from the
       Macros day can arrive at 2½× or ⅝×, and "2.5×" beside quantities
       printed in fraction glyphs read as two different apps. */
    var scaleLabel = fmtNum(f) + '×';

    root.innerHTML = '<div class="scrim no-print" data-close="1">' +
      '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(r.name) + '">' +
        '<div class="sheet-top">' +
          '<div class="sheet-eyebrow">' + esc([BOOKS[r.book].name, r.secName]
            .filter(function (x, i, a) { return i === 0 || x !== a[0]; })
            .concat('No. ' + no(r)).join(' · ')) + '</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="sheet-name">' + esc(r.name) + '</div>' +
        (r.tagline ? '<div class="sheet-tag">' + esc(r.tagline) + '</div>' : '') +
        '<div class="sheet-meta"><span>' + esc(r.time) + '</span><span>' + esc(diffLabel(r.diff)) + '</span>' +
          '<span>' + esc(r.macro ? r.macro.kcal + ' kcal · ' + r.macro.p + 'g protein' : 'No nutrition data') + '</span>' +
        '</div>' +
        nutritionHTML(r) +
        '<div class="sheet-h-row">' +
          /* Both options shown, not just the current one. A single pill reading
             "cups" is indistinguishable from a label — nothing about it says
             there is another state to get to, so it reads as a caption on the
             ingredients rather than a control over them. Showing the pair makes
             the choice visible before it is made. */
          '<div class="sheet-h">Ingredients' +
            '<span class="unitseg" role="group" aria-label="Show ingredients in">' +
              '<button data-units="cups" aria-pressed="' + (S.units === 'cups') + '">cups</button>' +
              '<button data-units="grams" aria-pressed="' + (S.units === 'grams') + '">grams</button>' +
            '</span>' +
          '</div>' +
          '<div class="scaler">' +
            '<span class="sheet-serv">' + esc(r.servings) + '</span>' +
            '<div class="scaler-box">' +
              '<button data-scale="down" aria-label="Halve">&minus;</button>' +
              '<div class="scaler-val">' + scaleLabel + '</div>' +
              '<button data-scale="up" aria-label="Double">+</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="sheet-ing">' + r.ing.map(function (i, ix) {
          return '<div' + (lineNeedsBuying(r, ix) ? ' class="ing-buy"' : '') + '>' +
            esc(S.units === 'grams'
              ? gramIng(i, (r.ingp || [])[ix], f)
              : scaleIng(i, f)) + makerHTML(r, ix, true) + '</div>';
        }).join('') + '</div>' +
        '<div class="sheet-h" style="margin-top:24px;margin-bottom:10px">Method</div>' +
        '<div class="sheet-steps">' + r.steps.map(function (t, i) {
          return '<div class="sheet-step"><div class="sheet-step-n">' + (i + 1) + '</div>' +
            '<div class="sheet-step-t">' + stepHTML(t) + '</div></div>';
        }).join('') + '</div>' +
        liftHTML(r, true) +
        /* The line that answers "do I have to go out for anything?", asked of
           the pantry rather than of the storehouse order the book was written
           against. This is the whole point of the pantry being editable: stop
           keeping salsa verde and every recipe using it starts saying so. */
        (function () {
          var m = missingFor(r);
          if (!m.length) return '';
          return '<div class="sheet-extras">' +
            (window.Store.pantryChanged() ? 'Not on your shelf: ' : 'Needs items not on the standard storehouse list: ') +
            esc(m.join(', ')) + '.</div>';
        })() +
        '<div class="sheet-actions"><div class="sheet-actions-in">' +
          /* Icons, not words. "Save" and "Edit" spelled out took enough of the
             row that the seven days wrapped onto a second line on a phone, and
             the days are the thing this row is for. */
          '<button class="iconbtn" data-fav="' + esc(r.id) + '" aria-pressed="' + fav + '" ' +
            'title="' + (fav ? 'Saved to favorites' : 'Save to favorites') + '" ' +
            'aria-label="' + (fav ? 'Saved to favorites' : 'Save to favorites') + '">' +
            (fav ? '★' : '☆') + '</button>' +
          '<button class="iconbtn" data-edit="' + esc(r.id) + '" title="Edit this recipe" ' +
            'aria-label="Edit this recipe">✎</button>' +
          '<span class="addto">Add to</span>' +
          /* Seven equal columns rather than seven things that wrap. A week that
             breaks across two lines reads as two groups of days, and which days
             land together depends on the width of the phone. */
          '<div class="daybar">' +
            DAYS.map(function (d) {
              var on = window.Store.day(d[0]).some(function (e) { return e.id === r.id; });
              return '<button class="daybtn" data-add="' + esc(r.id) + '" data-day="' + d[0] +
                '" aria-pressed="' + on + '">' + d[2] + '</button>';
            }).join('') +
          '</div>' +
          (f !== 1 ? '<span class="addto addto-x">at &times;' + fmtNum(f) + '</span>' : '') +
        '</div></div>' +
      '</div></div>';

    if (keepScroll) root.querySelector('.scrim').scrollTop = keepScroll;
  }

  // ------------------------------------------------------------- asking
  /* The browser's own prompt() and confirm() work, but on a phone they arrive
     looking like a warning from the browser rather than a question from the
     app, and they cannot be styled or read out sensibly. These are the same
     three questions in the app's own voice. They sit above everything else,
     including the editor, so "delete this recipe?" can be asked while it is
     open. */
  var D = null;

  function ask(opts, done) {
    D = { title: opts.title, body: opts.body || '', value: opts.value,
      ok: opts.ok || 'OK', danger: !!opts.danger, done: done, pushed: !popping };
    pushSheet({ d: 1 });
    renderDialog();
  }

  function closeDialog(answer) {
    var d = D;
    D = null;
    /* The entry this dialog pushed, unwound — unless we are already inside a
       popstate, which is what removed it. */
    if (d && d.pushed && !popping) { depth = Math.max(0, depth - 1); history.back(); }
    renderDialog();
    if (d && d.done) d.done(answer);
  }

  function renderDialog() {
    var root = $('dialogRoot');
    if (!D) { root.innerHTML = ''; return; }
    root.innerHTML = '<div class="scrim dlg-scrim no-print" data-dlg="cancel">' +
      '<div class="dlg" role="dialog" aria-modal="true" aria-label="' + esc(D.title) + '">' +
        '<div class="dlg-t">' + esc(D.title) + '</div>' +
        (D.body ? '<div class="dlg-b">' + esc(D.body) + '</div>' : '') +
        (D.value !== undefined
          ? '<input class="txt" id="dlgInput" value="' + esc(D.value) + '">' : '') +
        '<div class="dlg-a">' +
          '<button class="btn-primary' + (D.danger ? ' danger' : '') + '" data-dlg="ok">' + esc(D.ok) + '</button>' +
          '<button class="ghost" data-dlg="cancel">Cancel</button>' +
        '</div>' +
      '</div></div>';
    var i = $('dlgInput');
    if (i) { i.focus(); i.select(); }
    else root.querySelector('[data-dlg="ok"]').focus();
  }

  function dialogAnswer() {
    var i = $('dlgInput');
    return i ? i.value : true;
  }

  // ------------------------------------------------------------ the editor
  /* A recipe you write is measured exactly as the printed ones were: its
     ingredient lines go through the same parser and the same food table, and
     the score comes out of the same five-part formula. That is what
     data/nutrition.js is — see tools/build-data.js. If the parser cannot place
     an ingredient the panel says which, because a recipe half-priced is worse
     than one not priced at all if you do not know it happened. */
  function measured(form) {
    var N = window.Nutrition;
    var ing = lines(form.ing), steps = lines(form.steps);
    var servN = parseFloat(form.servings) || 1;
    var est = N ? N.nutritionFor(ing, servN, form.extras, N.parseLine, N.FOODS, N.SPICE_NAMES)
      : { perServing: { kcal: 0, p: 0, c: 0, f: 0, na: 0, fib: 0 }, items: [], unmatched: [] };

    var macro = est.perServing;
    var typed = form.kcal !== '' && !isNaN(parseFloat(form.kcal));
    if (typed) {
      macro = {
        kcal: num(form.kcal), p: num(form.p), c: num(form.c), f: num(form.f),
        na: macro.na, fib: macro.fib   // sodium and fiber still come from the ingredients
      };
    }
    var s = macro.kcal > 0 && N ? N.scoreFrom(macro) : null;

    /* No undefined anywhere in here. Firestore refuses a write that carries one
       and takes the whole update down with it, while localStorage quietly drops
       it — so a recipe that saved perfectly well on one device would fail to
       reach the other, and only the sync test would ever have found out. */
    var rec = {
      id: form.id,
      book: form.book, secNum: form.secNum,
      secName: form.secName || 'Ours',
      name: form.name || 'Untitled',
      servings: form.servings || '1 Serving', servN: servN,
      ing: ing, steps: steps, ingp: est.items,
      macro: macro, tagline: form.tagline !== undefined ? form.tagline : null,
      score: s ? s.score : null, sc: s ? s.sc : null,
      diff: form.diff || 'Easy', time: form.time || '',
      extras: form.extras || null,
      est: !typed, own: !!form.own
    };
    if (est.unmatched.length) rec.unpriced = est.unmatched;
    return rec;
  }

  function lines(s) {
    return String(s || '').split('\n').map(function (x) { return x.trim(); })
      .filter(function (x) { return x.length; });
  }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? Math.round(n) : 0; }

  function editorForm() {
    // whatever is on screen right now, so the preview can follow the typing
    var g = function (id) { var e = $(id); return e ? e.value : ''; };
    var base = S.editBase || {};
    return {
      id: base.id, book: base.book, secNum: base.secNum, own: base.own,
      name: g('edName'),
      /* The Section field is only drawn for a recipe you wrote, so on a
         printed one g() found no element and returned '' — which measured()
         then read as "no section given" and replaced with 'Ours'. Correcting a
         typo in No. 12 moved it out of its own section and into yours. */
      secName: $('edSection') ? g('edSection') : (base.secName || ''),
      /* Same shape of loss: the tagline is not on the form at all, and
         measured() used to hard-code it to null, so editing a printed recipe
         threw away the line under its name on every card. */
      tagline: base.tagline,
      servings: g('edServings'),
      time: g('edTime'), diff: g('edDiff'), ing: g('edIng'), steps: g('edSteps'),
      extras: g('edExtras'), kcal: g('edKcal'), p: g('edP'), c: g('edC'), f: g('edF')
    };
  }

  function editorHTML() {
    var b = S.editBase;
    var own = !!b.own;
    var preview = S.editPreview;
    var scoreBit = preview && preview.score !== null
      ? '<div class="ed-score"><strong>' + preview.score + '</strong> out of 100 · ' +
        preview.macro.kcal + ' kcal · ' + preview.macro.p + 'g protein · ' +
        preview.macro.na + ' mg sodium · ' + preview.macro.fib + 'g fiber' +
        '<div class="ed-hint">Worked out from the ingredients, the same way the printed ones were.</div>' +
        (preview.unpriced
          ? '<div class="ed-warn">Not counted, because the food table has no entry: ' +
            esc(preview.unpriced.join(', ')) + '. Everything else is in.</div>' : '') +
        '</div>'
      : '<div class="ed-score ed-score-none">Add ingredients and the calories, sodium, fiber and ' +
        'score work themselves out.</div>';

    var row = function (label, id, val, ph, cls) {
      return '<label class="ed-f' + (cls ? ' ' + cls : '') + '"><span>' + label + '</span>' +
        '<input class="txt" id="' + id + '" value="' + esc(val || '') + '" placeholder="' + esc(ph || '') + '"></label>';
    };

    return '<div class="scrim no-print" data-close="1">' +
      '<div class="sheet ed-sheet" role="dialog" aria-modal="true" aria-label="Recipe">' +
        '<div class="sheet-top">' +
          '<div class="sheet-eyebrow">' + (own ? (b.isNew ? 'A new recipe' : 'Yours') :
            BOOKS[b.book].name + ' &middot; changing a printed recipe') + '</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
        '</div>' +

        row('Name', 'edName', b.name, 'Grandma’s rolls') +
        (own ? row('Section', 'edSection', b.secName, 'Ours') : '') +
        '<div class="ed-row">' +
          row('Servings', 'edServings', b.servings, '4 Servings') +
          row('Time', 'edTime', b.time, '35 mins') +
          '<label class="ed-f"><span>Effort</span><select class="txt" id="edDiff">' +
            ['Easy', 'Medium', 'In-Depth'].map(function (d) {
              return '<option value="' + d + '"' + (b.diff === d ? ' selected' : '') + '>' + diffLabel(d) + '</option>';
            }).join('') +
          '</select></label>' +
        '</div>' +

        '<label class="ed-f"><span>Ingredients &mdash; one a line</span>' +
          '<textarea class="txt ed-ta" id="edIng" rows="7" placeholder="2 cups flour&#10;1 tsp salt&#10;1 packet yeast">' +
          esc((b.ing || []).join('\n')) + '</textarea></label>' +

        scoreBit +

        '<label class="ed-f"><span>Method &mdash; one step a line</span>' +
          '<textarea class="txt ed-ta" id="edSteps" rows="7" placeholder="Warm the milk to blood heat.&#10;Stir in the yeast and leave ten minutes.">' +
          esc((b.steps || []).join('\n')) + '</textarea></label>' +

        row('Needs beyond the storehouse', 'edExtras', b.extras, 'Nothing, or: Buttermilk, Nutmeg') +

        '<details class="ed-more"' + (S.editMacros ? ' open' : '') + '><summary>Set the calories yourself</summary>' +
          '<div class="ed-hint">Only if you have real numbers. Leave these empty and they come from the ' +
          'ingredients. Sodium and fiber always do.</div>' +
          '<div class="ed-row ed-row4">' +
            row('kcal', 'edKcal', b.typedMacro ? b.macro.kcal : '', '') +
            row('Protein g', 'edP', b.typedMacro ? b.macro.p : '', '') +
            row('Carbs g', 'edC', b.typedMacro ? b.macro.c : '', '') +
            row('Fat g', 'edF', b.typedMacro ? b.macro.f : '', '') +
          '</div>' +
        '</details>' +

        '<div class="ed-actions">' +
          '<button class="btn-primary" data-ed="save">Save</button>' +
          '<button class="ghost" data-ed="cancel">Cancel</button>' +
          (own && !b.isNew ? '<button class="ghost ed-del" data-ed="delete">Delete this recipe</button>' : '') +
          (!own && b.edited ? '<button class="ghost ed-del" data-ed="revert">Put the book’s version back</button>' : '') +
        '</div>' +
      '</div></div>';
  }

  function editorAction(what) {
    if (what === 'cancel') { S.editId = null; S.editBase = null; renderModal(); restoreOpener(); return; }

    if (what === 'delete' || what === 'revert') {
      var id = S.editBase.id;
      ask(what === 'delete'
        ? { title: 'Delete “' + (S.editBase.name || 'this recipe') + '”?',
            body: 'It goes from both phones, and from any week it is in.',
            ok: 'Delete it', danger: true }
        : { title: 'Put the printed version back?',
            body: 'Your changes are dropped. The recipe returns to what the book says.',
            ok: 'Undo my changes', danger: true },
        function (yes) {
          if (!yes) return;
          window.Store.deleteRecipe(id);
          S.editId = null; S.editBase = null;
          renderModal();
        });
      return;
    }

    var rec = measured(editorForm());
    if (!rec.name || rec.name === 'Untitled') { ask({ title: 'Give it a name first.' }); return; }
    if (!rec.ing.length) { ask({ title: 'A recipe needs at least one ingredient.' }); return; }
    window.Store.saveRecipe(rec);
    S.editId = null; S.editBase = null;
    S.openId = rec.id;          // straight into the recipe you just wrote
    S.scale = 1;
    renderAll();
  }

  /* Only the preview under the ingredients redraws while you type, so nothing
     you have typed anywhere else can be lost to a re-render. */
  function refreshPreview() {
    var box = document.querySelector('.ed-score');
    if (!box) return;
    S.editPreview = measured(editorForm());
    var p = S.editPreview;
    if (p.score === null) {
      box.className = 'ed-score ed-score-none';
      box.innerHTML = 'Add ingredients and the calories, sodium, fiber and score work themselves out.';
      return;
    }
    box.className = 'ed-score';
    box.innerHTML = '<strong>' + p.score + '</strong> out of 100 · ' +
      p.macro.kcal + ' kcal · ' + p.macro.p + 'g protein · ' +
      p.macro.na + ' mg sodium · ' + p.macro.fib + 'g fiber' +
      '<div class="ed-hint">Worked out from the ingredients, the same way the printed ones were.</div>' +
      (p.unpriced ? '<div class="ed-warn">Not counted, because the food table has no entry: ' +
        esc(p.unpriced.join(', ')) + '. Everything else is in.</div>' : '');
  }

  function openEditor(id) {
    var b;
    if (id === 'new') {
      b = {
        id: window.Store.newRecipeId(), own: true, isNew: true, book: 3, secNum: 1,
        secName: 'Ours', name: '', servings: '4 Servings', time: '', diff: 'Easy',
        ing: [], steps: [], extras: '', macro: {}
      };
    } else {
      var r = BY_ID[id];
      if (!r) return;
      b = Object.assign({}, r, { own: typeof r.id === 'string', typedMacro: !r.est });
      b.book = r.book; b.secNum = r.secNum;
    }
    S.editBase = b;
    S.editMacros = !!b.typedMacro;
    S.editPreview = b.ing && b.ing.length ? measured(Object.assign({}, b, {
      ing: b.ing.join('\n'), steps: (b.steps || []).join('\n'),
      /* All four, or none. kcal was carried across and the other three were
         not, so the panel that opens with the editor recomputed a recipe with
         its calories and no protein at all — a score tens of points below the
         one on the card the reader had just tapped, until they touched a
         field and refreshPreview put it right. */
      kcal: b.typedMacro ? b.macro.kcal : '',
      p: b.typedMacro ? b.macro.p : '',
      c: b.typedMacro ? b.macro.c : '',
      f: b.typedMacro ? b.macro.f : ''
    })) : null;
    S.openId = null;
    rememberOpener();
    S.editId = id;
    pushSheet({ e: String(id) });
    renderModal();
  }

  // ----------------------------------------------------------------- sync UI
  function syncHTML() {
    var st = window.Store.status;
    var configured = window.Store.configured;
    var house = window.Store.house;
    var dotCls = st === 'synced' ? 'dot on' : st === 'error' ? 'dot off'
      : (st === 'sending' || st === 'waiting') ? 'dot wait' : 'dot';
    var ago = window.Store.lastSync ? agoWords(window.Store.lastSync) : '';
    /* Sync is a thing that either works or has visibly stopped — so the line
       says which, and nothing else. It used to narrate every intermediate
       state in a full sentence apiece, which is a lot of prose about a
       background job that is almost always simply fine. */
    var label = !configured ? 'On this device only'
      : st === 'synced' ? 'Shared' + (ago ? ' · ' + ago : '')
        : st === 'connecting' ? 'Connecting…'
          : st === 'sending' ? 'Sending…'
            : st === 'waiting' ? 'Offline · sent when there is signal'
              : st === 'error' ? 'Sharing stopped' : 'On this device only';

    var body;
    if (!configured) {
      body = '<p class="sync-p">No server behind this copy. See <strong>SETUP.md</strong>.</p>';
    } else if (!house) {
      body = '<div class="sync-code" id="newCode">' + esc(S.pendingCode) + '</div>' +
        '<div class="sync-row">' +
          '<button class="btn-primary" data-sync="use">Use this code</button>' +
          '<button class="ghost" data-sync="reroll">Another</button>' +
        '</div>' +
        '<div class="sync-row">' +
          '<input class="txt" id="joinCode" placeholder="Or type a code you have" aria-label="Pantry code">' +
          '<button class="ghost" data-sync="join">Join</button>' +
        '</div>' +
        /* The one thing worth a sentence, because anyone who has the code can
           write to the list and there is no undoing having handed it out. */
        '<div class="sync-warn">Anyone with the code can see and change the list.</div>';
    } else {
      body = '<div class="sync-code">' + esc(house) + '</div>' +
        (window.Store.statusNote ? '<div class="sync-warn">' + esc(window.Store.statusNote) + '</div>' : '') +
        '<div class="sync-row"><button class="ghost" data-sync="leave">Stop sharing here</button></div>';
    }

    /* Two things travel and they are not the same promise: the pantry is
       shared with PEOPLE by handing out a code, and My Day is carried between
       YOUR OWN devices by being you. Merging them into one undifferentiated
       sheet made the app read as one confusing thing with two kinds of
       secret. Two cards, split by whose it is, each saying who can see it —
       and the personal one first, because it is the one with a name on it. */
    return '<div class="scrim no-print" data-close="1">' +
      '<div class="sheet sync-sheet" role="dialog" aria-modal="true" aria-label="Sync and sharing">' +
        '<div class="sheet-top">' +
          '<div class="sheet-eyebrow">Sync &amp; sharing</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
        '</div>' +

        '<div class="mt-div">Your day</div>' +
        '<p class="sync-p">Your plan, meals and weigh-ins. Private to you.</p>' +
        mAccountBlockHTML() +

        '<div class="mt-div">Your pantry</div>' +
        '<p class="sync-p">The shopping list, the week&rsquo;s meals and your favorites &mdash; shared ' +
        'with family, friends, or anyone you give the code to.</p>' +
        body +
        '<div class="sync-status"><span class="' + dotCls + '"></span>' + esc(label) +
          '<span class="sync-build">Build ' + esc(BUILD) + '</span></div>' +

        /* The one screen somebody opens to find out what this thing is, so it
           is where the app says who it is not. */
        '<div class="sync-disclaim">Not an official product of The Church of Jesus Christ of ' +
          'Latter-day Saints, and not affiliated with or endorsed by the Church.</div>' +
      '</div></div>';
  }

  /* Two questions, and the badge was answering neither.

     "Is this the thing I press to share with my wife?" — it said Local, which
     is a state, and nothing suggested it could be pressed at all.

     "Have my changes reached her?" — it said Offline, which is network
     jargon for a Firestore snapshot served out of the local cache, and covers
     three situations a person would want told apart: an app half a second old
     that has not heard back yet, a phone holding a change that has not gone
     anywhere, and a phone that has lost signal but has nothing waiting. Only
     the middle one means anything is at risk, and it was the one nobody could
     see.

     So: the word is always about sharing, and the state answers whether the
     others have it.

       Share       not sharing at all — press this
       Syncing…    joined, waiting on the first word from the server
       Sending…    a change here has not been acknowledged yet
       No signal   nothing of ours is waiting; we may be missing theirs
       Synced      the others have everything this phone has
       Sync issue  it has stopped, and the sheet says why
  */
  var SYNC_WORD = {
    local: 'Share', connecting: 'Syncing…', sending: 'Sending…',
    waiting: 'No signal', synced: 'Synced', error: 'Sync issue'
  };
  var SYNC_TIP = {
    local: 'Saving on this phone only. Tap to share one list with other phones.',
    connecting: 'Joined. Waiting to hear back — tap for the code.',
    sending: 'A change on this phone has not reached the others yet. It will go by itself.',
    waiting: 'No signal. Everything here has been sent; you may not have their latest yet.',
    synced: 'The other phones have everything this one has. Tap for the code.',
    error: 'Sharing has stopped. Tap to see why — nothing has been lost.'
  };

  /* "Synced" on its own is a claim without a date on it, and the question
     underneath it is always how long ago. Minutes for the first hour, then
     hours; past a day it stops being reassurance and the sheet says so. */
  function agoWords(ms) {
    if (!ms) return '';
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 45) return 'just now';
    var m = Math.round(s / 60);
    if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
    var h = Math.round(m / 60);
    if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    var d = Math.round(h / 24);
    return d + (d === 1 ? ' day ago' : ' days ago');
  }

  /* The bench for the day planner, in the spirit of __ean above: the barcode
     tests need a reader without a camera, and this needs a day without a
     screen.
   *
     Fill picks at random from the top three fits, so two settings can only be
     compared honestly over the SAME days — which means hundreds of them, which
     is only affordable with nothing rendering in between. Seeding is the
     bench's own job: it overrides Math.random before calling in, so no source
     of randomness has to be plumbed through the app to be controlled.

     Read-only from the app's point of view — nothing here is reachable from
     the interface, and nothing in the interface calls it. */
  window.__macroLab = {
    forget: function () { delete MDAYS[mViewKey()]; },
    draft: mDraftDay,
    balance: function () {
      var t = mDayTargets(mViewKey());
      mEditDay(mViewKey(), function (d) { mBalanceDay(d, t); });
    },
    targets: function () { return mDayTargets(mViewKey()); },
    /* The merge, so the rules that decide what survives a second device can
       be asserted without one. The closed-day rule in particular is easy to
       get wrong in a way no single-device test would ever notice. */
    merge: mMergeRemote,
    /* Why was this dish not chosen? The ranking, for one meal, on the day as
       it currently stands — the same call Fill makes, so the answer is the
       real one. */
    rank: function (slotKey, top) {
      var day = MDAYS[mViewKey()] || {};
      var targets = mDayTargets(mViewKey());
      var slot = null;
      mReadSlots().list.forEach(function (s) { if (s.k === slotKey) slot = s; });
      if (!slot) return [];
      var pool = mMealPool(slot, mWideOpen(slotKey));
      return mRank(pool, day, targets, slot).slice(0, top || 12).map(function (e) {
        var m = (e.r.macro) || {};
        return { id: e.r.id, name: e.r.name, score: e.score, x: e.x,
          kcal: m.kcal || 0, p: m.p || 0, f: m.f || 0, c: m.c || 0, na: m.na || 0 };
      });
    },
    /* Everything a scoring pass needs, per meal: the share it was given, and
       for each plate the dish's own numbers beside the portion chosen — so a
       reader can tell "a big dish at ×1" from "a small dish at ×3", which is
       the distinction every question about portioning turns on. */
    read: function () {
      var day = MDAYS[mViewKey()] || {};
      var out = { meals: [], tot: mTotals(day).all };
      mReadSlots().list.forEach(function (s) {
        out.meals.push({
          k: s.k, name: s.n, w: mSlotW(s),
          items: (day[s.k] || []).map(function (it) {
            var r = BY_ID[it.id];
            var m = (r && r.macro) || {};
            return { id: it.id, x: it.x, name: r ? r.name : '(gone)',
              sec: r ? r.book + '-' + r.secNum : '',
              kcal: m.kcal || 0, p: m.p || 0, f: m.f || 0, c: m.c || 0,
              na: m.na || 0, fib: m.fib || 0 };
          })
        });
      });
      return out;
    }
  };

  /* Exposed so tests/weeks.test.js can check every state has both, rather than
     keeping its own copy of the list and going stale the moment one is added. */
  window.__secShort = SEC_SHORT;
  window.__secNote = SEC_NOTE;
  window.__syncWords = SYNC_WORD;
  window.__syncTips = SYNC_TIP;

  /* Shown only where it can be acted on and only until it has been. Three
     conditions, and each of them is a way of not nagging:

       configured   a copy with no Firebase behind it cannot share at all, and
                    advertising it would be advertising a dead end
       no household this phone is not already on a list
       not dismissed either button puts it away permanently

     It is deliberately not tied to first run. Somebody who has used this alone
     for a month and then wants their wife on it is the same person with the
     same question, and a hint that expired on day one would not be there. */
  var HINT_OFF = 'sh.hintShare';
  function hintDismissed() {
    try { return localStorage.getItem(HINT_OFF) === '1'; } catch (e) { return false; }
  }
  function dismissHint() {
    try { localStorage.setItem(HINT_OFF, '1'); } catch (e) { /* private mode */ }
    renderShareHint();
  }
  function renderShareHint() {
    var el = $('shareHint');
    if (!el) return;
    var show = window.Store.configured && !window.Store.house && !hintDismissed();
    el.classList.toggle('hide', !show);
  }

  function renderSyncBadge() {
    var st = window.Store.status;
    var dot = $('syncDot'), label = $('syncLabel');
    /* Green only when the others actually have it. Amber while something is in
       flight or missing, which is the state worth noticing and the one that was
       previously drawn the same as an error. */
    dot.className = 'dot' + (st === 'synced' ? ' on'
      : (st === 'error') ? ' off'
        : (st === 'sending' || st === 'waiting') ? ' wait' : '');
    label.textContent = SYNC_WORD[st] || SYNC_WORD.local;
    var tip = SYNC_TIP[st] || SYNC_TIP.local;
    if (st === 'synced' && window.Store.lastSync) tip += ' Last confirmed ' + agoWords(window.Store.lastSync) + '.';
    $('syncBtn').setAttribute('title', tip);
    renderShareHint();
  }

  // ----------------------------------------------------------------- pantry
  /* The shelf, laid out the way the storehouse order sheet is, so someone
     holding that sheet can read down it. Foods the books use come from
     data/recipes.js; anything added here joins them under a shelf of its own,
     because a household's own staples are not on anybody's order list. */
  function pantryShelves() {
    var P = window.PANTRY || {}, own = window.Store.pantryOwn(), by = {}, order = [];
    function put(key, item, mine) {
      var c = item.c || 'Yours';
      if (!by[c]) { by[c] = []; order.push(c); }
      by[c].push({ k: key, l: item.l, c: c, mine: mine, on: inPantry(key), std: !!item.s });
    }
    Object.keys(P).forEach(function (k) { put(k, P[k], false); });
    Object.keys(own).forEach(function (k) { put(k, own[k], true); });
    order.forEach(function (c) { by[c].sort(function (a, b) { return a.l.localeCompare(b.l); }); });
    return order.map(function (c) { return { name: c, items: by[c] }; });
  }

  function renderPantry() {
    var shelves = pantryShelves();
    var kept = [], gone = [];
    shelves.forEach(function (sh) {
      var on = sh.items.filter(function (i) { return i.on; });
      if (on.length) kept.push({ name: sh.name, items: on });
      sh.items.filter(function (i) { return !i.on; }).forEach(function (i) { gone.push(i); });
    });
    gone.sort(function (a, b) { return a.l.localeCompare(b.l); });

    var n = kept.reduce(function (t, sh) { return t + sh.items.length; }, 0);
    $('pantryNote').textContent = n + (n === 1 ? ' item' : ' items') +
      (window.Store.pantryChanged() ? ' · changed from the storehouse list' : ' · the standard storehouse order');
    $('pantryReset').classList.toggle('hide', !window.Store.pantryChanged());

    /* A list of what you keep, not a checklist of what to fetch. Boxes said
       "tick these as you go", which is the shopping list's job and not this
       one's — here a thing is either on your shelf or it is not, and the way
       to say it is not is to take it off. */
    /* The count on each shelf head. In one column it would be clutter; in six
       it is how you find the shelf you want without reading it. */
    var html = kept.map(function (sh) {
      return '<div class="shelf">' +
        '<div class="shelf-h"><span>' + esc(sh.name) + '</span>' +
          '<span class="shelf-n">' + sh.items.length + '</span></div>' +
        sh.items.map(function (i) {
          return '<div class="pitem">' +
            '<span class="pitem-l">' + esc(i.l) + '</span>' +
            (i.std === false && !i.mine ? '<span class="pitem-tag">not on the order</span>' : '') +
            '<button class="pitem-x" data-poff="' + esc(i.k) + '" ' +
              'aria-label="Take ' + esc(i.l) + ' off the list">&times;</button>' +
          '</div>';
        }).join('') +
      '</div>';
    }).join('');

    /* Taken off rather than deleted. You have to be able to find a thing to put
       it back, and the storehouse list is the thing most people will be editing
       down from — losing an item permanently on one tap would be the wrong
       shape of mistake to make easy. */
    if (gone.length) {
      html += '<div class="shelf shelf-gone">' +
        '<div class="shelf-h"><span>Not kept &middot; ' + gone.length + '</span></div>' +
        gone.map(function (i) {
          return '<div class="pitem off">' +
            '<span class="pitem-l">' + esc(i.l) + '</span>' +
            '<button class="pitem-x back" data-pon="' + esc(i.k) + '" ' +
              'aria-label="Put ' + esc(i.l) + ' back">+</button>' +
          '</div>';
        }).join('') +
      '</div>';
    }
    $('pantryBody').innerHTML = html;
  }

  // ------------------------------------------------------------------ views
  function renderView() {
    ['browse', 'plan', 'macros', 'list', 'pantry', 'book'].forEach(function (v) {
      $('view-' + v).classList.toggle('hide', S.view !== v);
    });
    document.querySelectorAll('.tab').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.dataset.view === S.view));
    });
    if (S.view === 'browse') renderBrowse();
    if (S.view === 'plan') renderPlan();
    if (S.view === 'macros') renderMacros();
    if (S.view === 'list') renderList();
    if (S.view === 'pantry') renderPantry();
    if (S.view === 'book') renderBook();
    syncShrunk();
  }

  /* The five tabs fit a 390px phone now, so the fade would be a lie there. It
     appears only where the row is actually wider than its box — the narrowest
     phones — and only until you have scrolled to the end of it. */
  function syncTabsFade() {
    var tabs = document.querySelector('.tabs');
    var fade = $('tabsFade');
    if (!tabs || !fade) return;
    var over = tabs.scrollWidth - tabs.clientWidth;
    fade.classList.toggle('hide', over <= 1 || tabs.scrollLeft >= over - 1);
  }

  function renderModal() {
    keepingFocus(renderModalInner);
    /* The sheet is redrawn from scratch, so Google's button has to be drawn
       into it again each time — and only ever after the sheet exists. Ours
       stays visible until theirs is actually there, so a failure to load
       leaves a way in rather than a gap. */
    var slot = $('myGoogleBtn');
    if (!slot || !window.Store || !window.Store.mountGoogleButton) return;
    window.Store.mountGoogleButton(slot, function () {
      S.mySent = false; mAccountMark(); mSyncStart(); renderModal();
    }, function () {
      S.myErr = 'That did not go through. Try again, or use the email link.';
      renderModal();
    }).then(function () {
      /* Theirs is up, so ours steps back — but does not leave, because a
         rendered button and a working one are not the same thing. */
      var fb = $('myGoogleFallback');
      if (fb) fb.classList.add('hide');
      var alt = $('myGoogleAlt');
      if (alt) alt.classList.remove('hide');
    }, function () { /* theirs never arrived; ours is already showing */ });
  }

  function renderAll() { keepingFocus(renderAllInner); }

  function renderAllInner() {
    rebuild();                    // your changes and your own recipes, folded in
    renderSections();             // which can add a section, or a whole volume
    renderPantryFilterLabels();   // which follow your shelf once you have one
    /* Forget ticks for anything no longer on the list. This has to happen on
       every change, not just while the list is on screen — a recipe is usually
       dropped from the Meal Plan tab, and by the time you look at the list the
       tick would already have been reapplied to a fresh copy of the item. */
    var live = [];
    buildList().groups.forEach(function (g) {
      g.items.forEach(function (it) { live.push(it.key); });
    });
    if (window.Store.pruneChecked(live)) return;   // the store will call back

    $('favCount').textContent = window.Store.state.favs.length ? '(' + window.Store.state.favs.length + ')' : '';
    renderWeeks();          // the week strip and the print menu, whichever tab is up
    renderSyncBadge();
    renderView();
    renderModal();
  }

  // ----------------------------------------------------------------- events
  function wire() {
    document.querySelectorAll('.tab').forEach(function (b) {
      b.addEventListener('click', function () {
        S.view = b.dataset.view;
        try { localStorage.setItem('sh.view', S.view); } catch (e) { /* private mode */ }
        renderView();
      });
    });

    $('bookSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-book]');
      if (!b) return;
      S.bookF = b.dataset.book === 'all' ? 'all' : Number(b.dataset.book);
      S.secF = 'all';
      Array.prototype.forEach.call(this.querySelectorAll('button'), function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
      renderSections();
      renderBrowse();
    });

    $('secSel').addEventListener('change', function () { S.secF = this.value; renderBrowse(); });
    $('diffSel').addEventListener('change', function () { S.diffF = this.value; renderBrowse(); });
    $('pantrySel').addEventListener('change', function () { S.pantryF = this.value; renderBrowse(); });
    /* On the list rather than on the modal, which is where these first went —
       the modal's handler only ever sees clicks inside an open recipe. */
    $('pantryBody').addEventListener('click', function (e) {
      var off = e.target.closest('[data-poff]');
      if (off) {
        var k = off.dataset.poff;
        /* Something you added yourself has nowhere to fall back to — the books
           have never heard of it — so taking it off removes it outright. */
        if (window.Store.pantryOwn()[k]) window.Store.removePantryItem(k);
        else window.Store.setPantry(k, false);
        renderPantry(); return;
      }
      var on = e.target.closest('[data-pon]');
      if (on) { window.Store.setPantry(on.dataset.pon, true); renderPantry(); }
    });

    $('pantryAdd').addEventListener('click', function () {
      ask({ title: 'What do you keep?', body: 'It joins the pantry under Yours, and any recipe that calls for it stops asking you to buy it.', value: '', ok: 'Add' },
        function (v) {
          if (v && v.trim()) { window.Store.addPantryItem(v.trim(), 'Yours'); renderPantry(); }
        });
    });
    $('pantryReset').addEventListener('click', function () {
      ask({ title: 'Back to the storehouse list?',
        body: 'Everything you ticked off comes back. Items you added yourself stay.',
        ok: 'Reset', danger: true }, function (ok) {
          if (ok !== null && ok !== undefined) { window.Store.resetPantry(); renderPantry(); }
        });
    });

    $('search').addEventListener('input', function () { S.qy = this.value; renderBrowse(); });
    $('sortSel').addEventListener('change', function () { S.sort = this.value; renderBrowse(); });

    $('favBtn').addEventListener('click', function () {
      S.favOnly = !S.favOnly;
      this.setAttribute('aria-pressed', String(S.favOnly));
      renderBrowse();
    });

    $('grid').addEventListener('click', function (e) {
      var c = e.target.closest('[data-open]');
      if (!c) return;
      rememberOpener();
      openRecipe(idOf(c.dataset.open));
    });

    $('planGrid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-drop]');
      if (b) { window.Store.removeFromDay(idOf(b.dataset.drop), b.dataset.day); return; }
      var m = e.target.closest('[data-mult]');
      if (!m) return;
      var id = idOf(m.dataset.mult), day = m.dataset.day;
      var at = SCALES.indexOf(window.Store.scaleOf(id, day));
      window.Store.addToDay(id, day, SCALES[(at + 1) % SCALES.length]);
    });

    /* The Macros day. Items are addressed slot:index into the stored arrays,
       so duplicates of the same recipe stay two separate plates. */
    $('macroSlots').addEventListener('click', function (e) {
      /* The name is a door to the recipe itself. It goes through openRecipe
         like every other door, so the back gesture walks home to the day. */
      var op = e.target.closest('[data-open]');
      if (op) {
        rememberOpener();
        var opr = BY_ID[idOf(op.dataset.open)];
        /* The sheet opens scaled to MAKE the portion on the plan, not to the
           whole batch — that is the number the plate was budgeted at. */
        openRecipe(idOf(op.dataset.open),
          opr ? mCookScale(Number(op.dataset.mx) || 1, opr.servN) : 1);
        return;
      }
      /* The whole meal, in one press. Locked plates are the machine's
         business, not yours — a hand on this is you saying you ate it. */
      var dot = e.target.closest('[data-mdot]');
      if (dot) {
        if (dot.dataset.mdot === 'weigh') {
          var wb = $('mWeight');
          if (wb) { wb.focus(); wb.select(); }
          return;
        }
        var dk = dot.dataset.mdot;
        mEditDay(mViewKey(), function (day) {
          var list = day[dk] || [];
          var allOn = list.length && list.every(function (it) { return it.eaten; });
          list.forEach(function (it) { it.eaten = allOn ? 0 : 1; });
        });
        keepingFocus(renderMacros);
        return;
      }

      /* One tap on a spent portion hands its stepper back. Only one plate at a
         time is awake, so tapping another puts the first away — the day never
         drifts into a state where half of it is quietly editable. */
      var ed = e.target.closest('[data-medit]');
      if (ed) { S.mEdit = ed.dataset.medit; keepingFocus(renderMacros); return; }

      /* Not eating this one today. It toggles, and the share it was holding
         goes back to the meals that are actually happening — which is the
         difference between a skip and an empty meal. */
      var skp = e.target.closest('[data-mskip]');
      if (skp) {
        var sKey = skp.dataset.mskip;
        mSetSkip(mViewKey(), sKey, !mSkipped(mViewKey(), sKey));
        keepingFocus(renderMacros);
        return;
      }

      var tr = e.target.closest('[data-mtry]');
      if (tr) { mTryAgain(tr.dataset.mtry); return; }

      var add = e.target.closest('[data-mslot]');
      if (add) {
        rememberOpener();
        var srec = null;
        mReadSlots().list.forEach(function (s) { if (s.k === add.dataset.mslot) srec = s; });
        if (!srec) return;
        // sections resolved once at the door; filter and sort start fresh
        S.mpFromBar = false;
        mOpenPicker(srec.k, 'home');
        return;
      }
      var bal = e.target.closest('[data-mbal]');
      if (bal) { mBalanceMeal(bal.dataset.mbal); return; }

      var keep = e.target.closest('[data-mkeep]');
      if (keep) {
        S.keepMeal = keep.dataset.mkeep;
        rememberOpener();
        pushSheet({ m: 1 });
        renderModal();
        var nm2 = $('mkName');
        if (nm2) nm2.focus();
        return;
      }

      /* A food's name opens the food, the way a recipe's name opens the
         recipe. For a kept meal that is the only place its parts can be
         seen again: the plate shows one line for the whole thing. */
      var fd = e.target.closest('[data-mfood]');
      if (fd) {
        rememberOpener();
        S.foodOpen = { id: fd.dataset.mfood, x: Number(fd.dataset.mx) || 1 };
        pushSheet({ m: 1 });
        renderModal();
        return;
      }

      var fold = e.target.closest('[data-mfold]');
      if (fold) {
        var fk = fold.dataset.mfold;
        S.mFold[fk] = !(fold.getAttribute('aria-expanded') === 'false');
        keepingFocus(renderMacros);
        return;
      }

      var st = e.target.closest('[data-mstep]');
      if (st) {
        var sp = st.dataset.mstep.split(':');           // slot : index : direction
        mEditDay(mViewKey(), function (day) {
          var it = (day[sp[0]] || [])[Number(sp[1])];
          if (!it) return;
          // the disabled attribute is paint; this is the rule
          if (it.eaten && S.mEdit !== sp.slice(0, 2).join(':')) return;
          /* Quarter-serving steps land on eighths, so fmtNum always has a
             glyph and never falls back to a decimal. */
          it.x = sp[2] === 'up' ? Math.min(4, it.x + 0.25) : Math.max(0.25, it.x - 0.25);
        });
        keepingFocus(renderMacros);
        return;
      }
      var del = e.target.closest('[data-mdel]');
      if (del) {
        var dp = del.dataset.mdel.split(':');
        mEditDay(mViewKey(), function (day) {
          (day[dp[0]] || []).splice(Number(dp[1]), 1);
        });
        keepingFocus(renderMacros);
        return;
      }
      var pn = e.target.closest('[data-mpin]');
      if (pn) {
        var pp = pn.dataset.mpin.split(':');
        var pit = (mDay(mViewKey())[pp[0]] || [])[Number(pp[1])];
        if (!pit) return;
        var pslots = mReadSlots();
        var psrec = null;
        pslots.list.forEach(function (s) { if (s.k === pp[0]) psrec = s; });
        if (!psrec) return;
        psrec.pins = psrec.pins || [];
        var pat = -1;
        psrec.pins.forEach(function (p, i2) { if (p.id === pit.id) pat = i2; });
        if (pat >= 0) psrec.pins.splice(pat, 1);
        else psrec.pins.push({ id: pit.id, x: pit.x });
        mWriteSlots(pslots);
        keepingFocus(renderMacros);
        return;
      }

      var lk = e.target.closest('[data-mlock]');
      if (lk) {
        var lp = lk.dataset.mlock.split(':');
        mEditDay(mViewKey(), function (day) {
          var it = (day[lp[0]] || [])[Number(lp[1])];
          if (it) it.l = it.l ? 0 : 1;
        });
        keepingFocus(renderMacros);
      }
    });

    $('macroSlots').addEventListener('change', function (e) {
      var c = e.target.closest('[data-meat]');
      if (!c) return;
      var cp = c.dataset.meat.split(':');
      mEditDay(mViewKey(), function (day) {
        var it = (day[cp[0]] || [])[Number(cp[1])];
        if (it) it.eaten = c.checked ? 1 : 0;
      });
      keepingFocus(renderMacros);
    });

    $('macroWeek').addEventListener('click', function (e) {
      var d = e.target.closest('[data-mweek]');
      if (!d || d.disabled) return;
      S.macroDate = d.dataset.mweek === todayKey() ? null : d.dataset.mweek;
      keepingFocus(renderMacros);
    });
    $('macroPrev').addEventListener('click', function () { mNavDay(-1); });
    $('macroNext').addEventListener('click', function () { mNavDay(1); });
    $('macroDaySel').addEventListener('change', function () {
      S.macroDate = this.value === todayKey() ? null : this.value;
      keepingFocus(renderMacros);
    });
    $('macroFill').addEventListener('click', mFillDay);

    /* Done for the day. A statement, not a change: nothing is deleted, food
       can still be added, and pressing it again takes it back. The card comes
       up on the way in and not on the way out — closing is the moment you
       want to be told how it went; reopening is just a correction. */
    $('macroDone').addEventListener('click', function () {
      var k = mViewKey();
      var was = mDoneAt(k) > 0;
      mSetDone(k, !was);
      if (!was) {
        rememberOpener();
        S.mDoneOpen = k;
        pushSheet({ m: 1 });
        renderModal();
      }
      renderMacros();
    });
    $('macroRebal').addEventListener('click', mRebalance);

    /* The three that are not the morning. Craft is a once-a-season job, Copy
       is a once-a-day one, and the account is neither — none of them belong
       in front of the two buttons pressed every time the tab is opened. */
    function mMenu(open) {
      var m = $('macroMenu');
      if (!m) return;
      m.classList.toggle('hide', !open);
      $('macroMore').setAttribute('aria-expanded', String(!!open));
    }
    /* Open the whole day, or shut it. Which one it does next is whichever
       the day is not already: with anything folded it opens, and once
       everything is open it closes. */
    $('macroAdd').addEventListener('click', function () {
      S.mpFromBar = true;
      mOpenPicker(null, 'home');
    });

    /* Scan without going to a meal first. It opens the lens straight away and
       the meal is chosen from the row above it, which is the order you do it
       in when you are holding a packet. */
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      $('macroScan').classList.remove('hide');
      $('macroScan').addEventListener('click', function () {
        S.mpFromBar = true;
        mOpenPicker(null, 'scan');
      });
    }

    /* The pills are the bars folded up. Pressing them goes back to the top,
       where the bars are open again — they are the same numbers, not a
       second readout. Smoothly, so the card unrolls on the way up the same
       way it rolled shut on the way down; a jump to the top would open it in
       one frame, which is the hard switch this fold exists to be rid of. */
    $('macroPills').addEventListener('click', function () {
      if (mReduced()) { window.scrollTo(0, 0); return; }
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); }
      catch (e) { window.scrollTo(0, 0); }
    });

    $('macroFoot').addEventListener('click', function (e) {
      if (!e.target.closest('[data-mchartopen]')) return;
      rememberOpener();
      S.chartOpen = true;
      pushSheet({ m: 1 });
      renderModal();
    });

    $('macroOpenAll').addEventListener('click', function () {
      var open = mAnyShut(), day = mDay(mViewKey());
      Object.keys(day).forEach(function (sk2) { S.mFold[sk2] = !open; });
      mReadSlots().list.forEach(function (s2) { S.mFold[s2.k] = !open; });
      S.mFold.weigh = open ? false : undefined;
      keepingFocus(renderMacros);
    });

    $('macroMore').addEventListener('click', function (e) {
      e.stopPropagation();
      mMenu($('macroMenu').classList.contains('hide'));
    });
    /* Copy came out of the menu and onto the bar. It reports success by
       renaming itself, and a control whose only feedback is its own label
       cannot live somewhere that closes on the way out. */
    $('macroCopy').addEventListener('click', function () { mCopyDay(this); });



    $('macroMenu').addEventListener('click', function (e) {
      var b = e.target.closest('[data-mmore]');
      if (!b) return;
      mMenu(false);
      rememberOpener();
      S.macroTargOpen = true;
      if (b.dataset.mmore === 'you') { S.macroTargOpen = false; S.syncOpen = true; }
      /* Any day, closed or not — the card is a reading of the day, and a day
         does not have to be finished with to be read. */
      if (b.dataset.mmore === 'went') { S.macroTargOpen = false; S.mDoneOpen = mViewKey(); }
      // the two that live inside the plan sheet open it at the right place
      S.mtOpen = b.dataset.mmore === 'meals' ? 'meals'
        : b.dataset.mmore === 'help' ? 'help' : '';
      pushSheet({ m: 1 });
      renderModal();
      if (S.mtOpen) {
        var jump = $(S.mtOpen === 'meals' ? 'mtMeals' : 'mtHelp');
        if (jump) jump.scrollIntoView({ block: 'start' });
      }
    });
    // anywhere else is "not that, then" — the ordinary way out of a menu
    document.addEventListener('click', function () { mMenu(false); });
    /* Nothing here reaches for the network unless there is a reason.
     *
       Asking who we are means loading the Firebase SDK, and loading it on
       every page load would put a request to another host in front of every
       reader who never signs in and never asked for one — which is the
       property this app has kept since it was built, and which its own
       offline test guards. So a device that has signed in remembers that it
       did, locally, and only that device goes looking. The other door is an
       email link landing back on this page, which is visible in the URL
       without asking anybody. */
    var linkBack = /[?&](oobCode=|mode=signIn)/.test(location.search);
    var hasAcct = false;
    try { hasAcct = localStorage.getItem('bsc.myAccount') === '1'; } catch (e) { /* private */ }
    if (linkBack && window.Store.completeEmailLink) {
      window.Store.completeEmailLink().then(function (res) {
        if (res) { S.mySent = false; mAccountMark(); renderModal(); }
        mSyncStart();
      }, function () { mSyncStart(); });
    } else if (hasAcct) {
      mSyncStart();
      if (window.Store.onUser) window.Store.onUser(function () { mSyncStart(); });
    }

    /* The scale's number, filed under the day being looked at — ‹ lets a
       missed morning be filled in after the fact. An emptied box un-logs it.
     *
     * Two saves, one truth. The quiet one runs a beat after each keystroke,
     * so a phone pocketed mid-entry has still kept the number — but it does
     * NOT redraw, because redrawing the box being typed in eats the trailing
     * "." of 187.4 as it passes through 187. The loud one runs on leaving the
     * box, cancels any quiet save still pending, and redraws the stats. The
     * day key is captured when typing starts: a pending save must not follow
     * the ‹ › onto a different morning. */
    var mwTimer = null;
    /* The weigh-in folds like a meal, but it is its own container — the
       meals' delegated handler never sees it. */
    /* Eat this instead. It rewrites the day's grams at the same split the
       plan already uses, so the shape of the day survives the change — only
       its size moves. */
    $('macroWeigh').addEventListener('click', function (e) {
      var b = e.target.closest('[data-mline]');
      if (!b) return;
      var parts = b.dataset.mline.split(':');
      if (parts[1] !== 'eat') { b.closest('.mline').classList.add('hush'); return; }
      var want = Number(parts[2]);
      var t = mReadTargets(), now = kcalOf(t);
      if (!want || !now) return;
      /* Protein holds its grams: it is the thing a cut protects, and scaling
         it with the calories would give back exactly what the deficit is for.
         Fat keeps its floor. The rest lands on carbohydrate. */
      var pr = mReadProfile();
      var floorF = pr.lb ? Math.max(1, Math.round(0.3 * pr.lb)) : t.f;
      var f = Math.max(Math.min(t.f, floorF), Math.round(t.f + (want - now) * 0.25 / 9));
      var c = Math.round((want - 4 * t.p - 9 * f) / 4);
      if (c < 0) { c = 0; f = Math.max(floorF, Math.round((want - 4 * t.p) / 9)); }
      mWriteTargets({ p: t.p, f: Math.max(0, f), c: Math.max(0, c) });
      renderMacros();
    });

    $('macroWeigh').addEventListener('click', function (e) {
      /* The way into the plan, wherever the card is showing it: on the face
         while there is no plan to adjust, behind the press once there is. */
      if (e.target.closest('#macroTargBtn')) {
        rememberOpener();
        S.macroTargOpen = true;
        pushSheet({ m: 1 });
        renderModal();
        var tf = $('mtGoalLb') || $('mtP');
        if (tf) tf.focus();
        return;
      }
      var wf = e.target.closest('[data-mfold]');
      if (!wf) return;
      S.mFold.weigh = !(wf.getAttribute('aria-expanded') === 'false');
      keepingFocus(renderMacros);
    });

    $('macroWeigh').addEventListener('input', function (e) {
      if (e.target.id !== 'mWeight') return;
      clearTimeout(mwTimer);
      var key = mViewKey(), val = e.target.value;
      mwTimer = setTimeout(function () {
        var lb = Number(val);
        mWriteWeight(key, isFinite(lb) && lb > 0 ? Math.min(1500, lb) : 0);
      }, 600);
    });
    $('macroWeigh').addEventListener('change', function (e) {
      if (e.target.id !== 'mWeight') return;
      clearTimeout(mwTimer);
      var lb = Number(e.target.value);
      mWriteWeight(mViewKey(), isFinite(lb) && lb > 0 ? Math.min(1500, lb) : 0);
      keepingFocus(renderMacros);
    });

    /* Paper has no fold. A folded meal is a list of dish names with no numbers
       on them, which is not a day anybody can read off a page — and CSS cannot
       open it, because the plates are not in the document at all while it is
       shut. So the day opens for the printer and closes again afterwards. */
    var mPrintFold = null;
    if (window.addEventListener) {
      window.addEventListener('beforeprint', function () {
        if (S.view !== 'macros') return;
        mPrintFold = S.mFold;
        S.mFold = {};
        /* Held on the day it is already on, so the arrival seed does not run
           and fold everything straight back down. */
        S.mFoldFor = mViewKey();
        renderMacros();
      });
      window.addEventListener('afterprint', function () {
        if (mPrintFold === null) return;
        S.mFold = mPrintFold;
        mPrintFold = null;
        renderMacros();
      });
    }

    /* A phone that sat open overnight should show the new day the moment it is
       looked at again, not yesterday's finished plan. Only when the reader has
       not deliberately navigated somewhere else. */
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && S.view === 'macros' && !S.macroDate) renderMacros();
    });

    $('weekBar').addEventListener('click', function (e) {
      var w = e.target.closest('[data-week]');
      if (w) { window.Store.setWeek(w.dataset.week); return; }
      var n = e.target.closest('[data-neww]');
      if (!n) return;
      var copy = n.dataset.neww === 'copy';
      var name = copy
        ? window.Store.activeWeek().name + ' again'
        : 'Week ' + (window.Store.weeks().length + 1);
      window.Store.addWeek(name, copy);
    });

    $('renameWeek').addEventListener('click', function () {
      var now = window.Store.activeWeek().name;
      ask({ title: 'Call this week what?', value: now, ok: 'Rename' }, function (name) {
        if (name && name.trim() && name.trim() !== now) window.Store.renameWeek(name);
      });
    });

    $('deleteWeek').addEventListener('click', function () {
      ask({
        title: 'Delete “' + window.Store.activeWeek().name + '”?',
        body: 'The week and its shopping list go, on both phones. The recipes themselves are untouched.',
        ok: 'Delete the week', danger: true
      }, function (yes) { if (yes) window.Store.deleteWeek(); });
    });

    $('clearPlan').addEventListener('click', function () {
      if (!planIds().length) { window.Store.clearPlan(); return; }
      ask({
        title: 'Clear every recipe from this week?',
        body: 'The shopping list starts over with it.',
        ok: 'Clear the week', danger: true
      }, function (yes) { if (yes) window.Store.clearPlan(); });
    });

    $('dialogRoot').addEventListener('click', function (e) {
      var b = e.target.closest('[data-dlg]');
      if (!b || (b.dataset.dlg === 'cancel' && b !== e.target && !e.target.closest('button'))) return;
      closeDialog(b.dataset.dlg === 'ok' ? dialogAnswer() : null);
    });

    $('dialogRoot').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.id === 'dlgInput') { e.preventDefault(); closeDialog(dialogAnswer()); }
    });

    $('listBody').addEventListener('change', function (e) {
      var c = e.target.closest('[data-check]');
      if (!c) return;
      window.Store.toggleChecked(c.dataset.check);
    });

    /* Tapping a cover downloads it — the anchor does that by itself — and
       also brings it up in the preview underneath, so what you just took is
       what you are looking at. The fold-and-staple link beside it is a
       download and nothing else; it must not move the preview, or reaching
       for the booklet would silently change the book on screen. */
    var pick = function (e) {
      if (e.target.closest('[data-fold], [data-get], #doPrint')) return;
      var b = e.target.closest('[data-print]');
      if (!b || b.dataset.print === S.printSet) return;
      S.printSet = b.dataset.print;
      renderBook();
    };
    $('printRows').addEventListener('click', pick);
    /* The picked sets moved out of the shelf into their own row and very
       nearly moved out of reach with it — the handler was bound to the shelf
       alone, so Favorites and the week were buttons that did nothing. */
    $('printPicked').addEventListener('click', pick);

    window.addEventListener('resize', fitPages);
    window.addEventListener('resize', syncTabsFade);
    window.addEventListener('resize', syncStick);
    syncStick();
    /* The app draws itself after the page loads, so a scroll position the
       browser puts back belongs to a page that does not exist yet: it lands
       in whatever happens to be there, and then everything that renders
       afterwards pushes it further. Opening at the top is both what a day
       wants and what lets the fold take its one honest measurement before it
       is asked to do anything. */
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.addEventListener('scroll', onScrollShrink, { passive: true });
    window.addEventListener('resize', onResizeFold);
    document.querySelector('.tabs').addEventListener('scroll', syncTabsFade, { passive: true });
    syncTabsFade();

    /* The hint is the door as well as the sign — "where do I go" should be
       answered by going there, not by being pointed at a corner. Opening it
       also puts the hint away: the question has been asked. */
    $('shareHintGo').addEventListener('click', function () {
      dismissHint();
      rememberOpener();
      S.syncOpen = true;
      if (!S.pendingCode) S.pendingCode = window.Store.newCode();
      pushSheet({ s: 1 });
      renderModal();
      var x = document.querySelector('.sheet-x');
      if (x) x.focus();
    });
    $('shareHintX').addEventListener('click', dismissHint);

    $('syncBtn').addEventListener('click', function () {
      rememberOpener();
      S.syncOpen = true;
      S.myErr = '';
      if (!mAuthKnown && mSuspectAccount()) mSyncStart();
      if (!S.pendingCode) S.pendingCode = window.Store.newCode();
      if (!S.pendingCode) S.pendingCode = window.Store.newCode();
      pushSheet({ s: 1 });
      renderModal();
      var x = document.querySelector('.sheet-x');
      if (x) x.focus();
    });

    document.addEventListener('click', function (e) {
      var root = $('modalRoot');
      if (!root.contains(e.target)) return;

      // the backdrop itself, or the × — anything inside the sheet falls through
      if (e.target.classList.contains('scrim') || e.target.closest('.sheet-x')) { close(); return; }

      /* A reference in a step, followed. Each hop is a history entry, so the
         back gesture walks the trail home. Scale resets, because the gravy
         does not inherit the roast's. */
      var xr = e.target.closest('.xref[data-open], .ing-make[data-open]');
      if (xr) { openRecipe(idOf(xr.dataset.open)); return; }

      var ed = e.target.closest('[data-edit]');
      if (ed) { openEditor(idOf(ed.dataset.edit)); return; }

      var act = e.target.closest('[data-ed]');
      if (act) { editorAction(act.dataset.ed); return; }

      var fav = e.target.closest('[data-fav]');
      if (fav) { window.Store.toggleFav(idOf(fav.dataset.fav)); return; }

      var add = e.target.closest('[data-add]');
      if (add) {
        var id = idOf(add.dataset.add), day = add.dataset.day;
        /* Whatever size you are looking at is the size that goes into the
           week — but only in sizes the week understands. A recipe opened
           from My Day arrives scaled to make ONE PERSON'S portion, which can
           be an eighth of a roast; letting that through planned an eighth of
           a roast for the whole family and shrank the shopping list to
           match. Snap to the batch sizes the week is built from. */
        var batch = SCALES.reduce(function (best, v) {
          return Math.abs(v - S.scale) < Math.abs(best - S.scale) ? v : best;
        }, SCALES[0]);
        if (window.Store.day(day).some(function (x) { return x.id === id; })) window.Store.removeFromDay(id, day);
        else window.Store.addToDay(id, day, batch);
        return;
      }

      var w = e.target.closest('[data-why]');
      if (w) { S.why = !S.why; renderModal(); return; }

      var sc = e.target.closest('[data-scale]');
      if (sc) {
        S.scale = sc.dataset.scale === 'up' ? Math.min(8, S.scale * 2) : Math.max(0.25, S.scale / 2);
        renderModal();
        return;
      }

      var un = e.target.closest('[data-units]');
      if (un) {
        // pressing the one already chosen is a no-op, not a flip back
        if (un.dataset.units === S.units) return;
        S.units = un.dataset.units;
        try { localStorage.setItem('sh.units', S.units); } catch (err) { /* private mode */ }
        renderModal();
        return;
      }

      var mkd = e.target.closest('[data-mkdo]');
      if (mkd && S.keepMeal) {
        var nm3 = String((($('mkName') || {}).value) || '').trim();
        if (!nm3) { $('mkNote').textContent = 'It needs a name to be found again.'; return; }
        var sk3 = S.keepMeal;
        var newId = mSaveMeal(sk3, nm3, mkd.dataset.mkdo === 'share');
        if (!newId) { $('mkNote').textContent = 'Nothing on this meal to keep.'; return; }
        /* The meal becomes the thing it just became: four rows collapse into
           the one they were always describing, at the portion they add up to.
           Leaving the parts behind would double the day. */
        mEditDay(mViewKey(), function (day) {
          day[sk3] = [{ id: newId, x: 1, eaten: 0 }];
        });
        S.keepMeal = '';
        close();
        renderMacros();
        return;
      }

      var mch = e.target.closest('[data-mchart]');
      if (mch && S.chartOpen) {
        S.chartWhich = mch.dataset.mchart;
        renderModal();
        return;
      }

      var mps = e.target.closest('[data-mpslot]');
      if (mps && S.macroPick) {
        var srec2 = null;
        mReadSlots().list.forEach(function (sl) { if (sl.k === mps.dataset.mpslot) srec2 = sl; });
        if (srec2) {
          /* The fit is worked out against the meal's own share, so changing
             the meal has to change what the list is ranked for. */
          S.macroPick = { slot: srec2.k, n: srec2.n, secs: mSlotSecs(srec2), w: mSlotW(srec2) };
          renderModal();
        }
        return;
      }

      var mpm = e.target.closest('[data-mpmode]');
      if (mpm && S.macroPick) {
        // leaving scan means letting go of the camera, whichever way you leave
        if (S.mpMode === 'scan') mScanStop();
        S.mpMode = mpm.dataset.mpmode === S.mpMode ? 'home' : mpm.dataset.mpmode;
        renderModal();
        return;
      }

      /* The picker stays alive underneath. It used to be torn down here, which
         threw away a basket somebody had spent four taps filling the moment
         they went to name a fifth thing — silently, with no way back. The
         form draws over it (renderModal checks newFood first) and hands what
         it makes to the basket rather than to the day. */
      var mpn = e.target.closest('[data-mpnew]');
      if (mpn && S.macroPick) {
        mScanStop();
        S.newFood = { slot: S.macroPick.slot, back: 1 };
        renderModal();
        return;
      }

      /* A result, taken. It fills the form rather than saving itself: the
         numbers are per 100 g or per packet serving, and only you know how
         much of it you actually ate. */
      var sc = e.target.closest('[data-scan]');
      if (sc && (S.newFood || S.macroPick)) {
        if (sc.dataset.scan === 'go') mScanStart();
        else mScanStop();
        return;
      }

      var nfp = e.target.closest('[data-nfpick]');
      if (nfp && (S.newFood || S.macroPick)) {
        var got = MLOOKUP[Number(nfp.dataset.nfpick)];
        /* Picked from inside the picker, where there is no form to fill: carry
           it over to the one screen that asks how much, rather than making the
           packet's numbers the answer to a question nobody asked. */
        if (got && S.macroPick && !$('nfName')) {
          mScanStop();
          S.newFood = { slot: S.macroPick.slot, pre: got, back: 1 };
          renderModal();
          return;
        }
        if (got) {
          $('nfName').value = got.name;
          $('nfUnit').value = got.unit;
          $('nfKcal').value = got.kcal;
          $('nfP').value = got.p;
          $('nfF').value = got.f;
          $('nfC').value = got.c;
          $('nfResults').innerHTML = '';
          $('nfNote').textContent = 'Filled in from ' + (got.note || 'the USDA') +
            '. Change the amount if you had more or less than one ' + got.unit + '.';
        }
        return;
      }

      var nf = e.target.closest('[data-nf]');
      if (nf && (S.newFood || S.macroPick)) {
        if (nf.dataset.nf === 'cancel') {
          mScanStop();
          var wasBack = S.newFood && S.newFood.back && S.macroPick;
          S.newFood = null;
          // back to the picker with the basket intact, not out of the sheet
          if (wasBack) { renderModal(); return; }
          close();
          return;
        }
        if (nf.dataset.nf === 'find' || nf.dataset.nf === 'code' || nf.dataset.nf === 'brand') {
          var term = String((($('nfFind') || {}).value) || '').trim();
          var byCode = nf.dataset.nf === 'code';
          var packaged = nf.dataset.nf === 'brand';
          if (!term) {
            $('nfResults').innerHTML = '<div class="mslot-empty">' +
              (byCode ? 'Type the number under the barcode.' : 'Type what it was.') + '</div>';
            return;
          }
          $('nfResults').innerHTML = '<div class="mslot-empty">Looking&hellip;</div>';
          MLOOKUP = {};
          (byCode ? mBarcodeLookup(term.replace(/\D/g, '')) : mFoodSearch(term, packaged))
            .then(function (list) {
              if (!$('nfResults')) return;
              $('nfResults').innerHTML = mLookupRows(list);
            }, function (err) {
              if (!$('nfResults')) return;
              $('nfResults').innerHTML = '<div class="mslot-empty">' +
                (err && err.message === 'nokey'
                  ? 'Looking food up needs a free USDA key in src/config.js. ' +
                    'Barcodes work without one.'
                  : err && err.message === 'nonutrition'
                    ? 'That one is known, but has no nutrition table yet. ' +
                      'Read it off the packet below.'
                    : err && err.message === 'toofast'
                      ? 'Asked too often just now. Wait a minute, or type it in below.'
                      : 'That did not come back. Type it in below instead.') + '</div>';
            });
          return;
        }
        var nval = function (id) { return String((($(id) || {}).value) || '').trim(); };
        var nnum = function (id) { return Math.max(0, Math.round(Number(($(id) || {}).value) || 0)); };
        var nm = nval('nfName');
        if (!nm) { $('nfNote').textContent = 'It needs a name to be findable again.'; return; }
        var kc = nnum('nfKcal'), pp = nnum('nfP'), ff = nnum('nfF'), cc = nnum('nfC');
        if (!kc && !pp && !ff && !cc) {
          $('nfNote').textContent = 'Give it at least the calories, or it counts for nothing.';
          return;
        }
        /* Macros but no calories: the calories follow from them rather than
           leaving the day's headline short by a whole plate. */
        if (!kc) kc = 4 * pp + 4 * cc + 9 * ff;
        var fkey = nm.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') ||
          ('x' + Date.now().toString(36));
        var allF = mReadMyFoods();
        allF[fkey] = { name: nm, unit: nval('nfUnit') || 'serving', kcal: kc, p: pp, f: ff, c: cc };
        mWriteMyFoods(allF);
        mBuildFoods();
        /* Named from inside the picker, so it joins the basket and the picker
           comes back — with it ticked, beside whatever was already waiting.
           Straight onto the day would have skipped the ✓ everything else
           goes through, and dropped the rest of the basket on the floor. */
        if (S.newFood.back && S.macroPick) {
          S.mpBasket['f:my:' + fkey] = 1;
          S.newFood = null;
          // home is where the basket is listed, so the new thing is visible
          S.mpMode = 'home';
          renderModal();
          return;
        }
        var nslot = S.newFood.slot;
        mEditDay(mViewKey(), function (day) {
          (day[nslot] = day[nslot] || []).push({ id: 'f:my:' + fkey, x: 1, eaten: 0 });
        });
        S.newFood = null;
        close();
        renderMacros();
        return;
      }

      /* Into the basket, not onto the day. Pressed again it comes back out,
         so a mis-tap costs a tap rather than a trip to the plate to delete
         it. Nothing reaches the day until ✓. */
      var mp = e.target.closest('[data-mpick]');
      if (mp && S.macroPick) {
        var mid = idOf(mp.dataset.mpick);
        if (S.mpBasket[mid] !== undefined) delete S.mpBasket[mid];
        else S.mpBasket[mid] = Number(mp.dataset.mpx) || 1;
        renderModal();
        return;
      }

      // one portion step on something in the basket, before it is committed
      var mpf = e.target.closest('[data-mpfav]');
      if (mpf && S.macroPick) {
        var fr = BY_ID[idOf(mpf.dataset.mpfav)];
        if (fr) { mToggleFav(fr); renderModal(); }
        return;
      }

      var mbs = e.target.closest('[data-mbstep]');
      if (mbs && S.macroPick) {
        var bp = mbs.dataset.mbstep.split(':');
        var bid = idOf(bp[0]);
        if (S.mpBasket[bid] !== undefined) {
          var nx2 = S.mpBasket[bid] + Number(bp[1]) * 0.25;
          S.mpBasket[bid] = Math.max(0.25, Math.min(4, nx2));
          renderModal();
        }
        return;
      }

      var mcommit = e.target.closest('[data-mpdone]');
      if (mcommit && S.macroPick) {
        var cslot = S.macroPick.slot, basket = S.mpBasket;
        S.mTouched = cslot;              // the meal you just filled stays open
        S.mFold[cslot] = false;
        mEditDay(mViewKey(), function (day) {
          var list = (day[cslot] = day[cslot] || []);
          Object.keys(basket).forEach(function (k) {
            list.push({ id: idOf(k), x: basket[k], eaten: 0 });
          });
        });
        mScanStop();
        close();
        renderMacros();
        return;
      }

      /* The sex and goal pickers flip in place rather than re-rendering the
         sheet — the sheet is a draft, and a redraw would cost the other boxes. */
      var mtd = e.target.closest('[data-mtdee]');
      if (mtd && S.macroTargOpen) {
        var prD = mReadProfile();
        prD.useTdee = mtd.dataset.mtdee === '1';
        mWriteProfile(prD);
        renderModal();
        if (S.view === 'macros') renderMacros();
        return;
      }

      var trn = e.target.closest('[data-mtrain]');
      if (trn && S.macroTargOpen) {
        var ti = Number(trn.dataset.mtrain);
        var days = mTrainDays(), at = days.indexOf(ti);
        if (at >= 0) days.splice(at, 1); else days.push(ti);
        var prT = mReadProfile();
        prT.train = days.sort(function (a, b) { return a - b; });
        mWriteProfile(prT);
        trn.setAttribute('aria-pressed', at >= 0 ? 'false' : 'true');
        mtRefreshPlan();
        if (S.view === 'macros') renderMacros();
        return;
      }

      var mseg = e.target.closest('[data-mtsex], [data-mtgoal]');
      if (mseg && S.macroTargOpen) {
        Array.prototype.forEach.call(mseg.parentElement.querySelectorAll('button[data-' +
          (mseg.dataset.mtsex ? 'mtsex' : 'mtgoal') + ']'), function (b) {
          b.setAttribute('aria-pressed', String(b === mseg));
        });
        mtRefreshPlan();
        return;
      }

      /* The meal rows are edited in place — add, remove, move up — because the
         sheet is a draft and a re-render would eat every half-typed box. */
      var msc = e.target.closest('[data-mtsec]');
      if (msc && S.macroTargOpen) {
        var scrow = msc.closest('.mtm-row');
        var list = scrow.querySelector('.mtm-secs');
        var summ = scrow.querySelector('.mtm-secsum');
        var openNow = msc.dataset.mtsec === 'show';
        list.classList.toggle('hide', !openNow);
        summ.classList.toggle('hide', openNow);
        if (!openNow) mtSecSumSync(scrow);
        return;
      }

      var mm = e.target.closest('[data-mtmeal]');
      if (mm && S.macroTargOpen) {
        var mact = mm.dataset.mtmeal;
        if (mact === 'add') {
          var holder = document.createElement('div');
          holder.innerHTML = mtMealRow({ k: 'k' + Date.now().toString(36) + (mtMealSeq++), n: '', t: 's' });
          $('mtMeals').appendChild(holder.firstChild);
          var nn = $('mtMeals').lastChild.querySelector('.mtm-name');
          if (nn) nn.focus();
        }
        var mrow = mm.closest('.mtm-row');
        if (mact === 'del' && mrow) mrow.parentNode.removeChild(mrow);
        if (mact === 'up' && mrow && mrow.previousElementSibling) {
          mrow.parentNode.insertBefore(mrow, mrow.previousElementSibling);
          mm.focus();
        }
        mtmShowTotal();
        return;
      }

      var med = e.target.closest('[data-mtedit]');
      if (med && S.macroTargOpen) {
        var shutNow = $('mtEditor').classList.toggle('hide');
        med.setAttribute('aria-expanded', String(!shutNow));
        return;
      }

      var ms = e.target.closest('[data-mysync]');
      if (ms) {
        var act2 = ms.dataset.mysync;
        S.myErr = '';
        S.myNote = '';
        var failed = function (err) {
          S.myErr = (err && err.code === 'auth/popup-blocked')
            ? 'The sign-in window was blocked. Allow pop-ups for this site, or use the email link.'
            : 'That did not go through. Try again, or use the other way in.';
          renderModal();
        };
        if (act2 === 'google') {
          /* On the redirect path this page is about to be replaced, and the
             flag that decides whether the next load reaches for Firebase at
             all is written on the way BACK — which never runs. So claim it
             now, before leaving. If the sign-in does not happen, the next
             load asks who we are, finds nobody, and clears it again. */
          if (window.Store.wantsRedirect && window.Store.wantsRedirect()) {
            try { localStorage.setItem('bsc.myAccount', '1'); } catch (er2) { /* private */ }
          }
          window.Store.signInGoogle().then(function () {
            S.mySent = false; mAccountMark(); mSyncStart(); renderModal();
          }, failed);
        }
        if (act2 === 'email') {
          var addr = String((($('myJoin') || {}).value) || '').trim();
          if (!/.+@.+\..+/.test(addr)) {
            S.myErr = 'That does not look like an email address.';
            renderModal();
            return;
          }
          window.Store.sendEmailLink(addr).then(function () {
            S.myJoin = addr; S.mySent = true; renderModal();
          }, failed);
        }
        if (act2 === 'push') {
          /* Restamp everything as of now so this device's copy is the newest
             on every part, then send it. Nothing is deleted anywhere else;
             it is simply outvoted. */
          var now = Date.now();
          ['t', 'pr', 'sl', 'w'].forEach(function (k) { MSTAMPS[k] = now; });
          MSTAMPS.d = MSTAMPS.d || {};
          Object.keys(MDAYS).forEach(function (k) { MSTAMPS.d[k] = now; });
          try { localStorage.setItem('bsc.myStamps', JSON.stringify(MSTAMPS)); }
          catch (er) { /* private mode */ }
          mSyncPush(true);
          S.myErr = '';
          S.myNote = 'Sent. Your other devices will take this the next time they look.';
        }
        if (act2 === 'pull') {
          /* Forget what is here and let the next snapshot fill it back in.
             The push that follows carries stamps of zero, so it cannot
             overwrite the account on the way past. */
          mForgetDay();
          renderMacros();
          mSyncStart();
          S.myNote = 'Cleared. Whatever your account holds is on its way down.';
        }
        if (act2 === 'out') {
          window.Store.signOutAccount().then(function () {
            S.mySent = false;
            mForgetDay();
            mAccountMark();
            mSyncStart();
            renderMacros();
            renderModal();
          }, failed);
        }
        renderModal();
        return;
      }

      var use = e.target.closest('[data-mtuse]');
      if (use && S.macroTargOpen) {
        var np = mPlanCalc(mtProfileFromDom());
        if (np && $('mtP')) {
          $('mtP').value = np.p; $('mtF').value = np.f; $('mtC').value = np.c;
          mtRefreshAnswer();
          $('mtCoach').innerHTML = mCoachHTML(mtProfileFromDom());
        }
        return;
      }

      var free = e.target.closest('[data-mtfree]');
      if (free && S.macroTargOpen) {
        // the weight stays; only the deadline goes, so it can be typed back
        if ($('mtGoalBy')) $('mtGoalBy').value = '';
        Array.prototype.forEach.call(document.querySelectorAll('#mtGoalSeg [data-mtgoal]'),
          function (b2) { b2.disabled = false; });
        $('mtGoalSeg').classList.remove('spent');
        mtRefreshPlan();
        return;
      }

      var mt = e.target.closest('[data-mtarg]');
      if (mt) {
        if (mt.dataset.mtarg === 'save') {
          // whole grams, never negative; 999 is not a limit anyone meets honestly
          var gv = function (id) {
            var el = $(id);
            var n = Math.round(Number(el && el.value) || 0);
            return Math.max(0, Math.min(999, n));
          };
          mWriteTargets({ p: gv('mtP'), f: gv('mtF'), c: gv('mtC') });
          // the profile rides along, so next time the sheet already knows you
          mWriteProfile(mtProfileFromDom());
          /* And the meals, as the rows now stand. A nameless row was a
             mistake rather than a meal, and an empty list would be a day
             with nowhere to put food — both fall back rather than save. */
          var mlist = [];
          Array.prototype.forEach.call(document.querySelectorAll('#mtMeals .mtm-row'), function (row) {
            var mname = row.querySelector('.mtm-name').value.trim();
            if (!mname) return;
            var mrec = { k: row.dataset.mtmk, n: mname, t: row.querySelector('.mtm-type').value };
            var mw = Math.round(Number(row.querySelector('.mtm-share').value) || 0);
            if (mw >= 1 && mw <= 99) mrec.w = mw;   // else the kind's default speaks
            if (mrec.t === 'x') {
              var msecs = [];
              Array.prototype.forEach.call(row.querySelectorAll('.mtm-secs input:checked'), function (cb) {
                msecs.push(cb.value);
              });
              // a meal that can draw from nothing is a mistake — fall back to snacks
              if (msecs.length) mrec.secs = msecs;
              else mrec.t = 's';
            }
            mlist.push(mrec);
          });
          if (mlist.length) {
            // pins ride along under the same key — saving the sheet must not
            // cost anybody their morning routine
            var keepPins = mReadSlots();
            mlist.forEach(function (s) {
              keepPins.list.forEach(function (ps) {
                if (ps.k === s.k && ps.pins && ps.pins.length) s.pins = ps.pins;
              });
            });
            /* Whatever the boxes added to, the saved shares add to 100 — a
               proportional rescale, rounded, with the drift handed to the
               biggest meal, where a point is least felt. */
            var sumW = 0;
            mlist.forEach(function (s) { sumW += mSlotW(s); });
            if (sumW > 0) {
              var acc = 0, biggest = mlist[0];
              mlist.forEach(function (s) {
                s.w = Math.max(1, Math.round(100 * mSlotW(s) / sumW));
                acc += s.w;
                if (s.w > biggest.w) biggest = s;
              });
              biggest.w += 100 - acc;
            }
            var prevSlots = mReadSlots();
            var mnames = prevSlots.names || {};
            mlist.forEach(function (s) { mnames[s.k] = s.n; });
            mWriteSlots({ list: mlist, names: mnames });
          }
        }
        close();
        renderMacros();
        return;
      }

      var sy = e.target.closest('[data-sync]');
      if (sy) {
        var act = sy.dataset.sync;
        if (act === 'reroll') { S.pendingCode = window.Store.newCode(); }
        /* Async because the code is checked against the server before it is
           handed over. It resolves with the code actually claimed, which is
           the one on screen unless it turned out to be taken. */
        if (act === 'use') {
          window.Store.createHousehold(S.pendingCode).then(function (code) {
            S.pendingCode = code;
            renderModal();
          });
        }
        if (act === 'join') {
          var v = ($('joinCode') || {}).value || '';
          if (v.trim()) window.Store.join(v);
        }
        if (act === 'leave') { window.Store.leave(); }
        renderModal();
      }
    });

    // the nutrition preview follows the ingredients as they are typed
    $('modalRoot').addEventListener('input', function (e) {
      if (S.editId && (e.target.id === 'edIng' || e.target.id === 'edServings' ||
        e.target.id === 'edExtras' || /^ed(Kcal|P|C|F)$/.test(e.target.id))) refreshPreview();
      if (S.syncOpen && e.target.id === 'myJoin') S.myJoin = e.target.value;
      if (S.newFood && e.target.id === 'nfFind') { /* typed; the buttons ask */ }
      if (S.macroPick && e.target.id === 'mpSearch') {
        S.mpQuery = e.target.value;
        refreshMacroPicker();
      }
      /* One box over two speeds. What is already on this device answers on
         the keystroke; the food tables are a request over a network, so they
         answer when they answer, underneath, and only once you have stopped
         typing long enough to mean it. */
      if (S.macroPick && e.target.id === 'mpLookIn') {
        S.mpLook = e.target.value;
        var el = $('mpLookList');
        if (el) el.innerHTML = mpLookHTML();
        clearTimeout(mLookTimer);
        var want = S.mpLook.trim();
        if ($('nfResults')) $('nfResults').innerHTML = '';
        if (want.length < 3) return;
        mLookTimer = setTimeout(function () { mLookNet(want); }, 550);
      }
      // the derived-kcal line follows the three targets as they are typed
      if (S.macroTargOpen && /^mt[PFC]$/.test(e.target.id)) mtRefreshAnswer();
      // and the plan preview follows the profile boxes
      if (S.macroTargOpen && /^mt(Age|Ft|In|Lb|GoalLb|GoalBy|Workouts|Steps)$/.test(e.target.id)) mtRefreshPlan();
      // and the share total follows the share boxes
      if (S.macroTargOpen && e.target.classList.contains('mtm-share')) mtmShowTotal();
      // and the folded summary follows the ticks, ready for when it folds
      if (S.macroTargOpen && e.target.closest('.mtm-secs')) mtSecSumSync(e.target.closest('.mtm-row'));
    });

    // a select fires change, not input, in enough browsers to matter
    $('modalRoot').addEventListener('change', function (e) {
      if (S.macroTargOpen && (e.target.id === 'mtAct' || e.target.id === 'mtGoalBy')) mtRefreshPlan();
      // the picker's two lenses redraw only the list, like the search box
      if (S.macroPick && e.target.id === 'mpSec') { S.mpSec = e.target.value; refreshMacroPicker(); }
      if (S.macroPick && e.target.id === 'mpSort') { S.mpSort = e.target.value; refreshMacroPicker(); }
      /* Choosing "Choose sections…" unfolds the checklist under that meal,
         seeded with whatever the previous kind drew from — a starting point
         to edit, not a blank sheet. Choosing a kind folds it away. */
      if (S.macroTargOpen && e.target.classList.contains('mtm-type')) {
        var trow = e.target.closest('.mtm-row');
        Array.prototype.forEach.call(trow.querySelectorAll('.mtm-secs, .mtm-secsum'),
          function (el) { el.parentNode.removeChild(el); });
        if (e.target.value === 'x') {
          var seed = MEAL_SECS[e.target.dataset.prev] || MEAL_SECS.s;
          var holder = document.createElement('div');
          // just chosen, so it opens ready to tick
          holder.innerHTML = mtSecsHTML(seed, true);
          while (holder.firstChild) trow.appendChild(holder.firstChild);
        }
        e.target.dataset.prev = e.target.value;
      }
    });

    $('newRecipe').addEventListener('click', function () { openEditor('new'); });

    document.addEventListener('keydown', function (e) {
      /* Tab stays inside whatever is up. A sheet, the editor and the dialog
         are all drawn over the collection rather than in place of it, so
         tabbing off the last control walked into the hundreds of cards behind
         — with no way back but Shift-Tab through all of them, and nothing on
         screen to say where the keyboard had gone. */
      if (e.key === 'Tab') {
        var scrim = document.querySelector('#modalRoot .scrim, #modalRoot .dlg');
        if (scrim) {
          var f = Array.prototype.filter.call(
            scrim.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'),
            function (el) { return el.offsetParent !== null; });
          if (f.length) {
            var first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            else if (!scrim.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
          }
        }
      }
      if (e.key === 'Escape' && D) { closeDialog(null); return; }
      if (e.key === 'Escape' && S.editId) { editorAction('cancel'); return; }
      if (e.key === 'Escape' && (S.openId || S.syncOpen || S.macroPick || S.macroTargOpen || S.newFood ||
        S.keepMeal || S.chartOpen || S.foodOpen)) close();
    });
  }

  /* ------------------------------------------------------------------------
   * The back gesture.
   *
   * There was no history here at all: the open recipe lived in a variable, so
   * swiping back did the only thing left to it and navigated out of the app.
   * Coming forward again landed on the grid with nothing open, and the recipe
   * you had been reading had to be found a second time.
   *
   * That got worse when recipes started pointing at each other. Following a
   * reference from the meatball feast to the breadcrumbs replaced the sheet —
   * deliberately, on the grounds that two recipes open at once is a back
   * button nobody asked for. Which was wrong twice over: somebody had asked
   * for it by swiping, and the gesture was already there.
   *
   * So each opened recipe is a history entry. Back walks the trail: from the
   * breadcrumbs to the feast to the grid. The × closes the lot in one, which
   * is what a close button means, so it jumps the whole depth rather than
   * unwinding it a page at a time.
   * --------------------------------------------------------------------- */
  var depth = 0;                 // history entries this modal has pushed
  var popping = false;           // inside a popstate, so do not push back

  /* Every sheet is an entry, not just a recipe.
   *
   * The first version of this pushed only when a recipe opened, which fixed
   * the case that was reported and left three that behave identically to a
   * reader: the Share sheet, the editor, and a confirm dialog all fill the
   * screen and all have an ×, and backing out of any of them navigated
   * straight out of the app. Same gesture, same-looking thing, three different
   * outcomes.
   *
   * The state carries the recipe id when there is one, so landing back on that
   * entry restores the recipe; anything else pops to a closed modal. Which
   * means the editor needs no special case: opened from a recipe it sits on
   * top of that entry and back lands on the recipe, opened from the header it
   * sits on the base entry and back closes. */
  function pushSheet(state) {
    if (popping) return;
    history.pushState(state || {}, '');
    depth++;
  }

  function openRecipe(id, scale) {
    if (id === S.openId) return;
    S.openId = id;
    // the Macros day hands in the batch that makes its portion; every other
    // door means the recipe as written
    S.scale = scale || 1;
    S.why = false;
    pushSheet({ r: String(id) });
    renderModal();
    var x = document.querySelector('.sheet-x');
    if (x) x.focus();
  }

  window.addEventListener('popstate', function (e) {
    var id = e.state && e.state.r;
    popping = true;
    /* A dialog is not part of the modal, so closing the modal would leave the
       question sitting there over a page it no longer belongs to. */
    if (D) closeDialog(false);
    if (id && BY_ID[id]) {
      depth = Math.max(0, depth - 1);
      S.openId = idOf(id);
      S.scale = 1;
      S.why = false;
      renderModal();
    } else {
      depth = 0;
      close();
    }
    popping = false;
  });

  function close() {
    /* Unwind every entry this modal pushed, so one press of × does not leave
       a trail of recipes behind the back gesture. */
    if (depth > 0 && !popping) {
      var n = depth;
      depth = 0;
      history.go(-n);
      return;
    }
    S.openId = null;
    S.syncOpen = false;
    S.mDoneOpen = '';
    /* The editor too. Without these the × and the backdrop looked broken:
       renderModal saw S.editId still set, drew the editor again, and the only
       way out was the Cancel button. */
    S.editId = null;
    S.editBase = null;
    // and the Macros sheets, for exactly the same reason
    if (S.macroPick) mScanStop();        // never leave the camera running
    S.macroPick = null;
    S.chartOpen = false;
    S.keepMeal = '';
    S.foodOpen = null;
    S.macroTargOpen = false;
    if (S.newFood) mScanStop();
    S.newFood = null;
    S.syncOpen = false;
    S.mDoneOpen = '';
    S.mpQuery = '';
    // a basket left behind would silently refill the next meal you opened
    S.mpBasket = {};
    renderModal();
    restoreOpener();
  }

  // ------------------------------------------------------------------- boot
  renderSections();
  wire();
  window.Store.init(function () { renderAll(); });
  renderAll();
})();
