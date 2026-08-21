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
import type { SessionEvent, SessionLease, SessionStore } from '../sessions/types.js';
import { resolveTelemetry, type Telemetry } from '../telemetry/runtime.js';

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

  // Tools are the Task 11 scanner's concern -- `defineAgent` rejects a
  // non-empty `config.tools` at definition time (an explicit ToolDefinition
  // carries no `name` field to key a Map by), so by the time entries reach
  // this handler `entry.tools` (scanner-discovered `tools/*.ts`) is the
  // only source; the handler builds its tool Map from the manifest entries
  // only.
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

/** Turn-lease duration requested from a lease-capable store, and how often
 *  the holder renews it. A lease only lapses if an instance stalls (or
 *  dies) for a full TTL, at which point another instance may take the
 *  session over -- which is exactly the desired recovery behaviour. */
const TURN_LEASE_TTL_MS = 30_000;
const TURN_LEASE_RENEW_MS = Math.floor(TURN_LEASE_TTL_MS / 3);

/** How often a cross-instance live tail re-reads the store. Only used when
 *  a turn is running on ANOTHER instance, where the in-process broadcast
 *  can never reach this one. */
const REMOTE_TAIL_POLL_MS = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    // Never hold the process open just to poll.
    (timer as { unref?: () => void }).unref?.();
  });
}

/** Starts renewing `lease` on a heartbeat. Losing ownership stops the
 *  heartbeat but NEVER aborts the turn: an in-flight turn always runs to
 *  completion and keeps appending, per the durability contract. */
function startLeaseHeartbeat(lease: SessionLease): () => void {
  const timer = setInterval(() => {
    void lease
      .renew()
      .then((held) => {
        if (!held) clearInterval(timer);
      })
      .catch(() => {
        // A transient renew failure is not fatal; the next tick retries,
        // and the worst case is the lease lapsing and another instance
        // taking over -- which the TTL already allows for.
      });
  }, TURN_LEASE_RENEW_MS);
  (timer as { unref?: () => void }).unref?.();
  return () => clearInterval(timer);
}

/** A live-tailing GET registers one of these per broadcast key. `onEvent`
 *  is the normal per-event forward; `onClose` is the TERMINAL close signal
 *  (Finding 1) -- invoked once, from `closeTails()`, when the POST side is
 *  done for good (success, thrown error, or a dead turn) regardless of
 *  whether a `turn-end` event was ever appended. It is transport-level
 *  cleanup (encoder.done() + controller.close() + unsubscribe) and MUST be
 *  idempotent: a subscriber that already closed itself on `turn-end` sees
 *  a no-op call here. */
interface Subscriber {
  onEvent: (ev: SessionEvent) => void;
  onClose: () => void;
}
const broadcastRegistry = new Map<string, Set<Subscriber>>();

function subscribe(key: string, sub: Subscriber): void {
  let subs = broadcastRegistry.get(key);
  if (!subs) {
    subs = new Set();
    broadcastRegistry.set(key, subs);
  }
  subs.add(sub);
}

function unsubscribe(key: string, sub: Subscriber): void {
  const subs = broadcastRegistry.get(key);
  if (!subs) return;
  subs.delete(sub);
  if (subs.size === 0) broadcastRegistry.delete(key);
}

function broadcast(key: string, ev: SessionEvent): void {
  const subs = broadcastRegistry.get(key);
  if (!subs) return;
  // Iterate a snapshot -- a subscriber's own callback (e.g. unsubscribing
  // itself on turn-end) mutating `subs` mid-iteration is safe either way,
  // but this makes the safety explicit.
  for (const sub of [...subs]) {
    // Finding 2: isolate subscribers from each other. A throwing onEvent
    // must never propagate into the POST owner's emit path -- drop the
    // offending subscriber instead.
    try {
      sub.onEvent(ev);
    } catch {
      unsubscribe(key, sub);
    }
  }
}

/** Finding 1: terminal close signal for every live tail on `key`, called
 *  unconditionally from `handlePost`'s `finally` once the turn is over (by
 *  any path -- normal completion, thrown error, or a dead turn that never
 *  produced a `turn-end` event). Does NOT touch the store or the broadcast
 *  channel itself -- it only tells subscribers "stop waiting", so the
 *  session log stays a truthful record of what actually happened. */
function closeTails(key: string): void {
  const subs = broadcastRegistry.get(key);
  if (!subs) return;
  for (const sub of [...subs]) {
    // Finding 2: isolate here too -- a throwing onClose must not stop the
    // rest of the tails from being closed. Force the unsubscribe below
    // regardless, so a failing subscriber can't wedge the registry.
    try {
      sub.onClose();
    } catch {
      // dropped
    }
    unsubscribe(key, sub);
  }
}

