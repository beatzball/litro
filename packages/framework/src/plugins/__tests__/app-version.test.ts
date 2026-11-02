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
