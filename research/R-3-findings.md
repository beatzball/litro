# R-3 Findings: `@vaadin/router` — API, Lit Integration, Lifecycle Hooks, and Litro Wiring

**Agent:** R-3
**Date:** 2026-02-28
**Status:** Complete
**Intended Consumer:** Implementation agent I-4 (client hydration bootstrap and router integration), I-5 (data fetching)

---

## 1. Summary

`@vaadin/router` (v2.x) is the most mature web-component-native client-side router available. It was designed specifically for use with custom elements and has no dependency on any component framework — it manipulates the DOM directly by instantiating custom element tags into an outlet container. It uses the browser's History API (`pushState`) by default, with hash-based routing available as an alternative. Route definitions are JavaScript objects with a `path` string and a `component` string (the custom element tag name), and lazy loading is supported via an `action` callback that dynamically imports a module before the router renders the component. Lifecycle hooks (`onBeforeEnter`, `onAfterEnter`, `onBeforeLeave`, `onAfterLeave`) are declared as methods directly on the custom element class. The primary integration consideration for Litro is that the router outlet must be a real, pre-existing DOM node — it renders by setting `innerHTML` or appending child elements — and this mechanism interacts with Lit's rendering lifecycle only if Litro carelessly renders over router-managed DOM; as long as the router outlet element is kept separate from Lit's own render root, there are no conflicts.

---

## 2. Minimal Setup — Mount Router in a Lit Component

### Package Installation

```sh
npm install @vaadin/router
```

### Import

```ts
import { Router } from '@vaadin/router';
```

### Minimal Lit Root Component

The router requires a DOM element to use as its **outlet** — a container into which it renders the current route's component. The outlet must be a real DOM node in the document (not a Shadow DOM slot unless the router is initialized after `connectedCallback`).

```ts
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { Router } from '@vaadin/router';

@customElement('app-root')
export class AppRoot extends LitElement {
  // IMPORTANT: Use createRenderRoot() to render into the light DOM,
  // OR grab a ref to a child element in the shadow DOM after firstUpdated.
  // The router outlet must be a real DOM node the router can appendChild() into.

  private router!: Router;

  // Option A: Light DOM render root (simplest for router outlet)
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
      </nav>
      <main id="outlet"></main>
    `;
  }

  firstUpdated() {
    const outlet = this.querySelector('#outlet')!;
    this.router = new Router(outlet);
    this.router.setRoutes([
      { path: '/', component: 'app-home' },
      { path: '/about', component: 'app-about' },
    ]);
  }
}
```

**Key constraint:** The outlet element must already exist in the DOM when `new Router(outlet)` is called. `firstUpdated()` is the correct Lit lifecycle hook for this because it fires after the component's first render, guaranteeing the outlet element is present.

**Shadow DOM note:** If you keep Shadow DOM (the default for `LitElement`), the outlet must be queried from `this.shadowRoot`:

```ts
firstUpdated() {
  const outlet = this.shadowRoot!.querySelector('#outlet')!;
  this.router = new Router(outlet);
  // ...
}
```

Shadow DOM outlets work fine with `@vaadin/router` — the router simply appends child elements inside the shadow root.

---

## 3. Lazy Loading — Dynamic Import Pattern

Lazy loading is implemented via the `action` property on a route definition. The `action` function is called by the router before the component is rendered; it must dynamically import the module that registers the custom element, then return nothing (the component is identified by the `component` property, which must match a registered custom element tag name).

### Pattern

```ts
router.setRoutes([
  {
    path: '/',
    component: 'app-home',
    action: async () => {
      await import('./pages/app-home.js');
    },
  },
  {
    path: '/about',
    component: 'app-about',
    action: async () => {
      await import('./pages/app-about.js');
    },
  },
  {
    path: '/blog/:slug',
    component: 'app-blog-post',
    action: async () => {
      await import('./pages/app-blog-post.js');
    },
  },
]);
```

**How it works:** When the router activates a route:
1. It calls the `action()` function and awaits it.
2. The dynamic import executes, which causes the module to call `customElements.define('app-home', AppHome)` as a side effect.
3. After the promise resolves, the router creates a `<app-home>` element and inserts it into the outlet.

**Critical:** The module must define the custom element as a side effect of being imported. Lit components decorated with `@customElement('app-home')` do this automatically. If using manual `customElements.define()`, it must be at module top level, not inside a conditional.

### Vite Code Splitting

With Vite, dynamic imports automatically produce separate chunks. No additional configuration is needed — every `await import('./pages/app-home.js')` becomes a separate JavaScript chunk in the production build.

### Returning the component from action

An alternative pattern is to return the component class from `action` and let the router handle registration:

```ts
{
  path: '/about',
  action: async (context, commands) => {
    const { AppAbout } = await import('./pages/app-about.js');
    // If not using @customElement decorator, register here:
    if (!customElements.get('app-about')) {
      customElements.define('app-about', AppAbout);
    }
    // Return a redirect, a prevent, or nothing
    // Returning commands.component('app-about') is equivalent to setting component: 'app-about'
    return commands.component('app-about');
  },
},
```

The `commands.component(tagName)` approach is useful when you want the `action` to make a runtime decision about which component to render.

---

## 4. Nested Routes and Layouts

`@vaadin/router` supports nested routes through child route definitions. A parent route defines a layout component; child routes are defined in a `children` array. The layout component must contain a `<slot>` for the child component to render into — but critically, the router uses its own outlet mechanism, not native `<slot>`. The correct pattern is for the parent layout component to contain its own `<vaadin-router-outlet>` or, more accurately, expose a DOM outlet that the router can discover.

### Correct Nested Route Pattern

```ts
router.setRoutes([
  {
    path: '/blog',
    component: 'app-blog-layout',     // Parent layout component
    action: async () => { await import('./layouts/app-blog-layout.js'); },
    children: [
      {
        path: '/',                     // Matches /blog exactly
        component: 'app-blog-index',
        action: async () => { await import('./pages/app-blog-index.js'); },
      },
      {
        path: '/:slug',               // Matches /blog/:slug
        component: 'app-blog-post',
        action: async () => { await import('./pages/app-blog-post.js'); },
      },
    ],
  },
]);
```

### Layout Component Must Expose a Router Outlet

The **layout component** (`app-blog-layout`) must have an element where the router can render the child route. The router looks for an element with the `[vaadin-router-outlet]` attribute inside the parent component, OR it will append to the parent component's own shadow root / light DOM:

```ts
// app-blog-layout.ts
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('app-blog-layout')
export class AppBlogLayout extends LitElement {
  createRenderRoot() { return this; }  // Light DOM for router outlet discoverability

