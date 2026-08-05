/* ---------------------------------------------------------------------------
 * Bishops' Storehouse Recipe Books
 * Browse, plan a week, build a shopping list, print the book.
 * ------------------------------------------------------------------------- */
(function () {
  'use strict';

  var RECIPES = window.RECIPES || [];
  var BY_ID = {};
  RECIPES.forEach(function (r) { BY_ID[r.id] = r; });

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

  function ingKey(s) {
    return s.replace(/^[\d.½¼¾⅓⅔⅛⅜⅝⅞\s]*/, '')
      .replace(/^\(?[^)]*\)\s*/, '')
      .replace(/^(cups?|cup|tbsp|tsp|oz|lbs?|cans?|can|packages?|slices?|cloves?|quarts?|pints?|sticks?|heads?|bunch(es)?|large|small|medium)\s+/i, '')
      .trim().toLowerCase();
  }
  function ingQty(s) {
    var m = s.match(/^([\d.½¼¾⅓⅔⅛⅜⅝⅞\s]*(?:cups?|tbsp|tsp|oz|lbs?|cans?|packages?|slices?|cloves?|quarts?|pints?|sticks?)?)/i);
    return m ? m[1].trim() : '';
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
      if (S.secF !== 'all' && (r.book + '-' + r.secNum) !== S.secF) return false;
      if (S.diffF !== 'all' && r.diff !== S.diffF) return false;
      if (S.pantryF === 'base' && r.extras) return false;
      if (S.pantryF === 'extras' && !r.extras) return false;
      if (S.favOnly && !window.Store.isFav(r.id)) return false;
      if (qs && (r.name + ' ' + r.ing.join(' ') + ' ' + r.secName).toLowerCase().indexOf(qs) < 0) return false;
      return true;
    }).sort(SORTS[S.sort] || undefined);
  }

  function renderSections() {
    var sel = $('secSel');
    var seen = {}, opts = ['<option value="all">All sections</option>'];
    RECIPES.forEach(function (r) {
      var key = r.book + '-' + r.secNum;
      if (seen[key]) return;
      seen[key] = 1;
      if (S.bookF !== 'all' && r.book !== S.bookF) return;
      opts.push('<option value="' + key + '">' + esc(BOOKS[r.book].name + ' · ' + r.secName) + '</option>');
    });
    sel.innerHTML = opts.join('');
    sel.value = S.secF;
    if (sel.value !== S.secF) { S.secF = 'all'; sel.value = 'all'; }
  }

  function renderBrowse() {
    var list = filtered();
    $('browseTitle').textContent = S.bookF === 1 ? BOOKS[1].name
      : S.bookF === 2 ? BOOKS[2].name : 'The whole collection';
    var order = { healthy: ' · healthiest first', protein: ' · most protein first', quick: ' · quickest first' };
    $('browseCount').textContent = list.length + (list.length === 1 ? ' recipe' : ' recipes') +
      (order[S.sort] || '');
    $('browseEmpty').classList.toggle('hide', list.length !== 0);

    $('grid').innerHTML = list.map(function (r) {
      var fav = window.Store.isFav(r.id);
      var chipCls = 'chip' + (r.score === null ? ' plain' : r.est ? ' est' : '');
      var chipText = r.score === null ? diffLabel(r.diff) : r.score;
      var chipTitle = r.score === null ? '' :
        r.est ? ' title="Nutrition score from estimated macros"' : ' title="Nutrition score"';
      return '<button class="card" data-open="' + r.id + '">' +
        '<span class="card-top">' +
          '<span class="card-num">' + BOOKS[r.book].short + ' · ' + String(r.id).padStart(3, '0') + '</span>' +
          '<span class="card-fav">' + (fav ? '★ Saved' : '') + '</span>' +
        '</span>' +
        '<span class="card-name">' + esc(r.name) + '</span>' +
        '<span class="card-sub">' + esc(r.tagline || macroLine(r)) + '</span>' +
        '<span class="card-foot">' +
          '<span class="card-meta">' + esc(r.time + ' · ' + r.servings.split(' (')[0]) + '</span>' +
          '<span class="' + chipCls + '"' + chipTitle + '>' + esc(chipText) + '</span>' +
        '</span>' +
      '</button>';
    }).join('');
  }

  // ---------------------------------------------------------------- planning
  function planIds() {
    var out = [];
    DAYS.forEach(function (d) {
      (window.Store.state.plan[d[0]] || []).forEach(function (id) {
        if (out.indexOf(id) < 0) out.push(id);
      });
    });
    return out;
  }

  function renderPlan() {
    $('planGrid').innerHTML = DAYS.map(function (d) {
      var ids = (window.Store.state.plan[d[0]] || []).filter(function (id) { return BY_ID[id]; });
      var items = ids.map(function (id) {
        return '<div class="day-item">' +
          '<span class="day-item-name">' + esc(BY_ID[id].name) + '</span>' +
          '<button class="day-x no-print" data-drop="' + id + '" data-day="' + d[0] + '" ' +
            'aria-label="Remove ' + esc(BY_ID[id].name) + '">&times;</button>' +
        '</div>';
      }).join('');
      return '<div class="day">' +
        '<div class="day-name">' + d[1] + '</div>' +
        '<div class="day-body">' + items +
          (ids.length ? '' : '<div class="day-empty">&mdash;</div>') +
        '</div></div>';
    }).join('');
  }

  // ----------------------------------------------------------- shopping list
  function buildList() {
    var ids = planIds();
    var bucket = {};
    ids.forEach(function (id) {
      var r = BY_ID[id];
      if (!r) return;
      var extras = (r.extras || '').toLowerCase();
      r.ing.forEach(function (line) {
        var k = ingKey(line);
        if (!k) return;
        var isExtra = extras && extras.split(/,\s*/).some(function (x) {
          return x && k.indexOf(x.trim()) >= 0;
        });
        var group = isExtra ? 'extra' : 'base';
        var key = group + '|' + k;
        if (!bucket[key]) {
          bucket[key] = { key: key, group: group, label: k.charAt(0).toUpperCase() + k.slice(1), qtys: [] };
        }
        var q = ingQty(line);
        if (q) bucket[key].qtys.push(q);
      });
    });
    var group = function (title, g) {
      var items = Object.keys(bucket).map(function (k) { return bucket[k]; })
        .filter(function (b) { return b.group === g; })
        .sort(function (a, b) { return a.label.localeCompare(b.label); });
      return { title: title, items: items };
    };
    return {
      groups: [group('From the storehouse', 'base'), group('Pantry extras to pick up', 'extra')]
        .filter(function (g) { return g.items.length; }),
      recipeCount: ids.length
    };
  }

  function renderList() {
    var built = buildList();
    var total = built.groups.reduce(function (n, g) { return n + g.items.length; }, 0);
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
            '<span class="qty">' + esc(it.qtys.join(' + ')) + '</span>' +
          '</label>';
        }).join('') + '</div></div>';
    }).join('');
  }

  // ------------------------------------------------------------- print book
  function printPool() {
    if (S.printSet === '1') return RECIPES.filter(function (r) { return r.book === 1; });
    if (S.printSet === '2') return RECIPES.filter(function (r) { return r.book === 2; });
    if (S.printSet === 'fav') return RECIPES.filter(function (r) { return window.Store.isFav(r.id); });
    if (S.printSet === 'plan') return planIds().map(function (id) { return BY_ID[id]; }).filter(Boolean);
    return RECIPES;
  }

  // ---- the pieces a page is built from -----------------------------------
  function coverHTML(title, sub, foot) {
    return '<div class="pg"><div class="pg-cover">' +
      '<div class="pg-cover-mid">' +
        '<div class="pg-eyebrow">Recipes from the storehouse</div>' +
        '<div class="pg-rule"></div>' +
        '<div class="pg-title">' + esc(title) + '</div>' +
        '<div class="pg-sub">' + esc(sub) + '</div>' +
      '</div>' +
      '<div class="pg-foot">' + esc(foot) + '</div>' +
    '</div></div>';
  }

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
        '<span class="rp-num">No. ' + String(r.id).padStart(3, '0') + '</span>' +
        '<span>' + esc(r.servings.split(' (')[0] + ' · ' + r.time + ' · ' + diffLabel(r.diff)) +
          (r.score !== null ? ' · <span class="score">Score ' + r.score + (r.est ? ' est.' : '') + '</span>' : '') +
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
        '<span>' + esc((r.est && r.macro ? 'Est. ' : '') + macroLine(r)) + '</span>' +
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
      '<div class="fm-p">Servings, time, effort, and a nutrition score out of 100. Three things make it ' +
      'up: how much of the energy comes from protein (60 points, full marks at 45%), how many calories a ' +
      'serving carries (25, full marks up to 300), and how much of the energy comes from fat (15, full ' +
      'marks at or below a tenth).</div>' +
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
      '<span class="toc-no">' + String(r.id).padStart(3, '0') + '</span>' +
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
    if (grouped || S.printSet === '1' || S.printSet === '2') {
      volumes = [{ book: S.printSet === '2' ? 2 : 1, list: pool, grouped: grouped }];
    } else {
      volumes = [1, 2].map(function (b) {
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
      out.push({ kind: 'cover', html: coverHTML(title, sub, vol.list.length + ' recipes') });

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
    });
    return out;
  }

  function renderBook() {
    var t0 = performance.now();
    var pages = buildBook();
    var pool = printPool();
    var perPage = pages.filter(function (p) { return p.kind === 'page'; }).length;
    $('printNote').textContent = pool.length
      ? pool.length + (pool.length === 1 ? ' recipe · ' : ' recipes · ') +
        pages.length + ' pages at 5.5″ × 8.5″ · ' +
        (perPage ? (pool.length / perPage).toFixed(1) + ' recipes a page' : '')
      : 'Nothing to print yet.';
    $('pages').innerHTML = pages.map(function (p) {
      return '<div class="pgslot">' + p.html + '</div>';
    }).join('');
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

  // --------------------------------------------------------------- detail
  function scoreWhy(r) {
    if (!r.sc) return '';
    return r.sc.pPct + '% of calories from protein (' + r.sc.p + '/60) · ' +
      r.macro.kcal + ' kcal per serving (' + r.sc.k + '/25) · ' +
      r.sc.fPct + '% from fat (' + r.sc.f + '/15)';
  }

  function renderModal() {
    var root = $('modalRoot');

    // a re-render triggered by a sync update should not scroll the sheet back
    // to the top, lose a half-typed code, or reroll the suggested one
    var prev = root.querySelector('.scrim');
    var keepScroll = prev ? prev.scrollTop : 0;
    var draft = root.querySelector('#joinCode');
    if (draft) S.joinDraft = draft.value;

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
          '<div class="sheet-eyebrow">' + esc(BOOKS[r.book].name + ' · ' + r.secName + ' · No. ' + String(r.id).padStart(3, '0')) + '</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="sheet-name">' + esc(r.name) + '</div>' +
        (r.tagline ? '<div class="sheet-tag">' + esc(r.tagline) + '</div>' : '') +
        '<div class="sheet-meta"><span>' + esc(r.time) + '</span><span>' + esc(diffLabel(r.diff)) + '</span>' +
          '<span>' + esc(r.macro ? (r.est ? 'Est. ' : '') + r.macro.kcal + ' kcal · ' + r.macro.p + 'g protein' : 'No nutrition data') + '</span>' +
        '</div>' +
        (r.score !== null ?
          '<div class="scorebox' + (r.est ? ' est' : '') + '">' +
            '<div class="scorebox-top">' +
              '<div class="scorebox-label">Nutrition score' + (r.est ? ' · estimated' : '') + '</div>' +
              '<div class="scorebox-n">' + r.score + '</div>' +
            '</div>' +
            '<div class="scorebox-why">' + esc(scoreWhy(r)) + '</div>' +
          '</div>' : '') +
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
          '<span class="addto">Add to</span>' +
          DAYS.map(function (d) {
            var on = (window.Store.state.plan[d[0]] || []).indexOf(r.id) >= 0;
            return '<button class="daybtn" data-add="' + r.id + '" data-day="' + d[0] + '" aria-pressed="' + on + '">' + d[2] + '</button>';
          }).join('') +
        '</div></div>' +
      '</div></div>';

    if (keepScroll) root.querySelector('.scrim').scrollTop = keepScroll;
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
      body = '<p class="sync-p">Right now your favorites, the week&rsquo;s plan and the shopping list save ' +
        'on <strong>this device only</strong>. Nothing is shared, and nothing leaves the browser.</p>' +
        '<p class="sync-p">To share one plan between the two of you, follow <strong>SETUP.md</strong> in ' +
        'the project: create a free Firebase project, paste six values into <code>src/config.js</code>, ' +
        'and this panel will let you make a household code.</p>';
    } else if (!house) {
      body = '<p class="sync-p">Enter the same household code on both phones and you share one meal plan, ' +
        'one list of favorites, and one shopping list. Tick something off in the store and it greys out ' +
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
    $('favCount').textContent = window.Store.state.favs.length ? '(' + window.Store.state.favs.length + ')' : '';
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
      S.openId = Number(c.dataset.open);
      S.scale = 1;
      renderModal();
      var x = document.querySelector('.sheet-x');
      if (x) x.focus();
    });

    $('planGrid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-drop]');
      if (!b) return;
      window.Store.removeFromDay(Number(b.dataset.drop), b.dataset.day);
    });

    $('clearPlan').addEventListener('click', function () {
      if (planIds().length && !confirm('Clear every recipe from the week?')) return;
      window.Store.clearPlan();
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

      var fav = e.target.closest('[data-fav]');
      if (fav) { window.Store.toggleFav(Number(fav.dataset.fav)); return; }

      var add = e.target.closest('[data-add]');
      if (add) {
        var id = Number(add.dataset.add), day = add.dataset.day;
        if ((window.Store.state.plan[day] || []).indexOf(id) >= 0) window.Store.removeFromDay(id, day);
        else window.Store.addToDay(id, day);
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

    document.addEventListener('keydown', function (e) {
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
