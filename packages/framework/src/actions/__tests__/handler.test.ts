import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, createRouter, toNodeListener } from 'h3';
import { createActionHandler, type ActionModuleEntry } from '../handler.js';
import { defineAction } from '../define.js';
import { hashActionId } from '../hash.js';
import { serializeValue, deserializeValue, createStreamDecoder } from '../serialize.js';
import type { StandardSchemaV1 } from '../standard-schema.js';

const textSchema: StandardSchemaV1<unknown, { text: string }> = {
  '~standard': {
    version: 1,
    vendor: 'litro-test',
    validate(value: unknown) {
      if (typeof value === 'object' && value !== null && typeof (value as { text?: unknown }).text === 'string') {
        return { value: value as { text: string } };
      }
      return { issues: [{ message: 'expected { text: string }' }] };
    },
  },
};

// Simulated .server.ts module namespace.
const demoModule: Record<string, unknown> = {
  async plainAdd(a: number, b: number) {
    return a + b;
  },
  echoUpper: defineAction({
    input: textSchema,
    async handler({ text }) {
      return { upper: text.toUpperCase(), at: new Date('2026-07-03T00:00:00.000Z') };
    },
  }),
  async explodes() {
    throw new Error('internal kaboom');
  },
  notAFunction: 42,
  streamCount,
  streamShared,
  streamFail,
};

async function* streamCount(): AsyncGenerator<{ i: number; at: Date }> {
  yield { i: 1, at: new Date('2026-07-06T00:00:00.000Z') };
  yield { i: 2, at: new Date('2026-07-06T00:00:01.000Z') };
  yield { i: 3, at: new Date('2026-07-06T00:00:02.000Z') };
}
const sharedRef = { tag: 'shared' };
async function* streamShared(): AsyncGenerator<Record<string, unknown>> {
  yield { first: sharedRef };
  yield { second: sharedRef };
}
async function* streamFail(): AsyncGenerator<string> {
  yield 'ok';
  throw new Error('mid-stream boom');
}

const entries: ActionModuleEntry[] = [{ relPath: 'actions/demo.server', module: demoModule }];

const ID_ADD = hashActionId('actions/demo.server', 'plainAdd');
const ID_UPPER = hashActionId('actions/demo.server', 'echoUpper');
const ID_EXPLODES = hashActionId('actions/demo.server', 'explodes');
const ID_NOT_FN = hashActionId('actions/demo.server', 'notAFunction');
const ID_STREAM_COUNT = hashActionId('actions/demo.server', 'streamCount');
const ID_STREAM_SHARED = hashActionId('actions/demo.server', 'streamShared');
const ID_STREAM_FAIL = hashActionId('actions/demo.server', 'streamFail');

let server: Server;
let base: string;

