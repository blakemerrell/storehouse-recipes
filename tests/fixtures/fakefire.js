/* src/sync.js against an in-memory Firestore, in Node, with a fixed clock.
 *
 * For the households-of-weeks cases that need two phones and a server and no
 * network: what one phone writes, the other hears, in order. update() applies
 * dotted paths, arrayUnion/arrayRemove and delete the way Firestore does;
 * set({merge}) merges deep. A phone can be told its snapshots come from the
 * cache, which is how a phone opening offline sees an old copy. */
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
  const T = now.getTime();
  class FixedDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(T); }
    static now() { return T; }
  }
  const fireAll = (code) => subs.filter((s) => s.code === code).forEach((s) => s.fire());

  function phone(name, ls, opts) {
    ls = ls || {};
    opts = opts || {};
    const mine = [];
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
        setTimeout(() => fireAll(code), 0);
        return Promise.resolve();
      },
      update(u) {
        Object.keys(u).forEach((p) => applyPath(server[code], p, u[p]));
        writes.push({ who: name, update: Object.keys(u) });
        setTimeout(() => fireAll(code), 0);
        return Promise.resolve();
      },
      onSnapshot(o, cb) {
        const s = { code, fire: () => cb(snapOf(code)) };
        subs.push(s); mine.push(s);
        setTimeout(s.fire, 0);
        return () => { subs.splice(subs.indexOf(s), 1); };
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
        onAuthStateChanged(cb) { setTimeout(() => cb({ uid: name, isAnonymous: true }), 0); return () => {}; },
        currentUser: { uid: name, isAnonymous: true },
      }),
    };
    const store = { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; } };
    const errors = [];
    const win = { firebase: fb, FIREBASE_CONFIG: { apiKey: 'a', projectId: 'p' }, addEventListener() {}, crypto: null, localStorage: store };
    const ctx = {
      window: win, localStorage: store, document: {}, console, Promise, JSON, Math, Object, location: {}, Date: FixedDate,
      setTimeout: (f, ms) => setTimeout(() => { try { f(); } catch (e) { errors.push(e.message); } }, ms),
    };
    vm.createContext(ctx);
    vm.runInContext(SRC, ctx);
    return { S: win.Store, ls, errors, online() { opts.cached = null; mine.forEach((s) => s.fire()); } };
  }
  return { server, writes, phone, wait: (ms) => new Promise((r) => setTimeout(r, ms || 60)) };
}

/* A phone's localStorage holding these weeks, in this household. */
function joined(weeks, house) {
  const ls = { 'bsc.weeks': JSON.stringify(weeks) };
  if (house) { ls['bsc.house'] = JSON.stringify(house); ls['bsc.houseNew'] = JSON.stringify(''); }
  return ls;
}

module.exports = { world, joined, clone };
