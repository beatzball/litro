# R-4 Findings: Nitro Standalone Usage — Config, Plugins, Routing, Prerender, and Deployment Adapters

**Agent:** R-4
**Date:** 2026-02-28
**Status:** Complete
**Intended Consumers:** Implementation agents I-1 (build pipeline), I-2 (page scanner), I-3 (SSR pipeline), I-6 (SSG mode), I-7 (CLI and HMR)

---

## 1. Summary

Nitro is a universal JavaScript server engine developed by the UnJS team. It compiles server-side code into self-contained deployment bundles targeting any runtime: Node.js, Cloudflare Workers, Deno, AWS Lambda, Azure Functions, Vercel Edge, Netlify Functions, and more. Nitro is the server layer powering Nuxt 3, but it is fully usable as a standalone tool without Nuxt. The `nitro.config.ts` file is the single entry point for all configuration. Nitro uses `unimport` for auto-imports, H3 as its HTTP toolkit, Rollup for bundling, `unstorage` for storage abstraction, and `hookable` for its lifecycle hook system. For Litro, Nitro handles all server concerns — file-based API routing, SSR request handlers (registered programmatically), prerendering, static asset serving, and deployment adapter switching — while Vite handles the client-side bundle. The integration between Vite and Nitro in dev mode is achieved by registering Vite's development middleware as a Nitro `devHandler`, allowing both to share a single HTTP port without cross-process proxying.

---

## 2. Config Reference

### 2.1 Installation and Initialization

```sh
npm install nitro
# or
pnpm add nitro
```

The minimal `nitro.config.ts`:

```ts
import { defineNitroConfig } from 'nitropack/config'

export default defineNitroConfig({
  // configuration here
})
```

To start Nitro programmatically (used by I-1 for the `litro dev` and `litro build` commands):

```ts
import { createNitro, build, prepare, copyPublicAssets, prerender } from 'nitropack'

// Dev mode
const nitro = await createNitro({ dev: true, ...config })
const server = await createDevServer(nitro)
await server.listen(3000)

// Production build
const nitro = await createNitro({ dev: false, ...config })
await prepare(nitro)
await copyPublicAssets(nitro)
await prerender(nitro)   // only if prerender is configured
await build(nitro)
await nitro.close()
```

The `createDevServer` function is exported from `nitropack` and returns a `NitroDevServer` with a `listen(port)` method.

---

### 2.2 Config Options — Routing

```ts
defineNitroConfig({
  // ─── ROUTING ─────────────────────────────────────────────────────────────

  // Root directory for auto-scanned server files (routes, middleware, plugins)
  srcDir: 'server',                   // default: 'server'

  // Subdirectory within srcDir for file-based route handlers
  // Files here become GET/POST/etc handlers based on filename method suffix
  // e.g. server/routes/users.get.ts → GET /users
  // e.g. server/routes/users/[id].ts → GET /users/:id (any method)
  // No config key needed — this is convention-based and auto-scanned

  // Directories to scan for route files (relative to rootDir)
  // Overrides the default `server/routes` scan
  scanDirs: ['server'],               // default: inferred from srcDir

  // Programmatically add route handlers without file-based routing.
  // Key is the route pattern (h3 router format), value is the handler file path.
  // CRITICAL for Litro: page routes are registered here by the page scanner plugin.
  handlers: [
    {
      route: '/api/health',
      handler: '~/server/handlers/health.ts',
      method: 'get',                  // optional; omit for all methods
      lazy: true,                     // optional; load handler lazily
      middleware: false,              // false = route handler, true = middleware
    }
  ],

  // Virtual filesystem entries — allows injecting synthetic "files" without
  // creating them on disk. Used extensively by Nuxt; useful for Litro's
  // generated route files.
  virtual: {
    '#litro/routes': `export const routes = [...]`,
  },

  // Additional directories that Nitro will resolve imports from
  // (added to the module resolution path)
  alias: {
    '~': '/path/to/app/root',
    '#litro': '/path/to/litro/runtime',
  },

  // Whether to enable TypeScript path aliases from tsconfig.json
  typescript: {
    strict: true,
    tsConfig: {},                     // override tsconfig options
    generateRuntimeConfigTypes: true, // generate types for runtimeConfig
    internalPaths: false,
  },

  // Route rules: per-route behavior overrides (headers, redirects, cache, proxy)
  routeRules: {
    '/api/**': { cors: true, headers: { 'Access-Control-Allow-Origin': '*' } },
    '/static/**': { static: true },
    '/blog/**': { swr: 3600 },        // stale-while-revalidate cache for 1h
    '/old-path': { redirect: '/new-path' },
    '/proxy/**': { proxy: 'https://upstream.example.com/**' },
  },
})
```

**File-based route naming conventions:**

| Filename pattern                    | Route                     | Method   |
|-------------------------------------|---------------------------|----------|
| `server/routes/index.ts`            | `/`                       | ALL      |
| `server/routes/users.ts`            | `/users`                  | ALL      |
| `server/routes/users.get.ts`        | `/users`                  | GET only |
| `server/routes/users.post.ts`       | `/users`                  | POST only|
| `server/routes/users/[id].ts`       | `/users/:id`              | ALL      |
| `server/routes/users/[id].get.ts`   | `/users/:id`              | GET only |
| `server/routes/[...slug].ts`        | `/:slug(.*)*` catch-all   | ALL      |

**Middleware files** live in `server/middleware/` and run before every request in registration order. They do not return a response; they call `event.node.next()` or throw an error.

**API routes** live in `server/api/` and are automatically prefixed with `/api/`. This is the recommended location for API handlers; `server/routes/` is for routes at arbitrary paths.

---

### 2.3 Config Options — Assets

```ts
defineNitroConfig({
  // ─── ASSETS ──────────────────────────────────────────────────────────────

  // Public directory: files here are served as-is at the root URL path.
  // Nitro copies these to the output directory and serves them statically.
  // Equivalent to Vite's `public/` directory.
  publicDir: 'public',                // default: 'public'

  // Additional public asset directories (beyond publicDir).
  // Each entry can specify a baseURL and maxAge for cache-control headers.
  // CRITICAL for Litro production: register Vite's `dist/client/` output here.
  publicAssets: [
    {
      dir: 'public',                  // directory on disk
      maxAge: 0,                      // Cache-Control max-age in seconds (0 = no-cache)
    },
    {
      dir: 'dist/client',             // Vite output
      baseURL: '/_litro/',            // serve under this URL prefix
      maxAge: 31536000,               // 1 year cache (hashed filenames from Vite)
      fallthrough: false,             // if true, 404s pass through to next handler
    },
  ],

  // Server-side assets: files accessible via `useStorage('assets:server')`
  // Not served over HTTP; used for server-side data (e.g. JSON, templates)
  serverAssets: [
    {
      baseName: 'templates',          // storage key prefix
      dir: './server/templates',      // directory
    },
  ],
})
```

**Important behavioral detail:** When `publicAssets` entries are configured, Nitro bundles the files into the output using `@vercel/nft` or copies them depending on the adapter. For Cloudflare Workers, assets are embedded in the Worker bundle as base64. For `node` adapter, they are copied to the output and served by Nitro's built-in file server.

---

### 2.4 Config Options — Prerendering

```ts
defineNitroConfig({
  // ─── PRERENDERING ────────────────────────────────────────────────────────

  prerender: {
    // Routes to pre-render. Nitro will make internal requests to each route
    // and write the response to the output directory as an HTML file.
    routes: ['/', '/about', '/blog'],

    // Whether to crawl links found in prerendered HTML pages and
    // recursively prerender those pages too.
    crawlLinks: true,                 // default: false

    // Ignore specific URL patterns during link crawling.
    ignore: ['/api/**', '/_litro/**'],

    // Whether to fail the build if any prerendered route returns an error.
    failOnError: false,               // default: false (warns instead of failing)

    // Auto-detect routes from route rules that have `prerender: true`.
    // When routeRules includes `{ prerender: true }`, that route is added.
    autoSubfolderIndex: true,         // write /about → /about/index.html (not /about.html)
  },
})
```

