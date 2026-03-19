# PRD-4: npm Package & Developer Discovery

**Priority:** P1
**Effort:** 0.5 days
**Phase:** 1 (run in parallel with PRD-1 and first two blog posts)
**Dependencies:** None — purely additive changes, no code impact

---

## Problem

Developers discover JavaScript tools through two channels before ever visiting a project
website: npm search and GitHub. Litro is currently under-optimized for both:

- `keywords` arrays in all three `package.json` files are minimal or missing
- `description` fields are short and contain no comparison hooks
- `packages/framework/README.md` is 46 lines with no Hello World example, no comparison
  context, and no answer to the "will this hurt my SEO?" concern
- The GitHub repository has no topics/tags set — it does not appear in GitHub's "Explore"
  results for `web-components`, `ssr`, `lit`, or `nitro`
- The monorepo root `README.md` (GitHub landing page) may not exist or may be sparse

These are free wins that take effect within 24–48 hours of the next publish/push.

---

## Goals

1. All three packages appear in npm search results for target keywords.
2. A developer landing on any npm package page can understand what Litro solves and
   get started in under 60 seconds.
3. The GitHub repository appears in Explore results for `lit`, `web-components`, `ssr`,
   `ssg`, and `nitro`.
4. The root README serves as a compelling landing page for developers who find the
   repository directly.

---

## Changes Required

### 1. `packages/framework/package.json`

**Updated description:**

```json
"description": "Fullstack web framework for Lit components — file-based routing, streaming SSR, SSG, and Nitro deployment adapters. A standards-based Next.js / Nuxt.js alternative."
```

**Updated keywords:**

```json
"keywords": [
  "lit",
  "web-components",
  "ssr",
  "ssg",
  "static-site-generation",
  "server-side-rendering",
  "fullstack",
  "framework",
  "nitro",
  "vite",
  "file-based-routing",
  "declarative-shadow-dom",
  "nextjs-alternative",
  "nuxt-alternative",
  "typescript"
]
```

---

### 2. `packages/litro-router/package.json`

**Updated description:**

```json
"description": "Client-side router for Lit web components. Built on the native URLPattern API. Zero dependencies. Works standalone or as part of the Litro framework."
```

**Updated keywords:**

```json
"keywords": [
  "router",
  "client-side-routing",
  "urlpattern",
  "web-components",
  "lit",
  "lit-element",
  "spa",
  "history-api",
  "custom-elements",
  "zero-dependencies",
  "typescript"
]
```

---

### 3. `packages/create-litro/package.json`

**Updated description:**

```json
"description": "Scaffold a new Litro app — fullstack SSR, Markdown blog, or docs site. Built on Lit web components and Nitro server."
```

**Updated keywords:**

```json
"keywords": [
  "create",
  "scaffold",
  "cli",
  "lit",
  "web-components",
  "fullstack",
  "ssr",
  "ssg",
  "nitro",
  "starter",
  "template",
  "typescript"
]
```

---

### 4. `packages/framework/README.md` — Expand

The current 46-line README should be expanded with three additions:

#### Addition 1: Hello World Example

Place after the features list, before any package table.

```typescript
// pages/index.ts
import { LitroPage, definePageData, html } from '@beatzball/litro/runtime';
import { customElement } from 'lit/decorators.js';

const pageData = definePageData(async () => ({
  message: 'Hello from the server!',
}));

@customElement('page-index')
export default class IndexPage extends LitroPage {
  override render() {
    const data = this.serverData as typeof pageData | null;
    return html`<h1>${data?.message}</h1>`;
  }
}
```

#### Addition 2: How It Compares

```markdown
## How It Compares

|                    | Litro       | Next.js     | Nuxt.js     |
|--------------------|-------------|-------------|-------------|
| Component model    | Lit         | React       | Vue         |
| File-based routing | ✓           | ✓           | ✓           |
| SSR / SSG          | ✓           | ✓           | ✓           |
| Server engine      | Nitro       | custom      | Nitro       |
| Hello World JS     | ~8kB        | ~90kB       | ~60kB       |
| Virtual DOM        | —           | ✓           | ✓           |
| W3C components     | ✓           | —           | —           |

[Full comparison →](https://litro.dev/compare/nextjs)
```

#### Addition 3: SEO Callout

```markdown
## SEO

Litro renders all pages server-side via Declarative Shadow DOM before sending HTML to the
browser. Search engines receive fully-rendered content — the same approach used by Next.js
and Nuxt.js. Client-side-only web components have SEO limitations; Litro's SSR eliminates
them by default.

[How this works →](https://litro.dev/blog/shadow-dom-seo)
```

(The blog link can be added once Post 1 from PRD-3 is published.)

---

### 5. Root `README.md`

The monorepo root `README.md` is the GitHub landing page for the repository. It should be
short, focused, and link out to the docs site rather than duplicating it.

Required sections:

1. **One-sentence pitch** — "Litro is a fullstack web framework built on Lit web components,
   Nitro server, and Vite."
2. **How It Compares table** — same as the framework README addition above
3. **Quick start** — `npm create @beatzball/litro@latest`
4. **Links** — Documentation, Packages, Playground, Contributing
5. **Badges** — License, npm version (for `@beatzball/litro`), build status if CI exists

Keep the root README under 100 lines. Its job is to orient a first-time visitor and route
them to the right place, not to be a documentation mirror.

---

### 6. GitHub Repository Topics

Set via the repository Settings page (or via the GitHub API). Target topics:

```
lit
web-components
ssr
ssg
server-side-rendering
nitro
vite
typescript
fullstack
framework
```

GitHub's Explore feature surfaces repositories tagged with these topics to developers
who have starred or contributed to similar repos. This is free passive discovery.

---

## npm Search Ranking Notes

npm ranks packages by: keyword match in `keywords` array (highest weight), keyword in
`description` (medium), download count (trust signal), and recency.

The `keywords` and `description` changes take effect within 24 hours of the next
`npm publish`. They cost nothing and require zero code changes.

---

## Acceptance Criteria

- [ ] All 3 `package.json` files have updated `description` and `keywords`
- [ ] `packages/framework/README.md` includes Hello World example, comparison table, and
      SEO callout
- [ ] Root `README.md` exists with pitch, comparison table, quick start, and links
- [ ] GitHub repository topics set (10 topics listed above)
- [ ] Changes published in the next npm release for all 3 packages
- [ ] npm search for "lit ssr framework" returns `@beatzball/litro` (verify 24–48h after publish)
