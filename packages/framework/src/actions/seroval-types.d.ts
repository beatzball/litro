/**
 * Type patch for seroval under NodeNext module resolution.
 *
 * seroval's published dist/types/index.d.ts re-exports its JSON-mode API via
 * `export * from './core/tree'` — an extensionless directory specifier that
 * TypeScript's NodeNext resolution cannot follow, so `toJSON`/`fromJSON`
 * exist at runtime but are invisible to tsc. This augmentation restores the
 * two members serialize.ts uses. Remove it if seroval ships NodeNext-safe
 * declarations.
 */
declare module 'seroval' {
  /** Opaque JSON-safe AST produced by toJSON(); safe for JSON.stringify. */
  export type SerovalJSON = unknown;
  export function toJSON<T>(source: T): SerovalJSON;
  export function fromJSON<T>(source: SerovalJSON): T;
}
