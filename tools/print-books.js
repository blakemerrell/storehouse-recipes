/* ---------------------------------------------------------------------------
 * Renders the books to PDF, the same way the Print button does.
 *
 *     node tools/print-books.js            both volumes, and each on its own
 *     node tools/print-books.js 1          just Strong & Simple
 *     node tools/print-books.js 3          just Ours (needs recipes of your own,
 *                                          which live on your phone, not here)
 *
 * Files land in print/. Half-letter, 5.5 × 8.5 in, ready for a print shop or
 * for a duplex printer with the booklet setting on.
 *
 * The pages are packed by measuring in a real browser, so this has to be a real
 * browser: it serves the repository, waits for the layout to settle, and prints
 * exactly what you would get from the app.
 * ------------------------------------------------------------------------- */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'print');

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2', '.png': 'image/png',
};

const BOOKS = {
  1: 'Strong-and-Simple.pdf',
  2: 'Around-the-Table.pdf',
  3: 'Ours.pdf',
  all: 'Both-Books.pdf',
};

function serve() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, '')), (err, body) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      res.end(body);
    });
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)));
}

function playwright() {
  for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(m); } catch (e) { /* try the next */ }
  }
  console.error('Playwright is not installed. `npm i -D playwright` and try again.');
  process.exit(2);
}

(async () => {
  const want = process.argv.slice(2);
  const jobs = (want.length ? want : ['1', '2', 'all']).filter((k) => BOOKS[k]);
  if (!jobs.length) { console.error('nothing to print; try 1, 2, 3 or all'); process.exit(2); }

  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const { chromium } = playwright();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.on('pageerror', (e) => console.error('page error:', e.message));

  await page.goto('http://127.0.0.1:' + srv.address().port + '/index.html');
  await page.evaluate(() => localStorage.clear());   // print the books, not somebody's week
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  await page.click('.tab[data-view="book"]');

  for (const key of jobs) {
    await page.selectOption('#printSet', key);

    /* Packing is measure-then-lay-out and runs asynchronously; wait for the
       page count to stop moving rather than guessing at a timeout. */
    let last = -1, still = 0;
    for (let i = 0; i < 120 && still < 3; i++) {
      await page.waitForTimeout(250);
      const n = await page.evaluate(() =>
        document.querySelectorAll('.pg:not(.no-print)').length);
      if (n === last && n > 0) still++; else { still = 0; last = n; }
    }
    if (!last) { console.log(BOOKS[key].padEnd(24), 'nothing to print'); continue; }

    const file = path.join(OUT, BOOKS[key]);
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: file, width: '5.5in', height: '8.5in', printBackground: true, preferCSSPageSize: true });
    await page.emulateMedia({ media: 'screen' });

    console.log(BOOKS[key].padEnd(24), String(last).padStart(3), 'pages  ',
      Math.round(fs.statSync(file).size / 1024) + ' KB');
  }

  await browser.close();
  srv.close();
  console.log('\nin ' + path.relative(process.cwd(), OUT) + '/');
})();
