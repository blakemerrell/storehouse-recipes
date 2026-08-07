/* ---------------------------------------------------------------------------
 * Section art — turns the generated illustrations into something the book can
 * actually print.
 *
 *     node tools/prep-art.js              prepare every image in art/src
 *     node tools/prep-art.js --preview    write a contact sheet and stop
 *
 * The source images arrive as 1024-square colour PNGs with the section name
 * and the book title burned into a band across the top. That band cannot be
 * used: it is set in a condensed sans that appears nowhere else in the book,
 * and it carries a typo — the title reads 'BISHOPS' STOREHOUSE RECIPE BOOKS'
 * with quote marks wrapped around the whole line. Neither is fixable in
 * pixels, so the band comes off and the book sets the section name itself in
 * Source Serif 4, the way it sets every other heading.
 *
 * That also means renaming a section never orphans its picture, which matters
 * in a repository where a volume was renamed last week.
 *
 * What comes out: grayscale line art on the page's own colour, no frame, no
 * paper texture, sized for half-letter at 300dpi and no larger. The books are
 * carried to a print shop as a single PDF and opened on phones with no signal,
 * so every kilobyte here is one the reader pays for twice.
 * ------------------------------------------------------------------------- */

'use strict';

var fs = require('fs');
var path = require('path');
var sharp = require('sharp');

var SRC = path.join(__dirname, '..', 'art', 'src');
var OUT = path.join(__dirname, '..', 'art');

/* A section heading is 3.4in of column at most, and the art sits above it at
   the same width. 300dpi of that is 1020px — near enough the 1024 the sources
   already are that upscaling would be inventing detail. So this is a ceiling,
   not a target: images arrive at or below it and are never enlarged. */
var MAX_W = 1020;

/* Ink and paper, read off the book's own stylesheet rather than guessed, so
   the art lands on the same two colours as the type beside it. */
var INK = 0x2b, PAPER = 0xfa;

/* ---------------------------------------------------------------- the band

   The title band is the top slice of the square, and its depth changes with
   how many lines the section name wrapped to — one line for The Copycat
   Shelf, two for Kid-Approved Weeknight Comfort Dinners. Hard-coding a
   fraction would cut a descender off one image and leave a stripe of band on
   another, so find the seam instead.

   The signal that works is not the widest gap — the sources are printed on a
   speckled paper texture, so no row is ever truly blank and a run-length test
   finds nothing. What separates band from illustration is that the band is
   mostly empty with a few bands of text across it, while engraved hatching is
   dense on every single row once it starts. So the last nearly-empty row in
   the upper half is the seam: below it the picture begins and never lets up.

   Measured across the ten sources this reads 22% for a one-line title and
   around 30% for two, which is the band doing what it should. */
function findSeam(rows, h) {
  var last = 0;

  /* Start below the decorative border, stop at halfway: past that we would be
     looking at whitespace inside the illustration. */
  for (var y = Math.round(h * 0.08); y < Math.round(h * 0.5); y++) {
    if (rows[y] < 0.06) last = y;
  }

  /* No quiet row at all means no band — an image generated clean. Use it whole
     rather than guessing a crop into the picture. */
  return last ? last + 1 : 0;
}

/* Ink per row, as a fraction of the row's width. Cheap, and all the seam
   finder needs — it is looking for empty, not for shape. */
function inkByRow(data, w, h) {
  var rows = new Array(h);
  for (var y = 0; y < h; y++) {
    var dark = 0;
    for (var x = 0; x < w; x++) if (data[y * w + x] < 200) dark++;
    rows[y] = dark / w;
  }
  return rows;
}

/* ------------------------------------------------------------- the frame

   Every source carries a decorative rule a few pixels in from the edge. It is
   a different frame from anything else in the book, and around a heading it
   reads as a sticker. Inset past it before trimming. */
function inset(w, h) { return Math.round(Math.min(w, h) * 0.075); }

