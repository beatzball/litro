---
title: Why We Built Litro — The Case for Standards-Based Development
description: React and Vue solved real problems in 2013. But the web platform has caught up. Here's why we think web components, URLPattern, and Declarative Shadow DOM are the right foundation for a modern fullstack framework.
date: 2026-03-21
tags:
  - blog
  - announcement
  - web-components
---

# Why We Built Litro — The Case for Standards-Based Development

In 2013, React introduced a component model that reshaped how developers think about UI. Virtual DOM, JSX, one-way data flow — these were genuinely good ideas for the moment. The browser didn't offer much, and frameworks filled the gap.

Twelve years later, browsers are different. The web platform has shipped component primitives, native routing APIs, and server-rendering specs that don't require a framework to use. We built Litro because we think it's time for the server framework to catch up.

## What the Web Platform Actually Offers Now

Three APIs define what's changed:

**Custom Elements** — define reusable, encapsulated HTML elements with lifecycle hooks. Supported in all modern browsers since 2020 (Chrome since 2016, Safari since 2017, Firefox since 2018, Chromium Edge since 2020). Your components are standard HTML elements: they work in any framework, in vanilla HTML, in any environment that renders HTML and runs JavaScript.

**Shadow DOM and Declarative Shadow DOM** — true style encapsulation without CSS Modules hacks. And with [Declarative Shadow DOM](https://developer.chrome.com/docs/css-ui/declarative-shadow-dom) (Baseline since 2023), the server can render shadow DOM directly into HTML — crawlers and browsers get the content before JavaScript runs.

**URLPattern** — a native browser API for matching URL patterns, including named groups and wildcards. It's what `@beatzball/litro-router` is built on. No regex string parsing, no custom path-to-regexp, no external dependency.

None of these existed in a usable, cross-browser form when React, Vue, and Angular were being designed. Frameworks built their own component systems, their own scoping, their own routing because they had to.

## Why We Like Lit

[Lit](https://lit.dev) is the Polymer team's distillation of a decade of web component experience into something minimal and practical. It adds two things to the native custom elements API that are genuinely worth having:

1. **Reactive properties** — declarative re-rendering when data changes, powered by an efficient update lifecycle, without a virtual DOM
2. **Tagged template literals** — `html\`<div>${value}</div>\`` syntax that's valid JavaScript, has good TypeScript support, and can be statically analyzed by the SSR renderer

Everything else in a Lit component is standard DOM. `connectedCallback`, `disconnectedCallback`, `attributeChangedCallback` — these are the platform lifecycle methods. A Lit component's `render()` method produces real DOM, not a virtual representation.

The SSR story for Lit is mature. `@lit-labs/ssr` renders Lit components to Declarative Shadow DOM. `@lit-labs/ssr-client` hydrates without re-rendering. The hydration model is the one the web standards bodies designed.

## The Nitro Decision

We could have written a custom server. Nuxt's team did — then they extracted it as [Nitro](https://nitro.unjs.io) and open-sourced it, because writing a production-ready server that deploys to Node.js, Cloudflare Workers, Vercel Edge, Netlify, Deno, and Bun is a significant amount of work.

Nitro handles all of this:

- File-based API routes via H3 event handlers
- Deployment adapters for every major target
- Server middleware, caching, static assets, SSG crawling
- A plugin system with well-defined build lifecycle hooks

Litro's server is Nitro. When you configure `NITRO_PRESET=cloudflare-workers` and run `litro build`, you get a Worker bundle. When you configure `LITRO_MODE=static`, you get a directory of prerendered HTML files. We don't maintain any of that deployment infrastructure — we benefit from the Nuxt ecosystem doing it.

This also means Nitro improvements come to Litro automatically. New adapter? It works. Better build performance? We get it.

## What Litro Actually Adds

Given Lit (component model) and Nitro (server), what does the framework add?

**File-based routing** — pages in `pages/index.ts` map to `/`, `pages/blog/[slug].ts` maps to `/blog/:slug`. A build-time scanner generates a virtual module with all routes; a single Nitro catch-all handler serves them.

**SSR pipeline** — `@lit-labs/ssr` renders page components to streaming DSD HTML. `@lit-labs/ssr-client` + `LitroRouter` handle client hydration and subsequent navigation.

**`definePageData()`** — a typed hook for server-side data fetching. The fetcher runs on the server, the result is serialized into the HTML shell, and on the first load `serverData` is populated from that JSON. On subsequent client-side navigations, `fetchData()` is called instead. No fetch waterfall, no loading state on the initial render.

**`LitroRouter`** — a client-side router built on `URLPattern`. Zero dependencies, standalone (also published as `@beatzball/litro-router`), and aware of how `@lit-labs/ssr-client` handles hydration.

**Content layer** — the `litro:content` virtual module provides a file-system Markdown API compatible with the 11ty data cascade format. Frontmatter, tags, sorted post lists, per-directory data inheritance.

**Scaffolding** — `npm create @beatzball/litro` with three recipes: `fullstack` (SSR), `11ty-blog` (Markdown blog, SSG), and `starlight` (docs + blog site, SSG).

## On Bundle Size

A Litro hello-world page sends roughly 8 kB of JavaScript to the browser. Community benchmarks and published framework documentation commonly cite the baseline JS payload for Next.js at roughly 90 kB and for Nuxt at roughly 60 kB — we have not independently measured these figures, and they vary by framework version and configuration. Lit's ~5 kB runtime size is documented on [lit.dev](https://lit.dev). The order-of-magnitude difference nonetheless reflects something structural.

The difference comes from what each framework carries. React's runtime is inherently in the bundle. The virtual DOM reconciler, the fiber scheduler, the event delegation system, the concurrent mode infrastructure — all of it ships to every user. Lit's runtime is about 5 kB. The client router adds a little more. That's the ceiling.

For most applications, runtime performance differences between React and Lit are not meaningful. But bundle size is felt by users on every page load, on every network. Smaller bundles mean faster time-to-interactive on real-world connections, lower data costs for users on metered plans, and better Core Web Vitals scores.

## Standards Will Outlast Frameworks

The web platform evolves slowly by design. When a capability is standardized and ships in all browsers, it tends to stay. Custom Elements are part of the HTML specification. Declarative Shadow DOM is in the HTML parser. URLPattern is a WHATWG standard.

Framework component models, on the other hand, have a history of change. Angular 1 to Angular 2 was a rewrite. React's class components gave way to hooks. Ember, Backbone, Knockout — frameworks from the same era as React have been superseded or abandoned. The components you write for them don't transfer.

A Lit web component written today is HTML. It will work in a browser ten years from now without an upgrade. It can be used from vanilla JavaScript, from Vue, from any system that can render a custom element tag.

We're not claiming Litro will be permanent — every framework has a lifespan. But the components you write with it are durable in a way that framework-specific components are not.

## Where We Are

Litro is in early development. The core pipeline — SSR, client hydration, data fetching, file-based routing, content layer, SSG — is working and tested. The scaffolding creates real, runnable applications. The docs site you're reading is built with the starlight recipe and deployed as static HTML.

What's not there yet: an ecosystem of third-party integrations, a large community, production case studies, and the accumulated polish that comes from years of user feedback. We're working on it.

If you're building something where bundle size matters, where you want your components to be portable, or where you've been waiting for a server framework that treats web components as a first-class target — we'd like you to try it.

```bash
npm create @beatzball/litro@latest my-app
```

Documentation at [litro.dev](https://litro.dev). Source at [github.com/beatzball/litro](https://github.com/beatzball/litro).
