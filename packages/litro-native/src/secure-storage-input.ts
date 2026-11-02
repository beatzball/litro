/**
 * What a secure storage key or value must be, checked the same way on every
 * path.
 *
 * A call with a bad key must fail the same way on the web, in the shell, and in
 * a shell built without the keychain module. Otherwise the same page code works
 * in a browser and throws on a phone, and the first person to find out is a
 * user. So both adapters call this before doing anything else, and it throws
 * the error the shell itself would send.
 *
 * Two rules:
 *
 * - The key is not empty. The shell has always refused one, and an empty key
 *   is a bug in the caller rather than a name.
 * - The key and the value are well-formed text: no lone surrogate. The bridge
 *   turns a lone surrogate into U+FFFD before the shell sees the string, so two
 *   different keys would land on one keychain item, and a value would read back
 *   different from what was written. Only the page can see the difference, so
 *   only the page can refuse it.
 */

import { NativeBridgeError } from './errors.js';
import { ERROR_CODES } from './protocol.js';

/** A high surrogate with no low one after it, or a low one with no high one before it. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

function invalid(message: string): NativeBridgeError {
  return new NativeBridgeError(ERROR_CODES.INVALID_PARAMS, message);
}

/** Throws INVALID_PARAMS unless `key`, and `value` when given, may be stored. */
export function checkSecureStorageInput(key: string, value?: string): void {
  if (typeof key !== 'string' || key.length === 0) throw invalid('key must be a non-empty string');
  if (LONE_SURROGATE.test(key)) throw invalid('key must be well-formed text');
  if (value === undefined) return;
  if (typeof value !== 'string') throw invalid('value must be a string');
  if (LONE_SURROGATE.test(value)) throw invalid('value must be well-formed text');
}
