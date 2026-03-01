# Litro — Project Context for All Agents

## What Is Litro

Litro is a greenfield fullstack web framework being built in this repo. It combines:

- **Lit** — the only component model (no React, Vue, or Svelte anywhere in the dependency tree)
- **Nitro** — server engine (same server that powers Nuxt), handles routing, API, SSR, deployment adapters
- **`@lit-labs/ssr`** — server-side rendering via Declarative Shadow DOM (DSD), streaming support
- **`@vaadin/router`** — client-side router, designed for web components
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
                        │     └── client: @lit-labs/ssr-client hydrates → @vaadin/router takes over
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
    framework/        ← Core package (npm: litro)
      src/
        plugins/      ← Nitro plugins (page scanner, etc.)
        vite/         ← Vite plugins
        runtime/      ← Client-side runtime (router bootstrap, hydration)
        cli/          ← litro dev/build/preview commands
    create-litro/     ← Scaffolding CLI (npm create litro)
  playground/         ← Test app using the framework locally
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
- Test app → `playground/`
- Architecture doc → `ARCHITECTURE.md`
- Decision log → `DECISIONS.md` (running log, all agents append)

## Source References

- Nuxt source: https://github.com/nuxt/nuxt
- Nitro source: https://github.com/unjs/nitro — docs: https://nitro.unjs.io
- Lit SSR docs: https://lit.dev/docs/ssr/overview/
- `@lit-labs/ssr` source: https://github.com/lit/lit/tree/main/packages/labs/ssr
- `@lit-labs/ssr-client`: https://github.com/lit/lit/tree/main/packages/labs/ssr-client
- Vaadin Router docs: https://vaadin.com/router — source: https://github.com/vaadin/router
- H3 docs: https://h3.unjs.io

## Research Findings — Key Decisions (R-1 through R-4 Complete)

All four research findings are in `research/`. Critical decisions locked in:

### Build Pipeline (R-1, R-4)
- **Single dev server port**: Inject Vite into Nitro via `devHandlers` + `fromNodeMiddleware()`. No separate Vite port, no cross-process proxy.
- **Page scanner**: Use `fast-glob` with `**/*.{ts,tsx}` pattern and `pathe` for path operations (not Node's `path` — Windows safe).
- **Virtual module pattern**: Page scanner generates a `#litro/page-manifest` virtual module during `build:before`. A single catch-all Nitro handler reads it at runtime. This avoids registering individual Nitro routes per page.
- **Production assets**: Use `publicAssets` (not `publicDir`) — `publicDir` is ignored by edge adapters (Cloudflare, Vercel Edge).
- **Two plugin types in Nitro**: build-time plugins (in `nitro.config.ts`, use `nitro.hooks`) vs runtime plugins (`server/plugins/`, use `nitroApp.hooks`). The page scanner is a build-time plugin.

### SSR Pipeline (R-2)
- **Import order is critical**: `@lit-labs/ssr-client/lit-element-hydrate-support.js` must load as a `<script type="module">` in `<head>` BEFORE the app bundle — it patches `LitElement.prototype.createRenderRoot()`.
- **Streaming**: Use `RenderResultReadable` (Node.js `Readable`) with Nitro's `sendStream()` for Node targets. For Cloudflare Workers, convert to `ReadableStream` manually — `RenderResultReadable` is Node-only.
- **DSD polyfill**: Include a MutationObserver-based inline `<script>` polyfill in the shell `<head>` for ~4% of browsers (pre-Firefox 119, pre-Safari 16.4).
- **SSR failure mode**: Components accessing `window`/`document` at module eval time will throw on the server. Wrap in `isServer` guard or use `<litro-client-only>`. Do NOT use VM sandbox mode.
- **Edge adapters**: `@lit-labs/ssr` requires `externals.inline: ['@lit-labs/ssr']` in `nitro.config.ts` to bundle correctly on Cloudflare/Vercel Edge.
- **Dynamic tag names**: Use `unsafeStatic` from `lit/static-html.js` — plain expression interpolation of tag names (`html\`<${tag}>\``) is an invalid Lit expression location and causes SSR to throw.

### Client Router (R-3)
- **Mount in `firstUpdated()`** — not `constructor()` or `connectedCallback()`. Outlet must be in the DOM first.
- **No Lit bindings inside the outlet element** — Lit won't touch unbound children, keeping the router's subtree safe from reconciliation.
- **`@vaadin/router` cannot be imported server-side** — it accesses `window` at module eval time. Never import it in SSR code paths.
- **No hash routing** — pushState only. Uses `event.composedPath()` so Shadow DOM links are intercepted correctly.
- **Guards**: Implement in `action()` callback via `commands.redirect()` / `commands.prevent()`. No dedicated guard API.
- **`crawlLinks` does NOT find `@vaadin/router` routes** — all static page routes must be explicitly added to `prerender.routes`.

### Path-to-Route Conversion (R-1)
- `[slug]` → `:slug`, `[...all]` → `:all(.*)*`, `[[param]]` → `:param?`, `index` files strip to parent path
- Sort static routes before dynamic, dynamic before catch-all

## Nitro 2.10 Compatibility (Discovered During Implementation)

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

## Current Status

**All phases complete. System working end-to-end.**

- R-1 through R-4: Research complete (findings in `research/`)
- I-1 through I-7: Implementation complete
- V-1: Validation complete (95/95 unit tests passing)

Verified working:
- Vite client build → `dist/client/`
- Nitro server build → `dist/server/`
- SSR rendering with Declarative Shadow DOM on all page routes
- `pageData` server-side data fetching and injection
- API routes (`/api/hello`)
- `pageModules` registry enabling bundle-time page compilation

Pending:
- `litro` CLI binary needs `pnpm --filter litro build` before use
- Dev server (`nitro dev`) / HMR not yet tested
- SSG mode (`LITRO_MODE=static`) not yet tested
- Playwright e2e tests pending dev server work
