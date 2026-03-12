---
title: Welcome to Litro
description: Introducing Litro — a fullstack web framework built on Lit, Nitro, and Vite.
date: 2026-01-01
tags:
  - blog
  - announcement
---

# Welcome to Litro

We're excited to introduce **Litro** — a fullstack web framework that combines the best of:

- **Lit** — web components, no VDOM, no proprietary runtime
- **Nitro** — battle-tested server engine (the same one powering Nuxt)
- **Vite** — fast HMR and modern bundling

Litro brings these together with a seamless developer experience: file-system routing, streaming SSR, a built-in client router, and an optional content layer for Markdown-driven sites.

## What Makes Litro Different

Most frameworks bundle their component model and server into a single tightly-coupled system. Litro keeps them separate but integrated:

- Your components are standard web components — they work with or without the Litro server.
- The server is Nitro — you get every Nitro deployment adapter out of the box.
- SSR uses the W3C Declarative Shadow DOM spec, not a custom serialization format.

## Get Started

```bash
pnpm create @beatzball/litro my-app
```

Check out the [Getting Started](/docs/getting-started) guide for a full walkthrough.
