# create-litro

Scaffold a new [Litro](https://github.com/beatzball/litro) app.

## Usage

```bash
# npm
npm create @beatzball/litro@latest my-app

# pnpm
pnpm create @beatzball/litro my-app

# yarn
yarn create @beatzball/litro my-app

# bun
bun create @beatzball/litro my-app

# deno
deno init --npm @beatzball/litro my-app
```

Follow the interactive prompts to choose a recipe, rendering mode, and framework adapter, or pass flags directly to skip them:

```bash
# Fullstack SSR app with Lit (default)
npm create @beatzball/litro@latest my-app -- --recipe fullstack --mode ssr

# Fullstack SSR app with FAST Element
npm create @beatzball/litro@latest my-app -- --recipe fullstack --mode ssr --adapter fast

# Fullstack SSR app with Elena (light DOM)
npm create @beatzball/litro@latest my-app -- --recipe fullstack --mode ssr --adapter elena

# Starlight docs + blog, static output
npm create @beatzball/litro@latest my-docs -- --recipe starlight

# List all available recipes
npm create @beatzball/litro@latest -- --list-recipes
```

### `--adapter` flag

Choose the web component framework for your project:

| Value | Framework | DOM Model | SSR |
|---|---|---|---|
| `lit` (default) | Lit 3 | Shadow DOM | Declarative Shadow DOM |
| `fast` | FAST Element 2 | Shadow DOM | Declarative Shadow DOM |
| `elena` | Elena | Light DOM | Direct rendering |

Omitting `--adapter` defaults to `lit`. The interactive wizard also prompts for adapter selection.

## Recipes

### `fullstack` (default)

A fullstack Lit + Nitro app with file-based routing and server-side rendering.

Generated app includes:
- `pages/index.ts` — home page with `definePageData()` server fetching
- `pages/blog/index.ts` — blog listing page
- `pages/blog/[slug].ts` — dynamic post page with `generateRoutes()` for SSG
- `server/api/hello.ts` — JSON API endpoint
- Config files: `nitro.config.ts`, `vite.config.ts`, `tsconfig.json`

### `11ty-blog`

A Markdown blog using the `litro:content` content layer, compatible with the 11ty data cascade format (frontmatter, `.11tydata.json` directory data, `_data/metadata.js` global data). Supports both SSR (dev server) and SSG (prerender to static HTML).

Generated app includes:
- `content/blog/` — Markdown posts with YAML frontmatter
- `content/_data/metadata.js` — global site metadata
- `pages/index.ts` — home page showing recent posts
- `pages/blog/index.ts` — post listing with all posts
- `pages/blog/[slug].ts` — individual post page with `generateRoutes()`
- `pages/tags/[tag].ts` — tag-filtered post listing
- `server/api/posts.ts` — JSON API for posts (optional `?tag=` filter)
- `litro.recipe.json` — written to the project root so the content plugin knows where to find posts

### `starlight`

An Astro Starlight-inspired docs + blog site. SSG-only (no `--mode` flag needed).

Generated app includes:
- `content/docs/*.md` — documentation pages with sidebar ordering frontmatter
- `content/blog/*.md` — blog posts with title, date, tags, description
- Layout components: `<starlight-page>`, `<starlight-header>`, `<starlight-sidebar>`, `<starlight-toc>`
- UI components: `<litro-card>`, `<litro-card-grid>`, `<litro-badge>`, `<litro-aside>`, `<litro-tabs>`
- [Shoelace](https://shoelace.style) web components available (`<sl-*>` names reserved for Shoelace; Litro's own primitives use `litro-*`)
- `server/starlight.config.js` — site title, nav links, sidebar groups
- `public/styles/starlight.css` — full `--sl-*` CSS token layer with dark/light mode
- Syntax highlighting via `highlight.js` (fire theme, applied at SSG build time)

## After scaffolding

```bash
cd my-app
pnpm install
pnpm dev      # start dev server on http://localhost:3000
pnpm build    # production build
pnpm preview  # preview the production build
```

For static site generation (SSG):

```bash
LITRO_MODE=static pnpm build   # prerenders all routes to HTML → dist/static/
```

## The `litro:content` virtual module

The `11ty-blog` recipe uses `litro:content`, a virtual module provided by the Litro framework:

```typescript
import { getPosts, getPost, getTags, getGlobalData } from 'litro:content';

// In a page file:
const posts = await getPosts({ tag: 'tutorial', limit: 5 });
const post  = await getPost('hello-world');
const tags  = await getTags();
const meta  = await getGlobalData();  // reads _data/metadata.js
```

The content layer reads Markdown files from the directory specified in `litro.recipe.json` (`contentDir`). Posts are sorted by date descending. Draft posts (frontmatter `draft: true`) are excluded by default.

Add `/// <reference types="litro/content/env" />` (or the equivalent `tsconfig.json` entry) for TypeScript type support.

## License

Apache License 2.0 — Copyright 2026 beatzball.
