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

  var BASE = window.RECIPES || [];    // the 266 in the two printed books
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
  }

  var DAYS = [
    ['mon', 'Monday', 'Mon'], ['tue', 'Tuesday', 'Tue'], ['wed', 'Wednesday', 'Wed'],
    ['thu', 'Thursday', 'Thu'], ['fri', 'Friday', 'Fri'], ['sat', 'Saturday', 'Sat'],
    ['sun', 'Sunday', 'Sun']
  ];

  var BOOKS = {
    1: {
      /* Doctrine and Covenants 89:20 — the Word of Wisdom's own promise, and the
         only name on the shelf where the title and the food make the same claim.
         What protein and fiber buy you is the afternoon. */
      name: 'Run and Not Be Weary', short: 'RUN',
      blurb: 'One hundred recipes built on protein, fiber and staying full, with primary ingredients from the Bishops’\u00a0Storehouse. Every one carries real macros and a computed nutrition score.',
      epigraph: {
        t: ['And shall run and not be weary,', 'and shall walk and not faint.'],
        r: 'Doctrine and Covenants 89:20',
      },
    },
    2: {
      name: 'Around the Table', short: 'TABLE',
      blurb: 'One hundred sixty‑six family recipes with primary ingredients from the Bishops’\u00a0Storehouse: three‑minute breakfasts to Sunday roasts, by way of an afternoon at the stove, the restaurant favourites worked out at home, and a section for chocolate alone.',
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

  /* The combined edition. Not a fourth volume — the same 266 recipes as one
     object, for anyone spiral-binding them rather than folding two booklets.
     It needs its own cover copy because every word of Volume One's is about
     being one of two. */
  var ONE_BOOK = {
    name: APP_NAME + ' ' + APP_LINE,
    blurb: 'Two hundred and sixty-six recipes with primary ingredients from the Bishops\u2019\u00a0Storehouse, ' +
      'in two parts: a hundred built on protein and fiber, and a hundred and sixty-six for the family table.',
    epigraph: {
      t: ['And shall run and not be weary,', 'and shall walk and not faint.'],
      r: 'Doctrine and Covenants 89:20',
    },
  };

  /* And the same courtesy for the view that is not a book. Someone opening the
     app for the first time lands here, and until this line existed the whole
     answer to "what are the two volumes" was the words "two volumes" in the
     bar at the top. */
  var COLLECTION_BLURB = 'Two volumes, with primary ingredients from the Bishops’\u00a0Storehouse. Run and ' +
    'Not Be Weary is a hundred recipes built on protein and fiber; Around the Table is a hundred and ' +
    'sixty-six family recipes, from three-minute breakfasts to Sunday roasts.';

  /* What the section picker calls each section. The full names are written
     for a printed contents page, where "Low-Calorie Cut Snacks & Late-Night
     Treats" has a line to itself and room to spare. In a native picker on a
     phone they wrap to two lines each and twelve of them becomes a wall you
     have to read rather than scan. These are for the picker alone — the book,
     the headings and the section pages all keep the full name. */
  var SEC_SHORT = {
    '1-1': 'Zero-Cook', '1-2': 'Morning Brews', '1-3': 'Batch Preps', '1-4': 'Cut Snacks',
    '2-1': 'Weekday Breakfasts', '2-2': 'Lunches & Wraps', '2-3': 'Weeknight Dinners',
    '2-4': 'Sunday Feasts', '2-5': 'Treats & Desserts', '2-6': 'Worth the Afternoon',
    '2-7': 'The Copycat Shelf', '2-8': 'Chocolate', '2-9': 'Warm Drinks',
    '2-10': 'Made, Not Bought'
  };

  var SEC_NOTE = {
    '1-1': 'Nothing to cook. Open, assemble, eat.',
    '1-2': 'Breakfasts that hold you until noon.',
    '1-3': 'Cook once on Sunday, eat all week.',
    '1-4': 'Late evening, low calorie, still satisfying.',
    '2-1': 'Weekday mornings, on the clock.',
    '2-2': 'Lunches, wraps, and the after‑school hour.',
    '2-3': 'Weeknight dinners the children will actually finish.',
    '2-4': 'Sunday, when there is time to do it properly.',
    '2-5': 'Sweets, made from what is on the shelf.',
    '2-6': 'Nothing quick here. Bread that rises, gravy that thickens, custard that sets.',
    '2-7': 'The restaurant version, worked out at home.',
    '2-8': 'For when only chocolate will do.',
    '2-9': 'A mug of something warm, with the protein of a small meal.',
    '2-10': 'The three bottles the storehouse does not carry, made from what it does.'
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
   * across the 266, so the bands divide the collection rather than flattering
   * it. Drawn rather than set in a font so it prints as a shape at any size.
   */
  function scoreBand(n) { return n >= 70 ? 'good' : n >= 45 ? 'ok' : 'low'; }

  function leaf(n, cls) {
    if (n === null || n === undefined) return '';
    return '<span class="leaf leaf-' + scoreBand(n) + (cls ? ' ' + cls : '') + '" ' +
      'title="Nutrition score ' + n + ' out of 100">' +
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
    head: 'heads', bunch: 'bunches', link: 'links', spear: 'spears', lb: 'lbs', box: 'boxes'
  };
  var SINGULAR = {};
  Object.keys(PLURAL).forEach(function (k) { SINGULAR[PLURAL[k]] = k; });

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
     ingp runs parallel to ing across all 266 recipes; the tests hold that.

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
    view: 'browse', bookF: 'all', secF: 'all', diffF: 'all', pantryF: 'all',
    favOnly: false, qy: '', sort: 'book', openId: null, scale: 1, printSet: 'all',
    /* Cups or grams. Persisted on the device rather than shared, because it is
       a preference about reading, not about the plan — one of you can cook by
       weight while the other cooks by cup without either overruling the other. */
    units: (function () {
      try { return localStorage.getItem('sh.units') === 'grams' ? 'grams' : 'cups'; }
      catch (e) { return 'cups'; }
    })(),
    syncOpen: false, pendingCode: '', joinDraft: '', why: false
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
    $('printOurs').classList.toggle('hide', !n);
    $('printOurs').textContent = 'Ours — ' + n + (n === 1 ? ' recipe' : ' recipes');
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
      : (BOOKS[S.bookF] ? BOOKS[S.bookF].blurb : COLLECTION_BLURB);
    /* Say how many are here on their own merits and how many arrived because
       their section is named for the search. Without it, "breakfast" returning
       fifty recipes reads as fifty breakfasts, and the reader scrolls looking
       for the mistake. */
    var loose = qs ? list.filter(function (r) { return matchRank(r, qs) === 1; }).length : 0;
    $('browseCount').textContent = list.length + (list.length === 1 ? ' recipe' : ' recipes') +
      (loose ? ' · ' + (list.length - loose) + ' matching, ' + loose + ' more from sections named for it'
             : (order[S.sort] || ''));
    $('browseEmpty').classList.toggle('hide', list.length !== 0);

    $('grid').innerHTML = list.map(function (r) {
      var fav = window.Store.isFav(r.id);
      var chip = r.score === null
        ? '<span class="chip plain">' + esc(diffLabel(r.diff)) + '</span>'
        : leaf(r.score);
      /* esc, like every other interpolation on this card. A recipe id is
         generated locally and is safe — but a recipe arriving from the shared
         household document was typed by somebody else, and the whole point of
         a household is that it holds other people's writing. */
      return '<button class="card" data-open="' + esc(r.id) + '">' +
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

    var opt = $('printSet').querySelector('option[value="plan"]');
    if (opt) opt.textContent = active.name + ' — ' + planIds().length +
      (planIds().length === 1 ? ' recipe' : ' recipes');
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
        // seasonings share one food key, so they go by their own name instead
        var key = s.s ? it.a : it.k;
        if (!bucket[key]) {
          bucket[key] = {
            key: key, extra: true, g: 0,
            unit: s.u, per: s.p, lad: s.d,
            label: s.s ? it.a.charAt(0).toUpperCase() + it.a.slice(1) : s.l
          };
        }
        /* One line per thing, and the pantry decides which heading it falls
           under. This used to be decided per-recipe, so a recipe that called
           chocolate chips an extra and one that did not put them on the list
           twice. Asking the shelf instead makes that impossible rather than
           merely corrected. */
        bucket[key].extra = !inPantry(it.k);
        bucket[key].g += it.g * e.x;
      });
    });
    var group = function (title, wantExtra) {
      var items = Object.keys(bucket).map(function (k) { return bucket[k]; })
        .filter(function (b) { return b.extra === wantExtra; })
        .sort(function (a, b) { return a.label.localeCompare(b.label); });
      items.forEach(function (b) {
        b.qty = shopQty(b.g, b.unit, b.per, b.lad);
        b.key = (b.extra ? 'extra|' : 'base|') + b.key;
      });
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
          return '<div class="bc-row"><span class="bc-no">' + s.num + '</span>' +
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

  function missingFor(r) {
    var out = [], seen = {};
    (r.ingp || []).forEach(function (it) {
      /* A `free` line is a seasoning priced at nothing. Most are the salt and
         pepper and cinnamon the storehouse carries, and those are rightly
         silent — but `x` marks the ones it does not, and those were being
         skipped with the rest. Thirty-one recipes needed paprika or cumin or a
         sweetener from a shop while the card under them read "All storehouse
         items", which is the one line on a card that has to be true. */
      if (it.k === 'free') {
        if (!it.x) return;
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
    var it = (r.ingp || [])[ix];
    return !!it && it.k !== 'free' && it.k !== 'water' && !inPantry(it.k);
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
              esc(i) + '</div>';
          }).join('') +
        '</div></div>' +
        '<div><div class="rp-h">Method</div><div class="rp-steps">' +
          r.steps.map(function (t, i) {
            return '<div class="rp-step"><div class="rp-step-n">' + (i + 1) + '</div>' +
              '<div class="rp-step-t">' + esc(t) + '</div></div>';
          }).join('') +
        '</div></div>' +
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
        'serving count, a time, an effort and a score out of 100. Calories, sodium and fiber are worked ' +
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
      '<div class="fm-lede">Primary ingredients come from the Bishops’&nbsp;Storehouse order.</div>');
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
      '<div class="fm-p">Servings, time, effort, and a nutrition score out of 100. Five things make it up: ' +
      'how much of the energy comes from protein (30 points, full marks at 45%), how many calories a ' +
      'serving carries (20, full marks up to 300), how much of the energy comes from fat (10, full marks ' +
      'at or below a tenth), how much sodium a serving carries (25, full marks to 300 mg and nothing left ' +
      'by 1,200), and how much fiber (15, full marks at 7 g).</div>' +
      '<div class="fm-p">Sodium and fiber are worked out from the ingredients rather than measured, in ' +
      'both volumes. Canned goods carry the salt; that is most of what the sodium figure is telling you.</div>' +
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
      var sub = vol.single ? ONE_BOOK.blurb
        : vol.grouped ? (S.printSet === 'fav' ? 'The ones worth keeping.' : 'The week’s cooking, in order.')
        : BOOKS[vol.book].blurb;
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
   * be handed something it cannot solve: two of the 266 recipes are taller on
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
  function fitToPaper() {
    var PAPER = 7.5 * 96;
    var squeezed = [];
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
        z = Math.max(0.85, z * ((room / h) - 0.004));
        flow.style.zoom = z;
      }
      if (z !== 1) squeezed.push({ page: i + 1, zoom: Math.round(z * 1000) / 1000 });
    });
    if (hadScale) root.style.setProperty('--pgscale', hadScale);
    else root.style.removeProperty('--pgscale');
    if (squeezed.length && window.console) {
      console.log('set slightly smaller to fit the page: ' +
        squeezed.map(function (s) { return 'p' + s.page + ' at ' + s.zoom; }).join(', '));
    }
    return squeezed;
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
    fitToPaper();
    fitPages();
    if (window.console && performance.now() - t0 > 1200) {
      console.log('book render took ' + Math.round(performance.now() - t0) + 'ms');
    }
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
    all: { file: 'Both-Books.pdf', label: 'Both books', pages: 168 },
    one: { file: 'Hive-and-Hearth-Recipes.pdf', label: 'One book', pages: 160 },
    1: { file: 'Run-and-Not-Be-Weary.pdf', label: 'Run and Not Be Weary', pages: 52, booklet: true },
    2: { file: 'Around-the-Table.pdf', label: 'Around the Table', pages: 116, booklet: true }
  };

  function renderDownloads() {
    var r = READY_MADE[S.printSet];
    var dl = $('dlBook'), bk = $('dlBooklet');
    /* Only where it makes sense to offer. Somebody printing Favorites or this
       week's plan is printing four pages for the fridge, and being asked fifty
       dollars for a bound book at that moment reads as not paying attention. */
    $('orderBook').classList.toggle('hide',
      S.printSet !== 'one' && S.printSet !== 'all' && S.printSet !== '1' && S.printSet !== '2');
    dl.classList.toggle('hide', !r);
    bk.classList.toggle('hide', !(r && r.booklet));
    if (!r) return;
    dl.href = 'print/' + r.file;
    dl.textContent = 'Download PDF · ' + r.pages + ' pages';
    if (r.booklet) {
      bk.href = 'print/' + r.file.replace(/\.pdf$/, '-booklet.pdf');
      bk.textContent = 'Booklet PDF · ' + (r.pages / 4) + ' sheets';
    }
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
  function scoreParts(r) {
    return [
      { k: 'Protein', ab: 'Prot', v: r.sc.pPct + '%', p: r.sc.p, max: 30, t: r.sc.pPct + '% of the calories come from protein' },
      { k: 'Calories', ab: 'Cal', v: r.macro.kcal, p: r.sc.k, max: 20, t: r.macro.kcal + ' kcal a serving' },
      { k: 'Fat', ab: 'Fat', v: r.sc.fPct + '%', p: r.sc.f, max: 10, t: r.sc.fPct + '% of the calories come from fat' },
      { k: 'Sodium', ab: 'Sod', v: r.sc.na + ' mg', p: r.sc.s, max: 25, t: r.sc.na + ' mg of sodium a serving' },
      { k: 'Fiber', ab: 'Fib', v: r.sc.fib + ' g', p: r.sc.b, max: 15, t: r.sc.fib + ' g of fiber a serving' }
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
       points the recipe earned, so five rows can be compared straight down the
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
          '<div class="why-note">Protein and fiber earn points. Calories, fat and ' +
            'sodium spend them. Every figure is an estimate from a food table, ' +
            'not a label.</div>' +
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

  function renderModal() {
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
    var r = S.openId ? BY_ID[S.openId] : null;
    if (!r) { root.innerHTML = ''; document.body.style.overflow = ''; return; }
    document.body.style.overflow = 'hidden';

    var f = S.scale;
    var fav = window.Store.isFav(r.id);
    var scaleLabel = f === 1 ? '1×' : f < 1 ? fmtNum(f) + '×' : f + '×';

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
              : scaleIng(i, f)) + '</div>';
        }).join('') + '</div>' +
        '<div class="sheet-h" style="margin-top:24px;margin-bottom:10px">Method</div>' +
        '<div class="sheet-steps">' + r.steps.map(function (t, i) {
          return '<div class="sheet-step"><div class="sheet-step-n">' + (i + 1) + '</div>' +
            '<div class="sheet-step-t">' + esc(t) + '</div></div>';
        }).join('') + '</div>' +
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
          '<button class="iconbtn" data-fav="' + r.id + '" aria-pressed="' + fav + '" ' +
            'title="' + (fav ? 'Saved to favorites' : 'Save to favorites') + '" ' +
            'aria-label="' + (fav ? 'Saved to favorites' : 'Save to favorites') + '">' +
            (fav ? '★' : '☆') + '</button>' +
          '<button class="iconbtn" data-edit="' + r.id + '" title="Edit this recipe" ' +
            'aria-label="Edit this recipe">✎</button>' +
          '<span class="addto">Add to</span>' +
          /* Seven equal columns rather than seven things that wrap. A week that
             breaks across two lines reads as two groups of days, and which days
             land together depends on the width of the phone. */
          '<div class="daybar">' +
            DAYS.map(function (d) {
              var on = window.Store.day(d[0]).some(function (e) { return e.id === r.id; });
              return '<button class="daybtn" data-add="' + r.id + '" data-day="' + d[0] +
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
      ok: opts.ok || 'OK', danger: !!opts.danger, done: done };
    renderDialog();
  }

  function closeDialog(answer) {
    var d = D;
    D = null;
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
    if (what === 'cancel') { S.editId = null; S.editBase = null; renderModal(); return; }

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
    S.editId = id;
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
    var label = !configured ? 'Not set up — saving on this device only'
      : st === 'synced' ? 'The other phones have everything this one has' +
          (ago ? ' — confirmed ' + ago : '')
        : st === 'connecting' ? 'Joined. Waiting to hear back from the server…'
          : st === 'sending' ? 'Sending a change — it has not reached the others yet'
            : st === 'waiting' ? 'No signal. Everything here has been sent' +
                (ago ? ', last confirmed ' + ago : '') + '. You may not have their latest yet.'
              : st === 'error' ? 'Sharing has stopped' : 'Saving on this device only';

    var body;
    if (!configured) {
      body = '<p class="sync-p">Right now your favorites, your weeks and their shopping lists save ' +
        'on <strong>this device only</strong>. Nothing is shared, and nothing leaves the browser.</p>' +
        '<p class="sync-p">To share one plan between your phones, follow <strong>SETUP.md</strong> in ' +
        'the project: create a free Firebase project, paste six values into <code>src/config.js</code>, ' +
        'and this panel will let you make a household code.</p>';
    } else if (!house) {
      body = '<p class="sync-p">Type the same household code on every phone you want on the list, and they ' +
        'share the same weeks, the same favorites and the same shopping list. Tick something off in the ' +
        'store and it greys out on the others. Two phones or six &mdash; there is no limit, and no ' +
        'accounts to make.</p>' +
        '<div class="sync-code" id="newCode">' + esc(S.pendingCode) + '</div>' +
        '<div class="sync-row">' +
          '<button class="btn-primary" data-sync="use">Use this code</button>' +
          '<button class="ghost" data-sync="reroll">Give me another</button>' +
        '</div>' +
        '<div class="sync-row">' +
          '<input class="txt" id="joinCode" placeholder="Or type a code you already have" aria-label="Household code">' +
          '<button class="ghost" data-sync="join">Join</button>' +
        '</div>' +
        /* Worth saying, because the honest answer used to be the opposite:
           joining wiped this phone and kept the household. Now it carries
           everything across, and somebody who has been using the app on their
           own for a month is exactly the person about to press this. */
        '<div class="sync-p sync-brings">Joining takes your favorites, your weeks and any recipes ' +
        'you have written with you &mdash; nothing on this phone is lost.</div>' +
        '<div class="sync-warn">The code is the only key. Anyone who has it can see and change the list, so ' +
        'give it only to the people you mean to share with. There are no names or addresses in here &mdash; ' +
        'it is a meal plan and a grocery list.</div>';
    } else {
      body = '<p class="sync-p">This device is joined to household <strong>' + esc(house) + '</strong>. ' +
        'Type that same code on any other phone to put it on the same list.</p>' +
        '<div class="sync-code">' + esc(house) + '</div>' +
        (window.Store.statusNote ? '<div class="sync-warn">' + esc(window.Store.statusNote) + '</div>' : '') +
        '<div class="sync-row"><button class="ghost" data-sync="leave">Stop sharing on this device</button></div>' +
        '<p class="sync-p">Leaving keeps whatever is currently on this device and stops sending changes. ' +
        'The other phones are untouched.</p>';
    }

    return '<div class="scrim no-print" data-close="1">' +
      '<div class="sheet sync-sheet" role="dialog" aria-modal="true" aria-label="Sharing">' +
        '<div class="sheet-top">' +
          '<div class="sheet-eyebrow">Sharing between devices</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="sheet-name">One list, on every phone that has the code</div>' +
        body +
        '<div class="sync-status"><span class="' + dotCls + '"></span>' + esc(label) +
          '<span class="sync-build">Build ' + esc(BUILD) + '</span></div>' +
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

  /* Exposed so tests/weeks.test.js can check every state has both, rather than
     keeping its own copy of the list and going stale the moment one is added. */
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
    ['browse', 'plan', 'list', 'pantry', 'book'].forEach(function (v) {
      $('view-' + v).classList.toggle('hide', S.view !== v);
    });
    document.querySelectorAll('.tab').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.dataset.view === S.view));
    });
    if (S.view === 'browse') renderBrowse();
    if (S.view === 'plan') renderPlan();
    if (S.view === 'list') renderList();
    if (S.view === 'pantry') renderPantry();
    if (S.view === 'book') renderBook();
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

  function renderAll() {
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
      S.openId = idOf(c.dataset.open);
      S.scale = 1;
      S.why = false;
      renderModal();
      var x = document.querySelector('.sheet-x');
      if (x) x.focus();
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

    $('printSet').addEventListener('change', function () {
      S.printSet = this.value;
      renderBook();
    });
    $('doPrint').addEventListener('click', expandAndPrint);

    window.addEventListener('resize', fitPages);
    window.addEventListener('resize', syncTabsFade);
    document.querySelector('.tabs').addEventListener('scroll', syncTabsFade, { passive: true });
    syncTabsFade();

    /* The hint is the door as well as the sign — "where do I go" should be
       answered by going there, not by being pointed at a corner. Opening it
       also puts the hint away: the question has been asked. */
    $('shareHintGo').addEventListener('click', function () {
      dismissHint();
      S.syncOpen = true;
      if (!S.pendingCode) S.pendingCode = window.Store.newCode();
      renderModal();
      var x = document.querySelector('.sheet-x');
      if (x) x.focus();
    });
    $('shareHintX').addEventListener('click', dismissHint);

    $('syncBtn').addEventListener('click', function () {
      S.syncOpen = true;
      if (!S.pendingCode) S.pendingCode = window.Store.newCode();
      renderModal();
      var x = document.querySelector('.sheet-x');
      if (x) x.focus();
    });

    document.addEventListener('click', function (e) {
      var root = $('modalRoot');
      if (!root.contains(e.target)) return;

      // the backdrop itself, or the × — anything inside the sheet falls through
      if (e.target.classList.contains('scrim') || e.target.closest('.sheet-x')) { close(); return; }

      var ed = e.target.closest('[data-edit]');
      if (ed) { openEditor(idOf(ed.dataset.edit)); return; }

      var act = e.target.closest('[data-ed]');
      if (act) { editorAction(act.dataset.ed); return; }

      var fav = e.target.closest('[data-fav]');
      if (fav) { window.Store.toggleFav(idOf(fav.dataset.fav)); return; }

      var add = e.target.closest('[data-add]');
      if (add) {
        var id = idOf(add.dataset.add), day = add.dataset.day;
        // whatever size you are looking at is the size that goes into the week
        if (window.Store.day(day).some(function (x) { return x.id === id; })) window.Store.removeFromDay(id, day);
        else window.Store.addToDay(id, day, S.scale);
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
    });

    $('newRecipe').addEventListener('click', function () { openEditor('new'); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && D) { closeDialog(null); return; }
      if (e.key === 'Escape' && S.editId) { editorAction('cancel'); return; }
      if (e.key === 'Escape' && (S.openId || S.syncOpen)) close();
    });
  }

  function close() {
    S.openId = null;
    S.syncOpen = false;
    /* The editor too. Without these the × and the backdrop looked broken:
       renderModal saw S.editId still set, drew the editor again, and the only
       way out was the Cancel button. */
    S.editId = null;
    S.editBase = null;
    renderModal();
  }

  // ------------------------------------------------------------------- boot
  renderSections();
  wire();
  window.Store.init(function () { renderAll(); });
  renderAll();
})();
