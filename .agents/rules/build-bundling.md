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

### BUILD-007 — A page's element imports survive only because the pages plugin runs

`pagesPlugin` marks the app's own modules as side-effectful for the Nitro
server bundle. An app whose `nitro.config.ts` skips `pagesPlugin`, or a build
path that composes the page manifest by hand, loses that and renders bare tags.

**Why:** Nitro sets Rollup's `treeshake.moduleSideEffects` to a function that
answers `false` for every module outside its own runtime. A page's
`import './components/litro-card.js'` binds no names, so Rollup deletes it, the
element is never registered on the server, and SSR prints `<litro-card>` with
no shadow root. The build exits 0. `litro dev` does not show it — dev serves
live source and never runs Rollup. An SSG build can also hide it by accident:
the SSG plugin loads every DYNAMIC page through jiti to call
`generateRoutes()`, which registers that page's elements in the same process
the prerenderer uses. Elements reachable only from a STATIC page get no such
rescue, which is why two components from one page file behaved differently.

A dependency is not covered — it keeps its own `"sideEffects"` field
(BUILD-001), which is how `packages/docs-ui` has always worked.

**Check:** `packages/framework/src/plugins/side-effects.ts` and the call to it
at the top of `pagesPlugin`. To test a built site without the jiti rescue,
render from the bundle alone:

```sh
node --input-type=module -e "
const m = await import('./<app>/.nitro/prerender/index.mjs');
console.log(await (await m.localFetch('/')).text());
"
```

A tag with no `<template shadowrootmode>` there is an unregistered element.
`scripts/verify-scaffolded-apps.mjs` pins the rendered result.

### BUILD-008 — The framework's own elements are registered from `manifestPreamble()`

Every adapter's `manifestPreamble()` imports its `LitroLink` module, as a
namespace binding assigned to `globalThis` (BUILD-002). Do not move that
import into an app, a page or the runtime barrel.

**Why:** `<litro-link>` builds its `<a href>` in `render()`. An element that is
not in the server's custom element registry renders as a bare
`<litro-link href="/docs">` with no shadow root, so the href sits on a custom
element the browser will not follow and the link is unclickable text without
JavaScript. The runtime barrel cannot fix it: it re-exports `LitroLink` as a
NAME, and Rollup drops a re-export nothing uses (BUILD-007). `litro dev` never
shows it, because dev serves live source and never runs Rollup.

`docs-ssr` was held up for a while by one bare side-effect import in
`pages/index.ts`. The server is a single bundle, so that one line registered
the element for every other page too — and deleting it took all 96 links on the
site down at once, silently. The manifest is the one module guaranteed to reach
the server bundle, so registration belongs there.

**Check:** `node scripts/check-ssr-links.mjs` boots the built `docs-ssr` server
and fails on any `<litro-link>` served without a shadow root. It runs in the
Build docs-ssr job. Serve the app from ITS OWN directory — the home page reads
a path relative to the process cwd, and from the repo root that fetcher throws,
the handler falls back to the client-only shell, and the page has no
`<litro-link>` in it to check.
