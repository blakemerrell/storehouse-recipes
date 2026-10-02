/* ---------------------------------------------------------------------------
 * The test runner.
 *
 *   node tests/run.js              everything that needs no network
 *   node tests/run.js weeks list   only those files
 *   node tests/run.js --headed     watch it happen
 *   SITE=_site node tests/run.js   against the built site instead
 *
 * It serves the repository itself over http — a file:// page gets no service
 * worker and no caches — drives a real Chromium, and asserts against what the
 * app actually renders rather than against what the code says it will.
 *
 * SITE serves a directory built by tools/build-site.js instead of the
 * repository: the version written in, the comments stripped, the files that do
 * not ship left out. That is what the deploy publishes, so it is what CI tests
 * — `npm run test:site` builds and runs it in one go. Without SITE the suite
 * runs against the files as they are in the repository, unbuilt, which is
 * what you want while working on them.
 *
 * The only dependency is Playwright. tests/sync.test.js is not in the default
 * run because it talks to the live Firestore project; see the note at its top.
 * ------------------------------------------------------------------------- */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* What is served: the repository, or a built site under it. */
const SERVE = process.env.SITE ? path.resolve(ROOT, process.env.SITE) : ROOT;
if (process.env.SITE && !fs.existsSync(path.join(SERVE, 'index.html'))) {
  console.error('SITE=' + process.env.SITE + ' has no index.html — build it first: node tools/build-site.js');
  process.exit(2);
}

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml',
};

/* Down: every connection refused, as a phone with no signal has it.
   Playwright's setOffline stops the page's own requests but not the service
   worker's, so a test that went "offline" with it alone was still being
   served from here, and passed whatever the worker did. */
let DOWN = false;

