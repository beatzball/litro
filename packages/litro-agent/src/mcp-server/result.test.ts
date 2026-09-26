/**
 * The result shaping, at the edges the server tests cannot reach through a
 * client: a cyclic value, a multi-byte truncation boundary, and a tool that
 * returns nothing.
 */
import { describe, it, expect } from 'vitest';
import { asStructuredContent, shapeValueResult, withTimeout, WRAPPED_RESULT_KEY } from './result.js';

describe('asStructuredContent', () => {
  it('passes a plain object through as itself', () => {
    const value = { a: 1 };
    expect(asStructuredContent(value)).toBe(value);
  });

  it.each([
    ['a string', 'ok'],
    ['a number', 7],
    ['a boolean', false],
    ['null', null],
    ['an array', [1, 2]],
  ])('wraps %s, which the SDK rejects as a record', (_label, value) => {
    expect(asStructuredContent(value)).toEqual({ [WRAPPED_RESULT_KEY]: value });
  });

  it('turns undefined into null rather than dropping the key', () => {
    expect(asStructuredContent(undefined)).toEqual({ [WRAPPED_RESULT_KEY]: null });
  });
});

describe('shapeValueResult', () => {
  it('reports a cyclic result as a tool error instead of failing the call', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const result = shapeValueResult(cyclic);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/could not be serialized as JSON/);
  });

  it('cuts a truncated result at a character boundary, never mid-sequence', () => {
    // 'é' is two bytes, so a cap at an odd byte lands inside one.
    const value = { blob: 'é'.repeat(200) };
    const result = shapeValueResult(value, { maxResultBytes: 61 });
    const text = result.content[0].text.replace(/\n\[truncated by litro mcp:[\s\S]*$/, '');
    expect(text).not.toContain('�');
    expect(Buffer.byteLength(text, 'utf8')).toBeLessThanOrEqual(61);
  });

  it('names the real size in the marker and in the log', () => {
    const logged: string[] = [];
    const result = shapeValueResult({ blob: 'x'.repeat(5000) }, { maxResultBytes: 100, log: (l) => logged.push(l), toolName: 'dump' });
    expect(result.content[0].text).toMatch(/returned 501[0-9] bytes of JSON, over the 100 byte limit/);
    expect(result.structuredContent).toMatchObject({ truncated: true, limit: 100 });
    expect(logged[0]).toContain('tool "dump"');
  });

  it('serializes a tool that returns nothing as null', () => {
    const result = shapeValueResult(undefined);
    expect(result.content).toEqual([{ type: 'text', text: 'null' }]);
    expect(result.structuredContent).toEqual({ [WRAPPED_RESULT_KEY]: null });
  });
});

describe('withTimeout', () => {
  it('hands back the value when the work wins', async () => {
    await expect(withTimeout(1000, Promise.resolve(7))).resolves.toEqual({ timedOut: false, value: 7 });
  });

  it('reports the timeout when the timer wins', async () => {
    const forever = new Promise<never>(() => {});
    await expect(withTimeout(10, forever)).resolves.toEqual({ timedOut: true });
  });

  it('propagates a rejection the work loses with', async () => {
    await expect(withTimeout(1000, Promise.reject(new Error('boom')))).rejects.toThrow('boom');
  });

  it('does not leave an unhandled rejection when the work fails AFTER the timeout', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => void unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const late = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('late')), 20));
      await expect(withTimeout(5, late)).resolves.toEqual({ timedOut: true });
      await new Promise((r) => setTimeout(r, 60));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
