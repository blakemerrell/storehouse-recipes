/* ---------------------------------------------------------------------------
 * Store — favorites, the weeks, and their shopping-list check-offs.
 *
 * Two modes:
 *   local   nothing configured, or no household joined. Everything lives in this
 *           browser's localStorage. Works offline, works from a file:// URL.
 *   synced  src/config.js is filled in and a household code has been entered.
 *           The same things live in one Firestore document that both phones
 *           watch, so a change on one appears on the other in about a second.
 *           localStorage still mirrors everything, so the app keeps working
 *           with no signal and catches up when it returns.
 *
 * A week is a name, seven days of recipe ids, and the ticks on the shopping
 * list it produces. There can be any number of them; one is active, and the
 * active one is what the Meal Plan and Shopping List tabs show. Which week is
 * active is shared too — the two of you are meant to be looking at one list.
 *
 * Writes are field-level on purpose: adding a recipe to Tuesday touches only
 * weeks.<id>.plan.tue, and ticking milk touches only that one key. Two people
 * editing at once do not overwrite each other.
 * ------------------------------------------------------------------------- */

window.Store = (function () {
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var LS = {
    favs: 'bsc.favs', weeks: 'bsc.weeks', active: 'bsc.active', house: 'bsc.house',
    plan: 'bsc.plan', checked: 'bsc.checked'   // the single week this replaced
  };

  /* The week carried over from the one-week version gets a fixed id, so if both
     phones do the conversion at the same moment they write the same thing
     rather than two copies of the same week. */
  var FIRST = 'w1';

  var state = { favs: [], weeks: {}, active: '', plan: {}, checked: {} };
  var status = 'local';       // local | connecting | synced | offline | error
  var statusNote = '';
  var house = '';
  var listeners = [];
  var db = null, doc = null, unsub = null, FV = null;

  // ---------------------------------------------------------------- helpers
  function read(k, d) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ }
  }
  function saveLocal() {
    write(LS.favs, state.favs); write(LS.weeks, state.weeks); write(LS.active, state.active);
  }
  function emit() { listeners.forEach(function (f) { f(state, status, statusNote, house); }); }
  function setStatus(s, note) { status = s; statusNote = note || ''; emit(); }

  /* Firestore field names cannot contain dots or slashes, and shopping-list
     keys are raw ingredient text. Encode once, use the same key everywhere. */
  function encodeKey(k) { return String(k).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, ''); }

  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

  function newId() {
    return 'w' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  }

  /* state.plan and state.checked are the active week's, kept as plain fields so
     the rest of the app never has to know which week it is looking at. */
  function derive() {
    var w = state.weeks[state.active];
    state.plan = obj(w && w.plan);
    state.checked = obj(w && w.checked);
  }

  function ids() {
    return Object.keys(state.weeks).sort(function (a, b) {
      var oa = state.weeks[a].ord || 0, ob = state.weeks[b].ord || 0;
      return oa - ob || (a < b ? -1 : 1);
    });
  }

  function nextOrd() {
    return Object.keys(state.weeks).reduce(function (n, k) {
      return Math.max(n, (state.weeks[k].ord || 0) + 1);
    }, 0);
  }

  function wpath(suffix) { return 'weeks.' + state.active + (suffix ? '.' + suffix : ''); }

  /* Take a document — from the network or from localStorage — and make it the
     state. Returns true if it held no weeks and one had to be made, which is
     how a household saved by the previous version is carried over. */
  function adopt(d) {
    var weeks = {}, raw = obj(d.weeks), made = false;
    Object.keys(raw).forEach(function (k) {
      var w = obj(raw[k]);
      weeks[k] = {
        name: typeof w.name === 'string' && w.name ? w.name : 'Untitled week',
        ord: typeof w.ord === 'number' ? w.ord : 0,
        plan: obj(w.plan), checked: obj(w.checked)
      };
    });
    if (!Object.keys(weeks).length) {
      weeks[FIRST] = { name: 'This Week', ord: 0, plan: obj(d.plan), checked: obj(d.checked) };
      made = true;
    }
    state.weeks = weeks;
    state.active = d.active && weeks[d.active] ? d.active : ids()[0];
    derive();
    return made;
  }

  function configured() {
    var c = window.FIREBASE_CONFIG;
    return !!(c && c.apiKey && c.projectId);
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = res;
      s.onerror = function () { rej(new Error('could not load ' + src)); };
      document.head.appendChild(s);
    });
  }

  // ------------------------------------------------------------- connecting
  function connect() {
    if (!configured() || !house) { setStatus('local'); return; }
    setStatus('connecting');

    var chain = window.firebase && window.firebase.firestore
      ? Promise.resolve()
      : loadScript(SDK + 'firebase-app-compat.js')
        .then(function () { return loadScript(SDK + 'firebase-auth-compat.js'); })
        .then(function () { return loadScript(SDK + 'firebase-firestore-compat.js'); });

    chain.then(function () {
      if (!window.firebase.apps.length) window.firebase.initializeApp(window.FIREBASE_CONFIG);
      db = window.firebase.firestore();
      FV = window.firebase.firestore.FieldValue;
      // keep working with no signal, and queue writes made while offline
      return db.enablePersistence({ synchronizeTabs: true }).catch(function () {});
    }).then(function () {
      return window.firebase.auth().signInAnonymously();
    }).then(function () {
      doc = db.collection('households').doc(house);
      return doc.get().then(function (snap) {
        // first device into a new household seeds it with whatever is already here
        if (!snap.exists) return doc.set({ favs: state.favs, weeks: state.weeks, active: state.active });
      });
    }).then(function () {
      if (unsub) unsub();
      unsub = doc.onSnapshot(function (snap) {
        var d = snap.data() || {};
        state.favs = Array.isArray(d.favs) ? d.favs.slice() : [];
        var made = adopt(d);
        saveLocal();
        setStatus(snap.metadata.fromCache ? 'offline' : 'synced');
        /* A household last written by the one-week version. Send the week up so
           the other phone sees the same thing; the old plan and checked fields
           are left alone rather than deleted, as a copy of what was there. */
        if (made) doc.set({ weeks: state.weeks, active: state.active }, { merge: true })
          .catch(function () {});
      }, function (err) {
        setStatus('error', err && err.code === 'permission-denied'
          ? 'Firestore refused the connection. Check the security rules in SETUP.md.'
          : (err && err.message) || 'Could not reach Firestore.');
      });
    }).catch(function (err) {
      setStatus('error', (err && err.message) || 'Could not start syncing. Still saving on this device.');
    });
  }

  // ------------------------------------------------------------------ writes
  function push(remote, localChange) {
    localChange();
    derive();
    saveLocal();
    emit();
    if (status === 'synced' || status === 'offline') {
      remote().catch(function (err) { setStatus('error', (err && err.message) || 'Write failed.'); });
    }
  }

  /* Store a day back. Anything cooked at its own serving count goes in as a
     plain id, so a week only carries the {i, x} form where it means something. */
  function writeDay(day, entries) {
    var list = entries.map(function (e) { return e.x === 1 ? e.id : { i: e.id, x: e.x }; });
    push(function () {
      var u = {}; u[wpath('plan.' + day)] = list; return doc.update(u);
    }, function () {
      editActive(function (w) { w.plan = Object.assign({}, w.plan); w.plan[day] = list; });
    });
  }

  // a shallow copy of the active week, safe to mutate and assign back
  function editActive(fn) {
    var weeks = Object.assign({}, state.weeks);
    var w = Object.assign({}, weeks[state.active]);
    fn(w);
    weeks[state.active] = w;
    state.weeks = weeks;
  }

  // ------------------------------------------------------------------ public
  return {
    get state() { return state; },
    get status() { return status; },
    get statusNote() { return statusNote; },
    get house() { return house; },
    get configured() { return configured(); },
    encodeKey: encodeKey,

    init: function (onChange) {
      listeners.push(onChange);
      state.favs = read(LS.favs, []);
      adopt({
        weeks: read(LS.weeks, null),
        active: read(LS.active, ''),
        plan: read(LS.plan, {}),        // whatever the one-week version left behind
        checked: read(LS.checked, {})
      });
      saveLocal();
      house = read(LS.house, '') || '';
      if (house && configured()) connect(); else setStatus('local');
    },

    isFav: function (id) { return state.favs.indexOf(id) >= 0; },

    toggleFav: function (id) {
      var on = state.favs.indexOf(id) < 0;
      push(function () {
        return doc.set({ favs: on ? FV.arrayUnion(id) : FV.arrayRemove(id) }, { merge: true });
      }, function () {
        state.favs = on ? state.favs.concat(id) : state.favs.filter(function (x) { return x !== id; });
      });
    },

    // ------------------------------------------------------------- the weeks
    /* [{id, name, active}] in the order they are shown. */
    weeks: function () {
      return ids().map(function (k) {
        return { id: k, name: state.weeks[k].name, active: k === state.active };
      });
    },

    activeWeek: function () {
      var w = state.weeks[state.active];
      return { id: state.active, name: (w && w.name) || 'This Week' };
    },

    setWeek: function (id) {
      if (!state.weeks[id] || id === state.active) return;
      push(function () { return doc.update({ active: id }); },
        function () { state.active = id; });
    },

    /* A new empty week, or a copy of the one showing. Copying takes the plan
       and not the ticks — the shopping has to be done again. */
    addWeek: function (name, copyCurrent) {
      var id = newId();
      var w = {
        name: String(name || '').trim() || 'New week', ord: nextOrd(),
        plan: copyCurrent ? JSON.parse(JSON.stringify(state.plan)) : {}, checked: {}
      };
      push(function () {
        var u = { active: id }; u['weeks.' + id] = w; return doc.update(u);
      }, function () {
        var weeks = Object.assign({}, state.weeks);
        weeks[id] = w; state.weeks = weeks; state.active = id;
      });
    },

    renameWeek: function (name) {
      var n = String(name || '').trim();
      if (!n || !state.weeks[state.active]) return;
      push(function () {
        var u = {}; u[wpath('name')] = n; return doc.update(u);
      }, function () {
        editActive(function (w) { w.name = n; });
      });
    },

    /* Never leave nothing to plan in — the last week empties instead. */
    deleteWeek: function () {
      var order = ids();
      if (order.length < 2) { this.clearPlan(); return; }
      var gone = state.active;
      var i = order.indexOf(gone);
      var next = order[i + 1] || order[i - 1];
      push(function () {
        var u = { active: next }; u['weeks.' + gone] = FV.delete(); return doc.update(u);
      }, function () {
        var weeks = Object.assign({}, state.weeks);
        delete weeks[gone];
        state.weeks = weeks; state.active = next;
      });
    },

    /* A day holds recipe ids. One cooked at anything other than its own serving
       count is stored as {i, x} instead, so a plain id still means "as written"
       and a week saved by an older version still reads. */
    day: function (day) {
      return (state.plan[day] || []).map(function (e) {
        return typeof e === 'object' && e ? { id: e.i, x: e.x || 1 } : { id: e, x: 1 };
      }).filter(function (e) { return typeof e.id === 'number'; });
    },

    scaleOf: function (id, day) {
      var hit = this.day(day).filter(function (e) { return e.id === id; })[0];
      return hit ? hit.x : 1;
    },

    addToDay: function (id, day, x) {
      var list = this.day(day).filter(function (e) { return e.id !== id; });
      list.push({ id: id, x: x || 1 });
      writeDay(day, list);
    },

    removeFromDay: function (id, day) {
      writeDay(day, this.day(day).filter(function (e) { return e.id !== id; }));
    },

    clearPlan: function () {
      // the shopping list goes with the week — leaving the check-offs behind
      // meant next week's list arrived with things already ticked off
      push(function () {
        var u = {}; u[wpath('plan')] = {}; u[wpath('checked')] = {}; return doc.update(u);
      }, function () {
        editActive(function (w) { w.plan = {}; w.checked = {}; });
      });
    },

    /* Forget check-offs for anything no longer on the list. Ticks are keyed by
       ingredient, so without this, buying milk one week left milk ticked the
       next time a recipe called for it — and an unticked box is the only thing
       telling you it still needs buying. */
    pruneChecked: function (liveKeys) {
      var live = {};
      liveKeys.forEach(function (k) { live[encodeKey(k)] = true; });
      var stale = Object.keys(state.checked).filter(function (k) { return !live[k]; });
      if (!stale.length) return false;
      push(function () {
        var u = {};
        stale.forEach(function (k) { u[wpath('checked.' + k)] = FV.delete(); });
        return doc.update(u);
      }, function () {
        editActive(function (w) {
          w.checked = Object.assign({}, w.checked);
          stale.forEach(function (k) { delete w.checked[k]; });
        });
      });
      return true;
    },

    isChecked: function (key) { return !!state.checked[encodeKey(key)]; },

    toggleChecked: function (key) {
      var k = encodeKey(key);
      var on = !state.checked[k];
      push(function () {
        var u = {}; u[wpath('checked.' + k)] = on ? true : FV.delete(); return doc.update(u);
      }, function () {
        editActive(function (w) {
          w.checked = Object.assign({}, w.checked);
          if (on) w.checked[k] = true; else delete w.checked[k];
        });
      });
    },

    /* A household code both of you type in once. Random rather than chosen:
       there is no password on the document, so the code is what keeps it yours. */
    newCode: function () {
      var words = ['KETTLE', 'PANTRY', 'HEARTH', 'BASKET', 'ORCHARD', 'HARVEST', 'CELLAR', 'GRANARY',
        'SKILLET', 'LADLE', 'THISTLE', 'JUNIPER', 'CLOVER', 'BRAMBLE', 'MEADOW', 'QUARRY'];
      var pick = function () { return words[Math.floor(Math.random() * words.length)]; };
      var n = String(Math.floor(1000 + Math.random() * 9000));
      return pick() + '-' + n + '-' + pick();
    },

    join: function (code) {
      house = String(code || '').trim().toUpperCase().replace(/\s+/g, '-');
      write(LS.house, house);
      if (unsub) { unsub(); unsub = null; }
      connect();
    },

    leave: function () {
      if (unsub) { unsub(); unsub = null; }
      house = ''; write(LS.house, '');
      doc = null;
      setStatus('local');
    }
  };
})();
