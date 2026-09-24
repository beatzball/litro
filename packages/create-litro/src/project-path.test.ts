/**
 * Where a project actually lands.
 *
 * `create-litro /tmp/demo/my-app` used to write a whole `./tmp/demo/my-app`
 * tree inside the current directory and print the usual success block, because
 * the target was built with `join(process.cwd(), projectName)` and `join`
 * concatenates an absolute second argument instead of replacing the first.
 *
 * These tests drive `resolveProjectPath`, which is what the CLI now uses for
 * the target directory, for the "already exists" check, for `{{projectName}}`
 * and for the path it prints back — one resolution, four users, so they cannot
 * disagree.
 */
import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, isAbsolute, resolve, sep } from 'node:path';
import { resolveProjectPath, resolveUserPath, siteRelativeToRepo } from './project-path.js';
import { scaffold } from './scaffold.js';

const CWD = '/work/dir';

describe('a relative path behaves exactly as it did', () => {
  it('resolves against the current directory', () => {
    const p = resolveProjectPath('my-app', CWD);
    expect(p.dir).toBe(join(CWD, 'my-app'));
    expect(p.name).toBe('my-app');
    expect(p.display).toBe('my-app');
  });

  it('handles a nested relative path', () => {
    const p = resolveProjectPath('sites/my-app', CWD);
    expect(p.dir).toBe(join(CWD, 'sites', 'my-app'));
    // package.json's `name` cannot hold a path, so the last segment names it.
    expect(p.name).toBe('my-app');
    expect(p.display).toBe('sites/my-app');
  });

  it('handles ./ and ../ forms', () => {
    expect(resolveProjectPath('./my-app', CWD).dir).toBe(join(CWD, 'my-app'));
    expect(resolveProjectPath('../my-app', CWD).dir).toBe(join('/work', 'my-app'));
    expect(resolveProjectPath('./my-app', CWD).name).toBe('my-app');
  });
});

describe('an absolute path lands exactly where it was asked for', () => {
  it('is used as given, not appended to the current directory', () => {
    const p = resolveProjectPath('/tmp/demo/my-app', CWD);
    expect(p.dir).toBe(resolve('/tmp/demo/my-app'));
    // The bug: join() produced /work/dir/tmp/demo/my-app.
    expect(p.dir).not.toContain(join(CWD, 'tmp'));
    expect(p.name).toBe('my-app');
    expect(p.display).toBe('/tmp/demo/my-app');
  });

  it('names the project after the last segment, not the whole path', () => {
    // {{projectName}} is interpolated into package.json's `name`. A path there
    // is not a valid package name.
    expect(resolveProjectPath('/tmp/demo/my-app', CWD).name).toBe('my-app');
    expect(resolveProjectPath('/tmp/demo/my-app', CWD).name).not.toContain(sep);
  });

  it('ignores the current directory entirely', () => {
    const fromHere = resolveProjectPath('/tmp/demo/my-app', '/one/place');
    const fromThere = resolveProjectPath('/tmp/demo/my-app', '/another/place');
    expect(fromHere.dir).toBe(fromThere.dir);
  });
});

describe('a leading tilde', () => {
  it('expands to the home directory', () => {
    // A shell expands `~` first, so a literal one arrives only when quoted —
    // and the user still meant their home directory.
    const p = resolveProjectPath('~/sites/my-app', CWD);
    expect(p.dir).toBe(join(homedir(), 'sites', 'my-app'));
    expect(p.name).toBe('my-app');
    // Shown expanded, because a silent expansion is the thing worth showing.
    expect(p.display).toBe(p.dir);
  });

  it('never creates a directory literally called ~', () => {
    expect(resolveProjectPath('~/my-app', CWD).dir).not.toContain(`${sep}~${sep}`);
    expect(resolveProjectPath('~', CWD).dir).toBe(homedir());
    expect(resolveProjectPath('~/my-app', CWD).dir.startsWith(homedir())).toBe(true);
  });

  it("refuses another user's home rather than guessing at it", () => {
    expect(() => resolveProjectPath('~someone/sites/my-app', CWD)).toThrow(
      /Cannot expand '~someone' — only '~' for your own home directory is understood/,
    );
  });

  it('treats a tilde in the middle of a path as an ordinary character', () => {
    const p = resolveProjectPath('sites/~backup/my-app', CWD);
    expect(p.dir).toBe(join(CWD, 'sites', '~backup', 'my-app'));
  });
});

describe('paths that cannot name a project', () => {
  it('refuses an empty argument', () => {
    expect(() => resolveProjectPath('   ', CWD)).toThrow(/No project path given/);
  });

  it('refuses the filesystem root, which has no last segment', () => {
    expect(() => resolveProjectPath('/', CWD)).toThrow(/has no directory name to scaffold into/);
  });

  it('always returns an absolute directory', () => {
    for (const input of ['my-app', './my-app', '../my-app', '/tmp/my-app', '~/my-app']) {
      expect(isAbsolute(resolveProjectPath(input, CWD).dir), input).toBe(true);
    }
  });
});