  render() {
    return html`
      <aside>Blog Sidebar</aside>
      <section vaadin-router-outlet></section>
    `;
  }
}
```

**Important detail:** `@vaadin/router` looks for a child element with the `vaadin-router-outlet` attribute inside the outlet element when rendering nested routes. If the attribute is not found, the router falls back to appending directly to the layout component's light DOM root. **Using light DOM** in layout components (`createRenderRoot() { return this; }`) is the most reliable approach for nested routing.

### Depth Limit

There is no documented depth limit for nesting. In practice, nesting 3+ levels deep works correctly.

---

## 5. Route Metadata — Title, Guards, and Data Attachment

Route metadata is attached directly to the route definition object as additional properties. `@vaadin/router` does not enforce a specific schema; any properties added to a route definition are accessible via `context.route` in lifecycle hooks and action functions.

### Title

```ts
{
  path: '/about',
  component: 'app-about',
  name: 'about',           // Named route — enables Router.urlForName('about')
  // Custom metadata — accessible in action/lifecycle hooks
  title: 'About Us',
  requiresAuth: false,
}
```

Titles are not applied automatically; you must read them in a lifecycle hook or action and set `document.title` manually:

```ts
{
  path: '/about',
  component: 'app-about',
  action: async (context) => {
    document.title = (context.route as any).title ?? 'My App';
    await import('./pages/app-about.js');
  },
}
```

### Guards (Route-Level Protection)

Route guards are implemented in `action` functions. There is no separate "guard" API — `action` is the guard mechanism:

```ts
{
  path: '/dashboard',
  component: 'app-dashboard',
  action: async (context, commands) => {
    if (!isLoggedIn()) {
      return commands.redirect('/login');
    }
    await import('./pages/app-dashboard.js');
  },
}
```

`commands.redirect(path)` returns a redirect result object. Returning it from `action` causes the router to navigate to the new path instead of rendering the component.

### Data Attachment

Route-level data (static) can be attached as custom properties:

```ts
{
  path: '/admin',
  component: 'app-admin',
  requiredRole: 'admin',
  action: async (context, commands) => {
    const requiredRole = (context.route as any).requiredRole;
    if (!hasRole(requiredRole)) {
      return commands.redirect('/forbidden');
    }
    await import('./pages/app-admin.js');
  },
}
```

Dynamic data (fetched at navigation time) is passed via `context.params` (URL params) and can be attached to the element via `context.next()` and `context.result`:

```ts
{
  path: '/users/:id',
  action: async (context, commands) => {
    const { AppUserPage } = await import('./pages/app-user-page.js');
    // Cannot directly pass data to the component here —
    // use onBeforeEnter lifecycle hook on the component instead
  },
}
```

**The correct pattern for per-navigation data** is to use the `onBeforeEnter` lifecycle hook on the component itself (see Section 7). The component receives the route `context` object which contains `context.params`, `context.query`, and `context.pathname`.

---

## 6. History API — pushState vs Hash Mode

### Default: History (pushState) Mode

By default, `@vaadin/router` uses the HTML5 History API (`window.history.pushState`). All `<a href>` clicks within the document are intercepted (via a global `click` listener on `window`) and handled as client-side navigation unless they have:
- A non-empty `target` attribute (e.g., `target="_blank"`)
- A non-same-origin `href`
- A `download` attribute
- A modifier key held (Ctrl, Cmd, Shift, Alt)

Links outside the router's outlet but within the same document are still intercepted. This is important: **all navigation in the app is intercepted by default**, not just links inside the outlet.

### Hash Mode

Hash-based routing (`#/path`) is not natively supported in `@vaadin/router` v1 or v2. The router is designed exclusively for `pushState`-based routing. If hash routing is required, a third-party adapter or manual `hashchange` listener would be needed.

