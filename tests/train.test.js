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
    t.ok('ramp sets are lettered and the all-out set is marked', r === 'R,R,1+', r);
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
  },
};
