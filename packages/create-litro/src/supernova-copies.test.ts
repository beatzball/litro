/**
 * Every copy of a supernova landing-page component, pinned byte for byte.
 *
 * WHY THIS EXISTS
 *
 * A component of this recipe now lives in three places:
 *
 *   1. `recipes/supernova/template/src/components/` — what a user is given.
 *   2. `playground-supernova/src/components/` — the recipe run as a dev app,
 *      which is what the recipe's e2e suite actually drives.
 *   3. `packages/docs-ui/src/components/` — litro's own two docs sites, which
 *      adopted the recipe for their home page.
 *
 * None of them is a symlink, because each has to be a real file: a scaffolded
 * app owns its copy and edits it, the playground is built as a separate app,
 * and `packages/docs-ui` is the workspace package both docs sites import from.
 *
 * So a fix made in one place and not the others leaves a green suite behind a
 * broken shipped file. The suites cannot catch that, because each one drives a
 * different copy. These tests do, by comparing the bytes.
 *
 * `hero-video.test.ts` pinned the first of these pairs. This file covers all
 * of them, including `litro-hero-video`, so a new component is one line here.
 *
 * WHEN A TEST HERE FAILS, COPY THE FILE — do not edit the assertion. The recipe
 * is the source of truth, so the fix is nearly always:
 *
 *   cp packages/create-litro/recipes/supernova/template/src/components/<name>.ts \
 *      playground-supernova/src/components/<name>.ts
 *
 * and the same into `packages/docs-ui/src/components/` for a component that
 * file lists below.
 */
import { readFile } from 'node:fs/promises';
import { describe, it, expect } from 'vitest';

/** Every landing-page component the recipe ships. */
const RECIPE_COMPONENTS = [
  'litro-feature-row',
  'litro-hero-nova',
  'litro-hero-video',
  'litro-install-command',
  'litro-key-hints',
  'litro-state-badge',
  'litro-status-line',
  'litro-steps',
  'litro-term-window',
] as const;

/**
 * The subset litro's own docs sites use.
 *
 * `litro-key-hints` and `litro-hero-video` are not here because the docs home
 * page has no keyboard shortcuts to list and no clip to play. Adding one to
 * the page means copying the file and adding its name here.
 */
const DOCS_UI_COMPONENTS = [
  'litro-feature-row',
  'litro-hero-nova',
  'litro-install-command',
  'litro-state-badge',
  'litro-status-line',
  'litro-steps',
  'litro-term-window',
] as const;

function recipeFile(name: string): URL {
  return new URL(
    `../recipes/supernova/template/src/components/${name}.ts`,
    import.meta.url,
  );
}

function playgroundFile(name: string): URL {
  return new URL(
    `../../../playground-supernova/src/components/${name}.ts`,
    import.meta.url,
  );
}

function docsUiFile(name: string): URL {
  return new URL(`../../docs-ui/src/components/${name}.ts`, import.meta.url);
}

describe('playground-supernova carries the recipe components unchanged', () => {
  for (const name of RECIPE_COMPONENTS) {
    it(`${name}.ts is byte for byte the recipe's copy`, async () => {
      const recipe = await readFile(recipeFile(name), 'utf-8');
      const playground = await readFile(playgroundFile(name), 'utf-8');
      expect(playground).toBe(recipe);
    });
  }
});

describe('packages/docs-ui carries the recipe components unchanged', () => {
  for (const name of DOCS_UI_COMPONENTS) {
    it(`${name}.ts is byte for byte the recipe's copy`, async () => {
      const recipe = await readFile(recipeFile(name), 'utf-8');
      const docsUi = await readFile(docsUiFile(name), 'utf-8');
      expect(docsUi).toBe(recipe);
    });
  }
});

/**
 * A component registers itself while it loads, and an import that binds no
 * names looks unused to the bundler that builds the Nitro server. Rollup then
 * drops it, the element is never defined on the server, and SSR prints a bare
 * tag with no shadow root — which builds green (BUILD-001).
 *
 * `packages/docs-ui` keeps that from happening with a `sideEffects` entry, and
 * a copied component is only safe while that entry still covers it.
 */
describe('the docs-ui package declares its components as side-effectful', () => {
  it('covers every copied component with a sideEffects entry', async () => {
    const manifest = JSON.parse(
      await readFile(new URL('../../docs-ui/package.json', import.meta.url), 'utf-8'),
    ) as { sideEffects?: string[] };

    expect(manifest.sideEffects).toContain('./src/components/*.ts');
  });
});
