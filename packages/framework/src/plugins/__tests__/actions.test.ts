import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, writeFile, mkdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import actionsPlugin from '../actions.js';

let rootDir: string;

function mockNitro() {
  return {
    options: {
      rootDir,
      virtual: {} as Record<string, string>,
      handlers: [] as Array<{ route?: string; method?: string; handler: string }>,
    },
    hooks: { hook: vi.fn() },
    logger: { info: vi.fn(), warn: vi.fn() },
  };
}

beforeEach(async () => {
  rootDir = await mkdtemp(join(tmpdir(), 'litro-actions-'));
  await mkdir(join(rootDir, 'actions'), { recursive: true });
  await writeFile(
    join(rootDir, 'actions', 'demo.server.ts'),
    `export async function greet(name: string) { return 'hi ' + name; }\n`,
  );
  // Decoys that must NOT be scanned:
  await mkdir(join(rootDir, 'node_modules', 'pkg'), { recursive: true });
  await writeFile(join(rootDir, 'node_modules', 'pkg', 'x.server.ts'), 'export const a = 1;\n');
  await writeFile(join(rootDir, 'actions', 'demo.server.test.ts'), 'export const t = 1;\n');
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

describe('actionsPlugin', () => {
  it('sets the #litro/action-manifest virtual module with absolute-path imports', async () => {
    const nitro = mockNitro();
    await actionsPlugin(nitro as never);
    const virtual = nitro.options.virtual['#litro/action-manifest'];
    expect(virtual).toBeDefined();
    expect(virtual).toContain(join(rootDir, 'actions', 'demo.server.ts'));
    expect(virtual).toContain(`relPath: "actions/demo.server"`);
    expect(virtual).toContain('export const actionModules');
    // Decoys excluded:
    expect(virtual).not.toContain('node_modules');
    expect(virtual).not.toContain('demo.server.test');
  });

  it('writes the physical manifest stub with relative .js specifiers', async () => {
    await actionsPlugin(mockNitro() as never);
    const stub = await readFile(join(rootDir, 'server', 'stubs', 'action-manifest.ts'), 'utf-8');
    expect(stub).toContain('// @ts-nocheck');
    expect(stub).toContain(`"../../actions/demo.server.js"`);
    expect(stub).not.toContain(rootDir); // no absolute paths in the stub
  });

  it('writes the handler stub without touching nitro.options.handlers', async () => {
    const nitro = mockNitro();
    await actionsPlugin(nitro as never);
    const handlerStubPath = join(rootDir, 'server', 'stubs', 'action-handler.ts');
    expect(existsSync(handlerStubPath)).toBe(true);
    const stub = await readFile(handlerStubPath, 'utf-8');
    expect(stub).toContain(`from '@beatzball/litro/actions/handler'`);
    expect(stub).toContain(`from '#litro/action-manifest'`);
    // Route registration is the consumer's static nitro.config.ts handlers
    // entry — pushing here at build:before is too late for the dev server.
    expect(nitro.options.handlers).toEqual([]);
  });

  it('re-scans on dev:reload and skips rewriting unchanged stubs', async () => {
    const { stat } = await import('node:fs/promises');
    const nitro = mockNitro();
    await actionsPlugin(nitro as never);
    expect(nitro.hooks.hook).toHaveBeenCalledWith('dev:reload', expect.any(Function));
    const stubPath = join(rootDir, 'server', 'stubs', 'action-manifest.ts');
    const before = (await stat(stubPath)).mtimeMs;
    // A rescan with unchanged inputs must not rewrite the stub files —
    // they live inside Nitro's watched srcDir and rewriting them re-triggers
    // dev:reload in an infinite loop.
    const reload = nitro.hooks.hook.mock.calls.find((c) => c[0] === 'dev:reload')![1] as () => Promise<void>;
    await reload();
    const after = (await stat(stubPath)).mtimeMs;
    expect(after).toBe(before);
  });

  it('generates an empty manifest when no .server files exist', async () => {
    await rm(join(rootDir, 'actions'), { recursive: true });
    const nitro = mockNitro();
    await actionsPlugin(nitro as never);
    expect(nitro.options.virtual['#litro/action-manifest']).toContain('export const actionModules = [');
  });

  it('writes the runtime stamping plugin to server/plugins/litro-actions.ts', async () => {
    const nitro = mockNitro();
    await actionsPlugin(nitro as never);
    const pluginSrc = await readFile(join(rootDir, 'server', 'plugins', 'litro-actions.ts'), 'utf-8');
    expect(pluginSrc).toContain("import { stampActionIds } from '@beatzball/litro/actions/server';");
    expect(pluginSrc).toContain("import { actionModules } from '#litro/action-manifest';");
    expect(pluginSrc).toContain('export default function');
  });

  it('keeps .mjs extensions in stub manifest import specifiers', async () => {
    await writeFile(
      join(rootDir, 'actions', 'legacy.server.mjs'),
      `export async function old() { return 'old'; }\n`,
    );
    await actionsPlugin(mockNitro() as never);
    const stub = await readFile(join(rootDir, 'server', 'stubs', 'action-manifest.ts'), 'utf-8');
    expect(stub).toContain('legacy.server.mjs');
    expect(stub).not.toContain('legacy.server.js');
  });
});
