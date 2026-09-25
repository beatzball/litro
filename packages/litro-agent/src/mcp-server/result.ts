/**
 * Turning one tool outcome into one `tools/call` result — the four rules from
 * section 14 of the spec that are correctness rather than polish. Every one of
 * them was measured against the SDK's own client before it was written down.
 *
 * 1. A NON-OBJECT RESULT is wrapped. The SDK types `structuredContent` as a
 *    record and rejects an array or a string ON THE SERVER SIDE with
 *    `-32602 Invalid tools/call result`, so a tool that returns `"ok"` would
 *    fail the call rather than answer it. Revision 2026-07-28 allows any JSON
 *    value, so this wrapper is an SDK-era constraint, not a permanent one.
 * 2. A HUGE RESULT is capped. 8 MB of `structuredContent` passed through with
 *    no complaint from either end, and there is no cap anywhere else in the
 *    stack. Truncated with a marker the model can read; the real size is logged.
 * 3. A THROWN TOOL is `isError: true`, never a protocol error. The
 *    specification reserves protocol errors for malformed requests and tells
 *    clients to give tool execution errors to the model so it can self-correct.
 *    The message is written for a reader and carries no stack (AGENT-007).
 * 4. A UIResult's `html` NEVER crosses the wire (AGENT-002). Only `data`
 *    becomes `structuredContent`; the `ui://` document is the view, and a host
 *    fetches it with `resources/read`.
 */
import type { ToolCallOutcome } from '../runtime/tool-call.js';

/** The key a non-object result is wrapped under. One name, in one place, so
 *  the docs and the tests cannot drift from the wire. */
export const WRAPPED_RESULT_KEY = 'value';

/**
 * Default cap on the JSON a single call may answer with.
 *
 * 1 MiB, which is far above any result a tool that renders a component
 * produces and far below anything that would stall a host. It is a guard, not
 * a budget — a tool that hits it is returning a database, and the marker says
 * so.
 */
export const DEFAULT_MAX_RESULT_BYTES = 1024 * 1024;

/** Default per-call timeout. The specification tells clients to implement
 *  timeouts; that does not excuse the server from one. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** The MCP `tools/call` result shape, narrowed to what this server emits. */
export interface ToolCallResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/** `JSON.stringify` that never throws and never returns undefined. A cyclic
 *  result is a tool bug, and reporting it as one beats failing the call. */
function safeJson(value: unknown): { json: string; error?: string } {
  try {
    const json = JSON.stringify(value);
    // `undefined`, a function and a symbol all stringify to undefined. A tool
    // that returns nothing is legal, and `null` is the honest wire form.
    return { json: json ?? 'null' };
  } catch (err) {
    return { json: 'null', error: (err as Error).message };
  }
}

/**
 * The first `limit` BYTES of `text`, cut at a character boundary.
 *
 * Cutting a Buffer at an arbitrary byte splits a multi-byte sequence and the
 * decoder replaces the pieces with U+FFFD, so a truncated result would end in a
 * character the tool never returned. Walking back over the continuation bytes
 * (`10xxxxxx`) and dropping the incomplete sequence's lead byte costs three
 * lines and keeps the text exactly what the tool wrote, one character shorter.
 */
function truncateUtf8(text: string, limit: number): string {
  const buf = Buffer.from(text, 'utf8');
  if (buf.length <= limit) return text;
  let end = limit;
  while (end > 0 && (buf[end] & 0b1100_0000) === 0b1000_0000) end -= 1;
  return buf.subarray(0, end).toString('utf8');
}

export interface ShapeOptions {
  maxResultBytes?: number;
  /** Where the real size of a capped result is reported. stderr, always —
   *  stdout is the JSON-RPC channel. */
  log?: (line: string) => void;
  /** Named in the log line, so a capped result can be traced to its tool. */
  toolName?: string;
}

/**
 * The data half of a result, as `structuredContent`.
 *
 * A plain object travels as itself. Anything else — a string, a number, an
 * array, null — is wrapped under one key, because the SDK rejects a
 * non-record. An array is wrapped rather than spread: `{ value: [...] }` keeps
 * the shape a tool returned, where `{...array}` would turn it into
 * index-keyed properties.
 */
