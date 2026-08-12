/* The landing page at /welcome/.
 *
 * It exists to be handed to someone who has not seen the app before, which
 * means it is the one page whose breaking nobody notices — you do not visit
 * your own front door. So the things worth asserting are the ones that rot
 * quietly.
 *
 * Chiefly the engravings. Their filenames are load-bearing in two places now:
 * data/art.js, which tools/prep-art.js regenerates, and the src attributes
 * here, which nothing regenerates. Rename a section and the book follows along
 * while this page keeps asking for a file that moved. A missing image still
 * lays out at exactly the right size, so the page looks fine and is not.
 */

module.exports = {
  name: 'The landing page',
  async run(t) {
    const ctx = await t.browser.newContext({ viewport: { width: 1200, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => t.ok('no uncaught error on the page', false, e.message));

    // same promise the app makes: nothing comes from anywhere else
    const outside = [];
    p.on('request', (r) => {
      const u = new URL(r.url());
      if (u.hostname !== '127.0.0.1' && u.protocol !== 'data:') outside.push(r.url());
    });

    const res = await p.goto(t.base + 'welcome/');
    t.ok('is served', res.status() === 200, String(res.status()));
    await p.waitForTimeout(500);

    t.ok('and fetches nothing from another host', outside.length === 0, outside.join(' '));

    const broken = await p.evaluate(() =>
      [...document.images].filter((i) => !i.naturalWidth).map((i) => new URL(i.src).pathname));
    t.ok('every engraving on it actually loads', broken.length === 0, broken.join(' '));

    /* Four frames of the book and four of the app, cross-fading. Both stacks
       are real renders — pages out of the PDF and the app driven at phone size
       — so what is asserted is that all eight are there and none of them is a
       hole. A missing frame in a stack of four that fades is close to invisible
       to the eye: it just looks like a longer pause. */
    const demo = await p.evaluate(() => ({
      book: document.querySelectorAll('.demo-book img').length,
      app: document.querySelectorAll('.demo-phone img').length,
      broken: [...document.querySelectorAll('.showcase img')]
        .filter((i) => !i.naturalWidth).map((i) => new URL(i.src).pathname),
      /* One description per stack. Eight would make a screen reader read out
         four pictures of the same book. */
      described: [...document.querySelectorAll('.showcase img')].filter((i) => i.alt).length,
    }));
    t.ok('the demo shows four frames of the book and four of the app',
      demo.book === 4 && demo.app === 4, JSON.stringify(demo));
    t.ok('and every one of them loaded', demo.broken.length === 0, demo.broken.join(' '));
    /* One for the book, one for the app. Eight would make a screen reader
       read out four pictures of the same book. */
    t.ok('with one description per stack rather than eight', demo.described === 2, demo.described);

    /* The frames are photographs of a build, and a photograph does not complain
       when the thing it photographed moves on. The cover in the first frame
       carries the recipe count; the page went out advertising 263 of them after
       three were added, and nothing about it looked wrong. tools/build-demo.js
       stamps what it photographed, and this is where that stamp is checked. */
    const fs = require('fs'), path = require('path'), crypto = require('crypto');
    const root = path.join(__dirname, '..');
    const stamp = JSON.parse(fs.readFileSync(path.join(root, 'welcome', 'demo', 'stamp.json'), 'utf8'));
    global.window = {};
    delete require.cache[require.resolve(path.join(root, 'data', 'recipes.js'))];
    require(path.join(root, 'data', 'recipes.js'));
    const count = global.window.RECIPES.length;
    const pdfHash = crypto.createHash('sha1')
      .update(fs.readFileSync(path.join(root, 'print', 'Hive-and-Hearth-Recipes.pdf')))
      .digest('hex').slice(0, 12);
    t.ok('the demo frames were taken of the current build',
      stamp.recipes === count && stamp.pdf === pdfHash,
      stamp.recipes + ' recipes / ' + stamp.pdf + ' vs ' + count + ' / ' + pdfHash +
      ' — run node tools/build-demo.js');

    /* Every way in. Somebody who reads to the end and wants to pay should not
       have to scroll back up to find out how, and somebody who decides in the
       first screen should not have to read to the end.

       'Near the top' rather than 'in the hero': the hero is two buttons now
       and neither of them takes money, which is the right hero. The paying
       link moved one block down, to the line under the collage — still above
       "What it does", which is what the assertion actually cares about. */
    const ways = await p.evaluate(() => {
      const pay = [...document.querySelectorAll('a[href*="buy.stripe.com"]')];
      const what = document.getElementById('what');
      const before = (a) => what &&
        (a.compareDocumentPosition(what) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      return {
        total: pay.length,
        top: pay.some(before),
        demo: !!document.querySelector('.demo-cap a[href*="stripe"]'),
        footer: pay.some((a) => a.closest('footer')),
      };
    });
    t.ok('there is a way to pay near the top, by the demo and in the footer',
      ways.top && ways.demo && ways.footer, JSON.stringify(ways));

    /* The two phone screens in the dark panel are hand-set HTML, not
       screenshots — a screenshot of two phones side by side would be a
       screenshot of a page that does not exist. That makes them the one thing
       on this page that can quietly stop being true, so what is written on
       them is checked against the recipes themselves: the title, the macros
       and the ingredients of No. 001, and the name of No. 002 on the Tuesday
       of the week beside it. Rename a recipe and this fails. */
    const mock = await p.evaluate(() => {
      const txt = (s) => (document.querySelector(s) || {}).textContent || '';
      return {
        title: txt('.mk-h').trim(),
        macros: [...document.querySelectorAll('.mk-macros span')].map((e) => e.textContent.trim()),
        ing: (document.querySelector('.mk-ing') || {}).innerHTML
          .split(/<br\s*\/?>/i).map((x) => x.trim()),
        steps: [...document.querySelectorAll('.mk-steps li')].map((e) => e.textContent.trim()),
        meals: [...document.querySelectorAll('.mk-meal')].map((e) => e.textContent.trim()),
      };
    });
    global.window = {};
    delete require.cache[require.resolve(require('path').join(__dirname, '..', 'data', 'recipes.js'))];
    require(require('path').join(__dirname, '..', 'data', 'recipes.js'));
    const R = global.window.RECIPES;
    const [one, two, three] = [1, 2, 3].map((id) => R.find((r) => r.id === id));
    t.ok('the phone screens still say what the recipes say',
      mock.title === one.name &&
      mock.macros.join('|') === one.macro.kcal + ' kcal|' + one.macro.p + 'g protein' &&
      mock.ing.join('|') === one.ing.join('|') &&
      mock.steps.join('|') === one.steps.join('|') &&
      mock.meals.join('|') === [one, two, three].map((r) => r.name).join('|'),
      JSON.stringify(mock) + ' vs ' + JSON.stringify({
        name: one.name, kcal: one.macro.kcal, p: one.macro.p,
        ing: one.ing, steps: one.steps, week: [one, two, three].map((r) => r.name) }));

    /* Every link on the page, checked rather than assumed — the PDFs in
       particular are named after a volume that was renamed once already. */
    const dead = await p.evaluate(async () => {
      const urls = [...new Set([...document.querySelectorAll('a[href]')]
        .map((a) => a.href).filter((h) => h.startsWith('http://127.0.0.1')))];
      const out = [];
      for (const u of urls) {
        const r = await fetch(u, { method: 'HEAD' }).catch(() => null);
        if (!r || !r.ok) out.push(new URL(u).pathname + ' → ' + (r ? r.status : 'failed'));
      }
      return out;
    });
    t.ok('no link on it is dead', dead.length === 0, dead.join(', '));

    /* The donate block is allowed to be absent — it ships switched off until
       there is somewhere for the money to go. What it is not allowed to be is
       present and unwired. A dead link anywhere on this page is a nuisance; a
       dead link on the one button that costs somebody money is the kind of
       thing you only find out about from the person who tried. */
    const money = await p.evaluate(() => {
      const block = (sel, linkSel) => {
        const root = document.querySelector(sel);
        return { present: !!root,
          links: root ? [...document.querySelectorAll(linkSel)].map((a) => a.getAttribute('href')) : [] };
      };
      return {
        /* Rooted on the section, not on the buttons — a selector that names
           the very thing it is checking for reports "off" rather than
           "broken" the moment that thing is renamed, and this guard exists
           precisely so a dead donate link cannot ship quietly. Only the
           paying links are collected: the section also carries a relative
           link to the app, and scooping up every anchor would fail a block
           that is perfectly fine. */
        give: block('#give', 'a.give-btn'),
        /* .post-order, not .post — the same card style is reused for the
           free one-book download, whose href is a local PDF and rightly is
           not a payment URL. Only the one that takes money is guarded. */
        /* The paying button, wherever it sits. It moved when the print
           section was rebuilt around the one-book edition. */
        post: block('.post-order-btn', 'a.post-order-btn'),
      };
    });
    const wired = (b) => !b.present ||
      (b.links.length > 0 && b.links.every((h) => /^https?:\/\//.test(h) && !/_LINK_HERE/.test(h)));
    t.ok('the donate block is either off or actually wired up',
      wired(money.give), money.give.present ? money.give.links.join(' ') : 'off');
    t.ok('and so is the one that posts you a printed set',
      wired(money.post), money.post.present ? money.post.links.join(' ') : 'off');

    /* The page quotes page and sheet counts at people deciding whether to walk
       into a print shop. Those came from the render and go stale silently. */
    const quoted = await p.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));
    /* Every page count the page quotes at somebody deciding whether to walk
       into a copy shop. They came out of the render and go stale silently, and
       the sheet counts went with the volume cards when the section was rebuilt
       around the one book. */
    t.ok('the page counts it advertises match the books',
      /160 pages/.test(quoted) && /52 pages/.test(quoted) && /112/.test(quoted),
      (quoted.match(/\d+ pages?/g) || []).join(' | '));

    // a phone must not have to scroll sideways to read it
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(400);
    t.ok('and nothing runs off the side of a phone',
      await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

    await ctx.close();
  },
};
