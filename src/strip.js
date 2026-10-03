/* The top of the page, held still: the header's height for everything that
 * pins under it (syncStick), and on Recipes the search row whose Filters
 * button appears once the filter bar has scrolled up under it, and unfolds
 * that same bar in place (filtCount, syncStrip, onScrollStrip, filtersPop).
 *
 * A part of app.js in a file of its own. app.js calls HiveParts.strip(app)
 * once, as it starts, handing over the one thing of its own it reads, the
 * app's state S, and keeps the five under their own names for the scroll,
 * resize and click handlers there. Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).strip = function (app) {
  'use strict';

  // what it reads of the app's
  var S = app.S;

  function $(id) { return document.getElementById(id); }

  function syncStick() {
    var tb = document.querySelector('.topbar');
    if (!tb) return;
    /* Hidden, as it is while a workout runs full screen, it measures
       nothing, and nothing is what every view would then pin to. */
    var h = Math.round(tb.getBoundingClientRect().height);
    if (h) document.documentElement.style.setProperty('--topbar-h', h + 'px');
  }

  /* ---- The search row on Recipes ----

     One box, pinned under the header from the top of the page. What comes
     and goes is the Filters button beside it: once the filter bar below has
     scrolled up under the row, the button appears and unfolds the real bar
     in place. Nothing is measured but where the bar is. */
  var stripRaf = 0;
  function filtCount() {
    var n = 0;
    if (S.bookF !== 'all') n++;
    if (S.secF !== 'all') n++;
    if (S.diffF !== 'all') n++;
    if (S.pantryF !== 'all') n++;
    if (S.sort !== 'book') n++;
    if (S.favOnly) n++;
    return n;
  }
  function syncStrip() {
    stripRaf = 0;
    var st = $('brwStrip'), sec = $('view-browse');
    var bar = document.querySelector('#view-browse .filters');
    if (!st || !sec || !bar) return;
    /* Unfolded, the bar is a fixed panel and its edges say nothing about
       the page; a redraw under it — picking a filter — must not read it as
       "scrolled back to the top" and fold it away mid-choice. */
    if (bar.classList.contains('pop') && S.view === 'browse') return;
    var on = S.view === 'browse' &&
      bar.getBoundingClientRect().bottom <= st.getBoundingClientRect().bottom + 1;
    if (on === sec.classList.contains('stripped')) return;
    sec.classList.toggle('stripped', on);
    /* Fold the bar away with the button that opened it; a fixed panel over a
       page that has scrolled back to its own copy of the same controls is
       the one arrangement that would confuse. */
    if (!on) filtersPop(false);
  }
  function onScrollStrip() {
    if (stripRaf) return;
    stripRaf = requestAnimationFrame(syncStrip);
  }
  /* The real filter bar, unfolded under the header. Same element, so every
     control keeps its wiring and its state; only where it sits changes. */
  function filtersPop(open) {
    if (open === S.filtPop) return;
    S.filtPop = open;
    document.querySelector('#view-browse .filters').classList.toggle('pop', open);
    $('brwScrim').classList.toggle('hide', !open);
    $('filtBtn').setAttribute('aria-expanded', String(open));
  }

  return { syncStick: syncStick, filtCount: filtCount, syncStrip: syncStrip, onScrollStrip: onScrollStrip, filtersPop: filtersPop };
};
