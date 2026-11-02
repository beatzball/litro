/**
 * The contract every bridge implements.
 *
 * This interface is ours. It is written for what Litro apps need, not derived
 * from any particular native host, so a host can be replaced without touching
 * an app. See design/specs/2026-10-25-litro-native-ios-shell.md.
 */

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';

export type HapticNotify = 'success' | 'warning' | 'error';

export type OS = 'ios' | 'android' | 'web';

/** A capability name, as it appears in {@link PlatformInfo.supports}. */
export type Capability =
  | 'haptics'
  | 'notifications'
  | 'badging'
  | 'secureStorage'
  | 'share'
  | 'review';

export interface PlatformInfo {
  isNative: boolean;
  /**
   * Which platform this is, as far as capabilities are concerned.
   *
   * `'ios'` means the native host. A page in iOS Safari reports `'web'`,
   * because it has none of the native capabilities and an app that read
   * `'ios'` there would assume ones it does not have. `'android'` is an
   * Android browser, where some web APIs do work. So this field answers
   * "what can run here", not "which operating system is this". For install
   * instructions keyed on the real operating system, read the user agent.
   */
  os: OS;
  appVersion?: string;
  osVersion?: string;
  /**
   * Bridge protocol version the host speaks. Absent on the web, where there is
   * no host to ask.
   */
  bridgeVersion?: number;
  /**
   * The capabilities that do something real here.
   *
   * Every capability always has a defined behavior — calling one never throws —
   * but a capability missing from this list does nothing when called. An app
   * reads this to decide whether to offer a feature at all. On the web the list
   * is built from the browser APIs actually present, so it differs between two
   * browsers and between two visits to the same browser.
   */
  supports: readonly Capability[];
}

export interface LocalNotification {
  /**
   * Scheduling again with the same id replaces the earlier reminder. When
   * omitted, one is made for you, and a timed-out call's error carries it as
   * `data.id`. Pass your own if you may retry.
   */
  id?: string;
  title: string;
  body?: string;
  /**
   * Epoch milliseconds. For a one-off, the instant it fires. For a daily
   * repeat, only the time of day is used, in the device's time zone; it starts
   * at the next such time, today if that has not passed, even when `at` is a
   * later date.
   */
  at: number;
  repeat?: 'daily' | 'none';
}

export interface SharePayload {
  title?: string;
  text?: string;
  url?: string;
}

export interface NativeBridge {
  readonly id: 'shell' | 'web';
  platform(): Promise<PlatformInfo>;
  haptics: {
    impact(style: HapticStyle): Promise<void>;
    notify(type: HapticNotify): Promise<void>;
    selection(): Promise<void>;
  };
  notifications: {
    /**
     * Schedules a local notification and returns its id.
     *
     * An empty string means nothing was scheduled, which is what the web
     * returns because browsers have no local scheduler. Callers that store the
     * id should treat an empty one as "no reminder set".
     */
    schedule(n: LocalNotification): Promise<string>;
    cancel(id: string): Promise<void>;
  };
  badging: {
    set(count: number): Promise<void>;
    clear(): Promise<void>;
  };
  /**
   * Key-value storage for small secrets.
   *
   * **Secure only inside the native shell, and only when `supports` lists
   * `secureStorage`.** There it is the platform keychain. On the web it is
   * browser storage, which any script on the origin can read. Gate a
   * long-lived token on `isNative` and nothing else: when it is true, a write
   * reaches the keychain or nothing. A page inside the shell whose handshake
   * failed gets browser storage, but reports `isNative` false.
   *
   * One store per origin, in the shell as on the web. An empty key, or a key
   * or value that is not well-formed text, rejects with `INVALID_PARAMS`
   * everywhere.
   */
  secureStorage: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    remove(key: string): Promise<void>;
  };
  /** Whether this payload can be shared here. */
  canShare(p: SharePayload): Promise<boolean>;
  share(p: SharePayload): Promise<void>;
  requestReview(): Promise<void>;
}
