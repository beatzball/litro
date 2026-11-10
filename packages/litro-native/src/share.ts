/**
 * Sharing.
 *
 * Opens the platform share sheet. A browser without one does nothing. The user
 * dismissing the sheet is not an error and does not reject.
 *
 * So the promise resolving means the sheet has closed, and nothing more. It
 * does not say that anything was shared. It rejects when the target the person
 * picked fails, or when the sheet could not be shown at all, such as a second
 * share while one sheet is still open.
 *
 * A relative `url` is resolved against the page before it is shared, as the
 * browser does. In the native app only `http` and `https` links are shared.
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
