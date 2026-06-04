---
title: "How Nitro's Deployment Adapters Work — and Why Litro Gets Them for Free"
description: "Nitro powers both Nuxt.js and Litro. That means every Nitro deployment preset — Vercel, Cloudflare Workers, AWS Lambda, Deno Deploy — works in Litro without a single line of custom adapter code."
date: 2026-03-22
tags: [nitro, deployment, cloudflare, vercel]
---

# How Nitro's Deployment Adapters Work — and Why Litro Gets Them for Free

Litro doesn't ship deployment adapters. It doesn't need to. Every deployment target Litro supports — Vercel, Cloudflare Workers, AWS Lambda, Netlify, Deno Deploy, Bun, Node.js standalone — comes from Nitro, the server engine underneath.

This post explains what Nitro presets actually do, which ones work with Litro, and the two edge-specific considerations you need to know about before deploying a Lit SSR app to a Workers environment.

## What Nitro Is

Nitro is the server engine that powers Nuxt.js. It's a standalone package (`nitropack`) that handles routing, middleware, API handlers (via H3), and — most importantly — output targets.

Litro's server is a Nitro server. The `litro.config.ts` you write in your project is a thin wrapper around `nitro.config.ts`. Every H3 handler, every middleware, every route rule you configure goes through Nitro. If you've used Nuxt, you've already used Nitro.

Analog (the Angular meta-framework) also builds on Nitro. So does SolidStart. Litro is one of several frameworks that made the same bet: use Nitro for the server layer and inherit everything it provides. For a comparison of how this plays out vs Nuxt specifically, see [Litro vs Nuxt.js](/compare/nuxt).

## What a Preset Is

A Nitro "preset" is a self-contained output configuration that transforms the server into a form suitable for a specific runtime. When you run a build with a preset, Nitro:

1. Bundles the server into a single entry file (or a set of files)
2. Transforms imports to match the target runtime's available APIs
3. Generates any runtime-specific wrapper code or configuration files
4. Copies assets into the output directory structure the target expects

The output of `NITRO_PRESET=vercel litro build` is a directory structure that matches exactly what Vercel's build infrastructure expects to find. No Litro-specific code is involved — Nitro handles it entirely.

## Available Presets

These presets work with Litro today:

| Preset | Command | Output |
|--------|---------|--------|
| `node` (default) | `litro build` | `dist/server/server/index.mjs` — Node.js ESM server |
| `node-cluster` | `NITRO_PRESET=node-cluster litro build` | Clustered Node.js for multi-core use |
| `vercel` | `NITRO_PRESET=vercel litro build` | `.vercel/output/` directory |
| `cloudflare-workers` | `NITRO_PRESET=cloudflare-workers litro build` | `dist/` for `wrangler publish` |
| `cloudflare-pages` | `NITRO_PRESET=cloudflare-pages litro build` | `dist/` for Cloudflare Pages |
| `netlify` | `NITRO_PRESET=netlify litro build` | `.netlify/` directory |
| `aws-lambda` | `NITRO_PRESET=aws-lambda litro build` | Lambda handler bundle |
| `deno-deploy` | `NITRO_PRESET=deno-deploy litro build` | Deno-compatible output |
| `bun` | `NITRO_PRESET=bun litro build` | Bun-compatible server |
| `static` | `litro build --mode static` (or `litro generate`) | Pre-rendered static HTML; the static preset is selected automatically when Litro is in SSG mode |

The `static` preset is what `litro build` uses when you configure SSG mode. The others are SSR presets.

You can also set the preset in your config:

```ts
// litro.config.ts
import { defineNitroConfig } from 'nitropack/config';

export default defineNitroConfig({
  preset: 'vercel',
});
```

Or via environment variable, which is useful for CI where you want one config file to target different environments:

```bash
NITRO_PRESET=cloudflare-workers litro build
```

## Edge Adapters — Two Things to Know

Deploying to Cloudflare Workers or Vercel Edge requires two configuration additions. Both are in `nitro.config.ts`.

