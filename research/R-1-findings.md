# R-1 Findings: Nuxt Internals — Page Scanning, Route Generation, and Vite/Nitro Coordination

**Agent:** R-1
**Date:** 2026-02-28
**Status:** Complete

---

## 1. Summary

Nuxt's pages layer is implemented almost entirely in `packages/nuxt/src/pages/module.ts` and `packages/nuxt/src/pages/utils.ts`. It uses `fast-glob` (via the `@nuxt/kit` helper `resolveFiles`) together with the `pathe` library for path normalization to scan the filesystem. File paths are converted to route definition objects through a recursive algorithm that strips extensions, replaces bracket segments (`[param]`) with colon-prefixed params (`:param`), and handles special conventions for catch-all routes (`[...slug]` → `:slug(.*)*`). Nuxt configures Nitro programmatically through `packages/nuxt/src/core/nitro.ts`, injecting virtual module aliases, public asset directories, and prerender routes directly into Nitro's config object before Nitro is initialized. In dev mode, Nuxt runs Vite inside the same Node process as Nitro — Vite's dev middleware is mounted into Nitro's connect-compatible middleware stack via `nitro.options.devHandlers`, so there is only one actual listening HTTP server on a single port; no cross-process proxy is needed. In production, Vite's `dist/client/` output directory is registered as a Nitro `publicAssets` entry so Nitro bundles and serves it with appropriate long-lived cache headers across all deployment adapters.

---

## 2. Key APIs and Patterns

### 2.1 Libraries Used

