/**
 * The bridge protocol: the wire format between a Litro page and a native shell.
 *
 * This module is the single source of truth for the format. It is deliberately
 * NOT an implementation of either side. The page-side transport arrives with
 * the shell adapter, and the native side is Swift; both are written against
 * what is here, and `__tests__/protocol.test.ts` pins every rule the prose in
 * design/specs/2026-10-29-litro-native-bridge-protocol.md states.
 *
 * It is written before either side exists on purpose. A format that is decided
 * while one side is being written ends up describing that side's convenience,
 * and the second implementer inherits it as a fact.
 *
 * NOTHING HERE TOUCHES A GLOBAL
 *
 * No `window`, no `webkit`, no feature probe, at module scope or anywhere else.
 * This file is pure data and pure functions, so a server render that imports it
 * is safe, and so a test can drive it with no DOM. The same rule as bridge.ts,
 * for the same reason: see BUILD-009.
 */

import type { Capability, OS } from './types.js';

/* ── Version ──────────────────────────────────────────────────────────── */

/**
 * The protocol version this package speaks.
 *
 * An integer, because `PlatformInfo.bridgeVersion` is a number and comparing
 * versions must never involve parsing. It is bumped only when the wire format
 * changes in a way an older peer cannot read; adding a capability does not bump
 * it, because the handshake already carries which capabilities exist.
 */
export const BRIDGE_PROTOCOL_VERSION = 1;

/**
 * The oldest shell version this page can still talk to.
 *
 * A shell in the wild cannot be updated on demand: it is an installed app, and
 * a user may run a months-old build against a freshly deployed page. So the
 * page keeps a floor rather than demanding an exact match. A shell below the
 * floor is treated as no shell at all, and the page falls back to the web
 * bridge — a degraded app is better than a broken one.
 */
export const MIN_SUPPORTED_SHELL_VERSION = 1;

/* ── Transport names ──────────────────────────────────────────────────── */

/**
 * The message handler the page posts to, and the global the shell installs.
 *
 * Both are named here rather than in the transport so the Swift side has one
 * place to copy from. On iOS the shell registers a WKScriptMessageHandler under
 * {@link HANDLER_NAME} and injects {@link GLOBAL_NAME} at document start, before
 * any page script runs, so the page can detect a shell synchronously without
 * waiting for a round trip.
 */
export const HANDLER_NAME = 'litroNative';

/** @see HANDLER_NAME */
export const GLOBAL_NAME = '__litroNative';

/* ── Envelope ─────────────────────────────────────────────────────────── */

/**
 * Every method the page may call.
 *
 * One flat namespace, matching the `NativeBridge` surface. Flat rather than
 * nested because a method name is compared as a string on the Swift side, and a
 * switch over a flat set of constants is the thing hardest to get subtly wrong.
 */
export const METHODS = [
  'handshake',
  'haptics.impact',
  'haptics.notify',
  'haptics.selection',
  'notifications.schedule',
  'notifications.cancel',
  'badging.set',
  'badging.clear',
  'secureStorage.get',
  'secureStorage.set',
  'secureStorage.remove',
  'canShare',
  'share',
  'requestReview',
] as const;

export type Method = (typeof METHODS)[number];

const METHOD_SET: ReadonlySet<string> = new Set(METHODS);

/** Whether `value` names a method in this protocol version. */
export function isMethod(value: unknown): value is Method {
  return typeof value === 'string' && METHOD_SET.has(value);
}

/**
 * A call from the page to the shell.
 *
 * JSON-RPC 2.0 shaped, and the repo already speaks that dialect in the MCP App
 * bridge, so the conventions carry over. Two deliberate narrowings: every
 * request carries an `id` (the page never sends a notification, because a call
 * whose failure is invisible is a call that is hard to debug), and `params` is
 * always an object or absent, never positional.
 */
export interface BridgeRequest {
  jsonrpc: '2.0';
  id: string;
  method: Method;
  params?: Record<string, unknown>;
}

/** A successful reply. */
export interface BridgeSuccess {
  jsonrpc: '2.0';
  id: string;
  result: unknown;
}

/** A failed reply. */
export interface BridgeFailure {
  jsonrpc: '2.0';
  id: string;
  error: BridgeError;
}

export type BridgeResponse = BridgeSuccess | BridgeFailure;

