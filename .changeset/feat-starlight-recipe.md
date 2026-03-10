---
"@beatzball/create-litro": minor
---

Add `starlight` recipe — Astro Starlight-inspired docs + blog site scaffolded as Lit web components with full SSG support.

`npm create @beatzball/litro my-docs -- --recipe starlight` scaffolds a static docs + blog site with:

- **Layout components**: `<starlight-page>`, `<starlight-header>`, `<starlight-sidebar>`, `<starlight-toc>`
- **UI components**: `<sl-card>`, `<sl-card-grid>`, `<sl-badge>`, `<sl-aside>`, `<sl-tabs>`, `<sl-tab-item>`
- **Pages**: `/` (splash), `/docs/:slug`, `/blog`, `/blog/:slug`, `/blog/tags/:tag` — all SSG-prerendered
- **`--sl-*` CSS token layer** with dark/light mode toggle and no flash of unstyled content
- **`server/starlight.config.js`** — site title, nav links, sidebar groups
- SSG-only (no `--mode` flag needed)