| Purpose | Library | Notes |
|---|---|---|
| File scanning | `fast-glob` (via `@nuxt/kit`'s `resolveFiles`) | Nuxt wraps fast-glob; Litro can use `fast-glob` directly |
| Path normalization | `pathe` | Cross-platform `/`-separated paths; always use instead of Node `path` |
| Route sorting | Custom comparator in `utils.ts` | Static before dynamic, specificity ordering |
| Config merging | `defu` | Deep-merge config objects with sensible defaults (later values are defaults) |
| Nitro programmatic API | `createNitro`, `build`, `prepare`, `copyPublicAssets`, `prerender`, `createDevServer` | All from the `nitropack` package |
| Connect middleware bridge | `fromNodeMiddleware` | From the `h3` package; wraps Vite's connect middleware as an H3 handler |
| File watching (dev) | `chokidar` | Used by both Nitro's dev watcher and Nuxt's page-dir watcher |

### 2.2 Route Definition Shape (NuxtPage)

The exact TypeScript interface Nuxt uses for a resolved page/route object (from `packages/nuxt/src/pages/types.ts`):

```typescript
interface NuxtPage {
  name?: string                // optional route name, e.g. "blog-slug"
  path: string                 // the route path, e.g. "/blog/:slug"
  file?: string                // absolute path to the source file
  meta?: Record<string, any>   // arbitrary route metadata (title, auth, etc.)
  alias?: string | string[]    // route aliases
  redirect?: string            // redirect target
  children?: NuxtPage[]        // nested routes (used for layout nesting)
  props?: boolean | Record<string, any> | ((to: any) => Record<string, any>)
}
```

For Litro's purposes the minimal shared shape needed is:

```typescript
// packages/framework/src/types/route.ts
export interface LitroRoute {
  path: string          // "/", "/about", "/blog/:slug", "/:all(.*)*"
  file: string          // absolute path to the .ts page file
  name: string          // kebab-case name derived from file path, e.g. "blog-slug"
  isDynamic: boolean    // true if any segment contains a param
  isCatchAll: boolean   // true if route contains (.*)*
  params: string[]      // list of param names, e.g. ["slug"]
  meta?: LitroRouteMeta // from the file's optional `routeMeta` named export
}

export interface LitroRouteMeta {
  title?: string
  description?: string
  // guards, layout, etc. can be added here later
  [key: string]: unknown
}
```

### 2.3 Nitro Programmatic API (from `nitropack` package)

```typescript
import {
  createNitro,       // (config: NitroConfig) => Promise<Nitro>
  build,             // (nitro: Nitro) => Promise<void>
  prepare,           // (nitro: Nitro) => Promise<void> — creates output dirs
  copyPublicAssets,  // (nitro: Nitro) => Promise<void>
  prerender,         // (nitro: Nitro) => Promise<void>
  createDevServer,   // (nitro: Nitro) => NitroDevServer
} from 'nitropack'
```

`createNitro(config)` creates a fully resolved Nitro instance. You call `prepare` before `build` to ensure output directories exist. `createDevServer` wraps the Nitro instance in a dev-mode HTTP listener with file watching and hot reload.

### 2.4 Key `@nuxt/kit` Helpers Litro Should Reimplement Directly

Since Litro does not use `@nuxt/kit`, these should be reimplemented directly:

- **`resolveFiles(dir, pattern)`** — equivalent to `fastGlob(pattern, { cwd: dir, absolute: true })`
- **`addTemplate`** — write a generated file to `.nitro/` or `dist/`; in Litro, just write to `dist/client/routes.generated.js`
- **`extendPages(pages => ...)`** — Litro's equivalent is a Nitro plugin function that mutates the route array during the `nitro:build:before` hook

---

## 3. File Scanner Implementation

### 3.1 What Nuxt Does

In `packages/nuxt/src/pages/module.ts`, Nuxt's setup hook runs file scanning with this logic:

```typescript
// Simplified from Nuxt source — packages/nuxt/src/pages/module.ts
const pageFiles = await resolveFiles(pagesDir, `**/*{${pageExtensions.join(',')}}`)
// pageExtensions defaults to ['.vue', '.ts', '.tsx', '.js', '.jsx', '.mjs']
```

The actual `resolveFiles` implementation (from `packages/kit/src/resolve.ts`, simplified):

```typescript
import fastGlob from 'fast-glob'
import { resolve } from 'pathe'

async function resolveFiles(path: string, pattern: string | string[]): Promise<string[]> {
  const files = await fastGlob(pattern, {
    cwd: path,
    followSymbolicLinks: true,
    onlyFiles: true,
  })
  return files.map(f => resolve(path, f)).sort()
}
```

### 3.2 Glob Pattern

Nuxt uses: `**/*{.vue,.ts,.tsx,.js,.jsx,.mjs}`

For Litro (TypeScript-only framework): `**/*.{ts,tsx}`

Nuxt also applies these exclusions:
- `**/*.d.ts` — TypeScript declaration files must never become routes
- Files where any segment starts with `-` — convention for disabling a route file without deleting it (e.g. `-about.ts` is ignored)
- `node_modules/**` — always ignored by fast-glob's default behavior when `cwd` is set correctly

### 3.3 Directory Watching in Dev

Nuxt watches the `pages/` directory with `chokidar`. On `add`, `unlink`, or `change` events it re-runs the page scan and triggers a Nitro reload. Nuxt uses the `updateConfig` mechanism or calls `nuxt.callHook('pages:extend', pages)` to propagate changes.

In Nitro's dev server you hook into the reload cycle via:

```typescript
nitro.hooks.hook('dev:reload', async () => {
  // Re-scan pages and update handlers
})
```

Or more precisely for Litro's use case, watch with chokidar and call `nitro.updateConfig({ handlers: newHandlers })` — though the exact API depends on the Nitro version. The safer approach is a full dev server restart on page file additions/deletions (fast, since Nitro restarts in < 1 second), and rely on Vite HMR for component-level changes that don't affect routing.

### 3.4 Litro Scanner Implementation

```typescript
// packages/framework/src/scanner.ts
import fastGlob from 'fast-glob'
import { resolve, relative, extname, basename, dirname } from 'pathe'

export async function scanPages(pagesDir: string): Promise<string[]> {
  const files = await fastGlob('**/*.{ts,tsx}', {
    cwd: pagesDir,
    absolute: true,
    followSymbolicLinks: true,
    onlyFiles: true,
    ignore: [
      '**/*.d.ts',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/-*.ts',   // files starting with dash are disabled routes
      '**/-*.tsx',
    ],
  })
  return files.sort()
}
```

---

## 4. Path-to-Route Conversion

### 4.1 Nuxt's Algorithm (from `packages/nuxt/src/pages/utils.ts`)

The key function is `generateRoutesFromFiles(files, pagesDir, routeNameSplitter?, trailingSlash?)`. It is exported and is the heart of the pages system.

**Step-by-step algorithm:**

1. Strip the `pagesDir` prefix from the absolute file path to get the relative path
2. Strip the file extension (`.ts`, `.tsx`, `.vue`, etc.)
3. Split the remaining relative path into segments by `/`
4. For each segment, apply transformations to produce the route segment and a name fragment:
   - `index` as the **last** segment → empty string (represents the parent/index route)
   - `index` as a **non-last** segment → kept as-is (unusual, but handled)
   - `[...param]` → `:param(.*)*` (catch-all; must be the last segment)
   - `[[param]]` → `:param?` (optional param)
   - `[param]` → `:param` (required dynamic param)
   - Anything else → kept as a static segment
5. Join transformed segments with `/` and prepend `/`
6. Compute the route `name` by joining the original segment names (with bracket syntax stripped) using the `routeNameSplitter` (defaults to `-`)

### 4.2 Full Pseudocode

```
function fileToRoute(absoluteFilePath, pagesDir):
  // Step 1: get relative path without extension
  relative = absoluteFilePath
    .removePrefix(pagesDir + "/")
    .removeSuffix(extname(absoluteFilePath))   // e.g. strip ".ts"

  // Step 2: split into segments
  segments = relative.split("/")

  routeSegments = []
  nameParts = []

  for i, segment in enumerate(segments):
    isLast = (i == segments.length - 1)

    // Handle index convention
    if segment == "index" and isLast:
      // index.ts at any level represents the parent route
      // Do NOT push to routeSegments (results in "" which join handles)
      // Do add "index" to nameParts for disambiguation in naming
      nameParts.push("index")
      continue

    // Strip brackets to get the name fragment
    namePart = segment
      .replace(/^\[\.\.\.(\w+)\]$/, '$1')   // [...slug] → slug
      .replace(/^\[\[(\w+)\]\]$/, '$1')      // [[id]] → id
      .replace(/^\[(\w+)\]$/, '$1')          // [id] → id
    nameParts.push(namePart)

    // Transform segment to route segment
    routeSegment = segment
      .replace(/^\[\.\.\.(\w+)\]$/, ':$1(.*)*')   // catch-all
      .replace(/^\[\[(\w+)\]\]$/, ':$1?')           // optional param
      .replace(/^\[(\w+)\]$/, ':$1')                // required param
      // static segments pass through unchanged

    routeSegments.push(routeSegment)

  // Step 3: build path and name
  path = "/" + routeSegments.join("/")
  // Normalize double slashes that can arise from empty segments:
  path = path.replace("//", "/")

  // For the root index route, path ends up as "/"
  // For blog/index, path ends up as "/blog"
  name = nameParts
    .filter(p => p != "index" or nameParts.length == 1)
    .join("-")

  // Determine param list
  params = routeSegments
    .filter(s => s.startsWith(":"))
    .map(s => s.replace(/^:(\w+).*$/, '$1'))

  return {
    path,
    name,
    file: absoluteFilePath,
    isDynamic: params.length > 0,
    isCatchAll: path.includes("(.*)*"),
    params,
  }
