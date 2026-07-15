import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { fileSessionStore, validateSessionId } from './file.js';

let dir: string;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'litro-agent-store-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of it) out.push(v);
  return out;
}

describe('fileSessionStore', () => {
  it('assigns monotonic seq starting at 1 and persists to <id>.jsonl', async () => {
    const store = fileSessionStore({ dir });
    const a = await store.append('s1', { ts: 1, kind: 'message', payload: { role: 'user', text: 'hi' } });
    const b = await store.append('s1', { ts: 2, kind: 'turn-end', payload: null });
    expect([a.seq, b.seq]).toEqual([1, 2]);
    const raw = await readFile(join(dir, 's1.jsonl'), 'utf-8');
    expect(raw.trim().split('\n')).toHaveLength(2);
  });

  it('read streams from fromSeq inclusive and preserves order', async () => {
    const store = fileSessionStore({ dir });
    for (let i = 0; i < 5; i++) await store.append('s1', { ts: i, kind: 'text-delta', payload: String(i) });
    const events = await collect(store.read('s1', 3));
    expect(events.map((e) => e.seq)).toEqual([3, 4, 5]);
  });

  it('seq survives process restart (re-derived from the file)', async () => {
    const first = fileSessionStore({ dir });
    await first.append('s1', { ts: 1, kind: 'message', payload: 'a' });
    const second = fileSessionStore({ dir });   // fresh instance = fresh process
    const ev = await second.append('s1', { ts: 2, kind: 'message', payload: 'b' });
    expect(ev.seq).toBe(2);
  });

  it('serializes concurrent appends (no interleaved lines, strictly increasing seq)', async () => {
    const store = fileSessionStore({ dir });
    await Promise.all(Array.from({ length: 20 }, (_, i) => store.append('s1', { ts: i, kind: 'text-delta', payload: i })));
    const events = await collect(store.read('s1'));
    expect(events.map((e) => e.seq)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('tolerates malformed lines and reads an absent session as empty', async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'bad.jsonl'), '{"seq":1,"ts":1,"kind":"message","payload":"ok"}\nnot-json\n{"seq":3,"ts":3,"kind":"turn-end","payload":null}\n');
    const store = fileSessionStore({ dir });
    const events = await collect(store.read('bad'));
    expect(events.map((e) => e.seq)).toEqual([1, 3]);
    expect(await collect(store.read('missing'))).toEqual([]);
  });
});

describe('validateSessionId', () => {
  it('accepts [A-Za-z0-9_-]{1,64} and rejects traversal/oversize', () => {
    expect(() => validateSessionId('abc_DEF-123')).not.toThrow();
    for (const bad of ['../etc', 'a/b', '', 'x'.repeat(65), 'a.b']) {
      expect(() => validateSessionId(bad)).toThrow(/session id/i);
    }
  });
});
