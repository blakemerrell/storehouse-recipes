/* The camera held over a packet: started and stopped, the native
 * BarcodeDetector where a browser has one and the frame reader where it
 * does not (mScanStart, mScanStop); a code got, from the lens or typed
 * (mScanGot); and the form for a food nobody has heard of (mNewFoodHTML).
 * The longer account is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.camera(app) once, as it starts, and keeps what it gives back
 * under the same names. Whether this visit to the lens is over (mCamDone)
 * stays declared in app.js; the part reaches it, and the lookups kept so
 * far, through LIVE (tests/scope.test.js holds the lists to each other).
 * Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).camera = function (app) {
  'use strict';

  // what it reads of the app's, and (LIVE) what the app replaces as it goes: MLOOKUP, mCamDone, mLookSeq
  var S = app.S;
  var mBarcodeLookup = app.mBarcodeLookup;
  var mDecodeFrame = app.mDecodeFrame;
  var mLookSay = app.mLookSay;
  var mLookupRows = app.mLookupRows;
  var LIVE = app.LIVE;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function $(id) { return document.getElementById(id); }

  /* The camera, held over a packet. Native BarcodeDetector where a browser
     has one, because it is better at this than we are; the decoder above
     where it does not, which is every iPhone. */
  var mCam = null;
  /* Which opening of the lens is the current one, and whether this visit to
     scan has already got its answer.
   *
     The camera is asked for and arrives later — after a permission prompt,
     on a phone, seconds later. Everything that stops it in the meantime used
     to find nothing to stop, because mCam is only set once the stream is in
     hand, and the stream then arrived anyway and ran: on a video element
     already torn out of the page, with a frame loop behind it and the light
     on, until the app was closed. Typing the barcode did it every time
     (drawing scan mode opened the lens, and the typed number stopped it
     before permission came back), and so did leaving scan before answering
     the prompt. Each opening now carries a generation, every stop moves it
     on, and a stream that arrives for a generation that has passed is
     stopped the moment it lands.
   *
     And a scan that has found its barcode is finished. The sheet is drawn
     once in scan mode and left, but only while the video was in it — the
     scan removes the video, so the next redraw from anywhere (a sync
     arriving, a save elsewhere) drew the sheet again, wiped the result being
     read, and opened the lens a second time over the top of any stream
     still live. */
  var mCamGen = 0;

  function mScanStop() {
    mCamGen++;
    if (mCam && mCam.stream) mCam.stream.getTracks().forEach(function (t) { t.stop(); });
    if (mCam && mCam.raf) cancelAnimationFrame(mCam.raf);
    mCam = null;
    var el = $('scanRoot');
    if (el) el.innerHTML = '';
  }

  function mScanStart() {
    var root = $('scanRoot');
    if (!root) return;                  // the sheet moved on before we got here
    mScanStop();                        // one lens at a time, never a second over the first
    LIVE.mCamDone = false;
    var gen = mCamGen;
    root.innerHTML = '<div class="scan-wrap">' +
      '<video id="scanVid" playsinline muted></video>' +
      '<div class="scan-line"></div>' +
      '<div class="scan-say" id="scanSay">Hold the barcode across the line</div>' +
      '<button class="ghost scan-x" data-scan="stop">Stop</button>' +
      '</div>';
    var vid = $('scanVid');
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var det = null;
    if (window.BarcodeDetector) {
      try { det = new window.BarcodeDetector({ formats: ['ean_13', 'upc_a', 'ean_8', 'upc_e'] }); }
      catch (e) { det = null; }
    }
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }
    }).then(function (stream) {
      // asked for by an opening that has since been stopped: let go at once
      if (gen !== mCamGen || !document.body.contains(vid)) {
        stream.getTracks().forEach(function (t) { t.stop(); });
        return;
      }
      mCam = { stream: stream, raf: 0, gen: gen };
      vid.srcObject = stream;
      vid.play();
      var tick = function () {
        if (!mCam || mCam.gen !== gen) return;
        mCam.raf = requestAnimationFrame(tick);
        if (!vid.videoWidth) return;
        var w = Math.min(640, vid.videoWidth);
        var h = Math.round(vid.videoHeight * w / vid.videoWidth);
        canvas.width = w; canvas.height = h;
        ctx.drawImage(vid, 0, 0, w, h);
        var found = null;
        if (det) {
          det.detect(canvas).then(function (list) {
            if (list && list.length) mScanGot(list[0].rawValue);
          }, function () { det = null; });
        } else {
          try { found = mDecodeFrame(ctx.getImageData(0, 0, w, h).data, w, h); }
          catch (e) { found = null; }
          if (found) mScanGot(found);
        }
      };
      tick();
    }, function (err) {
      /* The answer can arrive after the question is gone. Scan opens the lens
         the moment the mode is chosen, so leaving the mode — or the sheet —
         before the permission prompt resolves tears this element out from
         under the reply, and writing to it then threw. */
      var say = $('scanSay');
      if (!say) return;
      say.textContent = err && err.name === 'NotAllowedError'
        ? 'The camera was not allowed. Type the number instead.'
        : 'No camera here. Type the number instead.';
    });
  }

  /* `typed` means a human handed this over rather than a camera frame
     decoding it.
   *
     The mCam guard is here to ignore a late decode arriving after the camera
     has been stopped, which is the only thing that can call this without
     being asked. A barcode typed into the picker is asked for — and it was
     being thrown away by that guard, because nothing had started a camera.
     Worse, it was thrown away even WITH one: the handler renders the scan
     sheet and calls straight through, while mScanStart only sets mCam once
     getUserMedia has resolved, so mCam is still null on the next line. That
     row has not worked since it was added. */
  function mScanGot(code, typed) {
    if (!code || (!typed && !mCam)) return;
    LIVE.mCamDone = true;
    mScanStop();
    if ($('nfFind')) $('nfFind').value = code;
    var res = $('nfResults');
    if (res) res.innerHTML = '<div class="mslot-empty">Looking up ' + esc(code) + '&hellip;</div>';
    LIVE.MLOOKUP = {};
    // the same rule as the food tables: a slow answer to an older question is dropped
    var mine = ++LIVE.mLookSeq;
    mBarcodeLookup(String(code).replace(/\D/g, '')).then(function (list) {
      if (mine !== LIVE.mLookSeq) return;
      if ($('nfResults')) $('nfResults').innerHTML = mLookupRows(list);
    }, function (err) {
      if (mine !== LIVE.mLookSeq) return;
      if ($('nfResults')) {
        $('nfResults').innerHTML = '<div class="mslot-empty">' + esc(mLookSay(err, String(code))) + '</div>';
      }
    });
  }

  function mNewFoodHTML() {
    /* Arriving with the numbers already known — off a barcode or a food
       table — or arriving empty, which is the same form either way. */
    var pre = (S.newFood && S.newFood.pre) || null;
    /* The words on the left are the box's label, for= and all, so the
       numbers are read out as Calories and Protein rather than as four
       unnamed boxes; a tap on the word puts the caret in the box too. */
    var box = function (id, label, unit, ph, v) {
      return '<div class="mtl-row"><label class="mtl-lab" for="' + id + '">' + label + '</label>' +
        '<span class="mtl-val"><input type="number" id="' + id + '" min="0" max="9999" ' +
        'step="1" inputmode="numeric" placeholder="' + (ph || '') + '"' +
        (v || v === 0 ? ' value="' + esc(String(v)) + '"' : '') + '>' +
        (unit ? '<span class="mtl-u">' + unit + '</span>' : '') + '</span></div>';
    };
    return '<div class="scrim no-print" data-close="1">' +
      '<div class="sheet mt-sheet" role="dialog" aria-modal="true" aria-label="Add a food">' +
        '<div class="sheet-top">' +
          '<div class="sheet-eyebrow">' + (pre ? 'How much?' : 'Type it in') + '</div>' +
          '<button class="sheet-x" data-close="1" aria-label="Close">&times;</button>' +
        '</div>' +
        (pre && pre.note
          ? '<div class="mt-cap">From ' + esc(pre.note) + '</div>' : '') +
        '<div class="mtl-row"><span class="mtl-lab">Called</span>' +
          '<span class="mtl-val"><input type="text" id="nfName" ' +
            'placeholder="Chicken tamale" aria-label="What it is called" value="' +
            esc((pre && pre.name) || '') + '"></span></div>' +
        '<div class="mtl-row"><span class="mtl-lab">One of them is</span>' +
          '<span class="mtl-val"><input type="text" id="nfUnit" ' +
            'placeholder="tamale" aria-label="What one of them is called" value="' +
            esc((pre && pre.unit) || '') + '"></span></div>' +
        box('nfKcal', 'Calories', 'kcal', '250', pre && pre.kcal) +
        box('nfP', 'Protein', 'g', '10', pre && pre.p) +
        box('nfF', 'Fat', 'g', '12', pre && pre.f) +
        box('nfC', 'Carbs', 'g', '25', pre && pre.c) +
        '<div class="mt-cap" id="nfNote"></div>' +
        '<div class="sync-row">' +
          '<button class="btn-primary" data-nf="save">Add it to the day</button>' +
          '<button class="ghost" data-nf="cancel">Cancel</button>' +
        '</div>' +
      '</div></div>';
  }

  return { mScanStop: mScanStop, mScanStart: mScanStart, mScanGot: mScanGot, mNewFoodHTML: mNewFoodHTML };
};
