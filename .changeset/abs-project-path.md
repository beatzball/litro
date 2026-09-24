---
'@beatzball/create-litro': patch
---

Scaffold an absolute project path where it was asked for.

`create-litro /tmp/demo/my-app` wrote a whole `./tmp/demo/my-app` tree inside
the current directory and printed the usual success block. The target was built
with `join(process.cwd(), projectName)`, and `join` concatenates an absolute
second argument rather than replacing the first.

The path is now resolved once and used everywhere: for the target directory,
for the "directory already exists" refusal, and for the path printed back, so
`cd <path>` is a command that works. A relative path behaves exactly as before.

`{{projectName}}` — which becomes `package.json`'s `name` and the site title —
is now the last segment of the path alone, because neither can hold a path.

A quoted leading `~` expands to the home directory instead of creating a
directory literally called `~`. A `~someone` form is refused rather than
guessed at, as is a path with no last segment to name the project after.

`--for-repo` now refuses a site outside the repository it names. The path from
the repo root down to the site is published — it becomes the starlight config's
`editUrlBase`, which is an "Edit this page" link on GitHub, and it heads the
generated `AGENTS.md`. A site beside the repository produced `..` in both, and
an edit link with `..` in it does not resolve. The refusal names both paths and
runs before anything is written.
