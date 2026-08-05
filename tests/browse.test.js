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

    const parts = await p.evaluate(() =>
      [...document.querySelectorAll('.nut-row')].map((r) => ({
        k: r.querySelector('.nut-k').textContent,
        v: r.querySelector('.nut-v').textContent,
        w: r.querySelector('.nut-bar i').style.width,
        p: r.querySelector('.nut-p').textContent,
      })));
    t.ok('the panel breaks the score into its five parts',
      parts.map((x) => x.k).join(',') === 'Protein,Calories,Fat,Sodium,Fiber',
      JSON.stringify(parts.map((x) => x.k)));
    t.ok('each with a figure, a bar drawn to its share, and its points',
      parts.length === 5 && parts.every((x) => x.v && /%$/.test(x.w) && /^\d+\/\d+$/.test(x.p)),
      JSON.stringify(parts));
    const foot = await p.evaluate(() => {
      const f = document.querySelector('.nut-foot');
      return { text: f.textContent.replace(/\s+/g, ' ').trim(), fits: f.scrollWidth <= f.clientWidth + 1 };
    });
    t.ok('the macro line holds one row without wrapping',
      foot.fits && /kcal/.test(foot.text) && /g P/.test(foot.text) && /mg S/.test(foot.text) &&
      /g Fib/.test(foot.text), foot.text);

    t.ok('and the bars agree with the points',
      parts.every((x) => {
        const [got, max] = x.p.split('/').map(Number);
        return Math.abs(parseFloat(x.w) - (got / max) * 100) < 1.5;
      }), JSON.stringify(parts));

    await p.context().close();
  },
};
