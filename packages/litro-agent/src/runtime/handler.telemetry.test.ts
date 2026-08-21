/**
 * Wiring guard: `createAgentHandler` must actually hand its runtime
 * config's telemetry down to the turn loop. Without this test, a
 * regression that disconnects the two would leave every loop-level
 * telemetry test green while no real request ever produced a span.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, createRouter, toNodeListener } from 'h3';
import { createAgentHandler, type AgentManifestEntry } from './handler.js';
import { scriptedProvider } from '../providers/scripted.js';
import { fileSessionStore } from '../sessions/file.js';
import { defineAgent } from '../index.js';
import { serializeValue } from '@beatzball/litro/stream';
import { otelTracer } from '../telemetry/otel.js';
import { recordingTracer, type RecordingTracer } from '../telemetry/recording.js';
import { GEN_AI, LITRO } from '../telemetry/runtime.js';

const entries: AgentManifestEntry[] = [
  {
    name: 'demo',
    module: {
      default: defineAgent({
        model: scriptedProvider(() => [{ type: 'text-delta', text: 'hi there' }, { type: 'done', usage: { inputTokens: 3 } }]),
        instructions: 'be terse',
      }),
    },
    instructions: '',
    tools: [],
  },
];

let server: Server;
let base: string;
let dir: string;
let tracer: RecordingTracer;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'litro-agent-handler-tel-'));
  tracer = recordingTracer();
  const handler = createAgentHandler(entries, {
    sessions: fileSessionStore({ dir }),
    telemetry: { tracer },
  });

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

describe('createAgentHandler -- telemetry wiring', () => {
  it('emits spans for a real POST turn', async () => {
    const res = await fetch(`${base}/__litro/agent/demo/tel1`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-litro-agent': '1' },
      body: serializeValue({ text: 'hi' }),
    });
    await res.text();

    expect(res.status).toBe(200);
    const turn = tracer.spans.find((s) => s.name === 'invoke_agent demo');
    expect(turn).toBeDefined();
    expect(turn!.attributes[GEN_AI.conversationId]).toBe('tel1');
    expect(turn!.attributes[LITRO.rounds]).toBe(1);
    expect(turn!.attributes[GEN_AI.inputTokens]).toBe(3);
    expect(turn!.ended).toBe(true);
    expect(tracer.byName('chat ')).toHaveLength(1);
  });

  it('emits no spans for a GET replay -- reads are not agent invocations', async () => {
    const before = tracer.spans.length;
    const res = await fetch(`${base}/__litro/agent/demo/tel1?from=0`);
    await res.text();

    expect(res.status).toBe(200);
    expect(tracer.spans.length).toBe(before);
  });
});

describe('createAgentHandler -- telemetry off', () => {
  it('serves a turn normally with no telemetry configured', async () => {
    const offDir = await mkdtemp(join(tmpdir(), 'litro-agent-tel-off-'));
    const handler = createAgentHandler(entries, { sessions: fileSessionStore({ dir: offDir }) });
    const app = createApp();
    const router = createRouter();
    router.post('/__litro/agent/:agent/:session', handler);
    app.use(router);
    const offServer = createServer(toNodeListener(app));
    await new Promise<void>((resolve) => offServer.listen(0, resolve));
    const offBase = `http://127.0.0.1:${(offServer.address() as AddressInfo).port}`;

    try {
      const res = await fetch(`${offBase}/__litro/agent/demo/off1`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-litro-agent': '1' },
        body: serializeValue({ text: 'hi' }),
      });
      const body = await res.text();
      expect(res.status).toBe(200);
      expect(body).toContain('turn-end');
    } finally {
      await new Promise<void>((resolve, reject) => offServer.close((e) => (e ? reject(e) : resolve())));
      await rm(offDir, { recursive: true, force: true });
    }
  });
});

describe('otelTracer wiring', () => {
  it('is accepted as the runtime config tracer', () => {
    const spans: string[] = [];
    const api = {
      trace: {
        getTracer: () => ({
          startSpan: (name: string) => {
            spans.push(name);
            return { setAttributes: () => {}, setStatus: () => {}, end: () => {} };
          },
        }),
        setSpan: (_c: unknown, s: unknown) => s,
      },
      context: { active: () => undefined, with: <T,>(_c: unknown, fn: () => T) => fn() },
      SpanStatusCode: { ERROR: 2 },
    };
    const handler = createAgentHandler(entries, { telemetry: { tracer: otelTracer(api) } });
    expect(typeof handler).toBe('function');
    expect(spans).toEqual([]);
  });
});
