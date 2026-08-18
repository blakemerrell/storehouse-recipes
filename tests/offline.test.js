/* Opening the app with no signal at all — the storehouse-basement case. */

module.exports = {
  name: 'Offline',
  async run(t) {
    const ctx = await t.browser.newContext({ viewport: { width: 900, height: 800 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => t.ok('no uncaught error on the page', false, e.message));

    // nothing may be fetched from anywhere but here
    const outside = [];
    p.on('request', (r) => {
      const u = new URL(r.url());
      if (u.hostname !== '127.0.0.1' && u.protocol !== 'data:') outside.push(r.url());
    });

    await p.goto(t.base + 'index.html');
    await p.evaluate(() => localStorage.clear());
    await p.reload();
    await p.waitForTimeout(1200);
    t.ok('no font, script or style comes from another host', outside.length === 0, outside.join(' '));

    t.ok('a service worker registers',
      await p.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!r)));
    await p.evaluate(() => navigator.serviceWorker.ready);
    await p.waitForTimeout(1500);

    const cached = await p.evaluate(async () => {
      const names = await caches.keys();
      const c = await caches.open(names[0]);
      return (await c.keys()).map((r) => new URL(r.url).pathname);
    });
    t.ok('the whole shell is cached', cached.length >= 12, cached.length + ' entries');

    /* Every file the page pulls in must carry a version, and the worker must
       ask for the same one. Both halves matter, and neither was true.

       data/recipes.js had no ?v= at all. Its URL therefore never changed, and
       GitHub Pages serves it with max-age=600 — so a new worker installing a
       new cache could fetch it through the browser's HTTP cache, get the copy
       from before the deploy, and then serve that copy cache-first for the
       life of the cache. Add six recipes, push, refresh: 266 in the header and
       257 on the page. The versioned files were never exposed to it, because
       ?v=30 is a URL the HTTP cache has never seen.

       Compared with the query attached, because the old check compared
       pathnames — which is precisely the part of a URL that was fine. */
    const versioning = await p.evaluate(async () => {
      const own = (u) => new URL(u, location.href).origin === location.origin;
      const assets = [
        ...[...document.querySelectorAll('script[src]')].map((e) => e.src),
        ...[...document.querySelectorAll('link[rel=stylesheet]')].map((e) => e.href),
      ].filter(own).map((u) => new URL(u).pathname + new URL(u).search);

      const sw = await fetch('sw.js').then((r) => r.text());
      const shell = [...sw.matchAll(/'\.(\/[^']+)'/g)].map((m) => m[1]);

      return {
        unversioned: assets.filter((a) => !/\?v=\d+/.test(a)),
        missing: assets.filter((a) => !shell.includes(a)),
        /* The cache name and the asset version, which have to move together.
           Nothing held them together before and they had already drifted a
           version apart — which is precisely why nothing could check them. */
        cacheName: (sw.match(/var CACHE = '([^']+)'/) || [])[1] || '',
        assetV: [...new Set([...sw.matchAll(/\?v=(\d+)/g)].map((m) => m[1]))],
      };
    });
    t.ok('every script and stylesheet the page loads carries a version',
      versioning.unversioned.length === 0, versioning.unversioned.join(' '));
    t.ok('and the worker caches that exact version, query and all',
      versioning.missing.length === 0, versioning.missing.join(' '));

    /* The cache is named for the build it holds.
     *
     * activate deletes every cache but the current one, which is the whole
     * mechanism for getting a phone off an old build — and it only fires when
     * the name has changed. Ship new scripts under the old cache name and a
     * phone that already has the app keeps serving the old ones, forever, with
     * no error and nothing to notice. Deliberately breaking that was the one
     * service-worker change nothing in this suite caught, because the two
     * numbers were free to drift and had already drifted by one.
     * One number now, in both places. */
    t.ok('the assets carry a single version between them',
      versioning.assetV.length === 1, versioning.assetV.join(', ') || 'none found');
    t.ok('and the cache is named for it, so a new build cannot reuse the old cache',
      versioning.cacheName === 'storehouse-v' + versioning.assetV[0],
      versioning.cacheName + ' vs assets at v' + versioning.assetV.join('/'));

    /* And the version moved when the files under it did.
     *
     * The two checks above hold the version together with itself. Neither one
     * can see the failure that actually happened: a *generated file's contents*
     * changing while the version stays put. The URL is what the cache is keyed
     * by, so if data/art.js grows four engravings at the same ?v=, every phone
     * with the app installed goes on serving the twelve-entry copy — not for
     * ten minutes, indefinitely, because there is nothing to invalidate.
     *
     * That produced a 180-page book on screen underneath a button offering a
     * 184-page file: the four openers the manifest did not know about. Two
     * numbers disagreeing on one screen with nothing to explain why, and no
     * amount of reloading fixes it, because the reload asks for the same URL.
     *
     * data/stamp.json records a hash of every file the version covers.
     * Rewriting one without bumping is now a failure here rather than a
     * discovery in a basement. Run `npm run build` or `npm run print` — both
     * bump and re-stamp — or `node tools/bump-version.js` on its own. */
    const bv = require('../tools/bump-version.js');
    const stamp = (() => {
      try { return JSON.parse(require('fs').readFileSync(bv.STAMP, 'utf8')); }
      catch (e) { return null; }
    })();
    const now = bv.hashes();
    const moved = stamp ? bv.COVERED.filter((f) => now[f] && stamp.files[f] !== now[f]) : [];
    t.ok('the version covers the files as they are now, not as they were',
      !!stamp && stamp.v === Number(versioning.assetV[0]) && moved.length === 0,
      !stamp ? 'no data/stamp.json — run node tools/bump-version.js --stamp'
        : moved.length ? 'changed since ?v=' + stamp.v + ': ' + moved.join(', ') +
            ' — run node tools/bump-version.js'
        : 'stamp says v' + stamp.v + ', assets say v' + versioning.assetV[0]);
    /* Every engraving the book draws, cached with it.
     *
     * data/art.js is generated by tools/prep-art.js; the paths in sw.js were
     * typed alongside it. Add a section illustration and the manifest knows
     * about it while the worker does not — so the picture is there online and
     * gone in a storehouse basement, and gone quietly, because EXTRAS are
     * allowed to fail by design so one missing image cannot take an install
     * down. prep-art.js writes both now; this is what says it did. */
    const artCached = await p.evaluate(async () => {
      const names = await caches.keys();
      const c = await caches.open(names[0]);
      const have = (await c.keys()).map((r) => new URL(r.url).pathname);
      const want = Object.values(window.SECTION_ART || {});
      return want.filter((a) => !have.some((h) => h.indexOf(a) >= 0));
    });
    t.ok('every section engraving is cached for a phone with no signal',
      artCached.length === 0, artCached.join(', '));

    t.ok('recipes, nutrition and typefaces included',
      cached.some((u) => /recipes\.js/.test(u)) &&
      cached.some((u) => /nutrition\.js/.test(u)) &&
      cached.filter((u) => /woff2/.test(u)).length === 3,
      cached.filter((u) => /recipes|nutrition|woff2/.test(u)).join(' '));

    await p.evaluate(() => window.Store.addToDay(12, 'wed'));
    await p.waitForTimeout(300);

    // the network goes away
    await ctx.setOffline(true);
    await p.goto(t.base + 'index.html');
    await p.waitForTimeout(1500);
    const alive = await p.evaluate(() => ({
      cards: document.querySelectorAll('.card').length,
      font: document.fonts.check('700 20px "Source Serif 4"'),
      planned: window.Store.day('wed').length,
      total: window.RECIPES.length,
    }));
    t.ok('it opens with no network at all', alive.cards === alive.total, alive.cards + ' of ' + alive.total);
    t.ok('in its own typeface rather than a fallback', alive.font);
    t.ok('and the week is where you left it', alive.planned === 1);

    // a cold tab, as if from the home screen
    const p2 = await ctx.newPage();
    await p2.goto(t.base + 'index.html');
    await p2.waitForTimeout(1200);
    t.ok('a fresh tab opens offline too',
      await p2.evaluate(() => document.querySelectorAll('.card').length === window.RECIPES.length),
      await p2.evaluate(() => document.querySelectorAll('.card').length + ' of ' + window.RECIPES.length));
    await p2.click('.tab[data-view="book"]');
    await p2.waitForTimeout(3500);
    t.ok('and the whole book still prints',
      (await p2.evaluate(() => document.querySelectorAll('.pg:not(.no-print)').length)) > 150);

    /* A phone that looks unchanged after a deploy is the hardest thing here to
       tell apart from a deploy that has not landed. The Sharing sheet carries
       the build, read off the ?v= index.html actually loaded — so it cannot say
       one thing while the phone is running another. Checked offline, where the
       page came out of the cache, which is exactly when the question is asked. */
    await p.click('#syncBtn');
    await p.waitForTimeout(300);
    const stamped = await p.evaluate(() => {
      const el = document.querySelector('.sync-build');
      const src = document.querySelector('script[src*="app.js"]').getAttribute('src');
      return { shown: el && el.textContent.trim(), src };
    });
    t.ok('the sheet names the build it is actually running',
      /^Build \d+$/.test(stamped.shown || '') &&
      stamped.src.indexOf('v=' + stamped.shown.split(' ')[1]) > 0,
      JSON.stringify(stamped));
    await p.click('.sheet-x');
    await p.waitForTimeout(200);

    // the manifest is what makes it installable rather than a bookmark
    const mf = await p.evaluate(() => fetch('manifest.webmanifest').then((r) => r.json()).catch(() => null));
    t.ok('the manifest is served and complete',
      mf && mf.name && mf.start_url && mf.display === 'standalone' && mf.icons.length >= 2,
      mf ? mf.name : 'not served');

    await ctx.setOffline(false);
    await ctx.close();
  },
};
