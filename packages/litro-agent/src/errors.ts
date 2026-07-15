/**
 * Typed error surface for @beatzball/litro-agent. Mirrors the actions error
 * discipline: structured payloads, stacks only in dev.
 */
export interface AgentErrorPayload {
  name: string;
  message: string;
  status: number;
  stack?: string;
}

export class AgentError extends Error {
  status: number;

  constructor(message: string, opts: { status?: number; cause?: unknown } = {}) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = 'AgentError';
    this.status = opts.status ?? 500;
  }
}

export function errorPayload(err: unknown, dev: boolean): AgentErrorPayload {
  const e = err instanceof Error ? err : new Error(String(err));
  const status = err instanceof AgentError ? err.status : 500;
  return { name: e.name, message: e.message, status, ...(dev ? { stack: e.stack } : {}) };
}