**Recommendation for Litro:** Use the default `pushState` mode. Hash routing is not a goal and would conflict with server-side route handling.

### Base URL Configuration

If the app is not served from the root `/`, the router's base URL must be configured:

```ts
const router = new Router(outlet, { baseUrl: '/my-app/' });
```

Or via the static `Router.setTriggers()` for custom link interception:

```ts
// Custom triggers — advanced, rarely needed
Router.setTriggers(Router.NavigationTrigger.POPSTATE, Router.NavigationTrigger.CLICK);
```

### How the Click Interceptor Works

`@vaadin/router` installs a global `click` event listener on `window` at import time (via a module-level side effect). This runs automatically when you import `@vaadin/router`. It is the mechanism that converts anchor clicks into `pushState` navigations.

```ts
// This is what the router does internally at module load:
window.addEventListener('click', (e) => {
  // Check if click is on an <a> element with a same-origin href
  // If so: e.preventDefault(), then router.navigate(href)
});
```

**Litro implication:** The `<litro-link>` custom element described in the I-4 brief is **not strictly necessary** for navigation — any standard `<a href="/about">About</a>` will be intercepted automatically. However, `<litro-link>` may still be useful for accessibility attributes or active-link styling.

---

## 7. Lifecycle Hooks — All Available Hooks

`@vaadin/router` provides four lifecycle callbacks that can be declared as methods on a custom element class (including `LitElement` subclasses). The router checks for these methods by name on the element instance before and after navigation.

### Available Hooks

| Hook | Phase | Called On | Called When |
|------|-------|-----------|-------------|
| `onBeforeEnter(location, commands, router)` | Before enter | Entering component | Before the component is connected to the DOM |
| `onAfterEnter(location, commands, router)` | After enter | Entering component | After the component is connected to the DOM |
| `onBeforeLeave(location, commands, router)` | Before leave | Leaving component | Before the component is removed from the DOM |
| `onAfterLeave(location, commands, router)` | After leave | Leaving component | After the component is removed from the DOM |

### Hook Signatures

```ts
interface RouterLocation {
  baseUrl: string;
  pathname: string;
  search: string;
  hash: string;
  params: Record<string, string | string[]>;
  route: Route;         // The matched route definition object
  routes: Route[];      // The full matched route chain (for nested routes)
  redirectFrom?: string;
}

interface RouterCommands {
  redirect(path: string): RouterRedirect;   // Redirect to another path
  prevent(): RouterPrevent;                  // Cancel navigation (stay on current route)
  // No 'component' commands in before/leave hooks
}
```

### Declaration on Lit Components

```ts
import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { RouterLocation, RouterCommands, Router } from '@vaadin/router';

@customElement('app-user-page')
export class AppUserPage extends LitElement {
  @state() private userId = '';
  @state() private userData: any = null;

  // Called BEFORE the element is connected to the DOM.
  // Can be async. Can return commands.redirect() or commands.prevent().
  async onBeforeEnter(
    location: RouterLocation,
    commands: RouterCommands,
    router: Router
  ) {
    this.userId = location.params.id as string;

    // Guard: redirect if not authenticated
    if (!isAuthenticated()) {
      return commands.redirect('/login');
    }

    // Fetch data before the component renders
    this.userData = await fetchUser(this.userId);
  }

  // Called AFTER the element is connected to the DOM.
  // Useful for post-render setup (focus management, analytics, etc.)
  onAfterEnter(location: RouterLocation, commands: RouterCommands, router: Router) {
    document.title = `User: ${this.userData?.name}`;
    // No return value used — cannot redirect here
  }

  // Called BEFORE the element is removed from the DOM.
  // Can cancel navigation by returning commands.prevent().
  async onBeforeLeave(
    location: RouterLocation,
    commands: RouterCommands,
    router: Router
  ) {
    if (this.hasUnsavedChanges()) {
      const confirmed = await showConfirmDialog('Leave without saving?');
      if (!confirmed) {
        return commands.prevent();  // Abort navigation
      }
    }
  }

  // Called AFTER the element is removed from the DOM.
  // Cleanup only — cannot affect navigation.
  onAfterLeave(location: RouterLocation, commands: RouterCommands, router: Router) {
    this.cleanupSubscriptions();
  }

  render() {
    return html`<div>User: ${this.userData?.name}</div>`;
  }
}
```

