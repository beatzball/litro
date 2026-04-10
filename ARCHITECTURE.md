# Litro — Architecture

## 1. Monorepo Structure

```
litro/                          <- Git repo root (pnpm workspace root)
  packages/
    framework/                  <- Core package (npm: @beatzball/litro)
      src/
        plugins/                <- Nitro build-time plugins (page scanner, SSG resolver)
        vite/                   <- Vite plugins (litro:content virtual module)
        content/                <- Content layer (ContentIndex, parser, Nitro plugin)
        runtime/                <- Client-side runtime (router bootstrap, hydration)
        cli/                    <- litro dev / build / preview CLI entry
    litro-router/               <- Standalone URLPattern router (npm: @beatzball/litro-router)
    create-litro/               <- `npm create @beatzball/litro` scaffolding CLI
      recipes/
        fullstack/              <- Default fullstack SSR recipe
        11ty-blog/              <- Markdown blog recipe (11ty-compatible)
        starlight/              <- Docs + blog SSG recipe (Astro Starlight-inspired)
    docs-content/               <- Shared Markdown content (@beatzball/litro-docs-content)
    docs-ui/                    <- Shared Lit components + utilities (@beatzball/litro-docs-ui)
  playground/                   <- fullstack recipe test app
  playground-11ty/              <- 11ty-blog recipe test app
  playground-starlight/         <- starlight recipe test app
  playground-elena/             <- Elena adapter test app
  playground-starlight-elena/   <- Elena starlight recipe test app
  playground-starlight-fast/    <- FAST starlight recipe test app
  docs/                         <- Official docs site (@beatzball/litro-docs, SSG)
  docs-ssr/                     <- SSR replica of docs site (@beatzball/litro-docs-ssr)
  .github/workflows/
    ci.yml                      <- GitHub Actions: test, build, dependency audit on PRs
    release.yml                 <- GitHub Actions: publish packages to npm via Changesets
```

---

## 2. Dual Vite + Nitro Build Pipeline

```
                +------------------------------------------+
                |             Build Pipeline                |
                |                                          |
                |  Stage 0 -- Page Scan (litro CLI)        |
                |  pages/**  -> routes.generated.ts        |
                |  (at project root, not in dist/)         |
                |                                          |
                |  Stage 1 -- Client (Vite)                |
                |  app.ts -> Rollup tree-shake             |
                |         -> dist/client/app.js            |
                |         -> dist/client/assets/...        |
                |                                          |
                |  Stage 2 -- Server (Nitro)               |
                |  server/**  -> Rollup bundle             |
                |  + publicAssets: dist/client/             |
                |         -> dist/server/server/index.mjs  |
                |         -> dist/server/public/_litro/...  |
                +------------------------------------------+
```

### Why `publicAssets` and not `publicDir`

Nitro's `publicDir` is silently ignored by edge adapters (Cloudflare, Vercel Edge). `publicAssets` is the only way to include Vite output in the deployment artifact for all targets. Note: `dir` is resolved relative to `srcDir`, not `rootDir`.

---

## 3. Single-Port Dev Server Architecture

In development, both Vite and Nitro share a single HTTP port. No separate Vite port, no cross-process proxy.

```
Browser --HTTP--> :3000 (Nitro dev server, auto-increments if taken)
                     |
                     +-- /api/**          --> Nitro API handlers
                     +-- /_litro/**       --> Nitro static asset handler
                     +-- /__vite/**       --> Vite dev middleware (injected)
                     |   +-- *.js, *.ts   --> Vite module transform
                     |   +-- /__vite_hmr  --> Vite HMR WebSocket
                     +-- /**              --> Nitro catch-all -> HTML shell
```

The Vite dev middleware (`server/middleware/vite-dev.ts`) starts Vite in `middlewareMode: true`, wraps it with `fromNodeMiddleware()`, and passes every request through Vite first. Vite handles JS/TS modules and HMR; everything else falls through to Nitro (API routes, HTML catch-all).

---

## 4. Virtual Module Pattern for Page Routing

Litro avoids registering individual Nitro routes per page file. Instead it uses a virtual module (`#litro/page-manifest`) generated at build time, consumed by a single catch-all handler.

```
Build time:  pages/ scanner -> PageEntry[] manifest -> #litro/page-manifest
Runtime:     catch-all handler imports manifest -> matches request path -> SSR -> stream DSD HTML
```

