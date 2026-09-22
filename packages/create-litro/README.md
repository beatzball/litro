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

# Fullstack SSR app with Elena (light DOM)
npm create @beatzball/litro@latest my-app -- --recipe fullstack --mode ssr --adapter elena

# Starlight docs + blog with FAST Element
npm create @beatzball/litro@latest my-docs -- --recipe starlight --adapter fast

# Starlight docs + blog, static output
npm create @beatzball/litro@latest my-docs -- --recipe starlight

# Landing page + starlight docs, no blog
npm create @beatzball/litro@latest my-site -- --recipe supernova --no-blog

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

Omitting `--adapter` defaults to `lit`.

Not every recipe supports every adapter. A recipe declares what it can really
produce, and asking for anything else fails before a single file is written:

| Recipe | Adapters |
|---|---|
| `fullstack` | `lit`, `elena` |
| `11ty-blog` | `lit` |
| `starlight` | `lit`, `fast`, `elena` |
| `supernova` | `lit` |

```
$ npm create @beatzball/litro@latest my-site -- --recipe supernova --adapter fast

  The 'supernova' recipe supports the 'lit' adapter today. Re-run without
  --adapter, or pick a recipe that supports 'fast'.
```

The interactive wizard offers only the adapters the chosen recipe supports, and
does not ask at all when there is just one.

### Recipe options

A recipe may ask its own questions after the adapter is chosen. The answers are
recorded in the scaffolded app's `litro.recipe.json` under `options`.

A flag answers a question without being asked, for scripts and CI:

| Flag | Answers |
|---|---|
| `--blog` / `--no-blog` | `Include a blog?` |

A flag for a question the chosen recipe does not ask is an error, not a
silently ignored argument.

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

### `supernova`

The `starlight` recipe with a product landing page in front of it. SSG-only (no `--mode` flag needed). It sets `extends: 'starlight'`, so the starlight template is copied in first and this recipe's files are written on top.

It asks one question, `Include a blog?`, answered by `--blog` / `--no-blog`. Declining removes `content/blog/`, `pages/blog/`, the Blog nav entry, the Blog button on the landing page and the Blog card in its card grid.

Generated app includes everything the `starlight` recipe generates, plus:
- `pages/index.ts` — the landing page, which replaces starlight's splash page at `/`
- `<litro-hero-nova>` — the hero backdrop, a star going off over a star field, drawn entirely in CSS (no image file)
- `<litro-install-command>` — one command with a `$` prompt and a copy button
- `<litro-feature-row>` — a "what it does" row with optional command chips and an optional picture
- `<litro-steps>` — a numbered list with a connector line
- `<litro-key-hints>` — key and meaning pairs as a definition list
- `<litro-status-bar>`, `<litro-state-badge>` — the sticky top bar and its task tabs, animated with CSS only
- `<litro-term-window>` — a small terminal picture: state rows, or a slotted shell transcript
- `<litro-hero-video>` — a product recording with a poster and a play/pause button; the recipe ships no clip, so the section is commented out in `pages/index.ts`
- A `--brand-*` token block in the landing page, so the whole page retints from one edit; the docs half keeps its own `--sl-*` tokens

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
