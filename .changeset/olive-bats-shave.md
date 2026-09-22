---
"@beatzball/create-litro": patch
---

supernova: a redesigned hero, and the fixes the landing page needed once a real site used it

Found while rebuilding litro's own docs home pages on this recipe — the first
project to use it in anger.

**The hero is redesigned.** It drew a shockwave ring, a hot inner glow and a
bright core around the same point as the `mark` slot, and laid a centered stack
of copy over the top. The logo sat in the middle of a target, and nothing in the
composition led the eye anywhere.

`litro-hero-nova` is now one screen-high pane: a deep tinted ground, one wide
soft wash of accent light, and the `mark` slot drawn very large and cropped
against the pane's right edge, so a project's logo reads as atmosphere rather
than as a badge floating in the middle. With no mark slotted nothing is painted
at all — an empty hero is a finished hero, with no ghost shape. Its slots and
its tag are unchanged, so no page has to change; it reads one new optional
token, `--nova-hero-min`, for the pane's height. Nothing animates, so its
`prefers-reduced-motion` rule and its keyframes are deleted rather than left as
dead CSS.

**The landing page is left-aligned on a column**, and its headline is set in the
same mono face as the status bar, the badges and the command — so the page
speaks in one voice. The sans is kept for prose.

**`litro-install-command` is a slab, not a chip.** It fills the column it is
given, the copy control is a labeled panel of its own flush to the right edge,
and a new optional `note` slot carries one line of small print underneath. Slot
nothing and the line is not there.

- `litro-status-bar` styled its navigation with `::slotted(a)`, so a page that
  handed the bar anything else — a routing link element, or a button that opens
  a search dialog — got an unstyled control beside the styled links. The rule
  now matches on the slot name, `::slotted([slot='nav'])`, and resets a
  button's own font, background and border.
- `litro-status-bar` let the name segment shrink to nothing on a phone, which
  left an empty arrow where the project's name should be. Below 30rem the name
  segment is dropped and the mark carries the home link on its own.
- The landing page's shadow root never repeated the global `box-sizing` reset,
  so every full-width section was its width PLUS its gutters and a phone
  scrolled sideways by exactly one gutter.

- `litro-status-bar` sized and colored its navigation with `::slotted(a)`, so a
  page that handed the bar anything else — a routing link element, or a button
  that opens a search dialog — got an unstyled control beside the styled links.
  The rule now matches on the slot name, `::slotted([slot='nav'])`, and resets
  a button's own font, background and border.
- `litro-status-bar` let the name segment shrink to nothing on a phone, which
  left an empty arrow where the project's name should be. Below 30rem the name
  segment is dropped and the mark carries the home link on its own.
- `litro-install-command` had no `box-sizing` on its box and no `min-width: 0`
  on the command, so a long command pushed the box wider than the space it was
  given and a phone scrolled sideways. The command now scrolls inside the slab,
  which is what its `overflow-x` was always meant to do.
