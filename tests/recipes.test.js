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

    /* --------------------------------------- ingredients you could make
     *
     * The storehouse does not carry breadcrumbs, and the app said it did.
     * Stocked-ness used to be inferred from whether some recipe had named an
     * item in its own extras line, so anything nobody annotated was silently
     * declared available — five items were wrong that way, including the
     * celery salt in the BBQ sauce recipe, which exists so that somebody with
     * only the order can still make barbecue sauce.
     *
     * It is declared now, and Made, Not Bought answers for what is left. Fifty
     * ingredient lines name something it produces, and each of those lines
     * carries the link rather than the section hoping to be browsed. */
    const makers = await p.evaluate(() => {
      const M = window.MAKERS || {}, P = window.PANTRY;
      const by = {}; window.RECIPES.forEach((r) => { by[r.id] = r; });
      const dead = Object.keys(M).filter((k) => !by[M[k]]);
      const stocked = Object.keys(M).filter((k) => P[k] && P[k].s);
      let linked = 0;
      window.RECIPES.forEach((r) => (r.ingp || []).forEach((it) => {
        if (it && it.k && M[it.k] && M[it.k] !== r.id &&
            by[M[it.k]].secName !== r.secName) linked++;
      }));
      return { dead, stocked, linked, made: Object.keys(M).length };
    });
    t.ok('the collection has recipes for things the storehouse does not carry',
      makers.made >= 8 && makers.linked >= 40,
      makers.made + ' made, reachable from ' + makers.linked + ' ingredient lines');
    t.ok('and each one points at a recipe that exists',
      makers.dead.length === 0, makers.dead.join(', '));
    /* And the rescue has to be a rescue.
     *
     * Made, Not Bought is for the cook who has the storehouse order and
     * nothing else, so a recipe in it that needs something off the order is
     * worse than useless — it sends you to the shop to avoid going to the
     * shop. Both sauce recipes did: they listed celery salt, which the order
     * does not carry, and nothing said so because the pantry had celery salt
     * marked as a staple. It is optional in both now, and optional means
     * something: the line counts toward the nutrition and never toward what
     * you have to go out for. */
    const rescue = await p.evaluate(() => {
      const P = window.PANTRY;
      const bad = [];
      window.RECIPES.filter((r) => r.secName === 'Made, Not Bought').forEach((r) => {
        (r.ingp || []).forEach((it, i) => {
          if (it && it.k && !it.o && P[it.k] && !P[it.k].s) {
            bad.push('no.' + r.no + ' needs ' + r.ing[i]);
          }
        });
      });
      return bad;
    });
    t.ok('and every one of them can be made from the storehouse order alone',
      rescue.length === 0, rescue.join('; '));

    const bought = await p.evaluate(() => {
      const P = window.PANTRY;
      return ['breadcrumbs', 'celery_salt', 'spray_butter', 'cream_cheese', 'biscuit_dough']
        .filter((k) => P[k] && P[k].s);
    });
    t.ok('the five the order never carried are no longer listed as staples',
      bought.length === 0, bought.join(', ') + ' still marked stocked');

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

    /* And nothing you were sent to the shop for, either.
     *
     * The check above reads r.ing. "Buy this elsewhere" is r.extras, a
     * separate list, so it was never covered — and eleven recipes were putting
     * something on a shopping list that no ingredient line and no step ever
     * mentioned again. Taco seasoning in five of them, parmesan in the
     * alfredo bake and the meatball feast, garlic powder, Italian seasoning,
     * cumin, Worcestershire.
     *
     * That is worse than an unused ingredient, because it costs money at a
     * till on the strength of a recipe that then has no use for it. Found by
     * the owner cooking No. 190, wondering where the parmesan was meant to go,
     * and adding it himself.
     *
     * Generic tails are stripped before matching, so "Whey Protein" is
     * satisfied by an ingredient line reading "1 scoop vanilla whey" while
     * "Parmesan Cheese" is not satisfied by the word "cheese" — the first pass
     * at this counted twenty-five recipes that were perfectly fine. */
    const unbought = await p.evaluate(() => {
      const GENERIC = /^(protein|powder|seasoning|mix|cheese|sauce|spices?)$/;
      const stem = (w) => w.toLowerCase().replace(/(es|s)$/, '');
      const out = [];
      window.RECIPES.forEach((r) => {
        if (!r.extras) return;
        const hay = ((r.ing || []).join(' ') + ' ' + (r.steps || []).join(' ')).toLowerCase();
        String(r.extras).split(/,|;| and /).map((s) => s.trim()).filter(Boolean).forEach((it) => {
          const words = it.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/)
            .filter((w) => w.length > 3);
          const key = words.filter((w) => !GENERIC.test(w));
          const need = key.length ? key : words;
          if (!need.length) return;
          if (!need.some((w) => hay.indexOf(stem(w)) >= 0)) {
            out.push('no.' + (r.no || r.id) + ' buys ' + it + ' (' + r.name + ')');
          }
        });
      });
      return out;
    });
    t.ok('and nothing it sends you to the shop for goes unmentioned by the method',
      unbought.length === 0, unbought.join('; '));

    /* "Better with a few extras" must stay extra.
     *
     * The owner keeps herbs and spices the storehouse does not carry, and
     * wanted the recipes to say what they would do with them — but only after
     * the recipe is already worth cooking on the order alone, which is the
     * promise the whole book rests on. So a lift is optional by construction:
     * its ingredients are named in the block and nowhere in the ingredient
     * list, which is what keeps them off the shopping list and out of the
     * macros. Put parmesan in `ing` and it becomes a trip to the shop before
     * you can cook dinner — which is exactly the mistake made first here, on
     * the alfredo bake, and undone.
     *
     * Its steps also number on from the method rather than restarting at one,
     * because a cook doing all of it is doing one recipe. */
    const lifts = await p.evaluate(() => {
      const bad = [];
      window.RECIPES.forEach((r) => {
        if (!r.lift) return;
        if (!r.lift.with || !(r.lift.steps || []).length) {
          bad.push('no.' + r.no + ' has a lift with no ingredients or no steps');
          return;
        }
        const ing = (r.ing || []).join(' ').toLowerCase();
        r.lift.with.split(/,| and /).map((w) => w.trim().toLowerCase())
          .filter(Boolean).forEach((w) => {
            const head = w.split(/\s+/).filter((x) => x.length > 3).pop() || w;
            if (ing.indexOf(head) >= 0) {
              bad.push('no.' + r.no + ' lifts with ' + w + ', which is already required');
            }
          });
      });
      return { bad, n: window.RECIPES.filter((r) => r.lift).length };
    });
    t.ok('nothing offered as an optional extra is also a required ingredient',
      lifts.bad.length === 0, lifts.bad.join('; ') + ' (' + lifts.n + ' recipes carry a lift)');

    /* ------------------------------------------------- and the shell says so
     *
     * The landing page's counts are stamped and guarded. index.html's were
     * neither, and it turned out to be saying 271 on a collection of 277 in
     * two places: the meta description, which is what a search result and a
     * texted link quote, and the line under the wordmark, which the app
     * rewrites a moment after load — wrong only for the moment a screenshot
     * gets taken in.
     *
     * Read out of the served markup rather than out of the rendered page, so
     * the one the app corrects at runtime is checked as it arrives. */
    const shell = await p.evaluate(async () => {
      const src = await (await fetch('index.html')).text();
      const grab = (re) => { const m = src.match(re); return m ? Number(m[1]) : null; };
      return {
        real: window.RECIPES.length,
        meta: grab(/<meta name="description" content="[^"]*?\b(\d+) recipes/),
        brand: grab(/<div class="brand-sub">(\d+) recipes/),
      };
    });
    t.ok('the app shell quotes the number of recipes there are',
      shell.meta === shell.real && shell.brand === shell.real,
      JSON.stringify(shell) + ' — run npm run print');

    await p.context().close();
  },
};
