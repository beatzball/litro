---
'@beatzball/litro-router': patch
---

Leave the scroll position alone unless the reader followed a link.

`LitroRouter` ended every resolve with `window.scrollTo(0, 0)`, including the
first resolve after a document load. The browser restores the scroll position
of a reloaded page before any script runs, so that call threw the restored
position away and the reader came back at the top of the page. Measured on the
docs site: scrolled to 901, reloaded, arrived at 0.

The router now tells three moves apart, and only one of them scrolls:

| move | what happens |
| --- | --- |
| a document load | nothing — the browser has already restored the position, or put a new entry at the top |
| a link click, via `LitroRouter.go()` | scroll to the top of the new page, or to the hash target |
| back or forward | the saved position for that page |

A hash still wins on a fresh load, because a heading rendered inside a shadow
root is one native fragment scrolling cannot reach. On a reload it does not:
the restored position is where the reader was, and the hash is only where they
first entered the page.

Back and forward inside one document needed more than leaving the browser to
it. The browser restores the offset while the page being left is still on
screen, so a move back to a longer page was clamped to the shorter page's
height — a return to 866 instead of 1100 on the server-rendered docs site. The
router now remembers the offset of every page the reader has visited and
re-applies it once the new page has rendered.
