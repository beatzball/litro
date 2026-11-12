import { createServer, type Server } from 'node:http';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, createRouter, toNodeListener } from 'h3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineAgent, defineTool, type SessionStore } from '@beatzball/litro-agent';
import { scriptedProvider } from '@beatzball/litro-agent/providers/scripted';
import { serializeValue } from '@beatzball/litro/stream';
import { z } from 'zod';
import { createAgentHandler } from '../../packages/litro-agent/src/runtime/handler.js';
import { createMcpHandler } from '../../packages/litro-agent/src/mcp-server/http.js';
import { coderAccess, coderIdentity } from '../server/coder-auth.js';
import sessionRoute from '../server/api/coder/session.post.js';
import { coderSessionStore } from '../server/coder-sessions.js';
import { testToken } from './coder-context.js';

let directory: string;
let server: Server | undefined;
let base: string;
const bobToken = 'bob-secret-1234567890123456';
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'coder-security-'));
  vi.stubEnv('CODER_ACCESS_TOKEN', testToken);
  vi.stubEnv('CODER_ACCESS_TOKENS', JSON.stringify({ bob: bobToken }));
});
afterEach(async () => {
  server?.closeAllConnections();
  if (server) await new Promise<void>((done) => server!.close(() => done()));
  server = undefined;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});
async function serve(runtimeStore?: SessionStore, mcpToken?: string) {
  const store = coderSessionStore({ directory: join(directory, 'coder') });
  const publicStore = coderSessionStore({ directory: join(directory, 'public') });
  const agent = defineAgent({ model: scriptedProvider(() => [{ type: 'text-delta', text: 'private' }, { type: 'done' }]), instructions: '', sessions: store });
  const tool = defineTool({ description: 'Return validated identity', input: z.object({}), execute(_, ctx) { return coderIdentity(ctx.event, ctx.session.id); } });
  const entries = [{ name: 'coder', module: { default: agent, access: coderAccess }, instructions: '', tools: [{ name: 'identity', module: { default: tool } }] },
    { name: 'demo', module: { default: defineAgent({ model: scriptedProvider(() => [{ type: 'text-delta', text: 'public' }, { type: 'done' }]), instructions: '' }) }, instructions: '', tools: [] }];
  const chat = createAgentHandler(entries, { sessions: runtimeStore ?? publicStore });
  const mcp = createMcpHandler(entries, { local: true, token: mcpToken, appsDir: join(directory, 'missing'), enableJsonResponse: true, log: () => {} });
  const app = createApp();
  const router = createRouter();
  router.post('/api/coder/session', sessionRoute);
  router.post('/__litro/agent/:agent/:session', chat);
  router.get('/__litro/agent/:agent/:session', chat);
  router.post('/__litro/mcp/:agent', mcp);
  app.use(router);
  server = createServer(toNodeListener(app));
  await new Promise<void>((done) => server!.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  return store;
}
async function login(token = testToken) {
  const response = await fetch(`${base}/api/coder/session`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'x-litro-agent': '1' } });
  expect(response.status).toBe(200);
  const cookie = response.headers.get('set-cookie')!;
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('SameSite=Strict');
  const { sessionId } = await response.json() as { sessionId: string };
  expect(sessionId.length).toBeLessThanOrEqual(64);
  return { sessionId, cookie: cookie.split(';')[0] };
}
function chatRequest(id: string, method = 'GET', token?: string, agent = 'coder') {
  return fetch(`${base}/__litro/agent/${agent}/${id}`, {
    method, headers: { 'x-litro-agent': '1', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(method === 'POST' ? { body: serializeValue({ text: 'hello' }) } : {}),
  });
}
function mcpRequest(headers: Record<string, string> = {}) {
  return fetch(`${base}/__litro/mcp/coder`, { method: 'POST',
    headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'identity', arguments: {} } }),
  });
}

