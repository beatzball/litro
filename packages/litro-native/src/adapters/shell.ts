/**
 * The shell bridge: every capability, over the bridge protocol, to a native
 * shell hosting this page.
 *
 * THIS IS THE ONLY FILE THAT KNOWS HOW A MESSAGE REACHES THE SHELL
 *
 * No page, component, store or other module in this package posts to the
 * message handler or reads the global the shell injects.
 * `scripts/check-native-boundary.mjs` fails CI when one does. That is what lets
 * the native side be rewritten without touching an app.
 *
 * NOTHING HERE RUNS AT MODULE SCOPE
 *
 * This module is loaded with a dynamic import, from bridge.ts, and only in a
 * browser. Even so it reads no global while it is evaluated: every lookup
 * happens inside {@link connectShell}, against the window it is handed. A
 * module-scope probe builds clean and breaks a server render silently, which is
 * the trap rule BUILD-009 records for the hydration entry.
 *
 * WHAT THE PROTOCOL LEFT TO THIS FILE
 *
 * design/specs/2026-10-29-litro-native-bridge-protocol.md fixes the format and
 * deliberately leaves three things to the transport. They are decided here:
 *
 * - Ids are a random prefix drawn once per connection, then a counter. The
 *   prefix is what matters. The shell evaluates each reply in whatever
 *   document is current when it finishes, and the next document of the same
 *   app has the same global and its own receiver. A bare counter restarts at 1
 *   on every full load, so a late reply for document A's call would settle
 *   document B's call with the same number — a keychain value read for one
 *   page handed to another, possibly on a different allowed origin.
 * - Calls are concurrent and unbounded. Replies are matched by id and may
 *   arrive in any order. There is no cap, because every call already carries
 *   its own timeout, which is what bounds the pending set; a cap would only add
 *   a failure mode the contract has no way to express.
 * - A call made before the handshake resolves waits for it. That happens
 *   without a queue: every facade awaits `getBridge()`, and `getBridge()`
 *   resolves only once the handshake has answered or timed out. No call is
 *   ever sent to a shell whose capabilities are not yet known.
 */

import { NativeBridgeError } from '../errors.js';
import {
  ERROR_CODES,
  GLOBAL_NAME,
  HANDLER_NAME,
  isBridgeResponse,
  isHandshakeResult,
  isVersionSupported,
  request,
  timeoutFor,
  type BridgeRequest,
  type BridgeResponse,
  type HandshakeResult,
  type Method,
} from '../protocol.js';
import type {
  Capability,
  HapticNotify,
  HapticStyle,
  LocalNotification,
  NativeBridge,
  PlatformInfo,
  SharePayload,
} from '../types.js';

/* ── The host ─────────────────────────────────────────────────────────── */

/**
 * The two things a shell puts in the page: the marker global, which the shell
 * hands replies to, and the message handler, which the page posts to.
 *
 * An interface so a test can hand in a fake shell, and so the one place that
 * reads `window` is {@link findShellHost}.
 */
export interface ShellHost {
  /**
   * The object the shell injected at document start, carrying `{ version }`.
   * The shell delivers each reply by calling `receive` on it.
   */
  marker: { version?: unknown; receive?: unknown };
  /** Posts one request to the shell. May throw if the message cannot be sent. */
  post(message: BridgeRequest): void;
}

