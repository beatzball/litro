---
"@beatzball/litro": major
"@beatzball/litro-router": major
"@beatzball/create-litro": major
---

Rename all packages to `@beatzball` scope. The unscoped `litro` package was blocked by npm's name-similarity protection (too close to `lit`, `listr`, etc.). All three packages are now published under the `@beatzball` org scope:

- `litro` → `@beatzball/litro`
- `litro-router` → `@beatzball/litro-router`
- `create-litro` → `@beatzball/create-litro`

The previously published unscoped `litro-router@0.0.2` and `create-litro@0.0.2` are deprecated on npm with a redirect notice.
