/** Real host proof. No model, mock server, or host-side command substitutes. */
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { TOOL_CONFIG, type UIResult } from '@beatzball/litro-agent';
import { Sandpiper } from '@beatzball/sandpiper';
import runCode from '../agents/coder/tools/run-code.js';
import { machines, sessionMachines } from '../server/machines.js';

it.skipIf(!process.env.SANDPIPER_URL)('runs Node in a real session machine, renders SSR, and refuses internet access', async () => {
  const { SANDPIPER_URL: baseUrl, SANDPIPER_TOKEN: token } = process.env;
  if (!baseUrl || !token) throw new Error('Set SANDPIPER_URL and SANDPIPER_TOKEN for the real host proof.');
  const directory = await mkdtemp(join(tmpdir(), 'litro-run-code-vm-'));
  const previous = process.env.SANDPIPER_SESSIONS_DIR;
  process.env.SANDPIPER_SESSIONS_DIR = directory;
  const ctx = { event: undefined, session: { id: `proof-${randomUUID()}`, seq: 1 } };
  const execute = (cmd: string[]) => runCode[TOOL_CONFIG].execute({ cmd }, ctx) as Promise<UIResult>;
  let machine: Awaited<ReturnType<typeof machines.forSession>> | undefined;
  try {
    machine = await machines.forSession(ctx.session.id, { template: 'node' });
    const node = await execute(['node', '-e', 'console.log(1+1)']);
    expect(node.data).toEqual({ exitCode: 0, stdout: '2\n', stderr: '' });
    expect(node.html).toContain('<run-output');
    expect(node.html).toContain('shadowrootmode="open"');
    expect(node.html).toContain('Exit code: 0');
    expect(node.html).toMatch(/id="stdout">[\s\S]*?2\n/);
    const reloaded = sessionMachines(new Sandpiper({ baseUrl, token }), directory, baseUrl);
    expect((await reloaded.forSession(ctx.session.id, { template: 'node' })).id).toBe(machine.id);
    const blocked = await execute(['wget', '-T', '3', '-O', '-', 'http://1.1.1.1']);
    const data = blocked.data as { exitCode: number | null; stdout: string; stderr: string };
    expect(data.exitCode).not.toBeNull();
    expect(data.exitCode).toBeGreaterThan(0);
    expect(data.stderr).toMatch(/network|connect|route|timed out/i);
    expect(blocked.html).toContain('shadowrootmode="open"');
    expect(blocked.html).toContain(`Exit code: ${data.exitCode}`);
    console.log('PASS: Node returned 2; session binding reused; run-output SSR rendered; internet request failed.');
  } finally {
    try { await machine?.destroy(); } finally {
      if (previous === undefined) delete process.env.SANDPIPER_SESSIONS_DIR;
      else process.env.SANDPIPER_SESSIONS_DIR = previous;
      await rm(directory, { recursive: true, force: true });
    }
  }
});
