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
  id?: string;
  title: string;
  body?: string;
  /** Epoch milliseconds. */
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
