---
title: Migrating from Next.js to Litro
description: A practical guide to migrating a Next.js application to Litro. Covers file-based routing, server-side data fetching, API routes, navigation, and CSS scoping with step-by-step before/after code examples.
date: 2026-01-01
---

# Migrating from Next.js to Litro

This guide maps Next.js concepts to their Litro equivalents. If you're comfortable with Next.js, you'll find most patterns map directly — the biggest change is replacing React and JSX with Lit and tagged template literals.

## Concept Map

| Next.js | Litro | Notes |
|---------|-------|-------|
| `app/page.tsx` | `pages/index.ts` | Same location concept |
| `export default function Page()` | `@customElement class Page extends LitroPage` | Class vs function |
| Server Component `fetch()` | `definePageData(async () => {...})` | Server-side data fetching |
| `getServerSideProps` | `definePageData()` | Same purpose, different API |
| `useRouter()` | `LitroRouter` | URLPattern-based router |
| `<Link href="...">` | `<litro-link href="...">` | SPA navigation |
| `app/api/route.ts` | `server/api/*.ts` | H3 event handler |
| CSS Modules | `static styles = css\`...\`` | Shadow DOM scoping |
| `next.config.js` | `nitro.config.ts` + `vite.config.ts` | Split server/client config |
| `next build` | `litro build` | — |
| `next dev` | `litro dev` | — |

## Pages and Routing

Next.js maps `app/page.tsx` to routes. Litro maps `pages/*.ts` to routes using the same file-system convention.

**Next.js — `app/about/page.tsx`:**

```tsx
export default function AboutPage() {
  return <h1>About</h1>;
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
    return html`<h1>About</h1>`;
  }
}

export default AboutPage;
```

### Dynamic routes

| Next.js | Litro |
|---------|-------|
| `app/blog/[slug]/page.tsx` | `pages/blog/[slug].ts` |
| `app/[...slug]/page.tsx` | `pages/[...slug].ts` |
| `app/[[...slug]]/page.tsx` | `pages/[[slug]].ts` |

## Server-Side Data Fetching

Next.js uses Server Components or `getServerSideProps`. Litro uses `definePageData`.

**Next.js — Server Component:**

```tsx
export default async function BlogPage() {
  const posts = await fetch('/api/posts').then(r => r.json());
  return <ul>{posts.map(p => <li key={p.id}>{p.title}</li>)}</ul>;
}
```

**Litro — `definePageData` + `LitroPage`:**

```ts
import { definePageData } from '@beatzball/litro';
import { LitroPage } from '@beatzball/litro/runtime';

export const pageData = definePageData(async (_event) => {
  const posts = await $fetch<Post[]>('/api/posts');
  return { posts };
});

@customElement('page-blog')
export class BlogPage extends LitroPage {
  override render() {
    const data = this.serverData as { posts: Post[] } | null;
    if (!data) return html`<p>Loading&hellip;</p>`;
    return html`
      <ul>${data.posts.map(p => html`<li>${p.title}</li>`)}</ul>
    `;
  }
}
```

The data is serialized into a `<script type="application/json">` tag during SSR. On the client, `this.serverData` reads it without a second network request.

For dynamic routes, access route parameters via the H3 event:

```ts
export const pageData = definePageData(async (event) => {
  const slug = event.context.params?.slug ?? '';
  const post = await $fetch<Post>(`/api/posts/${slug}`);
  return { post };
});
```

## API Routes

API routes use H3 event handlers — the same library Nuxt.js uses.

**Next.js — `app/api/hello/route.ts`:**

```ts
export async function GET(request: Request) {
  return Response.json({ message: 'Hello' });
}
```

**Litro — `server/api/hello.ts`:**

```ts
import { defineEventHandler } from 'h3';

export default defineEventHandler(() => {
  return { message: 'Hello' };
});
```

H3 automatically serializes object return values as JSON. The route is available at `/api/hello`.

## Navigation

Next.js uses `<Link>` for SPA navigation. Litro uses `<litro-link>`.

```html
<!-- Next.js -->
<Link href="/about">About</Link>

<!-- Litro -->
<litro-link href="/about">About</litro-link>
```

`<litro-link>` calls `LitroRouter.go()` for SPA navigation. Plain `<a>` tags do full page reloads (browser default — same as any anchor element).

## CSS and Styling

Next.js uses CSS Modules for scoped styles. Litro uses Shadow DOM — styles defined in `static styles` are automatically scoped to the component.

**Next.js — CSS Modules:**

```tsx
import styles from './Button.module.css';

export function Button({ children }) {
  return <button className={styles.btn}>{children}</button>;
}
```

**Litro — Shadow DOM styles:**

```ts
import { html, css, LitElement } from 'lit';

class MyButton extends LitElement {
  static styles = css`
    button {
      background: var(--color-primary);
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
    }
  `;

  render() {
    return html`<button><slot></slot></button>`;
  }
}
```

No class name collisions. No CSS-in-JS runtime. The styles are part of the component definition.

## Configuration

Next.js combines server and client config in `next.config.js`. Litro splits it:

| Next.js | Litro |
|---------|-------|
| `rewrites` | Nitro route rules |
| `headers` | `routeRules[path].headers` in `nitro.config.ts` |
| Webpack plugins | Vite plugins in `vite.config.ts` |
| `env` | Nitro env vars (same semantics) |
| Build output | `litro build` → `dist/server/` or `dist/static/` |

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

Litro runs `generateRoutes()` at build time and prerenders each returned path to a static HTML file.

## Next Steps

- [Litro vs Next.js — full comparison](/compare/nextjs)
- [Getting Started with Litro](/docs/getting-started)
- [Data Fetching guide](/docs/core-concepts/data-fetching)