async function handlePost(
  event: H3Event,
  agent: ResolvedAgent,
  sessionId: string,
  store: SessionStore,
  telemetry: Telemetry,
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

  // Two locks, deliberately. The in-process `locks` Set above is the cheap
  // fast path and the ONLY lock a store without lease support has. A
  // lease-capable store (see `sessions/sqlite`) adds the cross-instance
  // half: without it, two app instances would each pass their own local
  // check and run concurrent turns on the same session.
  let lease: SessionLease | null = null;
  if (store.acquireLease) {
    try {
      lease = await store.acquireLease(key, { ttlMs: TURN_LEASE_TTL_MS });
    } catch (err) {
      locks.delete(key);
      throw err;
    }
    if (!lease) {
      locks.delete(key);
      throw new AgentError('A turn is already in progress for this session', { status: 409 });
    }
  }
  const stopHeartbeat = lease ? startLeaseHeartbeat(lease) : undefined;

  setResponseHeader(event, 'content-type', 'application/x-ndjson; charset=utf-8');
  setResponseHeader(event, 'cache-control', 'no-store');
  const encoder = createStreamEncoder();
  const textEncoder = new TextEncoder();

  // Durability contract (Finding 3): a POST client disconnecting mid-turn
  // must NOT abort the turn. `clientGone` flips true the moment writing to
  // this controller fails (or the platform calls `cancel()`); from then on
  // `emit` SKIPS enqueueing to this dead response stream but still appends
  // to the store and broadcasts to any live tails -- the turn always runs
  // to completion, the persisted log stays complete, and a reconnecting
  // client (or a fresh GET) replays everything via `?from=`.
  let clientGone = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const tryEnqueue = (bytes: Uint8Array): void => {
        if (clientGone) return;
        try {
          controller.enqueue(bytes);
        } catch {
          clientGone = true;
        }
      };
      const tryClose = (): void => {
        if (clientGone) return;
        try {
          controller.close();
        } catch {
          clientGone = true;
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      (async () => {
        const emit = (ev: SessionEvent): void => {
          tryEnqueue(textEncoder.encode(encoder.value(ev)));
          broadcast(key, ev);
        };
        const deps: TurnDeps = {
          agent: { name: agent.name, config: agent.config, tools: agent.tools },
          store,
          sessionId,
          event,
          emit,
          telemetry,
        };
        try {
          await runTurn(deps, text);
          tryEnqueue(textEncoder.encode(encoder.done()));
          tryClose();
        } catch (err) {
          tryEnqueue(textEncoder.encode(encoder.error(errorPayload(err, isDev()))));
          tryClose();
        } finally {
          // Release the lock on EVERY path (success, thrown error) before
          // anything else -- a leaked lock would wedge the session forever.
          locks.delete(key);
          stopHeartbeat?.();
          if (lease) {
            // A failed release is survivable -- the lease expires on its
            // own TTL -- but it must never stop `closeTails()` below from
            // running, or live tails would hang.
            try {
              await lease.release();
            } catch {
              // fall through to closeTails
            }
          }
          // Finding 1: unconditionally close every live tail on this key
          // now that the turn is over, whether or not it ever produced a
          // `turn-end` event (a dead turn -- store rejection, a throwing
          // provider generator -- must not leave GETs hanging forever).
          closeTails(key);
        }
      })();
    },
    cancel() {
      // Client disconnected: stop trying to write to this stream, but the
      // turn above keeps running -- see the durability contract above.
      clientGone = true;
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
  // Guards every controller write below: flips true the moment this stream
  // is done, by whichever path gets there first (normal turn-end, the
  // terminal `closeTails()` signal from Finding 1, an error, or the client
  // disconnecting) so no path double-closes or writes-after-close.
  let closed = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      (async () => {
        let lastSeq = from - 1;
        let sawTurnEnd = false;

        const finish = (): void => {
          if (closed) return;
          closed = true;
          controller.enqueue(textEncoder.encode(encoder.done()));
          controller.close();
        };

        try {
          // Ordering: subscribe to the broadcast BEFORE replaying the store,
          // if a turn might be in flight. `onEvent` only BUFFERS while we
          // replay -- it never writes to the wire directly -- so a turn
          // event that lands mid-replay is never lost in the gap between
          // "replay finished reading the store" and "we started listening".
          // The buffer is drained (deduped by seq against what replay
          // already sent) right after replay completes, below. `onClose` is
          // wired to `finish()` too, so a POST that dies (Finding 1) during
          // this brief window still terminates the stream instead of
          // hanging in the buffered-drain/live-forward code below.
          const held = locks.has(key);

          // Cross-instance tail. When the turn is running on ANOTHER
          // instance there is no in-process broadcast to subscribe to, so
          // the store itself becomes the channel and this stream polls it.
          //
          // Asked BEFORE the replay on purpose: asking afterwards has a
          // real gap -- a remote turn that finishes and releases its lease
          // between "replay ended without a turn-end" and "is it still
          // leased?" would read as idle, and the client would lose the
          // tail it reconnected for.
          const heldRemotely = !held && store.isLeased ? await store.isLeased(key) : false;

          const buffered: SessionEvent[] = [];
          const bufferSub: Subscriber = {
            onEvent: (ev) => {
              buffered.push(ev);
            },
            onClose: finish,
          };
          if (held) {
            subscribe(key, bufferSub);
            activeUnsub = () => unsubscribe(key, bufferSub);
          }

          for await (const ev of store.read(sessionId, from)) {
            if (closed) return;
            controller.enqueue(textEncoder.encode(encoder.value(ev)));
            lastSeq = ev.seq;
            if (ev.kind === 'turn-end') sawTurnEnd = true;
          }

          if (!held) {
            if (heldRemotely && !sawTurnEnd) {
              // Poll until the turn ends or its lease is gone. The
              // check-then-drain order is what makes this correct: if the
              // lease was ALREADY gone before a drain, that drain is
              // guaranteed to have seen everything the owner ever wrote,
              // so one more pass is never needed.
              for (;;) {
                if (closed) return;
                // DO NOT move this below the drain. Reading the lease AFTER
                // the drain inverts the guarantee: the owner could append
                // its last events and release between the two, and this
                // tail would exit having never seen them. Checking first
                // means a `false` here can only describe a state that was
                // already true before the drain ran.
                const stillLeased = store.isLeased ? await store.isLeased(key) : false;

                for await (const ev of store.read(sessionId, lastSeq + 1)) {
                  if (closed) return;
                  controller.enqueue(textEncoder.encode(encoder.value(ev)));
                  lastSeq = ev.seq;
                  if (ev.kind === 'turn-end') {
                    sawTurnEnd = true;
                    break;
                  }
                }

                if (sawTurnEnd || closed) break;
                // The owner was already gone BEFORE the drain above, and
                // that drain still produced no turn-end: it crashed, or its
                // lease lapsed. Everything it ever wrote has been sent, so
                // stop rather than poll forever -- the lease TTL is what
                // bounds this wait.
                if (!stillLeased) break;
                await sleep(REMOTE_TAIL_POLL_MS);
              }
              if (closed) return;
            }
            finish();
            return;
          }

          if (!sawTurnEnd) {
            for (const ev of buffered) {
              if (closed) return;
              if (ev.seq <= lastSeq) continue; // already sent by replay
              controller.enqueue(textEncoder.encode(encoder.value(ev)));
              lastSeq = ev.seq;
              if (ev.kind === 'turn-end') sawTurnEnd = true;
            }
          }
          // Synchronous swap, no await in between -- nothing can broadcast
          // into the gap between unsubscribing the buffering listener and
          // subscribing the live-forwarding one below.
          unsubscribe(key, bufferSub);
          activeUnsub = undefined;

          if (closed) return;

          if (sawTurnEnd) {
            finish();
            return;
          }

          // Still live: forward new events straight through until turn-end
          // -- or until `onClose` fires (Finding 1: the turn died without
          // ever producing one, e.g. a store rejection or a throwing
          // provider generator). Either path resolves the wait and tears
          // down the subscription exactly once.
          await new Promise<void>((resolveWait) => {
            const forwardSub: Subscriber = {
              onEvent: (ev) => {
                if (ev.seq <= lastSeq) return;
                lastSeq = ev.seq;
                controller.enqueue(textEncoder.encode(encoder.value(ev)));
                if (ev.kind === 'turn-end') {
                  unsubscribe(key, forwardSub);
                  activeUnsub = undefined;
                  finish();
                  resolveWait();
                }
              },
              onClose: () => {
                unsubscribe(key, forwardSub);
                activeUnsub = undefined;
                finish();
                resolveWait();
              },
            };
            subscribe(key, forwardSub);
            activeUnsub = () => unsubscribe(key, forwardSub);
          });
        } catch (err) {
          activeUnsub?.();
          activeUnsub = undefined;
          if (!closed) {
            closed = true;
            controller.enqueue(textEncoder.encode(encoder.error(errorPayload(err, isDev()))));
            controller.close();
          }
        }
      })();
    },
    cancel() {
      // Client disconnected mid-tail: unsubscribe so the broadcast registry
      // doesn't accumulate dead listeners, and stop any further writes to
      // this now-gone controller.
      activeUnsub?.();
      activeUnsub = undefined;
      closed = true;
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
  // Resolved ONCE per handler, not per request: with no tracer configured
  // this is the shared no-op and every span hook is a boolean check.
  const telemetry = resolveTelemetry(runtimeConfig?.telemetry);

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

      if (method === 'POST') return await handlePost(event, agent, sessionId, store, telemetry);
      return handleGet(event, agent, sessionId, store);
    } catch (err) {
      if (err instanceof AgentError) return sendError(event, err);
      throw err;
    }
  });
}
