/*
 * Moves a run of app.js's top-level code into a part of its own:
 * src/<name>.js, (window.HiveParts).<name> = function (app) { ... }.
 *
 *   node tools/split-part.js <name> <VAR> "<first line of the range>" "<first line after it>" <header.txt> [--dry]
 *
 * It parses app.js (acorn) rather than searching it, and works out:
 *   - what the range reads of the app's that the app never replaces: handed
 *     over by name, app.js calling HiveParts.<name>({ x: x, ... }) once;
 *   - what the app replaces as it goes (any name assigned after it is
 *     declared), or has not yet given a value when the part is made (a var
 *     declared below the call): read and written through app.js's LIVE
 *     object, a getter for each and a setter for each the part writes, the
 *     moved code saying LIVE.x;
 *   - what the rest of app.js reads of the range: functions are given back
 *     and kept under their old names as one-line declarations, with each
 *     function's own parameters; constants (never reassigned) are given back
 *     and declared again from the part; a var the range declares that is
 *     reassigned and read outside stays declared in app.js, in LIVE;
 *   - a statement in the range that declares nothing (a listener added as
 *     the file loads) stays in app.js after the call, at the same point in
 *     the start-up.
 *
 * --dry prints that analysis and writes nothing. Without it, it writes the
 * part and edits app.js; index.html, sw.js and the README are yours to add
 * the file to. Then tests/scope.test.js (every name declared; what a part
 * reads handed over; LIVE's getters and setters; nothing handed over before
 * it has a value) and the suite are the check. Read the diff.
 */
const fs = require('fs'); const acorn = require('acorn');
const args = process.argv.slice(2), dry = args.includes('--dry');
const [name, VAR, m1, m2, headerFile] = args.filter((a) => a !== '--dry');
let src = fs.readFileSync('src/app.js', 'utf8');
const A = src.indexOf(m1), B = src.indexOf(m2, A + 1);
if (A < 0 || B < 0) throw new Error('marker not found');
const ast = acorn.parse(src, { ecmaVersion: 2022 });
const iife = ast.body[0].expression.callee.body.body;
const declOf = (st) => st.type === 'FunctionDeclaration' ? [st.id.name] : st.type === 'VariableDeclaration' ? st.declarations.map((d) => d.id.name) : [];
const inR = (n) => n.start >= A && n.start < B;
/* A statement in the range that declares nothing (a listener added as the
   file loads, a call made once) stays in app.js, after the stub, where it
   runs at the same point in the start-up as before, calling the part through
   the declarations left under the old names. */
