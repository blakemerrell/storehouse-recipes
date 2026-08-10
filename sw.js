/* ---------------------------------------------------------------------------
 * Service worker — so the app opens with no signal.
 *
 * Firestore already keeps the data offline. What it could not do was hand you
 * the app itself: tapping the icon on a home screen in a storehouse basement
 * meant a browser error page, because index.html, the stylesheet, the scripts
 * and the recipes all had to come off the network first. They are cached here.
 *
 * Two rules, because they answer different questions:
 *
 *   the page itself   network first, cache as a fallback. Online, you always
 *                     get the current index.html, so a deployment lands on the
 *                     very next load. Offline, you get the last one that worked.
 *   everything else   cache first, and quietly fetch a fresh copy afterwards
 *                     for next time. Nothing waits on the network.
 *
 * Anything not on this origin — the Firebase SDK, Firestore itself — is left
 * alone entirely and goes straight to the network, where the SDK's own offline
 * handling takes over.
 * ------------------------------------------------------------------------- */

/* Bump this when the shell changes. The old cache is deleted on activate, which
   is what gets a phone that is holding a previous build onto the current one. */
var CACHE = 'storehouse-v22';

var SHELL = [
  './',
  './index.html',
  './src/style.css?v=24',
  './src/config.js',
  './src/sync.js?v=24',
  './src/app.js?v=24',
  './data/recipes.js',
  './data/nutrition.js',
  './data/art.js',
  './art/easy-lunches-wraps-and-after-school-favorites.png',
  './art/elaborate-sunday-feasts-and-roasts.png',
  './art/for-the-love-of-chocolate.png',
  './art/kid-approved-weeknight-comfort-dinners.png',
  './art/simple-family-treats-and-desserts.png',
  './art/speedy-weekday-breakfasts-and-morning-treats.png',
  './art/the-copycat-shelf.png',
  './art/worth-the-afternoon.png',
  './fonts/source-serif-4-latin-wght-normal.woff2',
  './fonts/source-serif-4-latin-wght-italic.woff2',
  './fonts/work-sans-latin-wght-normal.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  './icons/icon-32.png',
  './manifest.webmanifest'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      // one missing file must not take the whole install down with it
      .then(function (c) {
        return Promise.all(SHELL.map(function (u) {
          return c.add(u).catch(function () {});
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Firestore and the SDK

  /* The rendered books are five megabytes and are wanted once, at a desk, on
     the way to a print shop. Keeping them on a phone for a shopping trip would
     be the wrong five megabytes. */
  if (url.pathname.indexOf('/print/') >= 0) return;

  if (req.mode === 'navigate') {
    /* 'no-cache' revalidates with the server instead of trusting the browser's
       own HTTP cache. GitHub Pages serves index.html with max-age=600, so
       without this a deployment could not land for ten minutes: the fetch below
       would be answered out of the HTTP cache with the previous index.html,
       still pointing at the previous ?v= of the scripts, and the app would go
       on looking unchanged for no reason anyone could see. The server answers
       304 when nothing moved, so this costs a round trip, not a download. */
    e.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (hit) {
            return hit || caches.match('./index.html');
          });
        })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      var live = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || live;
    })
  );
});
