/* The barcode camera, and what a lookup brings back.
 *
 * The camera here is a canvas: getUserMedia is answered, after a delay the
 * test chooses, with the stream of a small canvas that keeps drawing, which
 * is a real MediaStream a <video> will play. What is checked is whether a
 * stream is still LIVE once nothing wants it — the light on the back of a
 * real phone. Open Food Facts is answered from here too; nothing leaves the
 * machine. */

const CAM = `(function(){
  window.__cam = { asked: 0, streams: [], delay: 400 };
  navigator.mediaDevices.getUserMedia = function () {
    window.__cam.asked++;
    return new Promise(function (ok) { setTimeout(function () {
      var c = document.createElement('canvas'); c.width = 64; c.height = 48;
      var g = c.getContext('2d'), n = 0;
      setInterval(function () { g.fillStyle = (n++ % 2) ? '#fff' : '#000'; g.fillRect(0, 0, 64, 48); }, 50);
      var s = c.captureStream(10); window.__cam.streams.push(s); ok(s);
    }, window.__cam.delay); });
  };
})();`;

const live = (p) => p.evaluate(() => window.__cam.streams.filter((s) => s.getTracks().some((tr) => tr.readyState === 'live')).length);

const product = (name, nut) => JSON.stringify({ status: 1, product: { product_name: name, brands: 'Test', serving_size: '30 g', nutriments: nut } });

