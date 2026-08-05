/* ---------------------------------------------------------------------------
 * Turns a half-letter book into sheets you can fold.
 *
 * A saddle-stitched booklet is not printed in reading order. Each sheet of
 * letter paper, landscape, carries two pages on the front and two on the back,
 * and which pages depends on how far into the stack the sheet sits: fold the
 * whole pile in half, staple the spine, and the pages come out 1, 2, 3.
 *
 * For a book of N pages, sheet s (counting from nought) carries
 *
 *     front   left = N − 2s        right = 2s + 1
 *     back    left = 2s + 2        right = N − 2s − 1
 *
 * so the outermost sheet holds the back cover and the front cover on one side,
 * and the two pages behind them on the other. N has to be a multiple of four,
 * which is why the book pads itself with blanks before its back cover.
 *
 * Print the result double-sided, landscape, flipping on the SHORT edge. The
 * fold on a landscape sheet runs down the middle, so a short-edge flip is the
 * one that puts page 2 behind page 1 rather than upside down under it.
 * ------------------------------------------------------------------------- */

const fs = require('fs');
const path = require('path');

function pdflib() {
  for (const m of ['pdf-lib', '/tmp/node_modules/pdf-lib']) {
    try { return require(m); } catch (e) { /* try the next */ }
  }
  console.error('pdf-lib is not installed. `npm i -D pdf-lib` and try again.');
  process.exit(2);
}

const PT = 72;
const SHEET = [11 * PT, 8.5 * PT];     // letter, landscape
const HALF = 5.5 * PT;

async function impose(inFile, outFile) {
  const { PDFDocument } = pdflib();
  const src = await PDFDocument.load(fs.readFileSync(inFile));
  const n = src.getPageCount();
  if (n % 4) throw new Error(path.basename(inFile) + ' has ' + n + ' pages; a folded booklet needs a multiple of four');

  const out = await PDFDocument.create();
  const pages = await out.embedPages(src.getPages());
  const size = src.getPage(0).getSize();
  const scale = Math.min(HALF / size.width, SHEET[1] / size.height);
  const w = size.width * scale, h = size.height * scale;
  const yOff = (SHEET[1] - h) / 2;

  const put = (sheet, slot, pageNo) => {
    sheet.drawPage(pages[pageNo - 1], {
      x: slot === 'left' ? (HALF - w) / 2 : HALF + (HALF - w) / 2,
      y: yOff, width: w, height: h,
    });
  };

  for (let s = 0; s < n / 4; s++) {
    const front = out.addPage(SHEET);
    put(front, 'left', n - 2 * s);
    put(front, 'right', 2 * s + 1);
    const back = out.addPage(SHEET);
    put(back, 'left', 2 * s + 2);
    put(back, 'right', n - 2 * s - 1);
  }

  fs.writeFileSync(outFile, await out.save());
  return { sheets: n / 4, pages: n };
}

module.exports = { impose };

if (require.main === module) {
  const [inFile, outFile] = process.argv.slice(2);
  if (!inFile) {
    console.error('usage: node tools/booklet.js <book.pdf> [booklet.pdf]');
    process.exit(2);
  }
  const dest = outFile || inFile.replace(/\.pdf$/i, '-booklet.pdf');
  impose(inFile, dest).then((r) => {
    console.log(path.basename(dest) + '  ' + r.pages + ' pages on ' + r.sheets +
      ' sheets of letter paper, folded');
  }).catch((e) => { console.error(e.message); process.exit(1); });
}
