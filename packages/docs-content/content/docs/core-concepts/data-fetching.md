---
title: Data Fetching
description: Use definePageData for server-side data fetching and getServerData to read it on the client.
date: 2026-01-01
---

# Data Fetching

## `definePageData`

Export a `pageData` constant using `definePageData` to fetch data server-side before the page renders:

```ts
import { definePageData } from '@beatzball/litro';

export const pageData = definePageData(async (event) => {
  const slug = event.context.params?.slug ?? '';
  const post = await fetchPostBySlug(slug);
  return { post };
});
```

The `event` parameter is an H3 `H3Event`. You can read URL params, headers, cookies, and request bodies.

## How Data Flows

1. The page handler calls `pageData.fetcher(event)` before rendering.
2. The result is JSON-serialized and injected into the HTML as `<script type="application/json" id="__litro_data__">`.
3. During SSR, the data is passed as a `.serverData` property on the component so `render()` sees the real data immediately.
4. On the client, the router reads the JSON from the DOM on first load and sets `this.serverData` on the component instance before mounting.

## Reading Server Data

Access server data via `this.serverData` in your component:

```ts
@customElement('page-blog-slug')
export class BlogSlugPage extends LitroPage {
  override render() {
    const data = this.serverData as { post: Post } | null;
    if (!data) return html`<p>Loading...</p>`;
    return html`<h1>${data.post.title}</h1>`;
  }
}
```

## Reserved Fields

Three optional string fields in the `definePageData` result are extracted server-side into the HTML shell and stripped from the serialized client JSON:

- **`seoTitle`** — the document `<title>`.
- **`seoHead`** — raw HTML injected into `<head>` (meta tags, Open Graph, JSON-LD).
- **`bodyScript`** — raw HTML emitted at end-of-body, immediately before the app-bundle `<script>`. A synchronous classic script here runs after the page's (declarative shadow DOM) content has been parsed but before the module bundle executes — a pre-hydration slot for filling values the server can't know (for example, times in the user's local timezone) on first paint.

```ts
export const pageData = definePageData(async () => ({
  seoTitle: 'Now - My App',
  bodyScript: `<script>(function(){
    var el = document.querySelector('page-now');
    if (!el || !el.shadowRoot) return;
    var slot = el.shadowRoot.querySelector('.local-time');
    if (slot) slot.textContent = new Date().toLocaleTimeString();
  })();</script>`,
}));
```

`bodyScript` runs only on full document loads — on client-side (SPA) navigations it does not re-run, so the component's own rendering must still produce the final values (the pre-paint script only makes the first paint correct sooner). All three fields are author-controlled raw HTML: Litro applies no escaping, so never build them from untrusted input.

## Error Handling

Throw an H3 error to return a 404 or other error status:

```ts
import { createError } from 'h3';

export const pageData = definePageData(async (event) => {
  const slug = event.context.params?.slug ?? '';
  const post = await fetchPost(slug);
  if (!post) throw createError({ statusCode: 404, message: 'Post not found' });
  return post;
});
```
