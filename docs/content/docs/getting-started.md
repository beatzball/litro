---
title: Getting Started
description: Create a new Litro project in minutes using the create-litro scaffolding CLI.
date: 2026-01-01
---

# Getting Started

## Prerequisites

- Node.js 20+
- pnpm 9+

## Create a New Project

```bash
pnpm create @beatzball/litro my-app
```

This launches the interactive scaffolding wizard. Choose a recipe:

- **fullstack** — SSR app with API routes
- **11ty-blog** — Markdown blog with content layer
- **starlight** — Documentation site with sidebar + TOC

## Start the Dev Server

```bash
cd my-app
pnpm install
pnpm dev
```

The dev server starts on port 3000 (auto-increments if taken). Open [http://localhost:3000](http://localhost:3000).

## Build for Production

```bash
pnpm build
```

Output:
- `dist/client/` — Vite-built client bundle
- `dist/server/` — Nitro server bundle (SSR mode) or `dist/static/` (SSG mode)

## Preview the Production Build

```bash
pnpm preview
```

Serves the production build locally. For SSG output, serves from `dist/static/`. For SSR, starts the Nitro server from `dist/server/server/index.mjs`.
