/**
 * A page scan that throws during `dev:reload` must not kill `litro dev`.
 *
 * `litro dev` installs an uncaughtException guard that exits on anything but
 * ECONNRESET and EPIPE. A rejected `dev:reload` hook reaches it, so one bad
 * file name (`pages/[id].html.ts`) or a duplicate component tag used to take
 * the whole dev server down. The hook now logs the error and keeps serving.
 * The first scan, which `litro build` runs, must still fail hard.
 *
 * Run with: pnpm --filter @beatzball/litro test
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import type { Nitro } from 'nitropack';
import pagesPlugin from '../pages.js';

const PAGE = `export default class P {}\n`;

let roots: string[] = [];

async function makeApp(pages: string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'litro-dev-reload-'));
  roots.push(root);
  await mkdir(join(root, 'pages'), { recursive: true });
  for (const rel of pages) await writeFile(join(root, 'pages', rel), PAGE);
  return root;
}

function fakeNitro(rootDir: string) {
  const hooks: Record<string, (...args: unknown[]) => unknown> = {};
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const nitro = {
    options: { rootDir, virtual: {} as Record<string, string>, prerender: { routes: [] as string[] } },
    logger,
    hooks: { hook: (name: string, fn: (...args: unknown[]) => unknown) => { hooks[name] = fn; } },
  };
  return { nitro: nitro as unknown as Nitro, hooks, logger, virtual: nitro.options.virtual };
}

afterEach(async () => {
  await Promise.all(roots.map(r => rm(r, { recursive: true, force: true })));
  roots = [];
});

describe('pagesPlugin — dev:reload survives a scan that throws', () => {
  it('the first scan still rejects, so litro build stops on a bad file name', async () => {
    const root = await makeApp(['index.ts', '[id].html.ts']);
    const { nitro } = fakeNitro(root);
    await expect(pagesPlugin(nitro)).rejects.toThrow(/pages\/\[id\]\.html\.ts/);
  });

  it('a bad file name added during dev is logged and the hook does not reject', async () => {
    const root = await makeApp(['index.ts', 'about.ts']);
    const { nitro, hooks, logger, virtual } = fakeNitro(root);
    await pagesPlugin(nitro);
    const goodManifest = virtual['#litro/page-manifest'];
    expect(goodManifest).toContain('/about');

    await writeFile(join(root, 'pages', '[id].html.ts'), PAGE);
    await expect(hooks['dev:reload']()).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0][0]).toMatch(
      /Page scan failed; still serving the last good routes\..*pages\/\[id\]\.html\.ts/,
    );
    // The last good manifest is left in place.
    expect(virtual['#litro/page-manifest']).toBe(goodManifest);
  });

  it('a duplicate component tag added during dev is logged and the hook does not reject', async () => {
    const root = await makeApp(['index.ts']);
    const { nitro, hooks, logger } = fakeNitro(root);
    await pagesPlugin(nitro);

    await writeFile(join(root, 'pages', 'home.ts'), PAGE);
    await expect(hooks['dev:reload']()).resolves.toBeUndefined();
    expect(logger.error.mock.calls[0][0]).toMatch(/"page-home" is claimed by 2 files/);
  });

  it('the next reload after the file is fixed scans again', async () => {
    const root = await makeApp(['index.ts']);
    const { nitro, hooks, logger, virtual } = fakeNitro(root);
    await pagesPlugin(nitro);

    await writeFile(join(root, 'pages', '[id].html.ts'), PAGE);
    await hooks['dev:reload']();
    expect(logger.error).toHaveBeenCalledTimes(1);

    await rm(join(root, 'pages', '[id].html.ts'));
    await writeFile(join(root, 'pages', '[id].ts'), PAGE);
    await hooks['dev:reload']();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(virtual['#litro/page-manifest']).toContain('/:id');
  });
});