```

### 4.3 Concrete Conversion Examples

| File path | Stripped relative | Route path | Route name | isDynamic |
|---|---|---|---|---|
| `pages/index.ts` | `index` | `/` | `index` | false |
| `pages/about.ts` | `about` | `/about` | `about` | false |
| `pages/blog/index.ts` | `blog/index` | `/blog` | `blog` | false |
| `pages/blog/[slug].ts` | `blog/[slug]` | `/blog/:slug` | `blog-slug` | true |
| `pages/[...all].ts` | `[...all]` | `/:all(.*)*` | `all` | true |
| `pages/users/[id]/profile.ts` | `users/[id]/profile` | `/users/:id/profile` | `users-id-profile` | true |
| `pages/[[lang]]/index.ts` | `[[lang]]/index` | `/:lang?` | `lang` | true |
| `pages/shop/[category]/[item].ts` | `shop/[category]/[item]` | `/shop/:category/:item` | `shop-category-item` | true |

### 4.4 Route Sorting (Specificity Ordering)

Routes must be registered in specificity order so that the most specific route matches first. Nuxt's comparator (simplified from `utils.ts`):

```typescript
function compareRoutes(a: LitroRoute, b: LitroRoute): number {
  // 1. Catch-all routes always go last
  if (a.isCatchAll !== b.isCatchAll) {
    return a.isCatchAll ? 1 : -1
  }

  // 2. Static routes before dynamic routes
  if (a.isDynamic !== b.isDynamic) {
    return a.isDynamic ? 1 : -1
  }

  // 3. Routes with fewer dynamic segments rank higher
  if (a.params.length !== b.params.length) {
    return a.params.length - b.params.length
  }

  // 4. Alphabetical within the same category
  return a.path.localeCompare(b.path)
}
```

### 4.5 Nested Routes and Layout Nesting

Nuxt implements layout nesting by detecting when a file and a directory share the same name:

```
pages/
  blog.ts          ← parent layout route (contains <NuxtPage> outlet)
  blog/
    index.ts       ← /blog child route
    [slug].ts      ← /blog/:slug child route
```

`blog.ts` becomes the parent with `children: [blogIndex, blogSlug]`. The parent route must render an outlet (`<NuxtPage>` in Vue, `<litro-outlet>` in Litro).

Detection algorithm:
```
for each directory in pages/:
  if a file exists at pages/<dirName>.ts:
    make that file the parent
    make all files inside pages/<dirName>/ its children
```

For Litro MVP, nested layouts can be deferred. The page scanner can implement a flat route list first and add nesting support later.

---

## 5. Vite + Nitro Coordination

### 5.1 Dev Mode: Single Server, No Proxy

**Key insight: there is only ONE HTTP server in dev mode.** Nuxt does NOT run Vite on a separate port. Vite is started in `middlewareMode: true`, which means it exposes a connect-compatible middleware stack but does NOT start its own HTTP listener. That middleware is then mounted into Nitro's dev server.

The full sequence when `nuxt dev` runs:

```
1. Nuxt reads config and resolves all options
       |
       v
2. Nuxt creates the Nitro dev instance
   createNitro({ ...config, dev: true })
       |
       v
3. Nuxt creates the Vite server in middleware mode
   viteServer = await vite.createServer({
     server: { middlewareMode: true },
     appType: 'custom',
   })
   // viteServer is NOT listening on any port yet
       |
       v
4. Nuxt mounts Vite's middleware into Nitro's dev handlers
   nitro.options.devHandlers.push({
     route: '/_nuxt',
     handler: fromNodeMiddleware(viteServer.middlewares),
   })
       |
       v
5. Nitro dev server starts listening on :3000
   devServer = createDevServer(nitro)
   await devServer.listen()
   // Only ONE port is now open: 3000
       |
       v
6. Vite HMR WebSocket is attached to Nitro's HTTP server
   viteServer.httpServer = devServer.httpServer
   // Vite's WebSocket client connects to ws://localhost:3000
   // (not a separate port)
```

### 5.2 Request Flow in Dev Mode

```
Browser: GET /about
    → Nitro (port 3000)
    → Nitro route handler for /about
    → SSR pipeline renders Lit component
    → Response: HTML with <script src="/_litro/app.js">

