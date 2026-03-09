# create-litro

## 0.1.3

### Patch Changes

- bfd8f9a: Fix fullstack recipe: add `base: '/_litro/'` to `vite.config.ts` and extend `LitroPage` in `[slug].ts`

  Without `base: '/_litro/'`, Vite's compiled modulepreload URL resolver emits paths like `/assets/chunk.js` instead of `/_litro/assets/chunk.js`. These requests hit the Nitro catch-all page handler and return HTML, causing a MIME type error that leaves dynamic routes (e.g. `/blog/hello-world`) stuck on "Loading…".

  Also fixes `pages/blog/[slug].ts` to extend `LitroPage` (not `LitElement`) and implement `fetchData()`, so client-side SPA navigation to different slugs correctly updates `serverData`.

## 0.1.2

### Patch Changes

- 19f4909: Fix recipe templates using unscoped `litro/runtime/...` imports instead of `@beatzball/litro/runtime/...`, and bump `nitropack` devDependency to `^2.13.1`.

## 0.1.1

### Patch Changes

- 6a8da0e: Update all README references to use `@beatzball` scoped package names following the rename in v0.1.0. Fixes install commands, `pnpm --filter` flags, `npm create` commands, and import paths.

## 0.1.0

### Minor Changes

- 618a9b8: Rename all packages to `@beatzball` scope. The unscoped `litro` package was blocked by npm's name-similarity protection (too close to `lit`, `listr`, etc.). All three packages are now published under the `@beatzball` org scope:

  - `litro` → `@beatzball/litro`
  - `litro-router` → `@beatzball/litro-router`
  - `create-litro` → `@beatzball/create-litro`

  The previously published unscoped `litro-router@0.0.2` and `create-litro@0.0.2` are deprecated on npm with a redirect notice.

## 0.0.2

### Patch Changes

- 4552934: Add `license`, `repository`, and `publishConfig` fields to all published packages; configure Changesets for automated version management, per-package changelogs, and npm publishing via GitHub Actions.
