/* The shared household, against a stand-in for Firestore.
 *
 * tests/sync.test.js talks to the live project and is run by hand; this is
 * the half that runs every time. The server is a plain object in this
 * process, and the SDK the page gets is a few dozen lines that hand each
 * write here as it was made — including Firestore's own markers for
 * arrayUnion, arrayRemove and delete, applied here the way Firestore applies
 * them, against whatever the document holds when the write arrives. So what
 * is checked is what the app ASKS the server to do, which is the thing the
 * rules (tests/rules/) and the two-phones problem are both about.
 *
 * Nothing reaches the real project: the SDK is injected before the page
 * loads, and sync.js skips its own loader when firebase is already there. */

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* A Firestore marker, applied to what is there now. undefined means "take
   the field away". */
function resolve(v, cur) {
  if (isObj(v) && v.__fv) {
    if (v.__fv === 'delete') return undefined;
    if (v.__fv === 'ts') return { __ts: Date.now() };
    const was = Array.isArray(cur) ? cur.slice() : [];
    if (v.__fv === 'union') { v.v.forEach((x) => { if (!was.some((y) => same(x, y))) was.push(x); }); return was; }
    if (v.__fv === 'remove') return was.filter((y) => !v.v.some((x) => same(x, y)));
  }
  if (isObj(v)) {
    const o = {};
    Object.keys(v).forEach((k) => { const r = resolve(v[k], undefined); if (r !== undefined) o[k] = r; });
    return o;
  }
  return v;
}
// set(..., {merge: true}): maps merge, and an empty map is written as one
function mergeInto(to, from) {
  Object.keys(from).forEach((k) => {
    const v = from[k];
    if (isObj(v) && !v.__fv && Object.keys(v).length && isObj(to[k])) { mergeInto(to[k], v); return; }
    const r = resolve(v, to[k]);
    if (r === undefined) delete to[k]; else to[k] = r;
  });
}
// update(): each key a field path, each path replaced (or marked) where it is
function atPath(doc, path, v) {
  const parts = path.split('.');
  let o = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!isObj(o[parts[i]])) o[parts[i]] = {};
    o = o[parts[i]];
  }
  const last = parts[parts.length - 1];
  const r = resolve(v, o[last]);
  if (r === undefined) delete o[last]; else o[last] = r;
}

