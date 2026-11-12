import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { SSG_PORT, SSR_PORT, ROOT_DIR, SERVER_READY_TIMEOUT } from '../config.js';

const servers = new Set<ChildProcess>();
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Fail on an occupied port instead of measuring a stale server or a fallback port. */
export async function assertPortAvailable(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const probe = createServer();
    probe.once('error', () => reject(new Error(`Benchmark port ${port} is already in use`)));
    probe.listen({ port, exclusive: true }, () => probe.close(error => error ? reject(error) : resolve()));
  });
}

export async function startCommand(
  command: string,
  args: string[],
  cwd: string,
  port: number,
  label: string,
  shell = false,
  env?: Record<string, string>,
): Promise<ChildProcess> {
  await assertPortAvailable(port);
  const proc = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env, PORT: String(port) },
    stdio: 'pipe',
    shell,
    // A shell/pnpm/npx wrapper can exit before its actual server does. Keep the
    // whole tree in a separate process group so teardown reaches descendants.
    detached: process.platform !== 'win32',
  });
  servers.add(proc);
  proc.stdout?.resume();
  proc.stderr?.on('data', (data: Buffer) => {
    const message = data.toString().trim();
    if (message) console.error(`[${label}] ${message}`);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      proc.once('spawn', resolve);
      proc.once('error', reject);
    });
  } catch (error) {
    servers.delete(proc);
    throw error;
  }
  return proc;
}

export async function startServer(mode: 'ssg' | 'ssr'): Promise<ChildProcess> {
  const port = mode === 'ssg' ? SSG_PORT : SSR_PORT;
  const script = mode === 'ssg' ? 'preview:docs' : 'preview:docs-ssr';
  return startCommand('pnpm', [script, '--', '--port', String(port)], ROOT_DIR, port, mode);
}

export async function waitForReady(
  url: string,
  timeout = SERVER_READY_TIMEOUT,
  proc?: ChildProcess,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (proc && (proc.exitCode !== null || proc.signalCode !== null)) {
      throw new Error('Benchmark server exited before becoming ready');
    }
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(Math.min(1000, timeout)) });
      await res.body?.cancel();
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await delay(100);
  }
  throw new Error(`Server did not become ready within ${timeout}ms`);
}

function signalTree(proc: ChildProcess, signal: NodeJS.Signals | 0): boolean {
  if (!proc.pid) return false;
  try {
    if (process.platform === 'win32') {
      if (proc.exitCode !== null || proc.signalCode !== null) return false;
      return proc.kill(signal);
    }
    process.kill(-proc.pid, signal);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw error;
  }
}

export async function stopServer(proc: ChildProcess): Promise<void> {
  signalTree(proc, 'SIGTERM');
  const deadline = Date.now() + 2000;
  while (signalTree(proc, 0) && Date.now() < deadline) await delay(25);
  if (signalTree(proc, 0)) {
    signalTree(proc, 'SIGKILL');
    // Give the OS time to release listening sockets before the next app starts.
    const killDeadline = Date.now() + 1000;
    while (signalTree(proc, 0) && Date.now() < killDeadline) await delay(25);
  }
  servers.delete(proc);
}

export async function stopAllServers(): Promise<void> {
  await Promise.all([...servers].map(stopServer));
}
