/**
 * Tests for the shell bridge, against a fake shell.
 *
 * Run with: pnpm --filter @beatzball/litro-native test
 *
 * The fake installs exactly what the real shell installs: the marker global at
 * `window.__litroNative`, and a message handler at
 * `window.webkit.messageHandlers.litroNative`. It answers by calling
 * `receive` on the marker, the way `BridgeResponse.deliveryScript` does in
 * native/Sources/LitroBridge/Envelope.swift. Every message it is handed is run
 * through `isBridgeRequest` first, so the page can never emit a message the
 * protocol rejects without a test failing here.
 *
 * Each capability is tested on both paths: sent to a shell that has it, and
 * answered by the page for a shell that left it out.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ERROR_CODES,
  HANDSHAKE_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS,
  failure,
  isBridgeRequest,
  success,
  type BridgeRequest,
  type Method,
} from '../protocol.js';
import type { Capability } from '../types.js';
import type { NativeBridgeError } from '../errors.js';

/* ── The fake shell ───────────────────────────────────────────────────── */

type Answer = (req: BridgeRequest) => unknown | typeof SILENT;

/** Returned by a handler to mean "never reply". */
const SILENT = Symbol('silent');

interface FakeShellOptions {
  capabilities?: Capability[];
  markerVersion?: unknown;
  handshake?: Answer;
  /** Per-method answers. The default for a method with none is `result: null`. */
  answers?: Partial<Record<Method, Answer>>;
  /** Leave out the message handler, or the marker. */
  omit?: 'handler' | 'marker';
}

interface FakeShell {
  win: Record<string, unknown>;
  marker: { version?: unknown; receive?: (m: unknown) => void };
  /** Every message posted, in order. */
  sent: BridgeRequest[];
  /** Delivers a raw reply, as the shell's evaluated script would. */
  deliver(reply: unknown): void;
}

function fakeShell(options: FakeShellOptions = {}): FakeShell {
  const capabilities = options.capabilities ?? ['haptics', 'notifications', 'badging', 'secureStorage', 'share', 'review'];
  const marker: FakeShell['marker'] = { version: 'markerVersion' in options ? options.markerVersion : 1 };
  const sent: BridgeRequest[] = [];

  const deliver = (reply: unknown): void => {
    // The real delivery script is `window.__litroNative?.receive?.(...)`.
    marker.receive?.(reply);
  };

  const answer = (req: BridgeRequest): unknown => {
    if (req.method === 'handshake') {
      return options.handshake
        ? options.handshake(req)
        : success(req.id, { version: 1, os: 'ios', appVersion: '1.2.0', osVersion: '27.2', capabilities });
    }
    const handler = options.answers?.[req.method];
    return handler ? handler(req) : success(req.id, null);
  };

  const handler = {
    postMessage: (message: unknown): void => {
      if (!isBridgeRequest(message)) throw new Error(`the page sent an invalid request: ${JSON.stringify(message)}`);
      sent.push(message);
      const reply = answer(message);
      if (reply === SILENT) return;
      // Asynchronously, as a real reply is: the shell dispatches in a Task and
      // then evaluates script in the web view.
      setTimeout(() => deliver(reply), 0);
    },
  };

  const win: Record<string, unknown> = {};
  if (options.omit !== 'marker') win.__litroNative = marker;
  if (options.omit !== 'handler') win.webkit = { messageHandlers: { litroNative: handler } };
  return { win, marker, sent, deliver };
}

/** Installs a fake shell as the page's window, with an optional navigator. */
function installShell(options: FakeShellOptions = {}, navigatorProps: Record<string, unknown> = {}): FakeShell {
  const shell = fakeShell(options);
  vi.stubGlobal('window', shell.win);
  vi.stubGlobal('navigator', { userAgent: 'LitroShell', ...navigatorProps });
  return shell;
}

function fakeLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  return store;
}

async function load() {
  const bridge = await import('../bridge.js');
  const shell = await import('../adapters/shell.js');
  const index = await import('../index.js');
  shell.resetIdsForTests();
  return { ...bridge, ...shell, ...index };
}

const methods = (shell: FakeShell): string[] => shell.sent.map((m) => m.method);

/** Only the timer functions, so `setImmediate` still turns the real loop. */
const fakeTimers = (): void => void vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

