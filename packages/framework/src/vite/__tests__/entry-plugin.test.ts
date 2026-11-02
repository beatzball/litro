import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fastGlob from 'fast-glob';
import { build } from 'vite';
import { litroEntryPlugin, collectEntryStaticDeps, withBootGroup } from '../entry.js';
import { computeAppVersion } from '../../plugins/app-version.js';

describe('collectEntryStaticDeps', () => {
  const graph = (mods: Record<string, { isEntry?: boolean; importedIds?: string[] }>) => ({
    getModuleIds: () => Object.keys(mods)[Symbol.iterator]() as IterableIterator<string>,
    getModuleInfo: (id: string) =>
      mods[id] ? { isEntry: !!mods[id].isEntry, importedIds: mods[id].importedIds ?? [] } : null,
  });

  it('follows static imports transitively and leaves out the entry', () => {
    const deps = collectEntryStaticDeps(
      graph({
        '/app.ts': { isEntry: true, importedIds: ['/hydrate.js', '\0vite/preload-helper.js'] },
        '/hydrate.js': { importedIds: ['/lit-html.js'] },
        '/lit-html.js': {},
        '\0vite/preload-helper.js': {},
        // Reached only through a dynamic import: not in the static graph.
        '/app-main.ts': { importedIds: ['/lit-element.js'] },
        '/lit-element.js': { importedIds: ['/lit-html.js'] },
      }),
    );
    expect([...deps].sort()).toEqual(['\0vite/preload-helper.js', '/hydrate.js', '/lit-html.js']);
  });

  it('survives an import cycle', () => {
    const deps = collectEntryStaticDeps(
      graph({
        '/app.ts': { isEntry: true, importedIds: ['/a.js'] },
        '/a.js': { importedIds: ['/b.js'] },
        '/b.js': { importedIds: ['/a.js', '/app.ts'] },
      }),
    );
    expect([...deps].sort()).toEqual(['/a.js', '/b.js']);
  });
});

describe('withBootGroup', () => {
  const test = () => true;

  it('adds the boot group when no code splitting is configured', () => {
    const out = withBootGroup({ entryFileNames: '[name].js' } as { codeSplitting?: unknown }, test);
    expect(out).toMatchObject({
      entryFileNames: '[name].js',
      codeSplitting: { groups: [{ name: 'boot', test }] },
    });
  });

  it('puts the boot group first and keeps the app groups', () => {
    const appGroup = { name: 'vendor', test: /node_modules/ };
    const out = withBootGroup({ codeSplitting: { minSize: 10, groups: [appGroup] } }, test) as {
      codeSplitting: { minSize: number; groups: Array<{ name: string }> };
    };
    expect(out.codeSplitting.minSize).toBe(10);
    expect(out.codeSplitting.groups.map(g => g.name)).toEqual(['boot', 'vendor']);
  });

  it('leaves the options alone when code splitting is turned off', () => {
    expect(withBootGroup({ codeSplitting: false }, test)).toBeNull();
  });
});

// A real client build. The fixture has the shape that caused the fault: the
// entry statically imports a module that a lazily loaded page also imports.
describe('litroEntryPlugin in a vite build', () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'litro-entry-'));
    await writeFile(join(root, 'shared.js'), 'export const shared = () => "shared-marker";\n');
    await writeFile(
      join(root, 'app.js'),
      'import { shared } from "./shared.js";\nshared();\nvoid import("./page.js");\n',
    );
    await writeFile(
      join(root, 'page.js'),
      'import { shared } from "./shared.js";\nexport const page = () => shared() + "-page";\n',
    );
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function buildFixture(withPlugin: boolean): Promise<string> {
    const outDir = join(root, withPlugin ? 'out-plugin' : 'out-plain');
    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      base: '/_litro/',
      plugins: withPlugin ? [litroEntryPlugin()] : [],
      build: {
        outDir,
        emptyOutDir: true,
        minify: false,
        rollupOptions: { input: join(root, 'app.js'), output: { entryFileNames: '[name].js' } },
      },
    });
    return outDir;
  }

  async function chunksImportingEntry(outDir: string): Promise<string[]> {
    const files = await fastGlob('assets/**/*.js', { cwd: outDir });
    const hits: string[] = [];
    for (const f of files) {
      if (/["'`]\.\.\/app\.js["'`]/.test(await readFile(join(outDir, f), 'utf-8'))) hits.push(f);
    }
    return hits;
  }

  it('without the plugin, shared code sits in app.js and a chunk imports it (the fault)', async () => {
    const outDir = await buildFixture(false);
    expect(await readFile(join(outDir, 'app.js'), 'utf-8')).toContain('shared-marker');
    expect(await chunksImportingEntry(outDir)).not.toEqual([]);
    expect(await computeAppVersion(outDir)).toMatchObject({ version: undefined, reason: 'imported' });
  });

  it('with the plugin, app.js holds no shared code and no chunk imports it', async () => {
    const outDir = await buildFixture(true);
    const entry = await readFile(join(outDir, 'app.js'), 'utf-8');
    expect(entry).not.toContain('shared-marker');
    expect(entry).toMatch(/from ["']\.\/assets\/boot-[\w-]+\.js["']/);
    expect(await chunksImportingEntry(outDir)).toEqual([]);
    const result = await computeAppVersion(outDir);
    expect(result.version).toMatch(/^[0-9a-f]{12}$/);
  });
});
