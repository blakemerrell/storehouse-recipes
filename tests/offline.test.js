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
    t.ok('it opens with no network at all', alive.cards === 257, alive.cards);
    t.ok('in its own typeface rather than a fallback', alive.font);
    t.ok('and the week is where you left it', alive.planned === 1);

    // a cold tab, as if from the home screen
    const p2 = await ctx.newPage();
    await p2.goto(t.base + 'index.html');
    await p2.waitForTimeout(1200);
    t.ok('a fresh tab opens offline too',
      (await p2.evaluate(() => document.querySelectorAll('.card').length)) === 257);
    await p2.click('.tab[data-view="book"]');
    await p2.waitForTimeout(3500);
    t.ok('and the whole book still prints',
      (await p2.evaluate(() => document.querySelectorAll('.pg:not(.no-print)').length)) === 142);

    // the manifest is what makes it installable rather than a bookmark
    const mf = await p.evaluate(() => fetch('manifest.webmanifest').then((r) => r.json()).catch(() => null));
    t.ok('the manifest is served and complete',
      mf && mf.name && mf.start_url && mf.display === 'standalone' && mf.icons.length >= 2,
      mf ? mf.name : 'not served');

    await ctx.setOffline(false);
    await ctx.close();
  },
};
