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
    /* And forget which sections there are, because that answer has just
       changed. mAllSecs caches the section list off RECIPES, and RECIPES is
       replaced on the line above — a household member's first shared recipe,
       or the first one you write yourself, brings section 3-1 into a world
       that until then held only the two printed books.
     *
       A meal widened by ten "not that one"s draws from that cached list and
       from nothing else: 3-1 is in no entry of MEAL_SECS, so your own recipes
       reach a meal through the wide pool or they do not reach it at all. A
       stale copy therefore makes the recipe you have just written the one
       dish the machine will never offer, for the rest of the session, while
       the card goes on saying it is looking everywhere.
     *
       Cleared here rather than guarded inside mAllSecs because this is the
       only place RECIPES is ever reassigned: the cache goes stale exactly
       when this function runs, and at no other moment. */
    M_ALL_SECS = null;
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
       it was being ignored. A hundred and twenty-four foods carry a `def`
       written by somebody who knew the food, and the guess below was overruling all of
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
  /* A food of your own carries its own flag, because it lives in your own
     store. Everything else — a book recipe, a food out of the reference
     table — is kept in the household's favourites, which is a list of ids
     and has never cared what kind of id it is given. */
  function mIsFav(r) {
    if (r.food && String(r.id).indexOf('f:my:') === 0) return !!r.fav;
    return window.Store.isFav(r.id);
  }

  /* Everything can be kept.
   *
     The rule was "a book recipe is yours to keep and so is a food you typed
     in, but a food out of the reference table is the table's" — and Blake,
     looking at a breakfast of it: "I am not seeing a star on Greek yogurt.
     Why? ... if I select a food from the USDA food list and then favorite
     it, can it add to my database of foods that I like?"
   *
     Nothing was ever stopping it. Store.toggleFav takes an id and puts it in
     a list; the block was a judgement about whose the table is, and a list
     of foods you like is yours by definition. Kept as a function rather than
     deleted, because the picker and the plate both ask the question and must
     not come to differ about it again. */
  function mCanFav(r) {
    return !!r;
  }

  function mToggleFav(r) {
    if (!r.food) { window.Store.toggleFav(r.id); return; }
    var key = String(r.id).indexOf('f:my:') === 0 ? String(r.id).slice(5) : '';
    /* A table food is kept the way a recipe is: in the household's list, so
       it syncs, and so the fit scorer's favourite bonus reaches it. */
    if (!key) { window.Store.toggleFav(r.id); return; }
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
        /* Four-four-nine, like everything else the day counts — see the long
           note in score-lib. A food you typed yourself carries a calorie
           figure you copied off a packet, and honouring it would put one item
           on the day speaking a different language from every other: the
           meal's pills, the day's bars and the targets they are measured
           against are all macros times four and nine. The packet is not
           wrong, it is answering a question no screen here asks.

           Unless there are no macros to derive from. A food logged as
           calories alone keeps them — see the note at the save, and note that
           deriving here regardless would silently zero every one of those
           foods already saved on somebody's phone. */
        macro: (function () {
          var fp = Number(f.p) || 0, fc = Number(f.c) || 0, ff2 = Number(f.f) || 0;
          return { kcal: (fp || fc || ff2)
            ? kcalOf({ p: fp, c: fc, f: ff2 }) + (Number(f.kx) > 0 ? Math.round(Number(f.kx)) : 0)
            : Number(f.kcal) || 0,
          p: fp, c: fc, f: ff2,
          na: Number(f.na) || 0, fib: Number(f.fib) || 0 };
        }())
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
        id: 'f:' + key, food: true, side: !!f.side, eat: !!f.eat, lever: !!f.lever,
        meals: f.meals || '',
        /* which shelf a cook would reach on, carried through from the food
           table so mShelfKey does not have to keep its own list */
        veg: !!f.veg, starch: !!f.starch, shelf: f.shelf || '',
        /* Not on the storehouse order. Carried so the picker can offer it to
           log — Blake will happily go and buy salmon tomorrow — while Fill
           stays out of it unless he says otherwise, because a day drafted out
           of food that is not in the house is not a day.
         *
           `zone` is the Zone table's own block for the food, which is a
           judgement about what it is FOR rather than anything derivable from
           the macros, and it is the axis the shelf rail speaks. */
        ext: !!f.ext, zone: f.zone || '',
        book: 0, secNum: 0, secName: 'Single foods',
        name: name, servings: '1 ' + sv.unit, servN: 1, unit: sv.unit, grams: sv.grams,
        ing: [name], steps: [], est: true, score: null, diff: 'Easy', time: '0 mins',
        /* Derived from the ROUNDED macros beside it, not from the food
           table's own kcal — one calorie, the same one the recipes and the
           targets use. Rounded first so the four figures on the card add up
           to each other in the hand. */
        macro: (function () {
          var mp = Math.round((f.p || 0) * per * 10) / 10;
          var mc = Math.round((f.c || 0) * per * 10) / 10;
          var mf = Math.round((f.f || 0) * per * 10) / 10;
          return { kcal: Math.round(4 * mp + 4 * mc + 9 * mf), p: mp, c: mc, f: mf,
            na: Math.round((f.na || 0) * per), fib: Math.round((f.fib || 0) * per * 10) / 10 };
        }())
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
    /* Not 1-7. Batch Prep went onto lunch and dinner for one build (v466)
       and Fill served its containers at two and a half — chili at 1,303 mg
       from one bowl — so days over the salt ceiling went from 3 in 300 to 53.
       Meal-prep containers are sized to be eaten as one; the fitter sizes
       whatever it offers. So it is not offered unasked. Where one lands when
       you add it yourself is MSEC_HOME below. */
    l: ['1-3', '2-2'],
    d: ['1-4', '2-3', '2-4'],
    /* Not 2-6 and not 2-7. "A treat is a snack" held for churros; it did not
       hold for Worth the Afternoon — bread, cinnamon rolls, braised beef,
       chicken pot pie, 326 kcal a serving — or for the Copycat Shelf, where
       barbacoa and taco beef live. A fourteen-day audit on Blake's own plan
       had Snacks' Fits best opening on Braised Beef with Onion Gravy and Fill
       putting Taco Beef ×2¾ into an evening snack. The treats those shelves
       do hold are reachable by name and by the Every-recipe lens; they are
       just not offered unasked at ten at night. */
    s: ['1-2', '1-5', '1-6', '2-5', '2-8']
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
        return ['browse', 'plan', 'macros', 'train', 'list', 'pantry', 'book'].indexOf(v) >= 0 ? v : 'browse';
      } catch (e) { return 'browse'; }
    })(),
    bookF: 'all', secF: 'all', diffF: 'all', pantryF: 'all',
    favOnly: false, qy: '', sort: 'book', openId: null, scale: 1, printSet: 'all',
    filtPop: false,
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
    mpMode: 'home', mpFromBar: false,
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
    /* Which rung of each ladder the three-food combo is standing on. One
       index per macro so ‹ › walks ONE of them and the other two resize
       around it — walking all three at once is a different combo every
       press and no way to keep the half you liked. Ephemeral: the day moves
       under it, so yesterday's rung means nothing this morning. */
    mpCombo: { p: 0, f: 0, c: 0 },
    /* How far down each meal's ranked list Try again has walked, keyed day
       and meal. Ephemeral on purpose: tomorrow starts at the top again. */
    mTry: {},
    /* Which eaten plate has had its portion woken up for a correction. One at
       a time, and never persisted: it is a gesture, not a setting. */
    mEdit: '',
    /* Which plate has its portion open as a typed box, or null for none. One
       at a time and never persisted, for the same reason mEdit is not: it is
       a gesture. null rather than '' so "nothing is being typed" and "the box
       holds an empty string" can never be the same state. */
    mType: null,
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
    /* The strip's button says how many filters are on, so "Filters" with two
       set does not read the same as "Filters" with none. Sort counts: a list
       in protein order is not the book, and the reader may have forgotten. */
    var fn = filtCount();
    $('filtCount').textContent = fn ? String(fn) : '';
    $('filtBtn').setAttribute('aria-label', fn ? 'Filters, ' + fn + ' on' : 'Filters');

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
    /* A search that leaves twelve cards can pull the page back up past the
       rail, and the strip should go with it. */
    syncStrip();
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
  /* The two boot-time decisions about the targets — heal an uneatable plan,
     follow the scale weekly — WRITE, and a write is stamped now. Run before
     this device had heard from the account, a laptop last opened three days
     ago would follow the scale on its own stale copy, stamp it newer than
     the grams typed on the phone yesterday, and win: the phone's numbers
     and its "leave mine alone" were overwritten by the device that knew
     least. So a device with an account decides after the account's first
     real answer, and one without decides at boot as before. */
  var mBootTargetsDue = false;
  function mBootTargets() {
    if (!mBootTargetsDue) return;
    mBootTargetsDue = false;
    var moved = mHealTargets();
    if (mFollowScale()) moved = true;
    if (moved && S.view === 'macros') renderMacros();
  }

  function mSyncState(next) {
    S_SYNC_STATE = next;
    /* Signed out, as far as the server can tell: nobody else's copy is
       coming, so this device's is the one to decide on. */
    if (next === 'off' && mAuthKnown) mBootTargets();
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
    var st;
    try { st = JSON.parse(localStorage.getItem('bsc.myStamps')) || {}; }
    catch (e) { st = {}; }
    /* The weight log used to be stamped as one value, the way the profile and
       the targets still are, and that is what made a cleared weigh-in come
       back: one stamp for the whole map can only say "mine is newer", never
       "this morning is gone", so the merge had to union the two maps and a
       deletion had nowhere to live. It is stamped per morning now, like the
       day log and the closed days.
     *
       Devices upgrading carry a number here. Read as a map it would silently
       swallow every write — `n[key] = v` on a primitive throws nothing and
       stores nothing — so it is converted once, with the old single stamp
       standing as the stamp of every morning already logged. */
    if (typeof st.w === 'number') {
      var was = st.w, map = {};
      try {
        var w = JSON.parse(localStorage.getItem('bsc.macroWeights'));
        if (w && typeof w === 'object') {
          Object.keys(w).forEach(function (k) { map[k] = was; });
        }
      } catch (e2) { /* nothing logged, or unreadable: an empty map is right */ }
      st.w = map;
      try { localStorage.setItem('bsc.myStamps', JSON.stringify(st)); }
      catch (e3) { /* private mode: the conversion holds for this session */ }
    }
    return st;
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
      if (mDirty[part] !== true) {
        mDirty[part] = mDirty[part] || {};
        mDirty[part][sub] = 1;
      }
    } else {
      MSTAMPS[part] = now;
      mDirty[part] = true;
    }
    try { localStorage.setItem('bsc.myStamps', JSON.stringify(MSTAMPS)); } catch (e) { /* private */ }
    mSyncPush();
  }

  /* Every part stamped as of now, each in the shape it keeps its stamps: one
     number for a single value, a map for a part keyed by day or by morning.
     The first version of "this device is right" wrote a number over the
     weight map. Every morning then shipped with a stamp of zero, which no
     other device would take, and the next weigh-in tried to set a property
     on a number and threw. A part's stamp has one shape, and this is the
     only place that writes all of them at once. */
  function mClaimAll() {
    var now = Date.now();
    ['t', 'pr', 'sl', 'mf', 'nv'].forEach(function (k) { MSTAMPS[k] = now; });
    [['d', MDAYS], ['dn', MDONE], ['sp', MSKIP], ['sn', MSEND], ['w', MWEIGHTS],
      ['tn', MTRAINED]].forEach(function (pair) {
      var part = pair[0];
      var map = (MSTAMPS[part] && typeof MSTAMPS[part] === 'object') ? MSTAMPS[part] : {};
      MSTAMPS[part] = map;
      Object.keys(map).concat(Object.keys(pair[1])).forEach(function (k) { map[k] = now; });
    });
    try { localStorage.setItem('bsc.myStamps', JSON.stringify(MSTAMPS)); } catch (e) { /* private mode */ }
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
      'bsc.macroDone', 'bsc.macroSkip', 'bsc.macroSend', 'bsc.macroTrained',
      'bsc.macroHush', 'bsc.macroIntake', 'bsc.macroDayT', 'bsc.macroNever'].forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) { /* private mode */ }
    });
    Object.keys(MDAYS).forEach(function (k) { delete MDAYS[k]; });
    Object.keys(MWEIGHTS).forEach(function (k) { delete MWEIGHTS[k]; });
    Object.keys(MINTAKE).forEach(function (k) { delete MINTAKE[k]; });
    Object.keys(MDAYT).forEach(function (k) { delete MDAYT[k]; });
    Object.keys(MNEVER).forEach(function (k) { delete MNEVER[k]; });
    Object.keys(MSTAMPS).forEach(function (k) { delete MSTAMPS[k]; });
    Object.keys(MDONE).forEach(function (k) { delete MDONE[k]; });
    Object.keys(MSKIP).forEach(function (k) { delete MSKIP[k]; });
    Object.keys(MHUSH).forEach(function (k) { delete MHUSH[k]; });
    Object.keys(MSEND).forEach(function (k) { delete MSEND[k]; });
    Object.keys(MTRAINED).forEach(function (k) { delete MTRAINED[k]; });
    /* And the training log, which is kept beside the day in the same record
       and has to leave with it for exactly the same reason. */
    if (window.Train) window.Train.forget();
  }

  function mAccountMark() {
    try {
      if (mAccount()) localStorage.setItem('bsc.myAccount', '1');
      else localStorage.removeItem('bsc.myAccount');
    } catch (e) { /* private mode: this session only */ }
  }

  /* What this device would send. Read fresh each time so it never ships a
     stale copy of something edited in another tab. */
  /* ---------------------------------------------------------------- the parts
   *
   * Every part of My Day that travels, described once.
   *
   * It used to be described four times: once in the payload builder, once in
   * the merge, once in the list of stores to persist, and once more in
   * whichever writer stamped it. Five near-identical blocks on each side, the
   * same key-encoding written out six times in each direction, and 210 lines
   * between them. Adding anything that syncs meant writing that block a
   * seventh time in two places and hoping the two matched.
   *
   * They did not. `tn` — "trained today" — was merged and then left out of the
   * list of stores to persist, so a tick arriving from the other phone moved
   * the day's carbohydrate and then vanished on the next reload: 118 g back to
   * 63 with nothing said. A list that is DATA cannot forget a member; a list
   * that is four hand-written blocks can, and did.
   *
   *   value(k)  what this device says about that key
   *   stamps    whether the payload also speaks for keys it has a STAMP for
   *             but no value. That is how a DELETION crosses: an absent key is
   *             indistinguishable from a key never heard of, so a part that
   *             can be deleted has to keep speaking about it. `d` does not
   *             need to: nothing in the interface deletes a day. Emptying one
   *             leaves the day in place, empty, and that travels; the only
   *             deletion is the fourteen-day window, which every device
   *             applies to itself.
   *   accept(r) whether a remote entry is sayable at all
   *   put(k,v)  how a remote value lands
   *   ls        where it is kept, so the persist step cannot miss one
   *
   * The stores are reached through a function because several of them are
   * assigned by IIFEs further down the file, and a table that captured them
   * at definition time would capture undefined. */
  function mSyncKey(k) { return String(k).replace(/-/g, '_'); }

  /* What a value from another device has to look like before it is let in.
     The merge used to check only that something was there, so a string where
     a list belongs landed in storage and broke the next render — on every
     device, until somebody cleared it. Found when a test fixture put a string
     in `sn.to`. A value of the wrong shape is ignored, as if it never came:
     the next push from a device that has it right corrects the record. */
  function mPlainObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function mNum(v) { return typeof v === 'number' && isFinite(v); }
  function mStrList(v) {
    return Array.isArray(v) && v.every(function (x) { return typeof x === 'string'; });
  }
  var MSYNC_SHAPE = {
    mf: mPlainObj,
    nv: mPlainObj,
    t: function (v) { return mPlainObj(v) && mNum(v.p) && mNum(v.f) && mNum(v.c); },
    pr: mPlainObj,
    sl: function (v) { return mPlainObj(v) && Array.isArray(v.list); }
  };
  function mSyncUnkey(e) { return String(e).replace(/_/g, '-'); }

  var MSYNC_SIMPLE = [
    ['mf', 'bsc.myFoods'], ['t', 'bsc.macroTargets'], ['nv', 'bsc.macroNever'],
    ['pr', 'bsc.macroProfile'], ['sl', 'bsc.macroSlots']
  ];

  var MSYNC_KEYED = [
    { part: 'w', ls: 'bsc.macroWeights', stamps: true,
      store: function () { return MWEIGHTS; },
      value: function (k) { return MWEIGHTS[k] || 0; },
      /* Zero is a real answer: it is the morning you cleared. */
      accept: function (r) { return mNum(r.v) && r.v >= 0; },
      put: function (k, v) { if (v > 0) MWEIGHTS[k] = v; else delete MWEIGHTS[k]; } },

    { part: 'd', ls: 'bsc.macroDays', stamps: false,
      store: function () { return MDAYS; },
      value: function (k) { return MDAYS[k]; },
      /* A day is meals keyed by slot, each a list of plates. */
      accept: function (r) {
        return mPlainObj(r.v) && Object.keys(r.v).every(function (sk) {
          var m = r.v[sk];
          return m === null || m === undefined || (Array.isArray(m) && m.every(mPlainObj));
        });
      },
      put: function (k, v) { MDAYS[k] = v; } },

    { part: 'dn', ls: 'bsc.macroDone', stamps: false,
      store: function () { return MDONE; },
      value: function (k) { return mDoneAt(k); },
      /* Zero means "I reopened this", so a falsy value must still land. */
      accept: function (r) { return mNum(r.v); },
      put: function (k, v) { MDONE[k] = Number(v) || 0; } },

    { part: 'tn', ls: 'bsc.macroTrained', stamps: false,
      store: function () { return MTRAINED; },
      value: function (k) { return mTrainedAt(k); },
      /* And zero here means "I un-ticked it". */
      accept: function (r) { return mNum(r.v); },
      put: function (k, v) { MTRAINED[k] = Number(v) || 0; } },

    { part: 'sp', ls: 'bsc.macroSkip', stamps: true,
      store: function () { return MSKIP; },
      value: function (k) { return MSKIP[k] || []; },
      /* An empty list is a real answer: it means "I un-skipped them all". */
      accept: function (r) { return mStrList(r.v); },
      put: function (k, v) { if (v.length) MSKIP[k] = v.slice(); else delete MSKIP[k]; } },

    { part: 'sn', ls: 'bsc.macroSend', stamps: true,
      store: function () { return MSEND; },
      value: function (k) { return MSEND[k] || null; },
      /* Null is a real answer: it means "I cleared that day's choice". */
      accept: function (r) {
        var v = r.v;
        if (v === null || v === undefined) return true;
        return mPlainObj(v) && (v.to === undefined || mStrList(v.to)) &&
          (v.f === undefined || typeof v.f === 'string');
      },
      put: function (k, v) {
        if (v && typeof v === 'object' && !Array.isArray(v)) MSEND[k] = v;
        else delete MSEND[k];
      } }
  ];

  function mLsJson(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }

  /* ------------------------------------------------- what actually goes up
   *
   * Everything, once, and then only what moved.
   *
   * Every change used to re-serialise and re-upload the whole of My Day:
   * fourteen days of meals, a year of mornings, every stamp — eight to twenty
   * kilobytes to record that one plate was ticked, which is two hundred bytes
   * of news. Firestore bills per document WRITE rather than per byte, and the
   * writes were already debounced to one per burst, so this never cost money.
   * It cost the phone: mobile data, radio time and battery, forty to a hundred
   * times over, on every tap.
   *
   * set(merge:true) deep-merges nested maps, so naming one day inside one part
   * leaves every other day in that part exactly where it was. No field paths,
   * no update() that fails on a document which does not exist yet.
   *
   * mStamp already knows precisely what changed — it is the function that
   * records it — so the dirty set costs nothing to keep.
   *
   * The FIRST push of a session is always whole, because the far end may be
   * missing things this device has and a partial push cannot say so. And a
   * failed push goes back to whole: the dirty set is cleared as the write
   * leaves, so that changes made while it is in flight are not swallowed, and
   * the only safe thing to do with a write that never landed is to send
   * everything next time. */
  var mDirty = {}, mDirtyAll = true;

  function mSyncPayload() {
    var raw = mLsJson;
    var out = {};
    MSYNC_SIMPLE.forEach(function (row) {
      out[row[0]] = { v: raw(row[1]), at: MSTAMPS[row[0]] || 0 };
    });
    MSYNC_KEYED.forEach(function (row) {
      var keys = {}, map = {};
      Object.keys(row.store()).forEach(function (k) { keys[k] = 1; });
      if (row.stamps) {
        Object.keys(MSTAMPS[row.part] || {}).forEach(function (k) { keys[k] = 1; });
      }
      Object.keys(keys).forEach(function (k) {
        map[mSyncKey(k)] = { v: row.value(k), at: (MSTAMPS[row.part] || {})[k] || 0 };
      });
      out[row.part] = map;
    });
    return out;
  }

  /* Only what moved since the last push, in the same shape as the whole. Off
     the same table, so a part cannot be in one builder and not the other. */
  function mSyncPartial() {
    var out = {}, any = false;
    MSYNC_SIMPLE.forEach(function (row) {
      if (!mDirty[row[0]]) return;
      out[row[0]] = { v: mLsJson(row[1]), at: MSTAMPS[row[0]] || 0 };
      any = true;
    });
    MSYNC_KEYED.forEach(function (row) {
      var marks = mDirty[row.part];
      if (!marks) return;
      var keys = marks === true ? Object.keys(row.store()) : Object.keys(marks);
      var map = {};
      keys.forEach(function (k) {
        /* A cleared key still goes up, carrying whatever its part calls
           nothing — a zero weight, an empty skip list, a null send. That is
           the only way a DELETION crosses: an absent key is indistinguishable
           from a key the far end never heard of. */
        map[mSyncKey(k)] = { v: row.value(k), at: (MSTAMPS[row.part] || {})[k] || 0 };
      });
      if (Object.keys(map).length) { out[row.part] = map; any = true; }
    });
    return any ? out : null;
  }

  /* What goes up, and the marking of it as gone — one act, because they have
     to happen together and a caller that could do one without the other is a
     caller that will.
   *
     The CHOICE lives here rather than inline in mSyncPush so a test can ask
     the real question. A guard that asked the partial BUILDER proved the
     builder works and nothing about whether anything calls it, which is
     exactly what a mutation found: every push was made whole again and the
     guard went on passing.
   *
     Cleared as the body is taken, not when the write lands, so a change made
     while it is in flight is dirty again rather than swallowed. */
  function mSyncTake() {
    var body = mDirtyAll ? mSyncPayload() : mSyncPartial();
    mDirtyAll = false;
    mDirty = {};
    return body;
  }

  /* Newer wins, part by part. Returns true when anything here changed, so the
     caller knows whether to redraw. Pure enough to test without a network. */
  function mMergeRemote(md) {
    if (!md) return false;
    var moved = false;
    var take = function (part, key, apply) {
      var r = md[part];
      if (!r || !r.v || !(r.at > (MSTAMPS[part] || 0))) return;
      if (MSYNC_SHAPE[part] && !MSYNC_SHAPE[part](r.v)) return;
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
    take('nv', 'bsc.macroNever', function (v) {
      Object.keys(MNEVER).forEach(function (k) { delete MNEVER[k]; });
      Object.keys(v).forEach(function (k) { MNEVER[k] = v[k]; });
      try { localStorage.setItem('bsc.macroNever', JSON.stringify(v)); } catch (e) { /* private */ }
    });
    /* Per morning, newest wins, and zero is a real answer — the same three
       rules the closed-day log runs on, and for the same reason. A morning
       cleared on one phone used to come straight back from the other's next
       push: the map was unioned in wholesale and nothing in it could say a
       morning had been taken away. Since v271 that also quietly moved the
       targets, because the plan is built on the seven-day average.
     *
       The old single-stamped shape is still read, because a phone that has
       not been opened since v288 is still pushing it. Unioned, exactly as it
       used to be: those payloads genuinely cannot express a deletion, and
       guessing one from an absent key would delete every morning that phone
       has not heard of yet. */
    /* The old single-stamped shape is still read, because a phone that has
       not been opened since v288 is still pushing it. Unioned, exactly as it
       used to be: those payloads genuinely cannot express a deletion, and
       guessing one from an absent key would delete every morning that phone
       has not heard of yet. Handled apart from the table because it is not a
       shape the table describes — it is the shape that came before it. */
    var wRemote = md.w;
    var legacyW = wRemote && wRemote.v && typeof wRemote.at === 'number';
    if (legacyW) {
      MSTAMPS.w = MSTAMPS.w || {};
      Object.keys(wRemote.v).forEach(function (k) {
        if (!(wRemote.at > (MSTAMPS.w[k] || 0))) return;
        MWEIGHTS[k] = wRemote.v[k];
        MSTAMPS.w[k] = wRemote.at;
        moved = true;
      });
    }

    /* And every keyed part, by the one description of it. Newer wins, per
       key, and what "newer" and "sayable" mean is the part's own business —
       see MSYNC_KEYED. This was five hand-written blocks that differed only
       in which guard they used and which map they wrote, and the one thing
       they had in common, remembering to persist afterwards, is the thing one
       of them did not do. */
    MSYNC_KEYED.forEach(function (row) {
      if (row.part === 'w' && legacyW) return;
      var from = md[row.part] || {};
      Object.keys(from).forEach(function (enc) {
        var k = mSyncUnkey(enc), r = from[enc];
        if (!r || !row.accept(r)) return;
        if (!(r.at > ((MSTAMPS[row.part] || {})[k] || 0))) return;
        row.put(k, r.v);
        MSTAMPS[row.part] = MSTAMPS[row.part] || {};
        MSTAMPS[row.part][k] = r.at;
        moved = true;
      });
    });
    /* Persisted off the same table that merged them. This was a hand-written
       list of five setItem calls beside a merge that touched six stores, and
       the missing one was `bsc.macroTrained`: a training tick from the other
       phone moved the day's carbohydrate and then went back on the next
       reload, 118 g to 63 with nothing said. A list that is data cannot
       forget a member. */
    if (moved) {
      try {
        MSYNC_KEYED.forEach(function (row) {
          localStorage.setItem(row.ls, JSON.stringify(row.store()));
        });
        localStorage.setItem('bsc.myStamps', JSON.stringify(MSTAMPS));
      } catch (e) { /* private mode: this session only */ }
    }
    return moved;
  }

  var mSyncDoc = null, mSyncOff = null, mSyncTimer = null;

  /* The kitchen travels with the account.
   *
     Signing in used to carry My Day and nothing else. Favorites, recipes of
     your own, the weeks and the pantry live in the household document, which
     a device reaches only by holding its code — so a second device signed in
     as you opened on an empty book and looked like a sync that had done
     nothing. Blake: "when i logged into the app on my PC i expect to see
     exactly what is on my phone."
   *
     So the account keeps the code, as `house` on /users/{uid}. Absent means
     no device has ever told it one; '' means somebody signed in chose to stop
     sharing, and is not to be undone by the next device that opens. */
  var mAcctHouse;               // undefined until the server has said
  var mHouseAsked = false;      // one question a session, not one a snapshot
  var mHouseTellNext = false;   // a join or create was asked for here: report it once it is real
  var mHouseMaking = false;

  function mHouseTell(code) {
    mAcctHouse = code;
    if (mSyncDoc) mSyncDoc.set({ house: code }, { merge: true }).catch(function () { /* next snapshot retries */ });
  }

  /* Whether this device holds anything that would be lost if it stayed on this
     device. A fresh one does not, and must not make a kitchen for the account
     just by being opened first — that would be an empty kitchen standing in
     front of the real one on the phone. */
  function mHouseWorthKeeping() {
    var st = window.Store.state;
    var some = function (o) { return o && Object.keys(o).length > 0; };
    if (st.favs && st.favs.length) return true;
    if (some(st.mine) || some(st.edits) || some(st.pantry) || some(st.pantryNew)) return true;
    return Object.keys(st.weeks || {}).some(function (k) {
      var plan = st.weeks[k].plan || {};
      return Object.keys(plan).some(function (d) { return (plan[d] || []).length; });
    });
  }

  /* Only ever from a server answer: a cached snapshot that lacks `house`
     is not an account that lacks one. */
  function mHouseReconcile(data) {
    var has = Object.prototype.hasOwnProperty.call(data, 'house') && typeof data.house === 'string';
    var theirs = has ? data.house : '';
    var mine = window.Store.house;
    mAcctHouse = has ? theirs : undefined;
    /* A join, a new pantry or an invite is on its way from this device. The
       account hears about it once it is real; until then the account's old
       answer is not a disagreement to act on. */
    if (mHouseTellNext || mInviteBusy) return;
    if (!has) {
      if (mine) { mHouseTell(mine); return; }
      /* Once. Snapshots keep arriving while the transaction is out, and each
         would otherwise draw a second pantry for the same person. */
      if (!mHouseMaking && mHouseWorthKeeping()) {
        mHouseMaking = true;
        mHouseTellNext = true;
        window.Store.createHousehold().then(function () { mHouseMaking = false; },
          function () { mHouseMaking = false; });
      }
      return;
    }
    if (!theirs || theirs === mine) return;
    if (!mine) { window.Store.join(theirs); return; }
    if (mHouseAsked) return;
    mHouseAsked = true;
    ask({
      title: 'Use your account’s pantry?',
      body: 'This device is sharing ' + mine + '. Your account uses ' + theirs +
        '. Switching brings what is on this device along with it.',
      ok: 'Switch this device'
    }, function (yes) { if (yes) window.Store.join(theirs); });
  }

  /* Called on every Store change. A join typed here, or a pantry made here,
     becomes the account's once the server has confirmed it exists — not
     before, or a mistyped code would be written over the real one. */
  /* ------------------------------------------------------------ invites
   *
     A link from somebody's "Invite someone" arrives as ?invite=<token>. It is
     kept in localStorage straight away, because signing in on a phone leaves
     the page and comes back, and anything held only in memory would not make
     the trip. It is spent the first time this device knows who it is. */
  var mInviteBusy = false;
  function mInviteGet() {
    try { return localStorage.getItem('bsc.invite') || ''; } catch (e) { return ''; }
  }
  function mInviteSet(tok) {
    try {
      if (tok) localStorage.setItem('bsc.invite', tok); else localStorage.removeItem('bsc.invite');
    } catch (e) { /* private mode: held for this page only */ }
  }
  function mInviteTry() {
    var tok = mInviteGet();
    if (!tok || mInviteBusy || !mAccount() || !window.Store.redeem) return;
    mInviteBusy = true;
    mHouseTellNext = true;
    window.Store.redeem(tok).then(function () {
      mInviteSet('');
      mInviteBusy = false;
      S.inviteMsg = 'You joined the pantry.';
      renderAll();
    }, function (err) {
      mInviteBusy = false;
      mHouseTellNext = false;
      var why = err && err.message;
      /* A network failure keeps the invite for the next try; a refusal from
         the invite itself does not, or it would be refused on every load. */
      if (why === 'spent' || why === 'gone') mInviteSet('');
      S.inviteMsg = why === 'spent' ? 'That invite has been used or has expired. Ask for a new link.'
        : why === 'gone' ? 'That invite link is not valid. Ask for a new one.'
          : 'Could not join the pantry yet. It will try again when there is signal.';
      renderAll();
    });
  }

  function mHouseWatch() {
    if (!mHouseTellNext || !mSyncDoc || !mAccount()) return;
    var st = window.Store.status, code = window.Store.house;
    if (!code) { if (st === 'local') mHouseTellNext = false; return; }
    if (st !== 'synced') return;
    mHouseTellNext = false;
    if (code !== mAcctHouse) mHouseTell(code);
  }
  /* The last attempt to reach the server failed, rather than answering
     "nobody". The two are different facts and the sheet has different
     words for them, but only one of them survived: ready() rejects, the
     state goes to 'error', and then the NEXT mSyncStart — opening the
     sheet, pressing a button — finds mAuthKnown true and nobody signed in,
     falls through to the signed-out branch and writes 'off' straight over
     it. "Cannot reach the server" could never reach the screen it was
     written for; a dead network read as a fresh invitation to sign in. */
  var mSyncUnreachable = false;

  function mSyncStart() {
    if (mSyncOff) { mSyncOff(); mSyncOff = null; mSyncDoc = null; }
    if (window.Train) window.Train.attach(null);
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
          mSyncUnreachable = false;                 // the server answered
          if (mAccount()) mSyncStart();
          /* The device said it had an account and the server says otherwise.
             That is the drift this whole re-affirmation exists to catch, so
             it has to reach the gear and not just the sheet. */
          else mSyncState('off');
        }, function () {
          mAuthKnown = true;
          mSyncUnreachable = true;
          mSyncState('error');
        });
        return;
      }
      mAuthKnown = true;
      /* Signed out, or unreachable and this device remembers an account.
         Only the second of those is worth a warning, and only that one keeps
         the error it already has. */
      mSyncState(mSyncUnreachable && mSuspectAccount() ? 'error' : 'off');
      return;
    }
    mSyncState('connecting');
    window.Store.ready().then(function (db) {
      mAuthKnown = true;
      mSyncUnreachable = false;             // it answered
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
      if (window.Store.enrol) window.Store.enrol();
      mInviteTry();
      mSyncDoc = db.collection('users').doc(uid);
      /* Train keeps its log in the same document, under `train`, and rides
         this listener rather than opening a second one on the same record. */
      if (window.Train) window.Train.attach(mSyncDoc);
      /* includeMetadataChanges for the same reason as the household
         listener in sync.js: the step from a cache answer to a server answer
         changes no data, and without it that step is never heard. */
      mSyncOff = mSyncDoc.onSnapshot({ includeMetadataChanges: true }, function (snap) {
        var data = snap.exists ? (snap.data() || {}) : null;
        /* Only when the server actually answered. A snapshot served from the
           local cache is Firestore handing back what this device already had,
           and calling that "Synced" told you the other phone had your day
           when nothing had left the building. The household half of this app
           has always checked; My Day never did, so the two sides of one
           screen gave different answers to the same question. */
        mSyncState(snap.metadata && snap.metadata.fromCache ? 'connecting' : 'on');
        var live = !(snap.metadata && snap.metadata.fromCache);
        if (live) mHouseReconcile(data || {});
        if (window.Train) window.Train.remote(data && data.train, live);
        if (!data || !data.myday) { if (live) mBootTargets(); mSyncPush(true); return; }
        if (mMergeRemote(data.myday) && S.view === 'macros') renderMacros();
        if (live) mBootTargets();
        if (S.syncOpen) renderModal();
      }, function () { mSyncState('error'); });
      mSyncPush(true);
    }, function () { mSyncState('error'); });
  }

  /* Everything of yours, gone from both ends.

     The remote record first, through the sync layer, and this device's copy
     inside it — mForgetDay wipes the local stores AND the module-level
     objects the payload is rebuilt from, which matters: clearing storage
     alone would leave the next push to write it all straight back up.

     The household is deliberately untouched. It is a shared thing, the rules
     do not permit deleting it, and taking a spouse's meal plan away because
     you closed your own account would be a surprise nobody asked for. */
  function mDeleteAccount() {
    if (!window.Store || !window.Store.deleteAccount) return Promise.reject(new Error('no-account'));
    return window.Store.deleteAccount(function () {
      if (mSyncOff) { mSyncOff(); mSyncOff = null; }
      mSyncDoc = null;
      if (window.Train) window.Train.attach(null);
      mForgetDay();
      return null;
    }).then(function () {
      mSyncState('local');
      mAccountMark();
      if (S.view === 'macros') renderMacros();
      if (S.syncOpen) renderModal();
    });
  }

  function mSyncPush(now) {
    if (!mSyncDoc) return;
    /* `now` is also "and whole". Its three callers are the moments a partial
       push cannot answer for: the first sight of the document, a document
       with nothing in it, and a device that has just been handed the day. */
    if (now) mDirtyAll = true;
    clearTimeout(mSyncTimer);
    mSyncTimer = setTimeout(function () {
      var body = mSyncTake();
      if (!body) { mSyncState('on'); return; }
      mSyncDoc.set({ myday: body }, { merge: true }).then(function () {
        mSyncState('on');
      }, function () {
        /* A write that never landed leaves this device unable to say what the
           far end is missing, so the next one says everything. */
        mDirtyAll = true;
        mSyncState('error');
      });
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
  /* The day on screen. With no day chosen it is today — but "today" as of
     the last time the screen was DRAWN, not as of the tap: a phone left on
     My Day across midnight still shows yesterday's plates, and a tap on one
     used to tick or delete the plate in that slot on the NEW day. The next
     draw moves the screen on; until then, taps go where the eye is. */
  var mDrawnToday = '';
  function mViewKey() { return S.macroDate || mDrawnToday || todayKey(); }

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
  /* Over, in one place. The bar and the week strip both answer "is this day
     past its target" and used to answer it differently, which put a red
     square above a green bar about the same day. */
  /* Blake, on a week he felt had gone fine and a strip that said otherwise:
     "widen the threshold for what the target is. ±125 cals, or possibly a
     reasonable %?" A percentage, so it scales with the plan: 6.5% is 125
     calories on his 1,910 and 90 on a 1,400 cut. The strip, the day's bars
     and the pills all read this one number, so one verdict is one verdict. */
  var MKCAL_OVER = 106.5;

  /* On, over or under, for one macro of one day — the bars' rule, so that
     anything else judging a day says what the bars say. Calories are on
     within MKCAL_OVER of the line either side; the grams within 10 g; past
     that, over at 106.5% for calories, 110% for protein (the one a cut
     wants overshot) and 100% for the rest, and under below 90%. */
  function mVerdict(m, got, target) {
    if (!(target > 0)) return 'on';
    var diff = got - target, pct = 100 * got / target;
    var near = m === 'kcal' ? Math.abs(diff) <= target * ((MKCAL_OVER - 100) / 100)
      : Math.abs(diff) <= 10;
    var overAt = m === 'p' ? 110 : m === 'kcal' ? MKCAL_OVER : 100;
    return near ? 'on' : pct > overAt ? 'over' : pct >= 90 ? 'on' : 'under';
  }

  function mAhead(k) { return k > todayKey(); }

  function mReadTargets() {
    var t = null;
    try {
      var raw = JSON.parse(localStorage.getItem('bsc.macroTargets'));
      if (raw && isFinite(raw.p) && isFinite(raw.f) && isFinite(raw.c)) {
        t = { p: Number(raw.p), f: Number(raw.f), c: Number(raw.c) };
      }
    } catch (e) { /* private mode or a corrupt value — nothing is stored */ }
    /* Nothing stored is not the same as a plan of 180/50/50. That triple was
       a placeholder that hardened into an assertion: it belongs to nobody —
       not even to the person it was typed for, whose own profile works out to
       something else — and every screen that reads a target rendered it in
       exactly the shape it renders a plan somebody made. A first run opened on
       "No plan yet." above a full week of 1,370-kcal budgets, four bars
       reading 0 / 180 g, and a Fill button that would draft a real day out of
       real recipes against a target nobody had set.
     *
       Zero is what the rest of this file was already written for. Both empty
       states downstream — macroFootHTML's "Craft your plan." and the meal
       pills' silent strip — guard on all three being falsy, and with a
       placeholder in their way neither could ever fire; they were written
       correctly, twice, and defeated here. mShares denominates with
       Math.max(1, targets[m]) for the same reason, so an unset target still
       divides. Handing back zeros does not add an empty state. It lets the
       two that were always here start working. */
    if (!t) return { p: 0, f: 0, c: 0 };
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
    var starved = 4 * t.c < MCARB_EAT * kcalOf(t);
    if (tdee !== null && (kcalOf(t) < mFloorK(pr) || starved)) {
      var fresh = mPlanCalc(pr);
      if (fresh && (kcalOf(fresh) > kcalOf(t) || fresh.c > t.c)) {
        t = { p: fresh.p, f: fresh.f, c: fresh.c };
      }
    }
    return t;
  }

  /* And the same correction, WRITTEN, which is a different act.
   *
     mReadTargets used to do both: it worked the day out, then saved it, then
     stamped it, and a stamp pushes. So a render could put a request on the
     network. It healed once and then stopped, so it was never a loop — but a
     read that writes is a read you cannot reason about, and the next person
     to call it from somewhere unexpected inherits the surprise.
   *
     Called where a decision is actually being made: once at boot, and again
     whenever the profile changes, which is the only thing that can turn a
     stored plan into an uneatable one. */
  function mHealTargets() {
    var was = null;
    try { was = JSON.parse(localStorage.getItem('bsc.macroTargets')); } catch (e) { /* none */ }
    if (!was) return false;
    var now = mReadTargets();
    if (!kcalOf(now)) return false;
    if (Number(was.p) === now.p && Number(was.f) === now.f && Number(was.c) === now.c) {
      return false;
    }
    /* The grams change; what the record says about itself does not. */
    mWriteTargets(Object.assign({}, was, { p: now.p, f: now.f, c: now.c }));
    return true;
  }
  function mWriteTargets(t) {
    mStamp('t');
    try { localStorage.setItem('bsc.macroTargets', JSON.stringify(t)); }
    catch (e) { /* private mode: the render reads defaults, nothing breaks */ }
  }

  /* ------------------------------------------------ targets follow the scale
   *
     The plan card worked its calories out from this week's weight; the bars
     scored the day against the grams saved when Save was last pressed. Ten
     pounds later those were two different days, on one screen. Blake chose
     to have the saved targets follow the scale once a week, the way RP
     adjusts, and to be told when they move.
   *
     The record carries three things beside the grams:
       auto   1 when the grams are the plan's own; 0 when somebody typed their
              own numbers into the boxes, which are theirs and are left alone.
              Absent on a record saved before this — treated as the plan's,
              since the boxes are filled from the plan, and the notice's Undo
              is there for the one that was not.
       set    the day the grams were last decided, by anybody.
       moved  what the last weekly change was, for the notice: from and to in
              kcal, the day, and the grams before, so Undo can put them back.
   *
     Only on a week with a weigh-in in it. With nothing new on the scale the
     plan cannot have moved, and a "change" worked out from a stale average
     would only be the formula disagreeing with itself. */
  var MTARG_WEEK = 7;
  function mTargRec() {
    try {
      var v = JSON.parse(localStorage.getItem('bsc.macroTargets'));
      return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
    } catch (e) { return null; }
  }
  function mDaysSince(k) { return Math.round((keyDate(todayKey()) - keyDate(k)) / 86400000); }

  function mFollowScale() {
    var rec = mTargRec();
    if (!rec || rec.auto === 0) return false;
    var set = rec.set || (MSTAMPS.t ? dayKey(new Date(MSTAMPS.t)) : '');
    if (!set || mDaysSince(set) < MTARG_WEEK) return false;
    var recent = Object.keys(MWEIGHTS).some(function (k) {
      return MWEIGHTS[k] > 0 && mDaysSince(k) < MTARG_WEEK;
    });
    if (!recent) return false;
    var fresh = mPlanCalc(mReadProfile());
    if (!fresh) return false;
    var cur = mReadTargets();
    /* A change worth a sentence. Two grams of protein and twenty calories
       is the formula's rounding, not the body. */
    if (Math.abs(kcalOf(fresh) - kcalOf(cur)) < 25 && Math.abs(fresh.p - cur.p) < 3) return false;
    mWriteTargets({ p: fresh.p, f: fresh.f, c: fresh.c, auto: 1, set: todayKey(),
      moved: { from: kcalOf(cur), to: kcalOf(fresh), on: todayKey(),
        prev: { p: cur.p, f: cur.f, c: cur.c } } });
    return true;
  }

  /* The notice, for three days after a change or until answered. */
  function mMovedHTML() {
    var rec = mTargRec();
    var mv = rec && rec.moved;
    if (!mv || mv.ok || !mv.on || mDaysSince(mv.on) > 3) return '';
    return mLineHTML('calm', '\u21bb',
      '<b>Targets updated for your weight.</b> ' + Number(mv.from).toLocaleString() +
        ' \u2192 ' + Number(mv.to).toLocaleString() + ' kcal a day.',
      '', [['OK', 'mline:moved:ok'], ['Undo', 'mline:moved:undo']]);
  }

  /* What you have said not to suggest. Blake, on the endive Fill kept adding
     for fibre: the logic is fine, "it's just invisible in the app and a food
     i might want to stop from suggesting somehow." Keyed id -> the day it was
     said. Suggestions only: Fill's dishes, its sides and toppers, "Try
     another", and the picker's lists before you type — searching still finds
     everything, and anything you add yourself is yours. Synced as part `nv`,
     so every device leaves it out. */
  var MNEVER = (function () {
    try {
      var v = JSON.parse(localStorage.getItem('bsc.macroNever'));
      if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    } catch (e) { /* none yet */ }
    return {};
  })();
  function mNever(id) { return !!MNEVER[String(id)]; }
  function mSetNever(id, on) {
    var k = String(id);
    if (on) MNEVER[k] = todayKey(); else delete MNEVER[k];
    mStamp('nv');
    try { localStorage.setItem('bsc.macroNever', JSON.stringify(MNEVER)); }
    catch (e) { /* this session only */ }
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

  /* The household's dishes for this day come from mFamilyIds, which the
     picker's family lens has used since it was built — and which I duplicated
     here before finding it, because the grep that found "the two halves never
     touch" was for Store.plan and Store.weeks and this reads Store.day. The
     halves DID touch: manually adding food already offered what the family
     planned. What was missing was the automatic path. */

  /* Which meal a planned dish belongs to. The week assigns a dish to a DAY
     and says nothing about when in it — so the dish's own section decides,
     using the map Fill already steers by. A breakfast recipe lands on
     breakfast. Anything the map does not place falls to the slot the reader
     keeps for everything else, which is where an unclassifiable dish would
     have been put by hand. */
  /* A meal's KIND, from a slot or a bare slot key. The four defaults are
     their own kind; a meal somebody made themselves is 'x' and has none. */
  /* Whether a meal is spoken for, as far as drafting is concerned.
   *
     Food on a meal means Fill leaves it alone: what you put there is your
     business. A PIN is not that kind of statement. It says "I have this every
     day", not "this meal is finished" — and a seven-calorie Crio Bru pinned to
     breakfast was making Fill step over breakfast altogether, so the day came
     back with a seven-calorie breakfast and every other meal carrying what it
     should have held. */
  /* A meal you have started recording is over, as far as any machine is
     concerned. A tick is the strongest statement on this screen and a lock is
     the second; either one means nothing may be put on that meal. Stated once
     here because two passes need it and they were not agreeing. */
  /* How much of the day Fill could still put food into. The macros still
     short, priced, but never more than the calories still short: unused
     carbohydrate on a day already over used to count as room, so Fill
     added a 300 kcal crisp to a day 120 over. */
  function mFillRoom(day, targets) {
    var had = mTotals(day).all;
    var short = 4 * Math.max(0, targets.p - had.p) +
      4 * Math.max(0, targets.c - had.c) +
      9 * Math.max(0, targets.f - had.f);
    return Math.min(short, kcalOf(targets) - (had.kcal || 0));
  }

  /* Why Fill put it there, as the button that asks about it. The chip is
     the question's own place: Blake picked this over a ⋯ menu ("so out of
     place in the app") and over the plate's sheet. A dish Fill chose for an
     empty meal is "Fill's pick"; a food it added says what it was for. */
  var MWHY = { fib: 'Added for fiber', p: 'Added for protein', f: 'Added for fat', c: 'Added for carbs',
    pick: 'Fill\u2019s pick' };
  var MWHY_SAY = { fib: 'to reach your fiber', p: 'to close your protein', f: 'to close your fat',
    c: 'to close your carbs', pick: 'for this meal' };
  function mWhyOf(it) {
    if (it.by !== 'f') return '';
    if (MWHY[it.why]) return it.why;
    var r = BY_ID[it.id];
    return r && !r.food ? 'pick' : '';
  }
  function mWhyChip(it, tag) {
    var w = mWhyOf(it);
    if (!w) return '';
    return '<button class="mwhy mwhy-' + w + ' no-print" data-mwhy="' + tag + '" aria-expanded="' +
      (S.mWhyOpen === tag ? 'true' : 'false') + '">' + MWHY[w] +
      '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" ' +
      'stroke="currentColor" stroke-width="1.5"/></svg></button>';
  }
  /* The strip the chip opens, inside the plate, in the green-edged style of
     the app's other in-meal cards. */
  function mWhyStrip(it, tag) {
    var w = mWhyOf(it);
    if (!w || S.mWhyOpen !== tag) return '';
    var r = BY_ID[it.id];
    return '<div class="mwhy-strip no-print">' +
      '<p>' + (w === 'pick' ? 'Fill picked this ' : 'Fill added this ') + MWHY_SAY[w] + '.' +
        (it.eaten ? '' : ' It stays unless you change it.') + '</p>' +
      '<span class="mwhy-acts">' +
        (it.eaten ? '' : '<button class="ghost" data-mdo="swap:' + tag + '">Swap</button>') +
        '<button class="ghost" data-mdo="never:' + tag + '">Don\u2019t suggest</button>' +
      '</span></div>';
  }

  /* Take a plate Fill put there off the day and let the same pass choose
     again — the side pass for a fibre side, the topper for a gap — so what
     it was covering stays covered. A dish goes back through "Try another". */
  function mReplacePlate(k, sk, idx) {
    var it = (mDay(k)[sk] || [])[idx];
    if (!it) return;
    var r = BY_ID[it.id];
    if (!r || !r.food) { mTryAgain(sk); return; }
    var targets = mDayTargets(k);
    var near = mNearIds(k);
    near[it.id] = 1;
    mEditDay(k, function (day) {
      (day[sk] || []).splice(idx, 1);
      if (it.why === 'fib') mSideUp(day, targets, near);
      else if (it.why) mTopUp(day, targets, near);
    });
  }

  function mToast(text, undo) {
    var el = $('mToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mToast'; el.className = 'm-toast no-print'; el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.innerHTML = '<span>' + text + '</span>' +
      (undo ? '<button type="button" data-mallow="' + esc(String(undo)) + '">Undo</button>' : '');
    el.hidden = false;
    clearTimeout(mToast.t);
    mToast.t = setTimeout(function () { el.hidden = true; }, 6000);
  }

  function mSlotClosed(day, k) {
    return (day[k] || []).some(function (it) { return !!(it.eaten || it.l); });
  }

  function mSlotSpokenFor(day, s) {
    var items = day[s.k] || [];
    if (!items.length) return false;
    if (mSlotClosed(day, s.k)) return true;
    var pinned = (s.pins || []).map(function (p) { return p.id; });
    return items.some(function (it) {
      /* Eaten or locked means hands off, whatever else is true of it.
       *
         This carve-out was written for pins alone — "a pin says I have this
         every day, not this meal is finished" — and it forgot that a pin can
         be eaten like anything else. A meal holding one pinned food you had
         already ticked read as EMPTY to the drafter, so Fill put a second
         dish on a breakfast that was over. Blake, finding it: "Fill is
         putting foods into meals that are complete".
       *
         A tick is the strongest statement on this screen. Nothing may be
         added to a meal carrying one. */
      if (it.eaten || it.l) return true;
      return pinned.indexOf(it.id) < 0;
    });
  }

  function mSlotKind(slot) {
    if (!slot) return '';
    if (typeof slot === 'object') return slot.t || '';
    var t = '';
    mReadSlots().list.forEach(function (sl) { if (sl.k === slot) t = sl.t || ''; });
    return t;
  }

  /* Whether a food belongs at this meal at all.
   *
     `meals` on a food names the meals it is ordinarily eaten at on its own,
     and only exceptions carry one — so a food without the field is fine
     anywhere, which is most food. A custom meal has no kind to judge against
     and is never withheld from: somebody who built their own meal has said
     more about it than this table knows. See the note in tools/food-db.js.
   *
     Recipes are untouched. They have always been placed by section, which is
     the same fact stated for a dish. */
  function mFoodMealOK(r, slot) {
    if (!r || !r.meals) return true;
    var t = mSlotKind(slot);
    if (!t || t === 'x') return true;
    return r.meals.indexOf(t) >= 0;
  }

  /* Sections no meal offers unasked, and the meal a dish from one belongs at
     when you add it yourself. With no meal claiming Batch Prep, a container
     added from the book fell through to the snack below. */
  var MSEC_HOME = { '1-7': ['l', 'd'] };

  /* Every meal a dish could go on, in the order it should be tried: the
     meals whose sections name it, then its home types. */
  function mSlotsForRecipe(r, slots) {
    var sec = r.book + '-' + r.secNum, out = [];
    slots.list.forEach(function (s) { if (mSlotSecs(s).indexOf(sec) >= 0) out.push(s); });
    (MSEC_HOME[sec] || []).forEach(function (t) {
      slots.list.forEach(function (s) { if (s.t === t && out.indexOf(s) < 0) out.push(s); });
    });
    return out;
  }

  function mSlotForRecipe(r, slots) {
    var sec = r.book + '-' + r.secNum, found = null;
    slots.list.forEach(function (s) {
      if (found) return;
      if (mSlotSecs(s).indexOf(sec) >= 0) found = s;
    });
    if (found) return found;
    if (MSEC_HOME[sec]) {
      MSEC_HOME[sec].forEach(function (t) {
        slots.list.forEach(function (s) { if (!found && s.t === t) found = s; });
      });
      if (found) return found;
    }
    var last = null;
    slots.list.forEach(function (s) { if (s.t === 's') last = last || s; });
    return last || slots.list[slots.list.length - 1] || null;
  }

  function mDay(k) {
    // a fresh object when the day is empty — browsing ‹ › never writes a key
    return MDAYS[k] || {};
  }

  function mEditDay(k, fn) {
    var day = MDAYS[k] || (MDAYS[k] = {});
    fn(day);
    /* Food on a meal un-skips it.
     *
       The rest of the app already assumes a skipped meal is an empty one: the
       skip button is only drawn on a meal with nothing on it, the struck-out
       line only stands in for a card with nothing on it, and Fill walks past a
       skipped meal without looking. Nothing enforced it. The chooser on the add
       sheet lists skipped meals like any other, so two taps put a plate on a
       lunch that was still marked not-happening.

       What that costs is the day itself. Every OTHER meal divides the day by
       the weights of the meals still in play, so a skipped lunch is subtracted
       from their divisor — and then paid its own share on top, out of a divisor
       that counts it. On the default weights a skipped-but-filled lunch hands
       the four cards 20/65, 25/90, 35/65 and 10/65: 128 per cent of a day, with
       every card free to say it landed on its share.

       Enforced here rather than at the doors food comes in by, because there
       are four of them — the tick on the picker, a new food saved straight onto a
       meal, Keep-these-as-one, and the pins a fresh day is seeded with — and a
       rule that has to be remembered at four doors is a rule that will be
       missed at the fifth. The food is the newer statement about the meal, so
       it wins; and mSetSkip stamps, so the un-skip travels to the other device
       instead of losing to the skip still sitting there. */
    Object.keys(day).forEach(function (sk) {
      if ((day[sk] || []).length && mSkipped(k, sk)) mSetSkip(k, sk, false);
    });
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
  /* Kilocalories a day per pound of fat. Alpert measured a ceiling on how
     fast the fat store can hand energy over — 290 kJ per kg of fat a day,
     about 31 kcal a pound — and later corrected it to roughly 22. Past it
     the shortfall has to come from somewhere that is not fat, which on a
     cut is the muscle the protein target exists to keep. The lower figure
     is the one used here: it is his own correction, and a ceiling guessed
     too high is the only direction that costs anything. */
  var MFAT_MAX = 22;

  /* How much of you is fat, in pounds.
   *
     Typed if you have typed one, because a caliper or a scan beats any
     formula. Otherwise Deurenberg 1991 off BMI, age and sex, which is the
     standard estimate from figures already asked for — and which carries a
     standard error of about 4 points, so it is stated as an estimate and
     can be typed over. Blake's call: "estimate it and then let me get more
     precise if I want to." */
  function mBodyFat(pr) {
    if (!pr || !pr.lb || !pr.age || !(pr.ft || pr.inch)) return null;
    var told = Number(pr.bf) || 0;
    var pct = told;
    if (!pct) {
      var m = (pr.ft * 12 + pr.inch) * 0.0254;
      if (!(m > 0)) return null;
      var bmi = (pr.lb * 0.45359237) / (m * m);
      pct = 1.20 * bmi + 0.23 * pr.age - 10.8 * (pr.sex === 'f' ? 0 : 1) - 5.4;
    }
    pct = Math.max(3, Math.min(70, pct));
    return { pct: Math.round(pct * 10) / 10,
      lb: Math.round(pr.lb * pct) / 100, told: !!told };
  }

  /* The least carbohydrate, as a share of a day's calories, that a day can
     carry and still be eaten from this book. Under it mReadTargets calls a
     stored plan starved and replaces it, and a cycled rest day may not go
     there either. The plan aims higher (MCARB_SHARE); this is the edge. */
  var MCARB_EAT = 0.12;
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
  /* The targets a past day was lived against.
   *
     Targets were never stored per day: every day in the week strip and the
     summary was judged against TODAY's plan, re-derived. Change carbohydrate
     today and yesterday — eaten, closed — turned from on target to over,
     against a number that did not exist yesterday. So what each day was
     aiming at is written down the first time the day is drawn as today, and
     kept; a past day reads its own. Local, like the intake log, and kept as
     long as it is; a day never drawn here falls back to the plan as it is. */
  var MDAYT = (function () {
    try {
      var v = JSON.parse(localStorage.getItem('bsc.macroDayT'));
      if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    } catch (e) { /* none yet */ }
    return {};
  })();
  function mSnapTargets() {
    var k = todayKey(), t = mDayTargetsLive(k), was = MDAYT[k];
    if (was && was.p === t.p && was.f === t.f && was.c === t.c) return;
    MDAYT[k] = { p: t.p, f: t.f, c: t.c };
    var cut = new Date(); cut.setDate(cut.getDate() - MINTAKE_DAYS);
    var cutK = dayKey(cut);
    Object.keys(MDAYT).forEach(function (d) { if (d < cutK) delete MDAYT[d]; });
    try { localStorage.setItem('bsc.macroDayT', JSON.stringify(MDAYT)); }
    catch (e) { /* this session only */ }
  }
  function mDayTargets(k) {
    var snap = k < todayKey() ? MDAYT[k] : null;
    if (snap && isFinite(snap.p) && isFinite(snap.f) && isFinite(snap.c)) {
      return { p: snap.p, f: snap.f, c: snap.c };
    }
    return mDayTargetsLive(k);
  }

  function mDayTargetsLive(k) {
    var base = mReadTargets();
    var train = mTrainDays();
    var T = train.length, R = 7 - T;
    if (!T || !R || !base.c) return base;
    var hard = mIsTrainingDay(k);
    /* Whatever the training days gain, the rest days give back, so seven of
       these still add up to seven of the plan.
     *
       But the rest days pay T/R times the swing, and at six training days
       that is a hundred and fifty percent: the rest day's carbohydrate went
       negative, was clamped to nothing, and the day sat under the calorie
       floor with the week no longer averaging to plan. So the swing is the
       most the rest day can afford — its carbohydrate kept at the plan's own
       eatable line (MCARB_EAT) and its calories at the floor — and the training
       days take the same smaller swing, so the week still adds up. */
    var pr = mReadProfile();
    var other = 4 * base.p + 9 * base.f;
    var restMinC = Math.max(
      (mFloorK(pr) - other) / 4,
      MCARB_EAT * other / (4 * (1 - MCARB_EAT)));
    var swing = Math.min(MCYCLE_SWING, Math.max(0, (1 - restMinC / base.c) * R / T));
    var f = hard ? (1 + swing) : (1 - swing * T / R);
    return { p: base.p, f: base.f, c: Math.max(0, Math.round(base.c * f)) };
  }

  /* Ticked if you ticked it, planned otherwise.
   *
     The week's COUNT stays the planned one, which is what mDayTargets
     divides by — so the rest days give back exactly what the training days
     take and the week still averages to plan. The tick only moves which days
     are which. Tick more mornings than you planned for and the week runs a
     little high on carbohydrate, which is a true consequence of training
     more than you said you would. */
  function mIsTrainingDay(k) {
    var train = mTrainDays();
    if (!train.length || train.length >= 7) return false;
    if (mTrainedSaid(k)) return mTrainedAt(k) > 0;
    return train.indexOf(mWkIx(keyDate(k))) >= 0;
  }

  /* What is actually in storage. Only the plan sheet's Save has any business
     with this — everything else wants mReadProfile below, which reads the
     weight off the scale. */
  function mReadProfileRaw() {
    try {
      var pr = JSON.parse(localStorage.getItem('bsc.macroProfile'));
      if (pr && typeof pr === 'object') return pr;
    } catch (e) { /* private mode or corrupt */ }
    return { sex: 'm', age: 0, ft: 0, inch: 0, lb: 0, act: 1.55, goal: 'cut1',
      goalLb: 0, goalBy: '', workouts: 0, steps: 0 };
  }

  /* The scale, as one number.
   *
     Bodyweight was stored twice and the two disagreed: 57 mornings falling
     205 -> 190 in the weigh-in log, and `lb: 205` still sitting in the profile
     because the plan sheet is the only thing that has ever written it. Every
     target built on bodyweight — protein by the pound, the 0.3 g/lb fat
     floor, the pace cap — was being worked out against a weight fifteen
     pounds stale, and no screen said so.
   *
     The seven-day average rather than this morning's number: a target that
     moved with a night's water would be noise wearing a decimal point, and
     the average is already what mPlanFace steers by, so this makes one number
     out of two rather than adding a third. Guarded on MWEIGHTS because it is
     assigned by an IIFE further down the file. */
  function mScaleLb() {
    if (typeof MWEIGHTS === 'undefined' || !MWEIGHTS) return 0;
    var st = mWeightStats();
    return st && st.avg7 ? Math.round(st.avg7 * 10) / 10 : 0;
  }

  /* The profile as the rest of the app should see it: what you told it, with
     the weight overwritten by what the scale has since said. The stored `lb`
     survives as the fallback for the case it is genuinely for — the first
     plan, before there is a log to read. */
  function mReadProfile() {
    var pr = mReadProfileRaw();
    var lb = mScaleLb();
    if (lb) pr.lb = lb;
    return pr;
  }
  /* A profile change is the one thing that can turn a stored plan into a day
     nobody can eat, so it is the one place besides boot that has to ask. */
  function mWriteProfile(pr) {
    /* A goal remembers the morning it was set and what the scale read then,
       so the plan line has somewhere true to start from. Only a CHANGED goal
       is stamped: a training-day toggle must not quietly move the line. */
    var was = mReadProfileRaw();
    if (pr.goalLb && pr.goalBy && (pr.goalLb !== was.goalLb || pr.goalBy !== was.goalBy)) {
      pr.goalSet = todayKey();
      pr.goalFrom = mScaleLb() || Math.round((Number(pr.lb) || 0) * 10) / 10;
    }
    if (!pr.goalLb || !pr.goalBy) { delete pr.goalSet; delete pr.goalFrom; }
    mStamp('pr');
    try { localStorage.setItem('bsc.macroProfile', JSON.stringify(pr)); }
    catch (e) { /* private mode */ }
    /* A new profile is the one thing that can turn a stored plan into a day
       nobody can eat — a heavier body raises its own floor. Asked here, where
       the change is made, rather than inside whichever read ran first. */
    mHealTargets();
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
  /* The lowest a plan is allowed to be, and the only calorie floor in the
     literature with anything under it.
   *
     1,200 comes from clinical work in the 1960s and 70s: roughly the point
     below which a day cannot meet its micronutrient needs without
     supplements. It is a nutrient floor, not a weight-loss target. The
     1,500 that used to sit here for men has no equivalent behind it — it is
     a magazine number — and it was the thing standing between Blake and the
     1,300-kcal day an RP-style hard cut actually asks him for. His call:
     "the plan I need to meet my plan. Sometimes that will be really low."
   *
     What keeps a plan sane is not this. It is the rate cap in mGoalPace —
     0.5 to 1% of bodyweight a week, which is what Helms, Aragon and
     Fitschen recommend for holding muscle — and the fat ceiling below. */
  /* The three constants the floor and the planner BOTH stand on. They were
     literals inside mPlanCalc and the floor knew nothing about them, which is
     how the floor came to sit below what the planner's own minimums cost. Two
     definitions of one quantity, and the plan lost the argument. */
  var MK_CLINICAL = 1200;   // the nutrient floor above
  var MPROT_FLOOR = 0.8;    // g a pound: the least a cut may ask of protein
  var MFAT_FLOOR = 0.3;     // g a pound: the floor hormones care about
  var MCARB_SHARE = 0.15;   // the least of the day left for carbohydrate
  /* Kilocalories a day per kilogram of fat-free mass. Below roughly thirty,
     the sports-medicine literature on relative energy deficiency finds the
     endocrine picture people mean by "it wrecks your hormones": testosterone
     down in men, cycles disrupted in women, T3 and leptin suppressed, bone
     and recovery with them. It is a threshold from studies of athletes, most
     of them women, so it is a population line and not a promise. */
  var MEA_KCAL_KG = 30;

  function mFloorK(pr) {
    if (!pr || !(pr.lb > 0)) return MK_CLINICAL;
    /* What the day's own minimums cost. Protein at its floor and fat at its
       floor are 5.9 kcal a pound between them, and leaving MCARB_SHARE of the
       day for carbohydrate makes the whole day that over 0.85. Under this
       number the planner cannot build the day it just promised: it spends
       everything on protein and fat and hands back zero carbohydrate. Which
       it did, for nineteen per cent of profiles. Blake, looking at one of
       them: "I feel I should have some carbs to eat for the day." */
    var macro = (4 * MPROT_FLOOR * pr.lb + 9 * MFAT_FLOOR * pr.lb) / (1 - MCARB_SHARE);
    /* And what the lean mass wants, less what the fat store can hand over —
       the same Alpert ceiling the pace cap already runs on. This is the term
       that does the hormone protecting, and its shape is the point: somebody
       with fat to spend barely feels it, and it tightens on its own as they
       lean out, which is when it starts to matter. */
    var ea = 0, fat = mBodyFat(pr);
    if (fat) {
      ea = MEA_KCAL_KG * (pr.lb - fat.lb) * 0.45359237 - fat.lb * MFAT_MAX;
    }
    return Math.round(Math.max(MK_CLINICAL, macro, ea));
  }

  /* Mifflin–St Jeor for the base burn, an activity multiplier for the day, the
     goal for the swing. Protein by bodyweight and goal; fat at a quarter of
     the calories but never under 0.3 g/lb, which is the floor hormones care
     about; carbs are whatever calories are left. On a very hard cut the
     leftovers can go negative — carbs floor at zero and the calories follow
     the grams, so the plan never promises a number they do not add up to. */
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

  /* What each finished day came to, kept long after the day itself.
   *
     The measured burn is calories in against weight change, and the two
     sides were read over different stretches: weight from the first week
     ever logged — up to a year back — against food from the last fourteen
     days, because that is all the day log keeps. Somebody who lost twenty
     pounds in the spring and has held steady since read as burning 3,000 on
     2,400 a day. So each past day's total is kept here, one number a day
     for four months, and the burn compares food and weight over the SAME
     weeks.
   *
     Only days behind you: today is not over, and counted as a whole day at
     breakfast it read as a fast. Only food marked eaten — or everything on a
     day you closed — because a plan is not a meal. Kept on this device, from
     the days this device has seen; the days themselves sync, so any device
     opened at least once a fortnight keeps the whole record. */
  var MINTAKE_DAYS = 120;
  var MINTAKE = (function () {
    try {
      var v = JSON.parse(localStorage.getItem('bsc.macroIntake'));
      if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    } catch (e) { /* none yet */ }
    return {};
  })();

  function mLogIntake() {
    var today = todayKey(), moved = false;
    Object.keys(MDAYS).forEach(function (k) {
      if (k >= today) return;
      var tot = mTotals(MDAYS[k]);
      var kc = mDoneAt(k) ? tot.all.kcal : tot.eaten.kcal;
      var v = kc > 400 ? Math.round(kc) : 0;
      if (v && MINTAKE[k] !== v) { MINTAKE[k] = v; moved = true; }
      if (!v && MINTAKE[k]) { delete MINTAKE[k]; moved = true; }
    });
    var cut = new Date(); cut.setDate(cut.getDate() - MINTAKE_DAYS);
    var cutK = dayKey(cut);
    Object.keys(MINTAKE).forEach(function (k) { if (k < cutK) { delete MINTAKE[k]; moved = true; } });
    if (moved) {
      try { localStorage.setItem('bsc.macroIntake', JSON.stringify(MINTAKE)); }
      catch (e) { /* this session only */ }
    }
  }

  /* The last eight weeks at most: long enough to see through water, short
     enough to be about the body you have now. */
  var MTDEE_WINDOW = 56;

  function mMeasuredTdee() {
    mLogIntake();
    var dayN = function (k) { return Math.round(keyDate(k).getTime() / 86400000); };
    var todayN = dayN(todayKey());
    var iKeys = Object.keys(MINTAKE).filter(function (k) {
      return todayN - dayN(k) <= MTDEE_WINDOW;
    }).sort();
    if (iKeys.length < 14) return null;
    var firstN = dayN(iKeys[0]), lastN = dayN(iKeys[iKeys.length - 1]);
    if (lastN - firstN < MTDEE_MIN_DAYS) return null;

    /* A week at each end OF THE FOOD'S OWN STRETCH, and the distance between
       their middles — the span the weight change happened over, and the
       span the food was eaten over, the same span. */
    var head = [], tail = [];
    Object.keys(MWEIGHTS).forEach(function (k) {
      var n = dayN(k), w = MWEIGHTS[k];
      if (!(w > 0)) return;
      if (n >= firstN && n - firstN < 7) head.push(w);
      if (n <= lastN && lastN - n < 7) tail.push(w);
    });
    if (head.length < 3 || tail.length < 3) return null;
    var mean = function (a) {
      return a.reduce(function (s0, x) { return s0 + x; }, 0) / a.length;
    };
    var days = (lastN - 3) - (firstN + 3);
    if (days < 14) return null;

    var kcals = iKeys.map(function (k) { return MINTAKE[k]; });
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

    /* Two caps, and the one that used to be here was the weaker of them.
     *
     * A pound a week per hundred of bodyweight sounds careful until you do
     * the arithmetic on a big frame: at 205 lb it allows 2.05 lb a week,
     * which is a 1,025 kcal deficit — forty percent of the day's burn, and
     * three hundred calories BELOW what the body spends lying still. The app
     * was writing that plan and then wondering why no real meal would fit
     * inside it: sixty percent of the calories went to protein, three
     * percent to carbs, and every suggestion came back a quarter portion.
     *
     * So the rate cap keeps its place, and a second sits in front of it: the
     * deficit may not take the day under the floor the plan lives at
     * (mFloorK — 1,500 for a man, 1,200 for a woman). Whichever bites first
     * wins, and the plan says so. The morning line keeps a stricter floor of
     * its own, never under the basal rate; see mPaceFacts. */
    var floorK = mFloorK(pr);
    var maxOff = Math.max(0, tdee - floorK);
    /* And no faster than the fat can supply it. This is the cap that is
       actually about the person rather than about an average. */
    var fat = mBodyFat(pr);
    if (fat) maxOff = Math.min(maxOff, fat.lb * MFAT_MAX);
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

  /* A day of `kcal` shaped like `t`, by the plan's own rules.
   *
     The Eat button used to hold protein at its grams, take a quarter of the
     change from fat and the rest from carbohydrate — and a cut deep enough
     left carbohydrate under twelve percent, which mReadTargets reads as a
     day nobody can eat and replaces with the plan on the very next read. So
     the button did nothing, and offered itself again. The plan's order:
     carbohydrate keeps the eatable line, protein gives ground to its floor
     first, fat to its floor last. mFloorK is priced at exactly those
     floors, so any kcal at or over it has a split. */
  function mSplitKcal(kcal, t, pr) {
    var lb = pr && pr.lb > 0 ? pr.lb : 0;
    var pMin = lb ? Math.round(MPROT_FLOOR * lb) : 0;
    var fMin = lb ? Math.max(1, Math.round(MFAT_FLOOR * lb)) : 0;
    var now = kcalOf(t);
    var p = t.p;
    var f = Math.max(Math.min(t.f, fMin), Math.round(t.f + (kcal - now) * 0.25 / 9));
    /* To the eatable line, not the plan's own share: protein is what a cut
       protects, so it gives only what the day needs to stay eatable. A gram
       over the line, so rounding cannot land it a hair under. */
    var minC = Math.ceil(MCARB_EAT * kcal / 4) + 1;
    if ((kcal - 4 * p - 9 * f) / 4 < minC) {
      p = Math.max(pMin, Math.floor((kcal - 9 * f - 4 * minC) / 4));
    }
    if ((kcal - 4 * p - 9 * f) / 4 < minC) {
      f = Math.max(fMin, Math.round((kcal - 4 * p - 4 * minC) / 9));
    }
    var c = Math.max(0, Math.round((kcal - 4 * p - 9 * f) / 4));
    return { p: Math.max(0, p), f: Math.max(0, f), c: c };
  }

  function mPlanCalc(pr) {
    var tdee = mTdee(pr);
    if (tdee === null) return null;
    var g = MGOALS[pr.goal] || MGOALS.cut1;
    var pace = mGoalPace(pr);
    /* One engine, two ways in: a date works out the rate it needs, a preset
       names one outright. Both arrive here as pounds a week. */
    var perWeek = pace ? pace.perWeek : g.rate * pr.lb;
    /* A preset cut asks the same of the fat store that a dated goal is
       allowed to. mGoalPace caps a deficit at what the fat can supply
       (MFAT_MAX a pound a day); the presets never asked, so a lean 200 lb
       man on the hard cut was planned 999 under his burn against a ceiling
       of 660 — while the same two pounds a week reached through a date came
       out 340 kcal higher. One ceiling, whichever way in. */
    if (!pace && perWeek > 0) {
      var fatP = mBodyFat(pr);
      if (fatP) perWeek = Math.min(perWeek, fatP.lb * MFAT_MAX * 7 / 3500);
    }
    var kcal = Math.max(mFloorK(pr), Math.round(tdee - perWeek * 3500 / 7));
    var protPerLb = pace
      ? (perWeek > 0.05 ? (perWeek > pr.lb * 0.009 ? 1.10 : 1.00)
        : perWeek < -0.05 ? 0.90 : 0.85)
      : g.prot;
    var p = Math.round(protPerLb * pr.lb);
    var f = Math.round(Math.max(MFAT_FLOOR * pr.lb, 0.25 * kcal / 9));
    /* Protein and fat first, but not to the last calorie. A day left with
       three percent of itself for carbohydrate is a day no dinner in the
       book fits inside, and the picker can only answer it with quarter
       portions. Protein gives ground before the plate does — down to 0.8 g
       a pound, which is still more than a cut needs. */
    var minC = Math.round(MCARB_SHARE * kcal / 4);
    if ((kcal - 4 * p - 9 * f) / 4 < minC) {
      var room = kcal - 9 * f - 4 * minC;
      p = Math.max(Math.round(MPROT_FLOOR * pr.lb), Math.round(room / 4));
    }
    var c = Math.max(0, Math.round((kcal - 4 * p - 9 * f) / 4));
    /* Said once, off the grams. A floor can lift the day but not lower the
       protein and fat floors under it, and a plan that printed 1,200 over
       grams adding to 1,475 was two answers to one question — the face and
       the projection read one, the bars and the wizard the other. */
    return { kcal: kcalOf({ p: p, f: f, c: c }), p: p, f: f, c: c };
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
  /* Both day-keyed flag maps fall out of the same window the day log lives in
     — see mEditDay — and on the same schedule, when something is written.
   *
     That window is the right one because it is the only one anything ever
     reads. A closed-day flag is asked for exactly once, about mViewKey(), and
     a skip likewise; mRenderDay clamps that key into [mEarliestKey(),
     mLatestKey()] before it draws and mNavDay refuses to leave it. The week
     strip's filled dot is not this map at all — it is mDayDone() off the
     plates — and the review card's seven days behind read mDay(). So nothing
     on screen can want a flag from outside the window, and a flag kept past it
     is an orphan: a note that Tuesday was closed, for a Tuesday whose plates
     were pruned a fortnight ago, riding in the sync payload forever.

     The per-key stamps in MSTAMPS are deliberately NOT pruned alongside. The
     stamp is what tells mMergeRemote it has already seen that day, and the
     remote document keeps every key it was ever sent — the push is a merge
     write. Drop the stamp and the copy still sitting in Firestore looks new
     again on the next read, and the pruned flag walks straight back in. */
  function mPruneWindow(m) {
    var floor = mEarliestKey(), roof = mLatestKey();
    Object.keys(m).forEach(function (dk) {
      if (dk < floor || dk > roof) delete m[dk];
    });
  }
  /* Mornings you trained, as they happened.
   *
     The profile already carries how many sessions a week, and mBurn spreads
     those calories across all seven days — rest days included. So a tick here
     buys NO calories: it would be the same session paid for twice, which is
     the fault this whole audit has been pulling out of the app all day. What
     it buys is WHERE the carbohydrate lands. Carb cycling picks its training
     days from an evenly-spread pattern, so somebody who says three and lifts
     Tuesday, Thursday and Saturday gets the high-carb days on Monday,
     Wednesday and Friday — every week, silently.
   *
     Day -> 1, and zero is a real answer meaning "I ticked this and then
     un-ticked it", the same bargain the closed-day log strikes. */
  var MTRAINED = (function () {
    try {
      var t = JSON.parse(localStorage.getItem('bsc.macroTrained'));
      if (t && typeof t === 'object' && !Array.isArray(t)) return t;
    } catch (e) { /* fall through */ }
    return {};
  })();
  function mTrainedAt(k) { return Number(MTRAINED[k]) || 0; }
  function mTrainedSaid(k) { return MTRAINED[k] !== undefined; }
  function mSetTrained(k, on) {
    MTRAINED[k] = on ? 1 : 0;
    mPruneWindow(MTRAINED);
    try { localStorage.setItem('bsc.macroTrained', JSON.stringify(MTRAINED)); } catch (e) { /* private */ }
    mStamp('tn', k);
  }

  function mSetDone(k, on) {
    MDONE[k] = on ? Date.now() : 0;
    mPruneWindow(MDONE);
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

  /* A morning card that was sent away, and the advice it was sent away over.

     "Leave it" used to add a class that set display:none and nothing else.
     The class was written nowhere and read nowhere, so it lasted exactly as
     long as the element did — and every check, portion nudge, weigh-in and
     arriving sync rebuilds this region. The card came back within a tap or
     two, every time, which reads as the app not listening.

     Stored against the advice and not just the day, because the two are
     different statements. Sending away "eat 1,903" is a decision about 1,903;
     if tomorrow's weigh-in makes it 2,050, or the day flips from behind to
     ahead, that is news and has not been refused yet. Same day, same number,
     stays gone.

     Local, not synced. It is what one person did to one card on one phone,
     and it has no business travelling. */
  var MHUSH = (function () {
    try {
      var h = JSON.parse(localStorage.getItem('bsc.macroHush'));
      if (h && typeof h === 'object' && !Array.isArray(h)) return h;
    } catch (e) { /* fall through */ }
    return {};
  })();
  function mHushed(k, sig) { return MHUSH[k] === sig; }
  function mSetHush(k, sig) {
    MHUSH[k] = sig;
    mPruneWindow(MHUSH);        // the day log's window, like the skips
    try { localStorage.setItem('bsc.macroHush', JSON.stringify(MHUSH)); }
    catch (e) { /* private mode */ }
  }
  function mSetSkip(k, sk, on) {
    var a = (MSKIP[k] || []).filter(function (x) { return x !== sk; });
    if (on) a.push(sk);
    if (a.length) MSKIP[k] = a; else delete MSKIP[k];
    mPruneWindow(MSKIP);       // the day log's window, for the reason above it
    /* The stamps go through the same window as the skips they stamp. The
       payload is built from these now, so a stamp left behind for a day that
       has fallen out of the fortnight would go on announcing an empty skip
       list for that day forever. */
    if (MSTAMPS.sp) mPruneWindow(MSTAMPS.sp);
    try { localStorage.setItem('bsc.macroSkip', JSON.stringify(MSKIP)); } catch (e) { /* private */ }
    mStamp('sp', k);
  }

  /* Where a meal's miss went, and which meal's miss it was.
   *
     A meal that comes in light or heavy changes what every meal after it is
     asked for — that has always happened, on every render, silently. This is
     the record of what you did about it: nothing (the slack shares out across
     the meals left, by size), or one meal at a time (`to`, in the order you
     tapped them), or nothing at all (`off`, every meal keeps its plan and the
     day is allowed to end where it fell).

     Beside the day and never on it. Twelve places walk a day with
     `Object.keys(day).forEach(function (sk) { (day[sk] || []).forEach(...) })`
     and a string sitting among the plate lists throws in mTotals on the very
     next render. MSKIP solved the same problem the same way and this follows
     it exactly, down to the pruning window and the stamp.

     `f` is the meal whose miss this is about. It is what lets the line clear
     itself: once a LATER meal is finished the question has moved on, and four
     buttons parked under breakfast at nine at night are just clutter. */
  var MSEND = (function () {
    try {
      var d = JSON.parse(localStorage.getItem('bsc.macroSend'));
      if (d && typeof d === 'object' && !Array.isArray(d)) return d;
    } catch (e) { /* fall through */ }
    return {};
  })();
  function mSendOf(k) {
    var v = MSEND[k];
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    /* `ack` rides back out as well as in. It did not, for one commit, and
       the symptom was the whole point of the flag: Done wrote ack to
       storage, the next read dropped it on the floor, and the card opened
       again — a dismissal that does not survive the read is the pace card's
       bug wearing a different name. */
    return { f: v.f || '', to: (v.to || []).slice(), off: !!v.off, ack: !!v.ack };
  }
  function mSetSend(k, v) {
    /* `f` — which meal the question is about — is what keeps the row, and it
       is set for every card there is, so an answer of any kind survives:
       a set of meals, a None, or a fold. `|| v.ack` was here for a commit
       and could not be made to fail, because there is no path that acks a
       card without naming the meal it is about. A clause no mutation can
       reach is not a safeguard, it is a comment claiming credit for one. */
    if (v && (v.f || (v.to && v.to.length) || v.off)) MSEND[k] = v;
    else delete MSEND[k];
    mPruneWindow(MSEND);
    if (MSTAMPS.sn) mPruneWindow(MSTAMPS.sn);
    try { localStorage.setItem('bsc.macroSend', JSON.stringify(MSEND)); } catch (e) { /* private */ }
    mStamp('sn', k);
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
    /* The stamps age out on the same year-and-a-bit as the mornings they
       stamp — they are what the payload is built from, so one left behind
       would go on announcing an empty morning long after the morning itself
       had gone. */
    if (MSTAMPS.w) {
      Object.keys(MSTAMPS.w).forEach(function (wk) { if (wk < floor) delete MSTAMPS.w[wk]; });
    }
    try { localStorage.setItem('bsc.macroWeights', JSON.stringify(MWEIGHTS)); }
    catch (e) { /* in-memory only for this session */ }
    /* Per morning, so that clearing this one is a thing the payload can say
       without claiming anything about any other. */
    mStamp('w', k);
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
      /* Mornings since the scale last had anything to say. Every figure below
         is anchored on that morning rather than on today, so anything that
         compares them to today has to know how far apart they are. */
      staleDays: Math.max(0, Math.round(keyDate(todayKey()).getTime() / 86400000) - lastN),
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
    /* Where the plan says you should be, on the same scale, dashed. "Behind"
       was a word; with the line it is something you can see — your weight
       sitting above it. Only across the days the plan covers. */
    var pr = mReadProfile(), planPts = [];
    if (pr.goalLb && pr.goalBy) {
      keys.forEach(function (k) {
        var pw = mPlanWeight(k, pr);
        if (!pw || (pr.goalSet && k < pr.goalSet)) return;
        planPts.push([k, pw.lb]);
        if (pw.lb < lo) lo = pw.lb;
        if (pw.lb > hi) hi = pw.lb;
      });
    }
    if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }   // a flat line should look flat, not jagged
    var W = 280, H = 44;
    var xy = function (k, lb) {
      var x = (dayN(k) - x0) / (x1 - x0) * W;
      var y = 3 + (H - 6) * (1 - (lb - lo) / (hi - lo));
      return x.toFixed(1) + ',' + y.toFixed(1);
    };
    var pts = keys.map(function (k) { return xy(k, MWEIGHTS[k]); });
    return '<svg class="mw-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
      (planPts.length > 1 ? '<polyline class="mw-spark-plan" points="' +
        planPts.map(function (q) { return xy(q[0], q[1]); }).join(' ') +
        '" fill="none" stroke-width="1.2" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>' : '') +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' +
      (planPts.length > 1 ? '<div class="mw-spark-k"><i class="me"></i>your weight <i class="pl"></i>the plan</div>' : '');
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
    var dayK = (mTargRec() ? kcalOf(mReadTargets()) : plan.kcal).toLocaleString();
    /* A goal with a date under a week out, or gone. The plan stops working
       out a rate then, and the card used to fall back to the no-goal line —
       "name a weight and a date" — directly above "On pace for 190 lb by
       Sep 27", which is a weight and a date. */
    if (!pace && pr.goalLb && pr.goalBy) {
      var gd = keyDate(pr.goalBy);
      var left = Math.round((gd - keyDate(todayKey())) / 86400000);
      return { has: true, html: '<b>' + pr.goalLb + ' lb by ' + M_MONS[gd.getMonth()] + ' ' +
        gd.getDate() + '</b> &middot; ' +
        (left < 0 ? 'the date has passed' : left === 0 ? 'today' : left + (left === 1 ? ' day' : ' days') + ' left') +
        ' &middot; ' + dayK + ' kcal a day' };
    }
    if (!pace) {
      return { has: true, html: '<b>' + esc(MGOAL_WORDS[pr.goal] || MGOAL_WORDS.cut1) +
        /* The saved day, which is what the bars score against. The live
           calculation drifts from it between weekly updates, and one card
           showing two numbers for one day was the thing being fixed. */
        '</b> &middot; ' + (mTargRec() ? kcalOf(mReadTargets()) : plan.kcal).toLocaleString() +
        ' kcal a day &middot; name a weight and a date to track the arrival' };
    }
    var st0 = mWeightStats();
    var now0 = st0 ? st0.avg7 : pr.lb;
    var togo0 = Math.round((now0 - pr.goalLb) * 10) / 10;
    var weeks0 = Math.max(1, Math.round(pace.days / 7));
    var d0 = keyDate(pr.goalBy);
    var out = '<b>' + pr.goalLb + ' lb by ' + M_MONS[d0.getMonth()] + ' ' + d0.getDate() +
      /* "30.3 lb in 19 weeks" rather than "30.3 lb to go over 19 weeks":
         same two facts, five words shorter, and short enough that the pace
         verdict stays on the line it is a verdict about instead of dropping
         to one of its own. */
      '</b> &middot; ' + Math.abs(togo0) + ' lb in ' + weeks0 +
      (weeks0 === 1 ? ' week' : ' weeks');
    /* The same side the morning line acts on. This used to judge by the
       week's RATE against the rate the date needs, while the line beneath
       it judged by POSITION against the plan line — and five pounds behind
       the line while losing fast this week read "on pace" over "12 days
       behind pace". One question, one answer: where you stand. */
    var pf0 = mPaceFacts(todayKey());
    if (pf0) {
      /* The estimate, not a verdict: when you'll get there against the date
         you set. */
      var word0 = mArriveChip(pf0);
      var tone0 = /late|no date|off/.test(word0) ? 'behind' : /early/.test(word0) ? 'ahead' : 'on';
      out += ' <span class="mw-chip ' + tone0 + '">' + word0 + '</span>';
    }
    return { has: true, html: out };
  }

  /* The arithmetic the verdict came out of, for behind the press. Silent
     until the scale has an opinion: one week of mornings is water, not a
     trend, and a line that says so is a line about the app. */
  function mPlanDetail() {
    /* Every number the card has, said once: where the average is, which way
       the week went, and what the goal needs. It was four lines, and the
       average was in all four. */
    var pr = mReadProfile();
    var st = mWeightStats();
    if (!st || st.n < 2) return '';
    var parts = [(Math.round(st.avg7 * 10) / 10) + ' lb seven-day average'];
    if (st.dWeek !== null) parts.push(mLbWord(st.dWeek) + ' this week');
    var pace = mPlanCalc(pr) ? mGoalPace(pr) : null;
    if (pace && st.dWeek !== null) {
      var togo = st.avg7 - pr.goalLb;
      var weeks = Math.max(1, pace.days / 7);
      var need = Math.round(Math.abs(togo) / weeks * 10) / 10;
      if (need >= 0.1) parts.push('needs ' + (togo > 0 ? 'down ' : 'up ') + need + ' a week');
    }
    return parts.join(' &middot; ');
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

  /* What the plan said the scale would read today. Anchored on the morning
     the goal was set, at what the scale averaged that morning — a
     measurement, not the weight typed into the profile, which is a memory.
     It used to anchor on the FIRST morning ever logged, which is the same
     thing for a goal set on day one and a year-old number for a goal set
     after a year of mornings: 205 in January, 185 now, a new goal of 175,
     and today's "planned" weight came out at 197 — twelve pounds ahead of
     a pace nobody set. A goal saved before this was recorded keeps the
     first logged morning, since nothing better is known about it. */
  function mPlanWeight(k, pr) {
    if (!pr.goalLb || !pr.goalBy) return null;
    var keys = Object.keys(MWEIGHTS).sort();
    if (!keys.length) return null;
    var dayN = function (x) { return Math.round(keyDate(x).getTime() / 86400000); };
    var set = pr.goalSet && pr.goalFrom > 0;
    var startK = set ? pr.goalSet : keys[0];
    var startLb = set ? pr.goalFrom : MWEIGHTS[keys[0]];
    var from = dayN(startK), to = dayN(pr.goalBy), now = dayN(k);
    if (to <= from) return null;
    var span = to - from;
    var per = (pr.goalLb - startLb) / span;      // lb a day, negative on a cut
    /* The line stops at the goal. Carried on past the date it kept falling
       — a goal of 190 ten days gone was "planning" 186.7, so arriving at 190
       read as ten days behind and was told to eat less. */
    var at = Math.min(now, to);
    return { lb: startLb + per * (at - from), per: per, daysLeft: to - now };
  }

  /* The day-to-day jump, and how big a jump is ordinary for this person.
     Wheeler's moving range: the limit is 3.268 times its own average. */
  function mJump(k) {
    var keys = Object.keys(MWEIGHTS).sort();
    var at = keys.indexOf(k);
    if (at < 1) return null;
    /* Same rule as the charts: a pair that straddles a gap is not a moving
       range. This one decides whether an overnight change is worth
       mentioning, so bridging a fortnight here quietly RAISES the bar for
       "unusual" and the morning stops saying anything. */
    var mr = [];
    for (var i = 1; i < keys.length; i++) {
      if (mcDaysApart(keys[i - 1], keys[i]) > MC_GAP) continue;
      mr.push(Math.abs(MWEIGHTS[keys[i]] - MWEIGHTS[keys[i - 1]]));
    }
    if (mr.length < 5) return null;
    // and the jump itself is only a jump if it is against yesterday
    if (mcDaysApart(keys[at - 1], k) > MC_GAP) return null;
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

  /* Where the scale stands against the plan, as numbers rather than as a card.
   *
     Two screens say this: the morning line on My Day, and the plan sheet.
     They used to work it out separately, which is two chances to disagree
     about one fact — and they already had, on the calorie bar. One place
     computes it; both places read it. Today only, because every figure in it
     is about where you stand NOW. */
  /* A date, the way a person says it: "Feb 17", with the year when it is
     not this one — a slow rate once put an arrival four years out as
     "Sep 24", two days from now. */
  function mDateWord(d) {
    /* The year only when the date is far enough off to be ambiguous: "Jan 20"
       in September means this coming January. */
    var far = Math.abs(d - new Date()) > 330 * 86400000;
    return M_MONS[d.getMonth()] + ' ' + d.getDate() + (far ? ', ' + d.getFullYear() : '');
  }

  /* Pounds a week over the last three weeks: the latest week's mean against
     the mean of the week two weeks before it, halved. Null without three
     mornings in each. */
  function mRate3() {
    var keys = Object.keys(MWEIGHTS).filter(function (k) { return MWEIGHTS[k] > 0; }).sort();
    if (!keys.length) return null;
    var dayN = function (k) { return Math.round(keyDate(k).getTime() / 86400000); };
    var lastN = dayN(keys[keys.length - 1]);
    var a = [], b = [];
    keys.forEach(function (k) {
      var back = lastN - dayN(k);
      if (back < 7) a.push(MWEIGHTS[k]);
      else if (back >= 14 && back < 21) b.push(MWEIGHTS[k]);
    });
    if (a.length < 3 || b.length < 3) return null;
    var mean = function (x) { return x.reduce(function (s0, v) { return s0 + v; }, 0) / x.length; };
    return (mean(a) - mean(b)) / 2;
  }

  /* "Feb 17 · 4 weeks late", "on track", or no date — the estimate as a
     chip, for the open card. */
  function mArriveChip(pf) {
    if (!pf.plan.per) return pf.side === 'on' ? 'on track' : pf.side === 'behind' ? 'off your weight' : 'on track';
    if (!pf.arriveD) return 'no date yet';
    var d = pf.lateDays;
    if (Math.abs(d) <= 6) return 'on track';
    var span = Math.abs(d) >= 14 ? Math.round(Math.abs(d) / 7) + ' weeks' : Math.abs(d) + ' days';
    return pf.arrive + ' \u00b7 ' + span + (d > 0 ? ' late' : ' early');
  }

  function mPaceFacts(k, draft) {
    k = k || todayKey();
    /* The saved profile, unless a sheet is holding an unsaved one. The plan
       screen previews what an edit would do, and a pace line that answered
       for the old goal while the ledger above it answered for the new one
       would be the two-sources bug again, one field apart. */
    var pr = draft || mReadProfile();
    var st = mWeightStats();
    var plan = mPlanWeight(k, pr);
    if (!plan || !st || st.n < 14) return null;
    var meas = mMeasuredTdee();
    var jump = mJump(k);

    /* Measured against the plan line ON THE MORNING THE AVERAGE IS OF, not
       against today's.
     *
       avg7 is anchored on the last weigh-in; plan.lb moves every day. Compared
       across that gap the difference grew on its own: identical mornings and
       an identical plan, read the day of the last weigh-in, said 12 days
       behind, and read a fortnight later said 24. Half of that number was
       just the days since he stood on the scale, and the card never said so.
       A stale reading should go stale, not get worse. */
    var atPlan = mPlanWeight(st.lastKey, pr) || plan;
    var off = st.avg7 - atPlan.lb;                // positive means heavier than planned
    var daysOff = plan.per ? Math.round(off / -plan.per) : 0;
    /* The measured burn whenever there is one, whatever the plan's switch
       says — deliberately. The switch decides what the PLAN is built on; this
       line's job is to notice when the plan is not landing, and the only
       evidence of that is the measurement: behind pace while eating to a
       formula plan means the formula is wrong for you. It names the burn it
       used ("burn measures ..."), and Eat N is saved as your own choice, so
       the weekly follow does not put the formula's number back over it. */
    var burn = meas ? meas.tdee : mTdee(pr);
    /* A floor of this line's own, because a line that says "eat 1,278" is
       not advice — it is arithmetic with nobody reading it. Never under the
       basal rate, never more than a quarter off the day's burn. It is
       stricter than the plan calculator's floor (mFloorK), so a plan written
       under that one can already sit below this, and then the number here
       is the least the line will ask for, not a cut. When the honest number
       is capped, the date is what moves, and the line says so. */
    /* Under a week out, or past, there is no rate to ask for: the plan
       itself stops working one out (mGoalPace), and dividing what is left by
       one day produced numbers like 2,533 to "land on time" on a date gone. */
    var rawNeed = burn === null || plan.daysLeft < 7 ? null
      : burn - (st.avg7 - pr.goalLb) * 3500 / plan.daysLeft;
    /* The same floor the plan lives under, because two floors meant this line
       could offer MORE food than the plan while calling itself the lowest it
       goes — 1,904 against a 1,514 plan, on a day already behind pace. It kept
       max(basal, three quarters of the burn), which is a defensible rule about
       health and the wrong rule for a line whose whole job is to say what
       reaching the goal costs. Nutrient floor, then the fat ceiling. */
    var fatF = mBodyFat(pr);
    var floor = mFloorK(pr);
    if (fatF && burn !== null) floor = Math.max(floor, burn - fatF.lb * MFAT_MAX);
    /* And the plan's own speed limits, which this line did not know about.
       mGoalPace will not plan a cut faster than 1% of bodyweight a week, nor
       a gain faster than half that or a fifth over the burn; this line asked
       for 1,565 on a plan capped at 1,804 (2.5 lb a week), and on a gain goal
       with nothing above it at all said "Eat 5,202". Same limits, both ways. */
    var lbNow = pr.lb > 0 ? pr.lb : 0;
    var ceil = Infinity;
    if (burn !== null && lbNow) {
      if (plan.per < 0) floor = Math.max(floor, burn - lbNow * 0.01 * 3500 / 7);
      else if (plan.per > 0) ceil = burn + Math.min(lbNow * 0.005 * 3500 / 7, 0.20 * burn);
    }
    var capped = rawNeed !== null && (rawNeed < floor || rawNeed > ceil);
    var capHigh = capped && rawNeed > ceil;
    /* Rounded UP off the floor, never down onto it: a number printed a
       calorie under the basal rate is still a number under the basal rate. */
    var need = rawNeed === null ? null
      : capHigh ? Math.floor(ceil) : capped ? Math.ceil(floor) : Math.round(rawNeed);
    /* Everything below is read TOWARD the goal, so a gain goal is judged on
       gaining: heavier than the line is behind on a cut and ahead on a
       gain. daysOff already carried the sign through plan.per; side and the
       arrival did not, and told somebody putting weight on that being
       heavier than planned was behind. */
    /* Holding a weight (per 0) has no "ahead": off the line either way is
       off it. It read a gain of 1.8 lb a week as "0 days ahead of pace". */
    var toward = plan.per < 0 ? off : plan.per > 0 ? -off : Math.abs(off);   // positive means behind
    var closing = st.dWeek === null ? null : (plan.per < 0 ? -st.dWeek : st.dWeek);
    /* When you will actually get there, at the rate the scale is moving.
       Blake: "How about not telling me I'm behind but that my target date
       estimate has moved from when to when." Read over THREE weeks — this
       week's average against the one two weeks before — because one week's
       change is mostly water, and an estimate built on it would move by a
       month after a salty weekend. Compared against the date you set, which
       does not move, rather than yesterday's estimate, which would. */
    var rate3 = mRate3();
    var close3 = rate3 === null ? closing : (plan.per < 0 ? -rate3 : rate3);
    var arrive = null, arriveD = null;
    if (close3 !== null && close3 > 0.05 && pr.goalLb) {
      var wk = Math.abs(st.avg7 - pr.goalLb) / close3;
      if (wk <= 260) {
        arriveD = new Date();
        arriveD.setDate(arriveD.getDate() + Math.round(wk * 7));
        arrive = mDateWord(arriveD);
      }
    }
    var lateDays = arriveD && pr.goalBy
      ? Math.round((arriveD - keyDate(pr.goalBy)) / 86400000) : null;
    /* The band around the plan, from the same moving ranges. Inside it there
       is nothing to decide, and saying so is the whole job. */
    /* Never narrower than half a pound: a run of identical mornings has a
       moving range of nothing, and a band of nothing called 0.1 lb off the
       line "behind" — a scale's last digit is not a verdict. */
    var band = jump ? Math.max(0.5, 2.660 * jump.bar) : 3;
    var rate = st.dWeek === null ? null : Math.round(st.dWeek * 10) / 10;
    return {
      pr: pr, st: st, plan: plan, meas: meas, burn: burn,
      off: off, band: band, daysOff: daysOff, stale: st.staleDays,
      need: need, capped: capped, capHigh: capHigh, arrive: arrive, rate: rate,
      arriveD: arriveD, lateDays: lateDays, rate3: rate3, goalWord: pr.goalBy ? mDateWord(keyDate(pr.goalBy)) : '',
      /* Moving the way the goal goes, this week. */
      toward: closing !== null && closing > 0,
      side: toward > band ? 'behind' : toward < -band ? 'ahead' : 'on'
    };
  }

  /* Two places, one function, because the two lines it can draw belong on
     opposite sides of the fold.
   *
     `where` is 'face' or 'body'. The salt line is EVIDENCE — it exists to
     explain a number, and Blake's rule for this card has always been that
     what you do daily stays out and what is evidence for it goes behind the
     press. It was the deliberate exception, on the face because it is the
     only line in the app that says do NOT act on the number above it. He has
     now lived with it: "I don't like the persistent salt notice... I think it
     is interesting once, but should collapse into the rest of the card that
     carries the weight trend line." So it joins the trend line and the pace
     arithmetic behind the press.
   *
     The suppression it was doing stays. On a morning the salt explains, the
     FACE says nothing at all rather than falling through to "you are behind
     pace, eat less" — which is the advice the salt line existed to stop. A
     quiet face and an explanation one tap away, which is silence beating a
     stat and a stat beating a verdict, in that order. */
  function mMorningHTML(k, where) {
    var body = where === 'body';
    if (mAhead(k)) return '';                     // a morning that has not happened
    /* And not a morning that has been and gone. Every figure on this card —
       the seven-day average, the days off pace, what to eat to get back on
       it — is computed from where you stand NOW, not from where you stood on
       the day being looked at. Drawn over Sunday it said Sunday was eighteen
       days behind pace, which was neither true of Sunday nor something Sunday
       could be talked into doing anything about; the button offered to
       rewrite today's targets from a card sitting on a closed day.

       It also could not be sent away there, and that followed from the same
       fault rather than being a second one: the refusal is stored against the
       day it was made on, so dismissing it on Sunday silenced Sunday and left
       every other past day still carrying it. */
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
        /* The face keeps quiet on a salt morning; the explanation is in the
           fold. Returning '' here is the suppression, not an oversight. */
        if (!body) return '';
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
    /* Past the salt line there is nothing the fold wants: everything below is
       what to DO, which belongs on the face. */
    if (body) return '';

    /* Everything below is about where you stand NOW — the seven-day average,
       the days off pace, the number to eat to get back on it — so it is only
       true of today and is only drawn there. Below the salt card and not at
       the top of the function on purpose: mJump compares a day to the morning
       before it, so "Up 2.3 lb, that is salt, not fat" IS about the day being
       looked at and is worth reading about last Tuesday. Guarding the whole
       function took that away too, which was a wider cut than the fault. */
    if (k !== todayKey()) return '';

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

    /* Not enough history to say anything, so it says nothing.
     *
       This used to draw a line reading "7 more mornings and this will say
       whether you are on pace", with a progress count under it. Its content
       was that it had no content, and it sat above the plate for a
       fortnight — the first thing read every morning, every morning saying
       wait. A line that cannot answer is not a smaller answer; it is the
       question taking up the room. */
    var pf = mPaceFacts(k);
    if (!pf) return '';
    var off = pf.off, band = pf.band, daysOff = pf.daysOff, burn = pf.burn,
      need = pf.need, capped = pf.capped, arrive = pf.arrive, rate = pf.rate;
    var rw = rate === null ? '' : mLbWord(rate);
    var rateWord = !rw ? '' : rw === 'holding steady' ? 'Holding steady'
      : rw.charAt(0).toUpperCase() + rw.slice(1) + ' a week';
    /* With carb cycling on, the number this offers is the week's average and
       no single day will read it back — a training day runs higher and a rest
       day lower. Pressing a button marked 1,853 and watching the bar say
       1,667 is the app appearing to ignore you, so it says which it means. */
    var cyc = mTrainDays().length > 0 && mTrainDays().length < 7 ? ' a day on average' : '';

    /* The number already taken. Pressing "Eat 1,846" wrote the targets and
       redrew the card — and the card, computed from the scale alone, came
       back word for word with the same button. Blake: "I hit eat it but
       nothing happened." It had; nothing said so. Once the plan already eats
       what the card would ask, there is no decision left, so the card says
       what is being done and stops asking. */
    /* Nothing here was measured today. The average is of a morning that has
       been and gone, and the honest thing is to say which morning and what it
       read — not to hand down a verdict on it, and not to ask anybody to eat
       a number worked out from it. Blake, on being shown a pace verdict under
       an empty weigh-in box: "I didn't want to be nagged, but coached and
       informed." A stat, then silence, which is his own rule for the last
       line of a card. */
    /* Coached, in plain words. Blake, on "Eating 1,667 a day on average. 28
       days behind pace — this is the number that lands on time": "Am I
       eating that much? Should I be eating that much? It is unclear to me
       what it is even talking about." It was his TARGET, said as though it
       were a report of his eating, with three ideas in one sentence. So
       every line now opens on the target by that name, then says where you
       stand, then what to do — to you, the way a coach would: "Build it
       more like that. Make it personal like you are coaching me." */
    var cur = kcalOf(mReadTargets());
    var todayT = kcalOf(mDayTargets(k));
    var fmt = function (n) { return Number(n).toLocaleString(); };
    /* With carb cycling the target is a week's average and today reads
       differently; saying so here stops "1,667" and the bar's "1,745" from
       looking like two answers. */
    var target = function (n) {
      var tn = cyc && Math.abs(todayT - n) > 5
        ? ' <span class="mline-q">(' + fmt(todayT) + ' today, ' +
          (mIsTrainingDay(k) ? 'a training day' : 'a rest day') + ')</span>' : '';
      return '<b>Your target: ' + fmt(n) + ' a day</b>' + tn;
    };
    /* Where you'll land, not how far behind you are. Blake: "How about not
       telling me I'm behind but that my target date estimate has moved from
       when to when." The date you set is the anchor; the estimate is the
       three-week rate (mRate3). Within a week of the goal, it is on track. */
    var goalD = pf.goalWord;
    var est = (function () {
      if (!pf.plan.per) {
        var lbOff = Math.round(Math.abs(off) * 10) / 10;
        return pf.side === 'on' ? 'You’re holding your weight.'
          : 'You’re ' + lbOff + ' lb ' + (off > 0 ? 'over' : 'under') + ' your weight.';
      }
      if (!pf.arriveD) {
        return (pf.rate3 !== null && Math.abs(pf.rate3) >= 0.15 && !pf.toward
          ? 'Your weight’s gone ' + (pf.rate3 > 0 ? 'up' : 'down') + ' these three weeks'
          : 'Your weight’s been flat these three weeks') + ', so there’s no arrival date yet.';
      }
      if (pf.lateDays > 6) return 'Arriving around <b>' + arrive + '</b>, not ' + goalD + '.';
      if (pf.lateDays < -6) return 'Arriving around <b>' + arrive + '</b>, ahead of ' + goalD + '.';
      return 'On track for <b>' + goalD + '</b>.';
    })();
    var late = pf.plan.per && (!pf.arriveD || pf.lateDays > 6);
    var early = pf.plan.per && pf.arriveD && pf.lateDays < -6;

    if (pf.stale > 1) {
      if (mHushed(k, 'stale:' + pf.st.lastKey)) return '';
      return mLineHTML('wait', '◎',
        '<b>Last weighed ' + esc(mPretty(pf.st.lastKey)) + ': ' +
        (Math.round(pf.st.latest * 10) / 10) + ' lb.</b>',
        'Step on the scale when you can, and the coaching picks up from there.',
        [['Not now', 'mline:none:stale:' + pf.st.lastKey]]);
    }
    if (pf.plan.daysLeft <= 0) {
      return mLineHTML('calm', '✓', '<b>You’re at your goal: ' + pr.goalLb + ' lb.</b>',
        'Set a new goal when you’re ready.', null);
    }
    var eating = need !== null && cur > 0 && Math.abs(cur - need) <= 5;
    var head = target(eating ? need : cur);
    /* Taking the number already: say where it lands and leave it there. */
    if (eating) {
      return mLineHTML('calm', late ? '▲' : early ? '▼' : '✓', head,
        est + ' ' + (late && capped
          ? (pf.capHigh ? 'This is already as much as your body can put to use — stay with it.'
            : 'This is already as low as it’s safe to go — stay with it.')
          : late ? 'Stay with it \u2014 this target is set to land on ' + goalD + '.'
            : early ? 'Keep it up.' : 'Stay with it.'), null);
    }
    /* The offer follows the ESTIMATE, not the position on the plan line, so
       the words and the button never disagree: a date running late is offered
       the number that brings it back (less food on a cut, more on a gain),
       and one running early is offered the room. */
    var speeds = need !== null && cur > 0 &&
      (pf.plan.per < 0 ? need < cur - 5 : need > cur + 5);
    var slows = need !== null && cur > 0 &&
      (pf.plan.per < 0 ? need > cur + 5 : need < cur - 5);
    if (late && speeds) {
      if (mHushed(k, 'act:' + need)) return '';
      var why = meas && mBurn(pr) && Math.abs(meas.tdee - mBurn(pr).tdee) > 100
        ? ' Your body is burning about ' + fmt(meas.tdee) + ' a day, not the ' +
          fmt(Math.round(mBurn(pr).tdee)) + ' the formula guessed.' : '';
      return mLineHTML('act', '▲', head,
        est + why + ' ' + (capped
          ? (pf.capHigh ? 'The most your body can put to use is ' : 'The lowest it’s safe to go is ') +
            fmt(need) + ' — that brings the date closer, not all the way.'
          : (need < cur ? 'Dropping to ' : 'Raising it to ') + fmt(need) + ' brings it back to ' + goalD + '.'),
        [['Use ' + fmt(need), 'mline:eat:' + need],
          [cur > 0 ? 'Keep ' + fmt(cur) : 'Not now', 'mline:none:act:' + need]]);
    }
    if (early && slows) {
      var room = need;
      if (mHushed(k, 'ahead:' + room)) return '';
      var more = room > cur;
      return mLineHTML('ahead', '▼', head,
        est + ' ' + (more ? 'You could eat ' + fmt(room) + ' and still make it.'
          : fmt(room) + ' a day lands you right on ' + goalD + '.'),
        [['Use ' + fmt(room), 'mline:eat:' + room],
          [cur > 0 ? 'Keep ' + fmt(cur) : 'Not now', 'mline:none:ahead:' + room]]);
    }
    return mLineHTML('calm', late ? '◎' : '✓', head,
      est + ' Keep eating ' + fmt(cur) + ' a day.', null);
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
    /* Whether there is a plan at all decides which of the two doors this card
       shows — and whether it shows one. See the note beside the button. */
    var hasPlan = !!kcalOf(mDayTargets(k));
    var body;
    /* The graph, and nothing else. Beside it there were four lines saying
       the seven-day average four ways and the weekly change three — "204.5
       avg", "Averaging 204.5", "seven-day average 204.5", "up 0.2 on the week
       before" — and the rate the plan expects twice. Blake: "that whole
       thing can be way more concise and easy to understand. I like the graph
       though." The numbers are said once, under the goal (mPlanDetail). */
    if (st && st.n >= 2) {
      body = mSparkSVG();
    } else {
      body = '<div class="mw-stat">Weigh in a few mornings and your trend appears here.</div>';
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
    /* Three states, not two.
     *
       ASKING is a morning with nothing on the scale yet: the box and the tick
       and nothing else. No verdict, no history — a card that has not been
       given its two numbers has not earned an opinion, and a pace line over
       an empty box is the nagging this screen was rebuilt to stop.
     *
       SHUT is a morning already answered, and it means one row. Blake: "it
       needs to fully collapse." A card still showing two of its three rows is
       not shut.
     *
       OPEN is a tap, and only a tap. It is the only state that brings the
       trend, the history and the chart, because those are things you go
       looking for rather than things a morning owes you. */
    var answeredW = !!MWEIGHTS[k];
    var touchedW = S.mFold.weigh !== undefined;
    var openAll = touchedW && S.mFold.weigh === false;
    var asking = !touchedW && !answeredW && !mAhead(k);
    var shut = !openAll && !asking;
    var face = mPlanFace();
    var detail = mPlanDetail();
    var head = st && st.n >= 2
      ? Math.round(st.avg7 * 10) / 10 + ' lb avg' +
        (st.dWeek === null ? '' : ' &middot; ' + mLbWord(st.dWeek) + ' this week')
      : '';
    var ahead = mAhead(k);
    return '<div class="mslot-h">' +
        '<button class="mday-dot no-print" data-mdot="weigh"' + (ahead ? ' disabled' : '') +
          ' aria-label="Log this morning&rsquo;s weight"></button>' +
        /* "Plan today", not "Weigh-in". The card takes two things only you
           know — what the scale said and whether you are training — and hands
           back the one thing you opened the app for. Naming it after the
           first of its two inputs described a third of it. Blake: "weigh in
           card I think needs to be more plan the day." */
        /* aria-expanded is OPEN, not "not shut". The asking state shows the
           box and the tick and is still closed as far as the fold is
           concerned — and while it claimed to be expanded, the toggle read
           it as open and every tap CLOSED the card. Which is also how the
           only door to the plan sheet became unreachable: the suite's
           opener taps this handle to reach "Adjust my plan", and the tap was
           being spent shutting what it meant to open. */
        '<button class="mslot-name" data-mfold="weigh" aria-expanded="' +
          (openAll ? 'true' : 'false') + '">Plan today' +
          /* The handle lives on this row now, because on a morning you have
             not weighed yet this row IS the card. It used to sit on the
             verdict line below, which only exists once there is a plan and a
             week of mornings to say anything about. */
          '<span class="mfold-cue" aria-hidden="true">&#8964;</span>' +
        '</button>' +
        /* The box, and nothing else. It wore the word "Weight" in front of
           it — on a card headed WEIGH-IN, above a line about weight, next to
           a figure in pounds — which pushed the whole thing onto a second
           row to say what the card had already said twice. The label is the
           card; the unit is the only word that carries anything. */
        /* Folded, the row carries what the card decided instead of the box
           that decides it. Blake: "it needs to fully collapse." A card that
           keeps three rows when shut is not shut, and the two inputs are no
           use to a morning already answered — but the answer is, all day. */
        (shut
          ? (function () {
              if (!answeredW && !(st && st.n >= 2)) {
                return '<span class="mw-ask">Weigh in</span>';
              }
              /* The AVERAGE, not this morning's number, because the average
                 is what the plan is actually built on — mScaleLb reads avg7,
                 and a single morning is mostly water. With too few mornings
                 to average, the number you typed stands in.
               *
                 And not the day's calories or macros: the sticky strip above
                 carries those, and a card repeating them is a second answer
                 to a settled question. */
              var sumN = st && st.n >= 2
                ? '<b>' + (Math.round(st.avg7 * 10) / 10) + '</b><u> lb avg'
                : '<b>' + (Math.round(MWEIGHTS[k] * 10) / 10) + '</b><u> lb';
              /* No verdict chip here: the coaching line directly under the
                 closed card already says where you stand, and a chip beside
                 it pushed the card's name onto two lines at phone width. */
              return '<span class="mw-sum">' + sumN +
                (mTrainDays().length && mTrainDays().length < 7 && mIsTrainingDay(k)
                  ? ' &middot; trained' : '') + '</u></span>';
            })()
        : ahead
          ? '<span class="mw-avg mw-later">not yet</span>'
          /* Text, not number, with the decimal keypad asked for separately.
           *
             A number input EATS a comma before any script sees it: type
             "80,5" and the browser hands you "805", which is a real number,
             passes every guard, stores eight hundred and five pounds and
             doubles the day's calories off a seven-day average. Blake does
             not write weights with commas — so a comma is not a weight that
             needs interpreting, it is a keystroke that means the entry is
             wrong. It can only be refused if it survives long enough to be
             seen, and only a text box lets it. Length-capped because the box
             no longer has a max of its own. */
          : '<label class="mt-lab no-print"><input type="text" id="mWeight" maxlength="6" ' +
            'inputmode="decimal" autocomplete="off" ' +
            'aria-label="This morning\u2019s weight in pounds" ' +
            'value="' + (v || '') + '"> lb' +
            '<span class="mw-note" id="mWeightNote" role="status"></span></label>') +
      '</div>' +
      /* Next to the weigh-in, because it is the other thing a morning knows
         about you, and on its own line because that header row already
         carries a dot, a name, a fold cue and a number box.
       *
         It says nothing when there is no cycling to move: with a flat plan
         the tick would be a box that changes nothing, which is worse than no
         box. And it never claims to have earned anything — the calories were
         counted when the profile was filled in. */
      (shut || ahead || !mTrainDays().length || mTrainDays().length >= 7 ? ''
        : '<div class="mw-train no-print">' +
            '<button class="mw-tick" data-mtrained="' + esc(k) + '" aria-pressed="' +
              (mIsTrainingDay(k) ? 'true' : 'false') + '">' +
              '<span class="mw-tick-l">Trained today' + (function () {
                /* What the tick did, in one line under it — the paragraph that
                   explained carb cycling said the same thing in forty words. */
                var base = mReadTargets(), dt = mDayTargets(k);
                if (!base.c || dt.c === base.c) return '';
                return '<span class="mw-tick-s">' + dt.c + ' g carbs today · ' + base.c +
                  ' on an average day</span>';
              })() + '</span>' +
              '<span class="mw-tick-b" aria-hidden="true"></span></button>' +
          '</div>') +
      /* The day's numbers are NOT repeated here. They were, for one build:
         "1,745 calories today, 205 P 61 F 94 C" — which is the sticky strip
         four inches above it, said again in different words. Blake: "I don't
         need a duplicate card saying the exact same thing. The sticky header
         is doing it with the calories and macros."
       *
         So this card says only what nothing else does: what the scale read,
         whether you trained, and why that moved the carbohydrate. */
      /* The tick's whole justification, said once where somebody looking for
         it will find it. It buys no calories — the sessions were counted when
         the profile was filled in, and paying for them twice is the fault this
         tick was built to avoid. What it does buy is carbohydrate moved onto
         today and off a rest day, and the week ends where it started. Blake,
         reasonably suspicious: "with the training tick, it does give me more
         calories. From what I understand it should not." Both are true, and
         only saying so out loud settles it. */
      '' +
      /* The plan, one line, on the face — and the same handle the meals wear,
         on the seam rather than in the header: this line is the last thing
         above what folds away, so the mark on the end of it is sitting at the
         edge that moves.
       *
         With no plan yet the line is the invitation instead, and then it is
         not a handle at all: it carries a button of its own, and a button
         inside a button is not a thing. The name still folds the card. */
      /* Two verdicts, and only one of them is an opinion.
       *
         With a plan (face.has) this line judges your pace, and judging is
         something you go looking for — OPEN only, never over a morning that
         has not been weighed.
       *
         With NO plan it is not a judgement at all, it is the invitation, and
         it carries the only door into the plan sheet that is not the gear.
         Gating it on `open` shut that door on a page nobody had weighed in
         on, and the suite threw at the first test that tried to walk through
         it. The comment below this one records the same mistake being made
         once before. It renders whenever the card is not collapsed. */
      (face.has
        ? (!openAll ? ''
        : '<div class="mw-verdict mw-open">' + face.html +
            (detail ? '<span class="mw-avg mw-stats">' + detail + '</span>' : '') + '</div>')
        : shut ? ''
        /* The button here only while there IS a plan to adjust.
         *
           With NO plan there were three "Craft my plan" in one screenful —
           this one, the readout's line above it, and the gear — none of them
           the thing a thumb lands on. The bottom bar's primary button is that
           way in now: the largest control on the tab, and previously dead and
           green at exactly this moment.
         *
           But it may not simply go. Dropping it outright left a plan that was
           already set, on a morning not yet weighed, with no way into the
           sheet except the gear — because the "Adjust my plan" copy below
           only renders once there is a weigh-in to fold away. The suite
           caught it in one run. So: gone when the bar is carrying it, present
           when the bar has gone back to Fill.
         *
           And it still says CRAFT, not adjust. Two different things get called
           a plan here: kcalOf(targets) is "are there numbers to eat against",
           which is what the bar branches on, and face.has is "is there a
           profile behind them" — a goal, a weight, a date. This is the
           face.has === false branch, so there is no crafted plan to adjust
           yet however the numbers got set, and "Adjust" would be offering to
           change something that does not exist. */
        : '<div class="mw-verdict">' +
          (head ? '<span class="mw-avg">' + head + '</span>' : '') + face.html +
          (hasPlan ? ' <button class="ghost mplan-go no-print" id="macroTargBtn">' +
            'Craft my plan</button>' : '') + '</div>') +
      (k === todayKey() ? mMovedHTML() : '') +
      mMorningHTML(k, 'face') +
      (!openAll ? '' : '<div class="mw-body">' + mMorningHTML(k, 'body') + body +
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
  /* A single food offered as a dish stops at a plateful. The ladder counts
     in the food's own unit, and for the vegetables that unit is the pound —
     so "no portion exceeds ×3" was a three-pound ceiling for broccoli, and the
     picker opened Wake Up on Broccoli ×1½ lb · 281 kcal · 19P, a protein
     source that is a bag of broccoli. Four hundred grams clears every real
     plate in the book (a cup and a half of egg whites is 365) and stops the
     bag. Foods only: a dish is measured in servings, and its own portion has
     its own rule. */
  var MFOOD_G_MAX = 400;

  function macroFit(r, R, T, D) {
    var best = null, smallest = null;
    // the share in calories, which is the thing a portion can be too big for
    var roof = MX_OVER * (4 * (T.p || 0) + 4 * (T.c || 0) + 9 * (T.f || 0));
    var kc = (r.macro && r.macro.kcal) || 0;
    for (var i = 0; i < MX.length; i++) {
      var x = MX[i], pen = 0;
      if (r.food && r.grams && r.grams * x > MFOOD_G_MAX) break;   // rungs only go up
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

  /* The fifth thing a plate costs you, said on the cost line with the other
     four — not as a bordered chip beside the book.
   *
     The box was the bug. At 74x16 inside an 11px-tall .mitem-from carrying
     overflow:hidden it overhung 2.5px each way, so the top and bottom borders
     were clipped off and what reached the screen was "RUN │1,079 mg salt│" —
     two vertical strokes around the words. A border that survives being cut in
     half is not a border, and the warning colour was doing the work anyway.
     The triangle is the app's own line-art, at the weight the bin is drawn. */
  function mSaltChip(r, x) {
    var na = Math.round(((r.macro || {}).na || 0) * x);
    if (na < MSALT_FLAG) return '';
    return '<span class="msalt">' +
      '<svg viewBox="0 0 16 16" aria-hidden="true">' +
        '<path d="M8 2.6 14.4 13.4H1.6Z" fill="none" stroke="currentColor" ' +
          'stroke-width="1.3" stroke-linejoin="round"/>' +
        '<path d="M8 6.8v2.6M8 11.3v.1" fill="none" stroke="currentColor" ' +
          'stroke-width="1.3" stroke-linecap="round"/>' +
      '</svg>' + na.toLocaleString() + ' mg salt</span>';
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
    /* No plan, no ranking.
     *
       With targets of 0/0/0 every share is 0 and D falls to its floor of 1,
       which leaves macroFit nothing to weigh but the overshoot term — and
       that is smallest at the smallest portion it is allowed to try. So every
       row came back at ×½: the picker offered half a serving of everything,
       and a tap logged half a serving nobody had asked for, on the one kind
       of day where the app has already said it will not make anything up.
   *
       A day with no targets has no fit to compute, which is the same case as
       a recipe with no numbers — so it takes the same honest answer the flat
       branch below already gives: the whole thing, in book order, ranked
       against nothing and saying so. Callers that need a fit filter on
       `score !== null` and correctly find none. */
    var planned = !!(targets && (targets.p || targets.f || targets.c));
    list.forEach(function (r) {
      if (planned && r.macro && ((r.macro.p || 0) + (r.macro.c || 0) + (r.macro.f || 0)) > 0) {
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
  /* What the day is still owed, cached for the length of one render.
   *
     Every row on a forty-row list asks the same question, and answering it
     per row walked the whole day forty times. Cleared by mGapFresh() at the
     top of each list build, because a tick changes the answer and a stale
     one would paint the row that just moved against the gap it moved from. */
  var MGAP = null;
  function mGapFresh() { MGAP = null; }
  function mGapLeft() {
    if (MGAP) return MGAP;
    var k = mViewKey(), t = mDayTargets(k);
    if (!t.p && !t.f && !t.c) { MGAP = { none: true }; return MGAP; }
    var sub = mDayEaten(k);
    MGAP = { none: false, p: Math.max(0, t.p - sub.p), f: Math.max(0, t.f - sub.f),
      c: Math.max(0, t.c - sub.c), t: t };
    return MGAP;
  }

  /* Does this portion LAND the macro it is being read against, or bust it?
   *
     The band is the day's, not the row's — a tenth of the day's target,
     floored so a nearly-closed macro does not call everything a bust. The
     same rule the meal gauges use, and for the same reason: a tolerance
     measured against a small remainder lights up on everything. */
  /* Honest note on `busts`: it is nearly unreachable from the picker's own
     suggested portions, and that is the fit engine working rather than a
     bug. macroFit prices fat and carb overshoot at twenty times undershoot,
     so the portion it solves for almost never lands past the gap — a
     mutation that disabled busting entirely left the suite green, on every
     seeded day tried. It fires where a portion is not fit-solved: a plate
     stepped up by hand. Kept because that path is real, not claimed as
     covered. */
  function mAgainstGap(m, got) {
    var g = mGapLeft();
    if (g.none || !(g[m] > 0)) return '';
    var band = Math.max(3, (g.t[m] || 0) * 0.1);
    if (got > g[m] + band) return ' busts';
    if (Math.abs(got - g[m]) <= band) return ' lands';
    return '';
  }

  /* `vsGap` is opt-in, and the reason is worth stating: reading a macro
     against what the day is still owed only means something for food you
     have NOT put on the day yet.
   *
     A plate you already ate is counted IN that gap — mDayEaten walks the
     whole day — so painting it against the remainder is circular: the plate
     turns warm for busting a gap it is itself the reason for. Same for a row
     sitting in the basket, which is counted before it is committed. Those
     rows state what they are; only candidates are judged. */
  function mMacLine(r, x, vsGap) {
    var mac = r.macro || {};
    var cell = function (m, lbl) {
      var v = Math.round((mac[m] || 0) * x);
      return '<span class="mgc' + (vsGap ? mAgainstGap(m, (mac[m] || 0) * x) : '') + '">' + v +
        '<i class="mb-' + m + '">' + lbl + '</i></span>';
    };
    /* No tilde. Two thirds of the book's recipes are estimated from the
       food table rather than a label, so the mark was on most rows most of
       the time — and a hedge that is always on is not a hedge, it is noise
       taking up the width the numbers needed. The figures earn trust by
       being right, not by apologising. (`est` is still on the record; only
       the apology is gone.) */
    return Math.round((mac.kcal || 0) * x) + ' kcal · ' +
      cell('p', 'P') + ' · ' + cell('f', 'F') + ' · ' + cell('c', 'C');
  }

  /* The one mark nothing else on the list can earn: this portion of this
     dish leaves every macro inside the band at once.
   *
     Rare on purpose. Judged only when there is a real gap to close — with a
     gram of protein and no fat left, almost anything lands all three, and a
     badge on twelve rows is the same as a badge on none. It also has to do
     some of the work rather than merely not disturb it. */
  function mClosesIt(r, x) {
    var g = mGapLeft();
    if (g.none) return false;
    var owed = g.p + g.f + g.c;
    if (owed < 25) return false;
    var mac = r.macro || {}, did = 0, ok = true;
    ['p', 'f', 'c'].forEach(function (m) {
      var got = (mac[m] || 0) * x;
      did += got;
      if (Math.abs(g[m] - got) >= 8) ok = false;
    });
    return ok && did >= owed * 0.5;
  }

  /* What one portion of this is CALLED, in the recipe's own words. A recipe's
     servings line is a yield — "6 Small Oat Bites", "4 Servings", "2 Loaves"
     — and the noun on the end of it is the name of one of them. The last word
     is what keeps it short enough to sit on the stepper: a day counted in
     "Meal Prep Containers" is counted in containers. A food carries its unit
     outright. */
  function mUnitWord(r) {
    if (r.food) return String(r.unit || 'serving');
    /* The word is only the serving's word when the count in front of it IS
       the serving count. "8 Pancakes (4 Servings)" named a plate "1 pancake"
       and charged two; "About 1 Cup (8 Servings)" of syrup read "1 cup" for
       an eighth of one. The book's lines lead with the count now, and a line
       that does not — an own recipe reading "Makes a dozen" — gets the plain
       word rather than a wrong one. */
    var lead = parseFloat(String(r.servings || '').replace(/^\s*about\s+/i, ''));
    if (!(lead > 0) || Math.abs(lead - (r.servN || 1)) > 0.01) return 'serving';
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
  /* How far a portion may be stepped, and by how much.
   *
     Blake, logging his lunch: "the limit on the qty I can select. Is it
     limiting me to 4 nuts and won't let me add more." It was, and not only
     nuts — his day had bacon at 4 slices, gummies at 4 pieces, hard candy at
     4 pieces and ground beef at 4 oz, every one of them sitting on the same
     ceiling. Both steppers, the plate's and the picker's, carried their own
     copy of Math.min(4, x + 0.25).
   *
     Four is a sane ceiling for a RECIPE, where x is a multiple of a serving —
     the recipe panel has scaled a dish a quarter to eight times since the app
     was built, so eight is the app's own answer to "how much of one dish is
     still a portion". It was never a ceiling for a FOOD, where x is a count
     of the thing itself: four nuts is not a snack, it is a rounding error.
   *
     A quarter is the wrong STEP for those too. You cannot eat a quarter of a
     nut, a quarter of a slice of bacon or a quarter of a gummy; you can very
     easily eat a quarter of a cup. So the countable things step by one and
     the measurable ones keep their quarters. */
  var MSTEP_COUNT = { nut: 1, piece: 1, slice: 1, each: 1, whole: 1, egg: 1,
    bar: 1, cookie: 1, cracker: 1, chip: 1, wrap: 1, tortilla: 1, link: 1,
    patty: 1, scoop: 1, packet: 1, can: 1, bag: 1 };

  /* Dialled by the gram, or counted in ones.
   *
     Blake weighs: "sometimes it's just easier for me to measure the food on
     a scale than using cups" — and then, of the dial, "adjust grams with the
     +/- and show the serving size where the grams are being shown now." So a
     food measured by the cup, the spoon, the ounce or the pound is dialled by
     the gram: the weight is the number on the stepper, and the unit it came
     in is the chip beside it — the old arrangement turned around. A food
     that comes in ones — an egg, a slice, a nut, a bar — still counts in
     ones with its weight on the chip, because nobody weighs an egg. A food
     you typed yourself has no weight to dial. */
  var MGRAM_STEP = 5;
  function mByGram(r) {
    if (!r || !r.food) return false;
    var unit = String(mUnitWord(r) || '').toLowerCase();
    /* A food you typed yourself in grams has no weight per unit and needs
       none: its unit IS the gram (mGramBase says a hundred of them). */
    if (unit === 'g') return true;
    return !!r.grams && !MSTEP_COUNT[unit];
  }
  /* What the number on the dial is counted in: grams, or the food's own
     unit with "each" said as "whole". */
  function mDialUnit(r) {
    if (mByGram(r)) return 'g';
    var u = mUnitWord(r);
    return u === 'each' ? 'whole' : u;
  }

  function mStepRule(r) {
    /* A dish keeps a ceiling, because x means MULTIPLES OF A SERVING there
       and the recipe panel has scaled one a quarter to eight times since the
       app was built. Eight servings of one dish is the end of the question. */
    if (!r || !r.food) return { step: 0.25, max: 8 };
    var unit = String(mUnitWord(r) || '').toLowerCase();
    var step = MSTEP_COUNT[unit] || 0.25;
    /* A food has NO ceiling. Blake: "why even have a cap? Probably can remove
       it for foods." He is right, and the reasoning is the same one that made
       four wrong: x is a count of the thing itself, so a ceiling is the app
       deciding how much of it a person may eat. Ninety-nine was as arbitrary
       as four; it only bit less often.
     *
       Nothing downstream wanted the bound either. The cost line and the day's
       bars are computed from x and redraw as it moves, the bars clamp their
       own fills, and a number typed wrong is one tap from right. Only the
       ARITHMETIC has to hold, which is what the guard below is for: a portion
       must stay a positive, finite number. */
    return { step: step, max: Infinity };
  }

  /* The sizes the solver may PROPOSE for one plate.
   *
     Coordinate descent used a single global ladder — MX_ALL, a quarter to
     four — for every plate on the day. That is the right ladder for servings
     of a dish and the wrong one for a count of a thing: it could never offer
     eighteen nuts or two hundred grams, only snap toward four. Hand-stepping
     past it survived by luck rather than design, because `best` starts at the
     plate's current size and a bigger one wins on a day still under target —
     on a day gone OVER the same code walks it back down to four.
   *
     So the ladder follows the food: its own step, the low end kept so the
     solver can still shrink a plate to nothing much, and a dozen rungs either
     side of where the plate actually sits so it can be tuned rather than
     replaced. Bounded in length because the descent runs this for every free
     plate on every pass. */
  function mLadder(r, x) {
    if (!r || !r.food) return MX_ALL;
    var step = mStepRule(r).step;
    var here = Number(x) > 0 ? Number(x) : step;
    var seen = {}, out = [];
    var put = function (v) {
      v = Math.round(v / step) * step;
      v = Math.round(v * 1000) / 1000;
      if (v >= step && !seen[v]) { seen[v] = 1; out.push(v); }
    };
    for (var i = 1; i <= 12; i++) put(i * step);        // the low end, always
    for (var j = -6; j <= 6; j++) put(here + j * step); // and where it sits now
    return out.sort(function (a, b) { return a - b; });
  }

  /* One step, in whichever direction, under that rule. Shared because the two
     steppers that need it were already two copies of one line. */
  function mStepX(r, x, dir) {
    /* Five grams a tap, on the five-gram grid, never below five. A weight
       that arrives off the grid — 113 g, a cup of cheddar the solver sized —
       goes to the NEXT grid point in the direction pressed (115, then 120),
       so no tap ever moves more than five grams. Only the hand dial: the
       solver's ladder (mLadder) keeps stepping in the food's own unit, where
       a rung is a kitchen-sized move rather than a nudge. */
    if (mByGram(r)) {
      /* Whole grams first. x is kept to four decimals, and 145 g of a
         140 g cup is 1.0357 of it — which times 140 is 144.998, one grid
         point SHORT of where the dial says it is, so the next tap up landed
         on 145 again and chicken breast stuck there for good. The dial
         rounds to the gram; the step starts from the same number. */
      var g = Math.round((Number(x) || 0) * mGramBase(r)), st = MGRAM_STEP;
      g = dir > 0 ? Math.floor(g / st) * st + st : Math.ceil(g / st) * st - st;
      g = Math.max(st, g);
      return Math.round(g / mGramBase(r) * 10000) / 10000;
    }
    var rule = mStepRule(r);
    var next = (Number(x) || 0) + (dir > 0 ? rule.step : -rule.step);
    /* Land back on the grid when a portion arrives off it — a food solved to
       1.75 nuts by the balancer should step to 2, not to 2.75. */
    next = Math.round(next / rule.step) * rule.step;
    next = Math.max(rule.step, Math.min(rule.max, next));
    return Math.round(next * 1000) / 1000;
  }

  /* The portion as a number you could type, and back again.
   *
     They are not the same number. For everything counted in its own units — a
     nut, a slice, a serving, a cup — x IS the count and the conversion is the
     identity. For a food measured in grams it is not: mPortion shows
     r.grams * x, so the 185 on screen is a weight and the x behind it is a
     multiple of one portion of that food. Typing 185 and storing 185 would be
     storing a hundred and eighty-five servings. */
  function mGramBase(r) { return (r && r.grams) || 100; }

  function mTypedFromX(r, x) {
    var n = mByGram(r) ? (Number(x) || 0) * mGramBase(r) : (Number(x) || 0);
    return Math.round(n * 100) / 100;
  }

  function mXFromTyped(r, n) {
    var v = mByGram(r) ? (Number(n) || 0) / mGramBase(r) : (Number(n) || 0);
    /* The only bound left, and it is arithmetic rather than policy: a portion
       has to be a positive, finite number or every figure downstream of it is
       NaN. There is no ceiling — see mStepRule. */
    if (!isFinite(v) || v <= 0) return null;
    return Math.round(v * 10000) / 10000;
  }

  function mPortion(r, x) {
    var unit = mUnitWord(r);
    var grams = r.grams ? Math.round(r.grams * x) : 0;
    if (unit === 'g') return { head: (grams || Math.round(100 * x)) + ' g', detail: '' };
    /* The chip is the weight said in the kitchen's word, to the nearest
       eighth: 145 g of chicken is "1 cup", 21 g of peanut butter "1⅜ tbsp".
       Plural by the eighth that is SHOWN, not by x — 145 g is 1.04 cups, and
       the live site said "1 cups" of it. */
    if (mByGram(r)) {
      var shown = Math.round(x * 8) / 8;
      return { head: grams + ' g', detail: fmtNum(shown) + ' ' + fixUnit(unit, shown) };
    }
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

  /* mYieldText — "makes 4" — went with the provenance row it was the middle
     third of. The plate had one caller and there was never a second; the
     recipe says what it makes, on the recipe, where you read it while
     cooking rather than while eating. Deleted rather than left standing: a
     function nothing calls is a claim that something does. */

  /* The day you are on says its verdict in a word, and no other day does.
     A key under the strip — a swatch each for under, on and over — is a
     thing you read once and then have to keep re-reading, because three
     tints of one family do not stay learned. One word under the one square
     you already had a reason to look at teaches the whole strip instead:
     you see "close" under a pale green square, and the other six are
     legible from then on, with no legend anywhere on the card. */
  var MWK_SAY = { under: 'under', on: 'close', over: 'over' };

  /* The week you are in, seven blocks wide: each day's letter, its date, and
     the colour of how it went. The dropdown could only be read one option at
     a time, so "how did this week go" meant opening it seven times. Days
     ahead of today are shown but not reachable — the day is a record, not a
     diary you write forward into. */
  /* Where the target sits along each square's rail, as a fraction of it. Two
     thirds: enough of the rail before it to read a half-eaten day, enough
     after it to tell 103% from 140%. */
  var MWK_GOAL = 0.66;

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
      var gotRaw = dayObj ? mTotals(dayObj).all.kcal : 0;
      var got = Math.round(gotRaw);
      /* The bars' verdict, on the unrounded figure the bars judge: rounding
         here first put a day at 2,130.25 of 2,000 "over" on the bar and
         "close" on the strip. Rounded only for what is printed. */
      var state = !got || !tK ? '' : ' ' + mVerdict('kcal', gotRaw, tK);
      /* A ring is a day in progress; a filled circle is a day that has been
         eaten to the end. The colour is the same verdict either way — under,
         on, or over its target — so the week reads at a glance. */
      var done = dayObj ? mDayDone(dayObj) : false;
      var word = dk === k && state ? MWK_SAY[state.slice(1)] : '';
      /* How FAR off, inside the square that already says which side of the
         line it fell on.
       *
         Blake: "Right now I'm just seeing a lot of red and even though I'm
         close on some days I'm over so it's red." He is right, and the
         threshold is not the fix: a day one calorie past the line looks
         exactly like a day four hundred past it wherever the line is put.
         Moving a threshold moves the cliff; this removes it.
       *
         The goal sits two thirds along the rail on every square, so the
         seven marks line up and a day can be read against its neighbours as
         well as against its own target. That leaves the last third for the
         overshoot: 151% of target fills the rail, and anything past that
         pins — by which point the colour has said everything the length
         could add. */
      /* A bar now, not a square with a rail in it. Blake: "make the heat
         map icons a pill bar chart for how the day did, subtle target line
         and gradient blue to green to ochre" — and the gradient is what the
         rail's comment above was reaching for: no cliff at all. The fill
         rises through one gradient fixed to the track, blue at the foot,
         green across the target line, ochre above it, so the colour at the
         tip IS the distance, and a day at 104% is a green bar a hair past
         the line rather than a red square. */
      var spark = '';
      if (got && tK) {
        var ratio = got / tK;
        spark = '<i style="height:' + Math.min(100, ratio * 100 * MWK_GOAL).toFixed(1) + '%"></i>';
      }
      out.push('<button class="mwk-d' + (dk === k ? ' now' : '') + state +
        (train ? ' train' : '') + (done ? ' done' : '') + '"' +
        (ahead || tooOld ? ' disabled' : '') +
        ' data-mweek="' + dk + '" aria-pressed="' + (dk === k ? 'true' : 'false') + '"' +
        ' aria-label="' + M_WDAYS[d.getDay()] + ' ' + M_MONS[d.getMonth()] + ' ' + d.getDate() +
        (train ? ', training day' : '') + ', ' + tK + ' calorie target' +
        (got ? ', ' + got + (done ? ' eaten, all done' : ' on the day') : '') + '">' +
        '<span class="mwk-w">' + M_WDAYS[d.getDay()].slice(0, 1) + '</span>' +
        /* The track and the target line are on every day, food or not, so
           the seven lines read as one line across the week. */
        '<span class="mwk-c" aria-hidden="true">' +
          '<span class="mwk-b">' + spark + '</span><span class="mwk-g"></span>' +
        '</span>' +
        '<span class="mwk-n"><b>' + d.getDate() + '</b></span>' +
        '<span class="mwk-s">' + (word || '&nbsp;') + '</span>' +
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
    mDrawnToday = todayKey();
    mSnapTargets();
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
    /* `===`, as the comment says: `>=` wrote the routine onto every future
       day merely browsed to — a write to a day nobody asked to change, sent
       to the account. Planning a future day still gets its pins, from Fill,
       which runs the pin pass itself. */
    if (k === todayK && !MDAYS[k]) {
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
      /* ...and the meal holding an unanswered question stays open too.
       *
         The cascade card lives INSIDE the meal's fold, which is Blake's own
         call and the right one: "as soon as I select that share or steal
         I'd expect the macro pills to update, and then when I close the card
         it's not seen any more." A question about a meal should not outlive
         shutting that meal.
       *
         But arriving at the day is not shutting it. Everything with food on
         it folds on arrival, the finished meal carrying the card has food on
         it, and so the card was folded away before it had been read once —
         every reload, every tab switch, every return to My Day. Blake, on a
         day whose lunch ran 750 over: no card anywhere. The one screen that
         would tell him where the overflow went was reachable only in the
         same session he ticked the meal off in, which is why the whole thing
         has been redesigned twice by somebody who had never seen it at rest.
       *
         Answered is different. Done sets `ack`, the card becomes one line,
         and this stops holding the meal open — which is the point of having
         answered it. */
      var askK = '';
      var ev0 = mLastFinished(targets, slots);
      if (ev0 && Math.abs(ev0.miss) >= MCASCADE_MIN) {
        var sn0 = mSendOf(k);
        if (!(sn0 && sn0.f === ev0.k && sn0.ack)) askK = ev0.k;
      }
      slots.list.forEach(function (s2) {
        S.mFold[s2.k] = (day[s2.k] || []).length > 0 &&
          s2.k !== S.mTouched && s2.k !== askK;
      });
      Object.keys(day).forEach(function (sk2) {
        if (S.mFold[sk2] === undefined) S.mFold[sk2] = (day[sk2] || []).length > 0;
      });
    }

    /* Nothing to draft once every meal has something on it — or before there
       is a plan to draft against. Fill reads mDayTargets and portion-solves
       against whatever comes back, so with nothing set it would build a real
       day out of real recipes and present it as the answer to a question
       nobody asked.
     *
       But it does not sit there DEAD and green either. Driven cold, the first
       thing this tab shows a newcomer is the biggest, brightest control on
       the screen, disabled, with nothing saying why — and behind it the whole
       of My Day: the targets, the favourites, the best fits, and now the
       family's own week. Every one of those is reached through this button.
       A front door that cannot be opened and will not say so is the worst
       thing in the app, and it costs one branch to fix: with no plan, the
       button IS the way to make one, and says so. */
    /* One button, saying the next thing the day needs.
     *
       It used to be Fill beside a tick, and Fill went DEAD the moment every
       meal had something on it: the biggest, brightest control on the screen,
       disabled, for most of the day — the same fault the paragraph above
       describes for the no-plan case and fixes only there. Blake: "when all
       the foods are check marked I get to see a complete button for a day
       instead of a fill, because fill at that point doesn't make sense
       anymore."
     *
       Four states in order of what is left to do: make a plan, draft the
       day, close it, reopen it. The tick that used to carry the last two is
       gone from the bar; this is the same verb in the slot that was going to
       waste. */
    var fillBtn = $('macroFill');
    var noPlan = !kcalOf(targets);
    /* A skipped meal counts as dealt with. It asked only whether every meal
       had food on it, and a skipped meal never will — so one skip pinned the
       button to "Fill" for the rest of the day, through every plate being
       ticked, and neither "Mark all complete" nor "Complete the day" could
       ever be reached. Blake: "when all foods are marked complete, it's still
       showing fill. I'd expect to see something else." */
    /* And a day with no room left has nothing to fill either. An empty
       snack on a day already over its calories kept the button on "Fill",
       which then added nothing — pressed three times, it stayed "Fill", and
       "Mark all complete" could only be reached by skipping the snack. Asked
       by the same test Fill asks itself. */
    var nothingToFill = !noPlan && (mFillRoom(day, targets) < 100 ||
      slots.list.every(function (s) {
        return (day[s.k] || []).length || mSkipped(mViewKey(), s.k);
      }));
    var dayDone = mDoneAt(mViewKey()) > 0;
    var future = mViewKey() > todayKey();
    /* Is there a plate left to tick? Blake: "the done for the day button
       should be something like Mark all as complete. And once everything is
       completed I get the options to complete the day." Which is better than
       what this slot shipped with this morning: Done appeared as soon as
       every meal had FOOD, so it could be pressed having eaten nothing. Now
       the two are separate steps and each one is the literal next thing. */
    /* Two different counts, and conflating them left the sweeper lit with
       nothing it was willing to take: a LOCKED un-eaten plate can still be
       ticked, so it counts toward "mark all complete", but the sweeper
       leaves it alone, so it must not count toward "there is something to
       sweep". The test caught this by locking one. */
    var plates = 0, unticked = 0, loose = 0;
    slots.list.forEach(function (s0) {
      var pinned0 = (s0.pins || []).map(function (pn) { return String(pn.id); });
      (day[s0.k] || []).forEach(function (it) {
        plates++;
        if (!it.eaten) unticked++;
        // what the sweep would take: not eaten, not locked, not pinned
        if (!it.eaten && !it.l && pinned0.indexOf(String(it.id)) < 0) loose++;
      });
    });
    var mode = noPlan ? 'plan' : dayDone ? 'open'
      : !nothingToFill ? 'fill' : unticked ? 'tickall' : 'done';
    var SAY = { plan: 'Craft my plan', fill: 'Fill', tickall: 'Mark all complete',
      done: 'Complete the day', open: 'Reopen the day' };
    var TELL = {
      plan: 'Craft my plan — Nourish needs one before it can draft anything',
      fill: 'Fill the day',
      tickall: 'Mark every plate on the day as eaten',
      done: 'I am done for today',
      open: 'Day closed — press to reopen it'
    };
    fillBtn.classList.toggle('to-plan', noPlan);
    fillBtn.classList.toggle('to-done', mode === 'done' || mode === 'open');
    fillBtn.classList.toggle('to-tick', mode === 'tickall');
    fillBtn.dataset.mode = mode;
    if (fillBtn.textContent !== SAY[mode]) fillBtn.textContent = SAY[mode];
    fillBtn.setAttribute('aria-label', TELL[mode]);
    fillBtn.title = TELL[mode];
    /* A day that has not happened cannot be finished with, and there is
       nothing to draft against on it either. */
    fillBtn.disabled = future && mode !== 'fill';

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
    /* Any day, tomorrow included. Blake swept tomorrow's plan to start it
       again and nothing happened: the button was switched off on every
       future day, with nothing to say why — and planning a day ahead is
       exactly when you want to clear it. */
    $('macroSweep').disabled = !loose;

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
        // what you are having. What there was to have — the yield — went with
        // the provenance row, and mYieldText with it: this was its only caller.
        var port = mPortion(r, it.x);
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
        /* One plate, contained.
         *
           It used to be three rows with three different left edges — name and
           its icons, then chips and the arithmetic, then a stepper slab and a
           tick box. Blake: "it feels off to me. does not flow." The diagnosis
           that stuck was that the card was built out of CONTROLS with the
           content squeezed between them, and that the loudest boxes on it —
           the stepper and the tick — were the two things touched least often,
           while the name read every time carried no weight at all.

           He also ruled out the easy fix: "I have the skip, add, share,
           balance, lock, borrow... all those are things I want and use. They
           just need to be organized better." So nothing was removed.

           The plate is its own block, and everything inside it obviously
           belongs to it. That containment is the scope system: this block is
           THIS FOOD, the verbs at the card's foot are THIS MEAL, the borrow
           line is THE DAY — three scopes that previously looked identical and
           sat in one card. Word labels were drawn for the same job and
           dropped; the box says it without spending three rows per meal.

           Row one is the food: are you done with it, what is it, is it worth
           eating. Row two is today's portion and what it costs. */
        /* Three bands, and each answers one question.
         *
           Blake's layout, after a round of drawings: "Box. Outline.
           [Image][leaf score][name]......[pin][fav] / Practical uom. Cal PFC
           / [lock][serving size][-][+]......[check box]".
         *
           WHAT IS THIS — the leaf leads the row at full size, the name runs
           to the two controls that keep it: pin for the routine, the star
           for the book. WHAT IS IN IT — the weight and the four figures,
           indented under the name so they read as belonging to it. WHAT CAN
           I DO — one outlined strip carrying every verb that acts on this
           plate, with the portion boxed and its steppers joined to its right
           so the three things that change the amount read as one control.
         *
           The check moves to the far end of that strip and gains a word. It
           is the thing pressed most on the row and it was a 21px square in
           the corner furthest from a thumb, which is exactly backwards.
         *
           There is no image slot, because there are no images: 335 recipes
           and 221 foods, not a photograph among them. The leaf is what a
           plate has, and it is the better token anyway — it carries a number
           worth reading. */
        return '<div class="mitem' + (it.eaten ? ' eaten' : '') +
            (it.l ? ' held' : '') + '">' +
          '<div class="mitem-r1">' +
            /* The slot is kept even when there is no score to put in it.
               A badge drawn for a recipe and absent for a food cannot be the
               thing a column starts on: it puts two plates of one meal at two
               different left edges, which is a thing you feel without being
               able to name it. This file has the note already, from the last
               time the leaf led a row — and leading it again is exactly how
               the fault comes back. */
            (r.score === null || r.score === undefined
              ? '<span class="leaf-md leaf-gap" aria-hidden="true"></span>'
              : leaf(r.score, 'leaf-md')) +
            /* A recipe's name opens the recipe. A food's name opens the
               food: what one of it is, and — for a meal you kept together —
               the parts it was made of. It used to be a dead label, which
               left a five-part salad reading as one word and no way back. */
            /* The name, and — on a food Fill added — why, beside it: a chip
               that drops under the name only when the name is long. Blake:
               the endive logic is fine, "it's just invisible in the app". */
            '<span class="mitem-nm">' +
            (r.food
              ? '<button class="mitem-name mitem-food" data-mfood="' + esc(String(r.id)) +
                '" data-mx="' + it.x + '">' + esc(r.name) + '</button>'
              : '<button class="mitem-name" data-open="' + esc(String(r.id)) +
                '" data-mx="' + it.x + '">' + esc(r.name) + '</button>') +
            mWhyChip(it, tag) +
            '</span>' +
            '<span class="mitem-keep no-print">' +
              /* The pin is the routine: this food on this meal on every new
                 day — the Crio Brü that opens every morning without being
                 asked. Unpinning stops tomorrow, not today. */
              (onPlan ? '<button class="mic mpin" data-mpin="' + tag + '" aria-pressed="' +
                (pinned ? 'true' : 'false') + '" aria-label="' +
                (pinned ? 'Unpin from this meal' : 'Pin to this meal every day') + '">' +
                '<svg viewBox="0 0 16 16" aria-hidden="true">' +
                  '<path d="M5.4 2.6h5.2M8 2.6v4.3M6.4 6.9c-.4 1.7-1.5 2.7-2.6 3.1h8.4' +
                    'c-1.1-.4-2.2-1.4-2.6-3.1Z" fill="none" stroke="currentColor" ' +
                    'stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/>' +
                  '<path d="M8 10v3.4" fill="none" stroke="currentColor" ' +
                    'stroke-width="1.2" stroke-linecap="round"/>' +
                '</svg></button>' : '') +
              /* The star, new here. It lived only in the picker, which meant
                 you could keep a dish while shopping for it and not on the
                 day you actually ate it — and the day you ate it is the day
                 you know. A table food is not yours to star; one of your own
                 is. */
              (mCanFav(r) ? '<button class="mic mfav" data-mfav="' + esc(String(r.id)) +
                '" aria-pressed="' + (mIsFav(r) ? 'true' : 'false') + '" aria-label="' +
                (mIsFav(r) ? 'Remove from favourites' : 'Keep as a favourite') + '">' +
                '<svg viewBox="0 0 16 16" aria-hidden="true">' +
                  '<path d="M8 2.2l1.8 3.7 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4L2.2 6.5l4-.6Z" ' +
                    'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>' +
                '</svg></button>' : '') +
            '</span>' +
          '</div>' +
          mWhyStrip(it, tag) +
          /* What it is in the kitchen, and what it costs you.
           *
             The weight leads, because Blake weighs: "sometimes it's just
             easier for me to measure the food on a scale than using cups."
             A cup of oats is a range and 40 g of oats is 40 g, and every one
             of the foods in the table carries unit-to-gram weights.
           *
             The salt is a sibling of the figures, not inside them: the four
             numbers keep their own nowrap so they drop to a second line
             whole rather than breaking across two. */
          '<div class="mitem-r2">' +
            (port.detail ? '<span class="mitem-uom">' + esc(port.detail) + '</span>' : '') +
            '<span class="mitem-mac">' + mMacLine(r, it.x) + '</span>' +
            mSaltChip(r, it.x) +
          '</div>' +
          '<div class="mitem-r3 no-print">' +
            /* The two verbs in a group of their own, tight together, with the
               dial's own air after them. Proximity is the only thing saying
               these two belong to each other rather than to the portion
               beside them — spaced like everything else they read as one
               left-packed strip, which is what Blake called "not spread out
               well" the last time this row was built. */
            '<span class="mitem-verbs">' +
            '<button class="mic mdel" data-mdel="' + tag + '" aria-label="Remove ' + esc(r.name) + '">' +
              '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.2a1 1 0 0 0 1 .8h3.8a1 1 0 0 0 1-.8l.6-8.2" ' +
              'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</button>' +
            /* The lock guards against the MACHINE, not you — Rebalance leaves
               a locked plate alone but the stepper still works — so it sits
               beside the bin rather than inside the dial. Live even on an
               eaten plate: holding a food steady while the rest of the day
               moves around it is still worth saying afterwards. */
            (onPlan ? '<button class="mic mlock" data-mlock="' + tag + '" aria-pressed="' +
              (it.l ? 'true' : 'false') + '" aria-label="' +
              (it.l ? 'Unlock for Rebalance' : 'Lock against Rebalance') + '">' +
              '<svg viewBox="0 0 16 16" aria-hidden="true">' +
                '<rect x="3.4" y="7" width="9.2" height="6.4" rx="1.6" fill="none" ' +
                  'stroke="currentColor" stroke-width="1.2"/>' +
                '<path d="M5.6 7V5.1a2.4 2.4 0 0 1 4.8 0V7" fill="none" ' +
                  'stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
              '</svg></button>' : '') +
            '</span>' +
            /* Eaten is a record, not a dial. Once the tick is on, this plate
               is a thing that happened, and resizing what you already ate is
               editing the past — so the stepper goes quiet. One tap on the
               number hands it back.
             *
               The number is a button and pressing it lets you type one. The
               dial got you from one to two; it never got you to thirty nuts
               or a hundred and eighty-five grams. */
            /* The portion and its two steppers, together, in that order.
             *
               Blake: "Outline the serving size in a box as well. With +/- on
               the right side of it." Which is also the better grouping: the
               three things that change the amount now read as one control
               rather than as a number with a button on either side of it.
             *
               Still inside .mstep, and the figure still wears .mstep-x. Those
               two names are what fifteen tests reach for — typing a portion,
               stepping it, what it wraps to, what an eaten plate does to it —
               and not one of them is about where on the card it sits. Moving
               the element out of its own container to rearrange it is how a
               layout change turns into a behaviour change. */
            '<span class="mstep' + (it.eaten && S.mEdit !== tag ? ' spent' : '') + '">' +
              /* Eaten is a record, not a dial. Once the tick is on, this plate
                 is a thing that happened, and resizing what you already ate is
                 editing the past — so the stepper goes quiet. One tap on the
                 number hands it back.
               *
                 The number is a button and pressing it lets you type one. The
                 dial got you from one to two; it never got you to thirty nuts
                 or a hundred and eighty-five grams. */
              (S.mType === tag
                ? '<span class="mstep-x mitem-amt mitem-typing">' +
                    '<input class="mstep-in" type="text" inputmode="decimal" ' +
                      'autocomplete="off" data-mtypein="' + tag + '" ' +
                      'aria-label="Portion, in ' + esc(mDialUnit(r)) + '" ' +
                      'value="' + esc(String(mTypedFromX(r, it.x))) + '">' +
                    '<i>' + esc(mDialUnit(r)) + '</i>' +
                  '</span>'
                : it.eaten && S.mEdit !== tag
                ? '<button class="mstep-x mitem-amt mstep-wake" data-medit="' + tag +
                  '" title="Correct this portion">' + esc(port.head) + '</button>'
                : '<button class="mstep-x mitem-amt mstep-type" data-mtype="' + tag +
                  '" title="Type a portion">' + esc(port.head) + '</button>') +
              '<span class="mstep-keys">' +
                '<button data-mstep="' + tag + ':down"' + (it.eaten && S.mEdit !== tag ? ' disabled' : '') +
                  ' aria-label="Smaller portion">&minus;</button>' +
                '<button data-mstep="' + tag + ':up"' + (it.eaten && S.mEdit !== tag ? ' disabled' : '') +
                  ' aria-label="Bigger portion">+</button>' +
              '</span>' +
            '</span>' +
            /* The thing pressed most, at the end of the strip. It was a 21px
               box in the top-left corner — the state of the plate, given the
               smallest target and the furthest reach — then a labelled
               button, and now the box on its own: Blake, on the labelled
               one, "why a check box inside a box?" Quite. The input IS the
               control and it is drawn at full size; a frame around a
               checkbox is a second edge saying what the first one said. */
            '<input class="mitem-ate" type="checkbox" data-meat="' + tag + '"' +
              (it.eaten ? ' checked' : '') + (ahead ? ' disabled' : '') +
              ' aria-label="Eaten">' +
          '</div>' +
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
      /* Said once, used by whichever of the two headers this meal draws. */
      var pillsSay = mMealPillsSay(sub, mMealAsk(sk, targets, slots), targets);

      /* Skipped. One line instead of a card, struck through, with the way
         back on it — a day where lunch is visibly not happening tells you
         more later than a day where lunch simply is not there. Drawn before
         the card rather than instead of parts of it, because a skipped meal
         has no numbers, no plates and nothing to fold.
       *
         ...but it does have a WHOLE MEAL'S worth of calories to hand out,
         which is the largest cascade there is, and this row used to announce
         the handout as a fait accompli: "its share went to the rest". Blake:
         "with skip, should I also be able to tell it where to send the
         macros and calories?" He could not — and not because the chooser
         refused him, but because it was unreachable: it renders inside
         .mslot-items, and this branch returns before that exists. So the
         line carries it. Folded, the card is itself one line, which is what
         this row already was. */
      if (onPlan && !items.length && mSkipped(k, sk)) {
        var skSend = mCascadeLineHTML(sk, targets, slots);
        return '<div class="mslot mslot-skipped' + (skSend ? ' mslot-skipped-c' : '') + '">' +
          '<div class="mslot-skip-h">' +
            '<span class="mslot-skip-n">' + esc(name) + '</span>' +
            /* The row says only that it is skipped once the card below it is
               saying where the food went. Two sentences about one handout,
               one of them vague, is how the old row read. */
            '<span class="mslot-skip-w">' +
              (skSend ? 'skipped' : 'skipped &middot; its share went to the rest') + '</span>' +
            '<button class="ghost mslot-unskip no-print" data-mskip="' + esc(sk) + '" ' +
              'aria-label="Put ' + esc(name) + ' back">Undo</button>' +
          '</div>' + skSend +
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
          /* ...but only while there is something to fold.
           *
             On an EMPTY meal the name was still a fold button, and pressing
             it did nothing you could see — `folded` is gated on items.length
             and the seam only exists `if (rows)`, so the card did not move.
             The handler wrote S.mFold[sk] all the same, and mFoldFor stops
             Fill from clearing it. So: press an empty meal's name, press
             Fill, and that one meal comes back FOLDED with no steppers while
             every other meal opens. Measured — 157px and zero steppers
             against 193px and two.

             The fix is the honest one rather than clearing the flag later: a
             control that cannot do anything should not be a control. */
          /* The whole head is the door.
           *
             The mockup Blake approved says it in those words, and its card is
             one <button> carrying the name, the cue AND the meal's pills. The
             app had the name as a button instead — 11.5px of uppercase text,
             a 78x14 target adrift in a 378x45 row — because the row was
             carrying three icon buttons and a button cannot hold buttons. So
             the verbs moved to the foot of the open meal, where the mockup
             has them and where they read as words, and the head became what
             it looks like: the thing you press to open the meal.
           *
             The dot stays outside it. It marks the whole meal eaten, which is
             an action of its own, and the mockup's dot is decoration only
             because the mockup never modelled that control. */
          (rows
            /* The label carries the meal's numbers now, because nothing else
               can. The pills are aria-hidden and always were; the head is a
               <button>, and a button's accessible name comes from its own
               aria-label and overrides everything inside it — so marking up
               the pills would not have helped even before they were hidden.
               A screen reader has been getting "Open Breakfast" and not one
               figure off the card since this header was built. */
            ? '<button class="mslot-head" data-mfold="' + esc(sk) + '" aria-expanded="' +
              (folded ? 'false' : 'true') + '" aria-label="' +
              (folded ? 'Open ' : 'Fold ') + esc(name) +
              (pillsSay ? ' — ' + esc(pillsSay) : '') + '">' +
              /* One line: the name, then the meal's numbers, then the mark.
               *
                 They were stacked — name on top, pills beneath — which gave
                 every meal a two-row header and pushed the plates down by the
                 height of a row times six meals. On the line with the name
                 they read as what they are: this meal, and how it is going.
                 The name gives way first when the row runs out, because a
                 clipped word still says which meal it is and a clipped number
                 says nothing at all. */
              '<span class="mslot-name">' + esc(name) + '</span>' +
              '<span class="mslot-sp"></span>' +
              /* The numbers and the mark travel together. Loose, the mark
                 wrapped on its own the moment the row ran out — a chevron
                 alone on a second line, under nothing, belonging to nothing.
                 As one piece they either both sit beside the name or both
                 take the next line, and the mark is at the right of whichever
                 line they are on. */
              '<span class="mslot-tail">' +
                mMealPillsHTML(sub, mMealAsk(sk, targets, slots), targets, !eatenAll, !rows) +
                '<span class="mfold-cue" aria-hidden="true">&#8964;</span>' +
              '</span>' +
              '</button>'
            /* An empty meal wears the same four pills as a full one.
             *
               It used to get a single flame and a calorie figure, which told
               you the size of the meal and nothing about its shape — and the
               shape is the part you plan against. A meal you have not filled
               is precisely the meal you need the numbers for: 0 of 44 protein
               says what to go looking for, 🔥387 does not.
             *
               No mark on the end, because there is nothing behind it to fold.
               The strip is drawn at planned weight either way, so a day of
               six untouched meals reads as six quiet rows rather than
               twenty-four accusations. */
            /* An empty meal has no button to hang a label on, so it says the
               same sentence in a span only a reader hears. It is the meal
               MOST worth hearing — an empty one is the one you are about to
               fill, and "0 of 44 protein" is what tells you what to go
               looking for. */
            : '<span class="mslot-name mslot-name-flat">' + esc(name) + '</span>' +
              (pillsSay ? '<span class="vis-hidden">' + esc(pillsSay) + '</span>' : '') +
              '<span class="mslot-sp"></span>' +
              '<span class="mslot-tail">' +
                mMealPillsHTML(sub, mMealAsk(sk, targets, slots), targets, !eatenAll, !rows) +
              '</span>') +
          /* Only where there is something to solve. One plate has a stepper
             and needs no algebra; two or more is the question this answers,
             and a button on every meal from breakfast onward would be four
             buttons a day that nothing was ever pressed on. */

          /* No label. It said "everywhere", which only means something to
             somebody who already knows a meal is normally fenced to its own
             sections — and that fence has no marker of its own, so the word
             was naming the exit from a room nobody had been told they were
             in. The widening still happens; it just stops announcing itself
             in a vocabulary of one word. The suggestions ARE the message. */

          /* A plus, not "+ Add". Everybody knows what a plus does, and the
             word was the widest thing on a row that has too much on it. The
             label the word used to give is now the button's own, said to a
             screen reader instead of to the eye — and said better, because it
             names the meal the food is going on. */


        '</div>' +
        /* What the meal comes to, in the same four colours the bars use. */
        /* The handle is the bar the fold actually happens at. A boxed caret up
           in the header read as a third action button beside Add and the
           retry, and on a meal that also carries the scale it made four boxes
           fighting over one row. This is the seam instead: the meal's own
           numbers, sitting exactly where the plates appear and disappear,
           with a small mark on the end saying which way the next press goes.
           Full width, so the target is the whole strip rather than a glyph. */
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
                /* Held, said where the holding is visible.
                 *
                   The lock lives on the open plate, beside the portion it
                   holds still. Shut, the row carried no sign of it at all —
                   so the ordinary gesture (lock the dinner you promised the
                   family, fold the card, press Rebalance) gave back a day
                   with no way to see what had been spared. Eaten already
                   marks itself here; held had nothing.

                   Beside the portion, because that is where it sits on the
                   open plate and a fold should not move things. */
                '<span class="mthin-x">' + esc(mPortionText(r2, it.x)) +
                  (it.l ? ' <span class="mthin-l" role="img" aria-label="held through Rebalance"'
                    + ' title="Held through Rebalance">&#128274;</span>' : '') +
                '</span></div>';
            }).join('') + '</div>'
          : '<div class="mslot-items">' +
            /* Open is where the ± buttons are, so it is where the whole
               picture belongs — directly above the thing that changes it.
             *
               An empty meal gets NOTHING here, where it used to get an em
               dash on a line of its own. The dash said what the pills on the
               header already say — a meal reading 🔥0/262 is plainly empty —
               and it said it in about 26 px, on every empty meal, of every
               empty day, which is most of what tomorrow looks like. On a
               six-meal day that is over 150 px of placeholder before any food
               is reached. The card goes from three rows to two, and the row
               it loses is the one that was nothing. */
            rows +
            /* The verbs, at the foot of the meal they act on.
             *
               They were three icon buttons in the header, which is what
               stopped the header being a button and left the fold target the
               width of the word "BREAKFAST". Down here they are words: a ⚖
               and a ↻ are a guess every time until you have pressed them
               once, and the row they used to crowd is now the thing you press
               to open the meal. They are also only drawn on an OPEN meal,
               which is the only state they mean anything in — you cannot
               balance plates you cannot see. */
            (onPlan
              ? '<div class="mslot-acts no-print">' +
                /* Only the verbs this meal can actually use.
                 *
                   An EMPTY meal gets Skip instead of the other two. "Another"
                   means "not that one, what else" and "Balance" means "solve
                   these against each other", and neither is a question you
                   have about a meal with nothing on it — drawn anyway they
                   were two dead buttons on every empty meal of every empty
                   day, which is most of what tomorrow looks like. Skip is the
                   verb that meal DOES have, and it was over in the header
                   wearing a ⊘ that nobody reads as a word. The mockup's own
                   rule: controls that cannot act are not drawn.
                 *
                   And you still do not skip a meal you have put food on —
                   you delete the food. */
                (items.length
                  ? '<button class="mslot-act mslot-try" data-mtry="' + esc(sk) + '"' +
                      ' title="Another suggestion \u2014 walks down the best-fit list">' +
                      '&#8635; Another</button>' +
                    '<button class="mslot-act mslot-bal" data-mbal="' + esc(sk) + '"' +
                      (items.length >= 2 ? '' : ' disabled') +
                      ' title="Solve these portions against this meal\u2019s macros">' +
                      '&#9878; Balance</button>'
                  : '<button class="mslot-act mslot-skip" data-mskip="' + esc(sk) + '" ' +
                      'aria-label="Skip ' + esc(name) + ' today" ' +
                      'title="Not eating this today \u2014 its share goes to the other meals">' +
                      '&#8856; Skip</button>') +
                /* Keeping several plates as one thing is a verb, and this is
                   where this meal's verbs live.
                 *
                   It was a full-width dashed slab between the last plate and
                   this row — as tall as a plate, drawn in the ochre a control
                   is drawn in, competing with the food above it for a thing
                   you do to a meal maybe twice. The scope system the plate was
                   rebuilt around says it plainly: the block is THIS FOOD, this
                   row is THIS MEAL, the cascade line is THE DAY. A slab
                   floating between the plates and the verbs belonged to
                   neither. It is still only drawn where it can act.
                 *
                   No leading plus. Four buttons need the width: measured, the
                   row fits at 390 with 19px to spare and wraps below 375,
                   which is the same bargain .mslot-acts already strikes. */
                (items.length >= 2
                  ? '<button class="mslot-act mslot-keep" data-mkeep="' + esc(sk) + '" ' +
                    'title="Merge these plates into one food you can reuse">' +
                    'Keep as one</button>' : '') +
                /* Still .mslot-add: it is still the meal's add button, which
                   is what that name has always meant. Only where it sits
                   changed. */
                '<button class="mslot-act add mslot-add" data-mslot="' + esc(sk) + '" ' +
                  'aria-label="Add food to ' + esc(name) + '">&#43;</button>' +
                '</div>'
              : '') +
            /* INSIDE the fold, and last. It was outside the card on the
               reasoning that a folded meal should still be able to say what
               its miss did — which was wrong about what folding means. Blake,
               on his own day: "the overage tag is still seen even after I
               closed the meal tag". Shutting a meal is how you say you are
               done with it, and the line is a question about that meal; a
               question that outlives being dismissed is a nag. The pills
               carry the answer afterwards, and they are on the header, which
               a folded card keeps. */
            (onPlan ? mCascadeLineHTML(sk, targets, slots) : '') +
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
    /* Contents only — the region itself must outlive the redraw or it
       announces nothing. */
    $('macroLimits').innerHTML = readout.limits;
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
    var vk = mViewKey();
    /* A SKIPPED meal assumes nothing, and is not in the denominator either.
     *
       This counted every meal with no food on it as one still to come, which
       is exactly what a skipped meal is not: skipping says the food is not
       coming and hands the share to the rest, which is the whole point of the
       gesture. So a day with four of six meals skipped had roughly half the
       day's target quietly added to the delta — Blake's Monday read
       "1802 / 1745" beside "+930", the bar and the number on the same row
       disagreeing by 873 kcal of food he had already said he was not eating.
       Fibre and sodium were right throughout, because they are a different
       code path and never asked about assumptions.
     *
       The rule is copied from mMealShare on purpose, down to the clause about
       a skipped meal that somehow has food on it. Two definitions of a share
       is how this file has been bitten before; the comment there says a share
       still dividing by a skipped meal calls a breakfast "over" when Fill had
       deliberately made it bigger. This is the same error one level up. */
    var counts = function (s) {
      return !(mSkipped(vk, s.k) && !(day[s.k] || []).length);
    };
    slots.list.forEach(function (s) { if (counts(s)) sumW += mSlotW(s); });
    if (!sumW) return out;
    slots.list.forEach(function (s) {
      if (!counts(s)) return;
      if ((day[s.k] || []).length) return;
      /* What the meal's own pill is asking for, not its share of the plan
         as written. After a breakfast of 1,360 the empty meals are asked for
         640 between them, and the headline added up their ORIGINAL shares
         instead — "+916" over the day, painted as under, above three meals
         whose asks landed it on target. One forecast, the meals' own. */
      var ask = mMealAsk(s.k, targets, slots);
      if (ask && ask.now) {
        ['p', 'f', 'c'].forEach(function (m) { out[m] += ask.now[m] || 0; });
        return;
      }
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
  /* What a meal was meant to hold, and — while it is still empty — an
     invitation to fill it.
   *
     Once there is food on it the header says nothing: the macro pills on the
     row below carry the verdict now, per macro, which is the thing this pill
     could never do. It answered calories, so a lunch five times over on fat
     and fine on protein read as one number with no name on it.

     Over the meals that are actually happening. A skipped meal releases its
     share to the rest — that is what the skip DOES — so a share still
     dividing by it would call a breakfast "over" when Fill had deliberately
     made it bigger.

     But only while it is still EMPTY. A skip releases a share; food on the
     meal takes it back, and a divisor that dropped a meal WITH FOOD ON IT
     while that same meal was still paid its own share gave the day away
     twice — 128 per cent of it on the default weights, every card able to
     read "on". mEditDay un-skips on the way in, so the two can only disagree
     when a skip arrives from the other device after the food did. This is the
     arithmetic refusing to hand out more than a day even then. */
  /* One gauge: what is on the plate, against a tick where the plan is.
   *
     A meal was judged here once before, by chips and by bars, and both were
     taken off on the grounds that you steer by the DAY. They are back at
     Blake's asking, and the thing that killed them the first time was not
     the idea — it was that "the meal's share" had two definitions that
     disagreed, so a panel could invite food its own footer called a bust.
     There is one definition now, mMealShare, and every gauge on this screen
     reads it. If a second one ever appears, this is the comment that was
     supposed to stop it.

     The BAND is measured against the day, not against the share, and that is
     also hard-won: a meal's share of fat is eleven to nineteen grams, no real
     dish lands within three of that, and a bar judged against its own share
     was coloured on every meal of every day. Colour that is always on has
     stopped saying anything. The band asks the only question worth asking —
     did this meal miss by enough to move the DAY.

     The tick is drawn at the share and the track is scaled so it has somewhere
     to sit: fifteen per cent of headroom past the plan when the plate is
     under it, and the plate's own size when it has run past. So a bar that
     has blown through the tick still shows HOW far through, which a bar
     pinned at its own maximum cannot. */
  function mGauge(got, want, dayT) {
    if (!(want > 0)) return null;
    /* The day-relative floor stops tiny shares going always-red; the cap
       stops the colour contradicting the length.
     *
       Floor alone gave a protein bar filled to 55% of its track, with the
       tick at 87%, painted GREEN — because a fifteen gram miss is only seven
       per cent of the day and the band forgave it. Both facts were true and
       the bar said them at once: short means "not there", green means
       "there". A reader cannot hold that.

       So the band may not exceed 40% of the meal's own share. Below roughly
       three fifths of the tick a bar is ochre whatever the day thinks, which
       is exactly where it stops LOOKING landed. */
    var band = Math.min(Math.max(want * 0.15, (dayT || want) * 0.1), want * 0.4);
    var scale = Math.max(got, want * 1.15);
    return {
      fill: scale > 0 ? Math.min(100, (got / scale) * 100) : 0,
      tick: scale > 0 ? Math.min(100, (want / scale) * 100) : 0,
      st: got < want - band ? 'u' : got > want + band ? 'x' : 'o',
    };
  }

  /* The four, in the order they are said everywhere else, with the mark each
     is known by. Calories keep the FLAME \u2014 Blake's call, and the older
     comment's argument too: P, F and C are the three things food is made of
     and the flame is what the three add up to, so a fourth letter would make
     the sum look like a fourth component. It was briefly a word here, on the
     grounds that three altitudes ought to read as one sentence \u2014 but what
     makes them one sentence is four cells in one order wearing one set of
     colours, and a mark saying "this one is not like those three" is
     information rather than noise.

     The SPOKEN form stays the word: MGAUGE_SAY feeds the head's label, so a
     screen reader hears "983 of 290 calories" and never a glyph's name. */
  var MGAUGE = [['kcal', '\uD83D\uDD25'], ['p', 'P'], ['f', 'F'], ['c', 'C']];
  var MGAUGE_SAY = { kcal: 'calories', p: 'grams of protein', f: 'grams of fat', c: 'grams of carbohydrate' };

  /* A pill that is its own bar. Two rows of them draw this now — the day's
     folded readout and the picker's "still wants" — and a gradient written
     out twice is a gradient that drifts. */
  function mFillPill(cls, tone, pct, body) {
    return '<span class="' + cls + '" style="background:linear-gradient(90deg,' +
      tone + ' 0 ' + pct.toFixed(1) + '%,var(--paper-soft) ' + pct.toFixed(1) + '%)">' +
      body + '</span>';
  }
  var MPILL_TONE = { under: 'var(--dial-under-pale)', on: 'var(--dial-on-pale)',
    over: 'var(--dial-over-pale)', short: 'var(--dial-under-pale)',
    met: 'var(--dial-on-pale)', quiet: 'var(--mlim-quiet-pale)',
    near: 'var(--dial-under-pale)', past: 'var(--dial-over-pale)' };

  /* The four of them, on the meal's own header row.
   *
     Calories carries a gauge like the other three rather than sitting beside
     them as a bare number: three bars with a stray digit in front read as a
     number that had nowhere else to go. The figure sits ABOVE its own track,
     which is also the only way four of these fit on a 390 px row.

     Planned but not eaten draws faded — a full-looking dinner at eleven in
     the morning otherwise reads as food you have already had. */
  /* The meal's four numbers, as pills that fill toward that meal's target.
   *
     These replace the ticked gauges. The gauges were the right answer to
     "how far along is this" and a poor one to "how far along toward WHAT" —
     the tick marked the target but never named it, so the number it was
     marking lived only in the bar's geometry. A pill says 128/217 outright
     and fills behind it, which is the day row's own construction said about
     one meal. One vocabulary on the screen instead of two.

     The colour rule is the gauges' and is unchanged, because it was the part
     that was hard-won: the band is measured against the DAY, not the meal's
     share, or a meal's eleven-to-nineteen grams of fat colours every card
     every day and colour that is always on has stopped saying anything. */
  /* `empty` is a meal with nothing on it, and it changes which number the
     pill prints.
   *
     The target used to live in the LENGTH of the rail, which works while
     there is food on the meal and says nothing at all when there is not: an
     empty meal's fill is nought, so the rail is blank and the only figure
     left standing is the 0. Blake, looking at a breakfast reading 0/0/0/0:
     "I can't see what my target macros are from the main screen." The figure
     existed the whole time — in data-want, and spoken to a screen reader as
     "0 of 51 protein" — which is every audience but the one holding the
     phone.

     So an empty meal prints what it is FOR instead of printing nought four
     times. Nothing else moves: same pill, same width, same rail, same row.
     The moment food lands the number becomes what is on the plate and the
     colour wakes up, which is also the moment the rail starts saying
     something. */
  function mMealPillsHTML(sub, ask, targets, planned, empty) {
    if (!ask) return '';
    var sh = ask.now || ask;                 // plain shares still work
    var spent = ask.spent || {};
    var day = { kcal: kcalOf(targets), p: targets.p, f: targets.f, c: targets.c };
    var out = MGAUGE.map(function (g) {
      var m = g[0], want = sh[m] || 0, got = sub[m] || 0;
      /* Nothing left of this macro, and the day has begun: say it in a word.
         A meal asked for 0 and holding 0 is not "on target", it is a meal the
         day can no longer pay for, and 0/0 says the first of those. */
      if (spent[m]) {
        /* No track, because there is no target left to be a proportion OF —
           an empty rail under an em dash would be a bar drawn against zero.
           The dashed cell says it instead, the way it always has. */
        return '<span class="mmp spent' + (m === 'kcal' ? ' kc' : '') + '">' +
          '<span class="mmp-n"><span class="mmp-v">' +
          (got > 0 ? Math.round(got) : '&mdash;') + '</span>' +
          '<i class="mb-' + m + '">' + g[1] + '</i></span></span>';
      }
      var gg = mGauge(got, want, day[m]);
      if (!gg) return '';
      /* The fill is proportion of the TARGET and stops at the track's end;
         the state class says which side of the band it landed. Painted here
         rather than by a class because the proportion is the data. */
      var pct = want > 0 ? Math.min(100, (got / want) * 100) : 0;
      /* The old plan used to be kept beside the number that replaced it, so
         the card could answer "was that me, or did the day move". Blake, on
         his own day: "those little numbers under the pills? I don't know what
         they mean. Let's just get rid of them."
       *
         Fair, and the reasoning was thin. A second figure under a pill is
         only legible if you already know the first one moved, which is the
         thing it was there to tell you — and it cost the pills their one
         width, since a pill grown to hold one came out 75.4 px against an
         unmoved 59. The cascade line above the meals says what moved, in
         words, at the moment it moves. That is the place for it. */
      /* A meal asked for as much, or as little, as a meal can be asked for.
         Only the calorie pill carries it, because the cap is a calorie cap —
         and only when it BINDS, which on an ordinary day is never. It is the
         one mark that says the number beside it is not the arithmetic's
         answer but the limit the arithmetic ran into. */
      var capMark = (ask.capped && m === 'kcal') ? ' mmp-cap' : '';
      /* The target stops being a printed figure and becomes the length of the
         track under the number.
       *
         It was 7.5px at 55% opacity — the smallest type in the app, three
         sizes below anything near it — so a pill said a number and a mood and
         the comparison, which is the pill's entire job, was not legible at
         arm's length. That is the same complaint that killed the figures
         UNDER the pills a few commits ago ("I don't know what they mean"),
         and it applies with more force to the one that mattered.
       *
         The proportion was already being computed — it painted the pill's
         gradient — so nothing is lost by drawing it as a bar instead of
         hiding it behind a fill: the same number, at a size an eye can use,
         and the value beside it climbs from 9.5px to 12. Over target fills
         the track whole and darkens its ground, because a bar pinned at its
         own maximum cannot say how far past it went and the ground can.
       *
         The figure is not gone from the app, only from the glyph: it is in
         the head's own aria-label, said in words, which is the first time
         this strip has been readable to a screen reader at all. */
      /* data-want is the target, kept as a number on the element that draws
         it. Not scaffolding: the figure left the glyph and the only other
         place it survives is a sentence in the head's label, and prose is the
         wrong thing for anything but a reader to parse — reword the sentence
         and every check of it breaks for no reason. This is the machine half
         of the same fact, taken from the same `want`, and the suite asserts
         the two agree so they cannot drift apart in silence. */
      /* An empty meal prints its target where a fed one prints its plate.
         Both are the same fact said from different ends, and the strip's own
         `empty` class is what tells a reader which end this is. */
      return '<span class="mmp' + (m === 'kcal' ? ' kc' : '') + capMark + ' ' + gg.st +
        '" data-want="' + Math.round(want) + '">' +
        '<span class="mmp-n"><span class="mmp-v">' +
          Math.round(empty ? want : got) + '</span>' +
          '<i class="mb-' + m + '">' + g[1] + '</i></span>' +
        '<span class="mmp-tr"><i style="width:' + pct.toFixed(1) + '%"></i></span>' +
        '</span>';
    }).join('');
    /* Still aria-hidden, and now honestly so: every figure on this strip is
       said in words in the head's own label, so a reader that announced both
       would hear the meal twice. See mMealPillsSay. */
    return out ? '<span class="mmps' + (empty ? ' mmps-blank' : planned ? ' planned' : '') +
      '" aria-hidden="true">' + out + '</span>' : '';
  }

  /* The same four numbers, in words, for the label of whatever carries them.
   *
     The strip has been aria-hidden since it was built and nothing ever said
     the numbers instead, so a screen reader got "Open Breakfast" and not one
     figure off the card — and the head is a <button>, whose accessible name
     comes from its own label and overrides anything inside it, so no amount
     of marking up the pills could have fixed that from within. The target
     figure that came off the glyph lands here, where it is finally said at a
     size that has nothing to do with pixels. */
  function mMealPillsSay(sub, ask, targets) {
    if (!ask) return '';
    var sh = ask.now || ask;
    var spent = ask.spent || {};
    var day = { kcal: kcalOf(targets), p: targets.p, f: targets.f, c: targets.c };
    var parts = [];
    MGAUGE.forEach(function (g) {
      var m = g[0], want = sh[m] || 0, got = Math.round(sub[m] || 0);
      if (spent[m]) { parts.push(got + ' ' + MGAUGE_SAY[m] + ', none left to spend'); return; }
      if (!mGauge(sub[m] || 0, want, day[m])) return;
      parts.push(got + ' of ' + Math.round(want) + ' ' + MGAUGE_SAY[m]);
    });
    return parts.join(', ');
  }

  /* The order a shrinking day gives way in, and what a gram of each costs.
     Protein last to go because a deficit is when muscle is easiest to lose;
     carbohydrate first because it was the remainder when the plan was built. */
  var MDRAW = [['p', 4], ['f', 9], ['c', 4]];

  /* Is this meal finished? Plates on it, and every one of them eaten.
   *
     A meal with nothing on it is not finished, it is empty — and an empty
     meal is the one most in need of a share. */
  function mMealDone(sk) {
    var items = (mDay(mViewKey())[sk] || []).filter(function (it) { return BY_ID[it.id]; });
    if (!items.length) return false;
    return items.every(function (it) { return it.eaten; });
  }

  /* What a meal is being asked for NOW, and what it was planned for.
   *
     The two are the same until something is eaten. After that they part, and
     the gap between them is the whole answer to "where did the slack go":
     eat a breakfast a thousand over and the meals still ahead are asked for
     less; leave half of it and they are asked for more.
   *
     The arithmetic is the plain one. What is LEFT is the day's targets less
     what has actually been EATEN — not less what is merely plated, because a
     dinner you have not had yet is a plan, not a fact, and a plan cannot use
     up a day. What is left is then split across the meals still to come, by
     the same weights the plan uses, so the split is the plan's own rule
     applied to a smaller day.
   *
     A finished meal keeps its PLAN as its denominator. It is history: "1,425
     against a 387 plan" is the sentence you want tomorrow, and a finished
     meal that quietly re-scored itself against the day it left behind would
     be rewriting what happened.
   *
     `spent` is the honest part. Overrun the day's carbs and every meal still
     to come is owed nought of them — and three meals printing 0/0 is true and
     useless. The pill says so in a word instead. */
  function mMealAsk(sk, targets, slots, adjust) {
    var plan = mMealShare(sk, targets, slots);
    if (!plan) return null;
    var done = mMealDone(sk);
    /* Behind you, so its share is the plain one — see the note on `past`. */
    if (done) {
      var was = mMealShare(sk, targets, slots, true) || plan;
      return { now: was, plan: was, done: true, spent: {} };
    }

    var vk = mViewKey(), day = mDay(vk);
    var eaten = mTotals(day).eaten;
    /* Only what FINISHED meals ate comes off the day before it is shared out.
       A plate ticked on a meal still open is that meal's own food: it is
       already in what the meal holds, which is what its ask is compared to.
       Taken off the day as well, it was counted twice — a dinner sitting
       exactly on its share went red the moment one of its two plates was
       ticked, back to green when the other was, and every other meal's ask
       shrank by a plate that was never theirs. */
    eaten = { kcal: eaten.kcal, p: eaten.p, f: eaten.f, c: eaten.c };
    slots.list.forEach(function (s0) {
      if (mMealDone(s0.k)) return;
      (day[s0.k] || []).forEach(function (it) {
        var r0 = BY_ID[it.id];
        if (!it.eaten || !r0 || !r0.macro) return;
        ['kcal', 'p', 'f', 'c'].forEach(function (m0) {
          eaten[m0] -= (r0.macro[m0] || 0) * it.x;
        });
      });
    });
    /* `adjust`, when given, is added to what has been eaten before anything
       is drawn from it. It exists for one caller: the cascade card asks what
       each open meal would be asked for had the meal that just finished
       landed exactly on its share, and the difference between that answer
       and the real one is what that meal's miss did — and nothing else. */
    if (adjust) {
      eaten = { kcal: eaten.kcal + (adjust.kcal || 0), p: eaten.p + (adjust.p || 0),
        f: eaten.f + (adjust.f || 0), c: eaten.c + (adjust.c || 0) };
    }
    /* One budget, spent in the order the plan was built in.
     *
       Taken macro by macro this produced a card that contradicted itself: a
       breakfast a thousand over left 315 calories in the day and 114 g of
       protein untouched, so lunch was asked for 41 g of protein and 17 g of
       fat inside a 113 kcal budget — three hundred kcal of food in a third of
       that. The overrun was real but it was CARBS, and flooring each macro at
       nought threw that away while the calorie line still counted it.
     *
       So the calories left are the budget, and the macros are drawn from it
       in turn: protein, then fat, then whatever is still there for carbs.
       That is the order mPlanCalc builds the plan in — protein off bodyweight,
       fat to its floor, carbohydrate the remainder — so a day that has to
       shrink gives way in the reverse order it was built, and carbohydrate,
       which was the remainder, is the remainder still.
     *
       It costs nothing on a day going to plan: with nothing eaten the three
       draws come to exactly the targets, because that is how the targets were
       computed. It only bites once the day is short, which is the only time
       anybody needs to be told what to protect. */
    var budget = Math.max(0, kcalOf(targets) - eaten.kcal);
    var room = { p: Math.max(0, targets.p - eaten.p),
      f: Math.max(0, targets.f - eaten.f),
      c: Math.max(0, targets.c - eaten.c) };
    var left = {};
    MDRAW.forEach(function (d2) {
      var m = d2[0], per = d2[1];
      var take = Math.min(room[m], budget / per);
      left[m] = take;
      budget -= take * per;
    });
    /* Derived, so the calorie line and the three macro lines are the same
       statement said two ways rather than two statements that can disagree. */
    left.kcal = 4 * left.p + 4 * left.c + 9 * left.f;

    /* The meals the slack has to go to: everything not skipped and not
       finished. This one is always among them — it is the meal being asked
       about, and a meal cannot be asked for nothing on the grounds that it
       does not exist. */
    var open = [], me = null;
    slots.list.forEach(function (s2) {
      if (s2.k === sk) { me = s2; open.push(s2); return; }
      if (mSkipped(vk, s2.k) && !(day[s2.k] || []).length) return;
      if (mMealDone(s2.k)) return;
      open.push(s2);
    });
    if (!me) return { now: plan, plan: plan, done: false, spent: {} };

    var share = mPlaceLeft(left, open, targets, slots);
    var frac = share.w[sk];
    if (frac === undefined) frac = 1;

    var now = {}, spent = {};
    ['kcal', 'p', 'f', 'c'].forEach(function (m) {
      now[m] = left[m] * frac;
      /* Nothing left to give, and the day has actually started — an untouched
         day has nothing eaten and is not "spent", it is just beginning. */
      spent[m] = left[m] <= 0 && eaten.kcal > 0;
    });
    return { now: now, plan: plan, done: false, spent: spent,
      capped: !!share.capped[sk], unplaced: share.unplaced };
  }

  /* A meal is never asked for less than a third of its plan nor more than
     double it. Below the floor it has stopped being a meal; above the ceiling
     the app is asking you to eat a dinner and calling it a snack — which is
     what happens without one the moment the only thing left is snacks. */
  var MFLOOR = 0.35, MCEIL = 2;

  /* How what is LEFT divides across the meals that are left.
   *
     Worked in fractions of `left` rather than in calories, and that is the
     load-bearing choice: every meal's four figures are then `left` times one
     number, so the macros a meal is asked for always add up to the macros the
     day has left, and the protein-first waterfall above survives intact. Hand
     out calories and then reconstruct macros from them and the two drift —
     which is the same two-answers-to-one-question this app keeps being bitten
     by, in a new place.

     The default is by size, never evenly. Dinner is the biggest meal, so it
     takes the biggest share of a surplus and gives up the most of a debt, and
     every meal moves by the same PROPORTION. Split evenly, 260 spare calories
     make a snack 41% bigger and a dinner 18% bigger, and the day stops looking
     like the day that was planned. */
  function mPlaceLeft(left, open, targets, slots) {
    var w = {}, capped = {}, lo = {}, hi = {}, plan = {};
    var vk = mViewKey();
    var sent = mSendOf(vk) || { to: [], off: false };
    var K = left.kcal;
    if (!(K > 0)) {
      /* Nothing left to divide. Everyone asks for nothing rather than for a
         share of a negative number, which would read as the day owing food. */
      open.forEach(function (s) { w[s.k] = 0; });
      return { w: w, capped: capped, unplaced: 0 };
    }
    open.forEach(function (s) {
      var pl = mMealShare(s.k, targets, slots);
      plan[s.k] = pl ? pl.kcal : 0;
      w[s.k] = plan[s.k] / K;                    // what following the plan costs
      lo[s.k] = (plan[s.k] * MFLOOR) / K;
      hi[s.k] = (plan[s.k] * MCEIL) / K;
    });
    /* Positive: the meals before this one came in light and there is more to
       go round than the plan claims. Negative: they ran over and the rest of
       the day has to give some back. */
    var rest = 1 - open.reduce(function (a, s) { return a + w[s.k]; }, 0);

    function give(keys, amount, byWeight) {
      var pass = 0;
      while (Math.abs(amount) > 1e-6 && pass < 8) {
        var able = keys.filter(function (k) {
          return amount > 0 ? w[k] < hi[k] - 1e-9 : w[k] > lo[k] + 1e-9;
        });
        if (!able.length) break;
        var sum = able.reduce(function (a, k) {
          return a + (byWeight ? mSlotW(mSlotOf(slots, k)) : 1);
        }, 0);
        if (!sum) break;
        var moved = 0;
        able.forEach(function (k) {
          var want = amount * ((byWeight ? mSlotW(mSlotOf(slots, k)) : 1) / sum);
          var room = amount > 0 ? hi[k] - w[k] : lo[k] - w[k];
          var take = amount > 0 ? Math.min(want, room) : Math.max(want, room);
          w[k] += take;
          moved += take;
          if (Math.abs(w[k] - (amount > 0 ? hi[k] : lo[k])) < 1e-9) capped[k] = 1;
        });
        amount -= moved;
        if (Math.abs(moved) < 1e-9) break;
        pass++;
      }
      return amount;
    }

    var keys = open.map(function (s) { return s.k; });
    /* The meals you ticked are the whole set, and they share by size.
     *
       Two things changed here when the card became a list of checkboxes.
       It used to walk the tapped meals IN THE ORDER TAPPED, each absorbing
       all it could before the next was asked, and then hand whatever was
       left to the meals you had NOT tapped. Both of those make a tick mean
       "first in the queue" rather than "this one" — untick a meal and it
       could still end up paying, which is the one thing a cleared checkbox
       must not do. A set is unordered and a set is exhaustive.

       What is left over when the ticked meals hit their floors is not
       quietly pushed somewhere else now: it stays unplaced, and the card
       says the day ends that far off. That is the answer Blake asked this
       card for — "let me know what's going to happen" — and it can only be
       given honestly if the overflow is allowed to exist. */
    var picked = sent.to.filter(function (k) { return keys.indexOf(k) >= 0; });
    if (picked.length) rest = give(picked, rest, true);
    else if (!sent.off) rest = give(keys, rest, true);
    return { w: w, capped: capped, unplaced: rest * K };
  }

  function mSlotOf(slots, k) {
    var out = null;
    slots.list.forEach(function (s) { if (s.k === k) out = s; });
    return out || { k: k };
  }

  /* Big enough that the meals after it visibly change size. Under this the day
     still moves — it always has — it just does it without saying so, which is
     what most days are. Raise it if the line starts reading as nagging; it is
     one number and it is not a setting, deliberately. */
  var MCASCADE_MIN = 150;

  /* The meal the line is about: the last one finished or skipped that still
     has meals after it.
   *
     DERIVED, not recorded. Nothing has to hook the eaten toggle, the whole-meal
     dot, the skip button and every other road to "this meal is over" — and
     nothing can be missed when a new road is added. It also gives the clearing
     rule away for free: finish lunch and lunch becomes the last finished meal,
     so breakfast's line stops being drawn without anything having to remember
     to remove it. Four buttons parked under breakfast at nine at night was the
     alternative. */
  function mLastFinished(targets, slots) {
    var vk = mViewKey(), day = mDay(vk), out = null, openAfter = false;
    for (var i = slots.list.length - 1; i >= 0; i--) {
      var s = slots.list[i];
      var items = (day[s.k] || []).filter(function (it) { return BY_ID[it.id]; });
      var skipped = mSkipped(vk, s.k) && !items.length;
      var done = mMealDone(s.k);
      if (!done && !skipped) { openAfter = true; continue; }
      if (!openAfter) continue;          // nothing left after it to share with
      /* The plain share, for the same reason: this meal is finished or
         skipped, and its miss is measured against what the day actually
         asked it for rather than against a figure a later skip inflated. */
      var plan = mMealShare(s.k, targets, slots, true);
      if (!plan) continue;
      var got = { kcal: 0, p: 0, f: 0, c: 0 };
      items.forEach(function (it) {
        var r = BY_ID[it.id];
        if (!r || !r.macro) return;
        ['kcal', 'p', 'f', 'c'].forEach(function (m) { got[m] += (r.macro[m] || 0) * it.x; });
      });
      out = { k: s.k, name: s.n, skipped: skipped, got: got, plan: plan,
        miss: got.kcal - plan.kcal };
      break;
    }
    return out;
  }

  /* One line, under the meal it is about, saying what already happened and
     offering to do it differently. It reports rather than asks: the share has
     landed by the time you read this, so ignoring the line entirely still
     leaves the day right and nothing sits half-updated waiting on an answer. */
  function mCascadeLineHTML(sk, targets, slots) {
    var ev = mLastFinished(targets, slots);
    if (!ev || ev.k !== sk) return '';
    if (Math.abs(ev.miss) < MCASCADE_MIN) return '';
    var vk = mViewKey(), day = mDay(vk);
    var sent = mSendOf(vk);
    if (sent && sent.f !== sk) sent = null;         // the question has moved on
    var to = sent ? sent.to : [], off = !!(sent && sent.off);
    var shut = !!(sent && sent.ack);
    var over = ev.miss > 0;
    var amt = Math.abs(Math.round(ev.miss));

    var open = [];
    slots.list.forEach(function (s2) {
      if (mMealDone(s2.k)) return;
      if (mSkipped(vk, s2.k) && !(day[s2.k] || []).length) return;
      open.push(s2);
    });
    if (!open.length) return '';

    /* Every open meal's own share and what it is being asked for now. The
       difference is what this miss did to it, and it is read off mMealAsk
       rather than worked out again here — the card and the meal's own pills
       have to agree about the same meal, and the only way to guarantee that
       is to read the same function. */
    var rows = [], floored = [], un = 0;
    /* `was` is each meal's ask had this meal landed on its share; `now` is
       its ask as things stand. The difference is what THIS miss did to it.
     *
       It used to show the meal's plan share against its current ask, which
       folds in every meal finished so far — so under a heading that said
       "Lunch went 216 under", the rows summed to 850, and a wake-up and a
       breakfast that had run over were doing most of the moving. Blake, with
       the screenshots: "the macro is shifting after I click Complete". The
       rows were true and the heading was about something else. The note on
       `un` below records the same confusion caught once already, for the
       landing line; this is the rows catching up. */
    var undo = { kcal: ev.plan.kcal - ev.got.kcal, p: ev.plan.p - ev.got.p,
      f: ev.plan.f - ev.got.f, c: ev.plan.c - ev.got.c };
    open.forEach(function (s2) {
      var a = mMealAsk(s2.k, targets, slots);
      if (!a || !a.plan) return;
      var before = mMealAsk(s2.k, targets, slots, undo);
      var was = Math.round(((before && before.now) || a.plan).kcal);
      var now = Math.round((a.now || a.plan).kcal);
      var on = off ? false : (to.length ? to.indexOf(s2.k) >= 0 : true);
      if (on && a.capped) floored.push(s2.n);
      /* One number for the whole day's remainder, so every open meal's ask
         carries the same copy of it. Read rather than reconstructed: the
         first version of this line worked the landing out as "the miss minus
         what the rows gave up", which are two different quantities — the
         miss is measured against LUNCH'S share and the rows against their
         own — and it confidently reported a day 463 over that was not. */
      if (typeof a.unplaced === 'number') un = Math.round(a.unplaced);
      rows.push({ k: s2.k, n: s2.n, was: was, now: now, d: was - now, on: on, cap: !!a.capped });
    });
    if (!rows.length) return '';

    /* Where the day lands, in the same sentence in every state. Negative
       means the meals left cannot give back enough and the day runs over;
       positive means they cannot absorb it all and the day comes in short. */
    var lands = un < -0.5 ? 'The day ends <b>' + Math.abs(un) + ' over</b>.'
      : un > 0.5 ? 'The day ends <b>' + un + ' short</b>.'
      : 'The day still <b>lands on plan</b>.';

    /* Where the day LANDS. The old card ended on what it had done —
       "Borrowed from Evening Snack and Dinner" — which is the app's own
       bookkeeping, in the app's vocabulary, leaving the reader to work out
       what it meant for them. Blake: "I kind of want something that will let
       me know what's going to happen now that I've overeaten."
     *
       A meal never drops below a third of its share nor grows past twice it,
       so a big miss frequently cannot be absorbed at all — and the line that
       matters is the one saying so. Ending on "borrowed from" implied the
       books were square when they were hundreds of calories from it. */
    var said = off
      ? (over ? '<b>No meal shrinks.</b> ' : '<b>No meal grows.</b> ') + lands
      : lands + (floored.length
        ? ' ' + floored.join(' and ') + (floored.length > 1 ? ' are' : ' is') +
          ' at the ' + (over ? 'floor' : 'ceiling') + ' — ticking more places no more.'
        : '');

    var head = ev.skipped
      ? 'Skipping ' + esc(ev.name) + ' frees ' + amt
      : esc(ev.name) + ' went ' + amt + (over ? ' over its share' : ' under its share');

    var shell = function (inner, ariaShut) {
      return '<div class="mcasc' + (over ? ' over' : '') + (shut ? ' shut' : '') +
        '" role="status">' +
        '<span class="mcasc-i" aria-hidden="true">' + (over ? '&#8599;' : '&#8600;') + '</span>' +
        '<span class="mcasc-b">' + inner + '</span></div>';
    };

    /* Answered, so it gets out of the way. The day was already right before
       any of this was read — the share lands on render — so once you have
       looked at it the card has no further business taking a third of the
       screen. The line stays, because what happened to the day is worth
       being able to see; the apparatus for changing it does not. */
    if (shut) {
      return shell(
        '<button class="mcasc-fold" data-msend="open" aria-expanded="false">' +
          '<span class="mcasc-foldt">' +
            '<span class="mcasc-t">' + head + '</span>' +
            '<span class="mcasc-s">' + said + '</span>' +
          '</span>' +
          '<span class="mcasc-cue" aria-hidden="true">&#8964;</span>' +
        '</button>');
    }

    /* A list you choose several from, drawn as one. Each was a ghost button
       reading "Borrow from Dinner" that toggled when pressed a second time —
       a control that toggles ought to look like it toggles — and "Don't
       borrow" sat at the bottom in different words for what is plainly the
       None of this list. */
    var pick = rows.map(function (r) {
      return '<button class="mcasc-row" role="checkbox" data-msend="' + esc(r.k) + '"' +
        ' aria-checked="' + (r.on ? 'true' : 'false') + '">' +
        '<span class="mcasc-box" aria-hidden="true">&#10003;</span>' +
        '<span class="mcasc-nm">' + esc(r.n) +
          (r.on && r.cap
            ? '<span class="mcasc-cap">at its ' + (over ? 'floor' : 'ceiling') + '</span>'
            : '') +
        '</span>' +
        /* The price of ticking this one, on the row that does it. Choosing
           between consequences rather than between meal names. */
        '<span class="mcasc-was">' + r.was + ' &rarr; <i>' + r.now + '</i></span>' +
        /* The sign is the row's own. It was chosen by whether the finished
           meal went over, so a row moving down read "+49" whenever lunch had
           come in light. `d` is was - now: positive means this meal is being
           asked for less than it would have been, and that is a minus. */
        '<span class="mcasc-d">' + (r.on && r.d ? (r.d > 0 ? '&minus;' : '+') +
          Math.abs(r.d) : '&mdash;') + '</span>' +
      '</button>';
    }).join('');

    return shell(
      '<span class="mcasc-t">' + head + '</span>' +
      '<span class="mcasc-s">' + said + '</span>' +
      '<div class="mcasc-pick no-print">' +
        '<div class="mcasc-ph">' +
          '<span>' + (over ? 'Take it from' : 'Give it to') + '</span>' +
          '<span class="mcasc-pa">' +
            '<button data-msend="all">All</button>' +
            '<button data-msend="none" aria-pressed="' + (off ? 'true' : 'false') + '">None</button>' +
          '</span>' +
        '</div>' + pick +
        '<div class="mcasc-note">A meal never ' +
          (over ? 'drops below a third of its share' : 'grows past twice its share') +
          ', so there is a limit to what ' + (over ? 'an overshoot' : 'a surplus') +
          ' can be made to disappear into.</div>' +
        '<div class="mcasc-done">' +
          '<button class="btn-primary" data-msend="ack">Done</button>' +
        '</div>' +
      '</div>');
  }

  /* `past` asks for the share a meal BEHIND you had, which is its plain
     share of the day and nothing else.
   *
     A skipped meal's weight comes out of the denominator so that its food
     goes to the meals still ahead of you. That is right for those meals and
     wrong for every meal already eaten: skipping a lunch raised Wake Up's
     target from 248 to 310, hours after Wake Up was eaten and closed, and
     its bar then read 62 short of something the day never asked it for.
     Nothing moved — a done meal's ask is its own plan either way — but the
     figure beside it was a claim about the past that the past did not make.
     You cannot send freed calories backwards in time. */
  function mMealShare(sk, targets, slots, past) {
    var me = null, sumW = 0, vk = mViewKey(), day = mDay(vk);
    slots.list.forEach(function (s) {
      if (!past && s.k !== sk && mSkipped(vk, s.k) && !(day[s.k] || []).length) return;
      sumW += mSlotW(s);
      if (s.k === sk) me = s;
    });
    if (!me || !sumW) return null;
    var frac = mSlotW(me) / sumW;
    return { frac: frac, kcal: kcalOf(targets) * frac,
      p: targets.p * frac, f: targets.f * frac, c: targets.c * frac };
  }

  /* On it is a BAND, and the band is measured against the DAY.
   *
     The first version compared a meal to its own share, and lit almost every
     pill on an ordinary day — not because the day was bad but because a
     meal's share of fat is eleven to nineteen grams and no real dish lands
     within three of that. Colour that is on all the time has stopped saying
     anything.

     So the question is not "did this meal miss its share" — it always does —
     but "did it miss by enough to move the day". A tenth of the day's target,
     or fifteen per cent of the share, whichever is the more forgiving. Four
     grams of fat over at lunch goes quiet; fifty-three does not. */
  /* One band, one definition.
   *
     It was written down once as the colour's threshold and, in the bar that
     draws the same judgement, not at all — which is how a green fill came to
     stop a third of a track short of its own mark with nothing on screen
     explaining why. Anything that colours or draws a meal against its share
     comes through here.

     The half-gram floor is not decoration. Both terms are FRACTIONS of a
     target, so a day targeting zero of a macro has a band of no width at all
     and the smallest trace is "over" — and a zero target is not exotic, the
     carb cycle produces one every week: with six training days the rest-day
     factor 1 − 0.25·T/R goes negative and mDayTargets clamps that day's
     carbohydrate to nought. Four tenths of a gram of carbohydrate in a steak
     dinner was drawing a red chip reading "C −0". Half a gram is under the
     rounding of every number this band is ever compared against. */
  function mMacBand(share, dayT) {
    return Math.max(0.5, share * 0.15, (dayT || share) * 0.1);
  }

  function mMacState(got, share, dayT) {
    var d = got - share;
    if (Math.abs(d) <= mMacBand(share, dayT)) return 'on';
    return d > 0 ? 'over' : 'short';
  }

  /* The state NAME is the whole payload. A chip takes its colour from
     .msub-c.over / .msub-c.short in the stylesheet, so there is no tone map
     here — unlike the day's bars one level up, which fill to a proportion and
     so must carry their colour as an inline style (TONE, down in the footer).
     The pale-tone map that used to sit beside this belonged to the
     proportional meal pill the chips replaced and went out with it; the
     --dial-*-pale tokens it named are still live for those bars, so a later
     sweep for unused tokens should leave them alone. */

  /* At a glance: only what is wrong.
   *
     Three pills on every meal all day is colour that is always on, and colour
     that is always on has stopped saying anything. A meal that landed says
     nothing at all — the calorie figure beside it is always there, so silence
     can never be mistaken for "not worked out yet", and a good day looks the
     way the app looked before any of this existed. */

  /* Open, with a hand on the stepper: the whole picture, with a mark where the
     share sits so how far past is a distance rather than a subtraction.
   *
     Used in the picker too, measuring what the meal holds PLUS what the
     basket is about to add — against the same plan share the card behind the
     sheet uses, and the same one its balance button solves to. Left-over
     would invert the bar's meaning between two screens you move between in one
     gesture, and a meal already over its share has a negative remainder, which
     is three empty bars implying room that is not there. The gap between the
     bar and the mark is what is left.
   *
     The axis is the SHARE, and it is the same axis on all three rows.
     Normalising each row to max(got, want) drew EVERY over state at the same
     83.3%: 45 of 45, 64 of 45 and 225 of 45 were one identical bar and only
     the mark moved, so how far past was readable — backwards, and
     non-linearly — from the tick alone. It also gave P, F and C each its own
     top, which put the tick at three different places in one card and left
     the three fills with nothing to be read against. The row-filling pills
     this replaced could be read against each other, because they shared one
     width.
   *
     So the share sits at MBAR_MARK on every track, always, and the fill is
     what the meal holds measured in shares rather than in grams — grams
     cannot be the shared unit, since 150 of protein beside 60 of fat on one
     gram axis says nothing. Below the share the first two thirds are linear:
     half your protein is a half-length bar. Past it the last third carries
     the overshoot as 1 - want/got, the fraction of the plate that is excess,
     so double the share fills half of that third, triple two thirds, and no
     amount ever runs off the end. Past the mark is compressed on purpose:
     the question there is whether this is a little over or wildly over, and
     the grams beside the bar answer it exactly. */
  var MBAR_MARK = 66.7;

  /* A share of zero has no axis to sit on — anything at all is infinitely
     over it, and nothing is not — so both ends are drawn as the limit. The
     divisor this replaced carried a `|| 1` for the same reason; without one
     the width would be NaN and the bar would silently not draw. */
  function mBarPct(got, want) {
    if (!(want > 0)) return got > 0 ? 100 : 0;
    if (got <= want) return MBAR_MARK * (got / want);
    return MBAR_MARK + (100 - MBAR_MARK) * (1 - want / got);
  }

  function mMacBars(sub, sh, targets) {
    if (!sh) return '';
    return '<div class="msub-bars">' + ['p', 'f', 'c'].map(function (m) {
      var got = sub[m] || 0, want = sh[m] || 0;
      var dayT = (targets || {})[m];
      var st = mMacState(got, want, dayT);
      /* The band, drawn. The colour and the bar were answering the same
         question from two different definitions of "close enough": the state
         allowed a tenth of the DAY either way, the track knew only the
         meal's share, and the result was a green fill visibly a third short
         of its own mark with nothing to account for the gap. It is the same
         band either way now, and it is on the track — so a fill that stops
         inside the shaded zone reads as landed, and one that stops outside
         it reads as missed, without a number being consulted. */
      var band = mMacBand(want, dayT);
      var lo = mBarPct(Math.max(0, want - band), want);
      var hi = mBarPct(want + band, want);
      return '<div class="msub-br"><span class="msub-bk mb-' + m + '">' + m.toUpperCase() +
        '</span><span class="msub-bt">' +
          '<span class="msub-bz" style="left:' + lo.toFixed(1) + '%;width:' +
            Math.max(0, hi - lo).toFixed(1) + '%"></span>' +
          '<span class="msub-bb ' + st + '" style="width:' + mBarPct(got, want).toFixed(1) + '%"></span>' +
          '<span class="msub-bm" style="left:' + MBAR_MARK.toFixed(1) + '%"></span>' +
        '</span><span class="msub-bv"><b>' + Math.round(got) + '</b> / ' +
          Math.round(want) + ' g</span></div>';
    }).join('') + '</div>';
  }

  /* An empty meal, and what it is for.
   *
     It read "at its share &middot; 98". A share is how the solver divides the
     day's remainder between the meals you have not filled — an implementation
     detail wearing a chip, and the one thing on this screen Blake said was
     not intuitive. He is right: nobody should have to learn that word to read
     their own breakfast.

     The number was never the problem. It stays, with the flame the rest of
     the row uses, and the sentence goes. No gauges here — there is nothing on
     the plate to draw, and four empty tracks per meal is most of what you see
     first thing in the morning. */

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
  /* A moving range measures how far the process moves in ONE step. Pairing
     two readings a fortnight apart and calling the difference a moving range
     is a category error: it is a fortnight of drift wearing a day's clothes,
     and it goes straight into mR-bar, which widens every limit on the chart
     and makes the salt warning fire LESS often than it should.

     These arrays came in as bare numbers, so nothing here could see that two
     adjacent entries were two weeks apart. They carry their dates now.

     One missed morning still pairs — a two-day step is the same process seen
     a little later, and refusing it would throw away most of a real series.
     Beyond that the pair is dropped rather than stretched. */
  var MC_GAP = 2;

  function mcDaysApart(a, b) {
    if (!a || !b) return 1;
    return Math.round((keyDate(b) - keyDate(a)) / 86400000);
  }

  /* The ranges, each carrying the key it ends on — so a caller that PLOTS the
     ranges can label them without re-deriving which pairs survived. */
  function mcRangePairs(v, keys) {
    var o = [];
    for (var i = 1; i < v.length; i++) {
      if (keys && mcDaysApart(keys[i - 1], keys[i]) > MC_GAP) continue;
      o.push({ k: keys ? keys[i] : null, r: Math.abs(v[i] - v[i - 1]) });
    }
    return o;
  }
  function mcRanges(v, keys) {
    return mcRangePairs(v, keys).map(function (p) { return p.r; });
  }
  function mcLimits(v, keys) {
    if (v.length < 5) return null;
    var n = Math.min(21, v.length);
    var base = v.slice(0, n);
    var bkeys = keys ? keys.slice(0, n) : null;
    var ranges = mcRanges(base, bkeys);
    if (ranges.length < 4) return null;      // too little of it was consecutive
    var bar = mcMean(ranges), cl = mcMean(base);
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
      return { v: res, keys: keys, lim: mcLimits(res, keys), zero: true, dp: 1,
        note: 'Zero is on pace. Above the line is losing slower than you meant to.' };
    }
    if (which === 'jump') {
      if (vals.length < 6) return { need: 'Six mornings and this draws.' };
      /* The pairs, not a bare list: a pair that straddled a gap is dropped
         now, so the keys have to come from the same filter or every point
         after the first missed morning is labelled with the wrong date. */
      var pairs = mcRangePairs(vals, keys);
      if (pairs.length < 5) return { need: 'Six mornings close together and this draws.' };
      var mr = pairs.map(function (pp) { return pp.r; });
      var mkeys = pairs.map(function (pp) { return pp.k; });
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
      /* The day BEFORE the jump — found from the key the range ENDS on rather
         than from a parallel index, which only lined up while every pair
         survived. One dropped pair used to shift every salt flag after it by
         a day, quietly blaming the wrong dinner. */
      var salt = mkeys.map(function (k, i) {
        var at2 = keys.indexOf(k);
        return mr[i] > bar && at2 > 0 && mSodiumOn(keys[at2 - 1]) >= high;
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
    return { v: rate, keys: rkeys, lim: mcLimits(rate, rkeys), zero: true, dp: 1,
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
  /* "What do you actually eat" — the screen that gives the ranker something
     to go on before there is any history to read.
   *
     It is the favourite star, laid out as a grid. That is the whole trick:
     mRank already pays a favourite six points, favourites already travel to
     the other phone, and mCanFav already says any food may wear one — so a
     screen of taps improves every suggestion in the app the moment it is
     closed, with no new ranking anywhere. Blake asked for it as onboarding,
     "that way they get favorited early... and then they seed my food
     selector", and the cheapest true version of that is the star.
   *
     Chips rather than rows: you are scanning for names you recognise, not
     reading macros, and a shelf you can see all of at once is a shelf you
     answer in one look. Rows put six on a screen; this puts a category.
   *
     Truncated per shelf rather than scrolled forever, because the table runs
     past a hundred foods once the ones the storehouse does not stock are in
     it. What you have already chosen is always drawn, open or shut — a
     screen that hides your own answers is worse than a long one. */
  var MFP_SHOWN = 8;                   // chips before a shelf offers the rest

  function mFavPickShelves() {
    var by = {};
    MFOODS.forEach(function (r) {
      if (!r.food || !(r.eat || r.side)) return;
      if (String(r.id).indexOf('f:my:') === 0) return;   // your own foods are already yours
      var sh = mShelfKey(r) || 'protein';
      (by[sh] = by[sh] || []).push(r);
    });
    return by;
  }

  /* The shelves alone. Two screens draw them — the fifth step of the first
     run, and "Food I eat" in the gear menu ever after — and a second copy of
     a hundred-food grid is a second copy that drifts. */
  /* What the button that finishes this screen should say. It is the same
     sentence on the gear sheet and on the wizard's last step, and it has to
     be true in both: nothing chosen is a skip, and a skip is a real answer
     here rather than a failure to answer. */
  function mFavDoneLabel() {
    var n = 0;
    MFOODS.forEach(function (r) { if (r.food && mIsFav(r)) n++; });
    return n ? 'Done &middot; ' + n + ' chosen' : 'Skip for now';
  }

  /* The wizard's sheet is drawn once and left — the same bargain the editor
     strikes, and for the same reason: a redraw would throw away half-typed
     answers on four other steps and put you back on the first. So a tap here
     repaints what the tap changed and nothing else.
   *
     Without this the chip did not visibly move. The favourite was written —
     bsc.favs had it — and the screen said nothing, so the honest reading was
     that the tap had missed, and the next tap took it back off again. */
  function mFavChipSync(btn, r) {
    var on = mIsFav(r);
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    var shelf = btn.closest('.fp-shelf');
    if (shelf) {
      var tag = shelf.querySelector('.fp-shelf-h i');
      if (tag) {
        /* The total is whatever it already said — the chips in the document
           are only the ones this shelf has been asked to show. */
        var all = Number(String(tag.textContent).split(/\s+/).pop()) || 0;
        var chosen = shelf.querySelectorAll('.fp-chip.on').length;
        tag.textContent = chosen ? chosen + ' of ' + all : String(all);
      }
    }
    var done = document.querySelector('[data-mtw="done"]');
    if (done) done.innerHTML = mFavDoneLabel();
    /* Turning shopping on has to say so here too; the sheet's own copy of
       this line is written at render time and there is no render. */
    if (mExtOk() && !document.querySelector('.fp-note')) {
      var first = document.querySelector('.fp-shelf');
      if (first && first.parentNode) {
        var note = document.createElement('div');
        note.className = 'fp-note';
        note.textContent = 'You have picked food the storehouse does not carry, ' +
          'so Fill may now shop outside it.';
        first.parentNode.insertBefore(note, first);
      }
    }
  }

  function mFavPickBodyHTML() {
    return mFavPickInner().blocks;
  }

  function mFavPickInner() {
    var by = mFavPickShelves(), total = 0;
    var blocks = MSHELF.map(function (sh) {
      /* What the storehouse carries first, then the rest, then alphabetical.
         Straight A-Z opened Protein on calamari, catfish and clams — eight
         chips of the most obscure things in the table, with chicken and eggs
         below the fold. The order has to put the likely answer in the part
         you can see. */
      var list = (by[sh[0]] || []).sort(function (a, b) {
        return ((a.ext ? 1 : 0) - (b.ext ? 1 : 0)) ||
          String(a.name).localeCompare(String(b.name));
      });
      if (!list.length) return '';
      var on = [], off = [];
      list.forEach(function (r) { (mIsFav(r) ? on : off).push(r); });
      total += on.length;
      /* Chosen first and always drawn; the rest up to the cap, and the cap
         lifts for this shelf alone once it is asked to. */
      var open = S.fpOpen && S.fpOpen[sh[0]];
      var room = Math.max(0, MFP_SHOWN - on.length);
      var rest = open ? off : off.slice(0, room);
      var hidden = off.length - rest.length;
      var chip = function (r) {
        return '<button class="fp-chip' + (mIsFav(r) ? ' on' : '') +
          (r.ext ? ' ext' : '') + '" data-fppick="' + esc(String(r.id)) +
          '" aria-pressed="' + (mIsFav(r) ? 'true' : 'false') + '">' +
          esc(r.name) + '</button>';
      };
      return '<div class="fp-shelf">' +
        '<div class="fp-shelf-h"><span class="fp-emo" aria-hidden="true">' + sh[1] +
          '</span>' + esc(sh[2]) + '<i>' +
          (on.length ? on.length + ' of ' + list.length : String(list.length)) +
          '</i></div>' +
        '<div class="fp-chips">' + on.map(chip).join('') + rest.map(chip).join('') +
          (hidden > 0
            ? '<button class="fp-more" data-fpmore="' + esc(sh[0]) + '">+ ' +
              hidden + ' more</button>'
            : (open && off.length > MFP_SHOWN
              ? '<button class="fp-more" data-fpmore="' + esc(sh[0]) + '">Fewer</button>'
              : '')) +
        '</div></div>';
    }).join('');
    /* Said, not done quietly. Ticking a food the storehouse does not carry
       turns on Fill-may-shop, because a favourite that can never be drafted
       is a tap that did nothing — but the app changing what it drafts is not
       something to learn by noticing. */
    var shopping = mExtOk();
    return { blocks: (shopping
        ? '<div class="fp-note">You have picked food the storehouse does not ' +
          'carry, so Fill may now shop outside it.</div>' : '') + blocks,
      total: total };
  }

  function mFavPickHTML() {
    var inner = mFavPickInner();
    var total = inner.total;
    return '<div class="scrim no-print" data-close="1">' +
      '<div class="sheet mt-sheet" role="dialog" aria-modal="true" aria-label="What you eat">' +
        '<div class="sheet-top">' +
          '<div class="sheet-eyebrow">What do you actually eat?</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="mt-cap">Tap anything you eat regularly. Nourish leans toward ' +
          'these when it suggests food &mdash; it does not stop offering anything ' +
          'else. You can change your mind on any food, any time.</div>' +
        inner.blocks +
        (function () {
          var ids = Object.keys(MNEVER);
          if (!ids.length) return '';
          return '<div class="mt-div">Not suggested</div>' +
            '<div class="mt-cap">Fill won\u2019t add these. You can still add them yourself by searching.</div>' +
            ids.map(function (id) {
              var rr = BY_ID[id] || BY_ID[Number(id)];
              return '<div class="mnv-row"><span class="mnv-n">' + esc(rr ? rr.name : id) +
                '<small>since ' + esc(mPretty(MNEVER[id])) + '</small></span>' +
                '<button class="ghost" data-mallow="' + esc(id) + '">Allow</button></div>';
            }).join('');
        })() +
        /* sheet-done, not data-close. The attribute is decorative — it sits
           on the scrim too, so closest() would find it from anywhere inside
           the card and every tap would shut the sheet. The class is the wire.
           The note on that handler says so, and says it was written because
           a Done button had already been built wearing the decoration once. */
        '<div class="sync-row"><button class="btn-primary sheet-done">' +
          (total ? 'Done &middot; ' + total + ' chosen' : 'Skip for now') +
        '</button></div>' +
      '</div></div>';
  }

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
  /* The one way into the plan sheet. It was written inline in the weigh-in
     card's click handler, which was the only door there was; the bottom bar's
     button is a second, and a second copy of six lines is how two doors start
     opening onto slightly different rooms. */
  function mOpenTargets() {
    rememberOpener();
    S.macroTargOpen = true;
    pushSheet({ m: 1 });
    renderModal();
    var tf = $('mtGoalLb') || $('mtP');
    if (tf) tf.focus();
  }

  function macroFootHTML(day, targets, slots) {
    /* The one sentence this tab never had.
     *
       Driven cold, every other tab in the app explains itself when it is
       empty — Plan says what a week is for, List says where its lines come
       from, Pantry says what the storehouse carries. My Day said "Craft your
       plan." here and "No plan yet. [Craft my plan]" a hundred pixels below,
       which is the same instruction twice and an explanation none. It is also
       the tab with the steepest ideas in it.
     *
       So: what this is, and what happens first. The second prompt goes — the
       card below carries the button, and the bottom bar's own button is now
       the third and loudest way in. */
    if (!targets.p && !targets.f && !targets.c) {
      /* `limits` spelled out rather than left off: the caller assigns it to
         innerHTML, and a missing key there writes the word "undefined"
         across the card. */
      return { foot: '<div class="macro-none">' +
        '<b>This is your day.</b> Set a goal — lose, hold or gain — and Nourish ' +
        'works out what to eat, drafts a day from the recipes you like, and ' +
        'keeps count as you tick things off.</div>', limits: '', pills: '' };
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
       things food is made of and the flame is what the three add up to. The
       row names itself "Calories" in words to a reader either way.
     *
       And calories are not the fourth of four equal lines. They are the
       headline \u2014 the one figure the day is steered by, and the sum the other
       three are components of. Four identical bars said the opposite: that
       protein and the whole day's energy are the same rank of fact. So the
       flame takes the top of the card at display size with a bar the full
       width of it, and P, F and C sit under it as three columns of one
       height. Same four numbers, in the shape of what they are. */
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
    var barHTML = {};
    ROWS.forEach(function (row) {
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
      /* Off the same constant as the verdict below it, or it quietly puts back
         the bug it is sitting above: at 3% a day at 102.5% of target counted as
         near and so drew green, while the strip — over at 2% — had already
         called it over. One threshold has to mean one threshold. */
      /* The rule lives in mVerdict now, where the summary sheet reads it too.
         It was written out here once and three other ways elsewhere, and a
         day at 105.5% was on the bar, "close" on the strip, and a red ring
         on the sheet — one question, three answers. */
      var state = mVerdict(m, plan, target);
      barState[m] = state;
      barPct[m] = Math.min(100, pct);
      var wAte = Math.min(100, 100 * ate / target);
      var wPlan = Math.min(100 - wAte, 100 * (plan - ate) / target);
      var wAsm = Math.min(100 - wAte - wPlan, 100 * assume / target);
      var num = '<span class="mb-num"><b>' + (m === 'kcal' ? full.toLocaleString() : full) +
        '</b> / ' + (m === 'kcal' ? tK.toLocaleString() + ' kcal' : targets[m] + esc(row[3])) +
        '</span>';
      /* The figures go INSIDE the bar, and the fill is the whole pill.
       *
         Blake's layout. The bar used to be a stripe under a caption, which
         gave the fill whatever width the numbers beside it did not want; as
         the pill it gets the entire card and reads as a quantity rather than
         as decoration under a line of text.
       *
         The words are drawn TWICE — once in ink and once in paper, the paper
         copy clipped at exactly the eaten edge — which is the only way a
         figure sitting on a partial fill stays legible at both ends. Clipped
         at `wAte` rather than at the end of the whole fill, because the
         planned band and the assumed hatching are both pale and ink is what
         reads on those.
       *
         Two bands, not three. Solid is eaten, pale is planned — food and
         intention, which are both things you have actually put on the day.
         The third used to hatch in what an EMPTY meal is assumed to become,
         and Blake, on the new pills: "I don't need the hash lines when
         blank. Just blank is fine." He is right that it was loud: on a
         morning it covered most of four bars, and it is the one band you
         cannot act on — there is nothing on that meal to nudge.
       *
         The assumption itself has not gone anywhere. It still lands in the
         delta, which is what the pills at the top of the day print, so an
         untouched day still says +316 rather than 600 short. See the note on
         `left` above: that figure is what the DAY will come to, and this bar
         is what is on it. */
      var words = '<span class="mb-k mb-' + m + '" aria-hidden="true">' + row[1] + '</span>' + num;
      var track = '<span class="mb-track" style="--f:' + wAte.toFixed(1) + '%">' +
          '<i class="mb-ate" style="width:' + wAte.toFixed(1) + '%"></i>' +
          '<i class="mb-plan" style="width:' + wPlan.toFixed(1) + '%"></i>' +
          '<span class="mb-w">' + words + '</span>' +
          '<span class="mb-w mb-on" aria-hidden="true">' + words + '</span>' +
        '</span>';
      /* What is left of the line, signed. It used to be printed beside every
         bar; three columns have no room for a third figure at a width a
         phone actually is, and the pills carry the same number visibly a
         line higher. So it stays in the markup, spoken rather than printed —
         which is also what keeps a reader who cannot see the fill told how
         far off the day is. */
      var delta = '<span class="mb-d ' + sign(left[m]) + ' vis-hidden"><b>' +
        signed(left[m]) + '</b>' + (left[m] > 0 ? ' over' : ' to go') + '</span>';
      var open = '<div class="' + (m === 'kcal' ? 'mhead' : 'mbrow') + ' ' + state +
        '" data-macro="' + m + '" data-state="' + state +
        '" data-eaten="' + Math.round(wAte) + '" data-planned="' +
        Math.round(Math.min(100, 100 * plan / target)) + '">';
      /* One shape for all four now: the pill IS the row. The headline is the
         same pill at display size, which is what keeps calories the headline
         without making them a different kind of object. */
      barHTML[m] = open + track +
        '<span class="vis-hidden">' + row[2] + '</span>' + delta + '</div>';
    });
    var bars = barHTML.kcal + '<div class="mbars3">' +
      barHTML.p + barHTML.f + barHTML.c + '</div>';

    /* A floor and a ceiling, not two more budgets — which is why they are a
       line rather than two more bars. Fibre is what makes a cut survivable
       and we come up short on it most days; sodium is half again over the
       guideline on a day this app fills, and it is also what moves the scale
       overnight without moving any fat. */
    var naCap = 2300;
    var fibFloor = Math.round(tK * 14 / 1000);          // 14 g per 1000 kcal
    var na = Math.round(tot.all.na), fib = Math.round(tot.all.fib);
    /* Fibre NEVER turns red. Over a floor is still good \u2014 there is no such
       thing as too much fibre on a cut \u2014 so the only two states are short
       and met.
     *
       Salt NEVER turns green. Staying under a ceiling is the default, not an
       achievement, so it is quiet until it is within a fifth of the cap,
       then it warns, then it is over. Green there would congratulate you for
       having eaten nothing in particular. */
    var fibState = fib >= fibFloor ? 'met' : 'short';
    var naState = na > naCap ? 'past' : na >= naCap * 0.8 ? 'near' : 'quiet';
    /* And that is the whole argument for why these two are not a row of the
       readout any more.
     *
       They were a pair of bars under the macros, which put five things in a
       column and invited you to read them as five budgets to fill. Salt is
       not a budget. Filling the protein bar is the day going right and
       filling the salt bar is the day going wrong, and drawing both the same
       way, always, in the same stack, is the readout arguing with itself.
     *
       So they are silent. Nothing is drawn while fibre clears its floor and
       salt is nowhere near its ceiling, which is most days and is exactly
       when there is nothing to do about either. When one goes off, one line
       appears and says which and by how much.
     *
       This is the rule the app already keeps a level down: a plate has no
       "on" chip, and the absence of one is what makes a chip mean something.
       A warning that is always on the screen is not a warning, it is
       furniture. */
    var limitLine = function (state, glyph, text, name) {
      return '<div class="mlim ' + state + '" data-lim="' + name + '">' +
        '<span class="mlim-g" aria-hidden="true">' + glyph + '</span>' +
        '<span class="mlim-t">' + text + '</span></div>';
    };
    var micro = '';
    /* A ceiling can be busted at lunch; a floor can only be missed at the
       end. So the two do not warn on the same schedule.
     *
       An empty day is short of fibre by the whole floor, and saying so is
       the most useless sentence this card could carry \u2014 of course it is, you
       have not eaten yet, and the rest of the day is precisely what fixes
       it. A day still carrying an empty meal is the same story less far
       along. So fibre holds its tongue until nothing is being assumed any
       more: every meal has something in it, the day is built, and a
       shortfall is now a finding rather than an unfinished sentence.
     *
       Salt has no such patience. Two thousand milligrams by lunch is worth
       knowing at lunch, while there are still meals left to choose. */
    if (fibState === 'short' && !asm.kcal) {
      micro += limitLine('short', '\uD83C\uDF3E', '<b>' + fib + ' g</b> fibre &middot; ' +
        (fibFloor - fib) + ' short of the floor', 'fib');
    }
    if (naState !== 'quiet') {
      micro += limitLine(naState, '\uD83E\uDDC2', '<b>' + na.toLocaleString() + ' mg</b> salt &middot; ' +
        (naState === 'past' ? 'over' : 'nearing') + ' the ' + naCap.toLocaleString() +
        ' ceiling', 'na');
    }

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
      return mFillPill('mpill ' + cls, tone, pct, body);
    };
    var TONE = MPILL_TONE;
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
          bars + '<span class="mbars-more" aria-hidden="true">&rsaquo;</span></button>',
      /* Handed back separately, because the element it goes into is static
         markup in the page. A live region has to be on the page and watched
         BEFORE it gains content; building it here would mean a new region
         every redraw, and a screen reader announcing none of them. */
      limits: micro,
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

  function mpIcon(k) {
    return '<svg class="mp-way-i" viewBox="0 0 16 16" aria-hidden="true" fill="none" ' +
      'stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' +
      MP_ICON[k] + '</svg>';
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
        mMacLine(r, x, true) + mSaltNote(r, x);
    return '<div class="mpick-wrap' + (inB ? ' in' : '') + '">' +
      '<button class="mpick-row" data-mpick="' + esc(String(r.id)) + '" data-mpx="' + x + '"' +
        ' aria-pressed="' + (inB ? 'true' : 'false') + '">' +
        '<span class="mp-tick" aria-hidden="true">' + (inB ? '&#10003;' : '&#43;') + '</span>' +
        leaf(r.score, 'leaf-sm') +
        '<span class="mp-body">' +
          '<span class="mp-name">' +
            (mIsFav(r) ? '<span class="mp-fav">&#9733;</span> ' : '') +
            esc(r.name) +
            /* The badge sits with the NAME, not out on the row's edge: it is
               a fact about this dish at this portion, and a column of its own
               would have to be reserved on every row that cannot earn it. */
            (mClosesIt(r, x) ? ' <span class="mp-closes">closes</span>' : '') +
          '</span>' +
          '<span class="mp-fit">' + fit + '</span>' +
        '</span>' +
      '</button>' +
      /* The star is a control here, not a badge. Finding a thing once and
         having to find it again tomorrow is the whole reason to keep one. */
      '<span class="mp-side no-print">' +

        (!mCanFav(r) ? '' :
          '<button class="mp-star" data-mpfav="' + esc(String(r.id)) + '" aria-pressed="' +
            (inB2 ? 'true' : 'false') + '" aria-label="' +
            (inB2 ? 'Remove from favorites' : 'Keep as a favorite') + '">&#9733;</button>') +
      '</span>' +
    '</div>';
  }

  /* What you ate lately, newest first, one row each. The everyday case is a
     thing you have already named once — the tamale from last week — and it
     should not need any of the three ways to reach. */
  /* The two bands the home screen was missing.
   *
     Opening this sheet used to offer six things you ate lately and a way to
     go looking. What it never offered was the answer to the question you
     opened it with — what would close the day — even though the app has
     worked that out for every dish since the tab was built. It was one
     option inside a sort dropdown, two taps and a mode away, called "Best
     fit".

     Now it is a band, on arrival, with the portions already solved. */
  /* The one question every band asks of the query.
   *
     Searching used to REPLACE the ranked bands, because Every day / Recent /
     the closers / Fits best were emitted only in the home branch and typing
     switched you out of it. So the moment you looked for something, the
     thinking the sheet had done for you vanished — which is most of what
     "bouncing around" was.
   *
     Now the bands NARROW instead. One predicate, so a dish cannot pass in one
     band and fail in another: foods match on their name, the way the look-up
     box has always matched them, and recipes go through matchRank, which
     reads the ingredient list too — searching "honey" should find the dish
     that uses it, not just a spoon of it. */
  function mpQ() { return (S.mpQuery || '').trim().toLowerCase(); }

  /* The shelf rail. One chip at a time, '' meaning all of them.
   *
     It NARROWS what is already on screen rather than replacing it, exactly as
     the search box does, and the two compose: 🥩 with "chicken" typed is the
     chicken that is mostly protein. That is the whole reason a chip is a
     filter and not a mode — Recipes as a MODE could never have been crossed
     with a macro.
   *
     Not persisted. A shelf is a thought you are having about this meal, not a
     setting; the sheet opens showing everything, the way it always has. */
  function mpShelfOK(r) {
    if (!S.mpShelf) return true;
    if (S.mpShelf === 'recipes') return !r.food;
    return mShelfKey(r) === S.mpShelf;
  }

  /* Only the shelves that would actually find something, counted over the
     pool this meal can see. An 🫒 Oils chip that filters to one row is worse
     than no chip: it looks like the app has nothing, when what it has is one
     oil. Counted rather than assumed, because the pool moves — the
     storehouse-only pool and the shop-anywhere pool are different books. */
  /* Which recipes, and in what order. Two selects, on the band divider.
   *
     The section vocabulary is the one the Recipes tab speaks, and it answers
     a different question from the shelf rail: the rail is macros, this is
     sections and books. "On the family's plan" has no chip equivalent at all
     and would simply have been lost. */
  /* An order is a question you have about a long list.
   *
     The mockup puts it plainly: sorts only appear on Recipes, because a shelf
     of nine vegetables does not need one. Both places that decide this read
     the same function, because a sort control that is hidden while the list
     is still sorted by it is an invisible setting steering what you see —
     which is the exact shape of half the bugs this app has had.
   *
     "Recipes" here means what you are browsing, not a mode: the Single foods
     lens is a list of foods, and so is any macro shelf. Pressing 🍲 is
     browsing recipes and keeps its order. */
  function mpSortsOn() {
    return !(S.mpSec === 'foods' || (S.mpShelf && S.mpShelf !== 'recipes'));
  }
  function mpSortNow() { return mpSortsOn() ? S.mpSort : 'fit'; }

  function mpLensHTML() {
    var fam = mFamilyIds(mViewKey());
    return '<span class="mp-lens">' +
      '<select id="mpSec" aria-label="Which recipes">' +
        '<option value="meal"' + (S.mpSec === 'meal' ? ' selected' : '') + '>For this meal</option>' +
        (fam.length ? '<option value="family"' + (S.mpSec === 'family' ? ' selected' : '') +
          '>On the family\u2019s plan (' + fam.length + ')</option>' : '') +
        '<option value="all"' + (S.mpSec === 'all' ? ' selected' : '') + '>Every recipe</option>' +
        /* Restored after being cut for the shelf rail, which turned out not to
           do this job. A macro chip narrows to things that are MOSTLY that
           macro and then ranks them by fit — and for a main meal a dish fits
           better than a spoonful, so pressing 🥩 gives ten recipes and one
           tin of tuna. That is the right answer to "what protein should I
           eat" and the wrong answer to "let me see the plain foods", which is
           a question about kind, not macro. The rail cannot ask it: it is the
           same axis as "Every recipe", which is why it belongs here. */
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
      (mpSortsOn()
        ? '<select id="mpSort" aria-label="Order">' +
          '<option value="fit"' + (S.mpSort === 'fit' ? ' selected' : '') + '>Best fit</option>' +
          '<option value="protein"' + (S.mpSort === 'protein' ? ' selected' : '') + '>Most protein</option>' +
          '<option value="healthy"' + (S.mpSort === 'healthy' ? ' selected' : '') + '>Nutrition score</option>' +
          '</select>'
        : '') + '</span>';
  }

  var MSHELF_MIN = 3;
  function mpShelvesHTML() {
    if (!S.macroPick) return '';
    var slot = null;
    mReadSlots().list.forEach(function (sl) { if (sl.k === S.macroPick.slot) slot = sl; });
    if (!slot) return '';
    /* Typed, the rail counts.
     *
       The chips were built from the whole pool whatever was in the box, so a
       search left a row of shelves describing a list that was no longer on
       screen — and the one question you have while typing is WHERE the hits
       are. Narrowed by the query, each chip says how many of them it holds,
       and MSHELF_MIN steps aside: three is the floor for a shelf worth
       offering on a resting screen, and two hits for a word you just typed is
       worth knowing about. */
    var q = mpQ();
    var n = {}, anyRecipe = false, total = 0, cooked = 0;
    mMealPool(slot, true).forEach(function (r) {
      if (!r.food) anyRecipe = anyRecipe || !q;   // the chip exists if the pool has any
      if (q && !mpMatches(r, q)) return;
      total++;
      if (!r.food) { anyRecipe = true; cooked++; return; }
      var k = mShelfKey(r);
      if (k) n[k] = (n[k] || 0) + 1;
    });
    var tag = function (c) {
      return q ? '<b class="mp-shn">' + c + '</b>' : '';
    };
    var chips = '<button class="mp-shelf' + (S.mpShelf ? '' : ' on') +
      '" data-mpshelf="" aria-pressed="' + (S.mpShelf ? 'false' : 'true') + '">All' +
      tag(total) + '</button>';
    if (anyRecipe || S.mpShelf === 'recipes') {
      /* An emoji like the rest. Spelled out it was 89 px — a third of a
         320 px rail for one chip, which bought five of the nine a place
         behind the fade. The pot is as legible as the carrot beside it. */
      chips += '<button class="mp-shelf emo' + (q ? ' counted' : '') +
        (S.mpShelf === 'recipes' ? ' on' : '') +
        '" data-mpshelf="recipes" aria-pressed="' + (S.mpShelf === 'recipes' ? 'true' : 'false') +
        '" aria-label="Recipes' + (q ? ', ' + cooked + ' of them' : '') +
        '"><i>\uD83C\uDF72</i>' + tag(cooked) + '</button>';
    }
    MSHELF.forEach(function (sh) {
      var c = n[sh[0]] || 0;
      /* The chip you are standing on never leaves, even at nought. Dropping
         it took away the only way to un-press the thing that emptied the
         list — press 🥦, type a word no vegetable answers to, and both the
         rows and the chip were gone. A zero is a real answer: this shelf has
         none of what you typed. */
      if (c < (q ? 1 : MSHELF_MIN) && S.mpShelf !== sh[0]) return;
      chips += '<button class="mp-shelf emo' + (q ? ' counted' : '') +
        (S.mpShelf === sh[0] ? ' on' : '') +
        '" data-mpshelf="' + sh[0] + '" aria-pressed="' + (S.mpShelf === sh[0] ? 'true' : 'false') +
        '" aria-label="' + esc(sh[2]) + (q ? ', ' + c + ' of them' : '') +
        '"><i>' + sh[1] + '</i>' + tag(c) + '</button>';
    });
    return '<div class="mp-shelves" id="mpShelves">' + chips + '</div>';
  }
  function mpMatches(r, qs) {
    if (!r) return false;
    if (!mpShelfOK(r)) return false;
    if (!qs) return true;
    return r.food ? r.name.toLowerCase().indexOf(qs) >= 0 : !!matchRank(r, qs);
  }

  /* The thing you actually named, before anything that merely mentions it.
   *
     Ranked on fit alone a spoonful loses to every dinner that lists honey
     among its ingredients, so the row the search was FOR sinks below a
     screenful of recipes. The old Look up screen had this rule and it went
     out with the screen; the bands that replaced it rank by fit, which is the
     right question when you are browsing and the wrong one the moment you
     have typed a word. A search is not a browse: the word is the whole of the
     question. */
  function mpNamedHTML(shown) {
    var q = mpQ();
    if (!q || !S.macroPick) return '';
    var rows = [];
    MFOODS.forEach(function (r) {
      if (rows.length >= 6 || shown[r.id]) return;
      if (!mpShelfOK(r)) return;
      if (r.name.toLowerCase().indexOf(q) < 0) return;
      rows.push(r);
    });
    if (!rows.length) return '';
    rows.forEach(function (r) { shown[r.id] = 1; });
    return '<div class="mt-div">Foods</div>' + rows.map(function (r) {
      return mpRowHTML(r, 1);
    }).join('');
  }

  function mpPinsHTML(shown) {
    mGapFresh();
    if (!S.macroPick) return '';
    var slot = null;
    mReadSlots().list.forEach(function (sl) { if (sl.k === S.macroPick.slot) slot = sl; });
    var pins = (slot && slot.pins) || [];
    var rows = pins.map(function (pn) {
      var r = BY_ID[idOf(pn.id)];
      if (!r) return '';
      if (!mpMatches(r, mpQ())) return '';
      if (shown) shown[r.id] = 1;
      return mpRowHTML(r, pn.x || 1);
    }).filter(Boolean).join('');
    return rows ? '<div class="mt-div">Every day</div>' + rows : '';
  }

  /* What closes the day, from this meal's own pool, portions solved.
   *
     Skips anything the bands above already drew: a pin that is also a recent
     and also the best fit would otherwise be three rows saying the same
     thing, and a list that repeats itself reads as a list that is not
     thinking. */
  /* Everything else the query finds.
   *
     Without this, narrowing the bands would be worse than replacing them:
     the bands hold a few dozen dishes, so typing "salmon" would filter all
     four to nothing and the sheet would say there is no salmon — while the
     table holds it. This is the old look-up result, folded in underneath
     rather than shown instead.
   *
     Only when something is typed. With an empty box the ranked bands ARE the
     answer and a fifth band of everything in the book underneath them is not
     help. */
  function mpElseHTML(shown) {
    var q = mpQ();
    if (!q || !S.macroPick) return '';
    var day = mDay(mViewKey()), targets = mDayTargets(mViewKey());
    var slot = null;
    mReadSlots().list.forEach(function (sl) { if (sl.k === S.macroPick.slot) slot = sl; });
    var pool = [];
    MFOODS.forEach(function (r) { if (!shown[r.id] && mpMatches(r, q)) pool.push(r); });
    RECIPES.forEach(function (r) { if (!shown[r.id] && mpMatches(r, q)) pool.push(r); });
    if (!pool.length) return '';
    var ranked = mRank(pool, day, targets, slot || { k: S.macroPick.slot, w: S.macroPick.w });
    /* The thing you named before the dishes that merely mention it: ranked
       purely on fit, a spoon of honey loses to a dozen recipes listing honey
       among their ingredients and the row you typed the word for never
       appears. Same rule the look-up box has always used. */
    var hits = [], rest = [];
    ranked.forEach(function (e) { (e.r.food ? hits : rest).push(e); });
    var rows = hits.concat(rest).slice(0, 12);
    if (!rows.length) return '';
    rows.forEach(function (e) { shown[e.r.id] = 1; });
    return '<div class="mt-div">Everything else</div>' + rows.map(function (e) {
      var r = e.r, xx = S.mpBasket[r.id] !== undefined ? S.mpBasket[r.id] : e.x;
      return mpRowHTML(r, e.x,
        '<span class="mp-src">' + (r.food ? 'Yours' : 'Recipe') + '</span> &times;' + fmtNum(xx) +
        (r.food ? ' ' + esc(r.unit) : '') + ' &middot; ' + mMacLine(r, xx, true));
    }).join('');
  }

  function mpFitsHTML(skip) {
    mGapFresh();
    if (!S.macroPick) return '';
    var targets = mDayTargets(mViewKey());
    var slot = null;
    mReadSlots().list.forEach(function (sl) { if (sl.k === S.macroPick.slot) slot = sl; });
    if (!slot) return '';
    /* With no plan there is no fit to rank by, but there is still a whole
       book and a whole food table, and logging what you ate cannot wait on
       making a plan. This band used to return '' here and the "Single foods"
       lens was the only other way in — so when that lens went to the shelf
       rail, an unplanned day lost its last door and the picker opened on
       nothing at all. It offers the pool in book order instead, and says so
       rather than claiming a fit it cannot compute. */
    var planned = !!(targets.p || targets.f || targets.c);
    /* The slot OBJECT, not its key. mSlotSecs reads slot.t, and a string has
       no .t — so it fell through to MEAL_SECS.s and every meal, breakfast
       included, was ranked against the snack sections. Nothing threw; the
       band just quietly offered the wrong pool. */
    /* The lens decides the pool; the rail and the box narrow it afterwards.
       "For this meal" is the meal's own sections, which is what this band has
       always meant; anything else widens or names a section outright. */
    var pool;
    if (S.mpSec === 'foods') {
      /* Every food with macros on it, condiments included. The ranked bands
         gate on `eat || side` — nobody wants a spoon of oil OFFERED as a
         snack — but this lens is somebody going to look through the shelf,
         and a tablespoon of oil is a real thing to have eaten and to log.
         They sort under the foods rather than out of the list: a thing that
         goes ON food is not the answer to "what shall I eat", which is the
         same rule the combo's rungs follow.
     *
         EVERY food, including the ones the storehouse does not stock. "Fill
         from: the storehouse" says what the SOLVER may shop from — a day
         drafted out of salmon that is not in the house is not a day — and it
         has never had anything to say about what you may look at or log.
         Gating this lens on it hid all twenty-eight of the outside foods
         from the one lens whose whole job is "let me look through the
         shelf", while the same foods came straight back the moment you typed
         their name, which is a shelf that disagrees with its own search box.
         The gate belongs in mMealPool, mSideUp, mTopUp and mLevers, and it is
         still in all four. */
      pool = [];
      MFOODS.forEach(function (r) {
        if (!r.macro || !(r.macro.kcal > 0 || r.macro.p > 0)) return;
        pool.push(r);
      });
    } else if (S.mpSec === 'meal') {
      pool = mMealPool(slot, mWideOpen(S.macroPick.slot));
    } else {
      var fam = S.mpSec === 'family' ? mFamilyIds(mViewKey()) : null;
      pool = RECIPES.filter(function (r) {
        if (fam) return fam.indexOf(r.id) >= 0;
        return S.mpSec === 'all' || (r.book + '-' + r.secNum) === S.mpSec;
      });
      /* Foods ride along only where they were asked for. Naming a section is
         naming what you want to look through — answering "Sunday Feasts" with
         the Sunday Feasts and then the entire food table is answering a
         question nobody asked. A typed word is different: somebody who types
         "honey" has already said what they want, and it should reach them
         from whatever lens they happen to be standing in. */
      /* And a typed word reaches the outside foods too, for the same reason
         the lens does: the setting is about drafting, not about looking. */
      if (mpQ()) {
        MFOODS.forEach(function (r) {
          if (r.eat || r.side) pool.push(r);
        });
      }
    }
    var q = mpQ();
    var ranked = planned
      ? mRank(pool, mDay(mViewKey()), targets, slot)
        .filter(function (e) {
          /* Blocked is a rule about SUGGESTING: a typed word still finds it. */
          return e.score !== null && !skip[e.r.id] && mpMatches(e.r, q) && (q || !mNever(e.r.id));
        })
      : (function () {
        /* Foods and dishes alternated, not a prefix of the pool. mMealPool
           puts every recipe before every food, so a plain slice of ten was
           ten recipes and the 🥩 chip showed no foods at all — the chip is
           mostly there to reach the foods. Without a plan there is no fit to
           order by, so the only honest order is "some of each". */
        var ok = pool.filter(function (r) { return !skip[r.id] && mpMatches(r, q); });
        var fd = [], rc = [], out = [];
        ok.forEach(function (r) { (r.food ? fd : rc).push(r); });
        for (var i = 0; i < Math.max(fd.length, rc.length); i++) {
          if (fd[i]) out.push({ r: fd[i], x: 1 });
          if (rc[i]) out.push({ r: rc[i], x: 1 });
        }
        return out;
      })();
    /* An order is a lens, not a different picker: every row keeps the portion
       the fit worked out, whatever order they arrive in. */
    var order = mpSortNow();
    if (order === 'protein') {
      ranked.sort(function (a, b) {
        return ((b.r.macro && b.r.macro.p) || 0) - ((a.r.macro && a.r.macro.p) || 0);
      });
    } else if (order === 'healthy') {
      ranked.sort(function (a, b) { return (b.r.score || 0) - (a.r.score || 0); });
    }
    /* Ten while the lens is where it opens, forty once it has been moved.
     *
       Ten is the right length for "here are the best fits" — a shortlist you
       read rather than a catalogue you scroll. But choosing a lens is asking
       a different question: "Single foods" or "Sunday Feasts" is somebody
       going to look through a shelf, and answering that with the top ten is
       answering the shortlist question again. The old Recipes screen showed
       forty for exactly this reason and it went out with the mode. */
    if (S.mpSec === 'foods') {
      /* Stable: the fit order is kept inside each group, and the condiments
         simply move below the foods. */
      var eats = [], cond = [];
      ranked.forEach(function (e) { ((e.r.eat || e.r.side) ? eats : cond).push(e); });
      ranked = eats.concat(cond);
    }
    /* Anything already in the basket stays on screen, outside the cap.
     *
       Picking something used to make it VANISH: a closer stops being a closer
       once it is in the basket, and it fits worse afterwards — the gap it
       filled is gone — so it fell out of the ranking too. Measured, the list
       went 13 rows to 12 to 11 to 10 over three taps, `.mpick-wrap.in` was
       never once on screen, and the scrollport's maximum collapsed from 162
       to 4 — so the browser clamped the position and the list crawled up
       under the finger. The ✓ and the green wash a picked row wears had
       nothing to wear them.
     *
       Held at the end rather than the top: it is no longer a suggestion, and
       promoting it would push the actual suggestions down. */
    var held = [], offer = [];
    ranked.forEach(function (e) {
      (S.mpBasket[e.r.id] !== undefined ? held : offer).push(e);
    });
    ranked = offer.slice(0, S.mpSec === 'meal' ? 10 : 40).concat(held);
    /* An empty band still draws its divider, because the divider is where the
       lens and the order live and they are the way back out.
     *
       A shelf chip and a lens compose — that is the whole point of a chip
       being a filter — and some pairs have nothing in them: press 🥦 while
       the lens says "Every recipe" and you are asking for a recipe that is a
       vegetable. The band returned '' and took the two controls with it, so
       the sheet showed an empty list and no way to undo the thing that
       emptied it. It says what it has none of instead, and keeps the handles. */
    if (!ranked.length) {
      /* Empty because of the LENS: keep the divider, because the lens and the
         order live on it and they are the way back out. Press 🥦 while the
         lens says "Every recipe" and you have asked for a recipe that is a
         vegetable — the band used to return '' and take both controls with
         it, leaving an empty list and no way to undo the thing that emptied
         it.
       *
         Empty because of a QUERY is not that: the box is right there with the
         caret in it, so the way out is already under your hands, and a "Fits
         best" heading standing over no rows would be a band claiming content
         it does not have. No divider, and the list says "Nothing matches" in
         its own words.
       *
         No message here either way. A band that returns any string at all
         makes the list look non-empty, and that is what buried the honest
         sentence the first time this was tried. */
      if (mpQ()) return '';
      return '<div class="mt-div mt-div-x">' + (planned ? 'Fits best' : 'On the shelf') +
        mpLensHTML() + '</div>';
    }
    /* Writes into the shared set, which it never used to — safe only while it
       was composed last, and it is not last any more. */
    ranked.forEach(function (e) { skip[e.r.id] = 1; });
    /* The lens and the order ride the divider rather than the pinned header:
       a header has to earn every pixel and these are asked for rarely, but
       they are asked for — "show me the Sunday Feasts" is a real thing to
       want and no macro chip can say it. */
    return '<div class="mt-div mt-div-x">' + (planned ? 'Fits best' : 'On the shelf') +
      mpLensHTML() + '</div>' +
      ranked.map(function (e) {
      return mpRowHTML(e.r, e.x);
    }).join('');
  }

  /* `shown` is shared with the bands above and below, so the same dish is
     never drawn three times under three headings. Passed in rather than kept
     here, because whoever composes the screen is the only thing that knows
     what order the bands ran in. */
  function mpRecentHTML(shown) {
    mGapFresh();
    var seen = shown || {}, out = [];
    var keys = Object.keys(MDAYS).sort().reverse();
    keys.forEach(function (k) {
      var day = MDAYS[k] || {};
      Object.keys(day).forEach(function (sk) {
        (day[sk] || []).forEach(function (it) {
          if (seen[it.id] || out.length >= 6) return;
          var r = BY_ID[it.id];
          if (!r) return;
          if (!mpMatches(r, mpQ())) return;
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
  /* What is ALREADY on the meal you are adding to.
   *
     The bar along the bottom lists the basket, and only once something is in
     it — so a meal you had half-built was invisible from the sheet you build
     it in. Blake: "when I open the meal picker I can't see what I have
     already picked... I'd like to see the contents of that meal if there are
     contents already selected."
   *
     Two different statements, so two different panels: this is what the meal
     holds, the basket is what is about to join it. Same row shape so they
     read as one family, a different heading colour so they are never mistaken
     for each other — the basket's green means "about to be added", and
     nothing here is about to be anything.
   *
     In the BAR, not in the scroll. It began as a panel under the sticky
     header and Blake moved it: "I want this basket to fold into the footer.
     If there are foods already on that meal I meant to see them in the sticky
     footer basket." Which is right — what the meal holds and what is about to
     join it are the same question asked a second apart, and the bar is where
     the answer was already kept. It also gives the list back the ~200px the
     panel was spending on something you read once. */
  function mMealOnItems() {
    if (!S.macroPick || !S.macroPick.slot) return [];
    return (mDay(mViewKey())[S.macroPick.slot] || []).filter(function (it) {
      return BY_ID[it.id];
    });
  }

  function mMealOnHTML() {
    var items = mMealOnItems();
    if (!items.length) return '';
    var nm = mSlotOf(mReadSlots(), S.macroPick.slot);
    var show = items.slice(0, 4), rest = items.length - show.length;
    return '<div class="mp-basket-h mp-on-h">Already on ' +
      esc((nm && nm.n) || 'this meal') + ' &middot; ' + items.length + '</div>' +
      show.map(function (it) {
        var r = BY_ID[it.id];
        return '<div class="mpb-row">' +
          '<span class="mpb-b">' +
            '<span class="mpb-n">' + esc(r.name) + '</span>' +
            '<span class="mpb-m">' + mMacLine(r, it.x) + '</span>' +
          '</span>' +
          '<span class="mpb-por">' + esc(mPortionText(r, it.x)) + '</span>' +
        '</div>';
      }).join('') +
      (rest > 0 ? '<div class="mpb-more">and ' + rest + ' more</div>' : '');
  }

  function mBasketListHTML() {
    var ids = Object.keys(S.mpBasket);
    var on = mMealOnHTML();
    /* Neutral while the basket is empty. The green wash means "about to be
       added" wherever it appears in this sheet, and a drawer holding only
       what is ALREADY on the plate must not wear it. With both halves in
       there the tint is the basket's and the two headings carry the rest. */
    if (!ids.length) return on ? '<div class="mp-basket mp-basket-on">' + on + '</div>' : '';
    /* Its own row, not the picker's. The list already ticks what is in the
       basket; repeating the whole row here — stepper, star and all — put the
       same plate on screen twice with two sets of controls. */
    return '<div class="mp-basket">' + on +
      '<div class="mp-basket-h">In the basket &middot; ' +
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
            /* Its own attribute, not a second data-mpick. Carrying the list
               row's attribute made the two indistinguishable to focusKey: after
               an add, the focus restore looked up
               [data-mpick=<id>][data-mpx=<x>], found TWO, and took the first in
               document order — this one, which sits at the top of the sheet.
               Focusing it scrolled the scrim to 0, so every add threw the list
               back to the top from wherever you had scrolled to. */
            '<button class="mpb-out" data-mpout="' + esc(String(r.id)) +
              '" aria-label="Take out of the basket">&times;</button>' +
          '</span>' +
        '</div>';
      }).join('') + '</div>';
  }

  /* What the basket will do to the meal, said before you commit it rather
     than discovered afterwards on the plate. */
  /* The basket and what it costs, together, on the bar along the bottom.
   *
     The list of what you have picked used to sit in the SCROLL, above the
     rows, and grow as you picked: measured, 71px after one thing, 119 after
     two, 167 after three. Two costs, both felt. The rows slid down under the
     finger on every tap — preserving scrollTop is what does that, since the
     content above the list got taller — and once you had scrolled past it the
     panel was off-screen (measured at y -106), so the one thing it exists to
     answer, "what have I got", could not be answered without scrolling back.
   *
     It is folded into the bar now: shut it costs nothing and the readout is
     the summary; open it lists what is in there, over the list rather than
     inside it, capped so it can never take the screen. Shut again on every
     open of the sheet, because a basket you have not filled yet has nothing
     to say. */
  function mBasketBarHTML() {
    var foot = mBasketFootHTML();
    if (!foot) return '';
    return '<div class="mp-bar">' +
      (S.mpBasketOpen ? mBasketListHTML() : '') + foot + '</div>';
  }

  function mBasketFootHTML() {
    var ids = Object.keys(S.mpBasket);
    /* An empty basket used to take the whole bar with it, so a meal you had
       half-built showed nothing anywhere: the plates were on the day behind
       the sheet and the sheet said nothing about them. The bar speaks for the
       MEAL now when the basket has nothing to say — same handle, same drawer,
       and no Add, because a button that adds nothing is still not a button. */
    if (!ids.length) {
      var onItems = mMealOnItems();
      if (!onItems.length) return '';
      var ot = { kcal: 0, p: 0, f: 0, c: 0 };
      onItems.forEach(function (it) {
        var r0 = BY_ID[it.id];
        if (!r0 || !r0.macro) return;
        ['kcal', 'p', 'f', 'c'].forEach(function (m) {
          ot[m] += (r0.macro[m] || 0) * it.x;
        });
      });
      var onm = mSlotOf(mReadSlots(), S.macroPick.slot);
      return '<div class="mp-foot mp-foot-on">' +
        '<button class="mp-foot-t" data-mpbasket="1" aria-expanded="' +
          (S.mpBasketOpen ? 'true' : 'false') + '" aria-label="' +
          (S.mpBasketOpen ? 'Hide what is on this meal' : 'Show what is on this meal') + '">' +
          '<span class="mp-foot-b">' +
            '<span class="mp-foot-m">On ' + esc((onm && onm.n) || 'this meal') +
              ' &middot; ' + Math.round(ot.kcal) + ' kcal &middot; ' +
              Math.round(ot.p) + 'P &middot; ' + Math.round(ot.f) + 'F &middot; ' +
              Math.round(ot.c) + 'C</span>' +
            '<span class="mp-foot-n">' + esc(mBasketNames(onItems.map(function (it) {
              return String(it.id);
            }))) + '</span>' +
          '</span>' +
          '<span class="mp-foot-c' + (S.mpBasketOpen ? ' open' : '') +
            '" aria-hidden="true">&#8964;</span>' +
        '</button>' +
      '</div>';
    }
    var t = { kcal: 0, p: 0, f: 0, c: 0 }, est = false;
    ids.forEach(function (k) {
      var r = BY_ID[idOf(k)];
      if (!r || !r.macro) return;
      var x = S.mpBasket[k];
      t.kcal += (r.macro.kcal || 0) * x; t.p += (r.macro.p || 0) * x;
      t.f += (r.macro.f || 0) * x; t.c += (r.macro.c || 0) * x;
      if (r.est) est = true;
    });
    /* Judged against the same thing the bars above it are drawn against, and
       measuring the same quantity.
     *
       It used to weigh the BASKET ALONE against mShares — the room left for
       one more thing — while the panel twenty pixels above drew committed
       PLUS basket against the meal's plan share. Two quantities, two
       denominators, one sheet: the top invited food the bottom called a bust.

       The plan share is the one to keep, and not by preference. The card
       behind this sheet uses it, and so does the balance button on that card,
       whose own comment rejects mShares for this job with the regression it
       caused written into it — a meal sitting exactly on target told its
       target was nearly zero. A picker that spoke the remainder would have
       invited roughly double what that button then solved away.

       mRank still asks mShares, and should: "what fits the room left" is a
       real question and a different one. It decides what to OFFER. This
       decides whether the meal you are building lands. */
    var k = mViewKey();
    var targets = mDayTargets(k);
    var busts = false, over = 0;
    if (targets.p || targets.f || targets.c) {
      /* Against what the meal is ASKING for, by the card's rule — the pills
         above this bar read the ask and the footer read the plan's first
         share, so a basket at 491 of a 229 ask was "over" in four pills and
         silent here, because 491 is under 556 × 1.07. */
      var ask2 = mMealAsk(S.macroPick.slot, targets, mReadSlots());
      var sh = ask2 ? (ask2.now || ask2.plan) : null;
      if (sh && sh.kcal > 0) {
        var held = 0;
        (mDay(k)[S.macroPick.slot] || []).forEach(function (it) {
          var r2 = BY_ID[it.id];
          if (r2 && r2.macro) held += (r2.macro.kcal || 0) * it.x;
        });
        over = Math.round(held + t.kcal - sh.kcal);
        var gz2 = mGauge(held + t.kcal, sh.kcal, kcalOf(targets));
        busts = !!gz2 && gz2.st === 'x';
      }
    }
    /* The commit button lives here now, beside the number it commits.
     *
       It is still gated on a basket with something in it — this whole
       function returns early on an empty one — because a button that adds
       nothing is not a button, and a test pins that contract. What changed is
       only WHERE it sits once it exists: on the bar already pinned to the
       bottom of the viewport rather than at the top of a header that scrolls
       away while you fill the basket it commits. */
    /* The readout is the handle. It already says what the basket comes to, so
       pressing it to see what that is made of is the shortest sentence the
       sheet can offer — and it puts a second control on the bar without
       adding a second thing to read. */
    return '<div class="mp-foot' + (busts ? ' busts' : '') + '">' +
      '<button class="mp-foot-t" data-mpbasket="1" aria-expanded="' +
        (S.mpBasketOpen ? 'true' : 'false') + '" aria-label="' +
        (S.mpBasketOpen ? 'Hide what is in the basket' : 'Show what is in the basket') + '">' +
        '<span class="mp-foot-b">' +
          '<span class="mp-foot-m">' +
            (busts ? '<i class="mp-foot-l">Over this meal by ' + over + '</i> &middot; ' : '') +
            (est ? '~' : '') + Math.round(t.kcal) + ' kcal &middot; ' +
            Math.round(t.p) + 'P &middot; ' + Math.round(t.f) + 'F &middot; ' +
            Math.round(t.c) + 'C</span>' +
          /* The names, on the bar. The list behind this button has always
             existed and Blake never found it — "I see I have a qty but I
             don't see what they are" — because the only thing pointing at it
             was a ‹, a LEFT-pointing chevron on a drawer that opens upward,
             sitting beside a number instead of beside what it reveals. The
             same mistake the meal fold made in v211: the mark was not on the
             edge that moves.

             Two names and a count. Three fits when they are short and does
             not when one of them is "Genius Gourmet Sparkling Protein Fruit
             Punch", and a bar that reflows as you pick is worse than one that
             always says the same amount. The drawer keeps the rest, and keeps
             the quantities, which are the part you adjust least. */
          '<span class="mp-foot-n">' + esc(mBasketNames(ids)) + '</span>' +
        '</span>' +
        '<span class="mp-foot-c' + (S.mpBasketOpen ? ' open' : '') +
          '" aria-hidden="true">&#8964;</span>' +
      '</button>' +
      '<button class="mp-done" data-mpdone="1">Add ' + ids.length + '</button>' +
    '</div>';
  }

  /* Two names and a tally. Not every name: the bar has one line for them and
     the longest food in Blake's own basket is forty-three characters. */
  function mBasketNames(ids) {
    var names = [];
    ids.forEach(function (bk) {
      var r = BY_ID[idOf(bk)];
      if (r) names.push(r.name);
    });
    if (!names.length) return '';
    if (names.length <= 2) return names.join(', ');
    return names.slice(0, 2).join(', ') + ' +' + (names.length - 2) + ' more';
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
    /* ONE query. There were two — S.mpQuery behind the Recipes box and
       S.mpLook behind the Look up box — with near-identical placeholders and
       no shared state, so typing "chicken" into one and switching to the
       other silently threw the word away and asked for it again. */
    S.mpQuery = '';
    S.mpShelf = '';
    S.mpBasketOpen = false;
    S.mpMode = mode || 'home';
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
        /* The count chip and the Add button both left this header for the bar
           along the bottom. They were the first thing in the sheet and the
           header has no position, so the one control that commits a basket
           scrolled off the moment you moved down the list to fill it — while
           the one element pinned to the bottom of the screen, where a thumb
           actually rests, carried no control at all. The chip did not follow
           them: "Add 3" already carries the count, and the basket panel above
           already lists what the three are. */
        '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
      '</div>';
    /* The basket rides above whatever list you are in, not only on the first
       screen. Searching, ticking three things and being unable to see which
       three is the complaint that put it here — a count in the header is not
       an answer to "what have I got". */
    var wrap = function (inner) {
      return '<div class="scrim no-print" data-close="1">' +
        /* mp-sheet, and only this sheet: a column, so the bar along the
           bottom can be pushed to the bottom of a SHORT one. Sticky only ever
           pulls an element up from where the flow put it, and the phone rule
           gives every sheet min-height:100%, so a list of two rows left the
           bar floating mid-card with 438 measured pixels of empty sheet below
           it. Harmless while it was two lines of grey text; not harmless now
           that it is the only way to commit. Nine other sheets share .sheet
           and none of them want this. */
        '<div class="sheet mp-sheet" role="dialog" aria-modal="true" aria-label="Add to ' + esc(name) + '">' +
        head + mMealPickHTML() + inner + mBasketBarHTML() + '</div></div>';
    };

    if (S.mpMode === 'scan') {
      /* One way back, because the three tiles that used to offer it are gone.
         It says where it goes rather than naming a mode nobody chose. */
      return wrap('<button class="mp-back" data-mpmode="home">&lsaquo; Back to the list</button>' +
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

    /* 'look' and 'recipes' are gone. Each was a whole screen that replaced
       the ranked bands with a flat list, and each had its own search box:
       three boxes, three states, and typing in any of them threw away the
       thinking the sheet had done. One box on the resting screen does both
       jobs now, and the section lens that only 'recipes' could offer rides
       the Fits best divider.
     *
       They fall through to home rather than being errors, because S.mpMode
       can still hold either — a phone that reloads mid-session, or an old
       value read back from anywhere. */
    /* Everything that is not the camera. 'look' and 'recipes' used to be two
       more branches here and land in the same place now, which is why this is
       a fall-through rather than a test for 'home': S.mpMode can still hold
       either — a phone that reloads mid-session, an old value read back from
       anywhere — and neither should be an error. */
    {
      /* What is left of the meal, said once at the top. It is the number you
         are shopping against, and it used to be readable only by closing the
         sheet you opened to go shopping. */
      var rem = mMealLeft();
      /* One set, threaded through the bands in the order they are drawn, so
         a dish that is pinned AND recent AND the best fit appears once —
         under the first heading that has a claim on it. */
      /* The answer to a typed number or barcode belongs IN the list, at the
         top of it: it is a result, not a chrome. It sat in a sibling div so
         the keystroke path could repaint it separately, which cost a special
         case in refreshMacroPicker and put it outside the element every other
         row lives in. Rebuilt with the list now, for free. */
      /* Home had no empty state at all: every band returns '' when it has
         nothing, so a query that matches nothing rendered the gap panel and
         the type-it-in row with a silence between them. */
      var body = mpHomeBodyHTML();
      return wrap(
        /* Pinned: what the meal still wants, and the box you search with.
         *
           Blake: "make the top sticky so the filter icons and search bar and
           macros stay in view." All three is 280 px of a 560 px sheet — half
           the screen held still on a list whose whole job is to be scrolled.
           So two of the three. The search box earns it by being the main
           control and the first thing lost to a flick. The pills earn it now
           they count THIS meal: pinned, they fall toward zero as you pick, so
           you can watch the meal close without scrolling back up.

           The shelves are left to scroll. A filter is something you set and
           then read past, and keeping them costs 75 px on every screen to
           save one scroll-up per change of mind. */
        '<div class="mp-stick">' +
        (rem ? '<div class="mp-left">' + rem + '</div>' : '') +
        /* One box, in the sheet you were already looking at. Its results do
           not replace what is under it — the bands narrow and anything else
           the query finds is appended, so the thinking the sheet did for you
           survives being searched. */
        /* The camera sits INSIDE the field rather than beside it. As a flex
           sibling it drops onto its own row on every phone — the narrow rule
           gives .txt flex-basis 100% — and costs another 35px of a header
           that has to earn every pixel. */
        '<div class="mp-controls mp-find">' +
          '<input type="search" class="txt" id="mpFind" ' +
            'placeholder="Search, barcode, or recipe no.&hellip;" ' +
            'aria-label="Search" value="' + esc(S.mpQuery) + '">' +
          (navigator.mediaDevices && navigator.mediaDevices.getUserMedia
            ? '<button class="mp-cam" data-mpmode="scan" aria-label="Scan a barcode">' +
              mpIcon('scan') + '</button>' : '') +
        '</div>' +
        '</div>' +
        mpShelvesHTML() +
        '<div id="mpList">' + body + '</div>' +
        '<button class="mpick-row mpick-new" data-mpnew="1">' +
          '<span class="mp-body"><span class="mp-name">&#43; Type it in yourself</span></span></button>');
    }

  }

  /* What this meal still has room for. mShares works the day's remainder into
     a share per empty meal; this is that share, in the words the plate rows
     already use. */
  /* The DAY, and what the basket would do to it.
   *
     It used to draw this meal against this meal's share. That is gone with
     the chips and the bars on the cards, and for the same reason: a share is
     a planning device, not a thing anybody eats against. You are shopping to
     close the DAY, wherever the food ends up sitting.

     Which also settles an argument this sheet was having with itself. The
     panel spoke one share and the footer under it spoke another, so the top
     invited food the bottom called a bust. There is one number now and both
     halves read it.

     The basket counts before it is committed, because a tick redraws this
     whole sheet — and the bars visibly redrawing WITHOUT moving, while the
     line directly beneath them changed by that same tick, is one gesture
     answered twice with the bigger drawing stale. Whole grams the day is
     still owed, and what the basket would take off that. */
  /* Everything on the day plus everything in the basket, in grams.
   *
     Extracted because the bars and the three-food combo underneath them have
     to be answering the same question. When each worked out the day's
     position for itself the combo could offer food the bars called a bust,
     which is the same argument the panel and the footer used to have. */
  /* Calories are carried, not re-derived.
   *
     4P + 4C + 9F is how a TARGET becomes calories — a target is grams and has
     no other answer. A plate is different: it states its own energy, and that
     is the number mTotals sums for the day bar. Deriving it again here made
     the picker and the day bar disagree about the same day — 1,655 against
     1,554 on an ordinary one, and 250 against nothing at all for a food typed
     in with only its calories, which has no grams to derive from and so was
     invisible to the sheet that exists to say what is left. */
  function mDayEaten(k) {
    var day = mDay(k);
    var sub = { p: 0, f: 0, c: 0, kcal: 0 };
    var addTo = function (r, x) {
      if (!r || !r.macro) return;
      sub.p += (r.macro.p || 0) * x;
      sub.f += (r.macro.f || 0) * x;
      sub.c += (r.macro.c || 0) * x;
      sub.kcal += (r.macro.kcal || 0) * x;
    };
    /* Every meal on the day, not just the one being filled — the gap is the
       day's, and food added here counts against it wherever it lands. */
    Object.keys(day).forEach(function (sk) {
      (day[sk] || []).forEach(function (it) { addTo(BY_ID[it.id], it.x); });
    });
    Object.keys(S.mpBasket).forEach(function (bk) {
      addTo(BY_ID[idOf(bk)], S.mpBasket[bk]);
    });
    return sub;
  }

  /* What the day is still owed, in the pills the day already speaks.
   *
     It was four bars reading "60 / 203 g" — where the day STANDS. Standing
     is the right question for the strip pinned at the top of My Day, and the
     wrong one here: in this sheet you are shopping, and shopping is done
     against what is missing. The subtraction was being done in your head on
     every row.

     Owed, not signed. The day's own pills carry +12 / −47 because the day
     can be over as well as under; a thing you are still owed cannot be
     negative, so it floors at nothing and turns green when there is nothing
     left of it — the same green a landed macro wears everywhere else.

     The basket counts before it is committed. A tick redraws this whole
     sheet, and pills that visibly redrew WITHOUT moving while the line under
     them changed would be one gesture answered twice. */
  /* The label is looked up rather than passed in. It was passed at eight call
     sites, four of them spelling calories as a flame — so when the meal head,
     the plate and the day bars all settled on the word "kcal", this sheet
     went on saying it in an emoji and the app had two spellings again, which
     is the thing that change existed to end. One table, MGAUGE, and nothing
     left to keep in step by hand. */
  /* Kin to the day's pills and now drawn the same way: the NUMBER is the gap
     and the FILL is the proportion, which is exactly the pair the folded day
     row settled on.
   *
     The stylesheet used to argue the opposite — flat tint here, proportional
     fill there, "two different questions should not wear identical clothes".
     The argument was wrong in the same way the folded row's was before it:
     twenty grams of protein reads the same whether it is the whole meal or
     the last mouthful of it, and the fill is the only thing that says which.
     Blake: "make it so that the macro bar at the top of this card works like
     the other pills when crafting meals." */
  function mGapPill(m, got, want, dayT) {
    var done = want > 0 && got >= want, lbl = m;
    MGAUGE.forEach(function (g) { if (g[0] === m) lbl = g[1]; });
    /* The meal card's own rule (mGauge), so one meal cannot be "on" on the
       card and "under" in the sheet opened from it. The comment here used to
       claim exactly that while the code judged by the day bars' band instead
       — a lunch at 80% of its share read on, on, on, on on the card and four
       unders in the sheet. dayT is the day's target for this macro, which the
       card's band is partly relative to. */
    var pct = want > 0 ? Math.min(100, 100 * got / want) : 0;
    var gz = want > 0 ? mGauge(got, want, dayT) : null;
    var state = !gz ? 'quiet' : { u: 'under', o: 'on', x: 'over' }[gz.st];
    /* Both halves, the way the day's pills say them: what is on the meal, and
       what the meal is for. Blake: "those three macros clearly show me how
       much I've selected and what is left. That makes a perfect meal." The
       gap used to be the only figure, which answered the second half and hid
       the first — and a lone "20" cannot say whether that is the whole meal
       or the last mouthful of it. */
    return mFillPill('mgp' + (done ? ' met' : ''), MPILL_TONE[state], pct,
      '<span class="mb-' + m + '">' + lbl + '</span>' +
      '<b>' + Math.round(got) + '</b><u>/' + Math.round(want) + '</u>');
  }

  /* What the MEAL this sheet is filling still wants — not the day's remainder.
   *
     The function was already called mMealLeft and its first two lines read
     mDayTargets and mDayEaten: named for the meal, returning the day. Blake,
     looking at a sheet headed ADD TO SNACKS showing 1745 kcal: "the macro
     pills at the top are for the whole day? why not for the meal I am trying
     to make?" Snacks was asking for 87. Everything else in the sheet was
     already meal-scoped — the ranking, and a section that literally says one
     food that closes Snacks — so the pills were the only thing answering a
     different question, twenty times larger.

     It matters more since the cascade than it would have last week: a meal's
     ask is no longer a fixed slice of the day. Overrun dinner and Snacks is
     asking for less than its plan; share a light breakfast onto it and Snacks
     is asking for more. The day's remainder cannot show either.

     want − got, which is exactly what the meal card's own pills draw, so the
     sheet and the card behind it cannot disagree about the same meal. */
  function mMealLeft() {
    var k = mViewKey();
    var targets = mDayTargets(k);
    if (!targets.p && !targets.f && !targets.c) return '';
    var slots = mReadSlots();
    var sk = S.macroPick && S.macroPick.slot;
    var ask = sk ? mMealAsk(sk, targets, slots) : null;
    var want = ask ? (ask.now || ask.plan) : null;
    if (!want) {
      /* No meal to speak for — the day is the honest fallback, and says so. */
      var dsub = mDayEaten(k);
      return '<div class="mp-cap">The day so far</div>' +
        '<div class="mgps">' +
          mGapPill('kcal', dsub.kcal, kcalOf(targets), kcalOf(targets)) +
          mGapPill('p', dsub.p, targets.p, targets.p) +
          mGapPill('f', dsub.f, targets.f, targets.f) +
          mGapPill('c', dsub.c, targets.c, targets.c) +
        '</div>';
    }
    var got = mMealHolds(k, sk);
    var nm = mSlotOf(slots, sk).n || 'This meal';
    var closed = ['kcal', 'p', 'f', 'c'].every(function (m) {
      return (want[m] || 0) - (got[m] || 0) <= 0;
    });
    return '<div class="mp-cap">' + esc(closed ? nm + ' is closed' : nm + ' so far') + '</div>' +
      '<div class="mgps">' +
        mGapPill('kcal', got.kcal, want.kcal || 0, kcalOf(targets)) +
        mGapPill('p', got.p, want.p || 0, targets.p) +
        mGapPill('f', got.f, want.f || 0, targets.f) +
        mGapPill('c', got.c, want.c || 0, targets.c) +
      '</div>';
  }

  /* Everything already on one meal, plus the basket waiting to join it. The
     basket belongs here and not in the day's version: it is destined for THIS
     meal, so it is what this meal will hold the moment you press Add. */
  function mMealHolds(k, sk) {
    var day = mDay(k);
    var sub = { p: 0, f: 0, c: 0, kcal: 0 };
    var addTo = function (r, x) {
      if (!r || !r.macro) return;
      sub.p += (r.macro.p || 0) * x; sub.f += (r.macro.f || 0) * x;
      sub.c += (r.macro.c || 0) * x; sub.kcal += (r.macro.kcal || 0) * x;
    };
    (day[sk] || []).forEach(function (it) { addTo(BY_ID[it.id], it.x); });
    Object.keys(S.mpBasket).forEach(function (bk) {
      addTo(BY_ID[idOf(bk)], S.mpBasket[bk]);
    });
    return sub;
  }

  /* Three foods that close the day, one per macro.
   *
     A food taking most of its energy from ONE macro is a knob you can turn
     without disturbing the other two, and three such knobs reach any
     combination of P/F/C exactly. That is the whole trick behind "egg
     whites, cheese and salsa" — not a recipe, a basis.

     So this is not a suggestion engine and it is not ranked. It is three
     slots, each holding the day's gap in that one macro, each swappable
     without resizing the meal into something else: walk the protein rung to
     tuna and the cheese and salsa resize around it. Which is why ‹ › sits on
     each row rather than one button re-rolling all three — re-rolling loses
     the one you had already decided about.

     Nothing here is offered when the day is nearly closed. Three foods to
     take off the last four grams is not help.

     Aimed at THIS MEAL's share of the day's gap, not the whole gap. Pointed
     at the day it asked three foods to be a day: every portion pegged at the
     ×4 ceiling — four cans of tuna, four scoops of whey — and still came up
     short, because no three foods are 180 g of protein. The bars measure the
     day; a plate is still a meal. */
  var MCOMBO_MIN = 10;                  // grams of gap worth three foods
  var MMAC_WORD = { p: 'protein', f: 'fat', c: 'carbohydrate' };

  function mComboSlotName() {
    var slots = mReadSlots(), sk = S.macroPick && S.macroPick.slot;
    var nm = slots.names[sk] || 'this meal';
    slots.list.forEach(function (sl) { if (sl.k === sk) nm = sl.n; });
    return nm;
  }

  function mComboGap(k) {
    var targets = mDayTargets(k);
    if (!targets.p && !targets.f && !targets.c) return null;
    var slot = null;
    mReadSlots().list.forEach(function (sl) {
      if (sl.k === (S.macroPick && S.macroPick.slot)) slot = sl;
    });
    /* The SAME question the header above it asks, from the same two numbers.
     *
       This used to read mShares(...).T — the meal's static slice of the day —
       and subtract only the basket, never what was already on the plate. So a
       meal the header had just called closed still had a full share of gap
       down here, and the band offered a food to close something with nothing
       left in it. Blake's screenshot: BREAKFAST IS CLOSED, four zero pills,
       and under them "one food that closes breakfast: tuna steak".
     *
       mMealAsk is also the cascade-aware number, which mShares is not: overrun
       dinner and this meal is owed less than its slice; share a light
       breakfast onto it and it is owed more. The header has read that all
       along. This is the argument the panel and the footer already had, in a
       new place — one question, one source.
     *
       mMealHolds counts the basket along with the plate, so there is nothing
       further to subtract here. */
    var sk2 = S.macroPick && S.macroPick.slot;
    if (!sk2) return null;
    var ask2 = mMealAsk(sk2, targets, mReadSlots());
    var want2 = ask2 ? (ask2.now || ask2.plan) : null;
    if (!want2) return null;
    var got2 = mMealHolds(k, sk2);
    var gap = {};
    ['p', 'f', 'c'].forEach(function (m) {
      gap[m] = Math.max(0, (want2[m] || 0) - (got2[m] || 0));
    });
    /* The ask rides along so the band can tell a top-up from a whole meal. */
    gap.askK = kcalOf({ p: want2.p || 0, f: want2.f || 0, c: want2.c || 0 });
    gap.gapK = kcalOf({ p: gap.p, f: gap.f, c: gap.c });
    return gap;
  }

  /* The foods that close this meal, as rows in the list rather than a panel
     of their own.
   *
     They used to be a widget above everything: a caption, up to three rows
     with a pair of arrows each for cycling alternatives, a macro summary line
     and an "Add all three" button. That is a second way to read a food and a
     second way to add one, sitting on top of the list that already does both
     — and it pushed the list itself most of a screen down. Blake: "instead of
     the three foods that close the day, just put them in my suggested foods
     area."
   *
     So they are ordinary picker rows now: same tick, same portion, same tap
     into the basket. What goes with the panel is the cycling and the add-all,
     and neither is missed — the basket already accumulates and the bar along
     the bottom already totals what it will add.
   *
     Drawn before Fits best and marked into `shown`, so a food that closes the
     meal is never offered again further down at a different portion. */
  function mpComboHTML(shown) {
    var k = mViewKey();
    var gap = mComboGap(k);
    if (!gap) return '';
    if (gap.p + gap.f + gap.c < MCOMBO_MIN) return '';
    var combo = mComboFor(gap, { p: 0, f: 0, c: 0 }, S.macroPick && S.macroPick.slot);
    if (!combo || !combo.length) return '';
    /* Anything a band above already drew keeps its first heading, and the
       count in this one follows what is actually left to draw — the panel
       used to say "Three" over two rows, which is the same bug in its own
       shape. */
    var fresh = combo.filter(function (c) {
      return !(shown && shown[c.r.id]) && mpMatches(c.r, mpQ());
    });
    if (!fresh.length) return '';
    fresh.forEach(function (c) { if (shown) shown[c.r.id] = 1; });
    var rows = fresh.map(function (c) { return mpRowHTML(c.r, c.x); }).join('');
    var nWord = ['', 'One', 'Two', 'Three'][fresh.length] || String(fresh.length);
    return '<div class="mt-div">' + nWord +
      (fresh.length === 1 ? ' food that closes ' : ' foods that close ') +
      esc(mComboSlotName().toLowerCase()) + '</div>' + rows;
  }

  /* What the box was asked, when what was typed is not a name.
   *
     A recipe number is the fastest way in that exists, and it was not wired
     to anything. Every recipe in the two printed volumes carries one — "No.
     142" on the card, on the page and in the contents — so a person standing
     over the open book already has the answer in front of them and had to
     type its title instead.

     Books 1 and 2 only, deliberately. The Ours shelf gets its numbers
     assigned at boot (`if (r.book === 3) r.no = ++n`), starting again at 1,
     so Ours No. 1 and the printed No. 1 are two different dishes wearing the
     same badge. Only one of those numbers is printed on a page, and that is
     the one somebody is reading off.

     Eight digits or more is nobody's recipe number; it is a barcode, and the
     scanner already knows what to do with one. Typing it is the same act as
     pointing a camera at it, so it gets the same answer. */
  function mQueryKind(q) {
    var t = String(q || '').trim();
    if (/^[0-9]{8,}$/.test(t)) return { k: 'barcode', v: t };
    if (/^[0-9]{1,3}$/.test(t)) return { k: 'no', v: parseInt(t, 10) };
    return { k: 'text', v: t };
  }

  function mNumberHit(n) {
    var hit = null;
    RECIPES.forEach(function (r) {
      /* Ours numbers are not printed on anything, so they are not what a
         person reading a number off a page has typed.
       *
         Honest note: this clause is belt-and-braces, not the thing doing the
         work. rebuild() lays the printed books down first and pushes the
         shelf after, so first-match already answers with the printed one —
         deleting this line leaves the suite green, which is how that was
         found out. It stays because it states the rule; if the order ever
         changes it becomes the rule. */
      if (hit || r.book === 3) return;
      if (Number(r.no || r.id) === n) hit = r;
    });
    return hit;
  }

  /* The band that answers a number, drawn above whatever the list was going
     to say. It does not replace the list: the number may be a typo, and a
     picker that goes blank on a mistyped digit is worse than one that shows
     you the recipe you meant plus everything else. */
  function mQueryTopHTML(q, day, targets, pick) {
    var kind = mQueryKind(q);
    if (kind.k === 'barcode') {
      return '<div class="mt-div">Barcode</div>' +
        '<button class="mpick-row mpick-new" data-nfcode="' + esc(kind.v) + '">' +
          '<span class="mp-body"><span class="mp-name">Look up ' + esc(kind.v) + '</span>' +
          '</span></button>';
    }
    if (kind.k !== 'no') return '';
    var r = mNumberHit(kind.v);
    if (!r) return '';
    var e = mRank([r], day, targets, pick)[0];
    return '<div class="mt-div">Recipe no. ' + esc(String(kind.v)) + '</div>' +
      mpRowHTML(r, e ? e.x : 1, e && e.score === null ? 'no data'
        : '&times;' + fmtNum(e ? e.x : 1) + ' &middot; ' + mMacLine(r, e ? e.x : 1, true) +
          mSaltNote(r, e ? e.x : 1));
  }

  /* One box, one list. Your own foods and the book's recipes together, each
     saying where it came from, because "do I already have this?" and "what
     does the USDA call it?" are the same question asked once. The food
     tables answer underneath, when they answer. */
  /* Which macro a food IS, by where its calories come from — not by grams.
     A cup of milk carries more grams of carbohydrate than fat and is not a
     carbohydrate. Unlike the lever bench this classes EVERYTHING, purity
     floor or not: a food has to land in one of the three groups or it is
     missing from a list whose whole job is to be browsable. */
  function mFoodDom(r) {
    var m = r && r.macro;
    if (!m) return null;
    var kp = (m.p || 0) * 4, kf = (m.f || 0) * 9, kc = (m.c || 0) * 4;
    if (!(kp + kf + kc > 0)) return null;
    return { d: kp >= kf && kp >= kc ? 'p' : (kf >= kc ? 'f' : 'c'),
      pur: Math.max(kp, kf, kc) / (kp + kf + kc) };
  }

  /* The shelves a food can sit on, in the order a cut cares about.
   *
     Not the same question as "which macro is this mostly", which is what
     mFoodDom answers. A shelf is where you would REACH for a thing: fruit
     and starch are both carbohydrate and you go looking for them in
     different moods, and 🥦 Veggies only means anything if it means the
     things you can eat a lot of — which is why potatoes and corn are
     shelved with the cereal.

     The first four flags win where a food has one; everything else falls
     through to whichever macro carries its calories. */
  var MSHELF = [
    ['protein', '\uD83E\uDD69', 'Protein'],
    ['veg',     '\uD83E\uDD66', 'Veggies'],
    ['fruit',   '\uD83C\uDF4E', 'Fruit'],
    ['starch',  '\uD83E\uDD56', 'Starch'],
    ['carb',    '\uD83C\uDF5A', 'Carbs'],
    ['fat',     '\uD83E\uDD51', 'Fats'],
    ['dairy',   '\uD83E\uDDC0', 'Dairy'],
    ['oil',     '\uD83E\uDED2', 'Oils'],
  ];
  var MSHELF_NAME = {}, MSHELF_EMO = {};
  MSHELF.forEach(function (s) { MSHELF_EMO[s[0]] = s[1]; MSHELF_NAME[s[0]] = s[2]; });

  var MDAIRY = ['milk', 'cheddar', 'parmesan', 'cottage_cheese', 'cream_cheese',
    'sour_cream', 'yogurt', 'egg'];
  var MOILY = ['oil', 'butter', 'mayo', 'ranch', 'peanut_butter'];
  var MFRUIT = ['apple', 'banana', 'orange', 'grape', 'peaches_canned',
    'pears_canned', 'applesauce', 'fruit', 'raisin'];

  /* Which shelf a thing sits on.
   *
     RECIPES TOO, not just single foods. It used to return '' for anything
     without a food flag, which was every one of the 316 — so a rail built on
     it would have hidden the entire book behind any chip. A dish is shelved
     by the macro its calories come from, which is the same question
     mFoodDom answers and the only one that can be asked of a plate: there is
     no sense in which a chicken casserole is "on the vegetable shelf".
   *
     Foods get the finer answer, because a cook reaches for them differently:
     fruit and starch are both carbohydrate and you go looking for them in
     different moods.
   *
     `shelf` on the food beats the prefix lists below it. Those lists match
     the START of a key, which worked while the table was the storehouse
     order and broke the moment it grew: thirteen new fruits landed under
     Carbs because no entry began with "apple" or "grape". The lists stay for
     the storehouse keys they were written for; anything new says what it is
     instead of hoping its name starts with the right word. */
  function mShelfKey(r) {
    if (!r) return '';
    var d = mFoodDom(r);
    var byMacro = d ? ({ p: 'protein', f: 'fat', c: 'carb' })[d.d] : '';
    if (!r.food) return byMacro;
    if (r.shelf) return r.shelf;
    var k = String(r.id).indexOf('f:') === 0 ? String(r.id).slice(2) : String(r.id);
    var starts = function (list) {
      var hit = false;
      list.forEach(function (v) { if (k === v || k.indexOf(v) === 0) hit = true; });
      return hit;
    };
    if (r.veg) return 'veg';
    if (r.starch) return 'starch';
    if (starts(MFRUIT)) return 'fruit';
    if (starts(MOILY)) return 'oil';
    if (starts(MDAIRY)) return 'dairy';
    return byMacro;
  }

  var MDOM_HEAD = [['p', 'Protein'], ['c', 'Carbs'], ['f', 'Fats']];

  /* Every food you can eat as it comes, under the macro it is for.
   *
     Look up opened on a blank screen: a search box, and nothing until you
     already knew the word. The thing you want at seven in the morning is not
     a word, it is "show me the protein" — so that is what is under the box
     now, in the order a cut cares about. Protein first because it is the one
     to hit; fats last because they are what closes a plate rather than
     starts one.

     Grouped headings rather than tabs or a filter, because both of those are
     a tap to see a list that could simply have been there, and neither fills
     the empty screen that was the actual complaint.

     Ordered inside each group the way the combo's rungs are: something you
     would eat before something that goes ON food, then by how cleanly it
     carries its macro. Same rule in both places on purpose. */



  /* Only the list under the search box redraws while you type — redrawing the
     sheet would fight the cursor for the input. refreshPreview() set the
     pattern. */
  /* The way to a food the storehouse has never heard of.
   *
     The live lookup has been in here all along — it is what fills a packet's
     numbers in from the USDA — but the only thing that ever called it was the
     search box inside the "Look up" tile, and the tiles went in v283. The
     function survived; the door did not. So typing a food the book does not
     stock ended at "Nothing matches american cheese." with the one thing that
     could have answered it sitting a function call away, and the app looked
     like it had lost a feature it had merely stopped offering.
   *
     A row rather than an automatic fetch: the tables are somebody else's
     server and every keystroke is not a question. Three characters because
     that is what the old box asked for, and a barcode is left to mQueryTopHTML
     — it already offers that one, and two rows saying "look this up" is the
     tile problem coming back in miniature. */
  function mpLookFootHTML() {
    var q = S.mpQuery.trim();
    if (q.length < 3 || mQueryKind(q).k === 'barcode') return '';
    /* The row that asked is gone; the fetch happens on its own now. Blake:
       "when I do a food search, why doesn't it automatically show me foods
       from the database that are best matches?" — and the note on the input
       handler had described exactly that all along ("they answer when they
       answer, underneath, and only once you have stopped typing long enough
       to mean it") without anything ever calling mLookNet but a button.
     *
       The objection the button existed for is real and is answered by the
       debounce rather than by a tap: somebody else's server sees one request
       per word you finish, not one per keystroke. mLookNet already drops
       late replies, so a slow answer to "tam" cannot land on top of the
       results for "tamale". The retry lives in the failure text. */
    return '<div id="nfResults"></div>';
  }

  /* The home list, in ONE place.
   *
     It was composed twice — once when the sheet is drawn and once on every
     keystroke — and the two copies are exactly the kind of pair this app has
     been bitten by all week: they have to agree, nothing makes them, and a
     row added to one is a row missing from the other for as long as nobody
     notices. */
  function mpHomeBodyHTML() {
    var shown = {};
    /* Composed in one order and PRINTED in another, and the difference is
       load-bearing.
     *
       `shown` is claimed in composition order, so whichever band runs first
       owns a dish and the ones after it step over. The closers have to run
       before Fits best or Fits best would list the very foods that close the
       meal and leave the band with nothing to say.
     *
       But on screen it is the other way round. Blake: "real food then macro
       fill/math suggestions". An untouched meal opening on three single foods
       put the arithmetic above the cooking — the recipes are what a meal
       actually is, and they were a quarter of a phone screen further down
       than the levers that close it. So the claim order is unchanged and the
       output order is reversed, which costs nothing and moves the dishes up.
     *
       The alternative was suppressing the closers on an untouched meal, and
       it was worse: it deleted a three-tap way to land the macros exactly, on
       the one screen where somebody eating to a number wants it most. */
    var named = mpNamedHTML(shown);
    var pins = mpPinsHTML(shown);
    var recent = mpRecentHTML(shown);
    var closers = mpComboHTML(shown);
    var fits = mpFitsHTML(shown);
    var body = named + pins + recent + fits + closers + mpElseHTML(shown);
    /* Judged on the ROWS, not on the string. A barcode with nothing behind it
       draws a band and no rows, and so does a shelf crossed with a lens that
       has nothing in it — and the Fits band now keeps its divider either way,
       because the lens and the order live on it and they are the way back out
       of the thing that emptied the list. Counting characters would read
       either of those as a list with something in it. Every band writes the
       rows it drew into `shown`, so that is the count. */
    if (!Object.keys(shown).length) {
      body += '<div class="mslot-empty">' + (mpQ()
        ? 'Nothing matches ' + esc(S.mpQuery.trim()) + '.'
        : S.mpShelf || S.mpSec !== 'meal'
          ? 'Nothing here in this lens.'
          : 'Nothing to offer for this meal yet.') + '</div>';
    }
    return mQueryTopHTML(S.mpQuery, mDay(mViewKey()), mDayTargets(mViewKey()),
      { k: S.macroPick.slot, w: S.macroPick.w }) + body + mpLookFootHTML();
  }

  /* Rebuilds ONLY the list, never the sheet.
   *
     This is what keeps the search box alive across a keystroke: the input is
     a sibling of #mpList, not inside it, so replacing the list cannot take
     the focus or the caret with it. A renderModal here would redraw the box
     mid-word.
   *
     Dispatches on mode because #mpList now exists in two of them and holds
     different things: the resting screen's four narrowed bands, or the
     Recipes lens's own ranked list. */
  /* The rail follows the query, and nothing else.
   *
     refreshMacroPicker rebuilds ONLY the list — that is what keeps the search
     box alive across a keystroke — so the chips went on describing the pool
     as it was before you typed. They are rebuilt here when the query changes
     and only then: a chip press re-renders the list too, and rebuilding the
     rail under a thumb that has just pressed one would take the press with
     it. The rail remembers what it was built for, so the comparison lives on
     the element rather than in a variable that can go stale behind a sheet
     being closed and opened. */
  function mRailSync() {
    var rail = $('mpShelves');
    if (!rail) return;
    var q = mpQ();
    if (rail.getAttribute('data-q') === q) return;
    keepingFocus(function () {
      var tmp = document.createElement('div');
      tmp.innerHTML = mpShelvesHTML();
      var next = tmp.firstChild;
      if (!next) return;
      next.setAttribute('data-q', q);
      rail.parentNode.replaceChild(next, rail);
    });
  }

  function refreshMacroPicker() {
    var el = $('mpList');
    if (!el) return;
    mRailSync();

    el.innerHTML = mpHomeBodyHTML();
  }

  /* Which plan the four buttons describe. Read by the sheet and by the tests,
     which hold every key against a button rather than keeping their own copy. */
  /* Named by what happens to you, not by what a gym calls it. "Hard cut",
     "Steady cut", "Maintain" and "Lean gain" were four pieces of vocabulary
     that explain themselves only to somebody who has already been told what
     they mean, sitting on the one screen a newcomer cannot get past. */
  var MGOAL_WORDS = {
    cut2: 'Lose weight quickly', cut1: 'Lose weight steadily',
    keep: 'Stay about where I am', gain: 'Put weight on slowly'
  };

  /* The status line over the gram boxes. The boxes are the plan's one
     rendering, so this speaks only when something needs saying: the profile
     cannot compute yet, or the arithmetic had to floor the carbs. */
  /* One fact, no lecture attached: a hard cut runs below the rate a body
     spends doing nothing. Worth knowing you are there; not the app's business
     to argue about it. */
  function mtPlanLine(plan, pr) {
    if (!plan) return 'Fill in who you are.';
    /* The real basal rate, not tdee/act — which is only the basal rate when
       the activity dial is what built the tdee, and is not on the told path.
       This line is the one place the plan says it is under what a body spends
       lying still, so it has to be under the right number. */
    var b = pr ? mBurn(pr) : null;
    var bmr = b ? b.bmr : null;
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
          '<button class="ghost" data-mysync="out">Sign out of this device</button></div>' +
        /* Signing out leaves everything where it is; this does not, and the two
           sit next to each other, so it says which is which. */
        '<div class="sync-row sync-note">' +
          '<a href="privacy/" target="_blank" rel="noopener">What is stored, and where</a></div>' +
        '<details class="sync-fold"><summary>Delete my account</summary>' +
          '<p class="sync-note">Removes your weigh-ins, your food log, your plan ' +
            'and any foods you added, from this device and from the account. ' +
            'It cannot be undone, and it does not touch a shared plan you are ' +
            'joined to \u2014 that belongs to the household, not to you.</p>' +
          '<div class="sync-row">' +
            '<button class="ghost danger" data-mysync="delete">Delete my account</button>' +
          '</div>' +
        '</details>';
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
  var mLookSeq = 0;
  /* One request per word you finish typing, not one per keystroke.
   *
     600ms because it has to outlast the gap between two letters typed by a
     thumb and not feel like a pause. The query is re-read when the timer
     fires rather than captured when it is set, so backspacing to something
     shorter than three characters cancels the request that was in flight for
     the longer one. */
  var mpLookTimer = null;
  function mpLookSoon() {
    if (mpLookTimer) clearTimeout(mpLookTimer);
    mpLookTimer = setTimeout(function () {
      mpLookTimer = null;
      if (!S.macroPick) return;                    // the sheet closed under it
      var q = (S.mpQuery || '').trim();
      if (q.length < 3 || mQueryKind(q).k === 'barcode') return;
      if (!$('nfResults')) return;                 // nothing on screen wants it
      mLookNet(q);
    }, 600);
  }

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
            : 'The food tables did not answer.') + '</div>' +
        /* The one place a tap is still the right answer: the network failed
           and only you know whether it is worth asking again. */
        (err && err.message === 'nokey' ? ''
          : '<button class="mpick-row mpick-new" data-mplook="' + esc(term) +
            '"><span class="mp-body"><span class="mp-name">Try the food tables again' +
            '</span></span></button>');
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

  /* `typed` means a human handed this over rather than a camera frame
     decoding it.
   *
     The mCam guard is here to ignore a late decode arriving after the camera
     has been stopped, which is the only thing that can call this without
     being asked. A barcode typed into the picker is asked for — and it was
     being thrown away by that guard, because nothing had started a camera.
     Worse, it was thrown away even WITH one: the handler renders the scan
     sheet and calls straight through, while mScanStart only sets mCam once
     getUserMedia has resolved, so mCam is still null on the next line. That
     row has not worked since it was added. */
  function mScanGot(code, typed) {
    if (!code || (!typed && !mCam)) return;
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
  /* The burn the plan is built on, written as a fact like the four above it.
     It used to sit below them in the EDITOR's row language — a ledger row
     with a rule under it, and a filled green pill for the only saturated
     colour on a page of quiet type. The rule fell between the number and
     the caption explaining it, so the evidence read as a heading for the
     cards below rather than as a note on the row above.

     It also showed the measured figure whether or not the plan used it, and
     said which in a pill. The row states the number the plan is ACTUALLY
     built on now, and the caption underneath carries the other one and the
     tap that switches. */
  function mMeasuredRowHTML(pr) {
    var m = mMeasuredTdee();
    if (!m) return '';
    var on = !!pr.useTdee;
    var formula = mBurn(pr);
    var other = formula ? Math.round(formula.tdee) : null;
    /* Nothing to offer and nothing to compare against: without the formula
       there is one number, and a switch to nowhere is worse than no switch. */
    if (!other) return '';
    var used = on ? m.tdee : other;
    /* The caption says where the number in use came from; the tap beside it
       names the number it would switch to. Neither repeats the other, so
       both fit on two lines beside each other at 390px. */
    var cap = on
      ? 'From ' + m.days + ' days: ' + m.eaten.toLocaleString() + ' kcal a day, ' +
        (m.lb === 0 ? 'no change on the scale' : mLbWord(m.lb)) + '.'
      : 'By the formula, from your size and how you move.';
    return '<div class="mt-burn">' +
      '<div class="mtf-row"><span>Burning</span><b>' +
        used.toLocaleString() + ' kcal a day</b></div>' +
      '<div class="mt-burn-c"><span>' + cap + '</span>' +
        '<button class="mt-swap" data-mtdee="' + (on ? '0' : '1') + '">Use ' +
          (on ? 'the formula&rsquo;s ' + other.toLocaleString()
              : 'the measured ' + m.tdee.toLocaleString()) +
        '</button></div>' +
    '</div>';
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
    } else if (mVerdict('kcal', s.got, s.want) === 'on' && mVerdict('p', s.rows[0].got, s.rows[0].want) === 'on') {
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
    /* The bars' verdict, not one of its own: this ring went red at 105%
       over a bar that called the same day on target, under a line that said
       "Close enough". */
    var dayV = mVerdict('kcal', s.got, s.want);
    var ringCol = dayV === 'over' ? 'var(--dial-over)' : dayV === 'under' ? 'var(--ochre)' : 'var(--green)';
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
        (w.v === 'over' ? ' over' : '') + '" title="' + esc(w.k) + ' — ' +
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
                mVerdict('kcal', s.got, s.want) + '">' +
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
        '<div class="sync-row"><button class="btn-primary sheet-done">Done</button></div>' +
      '</div>' +
    '</div>';
  }

  function macroTargetsHTML() {
    var t = mReadTargets();
    var pr = mReadProfile();
    var plan = mPlanCalc(pr);
    /* With nothing stored the DAY shows no plan and says so — but this is the
       sheet where a plan gets made, so it opens on the one the profile works
       out to rather than on three zeros. Proposing is not asserting: nothing
       is written until Save, and with no profile to work from there is still
       nothing to propose and the boxes stay empty.
     *
       Without this the boxes read 0/0/0 and Save stored three zeros, which
       then came back out of mReadTargets repaired to a real plan by the
       below-the-floor correction — the right numbers arriving by accident,
       from a screen that had shown the wrong ones. */
    if (!kcalOf(t) && plan) t = { p: plan.p, f: plan.f, c: plan.c };
    /* A ledger row: what it is on the left, what it says on the right. One
       fact per line, values right-aligned into a column — the arrangement
       that cannot wrap the way a row of labelled boxes wraps on a phone. */
    var row = function (label, valueHTML, stack) {
      return '<div class="mtl-row' + (stack ? ' stack' : '') + '">' +
        '<span class="mtl-lab">' + label + '</span>' +
        '<span class="mtl-val">' + valueHTML + '</span></div>';
    };
    var box = function (id, v, unit) {
      /* Unanswered is not zero. On a first visit nine of these read 0 before
         the reader had typed anything — an answer stated where there is none,
         and the worse of the two on a phone besides: tap a box holding 0,
         type 43, and you get 043. Blank until there is something to say.

         Only while there is no plan. Once one exists a 0 is a real answer —
         six foot nothing is a height — and blanking it would be the same
         mistake pointed the other way. */
      var blank = !v && !plan;
      return '<input type="number" id="' + id + '" min="0" max="999" step="1" inputmode="numeric" value="' +
        (blank ? '' : (v || v === 0 ? v : '')) + '">' + (unit ? '<span class="mtl-u">' + unit + '</span>' : '');
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
    /* The form in the groups a first-timer is asked them in.
     *
       Named pieces rather than one run of string, because the same rows have
       to make two shapes: four steps on a first run, and one scrolling sheet
       every time after that. The wording lives here and only here, so neither
       shape owns it.

       Every id is the id it has always had, and that is load-bearing:
       mtProfileFromDom reads the whole form out of the live DOM in one pass
       and falls back to storage for anything it cannot find. A field that is
       off-screen must therefore still be IN the document, or the plan is
       computed from zeros for every question not currently showing. The
       wizard hides steps. It never removes them. */
    var cap = function (s) { return '<div class="mt-cap">' + s + '</div>'; };

    /* The rows, without captions. Blake: "I want simplicity and intelligent
       outputs with few clicks" — the sentence under every field was the
       first thing to go, in both shapes of this sheet. The ids are the ids:
       the wizard and the one-screen editor are never on the page together,
       so the same id in both is one element either way, and
       mtProfileFromDom reads it the same. */
    var bfNow = mBodyFat(pr);
    var rowsAbout =
      row('You are', seg('mtsex', pr.sex, [['m', 'Male'], ['f', 'Female']])) +
      row('Age', box('mtAge', pr.age, 'years')) +
      row('Height', box('mtFt', pr.ft, 'ft') + box('mtIn', pr.inch, 'in')) +
      /* Asked for only until the scale can answer. Two boxes for one number is
         how they came to disagree; once there are mornings in the log this
         states what they say instead of inviting a second opinion nothing
         would ever read. */
      row('Weight today', mScaleLb()
        ? '<span class="mtl-fact">' + mScaleLb() + '</span>' +
          '<span class="mtl-u">lb &middot; from your weigh-ins</span>'
        : box('mtLb', pr.lb, 'lb')) +
      /* Estimated from the three answers above, and stated as an estimate:
         the formula carries about four points of error either way, which is
         the difference between a fair ceiling and a wrong one on a lean
         frame. Typing a measured one replaces it. */
      row('Body fat <span class="mtl-opt">(optional)</span>',
        box('mtBf', pr.bf, '%') +
        (bfNow && !bfNow.told
          ? '<span class="mtl-u">about ' + bfNow.pct + '% estimated</span>' : ''));
    /* Three words for the day's activity instead of a five-line dropdown
       that was cut off mid-word on a phone. The workouts asked next carry
       the training; this is only the job. The select every other reader of
       the profile knows stays in the document, hidden, and the three
       buttons set it. */
    var ACT3 = [[1.2, 'At a desk'], [1.375, 'On my feet'], [1.55, 'Active job']];
    var rowsMove =
      row('A normal day, you are mostly', seg('mtact', mtActNear(pr.act), ACT3), true) +
      '<select id="mtAct" class="hide" aria-hidden="true" tabindex="-1">' + acts.map(function (a) {
        return '<option value="' + a[0] + '"' + (mtActNear(pr.act) === a[0] ? ' selected' : '') + '>' + a[1] + '</option>';
      }).join('') + '</select>' +
      row('Workouts a week', '<span class="mt-stepper">' +
        '<button type="button" data-mtwk="-1" aria-label="One fewer">&minus;</button>' +
        box('mtWorkouts', pr.workouts, '') +
        '<button type="button" data-mtwk="1" aria-label="One more">+</button></span>') +
      row('Steps a day <span class="mtl-opt">(optional)</span>',
        '<input type="number" id="mtSteps" min="0" max="99999" step="500" ' +
        'inputmode="numeric" value="' + (pr.steps || '') + '">');
    /* Which days those workouts fall on. Spread from the number above until
       you say otherwise, and then held as a list of its own so changing the
       number does not rearrange days set by hand. */
    var rowDays = row('Which days?', mTrainRowHTML());
    var fold = function (title, inner, open) {
      return '<details class="mt-fold"' + (open ? ' open' : '') + '><summary>' + title + '</summary>' + inner + '</details>';
    };

    /* The four kinds, as a stack that has room to say what each one does
       rather than four words in a row that do not.
     *
       "Hard cut", "Steady cut", "Maintain", "Lean gain" were four pieces of
       gym vocabulary on controls that explain themselves to nobody who has
       not already been told. The data attributes are unchanged, so every
       handler and test that presses one still finds it.

       With a weight and a date named, these are along for the ride — pressing
       them used to do nothing at all, silently, which is the worst thing a
       control can do. They go properly inert and say who is in charge. */
    var goalPick = function (val, title, what) {
      var on = pr.goal === val, off = !!mGoalPace(pr);
      return '<button class="mt-pick' + (on ? ' on' : '') + '" data-mtgoal="' + val + '"' +
        ' aria-pressed="' + String(on) + '"' + (off ? ' disabled' : '') + '>' +
        '<b>' + title + '</b><span>' + what + '</span></button>';
    };
    /* In three named pieces, because the wizard folds the second behind a
       tap and leaves the third out: the picks, the weight-and-date pace, and
       the coach's lines. One sentence under each card — Blake asked for
       simplicity, and the second sentence was a lecture. */
    var goalPicksHTML =
      '<div class="mt-picks' + (mGoalPace(pr) ? ' spent' : '') + '" id="mtGoalSeg">' +
        goalPick('cut2', MGOAL_WORDS.cut2, 'About 1&frac12; lb a week. Hard to keep up for long.') +
        goalPick('cut1', MGOAL_WORDS.cut1, 'About 1 lb a week. The pace most people finish.') +
        goalPick('keep', MGOAL_WORDS.keep, 'Eat what you burn.') +
        goalPick('gain', MGOAL_WORDS.gain, 'About &frac12; lb a week.') +
        '<button class="ghost mt-byfeel" data-mtfree="1">A weight and a date are setting your pace &mdash; ' +
          'choose one of these instead</button>' +
      '</div>';
    var goalPaceHTML =
      row('What weight would you like to reach?', box('mtGoalLb', pr.goalLb, 'lb')) +
      row('When would you like to get there?',
        '<input type="date" id="mtGoalBy" value="' + esc(pr.goalBy || '') + '">') +
      '<div class="mt-cap" id="mtGoalNote">' + mGoalNote(pr) + '</div>';
    var qGoal = goalPicksHTML + goalPaceHTML + '<div id="mtCoach">' + mCoachHTML(pr) + '</div>';

    /* What Fill is allowed to shop from. The books are written to be cooked
       out of the storehouse order, and a day drafted from salmon and almonds
       is not a day if there is no salmon in the house. But Blake will happily
       stop at a shop on the way home, and said so — so it is a question with
       two honest answers rather than a rule. Storehouse-only is the default
       because it is the one that cannot surprise you.

       Searching and logging an outside food is never gated. Looking one up is
       how you decide to go and buy it. */
    var qPrefs =
      row('Should Nourish only suggest storehouse food?',
        seg('mtext', pr.extFill ? '1' : '0', [['0', 'Yes'], ['1', 'No']]));

    /* The boxes are the plan's one rendering: they follow the profile, take a
       hand edit, and Save keeps whatever they say. */
    var qGrams =
      '<div class="mt-cap" id="mtPlan">' + mtPlanLine(plan) + '</div>' +
      row('Protein', box('mtP', t.p, 'g')) +
      row('Fat', box('mtF', t.f, 'g')) +
      row('Carbs', box('mtC', t.c, 'g')) +
      '<div class="mtl-row mtl-sum"><span class="mtl-lab">That is a day of</span>' +
        '<span class="mtl-val" id="mtKcal">' + (kcalOf(t) ? '= ' + kcalOf(t) + ' kcal' : '—') + '</span></div>';

    /* Open on the answer, not on the form. A profile that cannot compute yet
       has no answer to show, so a first run gets the wizard instead — the same
       rows, asked four at a time, each group answering before the next is put. */
    var shut = plan ? ' hide' : '';

    var answerHTML =
      '<div class="mt-answer">' +
        '<div class="mt-big"><span id="mtBigKcal">' + mtDash(kcalOf(t)) + '</span>' +
          '<small>calories a day</small></div>' +
        '<div class="mt-tiles">' +
          '<span class="mt-tile"><b id="mtTileP">' + mtDash(t.p) + '</b><i>Protein</i></span>' +
          '<span class="mt-tile"><b id="mtTileF">' + mtDash(t.f) + '</b><i>Fat</i></span>' +
          '<span class="mt-tile"><b id="mtTileC">' + mtDash(t.c) + '</b><i>Carbs</i></span>' +
        '</div>' +
      '</div>';

    /* The goal belongs under the number it produced, not over it as a display
       line. A sentence in the book's largest serif, where every other sheet
       carries a title, read as a title filled in wrong. */
    /* The handle on the profile fold. It used to carry the goal in the
       book's caption face with the profile beneath it. The goal is a fact in
       the ledger now — said once — so what is left on the handle is the
       fold's name and the answers it is hiding. */
    var whoHTML =
      '<button class="mt-who" data-mtedit="1" aria-expanded="' + (plan ? 'false' : 'true') +
        '" aria-controls="mtEditor">' +
        '<span class="mt-whotext">' +
          '<span class="mt-foldname">About you</span>' +
          '<span id="mtWho">' + mtWhoLine(pr) + '</span>' +
        '</span>' +
        '<span class="mt-editw">Edit</span>' +
      '</button>';

    /* And the handle on the meals fold. Six rows of five controls each took
       about three fifths of a screen you set once and then read for a year.
       It folds to the one line anybody opens it to check, and opens to
       exactly what was there before. */
    var mealHeadFor = function (open) {
      return '<button class="mt-who" data-mtmfold="1" aria-expanded="' + (open ? 'true' : 'false') +
        '" aria-controls="mtMealsWrap">' +
        '<span class="mt-whotext">' +
          '<span class="mt-foldname">The day&rsquo;s meals</span>' +
          '<span id="mtMealSum">' + mtMealSumHTML() + '</span>' +
        '</span>' +
        '<span class="mt-editw">Edit</span>' +
      '</button>';
    };
    var mealsFor = function (open) {
      return '<div id="mtMealsWrap" class="mt-editor' + (open ? '' : ' hide') + '">' +
        '<div class="mt-cap">The kind steers the picker; the share is each meal&rsquo;s slice of the day.</div>' +
        '<div id="mtMeals">' + mReadSlots().list.map(mtMealRow).join('') + '</div>' +
        '<div class="mtm-total" id="mtmTotal"></div>' +
        '<div class="sync-row"><button class="ghost" data-mtmeal="add">+ Add a meal</button></div>' +
      '</div>';
    };
    var mealHeadHTML = mealHeadFor(!plan);
    var mealsHTML = mealsFor(!plan);

    /* One Save, and it belongs to whichever fold is open rather than sitting
       at the foot of a form nobody was filling in. A screen you are only
       reading has nothing to commit, and a button that commits what you have
       not touched will eventually commit something you did not mean. */
    var saveHTML = function (hid) {
      return '<div class="sync-row mt-save' + (hid ? ' hide' : '') + '" id="mtSave">' +
        '<button class="btn-primary" data-mtarg="save">Save</button>' +
        '<button class="ghost" data-mtarg="cancel">Cancel</button>' +
      '</div>';
    };

    /* The one place the tab explains itself, folded away. It used to be a
       paragraph on the daily screen behind a ?, which is a paragraph in front
       of somebody who has read it forty times. */
    var helpHTML =
      '<details class="sync-fold mt-help" id="mtHelp"><summary>How Nourish works</summary>' +
        /* Four lines. It was nine, three of them headed by a glyph, and
           Blake called the sheet messy; the four that are left are the four
           verbs the tab has, and the rest is learned by looking. */
        '<dl class="mt-steps">' +
          '<dt>Fill my day</dt><dd>Drafts every empty meal at once, favourites first when they fit.</dd>' +
          '<dt>Rebalance</dt><dd>Re-sizes the plates you have not eaten or locked, back onto target.</dd>' +
          '<dt>Lock &middot; Pin</dt><dd>Lock holds a portion through a rebalance. Pin puts a dish on every new day at that portion.</dd>' +
          '<dt>Training days</dt><dd>Earn extra carbs; rest days give them back. The week averages to the plan.</dd>' +
        '</dl>' +
      '</details>';

    var shell = function (inner) {
      return '<div class="scrim no-print" data-close="1">' +
        '<div class="sheet mt-sheet" role="dialog" aria-modal="true" aria-label="Your plan">' +
          '<div class="sheet-top">' +
            '<div class="sheet-eyebrow">Your plan</div>' +
            '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
          '</div>' + inner +
        '</div></div>';
    };

    /* ---------------------------------------------------------------- first run
     *
       Four steps, all of them rendered and three of them hidden. That is not a
       style: mtProfileFromDom reads the whole form out of the live DOM in one
       pass and falls back to storage for any field it cannot find, so a step
       taken out of the document would have its questions answered as zeros and
       a plan computed confidently from them.

       The who-line and the measured row come too, hidden, for the same reason
       — every id the rest of the file looks up still exists. The answer block
       is on step four and nowhere else, because two of it would be two
       elements with one id. */
    if (!plan) {
      var STEPS = 5;
      var step = function (n, title, body, said) {
        return '<section class="mtw-step" data-mtwstep="' + n + '"' + (n === 1 ? '' : ' hidden') + '>' +
          '<h3 class="mtw-h">' + title + '</h3>' + body +
          '<div class="mtw-said" id="mtwSaid' + n + '">' + (said || '') + '</div>' +
        '</section>';
      };
      /* The wizard's shape: one screen at a time, the settings that are not
         questions folded behind a tap. */
      var wMove = rowsMove + fold('Pick the training days', rowDays);
      var wGoal = goalPicksHTML + fold('Reach a weight by a date', goalPaceHTML);
      return shell(
        /* Drawn from the step count rather than written out. Four pips were
           typed by hand here, so a fifth step would have arrived with a bar
           that still said four — the kind of disagreement nobody sees until
           they count. */
        '<div class="mtw-bar" aria-hidden="true">' +
          (function () {
            var out = '';
            for (var i = 1; i <= STEPS; i++) {
              out += '<span class="mtw-pip' + (i === 1 ? ' on' : '') + '"></span>';
            }
            return out;
          })() +
        '</div>' +
        '<div class="mtw-keep hide">' + mMeasuredRowHTML(pr) + whoHTML + '</div>' +
        '<div id="mtEditor" class="mt-editor">' +
          step(1, 'About you', rowsAbout, mtSaidBase(pr)) +
          step(2, 'How you move', wMove, mtSaidBurn(pr)) +
          step(3, 'What you&rsquo;re after', wGoal, mtSaidGoal(pr)) +
          /* The answer, once. It was the headline and the tiles and then the
             same three numbers again as boxes, a "= 2158 kcal" line, a
             storehouse toggle and the six-row meal editor, on one screen.
             Now: the number, the meals with an Edit, one door for anyone who
             wants to override. Next goes on to the foods — Blake: "make the
             pick my foods the next step, with a subtle I'm ready to just
             start now, I'll pick foods later" — and that quiet line is the
             Save: it writes the plan and lands on the day. The storehouse
             toggle lives in the editor, under the gear. */
          step(4, 'Your plan',
            answerHTML + mealHeadFor(false) + mealsFor(false) +
            '<details class="mt-fold" id="mtAdjust"><summary>Adjust the numbers</summary>' + qGrams + '</details>' +
            '<div class="mt-save" id="mtSave">' +
              '<button class="mtw-link" data-mtarg="save">I&rsquo;m ready &mdash; start now, pick foods later</button>' +
            '</div>', '') +
          /* The food comes last, after the plan has paid for the question.
             "1,910 calories a day" is the answer that earns "so what do you
             eat" — asked before it, the same screen is a survey.
           *
             Skippable in one tap, and it says so. The table's own defaults
             carry anybody who skips, and the picker dials the rest in as they
             use it, which was Blake's instinct before it was a step: "as I
             use it I dial it in as they show up as suggestions". */
          step(5, 'What do you actually eat?',
            '<div class="mt-cap">Tap anything you eat regularly. Nourish leans ' +
              'toward these when it suggests food &mdash; it never stops offering ' +
              'anything else, and you can change your mind on any food later.</div>' +
            mFavPickBodyHTML(), '') +
        '</div>' +
        '<div class="mtw-nav">' +
          '<button class="ghost" data-mtw="back" hidden>&lsaquo; Back</button>' +
          '<button class="btn-primary" data-mtw="next">Next &rsaquo;</button>' +
          /* The last step has no Next to press, and a step you can only leave
             by the × in the corner is a step that looks unfinished. */
          '<button class="btn-primary" data-mtw="done" hidden>' +
            mFavDoneLabel() + '</button>' +
        '</div>' +
        /* Off the path, but reachable: the gear's "How My Day works" opens
           this sheet asking for it, and a first-run reader deserves an
           answer too. */
        '<div class="' + (S.mtOpen === 'help' ? '' : 'hide') + '">' + helpHTML + '</div>'
      );
    }

    /* ------------------------------------------------------- and every time after
       One screen. Changing your step count should not be four taps through
       questions you answered months ago. */
    return shell(
      answerHTML +
      '<div class="mt-facts' + (mtFactsHTML(pr) ? '' : ' hide') + '" id="mtFacts">' +
        mtFactsHTML(pr) + '</div>' +
      '<div class="mt-status' + (mtStatusHTML(pr) ? '' : ' hide') + '" id="mtStatus" role="status">' +
        mtStatusHTML(pr) + '</div>' +
      whoHTML +
      /* The same rows the wizard asks, one screen, nothing folded that a
         returning reader came to change: the training days and the
         weight-and-date pace sit open here, because Edit is the tap that
         said "I want at those". */
      '<div id="mtEditor" class="mt-editor' + shut + '">' +
        '<div class="mt-div">About you</div>' + rowsAbout +
        '<div class="mt-div">How you move</div>' + rowsMove + rowDays +
        '<div class="mt-div">What you&rsquo;re after</div>' + qGoal +
        '<div class="mt-div">Where your meals come from</div>' + qPrefs +
        '<div class="mt-div">Adjust the numbers</div>' + qGrams +
      '</div>' + mealHeadHTML + mealsHTML + saveHTML(!!plan) + helpHTML
    );
  }

  /* What a step says back once it has been answered.
   *
     The figures are the same mBurn the plan is built from — nothing here is
     computed twice or rounded differently — and the line under them says what
     the figure is FOR, which is most of the difference between a form and a
     guide. Both return nothing at all until there is enough answered to say
     something true, so a half-filled step is quiet rather than wrong. */
  /* Show one step and hide the rest, and say where you are in three places:
     the pips, the Back button, and what Next is called on the last one. */
  function mtwGo(n) {
    var steps = document.querySelectorAll('[data-mtwstep]');
    if (!steps.length) return;
    var last = steps.length;
    n = Math.max(1, Math.min(last, n));
    Array.prototype.forEach.call(steps, function (sc) {
      sc.hidden = Number(sc.dataset.mtwstep) !== n;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.mtw-pip'), function (p, i) {
      p.className = 'mtw-pip' + (i + 1 === n ? ' on' : i + 1 < n ? ' done' : '');
    });
    var back = document.querySelector('[data-mtw="back"]');
    if (back) back.hidden = (n === 1);
    /* The last step is the plan itself and carries its own Save, so Next
       steps aside there rather than becoming a second button that does the
       same thing through a different path. */
    var next = document.querySelector('[data-mtw="next"]');
    if (next) next.hidden = (n === last);
    var fin = document.querySelector('[data-mtw="done"]');
    if (fin) fin.hidden = (n !== last);
    /* Each step is a screen of its own, so it starts at the top of itself
       rather than wherever the last one had been scrolled to. */
    var sheet = document.querySelector('.mt-sheet');
    if (sheet) sheet.scrollTop = 0;
    mtRefreshPlan();
  }

  function mtSaidBase(pr) {
    var b = mBurn(pr);
    if (!b) return '';
    /* bmr × 1.2 and not b.base, which is two different quantities wearing one
       name: with nothing said about steps or sessions it is the whole day
       through the activity dial, and after that it is the resting rate plus
       the little that moving about adds. Reading it here gave a man of 43 a
       resting burn of 2,757 — and then step two, having been told about his
       steps, called the same idea 2,135. One figure, said once, both times. */
    return mtwOut(b.bmr * 1.2, 'kcal at rest', 'What your body spends before you move.');
  }

  /* One answer box, the same shape on every step: the number, what it is,
     and one line on what it is for. */
  function mtwOut(n, unit, sub) {
    return '<div class="mtw-head"><b>' + Math.round(n).toLocaleString() + '</b> ' + unit + '</div>' +
      (sub ? '<p class="mtw-for">' + sub + '</p>' : '');
  }

  /* The nearest of the wizard's three words to a stored activity dial, so a
     profile made on the five-line select still lights one of them. */
  function mtActNear(act) {
    var a = Number(act) || 1.2;
    return a < 1.29 ? 1.2 : a < 1.47 ? 1.375 : 1.55;
  }

  /* What the goal step says back: the day's calories, and how far under or
     over the burn that is, in pounds a week. */
  function mtSaidGoal(pr) {
    var b = mBurn(pr), plan = mPlanCalc(pr);
    if (!b || !plan) return '';
    /* kcalOf the rounded grams, not plan.kcal: the plan step's tiles add
       the grams up, and the two were a calorie apart — 1,707 on one screen,
       1706 on the next. One calorie, said once. */
    var kcal = kcalOf(plan);
    var diff = Math.round(b.tdee) - kcal;
    var pace = mGoalPace(pr);
    var perWeek = pace ? pace.perWeek : (MGOALS[pr.goal] || MGOALS.cut1).rate * pr.lb;
    var lbs = Math.round(Math.abs(perWeek) * 10) / 10;
    var line = diff > 0
      ? diff.toLocaleString() + ' under what you burn &mdash; about ' + lbs + ' lb a week off.'
      : diff < 0
      ? Math.abs(diff).toLocaleString() + ' over what you burn &mdash; about ' + lbs + ' lb a week on.'
      : 'What you burn, so the scale holds.';
    return mtwOut(kcal, 'kcal a day', line);
  }

  function mtSaidBurn(pr) {
    var b = mBurn(pr);
    if (!b) return '';
    var part = function (n, what) {
      return '<div class="mtw-part"><b>' + Math.round(n).toLocaleString() + '</b><i>' + what + '</i></div>';
    };
    return mtwOut(b.tdee, 'kcal a day', 'Everything else works from this: eat under it and you lose.') +
      (b.told
        ? '<div class="mtw-parts">' + part(b.base, 'at rest') +
          part(b.steps, 'walking about') + part(b.train, 'exercising') + '</div>'
        : '');
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
  /* Merged onto what is stored, never built fresh from the DOM.
   *
     This function can only report what the sheet has boxes for, and
     mWriteProfile is a bare setItem — so every Save was silently dropping
     whatever the DOM did not carry. `train`, the days carb cycling swings on,
     was the casualty: set the days by hand, change anything else, press Save,
     and they snapped back to whatever the workout count implies, with nothing
     said. Weight would have been the second, now that its box goes away once
     the scale has something to say — an absent box reads as 0 through `n`,
     which would have wiped the fallback the first plan is built on.
   *
     Merged onto mReadProfile — the resolved profile, weight and all — and not
     onto the raw store. The absent weight box IS the case mReadProfile exists
     for: once the scale has answered, the sheet states that fact instead of
     offering a box, so the fallback `n` reaches for has to be the same fact.
     Reaching into the raw store got the stale typed number instead, and the
     sheet opened on the scale's plan and then flipped to the stale one the
     moment any other control was touched — the fifteen-pound drift described
     above mScaleLb, back through a side door, with the weight row still
     saying it came from the weigh-ins. What the weight is has one definition
     and mReadProfile is where it lives. */
  function mtProfileFromDom() {
    var n = function (id, fb) {
      var el = $(id);
      if (!el) return fb;
      return Number(el.value) || 0;
    };
    var stored = mReadProfile();
    var sexBtn = document.querySelector('[data-mtsex][aria-pressed="true"]');
    var goalBtn = document.querySelector('[data-mtgoal][aria-pressed="true"]');
    var out = {};
    Object.keys(stored).forEach(function (k) { out[k] = stored[k]; });
    out.sex = sexBtn ? sexBtn.dataset.mtsex : stored.sex;
    out.age = n('mtAge', stored.age);
    out.ft = n('mtFt', stored.ft);
    out.inch = n('mtIn', stored.inch);
    out.lb = n('mtLb', stored.lb);
    out.bf = n('mtBf', stored.bf);
    out.act = Number(($('mtAct') || {}).value) || stored.act || 1.55;
    out.goal = goalBtn ? goalBtn.dataset.mtgoal : stored.goal;
    var extBtn = document.querySelector('[data-mtext][aria-pressed="true"]');
    out.extFill = extBtn ? extBtn.dataset.mtext === '1' : !!stored.extFill;
    out.goalLb = n('mtGoalLb', stored.goalLb);
    out.goalBy = $('mtGoalBy') ? ($('mtGoalBy').value || '') : (stored.goalBy || '');
    out.workouts = n('mtWorkouts', stored.workouts);
    out.steps = n('mtSteps', stored.steps);
    return out;
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
    /* What the fold is hiding, so you can decide without opening it. The
       goal used to be said here; it is a fact in the ledger above now, and
       saying it twice on one screen was how the two came to disagree. What
       belongs on the handle is the answers behind it. */
    var bits = [pr.age, pr.ft + '\u2032' + pr.inch + '\u2033',
      pr.sex === 'f' ? 'female' : 'male'];
    if (pr.steps) bits.push(Number(pr.steps).toLocaleString() + ' steps');
    if (pr.workouts) bits.push(pr.workouts +
      (Number(pr.workouts) === 1 ? ' session' : ' sessions') + ' a week');
    return bits.join(' \u00b7 ');
  }

  /* The four things the sheet is opened to read: where you are going, how
     fast, when you get there, and what the scale actually says.
   *
     Three of them used to be crushed into one two-line box above the meal
     editor, and the fourth was not on this screen at all — it lived only on
     My Day, so the plan could be read end to end without ever meeting the
     evidence for or against it. A ledger, because these are facts and not
     controls: label left, value right, one per line, nothing to press. */
  function mtFactsHTML(pr) {
    var rows = [];
    var st = mWeightStats();
    var pace = mGoalPace(pr);
    var pj = mProject(pr);
    var fact = function (lab, val) {
      return '<div class="mtf-row"><span>' + lab + '</span><b>' + val + '</b></div>';
    };
    var lb = function (v) { return (Math.round(v * 10) / 10).toLocaleString() + ' lb'; };
    /* The profile's weight, which mReadProfile has already resolved to what
       the scale says — NOT a second read of mWeightStats. Two routes to one
       number is how the sheet came to open on the scale's plan and then flip
       to the stale typed one the moment any other control was touched. */
    var now = pr.lb;

    if (pr.goalLb && now) {
      rows.push(fact('Going from', lb(now) + ' \u2192 ' + lb(pr.goalLb)));
    } else if (MGOAL_WORDS[pr.goal]) {
      rows.push(fact('Aiming to', esc(MGOAL_WORDS[pr.goal])));
    }

    /* A named date sets the pace; without one the plan's own pace is what
       there is. Direction is already in the line above, so this is a rate. */
    var per = pace ? pace.perWeek : pj ? pj.perWeek : null;
    if (per !== null) {
      var v = Math.round(Math.abs(per) * 10) / 10;
      rows.push(fact('At', v ? v + ' lb a week' : 'holding steady'));
    }

    /* Where the plan lands you, not the day you asked for — they differ
       whenever a cap bit, and the one that is true is the one worth reading. */
    if (pj) {
      rows.push(fact('Arriving', 'about ' + M_MONS[pj.when.getMonth()] + ' ' +
        pj.when.getDate()));
    } else if (pace) {
      rows.push(fact('Arriving', esc(mPretty(pr.goalBy))));
    }

    /* The weight here is `now` — the profile's resolved lb — and NOT a second
       read of mWeightStats.avg7, even though mReadProfile defines one as the
       other. Two routes to one number is the whole fault this screen was
       rearranged to end: they agree until something breaks the resolution,
       and then the sheet states one weight and plans from another. Only the
       RATE comes off the stats, because nothing else carries it. */
    if (st && now) {
      var w = lb(now);
      if (st.dWeek !== null) {
        var d = Math.round(Math.abs(st.dWeek) * 10) / 10;
        w += Math.abs(st.dWeek) < 0.05 ? ', holding steady'
          : ', ' + (st.dWeek < 0 ? 'down ' : 'up ') + d + ' a week';
      }
      rows.push(fact('Averaging now', w));
    }

    /* Last, because it is the one fact that carries its own caption, and a
       caption reads as a note on the row above it — never as a heading for
       whatever comes next. */
    rows.push(mMeasuredRowHTML(pr));

    return rows.join('');
  }

  /* The one line on the sheet that speaks only when something needs doing.
     On pace it says nothing at all — a plan you are keeping to has no news —
     and what it does say is mPaceFacts, the same arithmetic My Day's morning
     line is drawn from. */
  function mtStatusHTML(pr) {
    /* The same estimate the morning card gives, in the same words, so the
       sheet and the card never read two different stories about one goal. */
    var f = mPaceFacts(todayKey(), pr);
    if (!f || !f.plan.per) return '';
    var boxes = $('mtP')
      ? { p: Number($('mtP').value) || 0, f: Number($('mtF').value) || 0, c: Number($('mtC').value) || 0 }
      : mReadTargets();
    var cur = kcalOf(boxes);
    var fmt = function (n) { return Number(n).toLocaleString(); };
    var eating = f.need !== null && cur > 0 && Math.abs(cur - f.need) <= 5;
    var goalD = f.goalWord;
    if (!f.arriveD) {
      return '<b>\u25CE No arrival date yet.</b> Your weight\u2019s been ' +
        (f.rate3 !== null && Math.abs(f.rate3) >= 0.15 ? (f.rate3 > 0 ? 'going up' : 'going down') : 'flat') +
        ' these three weeks.';
    }
    if (f.lateDays > 6) {
      var speeds = f.need !== null && cur > 0 && (f.plan.per < 0 ? f.need < cur - 5 : f.need > cur + 5);
      return '<b>\u25B2 Arriving around ' + f.arrive + ', not ' + goalD + '.</b>' +
        (eating ? (f.capped ? ' This target is already as ' + (f.capHigh ? 'much as your body can put to use.'
          : 'low as it\u2019s safe to go.') : ' This target brings it back.')
          : speeds ? (f.capped ? ' The lowest it\u2019s safe to go is ' + fmt(f.need) + '.'
            : ' ' + fmt(f.need) + ' a day brings it back to ' + goalD + '.') : '');
    }
    if (f.lateDays < -6) {
      var slows = f.need !== null && cur > 0 && (f.plan.per < 0 ? f.need > cur + 5 : f.need < cur - 5);
      /* Early with nothing to offer is nothing to do: the sheet stays quiet,
         the way the card's last line speaks only when something needs doing. */
      return slows ? '<b>\u25BC Arriving around ' + f.arrive + ', ahead of ' + goalD + '.</b>' +
        ' You could eat ' + fmt(f.need) + ' and still make it.' : '';
    }
    return '';
  }

  /* What the meals fold says on its handle: how many, and the shares. That
     is what anybody opens it to check, so checking it should not cost the
     opening. Read off the live rows while they exist, because those are the
     draft — storage is a version of this screen that may be one edit old. */
  function mtMealSumHTML() {
    var rows = document.querySelectorAll('#mtMeals .mtm-row');
    var ws = [];
    if (rows.length) {
      Array.prototype.forEach.call(rows, function (r) {
        ws.push(Math.max(0, Math.round(Number(r.querySelector('.mtm-share').value) || 0)));
      });
    } else {
      mReadSlots().list.forEach(function (sl) { ws.push(mSlotW(sl)); });
    }
    if (!ws.length) return 'No meals yet';
    var N = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
      'Nine', 'Ten', 'Eleven', 'Twelve'];
    return (N[ws.length] || ws.length) + (ws.length === 1 ? ' meal' : ' meals') +
      ' \u00b7 ' + ws.join(' / ') + '%';
  }

  function mPaceWords(pace) {
    var v = Math.round(Math.abs(pace.perWeek) * 10) / 10;
    return (pace.perWeek > 0.05 ? '\u2212' : pace.perWeek < -0.05 ? '+' : '') +
      (v ? v + ' lb a week' : 'holding');
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
    /* Four rows at most, in the ledger's own voice. Blake, on the sheet:
       "Craft my plan pages still looks messy" — this block was five rows of
       shouting labels, a lands-you line the ledger above already said, and
       an italic paragraph of advice. What is left is what the ledger cannot
       say: what you burn, what one more lever buys, and the formula's own
       plan when it differs from the boxes. */
    var out = [];
    var kc = function (n) { return Math.round(n).toLocaleString(); };
    out.push('<div class="mco-row"><span class="mco-k">You burn</span><span class="mco-v">' +
      '<b>' + kc(b.tdee) + '</b> a day' +
      (b.told
        ? ' &middot; ' + kc(b.base) + ' living, ' + kc(b.steps) + ' walking, ' + kc(b.train) + ' training'
        : ' &mdash; fill in steps and sessions to see the parts') +
      '</span></div>');

    var pj = mProject(pr);
    if (b.told && pj) {
      var kg = pr.lb * 0.45359237;
      var stepK = 2000 * 0.53 * kg * 0.00075;
      var sessK = (5 * 3.5 * kg / 200) * 45 / 7;
      var says = function (label, lev) {
        return '<div class="mco-row"><span class="mco-k">' + label + '</span><span class="mco-v">' +
          '<b>+' + lev.kcal + ' kcal</b> a day at the same pace' +
          (lev.weeks && lev.weeks > 0.15
            ? ', or ' + mWeeksWords(lev.weeks) + ' sooner on the same food'
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
      out.push('<div class="mco-row"><span class="mco-k">The formula says</span><span class="mco-v">' +
        '<b>' + kcalOf(plan).toLocaleString() + '</b> kcal &middot; ' + plan.p + 'P / ' + plan.f + 'F / ' +
        plan.c + 'C ' +
        '<button class="ghost mco-use" data-mtuse="1">Use it</button></span></div>');
    }
    return '<div class="mco">' + out.join('') + '</div>';
  }

  function mGoalNote(pr) {
    var pace = mGoalPace(pr);
    if (!pace) return 'Give a weight and a date and they set your pace for you. Leave the date blank and the choices above set it instead.';
    /* The pace, and the warning if the pace cannot be had. It used to
       finish with "3× a week · 7,000 steps a day" — the answers from the
       rows above, read back to the person who typed them. */
    var bits = [Math.abs(Math.round(pace.lbs * 10) / 10) + ' lb over ' +
      Math.round(pace.days / 7) + ' weeks \u2014 ' + mPaceWords(pace)];
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

  /* A plan nobody has made yet is not a plan of zero calories. Shown as a
     dash until the boxes have something in them, in the render and here both
     — this reads the boxes back, so without it the first keystroke anywhere
     in the sheet wrote every zero straight back onto the headline. */
  function mtDash(v) {
    return v ? String(v) : '<span class="mt-none">\u2014</span>';
  }

  /* The headline follows the boxes, whichever way they were filled in. */
  function mtRefreshAnswer() {
    var gv = function (id) { return Math.max(0, Math.round(Number(($(id) || {}).value) || 0)); };
    var t = { p: gv('mtP'), f: gv('mtF'), c: gv('mtC') };
    /* innerHTML, because the empty state is a marked-up dash rather than a
       number. Everything through here is either a figure this file computed
       or that span; none of it is anyone's text. */
    var set = function (id, v) { var el = $(id); if (el) el.innerHTML = v; };
    set('mtBigKcal', mtDash(kcalOf(t)));
    set('mtTileP', mtDash(t.p)); set('mtTileF', mtDash(t.f)); set('mtTileC', mtDash(t.c));
    set('mtKcal', kcalOf(t) ? '= ' + kcalOf(t) + ' kcal' : '\u2014');
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
    /* The handle says how many meals and at what shares, so it goes stale
       the moment a row is added, removed, or renumbered. Kept in step here
       rather than at three call sites, because every one of them is an edit
       to the rows this reads. */
    var sum2 = $('mtMealSum');
    if (sum2) sum2.innerHTML = mtMealSumHTML();
  }

  /* Save belongs to whatever is open. Both folds shut is a screen being
     read, and a read has nothing to commit. */
  function mtSyncSave() {
    var sv = $('mtSave');
    if (!sv) return;
    var open = function (id) { var e = $(id); return e && !e.classList.contains('hide'); };
    sv.classList.toggle('hide', !(open('mtEditor') || open('mtMealsWrap')));
  }

  /* `holdBoxes` is for the one profile control that lives OUTSIDE the editor
     fold: the burn switch among the facts. Every other caller is a question
     the reader is looking at with Save on screen, so writing the worked-out
     plan into the gram boxes hands them an answer they can commit. The burn
     switch can be tapped with both folds shut and no Save anywhere, and
     rewriting the boxes there put 197/59/86 on a sheet whose storage still
     held 180/60/190 and offered no way to close the gap — a screen stating a
     plan the app is not on, which is the whole fault this layout ended.
     Tapping it changes what the facts and the status line say; the grams wait
     for a Save to be asked for. */
  function mtRefreshPlan(holdBoxes) {
    var prNow = mtProfileFromDom();
    var plan = mPlanCalc(prNow);
    /* This caption is an answer to the gram boxes — it says when THEY sit
       under what a body spends lying still. Held boxes mean nothing it
       describes has moved, and writing it anyway warned about a plan that
       was not on the screen. */
    var el = $('mtPlan');
    if (el && !holdBoxes) el.innerHTML = mtPlanLine(plan, prNow);
    /* The ledger, the pace line and the fold's handle are all answers to
       the boxes below them, so they follow the boxes rather than waiting for
       a Save. A screen showing last month's goal above this month's plan is
       the disagreement this layout exists to end. */
    var fx = $('mtFacts');
    if (fx) { fx.innerHTML = mtFactsHTML(prNow); fx.classList.toggle('hide', !fx.innerHTML); }
    var sx = $('mtStatus');
    if (sx) { sx.innerHTML = mtStatusHTML(prNow); sx.classList.toggle('hide', !sx.innerHTML); }
    var wl = $('mtWho');
    if (wl) wl.innerHTML = mtWhoLine(prNow);
    var gn = $('mtGoalNote');
    if (gn) gn.innerHTML = mGoalNote(prNow);
    var co = $('mtCoach');
    if (co) co.innerHTML = mCoachHTML(prNow);
    /* The wizard's two answers are computed from the same profile as the rest
       and go stale the same way, so they are refreshed with it. */
    var s1 = $('mtwSaid1');
    if (s1) s1.innerHTML = mtSaidBase(prNow);
    var s2 = $('mtwSaid2');
    if (s2) s2.innerHTML = mtSaidBurn(prNow);
    var s3 = $('mtwSaid3');
    if (s3) s3.innerHTML = mtSaidGoal(prNow);
    var gs = $('mtGoalSeg');
    if (gs) {
      var dated = !!mGoalPace(prNow);
      gs.classList.toggle('spent', dated);
      Array.prototype.forEach.call(gs.querySelectorAll('[data-mtgoal]'),
        function (b2) { b2.disabled = dated; });
    }
    if (!plan || holdBoxes) { mtRefreshAnswer(); return; }
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
     recipe's. ×2½ of a one-jar shake is 2½ jars; two plates of a four-plate
     roast is half the roast; one plate of a six-serving bake is a sixth.
   *
     This used to snap to the eighths the quantities print in, which is
     exact only when the yield is 1, 2, 4 or 8: a sixth became an eighth,
     so one plate of a six-serving dish opened a sheet that made three
     quarters of it, and a twelfth became an eighth and made one and a half.
     A hundred and nine recipes yield something else. The quantities still
     print in eighths — each one is rounded where it is printed — but the
     factor between them is the true one, and the sheet says the portion
     in servings rather than a fraction that was never quite right. */
  /* The batch a plate asks the cook for — the plate itself, down to a
     twelfth of the recipe. Below that is a batch you bake and a plate you
     eat from it: one cookie of forty-eight scaled to 0.02 printed "0 cup
     butter", under a heading that (clamped at a twentieth) claimed 2⅜
     servings for a plate of one. A plate that small opens the recipe as
     written. At one serving that is only the thirteen recipes that make
     more than twelve. */
  function mCookScale(x, servN) {
    var f = x / (servN || 1);
    return f < 1 / 12 - 1e-9 ? 1 : f;
  }

  /* What the sheet calls its scale. A factor the dial can reach — a half,
     a double, an eighth — is said as one; a factor that came from a plate
     is said as the servings it makes, which is what it was asked for. */
  function mScaleWords(f, r) {
    var eighth = Math.abs(f * 8 - Math.round(f * 8)) < 1e-9;
    if (eighth) return null;
    var n = f * ((r && r.servN) || 1);
    return 'for ' + fmtNum(n) + (Math.abs(n - 1) < 1e-9 ? ' serving' : ' servings');
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
      if (mFillRoom(day, targets) < 100) return;

      /* Pins get the first claim of all.
       *
         A pin is a standing instruction and Fill is the machine acting on
         your instructions, so it has to be able to read them. It could not:
         pins were placed in exactly one moment, the first time a day was ever
         looked at, and nowhere else. Empty a day and its key survives as an
         object with empty arrays, which is truthy, so that branch never ran
         again — the pin was gone from that day for good, through Fill and
         through a reload both. Blake, who found it: "I cleared a day and then
         filled and I have my crio bru pinned and it did not show up."
       *
         At the pinned portion rather than at 1x. mRenderDay's seeding has
         always honoured p.x, and this is the same statement arriving by a
         different road; the two must not disagree about what a pin says.
       *
         Before the family's plan, because a pin is the older promise. They
         rarely contend — a pin is an item and the family's dish is placed by
         its section — and mSlotSpokenFor keeps either from shutting a meal. */
      var pinSlots = mReadSlots();
      pinSlots.list.forEach(function (ps) {
        if (mSkipped(mViewKey(), ps.k)) return;        // you said you are not eating it
        /* Not onto a meal you have already ticked. Every other pass asks this
           and this one never did, so a pin was the one thing that could land
           on a finished meal — and landing there re-opened it, which handed
           the topper a meal it would otherwise have left alone. Blake, after
           sweeping and filling: "Breakfast was marked complete and it did it
           and added more foods."
         *
           mSlotSpokenFor is deliberately NOT the test here. It also counts a
           hand-placed dish, and a pin is supposed to outrank one — pins get
           the first claim of all, which is why this pass runs before the
           others. What a pin must not outrank is a tick. */
        if (mSlotClosed(day, ps.k)) return;
        (ps.pins || []).forEach(function (p) {
          var pr = BY_ID[p.id];
          if (!pr || !pr.macro) return;                // no macros, nothing to solve
          if (mOnDay(day, p.id)) return;               // already there, by any route
          (day[ps.k] = day[ps.k] || []).push({ id: p.id, x: p.x || 1, eaten: 0 });
        });
      });

      /* The family's plan gets first claim.
       *
         Before a single best-fit is chosen, whatever the house is having
         today is placed on the meal its section names. Everything below then
         steps over those meals by the rule it already had — "a meal with food
         on it is left alone" — so the draft builds AROUND the family dinner
         rather than instead of it, and mBalanceDay sizes it against your own
         targets along with everything else. Blake, on the flow he wants:
         "seeding my day with family recipes planned for that day would be
         good... auto fill a day based on my favorites and best fits."
       *
         At 1x to begin with. The portion is not guessed here because it is
         not guessed anywhere — the solver at the foot of this function sizes
         every plate on the day at once, which is the only place that can see
         what the rest of the day came to. */
      var wSlots = mReadSlots();
      mFamilyIds(mViewKey()).forEach(function (fid) {
        var r = BY_ID[fid];
        if (!r || !r.macro) return;                    // no macros, nothing to solve
        if (mOnDay(day, r.id)) return;                 // already there, by any route
        /* Tried on every meal it could go on, not only the first: with one
           candidate, a Batch Prep container was dropped because lunch had a
           plate on it while dinner sat empty. And a meal holding only what
           this pass just put there is still the family's — two dishes
           planned for one dinner both go on it, where the second used to be
           dropped because the first had "spoken for" the meal. */
        var placed = false;
        mSlotsForRecipe(r, wSlots).forEach(function (s) {
          if (placed) return;
          var items = day[s.k] || [];
          var ours = items.length && items.every(function (it) { return it.by === 'w' && !it.eaten && !it.l; });
          if (mSlotSpokenFor(day, s) && !ours) return; // that meal is spoken for
          if (mSkipped(mViewKey(), s.k)) return;         // you said you are not eating it
          (day[s.k] = day[s.k] || []).push({ id: r.id, x: 1, eaten: 0, by: 'w' });
          placed = true;
        });
      });

      mReadSlots().list.forEach(function (s) {
          if (mSlotSpokenFor(day, s)) return;
          // you said you are not eating this one
          if (mSkipped(mViewKey(), s.k)) return;
          var secs = mSlotSecs(s);
          var inSec = RECIPES.filter(function (r) {
            return secs.indexOf(r.book + '-' + r.secNum) >= 0 && !mOnDay(day, r.id);
          });
          /* What the neighbouring days have not already used — but only while
             that leaves something to choose from. A meal left empty to avoid a
             repeat is a worse answer than the repeat. */
          inSec = inSec.filter(function (r) { return !mNever(r.id); });
          var fresh = inSec.filter(function (r) { return !near[r.id]; });
          var pool = fresh.length ? fresh : inSec;
          var ranked = mRank(pool, day, targets, s).filter(function (e) { return e.score !== null; });
          if (!ranked.length) return;
          var top = ranked.slice(0, 3);
          var pick = top[Math.floor(Math.random() * top.length)];
          (day[s.k] = day[s.k] || []).push({ id: pick.r.id, x: pick.x, eaten: 0, by: 'f' });
      });

      /* Settle the portions before asking whether anything is missing. Each
         dish was sized against its own share while the slots were still being
         filled, so the raw draft usually sits ON or over the day — the gap
         only opens once the plates are solved against the finished day. A
         topper chosen before that would be answering a question nobody asked;
         one chosen after gets sized in the second pass along with everything
         else it now sits beside. */
      mBalanceDay(day, targets, true);

      var moved = mSideUp(day, targets, near);
      if (mTopUp(day, targets, near) || moved) mBalanceDay(day, targets, true);
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
      /* Closed by the one definition the other passes use: a tick OR a
         lock. "Any plate un-eaten" let a side onto a locked dinner, and onto
         a breakfast with one plate eaten and one still to come. */
      if (!items.length || !open || mSlotClosed(day, s.k)) return;
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
      /* The topper's ceiling applies here too. A side is also something Fill
         put on the plate that nobody asked for, and "never a condiment's worth
         of salt from one addition" is a rule about additions, not toppers. It
         was the day's remaining room alone, so a double helping of a canned
         vegetable could bring six hundred milligrams on its own — which the
         suite's salt guard caught on some draws and not others. */
      var naRoom = Math.min(MTOP_NA, Math.max(0, MNA_CAP - (tot.all.na || 0)));
      var best = null;
      MFOODS.forEach(function (r) {
        var mac = r.macro || {};
        if (r.ext && !mExtOk()) return;     // Fill does not shop
        if (!r.side) return;
        if (mNever(r.id)) return;
        if (!mFoodMealOK(r, slot)) return;
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
      (day[slot.k] = day[slot.k] || []).push({ id: best.r.id, x: best.x, eaten: 0, by: 'f', why: 'fib' });
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
      // a meal with nothing on it is Fill's job; a tick or a lock closes one
      if (!items.length || !open || mSlotClosed(day, s.k)) return;
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
      var naRoom = Math.min(MTOP_NA, Math.max(0, MNA_CAP - (tot.all.na || 0)));
      MFOODS.forEach(function (r) {
        var mac = r.macro || {};
        if (r.ext && !mExtOk()) return;     // Fill does not shop
        if (!mFoodMealOK(r, slot)) return;
        if ((mac.kcal || 0) < MTOP_MIN) return;
        if (((mac.p || 0) + (mac.c || 0) + (mac.f || 0)) <= 0) return;
        /* Something you would eat, not something you cook in. On a very low
           carbohydrate day the fat gap is the one left, and the best fit for
           a fat gap is oil: it was a topper on one day in six, and on some
           the solver then shrank the dish to a quarter to make room for two
           tablespoons of it. A topper carries at least a tenth of itself as
           protein or carbohydrate — nuts qualify, oil and butter do not. */
        if (4 * ((mac.p || 0) + (mac.c || 0)) < 0.10 * (mac.kcal || 0)) return;
        if (mNever(r.id)) return;
        if (mOnDay(day, r.id) || (near && near[r.id])) return;
        var fit = macroFit(r, R, R, D);
        // priced at the portion actually being added, not per hundred grams
        if ((mac.na || 0) * fit.x > naRoom) return;
        var sc = fit.score + mSaltFibre(r, fit.x);
        if (!best || sc > best.score) best = { r: r, x: fit.x, score: sc };
      });
      if (!best) return added;
      /* Why it is there: the gap it was closing, the largest of the three in
         calories. Said on the plate ("Added for protein"). */
      var gapK = { p: 4 * R.p, f: 9 * R.f, c: 4 * R.c };
      var why = ['p', 'f', 'c'].reduce(function (a, m) { return gapK[m] > gapK[a] ? m : a; }, 'p');
      (day[slot.k] = day[slot.k] || []).push({ id: best.r.id, x: best.x, eaten: 0, by: 'f', why: why });
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

  /* What a meal landing away from its share costs the solver.
   *
     pen() priced four things — protein, fat, carbohydrate and salt — and all
     four are day-level. Nothing in it said where the food should land, so a
     day could put a seven-calorie plate on the last meal and a thousand on
     dinner and score as a perfect day. On a plan shaped like Blake's, over
     fourteen consecutive days, the evening snack came in at 0.59 of its share
     and was a token on thirteen of them: a quarter of a churro and two bell
     peppers, on a day that still finished two hundred under. Meals draft in
     order, and by the last slot the asymmetric weights — over at 1.2, under
     at 0.55 — make leaving calories on the table cheaper than overshooting.
   *
     Priced against the meal's own ask, read off mMealAsk so this and the
     meal's pills agree about the same meal, and normalised on the day's
     calories so a 150-kcal snack and an 800-kcal dinner get the same rule.
     Symmetric, because a 90-kcal snack and a 1,000-kcal dinner are one fault
     seen from either end.
   *
     One, measured on Blake's own plan over fourteen consecutive days rather
     than on the bench, whose default profile is an extreme cut and whose
     knee sat at two. On his plan two bought one fewer token evening than one
     did and paid four grams of protein and twenty-five calories a day for it;
     one took the evening snack from 0.59 of its share to 0.86, cleared every
     oversized plate, and moved day accuracy by one calorie. */
  var MSHARE_W = 1;


  /* `own` narrows the solver to the plates FILL ITSELF PUT THERE (`by:'f'`).
   *
     Fill is an offer to build out the empty meals. It was also quietly
     resizing the full ones: a hand-placed 1,139 kcal pulled beef put on
     dinner at one serving came back at ×0.25 after a single press, and the
     day then read 184/180 P in green while being some 850 kcal wrong. The
     day's arithmetic was right — the plate was not the plate you put down.
   *
     Nothing here can tell whose a plate is, because nothing was recording it:
     every free-list frees whatever is neither eaten nor locked, and Fill's
     plates and yours are the same shape. So Fill now signs its own work and
     asks only for that back. Note the DEFAULT is unsigned, which means a day
     drafted before this shipped reads as entirely hand-placed — the safe
     direction, since the cost is a solver with less to move rather than a
     portion silently overwritten.
   *
     Rebalance is deliberately NOT narrowed, here or in mBalanceMeal. Pressing
     ⚖ is asking the machine to move things; answering "only my own" would be
     refusing the request. The rule is about what Fill may do UNASKED, not
     about the plates. */
  /* What each open meal is asked for, as the solver prices it. Read once
     before the descent — mMealAsk walks the day, and pen() runs once per
     rung per plate per pass. Skipped-and-empty meals are not in play; a meal
     with plates already eaten still has its ask, because the plates still
     on it are what this is sizing.
   *
     `now`, not `plan`: what the meal is asked for once the day so far is
     paid for, which is the figure on its pills. Priced at the plan share, a
     dinner was pulled toward 533 while its pill asked 383 after a heavy
     breakfast — the scale and the card disagreeing about one meal. `now`
     reads only what has been EATEN, so it does not move while the plates
     below are solved. */
  function mMealWants(day, targets) {
    var asks = [];
    if (!MSHARE_W || kcalOf(targets) <= 0) return asks;
    var slots0 = mReadSlots(), vk0 = mViewKey();
    slots0.list.forEach(function (s0) {
      if (mSkipped(vk0, s0.k) && !(day[s0.k] || []).length) return;
      var a0 = mMealAsk(s0.k, targets, slots0);
      var w0 = a0 && (a0.now || a0.plan);
      if (w0 && w0.kcal > 0) asks.push({ k: s0.k, want: w0.kcal });
    });
    return asks;
  }

  function mBalanceDay(day, targets, own) {
    /* Walked in the meals' own order, never in the order the day object
       happened to be built in. Coordinate descent visits one plate at a
       time, so the order is part of the answer: the same three plates
       solved forward and backward landed a day at 1,254 and at 1,322 kcal.
       A pinned meal was inserted first, a hand-built day in tap order, a
       synced day as it was stored — three roads in, three answers. */
    var order = mReadSlots().list.map(function (s1) { return s1.k; });
    Object.keys(day).forEach(function (sk) { if (order.indexOf(sk) < 0) order.push(sk); });
    var free = [];
    order.forEach(function (sk) {
      /* Fill leaves a meal you have started alone — the same rule that keeps
         it from adding to one. A plate it placed beside the one you ticked
         was being resized while you ate. Rebalance, pressed by hand, still
         reaches every un-eaten plate. */
      if (own && mSlotClosed(day, sk)) return;
      (day[sk] || []).forEach(function (it) {
        var r = BY_ID[it.id];
        /* Asked to size only its own work, Fill's own work includes the
           plate the family plan seeded — placed at ×1 by the machine on the
           promise that the solver would size it, a promise this line used
           to break. What a hand placed stays where the hand put it. */
        if (own && it.by !== 'f' && it.by !== 'w') return;
        if (!it.eaten && !it.l && r && r.macro) free.push(it);
      });
    });
    if (!free.length) return;
    var asks = mMealWants(day, targets), dayK = kcalOf(targets);
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
      /* And where it lands. See MSHARE_W. */
      for (var ai = 0; ai < asks.length; ai++) {
        var kc = 0, items = day[asks[ai].k] || [];
        for (var ii = 0; ii < items.length; ii++) {
          var ri = BY_ID[items[ii].id];
          if (ri && ri.macro) kc += (ri.macro.kcal || 0) * items[ii].x;
        }
        s += MSHARE_W * Math.abs(kc - asks[ai].want) / dayK;
      }
      return s;
    };
    for (var pass = 0; pass < 3; pass++) {
      var moved = false;
      free.forEach(function (it) {
        var was = it.x, best = it.x, bestPen = pen();
        /* Per plate, not one ladder for the day: a dish is sized in servings
           and a food in whatever it is counted in. See mLadder. */
        var rf = BY_ID[it.id];
        var rungs = mLadder(rf, it.x);
        /* A single food Fill put there was chosen under two ceilings — the
           topper's salt (MTOP_NA) and a portion you would serve (MFOOD_G_MAX)
           — and this solver then walked it up a ladder with no top, pricing
           salt only against the whole day's cap: tuna chosen at one can came
           out at two (720 mg), whey at six scoops. The rungs it may try are
           the ones those ceilings allow; where it already sits stays allowed,
           so a hand-typed portion is never forced to move. */
        if (it.by === 'f' && rf && rf.food) {
          var naX = rf.macro && rf.macro.na > 0 ? MTOP_NA / rf.macro.na : Infinity;
          var gX = rf.grams ? MFOOD_G_MAX / rf.grams : Infinity;
          var topX = Math.max(Math.min(naX, gX), 0);
          rungs = rungs.filter(function (v) { return v <= topX + 1e-9 || v === was; });
        }
        for (var i = 0; i < rungs.length; i++) {
          it.x = rungs[i];
          var pv = pen();
          if (pv < bestPen - 1e-9) { bestPen = pv; best = rungs[i]; }
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
    var out = ['Nourish \u2014 ' + M_WDAYS[d.getDay()] + ', ' + M_MONS[d.getMonth()] + ' ' +
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
    /* And the day's training, with the times, so a workout goes into the
       other app at the hour it happened. Only when there was some. */
    var tr = window.Train && window.Train.dayText ? window.Train.dayText(k) : [];
    if (tr && tr.length) { out.push(''); out = out.concat(tr); }
    return out.join('\n');
  }

  /* execCommand is the fallback because the async clipboard API is refused
     outside a secure context and on some in-app browsers — and this button
     is most wanted on exactly those. */
  function mCopyDay(btn) {
    var text = mDayText(mViewKey());
    /* What the button was before it was pressed, which is a glyph in a slot
       the width of a glyph. It used to put back the WORDS "Copy as text" —
       the comment said "the name it shipped with" and the name it shipped
       with is \u2398 — so one press turned an icon into a three-word label
       that wrapped onto three lines and climbed out of the bottom bar, and
       stayed that way for good. */
    var wasHTML = btn.getAttribute('data-icon') || btn.innerHTML;
    if (!btn.getAttribute('data-icon')) btn.setAttribute('data-icon', wasHTML);
    var said = function (ok) {
      btn.textContent = ok ? 'Copied' : 'Press and hold';
      setTimeout(function () { btn.innerHTML = btn.getAttribute('data-icon'); }, 2200);
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
         The target of a meal is its weight's worth of the day.
     *
         And that weight's worth is mMealShare's to say, not this function's.
         It was worked out here a second time — over EVERY slot, where
         mMealShare drops the ones you have skipped and left empty — so on a
         day with skips the button solved a meal to roughly half of what the
         pills directly above it were printing as its share. Same button, same
         card, two answers. A skipped meal is not still coming; the pills, the
         verdict, the basket foot and the day's assumption all already know
         that, and now so does the one control that acts on it.
     *
         Null means the meal is not in the slot list at all, which the card
         this button sits on cannot be — there is nothing to solve against, so
         nothing is solved rather than a share being invented. */
      /* Toward what the meal is asked for NOW, not what it was planned for.
       *
         This is the button Blake had in mind when he asked to see the slack
         move: solving dinner to a 677-kcal plan after a breakfast that ran a
         thousand over would push the day further past itself while claiming
         to balance it. Aimed at the live share, the plates walk toward the
         number on the card — which is also the first time this button has
         shown what it was aiming at. */
      var ask = mMealAsk(sk, targets, slots);
      if (!ask) return;
      var sh = ask.now;
      var T = { p: sh.p, f: sh.f, c: sh.c };
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
          /* The same per-plate ladder mBalanceDay uses — see mLadder. */
          var rungs = mLadder(BY_ID[it.id], it.x);
          for (var i = 0; i < rungs.length; i++) {
            it.x = rungs[i];
            var pv = pen();
            if (pv < bestPen - 1e-9) { bestPen = pv; best = rungs[i]; }
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
    /* kx: the calories no gram accounts for. mBuildFoods works a food's
       calories out from its grams whenever it has any, and a part that was
       only ever a number of calories — "700 at a friend's" — has none, so a
       kept lunch of that plus a chicken breast came back as the chicken
       breast: 858 kcal saved, 164 counted. Carried beside the grams so the
       rebuild can add it back, and only when it is more than rounding. */
    var kx = mac.kcal - kcalOf({ p: mac.p, f: mac.f, c: mac.c });
    mine[key] = { name: name, unit: 'plate', kcal: mac.kcal, p: mac.p, f: mac.f, c: mac.c,
      na: mac.na, fib: mac.fib, parts: parts };
    if (kx >= 5) mine[key].kx = kx;
    mWriteMyFoods(mine);
    mBuildFoods();
    return 'f:my:' + key;
  }

  /* How many "not that one"s it takes before a meal is allowed to look
     outside its own sections. */
  var MTRY_WIDE = 10;

  /* ---------------------------------------------------------------- combos
   *
     Why a combo works when a recipe does not.
   *
     Scaling a barbacoa moves protein, fat and carbohydrate together — one
     knob wired to three dials — so the solver can land the meal's calories
     and still miss every macro under them. A food that takes most of its
     energy from ONE macro is a lever: move it and the other two barely
     stir. Three levers are three independent knobs, and three knobs can hit
     any share exactly. That is the whole idea, and it is the reason
     mBalanceDay struggles on a day of ordinary dishes.

     Egg whites are 90% protein by calories, ranch 93% fat, salsa 75% carb
     at twenty-nine calories a hundred grams. Cheddar and beef roast are
     NOT protein levers whatever they feel like — 74% and 71% of their
     energy is fat, which is worth knowing before you build a steak dinner
     to hit a protein number.

     `lever` is a flag of its own and not a reuse of `eat`, because the best
     fat levers are the condiments — oil, butter, dressing — and those were
     deliberately kept out of `eat` on the grounds that they go ON food
     rather than being food. In a combo that is exactly their job. */
  var MLEV_PURE = 0.6;          // a lever earns the name at 60% of its calories
  var MLEV_MIN = 0.25;          // below a quarter portion it is a garnish, not a lever
  var MLEV_MAX = 4;

  function mLeverDom(r) {
    var m = r && r.macro;
    if (!m) return null;
    var kp = (m.p || 0) * 4, kf = (m.f || 0) * 9, kc = (m.c || 0) * 4;
    var tot = kp + kf + kc;
    if (!(tot > 0)) return null;
    var d = kp >= kf && kp >= kc ? 'p' : (kf >= kc ? 'f' : 'c');
    var pur = (d === 'p' ? kp : d === 'f' ? kf : kc) / tot;
    return pur >= MLEV_PURE ? { d: d, pur: pur } : null;
  }

  /* The bench, built once. Sorted by purity so the first choice on each rung
     is the cleanest lever available and ‹ › walks down toward the ones that
     bring more baggage with them. */
  var MLEVERS = null;
  /* What the cached bench was built FROM, so it cannot outlive its inputs.
   *
     Two things move it. MFOODS is rebuilt whenever a food of your own is
     saved, and the external-food setting decides whether half the fat rungs
     exist at all — a cache built while the setting was off would go on
     offering three-quarters of a tablespoon of Oil after it was turned on,
     with nothing to say why. Keyed rather than cleared, because clearing
     relies on remembering every place either input changes and this file
     already carries one comment about a cache that went stale exactly that
     way. */
  var MLEVERS_ON = null;
  function mLevers() {
    var levKey = MFOODS.length + ':' + (mExtOk() ? 1 : 0);
    if (MLEVERS_ON !== levKey) { MLEVERS = null; MLEVERS_ON = levKey; }
    if (!MLEVERS) {
      MLEVERS = { p: [], f: [], c: [] };
      MFOODS.forEach(function (r) {
        /* The rungs the closers band is built from. Gated with the rest, so
           the opt-in turns the whole vocabulary on at once rather than the
           picker recommending an almond the draft may not use. */
        if (r.ext && !mExtOk()) return;
        if (!(r.eat || r.side || r.lever)) return;
        if (!r.macro || (r.macro.kcal || 0) < 8) return;
        var dm = mLeverDom(r);
        if (!dm) return;
        MLEVERS[dm.d].push({ r: r, pur: dm.pur });
      });
      /* Sorted by purity ALONE this built canned tuna, applesauce and a
         spoon of oil — three perfect levers and nothing anybody would eat.
         The purest fat source on the shelf is oil, at a hundred per cent, and
         that is exactly the problem: purity measures how cleanly a food moves
         one macro, not whether it is food.

         So something you would eat as part of a meal outranks a condiment
         even when the condiment is cleaner. Cheddar at 74% fat comes before
         oil at 100%; the oil is still there, one tap down the rung, for the
         day you want the fat and not the cheese. `lever`-only is precisely
         the set of things that go ON food rather than being it, which is why
         that flag is the one to sort behind. */
      ['p', 'f', 'c'].forEach(function (d) {
        MLEVERS[d].sort(function (a, b) {
          var af = (a.r.eat || a.r.side) ? 1 : 0, bf = (b.r.eat || b.r.side) ? 1 : 0;
          return (bf - af) || (b.pur - a.pur);
        });
      });
    }
    return MLEVERS;
  }

  /* A portion that hits `want` grams of macro `m`, snapped to the quarter
     steps the stepper already moves in, and refused outright below a quarter
     — a tenth of a serving of dressing is a rounding error wearing a name. */
  function mLeverX(r, m, want) {
    var per = (r.macro && r.macro[m]) || 0;
    if (!(per > 0) || !(want > 0)) return 0;
    var x = Math.round((want / per) * 4) / 4;
    if (x < MLEV_MIN) return 0;
    return Math.min(MLEV_MAX, x);
  }

  /* Build one. `pick` carries an index per rung so ‹ › can walk a rung
     without disturbing the other two — the sizes resize around whatever you
     land on, which is the point of choosing.
   *
     Protein first because it is the macro worth being exact about and the
     bench is thinnest there; then carbohydrate, then fat, because the fat
     lever is the purest of the three and so the best thing to close with.
     Two passes: sizing the carb lever moves the fat total a little, and one
     more sweep takes the residual out. */
  /* How often each food has landed in THIS meal before.
   *
     Purity is the right answer to "what moves one macro cleanly" and the
     wrong answer to "what do you eat in the morning". Canned tuna is the
     purest protein on the shelf you can eat as it comes, and offering it at
     seven a.m. is how a panel gets ignored.

     The fix is not a `breakfast: 1` flag on the food table. The slots are
     yours to name and reorder — a food tagged for breakfast would be the app
     deciding what breakfast is on the one screen where you already decided.
     What orders the rungs instead is what you have actually put in this meal
     before. It opens on purity and becomes yours. */
  function mSlotSeen(slot) {
    var seen = {};
    if (!slot) return seen;
    Object.keys(MDAYS).forEach(function (k) {
      ((MDAYS[k] || {})[slot] || []).forEach(function (it) {
        seen[it.id] = (seen[it.id] || 0) + 1;
      });
    });
    return seen;
  }

  function mComboFor(share, pick, slot) {
    var bench = mLevers();
    if (slot) {
      var seen = mSlotSeen(slot);
      var by = {};
      ['p', 'f', 'c'].forEach(function (m) {
        /* A copy — mLevers() hands back the one cached bench, and sorting it
           in place would reorder every other reader by whichever meal asked
           last. */
        by[m] = bench[m].filter(function (e) {
          return mFoodMealOK(e.r, slot);
        }).sort(function (a, b) {
          /* History first, then the ladder's own order — BOTH of its terms.
             Sorting on history-then-purity alone quietly dropped the rule
             that a food outranks a condiment, and breakfast came back
             offering three quarters of a tablespoon of oil: oil is 100% fat
             and cheddar is 74%, which is exactly why purity cannot be the
             last word on its own. */
          var af = (a.r.eat || a.r.side) ? 1 : 0, bf = (b.r.eat || b.r.side) ? 1 : 0;
          return ((seen[b.r.id] || 0) - (seen[a.r.id] || 0)) || (bf - af) || (b.pur - a.pur);
        });
      });
      bench = by;
    }
    var chosen = [];
    ['p', 'c', 'f'].forEach(function (m) {
      var rung = bench[m];
      if (!rung.length) return;
      var i = ((pick && pick[m]) || 0) % rung.length;
      chosen.push({ m: m, r: rung[i].r, x: 0 });
    });
    if (!chosen.length) return null;
    var pass, held;
    for (pass = 0; pass < 2; pass++) {
      chosen.forEach(function (c) {
        held = { p: 0, f: 0, c: 0 };
        chosen.forEach(function (o) {
          if (o === c || !o.x) return;
          held.p += (o.r.macro.p || 0) * o.x;
          held.f += (o.r.macro.f || 0) * o.x;
          held.c += (o.r.macro.c || 0) * o.x;
        });
        c.x = mLeverX(c.r, c.m, (share[c.m] || 0) - held[c.m]);
      });
    }
    return chosen.filter(function (c) { return c.x > 0; });
  }

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
  /* Whether Fill may draft food the storehouse does not stock.
   *
     Off unless it is turned on, and off is the honest default: a day built
     out of salmon and almonds is not a day if there is no salmon in the
     house. Turned on, it is the right answer for a Blake who is happy to
     stop at a shop on the way home — which is exactly how he asked for it.
   *
     This gates DRAFTING only. Searching and logging an external food is
     always allowed, because looking one up is how you decide to go and buy
     it. */
  function mExtOk() { return !!mReadProfileRaw().extFill; }

  function mMealPool(slot, wide) {
    var secs = wide ? mAllSecs() : mSlotSecs(slot);
    var pool = RECIPES.filter(function (r) {
      return secs.indexOf(r.book + '-' + r.secNum) >= 0;
    });
    var ext = mExtOk();
    /* No meal filter here, deliberately. This pool is what the picker LETS
       YOU LOOK THROUGH for a meal, and `meals` is about what gets SUGGESTED —
       the same line the ext gate is held to a few lines up in mpFitsHTML.
       Filtering here emptied whole shelves out of the rail at breakfast while
       the search box went on finding every one of them, which is a shelf that
       disagrees with itself. The tag does its work in mComboFor, mTopUp and
       mSideUp, which are the three places something is offered unasked. */
    MFOODS.forEach(function (r) {
      if (r.ext && !ext) return;
      if (r.eat || r.side) pool.push(r);
    });
    return pool;
  }

  /* Every section there is, from the data rather than from a list here — a
     book gaining a section should not need this remembering.
   *
     Cached because a widened meal rebuilds its pool on every "not that one",
     and dropped by rebuild() whenever RECIPES is replaced. The list is an
     answer ABOUT RECIPES; it can only outlive that array by lying, and the
     lie is silent — a section missing from here is a recipe that is simply
     never offered, with nothing anywhere to say it was skipped. */
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
    /* Eaten calories are CARRIED. A target's are DERIVED. They are two
       different quantities and only one of them has a second answer.
     *
       A plate states its own energy: a packet's label uses factors particular
       to that food, and a food typed in with nothing but its calories has no
       grams to derive from at all. A target is grams and has nothing else it
       could be.
     *
       This sheet ran 4P + 4C + 9F over both. The day bar carries, so the two
       disagreed about the same day — 2,006 on the bar against 2,005 here on
       an ordinary one — and a calories-only plate scored nothing at all: a
       700 kcal salad logged at breakfast read "Nothing was written down on
       this day" underneath a bar that said 700. That is the whole of what a
       person who ate out has to show for writing it down.
     *
       The same rule is already written out above mDayEaten, where the picker
       was fixed for exactly this. It never reached this function. The local
       helper that made the mistake possible is deleted rather than corrected:
       kcalOf is the one way to turn a target into calories, and there is now
       nothing in scope that will quietly do it to a plate. */
    var got = Math.round(tot.kcal || 0), want = kcalOf(T);

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
      /* Calories count as something written down, here as everywhere else on
         this sheet. A week of eating out was a week of blank bars. */
      var has = (dt.p + dt.f + dt.c + (dt.kcal || 0)) > 0;
      var hit = null;
      if (has) {
        kept++;
        sumK += (dt.kcal || 0);
        hit = mVerdict('p', dt.p, dT.p) === 'on' ? 1 : 0;
        if (hit) onP++;
      }
      week.push({ k: dk, kcal: has ? Math.round(dt.kcal || 0) : null,
        want: kcalOf(dT), hit: hit, today: dk === k,
        v: has ? mVerdict('kcal', dt.kcal || 0, kcalOf(dT)) : null,
        lab: M_WDAYS[dd.getDay()].slice(0, 1) });
    }

    /* A day barely written down is not a day of great restraint, and this is
       the one state these cards usually lie about. It does not guess which it
       was — it says it cannot tell. */
    var thin = got > 0 && got < want * 0.45;
    return { rows: rows, week: week, onP: onP, kept: kept, meals: meals,
      biggest: biggest, mTot: mTot, got: got, want: want, thin: thin,
      avg: kept ? Math.round(sumK / kept) : 0,
      any: (tot.p + tot.f + tot.c + (tot.kcal || 0)) > 0 };
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
      /* The repeat guard Fill uses, so "not that one" does not answer with
         yesterday's dinner — unless it is all that is left to offer. */
      var near = mNearIds(k);
      var pool0 = mMealPool(srec, tries >= MTRY_WIDE - 1).filter(function (r) {
        return !mOnDay(day, r.id) && dropped.indexOf(r.id) < 0 && !mNever(r.id);
      });
      var fresh = pool0.filter(function (r) { return !near[r.id]; });
      var pool = fresh.length ? fresh : pool0;

      var ranked = mRank(pool, day, targets, srec).filter(function (e) { return e.score !== null; });
      if (!ranked.length) return;
      S.mTry[cursorKey] = tries;
      var pick = ranked[tries % ranked.length];
      /* The machine's pick, marked as the machine's: without `by` it read as
         placed by hand, and Fill never sized it again. */
      day[sk].push({ id: pick.r.id, x: pick.x, eaten: 0, by: 'f' });
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
        '</div>' + varyHTML(r, false) + liftHTML(r, false) + '</div>' +
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

  /* ---- The search row on Recipes ----

     One box, pinned under the header from the top of the page. What comes
     and goes is the Filters button beside it: once the filter bar below has
     scrolled up under the row, the button appears and unfolds the real bar
     in place. Nothing is measured but where the bar is. */
  var stripRaf = 0;
  function filtCount() {
    var n = 0;
    if (S.bookF !== 'all') n++;
    if (S.secF !== 'all') n++;
    if (S.diffF !== 'all') n++;
    if (S.pantryF !== 'all') n++;
    if (S.sort !== 'book') n++;
    if (S.favOnly) n++;
    return n;
  }
  function syncStrip() {
    stripRaf = 0;
    var st = $('brwStrip'), sec = $('view-browse');
    var bar = document.querySelector('#view-browse .filters');
    if (!st || !sec || !bar) return;
    /* Unfolded, the bar is a fixed panel and its edges say nothing about
       the page; a redraw under it — picking a filter — must not read it as
       "scrolled back to the top" and fold it away mid-choice. */
    if (bar.classList.contains('pop') && S.view === 'browse') return;
    var on = S.view === 'browse' &&
      bar.getBoundingClientRect().bottom <= st.getBoundingClientRect().bottom + 1;
    if (on === sec.classList.contains('stripped')) return;
    sec.classList.toggle('stripped', on);
    /* Fold the bar away with the button that opened it; a fixed panel over a
       page that has scrolled back to its own copy of the same controls is
       the one arrangement that would confuse. */
    if (!on) filtersPop(false);
  }
  function onScrollStrip() {
    if (stripRaf) return;
    stripRaf = requestAnimationFrame(syncStrip);
  }
  /* The real filter bar, unfolded under the header. Same element, so every
     control keeps its wiring and its state; only where it sits changes. */
  function filtersPop(open) {
    if (open === S.filtPop) return;
    S.filtPop = open;
    document.querySelector('#view-browse .filters').classList.toggle('pop', open);
    $('brwScrim').classList.toggle('hide', !open);
    $('filtBtn').setAttribute('aria-expanded', String(open));
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
    all: { file: 'Both-Books.pdf', label: 'Both books', pages: 296 },
    one: { file: 'Hive-and-Hearth-Recipes.pdf', label: 'One book', pages: 288 },
    1: { file: 'Run-and-Not-Be-Weary.pdf', label: 'Run and Not Be Weary', pages: 116, booklet: true },
    2: { file: 'Around-the-Table.pdf', label: 'Around the Table', pages: 180, booklet: true }
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
  /* Another way to make it, from what the order already carries. Listed
     under the method rather than inside a step, because inside a step it
     read as part of the recipe: Blake, on the sour cream in the waffles,
     "it was hard for me to see that that was even an option." Above the
     lift, since it needs no shopping. Never counted — the numbers are the
     recipe as written. */
  function varyHTML(r, live) {
    var V = r.vary;
    if (!V || !V.length) return '';
    if (!live) {
      return '<div class="vary"><span class="vary-h">' + (V.length > 1 ? 'Variations' : 'Variation') +
        '</span> <span class="vary-p">' + V.map(function (t) { return xref(esc(t), false); }).join(' ') +
        '</span></div>';
    }
    return '<div class="vary">' +
      '<div class="vary-h">' + (V.length > 1 ? 'Variations' : 'Variation') + '</div>' +
      V.map(function (t) { return '<div class="vary-i">' + xref(esc(t), true) + '</div>'; }).join('') +
    '</div>';
  }

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
   * Never a recipe pointing at itself: a tortilla recipe pointing at the
   * tortilla recipe is noise, and so is the gravy telling you where to get
   * gravy. */
  function makerFor(r, ix) {
    var M = window.MAKERS;
    var it = (r.ingp || [])[ix];
    if (!M || !it || !it.k) return null;
    var id = M[it.k];
    if (!id || id === r.id) return null;
    if (r.nomake && r.nomake.indexOf(it.k) >= 0) return null;
    /* Any section. This refused a maker from the reader's own section, to
       keep the tortilla recipe from pointing at the tortilla recipe — which
       the line above already does by id — and it also hid the one link that
       mattered most on the Copycat Shelf: taco beef to the taco seasoning
       beside it. */
    return BY_ID[id] || null;
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
    'data-mslot', 'data-meat', 'data-mstep', 'data-mdel', 'data-mpick', 'data-mpout', 'data-mtarg', 'data-mlock', 'data-mpin', 'data-mfav', 'data-mtry', 'data-mdot', 'data-medit', 'data-mskip', 'data-msend',
    'data-mtsex', 'data-mtgoal', 'data-mtext', 'data-mtact', 'data-mtwk', 'data-mtedit', 'data-mtmfold', 'data-mtsec', 'data-mtfree', 'data-mtuse', 'data-mtw', 'data-mysync', 'data-mpnew', 'data-mplook', 'data-nf', 'data-nfpick', 'data-scan',
    'data-mmore', 'data-fppick', 'data-fpmore', 'data-nfcode', 'data-mpmode', 'data-mpshelf', 'data-mpbasket', 'data-mbstep', 'data-mpdone', 'data-mweek', 'data-mfold', 'data-mtrain', 'data-mtdee', 'data-mpfav', 'data-mline', 'data-mchart', 'data-mchartopen', 'data-mpslot', 'data-mbal', 'data-mkeep', 'data-mkdo', 'data-mfood', 'data-mpills', 'data-mtrained', 'data-mwhy', 'data-mdo', 'data-mallow'];

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
    if (!back || !back.focus) return;
    /* Focus without scrolling to it.
     *
       A plain focus() brings its element into view, and this runs AFTER the
       scroll position has been restored — so it overrode the restore and
       moved the list under the finger. It went unnoticed while the element
       usually vanished on a re-render (focus fell to the body and nothing
       scrolled); the moment picked rows started staying put, every tap on a
       picker row jumped the list to wherever that row had moved to.
     *
       preventScroll is ignored by browsers that do not know it, which leaves
       them exactly where they were before. */
    try { back.focus({ preventScroll: true }); } catch (e) { back.focus(); }
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
    /* One box. It was three — #mpFind, #mpSearch and #mpLookIn — one per
       screen, back when the picker had three. Two of those screens went in
       v283 and the fallbacks outlived them, quietly asking for elements that
       can no longer be rendered. */
    var mq = root.querySelector('#mpFind');
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

    if (S.favPick) {
      root.innerHTML = mFavPickHTML();
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
    var scaleLabel = mScaleWords(f, r) || (fmtNum(f) + '×');

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
        varyHTML(r, true) +
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
          (f !== 1 ? '<span class="addto addto-x">' + (mScaleWords(f, r) || ('at &times;' + fmtNum(f))) + '</span>' : '') +
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
      /* An invite link replaces reading the code out: it lets in one person,
         once, and is dead in a week. Only for an account — the rules want to
         know who is handing out the door. */
      var invite = !mAccount()
        ? '<p class="sync-note">Sign in above to invite someone with a link.</p>'
        : S.inviteUrl
          ? '<div class="sync-row"><input class="txt" id="inviteUrl" readonly value="' + esc(S.inviteUrl) +
              '" aria-label="Invite link"></div>' +
            '<div class="sync-row">' +
              (navigator.share ? '<button class="btn-primary" data-sync="inviteshare">Send</button>' : '') +
              '<button class="ghost" data-sync="invitecopy">' + (S.inviteCopied ? 'Copied' : 'Copy link') + '</button>' +
            '</div>' +
            '<p class="sync-note">Works once, for 7 days.</p>'
          : '<div class="sync-row"><button class="btn-primary" data-sync="invite"' +
              (S.inviteMaking ? ' disabled' : '') + '>' +
              (S.inviteMaking ? 'Making a link\u2026' : 'Invite someone') + '</button></div>';
      body = invite +
        '<div class="sync-code">' + esc(house) + '</div>' +
        (window.Store.statusNote ? '<div class="sync-warn">' + esc(window.Store.statusNote) + '</div>' : '') +
        '<div class="sync-row"><button class="ghost" data-sync="leave">Stop sharing here</button></div>';
    }
    var inviteLine = S.inviteMsg ? '<div class="sync-warn">' + esc(S.inviteMsg) + '</div>'
      : mInviteGet() && !mAccount()
        ? '<div class="sync-warn">You have been invited to a pantry. Sign in above to join it.</div>' : '';

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
        '<p class="sync-p">Your plan, meals and weigh-ins. Private to you. Signed in, ' +
        'your pantry comes with you to every device too.</p>' +
        mAccountBlockHTML() +

        '<div class="mt-div">Your pantry</div>' +
        '<p class="sync-p">The shopping list, the week&rsquo;s meals and your favorites &mdash; shared ' +
        'with whoever you invite. Without an account or a code they stay on this device.</p>' +
        inviteLine +
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
    dayTargets: mDayTargets,
    measured: mMeasuredTdee,
    tryAgain: mTryAgain,
    assumed: function () { var k = mViewKey(); return mAssumed(mDay(k), mDayTargets(k), mReadSlots()); },
    face: mPlanFace,
    tdee: mTdee,
    summary: mSummaryHTML,
    ask: function (sk) { return mMealAsk(sk, mDayTargets(mViewKey()), mReadSlots()); },
    slotFor: function (id) { var sl = mSlotForRecipe(BY_ID[id], mReadSlots()); return sl ? sl.k : null; },
    /* The profile as the app reads it — weight from the scale, not the stale
       copy in storage. Exposed so a test can check the arithmetic against the
       number actually used instead of keeping its own copy of the averaging
       rule, which is how the mFoodServing duplicate drifted. */
    profile: mReadProfile,
    /* The merge, so the rules that decide what survives a second device can
       be asserted without one. The closed-day rule in particular is easy to
       get wrong in a way no single-device test would ever notice. */
    merge: mMergeRemote,
    /* And what this device would SEND, for the same reason. Half of a sync
       bug lives on the sending side — a day the payload never mentions is a
       day the other phone never hears has changed — and that half is
       invisible to a test that only exercises the merge. */
    payload: mSyncPayload,
    /* What the next push would actually send, so a test can weigh it against
       the whole. */
    partial: function () { return mSyncPartial(); },
    /* Exactly what a push takes, and taking it counts — so a test walks the
       same states a real session does. */
    takePush: function () { return mSyncTake(); },
    dirty: function () { return mDirty; },
    /* And "this device is right", because the sheet that carries the button
       only renders signed in, and the bug it once had — a number written
       over the weight map — was invisible until the next weigh-in. */
    claim: mClaimAll,
    /* The plan calculator and the pace facts, so a test can ask for the
       figures instead of re-deriving the arithmetic beside them. */
    plan: mPlanCalc,
    pace: mPaceFacts,
    /* And what the solver prices each meal against, so a test can hold it
       to the figure on the meal's own pills without re-running the descent
       — which the day-level terms can win on their own. */
    wants: function () { return mMealWants(mDay(mViewKey()), mDayTargets(mViewKey())); },
    /* The account half's state, and the door that sets it. A reachability
       failure used to be overwritten by the next call to this, and that
       overwrite is only visible if a test can make the second call. */
    syncState: function () { return S_SYNC_STATE; },
    syncStart: function () { return mSyncStart(); },
    bodyFat: mBodyFat,
    trained: function (k) { return { said: mTrainedSaid(k), on: mIsTrainingDay(k) }; },
    setTrained: mSetTrained,
    floorK: mFloorK,
    /* The gauge's band rule, because it only bites in a narrow window and no
       arbitrary day's plates land in it — asked through the DOM the test
       passed with the rule removed. */
    gauge: mGauge,
    /* Every single food the day can draw on, as records. A food reaches a
       plate by a different road from a recipe — built here at boot rather
       than in the build — so "one calorie, four-four-nine" has to be provable
       on this road too, and MFOODS is a closure variable no test could see.
       A test that reached for `window.MFOODS` found undefined and passed on
       an empty list, which is the vacuous green this seam exists to stop. */
    foods: function () { return MFOODS; },
    /* The lever bench and the combo builder, so how CLOSE a combo lands can be
       measured over hundreds of shares rather than eyeballed on one. */
    levers: function () {
      var b = mLevers(), out = {};
      ['p', 'f', 'c'].forEach(function (d) {
        out[d] = b[d].map(function (e) {
          return { id: e.r.id, name: e.r.name, purity: e.pur };
        });
      });
      return out;
    },
    /* The foods that close the open meal, in the order the levers rank them,
       BEFORE the list dedupes them against the bands above. What a row ends
       up under is a rendering question; which food each rung opens on is the
       rule, and it stopped being observable in the DOM the moment a food you
       ate yesterday started being claimed by "Recent" instead. */
    closers: function () {
      var gap = mComboGap(mViewKey());
      if (!gap) return null;
      var c = mComboFor(gap, { p: 0, f: 0, c: 0 }, S.macroPick && S.macroPick.slot);
      return c && c.map(function (e) {
        return { m: e.m, id: e.r.id, name: e.r.name, x: e.x };
      });
    },
    combo: function (share, pick) {
      var c = mComboFor(share, pick);
      return c && c.map(function (e) {
        return { m: e.m, id: e.r.id, name: e.r.name, x: e.x,
          p: (e.r.macro.p || 0) * e.x, f: (e.r.macro.f || 0) * e.x,
          c: (e.r.macro.c || 0) * e.x, kcal: (e.r.macro.kcal || 0) * e.x };
      });
    },
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
    ['browse', 'plan', 'macros', 'train', 'list', 'pantry', 'book'].forEach(function (v) {
      $('view-' + v).classList.toggle('hide', S.view !== v);
    });
    /* The book has no tab of its own any more; it opens from Recipes, so
       Recipes is the tab that stays lit while it is up. */
    var lit = S.view === 'book' ? 'browse' : S.view;
    document.querySelectorAll('.tab').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.dataset.view === lit));
    });
    if (S.view === 'browse') renderBrowse();
    if (S.view === 'plan') renderPlan();
    if (S.view === 'macros') renderMacros();
    /* Train draws itself — src/train.js — and is only told when to. */
    if (S.view === 'train' && window.Train) window.Train.render();
    if (S.view === 'list') renderList();
    if (S.view === 'pantry') renderPantry();
    if (S.view === 'book') renderBook();
    syncShrunk();
    syncStrip();
  }

  /* The six tabs fit a 360px phone, so the fade would be a lie there. It
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
    $('bookBtn').addEventListener('click', function () {
      S.view = 'book';
      try { localStorage.setItem('sh.view', S.view); } catch (e) { /* private mode */ }
      renderView();
      window.scrollTo(0, 0);
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
    $('filtBtn').addEventListener('click', function () { filtersPop(!S.filtPop); });
    $('filtersDone').addEventListener('click', function () { filtersPop(false); });
    $('brwScrim').addEventListener('click', function () { filtersPop(false); });
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

      /* Tap the number, type a number. The render puts a box where the words
         were; this focuses it and selects what is in it, so the first key
         replaces the portion rather than appending to it — nobody taps a
         portion in order to add a digit to the end of it. */
      var ty = e.target.closest('[data-mtype]');
      if (ty) {
        S.mType = ty.dataset.mtype;
        renderMacros();
        var box = $('macroSlots').querySelector('.mstep-in');
        if (box) { box.focus(); box.select(); }
        return;
      }

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

      /* Where a meal's miss goes. Tapping a meal adds it to the queue rather
         than replacing what is there, because one tap takes only what that
         meal can hold — if it did not cover the miss the line says how much is
         still to place and the next tap continues it. Tapping the same meal
         twice takes it back out, so a mis-tap costs one tap and not a trip
         through Start over. */
      var snd = e.target.closest('[data-msend]');
      if (snd) {
        var sv = snd.dataset.msend;
        var sKey2 = mViewKey();
        var slots2 = mReadSlots();
        var ev2 = mLastFinished(mDayTargets(sKey2), slots2);
        var cur = mSendOf(sKey2);
        if (!cur || !ev2 || cur.f !== ev2.k) {
          cur = { f: ev2 ? ev2.k : '', to: [], off: false, ack: false };
        }
        /* Which meals the list is offering. Needed because an empty `to` is
           stored for "all of them" — the default — and a checkbox list has
           to turn that into every box ticked before one can be cleared. */
        var dayN2 = mDay(sKey2);
        var openK = [];
        slots2.list.forEach(function (s2) {
          if (mMealDone(s2.k)) return;
          if (mSkipped(sKey2, s2.k) && !(dayN2[s2.k] || []).length) return;
          openK.push(s2.k);
        });

        if (sv === 'ack') cur.ack = true;
        else if (sv === 'open') cur.ack = false;
        else if (sv === 'all') { cur.to = []; cur.off = false; }
        else if (sv === 'none') { cur.to = []; cur.off = true; }
        else if (openK.indexOf(sv) >= 0) {
          /* A tick, not a queue position. An empty `to` means every box is
             ticked, so clearing the first one has to write out the rest. */
          var set = cur.off ? [] : (cur.to.length ? cur.to.slice() : openK.slice());
          var at = set.indexOf(sv);
          if (at >= 0) set.splice(at, 1); else set.push(sv);
          /* Two normalisations, so one state has one spelling: every meal
             ticked is the default, and no meal ticked is None. */
          var all = openK.every(function (k) { return set.indexOf(k) >= 0; });
          cur.to = (all || !set.length) ? [] : set;
          cur.off = !set.length;
        }
        mSetSend(sKey2, cur);
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

      /* One meal open at a time.
       *
         The mockup Blake approved says so in those words, and it holds a
         single key rather than a map: opening a meal is also the act of
         shutting the last one. Six meals that can all be open at once is six
         screenfuls of steppers to scroll past to reach the one you are
         actually filling, which is the thing the fold was for.
       *
         The map survives underneath — the print handler saves and restores
         it, the scroll-linked fold reads it, and the weigh-in card keeps its
         own key in it — so this closes the siblings rather than changing what
         is stored. Shutting the open meal leaves every meal shut, which is
         what pressing an open door should do. */
      var fold = e.target.closest('[data-mfold]');
      if (fold) {
        var fk = fold.dataset.mfold;
        var opening = fold.getAttribute('aria-expanded') === 'false';
        if (opening && fk !== 'weigh') {
          mReadSlots().list.forEach(function (s2) {
            if (s2.k !== fk) S.mFold[s2.k] = true;
          });
          Object.keys(mDay(mViewKey())).forEach(function (dk) {
            if (dk !== fk) S.mFold[dk] = true;
          });
        }
        S.mFold[fk] = !opening;
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
          it.x = mStepX(BY_ID[it.id], it.x, sp[2] === 'up' ? 1 : -1);
        });
        keepingFocus(renderMacros);
        return;
      }
      var why = e.target.closest('[data-mwhy]');
      if (why) {
        S.mWhyOpen = S.mWhyOpen === why.dataset.mwhy ? '' : why.dataset.mwhy;
        keepingFocus(renderMacros);
        return;
      }
      var mdo = e.target.closest('[data-mdo]');
      if (mdo) {
        var dq = mdo.dataset.mdo.split(':');       // action:slot:index
        var dk = mViewKey(), dsk = dq[1], dix = Number(dq[2]);
        var dit = (mDay(dk)[dsk] || [])[dix], dr = dit && BY_ID[dit.id];
        S.mWhyOpen = '';
        if (!dit || !dr) { renderMacros(); return; }
        if (dq[0] === 'swap') {
          mReplacePlate(dk, dsk, dix);
        } else if (dq[0] === 'never') {
          mSetNever(dr.id, true);
          /* Off today too when it was only ever a suggestion; kept when you
             put it there or already ate it — the rule is about suggesting. */
          if (!dit.eaten && !dit.l && (dit.by === 'f' || dit.by === 'w')) mReplacePlate(dk, dsk, dix);
          mToast(esc(dr.name) + ' won\u2019t be suggested.', dr.id);
        }
        renderMacros();
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
      /* The star, on a plate. It only lived in the picker before, so you
         could keep a dish while shopping for it but not on the day you ate
         it — and the day you ate it is the day you know. */
      var mfv = e.target.closest('[data-mfav]');
      if (mfv) {
        var fvr = BY_ID[idOf(mfv.dataset.mfav)];
        if (fvr && mCanFav(fvr)) { mToggleFav(fvr); keepingFocus(renderMacros); }
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

    /* Committing a typed portion, and the two ways out of it.
     *
       Enter commits and blur commits, because a phone has no Enter worth
       relying on and tapping elsewhere is what "I am done" looks like there.
       Escape leaves the portion as it was. Nothing is written while typing:
       a re-render mid-keystroke would take the box away under the thumb. */
    function mCommitTyped(box) {
      if (!box || !box.dataset.mtypein) return;
      var sp = box.dataset.mtypein.split(':');
      var typed = parseFloat(String(box.value).replace(/[^0-9.]/g, ''));
      S.mType = null;
      mEditDay(mViewKey(), function (day) {
        var it = (day[sp[0]] || [])[Number(sp[1])];
        if (!it) return;
        var nx = mXFromTyped(BY_ID[it.id], typed);
        /* Nonsense is not a portion. An empty box, a stray letter or a nought
           leaves the plate exactly as it was rather than writing a zero and
           quietly taking the food off the day's arithmetic. */
        if (nx !== null) it.x = nx;
      });
      renderMacros();
    }

    $('macroSlots').addEventListener('keydown', function (e) {
      if (!e.target.classList || !e.target.classList.contains('mstep-in')) return;
      if (e.key === 'Enter') { e.preventDefault(); mCommitTyped(e.target); return; }
      if (e.key === 'Escape') { e.preventDefault(); S.mType = null; renderMacros(); }
    });
    $('macroSlots').addEventListener('focusout', function (e) {
      if (!e.target.classList || !e.target.classList.contains('mstep-in')) return;
      if (S.mType === null) return;                 // already committed by Enter
      mCommitTyped(e.target);
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
    /* One button, two jobs, and which one it is doing is written on its face.
       With no plan there is nothing to fill and the press opens the sheet
       that makes one — see the note where the label is set. */
    $('macroFill').addEventListener('click', function () {
      var mode = $('macroFill').dataset.mode;
      if (mode === 'plan') { mOpenTargets(); return; }
      if (mode === 'fill') { mFillDay(); return; }
      /* The meal dot one level up: it ticks a whole meal, this ticks the
         whole day. Recording that you ate it is exactly what it claims to
         do, so a meal you did not eat wants the skip rather than this. */
      if (mode === 'tickall') {
        mEditDay(mViewKey(), function (d2) {
          Object.keys(d2).forEach(function (sk) {
            (d2[sk] || []).forEach(function (it) { it.eaten = 1; });
          });
        });
        renderMacros();
        return;
      }
      /* Done for the day. A statement, not a change: nothing is deleted,
         food can still be added, and pressing it again takes it back. The
         card comes up on the way IN and not on the way out — closing is the
         moment you want to be told how it went; reopening is a correction. */
      var dk = mViewKey();
      var was = mDoneAt(dk) > 0;
      mSetDone(dk, !was);
      if (!was) {
        rememberOpener();
        S.mDoneOpen = dk;
        pushSheet({ m: 1 });
        renderModal();
      }
      renderMacros();
    });

    /* Sweep the day back to what you actually ate.
     *
       Keeps every plate you ticked — clearing those would destroy a record
       rather than a plan, and the morning is usually the part you are not
       trying to change — and keeps anything you locked, because a lock is
       you saying this one stays. Everything else goes, so Fill redrafts only
       the meals it emptied.
     *
       It does not ask. Blake's call, and the same bargain the meal dot and
       the tick beside it already make: this bar acts, it does not negotiate.
       Worth knowing that there is no undo anywhere in this app, so a mis-tap
       here costs the un-eaten half of a day. */
    $('macroSweep').addEventListener('click', function () {
      /* Pinned plates stay too: a pin is your routine for that meal, and
         Blake expected the sweep to leave "locked or pinned items". */
      var pinsOf = {};
      mReadSlots().list.forEach(function (sl) {
        pinsOf[sl.k] = (sl.pins || []).map(function (pn) { return String(pn.id); });
      });
      mEditDay(mViewKey(), function (d2) {
        Object.keys(d2).forEach(function (sk) {
          d2[sk] = (d2[sk] || []).filter(function (it) {
            return it.eaten || it.l || (pinsOf[sk] || []).indexOf(String(it.id)) >= 0;
          });
        });
      });
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

    /* The bar's barcode button has gone: it opened the same sheet the plus
       opens, one step further in, and that sheet carries a camera in its own
       search field. Blake: "the plus button and the scanner button are the
       same thing." One door, and the lens is inside it. */

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
      if (b.dataset.mmore === 'foods') {
        S.macroTargOpen = false; S.favPick = true; S.fpOpen = {};
        renderModal();
        return;
      }
      if (b.dataset.mmore === 'you') { S.macroTargOpen = false; S.syncOpen = true; }
      /* Any day, closed or not — the card is a reading of the day, and a day
         does not have to be finished with to be read. */
      if (b.dataset.mmore === 'went') { S.macroTargOpen = false; S.mDoneOpen = mViewKey(); }
      /* The plan sheet is one entry now. "Meals & shares" and "How My Day
         works" were two more doors into it — three in a six-item menu
         landing in one room — and both of their destinations are accordions
         the sheet already shows. */
      S.mtOpen = '';
      pushSheet({ m: 1 });
      renderModal();
      if (S.mtOpen) {
        var jump = $(S.mtOpen === 'meals' ? 'mtMeals' : 'mtHelp');
        /* Open it, not merely scroll to it. "How My Day works" pointed at a
           shut accordion at the foot of the sheet — and a shut accordion that
           has been scrolled to looks exactly like nothing having happened, so
           the entry landed a reader in the same place "Craft my plan" did and
           appeared to be the same command twice. */
        if (jump && jump.tagName === 'DETAILS') jump.open = true;
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
    var invited = /[?&]invite=([a-z0-9]{8,64})/.exec(location.search);
    if (invited) {
      mInviteSet(invited[1]);
      try {
        var q = new URLSearchParams(location.search);
        q.delete('invite');
        var rest = q.toString();
        history.replaceState(history.state, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
      } catch (e) { /* older browser: the token stays in the bar */ }
    }
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
    /* Somebody sent a link. Signed in, it is spent by mSyncStart above; signed
       out, the sheet opens on the one thing to do about it. */
    if (mInviteGet() && !hasAcct) {
      S.syncOpen = true;
      if (!S.pendingCode) S.pendingCode = window.Store.newCode();
      pushSheet({ s: 1 });
      renderModal();
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
      if (parts[1] === 'moved') {
        var rec0 = mTargRec();
        if (!rec0 || !rec0.moved) return;
        if (parts[2] === 'undo') {
          /* Back to what was there, and left there: somebody who undid the
             weekly change has said these grams are theirs. */
          var pv = rec0.moved.prev || {};
          mWriteTargets({ p: pv.p, f: pv.f, c: pv.c, auto: 0, set: todayKey() });
        } else {
          mWriteTargets(Object.assign({}, rec0, { moved: Object.assign({}, rec0.moved, { ok: 1 }) }));
        }
        renderMacros();
        return;
      }
      /* Not a class on a node this time: the node is about to be replaced.
         Hiding it was the whole bug. */
      if (parts[1] !== 'eat') {
        mSetHush(mViewKey(), parts.slice(2).join(':'));
        renderMacros();
        return;
      }
      var want = Number(parts[2]);
      var t = mReadTargets(), now = kcalOf(t);
      if (!want || !now) return;
      /* Protein holds its grams: it is the thing a cut protects, and scaling
         it with the calories would give back exactly what the deficit is for.
         Fat keeps its floor. The rest lands on carbohydrate. */
      var pr = mReadProfile();
      var sp = mSplitKcal(want, t, pr);
      /* A choice, like grams typed into the boxes: the weekly follow must not
         put the plan's number back over it a week later and then offer this
         same button again. The morning line goes on coaching from here. */
      mWriteTargets({ p: sp.p, f: sp.f, c: sp.c, auto: 0, set: todayKey() });
      renderMacros();
    });

    $('macroWeigh').addEventListener('click', function (e) {
      /* The way into the plan, wherever the card is showing it: on the face
         while there is no plan to adjust, behind the press once there is. */
      if (e.target.closest('#macroTargBtn')) { mOpenTargets(); return; }
      var tr = e.target.closest('[data-mtrained]');
      if (tr) {
        var tk = tr.dataset.mtrained;
        mSetTrained(tk, !mIsTrainingDay(tk));
        keepingFocus(renderMacros);
        return;
      }
      var wf = e.target.closest('[data-mfold]');
      if (!wf) return;
      S.mFold.weigh = !(wf.getAttribute('aria-expanded') === 'false');
      keepingFocus(renderMacros);
    });

    /* What counts as a weight, in one place.
     *
       Digits, optionally a point and up to two more. A comma fails it, and so
       does anything else that is not a number — which is the whole point:
       "80,5" used to reach here as "805" because the number input had already
       thrown the comma away, and eight hundred and five pounds passed every
       guard there was. Nothing is stored while the box holds something that
       is not a weight, and the box says so rather than guessing which number
       you meant.
     *
       An empty box is not bad input — it is how you clear a morning. */
    var mWeightBad = false;
    function mWeightOf(raw) {
      var t = String(raw == null ? '' : raw).trim();
      if (!t) return { empty: true, lb: 0 };
      if (!/^\d{1,4}(\.\d{1,2})?$/.test(t)) return { bad: true, lb: 0 };
      var n = Number(t);
      if (!isFinite(n) || n <= 0) return { bad: true, lb: 0 };
      if (n > 1500) return { bad: true, big: true, lb: 0 };
      /* A number that could be a weight but is not likely to be yours.
         "1905" for 190.5 used to be clamped to 1,500 and stored in silence;
         the seven-day average went to 377, the plan was healed up by 600 kcal
         to match, and correcting the morning afterwards did not bring it back
         down — the heal only ever raises. Far from your own average, or far
         from any adult's, it is asked about before it is written. */
      var st = mWeightStats();
      var ref = st && st.n >= 3 ? st.avg7 : 0;
      var odd = n < 60 || n > 700 || (ref > 0 && Math.abs(n - ref) > ref * 0.15);
      return { lb: n, odd: odd, ref: ref };
    }
    function mWeightSay(bad, odd) {
      var el = $('mWeightNote');
      if (el) el.textContent = bad === 'big' ? 'More than anyone weighs. A point missing?'
        : bad ? 'Weights take digits and a point.'
        : odd ? 'That is ' + odd.lb + ' lb' + (odd.ref ? ', against ' + (Math.round(odd.ref * 10) / 10) +
          ' lately' : '') + '. Enter to keep it.' : '';
      var box = $('mWeight');
      if (box) box.setAttribute('aria-invalid', bad ? 'true' : 'false');
      mWeightBad = bad;
    }
    $('macroWeigh').addEventListener('input', function (e) {
      if (e.target.id !== 'mWeight') return;
      clearTimeout(mwTimer);
      var key = mViewKey(), got = mWeightOf(e.target.value);
      mWeightSay(got.big ? 'big' : !!got.bad, got.odd ? got : null);
      if (got.bad || got.odd) return;            // nothing is written from nonsense, or unasked
      mwTimer = setTimeout(function () { mWriteWeight(key, got.lb); }, 600);
    });
    $('macroWeigh').addEventListener('change', function (e) {
      if (e.target.id !== 'mWeight') return;
      clearTimeout(mwTimer);
      var got = mWeightOf(e.target.value);
      mWeightSay(got.big ? 'big' : !!got.bad, got.odd ? got : null);
      if (got.bad) return;
      if (got.odd) {
        var oddKey = mViewKey();
        ask({
          title: 'Keep ' + got.lb + ' lb?',
          body: got.ref ? 'Your average lately is ' + (Math.round(got.ref * 10) / 10) + ' lb.'
            : 'That is outside what a weight usually is.',
          ok: 'Keep it'
        }, function (yes) {
          if (!yes) return;
          mWriteWeight(oddKey, got.lb);
          mWeightSay(false, null);
          S.mFold.weigh = false;
          renderMacros();
        });
        return;
      }
      mWriteWeight(mViewKey(), got.lb);
      /* Committing a weight opens the card, once.
       *
         The card sits shut on a morning you have not weighed yet, because
         until you have there is nothing for it to say — it used to open on
         "not yet" and then talk for three lines about an average, a week and
         a pace, all of it evidence for a number that was not there. Handing
         it the number is the one moment that evidence is worth the room, so
         that is the moment it answers. After this the row is the handle and
         it stays wherever you last put it. */
      S.mFold.weigh = false;
      keepingFocus(renderMacros);
    });

    /* Paper has no fold. A folded meal is a list of dish names with no numbers
       on them, which is not a day anybody can read off a page — and CSS cannot
       open it, because the plates are not in the document at all while it is
       shut. So the day opens for the printer and closes again afterwards.
     *
       Opening it costs something, though, and that cost went unpaid for a
       while: an open meal says its verdict in the bars, and the bars are
       background colour a printer drops. Opening every meal therefore threw
       away the one thing on the card that was printable — the chips. So the
       day is also marked as being drawn for paper, which puts them back on
       the open card. Same verdict, in ink.
     *
       `mOnPaper` was never DECLARED, and under 'use strict' an assignment to
       a name that does not exist throws. It threw on the line before
       renderMacros(), so the whole point of the handler — opening the day
       for the printer — never happened: a day with a folded meal printed as
       dish names with no numbers, which is the exact thing the paragraph
       above says this exists to prevent. Two uncaught ReferenceErrors per
       print, on every print from My Day, since the day it was written.
     *
       Declared here. Note that nothing READS it yet: the "chips back on the
       open card" half of the paragraph above is still unbuilt, and is left
       visible rather than quietly deleted, because the fold half is the half
       that was doing the damage. */
    var mOnPaper = false;
    var mPrintFold = null;
    if (window.addEventListener) {
      window.addEventListener('beforeprint', function () {
        if (S.view !== 'macros') return;
        mPrintFold = S.mFold;
        S.mFold = {};
        mOnPaper = true;
        /* Held on the day it is already on, so the arrival seed does not run
           and fold everything straight back down. */
        S.mFoldFor = mViewKey();
        renderMacros();
      });
      window.addEventListener('afterprint', function () {
        if (mPrintFold === null) return;
        S.mFold = mPrintFold;
        mPrintFold = null;
        mOnPaper = false;
        renderMacros();
      });
    }

    /* A phone that sat open overnight should show the new day the moment it is
       looked at again, not yesterday's finished plan. Only when the reader has
       not deliberately navigated somewhere else. */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      /* The weekly follow ran at boot only, and an installed app is resumed
         far more often than it is started: a phone that never closed it never
         followed the scale. Asked again on coming back — once the boot-time
         decision has been made, so a device with an account still waits for
         it. It moves nothing unless a week has passed. */
      var followed = !mBootTargetsDue && mFollowScale();
      if (S.view === 'macros' && (!S.macroDate || followed)) renderMacros();
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
    window.addEventListener('scroll', onScrollStrip, { passive: true });
    window.addEventListener('resize', onResizeFold);
    window.addEventListener('resize', onScrollStrip);
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
      /* The × and the scrim have always closed a sheet; a button that says
         Done now does too. NOT keyed on [data-close], which is on the scrim
         as well — closest() would find it from anywhere inside the sheet and
         every click in the card would shut it. That attribute turns out to be
         decorative everywhere it appears, which is exactly why the Done
         button did nothing: it was wearing a wire that was never connected. */
      if (e.target.classList.contains('scrim') ||
        e.target.closest('.sheet-x, .sheet-done')) { close(); return; }

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
        /* Halving stops at a quarter, but a sheet that arrived below that
           from a plate must not go UP on the minus key: it stays. */
        S.scale = sc.dataset.scale === 'up' ? Math.min(8, S.scale * 2)
          : Math.max(Math.min(0.25, S.scale), S.scale / 2);
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
        /* Eaten if every part was. Written as un-eaten regardless, a lunch
           already finished came back as a plan: off the eaten bar, back in
           the meal's ask, and first in line for the sweeper. */
        mEditDay(mViewKey(), function (day) {
          var had = (day[sk3] || []).filter(function (it) { return BY_ID[it.id]; });
          var all = had.length > 0 && had.every(function (it) { return !!it.eaten; });
          day[sk3] = [{ id: newId, x: 1, eaten: all ? 1 : 0 }];
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

      /* A chip flips its own pressed state and refreshes the list. NOT a
         renderModal: that would rebuild the sheet, and the sheet now holds
         the search box — a chip pressed mid-word would redraw the input and
         take the caret with it. Same rule the keystroke path follows. */
      /* Open or shut the basket. renderModal, not a list refresh: this changes
         the bar itself, which lives outside #mpList. Safe for the search box
         because a press is not a keystroke — the box keeps its value through
         S.mpQuery either way. */
      var mbk = e.target.closest('[data-mpbasket]');
      if (mbk && S.macroPick) {
        S.mpBasketOpen = !S.mpBasketOpen;
        renderModal();
        return;
      }

      var msh = e.target.closest('[data-mpshelf]');
      if (msh && S.macroPick) {
        var want = msh.dataset.mpshelf;
        S.mpShelf = S.mpShelf === want ? '' : want;
        var rail = $('mpShelves');
        if (rail) {
          Array.prototype.forEach.call(rail.querySelectorAll('[data-mpshelf]'), function (b2) {
            var on = b2.dataset.mpshelf === S.mpShelf;
            b2.setAttribute('aria-pressed', String(on));
            b2.classList.toggle('on', on);
          });
        }
        refreshMacroPicker();
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
      /* Ask the food tables about the words in the box. The results land in
         #nfResults under the row, and taking one goes through the same
         [data-nfpick] path a scanned packet does — it carries the numbers
         over to the sheet that asks how much, rather than making a per-100 g
         figure the answer to a question nobody asked. */
      var mpl = e.target.closest('[data-mplook]');
      if (mpl && S.macroPick) {
        mLookNet(mpl.dataset.mplook);
        return;
      }

      var fpp = e.target.closest('[data-fppick]');
      if (fpp) {
        var fpr = BY_ID[idOf(fpp.dataset.fppick)];
        if (fpr && mCanFav(fpr)) {
          mToggleFav(fpr);
          /* A favourite the drafter may never use is a tap that did nothing,
             so choosing food the storehouse does not carry turns shopping on.
             The sheet says so above the shelves; it is not done in silence. */
          if (fpr.ext && mIsFav(fpr) && !mExtOk()) {
            var pr9 = mReadProfileRaw();
            pr9.extFill = true;
            mWriteProfile(pr9);
          }
          /* The gear sheet is cheap to redraw and has nothing to lose by it.
             The wizard is not, so it gets the surgical version. */
          if (S.favPick) renderModal();
          else mFavChipSync(fpp, fpr);
        }
        return;
      }
      var fpm = e.target.closest('[data-fpmore]');
      if (fpm) {
        S.fpOpen = S.fpOpen || {};
        S.fpOpen[fpm.dataset.fpmore] = !S.fpOpen[fpm.dataset.fpmore];
        renderModal();
        return;
      }

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

      /* A barcode typed into the search box is the same request the camera
         makes, so it goes to the same place rather than growing a second
         path beside it. */
      var nfc = e.target.closest('[data-nfcode]');
      if (nfc) {
        var code = nfc.dataset.nfcode;
        S.mpMode = 'scan';
        renderModal();
        mScanGot(code, true);   // typed, not decoded
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
        /* The calories follow from the macros whenever there are macros to
           follow from — not only when the calories box was left empty, which
           is all this used to do.

           Typing both is typing two answers to one question. A packet says
           190 and its own grams say 205, because a label uses factors
           particular to that food and this app uses four and nine; store the
           190 and the day's bars, its meal pills and the targets they are
           measured against are all speaking the other language, with one
           plate on the day quietly out of step. The stored figure has to be
           the one the day will count, or the record and the arithmetic
           disagree in the file.

           Calories alone still stand as typed. "I know it was 250 and I know
           nothing else" is honest and common — a plate at a friend's table —
           and deriving there would zero it, which is the one outcome worse
           than approximating it. Such a food carries calories with no macros
           to check them against; that is a gap in what is known, not two
           answers to the same question. */
        if (pp || ff || cc) kc = 4 * pp + 4 * cc + 9 * ff;
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
      /* Taking something back OUT, from the basket panel's own control. Same
         effect as untapping the row, but a separate attribute so the two are
         separate elements to the focus restore. */
      var mpo = e.target.closest('[data-mpout]');
      if (mpo && S.macroPick) {
        delete S.mpBasket[idOf(mpo.dataset.mpout)];
        renderModal();
        return;
      }

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
          S.mpBasket[bid] = mStepX(BY_ID[bid], S.mpBasket[bid], Number(bp[1]));
          renderModal();
        }
        return;
      }

      var mcommit = e.target.closest('[data-mpdone]');
      if (mcommit && S.macroPick) {
        var cslot = S.macroPick.slot, basket = S.mpBasket;
        /* Disarmed before anything else happens, because close() does not
           close synchronously.
         *
           The picker is pushed onto history, so close() takes its first
           branch — history.go(-n) and RETURN — and everything it clears,
           S.macroPick and the basket included, is cleared later, when the
           popstate lands. On a phone that is a hundred milliseconds or more
           with the sheet still on screen and the button still under a thumb.
           A second press in that window found S.macroPick still set and the
           basket still full, and added the whole basket again. Blake, having
           added two things: "I added foods. And it double added them" — the
           day showed franks, buns, franks, buns, in that order.
         *
           Clearing it here rather than making close() synchronous: the
           history unwind is what the back gesture depends on, and a press
           that has already been acted on should be inert whatever the sheet
           does next. */
        S.mpBasket = {};
        if (!Object.keys(basket).length) return;
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
        /* renderModal stood here and did nothing. The plan sheet is drawn
           once and left alone — so a sync arriving mid-keystroke cannot
           reset the draft boxes — and a second call while it is open returns
           without touching the DOM. The tap wrote useTdee to storage and the
           screen kept the old state: the pill still read "In use" after
           turning the measured burn off, while the plan underneath had
           already changed. This is the mechanism the sheet has for exactly
           that — repaint the answers from the profile, leave the questions
           and, here, the grams alone. */
        mtRefreshPlan(true);
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

      /* The workouts stepper: one fewer, one more, and the box tells the
         plan the way typing into it would. */
      var wk = e.target.closest('[data-mtwk]');
      if (wk && S.macroTargOpen) {
        var wi = $('mtWorkouts');
        if (wi) {
          wi.value = Math.max(0, Math.min(14, (Number(wi.value) || 0) + Number(wk.dataset.mtwk)));
          wi.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }

      var mseg = e.target.closest('[data-mtsex], [data-mtgoal], [data-mtext], [data-mtact]');
      if (mseg && S.macroTargOpen) {
        /* Which segment this is, asked of the element instead of guessed from
           a pair. The ternary that used to sit here had to grow a branch for
           every segment added, and the failure when one is missed is silent:
           the press lands, the wrong row's buttons are queried, and nothing
           moves. */
        var segAttr = ['mtsex', 'mtgoal', 'mtext', 'mtact'].filter(function (a) {
          return mseg.dataset[a] !== undefined;
        })[0];
        Array.prototype.forEach.call(mseg.parentElement.querySelectorAll('button[data-' +
          segAttr + ']'), function (b) {
          b.setAttribute('aria-pressed', String(b === mseg));
        });
        // the three activity words write the select the profile is read from
        if (segAttr === 'mtact' && $('mtAct')) $('mtAct').value = mseg.dataset.mtact;
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
        mtSyncSave();
        return;
      }

      var mmf = e.target.closest('[data-mtmfold]');
      if (mmf && S.macroTargOpen) {
        var mShutNow = $('mtMealsWrap').classList.toggle('hide');
        mmf.setAttribute('aria-expanded', String(!mShutNow));
        /* Opening it is the moment the shares stop being a summary and start
           being boxes, so the total under them has to be right from the
           first look rather than from the first keystroke. */
        if (!mShutNow) mtmShowTotal();
        mtSyncSave();
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
        /* Asked properly, because it cannot be undone and the button sits a
           centimetre from Sign out, which can. */
        if (act2 === 'delete') {
          ask({
            title: 'Delete your account?',
            body: 'Your weigh-ins, your food log, your plan and any foods you added ' +
              'go from this device and from the account. This cannot be undone.',
            ok: 'Delete everything',
            danger: true
          }, function (yes) {
            if (!yes) return;
            mDeleteAccount().then(function () {
              S.myErr = '';
              S.myNote = 'Your account and everything in it are gone.';
              renderModal();
            }, function (err) {
              /* Firebase will not delete an identity that has not signed in
                 recently. Saying so is the only useful thing to do with it —
                 the alternative is a button that silently does nothing. */
              /* Three outcomes, and two of them used to read the same. The
                 data goes first and cannot go second — once the identity is
                 deleted there is no uid left to authorise it — so a refusal
                 at the identity step leaves everything already destroyed.
                 Saying "sign in again first, then delete" over that reads as
                 "nothing happened", which is the opposite of the truth. */
              S.myErr = (err && err.message === 'recent-login-wiped')
                ? 'Everything in your account has been deleted. The account itself needs a recent sign-in before Firebase will remove it \u2014 sign out, sign back in, and press delete once more.'
                : (err && err.message === 'recent-login')
                ? 'Sign out and sign in again first, then delete. Firebase asks for a recent sign-in before it will remove an account. Nothing has been deleted.'
                : 'Could not delete the account. Check your signal and try again.';
              renderModal();
            });
          });
          return;
        }
        if (act2 === 'push') {
          /* Restamp everything as of now so this device's copy is the newest
             on every part, then send it. Nothing is deleted anywhere else;
             it is simply outvoted. */
          mClaimAll();
          mSyncPush(true);
          S.myErr = '';
          S.myNote = 'Sent. Your other devices will take this the next time they look.';
        }
        if (act2 === 'pull') {
          /* Forget what is here and let the next snapshot fill it back in.
             The push that follows carries stamps of zero, so it cannot
             overwrite the account on the way past. Asked first: a day logged
             while the signal was down has never reached the account, and
             this is the button that throws it away. */
          ask({
            title: 'Take the account\u2019s copy?',
            body: 'Nourish and Strengthen on this device are replaced by what your account holds. ' +
              'Anything logged here that has not reached the account is lost.',
            ok: 'Use the account\u2019s copy'
          }, function (yes) {
            if (!yes) return;
            mForgetDay();
            renderMacros();
            mSyncStart();
            S.myNote = 'Cleared. Whatever your account holds is on its way down.';
            renderModal();
          });
          return;
        }
        if (act2 === 'out') {
          /* Signing out clears My Day from this device, so it is asked like
             anything else that removes what you typed. The account keeps what
             it has already received. */
          ask({
            title: 'Sign out of this device?',
            body: 'Nourish and Strengthen are cleared from this device. Your account keeps everything ' +
              'it has already received; anything not yet sent is lost.',
            ok: 'Sign out'
          }, function (yes) {
            if (!yes) return;
            window.Store.signOutAccount().then(function () {
              S.mySent = false;
              mForgetDay();
              mAccountMark();
              mSyncStart();
              renderMacros();
              renderModal();
            }, failed);
          });
          return;
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

      /* Stepping the first run. The steps are all in the document and three
         of them are hidden, so this only ever changes which one is shown —
         nothing is built, nothing is thrown away, and every field stays
         readable by mtProfileFromDom the whole way through.

         Next on the last step is Save, because a wizard that ends on a step
         called "here is your plan" and then asks you to find a button is a
         wizard with one screen too many. */
      var mtw = e.target.closest('[data-mtw]');
      if (mtw) {
        var steps = document.querySelectorAll('[data-mtwstep]');
        if (!steps.length) return;
        var at = 1;
        Array.prototype.forEach.call(steps, function (sc) {
          if (!sc.hidden) at = Number(sc.dataset.mtwstep);
        });
        /* Done is the end of the wizard, so it is also its Save: the plan
           step's quiet line is the one Save button, and Done presses it. A
           wizard finished on the foods step used to close without writing
           the plan the four steps before it had built. */
        if (mtw.dataset.mtw === 'done') {
          var sv = document.querySelector('[data-mtarg="save"]');
          if (sv) sv.click(); else close();
          return;
        }
        mtwGo(at + (mtw.dataset.mtw === 'next' ? 1 : -1));
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
          var saved = { p: gv('mtP'), f: gv('mtF'), c: gv('mtC') };
          // the profile rides along, so next time the sheet already knows you
          mWriteProfile(mtProfileFromDom());
          /* Whether these are the plan's grams or somebody's own. Within a
             gram, because the boxes are whole numbers and so is the plan. */
          var planNow = mPlanCalc(mReadProfile());
          saved.auto = planNow && Math.abs(planNow.p - saved.p) <= 1 &&
            Math.abs(planNow.f - saved.f) <= 1 && Math.abs(planNow.c - saved.c) <= 1 ? 1 : 0;
          saved.set = todayKey();
          mWriteTargets(saved);
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
        if (act === 'invite') {
          S.inviteMaking = true;
          S.inviteMsg = '';
          window.Store.invite().then(function (url) {
            S.inviteMaking = false; S.inviteUrl = url; S.inviteCopied = false;
            renderModal();
          }, function () {
            S.inviteMaking = false;
            S.inviteMsg = 'Could not make a link. Check your signal and try again.';
            renderModal();
          });
        }
        if (act === 'inviteshare' && S.inviteUrl && navigator.share) {
          navigator.share({ title: 'Hive & Hearth', text: 'Join my pantry on Hive & Hearth', url: S.inviteUrl })
            .catch(function () { /* dismissed */ });
        }
        if (act === 'invitecopy' && S.inviteUrl) {
          var done = function () { S.inviteCopied = true; renderModal(); };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(S.inviteUrl).then(done, function () {
              var el = $('inviteUrl'); if (el) { el.select(); }
            });
          } else {
            var el2 = $('inviteUrl'); if (el2) { el2.select(); try { document.execCommand('copy'); done(); } catch (er) { /* selected, at least */ } }
          }
        }
        /* Async because the code is checked against the server before it is
           handed over. It resolves with the code actually claimed, which is
           the one on screen unless it turned out to be taken. */
        if (act === 'use') {
          mHouseTellNext = true;
          window.Store.createHousehold(S.pendingCode).then(function (code) {
            S.pendingCode = code;
            renderModal();
          });
        }
        if (act === 'join') {
          var v = ($('joinCode') || {}).value || '';
          if (v.trim()) { mHouseTellNext = true; window.Store.join(v); }
        }
        /* Signed in, stopping here stops it for the account too; otherwise
           the next snapshot would put this device straight back in. */
        if (act === 'leave') {
          S.inviteUrl = ''; S.inviteMsg = '';
          window.Store.leave();
          mHouseTellNext = false;
          if (mAccount() && mSyncDoc) mHouseTell('');
        }
        renderModal();
      }
    });

    // the nutrition preview follows the ingredients as they are typed
    $('modalRoot').addEventListener('input', function (e) {
      if (S.editId && (e.target.id === 'edIng' || e.target.id === 'edServings' ||
        e.target.id === 'edExtras' || /^ed(Kcal|P|C|F)$/.test(e.target.id))) refreshPreview();
      if (S.syncOpen && e.target.id === 'myJoin') S.myJoin = e.target.value;
      if (S.newFood && e.target.id === 'nfFind') { /* typed; the buttons ask */ }
      /* Held, because these two now live INSIDE #mpList.
       *
         They used to sit in .mp-controls, a sibling of the list, where
         replacing the list could not touch them. They moved onto the
         "Fits best / On the shelf" divider, which mpFitsHTML returns as part
         of the list — so redrawing the list destroys the very select that
         asked for the redraw, and focus falls to the body. A keyboard or
         screen-reader user had to tab from the top of the sheet back down
         for every single change. focusKey falls back to #id, so there is
         nothing to add to FOCUS_ATTRS; there was simply nothing holding on. */
      if (S.macroPick && (e.target.id === 'mpSec' || e.target.id === 'mpSort')) {
        if (e.target.id === 'mpSec') S.mpSec = e.target.value;
        else S.mpSort = e.target.value;
        keepingFocus(refreshMacroPicker);
      }
      if (S.macroPick && e.target.id === 'mpFind') {
        S.mpQuery = e.target.value;
        refreshMacroPicker();
        mpLookSoon();
      }
      /* One box over two speeds. What is already on this device answers on
         the keystroke; the food tables are a request over a network, so they
         answer when they answer, underneath, and only once you have stopped
         typing long enough to mean it. */
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
    /* A nought you have not answered yet is a placeholder, and tapping it
       should not leave you typing AROUND it.
     *
       The plan sheet's About-you boxes open at 0 on a first run, and a tap
       puts the caret wherever the thumb landed — usually left of the digit,
       because the digit sits right-aligned at the far end of the row. Typing
       180 into the weight box then produced "1800", which the sheet accepted
       (max=999 is the browser's business, not mtProfileFromDom's) and built a
       ten-thousand-calorie plan out of. The first number a new reader types
       into this app came back wrong by a factor of ten.
     *
       Only an exact "0", so a real figure you tapped into to correct keeps
       its caret where you put it. focusin because focus does not bubble. */
    $('modalRoot').addEventListener('focusin', function (e) {
      var el = e.target;
      if (!S.macroTargOpen || !el || el.tagName !== 'INPUT' || el.type !== 'number') return;
      if (el.value !== '0') return;
      try { el.select(); } catch (e2) { /* older webviews: leave the caret be */ }
    });

    $('modalRoot').addEventListener('change', function (e) {
      if (S.macroTargOpen && (e.target.id === 'mtAct' || e.target.id === 'mtGoalBy')) mtRefreshPlan();
      // the picker's two lenses redraw only the list, like the search box
      if (S.macroPick && e.target.id === 'mpSec') {
        S.mpSec = e.target.value; keepingFocus(refreshMacroPicker);
      }
      if (S.macroPick && e.target.id === 'mpSort') {
        S.mpSort = e.target.value; keepingFocus(refreshMacroPicker);
      }
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
      if (e.key === 'Escape' && S.filtPop) { filtersPop(false); return; }
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
    /* And the food grid. It was added without this line and the sheet became
       a room with no door: × and the backdrop both call close(), close() left
       S.favPick standing, and renderModal drew the grid straight back. Blake,
       stuck in it: "when I click done or try to exit out of this screen it
       doesn't let me go anywhere." Exactly the failure the note above this
       block describes, made again four sheets later. */
    S.favPick = false;
    S.fpOpen = null;
    if (S.newFood) mScanStop();
    S.newFood = null;
    S.syncOpen = false;
    S.mDoneOpen = '';
    S.mpQuery = '';
    S.mpShelf = '';
    S.mpBasketOpen = false;
    // a basket left behind would silently refill the next meal you opened
    S.mpBasket = {};
    /* A Train sheet is an entry in the same history, so the same back
       gesture and the same × close it. */
    if (window.Train) window.Train.sheetClosed();
    renderModal();
    restoreOpener();
  }

  /* What src/train.js borrows from here. The history entry a sheet needs so
     that back closes it, the one confirm dialog the app has, and the "I
     trained today" tick on My Day, which a finished workout presses for
     you. Narrow on purpose: Train keeps its own data and draws its own
     screen; it only needs the things there must be one of. */
  window.Hive = {
    ask: ask,
    openSheet: function () { pushSheet({ tr: 1 }); },
    closeSheet: function () { close(); },
    trained: function (k) {
      mSetTrained(k, true);
      if (S.view === 'macros') renderMacros();
    }
  };

  // ------------------------------------------------------------------- boot
  renderSections();
  /* Before the first paint: a stored plan written by an older build can be
     below this body's floor or have no carbohydrate in it, and the correction
     belongs here rather than inside whichever read happened to run first. */
  document.addEventListener('click', function (e) {
    var al = e.target.closest('[data-mallow]');
    if (!al) return;
    var aid = al.dataset.mallow;
    mSetNever(BY_ID[aid] ? aid : (isNaN(Number(aid)) ? aid : Number(aid)), false);
    var tt = $('mToast');
    if (tt && tt.contains(al)) tt.hidden = true;
    if (S.favPick) renderModal();
    if (S.view === 'macros') renderMacros();
  });
  mBootTargetsDue = true;
  if (!mSuspectAccount()) mBootTargets();
  wire();
  window.Store.init(function () { renderAll(); mHouseWatch(); });
  renderAll();
})();
