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

[URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) is a web platform API for matching URLs against patterns. It reached [Baseline Newly Available](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern#browser_compatibility) in September 2025 (Chrome 95+, Edge 95+, Firefox 119+, Safari 18.2+). For browsers without the native API — Safari 16.4–18.1 / iOS < 18.2 — `@beatzball/litro-router` ships a built-in fallback that activates automatically, so you don't need an external polyfill.

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

// 1. The outlet element must already be in the DOM. The router takes
//    ownership of its children and swaps them on every navigation.
const outlet = document.getElementById('outlet')!;
const router = new LitroRouter(outlet);

// 2. setRoutes() configures the route table, attaches a popstate listener,
//    and triggers an initial resolution for the current URL.
router.setRoutes([
  {
    path: '/',
    component: 'page-home',
    action: () => import('./pages/home.js'),
  },
  {
    path: '/blog/:slug',
    component: 'page-blog-post',
    action: () => import('./pages/blog-post.js'),
  },
  {
    path: '/:all(.*)*',                          // catch-all — must be last
    component: 'page-not-found',
    action: () => import('./pages/not-found.js'),
  },
]);
```

`new LitroRouter(outlet)` creates a router bound to the given outlet element; nothing happens until you call `setRoutes()`, which kicks off the first resolution synchronously. There is no separate `mount()` or `start()` step.

## The Route Object

```ts
interface Route {
  /** Path pattern — h3/path-to-regexp syntax (e.g. '/', '/blog/:slug', '/:all(.*)*'). */
  path: string;
  /** Custom element tag name to render. Routes without a component are skipped. */
  component?: string;
  /** Optional async callback run BEFORE the component is mounted — typically a dynamic import. */
  action?: () => Promise<void> | void;
}
```

Routes are matched in the order they're registered — there is no automatic sorting, so put more-specific routes before catch-alls. The router converts h3-style `:param(.*)*` catch-alls into URLPattern's `:param*` form at registration time via the exported `h3ToURLPattern()` helper.

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
  params: Record<string, string | undefined>;  // optional params can be undefined
  search: string;                              // includes '?' or ''
  hash: string;                                // includes '#' or ''
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

LitroRouter.go('/blog/new-post');
```

`LitroRouter.go()` is a static method — it pushes a new history entry and dispatches a synthetic `popstate`, which the active router instance picks up. Use it from event handlers, form submissions, or after an async operation completes.

### Back and forward

The router attaches its `popstate` listener inside `setRoutes()`, so browser back/forward navigation works as soon as you've registered your routes.

Hash-only navigations (clicking a `<a href="#section">`) still fire `popstate` per the HTML spec, but the router compares `location.pathname + location.search` against the previously rendered value (stored on `_lastPathAndSearch`) and skips the re-render when only the hash changed.

## Shadow DOM Scroll-to-Hash

Standard `window.location.hash` scrolling doesn't work inside shadow roots because `document.getElementById()` can't see elements inside a closed or open shadow root at arbitrary nesting depth.

LitroRouter's internal `_scrollToHash()` traverses the shadow DOM recursively to find elements with matching `id` attributes:

```ts
private _findDeep(root: Document | ShadowRoot | Element, id: string): Element | null {
  const sel = `#${CSS.escape(id)}`;
  const direct = root.querySelector(sel);
  if (direct) return direct;
  for (const el of root.querySelectorAll('*')) {
    if (el.shadowRoot) {
      const found = this._findDeep(el.shadowRoot, id);
      if (found) return found;
    }
  }
  return null;
}
```

After each navigation, if `location.hash` is set, the router waits for the mounted component's `updateComplete` promise (if it's a LitElement), then calls `_findDeep()` starting from `document`. This handles heading links in server-rendered docs pages where the headings live inside shadow roots.

This is handled internally; there is no public hook to call. The router takes care of fragment scrolling automatically on every navigation, including the initial one and back/forward navigations.

## Using Standalone — Without Litro

The router has no dependency on `@beatzball/litro`. You can use it with any Lit application or even plain custom elements.

```ts
// app.ts
import { LitroRouter } from '@beatzball/litro-router';

// Import your page components so they're registered as custom elements
import './pages/home.js';
import './pages/about.js';
import './pages/blog-post.js';

// Outlet must already be in the DOM. setRoutes() takes care of the rest.
const outlet = document.getElementById('app')!;
const router = new LitroRouter(outlet);

router.setRoutes([
  { path: '/',           component: 'page-home' },
  { path: '/about',      component: 'page-about' },
  { path: '/blog/:slug', component: 'page-blog-post' },
]);
```

The router appends the current page component as a child of the outlet element and replaces it on each navigation. If you prefer lazy-loaded page modules, pass an `action` on each route that imports the module — `action()` runs before the component is mounted, so `customElements.define()` is guaranteed to have run before `document.createElement(tag)` is called.

## SSR Safety

LitroRouter accesses `window`, `history`, and `document` only at call time — never at module evaluation time. The import itself is safe on the server: nothing touches `window` until you construct a `LitroRouter` and call `setRoutes()`.

In Litro's default Lit adapter, the router is dynamically imported inside `LitroOutlet.firstUpdated()`, which runs once after the element's first render and is guaranteed never to fire on the server:

```ts
override async firstUpdated() {
  const { LitroRouter } = await import('@beatzball/litro-router');
  this.router = new LitroRouter(this);
  this.router.setRoutes(this._routes);
}
```

The FAST and Elena adapters use `connectedCallback()` with a one-shot init flag for the same effect (FAST and Elena don't have a `firstUpdated()` hook). If you're using the router standalone in a setup with server rendering, apply the same dynamic-import-inside-a-client-only-lifecycle pattern.

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

**One router per outlet.** The router class isn't a singleton, but in practice you should only create one instance — multiple routers competing for the same `popstate` events would fight over the URL. If you need sub-routers for deeply nested components, use conditional rendering inside `onBeforeEnter` rather than nested `LitroRouter` instances.

## Further Reading

- [Client Router documentation](/docs/core-concepts/client-router) — covers outlet setup, `<litro-link>`, and integration with Litro's SSR pipeline
- [litro-router package reference](/docs/litro-router) — full API reference including TypeScript types
- [Getting Started](/docs/getting-started) — start here if you're new to Litro
