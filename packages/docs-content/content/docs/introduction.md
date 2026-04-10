---
title: Introduction
description: Litro is a fullstack web framework combining Lit web components, Nitro server, and Vite for an integrated SSR and static generation experience.
date: 2026-01-01
---

# Introduction

Litro is a greenfield fullstack web framework built on three pillars:

- **Web Components** — choose your framework: [Lit](/docs/adapters/lit) (default), [FAST Element](/docs/adapters/fast), or [Elena](/docs/adapters/elena)
- **Nitro** — the server engine (same server powering Nuxt). Handles routing, API routes, SSR, and deployment adapters.
- **Vite** — client-side bundling and HMR during development.

## Why Litro?

Most frameworks lock you into a proprietary component model and a tightly coupled server layer. Litro is different:

- Components are standard web components — they work anywhere the browser does.
- You choose your web component framework. Same routing, data layer, and deployment — different component model.
- The server is Nitro — you get access to every Nitro deployment adapter (Node.js, Cloudflare Workers, Vercel Edge, and more) without any additional configuration.
- SSR is spec-compliant — Declarative Shadow DOM streaming for Lit/FAST, light DOM for Elena. No VDOM required.

## Choose Your Framework

Litro's adapter system lets you pick the web component framework that fits your project:

<div class="table-wrap">
<table>
<thead>
<tr><th>Adapter</th><th>DOM Model</th><th>SSR</th><th>Best For</th></tr>
</thead>
<tbody>
<tr><td><strong>Lit</strong> (default)</td><td>Shadow DOM</td><td>DSD streaming</td><td>General-purpose apps, largest ecosystem</td></tr>
<tr><td><strong>FAST Element</strong></td><td>Shadow DOM</td><td>DSD streaming</td><td>Fluent UI integration, observable reactivity</td></tr>
<tr><td><strong>Elena</strong></td><td>Light DOM</td><td>Direct rendering</td><td>Content sites, global CSS, smallest payloads</td></tr>
</tbody>
</table>
</div>

The adapter is selected at project creation via `--adapter lit|fast|elena`. Everything else — routing, data fetching, content, deployment — stays the same. See the [Adapter overview](/docs/adapters/overview) for details.

## Architecture

```
User Request
    │
    ▼
Nitro Server
    ├── /api/**  →  server/api/ route files (plain H3 handlers)
    └── /**      →  Page Handler
                        ├── SSR mode: FrameworkAdapter.renderPage() → streams HTML
                        │     ├── Lit/FAST: @lit-labs/ssr or @microsoft/fast-ssr → DSD HTML
                        │     └── Elena: light DOM SSR → plain HTML
                        └── SSG: prerendered .html served statically
```

## What You Get

- File-system routing (pages/ directory → URL)
- SSR with streaming Declarative Shadow DOM
- `definePageData` for server-side data fetching
- Built-in client-side router (`LitroRouter`) using the URLPattern API
- Content layer for Markdown (11ty-compatible)
- SSG (static site generation) via the `ssgPreset`
- Recipes for common project types (fullstack, 11ty blog, Starlight docs)

## Adapter Guides

- [Adapter Overview](/docs/adapters/overview) — how the adapter system works, what stays the same
- [Lit Adapter](/docs/adapters/lit) — Shadow DOM, DSD SSR, decorator API
- [FAST Element Adapter](/docs/adapters/fast) — Shadow DOM, DSD SSR, observable API
- [Elena Adapter](/docs/adapters/elena) — Light DOM, direct SSR, mixin API
- [Switching Adapters](/docs/adapters/switching) — migration guide

## Coming from Another Framework?

If you're evaluating Litro from the perspective of a framework you already know:

- **[Litro vs Next.js](/compare/nextjs)** — same file-based routing and SSR, different component model
- **[Litro vs Nuxt.js](/compare/nuxt)** — shared Nitro server engine; migration is primarily replacing Vue with Lit
- **[Litro vs Enhance](/compare/enhance)** — both render web components server-first; different authoring model and deployment story
- **[Why Web Components?](/why-web-components)** — the philosophical case for standards-based development

Migration guides with step-by-step code walkthroughs:

- [Migrating from Next.js](/docs/migrate/from-nextjs)
- [Migrating from Nuxt.js](/docs/migrate/from-nuxt)
- [From React to Lit](/docs/migrate/from-react)
- [From React to FAST Element](/docs/migrate/from-react-to-fast)
- [From React to ElenaJS](/docs/migrate/from-react-to-elena)
