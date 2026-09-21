/**
 * Tests for the project side-effects Rollup plugin.
 *
 * The bug these pin: Nitro builds the server bundle with
 * `treeshake.moduleSideEffects` answering `false` for every project module, so
 * a page's bare `import './components/litro-card.js'` — the line that calls
 * `customElements.define()` — is deleted from the bundle. SSR then prints an
 * unexpanded tag and the build still exits 0.
 *
 * The Rollup run below reproduces exactly that setting over a three-file
 * fixture, so the first test fails if the plugin ever stops working.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { realpath } from 'node:fs/promises';
import { rollup } from 'rollup';
import { isProjectModule, projectSideEffectsPlugin } from '../side-effects.js';

/** Text that only the side-effect-only module contributes. */
const MARKER = '__litro_test_component_registered__';

let rootDir: string;

beforeAll(async () => {
  // realpath: macOS hands out /var/folders/... which is a symlink to
  // /private/var/..., and Rollup reports the resolved path.
  rootDir = await realpath(await mkdtemp(join(tmpdir(), 'litro-side-effects-')));

  await mkdir(join(rootDir, 'src'), { recursive: true });
  await mkdir(join(rootDir, 'pages'), { recursive: true });

  // The component: side effects only, no exports anyone imports.
  await writeFile(
    join(rootDir, 'src', 'component.js'),
    `globalThis.${MARKER} = true;\n`,
  );

  // The page: registers the component with a bare import, like a real page.
  await writeFile(
    join(rootDir, 'pages', 'index.js'),
    `import '../src/component.js';\nexport const routeMeta = { title: 'Home' };\n`,
  );

  // The manifest: a namespace import, like the generated page manifest.
  await writeFile(
    join(rootDir, 'entry.js'),
    `import * as _page0 from './pages/index.js';\nexport const pageModules = { page: _page0 };\n`,
  );
});

afterAll(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

/** Bundles the fixture the way Nitro does, optionally with the plugin. */
async function bundleFixture(withPlugin: boolean): Promise<string> {
  const build = await rollup({
    input: join(rootDir, 'entry.js'),
    // Nitro's own setting: every module is side-effect free unless a plugin
    // says otherwise (see getRollupConfig in nitropack).
    treeshake: { moduleSideEffects: () => false },
    plugins: withPlugin ? [projectSideEffectsPlugin(rootDir) as never] : [],
  });
  const { output } = await build.generate({ format: 'esm' });
  await build.close();
  return output.map(chunk => ('code' in chunk ? chunk.code : '')).join('\n');
}

describe('projectSideEffectsPlugin', () => {
  it('keeps a page’s bare component import in the bundle', async () => {
    const code = await bundleFixture(true);
    expect(code).toContain(MARKER);
  });

  it('confirms the fixture reproduces the drop without the plugin', async () => {
    const code = await bundleFixture(false);
    expect(code).not.toContain(MARKER);
  });
});

describe('isProjectModule', () => {
  const root = '/app';

  it('accepts a source file under the project root', () => {
    expect(isProjectModule('/app/src/components/litro-card.ts', root)).toBe(true);
  });

  it('accepts a file with a query suffix', () => {
    expect(isProjectModule('/app/src/styles.css?inline', root)).toBe(true);
  });

  it('rejects a dependency inside the project root', () => {
    expect(isProjectModule('/app/node_modules/lit/index.js', root)).toBe(false);
  });

  it('rejects a file outside the project root', () => {
    expect(isProjectModule('/elsewhere/src/thing.ts', root)).toBe(false);
  });

  it('rejects a virtual module', () => {
    expect(isProjectModule('\0#litro/page-manifest', root)).toBe(false);
    expect(isProjectModule('virtual:litro-content', root)).toBe(false);
  });

  it('does not treat a sibling directory with the same prefix as inside', () => {
    expect(isProjectModule('/app-other/src/thing.ts', root)).toBe(false);
  });
});
