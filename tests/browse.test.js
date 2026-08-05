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
      [...document.querySelectorAll('.chip')].slice(0, 12).map((e) => parseInt(e.textContent, 10)));
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

    const why = await p.textContent('.score-why, .sheet-score, .sc-why').catch(() => '');
    const panel = await p.textContent('.sheet');
    t.ok('the score panel names all five parts',
      /protein/.test(panel) && /sodium/.test(panel) && /fiber/.test(panel) &&
      /kcal per serving/.test(panel) && /from fat/.test(panel),
      (why || panel).slice(0, 160));

    await p.context().close();
  },
};
