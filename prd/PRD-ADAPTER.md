# PRD: Framework-Agnostic Adapter Architecture

**Priority:** P0
**Effort:** 6-7 weeks across 7 phases (Phase 0, 1.0, 1.1, and 2 complete)
**Dependencies:** None — current test suite (360 unit + 92 e2e) is the correctness baseline

---

## Problem

Litro is a fullstack web framework built on the Custom Elements standard, but its runtime and SSR pipeline are hard-wired to Lit. This couples the framework to a single rendering library and prevents users from choosing alternatives like Microsoft FAST or Elena — a lightweight, light-DOM-first library gaining community traction. The coupling is concentrated in two well-defined clusters:

1. **Client runtime** — `LitroOutlet`, `LitroLink`, `LitroPage` extend `LitElement`, use `html`/`css` tagged templates, and depend on `@lit-labs/ssr-client` hydration patches
2. **SSR pipeline** — `ssr.ts` imports `@lit-labs/ssr`; `create-page-handler.ts` uses `lit/static-html.js` for dynamic component instantiation and `RenderResultReadable` for streaming

Meanwhile, the majority of Litro's codebase — router, page scanner, CLI, content system, data layer, Vite plugins, shell generation — is already framework-agnostic.

---

## Goals

1. Users choose a framework adapter (`lit`, `fast`, or `elena`) at project creation time via `create-litro --adapter <name>` or in `litro.config.ts`.
2. Every page in a project uses the same framework. Users write native framework classes (LitElement, FASTElement, Elena mixin) — no Litro-specific component descriptor or template IR.
3. Litro's 3 internal runtime components (Outlet, Link, Page) have native implementations for each supported framework.
4. The SSR pipeline renders any adapter's components to a streamable HTML response via a unified `FrameworkAdapter` interface.
5. Existing Lit-based projects continue working with zero migration. `lit` is the default adapter.
6. All 3 adapters pass the same test suite (unit + e2e), with framework-specific test fixtures where DOM output differs (Shadow DOM vs. light DOM).

---

## Non-Goals

- **Per-page framework mixing.** The adapter is project-wide. Per-page dispatch (mixed hydration, framework-aware routing, SSR orchestration across output formats) is deferred unless user demand surfaces. The adapter interface is designed to not preclude this.
- **Template IR or `LitroComponentDef`.** No framework-neutral component authoring API. Users write native classes.
- **Custom Elements Manifest (CEM) integration.** CEM is a potential future tooling integration (IDE support, per-page detection if mixing is added), not part of the adapter contract.
- **Decorator translation.** Users use whatever decorator/property system their chosen framework provides. Litro does not abstract reactive properties.

---

## Architecture

### Adapter interface

The contract between Litro's infrastructure and a framework runtime:

```typescript
// packages/framework/src/adapter/types.ts

interface FrameworkAdapter {
  /** Framework identifier */
  name: 'lit' | 'fast' | 'elena';

  /** Render a page component to an async HTML stream.
   *  The component is identified by its custom element tag name.
   *  `serverData` is the result of definePageData() for this route. */
  renderPage(tag: string, serverData: unknown): AsyncIterable<string>;

  /** Scripts/links to inject into <head> for hydration and bootstrap.
   *  Called once per HTML response by shell.ts. */
  getHeadScripts(options: { isDev: boolean; basePath: string }): string;

  /** Whether the HTML shell should include the DSD polyfill.
   *  true for Shadow DOM frameworks (Lit, FAST), false for Elena. */
  needsDSDPolyfill: boolean;

  /** Path to the client entry module that bootstraps the framework runtime.
   *  Replaces the current hardcoded client.ts import. */
  clientEntryModule: string;

  /** Register all page components on the server before SSR.
   *  Called during server startup. Each framework has different
   *  registration mechanics (customElements.define, FASTElement.define,
   *  Elena Class.define). */
  registerComponents(manifest: PageManifest): void;

  /** Vite plugin(s) the adapter needs in the client build.
   *  e.g., Lit needs no special plugin; FAST may need template compilation;
   *  Elena may need @scope CSS processing. */
  vitePlugins(): import('vite').Plugin[];

  /** Additional Nitro config the adapter needs.
   *  e.g., externals, esbuild options, virtual modules. */
  nitroConfig(): Partial<NitroConfig>;
}
```

