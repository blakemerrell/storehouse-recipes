/* ---------------------------------------------------------------------------
 * Bishops' Storehouse Recipe Books
 * Browse, plan a week, build a shopping list, print the book.
 * ------------------------------------------------------------------------- */
(function () {
  'use strict';

  var BASE = window.RECIPES || [];    // the 257 in the two printed books
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
      name: 'Strong & Simple', short: 'STRONG',
      blurb: 'One hundred high‑protein recipes built on standard storehouse items. Every recipe carries real macros and a computed nutrition score.'
    },
    2: {
      name: 'Around the Table', short: 'TABLE',
      blurb: 'One hundred fifty‑seven family recipes, from three‑minute breakfasts to Sunday roasts, by way of an afternoon at the stove, the restaurant favourites worked out at home, and a section for chocolate alone.'
    },
    3: {
      name: 'Ours', short: 'OURS',
      blurb: 'The ones we worked out ourselves, or were given, or changed until they were right. This volume grows; the other two do not.'
    }
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
    '2-8': 'For when only chocolate will do.'
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
   * across the 257, so the bands divide the collection rather than flattering
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
    syncOpen: false, pendingCode: '', joinDraft: ''
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

  function filtered() {
    var qs = S.qy.trim().toLowerCase();
    return RECIPES.filter(function (r) {
      if (S.bookF !== 'all' && r.book !== S.bookF) return false;
      if (S.secF !== 'all' && (r.book + '-' + r.secNum + '-' + r.secName) !== S.secF) return false;
      if (S.diffF !== 'all' && r.diff !== S.diffF) return false;
      if (S.pantryF === 'base' && r.extras) return false;
      if (S.pantryF === 'extras' && !r.extras) return false;
      if (S.favOnly && !window.Store.isFav(r.id)) return false;
      if (qs && (r.name + ' ' + r.ing.join(' ') + ' ' + r.secName).toLowerCase().indexOf(qs) < 0) return false;
      return true;
    }).sort(SORTS[S.sort] || undefined);
  }

  function ours() {
    return RECIPES.filter(function (r) { return r.book === 3; });
  }

  function renderSections() {
    var sel = $('secSel');
    var seen = {}, opts = ['<option value="all">All sections</option>'];
    RECIPES.forEach(function (r) {
      var key = r.book + '-' + r.secNum + '-' + r.secName;
      if (seen[key]) return;
      seen[key] = 1;
      if (S.bookF !== 'all' && r.book !== S.bookF) return;
      opts.push('<option value="' + esc(key) + '">' + esc(BOOKS[r.book].name + ' · ' + r.secName) + '</option>');
    });
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
    $('browseCount').textContent = list.length + (list.length === 1 ? ' recipe' : ' recipes') +
      (order[S.sort] || '');
    $('browseEmpty').classList.toggle('hide', list.length !== 0);

    $('grid').innerHTML = list.map(function (r) {
      var fav = window.Store.isFav(r.id);
      var chip = r.score === null
        ? '<span class="chip plain">' + esc(diffLabel(r.diff)) + '</span>'
        : leaf(r.score);
      return '<button class="card" data-open="' + r.id + '">' +
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
        if (seen.indexOf(rid) < 0) seen.push(rid);
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
        /* One line per thing, under one heading. A recipe that counts chocolate
           chips as a pantry extra and one that does not used to put them on the
           list twice; a thing is either on the standard order or it is not, and
           if any recipe gets it from the storehouse, that is where it lives. */
        if (!it.x) bucket[key].extra = false;
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
      groups: [group('From the storehouse', false), group('Pantry extras to pick up', true)]
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
  var ORDINAL = { 1: 'One', 2: 'Two', 3: 'Three' };

  function volumeLine(vol) {
    if (vol.grouped || !ORDINAL[vol.book]) return '';
    var of = ours().length ? 'Three' : 'Two';
    return 'Volume ' + ORDINAL[vol.book] + ' of ' + of;
  }

  function coverHTML(vol, title, sub, foot) {
    var vl = volumeLine(vol);
    return '<div class="pg"><div class="pg-cover">' +
      '<div class="pg-cover-top">' +
        '<div class="pg-eyebrow">Bishops&rsquo; Storehouse</div>' +
        '<div class="pg-eyebrow">Recipe Books</div>' +
      '</div>' +
      '<div class="pg-cover-mid">' +
        '<div class="pg-rule"></div>' +
        '<div class="pg-title">' + esc(title) + '</div>' +
        '<div class="pg-sub">' + esc(sub) + '</div>' +
        '<div class="pg-rule"></div>' +
        (vl ? '<div class="pg-vol">' + esc(vl) + '</div>' : '') +
      '</div>' +
      '<div class="pg-foot">' + esc(foot) + (vl ? ' &middot; ' + YEAR : '') + '</div>' +
    '</div></div>';
  }

  /* The right-hand page behind the cover. A cover is a thing you look at; this
     is the page that says what the book is, and carries the small print. */
  function titlePageHTML(vol, title, sub) {
    var vl = volumeLine(vol);
    return '<div class="pg"><div class="pg-title-page">' +
      '<div class="tp-top">' +
        '<div class="pg-eyebrow">Bishops&rsquo; Storehouse Recipe Books</div>' +
        '<div class="tp-name">' + esc(title) + '</div>' +
        '<div class="tp-sub">' + esc(sub) + '</div>' +
        (vl ? '<div class="tp-vol">' + esc(vl) + '</div>' : '') +
      '</div>' +
      '<div class="tp-foot">' +
        '<p>Every recipe here is built on what the Bishops&rsquo; Storehouse order list ' +
        'actually carries. Where one needs something beyond it, the line at the foot of ' +
        'the recipe says so.</p>' +
        '<p>Calories, protein, carbohydrate and fat are as recorded for Strong &amp; Simple ' +
        'and worked out from the ingredients everywhere else. Sodium and fiber are worked ' +
        'out from the ingredients throughout. How the score is arrived at is on the next ' +
        'page but one.</p>' +
        '<p class="tp-colophon">Set in Source Serif 4 and Work Sans &middot; ' + YEAR + '</p>' +
      '</div>' +
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

    return '<div class="pg"><div class="pg-back">' +
      '<div class="bc-top">' +
        '<div class="pg-eyebrow">Bishops&rsquo; Storehouse Recipe Books</div>' +
        '<div class="bc-name">' + esc(title) + '</div>' +
      '</div>' +
      '<div class="bc-list">' +
        secs.map(function (s) {
          return '<div class="bc-row"><span class="bc-no">' + s.num + '</span>' +
            '<span class="bc-sec">' + esc(s.name) + '</span>' +
            '<span class="bc-n">' + s.n + '</span></div>';
        }).join('') +
      '</div>' +
      '<div class="bc-note">' +
        '<p>Every recipe in both volumes was checked against the storehouse order list, ' +
        'and against the ratios a kitchen runs on &mdash; the water in a dough, the ' +
        'leavening in a cup of flour, the eggs in a custard, a doneness cue on every ' +
        'piece of chicken.</p>' +
        '<p>The number beside each one is its nutrition score out of a hundred: protein, ' +
        'calories, fat, sodium and fiber. It measures that and nothing else.</p>' +
      '</div>' +
      '<div class="bc-foot">' +
        (vol.grouped ? '' : '<p>The companion volume is <strong>' + esc(other) + '</strong>.</p>') +
        '<p>' + vol.list.length + (vol.list.length === 1 ? ' recipe' : ' recipes') +
          (vl ? ' &middot; ' + esc(vl) : '') + ' &middot; ' + YEAR + '</p>' +
      '</div>' +
    '</div></div>';
  }

  // a page with nothing on it, so the sheet count comes out right for folding
  function blankHTML() { return '<div class="pg"></div>'; }

  function bandHTML(r, count) {
    return '<div class="sec-band">' +
      '<div class="sec-band-n">Section ' + r.secNum + '</div>' +
      '<div class="sec-band-t">' + esc(r.secName) + '</div>' +
      '<div class="sec-band-s">' + esc(SEC_NOTE[r.book + '-' + r.secNum] || '') +
        ' · ' + count + (count === 1 ? ' recipe' : ' recipes') + '</div>' +
    '</div>';
  }

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
          r.ing.map(function (i) { return '<div>' + esc(i) + '</div>'; }).join('') +
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
        '<span>' + esc(r.extras ? 'Also needs: ' + r.extras : 'All storehouse items') + '</span>' +
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
        'serving count, a time, an effort and a score out of 100 — but the words are ours. Calories, ' +
        'sodium and fiber are worked out from the ingredients using the same table the other two ' +
        'volumes use, so a score here means what a score there means.</div>');
      block('<div class="fm-p">Nothing in here has been proofread by anyone but us, and that is rather ' +
        'the point.</div>');
      return b;
    }

    head('<div class="fm-title">How to read a recipe</div>' +
      '<div class="fm-lede">Everything here is built from what the storehouse actually carries.</div>');
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
    // which page each recipe landed on
    var pageOf = {};
    packed.forEach(function (pageItems, idx) {
      pageItems.forEach(function (x) { if (x.type === 'recipe') pageOf[x.r.id] = idx + 1; });
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
        '<div class="pg-run"><span>' + esc(vol.grouped ? vol.title : BOOKS[vol.book].name) + '</span>' +
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
    if (grouped || /^[123]$/.test(S.printSet)) {
      volumes = [{ book: grouped ? 1 : Number(S.printSet), list: pool, grouped: grouped }];
    } else {
      volumes = [1, 2, 3].map(function (b) {
        return { book: b, list: pool.filter(function (r) { return r.book === b; }), grouped: false };
      }).filter(function (v) { return v.list.length; });
    }

    var out = [];
    volumes.forEach(function (vol) {
      var items = [];
      var lastSec = null;
      vol.list.forEach(function (r) {
        var key = r.book + '-' + r.secNum;
        if (!vol.grouped && key !== lastSec) {
          lastSec = key;
          var n = vol.list.filter(function (x) { return x.book === r.book && x.secNum === r.secNum; }).length;
          items.push({ type: 'band', html: bandHTML(r, n), r: r });
        }
        items.push({ type: 'recipe', html: recipeHTML(r), r: r });
      });

      var m = measure(items);
      // a couple of pixels of slack absorbs any rounding between screen and print
      var avail = 7.5 * 96 - m.chrome - 4;
      var packed = pack(items, avail, m);

      var title = vol.grouped
        ? (S.printSet === 'fav' ? 'Favorites' : 'This Week')
        : BOOKS[vol.book].name;
      vol.title = title;
      var sub = vol.grouped
        ? (S.printSet === 'fav' ? 'The ones worth keeping.' : 'The week’s cooking, in order.')
        : BOOKS[vol.book].blurb;
      var volStart = out.length;
      out.push({ kind: 'cover', html: coverHTML(vol, title, sub,
        vol.list.length + (vol.list.length === 1 ? ' recipe' : ' recipes')) });
      out.push({ kind: 'title', html: titlePageHTML(vol, title, sub) });

      if (!vol.grouped) {
        var fm = frontMatterItems(vol);
        measure(fm);
        pack(fm, avail, m).forEach(function (col) {
          out.push({ kind: 'front', html: '<div class="pg">' +
            '<div class="pg-run"><span>' + esc(BOOKS[vol.book].name) + '</span>' +
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

      packed.forEach(function (pageItems, idx) {
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
            '<div class="pg-run"><span>' + esc(vol.grouped ? title : BOOKS[vol.book].name) + '</span>' +
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
   * be handed something it cannot solve: two of the 257 recipes are taller on
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
    var perPage = pages.filter(function (p) { return p.kind === 'page'; }).length;
    renderDownloads();
    $('printNote').textContent = pool.length
      ? pool.length + (pool.length === 1 ? ' recipe · ' : ' recipes · ') +
        pages.length + ' pages at 5.5″ × 8.5″ · ' +
        (perPage ? (pool.length / perPage).toFixed(1) + ' recipes a page' : '')
      : 'Nothing to print yet.';
    $('pages').innerHTML = pages.map(function (p) {
      return '<div class="pgslot">' + p.html + '</div>';
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
    all: { file: 'Both-Books.pdf', label: 'Both books', pages: 148 },
    1: { file: 'Strong-and-Simple.pdf', label: 'Strong & Simple', pages: 48, booklet: true },
    2: { file: 'Around-the-Table.pdf', label: 'Around the Table', pages: 100, booklet: true }
  };

  function renderDownloads() {
    var r = READY_MADE[S.printSet];
    var dl = $('dlBook'), bk = $('dlBooklet');
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
      { k: 'Protein', v: r.sc.pPct + '%', p: r.sc.p, max: 30, t: r.sc.pPct + '% of the calories come from protein' },
      { k: 'Calories', v: r.macro.kcal, p: r.sc.k, max: 20, t: r.macro.kcal + ' kcal a serving' },
      { k: 'Fat', v: r.sc.fPct + '%', p: r.sc.f, max: 10, t: r.sc.fPct + '% of the calories come from fat' },
      { k: 'Sodium', v: r.sc.na + ' mg', p: r.sc.s, max: 25, t: r.sc.na + ' mg of sodium a serving' },
      { k: 'Fiber', v: r.sc.fib + ' g', p: r.sc.b, max: 15, t: r.sc.fib + ' g of fiber a serving' }
    ];
  }

  function nutritionHTML(r) {
    if (r.score === null || !r.sc) return '';

    /* One bar, five slots, each as wide as the points that part is worth: 30
       for protein, 20 for calories, 10 for fat, 25 for sodium, 15 for fiber.
       Each slot fills by what the recipe earned, so the ink across the whole
       bar IS the score out of a hundred and the empty stretches say where the
       missing points went. Five labelled rows said the same thing and took ten
       times the room — on a two-step recipe the panel outgrew the recipe. */
    var parts = scoreParts(r);
    var bandOf = function (c) {
      var share = c.max ? c.p / c.max : 0;
      return share >= 0.8 ? 'good' : share >= 0.45 ? 'ok' : 'low';
    };

    var track = parts.map(function (c) {
      return '<span class="nut-slot" style="flex:' + c.max + '" title="' + esc(c.t) +
        ' \u2014 ' + c.p + ' of ' + c.max + ' points">' +
        '<i class="nb-' + bandOf(c) + '" style="width:' +
        ((c.max ? c.p / c.max : 0) * 100).toFixed(1) + '%"></i></span>';
    }).join('');

    var key = parts.map(function (c) {
      return '<span class="nk nk-' + bandOf(c) + '" title="' + esc(c.t) + '">' +
        '<b>' + c.p + '</b><u>/' + c.max + '</u> ' + esc(c.k.toLowerCase()) + '</span>';
    }).join('<i>&middot;</i>');

    var m = r.macro;
    return '<div class="nut nut-' + scoreBand(r.score) + '">' +
      leaf(r.score, 'leaf-big') +
      '<div class="nut-body">' +
        '<div class="nut-title">Nutrition score</div>' +
        '<div class="nut-track">' + track + '</div>' +
        '<div class="nut-key">' + key + '</div>' +
        '<div class="nut-foot" title="' + esc(m.kcal + ' kcal, ' + m.p + 'g protein, ' +
          m.c + 'g carbohydrate, ' + m.f + 'g fat, ' + m.na + ' mg sodium, ' + m.fib + 'g fiber') + '">' +
          [m.kcal + ' kcal', m.p + 'g P', m.c + 'g C', m.f + 'g F', m.na + 'mg S', m.fib + 'g Fib']
            .map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('<i>&middot;</i>') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function renderModal() {
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
          '<div class="sheet-h">Ingredients</div>' +
          '<div class="scaler">' +
            '<span class="sheet-serv">' + esc(r.servings) + '</span>' +
            '<div class="scaler-box">' +
              '<button data-scale="down" aria-label="Halve">&minus;</button>' +
              '<div class="scaler-val">' + scaleLabel + '</div>' +
              '<button data-scale="up" aria-label="Double">+</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="sheet-ing">' + r.ing.map(function (i) {
          return '<div>' + esc(scaleIng(i, f)) + '</div>';
        }).join('') + '</div>' +
        '<div class="sheet-h" style="margin-top:24px;margin-bottom:10px">Method</div>' +
        '<div class="sheet-steps">' + r.steps.map(function (t, i) {
          return '<div class="sheet-step"><div class="sheet-step-n">' + (i + 1) + '</div>' +
            '<div class="sheet-step-t">' + esc(t) + '</div></div>';
        }).join('') + '</div>' +
        (r.extras ? '<div class="sheet-extras">Needs items not on the standard storehouse list: ' + esc(r.extras) + '.</div>' : '') +
        '<div class="sheet-actions"><div class="sheet-actions-in">' +
          '<button class="savebtn" data-fav="' + r.id + '" aria-pressed="' + fav + '">' +
            (fav ? '★ Saved' : '☆ Save') + '</button>' +
          '<button class="savebtn" data-edit="' + r.id + '">✎ Edit</button>' +
          '<span class="addto">Add to</span>' +
          DAYS.map(function (d) {
            var on = window.Store.day(d[0]).some(function (e) { return e.id === r.id; });
            return '<button class="daybtn" data-add="' + r.id + '" data-day="' + d[0] + '" aria-pressed="' + on + '">' + d[2] + '</button>';
          }).join('') +
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
      macro: macro, tagline: null,
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
      name: g('edName'), secName: g('edSection'), servings: g('edServings'),
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
      kcal: b.typedMacro ? b.macro.kcal : '', p: '', c: '', f: ''
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
    var dotCls = st === 'synced' ? 'dot on' : (st === 'error' || st === 'offline') ? 'dot off' : 'dot';
    var label = !configured ? 'Not set up — saving on this device only'
      : st === 'synced' ? 'Synced as ' + house
        : st === 'connecting' ? 'Connecting…'
          : st === 'offline' ? 'Offline — will catch up as soon as there is signal'
            : st === 'error' ? 'Sync problem' : 'Saving on this device only';

    var body;
    if (!configured) {
      body = '<p class="sync-p">Right now your favorites, your weeks and their shopping lists save ' +
        'on <strong>this device only</strong>. Nothing is shared, and nothing leaves the browser.</p>' +
        '<p class="sync-p">To share one plan between the two of you, follow <strong>SETUP.md</strong> in ' +
        'the project: create a free Firebase project, paste six values into <code>src/config.js</code>, ' +
        'and this panel will let you make a household code.</p>';
    } else if (!house) {
      body = '<p class="sync-p">Enter the same household code on both phones and you share the same weeks, ' +
        'the same favorites, and the same shopping list. Tick something off in the store and it greys out ' +
        'on the other phone.</p>' +
        '<div class="sync-code" id="newCode">' + esc(S.pendingCode) + '</div>' +
        '<div class="sync-row">' +
          '<button class="btn-primary" data-sync="use">Use this code</button>' +
          '<button class="ghost" data-sync="reroll">Give me another</button>' +
        '</div>' +
        '<div class="sync-row">' +
          '<input class="txt" id="joinCode" placeholder="Or type a code you already have" aria-label="Household code">' +
          '<button class="ghost" data-sync="join">Join</button>' +
        '</div>' +
        '<div class="sync-warn">Anyone who has the code can see and change the list, so keep it between ' +
        'the two of you. There are no names or addresses in here &mdash; it is a meal plan and a grocery list.</div>';
    } else {
      body = '<p class="sync-p">This device is joined to household <strong>' + esc(house) + '</strong>. ' +
        'Type that same code on the other phone to share the plan.</p>' +
        '<div class="sync-code">' + esc(house) + '</div>' +
        (window.Store.statusNote ? '<div class="sync-warn">' + esc(window.Store.statusNote) + '</div>' : '') +
        '<div class="sync-row"><button class="ghost" data-sync="leave">Stop sharing on this device</button></div>' +
        '<p class="sync-p">Leaving keeps whatever is currently on this device and stops sending changes. ' +
        'The other phone is untouched.</p>';
    }

    return '<div class="scrim no-print" data-close="1">' +
      '<div class="sheet sync-sheet" role="dialog" aria-modal="true" aria-label="Sharing">' +
        '<div class="sheet-top">' +
          '<div class="sheet-eyebrow">Sharing between devices</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="sheet-name">The two of you, one list</div>' +
        body +
        '<div class="sync-status"><span class="' + dotCls + '"></span>' + esc(label) + '</div>' +
      '</div></div>';
  }

  function renderSyncBadge() {
    var st = window.Store.status;
    var dot = $('syncDot'), label = $('syncLabel');
    dot.className = 'dot' + (st === 'synced' ? ' on' : (st === 'error' || st === 'offline') ? ' off' : '');
    label.textContent = st === 'synced' ? 'Synced'
      : st === 'connecting' ? 'Connecting'
        : st === 'offline' ? 'Offline'
          : st === 'error' ? 'Sync issue' : 'Local';
  }

  // ------------------------------------------------------------------ views
  function renderView() {
    ['browse', 'plan', 'list', 'book'].forEach(function (v) {
      $('view-' + v).classList.toggle('hide', S.view !== v);
    });
    document.querySelectorAll('.tab').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.dataset.view === S.view));
    });
    if (S.view === 'browse') renderBrowse();
    if (S.view === 'plan') renderPlan();
    if (S.view === 'list') renderList();
    if (S.view === 'book') renderBook();
  }

  function renderAll() {
    rebuild();                    // your changes and your own recipes, folded in
    renderSections();             // which can add a section, or a whole volume
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

      var sc = e.target.closest('[data-scale]');
      if (sc) {
        S.scale = sc.dataset.scale === 'up' ? Math.min(8, S.scale * 2) : Math.max(0.25, S.scale / 2);
        renderModal();
        return;
      }

      var sy = e.target.closest('[data-sync]');
      if (sy) {
        var act = sy.dataset.sync;
        if (act === 'reroll') { S.pendingCode = window.Store.newCode(); }
        if (act === 'use') { window.Store.join(S.pendingCode); }
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
    renderModal();
  }

  // ------------------------------------------------------------------- boot
  renderSections();
  wire();
  window.Store.init(function () { renderAll(); });
  renderAll();
})();
