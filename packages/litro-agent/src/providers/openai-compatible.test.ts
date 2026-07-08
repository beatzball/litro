import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { openaiCompatible } from './openai-compatible.js';
import type { ProviderEvent, ProviderRequest } from './types.js';

/** Mock SSE server (harness pattern from the actions tests): each entry in
 *  `chunks` is written as one complete `data: <chunk>\n\n` frame in a single
 *  res.write() call. Good enough for multi-frame streaming, not for proving
 *  the parser buffers a single line split across network reads. */
function sseServer(
  chunks: string[],
  status = 200,
  capture?: { headers?: Record<string, unknown> },
) {
  const server = createServer((req, res) => {
    if (capture) capture.headers = { ...req.headers };
    res.writeHead(status, { 'content-type': 'text/event-stream' });
    for (const c of chunks) res.write(`data: ${c}\n\n`);
    res.end();
  });
  return new Promise<{ url: string; close(): void }>((resolve) =>
    server.listen(0, () =>
      resolve({
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
        close: () => server.close(),
      }),
    ),
  );
}

/** Mock SSE server that writes raw byte fragments verbatim as separate
 *  res.write() calls paced with a small delay, so the fragments arrive as
 *  distinct reads on the client's fetch body stream — used to prove a single
 *  SSE `data:` line spanning a chunk boundary is still parsed correctly. */
function rawSseServer(writes: string[], status = 200) {
  const server = createServer((req, res) => {
    res.writeHead(status, { 'content-type': 'text/event-stream' });
    let i = 0;
    const pump = () => {
      if (i >= writes.length) {
        res.end();
        return;
      }
      res.write(writes[i++]);
      setTimeout(pump, 5);
    };
    pump();
  });
  return new Promise<{ url: string; close(): void }>((resolve) =>
    server.listen(0, () =>
      resolve({
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
        close: () => server.close(),
      }),
    ),
  );
}

async function collect(events: AsyncIterable<ProviderEvent>): Promise<ProviderEvent[]> {
  const out: ProviderEvent[] = [];
  for await (const e of events) out.push(e);
  return out;
}

const baseReq: ProviderRequest = {
  system: 'sys',
  messages: [{ role: 'user', content: 'hi' }],
  tools: [],
};

describe('openaiCompatible provider', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    vi.unstubAllEnvs();
  });

  it('(a) streams text-delta across SSE chunks, including one split mid-line across network reads', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const { url, close } = await rawSseServer([
      // This single SSE data line is deliberately split across two writes,
      // mid-JSON, to prove the parser buffers across reads.
      'data: {"choices":[{"delta":{"content":"Hel',
      'lo"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ]);
    cleanup = close;

    const provider = openaiCompatible({ baseURL: url, model: 'test-model' });
    const events = await collect(provider.stream(baseReq));

    expect(events).toEqual([
      { type: 'text-delta', text: 'Hello' },
      { type: 'text-delta', text: ' world' },
      { type: 'done' },
    ]);
  });

  it('(b) assembles a tool call split across argument deltas into one tool-call event', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const { url, close } = await sseServer([
      JSON.stringify({
        choices: [
          { delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'get-weather', arguments: '' } }] } },
        ],
      }),
      JSON.stringify({
        choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"city":' } }] } }],
      }),
      JSON.stringify({
        choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"NYC"}' } }] } }],
      }),
      JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }),
      '[DONE]',
    ]);
    cleanup = close;

    const provider = openaiCompatible({ baseURL: url, model: 'test-model' });
    const events = await collect(provider.stream(baseReq));

    expect(events).toEqual([
      { type: 'tool-call', id: 'call_1', name: 'get-weather', input: { city: 'NYC' } },
      { type: 'done' },
    ]);
  });

  it('(c) [DONE] without usage yields a done event with no usage field', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const { url, close } = await sseServer([
      JSON.stringify({ choices: [{ delta: { content: 'hi' } }] }),
      JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
      '[DONE]',
    ]);
    cleanup = close;

    const provider = openaiCompatible({ baseURL: url, model: 'test-model' });
    const events = await collect(provider.stream(baseReq));

    expect(events).toEqual([
      { type: 'text-delta', text: 'hi' },
      { type: 'done' },
    ]);
    expect('usage' in events[1]!).toBe(false);
  });

  it('(d) HTTP 401 yields a single provider-error with status 401 and nothing else', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const { url, close } = await sseServer(['unauthorized'], 401);
    cleanup = close;

    const provider = openaiCompatible({ baseURL: url, model: 'test-model' });
    const events = await collect(provider.stream(baseReq));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'provider-error', status: 401 });
  });

  it('(e) no auth header when no key resolves; Bearer header when apiKey is given', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');

    const noKeyCapture: { headers?: Record<string, unknown> } = {};
    const noKeyServer = await sseServer(['[DONE]'], 200, noKeyCapture);
    await collect(openaiCompatible({ baseURL: noKeyServer.url, model: 'test-model' }).stream(baseReq));
    noKeyServer.close();
    expect(noKeyCapture.headers?.authorization).toBeUndefined();

    const withKeyCapture: { headers?: Record<string, unknown> } = {};
    const withKeyServer = await sseServer(['[DONE]'], 200, withKeyCapture);
    cleanup = withKeyServer.close;
    await collect(
      openaiCompatible({ baseURL: withKeyServer.url, model: 'test-model', apiKey: 'sk-test' }).stream(baseReq),
    );
    expect(withKeyCapture.headers?.authorization).toBe('Bearer sk-test');
  });
});
