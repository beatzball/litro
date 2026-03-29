---
title: Fullstack Recipe
description: The fullstack recipe creates an SSR app with API routes, a homepage, and a blog.
date: 2026-01-01
---

# Fullstack Recipe

The `fullstack` recipe creates a server-side rendered app with API routes.

## Scaffold

```bash
pnpm create @beatzball/litro my-app
# choose: fullstack
```

## Structure

```
my-app/
  pages/
    index.ts          ← home page
    about.ts          ← about page
  server/
    api/
      hello.ts        ← GET /api/hello
  public/
  app.ts
  nitro.config.ts
  vite.config.ts
```

## What You Get

- SSR with streaming DSD on all pages
- `/api/hello` API endpoint
- `definePageData` server data fetching
- Light/dark theme toggle
- `<litro-link>` for SPA navigation
