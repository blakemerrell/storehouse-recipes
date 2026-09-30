/* Weeks, the plan, and the multiplier a planned recipe carries. */

/* Every sheet answers the back gesture the same way.
 *
 * A recipe was made a history entry when a reader complained that swiping back
 * out of a cross-reference dumped him on the grid. That fixed the case he hit
 * and left three that look identical to him: the Share sheet, the editor and a
 * confirm dialog all fill the screen and all have an ×, and backing out of any
 * of them navigated clean out of the app. Same gesture, same-looking thing,
 * three different outcomes.
 *
 * The check is that back closes the sheet and leaves you where you were —
 * which means starting somewhere else, so that leaving the app is visible as a
 * change of address rather than as nothing happening. */
async function backLeavesYouHere(t, open) {
  const ctx = await t.browser.newContext({ viewport: { width: 1000, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(t.base + 'welcome/index.html');
  await p.waitForTimeout(200);
  await p.goto(t.base + 'index.html');
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForTimeout(700);
  await open(p);
  const opened = await p.evaluate(() =>
    !!document.querySelector('.sheet') || !!document.querySelector('#dialogRoot .dlg'));
  await p.goBack();
  await p.waitForTimeout(600);
  const after = await p.evaluate(() => ({
    path: location.pathname,
    sheet: !!document.querySelector('.sheet') || !!document.querySelector('#dialogRoot .dlg'),
  }));
  await ctx.close();
  return { opened, after };
}

module.exports = {
  name: 'Weeks and the plan',
  async run(t) {
    /* ---- weeks have dates ------------------------------------------------
     * Blake: "a calendar type view... move forward or backward to see my
     * history or my planning." A week is Sunday to Saturday and its id says
     * which Sunday. The clock is fixed on Wednesday 30 September 2026, so this
     * week is Sep 27 – Oct 3 and Sunday to Tuesday are gone. */
    const WED = new Date(2026, 8, 30, 9, 0, 0);
    let p = await t.fresh({ viewport: { width: 390, height: 844 } });
    await p.clock.setFixedTime(WED);
    await p.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('bsc.plan', JSON.stringify({ mon: [1, 2], wed: [3] }));
      localStorage.setItem('bsc.favs', JSON.stringify([7]));
    });
    await p.reload();
    await p.waitForTimeout(700);
    await p.click('.tab[data-view="plan"]');
    await p.waitForTimeout(250);
    const look = () => p.evaluate(() => ({
      id: window.Store.activeWeek().id,
      title: document.getElementById('weekTitle').textContent,
      sub: document.getElementById('calSub').textContent,
      items: document.querySelectorAll('#planGrid .day-item-name').length,
      weeks: Object.keys(window.Store.state.weeks).sort().join(','),
    }));
    let s = await look();
    const plan0 = await p.evaluate(() => window.Store.state.plan);
    t.ok('the old single week lands on this week’s dates',
      s.id === 'd20260927' && s.title === 'Sep 27 – Oct 3' && s.sub === 'This week' && s.weeks === 'd20260927', JSON.stringify(s));
    t.ok('with its plan intact', (plan0.mon || []).join() === '1,2' && (plan0.wed || []).join() === '3');
    t.ok('and its favorites', (await p.evaluate(() => window.Store.state.favs.join())) === '7');
    t.ok('the calendar shows them', s.items === 3, s.items);

    /* ---- next week is its own, and looking writes nothing ----------------- */
    await p.click('#calNext');
    await p.waitForTimeout(200);
    s = await look();
    t.ok('› shows next week, empty, and looking at it writes nothing',
      s.id === 'd20261004' && s.title === 'Oct 4 – Oct 10' && s.sub === 'Next week' && s.items === 0 && s.weeks === 'd20260927', JSON.stringify(s));
    await p.evaluate(() => window.Store.addToDay(2, 'tue'));
    await p.waitForTimeout(150);
    s = await p.evaluate(() => ({ here: window.Store.day('tue').map((e) => e.id).join(), there: JSON.stringify(window.Store.state.weeks.d20260927.plan) }));
    t.ok('planning lands in the week showing and leaves this week alone',
      s.here === '2' && /"mon":\[1,2\]/.test(s.there) && !/"tue"/.test(s.there), JSON.stringify(s));

    /* ---- the days gone by are history ------------------------------------ */
    await p.click('#calToday');
    await p.waitForTimeout(200);
    const days = await p.evaluate(() => [...document.querySelectorAll('#planGrid .cal-day')].map((d) => ({
      n: d.querySelector('.cal-date b').textContent, past: d.classList.contains('past'), today: d.classList.contains('today'),
      add: !!d.querySelector('[data-addday]'), drop: !!d.querySelector('[data-drop]') })));
    t.ok('the week runs Sunday 27 to Saturday 3, with today marked',
      days.map((d) => d.n).join() === '27,28,29,30,1,2,3' && days[3].today && !days[2].today, JSON.stringify(days.map((d) => d.n)));
    t.ok('days gone by keep what was planned but take no + Add and no remove; today and after do',
      days[1].past && !days[1].add && !days[1].drop && !days[3].past && days[3].add && days[3].drop && days[4].add, JSON.stringify(days));
    await p.click('#calPrev');
    await p.waitForTimeout(200);
    s = await p.evaluate(() => ({ sub: document.getElementById('calSub').textContent, pmw: document.getElementById('planMyWeek').disabled }));
    t.ok('a week gone by says so, and Plan my week is off for it', s.sub === 'Last week' && s.pmw, JSON.stringify(s));
    await p.click('#calToday');

    /* ---- the list is the week's ------------------------------------------ */
    const listOf = async () => {
      await p.click('.pstep[data-view="list"]');
      await p.waitForTimeout(200);
      const l = await p.evaluate(() => ({ week: document.getElementById('listWeek').textContent, rows: document.querySelectorAll('.list-row').length,
        done: document.querySelectorAll('.list-row.done').length }));
      await p.click('.pstep[data-view="plan"]');
      await p.waitForTimeout(150);
      return l;
    };
    const l1 = await listOf();
    await p.click('#calNext');
    await p.waitForTimeout(150);
    const l2 = await listOf();
    t.ok('Shop is for the week on screen, and says which',
      l1.week === 'Sep 27 – Oct 3' && l2.week === 'Oct 4 – Oct 10' && l1.rows !== l2.rows && l2.rows > 0, JSON.stringify({ l1, l2 }));
    await p.click('.pstep[data-view="list"]');
    await p.click('#listBody .list-row >> nth=0');
    await p.waitForTimeout(150);
    await p.click('.pstep[data-view="plan"]');
    await p.click('#calToday');
    await p.waitForTimeout(150);
    t.ok('a tick belongs to its week', (await listOf()).done === 0);

    /* ---- the multiplier, on a day still ahead ---------------------------- */
    await p.evaluate(() => { window.Store.addToDay(1, 'thu'); });
    await p.waitForTimeout(150);
    const qty = async () => {
      await p.click('.pstep[data-view="list"]');
      await p.waitForTimeout(150);
      const q = await p.evaluate(() => [...document.querySelectorAll('.list-row')].map((r) => r.textContent).join('|'));
      await p.click('.pstep[data-view="plan"]');
      await p.waitForTimeout(150);
      return q;
    };
    await p.evaluate(() => { window.Store.clearPlan(); window.Store.addToDay(1, 'thu'); });
    const at1 = await qty();
    await p.evaluate(() => window.Store.addToDay(1, 'thu', 2));
    const at2 = await qty();
    t.ok('doubling a recipe doubles the shopping', /1 cup/.test(at1) && /2 cups/.test(at2), at1 + '  ->  ' + at2);
    t.ok('the plan shows the multiplier', (await p.textContent('.day-x2')) === '×2');
    await p.click('.day-x2');
    await p.waitForTimeout(150);
    t.ok('and cycles when tapped', (await p.textContent('.day-x2')) === '×3');

    /* ---- anywhere but Plan, "the week" is this week ----------------------- */
    await p.click('#calNext');
    await p.waitForTimeout(150);
    await p.click('.tab[data-view="browse"]');
    const opened = await p.evaluate(() => Number(document.querySelector('#grid .card').dataset.open));
    await p.click('#grid .card >> nth=0');
    await p.click('[data-scale="up"]');
    await p.click('[data-scale="up"]');
    await p.click('.daybtn[data-day="fri"]');
    await p.waitForTimeout(150);
    s = await p.evaluate((id) => ({ wk: window.Store.activeWeek().id, x: window.Store.scaleOf(id, 'fri') }), opened);
    t.ok('a recipe added from Recipes lands on this week, at the size you were looking at',
      s.wk === 'd20260927' && s.x === 4, JSON.stringify(s));
    await p.click('.sheet-x');

    /* ---- cook this again, and templates ---------------------------------- */
    await p.click('.tab[data-view="plan"]');
    await p.click('#calNext');
    await p.waitForTimeout(150);
    await p.click('[data-calagain]');
    await p.waitForTimeout(150);
    await p.click('[data-calfrom="d20260927"]');
    await p.waitForTimeout(250);
    s = await p.evaluate(() => ({ tue: window.Store.day('tue').map((e) => e.id).join(), thu: window.Store.day('thu').map((e) => e.id + 'x' + e.x).join(),
      fri: window.Store.day('fri').length }));
    t.ok('Cook this again fills next week’s empty days from this one, sizes and all, and leaves a planned day alone',
      s.tue === '2' && s.thu === '1x3' && s.fri === 1, JSON.stringify(s));
    await p.click('[data-caltpl]');
    await p.waitForSelector('#dlgInput');
    await p.fill('#dlgInput', 'Freezer week');
    await p.click('[data-dlg="ok"]');
    await p.waitForTimeout(200);
    t.ok('and a week can be saved as a template to cook again',
      await p.evaluate(() => window.Store.sources().some((w) => w.tpl && w.name === 'Freezer week')));

    /* ---- the month ------------------------------------------------------- */
    await p.click('[data-cal="m"]');
    await p.waitForTimeout(200);
    s = await p.evaluate(() => ({ title: document.getElementById('weekTitle').textContent,
      cells: document.querySelectorAll('.cal-cell').length, named: document.querySelectorAll('.cal-cell em').length }));
    t.ok('Month shows October at a glance, with the planned dinners in it',
      s.title === 'October 2026' && s.cells === 35 && s.named >= 5, JSON.stringify(s));
    await p.click('.cal-cell[data-calweek="d20261011"] >> nth=0');
    await p.waitForTimeout(200);
    s = await look();
    t.ok('and tapping a day opens its week', s.id === 'd20261011' && s.title === 'Oct 11 – Oct 17', JSON.stringify(s));

    /* ---- reload ---------------------------------------------------------- */
    await p.reload();
    await p.waitForTimeout(700);
    await p.click('.tab[data-view="plan"]');
    await p.waitForTimeout(200);
    s = await p.evaluate(() => ({ id: window.Store.activeWeek().id, weeks: Object.keys(window.Store.state.weeks).length }));
    t.ok('all of which survives a reload, opening on this week', s.id === 'd20260927' && s.weeks === 3, JSON.stringify(s));
    await p.context().close();

    /* ---- named weeks from before ------------------------------------------ */
    p = await t.fresh();
    await p.clock.setFixedTime(WED);
    await p.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('bsc.weeks', JSON.stringify({
        w1: { name: 'This Week', ord: 0, plan: { mon: [1] }, checked: {} },
        wb: { name: 'Thanksgiving', ord: 1, plan: { thu: [5] }, checked: {} } }));
      localStorage.setItem('bsc.active', JSON.stringify('wb'));
    });
    await p.reload();
    await p.waitForTimeout(700);
    s = await p.evaluate(() => ({ weeks: window.Store.state.weeks, src: window.Store.sources().map((w) => (w.tpl ? 'tpl:' : '') + w.name) }));
    t.ok('"This Week" moves onto this week; another named week becomes a template to cook again',
      s.weeks.d20260927 && (s.weeks.d20260927.plan.mon || []).join() === '1' && !s.weeks.w1 && s.weeks.wb && s.weeks.wb.tpl === 1 &&
        s.src.indexOf('tpl:Thanksgiving') >= 0, JSON.stringify(s));
    await p.context().close();

    p = await t.fresh({ viewport: { width: 390, height: 780 } });
    await p.click('.tab[data-view="plan"]');
    await p.click('#calNext');
    await p.click('[data-cal="m"]');
    await p.waitForTimeout(200);
    const over = await p.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    t.ok('and nothing runs off the side of a phone, week or month', over <= 0, over + 'px');

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
        labels: [...t.querySelectorAll('.tab')].filter((b) => b.offsetParent).map((b) => b.innerText.trim()),
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
      tabs.labels.join('|') === 'Recipes|Plan|Nourish|Strengthen', tabs.labels.join(' '));
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

    /* Nobody reads the top right corner of a header on their way to a recipe,
       so the app says it once in the run of the page. What matters is that it
       is a door rather than a sign — pressing it opens the sharing sheet — and
       that it goes away for good, because a hint that comes back is a nag. */
    const hint = await p.evaluate(() => {
      const el = document.getElementById('shareHint');
      return { shown: el && !el.classList.contains('hide'),
        words: el ? el.textContent.replace(/\s+/g, ' ').trim() : '' };
    });
    t.ok('a new phone is told where sharing lives', hint.shown, hint.words.slice(0, 60));

    await p.click('#shareHintGo');
    await p.waitForTimeout(300);
    t.ok('and pressing it opens the sharing sheet rather than pointing at it',
      await p.evaluate(() => !!document.querySelector('.sync-sheet')));

    await p.click('.sheet-x');
    await p.waitForTimeout(200);
    t.ok('asking the question puts the hint away',
      await p.evaluate(() => document.getElementById('shareHint').classList.contains('hide')));

    await p.reload();
    await p.waitForTimeout(700);
    t.ok('and it stays away across a reload',
      await p.evaluate(() => document.getElementById('shareHint').classList.contains('hide')));

    // and the long names come back where there is room for them
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.waitForTimeout(400);
    const wide = await p.evaluate(() =>
      [...document.querySelectorAll('.tab')].filter((b) => b.offsetParent).map((b) => b.innerText.trim()));
    t.ok('and the full names return on a wider screen',
      // Nourish and Strengthen have no short forms — the book left the row
      // to make room for them
      wide.join('|') === 'Recipes|Meal Plan|Nourish|Strengthen', wide.join(' '));

    /* ---- text somebody typed is text, not markup -------------------------
     *
     * Nothing in this suite tested escaping at all. Removing every replace()
     * from esc() and running the lot came back green, which is as good as
     * saying the app has no opinion on the difference between a week called
     * "Mum's" and a week called "<img onerror=...>".
     *
     * It matters more here than on most pages, because a household is other
     * people's writing: a week name, a recipe, a shelf item typed on one phone
     * is rendered on every other phone in the house. So the strings below go in
     * through the same doors that text arrives through and are looked for as
     * elements, which is the only version of this question that has an answer —
     * "does it appear escaped" can be true of markup that also ran.
     */
    const HOSTILE = '<img src=x onerror="window.__ran=1">&"\'';
    await p.evaluate((s) => {
      window.__ran = 0;
      window.Store.saveTemplate(s);
      window.Store.addPantryItem(s, 'Yours');
    }, HOSTILE);
    await p.waitForTimeout(300);
    await p.click('.tab[data-view="plan"]').then(() => p.click('.pstep[data-view="pantry"]')).then(() => p.evaluate(() => { const d = document.getElementById('storePart'); if (d) d.open = true; }));
    await p.waitForTimeout(300);

    const hostile = await p.evaluate((s) => ({
      ran: window.__ran,
      injected: document.querySelectorAll('img[src="x"]').length,
      weekName: (window.Store.weeks().find((w) => w.name === s) || {}).name,
      shownSomewhere: document.body.textContent.indexOf(s) >= 0,
    }), HOSTILE);

    t.ok('a week named like an attack does not become one',
      hostile.ran === 0 && hostile.injected === 0, JSON.stringify(hostile));
    t.ok('and is kept and shown as the words that were typed',
      hostile.weekName === HOSTILE && hostile.shownSomewhere, JSON.stringify(hostile));

    /* ---- what another phone in the household can send ----
     *
     * A household code can be read aloud, so what arrives under it is input.
     * A recipe id with a quote and an img tag in it went straight into four
     * attributes of the plan grid and ran script on every member's phone; a
     * day that was not a list took the plan and the list down for good. */
    {
      const q = await t.fresh();
      const errs = [];
      q.on('pageerror', (e) => errs.push(e.message));
      await q.evaluate(() => {
        // __pw is the plan-my-week test hook; this marker is its own
        const bad = 'u1"><img src=x onerror="window.__idRan=1">';
        const rec = (name) => ({ book: 3, secNum: 1, secName: 'Ours', name, servings: '2 servings', servN: 2,
          ing: ['1 cup rice'], steps: ['Cook it.'], macro: { kcal: 300, p: 20, c: 30, f: 8, na: 300, fib: 3 } });
        const mine = {}; mine[bad] = rec('Trap'); mine.uok1 = rec('Fine rice'); mine.constructor = rec('Proto');
        localStorage.setItem('bsc.mine', JSON.stringify(mine));
        localStorage.setItem('bsc.weeks', JSON.stringify({ w1: { name: 'This Week', ord: 0, checked: {},
          plan: { mon: [bad, { i: 'uok1', x: 2 }], tue: 'not a list', wed: [{ i: {} }, 'constructor', null, 27], thu: [{ i: 27, x: 'lots' }] } } }));
        localStorage.setItem('bsc.active', JSON.stringify('w1'));
        localStorage.setItem('bsc.pantryNew', JSON.stringify({ a: { l: 5, c: 'constructor' }, b: { l: 'Rice', c: 'Grains' }, c: 'x' }));
      });
      await q.reload();
      await q.click('.tab[data-view="plan"]');
      await q.waitForTimeout(300);
      const r = await q.evaluate(() => ({
        ran: !!window.__idRan || !!document.querySelector('img[src="x"]'),
        mon: window.Store.day('mon').map((e) => e.id + 'x' + e.x).join(),
        tue: window.Store.day('tue').length, wed: window.Store.day('wed').map((e) => e.id).join(), thu: window.Store.day('thu').map((e) => e.x).join(),
        mine: Object.keys(window.Store.state.mine).sort().join(), pn: Object.keys(window.Store.state.pantryNew).join(),
        drawn: document.querySelectorAll('.day-item-name').length,
      }));
      t.ok('a hostile recipe id from the household never runs, and never arrives', !r.ran && r.mine === 'uok1', JSON.stringify(r));
      t.ok('a day that is not a list, and entries that are not ids, are dropped; the rest of the week stands',
        r.mon === 'uok1x2' && r.tue === 0 && r.wed === '27' && r.thu === '1' && r.drawn >= 3, JSON.stringify(r));
      t.ok('a pantry item without a label is dropped', r.pn === 'b', r.pn);
      t.ok('and nothing on the page threw', !errs.length, errs.join(' | '));
      await q.context().close();
    }

    /* Back out of "Back to the storehouse list?" is Cancel, not Reset. */
    {
      const ctx = await t.browser.newContext({ viewport: { width: 1000, height: 900 } });
      const q = await ctx.newPage();
      await q.goto(t.base + 'index.html');
      await q.evaluate(() => localStorage.clear());
      await q.reload();
      await q.waitForTimeout(500);
      await q.click('.tab[data-view="plan"]').then(() => q.click('.pstep[data-view="pantry"]')).then(() => q.evaluate(() => { const d = document.getElementById('storePart'); if (d) d.open = true; }));
      await q.waitForTimeout(300);
      await q.evaluate(() => window.Store.setPantry('cottage_cheese', false));
      await q.waitForTimeout(300);
      await q.click('#pantryReset');
      await q.waitForTimeout(300);
      await q.goBack();
      await q.waitForTimeout(500);
      const r = await q.evaluate(() => ({ kept: window.Store.pantryHas('cottage_cheese', true), dlg: !!document.querySelector('#dialogRoot .dlg') }));
      t.ok('swiping back on the reset question keeps what you ticked off', r.kept === false && !r.dlg, JSON.stringify(r));
      await ctx.close();
    }

    /* ---- the back gesture, on every sheet there is ---- */
    for (const [what, open] of [
      ['a recipe', async (q) => { await q.evaluate(() =>
        document.querySelector('.card[data-open]').click()); await q.waitForTimeout(350); }],
      ['the Share sheet', async (q) => { await q.click('#syncBtn'); await q.waitForTimeout(350); }],
      ['the editor', async (q) => { await q.click('#newRecipe'); await q.waitForTimeout(450); }],
      ['a confirm dialog', async (q) => {
        await q.click('.tab[data-view="plan"]').then(() => q.click('.pstep[data-view="pantry"]')).then(() => q.evaluate(() => { const d = document.getElementById('storePart'); if (d) d.open = true; })); await q.waitForTimeout(350);
        await q.evaluate(() => window.Store.setPantry('cottage_cheese', false));
        await q.waitForTimeout(350);
        await q.click('#pantryReset'); await q.waitForTimeout(350);
      }],
    ]) {
      const r = await backLeavesYouHere(t, open);
      t.ok('back out of ' + what + ' closes it without leaving the app',
        r.opened && r.after.path.indexOf('welcome') < 0 && !r.after.sheet,
        JSON.stringify(r));
    }

    await p.context().close();
  },
};
