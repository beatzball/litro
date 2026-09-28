/**
 * Build the package once, before any spec runs.
 *
 * Two specs run the real CLI out of `dist/src/index.js` in a child process:
 * `cli-project-path.test.ts` and `cli-deprecated-adapter.test.ts`. The CI test
 * job does not build this package before `pnpm -r test`, so the build has to
 * happen somewhere.
 *
 * It cannot happen in each spec's `beforeAll`. Vitest runs spec FILES in
 * parallel workers, and `pnpm run build` starts with `clean`, which deletes
 * `dist/`. Two specs building at once means one of them deletes the binary the
 * other is about to run, and the failure is
 * `Cannot find module '.../dist/src/index.js'` — which passed locally, where a
 * previous build had already left `dist/` in place, and failed in CI on a clean
 * checkout.
 *
 * `globalSetup` runs once, in the main process, before any worker starts.
 *
 * `pnpm run build` also copies `recipes/` into `dist/`, which the scaffolder
 * reads — `tsc` alone is not enough.
 */
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

export function setup(): void {
  execFileSync('pnpm', ['run', 'build'], { cwd: PKG, stdio: 'pipe' });
}
