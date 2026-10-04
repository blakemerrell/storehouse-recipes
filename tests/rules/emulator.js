/* Google's own Firestore emulator, started on a free port and stopped again.
 *
 * A Java program, downloaded once into .emulator/ and kept (CI caches the
 * folder). Shared by rules.check.js and sync.check.js, which each start one
 * of their own, so neither can see what the other wrote. */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const net = require('net');
const { spawn } = require('child_process');

const JAR_VERSION = '1.19.8';
const JAR_DIR = process.env.FIRESTORE_EMULATOR_DIR || path.join(__dirname, '.emulator');
const JAR = path.join(JAR_DIR, 'cloud-firestore-emulator-v' + JAR_VERSION + '.jar');
const JAR_URL = 'https://storage.googleapis.com/firebase-preview-drop/emulator/' +
  'cloud-firestore-emulator-v' + JAR_VERSION + '.jar';

function download(url, to) {
  return new Promise((ok, fail) => {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    const part = to + '.part';
    https.get(url, (res) => {
      if (res.statusCode !== 200) { fail(new Error('emulator download: HTTP ' + res.statusCode)); return; }
      const out = fs.createWriteStream(part);
      res.pipe(out);
      out.on('finish', () => out.close(() => { fs.renameSync(part, to); ok(); }));
    }).on('error', fail);
  });
}

function freePort() {
  return new Promise((ok) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); });
  });
}

function answering(port) {
  return new Promise((ok) => {
    http.get({ host: '127.0.0.1', port, path: '/' }, (res) => { res.resume(); ok(true); })
      .on('error', () => ok(false));
  });
}

async function startEmulator() {
  if (!fs.existsSync(JAR)) {
    console.log('Downloading the Firestore emulator (once)…');
    await download(JAR_URL, JAR);
  }
  const port = await freePort();
  const proc = spawn('java', ['-jar', JAR, '--host=127.0.0.1', '--port=' + port],
    { stdio: ['ignore', 'ignore', 'pipe'] });
  let said = '';
  proc.stderr.on('data', (d) => { said += d; });
  for (let i = 0; i < 120; i++) {
    if (await answering(port)) return { port, proc };
    if (proc.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  proc.kill();
  throw new Error('the Firestore emulator did not start:\n' + said.slice(-2000));
}

module.exports = { startEmulator };
