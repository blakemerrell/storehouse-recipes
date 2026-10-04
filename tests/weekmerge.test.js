/* Weeks between phones: joining, the move onto dates, pruning, a change
 * that has to reach the household whatever the screen does, and what one
 * change costs in writes.
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
      await w.settle();
      const ws = w.server.H.weeks, vals = Object.values(ws);
      t.ok('joining: the household’s current week is not replaced by a template', !ws.d20260927 || !Object.keys(ws.d20260927.plan || {}).length, JSON.stringify(ws));
      t.ok('the template arrives as a template', vals.some((x) => x.tpl === 1 && x.name === 'Taco night'), JSON.stringify(ws));
      t.ok('the household’s Sep 13 stands, and this phone’s Sep 13 comes as a template',
        JSON.stringify(ws.d20260913.plan) === '{"mon":[1]}' && vals.some((x) => x.tpl === 1 && JSON.stringify(x.plan) === '{"tue":[5]}'), JSON.stringify(ws));
      /* And the phone is told, which it was not: her week was simply gone
         from the calendar, kept only under Cook this again. A template that
         was a template already is nothing to tell. */
      const note = B.S.parkedNote();
      t.ok('the phone is told which of its weeks went to a template, under what name, and only those',
        JSON.stringify(note) === JSON.stringify([{ name: 'Week of Sep 13', dates: 'Sep 13 – Sep 19' }]), JSON.stringify(note));
      t.ok('once: asked again, there is nothing to tell', B.S.parkedNote() === null);
    }

    /* ---- this week planned on both phones: hers is parked, and said ---- */
    {
      const w = world(NOW);
      w.server.H = { favs: [], weeks: { d20260927: week({ mon: [1], tue: [2] }) }, mine: {}, edits: {} };
      const B = w.phone('B', joined({ d20260927: week({ mon: [5], wed: [6] }) }));
      B.S.init(() => {});
      B.S.join('H');
      await w.settle();
      const parked = Object.values(w.server.H.weeks).filter((x) => x.tpl === 1);
      t.ok('the household’s Mon and Tue stand, and her Mon and Wed are the template Week of Sep 27',
        JSON.stringify(w.server.H.weeks.d20260927.plan) === '{"mon":[1],"tue":[2]}' && parked.length === 1 &&
          parked[0].name === 'Week of Sep 27' && JSON.stringify(parked[0].plan) === '{"mon":[5],"wed":[6]}', JSON.stringify(w.server.H.weeks));
      t.ok('and the phone has the words for it: the dates and the template’s name',
        JSON.stringify(B.S.parkedNote()) === JSON.stringify([{ name: 'Week of Sep 27', dates: 'Sep 27 – Oct 3' }]));
      // a phone with nothing the household had planned differently has nothing to be told
      const C = w.phone('C', joined({ d20260927: week({ mon: [1], tue: [2] }), d20261004: week({ fri: [9] }) }));
      C.S.init(() => {});
      C.S.join('H');
      await w.settle();
      t.ok('a join that parks nothing says nothing', C.S.parkedNote() === null && JSON.stringify(w.server.H.weeks.d20261004.plan) === '{"fri":[9]}',
        JSON.stringify(w.server.H.weeks));
    }

    /* ---- the move onto dates: per day, and no false "removed" ---- */
    {
      const w = world(NOW);
      const legacy = { w1: week({ mon: [1] }, { name: 'This Week' }), w2: week({ tue: [2] }, { name: 'Next', ord: 1 }) };
      w.server.H = { favs: [], weeks: JSON.parse(JSON.stringify(legacy)), active: 'w1', mine: {}, edits: {} };
      const A = w.phone('A', joined(legacy, 'H'));
      A.S.init(() => {});
      await w.settle();
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
      await w.settle();
      const queued = w.writes.filter((x) => x.who === 'B').length;
      B.online();
      await w.settle();
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
      await w.settle();
      const B = w.phone('B', joined(wk, 'H'));
      B.S.init(() => {});
      await w.settle();
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
      await w.settle();
      boom = true;
      try { A.S.addToDay(7, 'mon'); } catch (e) { threw = e.message; }
      boom = false;
      await w.settle();
      t.ok('a change made while the screen throws still reaches the household, and stays',
        !threw && JSON.stringify(w.server.H.weeks.d20260927.plan.mon) === '[7]' && A.S.day('mon').length === 1,
        threw + ' ' + JSON.stringify(w.server.H.weeks.d20260927.plan));
      t.ok('and the error is still reported', A.errors.indexOf('render bug') >= 0, JSON.stringify(A.errors));
    }

    /* ---- one tap, one write ---- */
    /* Where the staples come from is three household switches, four from
       the front door, set together in a batch (setSrcKind in app.js). Each
       was its own write — four billed writes and four snapshots on every
       phone, for one tap. */
    {
      const w = world(NOW);
      w.server.H = { favs: [], weeks: { d20260927: week({}), wT: week({ mon: [1], tue: [2], wed: [3] }, { name: 'Usual', ord: 1, tpl: 1 }) },
        mine: {}, edits: {}, opts: { store: 1 } };
      const A = w.phone('A', joined({}, 'H'));
      const B = w.phone('B', joined({}, 'H'));
      A.S.init(() => {});
      B.S.init(() => {});
      await w.settle();
      let n = w.writes.length;
      A.S.batch(() => { A.S.setOpt('store', true); A.S.setOpt('fb', true); A.S.setOpt('big', false); A.S.setOpt('setup', true); });
      await w.settle();
      let ws = w.writes.slice(n);
      t.ok('a tap on where the staples come from is one write, of all four switches',
        ws.length === 1 && ws[0].update.join() === 'opts.store,opts.fb,opts.big,opts.setup', JSON.stringify(ws));
      t.ok('and the other phone has all four from it', B.S.opt('fb') && B.S.opt('setup') && !B.S.opt('big', true) && B.S.opt('store'),
        JSON.stringify(B.S.state.opts));

      n = w.writes.length;
      A.S.batch(() => {
        A.S.setKitchen('salt', 1); A.S.setSrc('salt', null);   // two maps, two fields: one write
        A.S.addToDay(7, 'mon');                                 // a union: its own write, in its place
        A.S.setLow('milk', true); A.S.setLow('milk', false);    // one field twice: two writes, the last standing
      });
      await w.settle();
      ws = w.writes.slice(n);
      t.ok('a batch folds only plain writes to different fields, and keeps the order they were made in',
        ws.map((x) => x.update.join()).join(' | ') === 'kitchen.salt,src.salt | weeks.d20260927.plan.mon | low.milk | low.milk', ws.map((x) => x.update.join()).join(' | '));
      t.ok('so the household holds what was said last', w.server.H.kitchen.salt === 1 && !('milk' in (w.server.H.low || {})) &&
        JSON.stringify(w.server.H.weeks.d20260927.plan.mon) === '[7]', JSON.stringify({ k: w.server.H.kitchen, l: w.server.H.low, p: w.server.H.weeks.d20260927.plan }));

      n = w.writes.length;
      A.S.cookAgain('wT');
      await w.settle();
      ws = w.writes.slice(n);
      t.ok('Cook this again puts its nights on in one write (Monday, taken already, left as it is)', ws.length === 1 &&
        ws[0].update.join() === 'weeks.d20260927.plan.tue,weeks.d20260927.plan.wed' &&
        JSON.stringify(w.server.H.weeks.d20260927.plan) === '{"mon":[7],"tue":[2],"wed":[3]}', JSON.stringify({ ws, p: w.server.H.weeks.d20260927.plan }));

      // a tap before the household has answered is held, and still goes as one
      const Q = w.phone('Q', joined({}, 'H'));
      Q.S.init(() => {});
      n = w.writes.length;
      Q.S.batch(() => { Q.S.setOpt('store', false); Q.S.setOpt('fb', false); Q.S.setOpt('big', false); });
      await w.settle();
      ws = w.writes.slice(n).filter((x) => x.who === 'Q');
      t.ok('made before the household answered, held, and sent as one', ws.length === 1 && ws[0].update.join() === 'opts.store,opts.fb,opts.big' &&
        w.server.H.opts.store === 0, JSON.stringify(ws));
      t.ok('with nothing thrown', A.errors.length + B.errors.length + Q.errors.length === 0, JSON.stringify([A.errors, B.errors, Q.errors]));
    }
  },
};
