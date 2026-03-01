# Litro — Architecture

## 1. Monorepo Structure

```
litro/                          ← Git repo root (pnpm workspace root)
  packages/
    framework/                  ← Core package (npm: litro)
      src/
        plugins/                ← Nitro BUILD-TIME plugins (page scanner, etc.)
        vite/                   ← Vite plugins for the framework
        runtime/                ← Client-side runtime (router bootstrap, hydration)
        cli/                    ← litro dev / build / preview CLI entry
    create-litro/               ← `npm create litro` scaffolding CLI (stub)
  playground/                   ← Test app that uses the framework locally
    pages/                      ← Lit page components (filename = route)
    server/
      api/                      ← Plain Nitro/H3 API handlers
      routes/                   ← Nitro catch-all page handler
      stubs/                    ← Virtual module stubs (page-manifest, etc.)
    public/                     ← Raw static files served at /
    app.ts                      ← Client entry (hydration + router bootstrap)
    vite.config.ts
    nitro.config.ts
  package.json                  ← Workspace root (private, no deps)
  pnpm-workspace.yaml
  tsconfig.json
```

### Package Responsibilities

| Package | npm name | Purpose |
|---|---|---|
| `packages/framework` | `litro` | Core framework: Nitro plugins, Vite plugins, client runtime, CLI |
| `packages/create-litro` | `create-litro` | `npm create litro` — project scaffolding |
| `playground` | (private) | Integration test app; exercises all framework features locally |

---

## 2. Dual Vite + Nitro Build Pipeline

Litro uses a two-stage build pipeline where **Vite owns the client** and **Nitro owns the server**:

```
                ┌─────────────────────────────────────────┐
                │             Build Pipeline               │
                │                                          │
                │  Stage 1 — Client (Vite)                 │
                │  ─────────────────────────────────────── │
                │  app.ts → Rollup tree-shake              │
                │         → dist/client/app-[hash].js      │
                │         → dist/client/assets/…           │
                │                                          │
                │  Stage 2 — Server (Nitro)                │
                │  ─────────────────────────────────────── │
                │  server/**  → Rollup bundle              │
                │  + publicAssets: dist/client/            │
                │         → .output/server/index.mjs       │
                │         → .output/public/_litro/…        │
                └─────────────────────────────────────────┘
```

### Why `publicAssets` and not `publicDir`

Nitro's `publicDir` option is silently ignored by edge adapters (Cloudflare Workers, Vercel Edge). The `publicAssets` array is the only way to ensure the Vite output is included in the deployment artifact for ALL targets. Each entry in `publicAssets` specifies:

- `dir` — source directory (relative to project root)
- `baseURL` — URL prefix under which the files are served
- `maxAge` — `cache-control: max-age` value in seconds

Vite produces content-hashed filenames so the client bundle can be served with a `max-age` of 1 year (`31536000`).

---

## 3. Single-Port Dev Server Architecture

In development, **both Vite and Nitro share a single HTTP port**. There is no separate Vite port, no cross-process proxy, and no CORS issues.

```
Browser ──HTTP──► :3000 (Nitro dev server)
                     │
                     ├── /api/**          ─► Nitro API handlers
                     ├── /_litro/**       ─► Nitro static asset handler
                     ├── /__vite/**       ─► Vite dev middleware (injected)
                     │   ├── *.js, *.ts  ─► Vite module transform
                     │   └── /__vite_hmr ─► Vite HMR WebSocket
                     └── /**              ─► Nitro catch-all → HTML shell
```

### How it works

1. `nitro.config.ts` exports a `devHandlers` array. Each entry is a `{ route, handler }` pair where `handler` is an H3 event handler.

2. During `nitro dev`, Nitro mounts these dev handlers into its internal connect-compatible middleware stack — **before** its own file-based router.

3. Vite is started with `server.middlewareMode: true` and `appType: 'custom'`. This suppresses Vite's built-in HTML serving and HTTP listener — it only gives us a connect middleware function.

4. The Vite middleware is wrapped with `fromNodeMiddleware()` from `h3` to adapt it from `(req, res, next)` to H3's `(event) => Promise<void>` signature.

5. The resulting H3 handler is registered in `devHandlers` so Nitro routes matching requests to Vite before falling through to its own handlers.

**Key constraint**: `devHandlers` is only respected during `nitro dev`. In production (`nitro build`), this key is completely ignored — Vite's output is already baked into `dist/client/` and served via `publicAssets`.

---

## 4. Virtual Module Pattern for Page Routing

Litro avoids registering individual Nitro routes for each page file. Instead it uses a **virtual module** (`#litro/page-manifest`) that is generated once at build time and consumed at runtime by a single catch-all handler.

```
Build time:
  pages/ scanner (I-2)
    → scans pages/**/*.{ts,tsx}
    → generates PageEntry[] manifest
    → writes into #litro/page-manifest alias

Runtime (single catch-all handler):
  import pages from '#litro/page-manifest'
  → match request.path against pages[].route
  → SSR the matched component with @lit-labs/ssr
  → stream DSD HTML to client
```

### Why this approach

