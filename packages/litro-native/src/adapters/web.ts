/**
 * The web bridge: what every capability does when there is no native host.
 *
 * Two rules hold throughout.
 *
 * First, honesty. A capability the browser cannot provide does nothing and says
 * so through {@link PlatformInfo.supports}, rather than resolving in a way that
 * looks like success. Local notifications are the clearest case: browsers have
 * no local scheduler, so `schedule` returns an empty id.
 *
 * Second, this adapter must also survive a server render. Litro renders pages on
 * the server, where `window`, `navigator` and `localStorage` are all absent, so
 * every browser API here is reached defensively and never at module scope.
 */

import type {
  Capability,
  HapticNotify,
  HapticStyle,
  LocalNotification,
  NativeBridge,
  PlatformInfo,
  SharePayload,
} from '../types.js';

/**
 * Vibration lengths in milliseconds, roughly ordered to match the feel of the
 * native styles. The Vibration API takes a duration and nothing else, so this
 * is the only lever available.
 */
const VIBRATE_MS: Record<HapticStyle, number> = {
  light: 5,
  soft: 8,
  medium: 15,
  rigid: 20,
  heavy: 30,
};

/** Every key this adapter writes carries this prefix. */
const STORAGE_PREFIX = 'litro-native:';

interface BadgingNavigator {
  setAppBadge?: (count?: number) => Promise<void> | void;
  clearAppBadge?: () => Promise<void> | void;
}

/** `navigator`, or undefined on the server. */
function nav(): (Navigator & BadgingNavigator) | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator;
}

/**
 * `localStorage`, or undefined when it cannot be used.
 *
 * Reading the property itself throws in a browser with site data blocked, so
 * the access is guarded rather than the calls that follow it.
 */
function store(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export class WebBridge implements NativeBridge {
  readonly id = 'web' as const;

  async platform(): Promise<PlatformInfo> {
    const n = nav();
    const ua = n?.userAgent ?? '';
    return {
      isNative: false,
      os: /Android/i.test(ua) ? 'android' : 'web',
      supports: this.supported(),
    };
  }

  /**
   * The capabilities that do something here, decided by what this browser
   * actually exposes. Notifications and review are never in the list: the first
   * has no web equivalent, and the second is a store action with no web
   * counterpart.
   */
  private supported(): readonly Capability[] {
    const n = nav();
    const out: Capability[] = [];
    if (typeof n?.vibrate === 'function') out.push('haptics');
    if (typeof n?.setAppBadge === 'function') out.push('badging');
    if (typeof n?.share === 'function') out.push('share');
    if (store() !== undefined) out.push('secureStorage');
    return out;
  }

  /**
   * Android browsers honor the Vibration API. iOS Safari does not implement it
   * at all, so every call here is a no-op on an iPhone — which is the whole
   * reason the native host exists.
   */
  haptics = {
    impact: async (style: HapticStyle): Promise<void> => {
      nav()?.vibrate?.(VIBRATE_MS[style]);
    },
    notify: async (type: HapticNotify): Promise<void> => {
      // One pulse for success, two for a warning, three for an error, so the
      // three outcomes stay distinguishable without any native support.
      const pattern =
        type === 'success' ? [12] : type === 'warning' ? [10, 60, 10] : [10, 50, 10, 50, 10];
      nav()?.vibrate?.(pattern);
    },
    selection: async (): Promise<void> => {
      nav()?.vibrate?.(4);
    },
  };

  /**
   * A documented no-op. The web has no way to schedule a notification for a
   * later time with the page closed, and the Notification API shows one
   * immediately instead, which is a different feature. Returning an empty id
   * tells the caller no reminder was set.
   */
  notifications = {
    schedule: async (_n: LocalNotification): Promise<string> => '',
    cancel: async (_id: string): Promise<void> => {},
  };

  /**
   * `clear` calls the API's own clear rather than `set(0)`. The two are
   * equivalent in current browsers, but the host side treats them separately
   * and the bridge should not quietly merge them.
   */
  badging = {
    set: async (count: number): Promise<void> => {
      await nav()?.setAppBadge?.(count);
    },
    clear: async (): Promise<void> => {
      await nav()?.clearAppBadge?.();
    },
  };

  /**
   * Not secure. Browser storage is readable by any script on the origin and is
   * not a keychain. An app that persists a long-lived token must check
   * `isNative` before writing it; this exists so the call site reads the same
   * in both places, not to imply the guarantee the name suggests.
   */
  secureStorage = {
    get: async (key: string): Promise<string | null> => {
      try {
        return store()?.getItem(STORAGE_PREFIX + key) ?? null;
      } catch {
        return null;
      }
    },
    set: async (key: string, value: string): Promise<void> => {
      try {
        store()?.setItem(STORAGE_PREFIX + key, value);
      } catch {
        // Out of quota, or site data blocked. A failed write is not worth
        // breaking a caller that only wanted to remember a preference.
      }
    },
    remove: async (key: string): Promise<void> => {
      try {
        store()?.removeItem(STORAGE_PREFIX + key);
      } catch {
        // Same as above.
      }
    },
  };

  /**
   * Dismissing the share sheet rejects with an AbortError. That is the user
   * choosing not to share, not a failure, so it is swallowed. Anything else is
   * passed on.
   */
  share = async (p: SharePayload): Promise<void> => {
    const n = nav();
    if (typeof n?.share !== 'function') return;
    try {
      await n.share(p);
    } catch (err) {
      if ((err as Error | undefined)?.name === 'AbortError') return;
      throw err;
    }
  };

  /** Asking for a store review has no web counterpart. */
  requestReview = async (): Promise<void> => {};
}
