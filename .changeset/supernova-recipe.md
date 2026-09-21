---
'@beatzball/create-litro': minor
---

Add the `supernova` recipe: the starlight docs site with a product landing page in front of it.

`supernova` extends `starlight`, so its own template holds one file — the landing page. The docs half, the blog and the shared components are copied in from starlight and are never committed twice. Scaffold it with `--recipe supernova`, and answer its `blog` question with `--blog` or `--no-blog`.

The landing page is built only from components the starlight template already ships (`starlight-header`, `litro-card-grid`, `litro-card`, `litro-footer`). Every string on it is a placeholder a user replaces, and the whole page renders on the server, so it reads with JavaScript off.

Declining the blog now also drops the Blog entry from `server/starlight.config.js`. The header renders that navigation on every page, so leaving the entry behind put a dead link across the whole site, not only on the landing page.