- **No dynamic route registration**: Nitro's route registry is locked at build time. Registering routes per page file during `nitro:build:before` causes problems on hot-reload in dev mode.
- **Single handler = simpler adapter compatibility**: One catch-all handler works identically across all Nitro deployment targets (Node, Cloudflare, Vercel Edge, etc.).
- **Incremental updates**: In dev mode, the manifest virtual module can be regenerated in-memory on file-change without restarting the Nitro server.

### The alias in `nitro.config.ts`

```typescript
alias: {
  '#litro/page-manifest': './server/stubs/page-manifest.ts',
}
```

The stub returns an empty `PageEntry[]`. I-2 will replace the stub target with a dynamically generated module that contains the real page list.

---

## 5. Critical Import Ordering Constraint for SSR Hydration

The hydration support module **must be the first import** in `app.ts` and the **first `<script type="module">`** in the HTML `<head>`.

```typescript
// app.ts — CORRECT
import '@lit-labs/ssr-client/lit-element-hydrate-support.js'; // ← FIRST
import './pages/index.js';

// app.ts — BROKEN (hydration fails silently)
import './pages/index.js';
import '@lit-labs/ssr-client/lit-element-hydrate-support.js'; // ← TOO LATE
```

### Why

`@lit-labs/ssr-client/lit-element-hydrate-support.js` monkey-patches `LitElement.prototype.createRenderRoot()`. The patched version checks for a pre-existing Declarative Shadow DOM (DSD) template produced by the SSR pass and attaches to it, rather than creating a fresh empty shadow root.

If any `LitElement` subclass is evaluated (i.e., its `static styles` or class body runs) **before** this patch is applied, those components will already have the original `createRenderRoot()` in their prototype chain. When they upgrade in the browser, they will create a fresh shadow root, destroying the SSR content and causing a visible flash.

### In the HTML shell

```html
<!-- CORRECT: hydration support BEFORE app bundle -->
<script type="module" src="/@lit-labs/ssr-client/lit-element-hydrate-support.js"></script>
<script type="module" src="/app.ts"></script>

<!-- Also include the DSD polyfill for browsers lacking native support -->
<script>/* MutationObserver-based DSD polyfill */</script>
```

The DSD polyfill is a plain (non-module) inline `<script>` because it must run synchronously as the parser encounters `<template shadowrootmode>` elements — a `type="module"` script is deferred and would be too late.

---

## 6. Externals Inlining for Edge Adapters

```typescript
externals: {
  inline: ['@lit-labs/ssr', '@lit-labs/ssr-client'],
}
```

Cloudflare Workers and Vercel Edge Functions do not have a `node_modules` directory at runtime. Nitro's `externals.inline` forces these packages to be bundled into the server output (`rollupConfig`'s `bundle: true` equivalent), making them self-contained. Without this, `import '@lit-labs/ssr'` would fail at runtime on edge with `Cannot find module`.

---

## 7. HMR Behavior

### Lit component changes

Vite handles HMR for Lit components natively via ESM hot module replacement. Changes to `.ts` files in `pages/` update the component in-place in the browser without a full reload. Vite's module graph tracks the dependency chain; only the changed module and its direct importers are re-evaluated.

### Page file additions/deletions

The Nitro plugin (I-2) hooks `nitro:dev:reload` to re-run the page scanner when files change. New or deleted pages update the `#litro/page-manifest` virtual module in-memory. Note: Nitro dev server must be restarted for new routes to register in the H3 request handler — the route registry is locked after startup (Nitro limitation, documented in R-4 findings).

### Config changes

Changes to `nitro.config.ts` or `vite.config.ts` require a full restart of `litro dev`.

### Dev Error Overlay

SSR errors are caught by the error boundary in `create-page-handler.ts` and logged to the server console with the component name and full stack trace. The client receives a client-only HTML shell instead of a 500 response, so the page is still interactive (Lit renders the component client-side with a brief flash of unstyled content).

Route-not-found requests during dev return a 404 HTML page listing all registered routes derived from `#litro/page-manifest`.

### CLI Architecture

The `litro` CLI (`packages/framework/src/cli/index.ts`) is intentionally thin. It delegates all heavy work to the `nitro` and `vite` CLI binaries found in the project's `node_modules/.bin/`. This avoids re-implementing dev server, build orchestration, or preview logic. The CLI uses Node.js `child_process.spawn` (no `execa` dependency) and sets `LITRO_MODE` in the environment so downstream Nitro and Vite plugins can read the current mode.

```
litro dev      → spawn('nitro', ['dev'],     { LITRO_MODE: 'server' })
litro build    → spawn('vite', ['build'])
                 then spawn('nitro', ['build'], { LITRO_MODE: 'server'|'static' })
litro generate → spawn('vite', ['build'])
                 then spawn('nitro', ['build'], { LITRO_MODE: 'static' })
litro preview  → spawn('nitro', ['preview'])
```

The `dist/cli/index.js` binary is produced by `tsc -p tsconfig.json` from `src/cli/index.ts`. The `bin` field in `packages/framework/package.json` points at this compiled output. The framework must be built (`pnpm --filter litro build`) before running `litro` commands in the playground.
