import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, createRouter, toNodeListener, createError } from 'h3';
import { createAgentHandler, type AgentManifestEntry } from './handler.js';
import { scriptedProvider } from '../providers/scripted.js';
import { fileSessionStore } from '../sessions/file.js';
import { defineAgent, defineAccess } from '../index.js';
import { serializeValue, createStreamDecoder, type StreamChunk } from '@beatzball/litro/stream';
import type { SessionEvent } from '../sessions/types.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Demo agents -----------------------------------------------------------

// Fast, deterministic: one text-delta then done -- used for the gate checks,
// the happy-path event sequence assertion, and the GET replay tests.
const demoAgent = defineAgent({
  model: scriptedProvider(() => [{ type: 'text-delta', text: 'hi there' }, { type: 'done' }]),
  instructions: 'be terse',
});

// Guarded: access throws an h3 createError -- proves it propagates via h3
// unmodified (401), on both POST and GET.
const gatedAgent = defineAgent({
  model: scriptedProvider(() => [{ type: 'done' }]),
  instructions: 'be terse',
});
const gatedAccess = defineAccess(() => {
  throw createError({ statusCode: 401, statusMessage: 'nope' });
});

// Slow: yields a delay mid-turn so a concurrent request can observe the
// turn in flight (409 lock test, live-tail GET test).
const slowAgent = defineAgent({
  model: scriptedProvider(() => [
    { type: 'text-delta', text: 'first' },
    { type: 'delay', ms: 200 },
    { type: 'text-delta', text: 'second' },
    { type: 'done' },
  ]),
  instructions: 'be terse',
});

const entries: AgentManifestEntry[] = [
  { name: 'demo', module: { default: demoAgent }, instructions: '', tools: [] },
  { name: 'gated', module: { default: gatedAgent, access: gatedAccess }, instructions: '', tools: [] },
  { name: 'slow', module: { default: slowAgent }, instructions: '', tools: [] },
];

let server: Server;
let base: string;
let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'litro-agent-handler-'));
  const store = fileSessionStore({ dir });
  const handler = createAgentHandler(entries, { sessions: store });

  const app = createApp();
  const router = createRouter();
  router.post('/__litro/agent/:agent/:session', handler);
  router.get('/__litro/agent/:agent/:session', handler);
  app.use(router);
  server = createServer(toNodeListener(app));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  await rm(dir, { recursive: true, force: true });
});

