/* ---------------------------------------------------------------------------
 * Writing a rendered file so that the same book is the same file.
 *
 * print/ is committed — the app hands those PDFs over — and it is thirty-five
 * megabytes. Every `npm run print` used to rewrite all of it, changed or not,
 * because the only bytes that differed from one run to the next were the two
 * dates in each file: Chromium stamps /CreationDate and /ModDate with the
 * second it rendered, and pdf-lib does the same to the booklets. So a run that
 * changed one recipe in Volume Two committed a fresh copy of Volume One, the
 * combined edition, both booklets and the handout as well, and git kept every
 * one of them for good.
 *
 * Two things fix it between them. The dates are fixed: the first of January
 * of the edition's year, which is on the cover, rather than the afternoon it
 * was rendered, which is not a fact about the book. (SOURCE_DATE_EPOCH, the
 * usual convention for reproducible builds, overrides it.) And a file whose
 * bytes have not changed is not written at all — only touched, so that its
 * modified time still says it was checked against the current collection.
 * The comparison ignores the dates, so a book rendered before this existed,
 * and unchanged since, is left exactly as it is rather than rewritten once
 * for the sake of its date.
 * ------------------------------------------------------------------------- */

const fs = require('fs');
const path = require('path');

/* The edition year, read from the one place it is written — the constant the
   covers print, in src/book.js since the book moved out of app.js. */
function editionYear() {
  try {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'book.js'), 'utf8');
    const m = src.match(/var YEAR = '(\d{4})'/);
    if (m) return Number(m[1]);
  } catch (e) { /* fall through */ }
  return 2026;
}

const DATE = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000)
  : new Date(Date.UTC(editionYear(), 0, 1));

/* D:YYYYMMDDHHmmss+00'00', the form Chromium writes, to the character. */
function pdfDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return 'D:' + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) +
    p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + "+00'00'";
}

/* Chromium's two dates, set to DATE in place. The replacement is the same
   length as what it replaces, so every byte offset in the file's cross-
   reference table still points where it did; a date in any other form is
   left alone rather than guessed at. */
const STAMP = /\/(CreationDate|ModDate) \((D:\d{14}[^)]*)\)/g;
function fixDates(buf) {
  const want = pdfDate(DATE);
  const text = buf.toString('latin1');
  const out = text.replace(STAMP, (m, key, was) => (was.length === want.length ? '/' + key + ' (' + want + ')' : m));
  return out === text ? buf : Buffer.from(out, 'latin1');
}

/* pdf-lib's equivalent, for a document it is about to save. */
function fixDocDates(doc) {
  doc.setCreationDate(DATE);
  doc.setModificationDate(DATE);
}

/* Write buf to file unless the file already holds it, dates aside. Returns
   whether it wrote. */
function keep(file, buf) {
  if (fs.existsSync(file)) {
    const had = fs.readFileSync(file);
    if (had.equals(buf) || fixDates(had).equals(fixDates(buf))) {
      const now = new Date();
      fs.utimesSync(file, now, now);
      return false;
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  return true;
}

module.exports = { DATE, pdfDate, fixDates, fixDocDates, keep };
