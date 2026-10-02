/* Today: the one screen a busy person opens.
 *
 * Blake, on who the app is for: "a heavy user who loves to track food and eat
 * clean and workout... and a busy mom wanting to eat well, and get a simple
 * workout in... and anyone in between." Everything this screen shows already
 * lives somewhere else (tonight's dinner in Plan, the day in Nourish, the next
 * session in Strengthen, the list in Shop) and each card is a door into the
 * full tab. It keeps no data and writes none: it reads window.Hive.today()
 * and window.Train.today(), and its buttons call the same functions the full
 * tabs do.
 *
 * Ordered by the clock: before two in the afternoon the day ahead (food, then
 * the workout), from two on the evening (tonight's dinner first). One main
 * button, on the first card; every other one is a plain button.
 */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }

  var ICON = {
    tonight: '<path d="M7 3v7a2 2 0 0 0 4 0V3"/><path d="M9 12v9"/><path d="M17 3c-1.8 1.2-2.6 3.4-2.6 6.2 0 2.2.9 3.6 2.6 3.8V21"/>',
    eating: '<path d="M5 20c0-8.5 6-15 15-15 0 9-6.5 15-14 15H5z"/><path d="M5 20l8-8"/>',
    workout: '<path d="M6.5 7v10"/><path d="M3.5 9.5v5"/><path d="M17.5 7v10"/><path d="M20.5 9.5v5"/><path d="M6.5 12h11"/>',
    shop: '<path d="M3 4h2.2l2.3 10.5h10.3l2-7.5H6.4"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="16.5" cy="19" r="1.4"/>',
    week: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/>',
    swap: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v5h-5"/>'
  };
  function icon(k, cls) {
    return '<svg class="' + (cls || 'td-ic') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICON[k] + '</svg>';
  }

  /* A card: its label as a heading (the screen reader's list of headings is
     the list of cards), a line of its own on the right, then the body. */
  /* `go` makes the whole card a door to its tab: a tap anywhere on it that
     is not one of its own buttons goes there, and the corner says where. */
  var TAB = { macros: 'Nourish', train: 'Strengthen' };
  function card(key, label, body, meta, go, done) {
    return '<section class="td-card' + (go ? ' td-go' : '') + (done ? ' td-fin' : '') + '" data-card="' + key + '"' +
        (go ? ' data-go="' + go + '"' : '') + ' aria-labelledby="td-' + key + '">' +
      '<div class="td-head"><span class="td-badge">' + (done ? CHECK : icon(key)) + '</span>' +
        '<h2 class="td-label" id="td-' + key + '">' + label + '</h2>' +
        (go ? '<button class="td-tab" data-td="go" data-go="' + go + '">' + TAB[go] + ' <span aria-hidden="true">\u203a</span></button>'
          : meta ? '<span class="td-meta">' + meta + '</span>' : '') + '</div>' +
      body + '</section>';
  }
  var CHECK = '<svg class="td-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function title(t) { return '<h3 class="td-title">' + t + '</h3>'; }
  function note(t) { return '<p class="td-note">' + t + '</p>'; }
  function facts(list) {
    list = list.filter(Boolean);
    return list.length ? '<p class="td-facts">' + list.map(esc).join(' <span aria-hidden="true">·</span> ') + '</p>' : '';
  }
  /* The main button on the first card, a plain one everywhere else. */
  function btn(main, act, label, extra) {
    return '<button class="' + (main ? 'btn-primary' : 'ghost') + ' td-btn" data-td="' + act + '"' + (extra || '') + '>' + label + '</button>';
  }
  function quiet(act, label) { return '<button class="nut-ask" data-td="' + act + '">' + label + '</button>'; }
  function acts(html) { return '<div class="td-acts">' + html + '</div>'; }

  // ---------------------------------------------------------------- tonight
  function tonightCard(d, main) {
    var t = d.tonight, nx = d.next.map(function (n) { return n.day + ': ' + n.name; }).join(' · ');
    if (t && t.lo) {
      return card('tonight', 'Tonight', title(esc(t.name)) +
        note('Leftovers from yesterday. Nothing to cook or buy.') +
        acts(btn(main, 'open', 'See the recipe', ' data-id="' + esc(t.id) + '"')) +
        (nx ? '<p class="td-next">' + esc(nx) + '</p>' : ''));
    }
    if (t) {
      return card('tonight', 'Tonight', title(esc(t.name)) +
        facts([t.time, t.x > 1 ? 'cooked ×' + t.x : '']) +
        acts(btn(main, 'open', 'Cook it', ' data-id="' + esc(t.id) + '"') +
          '<button class="iconbtn td-swap" data-td="swap" data-id="' + esc(t.id) + '" data-day="' + esc(t.day) + '" aria-label="Swap ' + esc(t.name) + ' for another dinner">' +
          icon('swap', 'td-sic') + '</button>') +
        (nx ? '<p class="td-next">' + esc(nx) + '</p>' : ''));
    }
    if (d.planned) {
      return card('tonight', 'Tonight', title('Nothing planned tonight') +
        (nx ? '<p class="td-next">' + esc(nx) + '</p>' : '') +
        acts(btn(main, 'addtonight', 'Add a dinner') + quiet('plan', 'See the week')));
    }
    return card('tonight', 'Dinners', title('Plan this week’s dinners') +
      note('A few questions, then dinners for the nights left this week, one shopping list and a Walmart cart.') +
      acts(btn(main, 'planweek', 'Plan my week')) + '<p class="td-small">About two minutes</p>');
  }

  // ----------------------------------------------------------------- eating
  function bar(name, have, want, unit, cls) {
    var pct = want > 0 ? Math.max(0, Math.min(100, Math.round(have / want * 100))) : 0;
    return '<div class="td-bar"><div class="td-bar-t"><span>' + name + '</span><span>' + fmt(have) + ' of ' + fmt(want) + unit + '</span></div>' +
      '<div class="td-meter ' + cls + '" role="meter" aria-label="' + name + '" aria-valuemin="0" aria-valuemax="' + Math.round(want) +
      '" aria-valuenow="' + Math.round(have) + '"><i style="width:' + pct + '%"></i></div></div>';
  }
  /* A meal on Today: a circle to tick it eaten, what it is, its calories.
     Eaten ones fold into one green line; the rest stay open. */
  function mealRow(m, next) {
    return '<div class="td-meal"><button class="td-tick" data-td="eat" data-k="' + esc(m.k) + '" aria-label="' + esc(m.n) + ' eaten"></button>' +
      '<span class="td-mt"><span class="td-ms">' + esc(m.n) + '</span><span class="td-mn">' + esc(m.name) +
        (next ? ' <span class="td-tag">next</span>' : '') + '</span></span>' +
      '<span class="td-kc">' + fmt(m.kcal) + ' cal</span></div>';
  }
  function eatenLine(ms) {
    var n = ms.map(function (m) { return m.n.toLowerCase(); }), kc = 0, p = 0;
    ms.forEach(function (m) { kc += m.kcal; p += m.p; });
    var say = n.length === 1 ? n[0] : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
    return '<button class="td-fold" data-td="go" data-go="macros">' + CHECK.replace('td-ic', 'td-fic') +
      '<span><b>' + esc(say.charAt(0).toUpperCase() + say.slice(1)) + ' eaten</b><small>' + fmt(kc) + ' cal \u00b7 ' + fmt(p) + ' g protein</small></span>' +
      '<i aria-hidden="true">\u203a</i></button>';
  }
  function eatingCard(e, main) {
    if (!e.set) {
      return card('eating', 'Eating', title('Set your numbers') +
        note('Your height and weight, and Nourish works out a calorie and protein target for you.') +
        acts(btn(main, 'numbers', 'Set my numbers') + quiet('addfood', 'Just log food for now')), '', 'macros');
    }
    var left = e.kcal.want - e.kcal.have, meals = e.meals || [];
    var big = '<p class="td-big"><b>' + fmt(Math.abs(left)) + '</b> ' + (left >= 0 ? 'left today' : 'over today') +
      (e.training ? '<span class="td-lift">Lifting day</span>' : '') + '</p>';
    var bars = bar('Calories', e.kcal.have, e.kcal.want, '', 'td-kcal') + bar('Protein', e.p.have, e.p.want, ' g', 'td-p');
    if (!meals.some(function (m) { return !m.empty; })) {
      return card('eating', 'Eating', big + title('Nothing planned for today') +
        note('Nourish can fill your day from the recipes, to your ' + fmt(e.kcal.want) + ' calories and ' + fmt(e.p.want) + ' g of protein. Or add what you eat as you go.') +
        bars + acts(btn(main, 'fill', 'Fill my day') + btn(false, 'addfood', 'Add food')), '', 'macros');
    }
    var eaten = meals.filter(function (m) { return m.eaten; }), open = meals.filter(function (m) { return !m.eaten && !m.empty; });
    return card('eating', 'Eating', big + (eaten.length ? eatenLine(eaten) : '') +
      (open.length ? '<div class="td-meals">' + open.map(function (m, i) { return mealRow(m, i === 0); }).join('') + '</div>' : '') +
      bars, '', 'macros');
  }

  // ---------------------------------------------------------------- workout
  function workoutCard(w, main) {
    if (!w) return '';
    if (w.live) {
      return card('workout', 'Workout', title('A workout is going') +
        acts(btn(main, 'train', 'Back to it')), '', 'train');
    }
    if (!w.block) {
      return card('workout', 'Workout', title('Find your program') +
        note('A plan for your week, at home or a gym, the time you have.') +
        acts(btn(main, 'train', 'Find my program')), '', 'train');
    }
    if (w.doneToday) {
      return card('workout', 'Workout done', '<p class="td-doneline">' + esc([w.doneName || 'Your workout', w.doneMins ? w.doneMins + ' min' : '',
          w.doneRecs ? '\ud83c\udfc5 ' + (w.doneRecs === 1 ? 'a new record' : w.doneRecs + ' new records') : ''].filter(Boolean).join(' \u00b7 ')) + '</p>',
        '', 'train', true);
    }
    if (w.finished) {
      return card('workout', 'Workout', title(esc(w.block) + ' is finished') +
        note('Every session done. Run it again, or build the next block.') +
        acts(btn(main, 'train', 'See the block')), '', 'train');
    }
    if (w.easy) {
      return card('workout', 'Workout', title('An easy day') +
        note('A walk, a ride, a swim: something easy that counts.') +
        acts(btn(main, 'train', 'Log it')), '', 'train');
    }
    var lifts = (w.lifts || []).slice(0, 5).map(function (l) {
      return '<li><span>' + esc(l.name) + '</span><span>' + esc(l.say) + '</span></li>';
    }).join('');
    var more = (w.lifts || []).length > 5 ? '<li class="td-more"><span>+' + (w.lifts.length - 5) + ' more</span></li>' : '';
    return card('workout', 'Workout', title(esc(w.name)) +
      facts([w.week || '', w.mins ? 'About ' + w.mins + ' min' : '', (w.lifts || []).length + ' exercises']) +
      (lifts ? '<ol class="td-lifts">' + lifts + more + '</ol>' : '') +
      acts(btn(main, 'start', 'Start')), '', 'train');
  }

  // --------------------------------------------------------------- shopping
  function shopCard(s) {
    if (!s.items) return '';
    var head = s.buy ? s.buy + (s.buy === 1 ? ' thing' : ' things') + ' to buy' : 'Nothing left to buy';
    return card('shop', 'Shopping', title(head) +
      facts([s.buy && s.usd >= 0.5 ? 'about $' + (s.usd < 10 ? s.usd.toFixed(2) : Math.round(s.usd)) : '',
        s.src ? s.src + ' from ' + s.srcName : '']) +
      (s.wm ? '<a class="wm-btn td-wm" href="' + esc(s.wm.href) + '" target="_blank" rel="noopener">' + s.wmMark +
        'Add ' + s.wm.n + (s.wm.n === 1 ? ' item' : ' items') + ' to Walmart cart</a>' : '') +
      acts(btn(false, 'list', 'Open the list')));
  }

  // -------------------------------------------------------------- this week
  function weekCard(d) {
    var T = window.Train, ld = T && T.liftDays ? T.liftDays() : null, hp = d.help || { d: true, w: true };
    var lifts = hp.w && !!(T && (ld || (d.workout && d.workout.block)));
    var mark = function (k) { return '<span class="td-mk td-' + k + '" aria-hidden="true"></span>'; };
    var cols = d.week.map(function (day) {
      var dinner = day.dinner ? (day.past ? 'done' : day.today ? 'now' : 'plan') : 'none';
      var lift = 'none';
      if (lifts) {
        var done = !!(T.trainedOn && (T.trainedOn(day.tk) || []).length);
        var planned = ld && ld.indexOf((day.dow + 6) % 7) >= 0;
        lift = done ? 'done' : day.today && planned ? 'now' : planned && !day.past ? 'plan' : 'rest';
      }
      return { day: day, dinner: dinner, lift: lift };
    });
    var head = cols.map(function (c) {
      return '<span class="td-wd' + (c.day.today ? ' today' : '') + '">' + c.day.letter + '<b>' + c.day.date + '</b></span>';
    }).join('');
    var row = function (label, key) {
      return '<span class="td-wl">' + label + '</span>' + cols.map(function (c) { return '<span class="td-wc">' + mark(c[key]) + '</span>'; }).join('');
    };
    /* Nothing planned and nothing lifted is no week to show yet. */
    if (cols.every(function (c) { return (!hp.d || c.dinner === 'none') && (c.lift === 'none' || c.lift === 'rest'); })) return '';
    var say = hp.d ? cols.filter(function (c) { return c.dinner !== 'none'; }).length + ' of 7 dinners planned'
      : cols.filter(function (c) { return c.lift === 'done'; }).length + ' workouts this week';
    return card('week', 'This week',
      '<div class="td-week" role="img" aria-label="' + esc(say) + '"><span class="td-wl"></span>' + head + (hp.d ? row('Dinner', 'dinner') : '') +
        (lifts ? row('Lift', 'lift') : '') + '</div>');
  }

  // ------------------------------------------------------------------ draw
  var DAYNAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function render() {
    var root = document.getElementById('todayRoot');
    if (!root || !window.Hive || !window.Hive.today) return;
    var d = window.Hive.today();
    d.workout = window.Train && window.Train.today ? window.Train.today() : null;
    var evening = d.date.getHours() >= 14;
    /* The day ahead in the morning; the evening once it is afternoon. A
       workout already done steps back behind the rest. */
    var order = evening ? ['tonight', 'eating', 'workout'] : ['eating', 'workout', 'tonight'];
    /* A workout already done folds to one green card at the very bottom. */
    var doneW = d.workout && d.workout.doneToday;
    if (doneW) order = order.filter(function (k) { return k !== 'workout'; });
    /* Only what this person asked for help with (the front door, or Share &
       settings): dinners and the shopping, eating, workouts. */
    var hp = d.help || { d: true, e: true, w: true };
    order = order.filter(function (k) { return k === 'tonight' ? hp.d : k === 'eating' ? hp.e : hp.w; });
    var make = {
      tonight: function (main) { return tonightCard(d, main); },
      eating: function (main) { return eatingCard(d.eating, main); },
      workout: function (main) { return workoutCard(d.workout, main); }
    };
    var first = true, html = '';
    order.forEach(function (k) {
      var h = make[k](first);
      if (h) { html += h; first = false; }
    });
    d.shop.wmMark = d.wmMark || '';
    html += (hp.d ? shopCard(d.shop) : '') + (hp.d || hp.w ? weekCard(d) : '') + (doneW && hp.w ? workoutCard(d.workout, false) : '');
    root.innerHTML = '<div class="td-top"><div class="step-k">' + DAYNAME[d.date.getDay()] + ' · ' + MONTH[d.date.getMonth()] + ' ' + d.date.getDate() + '</div>' +
      '<h1 class="step-h td-h">Today</h1></div><div class="td-cards">' + html + '</div>';
  }

  /* The doors. Each is the same function the full tab runs. */
  document.addEventListener('click', function (e) {
    if (!e.target.closest || !window.Hive) return;
    var b = e.target.closest('#todayRoot [data-td]');
    if (!b) {
      /* Anywhere else on a card that is a door: its tab. Not on a link, and
         not when the tap was the end of selecting text. */
      var c = e.target.closest('#todayRoot .td-go');
      if (c && !e.target.closest('a') && !(window.getSelection && String(window.getSelection()))) window.Hive.go(c.getAttribute('data-go'));
      return;
    }
    var H = window.Hive, a = b.getAttribute('data-td'), id = b.getAttribute('data-id');
    if (a === 'go') { H.go(b.getAttribute('data-go')); return; }
    if (a === 'eat') { H.eat(b.getAttribute('data-k')); return; }
    if (a === 'open') H.open(id);
    else if (a === 'swap') H.swap(id, b.getAttribute('data-day'));
    else if (a === 'planweek') H.planWeek();
    else if (a === 'addtonight') H.addTonight();
    else if (a === 'plan') H.go('plan');
    else if (a === 'numbers') H.numbers();
    else if (a === 'addfood') H.addFood();
    else if (a === 'fill') H.fill();
    else if (a === 'list') H.go('list');
    else if (a === 'start') { if (window.Train && window.Train.startToday) window.Train.startToday(); H.go('train'); }
    else if (a === 'train') H.go('train');
  });

  window.Today = { render: render };
})();
