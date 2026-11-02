/**
 * The error a native call rejects with.
 *
 * A capability call never rejects because a platform feature is missing; see
 * the contract in types.ts. It does reject when the platform itself refuses the
 * operation or the shell fails to answer, and this is what that rejection
 * carries, so a caller can tell a declined permission from a fault.
 */

import { ERROR_CODES } from './protocol.js';

export class NativeBridgeError extends Error {
  override readonly name = 'NativeBridgeError';

  /**
   * One of {@link ERROR_CODES}, or a code a newer shell sent that this page
   * does not know. Compare against the named codes, never against a message.
   */
  readonly code: number;

  /** Whatever extra detail the shell attached, unvalidated. */
  readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.code = code;
    if (data !== undefined) this.data = data;
  }

  /** The user declined a permission prompt. Not a fault, and not retryable. */
  get isPermissionDenied(): boolean {
    return this.code === ERROR_CODES.PERMISSION_DENIED;
  }

  /** The shell did not answer in time. */
  get isTimeout(): boolean {
    return this.code === ERROR_CODES.TIMEOUT;
  }
}