const SDK = `(function(){
  var cfg = window.__fakeCfg || {};
  var user = cfg.user || { uid: 'anon1', isAnonymous: true };
  var authObj = { currentUser: user,
    getRedirectResult: function(){ return Promise.resolve(null); },
    onAuthStateChanged: function(cb){ setTimeout(function(){ cb(authObj.currentUser); }, 0); return function(){}; },
    signInAnonymously: function(){ authObj.currentUser = { uid: 'anon9', isAnonymous: true }; return Promise.resolve({ user: authObj.currentUser }); },
    signOut: function(){ return Promise.resolve(); } };
  user.delete = function(){ return Promise.resolve(); };
  var subs = [];
  function snapOf(path, d){ return { id: path.split('/').pop(), exists: d !== null && d !== undefined,
    data: function(){ return d ? JSON.parse(JSON.stringify(d)) : undefined; },
    metadata: { fromCache: false, hasPendingWrites: false } }; }
  function deliver(){ subs.slice().forEach(function(s){ s(); }); }
  window.__hhPoke = deliver;
  function refused(r){ if (r && r.denied) { var e = new Error('Missing or insufficient permissions.'); e.code = 'permission-denied'; throw e; } return r; }
  function write(op, path, d, merge){ return window.__hhWrite(op, path, JSON.parse(JSON.stringify(d)), merge).then(refused).then(deliver); }
  function docRef(path){ return { id: path.split('/').pop(), path: path,
    collection: function(n){ return colRef(path + '/' + n); },
    set: function(d, o){ return write('set', path, d, !!(o && o.merge)); },
    update: function(d){ return write('update', path, d, true); },
    delete: function(){ return write('delete', path, {}, false); },
    get: function(){ return window.__hhGet(path).then(refused).then(function(r){ return snapOf(path, r.d); }); },
    onSnapshot: function(o, next, err){ if (typeof o === 'function') { err = next; next = o; }
      var on = true; var fire = function(){ if (!on) return; window.__hhGet(path).then(function(r){ if (on) next(snapOf(path, r.d)); }); };
      subs.push(fire); setTimeout(fire, 20); return function(){ on = false; }; } }; }
  function colRef(path){ return { doc: function(id){ return docRef(path + '/' + id); },
    get: function(){ return window.__hhList(path).then(function(list){
      var docs = list.map(function(r){ return { id: r.path.split('/').pop(), ref: docRef(r.path), data: function(){ return r.data; } }; });
      return { docs: docs, forEach: function(fn){ docs.forEach(fn); } }; }); },
    onSnapshot: function(o, next){ if (typeof o === 'function') next = o;
      var on = true; var fire = function(){ if (!on) return; window.__hhList(path).then(function(list){ if (!on) return;
        next({ metadata: { fromCache: false }, forEach: function(fn){ list.forEach(function(r){ fn(snapOf(r.path, r.data)); }); } }); }); };
      subs.push(fire); setTimeout(fire, 20); return function(){ on = false; }; } }; }
  var db = { collection: function(n){ return colRef(n); }, enablePersistence: function(){ return Promise.resolve(); },
    runTransaction: function(fn){
      var ops = [];
      var t = { get: function(ref){ return ref.get(); },
        set: function(ref, d){ ops.push(['set', ref.path, d, false]); return t; },
        update: function(ref, d){ ops.push(['update', ref.path, d, true]); return t; } };
      return Promise.resolve(fn(t)).then(function(r){
        return ops.reduce(function(p, op){ return p.then(function(){ return write(op[0], op[1], op[2], op[3]); }); }, Promise.resolve())
          .then(function(){ return r; });
      });
    } };
  var fs = function(){ return db; };
  fs.FieldValue = {
    delete: function(){ return { __fv: 'delete' }; },
    arrayUnion: function(){ return { __fv: 'union', v: [].slice.call(arguments) }; },
    arrayRemove: function(){ return { __fv: 'remove', v: [].slice.call(arguments) }; },
    serverTimestamp: function(){ return { __fv: 'ts' }; } };
  var auth = function(){ return authObj; };
  auth.GoogleAuthProvider = function(){};
  window.firebase = { apps: [], initializeApp: function(){ window.firebase.apps.push({}); }, firestore: fs, auth: auth };
})();`;

const CODE = 'KETTLE-1234-WILLOW';
const HP = 'households/' + CODE;

function seedHouse(extra) {
  return Object.assign({
    favs: [3, 'u1'],
    weeks: {
      w1: { name: 'This Week', ord: 0, plan: { mon: [12, 'u1'], wed: ['u1', 40], thu: [30] }, checked: {} },
      w2: { name: 'Next', ord: 1, plan: { tue: ['u1'] }, checked: {} }
    },
    active: 'w1',
    mine: {
      u1: { id: 'u1', book: 3, secNum: 1, secName: 'Ours', name: 'Lentil soup', ing: ['lentils'], steps: ['boil'] },
      u2: { id: 'u2', book: 3, secNum: 1, secName: 'Ours', name: 'Grandma’s bread', ing: ['flour'], steps: ['bake'] },
      u3: { id: 'u3', book: 3, secNum: 1, secName: 'Ours', name: 'Plain rice', ing: ['rice'], steps: ['cook'] }
    },
    edits: {}, pantry: {}, pantryNew: {}, kitchen: {}, src: {}, rate: {}, opts: {}, low: {}
  }, extra || {});
}

