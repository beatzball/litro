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
import { dirname, join, relative, resolve } from 'pathe';
import { patchCustomElementsIdempotent } from '../plugins/ssg.js';

const DEFAULT_SOURCE_DIR = 'mcp-apps';
const DEFAULT_OUT_DIR = 'dist/mcp-apps';

/**
 * The index every app is listed in. An app packing to this stem would write
 * `manifest.json` as its descriptor and then have it overwritten by the index,
 * leaving its manifest entry pointing `descriptor` at the array itself.
 *
 * The output mirrors the source tree, so only the TOP level collides:
 * `mcp-apps/sub/manifest.ts` is fine.
 */
const MANIFEST_STEM = 'manifest';

/** One packed app, as it lands on disk. */
export interface PackedApp {
  /**
   * Output path stem, relative to the out dir and mirroring the source tree:
   * `weather/card`. Equal to the uri's path, which is what makes two apps
   * unable to claim one output file.
   */
  name: string;
  uri: string;
  htmlPath: string;
  descriptorPath: string;
  bytes: number;
}

/**
 * The path segments an app file contributes, source of BOTH its output path
 * and its `ui://` address.
 *
 * One function on purpose. Both are the segments joined — by `/` for the uri,
 * by `/` for the file — so deriving them separately would let the manifest and
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
 * Characters a path segment may contribute to a `ui://` address.
 *
 * This is RFC 3986's `unreserved` set. Anything outside it either changes
 * meaning (`?` opens a query, `#` opens a fragment) or is rewritten by any
 * parser that touches it (a space becomes `%20`, `é` becomes `%C3%A9`) — and a
 * rewritten address no longer matches the string in the descriptor, so a host
 * caches under a key the manifest does not contain.
 *
 * `%` is excluded deliberately, not by omission. Allowing it would make
 * `big%20card.ts` and `big card.ts` two files with ONE effective address, and
 * neither the output-path check nor the uri check would see it: the raw strings
 * differ, and only a parser makes them equal.
 */
const URI_SAFE_SEGMENT = /^[A-Za-z0-9._~-]+$/;

/**
 * Characters that break the MODULE LOADER, whatever the filesystem thinks.
 *
 * Vite resolves a module by id, and an id is URL-shaped: `#` opens a fragment
 * and `?` a query, so `weather#card.ts` is read as `weather` with a fragment
 * and reported as "Does the file exist?" for a file that plainly does. Control
 * characters break the id in their own ways.
 *
 * U+2028 and U+2029 are ECMAScript line terminators sitting above the C0 range,
 * so they break the module and the C0 check misses them.
 *
 * A BACKSLASH is knowingly ABSENT, and cannot be added here. A POSIX file
 * literally named `a\b.ts` is handed to the loader as `a/b.ts` — a path that
 * does not exist — because `appSegmentsFromFile` folds `\` into `/` for
 * Windows BEFORE these segments exist, so by the time this runs there is no
 * backslash left to see. Catching it means testing the raw relative path, which
 * is only safe if `pathe` never hands us a backslash on Windows. That is
 * believable and untested here, and getting it wrong refuses every file on a
 * platform this repo has no runner for. Left alone deliberately: the failure is
 * loud, and the character is one almost nobody puts in a filename.
 *
 * NOT exemptible by setting `uri`. Every other objection to a filename is about
 * the ADDRESS, and an author who writes their own address has answered it —
 * but no address makes a file loadable.
 */
