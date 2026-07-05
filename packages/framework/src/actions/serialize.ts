/**
 * Action value serialization.
 *
 * seroval JSON mode: toJSON() produces a plain-data AST (Date, Map, Set,
 * BigInt, typed arrays, circular refs all supported); fromJSON() reconstructs
 * values WITHOUT evaluating code. The server deserializes hostile client
 * input, so the code-eval mode (serialize/deserialize) must never be used
 * here. Both functions are isomorphic (safe in the browser bundle).
 */
import { toJSON, fromJSON } from 'seroval';

export function serializeValue(value: unknown): string {
  return JSON.stringify(toJSON(value));
}

export function deserializeValue(payload: string): unknown {
  return fromJSON(JSON.parse(payload));
}