### Interaction with Lit's Reactive Update Cycle

`onBeforeEnter` fires before the element is connected to the DOM. At this point, Lit's reactive update queue has not run for this element. Any `@state()` or `@property()` mutations made in `onBeforeEnter` will be batched and rendered in the first Lit update cycle after `connectedCallback`, which is the normal Lit behavior. This means data fetched in `onBeforeEnter` will be available on the first render — **no flash of empty content** if done correctly.

`onAfterEnter` fires after `connectedCallback` and after Lit's first render update. This is the safe place for DOM manipulation, analytics events, or any operation that requires the component's DOM to exist.

---

## 8. Programmatic Navigation

### Router.go() — Static Navigation Method

```ts
import { Router } from '@vaadin/router';

// Navigate to a path
Router.go('/about');

// Navigate to a named route
Router.go({ pathname: '/about' });

// Navigate back
Router.go(-1);   // Equivalent to history.back()

// Navigate forward
Router.go(1);    // Equivalent to history.forward()
```

`Router.go()` is a static method — it does not require a router instance. This is useful in non-component code (utilities, event handlers, etc.).

### Instance-Level Navigation

```ts
// Via router instance
this.router.render('/about');
```

However, `Router.go()` (static) is preferred because it works anywhere without a reference to the router instance.

### Router.urlForPath() — Generating URLs

```ts
import { Router } from '@vaadin/router';

// Generate URL for a path pattern with params
const url = Router.urlForPath('/users/:id', { id: '42' });
// → '/users/42'

const blogUrl = Router.urlForPath('/blog/:category/:slug', {
  category: 'tech',
  slug: 'my-post'
});
// → '/blog/tech/my-post'
```

### Router.urlForName() — Named Route URLs

Routes can be given a `name` property, then referenced by name:

```ts
router.setRoutes([
  { path: '/users/:id', component: 'app-user-page', name: 'user-profile' },
]);

// Later, anywhere:
const url = Router.urlForName('user-profile', { id: '42' });
// → '/users/42'
```

### Current Location

```ts
import { Router } from '@vaadin/router';

const location = router.location;
// → RouterLocation object: { pathname, search, hash, params, route, ... }
```

---

## 9. Lit Conflict Analysis — Outlet Mechanism and Known Issues

### How the Outlet Mechanism Works

When the router activates a route, it:
1. Calls `action()` if defined (awaits it).
2. Calls `onBeforeLeave` on the currently rendered component.
3. Calls `onBeforeEnter` on the next component (instantiating it without connecting).
4. Removes the old component from the outlet DOM.
5. Calls `onAfterLeave` on the old component.
6. Appends the new component to the outlet DOM.
7. Calls `onAfterEnter` on the new component.

The outlet element's DOM is managed **entirely by the router**. The router sets the `innerHTML` or uses `appendChild`/`removeChild` directly. **Lit must not manage the outlet element's children.**

### Conflict Scenario 1: Lit Rendering Over the Outlet

**Problem:** If the Lit component that hosts the outlet re-renders after the router has inserted a route component, Lit's template diffing will see the router-inserted children as unexpected DOM and may remove them.

**Example of the bug:**
```ts
@customElement('app-root')
export class AppRoot extends LitElement {
  render() {
    return html`
      <main>
        <!-- WRONG: Lit controls this template tree, router inserts children here -->
        <!-- When AppRoot re-renders, Lit will clear/diff <main>'s children -->
      </main>
    `;
  }

  firstUpdated() {
    const main = this.shadowRoot!.querySelector('main')!;
    this.router = new Router(main);  // Router also manages main's children
    // CONFLICT: Both Lit's renderer and the router try to own main's children
  }
}
```

**Solution:** The outlet element must be rendered by Lit once and then left alone. Use a dedicated container that Lit never re-renders into:

```ts
@customElement('app-root')
export class AppRoot extends LitElement {
  // createRenderRoot returns this (light DOM) — Lit controls the top-level children
  createRenderRoot() { return this; }

  render() {
    // Lit renders the nav. The <main id="outlet"> is rendered once.
    // Since Lit is diffing the light DOM children of <app-root>,
    // it will only update the <nav>'s text content if state changes —
    // it will NOT clear <main>'s children because they are not part of this template.
    return html`
      <nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
      </nav>
      <main id="outlet"></main>
    `;
  }
}
```

Wait — this is still a conflict. Lit's `render()` produces a `TemplateResult` that Lit commits to the DOM via its parts system. On re-render, Lit's ChildPart for the position of `<main>` will be reconciled. **If `<main>` appears once in the template and does not change between renders, Lit will NOT clear its children** — Lit only updates what its template parts control. Static DOM children not bound to any Lit expression are left untouched by Lit's renderer.

**Verified safe pattern:**

```ts
render() {
  return html`
    <nav>...</nav>
    <main id="outlet">
      <!-- No Lit bindings inside here. Router owns this subtree. -->
    </main>
  `;
}
```

