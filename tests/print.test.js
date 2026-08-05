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

    t.ok('both volumes render as 142 pages of paper', b.pages === 142, b.pages + ' pages');
    t.ok('and the bar says the same number', b.note.indexOf(b.pages + ' pages') >= 0, b.note);
    t.ok('nothing spills off a page', b.spills.length === 0, b.spills.slice(0, 4).join(' | '));
    t.ok('no section heading is stranded on a page it does not fill', b.orphanBand === 0, b.orphanBand);

    const openers = await p.evaluate(() => [...document.querySelectorAll('.sec-open')].map((o) => {
      const t = o.querySelector('.sec-band-t');
      const pg = o.closest('.pg').getBoundingClientRect();
      const r = t.getBoundingClientRect();
      return {
        name: t.textContent,
        size: Math.round(parseFloat(getComputedStyle(t).fontSize)),
        // roughly centred rather than stuck at the top
        centred: Math.abs((r.top + r.bottom) / 2 - (pg.top + pg.bottom) / 2) < 60,
      };
    }));
    t.ok('the sections that need a title page get a real one',
      openers.length > 0 && openers.every((o) => o.size >= 24 && o.centred),
      JSON.stringify(openers));
    t.ok('each volume opens on its own cover', b.covers === 2, b.covers);
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
