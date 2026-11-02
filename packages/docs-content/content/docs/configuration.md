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

## Content Security Policy

By default the page shell writes two small framework scripts inline: the Declarative Shadow DOM polyfill (Lit and FAST only) and the skip-link script. A policy of `script-src 'self'` blocks them. To serve a strict policy with no `'unsafe-inline'` for scripts, load them as files instead.

1. Add `litroShellScriptsPlugin()` to `vite.config.ts`. It writes the scripts to `dist/client/assets/`, under names that carry a content hash, so the existing `/_litro/assets/**` immutable rule covers them and a framework upgrade changes their URLs.

   ```ts
   import { litroEntryPlugin, litroShellScriptsPlugin } from '@beatzball/litro/vite';

   export default defineConfig({
     plugins: [litroEntryPlugin(), litroShellScriptsPlugin()],
     // ...
   });
   ```

2. Pass `inlineScripts: false` to `createPageHandler()` in your page route (`server/routes/[...].ts`):

   ```ts
   const handler = createPageHandler({
     route: matched,
     pageModule: pageModules[matched.filePath],
     inlineScripts: false,
   });
   ```

3. Send the policy. A Nitro route rule works for the Node server and for static hosts that read `_headers`:

   ```ts
   routeRules: {
     '/**': {
       headers: {
         'content-security-policy':
           "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
           "img-src 'self' data:; font-src 'self'; connect-src 'self'; " +
           "base-uri 'none'; form-action 'self'",
       },
     },
     // ...the cache rules above
   },
   ```

The page then loads `<script src="/_litro/assets/litro-dsd-polyfill-<hash>.js">` as a synchronous classic script, so it still runs before the parser reaches the first declarative shadow root, and `<script src="/_litro/assets/litro-skip-links-<hash>.js" defer>`. The DSD polyfill costs one blocking request on Lit and FAST pages. That is why the default stays inline.

What the option does not cover:

- **Your own scripts.** Anything in `routeMeta.head`, a page's `seoHead`, or a `bodyScript` is written exactly as you gave it. Move such a script into a file under `public/`, or add its hash to `script-src`. The hash is the base64 SHA-256 of the exact text between `<script>` and `</script>`:

  ```sh
  node -e "const s=require('fs').readFileSync(0,'utf8');console.log(\"'sha256-\"+require('crypto').createHash('sha256').update(s).digest('base64')+\"'\")" < my-inline-script.js
  ```

  Data blocks (`<script type="application/json">`, `<script type="application/ld+json">`) are not run, so the policy does not apply to them.
- **Styles.** Lit SSR writes a `<style>` element into every shadow root, so `style-src` still needs `'unsafe-inline'`.
- **`litro dev`.** The dev server keeps the framework's scripts inline and logs a note when `inlineScripts: false` is set. Test a strict policy against `litro build` and `litro preview`.

If a production build has `inlineScripts: false` but no script files (the plugin is missing), the page handler keeps the scripts inline and logs an error once, naming the plugin.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `LITRO_ADAPTER` | Selects the framework adapter: `lit` or `fast`. Also accepts `elena`, which is [deprecated and removed in v1](/docs/adapters/elena). Typically set at the top of `nitro.config.ts`. | `lit` |
| `LITRO_MODE` | Build mode: `server` (SSR) or `static` (SSG). Set by the CLI when you pass `--mode static`. | `server` |
| `LITRO_BASE_PATH` | Sub-path prefix for GitHub Pages project sites (e.g. `/litro`) | `''` |
| `SITE_URL` | Canonical base URL for SEO meta tags | `https://litro.dev` |