interface MessageHandler {
  postMessage(message: unknown): void;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The shell host in `win`, or `null` when this page is not inside a shell.
 *
 * Both halves must be present. A marker with no handler is a page that cannot
 * send, and a handler with no marker is not ours: the marker is the detection
 * the protocol defines.
 */
export function findShellHost(win: unknown): ShellHost | null {
  if (!isRecord(win)) return null;
  const marker = win[GLOBAL_NAME];
  if (!isRecord(marker)) return null;
  const webkit = win.webkit;
  if (!isRecord(webkit)) return null;
  const handlers = webkit.messageHandlers;
  if (!isRecord(handlers)) return null;
  const handler = handlers[HANDLER_NAME] as MessageHandler | undefined;
  if (typeof handler?.postMessage !== 'function') return null;
  return {
    marker,
    post: (message) => handler.postMessage(message),
  };
}

/* ── The transport ────────────────────────────────────────────────────── */

/**
 * A prefix no other connection will draw: not one in an earlier document of
 * this web view, not one in a second bundled copy of this package.
 *
 * Read at call time, never at module scope. A web view always has
 * `crypto.getRandomValues`; the fallback exists so a missing one degrades to a
 * weaker prefix rather than to no shell at all.
 */
export function connectionPrefix(): string {
  const bytes = new Uint8Array(8);
  const c = (globalThis as { crypto?: { getRandomValues?(a: Uint8Array): Uint8Array } }).crypto;
  if (typeof c?.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

interface Pending {
  resolve(value: unknown): void;
  reject(error: NativeBridgeError): void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Sends requests and matches replies to them.
 *
 * Every call ends. It resolves with the shell's result, rejects with the
 * shell's error, or rejects with {@link ERROR_CODES.TIMEOUT} when the shell
 * stays silent past the method's budget. A dropped message must never leave a
 * promise pending for the life of the page.
 */
export class ShellTransport {
  private readonly pending = new Map<string, Pending>();
  private closed = false;
  private lastId = 0;

  /**
   * @param prefix Starts every id this transport sends. Draw it with
   *   {@link connectionPrefix}; a test passes a fixed one to assert on exact ids.
   */
  constructor(
    private readonly host: ShellHost,
    private readonly prefix: string = connectionPrefix(),
  ) {}

  /** How many calls are waiting on a reply. For tests. */
  get pendingCount(): number {
    return this.pending.size;
  }

  call(method: Method, params?: Record<string, unknown>): Promise<unknown> {
    if (this.closed) {
      return Promise.reject(new NativeBridgeError(ERROR_CODES.INTERNAL_ERROR, 'the shell bridge is closed'));
    }

    let wire: Record<string, unknown> | undefined;
    try {
      wire = params === undefined ? undefined : toWire(params);
    } catch (err) {
      return Promise.reject(
        new NativeBridgeError(ERROR_CODES.INVALID_PARAMS, `params for ${method} are not JSON: ${String(err)}`),
      );
    }

    const id = `${this.prefix}-${++this.lastId}`;
    const message = request(id, method, wire);

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new NativeBridgeError(ERROR_CODES.TIMEOUT, `${method} got no reply in ${timeoutFor(method)}ms`));
      }, timeoutFor(method));
      this.pending.set(id, { resolve, reject, timer });

      try {
        this.host.post(message);
      } catch (err) {
        // The handler refused the message outright. Nothing reached the shell,
        // so nothing will answer: fail now rather than at the timeout.
        this.settle(id)?.reject(
          new NativeBridgeError(ERROR_CODES.INTERNAL_ERROR, `could not post ${method}: ${String(err)}`),
        );
      }
    });
  }

  /**
   * Takes one reply from the shell.
   *
   * The id is read before the reply is judged, the same rule NATIVE-003 sets
   * for the shell: a malformed reply that names a pending call fails that call
   * now, rather than leaving it to wait out its timeout. Only a reply with no
   * id this transport is waiting on is dropped.
   */
  receive(raw: unknown): void {
    let value = raw;
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        return;
      }
    }
    if (!isRecord(value) || typeof value.id !== 'string') return;
    const entry = this.settle(value.id);
    if (entry === undefined) return;

    if (!isBridgeResponse(value)) {
      entry.reject(new NativeBridgeError(ERROR_CODES.INTERNAL_ERROR, 'the shell sent a malformed reply'));
      return;
    }
    const reply: BridgeResponse = value;
    if ('error' in reply) {
      entry.reject(new NativeBridgeError(reply.error.code, reply.error.message, reply.error.data));
      return;
    }
    entry.resolve(reply.result);
  }

  /**
   * Stops the transport. Every pending call rejects at once, and later calls
   * reject without being sent. Used when the handshake fails, so the page falls
   * back to the web bridge and nothing is left holding a timer.
   */
  close(): void {
    this.closed = true;
    for (const id of [...this.pending.keys()]) {
      this.settle(id)?.reject(new NativeBridgeError(ERROR_CODES.INTERNAL_ERROR, 'the shell bridge closed'));
    }
  }

  private settle(id: string): Pending | undefined {
    const entry = this.pending.get(id);
    if (entry === undefined) return undefined;
    this.pending.delete(id);
    clearTimeout(entry.timer);
    return entry;
  }
}