function post(agent: string, session: string, body: string, headers: Record<string, string> = {}) {
  return fetch(`${base}/__litro/agent/${agent}/${session}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-litro-agent': '1', ...headers },
    body,
  });
}

function get(agent: string, session: string, query = '', headers: Record<string, string> = {}) {
  return fetch(`${base}/__litro/agent/${agent}/${session}${query}`, { headers });
}

async function readLines(res: Response): Promise<StreamChunk[]> {
  const text = await res.text();
  const lines = text.split('\n').filter((l) => l.length > 0);
  const dec = createStreamDecoder();
  return lines.map(dec);
}

function valueKinds(chunks: StreamChunk[]): string[] {
  return chunks
    .filter((c): c is { kind: 'value'; value: unknown } => c.kind === 'value')
    .map((c) => (c.value as SessionEvent).kind);
}

describe('createAgentHandler -- gates', () => {
  it('returns 403 when the x-litro-agent header is missing on POST', async () => {
    const res = await fetch(`${base}/__litro/agent/demo/g1`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: serializeValue({ text: 'hi' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 403 on cross-site sec-fetch-site, for both POST and GET', async () => {
    const postRes = await post('demo', 'g2', serializeValue({ text: 'hi' }), { 'sec-fetch-site': 'cross-site' });
    expect(postRes.status).toBe(403);
    const getRes = await get('demo', 'g2', '', { 'sec-fetch-site': 'cross-site' });
    expect(getRes.status).toBe(403);
  });

  it('returns 403 on Origin/host mismatch; a matching x-forwarded-host first value passes', async () => {
    const mismatch = await post('demo', 'g3', serializeValue({ text: 'hi' }), { origin: 'https://evil.example' });
    expect(mismatch.status).toBe(403);

    const host = new URL(base).host;
    const ok = await post('demo', 'g3', serializeValue({ text: 'hi' }), {
      origin: `http://${host}`,
      'x-forwarded-host': `${host}, evil.example`,
    });
    expect(ok.status).toBe(200);
    await ok.text();
  });

  it('returns 400 for an invalid session id', async () => {
    const res = await post('demo', 'not a valid id!', serializeValue({ text: 'hi' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown agent', async () => {
    const res = await post('nope', 'g4', serializeValue({ text: 'hi' }));
    expect(res.status).toBe(404);
  });

  it('runs the access guard and propagates its createError as-is (401) on both methods', async () => {
    const postRes = await post('gated', 'g5', serializeValue({ text: 'hi' }));
    expect(postRes.status).toBe(401);
    const getRes = await get('gated', 'g5');
    expect(getRes.status).toBe(401);
  });

  it('returns 400 on a malformed POST body', async () => {
    const res = await post('demo', 'g6', 'not json at all');
    expect(res.status).toBe(400);
  });
});

describe('createAgentHandler -- POST turn stream', () => {
  it('streams the Task-9 event sequence as ndjson, ending turn-end then protocol done', async () => {
    const res = await post('demo', 's1', serializeValue({ text: 'hello' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/x-ndjson');
    expect(res.headers.get('cache-control')).toBe('no-store');

    const chunks = await readLines(res);
    expect(valueKinds(chunks)).toEqual(['message', 'text-delta', 'message', 'turn-end']);
    expect(chunks[chunks.length - 1]).toEqual({ kind: 'done' });

    const values = chunks
      .filter((c): c is { kind: 'value'; value: SessionEvent } => c.kind === 'value')
      .map((c) => c.value);
    expect(values[0]!.payload).toEqual({ role: 'user', text: 'hello' });
    expect(values[2]!.payload).toEqual({ role: 'assistant', text: 'hi there' });
  });

  it('returns 409 for a concurrent POST while a turn is in progress for the same session', async () => {
    const firstPromise = post('slow', 's2', serializeValue({ text: 'go' }));
    await sleep(30); // let the first POST acquire the lock and start emitting

    const secondRes = await post('slow', 's2', serializeValue({ text: 'again' }));
    expect(secondRes.status).toBe(409);

    const firstRes = await firstPromise;
    expect(firstRes.status).toBe(200);
    await firstRes.text();
  });

  it('releases the lock once a turn completes -- a subsequent POST succeeds', async () => {
    const first = await post('demo', 's3', serializeValue({ text: 'one' }));
    await first.text();
    const second = await post('demo', 's3', serializeValue({ text: 'two' }));
    expect(second.status).toBe(200);
    await second.text();
  });
});

describe('createAgentHandler -- GET reconnect tail', () => {
  it('from=0 replays the full persisted log for a completed turn', async () => {
    const postRes = await post('demo', 's4', serializeValue({ text: 'hello' }));
    await postRes.text();

    const getRes = await get('demo', 's4', '?from=0');
    expect(getRes.status).toBe(200);
    const chunks = await readLines(getRes);
    expect(valueKinds(chunks)).toEqual(['message', 'text-delta', 'message', 'turn-end']);
    expect(chunks[chunks.length - 1]).toEqual({ kind: 'done' });
  });

  it('from=N replays only the suffix from that seq', async () => {
    const postRes = await post('demo', 's5', serializeValue({ text: 'hello' }));
    await postRes.text();

    // seq 1 = message(user), so from=2 should skip it.
    const getRes = await get('demo', 's5', '?from=2');
    expect(getRes.status).toBe(200);
    const chunks = await readLines(getRes);
    expect(valueKinds(chunks)).toEqual(['text-delta', 'message', 'turn-end']);
  });

  it('rejects a negative or non-numeric from with 400', async () => {
    const postRes = await post('demo', 's5b', serializeValue({ text: 'hello' }));
    await postRes.text();
    expect((await get('demo', 's5b', '?from=-1')).status).toBe(400);
    expect((await get('demo', 's5b', '?from=abc')).status).toBe(400);
  });

  it('live-tails an in-flight turn to completion, then closes', async () => {
    const postPromise = post('slow', 's6', serializeValue({ text: 'go' }));
    await sleep(30); // let the POST acquire the lock and emit the first text-delta

    const getRes = await get('slow', 's6', '?from=0');
    expect(getRes.status).toBe(200);
    const getChunks = await readLines(getRes);

    expect(valueKinds(getChunks)).toEqual(['message', 'text-delta', 'text-delta', 'message', 'turn-end']);
    expect(getChunks[getChunks.length - 1]).toEqual({ kind: 'done' });

    const postRes = await postPromise;
    const postChunks = await readLines(postRes);
    expect(valueKinds(postChunks)).toEqual(['message', 'text-delta', 'text-delta', 'message', 'turn-end']);
  });
});
