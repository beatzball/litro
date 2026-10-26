/**
 * @beatzball/litro-native
 *
 * Native device capabilities for a Litro app, with an honest web fallback for
 * each one. App code imports this package and never a native host directly, so
 * the host can be replaced without touching an app.
 *
 * Subpath exports are available for each capability, so an app that only wants
 * haptics does not pull in the rest.
 */

export { getBridge } from './bridge.js';
export { haptics } from './haptics.js';
export { notifications } from './notifications.js';
export { badging } from './badging.js';
export { secureStorage } from './storage.js';
export { share, canShare } from './share.js';
export { requestReview } from './review.js';
export { platform, supports } from './platform.js';

export type {
  Capability,
  HapticNotify,
  HapticStyle,
  LocalNotification,
  NativeBridge,
  OS,
  PlatformInfo,
  SharePayload,
} from './types.js';
