/**
 * Contract tests for the public surface of this package.
 *
 * These were written from the design spec alone, against the published exports,
 * with no sight of the implementation, so they catch a surface that drifts from
 * what the spec promises. They load the package through dynamic imports with the
 * browser globals stubbed, which also proves a bare import is safe where no DOM
 * exists.
 *
 * `web-bridge.test.ts` beside this file covers the adapter at unit level. Keep
 * both: they test different layers, and this one must keep importing only what
 * an app can import.
 *
 * Run with: pnpm --filter @beatzball/litro-native test
 */

// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  HapticNotify,
  HapticStyle,
  LocalNotification,
  NativeBridge,
  OS,
  PlatformInfo,
  SharePayload,
} from '../index.js';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function installBrowser(
  capabilities: Record<string, unknown> = {},
  userAgent = 'UnknownBrowser/1.0',
) {
  const storage = new MemoryStorage();
  const navigator = { userAgent, ...capabilities };
  const document = {};
  const open = vi.fn();
  const window = { navigator, localStorage: storage, document, open };

  vi.stubGlobal('window', window);
  vi.stubGlobal('document', document);
  vi.stubGlobal('navigator', navigator);
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('open', open);

  return { storage, navigator, window, open };
}

const impactStyles: readonly HapticStyle[] = [
  'light',
  'medium',
  'heavy',
  'soft',
  'rigid',
];

const notificationTypes: readonly HapticNotify[] = [
  'success',
  'warning',
  'error',
];

beforeEach((): void => {
  vi.resetModules();
  vi.stubGlobal('window', undefined);
  vi.stubGlobal('document', undefined);
  vi.stubGlobal('navigator', undefined);
  vi.stubGlobal('localStorage', undefined);
  vi.stubGlobal('Notification', undefined);
});

