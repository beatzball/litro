---
title: Installation
description: Install dependencies and configure your Litro Starlight project.
sidebar:
  order: 2
---

## Package Manager

This project uses **pnpm** by default. You can also use `npm` or `yarn` — just replace `pnpm` in the commands below.

## Install

From the project root, run:

```bash
pnpm install
```

This installs all dependencies listed in `package.json`, including:

- **`@beatzball/litro`** — the Litro framework (pages plugin, SSR/SSG, content layer)
- **`lit`** — Lit web components library
- **`@lit-labs/ssr`** — server-side rendering via Declarative Shadow DOM
- **`@lit-labs/ssr-client`** — hydration support script

## TypeScript

The project ships with `tsconfig.json` preconfigured for Lit decorators:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "useDefineForClassFields": false
  }
}
```

These two settings are required for Lit's `@customElement`, `@state`, and `@property` decorators to work correctly with TypeScript's decorator transform.

## Environment

No environment variables are required for SSG mode. If you add API routes later, create a `.env` file at the project root.

## Verify

After installing, start the dev server:

```bash
pnpm dev
```

Navigate to `http://localhost:3030`. You should see the splash page with the sidebar navigation.