/**
 * Waits on the real event loop until the page has posted `count` messages.
 * Bridge resolution starts with dynamic imports, so the handshake timer does
 * not exist yet when `getBridge()` returns; moving a fake clock before then
 * moves it past nothing.
 */
async function untilSent(shell: FakeShell, count = 1): Promise<void> {
  for (let i = 0; shell.sent.length < count; i++) {
    if (i > 1000) throw new Error(`only ${shell.sent.length} of ${count} messages were sent`);
    await new Promise((r) => setImmediate(r));
  }
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('window', undefined);
  vi.stubGlobal('navigator', undefined);
  vi.stubGlobal('localStorage', undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.doUnmock('../adapters/shell.js');
  vi.resetModules();
});

/* ── Server render and module scope ───────────────────────────────────── */

describe('server render', () => {
  it('resolves the web bridge and never loads the shell adapter', async () => {
    let loaded = false;
    vi.doMock('../adapters/shell.js', () => {
      loaded = true;
      return { connectShell: () => null };
    });
    const { getBridge } = await import('../bridge.js');
    expect((await getBridge()).id).toBe('web');
    expect(loaded).toBe(false);
  });

  it('evaluates the shell adapter without reading any global', async () => {
    // A module-scope probe would read one of these while the module is
    // evaluated. Each getter throws, so a probe fails this test loudly.
    const touched: string[] = [];
    for (const name of ['window', 'webkit', 'navigator', '__litroNative']) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        get() {
          touched.push(name);
          throw new Error(`${name} read at module scope`);
        },
      });
    }
    try {
      await import('../adapters/shell.js');
    } finally {
      for (const name of ['window', 'webkit', 'navigator', '__litroNative']) {
        delete (globalThis as Record<string, unknown>)[name];
      }
    }
    expect(touched).toEqual([]);
  });
});

/* ── Detection and the handshake ──────────────────────────────────────── */