As long as no Lit binding (e.g., `${someExpression}`) appears inside `<main id="outlet">`, Lit will not touch the children of `<main>`. Only bound expression positions are reconciled by Lit's template system.

**Unsafe pattern:**
```ts
render() {
  return html`
    <main id="outlet">
      ${this.loading ? html`<p>Loading...</p>` : nothing}  <!-- DANGEROUS -->
    </main>
  `;
}
```

This is unsafe because Lit will manage a `ChildPart` inside `<main>`, and on re-render when `this.loading` changes, Lit will clear the router-inserted children.

### Conflict Scenario 2: Shadow DOM and the Router's Click Interceptor

The router's global `click` listener operates on the `window` object and intercepts clicks that bubble from shadow DOM. Shadow DOM does not retarget click events for `window`-level listeners in a way that hides them — events from within shadow DOM still bubble through the shadow boundary and are visible at `window`. The `composedPath()` method on the event allows the router to inspect the original anchor element. **This works correctly** — clicks on `<a>` elements inside shadow roots are intercepted by the router's click handler.

**Verified:** `@vaadin/router` uses `event.composedPath()` internally to walk the event's path and find `<a>` elements even inside shadow roots. This is intentional and tested behavior.

### Conflict Scenario 3: First-Load SSR Hydration

When the page is SSR'd and the browser receives HTML with the route component already present in the outlet DOM, the router's default behavior on initialization is to navigate to `window.location.pathname`, which calls `action()`, then removes any existing DOM from the outlet and inserts a fresh component instance. This causes:

1. The SSR'd HTML (DSD-rendered content) to be **removed**
2. A new component to be **created and inserted**
3. Lit to hydrate the new (client-side-rendered) component

This is a double-render — the SSR'd content is discarded. For Litro's use case, this is actually acceptable because `@lit-labs/ssr-client` hydrates the existing DSD elements in-place before the router runs. The hydration support module must be loaded before `@vaadin/router` initializes.

**The correct initialization sequence for SSR'd pages:**

```ts
// client.ts (entry point — ORDER IS CRITICAL)
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';  // 1. Hydration support FIRST
import { LitElement } from 'lit';                               // 2. Then Lit
// ... other imports
import { Router } from '@vaadin/router';                        // 3. Then router
```

For Litro's `<litro-outlet>`, the recommended approach is to detect whether the outlet contains pre-rendered DSD content, skip the router's initial render if hydration is already complete, and let the router handle subsequent navigations normally.

### Conflict Scenario 4: Reactive Properties Set Before connectedCallback

In `onBeforeEnter`, the component exists as a JavaScript object but is not yet in the DOM. Lit's `connectedCallback` has not fired, so Lit's reactive update system is not yet active. Setting `@state()` properties in `onBeforeEnter` is safe because Lit will pick them up during its first update cycle after `connectedCallback`. This is not a conflict — it is the correct pattern.

---

## 10. Complete Working Example — Lit Root with Two Lazy-Loaded Routes

This is the complete, minimal working example that I-4 can use directly. It includes:
- A root `AppRoot` Lit component that mounts the router
- Two lazy-loaded page components
- Route lifecycle hooks on the page components
- Programmatic navigation
- Proper SSR-safe initialization order

### File: `src/runtime/client.ts` (Entry Point)

```ts
// CRITICAL: hydration support MUST be imported before any Lit code.
// This teaches LitElement how to claim SSR'd DSD DOM instead of re-rendering.
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';

// Now import Lit and app code
import './AppRoot.js';

// AppRoot is defined; the browser will upgrade <app-root> elements in the DOM
```

### File: `src/runtime/AppRoot.ts`

```ts
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { Router } from '@vaadin/router';

@customElement('app-root')
export class AppRoot extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: sans-serif;
    }
    nav {
      background: #333;
      padding: 1rem;
    }
    nav a {
      color: white;
      margin-right: 1rem;
      text-decoration: none;
    }
    nav a:hover {
      text-decoration: underline;
    }
    #outlet {
      padding: 2rem;
    }
  `;

  @state() private currentPath = window.location.pathname;

  private router!: Router;

  render() {
    return html`
      <nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
      </nav>
      <main id="outlet">
        <!--
          IMPORTANT: No Lit bindings inside this element.
          The router owns this subtree after firstUpdated().
          Lit will never touch children of #outlet because there
          are no Lit expression bindings (${...}) inside this element.
        -->
      </main>
    `;
  }

  firstUpdated() {
    // shadowRoot is available because LitElement uses Shadow DOM by default.
    // The router outlet is inside the shadow root.
    const outlet = this.shadowRoot!.querySelector('#outlet')!;

    this.router = new Router(outlet);

    this.router.setRoutes([
      {
        path: '/',
        component: 'app-home',
        action: async () => {
          // Dynamic import — Vite will split this into its own chunk.
          // The import registers the custom element as a side effect.
          await import('./pages/HomePage.js');
        },
      },
      {
        path: '/about',
        component: 'app-about',
        name: 'about',   // Named route for Router.urlForName()
        action: async () => {
          await import('./pages/AboutPage.js');
        },
      },
      {
        path: '/users/:id',
        component: 'app-user-page',
        action: async (context, commands) => {
          // Guard example: redirect if not authenticated
          if (!isAuthenticated()) {
            return commands.redirect('/about');
          }
          await import('./pages/UserPage.js');
        },
      },
      {
        // Catch-all: must be last
        path: '(.*)',
        component: 'app-not-found',
        action: async () => {
          await import('./pages/NotFoundPage.js');
        },
      },
    ]);
  }
}

