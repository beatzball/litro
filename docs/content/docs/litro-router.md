---
title: LitroRouter
description: API reference for the built-in LitroRouter client-side router.
date: 2026-01-01
---

# LitroRouter

`LitroRouter` is Litro's built-in client-side router. It lives in the `@beatzball/litro-router` package and uses the native URLPattern API.

## `setRoutes(routes)`

Configure the router with an array of route descriptors. Called internally by `<litro-outlet>`.

## `go(path)`

Navigate to a path programmatically:

```ts
import { LitroRouter } from '@beatzball/litro-router';

LitroRouter.go('/docs/getting-started');
```

## `<litro-outlet>`

The page mount point. Place it in your HTML shell (managed automatically by the framework). The router renders the matched page component inside this element.

## `<litro-link>`

A custom element for SPA navigation. Renders an `<a>` tag inside a Shadow DOM for progressive enhancement and accessibility.

```html
<litro-link href="/docs/getting-started">Getting Started</litro-link>
<litro-link href="/blog" target="_blank">Blog</litro-link>
```

## `LitroPage`

Base class for page components. Provides `onBeforeEnter` and `serverData`:

```ts
import { LitroPage } from '@beatzball/litro/runtime';
import type { LitroLocation } from '@beatzball/litro-router';

@customElement('page-profile')
export class ProfilePage extends LitroPage {
  _userId = '';

  override onBeforeEnter(location: LitroLocation) {
    this._userId = location.params.id ?? '';
  }

  override render() {
    const data = this.serverData as { user: User } | null;
    return html`<h1>${data?.user.name}</h1>`;
  }
}
```

## `LitroLocation`

```ts
interface LitroLocation {
  pathname: string;
  params: Record<string, string>;
  search: string;
  hash: string;
}
```
