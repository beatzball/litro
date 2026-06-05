# PRD-2: Comparison & Migration Pages

**Priority:** P0
**Effort:** 3–5 days
**Phase:** 2 (start writing immediately; deploy after PRD-1 is live so pages get JSON-LD
from day one)
**Dependencies:** PRD-1 deployed before going live (for JSON-LD and sitemap); content
writing can begin in parallel

> **Historical document.** Path references — `docs/content/docs/migrate/...`, `docs/content/...` — predate the Phase 1 extraction. Migration guides now live under `packages/docs-content/content/docs/migrate/`. The PRD's substance still applies; only the locations changed.

---

## Problem

The highest-value SEO queries for a new framework are comparison and migration searches:
"Next.js alternative," "Nuxt.js alternative web components," "Lit framework SSR," etc.

Litro has zero pages targeting these. Every developer who discovers Litro — whether via
search or word of mouth — must answer "is this for me?" entirely on their own. The
comparison pages close that gap directly.

**Design principle:** Each comparison page serves double duty as both a technical comparison
*and* an audience landing page. A separate `/for-nextjs-developers` page alongside a
`/compare/nextjs` page would produce thin, overlapping content. One well-executed page per
audience is better than two mediocre ones.

---

## Goals

1. Rank for comparison and migration queries from Next.js, Nuxt.js, and React developers.
2. Give each audience a page that speaks their vocabulary and maps Litro to concepts they
   already know.
3. Address the Enhance.dev comparison — the nearest competitor in the web-components SSR
   space — so developers researching this category have a clear answer.
4. Position Litro's philosophical stance: standards-based development as a long-term bet,
   not just another framework swap.

---

## New Pages

### Group 1: Comparison Pages

These are evergreen SEO landing pages at top-level routes. They serve both the "comparison"
and "developer audience" purpose — no separate audience pages needed.

#### `/compare/nextjs`
**Title:** "Litro vs Next.js: File-Based Routing and SSR Without React"
**Target keywords:** "Next.js alternative," "Next.js vs web components," "SSR without React"

Content structure:
1. **One-paragraph opener** — both frameworks solve the same core problems (SSR, routing,
   deployment); the difference is the component model and what you're betting on long-term
