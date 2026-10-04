/* src/sync.js against an in-memory Firestore, in Node, with a fixed clock.
 *
 * For the households-of-weeks cases that need two phones and a server and no
 * network: what one phone writes, the other hears, in order. update() applies
 * dotted paths, arrayUnion/arrayRemove and delete the way Firestore does;
 * set({merge}) merges deep. A phone can be told its snapshots come from the
 * cache, which is how a phone opening offline sees an old copy.
 *
 * Every timer the world or a phone's sync.js sets goes through later(),
 * which counts it, so settle() can wait until nothing is left to happen
 * rather than for a guessed number of milliseconds. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'sync.js'), 'utf8');
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const DEL = { __del: 1 };

function applyPath(d, p, v) {
  const ks = p.split('.');
  let o = d;
  for (let i = 0; i < ks.length - 1; i++) {
    if (typeof o[ks[i]] !== 'object' || !o[ks[i]]) o[ks[i]] = {};
    o = o[ks[i]];
  }
  const k = ks[ks.length - 1];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (v && v.__del) { delete o[k]; return; }
  if (v && v.__au) { const a = Array.isArray(o[k]) ? o[k] : []; v.__au.forEach((e) => { if (!a.some((x) => same(x, e))) a.push(e); }); o[k] = a; return; }
  if (v && v.__ar) { const a = Array.isArray(o[k]) ? o[k] : []; o[k] = a.filter((x) => !v.__ar.some((e) => same(x, e))); return; }
  o[k] = clone(v);
}
/* The real client throws, synchronously, for a path it will not send: an
   empty piece, or a '~', '*', '/', '[' or ']' in one. A dot it takes as a
   step down, which is the other way a key becomes a path it did not mean. */
function checkPath(p) {
  if (p.split('.').some((s) => !s || /[~*/[\]]/.test(s))) throw new Error('Invalid field path (' + p + ')');
}
function mergeDeep(t, s) {
  Object.keys(s).forEach((k) => {
    const v = s[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && !v.__del && !v.__au && !v.__ar && Object.keys(v).length) {
      if (typeof t[k] !== 'object' || !t[k] || Array.isArray(t[k])) t[k] = {};
      mergeDeep(t[k], v);
    } else applyPath(t, k, v);
  });
}

/* A world: one server, any number of phones, all at `now`. */
function world(now) {
  const server = {}, writes = [], subs = [];
  let pending = 0;
  const later = (f, ms) => { pending++; return setTimeout(() => { pending--; f(); }, ms || 0); };
  const T = now.getTime();
  class FixedDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(T); }
    static now() { return T; }
  }
  const fireAll = (code) => subs.filter((s) => s.code === code).forEach((s) => s.fire());

  /* A phone signed in to an account ({ account: true }) or, as most are,
     anonymous — an identity that lives and dies with the browser. */
  function phone(name, ls, opts) {
    ls = ls || {};
    opts = opts || {};
    const mine = [];
    const me = () => (opts.account
      ? { uid: name, isAnonymous: false, email: name + '@example.com', displayName: name }
      : { uid: name, isAnonymous: true });
    const snapOf = (code) => ({
      data: () => clone(opts.cached ? opts.cached : server[code]),
      exists: !!server[code],
      metadata: { fromCache: !!opts.cached, hasPendingWrites: false },
    });
    const docRef = (code) => ({
      get: () => Promise.resolve({ exists: !!server[code], data: () => clone(server[code]) }),
      set(v, o) {
        if (!o || !o.merge) server[code] = {};
        mergeDeep(server[code] = server[code] || {}, v);
        writes.push({ who: name, set: clone(v) });
        later(() => fireAll(code));
        return Promise.resolve();
      },
      update(u) {
        Object.keys(u).forEach(checkPath);    // refused before anything is sent, as the real client does
        Object.keys(u).forEach((p) => applyPath(server[code], p, u[p]));
        writes.push({ who: name, update: Object.keys(u) });
        later(() => fireAll(code));
        return Promise.resolve();
      },
      onSnapshot(o, cb) {
        const s = { code, fire: () => cb(snapOf(code)) };
        subs.push(s); mine.push(s);
        later(s.fire);
        /* Asked twice, indexOf is -1, and splice(-1, 1) would take the
           last listener in the world: somebody else's. */
        return () => { const i = subs.indexOf(s); if (i >= 0) subs.splice(i, 1); };
      },
    });
    const FV = { delete: () => DEL, arrayUnion: (...a) => ({ __au: a }), arrayRemove: (...a) => ({ __ar: a }) };
    const fb = {
      apps: [1], initializeApp() {},
      firestore: Object.assign(() => ({
        enablePersistence: () => Promise.resolve(),
        collection: () => ({ doc: docRef }),
        runTransaction: () => Promise.reject(new Error('not here')),
      }), { FieldValue: FV }),
      auth: () => ({
        getRedirectResult: () => Promise.resolve(null),
        onAuthStateChanged(cb) { later(() => cb(me())); return () => {}; },
        currentUser: me(),
      }),
    };
    const store = { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; } };
    const errors = [];
    const win = { firebase: fb, FIREBASE_CONFIG: { apiKey: 'a', projectId: 'p' }, addEventListener() {}, crypto: null, localStorage: store };
    const ctx = {
      window: win, localStorage: store, document: {}, console, Promise, JSON, Math, Object, location: {}, Date: FixedDate,
      setTimeout: (f, ms) => later(() => { try { f(); } catch (e) { errors.push(e.message); } }, ms),
    };
    vm.createContext(ctx);
    vm.runInContext(SRC, ctx);
    return { S: win.Store, ls, errors, online() { opts.cached = null; mine.forEach((s) => s.fire()); } };
  }
  /* Until nothing is left to happen: every timer counted above has fired,
     and three turns of the loop went by without another being set. A
     fixed wait guessed how long that takes, and a busy machine can take
     longer: on 4 October a CI runner checked a household move 200 ms in,
     before the new household's first answer had reached the phone. */
  async function settle(cap) {
    const limit = cap || 5000, end = Date.now() + limit;
    for (let quiet = 0; quiet < 3;) {
      if (Date.now() > end) throw new Error('still busy after ' + limit + ' ms: something keeps setting timers');
      await new Promise((r) => setImmediate(r));
      quiet = pending ? 0 : quiet + 1;
    }
  }
  return { server, writes, phone, settle };
}

/* A phone's localStorage holding these weeks, in this household. */
function joined(weeks, house) {
  const ls = { 'bsc.weeks': JSON.stringify(weeks) };
  if (house) { ls['bsc.house'] = JSON.stringify(house); ls['bsc.houseNew'] = JSON.stringify(''); }
  return ls;
}

module.exports = { world, joined, clone };
