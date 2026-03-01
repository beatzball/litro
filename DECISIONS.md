# Litro — Decision Log

This file records architecture and implementation decisions made by each agent.
All agents append their decisions here. Entries are ordered by agent ID.

---

## I-1: Monorepo Scaffold

**Date:** 2026-02-28
**Agent:** I-1

- **Single dev server port via Vite middlewareMode + fromNodeMiddleware** — avoids CORS, avoids port coordination complexity, and matches the proven pattern used by Nuxt. Vite runs as a connect middleware injected into Nitro's devHandlers array.
- **publicAssets over publicDir** — `publicDir` is silently ignored by edge adapters (Cloudflare Workers, Vercel Edge). `publicAssets` is the only path that works across all Nitro deployment targets.
- **Virtual module `#litro/page-manifest` for page routing** — avoids dynamic Nitro route registration at dev-reload time (Nitro's route registry is locked at build time). A single catch-all handler reads the manifest; I-2 writes it.
- **pnpm workspaces** — sufficient scale for MVP; Turborepo is not needed. The repo has three packages (`framework`, `create-litro`, `playground`) with no deep build dependency graph that would benefit from task caching at this stage.
- **`externals.inline` for `@lit-labs/ssr` and `@lit-labs/ssr-client`** — forces bundling into the server output so edge runtimes (no `node_modules` at runtime) can resolve these imports.
- **`useDefineForClassFields: false` in tsconfig** — required for Lit decorators (`@customElement`, `@property`) to work correctly. With `useDefineForClassFields: true`, TypeScript emits class field initializers that shadow the prototype properties set by decorators.
- **`experimentalDecorators: true` in tsconfig** — required for the Stage 2 decorator syntax used by Lit (`@customElement`, `@property`, `@state`, etc.).

---

## I-4: Client Hydration Bootstrap + @vaadin/router Integration

**Date:** 2026-02-28
**Agent:** I-4

- **`@lit-labs/ssr-client/lit-element-hydrate-support.js` must be first import** — This patches `LitElement.prototype.createRenderRoot()` before any LitElement subclass is evaluated. If any Lit component module is imported first, the patch arrives too late and hydration silently falls back to a full client re-render, causing a flash of unstyled content. Enforced in both `packages/framework/src/runtime/client.ts` and `playground/app.ts`.

- **`<litro-outlet>` uses light DOM** — `createRenderRoot()` returns `this` instead of attaching a shadow root. `@vaadin/router` uses `appendChild()` to inject page components into the outlet. Shadow DOM would isolate those children inside a shadow root, breaking CSS inheritance and document-level layout. Light DOM keeps the router's subtree in the normal document tree where global styles apply.

- **No `render()` method on `LitroOutlet`** — Lit's reconciler only manages DOM nodes it created via its template renderer. By defining no `render()` method, LitroOutlet never creates any template content, so Lit never reconciles the element's children. `@vaadin/router` can freely append/replace children without Lit clobbering them on re-render.

- **Router mounted in `firstUpdated()`** — `constructor()` fires before the element is in the DOM; `connectedCallback()` can fire before `firstUpdated()` in some upgrade scenarios. `firstUpdated()` is the correct hook because it fires after the first render cycle, guaranteeing the outlet element is attached to the document and ready for `new Router(outlet)`.

- **`initRouter(routes)` helper exported** — Provides a programmatic bootstrap path for app.ts files that do not use a Lit root wrapper. It defers until DOMContentLoaded if needed and finds the first `<litro-outlet>` by tag name.

- **`<litro-link>` intercepts only same-origin, left-click, no-modifier clicks** — Modifier keys (Cmd, Ctrl, Shift, Alt) and non-absolute hrefs (external URLs, `mailto:`, etc.) are passed through to the browser. `target` attribute set to any value also bypasses interception. This matches the standard SPA link-click interception contract.

- **`<litro-link>` keeps shadow DOM** — Unlike the outlet, the link's inner `<a>` is internal implementation. Shadow DOM provides encapsulation; consumers can style via CSS custom properties. The `rel` attribute is passed through for `noopener noreferrer` use with `target="_blank"`.

- **`@vaadin/router` not imported in any server path** — `@vaadin/router` accesses `window` at module evaluation time. All runtime files (`LitroOutlet.ts`, `LitroLink.ts`, `client.ts`, `index.ts`) are client-only. The framework package.json `./runtime` export path documents this boundary; SSR code (I-3) must never import from `litro/runtime`.

- **`playground/dist/client/routes.generated.ts` stub** — Created so `playground/app.ts` can import routes without a prior build step. I-2's page scanner will overwrite this file on every build. Using `.ts` extension (not `.js`) here because the playground uses Vite which transpiles TypeScript source directly; the import in app.ts uses the `.js` extension as required by Node ESM conventions.

- **`./runtime/*` wildcard export added to framework package.json** — Allows consumers to import individual runtime modules directly (e.g., `litro/runtime/LitroOutlet.js`) without going through the barrel. This supports tree-shaking and avoids importing `@vaadin/router` via the barrel in contexts where only one element is needed.

---

## I-3: SSR Pipeline

**Date:** 2026-02-28
**Agent:** I-3

- **`ssr.ts` as the single `@lit-labs/ssr` import boundary** — all SSR rendering is funneled through `packages/framework/src/runtime/ssr.ts`. No other file imports from `@lit-labs/ssr`. This isolates the dependency for easy mocking in tests and safe future API migration.

- **`renderToStream()` wraps `render()` from `@lit-labs/ssr`** — returns the `AsyncIterable<string>` directly. The function signature accepts a `TemplateResult` from `lit` (not `@lit-labs/ssr`), keeping the public API decoupled from the SSR internals.

- **Shell split into `head` and `foot`** — `buildShell()` in `shell.ts` returns two strings rather than one. This allows `create-page-handler.ts` to write `head` synchronously, stream SSR output asynchronously between them, then write `foot` synchronously. If the function returned a single string with a placeholder, string interpolation would require buffering the entire SSR output first, defeating streaming.

- **`PassThrough` + `RenderResultReadable` for streaming** — H3's `sendStream()` accepts a Node.js `Readable`. `RenderResultReadable` wraps the async generator. A `PassThrough` combines the three parts (head string, SSR Readable, foot string) into one stream without an extra intermediate buffer. `ssrReadable.pipe(combined, { end: false })` is used so we can write the foot and manually call `combined.end()` after the SSR stream finishes.

- **Dynamic import for component registration** — `await import(route.filePath)` is called at request time inside `createPageHandler`. The `@customElement` decorator calls `customElements.define()` as a side effect of module evaluation, registering the element with the server-side registry. This must happen before `render()` is called; a static top-level import would not work because the component file path varies per route.

- **SSR error boundary returns client-only shell (no 500)** — if `import()` or `render()` throws, the handler logs a `console.warn` and returns the shell HTML with a bare component tag. Lit renders the component client-side. This prevents a broken SSR component from taking down the page entirely in production; the visible degradation is a brief flash of unstyled content rather than an error page.

- **`RenderResultReadable` is Node.js-only; edge adapter work deferred** — `RenderResultReadable` extends `stream.Readable` which is not available in Cloudflare Workers or Vercel Edge. For edge support the SSR `AsyncIterable<string>` must be converted to a Web `ReadableStream` manually. This is documented in a comment in `create-page-handler.ts` and deferred to the Cloudflare adapter work.

- **DSD polyfill is a synchronous inline `<script>` (not `type="module"`)** — the polyfill must run as the HTML parser encounters `<template shadowrootmode>` elements. `type="module"` scripts are deferred until after parsing, making them too late. The plain inline script runs synchronously and sees the DSD templates before the browser's parser would otherwise skip them.

- **Hydration script path `/_litro/lit-element-hydrate-support.js`** — matches the `baseURL: '/_litro/'` in `nitro.config.ts` `publicAssets`. Vite must output `lit-element-hydrate-support.js` under `dist/client/` (done by I-4's client bundle). If the base URL changes in `nitro.config.ts`, `shell.ts` must be updated to match.

- **Catch-all handler maps `PageEntry` fields to `LitroRoute` fields inline** — the `#litro/page-manifest` stub (from I-2) uses `route` and `component` field names; `LitroRoute` (from `types/route.ts`, also authored by I-2) uses `path` and `componentTag`. The mapping is done in the catch-all handler rather than changing either type, to avoid breaking I-2's type contract.

---

## I-2: Page Scanner + Route Generator

**Date:** 2026-02-28
**Agent:** I-2

- **Pure path-conversion functions in a separate module** — `path-to-route.ts` contains only pure string→LitroRoute transformations with no Nitro or Node.js dependencies. This makes the conversion logic independently testable with Vitest without spinning up any server infrastructure.

- **`nitro.options.virtual['#litro/page-manifest']` for the virtual module** — rather than using `nitro.config.ts`'s static `alias` key (which points to a file on disk), the plugin sets the virtual module at `nitro:build:before` hook time by writing directly to `nitro.options.virtual`. This is the only way to make the module content dynamic (re-generated from the current `pages/` state on every build and every dev reload).

- **Both named and default export in the virtual module** — the generated `#litro/page-manifest` module exports `routes` as a named export (`export const routes`) AND as a default export (`export default routes`). This supports both `import { routes } from '#litro/page-manifest'` and `import pages from '#litro/page-manifest'` at no extra cost, providing forward compatibility with any existing or future import style in the catch-all handler.

- **Pre-sorted route array (static → dynamic → catch-all)** — routes are sorted by `compareRoutes()` before being written to the manifest. The catch-all handler can then use a simple linear scan and return the first match, knowing that the array priority order is always correct. This mirrors how Nitro/h3's own router resolves specificity.

- **Catch-all handler updated to use named `routes` import** — `playground/server/routes/[...].ts` now imports `{ routes }` from `#litro/page-manifest` and works directly with `LitroRoute` objects, eliminating the `PageEntry → LitroRoute` mapping that was a temporary shim. The handler's inline `matchRoute()` function converts route patterns (`:param`, `:param?`, `:param(.*)*`) to RegExp for dynamic matching.

- **Static routes added to `nitro.options.prerender.routes`** — all non-dynamic, non-catch-all page routes are pushed into the prerender list at `nitro:build:before`. This makes static pages available for `preset: 'static'` or `prerender: true` builds without any additional config. Dynamic routes require an explicit `generateRoutes()` export (I-6's responsibility).

- **`dist/client/routes.generated.ts` written at build time** — the client routes file for `@vaadin/router` is written during `nitro:build:before`. Writing it as a TypeScript source file (consumed by Vite, not Node.js) allows the `import()` paths to reference `.js` extensions that Vite resolves to `.ts` sources. The file's existence is non-critical in dev (Vite may not have built yet); write failures are caught and logged as warnings.

- **Removed the `alias` stub from `nitro.config.ts`** — the `alias: { '#litro/page-manifest': './server/stubs/page-manifest.ts' }` entry has been removed. The virtual module is now set dynamically by the plugin. The stub file (`server/stubs/page-manifest.ts`) is left on disk for reference but is no longer wired into Nitro's module resolution.

- **`vitest` added to `devDependencies`** — added `vitest ^2.1.8` and a `vitest.config.ts` to the framework package. The `test` and `test:watch` scripts invoke vitest. Tests in `src/**/*.test.ts` cover all path-conversion rules including static, dynamic, catch-all, optional, and nested routes, plus sorting invariants.

---

## I-5: Data Fetching Convention

**Date:** 2026-02-28
**Agent:** I-5

- **`definePageData` is server-only; `getServerData` is isomorphic** — `definePageData` references `H3Event` from 'h3', a server-only type. It must only be imported in page source files and consumed in the SSR handler. `getServerData` guards on `typeof document === 'undefined'` and is safe to call in any execution context. This split eliminates any risk of accidentally shipping server-only code to the browser.

- **Duck-type sentinel (`__litroPageData: true`) for detection** — the SSR handler detects a page's `pageData` export by checking `mod.pageData?.__litroPageData === true`. A boolean sentinel on a plain object is simpler and more portable than `instanceof` (no class registry, works across module boundaries, survives bundler transforms).

- **`pageData.fetcher` receives the H3Event** — the fetcher function gets the full H3 event, so it can read cookies, headers, route params, and query strings. This makes it equivalent in power to any Nitro API route handler, without inventing a new abstraction.

- **Data fetch failure is non-fatal** — if `pageData.fetcher(event)` throws, the handler logs a warning and renders the page without server data (`serverDataJson` is undefined). The client's `LitroPage.onBeforeEnter()` calls `fetchData()` as a fallback (since `getServerData()` returns null when no script tag is present). This keeps the error boundary consistent with the existing SSR fallback policy (I-3): prefer a degraded but functional page over a 500 error.

- **`buildShell()` called inside the `try` block** — moved `buildShell()` to after the `pageData.fetcher()` call so the resolved `serverDataJson` can be passed in one call. The catch block calls `buildShell()` again with no `serverDataJson`, producing a minimal fallback shell. The slight duplication is intentional: the fallback shell must not reference variables from the happy path, which may be in an undefined state.

- **`LitroPageMixin` mixin pattern for composability** — page authors who need multiple inheritance (e.g., combining LitroPage with a separate analytics mixin) can use `LitroPageMixin(Base)` instead of extending `LitroPage` directly. `LitroPage` is defined as `LitroPageMixin(LitElement)` — a zero-cost convenience alias.

- **`onBeforeEnter` checks `getServerData()` before calling `fetchData()`** — on first SSR load, `getServerData()` parses the script tag and removes it (so subsequent navigations cannot read stale data). If it returns non-null, `fetchData()` is never called. On client navigation, `getServerData()` returns null (script tag is gone) and `fetchData()` is called. This two-branch logic is the entire client-side data fetching protocol.

- **Script tag removed after first read** — `getServerData()` calls `el.remove()` after parsing the JSON. This prevents client-side navigations back to the same route from re-using stale SSR data that was intended only for the initial hydration.

- **`LitroPage` and `getServerData` added to both `litro` and `litro/runtime` exports** — `litro/runtime` is the client bundle barrel; `litro` is the full package entry (server + client). Page authors import `LitroPage` from `litro/runtime` (client-safe) and `definePageData` from `litro` (server-safe). `getServerData` is in both because it is isomorphic, but in practice it is only useful client-side.

- **Playground home page demonstrates the full round-trip** — `pages/index.ts` exports `pageData` (SSR fetch returns `{ message, timestamp }`) and extends `LitroPage` with a `fetchData()` override that hits `/api/hello`. The API route returns the same shape. This validates both paths (SSR inject → hydrate, and client navigate → fetch) in a single component.

---

## I-6: Static Site Generation (SSG) Mode

**Date:** 2026-02-28
**Agent:** I-6

- **`crawlLinks: true` is set but explicitly NOT relied upon for route discovery** — Nitro's `crawlLinks` option follows `<a href>` links found in already-prerendered HTML. It cannot discover routes that are configured in `@vaadin/router` at client-side runtime, because those are JavaScript expressions, not links in the prerendered output. All `@vaadin/router` page routes must be explicitly registered via `nitro.options.prerender.routes`. The pages plugin (I-2) handles static routes; the SSG plugin (I-6) handles dynamic routes via `generateRoutes()`. `crawlLinks: true` remains set as a safety net that catches any `<a>` links hardcoded in prerendered page HTML.

- **`generateRoutes(): Promise<string[]>` convention on dynamic page files** — each dynamic page file (`pages/**/*[param]*.ts`) may export this async function to enumerate concrete URL paths for SSG prerendering. The `litro:ssg` build-time plugin calls it at `nitro:build:before` and appends the returned paths to `nitro.options.prerender.routes`. The function is async to allow CMS/database lookups during the build.

- **Missing `generateRoutes` is a `console.warn`, not a build error** — consistent with `failOnError: false`. A dynamic page without `generateRoutes` is skipped during SSG with a descriptive warning. This prevents a single missing export from failing an entire CI build. Page authors can opt into strict mode via `failOnError: true` in their `ssgPreset()` call if they want hard failures.

- **`ssgPlugin` is a separate plugin from `pagesPlugin`** — keeping them separate respects the single-responsibility principle and the dependency order. The pages plugin runs first (it populates static routes), then the SSG plugin appends dynamic routes. Both hook on `nitro:build:before`; hook registration order within a single `nitro.config.ts` `plugins` array is sequential, so order is deterministic.

- **`ssgPreset()` and `ssrPreset()` as factory functions, not constants** — returning a new object on each call avoids shared-reference mutations across multiple `defineNitroConfig` calls in tests or monorepo setups. Callers spread the result: `...ssgPreset()`. The `ssrPreset(preset)` function accepts a Nitro deployment preset name (e.g., `'cloudflare-pages'`, `'vercel-edge'`) so callers can switch deployment targets without changing the base config.

- **`LITRO_MODE` env var controls preset selection in `playground/nitro.config.ts`** — `LITRO_MODE=static` selects `ssgPreset()`; anything else (or absent) selects `ssrPreset()`. This follows the same pattern used by Next.js (`NEXT_OUTPUT=export`) and Nuxt (`NUXT_PUBLIC_...` / `nitro.preset`). The env var is read at config evaluation time (Node.js process startup), so it is available to both `nitro build` and `nitro dev`.

- **`autoSubfolderIndex: true` in `ssgPreset()`** — Nitro writes `/about` as `/about/index.html` so static hosts that serve directory indexes (Netlify, GitHub Pages, Apache, Nginx default config) resolve clean URLs without trailing slashes or explicit redirects.

- **Deduplication of `prerender.routes`** — both the pages plugin and the SSG plugin deduplicate before writing to `nitro.options.prerender.routes`. This prevents duplicate prerender fetches if the same route appears in both `generateRoutes()` and the static route list (e.g., if a page file accidentally matches both static and dynamic patterns).

- **`playground/pages/blog/[slug].ts` and `playground/pages/blog/index.ts` added** — these files demonstrate the SSG conventions in a working playground. `[slug].ts` exports both `pageData` (SSR data fetching, I-5) and `generateRoutes` (SSG path enumeration, I-6), showing that both conventions compose on a single page file. `index.ts` is a static route that needs no `generateRoutes`.

- **`./plugins/ssg` and `./config` export entries added to `package.json`** — consumers can import `ssgPlugin` from `litro/plugins/ssg` and `ssgPreset`/`ssrPreset` from `litro/config` without going through the main barrel. This is important for build-time config files (`nitro.config.ts`) that should not import client-side code from the main entry point.

---

## I-7: CLI + HMR + Error Overlay + create-litro

**Date:** 2026-02-28
**Agent:** I-7

- **Replaced `execa` usage in the CLI with `child_process.spawn`** — the existing CLI stub used `execa` for subprocess management. The spec requires Node.js built-ins only. `child_process.spawn` with `shell: true` and `stdio: 'inherit'` gives equivalent behaviour (stdout/stderr pass through, shell PATH resolution for `nitro`/`vite` binaries). `execa` remains in the package `dependencies` because other framework modules may use it; the CLI no longer adds a new usage of it.

- **`run()` returns `ChildProcess` to enable two-stage build chaining** — for `build` and `generate`, Vite must complete before Nitro starts. The pattern is: call `run('vite', ['build'])`, remove the auto-`process.exit` listener that `run()` adds by default, then attach an `exit` listener that calls `run('nitro', ['build'], ...)` on a zero exit code. The inner Nitro `run()` call retains its own exit listener so `process.exit` fires correctly after Nitro finishes.

- **`LITRO_MODE` env var injected by the CLI** — set to `'server'` for `dev`, and to `'server'` or `'static'` for `build`/`generate` based on the `--mode` flag. Downstream Nitro and Vite plugins can read `process.env.LITRO_MODE` to branch behaviour without needing to parse CLI arguments themselves.

- **`--mode` flag parsing handles both `--mode=static` and `--mode static` forms** — finds `--mode=<value>` first (single token with `=`), then falls back to the token following a bare `--mode` argument. Defaults to `'server'` if neither form is present.

- **`generate` is a first-class command** — `litro generate` is more discoverable than `litro build --mode static` for users whose mental model is "generate a static site." Internally it is identical to `build --mode static`.

- **`create-litro` uses `readline/promises` only — no external deps** — `readline/promises` (available since Node 17) provides a clean async prompt API. The scaffolding CLI has zero runtime dependencies to keep `npm create litro` install time minimal.

- **`create-litro` bin points at compiled `dist/index.js`** — source lives in `src/index.ts`; `tsc` compiles it to `dist/index.js`. A `tsconfig.json` was added to `packages/create-litro/` (extending the root tsconfig) with `rootDir: src` and `outDir: dist`. The `package.json` `build` script runs `tsc -p tsconfig.json`.

- **Scaffolded projects use `publicAssets` and `pagesPlugin()`** — the generated `nitro.config.ts` follows the same conventions as the playground, ensuring scaffolded projects work across all Nitro deployment targets including edge adapters.

- **Scaffolded `app.ts` enforces hydration import order** — the first import is `@lit-labs/ssr-client/lit-element-hydrate-support.js` with an explanatory comment. This prevents users from accidentally reordering imports and causing silent hydration failures (per the I-4 decision).

- **HMR and dev error overlay behaviour documented in `ARCHITECTURE.md` Section 7** — covers Lit component HMR via Vite ESM, page addition/deletion via `nitro:dev:reload`, config-change restart requirements, the SSR error boundary (client-only shell on SSR failure rather than 500), and the CLI delegation architecture. The actual error boundary implementation is I-3's responsibility.

- **Playground `package.json` updated to use `litro` CLI** — scripts now use `litro dev`, `litro build`, `litro preview`, and `litro generate` instead of calling `nitro` and `vite` directly. The framework package must be built first (`pnpm --filter litro build`) since `litro` resolves to `packages/framework/dist/cli/index.js`.

---

## V-1: Test Suite, Smoke Tests, and CI Workflow

**Date:** 2026-02-28
**Agent:** V-1

- **Vitest `@vitest-environment jsdom` docblock for `page-data.test.ts`** — the global `vitest.config.ts` sets `environment: 'node'`, which is correct for path utilities and shell tests. `getServerData()` requires `document.getElementById()` and `el.remove()`, so that test file overrides the environment per-file via the `@vitest-environment jsdom` docblock annotation. This is the standard Vitest pattern for mixed-environment monorepos: one config, per-file overrides only where needed.

- **`generateManifestModule` and `generateClientRoutes` tested via local mirror functions** — these helpers are unexported private functions inside `pages.ts`. Rather than exporting them (which would pollute the public API) or using `vi.spyOn` on a module-internal function (which is fragile across bundler transforms), the route-generator tests reproduce the same string-generation logic locally and assert on the CONTRACT: the shape and content of the output strings. The pure path conversion functions (`fileToRoute`, `compareRoutes`) ARE exported and are called directly to construct the same route arrays the plugin would produce.

- **`path-to-route.test.ts` left unchanged** — the existing test file written by I-2 is comprehensive: it covers static, dynamic, nested, catch-all, and optional parameter routes for both `fileToRoute` and `fileToComponentTag`, plus the `compareRoutes` sort invariants including the full array sort case. No cases are missing; adding redundant tests would reduce signal-to-noise.

- **Playwright `webServer.reuseExistingServer: !process.env.CI`** — in local dev the e2e tests reuse an already-running playground dev server if one is listening on port 3000, saving startup time. In CI (`process.env.CI` is set by GitHub Actions) `reuseExistingServer` is false, so Playwright always starts a fresh server, preventing test pollution from a previous run's stale server process.

- **`fullyParallel: false` and `workers: 1` in Playwright config** — the playground dev server is a single-port process shared by all test files. Running tests in parallel against a single server causes race conditions (navigation tests can interfere with data-fetching tests). Serial execution eliminates this class of flakiness at the cost of longer wall-clock time; `retries: 2` on CI absorbs the remaining timing-related flakiness.

- **Smoke test scripts use `bash scripts/smoke-test-*.sh` invocation, not `./scripts/smoke-test-*.sh`** — the `bash` prefix bypasses the executable bit requirement, so CI does not need a `chmod` step. The executable bit note is left in a script comment for developers who want to run the scripts directly from the shell without the `bash` prefix.

- **Smoke tests check for build output existence, not server health** — starting the built server in CI would require a port, a process manager, and a teardown step. Instead, the smoke tests verify that the expected output file exists and contains the expected string content. This is sufficient to catch the most common failure modes (build crash, wrong output directory, missing prerendered content) without the complexity of a live server check.

- **`@playwright/test` added to root workspace `devDependencies`** — Playwright is a dev tool consumed at the workspace root (runs from the repo root via `pnpm exec playwright test`). Adding it to the root `package.json` rather than a specific package ensures `pnpm exec playwright` resolves correctly regardless of the current working directory in CI.

- **CI jobs are independent (no `needs:` chains)** — unit tests, E2E tests, and both smoke tests run in parallel on GitHub Actions. A failure in one job does not block the others. This gives faster feedback: if the E2E tests fail due to a runtime bug, the unit tests still complete and report separately.

- **Playwright report artifact uploaded only on failure** — uploading HTML reports on every run wastes Actions storage quota. The `if: failure()` condition on the upload step means the report is only preserved when tests fail, which is the only time it is needed for debugging. Retention is set to 7 days, sufficient for a typical investigation window.
