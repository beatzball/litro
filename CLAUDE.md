# Litro — Project Context for All Agents

## License

Apache License 2.0. Copyright 2026 beatzball. See `LICENSE` at the repo root.

## What Is Litro

Litro is a greenfield fullstack web framework being built in this repo. It combines:

- **Web Components** — framework-agnostic via adapter system: Lit (default), FAST Element, Elena
- **Nitro** — server engine (same server that powers Nuxt), handles routing, API, SSR, deployment adapters
- **SSR** — Lit uses `@lit-labs/ssr`, FAST uses `@microsoft/fast-ssr` (both Declarative Shadow DOM, streaming); Elena uses light DOM SSR (no DSD, no hydration)
- **`LitroRouter`** — built-in client-side router (URLPattern API), no external dependency
- **Vite** — client bundle build and HMR
- **pnpm workspaces** — monorepo tooling
- **TypeScript** — required throughout

## Core Architecture

```
User Request
    │
    ▼
Nitro Server
    ├── /api/**  →  server/api/ route files (plain H3 handlers)
    └── /**      →  Page Handler
                        ├── SSR mode: FrameworkAdapter.renderPage() → streams HTML
                        │     ├── Lit: @lit-labs/ssr → DSD HTML → client hydrates
                        │     ├── FAST: @microsoft/fast-ssr → DSD HTML → client hydrates
                        │     └── Elena: light DOM SSR → no hydration, progressive enhancement
                        └── Static mode: prerendered .html files served by Nitro static preset
```

### Framework Adapter System

Projects select a framework adapter (`lit`, `fast`, `elena`) at creation via `--adapter` flag. The `FrameworkAdapter` interface (`packages/framework/src/adapter/types.ts`) abstracts SSR, head scripts, build config, and runtime components. Each adapter provides native implementations of Outlet, Link, and Page. The router, page scanner, data layer, and content system are adapter-agnostic.

## User-Facing Directory Convention

```
my-app/
  pages/              ← Page components (filename = route)
    index.ts          →  /
    about.ts          →  /about
    blog/
      index.ts        →  /blog
      [slug].ts       →  /blog/:slug
    [...all].ts       →  /* (catch-all)
  server/
    api/              ← Plain Nitro/H3 handlers
    middleware/       ← Nitro middleware
  public/             ← Static assets
  app.ts              ← Client entry
  nitro.config.ts     ← Server config (Nitro). Adapter via LITRO_ADAPTER env (set in shell or at the top of this file as `process.env.LITRO_ADAPTER = 'fast'`); also picked up from `--adapter` at scaffolding time
  vite.config.ts
```

## Monorepo Structure (packages/)

```
litro/
  packages/
    framework/        ← Core package (npm: @beatzball/litro)
      src/
        plugins/      ← Nitro plugins (page scanner, etc.)
        vite/         ← Vite plugins
        runtime/      ← Client-side runtime (router bootstrap, hydration)
        cli/          ← litro dev/build/preview commands
    litro-router/     ← Standalone router (npm: @beatzball/litro-router)
    create-litro/     ← Scaffolding CLI (npm create @beatzball/litro)
    litro-agent/      ← Agent layer (npm: @beatzball/litro-agent)
  playground/                   ← fullstack recipe test app
  playground-11ty/              ← 11ty-blog recipe test app
  playground-starlight/         ← starlight recipe test app
  playground-fast/              ← FAST adapter test app
  playground-elena/             ← Elena adapter test app
  playground-starlight-elena/   ← Elena starlight recipe test app
  playground-starlight-fast/    ← FAST starlight recipe test app
  docs/                         ← Official docs site (@beatzball/litro-docs, SSG)
  docs-ssr/                     ← SSR docs site (@beatzball/litro-docs-ssr)
  research/                     ← Research agent findings (R-1 through R-4)
```

## Key Conventions

- Each page file exports a **default** component class (Lit, FAST, or Elena) and an optional `routeMeta` named export
- `definePageData<T>(fetcher)` — server-side data fetching; result serialized into `<script type="application/json" id="__litro_data__">` for client consumption
- `getServerData<T>()` — client utility to read serialized server data on first load
- `generateRoutes(): Promise<string[]>` — optional export on dynamic pages for SSG prerendering
- All deployment targets delegated entirely to Nitro's adapter system (no custom adapters)

## Commits and pull requests

**No provenance trailers.** Not in a commit message, not in a PR body, not in a
PR comment. That means session links (`Claude-Session:`), agent attribution,
`Co-Authored-By` for a tool, and "generated with" footers.

This is a public repository published to npm, so the history is read by people
who do not care which tool wrote a line. A harness default may tell an agent to
append one; this rule overrides it, the same way `roost`'s `AGENTS.md` does.

It is written down because the harness default flipped three times inside one
session, which left five commits on `main` carrying a `Claude-Session:` line and
two PR bodies disagreeing with each other. A rule in the repo does not flip.

**No absolute home paths** — `/Users/<name>/...`, `/home/<name>/...` — in
commits, PR bodies, or any pushed content. Use repo-relative paths or a
placeholder.

**Never use bare `#N` for internal numbering** in a commit or PR body. GitHub
auto-links it to the PR or issue with that number. Write "PRD item N" or "Item N".

## Changesets

- **One changeset file per package** — never combine multiple packages in a single `.changeset/*.md` file. Each file should list one package in the frontmatter and only describe changes relevant to that package. Combined changesets dump the entire description into every listed package's CHANGELOG.
- **Ignored packages** — `@beatzball/litro-docs`, `@beatzball/litro-docs-content`, `@beatzball/litro-docs-ui`, `@beatzball/litro-docs-ssr`, `@beatzball/litro-benchmarks`, `bench-litro`, `bench-hn-litro`, `bench-hn-litro-fast`, `bench-hn-litro-elena`, and `@beatzball/hn-mock-api` are in the changesets ignore list (`.changeset/config.json`). Never include them in changeset files. Mixing ignored and non-ignored packages in one changeset causes the release workflow to fail.
- **Published packages** — only `@beatzball/litro`, `@beatzball/litro-router`, `@beatzball/create-litro`, and `@beatzball/litro-agent` get changesets.

## Source References

- Lit docs: https://lit.dev/docs/
- Lit SSR docs: https://lit.dev/docs/ssr/overview/
- FAST Element docs: https://www.fast.design/
- Elena docs: https://elenajs.com/
- Nitro docs: https://nitro.unjs.io
- H3 docs: https://h3.unjs.io
- Vite docs: https://vite.dev/guide/

## Research & Decisions

Research findings (R-1 through R-4) are archived in `research/SUMMARY.md`.
Key decisions from implementation are in `DECISIONS.md`.
Architecture overview is in `ARCHITECTURE.md`.

## Current Status

All core features complete. Three framework adapters: Lit (default), FAST Element, Elena.
Three recipes: fullstack, 11ty-blog, starlight.
Run `pnpm test` for unit tests — note it covers `@beatzball/litro` and `@beatzball/litro-agent` only; `@beatzball/litro-router` and `@beatzball/create-litro` are run per package (`pnpm --filter <pkg> test`) and the docs suites via `pnpm test:docs`. Run `pnpm test:e2e` for Playwright e2e tests.
`pnpm test:e2e:preview` for production-mode e2e. `pnpm bench` for benchmarks.
Results in `benchmarks/results/latest.json`.
