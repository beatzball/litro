---
title: "LitroRouter — A URLPattern Router for Web Components"
description: "LitroRouter is a zero-dependency client-side router for Lit components built on the URLPattern API. This post covers the design decisions, the API, shadow DOM scroll-to-hash, and how to use it standalone without the full Litro framework."
date: 2026-03-22
tags: [router, urlpattern, web-components, client-side-routing]
---

# LitroRouter — A URLPattern Router for Web Components

Client-side routing in web components has a few requirements that generic routers don't always handle well: the router must never execute server-side (no `window` or `history` access at module evaluation time), navigation must work across shadow DOM boundaries, and scroll-to-hash needs to find elements inside shadow roots — not just in the light DOM.

`@beatzball/litro-router` is a zero-dependency router built on the URLPattern API that addresses all three. It ships as a standalone package so you can use it with Lit components without adopting the full Litro framework.

## The URLPattern API

[URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) is a web platform API for matching URLs against patterns. It reached Baseline in September 2025 — available in Chrome, Firefox, and Safari without a polyfill.

```ts
const pattern = new URLPattern({ pathname: '/blog/:slug' });
pattern.test({ pathname: '/blog/hello-world' }); // true
pattern.exec({ pathname: '/blog/hello-world' })?.pathname.groups; // { slug: 'hello-world' }
```

URLPattern handles the same patterns as path-to-regexp — dynamic segments (`:param`), catch-alls (`:slug*`), optional params — but as a native browser API rather than a library dependency.

LitroRouter converts Litro's h3-style path format (`:param(.*)*` for catch-alls) to URLPattern format (`:param*`) at route registration time. If you're using the router standalone, you can use either format.

## Installing Standalone

```bash
npm install @beatzball/litro-router
```

```bash
pnpm add @beatzball/litro-router
```

The package is ESM-only and has zero runtime dependencies.

## Basic Setup

```ts
import { LitroRouter } from '@beatzball/litro-router';
import type { LitroLocation } from '@beatzball/litro-router';

const router = LitroRouter.instance();

router.setRoutes([
  {
    path: '/',
    component: 'page-home',
    isDynamic: false,
    isCatchAll: false,
  },
  {
    path: '/blog/:slug',
    component: 'page-blog-post',
    isDynamic: true,
    isCatchAll: false,
  },
  {
    path: '/docs/:slug*',
    component: 'page-docs',
    isDynamic: true,
    isCatchAll: true,
  },
]);

router.mount(document.getElementById('outlet')!);
router.start();
```

`LitroRouter` is a singleton — `LitroRouter.instance()` returns the same instance every time. This is intentional: only one router should be managing the URL at a time.

## The Route Object

```ts
interface Route {
  path: string;       // URL pattern — '/blog/:slug', '/docs/:rest*'
  component: string;  // Custom element tag name
  isDynamic: boolean; // true if path contains :params
  isCatchAll: boolean; // true if path ends with :param*
}
```

Routes are sorted automatically: static routes match before dynamic, dynamic before catch-all. You don't need to sort them yourself.

## `onBeforeEnter`

When LitroRouter navigates to a route, it creates a new instance of the component, calls `onBeforeEnter()` if it exists, then appends the element to the outlet. This lets you access route params before the first render.

```ts
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import type { LitroLocation } from '@beatzball/litro-router';

@customElement('page-blog-post')
export class BlogPostPage extends LitroPage {
  private slug = '';

  override onBeforeEnter(location: LitroLocation) {
    this.slug = location.params.slug ?? '';
  }

  override render() {
    return html`<h1>Post: ${this.slug}</h1>`;
  }
}
```

`LitroLocation` has:

```ts
interface LitroLocation {
  pathname: string;
  params: Record<string, string>;
  search: string;
  hash: string;
}
```

`onBeforeEnter` fires synchronously before the element is mounted. If you need async work (data fetching), kick it off here and store the promise — then resolve it in `render()` or a Lit reactive property.

## Navigation

### `<litro-link>`

```html
<litro-link href="/blog/hello-world">Read post</litro-link>
```

`<litro-link>` renders a standard `<a>` tag inside its shadow root for progressive enhancement and accessibility. Click handling runs in the capture phase on the host element, intercepting the navigation before the browser follows the `href`.

Plain `<a>` tags do full page reloads — LitroRouter does not intercept them. This is intentional. If you want SPA navigation, use `<litro-link>`. If you want a full page load (e.g. navigating between separate sections of a large site), use `<a>`.

### Programmatic navigation

```ts
import { LitroRouter } from '@beatzball/litro-router';

LitroRouter.instance().go('/blog/new-post');
```

