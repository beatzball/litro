/**
 * Unit tests for the web bridge and the capability facades.
 *
 * Run with: pnpm --filter @beatzball/litro-native test
 *
 * The environment is plain Node, with no DOM. That is deliberate: it is what a
 * server render looks like, so the default state of every test is the hardest
 * one. A test that needs a browser API installs it and removes it again.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBridge, resetBridgeForTests } from '../bridge.js';
import { WebBridge } from '../adapters/web.js';
import { haptics } from '../haptics.js';
import { notifications } from '../notifications.js';
import { badging } from '../badging.js';
import { secureStorage } from '../storage.js';
import { canShare, share } from '../share.js';
import { requestReview } from '../review.js';
import { platform, supports } from '../platform.js';
import type { HapticStyle } from '../types.js';

// ---------------------------------------------------------------------------
// Fakes for the browser APIs the adapter reaches for
// ---------------------------------------------------------------------------

type Glob = Record<string, unknown>;
const g = globalThis as Glob;

/** Every global this suite installs, so each test can be torn down completely. */
const INSTALLED = ['window', 'navigator', 'localStorage'] as const;

function clearGlobals(): void {
  for (const key of INSTALLED) delete g[key];
}

function setNavigator(props: Record<string, unknown>): void {
  g.navigator = props;
}

