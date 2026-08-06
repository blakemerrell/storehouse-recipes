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

    /* The score is a sum of five weighted parts, and the bar is drawn that way:
       one slot per part, as wide as the points it is worth, filled by what the
       recipe earned. So the ink across the bar has to come to the score. */
    const nut = await p.evaluate(() => {
      const slots = [...document.querySelectorAll('.nut-slot')].map((s) => ({
        weight: Number(getComputedStyle(s).flexGrow),
        fill: parseFloat(s.querySelector('i').style.width),
        band: s.querySelector('i').className,
      }));
      const keys = [...document.querySelectorAll('.nk')].map((k) => k.textContent.trim());
      const foot = document.querySelector('.nut-foot');
      const panel = document.querySelector('.nut');
      return {
        slots, keys,
        score: Number(document.querySelector('.leaf-n').textContent),
        footFits: foot.scrollWidth <= foot.clientWidth + 1,
        height: Math.round(panel.getBoundingClientRect().height),
      };
    });

    t.ok('the bar has a slot per part, weighted by what each is worth',
      nut.slots.map((s) => s.weight).join() === '30,20,10,25,15',
      JSON.stringify(nut.slots.map((s) => s.weight)));

    const inked = nut.slots.reduce((n, s) => n + s.weight * s.fill / 100, 0);
    t.ok('and the ink across it comes to the score',
      Math.abs(inked - nut.score) < 1.5, Math.round(inked) + ' vs ' + nut.score);

    t.ok('each part is named with its points beside the bar',
      nut.keys.length === 5 && /protein$/.test(nut.keys[0]) && /fiber$/.test(nut.keys[4]),
      JSON.stringify(nut.keys));

    t.ok('a slot short of its points is coloured differently from a full one',
      new Set(nut.slots.map((s) => s.band)).size > 1,
      nut.slots.map((s) => s.band).join(' '));

    t.ok('the macro line holds one row without wrapping', nut.footFits);

    /* The complaint that produced this shape: on a two-step recipe the panel
       was taller than the recipe. It has to stay small. */
    t.ok('and the whole panel stays out of the recipe\u2019s way',
      nut.height < 150, nut.height + 'px tall');

    await p.context().close();
  },
};
