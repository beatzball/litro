---
title: Contributing
description: How to contribute to Litro — running tests, submitting PRs, and the release workflow.
date: 2026-01-01
---

# Contributing

## Prerequisites

- Node.js 20+
- pnpm 9+

## Setup

```bash
git clone https://github.com/beatzball/litro.git
cd litro
pnpm install
```

## Build Packages

```bash
pnpm --filter @beatzball/litro-router build
pnpm --filter @beatzball/litro build
```

## Running Tests

```bash
# Unit tests
pnpm --filter @beatzball/litro-router test
pnpm --filter @beatzball/litro test
pnpm --filter @beatzball/create-litro test

# E2E tests (dev mode)
pnpm test:e2e
```

## Project Structure

```
litro/
  packages/
    framework/          ← @beatzball/litro (core)
    litro-router/       ← @beatzball/litro-router
    create-litro/       ← npm create @beatzball/litro
  playground/           ← fullstack recipe dev environment
  playground-11ty/      ← 11ty-blog recipe dev environment
  playground-starlight/ ← starlight recipe dev environment
  docs/                 ← this documentation site
  e2e/                  ← Playwright e2e tests
  research/             ← design research documents
```

## Submitting a PR

1. Fork the repository.
2. Create a branch: `git checkout -b feat/my-feature`
3. Make changes and add tests.
4. Run `pnpm --filter @beatzball/litro test` to verify.
5. Submit a pull request to `main`.

## Release Workflow

Releases use [Changesets](https://github.com/changesets/changesets). Add a changeset with `pnpm changeset`, then open a PR. The CI workflow bumps versions and publishes to npm when the changeset PR is merged.
