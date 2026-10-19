// Windows Chrome, Node 22+: isolated profile, loopback-only server, no dependencies.
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const root = resolve(import.meta.dirname, '..');
const server = createServer(async (request, response) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    const data = await readFile(path);
    response.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }[extname(path)] || 'application/octet-stream');
    response.end(data);
  } catch { response.writeHead(404).end(); }
});
let chrome;
let profile;
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  profile = await mkdtemp(join(tmpdir(), 'luck-qa-'));
  chrome = spawn(process.env.LUCK_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  let launchError;
  chrome.on('error', (error) => { launchError = error; });
  let port;
  for (let i = 0; i < 100; i += 1) {
    if (launchError) throw launchError;
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await new Promise((done) => setTimeout(done, 100)); }
  }
  if (!port) throw new Error('Chrome CDP did not start');
  for (const file of ['browser-smoke.mjs', 'fortune-browser.mjs', 'natal-browser.mjs']) {
    const child = spawn(process.execPath, [join(import.meta.dirname, file)], { cwd: root, stdio: 'inherit', windowsHide: true,
      env: { ...process.env, LUCK_QA_BASE: `http://127.0.0.1:${server.address().port}`, LUCK_QA_CDP: `http://127.0.0.1:${port}` } });
    const [code] = await once(child, 'exit');
    if (code !== 0) throw new Error(`${file} failed: ${code}`);
  }
} finally {
  if (chrome && chrome.exitCode == null) {
    const exited = once(chrome, 'exit');
    chrome.kill();
    await exited;
  }
  server.close();
  if (profile && resolve(profile).startsWith(resolve(tmpdir()) + sep) && profile.includes('luck-qa-')) {
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}
