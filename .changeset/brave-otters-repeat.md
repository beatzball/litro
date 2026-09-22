---
"@beatzball/create-litro": patch
---

starlight: docs and blog pages no longer open in light mode on a dark system

The head script set `data-theme` before the first paint, from the reader's
stored choice or, when there was none, from `prefers-color-scheme`. That part
was right. `starlight-header` then resolved the theme a SECOND time in its
first update and wrote the answer back — with a bare `?? 'light'` fallback and
no look at the system. It answered a moment later and overwrote a correct value,
so on a dark system every page carrying the header flipped to light right after
it loaded. All three adapter overlays had it.

The header now READS `data-theme` instead of deciding it, and stops when it is
taken off the page. The head script stays the one decider: it guards every
`localStorage` read, because storage throws rather than returning null when site
data is blocked, and it follows a later system change while — and only while —
the reader has stored no choice of their own.

The stylesheet gains an `@media (prefers-color-scheme: dark)` branch guarded by
`:not([data-theme="light"])`, so a dark system gets a dark page with JavaScript
turned off, and an explicit light choice still wins when scripts are running.
Both themes now declare a `color-scheme`, so form controls and scrollbars follow
too.

`litro-hero-nova` also gains two optional tokens, `--nova-mark-size` and
`--nova-mark-size-narrow`, for how wide the mark is drawn. A site whose mark
should hold the whole right of the pane sets them in the same block it sets its
colors in; the recipe's defaults are unchanged.
