---
'@beatzball/create-litro': patch
---

Scaffolded apps no longer list `'source'` in `resolve.conditions`. An installed
package's TypeScript is never transpiled by Vite, so resolving to source emitted
raw decorators and produced a client bundle no browser could parse — a blank
page from a build that reported success. Templates now consume the packages'
compiled output.

Affected the `fullstack`, `11ty-blog`, and `starlight` recipes on the `lit` and
`fast` adapters, on Vite 8. The `elena` adapter was unaffected.
