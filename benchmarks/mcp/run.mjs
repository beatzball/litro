import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { readFile, writeFile, mkdir, readdir, lstat } from 'node:fs/promises';
import { createServer, connect as tcpConnect } from 'node:net';
import { cpus, platform, release, totalmem, arch, loadavg } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const root = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  if (i < 0) return fallback;
  assert(args[i + 1] && !args[i + 1].startsWith('--'), `${flag} requires a value`);
  return args[i + 1];
};
const positive = (flag, fallback) => {
  const n = Number(value(flag, fallback));
  assert(Number.isSafeInteger(n) && n > 0, `${flag} must be a positive integer`);
  return n;
};
const known = new Set(['--install', '--verify-only', '--app', '--runs', '--samples', '--build-runs', '--output']);
for (let i = 0; i < args.length; i++) {
  assert(known.has(args[i]), `Unknown option: ${args[i]}`);
  if (!['--install', '--verify-only'].includes(args[i])) i++;
}
const verifyOnly = args.includes('--verify-only');
const runs = positive('--runs', 7);
const samples = positive('--samples', 100);
const buildRuns = positive('--build-runs', 5);
const warmups = 10;
const appNames = ['litro', 'mastra', 'flue', 'eve'];
const selected = value('--app', null);
assert(!selected || appNames.includes(selected), 'Unknown app');
const apps = [
  { name: 'litro', transports: ['http', 'stdio'], path: '/mcp/weather', era: 'legacy', ui: true },
  { name: 'mastra', transports: ['http', 'stdio'], path: '/mcp', era: 'modern', ui: true },
  { name: 'flue', transports: [], reason: 'MCP client support only; no native MCP server export.' },
  { name: 'eve', transports: ['http'], path: '/mcp', era: 'modern', ui: false },
].filter(a => !selected || a.name === selected);
const quantile = (xs, p) => [...xs].sort((a, b) => a - b)[Math.max(0, Math.ceil(p * xs.length) - 1)];
const stats = xs => ({ n: xs.length, min: Math.min(...xs), p50: quantile(xs, .5), p95: quantile(xs, .95), max: Math.max(...xs) });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const appDir = app => join(root, 'apps', app.name);

async function filesUnder(dir) {
  const out = [];
  for (const name of (await readdir(dir)).sort()) {
    if (['node_modules', 'dist', '.git', '.eve', '.output', '.nitro', '.workflow-data'].includes(name)) continue;
    const path = join(dir, name);
    const st = await lstat(path);
    if (st.isDirectory()) out.push(...await filesUnder(path));
    else if (st.isFile()) out.push(path);
  }
  return out;
}
async function fingerprint(app) {
  const base = appDir(app);
  const files = await filesUnder(base);
  const h = createHash('sha256');
  for (const file of files) {
    h.update(relative(base, file)); h.update('\0'); h.update(await readFile(file)); h.update('\0');
  }
  return {
    sourceSha256: h.digest('hex'),
    lockSha256: hash(await readFile(join(base, 'package-lock.json'))),
    manifest: JSON.parse(await readFile(join(base, 'package.json'), 'utf8')),
  };
}
async function diskBytes(dir) {
  let bytes = 0;
  for (const name of await readdir(dir)) {
    const path = join(dir, name);
    const st = await lstat(path);
    if (st.isDirectory()) bytes += await diskBytes(path);
    else if (st.isFile()) bytes += st.size;
  }
  return bytes;
}
async function command(command, commandArgs, cwd) {
  const child = spawn(command, commandArgs, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', c => { log = (log + c).slice(-20000); });
  child.stderr.on('data', c => { log = (log + c).slice(-20000); });
  const [code, signal] = await once(child, 'exit');
  assert.equal(code, 0, `${command} ${commandArgs.join(' ')} failed (${signal ?? code}):\n${log}`);
}
async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((ok, fail) => server.close(e => e ? fail(e) : ok()));
  return port;
}
async function waitForPort(port, child, logs) {
  const deadline = performance.now() + 30000;
  while (performance.now() < deadline) {
    assert.equal(child.exitCode, null, `Server exited: ${logs()}`);
    const ready = await new Promise(ok => {
      const socket = tcpConnect({ port, host: '127.0.0.1' });
      socket.once('connect', () => { socket.destroy(); ok(true); });
      socket.once('error', () => { socket.destroy(); ok(false); });
    });
    if (ready) return;
    await delay(5);
  }
  throw new Error(`Server did not listen within 30 seconds: ${logs()}`);
}
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  let timer;
  try {
    await Promise.race([exited, new Promise(ok => { timer = setTimeout(ok, 2000); })]);
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited; }
  } finally { clearTimeout(timer); }
}

