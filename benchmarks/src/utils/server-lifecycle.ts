import { spawn, type ChildProcess } from 'node:child_process';
import { SSG_PORT, SSR_PORT, ROOT_DIR, SERVER_READY_TIMEOUT } from '../config.js';

export async function startServer(mode: 'ssg' | 'ssr'): Promise<ChildProcess> {
  const port = mode === 'ssg' ? SSG_PORT : SSR_PORT;
  const script = mode === 'ssg' ? 'preview:docs' : 'preview:docs-ssr';

  const proc = spawn('pnpm', [script, '--', '--port', String(port)], {
    cwd: ROOT_DIR,
    env: { ...process.env, PORT: String(port) },
    stdio: 'pipe',
  });

  proc.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString();
    if (msg.trim()) console.error(`[${mode}] ${msg.trim()}`);
  });

  return proc;
}

export async function waitForReady(url: string, timeout = SERVER_READY_TIMEOUT): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeout}ms`);
}

export async function stopServer(proc: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (proc.exitCode !== null) {
      resolve();
      return;
    }
    proc.on('exit', () => resolve());
    proc.kill('SIGTERM');
    setTimeout(() => {
      if (proc.exitCode === null) proc.kill('SIGKILL');
    }, 5000);
  });
}
