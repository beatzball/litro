---
title: GitHub Pages
description: Deploy your Litro SSG site to GitHub Pages using GitHub Actions.
date: 2026-01-01
---

# GitHub Pages

Deploy your Litro SSG site to GitHub Pages using the included GitHub Actions workflow.

## Setup

1. Enable GitHub Pages in your repository settings (Settings → Pages → Source: GitHub Actions).

2. Add `.nojekyll` to your `public/` directory to prevent Jekyll from filtering files with leading underscores.

3. Add the deployment workflow (`.github/workflows/docs.yml`):

```yaml
name: Deploy Docs
on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm --filter @beatzball/litro-router build
      - run: pnpm --filter @beatzball/litro build
      - run: pnpm --filter @beatzball/litro-docs build
        env:
          LITRO_BASE_PATH: /litro
          SITE_URL: https://beatzball.github.io/litro
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs/dist/static
```

## Custom Domain

If using a custom domain (e.g. `litro.dev` served at `/`):

1. Remove `LITRO_BASE_PATH` from the workflow env.
2. Update `SITE_URL` to your domain.
3. Add a `CNAME` file to `docs/public/` with your domain name.

No other code changes needed — `LITRO_BASE_PATH` defaults to `''` and the asset paths resolve correctly.

## Important Notes

- `dist/static/.nojekyll` must be present for GitHub Pages to serve `_litro/` assets (underscore prefix).
- The `LITRO_BASE_PATH=/litro` env var prefixes the `/_litro/app.js` script URL to `/litro/_litro/app.js`, matching the GitHub Pages project site sub-path.
