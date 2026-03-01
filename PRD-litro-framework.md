# PRD: Litro — A Lit-First Fullstack Framework Built on Nitro

**Version:** 0.1 (Draft)  
**Status:** Pre-implementation  
**Intended Audience:** AI agents and human engineers executing parallel workstreams

---

## 1. Problem Statement

No mature, production-ready framework exists that is:

- **Web component-first** using Lit as the primary component model
- **Fullstack** with both server-side rendering and API routes
- **Deployment-agnostic** across Azure, Cloudflare Workers, Coolify (Docker/Node), Vercel, Netlify, and bare Node.js
- **Static-site capable** for JAMstack deployments
- **Actively maintained** with a comprehensible open-source architecture

Existing options either compromise on web components (Nuxt/Next), are AWS-locked (Enhance/Architect), are component-library-only (Stencil), or are documentation-only frameworks (Rocket). The goal of this project is to fill that gap by assembling proven primitives — Nitro (server), Lit (components), `@lit-labs/ssr` (SSR), and `@vaadin/router` (client routing) — into a coherent, opinionated framework with minimal custom code.

The working name for this framework is **Litro**.

---

## 2. Goals

1. Developers write Lit components. The framework handles routing, SSR, hydration, API routes, and deployment.
2. File-based routing for both pages and API endpoints, with a conventions-over-configuration approach.
3. First-class static site generation (SSG) and server-side rendering (SSR) modes with a single codebase.
4. Deployment via Nitro adapters: Azure Static Web Apps, Azure Functions, Cloudflare Workers, Node.js (for Coolify/Docker), Vercel, Netlify — no custom adapter code required.
5. Zero Vue, Zero React, Zero Svelte in the dependency tree. Lit is the only component model.
6. The framework core stays thin. No magic. All conventions are readable source code.

---

## 3. Non-Goals

- This is not a UI component library. It provides no pre-built UI components.
- This is not a CMS or content framework.
- This does not attempt to SSR third-party Lit components that access `window` or `document` at module load time. SSR compatibility is the responsibility of component authors.
- This does not implement its own deployment adapters. All deployment targets are delegated entirely to Nitro.
- This does not wrap or abstract `@vaadin/router`. Developers interact with the router API directly.

---

## 4. Stakeholders and Agent Roles

This PRD is designed for parallel execution across multiple specialized agents. Each agent has a defined scope. Agents must write findings or deliverables to shared files in the agreed output structure (see Section 10).

| Agent ID | Role                                                                                                                               | Depends On         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **R-1**  | Research: Nuxt internals — page scanning, route generation, Nitro configuration, Vite/Nitro build coordination                     | None               |
| **R-2**  | Research: `@lit-labs/ssr` — SSR API, Declarative Shadow DOM, streaming, hydration, known limitations                               | None               |
| **R-3**  | Research: `@vaadin/router` — API, integration with web components, lifecycle hooks, lazy loading, history API                      | None               |
| **R-4**  | Research: Nitro standalone usage — `nitro.config.ts` API, plugin system, dev server, prerender hooks, storage, deployment adapters | None               |
| **I-1**  | Implement: Monorepo scaffold, tooling, and build pipeline (Vite + Nitro coordination)                                              | R-1, R-4           |
| **I-2**  | Implement: Page scanner and route generator (Nitro plugin)                                                                         | R-1, R-4, I-1      |
| **I-3**  | Implement: SSR pipeline — Nitro route handler calls `@lit-labs/ssr`, streams DSD HTML                                              | R-2, R-4, I-1      |
| **I-4**  | Implement: Client hydration bootstrap and `@vaadin/router` integration                                                             | R-2, R-3, I-1      |
| **I-5**  | Implement: Data fetching convention — server context serialization and client consumption                                          | R-2, R-3, I-3, I-4 |
| **I-6**  | Implement: Static site generation mode                                                                                             | R-4, I-2, I-3      |
| **I-7**  | Implement: Developer experience — CLI, HMR in dev, error overlay                                                                   | I-1, I-2           |
| **V-1**  | Validate: End-to-end test suite and deployment smoke tests                                                                         | All I-\*           |

---

## 5. Research Agent Briefs

Each research agent must produce a structured findings document. Format: markdown, saved to `./research/<agent-id>-findings.md`. Findings must include: summary, key APIs and patterns, gotchas and limitations, recommended approach for integration with Litro, and links to all source material read.

### R-1: Nuxt Internals

