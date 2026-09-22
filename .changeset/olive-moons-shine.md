---
"@beatzball/create-litro": patch
---

supernova: one header on every page, and the terminal line moves to the foot

The landing page carried a terminal bar of its own at the top, so a reader met
two different headers on one site — the risk section 13 of the recipe's spec
named. It now carries the SAME `starlight-header` the docs pages do, and the
terminal character moves to where a status line belongs: a fixed line at the
foot of the window.

`litro-status-bar` is replaced by `litro-status-line`, a new tag. It is not a
second layout mode on the old component: every property the bar had was about
being a header — a home link, a tab row, a navigation slot — and none of them
survive the move. What the line does instead is state facts:

- on a landing page, whatever the project can prove about itself;
- on a docs or blog page, where the reader is, and the link that edits it.

**Every cell must be true.** The bar's tab row showed tasks settling from
working to done on a page that had no tasks, which is a drawing in the most
credible place on a page. The line has no tabs and no states it cannot know,
and with no cells at all it renders nothing rather than an empty bar.

`starlight-header` gains `--sl-font-brand`, the face its wordmark and links are
set in. It falls back to the body sans, so a site that never sets it looks
exactly as it did; supernova sets it to the mono, which is the whole of the
difference between its header and the docs pages' one. The header's navigation
also scrolls rather than overflowing below 48rem — on the docs pages it was
hidden behind the hamburger and this never showed, but a landing page has no
sidebar and keeps its links.
