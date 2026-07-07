import { describe, it, expect } from 'vitest';
import * as stream from '../stream.js';
import * as serialize from '../actions/serialize.js';

describe('@beatzball/litro/stream subpath', () => {
  it('re-exports the actions serializer functions (same identities)', () => {
    expect(stream.createStreamEncoder).toBe(serialize.createStreamEncoder);
    expect(stream.createStreamDecoder).toBe(serialize.createStreamDecoder);
    expect(stream.serializeValue).toBe(serialize.serializeValue);
    expect(stream.deserializeValue).toBe(serialize.deserializeValue);
    expect(stream.isAsyncIterable).toBe(serialize.isAsyncIterable);
  });

  it('round-trips a Date through the NDJSON line protocol', () => {
    const enc = stream.createStreamEncoder();
    const dec = stream.createStreamDecoder();
    const chunk = dec(enc.value({ at: new Date('2026-07-07T00:00:00.000Z') }).slice(0, -1));
    expect(chunk.kind).toBe('value');
    expect((chunk as { value: { at: Date } }).value.at).toBeInstanceOf(Date);
  });
});
