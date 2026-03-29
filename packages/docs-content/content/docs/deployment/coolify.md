---
title: Coolify
description: Deploy your Litro site to Coolify using static site build pack or Docker.
date: 2026-01-01
---

# Coolify

Litro SSG builds can be deployed to [Coolify](https://coolify.io) as a static site or via Docker.

## Static Site Build Pack

In your Coolify project:

- **Build command:**
  ```bash
  pnpm --filter @beatzball/litro-router build && pnpm --filter @beatzball/litro build && pnpm --filter @beatzball/litro-docs build
  ```
- **Publish directory:** `docs/dist/static`
- **Environment variables:** Set `SITE_URL` to your domain.

## Docker

Use the included `Dockerfile` + `nginx.conf` in `docs/`:

```bash
docker build -f docs/Dockerfile -t litro-docs .
docker run -p 80:80 litro-docs
```

The Docker image:
- Builds the SSG output in a multi-stage Node.js build
- Copies `dist/static/` to nginx
- Configures clean-URL routing (directory index + try_files)
- Sets 1-year immutable caching headers for `/_litro/` and `/shoelace/` assets
