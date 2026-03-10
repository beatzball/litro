---
title: Welcome to playground-starlight
date: 2026-01-15
description: Introducing the playground-starlight docs and blog site, built with Litro and Starlight-inspired components.
tags:
  - posts
  - welcome
---

## Hello, World!

Welcome to **playground-starlight** — a docs and blog site scaffolded with Litro's Starlight recipe.

This blog is powered by Litro's content layer. Each `.md` file in `content/blog/` becomes a post, available at `/blog/<slug>`. Write in plain Markdown; the framework handles rendering, tag indexing, and static generation.

## What's Included

- **Docs site** at `/docs/` — structured documentation with a sidebar, table of contents, and prev/next navigation
- **Blog** at `/blog/` — a chronological listing of posts with tag filtering
- **Dark mode** — a theme toggle in the header that persists to `localStorage`
- **CSS design tokens** — all colors, fonts, and spacing via `--sl-*` custom properties

## Writing Posts

Create a new `.md` file in `content/blog/`:

```markdown
---
title: My Post Title
date: 2026-02-01
description: A short summary.
tags:
  - posts
  - my-tag
---

Post body here.
```

Every post in `content/blog/` inherits the `posts` tag via `blog.11tydata.json`. List any additional tags in the post frontmatter — tag pages are generated automatically at `/blog/tags/<tag>`.

## Building

Run `pnpm build` to generate the static HTML for every route, then `pnpm preview` to serve it locally.
