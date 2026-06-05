---
title: Streaming SSR with Declarative Shadow DOM — How It Works
description: How Litro streams server-rendered Lit components to the browser using Declarative Shadow DOM, @lit-labs/ssr, and Nitro's sendStream(). What the wire format looks like, why it matters for Core Web Vitals, and how hydration works.
date: 2026-03-21
tags: [ssr, streaming, declarative-shadow-dom, performance]
---

# Streaming SSR with Declarative Shadow DOM — How It Works

Traditional SSR blocks: the server renders the full page, buffers it in memory, then sends it as one response. The browser receives nothing until the server is done. With streaming SSR, the server sends chunks as they're ready — the browser starts parsing the first chunk while the server is still rendering the rest.

Litro streams server-rendered Lit components using Declarative Shadow DOM (DSD). This post walks through the mechanism: what the wire format looks like, how the SSR pipeline works, and why it matters for real-world performance.

## Traditional SSR vs Streaming

**Traditional SSR:**

```
Client                    Server
  │                         │
  │ GET /page               │
  │──────────────────────►  │
  │                    render()
  │                    buffer HTML
  │                    done
  │  ◄────────────────────  │
  │ 200 OK + full HTML      │
  │                         │
parse HTML
render
```

Time to First Byte (TTFB) equals the full server render time. The browser waits.

**Streaming SSR:**

```
Client                    Server
  │                         │
  │ GET /page               │
  │──────────────────────►  │
  │                    send <head>
  │  ◄──────────── chunk 1  │
  │ parse <head>            │
  │ request CSS/JS          │
  │                    send <body>
  │  ◄──────────── chunk 2  │
  │ parse components        │
  │                    send </body>
  │  ◄──────────── chunk 3  │
  │ done                    │
```

The browser receives and starts parsing the first chunk — the `<head>` with CSS, hydration scripts, and meta tags — while the server is still rendering the component tree. First Contentful Paint happens earlier.

## What Declarative Shadow DOM Looks Like

Shadow DOM is normally JavaScript-only: `element.attachShadow({ mode: 'open' })`. Before Declarative Shadow DOM, server-rendered web components would send the light DOM HTML and wait for JavaScript to create the shadow root. The browser would show unstyled content until JS loaded.

DSD extends HTML with a `<template>` element that declaratively creates a shadow root:

```html
<my-card>
  <template shadowrootmode="open">
    <style>
      .card { border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 1rem; }
    </style>
    <div class="card">
      <h2>Post Title</h2>
      <p>Post excerpt here.</p>
    </div>
  </template>
</my-card>
```

When the browser parses this HTML, it creates a real shadow root for `<my-card>` — no JavaScript required. The component's styles are scoped, the DOM is structured correctly, and Googlebot sees the full rendered HTML.

This is what Litro sends on every SSR request.

## The SSR Pipeline

Litro's SSR pipeline for a page request:

```
1. Nitro receives GET /blog/my-post
2. Route handler calls definePageData.fetcher(event)
3. Returns { post: {...} }
4. buildShell() generates <head> + <body> HTML string
5. adapter.renderPage(tag, serverData)
   → AsyncIterable<string>          ← Lit: render() from @lit-labs/ssr
                                       FAST: @microsoft/fast-ssr templateRenderer
                                       Elena: direct instantiate + stringify
6. iterableToReadable() wraps the iterable as a Node.js Readable
7. PassThrough stream: shell.head | SSR output | shell.foot
8. sendStream(event, combined) → HTTP chunked transfer encoding
```

The adapter contract is `renderPage(tag, serverData): AsyncIterable<string>`. For Lit (the default), the adapter calls `render()` from `@lit-labs/ssr` and yields the flattened chunks of the resulting `RenderResult`; the chunks include DSD templates for each Lit component in the tree. FAST and Elena adapters produce the same `AsyncIterable<string>` shape via different mechanisms — see `packages/framework/src/adapter/{lit,fast,elena}/index.ts` for the implementations.

## The Shell Split

The HTML shell is split into `head` and `foot` so the SSR output can stream between them:

```
┌─────────────────────────────────────┐
│ shell.head                          │
│   <!DOCTYPE html>                   │
│   <html>                            │
│   <head>                            │
│     <script> hydration polyfill     │
│     <script type="module"> app.js   │
│     <script type="application/json" │
│       id="__litro_data__">          │
│       {"post": {...}}               │
│     </script>                       │
│   </head>                           │
│   <body>                            │
├─────────────────────────────────────┤
│ SSR output (streamed)               │
│   <page-blog-slug>                  │
│     <template shadowrootmode="open">│
│       <style>...</style>            │
│       <article>                     │
│         <h1>Post Title</h1>         │
│         ...                         │
│       </article>                    │
│     </template>                     │
│   </page-blog-slug>                 │
├─────────────────────────────────────┤
│ shell.foot                          │
│   </body>                           │
│   </html>                           │
└─────────────────────────────────────┘
```

