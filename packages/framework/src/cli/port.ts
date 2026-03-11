import { createConnection } from 'node:net';
import process from 'node:process';

/**
 * Probe whether a TCP port is available on localhost.
 * Returns true if the port is free, false if it is already in use.
 *
 * Uses a connect probe rather than a bind probe so it detects all listeners
 * on 127.0.0.1 — including Docker Desktop's port-forwarding on macOS, which
 * occupies ports through a userspace proxy that may not hold a conventional
 * bound socket visible to a bind attempt.
 */
export function probePort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: '127.0.0.1' });
    socket.setTimeout(300);
    socket.once('connect', () => {
      socket.destroy();
      resolve(false); // something accepted the connection → port in use
    });
    socket.once('error', (err: NodeJS.ErrnoException) => {
      socket.destroy();
      resolve(err.code === 'ECONNREFUSED'); // ECONNREFUSED = nothing listening → free
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false); // conservative: treat a hanging connection as in use
    });
  });
}

/**
 * Parse --port / -p from an argv array.
 * Returns { port, explicit: true } when the flag is present,
 * { port: defaultPort, explicit: false } otherwise.
 */
export function parsePortArg(
  args: string[],
  defaultPort = 3000,
): { port: number; explicit: boolean } {
  const inline = args.find((a) => a.startsWith('--port=') || a.startsWith('-p='));
  if (inline) {
    return { port: Number(inline.split('=')[1]), explicit: true };
  }
  const flagIdx = args.findIndex((a) => a === '--port' || a === '-p');
  if (flagIdx !== -1 && args[flagIdx + 1] !== undefined) {
    return { port: Number(args[flagIdx + 1]), explicit: true };
  }
  return { port: defaultPort, explicit: false };
}

/**
 * Resolve a port for use by the dev/preview server.
 *
 * - explicit + taken  → print error, process.exit(1)
 * - default + taken   → increment until free, print notice once
 * - free              → return as-is
 */
export async function resolvePort(port: number, explicit: boolean): Promise<number> {
  if (await probePort(port)) {
    return port;
  }

  if (explicit) {
    console.error(`[litro] Port ${port} is already in use. Choose a different port with --port.`);
    process.exit(1);
  }

  // Auto-increment until we find a free port.
  const original = port;
  let candidate = port + 1;
  while (!(await probePort(candidate))) {
    candidate++;
  }
  console.log(`[litro] Port ${original} in use, using ${candidate}`);
  return candidate;
}
