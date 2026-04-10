---
title: "Litro vs Enhance: Two Approaches to SSR Web Components"
description: "Compare Litro and Enhance.dev — the two main frameworks for server-rendering web components. Honest trade-offs, feature comparison, and guidance on when to choose each."
date: 2026-03-21
---

# Litro vs Enhance

Enhance (by Begin.dev) and Litro are the two main frameworks for server-rendering
web components without React or Vue. They share the same fundamental goal and differ
significantly in how they get there.

## What They Share

- Server-first web components — HTML is rendered on the server before any JavaScript runs
- No React, Vue, or Svelte in the component model
- Progressive enhancement — pages work without JavaScript
- TypeScript support
- Standard Custom Elements at runtime

## Feature Comparison

<div class="table-wrap">
<table>
<thead>
<tr><th>Feature</th><th>Enhance</th><th>Litro</th></tr>
</thead>
<tbody>
<tr><td>Component format</td><td>HTML-first SFCs</td><td>Lit / FAST / Elena (pluggable)</td></tr>
<tr><td>Server rendering</td><td class="check">✓</td><td class="check">✓ DSD (Lit/FAST) or light DOM (Elena)</td></tr>
<tr><td>Client-side routing</td><td class="dash">— (MPA by default)</td><td class="check">✓ LitroRouter</td></tr>
<tr><td>Server engine</td><td>Begin cloud / Arc</td><td>Nitro (Vercel, Cloudflare, AWS…)</td></tr>
<tr><td>Deployment flexibility</td><td>Begin-centric</td><td>All Nitro presets</td></tr>
<tr><td>JavaScript by default</td><td>Opt-in</td><td>Opt-in</td></tr>
<tr><td>Lit ecosystem (Shoelace, etc.)</td><td class="dash">—</td><td class="check">✓</td></tr>
<tr><td>TypeScript</td><td>Partial</td><td class="check">✓ Full</td></tr>
<tr><td>SSG</td><td class="check">✓</td><td class="check">✓</td></tr>
<tr><td>File-based routing</td><td class="check">✓</td><td class="check">✓</td></tr>
</tbody>
</table>
</div>

## Component Authoring

Enhance uses its own HTML-first Single File Component format. Components are pure
functions that return HTML strings, with optional client-side enhancement via
`<script>` tags. This is intentionally minimal — no library layer.

Litro supports three web component frameworks via its adapter system: [Lit](https://lit.dev) (default), [FAST Element](https://www.fast.design/), and [Elena](https://elenajs.com/). Lit and FAST use Shadow DOM with Declarative Shadow DOM SSR; Elena uses light DOM with direct rendering — closer to Enhance's philosophy but with a full framework runtime. All three use the same routing, data fetching, and deployment infrastructure.

<div class="code-compare">
<div>
<p class="pane-label">Enhance — app/elements/my-counter.mjs</p>
<pre><code class="language-js">export default function MyCounter({
  html,
  state: { attrs }
}) {
  const count = attrs.count ?? 0;
  return html`
    &lt;style&gt;
      button { padding: 0.5rem 1rem; }
    &lt;/style&gt;
    &lt;button&gt;Count: ${count}&lt;/button&gt;
    &lt;script type="module"&gt;
      // client enhancement here
    &lt;/script&gt;
  `;
}</code></pre>
</div>
<div>
<p class="pane-label">Litro — Lit component</p>
<pre><code class="language-ts">import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
@customElement('my-counter')
class Counter extends LitElement {
  static styles = css`
    button { padding: 0.5rem 1rem; }
  `;
  static override properties = {
    _count: { state: true },
  };
  _count = 0;
  render() {
    return html`
      &lt;button @click=${() =&gt; this._count++}&gt;
        Count: ${this._count}
      &lt;/button&gt;
    `;
  }
}</code></pre>
</div>
</div>

## Server and Deployment

Enhance is built for Begin's cloud platform and Arc (the AWS infrastructure-as-code
tool Begin maintains). It works on AWS Lambda natively and has first-party Begin support.
Other deployment targets require more manual configuration.

Litro uses Nitro, which has first-party deployment presets for Vercel, Cloudflare Workers,
AWS Lambda, Deno Deploy, Netlify, Bun, and more. These are the same presets used by Nuxt.js
in production across thousands of sites.

## Client-Side Routing

Enhance is primarily a multi-page application (MPA) framework. Navigation triggers full
page loads by default. Client-side interactivity is added progressively via `<script>`
tags in component files. There's no built-in SPA router.

Litro includes **LitroRouter** — a built-in client-side router built on the
native URLPattern API. Navigation between routes is SPA-style with no full page reload.
Use `<litro-link>` for SPA navigation; plain `<a>` tags
do full page reloads.

## When Enhance Fits Well

Enhance is worth considering if you want:

- Zero JavaScript by default — pages are static HTML, enhancement is strictly opt-in
- The simplest possible component authoring model (no library dependency)
- A Begin/Arc-centric deployment model (deep AWS integration out of the box)
- Minimal abstraction — components are functions, not classes

## When to Choose Litro

Litro is a better fit if you want:

- Framework choice — Lit, FAST Element, or Elena via the `--adapter` flag
- Client-side routing (SPA-style navigation without full page reloads)
- The Lit ecosystem — Shoelace, `@lit/context`, community components
- Light DOM SSR via the Elena adapter — similar to Enhance's philosophy, with Nitro's deployment story
- Nitro's deployment flexibility (Vercel, Cloudflare Workers, and more)
- Migrating from Nuxt.js — the server layer is identical
- Full TypeScript across the component model

<div class="cta">
<a class="btn-primary" href="/docs/getting-started">Get Started with Litro</a>
<a class="btn-secondary" href="/why-web-components">Why Web Components?</a>
</div>