2. **Feature comparison table** (see spec below)
3. **Side-by-side code: a simple SSR page** — Next.js `page.tsx` vs Litro `index.ts`
4. **Side-by-side code: data fetching** — Next.js server component vs `definePageData()`
5. **"What carries over"** — file-based routing, API routes, deployment adapters (Vercel
   works with Nitro's preset, same as Nuxt), TypeScript throughout
6. **"What changes"** — React → Lit, JSX → tagged template literals, React runtime
   eliminated from the client bundle, ~8kB vs ~90kB Hello World
7. **"Why this trade-off?"** — short version of the standards argument: React will be
   replaced by something; web components are a W3C standard. Not a prediction — a bet on
   longevity
8. **CTA:** Get started → `/docs/getting-started` | Migration guide → `/docs/migrate/from-nextjs`

#### `/compare/nuxt`
**Title:** "Litro vs Nuxt.js: Same Nitro Server, Different Component Model"
**Target keywords:** "Nuxt.js alternative," "Nuxt without Vue," "Nitro with web components"

The Nuxt comparison has a unique hook: both Litro and Nuxt.js use Nitro as their server
engine. This is the single strongest credibility signal Litro has and should be the lede.

Content structure:
1. **Shared foundation callout** (prominent, near top): "Litro and Nuxt.js both run on
   Nitro — the same server engine, the same deployment adapters, the same H3 API routes."
2. **Feature comparison table** (adapted for Vue vs Lit)
3. **Side-by-side code: a Nuxt page vs a Litro page**
4. **"What carries over"** — Nitro, H3 event handlers, server middleware, all deployment
   presets (Cloudflare, Vercel Edge, AWS, etc.) work identically in Litro
5. **"What changes"** — Vue SFC → Lit class component; `useFetch` → `definePageData()`;
   `<NuxtLink>` → `<litro-link>`; no `<script setup>` magic
6. **"Why switch?"** — same argument: Vue will eventually be superseded; web components
   are a platform primitive; you keep the Nitro investment you already have
7. **CTA:** Get started | Migration guide → `/docs/migrate/from-nuxt`

#### `/compare/enhance`
**Title:** "Litro vs Enhance: Two Approaches to SSR Web Components"
**Target keywords:** "Enhance.dev alternative," "Enhance vs Litro," "SSR web components framework"

Enhance (by Begin.dev) is the closest competitor in the web-components SSR space. Developers
researching this category will find both. Litro needs a clear, fair answer to "how is this
different from Enhance?"

Content structure:
1. **What they share** — both render web components server-first, both avoid React/Vue/Svelte
2. **Key difference: component authoring** — Enhance uses its own HTML-first single-file
   component format; Litro uses Lit (a widely-adopted W3C-aligned library with its own
   ecosystem, SSR tooling, and community)
3. **Key difference: server** — Enhance is built for Begin's cloud; Litro uses Nitro,
   giving it Vercel, Cloudflare, AWS, and Node.js targets without custom adapters
4. **Key difference: client routing** — Enhance is primarily document-navigation (MPA);
   Litro includes a full client-side router (LitroRouter) for SPA-style navigation
5. **Feature comparison table**
6. **When to choose Enhance** — honest answer: if you want zero-JS-by-default and document
   semantics without client routing, Enhance is excellent
7. **When to choose Litro** — if you want client routing, the Lit ecosystem (Shoelace, etc.),
   Nitro's deployment flexibility, or are migrating from Nuxt/Next
8. **CTA:** Get started | `/docs/getting-started`

#### `/why-web-components`
**Title:** "Why Web Components? The Case for Standards-Based Development in 2026"
**Target keywords:** "why web components," "web components vs React 2026," "web standards framework"

This page is the philosophical anchor for the entire site. It answers the meta-question
behind every comparison: "why should I care about web components at all?"

Content structure:
1. **The framework treadmill** — React replaced Angular; something will replace React.
   Every migration is expensive. Developers who've been through two or three of these are
   paying attention to standards.
2. **What web components actually are** — not a framework. Custom Elements, Shadow DOM,
   and `<template>` are W3C specifications implemented natively in every major browser.
   Baseline 2024. No polyfills needed.
3. **What Lit adds** — 6kB library on top of the native APIs. Reactive properties, tagged
   templates, SSR support. The minimum ergonomic layer, not a new runtime.
4. **The standards longevity argument** — the DOM API from 1998 still works. `<input type="date">`
   from 2012 still works. Web components defined today will still work in browsers shipping
   in 2040, without a migration.
5. **Honest trade-offs** — ecosystem maturity vs React, fewer component libraries, smaller
   community today. Name it directly rather than letting readers find it themselves.
6. **Litro as the batteries-included entry point** — you don't have to assemble this from
   scratch. File-based routing, SSR, data fetching, deployment adapters — all included.
7. **CTA:** Get started → `/docs/getting-started`

---

### Group 2: Migration Guides

These live in the docs tree at `/docs/migrate/*`. They are practical code-first guides,
not persuasion. The comparison pages do the persuading; the migration guides do the work.

#### `/docs/migrate/from-nextjs`
**Title:** "Migrating from Next.js to Litro"
**Target keywords:** "migrate from Next.js," "Next.js to web components"

Mapping table (concepts only — full code examples inline):

| Next.js | Litro | Notes |
|---------|-------|-------|
| `app/page.tsx` | `pages/index.ts` | Same location concept |
| `export default function Page()` | `@customElement class Page extends LitroPage` | Class vs function |
| Server Component `fetch()` | `definePageData(async () => {...})` | Server-side data |
| `getServerSideProps` | `definePageData()` | Same purpose |
| `useRouter()` | `LitroRouter` | Different API |
| `<Link href="...">` | `<litro-link href="...">` | SPA navigation |
| `app/api/route.ts` | `server/api/*.ts` | H3 event handler |
| CSS Modules | Shadow DOM `static styles = css\`...\`` | Scoping model |
| `next.config.js` | `nitro.config.ts` + `vite.config.ts` | Split config |
| `next build` | `litro build` | — |
| `next dev` | `litro dev` | — |

Content: step-by-step migration with before/after code for each concept. End with
a complete worked example: migrate a simple blog from Next.js to Litro.

#### `/docs/migrate/from-nuxt`
**Title:** "Migrating from Nuxt.js to Litro"
**Target keywords:** "migrate from Nuxt," "Nuxt to Litro"

Same format. Key callout: H3 API route handlers from Nuxt can be copied verbatim to
Litro's `server/api/` — they are identical. The migration from Nuxt is primarily about
replacing Vue SFCs with Lit class components.

#### `/docs/migrate/from-react`
**Title:** "From React to Lit: A Component Migration Guide"
**Target keywords:** "React to web components," "replace React with Lit"

Focus on the component authoring mental model shift, not the full-framework migration.
This page serves developers who want to adopt Lit gradually (e.g. in an existing app
via custom elements) not just those migrating to Litro wholesale.

| React | Lit | Notes |
|-------|-----|-------|
| `useState` | `@state()` / `static properties` | Reactive state |
| `useEffect` | `updated()` / `connectedCallback()` | Lifecycle |
| Props / JSX attributes | `@property()` / `static override properties` | Observed attributes |
| Context | `@lit/context` controller | Different API |
| `dangerouslySetInnerHTML` | `unsafeHTML()` from `lit/directives/` | — |
| CSS Modules | `static styles = css\`...\`` | Shadow DOM scoping |
| `React.memo` | N/A — Lit's update batching handles this | — |

---

## Feature Comparison Tables

Used across comparison pages. Keep tables accurate and updated as both frameworks evolve.

### Litro vs Next.js

| Feature | Next.js | Litro |
|---------|---------|-------|
| Component model | React (JSX) | Lit (web components) |
| File-based routing | ✓ | ✓ |
| SSR | ✓ React Server Components | ✓ Declarative Shadow DOM streaming |
| SSG | ✓ | ✓ |
| Data fetching | `fetch` in Server Components | `definePageData()` |
| API routes | `app/api/route.ts` | `server/api/*.ts` (H3) |
| Client routing | Next Router | LitroRouter (URLPattern) |
| Approx. Hello World JS (gzipped) | ~90kB | ~8kB |
| Server engine | custom | Nitro (same as Nuxt) |
| Virtual DOM | ✓ | — |
| W3C standard components | — | ✓ |
| TypeScript | ✓ | ✓ |
| License | MIT | Apache 2.0 |

### Litro vs Nuxt.js

| Feature | Nuxt.js | Litro |
|---------|---------|-------|
| Component model | Vue 3 (SFC) | Lit (web components) |
| File-based routing | ✓ | ✓ |
| SSR | ✓ | ✓ Declarative Shadow DOM |
| SSG | ✓ | ✓ |
| Data fetching | `useFetch` / `useAsyncData` | `definePageData()` |
| API routes | `server/api/*.ts` (H3) | `server/api/*.ts` (H3) — identical |
| Server engine | Nitro | Nitro — identical |
| Deployment adapters | All Nitro presets | All Nitro presets — identical |
| Client routing | vue-router | LitroRouter (URLPattern) |
| Approx. Hello World JS (gzipped) | ~60kB | ~8kB |
| Virtual DOM | ✓ (Vue) | — |
| W3C standard components | — | ✓ |

### Litro vs Enhance

| Feature | Enhance | Litro |
|---------|---------|-------|
| Component format | HTML-first SFCs | Lit class components |
| Server rendering | ✓ | ✓ Declarative Shadow DOM |
| Client routing | — (MPA by default) | ✓ LitroRouter |
| Server | Begin cloud / Arc | Nitro (Vercel, Cloudflare, AWS, etc.) |
| Deployment flexibility | Begin-centric | All Nitro presets |
| JS-by-default | Opt-in | Opt-in |
| Lit ecosystem compatible | — | ✓ (Shoelace, etc.) |
| TypeScript | partial | ✓ |

---

## Implementation Notes

### New page files

```
docs/pages/compare/nextjs.ts
docs/pages/compare/nuxt.ts
docs/pages/compare/enhance.ts
docs/pages/why-web-components.ts
```

Migration guides go in docs content:

```
docs/content/docs/migrate/from-nextjs.md
docs/content/docs/migrate/from-nuxt.md
docs/content/docs/migrate/from-react.md
```

The existing `docs/pages/docs/[...slug].ts` catch-all serves migration guides automatically.

### Comparison page component

Comparison pages (`/compare/*`) are not standard doc pages — they need a distinct layout
(two-column code comparisons, feature tables with styled cells). Create a new page
component type or extend the existing layout with a `comparison` flag in `routeMeta`.

### Sitemap

Add all new `/compare/*` and `/why-web-components` routes to the static list in
`sitemap.xml.ts` with priority `0.8`. Migration guide routes (`/docs/migrate/*`) are
served by the `[...slug]` catch-all and should also be added explicitly to the sitemap.

### JSON-LD

- `/compare/*` pages: `WebPage` schema with `about` listing both frameworks (see PRD-1 §1d)
- `/why-web-components`: `Article` schema
- `/docs/migrate/*` pages: `TechArticle` schema (handled by the `[...slug]` catch-all if
  it already applies `TechArticle` to all doc pages)

### Internal linking

- Homepage features section: add links to `/compare/nextjs`, `/compare/nuxt`,
  `/why-web-components`
- `/docs/introduction`: add "Coming from another framework?" section linking to all three
  comparison pages and `/why-web-components`
- Blog posts (PRD-3): each post links back to the most relevant comparison page

---

## SEO Copywriting Guidelines

- **Lead with their vocabulary.** Use `getServerSideProps`, `vue-router`, `<NuxtLink>`, etc.
  Developers searching for these terms will find these pages.
- **Don't sell — show.** Every claim backed by a code example or a measurable number.
- **Be honest about trade-offs.** Naming the downsides (smaller ecosystem, different DX)
  builds trust and reduces bounce rate from developers who feel misled.
- **Keywords in H2 and H3.** These headings carry ranking weight. Use target phrases
  naturally — don't stuff.
- **No introductory throat-clearing.** Start with the most relevant content. Search visitors
  will not scroll through two paragraphs of "In this article, we will explore..."

---

## Acceptance Criteria

- [ ] All 4 new page files created and rendering at their routes
- [ ] All 3 migration guides exist in `docs/content/docs/migrate/`
- [ ] Each page has unique `<title>` and `<meta description>` ≥ 120 characters
- [ ] JSON-LD on all new pages (correct schema type per page)
- [ ] Feature comparison tables render correctly on all `/compare/*` pages
- [ ] Side-by-side code examples are syntax-highlighted
- [ ] All new routes in `sitemap.xml` with priority `0.8`
- [ ] Internal links from homepage and `/docs/introduction` to comparison pages
- [ ] `/why-web-components` includes honest trade-offs section
- [ ] `/compare/nuxt` prominently features the shared Nitro foundation
- [ ] Mobile-responsive at 375px (tables scroll horizontally if needed)
