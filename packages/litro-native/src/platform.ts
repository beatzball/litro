/**
 * What we are running on, and what it can do.
 *
 * Resolves the bridge, so like every other call here it is safe during a server
 * render and reports the web answer there.
 */

import { getBridge } from './bridge.js';
import type { Capability, PlatformInfo } from './types.js';

export async function platform(): Promise<PlatformInfo> {
  return (await getBridge()).platform();
}

/**
 * Whether a capability does something real here.
 *
 * Every capability is always safe to call. This answers the different question
 * of whether calling it will have any effect, which is what decides if a
 * feature should be offered in the interface at all.
 */
export async function supports(capability: Capability): Promise<boolean> {
  return (await platform()).supports.includes(capability);
}
