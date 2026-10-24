---
"@beatzball/litro": patch
---

A page file may now carry a prefix before the bracket: `pages/@[handle].ts`
scans as `/@:handle` and `pages/@[handle]/[statusId].ts` as
`/@:handle/:statusId`, so Mastodon-style `/@alice@example.social` URLs are
served. Before, the file scanned as the static path `/@[handle]` and the URL
answered 404 (issue 234).

The suffix form (`[id].html.ts`, `[id]x.ts`) is not supported and is tracked
separately. A prefixed catch-all or optional (`@[...all].ts`, `@[[lang]].ts`)
and any other stray bracket are rejected at scan time with an error that names
the file. Before, they scanned as inert static paths.

The OG image handler's route matcher now escapes the literal runs between
params, so a bracket or a dot in a static part of a path matches itself.