describe('coder HTTP access and ownership', () => {
  it('denies unauthenticated GET and POST before reading or appending logs', async () => {
    await serve();
    const { sessionId } = await login();
    for (const method of ['GET', 'POST']) {
      const response = await chatRequest(sessionId, method);
      expect(response.status).toBe(401);
      expect(await response.text()).toContain('Sign in');
    }
    expect(await readdir(join(directory, 'coder')).catch(() => [])).toEqual([]);
  });
  it('binds GET and POST to the principal and rejects tampered, arbitrary, expired, and mcp IDs', async () => {
    await serve();
    const { sessionId } = await login();
    const posted = await chatRequest(sessionId, 'POST', testToken);
    expect(posted.status).toBe(200);
    expect(await posted.text()).toContain('private');
    const replay = await chatRequest(sessionId, 'GET', testToken);
    expect(await replay.text()).toContain('private');
    for (const method of ['GET', 'POST']) {
      for (const id of [sessionId, 'mcp', 'arbitrary', sessionId.slice(0, -1) + '!']) {
        const response = await chatRequest(id, method, id === sessionId ? bobToken : testToken);
        expect([400, 403]).toContain(response.status);
        await response.text();
      }
    }
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 13 * 3600000);
    const expired = await chatRequest(sessionId, 'GET', testToken);
    expect(expired.status).toBe(403);
    await expired.text();
    vi.restoreAllMocks();
  });
  it('keeps coder history isolated when a public agent uses the same session ID', async () => {
    await serve();
    const { sessionId } = await login();
    await (await chatRequest(sessionId, 'POST', testToken)).text();
    const publicResponse = await chatRequest(sessionId, 'POST', undefined, 'demo');
    expect(publicResponse.status).toBe(200);
    expect(await publicResponse.text()).not.toContain('private');
    const privateReplay = await (await chatRequest(sessionId, 'GET', testToken)).text();
    expect(privateReplay).not.toContain('public');
    expect(privateReplay).toContain('private');
  });
  it('quarantines legacy shared history from every public agent route', async () => {
    vi.stubEnv('LITRO_AGENT_SESSIONS_DIR', directory);
    const legacy = { seq: 1, ts: 1, kind: 'text-delta', payload: { text: 'legacy-secret' } };
    await writeFile(join(directory, 'old-coder-session.jsonl'), JSON.stringify(legacy) + '\n');
    const config = (await import('../agents/_config.js')).default;
    await serve(config.sessions);
    const response = await chatRequest('old-coder-session', 'GET', undefined, 'demo');
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain('legacy-secret');
    expect(await readFile(join(directory, 'old-coder-session.jsonl'), 'utf8')).toContain('legacy-secret');
  });

  it('denies login and agent requests by default with a clear configuration message', async () => {
    await serve();
    vi.stubEnv('CODER_ACCESS_TOKEN', ''); vi.stubEnv('CODER_ACCESS_TOKENS', '');
    const login = await fetch(`${base}/api/coder/session`, { method: 'POST', headers: { 'x-litro-agent': '1' } });
    expect(login.status).toBe(503);
    expect(await login.text()).toContain('Coder access is disabled');
    expect((await chatRequest('mcp')).status).toBe(503);
  });
  it('requires same origin for cookie MCP and passes guarded event identity to HTTP tools', async () => {
    await serve();
    const { cookie } = await login();
    const unauthenticated = await mcpRequest();
    expect(unauthenticated.status).toBe(401); await unauthenticated.text();
    const hostile = await mcpRequest({ cookie, origin: 'http://localhost:9999' });
    expect(hostile.status).toBe(403); expect(await hostile.text()).toContain('same origin');
    const authenticatedHeaders: Record<string, string>[] = [{ cookie, origin: base }, { authorization: `Bearer ${testToken}` }, { cookie, authorization: 'Bearer separate-framework-token', origin: base }];
    for (const headers of authenticatedHeaders) {
      const response = await mcpRequest(headers);
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('"transport":"mcp"');
      expect(text).toContain('"agent":"coder"');
      expect(text).not.toContain('isError');
    }
  });
  it('requires both framework bearer and coder credential when the MCP gate has its own token', async () => {
    await serve(undefined, 'separate-framework-token');
    const { cookie } = await login();
    const frameworkOnly = await mcpRequest({ authorization: 'Bearer separate-framework-token' });
    expect(frameworkOnly.status).toBe(401); await frameworkOnly.text();
    const coderOnly = await mcpRequest({ authorization: `Bearer ${testToken}` });
    expect(coderOnly.status).toBe(401); await coderOnly.text();
    const both = await mcpRequest({ authorization: 'Bearer separate-framework-token', cookie, origin: base });
    expect(both.status).toBe(200);
    expect(await both.text()).toContain('"transport":"mcp"');
    const hostile = await mcpRequest({ authorization: 'Bearer separate-framework-token', cookie, origin: 'http://localhost:9999' });
    expect(hostile.status).toBe(403); await hostile.text();
  });

  it('never trusts caller event.context identity or allows stdio to acquire coder identity', () => {
    expect(() => coderIdentity(undefined, 'mcp')).toThrow('authenticated coder HTTP');
    expect(() => coderIdentity({ context: { principal: 'alice', transport: 'chat' } } as never, 'known')).toThrow('authenticated coder HTTP');
  });
});

