/* Light or dark, decided before the stylesheet draws anything. It was an
   inline script in index.html; it is a file of its own so the page's
   content-security policy can refuse every inline script, which is what
   makes an injected <img onerror> or <script> do nothing. Loaded with no
   async or defer, in the head, so it still runs first. */
/* Light or dark. The phone's own setting, unless this device was told
   otherwise in Sync & sharing → Appearance; the choice is kept on the
   device, not the account, since a phone and a laptop are read in
   different rooms. Decided here, before the stylesheet draws anything, so
   the page never shows the other one first — the dark colours in
   style.css apply to [data-theme="dark"], and this is what sets it. */
(function () {
  var KEY = 'bsc.theme', root = document.documentElement, held = null;
  var sys = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function chosen() {
    var v = held;
    if (v === null) { try { v = localStorage.getItem(KEY); } catch (e) { v = ''; } }
    return v === 'light' || v === 'dark' ? v : '';
  }
  function apply() {
    var c = chosen(), dark = c ? c === 'dark' : !!(sys && sys.matches);
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    // the browser's bar follows the choice too, not only the phone
    var bars = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < bars.length; i++) {
      var m = bars[i];
      if (!m.hasAttribute('data-was')) m.setAttribute('data-was', m.getAttribute('media') || '');
      var own = m.getAttribute('data-was'), isDark = /dark/.test(own);
      m.setAttribute('media', !c ? own : (isDark === dark ? 'all' : 'not all'));
    }
  }
  apply();
  if (sys) {
    if (sys.addEventListener) sys.addEventListener('change', apply);
    else if (sys.addListener) sys.addListener(apply);
  }
  // chosen in another tab of the app on this device
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(); });
  window.Theme = {
    get: chosen,
    set: function (v) {
      v = v === 'light' || v === 'dark' ? v : '';
      try {
        if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY);
        held = null;
      } catch (e) { held = v; /* storage refused: it holds until the page is closed */ }
      apply();
    }
  };
})();