Browser: GET /_litro/app.js
    → Nitro (port 3000)
    → devHandler for route /_litro/*
    → Vite middleware handles it
    → Returns the transformed ESM module

Browser: WebSocket ws://localhost:3000 (HMR)
    → Nitro's httpServer
    → Vite's WebSocket handler (attached in step 6)
    → HMR updates pushed to browser
```

### 5.3 Vite Configuration for Middleware Mode

```typescript
// In the Litro dev command
import { createServer as createViteServer } from 'vite'

const viteServer = await createViteServer({
  // Load user's vite.config.ts, merged with these required options:
  server: {
    middlewareMode: true,   // CRITICAL: no standalone HTTP listener
  },
  appType: 'custom',        // Disables Vite's default index.html serving
                            // and 404 fallback (Nitro handles both)
})
```

`appType: 'custom'` disables:
- Vite's built-in HTML transform and serving
- Vite's SPA fallback (serving `index.html` for all 404s)
- Vite's error overlay injection (must implement separately)

These are all intentionally disabled because Nitro/Litro handles HTML generation server-side.

### 5.4 Mounting Vite Middleware into Nitro

```typescript
import { fromNodeMiddleware } from 'h3'

// After creating viteServer, inject into Nitro:
nitro.options.devHandlers.push({
  route: '/_litro',               // all /_litro/* requests go to Vite
  handler: fromNodeMiddleware(viteServer.middlewares),
})
```

`fromNodeMiddleware` (from the `h3` package) bridges the connect middleware interface (what Vite exposes via `.middlewares`) to H3's event handler interface (what Nitro consumes).

The `NitroDevEventHandler` type:

```typescript
interface NitroDevEventHandler {
  route?: string        // path prefix; requests matching this go to handler
  handler: EventHandler // H3 EventHandler
  lazy?: boolean        // whether to lazily load the handler
}
```

### 5.5 HMR WebSocket Attachment

```typescript
// After devServer.listen() resolves, wire Vite's WebSocket through Nitro's server:
viteServer.httpServer = devServer.httpServer

// In some Vite versions you may need to explicitly re-init the WS server:
// viteServer.ws.close()
// viteServer.ws = createWebSocketServer(devServer.httpServer, viteConfig, ...)

// The simpler approach that works with current Vite (5.x):
// Vite detects httpServer is set and uses it for the WS upgrade handler
// This must be done AFTER devServer.listen() so httpServer is not null
```

**Important ordering:** `devServer.listen()` must be called before setting `viteServer.httpServer`. If you set it before `listen()`, `httpServer` may still be null. If you call `viteServer.ws.listen()` before setting `httpServer`, Vite may attempt to open its own port.

### 5.6 Production: Serving Vite Output as Static Assets

In production, the build sequence is:

```
Step 1: vite build → dist/client/
  Output includes:
  - dist/client/app.js (content-hashed, e.g. app.Bx7Pq2Zk.js)
  - dist/client/app.css (if applicable)
  - dist/client/.vite/manifest.json (maps entry names to hashed filenames)

Step 2: nitro build
  Nitro reads publicAssets config and includes dist/client/ in its output bundle.
  All deployment adapters know to serve these as static files.
```

The Nitro config that wires this up:

```typescript
publicAssets: [
  {
    dir: resolve(rootDir, 'dist/client'),
    baseURL: '/_litro/',              // served at /_litro/app.Bx7Pq2Zk.js
    maxAge: 60 * 60 * 24 * 365,      // 1 year — safe because filenames are content-hashed
    fallthrough: false,               // 404 if not found (don't pass to page handler)
  },
]
```

The HTML shell must reference the hashed filename. To get the correct filename after a Vite build, read Vite's manifest:

```typescript
// Read dist/client/.vite/manifest.json after vite build
import manifest from './dist/client/.vite/manifest.json' assert { type: 'json' }
const appJsUrl = `/_litro/${manifest['app.ts'].file}`
// → "/_litro/assets/app.Bx7Pq2Zk.js"
```

This manifest reading should happen in the Nitro plugin at build time, so the HTML shell template is populated with the correct URLs before Nitro bundles everything.

### 5.7 `publicAssets` vs `publicDir`: Critical Distinction

| Option | Behavior | Adapter compatibility |
|---|---|---|
| `publicDir` | Served from root URL; files are copied to `.output/public/` | Works for node, static; may NOT work on Cloudflare Workers |
| `publicAssets` (array) | Files bundled into the Nitro output package; each entry gets a `baseURL` and cache headers | Works on ALL adapters including edge (Cloudflare, Vercel Edge) |

**For Litro:** All Vite client assets MUST use `publicAssets`, not `publicDir`, to ensure edge adapter compatibility. `publicDir` can still be used for user-supplied static files (`public/` directory) that are not content-hashed.

---

## 6. How Nuxt Configures Nitro Programmatically

### 6.1 Entry Point: `packages/nuxt/src/core/nitro.ts`

This file exports an `initNitro(nuxt)` function called during `nuxt.ready()`. Key operations (annotated):

```typescript
// packages/nuxt/src/core/nitro.ts (simplified and annotated)
import { createNitro, createDevServer, build, prepare } from 'nitropack'
import defu from 'defu'

export async function initNitro(nuxt: Nuxt) {
  // 1. Compose the Nitro config by merging:
  //    - Nuxt's required settings (highest priority)
  //    - User's nuxt.config.ts nitro: {} block
  //    - Sensible defaults (lowest priority)
  const nitroConfig: NitroConfig = defu(
    // Required Nuxt overrides (cannot be overridden by user):
    {
      rootDir: nuxt.options.rootDir,
      srcDir: nuxt.options.serverDir,
      dev: nuxt.options.dev,
      preset: nuxt.options.nitro.preset,
    },
    // User's nitro config from nuxt.config.ts:
    nuxt.options.nitro,
    // Nuxt's defaults:
    {
      // Virtual modules: inject generated files without writing to disk
      virtual: {
        '#build/routes.mjs': () => generateRoutesVirtualModule(nuxt._pages),
        '#internal/nuxt/paths': () => `export const appDir = '${nuxt.options.appDir}'`,
        // ... many more
      },

      // Module aliases
      alias: {
        '#app': nuxt.options.appDir,
        '#imports': resolve(nuxt.options.buildDir, 'imports.d.ts'),
      },

      // Serve Vite's output as static assets in production
      publicAssets: [
        {
          dir: resolve(nuxt.options.buildDir, 'dist/client'),
          maxAge: 31536000,
          baseURL: nuxt.options.app.baseURL + '_nuxt/',
        },
      ],

      // Dev-only: Vite middleware injected here (see section 5)
      devHandlers: [],

      // Prerender config populated by the pages module
      prerender: {
        routes: [],          // filled by pages module
        crawlLinks: nuxt.options.ssr,
      },
    }
  )

  // 2. Create the Nitro instance
  const nitro = await createNitro(nitroConfig)

  // 3. Bridge Nuxt hooks into Nitro hooks
  nitro.hooks.hook('nitro:build:before', async (n) => {
    await nuxt.callHook('nitro:build:before', n)
  })
  nitro.hooks.hook('nitro:build:public-assets', async (n) => {
    await nuxt.callHook('nitro:build:public-assets', n)
  })

  // 4. Store on the Nuxt instance for access by other modules
  nuxt._nitro = nitro

  // 5. Register the Nitro instance as a Nuxt hook target
  await nuxt.callHook('nitro:init', nitro)
}
```

### 6.2 How Prerender Routes Are Passed from Pages to Nitro

The pages module hooks into `pages:extend` and populates Nitro's prerender config:

```typescript
// In packages/nuxt/src/pages/module.ts (simplified)
nuxt.hook('pages:extend', (pages: NuxtPage[]) => {
  // Collect all static (non-dynamic) routes for prerendering
  const staticRoutes: string[] = []

  function collectRoutes(pages: NuxtPage[]) {
    for (const page of pages) {
      if (!page.path.includes(':') && !page.path.includes('*')) {
        staticRoutes.push(page.path)
      }
      if (page.children) {
        collectRoutes(page.children)
      }
    }
  }

  collectRoutes(pages)

  // Merge into Nitro config via nuxt.options
  nuxt.options.nitro.prerender = defu(nuxt.options.nitro.prerender, {
    routes: staticRoutes,
  })
})
```

For Litro's Nitro plugin, the equivalent is done directly in the `nitro:build:before` hook:

```typescript
nitro.hooks.hook('nitro:build:before', async (nitro) => {
  const routes = await scanPages(pagesDir)

  const staticPaths = routes
    .filter(r => !r.isDynamic)
    .map(r => r.path)

  // For dynamic routes with generateRoutes export
  for (const route of routes.filter(r => r.isDynamic)) {
    try {
      const mod = await import(route.file)
      if (typeof mod.generateRoutes === 'function') {
        const paths: string[] = await mod.generateRoutes()
        staticPaths.push(...paths)
      }
    } catch {
      // Module import during build is optional; skip silently
    }
  }

  nitro.options.prerender.routes = [
    ...(nitro.options.prerender.routes || []),
    ...staticPaths,
  ]
})
```

---

## 7. Minimal Nitro Config

### 7.1 Truly Minimal — One Route, One Response

```typescript
// nitro.config.ts
import { defineNitroConfig } from 'nitropack/config'

export default defineNitroConfig({
  // Nitro's file-based routing picks up server/routes/**
  // No additional config needed for a single handler
})
```

```typescript
// server/routes/index.ts  (maps to GET /)
import { defineEventHandler } from 'h3'

export default defineEventHandler(() => {
  return '<html><body><h1>Hello from Nitro</h1></body></html>'
})
```

Run with: `npx nitro dev` or `npx nitropack dev`.

### 7.2 Fully Annotated Config for Litro's Use Case

```typescript
// nitro.config.ts
import { defineNitroConfig } from 'nitropack/config'
import { resolve } from 'pathe'

const rootDir = new URL('.', import.meta.url).pathname

export default defineNitroConfig({

  // ─── Core ─────────────────────────────────────────────────────────────────
  // rootDir defaults to the directory containing nitro.config.ts
  rootDir,
  srcDir: resolve(rootDir, 'server'),       // where server/routes/, server/api/, etc. live

  // ─── Routing ──────────────────────────────────────────────────────────────
  // File-based routes in server/routes/ are auto-registered.
  // The Litro page scanner Nitro plugin injects page handlers programmatically
  // into nitro.options.handlers during the nitro:build:before hook.
  // handlers: []  ← filled by the pages plugin

  // Route rules: per-route caching, CORS, redirects, headers, proxy
  routeRules: {
    // Client assets: immutable cache (content-hashed filenames)
    '/_litro/**': {
      headers: { 'cache-control': 'max-age=31536000, immutable' },
    },
    // API routes: enable CORS, no caching
    '/api/**': {
      cors: true,
      headers: { 'cache-control': 'no-store' },
    },
    // Redirect example:
    // '/old-path': { redirect: '/new-path' },
  },

  // ─── Static Assets ────────────────────────────────────────────────────────
  // publicDir: files served as-is from root URL. Works for simple node
  // deployments but is NOT bundled into Nitro's output for edge adapters.
  // Use this for the user's raw public/ directory.
  publicDir: resolve(rootDir, 'public'),

  // publicAssets: bundled into Nitro's deployment output. Works on ALL
  // adapters including Cloudflare Workers and Vercel Edge.
  // Use this for Vite's content-hashed build output.
  publicAssets: [
    {
      dir: resolve(rootDir, 'dist/client'),
      baseURL: '/_litro/',
      maxAge: 60 * 60 * 24 * 365,   // 1 year — safe because filenames are content-hashed
      fallthrough: false,            // return 404 if file not found; don't pass to page handler
    },
  ],

  // ─── Prerendering (SSG mode) ──────────────────────────────────────────────
  prerender: {
    // Explicit routes to prerender. The Litro pages plugin adds all
    // static (non-dynamic) page routes here at build time.
    routes: ['/'],

    // If true, Nitro crawls all <a href> links found in prerendered pages
    // and adds them to the prerender queue automatically.
    // Set to true for full SSG mode, false for mixed SSR+SSG.
    crawlLinks: false,

    // Ignore patterns: don't prerender API routes or asset URLs
    ignore: ['/api/**', '/_litro/**'],
  },

  // ─── Development ──────────────────────────────────────────────────────────
  // devHandlers are only active during `nitro dev` (not in production builds).
  // The Litro dev command injects Vite's middleware here programmatically
  // after creating both the Nitro and Vite instances:
  //
  // nitro.options.devHandlers.push({
  //   route: '/_litro',
  //   handler: fromNodeMiddleware(viteServer.middlewares),
  // })
  //
  // Do not put devHandlers here in the static config because the Vite
  // server instance doesn't exist at config-parse time.

  // ─── Nitro Plugins ────────────────────────────────────────────────────────
  // Plugins run during Nitro initialization and can hook into build events.
  // The pages scanner is implemented as a Nitro plugin.
  plugins: [
    './nitro-plugins/pages.ts',
  ],

  // ─── Virtual Modules ──────────────────────────────────────────────────────
  // Inject generated content as importable virtual modules.
  // Values can be strings or functions returning strings (called lazily).
  virtual: {
    // Example: expose the scanned route manifest to server-side code
    // '#litro/routes': () => generateRoutesModuleContent(scannedRoutes),
  },

  // ─── TypeScript ───────────────────────────────────────────────────────────
  typescript: {
    strict: true,
    generateTsConfig: true,     // generates .nitro/tsconfig.json
    tsConfig: {
      compilerOptions: {
        moduleResolution: 'bundler',
      },
    },
  },

  // ─── Output ───────────────────────────────────────────────────────────────
  output: {
    dir: resolve(rootDir, 'dist/server'),
  },

  // ─── Experimental ─────────────────────────────────────────────────────────
  experimental: {
    // Enable if using Node.js streams in handlers (for @lit-labs/ssr streaming)
    asyncContext: true,
  },
})
```

### 7.3 Minimal Catch-All Page Handler (Skeleton for SSR)

```typescript
// server/routes/[...].ts  ← Nitro's catch-all file-based route
import { defineEventHandler, setHeader, setResponseStatus } from 'h3'

export default defineEventHandler(async (event) => {
  setHeader(event, 'content-type', 'text/html; charset=utf-8')

  // In the full I-3 implementation, this delegates to createPageHandler()
  // which calls @lit-labs/ssr. This skeleton confirms Nitro routing works.
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Litro App</title>
    <!--
      In production: reference the content-hashed filename from Vite manifest.
      In dev: Vite serves app.ts directly via the /_litro devHandler.
    -->
    <script type="module" src="/_litro/app.js"></script>
  </head>
  <body>
    <!--
      litro-outlet is the mount point for @vaadin/router.
      On SSR pages it contains DSD-rendered component markup.
      On client-nav pages it is empty and @vaadin/router fills it.
    -->
    <litro-outlet></litro-outlet>
  </body>
</html>`
})
```

---

## 8. Gotchas and Limitations

### 8.1 `middlewareMode` WebSocket Attachment Order Is Strict

Vite's HMR WebSocket must be attached to Nitro's `httpServer` AFTER Nitro starts listening. The sequence must be:

```
1. createNitro()
2. createViteServer({ server: { middlewareMode: true } })
3. nitro.options.devHandlers.push(viteMiddlewareHandler)
4. devServer = createDevServer(nitro)
5. await devServer.listen()                    ← httpServer is now non-null
6. viteServer.httpServer = devServer.httpServer ← attach AFTER listen()
```

If you set `viteServer.httpServer` before step 5, it will be null and Vite's WebSocket will fail to bind. If you forget step 6 entirely, HMR will not work (no WebSocket connection).

### 8.2 Route Handler Registration Order: Catch-All Must Be Last

Nitro processes handlers in array order. The catch-all page handler (`/**` or `/:all(.*)*`) must be the LAST entry:

```typescript
// WRONG — catch-all swallows everything before Nitro sees specific routes
handlers: [
  { route: '/**', handler: './pageHandler.ts' },   // captures /api/users !
  { route: '/api/**', handler: './apiRouter.ts' },  // never reached
]

// CORRECT — specific routes registered first
handlers: [
  { route: '/api/**', handler: './apiRouter.ts' },  // matches first
  { route: '/**', handler: './pageHandler.ts' },    // fallback
]
```

The Litro page scanner plugin must sort and register API handlers before page handlers.

### 8.3 `publicAssets` vs `publicDir`: Edge Adapter Support

`publicDir` works for `node` and `static` presets but Cloudflare Workers and other edge runtimes cannot serve files from a directory at runtime — they need assets pre-bundled or served from a CDN. The `publicAssets` array tells Nitro to include those files in the deployment bundle that adapters know how to serve.

**Rule for Litro:** Always use `publicAssets` for Vite output. Use `publicDir` only for user-supplied assets in `public/` (Nuxt also does this — it uses `publicDir` for `public/` and `publicAssets` for `_nuxt/`).

### 8.4 Dynamic Routes Cannot Be Prerendered Without Explicit Path Lists

If `preset: 'static'` is used and a dynamic route (e.g., `/blog/:slug`) has no `generateRoutes()` export, Nitro cannot know which paths to prerender and will silently skip it. Nuxt emits a warning. Litro should:
1. Detect dynamic routes during the pages scan
2. In static mode, attempt to call `generateRoutes()` from each dynamic page file
3. If not found, emit a console warning: `[litro] WARNING: /blog/:slug has no generateRoutes() export. This route will not be prerendered.`
4. Never throw an error (degrading gracefully is the correct behavior)

### 8.5 `appType: 'custom'` Disables Vite's Error Overlay

Setting `appType: 'custom'` in the Vite config removes Vite's built-in error overlay (the red box that appears on HMR errors). Nuxt reimplements its own error overlay. For Litro's MVP:
- Accept the loss of the overlay initially
- Surface SSR errors in the terminal (Nitro already does this)
- For a better DX, look at `vite-plugin-checker` or implement a simple WebSocket-based error bridge later

### 8.6 Always Use `pathe`, Never Node `path`

Node's `path` module uses OS-native separators (backslash on Windows). Glob patterns always use forward slashes. Using `path.join()` on Windows produces patterns like `pages\blog\[slug].ts` which fast-glob cannot match.

```typescript
// WRONG — breaks on Windows
import { join } from 'path'
const pattern = join(pagesDir, '**/*.ts')  // "pages\**\*.ts" on Windows

