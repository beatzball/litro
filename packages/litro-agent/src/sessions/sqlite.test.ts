import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { createRequire } from 'node:module';
import { sqliteSessionStore, type SqliteSessionStore } from './sqlite.js';
import type { SessionEvent } from './types.js';

/** node:sqlite needs Node 22.5+. The repo's engines range still admits
 *  Node 20, so skip rather than hard-fail for a contributor on an older
 *  runtime. CI runs Node 24, where these always execute. */
function hasNodeSqlite(): boolean {
  try {
    createRequire(import.meta.url)('node:sqlite');
    return true;
  } catch {
    return false;
  }
}
const d = describe.skipIf(!hasNodeSqlite());

let dir: string;
const open: SqliteSessionStore[] = [];

function store(file = 'sessions.db'): SqliteSessionStore {
  const s = sqliteSessionStore({ path: join(dir, file) });
  open.push(s);
  return s;
}

async function drain(s: SqliteSessionStore, sessionId: string, from?: number): Promise<SessionEvent[]> {
  const out: SessionEvent[] = [];
  for await (const ev of s.read(sessionId, from)) out.push(ev);
  return out;
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'litro-agent-sqlite-'));
});
afterEach(async () => {
  for (const s of open.splice(0)) {
    try {
      s.close();
    } catch {
      // already closed by the test
    }
  }
  await rm(dir, { recursive: true, force: true });
});

d('sqliteSessionStore -- construction', () => {
  // Regression: SQLite opens a file but never creates the directory holding
  // it, so a missing parent used to surface as a bare `unable to open
  // database file` at construction. In a server that means the process fails
  // to boot -- and the documented path is `.litro/sessions.db`, inside a
  // gitignored directory that does not exist on a fresh clone. The JSONL
  // store creates its own directory, so a project swapping stores expects
  // the same.
  it('creates a missing parent directory rather than failing to open', () => {
    const path = join(dir, 'does', 'not', 'exist', 'sessions.db');
    expect(existsSync(join(dir, 'does'))).toBe(false);

    const s = sqliteSessionStore({ path });
    open.push(s);

    expect(existsSync(path)).toBe(true);
  });

  it('is idempotent when the directory already exists', () => {
    const path = join(dir, 'nested', 'sessions.db');
    open.push(sqliteSessionStore({ path }));
    // A second store over the same directory must not throw on the mkdir.
    expect(() => open.push(sqliteSessionStore({ path: join(dir, 'nested', 'other.db') }))).not.toThrow();
  });

  // ':memory:' has no file on disk. Treating it as a path would have created
  // a stray `.` -relative directory named after it.
  it('does not touch the filesystem for an in-memory database', () => {
    const s = sqliteSessionStore({ path: ':memory:' });
    open.push(s);
    expect(existsSync(':memory:')).toBe(false);
  });
});

d('sqliteSessionStore -- store contract', () => {
  it('assigns monotonic seq starting at 1 and reads events back in order', async () => {
    const s = store();
    await s.append('s1', { ts: 1, kind: 'message', payload: { role: 'user', text: 'hi' } });
    await s.append('s1', { ts: 2, kind: 'text-delta', payload: { text: 'he' } });
    await s.append('s1', { ts: 3, kind: 'turn-end', payload: null });

    const events = await drain(s, 's1');
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(events.map((e) => e.kind)).toEqual(['message', 'text-delta', 'turn-end']);
    expect(events[0].payload).toEqual({ role: 'user', text: 'hi' });
    expect(events[2].payload).toBe(null);
    expect(events[1].ts).toBe(2);
  });

  it('returns the event it assigned, with the seq filled in', async () => {
    const s = store();
    const ev = await s.append('s1', { ts: 7, kind: 'message', payload: { a: 1 } });
    expect(ev).toEqual({ seq: 1, ts: 7, kind: 'message', payload: { a: 1 } });
  });

  it('reads a suffix from a given seq, inclusive', async () => {
    const s = store();
    for (let i = 0; i < 5; i++) await s.append('s1', { ts: i, kind: 'text-delta', payload: { i } });

    expect((await drain(s, 's1', 0)).map((e) => e.seq)).toEqual([1, 2, 3, 4, 5]);
    expect((await drain(s, 's1', 3)).map((e) => e.seq)).toEqual([3, 4, 5]);
    expect(await drain(s, 's1', 99)).toEqual([]);
  });

  it('keeps sessions independent', async () => {
    const s = store();
    await s.append('a', { ts: 1, kind: 'message', payload: 'a1' });
    await s.append('b', { ts: 1, kind: 'message', payload: 'b1' });
    await s.append('a', { ts: 2, kind: 'message', payload: 'a2' });

    expect((await drain(s, 'a')).map((e) => e.payload)).toEqual(['a1', 'a2']);
    expect((await drain(s, 'b')).map((e) => e.seq)).toEqual([1]);
  });

  it('returns an empty read for an unknown session', async () => {
    expect(await drain(store(), 'never-written')).toEqual([]);
  });

  it('rejects an invalid session id on both append and read', async () => {
    const s = store();
    await expect(s.append('../escape', { ts: 1, kind: 'message', payload: null })).rejects.toThrow(/Invalid session id/);
    await expect(drain(s, 'has spaces')).rejects.toThrow(/Invalid session id/);
  });

  it('serialises concurrent appends into unique contiguous seqs', async () => {
    const s = store();
    const results = await Promise.all(
      Array.from({ length: 25 }, (_, i) => s.append('s1', { ts: i, kind: 'text-delta', payload: { i } })),
    );

    const seqs = results.map((e) => e.seq).sort((a, b) => a - b);
    expect(seqs).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect((await drain(s, 's1')).map((e) => e.seq)).toEqual(seqs);
  });
});

