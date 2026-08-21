/**
 * Multi-instance behaviour: the cross-instance turn lease, and the
 * store-poll live tail that makes a reconnecting client work when the turn
 * is running somewhere else.
 *
 * How these tests stage "another instance": the in-process `locks` Set in
 * handler.ts is module state, shared by every handler built in this
 * process, so two handlers here cannot contend on the lease through it. So
 * the remote instance is staged the way it actually behaves — it holds a
 * lease taken from its OWN store handle on the shared database file, and
 * (for the tail tests) drives a real `runTurn` against that handle. What is
 * under test is then exactly the cross-instance path: this handler's local
 * lock is free, and only the store can tell it a turn is in flight.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { createRequire } from 'node:module';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, createRouter, toNodeListener } from 'h3';
import { createAgentHandler, type AgentManifestEntry } from './handler.js';
import { runTurn } from './loop.js';
import { scriptedProvider } from '../providers/scripted.js';
import { fileSessionStore } from '../sessions/file.js';
import { sqliteSessionStore, type SqliteSessionStore } from '../sessions/sqlite.js';
import { defineAgent } from '../index.js';
import { serializeValue, createStreamDecoder, type StreamChunk } from '@beatzball/litro/stream';
import type { SessionEvent } from '../sessions/types.js';

function hasNodeSqlite(): boolean {
  try {
    createRequire(import.meta.url)('node:sqlite');
    return true;
  } catch {
    return false;
  }
}
const d = describe.skipIf(!hasNodeSqlite());

const demoAgent = defineAgent({
  model: scriptedProvider(() => [{ type: 'text-delta', text: 'hi there' }, { type: 'done' }]),
  instructions: 'be terse',
});
const entries: AgentManifestEntry[] = [{ name: 'demo', module: { default: demoAgent }, instructions: '', tools: [] }];

let dir: string;
let dbPath: string;
let servers: Server[] = [];
let stores: SqliteSessionStore[] = [];

/** Builds one "app instance": its own store handle over the shared database
 *  file, its own handler, its own listening server. */
function instance(): { base: string; store: SqliteSessionStore } {
  const store = sqliteSessionStore({ path: dbPath });
  stores.push(store);
  const handler = createAgentHandler(entries, { sessions: store });
  const app = createApp();
  const router = createRouter();
  router.post('/__litro/agent/:agent/:session', handler);
  router.get('/__litro/agent/:agent/:session', handler);
  app.use(router);
  const server = createServer(toNodeListener(app));
  servers.push(server);
  server.listen(0);
  const port = (server.address() as AddressInfo | null)?.port;
  return { base: `http://127.0.0.1:${port}`, store };
}

async function started(): Promise<void> {
  await Promise.all(
    servers.map(
      (s) =>
        new Promise<void>((resolve) => {
          if (s.listening) return resolve();
          s.once('listening', () => resolve());
        }),
    ),
  );
}

