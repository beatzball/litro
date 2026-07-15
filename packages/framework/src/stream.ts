/**
 * @beatzball/litro/stream — the framework's NDJSON stream wire protocol,
 * shared by Server Actions and @beatzball/litro-agent. One line per chunk:
 *   { n: <seroval cross-JSON node> } | { err: <payload> } | { done: true }
 * Browser-safe (re-exports the isomorphic actions serializer).
 */
export {
  serializeValue,
  deserializeValue,
  createStreamEncoder,
  createStreamDecoder,
  isAsyncIterable,
} from './actions/serialize.js';
export type { StreamChunk, StreamEncoder } from './actions/serialize.js';
