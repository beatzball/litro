# PRD-1: Technical SEO Foundations

**Priority:** P0
**Effort:** 1–2 days
**Phase:** 1 (run in parallel with PRD-4 and first two blog posts)
**Dependencies:** None — start immediately

---

## Problem

The site has a basic SEO utility (`docs/src/seo.ts`) but is missing several technical signals
that search engines use to understand, rank, and display developer-tool pages:

- No JSON-LD structured data — search engines get no machine-readable context about what
  Litro is or what type of content each page contains
- Sitemap is a hardcoded static list — does not include dynamically published blog posts;
  will silently fall out of sync as content is added
- No RSS feed — blog content is undiscoverable by aggregators and newsletter curators
- robots.txt has not been verified since the site went live
- Blog tag pages may cause thin-content duplicate penalties
- No Google Search Console setup — zero crawl error visibility

---

## Goals

1. Every page emits JSON-LD structured data appropriate to its type.
2. `/sitemap.xml` is generated dynamically and always reflects actual published content.
3. `/blog/rss.xml` exists and is linked from the blog and from `<head>`.
4. robots.txt is correct and points to the sitemap.
5. Blog tag pages do not cause duplicate content penalties.
6. Site is ready for Google Search Console submission.

---

## Out of Scope

- Per-page dynamically generated OG images (defer — requires infrastructure work)
- Internationalization / hreflang

---

## Detailed Requirements

### 1. JSON-LD Structured Data

Add JSON-LD `<script type="application/ld+json">` to every page type.

#### 1a. Homepage (`/`)

Schema type: `SoftwareApplication`

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Litro",
  "description": "A fullstack web framework combining Lit web components, Nitro server, and Vite. File-based routing, streaming SSR, SSG, and Declarative Shadow DOM.",
  "url": "https://litro.dev",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Node.js",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "author": {
    "@type": "Organization",
    "name": "beatzball",
    "url": "https://github.com/beatzball"
  },
  "license": "https://www.apache.org/licenses/LICENSE-2.0",
  "codeRepository": "https://github.com/beatzball/litro",
  "programmingLanguage": ["TypeScript", "JavaScript"]
}
```

#### 1b. Doc pages (`/docs/[...slug]`)

Schema type: `TechArticle`

```json
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": "<page title from frontmatter>",
  "description": "<page description from frontmatter>",
  "url": "https://litro.dev/docs/<slug>",
  "author": {
    "@type": "Organization",
    "name": "beatzball"
  },
  "isPartOf": {
    "@type": "WebSite",
    "name": "Litro Documentation",
    "url": "https://litro.dev"
  }
}
```

#### 1c. Blog posts (`/blog/[slug]`)

Schema type: `BlogPosting`

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "<post title>",
  "description": "<post description>",
  "datePublished": "<date from frontmatter, ISO 8601>",
  "url": "https://litro.dev/blog/<slug>",
  "author": {
    "@type": "Organization",
    "name": "beatzball"
  },
  "keywords": ["<tags from frontmatter, comma-separated>"]
}
```

#### 1d. Comparison pages (`/compare/*`)

Schema type: `WebPage` with `about` entities for both frameworks compared.

```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Litro vs Next.js",
  "description": "...",
  "url": "https://litro.dev/compare/nextjs",
  "about": [
    { "@type": "SoftwareApplication", "name": "Litro", "url": "https://litro.dev" },
    { "@type": "SoftwareApplication", "name": "Next.js", "url": "https://nextjs.org" }
  ]
}
```

#### Implementation note

Add a `buildJsonLd(data: object): string` helper in `docs/src/seo.ts`:

```typescript
export function buildJsonLd(data: object): string {
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}
```

Each page's `definePageData` constructs the appropriate schema and passes it through
`routeMeta.head`. Comparison pages use static `routeMeta` exports since their JSON-LD
does not depend on dynamic content.

---

### 2. Dynamic Sitemap

**Current problem:** `/docs/pages/sitemap.xml.ts` is a hardcoded list. Blog posts published
to `/docs/content/blog/` are never reflected in the sitemap unless manually added.

**Fix:** Rewrite `sitemap.xml.ts` as an H3 event handler that:

1. Fetches all blog posts via `getPosts()` (same as `blog/index.ts`) and includes each
   post URL with its frontmatter `date` as `<lastmod>`
2. Keeps the static doc routes as a hardcoded list (these are stable and version-controlled)
3. Concatenates and emits the full XML with correct `Content-Type: application/xml`

Priority tiers:
- `/` → `1.0`
- `/compare/*`, `/why-web-components`, `/blog`, core docs → `0.8`
- Individual blog posts → `0.7`
- Migration guides, package pages → `0.6`

