/* tools/publish-rules.js, against a stand-in for Google.
 *
 * The real thing needs a key to the live project, which no test may hold, so
 * this stands up a small server that answers the way Google's token endpoint
 * and the Firebase Rules API do — and checks what it is sent: a token signed
 * by the key it was given, the rules file exactly as it is in the repository,
 * and Firestore's release pointed at that ruleset and nothing else. Then the
 * ways it has to stop: no key, a key for another project, rules Google will
 * not compile. No page is opened. */

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { execFile } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PROJECT = JSON.parse(fs.readFileSync(path.join(ROOT, '.firebaserc'), 'utf8')).projects.default;
const RULES = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');

function standIn(opts) {
  const seen = [];
  const state = { rulesets: {}, release: opts.noRelease ? null : 'projects/' + PROJECT + '/rulesets/old', n: 0 };
  const srv = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      seen.push({ method: req.method, url: req.url, auth: req.headers.authorization || '', body });
      const send = (code, j) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)); };
      if (req.url === '/token') {
        const q = new URLSearchParams(body), jwt = (q.get('assertion') || '').split('.');
        const claims = JSON.parse(Buffer.from(jwt[1] || '', 'base64url').toString() || '{}');
        const good = jwt.length === 3 && crypto.verify('RSA-SHA256', Buffer.from(jwt[0] + '.' + jwt[1]), opts.publicKey, Buffer.from(jwt[2], 'base64url'));
        state.claims = claims; state.signed = good;
        return good ? send(200, { access_token: 'tok-1', expires_in: 3600 }) : send(400, { error: 'invalid_grant' });
      }
      if (req.headers.authorization !== 'Bearer tok-1') return send(401, { error: { code: 401 } });
      const base = '/v1/projects/' + PROJECT;
      if (req.method === 'POST' && req.url === base + '/rulesets') {
        if (opts.reject) return send(400, { error: { code: 400, message: 'Compilation error', details: [{ issue: 'line 3: unexpected token' }] } });
        const name = 'projects/' + PROJECT + '/rulesets/rs' + (++state.n);
        state.rulesets[name] = JSON.parse(body).source;
        return send(200, { name, source: state.rulesets[name] });
      }
      const rel = '/v1/projects/' + PROJECT + '/releases/cloud.firestore';
      if (req.url === rel && req.method === 'PATCH') {
        if (!state.release) return send(404, { error: { code: 404 } });
        state.release = JSON.parse(body).release.rulesetName;
        return send(200, { name: 'projects/' + PROJECT + '/releases/cloud.firestore', rulesetName: state.release });
      }
      if (req.url === base + '/releases' && req.method === 'POST') {
        state.release = JSON.parse(body).rulesetName; state.created = true;
        return send(200, { name: 'projects/' + PROJECT + '/releases/cloud.firestore', rulesetName: state.release });
      }
      if (req.url === rel && req.method === 'GET') return send(200, { rulesetName: state.release });
      const rs = req.url.replace(/^\/v1\//, '');
      if (req.method === 'GET' && state.rulesets[rs]) return send(200, { name: rs, source: state.rulesets[rs] });
      send(404, { error: { code: 404 } });
    });
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok({ srv, seen, state, port: srv.address().port })));
}

function run(env) {
  return new Promise((ok) => {
    execFile(process.execPath, [path.join(ROOT, 'tools', 'publish-rules.js')], { env: Object.assign({}, process.env, env), timeout: 20000 },
      (err, stdout, stderr) => ok({ code: err ? err.code : 0, out: stdout, err: stderr }));
  });
}

module.exports = {
  name: 'Publishing the security rules',
  async run(t) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    const keyFor = (port, project) => JSON.stringify({ type: 'service_account', project_id: project || PROJECT,
      client_email: 'rules-publisher@' + PROJECT + '.iam.gserviceaccount.com', private_key: pem, token_uri: 'http://127.0.0.1:' + port + '/token' });

    // the way it is meant to go
    let g = await standIn({ publicKey });
    let r = await run({ FIREBASE_RULES_KEY: keyFor(g.port), RULES_API: 'http://127.0.0.1:' + g.port + '/v1' });
    const made = Object.values(g.state.rulesets)[0];
    t.ok('with a key, it publishes and says so', r.code === 0 && /^Published firestore\.rules \(sha256 [0-9a-f]{12}\) to /.test(r.out), JSON.stringify(r));
    t.ok('the token is asked for with a JWT signed by that key, for that account and the token address',
      g.state.signed && g.state.claims.iss === 'rules-publisher@' + PROJECT + '.iam.gserviceaccount.com' &&
        g.state.claims.aud === 'http://127.0.0.1:' + g.port + '/token' && g.state.claims.exp - g.state.claims.iat <= 3600, JSON.stringify(g.state.claims));
    t.ok('the ruleset is firestore.rules exactly, as one file', !!made && made.files.length === 1 && made.files[0].name === 'firestore.rules' && made.files[0].content === RULES,
      made ? made.files.map((f) => f.name + ':' + f.content.length).join() : 'none');
    t.ok('and Firestore\'s release now points at it', g.state.release === 'projects/' + PROJECT + '/rulesets/rs1', g.state.release);
    t.ok('every call to the API carries the token', g.seen.filter((s) => s.url !== '/token').every((s) => s.auth === 'Bearer tok-1'), g.seen.map((s) => s.method + ' ' + s.url).join(' | '));
    g.srv.close();

    // a project with no release yet: it is made, not patched
    g = await standIn({ publicKey, noRelease: true });
    r = await run({ FIREBASE_RULES_KEY: keyFor(g.port), RULES_API: 'http://127.0.0.1:' + g.port + '/v1' });
    t.ok('with no release yet, it makes one pointing at the new ruleset', r.code === 0 && g.state.created && g.state.release === 'projects/' + PROJECT + '/rulesets/rs1', JSON.stringify({ r, s: g.state.release }));
    g.srv.close();

    // the ways it must stop, publishing nothing
    g = await standIn({ publicKey });
    r = await run({ FIREBASE_RULES_KEY: '', RULES_API: 'http://127.0.0.1:' + g.port + '/v1' });
    t.ok('with no key it stops, says where to set one up, and calls nobody', r.code === 1 && /SETUP\.md/.test(r.err) && /Nothing was published/.test(r.err) && g.seen.length === 0, JSON.stringify({ r, n: g.seen.length }));
    r = await run({ FIREBASE_RULES_KEY: '{not json', RULES_API: 'http://127.0.0.1:' + g.port + '/v1' });
    t.ok('a key that is not the JSON file stops it', r.code === 1 && /not the JSON key file/.test(r.err) && g.seen.length === 0, r.err);
    r = await run({ FIREBASE_RULES_KEY: keyFor(g.port, 'somebody-elses-project'), RULES_API: 'http://127.0.0.1:' + g.port + '/v1' });
    t.ok('a key for another project is refused before anything is sent', r.code === 1 && /somebody-elses-project/.test(r.err) && g.seen.length === 0, r.err);
    g.srv.close();

    g = await standIn({ publicKey, reject: true });
    r = await run({ FIREBASE_RULES_KEY: keyFor(g.port), RULES_API: 'http://127.0.0.1:' + g.port + '/v1' });
    t.ok('rules Google will not compile stop it, saying why, and the live release is left alone',
      r.code === 1 && /unexpected token/.test(r.err) && /Nothing was published/.test(r.err) && g.state.release === 'projects/' + PROJECT + '/rulesets/old' &&
        !g.seen.some((s) => s.method === 'PATCH'), JSON.stringify({ err: r.err, rel: g.state.release }));
    g.srv.close();
  },
};
