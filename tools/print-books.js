/* ---------------------------------------------------------------------------
 * Renders the books to PDF, the same way the Print button does.
 *
 *     node tools/print-books.js            both volumes, and each on its own
 *     node tools/print-books.js 1          just Run and Not Be Weary
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

const { impose } = require('./booklet.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'print');

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2', '.png': 'image/png',
};

const BOOKS = {
  1: 'Run-and-Not-Be-Weary.pdf',
  2: 'Around-the-Table.pdf',
  3: 'Ours.pdf',
  all: 'Both-Books.pdf',
  one: 'Hive-and-Hearth-Recipes.pdf',
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

/* The page count printed on the Download button, written back into the app.
 *
 * READY_MADE in src/app.js says how many pages each shipped PDF has, and until
 * now that number was typed in by hand after looking at the console output
 * above. It was wrong three separate times in one afternoon of adding recipes,
 * which is the whole shape of the problem: two copies of one fact, and only
 * one of them gets updated when the fact moves. The renderer knows the answer
 * — it just counted the pages — so it writes it down instead of announcing it
 * and hoping.
 *
 * Only the books actually rendered this run are touched. `node tools/print-
 * books.js 1` leaves the other three alone, because their files on disk are
 * also untouched and their numbers are therefore still right.
 */
function stampPageCounts(made) {
  const file = path.join(ROOT, 'src', 'app.js');
  let src = fs.readFileSync(file, 'utf8');
  const done = [];
  Object.keys(made).forEach((key) => {
    const re = new RegExp("(file: '" + BOOKS[key].replace(/\./g, '\\.') + "',[^}]*?pages: )(\\d+)");
    const m = src.match(re);
    if (!m) { console.log('  ' + BOOKS[key] + ' is not in READY_MADE — page count not recorded'); return; }
    if (Number(m[2]) !== made[key]) done.push(BOOKS[key] + ' ' + m[2] + ' -> ' + made[key]);
    src = src.replace(re, '$1' + made[key]);
  });
  if (!done.length) return;
  fs.writeFileSync(file, src);
  console.log('\nsrc/app.js READY_MADE updated: ' + done.join(', ') +
    '\n  bump ?v= in index.html and sw.js so phones pick it up.');
}

(async () => {
  const want = process.argv.slice(2);
  const jobs = (want.length ? want : ['1', '2', 'all', 'one']).filter((k) => BOOKS[k]);
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

  const made = {};
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

    made[key] = last;
    console.log(BOOKS[key].padEnd(26), String(last).padStart(3), 'pages  ',
      String(Math.round(fs.statSync(file).size / 1024)).padStart(4) + ' KB');

    /* The same book again, imposed on letter sheets. Not for the combined
       edition: 142 pages is 36 folded sheets, which is not a booklet, it is a
       phone book. */
    if (key !== 'all' && key !== 'one') {
      const bk = file.replace(/\.pdf$/, '-booklet.pdf');
      try {
        const r = await impose(file, bk);
        console.log(path.basename(bk).padEnd(26), String(r.sheets).padStart(3),
          'sheets ', String(Math.round(fs.statSync(bk).size / 1024)).padStart(4) + ' KB');
      } catch (e) {
        console.log('  could not impose ' + path.basename(file) + ': ' + e.message);
      }
    }
  }

  await browser.close();
  srv.close();
  console.log('\nin ' + path.relative(process.cwd(), OUT) + '/');
  stampPageCounts(made);
})();
