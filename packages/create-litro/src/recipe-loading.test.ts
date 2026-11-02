/**
 * How recipe configs are imported, and what happens when one fails (issue 218).
 *
 * A user ran `pnpm create @beatzball/litro my-app` and got only "no recipes
 * available". The recipes were in the tarball. Every config was imported with
 * `import(<absolute path>)`, which is not a valid specifier: on Windows the
 * drive letter reads as a URL scheme, and on every OS a `#` in the path reads
 * as a URL fragment. Each failure was swallowed by a silent `catch`.
 *
 * The `#` case fails on macOS and Linux too, so it is the regression test that
 * runs everywhere. The Windows case runs for real in the Windows CI job
 * (scripts/verify-create-litro-packed.mjs).
 *
 * WHY THE CHECKS RUN IN A CHILD `node` PROCESS
 *
 * Under vitest, `import()` goes through vite-node, not Node's own loader, and
 * vite-node handles specifiers differently: it accepted the raw paths that
 * broke the published CLI, and it rejects a `file://` URL with `%23` in it.
 * A test in-process would prove the wrong loader. So each check runs the BUILT
 * `dist/src/scaffold.js` (built once by src/__setup__/build-cli.ts) in plain
 * `node`, the way a user runs it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCAFFOLD = new URL('../dist/src/scaffold.js', import.meta.url).href;

/**
 * Run `body` in a plain `node` ES module, with the built scaffold module bound
 * to `s` and the fixture root bound to `root`. Whatever `body` returns comes
 * back as `result` (through JSON), with the process's stderr beside it.
 */
function inNode<T>(body: string): { result: T; stderr: string } {
  const script =
    `import * as s from ${JSON.stringify(SCAFFOLD)};\n` +
    `const root = ${JSON.stringify(root)};\n` +
    `const result = await (async () => { ${body} })();\n` +
    `process.stdout.write(JSON.stringify(result ?? null));\n`;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
  });
  if (run.status !== 0) throw new Error(`child node failed:\n${run.stderr}`);
  return { result: JSON.parse(run.stdout) as T, stderr: run.stderr };
}

let root: string;

async function writeRecipe(dir: string, name: string, body: string): Promise<void> {
  await mkdir(join(dir, name, 'template'), { recursive: true });
  await writeFile(join(dir, name, 'recipe.config.js'), body);
}

const good = (name: string) =>
  `export default { name: ${JSON.stringify(name)}, displayName: 'X', description: 'x' };\n`;

beforeAll(async () => {
  // `#` and `%20` in the folder name: both are URL syntax, so a raw absolute
  // path given to import() resolves to a different file.
  root = join(await mkdtemp(join(tmpdir(), 'litro-218-')), 'C# 100%20 recipes');
  await writeRecipe(root, 'alpha', good('alpha'));
  await writeRecipe(root, 'beta', good('beta'));
  await writeRecipe(root, 'broken', 'export default { name: ;\n');
  await mkdir(join(root, 'templates-only', 'template'), { recursive: true });
});

afterAll(async () => {
  await rm(join(root, '..'), { recursive: true, force: true });
});

describe('recipeConfigSpecifier', () => {
  it('returns a file:// URL, never a bare path', () => {
    const { result } = inNode<string>(
      `return s.recipeConfigSpecifier(root + '/alpha/recipe.config.js');`,
    );
    expect(result.startsWith('file://')).toBe(true);
    expect(result).toContain('%23'); // the `#`, escaped
  });

  it('is needed: Node rejects a bare Windows path given to import()', () => {
    // Node checks the scheme before it touches the disk, so this fails the
    // same way on every OS. It is the error a Windows user's CLI swallowed.
    const { result } = inNode<string>(
      `try { await import('C:\\\\Users\\\\someone\\\\recipe.config.js'); return 'loaded'; }
       catch (e) { return e.code; }`,
    );
    expect(result).toBe('ERR_UNSUPPORTED_ESM_URL_SCHEME');
  });

  it('is needed: Node misreads a bare path that holds a `#`', () => {
    const { result } = inNode<string>(
      `try { await import(root + '/alpha/recipe.config.js'); return 'loaded'; }
       catch (e) { return e.code; }`,
    );
    expect(result).toBe('ERR_MODULE_NOT_FOUND');
  });
});

describe('listRecipes', () => {
  it('loads recipes from a folder whose path holds URL syntax', () => {
    const { result } = inNode<string[]>(
      `return (await s.listRecipes(root, () => {})).map((r) => r.name).sort();`,
    );
    expect(result).toEqual(['alpha', 'beta']);
  });

  it('names each recipe it skips, and why', () => {
    const { result } = inNode<[string, string][]>(
      `const skipped = [];
       await s.listRecipes(root, (name, e) => skipped.push([name, e.name]));
       return skipped;`,
    );
    expect(result).toEqual([['broken', 'SyntaxError']]);
  });

  it('does not report a folder that has templates but no config', () => {
    const { result } = inNode<string[]>(
      `const skipped = [];
       await s.listRecipes(root, (name) => skipped.push(name));
       return skipped;`,
    );
    expect(result).not.toContain('templates-only');
  });

  it('reports a missing recipes folder instead of returning [] silently', () => {
    const { result } = inNode<{ recipes: unknown[]; skipped: string[] }>(
      `const skipped = [];
       const recipes = await s.listRecipes(root + '/nope', (name) => skipped.push(name));
       return { recipes, skipped };`,
    );
    expect(result.recipes).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toContain('nope');
  });

  it('warns on stderr by default', () => {
    const lines = inNode(`await s.listRecipes(root);`).stderr.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('skipped recipe "broken"');
    expect(lines[0]).toContain('SyntaxError');
  });
});

describe('loadRecipe', () => {
  it('loads a recipe from a folder whose path holds URL syntax', () => {
    const { result } = inNode<string>(`return (await s.loadRecipe('alpha', root)).name;`);
    expect(result).toBe('alpha');
  });

  it('returns null for a recipe with no config', () => {
    const { result } = inNode<unknown[]>(
      `return [await s.loadRecipe('templates-only', root), await s.loadRecipe('does-not-exist', root)];`,
    );
    expect(result).toEqual([null, null]);
  });

  it('throws, naming the recipe, when the config fails to import', () => {
    const { result } = inNode<string>(
      `try { await s.loadRecipe('broken', root); return 'no error'; }
       catch (e) { return e.message; }`,
    );
    expect(result).toMatch(/^Could not load recipe "broken" from .*SyntaxError/);
  });
});
