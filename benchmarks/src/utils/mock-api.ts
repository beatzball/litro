import { spawn, type ChildProcess } from 'node:child_process';
import { join, resolve } from 'node:path';
import { MOCK_API_PORT } from '../config.js';

const MOCK_API_DIR = new URL('../../mock-api/', import.meta.url).pathname;
const BENCHMARKS_DIR = new URL('../../', import.meta.url).pathname;

export async function startMockApi(): Promise<ChildProcess> {
  const serverScript = join(MOCK_API_DIR, 'server.ts');
  const tsxBin = resolve(BENCHMARKS_DIR, 'node_modules', '.bin', 'tsx');
  const proc = spawn(tsxBin, [serverScript], {
    cwd: MOCK_API_DIR,
    env: { ...process.env, MOCK_API_PORT: String(MOCK_API_PORT) },
    stdio: 'pipe',
  });

  proc.stderr?.on('data', (d: Buffer) => {
    const msg = d.toString().trim();
    if (msg) console.error(`  [mock-api] ${msg}`);
  });

  // Wait until the mock API is ready
  const baseUrl = `http://localhost:${MOCK_API_PORT}/v0/topstories.json`;
  const start = Date.now();
  const timeout = 15_000;
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(baseUrl);
      if (res.ok) {
        console.log(`Mock HN API ready on port ${MOCK_API_PORT}`);
        return proc;
      }
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, 300));
  }
  proc.kill('SIGKILL');
  throw new Error(`Mock API did not start within ${timeout}ms`);
}

export async function stopMockApi(proc: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (proc.exitCode !== null) { resolve(); return; }
    proc.on('exit', () => resolve());
    proc.kill('SIGTERM');
    setTimeout(() => { if (proc.exitCode === null) proc.kill('SIGKILL'); }, 5000);
  });
}
