---
"@beatzball/create-litro": minor
---

Add syntax highlighting to the starlight recipe. Code blocks in Markdown docs are now automatically highlighted at SSG build time using `highlight.js` with the fire palette theme (dark background, orange keywords, sky-blue strings, amber numbers). The `DocPage` component includes `static override styles` with all `.hljs-*` token rules so highlighting works correctly inside the Lit shadow DOM.