**Objective:** Understand how Nuxt implements its pages layer and Nitro coordination so Litro can port the non-Vue parts.

**Source files to study** (clone `nuxt/nuxt` from GitHub):

- `packages/nuxt/src/pages/` — full directory, especially `module.ts` and `utils.ts`
- `packages/nuxt/src/core/nitro.ts` — how Nuxt configures Nitro programmatically
- `packages/vite/src/` — how the Vite client build is coordinated alongside Nitro
- `packages/nuxt/src/app/composables/router.ts` — how route metadata flows from pages to the router

**Questions to answer:**

1. How does Nuxt scan the filesystem for page files? What library does it use (`fast-glob`, `pathe`, custom)?
2. How does it convert a file path (`pages/blog/[slug].vue`) to a route definition object? What is the exact data shape of that route definition?
3. How does it pass prerender targets from the page scan to Nitro's `prerender.routes` config?
4. How does it configure Nitro to serve Vite's output as static assets during both dev and production?
5. In dev mode, how do the Vite dev server and Nitro dev server coexist? Do they run on separate ports? Is there a proxy?
6. What is the minimal `nitro.config.ts` required to get Nitro serving a custom server-rendered response?

**Output must include** a working pseudocode sketch of the page-scan-to-route-generation pipeline.

---

### R-2: `@lit-labs/ssr`

**Objective:** Determine whether `@lit-labs/ssr` is production-ready enough for Litro's SSR mode and document exactly how to wire it into a Nitro request handler.

**Source material:**

- `lit/lit` monorepo, specifically `packages/labs/ssr/`
- Official docs: `lit.dev/docs/ssr/`
- `@lit-labs/ssr-client` package — hydration support module

**Questions to answer:**

