# Litro — Decision Log

Running log of architectural and implementation decisions. All agents append here.

---

## Single-port dev server via Nitro middleware

Inject Vite as middleware into Nitro's dev server (`server.middlewareMode: true` + `fromNodeMiddleware()`) rather than running two separate processes. Avoids cross-origin issues and simplifies DX to one port, one process. The middleware file uses `ignore` + `handlers[env:'dev']` for production exclusion so `import('vite')` never enters the production module graph (745 kB vs 5.29 MB).

---

## Virtual module for page manifest

Use a single `#litro/page-manifest` virtual module with a catch-all handler rather than registering individual Nitro routes per page. Nitro's route registry is locked at build time and per-page routes cause problems on hot-reload. A physical stub fallback (`server/stubs/page-manifest.ts`) is written alongside the virtual module because `@rollup/plugin-node-resolve` intercepts `#` imports before Nitro's virtual plugin when the virtual module is not set.

Page `.ts` files are statically imported in the manifest so Rollup's esbuild plugin compiles them at build time (Node ESM cannot import `.ts` at runtime). A `pageModules` registry is exported for synchronous lookup of `pageData` exports by `createPageHandler`.

---

## `publicAssets` over `publicDir`

Use `publicAssets` array in `nitro.config.ts` to serve the Vite client bundle. `publicDir` is silently ignored by Cloudflare Workers and Vercel Edge adapters. Paths must be relative to `srcDir` (not `rootDir`) — with `srcDir = 'server'`, use `'../dist/client'` not `'dist/client'`.

---

## Nitro 2.10 hook names and plugin calling convention

Use `'build:before'` and `'dev:reload'` (not `'nitro:build:before'` / `'nitro:dev:reload'`). `'nitro:init'` does not fire from `createNitro()` in Nitro 2.10. Build-time plugins must be directly awaited from `hooks['build:before']` — registering a nested `build:before` sub-hook inside a plugin is too late since the event already fired.

---

## esbuild decorator configuration for Lit

Set `experimentalDecorators: true` and `useDefineForClassFields: false` in Nitro's `esbuild.options.tsconfigRaw`. Without this, Nitro's esbuild applies TC39 Stage 3 decorator transform, which is incompatible with Lit's legacy experimental decorators.

---

## `static override properties` instead of `@property()` / `@state()` decorators

Vite 5 / esbuild 0.21+ uses TC39 Stage 3 decorators for client bundles. `@property()` on plain fields is silently dropped; `accessor` fields crash Lit's `init`. `@state() declare` breaks jiti's oxc-transform. The safe pattern is `static override properties = { ... }` plus plain field initializers, which works under both legacy and TC39 transforms. For narrowing inherited `serverData` types, use a local cast in `render()` instead of redeclaring the field.

---

## LitroLink: text-only style inheritance

`LitroLink`'s inner shadow `<a>` inherits only text properties (`color`, `text-decoration`, `font`, `cursor`). Box-model properties (padding, display, border-radius) must not be inherited — doing so creates a visible double anchor point when the host is styled as a button.

---

## `unsafeStatic` for dynamic component tag rendering

Use `unsafeStatic` from `lit/static-html.js` for dynamic tag names in Lit templates. Plain expression interpolation in element position is an invalid Lit template expression and causes `@lit-labs/ssr` to throw.

---

## Replaced `@vaadin/router` with `LitroRouter`

Remove deprecated `@vaadin/router`. Replace with a built-in router (`packages/litro-router/`) built on the native URLPattern API. All consumer-facing APIs are preserved. The router is extracted into its own workspace package for independent versioning and use outside the Litro framework. Path format conversion (`h3ToURLPattern()`) happens at `setRoutes()` time — the rest of the codebase uses h3 format unchanged.

---

## Remove global `<a>` click interceptor

`LitroRouter` no longer intercepts plain `<a>` clicks. Plain anchors do full page reloads (browser default); `<litro-link>` is the explicit opt-in for SPA navigation. This is essential for SSG correctness — SPA navigation would show stale `__litro_data__` from the initial page load.

---

## LitroOutlet: plain getter/setter, not a Lit reactive property

`routes` uses a plain getter/setter that forwards to `router.setRoutes()` directly. Lit's reactive property system causes problems: `requestUpdate()` triggers render cycles that crash after `firstUpdated()` removes Lit's internal marker nodes. Routes are set synchronously in `app.ts` after imports (module scripts are deferred, so DOM is ready).

---

## LitroRouter: hash guard, scroll-to-top, and shadow DOM scroll-to-hash

The `popstate` listener skips re-rendering when only the hash changes (`_lastPathname` guard), preventing TOC links from wiping `serverData`. After SPA page swap, `scrollTo(0, 0)` resets scroll position unless a hash fragment is present, in which case `_scrollToHash()` uses `_findDeep()` to traverse shadow roots and find the target heading.

