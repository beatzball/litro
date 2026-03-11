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

## LitroLink: `static override properties` instead of `@property()` field decorators

**Decision**: `LitroLink` declares `href`, `target`, and `rel` via `static override properties = { ... }` plus plain field initializers (`href = ''`), NOT `@property()` on plain fields.

**Rationale**: Vite 5 uses esbuild 0.21+ which applies the TC39 Stage 3 decorator transform to client bundles. In that transform, `@property()` only handles `accessor` fields (`accessor href = ''`); applied to a plain field (`href = ''`) it is silently dropped and the field is never added to `observedAttributes`. As a result, `this.href` stays `''` forever regardless of the HTML attribute, breaking all link navigation silently.

`accessor` fields are also problematic: Lit's TC39 `init` function fires during instance construction before `elementProperties` is populated, causing a runtime crash ("Cannot read properties of undefined (reading 'has')").

`static override properties` is read by Lit in `finalize()`, called from the `observedAttributes` getter when `customElements.define()` runs — before any instances are created. This works correctly under both legacy experimental decorators (Nitro/SSR esbuild) and TC39 Stage 3 (Vite client build).

**Corollary — template pages**: Page components should NOT use `@state() declare serverData: T | null` to narrow the inherited `serverData: unknown` type. The `declare` modifier emits no runtime code but causes jiti's oxc-transform to throw "Fields with the 'declare' modifier cannot be initialized here" in SSG mode. Instead, use a local type cast in `render()`: `const data = this.serverData as T | null`.

---

## Replaced `@vaadin/router` with `LitroRouter` (URLPattern API)

**Decision**: Remove `@vaadin/router` (deprecated) as a dependency. Replace with a thin built-in router class (`packages/framework/src/runtime/litro-router.ts`) built on the native `URLPattern` web API.

**Rationale**: `@vaadin/router` was deprecated by the Vaadin team. Since all router integration was already wrapped behind `LitroOutlet`, `LitroLink`, and `LitroPage`, consumers never imported `@vaadin/router` directly — only the internals needed to change.

`URLPattern` (Baseline Newly Available Sep 2025) provides native pattern matching with zero bundle overhead in modern browsers. The custom router also lets us:
- Preserve all consumer-facing APIs (`setRoutes()`, `Router.go()`, `onBeforeEnter()`) unchanged
- Keep the dynamic import pattern for SSR safety (litro-router accesses `window` at runtime, not at module eval time)
- Eliminate the `vaadinRouterStubPlugin` Rollup plugin that was needed to prevent `window` crashes during server bundling
- Fully control the `onBeforeEnter` lifecycle contract that `LitroPage` relies on for data fetching

**Path format conversion**: Litro paths use h3/path-to-regexp syntax (`:param(.*)*` for catch-alls). URLPattern uses `:param*` for the same. `LitroRouter.setRoutes()` converts the format automatically via `h3ToURLPattern()`, so the path format throughout the rest of the codebase (scanner output, manifest, server routing) is unchanged.

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

## CLI: dynamic port selection

**Decision**: `litro dev` and `litro preview` default to port 3000 and auto-increment if that port is taken. Passing `--port` / `-p` explicitly errors out instead of silently moving to another port.

**Rationale**: Port collisions (multiple playgrounds, Docker containers, other dev tools) previously produced an opaque `EADDRINUSE` crash from Nitro. A connect-based TCP probe (`node:net` `createConnection`) is used rather than a bind-based probe — Docker Desktop on macOS publishes ports through a userspace proxy that may not hold a conventional bound socket, so only a connection attempt reliably detects occupancy. The resolved port is handed to Nitro/the static server; Nitro's own port fallback is never invoked.

---

## Extract LitroRouter into standalone `litro-router` package

**Decision**: Move `packages/framework/src/runtime/litro-router.ts` into its own workspace package `packages/litro-router` (npm: `litro-router`). The `litro` package adds `"litro-router": "workspace:*"` as a dependency and all six internal import sites are updated to import from `litro-router`.

**Rationale**: `LitroRouter` has zero runtime dependencies (browser-native APIs only) and no coupling to the rest of the Litro framework. Extracting it:

- Allows it to be used with any web component setup without pulling in Nitro, Vite, Lit, or the rest of the Litro dependency tree
- Enables independent versioning and changelog
- Gives it its own README and npm listing, making it discoverable as a general-purpose tool

**TypeScript project references**: `packages/framework/tsconfig.json` gains a `references` entry pointing at `../litro-router`. This tells `tsc` about the build dependency so it can resolve types from the compiled output. All build steps (CI, smoke test scripts) must build `litro-router` before `litro`.

**No consumer-facing API change**: All public types (`Route`, `LitroLocation`) and the `LitroRouter` class are re-exported from `litro/runtime` unchanged, so existing Litro app code requires no modification.