**`autoSubfolderIndex` behavior:**
- `true` (default): `/about` → `dist/static/about/index.html`
- `false`: `/about` → `dist/static/about.html`

The `autoSubfolderIndex: true` default is better for static hosts that serve directory indexes.

**Prerender output:** Each prerendered route response is written as a file to the output directory. The HTTP response body (HTML) is the file content. The `Content-Type` header determines extension (HTML defaults to `.html`). Non-HTML responses (e.g., JSON from `/api/feed.json`) get their appropriate extension.

**`generateRoutes` hook (for programmatic prerender route generation):** This is handled via Nitro's plugin hooks — see Section 3.

---

### 2.5 Config Options — Dev Server

```ts
defineNitroConfig({
  // ─── DEV SERVER ──────────────────────────────────────────────────────────

  // Dev-only route handlers. These are H3 event handlers or connect-compatible
  // middleware injected ONLY during dev mode. They are excluded from production builds.
  // CRITICAL for Litro dev: inject Vite's dev middleware here.
  devHandlers: [
    {
      route: '/_vite',                // route prefix for this dev handler
      handler: viteMw,                // H3 event handler wrapping Vite middleware
    },
  ],

  // Port for the Nitro dev server
  devServer: {
    port: 3000,                       // default: 3000
    watch: ['src/**'],                // additional paths to watch for hot reload
  },

  // Whether to enable Nitro's experimental hot module replacement
  // (restarts server modules without full restart)
  experimental: {
    asyncContext: false,              // experimental: use AsyncLocalStorage for context
    wasm: false,                      // enable WASM support
    nodeFetchCompat: false,           // add Node.js fetch compatibility layer
  },

  // Logger options
  logLevel: 3,                        // 0=fatal, 1=error, 2=warn, 3=info, 4=debug, 5=trace

  // Watch additional directories for auto-restart during dev
  watch: [],
})
```

---

### 2.6 Config Options — Deployment Adapters

```ts
defineNitroConfig({
  // ─── DEPLOYMENT ADAPTERS ────────────────────────────────────────────────

  // The deployment preset. This is the single switch that changes the
  // entire build output format. Can also be set via NITRO_PRESET env var.
  preset: 'node',                     // see Section 7 for all options

  // Output directory for the built server bundle
  output: {
    dir: '.output',                   // root output dir (default: '.output')
    serverDir: '.output/server',      // server bundle (default: '.output/server')
    publicDir: '.output/public',      // static assets (default: '.output/public')
  },
})
```

---

### 2.7 Other Important Config Options

```ts
defineNitroConfig({
  // ─── MODULE RESOLUTION ───────────────────────────────────────────────────

  // npm packages to NOT bundle (leave as external requires in output)
  // Use for packages with native bindings or large binary assets
  externals: {
    external: ['sharp', 'better-sqlite3'],
    inline: ['@lit-labs/ssr'],        // force inline even if it looks external
    trace: true,                      // use @vercel/nft to trace dependencies
    traceOptions: {},
    moduleDirectories: ['node_modules'],
    exportConditions: ['node'],       // resolve conditions for externals
  },

  // Rollup build options override
  rollupConfig: {},

  // ─── AUTO-IMPORTS ────────────────────────────────────────────────────────

  // Auto-import utilities from specific packages (no explicit import needed in handlers)
  imports: {
    dirs: ['server/utils'],           // auto-import all exports from these dirs
    presets: [
      { from: 'h3', imports: ['defineEventHandler', 'getQuery', 'readBody'] }
    ],
  },

  // ─── RUNTIME CONFIG ──────────────────────────────────────────────────────

  // Values available at runtime via `useRuntimeConfig()` in handlers.
  // Public values are exposed to the client in Nuxt; in standalone Nitro,
  // all runtimeConfig is server-side only.
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    apiSecret: '',                    // override with NITRO_API_SECRET env var
    public: {
      // In standalone Nitro these are server-side too; 'public' is just convention
      appUrl: process.env.APP_URL || 'http://localhost:3000',
    },
  },

  // ─── STORAGE ─────────────────────────────────────────────────────────────

  // Configure unstorage drivers for `useStorage()` in handlers
  storage: {
    cache: {
      driver: 'redis',
      url: process.env.REDIS_URL,
    },
    db: {
      driver: 'fs',
      base: './data',
    },
  },

  // Cache storage (used by `defineCachedEventHandler` and `defineCachedFunction`)
  cache: {
    storage: 'redis',                 // which storage driver to use for cache
    swr: true,                        // stale-while-revalidate default
    base: 'nitro/cache',              // storage key prefix
    routes: ['/api/**'],              // routes to cache by default
    default: {
      maxAge: 3600,                   // default cache TTL in seconds
    },
  },

  // ─── HOOKS ───────────────────────────────────────────────────────────────

  // Inline hook registrations (alternative to plugins)
  hooks: {
    'nitro:config': (config) => {
      // Modify config before Nitro is initialized
    },
    'nitro:init': (nitro) => {
      // Nitro instance is ready; add hooks to nitro.hooks here
    },
  },
})
```

---

## 3. Plugin System

### 3.1 Plugin Types

Nitro has **two distinct plugin concepts** that are often confused:

1. **Build-time plugins** (`nitropack` plugins): Run during the build process, using the `hookable` lifecycle. These are the primary extension point for Litro.
2. **Runtime plugins** (`server/plugins/` directory): Run inside the server process at startup, not during build.

### 3.2 Build-Time Plugins (Nitro Plugins)

Build-time plugins are registered in `nitro.config.ts` under the `plugins` key or passed to `createNitro()`. They receive the Nitro instance and can register hooks on `nitro.hooks`.

**Registration:**

```ts
// nitro.config.ts
import { defineNitroConfig } from 'nitropack/config'
import { litroPageScanner } from './plugins/page-scanner'

export default defineNitroConfig({
  plugins: [
    './plugins/my-plugin',             // path to a plugin module
    litroPageScanner,                  // or a direct plugin function
  ],
})
```

**Plugin structure:**

```ts
// plugins/my-plugin.ts
import type { Nitro } from 'nitropack'

export default function myPlugin(nitro: Nitro) {
  // nitro is the fully-initialized Nitro instance
  // Register hooks via nitro.hooks.hook(...)

  nitro.hooks.hook('nitro:config', (config) => {
    // Called before Nitro processes its final config.
    // Mutate `config` to add routes, plugins, etc.
    // IMPORTANT: this hook fires during createNitro(), before build starts.
  })

  nitro.hooks.hook('nitro:init', (nitro) => {
    // Called after Nitro is fully initialized.
    // The nitro object is the same as the outer argument; this hook
    // is mainly useful for plugins that need to react to other plugins
    // having registered their config modifications.
  })

  nitro.hooks.hook('nitro:build:before', (nitro) => {
    // Called just before the Rollup build starts.
    // Last chance to modify nitro.options (the resolved config).
    // CRITICAL HOOK for Litro's page scanner: scan pages/ here and
    // add handler entries to nitro.options.handlers.
  })

  nitro.hooks.hook('nitro:build:done', (nitro) => {
    // Called after the Rollup bundle is written.
    // Use for post-build tasks (e.g., writing a manifest file).
  })

  nitro.hooks.hook('nitro:rollup:before', (nitro) => {
    // Called before Rollup processes the bundle.
    // Can modify nitro.options.rollupConfig here.
  })

  nitro.hooks.hook('nitro:compiled', (nitro) => {
    // Called after Rollup compilation completes (before copy).
  })

  nitro.hooks.hook('nitro:dev:reload', () => {
    // Called in dev mode when the server reloads due to a file change.
    // Use to re-run the page scanner on file changes.
  })

  nitro.hooks.hook('prerender:config', (prerender) => {
    // Called before prerendering starts.
    // Mutate `prerender` to add routes, etc.
    // CRITICAL HOOK for Litro SSG: add page routes to prerender.routes here.
    prerender.routes = [...(prerender.routes || []), '/new-route']
  })

  nitro.hooks.hook('prerender:init', (prerenderer) => {
    // Called when the prerenderer is initialized.
  })

  nitro.hooks.hook('prerender:generate', (route, nitro) => {
    // Called for each route being prerendered.
    // route.route: string (the URL path)
    // route.contents: string | undefined (the HTML response)
    // route.fileName: string (output file path)
    // route.error: Error | undefined
    // Mutate route to transform output or handle errors.
  })

  nitro.hooks.hook('prerender:done', ({ prerenderer, errors, generatedRoutes }) => {
    // Called when all prerendering is complete.
    // errors: any routes that failed
    // generatedRoutes: Set<string> of all routes that were prerendered
  })

  nitro.hooks.hook('close', () => {
    // Called when the Nitro server is closing.
  })
}
```

