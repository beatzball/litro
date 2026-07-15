/**
 * Nitro build-time plugin: agent directory scanner and manifest codegen.
 *
 * Called directly from nitro.config.ts hooks['build:before'], exactly like
 * the framework's actions plugin (see
 * `packages/framework/src/plugins/actions.ts` — this file deliberately
 * mirrors it). It:
 *
 *   1. Scans `agents/*\/agent.ts` under rootDir (skipping `_`-prefixed
 *      agent directories such as `agents/_shared/`), and per agent scans
 *      `agents/<name>/tools/*.ts` plus an optional `agents/<name>/instructions.md`.
 *   2. Generates the `#litro/agent-manifest` virtual module (absolute-path
 *      imports for Rollup) and the physical stub
 *      `server/stubs/agent-manifest.ts` (relative .js imports for tsc and
 *      @rollup/plugin-node-resolve via package.json "imports"). The
 *      manifest inlines each agent's `instructions.md` CONTENT directly —
 *      never a timestamp or path — so the content-compared `writeStub`
 *      below stays stable across dev reloads (spike Q2, design spec §10).
 *   3. Generates the `#litro/agent-config` virtual module and physical stub
 *      `server/stubs/agent-config.ts`, re-exporting `agents/_config.ts`'s
 *      default export when that file exists, else `export default null;`.
 *   4. Generates `server/stubs/agent-handler.ts` — a one-line handler that
 *      feeds the manifest + config into createAgentHandler().
 *   5. The endpoint routes themselves are declared statically in the
 *      consumer's nitro.config.ts handlers array pointing at that generated
 *      stub (a build:before push into nitro.options.handlers never reaches
 *      the dev server — see the NOTE at the bottom of actions.ts for the
 *      same timing trap, verified there for devHandlers).
 *
 * NOTE on duplication: `toRelativeImportSpecifier` and `writeStub` below are
 * copied from `packages/framework/src/plugins/actions.ts` verbatim (module
 * boundaries: this package must not import framework plugin internals).
 * Keep both in sync by hand if the convention ever changes.
 */
import type { Nitro } from 'nitropack';
import fastGlob from 'fast-glob';
import { resolve, join, relative, basename, dirname, extname } from 'pathe';
import { writeFile, mkdir, readFile, stat } from 'node:fs/promises';

const AGENTS_DIR = 'agents';
const MANIFEST_STUB_REL = join('server', 'stubs', 'agent-manifest.ts');
const CONFIG_STUB_REL = join('server', 'stubs', 'agent-config.ts');
const HANDLER_STUB_REL = join('server', 'stubs', 'agent-handler.ts');

interface ScannedTool {
  name: string;
  file: string;
}

interface ScannedAgent {
  name: string;
  agentFile: string;
  instructions: string;
  tools: ScannedTool[];
}

async function scanTools(agentDir: string): Promise<ScannedTool[]> {
  const files = await fastGlob('tools/*.ts', {
    cwd: agentDir,
    absolute: true,
    onlyFiles: true,
    followSymbolicLinks: true,
    ignore: ['**/node_modules/**', '**/*.d.ts', '**/*.test.*', '**/*.spec.*'],
  });
  return files
    .sort()
    .map((f) => ({ name: basename(f, extname(f)), file: f }));
}

async function readInstructions(agentDir: string): Promise<string> {
  try {
    return await readFile(join(agentDir, 'instructions.md'), 'utf-8');
  } catch {
    return '';
  }
}

