/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { agentSession, hydrateUIResult } from './client.js';
import { serializeValue, createStreamEncoder } from '@beatzball/litro/stream';
import { AgentError } from './errors.js';
import type { SessionEvent } from './sessions/types.js';
import type { UIResult } from './ui/index.js';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function ndjsonResponse(body: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8' },
  });
}

/** Enqueues each value as its own NDJSON line, then errors the stream instead
 *  of ever sending a `done` line -- models a connection dropping mid-turn. */
function erroringStream(values: SessionEvent[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const enc = createStreamEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < values.length) {
        controller.enqueue(encoder.encode(enc.value(values[i])));
        i++;
        return;
      }
      controller.error(new Error('network drop'));
    },
  });
}

function ndjsonStreamResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8' },
  });
}

describe('agentSession().send', () => {
  it('POSTs serialized { text } with the x-litro-agent header and yields decoded events', async () => {
    const enc = createStreamEncoder();
    const ev1: SessionEvent = { seq: 1, ts: 1000, kind: 'text-delta', payload: { text: 'hi' } };
    const ev2: SessionEvent = { seq: 2, ts: 2000, kind: 'turn-end', payload: null };
    fetchMock.mockResolvedValue(ndjsonResponse(enc.value(ev1) + enc.value(ev2) + enc.done()));

    const session = agentSession('assistant', 'sess-1');
    const got: SessionEvent[] = [];
    for await (const ev of session.send('hello')) got.push(ev);

    expect(got).toEqual([ev1, ev2]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/__litro/agent/assistant/sess-1');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-litro-agent']).toBe('1');
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect(init.body).toBe(serializeValue({ text: 'hello' }));
  });

  it('honors opts.base as a URL prefix', async () => {
    const enc = createStreamEncoder();
    fetchMock.mockResolvedValue(ndjsonResponse(enc.done()));
    const session = agentSession('assistant', 'sess-1', { base: 'https://example.com' });
    for await (const _ev of session.send('hi')) {
      /* drain */
    }
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://example.com/__litro/agent/assistant/sess-1');
  });

  it('rejects with AgentError when the stream contains an err line', async () => {
    const enc = createStreamEncoder();
    const ev1: SessionEvent = { seq: 1, ts: 1000, kind: 'text-delta', payload: 'a' };
    fetchMock.mockResolvedValue(
      ndjsonResponse(enc.value(ev1) + enc.error({ name: 'AgentError', message: 'mid-stream boom', status: 500 })),
    );

    const session = agentSession('assistant', 'sess-1');
    const got: SessionEvent[] = [];
    const err = await (async () => {
      for await (const ev of session.send('hi')) got.push(ev);
    })().catch((e: unknown) => e);

    expect(got).toEqual([ev1]);
    expect(err).toBeInstanceOf(AgentError);
    expect((err as AgentError).message).toBe('mid-stream boom');
    expect((err as AgentError).status).toBe(500);
  });

  it('throws AgentError parsed from the actions-style error payload on a non-2xx pre-stream response', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ name: 'AgentError', message: 'nope', status: 403 }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const session = agentSession('assistant', 'sess-1');
    const err = await (async () => {
      for await (const _ev of session.send('hi')) {
        /* drain */
      }
    })().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AgentError);
    expect((err as AgentError).message).toBe('nope');
    expect((err as AgentError).status).toBe(403);
  });

  it('throws a generic AgentError when the pre-stream error body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>gateway error</html>', { status: 502 }));
    const session = agentSession('assistant', 'sess-1');
    const err = await (async () => {
      for await (const _ev of session.send('hi')) {
        /* drain */
      }
    })().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AgentError);
    expect((err as AgentError).status).toBe(502);
  });
});