### 3.3 Complete Hook Reference

| Hook | Phase | Arguments | Purpose |
|---|---|---|---|
| `nitro:config` | Init | `(config: NitroConfig)` | Mutate config before processing |
| `nitro:init` | Init | `(nitro: Nitro)` | Post-init setup |
| `nitro:build:before` | Build | `(nitro: Nitro)` | Pre-build mutations to `nitro.options` |
| `nitro:rollup:before` | Build | `(nitro: Nitro)` | Modify Rollup config |
| `nitro:compiled` | Build | `(nitro: Nitro)` | After Rollup compilation |
| `nitro:build:done` | Build | `(nitro: Nitro)` | Post-build cleanup / manifest writing |
| `nitro:dev:reload` | Dev | `()` | Dev file changed, server reloading |
| `prerender:config` | Prerender | `(config: PrerenderConfig)` | Add/modify prerender routes |
| `prerender:init` | Prerender | `(prerenderer)` | Prerenderer initialized |
| `prerender:generate` | Prerender | `(route, nitro)` | Per-route hook during prerender |
| `prerender:done` | Prerender | `(result)` | All prerendering complete |
| `close` | Shutdown | `()` | Server/build closing |

### 3.4 Execution Order

For a production build:
1. `nitro:config` — config plugins mutate the raw config
2. Nitro resolves config into `nitro.options`
3. `nitro:init` — post-init hooks fire
4. `nitro:build:before` — last mutation point for `nitro.options`
5. `nitro:rollup:before` — Rollup config finalization
6. Rollup builds the bundle
7. `nitro:compiled` — bundle written
8. `copyPublicAssets` — public assets copied
9. `nitro:build:done` — build complete
10. If prerender enabled: `prerender:config` → `prerender:init` → `prerender:generate` × N → `prerender:done`

### 3.5 Runtime Plugins (`server/plugins/`)

Runtime plugins run inside the server process, not during build. They are auto-loaded from `server/plugins/` in alphabetical order. They receive a Nitro runtime context and can register lifecycle events for the request/response cycle.

```ts
// server/plugins/my-runtime-plugin.ts
export default defineNitroPlugin((nitroApp) => {
  // nitroApp.hooks is a different hooks instance (runtime hooks)

  nitroApp.hooks.hook('request', (event) => {
    // Called for every incoming request
    console.log('Request:', event.path)
  })

  nitroApp.hooks.hook('beforeResponse', (event, { body }) => {
    // Called before sending the response
  })

  nitroApp.hooks.hook('afterResponse', (event, { body }) => {
    // Called after sending the response
  })

  nitroApp.hooks.hook('error', (error, { event }) => {
    // Called when an unhandled error occurs
  })
})
```

**Runtime hooks available:**
- `request` — before route handler
- `beforeResponse` — after handler, before sending
- `afterResponse` — after response sent
- `error` — unhandled errors
- `render:response` — (Nuxt-specific, not available in standalone)

---

## 4. File-Based Routing

### 4.1 How It Works

Nitro scans the `server/routes/` directory at build time and registers each file as a route handler. The route path is derived from the file path relative to `server/routes/`, following these rules:

1. Strip the file extension and any HTTP method suffix
2. Replace `[param]` with `:param` (dynamic segment)
3. Replace `[...param]` with `:param(.*)*` (catch-all)
4. `index` files map to the parent directory route
5. Double brackets `[[param]]` are optional segments

**Examples:**

```
server/routes/index.ts           → GET/POST/etc /
server/routes/about.ts           → ALL methods  /about
server/routes/blog/index.ts      → ALL methods  /blog
server/routes/blog/[slug].get.ts → GET          /blog/:slug
server/routes/api/users.post.ts  → POST         /api/users
server/routes/[...all].ts        → ALL methods  /:all(.*)*  (catch-all)
```

**Note on `server/api/` vs `server/routes/`:** Files in `server/api/` are identical to `server/routes/` but are automatically prefixed with `/api/`. Use `server/api/` for API endpoints and `server/routes/` for page-level server routes.

### 4.2 Route Handler Format

```ts
// server/routes/about.ts (or server/api/users.get.ts)
import { defineEventHandler, getQuery, readBody, getRouterParam } from 'h3'

export default defineEventHandler(async (event) => {
  // Access route params (e.g., from /blog/:slug)
  const slug = getRouterParam(event, 'slug')

  // Access query string (?foo=bar)
  const query = getQuery(event)

  // Read JSON request body
  const body = await readBody(event)

  // Set response headers
  setResponseHeader(event, 'X-Custom', 'value')

  // Return value: objects become JSON, strings become text/html
  return { message: 'hello', slug }
})
```

### 4.3 Middleware Files

```ts
// server/middleware/auth.ts
export default defineEventHandler(async (event) => {
  // Runs before ALL routes. Must NOT return a value (or return undefined).
  // To block a request: throw createError({ statusCode: 401 })
  const token = getRequestHeader(event, 'authorization')
  if (!token) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  // Attach data to the event context for downstream handlers
  event.context.user = await verifyToken(token)
})
```

### 4.4 Adding Programmatic Routes

There are three ways to add routes programmatically without file-based routing:

**Method 1: `handlers` array in config** (static, evaluated at config time):
```ts
defineNitroConfig({
  handlers: [
    {
      route: '/pages/:slug',
      handler: '~/server/handlers/page.ts',
      method: 'get',
    },
  ],
})
```

**Method 2: Mutating `nitro.options.handlers` in a plugin** (dynamic, evaluated at build time):
```ts
// In a build-time plugin
nitro.hooks.hook('nitro:build:before', (nitro) => {
  const scannedRoutes = scanPages()
  for (const route of scannedRoutes) {
    nitro.options.handlers.push({
      route: route.path,
      handler: route.handlerFile,
      method: 'get',
      lazy: true,
    })
  }
})
```

