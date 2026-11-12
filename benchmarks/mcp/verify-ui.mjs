import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';

const root = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === '--app'), 'Usage: node verify-ui.mjs [--app litro|mastra]');
const selected = args[1];
assert(!selected || ['litro', 'mastra'].includes(selected), 'Unknown UI app');
const inspectorVersion = '20.3.29';
async function freePort() {
  const server = createServer(); server.listen(0, '127.0.0.1');
  await once(server, 'listening'); const port = server.address().port;
  await new Promise(ok => server.close(ok)); return port;
}
function start(command, commandArgs, options) {
  const child = spawn(command, commandArgs, { ...options, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', c => { log = (log + c).slice(-10000); });
  child.stderr.on('data', c => { log = (log + c).slice(-10000); });
  child.on('error', e => { log += e.message; });
  return { child, log: () => log };
}
async function stop(processGroup) {
  if (!processGroup) return;
  try { process.kill(-processGroup.child.pid, 'SIGTERM'); } catch (e) { if (e.code !== 'ESRCH') throw e; }
}
async function ready(url, processGroup) {
  const until = Date.now() + 60000;
  while (Date.now() < until) {
    assert.equal(processGroup.child.exitCode, null, processGroup.log());
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch { /* Retry while the pinned host starts. */ }
    await delay(100);
  }
  throw new Error(`Host did not start: ${processGroup.log()}`);
}
const output = {
  checkedAt: new Date().toISOString(),
  host: `@mcp-use/inspector@${inspectorVersion}`,
  playwright: JSON.parse(await readFile(new URL('./node_modules/@playwright/test/package.json', import.meta.url))).version,
  apps: {},
};
const browser = await chromium.launch();
output.chromium = browser.version();
try {
  for (const name of ['litro', 'mastra'].filter(n => !selected || n === selected)) {
    const port = await freePort();
    const hostPort = await freePort();
    const path = name === 'litro' ? '/mcp/weather' : '/mcp';
    let server, inspector, page;
    try {
      server = start(process.execPath, ['dist/server.mjs', 'http'], { cwd: join(root, 'apps', name), env: { ...process.env, PORT: String(port) } });
      inspector = start('npx', ['--yes', `@mcp-use/inspector@${inspectorVersion}`, '--url', `http://127.0.0.1:${port}${path}`, '--port', String(hostPort), '--no-open'], { cwd: root });
      const inspectorUrl = `http://localhost:${hostPort}/inspector`;
      await ready(inspectorUrl, inspector);
      page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
      page.setDefaultTimeout(30000);
      await page.goto(inspectorUrl);
      await page.getByText('get-weather', { exact: true }).first().click();
      await page.getByPlaceholder('Enter city').fill('Lisbon');
      await page.getByRole('button', { name: /execute/i }).first().click();
      let view;
      const until = Date.now() + 30000;
      while (Date.now() < until) {
        view = page.frames().find(f => f.url() === 'about:srcdoc');
        if (view && (await view.locator('body').innerText()).includes('Lisbon: 21°C, sunny')) break;
        await delay(100);
      }
      assert(view, 'Inspector did not load the MCP App iframe');
      const text = (await view.locator('body').innerText()).trim();
      assert(text.includes('Weather') && text.includes('Lisbon: 21°C, sunny'), `Unexpected view: ${text}`);
      const artifact = await readFile(join(root, 'apps', name, 'dist', name === 'litro' ? 'mcp-apps/weather.html' : 'weather.html'));
      output.apps[name] = { status: 'passed', resourceBytes: artifact.length, resourceSha256: createHash('sha256').update(artifact).digest('hex'), iframe: 'about:srcdoc', renderedText: text, toolResultRendered: true };
      console.log(`${name}: real Inspector iframe rendered deterministic weather`);
    } finally {
      await page?.close();
      await stop(inspector);
      await stop(server);
    }
  }
} finally { await browser.close(); }
await mkdir(join(root, 'results'), { recursive: true });
const filename = selected ? 'ui-partial.json' : 'ui-verification.json';
await writeFile(join(root, 'results', filename), JSON.stringify(output, null, 2) + '\n');
console.log(`Wrote results/${filename}`);
