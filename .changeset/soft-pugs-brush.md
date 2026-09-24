---
'@beatzball/create-litro': patch
---

Stop every scaffolded site scrolling sideways on a phone.

A document stylesheet does not cross a shadow boundary, so the recipes' own
`box-sizing: border-box` reset never reached the elements it was written for.
`<main>` on the starlight home page computed as `content-box`, added its
`1.5rem` gutters on top of `width: 100%`, and measured 438px on a 390px
screen. Every page component and shared component in the Lit and FAST recipes
now carries the reset inside its own shadow root, and every page host sets
`display: block` instead of falling back to `inline`. Elena renders light DOM
and is unchanged.

Three narrower overflows go with it: a long site name no longer pushes the
header's theme toggle off a 320px screen, a Markdown table with one long
unbreakable token in a cell no longer takes the page sideways, and an inline
code span longer than the screen now breaks instead.