async function openServer(app, transportName) {
  const cwd = appDir(app);
  const port = transportName === 'http' ? await freePort() : null;
  let child;
  let logs = '';
  const client = new Client({ name: 'mcp-comparison', version: '1.0.0' }, {
    versionNegotiation: { mode: app.era === 'modern' ? { pin: '2026-07-28' } : 'legacy' },
  });
  let transport;
  const started = performance.now();
  try {
    if (transportName === 'http') {
      child = spawn(process.execPath, ['dist/server.mjs', 'http'], {
        cwd, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.on('error', e => { logs += e.message; });
      child.stdout.on('data', c => { logs = (logs + c).slice(-20000); });
      child.stderr.on('data', c => { logs = (logs + c).slice(-20000); });
      await waitForPort(port, child, () => logs);
      transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}${app.path}`));
    } else {
      transport = new StdioClientTransport({ command: process.execPath, args: ['dist/server.mjs', 'stdio'], cwd, stderr: 'pipe' });
      transport.stderr.on('data', c => { logs = (logs + c).slice(-20000); });
    }
    await client.connect(transport, { timeout: 30000 });
    const tools = await client.listTools({}, { cacheMode: 'bypass', timeout: 30000 });
    const coldMs = performance.now() - started;
    return {
      client, tools, coldMs, pid: child?.pid ?? transport.pid,
      protocol: client.getNegotiatedProtocolVersion(), era: client.getProtocolEra(),
      async close() { try { await client.close(); } finally { await stop(child); } },
    };
  } catch (e) {
    try { await client.close(); } finally { await stop(child); }
    throw new Error(`${app.name}/${transportName}: ${e.message}\n${logs}`, { cause: e });
  }
}
const expected = city => ({ city, tempC: 21, summary: 'sunny' });
function weatherData(result) {
  assert(!result.isError, 'Tool returned isError');
  if (result.structuredContent) return result.structuredContent;
  const text = result.content?.filter(c => c.type === 'text').map(c => c.text).join('');
  return JSON.parse(text);
}
async function verify(app, connection) {
  const { tools, client } = connection;
  assert.equal(tools.tools.length, 1, `${app.name} must publish exactly one tool`);
  const tool = tools.tools[0];
  assert.equal(tool.name, 'get-weather');
  assert(tool.inputSchema.required.includes('city'));
  assert.equal(tool.inputSchema.properties.city.type, 'string');
  assert.equal(tool.inputSchema.properties.city.minLength, 1);
  assert.equal(tool.inputSchema.properties.city.maxLength, 80);
  assert.deepEqual(weatherData(await client.callTool({ name: tool.name, arguments: { city: ' Lisbon ' } })), expected('Lisbon'));
  assert.deepEqual(weatherData(await client.callTool({ name: tool.name, arguments: { city: '<safe>&東京' } })), expected('<safe>&東京'));
  for (const input of [{}, { city: '' }, { city: ' ' }, { city: 'x'.repeat(81) }, { city: 42 }]) {
    let rejected = false;
    try { rejected = (await client.callTool({ name: tool.name, arguments: input })).isError === true; }
    catch { rejected = true; }
    assert(rejected, `${app.name} accepted invalid input ${JSON.stringify(input)}`);
    await client.listTools({}, { cacheMode: 'bypass' });
  }
  let resource = null;
  if (app.ui) {
    const uri = tool._meta?.ui?.resourceUri;
    assert.equal(uri, 'ui://bench-weather/card');
    const listed = await client.listResources({}, { cacheMode: 'bypass' });
    assert(listed.resources.some(r => r.uri === uri));
    const result = await client.readResource({ uri }, { cacheMode: 'bypass' });
    assert.equal(result.contents.length, 1);
    const content = result.contents[0];
    assert.equal(content.uri, uri);
    assert.equal(content.mimeType, 'text/html;profile=mcp-app');
    assert.match(content.text, /<!doctype html>/i);
    assert.match(content.text, /Waiting for weather/);
    assert(!content.text.includes('Lisbon'), 'UI template contains per-call data');
    resource = { uri, bytes: Buffer.byteLength(content.text), sha256: hash(content.text), mimeType: content.mimeType };
  }
  return { tool: tool.name, invalidInputsRejected: 5, resource, protocol: connection.protocol, era: connection.era };
}
async function rssBytes(pid) {
  const readings = [];
  await delay(200);
  for (let i = 0; i < 3; i++) {
    const rss = Number(execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8' }).trim());
    assert(Number.isFinite(rss) && rss > 0, 'Cannot read server RSS');
    readings.push(rss * 1024);
    await delay(50);
  }
  return quantile(readings, .5);
}
async function measureConnection(app, transport) {
  const hostLoadAverage = loadavg();
  const connection = await openServer(app, transport);
  try {
    const idleRssBytes = await rssBytes(connection.pid);
    const list = () => connection.client.listTools({}, { cacheMode: 'bypass', timeout: 30000 });
    const call = () => connection.client.callTool({ name: 'get-weather', arguments: { city: 'Lisbon' } }, { timeout: 30000 });
    for (let i = 0; i < warmups; i++) { await list(); await call(); }
    const listMs = [], callMs = [];
    for (let i = 0; i < samples; i++) {
      let before = performance.now();
      const listed = await list();
      listMs.push(performance.now() - before);
      assert.equal(listed.tools.length, 1);
      before = performance.now();
      const result = await call();
      callMs.push(performance.now() - before);
      assert.deepEqual(weatherData(result), expected('Lisbon'));
    }
    return { hostLoadAverage, coldMs: connection.coldMs, idleRssBytes, protocol: connection.protocol, era: connection.era, listMs, callMs, list: stats(listMs), call: stats(callMs) };
  } finally { await connection.close(); }
}

const result = {
  schemaVersion: 1,
  harness: { runnerSha256: hash(await readFile(fileURLToPath(import.meta.url))), lockSha256: hash(await readFile(join(root, 'package-lock.json'))) },
  startedAt: new Date().toISOString(),
  environment: { node: process.version, npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(), platform: platform(), arch: arch(), osRelease: release(), cpu: cpus()[0].model, logicalCpus: cpus().length, ramBytes: totalmem(), sharedHost: true, loadAverageAtStart: loadavg() },
  method: { client: '@modelcontextprotocol/client@2.4.0', runs, samplesPerMethodPerRun: samples, warmupsPerMethodPerRun: warmups, buildRuns, concurrency: 1, listCache: 'bypass', installSize: 'logical regular-file bytes in node_modules including dev dependencies; symlinks excluded', cold: 'fresh server process through first tools/list, warm filesystem, preloaded client; known protocol era; HTTP TCP polling at 5 ms', idleRss: 'median of 3 ps RSS readings 50 ms apart after a 200 ms pause following first tools/list' },
  apps: {},
};
for (const app of apps) {
  const dir = appDir(app);
  if (args.includes('--install')) {
    console.log(`Install ${app.name}`);
    await command('npm', ['ci', '--no-audit', '--no-fund'], dir);
  }
  result.apps[app.name] = { ...(await fingerprint(app)), installBytes: await diskBytes(join(dir, 'node_modules')), buildMs: [], transports: {}, ...(app.reason ? { reason: app.reason } : {}) };
}
const buildCount = verifyOnly ? 1 : buildRuns;
for (let run = 0; run < buildCount; run++) {
  const order = [...apps.slice(run % apps.length), ...apps.slice(0, run % apps.length)];
  for (const app of order) {
    console.log(`Build ${app.name} ${run + 1}/${buildCount}`);
    const started = performance.now();
    await command('npm', ['run', 'build'], appDir(app));
    result.apps[app.name].buildMs.push(performance.now() - started);
  }
}
for (const app of apps.filter(a => !a.transports.length)) {
  console.log(`Verify ${app.name} direct tool (no MCP server)`);
  await command('npm', ['run', 'verify'], appDir(app));
  result.apps[app.name].directToolVerified = true;
}
const combinations = apps.flatMap(app => app.transports.map(transport => ({ app, transport })));
for (const { app, transport } of combinations) {
  console.log(`Verify ${app.name}/${transport}`);
  const connection = await openServer(app, transport);
  try {
    result.apps[app.name].transports[transport] = { verification: await verify(app, connection), runs: [] };
  } finally { await connection.close(); }
}
if (!verifyOnly) {
  for (let run = 0; run < runs; run++) {
    const order = [...combinations.slice(run % combinations.length), ...combinations.slice(0, run % combinations.length)];
    for (const { app, transport } of order) {
      console.log(`Measure ${app.name}/${transport} ${run + 1}/${runs}`);
      result.apps[app.name].transports[transport].runs.push(await measureConnection(app, transport));
    }
  }
}
for (const app of apps) {
  const entry = result.apps[app.name];
  assert.equal((await fingerprint(app)).sourceSha256, entry.sourceSha256, `${app.name} source changed during run`);
  entry.build = stats(entry.buildMs);
  for (const transport of Object.values(entry.transports)) {
    if (!transport.runs.length) continue;
    transport.summary = {
      coldMs: stats(transport.runs.map(r => r.coldMs)), idleRssBytes: stats(transport.runs.map(r => r.idleRssBytes)),
      listP50Ms: stats(transport.runs.map(r => r.list.p50)), listP95Ms: stats(transport.runs.map(r => r.list.p95)),
      callP50Ms: stats(transport.runs.map(r => r.call.p50)), callP95Ms: stats(transport.runs.map(r => r.call.p95)),
    };
  }
}
result.finishedAt = new Date().toISOString();
const partial = selected || verifyOnly || runs !== 7 || samples !== 100 || buildRuns !== 5;
const output = resolve(root, value('--output', partial ? 'results/partial.json' : 'results/latest.json'));
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(`Wrote ${relative(root, output)}`);
