/* The front door: a new phone's first open.
 *
 * Blake's goal is one app that suits a heavy tracker, a busy mom and anyone
 * in between. A new phone is asked what it wants help with, its kitchen, its
 * workouts and its goal (the last two only if picked), and each answer goes
 * to the part of the app that owns it. A phone that has been used never sees
 * it, and "Just look around" skips it for good. Every other suite starts past
 * the door (tests/run.js); this one asks for it with { door: true }. */
module.exports = {
  name: 'The front door',
  async run(t) {
    const p = await t.fresh({ viewport: { width: 390, height: 844 }, door: true });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.waitForTimeout(500);
    const look = () => p.evaluate(() => {
      const r = document.getElementById('doorRoot');
      return r ? {
        k: r.querySelector('.dr-k span').textContent, h: r.querySelector('.dr-h').textContent,
        opts: [...r.querySelectorAll('.dr-opt')].map((b) => b.dataset.v + ':' + b.getAttribute('aria-pressed')),
        next: (r.querySelector('[data-dr="next"]') || {}).textContent || '', dis: !!(r.querySelector('[data-dr="next"]') || {}).disabled,
        focus: document.activeElement === r.querySelector('.dr-h'),
      } : null;
    });

    /* ---- a new phone ---- */
    let s = await look();
    t.ok('a new phone opens on the front door: what would you like help with, all three picked, one of four',
      s && s.h === 'What would you like help with?' && s.k === 'Welcome · 1 of 4' && s.opts.join() === 'd:true,e:true,w:true' && s.focus, JSON.stringify(s));
    await p.click('[data-dr="help"][data-v="w"]');
    s = await look();
    t.ok('no workouts: one of three', s.k === 'Welcome · 1 of 3' && s.opts.join() === 'd:true,e:true,w:false', JSON.stringify(s));
    await p.click('[data-dr="help"][data-v="d"]');
    await p.click('[data-dr="help"][data-v="e"]');
    s = await look();
    t.ok('nothing picked holds Next back', s.dis, JSON.stringify(s));
    for (const v of ['d', 'e', 'w']) await p.click('[data-dr="help"][data-v="' + v + '"]');

    await p.click('[data-dr="next"]');
    s = await look();
    t.ok('2 of 4: your kitchen', s.h === 'Your kitchen' && s.k === 'Your kitchen · 2 of 4', JSON.stringify(s));
    await p.click('[data-dr="ppl"][data-v="6"]');
    await p.click('[data-dr="src"][data-v="fb"]');
    await p.click('[data-dr="next"]');
    s = await look();
    t.ok('3 of 4: your workouts, in Strengthen’s own options',
      s.h === 'Your workouts' && await p.evaluate(() => [...document.querySelectorAll('[data-dr="min"]')].map((b) => b.textContent).join() === '30,40,45,60,No limit'), JSON.stringify(s));
    await p.click('[data-dr="kit"][data-v="db"]');
    await p.click('[data-dr="dpw"][data-v="4"]');
    await p.click('[data-dr="min"][data-v="45"]');
    await p.click('[data-dr="next"]');
    s = await look();
    t.ok('4 of 4: your goal, in Nourish’s four', s.h === 'What’s your goal?' && s.next === 'Set my numbers' &&
      await p.evaluate(() => [...document.querySelectorAll('[data-dr="goal"]')].map((b) => b.dataset.v).join() === 'cut1,cut2,keep,gain'), JSON.stringify(s));
    await p.click('[data-dr="back"]');
    t.ok('Back goes back, with the answers kept', await p.evaluate(() => document.querySelector('[data-dr="kit"][data-v="db"]').getAttribute('aria-pressed') === 'true'));
    await p.click('[data-dr="next"]');
    await p.click('[data-dr="goal"][data-v="cut2"]');
    await p.click('[data-dr="later"]');
    await p.waitForTimeout(400);
    const got = await p.evaluate(() => ({
      door: !!document.getElementById('doorRoot'), mark: localStorage.getItem('sh.door'),
      help: localStorage.getItem('sh.help'), fb: window.Store.opt('fb', false), store: window.Store.opt('store', true), setup: window.Store.opt('setup', false),
      ppl: window.__pw.answers().ppl, work: JSON.parse(localStorage.getItem('sh.doorWork') || 'null'),
      goal: (JSON.parse(localStorage.getItem('bsc.macroProfile') || '{}')).goal,
      today: !document.getElementById('view-today').classList.contains('hide'),
      cards: [...document.querySelectorAll('#todayRoot .td-label')].map((h) => h.id),
    }));
    t.ok('done: the door is gone and Today is up', !got.door && got.mark === 'done' && got.today, JSON.stringify(got));
    t.ok('the kitchen is the household’s: a food bank, set up, and Plan my week cooks for 6',
      got.fb && got.store && got.setup && got.ppl === 6, JSON.stringify(got));
    t.ok('Nourish has the goal, and Strengthen has its three answers waiting',
      got.goal === 'cut2' && JSON.stringify(got.work) === '{"kit":"db","dpw":4,"min":45}', JSON.stringify(got));
    await p.reload();
    await p.waitForTimeout(600);
    t.ok('and it never comes back', await p.evaluate(() => !document.getElementById('doorRoot')));

    /* ---- Strengthen starts from them ---- */
    await p.click('.tab[data-view="train"]');
    await p.waitForTimeout(300);
    await p.click('.tr-big[data-f="goal"] >> nth=0');
    await p.waitForTimeout(150);
    await p.click('.tr-big[data-f="lvl"] >> nth=0');
    await p.waitForTimeout(200);
    const time = await p.evaluate(() => ({
      dpw: (document.querySelector('[data-f="dpw"][aria-pressed="true"]') || {}).textContent,
      min: (document.querySelector('[data-f="min"][aria-pressed="true"]') || {}).textContent }));
    t.ok('Strengthen’s own setup arrives at its time question with 4 days and 45 minutes already pressed',
      time.dpw === '4' && time.min === '45 min', JSON.stringify(time));
    await p.context().close();

    /* ---- only dinners ---- */
    const q = await t.fresh({ viewport: { width: 390, height: 844 }, door: true });
    q.on('pageerror', (e) => errs.push(e.message));
    await q.waitForTimeout(500);
    await q.click('[data-dr="help"][data-v="e"]');
    await q.click('[data-dr="help"][data-v="w"]');
    await q.click('[data-dr="next"]');
    const k2 = await q.evaluate(() => ({ k: document.querySelector('.dr-k span').textContent, next: document.querySelector('[data-dr="next"]').textContent }));
    t.ok('dinners only: two screens, and the kitchen one ends it', k2.k === 'Your kitchen · 2 of 2' && k2.next === 'Show me today', JSON.stringify(k2));
    await q.click('[data-dr="next"]');
    await q.waitForTimeout(400);
    await q.evaluate(() => {
      const r = window.RECIPES.find((x) => x.book === 2 && x.secNum === 3);
      window.Store.addToDay(r.id, ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()], 1);
    });
    await q.waitForTimeout(300);
    const cards = () => q.evaluate(() => [...document.querySelectorAll('#todayRoot .td-label')].map((h) => h.id).join());
    let c = await cards();
    t.ok('Today shows tonight’s dinner and nothing about eating or workouts', /td-tonight/.test(c) && !/td-eating|td-workout/.test(c), c);
    await q.click('#syncBtn');
    await q.waitForTimeout(300);
    const sw = await q.evaluate(() => [...document.querySelectorAll('[data-sync="help"]')].map((b) => b.dataset.v + ':' + b.getAttribute('aria-checked')).join());
    t.ok('Share & settings has the three, as answered', sw === 'd:true,e:false,w:false', sw);
    await q.click('[data-sync="help"][data-v="e"]');
    await q.waitForTimeout(200);
    await q.click('.sync-sheet .sheet-x');
    await q.waitForTimeout(300);
    c = await cards();
    t.ok('switched on there, Today shows eating too', /td-eating/.test(c), c);
    await q.context().close();

    /* ---- joining a kitchen by invite ---- */
    const j = await t.fresh({ viewport: { width: 390, height: 844 }, door: true });
    j.on('pageerror', (e) => errs.push(e.message));
    await j.evaluate(() => localStorage.clear());
    await j.goto(t.base + 'index.html?invite=abc123');
    await j.waitForTimeout(600);
    const jn = await j.evaluate(() => ({ h: document.querySelector('.dr-h').textContent, k: document.querySelector('.dr-k span').textContent,
      opts: [...document.querySelectorAll('.dr-opt')].map((b) => b.dataset.v + ':' + b.getAttribute('aria-pressed')).join() }));
    t.ok('an invite: joining a kitchen, its kitchen not asked again, and only your own eating and workouts to pick',
      jn.h === 'You’re joining a kitchen' && jn.k === 'Welcome · 1 of 2' && jn.opts === 'e:true,w:false', JSON.stringify(jn));
    await j.click('[data-dr="next"]');
    await j.click('[data-dr="goal"][data-v="keep"]');
    await j.click('[data-dr="next"]');
    await j.waitForTimeout(500);
    const nums = await j.evaluate(() => ({ macros: !document.getElementById('view-macros').classList.contains('hide'),
      goal: (document.querySelector('[data-mtgoal][aria-pressed="true"]') || {}).dataset, store: localStorage.getItem('bsc.opts') }));
    t.ok('Set my numbers opens Nourish’s numbers with that goal pressed, and the kitchen’s switches are left alone',
      nums.macros && nums.goal && nums.goal.mtgoal === 'keep' && !/"fb"/.test(nums.store || ''), JSON.stringify(nums));
    await j.context().close();

    /* ---- a phone that has been used ---- */
    const o = await t.browser.newContext({ viewport: { width: 390, height: 844 }, door: true });
    await o.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('bsc.favs', '[7]'); sessionStorage.setItem('seeded', '1'); } });
    const op = await o.newPage();
    await op.goto(t.base + 'index.html');
    await op.waitForTimeout(800);
    const old = await op.evaluate(() => ({ door: !!document.getElementById('doorRoot'), mark: localStorage.getItem('sh.door') }));
    t.ok('a phone with anything on it never sees the door, and is marked so a cleared plan does not bring it back',
      !old.door && old.mark === 'had', JSON.stringify(old));
    await o.close();

    /* ---- just look around ---- */
    const l = await t.fresh({ viewport: { width: 390, height: 844 }, door: true });
    l.on('pageerror', (e) => errs.push(e.message));
    await l.waitForTimeout(500);
    await l.click('[data-dr="skip"]');
    await l.waitForTimeout(300);
    const sk = await l.evaluate(() => ({ door: !!document.getElementById('doorRoot'), mark: localStorage.getItem('sh.door'), help: localStorage.getItem('sh.help') }));
    await l.reload();
    await l.waitForTimeout(600);
    t.ok('Just look around: gone for good, and Today shows everything',
      !sk.door && sk.mark === 'skip' && sk.help === null && await l.evaluate(() => !document.getElementById('doorRoot')), JSON.stringify(sk));
    await l.context().close();

    t.ok('no page errors', errs.length === 0, errs.join(' | '));
  },
};