function serve() {
  const srv = http.createServer((req, res) => {
    if (DOWN) { req.socket.destroy(); return; }
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(SERVE, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
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
  try { return require('playwright'); } catch (e) { /* below */ }
  console.error('Playwright is not installed. `npm ci` and try again.');
  process.exit(2);
}

(async () => {
  const args = process.argv.slice(2);
  const headed = args.includes('--headed');
  /* The sync* suites talk to the real Firebase project and leave records in
     it when their cleanup is refused. They used to run whenever any word was
     given that matched one, so asking for "the sync-ish local suites" by
     name reached the live project. Now only with --live, said out loud. */
  const live = args.includes('--live');
  const want = args.filter((a) => !a.startsWith('--'));

  const all = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js'));
  const runnable = all.filter((f) => !/^sync/.test(f) || live);
  /* Every word asked for has to name a file that runs. A word that matched
     nothing used to be dropped in silence, so a renamed suite fell out of
     a gate like "offline upgrade" while the gate went on passing. */
  const unmatched = want.filter((w) => !runnable.some((f) => f.indexOf(w) >= 0));
  if (unmatched.length) {
    unmatched.forEach((w) => console.error(all.some((f) => /^sync/.test(f) && f.indexOf(w) >= 0)
      ? '"' + w + '" is a live suite: it talks to the real Firebase project and runs only with --live'
      : 'no test file matches "' + w + '"'));
    process.exit(2);
  }
  const files = runnable
    .filter((f) => !want.length || want.some((w) => f.indexOf(w) >= 0))
    .sort();

  if (!files.length) { console.error('no test files matched'); process.exit(2); }

  const srv = await serve();
  const URL_BASE = 'http://127.0.0.1:' + srv.address().port + '/';
  if (process.env.SITE) console.log('serving ' + path.relative(process.cwd(), SERVE) + '/, the built site');
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
    DOWN = false;
    const t = {
      base: URL_BASE,
      /* The directory being served, and whether it is a built site rather
         than the repository — for a test that reads what shipped. */
      root: SERVE,
      site: SERVE !== ROOT,
      browser,
      down(v) { DOWN = !!v; },
      ok(name, cond, detail) {
        results.push({ name, cond: !!cond, detail });
        if (cond) pass++; else { fail++; failures.push(suite.name + ' — ' + name); }
      },
      /* A page with nothing remembered, watched for uncaught errors — a thrown
         exception is a failure even when the assertions all pass. */
      async fresh(opts) {
        const ctx = await browser.newContext(Object.assign({ viewport: { width: 1100, height: 900 } }, opts));
        /* The food tables are somebody else's server and this run is the one
           that needs no network. That was true by accident until the picker's
           lookup started firing on its own once you stop typing — every test
           that types three characters into the search box now reaches for the
           USDA, which makes the suite depend on a third party being up and
           puts a live request in the middle of everything else's timing.
         *
           Refused here rather than switched off in the app: the app should
           not know it is being tested, and the contract being enforced is the
           runner's own. mLookNet already has an answer for a request that
           does not come back, and the test that pins the wiring accepts it.
         *
           Only the USDA. Open Food Facts is what a barcode asks, and a barcode
           is still only ever asked for by a press — the tests that exercise it
           mean to reach it. */
        await ctx.route(/api\.nal\.usda\.gov/, (route) => route.abort());
        /* Google's sign-in script, answered here too. The real one reached
           through a sandbox that blocks the hosts it loads next throws "gis
           is not defined" from Google's own code, and the page-error hook
           below turns that into two failures that say nothing about this
           app. The stand-in draws a button the way theirs does, so the
           sheet's "Google drew it" path is the one tested, every run, and
           the request still goes to accounts.google.com, which is what the
           "reaches Google, and nowhere else" assertion is about. */
        await ctx.route(/accounts\.google\.com\/gsi\//, (route) => route.fulfill({ status: 200, contentType: 'text/javascript',
          body: 'window.google=window.google||{};google.accounts={id:{initialize:function(){},prompt:function(){},cancel:function(){},' +
            'disableAutoSelect:function(){},renderButton:function(el){if(el)el.innerHTML=\'<div role="button">Sign in with Google</div>\';}}};' }));
        const page = await ctx.newPage();
        /* FAST=1 trades the suite's padding for a settle.
         *
           Two and a half minutes of a four minute run is this file sleeping:
           486 waitForTimeout calls adding up to 152 seconds, nearly all of
           them waiting on a render that finished in under a frame. The app
           writes innerHTML synchronously on a click, so what a test actually
           needs is "let the frame land", not "count to three hundred".
         *
           Capped rather than removed, and the cap is above every debounce the
           app runs on its own clock — the weigh-in's 600ms quiet save, the
           sync push's 900ms, the lookup's 550ms — because those are real
           waits and shortening them would be testing a different app. Under
           the cap it waits two animation frames instead.
         *
           Off by default, and checked rather than assumed: macros run both
           ways gave 508 assertions with the same verdicts in the same order,
           diffed line for line, and the full suite gave 819 passed / 2 failed
           either way — the two being the known print-layout pair. The macros
           file went 4:05 to 2:01 and the whole suite 6 minutes to 4.
         *
           Still opt-in, because a test written later could depend on a real
           wait under half a second and would quietly stop testing it. If that
           happens the diff above is how you would find out. */
        if (process.env.FAST) {
          const real = page.waitForTimeout.bind(page);
          const FLOOR = 500;                    // leave the app's own debounces alone
          page.waitForTimeout = async (ms) => {
            if (ms >= FLOOR) return real(ms);
            try {
              await page.evaluate(() => new Promise((r) =>
                requestAnimationFrame(() => requestAnimationFrame(r))));
            } catch (e) { /* navigated mid-wait: fall through to the sleep */ }
            return real(Math.min(ms, 30));
          };
        }
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
    /* A suite that asked nothing passed nothing either. */
    if (!results.length) {
      fail++;
      failures.push(suite.name + ' — checked nothing');
      results.push({ name: 'the suite checked something', cond: false, detail: 'it ran without a single t.ok' });
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
