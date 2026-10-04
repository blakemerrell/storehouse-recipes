/* Every name a script of ours reads is declared in that script, or is the
 * browser's.
 *
 * app.js is being split into files of its own, a part at a time, and the way
 * a split goes wrong is quiet: a function moved out still calls one it left
 * behind, or app.js still calls one that moved, and nothing says so until
 * that line runs — on a phone, as a ReferenceError, on whatever path the
 * suite happened not to walk. So each script loaded by index.html is read
 * (acorn, no browser) and every name it reads that it never declares is
 * listed; anything not the browser's is a name a split left dangling.
 *
 * The scopes: var and function declarations hoist to their function, let,
 * const and class are counted the same way (a looser rule, which can only
 * ever miss a dangling name, never invent one), parameters and a named
 * function expression's own name are its own, a catch binding is the catch
 * block's. A property read (a.b) and an object key ({ b: 1 }) are not names. */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const ROOT = path.join(__dirname, '..');

/* The browser's, and the language's: what a script may read without
   declaring it. Anything of ours goes through window. */
const BROWSER = new Set(('Array Blob Boolean Date Error FileReader Infinity JSON Math Number Object Promise RegExp ' +
  'String URL URLSearchParams Uint32Array addEventListener cancelAnimationFrame clearInterval clearTimeout console ' +
  'document encodeURIComponent fetch getComputedStyle history isFinite isNaN localStorage location navigator ' +
  'parseFloat parseInt performance requestAnimationFrame setInterval setTimeout undefined window').split(' '));

function undeclared(code) {
  const ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'script', locations: true });
  const found = new Map();
  const declare = (p, scope) => {
    if (!p) return;
    if (p.type === 'Identifier') scope.add(p.name);
    else if (p.type === 'ObjectPattern') p.properties.forEach((q) => declare(q.type === 'RestElement' ? q.argument : q.value, scope));
    else if (p.type === 'ArrayPattern') p.elements.forEach((e) => declare(e, scope));
    else if (p.type === 'RestElement') declare(p.argument, scope);
    else if (p.type === 'AssignmentPattern') declare(p.left, scope);
  };
  // what a function body declares, not looking into the functions inside it
  const hoist = (node, scope) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach((n) => hoist(n, scope)); return; }
    if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') { scope.add(node.id.name); return; }
    if (/^(FunctionExpression|ArrowFunctionExpression|ClassExpression)$/.test(node.type)) return;
    if (node.type === 'VariableDeclaration') node.declarations.forEach((d) => declare(d.id, scope));
    for (const k in node) if (k !== 'loc' && node[k] && typeof node[k] === 'object') hoist(node[k], scope);
  };
  const scopeOf = (parent) => { const s = new Set(); s.parent = parent; return s; };
  const known = (s, n) => { for (let c = s; c; c = c.parent) if (c.has(n)) return true; return false; };
  const walk = (node, scope, parent, key) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach((n) => walk(n, scope, parent, key)); return; }
    if (/^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(node.type)) {
      const s = scopeOf(scope);
      if (node.type === 'FunctionExpression' && node.id) s.add(node.id.name);
      node.params.forEach((p) => declare(p, s));
      s.add('arguments');
      hoist(node.body, s);
      node.params.forEach((p) => { if (p.type === 'AssignmentPattern') walk(p.right, s, p, 'right'); });
      walk(node.body, s, node, 'body');
      return;
    }
    if (node.type === 'CatchClause') { const s = scopeOf(scope); declare(node.param, s); walk(node.body, s, node, 'body'); return; }
    if (node.type === 'Identifier') {
      if (parent && parent.type === 'MemberExpression' && key === 'property' && !parent.computed) return;
      if (parent && (parent.type === 'Property' || parent.type === 'MethodDefinition') && key === 'key' && !parent.computed) return;
      if (parent && /^(LabeledStatement|BreakStatement|ContinueStatement)$/.test(parent.type)) return;
      if (!known(scope, node.name) && !found.has(node.name)) found.set(node.name, node.loc.start.line);
      return;
    }
    for (const k in node) if (k !== 'loc' && node[k] && typeof node[k] === 'object') walk(node[k], scope, node, k);
  };
  const top = scopeOf(null);
  hoist(ast.body, top);
  walk(ast.body, top, ast, 'body');
  return found;
}

// the code alone: every comment blanked, so "app.js" in one is not a read of app
function code(text) {
  const cuts = [];
  acorn.parse(text, { ecmaVersion: 2022, sourceType: 'script', onComment: (block, t, start, end) => cuts.push([start, end]) });
  let out = '', at = 0;
  cuts.forEach(([a, b]) => { out += text.slice(at, a) + ' '.repeat(b - a); at = b; });
  return out + text.slice(at);
}

