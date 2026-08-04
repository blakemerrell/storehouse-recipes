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
      name: 'Book I · The Fitness Cut', roman: 'Book One',
      blurb: 'One hundred high‑protein recipes built on standard storehouse items. Every recipe carries real macros and a computed nutrition score.'
    },
    2: {
      name: 'Book II · The Family Table', roman: 'Book Two',
      blurb: 'One hundred twenty‑five family recipes, from three‑minute breakfasts to Sunday roasts. Portions are written for a household, not a plate.'
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
    '2-5': 'Sweets, made from what is on the shelf.'
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
    favOnly: false, qy: '', openId: null, scale: 1, printSet: 'all', allPages: false,
    syncOpen: false, pendingCode: '', joinDraft: ''
  };

  // ------------------------------------------------------------------ browse
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
    });
  }

  function renderSections() {
    var sel = $('secSel');
    var seen = {}, opts = ['<option value="all">All sections</option>'];
    RECIPES.forEach(function (r) {
      var key = r.book + '-' + r.secNum;
      if (seen[key]) return;
      seen[key] = 1;
      if (S.bookF !== 'all' && r.book !== S.bookF) return;
      opts.push('<option value="' + key + '">' + (r.book === 1 ? 'I · ' : 'II · ') + esc(r.secName) + '</option>');
    });
    sel.innerHTML = opts.join('');
    sel.value = S.secF;
    if (sel.value !== S.secF) { S.secF = 'all'; sel.value = 'all'; }
  }

  function renderBrowse() {
    var list = filtered();
    $('browseTitle').textContent = S.bookF === 1 ? BOOKS[1].name
      : S.bookF === 2 ? BOOKS[2].name : 'The whole collection';
    $('browseCount').textContent = list.length + (list.length === 1 ? ' recipe' : ' recipes');
    $('browseEmpty').classList.toggle('hide', list.length !== 0);

    $('grid').innerHTML = list.map(function (r) {
      var fav = window.Store.isFav(r.id);
      var chipCls = 'chip' + (r.score === null ? ' plain' : r.est ? ' est' : '');
      var chipText = r.score === null ? diffLabel(r.diff) : r.score;
      var chipTitle = r.score === null ? '' :
        r.est ? ' title="Nutrition score from estimated macros"' : ' title="Nutrition score"';
      return '<button class="card" data-open="' + r.id + '">' +
        '<span class="card-top">' +
          '<span class="card-num">' + (r.book === 1 ? 'I' : 'II') + ' · ' + String(r.id).padStart(3, '0') + '</span>' +
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

  function buildPages() {
    var pool = printPool();
    var grouped = S.printSet === 'fav' || S.printSet === 'plan';
    var titleFor = {
      all: 'Bishops’ Storehouse Recipe Books', '1': BOOKS[1].name, '2': BOOKS[2].name,
      fav: 'Favorites', plan: 'This Week'
    };
    var pages = [{
      kind: 'cover',
      eyebrow: 'Recipes from the storehouse',
      title: titleFor[S.printSet] || 'Recipe Book',
      sub: S.printSet === 'all'
        ? 'Two volumes — the fitness cut and the family table — written from what is actually on the shelf.'
        : S.printSet === 'fav' ? 'The ones worth keeping.'
          : S.printSet === 'plan' ? 'The week’s cooking, in order.'
            : BOOKS[S.printSet] ? BOOKS[S.printSet].blurb : '',
      foot: pool.length + (pool.length === 1 ? ' recipe' : ' recipes')
    }];

    var lastSec = null;
    pool.forEach(function (r) {
      var key = r.book + '-' + r.secNum;
      if (!grouped && key !== lastSec) {
        lastSec = key;
        var n = pool.filter(function (x) { return x.book === r.book && x.secNum === r.secNum; }).length;
        pages.push({
          kind: 'divider',
          eyebrow: BOOKS[r.book].roman + ' · Section ' + r.secNum,
          title: r.secName,
          sub: (SEC_NOTE[key] || '') + ' — ' + n + (n === 1 ? ' recipe.' : ' recipes.')
        });
      }
      pages.push({ kind: 'recipe', r: r });
    });
    return pages;
  }

  function pageHTML(p) {
    if (p.kind === 'cover') {
      return '<div class="pg"><div class="pg-cover">' +
        '<div class="pg-eyebrow">' + esc(p.eyebrow) + '</div>' +
        '<div class="pg-rule"></div>' +
        '<div class="pg-title">' + esc(p.title) + '</div>' +
        '<div class="pg-sub">' + esc(p.sub) + '</div>' +
        '<div class="pg-foot">' + esc(p.foot) + '</div>' +
      '</div></div>';
    }
    if (p.kind === 'divider') {
      return '<div class="pg"><div class="pg-div">' +
        '<div class="pg-div-eyebrow">' + esc(p.eyebrow) + '</div>' +
        '<div class="pg-div-title">' + esc(p.title) + '</div>' +
        '<div class="pg-div-rule"></div>' +
        '<div class="pg-div-sub">' + esc(p.sub) + '</div>' +
      '</div></div>';
    }
    var r = p.r;
    return '<div class="pg"><div class="pg-rec">' +
      '<div class="pg-rec-top"><span>' + esc(BOOKS[r.book].roman + ' · ' + r.secName) + '</span>' +
        '<span class="pg-rec-num">No. ' + String(r.id).padStart(3, '0') + '</span></div>' +
      '<div class="pg-rec-name">' + esc(r.name) + '</div>' +
      (r.tagline ? '<div class="pg-rec-tag">' + esc(r.tagline) + '</div>' : '') +
      '<div class="pg-rec-meta"><span>' + esc(r.servings) + '</span><span>' + esc(r.time) + '</span>' +
        '<span>' + esc(diffLabel(r.diff)) + '</span>' +
        (r.score !== null ? '<span class="score">Score ' + r.score + (r.est ? ' (est.)' : '') + '</span>' : '') +
      '</div>' +
      '<div class="pg-body">' +
        '<div><div class="pg-h">Ingredients</div><div class="pg-ing">' +
          r.ing.map(function (i) { return '<div>' + esc(i) + '</div>'; }).join('') +
        '</div></div>' +
        '<div><div class="pg-h">Method</div><div class="pg-steps">' +
          r.steps.map(function (t, i) {
            return '<div class="pg-step"><div class="pg-step-n">' + (i + 1) + '</div>' +
              '<div class="pg-step-t">' + esc(t) + '</div></div>';
          }).join('') +
        '</div></div>' +
      '</div>' +
      '<div class="pg-rec-foot"><div class="pg-rec-foot-in">' +
        '<span>' + esc((r.est && r.macro ? 'Est. ' : '') + macroLine(r)) + '</span>' +
        '<span style="text-align:right">' + esc(r.extras ? 'Not on the standard list: ' + r.extras : 'All standard storehouse items') + '</span>' +
      '</div></div>' +
    '</div></div>';
  }

  function renderBook() {
    var pages = buildPages();
    var show = (S.allPages || pages.length <= 10) ? pages : pages.slice(0, 8);
    var pool = printPool();
    var note = pool.length + (pool.length === 1 ? ' recipe · ' : ' recipes · ') +
      pages.length + ' pages at 5.5″ × 8.5″';
    if (show.length < pages.length) note += ' · previewing first ' + show.length;
    $('printNote').textContent = note;
    $('pages').innerHTML = show.map(function (p) {
      return '<div class="pgslot">' + pageHTML(p) + '</div>';
    }).join('');
    fitPages();
  }

  /* A 5.5in page is wider than a phone. Scale it down to fit rather than
     letting the whole document scroll sideways. Printing ignores this. */
  function fitPages() {
    var avail = document.documentElement.clientWidth - 32;
    var pageW = 5.5 * 96;
    var scale = window.innerWidth <= 860 ? Math.min(1, avail / pageW) : 1;
    document.documentElement.style.setProperty('--pgscale', String(scale));
  }

  function expandAndPrint() {
    if (!S.allPages) { S.allPages = true; renderBook(); }
    window.print();
  }

  // --------------------------------------------------------------- detail
  function scoreWhy(r) {
    if (!r.sc) return '';
    return r.sc.pPct + '% of calories from protein (' + r.sc.p + '/55) · ' +
      r.macro.kcal + ' kcal per serving (' + r.sc.k + '/20) · ' +
      r.sc.fPct + '% from fat (' + r.sc.f + '/15) · storehouse‑only bonus (' + r.sc.x + '/10)';
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
          '<div class="sheet-eyebrow">' + esc(BOOKS[r.book].roman + ' · ' + r.secName + ' · No. ' + String(r.id).padStart(3, '0')) + '</div>' +
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
            (r.est ? '<div class="scorebox-why"><em>Book II shipped without nutrition figures. These macros are worked out from the ingredient list, so treat them as a good guess rather than a measurement.</em></div>' : '') +
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
        if (S.view !== 'book') S.allPages = false;
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
      S.allPages = false;
      renderBook();
    });
    $('doPrint').addEventListener('click', expandAndPrint);

    // Ctrl/Cmd-P from anywhere in the book view should print the whole thing
    window.addEventListener('beforeprint', function () {
      if (S.view === 'book' && !S.allPages) { S.allPages = true; renderBook(); }
    });
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
