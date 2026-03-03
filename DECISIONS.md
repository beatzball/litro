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

## Replaced `@vaadin/router` with `LitroRouter` (URLPattern API)

**Decision**: Remove `@vaadin/router` (deprecated) as a dependency. Replace with a thin built-in router class (`packages/framework/src/runtime/litro-router.ts`) built on the native `URLPattern` web API.

**Rationale**: `@vaadin/router` was deprecated by the Vaadin team. Since all router integration was already wrapped behind `LitroOutlet`, `LitroLink`, and `LitroPage`, consumers never imported `@vaadin/router` directly — only the internals needed to change.

`URLPattern` (Baseline Newly Available Sep 2025) provides native pattern matching with zero bundle overhead in modern browsers. The custom router also lets us:
- Preserve all consumer-facing APIs (`setRoutes()`, `Router.go()`, `onBeforeEnter()`) unchanged
- Keep the dynamic import pattern for SSR safety (litro-router accesses `window` at runtime, not at module eval time)
- Eliminate the `vaadinRouterStubPlugin` Rollup plugin that was needed to prevent `window` crashes during server bundling
- Fully control the `onBeforeEnter` lifecycle contract that `LitroPage` relies on for data fetching

**Path format conversion**: Litro paths use h3/path-to-regexp syntax (`:param(.*)*` for catch-alls). URLPattern uses `:param*` for the same. `LitroRouter.setRoutes()` converts the format automatically via `vaadinToURLPattern()`, so the path format throughout the rest of the codebase (scanner output, manifest, server routing) is unchanged.

**SSR safety**: `litro-router.ts` does not access `window`, `document`, or `history` at module eval time — only inside methods that are called at runtime in the browser. The dynamic import pattern in `LitroOutlet` and `LitroLink` is preserved, so the module is never evaluated server-side.

**TypeScript types**: `URLPattern` is not yet in TypeScript's `lib.dom.d.ts` (as of TS 5.9). Minimal ambient declarations (`interface URLPattern`, `interface URLPatternResult`, etc.) are added at the top of `litro-router.ts` to avoid requiring lib changes in downstream projects.

---

## Vite dev middleware: server/middleware/ over devHandlers

**Decision**: Vite dev middleware is implemented as a Nitro server middleware file (`server/middleware/vite-dev.ts`) rather than by pushing to `nitro.options.devHandlers`.

**Rationale**: `DevServer.createApp()` reads `nitro.options.devHandlers` in its constructor, which is called from `createDevServer()` — before `build:before` or any other build hook fires. There is no hook window in which `devHandlers` can be populated in time. Server middleware files are registered in `createNitroApp()` via `h3App.use(middleware)` before the router is mounted, giving Vite first access to every request.

---

## Vite dev middleware: `ignore` + `handlers[env:'dev']` for production exclusion

**Decision**: Prevent auto-discovery of `server/middleware/vite-dev.ts` via `ignore: ['**/middleware/vite-dev.ts']` and re-register it with `handlers: [{ ..., env: 'dev' }]` in `nitro.config.ts`.

**Rationale**: Even with `process.dev` DCE, Nitro's `@vercel/nft` tracer populates `trackedExternals` during Rollup's resolution phase (before DCE runs). Additionally, `buildProduction()` calls `scanHandlers()` a second time after `build:before`, overwriting any filter applied to `nitro.scannedHandlers`. Only `nitro.options.handlers` (explicit config) survives both scans. With `env: 'dev'`, Nitro's `getHandlers()` evaluates inside a lazy Rollup virtual module — in production it excludes the handler, so the file never enters the module graph and `import('vite')` is never resolved. Production bundle: 745 kB (vs 5.29 MB without this fix).

---

## Build fix: `publicAssets.dir` relative to `srcDir`, not `rootDir`

**Decision**: Use `'../dist/client'` and `'../public'` instead of `'dist/client'` and `'public'` in the `publicAssets` array when `srcDir = 'server'`.

**Rationale**: Nitro's `resolveAssetsOptions` does `publicAsset.dir = resolve(options.srcDir, publicAsset.dir)`. Because `srcDir` resolves to the absolute path `<rootDir>/server`, a bare `'dist/client'` resolves to `<rootDir>/server/dist/client` which does not exist. With incorrect paths, `copyPublicAssets()` finds no files, `dist/server/public/` stays empty, the `assets` manifest in the built bundle is `{}`, and all `/_litro/**` requests 404 in preview.

**Symptom**: `GET /_litro/app.js 404` in preview, client JS never loads, client router never starts, links appear broken.

**Detection**: Build output should contain `[nitro] ✔ Generated public dist/server/public`. If missing, `publicAssets.dir` paths are wrong.

---

## Build fix: `routes.generated.ts` at project root, pre-scan before vite

**Decision**: Write `routes.generated.ts` to `<rootDir>/routes.generated.ts` (not `dist/client/routes.generated.ts`). The `litro build` CLI calls `scanAndWriteClientRoutes(cwd)` before spawning `vite build`.

**Rationale**: Vite's `emptyOutDir: true` (the default) clears the output directory during the write phase. Any file placed in `dist/client/` is unreliable as a Vite input because it can be deleted mid-build. More critically, `litro build` runs Vite before Nitro, so the Nitro `build:before` hook (which regenerates the routes) fires after Vite has already bundled `app.ts` — baking stale routes from the previous session into the client bundle.

The fix uses two changes together:
1. The file lives at `<rootDir>/routes.generated.ts`, outside Vite's output directory, so it is not affected by `emptyOutDir` and Vite can read it as a stable source file.
2. The CLI runs `scanAndWriteClientRoutes(cwd)` synchronously before spawning `vite build`, ensuring the file always contains current routes before the Vite bundling step.

`app.ts` imports `'./routes.generated.js'`; Vite resolves `.js` → `.ts` automatically.

---

## CLI: default dev port 3030

**Decision**: `litro dev` defaults to port 3030 and accepts `--port` / `-p` for overrides.

**Rationale**: Avoids collision with the common defaults of React (3000), Vue (5173), and other tools. The port is passed through to `nitro dev --port <n>`; Nitro handles the actual binding.

---

## Extract LitroRouter into standalone `litro-router` package

**Decision**: Move `packages/framework/src/runtime/litro-router.ts` into its own workspace package `packages/litro-router` (npm: `litro-router`). The `litro` package adds `"litro-router": "workspace:*"` as a dependency and all six internal import sites are updated to import from `litro-router`.

**Rationale**: `LitroRouter` has zero runtime dependencies (browser-native APIs only) and no coupling to the rest of the Litro framework. Extracting it:

- Allows it to be used with any web component setup without pulling in Nitro, Vite, Lit, or the rest of the Litro dependency tree
- Enables independent versioning and changelog
- Gives it its own README and npm listing, making it discoverable as a general-purpose tool

**TypeScript project references**: `packages/framework/tsconfig.json` gains a `references` entry pointing at `../litro-router`. This tells `tsc` about the build dependency so it can resolve types from the compiled output. All build steps (CI, smoke test scripts) must build `litro-router` before `litro`.

**No consumer-facing API change**: All public types (`Route`, `LitroLocation`) and the `LitroRouter` class are re-exported from `litro/runtime` unchanged, so existing Litro app code requires no modification.
