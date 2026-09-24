---
"@beatzball/create-litro": patch
---

supernova: the landing page follows the theme, and a status cell's words no longer touch

**Light mode did nothing on the landing page.** The page hard-coded a dark
palette and `color-scheme: dark`, so the toggle had nothing to act on: a reader
switching to light watched the docs pages change and the landing page stay
dark. The palette now lives in `public/styles/starlight.css` as `--brand-*`
values, in the same light and dark blocks the `--sl-*` tokens use — so the
landing page follows the toggle, the system preference, and the
`prefers-color-scheme` block that carries both with JavaScript turned off. The
page's token block is unchanged in shape: every line is still
`var(--brand-…, <fallback>)`.

**The accent is one value again.** `--brand-accent` reads `--sl-color-accent`
rather than repeating a hex, so the landing page and the docs pages cannot
drift. Two more accents are derived from it rather than typed: one dark enough
to carry white text on it, for the status line's mode segment and the primary
button, and one dark enough to read as small text on a light page.

**A linked status cell lost its word spacing.** The gap that separates a glyph
from a word lives on `.cell`, and a cell that links somewhere has one child —
an anchor — so everything inside it had no gap and the line read
"built withlitro". The anchor is the flex row now.

The hero's mark also reads `--nova-mark-opacity`, because the value that is
right on a near-black ground is nearly invisible on an off-white one.
