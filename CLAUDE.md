# Litro — Project Context for All Agents

## License

Apache License 2.0. Copyright 2026 beatzball. See `LICENSE` at the repo root.

## What Is Litro

Litro is a greenfield fullstack web framework being built in this repo. It combines:

- **Lit** — the only component model (no React, Vue, or Svelte anywhere in the dependency tree)
- **Nitro** — server engine (same server that powers Nuxt), handles routing, API, SSR, deployment adapters
- **`@lit-labs/ssr`** — server-side rendering via Declarative Shadow DOM (DSD), streaming support
- **`LitroRouter`** — built-in client-side router (URLPattern API), no external dependency
- **Vite** — client bundle build and HMR
- **pnpm workspaces** — monorepo tooling
- **TypeScript** — required throughout

## Core Architecture

```
User Request
    │
    ▼
Nitro Server
    ├── /api/**  →  server/api/ route files (plain H3 handlers, no Lit)
    └── /**      →  Page Handler
                        ├── SSR mode: @lit-labs/ssr renders Lit component → streams DSD HTML
                        │     └── client: @lit-labs/ssr-client hydrates → LitroRouter takes over
                        └── Static mode: prerendered .html files served by Nitro static preset
```

## User-Facing Directory Convention

```
my-app/
  pages/              ← Lit page components (filename = route)
    index.ts          →  /
    about.ts          →  /about
    blog/
      index.ts        →  /blog
      [slug].ts       →  /blog/:slug
    [...all].ts       →  /* (catch-all)
  server/
    api/              ← Plain Nitro/H3 handlers
    middleware/       ← Nitro middleware
  public/             ← Static assets
  app.ts              ← Client entry
  litro.config.ts     ← Framework config (extends nitro.config.ts)
  vite.config.ts
```

## Monorepo Structure (packages/)

```
litro/
  packages/
    framework/        ← Core package (npm: @beatzball/litro)
      src/
        plugins/      ← Nitro plugins (page scanner, etc.)
        vite/         ← Vite plugins
        runtime/      ← Client-side runtime (router bootstrap, hydration)
        cli/          ← litro dev/build/preview commands
    litro-router/     ← Standalone router (npm: @beatzball/litro-router)
    create-litro/     ← Scaffolding CLI (npm create @beatzball/litro)
  playground/         ← fullstack recipe test app
  playground-11ty/    ← 11ty-blog recipe test app
  playground-starlight/ ← starlight recipe test app
  docs/               ← Official docs site (@beatzball/litro-docs, SSG → GitHub Pages)
  research/           ← Research agent findings (R-1 through R-4)
```

## Key Conventions

- Each page file exports a **default** Lit component class and an optional `routeMeta` named export
- `definePageData<T>(fetcher)` — server-side data fetching; result serialized into `<script type="application/json" id="__litro_data__">` for client consumption
- `getServerData<T>()` — client utility to read serialized server data on first load
- `generateRoutes(): Promise<string[]>` — optional export on dynamic pages for SSG prerendering
- All deployment targets delegated entirely to Nitro's adapter system (no custom adapters)

## Shared Output Structure

- Research findings → `research/<agent-id>-findings.md` (e.g. `research/R-1-findings.md`)
- Framework code → `packages/framework/`
- Scaffolding CLI → `packages/create-litro/`
- Test apps → `playground/`, `playground-11ty/`, `playground-starlight/`
- Docs site → `docs/` (SSG, GitHub Pages)
- Architecture doc → `ARCHITECTURE.md`
- Decision log → `DECISIONS.md` (running log, all agents append)

## Source References

- Nuxt source: https://github.com/nuxt/nuxt
- Nitro source: https://github.com/unjs/nitro — docs: https://nitro.unjs.io
- Lit SSR docs: https://lit.dev/docs/ssr/overview/
- `@lit-labs/ssr` source: https://github.com/lit/lit/tree/main/packages/labs/ssr
- `@lit-labs/ssr-client`: https://github.com/lit/lit/tree/main/packages/labs/ssr-client
- URLPattern spec: https://developer.mozilla.org/en-US/docs/Web/API/URLPattern
- H3 docs: https://h3.unjs.io

