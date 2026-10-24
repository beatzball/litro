---
"@beatzball/litro": patch
---

A page file may now carry a prefix before the bracket: `pages/@[handle].ts`
scans as `/@:handle` and `pages/@[handle]/[statusId].ts` as
`/@:handle/:statusId`, so Mastodon-style `/@alice@example.social` URLs are
served. Before, the file scanned as the static path `/@[handle]` and the URL
answered 404 (issue 234).

A prefixed route now sorts before a bare param sibling, so
`pages/@[handle].ts` still wins next to `pages/[slug].ts`. Within dynamic
routes, the route with more literal text in its path comes first; ties keep
the old string order. No route in the recipes or the example apps changes the
page it serves.

A prefix may use letters, digits and `_ ~ @ ! & ' , ; = -`. Any other
character is rejected at scan time, because the client router or the server
matcher reads it as pattern syntax or receives it percent-encoded.

The suffix form (`[id].html.ts`, `[id]x.ts`) is not supported and is tracked
separately. A prefixed catch-all or optional (`@[...all].ts`, `@[[lang]].ts`)
and any other stray bracket are rejected at scan time with an error that names
the file. Before, they scanned as inert static paths. A non-page file with a
bracket in its name, such as `pages/[id].stories.ts`, is now an error too;
move it out of `pages/` or start its name with `-`.

During `litro dev`, a page scan that fails on reload (one of the errors above,
or a duplicate component tag) is logged and the server keeps serving the last
good routes. Before, it stopped the dev server. `litro build` still fails.

`isDynamic` now comes from the bracket syntax, not from the spelling of the
path. A file literally named `pages/:slug.ts` used to be marked dynamic and is
now a static route for the path `/:slug`.

The OG image handler's route matcher now escapes the literal runs between
params, so a bracket or a dot in a static part of a path matches itself.
