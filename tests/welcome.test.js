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
       have to scroll back up to find out how.

       There is deliberately none of this above "What it does" any more. There
       was — the line under the collage ended "or buy a bound copy, $50" — and
       it quoted a price in the first screenful, under a collage, before the
       page had said what the thing was. What is asserted now is that the three
       places a reader arrives at *after* the explanation all carry one: the
       print item that explains the book, the story, and the footer. Somebody who decides early
       scrolls a screen; somebody who has not decided is not asked. */
    const ways = await p.evaluate(() => {
      const pay = [...document.querySelectorAll('a[href*="buy.stripe.com"]')];
      const what = document.getElementById('what');
      const before = (a) => what &&
        (a.compareDocumentPosition(what) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      return {
        total: pay.length,
        early: pay.filter(before).map((a) => a.textContent.trim()),
        /* The paper offer used to be a section of its own headed "Prefer
           paper?", asking two screens later the same question the print item
           in "What it does" already answers — the reader deciding twice about
           one thing. Merged into that item, buttons and all, so this looks for
           it where it now lives rather than where it was. */
        paper: !!document.querySelector('#what a[href*="stripe"]'),
        story: !!document.querySelector('#give a[href*="stripe"]'),
        footer: pay.some((a) => a.closest('footer')),
      };
    });
    t.ok('there is a way to pay where the book is explained, in the story and in the footer',
      ways.paper && ways.story && ways.footer, JSON.stringify(ways));
    t.ok('and nothing quotes a price before the page has said what it is',
      ways.early.length === 0, ways.early.join(' | '));

    /* The two phones in the dark panel walk through setting up sharing — Share
       is tapped, a code appears, the same code is typed on the second phone,
       and both land on one week. It is hand-set HTML, not a screen recording,
       which makes it the one thing on this page that can quietly stop being
       true. Three things are checked, and they are the three that would make
       the walkthrough a lie rather than merely dated.

       First, the week both phones end on is the book's week: rename No. 001
       and this fails. Second, both phones show the *same* three meals — that
       identity is the whole claim the panel is making, and a stray edit to one
       column would break it in a way no screenshot review would catch. Third,
       the code typed on the second phone is the code the first one gave. */
    const mock = await p.evaluate(() => {
      const txt = (s) => ((document.querySelector(s) || {}).textContent || '').trim();
      return {
        meals: [...document.querySelectorAll('.mk-meal')].map((e) => e.textContent.trim()),
        shown: txt('.scr-code'),
        typed: txt('.typed'),
        opened: txt('.sh-t'),
        day: txt('.scr-a4 .daybar b.dw'),
        days: [...document.querySelectorAll('.scr-a4 .daybar b')].map((e) => e.textContent.trim()),
      };
    });
    global.window = {};
    delete require.cache[require.resolve(require('path').join(__dirname, '..', 'data', 'recipes.js'))];
    require(require('path').join(__dirname, '..', 'data', 'recipes.js'));
    const R = global.window.RECIPES;
    const week = [1, 2, 3].map((id) => R.find((r) => r.id === id).name);
    const mine = mock.meals.slice(0, 3), theirs = mock.meals.slice(3);
    t.ok('the week on the phones is still the week in the book',
      mine.join('|') === week.join('|'), mine.join(' / ') + ' vs ' + week.join(' / '));
    t.ok('and both phones end the walkthrough on the same three meals',
      mock.meals.length === 6 && theirs.join('|') === mine.join('|'),
      mock.meals.length + ': ' + theirs.join(' / '));
    t.ok('the code typed on the second phone is the one the first phone gave',
      mock.shown && mock.shown === mock.typed, mock.shown + ' vs ' + mock.typed);

    /* The last two beats claim cause and effect: the recipe opened on the first
       phone is given a day, and that day turns up in the week on the second. If
       the recipe on the sheet and the recipe on that day ever stop being the
       same one, the panel is showing two unrelated things happening at once and
       calling it sync — which is the one lie this animation could tell. */
    const dayIx = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[mock.day];
    t.ok('the recipe given a day is the one that lands on that day',
      mock.opened && mock.opened === mock.meals[dayIx],
      mock.day + ': ' + mock.opened + ' vs ' + mock.meals[dayIx]);
    /* Seven, because a week with six days in it is the kind of thing that
       survives every review except this one. */
    t.ok('and the day it is given is one of seven',
      mock.days.length === 7 && dayIx !== undefined, mock.days.join(' '));

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

    /* Every amount is its own Stripe link, because the amount is baked into
       the link and not passed in the URL. So a button can say $8 and open a box
       pre-filled with $40, which is what one did — three of them pointed at the
       same link for a fortnight — and nothing about the page looks wrong when
       it happens. Any two links naming two different amounts must not share an
       href.

       Every paying link on the page, not just the donate ones: the suggested
       amounts have gone and $50 is the only figure printed on a button now, but
       the trap is in how Stripe links work rather than in which button carries
       them, so the guard should still be here the day another number is. */
    const amounts = await p.evaluate(() =>
      [...document.querySelectorAll('a[href*="buy.stripe.com"]')]
        .map((a) => ({ amt: (a.textContent.match(/\$\d+/) || [null])[0], href: a.getAttribute('href') }))
        .filter((x) => x.amt));
    const clash = amounts.filter((x, i) =>
      amounts.some((y, j) => j !== i && y.amt !== x.amt && y.href === x.href));
    /* The price of the book is typed in five places across two files and lives
       for real in Stripe, where nothing here can see it. Nothing on the page
       looks wrong when one of them is left behind — it just quietly advertises
       two prices for one object, and the buyer finds out at checkout. Every
       figure the site prints has to be the same figure. */
    const priced = await p.evaluate(() =>
      (document.body.textContent.match(/\$\d+/g) || []));
    const app = require('fs')
      .readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8')
      .match(/\$\d+/g) || [];
    const allPrices = [...new Set(priced.concat(app))];
    t.ok('the site quotes one price for the book, not two',
      allPrices.length === 1, allPrices.join(' and '));

    t.ok('each suggested amount has its own payment link',
      amounts.length > 0 && clash.length === 0,
      amounts.map((x) => x.amt + ' → ' + String(x.href).split('/').pop()).join(', '));
    t.ok('and so is the one that posts you a printed set',
      wired(money.post), money.post.present ? money.post.links.join(' ') : 'off');

    /* The page quotes page and sheet counts at people deciding whether to walk
       into a print shop. Those came from the render and go stale silently. */
    const quoted = await p.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));
    /* Every page count the page quotes at somebody deciding whether to walk
       into a copy shop. They came out of the render and go stale silently, and
       the sheet counts went with the volume cards when the section was rebuilt
       around the one book. */
    /* Against the files themselves, not against three numbers written in here.
       As literals — 160, 52, 116 — they went stale the moment six recipes moved
       from one volume to the other, and the assertion failed for having an old
       copy of the answer rather than because the page was wrong. */
    /* Every number on the page, against the thing it counts.
     *
     * The page counts were marked and stamped; the recipe counts were not, and
     * five of them sat at 271 while the collection held 277 — the hero line, a
     * caption, and three meta tags nobody can see. The og image was worse
     * still at 266, and a number baked into a PNG is invisible to every test
     * that reads markup, so tools/build-og.js counts rather than remembers.
     *
     * Read off the rendered page, so it is checked the way a reader meets it. */
    const counts = await p.evaluate(() => {
      const out = { marked: [], meta: [] };
      document.querySelectorAll('[data-n]').forEach((el) =>
        out.marked.push({ k: el.dataset.n, v: Number(el.textContent) }));
      ['description', 'og:description', 'og:image:alt'].forEach((n) => {
        const el = document.querySelector('meta[name="' + n + '"], meta[property="' + n + '"]');
        if (el) {
          const m = (el.content || '').match(/(\d+) recipes/);
          out.meta.push({ n: n, v: m ? Number(m[1]) : null });
        }
      });
      return out;
    });
    const truth = await (async () => {
      const app = await p.context().newPage();
      await app.goto(t.base + 'index.html');
      await app.waitForTimeout(600);
      const r = await app.evaluate(() => ({
        all: window.RECIPES.length,
        b1: window.RECIPES.filter((x) => x.book === 1).length,
        b2: window.RECIPES.filter((x) => x.book === 2).length,
      }));
      await app.close();
      return r;
    })();
    const wrongRecipes = counts.marked
      .filter((x) => /-recipes$/.test(x.k))
      .filter((x) => x.v !== truth[x.k.replace('-recipes', '') === 'all' ? 'all' : x.k.replace('-recipes', '')]);
    t.ok('every recipe count on the page is the number of recipes there are',
      counts.marked.length >= 6 && wrongRecipes.length === 0,
      JSON.stringify(wrongRecipes) + ' of ' + JSON.stringify(counts.marked));
    t.ok('and so does the text that only a share preview will show',
      counts.meta.length === 3 && counts.meta.every((m) => m.v === truth.all),
      JSON.stringify(counts.meta) + ' vs ' + truth.all);

    const real = (() => {
      let lib = null;
      for (const m of ['pdf-lib', '/tmp/node_modules/pdf-lib']) {
        try { lib = require(m); break; } catch (e) { /* try the next */ }
      }
      return lib;
    })();
    if (!real) {
      t.ok('the page counts it advertises match the books', false, 'pdf-lib not available');
    } else {
      const fs2 = require('fs'), path2 = require('path');
      const dir = path2.join(__dirname, '..', 'print');
      const counts = {};
      for (const f of ['Hive-and-Hearth-Recipes.pdf', 'Run-and-Not-Be-Weary.pdf', 'Around-the-Table.pdf']) {
        const doc = await real.PDFDocument.load(fs2.readFileSync(path2.join(dir, f)));
        counts[f] = doc.getPageCount();
      }
      const missing = Object.keys(counts).filter((f) =>
        quoted.indexOf(String(counts[f])) < 0);
      t.ok('the page counts it advertises match the books',
        missing.length === 0,
        Object.keys(counts).map((f) => f + ' is ' + counts[f]).join(' | '));
    }

    // a phone must not have to scroll sideways to read it
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(400);
    t.ok('and nothing runs off the side of a phone',
      await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

    await ctx.close();
  },
};