export interface BridgeError {
  code: number;
  message: string;
  data?: unknown;
}

/* ── Error codes ──────────────────────────────────────────────────────── */

/**
 * The error codes a shell may return.
 *
 * The first three are JSON-RPC's own reserved codes and keep their meanings.
 * The rest sit in the implementation-defined range the specification sets aside
 * (-32000 to -32099).
 *
 * There is no code for "this capability is not available here", and that
 * absence is the point. A capability the shell did not compile in is omitted
 * from the handshake, and the page must then answer the call itself rather than
 * send it — see {@link isCapabilityAvailable}. The contract in types.ts says a
 * capability call never throws for a missing platform feature, and a protocol
 * that can report one invites an implementation that breaks that promise.
 */
export const ERROR_CODES = {
  /** The shell could not parse the message as JSON. */
  PARSE_ERROR: -32700,
  /** Well-formed JSON, but not a valid request for this protocol version. */
  INVALID_REQUEST: -32600,
  /** A method this shell does not know. */
  METHOD_NOT_FOUND: -32601,
  /** The method is known, but `params` do not satisfy it. */
  INVALID_PARAMS: -32602,
  /** The shell tried and failed. The user may retry. */
  INTERNAL_ERROR: -32603,
  /** The user declined a permission prompt. Not a fault, and not retryable. */
  PERMISSION_DENIED: -32000,
  /** The shell did not reply in time. Raised by the PAGE, never sent on the wire. */
  TIMEOUT: -32001,
  /** The shell speaks a protocol version this page cannot read. */
  VERSION_UNSUPPORTED: -32002,
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/* ── Timeouts ─────────────────────────────────────────────────────────── */

/**
 * How long the page waits for a reply before failing the call.
 *
 * A dropped message must not leave a promise pending for the life of the page.
 * This is shorter than the MCP App bridge's 30 seconds because every call here
 * is a local device operation: nothing on the other side is doing network work.
 */
export const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * How long the page waits for the handshake.
 *
 * Shorter still, because it runs during startup and everything else queues
 * behind it. A shell that cannot answer this fast is treated as absent, and the
 * page uses the web bridge.
 */
export const HANDSHAKE_TIMEOUT_MS = 2_000;

/**
 * How long a share sheet or permission prompt may sit open.
 *
 * These are the only calls that legitimately wait on a human, so they are
 * exempt from {@link DEFAULT_TIMEOUT_MS}. A person reading a share sheet for
 * twenty seconds is not a failure.
 */
export const INTERACTIVE_TIMEOUT_MS = 120_000;

/** Methods that wait on a human and therefore use {@link INTERACTIVE_TIMEOUT_MS}. */
export const INTERACTIVE_METHODS: readonly Method[] = ['share', 'requestReview'];

/** The timeout that applies to `method`. */
export function timeoutFor(method: Method): number {
  if (method === 'handshake') return HANDSHAKE_TIMEOUT_MS;
  return INTERACTIVE_METHODS.includes(method) ? INTERACTIVE_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
}

/* ── Handshake ────────────────────────────────────────────────────────── */

/**
 * What the shell injects synchronously, before any page script runs.
 *
 * This exists so the page can tell "a shell is present" without a round trip.
 * It carries no capability data on purpose: what the shell can actually do is
 * the handshake's answer, and duplicating it here would create two sources of
 * truth that drift apart across an app update.
 */
export interface ShellMarker {
  /** The protocol version the shell speaks. */
  version: number;
}

/** The shell's answer to `handshake`. */
export interface HandshakeResult {
  version: number;
  os: OS;
  appVersion?: string;
  osVersion?: string;
  /**
   * The capabilities this build compiled in.
   *
   * A capability absent here is one the page must answer itself. The shell
   * omits a capability rather than reporting it and failing the call, so that
   * an app can hide a feature instead of offering one that does nothing.
   */
  capabilities: readonly Capability[];
}

const CAPABILITIES: ReadonlySet<string> = new Set<Capability>([
  'haptics',
  'notifications',
  'badging',
  'secureStorage',
  'share',
  'review',
]);

/** Which capability a method needs, or `null` when it needs none. */
export function capabilityFor(method: Method): Capability | null {
  if (method === 'handshake') return null;
  if (method.startsWith('haptics.')) return 'haptics';
  if (method.startsWith('notifications.')) return 'notifications';
  if (method.startsWith('badging.')) return 'badging';
  if (method.startsWith('secureStorage.')) return 'secureStorage';
  if (method === 'share' || method === 'canShare') return 'share';
  if (method === 'requestReview') return 'review';
  return null;
}

/**
 * Whether `method` may be sent to a shell reporting `capabilities`.
 *
 * `false` means the page answers the call itself with the contract's documented
 * empty behavior. It does NOT mean the call fails.
 */
export function isCapabilityAvailable(method: Method, capabilities: readonly Capability[]): boolean {
  const needed = capabilityFor(method);
  return needed === null || capabilities.includes(needed);
}

/* ── Validation ───────────────────────────────────────────────────────── */

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Whether `value` is a well-formed request for this protocol version.
 *
 * The shell runs this before dispatching. It is exported rather than kept
 * private because the page runs it too, over its own outgoing messages, in
 * tests: a page that can emit a message its own validator rejects would be
 * found only on a device.
 */
export function isBridgeRequest(value: unknown): value is BridgeRequest {
  if (!isRecord(value)) return false;
  if (value.jsonrpc !== '2.0') return false;
  if (typeof value.id !== 'string' || value.id.length === 0) return false;
  if (!isMethod(value.method)) return false;
  if ('params' in value && value.params !== undefined && !isRecord(value.params)) return false;
  return true;
}

/** Whether `value` is a well-formed response. */
export function isBridgeResponse(value: unknown): value is BridgeResponse {
  if (!isRecord(value)) return false;
  if (value.jsonrpc !== '2.0') return false;
  if (typeof value.id !== 'string' || value.id.length === 0) return false;
  const hasResult = 'result' in value;
  const hasError = 'error' in value;
  // Exactly one. A reply carrying both is ambiguous about whether the work
  // happened, and a reply carrying neither says nothing at all.
  if (hasResult === hasError) return false;
  if (hasError && !isBridgeError(value.error)) return false;
  return true;
}

/** Whether `value` is a well-formed error object. */
export function isBridgeError(value: unknown): value is BridgeError {
  if (!isRecord(value)) return false;
  if (typeof value.code !== 'number' || !Number.isInteger(value.code)) return false;
  if (typeof value.message !== 'string') return false;
  return true;
}

/** Whether `value` is a well-formed handshake result. */
export function isHandshakeResult(value: unknown): value is HandshakeResult {
  if (!isRecord(value)) return false;
  if (typeof value.version !== 'number' || !Number.isInteger(value.version)) return false;
  if (value.os !== 'ios' && value.os !== 'android' && value.os !== 'web') return false;
  if (!Array.isArray(value.capabilities)) return false;
  if (!value.capabilities.every((c) => typeof c === 'string' && CAPABILITIES.has(c))) return false;
  for (const k of ['appVersion', 'osVersion'] as const) {
    if (k in value && value[k] !== undefined && typeof value[k] !== 'string') return false;
  }
  return true;
}

/**
 * Whether a shell reporting `version` can be talked to.
 *
 * A shell NEWER than this page is accepted. The page sends only the methods it
 * knows, and a newer shell must still answer them — that is what bumping the
 * version is for. Rejecting a newer shell would break every installed app the
 * moment a page deploys behind it.
 */
export function isVersionSupported(version: number): boolean {
  return Number.isInteger(version) && version >= MIN_SUPPORTED_SHELL_VERSION;
}

/* ── Construction ─────────────────────────────────────────────────────── */

/**
 * Builds a request.
 *
 * `id` is supplied by the caller rather than generated here, so this stays a
 * pure function and a test can assert on an exact message. The transport owns
 * id generation, and ids need only be unique within one page session.
 */
export function request(id: string, method: Method, params?: Record<string, unknown>): BridgeRequest {
  const req: BridgeRequest = { jsonrpc: '2.0', id, method };
  if (params !== undefined) req.params = params;
  return req;
}

/** Builds a success reply. Exported for the fake shell the tests drive. */
export function success(id: string, result: unknown): BridgeSuccess {
  return { jsonrpc: '2.0', id, result };
}

/** Builds a failure reply. */
export function failure(id: string, code: number, message: string, data?: unknown): BridgeFailure {
  const error: BridgeError = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: '2.0', id, error };
}
