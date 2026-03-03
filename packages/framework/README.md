# litro

A fullstack web framework for [Lit](https://lit.dev) components, powered by [Nitro](https://nitro.unjs.io).

- **File-based routing** — `pages/index.ts` → `/`, `pages/blog/[slug].ts` → `/blog/:slug`
- **Streaming SSR** — Declarative Shadow DOM via `@lit-labs/ssr`, streamed from the server
- **Client hydration** — `LitroRouter` (URLPattern-based) takes over after SSR with no flicker
- **Server data fetching** — `definePageData()` runs on the server, serialized to the client
- **API routes** — plain `server/api/` files using H3 handlers
- **One port in dev** — Vite and Nitro share a single HTTP port
- **Any deployment** — Node.js, Cloudflare Workers, Vercel Edge, static via Nitro adapters

---

## Documentation

Full documentation, quick start, and API reference are in the [repository README](https://github.com/beatzball/litro#readme).

---

## Quick start

```bash
# Scaffold a new app (once published to npm)
npm create litro@latest my-app
cd my-app
npm install
npm run dev
```

---

## Packages

| Package | Description |
|---|---|
| `litro` | This package — core framework |
| [`litro-router`](https://www.npmjs.com/package/litro-router) | Standalone URLPattern router (zero dependencies) |
| `create-litro` | `npm create litro` scaffolding CLI |

---

## License

Apache License 2.0 — Copyright 2026 beatzball.