const LOADER_HOSTILE = /[#?\u0000-\u001f\u2028\u2029]/;

/**
 * Refuses a path that cannot safely name a file, or be loaded as a module.
 *
 * DELIBERATELY NARROW, because everything refused here is refused even for an
 * app that names its own uri. Two things qualify:
 *
 *   - `.` and `..`, which the filesystem resolves, so `../x` would write
 *     OUTSIDE the out dir.
 *   - `#`, `?` and control characters, which the module loader cannot address.
 *
 * A space, an accent, a `[` are none of those: `big card.html` is a perfectly
 * good filename and Vite loads `big card.ts` without complaint. Refusing those
 * here is what made an explicit `uri` unable to rescue a build.
 */
function assertUsableOutputPath(relPath: string, segments: string[]): void {
  if (segments.length === 0) {
    throw new Error(`"${relPath}" has no name to build an output file from.`);
  }
  const dot = segments.find((seg) => seg === '.' || seg === '..');
  if (dot) {
    throw new Error(
      `"${relPath}" contains a "${dot}" segment, which would resolve to a path outside the ` +
        'output directory.',
    );
  }
  const hostile = segments.find((seg) => LOADER_HOSTILE.test(seg));
  if (hostile) {
    const ch = [...hostile].find((c) => LOADER_HOSTILE.test(c)) ?? hostile;
    throw new Error(
      `"${relPath}" contains ${JSON.stringify(ch)}, which the module loader reads as part of a url ` +
        'rather than a name — it would report the file as missing. Rename it. Setting "uri" does not ' +
        'help here: the file has to be loadable before its address matters.',
    );
  }
}

/**
 * Refuses a path that cannot become an unambiguous `ui://` address.
 *
 * Every throw here is RECOVERABLE by the app naming its own `uri` — which is
 * why the CLI carries the reason instead of failing on it. An address is the
 * only thing at stake, so an author who supplies one has already answered the
 * objection. An error that names a remedy the caller has already applied is
 * worse than no error at all.
 */
function assertUsableUriSegments(relPath: string, segments: string[]): void {
  if (segments.length === 0) {
    throw new Error(`"${relPath}" has no name to build a uri from.`);
  }

  const dynamic = segments.find((seg) => seg.includes('[') || seg.includes(']'));
  if (dynamic) {
    throw new Error(
      `"${relPath}" uses a dynamic segment ("${dynamic}"). A ui:// app is a static template a host ` +
        'caches by address, so there is no request to fill one from — use plain folder and file names.',
    );
  }

  // `.` and `..` are syntactically fine but are REMOVED by RFC 3986
  // normalisation, so `a/./b` and `a/b` are one resource to a host and two
  // entries to us.
  const dot = segments.find((seg) => seg === '.' || seg === '..');
  if (dot) {
    throw new Error(
      `"${relPath}" contains a "${dot}" segment. A uri parser removes those, so the address it resolves ` +
        'to would not be the address the build wrote down.',
    );
  }

  const bad = segments.find((seg) => !URI_SAFE_SEGMENT.test(seg));
  if (bad) {
    const offending = [...bad].find((ch) => !URI_SAFE_SEGMENT.test(ch)) ?? bad;
    throw new Error(
      `"${relPath}" cannot become a ui:// address: the segment "${bad}" contains ${JSON.stringify(offending)}, ` +
        'which a uri parser rewrites or reads as syntax. Rename the file using letters, digits, ' +
        '"." "_" "~" or "-", or set "uri" in defineMcpApp() to choose the address yourself.',
    );
  }
}

/**
 * Turns a path relative to the source dir into an output path stem.
 * `weather/card.ts` -> `weather/card`, so `dist/mcp-apps/weather/card.html`.
 *
 * NESTED, MIRRORING THE URI. Through 0.15.0 this flattened to `weather-card`,
 * which let `weather/card.ts` and `weather-card.ts` — two files with two
 * DIFFERENT addresses — claim one output file, so the build had to detect the
 * clash and refuse. Mirroring makes that clash unrepresentable: the output path
 * is the uri path, and two files cannot share one relative path.
 *
 * THIS MOVES PUBLISHED OUTPUT. The recursive glob shipped in 0.15.0, so a
 * project with `mcp-apps/weather/card.ts` already gets `weather-card.html`
 * today and gets `weather/card.html` after this. Anything pinned to the flat
 * path — a static mount, a COPY line, a path in a server config — has to
 * follow. Reading `manifest.json` rather than guessing the path does not.
 */
export function outputPathFromFile(relPath: string): string {
  const segments = appSegmentsFromFile(relPath);
  assertUsableOutputPath(relPath, segments);
  return segments.join('/');
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
 * EVERY THROW HERE IS RECOVERABLE by setting `uri` on the app. The refusals
 * that are not — a dot segment, a character the module loader cannot address
 * — live in `assertUsableOutputPath`, because they survive having an address.
 */
export function uriFromFile(relPath: string, packageName?: string): string {
  const segments = appSegmentsFromFile(relPath);
  assertUsableUriSegments(relPath, segments);

  const authority = packageAuthority(packageName);
  if (!authority) {
    throw new Error(
      `cannot build a uri for "${relPath}": the package name supplies the authority ` +
        `(ui://<package>/${segments.join('/')}), and this project has no usable "name" in its ` +
        'package.json. Add one, or set "uri" in defineMcpApp() to choose the address yourself.',
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
 * Unicode case folding, as close as JS gets. `toLowerCase()` alone misses any
 * character that is already lowercase but folds to something else — U+017F
 * LONG S being the one that reaches a filesystem.
 */
function caseFold(value: string): string {
  return value.toUpperCase().toLowerCase();
}

/** "a and b", "a, b and c" — a list a person reads, not a join. */
function listNames(names: string[]): string {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The form of a uri that two addresses must differ in to be different
 * resources: what RFC 3986 equivalence says the string means, not the string.
 *
 * `new URL()` alone is not enough. It folds a space into `%20` and removes dot
 * segments, but for a NON-SPECIAL scheme like `ui:` it leaves the host's case
 * and a percent-triplet's case exactly as written — so `ui://P/a%2Fb` and
 * `ui://p/a%2fb`, one resource by §6.2.2.1, stay two strings. Both of those
 * remaining normalisations are applied here.
 *
 * Only reachable through a hand-written `uri`: a derived one is lowercase by
 * construction and can hold no `%`.
 */
function canonicalUri(uri: string): string {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    // Not parseable, so nothing can normalise it into another entry either.
    return uri;
  }
  // The host is case-insensitive and a percent-triplet's hex digits are too;
  // RFC 3986 makes uppercase the normal form for the latter. The SCHEME needs
  // no line of its own — the URL constructor has already lowercased it.
  parsed.host = parsed.host.toLowerCase();
  return parsed.href.replace(/%[0-9a-fA-F]{2}/g, (t) => t.toUpperCase());
}

/**
 * Throws when two apps claim the same `ui://` address, or the same output file.
 *
 * A host keys its template cache by URI, so a collision does not merge — one
 * app silently serves the other's markup. Failing the build is the only place
 * this is visible.
 *
 * REPORTS EVERY CLASH, not the first. A project that renames one file only to
 * hit the next clash on the following run learns its shape one build at a time;
 * a list is one read.
 */
export function assertUniqueUris(apps: { name: string; uri: string }[]): void {
  const byUri = new Map<string, string[]>();

  for (const app of apps) {
    const uriKey = canonicalUri(app.uri);
    byUri.set(uriKey, [...(byUri.get(uriKey) ?? []), app.name]);
  }

  const problems: string[] = [];

  for (const [uri, names] of byUri) {
    if (names.length < 2) continue;
    problems.push(
      `  ${listNames(names)} ${names.length > 2 ? 'all ' : ''}resolve to the uri ${uri}. A host ` +
        'caches templates by uri, so one would silently serve the other’s markup. Give each its own ' +
        'address, or its own file path.',
    );
  }

  if (problems.length > 0) {
    throw new Error(
      `${problems.length} address clash${problems.length > 1 ? 'es' : ''}:\n${problems.join('\n')}`,
    );
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

  // Supplies the authority for EVERY derived address, not just a flat file's.
  // A project whose package.json has no usable "name" can still pack, but only
  // if every app names its own uri — which is why a failure to derive is
  // carried rather than thrown, below.
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

  // Every problem that is FATAL WHATEVER THE APP SAYS, gathered before a module
  // is loaded or a byte is written. One list beats learning the shape of the
  // directory one failed build at a time.
  //
  // Not every problem, and the difference matters. A character that only breaks
  // the ADDRESS is not fatal here, because the app may name its own uri — so it
  // is carried, and only reported after the module loads, by which time earlier
  // apps are already on disk. Dot segments, loader-hostile characters, output
  // clashes and the manifest stem are the ones nothing can excuse.
  //
  // A derivation failure is NOT fatal here. An app is allowed to name its own
  // uri, and `defineMcpApp()` has not run yet — so the reason it could not be
  // derived is CARRIED, and only reported if the config turns out to have no
  // uri either. Throwing here is what made an explicit uri unable to rescue a
  // project whose package name is unusable.
  const plans = new Map<string, { file: string; outPath: string; uri?: string; why?: string }>();
  const problems: string[] = [];

  for (const file of files.sort()) {
    const relPath = relative(sourceDir, file);
    const here = relative(cwd, file);

    let outPath: string;
    try {
      outPath = outputPathFromFile(relPath);
    } catch (err) {
      // A path this broken cannot name an OUTPUT FILE either, so unlike a
      // derivation failure there is nothing an explicit uri could rescue.
      problems.push(`  ${here}: ${(err as Error).message}`);
      continue;
    }

    // CASE-FOLDED, not lowercased. On APFS and NTFS `Manifest.json` and
    // `manifest.json` are one file, so a capital letter reproduced the exact
    // clobber this guard exists to stop. `toLowerCase()` is not enough: APFS
    // folds by the full Unicode rules, under which U+017F LONG S folds to `s`
    // — and `manifeſt` is already lowercase, so `toLowerCase()` leaves it be
    // while the filesystem still collides it. JS has no `toCaseFold`;
    // upper-then-lower is the working stand-in.
    if (caseFold(outPath) === MANIFEST_STEM) {
      problems.push(
        `  ${here} packs to "${MANIFEST_STEM}.json", which is the index listing every app — the ` +
          'index would overwrite its descriptor. Rename it, or move it into a folder.',
      );
      continue;
    }

    // Two source extensions reduce to one output path (`a/b.ts` and `a/b.tsx`),
    // and the second write would silently replace the first.
    const clash = plans.get(outPath);
    if (clash) {
      problems.push(
        `  ${relative(cwd, clash.file)} and ${here} both pack to "${outPath}.html". ` +
          'Rename one — the second would overwrite the first.',
      );
      continue;
    }

    let uri: string | undefined;
    let why: string | undefined;
    try {
      uri = uriFromFile(relPath, packageName);
    } catch (err) {
      why = (err as Error).message;
    }

    plans.set(outPath, { file, outPath, uri, why });
  }

  if (problems.length > 0) {
    console.error(
      `litro mcp-app build: ${problems.length} problem${problems.length > 1 ? 's' : ''} in ` +
        `${relative(cwd, sourceDir) || '.'}/\n${problems.join('\n')}`,
    );
    return 1;
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

    for (const plan of plans.values()) {
      const { file, outPath, uri: derivedUri, why } = plan;

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

      // A FALLBACK, not an override: an app that names its own uri keeps it.
      // `derivedUri` is undefined when the path could not produce one, and the
      // packager then reports the app as having no address — at which point
      // `why` is the answer to "why was none derived?", which is the half the
      // packager cannot know.
      let built: { html: string; descriptor: { uri: string } };
      try {
        built = await packager.buildMcpAppDocument(definition, { uri: derivedUri });
      } catch (err) {
        const message = (err as Error).message;
        // The packager's own "no uri anywhere" text tells the reader to pack
        // the file with this command — which is what they just did. When the
        // derivation is the half that failed, say THAT instead: it is the only
        // half the packager could not see.
        if (why && /no "uri" and none was supplied/.test(message)) {
          console.error(
            `litro mcp-app build: ${relative(cwd, file)} declares no "uri", and one could not be ` +
              `derived from its path.\n  ${why}`,
          );
          return 1;
        }
        console.error(`litro mcp-app build: ${relative(cwd, file)}\n  ${message}`);
        return 1;
      }

      const htmlPath = join(outDir, `${outPath}.html`);
      const descriptorPath = join(outDir, `${outPath}.json`);
      // The output mirrors the source tree, so a nested app needs its folder.
      await mkdir(dirname(htmlPath), { recursive: true });
      await writeFile(htmlPath, built.html, 'utf8');
      await writeFile(descriptorPath, `${JSON.stringify(built.descriptor, null, 2)}\n`, 'utf8');

      packed.push({
        name: outPath,
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
  await writeFile(join(outDir, `${MANIFEST_STEM}.json`), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

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