`go()` pushes a new history state and triggers a navigation. Use this for navigation from event handlers, form submissions, or after an async operation completes.

### Back and forward

`LitroRouter` listens for `popstate` events automatically. Browser back and forward navigation works without any additional setup.

Fragment-only `popstate` events (clicking a `#section` link that only changes the hash) are skipped — the router guards on `_lastPathname` and won't re-render the page for hash-only changes.

## Shadow DOM Scroll-to-Hash

Standard `window.location.hash` scrolling doesn't work inside shadow roots because `document.getElementById()` can't see elements inside a closed or open shadow root at arbitrary nesting depth.

LitroRouter's `_scrollToHash()` traverses the shadow DOM recursively to find elements with matching `id` attributes:

```ts
private _findDeep(root: Element | ShadowRoot, id: string): Element | null {
  for (const el of root.querySelectorAll(`[id="${id}"], *`)) {
    if ((el as Element).id === id) return el as Element;
    const shadow = (el as HTMLElement).shadowRoot;
    if (shadow) {
      const found = this._findDeep(shadow, id);
      if (found) return found;
    }
  }
  return null;
}
```

After each navigation, if `location.hash` is set, the router waits for the mounted component's `updateComplete` promise (if it's a LitElement), then calls `_findDeep()` starting from `document.body`. This handles heading links in server-rendered docs pages where the headings live inside shadow roots.

If you're using the router standalone with non-Lit components, you can call `router.scrollToHash(hash)` directly.

## Using Standalone — Without Litro

The router has no dependency on `@beatzball/litro`. You can use it with any Lit application or even plain custom elements.

```ts
// app.ts
import { LitroRouter } from '@beatzball/litro-router';

// Import your page components so they're registered as custom elements
import './pages/home.js';
import './pages/about.js';
import './pages/blog-post.js';

const router = LitroRouter.instance();

router.setRoutes([
  { path: '/', component: 'page-home', isDynamic: false, isCatchAll: false },
  { path: '/about', component: 'page-about', isDynamic: false, isCatchAll: false },
  { path: '/blog/:slug', component: 'page-blog-post', isDynamic: true, isCatchAll: false },
]);

// Mount to any container element
router.mount(document.getElementById('app')!);
router.start();
```

The outlet element should be in the DOM before calling `mount()`. The router appends the current page component as a child of the outlet element and replaces it on each navigation.

## SSR Safety

LitroRouter accesses `window`, `history`, and `document` at runtime — not at module evaluation time. The import itself is safe on the server. No side effects execute until `start()` is called.

In Litro, the router is dynamically imported inside `LitroOutlet.firstUpdated()`:

```ts
override async firstUpdated() {
  const { LitroRouter } = await import('@beatzball/litro-router');
  // ...
}
```

This ensures the module is never evaluated during SSR. If you're using the router standalone in a setup with server rendering, apply the same dynamic import pattern.

## Monotonic Navigation Token

Concurrent navigations — triggered by rapid clicks or programmatic `go()` calls — used to be a source of subtle bugs: a slow async operation from an earlier navigation could resolve after a faster one, overwriting the correct state.

LitroRouter uses a monotonic counter (`_resolveToken`) to prevent this:

```ts
const token = ++this._resolveToken;
const result = await this._resolve(url);
if (token !== this._resolveToken) return; // stale — a newer navigation won
```

Only the most recently initiated navigation can commit. Earlier navigations that are still in flight are discarded when they resolve. This is particularly relevant if you're doing async data loading in `onBeforeEnter`.

## Design Decisions

**No global `<a>` click interceptor.** Some routers intercept every click on every anchor tag on the page. This breaks third-party components that use `<a>` for non-navigation purposes (toggles, downloads, external links). LitroRouter requires explicit opt-in via `<litro-link>` or `LitroRouter.go()`.

**pushState only — no hash routing.** Hash routing is a workaround for environments that don't support HTML5 history. In 2026, all deployment targets Litro supports handle pushState correctly (including static hosting on Cloudflare Pages and GitHub Pages with proper `_redirects` / `404.html` fallbacks).

**Singleton.** One router per page. If you need sub-routers for deeply nested components, use conditional rendering inside `onBeforeEnter` rather than nested `LitroRouter` instances.

## Further Reading

- [Client Router documentation](/docs/core-concepts/client-router) — covers outlet setup, `<litro-link>`, and integration with Litro's SSR pipeline
- [litro-router package reference](/docs/litro-router) — full API reference including TypeScript types
- [Getting Started](/docs/getting-started) — start here if you're new to Litro
