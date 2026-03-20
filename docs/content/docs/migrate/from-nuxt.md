---
title: Migrating from Nuxt.js to Litro
description: A practical guide to migrating a Nuxt.js application to Litro. Both frameworks share the same Nitro server engine — migration is primarily replacing Vue SFCs with Lit class components. H3 API routes copy verbatim.
date: 2026-01-01
---

# Migrating from Nuxt.js to Litro

Litro and Nuxt.js share the same server engine — Nitro. This makes migration more straightforward than it might seem: your H3 API route handlers, server middleware, and deployment configuration carry over almost unchanged. The primary migration task is replacing Vue Single File Components with Lit class components.

## What Carries Over Unchanged

- **H3 API routes** — `server/api/*.ts` files are identical. Copy them as-is.
- **Nitro middleware** — `server/middleware/*.ts` files work without modification.
- **Deployment targets** — all Nitro presets (Vercel, Cloudflare Workers, AWS Lambda, Deno Deploy, etc.) work identically in Litro.
- **Route rules** — `routeRules` in `nitro.config.ts` is the same API.

## Concept Map

| Nuxt.js | Litro | Notes |
|---------|-------|-------|
| `pages/index.vue` | `pages/index.ts` | SFC → Lit class component |
| `<script setup>` | `definePageData()` | Server-side data |
| `useFetch()` / `useAsyncData()` | `definePageData()` + `this.serverData` | Same concept |
| `<NuxtLink>` | `<litro-link>` | SPA navigation |
| `<NuxtPage>` / `<RouterView>` | `<litro-outlet>` | Router outlet |
| `server/api/*.ts` | `server/api/*.ts` | **Identical — copy as-is** |
| `nuxt.config.ts` | `nitro.config.ts` + `vite.config.ts` | Split config |
| Vue Router | LitroRouter (URLPattern) | Different API |
| `defineNuxtPlugin` | Nitro plugins in `server/plugins/` | Same concept |

## Pages and Components

The biggest change is the component model.

**Nuxt — `pages/about.vue`:**

```vue
<script setup lang="ts">
const title = 'About Litro';
</script>

<template>
  <h1>{{ title }}</h1>
</template>
```

**Litro — `pages/about.ts`:**

```ts
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';

@customElement('page-about')
export class AboutPage extends LitroPage {
  override render() {
    return html`<h1>About Litro</h1>`;
  }
}

export default AboutPage;
```

## Data Fetching

Nuxt uses `useFetch` and `useAsyncData` for server-side data. Litro uses `definePageData`.

**Nuxt — `pages/blog/[slug].vue`:**

```vue
<script setup lang="ts">
const route = useRoute();
const { data: post } = await useFetch(`/api/posts/${route.params.slug}`);
</script>

<template>
  <article>
    <h1>{{ post?.title }}</h1>
    <div v-html="post?.body"></div>
  </article>
</template>
```

**Litro — `pages/blog/[slug].ts`:**

```ts
import { html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { LitroPage } from '@beatzball/litro/runtime';

export const pageData = definePageData(async (event) => {
  const slug = event.context.params?.slug ?? '';
  const post = await $fetch<Post>(`/api/posts/${slug}`);
  return { post };
});

@customElement('page-blog-slug')
export class BlogSlugPage extends LitroPage {
  override render() {
    const data = this.serverData as { post: Post } | null;
    if (!data) return html`<p>Loading&hellip;</p>`;
    return html`
      <article>
        <h1>${data.post.title}</h1>
        ${unsafeHTML(data.post.body)}
      </article>
    `;
  }
}

export default BlogSlugPage;
```

## API Routes

API routes are identical. The only difference is that Nuxt auto-imports `defineEventHandler` while Litro requires an explicit import from `h3`.

**Nuxt — `server/api/posts.ts`:**

```ts
export default defineEventHandler(async () => {
  return await fetchPostsFromDb();
});
```

**Litro — `server/api/posts.ts`:**

```ts
import { defineEventHandler } from 'h3';

export default defineEventHandler(async () => {
  return await fetchPostsFromDb();
});
```

Add `import { defineEventHandler } from 'h3'` and the rest copies verbatim.

## Navigation

`<NuxtLink>` maps directly to `<litro-link>`.

```html
<!-- Nuxt -->
<NuxtLink to="/about">About</NuxtLink>

<!-- Litro -->
<litro-link href="/about">About</litro-link>
```

Note the attribute difference: Nuxt uses `to`, Litro uses `href` (standard HTML).

## Dynamic Routes

File naming conventions are identical:

| Nuxt | Litro |
|------|-------|
| `pages/[id].vue` | `pages/[id].ts` |
| `pages/[...slug].vue` | `pages/[...slug].ts` |
| `pages/[[param]].vue` | `pages/[[param]].ts` |

## Deployment

Since both frameworks use Nitro, deployment configuration is the same:

```bash
# Deploy to Cloudflare Workers
NITRO_PRESET=cloudflare-workers litro build

# Deploy to Vercel
NITRO_PRESET=vercel litro build

# Static generation
NITRO_PRESET=static litro build
```

Deployment adapter docs, environment variables, and `routeRules` from your `nuxt.config.ts` all transfer to `nitro.config.ts` without changes.

## Configuration

Most Nuxt config that lives in the `nitro` key transfers directly:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    routeRules: {
      '/api/**': { cors: true },
    },
  },
});
```

```ts
// nitro.config.ts (Litro)
export default defineNitroConfig({
  routeRules: {
    '/api/**': { cors: true },
  },
});
```

## Next Steps

- [Litro vs Nuxt.js — full comparison](/compare/nuxt)
- [Getting Started with Litro](/docs/getting-started)
- [API Routes guide](/docs/api-routes)
