# PRD-3: Blog Content & Technical Articles

**Priority:** P1
**Effort:** Ongoing — initial batch of 8 posts; then 1–2/month
**Phase:** Posts 1–2 begin in Phase 1 (parallel with PRD-1/PRD-4); Posts 3–5 in Phase 2;
Posts 6–8 in Phase 3
**Dependencies:** PRD-1 deployed before promoting posts (JSON-LD and dynamic sitemap must
be live so posts are indexed correctly on publication)

---

## Problem

The blog exists but has exactly one post. Blog posts are the highest-leverage SEO asset for
a developer-tool brand:

- They target long-tail queries that comparison pages don't cover
- They establish technical authority, which earns backlinks from other developers
- Each post is a new indexed URL with its own keyword surface
- Fresh content improves crawl frequency
- They are the raw material for Dev.to cross-posts, HN submissions, and newsletter pickups

---

## Goals

1. Publish an initial batch of 8 technical posts covering the highest-value topics.
2. Each post targets at least one specific long-tail keyword.
3. Every post links to a relevant comparison page or docs page (internal linking).
4. Posts are written in priority order — the highest-SEO-value, lowest-risk posts first.
5. Performance benchmarks are published last, only after numbers are reproducible and
   the framework is stable enough to withstand scrutiny.

---

## Post Queue (in publish order)

### Post 1: Shadow DOM and SEO — The Problem and Litro's Solution
**Publish:** Phase 1, Week 1
**Target keyword:** "web components SEO," "shadow DOM SEO," "are web components bad for SEO"
**Why first:** This is the #1 objection developers raise when evaluating web components for
production use. A well-ranked answer to this question removes a purchase blocker for every
developer who finds Litro through any channel.

Outline:
- The misconception: "web components are bad for SEO"
- What's actually true: *client-side-only* web components are invisible to crawlers — the
  component renders after JS executes, and Googlebot's JS rendering queue is slow and
  non-deterministic
- The same problem exists for React, Vue, and Svelte without SSR — this isn't a web
  components problem, it's a rendering mode problem
- The solution: server-side rendering with Declarative Shadow DOM (DSD)
- What DSD looks like in the wire — show the actual serialized HTML a crawler receives
- How `@lit-labs/ssr` + Litro delivers this — the same mechanism Next.js and Nuxt.js use
- Practical result: Googlebot sees fully-rendered HTML before any JS executes
- Internal links: `/compare/nextjs`, `/docs/core-concepts/ssr`

---

### Post 2: Why We Built Litro — The Case for Standards-Based Development
**Publish:** Phase 1, Week 2
**Target keyword:** "web standards framework," "no virtual DOM framework," "Lit fullstack framework"
**Why second:** This is the manifesto post and the primary Hacker News submission. It sets
the philosophical foundation that all other content references back to.

Outline:
- **The framework treadmill** — Angular → React → what's next? Every migration costs weeks
  of developer time and carries real risk. This isn't a criticism of any framework — it's
  a structural observation about the ecosystem.
- **The virtual DOM was a workaround** — in 2013, the DOM was slow and inconsistent across
  browsers. The virtual DOM diffing solved a real problem. Today, that problem is largely
  gone: browsers are fast, APIs are standardized. The workaround outlasted the problem it
  solved.
- **Web components as a different bet** — Custom Elements, Shadow DOM, and `<template>` are
  W3C specifications. They will be in browsers in 2040 in the same way `<input type="date">`
  from 2012 is still in browsers today. The bet is on longevity, not on today's performance
  numbers.
- **Lit as the minimum ergonomic layer** — not a new runtime, a 6kB library that adds
  reactive properties and tagged template rendering on top of the native APIs. If Lit
  disappeared tomorrow, the components it produces still run natively.
- **Nitro as the deployment layer** — rather than building a custom server, Litro uses Nitro
  — the server engine behind Nuxt.js. All of Nitro's deployment adapters (Vercel, Cloudflare
  Workers, AWS Lambda, Deno Deploy) work without any custom Litro code.
- **What Litro is NOT trying to be** — not a React replacement for large enterprise
  organizations with years of React investment. The migration cost is real and for many
  teams, not worth it.
- **Who it IS for** — developers starting new projects, teams that want to reduce their
  dependency on proprietary runtimes, developers who have been through two or three framework
  migrations and want to bet on the platform.
- Internal links: `/why-web-components`, `/compare/nextjs`, `/compare/nuxt`

---

### Post 3: File-Based Routing with Lit — A Next.js Developer's Guide
**Publish:** Phase 2, Week 3
**Target keyword:** "file-based routing web components," "Next.js routing Lit," "Lit SSR routing"
**Why:** Directly targets Next.js developers using vocabulary they already know. Captures
searches from the comparison page's audience who want technical depth.