1. What is the exact import and call signature for server-rendering a Lit template? (Show a working code snippet.)
2. Does it support streaming? If so, how — async iterables, ReadableStream, or both?
3. What is Declarative Shadow DOM (DSD) and which browsers support it natively as of 2025? Is a DSD polyfill required for any supported browser?
4. What is the exact sequence for client-side hydration? What must be loaded and in what order before Lit itself boots?
5. What are the known failure modes? Specifically: what happens when a component accesses `window`, `document`, or `customElements` at module evaluation time on the server?
6. How does `@lit-labs/ssr` handle `LitElement` vs `ReactiveElement` vs plain `HTMLElement` subclasses?
7. Is there a mechanism to mark a component as client-only (equivalent to Nuxt's `<ClientOnly>`)?
8. What are the SSR-specific lifecycle hooks, if any?

**Output must include** a fully working minimal code snippet of a Nitro event handler that SSR-renders a Lit component and streams the result to the response.

---

### R-3: `@vaadin/router`

**Objective:** Understand how to configure `@vaadin/router` to serve as the client-side router for a Lit-first framework, including how it integrates with dynamic imports and server-generated routes.

**Source material:**

- `vaadin/router` GitHub repo and API docs
- `vaadin.com/router`

**Questions to answer:**

1. What is the minimal setup to mount `@vaadin/router` in a Lit root component?
2. How does it handle dynamic/lazy loading of route components (`import()`)?
3. Does it support nested routes and layouts? If so, what is the pattern?
4. How does route metadata (title, guards, data) get attached to route definitions?
5. How does it interact with the browser history API? Does it support hash routing and history (pushState) routing?
6. What lifecycle callbacks are available (`onBeforeEnter`, `onAfterEnter`, etc.) and how are they declared on Lit components?
7. What is the pattern for programmatic navigation?
8. Are there known conflicts between `@vaadin/router`'s outlet mechanism and Lit's rendering lifecycle?

**Output must include** a complete working example of a Lit root component with `@vaadin/router` handling at least two routes with lazy loading.

---

### R-4: Nitro Standalone

**Objective:** Fully understand Nitro's API surface as a standalone tool (not through Nuxt) so the implementation agents can use it correctly.

**Source material:**

- `unjs/nitro` GitHub repo
- `nitro.unjs.io` documentation
- Specifically: `src/types/nitro.ts` for config shape, `src/prerender/` for prerender internals, `src/rollup/` for build pipeline

**Questions to answer:**

1. What is the complete set of relevant `nitro.config.ts` options for Litro's use case? Group by: routing, assets, prerendering, dev server, deployment adapters.
2. How do Nitro plugins work? What hooks are available (`nitro:config`, `nitro:build:before`, `nitro:init`, etc.)?
3. How does Nitro's file-based routing in `server/routes/` work, and how can this be extended or replaced with a custom route resolver?
4. How does prerendering work? How are prerender targets specified, how does Nitro crawl them, and how does it write output?
5. What is the exact config for each relevant deployment adapter: `azure`, `azure-functions`, `cloudflare-pages`, `node`, `vercel`, `netlify`? What does each produce?
6. How does Nitro serve static assets? What is the `publicDir` behavior?
7. In dev mode, how does Nitro's dev server work? Can it proxy requests to a separate Vite dev server?
8. How does Nitro handle environment variables across adapters?

**Output must include** a complete annotated `nitro.config.ts` covering all options Litro will need.

---

## 6. Implementation Agent Briefs

Implementation agents begin after their dependency research agents have completed and committed their findings documents.

---

### I-1: Monorepo Scaffold and Build Pipeline

**Objective:** Create the Litro monorepo structure, establish the Vite + Nitro dual build pipeline, and ensure both dev and production builds work for a minimal hello-world case.

**Inputs:** R-1 findings (Nuxt's Vite/Nitro coordination), R-4 findings (Nitro standalone config).

**Deliverables:**

1. Monorepo structure using `pnpm workspaces`:

```
litro/
  packages/
    framework/          ← the Litro core package (npm: litro)
      src/
        plugins/        ← Nitro plugins
        vite/           ← Vite plugins
        runtime/        ← client-side runtime (router bootstrap, hydration)
        cli/            ← dev/build/preview CLI
      package.json
    create-litro/       ← scaffolding CLI (npm: create-litro)
  playground/           ← a test app using the framework locally
    pages/
    server/
      api/
    public/
    app.ts              ← client entry
    nitro.config.ts
    vite.config.ts
  package.json          ← workspace root
```

1. Vite config that:
   - Builds the client bundle from `app.ts` to `dist/client/`
   - Includes the `@lit/reactive-element` and Lit decorators transform
   - In dev, runs Vite dev server on port 5173

2. Nitro config that:
   - In dev, proxies unmatched asset requests to Vite dev server
   - In production, serves `dist/client/` as static assets
   - Exposes hooks for the page scanner plugin (I-2)

3. A working dev command (`litro dev`) that starts both Vite and Nitro in parallel and coordinates HMR.

4. A working build command (`litro build`) that runs Vite build then Nitro build in sequence.

**Acceptance criteria:** Running `pnpm dev` in the playground serves a static HTML page at `localhost:3000` with a rendered Lit component, with HMR working on component changes.

---

### I-2: Page Scanner and Route Generator

**Objective:** Implement the Nitro plugin that scans the `pages/` directory, generates route definitions for both the server (Nitro) and client (`@vaadin/router`), and registers prerender targets for SSG mode.

**Inputs:** R-1 findings, R-4 findings, I-1 scaffold.

**Page file conventions:**

| File                   | Route            |
| ---------------------- | ---------------- |
| `pages/index.ts`       | `/`              |
| `pages/about.ts`       | `/about`         |
| `pages/blog/index.ts`  | `/blog`          |
| `pages/blog/[slug].ts` | `/blog/:slug`    |
| `pages/[...all].ts`    | `/*` (catch-all) |

Each page file must export:

- A default export: a Lit component class (the page component)
- An optional named export `routeMeta` for title, guards, and data

**Deliverables:**

1. A Nitro plugin (`plugins/pages.ts`) that:
   - Uses `fast-glob` to scan `pages/**/*.ts`
   - Converts file paths to route definition objects (path, component module path, params)
   - Registers each route as a Nitro server route handler (delegating to the SSR pipeline from I-3)
   - Adds all non-dynamic routes to `nitro.options.prerender.routes` for SSG mode
   - Emits a generated file `dist/client/routes.generated.ts` containing the `@vaadin/router` route config

2. A route definition schema (TypeScript interface) shared between server and client.

3. Unit tests for the file-path-to-route-path conversion logic covering static, dynamic, nested, and catch-all cases.

**Acceptance criteria:** Adding a file `pages/about.ts` exporting a Lit component causes `GET /about` to be handled without any manual registration.

---

### I-3: SSR Pipeline

**Objective:** Implement the Nitro route handler factory that takes a Lit component and renders it to a full HTML response using `@lit-labs/ssr`, with streaming support.

**Inputs:** R-2 findings, R-4 findings, I-1 scaffold.

**Deliverables:**

1. A handler factory function `createPageHandler(ComponentClass, routeMeta?)` that:
   - Creates a Nitro event handler
   - Calls `@lit-labs/ssr` to render the component
   - Wraps the DSD output in a full HTML shell (doctype, head, body, client script tags)
   - Streams the response using Nitro's streaming response API
   - Injects serialized server data into a `<script type="application/json" id="__litro_data__">` tag (for I-5)

2. An HTML shell template (`src/runtime/shell.ts`) that:
   - Accepts head metadata (title, meta tags) from `routeMeta`
   - Injects the Vite-built client bundle script tag
   - Includes the `@lit-labs/ssr-client/lit-element-hydrate-support.js` import before the Lit bundle (critical ordering)
   - Has a `<litro-outlet>` custom element as the page mount point

3. Error boundary behavior: if SSR throws, fall back to serving the client-only shell with a console warning (do not 500 in production).

**Acceptance criteria:** A Lit component that uses `LitElement` with a reactive property renders its initial HTML on the server (visible in `curl` output, not just in browser), and the content is correct before JavaScript loads.

---

### I-4: Client Hydration Bootstrap and Router Integration

**Objective:** Implement the client-side entry point that initializes `@vaadin/router`, loads the generated route config, and triggers Lit hydration for SSR'd pages.

**Inputs:** R-2 findings, R-3 findings, I-1 scaffold, I-2 (for generated route config).

**Deliverables:**

1. Client entry point (`src/runtime/client.ts`) that:
   - Imports `@lit-labs/ssr-client/lit-element-hydrate-support.js` first (before any Lit import)
   - Imports the generated route config from `dist/client/routes.generated.ts`
   - Initializes `@vaadin/router` on a `<litro-outlet>` element
   - On first load of an SSR'd page, triggers hydration rather than re-rendering

2. A `<litro-outlet>` custom element (`src/runtime/LitroOutlet.ts`) that:
   - Serves as the `@vaadin/router` outlet target
   - On SSR'd pages, detects existing DSD content and hydrates rather than replacing
   - On client-navigated pages, renders fresh

3. A `<litro-link>` custom element (`src/runtime/LitroLink.ts`) that:
   - Wraps `<a>` tags with client-side navigation via `@vaadin/router`
   - Degrades gracefully if JS is disabled (standard anchor behavior preserved)

**Acceptance criteria:** Navigating between two pages in the browser does not trigger a full page reload. The first page load is SSR'd and hydrates correctly (no flash of unstyled content, no double-render).

---

### I-5: Data Fetching Convention

**Objective:** Implement a simple, explicit data fetching mechanism that works in both SSR and client-navigation contexts without a complex composable system.

**Inputs:** R-2 findings, R-3 findings, I-3 (server context serialization), I-4 (client bootstrap).

**Design philosophy:** No magic. No framework-specific fetch wrappers on the client. The server serializes data; the client reads it. On client navigation, the component fetches its own data via its API route.

**Deliverables:**

1. Server-side: a `definePageData<T>(fetcher: (context: H3Event) => Promise<T>)` export from page files that:
   - The SSR handler (I-3) detects this export and calls it during server render
   - Serializes the result into the `__litro_data__` script tag
   - Makes the data available to the component as a render context during SSR

2. Client-side: a `getServerData<T>(): T | null` utility that:
   - On first load, reads from `__litro_data__` script tag
   - After client navigation, returns `null` (component is responsible for fetching)

3. A base class mixin `LitroPage` (optional, not required) that:
   - Provides a `serverData` property pre-populated from `getServerData()`
   - Provides a `fetchData()` lifecycle hook called on client navigation
   - Handles loading state

**Acceptance criteria:** A page that defines `definePageData` renders with data in `curl` output (no client JS needed to see data). On client-side navigation to that page, the component fetches and renders data without a full reload.

---

### I-6: Static Site Generation Mode

**Objective:** Wire up Nitro's prerender capabilities with the page scanner to produce a fully static output that can be deployed as a CDN-hosted site.

**Inputs:** R-4 findings, I-2 (prerender route registration), I-3 (SSR pipeline).

**Deliverables:**

1. `nitro.config.ts` preset for SSG mode (`litro.config.ts` option: `mode: 'static'`) that:
   - Sets Nitro's `preset` to `static`
   - Enables `prerender.crawlLinks: true`
   - Outputs to `dist/static/`

2. Prerender hook in the pages plugin (I-2) that:
   - Adds all non-dynamic page routes to `prerender.routes`
   - Warns (but does not error) on dynamic routes that have no `prerender.generateRoutes` export

3. An optional `generateRoutes(): Promise<string[]>` named export on dynamic page files:
   - Allows authors to supply concrete paths for dynamic segments at build time
   - Example: `pages/blog/[slug].ts` exports `generateRoutes` returning `['/blog/hello', '/blog/world']`

4. A `litro build --mode static` command that runs the full SSG pipeline.

**Acceptance criteria:** Running `litro build --mode static` on the playground app produces a `dist/static/` directory with one `.html` file per page, all fully rendered without a server, deployable to any static host.

---

### I-7: Developer Experience — CLI and HMR

**Objective:** Implement the `litro` CLI and ensure the dev loop is fast and ergonomic.

**Inputs:** I-1 (build pipeline), I-2 (page scanner).

**Deliverables:**

1. CLI commands:
   - `litro dev` — start dev server with HMR
   - `litro build` — production build (accepts `--mode static|server`)
   - `litro preview` — preview production build locally
   - `litro generate` — alias for `litro build --mode static`

2. HMR behavior:
   - Lit component changes: Vite HMR updates the component in-place in the browser (Vite's built-in ESM HMR)
   - Page file additions/deletions: Nitro plugin re-runs the page scanner and updates routes without full server restart (if Nitro's plugin hooks allow; document limitations if not)
   - `nitro.config.ts` changes: full restart

3. Dev error overlay:
   - SSR errors surface in the browser with the component name and stack trace
   - Route-not-found during dev shows a listing of registered routes

4. A `create-litro` scaffolding CLI (`npm create litro`) that:
   - Prompts: project name, mode (fullstack/static), TypeScript (yes/no, default yes)
   - Produces a minimal working project
   - Installs dependencies and prints next steps

**Acceptance criteria:** From `npm create litro my-app`, a developer can be running `litro dev` with a working page in under two minutes.

---

### V-1: Test Suite and Deployment Smoke Tests

**Objective:** Validate that the full framework works end-to-end across all supported deployment targets.

**Inputs:** All I-\* agents complete.

**Deliverables:**

1. Unit tests (Vitest):
   - Page scanner path-to-route conversion (all cases)
   - Route generator output shape
   - `getServerData` reading from script tag
   - `generateRoutes` static prerender path expansion

2. Integration tests (Playwright):
   - SSR: page content visible before JS loads (test with JS disabled)
   - Hydration: interactive after JS loads, no re-render flash
   - Client navigation: no full reload between pages
   - Data fetching: data visible in SSR output and on client navigation
   - 404 handling: catch-all page renders correctly

3. Deployment smoke tests (shell scripts, CI-runnable):
   - `node` preset: build + start, `curl` returns 200
   - `static` preset: build produces `dist/static/index.html` with correct content
   - `cloudflare-pages` preset: build completes without error (deploy test optional, requires env)
   - `azure` preset: build completes without error

4. A GitHub Actions workflow (`.github/workflows/ci.yml`) that runs all of the above on push.

---

## 7. Technical Architecture Overview

```
User Request
    │
    ▼
Nitro Server (nitro.config.ts)
    │
    ├── /api/**  →  server/api/ route files (plain Nitro, no Lit)
    │
    └── /**  →  Page Handler (created by I-3 from page scan by I-2)
                    │
                    ├── SSR Mode: @lit-labs/ssr renders Lit component
                    │   └── Streams DSD HTML → client
                    │         └── @lit-labs/ssr-client hydrates Lit
                    │               └── @vaadin/router takes over navigation
                    │
                    └── Static Mode: prerendered .html files served by Nitro static preset
```

```
Directory Convention (User-facing)
──────────────────────────────────
my-app/
  pages/                  ← Lit page components (file = route)
    index.ts
    about.ts
    blog/
      index.ts
      [slug].ts
  server/
    api/                  ← Nitro API routes (plain H3 handlers)
      users.ts
      posts/
        [id].ts
    middleware/           ← Nitro middleware
  public/                 ← Static assets (copied as-is)
  app.ts                  ← Client entry (auto-generated or user-overridable)
  litro.config.ts         ← Framework config (extends nitro.config.ts)
  vite.config.ts          ← Vite config (framework provides sensible defaults)
```

---

## 8. Key Technical Decisions and Rationale

| Decision            | Choice           | Rationale                                                     |
| ------------------- | ---------------- | ------------------------------------------------------------- |
| Server engine       | Nitro            | Deployment adapter ecosystem, active maintenance, powers Nuxt |
| Component model     | Lit              | Standards-based, no virtual DOM, native web components        |
| SSR                 | `@lit-labs/ssr`  | Official Lit SSR, DSD support, streaming                      |
| Client router       | `@vaadin/router` | Most mature web-component-native router, good lifecycle hooks |
| Build tool (client) | Vite             | HMR, ESM, Lit plugin ecosystem                                |
| Package manager     | pnpm             | Workspace support, disk efficiency                            |
| Language            | TypeScript       | Required for type safety across the build pipeline            |
| Test runner         | Vitest           | Vite-native, fast, good ESM support                           |
| E2E tests           | Playwright       | Browser automation for SSR/hydration validation               |
| Monorepo tool       | pnpm workspaces  | Sufficient for this scale; no need for Turborepo initially    |

---

## 9. Risks and Mitigations

| Risk                                                               | Likelihood                  | Impact | Mitigation                                                                           |
| ------------------------------------------------------------------ | --------------------------- | ------ | ------------------------------------------------------------------------------------ |
| `@lit-labs/ssr` is still labs-status and may have breaking changes | Medium                      | High   | Pin version, write an abstraction layer so SSR calls go through one file             |
| DSD browser support issues                                         | Low (2025 coverage is good) | Medium | Document polyfill path, test in CI                                                   |
| Vite + Nitro dev server coordination is complex                    | Medium                      | Medium | Study Nuxt source carefully (R-1); prototype this first                              |
| `@vaadin/router` conflicts with Lit rendering lifecycle            | Low                         | High   | R-3 must specifically test this; I-4 builds defensively                              |
| Third-party Lit components not SSR-compatible                      | High                        | Low    | Document clearly; provide `ClientOnly` wrapper; this is a known ecosystem limitation |
| Nitro plugin API changes breaking the page scanner                 | Low                         | High   | Pin Nitro version, write integration tests that catch this                           |

---

## 10. Shared Output Structure

All agents write to the following directory tree. Agents must not delete files written by other agents.

```
litro-workspace/
  research/
    R-1-findings.md
    R-2-findings.md
    R-3-findings.md
    R-4-findings.md
  packages/
    framework/
    create-litro/
  playground/
  .github/
    workflows/
      ci.yml
  ARCHITECTURE.md          ← I-1 writes this after scaffold is complete
  DECISIONS.md             ← running log of decisions made during implementation
```

---

## 11. Definition of Done

The project is considered MVP-complete when all of the following are true:

- [ ] `npm create litro my-app && cd my-app && npm run dev` works in under two minutes
- [ ] A page with SSR renders correctly in `curl` (no JS required for content)
- [ ] Client-side navigation between pages works without full reload
- [ ] `definePageData` serializes server data to the client
- [ ] `litro build --mode static` produces a deployable static site
- [ ] `litro build --mode server` with `preset: node` produces a runnable Node.js server (Coolify/Docker compatible)
- [ ] Build with `preset: azure-functions` completes without error
- [ ] Build with `preset: cloudflare-pages` completes without error
- [ ] All Vitest unit tests pass
- [ ] All Playwright integration tests pass with JS disabled for SSR tests
- [ ] `README.md` covers: getting started, page conventions, API routes, data fetching, deployment targets
- [ ] `ARCHITECTURE.md` explains the build pipeline for future contributors

---

## 12. Out of Scope for MVP (Future Roadmap)

- Image optimization (`@nuxt/image` equivalent)
- i18n / localization
- Authentication module
- Built-in CSS/Tailwind integration
- Edge middleware (beyond what Nitro provides natively)
- A plugin system for third-party Litro modules
- Visual devtools
- Incremental static regeneration (ISR)
- React or Vue interop (explicitly out of scope permanently)

---

## 13. Reference Material for All Agents

- Nuxt source: <https://github.com/nuxt/nuxt>
- Nitro source: <https://github.com/unjs/nitro>
- Nitro docs: <https://nitro.unjs.io>
- Lit SSR docs: <https://lit.dev/docs/ssr/overview/>
- `@lit-labs/ssr` source: <https://github.com/lit/lit/tree/main/packages/labs/ssr>
- `@lit-labs/ssr-client` source: <https://github.com/lit/lit/tree/main/packages/labs/ssr-client>
- Vaadin Router docs: <https://vaadin.com/router>
- Vaadin Router source: <https://github.com/vaadin/router>
- Enhance.dev source (reference for web-component SSR patterns): <https://github.com/enhance-dev/enhance>
- H3 (Nitro's HTTP toolkit) docs: <https://h3.unjs.io>
