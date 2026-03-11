import { createServer } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parsePortArg, probePort, resolvePort } from './port.js';

// Helper: bind a real TCP server on a port and return a cleanup function.
function bindPort(port: number): Promise<() => Promise<void>> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(port, () => {
      resolve(() => new Promise<void>((res) => server.close(() => res())));
    });
  });
}

describe('probePort', () => {
  it('returns true for a free port', async () => {
    // Port 0 → OS assigns an ephemeral port; we need a known-free port.
    // Use a high port unlikely to be in use.
    const free = await probePort(19847);
    expect(free).toBe(true);
  });

  it('returns false when a port is already occupied', async () => {
    const close = await bindPort(19848);
    try {
      expect(await probePort(19848)).toBe(false);
    } finally {
      await close();
    }
  });
});

describe('parsePortArg', () => {
  it('parses --port <n>', () => {
    expect(parsePortArg(['--port', '8080'])).toEqual({ port: 8080, explicit: true });
  });

  it('parses --port=<n>', () => {
    expect(parsePortArg(['--port=9000'])).toEqual({ port: 9000, explicit: true });
  });

  it('parses -p <n>', () => {
    expect(parsePortArg(['-p', '4000'])).toEqual({ port: 4000, explicit: true });
  });

  it('parses -p=<n>', () => {
    expect(parsePortArg(['-p=9000'])).toEqual({ port: 9000, explicit: true });
  });

  it('returns default when no flag present', () => {
    expect(parsePortArg([])).toEqual({ port: 3000, explicit: false });
  });

  it('respects a custom defaultPort', () => {
    expect(parsePortArg([], 4321)).toEqual({ port: 4321, explicit: false });
  });
});

describe('resolvePort', () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.restoreAllMocks();
  });

  it('returns the port as-is when free (implicit)', async () => {
    const result = await resolvePort(19849, false);
    expect(result).toBe(19849);
  });

  it('returns the port as-is when free (explicit)', async () => {
    const result = await resolvePort(19850, true);
    expect(result).toBe(19850);
  });

  it('auto-increments to next free port when default port is taken', async () => {
    close = await bindPort(19851);
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await resolvePort(19851, false);
    expect(result).toBe(19852);
    expect(consoleSpy).toHaveBeenCalledWith('[litro] Port 19851 in use, using 19852');
  });

  it('calls process.exit(1) when explicit port is taken', async () => {
    close = await bindPort(19853);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await resolvePort(19853, true);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Port 19853 is already in use'),
    );
  });
});