// CORRECT — always forward slashes
import { join } from 'pathe'
const pattern = join(pagesDir, '**/*.ts')  // "pages/**/*.ts" everywhere
```

Enforce `pathe` throughout all build tooling code in Litro.

### 8.7 Virtual Module Syntax in Nitro

Nitro's `virtual` config key uses `#` prefixes by convention (matching UnJS's aliasing conventions). The value can be a string or a function returning a string:

```typescript
virtual: {
  '#litro/routes': `export const routes = ${JSON.stringify(routes)}`,
  // Or lazily evaluated (called at bundle time):
  '#litro/routes': () => `export const routes = ${JSON.stringify(scannedRoutes)}`,
}
```

Consumers import it as: `import { routes } from '#litro/routes'`

This is the correct pattern for the server-side route manifest. The client-side route manifest should be a real file written to `dist/client/` (so Vite can bundle it) rather than a virtual module.

### 8.8 Nitro Plugin vs Nitro Config: When to Use Each

- **Static config** (`nitro.config.ts`): for options known at config-parse time (publicDir, routeRules, typescript settings)
- **Plugin hooks**: for anything that requires computation at build time (page scanning, route injection, manifest generation)
- **Dev command code**: for anything requiring runtime instances (Vite server reference, httpServer reference)

The page scanner MUST be a plugin (or invoked from the dev/build commands), not static config, because it reads the filesystem at build time.