module.exports = {
  name: 'Barcodes and lookups',
  async run(t) {
    async function open(opts) {
      const p = await t.fresh({ viewport: { width: 412, height: 915 } });
      await p.context().addInitScript(CAM);
      if (opts && opts.detector) {
        await p.context().addInitScript(() => {
          window.BarcodeDetector = function () {};
          window.BarcodeDetector.prototype.detect = function () { return Promise.resolve([{ rawValue: '028400090896' }]); };
        });
      }
      await p.context().route(/world\.openfoodfacts\.org/, async (r) => {
        const code = (r.request().url().match(/product\/(\d+)/) || [])[1];
        if (code === '99999999') { await r.abort(); return; }
        // the first code asked is answered slowly, so a second can overtake it
        if (code === '11111111') await new Promise((ok) => setTimeout(ok, 700));
        const body = code === '11111111' ? product('Slow first', { 'energy-kcal_100g': 100, proteins_100g: 1, fat_100g: 1, carbohydrates_100g: 20 })
          : code === '22222222' ? product('Quick second', { 'energy-kcal_100g': 200, proteins_100g: 2, fat_100g: 2, carbohydrates_100g: 40 })
            /* calories per serving, protein only per 100 g: a packet that
               used to come back as one row mixing the two */
            : product('Mixed label', { 'energy-kcal_serving': 120, 'energy-kcal_100g': 400, proteins_100g: 10,
              fat_serving: 2, fat_100g: 6.7, carbohydrates_serving: 20, carbohydrates_100g: 66 });
        await r.fulfill({ status: 200, contentType: 'application/json', body });
      });
      await p.reload();
      await p.click('.tab[data-view="macros"]');
      await p.waitForTimeout(250);
      await p.evaluate(() => {
        if (document.querySelector('.mslot-add')) return;
        const b = document.querySelector('#macroSlots [data-mfold][aria-expanded="false"]');
        if (b) b.click();
      });
      await p.waitForTimeout(200);
      await p.evaluate(() => { const a = document.querySelector('.mslot-add'); if (a) a.scrollIntoView({ block: 'center' }); });
      await p.click('.mslot-add');
      await p.waitForTimeout(600);
      return p;
    }

    // ---- a typed barcode never opens the lens -------------------------------
    const a = await open();
    await a.fill('#mpFind', '028400090896');
    await a.waitForTimeout(500);
    await a.click('[data-nfcode]');
    await a.waitForTimeout(900);
    const asked = await a.evaluate(() => window.__cam.asked);
    t.ok('a barcode typed in does not ask for the camera at all', asked === 0, 'asked ' + asked);
    t.ok('and no camera is left running', (await live(a)) === 0);
    // one basis for every figure
    const row = await a.evaluate(() => (document.querySelector('#nfResults .mpick-row') || {}).textContent || '');
    t.ok('a packet giving calories per serving and protein per 100 g comes back all per 100 g',
      /400 kcal/.test(row) && /10P/.test(row) && /66C/.test(row) && /per 100 g/.test(row), row);
    await a.context().close();

    // ---- leaving scan before permission comes back --------------------------
    const b = await open();
    await b.click('[data-mpmode="scan"]');
    await b.waitForTimeout(100);
    await b.click('[data-mpmode="home"]');          // back to the list, the prompt still up
    await b.waitForTimeout(900);                    // ...and now it is answered
    t.ok('the camera asked for and then walked away from is let go when it arrives',
      (await b.evaluate(() => window.__cam.asked)) === 1 && (await live(b)) === 0,
      JSON.stringify(await b.evaluate(() => window.__cam.asked)) + ' live ' + (await live(b)));
    await b.context().close();

    // ---- a found barcode is finished; a redraw does not reopen the lens ----
    const c = await open({ detector: true });
    await c.evaluate(() => { window.__cam.delay = 30; });
    await c.click('[data-mpmode="scan"]');
    await c.waitForFunction(() => document.getElementById('nfResults') &&
      /Mixed label/.test(document.getElementById('nfResults').textContent), null, { timeout: 5000 });
    t.ok('a scan that finds its barcode lets go of the camera', (await live(c)) === 0);
    await c.evaluate(() => window.Store.toggleFav(3));   // anything that redraws the app
    await c.waitForTimeout(300);
    const redrawn = await c.evaluate(() => ({ asked: window.__cam.asked,
      res: (document.getElementById('nfResults') || {}).textContent || '' }));
    t.ok('and a redraw from elsewhere neither reopens it nor wipes the result being read',
      redrawn.asked === 1 && /Mixed label/.test(redrawn.res) && (await live(c)) === 0, JSON.stringify(redrawn));
    await c.context().close();

    // ---- answers arrive in the order they were asked for --------------------
    const d = await open();
    await d.click('[data-mpmode="scan"]');
    await d.waitForTimeout(100);
    await d.fill('#nfFind', '11111111');
    await d.click('[data-nf="code"]');
    await d.waitForTimeout(50);
    await d.fill('#nfFind', '22222222');
    await d.click('[data-nf="code"]');
    await d.waitForTimeout(1100);
    const last = await d.evaluate(() => (document.getElementById('nfResults') || {}).textContent || '');
    t.ok('a slow answer to the first number does not land over the second', /Quick second/.test(last) && !/Slow first/.test(last), last);
    await d.fill('#nfFind', '99999999');
    await d.click('[data-nf="code"]');
    await d.waitForTimeout(500);
    const down = await d.evaluate(() => (document.getElementById('nfResults') || {}).textContent || '');
    t.ok('no answer at all is said as that, not as "not in Open Food Facts"',
      /did not answer/.test(down) && !/is not in Open Food Facts/.test(down), down);
    t.ok('the camera is let go through all of it', (await live(d)) === 0);
    await d.context().close();

    // ---- what a USDA Foundation food says it is ----------------------------
    const e = await t.fresh();
    const kc = await e.evaluate(() => {
      const N = window.__macroLab.nutrients;
      return [
        N([{ nutrientName: 'Energy (Atwater General Factors)', unitName: 'KCAL', value: 150 }, { nutrientName: 'Protein', unitName: 'G', value: 10 }]).kcal,
        N([{ nutrientName: 'Energy (Atwater General Factors)', unitName: 'KCAL', value: 150 },
          { nutrientName: 'Energy (Atwater Specific Factors)', unitName: 'KCAL', value: 148 }]).kcal,
        N([{ nutrientName: 'Energy', unitName: 'KCAL', value: 140 },
          { nutrientName: 'Energy (Atwater Specific Factors)', unitName: 'KCAL', value: 148 },
          { nutrientName: 'Energy', unitName: 'kJ', value: 600 }]).kcal
      ];
    });
    t.ok('a Foundation food with only Atwater energy is not listed at 0 kcal; the plainest figure wins',
      kc[0] === 150 && kc[1] === 148 && kc[2] === 140, JSON.stringify(kc));

    // ---- your own recipes are in the day's + Add ----------------------------
    await e.evaluate(() => window.Store.saveRecipe({ id: 'uownsoup', book: 3, secNum: 1, secName: 'Ours', own: true,
      name: 'Zanzibar pepper soup', ing: ['pepper'], steps: ['simmer'], servings: '4 Servings', servN: 4, time: '30 mins', diff: 'Easy', macro: null, ingp: [] }));
    await e.click('.tab[data-view="plan"]');
    await e.waitForTimeout(300);
    await e.click('[data-addday="thu"]');
    await e.waitForTimeout(300);
    await e.fill('#adFind', 'zanzibar');
    await e.waitForTimeout(150);
    const found = await e.evaluate(() => [...document.querySelectorAll('#adList .ad-n')].map((x) => x.textContent));
    t.ok('a recipe of your own is found by the day’s + Add search', found.some((n) => /Zanzibar pepper soup/.test(n)), JSON.stringify(found));
    await e.context().close();
  }
};
