---
'@beatzball/create-litro': patch
---

Stop every scaffolded site scrolling sideways on a phone.

The box model itself is fixed in `@beatzball/litro`, on `LitroPage`. What
changes here are the pages and components that carry their own styles and so
have to compose the reset, plus three narrower overflows found by measuring:
a long site name no longer pushes the header's theme toggle off a 320px
screen, a Markdown table with one long unbreakable token in a cell no longer
takes the page sideways, and an inline code span longer than the screen now
breaks while a code block keeps its own horizontal scroll.
