/* Weeks between phones: joining, the move onto dates, pruning, and a change
 * that has to reach the household whatever the screen does.
 *
 * Found by a review on 1 October 2026. Two phones and a household, in Node,
 * against tests/fixtures/fakefire.js — no network and no browser. The clock is
 * Thursday 1 October 2026: this week is d20260927. */
const { world, joined } = require('./fixtures/fakefire.js');

const NOW = new Date(2026, 9, 1, 12, 0, 0);
const week = (plan, extra) => Object.assign({ name: '', ord: 0, plan, checked: {} }, extra || {});

module.exports = {
  name: 'Weeks between phones',
  async run(t) {
    /* ---- joining keeps a template a template ---- */
    {
      const w = world(NOW);
      w.server.H = { favs: [], weeks: { d20260913: week({ mon: [1] }) }, mine: {}, edits: {} };
      const B = w.phone('B', joined({ d20260913: week({ tue: [5] }), wTPL: week({ fri: [9] }, { name: 'Taco night', ord: 1, tpl: 1 }) }));
      B.S.init(() => {});
      B.S.join('H');
      await w.wait(150);
      const ws = w.server.H.weeks, vals = Object.values(ws);
      t.ok('joining: the household’s current week is not replaced by a template', !ws.d20260927 || !Object.keys(ws.d20260927.plan || {}).length, JSON.stringify(ws));
      t.ok('the template arrives as a template', vals.some((x) => x.tpl === 1 && x.name === 'Taco night'), JSON.stringify(ws));
      t.ok('the household’s Sep 13 stands, and this phone’s Sep 13 comes as a template',
        JSON.stringify(ws.d20260913.plan) === '{"mon":[1]}' && vals.some((x) => x.tpl === 1 && JSON.stringify(x.plan) === '{"tue":[5]}'), JSON.stringify(ws));
    }

    /* ---- the move onto dates: per day, and no false "removed" ---- */
    {
      const w = world(NOW);
      const legacy = { w1: week({ mon: [1] }, { name: 'This Week' }), w2: week({ tue: [2] }, { name: 'Next', ord: 1 }) };
      w.server.H = { favs: [], weeks: JSON.parse(JSON.stringify(legacy)), active: 'w1', mine: {}, edits: {} };
      const A = w.phone('A', joined(legacy, 'H'));
      A.S.init(() => {});
      await w.wait(150);
      const ws = w.server.H.weeks;
      const mv = w.writes.filter((x) => x.update && x.update.some((k) => /^weeks\.d20260927/.test(k)))[0];
      t.ok('the old This Week moves onto this week’s dates, the other becomes a template',
        JSON.stringify(ws.d20260927 && ws.d20260927.plan) === '{"mon":[1]}' && !ws.w1 && ws.w2 && ws.w2.tpl === 1, JSON.stringify(ws));
      t.ok('the move is written day by day, never the week whole',
        !!mv && mv.update.indexOf('weeks.d20260927') < 0 && mv.update.indexOf('weeks.d20260927.plan.mon') >= 0, JSON.stringify(mv));
      t.ok('the phone that moved it reports nothing removed by anybody', A.S.removed().length === 0, JSON.stringify(A.S.removed()));
    }

    /* ---- a phone opening offline on an old copy moves nothing ---- */
    {
      const w = world(NOW);
      const legacy = { w1: week({ mon: [1] }, { name: 'This Week' }) };
      w.server.H = { favs: [], weeks: { d20260927: week({ mon: [1], wed: [4] }) }, mine: {}, edits: {} };
      const old = { favs: [], weeks: legacy, active: 'w1', mine: {}, edits: {} };
      const B = w.phone('B', joined(legacy, 'H'), { cached: old });
      B.S.init(() => {});
      await w.wait(150);
      const queued = w.writes.filter((x) => x.who === 'B').length;
      B.online();
      await w.wait(150);
      t.ok('a phone opening offline on an old copy writes nothing from it',
        queued === 0 && JSON.stringify(w.server.H.weeks.d20260927.plan) === '{"mon":[1],"wed":[4]}', queued + ' ' + JSON.stringify(w.server.H.weeks));
    }

    /* ---- pruning is not a removal ---- */
    {
      const w = world(NOW);
      const wk = { d20260301: week({ mon: [1] }), d20260308: week({ mon: [2] }), d20260927: week({ mon: [3] }) };
      w.server.H = { favs: [], weeks: JSON.parse(JSON.stringify(wk)), mine: {}, edits: {} };
      const A = w.phone('A', joined(wk, 'H'));
      A.S.init(() => {});
      await w.wait(200);
      const B = w.phone('B', joined(wk, 'H'));
      B.S.init(() => {});
      await w.wait(200);
      t.ok('weeks half a year gone are pruned', Object.keys(w.server.H.weeks).join() === 'd20260927', Object.keys(w.server.H.weeks).join());
      t.ok('and no phone calls them removed by somebody', A.S.removed().length === 0 && B.S.removed().length === 0,
        JSON.stringify([A.S.removed().map((x) => x.id), B.S.removed().map((x) => x.id)]));
    }

    /* ---- a redraw that throws does not keep a change from the household ---- */
    {
      const w = world(NOW);
      w.server.H = { favs: [], weeks: { d20260927: week({}) }, mine: {}, edits: {} };
      const A = w.phone('A', joined({}, 'H'));
      let boom = false, threw = '';
      A.S.init(() => { if (boom) throw new Error('render bug'); });
      await w.wait(150);
      boom = true;
      try { A.S.addToDay(7, 'mon'); } catch (e) { threw = e.message; }
      boom = false;
      await w.wait(150);
      t.ok('a change made while the screen throws still reaches the household, and stays',
        !threw && JSON.stringify(w.server.H.weeks.d20260927.plan.mon) === '[7]' && A.S.day('mon').length === 1,
        threw + ' ' + JSON.stringify(w.server.H.weeks.d20260927.plan));
      t.ok('and the error is still reported', A.errors.indexOf('render bug') >= 0, JSON.stringify(A.errors));
    }
  },
};
