import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { test } from 'node:test';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import os from 'node:os';
import { join } from 'node:path';
import { computeStats } from '../utils/stats.js';
import { sanitizeContext } from '../utils/context.js';
import { summarizeLighthouseRuns } from '../measures/lighthouse.js';
import { measureStaticBundleSize } from '../measures/bundle-size.js';
import { measureFramework } from '../measures/cross-framework.js';
import { assertPortAvailable, startCommand, stopServer, waitForReady } from '../utils/server-lifecycle.js';

async function unusedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

function quote(value: string): string {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}

test('statistics retain sample order, integer compatibility and fractional CLS spread', () => {
  const values = [30, 10, 20];
  assert.deepEqual(computeStats(values), {
    runs: [30, 10, 20], mean: 20, median: 20, p95: 30, stddev: 8, min: 10, max: 30,
  });
  assert.deepEqual(values, [30, 10, 20]);
  assert.equal(computeStats([0.001, 0.003, 0.002], 6).median, 0.002);
  assert.throws(() => computeStats([]));
  assert.throws(() => computeStats([NaN]));
});

test('Lighthouse keeps the median-score run and records every metric spread', () => {
  const runs = [
    { performance: 99, fcp: 300, lcp: 500, cls: 0.003, tbt: 10, speedIndex: 350 },
    { performance: 80, fcp: 200, lcp: 400, cls: 0.001, tbt: 40, speedIndex: 500 },
    { performance: 90, fcp: 100, lcp: 600, cls: 0.002, tbt: 20, speedIndex: 400 },
  ];
  const result = summarizeLighthouseRuns(runs);
  assert.equal(result.runCount, 3);
  assert.equal(result.performance, 90);
  assert.equal(result.fcp, 100);
  assert.equal(result.statistics.fcp.median, 200);
  assert.equal(result.statistics.cls.min, 0.001);
  assert.equal(result.statistics.cls.max, 0.003);
  for (const stats of Object.values(result.statistics)) assert.equal(stats.runs.length, 3);
});

test('context scrubs local identifiers, paths and email addresses', () => {
  const examplePath = join(os.homedir(), 'work');
  const exampleEmail = ['person', 'example.test'].join('@');
  const context = sanitizeContext(`Browser idle; ${os.hostname()}; ${os.userInfo().username}; ${os.homedir()}/work; ${examplePath}; ${exampleEmail}`);
  for (const identifier of [os.hostname(), os.userInfo().username, os.homedir(), examplePath, exampleEmail]) {
    assert.ok(!context.includes(identifier));
  }
  assert.ok(context.includes('Browser idle'));
});