### What calls the adapter

| Litro subsystem | Currently Lit-specific | After refactor |
|---|---|---|
| `ssr.ts` | Imports `@lit-labs/ssr`, calls `render()` | Calls `adapter.renderPage(tag, data)` |
| `create-page-handler.ts` | Uses `html`/`unsafeStatic` from Lit, `RenderResultReadable` | Calls `adapter.renderPage()`, pipes `AsyncIterable<string>` to Nitro response |
| `shell.ts` | Hardcoded DSD polyfill, hardcoded hydrate-support script | Calls `adapter.getHeadScripts()`, conditionally includes DSD polyfill via `adapter.needsDSDPolyfill` |
| `client.ts` | Imports `@lit-labs/ssr-client/lit-element-hydrate-support.js` first | Each adapter provides its own client entry via `adapter.clientEntryModule` |
| `litro.config.ts` | No adapter field | New `adapter: 'lit' | 'fast' | 'elena'` field (default: `'lit'`) |
| CLI (`litro dev/build`) | No adapter awareness | Reads adapter from config, loads adapter module, passes to build pipeline |
| Vite config | Lit-specific esbuild settings | Merges `adapter.vitePlugins()` |
| Nitro config | Lit-specific externals/esbuild | Merges `adapter.nitroConfig()` |

### What does NOT change

- **LitroRouter** — already framework-agnostic (pure URLPattern + DOM)
- **Page scanner** (`pages.ts`, `path-to-route.ts`) — scans `.ts` files, emits routes, no framework awareness
- **Data layer** (`page-data.ts`) — `definePageData()` and `getServerData()` are plain JSON bridges
- **Content system** (`content/`) — Markdown parsing, `litro:content` virtual module
- **`#litro/page-manifest`** virtual module — static imports of page files, framework-agnostic

### Internal runtime components (9 files)

Each adapter provides native implementations of 3 components:

| Component | Lit | FAST | Elena |
|---|---|---|---|
| **Outlet** | `LitroOutlet` extends `LitElement`, light DOM via `createRenderRoot()` override, `firstUpdated()` mounts router | `LitroOutlet` extends `FASTElement`, `shadowOptions: null`, `connectedCallback` + guard mounts router | `LitroOutlet` extends `Elena(HTMLElement)`, Composite type (no render), `connectedCallback` mounts router |
| **Link** | `LitroLink` extends `LitElement`, capture-phase click handler, shadow `<a>` for progressive enhancement | `LitroLink` extends `FASTElement`, capture-phase click handler, template with `<a>` | `LitroLink` extends `Elena(HTMLElement)`, Primitive type, light DOM `<a>`, click handler |
| **Page** | `LitroPage` extends `LitElement`, `serverData`/`loading` reactive state, `connectedCallback` reads `__litro_data__` | `LitroPage` extends `FASTElement`, `@observable serverData`, `connectedCallback` reads `__litro_data__` | `LitroPage` extends `Elena(HTMLElement)`, `static props = ['serverData', 'loading']`, `connectedCallback` reads `__litro_data__` |

All 9 implementations share the same behavioral contract:
- Outlet: mount router on first DOM attachment, provide a container for route content
- Link: intercept clicks for SPA navigation, fall back to `<a>` for progressive enhancement
- Page: read serialized server data from `<script id="__litro_data__">` before first render, expose it as a reactive property

The router (`litro-router`) doesn't care which base class produced the elements — it calls `document.createElement(tag)`, checks for `.onBeforeEnter()`, and appends to the outlet.

---

## Adapter implementations

### Lit adapter (Phase 0 — extraction from current code)

The Lit adapter is not new code — it is the current implementation extracted behind the `FrameworkAdapter` interface.

- `renderPage()`: wraps current `ssr.ts` logic — `render()` from `@lit-labs/ssr` with `unsafeStatic` tag instantiation, piped through `RenderResultReadable`
- `getHeadScripts()`: emits `<script type="module" src="/@lit-labs/ssr-client/lit-element-hydrate-support.js">` (must be first) + app bundle script
- `needsDSDPolyfill`: `true`
- `clientEntryModule`: current `client.ts` (imports hydrate-support, registers Outlet/Link)
- `nitroConfig()`: `externals.inline: ['@lit-labs/ssr']`, `esbuild.options.tsconfigRaw` with `experimentalDecorators` + `useDefineForClassFields: false`
- `vitePlugins()`: empty (Lit needs no special Vite plugin beyond what Litro already configures)

