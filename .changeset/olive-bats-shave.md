---
"@beatzball/create-litro": patch
---

supernova: a quieter hero, and three fixes the landing page needed once a real site used it

Found while rebuilding litro's own docs home pages on this recipe — the first
project to use it in anger.

- `litro-hero-nova` drew a shockwave ring, a hot inner glow and a bright core
  around the same point as the `mark` slot, which put the project's logo in the
  middle of a target and pulled the eye off both the logo and the words. The
  backdrop is now a dark ground, the same sparse star field, and one wide soft
  wash of accent light with no edge anywhere. The slots, the tokens it reads and
  the rest of its API are unchanged, so no page has to change. Nothing in it
  animates any more, so its `prefers-reduced-motion` rule and its keyframes are
  deleted rather than left behind as dead CSS.

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
  given and a phone scrolled sideways. The command now scrolls inside the box,
  which is what its `overflow-x` was always meant to do.
