/*
 * Renders share/index.html to print/Storehouse-Handout.pdf.
 *
 * The page is the source and this only photographs it, for the same reason the
 * books are rendered rather than typeset by hand: there is one description of
 * the sheet and everything else is derived from it. Somebody who wants to hand
 * the storehouse a file gets a file; somebody who wants to print it from a
 * browser gets the same sheet, because it is the same sheet.
 *
 * Letter, one page, no margin — the margins are in the page's own CSS, so the
 * PDF and a browser print come out identical rather than nearly identical.
 *
 * Run:  node tools/print-handout.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'print', 'Storehouse-Handout.pdf');

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

function playwright() {
  for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(m); } catch (e) { /* try the next */ }
  }
  console.error('Playwright is not installed. `npm i -D playwright` and try again.');
  process.exit(2);
}

function serve() {
  return new Promise((res) => {
    const s = http.createServer((q, r) => {
      let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
      if (f.endsWith('/')) f += 'index.html';
      fs.readFile(f, (e, d) => e
        ? (r.writeHead(404), r.end())
        : (r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }), r.end(d)));
    }).listen(0, () => res(s));
  });
}

(async () => {
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port + '/';
  const { chromium } = playwright();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(base + 'share/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  /* Two pages exactly: one sheet of paper, printed on both sides. Three is a
     second sheet and a different photocopying job, so it is asserted here
     rather than hoped for. */
  const n = await page.evaluate(() => ({
    recipes: document.querySelectorAll('.rec').length,
    sheets: document.querySelectorAll('.sheet').length,
    qr: document.querySelectorAll('.foot-qr svg').length,
    url: (document.querySelector('[data-url]') || {}).textContent || '',
  }));
  if (n.recipes !== 8 || n.sheets !== 2 || n.qr !== 2 || !n.url) {
    console.error('the sheet did not render: ' + JSON.stringify(n));
    process.exit(1);
  }

  await page.pdf({ path: OUT, width: '8.5in', height: '11in', printBackground: true });
  await browser.close();
  srv.close();

  const { execFileSync } = require('child_process');
  let pages = '?';
  try {
    pages = execFileSync('pdfinfo', [OUT]).toString().match(/^Pages:\s*(\d+)/m)[1];
  } catch (e) { /* pdfinfo is a nicety, not a dependency */ }
  console.log('wrote print/Storehouse-Handout.pdf  ' + pages + ' pages, ' +
    n.recipes + ' recipes, ' + Math.round(fs.statSync(OUT).size / 1024) + ' KB');
  if (pages !== '?' && pages !== '2') {
    console.error('  it is meant to be two — one sheet, printed both sides. Something grew.');
    process.exit(1);
  }
})();