**Method 3: Using virtual files + a single catch-all handler** (Litro's recommended approach):
```ts
// Register a single catch-all handler for all page routes
defineNitroConfig({
  handlers: [
    {
      route: '/**',
      handler: '~/server/handlers/page-handler.ts',
      method: 'get',
    },
  ],
  // The handler reads the route from the virtual file
  virtual: {
    '#litro/pages': () => generateRouteManifest(),   // function returning virtual module content
  },
})
```

---

## 5. Custom Route Resolver

### 5.1 The Problem

Nitro's file scanner is baked into its build pipeline. For Litro, the page scanner needs to:
1. Scan `pages/` (not `server/routes/`)
2. Register each page as a Nitro handler pointing to the SSR pipeline
3. Inject the page manifest into a virtual module for the client router

### 5.2 Recommended Pattern for Litro

The cleanest approach is a **single catch-all server route with a virtual manifest**, implemented via a build-time plugin:

```ts
// packages/framework/src/plugins/nitro-pages-plugin.ts
import type { Nitro } from 'nitropack'
import { globby } from 'fast-glob'
import { resolve } from 'pathe'

export default function nitroPagesPlugin(nitro: Nitro) {
  nitro.hooks.hook('nitro:build:before', async (nitro) => {
    const pagesDir = resolve(nitro.options.rootDir, 'pages')
    const pageFiles = await globby(['**/*.ts', '!**/*.d.ts'], { cwd: pagesDir })

    const routes = pageFiles.map(file => fileToRoute(file))

    // Option A: Register one handler per page (full file-based routing parity)
    for (const route of routes) {
      nitro.options.handlers.push({
        route: route.path,
        handler: resolve(nitro.options.rootDir, 'node_modules/litro/dist/server/page-handler.mjs'),
        method: 'get',
        lazy: true,
      })
    }

    // Option B: Use a single catch-all + virtual manifest (simpler, recommended)
    // The virtual module is set here; the catch-all is registered in config
    nitro.options.virtual['#litro/page-manifest'] = [
      `export const pages = ${JSON.stringify(routes)};`,
    ].join('\n')
  })

  // In dev mode, re-scan when pages directory changes
  nitro.hooks.hook('nitro:dev:reload', async () => {
    // Nitro will re-run the entire build pipeline on reload,
    // so this hook is mainly for logging / side effects
    console.log('[litro] Rescanning pages...')
  })
}
```

### 5.3 Virtual Module Pattern

Virtual modules are first-class in Nitro. They are defined in `nitro.options.virtual` as a `Record<string, string | (() => string)>`. The key is the module ID (use `#` prefix by convention). The value is either a string of source code or a factory function that returns source code (the factory form is evaluated lazily and supports async via returning a Promise).

```ts
defineNitroConfig({
  virtual: {
    // Static virtual module
    '#litro/config': `export const config = ${JSON.stringify(litroConfig)};`,

    // Dynamic virtual module (factory function, re-evaluated on each build)
    '#litro/page-manifest': () => {
      const routes = scanPagesSync()
      return `export const pages = ${JSON.stringify(routes)};`
    },
  },
})
```

Inside a handler, import the virtual module as normal:
```ts
import { pages } from '#litro/page-manifest'
```

---

## 6. Prerendering

### 6.1 How It Works

Nitro's prerenderer makes in-process HTTP requests to each target route, captures the response, and writes it as a file to the output directory. It does NOT spin up an actual HTTP server — it uses H3's `handleRequest` directly.

**Trigger:** Prerendering runs as a separate phase after the Rollup build completes. It is triggered by the `prerender(nitro)` function call in the build script, or automatically when `preset: 'static'` is used.

### 6.2 Specifying Prerender Targets

**Method 1: Static list in config:**
```ts
defineNitroConfig({
  prerender: {
    routes: ['/', '/about', '/blog', '/contact'],
  },
})
```

**Method 2: `prerender:config` hook (recommended for Litro):**
```ts
nitro.hooks.hook('prerender:config', (config) => {
  const staticRoutes = getStaticPageRoutes()  // from page scanner
  config.routes = [...(config.routes || []), ...staticRoutes]
})
```

**Method 3: Route rules:**
```ts
defineNitroConfig({
  routeRules: {
    '/about': { prerender: true },
    '/blog/**': { prerender: true },
  },
})
```

**Method 4: Link crawling:**
```ts
defineNitroConfig({
  prerender: {
    routes: ['/'],          // seed URL
    crawlLinks: true,       // crawl <a href> links found in responses
  },
})
```

### 6.3 The `prerender:generate` Hook

This hook fires for each route being prerendered and allows transforming the output:

```ts
nitro.hooks.hook('prerender:generate', (route, nitro) => {
  // route shape:
  // {
  //   route: string,           // URL path (e.g. '/about')
  //   contents: string | null, // HTML response body
  //   fileName: string,        // output file path (e.g. 'about/index.html')
  //   error: Error | null,     // error if the route failed
  //   generateTimeMS: number,  // time taken to generate
  // }

  if (route.error) {
    console.error(`Prerender failed for ${route.route}:`, route.error)
    // Set route.skip = true to skip writing this route
    // route.skip = true
  }

  // Transform HTML (e.g., inject analytics snippet)
  if (route.contents) {
    route.contents = route.contents.replace(
      '</head>',
      '<script>/* analytics */</script></head>'
    )
  }
})
```

### 6.4 Dynamic Route Prerendering (`generateRoutes` Pattern)

For dynamic routes like `/blog/[slug]`, Litro needs to know which concrete paths to prerender. The recommended pattern (matching the PRD's `generateRoutes` export):

**Page file:**
```ts
// pages/blog/[slug].ts
export default class BlogPage extends LitElement { ... }

// Optional: tell the prerenderer which concrete paths to generate
export async function generateRoutes(): Promise<string[]> {
  // Fetch from CMS, read from filesystem, etc.
  return ['/blog/hello-world', '/blog/second-post']
}
```

**Page scanner plugin calls this:**
```ts
nitro.hooks.hook('prerender:config', async (config) => {
  for (const page of dynamicPages) {
    try {
      const mod = await import(page.filePath)
      if (typeof mod.generateRoutes === 'function') {
        const concreteRoutes = await mod.generateRoutes()
        config.routes = [...(config.routes || []), ...concreteRoutes]
      }
    } catch (e) {
      console.warn(`[litro] ${page.filePath} has no generateRoutes; skipping prerender`)
    }
  }
})
```

### 6.5 Prerender Output Structure

With `autoSubfolderIndex: true` (default):
```
.output/public/
  index.html             ← from /
  about/
    index.html           ← from /about
  blog/
    index.html           ← from /blog
    hello-world/
      index.html         ← from /blog/hello-world
```

With `autoSubfolderIndex: false`:
```
.output/public/
  index.html
  about.html
  blog.html
  blog/
    hello-world.html
```

**Non-HTML routes** (e.g., `/api/feed.json`) are written with their Content-Type-derived extension:
```
.output/public/
  api/
    feed.json
```

### 6.6 Error Handling in Prerender

By default, prerender errors produce a warning but do not fail the build (`failOnError: false`). The error is captured in `route.error` during the `prerender:generate` hook.

```ts
defineNitroConfig({
  prerender: {
    failOnError: true,   // fail the build on any prerender error
  },
})
```

---

## 7. Deployment Adapters

### 7.1 How Adapters Work

An adapter (preset) is selected via `preset: 'name'` in `nitro.config.ts` or the `NITRO_PRESET` environment variable. Each adapter:
1. Wraps the server entry in a platform-specific handler
2. Configures the bundler for the target runtime (Node.js vs V8 isolates)
3. Produces a platform-specific output directory structure
4. May add platform-specific polyfills

### 7.2 `node` Adapter

**Purpose:** Self-hosted Node.js server (Coolify, Docker, bare metal).

```ts
defineNitroConfig({
  preset: 'node',
  output: {
    dir: '.output',
  },
})
```

**Output structure:**
```
.output/
  server/
    index.mjs            ← Entry point: node .output/server/index.mjs
    chunks/              ← Code-split chunks
    node_modules/        ← Bundled node_modules (if not externalized)
  public/                ← Static assets (served by the built-in static server)
```

**Running:** `node .output/server/index.mjs`

**Environment variables:** Read from `process.env` at runtime. The server listens on `process.env.PORT` (default 3000) and `process.env.HOST` (default `0.0.0.0`).

**Dockerfile example:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY .output .output
CMD ["node", ".output/server/index.mjs"]
```

---

### 7.3 `node-server` Adapter (preferred over `node`)

**Purpose:** Same as `node` but includes a more complete HTTP server setup with clustering support.

```ts
defineNitroConfig({
  preset: 'node-server',
})
```

This is functionally the same as `node` for Litro's purposes. Use `node-server` for production Node.js deployments.

---

### 7.4 `static` Adapter

**Purpose:** Fully static site output — no server needed. Used for JAMstack/CDN deployments.

```ts
defineNitroConfig({
  preset: 'static',
  prerender: {
    crawlLinks: true,
    routes: ['/'],        // at minimum, seed with the root
    failOnError: false,
  },
  output: {
    publicDir: 'dist/static',
  },
})
```

**Output:** All prerendered routes written to `.output/public/` as HTML files. No server bundle is produced. The SPA fallback (for client-side navigation) is `200.html` or `404.html` — configure via `routeRules`.

**Important:** `preset: 'static'` does NOT automatically prerender all pages. You still need to configure `prerender.routes` or `prerender.crawlLinks: true` with a seed URL.

---

### 7.5 `cloudflare-pages` Adapter

**Purpose:** Deploy to Cloudflare Pages with an optional Functions worker.

```ts
defineNitroConfig({
  preset: 'cloudflare-pages',
})
```

**Output structure:**
```
.output/
  public/                ← Static assets → deployed to Cloudflare CDN
    _worker.js           ← Cloudflare Pages Functions entry (auto-generated)
    _routes.json         ← Routes config telling CF which paths go to worker
  server/                ← (empty for this preset; worker is in public/)
```

**Limitations:**
- Runtime is V8 isolates (Cloudflare Workers runtime) — no Node.js APIs
- `process.env` is NOT available; use Cloudflare's bindings via `event.context.cloudflare.env`
- File size limit: 25MB for the Worker script
- No `node:` protocol imports
- `externals.external` must be empty (everything must be bundled)
- Storage: use KV, R2, D1 bindings via `cloudflare.d1Databases`, `cloudflare.kvNamespaces`, etc.

**Wrangler config (`wrangler.toml`) is still needed** to define bindings for KV/D1/R2. Nitro generates the worker script but does not manage `wrangler.toml`.

---

### 7.6 `vercel` and `vercel-edge` Adapters

**Purpose:** Deploy to Vercel serverless functions or Edge functions.

```ts
defineNitroConfig({
  preset: 'vercel',       // or 'vercel-edge' for Edge Runtime
})
```

**Output structure (`vercel` preset):**
```
.output/
  server/
    index.mjs            ← Vercel Serverless Function entry
  public/                ← Served directly from Vercel CDN
```

Nitro generates a `.vercel/output/` directory in the format required by Vercel's Build Output API v3:
```
.vercel/
  output/
    config.json
    functions/
      __nitro.func/
        index.js         ← Serverless function
        .vc-config.json  ← Vercel function config
    static/              ← Static assets
```

**`vercel-edge` adapter** uses the Edge Runtime (V8 isolates, no Node.js APIs). Same limitations as Cloudflare Workers.

**Environment variables:** Available as `process.env` for serverless; for edge, use `event.context.waitUntil` and Vercel edge primitives.

---

### 7.7 `netlify` and `netlify-edge` Adapters

```ts
defineNitroConfig({
  preset: 'netlify',      // or 'netlify-edge' for Edge Functions
})
```

**Output structure (`netlify` preset):**
```
.netlify/
  functions/
    server/
      index.mjs          ← Netlify Function entry
.output/
  public/                ← Static assets (copied to Netlify CDN)
```

Requires a `netlify.toml`:
```toml
[build]
  publish = ".output/public"
  command = "nitro build"

[[redirects]]
  from = "/*"
  to = "/.netlify/functions/server"
  status = 200
```

**`netlify-edge`** uses Deno Deploy-compatible runtime. No Node.js APIs. Faster cold starts.

---

### 7.8 `azure-functions` Adapter

**Purpose:** Deploy to Azure Functions v4 (Node.js).

```ts
defineNitroConfig({
  preset: 'azure-functions',
})
```

**Output structure:**
```
.output/
  server/
    index.mjs            ← Azure Functions v4 entry
    function.json        ← Azure Functions binding config
  public/                ← Static assets (must be served separately via Azure Blob Storage or Azure Static Web Apps)
```

**Critical limitation:** Azure Functions do NOT serve static assets — you must pair with Azure Static Web Apps or Azure Blob Storage for static asset serving.

---

### 7.9 `azure` Adapter (Azure Static Web Apps)

```ts
defineNitroConfig({
  preset: 'azure',
})
```

**Output structure:**
```
.output/
  server/                ← Azure Functions portion
  public/                ← Static files (served by Azure SWA CDN)
```

Requires `staticwebapp.config.json` at project root for routing rules. Nitro generates a `staticwebapp.config.json` in the output.

**Azure SWA** is a hybrid: static assets are served from Azure CDN, dynamic routes go to an integrated Azure Functions backend. This is the recommended Azure deployment target for Litro.

---

### 7.10 Adapter Comparison Summary

| Adapter | Runtime | Node.js APIs | Static Assets | Cold Start | Best For |
|---|---|---|---|---|---|
| `node-server` | Node.js | Full | Built-in server | N/A (always warm) | Coolify, Docker |
| `static` | None | N/A | All files static | N/A | Pure static sites |
| `cloudflare-pages` | V8 isolates | None | Cloudflare CDN | ~0ms | Edge-global apps |
| `vercel` | Node.js (Lambda) | Full | Vercel CDN | ~100ms | Vercel platform |
| `vercel-edge` | V8 isolates | None | Vercel CDN | ~0ms | Vercel edge perf |
| `netlify` | Node.js (Lambda) | Full | Netlify CDN | ~100ms | Netlify platform |
| `netlify-edge` | Deno | Partial | Netlify CDN | ~0ms | Netlify edge perf |
| `azure-functions` | Node.js | Full | Manual (Blob) | ~200ms | Azure (Functions only) |
| `azure` | Node.js | Full | Azure CDN | ~200ms | Azure SWA (recommended) |

---

## 8. Static Asset Serving

### 8.1 `publicDir` vs `publicAssets`

**`publicDir`** (string, default `'public'`):
- Single directory served at the URL root
- Files are copied to `.output/public/` in production
- In dev mode, served directly from disk
- Simple, no configuration needed
- Example: `public/favicon.ico` → served at `/favicon.ico`

**`publicAssets`** (array of `PublicAsset`):
- Multiple directories, each with independent `baseURL` and cache settings
- More control over cache headers and URL prefixes
- **Critical for Litro production builds**: register Vite's `dist/client/` output here with a long cache TTL (Vite uses content-hashed filenames)

```ts
defineNitroConfig({
  publicAssets: [
    // User's public directory (no cache — files may change)
    {
      dir: 'public',
      maxAge: 0,
    },
    // Vite client bundle (long cache — content-hashed filenames)
    {
      dir: 'dist/client',
      baseURL: '/_litro/',
      maxAge: 31536000,   // 1 year
    },
  ],
})
```

### 8.2 How Static Serving Works in Dev vs Production

**Dev mode:** Nitro does NOT serve static assets from disk in the same way as production. Instead:
- `publicDir` files are served via a dev middleware
- Vite's dev server should be registered via `devHandlers` (see Section 9)
- Nitro does NOT bundle or copy files in dev

**Production mode:**
- All `publicAssets` directories are bundled into `.output/public/`
- Served with `Cache-Control: max-age=<maxAge>` headers based on config
- For edge/serverless adapters: assets are served from CDN before the function is invoked

### 8.3 Cache Headers

Nitro sets `Cache-Control` headers based on `maxAge`:
- `maxAge: 0` → `Cache-Control: public, max-age=0, must-revalidate`
- `maxAge: 3600` → `Cache-Control: public, max-age=3600, s-maxage=3600`
- Files with content hashes in their names should use `maxAge: 31536000` (1 year)

---

## 9. Dev Server

### 9.1 Architecture

In dev mode, Nitro runs a single HTTP server (powered by `listhen`). It does NOT run as a pure Node.js HTTP server directly — it uses `h3`'s request handler as the core and wraps it with `listhen` for features like HTTPS, QR code display, and port auto-incrementing.

**Key insight:** Nitro's dev server is a single process with a single port. Vite is integrated NOT as a separate server on a separate port (the naive approach) but as middleware injected INTO Nitro's request handler pipeline via `devHandlers`.

### 9.2 Integrating Vite as Nitro Dev Middleware

This is the pattern Nuxt uses (documented in R-1) and is the recommended approach for Litro:

```ts
// packages/framework/src/cli/dev.ts
import { createNitro, createDevServer } from 'nitropack'
import { createServer as createViteServer } from 'vite'
import { fromNodeMiddleware } from 'h3'

async function startDev() {
  // 1. Create Vite dev server WITHOUT its own HTTP listener
  const vite = await createViteServer({
    server: { middlewareMode: true },  // CRITICAL: no HTTP listener
    appType: 'custom',
  })

  // 2. Create Nitro with Vite middleware injected as a devHandler
  const nitro = await createNitro({
    dev: true,
    devHandlers: [
      {
        route: '/_vite',
        // fromNodeMiddleware converts Vite's connect middleware to H3 handler
        handler: fromNodeMiddleware(vite.middlewares),
      },
    ],
    // Proxy Vite HMR WebSocket
    devServer: {
      port: 3000,
    },
  })

  // 3. Start the Nitro dev server (single port, handles both Nitro and Vite requests)
  const server = createDevServer(nitro)
  await server.listen(3000)

  // Nitro now handles:
  // - /api/** → Nitro API handlers
  // - /pages/** → Nitro SSR handlers
  // - /_vite/** → Vite dev middleware (HMR, module transforms)
  // - /public/** → Static files from publicDir
}
```

**Alternative: separate port with proxy** (simpler but two ports):
```ts
// Vite on port 5173, Nitro proxies /_vite/* to it
const nitro = await createNitro({
  dev: true,
  routeRules: {
    '/_vite/**': {
      proxy: 'http://localhost:5173/**',  // NOT recommended: requires Vite on separate port
    },
  },
})
```

The middleware approach (no separate port) is strongly preferred.

### 9.3 WebSocket Support

Nitro's dev server supports WebSockets. For Vite's HMR WebSocket, the `middlewareMode` approach handles this automatically because the Vite middleware handles the WebSocket upgrade event within the same HTTP server.

For custom WebSocket endpoints in production, Nitro supports the `ws:` event handler pattern (introduced in Nitro v2.6+):

```ts
// server/routes/_ws.ts
export default defineWebSocketHandler({
  open(peer) {
    console.log('WebSocket connected:', peer.id)
  },
  message(peer, message) {
    peer.send(`Echo: ${message}`)
  },
  close(peer) {
    console.log('WebSocket closed:', peer.id)
  },
})
```

### 9.4 Dev Watcher Configuration

Nitro watches `srcDir` and restarts the server on changes. Additional paths can be watched:

```ts
defineNitroConfig({
  watch: [
    'pages/**',           // watch page files (triggers nitro:dev:reload)
    'litro.config.ts',    // restart on config changes
  ],
})
```

---

## 10. Environment Variables

### 10.1 `runtimeConfig`

The primary way to pass configuration to server handlers. Values can be overridden by environment variables following the naming convention: `NITRO_<UPPERCASE_KEY>`.

```ts
// nitro.config.ts
defineNitroConfig({
  runtimeConfig: {
    databaseUrl: '',      // Override: NITRO_DATABASE_URL=...
    apiSecret: '',        // Override: NITRO_API_SECRET=...
    port: 3000,           // Override: NITRO_PORT=3000
  },
})
```

**In a handler:**
```ts
export default defineEventHandler((event) => {
  const config = useRuntimeConfig()   // auto-imported
  // config.databaseUrl, config.apiSecret, etc.
  return { db: config.databaseUrl }
})
```

**Override rules:**
- `NITRO_DATABASE_URL` overrides `runtimeConfig.databaseUrl`
- `NITRO_API_SECRET` overrides `runtimeConfig.apiSecret`
- Nested keys: `runtimeConfig.oauth.clientId` → `NITRO_OAUTH_CLIENT_ID` (camelCase → SCREAMING_SNAKE_CASE)

### 10.2 `.env` Files

Nitro uses `dotenv` to load `.env` files in development. By default:
- `.env` is loaded in dev mode
- `.env` is NOT loaded in production (environment variables must be injected by the deployment platform)
- `.env.production` can be used for production-specific defaults

### 10.3 Per-Adapter Differences

| Adapter | How to set env vars | Notes |
|---|---|---|
| `node-server` | `process.env` | `PORT` and `HOST` control listening address |
| `static` | N/A (no server) | All config must be baked in at build time |
| `cloudflare-pages` | Cloudflare dashboard → Pages → Settings → Environment variables | Available in Workers via `event.context.cloudflare.env` NOT `process.env` |
| `vercel` | Vercel dashboard → Settings → Environment Variables | Available as `process.env` in serverless; inject NITRO_* for runtimeConfig overrides |
| `netlify` | Netlify dashboard → Site settings → Environment variables | Available as `process.env` |
| `azure-functions` | Azure portal → Function App → Configuration → App settings | Available as `process.env` |
| `azure` (SWA) | Azure SWA → Configuration → Application settings | Available as `process.env` in the Functions backend |

### 10.4 Build-Time vs Runtime Variables

- **Build-time variables** (baked into the bundle): Set in `nitro.config.ts` using `process.env` directly during config evaluation. These cannot be changed without rebuilding.
- **Runtime variables** (read at request time): Use `runtimeConfig`. These can be changed via environment variables without rebuilding.

```ts
defineNitroConfig({
  // Build-time: baked in
  preset: process.env.DEPLOY_TARGET || 'node-server',

  // Runtime: can override with NITRO_DB_URL at deploy time
  runtimeConfig: {
    dbUrl: process.env.DB_URL || 'sqlite://./dev.db',
  },
})
```

---

## 11. Complete Annotated `nitro.config.ts`

This is the complete `nitro.config.ts` that I-1 should use as the foundation for the Litro build pipeline. It covers all concerns: routing, assets, prerendering, dev server, deployment adapters, and environment variables.

```ts
// nitro.config.ts — Litro Framework Foundation Config
// This file is the TEMPLATE. The actual Litro config will be
// programmatically constructed by the framework and merged with
// user overrides from litro.config.ts.

import { defineNitroConfig } from 'nitropack/config'
import { nitroPagesPlugin } from './packages/framework/src/plugins/nitro-pages-plugin'
import { nitroSsrPlugin } from './packages/framework/src/plugins/nitro-ssr-plugin'
import { resolve } from 'pathe'

// The deployment preset is controlled by NITRO_PRESET env var or
// `litro build --preset <name>`. Default to node-server for local dev.
const preset = process.env.NITRO_PRESET || 'node-server'

// Whether this is an SSG (static) build.
// Set by `litro build --mode static`.
const isStatic = preset === 'static'

export default defineNitroConfig({
  // ─── IDENTITY ────────────────────────────────────────────────────────────

  // Root directory of the user's app
  rootDir: '.',

  // Nitro server source files (API routes, middleware, plugins)
  srcDir: 'server',

  // ─── ROUTING ─────────────────────────────────────────────────────────────

  // Programmatic handler registrations from the page scanner plugin.
  // The nitroPagesPlugin will populate nitro.options.handlers at build time.
  // In config, we register the catch-all page handler as a fallback.
  handlers: [
    // API routes are file-based from server/api/ (auto-scanned by Nitro)
    // Page routes are handled by the catch-all below

    // Catch-all for server-rendered pages.
    // nitroPagesPlugin will add specific page routes BEFORE this handler.
    // This catch-all serves as the 404/fallback page.
    {
      route: '/**',
      handler: '~/server/handlers/page.ts',
      method: 'get',
      lazy: true,
    },
  ],

  // Virtual modules: the page manifest is generated by nitroPagesPlugin
  // and made available to server handlers via #litro/page-manifest
  virtual: {
    '#litro/page-manifest': () => {
      // This factory is replaced by nitroPagesPlugin at build time.
      // Returns generated route manifest.
      return 'export const pages = [];'
    },
  },

  // Route rules: per-route behavior
  routeRules: {
    // API routes: disable caching by default, enable CORS
    '/api/**': {
      cors: true,
      headers: { 'Cache-Control': 'no-store' },
    },

    // Vite client assets: long cache (content-hashed by Vite)
    '/_litro/**': {
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    },

    // In SSG mode, all page routes are prerendered
    ...(isStatic ? { '/**': { prerender: true } } : {}),
  },

  // ─── ASSETS ──────────────────────────────────────────────────────────────

  // User's public directory (static assets, favicon, robots.txt, etc.)
  publicDir: 'public',

  // Additional asset directories
  publicAssets: [
    // User's public directory — no cache (files may change between deploys)
    {
      dir: 'public',
      maxAge: 0,
    },
    // Vite client bundle output — long cache (content-hashed filenames)
    // Only relevant in production (dev uses Vite's dev middleware)
    {
      dir: 'dist/client',
      baseURL: '/_litro/',
      maxAge: 31536000,   // 1 year
      fallthrough: false,
    },
  ],

  // ─── PRERENDERING ────────────────────────────────────────────────────────

  prerender: {
    // Seed routes. nitroPagesPlugin's prerender:config hook will add all
    // static page routes here at build time.
    routes: ['/'],

    // Crawl links found in prerendered pages to discover more routes.
    // Useful for blog pagination, navigation links, etc.
    crawlLinks: isStatic,

    // Don't prerender API routes or asset routes
    ignore: ['/api/**', '/_litro/**', '/_vite/**'],

    // Warn on errors but don't fail the build (some pages may be auth-gated)
    failOnError: false,

    // Write /about → /about/index.html (works with all static hosts)
    autoSubfolderIndex: true,
  },

  // ─── DEV SERVER ──────────────────────────────────────────────────────────

  // Dev-only handlers: inject Vite's dev middleware here.
  // The nitroPagesPlugin (or I-1's dev.ts) will push the Vite handler here.
  // Defined here as a placeholder; actual handler is injected programmatically.
  devHandlers: [
    // Populated programmatically in litro dev CLI (I-7):
    // {
    //   route: '/_vite',
    //   handler: fromNodeMiddleware(vite.middlewares),
    // }
  ],

  devServer: {
    port: 3000,
  },

  // Watch additional paths for dev reload
  watch: [
    'pages/**',           // re-run page scanner when pages change
    'litro.config.ts',    // full restart when user config changes
  ],

  // ─── DEPLOYMENT ADAPTER ──────────────────────────────────────────────────

  // Controlled by NITRO_PRESET env var or --preset CLI flag.
  // Defaults to node-server for local development.
  preset,

  // Output directories
  output: {
    dir: '.output',
    serverDir: '.output/server',
    publicDir: '.output/public',
  },

  // ─── BUILD PLUGINS ───────────────────────────────────────────────────────

  // Build-time plugins that extend Nitro's build lifecycle.
  // These run during the build (not at runtime).
  plugins: [
    // Page scanner: scans pages/ and registers routes + prerender targets
    nitroPagesPlugin,

    // SSR plugin: registers @lit-labs/ssr as the page handler
    nitroSsrPlugin,
  ],

  // ─── RUNTIME PLUGINS ─────────────────────────────────────────────────────
  // Runtime plugins live in server/plugins/ and are auto-scanned.
  // No config needed here; they are loaded automatically.

  // ─── MODULE RESOLUTION ───────────────────────────────────────────────────

  // Ensure @lit-labs/ssr is inlined (not externalized) so it works in
  // edge/serverless environments that don't have node_modules at runtime.
  externals: {
    inline: [
      '@lit-labs/ssr',
      '@lit-labs/ssr/lib',
      'lit',
      'lit-html',
      '@lit/reactive-element',
    ],
  },

  // TypeScript aliases matching the app's tsconfig
  alias: {
    '~': resolve('.'),                          // ~ → project root
    '#litro': resolve('./node_modules/litro'),   // litro framework internals
  },

  // ─── RUNTIME CONFIG ──────────────────────────────────────────────────────

  runtimeConfig: {
    // Override with NITRO_* environment variables at deploy time.
    // Example: NITRO_APP_URL=https://mysite.com

    // Public app URL (used for generating absolute URLs in SSR)
    appUrl: process.env.APP_URL || 'http://localhost:3000',

    // Litro mode (server or static) — informational, not typically overridden
    litroMode: isStatic ? 'static' : 'server',
  },

  // ─── LOGGING ─────────────────────────────────────────────────────────────

  logLevel: process.env.NITRO_LOG_LEVEL ? parseInt(process.env.NITRO_LOG_LEVEL) : 3,

  // ─── TYPESCRIPT ──────────────────────────────────────────────────────────

  typescript: {
    strict: true,
    generateRuntimeConfigTypes: true,
  },

  // ─── IMPORTS (auto-import) ───────────────────────────────────────────────

  imports: {
    // Auto-import utilities from server/utils/ (no explicit import needed)
    dirs: ['server/utils'],
  },
})
```

---

## 12. Gotchas and Limitations

### 12.1 Nitro Plugins vs Runtime Plugins (Critical Naming Conflict)

The word "plugin" is overloaded. Nitro has two completely separate plugin systems:
- **Build plugins** (`nitro.config.ts` `plugins: [...]`): Run at BUILD TIME. Receive `Nitro` instance. Use `nitro.hooks.hook(...)`.
- **Runtime plugins** (`server/plugins/` directory): Run at SERVER STARTUP. Receive `nitroApp`. Use `nitroApp.hooks.hook(...)`.

Mixing them up will cause confusing errors. Litro's page scanner is a BUILD plugin. Request logging is a RUNTIME plugin.

### 12.2 `nitro:config` Hook Fires Early

The `nitro:config` hook fires during `createNitro()`, before the config is resolved into `nitro.options`. Mutations made here affect the raw config object, not the resolved options. The `nitro:build:before` hook is safer for mutations because `nitro.options` is fully resolved by then.

### 12.3 Virtual Modules with Factory Functions

Virtual module factories are called synchronously during Rollup's transform phase. If you need async data (e.g., file system reads), you must either:
1. Pre-compute the data in `nitro:build:before` and store it in a closure
2. Use the sync factory but read files synchronously (`fs.readFileSync`)
3. Use `nitro.options.virtual` directly from a `nitro:build:before` hook (set the value to a string, not a factory)

### 12.4 `handlers` Added in `nitro:build:before` Must Use Absolute Paths

When adding handlers via `nitro.options.handlers.push(...)` in a plugin, the `handler` field must be an absolute path or a `~`-aliased path. Relative paths are resolved relative to `rootDir`, not the plugin file.

### 12.5 `devHandlers` Are Ignored in Production

`devHandlers` entries are completely excluded from the production build. Do not put any production logic in them. Vite middleware must ONLY be in `devHandlers`.

### 12.6 Cloudflare Pages: No `process.env`

On Cloudflare Workers runtime, `process.env` is not populated. Nitro's `runtimeConfig` values must be injected via Cloudflare bindings and accessed via `event.context.cloudflare.env`. This requires a special handling in `useRuntimeConfig()` for CF deployments. Nitro handles this via the `cloudflare-pages` preset's runtime entry, but you must configure bindings in Cloudflare dashboard.

### 12.7 `@lit-labs/ssr` Must Be Inlined for Edge Adapters

When using `cloudflare-pages`, `vercel-edge`, or `netlify-edge`, all dependencies must be bundled into a single file. `@lit-labs/ssr` has deep imports that Nitro's default externals detection might miss. Explicitly add it to `externals.inline` to ensure it is bundled.

### 12.8 Prerendering and `crawlLinks`

`crawlLinks: true` only discovers links in `<a href="...">` elements in the HTML response. It does NOT:
- Follow JavaScript-generated links
- Discover routes from `@vaadin/router` config
- Follow links in JSON responses

For Litro, the page scanner must add all known routes to `prerender.routes` explicitly via the `prerender:config` hook, rather than relying on crawling.

### 12.9 File Watching in Dev Does Not Re-Run `nitro:build:before`

In dev mode, when Nitro detects a file change and reloads, it triggers `nitro:dev:reload` but does NOT re-run `nitro:build:before`. This means that if you add a new page file:
- The `nitro:dev:reload` hook fires
- But `nitro.options.handlers` is NOT updated automatically
- A full restart is required to pick up new routes in dev

**Workaround for Litro:** Use a single catch-all handler that reads the page manifest dynamically (via a virtual module that re-evaluates on reload), rather than per-page handlers. This way, new pages are discovered without a full restart because the catch-all handler looks up the current manifest at request time.

### 12.10 Handler `lazy: true` and Tree Shaking

Setting `lazy: true` on handlers enables code splitting (the handler is loaded on first request rather than at startup). This is important for reducing cold-start time. However, lazy handlers cannot be tree-shaken by Rollup and will always be included in the bundle even if never called.

### 12.11 Static Preset Does Not Produce a Server

`preset: 'static'` produces ONLY static files. There is no server fallback. Any route not prerendered will result in a 404 from the static host. For Litro's SSG mode, ALL page routes must be in `prerender.routes`.

### 12.12 Order of `publicAssets` Entries Matters

Nitro processes `publicAssets` entries in order. If two directories have overlapping `baseURL` paths, the first matching entry wins. Always put the most specific entries first.

### 12.13 `autoSubfolderIndex` and Static Host Compatibility

Not all static hosts serve `about/index.html` for requests to `/about`. Test the deployment target. Azure Static Web Apps and Cloudflare Pages both support this pattern. Some simpler static hosts do not. Use `autoSubfolderIndex: false` and configure the host's 404/rewrite rules if needed.

---

## 13. Recommended Approach for Litro

### 13.1 Dev Mode Architecture

```
litro dev
  ├── Start Vite with middlewareMode: true (NO HTTP listener)
  ├── Start Nitro dev server on port 3000
  │   ├── Register Vite middleware as devHandler at /_vite
  │   │   └── Handles: JS modules, CSS, HMR WebSocket
  │   ├── Nitro handles: /api/**, page routes, /public/**
  │   └── All traffic on ONE port: 3000
  └── Single command, single port, full HMR
```

### 13.2 Build Pipeline (Production)

```
litro build [--mode static|server] [--preset <name>]
  1. Run Vite build → dist/client/  (hashed assets)
  2. Run Nitro build:
     a. nitroPagesPlugin (nitro:build:before):
        - Scan pages/ with fast-glob
        - Register per-page handlers in nitro.options.handlers
        - Generate #litro/page-manifest virtual module
        - Add all static routes to prerender.routes (via prerender:config)
     b. Rollup bundles server code
     c. copyPublicAssets copies dist/client/ to .output/public/_litro/
     d. If mode=static: prerender() runs, writes .output/public/**/*.html
```

### 13.3 Plugin Architecture for Litro

```
packages/framework/src/plugins/
  nitro-pages-plugin.ts    ← BUILD plugin: page scan, route registration, prerender targets
  nitro-ssr-plugin.ts      ← BUILD plugin: registers @lit-labs/ssr handler (I-3)
server/plugins/
  (user's runtime plugins) ← RUNTIME plugins: auto-loaded from server/plugins/
```

### 13.4 Virtual Module Strategy

Use three virtual modules:
1. `#litro/page-manifest` — maps URL patterns to page component module paths (server+client)
2. `#litro/routes` — `@vaadin/router`-compatible route config (client bundle, written to `dist/client/routes.generated.ts`)
3. `#litro/config` — Litro framework config (preset, mode, etc.)

### 13.5 Page Handler Pattern

The recommended single catch-all handler approach:

```ts
// server/handlers/page.ts (the catch-all handler)
import { pages } from '#litro/page-manifest'
import { renderPage } from '#litro/ssr'

export default defineEventHandler(async (event) => {
  const path = event.path
  const page = pages.find(p => matchesRoute(p.pattern, path))

  if (!page) {
    throw createError({ statusCode: 404 })
  }

  // Dynamically import the page component
  const { default: PageComponent, routeMeta } = await import(page.moduleId)

  // Delegate to the SSR pipeline (I-3)
  return renderPage(event, PageComponent, routeMeta)
})
```

This approach means new pages don't require Nitro restart in dev — the catch-all always looks up the current manifest.

### 13.6 Deployment Adapter Strategy

- **Default / Coolify / Docker:** `preset: 'node-server'` — zero config, works everywhere with Node.js
- **Azure production:** `preset: 'azure'` (Azure Static Web Apps) — combines CDN static hosting with Functions backend
- **Cloudflare:** `preset: 'cloudflare-pages'` — best edge performance; note V8 isolate limitations
- **Vercel:** `preset: 'vercel'` or `preset: 'vercel-edge'` — auto-detected by Vercel CLI
- **Netlify:** `preset: 'netlify'` or `preset: 'netlify-edge'` — auto-detected by Netlify CLI
- **Static JAMstack:** `preset: 'static'` — no server, pure CDN

All adapters share the same codebase. The adapter is switched via `NITRO_PRESET` env var or `--preset` CLI flag.

---

## 14. Sources

> Note: WebFetch and WebSearch were not available in this agent's execution environment. The following sources were referenced from training knowledge (through August 2025). Implementation agents should verify against live documentation.

- **Nitro documentation:** https://nitro.unjs.io/config
- **Nitro routing guide:** https://nitro.unjs.io/guide/routing
- **Nitro plugins guide:** https://nitro.unjs.io/guide/plugins
- **Nitro deployment guide:** https://nitro.unjs.io/deploy
- **Nitro GitHub — types source:** https://github.com/unjs/nitro/blob/main/src/types/nitro.ts
- **Nitro GitHub — config source:** https://github.com/unjs/nitro/blob/main/src/config.ts
- **Nitro GitHub — prerender source:** https://github.com/unjs/nitro/blob/main/src/prerender/
- **H3 documentation (Nitro's HTTP toolkit):** https://h3.unjs.io
- **UnJS ecosystem:** https://unjs.io
- **Nuxt's Nitro configuration reference** (R-1 findings cross-reference): `packages/nuxt/src/core/nitro.ts`
- **Nitro v2 changelog:** https://github.com/unjs/nitro/releases
