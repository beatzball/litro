# litro-router

Zero-dependency client-side router for web components, built on the native [URLPattern API](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern).

- **Zero dependencies** — browser-native APIs only, nothing to bundle
- **URLPattern matching** — `:slug`, `:slug?`, and `/:all*` catch-alls
- **Explicit SPA navigation** — use `LitroRouter.go()` or `<litro-link>` for pushState navigation; plain `<a>` tags do full page reloads (browser default)
- **SSR safe** — no module-eval side effects; can be dynamically imported, never crashes Node.js
- **Framework agnostic** — works with any web component library (Lit, FAST, plain `HTMLElement`, etc.)

This package is also built into the [@beatzball/litro](https://github.com/beatzball/litro) fullstack framework — if you are using Litro you already have it and do not need to install it separately.

---

## Browser requirements

`URLPattern` is [Baseline Newly Available](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern#browser_compatibility) as of September 2025 (Chrome 95+, Edge 95+, Firefox 119+, Safari 16.4+). For older browsers a polyfill is available: [`urlpattern-polyfill`](https://github.com/nicolo-ribaudo/urlpattern-polyfill).

---

## Installation

```bash
npm install @beatzball/litro-router
# or
pnpm add @beatzball/litro-router
```

---

## Quick start

```typescript
import { LitroRouter } from '@beatzball/litro-router';

// 1. Provide an outlet element — the router swaps its children on navigation
const outlet = document.querySelector('#outlet')!;
const router = new LitroRouter(outlet);

// 2. Define routes — component must be a registered custom element tag name
router.setRoutes([
  {
    path: '/',
    component: 'page-home',
    action: () => import('./pages/home.js'),   // lazy-load before mount
  },
  {
    path: '/blog/:slug',
    component: 'page-blog-post',
    action: () => import('./pages/blog-post.js'),
  },
  {
    path: '/:all(.*)*',                        // catch-all — must be last
    component: 'page-not-found',
    action: () => import('./pages/not-found.js'),
  },
]);

// 3. Programmatic navigation
document.querySelector('#go-home')!.addEventListener('click', () => {
  LitroRouter.go('/');
});
```

The router immediately resolves the current `location.pathname` when `setRoutes()` is called. From then on it responds to `popstate` events (back/forward button). For in-app SPA navigation use `<litro-link>` (provided by the Litro framework) or call `LitroRouter.go()` directly — plain `<a>` tags perform full page reloads as usual.

---

## Route path syntax

Paths follow h3/path-to-regexp conventions:

| Pattern | Matches | Example match |
|---|---|---|
| `/` | Exactly `/` | `/` |
| `/about` | Exactly `/about` | `/about` |
| `/blog/:slug` | Named parameter | `/blog/hello-world` → `{ slug: 'hello-world' }` |
| `/docs/:section?` | Optional parameter | `/docs/` or `/docs/api` |
| `/:all(.*)*` | Catch-all (greedy) | `/any/depth/path` → `{ all: 'any/depth/path' }` |

---

## API

### `new LitroRouter(outlet: HTMLElement)`

Creates a router instance that renders matched page components into `outlet`.

The outlet element should be an empty container already in the document. After `setRoutes()` is called the router owns the outlet's children — do not manipulate them directly.

### `router.setRoutes(routes: Route[])`

Configures the route table. Also attaches a `popstate` listener and triggers an initial resolution for the current URL. Call this once after the outlet is in the DOM.

Routes without a `component` are skipped during resolution (useful for redirect-only routes using `action`).

**Note**: `LitroRouter` does **not** intercept plain `<a>` clicks. Plain anchors perform full page reloads (browser default). For SPA navigation use `<litro-link>` (provided by the Litro framework) or call `LitroRouter.go()` directly.

### `LitroRouter.go(path: string)`

Static method. Pushes `path` onto the history stack and dispatches a `popstate` event, triggering the router to resolve the new URL.

```typescript
LitroRouter.go('/blog/hello-world');
LitroRouter.go('/search?q=lit');    // search string preserved
```

### `Route`

```typescript
interface Route {
  /** Path pattern — see "Route path syntax" above. */
  path: string;
  /** Custom element tag name to render (must be registered via customElements.define). */
  component?: string;
  /** Optional async callback run before the component is mounted. */
  action?: () => Promise<void> | void;
}
```

### `LitroLocation`

The location object passed to `onBeforeEnter` on the page element (if the method exists):

```typescript
interface LitroLocation {
  pathname: string;                            // e.g. '/blog/hello-world'
  params: Record<string, string | undefined>;  // e.g. { slug: 'hello-world' }
  search: string;                              // e.g. '?page=2' or ''
  hash: string;                                // e.g. '#section' or ''
}
```

### `h3ToURLPattern(path: string): string`

Converts h3/path-to-regexp catch-all syntax to URLPattern syntax. Called automatically by `setRoutes()` — you do not need to call this yourself unless you are building tooling on top of the router.

```typescript
h3ToURLPattern('/:all(.*)*')  // → '/:all*'
h3ToURLPattern('/blog/:slug') // → '/blog/:slug' (unchanged)
```

---

## Page lifecycle hook

If the element that the router mounts has an `onBeforeEnter` method, the router calls it with the current `LitroLocation` **before** appending the element to the outlet. This is the correct place to fetch data for the new route.

```typescript
import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { LitroLocation } from '@beatzball/litro-router';

@customElement('page-blog-post')
class BlogPostPage extends LitElement {
  @state() post?: { title: string; body: string };

  async onBeforeEnter(location: LitroLocation) {
    const res = await fetch(`/api/posts/${location.params.slug}`);
    this.post = await res.json();
  }

  render() {
    return html`<article>
      <h1>${this.post?.title}</h1>
      <p>${this.post?.body}</p>
    </article>`;
  }
}
```

---

## SPA navigation

`LitroRouter` does **not** intercept plain `<a>` clicks. Plain anchors always perform full page reloads — this is the correct browser default and the right behaviour for SSG sites, where each page load fetches a fresh pre-rendered HTML file with the correct `__litro_data__` script tag injected by the server.

For explicit SPA navigation use one of the following:

- **`<litro-link href="...">`** — a custom element provided by the `litro` framework package. It wraps a standard `<a>` and calls `LitroRouter.go()` on click, intercepting only same-origin, left-click, no-modifier clicks. Falls back to a normal full-page navigation if JavaScript is disabled.
- **`LitroRouter.go(path)`** — call directly from event handlers or programmatic navigation.

---

## SSR usage

`litro-router` accesses `window`, `history`, `document`, and `location` at **call time** (inside methods), not at module evaluation time. This means it is safe to import the module types in server code:

```typescript
import type { Route, LitroLocation } from '@beatzball/litro-router'; // type-only: safe on server
```

The `LitroRouter` class itself must only be instantiated in the browser. The recommended pattern is a dynamic import inside a client-only lifecycle hook:

```typescript
override async firstUpdated() {
  const { LitroRouter } = await import('@beatzball/litro-router');
  const router = new LitroRouter(this);
  router.setRoutes(this.routes);
}
```

---

## TypeScript

`URLPattern` is not yet in TypeScript's `lib.dom.d.ts`. `litro-router` ships minimal inline ambient declarations so your project does not need `lib` changes or a separate `@types` package.

---

## License

Apache License 2.0 — Copyright 2026 beatzball. See [LICENSE](../../LICENSE) for the full text.
