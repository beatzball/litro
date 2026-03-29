---
title: Configuration
description: Configure your Litro project via litro.config.ts (extends nitro.config.ts) and vite.config.ts.
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
    { dir: '../dist/client', baseURL: '/_litro/', maxAge: 31536000 },
    { dir: '../public',      baseURL: '/',        maxAge: 0 },
  ],

  hooks: {
    'build:before': async (nitro) => {
      await contentPlugin(nitro); // content layer
      await pagesPlugin(nitro);   // page scanner
      await ssgPlugin(nitro);     // static route generation
    },
  },
});
```

## `vite.config.ts`

Standard Vite config. The `litroContentPlugin()` bridges the `litro:content` virtual module for the client bundle (returns a browser stub — real data is server-side only).

```ts
import { defineConfig } from 'vite';
import litroContentPlugin from '@beatzball/litro/vite';

export default defineConfig({
  plugins: [litroContentPlugin()],
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
| `LITRO_BASE_PATH` | Sub-path prefix for GitHub Pages project sites (e.g. `/litro`) | `''` |
| `SITE_URL` | Canonical base URL for SEO meta tags | `https://litro.dev` |
