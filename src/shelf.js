/* The shelf: what this household would have to go out for.
 *
 * Where a food comes from this week (the kitchen, the storehouse, a shop),
 * where it is restocked from when it runs out, what the storehouse carries,
 * and so whether a recipe's ingredient, or a whole recipe, means a trip.
 * One set of answers, read by the recipe sheet, the book, the list, the
 * filters and the pantry pages alike.
 *
 * Out of app.js, whole: it reads window.PANTRY and window.Store and nothing
 * of the app's own, and app.js keeps calling these under the same names.
 * Loaded before app.js.
 */
window.Shelf = (function () {
  'use strict';

  /* ---- what this household would have to go out for -----------------------
     Every ingredient carries x:1 when the storehouse did not stock it, and
     that answer is baked into the books. It is a fact about a shop, though,
     and the useful question in a kitchen is whether you have the thing in. So
     the flag becomes a default and the pantry answers over the top of it: keep
     the storehouse list untouched and nothing changes, tick things off it and
     the recipes follow you.

     free is a line with no weight, water is not shopping, and neither belongs
     on a list of what to buy. */
  /* Where a food comes from this week: 'h' in the kitchen already, 's' the
     storehouse, 'b' bought. Blake: "I should just be able to tell it what I
     have in my pantry, whether I pick it up from the storehouse or not." The
     kitchen answers first; then, while the household shops the storehouse,
     the storehouse order (with any line moved by hand); then the shop. */
  function foodSource(key) {
    var d = (window.PANTRY || {})[key];
    if (!d) return inPantry(key) ? 'h' : 'b';
    var k = window.Store.kitchen(key);
    if (k === 1) return 'h';
    /* A dried spice is in the cupboard unless somebody said it is not, here
       or on the storehouse list. */
    if (k === undefined && d.sp && window.Store.pantryHas(key, true)) return 'h';
    return restockSource(key);
  }
  /* Where a food comes from when the kitchen is out of it: the storehouse,
     while the household shops it and it carries it (or a line was moved
     there by hand), otherwise the shop. The one rule the list, the "ran out"
     lines and the On hand dots all read. */
  function restockSource(key) {
    if (!window.Store.opt('store', true)) return 'b';
    var sv = window.Store.src(key);
    if (sv) return sv;
    var d = (window.PANTRY || {})[key];
    return window.Store.pantryHas(key, !!(d && d.s)) ? 's' : 'b';
  }
  /* What the storehouse carries, which is what the Pantry's storehouse list
     edits: the order, as the household has changed it. */
  function storeCarries(key) {
    var d = (window.PANTRY || {})[key];
    return window.Store.pantryHas(key, d ? (d.s || !!d.sp) : true);
  }
  function inPantry(key) {
    var d = (window.PANTRY || {})[key];
    if (d) return foodSource(key) !== 'b';
    /* A key the pantry has never heard of defaults to kept, not to missing.
       Seasonings all share the "free" food key and go by their own name, so
       they are not in the pantry at all — defaulting those to missing put salt
       and vanilla on the shopping list under "to pick up", which is both wrong
       and exactly what the old flag never did. */
    /* A dried spice defaults to kept (d.sp): not on the order, but not a
       shopping trip either. Your own pantry still overrides it. */
    return window.Store.pantryHas(key, d ? (d.s || !!d.sp) : true);
  }

  /* Would you have to go out for this one parsed ingredient?
   *
   * One answer, asked in two places: the foot of a recipe lists what to buy,
   * and the ingredient lines themselves are marked. Those used to be two
   * separate pieces of reasoning, and they disagreed — the foot named paprika
   * while the line sat in the same colour as the flour above it, because the
   * foot had been taught about flagged seasonings and the line had not. Two
   * rules for one question will drift again, so there is one.
   *
   * A `free` line is a seasoning priced at nothing. Most are the salt and
   * pepper and cinnamon the storehouse carries and are rightly silent; `x`
   * marks the ones it does not. */
  function itemNeedsBuying(it) {
    if (!it || !it.k) return false;
    if (it.o) return false;            // "(optional)" on the line      // a line the food table could not place
    if (it.k === 'free') return !!it.x;
    return it.k !== 'water' && !inPantry(it.k);
  }

  /* The editor's "Needs beyond the staples", which is what the books' own
     field means too (tools/build-data.js: what you must buy to cook it at
     all). Typed in, it was shown nowhere. nutritionFor reads the names only
     to mark the ingredient lines they appear in — never for the calories —
     so a name in no line went nowhere: buttermilk named and not listed,
     nutmeg on a line the food table could not place. Those are said on the
     sheet. A name a placed line answers for is the shelf's to say, above,
     and so is a food the pantry knows by that name and you keep. */
  function alsoNeeds(r) {
    var P = window.PANTRY || {}, own = window.Store.pantryOwn() || {};
    // whole words: buttermilk is not the milk line, Stevia/Sweetener is the sweetener one
    var has = function (hay, w) {
      return !!w && new RegExp('(^|[^a-z])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)').test(hay);
    };
    var named = function (map, l) { return Object.keys(map).filter(function (k) { return has(String(map[k].l || '').toLowerCase(), l); })[0]; };
    return String(r.extras || '').split(',').map(function (x) { return x.trim(); }).filter(function (n) {
      var l = n.toLowerCase();
      if (!l) return false;
      var placed = (r.ing || []).some(function (line, i) {
        var it = (r.ingp || [])[i], lab = it && it.k ? String((P[it.k] || {}).l || it.a || '').toLowerCase() : '';
        return !!(it && it.k) && (has(String(line).toLowerCase(), l) || has(lab, l) || has(l, lab));
      });
      var key = named(P, l) || named(own, l);
      return !placed && !(key && inPantry(key));
    });
  }

  function missingFor(r) {
    var out = [], seen = {};
    (r.ingp || []).forEach(function (it) {
      if (!itemNeedsBuying(it)) return;
      if (it.k === 'free') {
        var extra = it.a || 'a seasoning';
        if (!seen[extra]) { seen[extra] = 1; out.push(extra); }
        return;
      }
      if (it.k === 'water' || inPantry(it.k)) return;
      var d = (window.PANTRY || {})[it.k];
      var label = d ? d.l : (it.a || String(it.k).replace(/_/g, ' '));
      if (!seen[label]) { seen[label] = 1; out.push(label); }
    });
    return out;
  }

  /* Whether a written ingredient line is something you would have to go out
     for. ingp runs parallel to ing, so line i asks about food i. */
  function lineNeedsBuying(r, ix) {
    return itemNeedsBuying((r.ingp || [])[ix]);
  }

  return { foodSource: foodSource, restockSource: restockSource, storeCarries: storeCarries, inPantry: inPantry,
    itemNeedsBuying: itemNeedsBuying, alsoNeeds: alsoNeeds, missingFor: missingFor, lineNeedsBuying: lineNeedsBuying };
})();
