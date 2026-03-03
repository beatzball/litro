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
                │  Stage 0 — Page Scan (litro CLI)         │
                │  ─────────────────────────────────────── │
                │  pages/**  → routes.generated.ts         │
                │  (at project root, not in dist/)         │
                │                                          │
                │  Stage 1 — Client (Vite)                 │
                │  ─────────────────────────────────────── │
                │  app.ts → Rollup tree-shake              │
                │         → dist/client/app.js             │
                │         → dist/client/assets/…           │
                │                                          │
                │  Stage 2 — Server (Nitro)                │
                │  ─────────────────────────────────────── │
                │  server/**  → Rollup bundle              │
                │  + publicAssets: dist/client/            │
                │         → dist/server/server/index.mjs   │
                │         → dist/server/public/_litro/…    │
                └─────────────────────────────────────────┘
```

### Why `publicAssets` and not `publicDir`

Nitro's `publicDir` option is silently ignored by edge adapters (Cloudflare Workers, Vercel Edge). The `publicAssets` array is the only way to ensure the Vite output is included in the deployment artifact for ALL targets. Each entry in `publicAssets` specifies:

- `dir` — source directory (**resolved relative to `srcDir`**, not `rootDir` — use `'../dist/client'` when `srcDir = 'server'`)
- `baseURL` — URL prefix under which the files are served
- `maxAge` — `cache-control: max-age` value in seconds

Nitro's `resolveAssetsOptions` resolves `publicAssets[].dir` as `path.resolve(srcDir, dir)`. Because `srcDir` is an absolute path to `<rootDir>/server`, a bare `'dist/client'` string would resolve to `<rootDir>/server/dist/client` (wrong). Use `'../dist/client'` or an absolute path.

Vite produces content-hashed filenames so the client bundle can be served with a `max-age` of 1 year (`31536000`).

---

## 3. Single-Port Dev Server Architecture

In development, **both Vite and Nitro share a single HTTP port**. There is no separate Vite port, no cross-process proxy, and no CORS issues.

```
Browser ──HTTP──► :3030 (Nitro dev server)
                     │
                     ├── /api/**          ─► Nitro API handlers
                     ├── /_litro/**       ─► Nitro static asset handler
                     ├── /__vite/**       ─► Vite dev middleware (injected)
                     │   ├── *.js, *.ts  ─► Vite module transform
                     │   └── /__vite_hmr ─► Vite HMR WebSocket
                     └── /**              ─► Nitro catch-all → HTML shell
```

### How it works

The Vite dev middleware lives in `server/middleware/vite-dev.ts`. Nitro auto-discovers all files in `server/middleware/` and registers them in the H3 app **before** the router (this is the key ordering guarantee from `createNitroApp()`).

The middleware:
1. Starts a Vite server with `server.middlewareMode: true` and `appType: 'custom'` — Vite does NOT bind its own HTTP port, and its built-in SPA fallback is suppressed.
2. Wraps `viteServer.middlewares` with `fromNodeMiddleware()` from `h3` to adapt the connect `(req, res, next)` signature to H3's event handler interface.
3. Passes every request through Vite. Vite handles requests it owns (JS/TS modules, HMR WebSocket, virtual module URLs like `/@id/…`). For all other requests it calls `next()`, which Nitro's router then handles (API routes, HTML catch-all).

**Production exclusion**: `server/middleware/vite-dev.ts` contains a dynamic `import('vite')`. Nitro's `@vercel/nft` dependency tracer runs during Rollup's resolution phase (before DCE) and would copy vite + esbuild + rollup + postcss (~4.5 MB) to the output. The fix uses two `nitro.config.ts` options together:
- `ignore: ['**/middleware/vite-dev.ts']` — prevents Nitro's `scanHandlers()` from auto-discovering the file.
- `handlers: [{ middleware: true, handler: '…/vite-dev.ts', env: 'dev' }]` — re-registers it explicitly so Nitro's `getHandlers()` (evaluated lazily inside a Rollup virtual module) only includes it when `env: 'dev'` matches. In production builds the file never enters Rollup's module graph.

