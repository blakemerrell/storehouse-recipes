/* Plan as one flow: Where · On hand · Meals · Shop.
 *
 * Blake: "There's a natural flow to this and we need to get this plan
 * feature flowing in a natural way." Each step is reached from one bar; the
 * first two are set once for the household and change what the last two do. */

module.exports = {
  name: 'Plan flow',
  async run(t) {
    const p = await t.fresh({ viewport: { width: 390, height: 844 } });
    /* A Sunday morning: every day of the week is still ahead, so a plan
       written in this test is never a plan for a day already gone. */
    await p.clock.setFixedTime(new Date(2026, 8, 27, 9, 0, 0));
    await p.reload();
    await p.waitForTimeout(900);
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.evaluate(() => {
      const d = window.RECIPES.filter((r) => r.book === 2 && r.secNum === 3).slice(4, 8);
      ['mon', 'tue', 'wed', 'thu'].forEach((day, i) => window.Store.addToDay(d[i].id, day, 1));
    });
    await p.click('.tab[data-view="plan"]');
    await p.waitForTimeout(300);
    const s0 = await p.evaluate(() => ({
      steps: [...document.querySelectorAll('.pstep')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()),
      cur: (document.querySelector('.pstep[aria-current="step"]') || {}).dataset,
      banner: !!document.querySelector('.setup-card'),
      tabs: [...document.querySelectorAll('.tabs .tab')].filter((b) => b.offsetParent).map((b) => b.dataset.view),
    }));
    t.ok('Plan opens on its meals, under a bar of four steps, with List and Pantry no longer tabs of their own',
      s0.steps.join('|') === '1 Where|2 On hand|3 Meals|4 Shop' && s0.cur && s0.cur.view === 'plan' &&
        s0.tabs.join() === 'browse,plan,macros,train', JSON.stringify(s0));
    t.ok('and, not set up yet, it says to start with step 1', s0.banner);

    await p.click('.setup-card [data-stepgo="where"]');
    await p.waitForTimeout(250);
    await p.click('[data-where="sh"]');
    await p.waitForTimeout(250);
    const where = await p.evaluate(() => ({ mode: window.__flow.mode(), near: !!document.querySelector('[data-near]'),
      lit: document.querySelector('.tab[aria-selected="true"]').dataset.view }));
    t.ok('Storehouse only is remembered, offers the one-or-two allowance, and Plan stays the lit tab',
      where.mode === 'sh' && where.near && where.lit === 'plan', JSON.stringify(where));

    /* Storehouse only: every suggestion can be made without a store. */
    const only = await p.evaluate(() => {
      const a = { days: ['mon'], ppl: 4, bud: 150, t: 0, prot: [], kind: [], fit: false, avoid: [], ing: [], rec: 0, shelf: true };
      const pool = window.__pw.pool(a, false);
      return { n: pool.length, bad: pool.filter((r) => window.__flow.needs(r) > 0).map((r) => r.name) };
    });
    await p.click('[data-near]');
    await p.waitForTimeout(200);
    const near = await p.evaluate(() => {
      const a = { days: ['mon'], ppl: 4, bud: 150, t: 0, prot: [], kind: [], fit: false, avoid: [], ing: [], rec: 0, shelf: true };
      const pool = window.__pw.pool(a, false);
      return { n: pool.length, max: Math.max.apply(null, pool.map((r) => window.__flow.needs(r))) };
    });
    t.ok('storehouse only suggests only what needs nothing from a store; allowing one or two widens it, and no further',
      only.n > 0 && only.bad.length === 0 && near.n > only.n && near.max <= 2, JSON.stringify({ only, near }));

    /* On hand */
    await p.click('#whereBody [data-stepgo="pantry"]');
    await p.waitForTimeout(250);
    const more = await p.evaluate(() => {
      const m = document.querySelector('#view-pantry [data-kitmore]');
      const g = m.closest('.kit-grp');
      return { c: m.dataset.kitmore, before: g.querySelectorAll('.kit-pill').length, says: m.textContent };
    });
    await p.click('[data-kitmore="' + more.c + '"]');
    await p.waitForTimeout(200);
    const after = await p.evaluate((c) => [...document.querySelectorAll('#view-pantry .kit-grp')].find((g) => g.querySelector('.kit-gh span').textContent === c).querySelectorAll('.kit-pill').length, more.c);
    t.ok('each shelf shows a few, and +N more opens the rest', after === more.before + Number(more.says.replace(/\D/g, '')), JSON.stringify({ more, after }));
    const pill = await p.evaluate(() => {
      const b = [...document.querySelectorAll('#view-pantry .kit-pill[data-kitpill]')].find((x) => x.getAttribute('aria-pressed') === 'false' && window.PANTRY[x.dataset.kitpill].s);
      return b.dataset.kitpill;
    });
    await p.click('[data-kitpill="' + pill + '"]');
    await p.waitForTimeout(200);
    const on = await p.evaluate((k) => ({ k: window.Store.kitchen(k), pressed: document.querySelector('[data-kitpill="' + k + '"]').getAttribute('aria-pressed') }), pill);
    t.ok('tapping a pill puts that food in the kitchen', on.k === 1 && on.pressed === 'true', JSON.stringify(on));

    await p.click('#view-pantry [data-stepgo="plan"]');
    await p.waitForTimeout(250);
    t.ok('Next goes to the meals, and the set-up card is gone for good',
      await p.evaluate(() => !document.querySelector('.setup-card') && window.Store.opt('setup', false)));

    /* Shop */
    await p.click('#view-plan [data-stepgo="list"]');
    await p.waitForTimeout(300);
    const shop = await p.evaluate(() => ({
      titles: [...document.querySelectorAll('.list-group-title')].map((e) => e.textContent),
      cart: !!document.querySelector('#listWm .wm-btn'),
      low: [...document.querySelectorAll('[data-low]')].map((b) => b.dataset.low),
    }));
    t.ok('storehouse only: the storehouse order leads, and there is no Walmart cart',
      shop.titles.indexOf('Storehouse order') >= 0 && !shop.cart, JSON.stringify(shop));
    t.ok('Anything run out? offers the kitchen’s staples', shop.low.indexOf(pill) >= 0, JSON.stringify(shop.low));
    await p.click('[data-low="' + pill + '"]');
    await p.waitForTimeout(250);
    const ran = await p.evaluate((k) => {
      const i = document.querySelector('#listBody [data-check="' + k + '"]');
      return i ? { g: i.closest('.list-group').querySelector('.list-group-title').textContent, q: i.closest('.list-row').querySelector('.qty').textContent } : null;
    }, pill);
    t.ok('a staple marked as run out goes on the storehouse order, said so', !!ran && ran.g === 'Storehouse order' && /ran out/.test(ran.q), JSON.stringify(ran));
    await p.click('[data-low="' + pill + '"]');
    await p.waitForTimeout(250);
    t.ok('and tapped again, it comes off', await p.evaluate((k) => !document.querySelector('#listBody [data-check="' + k + '"]') || !window.Store.low(k), pill));
    t.ok('with no error on the page', errs.length === 0, errs.join(' | '));
    await p.context().close();
  },
};
