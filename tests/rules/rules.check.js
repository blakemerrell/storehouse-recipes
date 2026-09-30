/* ---------------------------------------------------------------------------
 * firestore.rules, checked against the Firestore emulator.
 *
 *     cd tests/rules && npm ci && npm test
 *
 * The rules are pasted into the Firebase console by hand, so this is the only
 * place they are ever run before they are live. It starts Google's own
 * Firestore emulator (a Java program, downloaded once into .emulator/ and
 * kept) and asks it, as different people, to do what the app does and what
 * somebody holding a household code might try instead.
 *
 * It never touches the live project: the project id is a demo- one, which
 * the SDK refuses to send anywhere but the emulator.
 *
 * Kept out of tests/run.js because it needs Java and these packages, which
 * nothing the app ships needs. CI runs it as its own job.
 * ------------------------------------------------------------------------- */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const net = require('net');
const { spawn } = require('child_process');
const {
  initializeTestEnvironment, assertSucceeds, assertFails
} = require('@firebase/rules-unit-testing');
const firebase = require('firebase/compat/app').default;
require('firebase/compat/firestore');

const FV = firebase.firestore.FieldValue;
const RULES = fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8');
const JAR_VERSION = '1.19.8';
const JAR_DIR = process.env.FIRESTORE_EMULATOR_DIR || path.join(__dirname, '.emulator');
const JAR = path.join(JAR_DIR, 'cloud-firestore-emulator-v' + JAR_VERSION + '.jar');
const JAR_URL = 'https://storage.googleapis.com/firebase-preview-drop/emulator/' +
  'cloud-firestore-emulator-v' + JAR_VERSION + '.jar';
const DAY = 86400000;

function download(url, to) {
  return new Promise((ok, fail) => {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    const part = to + '.part';
    https.get(url, (res) => {
      if (res.statusCode !== 200) { fail(new Error('emulator download: HTTP ' + res.statusCode)); return; }
      const out = fs.createWriteStream(part);
      res.pipe(out);
      out.on('finish', () => out.close(() => { fs.renameSync(part, to); ok(); }));
    }).on('error', fail);
  });
}

function freePort() {
  return new Promise((ok) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); });
  });
}

function answering(port) {
  return new Promise((ok) => {
    http.get({ host: '127.0.0.1', port, path: '/' }, (res) => { res.resume(); ok(true); })
      .on('error', () => ok(false));
  });
}

async function startEmulator() {
  if (!fs.existsSync(JAR)) {
    console.log('Downloading the Firestore emulator (once)…');
    await download(JAR_URL, JAR);
  }
  const port = await freePort();
  const proc = spawn('java', ['-jar', JAR, '--host=127.0.0.1', '--port=' + port],
    { stdio: ['ignore', 'ignore', 'pipe'] });
  let said = '';
  proc.stderr.on('data', (d) => { said += d; });
  for (let i = 0; i < 120; i++) {
    if (await answering(port)) return { port, proc };
    if (proc.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  proc.kill();
  throw new Error('the Firestore emulator did not start:\n' + said.slice(-2000));
}

let passed = 0, failed = 0;
const failures = [];
async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    failures.push(name);
    console.log('  ✗ ' + name + '\n      ' + String((e && e.message) || e).split('\n')[0]);
  }
}
function section(name) { console.log('\n' + name); }

/* A household as the app writes one: what localDoc() in src/sync.js sends
   when a phone seeds a new code. */
function seedDoc(extra) {
  return Object.assign({
    favs: [3, 'u1'],
    weeks: {
      w1: { name: 'This Week', ord: 0, plan: { mon: [12], tue: [{ i: 40, x: 2 }] }, checked: {} },
      w2: { name: 'Next', ord: 1, plan: {}, checked: {} }
    },
    active: 'w1',
    mine: {
      u1: { id: 'u1', book: 3, name: 'Ours', ing: [], steps: [] },
      u2: { id: 'u2', book: 3, name: 'Also ours', ing: [], steps: [] },
      u3: { id: 'u3', book: 3, name: 'And this', ing: [], steps: [] }
    },
    edits: { 12: { name: 'Changed' } },
    pantry: { rice: 1 }, pantryNew: { own_saffron: { l: 'Saffron', c: 'Yours' }, own_mace: { l: 'Mace', c: 'Yours' } },
    kitchen: {}, src: {}, rate: {}, opts: {}, low: {}
  }, extra || {});
}

