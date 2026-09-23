/* Train: the block, the logger, the records, the review, and the sync.
 *
 * Most of what matters here is arithmetic — how many sets next week, what
 * weight, whether a set is a record, what the review says — so most of these
 * checks feed the real functions logged workouts and read the answer back,
 * through window.Train._. The rest drive the screen the way a thumb would. */

const DAY = 864e5;

/* A workout as the logger saves one, dated days ago. */
function wo(id, ms, w, d, daysAgo, x, extra) {
  const st = Date.now() - daysAgo * DAY;
  return Object.assign({ id, st, en: st + 3600e3, dk: '2026-01-01', n: 'W', u: 'lb',
    ms: ms || '', w, d, dl: 0, x, sr: {}, fb: {} }, extra || {});
}
function sets(w, reps, t0) {
  return reps.map((r, i) => ({ w, r, t: (t0 || 1e12) + i * 150e3 }));
}

/* Put a training log in storage and have Train read it. */
async function seed(p, T) {
  await p.evaluate((T) => {
    localStorage.setItem('bsc.train', JSON.stringify(T));
    localStorage.removeItem('bsc.trainStamps');
    window.Train._.reload();
  }, T);
}

module.exports = {
  name: 'Train',
  async run(t) {
    // ---- the tab --------------------------------------------------------
    let p = await t.fresh();
    const tabs = await p.evaluate(() =>
      [...document.querySelectorAll('.tab')].map((b) => b.dataset.view));
    t.ok('there is a Train tab, beside My Day', tabs.indexOf('train') === tabs.indexOf('macros') + 1, tabs.join());
    await p.click('.tab[data-view="train"]');
    await p.waitForTimeout(100);
    t.ok('it opens on the block builder', await p.isVisible('[data-t="build"]'));
    await p.reload();
    await p.waitForTimeout(200);
    t.ok('and is the tab you come back to', await p.isVisible('#view-train [data-t="build"]'));

    // ---- building a block -----------------------------------------------
    await p.click('[data-t="g-dpw"][data-v="4"]');
    await p.click('[data-t="g-pri"][data-v="side"]');
    await p.click('[data-t="build"]');
    await p.waitForTimeout(100);
    let d = await p.evaluate(() => {
      const ms = window.Train._.state().S.draft;
      const lib = window.Train._.lib;
      return {
        days: ms.days.map((x) => x.n),
        min: Math.min(...ms.days.flatMap((x) => x.s.map((s) => s.n))),
        side: ms.days.flatMap((x) => x.s).filter((s) => lib(s.e).m === 'side').reduce((n, s) => n + s.n, 0),
        dupes: ms.days.some((x) => new Set(x.s.map((s) => s.e)).size !== x.s.length),
      };
    });
    t.ok('four days a week builds upper / lower', d.days.join() === 'Upper A,Lower A,Upper B,Lower B', d.days.join());
    t.ok('no exercise gets fewer than two sets in week one', d.min >= 2, d.min);
    t.ok('a muscle you want to bring up starts two sets over RP’s MEV', d.side === 10, d.side);
    t.ok('and no day repeats an exercise', !d.dupes);

    await p.click('[data-t="dset"][data-d="0"][data-i="0"][data-v="1"]');
    await p.click('[data-t="dswap"][data-d="0"][data-i="0"]');
    await p.waitForTimeout(100);
    const swapTo = await p.evaluate(() => {
      const first = document.querySelector('#trainRoot [data-t="pickex"]');
      return { e: first.dataset.e, filtered: document.querySelector('#trainRoot [data-t="pickm"][aria-pressed="true"]').dataset.v };
    });
    t.ok('swapping offers the same muscle first', swapTo.filtered === 'chest', swapTo.filtered);
    await p.click('#trainRoot [data-t="pickex"][data-e="db-bench"]');
    await p.waitForTimeout(100);
    d = await p.evaluate(() => window.Train._.state().S.draft.days[0].s[0]);
    t.ok('a draft slot can be swapped and given another set', d.e === 'db-bench' && d.n === 4, JSON.stringify(d));

    await p.click('[data-t="begin"]');
    await p.waitForTimeout(100);
    d = await p.evaluate(() => ({
      act: !!window.Train._.state().T.act,
      cells: document.querySelectorAll('.tr-gc').length,
      next: document.querySelector('.tr-gc.next') && document.querySelector('.tr-gc.next').dataset.w + ':' + document.querySelector('.tr-gc.next').dataset.d,
      stored: !!JSON.parse(localStorage.getItem('bsc.train')).act,
    }));
    t.ok('starting it keeps it', d.act && d.stored);
    t.ok('five weeks of four days on the grid, four hard and a deload', d.cells === 20, d.cells);
    t.ok('with the first session marked next', d.next === '0:0', d.next);

    // ---- every split, every kit -----------------------------------------
    const splits = await p.evaluate(() => {
      const out = {};
      [2, 3, 4, 5, 6].forEach((dpw) => ['gym', 'bar', 'db'].forEach((kit) => {
        const ms = window.Train._.build({ dpw, kit, lvl: 1, acc: 4, pri: [] });
        const lib = window.Train._.lib;
        const eq = { gym: ['bb', 'db', 'mc', 'cb', 'sm', 'bw'], bar: ['bb', 'db', 'bw'], db: ['db', 'bw'] }[kit];
        const all = ms.days.flatMap((x) => x.s);
        const per = {};
        ms.days.forEach((x, di) => x.s.forEach((s) => { const m = lib(s.e).m; (per[m] = per[m] || new Set()).add(di); }));
        out[dpw + kit] = {
          days: ms.days.length,
          kitOk: all.every((s) => eq.indexOf(lib(s.e).q) >= 0),
          big: ['chest', 'back', 'quads'].every((m) => per[m] && per[m].size >= (dpw >= 2 ? 1 : 0)),
          twice: ['chest', 'back', 'quads'].every((m) => per[m] && per[m].size >= 2),
        };
      }));
      return out;
    });
    t.ok('every split has as many days as asked for',
      Object.keys(splits).every((k) => splits[k].days === Number(k[0])), JSON.stringify(splits));
    t.ok('and draws only on the kit you have', Object.keys(splits).every((k) => splits[k].kitOk));
    t.ok('chest, back and quads are trained twice a week on every split',
      Object.keys(splits).every((k) => splits[k].twice),
      Object.keys(splits).filter((k) => !splits[k].twice).join());

    // ---- reps in reserve ------------------------------------------------
    const rir = await p.evaluate(() => {
      const ms = window.Train._.build({ dpw: 4, kit: 'gym', lvl: 1, acc: 4, pri: [] });
      return [0, 1, 2, 3, 4].map((w) => window.Train._.rirFor(ms, w));
    });
    t.ok('reps in reserve step 3, 2, 1, 0, then a deload', rir.join() === '3,2,1,0,', JSON.stringify(rir));

    // ---- the logger -----------------------------------------------------
    await p.click('[data-t="start"]');
    await p.waitForTimeout(100);
    t.ok('starting a session opens the logger', await p.isVisible('.tr-ex'));
    await p.fill('#trw-0-0', '135');
    await p.fill('#trr-0-0', '8');
    await p.click('[data-t="tick"][data-x="0"][data-s="0"]');
    await p.waitForTimeout(100);
    d = await p.evaluate(() => ({
      rest: document.querySelector('#trRest:not(.hide) .tr-rest-t') && document.querySelector('#trRest .tr-rest-t').textContent,
      ghost: document.getElementById('trw-0-1').placeholder,
    }));
    t.ok('ticking a set starts the rest timer', /Rest [0-9]:[0-9]{2}/.test(d.rest || ''), d.rest);
    t.ok('and the next set carries the weight just lifted', d.ghost === '135', d.ghost);
    await p.click('[data-t="tick"][data-x="0"][data-s="1"]');
    d = await p.evaluate(() => window.Train._.state().LIVE.x[0].s[1]);
    t.ok('an empty set ticked takes what its boxes were showing', d.w === 135 && d.r === 8 && d.t > 0, JSON.stringify(d));
    await p.click('[data-t="tick"][data-x="0"][data-s="1"]');
    d = await p.evaluate(() => window.Train._.state().LIVE.x[0].s[1].t);
    t.ok('and ticking it again undoes it', d === 0);

    await p.click('[data-t="rest"][data-v="15"]');
    d = await p.evaluate(() => { const r = window.Train._.state().LIVE.rs; return Math.round((r.end - Date.now()) / 1000); });
    t.ok('the rest can be stretched', d > 180 && d <= 196, d);
    await p.click('[data-t="rest"][data-v="skip"]');
    t.ok('or skipped', await p.evaluate(() => document.getElementById('trRest').classList.contains('hide')));

    // a set with nothing to take: a first-ever exercise, no target, no history
    await p.click('[data-t="addex"]');
    await p.click('#trainRoot [data-t="pickex"][data-e="hammer"]');
    await p.waitForTimeout(100);
    const hi = await p.evaluate(() => window.Train._.state().LIVE.x.length - 1);
    await p.click(`[data-t="tick"][data-x="${hi}"][data-s="0"]`);
    await p.waitForTimeout(100);
    d = await p.evaluate((hi) => ({
      t: window.Train._.state().LIVE.x[hi].s[0].t,
      focus: document.activeElement && document.activeElement.id,
    }), hi);
    t.ok('a set with nothing to go on is not ticked', d.t === 0);
    t.ok('and the box it needs gets the cursor', d.focus === 'trw-' + hi + '-0', d.focus);
    await p.fill(`#trw-${hi}-0`, '30');
    await p.fill(`#trr-${hi}-0`, '12');
    await p.press(`#trr-${hi}-0`, 'Enter');
    d = await p.evaluate((hi) => window.Train._.state().LIVE.x[hi].s[0], hi);
    t.ok('Enter in the reps box ticks the set', d.t > 0 && d.w === 30 && d.r === 12, JSON.stringify(d));

    // a phone that dies mid-session
    await p.reload();
    await p.waitForTimeout(200);
    d = await p.evaluate(() => ({ n: document.querySelectorAll('.tr-set.done').length, dot: document.querySelector('.tab[data-view="train"]').classList.contains('tr-tab-live') }));
    t.ok('a reload comes back to the same workout, sets and all', d.n === 2, d.n);
    t.ok('and the tab carries a dot while one is open', d.dot);

    // the back gesture
    await p.click('[data-t="exsheet"]');
    await p.waitForTimeout(100);
    t.ok('an exercise opens its own sheet', await p.isVisible('#trainRoot .sheet'));
    await p.goBack();
    await p.waitForTimeout(300);
    d = await p.evaluate(() => ({ sheet: !!document.querySelector('#trainRoot .sheet'), path: location.pathname }));
    t.ok('back closes it and stays in the app', !d.sheet && /index\.html$/.test(d.path), JSON.stringify(d));

    // finishing
    await p.click('[data-t="finish"]');
    await p.waitForTimeout(100);
    d = await p.evaluate(() => document.querySelector('#trainRoot .sheet').textContent);
    t.ok('finishing says which sets will not be saved', /never ticked/.test(d));
    t.ok('and asks for the feedback next week depends on', /next week/.test(d));
    await p.click('#trainRoot [data-t="save"]');
    await p.waitForTimeout(150);
    d = await p.evaluate(() => {
      const st = window.Train._.state();
      const w = Object.values(st.T.wo)[0];
      const k = new Date(); const p2 = (n) => (n < 10 ? '0' : '') + n;
      const today = k.getFullYear() + '-' + p2(k.getMonth() + 1) + '-' + p2(k.getDate());
      return {
        n: Object.keys(st.T.wo).length, live: !!st.LIVE,
        sets: w.x.reduce((n, x) => n + x.s.length, 0), slot: w.w + ':' + w.d,
        trained: (JSON.parse(localStorage.getItem('bsc.macroTrained') || '{}'))[today],
        saved: !!document.querySelector('.tr-saved'),
        next: document.querySelector('.tr-gc.next') && document.querySelector('.tr-gc.next').dataset.d,
      };
    });
    t.ok('saving keeps only the ticked sets', d.n === 1 && !d.live && d.sets === 2, JSON.stringify(d));
    t.ok('filed under its week and day', d.slot === '0:0');
    t.ok('My Day’s “trained today” is ticked for you', d.trained === 1, d.trained);
    t.ok('the block moves on to the next session', d.next === '1');
    t.ok('and says it saved', d.saved);
    await p.click('[data-t="sub"][data-v="history"]');
    t.ok('the workout is in History', await p.isVisible('.tr-hrow'));
    await p.close();

    // ---- the progression, with the arithmetic checked ---------------------
    p = await t.fresh();
    const prog = await p.evaluate(() => {
      const _ = window.Train._;
      const ms = _.build({ dpw: 4, kit: 'gym', lvl: 1, acc: 4, pri: [] });
      ms.id = 'blk';
      const lib = _.lib;
      const sum = (pl, m) => pl.x.filter((x) => lib(x.e).m === m).reduce((n, x) => n + x.sets, 0);
      const base = _.plan(ms, 0, 0);
      return { ms, chest0: sum(base, 'chest'), back0: sum(base, 'back'),
        ex: base.x.map((x) => x.e) };
    });
    const ms = prog.ms;
    const A = ms.days[0].s.map((s) => s.e);
    const bench = A[0], row = A[3];
    const T0 = { pr: { u: 'lb' }, act: 'blk', ms: { blk: ms }, cx: {}, wo: {
      a0: wo('a0', 'blk', 0, 0, 20, [{ e: bench, s: sets(185, [10, 10, 9]) }, { e: row, s: sets(135, [8, 8, 8]) }],
        { fb: { chest: { p: 0, k: 0 }, back: { p: 2, k: 2 } } }),
      b0: wo('b0', 'blk', 0, 1, 19, [{ e: 'bb-squat', s: sets(225, [8]) }]),
      c0: wo('c0', 'blk', 0, 2, 18, [{ e: 'bb-incline', s: sets(155, [8]) }], { sr: { chest: 0, back: 2 } }),
      d0: wo('d0', 'blk', 0, 3, 17, [{ e: 'leg-press', s: sets(300, [12]) }]),
    } };
    await seed(p, T0);
    let r = await p.evaluate(() => {
      const _ = window.Train._, st = _.state(), ms = st.T.ms.blk, lib = _.lib;
      const pl = _.plan(ms, 1, 0);
      const sum = (m) => pl.x.filter((x) => lib(x.e).m === m).reduce((n, x) => n + x.sets, 0);
      const benchT = pl.x[0], rowT = pl.x[3];
      return { chest: sum('chest'), back: sum('back'), bench: [benchT.tw, benchT.tr], row: [rowT.tw, rowT.tr],
        why: pl.x.map((x) => x.why), next: _.nextSlot(ms), rir: pl.rir };
    });
    t.ok('recovered early, low pump, easy: two more sets next week',
      r.chest === prog.chest0 + 2, prog.chest0 + ' -> ' + r.chest);
    t.ok('still sore, great pump, pushed hard: one fewer',
      r.back === prog.back0 - 1, prog.back0 + ' -> ' + r.back);
    t.ok('and the plan says why, in words', r.why.some((w) => /\+2 sets — recovered early, low pump, felt easy/.test(w)), r.why.join(' | '));
    t.ok('top of the range reached: five pounds more, two reps fewer',
      r.bench.join() === '190,8', r.bench.join());
    t.ok('short of it: same weight, one rep more', r.row.join() === '135,9', r.row.join());
    t.ok('week two asks for two in reserve', r.rir === 2, r.rir);
    t.ok('the next session is week two, day one', r.next && r.next.w === 1 && r.next.d === 0, JSON.stringify(r.next));

    // still sore: the sets hold, however good the pump and the workload were
    const Ts = JSON.parse(JSON.stringify(T0));
    Ts.wo.a0.fb = { chest: { p: 0, k: 0 } };
    Ts.wo.c0.sr = { chest: 2 };
    await seed(p, Ts);
    r = await p.evaluate(() => {
      const _ = window.Train._, ms = _.state().T.ms.blk, lib = _.lib;
      const pl = _.plan(ms, 1, 0);
      return { chest: pl.x.filter((x) => lib(x.e).m === 'chest').reduce((n, x) => n + x.sets, 0), why: pl.x[0].why };
    });
    t.ok('low pump and easy, but still sore going in: held, not added',
      r.chest === prog.chest0 && /^Held/.test(r.why), prog.chest0 + ' -> ' + r.chest + ' ' + r.why);

    // weaker than last week: the sets hold, however good it felt
    const T1 = JSON.parse(JSON.stringify(T0));
    T1.wo.a1 = wo('a1', 'blk', 1, 0, 13, [{ e: bench, s: sets(190, [6, 6, 5]) }], { fb: { chest: { p: 0, k: 0 } } });
    T1.wo.c1 = wo('c1', 'blk', 1, 2, 11, [{ e: 'bb-incline', s: sets(155, [8]) }], { sr: { chest: 0 } });
    await seed(p, T1);
    r = await p.evaluate(() => {
      const _ = window.Train._, ms = _.state().T.ms.blk, lib = _.lib;
      const sum = (pl) => pl.x.filter((x) => lib(x.e).m === 'chest').reduce((n, x) => n + x.sets, 0);
      const p1 = _.plan(ms, 1, 0), p2 = _.plan(ms, 2, 0);
      return { w1: sum(p1), w2: sum(p2), why: p2.x[0].why };
    });
    t.ok('measurably weaker than the week before: the sets hold', r.w2 === r.w1, r.w1 + ' -> ' + r.w2);
    t.ok('and it says that is why', /weaker than the week before/.test(r.why), r.why);

    // the ceiling
    r = await p.evaluate(() => {
      const _ = window.Train._;
      const st = _.state();
      const ms = { id: 'cap', acc: 4, days: [
        { n: 'A', s: [{ e: 'bb-bench', n: 5 }, { e: 'cb-fly', n: 5 }] },
        { n: 'B', s: [{ e: 'db-incline', n: 5 }, { e: 'pec-deck', n: 6 }] }] };
      const now = Date.now();
      st.T.ms.cap = ms;
      st.T.wo.x0 = { id: 'x0', st: now - 10 * 864e5, u: 'lb', ms: 'cap', w: 0, d: 0, x: [{ e: 'bb-bench', s: [{ w: 100, r: 8 }] }], fb: { chest: { p: 0, k: 0 } }, sr: {} };
      st.T.wo.x1 = { id: 'x1', st: now - 9 * 864e5, u: 'lb', ms: 'cap', w: 0, d: 1, x: [{ e: 'db-incline', s: [{ w: 50, r: 8 }] }], fb: {}, sr: { chest: 0 } };
      localStorage.setItem('bsc.train', JSON.stringify(st.T));
      _.reload();
      const sf = _.setsFor(_.state().T.ms.cap, 1);
      return { a: sf.sets[0], why: sf.why[0][0] };
    });
    t.ok('never past RP’s MRV: 21 sets of chest plus two becomes 22', r.a[0] + r.a[1] === 11, JSON.stringify(r.a));
    t.ok('and it says it was capped', /Capped at 22/.test(r.why), r.why);

    // the deload
    await seed(p, T0);
    r = await p.evaluate(() => {
      const _ = window.Train._, ms = _.state().T.ms.blk;
      const d = _.plan(ms, 4, 0), w0 = _.plan(ms, 0, 0);
      return { dl: d.deload, rir: d.rir, half: d.x.every((x, i) => x.sets === Math.max(1, Math.ceil(ms.days[0].s[i].n / 2))),
        bench: d.x[0].tw, w0: w0.x.map((x) => x.sets) };
    });
    t.ok('the deload is half of week one’s sets, with no reps-in-reserve target', r.dl && r.rir === null && r.half, JSON.stringify(r));
    t.ok('at week one’s weights', r.bench === 185, r.bench);

    // ---- records ---------------------------------------------------------
    r = await p.evaluate(() => {
      const _ = window.Train._, T = _.state().T;
      const list = Object.values(T.wo).sort((a, b) => a.st - b.st);
      return list.map((w) => _.prsIn(w).map((x) => x.e + ':' + x.what).join());
    });
    t.ok('the first time you do a lift is not a record', r.every((x) => x === ''), JSON.stringify(r));
    await seed(p, Object.assign({}, T0, { wo: Object.assign({}, T0.wo, {
      z9: wo('z9', '', -1, -1, 1, [{ e: bench, s: sets(195, [8]) }]),
    }) }));
    r = await p.evaluate(() => window.Train._.prsIn(window.Train._.state().T.wo.z9));
    t.ok('a heavier set is, and says which record', r.length === 1 && /heaviest/.test(r[0].what) && /best e1RM/.test(r[0].what), JSON.stringify(r));
    r = await p.evaluate(() => window.Train._.prsIn({ id: 'open', st: Date.now(), u: 'lb',
      x: [{ e: 'pullup', s: [{ w: 0, r: 12 }] }, { e: 'hammer', s: [{ w: 30, r: 12 }] }] }));
    t.ok('nor is it in a workout still open — bodyweight lifts included', r.length === 0, JSON.stringify(r));
    r = await p.evaluate(() => [window.Train._.e1rm(100, 10), window.Train._.e1rm(100, 1)]);
    t.ok('e1RM is Epley’s: 100 × 10 is 133', Math.round(r[0]) === 133 && r[1] === 100, JSON.stringify(r));

    // ---- plates ----------------------------------------------------------
    r = await p.evaluate(() => [
      window.Train._.plateMath(225, 45, 'lb').plates.join('+'),
      window.Train._.plateMath(135, 45, 'lb').plates.join('+'),
      window.Train._.plateMath(100, 20, 'kg').plates.join('+'),
      window.Train._.plateMath(137, 45, 'lb').left,
    ]);
    t.ok('plates: 225 is two 45s a side, 135 is one', r[0] === '45+45' && r[1] === '45', JSON.stringify(r));
    t.ok('in kilograms too, and a remainder is said rather than hidden', r[2] === '25+15' && r[3] === 1, JSON.stringify(r));

    // ---- the review --------------------------------------------------------
    r = await p.evaluate(() => {
      const _ = window.Train._;
      const st = _.state();
      const now = Date.now();
      const W = (id, ago, x) => ({ id, st: now - ago * 864e5, u: 'lb', ms: '', w: -1, d: -1, x, fb: {}, sr: {} });
      const t0 = now - 2 * 864e5;
      // a week and more of log: two chest days, one back day with 40-second
      // rests, and a set of three
      st.T.wo = {
        old: W('old', 12, [{ e: 'bb-bench', s: [{ w: 100, r: 8, t: now - 12 * 864e5 }] }]),
        r1: W('r1', 5, [{ e: 'bb-bench', s: [8, 8, 8, 8, 8, 8].map((r, i) => ({ w: 185, r, t: t0 - 5 * 864e5 + i * 200e3 })) }]),
        r2: W('r2', 2, [
          { e: 'bb-bench', s: [8, 8, 8, 8, 8, 8].map((r, i) => ({ w: 185, r, t: t0 + i * 200e3 })) },
          { e: 'bb-row', s: [3, 10, 10, 10, 10, 10, 10].map((r, i) => ({ w: 135, r, t: t0 + 3e6 + i * 80e3 })) }]),
      };
      st.T.act = '';
      localStorage.setItem('bsc.train', JSON.stringify(st.T));
      _.reload();
      const rv = _.review(now);
      const by = {};
      rv.checks.forEach((c) => { by[c.t] = c; });
      return { rows: rv.rows.map((x) => x.k + ':' + x.sets + ':' + x.days),
        vol: by['Weekly sets per muscle'], freq: by['How often each muscle is trained'],
        reps: by['Reps per set'], rest: by['Rest between sets'], fail: by['How close to failure'] };
    });
    t.ok('the review counts sets and days per muscle over the last week', r.rows.join() === 'chest:12:2,back:7:1', r.rows.join());
    t.ok('volume: chest is in the 10–20 band', r.vol.st === 'look' || r.vol.st === 'good');
    t.ok('frequency: back got all its sets on one day, and it says so', r.freq.st === 'look' && /Back/.test(r.freq.b), r.freq.b);
    t.ok('reps: one set of three in nineteen is not a problem', r.reps.st === 'good', r.reps.b);
    t.ok('rest: forty seconds on the rows is flagged, and named, even beside long rests on the bench',
      r.rest.st === 'look' && /Under a minute between sets on Barbell Row/.test(r.rest.b) && !/Bench/.test(r.rest.b), r.rest.b);
    t.ok('effort is not graded, and it says why', r.fail.st === 'info' && /cannot see/.test(r.fail.b));
    t.ok('every graded line cites a source', [r.vol, r.freq, r.reps, r.rest].every((c) => c.refs.length));

    r = await p.evaluate(() => {
      const _ = window.Train._;
      const st = _.state();
      st.T.wo = { a: { id: 'a', st: Date.now() - 864e5, u: 'lb', ms: '', w: -1, d: -1, x: [{ e: 'bb-bench', s: [{ w: 100, r: 8, t: 1 }] }], fb: {}, sr: {} } };
      localStorage.setItem('bsc.train', JSON.stringify(st.T));
      _.reload();
      return _.review().checks[0];
    });
    t.ok('a log younger than a week is not graded as a week', r.st === 'info' && /not a whole week/.test(r.b), r.b);

    /* In a block, the block's week — whole, whatever day it is read on — and
       not a rolling seven days that cuts it in two. */
    await seed(p, T0);
    r = await p.evaluate(() => {
      const _ = window.Train._;
      const rv = _.review();
      return { label: rv.label, n: rv.n, st: rv.checks[0].st };
    });
    t.ok('in a block, the review reads the block’s last whole week, even when it is weeks old',
      r.label === 'Week 1 of your block' && r.n === 4 && r.st !== 'info', JSON.stringify(r));
    await seed(p, Object.assign({}, T0, { wo: Object.assign({}, T0.wo, {
      a1: wo('a1', 'blk', 1, 0, 1, [{ e: bench, s: sets(190, [8, 8, 8]) }]),
      x1: wo('x1', '', -1, -1, 18.5, [{ e: 'db-curl', s: sets(30, [12, 12]) }]),
    }) }));
    r = await p.evaluate(() => {
      const rv = window.Train._.review();
      return { label: rv.label, n: rv.n, biceps: (rv.rows.find((x) => x.k === 'biceps') || {}).sets };
    });
    t.ok('a week in progress does not replace the last whole one', r.label === 'Week 1 of your block', r.label);
    t.ok('and a workout outside the block, done that week, is counted in it', r.n === 5 && r.biceps === 2, JSON.stringify(r));
    r = await p.evaluate(() => (window.Train._.review().checks.find((c) => /going up/.test(c.t)) || {}).b || '');
    t.ok('and it says a rise inside a block is partly effort, not all new strength', /reps in reserve coming down/.test(r), r);
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="sub"][data-v="review"]');
    await p.waitForTimeout(100);
    await p.click('.tr-ref >> nth=0');
    await p.waitForTimeout(100);
    d = await p.evaluate(() => ({ open: document.getElementById('trRefs').open, hash: location.hash }));
    t.ok('a citation opens the source list without leaving the page', d.open && !d.hash, JSON.stringify(d));
    await p.close();

    // ---- sync ----------------------------------------------------------------
    p = await t.fresh();
    r = await p.evaluate(async () => {
      const _ = window.Train._;
      const good = { id: 'k1', st: 1000, u: 'lb', x: [{ e: 'bb-bench', s: [{ w: 100, r: 5 }] }] };
      const better = Object.assign({}, good, { n: 'newer' });
      const out = {};
      out.first = _.merge({ wo: { k1: { v: good, at: 100 } } });
      out.older = _.merge({ wo: { k1: { v: better, at: 50 } } });
      out.keptOld = _.state().T.wo.k1.n === undefined;
      out.newer = _.merge({ wo: { k1: { v: better, at: 200 } } }) && _.state().T.wo.k1.n === 'newer';
      out.bad = _.merge({ wo: { k2: { v: { st: 'soon' }, at: 300 } } });
      out.gone = _.merge({ wo: { k1: { v: null, at: 400 } } }) && !_.state().T.wo.k1;
      out.tomb = JSON.stringify(_.payload(true).wo.k1);
      // a device that has not heard the server yet does not push
      const calls = [];
      const doc = { set: (b) => { calls.push(JSON.parse(JSON.stringify(b))); return Promise.resolve(); } };
      window.Train.attach(doc);
      window.Train.remote({ pr: { v: { u: 'kg' }, at: 1 } }, false);
      await new Promise((r) => setTimeout(r, 50));
      out.quietFromCache = calls.length === 0;
      window.Train.remote(null, true);
      await new Promise((r) => setTimeout(r, 50));
      out.wholeOnceHeard = calls.length === 1 && !!calls[0].train.pr && !!calls[0].train.wo.k1;
      out.unit = _.state().T.pr.u;
      return out;
    });
    t.ok('a remote workout is taken when there is none', r.first);
    t.ok('an older copy is ignored', !r.older && r.keptOld);
    t.ok('a newer copy wins', r.newer);
    t.ok('a wrong-shaped one is refused', !r.bad);
    t.ok('a deletion arrives as a stamped null, and travels as one', r.gone && r.tomb === '{"v":null,"at":400}', r.tomb);
    t.ok('nothing is pushed on a cached answer', r.quietFromCache);
    t.ok('the first push waits for the server, then says everything', r.wholeOnceHeard);
    t.ok('settings travel too', r.unit === 'kg', r.unit);

    /* The same, with a real change made on the screen while the server has
       not answered yet: it waits, and then goes out inside the whole push. */
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="settings"]');
    await p.evaluate(() => {
      window.__calls = [];
      window.Train.attach({ set: (b) => { window.__calls.push(JSON.parse(JSON.stringify(b))); return Promise.resolve(); } });
    });
    await p.click('#trainRoot [data-t="s-rc"][data-v="120"]');
    await p.waitForTimeout(1100);
    r = await p.evaluate(() => window.__calls.length);
    t.ok('a change made before the server has answered is held back', r === 0, r);
    await p.evaluate(() => window.Train.remote(null, true));
    await p.waitForTimeout(50);
    r = await p.evaluate(() => window.__calls.map((c) => c.train.pr && c.train.pr.v.rc));
    t.ok('and goes out with everything once it has', r.length === 1 && r[0] === 120, JSON.stringify(r));
    await p.click('#trainRoot [data-t="s-ri"][data-v="60"]');
    await p.waitForTimeout(1100);
    r = await p.evaluate(() => window.__calls.map((c) => Object.keys(c.train).join('+')));
    t.ok('after that, a change sends only itself', r.length === 2 && r[1] === 'pr', JSON.stringify(r));

    await p.evaluate(() => window.Train.forget());
    r = await p.evaluate(() => ({ t: localStorage.getItem('bsc.train'), n: Object.keys(window.Train._.state().T.wo).length }));
    t.ok('forgetting clears it from the device', r.t === null && r.n === 0, JSON.stringify(r));
    await p.close();

    // ---- a narrow phone ------------------------------------------------------
    p = await t.fresh({ viewport: { width: 360, height: 740 } });
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="build"]');
    await p.click('[data-t="begin"]');
    await p.click('[data-t="start"]');
    await p.waitForTimeout(100);
    r = await p.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      rows: [...document.querySelectorAll('.tr-set')].every((e) => e.scrollWidth <= e.clientWidth + 1),
    }));
    t.ok('the logger fits a 360px phone without sideways scroll', r.overflow <= 0 && r.rows, JSON.stringify(r));
    await p.close();
  },
};
