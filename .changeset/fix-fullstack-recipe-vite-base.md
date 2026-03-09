---
"@beatzball/create-litro": patch
---

Fix fullstack recipe: add `base: '/_litro/'` to `vite.config.ts` and extend `LitroPage` in `[slug].ts`

Without `base: '/_litro/'`, Vite's compiled modulepreload URL resolver emits paths like `/assets/chunk.js` instead of `/_litro/assets/chunk.js`. These requests hit the Nitro catch-all page handler and return HTML, causing a MIME type error that leaves dynamic routes (e.g. `/blog/hello-world`) stuck on "Loading…".

Also fixes `pages/blog/[slug].ts` to extend `LitroPage` (not `LitElement`) and implement `fetchData()`, so client-side SPA navigation to different slugs correctly updates `serverData`.
