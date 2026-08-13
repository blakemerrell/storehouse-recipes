/* The one-page handout at /share/.
 *
 * It is the only thing in this repository that goes out on paper into somebody
 * else's hands without either of us in the room, and it makes exactly one
 * checkable promise: every recipe on it can be made from the storehouse order
 * alone. Somebody reads that, takes the sheet home, and finds out at the stove
 * whether it was true.
 *
 * So the promise is tested rather than trusted. The four recipes are rendered
 * out of data/recipes.js at page load, and this reads them back and asks the
 * pantry the same question the app asks — not the ingp `x` flag, which is a
 * build-time input to the pantry table and is not the same answer.
 *
 * And it has to stay one page. Two pages is a stapler and a decision.
 */

module.exports = {
  name: 'The handout',
  async run(t) {
    const fs = require('fs'), path = require('path');
    const ctx = await t.browser.newContext({ viewport: { width: 1200, height: 1400 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => t.ok('no uncaught error on the page', false, e.message));

    const outside = [];
    p.on('request', (r) => {
      const u = new URL(r.url());
      if (u.hostname !== '127.0.0.1' && u.protocol !== 'data:') outside.push(r.url());
    });

    const res = await p.goto(t.base + 'share/');
    t.ok('is served', res.status() === 200, String(res.status()));
    await p.waitForTimeout(400);
    t.ok('and fetches nothing from another host', outside.length === 0, outside.join(' '));

    const sheet = await p.evaluate(() => ({
      recipes: [...document.querySelectorAll('.rec')].map((el) => ({
        no: (el.querySelector('.rec-no').textContent.match(/\d+/) || [])[0],
        name: el.querySelector('h2').textContent.trim(),
        ing: el.querySelector('.rec-ing').innerHTML.split(/<br\s*\/?>/i).map((x) => x.trim()),
        steps: [...el.querySelectorAll('.rec-steps li')].map((x) => x.textContent.trim()),
      })),
      qr: !!document.querySelector('#qr svg'),
      url: (document.querySelector('.foot-url') || {}).textContent || '',
    }));

    t.ok('it puts four recipes on the sheet', sheet.recipes.length === 4, sheet.recipes.length);
    t.ok('with the code on it', sheet.qr);

    /* The recipes are the book's, not retyped — a corrected recipe has to
       correct the handout, or the sheet becomes a second source of truth that
       nobody remembers to update. */
    const root = path.join(__dirname, '..');
    global.window = {};
    delete require.cache[require.resolve(path.join(root, 'data', 'recipes.js'))];
    require(path.join(root, 'data', 'recipes.js'));
    const R = global.window.RECIPES, P = global.window.PANTRY;
    const byId = {};
    R.forEach((r) => { byId[r.id] = r; });

    const wrong = sheet.recipes.filter((s) => {
      const r = byId[Number(s.no)];
      return !r || r.name !== s.name ||
        r.ing.join('|') !== s.ing.join('|') ||
        r.steps.join('|') !== s.steps.join('|');
    });
    t.ok('and every one of them is word for word the recipe in the book',
      wrong.length === 0, wrong.map((s) => s.no + ' ' + s.name).join(', '));

    /* The claim on the sheet, in the words the sheet uses: "nothing to buy,
       nothing to substitute". Asked of the pantry the way the app asks it —
       PANTRY[key].s, not ingp[].x, which says something else and would pass a
       recipe built on whey protein. */
    const needs = sheet.recipes.map((s) => {
      const r = byId[Number(s.no)] || { ingp: [] };
      const out = [];
      (r.ingp || []).forEach((i) => {
        if (i.k === 'free' || i.k === 'water') return;
        const d = P[i.k];
        if (d ? d.s : true) return;
        if (out.indexOf(d ? d.l : i.k) < 0) out.push(d ? d.l : i.k);
      });
      return { no: s.no, needs: out };
    }).filter((x) => x.needs.length);
    t.ok('nothing on it sends you to a shop',
      needs.length === 0, needs.map((x) => x.no + ' needs ' + x.needs.join(', ')).join('; '));

    /* Somebody types this by hand when the code will not scan. */
    t.ok('the printed address is the one the code encodes',
      sheet.url.trim() === 'blakemerrell.github.io/storehouse-recipes/welcome/', sheet.url);

    // one page, measured in print media rather than on screen
    await p.emulateMedia({ media: 'print' });
    await p.waitForTimeout(250);
    const inches = await p.evaluate(() => {
      const s = document.querySelector('.sheet');
      return { content: s.scrollHeight / 96, box: s.getBoundingClientRect().height / 96 };
    });
    t.ok('and it still fits on one sheet of letter paper',
      inches.content <= inches.box + 0.02,
      inches.content.toFixed(2) + 'in of content in ' + inches.box.toFixed(2) + 'in');

    /* Rendered ahead of time and committed, like the books, so somebody can be
       handed a file rather than a URL and a print dialog. */
    const pdf = path.join(root, 'print', 'Storehouse-Handout.pdf');
    t.ok('the rendered handout ships with the repository', fs.existsSync(pdf));

    await ctx.close();
  },
};
