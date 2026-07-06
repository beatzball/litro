import { describe, it, expect } from 'vitest';
import {
  createStreamEncoder,
  createStreamDecoder,
  isAsyncIterable,
  type StreamChunk,
} from '../serialize.js';

describe('stream chunk encoder/decoder', () => {
  it('round-trips multiple chunks, reviving rich values like Date', () => {
    const enc = createStreamEncoder();
    const dec = createStreamDecoder();
    const d = new Date('2026-07-06T00:00:00.000Z');
    const lines = [enc.value({ i: 1, at: d }), enc.value({ i: 2 }), enc.done()];
    for (const line of lines) {
      expect(line.endsWith('\n')).toBe(true);
      expect(line.slice(0, -1)).not.toContain('\n');
    }
    const chunks = lines.map((l) => dec(l.slice(0, -1)));
    expect(chunks[0].kind).toBe('value');
    const first = (chunks[0] as { kind: 'value'; value: { i: number; at: Date } }).value;
    expect(first.at).toBeInstanceOf(Date);
    expect(first.at.toISOString()).toBe('2026-07-06T00:00:00.000Z');
    expect((chunks[1] as { kind: 'value'; value: { i: number } }).value.i).toBe(2);
    expect(chunks[2]).toEqual({ kind: 'done' });
  });

  it('shares references across chunks (same object twice revives to one identity)', () => {
    const enc = createStreamEncoder();
    const dec = createStreamDecoder();
    const shared = { tag: 'shared' };
    const c1 = dec(enc.value({ first: shared }).slice(0, -1)) as { kind: 'value'; value: { first: unknown } };
    const c2 = dec(enc.value({ second: shared }).slice(0, -1)) as { kind: 'value'; value: { second: unknown } };
    expect(c1.value.first).toBe(c2.value.second);
  });

  it('encodes and decodes error lines', () => {
    const enc = createStreamEncoder();
    const dec = createStreamDecoder();
    const chunk: StreamChunk = dec(
      enc.error({ name: 'LitroActionError', message: 'boom', status: 500 }).slice(0, -1),
    );
    expect(chunk).toEqual({
      kind: 'error',
      payload: { name: 'LitroActionError', message: 'boom', status: 500 },
    });
  });

  it('isAsyncIterable detects async generators and rejects plain values', async () => {
    async function* gen() {
      yield 1;
    }
    expect(isAsyncIterable(gen())).toBe(true);
    expect(isAsyncIterable([1, 2])).toBe(false);
    expect(isAsyncIterable(null)).toBe(false);
    expect(isAsyncIterable(Promise.resolve(1))).toBe(false);
    expect(isAsyncIterable('str')).toBe(false);
  });
});
