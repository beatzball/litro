/**
 * Haptics.
 *
 * One call works in three places: a device buzz through a native host, a
 * vibrate in an Android browser, and nothing at all in iOS Safari, which does
 * not implement the Vibration API. No caller branches on the platform.
 */

import { getBridge } from './bridge.js';
import type { HapticNotify, HapticStyle } from './types.js';

export const haptics = {
  /** A single tap, for a routine action such as placing a piece. */
  async impact(style: HapticStyle = 'medium'): Promise<void> {
    await (await getBridge()).haptics.impact(style);
  },
  /** An outcome: the three types stay distinguishable on every platform. */
  async notify(type: HapticNotify): Promise<void> {
    await (await getBridge()).haptics.notify(type);
  },
  /** The lightest tick, for moving through a list or picker. */
  async selection(): Promise<void> {
    await (await getBridge()).haptics.selection();
  },
};
