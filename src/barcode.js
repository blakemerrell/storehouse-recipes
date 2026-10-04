/* Reading a barcode from a camera frame, with no library: the bars of one
 * line measured as runs, the runs read as EAN digits with their parity
 * (mDecodeRow), and several lines across the middle of the frame tried in
 * turn, because a barcode is never held straight (mDecodeFrame). The
 * longer account is with the code.
 *
 * A part of app.js (Nourish) in a file of its own. app.js calls
 * HiveParts.barcode(app) once, as it starts, and keeps what it gives back
 * under the same names. The hook the tests read a barcode through
 * (window.__ean) stays in app.js, where it was set. Loaded before app.js.
 */
(window.HiveParts = window.HiveParts || {}).barcode = function (app) {
  'use strict';

  /* ------------------------------------------------------------------------
   * Reading a barcode with the camera.
   *
   * Safari has no barcode reader of its own and is not going to grow one to
   * suit us, so on an iPhone the choice was a decoder from somebody else's
   * CDN or none at all. This app has fetched nothing from another host since
   * it was built — the typefaces and the engravings are all in here — and a
   * hundred and fifty lines is a smaller price than breaking that.
   *
   * EAN-13 and UPC-A, which is EAN-13 with a nought in front. Ninety-five
   * modules: a guard, six digits, a centre guard, six digits, a guard. Each
   * digit is four runs of black and white adding to seven modules, so a digit
   * can be read from the four run-lengths alone without knowing the scale —
   * which is what makes this survive a phone held at arm's length rather than
   * needing the barcode squared up at a fixed distance.
   *
   * The left six carry the first digit in their parity, and the checksum
   * catches what the thresholding gets wrong. A frame that does not decode
   * simply is not one; the next arrives in a sixtieth of a second.
   * --------------------------------------------------------------------- */
  var EAN_L = ['3211', '2221', '2122', '1411', '1132', '1231', '1114', '1312', '1213', '3112'];
  var EAN_PARITY = { '000000': 0, '001011': 1, '001101': 2, '001110': 3, '010011': 4,
    '011001': 5, '011100': 6, '010101': 7, '010110': 8, '011010': 9 };

  function mRuns(row) {
    var mid = 0, i;
    for (i = 0; i < row.length; i++) mid += row[i];
    mid /= row.length;
    var runs = [], cur = row[0] < mid, len = 0;
    for (i = 0; i < row.length; i++) {
      var dark = row[i] < mid;
      if (dark === cur) len++;
      else { runs.push({ dark: cur, len: len }); cur = dark; len = 1; }
    }
    runs.push({ dark: cur, len: len });
    return runs;
  }

  function mDigitAt(runs, i) {
    if (i + 4 > runs.length) return null;
    var total = 0, k;
    for (k = 0; k < 4; k++) total += runs[i + k].len;
    if (total < 4) return null;
    var unit = total / 7, pat = '';
    for (k = 0; k < 4; k++) {
      var m = Math.round(runs[i + k].len / unit);
      if (m < 1 || m > 4) return null;
      pat += m;
    }
    var odd = EAN_L.indexOf(pat);
    if (odd >= 0) return { d: odd, parity: '0' };
    var even = EAN_L.indexOf(pat.split('').reverse().join(''));
    if (even >= 0) return { d: even, parity: '1' };
    return null;
  }

  function mDecodeRuns(runs) {
    for (var s = 0; s + 59 <= runs.length; s++) {
      if (!runs[s].dark) continue;
      if ((runs[s].len + runs[s + 1].len + runs[s + 2].len) / 3 < 0.7) continue;
      var left = [], par = '', i = s + 3, r, n;
      for (n = 0; n < 6; n++) { r = mDigitAt(runs, i); if (!r) break; left.push(r.d); par += r.parity; i += 4; }
      if (left.length !== 6) continue;
      i += 5;                                   // the centre guard, five runs
      var right = [];
      for (n = 0; n < 6; n++) { r = mDigitAt(runs, i); if (!r) break; right.push(r.d); i += 4; }
      if (right.length !== 6 || !(par in EAN_PARITY)) continue;
      var digits = [EAN_PARITY[par]].concat(left, right);
      var sum = 0;
      for (n = 0; n < 12; n++) sum += digits[n] * (n % 2 ? 3 : 1);
      if ((10 - (sum % 10)) % 10 !== digits[12]) continue;   // the checksum decides
      return digits.join('');
    }
    return null;
  }

  function mDecodeRow(row) {
    return mDecodeRuns(mRuns(row)) ||
      mDecodeRuns(mRuns(Array.prototype.slice.call(row).reverse()));
  }

  /* Several lines across the middle of the frame, because a barcode is never
     quite level and one of them will cross it cleanly. */
  function mDecodeFrame(img, w, h) {
    for (var f = 0.35; f <= 0.66; f += 0.06) {
      var y = Math.floor(h * f), row = [], x;
      for (x = 0; x < w; x++) {
        var o = (y * w + x) * 4;
        row.push((img[o] * 299 + img[o + 1] * 587 + img[o + 2] * 114) / 1000);
      }
      var got = mDecodeRow(row);
      if (got) return got;
    }
    return null;
  }

  return { mDecodeRow: mDecodeRow, mDecodeFrame: mDecodeFrame };
};
