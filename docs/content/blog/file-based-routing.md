---
title: File-Based Routing with Lit — A Next.js Developer's Guide
description: Everything you know about file-based routing from Next.js applies to Litro. Here's how the page conventions map, how data fetching works, and how to navigate between routes in a Lit-based app.
date: 2026-03-20
tags: [routing, nextjs, lit, tutorial]
---

# File-Based Routing with Lit — A Next.js Developer's Guide

If you know Next.js, you already understand most of how Litro's routing works. The file-system convention is the same: drop a file in `pages/`, get a route. The difference is the component model — Lit class components instead of React function components, and tagged template literals instead of JSX.

This guide uses Next.js concepts as the starting point. By the end, you'll have a mental model of how the two systems map to each other.

## The Pages Directory

Next.js maps `app/page.tsx` to routes. Litro maps `pages/*.ts` to routes using the same convention.

| File | Route |
|------|-------|
| `pages/index.ts` | `/` |
| `pages/about.ts` | `/about` |
| `pages/blog/index.ts` | `/blog` |
| `pages/blog/[slug].ts` | `/blog/:slug` |
| `pages/docs/[...slug].ts` | `/docs/*` (catch-all) |
| `pages/[[param]].ts` | `/:param?` (optional param) |

The naming conventions are identical. If you know `[slug]` and `[...slug]` from Next.js, they work the same way in Litro.

## A Basic Page

**Next.js — `app/about/page.tsx`:**

```tsx
export default function AboutPage() {
  return (
    <main>
      <h1>About</h1>
      <p>We build web frameworks.</p>
    </main>
  );
}
```

**Litro — `pages/about.ts`:**

```ts
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';

@customElement('page-about')
export class AboutPage extends LitroPage {
  override render() {
    return html`
      <main>
        <h1>About</h1>
        <p>We build web frameworks.</p>
      </main>
    `;
  }
}

export default AboutPage;
```

The `@customElement` decorator registers `page-about` as a Custom Element. The name is arbitrary — it just needs to contain a hyphen (browser requirement for Custom Elements). Litro's page scanner uses the filename to determine the route, not the element name.

The `html` tagged template works like JSX but produces DOM templates rather than a virtual DOM tree. Dynamic expressions use `${}` instead of `{}`.

## Page Metadata

`routeMeta` is the equivalent of Next.js's `export const metadata`. It injects content into the `<head>`.

```ts
export const routeMeta = {
  title: 'About — My Site',
  head: '<meta name="description" content="We build web frameworks." />',
};
```

For per-request metadata (e.g. a blog post title), use `seoTitle` and `seoHead` returned from `definePageData()` — covered below.

## The Page Scanner

Next.js uses a build compiler that watches the `app/` directory. Litro uses a page scanner — a fast-glob pattern run during `litro build` that collects all `.ts` and `.tsx` files in `pages/`.

The scanner generates a `#litro/page-manifest` virtual module that lists every page component. A single Nitro catch-all handler reads this manifest at runtime and routes requests to the right component. No per-page Nitro route is registered — the manifest is one module.

This means there's no filesystem watch during SSR. Adding a new page requires rebuilding (or restarting `litro dev`).

## Server-Side Data Fetching

Next.js uses Server Components or `getServerSideProps`. Litro uses `definePageData`.

**Next.js — Server Component:**

```tsx
// app/blog/[slug]/page.tsx
export default async function BlogPost({
  params,
}: {
  params: { slug: string };
}) {
  const post = await db.posts.findOne({ slug: params.slug });

  if (!post) notFound();

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.excerpt}</p>
    </article>
  );
}
```

**Litro — `definePageData()` + `LitroPage`:**

```ts
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { createError } from 'h3';
import { definePageData } from '@beatzball/litro';
import { LitroPage } from '@beatzball/litro/runtime';

export const pageData = definePageData(async (event) => {
  const slug = event.context.params?.slug ?? '';
  const post = await db.posts.findOne({ slug });

  if (!post) {
    throw createError({ statusCode: 404, message: 'Post not found' });
  }

  return { post };
});

@customElement('page-blog-slug')
export class BlogPost extends LitroPage {
  override render() {
    const data = this.serverData as { post: Post } | null;
    if (!data) return html`<p>Loading&hellip;</p>`;

    return html`
      <article>
        <h1>${data.post.title}</h1>
        <p>${data.post.excerpt}</p>
      </article>
    `;
  }
}

export default BlogPost;
```

`definePageData()` runs server-side only. The return value is serialized into a `<script type="application/json">` tag during SSR. On the client, `this.serverData` reads it without a second network request — similar to how Next.js serializes Server Component data for hydration.

## How `serverData` Reaches the Component

During SSR, Litro passes the fetched data as a `.serverData` property binding to the component:

```html
<page-blog-slug .serverData=${JSON.parse(serverDataJson)}></page-blog-slug>
```

This means `this.serverData` is populated during the server render, and the streamed HTML already shows the correct content — not a "Loading…" fallback. After JavaScript loads, `LitroRouter` reads the same JSON from the `<script>` tag and passes it to the new component instance.

## Navigation

Next.js uses `<Link>` for SPA navigation. Litro uses `<litro-link>`.

```html
<!-- Next.js -->
<Link href="/about">About</Link>

<!-- Litro -->
<litro-link href="/about">About</litro-link>
```

`<litro-link>` is a standard Custom Element. It wraps an `<a>` tag for progressive enhancement and calls `LitroRouter.go()` on click for SPA navigation. Plain `<a>` tags work as normal — they trigger full page reloads.

`LitroRouter` does **not** intercept all `<a>` clicks on the page. This is a deliberate design decision: global click interception is fragile and breaks `target="_blank"`, external links, and anchor fragments. Use `<litro-link>` explicitly where you want SPA behavior.

## Static Generation

Next.js uses `generateStaticParams`. Litro exports `generateRoutes`.

**Next.js:**

```ts
export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map(p => ({ slug: p.slug }));
}
```

**Litro:**

```ts
export async function generateRoutes(): Promise<string[]> {
  const posts = await getPosts();
  return posts.map(p => `/blog/${p.slug}`);
}
```

Litro runs `generateRoutes()` at build time with `NITRO_PRESET=static` and prerenders each returned path to a static HTML file in `dist/static/`.

## Deployment

Litro uses Nitro for server and deployment. The same Vercel preset that Nuxt.js uses works with Litro:

```bash
# Vercel
NITRO_PRESET=vercel litro build

# Cloudflare Workers
NITRO_PRESET=cloudflare-workers litro build

# Static (CDN)
NITRO_PRESET=static litro build
```

No custom adapter code required — Nitro's presets handle the runtime differences.

## What to Read Next

- [Litro vs Next.js — full comparison](/compare/nextjs)
- [Next.js migration guide](/docs/migrate/from-nextjs)
- [Data Fetching guide](/docs/core-concepts/data-fetching)
