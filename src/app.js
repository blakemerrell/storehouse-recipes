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
  /* For the parts in files of their own (window.HiveParts): rebuild() replaces
     RECIPES and BY_ID rather than changing them, so a part asks for them
     each time instead of keeping the pair it was handed. */
  /* What the parts in files of their own (window.HiveParts) read and write
     of the app's that the app also replaces as it goes: a getter and a setter
     each, so a part reads the value now and its writes land here. */
  var LIVE = {
    get MDAYS() { return MDAYS; },
    get MDONE() { return MDONE; },
    get MSEND() { return MSEND; },
    get MSKIP() { return MSKIP; },
    get MTRAINED() { return MTRAINED; },
    get MWEIGHTS() { return MWEIGHTS; },
    get MFOODS() { return MFOODS; },
    get BY_ID() { return BY_ID; },
    get M_ALL_SECS() { return M_ALL_SECS; },
    set M_ALL_SECS(v) { M_ALL_SECS = v; },
    get RECIPES() { return RECIPES; },
    get S_SYNC_STATE() { return S_SYNC_STATE; },
    set S_SYNC_STATE(v) { S_SYNC_STATE = v; },
    get mAuthKnown() { return mAuthKnown; },
    get mBootTargetsDue() { return mBootTargetsDue; },
    set mBootTargetsDue(v) { mBootTargetsDue = v; },
    get mSyncUnreachable() { return mSyncUnreachable; },
    get MBATCHG() { return MBATCHG; },
    get MDAYT() { return MDAYT; },
    get MHUSH() { return MHUSH; },
    get MINTAKE() { return MINTAKE; },
    get MNEVER() { return MNEVER; },
    get mClkSent() { return mClkSent; },
    set mClkSent(v) { mClkSent = v; },
    get mDirty() { return mDirty; },
    set mDirty(v) { mDirty = v; },
    get mDirtyAll() { return mDirtyAll; },
    set mDirtyAll(v) { mDirtyAll = v; },
    get mFoldTimer() { return mFoldTimer; },
    set mFoldTimer(v) { mFoldTimer = v; },
    get mAcctHouse() { return mAcctHouse; },
    set mAcctHouse(v) { mAcctHouse = v; },
    get mHouseTellNext() { return mHouseTellNext; },
    set mHouseTellNext(v) { mHouseTellNext = v; },
    get mInviteBusy() { return mInviteBusy; },
    get mSyncDoc() { return mSyncDoc; },
    set mInviteBusy(v) { mInviteBusy = v; },
    set mAuthKnown(v) { mAuthKnown = v; },
    set mSyncDoc(v) { mSyncDoc = v; },
    get mSyncHeard() { return mSyncHeard; },
    set mSyncHeard(v) { mSyncHeard = v; },
    get mSyncOff() { return mSyncOff; },
    set mSyncOff(v) { mSyncOff = v; },
    get mSyncTimer() { return mSyncTimer; },
    set mSyncTimer(v) { mSyncTimer = v; },
    set mSyncUnreachable(v) { mSyncUnreachable = v; },
    get MX_ALL() { return MX_ALL; },
    get MINTAKE_DAYS() { return MINTAKE_DAYS; },
    get MC_GAP() { return MC_GAP; },
    get MGOAL_WORDS() { return MGOAL_WORDS; }
  };

  function recipesNow() { return RECIPES; }
  function byIdNow() { return BY_ID; }

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
  /* The key and name for a food being saved, never one already taken.
     The key was the name, slugged, and written over whatever held it: a
     second "Lunch", or "Café" beside "Caf", replaced the first, and every
     past day holding it took the new numbers, which moved the intake log
     and the measured burn behind them. A name in use gets a number instead. */
  function mNewFoodKey(name, mine) {
    var base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') ||
      ('x' + Date.now().toString(36));
    var key = base, nm = name, n = 1;
    while (Object.prototype.hasOwnProperty.call(mine, key)) { n++; key = base + '_' + n; nm = name + ' ' + n; }
    return { key: key, name: nm };
  }
  function mReadMyFoods() {
    try {
      var v = JSON.parse(localStorage.getItem('bsc.myFoods'));
      if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    } catch (e) { /* private mode or corrupt */ }
    return {};
  }
  /* Stamped only once it is really written — for all three of these, which
     used to disagree about the order. The payload reads the value back out
     of storage, so a stamp over a write that failed (storage full) sent the
     OLD value up as the newest one, and every other device took it. mPut has
     already said the storage is full. */
  function mWriteMyFoods(v) {
    if (mPut('bsc.myFoods', v)) mStamp('mf');
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
  var COLLECTION_BLURB = 'Two volumes, built on staples that keep: canned, dry and frozen, plus a little fresh. Run and ' +
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

  /* The app says staples where the printed books say the storehouse. The
     books are the storehouse edition and keep every word, and their page
     counts are tested; these are only what the Recipes tab shows. */
  var APP_BLURB = {
    1: '{N1} recipes built on protein, fiber and staying full, from staples that keep. Every one carries real macros and a computed nutrition score.',
    2: '{N2} family recipes from staples that keep: three\u2011minute breakfasts to Sunday roasts, by way of an afternoon at the stove, the restaurant favourites worked out at home, and a section for chocolate alone.'
  };
  var APP_SEC_NOTE = { '2-9': 'Three bottles you\u2019d otherwise buy, made from staples.' };

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
    /* ...but only for a while. Opened again after an hour away, the app
       starts on Today, the screen a day is run from; a refresh, or a
       return within the hour, is still where you were (sh.viewAt, written
       whenever the page is put away). A phone that has never been here
       starts on Today too. */
    view: (function () {
      try {
        var v = localStorage.getItem('sh.view'), at = Number(localStorage.getItem('sh.viewAt')) || 0;
        var ok = ['today', 'browse', 'plan', 'macros', 'train', 'list', 'pantry', 'book'].indexOf(v) >= 0;
        return ok && Date.now() - at < 3600e3 ? v : 'today';
      } catch (e) { return 'today'; }
    })(),
    bookF: 'all', secF: 'all', diffF: 'all', pantryF: 'all',
    favOnly: false, qy: '', sort: 'book', openId: null, scale: 1, printSet: 'all',
    filtPop: false,
    /* The list's folds and the one line whose source switch is open; a
       day's dinner opened on the week. None of it is saved. */
    listFold: {}, listOpen: null, daySheet: null,
    /* Cups or grams. Persisted on the device rather than shared, because it is
       a preference about reading, not about the plan — one of you can cook by
       weight while the other cooks by cup without either overruling the other. */
    units: (function () {
      try { return localStorage.getItem('sh.units') === 'grams' ? 'grams' : 'cups'; }
      catch (e) { return 'cups'; }
    })(),
    syncOpen: false, pendingCode: '', joinDraft: '', joinMsg: '', joinBack: null, why: false, dinerDraft: null, dinerMsg: '',
    /* The Macros tab. macroDate null means "today, worked out at render time",
       so a phone left open across midnight lands on the new day by itself;
       an explicit key means the reader pressed ‹ and wants to stay there. */
    macroDate: null, macroPick: null, macroTargOpen: false, newFood: null, mpQuery: '',
    /* A food opened from its plate: {id, x}. Foods have no recipe sheet, so
       this is the sheet that answers "what is one of it, and what went in". */
    foodOpen: null, mCopyFrom: null,
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
    chartOpen: false, chartWhich: 'weight', mcRange: 'all', keepMeal: '',
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
  /* Within a name match there are grades now (see searchScore), so a name
     returns between 3 and 4 — the better the match, the nearer 4 — and the
     three reasons keep their order and their meaning: `=== 1` is still
     “only its section”. The ingredient and section grades read the name's
     words too, so “chicken rice” finds the chicken bowl with rice in it,
     and neither of them forgives a typo: a misspelling matched against
     forty ingredient lines finds something in nearly every recipe. */
  function matchRank(r, qs) {
    var s = searchScore(r.name, qs);
    if (s >= 0) return 4 - s / 400;
    if (searchScore(r.name + ' ' + r.ing.join(' '), qs, true) >= 0) return 2;
    if (searchScore(r.name + ' ' + r.secName, qs, true) >= 0) return 1;
    return 0;
  }

  /* ------------------------------------------------------------ one search
   *
     Both searches used to be one indexOf of the whole phrase: “vanilla oat”
     found nothing — no name has those nine characters in a row — and “egg”
     put Eggplant above the Eggs you had starred: both contain it, and
     nothing said which was the one you meant. Blake: “Any word order;
     ★ and recent foods ranked first, then exact, then word-starts; common
     variants (oatmeal/oats, yoghurt/yogurt) and one-letter typos still match.
     Recipes search the same way.”
   *
     So a query is words, and every word has to find a word in the name. It
     can find it whole, or as the start of one (“oa” in oats), or inside one
     (“berr” in strawberries, which the old match found and this must not
     lose), or — for a word of four letters or more — one letter off. Words
     are compared in two forms: as typed, so the prefix of a word being typed
     still matches, and folded, so a plural, a British spelling or a variant
     name meets its twin. The grade is the weakest word's: one typo makes the
     whole hit a typo hit. */
  var SEARCH_VARIANT = {
    yoghurt: 'yogurt', yoghurts: 'yogurt', grey: 'gray', greys: 'gray',
    chilli: 'chili', chillies: 'chili', chile: 'chili', chiles: 'chili',
    oatmeal: 'oat', oatmeals: 'oat', donut: 'doughnut', donuts: 'doughnut',
    catsup: 'ketchup', courgette: 'zucchini', courgettes: 'zucchini',
    aubergine: 'eggplant', aubergines: 'eggplant', garbanzo: 'chickpea',
    garbanzos: 'chickpea', capsicum: 'pepper', capsicums: 'pepper'
  };

  /* Lower case, accents off, apostrophes out — “Hershey's” is one word, and
     jalapeño is the word people type as jalapeno. */
  function searchFold(s) {
    s = String(s || '').toLowerCase();
    if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return s.replace(/[\u0027\u2019]/g, '');
  }

  /* A plural and its singular, folded to one stem: eggs and egg, berries and
     berry, tomatoes and tomato, peaches and peach, cookies and cookie. Not a
     stemmer, and it does not need to be one: both sides go through it, so it
     only has to be consistent, never grammatical. */
  function searchCanon(w) {
    w = SEARCH_VARIANT[w] || w;
    if (w.length >= 4) {
      if (/ies$/.test(w)) w = w.slice(0, -3) + 'i';
      else if (/(s|x|z|o|ch|sh)es$/.test(w)) w = w.slice(0, -2);
      else if (/[^su]s$/.test(w) && !/is$/.test(w)) w = w.slice(0, -1);
    }
    if (w.length >= 3) {
      if (/y$/.test(w)) w = w.slice(0, -1) + 'i';
      else if (/e$/.test(w)) w = w.slice(0, -1);
    }
    return w;
  }

  /* A name's words, worked out once per name and kept: the picker asks on
     every keystroke over the whole food table and the whole book, and the
     names do not change between keystrokes. Keyed by the text itself, so a
     renamed food of your own simply becomes a new entry. */
  var SEARCH_WORDS = {};
  function searchWords(text) {
    var k = String(text || '');
    var got = SEARCH_WORDS[k];
    if (got) return got;
    got = searchFold(k).split(/[^a-z0-9]+/).filter(Boolean).map(function (w) {
      return { w: w, c: searchCanon(w) };
    });
    SEARCH_WORDS[k] = got;
    return got;
  }

  /* One letter off, and no further: a letter wrong, added, dropped, or two
     neighbours swapped — the four slips a thumb makes. */
  function searchNear(a, b) {
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1 || a === b) return a === b;
    var i = 0;
    while (i < la && i < lb && a.charAt(i) === b.charAt(i)) i++;
    if (la === lb) {
      if (a.slice(i + 1) === b.slice(i + 1)) return true;                  // changed
      return a.charAt(i) === b.charAt(i + 1) && a.charAt(i + 1) === b.charAt(i) &&
        a.slice(i + 2) === b.slice(i + 2);                                  // swapped
    }
    return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
  }

  /* How well `text` answers the query `q`: -1 for not at all, else a score
     where lower is better and the hundreds say the grade —
       0  the whole name, word for word in any order (“oats egg” for Egg oats)
       1  every word at the start of a name word
       2  some word found inside a name word
       3  some word one letter off
     and below that, words only begun (tens) and name words left over (units),
     so “egg” puts Egg whites — a whole word and one to spare — before
     Eggplant, which only begins with it. `strict` refuses the typo grade, for
     text too long to guess against. */
  function searchScore(text, q, strict) {
    var qw = searchWords(q);
    if (!qw.length) return -1;
    var nw = searchWords(text);
    var worst = 0, begun = 0, used = {};
    for (var i = 0; i < qw.length; i++) {
      var best = 9, at = -1;
      for (var j = 0; j < nw.length && best > 0; j++) {
        var a = qw[i], b = nw[j], g = 9;
        if (a.c === b.c || a.w === b.w) g = 0;
        else if (b.w.indexOf(a.w) === 0 || b.c.indexOf(a.c) === 0) g = 1;
        else if (a.w.length >= 3 && b.w.indexOf(a.w) > 0) g = 2;
        else if (!strict && a.w.length >= 4 && (searchNear(a.c, b.c) || searchNear(a.w, b.w))) g = 3;
        if (g < best) { best = g; at = j; }
      }
      if (best === 9) return -1;
      used[at] = 1;
      if (best === 1) begun++;
      if (best > worst) worst = best;
    }
    var spare = nw.length - Object.keys(used).length;
    /* The whole name, not merely whole words: “egg” is Eggs exactly and
       Egg whites only partly, and the starred Eggs must not tie with it. */
    var tier = worst === 0 ? (spare ? 1 : 0) : worst;
    return tier * 100 + Math.min(9, begun) * 10 + Math.min(9, spare);
  }

  function filtered() {
    var qs = S.qy.trim().toLowerCase();
    /* Each recipe's grade worked out once, not twice per comparison — the
       sort below asks for it n log n times. */
    var rank = {};
    return RECIPES.filter(function (r) {
      if (S.bookF !== 'all' && r.book !== S.bookF) return false;
      if (S.secF !== 'all' && (r.book + '-' + r.secNum + '-' + r.secName) !== S.secF) return false;
      if (S.diffF !== 'all' && r.diff !== S.diffF) return false;
      if (S.pantryF === 'base' && missingFor(r).length) return false;
      if (S.pantryF === 'extras' && !missingFor(r).length) return false;
      if (S.favOnly && !window.Store.isFav(r.id)) return false;
      if (qs && !(rank[r.id] = matchRank(r, qs))) return false;
      return true;
    }).sort(function (a, b) {
      /* While searching, how well a recipe matches outranks book order — but
         not a sort the reader chose on purpose. Asking for "most protein" and
         getting relevance instead would be the app overruling them. */
      if (qs) {
        /* A chosen order still sorts inside each reason — name, ingredient,
           section — as it always did; only the finer grade within a name
           match steps aside for it. Ceil, because a name is (3, 4]. */
        var d = SORTS[S.sort] ? Math.ceil(rank[b.id]) - Math.ceil(rank[a.id]) : rank[b.id] - rank[a.id];
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

     So it follows the pantry: Store.pantryChanged() decides which word is
     true. Untouched, it talks about the storehouse,
     because that is true out of the box. Edit your pantry and it talks about
     your shelf, because that is true from then on. So does "I keep my own":
     no source, nothing but the shelf, and "Just my staples" over 0 recipes
     read as a broken filter. */
  function renderPantryFilterLabels() {
    var mine = window.Store.pantryChanged() || !window.Store.opt('store', true);
    var sel = $('pantrySel');
    var words = mine
      ? ['Everything', "Only what's on my shelf", 'Needs a shop']
      : ['Everything', 'Just my staples', 'Needs a shop'];
    ['all', 'base', 'extras'].forEach(function (v, i) {
      var o = sel.querySelector('option[value="' + v + '"]');
      if (o) o.textContent = words[i];
    });
    sel.setAttribute('aria-label', mine ? 'What you keep' : 'Staples');
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
      : fillCounts(BOOKS[S.bookF] ? (APP_BLURB[S.bookF] || BOOKS[S.bookF].blurb) : COLLECTION_BLURB, RECIPES);
    /* Say how many are here on their own merits and how many arrived because
       their section is named for the search. Without it, "breakfast" returning
       fifty recipes reads as fifty breakfasts, and the reader scrolls looking
       for the mistake. */
    var loose = qs ? list.filter(function (r) { return matchRank(r, qs) === 1; }).length : 0;
    $('browseCount').textContent = list.length + (list.length === 1 ? ' recipe' : ' recipes') +
      (loose ? ' · ' + (list.length - loose) + ' matching, ' + loose + ' more from sections named for it'
             : (order[S.sort] || ''));
    $('browseEmpty').classList.toggle('hide', list.length !== 0);
    /* Your own shelf, and nothing on it covers a whole recipe yet: say where
       the shelf is, not that the filters are wrong. Named the way the door
       names it; On hand is reached from Share now, not a Pantry tab. */
    $('browseEmpty').textContent = S.pantryF === 'base' && !window.Store.opt('store', true)
      ? 'Nothing on your shelf yet \u2014 tick what you keep on hand, under Share \u203a Your kitchen' : 'Nothing matches those filters.';
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
          '<span class="grid-sec-b">' + esc((BOOKS[r.book] || BOOKS[3]).short) + '</span>' +
          '<b>' + esc(SEC_SHORT[lastSec] || r.secName) + '</b>' +
          '<span class="grid-sec-n">' + n + '</span>' +
          ((APP_SEC_NOTE[lastSec] || SEC_NOTE[lastSec]) ? '<span class="grid-sec-s">' + esc(APP_SEC_NOTE[lastSec] || SEC_NOTE[lastSec]) + '</span>' : '') +
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
          '<span class="card-num">' + (BOOKS[r.book] || BOOKS[3]).short + ' · ' + no(r) + '</span>' +
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
        if (!BY_ID[e.id] || e.lo) return;    // leftovers are eaten, not bought
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
  /* The calendar's head: which week (or month) is on screen, how far it is
     from this one, and the actions that make sense for it. A past week is
     history, so it is not planned into. */
  var CAL_DAYS = [DAYS[6]].concat(DAYS.slice(0, 6));        // Sunday first
  function calMidnight(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function calDate(key) {
    var st = window.Store.activeWeek().start;
    if (!st) return null;
    var d = new Date(st); d.setDate(d.getDate() + CAL_DAYS.map(function (x) { return x[0]; }).indexOf(key));
    return calMidnight(d);
  }
  function calPastDay(key) { var d = calDate(key); return !!d && d < calMidnight(new Date()); }
  function calIsToday(key) { var d = calDate(key); return !!d && d.getTime() === calMidnight(new Date()).getTime(); }
  function calOffset() {
    var st = window.Store.activeWeek().start, now = window.Store.weekStart(window.Store.thisWeek());
    return st && now ? Math.round((st - now) / (7 * 864e5)) : 0;
  }
  function calPastWeek() { return calOffset() < 0; }
  function renderWeeks() {
    var wk = window.Store.activeWeek(), off = calOffset(), month = S.calMode === 'm';
    if (month) {
      var mf = S.calMonth || calMidnight(wk.start || new Date());
      $('weekTitle').textContent = mf.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if ($('calSub')) $('calSub').textContent = 'tap a day to open its week';
    } else {
      $('weekTitle').textContent = wk.name;
      if ($('calSub')) $('calSub').textContent = off === 0 ? 'This week' : off === 1 ? 'Next week' : off === -1 ? 'Last week'
        : off > 0 ? 'In ' + off + ' weeks' : (-off) + ' weeks ago';
    }
    document.querySelectorAll('#calMode [data-cal]').forEach(function (b) {
      b.setAttribute('aria-pressed', String((b.dataset.cal === 'm') === month));
    });
    if ($('planMyWeek')) {
      $('planMyWeek').disabled = off < 0 || month;
      $('planMyWeek').classList.toggle('hide', off < 0 || month);      // a week gone by is not planned into
    }
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

  /* Which day of the plan's week is today, Monday 0. The week has no dates,
     but the days before today are the ones that have been eaten. */
  /* Drawn, not emoji: the same thin ink line as the rest of the app's
     icons. Star comes back often, thumb up a little more often, thumb down
     never — and once one is chosen, the row says so. */
  var RATE_ICON = {
    2: '<path d="M8 1.9l1.85 3.8 4.2.6-3.05 2.95.72 4.17L8 11.45l-3.72 1.97.72-4.17L1.95 6.3l4.2-.6z"/>',
    1: '<path d="M5.2 7.2v6.6M5.2 7.2 8 2.4c1.1 0 1.9.9 1.6 2.1L9.2 6.2h3.3c.9 0 1.6.9 1.3 1.8l-1.1 4.6c-.2.7-.8 1.2-1.5 1.2H5.2M2.2 7.2h3v6.6h-3z"/>',
    '-1': '<g transform="rotate(180 8 8)"><path d="M5.2 7.2v6.6M5.2 7.2 8 2.4c1.1 0 1.9.9 1.6 2.1L9.2 6.2h3.3c.9 0 1.6.9 1.3 1.8l-1.1 4.6c-.2.7-.8 1.2-1.5 1.2H5.2M2.2 7.2h3v6.6h-3z"/></g>'
  };
  var RATE_BTN = [[2, 'Favourite', 'comes back often'], [1, 'Good', 'comes back a little more'], [-1, 'Not again', 'never suggested again']];
  function rateHTML(id, rt) {
    var on = RATE_BTN.filter(function (b) { return b[0] === rt; })[0];
    return '<div class="day-rate no-print" role="group" aria-label="How was it?">' + RATE_BTN.map(function (b) {
      return '<button data-prate="' + esc(String(id)) + '" data-v="' + b[0] + '" aria-pressed="' + (rt === b[0]) + '" aria-label="' + b[1] + ': ' + b[2] + '" title="' + b[1] + ': ' + b[2] + '">' +
        '<svg viewBox="0 0 16 16" aria-hidden="true">' + RATE_ICON[b[0]] + '</svg></button>';
    }).join('') + (on ? '<span class="day-rate-say">' + on[1] + ' \u00b7 ' + on[2] + '</span>' : '') + '</div>';
  }
  var PROT_VAR = { Chicken: 'var(--p-ch)', Beef: 'var(--p-bf)', Pork: 'var(--p-pk)', Meatless: 'var(--p-ml)' };
  function renderPlan() {
    renderWeeks();
    var month = S.calMode === 'm', past = calPastWeek();
    ['planSum', 'calActs', 'calAgain'].forEach(function (id) { if ($(id)) $(id).classList.toggle('hide', month); });
    $('planGrid').classList.toggle('cal-month', month);
    if (month) { $('planGrid').innerHTML = calMonthHTML(); return; }
    /* The week at a glance: nights with a dinner, what is left to buy, and
       how long the list is — or, for a week gone by, what it was. */
    var nights = DAYS.filter(function (d) {
      return window.Store.day(d[0]).some(function (e) { return BY_ID[e.id] && pwIsDinner(BY_ID[e.id]); });
    }).length;
    var ents = planEntries(), built = buildList(ents), cost = listUsd(built);
    var nList = built.groups.reduce(function (n, g) { return n + g.items.length; }, 0);
    var favs = 0;
    DAYS.forEach(function (d) { window.Store.day(d[0]).forEach(function (e) { if (window.Store.rating(e.id) === 2) favs++; }); });
    if ($('planSetup')) $('planSetup').innerHTML = planSetUp() ? '' :
      '<div class="setup-card"><b>Where do your staples come from?</b><span>The storehouse, a food bank, a big shop or your own shelf. Set it once; it decides which dinners are suggested and how the list is split.</span>' +
      '<button class="pw-go" data-stepgo="where">Set it once</button></div>';
    /* The status line: the week's numbers, after "This week". */
    if ($('planSum')) $('planSum').innerHTML = ents.length ?
      ' \u00b7 <b>' + nights + ' of 7</b> nights planned' +
      (past ? ' \u00b7 <b>' + favs + '</b> \u2605' :
        ' \u00b7 <b>' + (cost < 0.5 ? '$0' : '~' + pwMoney(cost)) + '</b> to buy \u00b7 <b>' + nList + '</b> items') : '';
    /* A day is a row: its dinner is one button that opens the day's sheet
       (open, swap, cook double, take off, rate), and ↻ beside it swaps on
       the spot. The ×N, × and rating that used to crowd the row live in the
       sheet now, so the week reads as a week. */
    $('planGrid').innerHTML = CAL_DAYS.map(function (d) {
      var key = d[0], dt = calDate(key), gone = calPastDay(key), now = calIsToday(key);
      var list = window.Store.day(key).filter(function (e) { return BY_ID[e.id]; });
      var items = list.map(function (e) {
        var r = BY_ID[e.id], rt = window.Store.rating(r.id), din = pwIsDinner(r), twin = e.lo ? null : planTwin(e.id, key);
        var meta = e.lo ? '' : [r.time || '', e.x !== 1 ? 'cooked \u00d7' + fmtNum(e.x) : '', twin ? 'leftovers ' + calDayName(twin.d) : '',
          (gone || now) && rt ? (rt === 2 ? '\u2605 favourite' : rt === 1 ? 'good' : 'not again') : ''].filter(Boolean).join(' \u00b7 ');
        var nw = S.pwNew && S.pwNew[key + '|' + e.id];
        return '<div class="day-item' + (e.lo ? ' lo' : '') + (din ? '' : ' mini') + (nw ? ' new' : '') + '" style="--pc:' + (din ? PROT_VAR[pwProt(r)] : 'transparent') + '">' +
          '<button class="day-item-name" data-dayopen="' + esc(String(e.id)) + '" data-day="' + key + '" aria-label="' + esc(r.name) + ', ' + d[1] + '">' + esc(r.name) +
            (e.lo ? ' <span class="day-tag">leftovers</span>' : '') + (nw ? ' <span class="day-new">New</span>' : '') +
            (meta ? '<small>' + esc(meta) + '</small>' : '') + '</button>' +
          (gone || !din || e.lo ? '' : '<span class="day-ctl no-print"><button class="day-sw" data-pswap="' + esc(String(e.id)) + '" data-day="' + key + '" ' +
              'aria-label="Swap ' + esc(r.name) + ' for another dinner">\u21bb</button></span>') +
        '</div>';
      }).join('');
      return '<div class="day cal-day' + (now ? ' today' : '') + (gone ? ' past' : '') + '">' +
        '<div class="cal-date" aria-label="' + d[1] + (dt ? ' ' + dt.getDate() : '') + '"><small>' + d[2].toUpperCase() + '</small><b>' + (dt ? dt.getDate() : '') + '</b></div>' +
        '<div class="day-body">' + items +
          (gone ? (list.length ? '' : '<div class="day-empty">Nothing planned</div>')
            : '<button class="day-add no-print" data-addday="' + key + '" aria-label="Add to ' + d[1] + '">+ Add' + (list.length ? '' : ' a dinner') + '</button>') +
        '</div></div>';
    }).join('');
    /* The foot: what the week comes to, and the door to the list. */
    var nBuy = 0, nSrc = 0;
    built.groups.forEach(function (g) { if (g.src === 'b') nBuy = g.items.length; if (g.src === 's') nSrc = g.items.length; });
    if ($('planNext')) $('planNext').innerHTML = ents.length && !past ?
      '<button class="plan-next" data-stepgo="list"><b>The list</b><span>' +
        (nBuy ? nBuy + ' to buy' + (cost >= 0.5 ? ', ~' + pwMoney(cost) : '') : 'nothing to buy') +
        (nSrc ? ' \u00b7 ' + nSrc + ' from ' + srcW().the : '') + '</span></button>' : '';
    if ($('calActs')) $('calActs').innerHTML =
      (past ? '' : '<button class="nut-ask" data-calagain="1" aria-expanded="' + !!S.calAgain + '">Cook this again…</button>') +
      (ents.length ? '<button class="nut-ask" data-caltpl="1">Save as a template</button>' : '') +
      (past ? '' : '<button class="nut-ask" id="clearPlan">Clear week</button>');
    if ($('calAgain')) $('calAgain').innerHTML = S.calAgain && !past ? calAgainHTML() : '';
  }
  /* Cook this again: a template or a week gone by, onto this one. */
  function calAgainHTML() {
    var src = window.Store.sources();
    return '<div class="cal-again"><b>Cook this again</b><p>Put a past week or a saved template on this week. Only empty days still to come are filled.</p>' +
      (src.length ? src.slice(0, 12).map(function (w) {
        var nm = w.tpl ? w.name : (function () {
          var e = new Date(w.start); e.setDate(e.getDate() + 6);
          var f = function (d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
          return f(w.start) + ' – ' + f(e);
        })();
        return '<div class="cal-src"><span>' + esc(nm) + '<small>' + (w.tpl ? 'template' : 'week') + ' · ' + w.n + (w.n === 1 ? ' meal' : ' meals') + '</small></span>' +
          '<button class="ghost" data-calfrom="' + esc(w.id) + '">Use</button></div>';
      }).join('') : '<p>Nothing to copy yet. Weeks you plan will show up here.</p>') + '</div>';
  }
  /* A month at a glance: each day's dinner as a bar in its protein's
     colour and its name, so a run of the same one stands out. */
  function calMonthHTML() {
    var mf = S.calMonth || calMidnight(window.Store.activeWeek().start || new Date());
    var first = new Date(mf.getFullYear(), mf.getMonth(), 1), start = new Date(first);
    start.setDate(1 - first.getDay());
    var days = new Date(mf.getFullYear(), mf.getMonth() + 1, 0).getDate();
    var cells = Math.ceil((first.getDay() + days) / 7) * 7, today = calMidnight(new Date()), wk = window.Store.activeWeek().id;
    var out = '<div class="cal-dow">' + CAL_DAYS.map(function (d) { return '<span>' + d[2].charAt(0) + '</span>'; }).join('') + '</div><div class="cal-grid">';
    for (var i = 0; i < cells; i++) {
      var d = new Date(start); d.setDate(start.getDate() + i); d = calMidnight(d);
      var wid = window.Store.weekIdOf(d), key = CAL_DAYS[d.getDay()][0];
      var ents = window.Store.dayOf(wid, key).filter(function (e) { return BY_ID[e.id]; });
      var din = ents.filter(function (e) { return pwIsDinner(BY_ID[e.id]); })[0] || ents[0];
      var r = din && BY_ID[din.id];
      out += '<button class="cal-cell' + (d.getMonth() !== mf.getMonth() ? ' out' : '') + (d.getTime() === today.getTime() ? ' now' : '') +
        (d < today ? ' gone' : '') + (wid === wk ? ' wk' : '') + '" data-calweek="' + wid + '" aria-label="' +
        esc(d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + (r ? ': ' + r.name : '')) + '">' +
        '<b>' + d.getDate() + '</b>' +
        (r ? '<i style="background:' + (pwIsDinner(r) ? PROT_VAR[pwProt(r)] : 'var(--line-firm)') + '"></i><em>' + esc(din.lo ? 'Leftovers' : r.name) + '</em>' : '') +
        '</button>';
    }
    return out + '</div><div class="cal-legend">' + Object.keys(PROT_VAR).map(function (k) {
      return '<span><i style="background:' + PROT_VAR[k] + '"></i>' + k + '</span>';
    }).join('') + '</div>';
  }
  function calMove(dir) {
    S.pwNew = null;                          // New is this week's, as just filled
    if (S.calMode === 'm') {
      var m = S.calMonth || calMidnight(window.Store.activeWeek().start || new Date());
      S.calMonth = new Date(m.getFullYear(), m.getMonth() + dir, 1);
      renderPlan();
      return;
    }
    var st = window.Store.activeWeek().start || new Date();
    var d = new Date(st); d.setDate(d.getDate() + 7 * dir);
    S.calAgain = false;
    window.Store.setWeek(window.Store.weekIdOf(d));
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest || S.view !== 'plan') return;
    var t = e.target;
    if (t.closest('#calPrev')) { calMove(-1); return; }
    if (t.closest('#calNext')) { calMove(1); return; }
    if (t.closest('#calToday')) { S.calMonth = null; S.calAgain = false; window.Store.setWeek(window.Store.thisWeek()); renderPlan(); return; }
    var md = t.closest('[data-cal]');
    if (md) {
      S.calMode = md.dataset.cal;
      if (S.calMode === 'm') S.calMonth = calMidnight(window.Store.activeWeek().start || new Date());
      renderPlan();
      return;
    }
    var cw = t.closest('[data-calweek]');
    if (cw) { S.calMode = 'w'; window.Store.setWeek(cw.dataset.calweek); renderPlan(); return; }
    if (t.closest('[data-calagain]')) { S.calAgain = !S.calAgain; renderPlan(); return; }
    var cf = t.closest('[data-calfrom]');
    if (cf) {
      window.Store.cookAgain(cf.dataset.calfrom, CAL_DAYS.filter(function (d) { return !calPastDay(d[0]); }).map(function (d) { return d[0]; }));
      S.calAgain = false;
      return;
    }
    if (t.closest('[data-caltpl]')) {
      ask({ title: 'Save this week as…', value: 'Week of ' + window.Store.activeWeek().name, ok: 'Save' }, function (name) {
        if (name && name.trim()) window.Store.saveTemplate(name.trim());
      });
    }
  });
  /* A swipe across the week moves a week (or a month). */
  (function () {
    var x0 = null, y0 = null;
    document.addEventListener('touchstart', function (e) {
      if (S.view !== 'plan' || !e.target.closest || !e.target.closest('#planGrid')) { x0 = null; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) calMove(dx < 0 ? 1 : -1);
    }, { passive: true });
  })();

  /* One night swapped, by the same rules Plan my week picks with: the rest
     of the week stays, the answers are the ones last given. */
  function planSwap(id, day) {
    var a = pwAnswers(), picks = [];
    DAYS.forEach(function (d) {
      window.Store.day(d[0]).forEach(function (e) {
        var r = BY_ID[e.id];
        if (r && pwIsDinner(r) && !e.lo && !(d[0] === day && e.id === id)) picks.push({ r: r, x: e.x });
      });
    });
    S.pswapSeen = S.pswapSeen || {};
    var seen = S.pswapSeen[day] = S.pswapSeen[day] || [];
    seen.push(id);
    var nx = pwNext(a, picks, seen, day);
    if (!nx) { S.pswapSeen[day] = [id]; nx = pwNext(a, picks, [id], day); }
    if (!nx) return;
    var x = window.Store.scaleOf(id, day), twin = planTwin(id, day);
    window.Store.batch(function () {
      window.Store.removeFromDay(id, day);
      window.Store.addToDay(nx.r.id, day, x);
      /* Its leftovers night follows it, and it is still cooked double —
         into next week, when it is Saturday's. */
      if (twin) { window.Store.removeFromWeekDay(twin.wk, twin.d, id); window.Store.addToWeekDay(twin.wk, twin.d, nx.r.id, 1, true); }
    });
  }
  /* The day beside a day of the week on screen, one step either way, and
     the week it is in: {wk, d, at}, `at` its date. A week ends on Saturday
     and the cooking does not, so Saturday's next is next week's Sunday and
     Sunday's before is last week's Saturday. Saturday never offered Cook
     double at all: the day after it was looked up in a list of seven and
     was not there. */
  function calBeside(day, step) {
    var at = calDate(day);
    if (!at) {                               // a week with no dates: its own seven
      var j = PW_DAYS.indexOf(day) + step;
      return PW_DAYS[j] ? { wk: window.Store.activeWeek().id, d: PW_DAYS[j], at: null } : null;
    }
    at.setDate(at.getDate() + step);
    return { wk: window.Store.weekIdOf(at), d: PW_DAYS[at.getDay()], at: at };
  }
  function calGone(b) { return !!b.at && b.at < calMidnight(new Date()); }
  /* The leftovers night a cooked dinner feeds: the same recipe, eaten the
     next day, Saturday's on next week's Sunday. The day beside, or null. */
  function planTwin(id, day) {
    var n = calBeside(day, 1);
    if (!n) return null;
    var cooked = window.Store.day(day).some(function (e) { return e.id === id && !e.lo; });
    var lo = window.Store.dayOf(n.wk, n.d).some(function (e) { return e.id === id && e.lo; });
    return cooked && lo ? n : null;
  }
  /* And back the other way: the dinner a leftovers night is the second
     half of, cooked the day before. The day beside and its count, or null
     when nothing is cooked there — the other phone swapped it, or took it
     off. */
  function planCooked(id, day) {
    var b = calBeside(day, -1);
    var es = b ? window.Store.dayOf(b.wk, b.d).filter(function (e) { return e.id === id && !e.lo; }) : [];
    return es.length ? { wk: b.wk, d: b.d, at: b.at, x: es[es.length - 1].x } : null;
  }

  function calDayName(key) { var d = DAYS.filter(function (x) { return x[0] === key; })[0]; return d ? d[1] : key; }
  /* A day's dinner, opened: everything that could be done to it, in one
     place. Open the recipe, swap it, cook it double for a leftovers night,
     add another to the day, take it off — and, once it has been eaten, how
     it was. The week's rows carry none of this, so they stay rows. */
  function dayOpen(id, day) {
    S.daySheet = { id: id, day: day };
    pushSheet({ ds: 1 });
    renderModal();
    var x = document.querySelector('.sheet-x');
    if (x) x.focus();
  }
  function daySheetHTML() {
    var D = S.daySheet, r = BY_ID[D.id], key = D.day;
    var e = window.Store.day(key).filter(function (x) { return x.id === D.id; })[0];
    if (!r || !e) return '';
    var dt = calDate(key), gone = calPastDay(key), now = calIsToday(key), din = pwIsDinner(r);
    var twin = e.lo ? null : planTwin(e.id, key), nxt = calBeside(key, 1);
    var row = function (act, t, sub, cls) {
      return '<button class="dsh-row' + (cls ? ' ' + cls : '') + '" data-dsact="' + act + '"><span><b>' + t + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span></button>';
    };
    var a = pwAnswers(), plans = pwPlans();
    /* A leftovers night with nothing cooked the night before: the other
       phone swapped that dinner, or took it off, and this one went on saying
       "nothing to cook or buy" over a night with nothing to eat. */
    var prv = e.lo && !planCooked(e.id, key) ? calBeside(key, -1) : null;
    var meta = e.lo ? (prv ? 'Leftovers \u2014 but nothing is cooked on ' + calDayName(prv.d) : 'Leftovers \u00b7 nothing to cook or buy') :
      [r.time || '', e.x !== 1 ? 'cooked \u00d7' + fmtNum(e.x) : 'the recipe as written', twin ? 'leftovers ' + calDayName(twin.d) : ''].filter(Boolean).join(' \u00b7 ');
    /* Saturday's leftovers land in next week, out of sight from here, so
       only onto a Sunday with nothing on it yet. */
    var dbl = nxt && !calGone(nxt) && (nxt.wk === window.Store.activeWeek().id ||
      !window.Store.dayOf(nxt.wk, nxt.d).some(function (x) { return BY_ID[x.id]; }));
    return '<div class="scrim no-print" data-close="1">' +
      '<div class="sheet dsh-sheet" role="dialog" aria-modal="true" aria-label="' + esc(calDayName(key)) + '\u2019s dinner">' +
        '<div class="sheet-top"><div class="sheet-eyebrow">' + esc(calDayName(key)) + (dt ? ' \u00b7 ' + dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '') + '</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button></div>' +
        '<div class="dsh-body"><h2 class="dsh-h">' + esc(r.name) + '</h2><p class="dsh-m">' + esc(meta) + '</p>' +
        (din && !e.lo ? pwPlateHTML(r, pwFitNorm(a.fit, plans), plans) : '') +
        ((gone || now) && !e.lo ? '<div class="dsh-rate"><div class="dsh-rl">How was it?</div>' + rateHTML(e.id, window.Store.rating(e.id)) + '</div>' : '') +
        '<div class="dsh-rows">' +
        row('open', 'Open the recipe', '') +
        (gone || !prv || calGone(prv) ? '' : row('cook', 'Cook it ' + calDayName(prv.d), 'Double, so ' + calDayName(key) + ' is its leftovers \u00b7 the list follows')) +
        (gone || e.lo || !din ? '' : row('swap', 'Swap for another dinner', 'By the same rules as Plan my week')) +
        (gone || e.lo ? '' : (twin ? row('single', e.x / 2 > 1 ? 'Back to ×' + fmtNum(e.x / 2) : 'Back to one batch', 'Takes the leftovers off ' + calDayName(twin.d)) :
          dbl ? row('double', 'Cook double, leftovers ' + calDayName(nxt.d), nxt.wk === window.Store.activeWeek().id ? 'The list follows' : 'Into next week \u00b7 the list follows') : '')) +
        (gone ? '' : row('add', 'Add another to ' + calDayName(key), '')) +
        (gone ? '' : row('remove', 'Take it off ' + calDayName(key), twin ? 'And its leftovers night' : '', 'dsh-danger')) +
        '</div></div></div></div>';
  }
  document.addEventListener('click', function (e) {
    if (!S.daySheet || S.openId || !e.target.closest) return;
    var rt = e.target.closest('[data-prate]');
    if (rt) {
      var rid = idOf(rt.dataset.prate), v = Number(rt.dataset.v);
      window.Store.setRating(rid, window.Store.rating(rid) === v ? 0 : v);
      renderModal();
      return;
    }
    var b = e.target.closest('[data-dsact]');
    if (!b) return;
    var D = S.daySheet, id = D.id, day = D.day, act = b.dataset.dsact;
    if (act === 'open') { openRecipe(id); return; }
    if (act === 'add') { S.daySheet = null; addOpen(day, true); return; }
    var was = window.Store.day(day).filter(function (x) { return x.id === id; })[0] || { x: 1 };
    var twin = planTwin(id, day), nxt = calBeside(day, 1), prv = calBeside(day, -1);
    /* The leftovers night taken off on its own: nobody is eating the second
       batch, so the dinner goes back to one. Left doubled, its sheet offered
       Cook double again, and ×2 became ×4 and never ×1. Looked up before the
       batch, which changes the days under it. */
    var half = function (x) { return x / 2 >= 1 ? x / 2 : 1; };
    var cooked = was.lo ? planCooked(id, day) : null;
    window.Store.batch(function () {
      if (act === 'swap') planSwap(id, day);
      if (act === 'double' && nxt) {
        var cook = { r: BY_ID[id], x: was.x, day: day }, left = pwLeftovers(cook, nxt.d);
        window.Store.addToDay(id, day, cook.x);
        window.Store.addToWeekDay(nxt.wk, left.day, id, left.x, true);
      }
      /* The orphan's dinner put back the night before, cooked double for
         the household by the one rule a leftovers night has. */
      if (act === 'cook' && prv && !cooked) {
        var r0 = BY_ID[id], first = { r: r0, x: pwX(r0, pwAnswers().ppl), day: prv.d };
        pwLeftovers(first, day);
        window.Store.addToWeekDay(prv.wk, prv.d, id, first.x);
      }
      if (act === 'single') { window.Store.addToDay(id, day, half(was.x)); if (twin) window.Store.removeFromWeekDay(twin.wk, twin.d, id); }
      if (act === 'remove') {
        window.Store.removeFromDay(id, day);
        if (twin) window.Store.removeFromWeekDay(twin.wk, twin.d, id);
        else if (cooked) window.Store.addToWeekDay(cooked.wk, cooked.d, id, half(cooked.x));
      }
    });
    close();
  });

  // ------------------------------------------------------------- add to day
  /* + Add on a day: a suggestion, a search of every recipe, and a few ways
     in. What it adds goes on at the household's size (Plan my week's "how
     many are eating"), like everything the sheet picks. */
  var AD_SECS = { breakfast: ['1-1', '2-1'], lunch: ['1-3', '2-2'] };
  function adPool(f, day) {
    var R = RECIPES;   // with your edits laid over, and your own recipes after
    if (f === 'dinner') return R.filter(pwIsDinner);
    if (AD_SECS[f]) return R.filter(function (r) { return AD_SECS[f].indexOf(r.book + '-' + r.secNum) >= 0; });
    if (f === 'fav') return R.filter(function (r) { return window.Store.isFav(r.id) || window.Store.rating(r.id) === 2; });
    if (f === 'before') {
      var seen = pwRecent(52);
      return R.filter(function (r) { return seen[String(r.id)]; });
    }
    if (f === 'left') {
      var before = PW_DAYS.slice(0, PW_DAYS.indexOf(day)), ids = {};
      before.forEach(function (d) { window.Store.day(d).forEach(function (e) { if (!e.lo) ids[e.id] = 1; }); });
      return R.filter(function (r) { return ids[r.id]; });
    }
    return R;
  }
  function adSuggest() {
    var A = S.add, a = pwAnswers(), picks = [];
    DAYS.forEach(function (d) {
      window.Store.day(d[0]).forEach(function (e) { var r = BY_ID[e.id]; if (r && pwIsDinner(r)) picks.push({ r: r, x: e.x }); });
    });
    var nx = pwNext(a, picks, A.seen, A.day);
    if (!nx && A.seen.length) { A.seen = []; nx = pwNext(a, picks, [], A.day); }
    A.sug = nx ? nx.r.id : null;
  }
  /* Why this one: what it shares with the rest of the week, or that the
     kitchen already has it. */
  function adWhy(r) {
    var have = 0, n = 0, shared = {};
    DAYS.forEach(function (d) {
      if (d[0] === S.add.day) return;
      window.Store.day(d[0]).forEach(function (e) {
        var o = BY_ID[e.id];
        if (o && !e.lo) (o.ingp || []).forEach(function (it) { if (pwMain(o) === it.k) shared[it.k] = d[2]; });
      });
    });
    var sh = pwMain(r) && shared[pwMain(r)];
    (r.ingp || []).forEach(function (it) {
      if (!it.k || it.k === 'water' || it.k === 'free' || it.o) return;
      n++; if (!itemNeedsBuying(it)) have++;
    });
    if (sh) return 'Uses ' + sh + '’s ' + pwIngName(pwMain(r)).toLowerCase();
    if (n && have === n) return 'Everything’s on hand';
    if (n && have / n >= 0.7) return 'You have ' + have + ' of ' + n;
    return '';
  }
  function adRow(r, lo, ppl) {
    var x = lo ? 1 : pwX(r, ppl || pwAnswers().ppl), c = pwCost([{ r: r, x: x }], true), why = lo ? '' : adWhy(r);
    return '<div class="ad-row"><button class="ad-mt" data-adopen="' + esc(String(r.id)) + '">' +
      '<span class="ad-n">' + esc(r.name) + '</span>' +
      '<span class="ad-m">' + esc(r.time || '') + (lo ? ' · leftovers, nothing to buy' : ' · ' + (c < 0.5 ? 'nothing to buy' : '~' + pwMoney(c))) + '</span>' +
      (why ? '<span class="ad-why">' + esc(why) + '</span>' : '') + '</button>' +
      '<button class="ad-plus" data-adadd="' + esc(String(r.id)) + '"' + (lo ? ' data-lo="1"' : '') + ' aria-label="Add ' + esc(r.name) + '">+</button></div>';
  }
  function adListHTML() {
    var A = S.add, q = String(A.q || '').trim().toLowerCase();
    var pool = q ? RECIPES.filter(function (r) { return r.name.toLowerCase().indexOf(q) >= 0; }) : adPool(A.f, A.day);
    pool = pool.filter(function (r) { return window.Store.rating(r.id) !== -1 || q; });
    if (!pool.length) return '<p class="pw-note">' + (q ? 'No recipe called that.' : A.f === 'left' ? 'Nothing earlier in the week to have again.' : 'Nothing here yet.') + '</p>';
    var ppl = pwAnswers().ppl;
    return pool.slice(0, 40).map(function (r) { return adRow(r, !q && A.f === 'left', ppl); }).join('') +
      (pool.length > 40 ? '<p class="pw-note">' + (pool.length - 40) + ' more. Search to narrow them.</p>' : '');
  }
  function addHTML() {
    var A = S.add, dn = DAYS.filter(function (d) { return d[0] === A.day; })[0], r = A.sug && BY_ID[A.sug];
    var chips = [['dinner', 'Dinner'], ['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['fav', 'Favourites'], ['before', 'Made before'], ['left', 'Leftovers']];
    return '<div class="scrim no-print" data-close="1">' +
      '<div class="sheet pw-sheet ad-sheet" role="dialog" aria-modal="true" aria-label="Add to ' + dn[1] + '">' +
        '<div class="sheet-top"><div class="sheet-eyebrow">Add to ' + dn[1] + '</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button></div>' +
        '<div class="pw-body">' +
          (r ? '<div class="ad-sug"><div class="ad-sl">Suggested</div>' + adRow(r) +
            '<button class="ad-again" data-adsw="1">↻ Another</button></div>' : '') +
          '<input class="pw-find" id="adFind" type="search" placeholder="Search every recipe…" autocomplete="off" aria-label="Search recipes" value="' + esc(A.q || '') + '">' +
          '<div class="pw-chips ad-chips" role="group">' + chips.map(function (c) {
            return '<button class="pw-chip" data-adf="' + c[0] + '" aria-pressed="' + (A.f === c[0]) + '">' + c[1] + '</button>';
          }).join('') + '</div>' +
          '<div id="adList">' + adListHTML() + '</div>' +
        '</div></div></div>';
  }
  /* From a day's sheet it takes that sheet's place in the history rather
     than stacking on it, so one back lands on the week, not on a sheet that
     was already left. */
  function addOpen(day, inPlace) {
    S.add = { day: day, f: 'dinner', q: '', seen: [], sug: null };
    adSuggest();
    S.addOpen = true;
    if (inPlace && !popping) history.replaceState({ ad: 1 }, ''); else pushSheet({ ad: 1 });
    renderModal();
  }
  document.addEventListener('click', function (e) {
    if (!S.addOpen || !e.target.closest) return;
    var A = S.add;
    var f = e.target.closest('[data-adf]');
    if (f) { A.f = f.dataset.adf; A.q = ''; renderModal(); return; }
    if (e.target.closest('[data-adsw]')) { if (A.sug) A.seen.push(A.sug); adSuggest(); renderModal(); return; }
    var op = e.target.closest('[data-adopen]');
    if (op) { openRecipe(idOf(op.dataset.adopen)); return; }
    var ad = e.target.closest('[data-adadd]');
    if (ad) {
      var r = BY_ID[idOf(ad.dataset.adadd)];
      if (!r) return;
      var lo = ad.dataset.lo === '1';
      window.Store.addToDay(r.id, A.day, lo ? 1 : pwX(r, pwAnswers().ppl), lo);
      close();
      if (S.view === 'plan') renderPlan();
    }
  });

  // ------------------------------------------------------------ plan my week
  /* A few questions, then the week's dinners and what they cost. Chantel,
     trying Tapcook: answer some questions and get a list of meals to make
     for the week; Blake: "Let's just stick to what we have in app." So the
     prices are the book's own estimates (tools/prices.js, per 100 g) and the
     shelf counts as free. The answers are this device's, remembered; what
     the sheet puts on the week goes through the Store like any other add,
     so it lands on every phone in the household. */
  var PW_SECS = ['1-4', '2-3', '2-4'];
  var PW_KEY = 'sh.pw';
  var PW_AVOID = {
    Spicy: { k: ['hot_sauce', 'jalapeno'], n: /spicy|buffalo|jalape|chipotle|sriracha|hot sauce/i },
    Pork: { k: ['pork_roast', 'pork_sausage', 'ham', 'sweet_pork'], n: /pork|\bham\b|sausage|carnitas|bacon/i },
    Fish: { k: ['tuna', 'salmon'], n: /tuna|salmon|fish|shrimp/i },
    Beans: { k: ['black_beans', 'pinto_beans', 'white_beans', 'kidney_beans', 'refried_beans'], n: /\bbeans?\b(?! & )/i },
    Mushrooms: { k: ['cream_soup_mush', 'mushrooms'], n: /mushroom/i },
    Dairy: { k: ['cheddar', 'milk', 'sour_cream', 'cottage_cheese', 'butter', 'evaporated_milk', 'cream_soup_chx', 'cream_soup_mush', 'mozzarella', 'parmesan', 'cream_cheese'], n: /chees|creamy|alfredo/i }
  };
  /* What a dinner is built on: its heaviest meat. A dinner with no meat in
     it at all is Meatless, beans and tuna included. */
  var PW_PROT = ['Chicken', 'Beef', 'Pork', 'Meatless'];
  function pwProt(r) {
    var m = pwMain(r);
    if (!m) return 'Meatless';
    if (/chicken/.test(m)) return 'Chicken';
    if (/pork|ham|sausage/.test(m)) return 'Pork';
    return 'Beef';
  }
  /* The kind of night, from the section of the book a dinner sits in. */
  var PW_KIND = [['Weeknight', '2-3', 'Weeknight comfort'], ['Sunday', '2-4', 'Sunday feast'],
    ['Copycat', '2-7', 'Copycat'], ['Everyday', '1-4', 'Everyday']];
  function pwKind(r) {
    var at = r.book + '-' + r.secNum;
    return (PW_KIND.filter(function (k) { return k[1] === at; })[0] || [''])[0];
  }
  var PW_WEEKEND = ['sat', 'sun'];
  var PW_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];   // the calendar's order
  function pwAnswers() {
    var a = null;
    try { a = JSON.parse(localStorage.getItem(PW_KEY)); } catch (e) { a = null; }
    a = a && typeof a === 'object' ? a : {};
    var list = function (v, ok) { return Array.isArray(v) ? v.filter(ok) : []; };
    /* Answers saved before the nights were days said how many; that many
       from Monday is what they meant. */
    var days = Array.isArray(a.days) ? list(a.days, function (d) { return PW_DAYS.indexOf(d) >= 0; })
      : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].slice(0, [3, 4, 5, 7].indexOf(a.n) >= 0 ? a.n : 5);
    return {
      days: days,
      ppl: [2, 3, 4, 6, 8].indexOf(a.ppl) >= 0 ? a.ppl : 4,
      bud: a.bud >= 20 && a.bud <= 150 ? a.bud : 50,
      t: [20, 30, 45, 0].indexOf(a.t) >= 0 ? a.t : 45,
      prot: list(a.prot, function (x) { return PW_PROT.indexOf(x) >= 0; }),
      kind: list(a.kind, function (x) { return PW_KIND.some(function (k) { return k[0] === x; }); }),
      fit: pwFitNorm(a.fit, pwPlans()),
      avoid: list(a.avoid, function (x) { return PW_AVOID[x]; }),
      ing: list(a.ing, function (x) { return typeof x === 'string' && !!(window.PANTRY || {})[x]; }),
      rec: [0, 2, 4].indexOf(a.rec) >= 0 ? a.rec : 0,
      lo: [0, 1, 2].indexOf(a.lo) >= 0 ? a.lo : 0,
      /* What is on hand and what the storehouse gives are free. Whether the
         storehouse is part of it at all is Plan's step 1 now, not a
         question here. */
      shelf: true
    };
  }
  function pwSave(a) { try { localStorage.setItem(PW_KEY, JSON.stringify(a)); } catch (e) { /* private */ } }
  function pwMins(r) {
    var t = String(r.time || ''), h = t.match(/(\d+(?:\.\d+)?)\s*hr/), m = t.match(/(\d+)\s*min/);
    var v = (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
    return v || 60;
  }
  function pwIsDinner(r) {
    if (PW_SECS.indexOf(r.book + '-' + r.secNum) >= 0) return true;
    return r.book === 2 && r.secNum === 7 && !(r.makes || []).length && !!r.macro && r.macro.kcal >= 350;
  }
  function pwAvoids(r, avoid, ing) {
    if ((ing || []).length && (r.ingp || []).some(function (it) { return ing.indexOf(it.k) >= 0; })) return true;
    return avoid.some(function (w) {
      var rule = PW_AVOID[w];
      return rule.n.test(r.name) || (r.ingp || []).some(function (it) { return rule.k.indexOf(it.k) >= 0; });
    });
  }
  function pwX(r, ppl) {
    var n = Number(r.servN) || 4;
    return Math.max(1, Math.round((ppl / n) * 2) / 2);
  }
  /* What a set of recipes costs to buy: grams of every line, times its
     price, skipping what is on the shelf when the shelf counts. */
  function pwPrice(k) { var d = (window.PANTRY || {})[k]; return d && d.usd !== undefined ? d.usd : null; }
  function pwBuys(it, shelf) {
    if (!it || !it.k || it.k === 'water' || it.k === 'free' || it.o) return false;
    return shelf ? itemNeedsBuying(it) : true;
  }
  function pwCost(entries, shelf) {
    var usd = 0;
    entries.forEach(function (e) {
      if (e.lo) return;                 // eaten again, not bought again
      (e.r.ingp || []).forEach(function (it) {
        var p = pwBuys(it, shelf) ? pwPrice(it.k) : null;
        if (p) usd += it.g * e.x * p / 100;
      });
    });
    return usd;
  }
  function pwMain(r) {
    var best = '', g = 0;
    (r.ingp || []).forEach(function (it) {
      var c = ((window.PANTRY || {})[it.k] || {}).c;
      if (c === 'Meat' && it.g > g) { g = it.g; best = it.k; }
    });
    return best;
  }
  /* A dinner's share of a day on the Nourish plan, per serving: dinner's
     share of the calories at most, and at least its share of the protein.
     Nothing set in Nourish, and a plain 600 calories and 35 g.
   *
     It was a flat third of the day, which is no meal Nourish has: Plan's
     sheet said "Your plate: 1.6 servings · 771 cal" of a dinner that Fill,
     sharing the day by the meals' own weights, put on the plate at 1½ and
     723. So the share is dinner's weight among the meals (mSlotW), the one
     Fill shares by — of the plan's base targets, not the day's training or
     rest-day ones, because these are the numbers a household shares and
     they should not move every morning. */
  function pwFitCaps() {
    var t = mReadTargets(), kc = t.p * 4 + t.c * 4 + t.f * 9;
    if (!kc) return { kc: 600, p: 35 };
    var sh = pwDinnerShare();
    return { kc: Math.round(kc * sh / 25) * 25, p: Math.round(t.p * sh / 5) * 5 };
  }
  // dinner's fraction of the day: the slot keyed d, else the first of dinner's kind
  function pwDinnerShare() {
    var list = mReadSlots().list, din = null, sum = 0;
    list.forEach(function (s) {
      sum += mSlotW(s);
      if (!din && s.k === 'd') din = s;
    });
    if (!din) list.forEach(function (s) { if (!din && s.t === 'd') din = s; });
    return din && sum > 0 ? mSlotW(din) / sum : 1 / 3;
  }
  /* Whose plans a dinner can be held to. Blake: "Fits my Nourish plan is
     applicable to me right now, but what if my wife has a different plan?"
     So: this phone's own, first, and then everybody in the household who
     shares a dinner's numbers from Sync & sharing (Store.diners), by name.
   *
     Mine always comes from this phone's own targets, never back from the
     household, so my own entry there is left out of the others. "Mine" is
     the account signed in, or, signed out, the account whose day is on this
     device (mOwner) — the targets here are that person's. With neither,
     everybody sharing is somebody else. */
  function pwPlans() {
    var mine = pwFitCaps(), me = (mAccount() || {}).uid || mOwner();
    var d = window.Store.diners ? window.Store.diners() : {};
    var others = Object.keys(d).filter(function (uid) { return uid !== me; }).map(function (uid) {
      return { k: 'u:' + uid, n: d[uid].n, kc: d[uid].kc, p: d[uid].p, nth: '' };
    }).sort(function (x, y) { return x.n < y.n ? -1 : x.n > y.n ? 1 : x.k < y.k ? -1 : 1; });
    /* Two people sharing under one name made two chips that both said
       "Hits Blake’s plan", with no telling which was which. The second of a
       name (in account order, so it is the same one every time) is (2), and
       so on; my own name, shared, is the first of it. */
    var seen = Object.create(null);
    if (me && d[me]) seen[d[me].n] = 1;
    others.forEach(function (o) { var c = seen[o.n] = (seen[o.n] || 0) + 1; if (c > 1) o.nth = ' (' + c + ')'; });
    return [{ k: 1, n: '', kc: mine.kc, p: mine.p, nth: '' }].concat(others);
  }
  /* An answer, as the plans stand now: 1 hits mine, 'u:' and an account
     hits that person's, 3 everybody's, 2 high protein. Saved as true or
     false, it was the first. Somebody who has stopped sharing is Don't mind
     again, and everybody's with nobody else sharing is simply mine. */
  function pwFitNorm(v, plans) {
    if (v === true || v === 1) return 1;
    if (v === 2) return 2;
    if (v === 3) return plans.length > 1 ? 3 : 1;
    if (typeof v === 'string' && plans.some(function (pl) { return pl.k === v; })) return v;
    return 0;
  }
  /* The share an answer holds a dinner to. Everybody's is the strictest of
     them, the most protein for the calories: a dinner that meets it meets
     every other plan's too. */
  function pwCapFor(mode, plans) {
    if (mode === 3) return plans.reduce(function (b, pl) { return pl.p / pl.kc > b.p / b.kc ? pl : b; });
    return plans.filter(function (pl) { return pl.k === mode; })[0] || plans[0];
  }
  /* Whether a dinner meets that share, judged on protein for its calories,
     because a plate can be more or less than one serving. Held to a single
     serving, a 210 g day let nothing in: the best dinner in the books is 69 g
     a serving, and Blake "toggled on that selector and nothing was
     presented". A plan's answer (mine, theirs, everybody's): a plate within
     the dinner's calories reaches its protein. 2, High protein: at least 40%
     of the calories are protein, and Fill my day tops up the rest. */
  var PW_HIGH_P = 0.40;
  function pwFits(r, mode, cap) {
    if (!mode) return true;
    var m = r.macro;
    if (!m || !(m.kcal > 0)) return false;
    return mode === 2 ? 4 * (m.p || 0) / m.kcal >= PW_HIGH_P : (m.p || 0) / m.kcal >= cap.p / cap.kc;
  }
  /* The plate that meets it: enough for the protein, or the dinner's
     calories, whichever comes first, to a quarter of a serving — the step
     Nourish's own plate takes. It was a tenth, and "1.6 servings" is an
     amount the dial on the day cannot show; the plate said one thing here
     and another the moment it reached the day. */
  function pwPlate(r, cap) {
    var m = r.macro;
    if (!m || !(m.kcal > 0) || !(m.p > 0)) return null;
    var x0 = Math.min(cap.p / m.p, cap.kc / m.kcal), x = Math.ceil(x0 * 4 - 1e-9) / 4;
    if (x * m.kcal > cap.kc * 1.02) x = Math.floor(x0 * 4 + 1e-9) / 4;
    x = Math.round(Math.max(0.5, x) * 4) / 4;
    // and said in the plate's own words, "1 ¾ servings", as the day says it
    return { x: x, kc: Math.round(x * m.kcal), p: Math.round(x * m.p), say: mPortion(r, x).head };
  }
  /* What was eaten or planned in the last few weeks: the dated Nourish days,
     and what this sheet has put on nights before. */
  var PW_HIST = 'sh.pwHist';
  function pwHist() {
    try { var h = JSON.parse(localStorage.getItem(PW_HIST)); return h && typeof h === 'object' ? h : {}; }
    catch (e) { return {}; }
  }
  function pwRecent(weeks) {
    var out = {};
    if (!weeks) return out;
    var cut = new Date(); cut.setDate(cut.getDate() - weeks * 7);
    var cutK = dayKey(cut), h = pwHist();
    Object.keys(h).forEach(function (id) { if (h[id] >= cutK) out[id] = 1; });
    Object.keys(MDAYS).forEach(function (k) {
      if (k < cutK) return;
      var day = MDAYS[k] || {};
      Object.keys(day).forEach(function (sk) {
        if (Array.isArray(day[sk])) day[sk].forEach(function (it) { if (it && it.id !== undefined) out[String(it.id)] = 1; });
      });
    });
    return out;
  }
  /* weekend lifts the weeknight time limit; skip leaves one question out,
     so a chip can say how many dinners it would let in. */
  function pwPool(a, weekend, skip) {
    var fit = skip === 'fit' ? 0 : a.fit, cap = fit ? pwCapFor(fit, pwPlans()) : null, recent = pwRecent(a.rec);
    return RECIPES.filter(function (r) {
      if (!pwIsDinner(r)) return false;
      if (!weekend && a.t && pwMins(r) > a.t) return false;
      if (skip !== 'prot' && a.prot.length && a.prot.indexOf(pwProt(r)) < 0) return false;
      if (skip !== 'kind' && a.kind.length && a.kind.indexOf(pwKind(r)) < 0) return false;
      if (!pwFits(r, fit, cap)) return false;
      if (recent[String(r.id)]) return false;
      if (window.Store.rating(r.id) === -1) return false;     // "not again"
      if (!modeAllows(r)) return false;                        // storehouse only
      return !pwAvoids(r, a.avoid, a.ing);
    });
  }
  /* One more dinner for a week that already has `picks`: cheap, sharing
     what the week already buys, not the same meat three nights running, and
     a little chance so two runs are two weeks. Anything that would carry the
     week past the budget is passed over while something else fits. */
  /* `week` is the dinners already on the week, outside the sheet's picks:
     not picked again, their shared foods and meats counted, their cost in
     the budget, which is for the week. */
  function pwNext(a, newPicks, not, day, week) {
    var picks = newPicks.concat(week || []);
    var pool = pwPool(a, PW_WEEKEND.indexOf(day) >= 0).filter(function (r) {
      return not.indexOf(r.id) < 0 && !picks.some(function (e) { return e.r.id === r.id; });
    });
    if (!pool.length) return null;
    var have = {}, mains = {};
    picks.forEach(function (e) {
      (e.r.ingp || []).forEach(function (it) { if (pwBuys(it, a.shelf) && pwPrice(it.k)) have[it.k] = 1; });
      var m = pwMain(e.r); if (m) mains[m] = (mains[m] || 0) + 1;
    });
    var base = pwCost(picks, a.shelf);
    var scored = pool.map(function (r) {
      var x = pwX(r, a.ppl), inc = pwCost([{ r: r, x: x }], a.shelf), shared = 0;
      (r.ingp || []).forEach(function (it) { if (have[it.k]) shared++; });
      var m = pwMain(r), same = m ? (mains[m] || 0) : 0;
      /* Cook from what you have: the share of it already on hand. And the
         household's say: a favourite comes back often, a good one a little. */
      var hv = 0, hn = 0;
      (r.ingp || []).forEach(function (it) {
        if (!it.k || it.k === 'water' || it.k === 'free' || it.o) return;
        hn++; if (!itemNeedsBuying(it)) hv++;
      });
      var rt = window.Store.rating(r.id), liked = rt === 2 ? 2 : rt === 1 ? 0.8 : 0;
      return { r: r, x: x, inc: inc,
        fits: base + inc <= a.bud * (picks.length + 1) / Math.max(1, a.days.length, picks.length + 1) + 0.01,
        score: inc - shared * 0.8 + same * same * 3 - (hn ? hv / hn : 0) * 3 - liked + Math.random() * 2.5 };
    });
    var ok = scored.filter(function (c) { return c.fits; });
    var from = ok.length ? ok : scored.slice().sort(function (p, q) { return p.inc - q.inc; }).slice(0, 5);
    from.sort(function (p, q) { return p.score - q.score; });
    return { r: from[0].r, x: from[0].x };
  }
  /* The nights asked for that have no dinner yet, Monday first. */
  function pwNights(days) {
    return PW_DAYS.filter(function (d) {
      return (!days || days.indexOf(d) >= 0) && !calPastDay(d) &&
        !window.Store.day(d).some(function (e) { return BY_ID[e.id] && pwIsDinner(BY_ID[e.id]); });
    });
  }
  /* The dinners already planned on the week, cooked ones only. */
  function pwWeekDinners() {
    var out = [];
    PW_DAYS.forEach(function (d) {
      window.Store.day(d).forEach(function (e) {
        var r = BY_ID[e.id];
        if (r && pwIsDinner(r) && !e.lo) out.push({ r: r, x: e.x });
      });
    });
    return out;
  }
  /* Which asked-for nights are the night before's dinner again: the nights
     that follow another asked-for night, the weekend's big cook first. */
  function pwLoNights(a, nights) {
    var lo = {}, left = a.lo;
    var pairs = nights.filter(function (d, i) { return i + 1 < nights.length && PW_DAYS.indexOf(nights[i + 1]) === PW_DAYS.indexOf(d) + 1; });
    pairs.sort(function (x, y) { return (PW_WEEKEND.indexOf(y) >= 0) - (PW_WEEKEND.indexOf(x) >= 0); });
    pairs.forEach(function (d) {
      var nxt = PW_DAYS[PW_DAYS.indexOf(d) + 1];
      if (left > 0 && !lo[d] && !lo[nxt]) { lo[nxt] = d; left--; }
    });
    return lo;
  }
  /* A leftovers night, the one rule for it: the dinner the night before is
     cooked double, and the next night is the same dish, nothing to cook.
     Plan my week's picks and a day's "Cook double" both come through here. */
  function pwLeftovers(cooked, nxt) {
    cooked.x *= 2;
    return { r: cooked.r, x: 1, day: nxt, lo: true };
  }
  function pwPick(mine) {
    var a = S.pw.a, picks = [], nights = pwNights(a.days), week = pwWeekDinners();
    var lo = pwLoNights(a, nights);
    // the ones ticked on the list, in the order ticked, and not already on the week
    var wanted = (S.pw.want || []).map(function (id) { return BY_ID[id]; }).filter(function (r) {
      return r && !week.some(function (e) { return e.r.id === r.id; });
    });
    S.pw.used = 0;
    for (var i = 0; i < nights.length; i++) {
      if (lo[nights[i]]) {
        var from = picks.filter(function (e) { return e.day === lo[nights[i]]; })[0];
        if (from) picks.push(pwLeftovers(from, nights[i]));
        continue;
      }
      if (wanted.length) {
        var w = wanted.shift();
        picks.push({ r: w, x: pwX(w, a.ppl), day: nights[i] });
        S.pw.used++;
        continue;
      }
      if (mine) continue;
      var nx = pwNext(a, picks.filter(function (e) { return !e.lo; }), [], nights[i], week);
      if (nx) picks.push({ r: nx.r, x: nx.x, day: nights[i] });
    }
    S.pw.picks = picks;
    S.pw.seen = {};
  }
  function pwMoney(v) { return v < 0.5 ? '$0' : '$' + (v < 10 ? v.toFixed(2) : Math.round(v)); }
  /* A third item on an option is how many dinners it holds, said small. */
  // each row of chips named for a reader, as the question above it names it
  var PW_QN = { days: 'Which nights', ppl: 'How many are eating', prot: 'Protein', kind: 'Kind of night', t: 'Time on a weeknight',
    fit: 'Fits my Nourish plan', avoid: 'Leave out', lo: 'Leftovers nights', rec: 'Variety' };
  function pwChips(q, opts, cur, cls) {
    return '<div class="pw-chips" role="group"' + (PW_QN[q] ? ' aria-label="' + PW_QN[q] + '"' : '') + '>' + opts.map(function (o) {
      var on = Array.isArray(cur) ? cur.indexOf(o[0]) >= 0 : cur === o[0];
      // o[3]: a choice that has gone (a night already past), shown but not for taking
      return '<button class="pw-chip' + (cls ? ' ' + cls : '') + (o[3] ? ' pw-gone' : '') + '" data-pwq="' + q + '" data-pwv="' + esc(String(o[0])) + '" aria-pressed="' + on + '"' + (o[3] ? ' disabled' : '') + '>' + o[1] +
        (o[2] !== undefined ? ' <i>' + o[2] + '</i>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function pwIngName(k) { var d = (window.PANTRY || {})[k]; return d && d.l ? d.l : String(k).replace(/_/g, ' '); }
  /* Every ingredient any dinner uses, for the leave-out search. */
  function pwIngKeys() {
    var seen = {};
    RECIPES.forEach(function (r) {
      if (pwIsDinner(r)) (r.ingp || []).forEach(function (it) { if (it.k && it.k !== 'water' && it.k !== 'free' && it.k !== 'salt') seen[it.k] = (seen[it.k] || 0) + 1; });
    });
    return seen;
  }
  function pwSugHTML(q) {
    var a = S.pw.a, all = pwIngKeys();
    q = String(q || '').trim().toLowerCase();
    if (!q) return '';
    return Object.keys(all).filter(function (k) {
      return a.ing.indexOf(k) < 0 && pwIngName(k).toLowerCase().indexOf(q) >= 0;
    }).sort(function (x, y) { return all[y] - all[x]; }).slice(0, 6).map(function (k) {
      return '<button class="pw-chip" data-pwing="' + esc(k) + '">' + esc(pwIngName(k)) + ' <i>' + all[k] + '</i></button>';
    }).join('');
  }
  /* The count the bar shows: dinners that fit every answer on a weeknight
     (a weekend-only week is held to no time limit), against the nights
     still to fill. */
  function pwCount(a) {
    var wk = a.days.some(function (d) { return PW_WEEKEND.indexOf(d) < 0; });
    /* Different dinners needed: the leftovers nights are the night before's again. */
    var nights = pwNights(a.days);
    return { n: pwPool(a, !wk).length, need: nights.length - Object.keys(pwLoNights(a, nights)).length };
  }
  function pwStep1(a) {
    var cnt = pwCount(a), plans = pwPlans(), fit = plans[0], others = plans.slice(1);
    var byProt = {}, byKind = {};
    pwPool(a, false, 'prot').forEach(function (r) { var k = pwProt(r); byProt[k] = (byProt[k] || 0) + 1; });
    pwPool(a, false, 'kind').forEach(function (r) { var k = pwKind(r); byKind[k] = (byKind[k] || 0) + 1; });
    /* One chip a plan, everybody's once somebody else shares, then High
       protein; each with how many dinners it lets in. */
    var modes = [1].concat(others.map(function (o) { return o.k; }), others.length ? [3] : [], [2]);
    var byFit = {}, caps = {};
    modes.forEach(function (m) { byFit[m] = 0; caps[m] = pwCapFor(m, plans); });
    pwPool(a, false, 'fit').forEach(function (r) {
      modes.forEach(function (m) { if (pwFits(r, m, caps[m])) byFit[m]++; });
    });
    /* No plan in Nourish yet, and the chip said "Hits my plan" of a plan
       nobody had made: it is the plain 600 and 35 of pwFitCaps, and says so. */
    var noPlan = !kcalOf(mReadTargets());
    var fitChips = [[0, 'Don’t mind'], [1, noPlan ? 'Hits ' + fit.p + ' g in ' + fit.kc + ' cal' : 'Hits my plan', byFit[1]]].concat(
      others.map(function (o) { return [o.k, 'Hits ' + esc(o.n) + '’s plan' + o.nth, byFit[o.k]]; }),
      others.length ? [[3, others.length > 1 ? 'Hits everyone’s' : 'Hits both', byFit[3]]] : [],
      [[2, 'High protein', byFit[2]]]);
    // whose shares they are, said small; mine alone needs no name
    var shares = others.length ? plans.map(function (pl, i) {
      return (i ? esc(pl.n) + pl.nth : 'You') + ' ' + pl.kc + ' cal · ' + pl.p + ' g';
    }).join(' · ') : noPlan ? 'no plan yet — set your numbers in Nourish; a plain ' + fit.kc + ' cal · ' + fit.p + ' g protein a dinner until then'
      : fit.kc + ' cal · ' + fit.p + ' g protein a dinner';
    var low = cnt.n < cnt.need * 2, none = cnt.n < cnt.need || !cnt.need;
    return '<h2 class="pw-h">What kind of week?</h2>' +
      '<div class="pw-q"><div class="pw-ql">Which nights</div>' +
        pwChips('days', CAL_DAYS.map(function (d) { return [d[0], d[2], undefined, calPastDay(d[0])]; }), a.days, 'pw-dayc') + '</div>' +
      '<div class="pw-q"><div class="pw-ql">How many are eating?</div>' + pwChips('ppl', [[2, '2'], [3, '3'], [4, '4'], [6, '6'], [8, '8+']], a.ppl) + '</div>' +
      '<div class="pw-q"><div class="pw-ql">Spend no more than</div><div class="pw-money">' +
        '<input type="range" id="pwBud" min="20" max="150" step="5" value="' + a.bud + '" aria-label="Budget in dollars">' +
        '<b id="pwBudV">$' + a.bud + '</b></div></div>' +
      '<div class="pw-q"><div class="pw-ql">Protein <small>any you pick</small></div>' +
        pwChips('prot', PW_PROT.map(function (k) { return [k, k, byProt[k] || 0]; }), a.prot) + '</div>' +
      '<div class="pw-q"><div class="pw-ql">Kind of night <small>any you pick</small></div>' +
        pwChips('kind', PW_KIND.map(function (k) { return [k[0], k[2], byKind[k[0]] || 0]; }), a.kind) + '</div>' +
      '<div class="pw-q"><div class="pw-ql">Time on a weeknight <small>Sat and Sun can take longer</small></div>' +
        pwChips('t', [[20, '20 min'], [30, '30 min'], [45, '45 min'], [0, 'Anything']], a.t) + '</div>' +
      '<div class="pw-q"><div class="pw-ql">Fits my Nourish plan <small>' + shares + '</small></div>' +
        pwChips('fit', fitChips, a.fit) + '</div>' +
      '<div class="pw-q"><div class="pw-ql">Leave out</div>' +
        pwChips('avoid', Object.keys(PW_AVOID).map(function (k) { return [k, k]; }), a.avoid, 'pw-x') +
        (a.ing.length ? '<div class="pw-chips pw-ings">' + a.ing.map(function (k) {
          return '<button class="pw-chip pw-x" aria-pressed="true" data-pwingx="' + esc(k) + '" aria-label="Stop leaving out ' + esc(pwIngName(k)) + '">' + esc(pwIngName(k)) + ' ✕</button>';
        }).join('') + '</div>' : '') +
        '<input class="pw-find" id="pwIng" type="search" placeholder="Any ingredient: onion, cheddar…" autocomplete="off" aria-label="Leave out an ingredient">' +
        '<div class="pw-chips pw-sug" id="pwSug"></div></div>' +
      '<div class="pw-q"><div class="pw-ql">Leftovers nights <small>cook double, eat it again the next night</small></div>' +
        pwChips('lo', [[0, 'None'], [1, 'One'], [2, 'Two']], a.lo) + '</div>' +
      '<div class="pw-q"><div class="pw-ql">Variety</div>' +
        pwChips('rec', [[0, 'Repeats are fine'], [2, 'Nothing from the last 2 weeks'], [4, 'Last 4 weeks']], a.rec) + '</div>' +

      /* The count is a door: "See the 11" lists the dinners that fit, to
         tick the ones wanted. Blake, after a pick he could not see: "it just
         auto put some stuff there and didn't let me see the 11 that it
         selected". */
      /* Pick my dinners is picking: it opens the dinners that fit, to tick
         one a night. Blake: "I expect that when I click pick my dinners it
         would give me a selection to pick my dinners." */
      '<div class="pw-bar"><div class="pw-cnt' + (low ? ' low' : '') + '" role="status"><b>' + cnt.n + '</b> ' +
        (cnt.n === 1 ? 'dinner fits' : 'dinners fit') + '<span>' +
        (!cnt.need ? (!a.days.length ? 'pick a night' : a.days.every(calPastDay) ? 'those nights have gone' : 'those nights already have dinners') :
          cnt.n < cnt.need ? 'need ' + cnt.need + ', loosen a filter' : low ? 'not many to choose from' : 'for ' + cnt.need + (cnt.need === 1 ? ' night' : ' nights')) +
        '</span></div><button class="pw-go" data-pwsee="1"' + (none ? ' disabled' : '') + '>Pick my dinners</button></div>';
  }
  /* The dinners that fit, to tick the ones wanted. Pick my dinners puts the
     ticked ones on first, in the order ticked, and fills the nights left
     from the rest by its own rules. */
  function pwSeeHTML() {
    var a = S.pw.a, cnt = pwCount(a), want = S.pw.want;
    var wk = a.days.some(function (d) { return PW_WEEKEND.indexOf(d) < 0; });
    var pool = pwPool(a, !wk).slice().sort(function (x, y) { return x.name.localeCompare(y.name); });
    var left = Math.max(0, cnt.need - want.length);
    return '<button class="nut-ask pw-toq" data-pwback="1">\u2039 Back to the questions</button>' +
      '<h2 class="pw-h">The ' + (pool.length === 1 ? 'one' : pool.length) + ' that fit</h2>' +
      '<p class="pw-note pw-lede">Tick the ones you want this week. Tap a name to see the recipe.</p>' +
      '<div class="pw-fits">' + pool.map(function (r) {
        var on = want.indexOf(r.id) >= 0, m = r.macro || {}, full = !on && want.length >= cnt.need;
        return '<div class="pw-fit' + (full ? ' full' : '') + '" style="--pc:' + PROT_VAR[pwProt(r)] + '">' +
          '<button class="pw-want" data-pwwant="' + esc(String(r.id)) + '" aria-pressed="' + on + '"' + (full ? ' disabled' : '') + ' aria-label="Want ' + esc(r.name) + '"></button>' +
          '<button class="pw-fn" data-pwopen="' + esc(String(r.id)) + '"><b>' + esc(r.name) + '</b><span>' +
            esc([r.time || '', m.kcal ? Math.round(m.kcal) + ' cal' : '', m.p ? Math.round(m.p) + ' g protein' : ''].filter(Boolean).join(' \u00b7 ')) +
          '</span></button><i aria-hidden="true">\u203a</i></div>';
      }).join('') + '</div>' +
      '<p class="pw-note pw-tickl">' + (!want.length ? 'One a night: ' + cnt.need + (cnt.need === 1 ? ' night' : ' nights') + ' to fill.'
        : !left ? 'That\u2019s every night. They go on in the order you ticked them.'
        : left + (left === 1 ? ' night' : ' nights') + ' still open.') + '</p>' +
      '<div class="pw-or"><button class="nut-ask" data-pwpick="all">' +
        (want.length && left ? 'Add mine, and pick the other ' + (left === 1 ? 'night' : left) + ' for me' : 'Or pick them all for me') + '</button></div>' +
      '<div class="pw-bar"><div class="pw-cnt"><b>' + want.length + '</b> ticked<span>for ' + cnt.need + (cnt.need === 1 ? ' night' : ' nights') + '</span></div>' +
        '<button class="pw-go" data-pwpick="mine"' + (want.length ? '' : ' disabled') + '>' +
          (want.length ? 'Add ' + want.length + ' to my week' : 'Tick the ones you want') + '</button></div>';
  }
  /* With a Nourish answer, each dinner says the plate that meets it, for
     whoever the answer is about: mine for mine, theirs for theirs, and
     everybody's for everybody's. High protein is about nobody in
     particular, so it shows mine, or everybody's once anybody else shares. */
  function pwPlateHTML(r, mode, plans) {
    if (!mode) return '';
    var show = mode === 3 || (mode === 2 && plans.length > 1) ? plans
      : plans.filter(function (pl) { return pl.k === (mode === 2 ? 1 : mode); });
    return show.map(function (pl) {
      var x = pwPlate(r, pl);
      return x ? '<div class="pw-mm pw-plate">' + (pl.k === 1 ? 'Your' : esc(pl.n) + '’s') + ' plate' + pl.nth + ': ' + esc(x.say) +
        ' · ' + x.kc + ' cal · ' + x.p + ' g protein</div>' : '';
    }).join('');
  }
  /* One page: the answers, and one button. The dinners it picks land on
     the week itself, where every one of them can be opened, swapped or taken
     off like any other — Blake: "I don't like having two separate engines."
     The old second and third pages (the picks, their list) were that second
     engine. */
  function pwHTML() {
    var a = S.pw.a, plans = pwPlans();
    // somebody may have stopped sharing since the sheet opened
    a.fit = pwFitNorm(a.fit, plans);
    var body = S.pw.see ? pwSeeHTML() : pwStep1(a);
    return '<div class="scrim no-print" data-close="1">' +
      '<div class="sheet pw-sheet" role="dialog" aria-modal="true" aria-label="Plan my week">' +
        '<div class="sheet-top"><div class="sheet-eyebrow">Plan my week</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button></div>' +
        '<div class="pw-body">' + body + '</div></div></div>';
  }
  /* For the tests: the rules without the sheet, so a picker with chance in it
     can be run forty times and held to what it promises every time. */
  window.__pw = { pool: pwPool, next: pwNext, cost: pwCost, avoids: pwAvoids, prot: pwProt, kind: pwKind, fit: pwFitCaps, fits: pwFits, plate: pwPlate, answers: pwAnswers,
    plans: pwPlans, capFor: pwCapFor,
    count: pwCount, pick: function (a) { var keep = S.pw; S.pw = { a: a, picks: [], seen: {} }; pwPick(); var out = S.pw.picks; S.pw = keep; return out; } };
  function pwOpen() {
    var a = pwAnswers();
    /* The nights left this week, not the nights remembered from last time:
       on a Saturday, Monday to Friday came up lit, every one of them gone,
       and the bar said those nights already had dinners. */
    var left = PW_DAYS.filter(function (d) { return !calPastDay(d); });
    a.days = a.days.filter(function (d) { return !calPastDay(d); });
    if (!a.days.length && left.length) a.days = left;
    S.pw = { a: a, picks: [], seen: {}, want: [], see: false };
    S.pwOpen = true;
    pushSheet({ pw: 1 });
    renderModal();
    // the sheet takes the focus, as the recipe sheet does; it was left on the button behind
    var x = document.querySelector('.pw-sheet .sheet-x, .sheet-x[data-close="1"]');
    if (x && x.focus) x.focus();
  }
  document.addEventListener('click', function (e) {
    if (!S.pwOpen || !e.target.closest) return;
    var q = e.target.closest('[data-pwq]');
    if (q) {
      var a = S.pw.a, k = q.dataset.pwq, v = q.dataset.pwv;
      if (k === 'avoid' || k === 'prot' || k === 'kind' || k === 'days') {
        var at = a[k].indexOf(v);
        if (at >= 0) a[k].splice(at, 1); else a[k].push(v);
        if (k === 'days') a.days.sort(function (x, y) { return PW_DAYS.indexOf(x) - PW_DAYS.indexOf(y); });
      } else if (k === 'fit' && /^u:/.test(v)) a.fit = v;      // somebody else's plan, by account
      else a[k] = Number(v);
      pwSave(a);
      renderModal();
      return;
    }
    var ig = e.target.closest('[data-pwing]') || e.target.closest('[data-pwingx]');
    if (ig) {
      var ia = S.pw.a, ik = ig.dataset.pwing || ig.dataset.pwingx, ii = ia.ing.indexOf(ik);
      if (ig.dataset.pwing && ii < 0) ia.ing.push(ik);
      if (ig.dataset.pwingx && ii >= 0) ia.ing.splice(ii, 1);
      pwSave(ia);
      renderModal();
      if (ig.dataset.pwing && $('pwIng')) $('pwIng').focus();
      return;
    }
    if (e.target.closest('[data-pwsee]')) { S.pw.see = true; renderModal(); var sc = document.querySelector('#modalRoot .scrim'); if (sc) sc.scrollTop = 0; return; }
    if (e.target.closest('[data-pwback]')) { S.pw.see = false; renderModal(); return; }
    var wt = e.target.closest('[data-pwwant]');
    if (wt) {
      var wid = idOf(wt.dataset.pwwant), wi = S.pw.want.indexOf(wid);
      if (wi >= 0) S.pw.want.splice(wi, 1); else if (S.pw.want.length < pwCount(S.pw.a).need) S.pw.want.push(wid);
      renderModal();
      return;
    }
    var po = e.target.closest('[data-pwopen]');
    if (po) { rememberOpener(); openRecipe(idOf(po.dataset.pwopen)); return; }
    var pk = e.target.closest('[data-pwpick]');
    if (pk) {
      pwPick(pk.dataset.pwpick === 'mine');
      if (!S.pw.picks.length) { renderModal(); return; }
      var h = pwHist(), today = todayKey();
      window.Store.batch(function () {
        S.pw.picks.forEach(function (p) { window.Store.addToDay(p.r.id, p.day, p.x, p.lo); h[String(p.r.id)] = today; });
      });
      try { localStorage.setItem(PW_HIST, JSON.stringify(h)); } catch (err) { /* private */ }
      /* What landed is marked New on the week, and the toast can take it
         all back off again. */
      var added = S.pw.picks.slice(), used = S.pw.used || 0, cooked = added.filter(function (p) { return !p.lo; }).length;
      S.pwNew = {};
      added.forEach(function (p) { S.pwNew[p.day + '|' + p.r.id] = 1; });
      S.pwUndo = added.map(function (p) { return [p.r.id, p.day]; });
      close();
      if (S.view === 'plan') renderPlan();
      /* Picked for you can cost more than the budget asked for, when nothing
         cheaper fits (pwNext falls back to the cheapest): said here, not
         found on the list. */
      var usd = pwCost(added, S.pw.a.shelf), over = usd > S.pw.a.bud + 0.5;
      /* A phone whose storage is full keeps none of this: it said "3
         dinners added" over a week that was empty again on the next open. */
      if (window.Store.storageFull) {
        mToast('<b>Not kept on this phone</b><small>Its storage for the app is full' +
          (window.Store.house ? '; the dinners still go to the shared pantry while there’s signal' : '. Free some space to keep them') + '</small>');
        return;
      }
      mToast('<b>' + cooked + (cooked === 1 ? ' dinner' : ' dinners') + ' added</b>' +
        (used && used < cooked ? '<small>Your ' + used + ', and ' + (cooked - used) + ' picked for you</small>' : !used ? '<small>Picked for you</small>' : '') +
        (over ? '<small>About ' + pwMoney(usd) + ' to buy, over your $' + S.pw.a.bud + '</small>' : ''),
        'pw', 'data-pwundo');
    }
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('[data-pwundo]') || !S.pwUndo) return;
    var undo = S.pwUndo;
    S.pwUndo = null; S.pwNew = {};
    window.Store.batch(function () { undo.forEach(function (u) { window.Store.removeFromDay(u[0], u[1]); }); });
    var el = $('mToast'); if (el) el.hidden = true;
    if (S.view === 'plan') renderPlan();
  });

  // ---------------------------------------------------------------- kitchen
  /* Moving a food: to the kitchen, to the storehouse, or to the shop. Said
     once, it holds for every week after, on every phone in the household. */
  function setFoodSource(k, v) {
    var d = (window.PANTRY || {})[k];
    if (!d) return;
    window.Store.batch(function () {
      if (v === 'h') { window.Store.setKitchen(k, 1); window.Store.setSrc(k, null); return; }
      window.Store.setKitchen(k, d.sp ? 0 : null);
      window.Store.setSrc(k, v);
    });
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var tg = e.target.closest('[data-srctag]');
    if (tg) { S.listOpen = S.listOpen === tg.dataset.srctag ? null : tg.dataset.srctag; if (S.view === 'list') renderList(); return; }
    var b = e.target.closest('[data-src]');
    if (b) { e.preventDefault(); S.listOpen = null; setFoodSource(b.dataset.src, b.dataset.v); if (S.view === 'list') renderList(); return; }
  });
  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'kitFind') {
      S.kitQ = e.target.value;
      var g = $('kitchenBody'); if (g) g.innerHTML = kitGroupsHTML();
    }
  });

  // ------------------------------------------------------------ plan steps
  /* Plan, as the order you think in: where the food comes from, what you
     keep on hand, the week's meals, then getting it. Blake: "There's a
     natural flow to this." The first two are set once and remembered for the
     household; the bar is how you get back to them. */
  var PLAN_STEPS = [['where', 'Where'], ['pantry', 'On hand'], ['plan', 'Meals'], ['list', 'Shop']];
  function planSetUp() { return window.Store.opt('setup', false); }
  /* The four used to be a step bar across the top of Plan. Now the week is
     Plan, the list is one tap below it, and Where and On hand are settings,
     set once from the Sync & sharing sheet; the bar stays hidden. */
  function renderSteps() {
    var bar = $('planSteps');
    if (bar) bar.classList.add('hide');
  }
  function goStep(v) {
    if (v === 'plan' && (S.view === 'pantry' || S.view === 'where')) window.Store.setOpt('setup', true);
    S.view = v;
    try { localStorage.setItem('sh.view', S.view); } catch (e) { /* private mode */ }
    renderView();
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var st = e.target.closest('.pstep[data-view]') || e.target.closest('[data-stepgo]');
    if (st) { goStep(st.dataset.view || st.dataset.stepgo); return; }
    var sp = e.target.closest('[data-srcpick]');
    if (sp) { setSrcKind(sp.dataset.srcpick); return; }
    var wk = e.target.closest('[data-weekbuy]');
    if (wk) { window.Store.setOpt('buy', wk.dataset.weekbuy === '1'); return; }
    if (e.target.closest('[data-near]')) { window.Store.setOpt('near', !window.Store.opt('near', false)); return; }
    var lw = e.target.closest('[data-low]');
    if (lw) { window.Store.setLow(lw.dataset.low, !window.Store.low(lw.dataset.low)); return; }
    var more = e.target.closest('[data-kitmore]');
    if (more) { S.kitOpen = S.kitOpen || {}; S.kitOpen[more.dataset.kitmore] = !S.kitOpen[more.dataset.kitmore]; renderPantry(); return; }
    var pill = e.target.closest('[data-kitpill]');
    if (pill) {
      var k = pill.dataset.kitpill, d = (window.PANTRY || {})[k];
      if (!d && window.Store.pantryOwn()[k]) { window.Store.removePantryItem(k); return; }
      if (foodSource(k) === 'h') {
        window.Store.batch(function () { window.Store.setKitchen(k, d && d.sp ? 0 : null); window.Store.setSrc(k, null); });
      } else setFoodSource(k, 'h');
      return;
    }
    var cp = e.target.closest('[data-copyorder]');
    if (cp) {
      /* Name, then how much, with something between: the two spans sit
         flush, so their text ran together ("Bell peppers6", "Chicken
         breasts9 ½ lbs") on the bishop's copy. */
      var lines = [].map.call(document.querySelectorAll('.list-group.where-s .list-row'), function (r) {
        var n = r.querySelector('span:not(.qty)'), q = r.querySelector('.qty');
        var name = (n ? n.textContent : r.textContent).replace(/\s+/g, ' ').trim();
        var qty = q ? q.textContent.replace(/\s+/g, ' ').trim() : '';
        return qty ? name + ' — ' + qty : name;
      }).join('\n');
      var say = function (t) { cp.textContent = t; setTimeout(function () { cp.textContent = srcW().copy; }, 1800); };
      var fail = function () { say('Couldn\u2019t copy \u2014 select the list instead'); };
      try { navigator.clipboard.writeText(lines).then(function () { say('Copied'); }, fail); } catch (err) { fail(); }
    }
  });
  /* Where a household's staples come from: the foods that keep, canned, dry
     and frozen. The bishops' storehouse was the only answer once; a food bank,
     a big monthly shop or nothing but your own shelf are the same idea, so the
     list a source carries, the half of the shopping list that comes from it
     and the middle of Have / Storehouse / Buy all work the same for each,
     under its own name. Which one is two more household switches beside
     `store` (on/off, as the rules already allow), so nothing is migrated:
     a household that never chose is the storehouse, as it always was. */
  var SRC_WORDS = {
    sh: { pick: 'The bishops\u2019 storehouse', why: 'Its order list, ready to copy for your bishop.', name: 'Storehouse',
      the: 'the storehouse', your: 'your storehouse', list: 'Storehouse order', copy: 'Copy the order',
      reset: 'Back to the storehouse list?', back: 'back to the book\u2019s list' },
    fb: { pick: 'A food bank or pantry', why: 'What they give, and a store for the rest.', name: 'Food bank',
      the: 'the food bank', your: 'your food bank', list: 'From the food bank', copy: 'Copy the list',
      reset: 'Back to the starting list?', back: 'back to the starting list' },
    big: { pick: 'A big monthly shop', why: 'Stock up once a month, and a quick shop for fresh.', name: 'Big shop',
      the: 'the big shop', your: 'your big shop', list: 'The big shop', copy: 'Copy the list',
      reset: 'Back to the starting list?', back: 'back to the starting list' },
    own: { pick: 'I keep my own', why: 'No outside source. What isn\u2019t on the shelf gets bought.' }
  };
  /* Where the staples come from, set: the one way it is set, from Where and
     from the front door alike. Two household switches beside `store`. */
  function setSrcKind(kind, more) {
    window.Store.batch(function () {
      window.Store.setOpt('store', kind !== 'own');
      window.Store.setOpt('fb', kind === 'fb');
      window.Store.setOpt('big', kind === 'big');
      if (more) more();
    });
  }
  function srcKind() {
    if (!window.Store.opt('store', true)) return 'own';
    return window.Store.opt('fb', false) ? 'fb' : window.Store.opt('big', false) ? 'big' : 'sh';
  }
  /* The words for the source in use; the storehouse's when there is none, so
     a line about the source never reads "undefined" on a shelf-only phone. */
  function srcW() { var k = srcKind(); return SRC_WORDS[k === 'own' ? 'sh' : k]; }
  window.__src = { kind: srcKind, words: srcW };
  /* The answers to "where do your staples come from" and "this week", as the
     three modes the rest of Plan reads: both (a source and a store), sh (only
     what I have, the source's included), w (no source). */
  function planMode() {
    var st = window.Store.opt('store', true), buy = window.Store.opt('buy', true);
    return st && buy ? 'both' : st ? 'sh' : 'w';
  }
  function canBuy() { return window.Store.opt('buy', true) || window.Store.opt('near', false); }
  /* How many things a recipe needs from a store, the storehouse and the
     shelf aside. Storehouse only, a dinner that needs any (or, allowed,
     more than two) is not suggested. */
  function storeNeeds(r) {
    var n = 0, seen = {};
    (r.ingp || []).forEach(function (it) {
      if (!it.k || it.k === 'water' || it.k === 'free' || it.o || seen[it.k]) return;
      seen[it.k] = 1;
      if (itemNeedsBuying(it)) n++;
    });
    return n;
  }
  function modeAllows(r) {
    if (window.Store.opt('buy', true)) return true;
    return storeNeeds(r) <= (window.Store.opt('near', false) ? 2 : 0);
  }
  window.__mPortion = function (r, x) { return mPortion(r, x); };
  window.__flow = { needs: storeNeeds, mode: planMode, source: foodSource };
  function renderWhere() {
    var kind = srcKind(), W = srcW(), buy = window.Store.opt('buy', true), near = window.Store.opt('near', false);
    var opt = function (attr, v, on, t, d) {
      return '<button class="wh-opt" ' + attr + '="' + v + '" aria-pressed="' + on + '"><span class="wh-dot"></span>' +
        '<span><b>' + t + '</b><span>' + d + '</span></span></button>';
    };
    /* The step's question is the view's title here — Where has no title bar
       of its own the way Plan, List and Pantry do — so it is the h1. */
    $('whereBody').innerHTML = '<div class="step-k">Settings \u00b7 your kitchen</div>' +
      '<h1 class="step-h">Where do your staples come from?</h1>' +
      '<p class="step-sub">Staples are the foods that keep: canned, dry and frozen. This decides which meals Plan suggests and how your list is split.</p>' +
      ['sh', 'fb', 'big', 'own'].map(function (k) {
        return opt('data-srcpick', k, kind === k, SRC_WORDS[k].pick, SRC_WORDS[k].why);
      }).join('') +
      '<h2 class="step-h2 wh-week">This week</h2>' +
      opt('data-weekbuy', '1', buy, 'Buy what\u2019s missing', kind === 'own'
        ? 'Anything not on my shelf gets bought.' : 'Take what ' + W.the + ' has, buy the rest at Walmart.') +
      opt('data-weekbuy', '0', !buy, 'Only what I have', 'Nothing to buy. Only suggest meals I can make from ' +
        (kind === 'own' ? 'my shelf' : W.the + ' and my shelf') + '.') +
      (!buy ? '<label class="wh-near"><button class="kit-tog" data-near="1" role="switch" aria-checked="' + near + '" aria-label="Allow meals that need one or two things from a store"></button>' +
        ' Allow meals that need 1–2 things from a store</label>' : '') +
      '<p class="step-sub">Shared with your household: set it on one phone and the others follow.</p>' +
      (kind !== 'own' ? carryHTML() : '') +
      '<div class="step-next"><button class="pw-go" data-stepgo="plan">Done</button></div>';
  }

  // ------------------------------------------------------------ walmart cart
  /* The cart itself is src/walmart.js. What stays here is the app's part: an
     item number typed in one of its boxes is checked and kept there, and the
     list or the plan sheet it was typed on is drawn again, the fold left
     open. */
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || !t.dataset) return;
    if (t.dataset.wmid !== undefined) {
      var id = window.Walmart.parse(t.value);
      if (t.value.trim() && !id) { t.setCustomValidity('That is not a Walmart item number or product link'); t.reportValidity(); return; }
      t.setCustomValidity('');
      window.Walmart.setOwn(t.dataset.wmid, id);
    } else return;
    var open = !!(t.closest && t.closest('details[open]'));
    if (S.pwOpen) renderModal(); else if (S.view === 'list') renderList();
    if (open) { var dd = document.querySelectorAll('.wm-fix'); for (var i = 0; i < dd.length; i++) dd[i].open = true; }
  });

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

  var S_SYNC_STATE = 'off';
  var mBootTargetsDue = false;

  /* src/daysync.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
  var DAYSYNC = window.HiveParts.daysync({ S: S, mAccount: mAccount, mFollowScale: mFollowScale, mHealTargets: mHealTargets, mSuspectAccount: mSuspectAccount, mToast: mToast, renderMacros: renderMacros, renderModal: renderModal, LIVE: LIVE });
  function mBootTargets() { return DAYSYNC.mBootTargets(); }
  function mSyncState(next) { return DAYSYNC.mSyncState(next); }
  function mMarkAccountUI() { return DAYSYNC.mMarkAccountUI(); }
  function mSyncAway() { return DAYSYNC.mSyncAway(); }
  function mPut(key, v) { return DAYSYNC.mPut(key, v); }
  function mLsFull() { return DAYSYNC.mLsFull(); }
  function mLsFullSay() { return DAYSYNC.mLsFullSay(); }
  var MSTAMPS = DAYSYNC.MSTAMPS;

  var mClkSent = 0;                    // when the last stamped push left, by the local clock
  /* Whether the question "who is signed in?" can be answered yet. It cannot
     until Firebase has loaded, and Firebase loads asynchronously — so a
     device that IS signed in shows the signed-out sheet for the moment in
     between, which reads as "there is no way to sign out" rather than as
     "wait". Say wait. */
  var mAuthKnown = false;

  /* src/clock.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
  var CLOCK = window.HiveParts.clock({ MSTAMPS: MSTAMPS, mBuildFoods: mBuildFoods, mPut: mPut, mSyncPush: mSyncPush, LIVE: LIVE });
  function mNow() { return CLOCK.mNow(); }
  function mClockHear(data, pending) { return CLOCK.mClockHear(data, pending); }
  function mStamp(part, sub) { return CLOCK.mStamp(part, sub); }
  function mClaimAll() { return CLOCK.mClaimAll(); }
  function mAccount() { return CLOCK.mAccount(); }
  function mSuspectAccount() { return CLOCK.mSuspectAccount(); }
  function mOwner() { return CLOCK.mOwner(); }
  function mSetOwner(uid) { return CLOCK.mSetOwner(uid); }
  function mForgetDay() { return CLOCK.mForgetDay(); }
  function mAccountMark() { return CLOCK.mAccountMark(); }
  var MCLOCK_SLACK = CLOCK.MCLOCK_SLACK;
  var MCLOCK_ID = CLOCK.MCLOCK_ID;
  // Strengthen stamps by the same corrected clock; it reads MSKEW live through mNow
  if (window.Train && window.Train.clock) window.Train.clock(mNow);

  /* src/mydayparts.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
  var MYDAYPARTS = window.HiveParts.mydayparts({ mDoneAt: mDoneAt, mEarliestKey: mEarliestKey, mTrainedAt: mTrainedAt, mWeightFloor: mWeightFloor, LIVE: LIVE });
  function mSyncKey(k) { return MYDAYPARTS.mSyncKey(k); }
  function mPlainObj(v) { return MYDAYPARTS.mPlainObj(v); }
  function mNum(v) { return MYDAYPARTS.mNum(v); }
  function mSyncUnkey(e) { return MYDAYPARTS.mSyncUnkey(e); }
  function mLsJson(key) { return MYDAYPARTS.mLsJson(key); }
  var MSYNC_SHAPE = MYDAYPARTS.MSYNC_SHAPE;
  var MSYNC_SIMPLE = MYDAYPARTS.MSYNC_SIMPLE;
  var MSYNC_KEYED = MYDAYPARTS.MSYNC_KEYED;

  var mDirty = {}, mDirtyAll = true;
  /* Whether the account has answered since this device started listening.
     Nothing goes up before it has: a device signing in for the first time
     sent everything it had straight away, before it had read a word of the
     account, and what it had was nothing, stamped zero. A write lands
     whatever its stamp says, so the account's targets and profile became
     null on the server, and this device then refused the account's real
     copy, which was no newer than zero. Held until the first answer is
     merged, the whole push carries only what is newer or the same. */
  var mSyncHeard = false;

  /* src/dayup.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
  var DAYUP = window.HiveParts.dayup({ MCLOCK_SLACK: MCLOCK_SLACK, MSTAMPS: MSTAMPS, MSYNC_KEYED: MSYNC_KEYED, MSYNC_SHAPE: MSYNC_SHAPE, MSYNC_SIMPLE: MSYNC_SIMPLE, mBuildFoods: mBuildFoods, mLsJson: mLsJson, mNow: mNow, mNum: mNum, mPut: mPut, mSyncKey: mSyncKey, mSyncUnkey: mSyncUnkey, LIVE: LIVE });
  function mSyncPayload() { return DAYUP.mSyncPayload(); }
  function mSyncPartial() { return DAYUP.mSyncPartial(); }
  function mSyncTake() { return DAYUP.mSyncTake(); }
  function mMergeRemote(md) { return DAYUP.mMergeRemote(md); }

  var mFoldTimer = null;

  /* src/twocopies.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
  var TWOCOPIES = window.HiveParts.twocopies({ MSYNC_KEYED: MSYNC_KEYED, MSYNC_SIMPLE: MSYNC_SIMPLE, S: S, mLsJson: mLsJson, mMergeRemote: mMergeRemote, mNum: mNum, mPlainObj: mPlainObj, mSyncKey: mSyncKey, renderMacros: renderMacros, LIVE: LIVE });
  function mFoldNow() { return TWOCOPIES.mFoldNow(); }
  function mFoldDue() { return TWOCOPIES.mFoldDue(); }

  window.addEventListener('storage', function (e) {
    if (!e || !e.key || !/^bsc\.(macro|my)/.test(e.key)) return;
    clearTimeout(mFoldTimer);
    mFoldTimer = setTimeout(mFoldNow, 60);
  });

  var mSyncDoc = null, mSyncOff = null, mSyncTimer = null;
  var mAcctHouse;               // undefined until the server has said
  var mHouseTellNext = false;   // a join or create was asked for here: report it once it is real

  /* src/kitchen.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
  var KITCHEN = window.HiveParts.kitchen({ ask: ask, LIVE: LIVE });
  function mHouseTell(code) { return KITCHEN.mHouseTell(code); }
  function mHouseReconcile(data) { return KITCHEN.mHouseReconcile(data); }

  var mInviteBusy = false;

  /* src/invites.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
  var INVITES = window.HiveParts.invites({ S: S, ask: ask, mAccount: mAccount, mHouseTell: mHouseTell, renderAll: renderAll, LIVE: LIVE });
  function mInviteGet() { return INVITES.mInviteGet(); }
  function mInviteSet(tok) { return INVITES.mInviteSet(tok); }
  function mInviteTry() { return INVITES.mInviteTry(); }
  function mHouseAlone() { return INVITES.mHouseAlone(); }
  function mJoinBack() { return INVITES.mJoinBack(); }
  function mHouseWatch() { return INVITES.mHouseWatch(); }

  /* The last attempt to reach the server failed, rather than answering
     "nobody". The two are different facts and the sheet has different
     words for them, but only one of them survived: ready() rejects, the
     state goes to 'error', and then the NEXT mSyncStart — opening the
     sheet, pressing a button — finds mAuthKnown true and nobody signed in,
     falls through to the signed-out branch and writes 'off' straight over
     it. "Cannot reach the server" could never reach the screen it was
     written for; a dead network read as a fresh invitation to sign in. */
  var mSyncUnreachable = false;

  /* src/signin.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
  var SIGNIN = window.HiveParts.signin({ MCLOCK_ID: MCLOCK_ID, S: S, dinerKeep: dinerKeep, dinerWatch: dinerWatch, mAccount: mAccount, mAccountMark: mAccountMark, mBootTargets: mBootTargets, mClockHear: mClockHear, mCreditWeek: mCreditWeek, mForgetDay: mForgetDay, mHouseReconcile: mHouseReconcile, mInviteTry: mInviteTry, mMergeRemote: mMergeRemote, mOwner: mOwner, mSetOwner: mSetOwner, mSuspectAccount: mSuspectAccount, mSyncState: mSyncState, mSyncTake: mSyncTake, mTrainSig: mTrainSig, pwFitCaps: pwFitCaps, renderMacros: renderMacros, renderModal: renderModal, LIVE: LIVE });
  function mSyncRetry() { return SIGNIN.mSyncRetry(); }
  function mWatchUser() { return SIGNIN.mWatchUser(); }
  function mSyncStart() { return SIGNIN.mSyncStart(); }
  function mDeleteAccount() { return SIGNIN.mDeleteAccount(); }
  function mSyncPush(now) { return SIGNIN.mSyncPush(now); }

  window.addEventListener('online', mSyncRetry);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    mSyncRetry();
    if (mFoldTimer) mFoldNow();
  });

  function dayKey(d) {
    /* Built from the local calendar, never toISOString() — that is UTC, and it
       files an evening snack in Mountain time under tomorrow. */
    var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  }
  function todayKey() { return dayKey(new Date()); }
  /* A day key as a count of days, for spacing points and measuring gaps.
     From the calendar date itself, not from local midnight's instant: that
     was Math.round(midnight / one day), which is a whole number only where
     midnight falls near midnight UTC. East of +11 it falls at noon UTC the
     day before, where a daylight-saving hour tips the rounding either way —
     in Auckland two days in September came out as the same number and one
     in April was skipped, which bent the measured burn, the seven-day
     average and the plan line, and could divide the chart by zero. */
  function mDayN(k) {
    var m = String(k).split('-');
    return Math.round(Date.UTC(Number(m[0]), Number(m[1]) - 1, Number(m[2])) / 86400000);
  }
  function keyDate(k) {
    var m = k.split('-');
    return new Date(Number(m[0]), Number(m[1]) - 1, Number(m[2]));
  }
  var M_WDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var M_WDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];   // Monday first, as mWkIx counts
  var M_MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* The day on screen. With no day chosen it is today — but "today" as of
     the last time the screen was DRAWN, not as of the tap: a phone left on
     My Day across midnight still shows yesterday's plates, and a tap on one
     used to tick or delete the plate in that slot on the NEW day. The next
     draw moves the screen on; until then, taps go where the eye is. */
  var mDrawnToday = '';
  function mViewKey() { return S.macroDate || mDrawnToday || todayKey(); }

  /* Today and about four months behind it: the same stretch the intake log
     and each day's own targets are kept for (MINTAKE_DAYS), so a past day
     opened here is still judged against what it was aiming at. It was a
     fortnight, which was enough to change your mind about last week and not
     enough to find the dinner you had in August; Blake: "Copy from another
     day on each meal, and a date picker beyond two weeks." Still not a diary
     the browser carries forever. YYYY-MM-DD sorts as it dates, so the prune
     is one string comparison. */
  var MDAY_KEEP = 120;
  function mEarliestKey() {
    var d = new Date();
    d.setDate(d.getDate() - (MDAY_KEEP - 1));
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

  /* src/mealtime.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
  var MEALTIME = window.HiveParts.mealtime({ mDoneAt: mDoneAt, mReadSlots: mReadSlots, todayKey: todayKey });
  function mSlotOpens(list, i) { return MEALTIME.mSlotOpens(list, i); }
  function mNowMins() { return MEALTIME.mNowMins(); }
  function mAddsEaten(k, sk) { return MEALTIME.mAddsEaten(k, sk); }
  function mDayJudged(k) { return MEALTIME.mDayJudged(k); }

  function mReadTargets() {
    var t = null, hand = false;
    try {
      var raw = JSON.parse(localStorage.getItem('bsc.macroTargets'));
      if (raw && isFinite(raw.p) && isFinite(raw.f) && isFinite(raw.c)) {
        t = { p: Number(raw.p), f: Number(raw.f), c: Number(raw.c) };
        hand = raw.auto === 0;
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
       very-low-carb day typed by hand used to be corrected by this too.
     *
       Not any more: a record marked as the person's own (auto 0) is theirs.
       P 400 / F 10 / C 0 saved with "= 1690 kcal" under it, and the day read
       190 / 57 / 93 with no word, and after a reload storage itself had been
       rewritten. A day Nourish cannot plan is now refused at Save, with a
       line saying why (mtRefusal), so what reaches storage by hand is kept;
       this heals only what a plan wrote, or what an older build left. */
    var starved = 4 * t.c < MCARB_EAT * kcalOf(t);
    if (!hand && tdee !== null && (kcalOf(t) < mFloorK(pr) || starved)) {
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
    if (mPut('bsc.macroTargets', t)) { mStamp('t'); dinerKeep(); }   // see mWriteMyFoods
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

  /* What one serving of a recipe weighs, finished. Blake, on the Cafe Rio
     pork: the plate said half a serving and he had to open the recipe, switch
     it to grams and do the division on his phone's calculator. The weight
     that matters is the COOKED one, which only the cook can know — pork
     loses about a third in the pot — so the plate shows an estimate from the
     raw ingredients, marked "~", until the batch is weighed once. Then it is
     exact for the way he makes it. Keyed recipe id -> { s: grams a serving,
     on: day }. Synced as part `bg`. */
  var MBATCHG = (function () {
    try {
      var v = JSON.parse(localStorage.getItem('bsc.macroBatchG'));
      if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    } catch (e) { /* none yet */ }
    return {};
  })();
  function mSetBatchG(id, perServing) {
    mFoldDue();
    var k = String(id);
    if (perServing > 0) MBATCHG[k] = { s: Math.round(perServing * 10) / 10, on: todayKey() };
    else delete MBATCHG[k];
    mStamp('bg');
    mPut('bsc.macroBatchG', MBATCHG);
  }
  /* { g: grams a serving, est: true when it is the ingredient estimate }, or
     null when there is nothing to go on. The estimate counts what the recipe
     says is eaten of each line (the dredge's third, the frying oil's share). */
  function mServeG(r) {
    if (!r || r.food) return null;
    var w = MBATCHG[String(r.id)];
    if (w && w.s > 0) return { g: w.s, est: false };
    var tot = 0;
    (r.ingp || []).forEach(function (x) { tot += (Number(x.g) || 0) * (x.pe > 0 ? x.pe : 1); });
    return tot > 0 ? { g: tot / (r.servN || 1), est: true } : null;
  }
  function mSetNever(id, on) {
    mFoldDue();
    var k = String(id);
    if (on) MNEVER[k] = todayKey(); else delete MNEVER[k];
    mStamp('nv');
    mPut('bsc.macroNever', MNEVER);
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
    /* and dinner's share of the day moves the dinner you share (pwFitCaps):
       Save writes the targets first, so their own dinerKeep saw the old
       meals. */
    if (mPut('bsc.macroSlots', s)) { mStamp('sl'); dinerKeep(); }   // see mWriteMyFoods
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
  function mBatchStrip(r, it, tag) {
    if (S.mBatchOpen !== tag) return '';
    var sg = mServeG(r);
    if (!sg) return '';
    var n = r.servN || 1;
    var fmt = function (g) { return Math.round(g).toLocaleString(); };
    return '<div class="mwhy-strip mbatch-strip no-print">' +
      (sg.est
        ? '<p>About ' + fmt(sg.g) + ' g a serving, from the raw ingredients. Weigh the finished ' +
          (n > 1 ? 'batch' : 'dish') + ' once and this becomes exact.</p>' +
          '<span class="mbatch-in"><label>Whole batch <input type="text" inputmode="decimal" id="mBatchIn" ' +
            'maxlength="6" autocomplete="off" aria-label="Finished batch weight in grams"> g</label>' +
            '<span class="mbatch-n">makes ' + n + '</span>' +
            '<button class="btn-primary" data-mbsave="' + tag + '">Save</button></span>'
        : '<p>Your batch: ' + fmt(sg.g * n) + ' g for ' + n + (n === 1 ? ' serving' : ' servings') +
          ', so ' + fmt(sg.g) + ' g each.</p>' +
          '<span class="mwhy-acts"><button class="ghost" data-mbforget="' + tag + '">Weigh again</button></span>') +
    '</div>';
  }

  function mWhyStrip(it, tag) {
    var w = mWhyOf(it);
    if (!w || S.mWhyOpen !== tag) return '';
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

  /* The toast, and the voice it speaks with, both made once, at boot.
   *
     The toast used to be built by its own first message, role=status and
     all, and a live region that arrives WITH its words is a region nobody
     was listening to yet: a screen reader announces changes to a region it
     already knows about, so the first "won't be suggested" of a session was
     never read out, and every one after it was. The box that is drawn comes
     and goes with `hidden`; the words go to a region that is always there
     and never drawn, so the voice does not depend on the paint. */
  function mToastEls() {
    var el = $('mToast');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'mToast'; el.className = 'm-toast no-print'; el.hidden = true;
    /* Six seconds is a long time to read and a short time to reach for Undo
       with a thumb, or with Tab from the far end of the page. While it is
       being pointed at or holds the focus it stays; let go, and it leaves a
       little after. */
    el.addEventListener('mouseenter', mToastHold);
    el.addEventListener('focusin', mToastHold);
    el.addEventListener('mouseleave', mToastLet);
    el.addEventListener('focusout', mToastLet);
    document.body.appendChild(el);
    var say = document.createElement('div');
    say.id = 'mToastSay'; say.className = 'sr-only'; say.setAttribute('role', 'status');
    document.body.appendChild(say);
    return el;
  }
  function mToastHold() { clearTimeout(mToast.t); }
  function mToastLet(ev) {
    var el = $('mToast');
    if (!el || el.hidden) return;
    // still inside: focus moved between its own parts, or the pointer is over it
    if (ev && ev.type === 'focusout' && ev.relatedTarget && el.contains(ev.relatedTarget)) return;
    if (ev && ev.type === 'mouseleave' && el.contains(document.activeElement)) return;
    clearTimeout(mToast.t);
    mToast.t = setTimeout(function () { el.hidden = true; }, 3000);
  }
  /* `attr` names what Undo does elsewhere than Nourish's own (Plan my week's
     picks use data-pwundo). */
  function mToast(text, undo, attr) {
    var el = mToastEls();
    el.innerHTML = '<span>' + text + '</span>' +
      (undo ? '<button type="button" ' + (attr || 'data-mallow') + '="' + esc(String(undo)) + '">Undo</button>' : '');
    el.hidden = false;
    /* A tap on the message itself (not its Undo) puts it away early. */
    el.onclick = function (ev) { if (!ev.target.closest('[data-mallow], [data-pwundo]')) el.hidden = true; };
    /* Emptied first, so the same words twice are two announcements. */
    var say = $('mToastSay');
    if (say) {
      var words = el.firstChild.textContent;
      say.textContent = '';
      setTimeout(function () { say.textContent = words; }, 60);
    }
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

  /* `seed` is the routine placing itself on a new today, which is not
     anybody's edit — see the pin pass in mRenderDay. */
  function mEditDay(k, fn, seed) {
    mFoldDue();                           // the other copy's change first: see mFoldStored
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
       stale record, and pruning by one bound would have eaten it.
     *
       And nothing falls off the far end. It used to — past a week ahead was
       pruned too — but the only way to have a day out there is for the
       phone's clock to have gone back, and then the "future" days are the
       real ones: set the date back ten days and the next plate logged erased
       everything eaten since. Nothing on screen can reach past a week ahead,
       so a day out there costs nothing to keep. */
    var floor = mEarliestKey();
    Object.keys(MDAYS).forEach(function (dk) {
      if (dk < floor) delete MDAYS[dk];
    });
    mPut('bsc.macroDays', MDAYS);
    if (!seed) mStamp('d', k);
  }

  function kcalOf(t) { return Math.round(4 * t.p + 4 * t.c + 9 * t.f); }

  /* src/training.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
  var TRAINING = window.HiveParts.training({ dayKey: dayKey, keyDate: keyDate, mBlockN: mBlockN, mFloorK: mFloorK, mPut: mPut, mReadProfile: mReadProfile, mReadProfileRaw: mReadProfileRaw, mReadTargets: mReadTargets, mStrengthOn: mStrengthOn, mTrainedAt: mTrainedAt, mTrainedSaid: mTrainedSaid, todayKey: todayKey, LIVE: LIVE });
  function mWkIx(d) { return TRAINING.mWkIx(d); }
  function mTrainDays() { return TRAINING.mTrainDays(); }
  function mTrainDaysOwn() { return TRAINING.mTrainDaysOwn(); }
  function mSnapTargets() { return TRAINING.mSnapTargets(); }
  function mCreditDay(k) { return TRAINING.mCreditDay(k); }
  function mCreditWeek() { return TRAINING.mCreditWeek(); }
  function mTrainSig() { return TRAINING.mTrainSig(); }
  function mDayTargets(k) { return TRAINING.mDayTargets(k); }
  function mCycleOf(base) { return TRAINING.mCycleOf(base); }
  function mIsTrainingDay(k) { return TRAINING.mIsTrainingDay(k); }
  function mSynced() { return TRAINING.mSynced(); }
  function mCanSync() { return TRAINING.mCanSync(); }
  var MCARB_EAT = TRAINING.MCARB_EAT;
  var MDAYT = TRAINING.MDAYT;

  /* src/plans.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
  var PLANS = window.HiveParts.plans({ mHealTargets: mHealTargets, mPut: mPut, mStamp: mStamp, mWeightStats: mWeightStats, todayKey: todayKey, LIVE: LIVE });
  function mReadProfileRaw() { return PLANS.mReadProfileRaw(); }
  function mScaleLb() { return PLANS.mScaleLb(); }
  function mReadProfile() { return PLANS.mReadProfile(); }
  function mWriteProfile(pr) { return PLANS.mWriteProfile(pr); }
  function mBodyFat(pr) { return PLANS.mBodyFat(pr); }
  function mProtLevel(pr) { return PLANS.mProtLevel(pr); }
  function mProtRefLb(pr) { return PLANS.mProtRefLb(pr); }
  function mProtGrams(pr) { return PLANS.mProtGrams(pr); }
  function mProtFloorG(pr) { return PLANS.mProtFloorG(pr); }
  function mFloorK(pr) { return PLANS.mFloorK(pr); }
  var MFAT_MAX = PLANS.MFAT_MAX;
  var MGOALS = PLANS.MGOALS;
  var MPROT_LEVELS = PLANS.MPROT_LEVELS;
  var MPROT_WORDS = PLANS.MPROT_WORDS;
  var MFAT_FLOOR = PLANS.MFAT_FLOOR;
  var MCARB_SHARE = PLANS.MCARB_SHARE;

  /* src/burn.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
  var BURN = window.HiveParts.burn({ MCARB_EAT: MCARB_EAT, MCARB_SHARE: MCARB_SHARE, MDAYS: MDAYS, MFAT_FLOOR: MFAT_FLOOR, MFAT_MAX: MFAT_MAX, MGOALS: MGOALS, dayKey: dayKey, kcalOf: kcalOf, keyDate: keyDate, mBodyFat: mBodyFat, mDayN: mDayN, mDoneAt: mDoneAt, mFloorK: mFloorK, mProtFloorG: mProtFloorG, mProtGrams: mProtGrams, mPut: mPut, mTotals: mTotals, todayKey: todayKey, LIVE: LIVE });
  function mBurn(pr) { return BURN.mBurn(pr); }
  function mLogIntake() { return BURN.mLogIntake(); }
  function mMeasuredTdee() { return BURN.mMeasuredTdee(); }
  function mTdee(pr) { return BURN.mTdee(pr); }
  function mProject(pr) { return BURN.mProject(pr); }
  function mLever(pr, extraKcal) { return BURN.mLever(pr, extraKcal); }
  function mGoalPace(pr) { return BURN.mGoalPace(pr); }
  function mSplitKcal(kcal, t, pr) { return BURN.mSplitKcal(kcal, t, pr); }
  function mPlanCalc(pr) { return BURN.mPlanCalc(pr); }
  var MSTEP_BASE = BURN.MSTEP_BASE;
  var MINTAKE_DAYS = BURN.MINTAKE_DAYS;
  var MINTAKE = BURN.MINTAKE;

  /* src/dayflags.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
  var DAYFLAGS = window.HiveParts.dayflags({ MSTAMPS: MSTAMPS, M_WDAY: M_WDAY, keyDate: keyDate, mDayTargets: mDayTargets, mEarliestKey: mEarliestKey, mFoldDue: mFoldDue, mIsTrainingDay: mIsTrainingDay, mPut: mPut, mReadProfileRaw: mReadProfileRaw, mReadTargets: mReadTargets, mStamp: mStamp, mSynced: mSynced, mTrainDays: mTrainDays, mWkIx: mWkIx, todayKey: todayKey });
  function mDoneAt(k) { return DAYFLAGS.mDoneAt(k); }
  function mTrainedAt(k) { return DAYFLAGS.mTrainedAt(k); }
  function mTrainedSaid(k) { return DAYFLAGS.mTrainedSaid(k); }
  function mTrainRow(k) { return DAYFLAGS.mTrainRow(k); }
  function mTrainWord(k) { return DAYFLAGS.mTrainWord(k); }
  function mStrengthOn(k) { return DAYFLAGS.mStrengthOn(k); }
  function mSetTrained(k, on) { return DAYFLAGS.mSetTrained(k, on); }
  function mSetDone(k, on) { return DAYFLAGS.mSetDone(k, on); }
  function mSkipped(k, sk) { return DAYFLAGS.mSkipped(k, sk); }
  function mHushed(k, sig) { return DAYFLAGS.mHushed(k, sig); }
  function mSetHush(k, sig) { return DAYFLAGS.mSetHush(k, sig); }
  function mSetSkip(k, sk, on) { return DAYFLAGS.mSetSkip(k, sk, on); }
  function mSendOf(k) { return DAYFLAGS.mSendOf(k); }
  function mSetSend(k, v) { return DAYFLAGS.mSetSend(k, v); }
  var MDONE = DAYFLAGS.MDONE;
  var MTRAINED = DAYFLAGS.MTRAINED;
  var MSKIP = DAYFLAGS.MSKIP;
  var MHUSH = DAYFLAGS.MHUSH;
  var MSEND = DAYFLAGS.MSEND;

  /* src/weighin.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
  var WEIGHIN = window.HiveParts.weighin({ MSTAMPS: MSTAMPS, dayKey: dayKey, mFoldDue: mFoldDue, mPut: mPut, mStamp: mStamp });
  function mWUnit() { return WEIGHIN.mWUnit(); }
  function mWShow(lb) { return WEIGHIN.mWShow(lb); }
  function mWeightFloor() { return WEIGHIN.mWeightFloor(); }
  function mWriteWeight(k, lb) { return WEIGHIN.mWriteWeight(k, lb); }
  var WGAPI = WEIGHIN.WGAPI;
  var MWEIGHTS = WEIGHIN.MWEIGHTS;
  var MKG_LB = WEIGHIN.MKG_LB;

  /* One drawn set for every verb on the tab — the bottom bar's tools and
     each meal's own — so they read as one family: a 20px box, a 1.5 stroke,
     in the colour of the word beside it. */
  var MICONS = {
    scales: '<path d="M10 3v14M6.5 17h7M4 5.5h12M4 5.5 1.8 11a2.2 2.2 0 0 0 4.4 0zM16 5.5 13.8 11a2.2 2.2 0 0 0 4.4 0z"/>',
    another: '<path d="M15.8 11.5A6 6 0 1 1 14.2 5.7M15.6 2.8v3.4h-3.4"/>',
    skip: '<circle cx="10" cy="10" r="6.5"/><path d="M5.4 14.6 14.6 5.4"/>',
    plus: '<path d="M10 4v12M4 10h12"/>',
    /* Two links of a chain: these plates, kept together. Blake picked it, and
       Save for its word, after the word Keep alone left him asking what the
       button did. */
    keep: '<g transform="rotate(-45 10 10)"><rect x="1" y="7.25" width="10.5" height="5.5" rx="2.75"/>' +
      '<rect x="8.5" y="7.25" width="10.5" height="5.5" rx="2.75"/></g>',
    fromday: '<rect x="3" y="4.5" width="14" height="12.5" rx="1.5"/><path d="M3 8.5h14M7 2.5v4M13 2.5v4M7.5 12.8h5M10.5 10.6l2.2 2.2-2.2 2.2"/>'
  };
  function mIcon(name) {
    return '<svg class="mday-ic" viewBox="0 0 20 20" aria-hidden="true">' + MICONS[name] + '</svg>';
  }

  /* src/scale.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
  var SCALE = window.HiveParts.scale({ MDAYS: MDAYS, MFAT_MAX: MFAT_MAX, MWEIGHTS: MWEIGHTS, M_MONS: M_MONS, M_WDAYS: M_WDAYS, kcalOf: kcalOf, keyDate: keyDate, mBodyFat: mBodyFat, mDayN: mDayN, mFloorK: mFloorK, mGoalPace: mGoalPace, mMeasuredTdee: mMeasuredTdee, mPlanCalc: mPlanCalc, mReadProfile: mReadProfile, mReadTargets: mReadTargets, mTargRec: mTargRec, mTdee: mTdee, mTotals: mTotals, mcDaysApart: mcDaysApart, todayKey: todayKey, LIVE: LIVE });
  function mWeightStats() { return SCALE.mWeightStats(); }
  function mSparkSVG() { return SCALE.mSparkSVG(); }
  function mLbWord(d) { return SCALE.mLbWord(d); }
  function mPretty(k) { return SCALE.mPretty(k); }
  function mLongDate(k) { return SCALE.mLongDate(k); }
  function mPlanFace() { return SCALE.mPlanFace(); }
  function mPlanDetail() { return SCALE.mPlanDetail(); }
  function mPlanWeight(k, pr) { return SCALE.mPlanWeight(k, pr); }
  function mJump(k) { return SCALE.mJump(k); }
  function mSodiumOn(k) { return SCALE.mSodiumOn(k); }
  function mPaceFacts(k, draft) { return SCALE.mPaceFacts(k, draft); }
  var MSALT_JUMP = SCALE.MSALT_JUMP;
  var MSALT_DAY = SCALE.MSALT_DAY;

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
  /* How far the number the line would ask for may sit from the target before
     it is worth asking. It was five, so the morning asked "Dropping to 1,404
     brings it back to Dec 1 — Use 1,404 / Keep 1,421" over seventeen
     calories, and asked again the next morning over twenty: the estimate
     under it moves a few calories a day on its own. Fifty is about a
     twentieth of a pound a week — inside what a scale can see — and the
     sheet's status line (mtStatusHTML) holds to the same number. */
  var MLINE_NEAR = 50;

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
            : 'Inside your usual overnight range of ' + (Math.round(jump.url * 10) / 10) + ' lb.',
          null, 'salt');
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
      // said again only when the direction it reads changes
      if (mCoachQuiet(k, 'burn:' + (lbWk > 0.2 ? 'off' : lbWk < -0.2 ? 'on' : 'keep'))) return '';
      return mLineHTML(Math.abs(lbWk) < 0.2 ? 'wait' : 'calm', '\u25CE',
        '<b>You are burning about ' + meas.tdee.toLocaleString() + ' a day</b> and eating ' +
        ate.toLocaleString() + '.',
        lbWk > 0.2 ? 'That is ' + lbWk + ' lb a week off, measured over ' + meas.days + ' days.'
          : lbWk < -0.2 ? 'That is ' + Math.abs(lbWk) + ' lb a week on, measured over ' +
            meas.days + ' days.'
            : 'Which is maintenance, measured over ' + meas.days + ' days.', null, 'coach');
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
    var off = pf.off, need = pf.need, capped = pf.capped, arrive = pf.arrive;
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
      if (!pf.arriveD && pf.slow) {
        return 'You’re ' + (pf.plan.per < 0 ? 'down' : 'up') + ' about ' + pf.slow +
          ' lb a week these three weeks. Too slow yet to give a date.';
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
    /* The steady lines — at your goal, or on a target that is working — are
       news once: the day they first say it. After that they are said again
       only when the target or the verdict moves. The lines that ask for a
       decision are not these; they ask until answered. */
    var pace = late ? 'late' : early ? 'early' : 'on';
    if (pf.plan.daysLeft <= 0) {
      if (mCoachQuiet(k, 'goal:' + pr.goalLb)) return '';
      return mLineHTML('calm', '✓', '<b>You’re at your goal: ' + pr.goalLb + ' lb.</b>',
        'Set a new goal when you’re ready.', null, 'coach');
    }
    var eating = need !== null && cur > 0 && Math.abs(cur - need) <= MLINE_NEAR;
    /* Your target is your target: inside MLINE_NEAR the number this would
       ask for can be fifty off it, and naming that one as "Your target"
       would be naming a number nothing on the screen is eating to. */
    var head = target(cur);
    /* Taking the number already: say where it lands and leave it there. */
    if (eating) {
      /* The number it lands on drifts a few calories a day as the weeks
         move; to the nearest fifty is what counts as it having changed. */
      if (mCoachQuiet(k, 'eat:' + Math.round(need / 50) * 50 + ':' + pace)) return '';
      return mLineHTML('calm', late ? '▲' : early ? '▼' : '✓', head,
        est + ' ' + (late && capped
          ? (pf.capHigh ? 'This is already as much as your body can put to use — stay with it.'
            : 'This is already as low as it’s safe to go — stay with it.')
          : late ? 'Stay with it \u2014 this target is set to land on ' + goalD + '.'
            : early ? 'Keep it up.' : 'Stay with it.'), null, 'coach');
    }
    /* The offer follows the ESTIMATE, not the position on the plan line, so
       the words and the button never disagree: a date running late is offered
       the number that brings it back (less food on a cut, more on a gain),
       and one running early is offered the room. */
    var speeds = need !== null && cur > 0 &&
      (pf.plan.per < 0 ? need < cur - MLINE_NEAR : need > cur + MLINE_NEAR);
    var slows = need !== null && cur > 0 &&
      (pf.plan.per < 0 ? need > cur + MLINE_NEAR : need < cur - MLINE_NEAR);
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
    if (mCoachQuiet(k, 'calm:' + cur + ':' + pace)) return '';
    return mLineHTML('calm', late ? '◎' : '✓', head,
      est + ' Keep eating ' + fmt(cur) + ' a day.', null, 'coach');
  }

  /* `why`, when given, keys a line whose reason is folded behind "why?":
     the line says what happened, and the explanation opens in place. */
  function mLineHTML(kind, icon, text, sub, acts, why) {
    return '<div class="mline ' + kind + '" role="status">' +
      '<span class="mline-i" aria-hidden="true">' + icon + '</span>' +
      '<span class="mline-b">' +
        '<span class="mline-t">' + text + (sub && why ? ' ' + mWhyBtn(why) : '') + '</span>' +
        (sub ? (why ? mInfoText(why, sub, 'mline-s') : '<span class="mline-s">' + sub + '</span>') : '') +
        (acts ? '<span class="mline-a no-print">' + acts.map(function (a, i) {
          return '<button class="' + (i ? 'ghost' : 'btn-primary') + '" data-mline="' +
            esc(a[1]) + '">' + esc(a[0]) + '</button>';
        }).join('') + '</span>' : '') +
      '</span>' +
    '</div>';
  }


  /* ---- quiet by default
   *
     Help that never changes is behind an i, and a reason is behind "why?":
     both open in place, and stay open for the rest of the visit. They are
     toggled where they stand rather than by a redraw, so opening one never
     moves the sheet under the finger. Blake: "notes only when something
     changed, as one short line with 'why?' to expand; settings help behind
     \u24d8". */
  var MINFO = {};
  function mInfoBtn(key, label) {
    var open = !!MINFO[key];
    return '<button type="button" class="m-info" data-minfo="' + esc(key) + '" aria-controls="mi-' + esc(key) +
      '" aria-expanded="' + open + '" aria-label="' + esc(label || 'What this means') + '">' +
      '<span aria-hidden="true">i</span></button>';
  }
  function mWhyBtn(key) {
    return '<button type="button" class="m-why" data-minfo="' + esc(key) + '" aria-controls="mi-' + esc(key) +
      '" aria-expanded="' + !!MINFO[key] + '">why?</button>';
  }
  function mInfoText(key, html, cls) {
    return '<span class="m-info-t ' + (cls || '') + '" id="mi-' + esc(key) + '"' +
      (MINFO[key] ? '' : ' hidden') + '>' + html + '</span>';
  }
  /* A note that says the same thing it said on an earlier day says nothing
     new: it is shown on the day it first says it, and again only once what
     it says has changed. Remembered on this phone only — it is about what
     this screen has shown, not about the plan. */
  function mCoachQuiet(k, sig) {
    var seen = mLsJson('bsc.macroCoachSeen') || {};
    if (seen.sig === sig && seen.k && seen.k < k) return true;
    if (seen.sig !== sig) {
      try { localStorage.setItem('bsc.macroCoachSeen', JSON.stringify({ sig: sig, k: k })); } catch (e) { /* private mode */ }
    }
    return false;
  }

  // whether Strengthen is up to open the weekly check-in it draws
  function mWeekOn() { return !!(window.Train && window.Train.openCheckin); }

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
              /* This morning's number when you weighed, because that is the
                 number you just typed — Blake read the average there as the
                 app disagreeing with his scale. The average is on the open
                 card. */
              // in the unit the box asks in (mWUnit), the number typed back
              var wu = ' ' + mWUnit();
              var sumN = answeredW
                ? '<b>' + mWShow(MWEIGHTS[k]) + '</b><u>' + wu
                : st && st.n >= 2
                ? '<b>' + mWShow(st.avg7) + '</b><u>' + wu + ' avg'
                : '<b>' + mWShow(MWEIGHTS[k]) + '</b><u>' + wu;
              /* No verdict chip here: the coaching line directly under the
                 closed card already says where you stand, and a chip beside
                 it pushed the card's name onto two lines at phone width. */
              var tw = mTrainWord(k);
              return '<span class="mw-sum">' + sumN + '</u>' +
                (tw ? '<span class="mw-sum-t">' + tw + '</span>' : '') + '</span>';
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
            'aria-label="This morning\u2019s weight in ' + (mWUnit() === 'kg' ? 'kilograms' : 'pounds') + '" ' +
            'value="' + (v ? mWShow(v) : '') + '"> ' + mWUnit() +
            '<span class="mw-note" id="mWeightNote" role="status"></span></label>') +
      '</div>' +
      /* Next to the weigh-in, because it is the other thing a morning knows
         about you, and on its own line because that header row already
         carries a dot, a name, a fold cue and a number box.
       *
         It says nothing when there is no cycling to move: with a flat plan
         the tick would be a box that changes nothing, which is worse than no
         box. And it never claims to have earned anything — the calories were
         counted when the profile was filled in.
       *
         With no lifting days picked it says something only about a day that
         was trained anyway — a workout in Strengthen, or a tick already
         given — because that is the one day the carbohydrate moves. */
      (shut || ahead || mTrainDays().length >= 7 ||
        (!mTrainDays().length && !mIsTrainingDay(k) && (mSynced() || !mTrainedSaid(k))) ? ''
        : mTrainRow(k)) +
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
      (mLsFull() ? mLineHTML('act', '!', '<b>Not saved on this phone.</b>', esc(mLsFullSay())) : '') +
      (k === todayKey() ? mMovedHTML() : '') +
      mMorningHTML(k, 'face') +
      (!openAll ? '' : '<div class="mw-body">' + mMorningHTML(k, 'body') + body +
        /* The week, beside the plan: the same check-in Strengthen's Review
           opens, the scale and the food and the training side by side. */
        (face.has || mWeekOn()
          ? '<div class="mw-adj no-print">' +
            (face.has ? '<button class="ghost mplan-go" id="macroTargBtn">Adjust my plan</button>' : '') +
            (mWeekOn() ? '<button class="ghost mplan-go" id="macroWeekBtn">This week</button>' : '') + '</div>'
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

  /* src/fit.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
  var FIT = window.HiveParts.fit({ mDayEaten: mDayEaten, mDayTargets: mDayTargets, mIsFav: mIsFav, mShares: mShares, mViewKey: mViewKey });
  function macroFit(r, R, T, D) { return FIT.macroFit(r, R, T, D); }
  function mSaltChip(r, x) { return FIT.mSaltChip(r, x); }
  function mSaltNote(r, x) { return FIT.mSaltNote(r, x); }
  function mSaltFibre(r, x) { return FIT.mSaltFibre(r, x); }
  function mRank(list, day, targets, slot) { return FIT.mRank(list, day, targets, slot); }
  function mGapFresh() { return FIT.mGapFresh(); }
  function mMacLine(r, x, vsGap) { return FIT.mMacLine(r, x, vsGap); }
  function mClosesIt(r, x) { return FIT.mClosesIt(r, x); }
  var MW = FIT.MW;
  var MX = FIT.MX;
  var MFOOD_G_MAX = FIT.MFOOD_G_MAX;

  /* src/portion.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
  var PORTION = window.HiveParts.portion({ fixUnit: fixUnit, fmtNum: fmtNum, mFixNoun: mFixNoun, LIVE: LIVE });
  function mUnitWord(r) { return PORTION.mUnitWord(r); }
  function mByGram(r) { return PORTION.mByGram(r); }
  function mDialUnit(r) { return PORTION.mDialUnit(r); }
  function mLadder(r, x) { return PORTION.mLadder(r, x); }
  function mStepX(r, x, dir) { return PORTION.mStepX(r, x, dir); }
  function mTypedFromX(r, x) { return PORTION.mTypedFromX(r, x); }
  function mXFromTyped(r, n) { return PORTION.mXFromTyped(r, n); }
  function mPortion(r, x) { return PORTION.mPortion(r, x); }
  function mPortionText(r, x) { return PORTION.mPortionText(r, x); }

  /* The strip carries no words (Blake, 2026-09-27: "It's visual for a
     reason"): each day's verdict is its colour, and the button's label says
     it to a listener. */

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
      /* No words under the week at all. Blake: "Didn't need the words close
         or over or whatever either under that week chart. It's visual for a
         reason." The bar's fill and colour are the verdict; the label still
         says it to a listener. */
      var word = '';
      /* A day still being eaten says what is left rather than how it went,
         and its colour steps aside with the word. */
      /* No word while it is still being eaten. Blake: "The 27 to go text
         under the bar at the top. It can go away." The ring above already
         says what is left; the strip only speaks once the day is judged. */
      if (dk === k && state && state !== ' over' && got < tK && !mDayJudged(dk)) {
        state = ' open';
      }
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
        (train ? ', lifting day' : '') + ', ' + tK + ' calorie target' +
        (got ? ', ' + got + (done ? ' eaten, all done' : ' on the day') : '') + '">' +
        /* A lifting day wears a small dumbbell beside its letter. It was a
           middle dot the size of a full stop, in ochre, which nobody could be
           expected to decode; the button's label says "lifting day" for
           anyone listening, and the title says it to a pointer. */
        '<span class="mwk-w">' + M_WDAYS[d.getDay()].slice(0, 1) + '</span>' +
        /* The track and the target line are on every day, food or not, so
           the seven lines read as one line across the week. A lifting day's
           dumbbell sits inside the box at its foot, over the fill (Blake's
           pick B, 2026-09-27), not beside the letter. */
        '<span class="mwk-c" aria-hidden="true">' +
          '<span class="mwk-b">' + spark +
            (train ? '<svg class="mwk-lift" viewBox="0 0 14 8" aria-hidden="true">' +
              '<title>Lifting day</title>' +
              '<path d="M1 2.5v3M3.2 1v6M10.8 1v6M13 2.5v3M3.2 4h7.6" fill="none" ' +
                'stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' : '') +
          '</span><span class="mwk-g"></span>' +
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

  function mDayPick(open) {
    var row = $('macroDayPick').closest('.mday-pick');
    row.classList.toggle('hide', !open);
    if (!open) return;
    var inp = $('macroDayPick');
    inp.value = mViewKey();
    inp.focus();
    try { if (inp.showPicker) inp.showPicker(); } catch (e) { /* the box itself is the way in */ }
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
      /* Month first, the one form the app writes a date in: "Mon, Sep 28",
         or the word for it when there is one. */
      var word = step === 0 ? 'Today' : step === -1 ? 'Yesterday'
        : step === 1 ? 'Tomorrow' : '';
      opts.push('<option value="' + ok + '"' + (ok === k ? ' selected' : '') + '>' +
        (word ? word + ' &middot; ' + M_MONS[od.getMonth()] + ' ' + od.getDate() : mLongDate(ok)) + '</option>');
    }
    /* A day further back than the list, reached by the date box or the
       arrows, is named at the foot so the box still says where you are; and
       the last entry opens the date box, for any day the log keeps. */
    var listFrom = new Date(); listFrom.setDate(listFrom.getDate() - 13);
    if (k < dayKey(listFrom)) opts.push('<option value="' + k + '" selected>' + mLongDate(k) + '</option>');
    opts.push('<option value="pick">Earlier day\u2026</option>');
    $('macroDaySel').innerHTML = opts.join('');
    var dp = $('macroDayPick');
    if (dp) { dp.min = mEarliestKey(); dp.max = mLatestKey(); }
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
    /* And unstamped. The pins are this device's guess at a day it has not
       seen, not a change to it, and a guess stamped "now" beat the real day:
       a second device opened at lunch drew before its first word from the
       account, found no today, placed the routine, stamped it newer than the
       breakfast logged on the phone that morning, and sent it — and a day
       travels whole, so breakfast was gone on both. Unstamped, the seeded
       day is never sent on its own and the account's copy of today, when it
       comes, simply replaces it. The first real edit stamps it, pins and all. */
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
        }, true);
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
    var unticked = 0, loose = 0;
    slots.list.forEach(function (s0) {
      var pinned0 = (s0.pins || []).map(function (pn) { return String(pn.id); });
      (day[s0.k] || []).forEach(function (it) {
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
                '" data-mx="' + it.x + '" data-mfslot="' + esc(sk) + '">' + esc(r.name) + '</button>'
              : '<button class="mitem-name" data-open="' + esc(String(r.id)) +
                '" data-mx="' + it.x + '">' + esc(r.name) + '</button>') +
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
          mBatchStrip(r, it, tag) +
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
          /* The "why" chip leads the figures' row rather than sharing the
             name's: Blake, seeing names wrap around it, "add that new Fill's
             pick pill or added for fiber pill to the row below it" — with the
             strip it opens sitting above, under the name. */
          '<div class="mitem-r2">' +
            mWhyChip(it, tag) +
            (function () {
              /* A recipe's plate says what it weighs: the thing you put on
                 the scale. A tap weighs the batch or says how it was got. */
              var sg = mServeG(r);
              if (!sg) return port.detail ? '<span class="mitem-uom">' + esc(port.detail) + '</span>' : '';
              return '<button class="mitem-uom mitem-bw' + (sg.est ? ' est' : '') + '" data-mbatch="' + tag +
                '" aria-expanded="' + (S.mBatchOpen === tag ? 'true' : 'false') + '" aria-label="' +
                (sg.est ? 'About ' : '') + Math.round(sg.g * it.x) + ' grams on this plate">' +
                (sg.est ? '~' : '') + Math.round(sg.g * it.x) + ' g</button>';
            })() +
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
      var addBtn = '<button class="mslot-act add mslot-add" data-mslot="' + esc(sk) + '" ' +
        'aria-label="Add food to ' + esc(name) + '" title="Add food">' + mIcon('plus') + '</button>';
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
                    '" data-mx="' + it.x + '" data-mfslot="' + esc(sk) + '">' + esc(r2.name) + '</button>'
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
                '</span>' +
                /* Eaten is a tick in the tick's own column, and the name in
                   ink. It was a rule through the name, which reads as
                   deleted — and the plan was the one in ink, so the food you
                   had not eaten yet looked more real than the food you had.
                   Blake: "Eaten shows a ✓ in normal text, planned looks
                   lighter; no strike-through." */
                (it.eaten
                  ? '<span class="mthin-ok" role="img" aria-label="eaten">&#10003;</span>'
                  : '<span class="mthin-ok is-plan"><span class="vis-hidden">planned</span></span>') +
                '</div>';
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
                      /* Named aloud, since the meal's verbs are drawn
                         without their words. */
                      ' aria-label="Another suggestion for ' + esc(name) + '"' +
                      ' title="Another suggestion \u2014 walks down the best-fit list">' +
                      mIcon('another') + '</button>' +
                    '<button class="mslot-act mslot-bal" data-mbal="' + esc(sk) + '"' +
                      (items.length >= 2 ? '' : ' disabled') +
                      ' aria-label="Balance the portions on ' + esc(name) + '"' +
                      ' title="Solve these portions against this meal\u2019s macros">' +
                      mIcon('scales') + '</button>'
                  : '<button class="mslot-act mslot-skip" data-mskip="' + esc(sk) + '" ' +
                      'aria-label="Skip ' + esc(name) + ' today" ' +
                      'title="Not eating this today \u2014 its share goes to the other meals">' +
                      mIcon('skip') + '</button>') +
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
                   neither. It is still only drawn where it can act. */
                /* One row, always. Blake: "get all the buttons on the food
                   tag into a single row", and then "Just use icons and the
                   box size that is in the meal/food card uses." Each verb is
                   its drawing alone, in a plate key's box; its spoken name
                   and tooltip say the rest. Save is these plates kept as one
                   food you can reuse (a chain: kept together), Repeat is this
                   meal copied from another day. Add is last, alone at the
                   right edge, where the thumb already goes. */
                (items.length >= 2
                  ? '<button class="mslot-act mslot-keep" data-mkeep="' + esc(sk) + '" ' +
                    'aria-label="Save these plates as one food you can reuse" ' +
                    'title="Save these plates as one food you can reuse">' +
                    mIcon('keep') + '</button>' : '') +
                /* The same meal on another day, whole, in one tap. */
                '<button class="mslot-act mslot-from" data-mfrom="' + esc(sk) + '" ' +
                  'aria-label="Repeat ' + esc(name) + ' from another day" ' +
                  'title="Copy this meal from another day">' + mIcon('fromday') + '</button>' +
                addBtn +
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
    /* The word says what the next press does, and the chevrons point the
       way the cards will go: apart to open, together to shut. */
    var oa = $('macroOpenAll'), oaw = shut ? 'Open all' : 'Close all';
    if (oa.getAttribute('data-w') !== oaw) {
      oa.setAttribute('data-w', oaw);
      oa.title = shut ? 'Open every meal' : 'Close every meal';
      oa.querySelector('.mday-w').textContent = oaw;
      oa.querySelector('path').setAttribute('d', shut ? 'M6 7.5 10 3.5l4 4M6 12.5l4 4 4-4'
        : 'M6 3.5l4 4 4-4M6 16.5l4-4 4 4');
    }

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
    if (WGAPI.week) WGAPI.week();
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

  /* src/shares.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
  var SHARES = window.HiveParts.shares({ S: S, kcalOf: kcalOf, mDay: mDay, mInfoText: mInfoText, mReadSlots: mReadSlots, mSendOf: mSendOf, mSkipped: mSkipped, mSlotW: mSlotW, mTotals: mTotals, mViewKey: mViewKey, mWhyBtn: mWhyBtn, LIVE: LIVE });
  function mMealDone(sk) { return SHARES.mMealDone(sk); }
  function mMealAsk(sk, targets, slots, adjust) { return SHARES.mMealAsk(sk, targets, slots, adjust); }
  function mSlotOf(slots, k) { return SHARES.mSlotOf(slots, k); }
  function mLastFinished(targets, slots) { return SHARES.mLastFinished(targets, slots); }
  function mCascadeLineHTML(sk, targets, slots) { return SHARES.mCascadeLineHTML(sk, targets, slots); }
  function mAnyShut() { return SHARES.mAnyShut(); }
  var MCASCADE_MIN = SHARES.MCASCADE_MIN;

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
        v: vals, keys: keys, lim: null, plan: okPlan ? plan : null, dp: 1, trend: mcTrend(keys),
        say: function (v) { return v.toFixed(1) + ' lb'; },
        note: 'The line is your seven-day average, the one the plan reads; the dots are the mornings. ' +
          (okPlan ? 'The dashed line is the plan. The gap between them is the whole story.'
            : 'Name a weight and a date under the gear and the plan draws alongside.')
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
        say: function (v) { return Math.abs(v).toFixed(1) + ' lb ' + (v > 0 ? 'above' : v < 0 ? 'below' : 'on') + ' the plan'; },
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
        say: function (v) { return v.toFixed(1) + ' lb overnight'; },
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
      say: function (v) { return (v > 0 ? '+' : v < 0 ? '\u2212' : '') + Math.abs(v).toFixed(1) + ' lb on the week before'; },
      note: 'A week against the week before it. A working cut sits below zero.' };
  }

  /* The seven-day average at every morning: the mornings in the seven days
     up to and including it, the same window mWeightStats reads for the plan,
     taken at each morning rather than only at the last. It is the line the
     weight chart draws, because a single morning is water and salt. */
  function mcTrend(keys) {
    var dayN = mDayN;
    return keys.map(function (k, i) {
      var n = dayN(k), sum = 0, c = 0;
      for (var j = i; j >= 0 && n - dayN(keys[j]) < 7; j--) { sum += MWEIGHTS[keys[j]]; c++; }
      return Math.round(sum / c * 100) / 100;
    });
  }

  /* The last month, three, six, or everything, counted back from today: a
     year of mornings on one line flattens this month's loss to nothing. The
     limits stay the ones the whole series set, so a range cannot move them. */
  var MC_RANGES = [['1m', '1M', 31], ['3m', '3M', 92], ['6m', '6M', 183], ['all', 'All', 0]];
  function mcInRange(sr, rng) {
    var days = 0;
    MC_RANGES.forEach(function (r) { if (r[0] === rng) days = r[2]; });
    if (!days || sr.need) return sr;
    var from = new Date(); from.setDate(from.getDate() - days);
    var fromK = dayKey(from), keep = [];
    sr.keys.forEach(function (k, i) { if (k >= fromK) keep.push(i); });
    var pick = function (a) { return a ? keep.map(function (i) { return a[i]; }) : a; };
    var out = {};
    Object.keys(sr).forEach(function (f) { out[f] = sr[f]; });
    out.v = pick(sr.v); out.keys = pick(sr.keys); out.plan = pick(sr.plan);
    out.trend = pick(sr.trend); out.salt = pick(sr.salt);
    return out;
  }

  /* Round numbers for an axis: a step of 1, 2, 2.5 or 5 of some power of
     ten, about n of them across the range — "208, 210, 212", never
     "207.6, 211.7, 215.8". */
  function mcNiceTicks(lo, hi, n) {
    var span = hi - lo || 1, raw = span / (n || 4);
    var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / mag;
    var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
    var out = [];
    for (var v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step + step / 2; v += step) {
      out.push(Math.round(v * 1000) / 1000);
    }
    return out;
  }

  /* Drawn to be read on a phone: spaced by date, so a week off the scale
     looks like a week; the axis on round numbers; a viewBox about a phone's
     width, so its type is the size it says; and a finger on it (or a drag
     along it) reads the morning under it out above the chart, with a ring on
     the point. The weight chart draws the seven-day average as its line and
     each morning as a faint dot; the others draw their own values. */
  function mcChartSVG(sr) {
    var W = 350, H = 200, PL = 42, PR = 10, PT = 12, PB = 26;
    var all = sr.v.slice();
    if (sr.trend) all = all.concat(sr.trend);
    if (sr.plan) all = all.concat(sr.plan);
    if (sr.lim) { all.push(sr.lim.unpl); all.push(sr.lim.lnpl); }
    if (sr.zero) all.push(0);
    var tk = mcNiceTicks(Math.min.apply(null, all), Math.max.apply(null, all), 4);
    if (tk.length < 2) tk = [tk[0] - 1, tk[0] + 1];
    var lo = tk[0], hi = tk[tk.length - 1], step = tk[1] - tk[0];
    var dayN = mDayN;
    var t0 = dayN(sr.keys[0]), t1 = dayN(sr.keys[sr.keys.length - 1]);
    var px = function (i) {
      var t = dayN(sr.keys[i]);
      return t1 > t0 ? PL + (t - t0) / (t1 - t0) * (W - PL - PR) : (PL + W - PR) / 2;
    };
    var py = function (v) { return PT + (H - PT - PB) * (1 - (v - lo) / (hi - lo)); };
    var tick = function (v) { return step < 1 ? v.toFixed(1) : String(Math.round(v)); };
    var out = [];
    var rule = function (v, cls) {
      out.push('<line x1="' + PL + '" x2="' + (W - PR) + '" y1="' + py(v).toFixed(1) +
        '" y2="' + py(v).toFixed(1) + '" class="' + cls + '"/>');
    };
    tk.forEach(function (v) {
      rule(v, 'mc-grid');
      out.push('<text x="' + (PL - 6) + '" y="' + (py(v) + 4).toFixed(1) +
        '" text-anchor="end" class="mc-ax">' + tick(v) + '</text>');
    });
    if (sr.zero) rule(0, 'mc-zero');
    if (sr.lim) { rule(sr.lim.unpl, 'mc-lim'); rule(sr.lim.lnpl, 'mc-lim'); rule(sr.lim.cl, 'mc-cl'); }
    var line = function (vals, cls) {
      out.push('<polyline class="' + cls + '" points="' + vals.map(function (v, i) {
        return px(i).toFixed(1) + ',' + py(v).toFixed(1); }).join(' ') + '"/>');
    };
    if (sr.plan) line(sr.plan, 'mc-plan');
    line(sr.trend || sr.v, sr.trend ? 'mc-line mc-trend' : 'mc-line');
    var say = function (i) {
      return mPretty(sr.keys[i]) + ' · ' + (sr.say ? sr.say(sr.v[i]) : sr.v[i].toFixed(sr.dp)) +
        (sr.trend ? ' · average ' + sr.trend[i].toFixed(1) : '');
    };
    sr.v.forEach(function (v, i) {
      var out2 = sr.lim && (v > sr.lim.unpl || v < sr.lim.lnpl);
      var sa = sr.salt && sr.salt[i];
      out.push('<circle cx="' + px(i).toFixed(1) + '" cy="' + py(v).toFixed(1) + '" r="' +
        (out2 || sa ? 3.6 : sr.trend ? 2.4 : 2.2) + '" class="' +
        (sa ? 'mc-salt' : out2 ? 'mc-sig' : sr.trend ? 'mc-day' : 'mc-dot') + '"><title>' +
        esc(mPretty(sr.keys[i])) + ' · ' + v.toFixed(sr.dp) + '</title></circle>');
    });
    out.push('<circle class="mc-hl" r="6.5" cx="-20" cy="-20"/>');
    [0, sr.v.length - 1].forEach(function (i) {
      if (i === 0 && sr.v.length === 1) return;
      out.push('<text x="' + px(i).toFixed(1) + '" y="' + (H - 7) + '" text-anchor="' +
        (i ? 'end' : 'start') + '" class="mc-ax">' + esc(mPretty(sr.keys[i])) + '</text>');
    });
    var pts = sr.v.map(function (v, i) {
      return [Math.round(px(i) * 10) / 10, Math.round(py(v) * 10) / 10, say(i)];
    });
    return '<div class="mc-read" aria-live="polite">Latest: ' + esc(say(sr.v.length - 1)) + '</div>' +
      '<svg class="mc-svg" viewBox="0 0 ' + W + ' ' + H + '" data-pts="' + esc(JSON.stringify(pts)) +
      '" role="img" aria-label="' + esc(sr.note) + '">' + out.join('') + '</svg>';
  }
  // the finger on a chart: the morning nearest it, read out and ringed
  function mcRead(svg, clientX) {
    var pts;
    try { pts = JSON.parse(svg.getAttribute('data-pts') || '[]'); } catch (e) { return; }
    if (!pts.length) return;
    var r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    var x = (clientX - r.left) / r.width * vb.width, near = pts[0];
    pts.forEach(function (q) { if (Math.abs(q[0] - x) < Math.abs(near[0] - x)) near = q; });
    var hl = svg.querySelector('.mc-hl'), rd = svg.parentNode.querySelector('.mc-read');
    if (hl) { hl.setAttribute('cx', near[0]); hl.setAttribute('cy', near[1]); }
    if (rd && rd.textContent !== near[2]) rd.textContent = near[2];
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
      '<div class="sheet mt-sheet" role="dialog" aria-modal="true" aria-label="Save this meal">' +
        '<div class="sheet-top">' +
          /* Named for the button that opens it. */
          '<div class="sheet-eyebrow">Save ' + esc(nm.toLowerCase()) + '</div>' +
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
        '<div class="mt-div m-divi">Where it goes' + mInfoBtn('keep', 'Ours or yours') + '</div>' +
        mInfoText('keep', 'Ours is a recipe everyone with the pantry code can see. ' +
          'The other stays in your account.', 'mt-cap') +
        '<div class="sync-row">' +
          '<button class="btn-primary" data-mkdo="share">Add to Ours</button>' +
          '<button class="ghost" data-mkdo="mine">Keep it to myself</button>' +
        '</div>' +
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
        note.textContent = 'You\u2019ve picked food that isn\u2019t one of your staples, ' +
          'so Fill may now shop outside them.';
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
        ? '<div class="fp-note">You\u2019ve picked food that isn\u2019t one of your ' +
          'staples, so Fill may now shop outside them.</div>' : '') + blocks,
      total: total };
  }

  function mFavPickHTML() {
    var inner = mFavPickInner();
    var total = inner.total;
    return '<div class="scrim no-print" data-close="1">' +
      '<div class="sheet mt-sheet" role="dialog" aria-modal="true" aria-label="What you eat">' +
        '<div class="sheet-top">' +
          '<div class="sheet-eyebrow m-eyei">What do you actually eat?' + mInfoBtn('fp', 'How this list is used') + '</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
        '</div>' +
        mInfoText('fp', 'Tap anything you eat regularly. Nourish leans toward ' +
          'these when it suggests food &mdash; it does not stop offering anything ' +
          'else. You can change your mind on any food, any time.', 'mt-cap') +
        inner.blocks +
        (function () {
          var ids = Object.keys(MNEVER);
          if (!ids.length) return '';
          return '<div class="mt-div m-divi">Not suggested' + mInfoBtn('never', 'What this means') + '</div>' +
            mInfoText('never', 'Fill won\u2019t add these. You can still add them yourself by searching.', 'mt-cap') +
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


  /* ---- a meal from another day
   *
     Repeat a meal fast: the same meal on a day behind you, whole, in one
     tap. Blake: "'Copy from another day' on each meal, and a date picker
     beyond two weeks." The list is the latest days that had food on this
     meal; the date box reaches any day the log keeps. Each plate comes at
     the amount it was, and whether it arrives eaten is the rule every add
     follows (mAddsEaten): a meal whose time has come is eaten, a later one
     planned. */
  function mCopyItems(fromK, sk) {
    return ((MDAYS[fromK] || {})[sk] || []).filter(function (it) {
      return BY_ID[it.id] && Number(it.x) > 0;
    });
  }
  function mSlotName(sk) {
    var slots = mReadSlots(), n = slots.names[sk] || 'Meal';
    slots.list.forEach(function (sl) { if (sl.k === sk) n = sl.n; });
    return n;
  }
  function mCopyCardHTML(fromK, sk) {
    var items = mCopyItems(fromK, sk), kc = 0;
    items.forEach(function (it) { kc += ((BY_ID[it.id].macro || {}).kcal || 0) * it.x; });
    return '<div class="mcf-day">' +
      '<div class="mcf-h"><span class="mcf-d">' + esc(mLongDate(fromK)) + '</span>' +
        (items.length ? '<span class="mcf-k">' + Math.round(kc).toLocaleString() + ' kcal</span>' : '') + '</div>' +
      (items.length
        ? '<ul class="mcf-items">' + items.map(function (it) {
            var r = BY_ID[it.id];
            return '<li><span class="mcf-n">' + esc(r.name) + '</span>' +
              '<span class="mcf-x">' + esc(mPortionText(r, it.x)) + '</span></li>';
          }).join('') + '</ul>' +
          '<button class="ghost mcf-go" data-mcopy="' + fromK + '">' + mIcon('plus') +
            (items.length === 1 ? 'Add it' : 'Add all ' + items.length) + '</button>'
        : '<div class="mslot-empty">Nothing on ' + esc(mSlotName(sk)) + ' that day.</div>') +
    '</div>';
  }
  function mCopyFromHTML() {
    var o = S.mCopyFrom || {}, k = mViewKey(), sk = o.slot, name = mSlotName(sk);
    var today = todayKey(), recent = [];
    Object.keys(MDAYS).sort().reverse().forEach(function (dk) {
      if (dk === k || dk > today || recent.length >= 7) return;
      if (mCopyItems(dk, sk).length) recent.push(dk);
    });
    var picked = o.day && o.day !== k ? o.day : '';
    return '<div class="scrim no-print" data-close="1">' +
      '<div class="sheet mt-sheet mcf-sheet" role="dialog" aria-modal="true" aria-label="' +
        esc(name) + ' from another day">' +
        '<div class="sheet-top">' +
          '<div class="sheet-eyebrow">To ' + esc(name) + ' &middot; ' + esc(mPretty(k)) + '</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="mfs-name">' + esc(name) + ' from another day</div>' +
        '<label class="mcf-pick">Any day <input type="date" id="mcfDate" min="' + mEarliestKey() +
          '" max="' + mLatestKey() + '" value="' + picked + '"></label>' +
        (picked ? mCopyCardHTML(picked, sk) : '') +
        (recent.length
          ? '<div class="mt-div">Lately</div>' + recent.filter(function (dk) { return dk !== picked; })
              .map(function (dk) { return mCopyCardHTML(dk, sk); }).join('')
          : picked ? '' : '<div class="mslot-empty">Nothing on ' + esc(name) + ' in the days behind you yet.</div>') +
      '</div></div>';
  }

  /* ---- the food sheet: an amount, and Add
   *
     Blake: "An amount/unit box and an Add button on the food detail screen,
     plus fibre/sodium and any other nutrients the table has." The amount
     starts where every add starts (what you logged last time, else one of
     it) and can be said in any unit the table weighs the food in; the Add
     goes to the meal the plate was on, or to the meal you choose. */
  function mFsUnits(r) {
    if (!r.food || !r.grams) return [{ u: mDialUnit(r), g: 0 }];
    var key = String(r.id).slice(2), N = window.Nutrition;
    var f = N && N.FOODS && N.FOODS[key];
    var own = { u: r.unit === 'each' ? 'whole' : String(r.unit), g: r.grams };
    var out = mByGram(r) ? [{ u: 'g', g: 1 }, own] : [own, { u: 'g', g: 1 }];
    if (r.unit === 'g') out = [{ u: 'g', g: 1 }];
    Object.keys((f && f.g) || {}).forEach(function (u) {
      var w = u === 'each' ? 'whole' : u;
      if (!(f.g[u] > 0) || out.some(function (o) { return o.u === w; })) return;
      out.push({ u: w, g: f.g[u] });
    });
    return out;
  }
  function mFsX(r, amt, unit) {
    var n = Number(amt);
    if (!isFinite(n) || n <= 0) return null;
    var x = unit && unit.g && r.grams ? n * unit.g / r.grams : n;
    return Math.round(x * 10000) / 10000;
  }
  function mFsAmt(r, x, unit) {
    var n = unit && unit.g && r.grams ? x * r.grams / unit.g : x;
    return unit && unit.u === 'g' ? Math.round(n) : Math.round(n * 100) / 100;
  }
  var MNUTR = [['kcal', 'Calories', ''], ['p', 'Protein', 'g'], ['f', 'Fat', 'g'], ['c', 'Carbs', 'g'],
    ['fib', 'Fibre', 'g'], ['na', 'Sodium', 'mg']];
  function mFsNutrHTML(r, x) {
    var mac = r.macro || {}, known = {};
    var row = function (lab, v, u) {
      return '<div class="mfs-nr"><span>' + esc(lab) + '</span><b>' + v + (u ? ' ' + u : '') + '</b></div>';
    };
    var out = MNUTR.map(function (n) {
      known[n[0]] = 1;
      var v = (Number(mac[n[0]]) || 0) * x;
      // whole grams, as the plate's own line says them; fibre to a tenth
      return row(n[1], n[0] === 'fib' ? String(Math.round(v * 10) / 10) : Math.round(v).toLocaleString(), n[2]);
    });
    // anything else the table carries for it, named as the table names it
    Object.keys(mac).forEach(function (k2) {
      if (known[k2] || typeof mac[k2] !== 'number') return;
      out.push(row(k2, String(Math.round(mac[k2] * x * 10) / 10), ''));
    });
    return out.join('');
  }
  function mFsState(r) {
    var o = S.foodOpen, units = mFsUnits(r);
    var ui = Math.min(units.length - 1, Math.max(0, Number(o.u) || 0));
    var amt = o.amt !== undefined ? o.amt : mFsAmt(r, mpLastXs()[r.id] || 1, units[ui]);
    return { units: units, ui: ui, amt: amt, x: mFsX(r, amt, units[ui]) };
  }
  // the numbers under the box, as it is typed in
  function mFsRefresh() {
    var o = S.foodOpen, r = o && BY_ID[o.id], box = $('mfsAmt');
    if (!r || !box) return;
    o.amt = box.value;
    o.u = Number(($('mfsUnit') || {}).value) || 0;
    var st = mFsState(r), now = $('mfsNow'), go = $('mfsAdd');
    if (now) now.innerHTML = st.x ? mFsNutrHTML(r, st.x) : '<div class="mslot-empty">Type how much.</div>';
    if (go) go.disabled = !st.x;
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
        (o.onPlate === false ? '' :
          '<div class="mt-div">On your plate: ' + esc(mPortionText(r, x)) + '</div>' +
          '<div class="mk-tot">' + mMacLine(r, x) + '</div>' +
          '<div class="mfs-micro">' +
            '<span>&#127806; ' + (Math.round((mac.fib || 0) * x * 10) / 10) + ' g fibre</span>' +
            '<span>&#129474; ' + Math.round((mac.na || 0) * x).toLocaleString() + ' mg sodium</span>' +
          '</div>') +
        mFsAddHTML(r) +
      '</div></div>';
  }
  function mFsAddHTML(r) {
    var o = S.foodOpen, st = mFsState(r);
    var slots = mReadSlots().list;
    // the plate's own meal when it is still on the plan; otherwise, choose
    var own = !!o.slot && slots.some(function (sl) { return sl.k === o.slot; });
    var sk = own ? o.slot : (o.pick || (mNextMeal() || {}).k || '');
    return '<div class="mt-div">Add ' + (own ? 'more to ' + esc(mSlotName(o.slot)) : 'to a meal') + '</div>' +
      (own ? '' : '<div class="mp-meals mfs-meals">' + slots.map(function (sl) {
        return '<button data-mfsmeal="' + esc(sl.k) + '" aria-pressed="' + (sl.k === sk) + '">' + esc(sl.n) + '</button>';
      }).join('') + '</div>') +
      '<div class="mfs-amt">' +
        '<input id="mfsAmt" type="text" inputmode="decimal" autocomplete="off" aria-label="Amount" value="' +
          esc(String(st.amt)) + '">' +
        (st.units.length > 1
          ? '<select id="mfsUnit" aria-label="Unit">' + st.units.map(function (u, i) {
              return '<option value="' + i + '"' + (i === st.ui ? ' selected' : '') + '>' + esc(u.u) + '</option>';
            }).join('') + '</select>'
          : '<span class="mfs-u">' + esc(st.units[0].u) + '</span>') +
        '<button class="btn-primary" id="mfsAdd" data-mfsadd="' + esc(sk) + '"' + (st.x ? '' : ' disabled') + '>' +
          'Add to ' + esc(mSlotName(sk)) + '</button>' +
      '</div>' +
      '<div class="mfs-nutr" id="mfsNow">' + (st.x ? mFsNutrHTML(r, st.x) : '<div class="mslot-empty">Type how much.</div>') + '</div>';
  }

  function macroChartHTML() {
    var full = mcSeries(S.chartWhich);
    var rng = S.mcRange || 'all';
    var sr = mcInRange(full, rng);
    var body = full.need
      ? '<div class="mslot-empty">' + esc(full.need) + '</div>'
      : sr.v.length < 2
        ? '<div class="mslot-empty">Fewer than two mornings in this range. Pick a longer one.</div>'
        : mcChartSVG(sr);
    var why = full.need ? '' : esc(full.note) +
      (full.lim ? ' Limits ' + full.lim.lnpl.toFixed(1) + ' to ' + full.lim.unpl.toFixed(1) +
        ', from the first three weeks: a point outside them is a change rather than a Tuesday.' : '');
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
        (full.need ? '' : '<div class="mc-rng">' + MC_RANGES.map(function (r) {
          return '<button data-mcrng="' + r[0] + '" aria-pressed="' + (rng === r[0]) + '">' + r[1] + '</button>';
        }).join('') + mInfoBtn('mc-' + S.chartWhich, 'What this chart shows') + '</div>' +
          mInfoText('mc-' + S.chartWhich, why, 'mc-note')) +
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
         either side of a macro counts as landing on it; calories get
         MKCAL_OVER's six and a half per cent (it was three here once, and
         two before that), because ten calories is a rounding error rather
         than a tolerance.
       *
         Protein keeps its wider ceiling on top of that: it is the one macro
         a cut wants you to overshoot, so it holds on target to 110%. */
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
      /* Said the way it reads: "495 to go", "+36 over". The minus stayed in
         the "to go" branch, so a screen reader heard "-495 to go". The signed
         figure rides along as data-d for anything that wants the arithmetic. */
      var delta = '<span class="mb-d ' + sign(left[m]) + ' vis-hidden" data-d="' + left[m] + '"><b>' +
        (left[m] > 0 ? signed(left[m]) : Math.abs(left[m])) + '</b>' + (left[m] > 0 ? ' over' : ' to go') + '</span>';
      var open = '<div class="' + (m === 'kcal' ? 'mhead' : 'mbrow') + ' ' + state +
        '" data-macro="' + m + '" data-state="' + state +
        '" data-eaten="' + Math.round(wAte) + '" data-planned="' +
        Math.round(Math.min(100, 100 * plan / target)) + '">';
      /* One shape for all four now: the pill IS the row. The headline is the
         same pill at display size, which is what keeps calories the headline
         without making them a different kind of object. */
      /* Calories as a ring, the macros stacked beside it. Blake, choosing A
         from the mockup: "I like the macro pills the way they are right now.
         Just stack them on the side of the ring." The ring fills to the
         target in the same two bands the pill had — eaten solid, planned
         pale — and what goes past the target runs on as a thin second lap
         through the middle of the band, ending in a dot, so a day over is
         still read as a full ring plus how far past it went. */
      if (m === 'kcal') {
        var R = 50, CIRC = 2 * Math.PI * R;
        var over = Math.max(0, Math.min(1, plan / target - 1));
        var arcOf = function (cls, from, len, w) {
          /* Always drawn, empty or not: the two bands are the ring's parts,
             and an empty day is a ring with nothing on it yet. */
          return '<circle class="' + cls + '" cx="58" cy="58" r="' + R + '" fill="none" stroke-width="' + w +
            '" stroke-dasharray="' + (len * CIRC / 100).toFixed(1) + ' ' + CIRC.toFixed(1) +
            '" stroke-dashoffset="' + (-from * CIRC / 100).toFixed(1) + '" transform="rotate(-90 58 58)"/>';
        };
        var endA = over * 2 * Math.PI;
        var ring = '<svg class="mring" viewBox="0 0 116 116" aria-hidden="true">' +
          '<circle class="mring-track" cx="58" cy="58" r="' + R + '" fill="none" stroke-width="11"/>' +
          arcOf('mb-ate', 0, wAte, 11) + arcOf('mb-plan', wAte, wPlan, 11) +
          (over > 0 ? arcOf('mring-over', 0, over * 100, 3.5) +
            '<circle class="mring-dot" cx="' + (58 + R * Math.sin(endA)).toFixed(1) + '" cy="' +
            (58 - R * Math.cos(endA)).toFixed(1) + '" r="4"/>' : '') +
          '</svg>';
        /* Just the figure and its target in the middle — no "left" or
           "over". Worked out from what is on the day, it disagreed with the
           folded pill, which counts an empty meal at its share: "969 left"
           over a pill saying 0 (review, 2026-09-28). The ring's arc and its
           second lap already say which side of the target the day is. */
        barHTML[m] = open + ring + '<span class="mring-c">' + num + '</span>' +
          '<span class="vis-hidden">' + row[2] + '</span>' + delta + '</div>';
        return;
      }
      barHTML[m] = open + track +
        '<span class="vis-hidden">' + row[2] + '</span>' + delta + '</div>';
    });
    var bars = '<div class="mdash">' + barHTML.kcal + '<div class="mbars3">' +
      barHTML.p + barHTML.f + barHTML.c + '</div></div>';

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
    /* The week that day belongs to, now that weeks have dates — not whichever
       week the Plan tab happens to be showing. */
    window.Store.dayOf(window.Store.weekIdOf(keyDate(k)), wd).forEach(function (e) {
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
  /* `x` is what a tap on the row adds — what you had last time, or one
     serving — and `fitX`, when there is one, is what would fit this meal,
     offered beside it as a chip rather than as the row's own amount.
   *
     The row used to carry the fit, which is the solver's answer to "what
     would land this meal" and not what anybody eats: a tap logged 1⅜ eggs
     or 140 g of oats because that is where the arithmetic came out, and the
     portion you actually have every morning had to be dialled back in by
     hand every morning. Blake: "Default to what you had last time (else 1
     serving); 'fits the meal' becomes a one-tap chip beside it." */
  function mpRowHTML(r, x, fitText, fitX) {
    var inB = S.mpBasket[r.id] !== undefined;
    var inB2 = mIsFav(r);
    var own = x;
    if (inB) x = S.mpBasket[r.id];
    /* A food says its amount in the plate's own words. "×4 0.5 cup (113 g)"
       was the label's serving with a count in front of it — the two numbers
       side by side that mLabelServing exists to stop — while the plate it
       made read "2 cups · 452 g". */
    var fit = fitText !== undefined && fitText !== null ? fitText
      : (r.food ? esc(mPortionText(r, x)) : '&times;' + fmtNum(x)) + ' &middot; ' +
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
        mpFitChip(r, fitX, own) +
        (!mCanFav(r) ? '' :
          '<button class="mp-star" data-mpfav="' + esc(String(r.id)) + '" aria-pressed="' +
            (inB2 ? 'true' : 'false') + '" aria-label="' +
            (inB2 ? 'Remove from favorites' : 'Keep as a favorite') + '">&#9733;</button>') +
      '</span>' +
    '</div>';
  }

  /* The fitting amount as a chip. Nothing when it would say the same as the
     row, or when there is no plan to fit against. Pressed while the basket
     holds exactly that amount, and pressing it then takes it back out — the
     same bargain the row's own tap makes. */
  function mpFitChip(r, fitX, own) {
    if (!(fitX > 0) || Math.abs(fitX - (Number(own) || 0)) < 1e-6) return '';
    var inB = S.mpBasket[r.id] !== undefined && Math.abs(S.mpBasket[r.id] - fitX) < 1e-6;
    var said = mFitWords(r, fitX);
    return '<button class="mp-fitx" data-mpfit="' + esc(String(r.id)) + '" data-mpx="' + fitX +
      '" aria-pressed="' + (inB ? 'true' : 'false') + '" aria-label="' +
      (inB ? 'Take out the amount that fits, ' : 'Add the amount that fits this meal, ') +
      esc(mPortion(r, fitX).head) + '"><span>Fits: ' + esc(said) + '</span></button>';
  }

  /* The chip's amount, as short as it can be said: grams for what is
     weighed, and otherwise the same ×-count the row beside it uses — "Fits:
     2 ½ servings" pushed the dish's name onto three lines at a phone's
     width, for a word the row already says. */
  function mFitWords(r, x) {
    return mByGram(r) || mUnitWord(r) === 'g' ? mPortion(r, x).head : '\u00d7' + fmtNum(x).replace(' ', '');
  }

  /* What you logged last time, food by food, and what you reach for — one
     walk of the day log per list rather than one per row. Newest day first,
     and only days you have lived: a plan for Thursday is not "last time". */
  var MP_LASTX = {};
  function mpLastXs() {
    var out = {}, today = todayKey();
    Object.keys(MDAYS).sort().reverse().forEach(function (k) {
      if (k > today) return;
      var day = MDAYS[k] || {};
      Object.keys(day).forEach(function (sk) {
        (day[sk] || []).forEach(function (it) {
          if (out[it.id] === undefined && it.x > 0) out[it.id] = it.x;
        });
      });
    });
    return out;
  }
  function mDefaultX(r) {
    var v = r ? MP_LASTX[r.id] : 0;
    return v > 0 ? v : 1;
  }

  /* The portion that would fit the meal the sheet is filling, by the same
     solver the Fits best band ranks with. Null with no plan to fit against. */
  function mpFitX(r) {
    if (!S.macroPick || !r) return null;
    var k = mViewKey(), slot = null;
    mReadSlots().list.forEach(function (sl) { if (sl.k === S.macroPick.slot) slot = sl; });
    var e = mRank([r], mDay(k), mDayTargets(k), slot || { k: S.macroPick.slot, w: S.macroPick.w })[0];
    return e && e.score !== null ? e.x : null;
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
    return r.food ? searchScore(r.name, qs) >= 0 : !!matchRank(r, qs);
  }

  /* What you already reach for: starred, or on a plate in the last fortnight.
     Worked out once per list, not per row — see mpHomeBodyHTML. */
  var MP_KNOWN = {};
  function mpKnownIds() {
    var out = {}, today = todayKey();
    var from = new Date(); from.setDate(from.getDate() - 14);
    var fromK = dayKey(from);
    Object.keys(MDAYS).forEach(function (k) {
      if (k > today || k < fromK) return;
      var day = MDAYS[k] || {};
      Object.keys(day).forEach(function (sk) {
        (day[sk] || []).forEach(function (it) { out[it.id] = 1; });
      });
    });
    return out;
  }

  /* Where a typed word puts a row, lower first; -1 when it does not match.
   *
     Blake's order: "★ and recent foods ranked first, then exact, then
     word-starts" — then the rest, then the guesses. The guesses stay last
     even when starred: a typo hit is the app wondering what you meant, and a
     favourite it wondered its way to must not sit above the thing you
     actually typed. A recipe that only mentions the word in its ingredients
     or its section comes after every name. `coarse` drops the fine grades
     inside each band, for a list that has its own order (fit) to keep. */
  function mpHitRank(r, q, coarse) {
    var s = searchScore(r.name, q);
    if (s < 0) {
      if (r.food) return -1;
      var m = matchRank(r, q);
      return m === 2 ? 1500 : m === 1 ? 1600 : -1;
    }
    var typo = s >= 300, known = !!(MP_KNOWN[r.id] || mIsFav(r));
    if (coarse) s = Math.floor(s / 100) * 100;
    /* Three groups — what you reach for, everything else, the guesses — and
       inside the guesses your own come first too. */
    return (typo ? 1000 : known ? 0 : 500) + (typo && !known ? 100 : 0) + s;
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
    /* Every food the words find, ranked, and then the best six — not the
       first six in table order, which is how Eggplant came above the Eggs
       you had starred. */
    var hits = [];
    MFOODS.forEach(function (r, i) {
      if (shown[r.id] || !mpShelfOK(r)) return;
      var rk = mpHitRank(r, q);
      if (rk >= 0) hits.push({ r: r, rk: rk, i: i });
    });
    hits.sort(function (a, b) { return a.rk - b.rk || a.i - b.i; });
    var rows = hits.slice(0, 6).map(function (h) { return h.r; });
    if (!rows.length) return '';
    rows.forEach(function (r) { shown[r.id] = 1; });
    return '<div class="mt-div">Foods</div>' + rows.map(function (r) {
      return mpRowHTML(r, mDefaultX(r), undefined, mpFitX(r));
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
       appears. So the search's own order goes first, in its broad grades,
       then foods before dishes as the look-up box always had it, and fit
       only after that — which is still the order most of a grade is in. */
    var rows = ranked.map(function (e, i) {
      return { e: e, rk: mpHitRank(e.r, q, true), f: e.r.food ? 0 : 1, i: i };
    }).sort(function (a, b) {
      return a.rk - b.rk || a.f - b.f || a.i - b.i;
    }).map(function (h) { return h.e; }).slice(0, 12);
    if (!rows.length) return '';
    rows.forEach(function (e) { shown[e.r.id] = 1; });
    return '<div class="mt-div">Everything else</div>' + rows.map(function (e) {
      var r = e.r, x0 = mDefaultX(r);
      var xx = S.mpBasket[r.id] !== undefined ? S.mpBasket[r.id] : x0;
      return mpRowHTML(r, x0,
        '<span class="mp-src">' + (r.food ? 'Yours' : 'Recipe') + '</span> &times;' + fmtNum(xx) +
        (r.food ? ' ' + esc(r.unit) : '') + ' &middot; ' + mMacLine(r, xx, true),
        e.score !== null && e.score !== undefined ? e.x : null);
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
      /* Ranked by how well it fits, offered at what you have — the fit
         itself is the chip beside it. */
      return mpRowHTML(e.r, mDefaultX(e.r), undefined,
        e.score !== null && e.score !== undefined ? e.x : null);
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
    var take = function (it) {
      if (seen[it.id] || out.length >= 6) return;
      var r = BY_ID[it.id];
      if (!r) return;
      if (!mpMatches(r, mpQ())) return;
      seen[it.id] = 1;
      out.push({ r: r, x: it.x });
    };
    /* This meal first. Adding to dinner, it is what you had at dinner
       on the days behind you, newest first, and only then anything else you
       ate lately. Blake: "Recents per meal (dinner shows dinner foods)". The
       day being built is left out of that pass: what is on this meal already
       is in the bar at the foot of the sheet. */
    var slot = S.macroPick && S.macroPick.slot, viewK = mViewKey(), today = todayKey();
    if (slot) {
      keys.forEach(function (k) {
        if (k === viewK || k > today) return;
        ((MDAYS[k] || {})[slot] || []).forEach(take);
      });
    }
    keys.forEach(function (k) {
      var day = MDAYS[k] || {};
      Object.keys(day).forEach(function (sk) { (day[sk] || []).forEach(take); });
    });
    if (!out.length) return '';
    return '<div class="mt-div">Recent</div>' + out.map(function (e) {
      return mpRowHTML(e.r, MP_LASTX[e.r.id] || e.x, undefined, mpFitX(e.r));
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
        /* The fitting amount beside what is in the basket, while they
           differ: picked at what you had last time, one tap to what the meal
           has room for. */
        var fx = mpFitX(r);
        var fitB = fx > 0 && Math.abs(fx - x) > 1e-6
          ? '<button class="mp-fitx mpb-fit no-print" data-mpfit="' + esc(String(r.id)) +
            '" data-mpx="' + fx + '" aria-pressed="false" aria-label="Change to the amount that fits this meal, ' +
            esc(mPortion(r, fx).head) + '"><span>Fits: ' + esc(mFitWords(r, fx)) + '</span></button>'
          : '';
        return '<div class="mpb-row">' +
          '<span class="mpb-b">' +
            '<span class="mpb-n">' + esc(r.name) + '</span>' +
            '<span class="mpb-m">' + mMacLine(r, x) + '</span>' + fitB +
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
     than from a meal: the first one not finished — starting, today, at the
     meal whose time it is. It started at the top of the day and was said to
     need no clock, and "Add food" at six in the evening on a day with
     nothing on it opened "Add to Breakfast". The meal whose time it is is
     the latest to have opened (mSlotOpens); from there the walk goes on to
     the end of the day and comes round to the first unfinished, as it was. */
  function mNextMeal() {
    var vk = mViewKey(), day = mDay(vk), slots = mReadSlots(), list = slots.list, pick = null;
    var from = 0;
    if (vk === todayKey()) {
      var now = mNowMins(), best = -1;
      list.forEach(function (sl, i) {
        var at = mSlotOpens(list, i);
        if (at <= now && at > best) { best = at; from = i; }
      });
    }
    var open = function (sl) {
      var items = day[sl.k] || [];
      return !items.length || !items.every(function (it) { return it.eaten; });
    };
    list.slice(from).concat(list.slice(0, from)).forEach(function (sl) {
      if (!pick && open(sl)) pick = sl;
    });
    return pick || list[list.length - 1];
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

  function mComboSlotName() {
    var slots = mReadSlots(), sk = S.macroPick && S.macroPick.slot;
    var nm = slots.names[sk] || 'this meal';
    slots.list.forEach(function (sl) { if (sl.k === sk) nm = sl.n; });
    return nm;
  }

  function mComboGap(k) {
    var targets = mDayTargets(k);
    if (!targets.p && !targets.f && !targets.c) return null;
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
    var x0 = mDefaultX(r);
    return '<div class="mt-div">Recipe no. ' + esc(String(kind.v)) + '</div>' +
      mpRowHTML(r, x0, e && e.score === null ? 'no data'
        : '&times;' + fmtNum(x0) + ' &middot; ' + mMacLine(r, x0, true) + mSaltNote(r, x0),
        e && e.score !== null ? e.x : null);
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
    MP_KNOWN = mpKnownIds();
    MP_LASTX = mpLastXs();
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

  /* The line under each goal card. "Lose weight steadily — About 1 lb a
     week" sat over an answer working the same goal out as "about 1.4 lb a
     week off" for a 190 lb man: the goals are a share of what you weigh
     (MGOALS), and the card said a figure for nobody. So it says yours,
     rounded the way the answer rounds it, and the plain words only until
     there is a weight to take a share of. */
  var MGOAL_SAY = {
    cut2: ['About 1&frac12; lb a week.', ' Hard to keep up for long.'],
    cut1: ['About 1 lb a week.', ' The pace most people finish.'],
    keep: ['Eat what you burn.', ''],
    gain: ['About &frac12; lb a week.', '']
  };
  function mtGoalWhat(val, pr) {
    var say = MGOAL_SAY[val], rate = (MGOALS[val] || {}).rate;
    if (!say) return '';
    if (!rate || !(pr && pr.lb > 0)) return say[0] + say[1];
    return 'About ' + Math.round(Math.abs(rate) * pr.lb * 10) / 10 + ' lb a week.' + say[1];
  }

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
      // written as step one writes it, so the two read as the one number they are
      return 'Below your ' + Math.round(bmr).toLocaleString() + ' kcal at rest.';
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
    var away = mSyncAway();
    var word = { off: 'On this device only', connecting: 'Connecting\u2026',
      on: 'Synced', error: 'Cannot reach the server' }[S_SYNC_STATE];
    var body;
    if (waiting) {
      body = '<p class="sync-p">Finding your account&hellip;</p>';
    } else if (away) {
      body = '<p class="sync-p">Signed in, but this phone can&rsquo;t reach the server. ' +
        'What you log is kept here and goes to your account when there&rsquo;s signal.</p>' +
        '<div class="sync-row"><button class="ghost" data-mysync="retry">Try again</button></div>';
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
      (who || waiting || away
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
  /* Foundation foods — the USDA's newest, most carefully measured set —
     often give no plain "Energy" at all, only "Energy (Atwater General
     Factors)" and "Energy (Atwater Specific Factors)", and read by the plain
     name alone they listed at 0 kcal. The plain figure wins where there is
     one, then the specific factors, then the general. The stored food is
     worked out from its macros on save either way; this is what the list
     shows before then. */
  function mNutrients(list) {
    var out = { kcal: 0, p: 0, f: 0, c: 0 }, kc = {};
    (list || []).forEach(function (n) {
      var name = n.nutrientName || (n.nutrient && n.nutrient.name) || '';
      var unit = (n.unitName || (n.nutrient && n.nutrient.unitName) || '').toUpperCase();
      var v = n.value === undefined ? n.amount : n.value;
      if (typeof v !== 'number') return;
      if (unit === 'KCAL' && /^Energy\b/.test(name)) {
        kc[/Specific/.test(name) ? 'spec' : /General/.test(name) ? 'gen' : 'plain'] = v;
      }
      else if (name === 'Protein') out.p = v;
      else if (name === 'Total lipid (fat)') out.f = v;
      else if (name === 'Carbohydrate, by difference') out.c = v;
    });
    out.kcal = kc.plain !== undefined ? kc.plain : kc.spec !== undefined ? kc.spec : kc.gen || 0;
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
      /* One basis for all four figures. Each used to fall back on its own —
         per serving where the packet gave one, per 100 g where it did not —
         and the label was chosen from the energy alone, so a product listing
         calories per serving and protein only per 100 g arrived as one row
         mixing the two under "per serving". Per serving only when every
         figure the packet gives has a serving value; otherwise all of them
         per 100 g, which is the one basis Open Food Facts always fills. */
      var has = function (k, b) { return typeof nu[k + '_' + b] === 'number'; };
      var serving = has('energy-kcal', 'serving') &&
        ['proteins', 'fat', 'carbohydrates'].every(function (k) {
          return has(k, 'serving') || !has(k, '100g');
        });
      var per = function (k) { return { v: nu[k + (serving ? '_serving' : '_100g')], serving: serving }; };
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

  /* What a failed lookup says, in one place. It was written out three times
     — the picker's search, the barcode scan and the new-food form — and the
     copies had drifted: the scan called every failure "not in Open Food
     Facts", including no signal at all, which sent people to type in a
     product the database did have. `code` is the barcode, when there is one. */
  function mLookSay(err, code) {
    var why = err && err.message;
    if (why === 'nokey') return 'No USDA key in src/config.js, so only barcodes can be looked up.';
    if (why === 'toofast') return (code ? 'Open Food Facts is asking us to slow down.' : 'Asked too often just now.') +
      ' Wait a minute, or type it in below.';
    if (why === 'nonutrition') return (code ? code + ' is in Open Food Facts, but' : 'That one is known, but') +
      ' with no nutrition table yet. Read it off the packet below.';
    if (why === 'none') return (code || 'That') + ' is not in Open Food Facts. Type what it was below.';
    return (code ? 'Open Food Facts' : 'The food tables') + ' did not answer. Type it in below, or try again.';
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
      $('nfResults').innerHTML = '<div class="mslot-empty">' + esc(mLookSay(err)) + '</div>' +
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
  /* Which opening of the lens is the current one, and whether this visit to
     scan has already got its answer.
   *
     The camera is asked for and arrives later — after a permission prompt,
     on a phone, seconds later. Everything that stops it in the meantime used
     to find nothing to stop, because mCam is only set once the stream is in
     hand, and the stream then arrived anyway and ran: on a video element
     already torn out of the page, with a frame loop behind it and the light
     on, until the app was closed. Typing the barcode did it every time
     (drawing scan mode opened the lens, and the typed number stopped it
     before permission came back), and so did leaving scan before answering
     the prompt. Each opening now carries a generation, every stop moves it
     on, and a stream that arrives for a generation that has passed is
     stopped the moment it lands.
   *
     And a scan that has found its barcode is finished. The sheet is drawn
     once in scan mode and left, but only while the video was in it — the
     scan removes the video, so the next redraw from anywhere (a sync
     arriving, a save elsewhere) drew the sheet again, wiped the result being
     read, and opened the lens a second time over the top of any stream
     still live. */
  var mCamGen = 0, mCamDone = false;

  function mScanStop() {
    mCamGen++;
    if (mCam && mCam.stream) mCam.stream.getTracks().forEach(function (t) { t.stop(); });
    if (mCam && mCam.raf) cancelAnimationFrame(mCam.raf);
    mCam = null;
    var el = $('scanRoot');
    if (el) el.innerHTML = '';
  }

  function mScanStart() {
    var root = $('scanRoot');
    if (!root) return;                  // the sheet moved on before we got here
    mScanStop();                        // one lens at a time, never a second over the first
    mCamDone = false;
    var gen = mCamGen;
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
      // asked for by an opening that has since been stopped: let go at once
      if (gen !== mCamGen || !document.body.contains(vid)) {
        stream.getTracks().forEach(function (t) { t.stop(); });
        return;
      }
      mCam = { stream: stream, raf: 0, gen: gen };
      vid.srcObject = stream;
      vid.play();
      var tick = function () {
        if (!mCam || mCam.gen !== gen) return;
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
    mCamDone = true;
    mScanStop();
    if ($('nfFind')) $('nfFind').value = code;
    var res = $('nfResults');
    if (res) res.innerHTML = '<div class="mslot-empty">Looking up ' + esc(code) + '&hellip;</div>';
    MLOOKUP = {};
    // the same rule as the food tables: a slow answer to an older question is dropped
    var mine = ++mLookSeq;
    mBarcodeLookup(String(code).replace(/\D/g, '')).then(function (list) {
      if (mine !== mLookSeq) return;
      if ($('nfResults')) $('nfResults').innerHTML = mLookupRows(list);
    }, function (err) {
      if (mine !== mLookSeq) return;
      if ($('nfResults')) {
        $('nfResults').innerHTML = '<div class="mslot-empty">' + esc(mLookSay(err, String(code))) + '</div>';
      }
    });
  }

  function mNewFoodHTML() {
    /* Arriving with the numbers already known — off a barcode or a food
       table — or arriving empty, which is the same form either way. */
    var pre = (S.newFood && S.newFood.pre) || null;
    /* The words on the left are the box's label, for= and all, so the
       numbers are read out as Calories and Protein rather than as four
       unnamed boxes; a tap on the word puts the caret in the box too. */
    var box = function (id, label, unit, ph, v) {
      return '<div class="mtl-row"><label class="mtl-lab" for="' + id + '">' + label + '</label>' +
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

  function mTrainNSay(n) {
    var b = mBlockN();
    /* Only claim "one for each session" when it is true. A new block with
       more or fewer sessions than the days already picked says so, and says
       where to fix it. */
    if (b && n !== b) {
      return (n ? n + ' a week' : 'None picked') + ' \u00b7 your block has ' + b +
        (b === 1 ? ' session' : ' sessions') + ', so pick ' + b;
    }
    return (n ? n + ' a week' : 'None picked') + (b ? ' \u00b7 one for each session of your block' : ' \u00b7 the same days as Strengthen');
  }
  function mBlockN() {
    try { return window.Train && window.Train.blockSessions ? window.Train.blockSessions() : 0; } catch (e) { return 0; }
  }
  /* The one place the lifting days are written: Strengthen's store, which
     the account carries, or the profile when Strengthen is not loaded. */
  function mSetTrainDays(days) {
    days = days.slice().sort(function (a, b) { return a - b; });
    var pr = mReadProfile();
    try { if (window.Train && window.Train.setLiftDays) window.Train.setLiftDays(days); } catch (e) { /* Strengthen is not up */ }
    /* The profile's copy too, even with Strengthen holding the list: it is
       what stands in once the list is empty, and a stale one brought back
       every day you had just cleared. */
    pr.train = days;
    pr.workouts = days.length;
    mWriteProfile(pr);
    mDaysChanged();
  }
  /* The plan's own grams are worked out from how many sessions a week you
     lift — mBurn counts them — so a change of lifting days is a change of
     plan. It was not treated as one: days picked in Strengthen after the plan
     was made moved the profile's count and nothing else, and the plan went on
     being the one made for no training at all. Blake's newcomer, Maintain,
     three days picked second: 2,219 kcal and 234 g carbs every day, where the
     same three days picked first gave 2,379 and 334 on a lifting day. The
     plan sheet said "3 sessions a week" over numbers made for none.
   *
     Only the plan's own grams (auto). Numbers somebody typed into the boxes
     are theirs, and the days change which of their days are lifting days
     without touching what they typed. */
  function mDaysChanged() {
    var rec = mTargRec();
    if (!rec || rec.auto === 0) return false;
    var fresh = mPlanCalc(mReadProfile());
    if (!fresh) return false;
    if (Number(rec.p) === fresh.p && Number(rec.f) === fresh.f && Number(rec.c) === fresh.c) return false;
    mWriteTargets(Object.assign({}, rec, { p: fresh.p, f: fresh.f, c: fresh.c }));
    return true;
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
    var title = mLongDate(k);
    var dk = s.got - s.want;

    /* One clause about the thing that actually went wrong, in the order a
       person notices it: did you eat the day, then did you get the protein. */
    var says;
    /* Today with dinner still to come is not a day that went anywhere yet:
       what is left is the news, and only over — already true, whatever comes
       next — keeps its warning. See mDayJudged. */
    var open = !mDayJudged(k);
    var pLeft = s.rows[0].want - s.rows[0].got;
    var toGo = open && s.any && mVerdict('kcal', s.got, s.want) !== 'over' && s.got < s.want;
    if (open && !s.any) {
      says = 'Nothing written down yet.';
    } else if (toGo) {
      says = '<b>' + (s.want - s.got).toLocaleString() + ' kcal to go</b>' +
        (pLeft > 0 ? ' and <b>' + pLeft + ' g protein to go</b>.' : ', with the protein already in.');
    } else if (open && pLeft > 20 && dk > s.want * 0.12) {
      says = 'Over by <b>' + Math.abs(dk) + '</b> already, with <b>' + pLeft + ' g protein to go</b>.';
    } else if (!s.any) {
      says = 'Nothing was written down on this day.';
    } else if (s.thin && !open) {
      says = 'Only <b>' + s.got.toLocaleString() + '</b> written down. Either a very light day ' +
        'or one that stopped being logged — this cannot tell those apart, and does not guess.';
    } else if (dk > s.want * 0.12 && s.rows[0].got - s.rows[0].want < -20) {
      says = 'Over by <b>' + Math.abs(dk) + '</b> and <b>' +
        Math.abs(s.rows[0].got - s.rows[0].want) + ' g short on protein</b>. ' +
        'The calories went somewhere that was not protein.';
    } else if (dk > s.want * 0.12) {
      says = '<b>' + Math.abs(dk) + ' over</b>, with the protein where it should be.';
    } else if (s.rows[0].got - s.rows[0].want < -20) {
      says = open ? 'The calories are in, with <b>' + pLeft + ' g protein to go</b>.'
        : 'Calories landed, but <b>' + Math.abs(s.rows[0].got - s.rows[0].want) +
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
      /* Nor is today's protein a miss while there is a dinner to come. */
      var c = w.hit === null ? '' : w.hit ? (w.today ? ' today' : ' hit') : (w.today && open ? '' : ' miss');
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

    /* The palette's own four (--split-a to -d in src/style.css), so a dark
       screen can repaint them and each is deep enough to carry the paper
       share written on it — the first two used to be too light to. */
    var COL = ['var(--split-a)', 'var(--split-b)', 'var(--split-c)', 'var(--split-d)'];
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
          '<div class="sheet-eyebrow">' + (open ? 'How the day is going' : 'How the day went') + '</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="ds-day">' + esc(title) + '</div>' +
        '<p class="ds-says">' + says + '</p>' +
        (s.any
          ? '<div class="ds-hero">' + ring +
              (toGo
                ? '<div class="ds-side"><div class="ds-d togo">' + (s.want - s.got).toLocaleString() + '</div>' +
                  '<div class="ds-sub">calories to go</div>' + pips
                : '<div class="ds-side"><div class="ds-d ' +
                  mVerdict('kcal', s.got, s.want) + '">' +
                  (dk > 0 ? '+' : '') + dk + '</div>' +
                  '<div class="ds-sub">calories against target</div>' + pips) +
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
    /* And the left half NAMES the right. The label was a bare span, so a
       screen reader reached the weight box and said "edit text, 180" with no
       word of what the number was. Not a <label for>, because one row can
       hold two boxes (feet and inches) or a group of buttons: every control
       the row holds is labelled by the row's words, and a box that carries a
       unit by the unit as well — "Height ft", "Height in". The controls are
       built before the row that holds them, so they say {{lab}} and the row
       fills it in with its own id. */
    var rowN = 0;
    var row = function (label, valueHTML, stack) {
      var lid = 'mtlL' + (++rowN);
      return '<div class="mtl-row' + (stack ? ' stack' : '') + '">' +
        '<span class="mtl-lab" id="' + lid + '">' + label + '</span>' +
        '<span class="mtl-val">' + valueHTML.replace(/\{\{lab\}\}/g, lid) + '</span></div>';
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
      return '<input type="number" id="' + id + '" min="0" max="999" step="1" inputmode="numeric" ' +
        'aria-labelledby="{{lab}}' + (unit ? ' ' + id + 'U' : '') + '" value="' +
        (blank ? '' : (v || v === 0 ? v : '')) + '">' + (unit ? '<span class="mtl-u" id="' + id + 'U">' + unit + '</span>' : '');
    };
    var seg = function (attr, val, opts, off) {
      return '<span class="seg mt-seg" role="group" aria-labelledby="{{lab}}">' + opts.map(function (o) {
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
      /* One list of lifting days, the same one Strengthen's block shows, and
         the sessions a week are simply how many of them there are. Blake: "why
         do i have to play matching games. why not centralize the selection?"
         There used to be a count here and a set of days under it, and a third
         copy on the block. */
      (mCanSync() ? row('Sync with Strengthen',
        '<span class="seg mt-seg" role="group" aria-labelledby="{{lab}}">' + [[1, 'On'], [0, 'Off']].map(function (o) {
          var on = (pr.syncTrain === false ? 0 : 1) === o[0];
          return '<button type="button" data-mtsync="' + o[0] + '" aria-pressed="' + on + '">' + o[1] + '</button>';
        }).join('') + '</span>' +
        '<span class="mt-ld-s">' + (pr.syncTrain === false ? 'You set each day yourself'
          : 'Your plan and logged workouts set each day') + '</span>', true) : '') +
      row('Training days', (mBlockN()
          /* A block running: its days are set on the block, where the count
             is held to its sessions. Shown here, changed there, one tap. */
          ? '<span class="mt-ld">' + mTrainDays().map(function (i) { return '<i>' + M_WDAY[i] + '</i>'; }).join('') + '</span>' +
            '<button type="button" class="mt-ld-go" data-mgotrain="1">Change days</button>'
          : mTrainRowHTML()) +
        '<input type="hidden" id="mtWorkouts" value="' + (mTrainDays().length || Number(pr.workouts) || 0) + '">' +
        '<span class="mt-ld-s" id="mtTrainN">' + mTrainNSay(mTrainDays().length) + '</span>', true) +
      row('Steps a day <span class="mtl-opt">(optional)</span>',
        '<input type="number" id="mtSteps" min="0" max="99999" step="500" ' +
        'inputmode="numeric" aria-labelledby="{{lab}}" value="' + (pr.steps || '') + '">');
    var rowDays = '';
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
        goalPick('cut2', MGOAL_WORDS.cut2, mtGoalWhat('cut2', pr)) +
        goalPick('cut1', MGOAL_WORDS.cut1, mtGoalWhat('cut1', pr)) +
        goalPick('keep', MGOAL_WORDS.keep, mtGoalWhat('keep', pr)) +
        goalPick('gain', MGOAL_WORDS.gain, mtGoalWhat('gain', pr)) +
        '<button class="ghost mt-byfeel" data-mtfree="1">A weight and a date are setting your pace &mdash; ' +
          'choose one of these instead</button>' +
      '</div>';
    var goalPaceHTML =
      row('What weight would you like to reach?', box('mtGoalLb', pr.goalLb, 'lb')) +
      row('When would you like to get there?',
        '<input type="date" id="mtGoalBy" aria-labelledby="{{lab}}" value="' + esc(pr.goalBy || '') + '">') +
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
      row('Should Nourish only suggest your staples?',
        seg('mtext', pr.extFill ? '1' : '0', [['0', 'Yes'], ['1', 'No']]));

    /* How much protein, as three words rather than a number to type. It sits
       under the tiles it moves, on the answer rather than in the editor,
       because it is the one question here whose answer you can see change:
       press Very high and the carbohydrate tile gives the grams back. The
       line under it says what the grams are counted against, since "1 g a
       pound" of a goal weight and of today's weight are different days. */
    var rowProt =
      '<div class="mt-prot">' +
        row('Protein level', seg('mtprot', mProtLevel(pr), MPROT_WORDS), true) +
        '<div class="mt-cap" id="mtProtWhy">' + mtProtSay(pr) + '</div>' +
      '</div>';

    /* The boxes are the plan's one rendering: they follow the profile, take a
       hand edit, and Save keeps whatever they say. */
    var qGrams =
      '<div class="mt-cap" id="mtPlan">' + mtPlanLine(plan) + '</div>' +
      row('Protein', box('mtP', t.p, 'g')) +
      row('Fat', box('mtF', t.f, 'g')) +
      row('Carbs', box('mtC', t.c, 'g')) +
      '<div class="mtl-row mtl-sum"><span class="mtl-lab">That is a day of</span>' +
        '<span class="mtl-val" id="mtKcal">' + (kcalOf(t) ? '= ' + kcalOf(t) + ' kcal' : '—') + '</span></div>' +
      // why Save kept nothing, when it keeps nothing (mtRefusal)
      '<div class="mt-cap" id="mtRefuse" role="alert"></div>';

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
        '<div class="mt-div m-divi">Kind and share' + mInfoBtn('meals', 'What kind and share mean') + '</div>' +
        mInfoText('meals', 'The kind steers the picker; the share is each meal&rsquo;s slice of the day.', 'mt-cap') +
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
      var wMove = rowsMove;
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
            answerHTML + rowProt + mealHeadFor(false) + mealsFor(false) +
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
      answerHTML + rowProt +
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
       steps, called the same idea 2,135. One figure, said once, both times.
     *
       And "at rest" is the basal rate, everywhere. This said 2,135 at rest
       while the plan step, under the same words, warned about going below
       1779 — two numbers for one phrase, a sheet apart. So rest is the basal
       rate, and bmr × 1.2 goes by what it is: the day sitting still, which
       step two breaks out under that name. */
    return mtwOut(b.bmr, 'kcal at rest &middot; ' + Math.round(b.bmr * 1.2).toLocaleString() +
      ' sitting still', 'What your body spends before you move.');
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
    /* "Moving about", not "walking about": the middle part is the job or the
       steps, whichever says more (see mBurn), and an active job is not a walk. */
    return mtwOut(b.tdee, 'kcal a day', 'Everything else works from this: eat under it and you lose.') +
      (b.told
        ? '<div class="mtw-parts">' + part(b.base, 'sitting still') +
          part(b.steps, 'moving about') + part(b.train, 'exercising') + '</div>'
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
    var protBtn = document.querySelector('[data-mtprot][aria-pressed="true"]');
    out.prot = protBtn ? protBtn.dataset.mtprot : mProtLevel(stored);
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
  /* What the protein grams are counted against, in one line under the
     level. Says so when the level's own ceiling held it, and when the plan
     eased it to keep a squeezed cut's carbohydrate — the tile above is the
     plan's figure, and a caption quoting a different one would be two
     answers on one screen. */
  function mtProtSay(pr) {
    if (!pr || !(Number(pr.lb) > 0)) return '';
    var L = MPROT_LEVELS[mProtLevel(pr)];
    var ref = mProtRefLb(pr);
    var what = Number(pr.bf) > 0 ? 'lean mass' : Number(pr.goalLb) > 0 ? 'goal weight' : 'weight';
    var g = mProtGrams(pr);
    var plan = mPlanCalc(pr);
    /* No gram figure of its own: the tile above says it, and a stored plan
       made at last week's weight would have the two disagreeing by a gram. */
    var said = String(L.per) + ' g a pound of your ' + what + ' (' + Math.round(ref) + ' lb)';
    if (L.per * ref > L.cap * pr.lb + 0.5) {
      said += ', held to ' + String(L.cap) + ' g a pound of what you weigh';
    }
    if (plan && plan.p < g) said += '; eased to ' + plan.p + ' g to leave room for carbs';
    return said + '.';
  }

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
    var eating = f.need !== null && cur > 0 && Math.abs(cur - f.need) <= MLINE_NEAR;
    var goalD = f.goalWord;
    if (!f.arriveD && f.slow) {
      return '<b>\u25CE No arrival date yet.</b> You\u2019re ' + (f.plan.per < 0 ? 'down' : 'up') +
        ' about ' + f.slow + ' lb a week these three weeks, too slow to date.';
    }
    if (!f.arriveD) {
      return '<b>\u25CE No arrival date yet.</b> Your weight\u2019s been ' +
        (f.rate3 !== null && Math.abs(f.rate3) >= 0.15 ? (f.rate3 > 0 ? 'going up' : 'going down') : 'flat') +
        ' these three weeks.';
    }
    if (f.lateDays > 6) {
      var speeds = f.need !== null && cur > 0 &&
        (f.plan.per < 0 ? f.need < cur - MLINE_NEAR : f.need > cur + MLINE_NEAR);
      return '<b>\u25B2 Arriving around ' + f.arrive + ', not ' + goalD + '.</b>' +
        (eating ? (f.capped ? ' This target is already as ' + (f.capHigh ? 'much as your body can put to use.'
          : 'low as it\u2019s safe to go.') : ' This target brings it back.')
          : speeds ? (f.capped ? ' The lowest it\u2019s safe to go is ' + fmt(f.need) + '.'
            : ' ' + fmt(f.need) + ' a day brings it back to ' + goalD + '.') : '');
    }
    if (f.lateDays < -6) {
      var slows = f.need !== null && cur > 0 &&
        (f.plan.per < 0 ? f.need > cur + MLINE_NEAR : f.need < cur - MLINE_NEAR);
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
        ? ' &middot; ' + kc(b.base) + ' living, ' + kc(b.steps) + ' moving about, ' + kc(b.train) + ' training'
        : ' &mdash; fill in steps and sessions to see the parts') +
      '</span></div>');

    var pj = mProject(pr);
    if (b.told && pj) {
      var kg = pr.lb * 0.45359237;
      /* What 2,000 more steps would do to the burn mBurn works out, rather
         than a price per step of its own: on your feet all day, the job is
         already the bigger guess at how much you move, and steps under it
         buy nothing — so the lever must not promise food the box would not
         give. At a desk this is the same 2,000 steps it always was. */
      var stepK = mBurn(Object.assign({}, pr,
        { steps: Math.max(Number(pr.steps) || 0, MSTEP_BASE) + 2000 })).tdee - b.tdee;
      var sessK = (5 * 3.5 * kg / 200) * 45 / 7;
      var says = function (label, lev) {
        return '<div class="mco-row"><span class="mco-k">' + label + '</span><span class="mco-v">' +
          '<b>+' + lev.kcal + ' kcal</b> a day at the same pace' +
          (lev.weeks && lev.weeks > 0.15
            ? ', or ' + mWeeksWords(lev.weeks) + ' sooner on the same food'
            : '') + '</span></div>';
      };
      if (stepK >= 1) out.push(says('2,000 more steps', mLever(pr, stepK)));
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
    // a refusal is about the grams it refused; new grams are a new question
    set('mtRefuse', '');
  }

  /* Why Save will not keep these grams, or '' when it will.
   *
     Hand-typed grams used to be saved and then replaced in silence: P 400 /
     F 10 / C 0 read "= 1690 kcal" under the boxes, Save closed the sheet, and
     the day came up 190 / 57 / 93 — the read-time heal had decided the day
     could not be eaten and served the plan instead. Zeros saved as zeros and
     the day showed the plan's 1,569. The heal was right that Nourish cannot
     plan those days; it was wrong to say so by changing the numbers. So the
     same tests are asked here, before anything is written, and the answer is
     a line under the total: what is wrong, and the least Nourish can plan.
   *
     The tests are the heal's — no calories at all, calories under mFloorK,
     or carbohydrate under MCARB_EAT of the day — and like the heal they need
     a profile to mean anything: without one there is no plan to serve in
     their place, and three zeros are simply what "no plan yet" is (a first
     run finished without an answer saves exactly that). The plan's own
     grams always pass: they are what the heal would serve anyway. */
  function mtRefusal(t, pr, mine) {
    if (!mine || mTdee(pr) === null) return '';
    var kc = kcalOf(t), least = mFloorK(pr);
    var tail = ' The least Nourish can plan for you is ' + least.toLocaleString() + ' kcal.';
    if (!kc) return 'Those grams come to no calories, so there is no day to save.' + tail;
    if (kc < least) return 'That is a day of ' + kc.toLocaleString() + ' kcal.' + tail;
    if (4 * t.c < MCARB_EAT * kc) {
      return 'That leaves no room for carbs: a day of ' + kc.toLocaleString() + ' kcal needs ' +
        Math.ceil(MCARB_EAT * kc / 4) + ' g or more.' + tail;
    }
    return '';
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
    /* The protein level sits on the answer, outside both folds, so a press
       there has to bring Save with it or the choice could not be kept. */
    var moved = !!document.querySelector('.mt-prot[data-moved]');
    sv.classList.toggle('hide', !(open('mtEditor') || open('mtMealsWrap') || moved));
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
    var pw = $('mtProtWhy');
    if (pw) pw.innerHTML = mtProtSay(prNow);
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
      /* and each card's pounds a week, which follow the weight being typed */
      Array.prototype.forEach.call(gs.querySelectorAll('[data-mtgoal]'), function (b2) {
        b2.disabled = dated;
        var gw = b2.querySelector('span');
        if (gw) gw.innerHTML = mtGoalWhat(b2.dataset.mtgoal, prNow);
      });
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

      /* The side first, and the day settled around it, THEN the question of
         what is missing. Asked the other way round, the topper judged a day
         that was about to change: the vegetables add their carbohydrate, the
         balance takes it back out of the dishes, and the protein went with it
         — 164 g when the topper looked, 147 once the plates were settled,
         with nothing left to notice. */
      if (mSideUp(day, targets, near)) mBalanceDay(day, targets, true);
      if (mTopUp(day, targets, near)) mBalanceDay(day, targets, true);
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
  /* A day can land on its calories and still leave the protein behind. The
     gap above is counted in calories, and when the dishes brought their fat
     and carbohydrate but not enough protein there are no calories left to
     count: one drafted day in twenty came in under 88% of its protein — the
     worst at 73% — with the calorie line sitting right on target, and the
     topper never asked. So a protein shortfall this deep earns a topper on
     its own. The fit then picks it against the protein alone, which is lean
     food (cottage cheese, chicken, egg whites, whey), and the balance that
     follows trims Fill's own plates to make the calories room for it. */
  var MTOP_P_SHORT = 0.10;    // protein this far under the day's target
  var MTOP_P_DENSE = 0.30;    // share of its calories a protein topper carries as protein
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

  /* Every meal a topper could go on, the emptiest first. */
  function mTopSlots(day, targets) {
    var list = mReadSlots().list, sumW = 0, cand = [];
    var dayKcal = 4 * targets.p + 4 * targets.c + 9 * targets.f;
    list.forEach(function (s) { sumW += mSlotW(s); });
    if (!sumW) return [];
    list.forEach(function (s) {
      var items = day[s.k] || [], open = false, have = 0;
      items.forEach(function (it) {
        var r = BY_ID[it.id];
        if (!it.eaten) open = true;
        if (r && r.macro) have += (r.macro.kcal || 0) * it.x;
      });
      // a meal with nothing on it is Fill's job; a tick or a lock closes one
      if (!items.length || !open || mSlotClosed(day, s.k)) return;
      cand.push({ s: s, gap: dayKcal * (mSlotW(s) / sumW) - have });
    });
    // a stable sort: equal gaps keep the meals' own order, as before
    return cand.map(function (o, i) { o.i = i; return o; })
      .sort(function (a, b) { return b.gap - a.gap || a.i - b.i; })
      .map(function (o) { return o.s; });
  }

  function mTopUp(day, targets, near) {
    var added = 0;
    for (var n = 0; n < MTOP_MAX; n++) {
      var tot = mTotals(day), R = {}, D = {};
      ['p', 'f', 'c'].forEach(function (m) {
        R[m] = Math.max(0, targets[m] - tot.all[m]);
        D[m] = Math.max(1, targets[m]);
      });
      var pShort = R.p >= MTOP_P_SHORT * D.p;
      if (4 * R.p + 4 * R.c + 9 * R.f < MTOP_GAP && !pShort) return added;
      /* Why it is there: the gap it was closing, the largest of the three in
         calories. Said on the plate ("Added for protein"). */
      var gapK = { p: 4 * R.p, f: 9 * R.f, c: 4 * R.c };
      var why = ['p', 'f', 'c'].reduce(function (a, m) { return gapK[m] > gapK[a] ? m : a; }, 'p');
      var slots = mTopSlots(day, targets), slot = null, best = null;
      var naRoom = Math.min(MTOP_NA, Math.max(0, MNA_CAP - (tot.all.na || 0)));
      /* The emptiest meal first, and the next when that one has nothing
         that answers: a breakfast whose protein foods are all on the day
         already should not stop a protein topper from landing on lunch. */
      for (var si = 0; si < slots.length && !best; si++) {
        slot = slots[si];
        best = mTopPick(day, slot, R, D, near, naRoom, why);
      }
      if (!best) return added;
      (day[slot.k] = day[slot.k] || []).push({ id: best.r.id, x: best.x, eaten: 0, by: 'f', why: why });
      added++;
    }
    return added;
  }

  /* The best single food for one meal's topper, or null. */
  function mTopPick(day, slot, R, D, near, naRoom, why) {
      var best = null;
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
        /* Added for protein means it brings protein. With only protein left
           to close and the carbohydrate and fat already spent, the fit could
           find nothing that helped and took the least harm instead — half a
           spoon of sugar, an orange — and labelled it "Added for protein". A
           third of its calories as protein, at least: cottage cheese, yogurt,
           egg whites, whey and chicken clear it, fruit and sugar do not. */
        if (why === 'p' && 4 * (mac.p || 0) < MTOP_P_DENSE * (mac.kcal || 0)) return;
        if (mNever(r.id)) return;
        if (mOnDay(day, r.id) || (near && near[r.id])) return;
        var fit = macroFit(r, R, R, D);
        // priced at the portion actually being added, not per hundred grams
        if ((mac.na || 0) * fit.x > naRoom) return;
        var sc = fit.score + mSaltFibre(r, fit.x);
        if (!best || sc > best.score) best = { r: r, x: fit.x, score: sc };
      });
      return best;
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
    var out = ['Nourish \u2014 ' + mLongDate(k) + ' ' + d.getFullYear()];
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
    /* Only the word under the icon changes, and back: the drawing stays
       where it is so the bar does not jump. */
    var w = btn.querySelector('.mday-w') || btn;
    var was = btn.getAttribute('data-was') || w.textContent;
    if (!btn.getAttribute('data-was')) btn.setAttribute('data-was', was);
    var said = function (ok) {
      w.textContent = ok ? 'Copied' : 'Press and hold';
      setTimeout(function () { w.textContent = btn.getAttribute('data-was'); }, 2200);
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
    var slots = mReadSlots();
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
    var mine = mReadMyFoods(), fresh = mNewFoodKey(name, mine), key = fresh.key;
    name = fresh.name;
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

  /* src/combos.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
  var COMBOS = window.HiveParts.combos({ MDAYS: MDAYS, mExtOk: mExtOk, mFoodMealOK: mFoodMealOK, LIVE: LIVE });
  function mLevers() { return COMBOS.mLevers(); }
  function mComboFor(share, pick, slot) { return COMBOS.mComboFor(share, pick, slot); }

  /* src/pool.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
  var M_ALL_SECS = null;
  var POOL = window.HiveParts.pool({ MTRY_WIDE: MTRY_WIDE, M_WDAYS: M_WDAYS, S: S, dayKey: dayKey, kcalOf: kcalOf, keepingFocus: keepingFocus, keyDate: keyDate, mDay: mDay, mDayTargets: mDayTargets, mDoneAt: mDoneAt, mEarliestKey: mEarliestKey, mEditDay: mEditDay, mLatestKey: mLatestKey, mNearIds: mNearIds, mNever: mNever, mOnDay: mOnDay, mRank: mRank, mReadProfileRaw: mReadProfileRaw, mReadSlots: mReadSlots, mSlotSecs: mSlotSecs, mTotals: mTotals, mVerdict: mVerdict, mViewKey: mViewKey, renderMacros: renderMacros, todayKey: todayKey, LIVE: LIVE });
  function mExtOk() { return POOL.mExtOk(); }
  function mMealPool(slot, wide) { return POOL.mMealPool(slot, wide); }
  function mWideOpen(sk) { return POOL.mWideOpen(sk); }
  function mDaySummary(k) { return POOL.mDaySummary(k); }
  function mTryAgain(sk) { return POOL.mTryAgain(sk); }
  function mNavDay(step) { return POOL.mNavDay(step); }

  // ----------------------------------------------------------- shopping list
  /* The list itself is src/list.js. It is handed what it reads of the app's
     and gives back its three, kept under their own names for the callers
     here; none of them is called before the app is up. */
  var LIST = window.HiveParts.list({
    S: S,
    planEntries: planEntries,
    shopQty: shopQty,
    canBuy: canBuy,
    srcW: srcW,
    pwPrice: pwPrice,
    pwMoney: pwMoney
  });
  function buildList(given) { return LIST.buildList(given); }
  function listUsd(built) { return LIST.listUsd(built); }
  function renderList() { LIST.renderList(); }

  // ------------------------------------------------------------- print book
  /* The book itself is src/book.js, handed what it reads of the app's and
     giving back renderBook, kept under its own name for the callers here. */
  var BOOK = window.HiveParts.book({
    S: S,
    BOOKS: BOOKS,
    ONE_BOOK: ONE_BOOK,
    SEC_NOTE: SEC_NOTE,
    SEC_PART: SEC_PART,
    APP_NAME: APP_NAME,
    APP_LINE: APP_LINE,
    diffLabel: diffLabel,
    fillCounts: fillCounts,
    leaf: leaf,
    liftHTML: liftHTML,
    macroLine: macroLine,
    makerHTML: makerHTML,
    no: no,
    ours: ours,
    planIds: planIds,
    varyHTML: varyHTML,
    xref: xref,
    recipes: recipesNow,
    byId: byIdNow
  });
  function renderBook() { BOOK.renderBook(); }

  /* ---- what this household would have to go out for -----------------------
     src/shelf.js, under the names app.js has always called them by. As
     declarations, so they answer from anywhere in this file. */
  function foodSource(key) { return window.Shelf.foodSource(key); }
  function restockSource(key) { return window.Shelf.restockSource(key); }
  function storeCarries(key) { return window.Shelf.storeCarries(key); }
  function itemNeedsBuying(it) { return window.Shelf.itemNeedsBuying(it); }
  function alsoNeeds(r) { return window.Shelf.alsoNeeds(r); }
  function missingFor(r) { return window.Shelf.missingFor(r); }
  function lineNeedsBuying(r, ix) { return window.Shelf.lineNeedsBuying(r, ix); }

  /* src/strip.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
  var STRIP = window.HiveParts.strip({ S: S });
  function syncStick() { return STRIP.syncStick(); }
  function filtCount() { return STRIP.filtCount(); }
  function syncStrip() { return STRIP.syncStrip(); }
  function onScrollStrip() { return STRIP.onScrollStrip(); }
  function filtersPop(open) { return STRIP.filtersPop(open); }

  /* src/fold.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
  var FOLD = window.HiveParts.fold({ S: S });
  function mFoldForget() { return FOLD.mFoldForget(); }
  function mReduced() { return FOLD.mReduced(); }
  function syncShrunk() { return FOLD.syncShrunk(); }
  function onScrollShrink() { return FOLD.onScrollShrink(); }
  function onResizeFold() { return FOLD.onResizeFold(); }

  /* The print downloads and the page scale are the book's (src/book.js). */
  function fitPages() { BOOK.fitPages(); }
  function renderDownloads() { BOOK.renderDownloads(); }

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
  var FOCUS_ATTRS = ['data-check', 'data-add', 'data-day', 'data-fav', 'data-why', 'data-td',
    'data-pwq', 'data-pwing', 'data-pwingx', 'data-wmid',
    'data-src', 'data-srcpick', 'data-weekbuy', 'data-near', 'data-low', 'data-kitmore', 'data-kitpill', 'data-copyorder', 'data-stepgo',
    'data-cal', 'data-calweek', 'data-calagain', 'data-calfrom', 'data-caltpl',
    'data-addday', 'data-pswap', 'data-prate', 'data-adf', 'data-adadd', 'data-adsw', 'data-adopen', 'data-pwpick', 'data-pwsee', 'data-pwback', 'data-pwwant', 'data-pwopen', 'data-dayopen', 'data-dsact', 'data-srctag', 'data-fold',
    'data-scale', 'data-units', 'data-sync', 'data-edit', 'data-open', 'data-close',
    'data-poff', 'data-week', 'data-neww', 'data-mult', 'data-drop', 'data-ed', 'data-tab',
    'data-mslot', 'data-meat', 'data-mstep', 'data-mdel', 'data-mpick', 'data-mpout', 'data-mtarg', 'data-mlock', 'data-mpin', 'data-mfav', 'data-mtry', 'data-mdot', 'data-medit', 'data-mskip', 'data-msend',
    'data-mtsex', 'data-mtgoal', 'data-mtext', 'data-mtact', 'data-mtprot', 'data-mtedit', 'data-mtmfold', 'data-mtsec', 'data-mtfree', 'data-mtuse', 'data-mtw', 'data-mysync', 'data-mpnew', 'data-mplook', 'data-nf', 'data-nfpick', 'data-scan',
    'data-mmore', 'data-fppick', 'data-fpmore', 'data-nfcode', 'data-mpmode', 'data-mpshelf', 'data-mpbasket', 'data-mbstep', 'data-mpfit', 'data-mpdone', 'data-mweek', 'data-mfold', 'data-mtrain', 'data-mtdee', 'data-mpfav', 'data-mline', 'data-mchart', 'data-mchartopen', 'data-mpslot', 'data-mbal', 'data-mkeep', 'data-mkdo', 'data-mfood', 'data-mpills', 'data-mtrained', 'data-mgotrain', 'data-mtsync', 'data-mwhy', 'data-mdo', 'data-mallow', 'data-mbatch', 'data-mbsave', 'data-mbforget', 'data-minfo', 'data-mcrng', 'data-mfrom', 'data-mcopy', 'data-mfsadd', 'data-mfsmeal'];

  function focusKey(el) {
    if (!el || el === document.body || !el.getAttribute) return null;
    /* The view tabs are written once in index.html and never re-rendered, so
       there is nothing to find again — and they carry ids now, for the panels
       that name themselves after them. Keyed by those ids, a tab still holding
       focus from the click that opened a sheet pulled it straight back out of
       the sheet: New recipe lost its Name box to the Recipes tab. */
    if (el.getAttribute('role') === 'tab') return null;
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
    /* Nourish's sheets carry its sizes — a thumb's worth for every control,
       13 pixels at the least for type — without restyling every other tab's
       sheets, which share this root. */
    root.classList.toggle('m-sheets', S.view === 'macros');

    // a re-render triggered by a sync update should not scroll the sheet back
    // to the top, lose a half-typed code, or reroll the suggested one
    var prev = root.querySelector('.scrim');
    var keepScroll = prev ? prev.scrollTop : 0;
    var draft = root.querySelector('#joinCode');
    if (draft) S.joinDraft = draft.value;
    // and the name being typed for a dinner share; once left, it has been kept (or refused)
    var dname = root.querySelector('#dinerName');
    if (dname) S.dinerDraft = dname === document.activeElement ? dname.value : null;
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

    /* A recipe opened from the picks draws over them; back comes back. */
    if (S.addOpen && !S.openId) {
      root.innerHTML = addHTML();
      document.body.style.overflow = 'hidden';
      if (keepScroll) root.querySelector('.scrim').scrollTop = keepScroll;
      return;
    }
    if (S.tdSheet && !S.openId) {
      root.innerHTML = tdSheetHTML();
      document.body.style.overflow = 'hidden';
      return;
    }
    if (S.daySheet && !S.openId) {
      root.innerHTML = daySheetHTML();
      document.body.style.overflow = 'hidden';
      return;
    }
    if (S.pwOpen && !S.openId) {
      root.innerHTML = pwHTML();
      document.body.style.overflow = 'hidden';
      if (keepScroll) root.querySelector('.scrim').scrollTop = keepScroll;
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

    if (S.mCopyFrom) {
      root.innerHTML = mCopyFromHTML();
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
      /* Drawn once and left, for as long as scan's own markup is up — not
         only while the video is, which a finished scan takes away with the
         lookup result still to be read beneath it. */
      var already = prev && prev.querySelector('#scanRoot');
      if (!(S.mpMode === 'scan' && already)) {
        root.innerHTML = macroPickerHTML();
        document.body.style.overflow = 'hidden';
        if (keepScroll) root.querySelector('.scrim').scrollTop = keepScroll;
        // Scan is a way in, not a button inside one: choosing it opens the lens
        if (S.mpMode === 'scan' && !mCamDone && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
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
          '<div class="sheet-eyebrow">' + esc([(BOOKS[r.book] || BOOKS[3]).name, r.secName]
            .filter(function (x, i, a) { return i === 0 || x !== a[0]; })
            .concat('No. ' + no(r)).join(' · ')) + '</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
        '</div>' +
        '<h2 class="sheet-name">' + esc(r.name) + '</h2>' +
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
            (window.Store.pantryChanged() || srcKind() === 'own' ? 'Not on your shelf: '
              : srcKind() === 'sh' ? 'Needs items not on the standard storehouse list: '
                : 'Needs things ' + srcW().the + ' doesn\u2019t carry: ') +
            esc(m.join(', ')) + '.</div>';
        })() +
        (function () {
          var also = alsoNeeds(r);
          return also.length ? '<div class="sheet-extras" data-also="1">Also needs: ' + esc(also.join(', ')) + '.</div>' : '';
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
    /* The question names the dialog and the box it asks you to fill: a box
       with only a value in it was read out as "edit text, This Week", which
       says what is there and not what is being asked. */
    root.innerHTML = '<div class="scrim dlg-scrim no-print" data-dlg="cancel">' +
      '<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlgT"' +
        (D.body ? ' aria-describedby="dlgB"' : '') + '>' +
        '<h2 class="dlg-t" id="dlgT">' + esc(D.title) + '</h2>' +
        (D.body ? '<div class="dlg-b" id="dlgB">' + esc(D.body) + '</div>' : '') +
        (D.value !== undefined
          ? '<input class="txt" id="dlgInput" aria-labelledby="dlgT" value="' + esc(D.value) + '">' : '') +
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

        row('Needs beyond the staples', 'edExtras', b.extras, 'Nothing, or: Buttermilk, Nutmeg') +

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
  /* What the household lost that this phone kept (Store.removed — see
     keepRemoved in sync.js), and the two answers to it. It does not say
     who removed it: most often it is the other person deleting their own
     recipe, and this is only here for the times it was not. */
  function syncGoneHTML() {
    var gone = window.Store.removed ? window.Store.removed() : [];
    if (!gone.length) return '';
    var KIND = { mine: 'recipe', edits: 'change to a printed recipe', weeks: 'week' };
    var names = gone.slice(0, 6).map(function (x) {
      return '<li>' + esc(x.name || 'Untitled') + ' <span class="sync-note">(' + KIND[x.k] + ')</span></li>';
    }).join('') + (gone.length > 6 ? '<li>and ' + (gone.length - 6) + ' more</li>' : '');
    return '<div class="sync-gone">' +
      '<p class="sync-p">Taken out of the shared pantry on another phone. This one kept ' +
        (gone.length === 1 ? 'a copy' : 'copies') + ':</p>' +
      '<ul class="sync-gone-l">' + names + '</ul>' +
      '<div class="sync-row">' +
        '<button class="btn-primary" data-sync="restore">Put ' + (gone.length === 1 ? 'it' : 'them') + ' back</button>' +
        '<button class="ghost" data-sync="forgetgone">Leave ' + (gone.length === 1 ? 'it' : 'them') + ' out</button>' +
      '</div></div>';
  }

  /* Said once each, when it first happens, wherever you are: something the
     household lost, and this phone's storage refusing a save. The sheet
     says the first for as long as it stands; the second has no other
     place to be seen. */
  var mGoneSeen = -1, mHouseFullSaid = false;
  function mHouseNotices() {
    var n = window.Store.removed ? window.Store.removed().length : 0;
    if (mGoneSeen >= 0 && n > mGoneSeen) {
      mToast(n === 1 ? 'Something was taken out of the shared pantry on another phone. Sync &amp; sharing can put it back.'
        : n + ' things were taken out of the shared pantry on another phone. Sync &amp; sharing can put them back.');
    }
    mGoneSeen = n;
    /* Joining a pantry that had already planned this phone's week: the
       household's dinners stand, and hers went to a template with nothing
       on screen to say so. Said once, with where to find them. */
    var parked = window.Store.parkedNote ? window.Store.parkedNote() : null;
    if (parked && parked.length) {
      var and = function (l) { return l.length > 1 ? l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1] : l[0]; };
      mToast('Your dinners for ' + esc(and(parked.map(function (x) { return x.dates; }))) +
        ' are kept as the template' + (parked.length > 1 ? 's ' : ' ') +
        esc(and(parked.map(function (x) { return '‘' + x.name + '’'; }))) + ' — Plan › Cook this again');
    }
    var full = !!window.Store.storageFull;
    if (full && !mHouseFullSaid) {
      mToast('This phone’s storage for the app is full, so changes to the plan and recipes aren’t kept on it' +
        (window.Store.house ? ' — they still go to the shared pantry while there’s signal.' : '. Free some space to keep them.'));
    }
    mHouseFullSaid = full;
  }

  /* ---------------------------------------------------- a dinner's numbers
   *
     Plan my week holds a dinner to a Nourish plan, and a household can have
     more than one in it. Blake: "what if my wife has a different plan?" She
     makes hers on her own phone, signed in, and shares it from here.
   *
     Here and not in the plan's own sheet, because this is the sheet that
     says what goes where — your day is private, the pantry is shared — and
     this is the one thing that crosses from the first to the second. The two
     things it needs, an account and a pantry, are set up on this same sheet,
     so whatever is missing is one look up.
   *
     Only a dinner's calories and protein go, a third of the day as Plan my
     week works it out (pwFitCaps), under a name the person chooses.
     Remembered on this phone and for this account only: somebody else
     signing in here shares nothing until they say so. */
  var DINER_PREF = 'sh.diner';
  function dinerPref() {
    try { var v = JSON.parse(localStorage.getItem(DINER_PREF)); return v && typeof v === 'object' ? v : {}; }
    catch (e) { return {}; }
  }
  function dinerPrefSave(v) { try { localStorage.setItem(DINER_PREF, JSON.stringify(v)); } catch (e) { /* private */ } }
  function dinerOn() { var me = mAccount(), pr = dinerPref(); return !!me && pr.on === 1 && pr.u === me.uid; }
  // the name it goes under: the one given here, or the first word of the account's
  function dinerName() {
    var me = mAccount(), pr = dinerPref();
    if (!me) return '';
    if (pr.u === me.uid && typeof pr.n === 'string' && pr.n.trim()) return pr.n.trim().slice(0, 30);
    return String(me.name || '').trim().split(/\s+/)[0].slice(0, 30);
  }
  // what would go: nothing at all before there is a plan to take it from
  function dinerEntry(n) {
    if (!kcalOf(mReadTargets())) return null;
    var c = pwFitCaps();
    return { n: n, kc: Math.max(150, Math.min(3000, c.kc)), p: Math.max(0, Math.min(400, c.p)) };
  }
  /* The household's copy of mine, made what this phone's targets say now.
     Written only when it differs, so it is safe to call after any change. */
  function dinerKeep() {
    if (!window.Store.setMyDiner || !window.Store.house || !dinerOn()) return;
    var me = mAccount(), e = dinerEntry(dinerName());
    if (!e || !e.n) return;
    var had = window.Store.diners()[me.uid];
    if (had && had.n === e.n && had.kc === e.kc && had.p === e.p) return;
    window.Store.setMyDiner(e);
  }
  /* Once for each account and household as they become known: a phone
     with the switch on that joins a pantry, or signs in to one, brings its
     numbers with it. Not on every snapshot, or a phone with the switch on
     would put back what the same account had taken away on another. */
  /* And once more after a refusal, each time the household comes back from
     the server changed. The switch said "the household didn't take them",
     the rules were published, and nothing was sent again until the app was
     reopened. Never on the refusal's own echo, which changes nothing: a
     household still on the old rules costs one refused write per change in
     it, not a loop of them. */
  var dinerSeen = '', dinerRetry = -1;
  function dinerWatch() {
    var me = mAccount(), key = (me ? me.uid : '') + '|' + (window.Store.house || '');
    if (!me || window.Store.status !== 'synced') return;
    if (!window.Store.dinerRefused) dinerRetry = -1;
    else if (dinerRetry < 0) dinerRetry = window.Store.heard;
    else if (window.Store.heard !== dinerRetry) { dinerRetry = window.Store.heard; dinerSeen = ''; }
    if (key === dinerSeen) return;
    dinerSeen = key;
    dinerKeep();
  }
  function syncDinerHTML() {
    if (!window.Store.configured || !window.Store.setMyDiner) return '';
    var me = mAccount(), house = window.Store.house;
    if (!me || !house) {
      return '<p class="sync-note sync-diner">' + (!me && !house
        ? 'Sign in and join a pantry to share your dinner numbers with the household.'
        : !me ? 'Sign in above to share your dinner numbers with the household.'
          : 'Join a pantry to share your dinner numbers with the household.') + '</p>';
    }
    var on = dinerOn(), e = dinerEntry('');
    if (!e && !on) {
      return '<p class="sync-note sync-diner">Make your plan in Nourish, then share your dinner numbers from here.</p>';
    }
    var name = typeof S.dinerDraft === 'string' ? S.dinerDraft : dinerName();
    return '<div class="sync-diner">' +
      '<div class="sync-dinrow"><span id="dinerL">Share my dinner numbers with the household</span>' +
        '<button class="kit-tog" data-sync="diner" role="switch" aria-checked="' + on + '" aria-labelledby="dinerL"></button></div>' +
      '<div class="sync-row"><input class="txt" id="dinerName" maxlength="30" autocomplete="given-name" ' +
        'placeholder="Your name" aria-label="The name to share them under" value="' + esc(name) + '"></div>' +
      '<p class="sync-note">Only a dinner’s calories and protein go to the household — not your weight or what you eat.' +
        (e ? ' Yours: ' + e.kc + ' cal · ' + e.p + ' g protein a dinner.' : '') + '</p>' +
      (S.dinerMsg ? '<div class="sync-warn">' + esc(S.dinerMsg) + '</div>' : '') +
      (on && window.Store.dinerRefused ? '<div class="sync-warn">The household didn’t take them. Its sharing rules ' +
        'need publishing again: see SETUP.md, step 4.</div>' : '') +
    '</div>';
  }

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
        /* The box to type somebody else's code, kept. A second phone signed
           in to its own account makes a pantry of its own the moment it has
           a favourite (mHouseReconcile), and the box went with the screen
           for having none: she was read the code, and had nowhere to type
           it but behind Stop sharing here. */
        '<div class="sync-row">' +
          '<input class="txt" id="joinCode" placeholder="Join another pantry: its code" aria-label="Code of another pantry to join">' +
          '<button class="ghost" data-sync="join">Join</button>' +
        '</div>' +
        (S.joinMsg ? '<div class="sync-warn">' + esc(S.joinMsg) + '</div>' : '') +
        syncGoneHTML() +
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

        (window.Door ? '<div class="mt-div">What you want help with</div>' +
          [['d', 'Dinners and the shopping', 'Tonight\u2019s dinner and the list'], ['e', 'Eating well', 'What is left to eat'], ['w', 'A workout that fits', 'The next workout']].map(function (o) {
            var on = window.Door.help()[o[0]];
            return '<div class="kit-row"><span><b>' + o[1] + '</b><small>' + (on ? 'Today shows ' + o[2].charAt(0).toLowerCase() + o[2].slice(1) : 'Off: not on Today') + '</small></span>' +
              '<button class="kit-tog" role="switch" data-sync="help" data-v="' + o[0] + '" aria-checked="' + on + '" aria-label="' + o[1] + ' on Today"></button></div>';
          }).join('') + '<p class="kit-say">Only what Today shows. Every tab stays where it is.</p>' : '') +
        '<div class="mt-div">Your kitchen</div>' +
        '<button class="kit-row" data-sync="where"><span><b>Where your staples come from</b><small>' + esc(SRC_WORDS[srcKind()].pick) +
          (window.Store.opt('buy', true) ? '' : ' \u00b7 only what I have') + '</small></span><i aria-hidden="true">\u203a</i></button>' +
        '<button class="kit-row" data-sync="pantry"><span><b>What you keep on hand</b><small>' + kitItems().filter(function (i) { return i.on; }).length + ' on hand</small></span><i aria-hidden="true">\u203a</i></button>' +

        '<div class="mt-div">Your pantry</div>' +
        '<p class="sync-p">The shopping list, the week&rsquo;s meals and your favorites &mdash; shared ' +
        'with whoever you invite. Without an account or a code they stay on this device.</p>' +
        inviteLine +
        body +
        syncDinerHTML() +
        '<div class="sync-status"><span class="' + dotCls + '"></span>' + esc(label) +
          '<span class="sync-build">Build ' + esc(BUILD) + '</span></div>' +
        // said here for as long as it is so, not only in the one toast
        (window.Store.storageFull ? '<p class="sync-warn">This phone’s storage for the app is full, so changes to the plan and recipes aren’t kept on it' +
          (house ? '; they still go to the shared pantry while there’s signal.' : '. Free some space to keep them.') + '</p>' : '') +

        /* The app's one screen of settings for the whole of it, so the
           light-or-dark choice lives here. Auto is the phone's own. */
        (window.Theme ? '<div class="mt-div" id="syncThemeH">Appearance</div>' +
          '<div class="sync-theme"><span class="seg" role="group" aria-labelledby="syncThemeH">' +
            [['', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(function (o) {
              return '<button data-sync="theme" data-v="' + o[0] + '" aria-pressed="' + (window.Theme.get() === o[0]) + '">' + o[1] + '</button>';
            }).join('') + '</span>' +
            '<span class="sync-theme-say" role="status">' + (window.Theme.get() ? 'On this device' : 'Follows your phone') + '</span></div>' : '') +

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
    newFoodKey: mNewFoodKey,
    draft: mDraftDay,
    balance: function () {
      var t = mDayTargets(mViewKey());
      mEditDay(mViewKey(), function (d) { mBalanceDay(d, t); });
    },
    targets: function () { return mDayTargets(mViewKey()); },
    dayTargets: mDayTargets,
    // the week's carb cycle, floor and all, so a test reads the floor the app uses
    cycle: function () { return mCycleOf(mReadTargets()); },
    measured: mMeasuredTdee,
    tryAgain: mTryAgain,
    assumed: function () { var k = mViewKey(); return mAssumed(mDay(k), mDayTargets(k), mReadSlots()); },
    face: mPlanFace,
    tdee: mTdee,
    summary: mSummaryHTML,
    daySummary: mDaySummary,
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
    // every keyed part, off the one table, whether or not this device has anything stamped in it yet
    keyedParts: function () { return MSYNC_KEYED.map(function (r) { return r.part; }); },
    // the corrected clock and what corrects it, the day count, and what a lookup says
    now: function () { return mNow(); },
    clockHear: mClockHear,
    clockSent: function (t) { mClkSent = t; },
    dayN: mDayN,
    lookSay: mLookSay,
    nutrients: mNutrients,
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
    /* Protein as the plan counts it: the grams, the pounds they are counted
       against, how far a squeezed cut may take them, and the level chosen. */
    protein: function (pr) {
      return { g: mProtGrams(pr), ref: mProtRefLb(pr), floor: mProtFloorG(pr), level: mProtLevel(pr) };
    },
    /* When each meal opens, in minutes after midnight, and what an add to
       one would be — so the clock rule can be asked about without a picker. */
    opens: function () {
      var list = mReadSlots().list;
      return list.map(function (sl, i) { return { k: sl.k, at: mSlotOpens(list, i) }; });
    },
    addsEaten: mAddsEaten,
    judged: mDayJudged,
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
            return { id: it.id, x: it.x, why: it.why || '', name: r ? r.name : '(gone)',
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
  window.__bookBlurbs = { 1: BOOKS[1].blurb, 2: BOOKS[2].blurb, all: ONE_BOOK.blurb };
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
    /* Only where the household is: Nourish and Strengthen are yours alone,
       and on a phone the banner was 130 pixels above your own day. And not
       the moment the front door closes: a new phone answered four questions
       and landed on a fifth. From the next open on. */
    var show = window.Store.configured && !window.Store.house && !hintDismissed() &&
      S.view !== 'macros' && S.view !== 'train' && !(window.Door && window.Door.closed && window.Door.closed());
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
      by[c].push({ k: key, l: item.l, c: c, mine: mine, on: mine ? true : storeCarries(key), std: !!item.s });
    }
    Object.keys(P).forEach(function (k) { put(k, P[k], false); });
    Object.keys(own).forEach(function (k) { put(k, own[k], true); });
    order.forEach(function (c) { by[c].sort(function (a, b) { return a.l.localeCompare(b.l); }); });
    return order.map(function (c) { return { name: c, items: by[c] }; });
  }

  /* My kitchen: what the household has, wherever it came from, and one
     switch for whether the storehouse is part of the week at all. */
  /* One pill grid for every "is this so" question about foods: what the
     storehouse carries (step 1) and what you keep on hand (step 2). Grouped
     by shelf, six showing and "+N more", the ones that are so first. Blake:
     "It's all the same action, pretty much just different categories." */
  function pillGroupsHTML(o) {
    var q = String(o.q || '').trim().toLowerCase(), groups = {}, order = [];
    o.items.forEach(function (i) {
      if (q && i.l.toLowerCase().indexOf(q) < 0) return;
      if (!groups[i.c]) { groups[i.c] = []; order.push(i.c); }
      groups[i.c].push(i);
    });
    return order.map(function (c) {
      var items = groups[c].sort(function (x, y) { return (y.on - x.on) || x.l.localeCompare(y.l); });
      var on = items.filter(function (i) { return i.on; }).length, all = o.open[c] || q;
      var show = all ? items : items.slice(0, Math.max(6, on));
      var rest = items.length - show.length;
      return '<div class="kit-grp"><div class="kit-gh"><span>' + esc(c) + '</span><small>' + on + ' of ' + items.length + '</small></div>' +
        '<div class="pw-chips">' + show.map(function (i) {
          return '<button class="pw-chip kit-pill' + (i.ext ? ' ext' : '') + '" ' + o.attr + '="' + esc(i.k) + '" aria-pressed="' + i.on + '">' +
            esc(i.l) + '</button>';
        }).join('') +
        (rest > 0 ? '<button class="kit-more" ' + o.more + '="' + esc(c) + '">+' + rest + ' more</button>'
          : o.open[c] && !q && items.length > 6 ? '<button class="kit-more" ' + o.more + '="' + esc(c) + '">Show less</button>' : '') +
        '</div></div>';
    }).join('');
  }
  /* Step 2: what you keep. Your own foods (ones the books never mention)
     are a shelf of their own; a food the search cannot find can be added. */
  function kitItems() {
    var P = window.PANTRY || {}, both = planMode() === 'both', own = window.Store.pantryOwn();
    var out = Object.keys(P).map(function (k) {
      return { k: k, l: P[k].l, c: P[k].c || 'Other', on: foodSource(k) === 'h', ext: both && restockSource(k) !== 's' };
    });
    Object.keys(own).forEach(function (k) { out.push({ k: k, l: own[k].l, c: 'Yours', on: true, ext: false }); });
    return out;
  }
  function kitGroupsHTML() {
    var q = String(S.kitQ || '').trim(), items = kitItems(), add = '';
    if (q.length >= 2 && !items.some(function (i) { return i.l.toLowerCase() === q.toLowerCase(); })) {
      add = '<div class="kit-grp"><div class="pw-chips"><button class="pw-chip kit-pill kit-new" data-kitnew="' + esc(q) + '">+ Add \u201c' + esc(q) + '\u201d</button></div></div>';
    }
    return add + pillGroupsHTML({ items: items, q: q, open: S.kitOpen || {}, attr: 'data-kitpill', more: 'data-kitmore' });
  }
  function renderPantry() {
    var items = kitItems(), n = items.filter(function (i) { return i.on; }).length;
    if ($('kitNote')) $('kitNote').innerHTML = '<b class="kit-n">' + n + '</b> on hand \u00b7 tap one to change it' +
      (planMode() === 'both' ? ' \u00b7 a dashed edge is one ' + srcW().the + ' doesn\u2019t carry' : '');
    if ($('kitchenBody')) $('kitchenBody').innerHTML = kitGroupsHTML();
  }
  /* Step 1, when the storehouse is in it: what yours carries, as the same
     pills. Taking one off sends it to the shop; the book's list is one tap
     back. */
  function carryItems() {
    var P = window.PANTRY || {};
    return Object.keys(P).map(function (k) { return { k: k, l: P[k].l, c: P[k].c || 'Other', on: storeCarries(k) }; });
  }
  function carryGroupsHTML() {
    return pillGroupsHTML({ items: carryItems(), q: S.carryQ, open: S.carryOpen || {}, attr: 'data-carry', more: 'data-carrymore' });
  }
  function carryHTML() {
    var n = carryItems().filter(function (i) { return i.on; }).length;
    var W = srcW();
    return '<div class="step-sec"><h2 class="step-h2">What ' + W.your + ' carries</h2>' +
      '<p class="step-sub"><b id="carryN">' + n + '</b> carried \u00b7 tap one off if yours has stopped stocking it' +
        (window.Store.pantryChanged() ? ' \u00b7 <button class="nut-ask" id="pantryReset">' + W.back + '</button>' : '') + '</p>' +
      '<input class="pw-find" id="carryFind" type="search" placeholder="Find a food\u2026" autocomplete="off" aria-label="Find a food ' + W.the + ' carries" value="' + esc(S.carryQ || '') + '">' +
      '<div id="carryGroups">' + carryGroupsHTML() + '</div></div>';
  }

  // ------------------------------------------------------------------ views
  function renderView() {
    if (S.view !== 'plan') { S.pwNew = null; S.pwUndo = null; }
    ['today', 'browse', 'plan', 'macros', 'train', 'list', 'pantry', 'book', 'where'].forEach(function (v) {
      $('view-' + v).classList.toggle('hide', S.view !== v);
    });
    /* The book has no tab of its own any more; it opens from Recipes, so
       Recipes is the tab that stays lit while it is up. Plan stays lit
       through all four of its steps. */
    var lit = S.view === 'book' ? 'browse' : PLAN_STEPS.some(function (p) { return p[0] === S.view; }) ? 'plan' : S.view;
    renderSteps();
    /* Anywhere but Plan, "the week" is this week: a recipe added from
       Recipes, or the list, must not land in a week you had scrolled back to. */
    if (lit !== 'plan' && S.view !== 'list' && window.Store.activeWeek().id !== window.Store.thisWeek()) {
      window.Store.setWeek(window.Store.thisWeek());
      return;
    }
    if (S.view === 'where') renderWhere();
    document.querySelectorAll('.tab').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.dataset.view === lit));
      // one stop in the Tab order for the whole row: the lit tab
      b.tabIndex = b.dataset.view === lit ? 0 : -1;
    });
    if (S.view === 'today' && window.Today) window.Today.render();
    if (S.view === 'browse') renderBrowse();
    if (S.view === 'plan') renderPlan();
    if (S.view === 'macros') renderMacros();
    /* Train draws itself — src/train.js — and is only told when to. */
    if (S.view === 'train' && window.Train) window.Train.render();
    if (S.view === 'list') renderList();
    if (S.view === 'pantry') renderPantry();
    if (S.view === 'book') renderBook();
    renderShareHint();
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
    /* A finger on a Nourish chart, or dragged along it, reads out the
       morning under it; the page still scrolls up and down under it. */
    var mcDown = null;
    document.addEventListener('pointerdown', function (e) {
      var svg = e.target && e.target.closest && e.target.closest('svg.mc-svg[data-pts]');
      mcDown = svg || null;
      if (svg) mcRead(svg, e.clientX);
    });
    document.addEventListener('pointermove', function (e) { if (mcDown) mcRead(mcDown, e.clientX); });
    document.addEventListener('pointerup', function () { mcDown = null; });
    document.addEventListener('pointercancel', function () { mcDown = null; });
    document.querySelectorAll('.tab').forEach(function (b) {
      b.addEventListener('click', function () {
        S.view = b.dataset.view;
        try { localStorage.setItem('sh.view', S.view); viewSeen(); } catch (e) { /* private mode */ }
        renderView();
      });
    });
    /* The row, from the keyboard: Left and Right move along it and wrap,
       Home and End go to the ends. They move the focus and nothing else —
       showing a view is Enter or Space, which is the button's own click —
       because Nourish and Strengthen take a moment to draw and arrowing past
       them should not make you wait for each. Only the tabs that are there:
       List and Pantry are Plan's steps now and their tabs are never shown. */
    document.querySelector('.tabs').addEventListener('keydown', function (e) {
      var go = { ArrowRight: 1, ArrowLeft: -1, Home: 'home', End: 'end' }[e.key];
      if (!go) return;
      var tabs = Array.prototype.filter.call(this.querySelectorAll('[role="tab"]'),
        function (t) { return t.offsetParent !== null; });
      var i = tabs.indexOf(document.activeElement);
      if (i < 0 || !tabs.length) return;
      e.preventDefault();
      var j = go === 'home' ? 0 : go === 'end' ? tabs.length - 1 : (i + go + tabs.length) % tabs.length;
      tabs[j].focus();
    });
    if ($('planMyWeek')) $('planMyWeek').addEventListener('click', pwOpen);
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
    /* The two pill grids, and the way back to the book's storehouse list. */
    document.addEventListener('click', function (e) {
      if (!e.target.closest) return;
      var c = e.target.closest('[data-carry]');
      if (c) { window.Store.setPantry(c.dataset.carry, !storeCarries(c.dataset.carry)); return; }
      var cm = e.target.closest('[data-carrymore]');
      if (cm) { S.carryOpen = S.carryOpen || {}; S.carryOpen[cm.dataset.carrymore] = !S.carryOpen[cm.dataset.carrymore]; renderWhere(); return; }
      var nw = e.target.closest('[data-kitnew]');
      if (nw) { window.Store.addPantryItem(nw.dataset.kitnew, 'Yours'); S.kitQ = ''; var kf = $('kitFind'); if (kf) kf.value = ''; return; }
      if (e.target.closest('#pantryReset')) {
        ask({ title: srcW().reset,
          body: 'Everything you took off comes back. Foods you added yourself stay.',
          ok: 'Reset', danger: true }, function (ok) { if (ok) window.Store.resetPantry(); });
      }
    });
    document.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'carryFind') { S.carryQ = e.target.value; var g = $('carryGroups'); if (g) g.innerHTML = carryGroupsHTML(); }
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
      var ad = e.target.closest('[data-addday]');
      if (ad) { rememberOpener(); addOpen(ad.dataset.addday); return; }
      var dz = e.target.closest('[data-dayopen]');
      if (dz) { rememberOpener(); dayOpen(idOf(dz.dataset.dayopen), dz.dataset.day); return; }
      var op = e.target.closest('[data-open]');
      if (op) { rememberOpener(); openRecipe(idOf(op.dataset.open)); return; }
      var sw = e.target.closest('[data-pswap]');
      if (sw) { planSwap(idOf(sw.dataset.pswap), sw.dataset.day); return; }
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
      var mfr = e.target.closest('[data-mfrom]');
      if (mfr) {
        rememberOpener();
        S.mCopyFrom = { slot: mfr.dataset.mfrom, day: '' };
        pushSheet({ m: 1 });
        renderModal();
        return;
      }

      var fd = e.target.closest('[data-mfood]');
      if (fd) {
        rememberOpener();
        S.foodOpen = { id: fd.dataset.mfood, x: Number(fd.dataset.mx) || 1, slot: fd.dataset.mfslot || '' };
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
      var bw = e.target.closest('[data-mbatch]');
      if (bw) {
        S.mBatchOpen = S.mBatchOpen === bw.dataset.mbatch ? '' : bw.dataset.mbatch;
        renderMacros();
        if (S.mBatchOpen) { var bi = $('mBatchIn'); if (bi) bi.focus(); }
        return;
      }
      var bsv = e.target.closest('[data-mbsave], [data-mbforget]');
      if (bsv) {
        var bq = (bsv.dataset.mbsave || bsv.dataset.mbforget).split(':');
        var bit = (mDay(mViewKey())[bq[0]] || [])[Number(bq[1])];
        var brr = bit && BY_ID[bit.id];
        if (!brr) return;
        if (bsv.dataset.mbforget) {
          mSetBatchG(brr.id, 0);             // back to the estimate, box open for a new weight
          renderMacros();
          var bi2 = $('mBatchIn'); if (bi2) bi2.focus();
          return;
        }
        var bv = Number(String(($('mBatchIn') || {}).value || '').replace(/,/g, '').trim());
        if (!(bv > 0) || bv > 50000) { var bi3 = $('mBatchIn'); if (bi3) bi3.focus(); return; }
        mSetBatchG(brr.id, bv / (brr.servN || 1));
        renderMacros();
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
      if (this.value === 'pick') {
        this.value = mViewKey();
        mDayPick(true);
        return;
      }
      S.macroDate = this.value === todayKey() ? null : this.value;
      keepingFocus(renderMacros);
    });
    /* Any day the log keeps, by date. The box opens its own calendar where
       the phone has one; typed or picked, a day inside the window goes. */
    $('macroDayPick').addEventListener('change', function () {
      var v = this.value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v < mEarliestKey() || v > mLatestKey()) return;
      mDayPick(false);
      S.macroDate = v === todayKey() ? null : v;
      renderMacros();
    });
    $('macroDayPickX').addEventListener('click', function () { mDayPick(false); });
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
    /* A menu, and it behaves like one now. It said role=menu and then did
       none of what that promises: opening it left the focus on the gear, so
       a keyboard had to Tab through the day to find the items, the arrows did
       nothing, and Escape did not close it. Open, the focus goes to the first
       item and Up and Down walk the items round (Home and End jump); Escape
       closes it and hands the focus back to the gear; Tab closes it and goes
       on its way. The items are out of the Tab order themselves — the menu
       is one stop, the way a native one is. */
    function mMenuItems() {
      return Array.prototype.filter.call($('macroMenu').querySelectorAll('[role="menuitem"]'),
        function (b) { return b.offsetParent !== null && !b.disabled; });
    }
    function mMenu(open, back) {
      var m = $('macroMenu');
      if (!m) return;
      var was = !m.classList.contains('hide');
      m.classList.toggle('hide', !open);
      $('macroMore').setAttribute('aria-expanded', String(!!open));
      if (open && !was) { var its = mMenuItems(); if (its[0]) its[0].focus(); }
      if (!open && was && back) $('macroMore').focus();
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
    // the gear itself: Down opens onto the first item, Up onto the last
    $('macroMore').addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      mMenu(true);
      var its = mMenuItems();
      if (e.key === 'ArrowUp' && its.length) its[its.length - 1].focus();
    });
    $('macroMenu').addEventListener('keydown', function (e) {
      var its = mMenuItems(), i = its.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); mMenu(false, true); return; }
      if (e.key === 'Tab') { mMenu(false); return; }
      var j = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 :
        e.key === 'Home' ? 0 : e.key === 'End' ? its.length - 1 : null;
      if (j === null || !its.length) return;
      e.preventDefault();
      its[(j + its.length) % its.length].focus();
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
      mWatchUser();
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
      if (e.target.closest('#macroTargBtn')) { if (WGAPI.hide) WGAPI.hide(); mOpenTargets(); return; }
      if (e.target.closest('#macroWeekBtn')) { if (mWeekOn()) { if (WGAPI.hide) WGAPI.hide(); window.Train.openCheckin(); } return; }
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
    function mWeightOf(raw, key) {
      var t = String(raw == null ? '' : raw).trim();
      if (!t) return { empty: true, lb: 0 };
      if (!/^\d{1,4}(\.\d{1,2})?$/.test(t)) return { bad: true, lb: 0 };
      var typed = Number(t), u = mWUnit();
      if (!isFinite(typed) || typed <= 0) return { bad: true, lb: 0 };
      // typed in the box's unit, kept in pounds (see mWUnit)
      var n = u === 'kg' ? typed * MKG_LB : typed;
      if (n > 1500) return { bad: true, big: true, lb: 0 };
      /* A number that could be a weight but is not likely to be yours.
         "1905" for 190.5 used to be clamped to 1,500 and stored in silence;
         the seven-day average went to 377, the plan was healed up by 600 kcal
         to match, and correcting the morning afterwards did not bring it back
         down — the heal only ever raises. Far from your own average, or far
         from any adult's, it is asked about before it is written. */
      /* And the first morning ever is asked about under 90 lb, not 60: with
         nothing on record to compare it to, a kilogram reading typed into a
         box in pounds — 86 for 190 — is the likely mistake, and it would
         become the weight the whole plan is worked out for. */
      var st = mWeightStats();
      var ref = st && st.n >= 3 ? st.avg7 : 0;
      var first = !Object.keys(MWEIGHTS).some(function (k2) { return k2 !== key; });
      var odd = n < (first ? 90 : 60) || n > 700 || (ref > 0 && Math.abs(n - ref) > ref * 0.15);
      return { lb: n, odd: odd, ref: ref, first: first, shown: typed, u: u };
    }
    /* ---- the weigh-in, on Today ----
     * Nourish's morning card, borrowed: opening Today's weigh-in moves the
     * card itself (#macroWeigh, with every handler it has) into the sheet,
     * and closing puts it back where it lives. One card, one set of rules,
     * the comma refused and the odd number asked about wherever it is typed.
     * Under it, the week before today, any morning fixable in place. */
    var WG = { open: false, home: null, next: null, fold: undefined, fix: '' };
    /* The sheet exists only while it is open: built here, and gone when it
       shuts, so nothing hidden is left on the page to be found instead. */
    function wgFrame() {
      var el = document.createElement('div');
      el.id = 'weighSheet';
      el.className = 'scrim no-print';
      el.setAttribute('data-wclose', '1');
      el.innerHTML = '<div class="sheet wg-sheet" role="dialog" aria-modal="true" aria-label="Weigh in">' +
        '<div class="sheet-top"><div class="sheet-eyebrow">Weigh in</div>' +
          '<button class="sheet-x" data-wclose="1" aria-label="Close">&times;</button></div>' +
        '<div id="weighHost"></div><div id="weighWeek"></div></div>';
      el.addEventListener('click', wgClick);
      el.addEventListener('keydown', function (e) {
        if (e.target.id === 'wFixIn' && e.key === 'Enter') { var b = el.querySelector('[data-wsave]'); if (b) b.click(); }
      });
      document.body.appendChild(el);
      return el;
    }
    function wgPut(back) {
      var card = $('macroWeigh');
      if (!card) return;
      if (back) { if (WG.home) WG.home.insertBefore(card, WG.next); }
      else { WG.home = card.parentNode; WG.next = card.nextSibling; $('weighHost').appendChild(card); }
    }
    function wgKeyBack(n) { var d = keyDate(todayKey()); d.setDate(d.getDate() - n); return dayKey(d); }
    function wgWeek() {
      var el = $('weighWeek');
      if (!el || !WG.open) return;
      var u = mWUnit(), rows = '';
      for (var i = 1; i <= 7; i++) {
        var key = wgKeyBack(i), v = MWEIGHTS[key], d = keyDate(key);
        var day = '<b>' + d.toLocaleDateString('en-US', { weekday: 'short' }) + '</b> ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        rows += WG.fix === key
          ? '<div class="wg-row wg-fixing"><span>' + day + '</span><label class="wg-in"><input type="text" id="wFixIn" maxlength="6" inputmode="decimal" autocomplete="off" ' +
              'aria-label="Weight on ' + esc(d.toDateString()) + ' in ' + (u === 'kg' ? 'kilograms' : 'pounds') + '" value="' + (v ? mWShow(v) : '') + '"> ' + u + '</label>' +
              '<button class="btn-primary" data-wsave="' + key + '">Save</button><button class="nut-ask" data-wcancel="1">Cancel</button>' +
              '<span class="wg-note" id="wFixNote" role="status"></span></div>'
          : '<button class="wg-row" data-wfix="' + key + '"><span>' + day + '</span><b>' + (v ? mWShow(v) + ' ' + u : '<i>none</i>') + '</b><i aria-hidden="true">\u203a</i></button>';
      }
      el.innerHTML = '<div class="dsh-rl">The last week \u00b7 tap one to fix it</div>' + rows;
    }
    function wgOpen() {
      if (WG.open || !$('macroWeigh')) return;
      /* The card as it always is: a morning not weighed is the box and
         nothing else, weighing opens it, its own handle folds it. */
      S.macroDate = null;                // the sheet is about this morning
      WG.fix = '';
      wgFrame();
      wgPut(false);
      WG.open = true;
      document.body.style.overflow = 'hidden';
      pushSheet({ wg: 1 });
      renderMacros();
      var w = $('mWeight');
      if (w && !MWEIGHTS[todayKey()]) w.focus(); else { var x = document.querySelector('#weighSheet .sheet-x'); if (x) x.focus(); }
    }
    /* Shut, and the card goes home. hide() is the same without touching the
       history: a sheet opened from inside it (the plan, the week) takes its
       place, and back from that one lands on Today. */
    function wgHide() {
      if (!WG.open) return;
      wgPut(true);
      WG.open = false;
      var fr = $('weighSheet');
      if (fr) fr.parentNode.removeChild(fr);
      if (!document.querySelector('#modalRoot .scrim')) document.body.style.overflow = '';
      if (S.view === 'macros') renderMacros();
      if (S.view === 'today' && window.Today) window.Today.render();
    }
    WGAPI.open = wgOpen; WGAPI.hide = wgHide; WGAPI.close = wgHide; WGAPI.week = wgWeek;
    WGAPI.isOpen = function () { return WG.open; };
    function wgClick(e) {
      if (e.target.closest('[data-wclose]') && (e.target === e.currentTarget || e.target.closest('.sheet-x'))) { close(); return; }
      var fx = e.target.closest('[data-wfix]');
      if (fx) { WG.fix = fx.dataset.wfix; wgWeek(); var fi = $('wFixIn'); if (fi) { fi.focus(); fi.select(); } return; }
      if (e.target.closest('[data-wcancel]')) { WG.fix = ''; wgWeek(); return; }
      var sv = e.target.closest('[data-wsave]');
      if (sv) {
        var key = sv.dataset.wsave, raw = ($('wFixIn') || {}).value, got = mWeightOf(raw, key);
        var note = $('wFixNote');
        if (got.bad) { if (note) note.textContent = got.big ? 'More than anyone weighs. A point missing?' : 'Weights take digits and a point.'; return; }
        var write = function () { mWriteWeight(key, got.empty ? 0 : got.lb); WG.fix = ''; renderMacros(); };
        if (got.odd) {
          ask({ title: 'Keep ' + got.shown + ' ' + got.u + '?', body: got.ref ? 'Your average lately is ' + mWShow(got.ref) + ' ' + got.u + '.' : 'That is outside what a weight usually is.', ok: 'Keep it' },
            function (yes) { if (yes) write(); });
          return;
        }
        write();
      }
    }

    function mWeightSay(bad, odd) {
      var el = $('mWeightNote');
      if (el) el.textContent = bad === 'big' ? 'More than anyone weighs. A point missing?'
        : bad ? 'Weights take digits and a point.'
        : odd ? 'That is ' + odd.shown + ' ' + odd.u + (odd.ref ? ', against ' + mWShow(odd.ref) +
          ' lately' : '') + '. Enter to keep it.' : '';
      var box = $('mWeight');
      if (box) box.setAttribute('aria-invalid', bad ? 'true' : 'false');
    }
    $('macroWeigh').addEventListener('input', function (e) {
      if (e.target.id !== 'mWeight') return;
      clearTimeout(mwTimer);
      var key = mViewKey(), got = mWeightOf(e.target.value, key);
      mWeightSay(got.big ? 'big' : !!got.bad, got.odd ? got : null);
      if (got.bad || got.odd) return;            // nothing is written from nonsense, or unasked
      mwTimer = setTimeout(function () { mWriteWeight(key, got.lb); }, 600);
    });
    $('macroWeigh').addEventListener('change', function (e) {
      if (e.target.id !== 'mWeight') return;
      clearTimeout(mwTimer);
      var got = mWeightOf(e.target.value, mViewKey());
      mWeightSay(got.big ? 'big' : !!got.bad, got.odd ? got : null);
      if (got.bad) return;
      if (got.odd) {
        var oddKey = mViewKey();
        ask({
          title: 'Keep ' + got.shown + ' ' + got.u + '?',
          body: got.ref ? 'Your average lately is ' + mWShow(got.ref) + ' ' + got.u + '.'
            : got.first && got.u === 'lb' && got.lb < 90
            ? 'That is light for a first weigh-in. If your scale reads kilograms, choose Kilograms ' +
              'under \u201cWeights in\u201d in Strengthen and this box will ask in kg.'
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
      /* Today too: resumed after midnight it went on showing yesterday's
         dinner and "2,035 left today" until a tab was switched. */
      if (S.view === 'today' && window.Today) window.Today.render();
    });

    document.addEventListener('click', function (ev) {
      if (!ev.target.closest || !ev.target.closest('#clearPlan')) return;
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
      /* No signal: the download would go nowhere and say nothing. */
      if (e.target.closest('[data-fold], [data-get]') && navigator.onLine === false) {
        e.preventDefault();
        mToast('The PDFs download from the internet. Try again with signal.');
        return;
      }
      if (e.target.closest('[data-fold], [data-get], #doPrint')) return;
      var b = e.target.closest('[data-print]');
      if (!b || b.dataset.print === S.printSet) return;
      S.printSet = b.dataset.print;
      renderBook();
    };
    $('printRows').addEventListener('click', pick);
    // and the buttons say so as the signal comes and goes
    var signal = function () { if (S.view === 'book') renderDownloads(); };
    window.addEventListener('online', signal);
    window.addEventListener('offline', signal);
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
      if ((!mAuthKnown || mSyncUnreachable) && mSuspectAccount()) mSyncStart();
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

      var fsm = e.target.closest('[data-mfsmeal]');
      if (fsm && S.foodOpen) {
        mFsRefresh();
        S.foodOpen.pick = fsm.dataset.mfsmeal;
        renderModal();
        return;
      }
      var fsa = e.target.closest('[data-mfsadd]');
      if (fsa && S.foodOpen) {
        mFsRefresh();
        var fr = BY_ID[S.foodOpen.id], fx = fr && mFsState(fr).x, fsk = fsa.dataset.mfsadd, fk = mViewKey();
        if (!fr || !fx || !fsk) return;
        var fate = mAddsEaten(fk, fsk);
        // disarmed first, as data-mpdone is: close() lands later, and a second tap in between added it again
        S.foodOpen = null;
        mEditDay(fk, function (d5) {
          (d5[fsk] = d5[fsk] || []).push({ id: fr.id, x: fx, eaten: fate });
        });
        mToast(esc(fr.name) + ' added to ' + esc(mSlotName(fsk)) + '.');
        close();
        renderMacros();
        return;
      }
      var mcp = e.target.closest('[data-mcopy]');
      if (mcp && S.mCopyFrom) {
        var toK = mViewKey(), csk = S.mCopyFrom.slot, fromK = mcp.dataset.mcopy;
        var its = mCopyItems(fromK, csk);
        S.mCopyFrom = null;
        if (its.length) {
          var cate = mAddsEaten(toK, csk);
          mEditDay(toK, function (d6) {
            d6[csk] = (d6[csk] || []).concat(its.map(function (it) {
              return { id: it.id, x: it.x, eaten: cate };
            }));
          });
          mToast(its.length + (its.length === 1 ? ' plate' : ' plates') + ' from ' + esc(mLongDate(fromK)) +
            ' added to ' + esc(mSlotName(csk)) + '.');
        }
        close();
        renderMacros();
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
      var mcr = e.target.closest('[data-mcrng]');
      if (mcr && S.chartOpen) {
        S.mcRange = mcr.dataset.mcrng;
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
        mCamDone = false;               // a fresh visit to scan opens the lens again
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
        /* The number is already in hand, so this visit to scan is finished
           before it is drawn — drawing it must not ask for the camera. */
        mCamDone = true;
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
          /* The number typed beside the lens is the scan's answer, the same
             as the row that offers a typed barcode: it goes the same way, and
             lets go of the camera, rather than asking with the light left on. */
          if (byCode && S.macroPick && S.mpMode === 'scan') { mScanGot(term, true); return; }
          $('nfResults').innerHTML = '<div class="mslot-empty">Looking&hellip;</div>';
          MLOOKUP = {};
          var asked = ++mLookSeq;       // a slower answer to the question before is dropped
          (byCode ? mBarcodeLookup(term.replace(/\D/g, '')) : mFoodSearch(term, packaged))
            .then(function (list) {
              if (asked !== mLookSeq || !$('nfResults')) return;
              $('nfResults').innerHTML = mLookupRows(list);
            }, function (err) {
              if (asked !== mLookSeq || !$('nfResults')) return;
              $('nfResults').innerHTML = '<div class="mslot-empty">' +
                esc(mLookSay(err, byCode ? term : '')) + '</div>';
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
        var allF = mReadMyFoods(), ffresh = mNewFoodKey(nm, allF), fkey = ffresh.key;
        nm = ffresh.name;
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
        var nate = mAddsEaten(mViewKey(), nslot);
        mEditDay(mViewKey(), function (day) {
          (day[nslot] = day[nslot] || []).push({ id: 'f:my:' + fkey, x: 1, eaten: nate });
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

      /* The fitting amount, in one tap: into the basket at that portion, or
         the basket's portion moved to it. Pressed again, back out. */
      var mpfx = e.target.closest('[data-mpfit]');
      if (mpfx && S.macroPick) {
        var fid = idOf(mpfx.dataset.mpfit), fxv = Number(mpfx.dataset.mpx) || 1;
        if (S.mpBasket[fid] !== undefined && Math.abs(S.mpBasket[fid] - fxv) < 1e-6) delete S.mpBasket[fid];
        else S.mpBasket[fid] = fxv;
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
        /* Cut at the LAST colon. A food's id carries colons of its own —
           "f:egg", "f:my:tamale" — so splitting on every one read the id as
           "f" and the direction as "egg", and − and + did nothing to a food. */
        var bsv = mbs.dataset.mbstep, bcut = bsv.lastIndexOf(':');
        var bid = idOf(bsv.slice(0, bcut));
        if (S.mpBasket[bid] !== undefined) {
          S.mpBasket[bid] = mStepX(BY_ID[bid], S.mpBasket[bid], Number(bsv.slice(bcut + 1)));
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
        /* Eaten or planned by when the meal is — see mAddsEaten. */
        var ate = mAddsEaten(mViewKey(), cslot);
        mEditDay(mViewKey(), function (day) {
          var list = (day[cslot] = day[cslot] || []);
          Object.keys(basket).forEach(function (k) {
            list.push({ id: idOf(k), x: basket[k], eaten: ate });
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

      if (e.target.closest('[data-mgotrain]')) {
        close();
        try { if (window.Train && window.Train.openDays) window.Train.openDays(); } catch (e2) { /* Strengthen is not up */ }
        var tb = document.querySelector('.tab[data-view="train"]');
        if (tb) tb.click();
        return;
      }
      var tsy = e.target.closest('[data-mtsync]');
      if (tsy && S.macroTargOpen) {
        var prS = mReadProfile();
        prS.syncTrain = tsy.dataset.mtsync === '1';
        mWriteProfile(prS);
        Array.prototype.forEach.call(tsy.parentElement.querySelectorAll('[data-mtsync]'), function (b) {
          b.setAttribute('aria-pressed', String(b === tsy));
        });
        var cap = tsy.parentElement.nextElementSibling;
        if (cap) cap.textContent = prS.syncTrain ? 'Your plan and logged workouts set each day' : 'You set each day yourself';
        if (S.view === 'macros') renderMacros();
        return;
      }
      var trn = e.target.closest('[data-mtrain]');
      if (trn && S.macroTargOpen) {
        var ti = Number(trn.dataset.mtrain);
        var days = mTrainDays(), at = days.indexOf(ti);
        if (at >= 0) days.splice(at, 1); else days.push(ti);
        mSetTrainDays(days);
        trn.setAttribute('aria-pressed', at >= 0 ? 'false' : 'true');
        if ($('mtWorkouts')) $('mtWorkouts').value = days.length;
        if ($('mtTrainN')) $('mtTrainN').textContent = mTrainNSay(days.length);
        mtRefreshPlan();
        if (S.view === 'macros') renderMacros();
        return;
      }


      var mseg = e.target.closest('[data-mtsex], [data-mtgoal], [data-mtext], [data-mtact], [data-mtprot]');
      if (mseg && S.macroTargOpen) {
        /* Which segment this is, asked of the element instead of guessed from
           a pair. The ternary that used to sit here had to grow a branch for
           every segment added, and the failure when one is missed is silent:
           the press lands, the wrong row's buttons are queried, and nothing
           moves. */
        var segAttr = ['mtsex', 'mtgoal', 'mtext', 'mtact', 'mtprot'].filter(function (a) {
          return mseg.dataset[a] !== undefined;
        })[0];
        Array.prototype.forEach.call(mseg.parentElement.querySelectorAll('button[data-' +
          segAttr + ']'), function (b) {
          b.setAttribute('aria-pressed', String(b === mseg));
        });
        // the three activity words write the select the profile is read from
        if (segAttr === 'mtact' && $('mtAct')) $('mtAct').value = mseg.dataset.mtact;
        mtRefreshPlan();
        if (segAttr === 'mtprot') {
          var protRow = mseg.closest('.mt-prot');
          if (protRow) protRow.setAttribute('data-moved', '1');
          mtSyncSave();
        }
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
        if (act2 === 'retry') { mSyncStart(); renderModal(); return; }
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
            /* The dinner numbers go with the account, as on delete: left in
               the household, with nobody signed in to own them, this phone
               showed them back as somebody else's plan ("Hits both"). */
            if (dinerOn() && window.Store.setMyDiner) {
              window.Store.setMyDiner(null);
              dinerPrefSave({ on: 0, u: mAccount().uid, n: dinerName() });
            }
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
          /* Grams Nourish cannot plan a day on are refused here, whole: no
             profile, no targets, no meals written, and the line under the
             total says why (mtRefusal). Saving them used to mean the read
             that followed quietly served different ones. */
          var prSave = mtProfileFromDom(), planSave = mPlanCalc(prSave);
          var refused = mtRefusal(saved, prSave, !(planSave && Math.abs(planSave.p - saved.p) <= 1 &&
            Math.abs(planSave.f - saved.f) <= 1 && Math.abs(planSave.c - saved.c) <= 1));
          if (refused) {
            var rf = $('mtRefuse');
            if (rf) {
              rf.innerHTML = '<span class="mt-warn">' + esc(refused) + '</span>';
              // where it can be read: the wizard's fold, or the shut editor
              var rfFold = rf.closest('details');
              if (rfFold) rfFold.open = true;
              var rfEd = $('mtEditor');
              if (rfEd && rfEd.contains(rf) && rfEd.classList.contains('hide')) {
                rfEd.classList.remove('hide');
                var rfEdB = document.querySelector('[data-mtedit]');
                if (rfEdB) rfEdB.setAttribute('aria-expanded', 'true');
                mtSyncSave();
              }
              if (rf.scrollIntoView) rf.scrollIntoView({ block: 'nearest' });
            }
            return;
          }
          // the profile rides along, so next time the sheet already knows you
          mWriteProfile(prSave);
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
        if (act === 'where' || act === 'pantry') { close(); goStep(act); return; }
        if (act === 'help' && window.Door) {
          var hp = window.Door.help();
          hp[sy.dataset.v] = !hp[sy.dataset.v];
          window.Door.setHelp(hp);
          renderModal();
          if (S.view === 'today' && window.Today) window.Today.render();
          return;
        }
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
          var v = ($('joinCode') || {}).value || '', from = window.Store.house;
          var to = v.trim().toUpperCase().replace(/\s+/g, '-');
          S.joinMsg = '';
          if (to && to !== from) {
            var go = function () {
              // the box is on the next screen too: empty there, not holding the code just used
              var jb = $('joinCode'); if (jb) jb.value = '';
              S.joinDraft = '';
              S.joinBack = from ? { code: from, mine: window.Store.houseIsMine } : null;
              mHouseTellNext = true; window.Store.join(v);
            };
            /* From inside a pantry other people share, asked first, as an
               invite and the account's own pantry are: it takes this phone
               out of theirs. One that is only this account's own is left
               without a word. */
            if (from && !mHouseAlone()) {
              ask({ title: 'Leave this pantry?',
                body: 'This device is sharing ' + from + '. Joining ' + to + ' takes it out of that one, and brings what is on this device along.',
                ok: 'Join ' + to }, function (yes) { if (yes) go(); renderModal(); });
            } else go();
          }
        }
        /* On needs a name to go under; off takes the numbers back out of the
           household, not just this phone's say-so. */
        if (act === 'diner' && mAccount()) {
          var dme = mAccount(), dnm = String(($('dinerName') || {}).value || '').trim().slice(0, 30);
          S.dinerMsg = '';
          if (dinerOn()) {
            dinerPrefSave({ on: 0, u: dme.uid, n: dnm || dinerName() });
            window.Store.setMyDiner(null);
          } else if (!dnm) {
            S.dinerMsg = 'Add a name to share them under.';
          } else {
            dinerPrefSave({ on: 1, u: dme.uid, n: dnm });
            dinerKeep();
          }
          S.dinerDraft = null;
        }
        if (act === 'restore' && window.Store.restoreRemoved) window.Store.restoreRemoved();
        if (act === 'forgetgone' && window.Store.forgetRemoved) window.Store.forgetRemoved();
        if (act === 'theme' && window.Theme) window.Theme.set(sy.dataset.v || '');
        /* Signed in, stopping here stops it for the account too; otherwise
           the next snapshot would put this device straight back in. */
        if (act === 'leave') {
          S.inviteUrl = ''; S.inviteMsg = ''; S.joinMsg = ''; S.joinBack = null;
          /* The switch was "share with the household", and that household
             is being left: off, so the numbers do not follow this account
             into the next pantry it joins, unasked. */
          if (dinerOn()) dinerPrefSave({ on: 0, u: mAccount().uid, n: dinerName() });
          window.Store.leave();
          mHouseTellNext = false;
          if (mAccount() && mSyncDoc) mHouseTell('');
        }
        renderModal();
        /* Said as well as shown: "On this device" is a status now. The sheet
           is drawn afresh, and a live region that arrives with its words is
           one nobody was listening to yet, so they go in a frame later. */
        var tsay = act === 'theme' && document.querySelector('.sync-theme-say');
        if (tsay) {
          var tw = tsay.textContent;
          tsay.textContent = '';
          requestAnimationFrame(function () { tsay.textContent = tw; });
        }
      }
    });

    /* The name, once it is typed: kept, and sent if the switch is on. An
       empty box keeps the name it had, since a share needs one.
     *
       Sent a moment later rather than now. The box loses focus to whatever
       is pressed next, and a write redraws the sheet — so sending at once
       redrew the switch, or the ×, out from under the finger pressing it,
       and the press went nowhere. */
    var dinerLater = 0;
    $('modalRoot').addEventListener('change', function (e) {
      if (e.target.id !== 'dinerName' || !mAccount()) return;
      var nm = String(e.target.value || '').trim().slice(0, 30), pr = dinerPref();
      S.dinerDraft = null;
      if (nm) {
        dinerPrefSave({ on: dinerOn() ? 1 : 0, u: mAccount().uid, n: nm });
        clearTimeout(dinerLater);
        dinerLater = setTimeout(dinerKeep, 300);
      } else if (pr.on !== 1) dinerPrefSave({ on: 0, u: mAccount().uid, n: '' });
    });

    // the nutrition preview follows the ingredients as they are typed
    $('modalRoot').addEventListener('input', function (e) {
      if (e.target.id === 'pwBud' && S.pwOpen) {
        S.pw.a.bud = Number(e.target.value) || 50;
        pwSave(S.pw.a);
        var bv = $('pwBudV'); if (bv) bv.textContent = '$' + S.pw.a.bud;
        return;
      }
      if (e.target.id === 'adFind' && S.addOpen) {
        S.add.q = e.target.value;
        var al = $('adList'); if (al) al.innerHTML = adListHTML();
        return;
      }
      if (e.target.id === 'pwIng' && S.pwOpen) {
        var sg = $('pwSug'); if (sg) sg.innerHTML = pwSugHTML(e.target.value);
        return;
      }
      if (S.foodOpen && e.target.id === 'mfsAmt') mFsRefresh();
      if (S.editId && (e.target.id === 'edIng' || e.target.id === 'edServings' ||
        e.target.id === 'edExtras' || /^ed(Kcal|P|C|F)$/.test(e.target.id))) refreshPreview();
      if (S.syncOpen && e.target.id === 'myJoin') S.myJoin = e.target.value;
      if (S.newFood && e.target.id === 'nfFind') { /* typed; the buttons ask */ }
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
      if (S.mCopyFrom && e.target.id === 'mcfDate') {
        var cv = e.target.value;
        S.mCopyFrom.day = /^\d{4}-\d{2}-\d{2}$/.test(cv) ? cv : '';
        renderModal();
        return;
      }
      if (S.foodOpen && e.target.id === 'mfsUnit') {
        // the same amount of food, said in the new unit
        var ur = BY_ID[S.foodOpen.id];
        if (ur) {
          var was = mFsState(ur), ni = Number(e.target.value) || 0;
          S.foodOpen.u = ni;
          S.foodOpen.amt = was.x ? mFsAmt(ur, was.x, was.units[ni]) : S.foodOpen.amt;
          renderModal();
        }
        return;
      }
      if (S.macroTargOpen && (e.target.id === 'mtAct' || e.target.id === 'mtGoalBy')) mtRefreshPlan();
      /* The picker's two lenses redraw only the list, like the search box —
         here on change and not also on input, where they were handled a
         second time: a select fires both, and every choice drew the list
         twice.
       *
         Held, because these two live INSIDE #mpList. They used to sit in
         .mp-controls, a sibling of the list, where replacing the list could
         not touch them. They moved onto the "Fits best / On the shelf"
         divider, which mpFitsHTML returns as part of the list — so redrawing
         the list destroys the very select that asked for the redraw, and
         focus falls to the body. A keyboard or screen-reader user had to tab
         from the top of the sheet back down for every single change.
         focusKey falls back to #id, so there is nothing to add to
         FOCUS_ATTRS; there was simply nothing holding on. */
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
        /* The top one, when more than one is up. A question is asked from
           #dialogRoot, over everything — a sheet included — and the trap used
           to look only in #modalRoot, so with "Clear the week?" on screen Tab
           walked straight out of the question and into the page behind it.
           Strengthen's sheets are drawn in #trainRoot, which sits after
           #modalRoot and so above it; they had no trap at all. */
        var scrim = document.querySelector('#dialogRoot .dlg') ||
          document.querySelector('#trainRoot .scrim') ||
          document.querySelector('#modalRoot .scrim, #modalRoot .dlg');
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
      // Plan's sheets too: Plan my week, a day's dinner, Add to a day stayed up on Escape
      if (e.key === 'Escape' && (S.openId || S.syncOpen || S.macroPick || S.macroTargOpen || S.newFood ||
        S.keepMeal || S.chartOpen || S.foodOpen || S.mCopyFrom || S.pwOpen || S.daySheet || S.addOpen)) close();
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
    /* Back is Cancel, as Escape is: null, the one answer every question
       reads as no. false read as yes to the pantry reset, which tested only
       for null, so swiping back on "Back to the storehouse list?" emptied
       the shelf it was asking about. */
    if (D) closeDialog(null);
    if (id && BY_ID[id]) {
      depth = Math.max(0, depth - 1);
      S.openId = idOf(id);
      S.scale = 1;
      S.why = false;
      renderModal();
    } else if (e.state && ((e.state.pw && S.pwOpen) || (e.state.ad && S.addOpen) || (e.state.ds && S.daySheet) || (e.state.td && S.tdSheet))) {
      /* Back from a recipe opened over Plan my week's list, + Add or a day's
         sheet lands on that sheet, not on the page under all of them. */
      depth = Math.max(0, depth - 1);
      S.openId = null;
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
    S.dinerDraft = null; S.dinerMsg = '';
    S.pwOpen = false;
    S.addOpen = false;
    S.daySheet = null;
    S.tdSheet = null;
    if (WGAPI.close) WGAPI.close();
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
    S.mCopyFrom = null;
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
  /* When the view on screen was last on screen: written as the page is put
     away, which is what a refresh or leaving the app does, and on a change
     of tab. See S.view. */
  function viewSeen() {
    try { localStorage.setItem('sh.viewAt', String(Date.now())); } catch (e) { /* private mode */ }
  }
  /* And brought back after an hour away, the same: Today. Only a cold start
     did it, and a phone that never closes the app is resumed, not started —
     three hours on Nourish and it was still Nourish. sh.viewAt was written
     as the page was put away, so on the way back it is the time it left.
     Registered before the other resume handlers, so they draw Today.
     Not from under a sheet left open, the recipe being written above all:
     what was in the middle of being done is still there to finish. */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { viewSeen(); return; }
    var at = 0;
    try { at = Number(localStorage.getItem('sh.viewAt')) || 0; } catch (e) { /* private mode */ }
    if (S.editId || document.querySelector('.scrim')) return;
    if (at && Date.now() - at >= 3600e3 && S.view !== 'today') goView('today');
  });
  window.addEventListener('pagehide', viewSeen);
  function goView(v) {
    if (PLAN_STEPS.some(function (p) { return p[0] === v; }) && v !== 'plan') { goStep(v); viewSeen(); return; }
    S.view = v;
    try { localStorage.setItem('sh.view', v); } catch (e) { /* private mode */ }
    viewSeen();
    renderView();
    window.scrollTo(0, 0);
  }

  /* What Today shows of Plan, Nourish and the list: read here, where those
     live, and handed over as plain values. src/today.js draws them; its
     buttons come back through the doors below. */
  /* The day's meals for Today, in the order Nourish holds them: what is on
     each, its calories and protein, and whether all of it has been eaten.
     A skipped meal is left out; an empty one says so. */
  function todayMeals(tk) {
    var day = mDay(tk);
    return mReadSlots().list.filter(function (sl) { return !mSkipped(tk, sl.k); }).map(function (sl) {
      var its = (day[sl.k] || []).filter(function (it) { return BY_ID[it.id] && BY_ID[it.id].macro; });
      // counted the way Nourish counts its own day, one meal at a time
      var one = {}; one[sl.k] = its;
      var tot = mTotals(one).all, names = its.map(function (it) { return BY_ID[it.id].name; });
      return { k: sl.k, n: sl.n, kcal: tot.kcal, p: tot.p, empty: !its.length,
        eaten: !!its.length && its.every(function (it) { return it.eaten; }),
        name: names.length > 2 ? names.slice(0, 2).join(', ') + ' +' + (names.length - 2) : names.join(', ') };
    });
  }
  /* Your plate tonight: what Nourish has on your day for that dinner, when
     it has it (Fill sizes it to your numbers); otherwise the plate Plan my
     week works out for your plan. Nothing, with no plan to size it for. */
  function tonightPlate(id, tk) {
    var day = mDay(tk), hit = null;
    Object.keys(day).forEach(function (sk) {
      (day[sk] || []).forEach(function (it) { if (!hit && String(it.id) === String(id) && BY_ID[it.id] && BY_ID[it.id].macro) hit = it; });
    });
    if (hit) {
      var tot = mTotals({ d: [hit] }).all;
      return { x: hit.x, kcal: tot.kcal, p: tot.p };
    }
    var r = BY_ID[idOf(id)];
    if (!r || kcalOf(mReadTargets()) <= 0) return null;
    var pl = pwPlate(r, pwPlans()[0]);
    return pl ? { x: pl.x, kcal: pl.kc, p: pl.p } : null;
  }
  /* This morning's weight for Today's line: whether you have weighed, what
     the scale said, and the week it sits in. Nourish's own numbers. */
  function todayWeigh(tk) {
    var st = mWeightStats(), had = MWEIGHTS[tk];
    return { done: !!had, now: had ? mWShow(had) : null, unit: mWUnit(),
      avg: st && st.n >= 2 ? mWShow(st.avg7) : null, week: st && st.n >= 2 && st.dWeek !== null ? mLbWord(st.dWeek) : '',
      last: st && st.lastKey !== tk && st.latest ? mWShow(st.latest) : null, lastKey: st ? st.lastKey : '' };
  }
  function todayData() {
    var now = new Date(), tk = todayKey(), dk = CAL_DAYS[now.getDay()][0];
    /* Tonight is the day's dinner-section recipe or, failing one, whatever
       is planned: a recipe of your own, or a breakfast for dinner, was on
       the Plan grid and not on Today at all. */
    var dinnerOf = function (key) {
      var all = window.Store.day(key).filter(function (e) { return BY_ID[e.id]; });
      return all.filter(function (e) { return pwIsDinner(BY_ID[e.id]); })[0] || all[0] || null;
    };
    var t = dinnerOf(dk), r = t && BY_ID[t.id];
    var next = CAL_DAYS.slice(now.getDay() + 1).map(function (d) {
      var e = dinnerOf(d[0]);
      return e ? { day: d[1], name: e.lo ? 'leftovers' : BY_ID[e.id].name } : null;
    }).filter(Boolean).slice(0, 2);
    var T = mReadTargets(), set = kcalOf(T) > 0, want = set ? mDayTargets(tk) : null, tot = mTotals(mDay(tk));
    var built = buildList(planEntries()), buy = [], items = 0, nSrc = 0;
    built.groups.forEach(function (g) {
      items += g.items.length;
      if (g.src === 'b') buy = g.items;
      if (g.src === 's') nSrc = g.items.length;
    });
    var left = buy.filter(function (b) { return !window.Store.isChecked(b.key); });
    var wl = canBuy() && left.length ? window.Walmart.lines(left) : null;
    return {
      date: now,
      help: window.Door ? window.Door.help() : { d: true, e: true, w: true },
      tonight: t ? { id: String(t.id), day: dk, name: r.name, time: r.time || '', x: t.x, lo: !!t.lo, twin: !!planTwin(t.id, dk),
        cooked: window.Store.cooked(dk), rating: window.Store.rating(t.id), plate: t.lo ? null : tonightPlate(t.id, tk) } : null,
      weigh: set ? todayWeigh(tk) : null,
      next: next,
      planned: CAL_DAYS.some(function (d) { return !!dinnerOf(d[0]); }),
      eating: set ? {
        set: true, key: tk, target: kcalOf(T), training: mIsTrainingDay(tk),
        kcal: { have: tot.eaten.kcal, want: kcalOf(want) }, p: { have: tot.eaten.p, want: want.p },
        room: tot.all.kcal < kcalOf(want) * 0.9, meals: todayMeals(tk)
      } : { set: false },
      shop: { items: items, buy: left.length, usd: listUsd(built), src: nSrc, srcName: srcW().the,
        wm: wl && wl.cart.length ? { href: window.Walmart.url(wl.cart), n: wl.cart.length } : null },
      wmMark: window.Walmart.mark,
      week: CAL_DAYS.map(function (d, i) {
        var dt = calDate(d[0]);
        return { key: d[0], dow: i, letter: d[2].charAt(0), date: dt ? dt.getDate() : '', tk: dt ? dayKey(dt) : '',
          dinner: !!dinnerOf(d[0]), past: calPastDay(d[0]), today: calIsToday(d[0]) };
      })
    };
  }

  // ------------------------------------------------------------ Today's sheets
  /* Today does; Nourish tunes. A meal, or tonight's dinner once cooked,
     tapped on Today opens a small sheet over it, and every row is Nourish's
     or Plan's own function, on today. */
  function tdSheetOpen(o) {
    S.tdSheet = o;
    pushSheet({ td: 1 });
    renderModal();
    var x = document.querySelector('#modalRoot .sheet-x');
    if (x) x.focus();
  }
  function tdItems(sk) { return (mDay(todayKey())[sk] || []).filter(function (it) { return BY_ID[it.id] && BY_ID[it.id].macro; }); }
  function tdRow(act, t, sub, cls) {
    return '<button class="dsh-row' + (cls ? ' ' + cls : '') + '" data-tdact="' + act + '"><span><b>' + t + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span></button>';
  }
  function tdSheetHTML() {
    var T = S.tdSheet, body, kick;
    if (T.k === 'rate') {
      var r = BY_ID[T.id];
      if (!r) return '';
      var rt = window.Store.rating(T.id), ate = false, dd = mDay(T.tk);
      Object.keys(dd).forEach(function (sk) { (dd[sk] || []).forEach(function (it) { if (String(it.id) === String(T.id) && it.eaten) ate = true; }); });
      kick = 'Dinner cooked';
      body = '<h2 class="dsh-h">' + esc(r.name) + '</h2>' +
        (ate ? '<p class="dsh-m">Your dinner is ticked eaten in Nourish.</p>' : '') +
        '<div class="dsh-rl">How was it?</div><div class="td-rates" role="group" aria-label="How was it?">' +
        [[2, '\u2605', 'Favourite'], [1, '\ud83d\udc4d', 'Good'], [-1, '\ud83d\udc4e', 'Not again']].map(function (o) {
          return '<button class="td-rate" data-tdrate="' + o[0] + '" aria-pressed="' + (rt === o[0]) + '"><span aria-hidden="true">' + o[1] + '</span>' + o[2] + '</button>';
        }).join('') + '</div>' +
        '<p class="pw-note">Favourites come back more often in Plan my week; Not again never does.</p>' +
        (window.Store.house ? '<p class="td-shared">Your household sees \u201cDinner cooked\u201d on their Today too.</p>' : '') +
        '<div class="dsh-rows">' + tdRow('uncook', 'Not cooked after all', '') + '</div>' +
        '<button class="btn-primary td-done-btn" data-close="1">Done</button>';
    } else {
      var slot = mReadSlots().list.filter(function (sl) { return sl.k === T.sk; })[0] || { n: 'Meal' };
      var its = tdItems(T.sk), one = {}; one[T.sk] = its;
      var tot = mTotals(one).all, single = its.length === 1 ? its[0] : null;
      var allEaten = its.length && its.every(function (it) { return it.eaten; });
      kick = slot.n;
      body = its.length ? '<h2 class="dsh-h">' + esc(its.map(function (it) { return BY_ID[it.id].name; }).join(', ')) + '</h2>' +
        '<p class="dsh-m">' + Math.round(tot.kcal).toLocaleString('en-US') + ' cal \u00b7 ' + Math.round(tot.p) + ' g protein' +
          (single ? ' \u00b7 ' + fmtNum(single.x) + (single.x === 1 ? ' serving' : ' servings') : '') + '</p>' +
        '<div class="dsh-rows">' +
          (allEaten ? tdRow('uneat', 'Not eaten after all', 'Unticks it in Nourish too') : tdRow('eat', 'I ate it', 'Ticks it in Nourish too', 'dsh-main')) +
          (single && !single.eaten ? '<div class="dsh-row td-steprow"><span><b>A bit more or less</b><small>Your numbers follow</small></span>' +
            '<span class="td-step"><button data-tdstep="-1" aria-label="Less">\u2212</button><b>' + fmtNum(single.x) + '</b><button data-tdstep="1" aria-label="More">+</button></span></div>' : '') +
          (allEaten ? '' : tdRow('swap', 'Swap for another that fits', 'Near the same calories and protein')) +
          tdRow('else', 'I ate something else', 'Search the food list, or build it') +
          (single ? tdRow('recipe', 'Open the recipe', '') : '') +
          tdRow('nourish', 'Open the day in Nourish', 'Portions, shares, Fill, your plan') +
        '</div>'
        : '<h2 class="dsh-h">Nothing planned for ' + esc(slot.n.toLowerCase()) + '</h2><div class="dsh-rows">' +
          tdRow('else', 'Add food', 'Search the food list, or build it', 'dsh-main') +
          tdRow('nourish', 'Open the day in Nourish', 'Fill it there, to your numbers') + '</div>';
    }
    return '<div class="scrim no-print" data-close="1">' +
      '<div class="sheet ds-sheet dsh-sheet td-sheet" role="dialog" aria-modal="true" aria-label="' + esc(kick) + '">' +
        '<div class="sheet-top"><div class="sheet-eyebrow">' + esc(kick) + '</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button></div>' +
        '<div class="dsh-body">' + body + '</div></div></div>';
  }
  document.addEventListener('click', function (e) {
    if (!S.tdSheet || S.openId || !e.target.closest) return;
    var T = S.tdSheet, rt = e.target.closest('[data-tdrate]');
    if (rt) {
      var v = Number(rt.dataset.tdrate);
      window.Store.setRating(T.id, window.Store.rating(T.id) === v ? 0 : v);
      renderModal();
      return;
    }
    var stp = e.target.closest('[data-tdstep]');
    if (stp) {
      mEditDay(todayKey(), function (day) {
        var it = (day[T.sk] || []).filter(function (x) { return BY_ID[x.id] && BY_ID[x.id].macro; })[0];
        if (it && !it.eaten) it.x = mStepX(BY_ID[it.id], it.x, Number(stp.dataset.tdstep));
      });
      renderModal();
      return;
    }
    var b = e.target.closest('[data-tdact]');
    if (!b) return;
    var act = b.dataset.tdact;
    if (act === 'uncook') { window.Store.setCooked(T.day, false); close(); return; }
    if (act === 'eat' || act === 'uneat') {
      mEditDay(todayKey(), function (day) { (day[T.sk] || []).forEach(function (it) { it.eaten = act === 'eat' ? 1 : 0; }); });
      close();
      return;
    }
    if (act === 'swap') { S.macroDate = null; mTryAgain(T.sk); renderModal(); return; }
    if (act === 'else') { S.macroDate = null; var sk = T.sk; S.tdSheet = null; S.mpFromBar = false; mOpenPicker(sk, 'home'); return; }
    if (act === 'recipe') { var one = tdItems(T.sk)[0]; if (one) { rememberOpener(); openRecipe(idOf(one.id)); } return; }
    if (act === 'nourish') { close(); S.macroDate = null; goView('macros'); }
  });

  window.Hive = {
    /* Today's reading of the app, and its doors back into it. */
    today: todayData,
    /* Today is about today: a door from it into Nourish opens on today,
       not on the day Nourish was left parked on — Add food from Today
       was adding to Sep 30 while the card went on saying nothing planned. */
    go: function (v) { if (v === 'macros') S.macroDate = null; goView(v); },
    open: function (id) { rememberOpener(); openRecipe(idOf(id)); },
    swap: function (id, day) { planSwap(idOf(id), day); },
    planWeek: function () { goView('plan'); pwOpen(); },
    addTonight: function () { goView('plan'); rememberOpener(); addOpen(CAL_DAYS[new Date().getDay()][0]); },
    addFood: function () { S.macroDate = null; goView('macros'); var b = $('macroAdd'); if (b) b.click(); },
    /* Nourish on today (not whichever day it was last left on), and its own
       answer to whether today can be filled, then its own Fill. */
    fill: function () {
      S.macroDate = null;
      goView('macros');
      var b = $('macroFill');
      if (b && b.dataset.mode === 'fill' && !b.disabled) mFillDay();
    },
    numbers: function () { S.macroDate = null; goView('macros'); mOpenTargets(); },
    /* The front door's answers (src/door.js), each to what owns it: the
       household's staples switches, as Where sets them, and Plan my week's
       "how many are eating"; Nourish's goal; Nourish's numbers sheet. */
    kitchen: function (ppl, kind) {
      setSrcKind(kind, function () { window.Store.setOpt('setup', true); });
      var a = pwAnswers();
      a.ppl = ppl;
      pwSave(a);
    },
    goal: function (g) {
      if (!MGOAL_WORDS[g]) return;
      var pr = mReadProfileRaw();
      pr.goal = g;
      mWriteProfile(pr);
    },
    numbersSetup: function () { S.macroDate = null; goView('macros'); mOpenTargets(); },
    /* Tonight's dinner, cooked: said for the household (Store.setCooked),
       your own plate of it ticked eaten in Nourish, and asked how it was. */
    cooked: function (id, day, tk) {
      var k = /^\d{4}-\d{2}-\d{2}$/.test(tk || '') ? tk : todayKey();
      window.Store.setCooked(day, true);
      mEditDay(k, function (d) {
        Object.keys(d).forEach(function (sk) { (d[sk] || []).forEach(function (it) { if (String(it.id) === String(id)) it.eaten = 1; }); });
      });
      tdSheetOpen({ k: 'rate', id: idOf(id), day: day, tk: k });
    },
    rate: function (id, day) { tdSheetOpen({ k: 'rate', id: idOf(id), day: day, tk: todayKey() }); },
    meal: function (sk) { S.macroDate = null; tdSheetOpen({ k: 'meal', sk: sk }); },
    // the weigh-in sheet on Today (Hive.weigh is the write, used by Strengthen)
    weighOpen: function () { if (WGAPI.open) WGAPI.open(); },
    /* A meal ticked on Today: everything on it eaten, as its boxes on the
       Nourish day would be. `tk` is the day the card was drawn for: past
       midnight on a card nobody had redrawn, the tick went to a day with no
       dinner on it and did nothing. */
    eat: function (sk, tk) {
      mEditDay(/^\d{4}-\d{2}-\d{2}$/.test(tk || '') ? tk : todayKey(), function (day) { (day[sk] || []).forEach(function (it) { it.eaten = 1; }); });
      if (S.view === 'today' && window.Today) window.Today.render();
    },
    ask: ask,
    openSheet: function () { pushSheet({ tr: 1 }); },
    closeSheet: function () { close(); },
    /* Where the account stands, for Strengthen's own line about it. With no
       document to write to it could only say "Only on this phone. Sign in
       under Nourish", which a signed-in phone with no signal is not:
         'on'          attached to the account
         'connecting'  an account is remembered and its answer is pending
         'offline'     an account is remembered and the server is out of reach
         'signedout'   nobody is signed in on this device */
    syncState: function () {
      if (mAccount() && mSyncDoc) return S_SYNC_STATE === 'error' ? 'offline' : 'on';
      if (mSyncAway()) return 'offline';
      if (mSuspectAccount() && (!mAuthKnown || mAccount())) return 'connecting';
      return 'signedout';
    },
    /* A workout saved. Nothing is copied: whether a day was trained is read
       from Strengthen's own log when Nourish asks (mIsTrainingDay), so a
       workout deleted or moved to another day takes its training day with
       it. What is written is the day's target, whichever tab is showing. */
    trained: function (k) {
      mCreditDay(k);
      if (S.view === 'macros') renderMacros();
    },
    /* Nourish's own days, for Strengthen to start its picker from. */
    trainDays: function () { return mTrainDaysOwn(); },
    /* How far under maintenance you are eating, for Strengthen's weekly
       climb: calories a day, and what that comes to a week as a share of
       what you weigh (positive is losing).
     *
       What you actually ate these two weeks, once seven of them are logged
       and your burn has been measured from the same logs: a snack never
       written down then counts on both sides and cancels. Until then, the
       target you are eating to, against the burn Nourish plans by. Null
       with neither. */
    phase: function () {
      var pr = mReadProfile();
      var tdee = mTdee(pr);
      if (!(pr.lb > 0) || tdee === null) return null;
      var meas = mMeasuredTdee();
      var from = new Date(); from.setDate(from.getDate() - 14);
      var fromK = dayKey(from), today = todayKey();
      var ks = Object.keys(MINTAKE).filter(function (k) { return k >= fromK && k < today && MINTAKE[k] > 0; });
      var ate = meas && ks.length >= 7 ? ks.reduce(function (s0, k) { return s0 + MINTAKE[k]; }, 0) / ks.length : null;
      var target = kcalOf(mReadTargets());
      if (ate === null && !target) return null;
      var under = Math.round(ate !== null ? meas.tdee - ate : tdee - target);
      return { kcal: under, rate: Math.round(under * 7 / 3500 / pr.lb * 10000) / 10000,
        src: ate !== null ? 'ate' : 'plan', days: ks.length };
    },
    /* The last seven days as Nourish saw them, for the weekly check-in both
       tabs open: the seven before today, since today is not over.
     *
       Weight is the week's average against the week before's, a morning on
       its own being mostly water. Calories are what was eaten on the days
       logged, the same count the measured burn is built on, against each
       day's own target. Protein is hit at nine-tenths of the day's target.
       Maintenance is the burn measured from your logs when there is one,
       the estimate otherwise, and says which. Null with nothing at all. */
    week: function () {
      var keyAgo = function (n) { var d = new Date(); d.setDate(d.getDate() - n); return dayKey(d); };
      var wk = [], pw = [], i;
      for (i = 7; i >= 1; i--) wk.push(keyAgo(i));
      for (i = 14; i >= 8; i--) pw.push(keyAgo(i));
      var avgOf = function (ks) {
        var v = ks.map(function (k) { return MWEIGHTS[k]; }).filter(function (x) { return x > 0; });
        return { n: v.length, avg: v.length ? Math.round(v.reduce(function (s0, x) { return s0 + x; }, 0) / v.length * 10) / 10 : null };
      };
      var now = avgOf(wk), was = avgOf(pw);
      var f = { days: 0, kcal: 0, tk: 0, tn: 0, p: 0, tp: 0, hit: 0, pDays: 0, pd: [] };
      mLogIntake();
      wk.forEach(function (k) {
        var kc = MINTAKE[k];
        if (!(kc > 0)) return;
        var t = mDayTargets(k), tk = kcalOf(t);
        f.days++; f.kcal += kc;
        if (tk > 0) { f.tk += tk; f.tn++; }
        var day = MDAYS[k];
        if (day && t.p > 0) {
          var tot = mTotals(day), got = (mDoneAt(k) ? tot.all : tot.eaten).p;
          f.pDays++; f.p += got; f.tp += t.p;
          if (got >= 0.9 * t.p) f.hit++;
          f.pd.push(got >= 0.9 * t.p ? 1 : 0);
        }
      });
      if (!now.n && !was.n && !f.days) return null;
      var pr = mReadProfile(), meas = mMeasuredTdee(), tdee = mTdee(pr), base = kcalOf(mReadTargets());
      return {
        from: wk[0], to: wk[6], lb: pr.lb > 0 ? pr.lb : null,
        w: { now: now.avg, n: now.n, was: was.avg, m: was.n },
        days: f.days, kcal: f.days ? Math.round(f.kcal / f.days) : null,
        target: f.tn ? Math.round(f.tk / f.tn) : base || null,
        p: f.pDays ? Math.round(f.p / f.pDays) : null, tp: f.pDays ? Math.round(f.tp / f.pDays) : null,
        // a day each, oldest first: 1 where protein reached nine-tenths of target
        hit: f.hit, pDays: f.pDays, pd: f.pd,
        maint: meas ? meas.tdee : tdee !== null ? Math.round(tdee) : null, measured: !!meas,
        // the pace the plan is built for, as a share of your weight a week; positive is losing
        plan: tdee !== null && base && pr.lb > 0 ? Math.round((tdee - base) * 7 / 3500 / pr.lb * 10000) / 10000 : null
      };
    },
    daysMoved: function () {
      /* Strengthen's list as Strengthen now has it. This read mTrainDays(),
         which falls back to the profile's copy when Strengthen's list is
         empty — so days cleared there were read back from the profile and
         written straight into it again. None picked is an answer. */
      var ld = null;
      try { ld = window.Train && window.Train.liftDays ? window.Train.liftDays() : null; } catch (e) { /* Strengthen is not up */ }
      var pr = mReadProfile();
      var days = (ld || []).filter(function (n) { return n >= 0 && n <= 6; });
      if (Number(pr.workouts) !== days.length || JSON.stringify(pr.train) !== JSON.stringify(days)) {
        pr.workouts = days.length; pr.train = days; mWriteProfile(pr);
      }
      mDaysChanged();
      if (S.view === 'macros') renderMacros();
    },
    /* A weigh-in from Strengthen, which asks for one on a pull-up day with
       nothing better to go on. The box on Nourish's guard: a weight far from
       your own average, or from any adult's, comes back to be confirmed
       rather than written. It never writes over a day already weighed,
       except to correct the number Strengthen itself put there (o.was). */
    weigh: function (k, lb, o) {
      o = o || {};
      var n = Math.round(Number(lb) * 10) / 10;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(k)) || !isFinite(n) || n <= 0 || n > 1500) return { ok: false, bad: true };
      if (MWEIGHTS[k] && MWEIGHTS[k] !== o.was) return { ok: false, had: MWEIGHTS[k] };
      var st = mWeightStats(), ref = st && st.n >= 3 ? st.avg7 : 0;
      if (!o.force && (n < 60 || n > 700 || (ref > 0 && Math.abs(n - ref) > ref * 0.15))) {
        return { ok: false, odd: true, ref: Math.round(ref * 10) / 10 };
      }
      mWriteWeight(k, n);
      if (S.view === 'macros') renderMacros();
      return { ok: true, lb: n };
    }
  };

  // ------------------------------------------------------------------- boot
  renderSections();
  /* Before the first paint: a stored plan written by an older build can be
     below this body's floor or have no carbohydrate in it, and the correction
     belongs here rather than inside whichever read happened to run first. */
  /* An i or a "why?" opens its words in place and closes them again, with
     no redraw, so nothing moves but the words. */
  document.addEventListener('click', function (e) {
    var ib = e.target.closest && e.target.closest('[data-minfo]');
    if (!ib) return;
    var key = ib.dataset.minfo, open = !MINFO[key];
    MINFO[key] = open;
    document.querySelectorAll('[data-minfo="' + key + '"]').forEach(function (b) {
      b.setAttribute('aria-expanded', String(open));
    });
    var tx = document.getElementById('mi-' + key);
    if (tx) tx.hidden = !open;
  });
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
  // before anything can have something to say: see mToastEls
  mToastEls();
  wire();
  window.Store.init(function () { renderAll(); mHouseWatch(); mJoinBack(); mHouseNotices(); dinerWatch(); });
  renderAll();
})();
