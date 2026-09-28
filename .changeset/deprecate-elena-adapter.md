---
'@beatzball/create-litro': minor
---

Deprecate the `elena` adapter. The interactive prompt now offers `lit` and
`fast` only, and `--adapter elena` prints a one-line notice on stdout saying the
adapter is deprecated and will be removed at v1.

Nothing is removed. `--adapter elena` still resolves, still scaffolds, and still
produces a working Elena app, and both recipe overlays that declare it are
unchanged. `ui()` — an agent tool that returns a server-rendered component —
throws on Elena, so the adapter cannot reach Litro's most distinctive feature;
that is the reason for the deprecation. New projects should use `lit` or `fast`.
The adapter is removed at v1.