beforeAll(async () => {
  const app = createApp();
  const router = createRouter();
  router.post('/__litro/action/:id', createActionHandler(entries));
  app.use(router);
  server = createServer(toNodeListener(app));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

function post(id: string, body: string, headers: Record<string, string> = {}) {
  return fetch(`${base}/__litro/action/${id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-litro-action': '1', ...headers },
    body,
  });
}

describe('createActionHandler', () => {
  it('dispatches a plain exported function with a spread args array', async () => {
    const res = await post(ID_ADD, serializeValue([2, 3]));
    expect(res.status).toBe(200);
    expect(deserializeValue(await res.text())).toBe(5);
  });

  it('dispatches a defineAction export: validates, runs handler, serializes rich values', async () => {
    const res = await post(ID_UPPER, serializeValue([{ text: 'hi' }]));
    expect(res.status).toBe(200);
    const out = deserializeValue(await res.text()) as { upper: string; at: Date };
    expect(out.upper).toBe('HI');
    expect(out.at).toBeInstanceOf(Date);
  });

  it('returns 400 with issues on validation failure', async () => {
    const res = await post(ID_UPPER, serializeValue([{ text: 7 }]));
    expect(res.status).toBe(400);
    const payload = JSON.parse(await res.text()) as { issues?: unknown[] };
    expect(payload.issues).toEqual([{ message: 'expected { text: string }' }]);
  });

  it('returns 404 for unknown ids and for non-function exports', async () => {
    expect((await post('ffffffffffff', serializeValue([]))).status).toBe(404);
    expect((await post(ID_NOT_FN, serializeValue([]))).status).toBe(404);
  });

  it('returns 403 when the x-litro-action header is missing', async () => {
    const res = await fetch(`${base}/__litro/action/${ID_ADD}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: serializeValue([1, 2]),
    });
    expect(res.status).toBe(403);
  });

  it('returns 403 on cross-site sec-fetch-site', async () => {
    const res = await post(ID_ADD, serializeValue([1, 2]), { 'sec-fetch-site': 'cross-site' });
    expect(res.status).toBe(403);
  });

  it('returns 403 on origin/host mismatch', async () => {
    const res = await post(ID_ADD, serializeValue([1, 2]), { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
  });

  it('accepts a matching origin', async () => {
    const host = new URL(base).host;
    const res = await post(ID_ADD, serializeValue([1, 2]), { origin: `http://${host}` });
    expect(res.status).toBe(200);
  });

  it('returns 403 when Origin is present but Host is missing', async () => {
    const { defineEventHandler } = await import('h3');
    const app = createApp();
    // Strip the Host header before the action handler runs, simulating a
    // client that sends Origin without Host.
    app.use(defineEventHandler((event) => {
      delete event.node.req.headers.host;
    }));
    const router = createRouter();
    router.post('/__litro/action/:id', createActionHandler(entries));
    app.use(router);
    const stripServer = createServer(toNodeListener(app));
    await new Promise<void>((resolve) => stripServer.listen(0, resolve));
    const port = (stripServer.address() as AddressInfo).port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/__litro/action/${ID_ADD}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-litro-action': '1',
          origin: `http://127.0.0.1:${port}`,
        },
        body: serializeValue([1, 2]),
      });
      expect(res.status).toBe(403);
    } finally {
      await new Promise<void>((resolve, reject) =>
        stripServer.close((e) => (e ? reject(e) : resolve())),
      );
    }
  });

  it('returns 400 on a malformed body', async () => {
    const res = await post(ID_ADD, 'not json at all');
    expect(res.status).toBe(400);
  });

  it('forwards thrown errors as structured payloads without a stack (non-dev)', async () => {
    const res = await post(ID_EXPLODES, serializeValue([]));
    expect(res.status).toBe(500);
    const payload = JSON.parse(await res.text()) as { message: string; stack?: string };
    expect(payload.message).toBe('internal kaboom');
    expect(payload.stack).toBeUndefined();
  });
});

async function postStream(id: string) {
  const res = await post(id, serializeValue([]));
  const lines = (await res.text()).split('\n').filter((l) => l.length > 0);
  const dec = createStreamDecoder();
  return { res, chunks: lines.map(dec) };
}

describe('streaming responses', () => {
  it('streams AsyncIterable results as NDJSON with a done line', async () => {
    const { res, chunks } = await postStream(ID_STREAM_COUNT);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/x-ndjson');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(chunks).toHaveLength(4);
    const first = chunks[0] as { kind: 'value'; value: { i: number; at: Date } };
    expect(first.value.i).toBe(1);
    expect(first.value.at).toBeInstanceOf(Date);
    expect(chunks[3]).toEqual({ kind: 'done' });
  });

  it('preserves object identity across chunks (shared refs)', async () => {
    const { chunks } = await postStream(ID_STREAM_SHARED);
    const a = (chunks[0] as { kind: 'value'; value: { first: unknown } }).value.first;
    const b = (chunks[1] as { kind: 'value'; value: { second: unknown } }).value.second;
    expect(a).toBe(b);
  });

  it('a mid-stream throw emits an err line (no stack outside dev) and ends the stream', async () => {
    const { res, chunks } = await postStream(ID_STREAM_FAIL);
    expect(res.status).toBe(200);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({ kind: 'value', value: 'ok' });
    const err = chunks[1] as { kind: 'error'; payload: { message: string; status: number; stack?: string } };
    expect(err.payload.message).toBe('mid-stream boom');
    expect(err.payload.status).toBe(500);
    expect(err.payload.stack).toBeUndefined();
  });

  it('single-shot responses are unchanged (content-type application/json)', async () => {
    const res = await post(ID_ADD, serializeValue([2, 3]));
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});
