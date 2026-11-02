#!/usr/bin/env node
/**
 * verify-create-litro-packed.mjs — run the packed scaffolder the way a user
 * does, on the OS this runs on, from a folder whose path holds URL syntax.
 *
 * WHY THIS EXISTS
 *
 * Issue 218: `pnpm create @beatzball/litro my-app` printed only
 * "Error: no recipes available." The recipes were in the tarball. The
 * scaffolder imported each `recipe.config.js` with `import(<absolute path>)`,
 * which is not a valid specifier: on Windows, `C:\...` reads as a URL with
 * the scheme `c:`, and on every OS a `#` in the path reads as a fragment.
 * A silent `catch` dropped every recipe, and every CI job stayed green,
 * because they all ran on Linux from a plain temp path.
 *
 * So this script packs the scaffolder, unpacks it under a folder named
 * `C# 100%20 litro`, and runs it in plain `node`:
 *
 *   1. `--list-recipes` must list every recipe in packages/create-litro/recipes
 *      and print no warning.
 *   2. Scaffolding with `--recipe` must create the app.
 *
 * CI runs it on Linux and on Windows. It needs a built create-litro:
 *   pnpm --filter @beatzball/create-litro build
 *   node scripts/verify-create-litro-packed.mjs
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PKG = join(REPO, 'packages', 'create-litro');
const WINDOWS = process.platform === 'win32';

const failures = [];
function fail(message) {
  failures.push(message);
  console.error(`[verify-create-litro] FAIL ${message}`);
}

// pnpm is `pnpm.cmd` on Windows, which only a shell can start. Every argument
// here is a plain path with no spaces, so the shell has nothing to mangle.
function pnpm(args, cwd) {
  return execFileSync('pnpm', args, { cwd, encoding: 'utf8', shell: WINDOWS });
}

const work = mkdtempSync(join(tmpdir(), 'litro-create-'));
const expected = readdirSync(join(PKG, 'recipes'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

try {
  // 1. Pack. This is the file npm would publish.
  const tgz = pnpm(['pack', '--pack-destination', work], PKG).trim().split('\n').pop().trim();
  if (!existsSync(tgz)) throw new Error(`pnpm pack gave no tarball: ${tgz}`);

  // 2. Unpack under a path with `#` and `%20` in it. tar runs with a relative
  //    archive name: GNU tar reads `C:\...` as a remote host.
  const installDir = join(work, 'C# 100%20 litro');
  mkdirSync(installDir);
  execFileSync('tar', ['-xzf', join('..', basename(tgz))], { cwd: installDir, stdio: 'pipe' });
  const cli = join(installDir, 'package', 'dist', 'src', 'index.js');
  if (!existsSync(cli)) throw new Error(`the packed scaffolder has no dist/src/index.js; build it first`);

  // 3. --list-recipes: every recipe, no warning.
  const list = spawnSync(process.execPath, [cli, '--list-recipes'], { cwd: work, encoding: 'utf8' });
  if (list.status !== 0) fail(`--list-recipes exited ${list.status}:\n${list.stderr}`);
  if (list.stderr.trim()) fail(`--list-recipes printed to stderr:\n${list.stderr}`);
  for (const name of expected) {
    if (!new RegExp(`^\\s+${name}\\s`, 'm').test(list.stdout)) {
      fail(`--list-recipes does not list "${name}". Output:\n${list.stdout}`);
    }
  }

  // 4. Scaffold one app through loadRecipe().
  const app = spawnSync(
    process.execPath,
    [cli, 'app', '--recipe', 'fullstack', '--mode', 'ssg', '--adapter', 'lit'],
    { cwd: work, encoding: 'utf8' },
  );
  if (app.status !== 0) fail(`scaffold exited ${app.status}:\n${app.stdout}\n${app.stderr}`);
  else if (!existsSync(join(work, 'app', 'package.json'))) fail('scaffold made no app/package.json');
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\n[verify-create-litro] ${failures.length} failure(s) on ${process.platform}`);
  process.exit(1);
}
console.log(
  `[verify-create-litro] OK on ${process.platform}: listed ${expected.join(', ')} ` +
    `and scaffolded fullstack from a packed tarball under "C# 100%20 litro"`,
);
