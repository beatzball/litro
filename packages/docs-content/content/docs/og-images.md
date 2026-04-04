---
title: OG Images
description: Generate dynamic Open Graph images for rich link previews in chat apps and social media.
date: 2026-04-04
---

# OG Images

Litro includes an opt-in plugin for generating dynamic Open Graph images. When someone shares a link to your site in iMessage, Discord, Slack, or any social platform, the preview card shows a branded 1200x630 image with the page title, description, and your site's accent colors.

## Quick Start

### 1. Register the plugin

Add `ogPlugin` and `ogPrerenderHook` to your `nitro.config.ts`:

```ts
import ogPlugin, { ogPrerenderHook } from '@beatzball/litro/plugins/og';

export default defineNitroConfig({
  hooks: {
    'prerender:routes': ogPrerenderHook(),
    'build:before': async (nitro) => {
      await contentPlugin(nitro);
      await pagesPlugin(nitro);
      await ssgPlugin(nitro);
      await ogPlugin(nitro, { siteName: 'My Site' });
    },
  },
});
```

`ogPrerenderHook()` must be registered at the config level (not inside `build:before`) because Nitro runs prerendering before the build phase. The `ogPlugin()` call inside `build:before` stores config metadata.

For SSR-only sites (no prerendering), the `ogPrerenderHook` is harmless — it's a no-op when the prerender route set is empty.

### 2. Create the route handler

Create `server/routes/__og/[...path].png.ts`:

```ts
import { createOgHandler } from '@beatzball/litro/runtime/og-handler.js';
import { routes, pageModules } from '#litro/page-manifest';

export default createOgHandler({
  siteName: 'My Site',
  accentColor: '#ea580c',
  routes,
  pageModules,
});
```

To include a logo in the top-left corner of the card, pass a base64 data URI:

```ts
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createOgHandler } from '@beatzball/litro/runtime/og-handler.js';
import { routes, pageModules } from '#litro/page-manifest';

function loadLogoDataUri(): string | undefined {
  const candidates = [
    resolve('public/logo.png'),        // dev: cwd is project root
    resolve('docs/public/logo.png'),   // prerender: cwd may be repo root
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      return `data:image/png;base64,${readFileSync(p).toString('base64')}`;
    }
  }
  return undefined;
}

export default createOgHandler({
  siteName: 'My Site',
  accentColor: '#ea580c',
  logoDataUri: loadLogoDataUri(),
  routes,
  pageModules,
});
```

### 3. Use dynamic OG URLs in your pages

If you use `buildSeoHead` from `@beatzball/litro-docs-ui`, OG image URLs are generated automatically from the page path. No changes needed to your page files.

For custom setups, point your `og:image` meta tag to `/__og/{path}.png` (use `/__og/index.png` for the root `/`).

## How It Works

- **SSG mode**: The `ogPrerenderHook` adds `/__og/*.png` routes to the prerender set. Additionally, each page response includes an `x-nitro-prerender` header hinting its OG counterpart, so pages discovered by `crawlLinks` also get their OG images prerendered.
- **SSR mode**: The handler generates images on-demand at request time with aggressive caching (`Cache-Control: public, max-age=86400, s-maxage=604800`).
- **Image generation**: Uses [Satori](https://github.com/vercel/satori) (HTML/CSS to SVG) and [@resvg/resvg-js](https://github.com/nicolo-ribaudo/resvg-js) (SVG to PNG). The default template renders a dark card (1200x630) with the page title, description, and a fire-palette accent gradient.

## Configuration

### Plugin Config (`OgPluginConfig`)

Passed to `ogPlugin()` in `nitro.config.ts`:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `siteName` | `string` | `'Litro'` | Site name stored for the handler |
| `accentColor` | `string` | `'#ea580c'` | Accent color for the gradient |
| `logoSvg` | `string` | — | SVG markup for a logo in the top-left |

### Handler Config (`OgHandlerConfig`)

Passed to `createOgHandler()` in the route file:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `siteName` | `string` | `'Litro'` | Displayed in the top-left of the card |
| `accentColor` | `string` | `'#ea580c'` | Gradient start color |
| `logoSvg` | `string` | — | SVG markup for the logo |
| `logoDataUri` | `string` | — | Base64 data URI for a logo image (PNG, SVG, etc.) |
| `template` | `OgTemplate` | `defaultOgTemplate` | Custom Satori template function |
| `font` | `string` | Mona Sans Bold | Path to a custom `.woff` font |

## Custom Templates

The default template is a dark card with the fire palette. To customize, provide a template function. Every `<div>` must have `display: 'flex'` — this is a Satori requirement.

```ts
import type { OgTemplateInput } from '@beatzball/litro/runtime/og-template.js';

function myTemplate(input: OgTemplateInput) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        width: 1200,
        height: 630,
        backgroundColor: '#1a1a2e',
        color: '#ffffff',
        padding: 60,
        flexDirection: 'column',
        justifyContent: 'center',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { display: 'flex', fontSize: 48, fontWeight: 700 },
            children: input.title,
          },
        },
      ],
    },
  };
}

export default createOgHandler({ template: myTemplate });
```

Satori supports a subset of CSS (flexbox only, no grid). See the [Satori docs](https://github.com/vercel/satori#css) for supported properties. Text truncation must be done manually (no `text-overflow: ellipsis`).

## Query Parameter Fallback

For non-page images (e.g., a custom landing page), use query parameters:

```
/__og/custom.png?title=Hello%20World&description=A%20custom%20card&type=article
```

When query params are present, the handler uses them directly instead of looking up page metadata.

## Troubleshooting

### Large build output

`@resvg/resvg-js` includes native binaries with platform-specific `.node` files. Do **not** add `@resvg/resvg-js` to `externals.inline` in your Nitro config — Rollup cannot parse native binaries. Keep it as an external dependency; it resolves from `node_modules` at runtime.

### Satori CSS limitations

Satori only supports flexbox layout. Every `<div>` with children must have `display: 'flex'` or `display: 'none'`. Grid, `position: absolute`, and `text-overflow: ellipsis` are not supported or unreliable. Design templates using only flexbox and manual string truncation.

### Font loading

The default template uses Mona Sans Bold (bundled with the framework). Custom fonts must be `.woff` or `.ttf` format. Pass the path via the `font` option in `createOgHandler()`.
