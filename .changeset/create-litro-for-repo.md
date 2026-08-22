---
'@beatzball/create-litro': minor
---

Add `--for-repo`, which turns a scaffolded starlight site into a specific
project's documentation site.

```sh
npm create @beatzball/litro@latest -- site \
  --recipe starlight --for-repo . --site-url https://example.dev
```

It reads the repository's name, description, remote and default branch, then
writes `_data/metadata.js`, `server/starlight.config.js` (title, nav with a
GitHub link, and "Edit this page" links pointing at the right branch and
subdirectory), a `Dockerfile` + `nginx.conf` deploy, and an `AGENTS.md` that
tells any coding agent how to add a page correctly.

The sample blog is removed by default (`--with-blog` keeps it) — including the
landing page's link to it and the blog routes in the generated e2e spec, so a
new site has no dead link and its own test suite passes.

It does **not** write your documentation. Turning a README into good pages is a
judgement call, so it leaves one honest placeholder page and points the agent
at `AGENTS.md`.

Every lookup degrades rather than failing: with no git remote it falls back to
the directory name, sets `editUrlBase: null`, omits the GitHub nav entry, and
prints what you still need to fill in. Works offline and without `gh`.

Other flags: `--site-url <url>`, `--deploy <docker|none>`, `--with-blog`.

`packageManager` is now pinned in the scaffolded `package.json` to the pnpm
that ran the scaffold, so the Docker build uses the same pnpm that produced
the lockfile instead of whatever corepack resolves as newest.