module.exports = {
  name: 'Every name a script reads is declared',
  async run(t) {
    /* The reader itself: a name left behind is found, and nothing declared is. */
    const probe = undeclared('(function () { var a = 1; function f(x, y) { try { g(x); } catch (e) { return e + a + y; } } ' +
      'var o = { k: f, m: function h() { return h; } }; o.k.q = left(o.k); })();');
    t.ok('the reader finds a name called and never declared, and only those', [...probe.keys()].sort().join() === 'g,left',
      [...probe.keys()].join());

    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const ours = [...html.matchAll(/<script src="(src\/[^"?]+\.js)/g)].map((m) => m[1]);
    t.ok('index.html loads ' + ours.length + ' scripts of ours, app.js among them', ours.length >= 8 && ours.indexOf('src/app.js') >= 0, ours.join(' '));
    ours.forEach((f) => {
      const u = undeclared(fs.readFileSync(path.join(ROOT, f), 'utf8'));
      const left = [...u].filter(([n]) => !BROWSER.has(n)).map(([n, line]) => n + ' (line ' + line + ')');
      t.ok(f + ': every name it reads is its own or the browser’s', left.length === 0, left.join(', '));
    });

    /* A part of app.js reads what app.js hands it (app.x), and a name app.js
       did not hand over is undefined, which no reading of scopes can see. So
       each part's app.x is held to the keys of the object app.js calls it
       with, and every part app.js calls is a file index.html loads. The calls
       are found by parsing app.js, not by searching it. */
    const app = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
    const appAst = acorn.parse(app, { ecmaVersion: 2022, sourceType: 'script' });
    const calls = [], lives = [];
    (function find(n) {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(find); return; }
      const c = n.type === 'CallExpression' && n.callee;
      if (c && c.type === 'MemberExpression' && c.object.type === 'MemberExpression' && c.object.object.name === 'window' &&
          c.object.property.name === 'HiveParts' && n.arguments[0] && n.arguments[0].type === 'ObjectExpression') {
        calls.push([c.property.name, n.arguments[0].properties.map((p) => p.key.name || p.key.value)]);
      }
      // the LIVE object: a getter (and a setter) for each name the app replaces as it goes
      if (c && c.type === 'MemberExpression' && c.object.type === 'MemberExpression' && c.object.object.name === 'window' &&
          c.object.property.name === 'HiveParts' && n.arguments[0] && n.arguments[0].type === 'ObjectExpression') {
        calls[calls.length - 1].push(n.start, n.arguments[0].properties.filter((p) => p.value.type === 'Identifier').map((p) => p.value.name));
      }
      if (n.type === 'VariableDeclarator' && n.id.name === 'LIVE' && n.init && n.init.type === 'ObjectExpression') {
        n.init.properties.forEach((p) => lives.push((p.kind === 'set' ? 'set ' : 'get ') + (p.key.name || p.key.value)));
      }
      for (const k in n) if (n[k] && typeof n[k] === 'object') find(n[k]);
    })(appAst);
    t.ok('app.js calls ' + calls.length + ' parts', calls.length >= 3, calls.map((c) => c[0]).join(' '));
    /* A part keeps what it is handed, so a variable handed over before app.js
       has given it its value is undefined in the part for good. Every var
       handed by name must be declared above the call; one declared below
       goes through LIVE instead, which is read when it is used. */
    const varAt = {};
    appAst.body[0].expression.callee.body.body.forEach((st) => {
      if (st.type === 'VariableDeclaration') st.declarations.forEach((d) => { varAt[d.id.name] = st.start; });
    });
    calls.forEach(([part, , at, handed]) => {
      const early = (handed || []).filter((v) => varAt[v] !== undefined && varAt[v] > at);
      t.ok('HiveParts.' + part + ' is handed no variable app.js has not yet given its value', early.length === 0,
        'declared below the call: ' + early.join(', '));
    });
    calls.forEach(([part, keys]) => {
      const given = new Set(keys);
      const file = ours.find((f) => new RegExp('\\.' + part + ' = function \\(app\\)').test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
      const text = file ? code(fs.readFileSync(path.join(ROOT, file), 'utf8')) : '';
      const read = [...new Set([...text.matchAll(/\bapp\.(\w+)/g)].map((m) => m[1]))];
      const missing = read.filter((n) => !given.has(n));
      t.ok('HiveParts.' + part + ' is a file index.html loads (' + file + '), and app.js hands it all ' + read.length + ' of the app’s it reads',
        !!file && read.length > 0 && missing.length === 0, file ? 'not handed over: ' + missing.join(', ') : 'no file defines HiveParts.' + part);
      /* And what it reads and writes through LIVE, each a getter there, and a
         setter for each it writes: a name with no getter reads undefined, and
         a write with no setter is lost without a word. */
      const usedLive = [...new Set([...text.matchAll(/\bLIVE\.(\w+)/g)].map((m) => m[1]))];
      if (!usedLive.length) return;
      const written = [...new Set([...text.matchAll(/\bLIVE\.(\w+)\s*(?:[-+*\/%&|^]?=(?!=)|\+\+|--)/g), ...text.matchAll(/(?:\+\+|--)\s*LIVE\.(\w+)/g)].map((m) => m[1]))];
      const noGet = usedLive.filter((n) => lives.indexOf('get ' + n) < 0), noSet = written.filter((n) => lives.indexOf('set ' + n) < 0);
      t.ok('HiveParts.' + part + ' reads ' + usedLive.length + ' through LIVE and writes ' + written.length + ', each with its getter and setter in app.js',
        given.has('LIVE') && !noGet.length && !noSet.length, 'no getter: ' + noGet.join(', ') + '; no setter: ' + noSet.join(', '));
    });
  },
};
