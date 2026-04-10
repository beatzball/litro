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

## Per-Adapter Guides

- [Lit Adapter](/docs/adapters/lit) — Shadow DOM, DSD SSR, decorator API
- [FAST Element Adapter](/docs/adapters/fast) — Shadow DOM, DSD SSR, observable API
- [Elena Adapter](/docs/adapters/elena) — Light DOM, direct SSR, mixin API
- [Switching Adapters](/docs/adapters/switching) — migration guide for existing projects