### 1. Inline `@lit-labs/ssr`

Cloudflare Workers and Vercel Edge Functions don't use Node.js module resolution — they run in a V8 isolate. `@lit-labs/ssr` relies on `node:` built-ins in some of its internal paths.

By default, Nitro marks `@lit-labs/ssr` as an external dependency and expects the runtime to provide it. Edge runtimes can't. The fix is to tell Nitro to inline it — bundle it directly into the output:

```ts
// nitro.config.ts
export default defineNitroConfig({
  preset: 'cloudflare-workers',
  externals: {
    inline: ['@lit-labs/ssr', '@lit-labs/ssr-client'],
  },
});
```

Without this, you'll get a module-not-found error at runtime on Workers.

### 2. Streaming API Differences

`RenderResultReadable` from `@lit-labs/ssr` is a Node.js `Readable` stream. Node.js `Readable` is not available in Cloudflare Workers.

Litro's page handler uses Nitro's `sendStream()`, which accepts either a Node.js `Readable` or a standard WHATWG `ReadableStream`. For edge targets, you need to convert:

```ts
import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';

// Node.js targets — use RenderResultReadable directly
import { RenderResultReadable } from '@lit-labs/ssr/lib/render-result-readable.js';
const readable = new RenderResultReadable(renderResult);
return sendStream(event, readable);

// Edge targets — convert to WHATWG ReadableStream
const html = await collectResult(renderResult);
return html;
```

Litro's built-in page handler detects the runtime automatically. If you're writing a custom handler for an edge target, keep this difference in mind.

## Vercel Deployment Example

```bash
# Build for Vercel
NITRO_PRESET=vercel litro build

# The .vercel/output directory is ready for deployment
vercel deploy --prebuilt
```

The output follows Vercel's [Build Output API](https://vercel.com/docs/build-output-api/v3). The SSR function lands in `.vercel/output/functions/index.func/`, static assets in `.vercel/output/static/`.

## Cloudflare Workers Example

```bash
# Build for Cloudflare Workers
NITRO_PRESET=cloudflare-workers litro build

# Deploy with Wrangler
wrangler publish dist/server/index.mjs
```

The `wrangler.toml` for a Litro Workers deployment:

```toml
name = "my-litro-app"
main = "dist/server/index.mjs"
compatibility_date = "2025-09-01"

[site]
bucket = "./dist/server/public"
```

Static assets are served by the Worker via KV bindings — Nitro generates the necessary asset manifest automatically.

## Coolify and Self-Hosted Node.js

For self-hosted deployments, the default `node` preset builds a standalone Node.js server. Litro's docs cover [deploying to Coolify](/docs/deployment/coolify) and [GitHub Pages](/docs/deployment/github-pages) in detail.

The Node.js output:

```bash
litro build
node dist/server/server/index.mjs
```

The server listens on `PORT` (default 3000) and serves both the SSR handler and static assets from the same process.

## How This Compares to Next.js

Next.js deployment adapters for non-Vercel targets are community-maintained. The official documentation targets Vercel; AWS, Cloudflare, and other adapters are separate packages with their own maintenance burden and compatibility lag.

Nitro's presets are first-party, used by Nuxt.js, and maintained by the UnJS team. When Cloudflare changes its Workers API, the Nitro preset is updated — and Litro inherits the fix without any action on our end.

This is the same shared-foundation argument made on the [Litro vs Nuxt.js](/compare/nuxt) page. The server layer is not a differentiator. Using the same server as Nuxt means using the same battle-tested deployment infrastructure.

## The Framework Maintenance Difference

When you evaluate a new framework, deployment adapter maintenance is often invisible until it isn't. The question isn't "does it have a Cloudflare adapter today?" — it's "who maintains that adapter and what's the upgrade path when the underlying platform changes?"

Litro's answer: the same team that maintains Nuxt's server layer.

Ready to deploy? See [Getting Started](/docs/getting-started) for the full setup, or check the [Coolify deployment guide](/docs/deployment/coolify) for a self-hosted walkthrough.