**Success criteria:** All 360 unit tests + 92 e2e tests pass with zero behavioral change. The refactor is purely structural.

### FAST adapter (Phase 1)

- `renderPage()`: uses `@microsoft/fast-ssr` which implements the `ElementRenderer` protocol. Creates a `RenderInfo` context and renders the component. FAST SSR is DSD-based like Lit, so streaming output is structurally similar.
- `getHeadScripts()`: FAST's hydration uses command buffering — emits a `<script>` that queues DOM events until the FAST runtime loads and replays them. No equivalent to Lit's global prototype patch.
- `needsDSDPolyfill`: `true` (Shadow DOM output)
- `clientEntryModule`: FAST-specific bootstrap that imports `@microsoft/fast-element` and registers Outlet/Link/Page
- `nitroConfig()`: `externals.inline: ['@microsoft/fast-ssr']`, esbuild config for FAST's compilation requirements
- `vitePlugins()`: likely empty — FAST templates compile at definition time, not build time

**Key risk:** `@microsoft/fast-ssr` is beta. If it proves unstable, FAST adapter ships as SSR-optional (client-only rendering with static shell fallback).

### Elena adapter (Phase 2)

- `renderPage()`: Elena components render light DOM HTML. No DSD wrapper. The adapter calls `new Component()`, triggers `render()`, and serializes the resulting DOM string. `@elenajs/ssr` can be used if stable; otherwise, a minimal serializer (call `render()`, collect HTML string) suffices because Elena's output is plain HTML.
- `getHeadScripts()`: minimal — Elena uses progressive enhancement. The client entry imports the component classes; they upgrade in place via `customElements.define`. No hydration patch needed. Emit `<script type="module" src="/_litro/app.js">` only.
- `needsDSDPolyfill`: `false`
- `clientEntryModule`: Elena-specific bootstrap — imports Elena mixin, registers Outlet/Link/Page. No hydration support script.
- `nitroConfig()`: minimal — Elena has no SSR-specific bundling requirements
- `vitePlugins()`: may need a plugin to process `@scope` CSS blocks if Elena's build tooling requires it; TBD based on Elena RC API

**Key risk:** Elena is an RC (March 2026). API surface may shift before 1.0. Mitigated by: Phase 2 timing gives months of stabilization; the adapter is a thin wrapper, not deep integration.

**Key architectural difference:** Elena's light DOM output means:
- No DSD polyfill in `<head>`
- No `<template shadowrootmode="open">` wrappers in SSR output
- Global CSS reaches component internals (no `static override styles` needed for Elena page components)
- `@scope` CSS rules emitted inline or in a `<style>` tag for component-scoped styling
- Smaller HTML payloads, no DSD parsing cost, true zero-JS initial rendering for content pages

---

## `create-litro` changes

### New `--adapter` flag

```bash
# Default — Lit (backward-compatible, no flag needed)
pnpm create @beatzball/litro my-app

# Explicit adapter selection
pnpm create @beatzball/litro my-app --adapter fast
pnpm create @beatzball/litro my-app --adapter elena
```

All existing recipes (`fullstack`, `11ty-blog`, `starlight`) support the `--adapter` flag. The flag controls:

| Scaffolded file | What changes per adapter |
|---|---|
| `package.json` | Framework dependency: `lit` vs `@microsoft/fast-element` vs `elenajs` |
| `litro.config.ts` | `adapter: 'lit'` / `'fast'` / `'elena'` |
| `app.ts` | Client bootstrap imports (hydrate-support for Lit, nothing for Elena, FAST bootstrap) |
| `pages/*.ts` | Base class import and `extends` clause. Lit: `extends LitElement`, FAST: `extends FASTElement`, Elena: `extends Elena(HTMLElement)` |
| `pages/*.ts` | Template syntax — Lit/FAST: `html` from their respective packages. Elena: `html` from `elenajs` |
| `pages/*.ts` | Style approach — Lit/FAST: `static override styles = css\`...\``. Elena: `@scope` CSS in a `<style>` tag or external stylesheet |

