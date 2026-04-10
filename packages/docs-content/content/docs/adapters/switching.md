---
title: "Switching Adapters"
description: "Step-by-step guide for migrating an existing Litro project from one framework adapter to another."
date: 2026-04-10
---

# Switching Adapters

This guide walks through migrating an existing Litro project from one adapter to another. The adapter is a per-project choice — you pick one framework for the entire project.

## What Changes

When switching adapters, you need to update:

1. **`app.ts`** — different hydration/runtime imports
2. **Page components** — different base class, template syntax, and registration
3. **`nitro.config.ts`** — different externals and esbuild settings
4. **`package.json`** — different framework dependencies

What does **not** change:

- `server/api/` handlers
- `definePageData()` exports
- `routes.generated.ts` (auto-generated)
- `litro.recipe.json` / content directory
- Build and deploy workflow (`litro build`, `litro dev`, `litro preview`)

## Lit to FAST

### 1. Update dependencies

```bash
pnpm remove lit @lit-labs/ssr @lit-labs/ssr-client
pnpm add @microsoft/fast-element @microsoft/fast-ssr
```

### 2. Update `app.ts`

```ts
// Before (Lit)
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import '@beatzball/litro/runtime/LitroOutlet.js';
import '@beatzball/litro/runtime/LitroLink.js';

// After (FAST)
import '@microsoft/fast-element/install-element-hydration.js';
import '@beatzball/litro/adapter/fast/runtime';
```

### 3. Convert page components

```ts
// Before (Lit)
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';

@customElement('page-home')
export class HomePage extends LitroPage {
  render() {
    const data = this.serverData as { message: string } | null;
    return html`<h1>${data?.message ?? 'Loading...'}</h1>`;
  }
}

// After (FAST)
import { observable, html, css } from '@microsoft/fast-element';
import { LitroPage } from '@beatzball/litro/adapter/fast/page';

export class HomePage extends LitroPage {
  @observable override serverData: { message: string } | null = null;
}

HomePage.define({
  name: 'page-home',
  template: html<HomePage>`
    <h1>${x => x.serverData?.message ?? 'Loading...'}</h1>
  `,
});
```

### 4. Update `nitro.config.ts`

Remove Lit-specific externals and esbuild settings:

```ts
// Remove these Lit-specific settings:
externals: { inline: ['@lit-labs/ssr', '@lit-labs/ssr-client'] },
esbuild: {
  options: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  },
},
```

FAST packages stay external by default (no `externals` config needed).

## Lit to Elena

### 1. Update dependencies

```bash
pnpm remove lit @lit-labs/ssr @lit-labs/ssr-client
pnpm add @elenajs/core
```

### 2. Update `app.ts`

```ts
// Before (Lit)
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import '@beatzball/litro/runtime/LitroOutlet.js';
import '@beatzball/litro/runtime/LitroLink.js';

// After (Elena)
import '@beatzball/litro/adapter/elena/runtime';
```

### 3. Convert page components

```ts
// Before (Lit)
import { html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';

@customElement('page-home')
export class HomePage extends LitroPage {
  static styles = css`:host { display: block; }`;

  render() {
    const data = this.serverData as { message: string } | null;
    return html`<h1>${data?.message ?? 'Loading...'}</h1>`;
  }
}

// After (Elena)
import { html } from '@elenajs/core';
import { LitroPage } from '@beatzball/litro/adapter/elena/page';

export class HomePage extends LitroPage {
  static override tagName = 'page-home';

  render() {
    const data = this.serverData as { message: string } | null;
    return html`<h1>${data?.message ?? 'Loading...'}</h1>`;
  }
}

HomePage.define();
```

### 4. Convert styles to `@scope`

Shadow DOM styles become `@scope` rules in your global stylesheet:

```css
/* Before: inside the component (Shadow DOM) */
static styles = css`
  :host { display: block; padding: 2rem; }
  h1 { color: #1a1a2e; }
`;

/* After: in a global CSS file */
@scope (page-home) {
  :scope { display: block; padding: 2rem; }
  h1 { color: #1a1a2e; }
}
```

### 5. Update `nitro.config.ts`

Remove all Lit-specific settings (externals, esbuild decorator config). Elena has no special Nitro requirements.

## FAST to Elena

Follow the same pattern as Lit to Elena, but replace FAST-specific code:

- `@microsoft/fast-element` imports become `@elenajs/core`
- `ComponentClass.define({ name, template, styles })` becomes `static tagName` + `render()` method + `.define()`
- Template bindings change from `${x => x.prop}` to `${this.prop}`
- Remove `@observable` decorators, use Elena's static `props`

## Common Pitfalls

- **Elena props must be lowercase** — rename any camelCase properties when migrating to Elena
- **Elena escapes interpolations** — if you were using `unsafeHTML()` in Lit, use Elena's `unsafeHTML()` from `@elenajs/core`
- **FAST `@observable` and jiti** — if your Lit pages used `@property` with SSR, switch to `Observable.defineProperty()` in FAST (jiti cannot process `@observable`)
- **`definePageData` stays unchanged** — it's adapter-agnostic, don't touch it
- **`fetchData()` stays unchanged** — same method signature across all adapters
