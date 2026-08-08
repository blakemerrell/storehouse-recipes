/* The pantry.
 *
 * The books were written against the storehouse order, and every ingredient
 * records whether the storehouse carried it. That is a fact about a shop, not
 * about a kitchen, and it is baked into the data. The pantry turns it into a
 * default that a household can answer over the top of, so the app is still
 * telling you the truth after you stop shopping there.
 *
 * What is worth asserting is not the list — a list of 114 things renders or it
 * does not — but that changing it actually changes what the app tells you to
 * buy, in all three places that answer that question.
 */

module.exports = {
  name: 'The pantry',
  async run(t) {
    const ctx = await t.browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => t.ok('no uncaught error on the page', false, e.message));
    await p.goto(t.base + 'index.html');
    await p.evaluate(() => localStorage.clear());
    await p.reload();
    await p.waitForTimeout(700);

    await p.click('.tab[data-view="pantry"]');
    await p.waitForTimeout(400);

    const shape = await p.evaluate(() => ({
      shelves: document.querySelectorAll('.shelf').length,
      items: document.querySelectorAll('.pitem').length,
      kept: document.querySelectorAll('.pitem input:checked').length,
    }));
    t.ok('it opens on the storehouse order, every shelf of it',
      shape.shelves === 16 && shape.items === 114, JSON.stringify(shape));
    /* The nine the storehouse never carried start ticked off, because that is
       what the books already say about them. */
    t.ok('with the nine it never carried already ticked off',
      shape.kept === 105, shape.kept + ' kept');

    // a recipe whose ingredients are all on the standard order
    const dish = await p.evaluate(() => {
      const r = window.RECIPES.find((x) => x.id === 1);
      return { id: r.id, name: r.name };
    });
    const foot = async () => {
      await p.click('.tab[data-view="browse"]'); await p.waitForTimeout(300);
      await p.click('.card'); await p.waitForTimeout(300);
      const s = await p.evaluate(() => {
        const e = document.querySelector('.sheet-extras');
        return e ? e.textContent.trim() : '';
      });
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      return s;
    };
    t.ok('a recipe you have everything for says nothing about shopping',
      (await foot()) === '', dish.name);

    // stop keeping one of its ingredients
    await p.click('.tab[data-view="pantry"]'); await p.waitForTimeout(300);
    await p.click('[data-pantry="cottage_cheese"]'); await p.waitForTimeout(400);

    t.ok('ticking something off is counted', /104 of 114/.test(await p.textContent('#pantryNote')),
      await p.textContent('#pantryNote'));

    /* The point of the whole feature: the recipe changes its mind. */
    t.ok('and the recipe now says what you would have to go out for',
      /Not on your shelf: Cottage cheese/.test(await foot()), await foot());

    // and so does the shopping list
    await p.evaluate(() => window.Store.addToDay(1, 'mon'));
    await p.click('.tab[data-view="list"]'); await p.waitForTimeout(600);
    const list = await p.evaluate(() => {
      const g = [...document.querySelectorAll('.list-group')];
      return g.map((x) => ({
        title: x.querySelector('.list-group-title').textContent.trim(),
        items: [...x.querySelectorAll('.list-row')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()),
      }));
    });
    const buy = list.find((g) => /pick up/i.test(g.title));
    t.ok('the shopping list moves it to what you must buy',
      !!buy && buy.items.some((i) => /Cottage cheese/i.test(i)), JSON.stringify(list));

    /* Seasonings share one food key and are not in the pantry at all. Defaulting
       an unknown key to "missing" put salt and vanilla under things to buy —
       which the storehouse flag never did. */
    t.ok('and seasonings do not fall through onto it',
      !!buy && !buy.items.some((i) => /vanilla|salt|pepper|cinnamon/i.test(i)),
      buy ? buy.items.join(' | ') : 'no buy list');

    // something of your own, which the books have never heard of
    await p.click('.tab[data-view="pantry"]'); await p.waitForTimeout(300);
    await p.evaluate(() => window.Store.addPantryItem('Olive oil', 'Yours'));
    await p.waitForTimeout(300);
    await p.reload(); await p.waitForTimeout(700);
    await p.click('.tab[data-view="pantry"]'); await p.waitForTimeout(400);
    const own = await p.evaluate(() => {
      const h = [...document.querySelectorAll('.shelf-h')].map((e) => e.textContent);
      return { last: h[h.length - 1], note: document.getElementById('pantryNote').textContent };
    });
    t.ok('what you add yourself gets a shelf and survives a reload',
      own.last === 'Yours' && /115/.test(own.note), JSON.stringify(own));

    // and back to the book
    await p.evaluate(() => window.Store.resetPantry());
    await p.waitForTimeout(300);
    await p.click('.tab[data-view="browse"]'); await p.waitForTimeout(300);
    t.ok('resetting puts the storehouse list back', (await foot()) === '');
    t.ok('but keeps what you added yourself',
      await p.evaluate(() => !!window.Store.pantryOwn().own_olive_oil));

    await ctx.close();
  },
};
