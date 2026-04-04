---
title: OG Images
description: Generate dynamic Open Graph images for rich link previews in chat apps and social media.
date: 2026-04-04
---

# OG Images

Litro includes an opt-in plugin for generating dynamic Open Graph images. When someone shares a link to your site in iMessage, Discord, Slack, or any social platform, the preview card shows a branded 1200x630 image with the page title, description, and your site's accent colors.

## Quick Start

### 1. Register the plugin

Add `ogPlugin` to your `nitro.config.ts` after `ssgPlugin` (or `pagesPlugin` for SSR sites):

```ts
import ogPlugin from '@beatzball/litro/plugins/og';

export default defineNitroConfig({
  hooks: {
    'build:before': async (nitro) => {
      await contentPlugin(nitro);
      await pagesPlugin(nitro);
      await ssgPlugin(nitro);
      await ogPlugin(nitro, { siteName: 'My Site' });
    },
  },
});
```

### 2. Create the route handler

Create `server/routes/__og/[...path].png.ts`:

```ts
import { createOgHandler } from '@beatzball/litro/runtime/og-handler.js';

export default createOgHandler({
  siteName: 'My Site',
  accentColor: '#ea580c',
});
```

### 3. Use dynamic OG URLs in your pages

If you use `buildSeoHead` from `@beatzball/litro-docs-ui`, OG image URLs are generated automatically from the page path. No changes needed to your page files.

For custom setups, point your `og:image` meta tag to `/__og/{path}.png` (use `/__og/index.png` for the root `/`).

## How It Works

- **SSG mode**: The plugin reads all prerender routes and registers `/__og/*.png` variants. Nitro prerenders each one as a static PNG file during build.
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
| `template` | `OgTemplate` | `defaultOgTemplate` | Custom Satori template function |
| `font` | `string` | Mona Sans Bold | Path to a custom `.woff` font |

## Custom Templates

The default template is a dark card with the fire palette. To customize, provide a template function:

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
            style: { fontSize: 48, fontWeight: 700 },
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

`@resvg/resvg-js` includes a ~2MB WASM binary. This is included in the SSG build output but only used during prerendering. For SSR deployments where bundle size matters, consider generating images via an external service.

### Satori CSS limitations

Satori only supports flexbox layout. Grid, `position: absolute`, and `text-overflow: ellipsis` are not supported or unreliable. Design templates using only flexbox and manual string truncation.

### Font loading

The default template uses Mona Sans Bold (bundled with the framework). Custom fonts must be `.woff` or `.ttf` format. Pass the path via the `font` option in `createOgHandler()`.
