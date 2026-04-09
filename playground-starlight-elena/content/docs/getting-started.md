---
title: Getting Started
description: Learn how to set up and run your Litro Starlight docs site.
sidebar:
  order: 1
---

## Welcome

You've just scaffolded a docs and blog site powered by **Litro** — a fullstack web framework that combines Lit web components with Nitro's server engine.

This site is a **static site** (SSG mode). Run `pnpm build` to pre-render every page to HTML, then `pnpm preview` to serve the output locally.

## Prerequisites

You'll need **Node.js 20+** and a package manager (`pnpm`, `npm`, or `yarn`).

## Install Dependencies

```bash
pnpm install
```

## Start the Dev Server

```bash
pnpm dev
```

The dev server starts on `http://localhost:3030`. Changes to Lit components and Markdown content are reflected immediately.

## Project Structure

```
my-docs/
  pages/          Lit page components (filename = route)
  src/
    components/   Starlight layout and UI components
  content/
    docs/         Documentation Markdown files
    blog/         Blog post Markdown files
  server/
    starlight.config.js   Site title, nav, and sidebar config
  public/
    styles/       CSS design tokens (--sl-* variables)
```

## Next Steps

- Edit `server/starlight.config.js` to update the site title, nav links, and sidebar groups.
- Add new docs pages to `content/docs/` — each `.md` file becomes a route under `/docs/`.
- Write blog posts in `content/blog/`.
- Run `pnpm build` to generate the static site.
