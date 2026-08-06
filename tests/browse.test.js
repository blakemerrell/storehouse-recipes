/* Browsing, filtering, sorting, searching, and the recipe panel. */

module.exports = {
  name: 'Browse',
  async run(t) {
    const p = await t.fresh();

    const n = await p.evaluate(() => document.querySelectorAll('.card').length);
    t.ok('all 257 recipes are on the page', n === 257, n);

    // filters
    await p.click('[data-book="1"]');
    await p.waitForTimeout(150);
    t.ok('one volume at a time',
      (await p.evaluate(() => document.querySelectorAll('.card').length)) === 100);

    await p.click('[data-book="all"]');
    await p.selectOption('#diffSel', 'In-Depth');
    await p.waitForTimeout(150);
    // effort is not printed on the card, so check the recipes behind the cards
    const hard = await p.evaluate(() => {
      const shown = [...document.querySelectorAll('.card')].map((c) => c.dataset.open);
      const by = {}; window.RECIPES.forEach((r) => { by[r.id] = r; });
      return shown.length && shown.every((id) => by[id].diff === 'In-Depth');
    });
    t.ok('effort filters to what it says', hard);
    await p.selectOption('#diffSel', 'all');

    await p.selectOption('#pantrySel', 'base');
    await p.waitForTimeout(150);
    const onlyBase = await p.evaluate(() =>
      [...document.querySelectorAll('.card')].every((c) => !/Also needs/.test(c.textContent)));
    t.ok('storehouse-only really is storehouse-only', onlyBase);
    await p.selectOption('#pantrySel', 'all');

    // sorting
    await p.selectOption('#sortSel', 'healthy');
    await p.waitForTimeout(200);
    const scores = await p.evaluate(() =>
      [...document.querySelectorAll('.leaf-n')].slice(0, 12).map((e) => parseInt(e.textContent, 10)));
    t.ok('healthiest first really is descending',
      scores.every((s, i) => i === 0 || scores[i - 1] >= s), scores.join(','));

    await p.selectOption('#sortSel', 'quick');
    await p.waitForTimeout(200);
    const first = await p.textContent('.card-meta');
    t.ok('quickest first starts at the quickest', /^[1-5] mins?\b/.test(first), first);
    await p.selectOption('#sortSel', 'book');

    // search covers names, ingredients and sections
    await p.fill('#search', 'buttermilk');
    await p.waitForTimeout(200);
    const found = await p.evaluate(() => document.querySelectorAll('.card').length);
    t.ok('search reaches into the ingredients', found > 0 && found < 20, found);
    await p.fill('#search', '');

    // favorites survive a reload
    await p.click('#grid .card:nth-child(2)');
    await p.click('[data-fav]');
    await p.waitForTimeout(200);
    await p.click('.sheet-x');
    await p.reload();
    await p.waitForTimeout(400);
    t.ok('a favorite sticks', (await p.textContent('#favCount')) === '(1)', await p.textContent('#favCount'));

    // the panel: scaling the ingredients, and the score breakdown
    await p.click('#grid .card:nth-child(1)');
    const before = await p.textContent('.sheet-ing');
    await p.click('[data-scale="up"]');
    const after = await p.textContent('.sheet-ing');
    t.ok('doubling changes the ingredients', before !== after);
    t.ok('and reads as fractions, not decimals', !/\d\.\d/.test(after), after.slice(0, 80));

    const panel = await p.textContent('.sheet');
    const bands = await p.evaluate(() => {
      const seen = {};
      document.querySelectorAll('.leaf').forEach((l) => {
        const n = parseInt(l.querySelector('.leaf-n').textContent, 10);
        const b = l.className.match(/leaf-(good|ok|low)/)[1];
        seen[b] = seen[b] || [];
        if (seen[b].length < 40) seen[b].push(n);
      });
      return seen;
    });
    t.ok('every score sits in a leaf, banded by what it says',
      (bands.good || []).every((n) => n >= 70) &&
      (bands.ok || []).every((n) => n >= 45 && n < 70) &&
      (bands.low || []).every((n) => n < 45),
      JSON.stringify(Object.keys(bands).map((k) => k + ':' + bands[k].length)));

    /* The score is a sum of five weighted parts, and the stack is drawn that
       way: one row per part, its track as long as the points that part is
       worth, filled by what the recipe earned. So the ink down the stack has
       to come to the score. */
    const nut = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('.nrow')].map((r) => ({
        track: parseFloat(r.querySelector('.ntrack').style.width),
        fill: parseFloat(r.querySelector('.ntrack i').style.width),
        points: Number(r.querySelector('.nnum').textContent),
        band: r.className.match(/nr-(good|ok|low)/)[1],
        mark: r.querySelector('.nmark') ? 'drawn' : r.querySelector('.nltr').textContent,
      }));
      const foot = document.querySelector('.nut-foot');
      const panel = document.querySelector('.nut');
      return {
        rows,
        score: Number(document.querySelector('.leaf-n').textContent),
        /* scrollWidth is no use here: a wrapped flex row still fits its box.
           Count the distinct tops instead. */
        footRows: new Set([...foot.children].map((c) =>
          Math.round(c.getBoundingClientRect().top))).size,
        height: Math.round(panel.getBoundingClientRect().height),
        /* the stack is capped at the leaf, which is the whole point of it */
        stack: Math.round(document.querySelector('.nut-rows').getBoundingClientRect().height),
        leaf: Math.round(document.querySelector('.leaf-big').getBoundingClientRect().height),
      };
    });

    t.ok('one row per part, each track as long as the points it is worth',
      nut.rows.map((r) => Math.round(r.track)).join() === '100,67,33,83,50',
      JSON.stringify(nut.rows.map((r) => r.track)));

    const inked = nut.rows.reduce((n, r) => n + 30 * (r.track / 100) * (r.fill / 100), 0);
    t.ok('and the ink down the stack comes to the score',
      Math.abs(inked - nut.score) < 1.5, Math.round(inked) + ' vs ' + nut.score);

    t.ok('with the points beside each bar, adding up to the same',
      nut.rows.length === 5 &&
      Math.abs(nut.rows.reduce((n, r) => n + r.points, 0) - nut.score) < 1.5,
      JSON.stringify(nut.rows.map((r) => r.points)));

    /* Letters run out — F is already fat, and S could be sodium, salt or sugar
       — so the last two are drawn instead. */
    t.ok('marked P, C, F and then a shaker and an ear of wheat',
      nut.rows.map((r) => r.mark).join() === 'P,C,F,drawn,drawn',
      JSON.stringify(nut.rows.map((r) => r.mark)));

    t.ok('a bar short of its points is coloured differently from a full one',
      new Set(nut.rows.map((r) => r.band)).size > 1,
      nut.rows.map((r) => r.band).join(' '));

    t.ok('the macro line holds one row without wrapping',
      nut.footRows === 1, nut.footRows + ' rows');

    /* The complaint that produced this shape: on a two-step recipe the panel
       was taller than the recipe. The stack ends where the leaf ends. */
    t.ok('the stack of bars stays inside the leaf\u2019s own height',
      nut.stack <= nut.leaf, nut.stack + 'px of bars, ' + nut.leaf + 'px of leaf');

    t.ok('and the whole panel stays out of the recipe\u2019s way',
      nut.height < 100, nut.height + 'px tall');

    await p.context().close();

    /* A desk is the easy case. The panel is read on a phone, where the macro
       line has 242px next to the leaf \u2014 so check the widest of all 257 there,
       not just whichever recipe happens to be first. */
    const phone = await t.fresh({ viewport: { width: 376, height: 860 } });
    await phone.click('#grid .card:nth-child(1)');
    await phone.waitForTimeout(200);
    const wide = await phone.evaluate(() => {
      const foot = document.querySelector('.nut-foot');
      const rows = () => new Set([...foot.children]
        .map((c) => Math.round(c.getBoundingClientRect().top))).size;
      const bad = [];
      window.RECIPES.forEach((r) => {
        if (r.score === null || !r.macro) return;
        const m = r.macro;
        foot.innerHTML = [m.kcal + ' kcal', Math.round(m.p) + 'g P', Math.round(m.c) + 'g C',
          Math.round(m.f) + 'g F', m.na + 'mg S', (m.fib < 1 ? m.fib : Math.round(m.fib)) + 'g Fib']
          .map((x) => '<span>' + x + '</span>').join('<i>&middot;</i>');
        if (rows() > 1) bad.push(r.name);
      });
      return bad;
    });
    t.ok('on a phone it holds one row for every recipe in the collection',
      wide.length === 0, wide.length + ' wrap, e.g. ' + wide.slice(0, 3).join('; '));

    const small = await phone.evaluate(() => ({
      height: Math.round(document.querySelector('.nut').getBoundingClientRect().height),
      stack: Math.round(document.querySelector('.nut-rows').getBoundingClientRect().height),
      leaf: Math.round(document.querySelector('.leaf-big').getBoundingClientRect().height),
      barsFit: [...document.querySelectorAll('.nrow')].every((r) =>
        r.scrollWidth <= r.clientWidth + 1),
    }));
    t.ok('and on a phone it still fits, bars and all',
      small.barsFit && small.stack <= small.leaf && small.height < 100,
      JSON.stringify(small));

    await phone.context().close();
  },
};
