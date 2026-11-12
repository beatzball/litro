import childProcess, { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { SSG_PORT, SSR_PORT, ROOT_DIR, SERVER_READY_TIMEOUT } from '../config.js';

interface GroupMember {
  pid: number;
  uid: number;
  state: string;
  identity: string;
}
interface ServerState {
  port: number;
  identities: Set<string>;
  retired: boolean;
  stopping?: Promise<void>;
}
const servers = new Map<ChildProcess, ServerState>();
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
  const state: ServerState = { port, identities: new Set(), retired: false };
  servers.set(proc, state);
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
  if (process.platform !== 'win32' && proc.pid) {
    for (const member of readGroup(proc.pid)) state.identities.add(member.identity);
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
    if (proc && process.platform !== 'win32') ownedGroup(proc);
    let ready = false;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(Math.min(1000, timeout)) });
      await res.body?.cancel();
      ready = res.ok;
    } catch {
      // not ready yet
    }
    if (ready) {
      if (proc && process.platform !== 'win32') ownedGroup(proc);
      return;
    }
    await delay(100);
  }
  throw new Error(`Server did not become ready within ${timeout}ms`);
}

/** Read identities as well as group IDs: a saved wrapper PID can be reused. */
function readGroup(pgid: number): GroupMember[] {
  const output = childProcess.execFileSync('ps', ['-axo', 'pid=,pgid=,uid=,stat=,lstart='], {
    encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' }, timeout: 2000,
  });
  return output.trim().split('\n').flatMap(line => {
    const fields = line.trim().split(/\s+/);
    if (Number(fields[1]) !== pgid) return [];
    return [{
      pid: Number(fields[0]), uid: Number(fields[2]), state: fields[3],
      identity: [fields[0], fields[2], ...fields.slice(4)].join(' '),
    }];
  });
}

function ownedGroup(proc: ChildProcess): GroupMember[] {
  const state = servers.get(proc);
  if (!state || state.retired || !proc.pid) return [];
  const members = readGroup(proc.pid);
  const live = members.filter(member => !member.state.includes('Z'));
  // Zombies cannot hold listening sockets or receive another signal. Check
  // membership directly instead of inferring liveness from killpg errors.
  if (!live.length) {
    state.retired = true;
    return [];
  }
  const leader = members.find(member => member.pid === proc.pid);
  if (live.some(member => member.uid !== process.getuid?.()) ||
      (leader && !state.identities.has(leader.identity)) ||
      !members.some(member => state.identities.has(member.identity))) {
    throw new Error('Refusing to signal a benchmark process group whose identity changed');
  }
  for (const member of members) state.identities.add(member.identity);
  return live;
}

function signalTree(proc: ChildProcess, signal: NodeJS.Signals): void {
  if (!proc.pid) return;
  if (process.platform === 'win32') {
    if (proc.exitCode === null && proc.signalCode === null) proc.kill(signal);
    return;
  }
  if (!ownedGroup(proc).length) return;
  try {
    process.kill(-proc.pid, signal);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    // Confirm that the group disappeared; a live group's EPERM is a failure.
    if ((code === 'ESRCH' || code === 'EPERM') && !ownedGroup(proc).length) return;
    throw error;
  }
}

function treeIsAlive(proc: ChildProcess): boolean {
  return process.platform === 'win32'
    ? proc.exitCode === null && proc.signalCode === null
    : ownedGroup(proc).length > 0;
}

export async function stopServer(proc: ChildProcess): Promise<void> {
  const state = servers.get(proc);
  // Never signal a numeric PID again after successful teardown.
  if (!state) return;
  if (state.stopping) return state.stopping;
  state.stopping = (async () => {
    signalTree(proc, 'SIGTERM');
    const deadline = Date.now() + 2000;
    while (treeIsAlive(proc) && Date.now() < deadline) await delay(25);
    if (treeIsAlive(proc)) {
      signalTree(proc, 'SIGKILL');
      const killDeadline = Date.now() + 1000;
      while (treeIsAlive(proc) && Date.now() < killDeadline) await delay(25);
    }
    if (treeIsAlive(proc)) throw new Error('Benchmark server process group survived cleanup');
    await assertPortAvailable(state.port);
    servers.delete(proc);
  })();
  try { await state.stopping; }
  catch (error) {
    state.stopping = undefined;
    throw error;
  }
}

export async function stopAllServers(): Promise<void> {
  const results = await Promise.allSettled([...servers.keys()].map(stopServer));
  const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason] : []);
  if (errors.length) throw new AggregateError(errors, 'Benchmark server cleanup failed');
}