### Implementation approach

The recipe template system already supports `{{placeholder}}` interpolation. Add adapter-conditional blocks:

```
{{#if adapter === 'lit'}}
import { LitElement, html, css } from 'lit';
{{/if}}
{{#if adapter === 'elena'}}
import { Elena, html } from 'elenajs';
{{/if}}
```

Alternatively (simpler): each recipe has a `template/` directory per adapter (`template-lit/`, `template-fast/`, `template-elena/`) for files that differ entirely, with shared files in `template/`. The scaffolder merges them. This avoids template spaghetti for files where the adapter changes most of the content (like page components).

**Recommendation:** Hybrid approach. Files that differ by 1-2 lines (config, package.json) use interpolation. Files that differ structurally (page components, app.ts) use per-adapter templates.

---

## Phasing and parallelization

### Phase 0: Internal refactor — extract Lit adapter (Week 1) -- COMPLETE

**Goal:** Current Lit-specific code extracted behind `FrameworkAdapter` interface. Zero behavioral change. All existing tests pass.

| Track | Work | Parallelizable? |
|---|---|---|
| **0-A: Define adapter interface** | Create `packages/framework/src/adapter/types.ts` with `FrameworkAdapter` interface. Create `packages/framework/src/adapter/resolve.ts` that reads `litro.config.ts` and returns the adapter instance. | Start first |
| **0-B: Extract Lit adapter** | Move Lit-specific code from `ssr.ts`, `create-page-handler.ts`, `shell.ts` into `packages/framework/src/adapter/lit/`. Implement `FrameworkAdapter` interface. | After 0-A |
| **0-C: Wire adapter into pipeline** | Update `create-page-handler.ts` to call `adapter.renderPage()`. Update `shell.ts` to call `adapter.getHeadScripts()` and `adapter.needsDSDPolyfill`. Update CLI to resolve adapter from config. | After 0-B |
| **0-D: Add `adapter` config field** | Add optional `adapter` field to `litro.config.ts` type. Default to `'lit'`. No user-facing change. | Parallel with 0-B |

**Agents can parallelize:** 0-A and 0-D are independent. 0-B and 0-C are sequential.

**Exit criteria:** `pnpm test` (360 tests) + `pnpm test:e2e` (92 tests) pass. No diff in SSR output, shell HTML, or client behavior.

### Phase 1.0: FAST adapter — SSR (Week 2) -- COMPLETE (PR #64)

**Goal:** FAST Element adapter with working SSR, hydration, client runtime, and SPA navigation. Validated by `playground-fast` workspace.

