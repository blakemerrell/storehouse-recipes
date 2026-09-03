/* The day-planner bench.  node tools/bench-macros.js [--days N] [--dump N]
 *
 *
 * Two rules it exists to enforce:
 *
 *   1. SAME DAYS. Fill picks at random from the top three fits, so comparing
 *      two settings over different random draws compares the draws. Math.random
 *      is replaced in-page with a seeded generator, and every configuration is
 *      scored over the identical sequence.
 *
 *   2. NO SCREEN. One page load, then window.__macroLab.draft() straight into
 *      the real functions. Clicking the real Fill button costs ~4s a day; this
 *      costs single-digit milliseconds, which is the difference between
 *      sweeping a parameter and guessing at it.
 *
 * Usage:
 *   node bench.js                 baseline, 300 days, default meals
 *   node bench.js --days 500
 *   node bench.js --dump 20       print the first N days plate by plate
 */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = require('path').join(__dirname, '..');   // the repo, wherever it is checked out
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };

function serve() {
  const s = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    fs.readFile(f, (e, b) => {
      if (e) { r.writeHead(404); r.end('x'); return; }
      r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream',
        'Cache-Control': 'no-store' });
      r.end(b);
    });
  });
  return new Promise((ok) => s.listen(0, '127.0.0.1', () => ok(s)));
}
const { chromium } = require(ROOT + '/node_modules/playwright');

const arg = (n, d) => {
  const i = process.argv.indexOf('--' + n);
  return i >= 0 ? (process.argv[i + 1] || true) : d;
};
const DAYS = Number(arg('days', 300));
const DUMP = Number(arg('dump', 0));
const TARGETS = { p: 180, f: 50, c: 50 };

