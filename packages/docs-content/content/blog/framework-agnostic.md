---
title: "Litro Goes Framework-Agnostic"
description: "Litro now supports three web component frameworks — Lit, FAST Element, and Elena — through a pluggable adapter system. Here's why we built it, how it works, and what it means for your projects."
date: 2026-04-10
tags:
  - architecture
  - adapters
  - web-components
---

# Litro Goes Framework-Agnostic

When we started Litro, we made a deliberate choice to build on Lit. It was (and remains) the most mature web component library, with excellent SSR support via `@lit-labs/ssr` and a decorator-based API that feels familiar to anyone coming from React or Angular.

But as Litro grew, a tension emerged: we were building a framework that champions **web standards** and **component portability** — yet we were locked to a single component library. If the whole point of web components is that they work everywhere, shouldn't Litro work with any web component framework?

Today, Litro ships with three framework adapters: **Lit**, **FAST Element**, and **Elena**. Same routing, same data layer, same deployment targets — different component models.

## Why Not Just Lit?

Three reasons pushed us toward a multi-framework architecture:

**1. Different projects have different needs.** A documentation site benefits from Elena's light DOM rendering — global CSS works, no shadow boundaries, smaller HTML payloads. An enterprise app might prefer FAST Element for Fluent UI integration. A component library author wants Lit's mature ecosystem.

**2. Web components are a standard, not a library.** `customElements.define()` is a browser API. Shadow DOM is a browser feature. Any framework that produces standards-compliant custom elements should work with Litro's infrastructure.

**3. The coupling was shallow.** When we audited the codebase, the framework-specific code was concentrated in two clusters: the three client runtime components (Outlet, Link, Page) and the SSR rendering call. The router, page scanner, data layer, content system, CLI, and build pipeline were already framework-agnostic. Extracting the Lit-specific code behind an interface was a refactor, not a rewrite.

## The Adapter Interface

Each adapter implements `FrameworkAdapter` — a contract between Litro's infrastructure and a concrete web component framework:

```ts
interface FrameworkAdapter {
  name: 'lit' | 'fast' | 'elena';
  renderPage(tag: string, serverData: unknown): AsyncIterable<string>;
  getHeadScripts(options): string;
  needsDSDPolyfill: boolean;
  clientEntryModule: string;
  vitePlugins(): VitePlugin[];
  nitroConfig(): Partial<NitroConfig>;
  manifestPreamble?(): string;
  manifestPostamble?(pageModuleVars: string[]): string;
}
```

The adapter is selected once per project — not per page. This keeps the build pipeline simple and the mental model clear: your project uses Lit, or FAST, or Elena.

## The Same Page, Three Ways

Here's a minimal data-fetching page in each framework:

### Lit

```ts
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';

export const pageData = definePageData(async () => ({
  message: 'Hello from the server!',
}));

@customElement('page-home')
export class HomePage extends LitroPage {
  render() {
    const data = this.serverData as { message: string } | null;
    return html`<h1>${data?.message ?? 'Loading...'}</h1>`;
  }
}
export default HomePage;
```

### FAST Element

```ts
import { observable, html } from '@microsoft/fast-element';
import { LitroPage } from '@beatzball/litro/adapter/fast/page';
import { definePageData } from '@beatzball/litro/runtime/page-data.js';

export const pageData = definePageData(async () => ({
  message: 'Hello from the server!',
}));

export class HomePage extends LitroPage {
  @observable override serverData: { message: string } | null = null;
}
HomePage.define({
  name: 'page-home',
  template: html<HomePage>`
    <h1>${x => x.serverData?.message ?? 'Loading...'}</h1>
  `,
});
export default HomePage;
```

### Elena

```ts
import { html } from '@elenajs/core';
import { LitroPage } from '@beatzball/litro/adapter/elena/page';
import { definePageData } from '@beatzball/litro/runtime/page-data.js';

export const pageData = definePageData(async () => ({
  message: 'Hello from the server!',
}));

export class HomePage extends LitroPage {
  static override tagName = 'page-home';
  render() {
    const data = this.serverData as { message: string } | null;
    return html`<h1>${data?.message ?? 'Loading...'}</h1>`;
  }
}
HomePage.define();
export default HomePage;
```

The `definePageData()` export is identical in all three. The router, content layer, and API routes are untouched. Only the component authoring changes.

## Shadow DOM vs Light DOM

The most interesting architectural difference is between Lit/FAST (Shadow DOM) and Elena (light DOM).

**Shadow DOM** (Lit, FAST) gives you hard style encapsulation — component styles can't leak out, global styles can't leak in. SSR produces Declarative Shadow DOM markup (`<template shadowrootmode="open">`), and the client hydrates by attaching to existing shadow trees.

**Light DOM** (Elena) renders directly into the document. Global CSS reaches component internals. SSR produces plain HTML — no DSD wrappers, no hydration step. Components upgrade in place via progressive enhancement when JavaScript loads.

For content-heavy sites (docs, blogs, marketing pages), light DOM is compelling: smaller HTML payloads, no shadow boundary complications for styling, and graceful degradation without JavaScript. For complex interactive applications, Shadow DOM's encapsulation prevents style collisions at scale.

## What We Learned Building This

A few lessons from implementing three framework adapters:

- **FAST packages must stay external.** Inlining `@microsoft/fast-element` into the Nitro server bundle creates duplicate copies, breaking SSR's element registry. Lit's packages can be inlined safely.
- **ESM top-level `await` doesn't block siblings.** We initially tried `await import()` for DOM shims — it doesn't work because sibling imports evaluate concurrently. Synchronous code is required for SSR initialization.
- **Rollup tree-shakes bare side-effect imports.** `import '@microsoft/fast-ssr/install-dom-shim.js'` gets dropped if the package lacks `"sideEffects"` in `package.json`. Using `import * as _shim` with a globalThis assignment prevents this.
- **Elena's SSR is surprisingly simple.** No SSR library needed — instantiate the component class, call `render()`, stringify the result. Nested custom elements are recursively expanded using a lightweight registry shim.

## Getting Started

Choose your adapter when creating a new project:

```bash
pnpm create @beatzball/litro my-app --adapter lit    # default
pnpm create @beatzball/litro my-app --adapter fast
pnpm create @beatzball/litro my-app --adapter elena
```

Or omit `--adapter` for the interactive prompt.

Existing Lit projects continue to work with zero changes — `lit` is the default adapter, and omitting the `adapter` field is equivalent to `--adapter lit`.

Read the full [adapter documentation](/docs/adapters/overview) for setup guides, code examples, and migration instructions.
