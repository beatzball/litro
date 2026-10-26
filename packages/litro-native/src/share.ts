/**
 * Sharing.
 *
 * Opens the platform share sheet. A browser without one does nothing. The user
 * dismissing the sheet is not an error and does not reject.
 *
 * This capability is a single verb, so it is a function rather than a namespace.
 * See the naming rule in the package README.
 */

import { getBridge } from './bridge.js';
import type { SharePayload } from './types.js';

export async function share(payload: SharePayload): Promise<void> {
  await (await getBridge()).share(payload);
}

/**
 * Whether this payload can be shared here.
 *
 * Browsers expose their own check for this, and it can refuse a payload that
 * `share` would reject, so ask before offering a share control. Always false
 * where there is no share sheet at all.
 */
export async function canShare(payload: SharePayload): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const n = navigator as Navigator & { canShare?: (p: SharePayload) => boolean };
  if (typeof n.share !== 'function') return false;
  // A browser with `share` but no `canShare` can still share, so treat the
  // missing check as a yes rather than hiding the control.
  if (typeof n.canShare !== 'function') return true;
  try {
    return n.canShare(payload);
  } catch {
    return false;
  }
}
