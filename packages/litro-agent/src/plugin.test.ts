import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, writeFile, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import agentsPlugin from './plugin.js';

let rootDir: string;

function mockNitro() {
  return {
    options: {
      rootDir,
      virtual: {} as Record<string, string>,
    },
    hooks: { hook: vi.fn() },
    logger: { info: vi.fn() },
  };
}

beforeEach(async () => {
  rootDir = await mkdtemp(join(tmpdir(), 'litro-agents-'));

  await mkdir(join(rootDir, 'agents', 'demo', 'tools'), { recursive: true });
  await writeFile(
    join(rootDir, 'agents', 'demo', 'agent.ts'),
    `import { defineAgent } from '@beatzball/litro-agent';\nexport default defineAgent({ model: null as never, instructions: 'placeholder' });\n`,
  );
  await writeFile(join(rootDir, 'agents', 'demo', 'instructions.md'), 'Be brief.');
  await writeFile(
    join(rootDir, 'agents', 'demo', 'tools', 'get-weather.ts'),
    `import { defineTool } from '@beatzball/litro-agent';\nexport default defineTool({ description: 'x', input: null as never, execute: () => null });\n`,
  );

  // Decoys that must NOT be scanned as agents:
  await mkdir(join(rootDir, 'agents', '_shared', 'skills', 'x'), { recursive: true });
  await writeFile(join(rootDir, 'agents', '_shared', 'skills', 'x', 'SKILL.md'), '# shared skill\n');

  await writeFile(
    join(rootDir, 'agents', '_config.ts'),
    `import { defineAgentConfig } from '@beatzball/litro-agent';\nexport default defineAgentConfig({});\n`,
  );
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

describe('agentsPlugin', () => {
  it('sets the #litro/agent-manifest virtual module with absolute-path imports', async () => {
    const nitro = mockNitro();
    await agentsPlugin(nitro as never);
    const virtual = nitro.options.virtual['#litro/agent-manifest'];
    expect(virtual).toBeDefined();
    expect(virtual).toContain(join(rootDir, 'agents', 'demo', 'agent.ts'));
    expect(virtual).toContain(join(rootDir, 'agents', 'demo', 'tools', 'get-weather.ts'));
    expect(virtual).toContain('name: "demo"');
    expect(virtual).toContain('instructions: "Be brief."');
    expect(virtual).toContain('name: "get-weather"');
    expect(virtual).toContain('export const agentEntries');
    // _shared is never scanned as an agent:
    expect(virtual).not.toContain('_shared');
  });

  it('writes the physical manifest stub with relative .js specifiers', async () => {
    await agentsPlugin(mockNitro() as never);
    const stub = await readFile(join(rootDir, 'server', 'stubs', 'agent-manifest.ts'), 'utf-8');
    expect(stub).toContain('// @ts-nocheck');
    expect(stub).toContain('"../../agents/demo/agent.js"');
    expect(stub).toContain('"../../agents/demo/tools/get-weather.js"');
    expect(stub).not.toContain(rootDir); // no absolute paths in the stub
  });

  it('generates the agent-config virtual + stub re-exporting agents/_config.ts when present', async () => {
    const nitro = mockNitro();
    await agentsPlugin(nitro as never);
    const virtual = nitro.options.virtual['#litro/agent-config'];
    expect(virtual).toBeDefined();
    expect(virtual).toContain(join(rootDir, 'agents', '_config.ts'));
    expect(virtual).toContain('export default');

    const stub = await readFile(join(rootDir, 'server', 'stubs', 'agent-config.ts'), 'utf-8');
    expect(stub).toContain('"../../agents/_config.js"');
    expect(stub).not.toContain(rootDir);
  });

  it('exports null from the agent-config virtual + stub when agents/_config.ts is absent', async () => {
    await rm(join(rootDir, 'agents', '_config.ts'));
    const nitro = mockNitro();
    await agentsPlugin(nitro as never);
    expect(nitro.options.virtual['#litro/agent-config']).toContain('export default null;');
    const stub = await readFile(join(rootDir, 'server', 'stubs', 'agent-config.ts'), 'utf-8');
    expect(stub).toContain('export default null;');
  });

  it('writes the handler stub importing from @beatzball/litro-agent/handler', async () => {
    const nitro = mockNitro();
    await agentsPlugin(nitro as never);
    const handlerStubPath = join(rootDir, 'server', 'stubs', 'agent-handler.ts');
    expect(existsSync(handlerStubPath)).toBe(true);
    const stub = await readFile(handlerStubPath, 'utf-8');
    expect(stub).toContain(`from '@beatzball/litro-agent/handler'`);
    expect(stub).toContain(`from '#litro/agent-manifest'`);
    expect(stub).toContain(`from '#litro/agent-config'`);
    expect(stub).toContain('createAgentHandler(agentEntries, agentConfig)');
  });

  it('re-scans on dev:reload and skips rewriting unchanged stubs', async () => {
    const nitro = mockNitro();
    await agentsPlugin(nitro as never);
    expect(nitro.hooks.hook).toHaveBeenCalledWith('dev:reload', expect.any(Function));

    const manifestStubPath = join(rootDir, 'server', 'stubs', 'agent-manifest.ts');
    const configStubPath = join(rootDir, 'server', 'stubs', 'agent-config.ts');
    const handlerStubPath = join(rootDir, 'server', 'stubs', 'agent-handler.ts');
    const before = await Promise.all(
      [manifestStubPath, configStubPath, handlerStubPath].map(async (p) => (await stat(p)).mtimeMs),
    );

    const reload = nitro.hooks.hook.mock.calls.find((c) => c[0] === 'dev:reload')![1] as () => Promise<void>;
    await reload();

    const after = await Promise.all(
      [manifestStubPath, configStubPath, handlerStubPath].map(async (p) => (await stat(p)).mtimeMs),
    );
    expect(after).toEqual(before);
  });

  it('generates an empty manifest when no agents exist', async () => {
    await rm(join(rootDir, 'agents'), { recursive: true });
    const nitro = mockNitro();
    await agentsPlugin(nitro as never);
    expect(nitro.options.virtual['#litro/agent-manifest']).toContain('export const agentEntries = [');
    expect(nitro.options.virtual['#litro/agent-config']).toContain('export default null;');
  });

  it('inlines an empty instructions string when instructions.md is absent', async () => {
    await rm(join(rootDir, 'agents', 'demo', 'instructions.md'));
    const nitro = mockNitro();
    await agentsPlugin(nitro as never);
    expect(nitro.options.virtual['#litro/agent-manifest']).toContain('instructions: ""');
  });
});