Outline:
- Next.js page conventions as the starting point (assume reader knows them)
- Litro's equivalent: `pages/index.ts` → `/`, `pages/[id].ts` → `/:id`, `pages/[...slug].ts`
- How the page scanner works (fast-glob pattern, virtual module, no runtime `require()`)
- The `default export` pattern: Lit class component as the page
- `routeMeta` for head injection (title, description, canonical)
- Navigation: `<litro-link>` vs Next's `<Link>` — same concept, different element
- Data fetching: `definePageData()` vs Next.js server components — side-by-side
- Deployment: Nitro presets, including Vercel (same one Nuxt uses)
- Internal links: `/compare/nextjs`, `/docs/migrate/from-nextjs`

---

### Post 4: Streaming SSR with Declarative Shadow DOM — How It Works
**Publish:** Phase 2, Week 4
**Target keyword:** "streaming SSR web components," "Declarative Shadow DOM streaming,"
"DSD server rendering"
**Why:** Technical depth post for developers who want to understand the mechanism, not just
the result. Earns credibility with senior engineers and generates backlinks from technical blogs.

Outline:
- Traditional SSR: blocking render, full HTML buffered before first byte sent to client
- Streaming SSR: server sends chunks as they're ready (HTTP chunked transfer encoding)
- How React/Next.js does it: Suspense boundaries as the flush points
- How Litro does it: `@lit-labs/ssr` → `RenderResultReadable` → Nitro `sendStream()`
- What DSD looks like on the wire — annotated HTML example showing `<template shadowrootmode>`
- Why this matters for Core Web Vitals: earlier First Contentful Paint, improved LCP
- The hydration step: `@lit-labs/ssr-client/lit-element-hydrate-support.js` must load first;
  why import order matters
- Edge adapter consideration: `RenderResultReadable` is Node-only; Cloudflare Workers
  need `ReadableStream` conversion
- Full working code example: a streaming Litro page with async `definePageData`
- Internal links: `/docs/core-concepts/ssr`, `/compare/nextjs`

---

### Post 5: Building a Blog with Litro's Content Layer
**Publish:** Phase 2, Week 5
**Target keyword:** "Lit SSG blog," "web components markdown blog," "litro content layer"
**Why:** Tutorial post that converts "I want to build a blog/docs site with web components"
searches. Lower competition than the framework comparison queries.

Outline:
- What `litro:content` is: a virtual module, not a filesystem API — available server-side
  only, delivered to the client via `definePageData` → `getServerData`
- Start from the `11ty-blog` recipe vs. building from scratch: trade-offs
- Complete working blog: content directory, frontmatter schema, `getPosts()`, rendering
- Tags and filtering
- Static generation: `generateRoutes()` for prerendering every post at build time
- Deploying to GitHub Pages: `LITRO_BASE_PATH`, `.nojekyll`, GitHub Actions
- Optional: adding an RSS feed (connects back to PRD-1 RSS work)
- Internal links: `/docs/content-layer`, `/docs/ssg`, `/docs/deployment/github-pages`

---

### Post 6: How Nitro's Deployment Adapters Work — and Why Litro Gets Them for Free
**Publish:** Phase 3, Week 6
**Target keyword:** "Nitro deployment adapters," "deploy web components Cloudflare Vercel,"
"framework deployment flexibility"
**Why:** Targets developers who care about avoiding vendor lock-in (a growing concern).
The Nitro shared-foundation angle is Litro's strongest credibility signal; this post
makes it concrete.

Outline:
- What Nitro is: the server engine behind Nuxt, Analog, and Litro
- What a "preset" is: a self-contained output target that rewrites the server for a
  specific runtime
- Available presets: `node`, `vercel`, `cloudflare-workers`, `deno-deploy`, `aws-lambda`,
  `netlify`, static, and more
- How Litro uses them: `NITRO_PRESET=cloudflare-workers litro build` — no custom code
- Edge-specific considerations: `externals.inline: ['@lit-labs/ssr']`, Node vs Workers
  streaming API differences
- Comparison: Next.js is Vercel-optimized (adapters exist but are community-maintained);
  Litro's adapters are Nitro's adapters, which are first-party and used by Nuxt
- Internal links: `/compare/nuxt`, `/docs/deployment/coolify`, `/docs/deployment/github-pages`

---

### Post 7: LitroRouter — A URLPattern Router for Web Components
**Publish:** Phase 3, Week 7
**Target keyword:** "URLPattern router," "web component router," "client-side routing
web components"
**Why:** Introduces `@beatzball/litro-router` as a standalone package. Targets developers
who want a client-side router for Lit components without the full framework.

