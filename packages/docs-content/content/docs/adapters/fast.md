---
title: "FAST Element Adapter"
description: "Build Litro pages with Microsoft FAST Element 2 — Shadow DOM, observable-based reactivity, and @microsoft/fast-ssr for Declarative Shadow DOM SSR."
date: 2026-04-10
---

# FAST Element Adapter

The FAST adapter lets you write pages using [Microsoft FAST Element 2](https://www.fast.design/), with full SSR support via `@microsoft/fast-ssr`.

## Setup

```bash
pnpm create @beatzball/litro my-app --adapter fast
```

The client entry (`app.ts`) must import hydration support **first**:

```ts
// app.ts
import '@microsoft/fast-element/install-element-hydration.js'; // MUST be first
import '@beatzball/litro/adapter/fast/runtime';
import { routes } from './routes.generated.js';

const outlet = document.querySelector('litro-outlet');
if (outlet) outlet.routes = routes;
```

## Writing Pages

Pages extend `LitroPage` from the FAST adapter path. Use FAST's `html` template, `css`, and `observable` for reactive properties.

```ts
// pages/index.ts
import { FASTElement, observable, html, css } from '@microsoft/fast-element';
import { LitroPage } from '@beatzball/litro/adapter/fast/page';
import { definePageData } from '@beatzball/litro/runtime/page-data.js';

export const pageData = definePageData(async (event) => {
  return { message: 'Hello from the server (FAST)!' };
});

export class HomePage extends LitroPage {
  @observable override serverData: { message: string } | null = null;

  override async fetchData() {
    const res = await fetch('/api/hello');
    return res.json();
  }
}

HomePage.define({
  name: 'page-home',
  template: html<HomePage>`
    <h1>Welcome to Litro (FAST)</h1>
    <p>${x => x.serverData?.message ?? 'Loading...'}</p>
  `,
  styles: css`
    :host { display: block; padding: 2rem; }
    h1 { color: #1a1a2e; }
  `,
});

export default HomePage;
```

## Key Differences from Lit

- **Component definition** — FAST uses `ComponentClass.define({ name, template, styles })` instead of the `@customElement` decorator
- **Templates** — FAST's `html` tag uses arrow function bindings (`${x => x.prop}`) instead of Lit's expression interpolation
- **Reactivity** — `@observable` instead of `@property()` / `@state()`
- **No decorators required for SSR** — FAST's `Observable.defineProperty()` works without decorators, which avoids jiti/esbuild compatibility issues

## SSR

FAST SSR uses `@microsoft/fast-ssr` to render components as Declarative Shadow DOM, similar to Lit. The adapter's manifest preamble installs a DOM shim and initialises the SSR template renderer before any page modules load.

The HTML output includes a DSD polyfill inline script, same as the Lit adapter.

### Server Data Injection

Unlike Lit (which uses property bindings during SSR), FAST SSR passes `serverData` via `globalThis.__litro_ssr_page_data__`. The FAST `LitroPage` base class reads this in `connectedCallback` during SSR. This is safe because Node.js SSR is single-threaded and sequential.

## Styles

Same as Lit — Shadow DOM scoping via `adoptedStyleSheets`. Global CSS cannot pierce the shadow boundary.

## Nitro Configuration

The FAST adapter:
- Keeps `@microsoft/fast-*` packages **external** (not inlined) to avoid dual-copy SSR issues
- Does not modify esbuild settings (FAST does not use legacy decorators)

## Limitations

- **No `@observable` with jiti** — Nitro's jiti loader cannot process `@observable` decorators. Use `Observable.defineProperty()` for properties that need to work during SSR. Client-side `@observable` works fine.
- **FAST packages must stay external** — inlining them into the server bundle creates duplicate copies of `@microsoft/fast-element`, breaking SSR's element registry.
- **ESM top-level await** — does not block sibling modules. The adapter uses synchronous code for DOM shims instead.

## Further Reading

- [FAST Element documentation](https://www.fast.design/)
- [Adapter overview](/docs/adapters/overview)
