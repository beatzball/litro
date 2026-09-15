# Testing rules

Several of these describe tests that pass while the thing they test is broken.

### TEST-001 — Wait for `litro-outlet[data-litro-settled]` before interacting

An e2e test that has just loaded a page runs
`await page.waitForSelector('litro-outlet[data-litro-settled]')` before it
clicks, types or reads client state.

**Why:** the router swaps in a client element instead of hydrating in place.
Until the swap, the visible server HTML has no event handlers. Element counts
and visibility look the same before and after the swap, so waiting on
`page-x:not([hidden])` or `toHaveCount(1)` is not enough. The test becomes
flaky.

**Check:** the router sets the attribute only after the swap; see
`packages/litro-router/src/__tests__/index.test.ts`. The e2e specs under `e2e/`
already use the selector.

### TEST-002 — An e2e spec deletes only its own files

A spec may delete files only inside a `test-results` folder (at the repo root or
under `e2e`) or the OS temp directory. For agent session logs, give the spec its own directory with
`LITRO_AGENT_SESSIONS_DIR`.

**Why:** the suite runs fully parallel, and specs share dev servers. A spec that
wiped `playground/.litro` removed the session logs a shared server was writing,
so tests in other specs failed together, sometimes for the rest of the run.

**Check:** `scripts/check-e2e-isolation.mjs` runs in CI. When tests fail together
and one of them never opens a browser, look for a spec deleting shared state
before you look at timeouts or hydration.

### TEST-003 — Vitest does not type-check

A test fixture that builds a typed object includes every required field. Do not
take a green vitest run as proof the types are right.

**Why:** vitest strips types without checking them. `tsc` does check test files:
`packages/framework/tsconfig.json` includes all of `src/`, and CI builds the
framework with `tsc`. A fixture missing a required field, such as `isDynamic` or
`isCatchAll` on `LitroRoute`, passes locally and fails the CI build.

**Check:** run `pnpm --filter @beatzball/litro build` after changing tests. The
interface is in `packages/framework/src/types/route.ts`.

### TEST-004 — Reproduce dev-server flakes cold, against a fresh server

Before you debug a `litro dev` flake, delete `node_modules/.vite`, `.nitro` and
`.litro` in the app directory. Before a local full e2e run, stop every server
still running on the Playwright ports.

**Why:** the dependency optimizer cache in `node_modules/.vite` is what makes a
run warm; deleting `.nitro` and `.litro` alone is not a cold start. Locally,
`playwright.config.ts` sets `reuseExistingServer: !process.env.CI`, so it reuses
a stale server running old code and reports failures that do not exist.

**Check:** `rm -rf node_modules/.vite .nitro .litro` in the app directory, and
confirm no process is listening on the ports in `playwright.config.ts`.

### TEST-005 — Scaffolding checks use packed tarballs and read rendered output

A check that claims to test what a user gets packs the packages (and the
scaffolder itself) and asserts on rendered HTML, not on a successful build.

**Why:** the workspace symlink hides packaging faults. Two shipped that way: the
recipe `.gitignore` was stripped from the tarball (REL-001), and a published
`source` condition blanked installed apps (BUILD-004). Separately, all six
scaffolded variants built green while FAST dropped a value from its HTML
(SSR-005).

**Check:** `scripts/verify-scaffolded-apps.mjs` packs with `pnpm pack`, runs the
scaffolder from the unpacked tarball, and strips HTML comments before it
searches the rendered text. Build `packages/create-litro` before running it:
the pack takes `dist/`, so an edit to `recipes/` alone is not tested.

### TEST-006 — Every benchmark run replaces `latest.json`

For results that include both the cross-framework and the HN phases, run
`pnpm bench:all` or `pnpm bench:all:full`. Do not commit
`benchmarks/results/latest.json` from a partial run.

**Why:** `benchmarks/src/runner.ts` writes the whole file at the end of each run;
it never merges. `pnpm bench:cross` then `pnpm bench:hn` leaves only the HN
data, and the docs pages that read the other phase show "not run yet".

**Check:** `git diff benchmarks/results/latest.json` before committing. Removed
sections mean a partial run.