async function prepare(file) {
  var src = path.join(SRC, file);
  var gray = sharp(src).grayscale();
  var meta = await gray.metadata();

  var raw = await gray.raw().toBuffer();
  var seam = findSeam(inkByRow(raw, meta.width, meta.height), meta.height);
  var pad = inset(meta.width, meta.height);

  var top = Math.max(seam, pad);

  /* Two passes, because sharp will not take an extract and a trim in one
     pipeline — it plans both as crops and the second is measured against
     dimensions the first has not produced yet, which comes back as
     'bad extract area'. Cropping to a buffer first sidesteps it. */
  var cropped = await sharp(src)
    .grayscale()
    .extract({
      left: pad, top: top,
      width: meta.width - pad * 2,
      height: meta.height - top - pad
    })
    .png()
    .toBuffer();

  var out = await sharp(cropped)
    /* Pull the cream paper up to the book's page colour and the sepia line
       down to its ink. Without this the art brings its own off-white with it
       and sits on the page as a visible tile. */
    .normalise()
    .linear((PAPER - INK) / 255, INK)
    /* Whatever border survived the inset is uniform, so trimming from the
       corner colour takes it without touching the picture. */
    .trim({ threshold: 12 })
    .resize({ width: MAX_W, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true, colours: 64 })
    .toBuffer();

  var name = file.replace(/\.[^.]+$/, '') + '.png';
  fs.writeFileSync(path.join(OUT, name), out);

  var after = await sharp(out).metadata();
  return {
    name: name,
    band: seam ? Math.round(seam / meta.height * 100) + '%' : 'none',
    size: after.width + '×' + after.height,
    kb: Math.round(out.length / 1024)
  };
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('No art/src — put the source images there first.');
    process.exit(1);
  }
  var files = fs.readdirSync(SRC).filter(function (f) { return /\.(png|jpe?g|webp)$/i.test(f); });
  if (!files.length) { console.error('art/src is empty.'); process.exit(1); }

  var rows = [];
  for (var i = 0; i < files.length; i++) rows.push(await prepare(files[i]));

  var total = 0;
  rows.forEach(function (r) {
    total += r.kb;
    console.log(r.name.padEnd(38), ('band ' + r.band).padEnd(12), r.size.padEnd(11), r.kb + ' KB');
  });
  console.log('\n' + rows.length + ' images, ' + total + ' KB total');

  /* A manifest keyed by the section's slug, so the book finds its art by
     slugifying the section name rather than by a list someone has to keep in
     step. Drop a file in art/src named for a section, run this, and that
     section has a page — no code changes, which is the point.

     Spares live in art/src/alt and are never read at all — readdirSync only
     returns the directory entry, which the extension filter drops. They are
     duplicate generations of sections that already have a picture, kept
     because "the other one was better" is a judgement worth being able to
     revisit, and because deleting them reclaims nothing: they are already in
     the history. */
  var manifest = {};
  rows.map(function (r) { return r.name.replace(/\.png$/, ''); })
      .filter(function (s) { return !/--alt$/.test(s); })
      .sort()
      .forEach(function (s) { manifest[s] = 'art/' + s + '.png'; });

  fs.writeFileSync(path.join(__dirname, '..', 'data', 'art.js'),
    '/* Written by tools/prep-art.js — do not edit by hand. */\n' +
    'window.SECTION_ART = ' + JSON.stringify(manifest, null, 2) + ';\n');
  console.log(Object.keys(manifest).length + ' in data/art.js');

  /* The crop is the one thing worth looking at with eyes rather than trusting
     — a seam found two lines too high loses the top of the picture and the
     tests cannot see it. */
  if (process.argv.indexOf('--preview') >= 0) {
    var sheet = path.join(OUT, 'contact-sheet.png');
    await sharp({
      create: { width: 340 * 3, height: 340 * Math.ceil(rows.length / 3),
                channels: 3, background: '#fafafa' }
    }).composite(await Promise.all(rows.map(async function (r, i) {
      return {
        input: await sharp(path.join(OUT, r.name)).resize(320, 320,
          { fit: 'contain', background: '#fafafa' }).toBuffer(),
        left: (i % 3) * 340 + 10, top: Math.floor(i / 3) * 340 + 10
      };
    }))).png().toFile(sheet);
    console.log('contact sheet: ' + path.relative(process.cwd(), sheet));
  }
}

main().catch(function (e) { console.error(e.stack || e.message); process.exit(1); });
