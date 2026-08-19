/* The books shipped in print/ are what the app hands you when you press
 * Download, and what goes to a printer. They are generated, so they can fall
 * behind the recipes — this is the check that says so before a printer finds
 * out. Run `npm run print` if it fails.
 */

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'print');

function pdflib() {
  for (const m of ['pdf-lib', '/tmp/node_modules/pdf-lib']) {
    try { return require(m); } catch (e) { /* try the next */ }
  }
  return null;
}

module.exports = {
  name: 'The shipped PDFs',
  async run(t) {
    const lib = pdflib();
    if (!lib) { t.ok('pdf-lib is available to read them', false, 'npm i -D pdf-lib'); return; }
    const { PDFDocument } = lib;

    const p = await t.fresh();
    await p.click('.tab[data-view="book"]');

    const settle = async () => {
      let last = -1, still = 0;
      for (let i = 0; i < 120 && still < 3; i++) {
        await p.waitForTimeout(250);
        const n = await p.evaluate(() => document.querySelectorAll('.pg:not(.no-print)').length);
        if (n === last && n > 0) still++; else { still = 0; last = n; }
      }
      return last;
    };

    for (const [set, file] of [['1', 'Run-and-Not-Be-Weary.pdf'], ['2', 'Around-the-Table.pdf'], ['all', 'Both-Books.pdf']]) {
      const full = path.join(DIR, file);
      if (!fs.existsSync(full)) { t.ok(file + ' is shipped', false, 'missing — run npm run print'); continue; }

      await p.click('[data-print="' + set + '"]');
      const live = await settle();
      const doc = await PDFDocument.load(fs.readFileSync(full));
      const size = doc.getPage(0).getSize();

      t.ok(file + ' matches what the app renders today',
        doc.getPageCount() === live,
        doc.getPageCount() + ' in the file, ' + live + ' rendered — run npm run print');
      t.ok(file + ' is half-letter, so it needs no dialog',
        Math.abs(size.width / 72 - 5.5) < 0.02 && Math.abs(size.height / 72 - 8.5) < 0.02,
        (size.width / 72).toFixed(2) + ' x ' + (size.height / 72).toFixed(2) + ' in');

      /* The cover picks it up; the button under the cover hands it over. So
         the button has to point at the file whose cover is above it. */
      const href = await p.evaluate((set) => {
        const a = document.querySelector('[data-get="' + set + '"]');
        return a ? a.getAttribute('href') : null;
      }, set);
      t.ok('and the app offers it for download', href === 'print/' + file, String(href));
    }

    // the booklets: letter landscape, a quarter as many sides as the book has pages
    for (const [book, bk] of [['Run-and-Not-Be-Weary.pdf', 'Run-and-Not-Be-Weary-booklet.pdf'],
      ['Around-the-Table.pdf', 'Around-the-Table-booklet.pdf']]) {
      const a = path.join(DIR, book), b = path.join(DIR, bk);
      if (!fs.existsSync(b)) { t.ok(bk + ' is shipped', false, 'missing'); continue; }
      const src = await PDFDocument.load(fs.readFileSync(a));
      const imp = await PDFDocument.load(fs.readFileSync(b));
      const size = imp.getPage(0).getSize();
      t.ok(bk + ' folds the whole book onto letter sheets',
        imp.getPageCount() === src.getPageCount() / 2 &&
        Math.abs(size.width / 72 - 11) < 0.02 && Math.abs(size.height / 72 - 8.5) < 0.02,
        imp.getPageCount() + ' sides at ' + (size.width / 72).toFixed(1) + ' x ' + (size.height / 72).toFixed(1));
    }

    /* "Download PDF · 108 pages" — against the pages the PDF actually has.
     *
     * READY_MADE in src/app.js carried those four numbers by hand, and hand is
     * the whole problem: three of them were wrong within a single afternoon of
     * adding recipes, and the button went on confidently offering a page count
     * from two builds ago. Nobody can tell a wrong number from a right one by
     * looking, which is what makes it worth a test rather than a proofread.
     *
     * tools/print-books.js writes them now, straight off the render. This is
     * the check that it did, and that nobody has since edited one back. */
    const table = (fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8')
      .match(/var READY_MADE = \{[\s\S]*?\n {2}\};/) || [''])[0];
    const claims = [...table.matchAll(/file: '([^']+)'[^}]*?pages: (\d+)/g)];
    t.ok('the ready-made table lists every file the app can offer',
      claims.length === 4, claims.length + ' rows found');
    for (const [, file, claimed] of claims) {
      const full = path.join(DIR, file);
      if (!fs.existsSync(full)) { t.ok(file + ' exists to be counted', false, 'missing'); continue; }
      const real = (await PDFDocument.load(fs.readFileSync(full))).getPageCount();
      t.ok('the button offering ' + file + ' names its real length',
        Number(claimed) === real,
        'button says ' + claimed + ', file has ' + real + ' — run npm run print');
    }

    // and the selections that cannot be made ahead of time fall back to printing
    await p.click('[data-print="fav"]');
    await p.waitForTimeout(800);
    /* And the two with no file offer the dialog — but only once they are the
       one selected, because the dialog prints whatever is laid out below and
       an unselected card offering it would print the wrong book onto paper. */
    t.ok('favorites offer the print dialog instead, having no file to hand',
      await p.evaluate(() => {
        const slot = document.querySelector('.bk-card[data-print="fav"]').closest('.bk-slot');
        const act = slot.querySelector('.bk-get');
        return !document.querySelector('[data-get="fav"]') &&
          act.tagName === 'BUTTON' && act.id === 'doPrint';
      }));

    await p.context().close();
  },
};
