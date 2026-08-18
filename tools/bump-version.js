/* ---------------------------------------------------------------------------
 * The ?v= that gets a phone off the copy it is holding.
 *
 * Every script and stylesheet is requested with ?v=N, the service worker
 * precaches those exact URLs, and the fetch handler serves sub-resources
 * cache-first. That is the right design and it has one sharp edge: the cache
 * is keyed by the URL, so if a generated file's *contents* change while N
 * stays put, the URL never changes and there is nothing to invalidate. Every
 * phone with the app installed goes on serving the old copy indefinitely.
 *
 * That is not hypothetical. data/art.js gained four section engravings, and a
 * browser holding the previous manifest rendered a 180-page book underneath a
 * button offering a 184-page file — the four openers it did not know about.
 * Two numbers on one screen, disagreeing, with nothing to say why.
 *
 * Until now both build tools ended by *printing* "bump ?v= in index.html and
 * sw.js so phones pick it up", which is a reminder, and a reminder is a thing
 * that works until the afternoon somebody is in a hurry. They call this
 * instead.
 *
 * The stamp is the other half. It records the version alongside a hash of
 * every file that version covers, so a data file edited by hand — or written
 * by a tool that forgot to call this — no longer matches, and the suite says
 * so rather than a phone finding out in a basement six weeks later.
 * ------------------------------------------------------------------------- */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');

/* Everything the version covers: the files the service worker precaches by
   versioned URL. Not the art PNGs — those are unversioned by design, and a
   changed engraving under an unchanged name is a picture, not a page count. */
const COVERED = [
  'data/recipes.js', 'data/nutrition.js', 'data/art.js', 'data/qr.js',
  'src/app.js', 'src/sync.js', 'src/config.js', 'src/style.css',
];

const STAMP = path.join(ROOT, 'data', 'stamp.json');

function hash(rel) {
  const f = path.join(ROOT, rel);
  if (!fs.existsSync(f)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
}

function hashes() {
  const out = {};
  COVERED.forEach((rel) => { const h = hash(rel); if (h) out[rel] = h; });
  return out;
}

function current() {
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = src.match(/\?v=(\d+)/);
  return m ? Number(m[1]) : null;
}

/* Write the stamp for whatever is on disk right now, at whatever version
   index.html is on. Used after a bump, and on its own by `npm run stamp` when
   a file was changed deliberately and the version has already moved. */
function stamp() {
  const v = current();
  if (v === null) return null;
  fs.writeFileSync(STAMP, JSON.stringify({ v: v, files: hashes() }, null, 2) + '\n');
  return v;
}

/* Bump index.html, sw.js and the cache name together, then re-stamp.
 *
 * A no-op when nothing the version covers has actually changed since the last
 * stamp — running `npm run build` twice should not march the number, or every
 * phone re-downloads the shell to find it is identical. */
function bump(why) {
  const was = current();
  if (was === null) { console.log('  no ?v= found in index.html — version not bumped'); return null; }

  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(STAMP, 'utf8')); } catch (e) { /* first run */ }
  const now = hashes();
  if (prev && prev.v === was &&
      Object.keys(now).every((k) => prev.files[k] === now[k]) &&
      Object.keys(prev.files).every((k) => now[k] === prev.files[k])) {
    return was;                                   // nothing the version covers moved
  }

  const next = was + 1;
  ['index.html', 'sw.js'].forEach((rel) => {
    const f = path.join(ROOT, rel);
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8')
      .replace(/\?v=\d+/g, '?v=' + next)
      .replace(/storehouse-v\d+/g, 'storehouse-v' + next));
  });
  stamp();
  console.log('?v=' + was + ' -> ?v=' + next + (why ? '  (' + why + ')' : '') +
    '\n  phones will fetch the changed files instead of serving their cached copy.');
  return next;
}

module.exports = { bump, stamp, current, hashes, COVERED, STAMP };

if (require.main === module) {
  if (process.argv[2] === '--stamp') {
    console.log('stamped at ?v=' + stamp());
  } else {
    bump(process.argv.slice(2).join(' ') || null);
  }
}
