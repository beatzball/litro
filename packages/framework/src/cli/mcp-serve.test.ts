/**
 * `litro mcp serve`'s argument handling, which is everything this command does
 * before Vite starts.
 *
 * Nothing here starts a server. The cases that need one are in
 * `packages/litro-agent/src/mcp-server/*.test.ts`, driven by the SDK's own
 * client, and against a real host by `playground/mcp-server/stdio-probe.mjs`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
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

/**
 * `--project`, which exists because a host launches this command with a working
 * directory of its own choosing — and at least one desktop host ignores a `cwd`
 * field in its server configuration entirely.
 *
 * These stop before Vite starts. The end-to-end proof, a real client driving a
 * server started from an unrelated directory, is
 * `playground/mcp-server/stdio-probe.mjs --project <dir>`.
 */
describe('--project', () => {
  let elsewhere: string;
  let project: string;

  beforeEach(() => {
    // Somewhere with no package.json and no relationship to a project: what a
    // host's working directory looks like from here.
    elsewhere = mkdtempSync(join(tmpdir(), 'litro-elsewhere-'));
    project = mkdtempSync(join(tmpdir(), 'litro-project-'));
    writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'fixture', type: 'module' }));
    mkdirSync(join(project, 'agents', 'demo', 'tools'), { recursive: true });
    writeFileSync(join(project, 'agents', 'demo', 'agent.ts'), '// fixture\n');
  });

  afterEach(() => {
    rmSync(elsewhere, { recursive: true, force: true });
    rmSync(project, { recursive: true, force: true });
  });

  it('refuses a working directory that is not a project, and names the flag', async () => {
    await expect(mcpCommand(['serve'], elsewhere)).resolves.toBe(1);
    const said = stderr.join('');
    expect(said).toContain('has no package.json, so it is not a project directory');
    expect(said).toContain('Pass --project <dir> when the host launches it somewhere else');
  });

  it('gets past that check when --project names a real project', async () => {
    // It must NOT fail on "this is not a project": the fixture has no installed
    // dependencies, so it fails later, on loading the agent layer. That later
    // failure is the proof the flag was honored.
    await expect(mcpCommand(['serve', '--project', project], elsewhere)).resolves.toBe(1);
    const said = stderr.join('');
    expect(said).not.toContain('is not a project directory');
    expect(said).toContain('@beatzball/litro-agent is not installed in this project');
  });

  it('does not suggest the flag to someone who already passed it', async () => {
    await expect(mcpCommand(['serve', '--project', join(elsewhere, 'nope')], elsewhere)).resolves.toBe(1);
    const said = stderr.join('');
    expect(said).toContain('Check the --project path.');
    expect(said).not.toContain('Pass --project <dir>');
  });

  it('resolves a relative --project against the working directory, as a shell would', async () => {
    await expect(mcpCommand(['serve', '--project', '../nowhere-at-all'], elsewhere)).resolves.toBe(1);
    // The message names the RESOLVED path, not the relative one, so the reader
    // can see where it actually looked.
    expect(stderr.join('')).toMatch(/nowhere-at-all has no package\.json/);
  });

  it('accepts --project=<dir> as well as --project <dir>', async () => {
    await expect(mcpCommand(['serve', `--project=${project}`], elsewhere)).resolves.toBe(1);
    expect(stderr.join('')).not.toContain('is not a project directory');
  });

  it('names the flag in its usage line', async () => {
    await mcpCommand(['list'], elsewhere);
    expect(stderr.join('')).toContain('--project <dir>');
  });
});