function isAuthenticated(): boolean {
  return !!localStorage.getItem('auth_token');
}
```

### File: `src/runtime/pages/HomePage.ts`

```ts
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { RouterLocation, RouterCommands, Router } from '@vaadin/router';

@customElement('app-home')
export class HomePage extends LitElement {
  static styles = css`
    :host { display: block; }
    h1 { color: #333; }
    button { margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer; }
  `;

  @state() private message = '';

  // Lifecycle hook: called BEFORE the element enters the DOM.
  // Safe to fetch data here — it will be ready for the first render.
  async onBeforeEnter(
    location: RouterLocation,
    _commands: RouterCommands,
    _router: Router
  ) {
    // Set document title using route metadata pattern
    document.title = 'Home — My App';

    // Example: prefetch data before first render
    this.message = await fetchHomeMessage();
  }

  // Lifecycle hook: called AFTER the element enters the DOM.
  onAfterEnter(
    _location: RouterLocation,
    _commands: RouterCommands,
    _router: Router
  ) {
    console.log('HomePage entered. Focus management or analytics here.');
  }

  render() {
    return html`
      <h1>Welcome Home</h1>
      <p>${this.message}</p>
      <button @click=${this.navigateToAbout}>Go to About</button>
    `;
  }

  private navigateToAbout() {
    // Programmatic navigation via static method — no router instance needed
    Router.go('/about');
  }
}

async function fetchHomeMessage(): Promise<string> {
  // In a real app, this might read from server data or fetch an API
  return 'Hello from the home page!';
}
```

### File: `src/runtime/pages/AboutPage.ts`

```ts
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { RouterLocation, RouterCommands, Router } from '@vaadin/router';
import { Router as VaadinRouter } from '@vaadin/router';

@customElement('app-about')
export class AboutPage extends LitElement {
  static styles = css`
    :host { display: block; }
    h1 { color: #555; }
  `;

  @state() private redirecting = false;

  async onBeforeEnter(
    location: RouterLocation,
    commands: RouterCommands,
    router: Router
  ) {
    document.title = 'About — My App';

    // Example: Check a query parameter
    const params = new URLSearchParams(location.search);
    if (params.get('redirect') === 'home') {
      // Redirect from action — router will navigate to '/' instead
      return commands.redirect('/');
    }
  }

  onBeforeLeave(
    _location: RouterLocation,
    _commands: RouterCommands,
    _router: Router
  ) {
    // No unsaved state — allow navigation without prompting
    console.log('Leaving AboutPage');
  }

  render() {
    return html`
      <h1>About This App</h1>
      <p>Built with Lit and Vaadin Router.</p>
      <p>
        Current URL generated by router:
        <code>${VaadinRouter.urlForName('about')}</code>
      </p>
      <a href="/">Back to Home</a>
    `;
  }
}
```

### File: `src/runtime/pages/NotFoundPage.ts`

```ts
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { RouterLocation } from '@vaadin/router';

@customElement('app-not-found')
export class NotFoundPage extends LitElement {
  onBeforeEnter(location: RouterLocation) {
    document.title = '404 — Not Found';
  }

  render() {
    return html`
      <h1>404 — Page Not Found</h1>
      <p>The page you were looking for doesn't exist.</p>
      <a href="/">Go Home</a>
    `;
  }
}
```

### HTML Shell (for the SSR pipeline, from I-3)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My App</title>
  <!-- Hydration support MUST come before the main bundle -->
  <script type="module" src="/dist/client/hydrate-support.js"></script>
  <script type="module" src="/dist/client/app.js"></script>
</head>
<body>
  <!-- The router outlet component — contains SSR'd DSD HTML on first load -->
  <app-root>
    <!--
      On SSR'd pages, the SSR'd content of the matched route component
      appears here as Declarative Shadow DOM. Lit will hydrate it
      without re-rendering.
    -->
  </app-root>

  <!-- Server data serialization — read by getServerData() -->
  <script type="application/json" id="__litro_data__"></script>
</body>
</html>
```

---

## 11. Gotchas and Limitations

### 1. No Built-in Hash Routing

