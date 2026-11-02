import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeAppVersion, resolveClientDir } from '../app-version.js';

describe('resolveClientDir', () => {
  it('uses the publicAssets dir served at /_litro/', () => {
    expect(
      resolveClientDir('/proj', [
        { dir: '/proj/public', baseURL: '/' },
        { dir: '/proj/out/client', baseURL: '/_litro/' },
      ]),
    ).toBe('/proj/out/client');
  });

  // B3 from the PR 286 review: Nitro normalizes `${LITRO_BASE_PATH}/_litro/`
  // to `/litro/_litro`. That mount is the served directory; a leftover
  // `dist/client` is not.
  it('matches a mount under a base path, as Nitro normalizes it', () => {
    expect(
      resolveClientDir('/proj', [
        { dir: '/proj/public', baseURL: '/litro' },
        { dir: '/proj/build/client', baseURL: '/litro/_litro' },
      ]),
    ).toBe('/proj/build/client');
  });

  it('prefers the mount at exactly the base path', () => {
    expect(
      resolveClientDir(
        '/proj',
        [
          { dir: '/proj/other', baseURL: '/x/_litro' },
          { dir: '/proj/build/client', baseURL: '/litro/_litro/' },
        ],
        '/litro',
      ),
    ).toBe('/proj/build/client');
  });

  it('accepts a baseURL without slashes', () => {
    expect(resolveClientDir('/proj', [{ dir: '/x', baseURL: '_litro' }])).toBe('/x');
  });

  it('falls back to <rootDir>/dist/client', () => {
    expect(resolveClientDir('/proj', [])).toBe('/proj/dist/client');
  });
});

describe('computeAppVersion', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'litro-app-version-'));
    await mkdir(join(dir, 'assets'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('is the first 12 hex characters of the sha256 of app.js', async () => {
    const code = 'import{t}from"./assets/boot-abc.js";t();';
    await writeFile(join(dir, 'app.js'), code);
    await writeFile(join(dir, 'assets', 'boot-abc.js'), 'export const t=()=>{};');
    const expected = createHash('sha256').update(code).digest('hex').slice(0, 12);
    expect(await computeAppVersion(dir)).toEqual({ version: expected });
  });

  it('changes when app.js changes', async () => {
    await writeFile(join(dir, 'app.js'), 'import"./assets/boot-aaa.js";');
    const a = await computeAppVersion(dir);
    await writeFile(join(dir, 'app.js'), 'import"./assets/boot-bbb.js";');
    const b = await computeAppVersion(dir);
    expect(a.version).toBeDefined();
    expect(a.version).not.toBe(b.version);
  });

  it('gives no version when app.js is missing', async () => {
    expect(await computeAppVersion(dir)).toEqual({ version: undefined, reason: 'missing' });
  });

  // B2 from the PR 286 review: chunks may be emitted as .mjs or .cjs.
  it.each(['mjs', 'cjs'])('sees a .%s chunk that imports the entry', async (ext) => {
    await writeFile(join(dir, 'app.js'), 'export const t=1;');
    await writeFile(join(dir, 'assets', `page-x.${ext}`), `import{t}from"../app.js";`);
    expect(await computeAppVersion(dir)).toEqual({
      version: undefined,
      reason: 'imported',
      importers: [`assets/page-x.${ext}`],
    });
  });

  it.each([
    ['a dynamic import', 'import("../app.js").then(()=>{})'],
    ['a bare import', 'import"../app.js";'],
    ['a re-export', 'export*from"../app.js";'],
  ])('sees %s of the entry', async (_label, code) => {
    await writeFile(join(dir, 'app.js'), 'export const t=1;');
    await writeFile(join(dir, 'assets', 'page-x.js'), code);
    expect((await computeAppVersion(dir)).version).toBeUndefined();
  });

  it('ignores the entry path inside an ordinary string', async () => {
    await writeFile(join(dir, 'app.js'), 'export const t=1;');
    await writeFile(join(dir, 'assets', 'docs-x.js'), 'const sample="../app.js";const n="./app.js";');
    expect((await computeAppVersion(dir)).version).toMatch(/^[0-9a-f]{12}$/);
  });

  it('skips files copied from the public directory', async () => {
    const publicDir = await mkdtemp(join(tmpdir(), 'litro-public-'));
    try {
      await mkdir(join(publicDir, 'vendor'));
      const code = 'import{t}from"../app.js";';
      await writeFile(join(publicDir, 'vendor', 'demo.js'), code);
      await mkdir(join(dir, 'vendor'));
      await writeFile(join(dir, 'vendor', 'demo.js'), code);
      await writeFile(join(dir, 'app.js'), 'export const t=1;');
      expect((await computeAppVersion(dir, { publicDir })).version).toMatch(/^[0-9a-f]{12}$/);
    } finally {
      await rm(publicDir, { recursive: true, force: true });
    }
  });

  it.each([`"../app.js"`, `'../app.js'`, '`../app.js`'])(
    'gives no version when a chunk imports the entry as %s',
    async (spec) => {
      await writeFile(join(dir, 'app.js'), 'export const t=1;');
      await writeFile(join(dir, 'assets', 'page-x.js'), `import{t}from${spec};`);
      expect(await computeAppVersion(dir)).toEqual({
        version: undefined,
        reason: 'imported',
        importers: ['assets/page-x.js'],
      });
    },
  );
});
