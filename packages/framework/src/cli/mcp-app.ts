/**
 * `litro mcp-app build` — packs every `mcp-apps/*.ts` in a project into a
 * self-contained MCP Apps `ui://` document plus its resource descriptor.
 *
 * The output is deliberately plain files, not a server. Any MCP server can
 * serve them; nothing here assumes the serving side is a Litro one.
 *
 * WHY THE PACKAGER IS IMPORTED AT RUNTIME
 *
 * `buildMcpAppDocument` lives in `@beatzball/litro-agent`, which depends on
 * this package — so importing it statically would be a cycle. It is also
 * optional: a project with no agent layer still has a working CLI. So it is
 * resolved from the PROJECT's own dependencies when the command runs, and a
 * project without it gets an instruction rather than a resolver stack trace.
 */
import { createServer } from 'vite';
import fastGlob from 'fast-glob';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'pathe';
import { patchCustomElementsIdempotent } from '../plugins/ssg.js';

const DEFAULT_SOURCE_DIR = 'mcp-apps';
const DEFAULT_OUT_DIR = 'dist/mcp-apps';

/** One packed app, as it lands on disk. */
export interface PackedApp {
  /** Filename stem, `/` flattened to `-`. Names the output files. */
  name: string;
  uri: string;
  htmlPath: string;
  descriptorPath: string;
  bytes: number;
}

/**
 * Turns a path relative to the source dir into an output name.
 * `weather/card.ts` -> `weather-card`, so the output directory stays flat and
 * a name can be read straight off a filename.
 */
