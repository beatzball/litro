/**
 * The app icon badge.
 *
 * Uses the Web Badging API in a browser that has it, and the native host
 * otherwise. In most browsers a badge only appears once the app is installed to
 * a home screen, so a call that does nothing visible is still correct.
 */

import { getBridge } from './bridge.js';

export const badging = {
  async set(count: number): Promise<void> {
    await (await getBridge()).badging.set(count);
  },
  async clear(): Promise<void> {
    await (await getBridge()).badging.clear();
  },
};
