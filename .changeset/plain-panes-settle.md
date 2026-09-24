---
"@beatzball/create-litro": patch
---

supernova: the cards stop floating, and the landing page gains six sections

**The feature block is panes, not cards.** `litro-pane` and `litro-pane-grid`
replace the card kit on the landing page: square corners, no shadow, and a
hairline that two neighbors SHARE rather than each carrying their own. The grid
is six columns, so a row is two halves or three thirds and seven items fill
three rows with no orphan. Both of the sites this page is measured against do
exactly this, and neither uses a card kit.

The emoji are gone. A pane carries a state glyph, which says something true —
`[+]` ships, `[~]` is still moving — and an `icon` slot for a REAL mark where a
project has one. A scaffolded site has no mark that means anything yet, so it
says it in words and no placeholder icon is drawn.

**Six more sections**, each one block with a comment above it saying what it is
for and that deleting it is fine: a logo wall, a capability block, what the
project is built on, a stats row, an ecosystem list, deploy targets, and a real
footer with link columns in place of the one-line credit.

**Placeholders are honestly empty.** The logo wall's slots read "Your logo",
the stats are dashes, and nothing invents a company, a download count or a
quote. A scaffolded site never claims proof it does not have.

`litro-site-footer` is new. Pass it no columns and only the fine print is
drawn, which is where this started.

`removeBlog` now also unpicks a `/blog` link from the landing page's footer
columns. Nitro's prerenderer crawls the links it finds, so one left behind made
`--no-blog` prerender a blog whose pages had just been deleted.
