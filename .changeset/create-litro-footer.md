---
'@beatzball/create-litro': minor
---

Add a "Created using Litro" credit line to every scaffolded site.

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
