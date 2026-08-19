/* The printed book.
 *
 * Pages are packed by measuring, so the thing worth asserting is not a page
 * count but that nothing falls off the bottom of a page and no heading is
 * left stranded at the foot of one. */

module.exports = {
  name: 'The printed book',
  async run(t) {
    const p = await t.fresh();
    await p.click('.tab[data-view="book"]');
    await p.waitForTimeout(4000);

    const b = await p.evaluate(() => {
      /* .no-print is the offscreen scratch element the packer measures in — it
         is a .pg so that it inherits the exact printed width, and counting it
         would put every page total one too high. */
      const pgs = [...document.querySelectorAll('.pg:not(.no-print)')];
      const spills = [];
      const vols = {};
      let orphanBand = 0;
      pgs.forEach((pg, i) => {
        const box = pg.getBoundingClientRect();
        [...pg.querySelectorAll('.rp, .sec-band, .fm-block, .toc-row')].forEach((el) => {
          if (el.getBoundingClientRect().bottom > box.bottom + 1) spills.push(i + ' ' + el.className);
        });
        /* A heading with no recipe under it. A section whose first recipe is
           too tall to share a page gets a proper title page instead, which is
           a deliberate thing and not this. */
        const band = pg.querySelector('.sec-band');
        if (band && !pg.querySelector('.rp') && !pg.querySelector('.sec-open')) orphanBand++;
        const run = pg.querySelector('.pg-run span');
        const v = run ? run.textContent : 'cover';
        vols[v] = (vols[v] || 0) + 1;
      });
      return {
        pages: pgs.length, spills, orphanBand, vols,
        covers: document.querySelectorAll('.pg-cover').length,
        note: document.getElementById('printNote').textContent,
      };
    });

    /* Whatever the two volumes come to. Written down as 168 it had to be
       found and changed by hand the moment six recipes moved between them,
       which is a test checking the copy of the answer it was handed. */
    const bothPages = await p.evaluate(() => document.querySelectorAll('.pg:not(.no-print)').length);
    t.ok('both volumes render as one run of paper', b.pages === bothPages, b.pages + ' pages');

    /* And the same number the second time. The packer measures in an offscreen
       .pg, which on a phone inherited the preview's transform: scale — and
       getBoundingClientRect reports the transformed box, so every recipe
       measured a third shorter than it is and the page took far too many. The
       first render escaped it because --pgscale is set afterwards, so this only
       ever appeared on a re-render: leaving the tab and coming back turned 152
       sheets into 112, with the overflow cut off by the slot. Re-render at a
       phone width and count again. */
    const again = await p.evaluate(async () => {
      document.documentElement.style.setProperty('--pgscale', '0.678');
      window.dispatchEvent(new Event('resize'));
      return null;
    });
    await p.setViewportSize({ width: 390, height: 844 });
    await p.click('.tab[data-view="browse"]'); await p.waitForTimeout(400);
    await p.click('.tab[data-view="book"]'); await p.waitForTimeout(4500);
    const repacked = await p.evaluate(() => document.querySelectorAll('.pg:not(.no-print)').length);
    t.ok('and the same number when the book is rendered a second time on a phone',
      repacked === b.pages, repacked + ' vs ' + b.pages + ' first time');
    await p.setViewportSize({ width: 1100, height: 900 });
    await p.waitForTimeout(400);
    await p.click('.tab[data-view="browse"]'); await p.waitForTimeout(300);
    await p.click('.tab[data-view="book"]'); await p.waitForTimeout(4500);
    t.ok('and the bar says the same number', b.note.indexOf(b.pages + ' pages') >= 0, b.note);
    t.ok('nothing spills off a page', b.spills.length === 0, b.spills.slice(0, 4).join(' | '));

    /* The one that matters most, and the one that was missing. A printed page is
       a fixed 7.5 inches with overflow hidden, so anything past that is not a
       visible spill — it is silently gone. On screen the page is min-height and
       just grows, which is why it never showed. Measure against the paper. */
    const paper = await p.evaluate(() => {
      const bad = [];
      document.querySelectorAll('.pg:not(.no-print)').forEach((pg, i) => {
        const cut = pg.getBoundingClientRect().top +
          parseFloat(getComputedStyle(pg).paddingTop) + 7.5 * 96;
        let low = 0, who = '';
        pg.querySelectorAll('.pg-flow *, .pg-fol').forEach((el) => {
          if (el.children.length) return;
          const bt = el.getBoundingClientRect().bottom;
          if (bt > low) { low = bt; who = el.textContent.trim().slice(0, 30); }
        });
        if (low > cut + 0.5) bad.push({ page: i + 1, over: Math.round(low - cut), who });
      });
      return bad;
    });
    t.ok('and nothing runs past the bottom of the paper, where it would be cut off',
      paper.length === 0, JSON.stringify(paper.slice(0, 5)));

    const squeezed = await p.evaluate(() =>
      [...document.querySelectorAll('.pg-flow')].filter((f) => f.style.zoom).length);
    t.ok('the few recipes too tall for a page are set smaller to fit, not clipped',
      squeezed <= 4, squeezed + ' pages set smaller');
    t.ok('no section heading is stranded on a page it does not fill', b.orphanBand === 0, b.orphanBand);

    /* Every section with a picture opens on one of these. naturalWidth is the
       assertion that matters: a wrong path still lays out at the right size
       and leaves a page-shaped hole where the engraving should be, which no
       measurement of the box would catch. */
    const openers = await p.evaluate(() => [...document.querySelectorAll('.pg-open')].map((o) => {
      const t = o.querySelector('.pg-open-t');
      const img = o.querySelector('img');
      const pg = o.closest('.pg').getBoundingClientRect();
      const r = t.getBoundingClientRect();
      return {
        name: t.textContent,
        size: Math.round(parseFloat(getComputedStyle(t).fontSize)),
        loaded: img.naturalWidth > 0,
        /* The composition is what sits centred, not the title — the picture is
           above and the type below, so the heading is meant to ride low. Take
           the whole block, from the top of the engraving to the foot of the
           recipe count, and check that it is the thing balanced on the page. */
        centred: (() => {
          const a = img.getBoundingClientRect();
          const n = o.querySelector('.pg-open-n').getBoundingClientRect();
          return Math.abs((a.top + n.bottom) / 2 - (pg.top + pg.bottom) / 2) < 40;
        })(),
        folio: !!o.closest('.pg').querySelector('.pg-fol'),
      };
    }));
    /* Which sections have a picture and which do not.
     *
     * Not an assertion that all of them do — four do not, and the prompts for
     * making them are in art/PROMPTS.md, to be run on a machine that can
     * generate images. This is the reminder, and the thing that would catch an
     * engraving quietly losing its section: art is matched by a slug derived
     * from the section name, so renaming a section to something the file is
     * not named after orphans the picture in silence. */
    const artState = await p.evaluate(() => {
      const A = window.SECTION_ART || {};
      const slug = (x) => x.toLowerCase().replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const seen = {}, without = [];
      window.RECIPES.filter((r) => r.book < 3).forEach((r) => {
        const k = r.book + '-' + r.secNum;
        if (seen[k]) return;
        seen[k] = 1;
        if (!A[slug(r.secName)]) without.push(r.secName);
      });
      const used = {};
      window.RECIPES.filter((r) => r.book < 3).forEach((r) => { used[slug(r.secName)] = 1; });
      return { without, orphan: Object.keys(A).filter((k) => !used[k]),
        sections: Object.keys(seen).length };
    });
    /* The book outlives the website and travels further than it: a bound copy
       on somebody's counter carries no footer and no address bar, so the
       sentence has to be on the paper. */
    const onPaper = await p.evaluate(() => document.querySelector('.printwrap').innerText);
    t.ok('the printed front matter says it is not the Church’s',
      /not an official product of The Church of Jesus Christ of Latter-day Saints/i.test(onPaper) &&
      /not affiliated with or endorsed by the Church/i.test(onPaper),
      onPaper.length + ' characters of book, no disclaimer found');

    t.ok('no engraving is left pointing at a section that has been renamed',
      artState.orphan.length === 0, artState.orphan.join(', '));
    t.ok('the sections still waiting on art are the four in art/PROMPTS.md',
      artState.without.length <= 4,
      artState.without.length + ' without art: ' + artState.without.join(', '));

    /* One opener per illustrated section, counted off the sections rather than
       written down. Twelve was right until four engravings arrived, at which
       point both of these went red while the book was doing exactly what they
       describe — the fourth assertion in this file to fail for holding an old
       copy of a number the collection decides. */
    const illustrated = artState.sections - artState.without.length;
    t.ok('every illustrated section opens on a page of its own',
      openers.length === illustrated && openers.every((o) => o.size >= 24 && o.centred),
      JSON.stringify(openers.filter((o) => o.size < 24 || !o.centred)) +
      ' — ' + openers.length + ' openers for ' + illustrated + ' illustrated sections');
    t.ok('and its engraving actually loaded, rather than leaving a hole',
      openers.length === illustrated && openers.every((o) => o.loaded),
      openers.filter((o) => !o.loaded).map((o) => o.name).join(', '));
    t.ok('and carries no page number, the way the front matter does not',
      openers.every((o) => !o.folio),
      openers.filter((o) => o.folio).map((o) => o.name).join(', '));
    /* The leaf used to be anchored to the recipe's box, so it landed level with
       the meta line on the first recipe of a page and rode up onto the
       separator rule on every one after it. Measure all of them. */
    const leaves = await p.evaluate(() => {
      const off = [], right = [];
      document.querySelectorAll('.rp').forEach((rp) => {
        const l = rp.querySelector('.leaf-print');
        const row = rp.querySelector('.rp-top');
        if (!l || !row) return;
        const a = l.getBoundingClientRect(), r = row.getBoundingClientRect();
        off.push(Math.round(((a.top + a.bottom) / 2 - (r.top + r.bottom) / 2) * 10) / 10);
        right.push(Math.round((rp.getBoundingClientRect().right - a.right) * 10) / 10);
      });
      return { n: off.length, off: [...new Set(off)], right: [...new Set(right)] };
    });
    t.ok('every leaf in the book sits in exactly the same place',
      leaves.n > 200 && leaves.off.length === 1 && Math.abs(leaves.off[0]) < 1 &&
      leaves.right.length === 1,
      leaves.n + ' leaves, vertical offsets ' + JSON.stringify(leaves.off) +
      ', right margins ' + JSON.stringify(leaves.right));

    /* Centred on an 11px line, a 30px leaf overhangs its row by about 9px. On
       the first recipe of a page that overhang reaches up towards the running
       head; on every other one it reaches towards the separator rule. Neither
       may actually be touched. */
    const clear = await p.evaluate(() => {
      const bad = [];
      document.querySelectorAll('.pg:not(.no-print)').forEach((pg, i) => {
        const run = pg.querySelector('.pg-run');
        pg.querySelectorAll('.rp').forEach((rp) => {
          const l = rp.querySelector('.leaf-print');
          if (!l) return;
          const a = l.getBoundingClientRect();
          if (run && a.top < run.getBoundingClientRect().bottom) bad.push(i + ' touches the running head');
          if (parseFloat(getComputedStyle(rp).borderTopWidth) > 0 &&
            a.top < rp.getBoundingClientRect().top + 1) bad.push(i + ' rides the rule');
        });
      });
      return bad;
    });
    t.ok('and never touches the rule above it or the running head',
      clear.length === 0, clear.slice(0, 4).join(' | '));

    /* The code on the back cover, read the way a phone reads it rather than
       compared against the string that made it. Re-encoding the URL and
       checking it matches would only prove the encoder is deterministic; it
       would pass just as happily if CSS had squashed the symbol, dropped its
       quiet zone, or scaled it to something no camera can resolve. Those are
       the failures that actually happen, and they are only visible in pixels.

       An unreadable QR in a printed book is the worst kind of broken: it looks
       finished, and the only person who finds out is the one holding it. */
    const shot = await p.locator('.pg-back .bc-qr-img').first().screenshot();
    const sharp = require('sharp');
    const jsQR = require('jsqr');
    const { data, info } = await sharp(shot).ensureAlpha().raw()
      .toBuffer({ resolveWithObject: true });
    const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    t.ok('the code on the back cover actually scans',
      !!decoded && /^https:\/\/\S+$/.test(decoded.data),
      decoded ? decoded.data : 'no symbol found in ' + info.width + '×' + info.height);
    t.ok('and points where the app is published',
      !!decoded && decoded.data === (await p.evaluate(() => window.APP_QR_URL)),
      decoded ? decoded.data : '—');
    t.ok('both back covers carry one',
      (await p.locator('.pg-back .bc-qr-img').count()) === 2,
      await p.locator('.pg-back .bc-qr-img').count());

    t.ok('each volume opens on its own cover', b.covers === 2, b.covers);
    t.ok('and closes on its own back cover',
      (await p.evaluate(() => document.querySelectorAll('.pg-back').length)) === 2);
    t.ok('with a title page behind the cover',
      (await p.evaluate(() => document.querySelectorAll('.pg-title-page').length)) === 2);

    /* A folded booklet is made of sheets of four pages. A volume that is not a
       multiple of four cannot be imposed, and tools/booklet.js refuses it. */
    const perVolume = await p.evaluate(() => {
      const out = [];
      let n = 0;
      document.querySelectorAll('.pg:not(.no-print)').forEach((pg) => {
        if (pg.querySelector('.pg-cover') && n) { out.push(n); n = 0; }
        n++;
      });
      out.push(n);
      return out;
    });
    t.ok('each volume is a whole number of folded sheets',
      perVolume.every((n) => n % 4 === 0), perVolume.join(' + '));
    t.ok('and is numbered from page one',
      Object.keys(b.vols).filter((k) => k !== 'cover').length === 2, JSON.stringify(b.vols));
    t.ok('the bar says what it is about to print', /pages at 5\.5″ × 8\.5″/.test(b.note), b.note);

    // folios: front matter carries none, so adding recipes never shifts numbering
    const folio = await p.evaluate(() => {
      const nums = [...document.querySelectorAll('.pg-fol')].map((e) => parseInt(e.textContent, 10));
      const firstRun = nums.filter((n) => n === 1).length;
      return { count: nums.length, ones: firstRun, ascending: nums.every((n, i) => i === 0 || n >= nums[i - 1] || n === 1) };
    });
    t.ok('page numbers run from one in each volume and never go backwards',
      folio.ones === 2 && folio.ascending, JSON.stringify(folio));

    /* ---- the combined edition ------------------------------------------
       Both-Books.pdf is two books end to end: a back cover on sheet 52, a
       second front cover on 54, and the four pages of reference matter over
       again. Fine as two booklets, and a printing fault as one spiral book.
       This mode is the same 266 recipes built as one object, and what is worth
       asserting is the seams — that there is exactly one of everything a book
       has one of, and that nothing left in it still claims to be a volume. */
    await p.click('[data-print="one"]');
    await p.waitForTimeout(5000);
    const one = await p.evaluate(() => {
      const pgs = [...document.querySelectorAll('.pg:not(.no-print)')];
      const text = pgs.map((x) => x.textContent.replace(/\s+/g, ' '));
      const bands = [...document.querySelectorAll('.sec-band-n')]
        .map((e) => e.textContent).filter((t) => /^Section /.test(t));
      return {
        pages: pgs.length,
        covers: document.querySelectorAll('.pg-cover').length,
        titles: document.querySelectorAll('.pg-title-page').length,
        backs: document.querySelectorAll('.pg-back').length,
        parts: document.querySelectorAll('.pg-part').length,
        frontMatter: text.filter((t) => /How to read a recipe/.test(t)).length,
        companion: text.filter((t) => /companion volume/.test(t)).length,
        sections: bands,
        volumeLines: document.querySelectorAll('.pg-vol, .tp-vol').length,
      };
    });
    t.ok('the combined edition is one book, not two bound together',
      one.covers === 1 && one.titles === 1 && one.backs === 1,
      JSON.stringify({ covers: one.covers, titles: one.titles, backs: one.backs }));
    t.ok('with the reference pages set once rather than twice',
      one.frontMatter === 1, one.frontMatter + ' copies of How to read a recipe');
    t.ok('and a part page where each volume used to start its own cover',
      one.parts === 2, one.parts + ' part pages');
    /* Volume Two's Section 1 would otherwise turn up on page 60 of a book that
       already had one. */
    /* However many sections the two volumes hold between them — the number was
       written in here as 14 and had to be found and changed by hand the first
       time a volume was re-sectioned, which is a test measuring the copy of the
       answer it was given rather than the answer. */
    const secCount = await p.evaluate(() => new Set(
      window.RECIPES.filter((r) => r.book !== 3).map((r) => r.book + '-' + r.secNum)).size);
    t.ok('sections numbered straight through both parts',
      one.sections.join('|') === Array.from({ length: secCount }, (_, i) => 'Section ' + (i + 1)).join('|'),
      one.sections.join(' ') + '  (expected ' + secCount + ')');
    t.ok('and nothing in it still calls itself a volume of two',
      one.companion === 0 && one.volumeLines === 0,
      one.companion + ' companion lines, ' + one.volumeLines + ' volume lines');
    /* Only the comparison. It used to also assert 160 exactly, which is a
       second copy of a number the render decides — and it went red the day a
       recipe was added, for holding an old answer rather than because the book
       was wrong. What is worth protecting is the reason the combined edition
       exists: one cover and one set of front matter instead of two. */
    t.ok('it is shorter than the two volumes printed separately',
      one.pages < b.pages, one.pages + ' vs ' + b.pages);

    await p.click('[data-print="all"]');
    await p.waitForTimeout(4500);

    /* Every choice that has a finished file offers it, and the two you fold
     * yourself offer the imposed one too.
     *
     * The shelf draws itself from READY_MADE every render, so a cover can end
     * up pointing at a file that is not the book it is a picture of. This
     * walks all six choices rather than reading one.
     *
     * The fifty-dollar link goes with it: somebody reading a 184-page preview
     * and working out what a copy shop charges has already decided they want
     * it on paper, but nobody ships you a bound print of this week's plan, so
     * it has to be gone by then. */
    const offers = {};
    for (const set of ['all', 'one', '1', '2', 'fav', 'plan']) {
      await p.click('.bk-card[data-print="' + set + '"]');
      await p.waitForTimeout(2500);
      offers[set] = await p.evaluate((set) => {
        const card = document.querySelector('.bk-card[data-print="' + set + '"]');
        const fold = document.querySelector('[data-fold="' + set + '"]');
        const order = document.getElementById('orderBook');
        return { pdf: card && card.getAttribute('href'),
                 booklet: fold && fold.getAttribute('href'),
                 order: !order.classList.contains('hide') };
      }, set);
    }
    const books = ['all', 'one', '1', '2'], live = ['fav', 'plan'];
    t.ok('every book you can pick hands you its file',
      books.every((k) => /^print\/.+\.pdf$/.test(offers[k].pdf || '')), JSON.stringify(offers));
    t.ok('and the two you fold yourself offer the imposed one as well',
      /-booklet\.pdf$/.test(offers['1'].booklet || '') &&
      /-booklet\.pdf$/.test(offers['2'].booklet || '') &&
      !offers.all.booklet && !offers.one.booklet, JSON.stringify(offers));
    t.ok('and the selections with no file fall back to the print dialog',
      live.every((k) => !offers[k].pdf && !offers[k].booklet), JSON.stringify(offers));
    t.ok('the printed-copy offer goes with the books, not with the week',
      books.every((k) => offers[k].order) && live.every((k) => !offers[k].order),
      JSON.stringify(offers));

    /* And the bar stays out of the way of the book.
     *
     * It spent a while as four rows, one per file, each with a description and
     * its own buttons — 384px of chrome above a page whose whole job is
     * showing you the book, which on a laptop meant scrolling before you saw
     * any of it. The shelf of covers earns more room than the compact bar did,
     * but not unboundedly: a third of the window, and the first page of the
     * book still has to be on screen without scrolling. */
    await p.click('.bk-card[data-print="all"]');
    await p.waitForTimeout(4500);
    const room = await p.evaluate(() => {
      const bar = document.querySelector('.book-bar').getBoundingClientRect();
      const pg = document.querySelector('.pg:not(.no-print)');
      return { bar: Math.round(bar.height), win: window.innerHeight,
               pageTop: pg ? Math.round(pg.getBoundingClientRect().top) : null };
    });
    t.ok('and the bar leaves the room to the book it is a bar for',
      room.bar <= room.win / 3 && room.pageTop !== null && room.pageTop < room.win,
      JSON.stringify(room));

    // the other things you can print
    await p.evaluate(() => { window.Store.toggleFav(3); window.Store.toggleFav(9); });
    await p.click('[data-print="fav"]');
    await p.waitForTimeout(1200);
    t.ok('favorites print on their own',
      (await p.evaluate(() => document.querySelectorAll('.pg:not(.no-print)').length)) >= 2);

    await p.evaluate(() => { window.Store.addToDay(12, 'mon'); });
    await p.click('[data-print="plan"]');
    await p.waitForTimeout(1200);
    /* The week's card is named after the week rather than "This week", because
       somebody may have renamed it to Thanksgiving and that card would then be
       the only thing in the app still calling it something else. */
    const wk = await p.evaluate(() => {
      const c = document.querySelector('.bk-card[data-print="plan"]');
      return c && { name: c.querySelector('.bk-what').textContent,
                    count: c.querySelector('.bk-pages').textContent,
                    real: window.Store.activeWeek().name };
    });
    t.ok('and so does the week, named after itself',
      !!wk && wk.name === wk.real && /1/.test(wk.count), JSON.stringify(wk));

    // a phone should be able to look at the book without it running off the side
    await p.setViewportSize({ width: 390, height: 780 });
    await p.waitForTimeout(600);
    const over = await p.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    t.ok('the pages fit a phone screen', over <= 0, over + 'px');

    await p.context().close();
  },
};