/**
 * Params as they will cross the boundary.
 *
 * A round trip through JSON, so what is posted is exactly what the shell can
 * read. An `undefined` field is dropped instead of reaching the shell as an
 * unknown value, and a `Date` becomes its string. Without this a single
 * non-JSON value nested in params loses the whole message on the native side,
 * id included, and the call waits out its timeout instead of being answered.
 */
function toWire(params: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(params)) as Record<string, unknown>;
}

/* ── Connecting ───────────────────────────────────────────────────────── */

const KNOWN_CAPABILITIES: ReadonlySet<string> = new Set<Capability>([
  'haptics',
  'notifications',
  'badging',
  'secureStorage',
  'share',
  'review',
]);

/**
 * The shell's answer, with capability names this page does not know removed.
 *
 * Adding a capability does not bump the protocol version, so a newer shell may
 * report one this page has never heard of. That shell is still one this page
 * can talk to. `isHandshakeResult` rejects an unknown name, correctly for the
 * format, so the names are filtered before it runs rather than letting a
 * newer app send every older page to the web bridge.
 */
function knownCapabilitiesOnly(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.capabilities)) return value;
  return {
    ...value,
    capabilities: value.capabilities.filter((c) => typeof c === 'string' && KNOWN_CAPABILITIES.has(c)),
  };
}

/**
 * Connects to the shell hosting this page, or answers `null` when there is
 * none it can talk to.
 *
 * `null` covers every way the shell can fail to be usable: no shell, a marker
 * below the supported version, a handshake that errors, times out or answers
 * something malformed. Each of those sends the page to the web bridge, because
 * a degraded app is better than a broken one.
 *
 * @param win The window to look in. Passed in, never read from a global here.
 * @param web The web bridge, which answers for every capability this build of
 *   the shell did not compile in.
 */
export async function connectShell(win: unknown, web: NativeBridge): Promise<ShellBridge | null> {
  const host = findShellHost(win);
  if (host === null) return null;

  const version = host.marker.version;
  if (typeof version !== 'number' || !isVersionSupported(version)) return null;

  const transport = new ShellTransport(host);
  const receive = (reply: unknown): void => transport.receive(reply);
  host.marker.receive = receive;

  const fail = (): null => {
    transport.close();
    if (host.marker.receive === receive) host.marker.receive = undefined;
    return null;
  };

  let answer: unknown;
  try {
    answer = await transport.call('handshake');
  } catch {
    return fail();
  }
  answer = knownCapabilitiesOnly(answer);
  if (!isHandshakeResult(answer) || !isVersionSupported(answer.version)) return fail();

  return new ShellBridge(transport, answer, web);
}

/* ── The bridge ───────────────────────────────────────────────────────── */

function unexpected(method: Method, result: unknown): NativeBridgeError {
  return new NativeBridgeError(
    ERROR_CODES.INTERNAL_ERROR,
    `${method} answered with ${result === null ? 'null' : typeof result}, which it never returns`,
  );
}

/**
 * Every capability, sent to the shell when the shell has it.
 *
 * When the handshake leaves a capability out, the call never reaches the wire.
 * It takes the web behavior for that one capability instead, and the rest keep
 * working natively. A shell that compiled in nothing is still a shell.
 *
 * One exception, on purpose: secure storage never falls back to browser
 * storage here. An app inside the shell reads `isNative` as true, and the
 * documented way to keep a token out of browser storage is to check exactly
 * that. If a build without the keychain module quietly wrote to browser
 * storage, that check would pass and the token would land where any script on
 * the origin can read it. So without the module, `get` answers `null` and the
 * writes do nothing — the documented empty behavior — and `supports` leaves
 * `secureStorage` out.
 */
