# PRD: Framework-Agnostic Adapter Architecture

**Priority:** P0
**Status:** Phases 0-2.1 complete, Phases 3-4 pending

---

## Problem

Litro's runtime and SSR pipeline were hard-wired to Lit, preventing users from choosing alternatives like FAST or Elena. The coupling was concentrated in two clusters: client runtime (LitroOutlet/Link/Page extending LitElement) and SSR pipeline (@lit-labs/ssr). The rest of the codebase (router, scanner, CLI, content, data layer) was already framework-agnostic.

## Goals

1. Users choose a framework adapter (`lit`, `fast`, `elena`) at project creation via `--adapter` flag
2. Every page uses native framework classes — no Litro-specific component descriptor
3. Litro's 3 runtime components (Outlet, Link, Page) have native implementations per framework
4. SSR renders any adapter's components via a unified `FrameworkAdapter` interface
5. Existing Lit projects continue with zero migration. `lit` is the default
6. All adapters pass the same test suite

## Non-Goals

- Per-page framework mixing (deferred)
- Template IR or neutral component authoring API
- Decorator translation between frameworks

---

## Architecture

### FrameworkAdapter interface

Defined in `packages/framework/src/adapter/types.ts`:
- `renderPage(tag, serverData)` — render page component to AsyncIterable<string>
- `getHeadScripts(options)` — scripts/links for <head> (hydration, bootstrap)
- `needsDSDPolyfill` — true for Shadow DOM (Lit, FAST), false for Elena
- `clientEntryModule` — path to client bootstrap module
- `vitePlugins()` / `nitroConfig()` — framework-specific build config
- `manifestPreamble()` / `manifestPostamble()` — code injected into page manifest

### What does NOT change

LitroRouter, page scanner, data layer, content system, `#litro/page-manifest` — all framework-agnostic.

### Internal runtime components (3 per adapter, 9 total)

| Component | Contract |
|---|---|
| **Outlet** | Mount router on first DOM attachment, container for route content |
| **Link** | Intercept clicks for SPA nav, fall back to `<a>` for progressive enhancement |
| **Page** | Read `__litro_data__` before first render, expose as reactive property |

---

## Completed Phases

### Phase 0: Extract Lit adapter (PR #62)
Extracted Lit-specific code behind `FrameworkAdapter` interface. Zero behavioral change. All existing tests pass.

### Phase 1.0: FAST adapter — SSR (PR #64)
FAST Element adapter with SSR, hydration, client runtime, SPA navigation. Validated by `playground-fast`. Key learnings: FAST packages must stay external (not inlined), ESM TLA doesn't block siblings, Rollup tree-shakes bare side-effect imports.

### Phase 1.1: FAST adapter — SSG (PR #66)
Validated FAST with SSG/prerendering via `playground-starlight-fast`. All prerendered routes produce valid DSD HTML.

### Phase 2: Elena adapter (PR #67)
Elena adapter with light DOM SSR, progressive enhancement, `@scope` CSS. Validated by `playground-elena`. No DSD polyfill, no shadow roots, smaller HTML payloads.

### Phase 2.1: Elena adapter — Starlight SSG (PR #68)
Validated Elena with SSG via `playground-starlight-elena`. All 10 UI components + 5 page components rewritten using Elena mixin + `@scope` CSS. 22 prerendered routes, 20 e2e tests.

---

## Phase 3: Documentation and content (pending)

**Goal:** Users can discover, understand, and adopt the adapter system through docs, blog, and updated project files.

| Track | Work |
|---|---|
| **3-A: Adapter docs** | New `/docs/adapters/` section: overview + per-adapter guides (lit, fast, elena). Cover: setup, page components, SSR differences, limitations. |
| **3-B: Blog post** | "Litro goes framework-agnostic" — motivation, adapter system overview, code examples in all 3 frameworks, performance comparison. |
| **3-C: README updates** | Root, framework, create-litro READMEs. Add `--adapter` to CLI examples, update Quick Start. |
| **3-D: ARCHITECTURE + DECISIONS** | Append adapter architecture. Log key decisions (per-project not per-page, native classes, Elena rationale). |
| **3-E: Introduction page** | "Choose your framework" section with comparison table. |
| **3-F: Migration guide** | `/docs/adapters/switching` — step-by-step for existing Lit projects. |
| **3-G: Comparison pages** | Update `/compare/` pages to mention adapter flexibility as differentiator. |
| **3-H: Prerender routes** | Add new pages to `prerender.routes`, ensure sitemap/RSS pickup. |

All tracks are independent except 3-H (depends on 3-A + 3-B).

## Phase 4: HackerNews clone showcase (pending)

**Goal:** Three identical HN clone apps — one per adapter — as both docs and proof of adapter equivalence.

Each clone: top stories, story detail with comments, user profile, Ask/Show HN views. Uses HN API via `definePageData()`. Same CSS, same layout — only component implementation differs.

| Track | Work |
|---|---|
| **4-A: Lit HN clone** | `examples/hn-lit/` — reference implementation, establishes shared design. |
| **4-B: FAST HN clone** | `examples/hn-fast/` — port from Lit. Straightforward base class swap (both Shadow DOM). |
| **4-C: Elena HN clone** | `examples/hn-elena/` — port from Lit. Most interesting: `@scope` CSS, light DOM, no DSD. |
| **4-D: Comparison page** | `/docs/adapters/showcase` — side-by-side code, bundle/SSR payload/Lighthouse comparison. |
| **4-E: Benchmarks** | Add to `pnpm bench:cross`, publish to `latest.json`. |

4-B and 4-C parallel after 4-A. 4-D and 4-E after all clones complete.

---

## Testing strategy

- **Parameterized unit tests** — adapter-agnostic assertions with DSD/light-DOM conditional checks
- **E2e projects** — `playground-fast` (3035), `playground-elena` (3036), `playground-starlight-fast` (3032), `playground-starlight-elena` (3037)
- **Behavioral equivalence** — outlet mounts router, link does SPA nav, page reads `__litro_data__`

## Migration

- No `adapter` field defaults to `'lit'`. No existing project breaks.
- Lit adapter extracted from current code, not rewritten. Behavioral parity guaranteed.
- `playground/`, `docs/`, `docs-ssr/` remain Lit-based.

## Future (deferred)

- Per-page framework mixing
- CEM integration
- Additional adapters (Stencil, Haunted, hybrids)
- Adapter marketplace (third-party npm packages)
