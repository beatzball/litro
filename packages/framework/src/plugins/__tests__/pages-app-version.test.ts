/**
 * The pages plugin writes the client entry version into the page manifest,
 * from the directory Nitro actually serves at /_litro/ (issue 253, and B3 from
 * the PR 286 review).
 *
 * Under LITRO_BASE_PATH=/litro, Nitro normalizes the mount's baseURL to
 * `/litro/_litro`. The plugin used to miss that mount and hash a leftover
 * `dist/client` instead: the manifest carried another build's hash, and the
 * check for chunks that import the entry ran against a directory nobody
 * serves.
 *
 * Run with: pnpm --filter @beatzball/litro test
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import type { Nitro } from 'nitropack';
import pagesPlugin from '../pages.js';

let roots: string[] = [];
const savedBasePath = process.env.LITRO_BASE_PATH;

const sha12 = (code: string) => createHash('sha256').update(code).digest('hex').slice(0, 12);

async function makeApp(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'litro-app-version-'));
  roots.push(root);
  await mkdir(join(root, 'pages'), { recursive: true });
  await writeFile(join(root, 'pages', 'index.ts'), 'export default class P {}\n');
  return root;
}

async function writeClient(dir: string, entry: string, chunk: string): Promise<void> {
  await mkdir(join(dir, 'assets'), { recursive: true });
  await writeFile(join(dir, 'app.js'), entry);
  await writeFile(join(dir, 'assets', 'page-x.js'), chunk);
}

function fakeNitro(rootDir: string, publicAssets: Array<{ dir: string; baseURL: string }>, dev = false) {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const nitro = {
    options: {
      rootDir,
      dev,
      publicAssets,
      virtual: {} as Record<string, string>,
      prerender: { routes: [] as string[] },
    },
    logger,
    hooks: { hook: () => {} },
  };
  return { nitro: nitro as unknown as Nitro, logger, virtual: nitro.options.virtual };
}

const VERSION_LINE = /globalThis\["__litro_app_version__"\] = "([0-9a-f]{12})";/;

afterEach(async () => {
  await Promise.all(roots.map(r => rm(r, { recursive: true, force: true })));
  roots = [];
  if (savedBasePath === undefined) delete process.env.LITRO_BASE_PATH;
  else process.env.LITRO_BASE_PATH = savedBasePath;
});

describe('pagesPlugin — client entry version', () => {
  it('hashes the served mount under a base path, not a leftover dist/client', async () => {
    process.env.LITRO_BASE_PATH = '/litro';
    const root = await makeApp();
    const served = 'import{t}from"./assets/boot-new.js";t();';
    await writeClient(join(root, 'build', 'client'), served, 'import{t}from"./boot-new.js";');
    await writeClient(join(root, 'dist', 'client'), 'stale entry', 'stale chunk');

    const { nitro, virtual } = fakeNitro(root, [
      { dir: join(root, 'public'), baseURL: '/litro' },
      { dir: join(root, 'build', 'client'), baseURL: '/litro/_litro' },
    ]);
    await pagesPlugin(nitro);

    expect(virtual['#litro/page-manifest']).toMatch(VERSION_LINE);
    expect(virtual['#litro/page-manifest'].match(VERSION_LINE)![1]).toBe(sha12(served));
  });

  it('runs the duplicate-runtime check on the served mount under a base path', async () => {
    process.env.LITRO_BASE_PATH = '/litro';
    const root = await makeApp();
    // The served build has a chunk that imports the entry by name...
    await writeClient(join(root, 'build', 'client'), 'export const t=1;', 'import{t}from"../app.js";');
    // ...and a leftover build that would pass the check.
    await writeClient(join(root, 'dist', 'client'), 'old entry', 'import"./boot-old.js";');

    const { nitro, logger, virtual } = fakeNitro(root, [
      { dir: join(root, 'build', 'client'), baseURL: '/litro/_litro' },
    ]);
    await pagesPlugin(nitro);

    expect(virtual['#litro/page-manifest']).not.toMatch(VERSION_LINE);
    expect(logger.warn.mock.calls.map(c => String(c[0])).join('\n')).toMatch(
      /import app\.js by name \(assets\/page-x\.js\)/,
    );
  });

  it('warns when the served mount has no app.js', async () => {
    const root = await makeApp();
    const { nitro, logger, virtual } = fakeNitro(root, [
      { dir: join(root, 'build', 'client'), baseURL: '/_litro' },
    ]);
    await pagesPlugin(nitro);

    expect(virtual['#litro/page-manifest']).not.toMatch(VERSION_LINE);
    expect(logger.warn.mock.calls.map(c => String(c[0])).join('\n')).toMatch(
      /No client entry at .*build\/client\/app\.js/,
    );
  });

  it('writes no version under litro dev', async () => {
    const root = await makeApp();
    await writeClient(join(root, 'dist', 'client'), 'entry', 'import"./boot.js";');
    const { nitro, logger, virtual } = fakeNitro(
      root,
      [{ dir: join(root, 'dist', 'client'), baseURL: '/_litro' }],
      true,
    );
    await pagesPlugin(nitro);

    expect(virtual['#litro/page-manifest']).not.toMatch(VERSION_LINE);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