describe('connecting', () => {
  it('connects to a shell and reports what the handshake said', async () => {
    installShell({ capabilities: ['haptics', 'badging'] });
    const { getBridge, platform } = await load();

    expect((await getBridge()).id).toBe('shell');
    expect(await platform()).toEqual({
      isNative: true,
      os: 'ios',
      appVersion: '1.2.0',
      osVersion: '27.2',
      bridgeVersion: 1,
      supports: ['haptics', 'badging'],
    });
  });

  it('sends the handshake first, and only once however many callers ask', async () => {
    const shell = installShell();
    const { getBridge } = await load();
    await Promise.all([getBridge(), getBridge(), getBridge()]);
    expect(methods(shell)).toEqual(['handshake']);
  });

  it('holds a call made before the handshake resolves, then sends it', async () => {
    let releaseHandshake: (() => void) | undefined;
    const shell = installShell({
      handshake: (req) => {
        releaseHandshake = () =>
          shell.deliver(success(req.id, { version: 1, os: 'ios', capabilities: ['haptics'] }));
        return SILENT;
      },
    });
    const { haptics } = await load();

    const call = haptics.impact('light');
    await vi.waitFor(() => expect(releaseHandshake).toBeDefined());
    // The handshake is out and unanswered. Nothing else may have been sent.
    expect(methods(shell)).toEqual(['handshake']);

    releaseHandshake!();
    await call;
    expect(methods(shell)).toEqual(['handshake', 'haptics.impact']);
    expect(shell.sent[1].params).toEqual({ style: 'light' });
  });

  it('accepts a shell newer than the page', async () => {
    installShell({
      markerVersion: 7,
      handshake: (req) => success(req.id, { version: 7, os: 'ios', capabilities: ['haptics'] }),
    });
    const { getBridge, platform } = await load();
    expect((await getBridge()).id).toBe('shell');
    expect((await platform()).bridgeVersion).toBe(7);
  });

  it('ignores a capability this page has never heard of, rather than dropping the shell', async () => {
    // Adding a capability does not bump the version, so a newer shell can
    // report one. The page must still use the shell for the ones it knows.
    installShell({
      handshake: (req) => success(req.id, { version: 1, os: 'ios', capabilities: ['haptics', 'camera'] }),
    });
    const { getBridge, platform } = await load();
    expect((await getBridge()).id).toBe('shell');
    expect((await platform()).supports).toEqual(['haptics']);
  });

  it.each([
    ['no message handler', { omit: 'handler' as const }],
    ['no marker', { omit: 'marker' as const }],
    ['a marker below the supported version', { markerVersion: 0 }],
    ['a marker with no version', { markerVersion: undefined }],
    ['a marker with a non-integer version', { markerVersion: 1.5 }],
  ])('falls back to the web bridge for %s, sending nothing', async (_label, options) => {
    const shell = installShell(options);
    const { getBridge } = await load();
    expect((await getBridge()).id).toBe('web');
    expect(shell.sent).toEqual([]);
  });

  it.each([
    ['an error', (req: BridgeRequest) => failure(req.id, ERROR_CODES.INTERNAL_ERROR, 'no')],
    ['a malformed result', (req: BridgeRequest) => success(req.id, { version: 1 })],
    ['a version below the floor', (req: BridgeRequest) => success(req.id, { version: 0, os: 'ios', capabilities: [] })],
    ['a reply carrying both result and error', (req: BridgeRequest) => ({
      jsonrpc: '2.0',
      id: req.id,
      result: null,
      error: { code: -32603, message: 'x' },
    })],
  ])('falls back to the web bridge when the handshake answers %s', async (_label, handshake) => {
    const shell = installShell({ handshake });
    const { getBridge } = await load();
    expect((await getBridge()).id).toBe('web');
    // And the transport stopped listening: a stray reply finds no receiver.
    expect(shell.marker.receive).toBeUndefined();
  });

  it('falls back to the web bridge when the handshake is never answered', async () => {
    fakeTimers();
    const shell = installShell({ handshake: () => SILENT });
    const { getBridge } = await load();
    const resolved = getBridge();
    await untilSent(shell);
    await vi.advanceTimersByTimeAsync(HANDSHAKE_TIMEOUT_MS);
    expect((await resolved).id).toBe('web');
  });

  it('still waits for a handshake answered just inside the budget', async () => {
    fakeTimers();
    const shell = installShell({
      handshake: (req) => {
        setTimeout(
          () => shell.deliver(success(req.id, { version: 1, os: 'ios', capabilities: [] })),
          HANDSHAKE_TIMEOUT_MS - 1,
        );
        return SILENT;
      },
    });
    const { getBridge } = await load();
    const resolved = getBridge();
    await untilSent(shell);
    await vi.advanceTimersByTimeAsync(HANDSHAKE_TIMEOUT_MS);
    expect((await resolved).id).toBe('shell');
  });
});

/* ── The transport ────────────────────────────────────────────────────── */

