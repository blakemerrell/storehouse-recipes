/* SETUP.md's rules are firestore.rules without the comments, and nothing else.
 *
 * Somebody setting up their own copy pastes that block into the Firebase
 * console. On 4 October it was a hand copy from before the rules learned the
 * difference between an account and an anonymous visitor, while saying it was
 * the same as the file. No browser: it reads two files. When it fails, run
 * `node tools/setup-rules.js`. */
const fs = require('fs');
const { stripped, block, RULES, SETUP } = require('../tools/setup-rules.js');

module.exports = {
  name: 'The rules SETUP.md hands out',
  async run(t) {
    const want = stripped(fs.readFileSync(RULES, 'utf8'));
    const got = block(fs.readFileSync(SETUP, 'utf8')).body;
    const a = want.split('\n'), b = got.split('\n');
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    t.ok('are firestore.rules without its comments, line for line', want === got,
      'first difference at line ' + (i + 1) + ': rules "' + (a[i] || '') + '" / SETUP "' + (b[i] || '') + '" (node tools/setup-rules.js rewrites it)');
    t.ok('and keep what tells an account from an anonymous visitor', /function named\(\)/.test(got), '');
  },
};