export class ShellBridge implements NativeBridge {
  readonly id = 'shell' as const;

  constructor(
    private readonly transport: ShellTransport,
    private readonly handshake: HandshakeResult,
    private readonly web: NativeBridge,
  ) {}

  private has(capability: Capability): boolean {
    return this.handshake.capabilities.includes(capability);
  }

  private async send(method: Method, params?: Record<string, unknown>): Promise<void> {
    await this.transport.call(method, params);
  }

  async platform(): Promise<PlatformInfo> {
    const fromWeb = (await this.web.platform()).supports;
    const supports = [...KNOWN_CAPABILITIES].filter((c): c is Capability => {
      const capability = c as Capability;
      if (this.has(capability)) return true;
      return capability !== 'secureStorage' && fromWeb.includes(capability);
    });
    const info: PlatformInfo = {
      isNative: true,
      os: this.handshake.os,
      bridgeVersion: this.handshake.version,
      supports,
    };
    if (this.handshake.appVersion !== undefined) info.appVersion = this.handshake.appVersion;
    if (this.handshake.osVersion !== undefined) info.osVersion = this.handshake.osVersion;
    return info;
  }

  haptics = {
    impact: (style: HapticStyle): Promise<void> =>
      this.has('haptics') ? this.send('haptics.impact', { style }) : this.web.haptics.impact(style),
    notify: (type: HapticNotify): Promise<void> =>
      this.has('haptics') ? this.send('haptics.notify', { type }) : this.web.haptics.notify(type),
    selection: (): Promise<void> =>
      this.has('haptics') ? this.send('haptics.selection') : this.web.haptics.selection(),
  };

  notifications = {
    schedule: async (n: LocalNotification): Promise<string> => {
      if (!this.has('notifications')) return this.web.notifications.schedule(n);
      const result = await this.transport.call('notifications.schedule', { ...n });
      if (typeof result !== 'string') throw unexpected('notifications.schedule', result);
      return result;
    },
    cancel: (id: string): Promise<void> =>
      this.has('notifications') ? this.send('notifications.cancel', { id }) : this.web.notifications.cancel(id),
  };

  /**
   * The count is floored and clamped before it is sent, exactly as the web
   * adapter does. The shell rejects anything but a whole number of 0 or more,
   * and an unread count computed by arithmetic can land on -1 or 2.5 for one
   * tick. The same call must not resolve on the web and reject on a device.
   */
  badging = {
    set: (count: number): Promise<void> =>
      this.has('badging')
        ? this.send('badging.set', { count: Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0 })
        : this.web.badging.set(count),
    clear: (): Promise<void> => (this.has('badging') ? this.send('badging.clear') : this.web.badging.clear()),
  };

  secureStorage = {
    get: async (key: string): Promise<string | null> => {
      if (!this.has('secureStorage')) return null;
      const result = await this.transport.call('secureStorage.get', { key });
      if (result !== null && typeof result !== 'string') throw unexpected('secureStorage.get', result);
      return result;
    },
    set: async (key: string, value: string): Promise<void> => {
      if (this.has('secureStorage')) await this.send('secureStorage.set', { key, value });
    },
    remove: async (key: string): Promise<void> => {
      if (this.has('secureStorage')) await this.send('secureStorage.remove', { key });
    },
  };

  canShare = async (p: SharePayload): Promise<boolean> => {
    if (!this.has('share')) return this.web.canShare(p);
    const result = await this.transport.call('canShare', { ...p });
    if (typeof result !== 'boolean') throw unexpected('canShare', result);
    return result;
  };

  share = (p: SharePayload): Promise<void> => (this.has('share') ? this.send('share', { ...p }) : this.web.share(p));

  requestReview = (): Promise<void> => (this.has('review') ? this.send('requestReview') : this.web.requestReview());
}
