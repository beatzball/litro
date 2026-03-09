# create-litro

Scaffold a new [Litro](https://github.com/beatzball/litro) app.

## Usage

```bash
npm create @beatzball/litro@latest my-app
# or
pnpm create @beatzball/litro my-app
# or
yarn create @beatzball/litro my-app
```

Follow the interactive prompts to choose a recipe and rendering mode, or pass flags directly to skip them:

```bash
# Fullstack SSR app (default)
npm create @beatzball/litro@latest my-app --recipe fullstack --mode ssr

# 11ty-compatible blog (SSG or SSR)
npm create @beatzball/litro@latest my-app --recipe 11ty-blog --mode ssg

# List all available recipes
npm create @beatzball/litro@latest -- --list-recipes
```

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

## After scaffolding

```bash
cd my-app
pnpm install
pnpm dev      # start dev server on http://localhost:3030
```

For static site generation:

```bash
LITRO_MODE=static pnpm build   # prerenders all routes to HTML
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