- **No dynamic route registration** -- Nitro's route registry is locked at build time; per-page registration breaks hot-reload.
- **Single handler** -- one catch-all works identically across all Nitro deployment targets.
- **Incremental updates** -- in dev mode, the manifest is regenerated in-memory on file-change.

---

## 5. Critical Import Ordering Constraint for SSR Hydration (Lit/FAST only)

The hydration support module must be the first import in `app.ts` and the first `<script type="module">` in the HTML `<head>`. This does not apply to Elena (light DOM, no hydration).

```typescript
// app.ts -- CORRECT
import '@lit-labs/ssr-client/lit-element-hydrate-support.js'; // FIRST
import './pages/index.js';

// app.ts -- BROKEN (hydration fails silently)
import './pages/index.js';
import '@lit-labs/ssr-client/lit-element-hydrate-support.js'; // TOO LATE
```

---

## 6. Externals Inlining for Edge Adapters (Lit/FAST only)

```typescript
externals: {
  inline: ['@lit-labs/ssr', '@lit-labs/ssr-client'],
}
```

Edge runtimes have no `node_modules` at runtime. `externals.inline` forces these packages into the server bundle. Elena does not use `@lit-labs/ssr` so this is not needed. Note: FAST packages (`@microsoft/fast-*`) must stay external (not inlined) to avoid dual-copy SSR issues.

---

## 7. HMR Behavior

### Lit component changes

Vite handles HMR for Lit components natively via ESM hot module replacement. Only the changed module and its direct importers are re-evaluated.

### Page file additions/deletions

The pages plugin registers a `'dev:reload'` hook to re-run the page scanner when files change, updating `#litro/page-manifest` in-memory.

### Config changes

Changes to `nitro.config.ts` or `vite.config.ts` require a full restart of `litro dev`.

### Dev Error Overlay

SSR errors are caught by `create-page-handler.ts` and logged to the server console. The client receives a client-only HTML shell instead of a 500, so the page remains interactive. Route-not-found requests return a 404 page listing all registered routes.

---

## 8. LitroRouter — Built-in Client Router

Litro ships its own client-side router (`packages/litro-router/src/index.ts`) built on the native URLPattern web API.

```
LitroOutlet.firstUpdated()
  +-- dynamic import('./litro-router.js')     <- never evaluated server-side
        +-- new LitroRouter(this)
              +-- router.setRoutes(routes)    <- h3ToURLPattern, URLPattern per route
                    +-- popstate listener + initial _resolve()
```

### Navigation model

`LitroRouter` does **not** intercept plain `<a>` clicks -- plain anchors perform full page reloads. For SSG sites this ensures fresh pre-rendered HTML with correct `__litro_data__`. For SPA navigation use `<litro-link href="...">` or `LitroRouter.go(path)`.

---

## 9. Content Layer (`litro:content`)

The content layer provides a Markdown blog API via a virtual module (`litro:content`) that works in both Vite (dev/client) and Nitro (server/SSG) contexts.

```
Project root
  litro.recipe.json          <- { "contentDir": "content/blog" }
  content/
    blog/
      .11tydata.json         <- directory defaults (tags, etc.)
      hello-world.md         <- post: slug = "hello-world"
      getting-started/
        index.md             <- post: slug = "getting-started"
    _data/
      metadata.js            <- global site data (ES module, default export)
```

The Nitro content plugin generates a stub module (`server/stubs/litro-content.js`) that creates a `ContentIndex` and starts `build()` eagerly. The Vite plugin returns a browser stub with no-op functions -- real content reaches the client through `pageData` -> `serverData`.

---

## 10. Recipe System (`create-litro`)

`create-litro` is a scaffolding CLI where each recipe is a directory containing a `recipe.config.ts` and a `template/` directory.

```
packages/create-litro/recipes/
  fullstack/    <- Default SSR recipe
  11ty-blog/    <- Markdown blog (SSG, content layer)
  starlight/    <- Docs + blog SSG (Astro Starlight-inspired)
```

Each recipe has `recipe.config.ts` (exports `LitroRecipe`) and `template/` (files copied verbatim). `scaffold()` replaces `{{placeholder}}` tokens in text files:

| Placeholder | Source |
|---|---|
| `{{projectName}}` | `options.projectName` |
| `{{mode}}` | `options.mode` (`'ssr'` or `'ssg'`) |
| `{{recipeVersion}}` | `options.recipeVersion` (defaults to `'0.0.0'`) |