Change frequency:
- Homepage → `weekly`
- Blog posts → `monthly` (after initial publish; they don't change)
- Docs pages → `monthly`

When a new comparison page is added (PRD-2), add it to the static list in `sitemap.xml.ts`.
Blog posts are the only routes that need dynamic generation — everything else is code-deployed.

---

### 3. RSS Feed

**New file:** `docs/pages/blog/rss.xml.ts`

An H3 event handler that generates a valid RSS 2.0 feed for all blog posts, ordered by
date descending.

Required RSS fields per item:
- `<title>` — post title
- `<link>` — full URL (`${SITE_URL}/blog/${slug}`)
- `<description>` — post description from frontmatter
- `<pubDate>` — RFC 822 date format
- `<guid isPermaLink="true">` — same as `<link>`

Channel-level fields:
- `<title>` — "Litro Blog"
- `<link>` — `https://litro.dev/blog`
- `<description>` — "Technical articles from the Litro team"
- `<language>` — `en`
- `<lastBuildDate>` — date of the most recent post

Add `<link rel="alternate" type="application/rss+xml" title="Litro Blog" href="/blog/rss.xml">`
to the `<head>` on the `/blog` page and in `starlightHead` for global discovery.

Add `/blog/rss.xml` to the sitemap (priority `0.5`) so crawlers find it.

---

### 4. Per-Page Title and Description Audit

Every doc `.md` file must have a `description` frontmatter field (120–160 characters,
keyword-rich, benefit-oriented). Audit all 18 files in `docs/content/docs/`.

Files likely missing `description` (verify and add):

| File | Suggested description |
|------|----------------------|
| `introduction.md` | "Litro is a fullstack web framework built on Lit, Nitro, and Vite. File-based routing, streaming SSR, SSG, and no virtual DOM overhead." |
| `getting-started.md` | "Scaffold your first Litro app in under a minute. Supports SSR, SSG, and static deployments with a single command." |
| `core-concepts/ssr.md` | "How Litro delivers server-side rendering via Declarative Shadow DOM — the technique that makes Lit components fully crawlable by search engines." |
| `core-concepts/routing.md` | "File-based routing in Litro: map files in pages/ to URLs automatically, with dynamic segments, catch-alls, and optional parameters." |
| `core-concepts/data-fetching.md` | "Fetch server-side data in Litro using definePageData(). Results are serialized to HTML and available on the client without an extra network request." |
| `core-concepts/client-router.md` | "LitroRouter: a zero-dependency client-side router for Lit web components, built on the native URLPattern API." |
| `ssg.md` | "Prerender your Litro app to static HTML at build time. Compatible with GitHub Pages, Cloudflare Pages, and any static host." |

---

### 5. Blog Tag Pages — noindex

`/blog/tags/[tag]` pages have thin, duplicated content (a subset of the posts already on
`/blog`). They should not be indexed.

Add `<meta name="robots" content="noindex, follow">` to the tag page's `routeMeta.head`.
The `follow` directive ensures any links on the page still pass crawl credit.

---

### 6. robots.txt

Verify `docs/public/robots.txt` contains:

```
User-agent: *
Allow: /

Sitemap: https://litro.dev/sitemap.xml
```

The `Sitemap:` directive is the key addition. Crawlers that land on `robots.txt` before
discovering the sitemap will find it immediately.

If the current file disallows `/content/` (raw Markdown), that is acceptable — raw markdown
files are not indexable content. Do not disallow anything else.

---

### 7. Google Search Console

After deploying PRD-1:

1. Add `litro.dev` as a property in Google Search Console
2. Verify ownership via DNS TXT record (preferred) or HTML file
3. Submit `https://litro.dev/sitemap.xml`
4. Use the URL Inspection tool to request indexing for:
   - `/` (homepage)
   - `/docs/introduction`
   - `/compare/nextjs` and `/compare/nuxt` (once PRD-2 is deployed)
   - The Shadow DOM SEO blog post (once published)

Check weekly for the first month: Coverage report for crawl errors, Core Web Vitals report
for any pages flagged as "Poor."

---

## Acceptance Criteria

- [ ] JSON-LD appears in `<head>` on `/`, `/docs/*`, `/blog/*`, and `/compare/*` pages
- [ ] `buildJsonLd()` helper exists in `docs/src/seo.ts`
- [ ] `/sitemap.xml` includes all blog posts with `<lastmod>` dates matching frontmatter
- [ ] `/blog/rss.xml` returns valid RSS 2.0 with all posts
- [ ] `<link rel="alternate" type="application/rss+xml">` in `<head>` on `/blog` page
- [ ] All 18 doc `.md` files have `description` frontmatter ≥ 80 characters
- [ ] Blog tag pages have `<meta name="robots" content="noindex, follow">`
- [ ] `robots.txt` contains `Sitemap: https://litro.dev/sitemap.xml`
- [ ] Site submitted to Google Search Console with sitemap