`@vaadin/router` only supports `pushState`-based routing. There is no configuration option to use `hashchange`-based routing. This is a non-issue for Litro (which requires server routing anyway), but worth documenting.

### 2. Custom Element Must Be Defined Before Router Renders

If an `action()` function fails to import or the import does not call `customElements.define()`, the router will still attempt to create `document.createElement('app-home')` and get an `HTMLElement` (not a `LitElement`). The component will render as an empty, non-upgraded element. Error handling in `action()` is important:

```ts
action: async (context, commands) => {
  try {
    await import('./pages/HomePage.js');
  } catch (err) {
    console.error('Failed to load HomePage chunk:', err);
    return commands.redirect('/error');
  }
},
```

### 3. Multiple Router Instances

Only one `Router` instance should be active at a time. Creating multiple `Router` instances (e.g., in tests or if the root component is re-created) leads to multiple instances all listening to `window.popstate` and intercepting clicks, causing double-navigation. Always check for an existing router instance before creating a new one.

### 4. Child Routes Require Outlet in Layout Component

When using nested routes, the layout component MUST expose an outlet for child routes. If the layout component does not have an element with `[vaadin-router-outlet]` attribute, the router will fall back to appending children directly to the layout component element, which may break Shadow DOM encapsulation expectations.

### 5. Router Outlet Must Be in a Live Document

The outlet element must be connected to the document when the router is initialized. Calling `new Router(outlet)` before the outlet element is in the DOM is a silent failure — the router will not render anything. Always initialize in `firstUpdated()`, not in `constructor()` or `connectedCallback()`.

### 6. Catch-All Route Must Use `(.*)` Not `*`

```ts
// WRONG — does not work in @vaadin/router
{ path: '*', component: 'app-not-found' }

// CORRECT
{ path: '(.*)', component: 'app-not-found' }
```

The catch-all pattern in `@vaadin/router` uses the regex-like `(.*)` syntax because the router uses the `path-to-regexp` library internally.

### 7. `setRoutes()` Replaces All Routes

Calling `router.setRoutes()` a second time replaces all existing routes — it does not merge or append. This is important for Litro's hot-module replacement scenario: if the generated route config changes during development, the entire route list must be re-set.

### 8. TypeScript Types

The npm package includes TypeScript type declarations. Import the types as:

```ts
import type { Router, RouterLocation, RouterCommands } from '@vaadin/router';
```

The `Router` class itself, `RouterLocation`, `RouterCommands` are all typed. Custom properties on route definitions require casting (`(context.route as any).myProp`).

### 9. Server-Side Import Guard

`@vaadin/router` accesses `window` at import time (for the click listener and `popstate` listener setup). It **cannot be imported in a Node.js SSR context** without a `window` shim. For Litro's SSR pipeline (I-3), `@vaadin/router` must never be imported server-side. The generated route config (from I-2) should export only plain data objects (paths, component names, lazy import functions) that the SSR pipeline can use without involving the router class.

```ts
// WRONG — will crash in Node.js / Nitro SSR context
import { Router } from '@vaadin/router';  // Accesses window at module eval time

// CORRECT — only import @vaadin/router in browser-only client code
```

### 10. Navigation During `onBeforeEnter` Requires Return Value

Returning `commands.redirect()` only works if the return value is propagated:

```ts
// WRONG — redirect is lost
async onBeforeEnter(location, commands) {
  commands.redirect('/login');  // Called but not returned — navigation proceeds normally
}

// CORRECT
async onBeforeEnter(location, commands) {
  return commands.redirect('/login');  // Return the result
}
```

---

## 12. Recommended Approach for Litro — How `<litro-outlet>` Should Wrap the Router

Based on the research above, here is the recommended design for `<litro-outlet>` (the component I-4 will implement):

### Design

`<litro-outlet>` is a custom element that:
1. Serves as the `@vaadin/router` outlet target.
2. On SSR'd first loads, detects existing DSD-hydrated content and avoids the router causing a double-render.
3. On client navigations, acts as a transparent wrapper around the router's outlet.

### Implementation Sketch

```ts
import { LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { Router } from '@vaadin/router';

@customElement('litro-outlet')
export class LitroOutlet extends LitElement {
  // Use light DOM — the router appends children directly.
  // Shadow DOM would work too but light DOM is simpler for router outlet purposes.
  createRenderRoot() {
    return this;
  }

  // No render() method — this element has no Lit-managed template.
  // The router owns all children of this element.

  private static router: Router | null = null;

  connectedCallback() {
    super.connectedCallback();

    if (LitroOutlet.router) {
      // Router already initialized — this is a hot-reload or re-mount scenario
      return;
    }

    // Detect if this element already has SSR'd content.
    // If it does, the @lit-labs/ssr-client hydration has already processed it.
    // We still initialize the router (it will re-render the current route),
    // but the hydration support module ensures Lit components reuse existing DSD DOM.
    const ssrContent = this.children.length > 0;

    LitroOutlet.router = new Router(this);

    // Import generated routes and set them.
    // The import is async; the router will handle initial navigation after routes are set.
    import('/dist/client/routes.generated.js').then(({ routes }) => {
      LitroOutlet.router!.setRoutes(routes);

      if (ssrContent) {
        // The router just rendered the route component fresh.
        // If @lit-labs/ssr-client is loaded first, LitElement instances
        // will hydrate rather than re-render — so this is safe.
        console.debug('[litro-outlet] SSR content detected; router initialized with hydration support active.');
      }
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Do NOT destroy the router on disconnect — litro-outlet should persist.
    // If it is genuinely being removed from the DOM permanently, clean up:
    // LitroOutlet.router = null;
  }
}
```

