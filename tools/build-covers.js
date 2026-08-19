/* ---------------------------------------------------------------------------
 * Cover thumbnails for the print screen.
 *
 *     node tools/build-covers.js
 *
 * Page one of each shipped PDF, at thumbnail size, into art/covers/. The print
 * screen shows them as a grid you pick from, which is the whole reason they
 * have to be real renders rather than drawings: a picture of a cover is a
 * claim about what arrives when you press the button, and the four covers
 * genuinely differ — two volumes with their own titles, the combined edition,
 * and the one-book run.
 *
 * Run by tools/print-books.js after it renders, so a cover cannot go on
 * advertising a book that has been reset since. tests/print.test.js checks
 * that every offered file has one and that it is newer than the PDF it is of.
 *
 * Needs pdftoppm (poppler-utils) and sharp.
 * ------------------------------------------------------------------------- */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PDFS = path.join(ROOT, 'print');
const OUT = path.join(ROOT, 'art', 'covers');

/* Keyed by the print set, so src/app.js can look one up by the same key it
   already uses for READY_MADE.
 *
 * 'all' is deliberately not Both-Books.pdf's own first page. That file opens
 * on Volume One's cover, so its thumbnail came out pixel-identical to Run and
 * Not Be Weary's — two different downloads showing the same picture, in a grid
 * whose entire job is telling them apart. It is drawn as the two volumes
 * overlapping instead, which is also what the file actually is. */
const COVERS = {
  one: 'Hive-and-Hearth-Recipes.pdf',
  1: 'Run-and-Not-Be-Weary.pdf',
  2: 'Around-the-Table.pdf',
};

/* Wide enough to stay sharp on a 2x screen at the ~150px the grid draws them,
   small enough that four of them are a rounding error next to the engravings. */
const W = 320;

function sharpLib() {
  for (const m of ['sharp', '/tmp/node_modules/sharp']) {
    try { return require(m); } catch (e) { /* try the next */ }
  }
  return null;
}

function build() {
  const sharp = sharpLib();
  if (!sharp) { console.log('  sharp is not installed — cover thumbnails not rebuilt'); return; }

  fs.mkdirSync(OUT, { recursive: true });
  const made = [];
  Object.keys(COVERS).forEach((key) => {
    const pdf = path.join(PDFS, COVERS[key]);
    if (!fs.existsSync(pdf)) return;                 // that book was not rendered

    const stem = path.join(OUT, 'tmp-' + key);
    try {
      execFileSync('pdftoppm', ['-png', '-r', '100', '-f', '1', '-l', '1', pdf, stem],
        { stdio: 'pipe' });
    } catch (e) {
      console.log('  pdftoppm failed for ' + COVERS[key] + ' — is poppler-utils installed?');
      return;
    }
    const raw = fs.readdirSync(OUT).filter((f) => f.indexOf('tmp-' + key + '-') === 0)[0];
    if (!raw) { console.log('  no page came out of ' + COVERS[key]); return; }

    const dest = path.join(OUT, key + '.webp');
    return sharp(path.join(OUT, raw))
      .resize({ width: W })
      .webp({ quality: 82 })
      .toFile(dest)
      .then(() => {
        fs.unlinkSync(path.join(OUT, raw));
        made.push(key + '.webp ' + Math.round(fs.statSync(dest).size / 1024) + ' KB');
      });
  });

  return Promise.resolve().then(() => {
    // the resizes above are promises; give them a tick and report what landed
    return new Promise((ok) => setTimeout(ok, 1500));
  }).then(() => {
    /* The combined edition: both volumes, one behind the other. Drawn rather
       than lifted, for the reason in COVERS above. */
    const v1 = path.join(OUT, '1.webp'), v2 = path.join(OUT, '2.webp');
    if (!fs.existsSync(v1) || !fs.existsSync(v2)) return;
    const back = Math.round(W * 0.80), lift = Math.round(W * 0.075);
    return Promise.all([
      sharp(v2).resize({ width: back })
        .extend({ top: 1, bottom: 1, left: 1, right: 1,
                  background: { r: 150, g: 130, b: 100, alpha: 1 } }).toBuffer(),
      sharp(v1).resize({ width: back })
        .extend({ top: 1, bottom: 1, left: 1, right: 1,
                  background: { r: 150, g: 130, b: 100, alpha: 1 } }).toBuffer(),
    ]).then(([b, f]) => sharp(b).metadata().then((m) => sharp({
      create: { width: W, height: m.height + lift + 2, channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).composite([{ input: b, left: W - back - 2, top: 0 },
                  { input: f, left: 0, top: lift }])
      .webp({ quality: 82 }).toFile(path.join(OUT, 'all.webp'))));
  }).then(() => {
    fs.readdirSync(OUT).filter((f) => f.indexOf('tmp-') === 0)
      .forEach((f) => { try { fs.unlinkSync(path.join(OUT, f)); } catch (e) { /* gone */ } });
    const have = fs.readdirSync(OUT).filter((f) => /\.webp$/.test(f));
    console.log('cover thumbnails: ' + have.join(', '));
  });
}

module.exports = { build, COVERS, OUT };

if (require.main === module) build();
