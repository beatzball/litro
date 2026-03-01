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

## Agent Roles and Dependency Order

| Agent | Role | Depends On |
|-------|------|------------|
| R-1 | Research: Nuxt internals (page scan, Vite/Nitro coordination) | — |
| R-2 | Research: `@lit-labs/ssr` (SSR API, DSD, hydration) | — |
| R-3 | Research: `@vaadin/router` (API, Lit integration, lifecycle) | — |
| R-4 | Research: Nitro standalone (config, plugins, prerender, adapters) | — |
| I-1 | Implement: Monorepo scaffold + Vite/Nitro build pipeline | R-1, R-4 |
| I-2 | Implement: Page scanner + route generator (Nitro plugin) | R-1, R-4, I-1 |
| I-3 | Implement: SSR pipeline (Nitro handler + `@lit-labs/ssr` + streaming) | R-2, R-4, I-1 |
| I-4 | Implement: Client hydration bootstrap + `@vaadin/router` integration | R-2, R-3, I-1 |
| I-5 | Implement: Data fetching convention | R-2, R-3, I-3, I-4 |
| I-6 | Implement: Static site generation mode | R-4, I-2, I-3 |
| I-7 | Implement: CLI + HMR + error overlay | I-1, I-2 |
| V-1 | Validate: E2E test suite + deployment smoke tests | All I-* |

## Shared Output Structure

- Research findings → `research/<agent-id>-findings.md` (e.g. `research/R-1-findings.md`)
- Framework code → `packages/framework/`
- Scaffolding CLI → `packages/create-litro/`
- Test app → `playground/`
- Architecture doc → `ARCHITECTURE.md` (written by I-1 after scaffold)
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
- **Virtual module pattern**: Page scanner generates a `#litro/page-manifest` virtual module at `nitro:build:before`. A single catch-all Nitro handler reads it at runtime. This avoids registering individual Nitro routes per page.
- **Production assets**: Use `publicAssets` (not `publicDir`) — `publicDir` is ignored by edge adapters (Cloudflare, Vercel Edge).
- **Two plugin types in Nitro**: build-time plugins (in `nitro.config.ts`, use `nitro.hooks`) vs runtime plugins (`server/plugins/`, use `nitroApp.hooks`). The page scanner is a build-time plugin.

### SSR Pipeline (R-2)
- **Import order is critical**: `@lit-labs/ssr-client/lit-element-hydrate-support.js` must load as a `<script type="module">` in `<head>` BEFORE the app bundle — it patches `LitElement.prototype.createRenderRoot()`.
- **Streaming**: Use `RenderResultReadable` (Node.js `Readable`) with Nitro's `sendStream()` for Node targets. For Cloudflare Workers, convert to `ReadableStream` manually — `RenderResultReadable` is Node-only.
- **DSD polyfill**: Include a MutationObserver-based inline `<script>` polyfill in the shell `<head>` for ~4% of browsers (pre-Firefox 119, pre-Safari 16.4).
- **SSR failure mode**: Components accessing `window`/`document` at module eval time will throw on the server. Wrap in `isServer` guard or use `<litro-client-only>`. Do NOT use VM sandbox mode.
- **Edge adapters**: `@lit-labs/ssr` requires `externals.inline: ['@lit-labs/ssr']` in `nitro.config.ts` to bundle correctly on Cloudflare/Vercel Edge.

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

## Current Status

Research complete (R-1 through R-4). Implementation starting with I-1 (monorepo scaffold). Full PRD is in `PRD-litro-framework.md`.
