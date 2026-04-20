import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { computeStats } from '../utils/stats.js';
import { gzipSize } from '../utils/gzip.js';
import type { FrameworkResult, PageWeightResult } from '../types.js';
import { SERVER_READY_TIMEOUT, CROSS_FRAMEWORK_ROUTES } from '../config.js';

export interface FrameworkConfig {
  name: string;
  dir: string;
  installCmd: string;
  buildCmd: string;
  outputDir: string;
  previewCmd: string;
  previewPort: number;
  versionPkg: string;
}

async function walkSize(dir: string): Promise<number> {
  let total = 0;
  let files: string[];
  try {
    files = await readdir(dir, { recursive: true, encoding: 'utf-8' }) as string[];
  } catch {
    return 0;
  }
  for (const file of files) {
    const s = await stat(join(dir, file));
    if (s.isFile()) total += s.size;
  }
  return total;
}

async function waitForReady(url: string, timeout: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeout}ms`);
}

function startPreview(cmd: string, cwd: string, port: number): ChildProcess {
  const parts = cmd.split(' ');
  const proc = spawn(parts[0], parts.slice(1), {
    cwd,
    env: { ...process.env, PORT: String(port) },
    stdio: 'pipe',
    shell: true,
  });
  proc.stderr?.on('data', (d: Buffer) => {
    const msg = d.toString().trim();
    if (msg) console.error(`  [preview] ${msg}`);
  });
  return proc;
}

async function stopProc(proc: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (proc.exitCode !== null) { resolve(); return; }
    proc.on('exit', () => resolve());
    proc.kill('SIGTERM');
    setTimeout(() => { if (proc.exitCode === null) proc.kill('SIGKILL'); }, 5000);
  });
}

async function resolveVersion(appDir: string, pkg: string): Promise<string> {
  try {
    const pkgJson = join(appDir, 'node_modules', pkg, 'package.json');
    const raw = await readFile(pkgJson, 'utf-8');
    return JSON.parse(raw).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function measureFramework(
  config: FrameworkConfig,
  appsDir: string,
  runs: number,
  routes?: string[],
  env?: Record<string, string>,
): Promise<FrameworkResult> {
  const appDir = join(appsDir, config.dir);
  console.log(`\n[cross-framework] ${config.name}`);
  const execEnv = env ? { ...process.env, ...env } : undefined;

  // Install deps if needed
  if (!existsSync(join(appDir, 'node_modules'))) {
    console.log(`  Installing dependencies...`);
    execSync(config.installCmd, { cwd: appDir, stdio: 'pipe', env: execEnv });
  }

  // Build N times
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const outputDir = join(appDir, config.outputDir);
    rmSync(outputDir, { recursive: true, force: true });

    const start = performance.now();
    execSync(config.buildCmd, { cwd: appDir, stdio: 'pipe', env: execEnv });
    const elapsed = Math.round(performance.now() - start);

    times.push(elapsed);
    console.log(`  build ${i + 1}/${runs}: ${elapsed}ms`);
  }

  // Measure output size (after last build)
  const outputSize = await walkSize(join(appDir, config.outputDir));
  console.log(`  output size: ${(outputSize / 1024).toFixed(1)} KB`);

  // Measure page weight
  const baseUrl = `http://localhost:${config.previewPort}`;
  const proc = startPreview(config.previewCmd, appDir, config.previewPort);

  const pageWeight: Record<string, PageWeightResult> = {};
  try {
    await waitForReady(baseUrl, SERVER_READY_TIMEOUT);

    for (const route of (routes ?? CROSS_FRAMEWORK_ROUTES)) {
      const res = await fetch(baseUrl + route);
      const buf = Buffer.from(await res.arrayBuffer());
      pageWeight[route] = {
        rawBytes: buf.byteLength,
        gzipBytes: gzipSize(buf),
        statusCode: res.status,
      };
      console.log(`  ${route}: ${buf.byteLength} bytes (gzip: ${gzipSize(buf)})`);
    }
  } finally {
    await stopProc(proc);
  }

  const version = await resolveVersion(appDir, config.versionPkg);
  console.log(`  version: ${version}`);

  return {
    name: config.name,
    version,
    buildTime: computeStats(times),
    outputSize,
    pageWeight,
  };
}
