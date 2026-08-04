/*
 * Builds a single self-contained HTML file from the app — every stylesheet,
 * script and the recipe data inlined, and the two webfonts embedded as data
 * URIs so the page needs no network at all.
 *
 * Used for the shareable preview. The real app stays as separate files.
 *
 * Run: node tools/build-preview.js <output.html>
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'preview.html');

const FONT_CSS = 'https://fonts.googleapis.com/css2' +
  '?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400' +
  '&family=Work+Sans:wght@400;500;600&display=swap';

// a modern UA, otherwise Google serves the ancient truetype stylesheet
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function get(url, binary) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location, binary).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error(url + ' -> ' + res.statusCode));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(binary ? Buffer.concat(chunks) : Buffer.concat(chunks).toString('utf8')));
    }).on('error', reject);
  });
}

(async () => {
  let css = await get(FONT_CSS, false);

  // Keep only the latin subsets. The recipes are English; shipping Cyrillic and
  // Vietnamese would triple the page weight for nothing.
  const blocks = css.split('@font-face').slice(1).map((b) => '@font-face' + b.split('}')[0] + '}');
  const wanted = blocks.filter((b) => /unicode-range:[^;]*U\+0000-00FF/.test(b));

  const urls = [...new Set(wanted.flatMap((b) => (b.match(/https:\/\/[^)]+\.woff2/g) || [])))];
  console.log('embedding ' + urls.length + ' font files');

  const data = {};
  let bytes = 0;
  for (const u of urls) {
    const buf = await get(u, true);
    bytes += buf.length;
    data[u] = 'data:font/woff2;base64,' + buf.toString('base64');
  }
  console.log('font payload: ' + Math.round(bytes / 1024) + 'KB');

  let fontCss = wanted.join('\n');
  Object.keys(data).forEach((u) => { fontCss = fontCss.split(u).join(data[u]); });

  const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const appCss = read('src/style.css');
  const html = read('index.html');

  // the markup between <body> and the script tags, exactly as the app ships it
  const body = html.split('<body>')[1].split('<script')[0].trim();

  // The charset declaration has to be the first thing in the content: the page
  // is full of curly quotes, fraction glyphs and middots, and without it a host
  // that does not send a charset header decodes them as Latin-1.
  const page = `<meta charset="utf-8">
<title>Bishops' Storehouse Recipe Books</title>
<style>
${fontCss}
${appCss}
</style>
${body}
<script>
${read('data/recipes.js')}
</script>
<script>
window.FIREBASE_CONFIG = { apiKey: "", authDomain: "", projectId: "", storageBucket: "", messagingSenderId: "", appId: "" };
</script>
<script>
${read('src/sync.js')}
</script>
<script>
${read('src/app.js')}
</script>
`;

  fs.writeFileSync(OUT, page);
  console.log('wrote ' + OUT + ' (' + Math.round(fs.statSync(OUT).size / 1024) + 'KB)');
})().catch((e) => { console.error(e.message); process.exit(1); });
