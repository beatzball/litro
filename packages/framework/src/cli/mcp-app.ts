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
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
 * The path segments an app file contributes, source of BOTH its output name
 * and its `ui://` address.
 *
 * One function on purpose. The name flattens the segments with `-` and the uri
 * joins them with `/`, so deriving them separately would let the manifest and
 * the address drift apart on the next edit to either.
 */
export function appSegmentsFromFile(relPath: string): string[] {
  return relPath
    .replace(/\.[cm]?tsx?$/, '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean);
}

/**
 * Turns a path relative to the source dir into an output name.
 * `weather/card.ts` -> `weather-card`, so the output directory stays flat and
 * a name can be read straight off a filename.
 */
export function appNameFromFile(relPath: string): string {
  return appSegmentsFromFile(relPath).join('-');
}

/**
 * Turns a path relative to the source dir into a `ui://` address.
 *
 * The PACKAGE NAME is always the authority and the FILE PATH is always the
 * path, so `weather/card.ts` in package `playground` is
 * `ui://playground/weather/card`. One rule with no branch in it: rename the
 * package and every address moves together, which is the point of an authority.
 *
 * WHY THE PACKAGE AND NOT THE FIRST FOLDER. A `ui://` uri needs an authority
 * AND a path. Letting the first folder be the authority reads fine until a file
 * sits flat in `mcp-apps/`: `weather-card.ts` would give host `weather-card`
 * and an EMPTY path, a different shape from every nested file, which a host
 * that groups by authority treats differently. Taking the authority from the
 * package makes the flat file ordinary instead of a special case.
 *
 * `index.ts` IS NOT SPECIAL, unlike in `pages/`. `weather/index.ts` is
 * `ui://<package>/weather/index`; collapsing it would silently merge with a
 * sibling `weather.ts`.
 *
 * NO DYNAMIC SEGMENTS. `[slug]`, `[[opt]]` and `[...all]` mean something in
 * `pages/` and nothing here: a `ui://` resource is a static template the host
 * caches by address, so there is no request to take a parameter from. They are
 * rejected rather than passed through, because a literal `[slug]` in a
 * protocol-visible address is a typo that would otherwise ship.
 */
export function uriFromFile(relPath: string, packageName?: string): string {
  const segments = appSegmentsFromFile(relPath);

  const dynamic = segments.find((seg) => seg.includes('[') || seg.includes(']'));
  if (dynamic) {
    throw new Error(
      `"${relPath}" uses a dynamic segment ("${dynamic}"). A ui:// app is a static template a host ` +
        'caches by address, so there is no request to fill one from — use plain folder and file names.',
    );
  }

  if (segments.length === 0) {
    throw new Error(`"${relPath}" has no name to build a uri from.`);
  }

  const authority = packageAuthority(packageName);
  if (!authority) {
    throw new Error(
      `cannot build a uri for "${relPath}": the package name supplies the authority ` +
        `(ui://<package>/${segments.join('/')}), and this project has no usable "name" in its ` +
        'package.json. Add one, or set "uri" in defineMcpApp().',
    );
  }

  return `ui://${authority}/${segments.join('/')}`;
}

/**
 * The uri authority a package name contributes: `@beatzball/playground` ->
 * `playground`. Returns undefined when nothing valid survives, so the caller
 * can say what to do instead rather than emitting a broken address.
 */
export function packageAuthority(packageName?: string): string | undefined {
  if (!packageName) return undefined;
  const bare = packageName.replace(/^@[^/]+\//, '');
  // A uri authority is not a free-form string. Anything outside this set would
  // either be percent-encoded by a parser or rejected outright.
  return /^[a-z0-9][a-z0-9._-]*$/.test(bare) ? bare : undefined;
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

  // Fills the first uri segment for a file that sits flat in the app directory.
  // Read once, and read leniently: a project without a package.json still packs
  // fine as long as every app is in a folder or names its own uri.
  const packageName = await readPackageName(cwd);

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
    buildMcpAppDocument(
      app: unknown,
      options?: { uri?: string },
    ): Promise<{ html: string; descriptor: { uri: string } }>;
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
      const relPath = relative(sourceDir, file);
      const name = appNameFromFile(relPath);

      // A FALLBACK, not an override: an app that names its own uri keeps it.
      // Derived even so, because the failure it reports (a dynamic segment, a
      // flat file with no package name) is about the file, not about the config.
      let derivedUri: string;
      try {
        derivedUri = uriFromFile(relPath, packageName);
      } catch (err) {
        console.error(`litro mcp-app build: ${(err as Error).message}`);
        return 1;
      }

      // Loading a component registers its custom element, and two apps may pull
      // in the same one. Lit's SSR shim throws on a duplicate define(); this
      // makes it a no-op, exactly as SSG prerendering does.
      patchCustomElementsIdempotent();

      // Loading is where an app's own defineMcpApp() runs, so a throw here is
      // the author's error and reads far better with the file named. Left
      // unwrapped, it escaped the command as a raw Vite stack.
      let mod: McpAppModule;
      try {
        mod = (await vite.ssrLoadModule(file)) as McpAppModule;
      } catch (err) {
        // The packager is resolved from the PROJECT's dependencies, so it can
        // be older than this CLI. An older one ignores the derived uri and
        // rejects the app at define time — a message that sends the reader to
        // fix a "uri" the file is not supposed to need.
        let message = (err as Error).message;
        if (/defineMcpApp: "uri"/.test(message) && /undefined/.test(message)) {
          message +=
            '\n  This CLI derives a uri from the file path, but the installed @beatzball/litro-agent ' +
            'is older than that. Upgrade it, or set "uri" in defineMcpApp().';
        }
        console.error(`litro mcp-app build: ${relative(cwd, file)}\n  ${message}`);
        return 1;
      }

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
        built = await packager.buildMcpAppDocument(definition, { uri: derivedUri });
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

/** The project's package name, or undefined when there is nothing readable. */
async function readPackageName(cwd: string): Promise<string | undefined> {
  try {
    const raw = await readFile(join(cwd, 'package.json'), 'utf8');
    const name = (JSON.parse(raw) as { name?: unknown }).name;
    return typeof name === 'string' ? name : undefined;
  } catch {
    return undefined;
  }
}

function flagValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  if (i !== -1 && args[i + 1]) return args[i + 1];
  const inline = args.find((a) => a.startsWith(`${flag}=`));
  return inline ? inline.slice(flag.length + 1) : undefined;
}
