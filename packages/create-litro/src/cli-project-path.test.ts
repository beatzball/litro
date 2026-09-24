/**
 * The CLI itself, run as a user runs it.
 *
 * `src/project-path.test.ts` drives `resolveProjectPath` and hands `p.dir` to
 * `scaffold()` directly, so `src/index.ts` — the file that held the bug — never
 * executes. Reverting the fix left that suite green. This spec builds the
 * package and runs `dist/src/index.js` in a child process from a DIFFERENT
 * working directory, which is the only way the `join(process.cwd(), ...)`
 * regression can be seen.
 *
 * It is one test, and it is slow on purpose: the build is what makes it real.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = dirname(dirname(fileURLToPath(import.meta.url)));
const CLI = join(PKG, 'dist', 'src', 'index.js');

// The CI test job does not build this package before `pnpm -r test`, so the
// spec builds it. `pnpm run build` also copies `recipes/` into `dist/`, which
// the scaffolder reads — `tsc` alone is not enough.
beforeAll(() => {
  execFileSync('pnpm', ['run', 'build'], { cwd: PKG, stdio: 'pipe' });
}, 300_000);

describe('the CLI writes an absolute project path where it was asked for', () => {
  it('lands at the absolute path and writes nothing under the current directory', async () => {
    const base = await mkdtemp(join(tmpdir(), 'litro-cli-abs-'));
    try {
      const work = join(base, 'work');
      const target = join(base, 'elsewhere', 'demo', 'my-app');
      await mkdir(work, { recursive: true });

      const out = execFileSync(
        process.execPath,
        [CLI, target, '--recipe', 'fullstack', '--mode', 'ssr'],
        // A different cwd from the target: with the bug, this is where the tree
        // went. stdin is not a TTY here, so no prompt is asked.
        { cwd: work, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] },
      );

      // 1. The project is at the path that was asked for.
      expect(existsSync(join(target, 'package.json')), `nothing at ${target}`).toBe(true);

      // 2. `{{projectName}}` is the last segment, not the whole path —
      //    package.json's `name` cannot hold a path.
      const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf-8'));
      expect(pkg.name).toBe('my-app');

      // 3. Nothing was written under the current directory. The bug built the
      //    target with join(process.cwd(), '<absolute path>'), which appends
      //    rather than replaces, so the whole tree landed here instead.
      expect(await readdir(work)).toEqual([]);

      // 4. The path printed back is one the user can `cd` to.
      expect(out).toContain(target);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  }, 300_000);
});
