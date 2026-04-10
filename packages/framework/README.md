# litro

A fullstack web framework for [web components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components), powered by [Nitro](https://nitro.unjs.io).

- **Framework adapters** — choose [Lit](https://lit.dev) (default), [FAST Element](https://www.fast.design/), or [Elena](https://elenajs.com/) via `--adapter`
- **File-based routing** — `pages/index.ts` → `/`, `pages/blog/[slug].ts` → `/blog/:slug`
- **Streaming SSR** — Declarative Shadow DOM (Lit/FAST) or light DOM (Elena)
- **Client hydration** — `LitroRouter` (URLPattern-based) takes over after SSR with no flicker
- **Server data fetching** — `definePageData()` runs on the server, serialized to the client
- **Content layer** — `litro:content` virtual module for Markdown blogs with 11ty-compatible frontmatter
- **API routes** — plain `server/api/` files using H3 handlers
- **One port in dev** — Vite and Nitro share a single HTTP port
- **Any deployment** — Node.js, Cloudflare Workers, Vercel Edge, static via Nitro adapters

---

## Quick start

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
deno create npm:@beatzball/litro@latest -- my-app
```

```bash
cd my-app
pnpm install
pnpm dev
```

---

## Hello World

```typescript
// pages/index.ts
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';

export const pageData = definePageData(async () => ({
  message: 'Hello from the server!',
}));

@customElement('page-index')
export default class IndexPage extends LitroPage {
  override render() {
    const data = this.serverData as { message: string } | null;
    return html`<h1>${data?.message}</h1>`;
  }
}
```

---

## How It Compares

|                     | Litro            | Next.js     | Nuxt.js     |
|---------------------|------------------|-------------|-------------|
| Component model     | Lit / FAST / Elena | React     | Vue         |
| File-based routing  | ✓           | ✓           | ✓           |
| SSR / SSG           | ✓           | ✓           | ✓           |
| Server engine       | Nitro       | custom      | Nitro       |
| Hello World JS      | ~8kB        | ~90kB       | ~60kB       |
| Virtual DOM         | —           | ✓           | ✓           |
| W3C standard comps  | ✓           | —           | —           |

> **Note on Hello World JS figures**: approximate figures based on widely-cited community benchmarks and published framework documentation — not independently measured by this project. Lit's ~5 kB runtime size is documented on [lit.dev](https://lit.dev). Next.js and Nuxt.js figures reflect commonly reported baseline JS payloads for a minimal page and vary by framework version and configuration.

---

## SEO

Litro renders all pages server-side before sending HTML to the browser — via Declarative Shadow DOM (Lit/FAST) or light DOM (Elena). Search engines receive fully-rendered content — the same approach used by Next.js and Nuxt.js. Client-side-only web components have SEO limitations; Litro's SSR eliminates them by default.

[How this works →](https://litro.dev/docs/core-concepts/ssr)

---

## Documentation

Full documentation at [litro.dev](https://litro.dev).

---

## Packages

| Package | Description |
|---|---|
| `@beatzball/litro` | This package — core framework |
| [`@beatzball/litro-router`](https://www.npmjs.com/package/@beatzball/litro-router) | Standalone URLPattern router (zero dependencies) |
| `@beatzball/create-litro` | `npm create @beatzball/litro` scaffolding CLI — `fullstack`, `11ty-blog`, and `starlight` recipes |

---

## License

Apache License 2.0 — Copyright 2026 beatzball.
