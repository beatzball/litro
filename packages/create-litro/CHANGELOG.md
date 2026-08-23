# create-litro

## 0.9.0

### Minor Changes

- eb70043: Add a "Created using Litro" credit line to every scaffolded site.

  A new `<litro-footer>` component ships in all three recipes and all three
  adapters — Lit, FAST and Elena — and names the recipe the project came from:
  "Created using Litro, starlight recipe", linking to litro.dev. It is a quiet
  line at the bottom of the page and a comment above it says how to remove it.

  The starlight recipe places it in the shared `starlight-page` layout, so docs,
  blog and tag pages all get it from one place, plus the splash page which does
  not use that layout. The fullstack and 11ty-blog recipes have no shared layout,
  so each page places it directly.

  Scaffolding now interpolates `{{recipe}}`, which is what lets one component
  file name the recipe it was scaffolded into.

  FAST needs a property binding rather than a plain attribute at the usage site:
  fast-ssr does not map attributes onto properties, so `recipe="starlight"`
  server-renders the credit without the recipe name. Measured, not assumed.

  `scripts/verify-scaffolded-apps.mjs` now asserts the credit survives to
  rendered output for all six variants, reading the prerendered HTML where the
  recipe prerenders and the server bundle where it does not. That check is what
  caught the FAST problem, which compiled and built cleanly.

## 0.8.0

### Minor Changes

- 7ddd33b: Add `--for-repo`, which turns a scaffolded starlight site into a specific
  project's documentation site.

  ```sh
  npm create @beatzball/litro@latest -- site \
    --recipe starlight --for-repo . --site-url https://example.dev
  ```

  It reads the repository's name, description, remote and default branch, then
  writes `_data/metadata.js`, `server/starlight.config.js` (title, nav with a
  GitHub link, and "Edit this page" links pointing at the right branch and
  subdirectory), a `Dockerfile` + `nginx.conf` deploy, and an `AGENTS.md` that
  tells any coding agent how to add a page correctly.

  The sample blog is removed by default (`--with-blog` keeps it) — including the
  landing page's link to it and the blog routes in the generated e2e spec, so a
  new site has no dead link and its own test suite passes.

  It does **not** write your documentation. Turning a README into good pages is a
  judgement call, so it leaves one honest placeholder page and points the agent
  at `AGENTS.md`.

  Every lookup degrades rather than failing: with no git remote it falls back to
  the directory name, sets `editUrlBase: null`, omits the GitHub nav entry, and
  prints what you still need to fill in. Works offline and without `gh`.

  Other flags: `--site-url <url>`, `--deploy <docker|none>`, `--with-blog`.

  `packageManager` is now pinned in the scaffolded `package.json` to the pnpm
  that ran the scaffold, so the Docker build uses the same pnpm that produced
  the lockfile instead of whatever corepack resolves as newest.

## 0.7.3

### Patch Changes

- cec1777: Scaffolded apps now actually get a `.gitignore`.

  npm strips `.gitignore` from every published tarball — it is on npm's own
  exclusion list with no way to opt out via `files`. The recipe templates stored
  the file under its final name, so it shipped fine from a local build and
  silently vanished for anyone installing from the registry. Every app created
  with `npm create @beatzball/litro` arrived with **no ignore rules at all**, so
  its first `git add` swept in `node_modules/`, `dist/`, the generated stubs, and
  any `.env`.

  The templates now store it as `gitignore` and the scaffolder renames it on
  copy. `.gitkeep` and `.11tydata.json` are unaffected — npm's exclusion list is
  specific, not "all dotfiles".

  The `scaffolded-apps` CI guard now scaffolds from the **packed tarball** rather
  than the local build, and asserts the resulting app has a `.gitignore` covering
  `node_modules/`, `dist/` and `server/stubs/`. Running the local build was why
  this class of bug was invisible: a tarball is not the source directory with a
  different name.

## 0.7.2

### Patch Changes

