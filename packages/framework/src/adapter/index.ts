/**
 * adapter/index.ts — Public adapter API
 *
 * Re-exports the adapter interface, types, and resolver.
 * Server-side only — do NOT import from client code.
 */

export type { FrameworkAdapter, AdapterName, PageManifestEntry } from './types.js';
export { resolveAdapter } from './resolve.js';
