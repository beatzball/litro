# Litro

A fullstack web framework for [Lit](https://lit.dev) components, powered by [Nitro](https://nitro.unjs.io).

- **File-based routing** — `pages/index.ts` → `/`, `pages/blog/[slug].ts` → `/blog/:slug`
- **Server-side rendering** — streaming Declarative Shadow DOM via `@lit-labs/ssr`
- **Client hydration** — `LitroRouter` (URLPattern-based) takes over after SSR with no flicker
- **Server-side data fetching** — `definePageData()` runs on the server before render
- **Content layer** — `litro:content` virtual module for Markdown blogs with 11ty-compatible frontmatter
- **Recipe-based scaffolding** — `fullstack`, `11ty-blog`, and `starlight` recipes via `npm create @beatzball/litro`
- **API routes** — plain `server/api/` files, H3 handlers, no framework overhead
- **One port in dev** — Vite and Nitro share a single HTTP port, no proxy
- **Any deployment target** — Node.js, Cloudflare Workers, Vercel Edge, static — via Nitro adapters

> **Status**: Early development. Core SSR pipeline, content layer, scaffolding, and Playwright e2e tests are all working.

---

## Monorepo structure

```
litro/
  packages/
    framework/        ← npm package: @beatzball/litro
    litro-router/     ← npm package: @beatzball/litro-router (standalone, zero-dependency)
    create-litro/     ← npm create @beatzball/litro (scaffolding)
  playground/         ← fullstack recipe test app
  playground-11ty/    ← 11ty-blog recipe test app
  playground-starlight/ ← starlight recipe test app
  docs/               ← official documentation site (@beatzball/litro-docs)
```

`@beatzball/litro-router` is also independently usable without the full Litro framework — see its [package README](./packages/litro-router/README.md).

---

## Quick start — scaffold a new app (local)

**Step 1 — build the framework and scaffolder from source:**

```bash
git clone <this-repo> litro
cd litro
pnpm install
pnpm --filter @beatzball/litro-router build   # compiles packages/litro-router → dist/
pnpm --filter @beatzball/litro build          # compiles packages/framework → dist/
pnpm --filter @beatzball/create-litro build   # compiles packages/create-litro → dist/
```

**Step 2 — scaffold your app:**

```bash
cd /path/to/your/projects

# Interactive (prompts for recipe + mode):
node /path/to/litro/packages/create-litro/dist/src/index.js my-app

# Non-interactive — fullstack SSR app:
node /path/to/litro/packages/create-litro/dist/src/index.js my-app --recipe fullstack --mode ssr

# Non-interactive — 11ty-compatible blog, static output:
node /path/to/litro/packages/create-litro/dist/src/index.js my-app --recipe 11ty-blog --mode ssg

# Non-interactive — Starlight docs + blog, static output:
node /path/to/litro/packages/create-litro/dist/src/index.js my-docs --recipe starlight

# List all recipes:
node /path/to/litro/packages/create-litro/dist/src/index.js --list-recipes
```

**Step 3 — point the app at the local `litro` package:**

Open the generated `my-app/package.json` and replace the `litro` version with a `file:` reference:

```json
"dependencies": {
  "litro": "file:/path/to/litro/packages/framework",
  ...
}
```

**Step 4 — install, build, and run:**

```bash
cd my-app
pnpm install
pnpm run build     # Stage 0: page scan → Stage 1: vite build → Stage 2: nitro build
pnpm run preview   # starts http://localhost:3030
```

The `fullstack` scaffolded app includes:
- `pages/index.ts` — home page with `pageData` server fetching
- `pages/blog/index.ts` — blog listing
- `pages/blog/[slug].ts` — dynamic post page with route params and `generateRoutes()`
- `server/api/hello.ts` — JSON API endpoint
- All config files (`nitro.config.ts`, `vite.config.ts`, `tsconfig.json`)

The `11ty-blog` recipe also includes a Markdown content layer:
- `content/blog/*.md` — posts with YAML frontmatter (title, date, tags, draft)
- `content/_data/metadata.js` — global site data
- Pages that import from `litro:content` for post listing, individual posts, and tag filtering
- `litro.recipe.json` — tells the content plugin where to find posts

The `starlight` recipe scaffolds an Astro Starlight-inspired docs + blog site:
- `content/docs/*.md` — documentation pages with sidebar ordering frontmatter
- `content/blog/*.md` — blog posts (title, date, tags, description)
- Layout components: `<starlight-page>`, `<starlight-header>`, `<starlight-sidebar>`, `<starlight-toc>`
- UI components: `<litro-card>`, `<litro-card-grid>`, `<litro-badge>`, `<litro-aside>`, `<litro-tabs>`
- [Shoelace](https://shoelace.style) web components available (button, icon, badge, copy-button, details, tab-group) — `<sl-*>` names are reserved for Shoelace; Litro's primitives use `litro-*`
- `server/starlight.config.js` — site title, nav links, sidebar groups
- `public/styles/starlight.css` — full `--sl-*` CSS token layer with dark/light mode
- SSG-only (no `--mode` flag needed — hardcoded to `ssg`)

---

## Quick start — playground (monorepo)

```bash
# Install dependencies and build the framework
pnpm install
pnpm --filter @beatzball/litro-router build
pnpm --filter @beatzball/litro build

# Start the dev server from the playground directory
cd playground
litro dev
```

The dev server starts on `http://localhost:3030` serving both Vite (JS modules, HMR) and Nitro (API routes, HTML shell) on a single port. Use `litro dev --port <n>` to change the port.

---

## App structure

```
my-app/
  pages/
    index.ts          →  GET /
    about.ts          →  GET /about
    blog/
      index.ts        →  GET /blog
      [slug].ts       →  GET /blog/:slug
    [...all].ts       →  GET /* (catch-all)
  server/
    api/              ← H3 API handlers (e.g. server/api/hello.ts → GET /api/hello)
    middleware/       ← Nitro middleware
  public/             ← Static assets served at /
  app.ts              ← Client entry (hydration + router bootstrap)
  vite.config.ts
  nitro.config.ts
```

---

## Pages

A page file exports a Lit component decorated with `@customElement`. The filename determines the route.

```typescript
// pages/index.ts  →  /
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("page-home")
export class HomePage extends LitElement {
  render() {
    return html`<h1>Hello from Litro</h1>`;
  }
}
```

### Dynamic routes

```
pages/blog/[slug].ts    →  /blog/:slug
pages/[...all].ts       →  /* (catch-all)
pages/[[lang]]/index.ts →  /:lang?
```

---

## Server-side data fetching

`definePageData()` runs on the server before the component renders. The result is serialized into the HTML shell as a JSON script tag and read by `LitroPage` on first load.

```typescript
// pages/index.ts
import { customElement, state } from "lit/decorators.js";
import { LitroPage } from "litro/runtime";
import { definePageData } from "litro";

export const pageData = definePageData(async (event) => {
  // event is the H3 event — access headers, cookies, params, etc.
  return {
    message: "Hello from the server!",
    timestamp: new Date().toISOString(),
  };
});

@customElement("page-home")
export class HomePage extends LitroPage {
  override async fetchData() {
    // Called on client-side navigation (not on the initial SSR load)
    const res = await fetch("/api/hello");
    return res.json();
  }

  render() {
    // Cast serverData locally — do NOT use `@state() declare` (breaks jiti/SSG)
    const data = this.serverData as { message: string; timestamp: string } | null;
    return html` <h1>${data?.message ?? "Loading..."}</h1> `;
  }
}
```

On the first (SSR) load, `serverData` is populated from the injected JSON. On subsequent client-side navigations, `fetchData()` is called instead.

---

## API routes

Files in `server/api/` are plain [H3](https://h3.unjs.io) event handlers.

```typescript
// server/api/hello.ts  →  GET /api/hello
import { defineEventHandler } from "h3";

export default defineEventHandler((event) => {
  return { message: "Hello!", timestamp: new Date().toISOString() };
});
```

---

## Build

```bash
# Build client (Vite) + server (Nitro)
pnpm build          # or: litro build

# For SSG: configure ssgPreset() in nitro.config.ts, then:
pnpm build          # output goes to dist/static/ instead of dist/server/
```

Output:

- `dist/client/` — Vite client bundle (JS, assets)
- `dist/server/` — Nitro server bundle (SSR mode)
- `dist/static/` — Prerendered HTML files (SSG mode)

---

## Deployment

Litro delegates all deployment to Nitro's adapter system. Set `NITRO_PRESET` or configure `preset` in `nitro.config.ts`:

| Target                | Preset                            |
| --------------------- | --------------------------------- |
| Node.js server        | `node-server` (default)           |
| Cloudflare Workers    | `cloudflare-workers`              |
| Vercel Edge           | `vercel-edge`                     |
| Netlify Edge          | `netlify-edge`                    |
| Static / GitHub Pages | `static` (or `LITRO_MODE=static`) |

See [Nitro deployment docs](https://nitro.unjs.io/deploy) for the full list.

---

## `nitro.config.ts` reference

```typescript
import { defineNitroConfig } from "nitropack/config";
import type { Nitro } from "nitropack";
import { ssgPreset } from "@beatzball/litro/config";
import pagesPlugin from "@beatzball/litro/plugins";
import ssgPlugin from "@beatzball/litro/plugins/ssg";
import contentPlugin from "@beatzball/litro/content/plugin";

export default defineNitroConfig({
  ...ssgPreset(),   // omit for SSR mode (no spread)
  srcDir: "server",
  publicAssets: [
    // Paths resolved relative to srcDir ('server/') — use '../' to reach root.
    // Bare 'dist/client' resolves to 'server/dist/client' and 404s all /_litro/** assets.
    { dir: "../dist/client", baseURL: "/_litro/", maxAge: 31536000 },
    { dir: "../public", baseURL: "/", maxAge: 0 },
  ],
  externals: { inline: ["@lit-labs/ssr", "@lit-labs/ssr-client"] },
  esbuild: {
    options: {
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
          useDefineForClassFields: false,
        },
      },
    },
  },
  ignore: ["**/middleware/vite-dev.ts"],
  handlers: [
    { middleware: true, handler: "./server/middleware/vite-dev.ts", env: "dev" },
  ],
  hooks: {
    "build:before": async (nitro: Nitro) => {
      await contentPlugin(nitro); // if using the content layer
      await pagesPlugin(nitro);
      await ssgPlugin(nitro);     // if using ssgPreset()
    },
  },
});
```

---

## Content layer (`litro:content`)

The `litro:content` virtual module provides a file-system Markdown content API compatible with the 11ty data cascade format.

Add `litro.recipe.json` to your project root to configure the content directory:

```json
{ "contentDir": "content/blog" }
```

Then import from the virtual module in any page or server route:

```typescript
import { getPosts, getPost, getTags, getGlobalData } from 'litro:content';

// List posts (sorted by date descending, drafts excluded)
const posts = await getPosts({ tag: 'tutorial', limit: 5 });

// Single post by slug
const post = await getPost('hello-world');  // null if not found

// All tags (sorted alphabetically)
const tags = await getTags();

// Global site data from content/_data/metadata.js
const meta = await getGlobalData();
```

Frontmatter fields: `title` (required), `date`, `description`, `tags`, `draft`.

Directory data: place a `.11tydata.json` file alongside your posts to set default tags or other fields for all posts in that directory — exactly as 11ty's data cascade works.

For TypeScript types, add to your project's `tsconfig.json`:
```json
{ "compilerOptions": { "types": ["litro/content/env"] } }
```

The content plugin must be registered in `nitro.config.ts`:

```typescript
import contentPlugin from 'litro/content/plugin';

export default defineNitroConfig({
  hooks: {
    'build:before': async (nitro) => {
      await contentPlugin(nitro);
      await pagesPlugin(nitro);
      await ssgPlugin(nitro);
    },
  },
});
```

---

## Static site generation

Export a `generateRoutes()` function from any dynamic page to tell the SSG which paths to prerender:

```typescript
// pages/blog/[slug].ts
export async function generateRoutes(): Promise<string[]> {
  // fetch from a CMS, database, or static data
  return ["/blog/hello-world", "/blog/getting-started"];
}
```

Static routes (`/`, `/about`, `/blog`) are automatically added to the prerender list by the pages plugin.

---

## Development

```bash
pnpm install                                    # install all workspace deps
pnpm --filter @beatzball/litro-router build     # compile litro-router (required once)
pnpm --filter @beatzball/litro build            # compile framework (required once)
pnpm --filter @beatzball/litro-router test      # run router unit tests (16 tests)
pnpm --filter @beatzball/litro test             # run framework unit tests (196 tests)
pnpm --filter @beatzball/create-litro test      # run scaffolding tests (17 tests)
pnpm test:e2e                                   # Playwright e2e tests (32 tests, 3 playgrounds)
pnpm --filter @beatzball/litro dev              # watch-compile framework

# Playgrounds
cd playground && litro dev      # fullstack playground on :3030
pnpm dev:11ty                   # 11ty-blog playground
pnpm dev:starlight              # starlight playground

# Docs site
pnpm dev:docs                   # docs dev server
pnpm build:docs                 # build docs (SSG → docs/dist/static/)
pnpm preview:docs               # preview built docs
```

---

## Tech stack

| Layer         | Library                                                                               | Role                                   |
| ------------- | ------------------------------------------------------------------------------------- | -------------------------------------- |
| Components    | [Lit 3](https://lit.dev)                                                              | Web component authoring                |
| SSR           | [@lit-labs/ssr](https://github.com/lit/lit/tree/main/packages/labs/ssr)               | Streaming Declarative Shadow DOM       |
| Hydration     | [@lit-labs/ssr-client](https://github.com/lit/lit/tree/main/packages/labs/ssr-client) | Client-side DSD hydration              |
| Client router | [`litro-router`](./packages/litro-router) (URLPattern API)                            | Web component-aware pushState router   |
| Server        | [Nitro](https://nitro.unjs.io)                                                        | Routing, API, SSR, deployment adapters |
| Client build  | [Vite 5](https://vitejs.dev)                                                          | Client bundle, HMR                     |
| Language      | TypeScript 5                                                                          | Required throughout                    |
| Monorepo      | pnpm workspaces                                                                       | Package management                     |

---

## Contributing

### Making a change

1. Fork the repo, create a branch, make your changes.
2. If your change is user-facing (bug fix, new feature, breaking change), add a changeset:
   ```bash
   pnpm changeset
   # Select which packages changed, pick the semver bump type, write a short summary.
   # Commit the generated .changeset/<name>.md file with your PR.
   ```
   Internal changes (docs, tests, tooling) don't need a changeset.
3. Open a PR against `main`. CI runs tests, build, and a dependency audit automatically.

### Release workflow

Releases are fully automated via [Changesets](https://github.com/changesets/changesets):

- When a PR with a `.changeset/*.md` file is merged to `main`, a bot opens a **"Version Packages"** PR that bumps `package.json` versions and updates each package's `CHANGELOG.md`.
- When that PR is merged, the release workflow publishes changed packages to npm and creates GitHub Releases.
- `litro-router` bumps automatically propagate a patch bump to `litro` (internal dep cascade).

**Release scripts (maintainers):**

```bash
pnpm changeset          # create a changeset interactively
pnpm version-packages   # apply pending changesets → bump versions + write CHANGELOGs
pnpm release            # build all packages and publish to npm
```

---

## License

Apache License 2.0 — see [LICENSE](./LICENSE) for the full text.

Copyright 2026 beatzball