- 83c8d5a: Scaffolded apps no longer list `'source'` in `resolve.conditions`. An installed
  package's TypeScript is never transpiled by Vite, so resolving to source emitted
  raw decorators and produced a client bundle no browser could parse — a blank
  page from a build that reported success. Templates now consume the packages'
  compiled output.

  Affected the `fullstack`, `11ty-blog`, and `starlight` recipes on the `lit` and
  `fast` adapters, on Vite 8. The `elena` adapter was unaffected.

- 7c93db8: Two fixes to what a scaffolded app ships:

  **Generated stubs are no longer committable.** The templates ignored
  `server/stubs/page-manifest.ts` (and the fullstack action stubs) by name, but
  the scanners also emit `litro-content.js` and `agent-*.ts`, and several of
  those embed the absolute filesystem path of the machine that built them. A new
  app would commit a local path on its first `git add`. The whole
  `server/stubs/` directory is now ignored, so a newly added scanner cannot
  silently start leaking one. `server/plugins/litro-actions.ts` is unaffected —
  it lives outside `stubs/` and stays tracked, as intended.

  **End-to-end tests no longer run against whatever else owns port 3000.** The
  generated `playwright.config.ts` hardcoded port 3000 with
  `reuseExistingServer`. If any unrelated app was already listening there,
  `litro dev` moved to the next free port while Playwright ran the entire suite
  against the stranger and reported confusing 404s. The config now uses port
  4321 (override with `LITRO_E2E_PORT`), passes `--port` to `litro dev`, and
  never reuses an existing server.

## 0.7.1

### Patch Changes

- e576f80: Bump `nitropack` from `^2.13.1` to `^2.13.4` in scaffolded recipe templates, resolving Medium-severity advisories GHSA-5w89-w975-hf9q and GHSA-9phm-9p8f-hw5m.
- 16d2705: Recipe templates' `server/middleware/vite-dev.ts` now builds its dev Vite server from `litroViteDevConfig()` (and pre-warms the client entry via `warmupLitroViteServer()`), so scaffolded apps get the live-source dev entry fix for issue 97 instead of serving a stale pre-built bundle.

## 0.7.0

### Minor Changes

- 7602471: The fullstack template ships with Server Actions pre-wired: actions plugin and endpoint handler in `nitro.config.ts`, `no-store` route rule, `#litro/action-manifest` import mapping, `litroActionsPlugin()` in `vite.config.ts`, form enhancer in `app.ts`, and a demo `greet` action with a progressive-enhancement form on the home page.

## 0.6.0

### Minor Changes

- 1f4d669: Scaffolded projects now use Vite 8 (was Vite 5). All recipe templates (fullstack, 11ty-blog, starlight) across the Lit, FAST, and Elena adapters pin `vite` to `^8`. New projects require Node `^20.19.0 || >=22.12.0`.

### Patch Changes

- 658550d: Fix port mismatch and stale references in scaffolder output and recipe templates: post-scaffold success message, recipe playwright configs, and recipe content all said `localhost:3030` while the default Litro dev server listens on `3000`.
- fe81671: npm metadata and scaffolder docs: rewrite the package description and keywords to mention all three adapters (Lit / FAST / Elena), and fix the README's Deno scaffold command (`deno init --npm @beatzball/litro my-app` — the older `deno create npm:…` form was removed in Deno 2.x).

## 0.5.2

### Patch Changes

- 08cf41c: Add dev:portless and preview:portless scripts to recipe templates

## 0.5.1

### Patch Changes

- 97baa72: Update Elena template dependencies to @elenajs/core 1.0.0 and @elenajs/ssr 1.0.0-alpha.10

## 0.5.0

### Minor Changes

- d459a96: Add `--adapter` flag for selecting framework adapter (lit/fast)
- 8c081a8: Add `--adapter elena` option with fullstack recipe template for Elena (light DOM web components).
- b66734f: Add Elena framework adapter template for the starlight recipe
- 44196c4: Add per-adapter template overlay support and FAST Element starlight recipe template

## 0.4.2

### Patch Changes

- 035912e: feat: starlight recipe uses `skipLinks` array API with `DEFAULT_SKIP_LINKS`

