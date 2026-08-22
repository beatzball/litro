---
'@beatzball/create-litro': patch
---

Scaffolded apps now actually get a `.gitignore`.

npm strips `.gitignore` from every published tarball — it is on npm's own
exclusion list with no way to opt out via `files`. The recipe templates stored
the file under its final name, so it shipped fine from a local build and
silently vanished for anyone installing from the registry. Every app created
with `npm create @beatzball/litro` arrived with **no ignore rules at all**, so
its first `git add` swept in `node_modules/`, `dist/`, the generated stubs, and
any `.env`.

The templates now store it as `gitignore` and the scaffolder renames it on
copy. `.gitkeep` and `.11tydata.json` are unaffected — npm's exclusion list is
specific, not "all dotfiles".

The `scaffolded-apps` CI guard now scaffolds from the **packed tarball** rather
than the local build, and asserts the resulting app has a `.gitignore` covering
`node_modules/`, `dist/` and `server/stubs/`. Running the local build was why
this class of bug was invisible: a tarball is not the source directory with a
different name.
