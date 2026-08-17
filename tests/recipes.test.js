/* The collection itself: its numbering, its cross-references, and whether a
 * recipe uses what it asks you to buy.
 *
 * These are checks on the data rather than on the interface, but they run in
 * the browser against the file the app actually loads — the same copy a phone
 * gets, not a fresh read of the build tools' output.
 */

module.exports = {
  name: 'The collection',
  async run(t) {
    const p = await t.fresh();

    /* ---------------------------------------------------------------- number
     *
     * The front matter promises a number "running from 001 straight through
     * both volumes", and for one afternoon it did not. Volume One was
     * renumbered when it was re-sectioned and grew to a hundred and eleven;
     * Volume Two's printed number had always been its id, starting at 101. So
     * eleven numbers pointed at two recipes each — there were two recipes
     * called 105 — and six more were missing entirely where the drinks had
     * left. Nothing noticed, because nothing had ever had reason to look at
     * the two volumes' numbers together. */
    const nums = await p.evaluate(() => window.RECIPES
      .filter((r) => r.book === 1 || r.book === 2)
      .map((r) => r.no)
      .sort((a, b) => a - b));

    t.ok('every printed recipe has a number',
      nums.every((n) => Number.isInteger(n) && n > 0), nums.filter((n) => !n).length + ' without one');
    t.ok('no two recipes share a number',
      new Set(nums).size === nums.length,
      nums.length - new Set(nums).size + ' numbers used twice');
    const gaps = nums.filter((n, i) => i && n !== nums[i - 1] + 1)
      .map((n, i) => nums[nums.indexOf(n) - 1] + '->' + n);
    t.ok('and the run has no holes in it',
      nums[0] === 1 && gaps.length === 0,
      'starts at ' + nums[0] + ', gaps: ' + (gaps.join(', ') || 'none'));

    /* ---------------------------------------------------- cross-references
     *
     * Ten steps send you to another recipe. Every one of them used to have the
     * number typed into the sentence, which was correct until the collection
     * was renumbered and then quietly wrong in ten places at once — in the
     * printed book, where nobody can see the mistake and everybody can follow
     * it to the wrong page.
     *
     * They carry the id now and the number is filled in when the sentence is
     * drawn. These two checks are what stop it going back: a reference has to
     * point at something that exists, and no step may go back to writing the
     * number down. */
    const refs = await p.evaluate(() => {
      const by = {}; window.RECIPES.forEach((r) => { by[r.id] = r; });
      const dead = [], typed = [];
      window.RECIPES.forEach((r) => (r.steps || []).forEach((s, i) => {
        (String(s).match(/\{r:(\d+)\}/g) || []).forEach((tok) => {
          const id = tok.slice(3, -1);
          if (!by[id]) dead.push('no.' + r.no + ' step ' + i + ' -> ' + id);
        });
        if (/\bRecipe \d+/.test(s)) typed.push('no.' + r.no + ' step ' + i);
      }));
      return { dead, typed, total: window.RECIPES.reduce((n, r) =>
        n + (r.steps || []).join(' ').split(/\{r:\d+\}/).length - 1, 0) };
    });
    t.ok('the recipes point at each other in ten or more places', refs.total >= 10, refs.total + ' references');
    t.ok('and every reference points at a recipe that exists',
      refs.dead.length === 0, refs.dead.join('; '));
    t.ok('no step writes a recipe number down by hand',
      refs.typed.length === 0, refs.typed.join('; '));

    /* And the reference has to work, not merely resolve. Opening the meatball
       feast and pressing the words is the thing the reader actually does. */
    const meatballs = await p.evaluate(() =>
      (window.RECIPES.find((r) => /\{r:\d+\}/.test((r.steps || []).join(' ')) && r.book === 2) || {}).id);
    await p.evaluate((id) => document.querySelector('[data-open="' + id + '"]').click(), meatballs);
    await p.waitForTimeout(300);
    const shown = await p.evaluate(() => ({
      raw: /\{r:\d+\}/.test(document.body.innerText),
      links: [...document.querySelectorAll('.xref')].map((b) => b.textContent),
    }));
    t.ok('a reference is drawn as a recipe number, not as its token',
      !shown.raw && shown.links.length > 0 && /^Recipe \d{3}$/.test(shown.links[0] || ''),
      JSON.stringify(shown));

    const went = await (async () => {
      const before = await p.evaluate(() => document.querySelector('.sheet-eyebrow, .sheet').innerText.slice(0, 40));
      await p.click('.xref');
      await p.waitForTimeout(300);
      const after = await p.evaluate(() => document.querySelector('.sheet').innerText.slice(0, 60));
      return { before, after };
    })();
    t.ok('and pressing it opens the recipe it names',
      /NO\. \d+/.test(went.after) && went.after !== went.before, JSON.stringify(went));
    await p.keyboard.press('Escape');
    await p.waitForTimeout(200);

    /* ------------------------------------------------------------- the score
     *
     * Carbohydrate was free. Across the whole collection the correlation
     * between carbohydrate's share of a recipe's calories and its score was
     * 0.012 — and the fat part rewards a low fat share, so trading fat for
     * sugar actually raised a recipe's score. A mug of hot milk and brown
     * sugar scored 75.
     *
     * What is scored is not carbohydrate, which is the part worth protecting:
     * oats and frosting are both carbohydrate. A gram of fiber covers ten
     * grams of it, and only the remainder costs anything — so this checks the
     * discrimination rather than the penalty. Any formula that marks the oats
     * down along with the sugar has missed the point of the change. */
    const score = await p.evaluate(() => {
      const N = window.Nutrition;
      const same = { kcal: 300, p: 15, na: 300, fib: 1 };
      const fatty = N.scoreFrom(Object.assign({}, same, { f: 10, c: 30 }));
      const sugary = N.scoreFrom(Object.assign({}, same, { f: 0, c: 52 }));
      const oats = N.scoreFrom({ kcal: 300, p: 15, f: 5, c: 50, na: 300, fib: 7 });
      const sugar = N.scoreFrom({ kcal: 300, p: 15, f: 5, c: 50, na: 300, fib: 0.5 });
      return { fatty: fatty.score, sugary: sugary.score, oats: oats.score, sugar: sugar.score,
        parts: Object.keys(fatty.sc), max: N.MAX };
    });
    t.ok('the score has a part for carbohydrate',
      score.parts.indexOf('c') >= 0 && score.max && score.max.c > 0,
      score.parts.join(','));
    t.ok('the six parts still add to a hundred',
      Object.values(score.max).reduce((a, b) => a + b, 0) === 100,
      JSON.stringify(score.max));
    t.ok('trading fat for sugar no longer raises a score',
      score.sugary <= score.fatty, score.fatty + ' with the fat, ' + score.sugary + ' with the sugar');
    t.ok('and fifty grams of carbohydrate with fiber beats fifty without',
      score.oats > score.sugar + 5,
      'oats ' + score.oats + ' vs sugar ' + score.sugar);

    /* --------------------------------------------------- what you were told
     *   to buy
     *
     * A reader cooked the meatball feast and finished with a can of green
     * beans still on the counter: the ingredient list asked for it and the
     * method never mentioned it. Four more were like it.
     *
     * The check is deliberately loose about how an ingredient may be claimed —
     * "mix the ingredients" and "make 4 PB&J sandwiches" both count — because
     * a strict reading flags a third of the collection and would be turned
     * off within a week. What it is really holding is the five that were
     * fixed, and any new recipe that lists something and then forgets it. */
    const orphans = await p.evaluate(() => {
      const { FOODS, ALIASES } = window.Nutrition;

      /* Every word that could stand for a food key: the key itself, the label
         the shopping list prints, the note beside it in the table, and every
         alias the parser accepts. Matching on the ingredient line's own words
         alone is not enough — "1 jar spaghetti sauce" is claimed by a step
         that says "simmer in sauce". */
      const words = {};
      const add = (k, str) => { if (str) (words[k] = words[k] || []).push(String(str).toLowerCase()); };
      Object.keys(FOODS).forEach((k) => {
        add(k, k.replace(/_/g, ' '));
        add(k, FOODS[k].label);
        if (FOODS[k].note) String(FOODS[k].note).split(/[;,]/).forEach((n) => add(k, n.trim()));
      });
      Object.keys(ALIASES).forEach((a) => add(ALIASES[a], a));

      const forms = (str) => {
        const out = {};
        const push = (x) => { if (x && x.length > 2) out[x] = 1; };
        push(str);
        push(str.replace(/ies$/, 'y')); push(str.replace(/y$/, 'ies'));
        push(str.replace(/es$/, '')); push(str.replace(/s$/, ''));
        push(str + 's'); push(str + 'es');
        const parts = str.split(/\s+/);
        if (parts.length > 1) {
          const last = parts[parts.length - 1];
          push(last); push(last + 's'); push(last.replace(/s$/, ''));
        }
        return Object.keys(out);
      };

      /* Seasoning and fat nobody narrates. "Salt" rarely gets a sentence of
         its own and does not need one. */
      const QUIET = { salt: 1, pepper: 1, black_pepper: 1, water: 1, oil: 1, olive_oil: 1,
        vegetable_oil: 1, cooking_spray: 1, spice: 1, cinnamon: 1, vanilla: 1,
        garlic_powder: 1, onion_powder: 1, paprika: 1, chili_powder: 1, cumin: 1,
        oregano: 1, basil: 1, parsley: 1, italian_seasoning: 1, nutmeg: 1,
        baking_powder: 1, baking_soda: 1 };

      /* And the steps that claim a whole list at once. A recipe entitled to
         say "mix the ingredients" is not hiding anything — it is telling you
         to use all of them. Same for a batter, a dough, and "the vegetables"
         standing in for the three tins that went into it. */
      const COLLECTIVE = /\ball (of )?(the )?ingredients|mix (the )?ingredients|blend everything|combine everything|put ingredients|batter|dough|the vegetables|the veg\b|season well|make \d+ pb&j/;

      const out = [];
      window.RECIPES.forEach((r) => {
        const steps = (r.steps || []).join(' ').toLowerCase();
        if (COLLECTIVE.test(steps)) return;
        (r.ingp || []).forEach((it, i) => {
          if (!it || !it.k || QUIET[it.k]) return;
          const line = String((r.ing || [])[i] || '');
          const cand = {};
          (words[it.k] || [it.k.replace(/_/g, ' ')]).forEach((w) =>
            forms(w).forEach((f) => { cand[f] = 1; }));
          line.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/)
            .filter((w) => w.length > 3).forEach((w) => forms(w).forEach((f) => { cand[f] = 1; }));
          if (!Object.keys(cand).some((w) => steps.indexOf(w) >= 0)) {
            out.push('no.' + (r.no || r.id) + ' "' + line + '" (' + r.name + ')');
          }
        });
      });
      return out;
    });
    t.ok('nothing on an ingredient list goes unused by its own method',
      orphans.length === 0, orphans.join('; '));

    await p.context().close();
  },
};
