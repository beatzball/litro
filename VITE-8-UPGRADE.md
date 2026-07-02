# Upgrading a Litro project to Vite 8

Litro has moved from Vite 5 to **Vite 8** (Rolldown + Oxc bundler). For most
projects this is a one-line dependency bump plus a Node version check — no
config changes are required.

## TL;DR

```jsonc
// package.json
{
  "devDependencies": {
    "vite": "^8.0.16"   // was ^5.x
  }
}
```

```bash
pnpm install   # or npm install / yarn
```

Then make sure you are on a supported Node version (see below) and run
`litro build` / `litro dev` as usual.

## What changed

| Area | Before (Vite 5) | After (Vite 8) | Action |
|------|-----------------|----------------|--------|
| Bundler | Rollup + esbuild | Rolldown + Oxc | none — faster builds, same output |
| Node baseline | Node 18+ | **Node `^20.19.0` or `>=22.12.0`** | upgrade Node if on 18 |
| `vite.config.ts` | `build.rollupOptions` | accepted via compat layer | none required |
| Lit decorators | esbuild reads `tsconfig` | Oxc reads `tsconfig` | none — `@customElement` etc. compile unchanged |

## Things you do **not** need to change

- **`vite.config.ts`** — `base`, `resolve.conditions`, `build.outDir`, and
  `build.rollupOptions` (input / `entryFileNames`) all keep working. Vite 8's
  compatibility layer maps `rollupOptions` automatically with no warning.
- **`tsconfig.json`** — `experimentalDecorators` / `useDefineForClassFields`
  are honored by Oxc exactly as before. Lit (and FAST/Elena) components compile
  with no changes.
- **`nitro.config.ts`** — unaffected by this upgrade. (Litro stays on Nitro 2;
  a separate Nitro 3 upgrade is not part of this release.)
- **`server/api/**` handlers** — unaffected.

## Node version

Vite 8 requires Node `^20.19.0 || >=22.12.0`. If you are on Node 18 (now EOL),
upgrade before bumping Vite. Check with:

```bash
node -v
```

## Optional: opt into newer behavior

Vite 8's default `build.target` is now `baseline-widely-available`. If you need
to support older browsers, set an explicit `build.target` in `vite.config.ts`.

## Troubleshooting

- **`Executable doesn't exist ... chrome-headless-shell` (Playwright):** unrelated
  to Vite — run `npx playwright install chromium chromium-headless-shell`.
- **Circular import warnings:** Rolldown surfaces circular-import warnings that
  Rollup stayed silent about. These are warnings, not errors, and indicate
  pre-existing cycles in your code.
