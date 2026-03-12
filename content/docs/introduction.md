---
title: Introduction
description: Litro is a fullstack web framework combining Lit web components, Nitro server, and Vite for an integrated SSR and static generation experience.
date: 2026-01-01
---

# Introduction

Litro is a greenfield fullstack web framework built on three pillars:

- **Lit** — the only component model. Write UI as standard web components using `LitElement`.
- **Nitro** — the server engine (same server powering Nuxt). Handles routing, API routes, SSR, and deployment adapters.
- **Vite** — client-side bundling and HMR during development.

## Why Litro?

Most frameworks lock you into a proprietary component model and a tightly coupled server layer. Litro is different:

- Components are standard web components — they work anywhere the browser does.
- The server is Nitro — you get access to every Nitro deployment adapter (Node.js, Cloudflare Workers, Vercel Edge, and more) without any additional configuration.
- SSR uses `@lit-labs/ssr` and Declarative Shadow DOM — fully spec-compliant, no VDOM required.

## Architecture

```
User Request
    │
    ▼
Nitro Server
    ├── /api/**  →  server/api/ route files (plain H3 handlers)
    └── /**      →  Page Handler
                        ├── SSR: @lit-labs/ssr streams DSD HTML
                        │     └── client: hydrates → LitroRouter takes over
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
