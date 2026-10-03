/* What the household document can hold that the app never wrote, and what
 * the app does about it: bad map keys, two phones changing one day, the entry
 * a leaving account would have left behind.
 *
 * Found by a review on 3 October 2026. Anyone with the code can write the
 * document, and a key is a Firestore field path: one with a dot in it put
 * every phone in the household into a write loop (253 writes in three
 * seconds), and one with a star made the client throw in the middle of a
 * snapshot, so the household went quiet on that phone for good. Two phones
 * and a server, in Node, against tests/fixtures/fakefire.js, whose update()
 * refuses the paths the real client refuses. Thursday 1 October 2026: this
 * week is d20260927. */
const { world, joined } = require('./fixtures/fakefire.js');

const NOW = new Date(2026, 9, 1, 12, 0, 0);
const WK = 'd20260927';
const week = (plan, extra) => Object.assign({ name: '', ord: 0, plan, checked: {} }, extra || {});
const house = (weeks, extra) => Object.assign({ favs: [], weeks, mine: {}, edits: {} }, extra || {});
const paths = (w, who) => w.writes.filter((x) => x.update && (!who || x.who === who)).map((x) => x.update.join(',')).join(' | ');

module.exports = {
  name: 'Bad keys and the household',
  async run(t) {
    /* ---- a check-off key with a dot in it: dropped, never pruned, no loop ---- */
    {
      const w = world(NOW);
      w.server.H = house({ [WK]: week({ mon: [1] }, { checked: { 'a.b': true, milk: true, 'x*y': true } }) });
      const A = w.phone('A', joined({}, 'H'));
      A.S.init(() => {});
      await w.wait(150);
      const kept = JSON.parse(A.ls['bsc.weeks'])[WK].checked;
      t.ok('a key that is not a field path never reaches the phone', JSON.stringify(kept) === '{"milk":true}', JSON.stringify(kept));
      const before = w.writes.length;
      const pruned = A.S.pruneChecked(['milk']);
      await w.wait(100);
      t.ok('so there is nothing stale to prune, and nothing is written', pruned === false && w.writes.length === before && A.errors.length === 0,
        JSON.stringify({ pruned, writes: paths(w, 'A'), errors: A.errors }));
      A.S.pruneChecked([]);
      await w.wait(150);
      const n = w.writes.filter((x) => x.update && /checked/.test(x.update.join())).length;
      t.ok('a real stale key is pruned once, and the pruning stops', n === 1 && !w.server.H.weeks[WK].checked.milk, paths(w, 'A'));
    }

    /* ---- a week id or a day key the client would refuse as a path ---- */
    {
      const w = world(NOW);
      w.server.H = house({ 'w*': { name: 'This Week', ord: 0, plan: { tue: [2] }, checked: {} }, [WK]: week({ mon: [1], 'mon*': [3], xyz: [4] }) },
        { active: 'w*', pantryNew: { 'a*b': { l: 'Star', c: 'Yours' }, own_mace: { l: 'Mace', c: 'Yours' } } });
      const A = w.phone('A', joined({}, 'H'));
      A.S.init(() => {});
      await w.wait(200);
      const weeks = JSON.parse(A.ls['bsc.weeks']);
      t.ok('the week with the bad id is left at the door; the household still speaks',
        !weeks['w*'] && !!weeks[WK] && A.errors.length === 0 && A.S.status === 'synced', JSON.stringify({ ids: Object.keys(weeks), errors: A.errors, status: A.S.status }));
      t.ok('only the seven days of a week come through', Object.keys(weeks[WK].plan).join() === 'mon' && A.S.day('mon*').length === 0, JSON.stringify(weeks[WK].plan));
      t.ok('and a pantry item under a key that is no path', Object.keys(JSON.parse(A.ls['bsc.pantryNew'])).join() === 'own_mace', A.ls['bsc.pantryNew']);
      t.ok('nothing with a bad key was ever written back', !/\*/.test(paths(w)), paths(w));
    }

    /* ---- what was held for one household is not sent into another ---- */
    {
      const w = world(NOW);
      w.server.A = house({ [WK]: week({ mon: [1] }) });
      w.server.H = house({ [WK]: week({ mon: [2] }) });
      const B = w.phone('B', {});
      B.S.init(() => {});
      B.S.join('A');
      B.S.toggleChecked('milk');       // before A has answered: held
      B.S.join('H');                   // a second code typed, no leaving in between
      await w.wait(250);
      t.ok('a check-off held for the first household never lands in the second', !/checked\.milk/.test(paths(w)) &&
        !(w.server.H.weeks[WK].checked || {}).milk, paths(w));
    }

    /* ---- the household's switches are the household's: not contributed ---- */
    {
      const w = world(NOW);
      w.server.H = house({ [WK]: week({ mon: [1] }) });
      const B = w.phone('B', { 'bsc.opts': JSON.stringify({ store: 0, fb: 0, setup: 1 }), 'bsc.favs': '[7]' });
      B.S.init(() => {});
      B.S.join('H');
      await w.wait(200);
      t.ok('joining brings the favourites, not the front door’s staples answer',
        (w.server.H.favs || []).indexOf(7) >= 0 && !(w.server.H.opts && 'store' in w.server.H.opts), JSON.stringify({ favs: w.server.H.favs, opts: w.server.H.opts }));
      t.ok('and the phone takes the household’s: the storehouse, as a household that never chose', B.S.opt('store', true) === true, String(B.S.opt('store', true)));
    }

    /* ---- leaving takes the account off the list and its numbers out ---- */
    {
      const w = world(NOW);
      w.server.H = house({ [WK]: week({ mon: [1] }) }, { members: ['alice', 'bob'], diners: { alice: { n: 'Ali', kc: 550, p: 70 }, bob: { n: 'Bob', kc: 400, p: 40 } } });
      const A = w.phone('alice', joined({}, 'H'), { account: true });
      A.S.init(() => {});
      await w.wait(150);
      t.ok('signed in and joined, the phone sees both diners', Object.keys(A.S.diners()).sort().join() === 'alice,bob', JSON.stringify(A.S.diners()));
      A.S.leave();
      await w.wait(150);
      t.ok('leaving takes alice off the members and out of the diners, and leaves bob', JSON.stringify(w.server.H.members) === '["bob"]' &&
        !w.server.H.diners.alice && !!w.server.H.diners.bob, JSON.stringify({ m: w.server.H.members, d: w.server.H.diners }));
      t.ok('and the phone keeps nobody’s numbers', Object.keys(A.S.diners()).length === 0 && A.S.house === '', JSON.stringify(A.S.diners()));
    }

    /* ---- moving to another household is leaving the first ---- */
    {
      const w = world(NOW);
      w.server.H = house({ [WK]: week({ mon: [1] }) }, { members: ['alice', 'bob'], diners: { alice: { n: 'Ali', kc: 550, p: 70 }, bob: { n: 'Bob', kc: 400, p: 40 } } });
      w.server.K = house({ [WK]: week({ tue: [2] }) }, { members: ['carol'] });
      const A = w.phone('alice', joined({}, 'H'), { account: true });
      A.S.init(() => {});
      await w.wait(150);
      A.S.join('K');                 // the box under the code, an invite, or the account's pantry
      await w.wait(200);
      t.ok('joining another household takes alice off the first one’s list and out of its diners, and leaves bob',
        JSON.stringify(w.server.H.members) === '["bob"]' && !w.server.H.diners.alice && !!w.server.H.diners.bob,
        JSON.stringify({ m: w.server.H.members, d: w.server.H.diners }));
      t.ok('and she is on the new one’s list, which kept its own', A.S.house === 'K' && (w.server.K.members || []).indexOf('alice') >= 0 && (w.server.K.members || []).indexOf('carol') >= 0,
        JSON.stringify(w.server.K.members));
      const n = w.writes.length;
      A.S.join('K');                 // the same code again is not a move
      await w.wait(150);
      t.ok('rejoining the household she is in says no goodbye to it', !w.writes.slice(n).some((x) => x.update && x.update.indexOf('members') >= 0), JSON.stringify(w.writes.slice(n)));
    }

    /* ---- a diner's numbers the rules take and the app used to drop ---- */
    {
      const w = world(NOW);
      w.server.H = house({ [WK]: week({ mon: [1] }) }, { members: ['bob'], diners: { bob: { n: 'Bob ', kc: 599.9, p: 40.2 }, eve: { n: ' ', kc: 500, p: 40 } } });
      const A = w.phone('A', joined({}, 'H'));
      A.S.init(() => {});
      await w.wait(150);
      t.ok('a name with a space on the end and a calorie count with a fraction read as the app would have written them',
        JSON.stringify(A.S.diners()) === '{"bob":{"n":"Bob","kc":600,"p":40}}', JSON.stringify(A.S.diners()));
    }

    /* ---- two phones change one day: neither undoes the other ---- */
    {
      const w = world(NOW);
      w.server.H = house({ [WK]: week({ mon: [11, 12] }) });
      const A = w.phone('A', joined({}, 'H')), B = w.phone('B', joined({}, 'H'));
      A.S.init(() => {}); B.S.init(() => {});
      await w.wait(150);
      const before = w.writes.length;
      A.S.addToDay(11, 'mon', 1);
      await w.wait(60);
      t.ok('a count that is already so writes nothing', w.writes.length === before, paths(w).slice(-200));
      A.S.addToDay(11, 'mon', 2);          // Monday's dinner doubled on one phone
      B.S.addToDay(12, 'mon', 4);          // the other's, on a phone that has not heard
      await w.wait(250);
      const mon = w.server.H.weeks[WK].plan.mon.map((e) => (typeof e === 'object' ? e.i + 'x' + e.x : e + 'x1')).sort().join();
      t.ok('both changes stand: the old entry off and the new one on, never the day whole from one phone’s copy',
        mon === '11x2,12x4', JSON.stringify(w.server.H.weeks[WK].plan.mon));
      t.ok('as two writes each, a removal and then an addition', w.writes.filter((x) => x.update && x.update[0] === 'weeks.' + WK + '.plan.mon').length === 4, paths(w));
      t.ok('and both phones read the same Monday',
        JSON.stringify(A.S.day('mon')) === JSON.stringify(B.S.day('mon')) && A.S.day('mon').length === 2, JSON.stringify([A.S.day('mon'), B.S.day('mon')]));
    }

    /* ---- the same dinner twice on a day is one dinner, the later statement ---- */
    {
      const w = world(NOW);
      w.server.H = house({ [WK]: week({ mon: [51, { i: 51, x: 2 }, 52] }) });
      const A = w.phone('A', joined({}, 'H'));
      A.S.init(() => {});
      await w.wait(150);
      const mon = A.S.day('mon');
      t.ok('two sizes of one dinner read as the later one', mon.length === 2 && mon[0].id === 51 && mon[0].x === 2 && mon[1].id === 52, JSON.stringify(mon));
    }
  },
};
