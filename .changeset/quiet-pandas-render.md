---
"@beatzball/litro": patch
---

Keep a page's element registrations in the Nitro server bundle.

Nitro tells Rollup that every module is side-effect free, so a page's
`import './components/litro-card.js'` — the line that runs
`customElements.define()` — was deleted from the server bundle. The element was
never registered during SSR, so the server HTML carried a bare `<litro-card>`
tag with no shadow root and no content, and the build still exited 0.

The page scanner now marks the app's own source files as side-effectful, so
those imports survive. Dependencies are unchanged: they keep deciding through
their own `"sideEffects"` field.