## Research Findings — Key Decisions (R-1 through R-4 Complete)

All four research findings are in `research/`. Critical decisions locked in:

### Build Pipeline (R-1, R-4)
- **Single dev server port**: Vite is injected via `server/middleware/vite-dev.ts` — a Nitro server middleware that is auto-registered before the router. It starts Vite in `middlewareMode: true` and calls `fromNodeMiddleware(server.middlewares)`. No separate Vite port, no cross-process proxy. The middleware is excluded from production via `ignore` + `handlers[env:'dev']` in nitro.config (see Nitro 2.13 notes below).
- **Page scanner**: Use `fast-glob` with `**/*.{ts,tsx}` pattern and `pathe` for path operations (not Node's `path` — Windows safe).
- **Virtual module pattern**: Page scanner generates a `#litro/page-manifest` virtual module during `build:before`. A single catch-all Nitro handler reads it at runtime. This avoids registering individual Nitro routes per page.
- **Production assets**: Use `publicAssets` (not `publicDir`) — `publicDir` is ignored by edge adapters (Cloudflare, Vercel Edge). **Critical**: `publicAssets[].dir` is resolved relative to `srcDir` (not `rootDir`). With `srcDir: 'server'`, use `'../dist/client'` not `'dist/client'` — a bare path resolves to `<rootDir>/server/dist/client` (wrong), causing `assets = {}` in the built server and 404 for all `/_litro/**` assets in preview.
- **Two plugin types in Nitro**: build-time plugins (in `nitro.config.ts`, use `nitro.hooks`) vs runtime plugins (`server/plugins/`, use `nitroApp.hooks`). The page scanner is a build-time plugin.

### SSR Pipeline (R-2)
- **Import order is critical**: `@lit-labs/ssr-client/lit-element-hydrate-support.js` must load as a `<script type="module">` in `<head>` BEFORE the app bundle — it patches `LitElement.prototype.createRenderRoot()`.
- **Streaming**: Use `RenderResultReadable` (Node.js `Readable`) with Nitro's `sendStream()` for Node targets. For Cloudflare Workers, convert to `ReadableStream` manually — `RenderResultReadable` is Node-only.
- **DSD polyfill**: Include a MutationObserver-based inline `<script>` polyfill in the shell `<head>` for ~4% of browsers (pre-Firefox 119, pre-Safari 16.4).
- **SSR failure mode**: Components accessing `window`/`document` at module eval time will throw on the server. Wrap in `isServer` guard or use `<litro-client-only>`. Do NOT use VM sandbox mode.
- **Edge adapters**: `@lit-labs/ssr` requires `externals.inline: ['@lit-labs/ssr']` in `nitro.config.ts` to bundle correctly on Cloudflare/Vercel Edge.
- **Dynamic tag names**: Use `unsafeStatic` from `lit/static-html.js` — plain expression interpolation of tag names (`html\`<${tag}>\``) is an invalid Lit expression location and causes SSR to throw.

### Client Router (R-3 + post-R-3 decision)
- **`@vaadin/router` is replaced** — it was deprecated. Litro now uses a built-in `LitroRouter` in `packages/litro-router/src/index.ts` built on the native URLPattern API. No external router dependency.
- **Mount in `firstUpdated()`** — not `constructor()` or `connectedCallback()`. Outlet must be in the DOM first.
- **No Lit bindings inside the outlet element** — Lit won't touch unbound children, keeping the router's subtree safe from reconciliation.
- **`litro-router.ts` is client-only** — it accesses `window`/`history`/`document` at runtime. Never import it in SSR code paths. Dynamic import in `LitroOutlet.firstUpdated()` and `LitroLink.handleClick()` ensures it's never evaluated server-side.
- **No hash routing** — pushState only.
- **No global click interceptor** — `LitroRouter` does NOT intercept plain `<a>` clicks. Plain anchors do full page reloads (browser default). Use `<litro-link>` for SPA navigation or call `LitroRouter.go()` directly.
- **Path format**: Litro paths use h3/path-to-regexp syntax (`:all(.*)*` for catch-alls). `LitroRouter` converts to URLPattern format (`/:all*`) at `setRoutes()` time. The rest of the system (scanner, manifest, server routing) is unaffected.
- **`onBeforeEnter(location: LitroLocation)`** — called by the router on the freshly created element before it is appended to the outlet. `LitroLocation` has `{ pathname, params, search, hash }`.
- **`crawlLinks` does NOT find `LitroRouter` routes** — all static page routes must be explicitly added to `prerender.routes`.
- **No Rollup stub needed** — the old `vaadinRouterStubPlugin` in `pages.ts` is removed. `litro-router.ts` has no module-eval side effects, so no server-bundle isolation trick is needed beyond the dynamic import.

### Path-to-Route Conversion (R-1)
- `[slug]` → `:slug`, `[...all]` → `:all(.*)*`, `[[param]]` → `:param?`, `index` files strip to parent path
- Sort static routes before dynamic, dynamic before catch-all

## Nitro 2.10–2.13 Compatibility (Discovered During Implementation)

These are corrections to what research agents expected vs. what Nitro 2.10 actually does:

### Hook names
- `'build:before'` fires before the rollup build (NOT `'nitro:build:before'`)
- `'dev:reload'` fires on dev hot-reload (NOT `'nitro:dev:reload'`)
- `'nitro:init'` — **does NOT fire** from `createNitro()` in Nitro 2.10. Config hooks registered for this event are silently never called.

### Plugin calling convention
- Config `hooks['build:before']` entries are registered in `createNitro()` before `build:before` fires — use this to trigger build-time logic.
- Build-time plugins must be **directly awaited** from `hooks['build:before']`. They cannot register a nested `build:before` sub-hook (the event already fired by the time the sub-hook would be registered).

### Virtual modules vs. `package.json` imports
- Nitro's virtual module plugin wins over `@rollup/plugin-node-resolve` for `#` imports **only when** the virtual module content is set in `nitro.options.virtual`.
- When the virtual module is **not** set, `@rollup/plugin-node-resolve` falls back to the `package.json` `"imports"` field — the stub file is used. Keep the `"imports"` entry as a cold-start fallback.
- Virtual module content **must be plain JavaScript** — TypeScript syntax causes a Rollup parse error.

### Page module bundling
- Node.js ESM cannot import `.ts` files at runtime (`ERR_UNKNOWN_FILE_EXTENSION`).
- Solution: the `#litro/page-manifest` virtual module includes **static imports** of all page `.ts` files. Rollup's esbuild plugin compiles them at build time; `customElements.define()` runs on server startup.
- A `pageModules` registry is exported from the manifest so `createPageHandler` can access `pageData` exports without a runtime `.ts` import.
- Nitro's esbuild needs `experimentalDecorators: true, useDefineForClassFields: false` (in `esbuild.options.tsconfigRaw`) to handle Lit's decorator syntax (`@customElement`, `@state`, etc.).

### Vite dev middleware — production bundle size

`server/middleware/vite-dev.ts` contains `import('vite')`. Even though `process.dev` DCE eliminates it from compiled code, Nitro's `@vercel/nft` dependency tracer runs during Rollup's **resolution phase** (before DCE) and adds vite to `trackedExternals`, causing vite + esbuild + rollup + postcss (~4.5 MB) to be copied to the production output.

**Root cause**: `buildProduction()` calls `scanHandlers()` a **second time** after `build:before` fires, overwriting any filter applied in `build:before` to `nitro.scannedHandlers`.

**Fix**: Use `ignore: ['**/middleware/vite-dev.ts']` in nitro.config to prevent auto-discovery, then re-register with `handlers: [{ ..., env: 'dev' }]`. Nitro's `getHandlers()` (inside a lazy Rollup virtual module) excludes `env: 'dev'` handlers in production — the file never enters the module graph and `import('vite')` is never resolved.

Key distinction: `nitro.options.handlers` (explicit config) persists through both `scanHandlers()` calls; `nitro.scannedHandlers` is overwritten each time.

## Current Status

**All phases complete. System working end-to-end.**

- R-1 through R-4: Research complete (findings in `research/`)
- I-1 through I-7: Implementation complete
- Recipe system + content layer: complete (`fullstack`, `11ty-blog`, `starlight` recipes, `litro:content` virtual module)
- Tests: 229/229 passing across all packages + 32/32 Playwright e2e tests

Verified working:
- Vite client build → `dist/client/`
- Nitro server build → `dist/server/` (745 kB)
- SSR rendering with Declarative Shadow DOM on all page routes
- `pageData` server-side data fetching and injection
- API routes (`/api/hello`)
- `pageModules` registry enabling bundle-time page compilation
- Dev server (`litro dev`) — Vite middleware intercepts JS/TS requests; Nitro handles HTML and API
  - Auto-builds `dist/client/app.js` via `vite build` if it doesn't exist (needed because `dist/` is gitignored)
- Default dev port: 3000, auto-increments if taken (custom port via `litro dev --port <n>`)
- Preview server (`litro preview`) — SSR builds served from `dist/server/server/index.mjs`; SSG builds served by built-in static file server from `dist/static/`
- `litro build` — page scan runs before `vite build`; fresh routes always baked into client bundle
- `create-litro` recipe system — `fullstack`, `11ty-blog`, `starlight` recipes, `{{placeholder}}` interpolation
- `litro:content` virtual module — Markdown content layer, 11ty-compatible frontmatter + data cascade
  - **Vite plugin** (`packages/framework/src/vite/index.ts`) returns a no-op browser stub (empty async functions) — real content is server-side only, delivered via `pageData` → `serverData`
  - **Nitro plugin** (`packages/framework/src/content/plugin.ts`) generates the real `ContentIndex` stub at `server/stubs/litro-content.js`
- SSG plugin resolves `litro:content` via jiti alias so `generateRoutes()` can call content API
- `LitroRouter` no longer intercepts plain `<a>` clicks — use `<litro-link>` for SPA navigation; plain `<a>` does full page reload
- SSG navigation fix — `playground-11ty` pages use plain `<a>` tags so each navigation fetches fresh pre-rendered HTML with correct `__litro_data__`
- `starlight` recipe — Astro Starlight-inspired docs+blog SSG site; `playground-starlight` workspace validates 11 prerendered routes; syntax highlighting via `highlight.js` (fire theme, SSG build time, same as docs site)
- Hash-only `popstate` events (TOC/fragment links) no longer re-render pages — `LitroRouter` guards on `_lastPathname`
- Scroll-to-hash after mount — `LitroRouter` traverses shadow DOM via `_findDeep()` to reach heading `id` attributes inside shadow roots
- `routeMeta.head` injected into HTML shell via `buildShell()` — required for stylesheet links and FOUC-prevention scripts to reach the browser
- `docs/` workspace — official documentation site built on the starlight recipe, deployed to GitHub Pages via `.github/workflows/docs.yml`
- `LITRO_BASE_PATH` env var — prefixes `/_litro/app.js` script URL for GitHub Pages sub-path deployments (e.g. `LITRO_BASE_PATH=/litro`)
- Starlight recipe UI primitives renamed `sl-*` → `litro-*` to avoid collision with Shoelace's `sl-*` custom element names
- Shoelace `@shoelace-style/shoelace` integrated in starlight recipe + docs site; icon assets served at `/shoelace/assets/` with 1-week cache (no `immutable` — unhashed URLs)

Test breakdown:
- `packages/litro-router`: 16 tests
- `packages/framework`: 196 tests
- `packages/create-litro`: 17 tests
- Playwright e2e: 32 tests across 3 playgrounds (dev mode)

E2E test structure:
- `e2e/playground/` — SSR, navigation (SPA, back/forward, LitroLink), data fetching (14 tests)
- `e2e/playground-11ty/` — content layer, API routes (9 tests)
- `e2e/playground-starlight/` — pages, prerendered route 200-check, TOC (9 tests)
- `pnpm test:e2e` — dev mode (all 3 servers on ports 3030/3031/3032)
- `pnpm test:e2e:preview` — production mode (builds + previews each playground)
- Each `create-litro` recipe template ships `playwright.config.ts` + `e2e/index.spec.ts`
