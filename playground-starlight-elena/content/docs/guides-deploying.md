---
title: Deploying
description: Deploy your Litro Starlight docs site to any CDN or static hosting platform.
sidebar:
  order: 5
---

## Build

Generate the static HTML output:

```bash
pnpm build
```

This runs `litro build` under the hood, which:

1. Scans `pages/` to discover all routes
2. Calls `generateRoutes()` on each dynamic page to enumerate all paths
3. Pre-renders every path to a `.html` file in `.output/public/`

## Output

After a successful build, the static site is in `.output/public/`. You can serve this directory from any web server or CDN.

## Platforms

### Vercel

```bash
# vercel.json
{
  "outputDirectory": ".output/public"
}
```

Or connect the repository in the Vercel dashboard — Vercel detects the static output automatically.

### Netlify

```toml
# netlify.toml
[build]
  command = "pnpm build"
  publish = ".output/public"
```

### Cloudflare Pages

Set the build output directory to `.output/public` in the Cloudflare Pages dashboard.

### GitHub Pages

Add a GitHub Actions workflow:

```yaml
- name: Build
  run: pnpm build

- name: Deploy
  uses: peaceiris/actions-gh-pages@v3
  with:
    github_token: GITHUB_TOKEN  # set via repository secrets
    publish_dir: .output/public
```

## Custom Domain

Configure the custom domain in your hosting provider's dashboard. No Litro-specific changes are needed — the static output is plain HTML, CSS, and JS.

## Preview Locally

Before deploying, preview the production build locally:

```bash
pnpm preview
```

This serves the `.output/` directory using Nitro's static preset server on `http://localhost:3030`.
