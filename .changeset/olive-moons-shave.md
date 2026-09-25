---
'@beatzball/litro': patch
---

Give every page a correct box model inside its shadow root.

A document stylesheet does not cross a shadow boundary, so the
`box-sizing: border-box` reset every recipe ships in its global stylesheet
never reached a page component. `<main>`, sized `width: 100%` with horizontal
padding, computed as `content-box` and measured 438px on a 390px screen.

`LitroPage` now carries the reset itself: `static styles = pageReset` in Lit,
and the FAST `LitroPage.define()` injects it ahead of whatever styles a page
passes. Elena is unchanged — it server-renders light DOM, where the document
stylesheet already applies.

**Upgrading fixes an existing app.** A page that declares no styles of its own
needs no edit at all. A page that declares `static override styles` replaces
the inherited value, so compose instead:

```ts
import { LitroPage, pageReset } from '@beatzball/litro/runtime';

static override styles = [pageReset, css`...`];
```

`pageReset` is exported from `@beatzball/litro/runtime` for any component that
cannot extend `LitroPage`.