async function scanAgents(rootDir: string): Promise<ScannedAgent[]> {
  const agentFiles = await fastGlob(`${AGENTS_DIR}/*/agent.ts`, {
    cwd: rootDir,
    absolute: true,
    onlyFiles: true,
    followSymbolicLinks: true,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.output/**',
      '**/.nitro/**',
      '**/server/stubs/**',
    ],
  });

  const agents: ScannedAgent[] = [];
  for (const agentFile of agentFiles.sort()) {
    const agentDir = dirname(agentFile);
    const name = basename(agentDir);
    if (name.startsWith('_')) continue; // agents/_shared/, etc. are never agents

    const [instructions, tools] = await Promise.all([
      readInstructions(agentDir),
      scanTools(agentDir),
    ]);
    agents.push({ name, agentFile, instructions, tools });
  }
  return agents;
}

async function findConfigFile(rootDir: string): Promise<string | undefined> {
  const configFile = join(rootDir, AGENTS_DIR, '_config.ts');
  try {
    await stat(configFile);
    return configFile;
  } catch {
    return undefined;
  }
}

/** Same convention as actions.ts: relative specifier with a .js extension,
 *  computed from the directory containing the generated file. */
function toRelativeImportSpecifier(fromFile: string, toFile: string): string {
  const rel = relative(join(fromFile, '..'), toFile).replace(/\.(ts|tsx)$/, '.js');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

function generateAgentManifest(
  agents: ScannedAgent[],
  rootDir: string,
  variant: 'virtual' | 'stub',
): string {
  const stubPath = join(rootDir, MANIFEST_STUB_REL);
  const importSpecifier = (f: string): string =>
    variant === 'virtual' ? f : toRelativeImportSpecifier(stubPath, f);

  const imports: string[] = [];
  const entries: string[] = [];

  agents.forEach((agent, i) => {
    imports.push(`import * as _agent${i} from ${JSON.stringify(importSpecifier(agent.agentFile))};`);

    const toolEntries = agent.tools
      .map((tool, j) => {
        imports.push(
          `import * as _agent${i}_tool${j} from ${JSON.stringify(importSpecifier(tool.file))};`,
        );
        return `      { name: ${JSON.stringify(tool.name)}, module: _agent${i}_tool${j} }`;
      })
      .join(',\n');

    entries.push(
      `  {
    name: ${JSON.stringify(agent.name)},
    module: _agent${i},
    instructions: ${JSON.stringify(agent.instructions)},
    tools: [
${toolEntries}
    ],
  }`,
    );
  });

  return `// @ts-nocheck
// @generated by litro agent scanner — do not edit
// This is the #litro/agent-manifest virtual module.
// It is re-generated on every build and dev-reload.
${imports.join('\n')}

export const agentEntries = [
${entries.join(',\n')}
];
`;
}

function generateAgentConfig(
  configFile: string | undefined,
  rootDir: string,
  variant: 'virtual' | 'stub',
): string {
  const header = `// @ts-nocheck
// @generated by litro agent scanner — do not edit
// This is the #litro/agent-config virtual module.
// It is re-generated on every build and dev-reload.`;

  if (!configFile) {
    return `${header}
export default null;
`;
  }

  const stubPath = join(rootDir, CONFIG_STUB_REL);
  const importSpecifier = variant === 'virtual' ? configFile : toRelativeImportSpecifier(stubPath, configFile);

  return `${header}
import _config from ${JSON.stringify(importSpecifier)};

export default _config;
`;
}

const HANDLER_STUB_SOURCE = `// @ts-nocheck
// @generated by litro agent scanner — do not edit
// Runtime handler for /__litro/agent/:agent/:session — generated by the
// litro agents plugin; the route is declared in nitro.config.ts handlers.
import { createAgentHandler } from '@beatzball/litro-agent/handler';
import { agentEntries } from '#litro/agent-manifest';
import agentConfig from '#litro/agent-config';

export default createAgentHandler(agentEntries, agentConfig);
`;

async function writeStub(rootDir: string, relPath: string, content: string): Promise<void> {
  const abs = resolve(rootDir, relPath);
  await mkdir(join(abs, '..'), { recursive: true });
  // Skip identical writes: server/stubs/ sits inside Nitro's watched srcDir,
  // so an unconditional write on every dev:reload re-triggers the watcher and
  // the dev server reload-loops forever.
  try {
    const existing = await readFile(abs, 'utf-8');
    if (existing === content) return;
  } catch {
    // File does not exist yet — fall through to write.
  }
  await writeFile(abs, content, 'utf-8');
}

export default async function agentsPlugin(nitro: Nitro): Promise<void> {
  async function runScan(): Promise<void> {
    const rootDir = nitro.options.rootDir;
    const agents = await scanAgents(rootDir);
    const configFile = await findConfigFile(rootDir);

    nitro.options.virtual['#litro/agent-manifest'] = generateAgentManifest(agents, rootDir, 'virtual');
    await writeStub(rootDir, MANIFEST_STUB_REL, generateAgentManifest(agents, rootDir, 'stub'));

    nitro.options.virtual['#litro/agent-config'] = generateAgentConfig(configFile, rootDir, 'virtual');
    await writeStub(rootDir, CONFIG_STUB_REL, generateAgentConfig(configFile, rootDir, 'stub'));

    await writeStub(rootDir, HANDLER_STUB_REL, HANDLER_STUB_SOURCE);

    if (agents.length > 0) {
      nitro.logger.info(
        `[litro] Registered ${agents.length} agent${agents.length === 1 ? '' : 's'}`,
      );
    }
  }

  await runScan();

  // NOTE: the endpoint routes are NOT registered here. Pushing into
  // nitro.options.handlers at build:before is too late for the dev server
  // (it reads handler config before this hook fires — verified empirically
  // for the actions plugin; same timing trap documented for devHandlers in
  // vite-dev.ts). Consumers declare the routes statically in
  // nitro.config.ts instead:
  //
  //   handlers: [
  //     { route: '/__litro/agent/:agent/:session', method: 'post', handler: resolve('./server/stubs/agent-handler.ts') },
  //     { route: '/__litro/agent/:agent/:session', method: 'get',  handler: resolve('./server/stubs/agent-handler.ts') },
  //   ],
  //
  // This plugin guarantees that stub file exists before rollup compiles it.

  nitro.hooks.hook('dev:reload', async () => {
    await runScan();
  });
}
