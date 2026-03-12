---
title: Server-Side Rendering
description: Litro uses @lit-labs/ssr with Declarative Shadow DOM for spec-compliant streaming SSR.
date: 2026-01-01
---

# Server-Side Rendering

Litro uses `@lit-labs/ssr` to render Lit components on the server using **Declarative Shadow DOM** (DSD). DSD is a browser-native way to express shadow roots in HTML — no JavaScript required to parse the initial structure.

## How It Works

1. The page handler imports the page component module (compiled into the server bundle by Rollup).
2. `@lit-labs/ssr` renders the component to an async iterable of HTML strings.
3. The HTML is streamed in three parts: shell head → DSD output → shell foot.
4. The browser parses the DSD HTML and constructs the shadow trees natively.
5. `@lit-labs/ssr-client` hydrates the component, attaching event listeners and making it interactive.

## Streaming

The SSR output streams directly to the browser as it's generated. This means the browser can start parsing and rendering the top of the page before the server finishes rendering the bottom.

## Hydration

Add `@lit-labs/ssr-client/lit-element-hydrate-support.js` as the **first import** in your `app.ts`. This patches `LitElement` to support DSD hydration:

```ts
// app.ts
import '@lit-labs/ssr-client/lit-element-hydrate-support.js'; // MUST be first
import '@beatzball/litro/runtime/LitroOutlet.js';
// ...
```

## SSR Safety

Components that access `window`, `document`, or `localStorage` at **module evaluation time** will throw during SSR. Guard such access:

```ts
// Safe — only runs in the browser
override firstUpdated() {
  if (typeof localStorage !== 'undefined') {
    this._theme = localStorage.getItem('theme') ?? 'light';
  }
}
```

For components that can't be made SSR-safe, use `<litro-client-only>` to skip SSR entirely.
