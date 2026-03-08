---
title: Getting Started with Litro
date: 2026-01-20
description: A step-by-step guide to setting up your Litro blog, writing posts, and deploying to production.
tags:
  - posts
  - tutorial
---

## Prerequisites

Before you begin, make sure you have [Node.js](https://nodejs.org) 20 or later and [pnpm](https://pnpm.io) installed. Then install the Litro CLI globally:

```bash
npm install -g litro
```

Or run it directly with your package manager:

```bash
pnpm dlx litro dev
```

## Setting Up playground-11ty

If you're reading this inside a freshly scaffolded project, you're already set up. To install dependencies and start the dev server:

```bash
pnpm install
pnpm dev
```

The dev server starts on `http://localhost:3030` by default. Vite handles HMR for your Lit components; Nitro handles SSR and API routes — both on a single port.

## Writing Posts

Posts live in `content/blog/`. Each `.md` file becomes a route under `/blog/<slug>`. Subdirectories using the `index.md` convention (like this post) work exactly the same way.

### Available Frontmatter Fields

| Field         | Type       | Required | Description                                      |
|---------------|------------|----------|--------------------------------------------------|
| `title`       | `string`   | Yes      | Shown in the post header and listing pages       |
| `date`        | `string`   | Yes      | ISO 8601 date (e.g. `2026-01-20`); used for sort |
| `description` | `string`   | No       | Short summary shown in post cards                |
| `tags`        | `string[]` | No       | Additional tags beyond the inherited `posts` tag |
| `draft`       | `boolean`  | No       | Set `true` to hide from listings in production   |

### Tags

Every post in `content/blog/` inherits the `posts` tag automatically via `blog.11tydata.json`. Add extra tags in the post's own frontmatter — they appear at `/tags/<tag>`.

## Building for Production

```bash
pnpm build    # SSR build (Node.js server)
pnpm preview  # preview the production build locally
```

For a fully static site (no server required), set the mode to `static` before building:

```bash
LITRO_MODE=static pnpm build
```

Static mode prerenders every route returned by `generateRoutes()` to plain HTML files, which can be served from any CDN or object storage bucket.
