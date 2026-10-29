---
"@beatzball/litro": patch
---

Stop promising a CommonJS entry point that was never built. `main` and the `require` condition on the root export both pointed at `dist/index.cjs`, a file absent from every published tarball, so anything resolving the `require` condition failed with a confusing error about a path it never asked for. The package is ESM only, as the other 32 export subpaths already said, and a CommonJS consumer now gets a clear resolution error naming the package instead.
