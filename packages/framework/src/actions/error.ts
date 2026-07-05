/**
 * Typed error that crosses the action wire. The server serializes it to an
 * ActionErrorPayload (JSON, with HTTP status set); the client stub
 * reconstructs a LitroActionError from that payload. Stacks are attached in
 * dev only — never in production responses.
 */
export interface ActionErrorPayload {
  name: string;
  message: string;
  status: number;
  issues?: unknown[];
  stack?: string;
}

export class LitroActionError extends Error {
  status: number;
  issues?: unknown[];

  constructor(
    message: string,
    opts: { status?: number; issues?: unknown[]; cause?: unknown } = {},
  ) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = 'LitroActionError';
    this.status = opts.status ?? 500;
    this.issues = opts.issues;
  }
}
