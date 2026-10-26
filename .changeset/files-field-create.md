---
"@beatzball/create-litro": patch
---

Publish only `dist` and the changelog, without compiled tests. The recipe templates the scaffolder reads at runtime stay in `dist/recipes`. The tarball no longer carries the duplicate `recipes` sources, tests or build config: 479 files and 1.83 MB unpacked become 224 files and 0.76 MB.
