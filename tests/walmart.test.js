/* Walmart cart: the shopping list sent to Walmart in one tap.
 *
 * Blake, planning for the day the storehouse is not where the food comes
 * from. The link is walmart.com/sc/cart/addToCart?items=ID_QTY,... (the one
 * MacroRx used); the packs come from tools/walmart.js through PANTRY, so
 * every figure here is read from the data, not typed in. */

module.exports = {
  name: 'Walmart cart',
  async run(t) {
    const p = await t.fresh({ viewport: { width: 390, height: 844 } });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));

    const rules = await p.evaluate(() => {
      const W = window.__wm, P = window.PANTRY, bad = [];
      const on = P.onion.wm, rice = P.rice_dry.wm;
      const L = W.lines([
        { key: 'onion', label: 'Onions', g: on[1] * 1.2 },
        { key: 'onion', label: 'Onions', g: 10 },
        { key: 'rice_cooked', label: 'Cooked rice', g: rice[1] },
        { key: 'carne_asada', label: 'Carne asada', g: 500 },
      ]);
      const o = L.cart.find((l) => l.key === 'onion');
      if (!o || o.id !== on[0] || o.qty !== 2) bad.push('onion: the same food adds up, and packs round up ' + JSON.stringify(o));
      const r = L.cart.find((l) => l.key === 'rice_dry');
      if (!r || r.qty !== 1) bad.push('cooked rice is bought as a third as much dry rice ' + JSON.stringify(r));
      if (!L.find.some((l) => l.key === 'flank_steak')) bad.push('carne asada is bought as flank steak, which has no pack, so it is searched');
      const url = W.url(L.cart);
      if (!/^https:\/\/www\.walmart\.com\/sc\/cart\/addToCart\?items=\d+_\d+(,\d+_\d+)*$/.test(url)) bad.push('url ' + url);
      if (W.parse('https://www.walmart.com/ip/Beef-Flank-Steak/123456789?athbdg=L1600') !== '123456789') bad.push('a product link gives its number');
      if (W.parse('987654321') !== '987654321' || W.parse('flank') !== '') bad.push('a bare number, and nothing from words');
      localStorage.setItem('sh.wm', JSON.stringify({ flank_steak: '123456789' }));
      const L2 = W.lines([{ key: 'carne_asada', label: 'Carne asada', g: 500 }]);
      if (!(L2.cart[0] && L2.cart[0].id === '123456789')) bad.push('a pasted number puts it in the cart');
      /* Crio Bru is not a Walmart food: it says where it is bought instead. */
      const L3 = W.lines([{ key: 'crio_bru', label: 'Crio Bru', g: 100 }]);
      if (!(L3.away[0] && /Lin/.test(L3.away[0].where) && /^https:/.test(L3.away[0].url) && !L3.cart.length && !L3.find.length)) bad.push('Crio Bru is sent to Lin\u2019s or online ' + JSON.stringify(L3));
      localStorage.removeItem('sh.wm');
      return bad;
    });
    t.ok('packs add up and round up, made foods are bought as what they are made from, and a pasted number wins',
      rules.length === 0, rules.join('; '));

    /* A week of three dinners, then the list. */
    await p.evaluate(() => {
      const d = window.RECIPES.filter((r) => r.book === 2 && r.secNum === 3).slice(0, 3);
      ['mon', 'tue', 'wed'].forEach((day, i) => window.Store.addToDay(d[i].id, day, 1));
    });
    await p.click('.tab[data-view="plan"]').then(() => p.click('.pstep[data-view="list"]'));
    await p.waitForTimeout(300);
    const read = () => p.evaluate(() => {
      const a = document.querySelector('#listWm .wm-btn');
      const href = a ? a.getAttribute('href') : '';
      const items = href ? href.split('items=')[1].split(',') : [];
      return { href, n: items.reduce((t, x) => t + Number(x.split('_')[1]), 0),
        lines: items.length, say: a ? a.textContent : '', ids: items.map((x) => x.split('_')[0]), blank: a ? a.target : '' };
    });
    /* Those three come wholly from the storehouse: nothing to send, until
       the household stops shopping it (step 1 of Plan: Store only). */
    const shelf = await read();
    await p.click('.tab[data-view="plan"]').then(() => p.click('.pstep[data-view="where"]'));
    await p.waitForTimeout(250);
    await p.click('[data-where="w"]');
    await p.waitForTimeout(250);
    await p.click('.tab[data-view="plan"]').then(() => p.click('.pstep[data-view="list"]'));
    await p.waitForTimeout(250);
    const first = await read();
    t.ok('from the storehouse, nothing goes to Walmart; not shopping it, it all does',
      shelf.n === 0 && first.n > 0, JSON.stringify({ shelf: shelf.n, all: first.n }));
    t.ok('the list has one button that fills a Walmart cart, and says how many products it puts in',
      first.n > 0 && new RegExp('Add ' + first.lines + ' items? to Walmart cart').test(first.say) && first.blank === '_blank',
      JSON.stringify(first));

    /* Ticking a line off takes it out of the cart. */
    const firstKey = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('#listBody [data-check]')];
      const want = rows.find((r) => (window.PANTRY[r.dataset.check] || {}).wm && !r.checked);
      return want ? want.dataset.check : '';
    });
    const itsId = await p.evaluate((k) => window.PANTRY[k].wm[0], firstKey);
    await p.click('#listBody [data-check="' + firstKey + '"]');
    await p.waitForTimeout(250);
    const ticked = await read();
    t.ok('a line ticked off the list comes out of the cart',
      !!firstKey && first.ids.indexOf(itsId) >= 0 && ticked.ids.indexOf(itsId) < 0, JSON.stringify({ firstKey, itsId, ticked }));
    await p.click('#listBody [data-check="' + firstKey + '"]');
    await p.waitForTimeout(250);

    /* Have: the line leaves the cart and the kitchen keeps it, for every
       week after; Buy puts it back. */
    await p.click('#listBody [data-src="' + firstKey + '"][data-v="h"]');
    await p.waitForTimeout(250);
    const had = await read();
    const kit = await p.evaluate((k) => window.Store.kitchen(k), firstKey);
    await p.click('#listBody [data-src="' + firstKey + '"][data-v="b"]');
    await p.waitForTimeout(250);
    const back = await read();
    t.ok('marking a line Have takes it out of the cart and into the kitchen; Buy puts it back',
      had.ids.indexOf(itsId) < 0 && kit === 1 && back.ids.indexOf(itsId) >= 0, JSON.stringify({ kit, had: had.ids.length, back: back.ids.length }));

    /* A food with no pack: search it, paste its link, and it goes in. */
    await p.evaluate(() => { document.querySelector('#listWm .wm-fix').open = true; });
    const miss = await p.evaluate(() => {
      const i = document.querySelector('#listWm .wm-id');
      return i ? i.dataset.wmid : '';
    });
    await p.fill('#listWm [data-wmid="' + miss + '"]', 'https://www.walmart.com/ip/Something/55555555');
    await p.press('#listWm [data-wmid="' + miss + '"]', 'Enter');
    await p.locator('#listWm [data-wmid="' + miss + '"]').blur();
    await p.waitForTimeout(250);
    const pasted = await read();
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('sh.wm') || '{}'));
    t.ok('a pasted product link is kept and that product goes in the cart',
      saved[miss] === '55555555' && pasted.ids.indexOf('55555555') >= 0, JSON.stringify({ miss, saved, ids: pasted.ids }));

    /* Plan my week's list carries the same button. */
    await p.evaluate(() => localStorage.setItem('sh.pw', JSON.stringify({ days: ['thu', 'fri'], shelf: false })));
    await p.click('.tab[data-view="plan"]');
    await p.waitForTimeout(250);
    await p.click('#planMyWeek');
    await p.waitForTimeout(250);
    await p.click('[data-pwgo="2"]');
    await p.waitForTimeout(300);
    await p.click('[data-pwgo="3"]');
    await p.waitForTimeout(300);
    const pw = await p.evaluate(() => {
      const a = document.querySelector('.pw-sheet .wm-btn');
      return a ? a.getAttribute('href') : '';
    });
    t.ok('Plan my week’s shopping list sends to Walmart too', /addToCart\?items=\d+_\d+/.test(pw), pw);
    t.ok('with no error on the page', errs.length === 0, errs.join(' | '));
    await p.context().close();
  },
};
