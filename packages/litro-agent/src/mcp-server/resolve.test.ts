/**
 * Startup, which is where every check that can be made before a host connects
 * has to be made.
 *
 * None of these needs the SDK. A project with no SDK installed still gets these
 * errors, and that separation is why `resolveMcpServer` is its own function.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { defineAgent, defineTool } from '../index.js';
import type { ToolDefinition } from '../index.js';
import { resolveMcpServer } from './index.js';
import { convertingSchema } from './fixtures.js';

let rootDir: string;

/** The agent module the fake loader answers with for every agent.ts. */
const agentModule = () => ({
  default: defineAgent({ model: null as never, instructions: './instructions.md' }),
});

function toolModule(app?: string): { default: ToolDefinition } {
  return {
    default: defineTool({
      description: 'A tool.',
      input: convertingSchema(),
      ...(app ? { app } : {}),
      execute: () => ({ ok: true }),
    }),
  };
}

/**
 * Builds a project tree, and a loader that answers for its files.
 *
 * The files on disk only have to EXIST — the scanner walks the filesystem, and
 * the loader is what turns a path into a module, exactly as Vite does on the
 * real path. Writing real TypeScript and compiling it would test Vite, not this.
 */
async function project(
  agents: Record<string, { tools: Record<string, string | undefined>; instructions?: string }>,
): Promise<(id: string) => Promise<Record<string, unknown>>> {
  const modules = new Map<string, Record<string, unknown>>();
  for (const [name, spec] of Object.entries(agents)) {
    const dir = join(rootDir, 'agents', name);
    await mkdir(join(dir, 'tools'), { recursive: true });
    await writeFile(join(dir, 'agent.ts'), '// fixture\n');
    if (spec.instructions !== undefined) await writeFile(join(dir, 'instructions.md'), spec.instructions);
    modules.set(join(dir, 'agent.ts'), agentModule());
    for (const [toolName, app] of Object.entries(spec.tools)) {
      await writeFile(join(dir, 'tools', `${toolName}.ts`), '// fixture\n');
      modules.set(join(dir, 'tools', `${toolName}.ts`), toolModule(app));
    }
  }
  return async (id: string) => {
    const mod = modules.get(id);
    if (!mod) throw new Error(`Cannot find module '${id}'`);
    return mod;
  };
}

async function writeManifest(entries: Array<{ name: string; uri: string }>): Promise<void> {
  const dir = join(rootDir, 'dist', 'mcp-apps');
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, 'manifest.json'),
    JSON.stringify(entries.map((e) => ({ ...e, html: `${e.name}.html`, descriptor: `${e.name}.json` }))),
  );
  for (const e of entries) {
    await writeFile(join(dir, `${e.name}.html`), `<!doctype html><body>${e.name}</body>\n`);
    await writeFile(
      join(dir, `${e.name}.json`),
      JSON.stringify({ uri: e.uri, name: e.name, mimeType: 'text/html;profile=mcp-app', _meta: { ui: {} } }),
    );
  }
}