### 8.9 Nitro's `handlers` Array Type

```typescript
interface NitroEventHandler {
  route?: string           // e.g. "/", "/api/**", "/**"
  handler: string          // path to the handler file (relative to rootDir or srcDir)
                           // OR an actual EventHandler function (in programmatic use)
  method?: string          // "get", "post", etc. — omit for all methods
  middleware?: boolean      // if true, handler runs for all routes (middleware mode)
  lazy?: boolean           // whether to lazily import the handler
}
```

When using the programmatic API (injecting handlers from a plugin), `handler` can be either a file path string or an actual H3 `EventHandler` function.

### 8.10 Content-Type Must Be Set for HTML Responses

Nitro does not automatically set `Content-Type: text/html` for string responses. You must set it explicitly:

```typescript
import { defineEventHandler, setHeader } from 'h3'

export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'text/html; charset=utf-8')
  return '<!DOCTYPE html>...'
})
```

Without this, some clients (and some Nitro adapters) may serve the HTML as `text/plain`, causing browsers to display raw markup.

---

## 9. Recommended Approach for Litro

### 9.1 File Scanner: Use `fast-glob` Directly

```typescript
// packages/framework/src/scanner.ts
import fastGlob from 'fast-glob'
import { resolve, relative, extname, basename, dirname, join } from 'pathe'

export interface LitroRoute {
  path: string
  file: string
  name: string
  isDynamic: boolean
  isCatchAll: boolean
  params: string[]
}

export async function scanPages(pagesDir: string): Promise<LitroRoute[]> {
  const files = await fastGlob('**/*.{ts,tsx}', {
    cwd: pagesDir,
    absolute: true,
    followSymbolicLinks: true,
    onlyFiles: true,
    ignore: ['**/*.d.ts', '**/*.test.ts', '**/*.spec.ts'],
  })

  return files
    .sort()
    .map(file => fileToRoute(file, pagesDir))
    .sort(compareRoutes)
}

export function fileToRoute(file: string, pagesDir: string): LitroRoute {
  const rel = relative(pagesDir, file).replace(/\.(ts|tsx)$/, '')
  const segments = rel.split('/')
  const routeSegments: string[] = []
  const nameParts: string[] = []

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const isLast = i === segments.length - 1

    if (seg === 'index' && isLast) {
      // index file → represents the parent route; skip from path but track name
      if (nameParts.length === 0) nameParts.push('index') // root index case
      continue
    }

    const namePart = seg
      .replace(/^\[\.\.\.(\w+)\]$/, '$1')
      .replace(/^\[\[(\w+)\]\]$/, '$1')
      .replace(/^\[(\w+)\]$/, '$1')
    nameParts.push(namePart)

    const routeSeg = seg
      .replace(/^\[\.\.\.(\w+)\]$/, ':$1(.*)*')
      .replace(/^\[\[(\w+)\]\]$/, ':$1?')
      .replace(/^\[(\w+)\]$/, ':$1')
    routeSegments.push(routeSeg)
  }

  const path = routeSegments.length === 0 ? '/' : '/' + routeSegments.join('/')
  const name = nameParts.join('-')
  const params = routeSegments
    .filter(s => s.startsWith(':'))
    .map(s => s.replace(/^:(\w+).*$/, '$1'))

  return {
    path,
    file,
    name,
    isDynamic: params.length > 0,
    isCatchAll: path.includes('(.*)*'),
    params,
  }
}

function compareRoutes(a: LitroRoute, b: LitroRoute): number {
  if (a.isCatchAll !== b.isCatchAll) return a.isCatchAll ? 1 : -1
  if (a.isDynamic !== b.isDynamic) return a.isDynamic ? 1 : -1
  if (a.params.length !== b.params.length) return a.params.length - b.params.length
  return a.path.localeCompare(b.path)
}
```

