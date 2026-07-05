import { describe, it, expect } from 'vitest';
import { serializeValue, deserializeValue } from '../serialize.js';

function roundTrip(value: unknown): unknown {
  return deserializeValue(serializeValue(value));
}

describe('serializeValue / deserializeValue', () => {
  it('round-trips plain JSON values', () => {
    expect(roundTrip({ a: 1, b: 'two', c: [true, null] })).toEqual({ a: 1, b: 'two', c: [true, null] });
  });

  it('round-trips Date as a real Date', () => {
    const d = new Date('2026-07-03T12:00:00.000Z');
    const out = roundTrip({ at: d }) as { at: Date };
    expect(out.at).toBeInstanceOf(Date);
    expect(out.at.toISOString()).toBe('2026-07-03T12:00:00.000Z');
  });

  it('round-trips Map and Set', () => {
    const out = roundTrip({ m: new Map([['k', 1]]), s: new Set([1, 2]) }) as { m: Map<string, number>; s: Set<number> };
    expect(out.m).toBeInstanceOf(Map);
    expect(out.m.get('k')).toBe(1);
    expect(out.s).toBeInstanceOf(Set);
    expect(out.s.has(2)).toBe(true);
  });

  it('round-trips BigInt', () => {
    expect(roundTrip(123456789012345678901234567890n)).toBe(123456789012345678901234567890n);
  });

  it('round-trips circular references', () => {
    const obj: { self?: unknown } = {};
    obj.self = obj;
    const out = roundTrip(obj) as { self: unknown };
    expect(out.self).toBe(out);
  });

  it('produces a JSON string (safe to send as application/json)', () => {
    expect(() => JSON.parse(serializeValue({ d: new Date() }))).not.toThrow();
  });

  it('throws loudly on functions', () => {
    expect(() => serializeValue({ fn: () => 1 })).toThrow();
  });
});
