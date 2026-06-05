---
title: "Framework Adapters"
description: "Litro supports three web component frameworks — Lit, FAST Element, and Elena — through a pluggable adapter system. Choose the one that fits your project."
date: 2026-04-10
---

# Framework Adapters

Litro's adapter system lets you choose which web component framework powers your project. All three adapters share the same infrastructure — file-based routing, `definePageData()`, `LitroRouter`, content layer, SSG, deployment adapters — only the component authoring model differs.

## Available Adapters

<div class="table-wrap">
<table>
<thead>
<tr><th>Adapter</th><th>Framework</th><th>DOM Model</th><th>SSR Strategy</th><th>Hydration</th><th>CSS Scoping</th></tr>
</thead>
<tbody>
<tr><td><strong>lit</strong> (default)</td><td>Lit 3</td><td>Shadow DOM</td><td>@lit-labs/ssr (DSD)</td><td>Yes</td><td>Shadow DOM</td></tr>
<tr><td><strong>fast</strong></td><td>FAST Element 2</td><td>Shadow DOM</td><td>@microsoft/fast-ssr (DSD)</td><td>Yes</td><td>Shadow DOM</td></tr>
<tr><td><strong>elena</strong></td><td>Elena</td><td>Light DOM</td><td>Direct rendering</td><td>No (progressive enhancement)</td><td>@scope CSS</td></tr>
</tbody>
</table>
</div>

## Choosing an Adapter

**Use Lit** if you want the most mature web component library with the largest ecosystem, decorator-based APIs, and first-class TypeScript support. This is the default and most battle-tested option.

**Use FAST Element** if you prefer Microsoft's observable-based reactivity model, auto-generated attributes, or need compatibility with Fluent UI Web Components.

**Use Elena** if you want light DOM rendering — no Shadow DOM boundaries, global CSS reaches component internals, smaller HTML payloads, and no hydration overhead. Best for content-heavy sites where progressive enhancement is preferred over client-side hydration.

## Creating a Project

The `--adapter` flag selects the framework at project creation:

```bash
# Lit (default — can omit the flag)
pnpm create @beatzball/litro my-app --adapter lit

# FAST Element
pnpm create @beatzball/litro my-app --adapter fast

# Elena
pnpm create @beatzball/litro my-app --adapter elena
```

Or omit `--adapter` and choose interactively during scaffolding.

## What Stays the Same

Regardless of which adapter you choose, these features work identically:

- **File-based routing** — `pages/` directory convention, dynamic segments, catch-all routes
- **`definePageData()`** — server-side data fetching, serialized into the HTML shell
- **`LitroRouter`** — client-side SPA navigation via `<litro-link>` and `history.pushState`
- **Content layer** — `litro:content` virtual module for Markdown
- **API routes** — `server/api/` with H3 handlers
- **SSG** — `generateRoutes()` for static prerendering
- **Deployment** — all Nitro presets (Cloudflare, Vercel, Node.js, etc.)
- **Recipes** — fullstack, 11ty-blog, and starlight recipes work with all adapters

## What Differs

Each adapter provides its own native implementations of three internal components:

| Component | Purpose |
|---|---|
| **LitroOutlet** | Mounts the router, serves as the container for route content |
| **LitroLink** | Intercepts clicks for SPA navigation, falls back to `<a>` |
| **LitroPage** | Reads `__litro_data__` before first render, exposes `serverData` |

These are imported from adapter-specific paths — see each adapter's guide for details.

## SSR Output Fidelity

All three adapters SSR page content, but the completeness of the static HTML differs:

<div class="table-wrap">
<table>
<thead>
<tr><th>Feature</th><th>Lit</th><th>FAST</th><th>Elena</th></tr>
</thead>
<tbody>
<tr><td>Template bindings</td><td>Full</td><td>Full</td><td>Full</td></tr>
<tr><td>Conditional templates</td><td>Full</td><td>Full</td><td>Full</td></tr>
<tr><td>List rendering</td><td>Full</td><td>Full (repeat())</td><td>Full</td></tr>
<tr><td>Raw HTML injection</td><td>Full (unsafeHTML)</td><td><strong>Client-only</strong> (:innerHTML)</td><td>Full (unsafeHTML)</td></tr>
<tr><td>Nested component expansion</td><td>Full (DSD)</td><td>Full (DSD)</td><td>Full (recursive)</td></tr>
<tr><td>crawlLinks discovery</td><td>Full</td><td><strong>Partial</strong> (misses :innerHTML links)</td><td>Full</td></tr>
<tr><td>Lighthouse measurability</td><td>SSG only</td><td>SSG only</td><td>SSG + SSR</td></tr>
</tbody>
</table>
</div>

The main difference: FAST's `:innerHTML` property binding does not emit content during SSR, so raw HTML (comment trees, Markdown content) only appears after client-side hydration. This also means `crawlLinks` may miss `<a>` tags inside `:innerHTML` content. Use explicit `prerender.routes` when `:innerHTML` contains links.

Elena produces the smallest static HTML because it uses light DOM (no `<template shadowrootmode>` wrappers), while Lit produces the largest because DSD duplicates styles per shadow root instance. All three render full content for search engines in SSG mode, with the caveat above for FAST's `:innerHTML`.

### Where Workarounds Live

Where an adapter limitation requires a workaround, it currently lives in the **app**, not the framework — users need to know what they'll own.

- **FAST `:innerHTML` fill** — the [HN benchmark app](https://github.com/beatzball/litro/tree/main/benchmarks/apps/hn-litro-fast) fills `:innerHTML` content via a post-build Nitro `compiled` hook that reads the serialized `__litro_data__` and replaces empty markers in the static HTML. This keeps the benchmark comparison fair, but the underlying adapter limitation still applies to any FAST project — teams must add their own post-build step (or avoid `:innerHTML` for SSG-critical content) until a framework-level fix lands.
- **Lit, Elena, Next.js, Nuxt** — needed no app-level workarounds in the HN benchmark. Elena's `unsafeHTML()` is the standard public API for raw HTML (not a workaround); Next.js's `output: 'export'` and Nuxt's `prerender.routes` are first-class static export config.

**Scope caveat:** the HN benchmark is intentionally narrow — list pages, param routes, nested comments, no forms, no streaming SSR, no user input. "No workarounds needed" is a claim about this scope, not a proof of full adapter parity under every real-world workload.

**Lighthouse note:** Lighthouse measures Declarative Shadow DOM correctly when scoring static (SSG) output, so Lit, FAST, and Elena all return real performance scores in the HN benchmark numbers. We deliberately skip per-request SSR Lighthouse runs because the scored variable in that mode is server warm-up cost rather than the framework's render path, which makes adapter-to-adapter comparison noisy. None of the adapters score 0 because of Shadow DOM — the content is visible to users and to the scoring engine alike.

## Per-Adapter Guides

- [Lit Adapter](/docs/adapters/lit) — Shadow DOM, DSD SSR, decorator API
- [FAST Element Adapter](/docs/adapters/fast) — Shadow DOM, DSD SSR, observable API
- [Elena Adapter](/docs/adapters/elena) — Light DOM, direct SSR, mixin API
- [Switching Adapters](/docs/adapters/switching) — migration guide for existing projects

## Adapter Benchmarks

All three adapters are benchmarked with identical Hacker News clones (~100 pages each) alongside Next.js and Nuxt. Current benchmarks cover static prerendering (SSG) — build times, output sizes, and page weight comparisons. Per-request SSR benchmarks (TTFB, throughput, latency) are planned for a future update. See the [benchmarks page](/benchmarks) for results.
