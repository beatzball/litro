import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';

const failNext = { appendFile: false };

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    appendFile: async (...args: Parameters<typeof actual.appendFile>) => {
      if (failNext.appendFile) {
        failNext.appendFile = false;
        throw new Error('ENOSPC: simulated');
      }
      return actual.appendFile(...args);
    },
  };
});

// Import after the mock so fileSessionStore picks up the mocked appendFile.
const { fileSessionStore } = await import('./file.js');

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'litro-agent-store-recovery-'));
  failNext.appendFile = false;
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of it) out.push(v);
  return out;
}

describe('fileSessionStore append chain recovery', () => {
  it('recovers from a failed append: chain is not poisoned, seq is not consumed', async () => {
    const store = fileSessionStore({ dir });

    // First append succeeds: seq 1.
    const a = await store.append('s1', { ts: 1, kind: 'message', payload: 'a' });
    expect(a.seq).toBe(1);

    // Second append fails at the fs layer.
    failNext.appendFile = true;
    await expect(
      store.append('s1', { ts: 2, kind: 'message', payload: 'b' })
    ).rejects.toThrow(/ENOSPC/);

    // Third append must succeed and must NOT have consumed a seq for the failed one.
    const c = await store.append('s1', { ts: 3, kind: 'message', payload: 'c' });
    expect(c.seq).toBe(2);

    const events = await collect(store.read('s1'));
    expect(events.map((e) => e.seq)).toEqual([1, 2]);
    expect(events.map((e) => e.payload)).toEqual(['a', 'c']);
  });
});
