---
'@beatzball/litro': patch
---

feat(docs): SEO Phase 2 — comparison pages, migration guides, blog posts 3–5

Track D (PRD-2 — Comparison & Migration Pages):
- `/compare/nextjs` — Litro vs Next.js with feature table and side-by-side code
- `/compare/nuxt` — Litro vs Nuxt.js with shared Nitro foundation callout
- `/compare/enhance` — Litro vs Enhance; trade-offs and when each fits
- `/why-web-components` — anchor page on web standards longevity
- `docs/content/docs/migrate/from-nextjs.md` — step-by-step Next.js migration guide
- `docs/content/docs/migrate/from-nuxt.md` — Nuxt migration guide (H3 routes copy verbatim)
- `docs/content/docs/migrate/from-react.md` — React to Lit component migration guide

Track E (PRD-3 Posts 3–5):
- Post 3: File-Based Routing with Lit — A Next.js Developer's Guide
- Post 4: Streaming SSR with Declarative Shadow DOM — How It Works
- Post 5: Building a Blog with Litro's Content Layer

Refactor: compare pages moved to Markdown content files
- `docs/content/compare/{nextjs,nuxt,enhance}.md` — content as Markdown with raw HTML blocks
- `docs/content/why-web-components.md` — content as Markdown
- `docs/pages/compare/[...slug].ts` — new catch-all handler reading from content layer
- Deleted `docs/pages/compare/{nextjs,nuxt,enhance}.ts` (content was inline in Lit templates)

Content parser improvement (framework):
- Added `rehype-raw` to the content parser pipeline so that HTML blocks containing blank
  lines (e.g. side-by-side code sections) are correctly re-parsed after remark's MDAST→HAST
  step rather than being split at blank line boundaries

Supporting changes:
- `docs/src/compare-styles.ts` — `.btn-primary`/`.btn-secondary` styles for markdown CTAs
- `sitemap.xml.ts` — new compare/why/migrate routes at priority 0.9/0.8
- `starlight.config.js` — "Migrate" section added to docs sidebar
- `docs/content/docs/introduction.md` — "Coming from another framework?" section
- `docs/pages/index.ts` — "Why Web Components?" blurb + "How Litro Compares" vs widget (Litro logo / vs / Next.js, Nuxt.js, Enhance stacked links) added after feature cards
- `docs/nitro.config.ts` — explicit prerender routes for compare/* and why-web-components

Prerendered routes: 52 total (up from 33). Sitemap updated.