beforeEach(async () => {
  rootDir = await mkdtemp(join(tmpdir(), 'litro-mcp-'));
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

describe('choosing the agent', () => {
  it('serves the only agent without being told which', async () => {
    const load = await project({ demo: { tools: { search: undefined }, instructions: 'Be brief.' } });
    const resolved = await resolveMcpServer({ cwd: rootDir, load });
    expect(resolved.agent.name).toBe('demo');
    expect(resolved.tools.map((t) => t.name)).toEqual(['search']);
    // instructions.md is inlined, the same as it is for the chat loop.
    expect(resolved.agent.config.instructions).toBe('Be brief.');
  });

  it('requires --agent when the project has more than one, and lists them', async () => {
    const load = await project({ demo: { tools: {} }, support: { tools: {} } });
    await expect(resolveMcpServer({ cwd: rootDir, load })).rejects.toThrow(
      /has 2 agents \(demo, support\), so --agent is required/,
    );
  });

  it('names the available agents when --agent does not match', async () => {
    const load = await project({ demo: { tools: {} }, support: { tools: {} } });
    await expect(resolveMcpServer({ cwd: rootDir, agent: 'sales', load })).rejects.toThrow(
      /no agent named "sales"[\s\S]*demo, support/,
    );
  });

  it('serves the named agent, and loads only that one', async () => {
    const load = await project({ demo: { tools: { a: undefined } }, support: { tools: { b: undefined } } });
    const broken = async (id: string) => {
      if (id.includes('/support/')) throw new Error('support/agent.ts is broken');
      return load(id);
    };
    const resolved = await resolveMcpServer({ cwd: rootDir, agent: 'demo', load: broken });
    expect(resolved.tools.map((t) => t.name)).toEqual(['a']);
  });

  it('says so plainly when the project has no agents at all', async () => {
    await expect(resolveMcpServer({ cwd: rootDir, load: async () => ({}) })).rejects.toThrow(
      /no agents found in .*\/agents\//,
    );
  });
});

describe('the apps a tool names', () => {
  it('resolves a manifest name to the address the build wrote', async () => {
    const load = await project({ demo: { tools: { 'get-weather': 'weather-card' } } });
    await writeManifest([{ name: 'weather-card', uri: 'ui://fixture/weather-card' }]);
    const resolved = await resolveMcpServer({ cwd: rootDir, load });
    expect(resolved.tools[0].entry._meta).toEqual({ ui: { resourceUri: 'ui://fixture/weather-card' } });
  });

  it('resolves a literal ui:// address too', async () => {
    const load = await project({ demo: { tools: { 'get-weather': 'ui://fixture/weather-card' } } });
    await writeManifest([{ name: 'weather-card', uri: 'ui://fixture/weather-card' }]);
    const resolved = await resolveMcpServer({ cwd: rootDir, load });
    expect(resolved.tools[0].entry._meta).toEqual({ ui: { resourceUri: 'ui://fixture/weather-card' } });
  });

  it('fails at startup when the app is not in the manifest, and lists what is', async () => {
    const load = await project({ demo: { tools: { 'get-weather': 'weather-chart' } } });
    await writeManifest([{ name: 'weather-card', uri: 'ui://fixture/weather-card' }]);
    await expect(resolveMcpServer({ cwd: rootDir, load })).rejects.toThrow(
      /names the app "weather-chart"[\s\S]*It lists: "weather-card" \(ui:\/\/fixture\/weather-card\)/,
    );
  });

  it('tells the reader to pack first when there is no manifest at all', async () => {
    const load = await project({ demo: { tools: { 'get-weather': 'weather-card' } } });
    await expect(resolveMcpServer({ cwd: rootDir, load })).rejects.toThrow(/Run `litro mcp-app build` first/);
  });

  it('serves tools with no apps when there is no manifest — not an error', async () => {
    const load = await project({ demo: { tools: { search: undefined } } });
    const resolved = await resolveMcpServer({ cwd: rootDir, load });
    expect(resolved.manifestMissing).toBe(true);
    expect(resolved.apps).toEqual([]);
    expect(resolved.tools[0].entry._meta).toBeUndefined();
  });

  it('reads the apps directory a caller points it at', async () => {
    const load = await project({ demo: { tools: { 'get-weather': 'weather-card' } } });
    const dir = join(rootDir, 'somewhere', 'else');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'manifest.json'), JSON.stringify([{ name: 'weather-card', uri: 'ui://x/card', html: 'c.html', descriptor: 'c.json' }]));
    await writeFile(join(dir, 'c.html'), 'bytes');
    await writeFile(join(dir, 'c.json'), JSON.stringify({ uri: 'ui://x/card', name: 'card', mimeType: 'text/html;profile=mcp-app' }));
    const resolved = await resolveMcpServer({ cwd: rootDir, appsDir: 'somewhere/else', load });
    expect(resolved.tools[0].entry._meta).toEqual({ ui: { resourceUri: 'ui://x/card' } });
  });
});

describe('tool names', () => {
  it('reports a name outside MCP guidance without failing or rewriting it', async () => {
    // Open question 4 of the spec is unresolved, so the behavior here is
    // deliberately neither of the two candidate rulings.
    const load = await project({ demo: { tools: { 'get weather': undefined } } });
    const resolved = await resolveMcpServer({ cwd: rootDir, load });
    expect(resolved.oddNames).toEqual(['get weather']);
    expect(resolved.tools[0].name).toBe('get weather');
  });

  it('leaves an ordinary name off that list', async () => {
    const load = await project({ demo: { tools: { 'get-weather.v2': undefined } } });
    const resolved = await resolveMcpServer({ cwd: rootDir, load });
    expect(resolved.oddNames).toEqual([]);
  });
});