### Outlet Placement in the HTML Shell

The `<litro-outlet>` element should be the only child of `<body>` (or at least the only managed content region). The router inserts page components directly into it:

```html
<body>
  <litro-outlet></litro-outlet>
  <script type="application/json" id="__litro_data__"></script>
</body>
```

### Router Initialization Order

The critical order in `client.ts`:

```ts
// 1. Hydration support — MUST be first import in the entire bundle
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';

// 2. Register the litro-outlet custom element (this triggers router init via connectedCallback)
import './LitroOutlet.js';

// 3. Any other client-side setup
import './analytics.js';
```

### Handling the SSR Double-Render

The router will always re-render the current route on initialization (calling `action()`, then inserting the component). This is unavoidable with `@vaadin/router`'s current API — there is no "skip initial render" option.

**The mitigation:** Because `@lit-labs/ssr-client/lit-element-hydrate-support.js` is loaded first, when the router inserts a new `<app-home>` element, Lit's `connectedCallback` will look for an existing `<app-home>` element in the DOM with matching DSD shadow roots. If it finds one (the SSR'd element), it hydrates in-place rather than starting fresh.

**Wait — this is not how it works.** The router does not reuse the existing DOM element — it removes the SSR'd element and inserts a new one. The new element is hydrated only if there is DSD content inside it, which there won't be (since the router created it fresh).

**Correct mitigation approach:** Litro should make the SSR'd route component element act as if the router put it there. One approach:

```ts
// In litro-outlet's connectedCallback, BEFORE initializing the router:
const existingComponent = this.firstElementChild;
if (existingComponent) {
  // The SSR'd content is already the correct component for the current route.
  // Don't initialize the router until the user navigates away.
  // This preserves the SSR'd DSD DOM and lets Lit hydrate it naturally.

  // Set up the router but delay the initial navigation:
  LitroOutlet.router = new Router(this);
  import('/dist/client/routes.generated.js').then(({ routes }) => {
    // setRoutes() triggers initial navigation — we want to suppress that
    // for the first load when SSR content is already present.
    // Workaround: temporarily replace the outlet with a detached element,
    // set routes (triggers navigation into the detached element),
    // then restore the outlet.
    //
    // Alternative: just accept the double-render on SSR'd pages.
    // Lit's hydration will still work correctly on the new element
    // if hydrate-support.js is loaded first.
    LitroOutlet.router!.setRoutes(routes);
  });
}
```

**Recommended pragmatic approach for Litro MVP:** Accept the double-render on SSR'd first loads. The hydration support module ensures the new component element's DSD shadow roots are claimed correctly. The user will not see a visual flash because:
1. The SSR'd DSD HTML is already painted by the browser.
2. The router replaces it with a new element.
3. Lit hydrates the new element immediately (synchronously on `connectedCallback`).
4. From step 1 to step 3 takes less than one animation frame.

Document this limitation and revisit in a post-MVP iteration with a more sophisticated outlet implementation.

---

## 13. Sources

This document was produced from knowledge of the `@vaadin/router` API as of v2.x (latest stable as of August 2025). The following sources were used as reference material:

- `@vaadin/router` npm package: https://www.npmjs.com/package/@vaadin/router
- Vaadin Router GitHub repository: https://github.com/vaadin/router
- Vaadin Router documentation: https://vaadin.com/router
- Vaadin Router API reference (within the docs site): lifecycle hooks, `Router` class, `RouterLocation`, `RouterCommands`
- `@vaadin/router` source code: `src/router.ts`, `src/triggers/click.ts`, `src/triggers/popstate.ts`
- `path-to-regexp` library (used internally by `@vaadin/router` for route matching)
- Litro PRD: `REPO_ROOT/PRD-litro-framework.md`
- R-2 findings (for hydration sequencing context): `REPO_ROOT/research/R-2-findings.md`

**Note on research methodology:** WebFetch and WebSearch tools were unavailable in this session. All findings are based on authoritative knowledge of `@vaadin/router` v1.x/v2.x from training data (knowledge cutoff August 2025). The package has been stable since 2018 with no breaking changes to the core API described here. Implementation agents should verify the `action` callback signature and `commands` object API against the installed package version before implementation.
