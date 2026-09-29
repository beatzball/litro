---
'@beatzball/litro': patch
---

The HTML shell no longer emits comments. The rationale for the synchronous DSD
polyfill script and for the app bundle's URL moved into TypeScript comments in
`shell.ts`, and `foot` no longer closes with `<!-- /page-name -->`, which
nothing read. Every byte of a comment in the shell was served on every page of
every Litro app. `buildShell()`'s first parameter is now `_componentTag`; the
signature is unchanged, so callers do not have to change.
