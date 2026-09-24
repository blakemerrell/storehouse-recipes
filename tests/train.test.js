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

/* Answer the quiz the way a thumb would. `a` names the answers; anything
   left out is skipped past with Next, or left unpressed. */
async function answer(p, a) {
  await p.click(`[data-t="qz"][data-f="goal"][data-v="${a.goal || 'muscle'}"]`);
  await p.click(`[data-t="qz"][data-f="lvl"][data-v="${a.lvl === undefined ? 1 : a.lvl}"]`);
  if (a.dpw) await p.click(`[data-t="qz"][data-f="dpw"][data-v="${a.dpw}"]`);
  if (a.min !== undefined) await p.click(`[data-t="qz"][data-f="min"][data-v="${a.min}"]`);
  await p.click('[data-t="qzn"]');
  await p.click(`[data-t="qz"][data-f="kit"][data-v="${a.kit || 'gym'}"]`);
  if (a.bk) await p.click('[data-t="qzback"]');
  for (const b of (a.bk || '')) await p.click(`[data-t="qzm"][data-f="bk"][data-v="${b}"]`);
  for (const j of (a.jt || '')) await p.click(`[data-t="qzm"][data-f="jt"][data-v="${j}"]`);
  await p.click('[data-t="qzn"]');
  if (a.day) await p.click(`[data-t="qz"][data-f="day"][data-v="${a.day}"]`);
  for (const h of (a.hab || [])) await p.click(`[data-t="qzm"][data-f="hab"][data-v="${h}"]`);
  await p.click('[data-t="qzn"]');
  await p.click(`[data-t="qz"][data-f="age"][data-v="${a.age || ''}"]`);
  await p.waitForTimeout(100);
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
    let r0;
    const tabs = await p.evaluate(() =>
      [...document.querySelectorAll('.tab')].map((b) => b.dataset.view));
    t.ok('there is a Train tab, beside My Day', tabs.indexOf('train') === tabs.indexOf('macros') + 1, tabs.join());
    await p.click('.tab[data-view="train"]');
    await p.waitForTimeout(100);
    t.ok('it opens on the quiz, with nothing answered for you',
      await p.isVisible('[data-t="qz"][data-f="goal"]') &&
      await p.evaluate(() => !document.querySelector('[data-t="qz"][aria-pressed="true"]')));
    await p.reload();
    await p.waitForTimeout(200);
    t.ok('and is the tab you come back to', await p.isVisible('#view-train [data-t="qz"][data-f="goal"]'));

    // ---- the quiz, the picks, and building a block ----------------------
    await answer(p, { goal: 'muscle', lvl: 1, dpw: 4, min: 0 });
    r0 = await p.evaluate(() => ({
      pr: window.Train._.state().T.pr,
      picks: [...document.querySelectorAll('.tr-prog [data-t="prog"]')].map((b) => b.dataset.v),
      why: [...document.querySelectorAll('.tr-prog')][0].querySelectorAll('.tr-fits li').length,
    }));
    t.ok('the answers are kept as yours', r0.pr.goal === 'muscle' && r0.pr.lvl === 1 && r0.pr.dpw === 4 && r0.pr.qz > 0, JSON.stringify(r0.pr));
    t.ok('three picks, the RP-style block first for somebody building muscle a few years in',
      r0.picks.length === 3 && r0.picks[0] === 'grow', r0.picks.join());
    t.ok('and each pick says why it fits', r0.why >= 1, r0.why);
    await p.click('[data-t="lib"]');
    r0 = await p.evaluate(() => document.querySelectorAll('.tr-prog').length);
    t.ok('the library shows every program', r0 === 9, r0);
    await p.click('[data-t="unlib"]');
    await p.click('[data-t="prog"][data-v="grow"]');
    await p.click('[data-t="o-pri"][data-v="side"]');
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
    d = await p.evaluate(() => ({ rest: !!document.querySelector('#trRest .tr-rest-t'), finish: !!document.querySelector('#trRest:not(.hide) [data-t="finish"]') }));
    t.ok('or skipped, leaving the workout’s own bar with Finish', !d.rest && d.finish, JSON.stringify(d));

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
    await p.click('.tr-done [data-t="close"]');
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
    await p.click('[data-t="qzskip"]');
    await p.click('.tr-prog [data-t="prog"] >> nth=0');
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

    // ---- your back, your minutes, your goal ------------------------------------
    /* Somebody whose disc has been through squats and deadlifts, who bends
       forward badly, has forty minutes and wants to keep what they have. */
    p = await t.fresh();
    r = await p.evaluate(() => {
      const _ = window.Train._;
      const kits = ['gym', 'bar', 'db'];
      const bad = [];
      kits.forEach((kit) => {
        [2, 3].forEach((dpw) => {
          const ms = _.build({ goal: 'keep', dpw, kit, min: 40, bk: 'f', acc: 8 });
          ms.days.forEach((d) => d.s.forEach((s) => { if (/F/.test(_.lib(s.e).bk)) bad.push('keep ' + kit + dpw + ' ' + s.e); }));
        });
        [2, 3, 4, 5, 6].forEach((dpw) => {
          const ms = _.build({ goal: 'grow', dpw, kit, min: 0, bk: 'f', acc: 4, lvl: 1, pri: [] });
          ms.days.forEach((d) => d.s.forEach((s) => { if (/F/.test(_.lib(s.e).bk)) bad.push('grow ' + kit + dpw + ' ' + s.e); }));
        });
      });
      const plain = _.build({ goal: 'grow', dpw: 4, kit: 'gym', min: 0, bk: '', acc: 4, lvl: 1, pri: [] });
      return { bad, plainHasSquat: plain.days.some((d) => d.s.some((s) => s.e === 'bb-squat')) };
    });
    t.ok('protecting a back from bending leaves loaded bending out of every split, every kit, either goal',
      r.bad.length === 0, r.bad.join(', '));
    t.ok('and it is the protection doing it: without it the back squat is still there', r.plainHasSquat);

    r = await p.evaluate(() => {
      const _ = window.Train._;
      const ms = _.build({ goal: 'keep', dpw: 2, kit: 'gym', min: 40, bk: 'f', acc: 8, avoid: ['hack'] });
      const A = ms.days[0];
      return {
        pairs: A.s.map((s) => s.p || 0).join(''),
        sets: ms.days.every((d) => d.s.every((s) => s.n === 3)),
        mins: ms.days.map((d) => _.estDay(d)),
        weeks: _.weeksOf(ms), rir: [0, 3, 7].map((w) => _.rirFor(ms, w)),
        hack: ms.days.some((d) => d.s.some((s) => s.e === 'hack')),
        core: ms.days.map((d) => d.s.filter((s) => _.lib(s.e).m === 'abs').map((s) => s.e)).flat(),
      };
    });
    t.ok('keeping strength: three pairs a session', r.pairs === '112233', r.pairs);
    t.ok('three sets of everything', r.sets);
    t.ok('and each session fits in forty minutes', r.mins.every((m) => m <= 40), r.mins.join());
    t.ok('eight working weeks, no deload, about two in reserve throughout',
      r.weeks === 8 && r.rir.join() === '2,2,2', r.weeks + ' ' + r.rir.join());
    t.ok('an exercise on the never list is never chosen', !r.hack);
    t.ok('the core work resists movement rather than bending', r.core.every((e) => ['pallof', 'dead-bug', 'bird-dog'].indexOf(e) >= 0), r.core.join());

    // the keeping progression: steady, a set off for too much, one back for a slide
    r = await p.evaluate(() => {
      const _ = window.Train._;
      const st = _.state();
      const ms = _.build({ goal: 'keep', dpw: 2, kit: 'gym', min: 40, bk: 'f', acc: 8 });
      ms.id = 'kp';
      const now = Date.now(), D = 864e5;
      const A = ms.days[0].s.map((s) => s.e);
      const W = (id, w, ago, sq, fb) => ({ id, st: now - ago * D, u: 'lb', ms: 'kp', w, d: 0,
        x: [{ e: A[0], s: [{ w: sq[0], r: sq[1] }] }], fb: fb || {}, sr: {} });
      st.T.ms = { kp: ms }; st.T.act = 'kp';
      st.T.wo = {
        a0: W('a0', 0, 30, [300, 10]),
        a1: W('a1', 1, 23, [300, 10], { chest: { k: 3 } }),
        a2: W('a2', 2, 16, [300, 8]),
        a3: W('a3', 3, 9, [300, 6]),
      };
      localStorage.setItem('bsc.train', JSON.stringify(st.T));
      _.reload();
      const m = _.state().T.ms.kp;
      const sets = (w, mus) => _.plan(m, w, 0).x.filter((x) => _.lib(x.e).m === mus).reduce((n, x) => n + x.sets, 0);
      const pl1 = _.plan(m, 1, 0), pl2 = _.plan(m, 2, 0), pl4 = _.plan(m, 4, 0);
      return {
        chest: [sets(1, 'chest'), sets(2, 'chest'), sets(3, 'chest')],
        quads: [sets(1, 'quads'), sets(3, 'quads'), sets(4, 'quads')],
        why1: pl1.x.map((x) => x.why).filter(Boolean),
        why2: pl2.x.find((x) => _.lib(x.e).m === 'chest').why,
        why4: pl4.x.find((x) => _.lib(x.e).m === 'quads').why,
      };
    });
    t.ok('keeping holds the sets steady with nothing to explain', r.chest[0] === 3 && r.why1.length === 0, JSON.stringify(r));
    t.ok('a week that was too much takes a set off the next', r.chest[1] === 2 && /too much/.test(r.why2), r.chest.join() + ' ' + r.why2);
    t.ok('strength sliding two weeks running puts one back', r.quads[2] === r.quads[1] + 1 && /slipped two weeks running/.test(r.why4),
      r.quads.join() + ' ' + r.why4);

    // growing inside forty minutes: fitted at the start, and held there
    r = await p.evaluate(() => {
      const _ = window.Train._;
      const out = {};
      [2, 3, 4, 5, 6].forEach((dpw) => {
        const ms = _.build({ goal: 'grow', dpw, kit: 'gym', min: 40, bk: '', acc: 4, lvl: 1, pri: [] });
        out[dpw] = ms.days.map((d) => _.estDay(d));
      });
      const st = _.state();
      const ms = _.build({ goal: 'grow', dpw: 4, kit: 'gym', min: 40, bk: '', acc: 4, lvl: 1, pri: [] });
      ms.id = 'gt';
      const fb = {}; ms.days[0].s.forEach((s) => { fb[_.lib(s.e).m] = { p: 0, k: 0 }; });
      st.T.ms = { gt: ms }; st.T.act = 'gt';
      st.T.wo = { g0: { id: 'g0', st: Date.now() - 5 * 864e5, u: 'lb', ms: 'gt', w: 0, d: 0,
        x: [{ e: ms.days[0].s[0].e, s: [{ w: 100, r: 8 }] }], fb, sr: {} } };
      localStorage.setItem('bsc.train', JSON.stringify(st.T));
      _.reload();
      const m = _.state().T.ms.gt;
      const p1 = _.plan(m, 1, 0);
      out.after = _.estDay(m.days[0], p1.x.map((x) => x.sets));
      out.why = p1.x.map((x) => x.why).join(' | ');
      return out;
    });
    t.ok('growing inside forty minutes: every day of every split is built to fit',
      [2, 3, 4, 5, 6].every((k) => r[k].every((m) => m <= 40)), JSON.stringify(r));
    t.ok('and the weekly climb stops at the minutes, and says so',
      r.after <= 40 && /Held to fit your 40-minute session/.test(r.why), r.after + ' ' + r.why);

    // ---- the builder, a session, and a round of golf, on the screen -----------
    await p.click('.tab[data-view="train"]');
    await p.evaluate(() => { localStorage.removeItem('bsc.train'); window.Train._.reload(); window.Train._.state().S.qz = null; });
    await p.click('[data-t="sub"][data-v="history"]');
    await p.click('[data-t="sub"][data-v="block"]');
    await answer(p, { goal: 'keep', lvl: 2, dpw: 2, min: 40, bk: 'f', hab: ['golfw'] });
    r = await p.evaluate(() => [...document.querySelectorAll('.tr-prog [data-t="prog"]')].map((b) => b.dataset.v));
    t.ok('keeping strength, two days, forty minutes: the maintenance block comes first', r[0] === 'keep', r.join());
    await p.click('[data-t="prog"][data-v="keep"]');
    await p.click('[data-t="build"]');
    await p.waitForTimeout(100);
    r = await p.evaluate(() => ({
      pr: window.Train._.state().T.pr,
      mins: [...document.querySelectorAll('.tr-mins')].map((e) => e.textContent),
      labels: [...document.querySelectorAll('.tr-dday')][0].querySelectorAll('.tr-pair').length,
    }));
    t.ok('what you tell the builder is kept as yours', r.pr.goal === 'keep' && r.pr.min === 40 && r.pr.bk === 'f' &&
      r.pr.hab.join() === 'golfw', JSON.stringify(r.pr));
    t.ok('and the draft says how long each day takes, and which lifts are paired',
      r.mins.length === 2 && r.mins.every((m) => /about \d+ min/.test(m)) && r.labels === 6, JSON.stringify(r));

    // swap with never-again: gone from the whole draft, and on the list
    await p.click('[data-t="dswap"][data-d="1"][data-i="0"]');
    await p.waitForTimeout(100);
    r = await p.evaluate(() => [...document.querySelectorAll('#trainRoot .tr-pick')]
      .filter((b) => /Romanian Deadlift/.test(b.textContent)).map((b) => b.querySelector('.tr-pk-w') && b.querySelector('.tr-pk-w').textContent));
    await p.click('#trainRoot [data-t="pickm"][data-v="hams"]');
    r = await p.evaluate(() => [...document.querySelectorAll('#trainRoot .tr-pick[data-e="bb-rdl"], #trainRoot .tr-pick[data-e="db-rdl"]')]
      .map((b) => (b.querySelector('.tr-pk-w') || {}).textContent));
    t.ok('the picker still offers what your back rules out, and says why', r[0] === 'loads your back', JSON.stringify(r));
    await p.click('#trainRoot [data-t="pickm"][data-v=""]');
    const was = await p.evaluate(() => window.Train._.state().S.draft.days[1].s[0].e);
    await p.click('#trainRoot [data-t="never"]');
    await p.click('#trainRoot [data-t="pickex"][data-e="mc-thrust"]');
    await p.waitForTimeout(100);
    r = await p.evaluate((was) => ({
      avoid: window.Train._.state().T.pr.avoid,
      left: window.Train._.state().S.draft.days.some((d) => d.s.some((s) => s.e === was)),
    }), was);
    t.ok('never again takes it out of the whole block and onto your never list',
      r.avoid.indexOf(was) >= 0 && !r.left, JSON.stringify(r) + ' ' + was);

    await p.click('[data-t="begin"]');
    await p.click('[data-t="start"]');
    await p.waitForTimeout(100);
    r = await p.evaluate(() => ({
      pairs: [...document.querySelectorAll('.tr-ex .tr-pair')].map((e) => e.textContent).join(','),
      bk: !!document.querySelector('[data-t="bk"]'),
      pump: !!document.querySelector('[data-t="fb"][data-f="p"]'),
    }));
    t.ok('the session shows its pairs as A1, A2, B1…', r.pairs === 'A1,A2,B1,B2,C1,C2', r.pairs);
    t.ok('and asks how your back is before you start', r.bk);
    await p.click('[data-t="bk"][data-v="2"]');
    t.ok('a sore back gets told to skip the leg work, and what nerve symptoms mean',
      /Skip the lower-body lifts today/.test(await p.evaluate(() => document.querySelector('.tr-warn').textContent)));
    await p.fill('#trw-0-0', '200');
    await p.fill('#trr-0-0', '8');
    await p.click('[data-t="tick"][data-x="0"][data-s="0"]');
    r = await p.evaluate(() => Math.round((window.Train._.state().LIVE.rs.end - Date.now()) / 1000));
    t.ok('a paired set rests a minute, not three: the other half goes next', r > 55 && r <= 60, r);
    for (let j = 1; j < 3; j++) await p.click(`[data-t="tick"][data-x="0"][data-s="${j}"]`);
    r = await p.evaluate(() => ({ pump: !!document.querySelector('[data-t="fb"][data-f="p"]'),
      work: !!document.querySelector('[data-t="fb"][data-f="k"]'),
      label: [...document.querySelectorAll('.tr-fbm')].map((e) => e.textContent).join('|') }));
    t.ok('keeping asks about workload and back, not pump', !r.pump && r.work && /Back &/.test(r.label), JSON.stringify(r));
    await p.click('[data-t="finish"]');
    await p.click('#trainRoot [data-t="save"]');
    await p.waitForTimeout(150);
    await p.click('.tr-done [data-t="close"]');
    r = await p.evaluate(() => Object.values(window.Train._.state().T.wo)[0].bk);
    t.ok('the back check is saved with the workout', r === 2, r);

    await p.click('[data-t="axnew"][data-v="golfw"]');
    await p.click('#trainRoot [data-t="axmin"][data-v="240"]');
    await p.click('#trainRoot [data-t="axsave"]');
    await p.waitForTimeout(100);
    r = await p.evaluate(() => ({ ax: Object.values(window.Train._.state().T.ax),
      strip: document.querySelector('.tr-actv-n').textContent }));
    t.ok('a round of golf is one tap and a length', r.ax.length === 1 && r.ax[0].k === 'golfw' && r.ax[0].min === 240, JSON.stringify(r.ax));
    t.ok('and the block shows the week’s minutes outside the gym', /4 h/.test(r.strip), r.strip);
    await p.click('[data-t="sub"][data-v="history"]');
    t.ok('it is in History beside the workouts', await p.isVisible('.tr-hax'));
    await p.click('[data-t="sub"][data-v="review"]');
    await p.waitForTimeout(100);
    r = await p.evaluate(() => {
      const rv = window.Train._.review();
      const by = {}; rv.checks.forEach((c) => { by[c.t] = c; });
      return { cardio: by['Active minutes outside the gym'], back: by['Your back'], keep: rv.keep,
        eyebrowBand: document.querySelector('.tr-vkey').textContent };
    });
    t.ok('the review counts golf toward the week’s cardio', r.cardio && /4 h/.test(r.cardio.b) && /150/.test(r.cardio.b), r.cardio && r.cardio.b);
    t.ok('and reads the back check-ins', r.back && r.back.st === 'look' && /Sore going into 1 session/.test(r.back.b), r.back && r.back.b);
    t.ok('and grades keeping by the keeping research', r.keep && /enough to keep strength/.test(r.eyebrowBand), r.eyebrowBand);

    // activity syncs like everything else
    r = await p.evaluate(() => {
      const _ = window.Train._;
      return {
        ok: _.merge({ ax: { z1: { v: { id: 'z1', st: Date.now(), k: 'walk', min: 30 }, at: Date.now() } } }),
        bad: _.merge({ ax: { z2: { v: { id: 'z2', st: Date.now(), k: 'skydiving', min: 30 }, at: Date.now() } } }),
        huge: _.merge({ ax: { z3: { v: { id: 'z3', st: Date.now(), k: 'walk', min: 99999 }, at: Date.now() } } }),
      };
    });
    t.ok('a walk from the other phone is taken; nonsense is not', r.ok && !r.bad && !r.huge, JSON.stringify(r));

    // the profile survives a reload, and bad values are cleaned
    r = await p.evaluate(() => {
      const T = JSON.parse(localStorage.getItem('bsc.train'));
      T.pr = Object.assign(T.pr, { min: 17, bk: 'fz<', hab: ['golfw', 'hang-gliding'], goal: 'x' });
      localStorage.setItem('bsc.train', JSON.stringify(T));
      window.Train._.reload();
      return window.Train._.state().T.pr;
    });
    t.ok('a mangled profile is cleaned rather than trusted',
      r.min === 0 && r.bk === 'f' && r.hab.join() === 'golfw' && r.goal === 'muscle', JSON.stringify(r));
    await p.close();

    // ---- everybody: the picks ----------------------------------------------------
    /* Round three: not one lifter but anybody — new or years in, a gym or a
       floor, building or keeping or losing, with a bad knee or a sore
       shoulder, a desk or a building site, soccer on Sundays. */
    p = await t.fresh();
    r = await p.evaluate(() => {
      const _ = window.Train._;
      const top = (o) => _.recommend(_.defaultsPr(Object.assign({ qz: 1 }, o)))[0].id;
      const all = _.recommend(_.defaultsPr({ goal: 'muscle', lvl: 0, kit: 'bw', dpw: 2, min: 30 }));
      return {
        novice: top({ goal: 'muscle', lvl: 0, kit: 'gym', dpw: 3 }),
        keep: top({ goal: 'keep', lvl: 2, kit: 'gym', dpw: 2, min: 40 }),
        lean: top({ goal: 'lean', lvl: 1, kit: 'gym', dpw: 4 }),
        home: top({ goal: 'muscle', lvl: 1, kit: 'bw', dpw: 3 }),
        health: top({ goal: 'health', lvl: 0, kit: 'db', dpw: 2 }),
        grow: top({ goal: 'muscle', lvl: 2, kit: 'gym', dpw: 5 }),
        reasons: all.every((x) => x.why.length >= 1),
        against: all.some((x) => x.why.some((w) => w.bad)),
      };
    });
    t.ok('somebody new to lifting is pointed at the beginner program first', r.novice === 'start', r.novice);
    t.ok('keeping strength on two days points at the maintenance block', r.keep === 'keep', r.keep);
    t.ok('losing fat points at the fat-loss block', r.lean === 'lean', r.lean);
    t.ok('no weights points at home and bodyweight', r.home === 'home', r.home);
    t.ok('feeling better, new, with dumbbells: the beginner program', r.health === 'start', r.health);
    t.ok('years in, five days, building muscle: the RP-style block', r.grow === 'grow', r.grow);
    t.ok('every program gives its reasons, including the ones against it', r.reasons && r.against);

    // ---- every program, every kit ---------------------------------------------------
    r = await p.evaluate(() => {
      const _ = window.Train._;
      const bad = [];
      Object.keys(_.PROGS).forEach((id) => {
        const P = _.PROGS[id];
        (P.kits || Object.keys(_.KITS)).forEach((kit) => {
          P.dpw.forEach((dpw) => [0, 1, 2].forEach((lvl) => {
            const ms = _.build({ prog: id, fx: 'arms', dpw, kit, lvl, acc: P.dAcc, min: 0 });
            const eq = _.KITS[kit].eq;
            const tag = id + ' ' + kit + ' ' + dpw + 'd L' + lvl;
            if (ms.days.length !== dpw) bad.push(tag + ': ' + ms.days.length + ' days');
            ms.days.forEach((d) => {
              // a bodyweight gym split and an emphasis block's held days run thin, on purpose; never empty
              if (d.s.length < (kit === 'bw' || id === 'focus' ? 2 : 3)) bad.push(tag + ' ' + d.n + ': ' + d.s.length + ' exercises');
              if (new Set(d.s.map((s) => s.e)).size !== d.s.length) bad.push(tag + ' ' + d.n + ': repeats');
              d.s.forEach((s) => {
                if (eq.indexOf(_.lib(s.e).q) < 0) bad.push(tag + ' ' + s.e + ': not in the kit');
                if (!(s.n >= 1 && s.n <= 6)) bad.push(tag + ' ' + s.e + ': ' + s.n + ' sets');
              });
            });
          }));
        });
      });
      return bad;
    });
    t.ok('every program builds on every kit, day count and level it offers: the right days, only the kit you have, sensible sets',
      r.length === 0, r.slice(0, 8).join('; '));

    r = await p.evaluate(() => {
      const _ = window.Train._;
      const homey = ['pushup-flat', 'inc-pushup', 'pushup', 'archer', 'pullup-neg', 'inv-row', 'bw-squat', 'split-squat', 'bw-bss',
        'sl-rdl', 'glute-bridge', 'sl-bridge', 'pike-pushup', 'diamond', 'calf-bw'];
      const bad = [], hurt = [];
      ['grow', 'focus', 'lean', 'keep', 'start'].forEach((id) => ['gym', 'bar'].forEach((kit) => _.PROGS[id].dpw.forEach((dpw) => {
        _.build({ prog: id, fx: 'chest', dpw, kit, lvl: 1 }).days.forEach((d) => d.s.forEach((s) => {
          if (homey.indexOf(s.e) >= 0) bad.push(id + ' ' + kit + dpw + ' ' + s.e);
        }));
      })));
      Object.keys(_.PROGS).forEach((id) => (_.PROGS[id].kits || Object.keys(_.KITS)).forEach((kit) => _.PROGS[id].dpw.forEach((dpw) => {
        _.build({ prog: id, fx: 'shoulders', dpw, kit, lvl: 1, jt: 'SKW', bk: 'fcx' }).days.forEach((d) => d.s.forEach((s) => {
          const ex = _.lib(s.e);
          if (/[SKW]/.test(ex.jt) || /[FCX]/.test(ex.bk)) hurt.push(id + ' ' + kit + dpw + ' ' + s.e);
        }));
      })));
      return { bad, hurt };
    });
    t.ok('with weights to load, nobody is handed the bodyweight version of a lift', r.bad.length === 0, r.bad.slice(0, 6).join(', '));
    t.ok('a protected shoulder, knee, wrist and back keep what loads them hard out of every program on every kit',
      r.hurt.length === 0, r.hurt.slice(0, 6).join(', '));

    // starting out: steady, three in reserve easing to two, no deload
    r = await p.evaluate(() => {
      const _ = window.Train._, st = _.state();
      const ms = _.build({ prog: 'start', dpw: 3, kit: 'gym', lvl: 0, acc: 6 });
      ms.id = 'sb';
      const fb = {}; ms.days[0].s.forEach((s) => { fb[_.lib(s.e).m] = { p: 0, k: 0 }; });
      st.T.ms = { sb: ms }; st.T.act = 'sb';
      st.T.wo = { s0: { id: 's0', st: Date.now() - 5 * 864e5, u: 'lb', ms: 'sb', w: 0, d: 0,
        x: [{ e: ms.days[0].s[0].e, s: [{ w: 100, r: 8 }] }], fb, sr: {} } };
      localStorage.setItem('bsc.train', JSON.stringify(st.T));
      _.reload();
      const m = _.state().T.ms.sb;
      return {
        goal: m.goal, weeks: _.weeksOf(m), rir: [0, 1, 2, 3, 4, 5].map((w) => _.rirFor(m, w)).join(),
        two: m.days.every((d) => d.s.every((s) => s.n === 2)),
        held: _.plan(m, 1, 0).x.every((x, i) => x.sets === m.days[0].s[i].n),
        rv: _.review().checks.map((c) => c.t),
      };
    });
    t.ok('starting out: six working weeks, no deload, three in reserve easing to two',
      r.goal === 'base' && r.weeks === 6 && r.rir === '3,3,3,2,2,2', JSON.stringify(r));
    t.ok('two sets of everything on three days, and an easy week does not pile more on', r.two && r.held, JSON.stringify(r));
    t.ok('and the review grades it by what a beginner needs', r.rv.indexOf('Enough to grow on?') >= 0, r.rv.join(' | '));

    // bringing up one part
    r = await p.evaluate(() => {
      const _ = window.Train._, st = _.state();
      const ms = _.build({ prog: 'focus', fx: 'chest', dpw: 4, kit: 'gym', lvl: 1, acc: 4 });
      ms.id = 'fc';
      const sum = (m) => ms.days.reduce((n, d) => n + d.s.filter((s) => _.lib(s.e).m === m).reduce((a, s) => a + s.n, 0), 0);
      const first = ms.days.filter((d) => d.s.some((s) => _.lib(s.e).m === 'chest')).every((d) => _.lib(d.s[0].e).m === 'chest');
      const out = { first, chest: sum('chest'), quads: sum('quads'), fx: ms.fx.join(), name: ms.n };
      const fb = {}; ms.days[0].s.forEach((s) => { fb[_.lib(s.e).m] = { p: 0, k: 0 }; });
      st.T.ms = { fc: ms }; st.T.act = 'fc';
      st.T.wo = { f0: { id: 'f0', st: Date.now() - 5 * 864e5, u: 'lb', ms: 'fc', w: 0, d: 0,
        x: [{ e: ms.days[0].s[0].e, s: [{ w: 100, r: 8 }] }], fb, sr: {} } };
      localStorage.setItem('bsc.train', JSON.stringify(st.T));
      _.reload();
      const m = _.state().T.ms.fc;
      const day = (w, mus) => _.plan(m, w, 0).x.filter((x) => _.lib(x.e).m === mus).reduce((n, x) => n + x.sets, 0);
      out.chestUp = day(1, 'chest') - day(0, 'chest');
      out.backUp = day(1, 'back') - day(0, 'back');
      return out;
    });
    t.ok('a chest focus puts chest first on every day that trains it', r.first, JSON.stringify(r));
    t.ok('starts it at least four over MEV, and holds the rest near maintenance', r.chest >= 12 && r.quads <= 5, JSON.stringify(r));
    t.ok('and a good week climbs the focus while the rest holds', r.chestUp === 2 && r.backUp === 0, JSON.stringify(r));

    // losing fat
    r = await p.evaluate(() => {
      const _ = window.Train._, st = _.state();
      const ms = _.build({ prog: 'lean', dpw: 4, kit: 'gym', lvl: 1, acc: 4 });
      ms.id = 'ln';
      const fb = {}; ms.days[0].s.forEach((s) => { fb[_.lib(s.e).m] = { p: 0, k: 0 }; });
      st.T.ms = { ln: ms }; st.T.act = 'ln';
      st.T.wo = { l0: { id: 'l0', st: Date.now() - 5 * 864e5, u: 'lb', ms: 'ln', w: 0, d: 0,
        x: [{ e: ms.days[0].s[0].e, s: [{ w: 100, r: 8 }] }], fb, sr: {} } };
      localStorage.setItem('bsc.train', JSON.stringify(st.T));
      _.reload();
      const m = _.state().T.ms.ln;
      const day = (w) => _.plan(m, w, 0).x.filter((x) => _.lib(x.e).m === 'chest');
      return { up: day(1).reduce((n, x) => n + x.sets, 0) - day(0).reduce((n, x) => n + x.sets, 0),
        why: day(1)[0].why, rir: [0, 1, 2, 3].map((w) => _.rirFor(m, w)).join() };
    });
    t.ok('eating less: a plainly good week still adds only one set, and says why', r.up === 1 && /One set at a time/.test(r.why), JSON.stringify(r));
    t.ok('and sets stop a rep short of failure', r.rir === '3,2,1,1', r.rir);

    // bodyweight: the ladder
    r = await p.evaluate(() => {
      const _ = window.Train._, st = _.state();
      const ms = _.build({ prog: 'home', dpw: 3, kit: 'bw', lvl: 0, acc: 4 });
      ms.id = 'hm';
      const d0 = ms.days[0].s.map((s) => s.e);
      st.T.ms = { hm: ms }; st.T.act = 'hm';
      st.T.wo = { h0: { id: 'h0', st: Date.now() - 5 * 864e5, u: 'lb', ms: 'hm', w: 0, d: 0,
        x: [{ e: 'inc-pushup', s: [{ w: 0, r: 20 }, { w: 0, r: 20 }, { w: 0, r: 20 }] }], fb: {}, sr: {} } };
      localStorage.setItem('bsc.train', JSON.stringify(st.T));
      _.reload();
      const m = _.state().T.ms.hm;
      const x1 = _.plan(m, 1, 0).x.find((x) => x.up === 'inc-pushup');
      const xd = _.plan(m, 4, 0).x.map((x) => x.e);
      return { d0, x1: x1 && x1.e, deload: xd.indexOf('inc-pushup') >= 0, notes: m.nt.join(' ') };
    });
    t.ok('new to it, at home: push-ups start on the incline and pull-ups on the negative',
      r.d0.indexOf('inc-pushup') >= 0 && r.d0.indexOf('pullup-neg') >= 0 && /easier version/.test(r.notes), JSON.stringify(r));
    t.ok('top the rep range on every set and the next session moves up a rung', r.x1 === 'pushup-flat', JSON.stringify(r));
    t.ok('but not in a deload week', r.deload, JSON.stringify(r));

    // your life shapes it
    r = await p.evaluate(() => {
      const _ = window.Train._;
      const sum = (ms, list) => ms.days.reduce((n, d) => n + d.s.filter((s) => list.indexOf(_.lib(s.e).m) >= 0).reduce((a, s) => a + s.n, 0), 0);
      const base = _.build({ prog: 'grow', dpw: 4, kit: 'gym', lvl: 1 });
      const soccer = _.build({ prog: 'grow', dpw: 4, kit: 'gym', lvl: 1, hab: ['soccer'] });
      const job = _.build({ prog: 'grow', dpw: 4, kit: 'gym', lvl: 1, day: 'labor' });
      const old = _.build({ prog: 'keep', dpw: 3, kit: 'gym', age: '60' });
      const young = _.build({ prog: 'keep', dpw: 3, kit: 'gym', age: 'u40' });
      return {
        legs: [sum(base, ['quads', 'hams', 'calves']), sum(soccer, ['quads', 'hams', 'calves'])],
        back: [sum(base, ['back']), sum(job, ['back'])],
        said: /soccer already works your legs/.test(soccer.nt.join()) && /physical job/.test(job.nt.join()),
        old: old.days.every((d) => d.s.every((s) => s.n === 3)), young: young.days.every((d) => d.s.every((s) => s.n === 2)),
      };
    });
    t.ok('soccer on the side starts leg volume lower', r.legs[1] < r.legs[0], JSON.stringify(r.legs));
    t.ok('a physical job starts back volume lower too', r.back[1] < r.back[0], JSON.stringify(r.back));
    t.ok('and the draft says so, in words', r.said);
    t.ok('past sixty, keeping uses three sets where under forty uses two', r.old && r.young);

    // anything outside the gym
    r = await p.evaluate(() => {
      const _ = window.Train._, st = _.state();
      const now = Date.now(), D = 864e5;
      st.T.ax = {
        a: { id: 'a', st: now - D, k: 'soccer', min: 60 },
        b: { id: 'b', st: now - D, k: 'yoga', min: 60 },
        c: { id: 'c', st: now - D, k: 'other', min: 30, lv: 'm', nm: 'Surfing' },
        d: { id: 'd', st: now - D, k: 'walk', min: 30, lv: 'v' },
      };
      localStorage.setItem('bsc.train', JSON.stringify(st.T));
      _.reload();
      const wk = _.axWeek(now);
      return {
        wk,
        long: _.merge({ ax: { z4: { v: { id: 'z4', st: now, k: 'other', min: 30, nm: 'x'.repeat(41) }, at: now } } }),
        lv: _.merge({ ax: { z5: { v: { id: 'z5', st: now, k: 'walk', min: 30, lv: 'extreme' }, at: now } } }),
      };
    });
    t.ok('a vigorous minute counts twice, a light one not at all, and your own mark beats the default',
      r.wk.min === 180 && r.wk.mv === 210 && r.wk.light === 60, JSON.stringify(r.wk));
    t.ok('something else can be called what it is', r.wk.by.surfing === 30, JSON.stringify(r.wk.by));
    t.ok('an over-long name or a made-up effort from another device is refused', !r.long && !r.lv);
    await p.close();

    // ---- the quiz again, from Settings --------------------------------------------
    p = await t.fresh();
    await p.click('.tab[data-view="train"]');
    await answer(p, { goal: 'lean', lvl: 1, dpw: 3, min: 45, kit: 'db', jt: 'K', day: 'desk', hab: ['walk', 'hike'], age: '40' });
    r = await p.evaluate(() => ({ pr: window.Train._.state().T.pr,
      first: document.querySelector('.tr-prog [data-t="prog"]').dataset.v,
      line: document.querySelector('.tr-card .tr-sub').textContent }));
    t.ok('a knee, a desk and some hiking are all kept', r.pr.jt === 'K' && r.pr.day === 'desk' && r.pr.hab.join() === 'walk,hike' &&
      r.pr.kit === 'db' && r.pr.age === '40', JSON.stringify(r.pr));
    t.ok('and read back in a line above the picks', /looking after knee/.test(r.line) && /hiking/.test(r.line), r.line);
    await p.click('[data-t="settings"]');
    r = await p.evaluate(() => document.querySelector('#trainRoot').textContent);
    t.ok('Settings shows your answers and a way to change them', /About you/.test(r) && /Change my answers/.test(r));
    await p.click('#trainRoot [data-t="requiz"]');
    await p.waitForTimeout(100);
    r = await p.evaluate(() => (document.querySelector('[data-t="qz"][aria-pressed="true"]') || {}).dataset);
    t.ok('changing them starts from what you said before', r && r.v === 'lean', JSON.stringify(r));
    for (const step of ['one', 'one', 'next', 'one', 'next', 'next']) {
      await p.click(step === 'next' ? '[data-t="qzn"]' : '[data-t="qz"][aria-pressed="true"]');
    }
    r = await p.evaluate(() => document.querySelector('.tr-quiz').textContent);
    t.ok('the last question explains why it never asks whether you are a man or a woman', /does not ask whether you are a man or a woman/.test(r), r.slice(0, 120));
    await p.click('[data-t="qzx"]');
    r = await p.evaluate(() => !!document.querySelector('.tr-prog'));
    t.ok('and Cancel goes back to the picks without changing anything', r);
    await p.click('[data-t="prog"][data-v="home"]');
    r = await p.evaluate(() => [...document.querySelectorAll('[data-t="o-kit"]')].map((b) => b.dataset.v).join());
    t.ok('home and bodyweight only offers home kit', r === 'bw,db', r);
    await p.click('[data-t="build"]');
    r = await p.evaluate(() => document.querySelector('.tr-card').textContent);
    t.ok('and a home block says what an exercise needs', /Needs a pull-up bar/.test(r) || /Needs /.test(r), r.slice(0, 200));
    await p.click('[data-t="begin"]');
    await p.click('[data-t="browse"]');
    r = await p.evaluate(() => ({ picks: !!document.querySelector('.tr-prog'), back: !!document.querySelector('[data-t="unbrowse"]') }));
    t.ok('with a block running, the other programs are a tap away, and so is the way back', r.picks && r.back, JSON.stringify(r));
    await p.click('[data-t="unbrowse"]');
    t.ok('back to the block', await p.isVisible('[data-t="start"]'));
    await p.close();

    // ---- strength: waves and powerbuilding ------------------------------------------
    p = await t.fresh();
    r = await p.evaluate(() => {
      const _ = window.Train._;
      const top = (o) => _.recommend(_.defaultsPr(Object.assign({ qz: 1 }, o)))[0].id;
      const plain = _.build({ prog: 'waves', dpw: 4, kit: 'gym', lvl: 1 });
      const back = _.build({ prog: 'waves', dpw: 4, kit: 'gym', lvl: 1, bk: 'f' });
      return {
        strength: top({ goal: 'strength', lvl: 1, kit: 'gym', dpw: 4 }),
        both: top({ goal: 'both', lvl: 2, kit: 'gym', dpw: 4 }),
        noBar: top({ goal: 'strength', lvl: 1, kit: 'bw', dpw: 4 }),
        mains: plain.days.map((d) => d.s[0].m + ':' + d.s[0].e).join(),
        backMains: back.days.map((d) => d.s[0].e).join(),
        name: plain.n, weeks: _.weeksOf(plain),
      };
    });
    t.ok('getting stronger with a barbell points at strength waves; both at powerbuilding', r.strength === 'waves' && r.both === 'power', r.strength + ' ' + r.both);
    t.ok('and never at a barbell program without a barbell', r.noBar !== 'waves' && r.noBar !== 'power', r.noBar);
    t.ok('four days: a squat, bench, deadlift and press day, each led by its lift',
      r.mains === 'squat:bb-squat,bench:bb-bench,dead:bb-dl,press:bb-ohp' && r.weeks === 4, r.mains + ' ' + r.weeks);
    t.ok('a back that hates bending gets a squat and a hip-hinge that spare it', !/bb-squat|bb-dl|bb-rdl/.test(r.backMains) && /hip-thrust/.test(r.backMains), r.backMains);

    r = await p.evaluate(() => {
      const _ = window.Train._, st = _.state();
      const ms = _.build({ prog: 'waves', dpw: 4, kit: 'gym', lvl: 1, wave: 10, tm: { 'bb-squat': 300, 'bb-bench': 200 } });
      ms.id = 'wv';
      st.T.ms = { wv: ms }; st.T.act = 'wv'; st.T.wo = {};
      localStorage.setItem('bsc.train', JSON.stringify(st.T));
      _.reload();
      const m = _.state().T.ms.wv;
      const sq = (w) => _.plan(m, w, 0).x[0].st;
      const out = { w1: sq(0), w2: sq(1), w3: sq(2), dl: sq(3), acc: _.plan(m, 0, 0).x[1] };
      // a realization week logged: squat 13 against 10, bench 8 against 10
      const now = Date.now(), D = 864e5;
      st.T.wo = {
        r0: { id: 'r0', st: now - 3 * D, u: 'lb', ms: 'wv', w: 2, d: 0, x: [{ e: 'bb-squat', s: [
          { w: 185, r: 5, wu: 1 }, { w: 215, r: 3, wu: 1 }, { w: 225, r: 13, am: 1, tr: 10 }] }], fb: {}, sr: {} },
        r1: { id: 'r1', st: now - 2 * D, u: 'lb', ms: 'wv', w: 2, d: 1, x: [{ e: 'bb-bench', s: [{ w: 150, r: 8, am: 1, tr: 10 }] }], fb: {}, sr: {} },
      };
      localStorage.setItem('bsc.train', JSON.stringify(st.T));
      _.reload();
      out.next = _.nextTm(_.state().T.ms.wv);
      out.rv = (_.review().checks.find((c) => c.t === 'Your all-out sets') || {}).b || '';
      out.hard = (_.review().rows.find((x) => x.k === 'quads') || {}).sets;
      return out;
    });
    t.ok('tens, week one: five sets of ten at sixty per cent of the training max',
      r.w1.length === 5 && r.w1.every((s) => s.tr === 10 && s.tw === 180 && !s.am), JSON.stringify(r.w1));
    t.ok('week two: three heavier sets', r.w2.length === 3 && r.w2.every((s) => s.tw === 205 && s.tr === 10), JSON.stringify(r.w2));
    t.ok('week three: two ramp sets, then one set for as many reps as you can',
      r.w3.length === 3 && r.w3[0].wu && r.w3[1].wu && r.w3[2].am && r.w3[2].tw === 225 && r.w3[2].tr === 10, JSON.stringify(r.w3));
    t.ok('then a deload of three light sets', r.dl.length === 3 && r.dl[2].tw === 180, JSON.stringify(r.dl));
    t.ok('the accessories stay steady at three sets', r.acc.sets === 3, JSON.stringify(r.acc));
    t.ok('three reps past the target move the squat max up three steps; two short take the bench down two',
      r.next['bb-squat'] === 315 && r.next['bb-bench'] === 195, JSON.stringify(r.next));
    t.ok('the review reads the all-out sets back against their targets', /Back Squat: 13 against 10 \(\+3\)/.test(r.rv) && /Barbell Bench Press: 8 against 10/.test(r.rv), r.rv);
    t.ok('and ramp sets are not counted as hard sets', r.hard === 1, r.hard);

    r = await p.evaluate(() => {
      const _ = window.Train._, st = _.state();
      const ms = _.build({ prog: 'power', dpw: 4, kit: 'gym', lvl: 1 });
      ms.id = 'pw';
      const fb = {}; ms.days[0].s.forEach((s) => { fb[_.lib(s.e).m] = { p: 0, k: 0 }; });
      st.T.ms = { pw: ms }; st.T.act = 'pw';
      st.T.wo = { p0: { id: 'p0', st: Date.now() - 5 * 864e5, u: 'lb', ms: 'pw', w: 0, d: 0,
        x: [{ e: ms.days[0].s[0].e, s: [{ w: 275, r: 6 }, { w: 235, r: 8 }, { w: 235, r: 8 }, { w: 235, r: 8 }] }], fb, sr: {} } };
      localStorage.setItem('bsc.train', JSON.stringify(st.T));
      _.reload();
      const m = _.state().T.ms.pw;
      const p1 = _.plan(m, 1, 0);
      const acc = (w) => _.plan(m, w, 0).x.slice(1).reduce((n, x) => n + x.sets, 0);
      return { main: m.days.every((d) => !!d.s[0].m), st: p1.x[0].st, accUp: acc(1) - acc(0), mainSets: p1.x[0].sets };
    });
    t.ok('powerbuilding opens every day with a main lift', r.main);
    t.ok('six reps on the top set: next week it goes up a step, back to four, with three back-offs at 85%',
      r.st[0].tw === 280 && r.st[0].tr === 4 && r.st.slice(1).every((s) => s.tw === 240 && s.tr === 8) && r.mainSets === 4, JSON.stringify(r.st));
    t.ok('and a good week climbs the accessories, not the main lift', r.accUp > 0, r.accUp);

    // on the screen: a realization session, saved with its ramp and all-out sets
    await p.evaluate(() => {
      const _ = window.Train._, st = _.state();
      const ms = _.build({ prog: 'waves', dpw: 4, kit: 'gym', lvl: 1, wave: 10, tm: { 'bb-squat': 300 } });
      ms.id = 'wv2'; ms.sk = ['0:0', '0:1', '0:2', '0:3', '1:0', '1:1', '1:2', '1:3'];
      st.T.ms = { wv2: ms }; st.T.act = 'wv2'; st.T.wo = {}; st.T.pr.qz = Date.now();
      localStorage.setItem('bsc.train', JSON.stringify(st.T));
      _.reload();
    });
    await p.click('.tab[data-view="train"]');
    r = await p.evaluate(() => document.querySelector('.tr-card .tr-sub').textContent);
    t.ok('the block says which wave and which week it is', /10s wave, realization/.test(r), r);
    await p.click('[data-t="start"]');
    r = await p.evaluate(() => [...[...document.querySelectorAll('.tr-ex')][0].querySelectorAll('.tr-set:not(.tr-set-h) .tr-sn')].map((e) => e.textContent).join(','));
    t.ok('ramp sets are lettered W, as warm-ups, and the all-out set is marked', r === 'W,W,1+', r);
    for (let j = 0; j < 3; j++) {
      if (j === 2) await p.fill('#trr-0-2', '12');
      await p.click(`[data-t="tick"][data-x="0"][data-s="${j}"]`);
    }
    r = await p.evaluate(() => window.Train._.state().LIVE.x[0].s.map((s) => s.w || '').join());
    await p.click('[data-t="finish"]');
    await p.click('#trainRoot [data-t="save"]');
    await p.waitForTimeout(150);
    r = await p.evaluate(() => Object.values(window.Train._.state().T.wo)[0].x[0].s);
    t.ok('each set took its own weight, and the save keeps which were ramps and which was all-out',
      r.map((s) => s.w).join() === '165,195,225' && r[0].wu && r[1].wu && r[2].am && r[2].tr === 10 && r[2].r === 12, JSON.stringify(r));
    await p.close();

    // ---- conditioning: circuits ------------------------------------------------------
    p = await t.fresh();
    r = await p.evaluate(() => {
      const _ = window.Train._;
      const top = (o) => _.recommend(_.defaultsPr(Object.assign({ qz: 1 }, o)))[0].id;
      const bad = [], hurt = [], kinds = [], long = [];
      Object.keys(_.KITS).forEach((kit) => [2, 3, 4, 5].forEach((dpw) => {
        const eq = _.KITS[kit].eq;
        const ms = _.build({ prog: 'cond', dpw, kit, lvl: 1, min: 40 });
        ms.days.forEach((d, i) => {
          if (!d.mc || d.mc.mv.length < 2) bad.push(kit + dpw + ' ' + d.n + ': no circuit');
          else d.mc.mv.forEach((m) => { if (eq.indexOf(_.MOVES[m.id].q) < 0) bad.push(kit + ' ' + m.id); });
          if (dpw === 3) kinds.push(d.mc.k);
          if (_.estDay(d) > 40) long.push(kit + dpw + ' ' + d.n + ' ' + _.estDay(d));
        });
        _.build({ prog: 'cond', dpw, kit, lvl: 1, jt: 'KAW', bk: 'f' }).days.forEach((d) => d.mc.mv.forEach((m) => {
          const mv = _.MOVES[m.id];
          if (/[KAW]/.test(mv.jt || '') || /F/.test(mv.bk || '')) hurt.push(kit + ' ' + m.id);
        }));
      }));
      return {
        bad, hurt, long, kinds: kinds.slice(0, 3).join(),
        sitter: top({ goal: 'health', lvl: 1, kit: 'gym', dpw: 3, day: 'desk' }),
        runner: top({ goal: 'health', lvl: 1, kit: 'gym', dpw: 3, hab: ['run', 'soccer'] }),
      };
    });
    t.ok('every day of a conditioning block ends in a circuit, from movements the kit allows', r.bad.length === 0, r.bad.slice(0, 5).join('; '));
    t.ok('the format turns over through the week: AMRAP, EMOM, rounds for time', r.kinds === 'amrap,emom,rft', r.kinds);
    t.ok('a session with its circuit still fits forty minutes', r.long.length === 0, r.long.join('; '));
    t.ok('protected knees, feet, wrists and back lose the movements that load them hard', r.hurt.length === 0, r.hurt.slice(0, 5).join(', '));
    t.ok('feeling better from a desk, with no hard cardio: the conditioning block comes first', r.sitter === 'cond', r.sitter);
    t.ok('but not for somebody who already runs and plays soccer', r.runner !== 'cond', r.runner);

    // the score to beat, and the minutes that count
    r = await p.evaluate(() => {
      const _ = window.Train._, st = _.state();
      const ms = _.build({ prog: 'cond', dpw: 3, kit: 'gym', lvl: 1, min: 40 });
      ms.id = 'cd';
      const now = Date.now(), D = 864e5;
      const c = ms.days[0].mc;
      const W = (id, ago, r, x) => ({ id, st: now - ago * D, u: 'lb', ms: 'cd', w: ago > 7 ? 0 : 1, d: 0, n: 'Day A',
        x: [{ e: ms.days[0].s[0].e, s: [{ w: 100, r: 8 }] }], fb: {}, sr: {}, mc: Object.assign({}, c, { r, x }) });
      st.T.ms = { cd: ms }; st.T.act = 'cd'; st.T.ax = {};
      st.T.wo = { c0: W('c0', 9, 6, 10), c1: W('c1', 2, 7, 3) };
      localStorage.setItem('bsc.train', JSON.stringify(st.T));
      _.reload();
      const rv = _.review();
      const by = {}; rv.checks.forEach((k) => { by[k.t] = k.b; });
      return { k: c.k, circuits: by['Your circuits'], active: by['Active minutes, circuits included'],
        last: _.plan(_.state().T.ms.cd, 2, 0).mc.last };
    });
    t.ok('this week’s circuit is read against last week’s', r.k === 'amrap' && /7 rounds \+ 3, up from 6 rounds \+ 10/.test(r.circuits || ''), r.circuits);
    t.ok('and next week’s plan carries the score to beat', r.last && r.last.r === 7, JSON.stringify(r.last));
    t.ok('circuit minutes count as vigorous activity', /circuits in your workouts 10 min/.test(r.active || '') && /worth 20 moderate minutes/.test(r.active || ''), r.active);

    // on the screen: the clock, the score, the save
    await p.evaluate(() => {
      const _ = window.Train._, st = _.state();
      const ms = _.build({ prog: 'cond', dpw: 3, kit: 'gym', lvl: 1, min: 40 });
      ms.id = 'cd2';
      st.T.ms = { cd2: ms }; st.T.act = 'cd2'; st.T.wo = {}; st.T.pr.qz = Date.now();
      localStorage.setItem('bsc.train', JSON.stringify(st.T));
      _.reload();
    });
    await p.click('.tab[data-view="train"]');
    r = await p.evaluate(() => (document.querySelector('.tr-next .tr-mcp') || {}).textContent || '');
    t.ok('the next session shows its circuit', /AMRAP 10 min/.test(r), r);
    await p.click('[data-t="start"]');
    await p.click('[data-t="mcgo"]');
    await p.evaluate(() => { const L = window.Train._.state().LIVE; L.mc.st -= 11 * 60000; });
    await p.waitForTimeout(1300);
    r = await p.evaluate(() => ({ en: !!window.Train._.state().LIVE.mc.en, clock: document.getElementById('trMcClock').textContent }));
    t.ok('an AMRAP stops itself at the time', r.en && r.clock === '0:00', JSON.stringify(r));
    await p.fill('[data-mc="r"]', '5');
    await p.fill('[data-mc="x"]', '7');
    await p.click('[data-t="finish"]');
    r = await p.evaluate(() => document.querySelector('#trainRoot').textContent);
    t.ok('finishing says the circuit’s score', /Circuit: 5 rounds \+ 7/.test(r), r.slice(0, 160));
    await p.click('#trainRoot [data-t="save"]');
    await p.waitForTimeout(150);
    r = await p.evaluate(() => Object.values(window.Train._.state().T.wo)[0]);
    t.ok('a workout that was only a circuit is still saved, with its score', r && r.mc && r.mc.r === 5 && r.mc.x === 7 && r.x.length === 0, JSON.stringify(r && r.mc));
    await p.close();

    // ---- the tab row: the household's, a rule, and yours --------------------------
    p = await t.fresh({ viewport: { width: 360, height: 740 } });
    r = await p.evaluate(() => {
      const t = document.querySelector('.tabs'), box = t.getBoundingClientRect();
      const tabs = [...t.querySelectorAll('.tab')];
      const sep = t.querySelector('.tab-sep');
      return {
        labels: tabs.map((b) => b.innerText.trim()).join('|'),
        off: tabs.filter((b) => b.getBoundingClientRect().right > box.right + 1).length,
        sepBefore: !!sep && sep.nextElementSibling === t.querySelector('.tab[data-view="macros"]'),
        noBookTab: !t.querySelector('.tab[data-view="book"]'),
      };
    });
    t.ok('the tabs are Recipes, Plan, List, Pantry, then Nourish and Strengthen', r.labels === 'Recipes|Plan|List|Pantry|Nourish|Strengthen', r.labels);
    t.ok('with a rule before yours, and every one on a 360px screen', r.sepBefore && r.off === 0, JSON.stringify(r));
    t.ok('and the book is no longer a tab', r.noBookTab);
    await p.click('#bookBtn');
    await p.waitForTimeout(300);
    r = await p.evaluate(() => ({ book: !document.getElementById('view-book').classList.contains('hide'),
      lit: document.querySelector('.tab[aria-selected="true"]').dataset.view }));
    t.ok('it opens from Recipes, and Recipes stays lit while it is up', r.book && r.lit === 'browse', JSON.stringify(r));
    await p.close();

    // ---- feedback: tidy, and out of the way once answered or passed ---------------
    p = await t.fresh();
    await p.evaluate(() => {
      const _ = window.Train._, st = _.state();
      const ms = _.build({ prog: 'grow', dpw: 4, kit: 'gym', lvl: 1, acc: 4 });
      ms.id = 'fbk';
      st.T.ms = { fbk: ms }; st.T.act = 'fbk'; st.T.wo = {}; st.T.pr.qz = Date.now();
      localStorage.setItem('bsc.train', JSON.stringify(st.T));
      _.reload();
    });
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="start"]');
    const tickAll = async (xi) => {
      const n = await p.evaluate((xi) => window.Train._.state().LIVE.x[xi].s.length, xi);
      for (let j = 0; j < n; j++) {
        await p.fill(`#trw-${xi}-${j}`, '100'); await p.fill(`#trr-${xi}-${j}`, '10');
        await p.click(`[data-t="tick"][data-x="${xi}"][data-s="${j}"]`);
      }
    };
    // the first exercise whose muscle appears only once today
    const solo = await p.evaluate(() => {
      const L = window.Train._.state().LIVE, lib = window.Train._.lib;
      return L.x.findIndex((x) => L.x.filter((y) => lib(y.e).m === lib(x.e).m).length === 1);
    });
    const m = await p.evaluate((i) => window.Train._.lib(window.Train._.state().LIVE.x[i].e).m, solo);
    await tickAll(solo);
    r = await p.evaluate((m) => ({
      open: !!document.querySelector(`.tr-fbc [data-t="fb"][data-m="${m}"]`),
      even: [...document.querySelectorAll(`.tr-fbc .tr-sqb[data-m="${m}"][data-f="k"]`)].map((b) => Math.round(b.getBoundingClientRect().width)),
    }), m);
    t.ok('the feedback card asks with rows of equal buttons', r.open && r.even.length === 4 && new Set(r.even).size === 1, JSON.stringify(r));
    await p.click(`[data-t="fb"][data-m="${m}"][data-f="p"][data-v="1"]`);
    await p.click(`[data-t="fb"][data-m="${m}"][data-f="k"][data-v="1"]`);
    await p.click(`[data-t="fb"][data-m="${m}"][data-f="j"][data-v="0"]`);
    r = await p.evaluate((m) => ({ card: !!document.querySelector(`.tr-fbc [data-m="${m}"]`),
      line: (document.querySelector(`.tr-fbt[data-m="${m}"]`) || {}).textContent || '' }), m);
    t.ok('answered, it tucks into a line saying what you said', !r.card && /moderate pump/.test(r.line) && /workload about right/.test(r.line), r.line);
    await p.click(`.tr-fbt[data-m="${m}"]`);
    r = await p.evaluate((m) => !!document.querySelector(`.tr-fbc [data-m="${m}"]`), m);
    t.ok('and a tap opens it again', r);
    await p.click(`[data-t="fb"][data-m="${m}"][data-f="k"][data-v="2"]`);
    r = await p.evaluate((m) => ({ tucked: !!document.querySelector(`.tr-fbt[data-m="${m}"]`), k: window.Train._.state().LIVE.fb[m].k }), m);
    t.ok('changing an answer puts it away again', r.tucked && r.k === 2, JSON.stringify(r));
    // an unanswered card tucks once you move on
    const other = await p.evaluate((m) => {
      const L = window.Train._.state().LIVE, lib = window.Train._.lib;
      const a = L.x.findIndex((x) => lib(x.e).m !== m && L.x.filter((y) => lib(y.e).m === lib(x.e).m).length === 1);
      return a;
    }, m);
    const m2 = await p.evaluate((i) => window.Train._.lib(window.Train._.state().LIVE.x[i].e).m, other);
    await tickAll(other);
    r = await p.evaluate((m2) => !!document.querySelector(`.tr-fbc [data-m="${m2}"]`), m2);
    t.ok('an unanswered card is up while you rest', r);
    const third = await p.evaluate((ms) => {
      const L = window.Train._.state().LIVE, lib = window.Train._.lib;
      return L.x.findIndex((x) => ms.indexOf(lib(x.e).m) < 0);
    }, [m, m2]);
    await p.fill(`#trw-${third}-0`, '50'); await p.fill(`#trr-${third}-0`, '10');
    await p.click(`[data-t="tick"][data-x="${third}"][data-s="0"]`);
    r = await p.evaluate((m2) => ((document.querySelector(`.tr-fbt[data-m="${m2}"]`) || {}).textContent || ''), m2);
    t.ok('and tucks itself away once you tick a set of something else', /not rated yet/.test(r), r);
    await p.close();

    // ---- pairs are explained; the back is one choice among the rest --------------
    p = await t.fresh();
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="qz"][data-f="goal"][data-v="keep"]');
    await p.click('[data-t="qz"][data-f="lvl"][data-v="2"]');
    await p.click('[data-t="qz"][data-f="dpw"][data-v="2"]');
    await p.click('[data-t="qz"][data-f="min"][data-v="40"]');
    await p.click('[data-t="qzn"]');
    await p.click('[data-t="qz"][data-f="kit"][data-v="gym"]');
    r = await p.evaluate(() => ({ back: !!document.querySelector('[data-t="qzback"]'), triggers: !!document.querySelector('[data-f="bk"]') }));
    t.ok('the back is a choice beside the joints, with no back question until it is picked', r.back && !r.triggers, JSON.stringify(r));
    await p.click('[data-t="qzback"]');
    r = await p.evaluate(() => ({ triggers: document.querySelectorAll('[data-f="bk"]').length, unsure: !!document.querySelector('[data-t="qzbku"]') }));
    t.ok('picking it asks what sets it off, with a not-sure', r.triggers === 3 && r.unsure, JSON.stringify(r));
    await p.click('[data-t="qzn"]');
    r = await p.evaluate(() => window.Train._.state().S.qz.a.bk);
    t.ok('left unanswered, it plays safe and guards all three', r === 'fcx', r);
    await p.click('[data-t="qzn"]');
    await p.click('[data-t="qz"][data-f="age"][data-v=""]');
    await p.click('[data-t="prog"][data-v="keep"]');
    await p.click('[data-t="build"]');
    r = await p.evaluate(() => (document.querySelector('.tr-pairwhy') || {}).textContent || '');
    t.ok('and a block with pairs says what A1 and A2 mean, and why', /A1 and A2 are a pair/.test(r) && /on purpose/.test(r), r);
    await p.click('[data-t="begin"]');
    await p.click('[data-t="start"]');
    for (const xi of [0, 1]) {
      const n = await p.evaluate((xi) => window.Train._.state().LIVE.x[xi].s.length, xi);
      for (let j = 0; j < n; j++) {
        await p.fill(`#trw-${xi}-${j}`, '100'); await p.fill(`#trr-${xi}-${j}`, '8');
        await p.click(`[data-t="tick"][data-x="${xi}"][data-s="${j}"]`);
      }
    }
    r = await p.evaluate(() => {
      const L = window.Train._.state().LIVE, m = window.Train._.lib(L.x[0].e).m;
      return { pair: L.x[0].p && L.x[0].p === L.x[1].p, open: !!document.querySelector(`.tr-fbc [data-m="${m}"]`) };
    });
    t.ok('the other half of a pair does not put the first half’s card away', r.pair && r.open, JSON.stringify(r));
    await p.close();
    // ---- for somebody who lifts every day and logs everything ------------
    /* A keeping block, two days of pairs, started: the quickest way to a
       live workout with a block behind it. */
    async function keepLive(p) {
      await p.click('.tab[data-view="train"]');
      await p.click('[data-t="qz"][data-f="goal"][data-v="keep"]');
      await p.click('[data-t="qz"][data-f="lvl"][data-v="2"]');
      await p.click('[data-t="qz"][data-f="dpw"][data-v="2"]');
      await p.click('[data-t="qz"][data-f="min"][data-v="0"]');
      await p.click('[data-t="qzn"]');
      await p.click('[data-t="qz"][data-f="kit"][data-v="gym"]');
      await p.click('[data-t="qzn"]');
      await p.click('[data-t="qzn"]');
      await p.click('[data-t="qz"][data-f="age"][data-v=""]');
      await p.click('[data-t="prog"][data-v="keep"]');
      await p.click('[data-t="build"]');
      await p.click('[data-t="begin"]');
      await p.click('[data-t="start"]');
      await p.waitForTimeout(100);
    }
    const otherOf = (p, xi) => p.evaluate((xi) => {
      const cur = window.Train._.state().LIVE.x[xi].e;
      return [...document.querySelectorAll('.tr-pick[data-e]')].map((b) => b.dataset.e).filter((e) => e !== cur)[0];
    }, xi);

    // a swap is for today unless you say the rest of the block
    p = await t.fresh();
    await keepLive(p);
    await p.click('[data-t="swap"][data-x="0"]');
    r = await p.evaluate(() => ({
      chips: [...document.querySelectorAll('[data-t="swsc"]')].map((b) => b.dataset.v + ':' + b.getAttribute('aria-pressed')).join(),
    }));
    t.ok('a swap in a block asks how long it is for, and starts at just today', r.chips === 'day:true,block:false', r.chips);
    let to = await otherOf(p, 0);
    const before = await p.evaluate(() => { const s = window.Train._.state(); return s.T.ms[s.LIVE.ms].days[s.LIVE.d].s.map((x) => x.e).join(); });
    await p.click(`.tr-pick[data-e="${to}"]`);
    r = await p.evaluate(() => { const s = window.Train._.state(); return { now: s.LIVE.x[0].e, plan: s.T.ms[s.LIVE.ms].days[s.LIVE.d].s.map((x) => x.e).join() }; });
    t.ok('just today changes today and leaves the block as it was', r.now === to && r.plan === before, JSON.stringify(r));
    await p.click('[data-t="swap"][data-x="1"]');
    await p.click('[data-t="swsc"][data-v="block"]');
    r = await p.evaluate(() => (document.querySelector('.tr-swsc .tr-hint') || {}).textContent || '');
    t.ok('the rest of the block says what it will do', /every week from now on/.test(r), r);
    to = await otherOf(p, 1);
    const was1 = await p.evaluate(() => window.Train._.state().LIVE.x[1].e);
    await p.click(`.tr-pick[data-e="${to}"]`);
    r = await p.evaluate((was) => { const s = window.Train._.state(); const d = s.T.ms[s.LIVE.ms].days[s.LIVE.d].s.map((x) => x.e); return { has: d.indexOf(s.LIVE.x[1].e) >= 0, gone: d.indexOf(was) < 0 }; }, was1);
    t.ok('the rest of the block puts the new one in the plan', r.has && r.gone, JSON.stringify(r));
    // swapped for today, then that one swapped for good: the plan's own exercise is what goes
    const orig0 = before.split(',')[0];
    await p.click('[data-t="swap"][data-x="0"]');
    await p.click('[data-t="swsc"][data-v="block"]');
    to = await p.evaluate((skip) => {
      const cur = window.Train._.state().LIVE.x[0].e;
      return [...document.querySelectorAll('.tr-pick[data-e]')].map((b) => b.dataset.e).filter((e) => e !== cur && e !== skip)[0];
    }, orig0);
    await p.click(`.tr-pick[data-e="${to}"]`);
    r = await p.evaluate(() => { const s = window.Train._.state(); return s.T.ms[s.LIVE.ms].days[s.LIVE.d].s.map((x) => x.e); });
    t.ok('a second swap, for the rest of the block, replaces what the plan had, not today’s stand-in', r[0] === to && r.indexOf(orig0) < 0, JSON.stringify({ r, orig0, to }));

    // moving an exercise, pairs together
    r = await p.evaluate(() => {
      const L = window.Train._.state().LIVE;
      return { es: L.x.map((x) => x.e), ps: L.x.map((x) => x.p || 0),
        upOff: document.querySelector('[data-t="mvex"][data-v="-1"][data-x="0"]').disabled };
    });
    t.ok('the first exercise cannot move up', r.upOff);
    const order0 = r;
    await p.click('[data-t="mvex"][data-v="1"][data-x="0"]');
    r = await p.evaluate(() => window.Train._.state().LIVE.x.map((x) => x.e));
    const paired = order0.ps[0] && order0.ps[0] === order0.ps[1];
    t.ok('moving down swaps it past the next exercise, and a pair moves as one',
      paired ? r[0] === order0.es[2] && r.indexOf(order0.es[0]) + 1 === r.indexOf(order0.es[1]) : r[1] === order0.es[0], JSON.stringify({ was: order0.es, now: r }));
    r = await p.evaluate(() => JSON.parse(localStorage.getItem('sh.trainLive')).x.map((x) => x.e));
    t.ok('and the new order is kept if the page goes away', r[0] !== order0.es[0], r.join());

    // a note that follows the exercise
    const e0 = await p.evaluate(() => window.Train._.state().LIVE.x[0].e);
    await p.click(`.tr-ex-a [data-t="note"][data-e="${e0}"]`);
    await p.fill('#trNoteT', '  Seat 4.   Handles at the second notch. ');
    await p.click('[data-t="notesave"]');
    r = await p.evaluate((e) => {
      const s = window.Train._.state(), k = window.Train._.ntKey(e);
      return { v: s.T.nt[k], stamped: s.TS.nt[k] > 0, card: (document.querySelector('.tr-ex .tr-exnt') || {}).textContent || '',
        sync: JSON.stringify(window.Train._.payload(true).nt || {}) };
    }, e0);
    t.ok('a note on an exercise is kept, tidied, and stamped to sync',
      r.v && r.v.e === e0 && r.v.t === 'Seat 4. Handles at the second notch.' && r.stamped && /second notch/.test(r.sync), JSON.stringify(r));
    t.ok('and shows on its card', /Seat 4/.test(r.card), r.card);
    r = await p.evaluate(() => {
      const ids = window.Train._.LIB_LIST.map((x) => window.Train._.ntKey(x.id));
      return ids.length === new Set(ids).size;
    });
    t.ok('no two library exercises share a note key', r);

    // effort, set by set, when asked for
    await p.click('[data-t="settings"]');
    await p.click('[data-t="s-rq"][data-v="1"]');
    await p.click('.sheet-x');
    r = await p.evaluate(() => document.querySelectorAll('.tr-ex .tr-rqs').length);
    t.ok('turned on, every set has a reps-in-reserve box', r > 0, r);
    await p.selectOption('[data-in="q"][data-x="0"][data-s="0"]', '2');
    const n0 = await p.evaluate(() => window.Train._.state().LIVE.x[0].s.length);
    for (let j = 0; j < n0; j++) {
      await p.fill(`#trw-0-${j}`, '100'); await p.fill(`#trr-0-${j}`, '10');
      await p.click(`[data-t="tick"][data-x="0"][data-s="${j}"]`);
    }
    await p.click('[data-t="finish"]');
    await p.fill('#trWoNt', 'Slept badly. Knee fine.');
    await p.click('[data-t="save"]');
    await p.click('.tr-done [data-t="close"]');
    r = await p.evaluate((e) => {
      const s = window.Train._.state(), w = Object.values(s.T.wo)[0];
      return { q: w.x[0].s[0].q, q1: w.x[0].s[1] && w.x[0].s[1].q, pq: w.x[0].pq, nt: w.nt, plan: (document.querySelector('.tr-next') || {}).textContent || '' };
    }, e0);
    t.ok('a set said to have two in reserve is saved so; one not said stays blank', r.q === 2 && r.q1 === undefined, JSON.stringify(r));
    t.ok('with what the plan asked beside it', typeof r.pq === 'number', r.pq);
    t.ok('and the note on the workout is saved with it', r.nt === 'Slept badly. Knee fine.', r.nt);
    await p.click('[data-t="sub"][data-v="history"]');
    r = await p.evaluate(() => (document.querySelector('.tr-h-nt') || {}).textContent || '');
    t.ok('History shows the note', /Slept badly/.test(r), r);
    await p.close();

    // the review grades effort once it is said
    p = await t.fresh();
    r = await p.evaluate(() => {
      const _ = window.Train._, st = _.state(), now = Date.now();
      const W = (id, ago, x) => ({ id, st: now - ago * 864e5, u: 'lb', ms: '', w: -1, d: -1, x });
      const q = (qs, pq) => ({ e: 'bb-bench', pq, s: qs.map((v, i) => ({ w: 185, r: 8, q: v, t: now - 2 * 864e5 + i * 200e3 })) });
      const grade = (x) => {
        st.T.wo = { a: W('a', 2, x) }; st.T.act = '';
        localStorage.setItem('bsc.train', JSON.stringify(st.T)); _.reload();
        return _.review(now).checks.filter((c) => c.t === 'How close to failure')[0];
      };
      return { far: grade([q([4, 4, 5, 4, 4, 5])]), near: grade([q([2, 2, 1, 2, 2, 2], 2)]), over: grade([q([0, 0, 0, 0, 0, 0], 2)]),
        few: grade([q([2, 2], 2)]) };
    });
    t.ok('four and five in reserve, with no plan, is further from failure than the growth was', r.far.st === 'look' && /4\.5 reps in reserve/.test(r.far.b), r.far.b);
    t.ok('about the two asked for is on target', r.near.st === 'good' && /On target/.test(r.near.b), r.near.b);
    t.ok('none left where two were asked is flagged as closer than planned', r.over.st === 'look' && /Closer to failure than planned/.test(r.over.b), r.over.b);
    t.ok('two sets is not enough to grade', r.few.st === 'info', r.few.b);
    await p.close();

    // correcting a saved workout
    p = await t.fresh();
    await p.click('.tab[data-view="train"]');
    await seed(p, { pr: { qz: 1 }, act: '', ms: {}, cx: {}, ax: {},
      wo: { old: wo('old', '', -1, -1, 9, [{ e: 'bb-bench', s: sets(180, [8, 8]) }]),
        fix: wo('fix', '', -1, -1, 2, [{ e: 'bb-bench', s: sets(185, [8, 8]) }, { e: 'db-curl', s: sets(30, [12]) }]) } });
    await p.click('[data-t="sub"][data-v="history"]');
    await p.click('[data-t="wosheet"][data-id="fix"]');
    await p.click('[data-t="edopen"]');
    r = await p.evaluate(() => document.querySelectorAll('[data-ed="w"]').length);
    t.ok('Edit opens the workout as boxes, set by set', r === 3, r);
    await p.fill('[data-ed="w"][data-x="0"][data-s="0"]', '195');
    await p.click('[data-t="edrm"][data-x="0"][data-s="1"]');
    await p.click('[data-t="edadd"][data-x="0"]');
    await p.fill('#trEdNt', 'Typo fixed');
    await p.click('[data-t="edsave"]');
    r = await p.evaluate(() => {
      const s = window.Train._.state(), w = s.T.wo.fix;
      return { s: w.x[0].s.map((z) => z.w + 'x' + z.r + (z.t ? 't' : '')).join(), ed: w.ed > 0, stamp: s.TS.wo.fix > 0, nt: w.nt,
        prs: window.Train._.prsIn(w).length, sub: (document.querySelector('.tr-sheet .tr-sub') || {}).textContent || '' };
    });
    t.ok('the weight is corrected, the set taken out is gone, the set added copies the last',
      r.s === '195x8t,195x8', r.s);
    t.ok('and it is stamped, so the other phone takes the correction', r.ed && r.stamp, JSON.stringify(r));
    t.ok('the records follow: 195 is now a record over the 180 before', r.prs >= 1, r.prs);
    t.ok('and it says it was edited', /edited/.test(r.sub) && r.nt === 'Typo fixed', r.sub);
    await p.click('[data-t="edopen"]');
    await p.click('[data-t="edrmx"][data-x="1"]');
    await p.click('[data-t="edrmx"][data-x="0"]');
    await p.click('[data-t="edsave"]');
    r = await p.evaluate(() => ({ err: (document.querySelector('.tr-sheet .tr-warn') || {}).textContent || '', left: window.Train._.state().T.wo.fix.x.length }));
    t.ok('emptying a workout is refused, and says to delete it instead', /delete it/.test(r.err) && r.left === 2, JSON.stringify(r));
    await p.click('[data-t="edcancel"]');
    await p.click('[data-t="edopen"]');
    await p.fill('[data-ed="r"][data-x="1"][data-s="0"]', '');
    await p.click('[data-t="edaddx"]');
    await p.click('.tr-pick[data-e="hammer"]');
    await p.fill('[data-ed="w"][data-x="2"][data-s="0"]', '25');
    await p.fill('[data-ed="r"][data-x="2"][data-s="0"]', '10');
    await p.click('[data-t="edsave"]');
    r = await p.evaluate(() => window.Train._.state().T.wo.fix.x.map((x) => x.e + ':' + x.s.length).join());
    t.ok('a forgotten exercise can be added, and one left with no reps drops out', r === 'bb-bench:2,hammer:1', r);
    await p.close();

    // every day: six lifting days and an easy one
    p = await t.fresh();
    await p.click('.tab[data-view="train"]');
    await answer(p, { goal: 'muscle', lvl: 1, dpw: 7, min: 0 });
    r = await p.evaluate(() => window.Train._.state().T.pr.dpw);
    t.ok('seven days a week is an answer', r === 7, r);
    await p.click('[data-t="prog"][data-v="grow"]');
    r = await p.evaluate(() => ({ o: window.Train._.state().S.opt, on: (document.querySelector('[data-t="o-ez"][aria-pressed="true"]') || {}).dataset }));
    t.ok('and the program starts at six lifting days with an easy day', r.o.dpw === 6 && r.o.ez === 1 && r.on && r.on.v === '1', JSON.stringify(r.o));
    await p.click('[data-t="build"]');
    r = await p.evaluate(() => { const d = window.Train._.state().S.draft; return { n: d.days.length, last: d.days[6], name: d.n, shown: /No lifting/.test(document.querySelector('.tr-dday.tr-ez').textContent) }; });
    t.ok('the block has the easy day last, asking for no sets', r.n === 7 && r.last.ez === 1 && r.last.s.length === 0 && /\+ easy/.test(r.name) && r.shown, JSON.stringify(r));
    await p.close();

    p = await t.fresh();
    r = await p.evaluate(() => {
      const _ = window.Train._;
      const ms = _.build({ prog: 'keep', dpw: 2, ez: 1, kit: 'gym', lvl: 1 });
      ms.at = Date.now(); ms.st = '2026-01-01';
      return ms;
    });
    const msE = r;
    await seed(p, { pr: { qz: 1, hab: ['golfw'] }, act: msE.id, ms: { [msE.id]: msE }, cx: {}, ax: {},
      wo: { a: wo('a', msE.id, 0, 0, 2, [{ e: msE.days[0].s[0].e, s: sets(100, [10]) }]),
        b: wo('b', msE.id, 0, 1, 1, [{ e: msE.days[1].s[0].e, s: sets(100, [10]) }]) } });
    // opened after the log is in, so it opens on the block rather than the quiz
    await p.click('.tab[data-view="train"]');
    r = await p.evaluate(() => ({ card: (document.querySelector('.tr-next.tr-ez') || {}).textContent || '', start: !!document.querySelector('.tr-next [data-t="start"]') }));
    t.ok('after the lifting days, next is the easy day, with no workout to start', /Easy day/.test(r.card) && /golf/i.test(r.card) && !r.start, r.card);
    await p.click('.tr-next [data-t="eznew"]');
    r = await p.evaluate(() => window.Train._.state().S.sheet);
    t.ok('logging it starts from your own activity', r.k === 'axnew' && r.h === 'golfw' && r.ez && r.ez.d === 2, JSON.stringify(r));
    await p.click('[data-t="axk"][data-v="walk"]');
    await p.click('[data-t="axsave"]');
    r = await p.evaluate((id) => {
      const _ = window.Train._, s = _.state(), a = Object.values(s.T.ax)[0], ms = s.T.ms[id];
      return { a, nx: _.nextSlot(ms), cell: (document.querySelector('.tr-gc[data-w="0"][data-d="2"]') || {}).textContent || '' };
    }, msE.id);
    t.ok('the walk is counted as week one’s easy day', r.a.ms === msE.id && r.a.w === 0 && r.a.d === 2 && /✓/.test(r.cell), JSON.stringify(r.a));
    t.ok('and the next session is week two’s first', r.nx && r.nx.w === 1 && r.nx.d === 0, JSON.stringify(r.nx));
    r = await p.evaluate(() => window.Train._.review().label);
    t.ok('the review reads week one as whole without waiting on the easy day', /Week 1/.test(r), r);
    // an activity already logged today can be the easy day
    await seed(p, { pr: { qz: 1 }, act: msE.id, ms: { [msE.id]: msE }, cx: {},
      ax: { z: { id: 'z', st: Date.now(), k: 'swim', min: 30, lv: 'm' } },
      wo: { a: wo('a', msE.id, 0, 0, 2, [{ e: msE.days[0].s[0].e, s: sets(100, [10]) }]),
        b: wo('b', msE.id, 0, 1, 1, [{ e: msE.days[1].s[0].e, s: sets(100, [10]) }]) } });
    await p.click('[data-t="sub"][data-v="history"]');
    await p.click('[data-t="sub"][data-v="block"]');
    await p.click('.tr-next [data-t="ezlink"]');
    r = await p.evaluate(() => window.Train._.state().T.ax.z);
    t.ok('today’s swim, logged before, can be counted as it', r.ms === msE.id && r.d === 2, JSON.stringify(r));
    await p.close();

    // from Strong
    p = await t.fresh();
    await p.click('.tab[data-view="train"]');
    const ts = (ago, h) => { const d = new Date(Date.now() - ago * DAY); d.setHours(h, 0, 0, 0);
      const z = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(h)}:00:00`; };
    const dA = ts(20, 7), dB = ts(18, 18);
    const csv = [
      'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
      `"${dA}","Push Day","1h 5m","Bench Press (Barbell)","W","95","10","0","0","","Felt good, slept 8h",""`,
      `"${dA}","Push Day","1h 5m","Bench Press (Barbell)","1","185","8","0","0","","Felt good, slept 8h","8"`,
      `"${dA}","Push Day","1h 5m","Bench Press (Barbell)","2","185","7","0","0","","Felt good, slept 8h","9"`,
      `"${dA}","Push Day","1h 5m","Bench Press (Barbell)","Rest Timer","0","0","0","120","","",""`,
      `"${dA}","Push Day","1h 5m","Triceps Pushdown (Cable - Straight Bar)","1","50","12","0","0","rope, not bar","Felt good, slept 8h",""`,
      `"${dA}","Push Day","1h 5m","Zottman Curl (Dumbbell)","1","25","10","0","0","","",""`,
      `"${dA}","Push Day","1h 5m","Plank","1","0","0","0","60","","",""`,
      `"${dB}","Legs","50m","Squat (Barbell)","1","225","5","0","0","","",""`,
      `"${dB}","Legs","50m","Squat (Barbell)","2","225","5","0","0","","",""`,
      `"${dB}","Legs","50m","Running","1","0","0","3.1","1800","","",""`,
      `"${dB}","Legs","50m","Lying Leg Curl (Machine)","1","90","12","0","0","","",""`,
    ].join('\r\n');
    r = await p.evaluate((csv) => {
      const G = window.Train._.sgParse(csv);
      const push = G.wos[0];
      return { n: G.wos.length, skipped: G.skipped, names: G.names.map((n) => n.nm + '=' + (n.e || 'own:' + n.m)).join('|'),
        bench: push.x[0].s.map((s) => s.w + 'x' + s.r + (s.wu ? 'W' : '') + (s.q !== undefined ? '@' + s.q : '')).join(),
        dur: push.dur, nt: push.nt.join(' / ') };
    }, csv);
    t.ok('a Strong export reads as its workouts, leaving out timed, distance and rest-timer rows', r.n === 2 && r.skipped === 3, JSON.stringify(r));
    t.ok('warm-ups stay warm-ups, and RPE becomes reps in reserve', r.bench === '95x10W,185x8@2,185x7@1', r.bench);
    t.ok('Strong’s lifts match the library, and a lift it has not got comes in as yours, its muscle guessed',
      /Bench Press \(Barbell\)=bb-bench/.test(r.names) && /Triceps Pushdown \(Cable - Straight Bar\)=pushdown/.test(r.names) &&
      /Squat \(Barbell\)=bb-squat/.test(r.names) && /Lying Leg Curl \(Machine\)=lying-curl/.test(r.names) &&
      /Zottman Curl \(Dumbbell\)=own:biceps/.test(r.names), r.names);
    t.ok('the length and the notes come too, the note with its comma intact', r.dur === 65 * 60e3 && /Felt good, slept 8h/.test(r.nt) && /rope, not bar/.test(r.nt), JSON.stringify(r));
    r = await p.evaluate(() => {
      const _ = window.Train._;
      const old = _.sgParse('Date;Workout Name;Exercise Name;Set Order;Weight;Weight Unit;Reps;RPE;Distance;Distance Unit;Seconds;Notes;Workout Notes;Workout Duration\n' +
        '2019-03-02 09:00:00;Upper;Overhead Press (Barbell);1;40;kg;5;;;;;;;45m\n');
      return { unit: old.unit, fixed: old.fixedUnit, e: old.names[0].e, bad: _.sgParse('a,b\n1,2').need,
        m: ['Leg Curl (Machine)', 'Cable Fly Crossover', 'Chest Press (Hammer Strength)', 'Face Pull (Cable)'].map((n) => _.sgMatch(n) || _.sgGuess(n).m).join() };
    });
    t.ok('the older, semicolon export with its own unit column reads too', r.unit === 'kg' && r.fixed && r.e === 'bb-ohp', JSON.stringify(r));
    t.ok('a file from no app it knows asks you to match its columns', r.bad === 'map', r.bad);
    t.ok('guesses go most particular first: a leg curl is hamstrings, not biceps', r.m === 'hams,chest,chest,face-pull', r.m);
    await p.click('[data-t="settings"]');
    await p.setInputFiles('#trStrong', { name: 'strong.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await p.waitForTimeout(300);
    r = await p.evaluate(() => ({ title: (document.querySelector('.tr-sheet .sheet-name') || {}).textContent, go: (document.querySelector('[data-t="sggo"]') || {}).textContent || '',
      unit: !!document.querySelector('[data-t="sgu"]') }));
    t.ok('choosing the file shows what came in before anything is kept', r.title === 'From Strong' && /Bring in 2 workouts/.test(r.go) && r.unit, JSON.stringify(r));
    await p.click('[data-t="sgu"][data-v="kg"]');
    await p.click('[data-t="sgu"][data-v="lb"]');
    await p.click('[data-t="sggo"]');
    r = await p.evaluate(() => {
      const _ = window.Train._, s = _.state();
      const wos = Object.values(s.T.wo), own = Object.values(s.T.cx);
      return { n: wos.length, im: wos.every((w) => w.im === 's'), own: own.map((c) => c.n + ':' + c.m).join(), sub: s.S.sub,
        banner: (document.querySelector('.tr-sgdone') || {}).textContent || '',
        stamped: wos.every((w) => s.TS.wo[w.id] > 0),
        prev: _.target(_.lib('bb-bench'), null, 0, 0, false).prev.map((z) => z.w + 'x' + z.r).join() };
    });
    t.ok('bringing it in keeps both workouts, marked as from Strong, and stamped to sync', r.n === 2 && r.im && r.stamped, JSON.stringify(r));
    t.ok('the lift the library lacked is yours now', r.own === 'Zottman Curl (Dumbbell):biceps', r.own);
    t.ok('History says what came in', r.sub === 'history' && /Brought in 2 workouts from Strong/.test(r.banner), r.banner);
    t.ok('and a new block’s first bench session starts from Strong’s numbers', /185x8/.test(r.prev), r.prev);
    await p.click('[data-t="settings"]');
    await p.setInputFiles('#trStrong', { name: 'strong.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await p.waitForTimeout(300);
    r = await p.evaluate(() => ({ go: document.querySelector('[data-t="sggo"]'), sub: (document.querySelector('.tr-sheet .tr-sub') || {}).textContent || '' }));
    t.ok('the same file twice brings in nothing twice', r.go && /Nothing new/.test(await p.textContent('[data-t="sggo"]')) && /here already/.test(r.sub), r.sub);
    await p.close();
    // ---- the foot of the workout, the back as a question, times, plates ----
    p = await t.fresh();
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="qzskip"]');
    await seed(p, { pr: { qz: 1, bk: 'f', rq: 0 }, act: '', ms: {}, cx: {}, ax: {}, wo: {} });
    await p.click('[data-t="sub"][data-v="history"]');
    await p.click('[data-t="sub"][data-v="block"]');
    await p.click('[data-t="empty"]');
    await p.click('[data-t="addex"]');
    await p.click('.tr-pick[data-e="bb-bench"]');
    await p.click('[data-t="addex"]');
    await p.click('.tr-pick[data-e="ez-curl"]');
    r = await p.evaluate(() => ({
      head: !!document.querySelector('.tr-live-h [data-t="finish"]'),
      foot: !!document.querySelector('#trRest:not(.hide) .tr-wbar [data-t="finish"]'),
      started: (document.querySelector('.tr-wbar-l') || {}).textContent || '',
      list: !!document.querySelector('#trBody [data-t="finish"]'),
    }));
    t.ok('Finish lives in the footer, one reach from every card, and nowhere else', !r.head && !r.list && r.foot, JSON.stringify(r));
    t.ok('beside when you started', /^Started \d{1,2}:\d{2} [AP]M$/.test(r.started), r.started);
    r = await p.evaluate(() => [window.Train._.elapsed(8551), window.Train._.elapsed(59), window.Train._.elapsed(3600)].join('|'));
    t.ok('past an hour the clock says hours: 2:22:31, not 142:31', r === '2:22:31|0:59|1:00:00', r);

    // the back, asked, then folded
    r = await p.evaluate(() => (document.querySelector('.tr-ask .tr-sq-l') || {}).textContent || '');
    t.ok('the back check is a question', r === 'How’s your back today?', r);
    await p.click('[data-t="bk"][data-v="0"]');
    r = await p.evaluate(() => ({ line: (document.querySelector('.tr-bkt') || {}).textContent || '', q: !!document.querySelector('[data-t="bk"]') }));
    t.ok('answered, it folds to one line with a way back', /Back/.test(r.line) && /good/.test(r.line) && /Change/.test(r.line) && !r.q, JSON.stringify(r));
    await p.click('[data-t="bkopen"]');
    await p.click('[data-t="bk"][data-v="2"]');
    r = await p.evaluate(() => ({ line: (document.querySelector('.tr-bkt .tr-fbt-s') || {}).textContent || '', warn: (document.querySelector('.tr-bkt .tr-warn') || {}).textContent || '' }));
    t.ok('sore folds too, but keeps its warning in view', r.line === 'sore' && /Skip the lower-body lifts today/.test(r.warn), JSON.stringify(r));

    // plates, in every set
    r = await p.evaluate(() => {
      const _ = window.Train._, a = (w, b) => { const d = document.createElement('div'); d.innerHTML = _.stackHTML(w, b); const s = d.querySelector('.tr-stk'); return s ? s.getAttribute('aria-label') || s.textContent : ''; };
      return { std: a(195, 45), odd: a(137.5, 45), under: a(30, 45), bar: a(45, 45), heavy: (() => { const d = document.createElement('div'); d.innerHTML = _.stackHTML(585, 45); return d.textContent; })(),
        bars: ['bb-bench', 'ez-curl', 'sm-incline'].map((e) => _.barFor(e)).join(),
        kg: (() => { const T = _.state().T, was = T.pr.u; T.pr.u = 'kg'; const d = document.createElement('div'); d.innerHTML = _.stackHTML(22.5, 20); T.pr.u = was; return d.querySelector('.tr-stk').getAttribute('aria-label'); })() };
    });
    t.ok('the plates a side: 195 on a 45 bar is 45, 25 and 5', r.std === '45, 25, 5 a side', r.std);
    t.ok('a weight the plates cannot make says what is left, rather than rounding it away', /1\.25 lb a side that the plates cannot make/.test(r.odd), r.odd);
    t.ok('less than the bar says so; the bar alone says so', /under the bar/.test(r.under) && /just the bar/.test(r.bar), r.under + ' / ' + r.bar);
    t.ok('six 45s fold to one plate with a count', /45×6/.test(r.heavy), r.heavy);
    t.ok('an EZ bar (15 lb, as Strong has it) and a Smith machine start on their own bars', r.bars === '45,15,20', r.bars);
    t.ok('a plate of 1.25 reads 1.25, not 1.3', r.kg === '1.25 a side', r.kg);
    await p.fill('#trw-0-0', '195');
    r = await p.evaluate(() => ({
      now: document.querySelector('#trpl-0-0 .tr-stk').getAttribute('aria-label'),
      dim: document.querySelector('#trpl-0-1 .tr-stk').classList.contains('dim'),
      next: document.querySelector('#trpl-0-1 .tr-stk').getAttribute('aria-label'),
      head: document.querySelectorAll('.tr-ex')[0].querySelector('.tr-set-h').textContent,
      curl: !!document.querySelector('#trpl-1-0'),
    }));
    t.ok('typing a weight draws its plates in the set, at once', r.now === '45, 25, 5 a side', r.now);
    t.ok('and the sets after it, faint until they are typed', r.dim && r.next === '45, 25, 5 a side', JSON.stringify(r));
    t.ok('where Previous was, under the same heading, with no “Per side” taking room', /Previous/.test(r.head) && !/Per side/i.test(r.head), r.head);
    await p.click('[data-t="barpick"][data-e="bb-bench"]');
    r = await p.evaluate(() => [...document.querySelectorAll('.tr-barr')].map((b) => b.textContent).join('|'));
    t.ok('the bars are named, the way Strong lists them', r === 'Olympic bar45 lb|Short bar33 lb|EZ bar15 lb|Hex bar75 lb|Smith machine20 lb|No bar0 lb', r);
    await p.click('[data-t="barset"][data-v="75"]');
    r = await p.evaluate(() => ({ stk: document.querySelector('#trpl-0-0 .tr-stk').getAttribute('aria-label'), kept: window.Train._.state().T.pr.bars,
      label: (document.querySelector('[data-t="barpick"][data-e="bb-bench"]') || {}).textContent }));
    t.ok('a lift can be put on another bar, and its plates follow', r.stk === '45, 10, 5 a side' && r.label === 'Hex bar 75 lb', JSON.stringify(r));
    t.ok('and the bar is remembered for that lift, and synced with your settings', r.kept.nbbbench && r.kept.nbbbench.e === 'bb-bench' && r.kept.nbbbench.w === 75, JSON.stringify(r.kept));
    await p.click('[data-t="barpick"][data-e="bb-bench"]');
    await p.fill('#trBarW', '33');
    await p.click('[data-t="barother"]');
    r = await p.evaluate(() => window.Train._.barFor('bb-bench'));
    t.ok('any bar weight can be typed', r === 33, r);
    await p.click('[data-t="plates"][data-x="0"]');
    r = await p.evaluate(() => (document.querySelector('.tr-sheet .tr-own-r .tr-sub') || {}).textContent || '');
    t.ok('the plate calculator uses the lift’s own bar', /on a 33 lb bar/.test(r), r);
    await p.click('.sheet-x');

    // plates while typing
    await p.click('[data-t="settings"]');
    await p.click('[data-t="s-pl"][data-v="type"]');
    await p.click('.sheet-x');
    r = await p.evaluate(() => ({ strip: document.querySelectorAll('.tr-plrow').length,
      on: [...document.querySelectorAll('.tr-prev-pl.on')].map((e) => e.id).join(),
      stk: [...document.querySelectorAll('.tr-prev-pl')].filter((e) => e.querySelector('.tr-stk')).map((e) => e.id).join(),
      rest: document.getElementById('trpl-0-2').textContent, curl: document.getElementById('trpl-1-0').textContent }));
    t.ok('while typing: the plates sit in the row of the next set to do, where Previous was, not in a strip under it',
      r.strip === 0 && r.on === 'trpl-0-0,trpl-1-0' && r.stk === 'trpl-0-0', JSON.stringify(r));
    t.ok('a next set with no weight yet and no last time is left blank, not dashed', r.curl === '', JSON.stringify(r));
    t.ok('the other sets show last time', r.rest === '—', JSON.stringify(r));
    await p.focus('#trw-0-2');
    await p.fill('#trw-0-2', '173');
    r = await p.evaluate(() => ({ on: document.getElementById('trpl-0-2').classList.contains('on'), stk: document.querySelector('#trpl-0-2 .tr-stk').getAttribute('aria-label'),
      txt: document.getElementById('trpl-0-2').textContent }));
    t.ok('and in the row of the set whose weight is being typed', r.on && r.stk === '45, 25 a side', JSON.stringify(r));
    t.ok('with no dash beside them when there is no last time', !/—/.test(r.txt), r.txt);
    await p.focus('#trr-0-2');
    // it goes back a moment later, once the tap that moved the cursor has landed
    r = await p.waitForFunction(() => !document.getElementById('trpl-0-2').classList.contains('on') && !document.querySelector('#trpl-0-2 .tr-stk'), null, { timeout: 3000 })
      .then(() => false, () => true);
    t.ok('which goes back to last time when the cursor leaves it', !r);
    await p.click('[data-t="settings"]');
    await p.click('[data-t="s-pl"][data-v="off"]');
    await p.click('.sheet-x');
    r = await p.evaluate(() => document.querySelectorAll('.tr-stk').length);
    t.ok('and off is off', r === 0, r);

    // the start time, changed
    await p.click('[data-t="times"]');
    const early = await p.evaluate(() => window.Train._.dtVal(Date.now() - 45 * 60e3));
    await p.fill('#trT0-live', early);
    await p.click('[data-t="livetimeset"]');
    r = await p.evaluate((v) => ({ st: window.Train._.dtVal(window.Train._.state().LIVE.st), clock: (document.getElementById('trElapsed') || {}).textContent }), early);
    t.ok('the start can be moved back to when you really began', r.st === early && /^4[45]:/.test(r.clock), JSON.stringify(r));
    await p.click('[data-t="times"]');
    await p.fill('#trT0-live', await p.evaluate(() => window.Train._.dtVal(Date.now() + 3 * 3600e3)));
    await p.click('[data-t="livetimeset"]');
    r = await p.evaluate(() => (document.querySelector('.tr-sheet .tr-warn') || {}).textContent || '');
    t.ok('but not into the future', /in the future/.test(r), r);
    await p.click('.sheet-x');

    // the end, set at Finish
    await p.fill('#trr-0-0', '8');
    await p.click('[data-t="tick"][data-x="0"][data-s="0"]');
    await p.click('[data-t="finish"]');
    await p.click('[data-t="fintimes"]');
    const end = await p.evaluate(() => window.Train._.dtVal(Date.now() - 10 * 60e3));
    await p.fill('#trT1-fin', end);
    await p.click('[data-t="fintimeset"]');
    r = await p.evaluate(() => (document.querySelector('.tr-when') || {}).textContent || '');
    t.ok('Finish shows when it was, and the end can be set to when you stopped', /\d{1,2}:\d{2}/.test(r) && /–/.test(r), r);
    await p.click('[data-t="save"]');
    r = await p.evaluate((end) => { const w = Object.values(window.Train._.state().T.wo)[0]; return { en: window.Train._.dtVal(w.en), mins: Math.round((w.en - w.st) / 60e3) }; }, end);
    t.ok('and the workout is saved with those times', r.en === end && r.mins === 35, JSON.stringify(r));

    // copy it, and it goes into Nourish's day too
    r = await p.evaluate(() => {
      let got = null;
      navigator.clipboard.writeText = (x) => { got = x; return Promise.resolve(); };
      document.querySelector('.tr-saved [data-t="wocopy"]').click();
      return got;
    });
    t.ok('a saved workout copies as text: the date, the times, every set',
      /^Strengthen — \w{3}, \w{3} \d+ \d{4}/.test(r || '') && /Workout · \d{1,2}:\d{2}.*\(35 min\)/.test(r || '') && /Barbell Bench Press: 195 lb × 8/.test(r || '') && /1 set ·/.test(r || ''), r);
    r = await p.evaluate(() => {
      const d = new Date(), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      return window.Train.dayText(k).join('\n');
    });
    t.ok('and Nourish’s copy of the day names it with its times', /^Workout: Workout, \d{1,2}:\d{2}.*\(35 min\), 1 set$/.test(r), r);

    // times on a saved workout
    await p.click('.tr-done [data-t="close"]');
    await p.click('[data-t="sub"][data-v="history"]');
    await p.click('[data-t="wosheet"]');
    await p.click('[data-t="edopen"]');
    const t0 = await p.evaluate(() => window.Train._.dtVal(Date.now() - 26 * 3600e3));
    const t1 = await p.evaluate(() => window.Train._.dtVal(Date.now() - 25 * 3600e3));
    await p.fill('#trEdT0', t1);
    await p.fill('#trEdT1', t0);
    await p.click('[data-t="edsave"]');
    r = await p.evaluate(() => (document.querySelector('.tr-sheet .tr-warn') || {}).textContent || '');
    t.ok('a saved workout’s times can be edited, and an end before the start is refused', /after the start/.test(r), r);
    await p.fill('#trEdT0', t0);
    await p.fill('#trEdT1', t1);
    await p.click('[data-t="edsave"]');
    r = await p.evaluate((t0) => { const w = Object.values(window.Train._.state().T.wo)[0]; const y = new Date(Date.now() - 26 * 3600e3);
      return { st: window.Train._.dtVal(w.st) === t0, mins: Math.round((w.en - w.st) / 60e3), dk: w.dk, want: y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0') }; }, t0);
    t.ok('moved to yesterday, it is filed under yesterday', r.st && r.mins === 60 && r.dk === r.want, JSON.stringify(r));
    await p.close();
    // ---- from Strong: set types, named bars in colour, rest per lift, a lift's own page ----
    p = await t.fresh();
    await seed(p, { pr: { qz: 1 }, act: '', ms: {}, cx: {}, ax: {},
      wo: { a: wo('a', '', -1, -1, 3, [{ e: 'bb-bench', s: [{ w: 45, r: 14, wu: 1 }, { w: 185, r: 10 }, { w: 185, r: 8 }] }]) } });
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="empty"]');
    await p.click('[data-t="addex"]');
    await p.click('.tr-pick[data-e="bb-bench"]');
    await p.click('[data-t="addset"][data-x="0"]');
    r = await p.evaluate(() => window.Train._.state().LIVE.x[0].s.map((s) => s.pw + 'x' + s.pr).join());
    t.ok('last time’s warm-up does not push every Previous down a row', r === '185x10,185x8,185x8,185x8', r);
    await p.click('[data-t="sty"][data-x="0"][data-s="0"]');
    r = await p.evaluate(() => [...document.querySelectorAll('[data-t="styset"]')].map((b) => b.textContent).join('|'));
    t.ok('tapping a set’s number asks what kind of set it is', r === 'Working set|Warm-up|Drop set|To failure|Missed', r);
    await p.click('[data-t="styset"][data-v="w"]');
    r = await p.evaluate(() => window.Train._.state().LIVE.x[0].s.map((s) => (s.pw === null ? '-' : s.pw + 'x' + s.pr)).join());
    t.ok('marked a warm-up, a set is paired with last time’s warm-up, and the working sets with last time’s working sets', r === '45x14,185x10,185x8,185x8', r);
    await p.click('[data-t="sty"][data-x="0"][data-s="3"]');
    await p.click('[data-t="styset"][data-v="d"]');
    r = await p.evaluate(() => [...document.querySelectorAll('.tr-ex .tr-set:not(.tr-set-h) .tr-sn')].map((e) => e.textContent).join(','));
    t.ok('a warm-up is lettered W, a drop set D, and the working sets numbered past them', r === 'W,1,2,D', r);
    await p.fill('#trw-0-0', '95'); await p.fill('#trr-0-0', '10');
    await p.click('[data-t="tick"][data-x="0"][data-s="0"]');
    r = await p.evaluate(() => ({ ghost: document.getElementById('trw-0-1').placeholder, rest: window.Train._.state().LIVE.rs.dur }));
    t.ok('a warm-up’s weight is not carried into the working sets', r.ghost !== '95', r.ghost);
    t.ok('and it is followed by a minute’s rest, not the full three', r.rest === 60, r.rest);
    await p.fill('#trw-0-1', '185'); await p.fill('#trr-0-1', '8');
    await p.click('[data-t="tick"][data-x="0"][data-s="1"]');
    await p.fill('#trw-0-2', '185'); await p.fill('#trr-0-2', '8');
    await p.click('[data-t="tick"][data-x="0"][data-s="2"]');
    r = await p.evaluate(() => window.Train._.state().LIVE.rs);
    t.ok('and no rest before a drop set', r === null, JSON.stringify(r));
    r = await p.evaluate(() => [...document.querySelectorAll('.tr-rdiv-b')].map((b) => b.textContent).join(','));
    t.ok('the rest between sets is drawn between them', r === '1:00,3:00,no rest', r);
    await p.click('.tr-ex-m [data-t="restpick"]');
    await p.click('[data-t="restset"][data-v="120"]');
    r = await p.evaluate(() => ({ live: window.Train._.state().LIVE.x[0].rest, kept: window.Train._.state().T.pr.rests.nbbbench,
      div: [...document.querySelectorAll('.tr-rdiv-b')].map((b) => b.textContent).join(',') }));
    t.ok('a lift’s rest can be its own, and it is remembered', r.live === 120 && r.kept && r.kept.s === 120 && r.div === '1:00,2:00,no rest', JSON.stringify(r));
    r = await p.evaluate(() => [...document.querySelectorAll('#trpl-0-1 .tr-stk-p')].map((b) => b.className).join('|'));
    t.ok('plates are coloured the way competition plates are: a 45 blue, a 25 green', /pl-lb-45/.test(r) && /pl-lb-25/.test(r), r);
    await p.fill('#trw-0-3', '135'); await p.fill('#trr-0-3', '6');
    await p.click('[data-t="tick"][data-x="0"][data-s="3"]');
    await p.click('[data-t="finish"]');
    await p.click('[data-t="save"]');
    await p.click('.tr-done [data-t="close"]');
    r = await p.evaluate(() => { const w = Object.values(window.Train._.state().T.wo).sort((a, b) => b.st - a.st)[0];
      return { kinds: w.x[0].s.map((s) => (s.wu ? 'W' : s.ty || 'n')).join(), prs: window.Train._.prsIn(w).map((x) => x.what).join() }; });
    t.ok('the kinds are saved with the sets', r.kinds === 'W,n,n,d', r.kinds);
    // the editor cycles the kind
    await p.click('[data-t="sub"][data-v="history"]');
    await p.click('.tr-hrow[data-t="wosheet"]');
    await p.click('[data-t="edopen"]');
    await p.click('[data-t="edsty"][data-x="0"][data-s="3"]');
    await p.click('[data-t="edsave"]');
    r = await p.evaluate(() => { const w = Object.values(window.Train._.state().T.wo).sort((a, b) => b.st - a.st)[0]; return w.x[0].s[3].ty; });
    t.ok('and can be changed after, in the editor', r === 'f', r);
    r = await p.evaluate(() => (document.querySelector('.tr-hrow .tr-h-d') || {}).textContent || '');
    t.ok('History gives each workout its time of day', /\d{1,2}:\d{2} [AP]M/.test(r), r);
    await p.close();

    // a warm-up is never a record; a failure set had nothing in reserve
    p = await t.fresh();
    r = await p.evaluate(() => {
      const _ = window.Train._, st = _.state(), now = Date.now();
      st.T.wo = {
        a: { id: 'a', st: now - 9 * 864e5, u: 'lb', x: [{ e: 'bb-bench', s: [{ w: 185, r: 10 }] }] },
        b: { id: 'b', st: now - 2 * 864e5, u: 'lb', x: [{ e: 'bb-bench', s: [{ w: 45, r: 20, wu: 1 }, { w: 185, r: 9 }] }] },
        c: { id: 'c', st: now - 1 * 864e5, u: 'lb', x: [{ e: 'bb-bench', pq: 2, s: [0, 1, 2, 3, 4, 5].map(() => ({ w: 150, r: 12, ty: 'f' })) }] },
      };
      st.T.act = '';
      localStorage.setItem('bsc.train', JSON.stringify(st.T)); _.reload();
      const fail = _.review(now).checks.filter((c) => c.t === 'How close to failure')[0];
      return { prs: _.prsIn(_.state().T.wo.b).length, fail: fail.st + ':' + fail.b.slice(0, 60) };
    });
    t.ok('a warm-up of 45 × 20 is not a most-reps record', r.prs === 0, r.prs);
    t.ok('failure sets count as nothing in reserve, and six of them where two were asked is flagged', /^look:You logged about 0 reps in reserve/.test(r.fail), r.fail);
    await p.close();

    // a lift's own page
    p = await t.fresh();
    await seed(p, { pr: { qz: 1 }, act: '', ms: {}, cx: {}, ax: {}, wo: {
      a: wo('a', '', -1, -1, 400, [{ e: 'bb-bench', s: [{ w: 205, r: 7 }] }]),
      b: wo('b', '', -1, -1, 300, [{ e: 'bb-bench', s: [{ w: 195, r: 9 }] }]),
      c: wo('c', '', -1, -1, 200, [{ e: 'bb-bench', s: [{ w: 255, r: 1 }] }]),
      d: wo('d', '', -1, -1, 3, [{ e: 'bb-bench', s: [{ w: 45, r: 14, wu: 1 }, { w: 185, r: 12 }, { w: 185, r: 10 }] }]) } });
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="sub"][data-v="lifts"]');
    await p.evaluate(() => { const b = document.querySelector('[data-t="exsheet"][data-e="bb-bench"]'); if (b) b.click(); });
    r = await p.evaluate(() => ({ tabs: [...document.querySelectorAll('[data-t="extab"]')].map((b) => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(','),
      rows: document.querySelectorAll('.tr-hs').length, head: (document.querySelector('.tr-hs-d') || {}).textContent || '',
      e1: [...document.querySelectorAll('.tr-hs')][0].querySelectorAll('.tr-hs-e')[1].textContent }));
    t.ok('a lift opens on its own page, About, History, Charts, Records, on History once it has some', r.tabs === 'About,History*,Charts,Records', r.tabs);
    t.ok('History lists every session with its time of day and an estimated max for each working set',
      r.rows === 4 && /\d{1,2}:\d{2} [AP]M/.test(r.head) && r.e1 === '259', JSON.stringify(r));
    await p.click('[data-t="extab"][data-v="records"]');
    r = await p.evaluate(() => [...document.querySelectorAll('.tr-rmx tbody tr')].map((tr) => tr.children[0].textContent + ':' + tr.children[1].childNodes[0].textContent.trim()).join(' '));
    t.ok('Records: the heaviest for at least each number of reps, as Strong lays it out',
      r === '1:255 lb 2:205 lb 3:205 lb 4:205 lb 5:205 lb 6:205 lb 7:205 lb 8:195 lb 9:195 lb 10:185 lb 11:185 lb 12:185 lb', r);
    r = await p.evaluate(() => document.querySelectorAll('.tr-sess li').length);
    t.ok('and the records as they fell', r >= 2, r);
    await p.click('[data-t="extab"][data-v="charts"]');
    r = await p.evaluate(() => document.querySelectorAll('.tr-sheet svg.tr-chart').length);
    t.ok('Charts: estimated max, heaviest set and volume', r === 3, r);
    await p.click('[data-t="extab"][data-v="about"]');
    r = await p.evaluate(() => ({ steps: document.querySelectorAll('.tr-howto li').length, dl: (document.querySelector('.tr-dl') || {}).textContent || '' }));
    t.ok('About: how to do it in three steps, what it trains, the bar and the rest', r.steps === 3 && /Chest/.test(r.dl) && /Olympic bar 45 lb/.test(r.dl) && /3:00/.test(r.dl), JSON.stringify(r));
    r = await p.evaluate(() => window.Train._.LIB_LIST.filter((x) => !(window.Train._.HOWTO[x.id] || []).length).map((x) => x.id).join());
    t.ok('every lift in the library has its steps written', r === '', r);
    await p.click('.tr-sheet [data-t="note"]');
    await p.fill('#trNoteU', 'javascript:alert(1)');
    await p.click('[data-t="notesave"]');
    r = await p.evaluate(() => (document.querySelector('.tr-sheet .tr-warn') || {}).textContent || '');
    t.ok('a how-to link that is not a web address is refused', /could not be read/.test(r), r);
    await p.fill('#trNoteU', 'youtube.com/watch?v=abc');
    await p.click('[data-t="notesave"]');
    r = await p.evaluate(() => ({ nt: window.Train._.state().T.nt.nbbbench, sync: JSON.stringify(window.Train._.payload(true).nt || {}) }));
    t.ok('a link without a note is kept, made https, and synced', r.nt && r.nt.u === 'https://youtube.com/watch?v=abc' && !r.nt.t && /youtube/.test(r.sync), JSON.stringify(r));
    await p.evaluate(() => { const b = document.querySelector('[data-t="exsheet"][data-e="bb-bench"]'); if (b) b.click(); });
    await p.click('[data-t="extab"][data-v="about"]');
    r = await p.evaluate(() => { const a = document.querySelector('.tr-howlink'); return a ? a.getAttribute('href') + '|' + a.getAttribute('rel') + '|' + a.getAttribute('target') : ''; });
    t.ok('and shows on the lift’s page, opening safely in a new tab', r === 'https://youtube.com/watch?v=abc|noopener noreferrer|_blank', r);
    await p.close();

    // Strong's drop and failure sets come in as such
    p = await t.fresh();
    r = await p.evaluate(() => {
      const G = window.Train._.sgParse('Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE\n' +
        '"2026-08-01 07:30:00","Push","45m","Bench Press (Barbell)","1","185","8","0","0","","",""\n' +
        '"2026-08-01 07:30:00","Push","45m","Bench Press (Barbell)","D","135","10","0","0","","",""\n' +
        '"2026-08-01 07:30:00","Push","45m","Bench Press (Barbell)","F","135","6","0","0","","",""\n');
      return G.wos[0].x[0].s.map((s) => s.ty || 'n').join();
    });
    t.ok('Strong’s drop and failure sets come in as drop and failure sets', r === 'n,d,f', r);
    await p.close();
    // ---- finishing: the summary, and a celebration ------------------------------
    p = await t.fresh();
    r = await p.evaluate(() => [1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111, 112].map(window.Train._.nth).join());
    t.ok('ordinals read right, 11th to 13th included', r === '1st,2nd,3rd,4th,11th,12th,13th,21st,22nd,101st,111th,112th', r);
    await seed(p, { pr: { qz: 1 }, act: '', ms: {}, cx: {}, ax: {}, wo: {
      a: wo('a', '', -1, -1, 9, [{ e: 'bb-bench', s: [{ w: 225, r: 3 }] }]),
      b: wo('b', '', -1, -1, 6, [{ e: 'bb-bench', s: [{ w: 185, r: 8 }] }]),
      c: wo('c', '', -1, -1, 1, [{ e: 'bb-bench', s: [{ w: 45, r: 10, wu: 1 }, { w: 188, r: 8 }, { w: 190, r: 8 }] }]),
      d: wo('d', '', -1, -1, 0.5, [{ e: 'bb-bench', s: [{ w: 235, r: 3 }, { w: 240, r: 3 }, { w: 240, r: 2 }] }]) } });
    r = await p.evaluate(() => { const _ = window.Train._, w = _.wins(_.state().T.wo.c); return { sets: w.sets, lines: w.lines, big: w.big, ms: w.ms }; });
    t.ok('a set heavier than any before at that many reps is a best for that many reps, and ribboned',
      r.sets['0:2'] === 'best for 8 reps' && !r.sets['0:0'] && r.lines.length === 1, JSON.stringify(r));
    t.ok('only the day’s best set takes it: a second set past the old best is not a second record', !r.sets['0:1'], JSON.stringify(r.sets));
    t.ok('but it is a small win, not a record: no big celebration for it', r.big === false && r.ms.length === 0, JSON.stringify(r));
    r = await p.evaluate(() => window.Train._.wins(window.Train._.state().T.wo.d).sets);
    t.ok('two sets at the same new heaviest: the one with more reps takes the ribbon, and the other is no best for its reps either',
      r['0:1'] === 'heaviest, best e1RM' && !r['0:0'] && !r['0:2'], JSON.stringify(r));
    r = await p.evaluate(() => {
      const _ = window.Train._, ms = _.build({ dpw: 3, kit: 'gym', lvl: 1, acc: 4, pri: [] });
      ms.id = 'blk'; ms.n = 'Test block';
      const wo = {}; let k = 0, last = null;
      const weeks = _.weeksOf(ms), now = Date.now();
      for (let w = 0; w < weeks; w++) for (let d = 0; d < ms.days.length; d++) {
        if (ms.days[d].ez) continue;
        const id = 'b' + (k++), st = now - (200 - k) * 36e5;
        wo[id] = { id, st, en: st + 36e5, dk: '2026-01-01', n: 'W', u: 'lb', ms: 'blk', w, d, dl: 0, x: [], sr: {}, fb: {} };
        last = id;
      }
      const load = () => {
        localStorage.setItem('bsc.train', JSON.stringify({ pr: { qz: 1 }, act: 'blk', ms: { blk: ms }, cx: {}, ax: {}, wo }));
        localStorage.removeItem('bsc.trainStamps');
        _.reload();
        return _.state().T;
      };
      let T = load();
      const out = { fin: _.wins(T.wo[last]).ms.join('|'), mid: _.wins(T.wo.b3).ms.join('|'), done: !_.nextSlot(T.ms.blk) };
      wo.again = Object.assign({}, wo[last], { id: 'again', st: now - 1000, en: now });
      T = load();
      out.again = _.wins(T.wo.again).ms.join('|');
      return out;
    });
    t.ok('the workout that finishes a block says so', /Block complete: Test block/.test(r.fin) && !/Block/.test(r.mid), JSON.stringify(r));
    t.ok('but doing its last day again does not say it twice', !/Block/.test(r.again), JSON.stringify(r));
    await p.close();

    p = await t.fresh();
    await p.emulateMedia({ reducedMotion: 'no-preference' });
    const nine = {};
    for (let i = 0; i < 9; i++) nine['h' + i] = wo('h' + i, '', -1, -1, 20 - i, [{ e: 'bb-bench', s: [{ w: 185, r: 8 }] }]);
    await seed(p, { pr: { qz: 1 }, act: '', ms: {}, cx: {}, ax: {}, wo: nine });
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="empty"]');
    await p.click('[data-t="addex"]');
    await p.click('.tr-pick[data-e="bb-bench"]');
    await p.fill('#trw-0-0', '195'); await p.fill('#trr-0-0', '8');
    await p.click('[data-t="tick"][data-x="0"][data-s="0"]');
    await p.fill('#trw-0-1', '185'); await p.fill('#trr-0-1', '5');
    await p.click('[data-t="tick"][data-x="0"][data-s="1"]');
    await p.click('[data-t="finish"]');
    await p.click('[data-t="save"]');
    await p.waitForSelector('.tr-done');
    r = await p.evaluate(() => ({ h: document.querySelector('.tr-done-h').textContent,
      recs: (document.querySelector('.tr-done-r') || {}).textContent || '',
      rib: [...document.querySelectorAll('.tr-done li.tr-won .tr-ribbon')].map((e) => e.textContent).join('|'),
      plain: document.querySelectorAll('.tr-done li:not(.tr-won)').length,
      stats: [...document.querySelectorAll('.tr-done .tr-rec')].map((e) => e.textContent).join('|'),
      saved: Object.keys(window.Train._.state().T.wo).length, live: !!window.Train._.state().LIVE }));
    t.ok('Save opens a summary: saved first, the sheet after', r.saved === 10 && !r.live, JSON.stringify(r));
    t.ok('headed by the milestone when there is one', r.h === 'Your 10th workout!', r.h);
    t.ok('with the time, the sets, the volume and how many records', /Sets\s*2/.test(r.stats) && /Records\s*1/.test(r.stats) && /Volume/.test(r.stats), r.stats);
    t.ok('the record named with a medal, and its set tagged with a ribbon; the other set left plain',
      /🥇/.test(r.recs) && /Barbell Bench Press/.test(r.recs) && /heaviest/.test(r.recs) && /🥇 heaviest/.test(r.rib) && r.plain === 1, JSON.stringify(r));
    r = await p.evaluate(() => { const c = window.Train._.state().S.cele, cv = document.getElementById('trConfetti');
      return { c, cv: !!cv, pe: cv ? getComputedStyle(cv).pointerEvents : '', pos: cv ? getComputedStyle(cv).position : '' }; });
    t.ok('a record gets the big celebration: confetti and a chime', r.c.big && r.c.confetti === true && r.c.chime === true, JSON.stringify(r.c));
    t.ok('the confetti covers the screen and takes no taps', r.cv && r.pe === 'none' && r.pos === 'fixed', JSON.stringify(r));
    await p.click('.tr-done [data-t="close"]');
    r = await p.evaluate(() => ({ sheet: !!document.querySelector('#trainRoot .sheet'), saved: !!document.querySelector('.tr-saved') }));
    t.ok('Done closes it, back to the page with the saved workout on it', !r.sheet && r.saved, JSON.stringify(r));
    await p.waitForFunction(() => !document.getElementById('trConfetti'), null, { timeout: 5000 });
    t.ok('and the confetti clears itself away', true);
    await p.close();

    // every workout gets a little one; asking the phone for less motion means none
    p = await t.fresh();
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await seed(p, { pr: { qz: 1 }, act: '', ms: {}, cx: {}, ax: {}, wo: {
      a: wo('a', '', -1, -1, 3, [{ e: 'bb-bench', s: [{ w: 225, r: 8 }] }]), b: wo('b', '', -1, -1, 2, [{ e: 'bb-bench', s: [{ w: 225, r: 8 }] }]) } });
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="empty"]');
    await p.click('[data-t="addex"]');
    await p.click('.tr-pick[data-e="bb-bench"]');
    await p.fill('#trw-0-0', '135'); await p.fill('#trr-0-0', '8');
    await p.click('[data-t="tick"][data-x="0"][data-s="0"]');
    await p.click('[data-t="finish"]');
    await p.click('[data-t="save"]');
    await p.waitForSelector('.tr-done');
    r = await p.evaluate(() => ({ h: document.querySelector('.tr-done-h').textContent, c: window.Train._.state().S.cele,
      cv: !!document.getElementById('trConfetti'), ribs: document.querySelectorAll('.tr-done .tr-ribbon').length }));
    t.ok('a workout with no record is still marked: its number, and no ribbons', r.h === 'Workout 3 done' && r.ribs === 0, JSON.stringify(r));
    t.ok('a small celebration, and with less motion asked for, the chime but no confetti', r.c.big === false && r.c.confetti === false && !r.cv && r.c.chime === true, JSON.stringify(r));
    await p.click('.tr-done [data-t="close"]');
    // turned off in Options: just the summary
    await p.evaluate(() => { window.Train._.state().T.pr.yay = 0; });
    await p.click('[data-t="empty"]');
    await p.click('[data-t="addex"]');
    await p.click('.tr-pick[data-e="bb-bench"]');
    await p.fill('#trw-0-0', '315'); await p.fill('#trr-0-0', '3');
    await p.click('[data-t="tick"][data-x="0"][data-s="0"]');
    await p.click('[data-t="finish"]');
    await p.click('[data-t="save"]');
    await p.waitForSelector('.tr-done');
    r = await p.evaluate(() => ({ h: document.querySelector('.tr-done-h').textContent, c: window.Train._.state().S.cele }));
    t.ok('with the celebration turned off there is the summary and nothing else', /record/.test(r.h) && r.c.confetti === false && r.c.chime === false, JSON.stringify(r));
    await p.close();
    // ---- the badge beside each lift: how today compares ------------------------------
    p = await t.fresh();
    await seed(p, { pr: { qz: 1 }, act: '', ms: {}, cx: {}, ax: {}, wo: {
      a: wo('a', '', -1, -1, 3, [{ e: 'bb-bench', s: [{ w: 45, r: 14, wu: 1 }, { w: 185, r: 8 }, { w: 185, r: 8 }, { w: 185, r: 8 }] },
        { e: 'pullup', s: [{ w: 0, r: 8 }, { w: 0, r: 8 }] }]) } });
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="empty"]');
    await p.click('[data-t="addex"]');
    await p.click('.tr-pick[data-e="bb-bench"]');
    const fmAt = () => p.evaluate(() => { const c = document.getElementById('trfm-0'), b = c && c.firstElementChild;
      return { txt: c ? c.textContent : null, cls: b ? b.className : '', tag: b ? b.tagName : '' }; });
    r = await fmAt();
    t.ok('before a working set is done there is no badge: no -100% at the start', r.txt === '', JSON.stringify(r));
    r = await p.evaluate(() => window.Train._.state().LIVE.x[0].s.map((s) => (s.wu ? 'W' : 'n') + (s.pw === null ? '' : s.pw + 'x' + s.pr)).join());
    const wi = r.split(',').findIndex((z) => z[0] === 'n');
    await p.fill(`#trw-0-${wi}`, '195'); await p.fill(`#trr-0-${wi}`, '8');
    await p.click(`[data-t="tick"][data-x="0"][data-s="${wi}"]`);
    r = await fmAt();
    t.ok('after the first working set: volume against the same set last time, 195 × 8 on 185 × 8 is 5% up',
      r.txt === '▲5% vs last' && /up/.test(r.cls) && r.tag === 'BUTTON', JSON.stringify(r));
    await p.click('#trfm-0 [data-t="fmcyc"]');
    r = await p.evaluate(() => ({ txt: document.getElementById('trfm-0').textContent, kept: window.Train._.state().T.pr.fm.nbbbench,
      sync: JSON.stringify(window.Train._.payload(true).pr || {}) }));
    t.ok('tap it for the volume itself', r.txt === '1,560 lb ▲80 vs last', r.txt);
    t.ok('and the lift remembers the choice, synced with your settings', r.kept && r.kept.e === 'bb-bench' && r.kept.m === 'vol' && /"fm"/.test(r.sync), JSON.stringify(r.kept));
    await p.click('#trfm-0 [data-t="fmcyc"]');
    r = await fmAt();
    t.ok('then the reps, level with last time', r.txt === '8 reps = vs last' && /eq/.test(r.cls), JSON.stringify(r));
    await p.click('#trfm-0 [data-t="fmcyc"]');
    r = await fmAt();
    t.ok('then the best set, as an estimated max', r.txt === 'e1RM 247 ▲13 vs last', JSON.stringify(r));
    await p.click('#trfm-0 [data-t="fmcyc"]');
    r = await p.evaluate(() => ({ txt: document.getElementById('trfm-0').textContent, kept: window.Train._.state().T.pr.fm.nbbbench }));
    t.ok('and round to the change in volume, which is the default and not stored', r.txt === '▲5% vs last' && !r.kept, JSON.stringify(r));
    await p.fill(`#trw-0-${wi + 1}`, '175'); await p.fill(`#trr-0-${wi + 1}`, '8');
    await p.click(`[data-t="tick"][data-x="0"][data-s="${wi + 1}"]`);
    r = await fmAt();
    t.ok('set for set: 195 then 175 against 185 twice is level', r.txt === 'level vs last' && /eq/.test(r.cls), JSON.stringify(r));
    await p.fill(`#trw-0-${wi + 1}`, '165');
    r = await fmAt();
    t.ok('correcting a done set moves the badge at once', r.txt === '▼3% vs last' && /dn/.test(r.cls), JSON.stringify(r));
    // the plan, where it asks for less on purpose
    r = await p.evaluate((wi) => {
      const _ = window.Train._, L = _.state().LIVE, a = L.x[0].s[wi], b = L.x[0].s[wi + 1];
      a.tw = 135; a.tr = 8; b.tw = 135; b.tr = 8; L.dl = 1;
      const dl = _.focusOf(0);
      L.dl = 0;
      const cut = _.focusOf(0);
      a.tw = 205; b.tw = 205;
      const up = _.focusOf(0);
      return { dl: dl.plan && dl.was.vol === 2160, cut: cut.plan && cut.was.vol === 2160, up: !up.plan && up.was.vol === 2960 };
    }, wi);
    t.ok('in a deload the plan is what today is held against, not last time', r.dl, JSON.stringify(r));
    t.ok('and so wherever the plan asked for less than last time', r.cut, JSON.stringify(r));
    t.ok('but a plan asking for more is still held against last time', r.up, JSON.stringify(r));
    // bodyweight: the reps, and nothing to tap through
    await p.click('[data-t="addex"]');
    await p.click('.tr-pick[data-e="pullup"]');
    await p.fill('#trr-1-0', '10');
    await p.click('[data-t="tick"][data-x="1"][data-s="0"]');
    r = await p.evaluate(() => { const c = document.getElementById('trfm-1'), b = c && c.firstElementChild; return { txt: c ? c.textContent : '', tag: b ? b.tagName : '' }; });
    t.ok('a bodyweight lift shows its reps, with nothing to tap through', r.txt === '10 reps ▲2 vs last' && r.tag === 'SPAN', JSON.stringify(r));
    // off
    await p.click('[data-t="settings"]');
    await p.click('[data-t="s-fmo"][data-v="0"]');
    await p.click('.sheet-x');
    r = await p.evaluate(() => document.querySelectorAll('.tr-fm').length);
    t.ok('and Settings can turn the badge off', r === 0, r);
    r = await p.evaluate(() => JSON.stringify(window.Train._.defaultsPr({ fm: { a: { e: 'x', m: 'nope' }, b: { e: 'y', m: 'best' }, c: 'junk' } }).fm));
    t.ok('a stored choice that is not one of the four is dropped', r === '{"b":{"e":"y","m":"best"}}', r);
    await p.close();
    // ---- ready workouts: one session in a tap, outside any block ----------------------
    p = await t.fresh();
    await p.click('.tab[data-view="train"]');
    r = await p.evaluate(() => { const q = document.querySelector('.tr-qz-skip'); return q ? q.textContent : ''; });
    t.ok('on the quiz, a ready workout is there beside just logging one', /Pick a ready workout/.test(r) && /Just log a workout/.test(r), r);
    await p.close();
    p = await t.fresh();
    await p.evaluate(() => {
      const _ = window.Train._, ms = _.build({ dpw: 3, kit: 'gym', lvl: 1, acc: 4, pri: [] });
      ms.id = 'blk'; ms.n = 'My block';
      localStorage.setItem('bsc.train', JSON.stringify({ pr: { qz: 1, kit: 'gym' }, act: 'blk', ms: { blk: ms }, cx: {}, ax: {}, wo: {
        a: { id: 'a', st: Date.now() - 3 * 864e5, en: Date.now() - 3 * 864e5 + 36e5, dk: '2026-01-01', n: 'W', u: 'lb', ms: '', w: -1, d: -1, dl: 0,
          x: [{ e: 'bb-squat', s: [{ w: 225, r: 8 }, { w: 225, r: 8 }] }, { e: 'bb-bench', s: [{ w: 185, r: 8 }] }], sr: {}, fb: {} } } }));
      localStorage.removeItem('bsc.trainStamps');
      _.reload();
    });
    await p.click('.tab[data-view="train"]');
    r = await p.evaluate(() => { const f = document.querySelector('.tr-foot'); return f ? f.textContent : ''; });
    t.ok('with a block running, it sits beside logging a workout outside the block', /Pick a ready workout/.test(r) && /outside the block/.test(r), r);
    r = await p.evaluate(() => {
      const _ = window.Train._, T = _.state().T;
      const d = _.readyDay('fba', false, 1), e = _.readyDay('fba', false, 0), h = _.readyDay('fba', false, 2), x = _.readyDay('fba', true, 1);
      const kit = T.pr.kit; T.pr.kit = 'bw'; const bw = _.readyDay('fba', false, 1); T.pr.kit = kit;
      return { n: d.n, sets: [e, d, h].map((z) => z.s.map((s) => s.n).join('')).join('|'), rir: [e.rir, d.rir, h.rir].join(),
        squat: d.s[0].e, xp: x.n, xp2: x.s.every((s) => s.n === 2), xpt: _.estDay({ s: x.s }), xpBig: _.lib(x.s[0].e).k,
        bw: bw.s.length > 0 && bw.s.every((s) => _.lib(s.e).q === 'bw') };
    });
    t.ok('a ready day is the blocks’ own, three sets a lift at two in reserve', r.n === 'Full Body A' && /^3+$/.test(r.sets.split('|')[1]) && r.rir === '3,2,1', JSON.stringify(r));
    t.ok('easy is a set fewer, hard a set more', /^2+$/.test(r.sets.split('|')[0]) && /^4+$/.test(r.sets.split('|')[2]), r.sets);
    t.ok('it picks the lift you already do for a slot, so the weights are yours', r.squat === 'bb-squat', r.squat);
    t.ok('the half-hour version: big lifts first, two sets each, and it fits', r.xp === 'Full Body A · 30 min' && r.xp2 && r.xpt <= 30 && r.xpBig === 'c', JSON.stringify(r));
    t.ok('and it keeps to your kit: bodyweight only means bodyweight lifts', r.bw, JSON.stringify(r));
    await p.click('.tr-foot [data-t="ready"]');
    r = await p.evaluate(() => ({ g: [...document.querySelectorAll('.tr-rdg')].map((e) => e.textContent).join('|'),
      rows: [...document.querySelectorAll('.tr-rdb .tr-rdn')].map((e) => e.textContent).join('|'),
      mins: [...document.querySelectorAll('.tr-rdb .tr-rdt')].every((e) => /^~\d+ min$/.test(e.textContent)) }));
    t.ok('the list: full body, upper and lower, push, pull and legs, each with how long it takes',
      r.g === 'Full body|Upper / lower|Push / pull / legs' && r.rows === 'Full Body A|Full Body B|Full Body C|Upper A|Lower A|Upper B|Lower B|Push|Pull|Legs' && r.mins, JSON.stringify(r));
    await p.click('.tr-rdb[data-v="fba"]');
    r = await p.evaluate(() => ({ q: (document.querySelector('.tr-rdq') || {}).textContent || '', go: [...document.querySelectorAll('.tr-rdgo b')].map((e) => e.textContent).join('|'),
      list: document.querySelectorAll('.tr-rdr.on .tr-rdl li').length }));
    t.ok('opened, it lists every lift and asks how hard today', r.q === 'How hard today?' && r.go === 'Easy|Normal|Hard' && r.list >= 5, JSON.stringify(r));
    await p.click('[data-t="rdgo"][data-v="fba"][data-e="1"]');
    r = await p.evaluate(() => { const L = window.Train._.state().LIVE;
      return { n: L.n, ms: L.ms, sets: L.x.map((x) => x.s.length).join(''), rir: L.x.every((x) => x.rir === 2), sq: L.x[0].e, tw: L.x[0].s[0].tw, sheet: !!document.querySelector('#trainRoot .sheet') }; });
    t.ok('Normal starts it at once: three sets a lift, two in reserve, outside the block', r.n === 'Full Body A' && r.ms === '' && /^3+$/.test(r.sets) && r.rir && !r.sheet, JSON.stringify(r));
    t.ok('with the weight worked out from what you last lifted', r.sq === 'bb-squat' && r.tw === 225, JSON.stringify(r));
    await p.click('[data-t="tick"][data-x="0"][data-s="0"]');
    await p.click('[data-t="tick"][data-x="0"][data-s="1"]');
    await p.fill('#trw-1-0', '135'); await p.fill('#trr-1-0', '10');
    await p.click('[data-t="tick"][data-x="1"][data-s="0"]');
    await p.click('[data-t="finish"]');
    await p.click('[data-t="save"]');
    await p.waitForSelector('.tr-done');
    r = await p.evaluate(() => { const _ = window.Train._, T = _.state().T, w = Object.values(T.wo).sort((a, b) => b.st - a.st)[0];
      return { n: w.n, ms: w.ms, act: T.act, next: JSON.stringify(_.nextSlot(T.ms.blk)) }; });
    t.ok('it is saved as a workout of its own, and the block is where it was', r.n === 'Full Body A' && r.ms === '' && r.act === 'blk' && r.next === '{"w":0,"d":0}', JSON.stringify(r));
    // kept as a routine
    await p.click('.tr-done [data-t="rtsave"]');
    r = await p.evaluate(() => document.getElementById('trRtN').value);
    t.ok('any finished workout can be kept as a routine, named as it was', r === 'Full Body A', r);
    await p.fill('#trRtN', 'Tuesday quickie');
    await p.click('[data-t="rtdo"]');
    r = await p.evaluate(() => { const _ = window.Train._, T = _.state().T, k = Object.keys(T.rt)[0], rt = T.rt[k];
      return { n: rt && rt.n, x: rt && rt.x.map((x) => x.n).join(), ok: rt && _.SHAPE.rt(rt), sync: JSON.stringify(_.payload(true).rt || {}), said: document.querySelector('#trainRoot .sheet').textContent }; });
    t.ok('the routine keeps its lifts in order with the sets you did, and is synced', r.n === 'Tuesday quickie' && r.x === '2,1' && r.ok && /Tuesday quickie/.test(r.sync), JSON.stringify(r));
    t.ok('and says where to find it', /Your routines/.test(r.said), r.said);
    await p.click('#trainRoot .sheet [data-t="close"]');
    await p.click('.tr-foot [data-t="ready"]');
    r = await p.evaluate(() => { const g = [...document.querySelectorAll('.tr-rdg')].map((e) => e.textContent); const nx = document.querySelector('.tr-rdb[data-v^="nx:"] .tr-rdn');
      return { g: g.join('|'), nx: nx ? nx.textContent : '', mine: (document.querySelector('.tr-rdb[data-v^="r"] .tr-rdn') || {}).textContent || '' }; });
    t.ok('next time: Full Body B is next up, after the A you did', /^Next up\|Your routines\|Full body/.test(r.g) && r.nx === 'Full Body B', JSON.stringify(r));
    t.ok('and your routine is listed', r.mine === 'Tuesday quickie', JSON.stringify(r));
    await p.click('.tr-rdb[data-v^="r"]');
    r = await p.evaluate(() => [...document.querySelectorAll('.tr-rdr.on .tr-rdgo small')].map((e) => e.textContent.split(' · ')[0]).join('|'));
    t.ok('a routine’s effort is a set fewer, the sets as saved, or a set more', r === 'a set fewer|sets as saved|a set more', r);
    // a second routine, deleted with two taps
    r = await p.evaluate(() => { const _ = window.Train._, T = _.state().T, w = Object.values(T.wo).sort((a, b) => b.st - a.st)[0]; return _.saveRoutine(w.id, 'Spare'); });
    const spare = r;
    await p.click('.sheet-x');
    await p.click('.tr-foot [data-t="ready"]');
    await p.click(`.tr-rdb[data-v="${spare}"]`);
    await p.click(`[data-t="rtdel"][data-v="${spare}"]`);
    r = await p.evaluate((k) => !!window.Train._.state().T.rt[k], spare);
    t.ok('deleting a routine asks for a second tap', r === true);
    await p.click(`[data-t="rtdel"][data-v="${spare}"]`);
    r = await p.evaluate((k) => ({ gone: !window.Train._.state().T.rt[k], stamped: window.Train._.state().TS.rt[k] > 0 }), spare);
    t.ok('and then it is gone, everywhere', r.gone && r.stamped, JSON.stringify(r));
    await p.click('.tr-rdb[data-v^="r"]');
    await p.click('.tr-rdr.on [data-t="rdgo"][data-e="2"]');
    r = await p.evaluate(() => { const L = window.Train._.state().LIVE; return { n: L.n, sets: L.x.map((x) => x.s.length).join(), rir: L.x[0].rir }; });
    t.ok('Hard on the routine: a set more of each, one in reserve', r.n === 'Tuesday quickie' && r.sets === '3,2' && r.rir === 1, JSON.stringify(r));
    r = await p.evaluate(() => { const S = window.Train._.SHAPE.rt;
      return [S({ n: 'x', x: [{ e: 'bb-bench', n: 3 }] }), S({ n: '', x: [{ e: 'a', n: 3 }] }), S({ n: 'x', x: [] }), S({ n: 'x', x: [{ e: 'a', n: 40 }] })].join(); });
    t.ok('a routine from another device is let in only if it is shaped right', r === 'true,false,false,false', r);
    await p.close();
    // ---- pull-ups, chin-ups and dips count you ---------------------------------------------
    p = await t.fresh();
    r = await p.evaluate(() => {
      const _ = window.Train._, D = 864e5, k = (ago) => { const d = new Date(Date.now() - ago * D); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
      localStorage.setItem('bsc.macroWeights', JSON.stringify({ [k(4)]: 190, [k(20)]: 200 }));
      return { today: _.bwOn(k(0), 'lb'), kg: _.bwOn(k(0), 'kg'), old: _.bwOn(k(18), 'lb'), stale: _.bwOn(k(40), 'lb'), gap: _.bwOn(k(30), 'lb'),
        pu: _.e1Of('pullup', 25, 6, 190), none: _.e1Of('pullup', 0, 10, null), bench: _.e1Of('bb-bench', 185, 8, 190) === _.e1rm(185, 8) };
    });
    t.ok('your weight is the latest weigh-in on or before the day, in the unit you lift in', r.today === 190 && r.kg === 86.2 && r.old === 200, JSON.stringify(r));
    t.ok('and none from more than a fortnight before, rather than a stale guess', r.stale === null && r.gap === null, JSON.stringify(r));
    t.ok('a pull-up counts you plus the belt: 190 + 25 for 6 is an estimated 258', Math.round(r.pu) === 258 && r.none === 0 && r.bench, JSON.stringify(r));
    await seed(p, { pr: { qz: 1 }, act: '', ms: {}, cx: {}, ax: {}, wo: {
      a: wo('a', '', -1, -1, 10, [{ e: 'pullup', s: [{ w: 0, r: 8 }, { w: 0, r: 7 }] }], { bw: 200 }),
      b: wo('b', '', -1, -1, 3, [{ e: 'pullup', s: [{ w: 0, r: 8 }, { w: 0, r: 8 }] }]) } });
    r = await p.evaluate(() => { const _ = window.Train._, T = _.state().T; return { a: _.prsIn(T.wo.a).length, b: _.prsIn(T.wo.b).map((x) => x.what).join(), rec: Math.round(_.records('pullup').e1) }; });
    t.ok('ten pounds lighter for the same reps is no record, and nothing is taken away', r.b === '' && r.rec === Math.round(200 * (1 + 8 / 30)), JSON.stringify(r));
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="empty"]');
    await p.click('[data-t="addex"]');
    await p.click('.tr-pick[data-e="pullup"]');
    await p.fill('#trw-0-0', '15'); await p.fill('#trr-0-0', '8');
    await p.click('[data-t="tick"][data-x="0"][data-s="0"]');
    r = await p.evaluate(() => (document.getElementById('trfm-0') || {}).textContent || '');
    t.ok('the badge keeps to reps on these lifts, belt or no belt', r === '8 reps = vs last', r);
    await p.click('[data-t="finish"]');
    await p.click('[data-t="save"]');
    await p.waitForSelector('.tr-done');
    r = await p.evaluate(() => { const w = Object.values(window.Train._.state().T.wo).sort((a, b) => b.st - a.st)[0];
      return { bw: w.bw, recs: (document.querySelector('.tr-done-r') || {}).textContent || '' }; });
    t.ok('the day’s weight is kept with the workout', r.bw === 190, JSON.stringify(r));
    t.ok('and 190 + 15 for 8 beats 200 for 8: a best estimated max, with its medal', /Pull-Up/.test(r.recs) && /best e1RM/.test(r.recs), r.recs);
    await p.click('.tr-done [data-t="close"]');
    await p.click('[data-t="sub"][data-v="lifts"]');
    await p.evaluate(() => { const b = document.querySelector('[data-t="exsheet"][data-e="pullup"]'); if (b) b.click(); });
    r = await p.evaluate(() => ({ head: [...document.querySelectorAll('.tr-hs-d')].map((e) => e.textContent).join('|'),
      sets: [...document.querySelectorAll('.tr-hs-t td:nth-child(2)')].map((e) => e.textContent).join('|') }));
    t.ok('the lift’s history says what you weighed, and the belt as added', /you 190 lb/.test(r.head) && /you 200 lb/.test(r.head) && /\+15 lb × 8/.test(r.sets), JSON.stringify(r));
    await p.click('[data-t="extab"][data-v="charts"]');
    r = await p.evaluate(() => [...document.querySelectorAll('.tr-chart-h')].map((e) => e.textContent).join('|'));
    t.ok('charts: reps, the estimated max with you in it, and strength × bodyweight', r === 'Best set, in reps|Estimated one-rep max, you + added|Strength × bodyweight', r);
    await p.click('[data-t="extab"][data-v="records"]');
    r = await p.evaluate(() => [...document.querySelectorAll('.tr-rec')].map((e) => e.textContent).join('|'));
    t.ok('records: estimated max, × bodyweight, most added and most reps', /Estimated 1RM260 lb/.test(r) && /× bodyweight1\.37/.test(r) && /Most added\+15 lb/.test(r) && /Most reps8/.test(r), r);
    await p.close();

    // no weigh-ins: reps, as before
    p = await t.fresh();
    await seed(p, { pr: { qz: 1 }, act: '', ms: {}, cx: {}, ax: {}, wo: {
      a: wo('a', '', -1, -1, 10, [{ e: 'dip', s: [{ w: 0, r: 10 }] }]), b: wo('b', '', -1, -1, 3, [{ e: 'dip', s: [{ w: 0, r: 12 }] }]) } });
    r = await p.evaluate(() => { const _ = window.Train._, T = _.state().T; return { rec: _.records('dip').e1, b: _.prsIn(T.wo.b).map((x) => x.what).join() }; });
    t.ok('without a weigh-in a dip is counted in reps, and more reps is still a record', r.rec === 0 && r.b === 'most reps', JSON.stringify(r));
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="sub"][data-v="lifts"]');
    await p.evaluate(() => { const b = document.querySelector('[data-t="exsheet"][data-e="dip"]'); if (b) b.click(); });
    await p.click('[data-t="extab"][data-v="records"]');
    r = await p.evaluate(() => (document.querySelector('.tr-sheet .tr-hint') || {}).textContent || '');
    t.ok('and the lift says how to get a strength number', /Log your weight on Nourish/.test(r), r);
    await p.close();
    // ---- your weight on a pull-up day: asked only when there's no good answer --------------
    p = await t.fresh();
    r = await p.evaluate(() => {
      const _ = window.Train._, D = 864e5, k = (ago) => { const d = new Date(Date.now() - ago * D); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
      const at = (w) => { localStorage.setItem('bsc.macroWeights', JSON.stringify(w)); return _.bwInfo(k(0), 'lb'); };
      return { avg: at({ [k(1)]: 190, [k(3)]: 191, [k(5)]: 192 }), day: at({ [k(0)]: 188, [k(3)]: 191 }), old: at({ [k(9)]: 190 }), none: at({ [k(20)]: 190 }) };
    });
    t.ok('three weigh-ins in the week: their average is your weight, steadier than any one', r.avg.src === 'avg' && r.avg.v === 191, JSON.stringify(r.avg));
    t.ok('fewer, but one today: today’s', r.day.src === 'day' && r.day.v === 188, JSON.stringify(r.day));
    t.ok('only an older one: it counts, but is marked as not to be trusted today', r.old.src === 'old' && r.old.v === 190 && r.none === null, JSON.stringify(r));
    await p.close();

    const bwPage = async (weights) => {
      const q = await t.fresh();
      await q.evaluate((w) => {
        const D = 864e5, k = (ago) => { const d = new Date(Date.now() - ago * D); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
        const o = {}; Object.keys(w).forEach((a) => { o[k(Number(a))] = w[a]; });
        localStorage.setItem('bsc.macroWeights', JSON.stringify(o));
      }, weights);
      await q.reload();
      await q.waitForTimeout(200);
      await seed(q, { pr: { qz: 1 }, act: '', ms: {}, cx: {}, ax: {}, wo: {} });
      await q.click('.tab[data-view="train"]');
      await q.click('[data-t="empty"]');
      await q.click('[data-t="addex"]');
      await q.click('.tr-pick[data-e="bb-bench"]');
      return q;
    };
    const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    // a week of weigh-ins: never asked
    p = await bwPage({ 1: 190, 3: 191, 5: 192 });
    await p.click('[data-t="addex"]');
    await p.click('.tr-pick[data-e="pullup"]');
    r = await p.evaluate(() => !!document.querySelector('.tr-bwq'));
    t.ok('with a week of weigh-ins it doesn’t ask', r === false);
    await p.close();
    // an older one only: asked, and not before a pull-up is in the workout
    p = await bwPage({ 9: 190, 10: 191, 11: 189 });
    r = await p.evaluate(() => !!document.querySelector('.tr-bwq'));
    t.ok('no question on a day with no pull-ups or dips', r === false);
    await p.click('[data-t="addex"]');
    await p.click('.tr-pick[data-e="pullup"]');
    r = await p.evaluate(() => { const c = document.querySelector('.tr-bwq'); return c ? { q: c.querySelector('.tr-sq-l').textContent, sub: c.querySelector('.tr-sub').textContent,
      old: (c.querySelector('[data-t="bwqold"]') || {}).textContent || '' } : null; });
    t.ok('add pull-ups with only an older weigh-in, and it asks what you weigh today', r && r.q === 'What do you weigh today?' && /last weigh-in was 190 lb/.test(r.sub) && /^Use 190 from /.test(r.old), JSON.stringify(r));
    await p.fill('#trBwq', '150');
    await p.click('[data-t="bwqsave"]');
    r = await p.evaluate((k) => ({ warn: (document.querySelector('.tr-bwq .tr-warn') || {}).textContent || '', nourish: (JSON.parse(localStorage.getItem('bsc.macroWeights')) || {})[k] }), today());
    t.ok('a weight far from your average is asked about, with Nourish’s own guard, before anything is written', /That’s 150 lb, against 190 lb lately/.test(r.warn) && r.nourish === undefined, JSON.stringify(r));
    await p.fill('#trBwq', '188.4');
    await p.press('#trBwq', 'Enter');
    r = await p.evaluate((k) => ({ live: window.Train._.state().LIVE.bw, nourish: (JSON.parse(localStorage.getItem('bsc.macroWeights')) || {})[k],
      tuck: (document.querySelector('.tr-bkt [data-t="bwopen"]') || {}).textContent || '', card: !!document.querySelector('.tr-bwq') }), today());
    t.ok('saved, it is today’s weigh-in on Nourish, and this workout’s weight', r.live === 188.4 && r.nourish === 188.4, JSON.stringify(r));
    t.ok('and the question folds to one line you can change', !r.card && /You188\.4 lbChange/.test(r.tuck), JSON.stringify(r));
    r = await p.evaluate((k) => { const H = window.Hive; return { again: H.weigh(k, 187), fix: H.weigh(k, 187.2, { was: 188.4 }) }; }, today());
    t.ok('Nourish never lets it write over a day already weighed, except to correct its own number', r.again.had === 188.4 && r.fix.ok === true, JSON.stringify(r));
    await p.fill('#trr-1-0', '8');
    await p.click('[data-t="tick"][data-x="1"][data-s="0"]');
    await p.click('[data-t="finish"]');
    await p.click('[data-t="save"]');
    await p.waitForSelector('.tr-done');
    r = await p.evaluate(() => Object.values(window.Train._.state().T.wo)[0].bw);
    t.ok('the workout keeps the weight you gave', r === 188.4, r);
    await p.close();
    // Use the older one, or Not now: nothing written to Nourish
    p = await bwPage({ 9: 190 });
    await p.click('[data-t="addex"]');
    await p.click('.tr-pick[data-e="dip"]');
    await p.click('[data-t="bwqold"]');
    r = await p.evaluate((k) => ({ live: window.Train._.state().LIVE.bw, nourish: (JSON.parse(localStorage.getItem('bsc.macroWeights')) || {})[k] }), today());
    t.ok('using the last weigh-in keeps it for the workout but writes nothing new to Nourish', r.live === 190 && r.nourish === undefined, JSON.stringify(r));
    await p.click('[data-t="bwopen"]');
    await p.click('[data-t="bwqskip"]');
    r = await p.evaluate(() => ({ q: window.Train._.state().LIVE.bwq, card: !!document.querySelector('.tr-bwq') }));
    t.ok('and Not now puts the question away for this workout', r.q === 'skip' && !r.card, JSON.stringify(r));
    await p.close();
    // ---- fixes from the two reviews ------------------------------------------------------
    p = await t.fresh();
    // the RP climb says what it actually added
    r = await p.evaluate(() => {
      const _ = window.Train._, ms = _.build({ dpw: 4, kit: 'gym', lvl: 1, acc: 4, pri: [] });
      ms.id = 'blk';
      ms.days[0].s.forEach((s) => { if (_.lib(s.e).m === 'chest') s.n = 6; });
      const W = (id, d, extra) => Object.assign({ id, st: Date.now() - (20 - d) * 864e5, en: Date.now() - (20 - d) * 864e5 + 36e5, dk: '2026-01-01', n: 'W', u: 'lb', ms: 'blk', w: 0, d, dl: 0, x: [], sr: {}, fb: {} }, extra || {});
      localStorage.setItem('bsc.train', JSON.stringify({ pr: { qz: 1 }, act: 'blk', ms: { blk: ms }, cx: {}, ax: {},
        wo: { a0: W('a0', 0, { fb: { chest: { p: 0, k: 0 } } }), b0: W('b0', 1), c0: W('c0', 2, { sr: { chest: 0 } }), d0: W('d0', 3) } }));
      localStorage.removeItem('bsc.trainStamps');
      _.reload();
      const m = _.state().T.ms.blk, p1 = _.plan(m, 1, 0), p0 = _.plan(m, 0, 0);
      const chest = (pl) => pl.x.filter((x) => _.lib(x.e).m === 'chest');
      return { before: chest(p0).map((x) => x.sets).join(), after: chest(p1).map((x) => x.sets).join(), why: chest(p1)[0].why };
    });
    t.ok('at six sets an exercise the climb stops, and the reason says so instead of claiming +2', r.before === '6,6' && r.after === '6,6' && /^Held — .*Held at six sets an exercise/.test(r.why), JSON.stringify(r));
    // program cards
    r = await p.evaluate(() => { const _ = window.Train._; return [_.weeksSay(_.PROGS.waves), _.kitSay(_.PROGS.waves), _.kitSay(_.PROGS.power), _.kitSay(_.PROGS.home), _.weeksSay(_.PROGS.grow)].join('|'); });
    t.ok('the strength waves card says four weeks and a barbell, not “3–3 weeks · home kit”', r === '4 weeks|needs a barbell|needs a barbell|home kit|4–7 weeks', r);
    // Strong: each row its own unit
    r = await p.evaluate(() => {
      const _ = window.Train._; _.state().T.pr.u = 'lb';
      const G = _.sgParse('Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Weight Unit,Reps,Distance,Seconds,Notes,Workout Notes,RPE\n' +
        '"2020-01-01 07:30:00","A","45m","Squat (Barbell)","1","132.5","kg","5","0","0","","",""\n' +
        '"2024-01-01 07:30:00","B","45m","Squat (Barbell)","1","315","lbs","5","0","0","","",""\n');
      return { u: G.unit, fixed: G.fixedUnit, w: G.wos.map((w) => w.x[0].s[0].w).join(), su: G.wos[0].x[0].s[0].su };
    });
    t.ok('a Strong history that changed unit comes in right: 132.5 kg is 292 lb, not 132.5', r.u === 'lb' && r.fixed && r.w === '292,315' && r.su === undefined, JSON.stringify(r));
    // editing after a change of unit keeps the bodyweight right
    await seed(p, { pr: { qz: 1, u: 'lb' }, act: '', ms: {}, cx: {}, ax: {}, wo: {
      a: wo('a', '', -1, -1, 2, [{ e: 'pullup', s: [{ w: 0, r: 8 }] }], { bw: 200 }) } });
    await p.click('.tab[data-view="train"]');
    await p.evaluate(() => { window.Train._.state().T.pr.u = 'kg'; });
    await p.click('[data-t="sub"][data-v="history"]');
    await p.click('.tr-hrow[data-t="wosheet"]');
    await p.click('[data-t="edopen"]');
    await p.click('[data-t="edsave"]');
    r = await p.evaluate(() => { const _ = window.Train._, w = _.state().T.wo.a; return { u: w.u, bw: w.bw, e1: Math.round(_.records('pullup').e1) }; });
    t.ok('a pull-up workout edited after switching to kg keeps you at 90.5 kg, not 200', r.u === 'kg' && r.bw === 90.5 && r.e1 === Math.round(90.5 * (1 + 8 / 30)), JSON.stringify(r));
    await p.close();

    p = await t.fresh();
    await seed(p, { pr: { qz: 1 }, act: '', ms: {}, cx: {}, ax: {}, wo: {
      h: wo('h', '', -1, -1, 5, [{ e: 'bb-bench', s: [{ w: 400, r: 2 }, { w: 315, r: 8 }] }]) } });
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="empty"]');
    await p.click('[data-t="addex"]');
    await p.click('.tr-pick[data-e="bb-bench"]');
    // reps follow today's sets
    await p.fill('#trw-0-0', '320'); await p.fill('#trr-0-0', '8');
    await p.click('[data-t="tick"][data-x="0"][data-s="0"]');
    r = await p.evaluate(() => document.getElementById('trr-0-1').placeholder);
    t.ok('after 320 × 8, the next set expects 8, not the target it just beat', r === '8', r);
    // remove asks twice once a set is done
    await p.click('[data-t="rmex"][data-x="0"]');
    r = await p.evaluate(() => ({ n: window.Train._.state().LIVE.x.length, say: document.querySelector('[data-t="rmex"][data-x="0"]').textContent }));
    t.ok('Remove on a lift with done sets asks again, saying what goes', r.n === 1 && /Tap again: remove it and its 1 done set/.test(r.say), JSON.stringify(r));
    r = await p.evaluate(() => { const b = document.querySelector('.tr-set:not(.tr-set-h) .tr-tick').getBoundingClientRect(); return Math.round(b.height); });
    t.ok('the tick is thumb-sized: 44 px tall', r >= 44, r);
    // warm-ups: to the heaviest working set, and into the log
    await p.fill('#trw-0-1', '315'); await p.fill('#trr-0-1', '3');
    await p.click('[data-t="warm"][data-x="0"]');
    r = await p.evaluate(() => ({ sub: document.querySelector('.tr-sheet .tr-sub').textContent, rows: [...document.querySelectorAll('.tr-warm li b')].map((e) => e.textContent).join('|') }));
    t.ok('the ramp is worked up to the heaviest working set (done or planned), with more steps before heavy work', /heaviest working set, 400 lb/.test(r.sub) && r.rows.split('|').length >= 5 && !/400 lb ×/.test(r.rows), JSON.stringify(r));
    await p.click('[data-t="warmadd"]');
    r = await p.evaluate(() => { const x = window.Train._.state().LIVE.x[0]; return { kinds: x.s.map((s) => (s.wu ? 'W' : s.t ? 'done' : 'n')).join(), ph: document.getElementById('trw-0-1').placeholder, tw: x.s[1].tw }; });
    t.ok('and “Add these as warm-up sets” puts them in the log ahead of the working sets, each showing its own weight',
      /^W,W,W,W/.test(r.kinds) && /done/.test(r.kinds) && r.ph === String(r.tw), JSON.stringify(r));
    // records agree, and warm-ups aren't volume
    await p.evaluate(() => { const L = window.Train._.state().LIVE; L.x[0].s = L.x[0].s.filter((s) => s.t || s.wu); L.x[0].s.forEach((s) => { if (s.wu) { s.w = String(s.tw); s.r = String(s.tr); s.t = Date.now(); } }); });
    await p.evaluate(() => window.Train._.reload && 0);
    await p.click('[data-t="finish"]');
    await p.click('[data-t="save"]');
    await p.waitForSelector('.tr-done');
    r = await p.evaluate(() => { const _ = window.Train._, T = _.state().T, w = Object.values(T.wo).sort((a, b) => b.st - a.st)[0];
      return { h: document.querySelector('.tr-done-h').textContent, recs: [...document.querySelectorAll('.tr-done .tr-rec')].map((e) => e.textContent).join('|'),
        prs: _.prsIn(w).length, vol: _.volOf(w) }; });
    t.ok('a best for its reps is said as that, and not counted as a record the history won’t star',
      r.h === 'A best for its reps!' && /Records0 \+1 rep best/.test(r.recs) && r.prs === 0, JSON.stringify(r));
    t.ok('and the volume is the working sets only', r.vol === 320 * 8 && /Volume2,560 lb/.test(r.recs), JSON.stringify(r));
    await p.close();

    // a wave's end shows the new training maxes; a main lift swapped keeps its day
    p = await t.fresh();
    r = await p.evaluate(() => {
      const _ = window.Train._, ms = _.build({ prog: 'waves', dpw: 4, kit: 'gym', lvl: 2, wave: 10 });
      ms.id = 'wv'; ms.n = 'Waves'; ms.tm = {}; ms.tu = 'lb';
      ms.days.forEach((d) => d.s.forEach((s) => { if (s.m) ms.tm[s.e] = 300; }));
      localStorage.setItem('bsc.train', JSON.stringify({ pr: { qz: 1 }, act: 'wv', ms: { wv: ms }, cx: {}, ax: {}, wo: {} }));
      localStorage.removeItem('bsc.trainStamps');
      _.reload();
      const m = _.state().T.ms.wv, main = m.days[0].s.find((s) => s.m);
      return { html: _.doneNext(m), main: main.e };
    });
    t.ok('the end of a wave shows each lift’s training max for the next one, not RP’s text', /Training max for the next wave/.test(r.html) && !/RP/.test(r.html), r.html.slice(0, 200));
    await p.click('.tab[data-view="train"]');
    await p.evaluate(() => { const b = document.querySelector('[data-t="start"]') || document.querySelector('[data-t="startnext"]'); if (b) b.click(); });
    r = await p.evaluate(() => { const L = window.Train._.state().LIVE; return L ? { fix: !!L.x[0].fix, am: L.x[0].s.some((s) => s.am), tr: L.x[0].s.map((s) => s.tr).join(), e: L.x[0].e } : null; });
    const mainBefore = r;
    if (r && r.fix) {
      const alt = await p.evaluate(() => { const _ = window.Train._, L = _.state().LIVE, ex = _.lib(L.x[0].e);
        return _.LIB_LIST.filter((x) => x.m === ex.m && x.k === 'c' && x.id !== ex.id && x.q === 'bb')[0].id; });
      await p.click('[data-t="swap"][data-x="0"]');
      await p.evaluate((e) => { const b = document.querySelector('.tr-pick[data-e="' + e + '"]'); if (b) b.click(); }, alt);
      r = await p.evaluate(() => { const x = window.Train._.state().LIVE.x[0]; return { e: x.e, fix: !!x.fix, am: x.s.some((s) => s.am), tr: x.s.map((s) => s.tr).join(), swn: x.swn || '' }; });
      t.ok('swapping the main lift keeps its sets and targets (and any all-out set), and says the old lift’s max stays put',
        r.fix && r.am === mainBefore.am && r.tr === mainBefore.tr && /training max stays as it is/.test(r.swn), JSON.stringify({ mainBefore, after: r }));
    } else t.ok('a planned wave session starts with its main lift first', false, JSON.stringify(r));
    await p.close();

    // saving to the account: a failure is shown, not swallowed
    p = await t.fresh();
    await p.click('.tab[data-view="train"]');
    r = await p.evaluate(() => { window.Train._.state().T; return (document.querySelector('[data-t="settings"]') ? 1 : 0); });
    await p.click('[data-t="settings"]');
    r = await p.evaluate(() => (document.querySelector('.tr-sheet') || {}).textContent || '');
    t.ok('signed out, Settings says the training is only on this phone', /Only on this phone/.test(r), r.slice(0, 80));
    await p.click('.sheet-x');
    await p.evaluate(async () => {
      window.Train.attach({ set: () => Promise.reject(new Error('offline')) });
      window.Train.remote({}, true);
      await new Promise((res) => setTimeout(res, 50));
    });
    r = await p.evaluate(() => (document.querySelector('.tr-syncerr') || {}).textContent || '');
    t.ok('a save to the account that fails says so, and that the phone still has it', /Not saved to your account yet/.test(r) && /safe on this phone/.test(r), r);
    await p.evaluate(() => window.Train.attach(null));
    await p.close();

    // ---- someone new to lifting: easier lifts, plain words, and help at the first set ----
    p = await t.fresh();
    r = await p.evaluate(() => {
      const _ = window.Train._, ids = (ms) => ms.days.map((d) => d.s.map((s) => s.e)).flat();
      return { nb: ids(_.build({ prog: 'start', dpw: 3, kit: 'gym', lvl: 0 })), mid: ids(_.build({ prog: 'start', dpw: 3, kit: 'gym', lvl: 1 })),
        home: ids(_.build({ prog: 'start', dpw: 3, kit: 'db', lvl: 0 })) };
    });
    const hard = ['pullup', 'chinup', 'bb-row', 'db-bss', 'belt-squat', 'hip-thrust', 'pallof', 'bb-incline', 'bb-ohp', 'hang-raise'];
    t.ok('new to lifting in a gym: machines, dumbbells and a pulldown, none of the hard-to-learn lifts',
      r.nb.indexOf('lat-pd') >= 0 && r.nb.indexOf('db-rdl') >= 0 && r.nb.indexOf('mc-press') >= 0 && !r.nb.some((e) => hard.indexOf(e) >= 0), r.nb.join());
    t.ok('a year or more in: the barbell lifts, as before', r.mid.indexOf('bb-squat') >= 0 && r.mid.indexOf('bb-bench') >= 0, r.mid.join());
    t.ok('at home with dumbbells, still the two-footed versions first', r.home.indexOf('db-bss') < 0 && r.home.indexOf('goblet') >= 0, r.home.join());
    await p.close();

    // the quiz: "I'm new — choose for me" goes straight to the one program to start with
    p = await t.fresh();
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="qznew"]');
    r = await p.evaluate(() => ({ lvl: window.Train._.state().T.pr.lvl, cards: document.querySelectorAll('.tr-prog').length,
      first: (document.querySelector('.tr-prog .tr-title, .tr-prog h3, .tr-prog') || {}).textContent || '',
      lib: (document.querySelector('[data-t="lib"]') || {}).textContent || '' }));
    t.ok('“I’m new — choose for me” sets you as new and shows only Start here, the others a tap away',
      r.lvl === 0 && r.cards === 1 && /Start here/.test(r.first) && r.lib === 'See other programs', JSON.stringify(r).slice(0, 300));
    await p.close();

    // the first workout, new to lifting
    p = await t.fresh();
    await seed(p, { pr: { qz: 1, lvl: 0 }, act: '', ms: {}, cx: {}, ax: {}, wo: {} });
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="empty"]');
    await p.click('[data-t="addex"]');
    await p.click('.tr-pick[data-e="bb-bench"]');
    r = await p.evaluate(() => { const c = document.querySelector('.tr-ex'); return {
      how1: (document.querySelector('.tr-how1') || {}).textContent || '', first: (c.querySelector('.tr-first:not(.tr-safe)') || {}).textContent || '',
      safe: (c.querySelector('.tr-safe') || {}).textContent || '', howto: !!c.querySelector('[data-t="exhow"]'),
      head: [...c.querySelectorAll('.tr-set-h span')].map((e) => e.textContent).join('|'), meta: c.querySelector('.tr-ex-m').textContent }; });
    t.ok('a card says how a workout goes, once', /How a workout goes/.test(r.how1) && /Tap ✓/.test(r.how1), r.how1.slice(0, 80));
    t.ok('a lift never done says how to find a weight, starting with the bar', /First time on this one\?/.test(r.first) && /just the bar/.test(r.first), r.first);
    t.ok('the bench says to set the safety bars first', /Safety first\..*safety bars/.test(r.safe), r.safe);
    t.ok('and has a How to do it link in view', r.howto);
    t.ok('the columns and the line under the name are in plain words', /Last time/.test(r.head) && /\d+ sets? of 6–10 reps/.test(r.meta) && /Chest/.test(r.meta), JSON.stringify(r));
    await p.click('[data-t="exhow"]');
    r = await p.evaluate(() => { const sh = document.querySelector('.tr-sheet') || document.body, a = [...sh.querySelectorAll('a.tr-howlink')].pop();
      return { tab: (sh.querySelector('.tr-extab [aria-pressed="true"]') || {}).textContent || '', safe: !!sh.querySelector('.tr-safe'),
        href: a ? a.getAttribute('href') : '', rel: a ? a.getAttribute('rel') : '' }; });
    t.ok('How to do it opens the lift on About, with the safety note and a video search', r.tab === 'About' && r.safe &&
      /^https:\/\/www\.youtube\.com\/results\?search_query=Barbell%20Bench%20Press/.test(r.href) && /noopener/.test(r.rel), JSON.stringify(r));
    await p.click('.sheet-x');
    // ticked with nothing to go on: said in words, under the set
    await p.click('[data-t="tick"][data-x="0"][data-s="0"]');
    r = await p.evaluate(() => (document.querySelector('.tr-need') || {}).textContent || '');
    t.ok('a tick with no weight to use says what to type', r === 'Type the weight you used (0 if none), then tick.', r);
    await p.fill('#trw-0-0', '45');
    r = await p.evaluate(() => !!document.querySelector('.tr-need'));
    t.ok('and goes as soon as you type', r === false);
    await p.fill('#trr-0-0', '10');
    await p.click('[data-t="tick"][data-x="0"][data-s="0"]');
    r = await p.evaluate(() => { const c = document.querySelector('.tr-ex'); return { first: !!c.querySelector('.tr-first'), how: !!c.querySelector('[data-t="exhow"]') }; });
    t.ok('once a set is done the before-you-start notes go; How to do it stays for someone new', !r.first && r.how, JSON.stringify(r));
    await p.click('[data-t="hwok"]');
    r = await p.evaluate(() => ({ card: !!document.querySelector('.tr-how1'), hw: window.Train._.state().T.pr.hw }));
    t.ok('Got it puts the how-it-goes card away for good', !r.card && r.hw === 1, JSON.stringify(r));
    await p.evaluate(() => { const L = window.Train._.state().LIVE; L.x[0].s = L.x[0].s.filter((s) => s.t); });
    await p.click('[data-t="finish"]');
    await p.click('[data-t="save"]');
    await p.waitForSelector('.tr-done');
    r = await p.evaluate(() => (document.querySelector('.tr-done') || {}).textContent || '');
    t.ok('the first workout’s summary says personal bests start today, and calls volume Total lifted',
      /Personal bests start today/.test(r) && /Total lifted/.test(r) && !/Volume/.test(r), r.slice(0, 200));
    await p.close();

    // the weight asked for comes with its reason, for someone new; not for anyone else
    for (const lvl of [0, 1]) {
      p = await t.fresh();
      await seed(p, { pr: { qz: 1, lvl }, act: '', ms: {}, cx: {}, ax: {}, wo: { h1: wo('h1', '', 0, 0, 3, [{ e: 'bb-bench', s: sets(135, [10, 10, 10]) }]) } });
      await p.click('.tab[data-view="train"]');
      await p.click('[data-t="empty"]');
      await p.click('[data-t="addex"]');
      await p.click('.tr-pick[data-e="bb-bench"]');
      r = await p.evaluate(() => { const c = document.querySelector('.tr-ex'); return { txt: c.querySelector('.tr-ex-h').textContent, first: !!c.querySelector('.tr-first'),
        how: !!c.querySelector('[data-t="exhow"]'), head: c.querySelector('.tr-set-h').textContent }; });
      if (lvl === 0) t.ok('new to lifting: “Up 5 lb: you reached the top of the range last time”', /Up 5 lb: you reached the top of the range last time/.test(r.txt), r.txt);
      else t.ok('otherwise no reason line, no first-time notes on a lift you have done, and Previous', !/Up 5 lb/.test(r.txt) && !r.first && !r.how && /Previous/.test(r.head), JSON.stringify(r));
      await p.close();
    }

    // trained today already, the next session works the same muscles: said, not enforced
    p = await t.fresh();
    r = await p.evaluate(() => {
      const _ = window.Train._, ms = _.build({ prog: 'start', dpw: 3, kit: 'gym', lvl: 1 });
      ms.id = 'st'; ms.n = 'Start here';
      const pl = _.plan(ms, 0, 0);
      const now = Date.now(), done = { id: 'td', st: now - 3600e3, en: now - 60e3, dk: '', n: 'Lunch', u: 'lb', ms: '', w: 0, d: 0, dl: 0, sr: {}, fb: {},
        x: pl.x.slice(0, 3).map((x) => ({ e: x.e, s: [{ w: 100, r: 8, t: now - 1800e3 }] })) };
      localStorage.setItem('bsc.train', JSON.stringify({ pr: { qz: 1 }, act: 'st', ms: { st: ms }, cx: {}, ax: {}, wo: { td: done } }));
      localStorage.removeItem('bsc.trainStamps');
      _.reload();
      return _.restNote(pl);
    });
    t.ok('trained today already: the Next card says the same muscles are better tomorrow', /better tomorrow/.test(r), r);
    await p.click('.tab[data-view="train"]');
    r = await p.evaluate(() => (document.querySelector('.tr-next') || {}).textContent || '');
    t.ok('shown on the block’s Next card, with Start still there', /better tomorrow/.test(r) && /Start workout/.test(r), r.slice(0, 120));
    await p.close();

    // your weight: Don't ask again, and the switch for it in Settings
    p = await bwPage({ 9: 190 });
    await p.click('[data-t="addex"]');
    await p.click('.tr-pick[data-e="pullup"]');
    await p.click('[data-t="bwqnever"]');
    r = await p.evaluate(() => ({ card: !!document.querySelector('.tr-bwq'), nobw: window.Train._.state().T.pr.nobw }));
    t.ok('Don’t ask again puts the weigh-in question away for good', !r.card && r.nobw === 1, JSON.stringify(r));
    await p.click('[data-t="settings"]');
    r = await p.evaluate(() => (document.querySelector('[data-t="s-nobw"][aria-pressed="true"]') || {}).textContent || '');
    t.ok('and Settings shows it, to switch back', r === 'Don’t ask', r);
    await p.close();

    // ---- a lifetime of workouts: a record a year in the account -------------------------
    /* A stand-in for the account: the one record, the records under it, and
       Firestore's delete marker. `deny` is the database before the rule for
       the yearly records is published. */
    const fakeAcct = () => {
      window.__acct = { main: {}, yrs: {}, writes: [], deny: false };
      const A = window.__acct, DEL = { __del: 1 };
      const put = (to, from) => { Object.keys(from).forEach((k) => {
        const v = from[k];
        if (v === DEL) delete to[k];
        else if (v && typeof v === 'object' && !Array.isArray(v) && to[k] && typeof to[k] === 'object') put(to[k], v);
        else to[k] = JSON.parse(JSON.stringify(v, (kk, vv) => (vv === DEL ? undefined : vv)));
      }); };
      const cut = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v === DEL ? '(deleted)' : v)));
      const snap = () => ({ metadata: { fromCache: false }, forEach: (fn) => Object.keys(A.yrs).forEach((y) => fn({ id: y, data: () => JSON.parse(JSON.stringify(A.yrs[y])) })) });
      A.doc = {
        set: (d) => { A.writes.push(['main', cut(d)]); put(A.main, d); return Promise.resolve(); },
        collection: () => ({
          doc: (y) => ({ set: (d) => { if (A.deny) return Promise.reject({ code: 'permission-denied' }); A.writes.push([y, cut(d)]); A.yrs[y] = A.yrs[y] || {}; put(A.yrs[y], d); return Promise.resolve(); } }),
          onSnapshot: (o, next, err) => { setTimeout(() => (A.deny ? err({ code: 'permission-denied' }) : next(snap())), 10); return () => {}; },
        }),
      };
      A.fv = { delete: () => DEL };
    };
    const acctSeed = async (q, deny) => {
      await q.evaluate(({ fake, deny }) => {
        eval('(' + fake + ')')();
        window.__acct.deny = deny;
        const now = Date.now(), at = (y, m) => new Date(y, m, 10, 18).getTime();
        const mk = (id, st) => ({ id, st, en: st + 3600e3, dk: '', n: 'W', u: 'lb', ms: '', w: 0, d: 0, dl: 0, sr: {}, fb: {}, x: [{ e: 'bb-bench', s: [{ w: 135, r: 8, t: st + 60e3 }] }] });
        const wo = { a24: mk('a24', at(2024, 3)), b25: mk('b25', at(2025, 5)), c26: mk('c26', now - 864e5) };
        const ts = { a24: 1000, b25: 2000, c26: 3000 };
        localStorage.setItem('bsc.train', JSON.stringify({ pr: { qz: 1 }, act: '', ms: {}, cx: {}, ax: {}, nt: {}, rt: {}, wo }));
        localStorage.setItem('bsc.trainStamps', JSON.stringify({ pr: 1, act: 1, ms: {}, wo: ts, cx: {}, ax: {}, nt: {}, rt: {} }));
        window.Train._.reload();
        // the one record, as an older version of the app left it
        const tr = { wo: {} };
        Object.keys(wo).forEach((k) => { tr.wo[k] = { v: wo[k], at: ts[k] }; });
        window.__acct.main = { train: JSON.parse(JSON.stringify(tr)) };
        window.Train.attach(window.__acct.doc, window.__acct.fv);
        window.Train.remote(tr, true);
      }, { fake: fakeAcct.toString(), deny });
      await q.waitForTimeout(1300);
    };
    // before the rule is published: all in the one record, as it always was
    p = await t.fresh();
    await acctSeed(p, true);
    r = await p.evaluate(() => { const A = window.__acct, Y = window.Train._.yr();
      return { on: Y.on, yrs: Object.keys(A.yrs), main: Object.keys(A.main.train.wo).sort().join(), err: window.Train._.state().S && 0 }; });
    t.ok('with the yearly rule not yet published, the workouts stay in the one record and nothing fails', r.on === false && !r.yrs.length && r.main === 'a24,b25,c26', JSON.stringify(r));
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="settings"]');
    r = await p.evaluate(() => (document.querySelector('.tr-sheet') || {}).textContent || '');
    t.ok('and Settings says what one database rule would change', /of the 1 MB record your account keeps them in/.test(r) && /SETUP\.md, step 4/.test(r) && !/Not saved/.test(r), r.slice(r.indexOf('Your training data'), r.indexOf('Your training data') + 300));
    await p.close();

    // published: every workout goes to its year, and only then leaves the one record
    p = await t.fresh();
    await acctSeed(p, false);
    r = await p.evaluate(() => { const A = window.__acct, Y = window.Train._.yr(), order = A.writes.map((w) => w[0]);
      return { on: Y.on, yrs: Object.keys(A.yrs).sort().join(), y24: Object.keys((A.yrs['2024'] || {}).wo || {}).join(), y26: Object.keys((A.yrs[String(new Date(Date.now() - 864e5).getFullYear())] || {}).wo || {}).join(),
        main: Object.keys((A.main.train || {}).wo || {}).join(), order: order.join(), lastMain: order.lastIndexOf('main'), firstYear: Math.min(...['2024', '2025'].map((y) => order.indexOf(y))) }; });
    t.ok('published: each workout is copied into its year’s record', r.on === true && /2024/.test(r.yrs) && /2025/.test(r.yrs) && r.y24 === 'a24' && /c26/.test(r.y26), JSON.stringify(r));
    t.ok('and only after that is it taken out of the one record, which ends up holding none', r.main === '' && r.firstYear >= 0 && r.lastMain > r.firstYear, JSON.stringify(r));
    // a new session: nothing that the years already hold is sent again
    r = await p.evaluate(async () => { const A = window.__acct; A.writes = [];
      window.Train.attach(A.doc, A.fv); window.Train.remote(A.main.train, true);
      await new Promise((res) => setTimeout(res, 1300));
      return A.writes.filter((w) => w[0] !== 'main' && Object.keys(w[1].wo || {}).length).length; });
    t.ok('the next time the app opens, workouts the years already hold are not sent again', r === 0, r);
    // deleting a workout deletes it from its year's record
    r = await p.evaluate(async () => { const A = window.__acct; window.Train._.dropWo('a24');
      await new Promise((res) => setTimeout(res, 1300));
      return { y: A.yrs['2024'].wo.a24, main: ((A.main.train || {}).wo || {}).a24 }; });
    t.ok('a deleted workout is deleted in its own year’s record', r.y && r.y.v === null && !r.main, JSON.stringify(r));
    // a phone on the old version puts workouts back in the one record: moved again, never lost
    r = await p.evaluate(async () => { const A = window.__acct, T = window.Train._.state().T;
      const b = JSON.parse(JSON.stringify(T.wo.b25)); b.n = 'Edited on the old phone';
      const tr = { wo: { b25: { v: b, at: 9999999999999 } } };
      A.main.train.wo = tr.wo; window.Train.remote(JSON.parse(JSON.stringify(tr)), true);
      await new Promise((res) => setTimeout(res, 1300));
      return { here: T.wo.b25.n, y: A.yrs['2025'].wo.b25.v.n, main: Object.keys(A.main.train.wo).join() }; });
    t.ok('an edit an older version put in the one record wins, moves to its year, and leaves the one record', r.here === 'Edited on the old phone' && r.y === r.here && r.main === '', JSON.stringify(r));
    r = await p.evaluate(async () => { const A = window.__acct, T = window.Train._.state().T;
      const tr = { wo: { c26: { v: null, at: 9999999999999 } } };
      A.main.train.wo = JSON.parse(JSON.stringify(tr.wo)); window.Train.remote(tr, true);
      await new Promise((res) => setTimeout(res, 1300));
      const y = String(new Date(Date.now() - 864e5).getFullYear());
      return { here: !!T.wo.c26, y: A.yrs[y].wo.c26 }; });
    t.ok('and a workout an older version deleted is deleted in its year’s record too', !r.here && r.y && r.y.v === null, JSON.stringify(r));
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="settings"]');
    r = await p.evaluate(() => (document.querySelector('.tr-sheet') || {}).textContent || '');
    t.ok('Settings says they are kept a year to a record, with no limit', /kept a year to a record in your account \(2024, 2025/.test(r) && /no limit on how far back/.test(r), r.slice(r.indexOf('Your training data'), r.indexOf('Your training data') + 300));
    // sizes: a year's record holds about three years of normal training
    r = await p.evaluate(() => { const _ = window.Train._, mk = (i, y) => ({ id: 'z' + y + 'n' + i, st: new Date(y, 0, 1).getTime() + i * 36e5, u: 'lb', x: Array.from({ length: 6 }, () => ({ e: 'bb-bench', s: Array.from({ length: 4 }, () => ({ w: 185.5, r: 8, t: 1e12, q: 2 })) })) });
      const year = (y, n) => Array.from({ length: n }, (_, i) => mk(i, y));
      return { ok: _.fitSay(year(2019, 250).concat(year(2020, 250))), big: _.fitSay(year(2018, 800)) }; });
    t.ok('by year: a year of 250 workouts fits, and more than a record can hold in one year is refused, naming it', r.ok === '' && /More workouts in 2018/.test(r.big), JSON.stringify(r));
    await p.close();

    // in the one record: a big import is refused before anything is written
    p = await t.fresh();
    await acctSeed(p, true);
    r = await p.evaluate(() => { const _ = window.Train._, mk = (i) => ({ id: 'z' + i, st: Date.now() - i * 864e5, u: 'lb', x: Array.from({ length: 6 }, () => ({ e: 'bb-bench', s: Array.from({ length: 4 }, () => ({ w: 185.5, r: 8, t: 1e12, q: 2 })) })) });
      return _.fitSay(Array.from({ length: 600 }, (x, i) => mk(i))); });
    t.ok('in the one record, an import that would pass its limit is refused and says what would lift it', /one record of 1 MB/.test(r) && /SETUP\.md, step 4/.test(r), r);
    await p.close();

    // this phone's storage full: said, not swallowed
    p = await t.fresh();
    await seed(p, { pr: { qz: 1 }, act: '', ms: {}, cx: {}, ax: {}, wo: {} });
    await p.click('.tab[data-view="train"]');
    await p.evaluate(() => { const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { if (k === 'bsc.train') { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } return real.call(this, k, v); }; });
    await p.click('[data-t="empty"]');
    await p.click('[data-t="addex"]');
    await p.click('.tr-pick[data-e="bb-bench"]');
    await p.fill('#trw-0-0', '95');
    await p.fill('#trr-0-0', '8');
    await p.click('[data-t="tick"][data-x="0"][data-s="0"]');
    await p.evaluate(() => { const L = window.Train._.state().LIVE; L.x[0].s = L.x[0].s.filter((s) => s.t); });
    await p.click('[data-t="finish"]');
    await p.click('[data-t="save"]');
    await p.waitForSelector('.tr-done');
    await p.click('.tr-done [data-t="close"]');
    r = await p.evaluate(() => ({ full: window.Train._.lsFull(), say: (document.querySelector('.tr-lsfull') || {}).textContent || '' }));
    t.ok('when the phone’s storage is full it says so, and what to do', r.full === true && /storage for the app is full/.test(r.say) && /Export a copy/.test(r.say), JSON.stringify(r));
    await p.close();

    // ---- for the serious lifter: misses, assisted lifts, two deadlifts, RPE, a spreadsheet ----
    p = await t.fresh();
    r = await p.evaluate(() => {
      const _ = window.Train._, ids = [];
      ['start', 'grow', 'keep', 'waves', 'power'].forEach((prog) => [0, 1, 2].forEach((lvl) => ['gym', 'bar', 'db'].forEach((kit) => [0, 1, 2, 3].forEach((seed) => {
        try { const ms = _.build({ prog, dpw: 4, kit, lvl, seed }); ms.days.forEach((d) => d.s.forEach((x) => ids.push(x.e))); } catch (e) { /* not for this kit */ }
      }))));
      return { n: ids.length, bad: ids.filter((e) => ['sumo-dl', 'trap-dl', 'as-pullup', 'as-dip'].indexOf(e) >= 0),
        lib: ['sumo-dl', 'trap-dl', 'as-pullup', 'as-dip'].map((e) => _.lib(e).n).join('|'), bar: _.barFor('trap-dl') };
    });
    t.ok('sumo and trap-bar deadlifts and the assisted pull-up and dip are in the library', r.lib === 'Sumo Deadlift|Trap-Bar Deadlift|Assisted Pull-Up|Assisted Dip', r.lib);
    t.ok('and never chosen for a program on their own', r.n > 500 && !r.bad.length, JSON.stringify({ n: r.n, bad: r.bad.slice(0, 5) }));
    t.ok('the trap bar starts as the hex bar', r.bar === 75, r.bar);
    await p.close();

    // a missed attempt: kept, never counted
    p = await t.fresh();
    await seed(p, { pr: { qz: 1 }, act: '', ms: {}, cx: {}, ax: {}, wo: {
      m1: wo('m1', '', 0, 0, 8, [{ e: 'bb-bench', s: sets(225, [5, 5, 5]) }]),
      m2: wo('m2', '', 0, 0, 4, [{ e: 'bb-bench', s: [{ w: 225, r: 5, t: 1e12 }, { w: 315, r: 0, t: 1e12 + 1, ty: 'm' }] }]),
    } });
    r = await p.evaluate(() => { const _ = window.Train._, T = _.state().T, rec = _.records('bb-bench');
      return { kept: T.wo.m2 && T.wo.m2.x[0].s.length, w: rec.w, e1: Math.round(rec.e1), vol: _.volOf(T.wo.m2), prs: _.prsIn(T.wo.m2).length,
        tw: _.target(_.lib('bb-bench'), null, 0, 0, false).tw, prev: _.target(_.lib('bb-bench'), null, 0, 0, false).prev.length }; });
    t.ok('a missed 315 is kept with the workout', r.kept === 2, JSON.stringify(r));
    t.ok('and is not a record, not volume, and not what next time is worked from', r.w === 225 && r.e1 === 263 && r.vol === 1125 && r.prs === 0 && r.tw === 225 && r.prev === 1, JSON.stringify(r));
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="empty"]');
    await p.click('[data-t="addex"]');
    await p.click('.tr-pick[data-e="bb-bench"]');
    await p.click('[data-t="sty"][data-x="0"][data-s="1"]');
    r = await p.evaluate(() => (document.querySelector('.tr-sheet') || document.body).textContent);
    t.ok('Missed is one of the kinds of set, and says what it means', /Missed/.test(r) && /never a record, never counted/.test(r), r.slice(0, 120));
    await p.click('[data-t="styset"][data-v="m"]');
    await p.fill('#trw-0-1', '315');
    await p.click('[data-t="tick"][data-x="0"][data-s="1"]');
    r = await p.evaluate(() => { const s = window.Train._.state().LIVE.x[0].s[1]; return { t: !!s.t, r: s.r, w: s.w, lab: document.querySelector('.tr-set.tr-mm .tr-snb').textContent }; });
    t.ok('ticked with no reps, a missed attempt is done at 0 reps, marked M', r.t && r.r === 0 && r.w === 315 && r.lab === 'M', JSON.stringify(r));
    r = await p.evaluate(() => { const _ = window.Train._; return _.ghost(0, 2); });
    t.ok('and the set after it follows the plan, not the miss', r.r > 0 && r.w !== 315, JSON.stringify(r));
    await p.close();

    // assisted: you, less the help; less help is the step forward
    p = await t.fresh();
    await p.evaluate(() => {
      const D = 864e5, k = (ago) => { const d = new Date(Date.now() - ago * D); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
      const w = {}; [1, 2, 3, 5, 6, 8, 9, 10].forEach((a) => { w[k(a)] = 200; });
      localStorage.setItem('bsc.macroWeights', JSON.stringify(w));
    });
    await seed(p, { pr: { qz: 1 }, act: '', ms: {}, cx: {}, ax: {}, wo: {
      a1: wo('a1', '', 0, 0, 7, [{ e: 'as-pullup', s: sets(60, [10, 9, 8]) }], { bw: 200 }),
      a2: wo('a2', '', 0, 0, 2, [{ e: 'as-pullup', s: sets(50, [12, 12, 12]) }], { bw: 200 }),
    } });
    r = await p.evaluate(() => { const _ = window.Train._, T = _.state().T, rec = _.records('as-pullup'), tg = _.target(_.lib('as-pullup'), null, 0, 0, false);
      return { e1: Math.round(rec.e1), w: rec.w, vol: _.volOf(T.wo.a2), tw: tg.tw, tr: tg.tr, won: _.wins(T.wo.a2).lines.map((l) => l.what).join('|') }; });
    t.ok('an assisted pull-up counts you less the help: 200 lb, 50 lb of help, 12 reps', r.e1 === Math.round(150 * (1 + 12 / 30)), JSON.stringify(r));
    t.ok('the help is never a heaviest or a volume', r.w === 0 && r.vol === 0 && !/heaviest/.test(r.won), JSON.stringify(r));
    t.ok('top of the range on every set: next time asks for less help', r.tw === 45 && r.tr === 10, JSON.stringify(r));
    await p.close();

    // RPE, if you would rather
    p = await t.fresh();
    await seed(p, { pr: { qz: 1, rq: 1, eff: 'rpe' }, act: '', ms: {}, cx: {}, ax: {}, wo: {} });
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="empty"]');
    await p.click('[data-t="addex"]');
    await p.click('.tr-pick[data-e="bb-squat"]');
    r = await p.evaluate(() => ({ head: document.querySelector('.tr-ex .tr-set-h').textContent,
      opts: [...document.querySelectorAll('.tr-rqs')[0].options].map((o) => o.textContent).join(',') }));
    t.ok('with RPE chosen, each set asks RPE by half steps', /RPE/.test(r.head) && r.opts === '–,10,9.5,9,8.5,8,7.5,7,6,≤5', JSON.stringify(r));
    await p.selectOption('.tr-rqs >> nth=0', '0.5');
    await p.fill('#trw-0-0', '275');
    await p.fill('#trr-0-0', '3');
    await p.click('[data-t="tick"][data-x="0"][data-s="0"]');
    await p.evaluate(() => { const L = window.Train._.state().LIVE; L.x[0].s = L.x[0].s.filter((s) => s.t); });
    await p.click('[data-t="finish"]');
    await p.click('[data-t="save"]');
    await p.waitForSelector('.tr-done');
    r = await p.evaluate(() => { const T = window.Train._.state().T, w = Object.values(T.wo)[0]; return { q: w.x[0].s[0].q }; });
    t.ok('RPE 9.5 is kept as half a rep in reserve, the one scale underneath', r.q === 0.5, JSON.stringify(r));
    await p.click('.tr-done [data-t="close"]');
    await p.click('[data-t="settings"]');
    r = await p.evaluate(() => (document.querySelector('[data-t="s-eff"][aria-pressed="true"]') || {}).textContent || '');
    t.ok('and Settings has the switch', r === 'RPE', r);
    await p.close();

    // a spreadsheet of every set, that Strong's importer (and this one) reads back
    p = await t.fresh();
    await seed(p, { pr: { qz: 1 }, act: '', ms: {}, cx: {}, ax: {}, wo: {
      c1: wo('c1', '', 0, 0, 3, [{ e: 'bb-squat', s: [{ w: 135, r: 5, t: 1e12, wu: 1 }, { w: 225, r: 5, t: 1e12 + 1, q: 2 }, { w: 245, r: 0, t: 1e12 + 2, ty: 'm' }] },
        { e: 'as-pullup', s: sets(40, [8]) }], { nt: 'Felt good, "legs" day' }),
    } });
    r = await p.evaluate(() => { const _ = window.Train._, csv = _.woCsv(), rows = _.csvRows(csv), G = _.sgParse(csv);
      return { head: rows[0].slice(0, 12).join(','), n: rows.length, row2: rows[2].join('|'), miss: rows[3].join('|'),
        back: G.err || G.wos.length + ':' + G.wos[0].x.map((x) => x.nm + '=' + x.s.length).join(','), match: G.names.map((n) => n.e).join(',') }; });
    t.ok('the spreadsheet has Strong’s columns, with the unit on every row', r.head === 'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Weight Unit,Reps,Distance,Seconds,Notes,Workout Notes', r.head);
    t.ok('a row a set: warm-up W, RPE and RIR both, and the workout note quoted', r.n === 5 && /\|1\|225\|lbs\|5\|/.test(r.row2) && /\|8\|2\|Working set\|/.test(r.row2) && /Felt good, "legs" day/.test(r.row2), JSON.stringify(r));
    t.ok('a missed attempt says so', /Missed attempt/.test(r.miss) && /\|245\|lbs\|0\|/.test(r.miss), r.miss);
    t.ok('and Bring in from Strong reads it back, lifts matched by name (the missed attempt left out, as Strong would)', r.back === '1:Back Squat=2,Assisted Pull-Up=1' && r.match.split(',').sort().join() === 'as-pullup,bb-squat', JSON.stringify(r));
    r = await p.evaluate(() => { const G = window.Train._.sgParse('Date,Workout Name,Exercise Name,Set Order,Weight,Reps,RPE\n2026-01-05 18:00:00,Pull,Deadlift (Barbell),1,405,3,8.5\n');
      return G.wos[0].x[0].s[0].q; });
    t.ok('an RPE of 8.5 comes in as one and a half in reserve, not rounded', r === 1.5, r);
    await p.close();

    // ---- import from any app, or any spreadsheet ------------------------------------------
    p = await t.fresh();
    r = await p.evaluate(() => {
      const _ = window.Train._, sum = (G) => G.err || G.need || (G.app + ' ' + G.unit + (G.fixedUnit ? '!' : '?') + ' ' + G.wos.map((w) => new Date(w.st).toString().slice(4, 21) + ' ' +
        Math.round((w.dur || 0) / 60000) + 'm ' + w.x.map((x) => x.nm + '=' + x.s.map((z) => z.w + 'x' + z.r + (z.wu ? 'W' : z.ty || '') + (z.q !== undefined ? '@' + z.q : '')).join('/')).join(' ')).join(' | '));
      const hevy = _.sgParse('"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_lbs","reps","distance_miles","duration_seconds","rpe"\n' +
        '"Push","24 Sep 2024, 18:30","24 Sep 2024, 19:35","Good one","Bench Press (Barbell)",,"",0,"warmup",95,10,,,\n' +
        '"Push","24 Sep 2024, 18:30","24 Sep 2024, 19:35","Good one","Bench Press (Barbell)",,"",1,"normal",185,8,,,8.5\n' +
        '"Push","24 Sep 2024, 18:30","24 Sep 2024, 19:35","Good one","Bench Press (Barbell)",,"",2,"failure",185,6,,,\n' +
        '"Push","24 Sep 2024, 18:30","24 Sep 2024, 19:35","Good one","Plank",,"",0,"normal",,,,60,\n');
      const fitbod = _.sgParse('Date,Exercise,Reps,Weight(kg),Duration(s),Distance(m),Incline,Resistance,isWarmup,Note,multiplier\n' +
        '2024-09-24 18:30:00 +0000,Barbell Bench Press,10,40,0,0,0,0,true,,1\n2024-09-24 18:30:00 +0000,Barbell Bench Press,8,80,0,0,0,0,false,,1\n');
      const fitnotes = _.sgParse('Date,Exercise,Category,Weight (lbs),Reps,Distance,Distance Unit,Time,Comment\n' +
        '2024-09-24,Flat Barbell Bench Press,Chest,185.0,8,,,,\n2024-09-24,Flat Barbell Bench Press,Chest,185.0,7,,,,\n2024-09-25,Barbell Squat,Legs,225.0,5,,,,\n');
      return { hevy: sum(hevy), hevyE: hevy.names.map((n) => n.e).join(), fitbod: sum(fitbod), fitbodE: fitbod.names.map((n) => n.e).join(), fitbodT: fitbod.wos[0].st === Date.UTC(2024, 8, 24, 18, 30),
        fitnotes: sum(fitnotes), fitnotesE: fitnotes.names.map((n) => n.e).sort().join() };
    });
    t.ok('Hevy: recognised, its warm-ups and failure sets kept, the length from start to end, RPE 8.5 as 1.5, a timed plank left out',
      /^Hevy lb! Sep 24 2024 18:30 65m Bench Press \(Barbell\)=95x10W\/185x8@1\.5\/185x6f$/.test(r.hevy) && r.hevyE === 'bb-bench', JSON.stringify(r));
    t.ok('Fitbod: recognised, in kg, its UTC time read as UTC, warm-ups kept', /^Fitbod kg! .* Barbell Bench Press=40x10W\/80x8$/.test(r.fitbod) && r.fitbodE === 'bb-bench' && r.fitbodT, JSON.stringify(r));
    t.ok('FitNotes: recognised, one workout a day, plain lift names matched', /^FitNotes lb! /.test(r.fitnotes) && r.fitnotes.split(' | ').length === 2 && r.fitnotesE === 'bb-bench,bb-squat', JSON.stringify(r));
    r = await p.evaluate(() => { const _ = window.Train._, d = (s, o) => { const t = _.imDate(s, o); return t ? new Date(t).toString().slice(4, 21) : null; };
      return [d('45559'), d('Sep 24, 2024 6:30 PM'), d('24.09.2024'), d('03/04/2024', 'dmy'), d('03/04/2024', 'mdy'), d('9/24/24 7:05 am')].join('|'); });
    t.ok('dates as spreadsheets and apps write them: a day number, “Sep 24, 2024 6:30 PM”, 24.09.2024, either order, two-digit years',
      r === 'Sep 24 2024 12:00|Sep 24 2024 18:30|Sep 24 2024 12:00|Apr 03 2024 12:00|Mar 04 2024 12:00|Sep 24 2024 07:05', r);
    await p.close();

    // any other spreadsheet: pasted, its columns matched once, remembered
    p = await t.fresh();
    await seed(p, { pr: { qz: 1 }, act: '', ms: {}, cx: {}, ax: {}, wo: {} });
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="settings"]');
    r = await p.evaluate(() => ({ lab: [...document.querySelectorAll('.tr-sheet .tr-file, .tr-sheet [data-t="impaste"]')].map((e) => e.textContent.trim()).join('|') }));
    t.ok('Settings has one import for any app, and a paste', /Import from another app/.test(r.lab) && /Paste from a spreadsheet/.test(r.lab), r.lab);
    await p.click('[data-t="impaste"]');
    await p.fill('#trPaste', 'Day\tLift\tSets\tReps\tLoad (kg)\n24/09/2024\tBench Press\t3\t10\t60\n25/09/2024\tSquat\t5\t5\t100\n');
    await p.click('[data-t="impread"]');
    r = await p.evaluate(() => { const sh = document.querySelector('.tr-sheet');
      const sel = {}; sh.querySelectorAll('[data-imc]').forEach((s) => { sel[s.getAttribute('data-imc')] = s.options[s.selectedIndex].textContent; });
      return { title: sh.querySelector('.sheet-name').textContent, sel, peek: (sh.querySelector('.tr-fits') || {}).textContent || '',
        next: !sh.querySelector('[data-t="imok"]').disabled, order: !!sh.querySelector('[data-t="imord"]') }; });
    t.ok('a spreadsheet from no app it knows asks which column is which, with its guesses in place',
      r.title === 'Match the columns' && r.sel.date === 'Day' && r.sel.ex === 'Lift' && r.sel.n === 'Sets' && r.sel.r === 'Reps' && r.sel.w === 'Load (kg)', JSON.stringify(r));
    t.ok('the first workouts are shown read that way, day first worked out from “24/09”', /24 Sep 2024 · Bench Press 3 × 10 @ 60/.test(r.peek) && /Squat 5 × 5 @ 100/.test(r.peek) && r.next, JSON.stringify(r));
    await p.click('[data-t="imok"]');
    r = await p.evaluate(() => ({ title: (document.querySelector('.tr-sheet .sheet-name') || {}).textContent, go: (document.querySelector('[data-t="sggo"]') || {}).textContent || '',
      mem: Object.keys(JSON.parse(localStorage.getItem('sh.importMap') || '{}')).length }));
    t.ok('Next shows what would come in, and the matching is remembered for the same headings', r.title === 'From your file' && /Bring in 2 workouts/.test(r.go) && r.mem === 1, JSON.stringify(r));
    await p.click('[data-t="sggo"]');
    r = await p.evaluate(() => { const T = window.Train._.state().T, ws = Object.values(T.wo).sort((a, b) => a.st - b.st);
      return { n: ws.length, u: ws.map((w) => w.u).join(), sets: ws.map((w) => w.x.map((x) => x.e + ':' + x.s.map((z) => z.w + 'x' + z.r).join('/')).join()).join(' | '),
        banner: (document.querySelector('.tr-sgdone') || {}).textContent || '' }; });
    t.ok('in they come: a row that says 3 sets is three sets, in kg as the heading said',
      r.n === 2 && r.u === 'kg,kg' && r.sets === 'bb-bench:60x10/60x10/60x10 | bb-squat:100x5/100x5/100x5/100x5/100x5', JSON.stringify(r));
    t.ok('and History says where they came from', /Brought in 2 workouts from your file/.test(r.banner), r.banner);
    await p.close();

    // ---- a gym and home: your plates, your bar, weights you can load ----------------------
    p = await t.fresh();
    await seed(p, { pr: { qz: 1, gy: { on: 1, u: 'lb', bar: 35, pl: { 45: 2, 10: 2, 5: 1 } } }, act: '', ms: {}, cx: {}, ax: {}, wo: {} });
    r = await p.evaluate(() => { const _ = window.Train._, pm = (w, b, inv) => { const m = _.plateMath(w, b, 'lb', inv); return m.plates.join('+') + (m.left ? ' short ' + m.left : ''); };
      return { a: pm(225, 45, { 45: 2 }), b: pm(125, 45, { 25: 1, 20: 2 }), c: pm(315, 45, { 45: 2, 10: 1 }), std: pm(190, 45, null),
        up: _.snapHome(190, true), near: _.snapHome(190, false), max: _.homeLoads().slice(-1)[0] }; });
    t.ok('your plates: two 45s a side make 225; 20 + 20 when a 25 first would leave 15 no pair of yours makes; and what they can’t reach is said',
      r.a === '45+45' && r.b === '20+20' && r.c === '45+45+10 short 35' && r.std === '45+25+2.5', JSON.stringify(r));
    t.ok('at home a rising weight goes up to the next you can load, a held one to the nearest; the most you can load is known',
      r.up === 215 && r.near === 175 && r.max === 35 + 2 * (90 + 20 + 5), JSON.stringify(r));
    await p.close();

    p = await t.fresh();
    await seed(p, { pr: { qz: 1, pl: 'row', gy: { on: 1, u: 'lb', bar: 45, pl: { 45: 1, 25: 1, 10: 1, 5: 1 }, last: 'gym' } }, act: '', ms: {}, cx: {}, ax: {},
      wo: { h1: wo('h1', '', 0, 0, 3, [{ e: 'bb-bench', s: sets(185, [10, 10, 10]) }]) } });
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="empty"]');
    await p.click('[data-t="addex"]');
    await p.click('.tr-pick[data-e="bb-bench"]');
    const benchAt = () => p.evaluate(() => { const c = document.querySelector('.tr-ex');
      return { where: (document.querySelector('[data-t="gyat"][aria-pressed="true"]') || {}).textContent || '', ph: document.querySelector('#trw-0-0').placeholder,
        note: (c.querySelector('.tr-homenote') || {}).textContent || '', bar: (c.querySelector('[data-t="barpick"]') || {}).textContent || '',
        pl: (document.querySelector('#trpl-0-0 .tr-stk') || {}).getAttribute ? document.querySelector('#trpl-0-0 .tr-stk').getAttribute('aria-label') : '' }; });
    r = await benchAt();
    t.ok('with a gym and home set up, a workout says which, starting where you were last; at the gym, the plan’s 190', r.where === 'Gym' && r.ph === '190' && !r.note, JSON.stringify(r));
    await p.click('[data-t="gyat"][data-v="home"]');
    r = await benchAt();
    t.ok('at home: the next weight your plates make, 195, and it says why', r.where === 'Home' && r.ph === '195' && /At home: 195 lb, the nearest your plates make \(the plan says 190\)/.test(r.note), JSON.stringify(r));
    t.ok('the row shows home’s plates on home’s bar', /45, 25, 5 a side/.test(r.pl) && /home bar 45 lb/.test(r.bar), JSON.stringify(r));
    await p.click('[data-t="tick"][data-x="0"][data-s="0"]');
    await p.fill('#trr-0-0', '8');
    r = await p.evaluate(() => window.Train._.state().LIVE.x[0].s[0].w);
    t.ok('ticked, the set is the weight you could load', r === 195, r);
    await p.evaluate(() => { const L = window.Train._.state().LIVE; L.x[0].s = L.x[0].s.filter((s) => s.t); });
    await p.click('[data-t="finish"]');
    await p.click('[data-t="save"]');
    await p.waitForSelector('.tr-done');
    r = await p.evaluate(() => { const T = window.Train._.state().T; return { g: Object.values(T.wo).filter((w) => w.id !== 'h1')[0].g, last: T.pr.gy.last }; });
    t.ok('the workout keeps that it was at home, and the next starts there', r.g === 'home' && r.last === 'home', JSON.stringify(r));
    await p.close();

    // setting it up
    p = await t.fresh();
    await seed(p, { pr: { qz: 1 }, act: '', ms: {}, cx: {}, ax: {}, wo: {} });
    await p.click('.tab[data-view="train"]');
    await p.click('[data-t="settings"]');
    await p.click('[data-t="s-gyon"][data-v="1"]');
    await p.click('[data-t="gypl"][data-v="45"][data-d="1"]');
    await p.click('[data-t="gypl"][data-v="2.5"][data-d="-1"]');
    await p.fill('#trGyBar', '35');
    await p.click('[data-t="gybar"]');
    await p.fill('#trBarDef', '44');
    await p.click('[data-t="s-barown"]');
    r = await p.evaluate(() => { const pr = window.Train._.state().T.pr; return { on: pr.gy.on, pl: JSON.stringify(pr.gy.pl), bar: pr.gy.bar, def: pr.bar,
      say: (document.querySelector('.tr-sheet') || {}).textContent.match(/The most you can load at home: [\d.]+ lb/) }; });
    t.ok('Settings sets up home: plates in pairs, a bar you type, and a default bar of any weight', r.on === 1 && r.pl === '{"5":2,"10":2,"25":1,"45":3}' && r.bar === 35 && r.def === 44 &&
      r.say && r.say[0] === 'The most you can load at home: ' + (35 + 2 * (135 + 25 + 20 + 10)) + ' lb', JSON.stringify(r));
    await p.close();
  },
};