describe('the transport', () => {
  async function transport(options: FakeShellOptions = {}) {
    const shell = fakeShell(options);
    const mod = await load();
    const host = mod.findShellHost(shell.win)!;
    const t = new mod.ShellTransport(host);
    shell.marker.receive = (m) => t.receive(m);
    return { shell, t };
  }

  it('gives every call its own id, and matches replies that arrive out of order', async () => {
    const held: BridgeRequest[] = [];
    const { shell, t } = await transport({
      answers: {
        'secureStorage.get': (req) => {
          held.push(req);
          return SILENT;
        },
      },
    });
    const a = t.call('secureStorage.get', { key: 'a' });
    const b = t.call('secureStorage.get', { key: 'b' });
    expect(held.map((r) => r.id)).toEqual(['1', '2']);

    shell.deliver(success('2', 'B'));
    shell.deliver(success('1', 'A'));
    expect(await a).toBe('A');
    expect(await b).toBe('B');
    expect(t.pendingCount).toBe(0);
  });

  it('never reuses an id across transports in one page session', async () => {
    const mod = await load();
    const first = fakeShell({ answers: { 'haptics.selection': () => SILENT } });
    const second = fakeShell({ answers: { 'haptics.selection': () => SILENT } });
    void new mod.ShellTransport(mod.findShellHost(first.win)!).call('haptics.selection').catch(() => {});
    void new mod.ShellTransport(mod.findShellHost(second.win)!).call('haptics.selection').catch(() => {});
    expect([first.sent[0].id, second.sent[0].id]).toEqual(['1', '2']);
  });

  it('rejects with the shell error, code and data intact', async () => {
    const { t } = await transport({
      answers: {
        'notifications.schedule': (req) => failure(req.id, ERROR_CODES.PERMISSION_DENIED, 'denied', { why: 'user' }),
      },
    });
    const err = (await t.call('notifications.schedule', { title: 'x', at: 1 }).catch((e) => e)) as NativeBridgeError;
    expect(err.name).toBe('NativeBridgeError');
    expect(err.code).toBe(ERROR_CODES.PERMISSION_DENIED);
    expect(err.isPermissionDenied).toBe(true);
    expect(err.message).toBe('denied');
    expect(err.data).toEqual({ why: 'user' });
  });

  it('times out a call the shell never answers, and ignores a reply that comes after', async () => {
    fakeTimers();
    const { shell, t } = await transport({ answers: { 'haptics.selection': () => SILENT } });
    const call = t.call('haptics.selection');
    const settled = call.catch((e: NativeBridgeError) => e);

    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS - 1);
    expect(t.pendingCount).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    const err = (await settled) as NativeBridgeError;
    expect(err.code).toBe(ERROR_CODES.TIMEOUT);
    expect(err.isTimeout).toBe(true);
    expect(t.pendingCount).toBe(0);

    expect(() => shell.deliver(success(shell.sent[0].id, null))).not.toThrow();
  });

  it('fails a call at once when its reply is malformed but names it', async () => {
    // The page-side twin of NATIVE-003: read the id before judging the reply,
    // so a bad reply fails its call now instead of at the timeout.
    fakeTimers();
    const { t } = await transport({
      answers: { 'haptics.selection': (req) => ({ jsonrpc: '2.0', id: req.id }) },
    });
    const settled = t.call('haptics.selection').catch((e: NativeBridgeError) => e);
    await vi.advanceTimersByTimeAsync(1);
    const err = (await settled) as NativeBridgeError;
    expect(err.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    expect(t.pendingCount).toBe(0);
  });

  it('drops a reply with no id, or an id it is not waiting on', async () => {
    const { shell, t } = await transport({ answers: { 'haptics.selection': () => SILENT } });
    void t.call('haptics.selection').catch(() => {});
    for (const reply of [null, 'not json', { result: null }, success('999', null), 42]) {
      expect(() => shell.deliver(reply)).not.toThrow();
    }
    expect(t.pendingCount).toBe(1);
  });

  it('accepts a reply delivered as JSON text', async () => {
    const { shell, t } = await transport({ answers: { canShare: () => SILENT } });
    const call = t.call('canShare', {});
    shell.deliver(JSON.stringify(success(shell.sent[0].id, true)));
    expect(await call).toBe(true);
  });

  it('fails at once when the handler refuses the message', async () => {
    const shell = fakeShell();
    (shell.win.webkit as { messageHandlers: Record<string, unknown> }).messageHandlers.litroNative = {
      postMessage: () => {
        throw new Error('DataCloneError');
      },
    };
    const mod = await load();
    const t = new mod.ShellTransport(mod.findShellHost(shell.win)!);
    const err = (await t.call('haptics.selection').catch((e) => e)) as NativeBridgeError;
    expect(err.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    expect(t.pendingCount).toBe(0);
  });

  it('posts params as plain JSON, so one Date cannot cost the whole message', async () => {
    // The native side loses a message entirely, id and all, when any nested
    // value is not JSON. A Date is the easy way to send one by accident.
    const { shell, t } = await transport();
    await t.call('notifications.schedule', { title: 't', body: undefined, at: 5, when: new Date(0) }).catch(() => {});
    expect(shell.sent[0].params).toEqual({ title: 't', at: 5, when: '1970-01-01T00:00:00.000Z' });
  });

  it('rejects params that cannot be JSON without sending anything', async () => {
    const { shell, t } = await transport();
    const err = (await t.call('badging.set', { count: 1n }).catch((e) => e)) as NativeBridgeError;
    expect(err.code).toBe(ERROR_CODES.INVALID_PARAMS);
    expect(shell.sent).toEqual([]);
  });

  it('rejects every pending call when closed, and sends nothing after', async () => {
    const { shell, t } = await transport({ answers: { 'haptics.selection': () => SILENT } });
    const pending = t.call('haptics.selection').catch((e: NativeBridgeError) => e.code);
    t.close();
    expect(await pending).toBe(ERROR_CODES.INTERNAL_ERROR);
    expect(await t.call('haptics.selection').catch((e: NativeBridgeError) => e.code)).toBe(ERROR_CODES.INTERNAL_ERROR);
    expect(shell.sent).toHaveLength(1);
  });
});

/* ── Each capability, both paths ──────────────────────────────────────── */

describe('haptics', () => {
  it('native: sends each call with its params', async () => {
    const shell = installShell({ capabilities: ['haptics'] });
    const { haptics } = await load();
    await haptics.impact('rigid');
    await haptics.notify('warning');
    await haptics.selection();
    expect(shell.sent.slice(1).map(({ method, params }) => ({ method, params }))).toEqual([
      { method: 'haptics.impact', params: { style: 'rigid' } },
      { method: 'haptics.notify', params: { type: 'warning' } },
      { method: 'haptics.selection', params: undefined },
    ]);
  });

  it('fallback: takes the web behavior and sends nothing', async () => {
    const vibrate = vi.fn();
    const shell = installShell({ capabilities: [] }, { vibrate });
    const { haptics } = await load();
    await haptics.impact('heavy');
    expect(vibrate).toHaveBeenCalledWith(30);
    expect(methods(shell)).toEqual(['handshake']);
  });
});

describe('notifications', () => {
  it('native: schedules and returns the id the shell chose', async () => {
    const shell = installShell({
      capabilities: ['notifications'],
      answers: { 'notifications.schedule': (req) => success(req.id, 'n-1') },
    });
    const { notifications } = await load();
    expect(await notifications.schedule({ title: 'Hi', at: 10, repeat: 'daily' })).toBe('n-1');
    await notifications.cancel('n-1');
    expect(shell.sent.slice(1).map(({ method, params }) => ({ method, params }))).toEqual([
      { method: 'notifications.schedule', params: { title: 'Hi', at: 10, repeat: 'daily' } },
      { method: 'notifications.cancel', params: { id: 'n-1' } },
    ]);
  });

  it('native: a declined permission rejects, and says so', async () => {
    installShell({
      capabilities: ['notifications'],
      answers: { 'notifications.schedule': (req) => failure(req.id, ERROR_CODES.PERMISSION_DENIED, 'denied') },
    });
    const { notifications } = await load();
    const err = (await notifications.schedule({ title: 'Hi', at: 10 }).catch((e) => e)) as NativeBridgeError;
    expect(err.isPermissionDenied).toBe(true);
  });

  it('native: rejects a result that is not a string', async () => {
    installShell({
      capabilities: ['notifications'],
      answers: { 'notifications.schedule': (req) => success(req.id, 7) },
    });
    const { notifications } = await load();
    const err = (await notifications.schedule({ title: 'Hi', at: 10 }).catch((e) => e)) as NativeBridgeError;
    expect(err.code).toBe(ERROR_CODES.INTERNAL_ERROR);
  });

  it('fallback: schedules nothing and returns an empty id', async () => {
    const shell = installShell({ capabilities: [] });
    const { notifications } = await load();
    expect(await notifications.schedule({ title: 'Hi', at: 10 })).toBe('');
    await notifications.cancel('x');
    expect(methods(shell)).toEqual(['handshake']);
  });
});

describe('badging', () => {
  it('native: sends set and clear', async () => {
    const shell = installShell({ capabilities: ['badging'] });
    const { badging } = await load();
    await badging.set(3);
    await badging.clear();
    expect(shell.sent.slice(1).map(({ method, params }) => ({ method, params }))).toEqual([
      { method: 'badging.set', params: { count: 3 } },
      { method: 'badging.clear', params: undefined },
    ]);
  });

  it('fallback: uses the web badge and sends nothing', async () => {
    const setAppBadge = vi.fn();
    const shell = installShell({ capabilities: [] }, { setAppBadge });
    const { badging } = await load();
    await badging.set(2);
    expect(setAppBadge).toHaveBeenCalledWith(2);
    expect(methods(shell)).toEqual(['handshake']);
  });
});

describe('secureStorage', () => {
  it('native: gets, sets and removes through the shell, never browser storage', async () => {
    const store = fakeLocalStorage();
    const shell = installShell({
      capabilities: ['secureStorage'],
      answers: { 'secureStorage.get': (req) => success(req.id, 'secret') },
    });
    const { secureStorage } = await load();
    await secureStorage.set('token', 'abc');
    expect(await secureStorage.get('token')).toBe('secret');
    await secureStorage.remove('token');
    expect(shell.sent.slice(1).map(({ method, params }) => ({ method, params }))).toEqual([
      { method: 'secureStorage.set', params: { key: 'token', value: 'abc' } },
      { method: 'secureStorage.get', params: { key: 'token' } },
      { method: 'secureStorage.remove', params: { key: 'token' } },
    ]);
    expect(store.size).toBe(0);
  });

  it('native: answers null for a missing key', async () => {
    installShell({ capabilities: ['secureStorage'], answers: { 'secureStorage.get': (req) => success(req.id, null) } });
    const { secureStorage } = await load();
    expect(await secureStorage.get('nope')).toBeNull();
  });

  it('fallback: never writes to browser storage inside a shell', async () => {
    // isNative is true here, and checking isNative is the documented way to
    // keep a token out of browser storage. A fallback to it would defeat that.
    const store = fakeLocalStorage();
    // A value the web adapter would find, under the key it would use. Neither
    // a read nor a remove may reach it from inside a shell.
    store.set('litro-native:old', 'leaked');
    const shell = installShell({ capabilities: [] });
    const { secureStorage, platform } = await load();
    await secureStorage.set('token', 'abc');
    expect(await secureStorage.get('token')).toBeNull();
    expect(await secureStorage.get('old')).toBeNull();
    await secureStorage.remove('old');
    expect([...store]).toEqual([['litro-native:old', 'leaked']]);
    expect(methods(shell)).toEqual(['handshake']);

    const info = await platform();
    expect(info.isNative).toBe(true);
    expect(info.supports).not.toContain('secureStorage');
  });
});

describe('share', () => {
  it('native: asks canShare and shares through the shell', async () => {
    const shell = installShell({
      capabilities: ['share'],
      answers: { canShare: (req) => success(req.id, true) },
    });
    const { canShare, share } = await load();
    expect(await canShare({ url: 'https://example.com/' })).toBe(true);
    await share({ title: 'T', url: 'https://example.com/' });
    expect(shell.sent.slice(1).map(({ method, params }) => ({ method, params }))).toEqual([
      { method: 'canShare', params: { url: 'https://example.com/' } },
      { method: 'share', params: { title: 'T', url: 'https://example.com/' } },
    ]);
  });

  it('fallback: uses the web share sheet when the web view has one, and sends nothing', async () => {
    const webShare = vi.fn(async () => {});
    const shell = installShell({ capabilities: [] }, { share: webShare });
    const { canShare, share, platform } = await load();
    expect(await canShare({ text: 'x' })).toBe(true);
    await share({ text: 'x' });
    expect(webShare).toHaveBeenCalledWith({ text: 'x' });
    expect(methods(shell)).toEqual(['handshake']);
    expect((await platform()).supports).toEqual(['share']);
  });

  it('fallback: reports false and does nothing with no share sheet at all', async () => {
    installShell({ capabilities: [] });
    const { canShare, share } = await load();
    expect(await canShare({ text: 'x' })).toBe(false);
    await expect(share({ text: 'x' })).resolves.toBeUndefined();
  });
});

describe('review', () => {
  it('native: sends requestReview', async () => {
    const shell = installShell({ capabilities: ['review'] });
    const { requestReview } = await load();
    await requestReview();
    expect(methods(shell)).toEqual(['handshake', 'requestReview']);
  });

  it('fallback: resolves and sends nothing', async () => {
    const shell = installShell({ capabilities: [] });
    const { requestReview } = await load();
    await expect(requestReview()).resolves.toBeUndefined();
    expect(methods(shell)).toEqual(['handshake']);
  });
});

describe('per-capability degradation', () => {
  it('a shell missing one capability degrades that one and keeps the rest native', async () => {
    const vibrate = vi.fn();
    const shell = installShell({ capabilities: ['badging'] }, { vibrate });
    const { haptics, badging } = await load();
    await haptics.selection();
    await badging.set(1);
    expect(vibrate).toHaveBeenCalledWith(4);
    expect(methods(shell)).toEqual(['handshake', 'badging.set']);
  });
});