describe('agentSession().resume', () => {
  it('issues a GET with ?from= and decodes the replayed events', async () => {
    const enc = createStreamEncoder();
    const ev1: SessionEvent = { seq: 6, ts: 1000, kind: 'message', payload: 'hi' };
    fetchMock.mockResolvedValue(ndjsonResponse(enc.value(ev1) + enc.done()));

    const session = agentSession('assistant', 'sess-1');
    const got: SessionEvent[] = [];
    for await (const ev of session.resume(5)) got.push(ev);

    expect(got).toEqual([ev1]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/__litro/agent/assistant/sess-1?from=5');
    expect(init.method).toBe('GET');
  });

  it('defaults fromSeq to 0', async () => {
    const enc = createStreamEncoder();
    fetchMock.mockResolvedValue(ndjsonResponse(enc.done()));
    const session = agentSession('assistant', 'sess-1');
    for await (const _ev of session.resume()) {
      /* drain */
    }
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('/__litro/agent/assistant/sess-1?from=0');
  });

  it('retries once after a mid-stream network error, resuming from lastSeq + 1', async () => {
    const ev1: SessionEvent = { seq: 1, ts: 1000, kind: 'text-delta', payload: 'a' };
    const ev2: SessionEvent = { seq: 2, ts: 2000, kind: 'text-delta', payload: 'b' };
    const enc = createStreamEncoder();
    fetchMock
      .mockResolvedValueOnce(ndjsonStreamResponse(erroringStream([ev1, ev2])))
      .mockResolvedValueOnce(ndjsonResponse(enc.done()));

    const session = agentSession('assistant', 'sess-1');
    const got: SessionEvent[] = [];
    for await (const ev of session.resume(0)) got.push(ev);

    expect(got).toEqual([ev1, ev2]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url1] = fetchMock.mock.calls[0] as [string];
    const [url2] = fetchMock.mock.calls[1] as [string];
    expect(url1).toBe('/__litro/agent/assistant/sess-1?from=0');
    expect(url2).toBe('/__litro/agent/assistant/sess-1?from=3');
  }, 10000);

  it('propagates the second failure after one retry', async () => {
    const ev1: SessionEvent = { seq: 1, ts: 1000, kind: 'text-delta', payload: 'a' };
    fetchMock
      .mockResolvedValueOnce(ndjsonStreamResponse(erroringStream([ev1])))
      .mockResolvedValueOnce(ndjsonStreamResponse(erroringStream([])));

    const session = agentSession('assistant', 'sess-1');
    const got: SessionEvent[] = [];
    const err = await (async () => {
      for await (const ev of session.resume(0)) got.push(ev);
    })().catch((e: unknown) => e);

    expect(got).toEqual([ev1]);
    expect(err).toBeInstanceOf(Error);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 10000);
});

describe('hydrateUIResult', () => {
  it('injects html via innerHTML in jsdom (no setHTMLUnsafe) and assigns hydrate.props onto the first child', async () => {
    const host = document.createElement('div');
    const result: UIResult = {
      type: 'ui',
      html: '<my-widget></my-widget>',
      hydrate: { modules: [], props: { label: 'hi' } },
    };
    await hydrateUIResult(host, result);
    expect(host.innerHTML).toContain('<my-widget');
    expect((host.firstElementChild as unknown as Record<string, unknown>).label).toBe('hi');
  });

  it('calls host.setHTMLUnsafe when the host implements it (DSD-capable browser)', async () => {
    const host = document.createElement('div');
    const setHTMLUnsafe = vi.fn();
    (host as unknown as { setHTMLUnsafe: typeof setHTMLUnsafe }).setHTMLUnsafe = setHTMLUnsafe;
    await hydrateUIResult(host, { type: 'ui', html: '<p>x</p>' });
    expect(setHTMLUnsafe).toHaveBeenCalledWith('<p>x</p>');
    expect(host.innerHTML).toBe('');
  });

  it('does nothing extra when hydrate is absent', async () => {
    const host = document.createElement('div');
    await hydrateUIResult(host, { type: 'ui', html: '<p></p>' });
    expect(host.innerHTML).toBe('<p></p>');
  });

  it('imports hydrate.modules via dynamic import', async () => {
    const host = document.createElement('div');
    const result: UIResult = { type: 'ui', html: '<p></p>', hydrate: { modules: ['./errors.js'] } };
    await expect(hydrateUIResult(host, result)).resolves.toBeUndefined();
  });
});
