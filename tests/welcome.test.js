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

    /* Twelve sections have art, so twelve plates. A number that drifts means the
       page and the book have stopped agreeing about how many there are. */
    const plates = await p.evaluate(() => document.querySelectorAll('.plate img').length);
    t.ok('one plate per illustrated section', plates === 12, plates + ' plates');

    /* The art the page shows should be the art the book prepared, not a
       leftover file that happens to still be sitting in the folder. */
    const mismatched = await p.evaluate(async () => {
      const manifest = await fetch('../data/art.js').then((r) => r.text());
      const known = [...manifest.matchAll(/"(art\/[^"]+\.png)"/g)].map((m) => m[1]);
      return [...document.querySelectorAll('.plate img')]
        .map((i) => decodeURIComponent(new URL(i.src).pathname.replace(/^.*\/(art\/)/, '$1')))
        .filter((src) => !known.includes(src));
    });
    t.ok('and is the same art the book uses', mismatched.length === 0, mismatched.join(' '));

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
        /* The paying links only. The ghost button beside "Give what you
           like" says "Just open the app" and is rightly a relative link, so
           scooping up every anchor in the section fails a block that is fine. */
        give: block('.give', 'a.give-card, .give ~ .cta a.btn-solid'),
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
      /156 pages/.test(quoted) && /52 pages/.test(quoted) && /108/.test(quoted),
      (quoted.match(/\d+ pages?/g) || []).join(' | '));

    // a phone must not have to scroll sideways to read it
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(400);
    t.ok('and nothing runs off the side of a phone',
      await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

    await ctx.close();
  },
};
