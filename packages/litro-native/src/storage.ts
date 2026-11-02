/**
 * Key-value storage for small secrets.
 *
 * A native host keeps these in the platform keychain. **The web fallback is
 * browser storage, which is not a keychain**: any script on the origin can read
 * it, and it is visible in developer tools. Before persisting anything that
 * would matter if it leaked, such as a long-lived access token, check
 * `isNative` and keep the web build signed out instead.
 *
 * When `isNative` is true, a write reaches the keychain or goes nowhere: the
 * shell bridge never falls back to browser storage, even on a build without
 * the keychain module. A page inside the shell whose handshake failed gets the
 * web bridge and browser storage, but `isNative` is false there. So gate on
 * `isNative` and nothing else.
 *
 * Inside the shell the keychain is one store per origin, as browser storage
 * is: an app whose shell allows several origins gets a separate store for
 * each, and a page on one never reads, overwrites or removes another's values.
 *
 * An empty key, or a key or value that is not well-formed text, rejects with
 * `INVALID_PARAMS` on every platform, so a call that works in a browser works
 * the same on a phone.
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
