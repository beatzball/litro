# create-litro

## 0.2.0

### Minor Changes

- 78fdaf6: Add `starlight` recipe — Astro Starlight-inspired docs + blog site scaffolded as Lit web components with full SSG support.

  `npm create @beatzball/litro my-docs -- --recipe starlight` scaffolds a static docs + blog site with:

  - **Layout components**: `<starlight-page>`, `<starlight-header>`, `<starlight-sidebar>`, `<starlight-toc>`
  - **UI components**: `<sl-card>`, `<sl-card-grid>`, `<sl-badge>`, `<sl-aside>`, `<sl-tabs>`, `<sl-tab-item>`
  - **Pages**: `/` (splash), `/docs/:slug`, `/blog`, `/blog/:slug`, `/blog/tags/:tag` — all SSG-prerendered
  - **`--sl-*` CSS token layer** with dark/light mode toggle and no flash of unstyled content
  - **`server/starlight.config.js`** — site title, nav links, sidebar groups
  - SSG-only (no `--mode` flag needed)

## 0.1.4

### Patch Changes

- 76d3bc7: fix: client-side navigation links do not work on first load

  `<litro-link>` clicks were silently no-ops in scaffolded apps because of
  three compounding bugs.

  ***

  **Bug 1 — Empty route table on init** (`LitroOutlet`, `app.ts`)

  `app.ts` set `outlet.routes` inside a `DOMContentLoaded` callback (a
  macrotask). By that point Lit's first-update microtask had already fired,
  so `firstUpdated()` ran with `routes = []` and the router was initialised
  with no routes.

  _Fix — `LitroOutlet`_: Replace `@property({ type: Array }) routes` with a
  plain getter/setter. The setter calls `router.setRoutes()` directly when
  the router is already initialised, without going through Lit's render cycle
  (which would crash with "ChildPart has no parentNode" because
  `firstUpdated()` removes Lit's internal marker nodes to give the router
  ownership of the outlet's subtree).

  _Fix — `app.ts`_ (fullstack recipe template + playground): Set
  `outlet.routes` synchronously after imports rather than inside a
  `DOMContentLoaded` callback. Module scripts are deferred by the browser;
  by the time they execute the DOM is fully parsed and `<litro-outlet>` is
  present.

  ***

  **Bug 2 — Click handler never attached on SSR'd pages** (`LitroLink`)

  `@lit-labs/ssr` adds `defer-hydration` to custom elements inside shadow
  DOM. `@lit-labs/ssr-client` patches `LitElement.prototype.connectedCallback`
  to block Lit's update cycle when this attribute is present. A `@click`
  binding on the shadow `<a>` is a Lit binding — it is never attached until
  `defer-hydration` is removed, which only happens when the parent component
  hydrates. For page components that are never hydrated client-side (because
  the router replaces the SSR content before they load), `<litro-link>`
  elements inside them never receive a click handler.

  This is why the playground appeared to work: its home page has no
  `<litro-link>` elements. The fullstack generator template does, so clicks
  on the SSR'd page were silently ignored.

  _Fix_: Move the click handler from a `@click` binding on the shadow `<a>`
  to the HOST element via `addEventListener('click', ...)` registered in
  `connectedCallback()` (before `super.connectedCallback()`). The host
  listener runs in `LitroLink`'s own `connectedCallback` override, which
  executes before the `@lit-labs/ssr-client` patch checks for
  `defer-hydration`. This ensures the handler is active immediately after the
  element connects to the DOM, even for SSR'd elements on first load.

  The shadow `<a>` is kept without a `@click` binding — it exists for
  progressive enhancement (no-JS navigation) and accessibility (cursor,
  focus, keyboard navigation).

  ***

  **Bug 3 — `_resolve()` race condition** (`LitroRouter`)

  `setRoutes()` calls `_resolve()` immediately for the current URL. If the
  user clicks a link before that initial `_resolve()` completes (e.g. while
  the page action's dynamic import is in flight), a second `_resolve()` call
  starts concurrently. If the first call (for `/`) completes after the second
  (for `/blog`), it overwrites the blog page with the home page.

  _Fix_: Add a `_resolveToken` monotonic counter. Each `_resolve()` call
  captures its own token at the start and checks it after every `await`. If
  the token has advanced, a newer navigation superseded this one and the call
  returns without touching the DOM.

  ***

  **Bug 4 — `@property()` decorators silently dropped by esbuild TC39 transform** (`LitroLink`)

  esbuild 0.21+ uses the TC39 Stage 3 decorator transform. In that mode,
  Lit's `@property()` decorator only handles `accessor` fields; applied to a
  plain field (`href = ''`) it is silently not applied. As a result `href`,
  `target`, and `rel` were absent from `observedAttributes`, so
  `attributeChangedCallback` was never called during element upgrade, leaving
  `this.href = ''` forever regardless of what the HTML attribute said.

  _Fix_: Replace the three `@property()` field decorators with a
  `static override properties = { href, target, rel }` declaration. Lit reads
  this static field at class-finalization time via `finalize()`, which runs
  before the element is defined in `customElements`, ensuring the properties
  are correctly registered in `observedAttributes`.

  ***

  Adds a new `LitroOutlet.test.ts` test file (6 tests) covering the
  synchronous and late-assignment code paths, the setter guard, SSR child
  clearing, and the `LitroRouter` constructor call.

  Updates `LitroLink.test.ts` (12 tests) to dispatch real `MouseEvent`s on
  the host element (exercising the `addEventListener` path) rather than
  calling the private handler directly by name.

  ***

  **Template fix — `@state() declare serverData` incompatible with jiti/SSG**

  The fullstack recipe template used `@state() declare serverData: T | null` to
  narrow the `serverData: unknown` type inherited from `LitroPage`. The `declare`
  modifier emits no runtime code, but jiti's oxc-transform (used in SSG mode to
  load page files) throws "Fields with the 'declare' modifier cannot be
  initialized here" under TC39 Stage 3 decorator mode.

  _Fix_: Remove `@state() declare serverData` from both page templates. Use a
  local type cast in `render()` instead: `const data = this.serverData as T | null`.
  The property is already reactive (declared as `@state() serverData = null` in
  `LitroPage`). Updated `LitroPage.ts` JSDoc and `DECISIONS.md` to document this
  pattern and warn against `declare` fields in subclasses.

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
