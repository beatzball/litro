---
"@beatzball/litro": patch
---

Server-render `<litro-link>`, and put the skip links inside a landmark.

`<litro-link>` builds its `<a href>` in `render()`, and the element was never
registered on the server, so SSR emitted a bare `<litro-link href="/docs">`
with no shadow root. The href sat on a custom element the browser will not
follow, which left every such link unclickable with JavaScript turned off.
Each adapter now imports its own link module from `manifestPreamble()`, so the
element is in the server bundle and every app renders a real anchor. An app no
longer needs a side-effect import of `@beatzball/litro/runtime/LitroLink.js` in
one of its pages to make its links work.

`buildShell` wrote its skip links as bare anchors at the top of `<body>`,
outside every landmark, which axe-core reported as `region` on every page a
Litro app served. They now sit in a `<nav aria-label="Skip links">`. The label
keeps the landmark distinct from a site's own navigation, and an empty
`skipLinks` array emits no wrapper. Existing behavior is unchanged: the class
stays on each anchor, so the shell's script still focuses the target and still
hides a link whose target is missing.

Also adds `./adapter/fast/runtime/*.js` and `./adapter/elena/runtime/*.js` to
the package exports, matching the existing `./runtime/*.js` entry.
