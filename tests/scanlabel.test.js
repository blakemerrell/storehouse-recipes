/* What a scanned packet becomes: the "How much?" form drawn as the
 * Nutrition Facts panel, with the sodium, fiber and allergens a lookup
 * brings back kept rather than thrown away, and the USDA's packaged foods
 * asked about a barcode Open Food Facts does not know.
 *
 * Both services are answered from here; nothing leaves the machine. The
 * runner refuses the USDA in every fresh page, and a route added after that
 * one is the one Playwright asks first, so a test can answer it instead. */

const { openTray } = require('./fixtures/nourish.js');

const OFF = /world\.openfoodfacts\.org/;
const USDA = /api\.nal\.usda\.gov/;

// Great Value pork and beans, as Open Food Facts had it on 2026-10-06, allergens added for the test
const BEANS = { status: 1, product: { product_name: 'Pork & Beans', brands: 'Great Value', serving_size: '1/2 cup (130 g)',
  allergens_tags: ['en:milk', 'en:soybeans', 'en:sesame-seeds'],
  nutriments: { 'energy-kcal_serving': 110, proteins_serving: 6, fat_serving: 1, carbohydrates_serving: 23,
    sodium_serving: 0.39, fiber_serving: 6, 'energy-kcal_100g': 85, proteins_100g: 4.6, fat_100g: 0.8,
    carbohydrates_100g: 17.7, sodium_100g: 0.3, fiber_100g: 4.6 } } };

// a peanut butter by its barcode, per 100 g as the USDA keeps every packet; and one beside it with another barcode
const nutr = (kc, p, f, c, na, fib) => [
  { nutrientName: 'Energy', unitName: 'KCAL', value: kc }, { nutrientName: 'Protein', unitName: 'G', value: p },
  { nutrientName: 'Total lipid (fat)', unitName: 'G', value: f }, { nutrientName: 'Carbohydrate, by difference', unitName: 'G', value: c },
  { nutrientName: 'Sodium, Na', unitName: 'MG', value: na }, { nutrientName: 'Fiber, total dietary', unitName: 'G', value: fib }];
const PB = { foods: [
  { dataType: 'Branded', gtinUpc: '051500255162', description: 'CREAMY PEANUT BUTTER', brandName: 'OTHER',
    servingSize: 32, servingSizeUnit: 'g', householdServingFullText: '2 Tbsp', foodNutrients: nutr(600, 20, 50, 20, 400, 5) },
  { dataType: 'Branded', gtinUpc: '0044444444444', description: 'CREAMY PEANUT BUTTER', brandName: 'JIF',
    servingSize: 32, servingSizeUnit: 'g', householdServingFullText: '2 Tbsp', foodNutrients: nutr(588, 22, 50, 22, 422, 6.2) }] };