/** A standing-in `localStorage`, backed by a plain map. */
function fakeStorage(): { store: Map<string, string>; api: Glob } {
  const store = new Map<string, string>();
  const api: Glob = {
    getItem: (k: string) => (store.has(k) ? store.get(k) : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  return { store, api };
}

beforeEach(() => {
  clearGlobals();
  resetBridgeForTests();
});

afterEach(() => {
  clearGlobals();
  resetBridgeForTests();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// The server render path
// ---------------------------------------------------------------------------

describe('resolution during a server render', () => {
  it('resolves the web bridge with no browser globals present', async () => {
    expect(typeof g.window).toBe('undefined');
    const bridge = await getBridge();
    expect(bridge.id).toBe('web');
  });

  it('reports a non-native platform and no capabilities', async () => {
    const info = await platform();
    expect(info.isNative).toBe(false);
    expect(info.os).toBe('web');
    expect(info.supports).toEqual([]);
    expect(info.bridgeVersion).toBeUndefined();
  });

  it('lets every capability be called without throwing', async () => {
    await expect(haptics.impact('light')).resolves.toBeUndefined();
    await expect(haptics.notify('success')).resolves.toBeUndefined();
    await expect(haptics.selection()).resolves.toBeUndefined();
    await expect(badging.set(3)).resolves.toBeUndefined();
    await expect(badging.clear()).resolves.toBeUndefined();
    await expect(share({ title: 'x' })).resolves.toBeUndefined();
    await expect(requestReview()).resolves.toBeUndefined();
    await expect(notifications.cancel('x')).resolves.toBeUndefined();
    await expect(secureStorage.set('k', 'v')).resolves.toBeUndefined();
    await expect(secureStorage.get('k')).resolves.toBeNull();
    await expect(secureStorage.remove('k')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// The cache
// ---------------------------------------------------------------------------

describe('getBridge', () => {
  it('returns the same instance every time', async () => {
    const [a, b] = await Promise.all([getBridge(), getBridge()]);
    expect(a).toBe(b);
    expect(await getBridge()).toBe(a);
  });

  it('caches the promise, so concurrent callers share one resolution', () => {
    const first = getBridge();
    const second = getBridge();
    expect(first).toBe(second);
  });

  it('does not keep a failed resolution, so a flaky load is not permanent', async () => {
    // The adapter arrives as its own chunk over the network. Caching a rejected
    // promise would turn one bad load into every later call rejecting for the
    // life of the page, with no retry. This mirrors the pattern in bridge.ts.
    let attempts = 0;
    let cached: Promise<unknown> | null = null;
    async function flaky(): Promise<string> {
      attempts += 1;
      if (attempts === 1) throw new Error('chunk load failed');
      return 'bridge';
    }
    function get(): Promise<unknown> {
      if (cached === null) {
        cached = flaky();
        cached.catch(() => {
          cached = null;
        });
      }
      return cached;
    }
    await expect(get()).rejects.toThrow('chunk load failed');
    await expect(get()).resolves.toBe('bridge');
    expect(attempts).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Haptics
// ---------------------------------------------------------------------------

describe('haptics on the web', () => {
  const STYLES: HapticStyle[] = ['light', 'soft', 'medium', 'rigid', 'heavy'];

  it('calls the Vibration API once per impact, for every style', async () => {
    const vibrate = vi.fn();
    setNavigator({ vibrate, userAgent: '' });
    for (const style of STYLES) await haptics.impact(style);
    expect(vibrate).toHaveBeenCalledTimes(STYLES.length);
    for (const call of vibrate.mock.calls) {
      expect(typeof call[0]).toBe('number');
      expect(call[0]).toBeGreaterThan(0);
    }
  });

  it('gives a heavier impact a longer vibration than a lighter one', async () => {
    const vibrate = vi.fn();
    setNavigator({ vibrate, userAgent: '' });
    await haptics.impact('light');
    await haptics.impact('heavy');
    const [light] = vibrate.mock.calls[0] as [number];
    const [heavy] = vibrate.mock.calls[1] as [number];
    expect(heavy).toBeGreaterThan(light);
  });

  it('gives each notify type a distinguishable pattern', async () => {
    const vibrate = vi.fn();
    setNavigator({ vibrate, userAgent: '' });
    await haptics.notify('success');
    await haptics.notify('warning');
    await haptics.notify('error');
    const patterns = vibrate.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(new Set(patterns).size).toBe(3);
  });

  it('is silent, and does not throw, when the API is missing', async () => {
    setNavigator({ userAgent: '' });
    await expect(haptics.impact('medium')).resolves.toBeUndefined();
    await expect(haptics.selection()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Badging
// ---------------------------------------------------------------------------

describe('badging on the web', () => {
  it('passes the count to the Badging API', async () => {
    const setAppBadge = vi.fn(async () => {});
    setNavigator({ setAppBadge, userAgent: '' });
    await badging.set(7);
    expect(setAppBadge).toHaveBeenCalledWith(7);
  });

  it('clears through the API own clear, not through set(0)', async () => {
    const setAppBadge = vi.fn(async () => {});
    const clearAppBadge = vi.fn(async () => {});
    setNavigator({ setAppBadge, clearAppBadge, userAgent: '' });
    await badging.clear();
    expect(clearAppBadge).toHaveBeenCalledTimes(1);
    expect(setAppBadge).not.toHaveBeenCalled();
  });

  it('resolves silently when the API is missing', async () => {
    setNavigator({ userAgent: '' });
    await expect(badging.set(1)).resolves.toBeUndefined();
    await expect(badging.clear()).resolves.toBeUndefined();
  });

  it('floors and clamps the count, because the platform API rejects anything else', async () => {
    // The real API takes an unsigned integer and throws otherwise. Unread
    // counts come from arithmetic that can land on -1 or 2.5 for one tick.
    const setAppBadge = vi.fn(async () => {});
    setNavigator({ setAppBadge, userAgent: '' });
    await badging.set(-1);
    await badging.set(2.7);
    await badging.set(Number.NaN);
    expect(setAppBadge.mock.calls.map((c) => c[0])).toEqual([0, 2, 0]);
  });
});

// ---------------------------------------------------------------------------
// Local notifications
// ---------------------------------------------------------------------------

describe('local notifications on the web', () => {
  it('schedules nothing and returns an empty id', async () => {
    setNavigator({ userAgent: '' });
    const id = await notifications.schedule({ title: 'Daily puzzle', at: Date.now() + 1000 });
    expect(id).toBe('');
  });

  it('cancels without throwing, including for an empty id', async () => {
    setNavigator({ userAgent: '' });
    await expect(notifications.cancel('')).resolves.toBeUndefined();
    await expect(notifications.cancel('anything')).resolves.toBeUndefined();
  });

  it('is never reported as supported, however capable the browser is', async () => {
    setNavigator({
      vibrate: vi.fn(),
      setAppBadge: vi.fn(),
      share: vi.fn(),
      userAgent: '',
    });
    g.localStorage = fakeStorage().api;
    await expect(supports('notifications')).resolves.toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Secure storage
// ---------------------------------------------------------------------------

describe('secure storage on the web', () => {
  it('round-trips a value and removes it', async () => {
    g.localStorage = fakeStorage().api;
    setNavigator({ userAgent: '' });
    expect(await secureStorage.get('token')).toBeNull();
    await secureStorage.set('token', 'abc');
    expect(await secureStorage.get('token')).toBe('abc');
    await secureStorage.remove('token');
    expect(await secureStorage.get('token')).toBeNull();
  });

  it('namespaces its keys, so an app key of the same name is a different slot', async () => {
    const { store, api } = fakeStorage();
    g.localStorage = api;
    setNavigator({ userAgent: '' });
    store.set('token', 'the app own value');
    await secureStorage.set('token', 'ours');
    expect(await secureStorage.get('token')).toBe('ours');
    expect(store.get('token')).toBe('the app own value');
    expect(store.size).toBe(2);
  });

  it('treats blocked site data as no storage at all, not as an error', async () => {
    Object.defineProperty(g, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('site data blocked');
      },
    });
    setNavigator({ userAgent: '' });
    // There is no storage here, so this is a missing platform feature and
    // every call is a silent no-op, matching every other capability.
    await expect(secureStorage.get('k')).resolves.toBeNull();
    await expect(secureStorage.set('k', 'v')).resolves.toBeUndefined();
    await expect(secureStorage.remove('k')).resolves.toBeUndefined();
    await expect(supports('secureStorage')).resolves.toBe(false);
  });

  it('reports a failed write instead of looking like it worked', async () => {
    // A store that exists and then refuses the write is a real failure, not a
    // missing feature. Swallowing it would leave a caller believing it had
    // persisted a token it had not, with the previous value still in place.
    g.localStorage = {
      getItem: (k: string) => (k === 'litro-native:token' ? 'stale' : null),
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    setNavigator({ userAgent: '' });
    await expect(supports('secureStorage')).resolves.toBe(true);
    await expect(secureStorage.set('token', 'fresh')).rejects.toThrow('QuotaExceededError');
    await expect(secureStorage.remove('token')).rejects.toThrow('QuotaExceededError');
    expect(await secureStorage.get('token')).toBe('stale');
  });
});

// ---------------------------------------------------------------------------
// Share
// ---------------------------------------------------------------------------

describe('share on the web', () => {
  it('passes the payload to the platform share sheet', async () => {
    const shareFn = vi.fn(async () => {});
    setNavigator({ share: shareFn, userAgent: '' });
    const payload = { title: 'Qdoku', text: 'Level 12', url: 'https://example.test/' };
    await share(payload);
    expect(shareFn).toHaveBeenCalledWith(payload);
  });

  it('does not reject when the user dismisses the sheet', async () => {
    const abort = Object.assign(new Error('dismissed'), { name: 'AbortError' });
    setNavigator({
      share: vi.fn(async () => {
        throw abort;
      }),
      userAgent: '',
    });
    await expect(share({ title: 'x' })).resolves.toBeUndefined();
  });

  it('passes on a real failure', async () => {
    setNavigator({
      share: vi.fn(async () => {
        throw new Error('NotAllowedError');
      }),
      userAgent: '',
    });
    await expect(share({ title: 'x' })).rejects.toThrow('NotAllowedError');
  });

  it('resolves silently when there is no share sheet', async () => {
    setNavigator({ userAgent: '' });
    await expect(share({ title: 'x' })).resolves.toBeUndefined();
  });

  it('answers canShare through the bridge, so it cannot disagree with share', async () => {
    setNavigator({ share: vi.fn(async () => {}), canShare: () => false, userAgent: '' });
    await expect(canShare({ title: 'x' })).resolves.toBe(false);
  });

  it('treats a browser with share but no canShare as able to share', async () => {
    setNavigator({ share: vi.fn(async () => {}), userAgent: '' });
    await expect(canShare({ title: 'x' })).resolves.toBe(true);
  });

  it('cannot share where there is no share sheet at all', async () => {
    setNavigator({ userAgent: '' });
    await expect(canShare({ title: 'x' })).resolves.toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

describe('review request on the web', () => {
  it('resolves and does nothing', async () => {
    setNavigator({ userAgent: '' });
    await expect(requestReview()).resolves.toBeUndefined();
    await expect(supports('review')).resolves.toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Platform detection and the capability list
// ---------------------------------------------------------------------------

describe('platform detection', () => {
  it('reads an Android user agent as android', async () => {
    setNavigator({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36' });
    const info = await platform();
    expect(info.os).toBe('android');
    expect(info.isNative).toBe(false);
  });

  it('reads an iPhone Safari user agent as web, never as ios', async () => {
    setNavigator({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const info = await platform();
    // `os: 'ios'` means the native host, not a browser on an iPhone. A page in
    // iOS Safari has none of the native capabilities, so calling it ios would
    // make the field a lie.
    expect(info.os).toBe('web');
    expect(info.isNative).toBe(false);
  });

  it('reads an unknown user agent as web', async () => {
    setNavigator({ userAgent: 'something else entirely' });
    expect((await platform()).os).toBe('web');
  });

  it('lists only the capabilities the browser actually provides', async () => {
    setNavigator({ vibrate: vi.fn(), share: vi.fn(), userAgent: '' });
    const info = await platform();
    expect([...info.supports].sort()).toEqual(['haptics', 'share']);
    await expect(supports('haptics')).resolves.toBe(true);
    await expect(supports('badging')).resolves.toBe(false);
    await expect(supports('secureStorage')).resolves.toBe(false);
  });

  it('includes secure storage only when storage can be reached', async () => {
    g.localStorage = fakeStorage().api;
    setNavigator({ userAgent: '' });
    await expect(supports('secureStorage')).resolves.toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The adapter in isolation
// ---------------------------------------------------------------------------

describe('WebBridge', () => {
  it('identifies itself as the web bridge', () => {
    expect(new WebBridge().id).toBe('web');
  });
});
