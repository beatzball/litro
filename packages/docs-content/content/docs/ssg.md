---
title: Static Site Generation
description: Use ssgPreset() in nitro.config.ts to prerender all routes to static HTML files.
date: 2026-01-01
---

# Static Site Generation

Litro supports SSG (static site generation) via Nitro's static preset. All routes are prerendered to `.html` files that can be served from any CDN.

## Enable SSG

Add `ssgPreset()` to your `nitro.config.ts`:

```ts
import { ssgPreset } from '@beatzball/litro/config';

export default defineNitroConfig({
  ...ssgPreset(),
  // ...
});
```

Also add the `ssgPlugin` to the `build:before` hook:

```ts
import ssgPlugin from '@beatzball/litro/plugins/ssg';

hooks: {
  'build:before': async (nitro) => {
    await contentPlugin(nitro);
    await pagesPlugin(nitro);
    await ssgPlugin(nitro);   // ← generates prerender routes
  },
},
```

## Build

```bash
litro build
```

Output goes to `dist/static/`. Each route produces a `.html` file.

## `generateRoutes()`

For dynamic routes (e.g. `pages/docs/[slug].ts`), export `generateRoutes()` to tell the SSG plugin which slugs to prerender:

```ts
export async function generateRoutes(): Promise<string[]> {
  const posts = await getPosts();
  return posts
    .filter(p => p.url.startsWith('/content/docs/'))
    .map(p => '/docs' + p.url.slice('/content/docs'.length));
}
```

## Navigation in SSG

Use plain `<a>` tags for navigation in SSG sites. Each navigation fetches the prerendered HTML for that page. Do **not** use `<litro-link>` in SSG-only sites — the SPA router would navigate without fetching the prerendered page data.

## `.nojekyll`

If deploying to GitHub Pages, add a `.nojekyll` file to `public/`:

```
public/.nojekyll
```

This prevents GitHub Pages from ignoring files with leading underscores.
