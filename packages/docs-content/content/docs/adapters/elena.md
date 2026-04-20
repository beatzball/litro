---
title: "ElenaJS Adapter"
description: "Build Litro pages with ElenaJS — light DOM rendering, no Shadow DOM, no hydration, progressive enhancement with @scope CSS encapsulation."
date: 2026-04-10
---

# ElenaJS Adapter

The Elena adapter uses [Elena](https://elenajs.com/) for **light DOM** rendering. Components render directly into the document — no Shadow DOM wrapper, no Declarative Shadow DOM, no hydration step. CSS encapsulation uses the `@scope` CSS at-rule instead.

## Setup

```bash
pnpm create @beatzball/litro my-app --adapter elena
```

The client entry (`app.ts`) is the simplest of all three adapters — no hydration script needed:

```ts
// app.ts
import '@beatzball/litro/adapter/elena/runtime';
import { routes } from './routes.generated.js';

const outlet = document.querySelector('litro-outlet');
if (outlet) outlet.routes = routes;
```

## Writing Pages

Pages extend `LitroPage` from the Elena adapter path. Use Elena's `html` template tag and static `props` for reactive properties.

```ts
// pages/index.ts
import { html } from '@elenajs/core';
import { LitroPage } from '@beatzball/litro/adapter/elena/page';
import { definePageData } from '@beatzball/litro/runtime/page-data.js';

export const pageData = definePageData(async (event) => {
  return { message: 'Hello from the server (Elena)!' };
});

export class HomePage extends LitroPage {
  static override tagName = 'page-home';

  override async fetchData() {
    const res = await fetch('/api/hello');
    return res.json();
  }

  render() {
    const data = this.serverData as { message: string } | null;
    return html`
      <h1>Welcome to Litro (Elena)</h1>
      <p>${data?.message ?? 'Loading...'}</p>
    `;
  }
}

HomePage.define();

export default HomePage;
```

## Key Differences from Lit and FAST

- **Light DOM** — component output renders directly into the document, not inside a shadow root
- **No hydration** — components upgrade in place via progressive enhancement when JavaScript loads
- **`@scope` CSS** — style encapsulation uses the CSS `@scope` at-rule instead of Shadow DOM
- **`static tagName`** — component tag is declared as a static property, not via a decorator
- **`.define()`** — call `ComponentClass.define()` to register (no `@customElement` decorator)
- **Props must be lowercase** — HTML parsers lowercase attributes, so camelCase prop names break attribute binding

## SSR

Elena SSR works fundamentally differently from Lit and FAST:

- **No `@lit-labs/ssr` or `@microsoft/fast-ssr`** — Litro's Elena adapter renders components directly: instantiate, call `render()`, stringify the `TemplateResult`
- **No Declarative Shadow DOM** — output is plain HTML inside custom element tags
- **No DSD polyfill** — not needed since there are no shadow roots
- **Nested component expansion** — child custom elements in render output are recursively expanded
- **Smaller payloads** — no `<template shadowrootmode="open">` wrappers

The SSR output for a page looks like:

```html
<page-home hydrated>
  <h1>Welcome to Litro (Elena)</h1>
  <p>Hello from the server (Elena)!</p>
</page-home>
```

Compare with Lit/FAST DSD output:

```html
<page-home>
  <template shadowrootmode="open">
    <style>:host { display: block; }</style>
    <h1>Welcome to Litro</h1>
    <p>Hello from the server!</p>
  </template>
</page-home>
```

## Styles with `@scope`

Since Elena renders into the light DOM, styles are not automatically scoped by the browser. Use the CSS `@scope` at-rule for encapsulation:

```css
@scope (page-home) {
  :scope {
    display: block;
    padding: 2rem;
  }
  h1 { color: #1a1a2e; }
  p { line-height: 1.6; }
}
```

`@scope` is supported in Chrome 118+, Edge 118+, and Safari 17.4+. For older browsers, the styles apply globally (graceful degradation).

## Nitro Configuration

The Elena adapter has minimal configuration:
- No packages need inlining (Elena is ~2.9 KB, no Node-specific issues)
- No decorator settings needed (Elena uses static props, not decorators)
- The manifest preamble installs an `HTMLElement` shim and `customElements` registry for Node.js SSR

## SSR Details

### Internal Registry

Elena's `@elenajs/ssr` uses its own internal component registry, separate from the browser's `customElements` registry. Components must be explicitly registered by calling `.define()` — the Litro page scanner handles this automatically for page components, but if you create non-page custom elements used inside page templates, they must also call `.define()` or they will render as empty tags during SSR.

### Wrapper Components and Attributes

If you build a wrapper component that renders a child custom element in its `render()` method, you must pass relevant attributes through to the child element in the template. During SSR, Elena expands child custom elements by instantiating them with the attributes present in the parent's render output. Attributes not passed in the template will be missing during SSR, even if they're set programmatically in `connectedCallback`.

```ts
// Correct — attributes passed in render()
render() {
  return html`<child-element title="${this.title}" count="${this.count}"></child-element>`;
}

// Incorrect — child renders without title/count during SSR
connectedCallback() {
  super.connectedCallback();
  this.querySelector('child-element')?.setAttribute('title', this.title);
}
```

## Limitations

- **No Shadow DOM** — global CSS affects component internals. This is a feature for content sites but may be unwanted for complex widget libraries.
- **Props must be lowercase** — `myProp` in HTML becomes `myprop` after parsing. Use `myprop` in the `props` declaration.
- **`html` tag escapes interpolations** — use `unsafeHTML()` from `@elenajs/core` when you need to render raw HTML (e.g. Markdown content).
- **Wrapper components and `innerHTML`** — components that capture `innerHTML` in `connectedCallback` must fall back to `this.innerHTML` in `render()` for SSR compatibility.
- **SSR registry is separate** — see [SSR Details](#ssr-details) above. Non-page components need `.define()` to render during SSR.
- **`@scope` browser support** — older browsers see unscoped styles (functional but not encapsulated).

## Further Reading

- [Elena documentation](https://elenajs.com/)
- [Adapter overview](/docs/adapters/overview)
