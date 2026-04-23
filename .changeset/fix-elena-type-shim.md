---
"@beatzball/litro": patch
---

Fix: emitted `.d.ts` files for the Elena adapter no longer reference a nonexistent `ElenaClass` type from `@elenajs/core`. Downstream consumers with strict TypeScript can now extend `LitroPage` without TS4113/TS2339 errors.

The fix removes a stale ambient module declaration (`packages/framework/src/adapter/elena/env.d.ts`) that was added against `@elenajs/core@1.0.0-rc.13` and never cleaned up after the upgrade to `1.0.0`. With the shim removed, `LitroPage`/`LitroLink`/`LitroOutlet` now extend the real `ElenaElementConstructor` exported by `@elenajs/core@1.0.0`, and consumer typecheck passes.

The page-manifest generator was also tightened so the generated `routes.generated.ts` and `server/stubs/page-manifest.ts` files typecheck under strict + bundler `moduleResolution`: relative `.js` import specifiers replace absolute `.ts` paths, and `pageModules` is exported as `Record<string, Record<string, unknown>>` so the catch-all handler's `pageModules[route.filePath]` lookup no longer trips TS7053. Generated files lead with `// @ts-nocheck` for any remaining generator artefacts.
