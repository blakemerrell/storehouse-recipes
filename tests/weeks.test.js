/* Weeks, the plan, and the multiplier a planned recipe carries. */

module.exports = {
  name: 'Weeks and the plan',
  async run(t) {
    // ---- a household saved by the one-week version ------------------------
    let p = await t.fresh();
    await p.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('bsc.plan', JSON.stringify({ mon: [1, 2], wed: [3] }));
      localStorage.setItem('bsc.favs', JSON.stringify([7]));
    });
    await p.reload();
    await p.click('.tab[data-view="plan"]');
    await p.waitForTimeout(200);

    let s = await p.evaluate(() => ({
      weeks: window.Store.weeks(),
      plan: window.Store.state.plan,
      favs: window.Store.state.favs,
      title: document.getElementById('weekTitle').textContent,
      days: document.querySelectorAll('.day-item-name').length,
    }));
    t.ok('the old single week is carried over',
      s.weeks.length === 1 && s.weeks[0].name === 'This Week', JSON.stringify(s.weeks));
    t.ok('with its plan intact', (s.plan.mon || []).join() === '1,2' && (s.plan.wed || []).join() === '3');
    t.ok('and its favorites', s.favs.join() === '7');
    t.ok('the grid shows them', s.days === 3, s.days);

    // ---- a second week is a separate thing --------------------------------
    await p.click('[data-neww="new"]');
    await p.waitForTimeout(150);
    s = await p.evaluate(() => ({
      n: window.Store.weeks().length,
      name: window.Store.activeWeek().name,
      days: document.querySelectorAll('.day-item-name').length,
      del: !document.getElementById('deleteWeek').classList.contains('hide'),
    }));
    t.ok('a new week is empty and active', s.n === 2 && s.name === 'Week 2' && s.days === 0, JSON.stringify(s));
    t.ok('delete appears once there are two to choose from', s.del);

    await p.click('.tab[data-view="browse"]');
    await p.click('#grid .card:nth-child(5)');
    await p.click('.daybtn[data-day="tue"]');
    await p.click('.sheet-x');
    await p.click('.tab[data-view="plan"]');
    await p.waitForTimeout(200);
    s = await p.evaluate(() => {
      const st = window.Store.state;
      const first = window.Store.weeks()[0];
      return {
        here: (st.plan.tue || []).length,
        there: JSON.stringify(st.weeks[first.id].plan),
        counts: [...document.querySelectorAll('#weekBar .wk-n')].map((e) => e.textContent).join(','),
      };
    });
    t.ok('planning lands in the week showing', s.here === 1);
    t.ok('and leaves the other one alone', /"mon":\[1,2\]/.test(s.there), s.there);
    t.ok('each chip counts its own week', s.counts === '3,1', s.counts);

    // ---- the shopping list follows the week -------------------------------
    await p.click('.tab[data-view="list"]');
    await p.waitForTimeout(200);
    const l2 = await p.evaluate(() => ({
      week: document.getElementById('listWeek').textContent,
      rows: document.querySelectorAll('.list-row').length,
    }));
    await p.click('.tab[data-view="plan"]');
    await p.click('#weekBar .wk >> nth=0');
    await p.click('.tab[data-view="list"]');
    await p.waitForTimeout(200);
    const l1 = await p.evaluate(() => ({
      week: document.getElementById('listWeek').textContent,
      rows: document.querySelectorAll('.list-row').length,
    }));
    t.ok('the list says which week it is for',
      l1.week === 'This Week' && l2.week === 'Week 2', l1.week + ' / ' + l2.week);
    t.ok('and changes with it', l1.rows !== l2.rows && l1.rows > 0 && l2.rows > 0, l1.rows + ' vs ' + l2.rows);

    // ---- ticks belong to their week, and to what is on the list -----------
    await p.click('.list-row >> nth=0');
    await p.waitForTimeout(150);
    t.ok('a tick sticks', (await p.evaluate(() => document.querySelectorAll('.list-row.done').length)) === 1);
    await p.click('.tab[data-view="plan"]');
    await p.click('#weekBar .wk >> nth=1');
    await p.click('.tab[data-view="list"]');
    await p.waitForTimeout(200);
    t.ok('and does not follow you into another week',
      (await p.evaluate(() => document.querySelectorAll('.list-row.done').length)) === 0);

    await p.click('.tab[data-view="plan"]');
    await p.click('#weekBar .wk >> nth=0');
    await p.waitForTimeout(150);
    await p.click('.day-x >> nth=0');           // drop the recipe the tick came from
    await p.waitForTimeout(200);
    await p.evaluate(() => { window.Store.addToDay(1, 'mon'); });
    await p.waitForTimeout(200);
    await p.click('.tab[data-view="list"]');
    await p.waitForTimeout(200);
    t.ok('taking a recipe out forgets its ticks, so they never come back ticked',
      (await p.evaluate(() => document.querySelectorAll('.list-row.done').length)) === 0);

    // ---- the multiplier ----------------------------------------------------
    await p.evaluate(() => { window.Store.clearPlan(); window.Store.addToDay(1, 'mon'); });
    await p.waitForTimeout(200);
    const at1 = await p.evaluate(() => [...document.querySelectorAll('.list-row')].map((r) => r.textContent).join('|'));
    await p.evaluate(() => window.Store.addToDay(1, 'mon', 2));
    await p.waitForTimeout(200);
    const at2 = await p.evaluate(() => [...document.querySelectorAll('.list-row')].map((r) => r.textContent).join('|'));
    t.ok('doubling a recipe doubles the shopping', /1 cup/.test(at1) && /2 cups/.test(at2), at1 + '  ->  ' + at2);

    await p.click('.tab[data-view="plan"]');
    await p.waitForTimeout(150);
    t.ok('the plan shows the multiplier', (await p.textContent('.day-x2')) === '×2');
    await p.click('.day-x2');
    await p.waitForTimeout(150);
    t.ok('and cycles when tapped', (await p.textContent('.day-x2')) === '×3');

    await p.click('.tab[data-view="browse"]');
    await p.click('#grid .card:nth-child(1)');
    await p.click('[data-scale="up"]');
    await p.click('[data-scale="up"]');
    await p.click('.daybtn[data-day="thu"]');
    await p.waitForTimeout(150);
    t.ok('planning from the panel keeps the size you were looking at',
      (await p.evaluate(() => window.Store.scaleOf(1, 'thu'))) === 4);
    await p.click('.sheet-x');

    // ---- rename, copy, delete, reload -------------------------------------
    await p.click('.tab[data-view="plan"]');
    p.once('dialog', (d) => d.accept());
    await p.click('#renameWeek');
    await p.waitForSelector('#dlgInput');
    await p.fill('#dlgInput', 'Thanksgiving');
    await p.click('[data-dlg="ok"]');
    await p.waitForTimeout(200);
    t.ok('a week can be renamed',
      (await p.evaluate(() => window.Store.activeWeek().name)) === 'Thanksgiving',
      await p.evaluate(() => window.Store.activeWeek().name));

    await p.click('[data-neww="copy"]');
    await p.waitForTimeout(200);
    s = await p.evaluate(() => ({
      n: window.Store.weeks().length,
      name: window.Store.activeWeek().name,
      plan: JSON.stringify(window.Store.state.plan),
      checked: Object.keys(window.Store.state.checked).length,
    }));
    t.ok('and copied', s.n === 3 && s.name === 'Thanksgiving again' && /"mon"/.test(s.plan), JSON.stringify(s));
    t.ok('a copy takes the plan but not the ticks', s.checked === 0);

    await p.click('#deleteWeek');
    await p.waitForSelector('.dlg');
    await p.click('[data-dlg="ok"]');
    await p.waitForTimeout(200);
    t.ok('and deleted', (await p.evaluate(() => window.Store.weeks().length)) === 2);

    await p.reload();
    await p.click('.tab[data-view="plan"]');
    await p.waitForTimeout(300);
    t.ok('all of which survives a reload',
      (await p.evaluate(() => window.Store.weeks().map((w) => w.name).join(','))) === 'Thanksgiving,Week 2',
      await p.evaluate(() => window.Store.weeks().map((w) => w.name).join(',')));

    // ---- a fresh install, and a phone -------------------------------------
    await p.context().close();
    p = await t.fresh();
    await p.click('.tab[data-view="plan"]');
    await p.waitForTimeout(200);
    t.ok('a new install starts with one week you cannot delete',
      (await p.evaluate(() => window.Store.weeks().map((w) => w.name).join(','))) === 'This Week' &&
      (await p.evaluate(() => document.getElementById('deleteWeek').classList.contains('hide'))));
    await p.context().close();

    p = await t.fresh({ viewport: { width: 390, height: 780 } });
    await p.click('.tab[data-view="plan"]');
    await p.click('[data-neww="new"]');
    await p.waitForTimeout(200);
    const over = await p.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    t.ok('and nothing runs off the side of a phone', over <= 0, over + 'px');

    /* Every tab reachable without knowing to swipe. Five tabs and the sync
       button shared one row, which put 230px of it off the right-hand edge at
       390px: "Pantry" cut to "Pant", "Print Book" not on screen at all, and no
       scrollbar or fade to say there was more. Two of the five were, in
       practice, undiscoverable.

       Asserted by geometry rather than by overflow, because the fix is not
       "it scrolls" — it is that nothing needs to. */
    const tabs = await p.evaluate(() => {
      const t = document.querySelector('.tabs');
      const box = t.getBoundingClientRect();
      return {
        labels: [...t.querySelectorAll('.tab')].map((b) => b.innerText.trim()),
        offscreen: [...t.querySelectorAll('.tab')]
          .filter((b) => b.getBoundingClientRect().right > box.right + 1)
          .map((b) => b.innerText.trim()),
        // and the sync button is no longer competing with them for the row
        syncAbove: document.querySelector('.synbtn').getBoundingClientRect().top < box.top,
      };
    });
    t.ok('every tab is on the screen without scrolling for it',
      tabs.offscreen.length === 0, 'off the edge: ' + tabs.offscreen.join(', '));
    t.ok('under a short name each, on a phone',
      tabs.labels.join('|') === 'Recipes|Plan|List|Pantry|Book', tabs.labels.join(' '));
    t.ok('with the sync button up on the brand line, out of their way', tabs.syncAbove);

    /* It used to say "Local", which is a state and not an invitation, and
       nothing on the screen said that pressing it was how two phones end up on
       one list. On a device that is not sharing it has to name the thing you
       can do, and it has to carry the sentence there is no room to print. */
    const badge = await p.evaluate(() => ({
      label: document.getElementById('syncLabel').textContent.trim(),
      tip: document.getElementById('syncBtn').getAttribute('title') || '',
    }));
    t.ok('and it offers to share rather than reporting that it is local',
      badge.label === 'Share', badge.label);
    t.ok('with the whole sentence in its title',
      /tap to share/i.test(badge.tip), badge.tip);

    /* Every state the badge can be in has a word and a sentence, because the
       one that had neither is the one that sent somebody asking what "Offline"
       meant. Read straight off the app rather than restated here, so a new
       state cannot be added without one. */
    const vocab = await p.evaluate(() => {
      const w = window.__syncWords, t = window.__syncTips;
      if (!w || !t) return null;
      return Object.keys(w).filter((k) => !w[k] || !t[k]);
    });
    t.ok('and every sync state has a word and a sentence of its own',
      vocab !== null && vocab.length === 0,
      vocab === null ? 'not exposed' : vocab.join(', '));

    // and the long names come back where there is room for them
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.waitForTimeout(400);
    const wide = await p.evaluate(() =>
      [...document.querySelectorAll('.tab')].map((b) => b.innerText.trim()));
    t.ok('and the full names return on a wider screen',
      wide.join('|') === 'Recipes|Meal Plan|Shopping List|Pantry|Print Book', wide.join(' '));
    await p.context().close();
  },
};
