/**
 * Action value serialization.
 *
 * seroval JSON mode: toJSON() produces a plain-data AST (Date, Map, Set,
 * BigInt, typed arrays, circular refs all supported); fromJSON() reconstructs
 * values WITHOUT evaluating code. The server deserializes hostile client
 * input, so the code-eval mode (serialize/deserialize) must never be used
 * here. Both functions are isomorphic (safe in the browser bundle).
 */
import { toJSON, fromJSON, toCrossJSON, fromCrossJSON, type SerovalNode } from 'seroval';
import type { ActionErrorPayload } from './error.js';

export function serializeValue(value: unknown): string {
  return JSON.stringify(toJSON(value));
}

export function deserializeValue(payload: string): unknown {
  return fromJSON(JSON.parse(payload));
}

/**
 * Streaming wire protocol (application/x-ndjson): one JSON object per line.
 *   { n: <seroval cross-JSON node> }   — one yielded value
 *   { err: <ActionErrorPayload> }      — mid-stream handler throw; stream ends
 *   { done: true }                     — clean end of stream
 * Encoder and decoder each hold a shared seroval refs map for the lifetime of
 * one response, so object identity is preserved across chunks. Cross-JSON is
 * a plain-data AST — no code is evaluated on either side.
 */
export type StreamChunk =
  | { kind: 'value'; value: unknown }
  | { kind: 'error'; payload: ActionErrorPayload }
  | { kind: 'done' };

export interface StreamEncoder {
  value(v: unknown): string;
  error(p: ActionErrorPayload): string;
  done(): string;
}

export function createStreamEncoder(): StreamEncoder {
  const refs = new Map<unknown, number>();
  return {
    value: (v) => `${JSON.stringify({ n: toCrossJSON(v, { refs }) })}\n`,
    error: (p) => `${JSON.stringify({ err: p })}\n`,
    done: () => `${JSON.stringify({ done: true })}\n`,
  };
}

export function createStreamDecoder(): (line: string) => StreamChunk {
  const refs = new Map<number, unknown>();
  return (line) => {
    const parsed = JSON.parse(line) as { n?: SerovalNode; err?: ActionErrorPayload; done?: boolean };
    if (parsed.err !== undefined) return { kind: 'error', payload: parsed.err };
    if (parsed.done === true) return { kind: 'done' };
    return { kind: 'value', value: fromCrossJSON(parsed.n, { refs }) };
  };
}

export function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    typeof (value as { [Symbol.asyncIterator]?: unknown } | null | undefined)?.[
      Symbol.asyncIterator
    ] === 'function'
  );
}