| Track | Work | Parallelizable? |
|---|---|---|
| **1-A: FAST runtime components** | Implement `LitroOutlet`, `LitroLink`, `LitroPage` as FASTElement subclasses in `packages/framework/src/adapter/fast/runtime/`. | Independent |
| **1-B: FAST SSR adapter** | Implement `renderPage()` using `@microsoft/fast-ssr`. Handle DSD output, streaming, server-side component registration. | Independent from 1-A |
| **1-C: FAST client entry** | Write FAST-specific `client.ts` bootstrap (no hydrate-support patch, FAST's own initialization). | Independent |
| **1-D: create-litro `--adapter fast`** | Wire `--adapter` flag into scaffolder CLI. | Independent from 1-A/B/C |
| **1-E: Unit tests** | Adapter unit tests (fast-adapter, lit-adapter, resolve). | After 1-A + 1-B + 1-C |

**Exit criteria:** `playground-fast` SSR renders correctly in dev and production (build + preview). SPA navigation, hydration, @observable reactivity, LitroLink rendering, and data fetching all verified manually.

**Lessons learned (Phase 1.0):**
- **FAST packages must stay external** — `externals.inline` causes Rollup to bundle a second copy alongside the node_modules copy. `fastSSR()` only patches one copy, so the other uses the browser compiler and crashes on missing DOM APIs. Solution: return empty `nitroConfig()` (no `externals.inline`).
- **ESM top-level await does NOT block sibling imports** — `ensure-dom.ts` originally used `await import(...)` for the DOM shim, but `@microsoft/fast-element` (a sibling import) would start executing while the await was pending. Solution: synchronous inline DOM stubs (no imports, no await).
- **Rollup tree-shakes bare side-effect imports** of external packages lacking `"sideEffects"` in package.json. `import '@microsoft/fast-ssr/install-dom-shim.js'` is silently dropped. Solution: `import * as _domShim from '...'` + `globalThis.__litro_dom_shim__ = _domShim`.
- **`manifestPreamble()`** added to `FrameworkAdapter` interface — injects code at the top of the generated page manifest virtual module, ensuring DOM shim + `fastSSR()` run before any page component imports.
- **`process.env.LITRO_ADAPTER`** must be set in the manifest preamble (not just `nitro.config.ts`) so it's baked into the production bundle.
- **FAST's legacy decorators** (`@attr`, `@observable`) require `experimentalDecorators: true` in both Nitro's esbuild and Vite's esbuild config.
- **`client.ts` must be in `sideEffects`** in `packages/framework/package.json` or Vite tree-shakes the entire FAST runtime import chain.

### Phase 1.1: FAST adapter — SSG (Week 3)

**Goal:** Validate the FAST adapter works with SSG/prerendering via a `playground-starlight-fast` workspace (Starlight recipe + FAST adapter). SSG uses the same `adapter.renderPage()` under the hood, so this should be a lighter lift than Phase 1.0.

| Track | Work | Parallelizable? |
|---|---|---|
| **1.1-A: Scaffold playground** | Create `playground-starlight-fast` workspace using the starlight recipe with `--adapter fast`. Ensure FAST dependencies and config are wired correctly. | Start first |
| **1.1-B: SSG build validation** | Run `litro build` (SSG mode) and verify prerendered HTML contains correct DSD output from FAST SSR. Check that all static routes produce valid HTML files. | After 1.1-A |
| **1.1-C: Preview validation** | Run `litro preview` on the SSG output. Verify pages load, hydrate, and SPA navigation works from static files. | After 1.1-B |
| **1.1-D: E2e tests** | Add Playwright project for `playground-starlight-fast` with route checks and navigation tests. | After 1.1-C |

**Exit criteria:** `playground-starlight-fast` builds to static HTML, all prerendered routes return 200, client hydration and SPA navigation work in preview mode.

### Phase 2: Elena adapter (Week 4-5)

**Goal:** A Litro project scaffolded with `--adapter elena` builds, serves, and passes a framework-parameterized test suite. Light DOM output validated.

| Track | Work | Parallelizable? |
|---|---|---|
| **2-A: Elena runtime components** | Implement `LitroOutlet`, `LitroLink`, `LitroPage` using Elena mixin. Light DOM, `@scope` CSS. | Independent |
| **2-B: Elena SSR adapter** | Implement `renderPage()` for light DOM output. No DSD wrapper. Plain HTML string serialization. Test streaming. | Independent from 2-A |
| **2-C: Elena client entry** | Write Elena-specific `client.ts` — minimal bootstrap, progressive enhancement, no hydration patch. | Independent |
| **2-D: create-litro `--adapter elena`** | Add Elena template variants to recipes. Elena pages use `@scope` CSS, light DOM patterns. | Independent from 2-A/B/C |
| **2-E: Test suite** | Extend parameterized tests for Elena. DOM assertions must account for light DOM (no shadow root). Add Elena e2e playwright project. | After 2-A + 2-B + 2-C |
| **2-F: Elena-specific validation** | Verify: no DSD polyfill emitted, `@scope` CSS scoping works in all target browsers, progressive enhancement (no-JS rendering) produces readable content, bundle size delta vs. Lit adapter. | After 2-E |

**Agents can parallelize:** 2-A, 2-B, 2-C, and 2-D are fully independent. 2-E and 2-F are sequential after those.

**Extra time allocated** for Elena's RC status — API may require adjustments.

### Phase 2.1: Elena adapter — Starlight SSG (Week 5)

**Goal:** Validate the Elena adapter with SSG/prerendering via a `playground-starlight-elena` workspace (Starlight recipe + Elena adapter). This requires rewriting all Starlight UI components (header, sidebar, TOC, cards, badges, tabs) using Elena's mixin + `@scope` CSS patterns, making it a heavier lift than Phase 2.

| Track | Work | Parallelizable? |
|---|---|---|
| **2.1-A: Starlight recipe overlay** | Create `packages/create-litro/recipes/starlight/template-elena/` with all page components and UI components rewritten in Elena. `@scope` CSS for light DOM encapsulation. | Start first |
| **2.1-B: Scaffold playground** | Create `playground-starlight-elena` workspace. Wire Elena dependencies, nitro/vite config. | After 2.1-A |
| **2.1-C: SSG build validation** | Run `litro build` (SSG mode) and verify prerendered HTML contains light DOM output (no DSD). Check that all static routes produce valid HTML files with `@scope` CSS. | After 2.1-B |
| **2.1-D: E2e tests** | Add Playwright project for `playground-starlight-elena` with route checks, navigation tests, and light DOM assertions. | After 2.1-C |

**Exit criteria:** `playground-starlight-elena` builds to static HTML, all prerendered routes return 200, `@scope` CSS encapsulation works correctly, client-side progressive enhancement and SPA navigation function in preview mode.

### Phase 3: Documentation and content (Week 5-6)

**Goal:** Users can discover, understand, and adopt the adapter system through docs, blog content, and updated project files.

| Track | Work | Parallelizable? |
|---|---|---|
| **3-A: Adapter docs pages** | New docs section `/docs/adapters/` with overview page + per-adapter guides (`/docs/adapters/lit`, `/docs/adapters/fast`, `/docs/adapters/elena`). Each guide covers: installation, project setup, writing page components in that framework, SSR behavior differences, known limitations. Add to sidebar under new "Adapters" section. | Independent |
| **3-B: Blog post** | "Litro goes framework-agnostic" — announce post covering: motivation (web components are the standard, not any single library), what the adapter system is, how to choose between Lit/FAST/Elena, code examples showing the same page in all 3 frameworks, performance/bundle size comparison, link to HN clone demos. | Independent from 3-A |
| **3-C: README updates** | Update root `README.md`, `packages/framework/README.md`, and `packages/create-litro/README.md` to mention adapter support. Add `--adapter` flag to CLI usage examples. Update "Quick Start" to show adapter selection. | Independent |
| **3-D: ARCHITECTURE.md + DECISIONS.md** | Append adapter architecture to `ARCHITECTURE.md`. Log the key decisions in `DECISIONS.md`: why per-project not per-page, why no template IR, why native classes over LitroComponentDef, Elena inclusion rationale. | Independent |
| **3-E: Introduction page update** | Update `/docs/introduction` (or equivalent getting-started page) to mention adapter support early. Add a "Choose your framework" section with a brief comparison table (Lit: mature/Shadow DOM, FAST: Microsoft/observable, Elena: lightweight/light DOM). | Parallel with 3-A |
| **3-F: Migration guide** | New page `/docs/adapters/switching` — how to switch an existing Lit project to FAST or Elena. Step-by-step: update config, swap dependencies, rewrite page base classes, adjust styles (Shadow DOM to `@scope` for Elena). Honest about what changes and what doesn't. | After 3-A |
| **3-G: Comparison page update** | Update existing `/compare/` pages to mention adapter flexibility. Litro's comparison vs Next.js/Nuxt/Enhance now includes "choose your component library" as a differentiator. | Independent |
| **3-H: Prerender routes** | Add all new docs/blog pages to `prerender.routes` in `docs/nitro.config.ts`. Ensure sitemap and RSS pick them up. | After 3-A + 3-B |

**Agents can parallelize:** 3-A through 3-G are all independent. 3-H depends on 3-A and 3-B being finalized.

### Phase 4: HackerNews clone showcase (Week 6-7)

**Goal:** Three identical HackerNews clone apps — one per adapter — demonstrating that Litro produces the same functional result regardless of framework choice. These serve as both documentation and proof of adapter equivalence.

Each clone is a small but non-trivial fullstack app:
- **Pages:** Top stories list, story detail with comments (nested), user profile, "Ask HN" / "Show HN" filtered views
- **Data:** HN API (`https://hacker-news.firebaseio.com/v0/`) via `definePageData()` server-side fetching
- **Features exercised:** SSR with real data, SPA navigation via `<litro-link>`, dynamic routes (`/item/[id]`, `/user/[id]`), catch-all for 404, reactive client-side state (comment collapse/expand)
- **Styling:** Identical visual output across all 3 — same CSS custom properties, same layout. The only difference is the component implementation (Shadow DOM vs. light DOM for Elena)

| Track | Work | Parallelizable? |
|---|---|---|
| **4-A: Lit HN clone** | `examples/hn-lit/` — Lit adapter, Shadow DOM, serves as the reference implementation. Build this first to establish the shared design (CSS custom properties, page structure, API helpers). | Start first — establishes the reference |
| **4-B: FAST HN clone** | `examples/hn-fast/` — FAST adapter, Shadow DOM. Port from Lit reference. Should be a straightforward base class + template syntax swap since both use Shadow DOM. | After 4-A design is stable |
| **4-C: Elena HN clone** | `examples/hn-elena/` — Elena adapter, light DOM. Port from Lit reference. Most interesting delta: `@scope` CSS instead of Shadow DOM styles, no DSD in SSR output, progressive enhancement. | After 4-A design is stable |
| **4-D: Comparison page** | New docs page `/docs/adapters/showcase` linking all 3 clones with side-by-side code snippets highlighting the differences. Include bundle size, SSR payload size, and Lighthouse scores (SSG build of each). | After 4-A + 4-B + 4-C |
| **4-E: Benchmark integration** | Add all 3 HN clones to `pnpm bench:cross`. Publish results to `benchmarks/results/latest.json` so the benchmarks docs page picks them up. | After 4-A + 4-B + 4-C |

**Agents can parallelize:** 4-B and 4-C are independent once 4-A is stable. 4-D and 4-E are independent of each other but depend on all clones being complete.

**Why HackerNews:** It's the standard benchmark app in the web framework community (every framework has one). It's complex enough to exercise real patterns (nested data, dynamic routes, client interactivity) but simple enough to build in a few days per variant. Having all three side-by-side makes Litro's adapter story immediately tangible.

---

## Testing strategy

### Parameterized unit tests

Existing framework tests in `packages/framework/` are refactored into adapter-parameterized suites:

```typescript
const adapters = ['lit', 'fast', 'elena'] as const;

for (const adapterName of adapters) {
  describe(`SSR pipeline [${adapterName}]`, () => {
    const adapter = loadAdapter(adapterName);

    it('renders page component to stream', async () => {
      const stream = adapter.renderPage('test-page', { title: 'Hello' });
      const html = await collectStream(stream);
      expect(html).toContain('Hello');
      // Shadow DOM adapters: expect <template shadowrootmode>
      // Elena: expect plain HTML, no DSD wrapper
      if (adapter.needsDSDPolyfill) {
        expect(html).toContain('shadowrootmode');
      } else {
        expect(html).not.toContain('shadowrootmode');
      }
    });
  });
}
```

### E2e test projects

Add Playwright projects for each adapter in `playwright.config.ts`:

- `playground-fast` — FAST variant of playground (port 3035)
- `playground-elena` — Elena variant of playground (port 3036)
- Shared test specs with adapter-conditional assertions where DOM structure differs

### Behavioral equivalence tests

For each of the 3 internal components, verify identical behavior across adapters:

| Behavior | Tested how |
|---|---|
| Outlet mounts router and renders page content | Navigate to route, assert content visible |
| Link performs SPA navigation on click | Click link, assert URL changed without page reload |
| Link falls back to `<a>` without JS | Disable JS, assert `<a>` tag present with correct href |
| Page reads `__litro_data__` before first render | SSR page with server data, assert data visible without flash |
| Page exposes `serverData` as reactive property | Update serverData, assert re-render |

### What we do NOT test across adapters

- Framework-specific rendering internals (Lit's DOM patching, FAST's observable tracking, Elena's string rendering)
- Template syntax correctness (that's the user's code, written in native framework syntax)
- Framework library bugs

---

## Migration and backward compatibility

### Existing projects

- `litro.config.ts` without an `adapter` field defaults to `'lit'`. No existing project breaks.
- The `lit` adapter is extracted from current code, not rewritten. Behavioral parity is guaranteed by the existing test suite.
- No deprecation of any current API. `LitElement`-based pages continue working unchanged.

### Docs and playgrounds

- `playground/`, `playground-11ty/`, `playground-starlight/` remain Lit-based (they are the Lit adapter's test fixtures)
- New `playground-fast/` and `playground-elena/` workspaces added for adapter validation
- `docs/` and `docs-ssr/` remain Lit-based (no reason to migrate the docs site)

### Changesets

Per existing convention: one changeset per package, never combine packages.

- `@beatzball/litro` — major version bump (adapter interface is a new capability, but default behavior is unchanged; semver minor is sufficient if no breaking changes to existing API)
- `@beatzball/create-litro` — minor version bump (new `--adapter` flag)
- `@beatzball/litro-router` — no changes

---

## Future considerations (explicitly deferred)

| Topic | Why deferred | Revisit trigger |
|---|---|---|
| **Per-page framework mixing** | Requires mixed hydration, framework-aware routing, SSR orchestrator — research-grade problems. Current adapter interface has `canRender(tag)` hook point if needed. | User demand, or a project that demonstrably needs Lit layout + Elena content pages |
| **CEM integration** | Custom Elements Manifest could power IDE tooling, component catalogues, and per-page framework detection. Not needed for per-project selection. | Tooling improvements, or per-page mixing implementation |
| **Docs site conversion** | `docs/` and `docs-ssr/` are 7,700+ LOC across 33 Lit components/pages. Converting to FAST or Elena is 2-3 weeks of effort with no user-facing benefit. The docs site remaining on Lit demonstrates the default adapter at production scale. | If dogfooding all adapters in the docs becomes a marketing priority |
| **Additional adapters** | Stencil, Haunted, hybrids, or other web component libraries could be supported via the same interface. | Community contributions, user requests |
| **Adapter marketplace** | Third-party adapters published as npm packages (`litro-adapter-stencil`). Requires a stable, documented adapter API. | After 1.0 of the adapter interface |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `@microsoft/fast-ssr` beta instability | Medium | FAST adapter SSR may not work reliably | Ship FAST as client-only fallback; SSR optional |
| Elena RC API changes before 1.0 | Medium | Elena adapter needs rework | Phase 2 timing gives buffer; adapter is thin |
| `@scope` CSS edge cases in older browsers | Low | Elena component styles break | `@scope` is Baseline Jan 2026; polyfill exists but defeats the purpose |
| Performance gap between adapters | Low | Users blame Litro for framework perf differences | Benchmark suite (`pnpm bench:cross`) extended to cover all 3 adapters; document expected differences |
| Template IR pressure resurfaces | Low | Users want portable components | Address with documentation: "Litro is adapter-agnostic, not component-agnostic — your components are native [framework] code" |

---

## Success metrics

1. A `create-litro my-app --adapter fast` project builds, serves SSR with DSD output, and navigates correctly in dev and preview mode. FAST adapter is the gate for Elena — it validates the adapter interface against a second Shadow DOM framework before tackling Elena's light DOM divergence.
2. A `create-litro my-app --adapter elena` project builds, serves light DOM HTML (no DSD), and navigates correctly in dev and preview mode.
3. All 3 adapters pass the parameterized test suite with no adapter-specific test skips (except DOM structure assertions).
4. Lit adapter extraction (Phase 0) produces zero test regressions.
5. FAST SSR output is valid DSD, streams correctly through Nitro, and hydrates without console errors. If `@microsoft/fast-ssr` beta proves unstable, FAST ships with client-only rendering and a documented SSR limitation.
6. Bundle size overhead of the adapter abstraction is < 500 bytes gzipped vs. current Lit-only code.
7. No user-facing API changes for existing Lit projects. `litro.config.ts` without `adapter` field works identically to pre-adapter Litro.
8. Docs site has adapter overview, per-adapter guides, and a blog post announcing the feature. README files updated. `ARCHITECTURE.md` and `DECISIONS.md` reflect the adapter architecture.
9. Three HackerNews clone apps (`examples/hn-lit/`, `examples/hn-fast/`, `examples/hn-elena/`) produce visually identical output, exercise SSR + SPA navigation + dynamic routes + client interactivity, and are linked from the docs showcase page.