export function asStructuredContent(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { [WRAPPED_RESULT_KEY]: value ?? null };
}

/**
 * Builds the successful result for a value the tool returned.
 *
 * `content` carries the same JSON as text. The specification keeps `content`
 * (for the model) and `structuredContent` (for the view) separate, and a
 * server that has no prose to add says the same thing in both rather than
 * inventing a sentence the tool did not write.
 */
export function shapeValueResult(value: unknown, options: ShapeOptions = {}): ToolCallResult {
  const limit = options.maxResultBytes ?? DEFAULT_MAX_RESULT_BYTES;
  const { json, error } = safeJson(value);

  if (error) {
    return toolErrorResult(
      `The tool's result could not be serialized as JSON (${error}). Return a plain value.`,
    );
  }

  const bytes = Buffer.byteLength(json, 'utf8');
  if (bytes > limit) {
    const where = options.toolName ? `tool "${options.toolName}"` : 'a tool';
    options.log?.(
      `[litro mcp] capped a result from ${where}: ${bytes} bytes of JSON, over the ${limit} byte limit.`,
    );
    const head = truncateUtf8(json, limit);
    const marker =
      `\n[truncated by litro mcp: the tool returned ${bytes} bytes of JSON, over the ` +
      `${limit} byte limit. Ask for less, or narrow the arguments.]`;
    return {
      content: [{ type: 'text', text: head + marker }],
      structuredContent: { truncated: true, bytes, limit },
    };
  }

  return { content: [{ type: 'text', text: json }], structuredContent: asStructuredContent(value) };
}

/**
 * A tool's own failure. `isError: true` with a message written for a reader —
 * not a protocol error, and never a stack.
 */
export function toolErrorResult(message: string): ToolCallResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

/**
 * Maps a finished outcome to a result. Only the outcomes that are the TOOL's
 * business are handled here: an unknown tool and invalid arguments are protocol
 * errors and are raised by the caller before this is reached.
 */
export function shapeOutcome(outcome: ToolCallOutcome, options: ShapeOptions = {}): ToolCallResult {
  switch (outcome.kind) {
    case 'ui':
      // `data` only. `html` is not read, not logged, and not sent — the
      // `ui://` document the host fetched is the view (AGENT-002).
      return shapeValueResult(outcome.data, options);
    case 'value':
      return shapeValueResult(outcome.value, options);
    case 'execute-error':
    case 'nested-ui':
      return toolErrorResult(outcome.message);
    case 'unknown-tool':
    case 'validation-error':
      // Unreachable through `callTool`, which raises these as protocol errors.
      // Answered rather than thrown so a future caller cannot fall through it.
      return toolErrorResult(outcome.message);
  }
}

/** A call that ran past its timeout. The tool itself keeps running — a promise
 *  cannot be canceled, and `ToolContext` carries no abort signal in v1 — so the
 *  message says only what is true: no result arrived in time. */
export function timeoutResult(toolName: string, ms: number): ToolCallResult {
  return toolErrorResult(
    `The tool "${toolName}" did not finish within ${ms}ms and was given up on. Try again, or narrow the arguments.`,
  );
}

/**
 * Races a call against the per-call timeout.
 *
 * The timer is unref'd: a tool that finishes early must not hold the process
 * open for the rest of the window, which on a stdio server is the difference
 * between a host's subprocess exiting and hanging.
 */
export async function withTimeout<T>(ms: number, work: Promise<T>): Promise<{ timedOut: true } | { timedOut: false; value: T }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<{ timedOut: true }>((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), ms);
    (timer as { unref?: () => void }).unref?.();
  });
  const wrapped = work.then((value) => ({ timedOut: false as const, value }));
  // A tool that throws AFTER the timeout won the race has no handler left, and
  // Node reports an unhandled rejection for it — on a stdio server that lands
  // in the host's log as if the server had crashed. Marking it handled here
  // does not change the race: whichever settles first still wins.
  void wrapped.catch(() => {});
  try {
    return await Promise.race([wrapped, expiry]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
