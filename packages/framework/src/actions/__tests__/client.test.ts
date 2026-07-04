import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callAction } from '../client.js';
import { serializeValue } from '../serialize.js';
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

describe('callAction', () => {
  it('POSTs serialized args to /_litro/action/<id> with the CSRF header', async () => {
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
