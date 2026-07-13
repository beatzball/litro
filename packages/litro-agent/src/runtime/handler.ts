/**
 * Runtime HTTP handler for `/__litro/agent/:agent/:session`.
 *
 * Consumed by the generated stub server/stubs/agent-handler.ts, which passes
 * in the `agentEntries` array from `#litro/agent-manifest`. Mirrors the
 * actions handler's CSRF gate stack (see `@beatzball/litro/actions/handler`)
 * with one difference: the `x-litro-agent` header gate applies to POST only
 * -- GET is a read and carries no custom header, but still passes through
 * the Sec-Fetch-Site and Origin/Host gates plus the agent's `access` guard.
 *
 * POST starts a turn (`runTurn`, Task 9) and streams its `SessionEvent`s as
 * NDJSON, holding a per-process `agent/session` lock for the duration
 * (concurrent POST -> 409). GET replays the stored log from `?from=<seq>`
 * and, if a turn is in flight, live-tails it via an in-process broadcast
 * until `turn-end`. See `handleGet` for the subscribe-before-replay
 * ordering that keeps the replay-to-live handoff gap-free.
 */
import {
  defineEventHandler,
  getRouterParam,
  getRequestHeader,
  getQuery,
  readRawBody,
  setResponseStatus,
  setResponseHeader,
  type H3Event,
  type EventHandler,
} from 'h3';
import { deserializeValue, createStreamEncoder } from '@beatzball/litro/stream';
import { runTurn, type TurnDeps } from './loop.js';
import { fileSessionStore, validateSessionId } from '../sessions/file.js';
import { AGENT_CONFIG } from '../index.js';
import type { AgentConfig, AgentDefinition, AgentRuntimeConfig, ToolDefinition } from '../index.js';
import { AgentError, errorPayload } from '../errors.js';
import type { SessionEvent, SessionStore } from '../sessions/types.js';

export interface AgentManifestEntry {
  name: string;
  /** agent.ts namespace: `default` = AgentDefinition, `access?` = guard. */
  module: Record<string, unknown>;
  /** instructions.md content, inlined at build time. */
  instructions: string;
  tools: Array<{ name: string; module: Record<string, unknown> }>;
}

type AccessGuard = (event: H3Event) => void | Promise<void>;

interface ResolvedAgent {
  name: string;
  config: AgentConfig;
  tools: Map<string, ToolDefinition>;
  access?: AccessGuard;
}

function isDev(): boolean {
  return (process as unknown as { dev?: boolean }).dev === true;
}

/** Manifest instructions override config.instructions only when the config
 *  value LOOKS like a relative path the build was supposed to inline (starts
 *  with './' or '../'). A literal instructions string in the config stands
 *  as-is. */
function resolveInstructions(config: AgentConfig, manifestInstructions: string): string {
  const raw = config.instructions;
  if (typeof raw === 'string' && (raw.startsWith('./') || raw.startsWith('../'))) {
    return manifestInstructions;
  }
  return raw;
}

function buildAgent(entry: AgentManifestEntry): ResolvedAgent {
  const def = entry.module.default as AgentDefinition;
  const config = def[AGENT_CONFIG] as AgentConfig;
  const access = entry.module.access as AccessGuard | undefined;

  // Tool merging is the Task 11 scanner's concern -- by the time entries
  // reach this handler, `entry.tools` is the authoritative, already-merged
  // list (explicit `config.tools` and scanner-discovered `tools/` are the
  // SAME modules the scanner found; config.tools carries no `name` field to
  // merge by, so the handler builds its tool Map from the manifest entries
  // only).
  const tools = new Map<string, ToolDefinition>();
  for (const t of entry.tools) {
    tools.set(t.name, t.module.default as ToolDefinition);
  }

  return {
    name: entry.name,
    config: { ...config, instructions: resolveInstructions(config, entry.instructions) },
    tools,
    access,
  };
}

function sendError(event: H3Event, err: unknown): string {
  const payload = errorPayload(err, isDev());
  setResponseStatus(event, payload.status);
  setResponseHeader(event, 'content-type', 'application/json; charset=utf-8');
  return JSON.stringify(payload);
}

/** CSRF gate stack, mirroring the actions handler's Sec-Fetch-Site and
 *  Origin/x-forwarded-host logic exactly. The `x-litro-agent` header check
 *  is POST-only -- GET carries no custom header (it's a read), but still
 *  goes through the site/origin checks below. */
