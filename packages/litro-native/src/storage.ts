/**
 * Key-value storage for small secrets.
 *
 * A native host keeps these in the platform keychain. **The web fallback is
 * browser storage, which is not a keychain**: any script on the origin can read
 * it, and it is visible in developer tools. Before persisting anything that
 * would matter if it leaked, such as a long-lived access token, check
 * `isNative` and keep the web build signed out instead.
 */

import { getBridge } from './bridge.js';

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    return (await getBridge()).secureStorage.get(key);
  },
  async set(key: string, value: string): Promise<void> {
    await (await getBridge()).secureStorage.set(key, value);
  },
  async remove(key: string): Promise<void> {
    await (await getBridge()).secureStorage.remove(key);
  },
};