export function appNameFromFile(relPath: string): string {
  return relPath
    .replace(/\.[cm]?tsx?$/, '')
    .replace(/\\/g, '/')
    .replace(/\//g, '-');
}

/**
 * Throws when two apps claim the same `ui://` address.
 *
 * A host keys its template cache by URI, so a collision does not merge — one
 * app silently serves the other's markup. Failing the build is the only place
 * this is visible.
 */
export function assertUniqueUris(apps: { name: string; uri: string }[]): void {
  const seen = new Map<string, string>();
  for (const app of apps) {
    const first = seen.get(app.uri);
    if (first) {
      throw new Error(
        `Two MCP apps declare the same uri "${app.uri}": ${first} and ${app.name}. ` +
          'A host caches templates by uri, so one would silently serve the other’s markup.',
      );
    }
    seen.set(app.uri, app.name);
  }
}

interface McpAppModule {
  default?: unknown;
}

/** Runs `litro mcp-app <subcommand>`. Returns the process exit code. */
export async function mcpAppCommand(args: string[], cwd: string): Promise<number> {
  const sub = args[0];
  if (sub !== 'build') {
    console.error('usage: litro mcp-app build [--dir <src>] [--out <dir>]');
    return 2;
  }

  const dirFlag = flagValue(args, '--dir') ?? DEFAULT_SOURCE_DIR;
  const outFlag = flagValue(args, '--out') ?? DEFAULT_OUT_DIR;
  const sourceDir = resolve(cwd, dirFlag);
  const outDir = resolve(cwd, outFlag);

  const files = await fastGlob('**/*.{ts,tsx,mts}', {
    cwd: sourceDir,
    absolute: true,
    onlyFiles: true,
    followSymbolicLinks: true,
    ignore: ['**/*.d.ts', '**/*.test.ts', '**/*.spec.ts', '**/-*.ts'],
  });

  if (files.length === 0) {
    console.error(`litro mcp-app build: no app files found in ${relative(cwd, sourceDir) || '.'}/`);
    return 1;
  }

  // Two source paths can flatten to one output name (`weather/card.ts` and
  // `weather-card.ts` both become `weather-card`), and the second write would
  // silently replace the first. Caught before anything reaches disk — the
  // uri check below cannot see it, since only one of the two survives to be
  // compared.
  const byName = new Map<string, string>();
  for (const file of files) {
    const name = appNameFromFile(relative(sourceDir, file));
    const first = byName.get(name);
    if (first) {
      console.error(
        `litro mcp-app build: ${relative(cwd, first)} and ${relative(cwd, file)} both pack to ` +
          `"${name}.html". Rename one — the second would overwrite the first.`,
      );
      return 1;
    }
    byName.set(name, file);
  }

  const packed: PackedApp[] = [];
  await mkdir(outDir, { recursive: true });

  // App modules are project SOURCE, so the project's own Vite config is what
  // knows how to compile them. jiti is the lighter option and is what the SSG
  // plugin uses, but its transform mis-orders the decorator and class-property
  // passes: a Lit component with `@property` on a field fails to load with
  // "Decorating class property failed", which is most of the components anyone
  // would want to pack. Vite reads the project's tsconfig and gets it right.
  const vite = await createServer({
    root: cwd,
    appType: 'custom',
    server: { middlewareMode: true },
    logLevel: 'warn',
  });

  // Loaded through the SAME resolver the app modules use, so this is the same
  // module instance they called defineMcpApp() from — and the Lit it renders
  // with is the copy their templates were built by. Two copies of either would
  // fail in ways that are tedious to read.
  let packager: {
    buildMcpAppDocument(app: unknown): Promise<{ html: string; descriptor: { uri: string } }>;
  };

  try {
    try {
      packager = (await vite.ssrLoadModule('@beatzball/litro-agent/mcp-app')) as typeof packager;
    } catch (err) {
      // Only a resolution failure means "not installed". Anything else — a
      // syntax error, a bad export map, a throwing import — was being reported
      // as a missing package, which sends the reader to reinstall something
      // they already have.
      const message = (err as Error)?.message ?? String(err);
      if (/Failed to resolve|Cannot find (module|package)|ERR_MODULE_NOT_FOUND/i.test(message)) {
        console.error(
          'litro mcp-app build: @beatzball/litro-agent is not installed in this project.\n' +
            '  pnpm add @beatzball/litro-agent',
        );
      } else {
        console.error(`litro mcp-app build: could not load @beatzball/litro-agent/mcp-app\n  ${message}`);
      }
      return 1;
    }

    for (const file of files.sort()) {
      const name = appNameFromFile(relative(sourceDir, file));

      // Loading a component registers its custom element, and two apps may pull
      // in the same one. Lit's SSR shim throws on a duplicate define(); this
      // makes it a no-op, exactly as SSG prerendering does.
      patchCustomElementsIdempotent();

      const mod = (await vite.ssrLoadModule(file)) as McpAppModule;
      const definition = mod.default;

      if (!definition || typeof definition !== 'object') {
        console.error(
          `litro mcp-app build: ${relative(cwd, file)} has no default export. ` +
            'Export the result of defineMcpApp() as the default.',
        );
        return 1;
      }

      let built: { html: string; descriptor: { uri: string } };
      try {
        built = await packager.buildMcpAppDocument(definition);
      } catch (err) {
        console.error(`litro mcp-app build: ${relative(cwd, file)}\n  ${(err as Error).message}`);
        return 1;
      }

      const htmlPath = join(outDir, `${name}.html`);
      const descriptorPath = join(outDir, `${name}.json`);
      await writeFile(htmlPath, built.html, 'utf8');
      await writeFile(descriptorPath, `${JSON.stringify(built.descriptor, null, 2)}\n`, 'utf8');

      packed.push({
        name,
        uri: built.descriptor.uri,
        htmlPath,
        descriptorPath,
        bytes: Buffer.byteLength(built.html, 'utf8'),
      });
    }
  } finally {
    await vite.close();
  }

  try {
    assertUniqueUris(packed);
  } catch (err) {
    console.error(`litro mcp-app build: ${(err as Error).message}`);
    return 1;
  }

  const manifest = packed.map((a) => ({
    name: a.name,
    uri: a.uri,
    html: relative(outDir, a.htmlPath),
    descriptor: relative(outDir, a.descriptorPath),
  }));
  await writeFile(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  for (const app of packed) {
    console.log(`  ${app.uri}  ${relative(cwd, app.htmlPath)}  ${app.bytes} bytes`);
  }
  console.log(`litro mcp-app build: ${packed.length} app(s) -> ${relative(cwd, outDir)}/`);
  return 0;
}

function flagValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  if (i !== -1 && args[i + 1]) return args[i + 1];
  const inline = args.find((a) => a.startsWith(`${flag}=`));
  return inline ? inline.slice(flag.length + 1) : undefined;
}
