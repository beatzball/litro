import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { anthropic } from './anthropic.js';
import type { ProviderEvent, ProviderRequest } from './types.js';

/** Mock SSE server (harness pattern from Task 6's openai-compatible tests),
 *  adapted for Anthropic's `event: <type>\ndata: <json>\n\n` framing. Each
 *  entry in `frames` is `{event, data}`; data is JSON.stringify'd for you. */
function sseServer(
  frames: Array<{ event: string; data: unknown }>,
  status = 200,
  capture?: { headers?: Record<string, unknown>; body?: string },
) {
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      if (capture) {
        capture.headers = { ...req.headers };
        capture.body = raw;
      }
      res.writeHead(status, { 'content-type': 'text/event-stream' });
      for (const f of frames) {
        res.write(`event: ${f.event}\ndata: ${JSON.stringify(f.data)}\n\n`);
      }
      res.end();
    });
  });
  return new Promise<{ url: string; close(): void }>((resolve) =>
    server.listen(0, () =>
      resolve({
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        close: () => server.close(),
      }),
    ),
  );
}

/** Mock server returning a plain error body (non-streaming), for the 400
 *  status-code test. */
function errorServer(status: number, body: string) {
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(body);
    });
  });
  return new Promise<{ url: string; close(): void }>((resolve) =>
    server.listen(0, () =>
      resolve({
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
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

describe('anthropic provider', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    vi.unstubAllEnvs();
  });

  it('(a) streams text-delta from content_block_delta text_delta frames', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const { url, close } = await sseServer([
      { event: 'message_start', data: { type: 'message_start', message: { usage: { input_tokens: 10 } } } },
      { event: 'content_block_start', data: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } },
      { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello' } } },
      { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' world' } } },
      { event: 'content_block_stop', data: { type: 'content_block_stop', index: 0 } },
      { event: 'message_delta', data: { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } } },
      { event: 'message_stop', data: { type: 'message_stop' } },
    ]);
    cleanup = close;

    const provider = anthropic({ model: 'claude-opus-4-8', apiKey: 'sk-test', baseURL: url });
    const events = await collect(provider.stream(baseReq));

    expect(events).toEqual([
      { type: 'text-delta', text: 'Hello' },
      { type: 'text-delta', text: ' world' },
      { type: 'done', usage: { inputTokens: 10, outputTokens: 5 } },
    ]);
  });

  it('(b) assembles a tool_use call across input_json_delta frames, flushed on content_block_stop', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const { url, close } = await sseServer([
      { event: 'message_start', data: { type: 'message_start', message: { usage: { input_tokens: 3 } } } },
      {
        event: 'content_block_start',
        data: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'tool_use', id: 'toolu_1', name: 'get-weather', input: {} },
        },
      },
      {
        event: 'content_block_delta',
        data: { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"city":' } },
      },
      {
        event: 'content_block_delta',
        data: { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '"NYC"}' } },
      },
      { event: 'content_block_stop', data: { type: 'content_block_stop', index: 0 } },
      { event: 'message_delta', data: { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 8 } } },
      { event: 'message_stop', data: { type: 'message_stop' } },
    ]);
    cleanup = close;

    const provider = anthropic({ model: 'claude-opus-4-8', apiKey: 'sk-test', baseURL: url });
    const events = await collect(provider.stream(baseReq));

    expect(events).toEqual([
      { type: 'tool-call', id: 'toolu_1', name: 'get-weather', input: { city: 'NYC' } },
      { type: 'done', usage: { inputTokens: 3, outputTokens: 8 } },
    ]);
  });

  it('(b2) empty accumulated tool input parses as {}', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const { url, close } = await sseServer([
      { event: 'message_start', data: { type: 'message_start', message: { usage: { input_tokens: 1 } } } },
      {
        event: 'content_block_start',
        data: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'tool_use', id: 'toolu_2', name: 'ping', input: {} },
        },
      },
      { event: 'content_block_stop', data: { type: 'content_block_stop', index: 0 } },
      { event: 'message_delta', data: { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 1 } } },
      { event: 'message_stop', data: { type: 'message_stop' } },
    ]);
    cleanup = close;

    const provider = anthropic({ model: 'claude-opus-4-8', apiKey: 'sk-test', baseURL: url });
    const events = await collect(provider.stream(baseReq));

    expect(events).toEqual([
      { type: 'tool-call', id: 'toolu_2', name: 'ping', input: {} },
      { type: 'done', usage: { inputTokens: 1, outputTokens: 1 } },
    ]);
  });

  it('(c) usage accumulates from message_start + message_delta, emitted on message_stop as done', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const { url, close } = await sseServer([
      { event: 'message_start', data: { type: 'message_start', message: { usage: { input_tokens: 42 } } } },
      { event: 'content_block_start', data: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } },
      { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hi' } } },
      { event: 'content_block_stop', data: { type: 'content_block_stop', index: 0 } },
      { event: 'message_delta', data: { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 7 } } },
      { event: 'message_stop', data: { type: 'message_stop' } },
    ]);
    cleanup = close;

    const provider = anthropic({ model: 'claude-opus-4-8', apiKey: 'sk-test', baseURL: url });
    const events = await collect(provider.stream(baseReq));

    expect(events).toEqual([
      { type: 'text-delta', text: 'hi' },
      { type: 'done', usage: { inputTokens: 42, outputTokens: 7 } },
    ]);
  });

  it('(d) HTTP 400 yields a single provider-error with status 400 and nothing else', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const { url, close } = await errorServer(
      400,
      JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'bad request' } }),
    );
    cleanup = close;

    const provider = anthropic({ model: 'claude-opus-4-8', apiKey: 'sk-test', baseURL: url });
    const events = await collect(provider.stream(baseReq));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'provider-error', status: 400 });
  });

  it('(e) missing API key rejects on first stream() iteration', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const provider = anthropic({ model: 'claude-opus-4-8', baseURL: 'http://127.0.0.1:1' });

    await expect(async () => {
      for await (const _ of provider.stream(baseReq)) {
        // never reached
      }
    }).rejects.toBeInstanceOf(Error);
  });

  it('(f) outbound body: system top-level, assistant toolCalls -> content blocks, tool role -> user tool_result', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const capture: { headers?: Record<string, unknown>; body?: string } = {};
    const { url, close } = await sseServer(
      [
        { event: 'message_start', data: { type: 'message_start', message: { usage: { input_tokens: 1 } } } },
        { event: 'message_delta', data: { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } } },
        { event: 'message_stop', data: { type: 'message_stop' } },
      ],
      200,
      capture,
    );
    cleanup = close;

    const req: ProviderRequest = {
      system: 'You are terse.',
      messages: [
        { role: 'user', content: "what's the weather" },
        {
          role: 'assistant',
          content: 'checking now',
          toolCalls: [{ id: 'toolu_9', name: 'get-weather', input: { city: 'NYC' } }],
        },
        { role: 'tool', content: '72F sunny', toolCallId: 'toolu_9' },
      ],
      tools: [
        { name: 'get-weather', description: 'Get weather', parameters: { type: 'object', properties: { city: { type: 'string' } } } },
      ],
    };

    const provider = anthropic({ model: 'claude-opus-4-8', apiKey: 'sk-test', baseURL: url, maxTokens: 2048 });
    await collect(provider.stream(req));

    expect(capture.headers?.['x-api-key']).toBe('sk-test');
    expect(capture.headers?.['anthropic-version']).toBe('2023-06-01');

    const body = JSON.parse(capture.body!);
    expect(body.model).toBe('claude-opus-4-8');
    expect(body.max_tokens).toBe(2048);
    expect(body.stream).toBe(true);
    expect(body.system).toBe('You are terse.');
    expect(body.tools).toEqual([
      { name: 'get-weather', description: 'Get weather', input_schema: { type: 'object', properties: { city: { type: 'string' } } } },
    ]);

    // No system message in the messages array.
    expect(body.messages.some((m: { role: string }) => m.role === 'system')).toBe(false);

    expect(body.messages[0]).toEqual({ role: 'user', content: "what's the weather" });

    expect(body.messages[1]).toEqual({
      role: 'assistant',
      content: [
        { type: 'text', text: 'checking now' },
        { type: 'tool_use', id: 'toolu_9', name: 'get-weather', input: { city: 'NYC' } },
      ],
    });

    expect(body.messages[2]).toEqual({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'toolu_9', content: '72F sunny' }],
    });
  });

  it('(g) truncated stream (no message_stop) still yields exactly one terminal done', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const { url, close } = await sseServer([
      { event: 'message_start', data: { type: 'message_start', message: { usage: { input_tokens: 4 } } } },
      { event: 'content_block_start', data: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } },
      { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'partial' } } },
      // Server closes the connection here — no content_block_stop, no message_stop.
    ]);
    cleanup = close;

    const provider = anthropic({ model: 'claude-opus-4-8', apiKey: 'sk-test', baseURL: url });
    const events = await collect(provider.stream(baseReq));

    expect(events).toEqual([
      { type: 'text-delta', text: 'partial' },
      { type: 'done', usage: { inputTokens: 4, outputTokens: undefined } },
    ]);
  });

  it('(h) truncated stream with an open tool_use accumulator flushes the tool-call before done', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const { url, close } = await sseServer([
      { event: 'message_start', data: { type: 'message_start', message: { usage: { input_tokens: 4 } } } },
      {
        event: 'content_block_start',
        data: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'tool_use', id: 'toolu_trunc', name: 'get-weather', input: {} },
        },
      },
      {
        event: 'content_block_delta',
        data: { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"city":"NYC"}' } },
      },
      // Connection drops mid-block: no content_block_stop, no message_stop.
    ]);
    cleanup = close;

    const provider = anthropic({ model: 'claude-opus-4-8', apiKey: 'sk-test', baseURL: url });
    const events = await collect(provider.stream(baseReq));

    expect(events).toEqual([
      { type: 'tool-call', id: 'toolu_trunc', name: 'get-weather', input: { city: 'NYC' } },
      { type: 'done', usage: { inputTokens: 4, outputTokens: undefined } },
    ]);
  });

  it('(i) a multi-tool assistant turn merges consecutive tool-role messages into one user message', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const capture: { headers?: Record<string, unknown>; body?: string } = {};
    const { url, close } = await sseServer(
      [
        { event: 'message_start', data: { type: 'message_start', message: { usage: { input_tokens: 1 } } } },
        { event: 'message_delta', data: { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } } },
        { event: 'message_stop', data: { type: 'message_stop' } },
      ],
      200,
      capture,
    );
    cleanup = close;

    const req: ProviderRequest = {
      system: 'sys',
      messages: [
        { role: 'user', content: "what's the weather and time" },
        {
          role: 'assistant',
          content: 'checking both now',
          toolCalls: [
            { id: 'toolu_a', name: 'get-weather', input: { city: 'NYC' } },
            { id: 'toolu_b', name: 'get-time', input: { city: 'NYC' } },
          ],
        },
        { role: 'tool', content: '72F sunny', toolCallId: 'toolu_a' },
        { role: 'tool', content: '3:00pm', toolCallId: 'toolu_b' },
      ],
      tools: [],
    };

    const provider = anthropic({ model: 'claude-opus-4-8', apiKey: 'sk-test', baseURL: url });
    await collect(provider.stream(req));

    const body = JSON.parse(capture.body!);
    expect(body.messages).toHaveLength(3);

    expect(body.messages[0]).toEqual({ role: 'user', content: "what's the weather and time" });
    expect(body.messages[1].role).toBe('assistant');

    // Both tool_result blocks land in ONE user message, in order.
    expect(body.messages[2]).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'toolu_a', content: '72F sunny' },
        { type: 'tool_result', tool_use_id: 'toolu_b', content: '3:00pm' },
      ],
    });

    // Roles alternate throughout: user, assistant, user.
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(['user', 'assistant', 'user']);
  });

  it('(j) two sequential tool_use blocks (index 1 and 2) in one stream produce two well-formed tool-call events', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const { url, close } = await sseServer([
      { event: 'message_start', data: { type: 'message_start', message: { usage: { input_tokens: 2 } } } },
      { event: 'content_block_start', data: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } },
      { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok' } } },
      { event: 'content_block_stop', data: { type: 'content_block_stop', index: 0 } },
      {
        event: 'content_block_start',
        data: {
          type: 'content_block_start',
          index: 1,
          content_block: { type: 'tool_use', id: 'toolu_first', name: 'get-weather', input: {} },
        },
      },
      {
        event: 'content_block_delta',
        data: { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"city":"NYC"}' } },
      },
      { event: 'content_block_stop', data: { type: 'content_block_stop', index: 1 } },
      {
        event: 'content_block_start',
        data: {
          type: 'content_block_start',
          index: 2,
          content_block: { type: 'tool_use', id: 'toolu_second', name: 'get-time', input: {} },
        },
      },
      {
        event: 'content_block_delta',
        data: { type: 'content_block_delta', index: 2, delta: { type: 'input_json_delta', partial_json: '{"city":"LA"}' } },
      },
      { event: 'content_block_stop', data: { type: 'content_block_stop', index: 2 } },
      { event: 'message_delta', data: { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 6 } } },
      { event: 'message_stop', data: { type: 'message_stop' } },
    ]);
    cleanup = close;

    const provider = anthropic({ model: 'claude-opus-4-8', apiKey: 'sk-test', baseURL: url });
    const events = await collect(provider.stream(baseReq));

    expect(events).toEqual([
      { type: 'text-delta', text: 'ok' },
      { type: 'tool-call', id: 'toolu_first', name: 'get-weather', input: { city: 'NYC' } },
      { type: 'tool-call', id: 'toolu_second', name: 'get-time', input: { city: 'LA' } },
      { type: 'done', usage: { inputTokens: 2, outputTokens: 6 } },
    ]);
  });
});