module.exports = {
  name: 'The shared household',
  async run(t) {
    const SRV = { db: {}, log: [], denyGet: {} };
    const since = () => SRV.log.length;
    const writesFrom = (n) => SRV.log.slice(n);

    async function phone(opts) {
      opts = opts || {};
      const ctx = await t.browser.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.exposeBinding('__hhWrite', async (src, op, path, data, merge) => {
        SRV.log.push({ op, path, data });
        if (op === 'delete') { delete SRV.db[path]; return true; }
        if (op === 'set' && !merge) { SRV.db[path] = resolve(data, undefined); return true; }
        if (op === 'set') { SRV.db[path] = SRV.db[path] || {}; mergeInto(SRV.db[path], data); return true; }
        if (!SRV.db[path]) return { denied: true };              // update() on nothing: refused
        Object.keys(data).forEach((k) => atPath(SRV.db[path], k, data[k]));
        return true;
      });
      await ctx.exposeBinding('__hhGet', async (src, path) => (SRV.denyGet[path] ? { denied: true }
        : { d: SRV.db[path] === undefined ? null : JSON.parse(JSON.stringify(SRV.db[path])) }));
      await ctx.exposeBinding('__hhList', async (src, path) => Object.keys(SRV.db)
        .filter((k) => k.indexOf(path + '/') === 0 && k.slice(path.length + 1).indexOf('/') < 0)
        .map((k) => ({ path: k, data: SRV.db[k] })));
      await ctx.addInitScript((c) => { window.__fakeCfg = c; }, { user: opts.user || null });
      await ctx.addInitScript(SDK);
      await ctx.route(/api\.nal\.usda\.gov|accounts\.google\.com|www\.gstatic\.com/, (r) => r.abort());
      const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', (e) => errs.push(e.message));
      await p.goto(t.base + 'index.html');
      await p.evaluate((o) => {
        localStorage.clear();
        if (o.house) { localStorage.setItem('bsc.house', JSON.stringify(o.house)); localStorage.setItem('bsc.houseNew', JSON.stringify('')); }
        if (o.account) localStorage.setItem('bsc.myAccount', '1');
      }, { house: opts.house || '', account: !!opts.user });
      await p.reload();
      if (opts.house) await p.waitForFunction(() => window.Store.status === 'synced', null, { timeout: 5000 });
      return { p, ctx, errs };
    }
    const poke = (p) => p.evaluate(() => new Promise((r) => { window.__hhPoke(); setTimeout(r, 120); }));

    // ---- a day is changed a dinner at a time ---------------------------
    SRV.db[HP] = seedHouse();
    const A = await phone({ house: CODE });
    let n = since();
    await A.p.evaluate(() => window.Store.addToDay(15, 'thu', 1));
    await A.p.waitForTimeout(150);
    let w = writesFrom(n);
    t.ok('a dinner added to a day goes up as that one dinner, not the whole day',
      w.length === 1 && w[0].op === 'update' && same(w[0].data['weeks.w1.plan.thu'], { __fv: 'union', v: [15] }),
      JSON.stringify(w));
    // the other phone adds Thursday's second dinner in between
    SRV.db[HP].weeks.w1.plan.thu.push(21);
    await poke(A.p);
    n = since();
    await A.p.evaluate(() => window.Store.removeFromDay(30, 'thu'));
    await A.p.waitForTimeout(150);
    w = writesFrom(n);
    t.ok('and one taken off goes up as that one taken off',
      w.length === 1 && same(w[0].data['weeks.w1.plan.thu'], { __fv: 'remove', v: [30] }), JSON.stringify(w));
    t.ok('so the other phone’s dinner, added meanwhile, is still there',
      same(SRV.db[HP].weeks.w1.plan.thu, [15, 21]), JSON.stringify(SRV.db[HP].weeks.w1.plan.thu));
    n = since();
    await A.p.evaluate(() => window.Store.addToDay(15, 'thu', 2));
    await A.p.waitForTimeout(150);
    w = writesFrom(n);
    t.ok('a serving count changed is the one change still sent as the whole day',
      w.length === 1 && Array.isArray(w[0].data['weeks.w1.plan.thu']), JSON.stringify(w));

    // ---- a queued change goes to the week it was made in ----------------
    await A.ctx.close();
    SRV.db[HP] = seedHouse();
    const Q = await phone();
    n = since();
    await Q.p.evaluate((code) => {
      // made before the connection is up, so they are held and sent later, in order
      window.Store.join(code);
      window.Store.toggleChecked('milk');
      window.Store.addWeek('Later');   // and a new week showing before either has left
    }, CODE);
    await Q.p.waitForFunction(() => window.Store.status === 'synced', null, { timeout: 5000 });
    await Q.p.waitForTimeout(200);
    const tick = writesFrom(n).find((x) => x.op === 'update' && Object.keys(x.data).some((k) => /checked\.milk$/.test(k)));
    t.ok('a tick made before the household answered lands in the week it was made in',
      !!tick && Object.keys(tick.data)[0] === 'weeks.w1.checked.milk', JSON.stringify(writesFrom(n)).slice(0, 400));
    await Q.ctx.close();

    // ---- deleting a recipe takes it off its days, and only those --------
    SRV.db[HP] = seedHouse();
    const D = await phone({ house: CODE });
    SRV.db[HP].weeks.w1.plan.thu.push(31);        // the other phone, a moment ago
    n = since();
    await D.p.evaluate(() => window.Store.deleteRecipe('u1'));
    await D.p.waitForTimeout(250);
    w = writesFrom(n);
    const keys = w.map((x) => Object.keys(x.data)).reduce((a, b) => a.concat(b), []);
    t.ok('deleting your recipe sends the recipe gone, then each day it was on',
      keys.indexOf('mine.u1') >= 0 && keys.indexOf('weeks.w1.plan.mon') >= 0 && keys.indexOf('weeks.w1.plan.wed') >= 0 &&
      keys.indexOf('weeks.w2.plan.tue') >= 0 && keys.indexOf('favs') >= 0, JSON.stringify(keys));
    t.ok('and never the whole of every week', keys.indexOf('weeks') < 0 && keys.indexOf('weeks.w1.plan.thu') < 0, JSON.stringify(keys));
    const after = SRV.db[HP];
    t.ok('so it is off every day, and the other phone’s Thursday dinner stays',
      !JSON.stringify(after.weeks).includes('"u1"') && same(after.weeks.w1.plan.thu, [30, 31]) && after.favs.indexOf('u1') < 0,
      JSON.stringify(after.weeks) + JSON.stringify(after.favs));
    t.ok('a day it leaves empty is empty, not still holding it', same(after.weeks.w2.plan.tue, []),
      JSON.stringify(after.weeks.w2.plan));

    // ---- a recipe taken on another phone is kept here, and can come back
    SRV.db[HP] = seedHouse();
    await D.p.evaluate(() => { localStorage.removeItem('bsc.houseKept'); });
    await D.ctx.close();
    const K = await phone({ house: CODE });
    delete SRV.db[HP].mine.u2;                      // somebody else, holding the code
    delete SRV.db[HP].weeks.w2;
    await poke(K.p);
    await K.p.waitForTimeout(150);
    const kept = await K.p.evaluate(() => window.Store.removed());
    t.ok('what the household lost, this phone kept: the recipe, and the week with dinners on it',
      kept.length === 2 && kept.some((x) => x.k === 'mine' && x.id === 'u2') && kept.some((x) => x.k === 'weeks' && x.id === 'w2'),
      JSON.stringify(kept));
    const toast = await K.p.evaluate(() => (document.getElementById('mToast') || {}).textContent || '');
    t.ok('and it says so, once, wherever you are', /taken out of the shared pantry on another phone/.test(toast), toast);
    await K.p.evaluate(() => window.Store.deleteRecipe('u3'));
    await K.p.waitForTimeout(250);
    await poke(K.p);
    const kept2 = await K.p.evaluate(() => window.Store.removed());
    t.ok('a recipe deleted on this phone is not mistaken for one taken from it',
      !kept2.some((x) => x.id === 'u3'), JSON.stringify(kept2));
    await K.p.click('#syncBtn');
    await K.p.waitForTimeout(250);
    const sheet = await K.p.evaluate(() => (document.querySelector('.sync-gone') || {}).innerText || '');
    t.ok('Sync & sharing lists them by name', /Grandma.s bread/.test(sheet) && /Next/.test(sheet), sheet);
    await K.p.click('[data-sync="restore"]');
    await K.p.waitForTimeout(300);
    t.ok('and Put them back puts them back in the household',
      !!SRV.db[HP].mine.u2 && SRV.db[HP].mine.u2.name === 'Grandma’s bread' && !!SRV.db[HP].weeks.w2 &&
      same(SRV.db[HP].weeks.w2.plan.tue, ['u1']), JSON.stringify(Object.keys(SRV.db[HP].mine)) + JSON.stringify(SRV.db[HP].weeks.w2));
    t.ok('after which there is nothing left to put back',
      (await K.p.evaluate(() => window.Store.removed().length)) === 0 && !(await K.p.$('.sync-gone')));
    t.ok('with nothing thrown on the way', K.errs.length === 0, K.errs.join(' | '));
    await K.ctx.close();

    // ---- a code that is nobody's, with a change waiting for it ----------
    const M = await phone();
    n = since();
    await M.p.evaluate(() => { window.Store.join('NOBODY-0000-HERE'); window.Store.toggleFav(3); });
    await M.p.waitForFunction(() => window.Store.status === 'local', null, { timeout: 5000 });
    await M.p.waitForTimeout(150);
    const miss = await M.p.evaluate(() => ({ note: window.Store.statusNote, q: window.__syncDebug().queued, house: window.Store.house }));
    t.ok('a mistyped code says so, in words, rather than an error',
      /No shared pantry with the code NOBODY-0000-HERE/.test(miss.note) && miss.house === '', JSON.stringify(miss));
    t.ok('and what was waiting for it is dropped, not sent into the next household joined',
      miss.q === 0 && !writesFrom(n).some((x) => /NOBODY/.test(x.path)), JSON.stringify(miss) + JSON.stringify(writesFrom(n)));
    t.ok('nothing thrown', M.errs.length === 0, M.errs.join(' | '));
    await M.ctx.close();

    // ---- a phone whose storage is full says so --------------------------
    SRV.db[HP] = seedHouse();
    const F = await phone({ house: CODE });
    await F.p.evaluate(() => {
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === 'bsc.weeks') throw new DOMException('full', 'QuotaExceededError');
        return real.call(this, k, v);
      };
      window.Store.addWeek('Spare');
    });
    await F.p.waitForTimeout(150);
    const full = await F.p.evaluate(() => ({ full: window.Store.storageFull, toast: (document.getElementById('mToast') || {}).textContent || '' }));
    t.ok('a plan that could not be saved on this phone is said, not swallowed',
      full.full && /storage for the app is full/.test(full.toast) && /still go to the shared pantry/.test(full.toast), JSON.stringify(full));
    await F.ctx.close();

    // ---- an account deleted takes its name off the household ------------
    SRV.db[HP] = seedHouse({ members: ['alice', 'bob'] });
    SRV.db['users/alice'] = { myday: {} };
    const Z = await phone({ house: CODE, user: { uid: 'alice', isAnonymous: false, email: 'a@test.example' } });
    const gone = await Z.p.evaluate(() => window.Store.deleteAccount().then(() => 'ok', (e) => 'failed: ' + e.message));
    t.ok('deleting an account takes it off the household’s members list',
      gone === 'ok' && same(SRV.db[HP].members, ['bob']) && !SRV.db['users/alice'],
      gone + ' ' + JSON.stringify(SRV.db[HP].members));

    // ---- an invite that can no longer be read reads as spent ------------
    SRV.denyGet['invites/tok-spent'] = true;
    await Z.p.evaluate(() => { window.firebase.auth().currentUser = { uid: 'carol', isAnonymous: false }; });
    const said = await Z.p.evaluate(() => window.Store.redeem('tok-spent').then(() => 'joined', (e) => e.message));
    t.ok('a spent invite, which the rules now refuse to show, is said to be spent', said === 'spent', said);
    await Z.ctx.close();
  }
};
