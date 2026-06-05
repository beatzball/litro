---
title: Shadow DOM and SEO — The Problem and Litro's Solution
description: Web components have an SEO problem — content inside Shadow DOM is invisible to crawlers. Here's why that happens, why it matters less than you think, and how Litro eliminates the issue entirely with server-side Declarative Shadow DOM.
date: 2026-03-20
tags:
  - blog
  - seo
  - web-components
  - ssr
---

# Shadow DOM and SEO — The Problem and Litro's Solution

Web components have a reputation for being bad for SEO. It comes up every time someone evaluates Lit, every time a team considers moving away from React. The concern is real — but it applies specifically to _client-side-only_ web components. Litro's SSR model eliminates the problem entirely.

Here's how.

## Why Shadow DOM Creates an SEO Problem

When you build a web component with Shadow DOM, the component's internal HTML is hidden from the document's main DOM until JavaScript runs and attaches it. Before that point, the element exists as an empty custom element tag — `<my-component></my-component>` — with no visible content.

Search engine crawlers request your page, parse the HTML, and if they execute JavaScript at all, they do so asynchronously and with time limits. Googlebot is better at this than most crawlers, but it still has known delays of days to weeks before crawled JavaScript content is indexed. For Bing and most other crawlers, client-side rendering is a meaningful ranking disadvantage.

The result for a client-rendered web component app:

1. Crawler fetches `GET /`
2. Gets back `<body><my-app></my-app></body>` — essentially empty
3. Either skips indexing the content or queues JS execution for later
4. Your text, headings, and links are invisible to the crawler

For marketing pages, documentation, and blogs, this matters a lot.

## The Standard Solution: Declarative Shadow DOM

The WHATWG HTML specification addressed this with [Declarative Shadow DOM](https://developer.chrome.com/docs/css-ui/declarative-shadow-dom) (DSD) — a way to express shadow DOM structure directly in HTML, without JavaScript.

Instead of:

```html
<my-component></my-component>
```

A server can render:

```html
<my-component>
  <template shadowrootmode="open">
    <h1>Hello from the server!</h1>
    <p>This content is fully visible to crawlers.</p>
  </template>
</my-component>
```

The browser parses this natively — no JavaScript needed. The shadow DOM is attached before the first paint. Crawlers get real content. Declarative Shadow DOM reached web-platform Baseline in February 2024 once Firefox 123 shipped support (Chrome since 2021, Safari since March 2023, Firefox since February 2024), and the older attribute name `shadowroot` has been replaced by `shadowrootmode`.

## How `@lit-labs/ssr` Implements This

Lit's SSR library renders Lit components to Declarative Shadow DOM on the server. Given:

```typescript
@customElement("my-component")
class MyComponent extends LitElement {
  override render() {
    return html`<h1>Hello from the server!</h1>`;
  }
}
```

`@lit-labs/ssr` produces the DSD template string above. The client then _hydrates_ — `@lit-labs/ssr-client` takes over the existing DOM rather than re-rendering it, eliminating the flicker and double-render you'd get with naive SSR.

This is streaming, too. Nitro pipes the DSD output through Node.js streams directly to the response — the browser starts rendering before the full page has been generated.

## What Litro Does

Litro wires all of this together automatically:

- Your page components extend `LitroPage` (a thin subclass of `LitElement`) and call `definePageData()` for server-side data fetching
- The framework renders them server-side on every request via `@lit-labs/ssr`
- The resulting DSD HTML is streamed to the browser
- On the client, `@lit-labs/ssr-client` hydrates without re-rendering, and `LitroRouter` takes over for subsequent navigation

What crawlers see when they request a Litro page is identical to what a user sees in a slow browser. Every heading, paragraph, link, and list item is in the HTML response.

## The Static Site Generation Option

For sites that don't need dynamic data — documentation, marketing pages, blogs — Litro also supports SSG (static site generation). During build, every route is prerendered to static HTML. The output is a directory of `.html` files you can deploy to a CDN, GitHub Pages, or any static host.

The litro.dev documentation site you're reading right now is built this way. Every page is a static HTML file with fully-rendered content in the response body.

## What About `<slot>` and Distributed Content?

One subtlety: content passed into a component via `<slot>` sits in the _light_ DOM (outside the shadow root) and is always visible to crawlers regardless of SSR. Only content generated _inside_ the shadow root needs DSD to be crawler-visible. If your components receive their text content via slots, client-side-only rendering is less of a crawlability problem — though SSR still helps with above-the-fold render performance.

## Summary

The SEO concern with web components is real but specific: client-side-only rendering hides content from crawlers until JavaScript executes. Litro eliminates this by rendering to Declarative Shadow DOM on the server before the response is sent. Crawlers receive complete HTML. Users get a fast first paint. And after hydration, the app behaves as a full SPA with client-side navigation.

You get the component model of the web platform, the deployment flexibility of Nitro, and no SEO compromises.

```bash
npm create @beatzball/litro@latest my-app
```
