---
title: Server-Side Rendering
description: Litro uses @lit-labs/ssr with Declarative Shadow DOM for spec-compliant streaming SSR.
date: 2026-01-01
---

# Server-Side Rendering

Litro renders all pages on the server before sending HTML to the browser. The SSR strategy depends on which [adapter](/docs/adapters/overview) your project uses:

- **Lit / FAST** — renders components as **Declarative Shadow DOM** (DSD) via `@lit-labs/ssr` or `@microsoft/fast-ssr`. DSD is a browser-native way to express shadow roots in HTML — no JavaScript required to parse the initial structure.
- **Elena** — renders components as plain **light DOM** HTML. No shadow roots, no DSD wrappers. Components upgrade in place via progressive enhancement.

## How It Works (Lit / FAST)

1. The page handler imports the page component module (compiled into the server bundle by Rollup).
2. The adapter's SSR engine renders the component to an async iterable of HTML strings.
3. The HTML is streamed in three parts: shell head → DSD output → shell foot.
4. The browser parses the DSD HTML and constructs the shadow trees natively.
5. The hydration module patches the component to attach event listeners without re-rendering.

## How It Works (Elena)

1. The page handler imports the page component module.
2. The Elena adapter instantiates the component, calls `render()`, and stringifies the result.
3. Nested custom elements are recursively expanded.
4. The HTML is streamed as plain markup — no shadow roots, no DSD wrappers.
5. When JavaScript loads, components upgrade in place (progressive enhancement, no hydration step).

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
