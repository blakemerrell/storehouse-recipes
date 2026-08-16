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

    await ctx.close();
  },
};
