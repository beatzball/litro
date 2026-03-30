---
title: Starlight Recipe
description: The starlight recipe creates a documentation site with sidebar navigation, TOC, and blog.
date: 2026-01-01
---

# Starlight Recipe

The `starlight` recipe creates a documentation site inspired by Astro Starlight. It includes a sidebar, table of contents, prev/next navigation, and a blog.

## Scaffold

```bash
pnpm create @beatzball/litro my-docs
# choose: starlight
```

## Structure

```
my-docs/
  content/
    docs/
      getting-started.md
      configuration.md
    blog/
      welcome.md
  pages/
    index.ts              ← splash/home
    docs/[slug].ts        ← doc article
    blog/index.ts         ← blog listing
    blog/[slug].ts        ← blog post
    blog/tags/[tag].ts    ← tag listing
  src/
    components/           ← layout + UI components
  server/
    starlight.config.js   ← nav, sidebar, edit URL
  public/
    styles/starlight.css
  app.ts
  nitro.config.ts         ← uses ssgPreset()
  vite.config.ts
```

## Sidebar Configuration

Edit `server/starlight.config.js` to configure sidebar groups:

```js
export const siteConfig = {
  title: 'My Docs',
  sidebar: [
    {
      label: 'Getting Started',
      items: [
        { label: 'Introduction', slug: 'introduction' },
        { label: 'Installation', slug: 'installation' },
      ],
    },
  ],
  editUrlBase: 'https://github.com/you/repo/edit/main/docs',
};
```

## Syntax Highlighting

Code blocks in Markdown are automatically syntax-highlighted at SSG build time using `highlight.js`. Fenced code blocks with a language tag are highlighted with the fire palette theme:

````md
```ts
import { LitroPage } from '@beatzball/litro/runtime';
```
````

The fire theme uses a dark background with orange keywords, sky-blue strings, and amber numbers — matching the overall Litro color palette. No client-side JavaScript is required; highlighting is baked into the prerendered HTML.

## Shoelace Integration

The recipe includes Shoelace web components for enhanced UI elements (buttons, badges, copy buttons). Use Shoelace components directly in your Markdown via custom HTML, or in page components:

```html
<sl-button variant="primary">Get Started</sl-button>
<sl-copy-button value="pnpm create @beatzball/litro my-app"></sl-copy-button>
```
