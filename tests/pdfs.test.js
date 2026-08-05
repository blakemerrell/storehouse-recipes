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

    for (const [set, file] of [['1', 'Strong-and-Simple.pdf'], ['2', 'Around-the-Table.pdf'], ['all', 'Both-Books.pdf']]) {
      const full = path.join(DIR, file);
      if (!fs.existsSync(full)) { t.ok(file + ' is shipped', false, 'missing — run npm run print'); continue; }

      await p.selectOption('#printSet', set);
      const live = await settle();
      const doc = await PDFDocument.load(fs.readFileSync(full));
      const size = doc.getPage(0).getSize();

      t.ok(file + ' matches what the app renders today',
        doc.getPageCount() === live,
        doc.getPageCount() + ' in the file, ' + live + ' rendered — run npm run print');
      t.ok(file + ' is half-letter, so it needs no dialog',
        Math.abs(size.width / 72 - 5.5) < 0.02 && Math.abs(size.height / 72 - 8.5) < 0.02,
        (size.width / 72).toFixed(2) + ' x ' + (size.height / 72).toFixed(2) + ' in');

      // the download button has to point at the file that exists
      const href = await p.evaluate(() => {
        const a = document.getElementById('dlBook');
        return a.classList.contains('hide') ? null : a.getAttribute('href');
      });
      t.ok('and the app offers it for download', href === 'print/' + file, String(href));
    }

    // the booklets: letter landscape, a quarter as many sides as the book has pages
    for (const [book, bk] of [['Strong-and-Simple.pdf', 'Strong-and-Simple-booklet.pdf'],
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

    // and the selections that cannot be made ahead of time fall back to printing
    await p.selectOption('#printSet', 'fav');
    await p.waitForTimeout(800);
    t.ok('favorites offer the print dialog instead, having no file to hand',
      await p.evaluate(() => document.getElementById('dlBook').classList.contains('hide') &&
        !document.getElementById('doPrint').classList.contains('hide')));

    await p.context().close();
  },
};
