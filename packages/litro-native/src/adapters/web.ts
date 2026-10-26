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
      // `'ios'` is reserved for the native host. A page in iOS Safari has none
      // of the native capabilities, so reporting `'ios'` for it would invite an
      // app to assume capabilities it does not have. It reads as `'web'`.
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
    /**
     * The platform API takes an unsigned integer and throws on anything else,
     * so a count is floored and clamped first. Badge counts usually come from
     * arithmetic over unread items, which can land on -1 or 2.5 for one tick,
     * and that should show an empty badge rather than reject.
     */
    set: async (count: number): Promise<void> => {
      const safe = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
      await nav()?.setAppBadge?.(safe);
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
    /**
     * Writes, and rejects if the write genuinely failed.
     *
     * A missing platform feature is a no-op here, as everywhere: with no
     * storage at all this resolves and does nothing, and `supports` already
     * said so. A store that exists and then refuses the write is different. It
     * is usually a full quota, the previous value is still in place, and
     * swallowing it would leave a caller believing it had persisted a token it
     * had not.
     */
    set: async (key: string, value: string): Promise<void> => {
      const s = store();
      if (s === undefined) return;
      s.setItem(STORAGE_PREFIX + key, value);
    },
    /** Rejects on a real failure, for the same reason as `set`. */
    remove: async (key: string): Promise<void> => {
      const s = store();
      if (s === undefined) return;
      s.removeItem(STORAGE_PREFIX + key);
    },
  };

  /**
   * Dismissing the share sheet rejects with an AbortError. That is the user
   * choosing not to share, not a failure, so it is swallowed. Anything else is
   * passed on.
   */
  /**
   * Browsers expose their own check, and it can refuse a payload that `share`
   * would reject. A browser with `share` but no `canShare` can still share, so
   * a missing check reads as a yes rather than hiding the control.
   */
  canShare = async (p: SharePayload): Promise<boolean> => {
    const n = nav() as (Navigator & { canShare?: (p: SharePayload) => boolean }) | undefined;
    if (typeof n?.share !== 'function') return false;
    if (typeof n.canShare !== 'function') return true;
    try {
      return n.canShare(p);
    } catch {
      return false;
    }
  };

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
