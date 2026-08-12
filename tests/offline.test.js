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
      };
    });
    t.ok('every script and stylesheet the page loads carries a version',
      versioning.unversioned.length === 0, versioning.unversioned.join(' '));
    t.ok('and the worker caches that exact version, query and all',
      versioning.missing.length === 0, versioning.missing.join(' '));
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
    }));
    t.ok('it opens with no network at all', alive.cards === 266, alive.cards);
    t.ok('in its own typeface rather than a fallback', alive.font);
    t.ok('and the week is where you left it', alive.planned === 1);

    // a cold tab, as if from the home screen
    const p2 = await ctx.newPage();
    await p2.goto(t.base + 'index.html');
    await p2.waitForTimeout(1200);
    t.ok('a fresh tab opens offline too',
      (await p2.evaluate(() => document.querySelectorAll('.card').length)) === 266);
    await p2.click('.tab[data-view="book"]');
    await p2.waitForTimeout(3500);
    t.ok('and the whole book still prints',
      (await p2.evaluate(() => document.querySelectorAll('.pg:not(.no-print)').length)) === 164);

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
