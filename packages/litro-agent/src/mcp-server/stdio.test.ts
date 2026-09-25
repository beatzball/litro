/**
 * `serveMcpStdio`'s lifetime contract.
 *
 * A stdio server's life is its host's: when the host closes stdin, the process
 * has no reason to exist. Nothing ends it on its own, because the Vite server
 * the CLI keeps open holds the event loop — so without this, every start and
 * stop leaves an orphaned Node process behind. Nine accumulated in one session
 * of testing, and one of them held Vite's HMR port against an unrelated build.
 *
 * This pins the signal. That the CLI acts on it is proved by running it:
 * `playground/mcp-server/stdio-probe.mjs`, and the process count in the report.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Writable } from 'node:stream';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { defineAgent, defineTool } from '../index.js';
import { serveMcpStdio } from './index.js';
import { convertingSchema } from './fixtures.js';

let rootDir: string | undefined;

afterEach(async () => {
  if (rootDir) await rm(rootDir, { recursive: true, force: true });
  rootDir = undefined;
});

/** A project on disk for the scanner, plus a loader that answers for its files.
 *  Same shape as `resolve.test.ts` — the scanner walks the filesystem and the
 *  loader is what turns a path into a module, exactly as Vite does. */
async function project(): Promise<(id: string) => Promise<Record<string, unknown>>> {
  rootDir = await mkdtemp(join(tmpdir(), 'litro-stdio-'));
  const dir = join(rootDir, 'agents', 'demo');
  await mkdir(join(dir, 'tools'), { recursive: true });
  await writeFile(join(dir, 'agent.ts'), '// fixture\n');
  await writeFile(join(dir, 'tools', 'search.ts'), '// fixture\n');
  const modules = new Map<string, Record<string, unknown>>([
    [join(dir, 'agent.ts'), { default: defineAgent({ model: null as never, instructions: 'Be brief.' }) }],
    [
      join(dir, 'tools', 'search.ts'),
      { default: defineTool({ description: 'Search.', input: convertingSchema(), execute: () => ({ ok: true }) }) },
    ],
  ]);
  return async (id: string) => {
    const mod = modules.get(id);
    // Anything else is the SDK, which this test wants the real one of.
    if (!mod) return (await import(/* @vite-ignore */ id)) as Record<string, unknown>;
    return mod;
  };
}

/** Swallows the transport's writes. Passing a stream also stops
 *  `serveMcpStdio` taking the process's real stdout, which would redirect
 *  vitest's own output for the rest of the run. */
function sink(): Writable {
  return new Writable({ write(_chunk, _enc, cb) { cb(); } });
}

describe('serveMcpStdio', () => {
  it('reports the agent, its tools and its apps once it is serving', async () => {
    const load = await project();
    const running = await serveMcpStdio({ cwd: rootDir!, load, stdout: sink(), log: () => {} });
    try {
      expect(running.agentName).toBe('demo');
      expect(running.toolNames).toEqual(['search']);
      expect(running.appUris).toEqual([]);
    } finally {
      await running.close();
    }
  });

  it('resolves `closed` when the connection ends, so the caller can shut down', async () => {
    const load = await project();
    const running = await serveMcpStdio({ cwd: rootDir!, load, stdout: sink(), log: () => {} });

    let resolved = false;
    void running.closed.then(() => {
      resolved = true;
    });
    // Still serving: nothing has disconnected yet.
    await new Promise((r) => setTimeout(r, 10));
    expect(resolved).toBe(false);

    await running.close();
    // A race against a timer, so a regression fails the test rather than
    // hanging the suite until vitest's own timeout.
    await expect(
      Promise.race([
        running.closed.then(() => 'closed'),
        new Promise((r) => setTimeout(() => r('still open'), 2000)),
      ]),
    ).resolves.toBe('closed');
  });
});