describe('--for-repo resolves the same way', () => {
  it('honors an absolute path, a relative one and a tilde', () => {
    expect(resolveUserPath('/tmp/repo', CWD)).toBe(resolve('/tmp/repo'));
    expect(resolveUserPath('.', CWD)).toBe(CWD);
    expect(resolveUserPath('../repo', CWD)).toBe(join('/work', 'repo'));
    expect(resolveUserPath('~/repo', CWD)).toBe(join(homedir(), 'repo'));
    expect(() => resolveUserPath('~someone/repo', CWD)).toThrow(/Cannot expand '~someone'/);
  });
});

describe('--for-repo refuses a site outside the repository', () => {
  // `siteRelPath` is published: it becomes the starlight config's `editUrlBase`
  // ("Edit this page" on GitHub) and heads the generated AGENTS.md. A `..` in
  // it is a link that does not resolve.
  it('accepts a site inside the repository', () => {
    expect(siteRelativeToRepo('/repo', '/repo/site')).toBe('site');
    expect(siteRelativeToRepo('/repo', '/repo/docs/site')).toBe(join('docs', 'site'));
  });

  it('refuses a sibling of the repository', () => {
    expect(() => siteRelativeToRepo('/work/repo', '/work/out/site')).toThrow(
      /The site must be inside the repository --for-repo names/,
    );
  });

  it('names both paths, so the mistake is visible', () => {
    expect(() => siteRelativeToRepo('/work/repo', '/work/out/site')).toThrow(/\/work\/out\/site/);
    expect(() => siteRelativeToRepo('/work/repo', '/work/out/site')).toThrow(/\/work\/repo/);
  });

  it('refuses the repository parent, and a bare ..', () => {
    expect(() => siteRelativeToRepo('/work/repo', '/work')).toThrow(/must be inside the repository/);
    expect(() => siteRelativeToRepo('/work/repo/site', '/work/repo')).toThrow(
      /must be inside the repository/,
    );
  });

  it('is the repo root itself only when the two paths are equal', () => {
    // '' — the CLI cannot reach this: the repo root exists, so the "directory
    // already exists" refusal stops it first. No fallback name is needed.
    expect(siteRelativeToRepo('/repo', '/repo')).toBe('');
  });
});

describe('on disk', () => {
  it('writes an absolute target at that path and nowhere else', async () => {
    await withDirs(async ({ work, root }) => {
      const target = join(root, 'demo', 'my-app');
      const p = resolveProjectPath(target, work);

      await scaffold('one', { projectName: p.name, mode: 'ssg', recipesRoot: await fixture(work) }, p.dir);

      expect(await readFile(join(target, 'name.txt'), 'utf-8')).toBe('my-app');
      // The bug wrote the whole tree under the current directory instead.
      expect(existsSync(join(work, target.replace(/^\//, '')))).toBe(false);
    });
  });

  it('refuses an existing directory in both forms, against the resolved path', async () => {
    await withDirs(async ({ work, root }) => {
      // The check the CLI runs is existsSync(resolveProjectPath(arg).dir).
      const taken = join(root, 'taken');
      await mkdir(taken, { recursive: true });
      expect(existsSync(resolveProjectPath(taken, work).dir)).toBe(true);

      await mkdir(join(work, 'here'), { recursive: true });
      expect(existsSync(resolveProjectPath('here', work).dir)).toBe(true);

      // ...and a free path in either form is not refused.
      expect(existsSync(resolveProjectPath(join(root, 'free'), work).dir)).toBe(false);
      expect(existsSync(resolveProjectPath('free', work).dir)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

async function withDirs(fn: (d: { work: string; root: string }) => Promise<void>): Promise<void> {
  const base = await mkdtemp(join(tmpdir(), 'litro-abs-path-'));
  try {
    const work = join(base, 'work');
    const root = join(base, 'elsewhere');
    await mkdir(work, { recursive: true });
    await mkdir(root, { recursive: true });
    await fn({ work, root });
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}

/** A one-file recipe, so this spec tests placement and nothing else. */
async function fixture(work: string): Promise<string> {
  const root = join(work, '.recipes');
  const dir = join(root, 'one', 'template');
  await mkdir(dir, { recursive: true });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(root, 'one', 'recipe.config.js'), 'export default {\n  name: "one",\n  displayName: "one",\n  description: "one",\n  mode: "ssg",\n  adapters: ["lit"]\n};\n', 'utf-8');
  await writeFile(join(dir, 'name.txt'), '{{projectName}}', 'utf-8');
  return root;
}
