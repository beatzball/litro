/**
 * Asking for a store review.
 *
 * Native only, and the platform decides whether a prompt actually appears, so
 * treat a call as a hint rather than an action. Does nothing on the web.
 */

import { getBridge } from './bridge.js';

export async function requestReview(): Promise<void> {
  await (await getBridge()).requestReview();
}
