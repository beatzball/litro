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

  it('writes the handler stub and registers the endpoint on nitro.options.handlers', async () => {
    const nitro = mockNitro();
    await actionsPlugin(nitro as never);
    const handlerStubPath = join(rootDir, 'server', 'stubs', 'action-handler.ts');
    expect(existsSync(handlerStubPath)).toBe(true);
    const stub = await readFile(handlerStubPath, 'utf-8');
    expect(stub).toContain(`from '@beatzball/litro/actions/handler'`);
    expect(stub).toContain(`from '#litro/action-manifest'`);
    expect(nitro.options.handlers).toEqual([
      { route: '/_litro/action/:id', method: 'post', handler: handlerStubPath },
    ]);
  });

  it('re-scans on dev:reload without duplicating the handler registration', async () => {
    const nitro = mockNitro();
    await actionsPlugin(nitro as never);
    expect(nitro.hooks.hook).toHaveBeenCalledWith('dev:reload', expect.any(Function));
    const reload = nitro.hooks.hook.mock.calls.find((c) => c[0] === 'dev:reload')![1] as () => Promise<void>;
    await reload();
    expect(nitro.options.handlers).toHaveLength(1);
  });

  it('generates an empty manifest when no .server files exist', async () => {
    await rm(join(rootDir, 'actions'), { recursive: true });
    const nitro = mockNitro();
    await actionsPlugin(nitro as never);
    expect(nitro.options.virtual['#litro/action-manifest']).toContain('export const actionModules = [');
  });
});