const kept = iife.filter((st) => inR(st) && !declOf(st).length);
const inside = iife.filter((st) => inR(st) && declOf(st).length), outside = iife.filter((st) => !inR(st) || !declOf(st).length);
const top = new Set(); iife.forEach((st) => declOf(st).forEach((n) => top.add(n)));
const mine = new Set(); inside.forEach((st) => declOf(st).forEach((n) => mine.add(n)));
// scope walk that reports free identifier nodes (reads and writes) relative to a set of statements
function freeRefs(stmts, declared) {
  const out = [];
  const declare = (p, s) => { if (!p) return; if (p.type === 'Identifier') s.add(p.name); else if (p.type === 'AssignmentPattern') declare(p.left, s); else if (p.type === 'RestElement') declare(p.argument, s); else if (p.type === 'ObjectPattern') p.properties.forEach((q) => declare(q.value || q.argument, s)); else if (p.type === 'ArrayPattern') p.elements.forEach((e) => declare(e, s)); };
  const hoist = (n, s) => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) { n.forEach((x) => hoist(x, s)); return; } if (n.type === 'FunctionDeclaration') { s.add(n.id.name); return; } if (/^(FunctionExpression|ArrowFunctionExpression)$/.test(n.type)) return; if (n.type === 'VariableDeclaration') n.declarations.forEach((d) => declare(d.id, s)); for (const k in n) if (n[k] && typeof n[k] === 'object') hoist(n[k], s); };
  const sc = (p) => { const s = new Set(); s.parent = p; return s; };
  const known = (s, n) => { for (let c = s; c; c = c.parent) if (c.has(n)) return true; return false; };
  const walk = (n, s, par, key) => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) { n.forEach((x) => walk(x, s, par, key)); return; }
    if (/^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(n.type)) { const f = sc(s); if (n.type === 'FunctionExpression' && n.id) f.add(n.id.name); n.params.forEach((p) => declare(p, f)); f.add('arguments'); hoist(n.body, f); walk(n.body, f, n, 'body'); return; }
    if (n.type === 'CatchClause') { const c = sc(s); declare(n.param, c); walk(n.body, c, n, 'body'); return; }
    if (n.type === 'VariableDeclarator') { walk(n.init, s, n, 'init'); return; }   // the declared name itself is not a reference
    if (n.type === 'Identifier') { if (par && par.type === 'MemberExpression' && key === 'property' && !par.computed) return; if (par && par.type === 'Property' && key === 'key' && !par.computed) return; if (par && /^(LabeledStatement|BreakStatement|ContinueStatement)$/.test(par.type)) return; if (!known(s, n.name)) out.push({ node: n, write: !!(par && ((par.type === 'AssignmentExpression' && key === 'left') || par.type === 'UpdateExpression')) }); return; }
    for (const k in n) if (n[k] && typeof n[k] === 'object') walk(n[k], s, n, k); };
  const s0 = sc(null); declared.forEach((d) => s0.add(d)); walk(stmts, s0, null, null); return out;
}
// every assignment anywhere in the IIFE, to app-level names (free at their site)
const allRefs = freeRefs(iife, []);
const reassigned = new Set(allRefs.filter((r) => r.write).map((r) => r.node.name));
// declarator initialisers count as the declaration, not a reassignment; a var with a later write is reassigned
const insideRefs = freeRefs(inside, []), outsideRefs = freeRefs(outside, []);
const readOutside = new Set(outsideRefs.map((r) => r.node.name).filter((n) => mine.has(n)));
// the range's own vars
const ownVars = []; inside.forEach((st) => { if (st.type === 'VariableDeclaration') st.declarations.forEach((d) => ownVars.push({ d, st })); });
const stay = ownVars.filter(({ d }) => readOutside.has(d.id.name) && reassigned.has(d.id.name)).map(({ d }) => d.id.name);
const constOut = ownVars.filter(({ d }) => readOutside.has(d.id.name) && !reassigned.has(d.id.name)).map(({ d }) => d.id.name);
const SHARED = new Set(['$', 'esc']);
// imports: app-level names the range reads/writes that it does not declare (or that stay in app.js)
const appRefs = insideRefs.filter((r) => top.has(r.node.name) && (!mine.has(r.node.name) || stay.includes(r.node.name)) && !SHARED.has(r.node.name));
// a var declared below the call is not yet assigned when the part is made: it goes through LIVE too
const declAt = {}; iife.forEach((st) => { if (st.type === 'VariableDeclaration') st.declarations.forEach((d) => { declAt[d.id.name] = st.start; }); });
const late = (n) => declAt[n] !== undefined && declAt[n] >= A && !stay.includes(n);
const isLive = (n) => reassigned.has(n) || late(n);
const live = [...new Set(appRefs.filter((r) => isLive(r.node.name)).map((r) => r.node.name))].sort();
const imports = [...new Set(appRefs.filter((r) => !isLive(r.node.name)).map((r) => r.node.name))].sort();
const usesShared = [...new Set(insideRefs.filter((r) => SHARED.has(r.node.name) && top.has(r.node.name)).map((r) => r.node.name))];
const writesImport = appRefs.filter((r) => r.write && !isLive(r.node.name));
if (writesImport.length) throw new Error('writes to non-reassigned imports?? ' + writesImport.map((r) => r.node.name).join());
// a function declared in the range and assigned outside? refuse
const fnNames = inside.filter((st) => st.type === 'FunctionDeclaration').map((st) => st.id.name);
const fnReassigned = fnNames.filter((n) => reassigned.has(n));
if (fnReassigned.length) throw new Error('functions reassigned somewhere: ' + fnReassigned.join());
// own non-staying vars that are reassigned only inside are fine (they move)
const exportFns = inside.filter((st) => st.type === 'FunctionDeclaration' && readOutside.has(st.id.name));
console.log(JSON.stringify({ name, lines: src.slice(A, B).split('\n').length, imports, live, stay, constOut, gives: exportFns.map((f) => f.id.name), usesShared, keptStatements: kept.map((st) => src.slice(st.start, Math.min(st.end, st.start + 60)).replace(/\n/g, ' ')) }, null, 1));
if (dry) process.exit(0);
// build the moved text: drop the staying declarators, rewrite live references to LIVE.x
let body = src.slice(A, B);
const edits = [];
insideRefs.filter((r) => live.includes(r.node.name)).forEach((r) => edits.push({ s: r.node.start, e: r.node.end, t: 'LIVE.' + r.node.name }));
// staying vars: remove their declarators from the moved code (whole statement when all its declarators stay)
const stayDecls = [];
inside.forEach((st) => {
  if (st.type !== 'VariableDeclaration') return;
  const st8 = st.declarations.filter((d) => stay.includes(d.id.name));
  if (!st8.length) return;
  if (st8.length !== st.declarations.length) throw new Error('mixed var statement with staying names: ' + st.declarations.map((d) => d.id.name).join());
  stayDecls.push(src.slice(st.start, st.end));
  // also rewrite references inside the initialisers? initialisers stay in app.js, unchanged
  edits.push({ s: st.start, e: st.end, t: '' , whole: true });
});
kept.forEach((st) => edits.push({ s: st.start, e: st.end, t: '', whole: true }));
// drop edits that fall inside removed statements
const removed = edits.filter((x) => x.whole);
const keptEdits = edits.filter((x) => x.whole || !removed.some((w) => x.s >= w.s && x.e <= w.e));
keptEdits.sort((x, y) => y.s - x.s).forEach((x) => { body = body.slice(0, x.s - A) + x.t + body.slice(x.e - A); });
body = body.replace(/\n[ \t]*\n[ \t]*\n/g, '\n\n');
const header = fs.readFileSync(headerFile, 'utf8').trimEnd();
const own = [];
if (usesShared.includes('esc')) own.push(`  function esc(s) {\n    return String(s == null ? '' : s)\n      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')\n      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');\n  }`);
if (usesShared.includes('$')) own.push(`  function $(id) { return document.getElementById(id); }`);
const gives = exportFns.map((f) => f.id.name).concat(constOut);
const part = `${header}
(window.HiveParts = window.HiveParts || {}).${name} = function (app) {
  'use strict';

  // what it reads of the app's${live.length ? ', and (LIVE) what the app replaces as it goes: ' + live.join(', ') : ''}
${imports.map((n) => `  var ${n} = app.${n};`).join('\n')}${live.length ? '\n  var LIVE = app.LIVE;' : ''}
${own.length ? '\n' + own.join('\n') + '\n' : ''}
${body.replace(/^\n+/, '').replace(/\n+$/, '\n')}
  return { ${gives.map((n) => `${n}: ${n}`).join(', ')} };
};
`;
fs.writeFileSync(`src/${name}.js`, part);
const params = (f) => f.params.map((p) => src.slice(p.start, p.end)).join(', ');
const handed = imports.map((n) => `${n}: ${n}`).concat(live.length ? ['LIVE: LIVE'] : []);
const stub = `  /* src/${name}.js, handed what it reads of the app's and kept under its own
     names here, as declarations, so they answer from anywhere in this file. */
${stayDecls.map((d) => '  ' + d).join('\n')}${stayDecls.length ? '\n' : ''}  var ${VAR} = window.HiveParts.${name}({ ${handed.join(', ')} });
${exportFns.map((f) => `  function ${f.id.name}(${params(f)}) { return ${VAR}.${f.id.name}(${params(f)}); }`).join('\n')}
${constOut.map((n) => `  var ${n} = ${VAR}.${n};`).join('\n')}
${kept.map((st) => '  ' + src.slice(st.start, st.end)).join('\n')}

`.replace(/\n\n\n/g, '\n\n');
src = src.slice(0, A) + stub + src.slice(B);
// LIVE: add getters and setters for the names this part needs (one object, near the top)
if (live.length) {
  const mark = '  /* What the parts in files of their own (window.HiveParts) read and write\n';
  if (src.indexOf(mark) < 0) {
    const at = src.indexOf('  function recipesNow() {');
    if (at < 0) throw new Error('no anchor for LIVE');
    src = src.slice(0, at) + mark + `     of the app's that the app also replaces as it goes: a getter and a setter
     each, so a part reads the value now and its writes land here. */
  var LIVE = {
  };

` + src.slice(at);
  }
  // find LIVE's object by parsing, never by searching for a brace
  const ast2 = acorn.parse(src, { ecmaVersion: 2022 });
  let obj = null;
  (function f(n) { if (!n || typeof n !== 'object' || obj) return; if (Array.isArray(n)) { n.forEach(f); return; }
    if (n.type === 'VariableDeclarator' && n.id.name === 'LIVE' && n.init && n.init.type === 'ObjectExpression') { obj = n.init; return; }
    for (const k in n) if (n[k] && typeof n[k] === 'object') f(n[k]); })(ast2.body[0].expression.callee.body.body);
  if (!obj) throw new Error('LIVE not found');
  const have = new Set(obj.properties.map((p) => p.kind + ' ' + p.key.name));
  // a getter for each name read through LIVE, and a setter only for the ones the part writes
  const liveWritten = new Set(insideRefs.filter((r) => r.write && live.includes(r.node.name)).map((r) => r.node.name));
  const add = [];
  live.forEach((n) => {
    if (!have.has('get ' + n)) add.push(`    get ${n}() { return ${n}; }`);
    if (liveWritten.has(n) && !have.has('set ' + n)) add.push(`    set ${n}(v) { ${n} = v; }`);
  });
  if (add.length) {
    const closeBrace = obj.end - 1;                       // the object's own }
    const before = src.slice(0, closeBrace).replace(/\s*$/, '');
    const sep = obj.properties.length ? ',\n' : '\n';
    src = before + sep + add.join(',\n') + '\n  ' + src.slice(closeBrace);
  }
}
fs.writeFileSync('src/app.js', src);
console.log('written');
