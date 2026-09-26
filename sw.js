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
var CACHE = 'storehouse-v516';

/* The app itself. If any one of these does not arrive, the install fails and
   the phone keeps the worker and the cache it already had. */
var CORE = [
  './',
  './index.html',
  './src/style.css?v=516',
  './src/config.js?v=516',
  './src/sync.js?v=516',
  './src/train.js?v=516',
  './src/app.js?v=516',
  './data/recipes.js?v=516',
  './data/nutrition.js?v=516',
  './data/art.js?v=516',
  './data/qr.js?v=516',
  './manifest.webmanifest'
];

/* Pictures and typefaces. Worth having offline, not worth failing over. */
var EXTRAS = [
  './art/batch-prep.png',
  './art/best-before-bed.png',
  './art/breakfasts.png',
  './art/dinner.png',
  './art/easy-lunches-wraps-and-after-school-favorites.png',
  './art/elaborate-sunday-feasts-and-roasts.png',
  './art/for-the-love-of-chocolate.png',
  './art/kid-approved-weeknight-comfort-dinners.png',
  './art/lunch.png',
  './art/made-not-bought.png',
  './art/power-drinks.png',
  './art/simple-family-treats-and-desserts.png',
  './art/snacks.png',
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
  /* The cover thumbnails on the print screen. Listed after the icons on
     purpose: prep-art.js rewrites the run of './art/...' lines at the top of
     this array from the engraving manifest, and anything of its own sitting
     inside that run would be written straight out again. */
  './art/covers/all.webp',
  './art/covers/one.webp',
  './art/covers/1.webp',
  './art/covers/2.webp'
];

var SHELL = CORE.concat(EXTRAS);

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) {
        /* Split, because "one missing file must not take the whole install
           down with it" was only half right. It is true of a section
           illustration and false of app.js: every fetch failure was swallowed,
           install resolved anyway, and activate then deleted the previous
           cache — so a phone updating on a flaky connection ended up with a
           new cache missing the scripts and no old cache to fall back on. The
           app it had been opening offline for months stopped opening at all.
           The core must all arrive or the install fails, which leaves the
           working worker and its cache exactly where they were. */
        /* 'reload' for the same reason the navigate handler uses 'no-cache':
           GitHub Pages serves these with max-age=600, and cache.add() goes
           through the browser's own HTTP cache. So a new service worker could
           seed its brand-new cache with files up to ten minutes old, and then
           serve them cache-first for as long as that cache lived. The
           versioned URLs were never at risk — ?v=516 is a URL the HTTP cache
           has never seen — but data/recipes.js carried no version, so the one
           file that changes every time recipes are added was the one file that
           could arrive stale and stay that way. Both halves are fixed: the
           data files are versioned now, and the shell no longer trusts the
           HTTP cache to tell it what is current. */
        var get = function (u) {
          return fetch(u, { cache: 'reload' }).then(function (res) {
            if (!res || !res.ok) throw new Error(u);
            return c.put(u, res);
          });
        };
        return Promise.all(CORE.map(get)).then(function () {
          // the rest is pictures and typefaces: nice to have offline, not the app
          return Promise.all(EXTRAS.map(function (u) { return get(u).catch(function () {}); }));
        });
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

  /* And the landing page, for a subtler reason. Its markup is network-first
     like any navigation, so the words on it are never stale — but the eight
     demo frames beside them are ordinary sub-resources, which the handler below
     serves cache-first and only refreshes for next time. Their filenames do not
     change when they are rebuilt, so a phone that had seen the page once would
     go on showing frames from the previous build while the text around them was
     current: exactly the failure data/recipes.js had, one directory over.

     Versioning eight filenames would fix it, and so does this, which also costs
     nothing anyone wants. Nobody opens a landing page with no signal — it is
     the page you send to somebody who has not got the app yet. */
  if (url.pathname.indexOf('/welcome/') >= 0) return;

  if (req.mode === 'navigate') {
    /* 'no-cache' revalidates with the server instead of trusting the browser's
       own HTTP cache. GitHub Pages serves index.html with max-age=600, so
       without this a deployment could not land for ten minutes: the fetch below
       would be answered out of the HTTP cache with the previous index.html,
       still pointing at the previous ?v= of the scripts, and the app would go
       on looking unchanged for no reason anyone could see. The server answers
       304 when nothing moved, so this costs a round trip, not a download. */
    /* The copy kept for no signal: this page's own, or for the app's
       address, the shell. */
    var kept = function () {
      return caches.match(req).then(function (hit) {
        /* The shell answers for the app's own address and nothing else.
           It used to answer for any same-origin path, so a mistyped or
           dead URL came back as a working-looking cookbook rather than as
           a page that could not be found. */
        if (hit) return hit;
        var root = new URL('./', self.location).pathname;
        if (url.pathname === root || url.pathname === root + 'index.html') return caches.match('./index.html');
        return null;
      });
    };
    var net = fetch(req, { cache: 'no-cache' }).then(function (res) {
      /* Only a real answer from this origin gets kept. Anything that came
         back was being written over the cached page before — so a hotel
         wifi login screen, which is a perfectly successful 200 for a
         document that is not this one, or a 502 from a bad deploy, became
         the copy the phone opened with no signal from then on. A page that
         will not load is recoverable; a page that loads and is wrong is
         the one somebody stands in a basement arguing with.
       *
         And only a page whose scripts are this worker's own. A deploy met
         on one bar of signal brought the new index.html but not the new
         scripts it points at; kept here over the last page, it left a
         phone with no signal holding a page whose scripts were in no
         cache: a blank, dead shell until the signal came back. The new
         page is kept by the new worker, which caches it with its scripts
         or not at all. */
      if (res && res.ok && res.type === 'basic') {
        var copy = res.clone(), probe = res.clone();
        probe.text().then(function (html) {
          var v = html.match(/[?&]v=(\d+)/);
          if (v && 'storehouse-v' + v[1] !== CACHE) return;
          return caches.open(CACHE).then(function (c) { return c.put(req, copy); });
        }).catch(function () { /* kept next time */ });
      }
      return res;
    });
    e.respondWith(new Promise(function (resolve) {
      var done = false;
      var give = function (r) { if (!done && r) { done = true; resolve(r); } };
      var none = function () {
        return new Response('Not available offline.', { status: 404, headers: { 'content-type': 'text/plain' } });
      };
      /* A network that neither answers nor fails — a captive portal, one bar
         in a basement — held a white screen until it gave up, twenty seconds
         on, and then showed its error page. After four seconds the last page
         that worked is shown instead; a deploy still lands, the next time
         the worker checks. */
      var slow = setTimeout(function () { kept().then(give); }, 4000);
      net.then(function (res) {
        clearTimeout(slow);
        // a server error is not the page either, when there is one to show
        if (res.status >= 500) return kept().then(function (hit) { give(hit || res); });
        give(res);
      }, function () {
        clearTimeout(slow);
        kept().then(function (hit) { give(hit || none()); });
      });
    }));
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