d('sqliteSessionStore -- crash safety', () => {
  it('resumes seq numbering from the database, not an in-memory counter', async () => {
    const first = store();
    await first.append('s1', { ts: 1, kind: 'message', payload: 1 });
    await first.append('s1', { ts: 2, kind: 'message', payload: 2 });
    first.close();

    // A brand new process would build a brand new store over the same file.
    const second = store();
    const ev = await second.append('s1', { ts: 3, kind: 'message', payload: 3 });
    expect(ev.seq).toBe(3);
    expect((await drain(second, 's1')).map((e) => e.seq)).toEqual([1, 2, 3]);
  });

  it('mints unique seqs across two independent stores on one file', async () => {
    const a = store();
    const b = store();

    const results = await Promise.all([
      ...Array.from({ length: 10 }, (_, i) => a.append('s1', { ts: i, kind: 'text-delta', payload: { from: 'a', i } })),
      ...Array.from({ length: 10 }, (_, i) => b.append('s1', { ts: i, kind: 'text-delta', payload: { from: 'b', i } })),
    ]);

    const seqs = results.map((e) => e.seq).sort((x, y) => x - y);
    expect(new Set(seqs).size).toBe(20);
    expect(seqs).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
});

d('sqliteSessionStore -- lease', () => {
  it('grants one holder and refuses a second', async () => {
    const s = store();
    const held = await s.acquireLease!('demo/s1');
    expect(held).not.toBeNull();
    expect(await s.acquireLease!('demo/s1')).toBeNull();
    expect(await s.isLeased!('demo/s1')).toBe(true);
  });

  it('refuses a second holder across two independent stores on one file', async () => {
    const a = store();
    const b = store();
    expect(await a.acquireLease!('demo/s1')).not.toBeNull();
    expect(await b.acquireLease!('demo/s1')).toBeNull();
    expect(await b.isLeased!('demo/s1')).toBe(true);
  });

  it('frees the key on release', async () => {
    const a = store();
    const b = store();
    const lease = await a.acquireLease!('demo/s1');
    await lease!.release();

    expect(await b.isLeased!('demo/s1')).toBe(false);
    expect(await b.acquireLease!('demo/s1')).not.toBeNull();
  });

  it('release is idempotent and does not free a lease taken over since', async () => {
    const a = store();
    const b = store();
    const first = await a.acquireLease!('demo/s1');
    await first!.release();
    const second = await b.acquireLease!('demo/s1');

    await first!.release(); // second call, must be a no-op
    expect(await b.isLeased!('demo/s1')).toBe(true);
    expect(second!.owner).not.toBe(first!.owner);
  });

  it('keys are independent -- one session does not block another', async () => {
    const s = store();
    expect(await s.acquireLease!('demo/s1')).not.toBeNull();
    expect(await s.acquireLease!('demo/s2')).not.toBeNull();
    expect(await s.acquireLease!('other/s1')).not.toBeNull();
    expect(await s.isLeased!('demo/s3')).toBe(false);
  });

  it('renews while owned', async () => {
    const s = store();
    const lease = await s.acquireLease!('demo/s1', { ttlMs: 50 });
    expect(await lease!.renew()).toBe(true);
    expect(await s.isLeased!('demo/s1')).toBe(true);
  });

  it('lets another instance take over an EXPIRED lease, and the old owner learns it', async () => {
    const a = store();
    const b = store();
    const stale = await a.acquireLease!('demo/s1', { ttlMs: 1 });
    expect(stale).not.toBeNull();

    await new Promise((r) => setTimeout(r, 20));
    expect(await b.isLeased!('demo/s1')).toBe(false);

    const fresh = await b.acquireLease!('demo/s1');
    expect(fresh).not.toBeNull();
    // the lapsed owner's heartbeat now reports the loss instead of
    // silently extending a lease someone else holds
    expect(await stale!.renew()).toBe(false);
    expect(await b.isLeased!('demo/s1')).toBe(true);
  });

  it('a renew after release reports false rather than resurrecting the lease', async () => {
    const s = store();
    const lease = await s.acquireLease!('demo/s1');
    await lease!.release();
    expect(await lease!.renew()).toBe(false);
    expect(await s.isLeased!('demo/s1')).toBe(false);
  });
});

d('sqliteSessionStore -- malformed rows', () => {
  it('skips an unparseable payload rather than ending the replay', async () => {
    const s = store();
    await s.append('s1', { ts: 1, kind: 'message', payload: 'first' });
    await s.append('s1', { ts: 2, kind: 'message', payload: 'second' });

    // Corrupt row 1 the way only an outside writer could.
    const require = createRequire(import.meta.url);
    const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (p: string) => { exec(q: string): void; close(): void } };
    const raw = new DatabaseSync(join(dir, 'sessions.db'));
    raw.exec("UPDATE events SET payload = '{not json' WHERE seq = 1");
    raw.close();

    const events = await drain(s, 's1');
    expect(events.map((e) => e.seq)).toEqual([2]);
    expect(events[0].payload).toBe('second');
  });
});