**Key constraint**: `devHandlers` (a separate array in Nitro's options) is read by `DevServer.createApp()` at construction time, before any build hook fires — it cannot be populated from `build:before` or any config hook. Server middleware files are the correct mechanism.

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

### How it actually works (Nitro 2.10)

The pages plugin runs directly from `hooks['build:before']` in `nitro.config.ts`. It:

1. Scans `pages/**/*.{ts,tsx}` with `fast-glob`
2. Sets `nitro.options.virtual['#litro/page-manifest']` to the generated JavaScript source
3. Overwrites `server/stubs/page-manifest.ts` with the same content (physical file fallback — see below)

**Virtual module content** includes:
- Static `import * as _pageN from '/abs/path/pages/foo.ts'` for every page — Rollup's esbuild plugin compiles the TypeScript at build time, registering all `@customElement` definitions as side effects
- A `routes` array export (JSON — the route metadata)
- A `pageModules` registry export mapping `filePath → bundled module object`

**Two-path resolution** — Nitro's virtual plugin wins over `@rollup/plugin-node-resolve` when the virtual content is set. When it is not set (cold start or plugin error), node-resolve falls back to the `package.json` `"imports"` field which points at `server/stubs/page-manifest.ts` — a committed stub with an empty `routes` array.

```json
// playground/package.json
"imports": {
  "#litro/page-manifest": "./server/stubs/page-manifest.ts"
}
```

The stub file is overwritten on every build by the pages plugin, so after the first successful build it always contains the real routes.

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

The pages plugin registers a `'dev:reload'` hook (Nitro 2.x hook name — not `'nitro:dev:reload'`) to re-run the page scanner when files change. New or deleted pages update the `#litro/page-manifest` virtual module in-memory. Note: Nitro dev server must be restarted for new routes to register in the H3 request handler — the route registry is locked after startup (Nitro limitation, documented in R-4 findings).

### Config changes

Changes to `nitro.config.ts` or `vite.config.ts` require a full restart of `litro dev`.

### Dev Error Overlay

SSR errors are caught by the error boundary in `create-page-handler.ts` and logged to the server console with the component name and full stack trace. The client receives a client-only HTML shell instead of a 500 response, so the page is still interactive (Lit renders the component client-side with a brief flash of unstyled content).

Route-not-found requests during dev return a 404 HTML page listing all registered routes derived from `#litro/page-manifest`.

### CLI Architecture

The `litro` CLI (`packages/framework/src/cli/index.ts`) is intentionally thin. It delegates all heavy work to the `nitro` and `vite` CLI binaries found in the project's `node_modules/.bin/`. This avoids re-implementing dev server, build orchestration, or preview logic. The CLI uses Node.js `child_process.spawn` (no `execa` dependency) and sets `LITRO_MODE` in the environment so downstream Nitro and Vite plugins can read the current mode.

```
litro dev      → spawn('nitro', ['dev', '--port', '3030'], { LITRO_MODE: 'server' })
               (default port 3030; override with --port <n> or -p <n>)
litro build    → scanAndWriteClientRoutes(cwd)            // Stage 0: write routes.generated.ts
                 then spawn('vite', ['build'])             // Stage 1: client bundle
                 then spawn('nitro', ['build'], { LITRO_MODE: 'server'|'static' })  // Stage 2
litro generate → same as litro build --mode static
litro preview  → spawn('node', ['dist/server/server/index.mjs'], { PORT: port })
               (nitro preview was removed in Nitro 2.13; runs the built entry directly)
```

The `dist/cli/index.js` binary is produced by `tsc -p tsconfig.json` from `src/cli/index.ts`. The `bin` field in `packages/framework/package.json` points at this compiled output. The framework must be built (`pnpm --filter litro build`) before running `litro` commands in the playground.

---

## 8. Nitro 2.10 Implementation Notes

These are corrections discovered during implementation that differ from the original research findings:

### Hook names changed

| Expected (docs/older Nitro) | Actual (Nitro 2.10) |
|---|---|
| `'nitro:build:before'` | `'build:before'` |
| `'nitro:dev:reload'` | `'dev:reload'` |
| `'nitro:init'` in config hooks | **never fires** — `createNitro()` does not call `callHook('nitro:init')` |

### Plugin calling convention

Config `hooks` entries are registered by `createNitro()` before `build:before` fires. Build-time plugins must therefore be **directly called and awaited** from within `hooks['build:before']` — they cannot register nested `build:before` sub-hooks because the event has already fired by the time those sub-hooks would be registered.

```typescript
// nitro.config.ts — CORRECT
hooks: {
  'build:before': async (nitro) => {
    await pagesPlugin(nitro);   // runs scan immediately
    await ssgPlugin(nitro);     // runs SSG resolution immediately
  }
}

// BROKEN — pagesPlugin registers its own 'build:before' hook which never fires
hooks: {
  'nitro:init': async (nitro) => {  // nitro:init never fires in Nitro 2.10
    pagesPlugin(nitro);
  }
}
```

### Page module bundling for SSR

Node.js ESM cannot import `.ts` files at runtime. The `#litro/page-manifest` virtual module includes **static imports** of all page TypeScript files. Rollup's esbuild plugin compiles them at build time so all `@customElement` decorators run on server startup. A `pageModules` registry maps `filePath → module object` so `createPageHandler` can access `pageData` without a runtime `.ts` import.

Nitro's esbuild requires explicit decorator config for Lit components:

```typescript
// nitro.config.ts
esbuild: {
  options: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      }
    }
  }
}
```

### Dynamic tag names in Lit SSR

`html\`<${tag}></${tag}>\`` is an **invalid expression location** in Lit. Use `unsafeStatic` from `lit/static-html.js`:

```typescript
import { html, unsafeStatic } from 'lit/static-html.js';
const tagStatic = unsafeStatic(route.componentTag);
const template = html`<${tagStatic}></${tagStatic}>`;
```

---

## 9. LitroRouter — Built-in Client Router

Litro ships its own client-side router (`packages/framework/src/runtime/litro-router.ts`) built on the native **URLPattern** web API (Baseline Newly Available Sep 2025). There is no external router dependency.

### Design

```
LitroOutlet.firstUpdated()
  └── dynamic import('./litro-router.js')     ← never evaluated server-side
        └── new LitroRouter(this)
              └── router.setRoutes(routes)
                    ├── converts path format (vaadinToURLPattern)
                    ├── new URLPattern({ pathname: ... }) per route
                    ├── window.addEventListener('popstate', ...)
                    ├── document.addEventListener('click', ...)  ← Shadow DOM aware
                    └── _resolve()  ← initial navigation
```

### Route lifecycle

For each navigation:
1. `_resolve()` iterates routes, calls `URLPattern.exec({ pathname })` for each
2. First match wins (routes are pre-sorted static → dynamic → catch-all by the page scanner)
3. `route.action()` is called first — typically a dynamic import that defines the custom element
4. `document.createElement(route.component)` creates the element instance
5. `element.onBeforeEnter(location)` is called if defined — `LitroPage` uses this for data fetching
6. Outlet children are cleared; new element is appended

### Path format conversion

The page scanner emits paths in h3/path-to-regexp format (e.g. `/:all(.*)*` for catch-alls). URLPattern uses `/:all*` for the same semantics. `vaadinToURLPattern()` converts only the catch-all modifier; all other segments (`:param`, `:param?`) are identical in both formats.

### LitroLocation type

```typescript
interface LitroLocation {
  pathname: string;
  params: Record<string, string | undefined>;  // URLPattern named groups
  search: string;                               // '?foo=bar' or ''
  hash: string;                                 // '#section' or ''
}
```

### Server-side safety

`litro-router.ts` does not access `window`, `history`, or `document` at module evaluation time. The dynamic import in `LitroOutlet.firstUpdated()` and `LitroLink.handleClick()` ensures the module is never evaluated in Node.js. No Rollup stub plugin is needed (unlike the former `@vaadin/router` approach).

### TypeScript types

`URLPattern` is not yet in TypeScript's `lib.dom.d.ts` (TS 5.9). Minimal ambient type declarations are inline in `litro-router.ts` to avoid requiring `lib` changes in downstream projects.
