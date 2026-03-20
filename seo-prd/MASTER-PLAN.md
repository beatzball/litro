# Litro SEO — Master Plan

## Goal

Establish litro.dev as a discoverable, authoritative resource for developers searching for
SSR/SSG frameworks, Next.js / Nuxt.js alternatives, and web components tooling. All work
targets organic search traffic from developers.

## Current State (as of 2026-03-18)

- SEO utility exists (`docs/src/seo.ts`) — meta, OG, canonical, Twitter cards
- Sitemap at `/sitemap.xml` — static hardcoded list, does NOT include blog posts dynamically
- Blog system exists but has 1 post ("Welcome to Litro")
- No JSON-LD structured data on any page
- No comparison or migration pages
- No Enhance.dev comparison (closest competitor in the web components SSR space)
- `og-default.png` shared across all pages — no per-page differentiation
- npm package keywords not SEO-optimized
- No RSS feed for the blog
- GitHub repo topics/tags not set for discoverability
- Lit ecosystem (Discord, awesome-lit) not engaged

---

## Five PRDs

| PRD | Title | Priority | Effort |
|-----|-------|----------|--------|
| [PRD-1](./PRD-1-technical-seo.md) | Technical SEO Foundations | P0 | 1–2 days |
| [PRD-2](./PRD-2-comparison-pages.md) | Comparison & Migration Pages | P0 | 3–5 days |
| [PRD-3](./PRD-3-blog-content.md) | Blog Content & Technical Articles | P1 | ongoing |
| [PRD-4](./PRD-4-npm-discovery.md) | npm Package & Developer Discovery | P1 | 0.5 days |
| [PRD-5](./PRD-5-community-distribution.md) | Community & Content Distribution | P2 | ongoing |

---

## Phases and Parallelization

### Phase 1 — Foundation (all tracks run in parallel, target: 1 week)

```
Track A: PRD-1 — Technical SEO
  - JSON-LD on homepage, docs pages, blog posts
  - Dynamic sitemap (includes blog posts with <lastmod>)
  - RSS feed for the blog (/blog/rss.xml)
  - robots.txt Sitemap: directive
  - Blog tag pages → noindex

Track B: PRD-4 — npm Package & GitHub Discovery
  - Add keywords to package.json for all 3 packages
  - Rewrite package descriptions with comparison hooks
  - Set GitHub repo topics/tags
  - Root README.md as a proper landing page

Track C: PRD-3 Posts 1 & 2 — First Blog Posts (writing, no deploy dependency)
  - Post 1: Shadow DOM & SEO (removes the #1 objection to web components)
  - Post 2: Why We Built Litro (manifesto/HN material)
```

No dependencies between A, B, and C. All three can be executed simultaneously.

---

### Phase 2 — Comparison Content (start after Phase 1 deploys, target: weeks 2–3)

```
Track D: PRD-2 — Comparison & Migration Pages
  - /compare/nextjs (highest search volume)
  - /compare/nuxt (shared Nitro foundation angle)
  - /compare/enhance (nearest web-components competitor)
  - /why-web-components (philosophical anchor page)
  - /docs/migrate/from-nextjs
  - /docs/migrate/from-nuxt
  - /docs/migrate/from-react

Track E: PRD-3 Posts 3–5 — More Blog Content
  - Post 3: File-based routing for Next.js devs
  - Post 4: Streaming SSR with DSD (technical depth)
  - Post 5: Blog tutorial with litro:content
```

Phase 2 does not depend on Phase 1 for writing, but Phase 1 (JSON-LD, dynamic sitemap)
should be deployed before the new pages go live so they are immediately indexed correctly.

---

### Phase 3 — Distribution (after 3+ blog posts are live, target: weeks 4–6)

```
Track F: PRD-5 — Community Distribution
  - Submit sitemap to Google Search Console
  - Submit to Lit Discord #showcase
  - PR to awesome-lit and awesome-web-components GitHub lists
  - Dev.to cross-posts for Posts 1–5 (canonical URLs)
  - r/webdev introduction post
  - Show HN submission
  - Remaining blog posts (Posts 6–8): Nitro adapters, LitroRouter, performance benchmarks
```

Performance benchmarks are intentionally last — publish only after the framework is
battle-tested and numbers are reproducible and defensible.

---

## Priority Reorder vs. Original Document

The following adjustments are made from the original AI-suggested plan:

| Original suggestion | Decision |
|--------------------|----------|
| Performance benchmarks early | Pushed to Phase 3 — risk of scrutiny before framework is stable |
| Separate `/for-react-developers`, `/for-nextjs-developers` pages | Consolidated into `/compare/*` pages — avoids thin/duplicate content |
| Topic cluster architecture restructuring | Removed — consulting-speak; existing doc structure is fine |
| "FAST web components framework" keyword | Removed — FAST is a specific Microsoft library; targeting it misleads |
| "No virtual DOM" as primary keyword | Demoted to supporting copy, not headline keyword |
| Twitter/X in Phase 1 | Moved to Phase 3 — low ROI until content base exists |
| Roundup article outreach | Deferred — too early; authors won't take a brand-new framework seriously |
| `/sdk` and `/cli` pages | Removed — CLI docs already exist |

Additions not in original document:
- RSS feed for blog
- Enhance.dev comparison page
- GitHub repo health (topics, description)
- Lit ecosystem engagement (Discord, awesome-lit) as Week 1 activity
- "Standards will outlast frameworks" as the core philosophical narrative

---

## Success Metrics

| Metric | Baseline | 90-day Target |
|--------|----------|---------------|
| Google Search Console impressions | 0 (not submitted) | >5,000/mo |
| Organic clicks | ~0 | >200/mo |
| Indexed pages | unknown | 30+ |
| Comparison page rankings | none | Top 20 for 3+ target keywords |
| npm weekly downloads (@beatzball/litro) | check current | growing MoM |
| Blog posts published | 1 | 8+ |
| GitHub stars | check current | 100+ |
| Backlinks (non-trivial) | ~0 | 5+ |

---

## Quick Wins (implement first — high signal, low effort)

1. Add JSON-LD `SoftwareApplication` schema to homepage — 30 min
2. Make sitemap dynamic (include blog posts) — 1 hr
3. Add RSS feed at `/blog/rss.xml` — 1 hr
4. Add npm keywords to all 3 `package.json` files — 15 min
5. Set GitHub repo topics: `lit`, `web-components`, `ssr`, `ssg`, `nitro`, `vite` — 5 min
6. Submit sitemap to Google Search Console — 15 min
7. Post in Lit Discord `#showcase` — 15 min
