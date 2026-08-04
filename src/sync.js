/* ---------------------------------------------------------------------------
 * Store — favorites, the week's plan, and shopping-list check-offs.
 *
 * Two modes:
 *   local   nothing configured, or no household joined. Everything lives in this
 *           browser's localStorage. Works offline, works from a file:// URL.
 *   synced  src/config.js is filled in and a household code has been entered.
 *           The same three things live in one Firestore document that both
 *           phones watch, so a change on one appears on the other in about a
 *           second. localStorage still mirrors everything, so the app keeps
 *           working with no signal and catches up when it returns.
 *
 * Writes are field-level on purpose: adding a recipe to Tuesday touches only
 * plan.tue, and ticking milk touches only that one key. Two people editing at
 * once do not overwrite each other.
 * ------------------------------------------------------------------------- */

window.Store = (function () {
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var LS = { favs: 'bsc.favs', plan: 'bsc.plan', checked: 'bsc.checked', house: 'bsc.house' };

  var state = { favs: [], plan: {}, checked: {} };
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
    write(LS.favs, state.favs); write(LS.plan, state.plan); write(LS.checked, state.checked);
  }
  function emit() { listeners.forEach(function (f) { f(state, status, statusNote, house); }); }
  function setStatus(s, note) { status = s; statusNote = note || ''; emit(); }

  /* Firestore field names cannot contain dots or slashes, and shopping-list
     keys are raw ingredient text. Encode once, use the same key everywhere. */
  function encodeKey(k) { return String(k).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, ''); }

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
        if (!snap.exists) return doc.set({ favs: state.favs, plan: state.plan, checked: state.checked });
      });
    }).then(function () {
      if (unsub) unsub();
      unsub = doc.onSnapshot(function (snap) {
        var d = snap.data() || {};
        state = {
          favs: Array.isArray(d.favs) ? d.favs.slice() : [],
          plan: d.plan && typeof d.plan === 'object' ? d.plan : {},
          checked: d.checked && typeof d.checked === 'object' ? d.checked : {}
        };
        saveLocal();
        setStatus(snap.metadata.fromCache ? 'offline' : 'synced');
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
    saveLocal();
    emit();
    if (status === 'synced' || status === 'offline') {
      remote().catch(function (err) { setStatus('error', (err && err.message) || 'Write failed.'); });
    }
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
      state.plan = read(LS.plan, {});
      state.checked = read(LS.checked, {});
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

    addToDay: function (id, day) {
      var list = (state.plan[day] || []).slice();
      if (list.indexOf(id) >= 0) return;
      list.push(id);
      push(function () {
        var u = {}; u['plan.' + day] = list; return doc.update(u);
      }, function () {
        var plan = Object.assign({}, state.plan); plan[day] = list; state.plan = plan;
      });
    },

    removeFromDay: function (id, day) {
      var list = (state.plan[day] || []).filter(function (x) { return x !== id; });
      push(function () {
        var u = {}; u['plan.' + day] = list; return doc.update(u);
      }, function () {
        var plan = Object.assign({}, state.plan); plan[day] = list; state.plan = plan;
      });
    },

    clearPlan: function () {
      push(function () { return doc.set({ plan: {} }, { merge: true }); },
        function () { state.plan = {}; });
    },

    isChecked: function (key) { return !!state.checked[encodeKey(key)]; },

    toggleChecked: function (key) {
      var k = encodeKey(key);
      var on = !state.checked[k];
      push(function () {
        var u = {}; u['checked.' + k] = on ? true : FV.delete(); return doc.update(u);
      }, function () {
        var c = Object.assign({}, state.checked);
        if (on) c[k] = true; else delete c[k];
        state.checked = c;
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
