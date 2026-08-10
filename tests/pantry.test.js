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
      shelves: document.querySelectorAll('.shelf:not(.shelf-gone)').length,
      kept: document.querySelectorAll('.shelf:not(.shelf-gone) .pitem').length,
      gone: document.querySelectorAll('.shelf-gone .pitem').length,
      boxes: document.querySelectorAll('#pantryBody input[type=checkbox]').length,
    }));
    t.ok('it opens on the storehouse order, every shelf of it',
      shape.shelves === 16 && shape.kept === 100, JSON.stringify(shape));
    /* The fourteen the storehouse never carried are not on the shelf, so they
       sit under what is not kept rather than in the list proper. Five of those
       fourteen were wrong until a reader said so: an ingredient no recipe
       flagged looked exactly like a staple, which had the book quietly claiming
       you could pick up Crio Bru with the flour. */
    t.ok('with the fourteen it never carried listed as not kept',
      shape.gone === 14, JSON.stringify(shape));
    // it is a list of what you keep, not a checklist of what to fetch
    t.ok('and it is a list rather than a checklist', shape.boxes === 0, shape.boxes + ' checkboxes');

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
    await p.click('[data-poff="cottage_cheese"]'); await p.waitForTimeout(400);

    t.ok('taking something off is counted', /99 items/.test(await p.textContent('#pantryNote')),
      await p.textContent('#pantryNote'));

    /* The point of the whole feature: the recipe changes its mind. */
    t.ok('and the recipe now says what you would have to go out for',
      /Not on your shelf: Cottage cheese/.test(await foot()), await foot());

    /* And the ingredient itself is tinted, not just named at the foot — that is
       the difference between reading the list and reading a footnote. */
    const tinted = async () => {
      await p.click('.tab[data-view="browse"]'); await p.waitForTimeout(300);
      await p.click('.card'); await p.waitForTimeout(300);
      const rows = await p.evaluate(() => [...document.querySelectorAll('.sheet-ing div')]
        .map((d) => ({ t: d.textContent.trim(), buy: d.classList.contains('ing-buy') })));
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      return rows;
    };
    const rows = await tinted();
    t.ok('the ingredient line itself is marked, not only the foot',
      rows.some((r) => r.buy && /cottage cheese/i.test(r.t)), JSON.stringify(rows));
    t.ok('and only that one — what you keep stays plain',
      rows.filter((r) => r.buy).length === 1, JSON.stringify(rows.filter((r) => r.buy)));

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
      // the head is a name and a count; the name is the first span
      const h = [...document.querySelectorAll('.shelf-h span:first-child')].map((e) => e.textContent);
      return { last: h.filter((x) => !/Not kept/.test(x)).pop(), note: document.getElementById('pantryNote').textContent };
    });
    t.ok('what you add yourself gets a shelf and survives a reload',
      own.last === 'Yours' && /101 items/.test(own.note), JSON.stringify(own));

    // and back to the book
    await p.evaluate(() => window.Store.resetPantry());
    await p.waitForTimeout(300);
    await p.click('.tab[data-view="browse"]'); await p.waitForTimeout(300);
    t.ok('resetting puts the storehouse list back', (await foot()) === '');
    t.ok('but keeps what you added yourself',
      await p.evaluate(() => !!window.Store.pantryOwn().own_olive_oil));

    /* ---- the shape of it on a screen with room -------------------------
       A hundred things in one column is half a minute of scrolling to answer
       "do I keep cornmeal", and the order sheet it copies is not one column
       either. These assert the two halves of the fix: that the space is used,
       and that using it did not chop a shelf in half down the middle. */
    await p.click('.tab[data-view="pantry"]'); await p.waitForTimeout(300);
    const tall = await p.evaluate(() => document.getElementById('pantryBody').scrollHeight);
    await p.setViewportSize({ width: 1600, height: 1000 });
    await p.waitForTimeout(400);
    const wide = await p.evaluate(() => {
      const body = document.getElementById('pantryBody');
      /* A shelf split across a column boundary has its rows at two different
         x positions. One position per shelf means break-inside held. */
      const split = [...document.querySelectorAll('.shelf:not(.shelf-gone)')].filter((sh) => {
        const xs = new Set([...sh.querySelectorAll('.pitem')]
          .map((i) => Math.round(i.getBoundingClientRect().left)));
        return xs.size > 1;
      }).length;
      return {
        height: body.scrollHeight,
        columns: new Set([...document.querySelectorAll('.shelf:not(.shelf-gone)')]
          .map((s) => Math.round(s.getBoundingClientRect().left))).size,
        split,
        // what is not kept is not a shelf of the storehouse, so it spans them
        goneSpans: Math.round(document.querySelector('.shelf-gone').getBoundingClientRect().width) >=
          Math.round(body.getBoundingClientRect().width) - 2,
      };
    });
    t.ok('with room, the shelves run in columns rather than one long list',
      wide.columns >= 4, wide.columns + ' columns');
    t.ok('and no shelf is broken across two of them', wide.split === 0, wide.split + ' split');
    t.ok('which turns a page you scroll into one you look at',
      wide.height < tall / 2.5, wide.height + 'px wide vs ' + tall + 'px narrow');
    t.ok('what is not kept spans the columns rather than joining them', wide.goneSpans);

    await ctx.close();

    /* The row is 24px of target under a mouse, and revealed by hovering it.
       Neither of those exists on a phone, so both are given back — but the rule
       is about the pointer rather than the width, and a narrow desktop window
       is still a mouse. Which means proving it needs a context that actually
       reports touch, not just a small one. */
    const touch = await t.browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const tp = await touch.newPage();
    await tp.goto(t.base + 'index.html');
    await tp.waitForTimeout(700);
    await tp.click('.tab[data-view="pantry"]'); await tp.waitForTimeout(400);
    const thumb = await tp.evaluate(() => {
      const x = document.querySelector('.pitem-x');
      return { h: x.getBoundingClientRect().height, seen: getComputedStyle(x).opacity };
    });
    t.ok('and on a phone the control is thumb-sized and needs no hovering',
      thumb.h >= 34 && thumb.seen === '1', JSON.stringify(thumb));
    await touch.close();
  },
};
