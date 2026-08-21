# Fixture: deliberately broken references

Used only by `node scripts/check-doc-refs.mjs --self-test`. Every reference on
this page is wrong on purpose. Each one is a real mistake that shipped in the
docs at some point and was caught in the 2026-06 audit. If the checker stops
flagging any of them, the self-test fails.

## Missing repo path

The scanner lives at `packages/framework/src/does-not-exist.ts` and the config
is `docs/no-such-file.md`.

## Invented export (audit item 4)

```ts
import { defineConfig } from '@beatzball/litro';
```

## Wrong package name (audit item 2)

```ts
import { LitroRouter } from 'litro-router';
```

## Element that does not exist (audit item 12)

<litro-client-only>
  <my-widget></my-widget>
</litro-client-only>