function checkGates(event: H3Event, method: string): void {
  const secFetchSite = getRequestHeader(event, 'sec-fetch-site');
  if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
    throw new AgentError('Cross-site agent calls are not allowed', { status: 403 });
  }

  const origin = getRequestHeader(event, 'origin');
  const forwardedHost = getRequestHeader(event, 'x-forwarded-host');
  const host = forwardedHost?.split(',')[0]?.trim() || getRequestHeader(event, 'host');
  if (origin) {
    let originHost: string | undefined;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = undefined;
    }
    if (!host || originHost !== host) {
      throw new AgentError('Origin does not match request host', { status: 403 });
    }
  }

  if (method === 'POST' && getRequestHeader(event, 'x-litro-agent') !== '1') {
    throw new AgentError('Missing x-litro-agent header', { status: 403 });
  }
}

// --- Per-process turn lock + live-tail broadcast registry -----------------
//
// Module state, shared across every request the process handles (confirmed
// shared in both `litro dev` and production builds -- spike Q3, design spec
// section 10). Keyed `${agentName}/${sessionId}`.
const locks = new Set<string>();
const broadcastRegistry = new Map<string, Set<(ev: SessionEvent) => void>>();

function subscribe(key: string, fn: (ev: SessionEvent) => void): void {
  let subs = broadcastRegistry.get(key);
  if (!subs) {
    subs = new Set();
    broadcastRegistry.set(key, subs);
  }
  subs.add(fn);
}

function unsubscribe(key: string, fn: (ev: SessionEvent) => void): void {
  const subs = broadcastRegistry.get(key);
  if (!subs) return;
  subs.delete(fn);
  if (subs.size === 0) broadcastRegistry.delete(key);
}

function broadcast(key: string, ev: SessionEvent): void {
  const subs = broadcastRegistry.get(key);
  if (!subs) return;
  // Iterate a snapshot -- a subscriber's own callback (e.g. `finish()`
  // unsubscribing itself on turn-end) mutating `subs` mid-iteration is safe
  // either way, but this makes the safety explicit.
  for (const fn of [...subs]) fn(ev);
}

async function handlePost(
  event: H3Event,
  agent: ResolvedAgent,
  sessionId: string,
  store: SessionStore,
): Promise<ReadableStream<Uint8Array>> {
  let text: string;
  try {
    const raw = (await readRawBody(event)) ?? '';
    const parsed = deserializeValue(raw) as { text?: unknown } | null;
    if (typeof parsed?.text !== 'string') throw new Error('expected { text: string }');
    text = parsed.text;
  } catch (err) {
    throw new AgentError('Malformed agent request body', { status: 400, cause: err });
  }

  const key = `${agent.name}/${sessionId}`;
  if (locks.has(key)) {
    throw new AgentError('A turn is already in progress for this session', { status: 409 });
  }
  locks.add(key);

  setResponseHeader(event, 'content-type', 'application/x-ndjson; charset=utf-8');
  setResponseHeader(event, 'cache-control', 'no-store');
  const encoder = createStreamEncoder();
  const textEncoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      (async () => {
        const emit = (ev: SessionEvent): void => {
          controller.enqueue(textEncoder.encode(encoder.value(ev)));
          broadcast(key, ev);
        };
        const deps: TurnDeps = {
          agent: { name: agent.name, config: agent.config, tools: agent.tools },
          store,
          sessionId,
          event,
          emit,
        };
        try {
          await runTurn(deps, text);
          controller.enqueue(textEncoder.encode(encoder.done()));
          controller.close();
        } catch (err) {
          controller.enqueue(textEncoder.encode(encoder.error(errorPayload(err, isDev()))));
          controller.close();
        } finally {
          // Release the lock on EVERY path (success, thrown error) before
          // anything else -- a leaked lock would wedge the session forever.
          locks.delete(key);
        }
      })();
    },
  });
}

function parseFrom(event: H3Event): number {
  const query = getQuery(event);
  const raw = query.from;
  if (raw === undefined) return 0;
  const from = parseInt(String(raw), 10);
  if (Number.isNaN(from) || from < 0) {
    throw new AgentError('Invalid "from" query parameter', { status: 400 });
  }
  return from;
}

