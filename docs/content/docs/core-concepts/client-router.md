---
title: Client-Side Router
description: LitroRouter is Litro's built-in client router using the native URLPattern API. No external dependency.
date: 2026-01-01
---

# Client-Side Router

Litro ships a built-in client-side router (`LitroRouter`) built on the native [URLPattern API](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern). No external router dependency.

## Navigation

Use `<litro-link>` for SPA navigation. Plain `<a>` tags cause full page reloads:

```html
<!-- SPA navigation — no full reload -->
<litro-link href="/docs/getting-started">Getting Started</litro-link>

<!-- Full page reload (browser default) -->
<a href="/docs/getting-started">Getting Started</a>
```

## Programmatic Navigation

```ts
import { LitroRouter } from '@beatzball/litro-router';

LitroRouter.go('/docs/getting-started');
```

## Route Parameters

The router passes parsed parameters to `onBeforeEnter`:

```ts
@customElement('page-blog-slug')
export class BlogSlugPage extends LitroPage {
  _slug = '';

  override onBeforeEnter(location: LitroLocation) {
    this._slug = location.params.slug ?? '';
  }

  override render() {
    return html`<p>Slug: ${this._slug}</p>`;
  }
}
```

## Hash Navigation

The router handles `popstate` events from fragment links (#hash). It automatically scrolls to the target heading after mount, traversing shadow DOM roots to find the element.

## SSG and the Router

The `crawlLinks` option does **not** find `LitroRouter` routes automatically. Add all static page routes to `prerender.routes` explicitly. Litro's SSG plugin handles this via `generateRoutes()` exports on page files.
