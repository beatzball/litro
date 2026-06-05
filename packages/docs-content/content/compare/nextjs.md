---
title: "Litro vs Next.js: File-Based Routing and SSR Without React"
description: "Compare Litro and Next.js side by side. Both offer file-based routing, SSR, and TypeScript — the difference is the component model and what you're betting on long-term."
date: 2026-03-21
---

# Litro vs Next.js

Both frameworks solve the same core problems — SSR, file-based routing, TypeScript, deployment
adapters. The difference is the component model and what you're betting on long-term:
React's ecosystem today, or web platform standards for the next decade.

## Feature Comparison

<div class="table-wrap">
<table>
<thead>
<tr><th>Feature</th><th>Next.js</th><th>Litro</th></tr>
</thead>
<tbody>
<tr><td>Component model</td><td>React (JSX)</td><td>Lit / FAST / Elena (web components)</td></tr>
<tr><td>File-based routing</td><td class="check">✓</td><td class="check">✓</td></tr>
<tr><td>SSR</td><td>React Server Components</td><td>DSD streaming (Lit/FAST) or light DOM (Elena)</td></tr>
<tr><td>SSG</td><td class="check">✓</td><td class="check">✓</td></tr>
<tr><td>Data fetching</td><td><code>fetch()</code> in Server Components</td><td><code>definePageData()</code></td></tr>
<tr><td>API routes</td><td><code>app/api/route.ts</code></td><td><code>server/api/*.ts</code> (H3)</td></tr>
<tr><td>Client routing</td><td>Next Router</td><td>LitroRouter (URLPattern)</td></tr>
<tr><td>Client bundle</td><td>React runtime + RSC payloads</td><td>Web component runtime (Lit / FAST / Elena) — see <a href="/benchmarks">benchmarks</a></td></tr>
<tr><td>Server engine</td><td>Custom</td><td>Nitro (same as Nuxt)</td></tr>
<tr><td>Virtual DOM</td><td class="check">✓</td><td class="dash">—</td></tr>
<tr><td>W3C standard components</td><td class="dash">—</td><td class="check">✓</td></tr>
<tr><td>TypeScript</td><td class="check">✓</td><td class="check">✓</td></tr>
<tr><td>License</td><td>MIT</td><td>Apache 2.0</td></tr>
</tbody>
</table>
</div>

## Side by Side: A Simple Page

<div class="code-compare">
<div>
<p class="pane-label">Next.js — app/about/page.tsx</p>
<pre><code class="language-tsx">export default function AboutPage() {
  return (
    &lt;main&gt;
      &lt;h1&gt;About&lt;/h1&gt;
      &lt;p&gt;We build web frameworks.&lt;/p&gt;
    &lt;/main&gt;
  );
}</code></pre>
</div>
<div>
<p class="pane-label">Litro — pages/about.ts</p>
<pre><code class="language-ts">import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
@customElement('page-about')
export class AboutPage extends LitroPage {
  override render() {
    return html`
      &lt;main&gt;
        &lt;h1&gt;About&lt;/h1&gt;
        &lt;p&gt;We build web frameworks.&lt;/p&gt;
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
<p class="pane-label">Next.js — Server Component</p>
<pre><code class="language-tsx">// app/blog/[slug]/page.tsx
export default async function BlogPost({
  params,
}: {
  params: { slug: string };
}) {
  const post = await db.getPost(params.slug);
  return (
    &lt;article&gt;
      &lt;h1&gt;{post.title}&lt;/h1&gt;
      &lt;div dangerouslySetInnerHTML=
        {{ __html: post.body }} /&gt;
    &lt;/article&gt;
  );
}</code></pre>
</div>
<div>
<p class="pane-label">Litro — definePageData()</p>
<pre><code class="language-ts">// pages/blog/[slug].ts
export const pageData = definePageData(
  async (event) =&gt; {
    const slug = event.context.params?.slug;
    const post = await db.getPost(slug);
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

## What Carries Over

- **File-based routing** — same `pages/` convention, same dynamic segment syntax (`[slug]`, `[...all]`)
- **API routes** — same concept, different handler format (H3 instead of Web Request/Response)
- **TypeScript throughout** — Litro is TypeScript-first
- **Deployment adapters** — Litro uses Nitro, which has Vercel, Cloudflare Workers, AWS Lambda, and more as first-party presets
- **SSG** — export `generateRoutes()` instead of `generateStaticParams()`

## What Changes

- **React → web components** — choose Lit, FAST Element, or Elena. Function components become class components; JSX becomes tagged template literals
- **No React runtime** — Litro ships only the chosen web-component runtime (Lit, FAST, or Elena) instead of React + RSC payloads; see the [benchmarks page](/benchmarks) for current per-route gzipped weights.
- **Shadow DOM instead of CSS Modules** — component styles are scoped at the browser level
- **H3 API routes** — import `defineEventHandler` from `h3` rather than using Next's Web Request/Response format
- **Server engine** — Nitro instead of Next's custom server (more deployment targets, same Vercel support)

## Why Build on Web Standards?

Litro's component model is built on Custom Elements, Shadow DOM, and `<slot>` — W3C
specifications implemented natively in every major browser. Because they're part of the
web platform itself, Lit components interoperate with any framework, work in plain HTML,
and will continue to be supported for as long as browsers exist.

For new projects, building on web standards means your component layer stays stable as
the broader ecosystem evolves. There's no framework version to upgrade, no breaking
changes to absorb — the browser's implementation is the spec.

Read more: [Why Web Components? The case for standards-based development](/why-web-components)

<div class="cta">
<a class="btn-primary" href="/docs/getting-started">Get Started with Litro</a>
<a class="btn-secondary" href="/docs/migrate/from-nextjs">Next.js Migration Guide</a>
</div>