---

## Recipe system: physical template files over inline strings

**Decision**: Replace all hardcoded inline template strings in `create-litro/src/index.ts` with physical files in `recipes/<name>/template/`. The `scaffold()` function copies files from `template/` to the target directory, applying `{{placeholder}}` interpolation to text files.

**Rationale**: Inline strings are uneditable in any IDE (no syntax highlighting, no linting, no formatting), hard to maintain as templates grow, and impossible to test by running the template files themselves. Physical files live at proper paths and can be linted, formatted, and type-checked if desired.

**tsconfig rootDir change**: `create-litro/tsconfig.json` sets `rootDir: "."` (not `"./src"`) so both `src/` and `recipes/**/*.ts` compile into `dist/`. Template `.ts` files (page components, config files) are excluded from compilation via `"exclude": ["recipes/**/template/**"]` — they are user-facing source, not build tooling.

**Build script**: `tsc -p tsconfig.json && cp -r recipes dist/` — the `cp` copies all non-TS template files (Markdown, JSON, `.gitignore`, etc.) that `tsc` would not emit.

---

## `litro:content` virtual module: Nitro alias + physical stub (not `nitro.options.virtual`)

**Decision**: Resolve `litro:content` in Nitro/Rollup via `nitro.options.alias['litro:content'] = stubPath` (pointing at a generated physical JS file), not via `nitro.options.virtual`.

**Rationale**: `nitro.options.virtual` only handles `#`-prefixed module IDs. The `litro:content` ID does not start with `#`, so Nitro's virtual plugin would not intercept it. Rollup's `@rollup/plugin-node-resolve` handles bare string IDs; the `alias` option is the correct Rollup-level hook for mapping a bare specifier to a physical file path.

The physical stub (`server/stubs/litro-content.js`) is generated at build time by the content plugin and contains a real `ContentIndex` instantiation rather than a type stub, so it works correctly when Rollup bundles it into the server output.

---

## Content plugin registers `__litroContentStub` on `nitro.options` for SSG plugin

**Decision**: The Nitro content plugin stores the stub path as `nitro.options.__litroContentStub`. The SSG plugin reads this and passes it to jiti's `alias` option.