(async () => {
  const srv = await serve();
  const url = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  await page.addInitScript((t) => {
    localStorage.setItem('bsc.macroTargets', JSON.stringify(t));
  }, TARGETS);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.click('.tab[data-view="macros"]');
  await page.waitForTimeout(400);

  const t0 = Date.now();
  const runs = await page.evaluate((n) => {
    /* mulberry32 — small, fast, and the same sequence every time, which is the
       entire point. Replacing Math.random rather than threading a generator
       through the app keeps the app unaware it is being measured. */
    const seeded = (a) => () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    const real = Math.random;
    const lab = window.__macroLab;
    const out = [];
    for (let i = 0; i < n; i++) {
      Math.random = seeded(i + 1);      // day i is the same day for every setting
      lab.forget();
      lab.draft();
      out.push(lab.read());
    }
    Math.random = real;
    return { days: out, targets: lab.targets() };
  }, DAYS);
  const ms = Date.now() - t0;

  const T = runs.targets;
  const dayK = Math.round(4 * T.p + 4 * T.c + 9 * T.f);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

  console.log(DAYS + ' days in ' + ms + ' ms  (' + (ms / DAYS).toFixed(1) +
    ' ms/day)   target ' + dayK + ' kcal, ' + T.p + ' P\n');

  // ---- per meal: what it was given, what it came to, and how it got there
  const wSum = runs.days[0].meals.reduce((a, m) => a + m.w, 0);
  console.log('meal        share    kcal   ratio   dish kcal   final ×   P/100kcal   F/100kcal   C/100kcal');
  runs.days[0].meals.forEach((m0, i) => {
    const want = dayK * m0.w / wSum;
    const kc = [], dish = [], xs = [], np = [], dp = [], df = [], dc = [];
    runs.days.forEach((d) => {
      const m = d.meals[i];
      np.push(m.items.length);
      let k = 0; m.items.forEach((it) => { k += it.kcal * it.x; });
      kc.push(k);
      m.items.forEach((it) => { dish.push(it.kcal); xs.push(it.x);
        if (it.kcal > 0) { dp.push(100 * it.p / it.kcal); df.push(100 * it.f / it.kcal);
          dc.push(100 * it.c / it.kcal); } });
    });
    console.log(m0.name.padEnd(11) +
      String(Math.round(want)).padStart(5) +
      String(Math.round(mean(kc))).padStart(8) +
      ('  ' + (mean(kc) / want).toFixed(2) + '×').padStart(9) +
      String(Math.round(med(dish))).padStart(12) +
      ('  ' + med(xs).toFixed(2)).padStart(10) +
      ('  ' + med(dp).toFixed(1) + ' g').padStart(12) +
      ('  ' + med(df).toFixed(1) + ' g').padStart(12) +
      ('  ' + med(dc).toFixed(1) + ' g').padStart(12));
  });

  // ---- the day itself
  const dp = runs.days.map((d) => Math.abs(d.tot.p - T.p));
  const dk = runs.days.map((d) => Math.abs(4 * d.tot.p + 4 * d.tot.c + 9 * d.tot.f - dayK));
  const share = runs.days.map((d) => {
    let s = 0;
    d.meals.forEach((m) => {
      let k = 0; m.items.forEach((it) => { k += it.kcal * it.x; });
      s += Math.abs(k - dayK * m.w / wSum);
    });
    return s;
  });
  console.log('\nday protein miss   mean ' + mean(dp).toFixed(1) + ' g   median ' + med(dp).toFixed(1));
  console.log('day kcal miss      mean ' + mean(dk).toFixed(1) + '     median ' + med(dk).toFixed(1));
  console.log('share miss (sum)   mean ' + mean(share).toFixed(0) + '     median ' + med(share).toFixed(0));

  // ---- portion sanity: the 68-kcal lunch and the x3 roast
  const big = [], small = [];
  runs.days.forEach((d) => d.meals.forEach((m) => {
    let k = 0; m.items.forEach((it) => { k += it.kcal * it.x; });
    if (m.items.length && k < 150) small.push(m.name + ' ' + Math.round(k));
    m.items.forEach((it) => { if (it.x >= 3) big.push(it.name.slice(0, 26) + ' ×' + it.x); });
  }));
  console.log('\nmeals under 150 kcal   ' + small.length + '  e.g. ' + small.slice(0, 3).join(', '));
  console.log('plates at ×3 or more   ' + big.length + '  e.g. ' + big.slice(0, 3).join(', '));

  // ---- which dishes the fit actually reaches for, per meal
  console.log('\nmost-picked dishes, and how dense they are:');
  runs.days[0].meals.forEach((m0, i) => {
    const tally = {};
    runs.days.forEach((d) => d.meals[i].items.forEach((it) => {
      const key = it.name.slice(0, 34) + '|' + (it.kcal ? (100 * it.p / it.kcal).toFixed(1) : '0');
      tally[key] = (tally[key] || 0) + 1;
    }));
    const top = Object.keys(tally).sort((a, b) => tally[b] - tally[a]).slice(0, 3);
    console.log('  ' + m0.name);
    top.forEach((k) => {
      const [nm, den] = k.split('|');
      console.log('      ' + String(tally[k]).padStart(3) + '×  ' + den.padStart(4) +
        ' g P/100kcal   ' + nm);
    });
  });

  if (DUMP) {
    console.log('\n---- first ' + DUMP + ' days, plate by plate ----');
    runs.days.slice(0, DUMP).forEach((d, n) => {
      console.log('\nday ' + (n + 1));
      d.meals.forEach((m) => {
        let k = 0; m.items.forEach((it) => { k += it.kcal * it.x; });
        console.log('  ' + m.name.padEnd(11) + String(Math.round(k)).padStart(5) + ' kcal');
        m.items.forEach((it) => console.log('      ×' + String(it.x).padEnd(5) +
          String(it.kcal).padStart(4) + ' kcal dish   ' + it.name.slice(0, 40)));
      });
    });
  }

  await browser.close();
  srv.close();
})();