function handleGet(
  event: H3Event,
  agent: ResolvedAgent,
  sessionId: string,
  store: SessionStore,
): ReadableStream<Uint8Array> {
  const from = parseFrom(event);
  const key = `${agent.name}/${sessionId}`;

  setResponseHeader(event, 'content-type', 'application/x-ndjson; charset=utf-8');
  setResponseHeader(event, 'cache-control', 'no-store');
  const encoder = createStreamEncoder();
  const textEncoder = new TextEncoder();

  // Tracks whatever subscriber is currently live, so `cancel()` (client
  // disconnect) can always unhook it -- set/cleared in lockstep with every
  // subscribe()/unsubscribe() call below.
  let activeUnsub: (() => void) | undefined;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      (async () => {
        let lastSeq = from - 1;
        let sawTurnEnd = false;

        try {
          // Ordering: subscribe to the broadcast BEFORE replaying the store,
          // if a turn might be in flight. `onEvent` only BUFFERS while we
          // replay -- it never writes to the wire directly -- so a turn
          // event that lands mid-replay is never lost in the gap between
          // "replay finished reading the store" and "we started listening".
          // The buffer is drained (deduped by seq against what replay
          // already sent) right after replay completes, below.
          const held = locks.has(key);
          const buffered: SessionEvent[] = [];
          const onEvent = (ev: SessionEvent): void => {
            buffered.push(ev);
          };
          if (held) {
            subscribe(key, onEvent);
            activeUnsub = () => unsubscribe(key, onEvent);
          }

          for await (const ev of store.read(sessionId, from)) {
            controller.enqueue(textEncoder.encode(encoder.value(ev)));
            lastSeq = ev.seq;
            if (ev.kind === 'turn-end') sawTurnEnd = true;
          }

          if (!held) {
            controller.enqueue(textEncoder.encode(encoder.done()));
            controller.close();
            return;
          }

          if (!sawTurnEnd) {
            for (const ev of buffered) {
              if (ev.seq <= lastSeq) continue; // already sent by replay
              controller.enqueue(textEncoder.encode(encoder.value(ev)));
              lastSeq = ev.seq;
              if (ev.kind === 'turn-end') sawTurnEnd = true;
            }
          }
          // Synchronous swap, no await in between -- nothing can broadcast
          // into the gap between unsubscribing the buffering listener and
          // subscribing the live-forwarding one below.
          unsubscribe(key, onEvent);
          activeUnsub = undefined;

          if (sawTurnEnd) {
            controller.enqueue(textEncoder.encode(encoder.done()));
            controller.close();
            return;
          }

          // Still live: forward new events straight through until turn-end.
          await new Promise<void>((resolveWait) => {
            const forward = (ev: SessionEvent): void => {
              if (ev.seq <= lastSeq) return;
              lastSeq = ev.seq;
              controller.enqueue(textEncoder.encode(encoder.value(ev)));
              if (ev.kind === 'turn-end') {
                unsubscribe(key, forward);
                activeUnsub = undefined;
                controller.enqueue(textEncoder.encode(encoder.done()));
                controller.close();
                resolveWait();
              }
            };
            subscribe(key, forward);
            activeUnsub = () => unsubscribe(key, forward);
          });
        } catch (err) {
          activeUnsub?.();
          activeUnsub = undefined;
          controller.enqueue(textEncoder.encode(encoder.error(errorPayload(err, isDev()))));
          controller.close();
        }
      })();
    },
    cancel() {
      // Client disconnected mid-tail: unsubscribe so the broadcast registry
      // doesn't accumulate dead listeners.
      activeUnsub?.();
      activeUnsub = undefined;
    },
  });
}

export function createAgentHandler(
  entries: AgentManifestEntry[],
  runtimeConfig?: AgentRuntimeConfig | null,
): EventHandler {
  const agents = new Map<string, ResolvedAgent>();
  for (const entry of entries) agents.set(entry.name, buildAgent(entry));
  const store = runtimeConfig?.sessions ?? fileSessionStore();

  return defineEventHandler(async (event) => {
    const method = event.method;
    try {
      checkGates(event, method);

      const sessionId = getRouterParam(event, 'session') ?? '';
      validateSessionId(sessionId);

      const agentName = getRouterParam(event, 'agent') ?? '';
      const agent = agents.get(agentName);
      if (!agent) {
        throw new AgentError(`Unknown agent: ${agentName}`, { status: 404 });
      }

      // The guard's `createError` (h3) propagates unmodified -- caught by
      // the outer catch below, which only reshapes AgentError instances and
      // rethrows anything else for h3 to format itself.
      if (agent.access) await agent.access(event);

      if (method === 'POST') return await handlePost(event, agent, sessionId, store);
      return handleGet(event, agent, sessionId, store);
    } catch (err) {
      if (err instanceof AgentError) return sendError(event, err);
      throw err;
    }
  });
}