### 9.2 Nitro Plugin for Page Registration

```typescript
// nitro-plugins/pages.ts
import type { Nitro } from 'nitropack'
import { resolve } from 'pathe'
import { scanPages } from '../src/scanner.js'
import { defineEventHandler } from 'h3'

export default async function pagesPlugin(nitro: Nitro) {
  const pagesDir = resolve(nitro.options.rootDir, 'pages')

  nitro.hooks.hook('nitro:build:before', async () => {
    const routes = await scanPages(pagesDir)

    for (const route of routes) {
      // Register a Nitro handler for each page route
      nitro.options.handlers.push({
        route: route.path,
        // handler is a dynamically created function for each page
        handler: createPageEventHandler(route),
      })

      // For static routes, add to prerender list
      if (!route.isDynamic) {
        nitro.options.prerender.routes = [
          ...(nitro.options.prerender.routes || []),
          route.path,
        ]
      }

      // For dynamic routes, try to get explicit prerender paths
      if (route.isDynamic) {
        try {
          const mod = await import(route.file)
          if (typeof mod.generateRoutes === 'function') {
            const paths: string[] = await mod.generateRoutes()
            nitro.options.prerender.routes = [
              ...(nitro.options.prerender.routes || []),
              ...paths,
            ]
          } else if (nitro.options.preset === 'static') {
            console.warn(
              `[litro] WARNING: ${route.path} has no generateRoutes() export. ` +
              `This dynamic route will not be prerendered.`
            )
          }
        } catch {
          // Silently skip — import may fail if module has side effects
        }
      }
    }

    // Generate client-side route manifest
    await generateClientRouteManifest(routes, nitro.options.rootDir)
  })
}

function createPageEventHandler(route: LitroRoute) {
  return defineEventHandler(async (event) => {
    // This delegates to I-3's SSR pipeline
    // import() is used so the page module is loaded at request time
    const mod = await import(route.file)
    const ComponentClass = mod.default
    const routeMeta = mod.routeMeta
    return createSSRResponse(event, ComponentClass, routeMeta)
  })
}
```

### 9.3 Dev Server Bootstrap

```typescript
// packages/framework/src/cli/dev.ts
import { createNitro, createDevServer } from 'nitropack'
import { createServer as createViteServer } from 'vite'
import { fromNodeMiddleware } from 'h3'
import { loadNitroConfig } from './config.js'

export async function startDevServer(rootDir: string) {
  const nitroConfig = await loadNitroConfig(rootDir)

  // 1. Create Nitro instance (does not listen yet)
  const nitro = await createNitro({
    ...nitroConfig,
    dev: true,
  })

  // 2. Create Vite in middleware mode (does not listen yet)
  const viteServer = await createViteServer({
    root: rootDir,
    server: {
      middlewareMode: true,
    },
    appType: 'custom',
  })

  // 3. Mount Vite middleware into Nitro before Nitro starts
  nitro.options.devHandlers.push({
    route: '/_litro',
    handler: fromNodeMiddleware(viteServer.middlewares),
  })

  // 4. Start the Nitro dev server (this opens the HTTP listener)
  const devServer = createDevServer(nitro)
  await devServer.listen()

  // 5. Wire Vite's HMR WebSocket through Nitro's HTTP server
  //    Must happen AFTER devServer.listen() so httpServer is non-null
  viteServer.httpServer = devServer.httpServer

  console.log(`[litro] dev server running at http://localhost:${devServer.port}`)
  return { nitro, viteServer, devServer }
}
```

### 9.4 Production Build Sequence

```typescript
// packages/framework/src/cli/build.ts
import { createNitro, prepare, build, copyPublicAssets, prerender } from 'nitropack'
import { build as viteBuild } from 'vite'
import { resolve } from 'pathe'
import { readFileSync } from 'node:fs'

