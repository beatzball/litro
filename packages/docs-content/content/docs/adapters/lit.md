---
title: "Lit Adapter"
description: "The default Litro adapter. Build pages with LitElement, Shadow DOM, and @lit-labs/ssr for streaming Declarative Shadow DOM SSR."
date: 2026-04-10
---

# Lit Adapter

Lit is the default adapter. If you don't pass `--adapter` when creating a project, you get Lit.

## Setup

```bash
pnpm create @beatzball/litro my-app --adapter lit
```

The client entry (`app.ts`) must import hydration support **first**:

```ts
// app.ts
import '@lit-labs/ssr-client/lit-element-hydrate-support.js'; // MUST be first
import '@beatzball/litro/runtime/LitroOutlet.js';
import '@beatzball/litro/runtime/LitroLink.js';
import { routes } from './routes.generated.js';

const outlet = document.querySelector('litro-outlet');
if (outlet) outlet.routes = routes;
```

## Writing Pages

Pages are `LitElement` subclasses exported as the default export. The filename determines the route.

```ts
// pages/index.ts
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';

export const pageData = definePageData(async (event) => {
  return { message: 'Hello from the server!' };
});

@customElement('page-home')
export class HomePage extends LitroPage {
  override async fetchData() {
    const res = await fetch('/api/hello');
    return res.json();
  }

  render() {
    const data = this.serverData as { message: string } | null;
    return html`<h1>${data?.message ?? 'Loading...'}</h1>`;
  }
}

export default HomePage;
```

## SSR

Lit SSR uses `@lit-labs/ssr` to render components as **Declarative Shadow DOM** (DSD). The server streams `<template shadowrootmode="open">` elements that the browser parses natively. On the client, `@lit-labs/ssr-client` hydrates the existing shadow trees — attaching event listeners without re-rendering.

The HTML output includes a DSD polyfill inline script for browsers that don't yet support `shadowrootmode`.

## Styles

Lit components use Shadow DOM for style encapsulation. Styles defined via `static styles` or `css` tagged templates are scoped to the component — they don't leak out and global CSS doesn't leak in.

```ts
import { css } from 'lit';

@customElement('page-about')
export class AboutPage extends LitElement {
  static styles = css`
    :host { display: block; padding: 2rem; }
    h1 { color: #1a1a2e; }
  `;
  // ...
}
```

## Nitro Configuration

The Lit adapter configures Nitro to:
- Inline `@lit-labs/ssr` and `@lit-labs/ssr-client` for edge deployment compatibility
- Set `experimentalDecorators: true` for esbuild (Lit's decorators use the legacy TC39 proposal)

These are handled automatically when using `--adapter lit`.

## Limitations

- **Shadow DOM boundary** — global CSS cannot style component internals. Use CSS custom properties or `::part()` for cross-boundary styling.
- **Decorator compatibility** — use `static override properties = { ... }` instead of `@property()` on plain fields to avoid TC39 Stage 3 decorator issues with Vite/esbuild. See the [Decisions log](/docs/contributing) for details.
- **SSR safety** — avoid accessing `window`, `document`, or `localStorage` at module evaluation time. Guard browser-only code in lifecycle methods.

## Further Reading

- [Lit documentation](https://lit.dev/docs/)
- [Lit SSR guide](https://lit.dev/docs/ssr/overview/)
- [Adapter overview](/docs/adapters/overview)
