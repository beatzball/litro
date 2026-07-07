---
'@beatzball/litro': patch
---

Content layer: duplicate slugs now fail the build with an error naming the colliding files. Slugs are derived from the filename (or the parent directory for `index.md`), so `docs/setup.md` and `blog/setup.md` collide — previously the slug-keyed index silently kept only one of them, dropping the other from every listing and lookup.