## 0.4.1

### Patch Changes

- 619ec3c: feat(seo): inject seoHead and seoTitle from pageData into HTML shell

  Pages can now return `seoHead` (a string of meta/JSON-LD tags) and `seoTitle` from `definePageData()`. The framework extracts these at request time and injects them into the actual `<head>` element of the HTML response — not buried in the `__litro_data__` JSON blob.

  Also bumps the `h3` dependency to `>=1.15.6` to patch CVE GHSA-22cc-p3c6-wpvm.

  Also improves npm discoverability: updated descriptions and keywords for all three packages, and rewrote the framework README with a Hello World example, comparison table, and SEO section.

## 0.4.0

### Minor Changes

- 1cd1e7f: Add syntax highlighting to the starlight recipe. Code blocks in Markdown docs are now automatically highlighted at SSG build time using `highlight.js` with the fire palette theme (dark background, orange keywords, sky-blue strings, amber numbers). The `DocPage` component includes `static override styles` with all `.hljs-*` token rules so highlighting works correctly inside the Lit shadow DOM.
- 1a84fad: Add responsive hamburger menu to the starlight recipe. A hamburger button appears to the left of the site logo on screens ≤72rem where the sidebar is hidden. Clicking it opens/closes the sidebar as a fixed drawer overlay with a backdrop. The nav auto-closes on route change.

## 0.3.0

### Minor Changes

- 2456382: Add official documentation site and starlight recipe improvements

  **`@beatzball/litro`**

  - Add `LITRO_BASE_PATH` env var support in `create-page-handler.ts` — prefixes the `/_litro/app.js` script URL for sub-path deployments (e.g. GitHub Pages project sites at `owner.github.io/repo/`)
  - Fix Lit hydration mismatch on SSR'd pages: `LitroPage.connectedCallback()` now peeks at the `__litro_data__` script tag to set `serverData` before Lit's first render, without consuming the tag
  - Fix layout shift on navigation: `LitroOutlet.firstUpdated()` no longer eagerly clears SSR children — the router's atomic swap handles it

  **`@beatzball/litro-router`**

  - Atomic DOM swap in `_resolve()`: new element is appended hidden alongside old SSR content, waits for `updateComplete` + `requestAnimationFrame`, then old content is removed and new element revealed — eliminates blank flash and layout shift during navigation
  - `_lastPathname` guard prevents re-render on hash-only `popstate` events (TOC / fragment link clicks)

  **`@beatzball/create-litro`**

  - Starlight recipe: rename `sl-card`, `sl-card-grid`, `sl-badge`, `sl-tabs`, `sl-tab-item`, `sl-aside` → `litro-card`, `litro-card-grid`, `litro-badge`, `litro-tabs`, `litro-tab-item`, `litro-aside` to avoid collision with Shoelace's registered custom element names
  - Starlight recipe: integrate Shoelace (`@shoelace-style/shoelace`) — tree-shaken component imports in `app.ts`, icon assets at `/shoelace/assets/`, theme CSS at `/shoelace/themes/`; `sl-button` and `sl-icon-button` now available in all scaffolded starlight sites
  - Starlight recipe: `litro-card` improvements — equal-height cards via flex column, icon + title rendered inline side-by-side, new `iconSrc` prop for image-based icons
  - Starlight recipe: sticky header via `:host { position: sticky }` (works correctly across shadow DOM boundary); sticky TOC matching sidebar behaviour
  - Starlight recipe: theme script falls back to `prefers-color-scheme` when no localStorage preference is set
  - Add `docs/` workspace (`@beatzball/litro-docs`) — official Litro documentation site built on the starlight recipe, deployed to GitHub Pages via `.github/workflows/docs.yml`

## 0.2.1

### Patch Changes

- 338e2c7: Add Playwright e2e setup to all recipe templates. Each scaffolded project now includes `playwright.config.ts` and `e2e/index.spec.ts` with 3 starter tests, and `@playwright/test` in `devDependencies`.

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
