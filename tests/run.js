/* ---------------------------------------------------------------------------
 * The test runner.
 *
 *   node tests/run.js              everything that needs no network
 *   node tests/run.js weeks list   only those files
 *   node tests/run.js --headed     watch it happen
 *
 * It serves the repository itself over http — a file:// page gets no service
 * worker and no caches — drives a real Chromium, and asserts against what the
 * app actually renders rather than against what the code says it will.
 *
 * The only dependency is Playwright. tests/sync.test.js is not in the default
 * run because it talks to the live Firestore project; see the note at its top.
 * ------------------------------------------------------------------------- */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml',
};

function serve() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    fs.readFile(file, (err, body) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        // never let the browser cache get between a test and the file on disk
        'Cache-Control': 'no-store',
        'Service-Worker-Allowed': '/',
      });
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
  const args = process.argv.slice(2);
  const headed = args.includes('--headed');
  const want = args.filter((a) => !a.startsWith('--'));

  const files = fs.readdirSync(__dirname)
    .filter((f) => f.endsWith('.test.js'))
    .filter((f) => f !== 'sync.test.js' || want.length)
    .filter((f) => !want.length || want.some((w) => f.indexOf(w) >= 0))
    .sort();

  if (!files.length) { console.error('no test files matched'); process.exit(2); }

  const srv = await serve();
  const URL_BASE = 'http://127.0.0.1:' + srv.address().port + '/';
  const { chromium } = playwright();
  const browser = await chromium.launch({
    headless: !headed,
    // the sandbox proxy re-signs TLS with a CA Chromium does not carry, which
    // only matters to the sync test, and only there
    args: ['--ignore-certificate-errors'],
  });

  let pass = 0, fail = 0;
  const failures = [];

  for (const f of files) {
    const suite = require(path.join(__dirname, f));
    const results = [];
    const t = {
      base: URL_BASE,
      browser,
      ok(name, cond, detail) {
        results.push({ name, cond: !!cond, detail });
        if (cond) pass++; else { fail++; failures.push(suite.name + ' — ' + name); }
      },
      /* A page with nothing remembered, watched for uncaught errors — a thrown
         exception is a failure even when the assertions all pass. */
      async fresh(opts) {
        const ctx = await browser.newContext(Object.assign({ viewport: { width: 1100, height: 900 } }, opts));
        const page = await ctx.newPage();
        page.on('pageerror', (e) => t.ok('no uncaught error on the page', false, e.message));
        await page.goto(URL_BASE + 'index.html');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.evaluate(() => document.fonts.ready);
        return page;
      },
    };

    process.stdout.write('\n' + suite.name + '\n');
    try {
      await suite.run(t);
    } catch (e) {
      fail++;
      failures.push(suite.name + ' — threw');
      results.push({ name: 'the suite ran to the end', cond: false, detail: String(e.message).split('\n')[0] });
    }
    results.forEach((r) => {
      process.stdout.write('  ' + (r.cond ? '✓' : '✗') + ' ' + r.name +
        (r.detail && !r.cond ? '\n      ' + String(r.detail).slice(0, 300) : '') + '\n');
    });
  }

  await browser.close();
  srv.close();

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) { console.log('\n' + failures.map((x) => '  ' + x).join('\n')); process.exit(1); }
})();
