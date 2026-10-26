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
 * Ask before offering a share control: a platform can refuse a payload that
 * `share` would then reject. Always false where there is no share sheet at all.
 *
 * This goes through the bridge rather than reading the browser directly, so
 * that once a native host exists, `canShare` and `share` cannot answer for two
 * different places.
 */
export async function canShare(payload: SharePayload): Promise<boolean> {
  return (await getBridge()).canShare(payload);
}