module.exports = {
  name: 'Scan label',
  async run(t) {
    /* A meal's sheet, open on its picker, with Open Food Facts answered by
       `off` and the USDA, when `usda` is given, by that. */
    async function open(off, usda) {
      const p = await t.fresh({ viewport: { width: 390, height: 844 } });
      p.usdaAsked = [];
      await p.context().route(OFF, async (r) => {
        const code = (r.request().url().match(/product\/(\d+)/) || [])[1];
        await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(off(code)) });
      });
      if (usda) {
        await p.context().route(USDA, async (r) => {
          p.usdaAsked.push(r.request().postData() || '');
          await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(usda) });
        });
      }
      await p.reload();
      await p.click('.tab[data-view="macros"]');
      await p.waitForTimeout(250);
      await p.evaluate(() => { const b = document.querySelector('#macroSlots .mtray-b'); b.scrollIntoView({ block: 'center' }); });
      await p.click('#macroSlots .mtray-b');
      await p.waitForTimeout(500);
      return p;
    }
    async function ask(p, code) {
      await p.fill('#mpFind', code);
      await p.waitForTimeout(150);
      await p.click('[data-nfcode]');
      await p.waitForFunction(() => {
        const r = document.getElementById('nfResults');
        return r && /\S/.test(r.textContent) && !/Looking/.test(r.textContent);
      }, null, { timeout: 5000 });
      return p.evaluate(() => document.getElementById('nfResults').textContent);
    }
    const panel = (p) => p.evaluate(() => {
      const v = (id) => (document.getElementById(id) || {}).value;
      const dv = {};
      document.querySelectorAll('.nfl [data-dv]').forEach((c) => { dv[c.dataset.dv] = c.textContent; });
      return { panel: !!document.querySelector('.nfl[role="group"]'), head: (document.getElementById('nflH') || {}).textContent,
        name: v('nfName'), unit: v('nfUnit'), kcal: v('nfKcal'), p: v('nfP'), f: v('nfF'), c: v('nfC'), na: v('nfNa'), fib: v('nfFib'),
        dv, counts: (document.getElementById('nfCounts') || {}).textContent || '',
        alg: (document.getElementById('nfAlg') || {}).textContent || '' };
    });

    // ---- a packet Open Food Facts knows, with all of its label --------------
    const a = await open(() => BEANS);
    const row = await ask(a, '0078742370842');
    t.ok('a scanned packet is offered with the figures off its label', /Great Value Pork & Beans/.test(row) && /110 kcal/.test(row), row);
    await a.click('[data-nfpick="0"]');
    await a.waitForTimeout(250);
    let got = await panel(a);
    t.ok('taking it opens the form drawn as a Nutrition Facts panel, the label’s order and words',
      got.panel && got.head === 'Nutrition Facts' && await a.evaluate(() =>
        [...document.querySelectorAll('.nfl label')].map((l) => l.textContent).join('|') ===
          'Serving size|Calories|Total Fat|Sodium|Total Carbohydrate|Dietary Fiber|Protein'), JSON.stringify(got));
    t.ok('with the sodium and fiber the lookup always brought back, no longer thrown away',
      got.kcal === '110' && got.p === '6' && got.f === '1' && got.c === '23' && got.na === '390' && got.fib === '6' &&
        got.unit === '1/2 cup (130 g)', JSON.stringify(got));
    t.ok('and each figure’s % Daily Value, the FDA’s, as the packet prints it',
      got.dv.nfF === '1%' && got.dv.nfNa === '17%' && got.dv.nfC === '8%' && got.dv.nfFib === '21%', JSON.stringify(got.dv));
    t.ok('the allergens the packet declares are said above it, in plain words and as Open Food Facts’ list',
      /Contains\s*milk, soy, sesame/.test(got.alg) && /Open Food Facts/.test(got.alg), got.alg);
    /* 4 × 6 + 4 × 23 + 9 × 1 = 125, where the can says 110: its fiber,
       counted at four by the day and at less by the label. Said, rather than
       swapped in silently at the save as it always was. */
    t.ok('and what the day will count, when it is not what the label says, with why',
      /counts 125 kcal, not 110/.test(got.counts) && /6 g of fiber/.test(got.counts), got.counts);
    await a.fill('#nfNa', '460');
    await a.fill('#nfFib', '2.5');
    got = await panel(a);
    t.ok('the percentages follow the boxes as they are typed in',
      got.dv.nfNa === '20%' && got.dv.nfFib === '9%', JSON.stringify(got.dv));
    await a.fill('#nfNa', '');
    got = await panel(a);
    t.ok('and an emptied box shows no percentage rather than 0%', got.dv.nfNa === '', JSON.stringify(got.dv));
    await a.fill('#nfNa', '460');
    await a.click('[data-nf="save"]');
    await a.waitForTimeout(350);
    const kept = await a.evaluate(() => JSON.parse(localStorage.getItem('bsc.myFoods') || '{}'));
    const beans = Object.values(kept).find((f) => /Pork & Beans/.test(f.name)) || {};
    t.ok('saved, the food keeps its sodium, its fiber to a tenth and its allergens',
      beans.na === 460 && beans.fib === 2.5 && JSON.stringify(beans.alg) === '["milk","soy","sesame"]' &&
        beans.kcal === 125, JSON.stringify(beans));
    // the meal's sheet is back, the food on it; the tray opened on its rows, its name opens the food
    await openTray(a);
    await a.evaluate(() => {
      const b = [...document.querySelectorAll('#modalRoot .mitem-food')].find((x) => /Pork/.test(x.textContent));
      b.scrollIntoView({ block: 'center' }); b.click();
    });
    await a.waitForTimeout(250);
    const page = await a.evaluate(() => ({ alg: (document.querySelector('.mfs-alg') || {}).textContent || '',
      micro: (document.querySelector('.mfs-micro') || {}).textContent || '' }));
    t.ok('and its own page says what it contains, and counts the sodium typed',
      /Contains milk, soy, sesame/.test(page.alg) && /Open Food Facts/.test(page.alg) && /460 mg sodium/.test(page.micro),
      JSON.stringify(page));
    if (process.env.SHOT) {
      await a.screenshot({ path: process.env.SHOT + '/foodpage.png', fullPage: false });
      await a.keyboard.press('Escape');
      await a.waitForTimeout(150);
      await a.keyboard.press('Escape');
      await a.waitForTimeout(150);
      await a.evaluate(() => { const b = document.querySelector('#macroSlots .mtray-b'); b.scrollIntoView({ block: 'center' }); });
      await a.click('#macroSlots .mtray-b');
      await a.waitForTimeout(400);
      await ask(a, '0078742370842');
      await a.click('[data-nfpick="0"]');
      await a.waitForTimeout(300);
      await a.screenshot({ path: process.env.SHOT + '/label-light.png', fullPage: false });
      await a.evaluate(() => document.querySelector('.scrim').scrollTo(0, 400));
      await a.screenshot({ path: process.env.SHOT + '/label-light-2.png', fullPage: false });
      await a.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); });
      await a.waitForTimeout(100);
      await a.evaluate(() => document.querySelector('.scrim').scrollTo(0, 0));
      await a.screenshot({ path: process.env.SHOT + '/label-dark.png', fullPage: false });
    }
    await a.context().close();

    // ---- typed in by hand: an empty panel claims nothing ---------------------
    const h = await open(() => ({ status: 0 }));
    await h.click('[data-mpnew]');
    await h.waitForTimeout(250);
    got = await panel(h);
    t.ok('the empty form is the same panel, with no percentages, no allergens and nothing said about the day',
      got.panel && Object.values(got.dv).every((x) => x === '') && got.alg === '' && got.counts === '' &&
        got.na === '' && got.fib === '', JSON.stringify(got));
    await h.fill('#nfName', 'Tamale');
    await h.fill('#nfKcal', '250');
    await h.fill('#nfP', '10');
    await h.fill('#nfF', '12');
    await h.fill('#nfC', '25');
    await h.click('[data-nf="save"]');
    await h.waitForTimeout(300);
    const tam = await h.evaluate(() => JSON.parse(localStorage.getItem('bsc.myFoods') || '{}').tamale || null);
    t.ok('and a food saved with its sodium and fiber left empty keeps no 0 it was never told',
      !!tam && !('na' in tam) && !('fib' in tam) && !('alg' in tam), JSON.stringify(tam));
    await h.context().close();

    // ---- a barcode Open Food Facts does not know, the USDA does ------------
    const u = await open(() => ({ status: 0, status_verbose: 'product not found' }), PB);
    const pb = await ask(u, '044444444444');
    t.ok('a barcode Open Food Facts has never seen is asked of the USDA’s packaged foods',
      /Jif Creamy Peanut Butter/.test(pb) && /USDA packaged foods/.test(pb) && u.usdaAsked.length === 1 &&
        JSON.parse(u.usdaAsked[0]).query === '044444444444', pb + ' / ' + u.usdaAsked.join());
    t.ok('and only the packet with that barcode is taken, not the first that came back',
      !/Other/i.test(pb) && /188 kcal/.test(pb), pb);
    await u.click('[data-nfpick="0"]');
    await u.waitForTimeout(250);
    got = await panel(u);
    t.ok('per its own serving, the label’s words and weight, sodium and fiber with it',
      got.unit === '2 Tbsp (32 g)' && got.kcal === '188' && got.p === '7' && got.f === '16' && got.c === '7' &&
        got.na === '135' && got.fib === '2', JSON.stringify(got));
    t.ok('the USDA lists no allergens, so none are claimed', got.alg === '', got.alg);
    await u.context().close();

    // ---- known nowhere, and the USDA out of reach -------------------------------
    const n = await open(() => ({ status: 0 }), { foods: [] });
    const none = await ask(n, '055555555555');
    t.ok('a barcode neither knows is said as that', /not in Open Food Facts or the USDA/.test(none), none);
    await n.context().close();
    const o = await open(() => ({ status: 0 }));                // the runner's refusal of the USDA stands
    const off = await ask(o, '055555555555');
    t.ok('a USDA that cannot be reached leaves Open Food Facts’ answer as it was, not "known nowhere"',
      /is not in Open Food Facts\./.test(off) && !/USDA/.test(off), off);
    await o.context().close();

    // ---- what the USDA's answers carry ---------------------------------------
    const e = await t.fresh();
    const nut = await e.evaluate(() => {
      const N = window.__macroLab.nutrients;
      return [N([{ nutrientName: 'Sodium, Na', unitName: 'MG', value: 1200 }, { nutrientName: 'Fiber, total dietary', unitName: 'G', value: 3.5 },
        { nutrientName: 'Protein', unitName: 'G', value: 2 }]), N([{ nutrientName: 'Protein', unitName: 'G', value: 2 }])];
    });
    t.ok('the USDA’s sodium and fiber are read, and stay null when an answer has none',
      nut[0].na === 1200 && nut[0].fib === 3.5 && nut[1].na === null && nut[1].fib === null, JSON.stringify(nut));
    await e.context().close();

    /* A reference food quoted per its household measure, which the USDA
       often words with a bracket of its own. The weight goes in brackets
       after it, so that one has to come off, or the serving is one no label
       reader can parse and the plate printed "1 1 medium (…)". */
    const s = await t.fresh();
    await s.context().route(USDA, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ foods: [
      { dataType: 'Survey (FNDDS)', description: 'Apple, raw', foodNutrients: nutr(52, 0.3, 0.2, 14, 1, 2.4),
        foodMeasures: [{ disseminationText: '1 medium (2-3/4" dia)', gramWeight: 182, rank: 1 }] },
      { dataType: 'SR Legacy', description: 'Apple, dried', foodNutrients: nutr(243, 0.9, 0.3, 66, 87, 8.7),
        foodMeasures: [{ disseminationText: 'cup', gramWeight: 86, rank: 1 }] }] }) }));
    const rows = await s.evaluate(() => window.__macroLab.foodSearch('apple'));
    t.ok('a reference food’s measure keeps its count and loses its own aside, the weight after it',
      rows[0].unit === '1 medium (182 g)' && rows[1].unit === '1 cup (86 g)', JSON.stringify(rows.map((r) => r.unit)));
    t.ok('and its sodium and fiber come per that measure',
      rows[0].na === 2 && rows[0].fib === 4.4 && rows[1].na === 75 && rows[1].fib === 7.5, JSON.stringify(rows));
    await s.context().close();
  }
};
