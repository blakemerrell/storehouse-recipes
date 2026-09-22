/* One account, two devices, and the pantry going with the account.
 *
 * Live, like sync.test.js: it talks to the real project and runs only when
 * asked for (`node tests/run.js sync`).
 *
 * A real Google account cannot be driven from a test, so the account is the
 * page's own anonymous identity with Store.user() made to answer for it. The
 * rules gate /users/{uid} on the uid alone, anonymous or not, so everything
 * past that one line is the real path. "Another device" is the same browser
 * with every bsc.* key cleared: the sign-in survives in IndexedDB the way it
 * would on a second machine signed into the same account, and the household
 * does not — which is exactly the PC Blake opened.
 */

const CODE = 'TESTONLY-7733-ACCOUNTHOUSE';

async function waitFor(page, fn, ms = 15000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await page.evaluate(fn)) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

/* Before any script on the page: an account, as far as the app can tell. */
function asAccount() {
  let real;
  Object.defineProperty(window, 'Store', {
    configurable: true,
    get() { return real; },
    set(v) {
      v.user = () => { const id = v.uid(); return id ? { uid: id, email: 'test@example.com', name: '' } : null; };
      real = v;
    },
  });
}

module.exports = {
  name: 'Sync (the account carries the pantry)',
  async run(t) {
    const ctx = await t.browser.newContext({ viewport: { width: 1100, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => t.ok('no uncaught error on the page', false, e.message));
    await p.addInitScript(asAccount);

    const acct = () => p.evaluate(() => window.Store.ready().then((db) =>
      db.collection('users').doc(window.Store.uid()).get({ source: 'server' })
        .then((s) => (s.exists ? s.data() : null))));
    const household = (code, body) => p.evaluate(([c, b]) => window.Store.ready().then((db) =>
      db.collection('households').doc(c).set(b)), [code, body]);
    /* A device that has never been here, still signed in. */
    const newDevice = async () => {
      await p.evaluate(() => {
        Object.keys(localStorage).filter((k) => k.indexOf('bsc.') === 0)
          .forEach((k) => localStorage.removeItem(k));
        localStorage.setItem('bsc.myAccount', '1');
      });
      await p.reload();
    };

    try {
      await p.goto(t.base + 'index.html');
      await p.evaluate(() => window.Store.ready());
      await p.evaluate(() => window.Store.ready().then((db) =>
        db.collection('users').doc(window.Store.uid()).delete()));
      await household(CODE, { favs: [4, 11], weeks: {}, active: '', mine: {}, edits: {},
        pantry: {}, pantryNew: {} });

      // ---- a fresh device with nothing on it makes no pantry ----------------
      await newDevice();
      await p.waitForTimeout(4000);
      const empty = await acct();
      t.ok('a signed-in device with nothing on it does not invent a pantry',
        !(await p.evaluate(() => window.Store.house)) && !(empty && empty.house),
        JSON.stringify({ house: await p.evaluate(() => window.Store.house), acct: empty && empty.house }));

      // ---- the phone: in a household, signed in ----------------------------
      await p.evaluate((c) => window.Store.join(c), CODE);
      await waitFor(p, () => window.Store.status === 'synced');
      await p.reload();
      t.ok('the phone tells the account which pantry it is in',
        await waitFor(p, () => window.Store.ready().then((db) =>
          db.collection('users').doc(window.Store.uid()).get({ source: 'server' }))
          .then((s) => s.exists && s.data().house === 'TESTONLY-7733-ACCOUNTHOUSE')),
        JSON.stringify(await acct()));

      // ---- the PC: signed in, nothing local --------------------------------
      await newDevice();
      t.ok('a new device signed into the account joins that pantry by itself',
        await waitFor(p, () => window.Store.house === 'TESTONLY-7733-ACCOUNTHOUSE' &&
          window.Store.status === 'synced'),
        await p.evaluate(() => window.Store.house + ' ' + window.Store.status));
      t.ok('and shows what the phone has',
        await waitFor(p, () => window.Store.state.favs.join() === '4,11'),
        await p.evaluate(() => JSON.stringify(window.Store.state.favs)));

      // ---- a phone with favorites and no household makes one ---------------
      await p.evaluate(() => window.Store.ready().then((db) =>
        db.collection('users').doc(window.Store.uid()).delete()));
      await newDevice();
      await p.evaluate(() => window.Store.toggleFav(7));
      await p.reload();
      t.ok('a device holding favorites and no pantry makes one for the account',
        await waitFor(p, () => !!window.Store.house && window.Store.status === 'synced', 20000),
        await p.evaluate(() => window.Store.house + ' ' + window.Store.status));
      const made = await p.evaluate(() => window.Store.house);
      t.ok('and the account learns it',
        await waitFor(p, () => window.Store.ready().then((db) =>
          db.collection('users').doc(window.Store.uid()).get({ source: 'server' }))
          .then((s) => s.exists && !!s.data().house && s.data().house === window.Store.house)),
        JSON.stringify(await acct()));
      if (made && made !== CODE) {
        await household(made, { favs: [], weeks: {}, active: '', mine: {}, edits: {} });
      }
    } finally {
      try {
        await household(CODE, { favs: [], weeks: {}, active: '', mine: {}, edits: {} });
        await p.evaluate(() => window.Store.ready().then((db) =>
          db.collection('users').doc(window.Store.uid()).delete()));
      } catch (e) { t.ok('the test records were cleaned up', false, e.message); }
      await ctx.close();
    }
  },
};
