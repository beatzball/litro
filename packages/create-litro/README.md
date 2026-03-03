# create-litro

Scaffold a new [Litro](https://github.com/beatzball/litro) app.

## Usage

```bash
npm create litro@latest my-app
# or
pnpm create litro my-app
# or
yarn create litro my-app
```

Then follow the prompts, or pass arguments directly to skip them:

```bash
npm create litro@latest my-app fullstack
```

The generated app includes:

- `pages/index.ts` — home page with server-side data fetching
- `pages/blog/index.ts` — blog listing page
- `pages/blog/[slug].ts` — dynamic post page with `generateRoutes()` for SSG
- `server/api/hello.ts` — example JSON API endpoint
- Config files: `nitro.config.ts`, `vite.config.ts`, `tsconfig.json`

## After scaffolding

```bash
cd my-app
pnpm install
pnpm dev      # start dev server on http://localhost:3030
```

## License

Apache License 2.0 — Copyright 2026 beatzball.
