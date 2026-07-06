import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callAction, makeStub, actionUrl, ACTION_ID } from '../client.js';
import { serializeValue, createStreamEncoder } from '../serialize.js';
import { LitroActionError } from '../error.js';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function okResponse(value: unknown) {
  return new Response(serializeValue(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function ndjsonResponse(body: string, splitAt?: number[]) {
  const encoder = new TextEncoder();
  const parts = splitAt?.length
    ? [0, ...splitAt, body.length].slice(0, -1).map((s, i, arr) => body.slice(s, arr[i + 1] ?? body.length))
    : [body];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const p of parts) controller.enqueue(encoder.encode(p));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8' },
  });
}

describe('callAction', () => {
  it('POSTs serialized args to /__litro/action/<id> with the CSRF header', async () => {
    fetchMock.mockResolvedValue(okResponse({ ok: true }));
    await callAction('abc123def456', [{ text: 'hi' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/__litro/action/abc123def456');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-litro-action']).toBe('1');
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect(typeof init.body).toBe('string');
  });

  it('deserializes the response, reviving rich values like Date', async () => {
    const d = new Date('2026-07-03T00:00:00.000Z');
    fetchMock.mockResolvedValue(okResponse({ at: d }));
    const result = await callAction<{ at: Date }>('abc123def456', []);
    expect(result.at).toBeInstanceOf(Date);
    expect(result.at.toISOString()).toBe('2026-07-03T00:00:00.000Z');
  });

  it('throws LitroActionError built from the error payload on non-2xx', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ name: 'LitroActionError', message: 'nope', status: 400, issues: [{ message: 'bad' }] }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      ),
    );
    const err = await callAction('abc123def456', []).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LitroActionError);
    expect((err as LitroActionError).message).toBe('nope');
    expect((err as LitroActionError).status).toBe(400);
    expect((err as LitroActionError).issues).toEqual([{ message: 'bad' }]);
  });

  it('throws a generic LitroActionError when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>gateway error</html>', { status: 502 }));
    const err = await callAction('abc123def456', []).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LitroActionError);
    expect((err as LitroActionError).status).toBe(502);
  });
});

describe('callAction streaming', () => {
  it('yields revived chunks incrementally and completes on the done line', async () => {
    const enc = createStreamEncoder();
    const d = new Date('2026-07-06T00:00:00.000Z');
    fetchMock.mockResolvedValue(
      ndjsonResponse(enc.value({ i: 1, at: d }) + enc.value({ i: 2 }) + enc.done()),
    );
    const iterable = await callAction<AsyncIterable<{ i: number; at?: Date }>>('abc123def456', []);
    const got: { i: number; at?: Date }[] = [];
    for await (const v of iterable) got.push(v);
    expect(got.map((v) => v.i)).toEqual([1, 2]);
    expect(got[0].at).toBeInstanceOf(Date);
  });

  it('parses lines split across network chunks', async () => {
    const enc = createStreamEncoder();
    const body = enc.value({ i: 1 }) + enc.value({ i: 2 }) + enc.done();
    fetchMock.mockResolvedValue(ndjsonResponse(body, [Math.floor(body.length / 3), Math.floor((2 * body.length) / 3)]));
    const iterable = await callAction<AsyncIterable<{ i: number }>>('abc123def456', []);
    const got: number[] = [];
    for await (const v of iterable) got.push(v.i);
    expect(got).toEqual([1, 2]);
  });

  it('rethrows a mid-stream err line as LitroActionError', async () => {
    const enc = createStreamEncoder();
    fetchMock.mockResolvedValue(
      ndjsonResponse(enc.value('ok') + enc.error({ name: 'Error', message: 'mid-stream boom', status: 500 })),
    );
    const iterable = await callAction<AsyncIterable<string>>('abc123def456', []);
    const got: string[] = [];
    const err = await (async () => {
      for await (const v of iterable) got.push(v);
    })().catch((e: unknown) => e);
    expect(got).toEqual(['ok']);
    expect(err).toBeInstanceOf(LitroActionError);
    expect((err as LitroActionError).message).toBe('mid-stream boom');
  });

  it('throws 502 when the stream ends without a done line', async () => {
    const enc = createStreamEncoder();
    fetchMock.mockResolvedValue(ndjsonResponse(enc.value('partial')));
    const iterable = await callAction<AsyncIterable<string>>('abc123def456', []);
    const err = await (async () => {
      for await (const _v of iterable) {
        /* drain */
      }
    })().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LitroActionError);
    expect((err as LitroActionError).status).toBe(502);
  });
});

describe('makeStub / actionUrl', () => {
  it('makeStub attaches the id and forwards calls to callAction', async () => {
    fetchMock.mockResolvedValue(okResponse({ ok: true }));
    const stub = makeStub('abc123def456');
    expect((stub as unknown as Record<symbol, unknown>)[ACTION_ID]).toBe('abc123def456');
    await stub({ text: 'hi' });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('/__litro/action/abc123def456');
  });

  it('actionUrl resolves the stamped id', () => {
    expect(actionUrl(makeStub('abc123def456'))).toBe('/__litro/action/abc123def456');
  });

  it('actionUrl throws a descriptive error for unstamped functions', () => {
    expect(() => actionUrl(async () => undefined)).toThrow(/no action id/);
  });
});