export async function buildProduction(rootDir: string, mode: 'server' | 'static' = 'server') {
  console.log('[litro] building client...')

  // Step 1: Vite client build
  await viteBuild({
    root: rootDir,
    build: {
      outDir: resolve(rootDir, 'dist/client'),
      manifest: true,          // generates .vite/manifest.json for filename lookup
      rollupOptions: {
        input: resolve(rootDir, 'app.ts'),
      },
    },
  })

  // Step 2: Read Vite manifest to get content-hashed filenames
  const manifest = JSON.parse(
    readFileSync(resolve(rootDir, 'dist/client/.vite/manifest.json'), 'utf-8')
  )
  const appJsFile = manifest['app.ts']?.file   // e.g. "assets/app.Bx7Pq2Zk.js"

  // Step 3: Build Nitro server
  console.log('[litro] building server...')
  const nitro = await createNitro({
    rootDir,
    preset: mode === 'static' ? 'static' : 'node',
    publicAssets: [
      {
        dir: resolve(rootDir, 'dist/client'),
        baseURL: '/_litro/',
        maxAge: 31536000,
      },
    ],
    // Inject the hashed filename for the HTML shell to reference
    virtual: {
      '#litro/manifest': `export const appJsUrl = '/_litro/${appJsFile}'`,
    },
  })

  await prepare(nitro)
  await copyPublicAssets(nitro)

  if (mode === 'static') {
    await prerender(nitro)
  } else {
    await build(nitro)
  }

  await nitro.close()
  console.log('[litro] build complete')
}
```

### 9.5 Client Route Manifest Format

The generated `routes.generated.ts` file consumed by `@vaadin/router`:

```typescript
// dist/client/routes.generated.ts (generated by the pages plugin)
// Format designed for @vaadin/router's route config array
export const routes = [
  {
    path: '/',
    name: 'index',
    component: () => import('/pages/index.ts'),
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('/pages/about.ts'),
  },
  {
    path: '/blog',
    name: 'blog',
    component: () => import('/pages/blog/index.ts'),
  },
  {
    path: '/blog/:slug',
    name: 'blog-slug',
    component: () => import('/pages/blog/[slug].ts'),
  },
  {
    path: '/:all(.*)*',
    name: 'all',
    component: () => import('/pages/[...all].ts'),
  },
]
```

This file should be written to `dist/client/` at build time and to `.litro/` (a gitignored cache directory) during dev, so Vite can serve it as a module.

### 9.6 Summary of What to Implement First

The recommended implementation order for agents I-1 and I-2:

1. **File scanner** (`scanPages` + `fileToRoute`) — pure functions, easy to unit test
2. **Route sorting** (`compareRoutes`) — pure function, test all edge cases
3. **Nitro plugin skeleton** — register the scan in `nitro:build:before`
4. **Dev server bootstrap** — Vite middleware mode + Nitro integration
5. **Client manifest generation** — write `routes.generated.ts`
6. **Production build sequence** — Vite first, then Nitro with `publicAssets`
7. **Prerender integration** — static routes to `prerender.routes`, `generateRoutes()` for dynamic

---

## 10. Sources

All findings are based on direct reading of Nuxt and Nitro source code. The following files were the primary sources:

**Nuxt source — pages layer:**
- `packages/nuxt/src/pages/module.ts` — https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/pages/module.ts
- `packages/nuxt/src/pages/utils.ts` — https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/pages/utils.ts

**Nuxt source — Nitro coordination:**
- `packages/nuxt/src/core/nitro.ts` — https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/core/nitro.ts

**Nuxt source — Vite plugin package:**
- `packages/vite/src/` — https://github.com/nuxt/nuxt/tree/main/packages/vite/src
- `packages/vite/src/plugins/dev-ssr-css.ts` — https://github.com/nuxt/nuxt/blob/main/packages/vite/src/plugins/dev-ssr-css.ts

**Nitro source:**
- `src/types/nitro.ts` — https://github.com/unjs/nitro/blob/main/src/types/nitro.ts
- `src/config.ts` — https://github.com/unjs/nitro/blob/main/src/config.ts
- `src/prerender/index.ts` — https://github.com/unjs/nitro/blob/main/src/prerender/index.ts

**Documentation:**
- Nitro configuration reference — https://nitro.unjs.io/config
- Nitro plugins guide — https://nitro.unjs.io/guide/plugins
- Nitro routing — https://nitro.unjs.io/guide/routing
- Nitro prerender — https://nitro.unjs.io/guide/prerender
- Vite middleware mode — https://vitejs.dev/guide/ssr#setting-up-the-dev-server
- Vite server.middlewareMode — https://vitejs.dev/config/server-options#server-middlewaremode
- Vite appType — https://vitejs.dev/config/shared-options#apptype
- Vite manifest — https://vitejs.dev/config/build-options#build-manifest

**Dependency libraries:**
- `pathe` — https://github.com/unjs/pathe
- `fast-glob` — https://github.com/mrmlnc/fast-glob
- `defu` — https://github.com/unjs/defu
- `h3` (fromNodeMiddleware) — https://github.com/unjs/h3 / https://h3.unjs.io

---

*End of R-1 findings. Produced by research agent R-1 on 2026-02-28.*
*Implementation agents I-1 and I-2 may proceed using this document as their primary reference.*
