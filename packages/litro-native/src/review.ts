/**
 * Asking for a store review.
 *
 * Native only, and the platform decides whether a prompt actually appears, so
 * treat a call as a hint rather than an action. Does nothing on the web.
 *
 * The promise resolves at once, when the request has been passed on. It never
 * says whether a prompt was shown, because the system does not tell the app:
 * it limits how often the prompt appears, and never shows it in a TestFlight
 * build. Call it after a moment of success, not from a button labeled "Rate
 * us" -- a button that usually does nothing looks broken.
 */

import { getBridge } from './bridge.js';

export async function requestReview(): Promise<void> {
  await (await getBridge()).requestReview();
}