Outline:
- Why client-side routing in web components requires care (window/history access, shadow
  DOM subtree management, SSR safety)
- The URLPattern API: native browser routing, Baseline Sep 2025
- LitroRouter's design decisions: no global `<a>` click interceptor (deliberate), `<litro-link>`
  for SPA navigation, pushState only
- Code: setting up routes, `onBeforeEnter(location: LitroLocation)`, params
- Shadow DOM scroll-to-hash after navigation — the `_findDeep()` recursive traversal
- Using `@beatzball/litro-router` standalone, without Litro (it's a zero-dependency package)
- Internal links: `/docs/core-concepts/client-router`, `/docs/litro-router`

---

### Post 8: Litro vs Next.js vs Nuxt.js — Hello World Performance Comparison
**Publish:** Phase 3, Week 8 — only after framework is stable and numbers are verified
**Target keyword:** "Next.js bundle size comparison," "web framework performance 2026,"
"smallest JavaScript framework"
**Why last:** This is the most backlink-worthy post if done right — and the most damaging
if methodology is sloppy or numbers are challenged. Publish only when:
  1. The framework is past v1.0 and not undergoing significant changes
  2. A reproducible test setup exists (public GitHub repo, documented methodology)
  3. The numbers have been verified by at least one person other than the author

Outline:
- Methodology: identical "Hello World" page, cold start, measured with Lighthouse +
  `source-map-explorer`; link to reproducible test repo
- Metrics: JS transferred (gzipped), JS parsed, TTFB, FCP, LCP, TBT, Lighthouse score
- Results table: Next.js 15, Nuxt 3, SvelteKit, Astro (static), Litro
- Why Litro wins on bundle size: no virtual DOM library, no framework runtime, Lit is 6kB
- Where Litro doesn't win: ecosystem maturity (name it honestly)
- What the bundle difference means in practice: parse time on low-end mobile, Core Web
  Vitals score impact
- "Run these benchmarks yourself" — link to the test repo
- Internal links: `/compare/nextjs`, `/compare/nuxt`, `/why-web-components`

---

## Content Standards

### Frontmatter requirements (all posts)

```yaml
---
title: "..."           # 50–60 characters; include the primary keyword
description: "..."     # 120–160 characters; includes primary keyword; benefit-oriented
date: YYYY-MM-DD
tags: [tag1, tag2]     # 2–4 tags; used by blog index and RSS feed
---
```

### Post structure

- No fluffy introductions. First paragraph states the problem or the conclusion.
- At least one working, verified code example per post.
- End every post with a CTA linking to one of: `/docs/getting-started`, a comparison page,
  or a related migration guide.
- Avoid "In this post we will..." constructions.
- Acknowledge trade-offs honestly — developer audiences distrust marketing language.

### Internal linking

Every post must link to 2–3 of:
- A relevant docs page
- A comparison page (once live)
- A related blog post (once 3+ posts exist)

### Length

- Technical explainers (Posts 1–4, 6–8): 1,200–2,500 words + code
- Tutorials (Post 5): 800–1,500 words + code

Longer is fine if the content earns it. Padding for word count is not.

---

## Publication Schedule

| Post | Phase | Promoted To |
|------|-------|------------|
| Post 1: Shadow DOM SEO | Phase 1, Week 1 | Dev.to, r/webdev, Lit Discord |
| Post 2: Why We Built Litro | Phase 1, Week 2 | Hacker News Show HN |
| Post 3: File-Based Routing | Phase 2, Week 3 | Dev.to, r/javascript |
| Post 4: Streaming SSR | Phase 2, Week 4 | Dev.to, r/webdev |
| Post 5: Blog Tutorial | Phase 2, Week 5 | Dev.to tutorials, r/webdev |
| Post 6: Nitro Adapters | Phase 3, Week 6 | r/javascript, Nuxt Discord |
| Post 7: LitroRouter | Phase 3, Week 7 | r/webcomponents, Lit Discord |
| Post 8: Performance | Phase 3, Week 8+ | r/webdev, JavaScript Weekly |

---

## Acceptance Criteria (initial batch)

- [ ] Posts 1–5 published before Phase 3 community distribution begins
- [ ] Every post has `title`, `description`, `date`, `tags` frontmatter
- [ ] Every post is syntax-highlighted (blog `[slug].ts` handles this via `applyHighlighting`)
- [ ] Every post links to at least one comparison page or docs page
- [ ] All post slugs appear in the dynamic `/sitemap.xml` automatically (handled by PRD-1)
- [ ] OG tags on each post use the post's specific `title` and `description`
- [ ] Post 8 (benchmarks) is NOT published until methodology is reproducible and verified