**Rationale**: The SSG plugin imports page TypeScript files via jiti to call `generateRoutes()`. Page files in the `11ty-blog` recipe import `litro:content` inside `generateRoutes()`. Without the alias, jiti cannot resolve the import and throws `Cannot find module 'litro:content'`. Passing the stub path through `nitro.options` avoids tight coupling between the two plugins (the SSG plugin doesn't need to know how the content plugin generates the stub).

---

## `litro.recipe.json` written to scaffolded project root

**Decision**: The `11ty-blog` recipe template includes a `litro.recipe.json` file with `{ "recipe": "...", "mode": "{{mode}}", "contentDir": "content/blog" }`. This file is interpolated during scaffolding and written to the project root.

**Rationale**: The Nitro content plugin (`content/plugin.ts`) reads `litro.recipe.json` to find `contentDir`. Without this file the plugin falls back to `content/blog` (the same default), but the explicit file makes the configuration visible, auditable, and overridable without touching `nitro.config.ts`. It also carries the recipe name and version, which enables future tooling (upgrades, migrations).

---

## Content layer: eager `build()` at server startup

**Decision**: The generated `litro-content.js` stub calls `_index.build()` immediately at module eval time and caches the resulting Promise as `_ready`. All exported functions (`getPosts`, `getPost`, etc.) `await _ready` before delegating.

**Rationale**: Without eager initialization, the first request after a cold start triggers the full content scan synchronously, adding latency visible to the first user. With eager initialization, `build()` starts in the background as soon as the server module loads. By the time the first request arrives (typically tens to hundreds of milliseconds later), the index is already warm.

---

## Remove global `<a>` click interceptor from `LitroRouter`

**Decision**: Remove the `_interceptClicks` method (and its `document.addEventListener('click', ...)` registration) from `LitroRouter`. Plain `<a>` tags now perform full page reloads as the browser intends. `<litro-link>` is the explicit, opt-in SPA navigation mechanism.

**Rationale**:

1. **Correctness for SSG**: When a user navigates between pages in an SSG site via a SPA route change, the router mounts the new page component client-side without a server round-trip. The `__litro_data__` script tag injected by the static renderer is page-specific — it remains in the DOM from the initial load. On SPA navigation to a second page, `getServerData()` reads the stale script tag (belonging to the first page) or returns `null` if the tag was already consumed, causing `serverData` to be `null` or wrong and the page to show "Loading…" indefinitely.
2. **Browser default is correct**: Full page reloads for `<a>` navigation are the standard web model. Intercepting all clicks globally is a pattern from single-page apps with client-side-only data — it does not fit a server-rendered framework where each page has server-injected data.
3. **Explicit opt-in is cleaner**: `<litro-link>` makes SPA navigation a deliberate authoring choice rather than a global side effect. This avoids surprising behaviour (e.g. external links being accidentally intercepted, or anchor-fragment navigation being swallowed).
4. **Removes 6 tests that were testing interceptor-specific behaviour** — total litro-router test count drops from 20 to 14. The remaining 14 tests cover route resolution, param extraction, catch-all matching, `onBeforeEnter` lifecycle, `action()` ordering, and programmatic `LitroRouter.go()`.

---

## SSG navigation fix: replace `<litro-link>` with `<a>` in `playground-11ty` pages

**Decision**: Update `playground-11ty/pages/index.ts` and `playground-11ty/pages/blog/[slug].ts` to use plain `<a>` tags for all page-to-page navigation links instead of `<litro-link>`.

**Rationale**: The `playground-11ty` app uses the `11ty-blog` recipe in SSG mode. Each page's server data (post list, individual post body) is injected by the static renderer into a `__litro_data__` script tag. If navigation between pages were handled client-side by `LitroRouter` (via `<litro-link>`), the router would mount the new page component without a server round-trip — but the `__litro_data__` tag is from the original page, causing `serverData = null` on the new page and a "Loading…" display that never resolves.

Plain `<a>` links cause a full browser navigation, loading the pre-rendered HTML for the destination page. That HTML contains the correct `__litro_data__` for that page, so `serverData` is populated correctly on every load. This is the correct navigation model for SSG sites.

---

## `create-litro` fullstack recipe: `base: '/_litro/'` required in `vite.config.ts`

**Decision**: Add `base: '/_litro/'` and `resolve.conditions` to the fullstack recipe's `vite.config.ts`, matching the playground and `11ty-blog` recipe.

**Rationale**: Vite embeds the `base` URL into its compiled preload URL resolver at build time:

```js
const Ft = function(i) { return "/_litro/" + i }
```

Without `base: '/_litro/'`, Vite uses `"/"` and all `<link rel="modulepreload">` hints for dynamic import chunks resolve to `/assets/...` instead of `/_litro/assets/...`. The Nitro catch-all route handler matches those paths and returns HTML, causing the browser to reject the response with:

> Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html".

**Symptom**: Dynamic routes (e.g. `/blog/hello-world`) show "Loading…" indefinitely and the JS console shows the MIME type error. Two network requests are visible for the slug path — one HTML page response and one failed module preload.

**Also fixed**: `pages/blog/[slug].ts` in the fullstack recipe was extending `LitElement` directly instead of `LitroPage`. Without `LitroPage`, client-side SPA navigation to a different slug does not call `fetchData()`, so `serverData` is never updated after the initial load.

---

## LitroOutlet: plain getter/setter for `routes`, not a Lit reactive property

**Decision**: Replace `@property({ type: Array }) routes: Route[] = []` with a plain getter/setter on `LitroOutlet` that calls `router.setRoutes()` directly when the router is already initialised. The property is NOT declared as a Lit reactive property.

**Rationale**:

The timing sequence when `app.ts` loads:
1. Importing `LitroOutlet.js` calls `customElements.define()`, which immediately upgrades the SSR'd `<litro-outlet>` element already in the DOM
2. Lit schedules the first update as a **microtask**
3. `app.ts` registers a `DOMContentLoaded` listener (a macrotask)
4. The microtask fires → `firstUpdated()` runs with `routes = []` → router initialised with no routes
5. `DOMContentLoaded` fires → `outlet.routes = routes` — but the router never receives them

The `updated()` lifecycle hook was considered but rejected: Lit's `createProperty()` installs an accessor that calls `requestUpdate()`, scheduling a render cycle. `firstUpdated()` removes all children (including Lit's internal ChildPart marker nodes) so the router owns the subtree. Any subsequent Lit render cycle crashes with "ChildPart has no parentNode".

A plain getter/setter fixes both problems without touching Lit's render pipeline: the setter forwards route changes directly to the router if it exists, with no `requestUpdate()` call. Since `LitroOutlet` has no render output and routes are never set via HTML attribute, Lit's reactive property system is not needed.

**Also fixed**: `app.ts` (in the fullstack recipe template and in `playground/`) updated to set `outlet.routes` synchronously after imports, before any async task boundary. Module scripts are deferred by the browser, so by the time they execute the DOM is fully parsed and `<litro-outlet>` is present. Setting routes synchronously ensures `firstUpdated()` sees the real route table before the first Lit update microtask fires.

---

## Release pipeline: Changesets + GitHub Actions

