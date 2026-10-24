/**
 * The page scanner refuses two page files that derive the same component tag.
 *
 * Component tags are filename-derived, and the page manifest imports every
 * page statically, so a duplicate tag means two `customElements.define()`
 * calls with the same name at module evaluation. The server dies before any
 * request is served. The scanner must catch this and name every file.
 *
 * The known pair is `pages/index.ts` (special-cased to `page-home`) next to
 * `pages/home.ts`. See issue 233.
 *
 * Run with: pnpm --filter @beatzball/litro test
 */

import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { fileToRoute, compareRoutes, assertUniqueComponentTags } from '../path-to-route.js';
import { scanAndWriteClientRoutes } from '../pages.js';

const ROOT_DIR = '/app';
const PAGES_DIR = '/app/pages';

function routesFor(relPaths: string[]) {
  return relPaths
    .map(rel => fileToRoute(`${PAGES_DIR}/${rel}`, PAGES_DIR))
    .sort(compareRoutes);
}

describe('assertUniqueComponentTags', () => {
  it('refuses pages/index.ts next to pages/home.ts and names both files', () => {
    const routes = routesFor(['index.ts', 'home.ts']);

    expect(() => assertUniqueComponentTags(routes, ROOT_DIR)).toThrowError(
      /"page-home" is claimed by 2 files/,
    );

    let message = '';
    try {
      assertUniqueComponentTags(routes, ROOT_DIR);
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain('pages/home.ts');
    expect(message).toContain('pages/index.ts');
    expect(message).toContain('Rename one of these files');
  });

  it('lists the colliding files one per line, root-relative and sorted', () => {
    // Scan order is reversed on purpose: the message must not depend on it.
    const routes = routesFor(['home.ts', 'index.ts']);

    let message = '';
    try {
      assertUniqueComponentTags(routes, ROOT_DIR);
    } catch (err) {
      message = (err as Error).message;
    }

    const listed = message
      .split('\n')
      .filter(line => line.startsWith('  '))
      .map(line => line.trim());
    expect(listed).toEqual(['pages/home.ts', 'pages/index.ts']);
    expect(message).not.toContain(ROOT_DIR + '/');
  });

  it('names every file in a three-way collision', () => {
    // index.ts → page-home (root special case), home.ts → page-home,
    // home/index.ts → page-home (trailing index is dropped).
    const routes = routesFor(['home/index.ts', 'index.ts', 'home.ts']);

    let message = '';
    try {
      assertUniqueComponentTags(routes, ROOT_DIR);
    } catch (err) {
      message = (err as Error).message;
    }

    expect(message).toContain('"page-home" is claimed by 3 files');
    expect(message).toContain('pages/home.ts');
    expect(message).toContain('pages/home/index.ts');
    expect(message).toContain('pages/index.ts');
  });

  it('reports every colliding tag in one error', () => {
    // Two independent collisions: page-home and page-blog-post.
    const routes = routesFor(['index.ts', 'home.ts', 'blog/post.ts', 'blog_post.ts']);

    let message = '';
    try {
      assertUniqueComponentTags(routes, ROOT_DIR);
    } catch (err) {
      message = (err as Error).message;
    }

    expect(message).toContain('"page-blog-post" is claimed by 2 files');
    expect(message).toContain('"page-home" is claimed by 2 files');
    expect(message).toContain('pages/blog/post.ts');
    expect(message).toContain('pages/blog_post.ts');
  });

  it('accepts an ordinary app whose pages all derive distinct tags', () => {
    const routes = routesFor([
      'index.ts',
      'about.ts',
      'blog/index.ts',
      'blog/[slug].ts',
      'docs/[...all].ts',
      '[[lang]]/pricing.ts',
    ]);

    expect(() => assertUniqueComponentTags(routes, ROOT_DIR)).not.toThrow();
  });

  it('accepts an empty route list', () => {
    expect(() => assertUniqueComponentTags([], ROOT_DIR)).not.toThrow();
  });
});

describe('scanAndWriteClientRoutes — duplicate tag', () => {
  let rootDir: string | undefined;

  afterEach(async () => {
    if (rootDir) await rm(rootDir, { recursive: true, force: true });
    rootDir = undefined;
  });

  async function scaffold(relPaths: string[]): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'litro-dup-tag-'));
    for (const rel of relPaths) {
      const abs = join(dir, 'pages', rel);
      await mkdir(join(abs, '..'), { recursive: true });
      await writeFile(abs, 'export default class {}\n', 'utf-8');
    }
    return dir;
  }

  it('rejects the scan and writes no routes file when two pages share a tag', async () => {
    rootDir = await scaffold(['index.ts', 'home.ts']);

    await expect(scanAndWriteClientRoutes(rootDir)).rejects.toThrowError(
      /"page-home" is claimed by 2 files/,
    );

    let message = '';
    try {
      await scanAndWriteClientRoutes(rootDir);
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain('pages/home.ts');
    expect(message).toContain('pages/index.ts');

    await expect(readFile(join(rootDir, 'routes.generated.ts'), 'utf-8')).rejects.toThrow();
  });

  it('still scans an ordinary app and writes routes.generated.ts', async () => {
    rootDir = await scaffold(['index.ts', 'about.ts', 'blog/index.ts', 'blog/[slug].ts']);

    await expect(scanAndWriteClientRoutes(rootDir)).resolves.toBeUndefined();

    const generated = await readFile(join(rootDir, 'routes.generated.ts'), 'utf-8');
    expect(generated).toContain('"page-home"');
    expect(generated).toContain('"page-about"');
    expect(generated).toContain('"page-blog"');
    expect(generated).toContain('"page-blog-slug"');
  });
});