function post(base: string, agent: string, session: string, text: string) {
  return fetch(`${base}/__litro/agent/${agent}/${session}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-litro-agent': '1' },
    body: serializeValue({ text }),
  });
}

async function readEvents(res: Response): Promise<SessionEvent[]> {
  const text = await res.text();
  const dec = createStreamDecoder();
  return text
    .split('\n')
    .filter((l) => l.length > 0)
    .map(dec)
    .filter((c): c is Extract<StreamChunk, { kind: 'value' }> => c.kind === 'value')
    .map((c) => c.value as SessionEvent);
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'litro-agent-multi-'));
  dbPath = join(dir, 'sessions.db');
});
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
  );
  for (const s of stores.splice(0)) {
    try {
      s.close();
    } catch {
      // already closed
    }
  }
  await rm(dir, { recursive: true, force: true });
});

d('cross-instance turn lock', () => {
  it('returns 409 when another instance holds the lease for the session', async () => {
    const a = instance();
    await started();

    // The other instance starts its turn: it takes the lease first.
    const remote = sqliteSessionStore({ path: dbPath });
    stores.push(remote);
    const lease = await remote.acquireLease!('demo/s1');
    expect(lease).not.toBeNull();

    const res = await post(a.base, 'demo', 's1', 'hi');
    expect(res.status).toBe(409);
    await res.text();
  });

  it('accepts the turn once the other instance releases', async () => {
    const a = instance();
    await started();

    const remote = sqliteSessionStore({ path: dbPath });
    stores.push(remote);
    const lease = await remote.acquireLease!('demo/s1');
    const blocked = await post(a.base, 'demo', 's1', 'hi');
    await blocked.text();
    expect(blocked.status).toBe(409);

    await lease!.release();

    const res = await post(a.base, 'demo', 's1', 'hi');
    expect(res.status).toBe(200);
    const events = await readEvents(res);
    expect(events.map((e) => e.kind)).toEqual(['message', 'text-delta', 'message', 'turn-end']);
  });

  it('a lease on a DIFFERENT session does not block this one', async () => {
    const a = instance();
    await started();

    const remote = sqliteSessionStore({ path: dbPath });
    stores.push(remote);
    await remote.acquireLease!('demo/other');

    const res = await post(a.base, 'demo', 's1', 'hi');
    expect(res.status).toBe(200);
    await res.text();
  });

  it('releases the lease when its own turn finishes, so the next instance can take it', async () => {
    const a = instance();
    await started();

    const res = await post(a.base, 'demo', 's1', 'hi');
    await res.text();

    const remote = sqliteSessionStore({ path: dbPath });
    stores.push(remote);
    expect(await remote.isLeased!('demo/s1')).toBe(false);
    expect(await remote.acquireLease!('demo/s1')).not.toBeNull();
  });
});

d('cross-instance live tail (store poll)', () => {
  it('picks up events written by a turn running on another instance, and ends at turn-end', async () => {
    const b = instance();
    await started();

    // Instance A: its own store handle, its own lease, a real turn.
    const remoteStore = sqliteSessionStore({ path: dbPath });
    stores.push(remoteStore);
    const lease = await remoteStore.acquireLease!('demo/s1');
    expect(lease).not.toBeNull();

    const slowModel = scriptedProvider(() => [
      { type: 'text-delta', text: 'first' },
      { type: 'delay', ms: 150 },
      { type: 'text-delta', text: 'second' },
      { type: 'delay', ms: 150 },
      { type: 'text-delta', text: 'third' },
      { type: 'done' },
    ]);
    const remoteTurn = runTurn(
      {
        agent: { name: 'demo', config: { model: slowModel, instructions: 'be terse' }, tools: new Map() },
        store: remoteStore,
        sessionId: 's1',
        event: undefined,
        emit: () => {},
      },
      'hi',
    ).then(async () => {
      await lease!.release();
    });

    // Instance B, which has no in-process knowledge of that turn at all.
    const startedAt = Date.now();
    const res = await fetch(`${b.base}/__litro/agent/demo/s1?from=0`);
    const events = await readEvents(res);
    const elapsed = Date.now() - startedAt;
    await remoteTurn;

    expect(res.status).toBe(200);
    // Guards against this passing on a lucky full replay: the remote turn
    // holds ~300ms of scripted delay, so a response that returned sooner
    // than that never polled -- it just read an already-finished log.
    expect(elapsed).toBeGreaterThan(200);
    const kinds = events.map((e) => e.kind);
    expect(kinds[0]).toBe('message');
    expect(kinds.at(-1)).toBe('turn-end');
    // the deltas that landed AFTER the tail started are the whole point
    const deltas = events.filter((e) => e.kind === 'text-delta').map((e) => (e.payload as { text: string }).text);
    expect(deltas).toEqual(['first', 'second', 'third']);
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i + 1));
  });

  it('stops tailing when the remote lease disappears without a turn-end', async () => {
    const b = instance();
    await started();

    const remoteStore = sqliteSessionStore({ path: dbPath });
    stores.push(remoteStore);
    const lease = await remoteStore.acquireLease!('demo/s1');
    await remoteStore.append('s1', { ts: 1, kind: 'message', payload: { role: 'user', text: 'hi' } });
    await remoteStore.append('s1', { ts: 2, kind: 'text-delta', payload: { text: 'partial' } });

    // The remote instance dies mid-turn: the lease goes, no turn-end lands.
    setTimeout(() => void lease!.release(), 120);

    const res = await fetch(`${b.base}/__litro/agent/demo/s1?from=0`);
    const events = await readEvents(res);

    expect(res.status).toBe(200);
    expect(events.map((e) => e.kind)).toEqual(['message', 'text-delta']);
    expect(events.some((e) => e.kind === 'turn-end')).toBe(false);
  });

  it('does not poll at all when no turn is in flight anywhere', async () => {
    const a = instance();
    await started();
    await (await post(a.base, 'demo', 's1', 'hi')).text();

    const started_at = Date.now();
    const res = await fetch(`${a.base}/__litro/agent/demo/s1?from=0`);
    const events = await readEvents(res);

    expect(events.at(-1)?.kind).toBe('turn-end');
    // a replay of a finished session returns immediately, no poll interval
    expect(Date.now() - started_at).toBeLessThan(100);
  });

  it('a from=<seq> reconnect during a remote turn replays only the suffix', async () => {
    const b = instance();
    await started();

    const remoteStore = sqliteSessionStore({ path: dbPath });
    stores.push(remoteStore);
    const lease = await remoteStore.acquireLease!('demo/s1');
    await remoteStore.append('s1', { ts: 1, kind: 'message', payload: { role: 'user', text: 'hi' } });
    await remoteStore.append('s1', { ts: 2, kind: 'text-delta', payload: { text: 'one' } });

    setTimeout(() => {
      void (async () => {
        await remoteStore.append('s1', { ts: 3, kind: 'text-delta', payload: { text: 'two' } });
        await remoteStore.append('s1', { ts: 4, kind: 'turn-end', payload: null });
        await lease!.release();
      })();
    }, 120);

    const res = await fetch(`${b.base}/__litro/agent/demo/s1?from=3`);
    const events = await readEvents(res);

    expect(events.map((e) => e.seq)).toEqual([3, 4]);
    expect(events.at(-1)?.kind).toBe('turn-end');
  });
});

describe('the default JSONL store stays single-instance', () => {
  it('exposes no lease API, so locking remains per-process -- the documented limitation', () => {
    const store = fileSessionStore({ dir: '/tmp/never-written' });
    expect(store.acquireLease).toBeUndefined();
    expect(store.isLeased).toBeUndefined();
  });
});