afterEach((): void => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('package surface and bridge resolution', (): void => {
  it('imports without browser globals', async (): Promise<void> => {
    await expect(import('../index.js')).resolves.toBeDefined();
  });

  it('resolves the web bridge during server rendering', async (): Promise<void> => {
    const { getBridge, platform } = await import('../index.js');

    const bridge: NativeBridge = await getBridge();
    const info: PlatformInfo = await platform();

    expect(bridge.id).toBe('web');
    expect(info.isNative).toBe(false);
    expect((await bridge.platform()).isNative).toBe(false);
    expect(info.bridgeVersion).toBeUndefined();
  });

  it('resolves the web bridge in a browser without a shell', async (): Promise<void> => {
    installBrowser();

    const { getBridge } = await import('../index.js');

    expect((await getBridge()).id).toBe('web');
  });

  it('caches one resolution promise and one bridge instance', async (): Promise<void> => {
    installBrowser();

    const { getBridge } = await import('../index.js');
    const first: Promise<NativeBridge> = getBridge();
    const second: Promise<NativeBridge> = getBridge();

    // The spec explicitly caches the promise, making shared resolution observable.
    expect(second).toBe(first);

    const [firstBridge, secondBridge] = await Promise.all([first, second]);
    expect(secondBridge).toBe(firstBridge);

    const subsequent: Promise<NativeBridge> = getBridge();
    expect(subsequent).toBe(first);
    expect(await subsequent).toBe(firstBridge);
  });

  it('re-exports each capability from its subpath module', async (): Promise<void> => {
    const [
      root,
      hapticsModule,
      notificationsModule,
      badgingModule,
      storageModule,
      shareModule,
      reviewModule,
    ] = await Promise.all([
      import('../index.js'),
      import('../haptics.js'),
      import('../notifications.js'),
      import('../badging.js'),
      import('../storage.js'),
      import('../share.js'),
      import('../review.js'),
    ]);

    expect(root.haptics).toBeDefined();
    expect(root.notifications).toBeDefined();
    expect(root.badging).toBeDefined();
    expect(root.secureStorage).toBeDefined();
    expect(root.share).toBeTypeOf('function');
    // A capability with several actions is a namespace; a capability that is one
    // action is a function. So there is no `review` object, and `requestReview`
    // is the whole surface. The spec now states this rule.
    expect(root.requestReview).toBeTypeOf('function');
    expect(root.platform).toBeTypeOf('function');
    expect(root.getBridge).toBeTypeOf('function');

    expect(root.haptics).toBe(hapticsModule.haptics);
    expect(root.notifications).toBe(notificationsModule.notifications);
    expect(root.badging).toBe(badgingModule.badging);
    expect(root.secureStorage).toBe(storageModule.secureStorage);
    expect(root.share).toBe(shareModule.share);
    expect(root.requestReview).toBe(reviewModule.requestReview);
  });
});

describe.each([true, false])(
  'web haptics with Vibration API present: %s',
  (available: boolean): void => {
    const vibrate = vi.fn((_pattern: number | number[]): boolean => true);

    beforeEach((): void => {
      vibrate.mockClear();
      installBrowser(available ? { vibrate } : {});
    });

    it.each(impactStyles)(
      'resolves impact(%s) and vibrates when available',
      async (style: HapticStyle): Promise<void> => {
        const { haptics } = await import('../index.js');

        await expect(haptics.impact(style)).resolves.toBeUndefined();

        // Patterns are unspecified; the contract requires use of the available API.
        if (available) {
          expect(vibrate).toHaveBeenCalled();
        } else {
          expect(vibrate).not.toHaveBeenCalled();
        }
      },
    );

    it.each(notificationTypes)(
      'resolves notify(%s) and vibrates when available',
      async (type: HapticNotify): Promise<void> => {
        const { haptics } = await import('../index.js');

        await expect(haptics.notify(type)).resolves.toBeUndefined();

        if (available) {
          expect(vibrate).toHaveBeenCalled();
        } else {
          expect(vibrate).not.toHaveBeenCalled();
        }
      },
    );

    it('resolves selection and vibrates when available', async (): Promise<void> => {
      const { haptics } = await import('../index.js');

      await expect(haptics.selection()).resolves.toBeUndefined();

      if (available) {
        expect(vibrate).toHaveBeenCalled();
      } else {
        expect(vibrate).not.toHaveBeenCalled();
      }
    });
  },
);

describe('web badging', (): void => {
  it('passes the count to the Web Badging API', async (): Promise<void> => {
    const setAppBadge = vi.fn(async (_count: number): Promise<void> => {});
    installBrowser({ setAppBadge });

    const { badging } = await import('../index.js');

    await expect(badging.set(7)).resolves.toBeUndefined();
    expect(setAppBadge).toHaveBeenCalledTimes(1);
    expect(setAppBadge).toHaveBeenCalledWith(7);
  });

  it('clears through the dedicated API, separately from set(0)', async (): Promise<void> => {
    const setAppBadge = vi.fn(async (_count: number): Promise<void> => {});
    const clearAppBadge = vi.fn(async (): Promise<void> => {});
    installBrowser({ setAppBadge, clearAppBadge });

    const { badging } = await import('../index.js');

    await expect(badging.set(0)).resolves.toBeUndefined();
    expect(setAppBadge).toHaveBeenCalledWith(0);
    expect(clearAppBadge).not.toHaveBeenCalled();

    setAppBadge.mockClear();

    await expect(badging.clear()).resolves.toBeUndefined();
    expect(clearAppBadge).toHaveBeenCalledTimes(1);
    expect(clearAppBadge).toHaveBeenCalledWith();
    expect(setAppBadge).not.toHaveBeenCalled();
  });

  it('resolves set when the API is absent', async (): Promise<void> => {
    installBrowser();

    const { badging } = await import('../index.js');

    await expect(badging.set(7)).resolves.toBeUndefined();
  });

  it('resolves clear when the API is absent', async (): Promise<void> => {
    installBrowser();

    const { badging } = await import('../index.js');

    await expect(badging.clear()).resolves.toBeUndefined();
  });
});

describe('web local notifications', (): void => {
  it.each([undefined, 'daily-reminder'])(
    'does not schedule a notification with supplied id %s',
    async (id: string | undefined): Promise<void> => {
      installBrowser();
      vi.useFakeTimers();

      const notificationConstructor = vi.fn();
      vi.stubGlobal('Notification', notificationConstructor);

      const { notifications } = await import('../index.js');
      const notification: LocalNotification = {
        title: 'Reminder',
        body: 'Check the app.',
        at: Date.now() + 60_000,
        repeat: 'daily',
        ...(id === undefined ? {} : { id }),
      };

      // No return value is specified; an empty ID avoids claiming a real schedule exists.
      await expect(notifications.schedule(notification)).resolves.toBe('');

      expect(notificationConstructor).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('resolves cancel for an arbitrary identifier', async (): Promise<void> => {
    installBrowser();

    const { notifications } = await import('../index.js');

    await expect(
      notifications.cancel('never-scheduled'),
    ).resolves.toBeUndefined();
  });
});

describe('web secure storage', (): void => {
  it('round-trips a value', async (): Promise<void> => {
    installBrowser();

    const { secureStorage } = await import('../index.js');

    await expect(
      secureStorage.set('session-token', 'token-value'),
    ).resolves.toBeUndefined();
    await expect(
      secureStorage.get('session-token'),
    ).resolves.toBe('token-value');
  });

  it('returns null for a missing key', async (): Promise<void> => {
    installBrowser();

    const { secureStorage } = await import('../index.js');

    await expect(secureStorage.get('missing')).resolves.toBeNull();
  });

  it('removes a stored key', async (): Promise<void> => {
    installBrowser();

    const { secureStorage } = await import('../index.js');

    await secureStorage.set('session-token', 'token-value');
    await expect(
      secureStorage.remove('session-token'),
    ).resolves.toBeUndefined();
    await expect(secureStorage.get('session-token')).resolves.toBeNull();
  });

  it('isolates its keys from raw application storage keys', async (): Promise<void> => {
    const { storage } = installBrowser();
    storage.setItem('session-token', 'app-owned-value');

    const { secureStorage } = await import('../index.js');

    // Use local storage for the web fallback; the namespace spelling remains unspecified.
    await expect(secureStorage.get('session-token')).resolves.toBeNull();

    await secureStorage.set('session-token', 'bridge-owned-value');

    expect(storage.getItem('session-token')).toBe('app-owned-value');
    await expect(
      secureStorage.get('session-token'),
    ).resolves.toBe('bridge-owned-value');

    await secureStorage.remove('session-token');

    expect(storage.getItem('session-token')).toBe('app-owned-value');
    await expect(secureStorage.get('session-token')).resolves.toBeNull();
  });
});

describe('web sharing', (): void => {
  it('passes the payload to the platform share sheet', async (): Promise<void> => {
    const platformShare = vi.fn(async (_payload: SharePayload): Promise<void> => {});
    installBrowser({ share: platformShare });

    const { share } = await import('../index.js');
    const payload: SharePayload = {
      title: 'An article',
      text: 'Read this article.',
      url: 'https://example.test/article',
    };

    await expect(share(payload)).resolves.toBeUndefined();

    expect(platformShare).toHaveBeenCalledTimes(1);
    expect(platformShare).toHaveBeenCalledWith(payload);
  });

  it('resolves when the platform share sheet is absent', async (): Promise<void> => {
    installBrowser();

    const { share } = await import('../index.js');

    // Absent sharing degrades silently so callers need no environment branch.
    await expect(share({ text: 'Hello' })).resolves.toBeUndefined();
  });

  it('resolves when the user dismisses the platform share sheet', async (): Promise<void> => {
    const platformShare = vi.fn(async (): Promise<void> => {
      throw new DOMException('The share sheet was dismissed.', 'AbortError');
    });
    installBrowser({ share: platformShare });

    const { share } = await import('../index.js');

    // Dismissal is an ordinary user choice, so it follows the harmless fallback behavior.
    await expect(share({ text: 'Hello' })).resolves.toBeUndefined();
    expect(platformShare).toHaveBeenCalledTimes(1);
  });
});

describe('web review', (): void => {
  it('resolves without opening a page or making a request', async (): Promise<void> => {
    const { storage, open } = installBrowser();
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    const { getBridge } = await import('../index.js');
    const bridge: NativeBridge = await getBridge();

    // The review facade's call shape is unspecified; requestReview is explicitly defined.
    await expect(bridge.requestReview()).resolves.toBeUndefined();

    expect(open).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(storage.length).toBe(0);
  });
});

describe('web platform information', (): void => {
  const cases: ReadonlyArray<{ userAgent: string; os: OS }> = [
    { userAgent: 'MobileDevice (Linux; Android 15)', os: 'android' },
    { userAgent: 'UnknownBrowser/1.0', os: 'web' },
  ];

  it.each(cases)(
    'reports $os for $userAgent without claiming native execution',
    async ({ userAgent, os }): Promise<void> => {
      installBrowser({}, userAgent);

      const { platform } = await import('../index.js');
      const info: PlatformInfo = await platform();

      expect(info.os).toBe(os);
      expect(info.isNative).toBe(false);
      expect(info.bridgeVersion).toBeUndefined();
    },
  );

  it('advertises only the capabilities that do something in this browser', async (): Promise<void> => {
    // `supports` answers "will this call have an effect", not "is this call
    // safe". Every capability is always safe to call. A bare browser with no
    // vibration, no badge and no share sheet can still reach storage, so that
    // is the only entry. The spec now states this; it previously read as though
    // a defined no-op counted as support.
    installBrowser();

    const { platform } = await import('../index.js');
    const info: PlatformInfo = await platform();

    expect(Array.isArray(info.supports)).toBe(true);
    expect([...info.supports].sort()).toEqual(['secureStorage']);
  });

  it('never advertises a capability the web cannot provide at all', async (): Promise<void> => {
    installBrowser({ vibrate: () => true, setAppBadge: async () => {}, share: async () => {} });

    const { platform } = await import('../index.js');
    const info: PlatformInfo = await platform();

    expect([...info.supports].sort()).toEqual([
      'badging',
      'haptics',
      'secureStorage',
      'share',
    ]);
    expect(info.supports).not.toContain('notifications');
    expect(info.supports).not.toContain('review');
  });
});
