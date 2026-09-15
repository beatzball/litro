# Build and bundling rules

Most of these fail only in a production build or in an installed app. The
workspace dev loop and the unit tests pass.

### BUILD-001 — Packages that register custom elements declare `sideEffects`

A workspace package whose files call `customElements.define()` (directly or
through `@customElement`) lists those files in `"sideEffects"` in its
`package.json`.

**Why:** an import with no named bindings looks unused to Rollup, which builds
the Nitro server bundle. Rollup drops it, the element never registers on the
server, and SSR prints a bare tag with no shadow DOM. No error is raised.

**Check:** `packages/docs-ui/package.json` and `packages/framework/package.json`
both declare it. A bare, unrendered tag in server HTML is the symptom.

### BUILD-002 — Generated side-effect imports use `import * as` and a `globalThis` reference

In generated module code, such as an adapter's `manifestPreamble()`, write a
side-effect import as a namespace import and assign it to `globalThis`.

**Why:** Rollup removes a bare `import 'pkg/shim.js'` of an external package
that does not declare `sideEffects`. The shim never runs. A namespace binding
that is referenced cannot be proven unused.

```ts
// Do
`import * as _domShim from '@microsoft/fast-ssr/install-dom-shim.js';`,
`globalThis.__litro_dom_shim__ = _domShim;`,
// Don't
`import '@microsoft/fast-ssr/install-dom-shim.js';`,
```

**Check:** `manifestPreamble()` in `packages/framework/src/adapter/fast/index.ts`
and in `packages/framework/src/adapter/elena/index.ts`.

### BUILD-003 — Do not name a helper after an h3 auto-import

In a module that reaches the Nitro server bundle, do not name a local function
`sendStream`, `sendRedirect`, `readBody`, `getQuery`, `setCookie`, or any other
h3 utility. This includes browser modules that SSR pages import.

**Why:** Nitro auto-imports h3 utilities across the project. Its scanner does
not always see a local declaration (an `async function*` was missed), so it
injects `import { sendStream } from 'h3'` next to it. The build then fails with
"the symbol has already been declared". `litro dev` and vitest do not show it.

**Check:** run a production build (`pnpm --filter <app> build`), not only dev
and unit tests. `packages/litro-agent/src/client.ts` names its helper
`postTurnStream` for this reason.

### BUILD-004 — Never publish a `source` export condition

The published packages' `exports` maps have only `types`, `import` and
`require`. For live source in the workspace, use the alias from
`scripts/litro-source-alias.mjs`.

**Why:** in an installed app the package lives inside `node_modules`, and Vite 8
does not transform TypeScript there. A `source` condition that points at `.ts`
files ships raw decorators to the browser. The bundle throws a `SyntaxError`,
nothing hydrates, and the page stays blank. The build exits 0 and the SSR HTML
looks right. Shipping a tsconfig in the tarball does not help. Every e2e project
uses the workspace symlink, which is the one path where it works.

**Check:** `git grep -n '"source"' -- 'packages/*/package.json'` finds only the
private `packages/docs-ui`. `scripts/verify-scaffolded-apps.mjs` runs
`node --check` on each built bundle from packed tarballs.

### BUILD-005 — A clean rebuild must also delete `tsconfig.tsbuildinfo`

To force a real rebuild of a composite package, delete its
`tsconfig.tsbuildinfo` as well as `dist/`.

**Why:** `packages/framework`, `packages/litro-router`, `packages/litro-agent`
and `packages/create-litro` use `composite: true`. tsc writes
`tsconfig.tsbuildinfo` next to the tsconfig, not inside `dist/`. After
`rm -rf dist`, tsc reads the old build info, decides nothing changed, and emits
nothing. The build exits 0 with an empty `dist/`. A fresh CI checkout does not
have the file, so CI and local results differ.

```sh
rm -rf packages/<pkg>/dist packages/<pkg>/tsconfig.tsbuildinfo
pnpm --filter <pkg> build
```

**Check:** if a rebuild seems to do nothing, count the files in `dist/`.

### BUILD-006 — Modules shared by server and browser guard `process`

A module that browser code imports reads environment variables through
`globalThis.process?.env`, never bare `process.env` at the top level.

**Why:** in a production bundle the server-only exports are tree-shaken away, so
the bad read disappears. `litro dev` serves live source, which runs it in the
browser. `ReferenceError: process is not defined` then stops the whole client
module graph.

**Check:** `packages/docs-ui/src/route-meta.ts` and `packages/docs-ui/src/seo.ts`
show the guard. Test such a change in `litro dev`, not only in a build.
