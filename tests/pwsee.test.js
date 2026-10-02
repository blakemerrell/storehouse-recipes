/* Plan my week: see what fits, see what landed.
 *
 * Blake: "I tried to plan my week and pick my dinners and it just auto put
 * some stuff there and didn't let me see the 11 that it selected". The
 * count opens the dinners that fit; the ones ticked go on first, in the
 * order ticked, and the nights left are picked by the usual rules. What
 * lands on the week is marked New, and the toast's Undo takes it all off. */
module.exports = {
  name: 'Plan my week, see what fits',
  async run(t) {
    const p = await t.fresh({ viewport: { width: 390, height: 844 } });
    /* A Sunday morning: every night of the week is still ahead. */
    await p.clock.setFixedTime(new Date(2026, 8, 27, 9, 0, 0));
    await p.reload();
    await p.waitForTimeout(800);
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.evaluate(() => localStorage.setItem('sh.pw', JSON.stringify({ days: ['mon', 'tue', 'wed', 'thu'], ppl: 4, t: 45, prot: ['Chicken'], lo: 0, shelf: true })));
    await p.click('.tab[data-view="plan"]');
    await p.waitForTimeout(300);
    await p.click('#planMyWeek');
    await p.waitForTimeout(300);

    const bar = await p.evaluate(() => ({ n: Number(document.querySelector('.pw-see b').textContent), say: document.querySelector('.pw-see i').textContent }));
    t.ok('the count is a button: See the N', bar.n > 4 && bar.say === 'See the ' + bar.n + ' ›', JSON.stringify(bar));
    await p.click('[data-pwsee]');
    await p.waitForTimeout(300);
    const list = await p.evaluate(() => ({
      h: document.querySelector('.pw-sheet .pw-h').textContent,
      rows: [...document.querySelectorAll('.pw-fit')].map((r) => ({ id: r.querySelector('[data-pwwant]').dataset.pwwant, name: r.querySelector('.pw-fn b').textContent,
        facts: r.querySelector('.pw-fn span').textContent })),
      pool: (() => { const a = window.__pw.answers(); return window.__pw.pool(a, false).length; })(),
    }));
    t.ok('it opens the dinners that fit, as many as it said, each with its time, calories and protein',
      list.h === 'The ' + bar.n + ' that fit' && list.rows.length === bar.n && list.rows.every((r) => /cal · \d+ g protein$/.test(r.facts)), JSON.stringify(list).slice(0, 400));

    /* A name opens the recipe; back comes back to the list. */
    await p.click('.pw-fit:nth-child(1) .pw-fn');
    await p.waitForTimeout(300);
    const rec = await p.evaluate(() => !!document.querySelector('.sheet:not(.pw-sheet)'));
    await p.goBack();
    await p.waitForTimeout(300);
    t.ok('a name opens its recipe, and back is the list again', rec && await p.evaluate(() => !!document.querySelector('.pw-fit')));

    /* Tick the third, then the first: that is their order. */
    const third = list.rows[2], first = list.rows[0];
    await p.click('[data-pwwant="' + third.id + '"]');
    await p.click('[data-pwwant="' + first.id + '"]');
    const ticked = await p.evaluate(() => ({ n: document.querySelector('.pw-sheet .pw-bar .pw-cnt b').textContent, note: [...document.querySelectorAll('.pw-sheet .pw-note')].pop().textContent }));
    t.ok('2 ticked, and it says the other 2 nights are picked for you', ticked.n === '2' && /Your 2 go on first\. The other 2 nights are picked for you/.test(ticked.note), JSON.stringify(ticked));
    await p.click('[data-pwback]');
    await p.waitForTimeout(200);
    t.ok('back on the questions, the count says 2 ticked', await p.evaluate(() => /^2 ticked/.test(document.querySelector('.pw-see i').textContent)));
    await p.click('[data-pwsee]');
    await p.click('.pw-sheet [data-pwpick]');
    await p.waitForTimeout(500);

    const wk = await p.evaluate(() => ({
      days: ['mon', 'tue', 'wed', 'thu'].map((d) => String((window.Store.day(d)[0] || {}).id || '')),
      fresh: [...document.querySelectorAll('#planGrid .day-item.new .day-new')].length,
      toast: (document.querySelector('#mToast:not([hidden])') || {}).textContent || '',
    }));
    t.ok('the ticked ones go on first, in the order ticked, and the other nights are filled',
      wk.days[0] === third.id && wk.days[1] === first.id && wk.days[2] && wk.days[3] && new Set(wk.days).size === 4, JSON.stringify(wk));
    t.ok('all four are marked New on the week', wk.fresh === 4, JSON.stringify(wk));
    t.ok('and the toast says so: 4 dinners added, your 2 and 2 picked for you, with Undo',
      /^4 dinners added/.test(wk.toast) && /Your 2, and 2 picked for you/.test(wk.toast) && /Undo$/.test(wk.toast), wk.toast);

    await p.click('#mToast [data-pwundo]');
    await p.waitForTimeout(300);
    const after = await p.evaluate(() => ({ days: ['mon', 'tue', 'wed', 'thu'].map((d) => window.Store.day(d).length).join(), fresh: document.querySelectorAll('#planGrid .day-item.new').length }));
    t.ok('Undo takes all four back off', after.days === '0,0,0,0' && after.fresh === 0, JSON.stringify(after));

    /* Picked without the list: still marked New. */
    await p.click('#planMyWeek');
    await p.waitForTimeout(300);
    await p.click('.pw-sheet [data-pwpick]');
    await p.waitForTimeout(500);
    const plain = await p.evaluate(() => ({ fresh: document.querySelectorAll('#planGrid .day-new').length, toast: (document.querySelector('#mToast:not([hidden])') || {}).textContent || '' }));
    t.ok('picked for you, the four are marked New and the toast says 4 dinners added', plain.fresh === 4 && /^4 dinners added/.test(plain.toast) && !/Your/.test(plain.toast), JSON.stringify(plain));
    await p.click('.tab[data-view="browse"]');
    await p.click('.tab[data-view="plan"]');
    await p.waitForTimeout(300);
    t.ok('New is for the visit: away and back, the marks are gone', await p.evaluate(() => document.querySelectorAll('#planGrid .day-new').length === 0));

    t.ok('no page errors', errs.length === 0, errs.join(' | '));
    await p.context().close();
  },
};
