/* Joining a household must not cost you anything.
 *
 * It used to. adopt() replaced the favorites, the weeks, the edits and the
 * recipes somebody had written themselves with whatever the household held,
 * and only the first device into a new household seeded it — so the second one
 * in lost the lot, silently, with no undo. That is precisely the case the app
 * invites: two people who have each been using it, putting both phones on one
 * list. One of them was always going to be robbed by it.
 *
 * Store.contribute is what fixed it, and this is the test of that, run without
 * a network in front of it. tests/sync.test.js exercises the same thing
 * against the live project, but it needs signal and is not in the default run,
 * and a guard against silent data loss should not be the one that only runs
 * when somebody remembers to ask for it.
 *
 * Every assertion below is phrased as the thing a person would lose.
 */

module.exports = {
  name: 'Joining a household',
  async run(t) {
    const ctx = await t.browser.newContext({ viewport: { width: 1100, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => t.ok('no uncaught error on the page', false, e.message));

    /* A phone that has been used on its own for a while: two favorites, a
       recipe written by hand, an edit to a printed one, and a week with meals
       on it — under the fixed id w1, which is the id every fresh phone and
       every fresh household gives its first week. That collision is the whole
       difficulty and it has to be in the fixture. */
    await p.goto(t.base + 'index.html');
    await p.evaluate(() => {
      /* Whole recipes, not stubs. The app renders everything in `mine` into
         the collection the moment it loads, so a half-built object here would
         throw on the page and this test would be measuring its own fixture. */
      const recipe = (id, name) => ({
        id: id, book: 3, secNum: 1, secName: 'Yours', name: name,
        servings: '4 servings', servN: 4, ing: ['1 cup water'], steps: ['Boil it.'],
        macro: { kcal: 200, p: 10, c: 20, f: 5, na: 300, fib: 3 },
        tagline: '', score: 60, sc: {}, diff: 1, time: '10 mins', extras: [], ingp: [], est: false,
      });
      localStorage.clear();
      localStorage.setItem('bsc.favs', JSON.stringify([12, 34]));
      localStorage.setItem('bsc.mine',
        JSON.stringify({ u_mine: recipe('u_mine', 'Chili of my own') }));
      localStorage.setItem('bsc.edits',
        JSON.stringify({ 7: recipe(7, 'No. 7, my way') }));
      localStorage.setItem('bsc.weeks', JSON.stringify({
        w1: { name: 'This Week', ord: 0, plan: { mon: [12], tue: [34] }, checked: { milk: 1 } }
      }));
      localStorage.setItem('bsc.active', 'w1');
    });
    await p.reload();

    // the household this phone is about to join, as it stands on the other phone
    const THEIRS = {
      favs: [34, 56],
      mine: { u_theirs: { id: 'u_theirs', book: 3, secNum: 1, secName: 'Yours', name: 'Her rolls', servings: '4 servings', servN: 4, ing: ['1 cup flour'], steps: ['Bake it.'], macro: { kcal: 200, p: 6, c: 30, f: 4, na: 200, fib: 2 }, tagline: '', score: 55, sc: {}, diff: 1, time: '20 mins', extras: [], ingp: [], est: false } },
      edits: { 9: { id: 9, book: 1, secNum: 1, secName: 'Hers', name: 'No. 9, her way', servings: '4 servings', servN: 4, ing: ['1 cup milk'], steps: ['Stir it.'], macro: { kcal: 150, p: 8, c: 12, f: 5, na: 150, fib: 1 }, tagline: '', score: 62, sc: {}, diff: 1, time: '5 mins', extras: [], ingp: [], est: false } },
      weeks: { w1: { name: 'This Week', ord: 0, plan: { wed: [56] }, checked: {} } },
      active: 'w1',
    };

    const add = await p.evaluate((d) => window.__contribute(d), THEIRS);

    t.ok('joining does not cost you a favorite',
      add && [12, 34, 56].every((id) => add.favs.indexOf(id) >= 0) && add.favs.length === 3,
      JSON.stringify(add && add.favs));

    /* The one that would be unrecoverable. A favorite can be re-starred and a
       week can be re-planned; a recipe somebody typed out is gone for good. */
    t.ok('and does not cost you a recipe you wrote yourself',
      !!(add && add.mine && add.mine.u_mine), JSON.stringify(add && add.mine));

    t.ok('and does not cost you an edit to a printed recipe',
      !!(add && add.edits && add.edits[7]), JSON.stringify(add && add.edits));

    /* Both sides call their first week w1 and mean different weeks. The
       household's stays where it is; this phone's has to arrive under an id of
       its own or it would overwrite the very thing it is joining. */
    const weeks = (add && add.weeks) || {};
    const keys = Object.keys(weeks);
    t.ok('and does not cost you the week you had planned',
      keys.length === 1 && JSON.stringify(weeks[keys[0]].plan) === JSON.stringify({ mon: [12], tue: [34] }),
      JSON.stringify(weeks));
    t.ok('which arrives under an id of its own rather than over theirs',
      keys[0] !== 'w1', keys.join(' '));
    /* Two weeks called This Week is a household nobody can navigate. */
    t.ok('and under a name that tells the two apart',
      keys.length === 1 && weeks[keys[0]].name !== 'This Week' && /This Week/.test(weeks[keys[0]].name),
      keys.length ? weeks[keys[0]].name : '(none)');

    /* Where both have touched the same thing the household's copy stands. It
       is the shared record; this is a phone arriving at it. */
    t.ok('what they already had is left as they had it',
      !(add.mine || {}).u_theirs && !(add.edits || {})[9], JSON.stringify(add));

    /* The ordinary case, and the one that keeps a rejoin from duplicating
       everything: a phone already mirroring a household brings nothing. */
    const mirror = await p.evaluate(() => window.__contribute({
      favs: window.Store.state.favs,
      mine: window.Store.state.mine,
      edits: window.Store.state.edits,
      weeks: window.Store.state.weeks,
      active: window.Store.state.active,
    }));
    t.ok('and a phone that already has what the household has adds nothing',
      mirror === null, JSON.stringify(mirror));

    /* An empty week is not worth carrying into a household that has weeks in
       it — it would arrive as a second This Week with nothing on it. */
    const empty = await p.evaluate(() => {
      localStorage.setItem('bsc.weeks', JSON.stringify({
        w1: { name: 'This Week', ord: 0, plan: {}, checked: {} }
      }));
      return null;
    });
    await p.reload();
    const noEmpty = await p.evaluate((d) => window.__contribute(d), THEIRS);
    t.ok('an empty week is not carried across', !(noEmpty && noEmpty.weeks),
      JSON.stringify(noEmpty && noEmpty.weeks) + String(empty || ''));

    /* Fix two, as far as it can be checked without a network: the shape of the
       thing that has to stay unique. Sixteen words, four digits, sixteen words
       is 2.3 million codes and nothing ever releases one, which is why
       createHousehold checks before handing one over. That check needs
       Firestore and lives in tests/sync.test.js. */
    const codes = await p.evaluate(() =>
      Array.from({ length: 200 }, () => window.Store.newCode()));
    t.ok('a household code is two words and four digits',
      codes.every((c) => /^[A-Z]+-\d{4}-[A-Z]+$/.test(c)), codes[0]);
    t.ok('and they are not all the same one',
      new Set(codes).size > 150, new Set(codes).size + ' distinct of 200');

    /* ---- joining with no signal ------------------------------------------
     *
     * The half of this that had no test, and the half that broke. connect()
     * used to clear pendingMerge at the top, before it had done anything —
     * so a join attempted with no signal threw away the intention to
     * contribute while join() had already written the household code to
     * localStorage. The next launch found a code, no pending merge, and
     * adopted the household straight over the top of this phone: the exact
     * loss contribute() exists to prevent, moved into the failure path where
     * nobody would look for it.
     *
     * The no-signal condition is MADE here, not assumed. This used to rely on
     * the container having no network — "ready() genuinely cannot load the
     * SDK, the failure arrives by itself" — which is true on a build box and
     * false on a laptop, where gstatic answers and the premise of the whole
     * block quietly evaporates. That is why these three assertions have been
     * failing two runs in three and passing the third: not a race in the app,
     * an assumption about the room it was running in. The SDK's own host is
     * refused instead, so the failure being tested is the failure that
     * happens, wherever this runs.
     *
     * The same window is what queues writes: with `doc` still null there is
     * nowhere to send a change, and it used to be applied locally and then
     * dropped, to be overwritten by the first snapshot that ever arrived. */
    const off = await t.browser.newContext();
    /* Only the SDK's host. Blocking everything would take the page itself
       down with it — it is served from the test server on 127.0.0.1, and a
       page that never loads proves nothing about a page that cannot sync. */
    await off.route('**://www.gstatic.com/**', (r) => r.abort());
    const q = await off.newPage();
    await q.goto(t.base + 'index.html');
    await q.evaluate(() => localStorage.clear());
    await q.reload();
    await q.evaluate(() => window.Store.join('KETTLE-4827-ORCHARD'));
    await q.waitForTimeout(2500);

    const state = await q.evaluate(() => window.__syncDebug());
    t.ok('a join that cannot reach the server does not give up on merging',
      state.pendingMerge === true, JSON.stringify(state));
    t.ok('and says so rather than claiming to be synced',
      state.status === 'error' || state.status === 'connecting', state.status);

    /* Applied here, and held for the connection rather than dropped. */
    await q.evaluate(() => window.Store.toggleFav(42));
    await q.waitForTimeout(300);
    const after = await q.evaluate(() => ({
      dbg: window.__syncDebug(),
      fav: window.Store.isFav(42),
      saved: JSON.parse(localStorage.getItem('bsc.favs') || '[]'),
    }));
    t.ok('a change made before the connection is up is kept on the phone',
      after.fav && after.saved.indexOf(42) >= 0, JSON.stringify(after));
    t.ok('and held for the server rather than dropped',
      after.dbg.queued > 0, JSON.stringify(after.dbg));


    /* ---- a code that matches nobody must not become a household ----------
     *
     * There is no password on a household document, so the code is the whole
     * of the security, and a code that matches nobody had the worst possible
     * answer: connect() seeded a brand-new household from whatever was on the
     * phone, and the sheet said "Shared · just now" — pixel for pixel what a
     * real join says. You end up alone in a household of one, syncing
     * perfectly with nobody, with nothing anywhere to tell you.
     *
     * Creating still has to seed one, including a create made with no signal,
     * which is seeded on a later connect and possibly after a reload. So the
     * intent is written down rather than inferred: `seeded` is false for both
     * an unverified create and every typed code, and cannot separate them. */
    const typo = await off.newPage();
    await typo.goto(t.base + 'index.html');
    await typo.evaluate(() => localStorage.clear());
    await typo.reload();
    await typo.evaluate(() => window.Store.join('NOBODY-0000-HOME'));
    await typo.waitForTimeout(200);
    t.ok('a typed code is not ours to bring into being',
      await typo.evaluate(() => window.Store.houseIsMine === false &&
        JSON.parse(localStorage.getItem('bsc.houseNew')) === ''),
      await typo.evaluate(() => window.Store.houseIsMine + ' / ' + localStorage.getItem('bsc.houseNew')));

    const mine = await typo.evaluate(() => window.Store.createHousehold('MYOWN-1234-KITCHEN')
      .then(() => ({ flag: window.Store.houseIsMine, saved: JSON.parse(localStorage.getItem('bsc.houseNew')) })));
    t.ok('a code this device drew for itself is',
      mine.flag === true && mine.saved === '1', JSON.stringify(mine));

    await typo.reload();
    await typo.waitForTimeout(200);
    t.ok('and it survives the reload a no-signal create is seeded after',
      await typo.evaluate(() => window.Store.houseIsMine === true),
      await typo.evaluate(() => String(window.Store.houseIsMine)));

    await typo.evaluate(() => window.Store.leave());
    t.ok('leaving forgets the intent with the code',
      await typo.evaluate(() => window.Store.houseIsMine === false),
      await typo.evaluate(() => String(window.Store.houseIsMine)));
    await typo.close();

    /* A household already on a device predates the flag. Being strict with it
       would evict people who joined perfectly well, so it is grandfathered
       once; the rule is for codes typed from here on. */
    const grand = await off.newPage();
    await grand.goto(t.base + 'index.html');
    await grand.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('bsc.house', JSON.stringify('OLDER-5555-HOUSE'));
    });
    await grand.reload();
    await grand.waitForTimeout(200);
    t.ok('a household from before this rule is left alone',
      await grand.evaluate(() => window.Store.houseIsMine === true),
      await grand.evaluate(() => String(window.Store.houseIsMine)));
    await grand.close();

    const strict = await off.newPage();
    await strict.goto(t.base + 'index.html');
    await strict.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('bsc.house', JSON.stringify('TYPED-6666-CODE'));
      localStorage.setItem('bsc.houseNew', JSON.stringify(''));
    });
    await strict.reload();
    await strict.waitForTimeout(200);
    t.ok('but a code typed under it stays not-ours across a reload',
      await strict.evaluate(() => window.Store.houseIsMine === false),
      await strict.evaluate(() => String(window.Store.houseIsMine)));
    await strict.close();

    /* ---- "Cannot reach the server" has to survive to the screen -----------
     *
     * ready() rejects and the state goes to 'error'. Then the next call to
     * mSyncStart — opening the sheet, pressing a button — finds the auth
     * answer "known" and nobody signed in, falls through to the signed-out
     * branch, and writes 'off' over it. The sheet then reads "On this device
     * only", which is the same words a phone that never had an account shows,
     * so a dead network read as a fresh invitation to sign in. */
    const err = await off.newPage();
    await err.goto(t.base + 'index.html');
    await err.evaluate(() => { localStorage.clear(); localStorage.setItem('bsc.myAccount', '1'); });
    await err.reload();
    await err.waitForTimeout(2500);
    const before = await err.evaluate(() => window.__macroLab.syncState());
    await err.evaluate(() => window.__macroLab.syncStart());
    await err.waitForTimeout(300);
    t.ok('a device that cannot reach the server keeps saying so',
      before === 'error' && await err.evaluate(() => window.__macroLab.syncState()) === 'error',
      before + ' -> ' + await err.evaluate(() => window.__macroLab.syncState()));
    await err.close();

    /* ---- the sheet says which half an account carries ---------------------
     *
     * An account backs up My Day and nothing else: favorites, the week and
     * the shopping list live on the household code. Somebody who signs in
     * after favoriting twenty recipes has backed up none of them, and the
     * screen that exists to explain sharing did not say so. */
    await p.click('#syncBtn');
    await p.waitForTimeout(300);
    const copy = await p.evaluate(() => Array.from(document.querySelectorAll('.sync-p'))
      .map((e) => e.textContent).join(' | '));
    t.ok('the sheet says an account carries the day and the code carries the pantry',
      /only part an account carries/i.test(copy) && /live on the code, not on your account/i.test(copy),
      copy.slice(0, 200));

    await off.close();
    await ctx.close();
  },
};
