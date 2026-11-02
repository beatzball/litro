---
title: Configuration
description: Configure your Litro project via nitro.config.ts and vite.config.ts. Adapter selection via the LITRO_ADAPTER env var (set in the shell or at the top of nitro.config.ts) or the --adapter CLI flag at scaffolding time.
date: 2026-01-01
---

# Configuration

## `nitro.config.ts`

Litro projects configure the server via `nitro.config.ts`. This is a standard Nitro config with Litro plugins.

```ts
import { defineNitroConfig } from 'nitropack/config';
import { ssgPreset } from '@beatzball/litro/config';
import pagesPlugin from '@beatzball/litro/plugins';
import ssgPlugin from '@beatzball/litro/plugins/ssg';
import contentPlugin from '@beatzball/litro/content/plugin';

export default defineNitroConfig({
  ...ssgPreset(), // enables SSG output

  srcDir: 'server',

  publicAssets: [
    { dir: '../dist/client', baseURL: '/_litro/' },
    { dir: '../public',      baseURL: '/',        maxAge: 0 },
  ],

  hooks: {
    'build:before': async (nitro) => {
      await contentPlugin(nitro); // content layer
      await pagesPlugin(nitro);   // page scanner
      await ssgPlugin(nitro);     // static route generation
    },
  },

  routeRules: {
    // Only the content-hashed chunks may be cached forever.
    '/_litro/assets/**': {
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    },
    // app.js has the same name in every build, so a browser must ask again.
    '/_litro/app.js': { headers: { 'cache-control': 'no-cache' } },
  },
});
```

## `vite.config.ts`

Standard Vite config. The `litroContentPlugin()` bridges the `litro:content` virtual module for the client bundle (returns a browser stub — real data is server-side only).

`litroEntryPlugin()` keeps the client entry `app.js` free of shared code: everything the entry imports statically goes into one hashed `boot` chunk, so no other chunk imports `app.js`. That lets the page load the entry as `/_litro/app.js?v=<content hash>`, which changes with every deploy. Without the plugin the build prints a warning and the page loads the bare `/_litro/app.js`.

```ts
import { defineConfig } from 'vite';
import litroContentPlugin, { litroEntryPlugin } from '@beatzball/litro/vite';

export default defineConfig({
  plugins: [litroContentPlugin(), litroEntryPlugin()],
  base: '/_litro/',
  build: {
    outDir: 'dist/client',
    rollupOptions: {
      input: 'app.ts',
      output: { entryFileNames: '[name].js' },
    },
  },
});
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `LITRO_ADAPTER` | Selects the framework adapter: `lit` or `fast`. Also accepts `elena`, which is [deprecated and removed in v1](/docs/adapters/elena). Typically set at the top of `nitro.config.ts`. | `lit` |
| `LITRO_MODE` | Build mode: `server` (SSR) or `static` (SSG). Set by the CLI when you pass `--mode static`. | `server` |
| `LITRO_BASE_PATH` | Sub-path prefix for GitHub Pages project sites (e.g. `/litro`) | `''` |
| `SITE_URL` | Canonical base URL for SEO meta tags | `https://litro.dev` |