test('static bundle counts public files once and rejects empty output', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bench-bundle-'));
  try {
    await assert.rejects(measureStaticBundleSize(dir), /empty/);
    await mkdir(join(dir, 'assets'));
    await writeFile(join(dir, 'assets', 'app.js'), '123');
    await writeFile(join(dir, 'assets', 'app.css'), '12');
    await writeFile(join(dir, 'index.html'), '12345');
    await writeFile(join(dir, 'asset.bin'), '1234');
    assert.deepEqual(await measureStaticBundleSize(dir), {
      clientJS: 3, clientCSS: 2, staticHTML: 5, serverBundle: 0, totalOutput: 14,
    });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('an occupied port fails instead of starting or reusing a server', async () => {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  try {
    await assert.rejects(assertPortAvailable(port), /already in use/);
    await assert.rejects(startCommand(process.execPath, ['-e', 'process.exit(99)'], process.cwd(), port, 'test'), /already in use/);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('readiness detects early exit and cleanup kills a surviving descendant', async () => {
  const port = await unusedPort();
  const script = "require('node:http').createServer((req,res)=>res.end('ok')).listen(Number(process.env.PORT))";
  const parent = `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(script)}], {stdio:'ignore'}).unref(); setTimeout(()=>process.exit(0), 500)`;
  const proc = await startCommand(process.execPath, ['-e', parent], process.cwd(), port, 'test');
  try {
    await waitForReady(`http://localhost:${port}`, 5000, proc);
    await new Promise<void>(resolve => proc.exitCode !== null ? resolve() : proc.once('exit', () => resolve()));
    assert.equal((await fetch(`http://localhost:${port}`)).status, 200);
  } finally { await stopServer(proc); }
  await assertPortAvailable(port);
  const early = await startCommand(process.execPath, ['-e', 'process.exit(1)'], process.cwd(), port, 'test');
  try { await assert.rejects(waitForReady(`http://localhost:${port}`, 2000, early), /exited/); }
  finally { await stopServer(early); }
});

test('comparison builds clear caches each time, validate routes and tear down on failure', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bench-framework-'));
  const port = await unusedPort();
  try {
    await mkdir(join(dir, 'node_modules'));
    await mkdir(join(dir, 'cache'));
    await writeFile(join(dir, 'cache', 'stale'), 'stale');
    const buildScript = join(dir, 'build.cjs');
    const serverScript = join(dir, 'server.cjs');
    await writeFile(buildScript, `const fs=require('node:fs'); if(fs.existsSync('cache')||fs.existsSync('out'))process.exit(2); fs.mkdirSync('cache'); fs.mkdirSync('out'); fs.writeFileSync('out/index.html','wrong page'); fs.appendFileSync('runs','1');`);
    await writeFile(serverScript, `require('node:http').createServer((req,res)=>res.end('wrong page')).listen(Number(process.env.PORT));`);
    await assert.rejects(measureFramework({
      name: 'fixture', dir: '.', installCmd: 'false',
      buildCmd: `${quote(process.execPath)} ${quote(buildScript)}`,
      outputDir: 'out', cacheDirs: ['cache'],
      previewCmd: `${quote(process.execPath)} ${quote(serverScript)}`,
      previewPort: port, versionPkg: 'fixture',
    }, dir, 2, [{ path: '/', markers: ['Expected heading'] }]), /did not serve every measured route/);
    assert.equal(await readFile(join(dir, 'runs'), 'utf8'), '11');
    await assertPortAvailable(port);
  } finally { await rm(dir, { recursive: true, force: true }); }
});


test('cleanup ignores a vanished group only after verifying membership and the port', { skip: process.platform === 'win32' }, async t => {
  const port = await unusedPort();
  const proc = await startCommand(process.execPath, ['-e', 'setInterval(()=>{},1000)'], process.cwd(), port, 'test');
  const snapshot = childProcess.execFileSync('ps', ['-axo', 'pid=,pgid=,uid=,stat=,lstart='], { encoding: 'utf8' });
  proc.kill('SIGTERM');
  await new Promise<void>(resolve => proc.once('exit', () => resolve()));
  let reads = 0;
  t.mock.method(childProcess, 'execFileSync', () => reads++ === 0 ? snapshot : '');
  const kill = t.mock.method(process, 'kill', () => {
    throw Object.assign(new Error('kill EPERM'), { code: 'EPERM' });
  });
  try {
    await stopServer(proc);
    assert.equal(kill.mock.callCount(), 1);
    assert.ok(reads >= 2);
    await stopServer(proc);
    assert.equal(kill.mock.callCount(), 1);
    await assertPortAvailable(port);
  } finally { t.mock.restoreAll(); }
});

test('cleanup skips zombie groups without sending a signal', { skip: process.platform === 'win32' }, async t => {
  const port = await unusedPort();
  const proc = await startCommand(process.execPath, ['-e', 'setInterval(()=>{},1000)'], process.cwd(), port, 'test');
  proc.kill('SIGTERM');
  await new Promise<void>(resolve => proc.once('exit', () => resolve()));
  t.mock.method(childProcess, 'execFileSync', () => `${proc.pid} ${proc.pid} ${process.getuid?.()} Z Thu Jan 1 00:00:00 1970`);
  const kill = t.mock.method(process, 'kill', () => { throw new Error('must not signal zombies'); });
  try {
    await stopServer(proc);
    assert.equal(kill.mock.callCount(), 0);
    await assertPortAvailable(port);
  } finally { t.mock.restoreAll(); }
});

test('cleanup rejects a live group permission error and a reused group identity', { skip: process.platform === 'win32' }, async t => {
  const port = await unusedPort();
  const proc = await startCommand(process.execPath, ['-e', "require('node:http').createServer((req,res)=>res.end('ok')).listen(Number(process.env.PORT))"], process.cwd(), port, 'test');
  try {
    await waitForReady(`http://localhost:${port}`, 5000, proc);
    const kill = t.mock.method(process, 'kill', () => {
      throw Object.assign(new Error('kill EPERM'), { code: 'EPERM' });
    });
    await assert.rejects(stopServer(proc), { code: 'EPERM' });
    assert.equal((await fetch(`http://localhost:${port}`)).status, 200);
    kill.mock.restore();
    const snapshot = childProcess.execFileSync('ps', ['-axo', 'pid=,pgid=,uid=,stat=,lstart='], { encoding: 'utf8' });
    t.mock.method(childProcess, 'execFileSync', () => snapshot.split('\n').map(line => `${line} changed`).join('\n'));
    const noKill = t.mock.method(process, 'kill', () => { throw new Error('must not signal a reused group'); });
    await assert.rejects(stopServer(proc), /identity changed/);
    assert.equal(noKill.mock.callCount(), 0);
  } finally {
    t.mock.restoreAll();
    await stopServer(proc);
  }
  await assertPortAvailable(port);
});

test('cleanup fails if the reserved port remains occupied without signaling its new owner', { skip: process.platform === 'win32' }, async t => {
  const port = await unusedPort();
  const proc = await startCommand(process.execPath, ['-e', 'setInterval(()=>{},1000)'], process.cwd(), port, 'test');
  proc.kill('SIGTERM');
  await new Promise<void>(resolve => proc.once('exit', () => resolve()));
  const unrelated = createServer();
  await new Promise<void>(resolve => unrelated.listen(port, resolve));
  const kill = t.mock.method(process, 'kill', () => { throw new Error('must not signal an unrelated listener'); });
  try {
    await assert.rejects(stopServer(proc), /already in use/);
    assert.equal(kill.mock.callCount(), 0);
  } finally {
    t.mock.restoreAll();
    await new Promise<void>(resolve => unrelated.close(() => resolve()));
    await stopServer(proc);
  }
  await assertPortAvailable(port);
});

test('cleanup escalates when a server ignores SIGTERM', { skip: process.platform === 'win32' }, async () => {
  const port = await unusedPort();
  const proc = await startCommand(process.execPath, ['-e', "process.on('SIGTERM',()=>{});require('node:http').createServer((req,res)=>res.end('ok')).listen(Number(process.env.PORT))"], process.cwd(), port, 'test');
  try { await waitForReady(`http://localhost:${port}`, 5000, proc); }
  finally { await stopServer(proc); }
  if (proc.exitCode === null && proc.signalCode === null) {
    await new Promise<void>(resolve => proc.once('exit', () => resolve()));
  }
  assert.equal(proc.signalCode, 'SIGKILL');
  await assertPortAvailable(port);
});
