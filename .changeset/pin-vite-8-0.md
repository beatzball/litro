---
'@beatzball/create-litro': patch
---

Pin `vite` to `~8.0.16` in every recipe template, so a new app cannot install Vite 8.1 or later.

From Vite 8.1 (Rolldown 1.1.5) onward, Rolldown can refuse to fold `lit-element`'s chunk into the entry chunk even though the entry statically reaches it. The entry then statically imports that chunk, so it evaluates before the entry's own body — which is where `@lit-labs/ssr-client/lit-element-hydrate-support.js` installs `globalThis.litElementHydrateSupport`. `LitElement` reads that hook exactly once, at module evaluation, finds nothing, and no element is ever patched. Hydration silently never runs: the build exits 0, nothing is logged, and the server-rendered DOM is thrown away and re-rendered on the client.

The templates declared `^8.0.16`, which installs 8.3.4 today, so every newly scaffolded app was exposed from the first build. `~8.0.16` keeps patch updates inside 8.0.x and holds 8.1 back.

This is a stopgap, not the fix. The real fix is a two-statement bootstrap entry — import the hydrate support, then `void import('./app-main.js')` — so the entry body cannot be preceded by any static import. Tracked in issue 236, along with a runtime assertion in `LitroOutlet` so that upgrading repairs apps already generated, and a build-time bundle check, since no test suite catches this.