---

## `litro:content` virtual module via Nitro alias

Resolve `litro:content` via `nitro.options.alias` (not `nitro.options.virtual`, which only handles `#`-prefixed IDs). The generated physical stub (`server/stubs/litro-content.js`) calls `build()` eagerly at module eval time so the content index is warm before the first request. An absolute path fallback handles production builds where Rollup moves chunks to different filesystem paths.

---

## `litro.recipe.json` for content plugin configuration

Scaffolded projects include `litro.recipe.json` with recipe name, mode, and `contentDir`. The content plugin reads this file; an explicit config file makes the configuration visible and overridable without touching `nitro.config.ts`.

---

## Recipe system: physical template files over inline strings

Replace hardcoded inline template strings with physical files in `recipes/<name>/template/`. Physical files get IDE syntax highlighting, linting, and formatting. `{{placeholder}}` interpolation is applied during scaffolding.

---

## Release pipeline: Changesets + GitHub Actions

Use Changesets for version management, per-package changelog generation, and automated npm publishing. `updateInternalDependencies: "patch"` cascades bumps through workspace dependencies. The `changesets/action` opens a "Version Packages" PR for human review before any publish.

---

## `create-litro` fullstack recipe: `base: '/_litro/'` in Vite config

Without `base: '/_litro/'`, Vite embeds `"/"` into its preload URL resolver. Dynamic import chunks resolve to `/assets/...` instead of `/_litro/assets/...`, causing the Nitro catch-all to return HTML and the browser to reject it with a MIME type error.

---

## `routeMeta.head` forwarding in `createPageHandler`

Both `buildShell()` calls must forward `head: routeMeta?.head`. Without it, recipe-injected `<link>` tags (stylesheets) and FOUC-prevention scripts are silently dropped from SSR output.

---

## Playwright e2e test suite

Single root `e2e/` directory with per-playground subdirectories. Port assignments: playground=3030, playground-11ty=3031, playground-starlight=3032, docs=3033, docs-ssr=3034. Shadow DOM caveat: `locator.textContent()` does not include shadow root children — use `evaluate(el => el.shadowRoot?.textContent)`.

---

## Rename starlight UI primitives from `sl-*` to `litro-*`

Shoelace registers custom elements under `sl-*`. Having our own `sl-card`/`sl-badge` throws `NotSupportedError: already registered`. Renamed to `litro-card`, `litro-badge`, etc. Layout components (`starlight-page`, `starlight-header`) keep their names.

---

## Shoelace integration

Add `@shoelace-style/shoelace` to starlight recipe and docs site. Imports are client-only (`app.ts`), so unknown `<sl-*>` elements are empty passthroughs during SSR. Icon assets at `/shoelace/assets/` use 1-week cache without `immutable` (stable filenames change on package upgrade; `immutable` would serve stale icons).

---

## `LITRO_BASE_PATH` for sub-path deployments

`create-page-handler.ts` prepends `process.env.LITRO_BASE_PATH` to `/_litro/app.js`. Used for GitHub Pages (`/litro/` sub-path). Switching to a root-path domain is a one-line env removal.

---

## `docs/` workspace: official documentation site

Added as a workspace member scaffolded from the starlight recipe. References framework packages via `workspace:*` so docs stay in sync without publishing. Builds to `dist/static/` as SSG.

---

## Recipe CSS: `:not(:defined)` FOUC prevention

Every recipe global stylesheet must include `:not(:defined) { visibility: hidden }`. Keeps unregistered custom elements invisible until definitions load, eliminating the flash. Uses `visibility: hidden` (not `display: none`) to preserve layout space.

---

## Packages pages: changelog rendering from source

`/docs/packages/{litro,litro-router,create-litro}` pages read `README.md` and `CHANGELOG.md` at SSG build time via a server-only utility. A Vite browser stub intercepts the import client-side. Custom element names must match `fileToComponentTag` output (e.g. `page-docs-packages-pkg`).

---

## SEO: `seoHead` / `seoTitle` injection via `pageData`

Pages return `seoHead` (HTML meta tags + JSON-LD) and `seoTitle` from `definePageData()`. `create-page-handler.ts` extracts these and injects into the real `<head>`, then strips them from the JSON before serializing to `__litro_data__` (prevents `</script>` injection).

---

## SEO: Dedicated Nitro server routes for XML feeds

`sitemap.xml` and `blog/rss.xml` are Nitro server routes (not Lit pages) so they can set `content-type: application/xml` and return raw XML. The catch-all handler would wrap them in an HTML shell.

---

## `docs-ssr/` uses `<litro-link>` for SPA navigation

