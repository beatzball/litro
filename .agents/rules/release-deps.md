# Release and dependency rules

Changeset rules are in `AGENTS.md` under "Changesets". These rules cover
dependencies, packing and the release workflow.

### REL-001 — Scaffolding templates store `.gitignore` as `gitignore`

A recipe template keeps its ignore file as `gitignore` (no dot). The scaffolder
renames it on copy through `RENAME_ON_COPY`.

**Why:** npm removes `.gitignore` from every published tarball, and `files`
cannot opt back in. A template with a real `.gitignore` works from a local build
and ships no ignore file, so a user's first `git add` takes `node_modules/`,
`dist/` and `.env`. Other dotfiles such as `.gitkeep` are not affected.

**Check:** `RENAME_ON_COPY` in `packages/create-litro/src/scaffold.ts`, and
`git ls-files packages/create-litro/recipes | grep gitignore`.

### REL-002 — Do not run `pnpm add` in this workspace

Add a dependency by editing the `package.json` by hand, then run
`pnpm install`. After any dependency change, read the lockfile diff.

**Why:** `pnpm add` re-resolves the whole importer's peer graph. Adding one small
dev dependency to `packages/litro-agent` moves nitropack's `vite` peer from 8.x
down to 6.x and adds a second Vite install to `pnpm-lock.yaml`. It also sorts the
whole dependency block in `package.json`. Neither change is related to the
dependency you asked for.

**Check:** `git diff --stat pnpm-lock.yaml`, then
`git diff pnpm-lock.yaml | grep '^[+-]' | grep -v <new-dep>`. A clean add touches
only its own lines. If other peers moved, revert both files and add by hand.

### REL-003 — Bump a dependency in every `package.json` that declares it

To change a dependency's range, for a security fix or otherwise, find every
`package.json` that declares it and change them all. That includes apps,
benchmark apps and recipe templates.

**Why:** the audit names one path at a time. Fixing only that path leaves other
workspaces on the old range, and the check fails again on the next path.

**Check:** `git grep -n '"<dep>"' -- '*package.json'` before and after the
change. `h3` is declared in more than a dozen files.

### REL-004 — The dependency audit uses a justified baseline

The Dependency Audit job in `.github/workflows/ci.yml` scans `pnpm-lock.yaml`
against the OSV database with the config in `osv-scanner.toml`. `pnpm audit` is
not used. Every ignored advisory has an id and a reason. Fix what can be fixed
instead of adding it to the list.

**Why:** the npm endpoint behind `pnpm audit` was retired and answers HTTP 410.
The scanner has no severity threshold, so the baseline keeps the "high and
above" bar by hand. Decide by where the package ships: a production dependency
of a published package (`@beatzball/litro`, `litro-router`, `create-litro`,
`litro-agent`) reaches users; dev and tooling dependencies do not.

**Check:** a new advisory id fails the job. Read the header of
`osv-scanner.toml` before editing it.

### REL-005 — Pack with `pnpm pack`, never `npm pack`

When you pack a workspace package to test it outside the monorepo, use
`pnpm pack`.

**Why:** `npm pack` leaves `workspace:^` in the packed `package.json`, and plain
npm cannot install that tarball (`EUNSUPPORTEDPROTOCOL`). `pnpm pack` rewrites it
to a real version range.

**Check:** `tar -xzOf <tgz> package/package.json | grep workspace:` prints
nothing for a correct tarball.

### REL-006 — The release workflow publishes with OIDC, not a token

Keep `.github/workflows/release.yml` as it is: `id-token: write`, no
`registry-url` on the Node setup step, no `NPM_TOKEN` or `NODE_AUTH_TOKEN`, and
npm pinned to `npm@^11`.

**Why:** trusted publishing needs npm 11.5.1 or newer. `registry-url` writes an
`.npmrc` that references `${NODE_AUTH_TOKEN}`, and npm errors on an undefined
variable in config. `npm@latest` is 12.x, which ties the pipeline to specific
Node minor versions. The Release workflow also reports success on runs that only update the
release pull request, so a broken publish step can stay hidden until the next
version merge.

**Check:** after a version merge, confirm the publish run actually published:
`npm view <pkg> version --prefer-online`.
