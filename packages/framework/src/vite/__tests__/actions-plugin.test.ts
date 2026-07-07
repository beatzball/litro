import { describe, it, expect } from 'vitest';
import { litroActionsPlugin } from '../actions.js';
import { hashActionId } from '../../actions/hash.js';

// The transform receives transpiled JS (normal plugin ordering), so tests
// feed plain JS sources.
async function runTransform(code: string, id: string): Promise<string | null> {
  const plugin = litroActionsPlugin();
  (plugin.configResolved as (c: { root: string }) => void)({ root: '/proj' });
  const result = await (
    plugin.transform as (code: string, id: string) => Promise<{ code: string } | null>
  )(code, id);
  return result?.code ?? null;
}

describe('litroActionsPlugin', () => {
  it('ignores modules that are not .server files', async () => {
    expect(await runTransform('export const x = 1;', '/proj/pages/index.ts')).toBeNull();
  });

  it('replaces named exports with callAction stubs using the hashed id', async () => {
    const code = `export async function getPost(id) { return db.find(id); }\nexport const createPost = defineAction({ handler: async () => 1 });`;
    const out = await runTransform(code, '/proj/posts/posts.server.ts');
    expect(out).toContain(`import { makeStub } from '@beatzball/litro/actions/client';`);
    expect(out).toContain(
      `export const getPost = makeStub("${hashActionId('posts/posts.server', 'getPost')}");`,
    );
    expect(out).toContain(
      `export const createPost = makeStub("${hashActionId('posts/posts.server', 'createPost')}");`,
    );
    // The original module body must be gone entirely:
    expect(out).not.toContain('db.find');
    expect(out).not.toContain('defineAction');
  });

  it('supports default exports', async () => {
    const out = await runTransform(
      'export default async function main() { return 1; }',
      '/proj/x.server.ts',
    );
    expect(out).toContain(
      `export default makeStub("${hashActionId('x.server', 'default')}");`,
    );
  });

  it('strips Vite query suffixes from the id before hashing', async () => {
    const out = await runTransform('export async function f() {}', '/proj/x.server.ts?v=abc');
    expect(out).toContain(hashActionId('x.server', 'f'));
  });

  it('errors on definitely-non-function exports (data leak guard)', async () => {
    await expect(
      runTransform(`export const secret = "hunter2";`, '/proj/x.server.ts'),
    ).rejects.toThrow(/non-function export/i);
    await expect(
      runTransform(`export const config = { key: 1 };`, '/proj/x.server.ts'),
    ).rejects.toThrow(/non-function export/i);
  });

  it('errors on export * re-exports (names unknowable statically)', async () => {
    await expect(
      runTransform(`export * from './other.js';`, '/proj/x.server.ts'),
    ).rejects.toThrow(/export \*/);
  });

  it('allows function-valued and call-expression exports, stubbing each one', async () => {
    const out = await runTransform(
      `export const a = () => 1;\nexport const b = defineAction({});\nexport async function c() {}`,
      '/proj/x.server.ts',
    );
    for (const name of ['a', 'b', 'c']) {
      expect(out).toContain(
        `export const ${name} = makeStub("${hashActionId('x.server', name)}");`,
      );
    }
    // The stub must not retain any original initializer code.
    expect(out).not.toContain('() => 1');
    expect(out).not.toContain('defineAction');
  });

  it('errors on definitely-non-function expression initializers', async () => {
    await expect(
      runTransform(`export const port = 1 + 1;`, '/proj/x.server.ts'),
    ).rejects.toThrow(/non-function export/i);
  });

  it('ignores .server modules inside node_modules', async () => {
    expect(
      await runTransform('export async function f() {}', '/proj/node_modules/pkg/x.server.ts'),
    ).toBeNull();
  });

  it('stubs @beatzball/litro/actions/server in client builds', async () => {
    const plugin = litroActionsPlugin();
    const resolved = (plugin.resolveId as (id: string) => string | undefined)(
      '@beatzball/litro/actions/server',
    );
    expect(resolved).toBe('\0litro:actions-server-stub');
    const code = (plugin.load as (id: string) => string | undefined)(resolved!);
    expect(code).toContain('server-only');
    expect(code).toContain('export const csrfToken');
    expect(code).toContain('export const getFormErrors');
    expect(code).toContain('export const stampActionIds');
  });
});