The browser receives `shell.head` first and immediately starts loading CSS, the hydration support script, and the app bundle. By the time the SSR output finishes streaming, the JavaScript is already parsing or parsed.

## The `__litro_data__` Script Tag

The page data is embedded in the head as a `<script type="application/json">` tag:

```html
<script type="application/json" id="__litro_data__">
{"post":{"title":"Post Title","body":"...","date":"2026-03-10"}}
</script>
```

The browser doesn't execute this — `type="application/json"` is inert. After the app bundle loads, `LitroRouter` calls `getServerData()` which reads and parses this tag, then passes the data to the page component via `onBeforeEnter`. No second network request.

**Important:** `seoHead` is stripped before this serialization. It typically contains `<script type="application/ld+json">...</script>` for JSON-LD structured data. If that string were embedded inside the `application/json` script tag, the browser HTML parser would see `</script>` and terminate the outer tag early — corrupting the page. The `seoHead` and `seoTitle` values are extracted server-side and injected into `<head>` directly.

## Hydration

After the DSD HTML streams to the browser, it looks and works correctly — no JavaScript needed. When JavaScript loads, the hydration step runs.

Import order is critical. The first `<script type="module">` in `<head>` must be:

```html
<script type="module">
  import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
</script>
```

This patches `LitElement.prototype.createRenderRoot()` to check for an existing shadow root before creating a new one. Without this patch, Lit would create a new shadow root and discard the server-rendered DSD content, causing a hydration mismatch and a flash of unstyled content.

The app bundle imports this automatically via `app.ts`:

```ts
import '@lit-labs/ssr-client/lit-element-hydrate-support.js'; // MUST be first
import './routes.generated.js';
import { LitroOutlet } from '@beatzball/litro/runtime';
// ...
```

After the hydration support script patches the prototype, Lit elements upgrade normally — their `connectedCallback`, `firstUpdated`, and reactive property system all activate, and the component becomes interactive.

## Core Web Vitals Impact

Streaming SSR directly improves two Core Web Vitals metrics:

**TTFB (Time to First Byte):** The browser receives the first byte as soon as `shell.head` is flushed — before the SSR generator finishes. For pages with slow data fetching, this is a significant improvement over buffered SSR.

**LCP (Largest Contentful Paint):** Because the DSD template includes the actual rendered content (headings, text, images), the LCP element is in the initial HTML payload. It doesn't wait for JavaScript to render it. Googlebot sees the same content.

**FID / INP (Interaction to Next Paint):** The app bundle is small — JavaScript parse time is minimal compared to React or Vue SSR apps. See the [benchmarks](/benchmarks) for the current per-route gzipped weights across all three Litro adapters and the framework's competitors.

## Edge Adapter Note

Litro's default stream plumbing uses `iterableToReadable()` (see `packages/framework/src/adapter/stream.ts`), which is a small wrapper around Node's `stream.Readable`. That doesn't run in Cloudflare Workers or other edge runtimes that lack Node stream APIs.

For Cloudflare Workers, the adapter's `AsyncIterable<string>` output can be wrapped in a Web `ReadableStream` instead:

```ts
const ssrIterable = adapter.renderPage(tag, serverData);

const stream = new ReadableStream({
  async start(controller) {
    for await (const chunk of ssrIterable) {
      controller.enqueue(new TextEncoder().encode(chunk));
    }
    controller.close();
  },
});
```

Litro's Lit adapter already inlines `@lit-labs/ssr` and `@lit-labs/ssr-client` for every preset (see `litAdapter.nitroConfig()` in `packages/framework/src/adapter/lit/index.ts`), and the FAST adapter handles `@microsoft/fast-ssr` similarly — so for the supported adapters you don't need to add anything in `nitro.config.ts` for edge deployment to bundle them. The Elena adapter doesn't pull in either package and ships the smallest edge footprint of the three.

## What to Read Next

- [SSR core concepts](/docs/core-concepts/ssr)
- [Why web components are not bad for SEO](/blog/shadow-dom-seo)
- [Litro vs Next.js — streaming SSR comparison](/compare/nextjs)
