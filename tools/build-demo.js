/*
 * The pictures the landing page animates through.
 *
 * Both halves are real. The book frames are pages lifted out of the rendered
 * PDF; the app frames are the app itself, driven at phone size and
 * photographed. Nothing here is a mockup, which matters more than it sounds:
 * a landing page that shows a drawing of a product is making a claim it has
 * not checked, and this one regenerates from the current build every time.
 *
 * It replaced a strip of twelve engravings. Those were the best thing on the
 * page and they are still in it — one of the book frames is a section opener,
 * so the art appears where it belongs instead of in a gallery of its own.
 *
 * WebP at quality 82. The strip it replaced was 2.6 MB of PNG for pictures a
 * reader scrolled past; this is eight frames at roughly a tenth of that, and
 * they are the argument rather than the decoration.
 *
 * Run:  node tools/build-demo.js
 * Needs: print/Hive-and-Hearth-Recipes.pdf, pdftoppm, playwright, sharp.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const PDF = path.join(ROOT, 'print', 'Hive-and-Hearth-Recipes.pdf');
const OUT = path.join(ROOT, 'welcome', 'demo');

/* Four pages, chosen to answer four different doubts: that it is a real book,
   that the sections are illustrated, that a recipe is properly set, and that
   you can find anything in it. Page numbers are 1-based into the combined
   edition; check them against the PDF if the book grows. */
const PAGES = [
  { n: 1, name: 'book-1-cover', alt: 'The printed cover: a beehive above the title, Hive and Hearth Recipes' },
  { n: 16, name: 'book-2-opener', alt: 'A section opening page with an engraving of a zero-cook spread' },
  { n: 18, name: 'book-3-recipes', alt: 'A page of the printed book, two recipes with ingredients and method side by side' },
  { n: 8, name: 'book-4-contents', alt: 'A contents page listing recipes with their page numbers' },
];

/* And four of the app, in the order somebody uses it. */
const SCREENS = [
  { name: 'app-1-browse', alt: 'The app browsing recipes as cards, each with its nutrition score' },
  { name: 'app-2-recipe', alt: 'A recipe open in the app, with its ingredients, method and score' },
  { name: 'app-3-plan', alt: 'The meal plan, with recipes assigned to days of the week' },
  { name: 'app-4-list', alt: 'The shopping list, with quantities added up across recipes' },
];

function playwright() {
  try { return require('playwright'); } catch (e) { /* fall through */ }
  console.error('Playwright is not installed. `npm i -D playwright` and try again.');
  process.exit(2);
}

function serve() {
  const http = require('http');
  const TYPES = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
    '.webmanifest': 'application/manifest+json',
  };
  return new Promise((res) => {
    const s = require('http').createServer((q, r) => {
      let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
      if (f.endsWith('/')) f += 'index.html';
      fs.readFile(f, (e, d) => e
        ? (r.writeHead(404), r.end())
        : (r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }), r.end(d)));
    }).listen(0, () => res(s));
  });
}

(async () => {
  if (!fs.existsSync(PDF)) {
    console.error('no print/Hive-and-Hearth-Recipes.pdf — run tools/print-books.js one first');
    process.exit(2);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-'));
  global.window = {};
  require(path.join(ROOT, 'data', 'recipes.js'));
  const RECIPE_COUNT = global.window.RECIPES.length;

  // ---- the book ---------------------------------------------------------
  for (const p of PAGES) {
    execFileSync('pdftoppm', ['-png', '-r', '150', '-f', String(p.n), '-l', String(p.n),
      PDF, path.join(tmp, p.name)]);
    const f = fs.readdirSync(tmp).find((x) => x.startsWith(p.name) && x.endsWith('.png'));
    await sharp(path.join(tmp, f)).resize({ width: 760 })
      .webp({ quality: 82 }).toFile(path.join(OUT, p.name + '.webp'));
  }

  // ---- the app ----------------------------------------------------------
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port + '/';
  const { chromium } = playwright();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(base + 'index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);

  /* A week with something in it, so the plan and the list are not photographs
     of two empty states. */
  await page.evaluate(() => {
    [1, 26, 51, 104, 200].forEach((id, i) =>
      window.Store.addToDay(id, ['mon', 'tue', 'wed', 'thu', 'fri'][i]));
  });
  await page.waitForTimeout(600);

  const shot = (name) => page.screenshot({ path: path.join(tmp, name + '.png') });

  await page.click('.tab[data-view="browse"]'); await page.waitForTimeout(500);
  await shot('app-1-browse');
  await page.click('.card'); await page.waitForTimeout(700);
  await shot('app-2-recipe');
  await page.click('.sheet-x'); await page.waitForTimeout(300);
  await page.click('.tab[data-view="plan"]'); await page.waitForTimeout(600);
  await shot('app-3-plan');
  await page.click('.tab[data-view="list"]'); await page.waitForTimeout(700);
  await shot('app-4-list');

  await browser.close();
  srv.close();

  for (const s of SCREENS) {
    await sharp(path.join(tmp, s.name + '.png')).resize({ width: 470 })
      .webp({ quality: 82 }).toFile(path.join(OUT, s.name + '.webp'));
  }

  /* A stamp, because these frames rot silently and expensively. They are
     photographs of a build; the build moves; the page goes on showing a cover
     that advertises a recipe count from two commits ago, and nothing about the
     page looks wrong. It is the same failure mode the rendered PDFs have, and
     it gets the same treatment: record what was photographed, and let
     tests/welcome.test.js fail when the app has moved on without them. */
  fs.writeFileSync(path.join(OUT, 'stamp.json'), JSON.stringify({
    recipes: RECIPE_COUNT,
    pdf: require('crypto').createHash('sha1').update(fs.readFileSync(PDF)).digest('hex').slice(0, 12),
  }, null, 2) + '\n');

  fs.rmSync(tmp, { recursive: true, force: true });
  const frames = fs.readdirSync(OUT).filter((f) => f.endsWith('.webp'));
  const total = frames.reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0);
  console.log('wrote ' + frames.length + ' frames to welcome/demo  (' +
    Math.round(total / 1024) + ' KB total, ' + RECIPE_COUNT + ' recipes)');
  console.log(PAGES.concat(SCREENS).map((x) => '  ' + x.name).join('\n'));
})();
