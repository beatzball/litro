# Litro

A fullstack web framework for [Lit](https://lit.dev) components, powered by [Nitro](https://nitro.unjs.io).

- **File-based routing** — `pages/index.ts` → `/`, `pages/blog/[slug].ts` → `/blog/:slug`
- **Server-side rendering** — streaming Declarative Shadow DOM via `@lit-labs/ssr`
- **Client hydration** — `LitroRouter` (URLPattern-based) takes over after SSR with no flicker
- **Server-side data fetching** — `definePageData()` runs on the server before render
- **Content layer** — `litro:content` virtual module for Markdown blogs with 11ty-compatible frontmatter
- **Recipe-based scaffolding** — `fullstack` and `11ty-blog` recipes via `npm create @beatzball/litro`
- **API routes** — plain `server/api/` files, H3 handlers, no framework overhead
- **One port in dev** — Vite and Nitro share a single HTTP port, no proxy
- **Any deployment target** — Node.js, Cloudflare Workers, Vercel Edge, static — via Nitro adapters

> **Status**: Early development. Core SSR pipeline, content layer, and scaffolding are working. Playwright e2e tests not yet written.

---

## Monorepo structure

```
litro/
  packages/
    framework/        ← npm package: @beatzball/litro
    litro-router/     ← npm package: @beatzball/litro-router (standalone, zero-dependency)
    create-litro/     ← npm create @beatzball/litro (scaffolding)
  playground/         ← test app
```

`@beatzball/litro-router` is also independently usable without the full Litro framework — see its [package README](./packages/litro-router/README.md).

---

## Quick start — scaffold a new app (local)

> **Note:** `create-litro` is not published to npm yet. Use the local path instructions below.

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
  @state() declare serverData: { message: string; timestamp: string } | null;

  override async fetchData() {
    // Called on client-side navigation (not on the initial SSR load)
    const res = await fetch("/api/hello");
    return res.json();
  }

  render() {
    return html` <h1>${this.serverData?.message ?? "Loading..."}</h1> `;
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
# Build client (Vite) + server (Nitro) for Node.js
pnpm build          # or: npx vite build && npx nitro build

# Build for static site generation (prerender all routes to HTML)
LITRO_MODE=static pnpm build
```

Output:

- `dist/client/` — Vite client bundle (JS, assets)
- `dist/server/` — Nitro server bundle

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
import { ssgPreset, ssrPreset } from "litro/config";
import pagesPlugin from "litro/plugins";
import ssgPlugin from "litro/plugins/ssg";

const mode = process.env.LITRO_MODE ?? "server";

export default defineNitroConfig({
  ...(mode === "static" ? ssgPreset() : ssrPreset()),
  srcDir: "server",
  publicAssets: [
    // Paths are resolved relative to srcDir ('server/'), so use '../' to reach
    // the project root. Bare paths like 'dist/client' would incorrectly resolve
    // to 'server/dist/client' and produce a 404 for all /_litro/** assets.
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
  hooks: {
    "build:before": async (nitro: Nitro) => {
      await pagesPlugin(nitro);
      await ssgPlugin(nitro);
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
pnpm --filter @beatzball/litro test             # run framework unit tests (174 tests)
pnpm --filter @beatzball/create-litro test      # run scaffolding tests (11 tests)
pnpm --filter @beatzball/litro dev              # watch-compile framework

cd playground
litro dev                       # start dev server on :3030
litro dev --port 8080           # start on a custom port
litro build                     # full production build (vite + nitro)
PORT=4000 node dist/server/server/index.mjs  # run production server
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
