/* The shopping list: one line per thing, and the quantities added up.
 *
 * These are the two faults the list had for most of its life — a diced apple
 * and a sliced apple on separate lines, and "1 cup + 1 cup + 2 tbsp" where a
 * total belonged — so they are worth holding onto. */

module.exports = {
  name: 'Shopping list',
  async run(t) {
    const p = await t.fresh();

    // ---- one line per thing ------------------------------------------------
    const all = await p.evaluate(() => {
      const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      window.RECIPES.forEach((r, i) => window.Store.addToDay(r.id, days[i % 7]));
      document.querySelector('.tab[data-view="list"]').click();
      return [...document.querySelectorAll('.list-row span:not(.qty)')].map((e) => e.textContent);
    });
    t.ok('every recipe in both books makes one list, not a heap',
      all.length > 100 && all.length < 170, all.length + ' lines');

    const dupes = ['apple', 'chicken breast', 'onion', 'cucumber', 'whey'].map((w) => {
      const hits = all.filter((l) => new RegExp('\\b' + w, 'i').test(l));
      return w + ': ' + hits.join(' / ');
    });
    t.ok('an apple is an apple however it was cut',
      all.filter((l) => /apple/i.test(l)).join() === 'Apples,Applesauce',
      all.filter((l) => /apple/i.test(l)).join(' / '));
    t.ok('but canned chicken is not a chicken breast',
      all.indexOf('Canned chicken') >= 0 && all.indexOf('Chicken breasts') >= 0, dupes[1]);
    t.ok('nothing appears twice, not even across the two headings',
      new Set(all).size === all.length,
      all.filter((x, i) => all.indexOf(x) !== i).join(', '));

    // ---- quantities --------------------------------------------------------
    await p.evaluate(() => {
      window.Store.clearPlan();
      const hits = window.RECIPES.filter((r) => r.ing.some((i) => /cottage cheese/i.test(i))).slice(0, 3);
      hits.forEach((r, i) => window.Store.addToDay(r.id, ['mon', 'tue', 'wed'][i]));
    });
    await p.waitForTimeout(250);
    const cc = await p.evaluate(() => {
      const row = [...document.querySelectorAll('.list-row')]
        .find((r) => /Cottage cheese/.test(r.textContent));
      return row ? row.querySelector('.qty').textContent : '';
    });
    t.ok('three recipes of cottage cheese come to one number',
      /^\d/.test(cc) && cc.indexOf('+') < 0 && /cups?$/.test(cc), cc);

    // ---- what does and does not get a number -------------------------------
    await p.evaluate(() => {
      window.Store.clearPlan();
      // a yeasted bread: flour by the cup, salt by the pinch
      const r = window.RECIPES.find((x) => x.ing.some((i) => /yeast/i.test(i)));
      window.Store.addToDay(r.id, 'mon');
    });
    await p.waitForTimeout(250);
    const rows = await p.evaluate(() => [...document.querySelectorAll('.list-row')].map((r) => ({
      name: r.querySelector('span:not(.qty)').textContent,
      qty: r.querySelector('.qty').textContent,
    })));
    const salt = rows.find((r) => /^Salt$/.test(r.name));
    const flour = rows.find((r) => /Flour/.test(r.name));
    t.ok('staples carry a quantity', flour && /cup/.test(flour.qty), JSON.stringify(flour));
    t.ok('seasonings do not, because nobody shops for two teaspoons of salt',
      !salt || salt.qty === '', JSON.stringify(salt));
    t.ok('water never appears at all', !rows.some((r) => /^Water$/.test(r.name)),
      rows.map((r) => r.name).join(', '));

    // ---- spoons roll up into cups -----------------------------------------
    const big = await p.evaluate(() => {
      window.Store.clearPlan();
      // enough ranch dressing that tablespoons stop being a sensible unit
      const r = window.RECIPES.find((x) => x.ing.some((i) => /ranch/i.test(i)));
      window.Store.addToDay(r.id, 'mon', 8);
      return null;
    });
    await p.waitForTimeout(250);
    const ranch = await p.evaluate(() => {
      const row = [...document.querySelectorAll('.list-row')].find((r) => /Ranch/.test(r.textContent));
      return row ? row.querySelector('.qty').textContent : '';
    });
    t.ok('a great many tablespoons become cups', /cup/.test(ranch), ranch);

    // ---- storehouse and extras stay apart ---------------------------------
    await p.evaluate(() => {
      window.Store.clearPlan();
      const r = window.RECIPES.find((x) => x.extras);
      window.Store.addToDay(r.id, 'mon');
    });
    await p.waitForTimeout(250);
    const groups = await p.evaluate(() =>
      [...document.querySelectorAll('.list-group-title')].map((e) => e.textContent));
    t.ok('what you have and what you must buy are separate lists',
      groups.length === 2 && /storehouse/i.test(groups[0]) && /extras/i.test(groups[1]), groups.join(' | '));

    await p.context().close();
  },
};
