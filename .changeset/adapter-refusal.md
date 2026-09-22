---
'@beatzball/create-litro': minor
---

Refuse an adapter the chosen recipe cannot produce.

`--recipe supernova --adapter fast` used to exit 0 with a mixed app. Supernova
extends starlight, so starlight's FAST overlay set `LITRO_ADAPTER = 'fast'` and
swapped the docs pages over, and supernova's own template then put its Lit
landing page and its nine Lit components back on top. Nothing said so.

Each recipe now declares the adapters it really supports in its config —
`fullstack` lit and elena, `11ty-blog` lit, `starlight` lit, fast and elena,
`supernova` lit. Support is declared, never read off the `template-<adapter>/`
directories on disk, because a recipe that extends another inherits its base's
overlays. Asking for anything else exits non-zero, names the recipe, the
adapter and what the recipe does support, and writes nothing at all. The
interactive prompt offers only the adapters the chosen recipe supports, and
skips the question when there is one.
