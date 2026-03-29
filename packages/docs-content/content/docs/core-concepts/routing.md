---
title: Routing
description: Litro uses file-system routing — page filenames map directly to URL paths.
date: 2026-01-01
---

# Routing

## File-System Routing

Litro uses the `pages/` directory for routing. Filenames map to URL paths:

| File | Route |
|---|---|
| `pages/index.ts` | `/` |
| `pages/about.ts` | `/about` |
| `pages/blog/index.ts` | `/blog` |
| `pages/blog/[slug].ts` | `/blog/:slug` |
| `pages/[...all].ts` | `/*` (catch-all) |

## Page Components

Each page file exports a **default** Lit component class decorated with `@customElement`:

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

## Route Parameters

Dynamic segments are available in `definePageData` via `event.context.params`:

```ts
export const pageData = definePageData(async (event) => {
  const slug = event.context.params?.slug ?? '';
  // ...
});
```

On the client side, `onBeforeEnter(location)` receives the parsed route parameters:

```ts
override onBeforeEnter(location: LitroLocation) {
  this._slug = location.params.slug ?? '';
}
```

## Route Metadata

Export a `routeMeta` object to control the page's `<title>` and inject extra `<head>` HTML:

```ts
export const routeMeta = {
  title: 'About — My Site',
  head: '<meta name="description" content="About page" />',
};
```
