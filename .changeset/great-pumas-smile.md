---
"@beatzball/create-litro": minor
---

supernova: add a "one thing, proved" band to the landing page

A new section between the capability grid and the "built on" panes: one claim,
a small code example in a band with a title strip, and the two things that code
produces — the value a program gets back and the thing a person sees.

The code and the returned data are syntax highlighted **on the server**, through
the template's own `src/highlight.ts`, so the section reads the same with
JavaScript turned off and highlight.js stays out of the client bundle. The
recipe gains no dependency: `highlight.js` and that file already ship with the
starlight template this recipe extends.

Everything in the band is placeholder and the example really runs. The band has
no accent stripe, no eyebrow and nothing that moves; the cells share hairlines
under one outer rule, the way the capability panes already do.
