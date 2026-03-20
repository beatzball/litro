---
'@beatzball/litro-docs': minor
---

feat(docs): SEO Phase 2 — comparison pages, migration guides, blog posts 3–5

Track D (PRD-2 — Comparison & Migration Pages):
- `/compare/nextjs` — Litro vs Next.js with feature table and side-by-side code
- `/compare/nuxt` — Litro vs Nuxt.js with shared Nitro foundation callout
- `/compare/enhance` — Litro vs Enhance; honest trade-offs on both sides
- `/why-web-components` — philosophical anchor page; standards longevity argument
- `docs/content/docs/migrate/from-nextjs.md` — step-by-step Next.js migration guide
- `docs/content/docs/migrate/from-nuxt.md` — Nuxt migration guide (H3 routes copy verbatim)
- `docs/content/docs/migrate/from-react.md` — React to Lit component migration guide

Track E (PRD-3 Posts 3–5):
- Post 3: File-Based Routing with Lit — A Next.js Developer's Guide
- Post 4: Streaming SSR with Declarative Shadow DOM — How It Works
- Post 5: Building a Blog with Litro's Content Layer

Supporting changes:
- `sitemap.xml.ts` — new compare/why/migrate routes at priority 0.9/0.8
- `starlight.config.js` — "Migrate" section added to docs sidebar
- `docs/content/docs/introduction.md` — "Coming from another framework?" section linking to all comparison pages and migration guides
- `docs/pages/index.ts` — comparison links added below CTA buttons
- `docs/nitro.config.ts` — explicit prerender routes for compare/* and why-web-components
- `docs/src/compare-styles.ts` — shared Lit CSS for all comparison page components

Prerendered routes: 52 total (up from 33). Sitemap updated.