(async () => {
  const emu = await startEmulator();
  let env;
  try {
    env = await initializeTestEnvironment({
      projectId: 'demo-storehouse-rules',
      firestore: { rules: RULES, host: '127.0.0.1', port: emu.port }
    });
    const as = (uid) => env.authenticatedContext(uid).firestore();
    const nobody = () => env.unauthenticatedContext().firestore();
    const seed = async (p, data) => {
      await env.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(p).set(data); });
    };
    const read = async (p) => {
      let d = null;
      await env.withSecurityRulesDisabled(async (ctx) => { d = (await ctx.firestore().doc(p).get()).data(); });
      return d;
    };
    const H = 'households/KETTLE-1234-WILLOW';
    const fresh = async (extra) => { await env.clearFirestore(); await seed(H, seedDoc(extra)); };

    section('Households: who can reach one');
    await fresh({ members: ['alice'] });
    await check('somebody signed in, even anonymously, can fetch it by its code', () =>
      assertSucceeds(as('stranger').doc(H).get()));
    await check('nobody signed in cannot', () => assertFails(nobody().doc(H).get()));
    await check('nobody can list the households', () => assertFails(as('alice').collection('households').get()));
    await check('nobody can delete one, not even a member', () => assertFails(as('alice').doc(H).delete()));

    section('Households: making one');
    await env.clearFirestore();
    await check('a phone seeds a new code with what it has, as it always has', () =>
      assertSucceeds(as('anon1').doc('households/NEW-1').set(seedDoc())));
    await check('a signed-in phone can put itself on the list as it makes it', () =>
      assertSucceeds(as('alice').doc('households/NEW-2').set(seedDoc({ members: ['alice'] }))));
    await check('but not somebody else', () =>
      assertFails(as('alice').doc('households/NEW-3').set(seedDoc({ members: ['alice', 'mallory'] }))));
    await check('a field the app has never written is refused', () =>
      assertFails(as('alice').doc('households/NEW-4').set(seedDoc({ script: '<img>' }))));
    await check('and so is a field of the wrong kind', () =>
      assertFails(as('alice').doc('households/NEW-5').set(seedDoc({ weeks: 'all of them' }))));

    section('Households: every write the app makes still goes through');
    await fresh({ members: ['alice'] });
    const ann = as('anon2'), hd = ann.doc(H);
    await check('a dinner added to a day (arrayUnion on that day)', () =>
      assertSucceeds(hd.update({ 'weeks.w1.plan.mon': FV.arrayUnion(15) })));
    await check('a dinner taken off a day (arrayRemove)', () =>
      assertSucceeds(hd.update({ 'weeks.w1.plan.mon': FV.arrayRemove(12) })));
    await check('a day written whole (a serving count changed)', () =>
      assertSucceeds(hd.update({ 'weeks.w1.plan.tue': [{ i: 40, x: 3 }] })));
    await check('a list item ticked and unticked', async () => {
      await assertSucceeds(hd.update({ 'weeks.w1.checked.milk': true }));
      await assertSucceeds(hd.update({ 'weeks.w1.checked.milk': FV.delete() }));
    });
    await check('a week added, renamed, switched to, and deleted', async () => {
      await assertSucceeds(hd.update({ active: 'w3', 'weeks.w3': { name: 'New week', ord: 2, plan: {}, checked: {} } }));
      await assertSucceeds(hd.update({ 'weeks.w3.name': 'Later' }));
      await assertSucceeds(hd.update({ active: 'w1' }));
      await assertSucceeds(hd.update({ active: 'w1', 'weeks.w3': FV.delete() }));
    });
    await check('a week emptied', () =>
      assertSucceeds(hd.update({ 'weeks.w2.plan': {}, 'weeks.w2.checked': {} })));
    await check('a recipe written, and one deleted with its favourite and its days', async () => {
      await assertSucceeds(hd.update({ 'mine.u9': { id: 'u9', book: 3, name: 'Mine', ing: [], steps: [] } }));
      await assertSucceeds(hd.update({ 'mine.u1': FV.delete() }));
      await assertSucceeds(hd.update({ favs: FV.arrayRemove('u1'), 'weeks.w1.plan.mon': FV.arrayRemove('u1') }));
    });
    await check('a favourite starred and unstarred', async () => {
      await assertSucceeds(hd.set({ favs: FV.arrayUnion(99) }, { merge: true }));
      await assertSucceeds(hd.set({ favs: FV.arrayRemove(99) }, { merge: true }));
    });
    await check('the pantry answered, reset to the book, and added to', async () => {
      await assertSucceeds(hd.update({ 'pantry.beans': 0 }));
      await assertSucceeds(hd.set({ pantry: {} }, { merge: true }));
      await assertSucceeds(hd.update({ 'pantryNew.own_clove': { l: 'Clove', c: 'Yours' } }));
      await assertSucceeds(hd.update({ 'pantryNew.own_clove': FV.delete() }));
    });
    await check('a joining phone contributes what the household lacks', () =>
      assertSucceeds(hd.set({ mine: { u7: { id: 'u7', book: 3, name: 'Brought', ing: [], steps: [] } }, favs: [3, 'u1', 5] }, { merge: true })));
    await check('a household from the one-week version gets its weeks', () =>
      assertSucceeds(hd.set({ weeks: { w1: { name: 'This Week', ord: 0, plan: {}, checked: {} } }, active: 'w1' }, { merge: true })));
    await check('the shared maps set and cleared a key at a time', async () => {
      await assertSucceeds(hd.update({ 'kitchen.salt': 1, 'rate.12': 2, 'opts.store': 0, 'low.oil': 1, 'src.rice': 'b' }));
      await assertSucceeds(hd.update({ 'low.oil': FV.delete() }));
    });

    section('Households: what somebody with the code can no longer do');
    await fresh({ members: ['alice', 'bob'] });
    const mal = as('mallory'), md = mal.doc(H);
    await check('write the document over with nothing', () => assertFails(md.set({})));
    await check('write it over with a shell of itself', () =>
      assertFails(md.set({ weeks: {}, mine: {}, favs: [] })));
    await check('empty everybody’s recipes in one write', () => assertFails(md.update({ mine: {} })));
    await check('or with a merge', () => assertFails(md.set({ mine: {} }, { merge: true })));
    await check('take two recipes at once', () =>
      assertFails(md.update({ 'mine.u1': FV.delete(), 'mine.u2': FV.delete() })));
    await check('take every week at once', () => assertFails(md.update({ weeks: {} })));
    await check('take the edits to the printed recipes at once', async () => {
      await seed(H, seedDoc({ members: ['alice', 'bob'], edits: { 12: { name: 'A' }, 13: { name: 'B' } } }));
      await assertFails(md.update({ edits: {} }));
    });
    await check('empty the favourites', () => assertFails(md.update({ favs: [] })));
    await check('empty the things typed onto the shelf', () => assertFails(md.update({ pantryNew: {} })));
    await check('remove a field outright', () => assertFails(md.update({ pantryNew: FV.delete() })));
    await check('add a field of their own', () => assertFails(md.update({ note: 'hello' })));
    await check('throw a member off the list', () =>
      assertFails(md.update({ members: FV.arrayRemove('bob') })));
    await check('replace the list with themselves', () => assertFails(md.update({ members: ['mallory'] })));
    await check('put somebody else on it', () => assertFails(md.update({ members: FV.arrayUnion('eve') })));

    section('Households: the members list, by the member');
    await fresh({ members: ['alice'] });
    await check('a signed-in visitor puts themselves on it', () =>
      assertSucceeds(as('bob').doc(H).update({ members: FV.arrayUnion('bob') })));
    await check('an invite spent puts its spender on it, with the invite noted', () =>
      assertSucceeds(as('carol').doc(H).update({ members: FV.arrayUnion('carol'), lastInvite: 'tok' })));
    await check('an account being deleted takes itself off', () =>
      assertSucceeds(as('bob').doc(H).update({ members: FV.arrayRemove('bob') })));
    await check('the old private My Day left in this collection can be cleared', async () => {
      await seed(H, seedDoc({ members: ['alice'], myday: { t: { v: {}, at: 1 } } }));
      await assertSucceeds(as('alice').doc(H).update({ myday: FV.delete() }));
    });

    section('Households: two phones at once');
    await fresh();
    const p1 = as('anon1').doc(H), p2 = as('anon2').doc(H);
    await check('two dinners added to Monday on two phones both stay', async () => {
      await p1.update({ 'weeks.w1.plan.mon': FV.arrayUnion(20) });
      await p2.update({ 'weeks.w1.plan.mon': FV.arrayUnion(21) });
      const mon = (await read(H)).weeks.w1.plan.mon;
      if (![12, 20, 21].every((x) => mon.indexOf(x) >= 0)) throw new Error('Monday is ' + JSON.stringify(mon));
    });
    await check('one phone taking a dinner off does not take the other’s addition with it', async () => {
      await p1.update({ 'weeks.w1.plan.mon': FV.arrayRemove(12) });
      const mon = (await read(H)).weeks.w1.plan.mon;
      if (mon.indexOf(12) >= 0 || mon.indexOf(21) < 0) throw new Error('Monday is ' + JSON.stringify(mon));
    });

    section('Invites');
    await env.clearFirestore();
    await seed(H, seedDoc({ members: ['alice'] }));
    const now = Date.now();
    const inv = (by, extra) => Object.assign({ house: 'KETTLE-1234-WILLOW', by, made: now, exp: now + 7 * DAY, used: false }, extra || {});
    await check('a member makes one for a week', () =>
      assertSucceeds(as('alice').doc('invites/tokgood').set(inv('alice'))));
    await check('a stranger cannot make one', () =>
      assertFails(as('mallory').doc('invites/tokbad').set(inv('mallory'))));
    await check('nor in somebody else’s name', () =>
      assertFails(as('mallory').doc('invites/tokbad').set(inv('alice'))));
    await check('an invite cannot be made to last a month', () =>
      assertFails(as('alice').doc('invites/toklong').set(inv('alice', { exp: now + 30 * DAY }))));
    await check('nor made already expired', () =>
      assertFails(as('alice').doc('invites/tokold').set(inv('alice', { exp: now - DAY }))));
    await check('nor carry anything else', () =>
      assertFails(as('alice').doc('invites/tokx').set(inv('alice', { note: 'hi' }))));
    await check('the one who has the link can read it', () =>
      assertSucceeds(as('bob').doc('invites/tokgood').get()));
    await check('a link that never existed reads as missing, not refused', async () => {
      const s = await assertSucceeds(as('bob').doc('invites/nosuch').get());
      if (s.exists) throw new Error('it exists');
    });
    await check('spending it: once', () =>
      assertSucceeds(as('bob').doc('invites/tokgood').update({ used: true, usedBy: 'bob' })));
    await check('and not twice', () =>
      assertFails(as('eve').doc('invites/tokgood').update({ used: true, usedBy: 'eve' })));
    await check('a spent one no longer gives away the household', () =>
      assertFails(as('eve').doc('invites/tokgood').get()));
    await check('nor does an expired one', async () => {
      await seed('invites/tokexp', inv('alice', { exp: now - 1000 }));
      await assertFails(as('eve').doc('invites/tokexp').get());
    });
    await check('invites cannot be listed or deleted', async () => {
      await assertFails(as('alice').collection('invites').get());
      await assertFails(as('alice').doc('invites/tokexp').delete());
    });

    section('Your own record');
    await env.clearFirestore();
    await check('yours to write and read', async () => {
      await assertSucceeds(as('alice').doc('users/alice').set({ myday: {} }));
      await assertSucceeds(as('alice').doc('users/alice').get());
    });
    await check('nobody else’s', async () => {
      await assertFails(as('mallory').doc('users/alice').get());
      await assertFails(as('mallory').doc('users/alice').set({ myday: {} }));
    });
    await check('your training years are yours, and listable only by you', async () => {
      await assertSucceeds(as('alice').doc('users/alice/train/2026').set({ wo: {} }));
      await assertSucceeds(as('alice').collection('users/alice/train').get());
      await assertFails(as('mallory').collection('users/alice/train').get());
    });
    await check('nobody lists the accounts', () => assertFails(as('alice').collection('users').get()));
  } finally {
    if (env) await env.cleanup();
    emu.proc.kill();
  }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed) { failures.forEach((f) => console.log('  ' + f)); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