**Decision**: Use [Changesets](https://github.com/changesets/changesets) (`@changesets/cli`) for version management, changelog generation, and automated npm publishing via `changesets/action` in GitHub Actions.

**Rationale**:

1. **Monorepo-native**: Changesets is designed for pnpm/npm workspaces with multiple independent packages. It handles per-package version bumps and per-package `CHANGELOG.md` generation without coupling packages together.
2. **Internal dep cascade**: `updateInternalDependencies: "patch"` in `.changeset/config.json` ensures that when `litro-router` is bumped, `litro` (which depends on it via `workspace:*`) automatically gets a patch bump — consumers always get a consistent set of packages.
3. **PR-based release flow**: The `changesets/action` GitHub Action opens a "Version Packages" PR when changesets are pending, giving maintainers a human review point before any publish. Merging that PR triggers the actual npm publish and GitHub Release creation.
4. **Explicit changelog authorship**: Contributors write changeset summaries at PR time rather than relying on commit message parsing. This produces more readable changelogs than automated commit-scraping tools (e.g. semantic-release).
5. **GitHub Releases**: `createGithubReleases: true` in the action config automatically creates a tagged GitHub Release per package publish, using the changelog content as release notes.

**Configuration**:
- `.changeset/config.json` — `access: "public"`, `baseBranch: "main"`, `linked: []` (packages version independently)
- `.github/workflows/release.yml` — triggers on push to `main`; requires `NPM_TOKEN` secret
- Root `package.json` scripts: `changeset`, `version-packages`, `release`

---

## LitroRouter: hash-only `popstate` guard and shadow-DOM scroll-to-hash

**Decision**: `LitroRouter` skips re-rendering when only the hash changes on `popstate`, and actively scrolls to hash targets after mounting a new component.

**Rationale**:

The HTML spec fires `popstate` on every history navigation, including fragment-only changes (e.g. `<a href="#section">`). Before this change, TOC links that pushed a hash update via `history.pushState` would fire `popstate` → the router would re-render the current page → `getServerData()` would return `null` (the `<script type="application/json" id="__litro_data__">` tag was already consumed on first render) → `serverData = null` → the page displayed "Loading…".

**Fix — hash guard**: `LitroRouter` tracks `_lastPathname`. The `popstate` listener skips `_resolve()` when `location.pathname === this._lastPathname`. This preserves SPA behaviour for pathname changes while leaving hash-only navigations to the browser.

**Fix — scroll-to-hash**: After mounting a new component, if `location.hash` is set, `LitroRouter` waits for the component's `updateComplete` promise (if available) then calls `_scrollToHash()`. This handles the case where the page is loaded or navigated to with a hash in the URL.

**Fix — shadow DOM traversal**: Heading elements rendered via `unsafeHTML` inside Lit shadow roots are not reachable by `document.getElementById()` or the browser's native fragment scrolling. `_findDeep(root, id)` recursively walks shadow roots via `el.shadowRoot` to find the target element. The same approach is used in `<starlight-toc>` for its click handler.

**`<starlight-toc>` click handler**: TOC anchor clicks call `e.preventDefault()`, find the target via `_findDeep`, scroll to it smoothly, and push the hash via `history.pushState` (which does NOT fire `popstate`). This avoids re-rendering entirely.

---

## `litro preview` static file server for SSG builds

**Decision**: `litro preview` detects `dist/static/` and serves it with a built-in Node.js HTTP server. If `dist/static/` is absent, it falls back to running `dist/server/server/index.mjs` (SSR build).

**Rationale**: Nitro's SSG preset outputs prerendered HTML to `dist/static/` (not `dist/server/`). The previous `preview` command only handled SSR builds (`dist/server/server/index.mjs`), so `litro preview` after an SSG build exited with "No production build found". Adding a static branch makes `litro preview` work for both build modes without requiring users to know which preset was used.

The static server implements clean-URL resolution (tries `path`, `path.html`, `path/index.html` in order) and a MIME type map for common web asset types, matching the behaviour of most static hosting platforms.

---

## `routeMeta.head` forwarding in `createPageHandler`

**Decision**: Both `buildShell()` calls in `createPageHandler` (main SSR path and client-only fallback) must explicitly forward `head: routeMeta?.head`.

**Rationale**: `buildShell()` accepts a `head` option for injecting arbitrary HTML into `<head>` — used by the starlight recipe to inject `<link rel="stylesheet" href="/styles/starlight.css">` and the FOUC-prevention inline `<script>`. The original implementation omitted `head` from both `buildShell()` calls, so the stylesheet and theme script were silently dropped from all SSR'd pages. The server route handler (`server/routes/[...].ts`) must also read `routeMeta` from `pageModules[matched.filePath]` and pass it to `createPageHandler`.
