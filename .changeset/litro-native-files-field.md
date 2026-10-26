---
"@beatzball/litro-native": patch
---

Publish only what an app consumes. The tarball now carries `dist/`, the readme
and the changelog, instead of also shipping the TypeScript sources, the two test
files, the vitest config and a 15 kB TypeScript build cache. Installed size
drops from 118 kB to 51 kB.
