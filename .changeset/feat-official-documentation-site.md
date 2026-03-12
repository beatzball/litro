---
"@beatzball/litro": minor
"@beatzball/litro-router": patch
"@beatzball/create-litro": minor
---

Add official documentation site and starlight recipe improvements

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
