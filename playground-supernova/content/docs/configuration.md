---
title: Configuration
description: Configure your Starlight site — title, navigation, sidebar, and theme.
sidebar:
  order: 3
---

## Site Config

All site-wide settings live in `server/starlight.config.js`:

```js
export const siteConfig = {
  title: 'My Docs',
  description: 'Documentation and blog powered by Litro',
  logo: null,
  editUrlBase: null,
  nav: [...],
  sidebar: [...],
};
```

### `title`

The site title shown in the header and used in `<title>` tags.

### `description`

A short description used in meta tags.

### `editUrlBase`

If set (e.g. `'https://github.com/you/repo/edit/main'`), each doc page shows an "Edit this page" link pointing to the source file on GitHub.

### `nav`

Top-level navigation links shown in the header:

```js
nav: [
  { label: 'Docs', href: '/docs/getting-started' },
  { label: 'Blog', href: '/blog' },
],
```

### `sidebar`

Sidebar groups, each with a label and array of items. Each item has a `label` and a `slug` (the filename without `.md` under `content/docs/`):

```js
sidebar: [
  {
    label: 'Start Here',
    items: [
      { label: 'Getting Started', slug: 'getting-started' },
      { label: 'Installation',    slug: 'installation' },
    ],
  },
],
```

## CSS Design Tokens

The visual theme is controlled by CSS custom properties in `public/styles/starlight.css`. Override any `--sl-*` variable to customize colors, fonts, and spacing:

```css
:root {
  --sl-color-accent: #7c3aed;    /* primary accent color */
  --sl-font-sans: ui-sans-serif, system-ui, sans-serif;
}
```

Dark mode tokens are under `[data-theme='dark'] { ... }`.

## Dark / Light Mode

The theme toggle button in the header reads and writes `localStorage.getItem('sl-theme')`. A FOUC-prevention inline script (injected via `routeMeta.head`) sets `data-theme` on `<html>` before first paint.