Unlike SSG, SSR always produces fresh HTML with correct `__litro_data__`, so SPA navigation is safe. Shared layout components accept a `spaNav` boolean prop so the same component works in both SSG (full reloads) and SSR (SPA transitions) contexts.

---

## `ssrPreset()` required for SSR production builds

`nitro.config.ts` must spread `...ssrPreset()` to set `output.dir = 'dist/server'`. Without it, `litro preview` cannot find the production entry.

---

## `?hidden` over structural ternaries for SSR hydration safety

Use `?hidden=${!condition}` instead of `${condition ? html\`<el>\` : ''}`. Structural ternaries produce different value types at the same template position, causing hydration mismatches when server and client evaluate different branches.

---

## Search modal: pure UI component + consumer glue

The search modal dispatches events with zero fetch logic. The consumer (`app.ts`) wires fetch, debounce, and SPA navigation. Stale results stay visible (dimmed at 0.6 opacity) during new searches rather than flashing "Searching...". Escape requires two presses when input has content (browser-native `<input type="search">` behavior, accepted as standard).

---

## Skip links: array API + shadow DOM traversal

Replace `skipNav`/`skipSearch` boolean flags with `skipLinks?: SkipLink[]` array and `DEFAULT_SKIP_LINKS`. The framework provides generic shadow DOM traversal for focus and MutationObserver-based visibility toggling. Recipe-specific actions (e.g. opening search modal) are handled in the site's `app.ts` via capture-phase click listeners.

---

## A11y: SPA focus management and screen reader announcements

After each SPA page swap, `LitroRouter` focuses the outlet (`tabindex="-1"`, `preventScroll`) and announces the new page title via an `aria-live="polite"` region. Without this, keyboard users lose focus position and screen reader users hear nothing on SPA navigation.

---

## A11y: sidebar `inert` when closed on mobile

Add `?inert` to the sidebar `<aside>` when it is off-screen in drawer mode. Without `inert`, keyboard users tab through invisible sidebar links. A `matchMedia` listener ensures `inert` is only applied at narrow viewports.

---

## A11y: `litro-tabs` WAI-ARIA Tabs Pattern

Full WAI-ARIA implementation: roving tabindex, `aria-controls`/`aria-labelledby` linking, arrow key navigation (Left/Right, Home/End), `role="tabpanel"` on panels. Without ARIA, screen readers cannot navigate between tabs and panels.

---

## `litro preview` static file server for SSG builds

Detects `dist/static/` and serves with a built-in Node.js HTTP server. Falls back to `dist/server/server/index.mjs` for SSR. Implements clean-URL resolution (`path`, `path.html`, `path/index.html`).

---

## docs-ssr Docker: Node.js runtime with trimmed workspace

Uses `node:20-slim` runtime (not nginx) since `docs-ssr/` is a live Nitro SSR server. The Dockerfile generates a minimal `pnpm-workspace.yaml` excluding playgrounds and benchmarks to keep Docker context small, and creates a stub `playground/tsconfig.json` to satisfy root `tsconfig.json` project references during Vite's esbuild pass.

---

## Framework adapter: per-project, not per-page

The adapter is selected once per project (via `--adapter` flag or `LITRO_ADAPTER` env var), not per page. Per-page mixing was considered and deferred: it would require running multiple SSR engines in the same process, merging incompatible head scripts, and handling hydration for mixed shadow/light DOM trees. The complexity is not justified by current use cases. A single adapter per project keeps the build pipeline simple and the mental model clear.

---

## Framework adapter: native classes, no abstraction layer

Each adapter's page components extend the framework's own base class (LitElement, FASTElement, Elena mixin) — Litro does not define a neutral component authoring API or template IR. Users write native framework code. This avoids a lowest-common-denominator API that would limit access to framework-specific features (Lit's directives, FAST's design system integration, Elena's progressive enhancement).

---

## Elena adapter: light DOM SSR without @elenajs/ssr

The Elena adapter renders components by direct instantiation (`new ComponentClass()`, `instance.render()`, `.toString()`) rather than using `@elenajs/ssr`. This approach is simpler (no external SSR dependency), produces smaller server bundles, and handles nested component expansion via a lightweight recursive CE expander. The trade-off is that components must be SSR-safe (no `document`/`window` access at render time), which is already a requirement for Lit/FAST.

---

## Elena adapter: @scope CSS instead of Shadow DOM

Elena uses light DOM, so component styles are not automatically scoped. The `@scope` CSS at-rule provides encapsulation without Shadow DOM: `@scope (my-component) { ... }`. This is supported in Chrome 118+, Edge 118+, Safari 17.4+. Older browsers see unscoped styles, which is acceptable graceful degradation for content-focused sites — the primary Elena use case.
