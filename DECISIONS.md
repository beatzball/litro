# Litro — Decision Log

Running log of architectural and implementation decisions. All agents append here.

---

## R-1 / R-4: Single-port dev server via Nitro devHandlers

**Decision**: Inject Vite as middleware into Nitro's dev server rather than running two separate processes.

**Rationale**: Avoids cross-origin issues, eliminates the need for a proxy, and simplifies the developer experience (one port, one process).

**Implementation**: Vite is started with `server.middlewareMode: true` and `appType: 'custom'`. The resulting connect middleware is adapted via `fromNodeMiddleware()` from `h3` and pushed into `nitro.options.devHandlers`.

---

## R-1 / R-4: Virtual module for page manifest

**Decision**: Use a single `#litro/page-manifest` virtual module rather than registering individual Nitro routes per page file.

**Rationale**: Nitro's route registry is locked at build time. Registering per-page routes during build hooks causes problems on hot-reload in dev mode and diverges from Nitro's design. A single catch-all handler is simpler and works identically across all deployment targets.

---

## R-1 / I-2: `publicAssets` over `publicDir`

**Decision**: Use `publicAssets` array in `nitro.config.ts` to serve the Vite client bundle.

**Rationale**: `publicDir` is silently ignored by Cloudflare Workers and Vercel Edge adapters. `publicAssets` is the only approach that works across all Nitro targets.

---

## I-1: `source` export condition for workspace resolution

**Decision**: Add a `"source"` condition to `packages/framework/package.json` exports pointing at the TypeScript source, and add `resolve.conditions: ['source', ...]` to `vite.config.ts`.

**Rationale**: Without this, Vite in the playground resolves `litro/runtime/*` to the compiled `dist/` files, which don't exist until after a framework build. The `source` condition lets Vite resolve TypeScript source directly during development without a pre-compile step.

---

## I-2 / Implementation: Physical file fallback for `#litro/page-manifest`

**Decision**: The pages plugin writes the generated manifest to `server/stubs/page-manifest.ts` in addition to setting `nitro.options.virtual['#litro/page-manifest']`.

**Rationale**: `@rollup/plugin-node-resolve` intercepts `#` imports via `package.json` `"imports"` before Nitro's virtual module plugin when the virtual module is not set. The physical file ensures the correct routes are available even if the virtual module mechanism fails. The `"imports"` entry is kept as a cold-start fallback; the virtual module wins when set.

---

## I-2 / Implementation: Page files statically imported in virtual manifest

**Decision**: The `#litro/page-manifest` virtual module includes a static `import * as _pageN from '/abs/path/pages/foo.ts'` for every page file.

**Rationale**: Node.js ESM cannot import `.ts` files at runtime (`ERR_UNKNOWN_FILE_EXTENSION`). By including static imports in the virtual module, Rollup's esbuild plugin compiles the TypeScript at build time. All `@customElement` decorators run on server startup, making components available to `@lit-labs/ssr` without any runtime `.ts` import.

---

## I-2 / I-3: `pageModules` registry in virtual manifest

**Decision**: Export a `pageModules: Record<filePath, module>` registry from `#litro/page-manifest`.

**Rationale**: `createPageHandler` needs access to page module exports (specifically `pageData`) to call the server-side data fetcher before rendering. Since the module is already bundled, the registry provides a synchronous lookup instead of a dynamic import.

---

## I-3: `unsafeStatic` for dynamic component tag rendering

**Decision**: Use `unsafeStatic` from `lit/static-html.js` when constructing Lit templates with a dynamic component tag name.

**Rationale**: Plain expression interpolation in element position (`html\`<${tag}>\``) is an invalid Lit template expression and causes `@lit-labs/ssr` to throw "Unexpected final partIndex". `unsafeStatic` marks the value as a static template part, allowing Lit to treat it correctly.

---

## Nitro 2.10: Hook name corrections

**Decision**: Use `'build:before'` and `'dev:reload'` instead of `'nitro:build:before'` and `'nitro:dev:reload'`. Do not use `'nitro:init'` in config hooks.

**Rationale**: Nitro 2.10's actual runtime hook names diverge from what older documentation and research indicated. `createNitro()` does not call `callHook('nitro:init')` — config hooks registered for this event are silently ignored. `build:before` is the correct hook that fires before the rollup build starts.

---

## Nitro 2.10: Direct plugin invocation pattern

**Decision**: Build-time plugins are directly awaited from `hooks['build:before']` rather than calling a plugin function that internally registers a nested `build:before` hook.

**Rationale**: By the time a plugin function runs (inside `build:before`), the `build:before` event has already fired. Any sub-hook registered for `build:before` inside the plugin would never be called in the current build cycle. Direct invocation avoids this timing issue entirely.

---

## esbuild: Decorator configuration for Lit

**Decision**: Set `experimentalDecorators: true` and `useDefineForClassFields: false` in Nitro's `esbuild.options.tsconfigRaw`.

**Rationale**: Lit uses TypeScript's legacy experimental decorators (`@customElement`, `@state`, `@property`). Without this configuration, Nitro's esbuild treats the decorators as TC39 stage-3 decorators, causing parse errors on `@state() declare field` syntax.

---

## `@vaadin/router` server-side isolation via dynamic imports

**Decision**: `LitroOutlet.ts` and `LitroLink.ts` use dynamic `import('@vaadin/router')` inside their lifecycle methods (`firstUpdated()`, `handleClick()`) rather than a static top-level import.

**Rationale**: `@vaadin/router` transitively loads `@vaadin/vaadin-development-mode-detector`, which reads `window` at module evaluation time. A static `import { Router } from '@vaadin/router'` at the top of `LitroOutlet.ts` causes Node.js to evaluate the module when `litro/runtime` is imported — crashing the server.

The key insight is that `LitroOutlet` and `LitroLink` are custom elements that are **never instantiated on the server**. Their lifecycle methods (`firstUpdated`, event handlers) only run in the browser. A dynamic import inside those methods is therefore safe: it is never triggered in Node.js, regardless of whether `litro/runtime` is bundled by rollup (production) or loaded as an external module (dev mode).

A Rollup stub plugin (added in `pagesPlugin`) provides belt-and-suspenders protection for production builds, replacing `@vaadin/router` with a no-op stub in the server bundle. The dynamic import approach is the fundamental fix; the stub is belt-and-suspenders.

**Why not a rollup alias/stub alone**: In Nitro dev mode, `litro` is loaded as an external Node.js module (not bundled by rollup). Rollup plugins are not applied to external modules, so a stub-only approach fails in dev mode. The dynamic import approach works in both dev and production.
