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

    t.ok('both volumes render as 160 pages of paper', b.pages === 160, b.pages + ' pages');

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
    t.ok('every illustrated section opens on a page of its own',
      openers.length === 12 && openers.every((o) => o.size >= 24 && o.centred),
      JSON.stringify(openers.filter((o) => o.size < 24 || !o.centred)) + ' of ' + openers.length);
    t.ok('and its engraving actually loaded, rather than leaving a hole',
      openers.length === 12 && openers.every((o) => o.loaded),
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

    // the other things you can print
    await p.evaluate(() => { window.Store.toggleFav(3); window.Store.toggleFav(9); });
    await p.selectOption('#printSet', 'fav');
    await p.waitForTimeout(1200);
    t.ok('favorites print on their own',
      (await p.evaluate(() => document.querySelectorAll('.pg:not(.no-print)').length)) >= 2);

    await p.evaluate(() => { window.Store.addToDay(12, 'mon'); });
    await p.selectOption('#printSet', 'plan');
    await p.waitForTimeout(1200);
    const opt = await p.textContent('#printSet option[value="plan"]');
    t.ok('and so does the week, named after itself', /^This Week — 1 recipe$/.test(opt), opt);

    // a phone should be able to look at the book without it running off the side
    await p.setViewportSize({ width: 390, height: 780 });
    await p.waitForTimeout(600);
    const over = await p.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    t.ok('the pages fit a phone screen', over <= 0, over + 'px');

    await p.context().close();
  },
};