describe('bounded coder session storage', () => {
  const event = (payload: unknown, kind: 'message' | 'error' = 'message') => ({ ts: Date.now(), kind, payload });
  async function collect(store: ReturnType<typeof coderSessionStore>, id = 'session') { const events = []; for await (const event of store.read(id)) events.push(event); return events; }
  it('enforces UTF-8 byte cap before writes across manager instances, reserving error room', async () => {
    const a = coderSessionStore({ directory, maxBytes: 4096 });
    const b = coderSessionStore({ directory, maxBytes: 4096 });
    const writes = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => (index % 2 ? a : b).append('session', event('🙂'.repeat(180)))));
    expect(writes.some((write) => write.status === 'rejected')).toBe(true);
    expect((await readFile(join(directory, 'session.jsonl'))).length).toBeLessThanOrEqual(4096 - 512);
    await a.append('session', event('Session full', 'error'));
    const events = await collect(b);
    expect(events.map((event) => event.seq)).toEqual(events.map((_, index) => index + 1));
    expect((await readFile(join(directory, 'session.jsonl'))).length).toBeLessThanOrEqual(4096);
  });
  it('rejects preexisting oversized logs on replay and append without whole-file reads', async () => {
    const store = coderSessionStore({ directory, maxBytes: 4096 });
    await writeFile(join(directory, 'legacy.jsonl'), 'A'.repeat(65536));
    await expect(collect(store, 'legacy')).rejects.toMatchObject({ status: 413 });
    await expect(store.append('legacy', event('hello'))).rejects.toMatchObject({ status: 413 });
    expect((await readFile(join(directory, 'legacy.jsonl'))).length).toBe(65536);
  });
  it('replays only complete records during concurrent large appends', async () => {
    const store = coderSessionStore({ directory, maxBytes: 1024 * 1024 });
    await Promise.all(Array.from({ length: 8 }, async (_, index) => {
      await store.append('session', event('x'.repeat(50000)));
      const events = await collect(store);
      expect(events.every((item) => typeof item.payload === 'string')).toBe(true);
      expect(events.map((item) => item.seq)).toEqual(events.map((_, i) => i + 1));
    }));
    expect(await collect(store)).toHaveLength(8);
  });
  it('expires turn leases and prevents stale owner renew/release after another worker acquires', async () => {
    const store = coderSessionStore({ directory });
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const a = await store.acquireLease!('coder/session', { ttlMs: 1000 });
    expect(a).not.toBeNull();
    expect(await store.acquireLease!('coder/session')).toBeNull();
    clock.mockReturnValue(now + 2000);
    expect(await store.isLeased!('coder/session')).toBe(false);
    const b = await coderSessionStore({ directory }).acquireLease!('coder/session', { ttlMs: 30000 });
    expect(b).not.toBeNull();
    expect(await a!.renew()).toBe(false);
    await a!.release();
    expect(await store.isLeased!('coder/session')).toBe(true);
    expect(await b!.renew()).toBe(true);
    await b!.release();
    expect(await store.isLeased!('coder/session')).toBe(false);
    clock.mockRestore();
  });
});
