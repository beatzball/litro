import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';

const mkdirCalls = { count: 0 };
const failNext = { mkdir: false };

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    mkdir: async (...args: Parameters<typeof actual.mkdir>) => {
      mkdirCalls.count++;
      if (failNext.mkdir) {
        failNext.mkdir = false;
        throw new Error('EACCES: simulated');
      }
      return actual.mkdir(...args);
    },
  };
});

// Import after the mock so fileSessionStore picks up the mocked mkdir.
const { fileSessionStore } = await import('./file.js');

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'litro-agent-store-mkdir-'));
  mkdirCalls.count = 0;
  failNext.mkdir = false;
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('fileSessionStore directory-creation hygiene', () => {
  it('calls mkdir once across many appends to the same and different sessions', async () => {
    const store = fileSessionStore({ dir });
    await store.append('s1', { ts: 1, kind: 'message', payload: 'a' });
    await store.append('s1', { ts: 2, kind: 'message', payload: 'b' });
    await store.append('s2', { ts: 3, kind: 'message', payload: 'c' });
    await Promise.all(
      Array.from({ length: 5 }, (_, i) => store.append('s3', { ts: i, kind: 'text-delta', payload: i })),
    );

    expect(mkdirCalls.count).toBe(1);
  });

  it('retries mkdir on the next append after a failure (no permanently-cached rejection)', async () => {
    const store = fileSessionStore({ dir });

    failNext.mkdir = true;
    await expect(store.append('s1', { ts: 1, kind: 'message', payload: 'a' })).rejects.toThrow(/EACCES/);
    expect(mkdirCalls.count).toBe(1);

    const ev = await store.append('s1', { ts: 2, kind: 'message', payload: 'b' });
    expect(ev.seq).toBe(1);
    expect(mkdirCalls.count).toBe(2);
  });
});
