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
    mine: 'bsc.mine', edits: 'bsc.edits',
    /* These two were missing for as long as the pantry has existed. saveLocal
       wrote to LS.pantry and LS.pantryNew, both of which were undefined, so
       both calls landed on one localStorage key literally named "undefined" —
       the second overwriting the first — and init read that same key back into
       both fields. Every "I don't keep this" answer died on the next reload,
       and state.pantry came back holding the {l,c} shape of pantryNew rather
       than the 1/0 the rest of this file expects. */
    pantry: 'bsc.pantry', pantryNew: 'bsc.pantryNew',
    plan: 'bsc.plan', checked: 'bsc.checked'   // the single week this replaced
  };

  /* What the bug left behind. pantryNew was written second, so the stray key
     holds the shelf items somebody typed in by hand — the part that cannot be
     reconstructed from anything else. The overrides that were written first
     are not recoverable; they were overwritten on every save. Read once, moved
     to its proper key, and the stray removed so this never runs again. */
  function rescueStrayPantry() {
    try {
      if (localStorage.getItem('bsc.pantryNew') === null) {
        var stray = localStorage.getItem('undefined');
        if (stray) localStorage.setItem('bsc.pantryNew', stray);
      }
      localStorage.removeItem('undefined');
    } catch (e) { /* private mode: nothing to rescue and nowhere to put it */ }
  }

  /* The week carried over from the one-week version gets a fixed id, so if both
     phones do the conversion at the same moment they write the same thing
     rather than two copies of the same week. */
  var FIRST = 'w1';

  /* mine  recipes written here, keyed by their own id
     edits  changes to a printed recipe, keyed by its number — kept apart from
            the recipe so the original is never lost and can always be restored */
  var state = { favs: [], weeks: {}, active: '', plan: {}, checked: {}, mine: {}, edits: {},
    /* The shelf. `pantry` holds only the answers that differ from the book's
       — key -> 1 kept, 0 not — so a household that changes nothing carries
       nothing, and a food added to the storehouse list later is picked up
       rather than frozen at whatever it was the day someone first looked.
       `pantryNew` is what they keep that the books never mention. */
    pantry: {}, pantryNew: {} };
  /* local      not sharing — this phone only
     connecting  joined, still waiting for the first word from the server
     synced      the server has everything this phone has
     sending     changes made here have not been acknowledged yet
     waiting     no signal, and nothing of ours is queued — we may be missing theirs
     error       sharing has stopped, and statusNote says why

     "offline" used to cover the last three at once, which is why it explained
     nothing: it was equally the state of a phone that had just been opened, a
     phone holding an unsent change, and a phone that had simply lost signal.
     Those want three different sentences from the person reading them. */
  var status = 'local';
  var lastSync = 0;           // when the server last confirmed, ms
  var everLive = false;       // have we heard from the server at all this session
  var statusNote = '';
  var house = '';
  var pendingMerge = false;   // set by join(), consumed by the next connect()
  var queued = [];            // writes made before the connection was up
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
    write(LS.mine, state.mine); write(LS.edits, state.edits);
    write(LS.pantry, state.pantry); write(LS.pantryNew, state.pantryNew);
  }
  function emit() { listeners.forEach(function (f) { f(state, status, statusNote, house); }); }
  function setStatus(s, note) { status = s; statusNote = note || ''; emit(); }

  /* Firestore field names cannot contain dots or slashes, and shopping-list
     keys are raw ingredient text. Encode once, use the same key everywhere. */
  function encodeKey(k) { return String(k).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, ''); }

  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

  /* A map of recipes, with anything the app cannot render dropped. The book
     number is the one the renderer indexes with and the one that took the page
     down when it was wrong; name, ing and steps are the three the sheet reads
     without checking. Everything else has a default somewhere downstream. */
  function sane(v) {
    var src = obj(v), out = {};
    Object.keys(src).forEach(function (k) {
      var r = src[k];
      if (!r || typeof r !== 'object' || Array.isArray(r)) return;
      if (r.book !== 1 && r.book !== 2 && r.book !== 3) return;
      if (typeof r.name !== 'string') return;
      if (!Array.isArray(r.ing) || !Array.isArray(r.steps)) return;
      out[k] = r;
    });
    return out;
  }

  function newId() {
    return 'w' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  }

  /* Sixty-four words rather than sixteen, and drawn from the machine's own
     randomness rather than Math.random.

     The code is the only thing standing between a household and anybody else,
     and the rules let any signed-in client fetch a household by name — they
     have to, that is how joining works. Sixteen words either side of four
     digits is 2.3 million codes, which is a number a script can walk. Sixty-
     four either side is 36.9 million, sixteen times the work, for a code that
     is exactly as long to say down the phone and exactly as easy to type.
     Words are still concrete nouns with no near-homophones in the list, since
     these get read aloud across a kitchen.

     And Math.random is not unpredictable — it is not meant to be. Somewhere
     that a guessed value costs somebody their grocery list, the browser's
     crypto is free and right. Old codes keep working; nothing about joining
     changed, only what a new one is drawn from. */
  var CODE_WORDS = [
    'KETTLE', 'PANTRY', 'HEARTH', 'BASKET', 'ORCHARD', 'HARVEST', 'CELLAR', 'GRANARY',
    'SKILLET', 'LADLE', 'THISTLE', 'JUNIPER', 'CLOVER', 'BRAMBLE', 'MEADOW', 'QUARRY',
    'ANVIL', 'BARLEY', 'BEACON', 'BELLOWS', 'BIRCH', 'BRIDLE', 'BUTTER', 'CANDLE',
    'CANYON', 'CIDER', 'COBBLE', 'COMPASS', 'COPPER', 'CRADLE', 'DAMSON', 'FENNEL',
    'FURROW', 'GARLAND', 'GINGER', 'HAMMOCK', 'HAYLOFT', 'HOLLOW', 'HONEY', 'KINDLING',
    'LANTERN', 'LATTICE', 'MARROW', 'MILLET', 'MORTAR', 'NUTMEG', 'PADDOCK', 'PARSNIP',
    'PEBBLE', 'PEWTER', 'PIGEON', 'QUILT', 'RAFTER', 'RHUBARB', 'SADDLE', 'SORREL',
    'SPINDLE', 'TANSY', 'THIMBLE', 'TIMBER', 'TROWEL', 'VELVET', 'WALNUT', 'WILLOW'
  ];

  /* Uniform over `n`. Taking a random byte modulo 64 happens to be uniform,
     but taking one modulo 9000 is not, and a lopsided draw is a smaller
     keyspace than it looks. Rejection sampling costs nothing here. */
  function rnd(n) {
    var c = window.crypto || window.msCrypto;
    if (c && c.getRandomValues) {
      var limit = Math.floor(4294967296 / n) * n, v = new Uint32Array(1);
      do { c.getRandomValues(v); } while (v[0] >= limit);
      return v[0] % n;
    }
    return Math.floor(Math.random() * n);
  }

  function newCodeStr() {
    var pick = function () { return CODE_WORDS[rnd(CODE_WORDS.length)]; };
    return pick() + '-' + String(1000 + rnd(9000)) + '-' + pick();
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
    /* Recipes arrive from the shared document, which means they arrive from
       somebody else's phone — an older version of the app, a half-finished
       write, a field that lost its type on the way. One record without a
       `book` the app knows took every render down, on every other phone in the
       household, with nothing on screen to say why and no way back except
       clearing the browser. So they are checked at the door, where a bad one
       costs its own recipe and nothing else. */
    state.mine = sane(d.mine);
    state.edits = sane(d.edits);
    /* The shelf travelled one way only. setPantry and addPantryItem have
       always written pantry.<key> and pantryNew.<key> up to the document, but
       nothing ever read them back — so the second phone in a household never
       saw a word of it, and a phone that cleared its browser could not recover
       its own. */
    /* Only when the document actually carries them. A household written by any
       version before this one has no pantry field at all, and treating that as
       "the shelf is empty" would clear the very answers this change exists to
       keep — on the first load after the upgrade, before the phone had any
       chance to contribute them. An emptied shelf is a different thing and
       looks different: resetPantry writes pantry: {}, which is present. */
    if (d.pantry !== undefined) state.pantry = obj(d.pantry);
    if (d.pantryNew !== undefined) state.pantryNew = obj(d.pantryNew);
    derive();
    return made;
  }

  /* Has anybody been put on a day of this week. An empty week is not worth
     carrying into a household that already has weeks in it. */
  function planned(w) {
    var plan = obj(w && w.plan);
    return Object.keys(plan).some(function (d) {
      return Array.isArray(plan[d]) && plan[d].length;
    });
  }

  function samePlan(a, b) {
    try { return JSON.stringify(obj(a)) === JSON.stringify(obj(b)); } catch (e) { return false; }
  }

  /* What this phone has that the household has not.
   *
   * Joining used to replace. adopt() overwrote the favorites, the weeks, the
   * edits and the recipes somebody had written themselves with whatever the
   * household held, and only the first device into a new household seeded it —
   * so the second one in always lost everything, with no warning and no undo.
   * That is the exact case the app invites: two people who have each been
   * using it, putting both phones on one list.
   *
   * So a join contributes instead. Favorites are a union. Recipes written here
   * and edits made here arrive under their own keys, and where both sides have
   * touched the same one the household's copy stands — it is the shared record
   * and this is a phone arriving at it.
   *
   * Weeks are the awkward part, because a fresh phone and a fresh household
   * both call their first week w1: the ids collide while the plans do not. So
   * a local week comes across when the household has nothing under that id, or
   * has something different under it, in which case it arrives under a new id
   * and both are kept. A name already in use gets a number after it, or the
   * household ends up with two weeks called This Week and no way to tell them
   * apart.
   *
   * Returns null when there is nothing to add, which is the ordinary case —
   * rejoining a household this phone already mirrors contributes nothing. */
  function contribute(d) {
    var out = {}, any = false;

    var theirFavs = Array.isArray(d.favs) ? d.favs : [];
    var favs = theirFavs.slice();
    state.favs.forEach(function (id) { if (favs.indexOf(id) < 0) favs.push(id); });
    if (favs.length !== theirFavs.length) { out.favs = favs; any = true; }

    /* pantry and pantryNew join these because they are the same shape of
       thing: a map keyed by something stable, where a key this phone has and
       the household has not is a contribution rather than a conflict. A shelf
       answer the household already holds stands, like everything else here. */
    ['mine', 'edits', 'pantry', 'pantryNew'].forEach(function (k) {
      var theirs = obj(d[k]), mine = obj(state[k]), add = {};
      Object.keys(mine).forEach(function (id) {
        if (!(id in theirs)) add[id] = mine[id];
      });
      if (Object.keys(add).length) { out[k] = add; any = true; }
    });

    var theirWeeks = obj(d.weeks), addW = {};
    var used = Object.keys(theirWeeks).map(function (k) { return theirWeeks[k].name; });
    var ord = Object.keys(theirWeeks).reduce(function (n, k) {
      return Math.max(n, (theirWeeks[k].ord || 0) + 1);
    }, 0);
    Object.keys(state.weeks).forEach(function (id) {
      var w = state.weeks[id];
      if (!planned(w)) return;
      var mirror = theirWeeks[id];
      if (mirror && samePlan(mirror.plan, w.plan)) return;   // already there under this id
      var name = w.name || 'This Week', n = 2;
      while (used.indexOf(name) >= 0) { name = (w.name || 'This Week') + ' (' + n++ + ')'; }
      used.push(name);
      addW[mirror ? newId() : id] = {
        name: name, ord: ord++, plan: obj(w.plan), checked: obj(w.checked)
      };
    });
    if (Object.keys(addW).length) { out.weeks = addW; any = true; }

    return any ? out : null;
  }

  /* Exposed for tests/joining.test.js. What this does is the difference
     between joining a household and losing everything on the phone that
     joined, and it is worth checking without a network in front of it. */
  window.__contribute = function (d) { return contribute(d); };

  /* Also for tests. Both of these are invisible from outside and both are
     places a change quietly went missing: pendingMerge decides whether the
     next connect contributes or adopts, and queued holds the writes made
     before there was anywhere to send them. */
  window.__syncDebug = function () {
    return { pendingMerge: pendingMerge, queued: queued.length, status: status };
  };

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
  /* The SDK, the app, offline persistence and the anonymous sign-in. Once,
     however many things ask for it — connecting to a household and claiming a
     new code both need all of it, and doing it twice would sign in twice. The
     promise is dropped again on failure so a later attempt can retry rather
     than inheriting the first one's error forever. */
  var readyP = null;
  function ready() {
    if (readyP) return readyP;
    readyP = (window.firebase && window.firebase.firestore
      ? Promise.resolve()
      : loadScript(SDK + 'firebase-app-compat.js')
        .then(function () { return loadScript(SDK + 'firebase-auth-compat.js'); })
        .then(function () { return loadScript(SDK + 'firebase-firestore-compat.js'); })
    ).then(function () {
      if (!window.firebase.apps.length) window.firebase.initializeApp(window.FIREBASE_CONFIG);
      db = window.firebase.firestore();
      FV = window.firebase.firestore.FieldValue;
      // keep working with no signal, and queue writes made while offline
      return db.enablePersistence({ synchronizeTabs: true }).catch(function () {});
    }).then(function () {
      return window.firebase.auth().signInAnonymously();
    });
    readyP.catch(function () { readyP = null; });
    return readyP;
  }

  // everything a household document holds, as this phone currently has it
  function localDoc() {
    return {
      favs: state.favs, weeks: state.weeks, active: state.active,
      mine: state.mine, edits: state.edits,
      pantry: state.pantry, pantryNew: state.pantryNew
    };
  }

  function connect() {
    if (!configured() || !house) { setStatus('local'); return; }
    setStatus('connecting');

    /* Only an explicit join contributes. connect() also runs on every page
       load, and merging then would be wrong in a way that is hard to see: this
       phone's mirror is stale by definition, so anything the other phone had
       deleted since would be put back by the phone that had not heard yet. */
    var merging = pendingMerge;

    ready().then(function () {
      doc = db.collection('households').doc(house);
      return doc.get().then(function (snap) {
        // first device into a new household seeds it with whatever is already here
        if (!snap.exists) { pendingMerge = false; return doc.set(localDoc()); }
        if (!merging) return;
        var add = contribute(snap.data() || {});
        /* Only once the contribution is actually away. This used to be cleared
           at the top of connect(), which meant a join attempted with no signal
           threw the intention away while join() had already written the house
           code to localStorage — so the next launch adopted the household over
           the top of this phone instead of contributing to it, which is the
           very thing contribute() exists to prevent, moved into the failure
           path where nobody would see it. */
        return Promise.resolve(add ? doc.set(add, { merge: true }) : null)
          .then(function () { pendingMerge = false; });
      });
    }).then(flushQueued).then(function () {
      if (unsub) unsub();
      unsub = doc.onSnapshot(function (snap) {
        var d = snap.data() || {};
        state.favs = Array.isArray(d.favs) ? d.favs.slice() : [];
        var made = adopt(d);
        saveLocal();
        /* Firestore answers a new listener out of its own cache first and the
           server a moment later, so a cache-only snapshot means "not yet" on
           the first one and "lost signal" on the hundredth. everLive is what
           tells those apart — without it the app announced OFFLINE half a
           second after opening, on a phone with five bars. */
        if (!snap.metadata.fromCache) { everLive = true; lastSync = Date.now(); }
        setStatus(snap.metadata.hasPendingWrites ? 'sending'
          : snap.metadata.fromCache ? (everLive ? 'waiting' : 'connecting')
            : 'synced');
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
    /* Any state where we are actually joined. Firestore queues a write made
       with no signal and sends it when there is some, so refusing to try is
       the one thing that would genuinely lose it. */
    if (doc && status !== 'local' && status !== 'error') {
      remote().catch(function (err) { setStatus('error', (err && err.message) || 'Write failed.'); });
      return;
    }
    /* Not local, but not able to send either: `doc` is null for the second or
       two it takes to fetch three scripts and sign in, and stays null after a
       failure. A tap in that window used to be applied here and then dropped —
       Firestore never saw it, so its own offline queue never held it, and the
       first snapshot to arrive adopted the household over the top of it. Held
       here instead, and sent by connect() before it starts listening. */
    if (house && configured()) queued.push(remote);
  }

  /* In order, and not cleared until they are away — a flush that fails must
     leave the work where it was rather than swallowing it a second time. */
  function flushQueued() {
    if (!queued.length) return Promise.resolve();
    var sending = queued.slice();
    return sending.reduce(function (p, fn) { return p.then(function () { return fn(); }); },
      Promise.resolve()).then(function () { queued = queued.slice(sending.length); });
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
    /* When the server last confirmed it had everything. 0 if it never has. */
    get lastSync() { return lastSync; },
    get house() { return house; },
    get configured() { return configured(); },
    encodeKey: encodeKey,

    /* The signed-in Firestore handle, for the one thing in this app that
       deliberately does not go through this file. My Day is personal — it
       has been kept out of the household document on purpose since it was
       built — but "personal" was only ever an argument about WHOSE data it
       is, never about which devices should see it. It borrows the connection
       and keeps its own document. */
    ready: function () { return ready().then(function () { return db; }); },

    init: function (onChange) {
      listeners.push(onChange);
      rescueStrayPantry();
      state.favs = read(LS.favs, []);
      /* The pantry goes through adopt with everything else now that adopt
         restores it — reading it into state first and then calling adopt would
         hand it straight back an empty document and undo the read. */
      adopt({
        weeks: read(LS.weeks, null),
        active: read(LS.active, ''),
        mine: read(LS.mine, {}),
        edits: read(LS.edits, {}),
        pantry: read(LS.pantry, {}),
        pantryNew: read(LS.pantryNew, {}),
        plan: read(LS.plan, {}),        // whatever the one-week version left behind
        checked: read(LS.checked, {})
      });
      saveLocal();
      house = read(LS.house, '') || '';
      if (house && configured()) connect(); else setStatus('local');

      /* A way out of 'error'. It used to latch for the whole session: the SDK
         fails to load on a phone with no bars, status goes to error, and
         nothing ever tried again — so everything after that was held in the
         queue above with nowhere to go until the app was killed and reopened.
         Coming back onto a network is the moment to retry, and connect() is
         safe to call twice: it drops the old listener before taking a new one. */
      if (window.addEventListener) {
        window.addEventListener('online', function () {
          if (house && configured() && (status === 'error' || status === 'waiting')) connect();
        });

        /* Two tabs of the app used to be two separate copies of everything.
           Each held the state it had read at load, each wrote the whole of it
           on every change, and neither ever looked again — so planning a week
           in one tab and ticking the list in the other meant whichever saved
           last erased the other's work, including recipes somebody had
           written. A household hides it, because Firestore tells both tabs;
           on a phone with no sharing set up there was nothing to tell them.

           The storage event fires only in the *other* tabs, which is exactly
           the ones that need to hear. Firestore's own synchronizeTabs handles
           the joined case, so this only steps in when there is no household. */
        window.addEventListener('storage', function (e) {
          if (house || !e || !e.key || e.key.indexOf('bsc.') !== 0) return;
          if (e.key === LS.house) return;
          state.favs = read(LS.favs, []);
          adopt({
            weeks: read(LS.weeks, null), active: read(LS.active, ''),
            mine: read(LS.mine, {}), edits: read(LS.edits, {}),
            pantry: read(LS.pantry, {}), pantryNew: read(LS.pantryNew, {})
          });
          emit();
        });
      }
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
      }).filter(function (e) { return e.id !== undefined && e.id !== null && e.id !== ''; });
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

    // ------------------------------------------------- recipes of your own
    /* Written here rather than printed. Ids are strings so they can never
       collide with the numbered ones, and so a glance at an id tells you
       which kind you are holding. */
    /* ------------------------------------------------------------ the shelf
       What this household actually keeps. The books were written against the
       storehouse order, and every recipe records whether the storehouse
       carried each ingredient — but that is a fact about a shop, not about a
       kitchen. Once someone stops ordering from it, the useful question is
       whether *they* have the thing in, which is the same question a recipe
       has always been answering with "Also needs".

       Overrides only. A food nobody has touched follows the book, so a change
       to the storehouse list still arrives instead of being pinned to whatever
       it was the day someone first opened this tab. */
    pantryHas: function (key, dflt) {
      var o = state.pantry[key];
      if (o === 1 || o === 0) return o === 1;
      if (state.pantryNew[key]) return true;
      return !!dflt;
    },

    setPantry: function (key, on) {
      push(function () {
        var u = {}; u['pantry.' + encodeKey(key)] = on ? 1 : 0; return doc.update(u);
      }, function () {
        state.pantry = Object.assign({}, state.pantry); state.pantry[key] = on ? 1 : 0;
      });
    },

    /* Back to the book: clear the overrides rather than write today's answer
       into all 114 of them. */
    resetPantry: function () {
      push(function () { return doc.set({ pantry: {} }, { merge: true }); },
        function () { state.pantry = {}; });
    },

    addPantryItem: function (label, cat) {
      var key = 'own_' + encodeKey(String(label).toLowerCase());
      var item = { l: String(label).trim(), c: cat || 'Yours' };
      push(function () {
        var u = {}; u['pantryNew.' + key] = item; return doc.update(u);
      }, function () {
        state.pantryNew = Object.assign({}, state.pantryNew); state.pantryNew[key] = item;
      });
      return key;
    },

    renamePantryItem: function (key, label) {
      if (!state.pantryNew[key]) return;
      var item = Object.assign({}, state.pantryNew[key], { l: String(label).trim() });
      push(function () {
        var u = {}; u['pantryNew.' + key] = item; return doc.update(u);
      }, function () {
        state.pantryNew = Object.assign({}, state.pantryNew); state.pantryNew[key] = item;
      });
    },

    removePantryItem: function (key) {
      if (!state.pantryNew[key]) return;
      push(function () {
        var u = {}; u['pantryNew.' + key] = FV.delete(); return doc.update(u);
      }, function () {
        state.pantryNew = Object.assign({}, state.pantryNew); delete state.pantryNew[key];
      });
    },

    pantryOwn: function () { return state.pantryNew; },
    pantryChanged: function () {
      return Object.keys(state.pantry).length + Object.keys(state.pantryNew).length;
    },

    newRecipeId: function () {
      return 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    },

    saveRecipe: function (rec) {
      var id = rec.id;
      var own = typeof id === 'string';
      var field = (own ? 'mine.' : 'edits.') + id;
      push(function () {
        var u = {}; u[field] = rec; return doc.update(u);
      }, function () {
        var m = Object.assign({}, own ? state.mine : state.edits);
        m[id] = rec;
        if (own) state.mine = m; else state.edits = m;
      });
    },

    /* Deletes one of yours. On a printed recipe it drops the changes instead,
       which puts the book's own version back. */
    /* Delete it everywhere it is referred to, not only where it is stored.
     *
     * This used to remove the record and stop. A recipe of your own that was
     * on Monday stayed on Monday: the plan kept its id, the day rendered empty
     * because nothing could be found to draw, and the dead id went on syncing
     * to every phone in the household. Copy that week and you copied the
     * ghost with it.
     *
     * Favorites had the same hole. Neither shows up as an error — an id that
     * matches nothing is skipped by every reader — which is exactly why it
     * would have sat there.
     *
     * Only own recipes can strand a reference this way: an edit to a printed
     * recipe is a layer over something that still exists, so reverting it
     * leaves the original in the week, which is right. */
    deleteRecipe: function (id) {
      var own = typeof id === 'string';
      var field = (own ? 'mine.' : 'edits.') + id;
      var idOfEntry = function (e) { return typeof e === 'object' && e ? e.i : e; };

      push(function () {
        var u = {}; u[field] = FV.delete();
        return doc.update(u).then(function () {
          if (!own) return null;
          /* The whole weeks object, because the id may be on any day of any
             week and Firestore has no way to pull one value out of many
             nested arrays in a single update. */
          return doc.set({ favs: FV.arrayRemove(id), weeks: state.weeks }, { merge: true });
        });
      }, function () {
        var m = Object.assign({}, own ? state.mine : state.edits);
        delete m[id];
        if (own) state.mine = m; else state.edits = m;
        if (!own) return;

        state.favs = state.favs.filter(function (x) { return x !== id; });
        Object.keys(state.weeks).forEach(function (k) {
          var plan = state.weeks[k].plan || {};
          Object.keys(plan).forEach(function (d) {
            var kept = (plan[d] || []).filter(function (e) { return idOfEntry(e) !== id; });
            if (kept.length) plan[d] = kept; else delete plan[d];
          });
        });
      });
    },

    /* A household code both of you type in once. Random rather than chosen:
       there is no password on the document, so the code is what keeps it yours.
       This only draws one — createHousehold is what makes sure it is free. */
    newCode: newCodeStr,

    /* Claim a code nobody is using.
     *
     * newCode() draws from sixteen words, four digits and sixteen words: 2.3
     * million codes, which sounds ample and is not, because nothing ever
     * releases one. The birthday sum puts some pair of households colliding at
     * roughly one in five hundred by a hundred households, one in twenty by
     * five hundred, and even money by eighteen hundred — and a collision is
     * two families silently sharing a grocery list.
     *
     * In a transaction, because a plain get-then-set has a gap in it and the
     * gap is exactly where the collision lives. With no signal a transaction
     * cannot run at all, so the code is taken anyway rather than blocking
     * setup; connect() seeds it when there is signal, and a household created
     * on a phone with no bars is not one somebody else is racing for.
     *
     * `preferred` is the code already on screen. It is tried first so that the
     * code somebody is reading is the code they get, every time but the rare
     * one. */
    createHousehold: function (preferred) {
      var self = this, tries = 0;

      function attempt(code) {
        var ref = db.collection('households').doc(code);
        return db.runTransaction(function (t) {
          return t.get(ref).then(function (snap) {
            if (snap.exists) throw new Error('taken');
            t.set(ref, localDoc());
          });
        }).then(function () { return { code: code, seeded: true }; }, function (err) {
          if (err && err.message === 'taken' && ++tries < 6) return attempt(newCodeStr());
          // no signal, or six unlucky draws: take it, but do not claim it is ours
          return { code: code, seeded: false };
        });
      }

      return ready()
        .then(function () { return attempt(preferred || newCodeStr()); })
        .catch(function () { return { code: preferred || newCodeStr(), seeded: false }; })
        .then(function (res) {
          /* seeded only where the transaction actually ran and wrote this
             phone's state as the whole document. Where it did not — no signal,
             or the SDK never loaded — the code is unverified, and saying
             otherwise told join() there was nothing to contribute. If that
             code turned out to belong to somebody else, the next connect would
             have adopted a stranger's week straight over the top of this one.
             Unverified means treat it like any typed code: bring our things. */
          self.join(res.code, res.seeded);
          return res.code;
        });
    },

    /* `seeded` is set by createHousehold, which has already put this phone's
       state in the document. Every other join is somebody typing a code that
       may well have a household behind it, and those bring their favorites,
       weeks and written recipes with them. */
    join: function (code, seeded) {
      house = String(code || '').trim().toUpperCase().replace(/\s+/g, '-');
      write(LS.house, house);
      pendingMerge = !seeded;
      if (unsub) { unsub(); unsub = null; }
      connect();
    },

    leave: function () {
      if (unsub) { unsub(); unsub = null; }
      house = ''; write(LS.house, '');
      doc = null;
      everLive = false; lastSync = 0; pendingMerge = false;
      setStatus('local');
    }
  };
})();
