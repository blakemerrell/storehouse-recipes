/* Browsing, filtering, sorting, searching, and the recipe panel. */

module.exports = {
  name: 'Browse',
  async run(t) {
    const p = await t.fresh();

    const n = await p.evaluate(() => document.querySelectorAll('.card').length);
    t.ok('all 266 recipes are on the page', n === 266, n);

    /* The head says what you are looking at. The volume blurbs were written for
       the printed covers and used only there, so for a long while the app named
       the two books and never said what either one was — you had to pick one to
       find out whether it was the one you wanted. */
    const blurb = () => p.textContent('#browseBlurb');
    t.ok('the collection says what the two volumes are',
      /Run and Not Be Weary/.test(await blurb()) && /Around the Table/.test(await blurb()),
      await blurb());

    // filters
    await p.click('[data-book="1"]');
    await p.waitForTimeout(150);
    /* However many Volume One holds. Written down as 100 it went red the day
       six recipes moved into it, while the thing it describes — that picking a
       volume shows that volume and nothing else — still held exactly. */
    t.ok('one volume at a time',
      await p.evaluate(() => document.querySelectorAll('.card').length ===
        window.RECIPES.filter((r) => r.book === 1).length),
      await p.evaluate(() => document.querySelectorAll('.card').length + ' of ' +
        window.RECIPES.filter((r) => r.book === 1).length));
    t.ok('and picking one says what that one is',
      /protein, fiber/.test(await blurb()), await blurb());

    /* Once you have typed a dish name the heading is no longer about a book,
       and a paragraph about the volumes sits between you and the answer. */
    await p.fill('#search', 'chicken'); await p.waitForTimeout(400);
    t.ok('but a search puts the line away', (await blurb()) === '', await blurb());
    await p.fill('#search', ''); await p.waitForTimeout(400);

    await p.click('[data-book="all"]');
    await p.selectOption('#diffSel', 'In-Depth');
    await p.waitForTimeout(150);
    // effort is not printed on the card, so check the recipes behind the cards
    const hard = await p.evaluate(() => {
      const shown = [...document.querySelectorAll('.card')].map((c) => c.dataset.open);
      const by = {}; window.RECIPES.forEach((r) => { by[r.id] = r; });
      return shown.length && shown.every((id) => by[id].diff === 'In-Depth');
    });
    t.ok('effort filters to what it says', hard);
    await p.selectOption('#diffSel', 'all');

    /* The three words on this filter follow your pantry, the way the line at
       the foot of every recipe already does. Before, they described the
       storehouse whatever you did — and "Needs pantry extras" meant the exact
       opposite of the Pantry tab one tab away. */
    const filterWords = () => p.evaluate(() =>
      [...document.querySelectorAll('#pantrySel option')].map((o) => o.textContent));
    t.ok('the storehouse filter talks about the storehouse until you change it',
      (await filterWords()).join('|') === 'Everything|Storehouse items only|Needs something bought elsewhere',
      (await filterWords()).join(' | '));
    await p.evaluate(() => window.Store.setPantry('cottage_cheese', false));
    await p.waitForTimeout(400);
    t.ok('and about your shelf once you have one',
      (await filterWords()).join('|') === "Everything|Only what's on my shelf|Needs a shop",
      (await filterWords()).join(' | '));
    await p.evaluate(() => window.Store.resetPantry());
    await p.waitForTimeout(400);

    await p.selectOption('#pantrySel', 'base');
    await p.waitForTimeout(150);
    const onlyBase = await p.evaluate(() =>
      [...document.querySelectorAll('.card')].every((c) => !/Also needs/.test(c.textContent)));
    t.ok('storehouse-only really is storehouse-only', onlyBase);
    await p.selectOption('#pantrySel', 'all');

    // sorting
    await p.selectOption('#sortSel', 'healthy');
    await p.waitForTimeout(200);
    const scores = await p.evaluate(() =>
      [...document.querySelectorAll('.leaf-n')].slice(0, 12).map((e) => parseInt(e.textContent, 10)));
    t.ok('healthiest first really is descending',
      scores.every((s, i) => i === 0 || scores[i - 1] >= s), scores.join(','));

    await p.selectOption('#sortSel', 'quick');
    await p.waitForTimeout(200);
    const first = await p.textContent('.card-meta');
    t.ok('quickest first starts at the quickest', /^[1-5] mins?\b/.test(first), first);
    await p.selectOption('#sortSel', 'book');

    // search covers names, ingredients and sections
    await p.fill('#search', 'buttermilk');
    await p.waitForTimeout(200);
    const found = await p.evaluate(() => document.querySelectorAll('.card').length);
    t.ok('search reaches into the ingredients', found > 0 && found < 20, found);
    await p.fill('#search', '');

    // favorites survive a reload
    await p.click('#grid .card:nth-child(2)');
    await p.click('[data-fav]');
    await p.waitForTimeout(200);
    await p.click('.sheet-x');
    await p.reload();
    await p.waitForTimeout(400);
    t.ok('a favorite sticks', (await p.textContent('#favCount')) === '(1)', await p.textContent('#favCount'));

    // the panel: scaling the ingredients, and the score breakdown
    await p.click('#grid .card:nth-child(1)');
    const before = await p.textContent('.sheet-ing');
    await p.click('[data-scale="up"]');
    const after = await p.textContent('.sheet-ing');
    t.ok('doubling changes the ingredients', before !== after);
    t.ok('and reads as fractions, not decimals', !/\d\.\d/.test(after), after.slice(0, 80));

    const panel = await p.textContent('.sheet');
    const bands = await p.evaluate(() => {
      const seen = {};
      document.querySelectorAll('.leaf').forEach((l) => {
        const n = parseInt(l.querySelector('.leaf-n').textContent, 10);
        const b = l.className.match(/leaf-(good|ok|low)/)[1];
        seen[b] = seen[b] || [];
        if (seen[b].length < 40) seen[b].push(n);
      });
      return seen;
    });
    t.ok('every score sits in a leaf, banded by what it says',
      (bands.good || []).every((n) => n >= 70) &&
      (bands.ok || []).every((n) => n >= 45 && n < 70) &&
      (bands.low || []).every((n) => n < 45),
      JSON.stringify(Object.keys(bands).map((k) => k + ':' + bands[k].length)));

    /* Shut, this panel is a score and a line of figures. No chart: a bar you
       have to decode is not a summary, and every version that tried to be both
       ended up taller than the recipe it belonged to. */
    const nut = await p.evaluate(() => {
      const foot = document.querySelector('.nut-foot');
      return {
        charts: document.querySelectorAll('.nut-track, .nut-slot, .why-bar').length,
        named: document.querySelectorAll('.why-part').length,
        /* scrollWidth is no use here: a wrapped flex row still fits its box.
           Count the distinct tops instead. */
        footRows: new Set([...foot.children].map((c) =>
          Math.round(c.getBoundingClientRect().top))).size,
        height: Math.round(document.querySelector('.nut').getBoundingClientRect().height),
        ask: document.querySelector('.nut-ask').textContent.trim(),
      };
    });

    t.ok('shut, the panel is the score and the figures and nothing else',
      nut.charts === 0 && nut.named === 0 && nut.ask === 'Why this score?',
      JSON.stringify(nut));

    t.ok('the macro line holds one row without wrapping',
      nut.footRows === 1, nut.footRows + ' rows');

    /* The complaint that produced this shape: on a two-step recipe the panel
       was taller than the recipe. */
    t.ok('and the whole panel stays out of the recipe\u2019s way',
      nut.height < 100, nut.height + 'px tall');

    // pressing the leaf is what answers, which is the whole idea
    await p.click('.nut-leaf');
    await p.waitForTimeout(200);
    const open = await p.evaluate(() => {
      const score = Number(document.querySelector('.leaf-n').textContent);
      const parts = [...document.querySelectorAll('.why-part')].map((w) => ({
        name: w.querySelector('b').textContent,
        fact: w.querySelector('.why-fact').textContent,
        pts: w.querySelector('.why-pts').textContent,
        fill: parseFloat(w.querySelector('.why-bar i').style.width),
        cut: w.querySelector('.why-fact').scrollWidth >
             w.querySelector('.why-fact').clientWidth + 1,
      }));
      return {
        score, parts,
        head: document.querySelector('.why-head').textContent,
        expanded: document.querySelector('.nut-leaf').getAttribute('aria-expanded'),
        ask: document.querySelector('.nut-ask').textContent.trim(),
      };
    });

    t.ok('pressing the leaf explains the score part by part',
      open.parts.length === 5 &&
      open.parts.map((w) => w.name).join() === 'Protein,Calories,Fat,Sodium,Fiber',
      JSON.stringify(open.parts.map((w) => w.name)));

    t.ok('with the recipe\u2019s own figure behind each one',
      open.parts.every((w) => /\d/.test(w.fact)) && !open.parts.some((w) => w.cut),
      JSON.stringify(open.parts.map((w) => w.fact)));

    /* Every track is the same length and fills by the share of that part's
       points earned, so the five can be read straight down the column. */
    t.ok('and a bar that matches the points it claims',
      open.parts.every((w) => {
        const [got, max] = w.pts.split('/').map(Number);
        return Math.abs(w.fill - (max ? got / max * 100 : 0)) < 0.5;
      }), JSON.stringify(open.parts.map((w) => w.pts + ' -> ' + w.fill + '%')));

    t.ok('the points add up to the number in the leaf',
      Math.abs(open.parts.reduce((n, w) => n + Number(w.pts.split('/')[0]), 0) - open.score) < 1.5 &&
      open.head === 'Why ' + open.score + ' out of 100',
      open.head);

    t.ok('and it says it is open to a screen reader as well',
      open.expanded === 'true' && open.ask === 'Hide the breakdown',
      open.expanded + ' / ' + open.ask);

    await p.click('.nut-ask');
    await p.waitForTimeout(200);
    t.ok('it shuts again',
      (await p.evaluate(() => document.querySelectorAll('.why-part').length)) === 0);

    // a different recipe starts shut, rather than inheriting the last one
    await p.click('.sheet-x');
    await p.waitForTimeout(150);
    await p.click('#grid .card:nth-child(3)');
    await p.waitForTimeout(250);
    t.ok('and every recipe opens on the score, not the audit',
      (await p.evaluate(() => document.querySelectorAll('.why-part').length)) === 0);

    /* Save and Edit spelled out took enough of the row that the week wrapped
       onto a second line on a phone, which reads as two groups of days. */
    const acts = await p.evaluate(() => ({
      icons: [...document.querySelectorAll('.iconbtn')].map((b) => b.getAttribute('aria-label')),
      dayRows: new Set([...document.querySelectorAll('.daybtn')]
        .map((b) => Math.round(b.getBoundingClientRect().top))).size,
      days: document.querySelectorAll('.daybtn').length,
    }));
    t.ok('the week sits on one line, with a star and a pencil beside it',
      acts.dayRows === 1 && acts.days === 7 && acts.icons.length === 2 &&
      /favorites$/.test(acts.icons[0]) && /^Edit/.test(acts.icons[1]),
      JSON.stringify(acts));

    /* ---- a title may not promise what the recipe has not got -------------
     *
     * A reader opened No. 084, "Protein Cocoa Slurry with Rice Crisp", and
     * asked where the rice crisp was. There was none: whey, cocoa, two
     * tablespoons of water, and no step that could have held any. Three more
     * read the same way — buttermilk pancakes made with milk, marshmallow
     * cocoa cups containing cinnamon, a rotini casserole made with ribbon
     * pasta.
     *
     * The check is that every food named in a title turns up somewhere in the
     * recipe. The allowlist below is the honest part of it: these are flavour
     * names rather than ingredient claims — a Mac & Cheese is a dish, banana
     * bread oatmeal tastes of banana bread, and Zero-Sugar promises the
     * absence of the thing it names. Anything not on this list that goes
     * missing is the fault above, coming back.
     */
    const FLAVOUR_NAMES = [
      'mac', 'cheese', 'bread', 'sugar', 'pb', 'fruit', 'pasta', 'rice',
      'scrambled eggs', 'fresh fruit', 'cinnamon sugar', 'pepper', 'oats',
      'hamburger buns', 'mashed potatoes', 'rotini', 'bbq sauce', 'buttermilk',
      'marshmallow', 'rice crisp',
    ];
    const promises = await p.evaluate((allow) => {
      const vocab = new Set();
      Object.keys(window.PANTRY || {}).forEach((k) => {
        vocab.add(k.replace(/_/g, ' '));
        if (window.PANTRY[k].l) vocab.add(String(window.PANTRY[k].l).toLowerCase());
      });
      const skip = new Set(allow);
      const bad = [];
      window.RECIPES.forEach((r) => {
        const body = (r.ing.join(' ') + ' ' + r.steps.join(' ') + ' ' +
          (r.extras || '')).toLowerCase();
        const words = r.name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
        const missing = [];
        words.forEach((w, i) => {
          const two = i + 1 < words.length ? w + ' ' + words[i + 1] : null;
          [w, two].forEach((cand) => {
            if (!cand || skip.has(cand) || !vocab.has(cand)) return;
            if (body.indexOf(cand) < 0) missing.push(cand);
          });
        });
        if (missing.length) bad.push((r.no || r.id) + ' ' + r.name + ' → ' + missing.join(', '));
      });
      return bad;
    }, FLAVOUR_NAMES);
    t.ok('no title promises an ingredient the recipe has not got',
      promises.length === 0, promises.slice(0, 6).join(' | '));

    await p.context().close();

    /* A desk is the easy case. The panel is read on a phone, where the macro
       line has 242px next to the leaf \u2014 so check the widest of all 266 there,
       not just whichever recipe happens to be first. */
    const phone = await t.fresh({ viewport: { width: 376, height: 860 } });
    await phone.click('#grid .card:nth-child(1)');
    await phone.waitForTimeout(200);
    const wide = await phone.evaluate(() => {
      const foot = document.querySelector('.nut-foot');
      const rows = () => new Set([...foot.children]
        .map((c) => Math.round(c.getBoundingClientRect().top))).size;
      const bad = [];
      window.RECIPES.forEach((r) => {
        if (r.score === null || !r.macro) return;
        const m = r.macro;
        foot.innerHTML = [m.kcal + ' kcal', Math.round(m.p) + 'g P', Math.round(m.c) + 'g C',
          Math.round(m.f) + 'g F', m.na + 'mg S', (m.fib < 1 ? m.fib : Math.round(m.fib)) + 'g Fib']
          .map((x) => '<span>' + x + '</span>').join('<i>&middot;</i>');
        if (rows() > 1) bad.push(r.name);
      });
      return bad;
    });
    t.ok('on a phone it holds one row for every recipe in the collection',
      wide.length === 0, wide.length + ' wrap, e.g. ' + wide.slice(0, 3).join('; '));

    await phone.evaluate(() => document.querySelector('.nut-leaf').click());
    await phone.waitForTimeout(250);
    const openPhone = await phone.evaluate(() => ({
      parts: document.querySelectorAll('.why-part').length,
      cut: [...document.querySelectorAll('.why-fact')]
        .filter((f) => f.scrollWidth > f.clientWidth + 1).length,
      dayRows: new Set([...document.querySelectorAll('.daybtn')]
        .map((b) => Math.round(b.getBoundingClientRect().top))).size,
    }));
    t.ok('and on a phone the breakdown reads in full, week still on one line',
      openPhone.parts === 5 && openPhone.cut === 0 && openPhone.dayRows === 1,
      JSON.stringify(openPhone));

    await phone.context().close();
  },
};
