---
title: "Litro vs Nuxt.js: Same Nitro Server, Different Component Model"
description: "Compare Litro and Nuxt.js. Both run on Nitro — the same server engine, the same deployment adapters. The difference is Vue vs Lit for components."
date: 2026-03-21
---

# Litro vs Nuxt.js

<div class="callout">
<strong>Shared foundation:</strong> Litro and Nuxt.js both run on
<strong>Nitro</strong> — the same server engine, the same deployment adapters,
the same H3 API routes. If you're migrating from Nuxt, your server-side code
largely copies verbatim.
</div>

The difference between Litro and Nuxt is the component model.
Nuxt uses Vue Single File Components; Litro uses Lit web components.
Everything under the server layer — Nitro, H3, deployment presets — is shared.

## Feature Comparison

<div class="table-wrap">
<table>
<thead>
<tr><th>Feature</th><th>Nuxt.js</th><th>Litro</th></tr>
</thead>
<tbody>
<tr><td>Component model</td><td>Vue 3 (SFC)</td><td>Lit (web components)</td></tr>
<tr><td>File-based routing</td><td class="check">✓</td><td class="check">✓</td></tr>
<tr><td>SSR</td><td>Vue SSR</td><td>Declarative Shadow DOM streaming</td></tr>
<tr><td>SSG</td><td class="check">✓</td><td class="check">✓</td></tr>
<tr><td>Data fetching</td><td><code>useFetch</code> / <code>useAsyncData</code></td><td><code>definePageData()</code></td></tr>
<tr><td>API routes</td><td><code>server/api/*.ts</code> (H3)</td><td class="same">Identical ↔</td></tr>
<tr><td>Server engine</td><td>Nitro</td><td class="same">Identical ↔</td></tr>
<tr><td>Deployment adapters</td><td>All Nitro presets</td><td class="same">Identical ↔</td></tr>
<tr><td>Client routing</td><td>vue-router</td><td>LitroRouter (URLPattern)</td></tr>
<tr><td>Hello World JS (gzipped)</td><td>~60 kB</td><td>~8 kB</td></tr>
<tr><td>Virtual DOM</td><td class="check">✓ (Vue)</td><td class="dash">—</td></tr>
<tr><td>W3C standard components</td><td class="dash">—</td><td class="check">✓</td></tr>
<tr><td>TypeScript</td><td class="check">✓</td><td class="check">✓</td></tr>
</tbody>
</table>
</div>

## Side by Side: A Page Component

<div class="code-compare">
<div>
<p class="pane-label">Nuxt — pages/about.vue</p>
<pre><code class="language-html">&lt;script setup lang="ts"&gt;
const title = 'About Us';
const items = ['SSR', 'SSG', 'Nitro'];
&lt;/script&gt;
&lt;template&gt;
  &lt;main&gt;
    &lt;h1&gt;{{ title }}&lt;/h1&gt;
    &lt;ul&gt;
      &lt;li v-for="item in items"&gt;
        {{ item }}
      &lt;/li&gt;
    &lt;/ul&gt;
  &lt;/main&gt;
&lt;/template&gt;</code></pre>
</div>
<div>
<p class="pane-label">Litro — pages/about.ts</p>
<pre><code class="language-ts">import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
const items = ['SSR', 'SSG', 'Nitro'];
@customElement('page-about')
export class AboutPage extends LitroPage {
  override render() {
    return html`
      &lt;main&gt;
        &lt;h1&gt;About Us&lt;/h1&gt;
        &lt;ul&gt;
          ${items.map(i =&gt; html`&lt;li&gt;${i}&lt;/li&gt;`)}
        &lt;/ul&gt;
      &lt;/main&gt;
    `;
  }
}
export default AboutPage;</code></pre>
</div>
</div>

## Side by Side: Data Fetching

<div class="code-compare">
<div>
<p class="pane-label">Nuxt — pages/blog/[slug].vue</p>
<pre><code class="language-html">&lt;script setup lang="ts"&gt;
const route = useRoute();
const { data: post } = await useFetch(
  `/api/posts/${route.params.slug}`
);
&lt;/script&gt;
&lt;template&gt;
  &lt;article&gt;
    &lt;h1&gt;{{ post?.title }}&lt;/h1&gt;
    &lt;div v-html="post?.body"&gt;&lt;/div&gt;
  &lt;/article&gt;
&lt;/template&gt;</code></pre>
</div>
<div>
<p class="pane-label">Litro — pages/blog/[slug].ts</p>
<pre><code class="language-ts">export const pageData = definePageData(
  async (event) =&gt; {
    const slug = event.context.params?.slug;
    const post = await $fetch(
      `/api/posts/${slug}`
    );
    return { post };
  }
);
@customElement('page-blog-slug')
export class BlogPost extends LitroPage {
  override render() {
    const { post } = this.serverData ?? {};
    if (!post) return html`&lt;p&gt;Loading&hellip;&lt;/p&gt;`;
    return html`
      &lt;article&gt;
        &lt;h1&gt;${post.title}&lt;/h1&gt;
        ${unsafeHTML(post.body)}
      &lt;/article&gt;
    `;
  }
}</code></pre>
</div>
</div>

## API Routes Are Identical

H3 API route handlers are copy-paste compatible. The only difference:
Nuxt auto-imports `defineEventHandler`; Litro requires an explicit import.

<div class="code-compare">
<div>
<p class="pane-label">Nuxt — server/api/posts.ts</p>
<pre><code class="language-ts">// defineEventHandler is auto-imported
export default defineEventHandler(async () =&gt; {
  return await db.getPosts();
});</code></pre>
</div>
<div>
<p class="pane-label">Litro — server/api/posts.ts</p>
<pre><code class="language-ts">import { defineEventHandler } from 'h3';
export default defineEventHandler(async () =&gt; {
  return await db.getPosts();
});</code></pre>
</div>
</div>

## What Carries Over

- **H3 API routes** — copy as-is, add the explicit `h3` import
- **Server middleware** — `server/middleware/*.ts` is identical
- **Deployment targets** — all Nitro presets work identically: Vercel, Cloudflare Workers, AWS Lambda, Deno Deploy, static, and more
- **Route rules** — `routeRules` in `nitro.config.ts` is the same API
- **File-based routing convention** — `[slug]`, `[...all]` work the same

## What Changes

- **Vue SFCs → Lit class components** — `<script setup>` becomes `definePageData()`; `<template>` becomes `render()`
- **No Vue runtime** — bundle drops from ~60 kB to ~8 kB
- **vue-router → LitroRouter** — different API, built on URLPattern
- **`<NuxtLink>` → `<litro-link>`** — SPA navigation; attribute is `href` not `to`

## Why Build on Web Standards?

Litro's component model is built on Custom Elements, Shadow DOM, and `<slot>` — W3C
specifications that browsers implement natively and interoperate with any framework or
plain HTML. Because the server layer is already shared (Nitro, H3, deployment presets),
moving from Nuxt to Litro means you keep your server investment entirely and adopt
a component model built directly on the web platform.

For new projects, building on web standards means your component layer stays stable as
the broader ecosystem evolves — no framework version to upgrade, no breaking changes to
absorb between major releases.

<div class="cta">
<a class="btn-primary" href="/docs/getting-started">Get Started with Litro</a>
<a class="btn-secondary" href="/docs/migrate/from-nuxt">Nuxt Migration Guide</a>
</div>
