/**
 * `litro mcp serve`'s argument handling, which is everything this command does
 * before Vite starts.
 *
 * Nothing here starts a server. The cases that need one are in
 * `packages/litro-agent/src/mcp-server/*.test.ts`, driven by the SDK's own
 * client, and against a real host by `playground/mcp-server/stdio-probe.mjs`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mcpCommand } from './mcp-serve.js';

let stderr: string[];
let writeSpy: { mockRestore(): void };

beforeEach(() => {
  stderr = [];
  writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: unknown) => {
    stderr.push(String(chunk));
    return true;
  }) as typeof process.stderr.write);
});

afterEach(() => {
  writeSpy.mockRestore();
});

describe('mcpCommand', () => {
  it('prints usage and exits 2 for an unknown subcommand', async () => {
    await expect(mcpCommand(['list'], process.cwd())).resolves.toBe(2);
    expect(stderr.join('')).toContain('usage: litro mcp serve');
  });

  it('prints usage for no subcommand at all', async () => {
    await expect(mcpCommand([], process.cwd())).resolves.toBe(2);
    expect(stderr.join('')).toContain('usage: litro mcp serve');
  });

  it.each([
    ['--timeout', 'milliseconds'],
    ['--max-result-bytes', 'bytes'],
  ])('refuses a non-numeric %s before starting anything', async (flag, unit) => {
    await expect(mcpCommand(['serve', flag, 'soon'], process.cwd())).resolves.toBe(2);
    expect(stderr.join('')).toContain(`${flag} takes a positive whole number of ${unit}`);
  });

  it('refuses zero and a negative timeout — a cap of none is not a cap', async () => {
    await expect(mcpCommand(['serve', '--timeout', '0'], process.cwd())).resolves.toBe(2);
    await expect(mcpCommand(['serve', '--timeout', '-5'], process.cwd())).resolves.toBe(2);
  });

  it('writes NOTHING to stdout, whatever it is asked — that is the JSON-RPC channel', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((() => true) as typeof process.stdout.write);
    try {
      await mcpCommand(['nonsense'], process.cwd());
      expect(stdoutSpy).not.toHaveBeenCalled();
    } finally {
      stdoutSpy.mockRestore();
    }
  });
});
