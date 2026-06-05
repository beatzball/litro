/**
 * Nitro build-time plugin: page scanner and route generator
 *
 * This is a Nitro BUILD-TIME plugin (registered in nitro.config.ts under `plugins`).
 * It runs during `nitro:build:before` (and on dev reload) to:
 *
 *   1. Scan `pages/**\/*.{ts,tsx}` relative to the project root
 *   2. Convert each file path to a LitroRoute (via path-to-route utilities)
 *   3. Generate the `#litro/page-manifest` virtual module — consumed at runtime
 *      by the catch-all Nitro handler (server/routes/[...].ts)
 *   4. Write `routes.generated.ts` — consumed at build time by the
 *      Litro client bootstrap (app.ts → LitroRouter)
 *   5. Push all non-dynamic routes into `nitro.options.prerender.routes` for
 *      static site generation support
 *
 * Virtual module strategy (from R-4 research):
 *   nitro.options.virtual['#litro/page-manifest'] is set to the generated
 *   module source string. Nitro handles the rest — the key is available as an
 *   importable module ID from any server-side file.
 *
 * Important: DO NOT register individual Nitro handlers per page.
 * The single catch-all handler in server/routes/[...].ts is the correct
 * pattern — it reads the manifest and dispatches to the right component.
 */

import type { Nitro } from 'nitropack';
import fastGlob from 'fast-glob';
import { resolve, join, relative } from 'pathe';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileToRoute, compareRoutes } from './path-to-route.js';
import { resolveAdapter } from '../adapter/resolve.js';
import type { LitroRoute } from '../types/route.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Scans `pages/` under the given root directory and returns all page files
 * as absolute paths, sorted lexicographically.
 */
async function scanPageFiles(rootDir: string): Promise<string[]> {
  const pagesDir = resolve(rootDir, 'pages');

  const files = await fastGlob('**/*.{ts,tsx}', {
    cwd: pagesDir,
    absolute: true,
    followSymbolicLinks: true,
    onlyFiles: true,
    ignore: [
      '**/*.d.ts',     // TypeScript declaration files — never page routes
      '**/*.test.ts',  // Test files
      '**/*.spec.ts',  // Spec files
      '**/-*.ts',      // Dash-prefixed files are disabled routes
      '**/-*.tsx',
    ],
  });

  return files.sort();
}

/** Absolute path of the on-disk stub file. Relative import specifiers in the
 *  physical stub are computed relative to this location. */
const STUB_REL_PATH = join('server', 'stubs', 'page-manifest.ts');

/** Convert an absolute page path to a POSIX-style relative import specifier with
 *  a .js extension, computed from the directory that will contain the generated
 *  manifest file on disk. Relative specifiers with .js extensions are the ESM
 *  convention with bundler moduleResolution — they resolve to the .ts source
 *  at build time and typecheck without `allowImportingTsExtensions`. */
function toRelativeImportSpecifier(fromFile: string, toFile: string): string {
  const rel = relative(join(fromFile, '..'), toFile).replace(/\.tsx?$/, '.js');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

/**
 * Generate the page-manifest source.
 *
 * Two variants are produced from the same data because the module is consumed
 * from two places with different path-resolution rules:
 *
 *   - `'virtual'` → string fed to Rollup via `nitro.options.virtual`.
 *     The virtual id has no real directory, so relative imports cannot be
 *     resolved. Absolute filesystem paths are used; Rollup + esbuild accept
 *     them directly. This source is never typechecked by the consumer.
 *
 *   - `'stub'` → string written to `<rootDir>/server/stubs/page-manifest.ts`.
 *     This file IS picked up by the consumer's `tsc --noEmit`, so it uses
 *     relative `.js` specifiers (no absolute paths, no `.ts` extensions) and
 *     leads with `// @ts-nocheck` so any remaining generator artefacts don't
 *     break strict typechecking.
 */
function generateManifestModule(
  routes: LitroRoute[],
  pageFiles: string[],
  rootDir: string,
  variant: 'virtual' | 'stub',
  preamble?: string,
  postamble?: string,
): string {
  const routesJson = JSON.stringify(routes, null, 2);

  const importSpecifier = (f: string): string => {
    if (variant === 'virtual') return f; // absolute path; resolvable by Rollup
    const stubPath = join(rootDir, STUB_REL_PATH);
    return toRelativeImportSpecifier(stubPath, f);
  };

  const imports = pageFiles
    .map((f, i) => `import * as _page${i} from ${JSON.stringify(importSpecifier(f))};`)
    .join('\n');

  // Registry keys are `route.filePath` (absolute) in both variants — the
  // catch-all handler looks up `pageModules[route.filePath]`, so the key
  // format is an internal framework contract shared across both sources.
  const registryEntries = pageFiles
    .map((f, i) => `  ${JSON.stringify(f)}: _page${i}`)
    .join(',\n');

  // NOTE: Both variants must be valid JavaScript (no TypeScript syntax) — the
  // virtual variant is fed directly to Rollup, and the stub lives in the
  // consumer's project where TS syntax would be surprising in generated code.
  // Adapter preamble: some frameworks (e.g. FAST, Elena) need initialisation
  // imports to run before any component code is evaluated.
  const preambleBlock = preamble ? `${preamble}\n` : '';

  // `@ts-nocheck` only matters for the stub variant, but including it in both
  // keeps the two outputs byte-identical apart from the import specifiers.
  // That makes diffing the two variants during debugging trivial.
  // The stub variant gets a TS cast on `pageModules` so the catch-all handler's
  // `pageModules[route.filePath]` lookup typechecks (TS7053 otherwise — a
  // literal-key object has no string index signature). The virtual variant
  // stays as plain JS because it's fed directly to Rollup via
  // `nitro.options.virtual` and may not run through a TS transform.
  const pageModulesExport =
    variant === 'stub'
      ? `const _pageModules = {\n${registryEntries}\n};\nexport const pageModules: Record<string, Record<string, unknown>> = _pageModules;`
      : `export const pageModules = {\n${registryEntries}\n};`;

  return `// @ts-nocheck
// @generated by litro page scanner — do not edit
// This is the #litro/page-manifest virtual module.
// It is re-generated on every build and dev-reload.
${preambleBlock}${imports}

export const routes = ${routesJson};

// Module registry — maps filePath strings to bundled module objects.
// Allows the catch-all handler to access pageData without a .ts runtime import.
${pageModulesExport}

// Default export for backward compatibility with: import pages from '#litro/page-manifest'
export default routes;
${postamble ? `\n${postamble}` : ''}`;
}

/**
 * Generates the `routes.generated.ts` file consumed by the Litro client bootstrap.
 *
 * Each route entry uses an async `action()` callback to dynamically import
 * the page module, and sets `component` to the custom element tag name.
 *
 * Route shape (litro/runtime):
 *   { path: string, action?: () => Promise<void>, component?: string }
 */
function generateClientRoutes(routes: LitroRoute[], rootDir: string): string {
  // routes.generated.ts lives at <rootDir>/routes.generated.ts, so import
  // specifiers for pages are relative-to-file — i.e. `./pages/foo.js`. This
  // passes tsc --noEmit under strict + bundler moduleResolution, while still
  // resolving to the .ts source via Vite's bundler resolution at dev/build time.
  const clientFilePath = join(rootDir, 'routes.generated.ts');
  const routeLines = routes
    .map(route => {
      const importPath = toRelativeImportSpecifier(clientFilePath, route.filePath);

      return [
        `  {`,
        `    path: ${JSON.stringify(route.path)},`,
        `    action: async () => { await import(${JSON.stringify(importPath)}); },`,
        `    component: ${JSON.stringify(route.componentTag)},`,
        `  },`,
      ].join('\n');
    })
    .join('\n');

  return `// @ts-nocheck
// @generated by litro page scanner — do not edit
// This file is consumed by the Litro client bootstrap (app.ts).
// Re-generated on every build.

import type { Route } from '@beatzball/litro/runtime';

export const routes: Route[] = [
${routeLines}
];
`;
}

/**
 * Writes the client routes file to <rootDir>/routes.generated.ts.
 *
 * The file lives at the project root (not in dist/) so it:
 *   1. Is not deleted by Vite's `emptyOutDir` during production builds
 *   2. Can be imported by app.ts as a source file (Vite transforms it)
 *   3. Is freshly regenerated before every `vite build` via the CLI pre-scan step
 */
async function writeClientRoutes(rootDir: string, content: string): Promise<void> {
  const outPath = join(rootDir, 'routes.generated.ts');
  await writeFile(outPath, content, 'utf-8');
}

/**
 * Standalone scanner: scans pages/, generates the client routes file.
 *
 * Exported so the CLI can call it before `vite build` to ensure fresh routes
 * are baked into the client bundle. Also called by the Nitro `build:before`
 * hook (via pagesPlugin) for the server-side manifest.
 */
export async function scanAndWriteClientRoutes(rootDir: string): Promise<void> {
  const pagesDir = resolve(rootDir, 'pages');
  let pageFiles: string[];
  try {
    pageFiles = await scanPageFiles(rootDir);
  } catch {
    return; // pages/ doesn't exist yet — silently skip
  }
  if (pageFiles.length === 0) return;

  const routes = pageFiles
    .map(file => fileToRoute(file, pagesDir))
    .sort(compareRoutes);

  const content = generateClientRoutes(routes, rootDir);
  await writeClientRoutes(rootDir, content);
}

/**
 * Writes the server-side page manifest to the physical stub file.
 *
 * This overrides the fallback stub so that @rollup/plugin-node-resolve (which
 * intercepts '#' imports via package.json "imports" before Nitro's virtual
 * module plugin runs) resolves the real generated routes instead of the empty
 * stub.
 *
 * The stub file path is `server/stubs/page-manifest.ts` relative to rootDir —
 * the same path that playground/package.json "imports" points to.
 */
async function writeServerManifest(rootDir: string, content: string): Promise<void> {
  const stubDir = resolve(rootDir, 'server', 'stubs');
  await mkdir(stubDir, { recursive: true });
  const stubPath = join(stubDir, 'page-manifest.ts');
  await writeFile(stubPath, content, 'utf-8');
}

// ---------------------------------------------------------------------------
// Main plugin export
// ---------------------------------------------------------------------------

/**
 * The Litro page scanner plugin.
 *
 * Registered as a Nitro build-time plugin via `plugins` in nitro.config.ts:
 *
 *   import pagesPlugin from './plugins/pages';
 *   // or from '@beatzball/litro/plugins' once the package is built
 *
 *   export default defineNitroConfig({
 *     plugins: ['./plugins/vite-dev.ts', pagesPlugin],
 *   });
 */
/**
 * The Litro page scanner plugin.
 *
 * Called directly from nitro.config.ts hooks['build:before'] so the scan
 * runs before rollup starts. This function:
 *   1. Runs the page scan immediately
 *   2. Registers a dev:reload hook for subsequent hot-reloads
 *
 * Note on Nitro 2.x hook names:
 *   Nitro 2.10 uses 'build:before' (not 'nitro:build:before') and 'dev:reload'
 *   (not 'nitro:dev:reload'). The hooks field in nitro.config.ts is registered
 *   before build:before fires, so plugins must be called directly from
 *   hooks['build:before'] rather than registering nested hooks.
 */
export default async function pagesPlugin(nitro: Nitro): Promise<void> {
  // ---------------------------------------------------------------------------
  // Core scan function — called both at build time and on dev reload
  // ---------------------------------------------------------------------------
  async function runScan(): Promise<void> {
    const rootDir = nitro.options.rootDir;
    const pagesDir = resolve(rootDir, 'pages');

    // 1. Scan page files
    let pageFiles: string[];
    try {
      pageFiles = await scanPageFiles(rootDir);
    } catch {
      // pages/ directory may not exist yet in a brand-new project — that's fine
      nitro.logger.info('[litro] No pages/ directory found; skipping page scan.');
      return;
    }

    // Resolve the adapter to get the manifest preamble/postamble (if any).
    // Some frameworks (e.g. FAST) need SSR init imports before component code.
    // Elena uses the preamble to install the customElements shim; it does not
    // currently need a postamble because component classes are captured into
    // the shim registry as a side effect of `.define()` during page module
    // evaluation.
    const adapter = await resolveAdapter();
    const preamble = adapter.manifestPreamble?.() ?? '';

    if (pageFiles.length === 0) {
      nitro.logger.info('[litro] No page files found in pages/.');
      nitro.options.virtual['#litro/page-manifest'] = generateManifestModule(
        [], [], rootDir, 'virtual', preamble,
      );
      await writeServerManifest(
        rootDir,
        generateManifestModule([], [], rootDir, 'stub', preamble),
      );
      return;
    }

    // 2. Convert file paths to route definitions.
    // pagesDir is passed to fileToRoute() so it can strip the prefix when
    // computing relative route paths and component tag names.
    const routes = pageFiles
      .map(file => fileToRoute(file, pagesDir))
      .sort(compareRoutes);

    nitro.logger.info(
      `[litro] Scanned ${routes.length} page${routes.length === 1 ? '' : 's'}: ${routes
        .map(r => r.path)
        .join(', ')}`
    );

    // pageFiles is passed alongside routes so generateManifestModule can emit
    // static imports. The order matches so pageFiles[i] → routes[i].filePath
    // (both are sorted).
    const pageModuleVars = pageFiles.map((_, i) => `_page${i}`);
    const postamble = adapter.manifestPostamble?.(pageModuleVars) ?? '';
    // 3a. Set the virtual module — used by Rollup in production Nitro builds
    //     (no real directory, so absolute-path imports are required).
    nitro.options.virtual['#litro/page-manifest'] = generateManifestModule(
      routes, pageFiles, rootDir, 'virtual', preamble, postamble,
    );

    // 3b. Write the physical stub file — used by @rollup/plugin-node-resolve
    //     via playground package.json "imports" and picked up by the consumer's
    //     `tsc --noEmit`. Uses relative .js specifiers so it typechecks cleanly
    //     under strict + bundler moduleResolution.
    await writeServerManifest(
      rootDir,
      generateManifestModule(routes, pageFiles, rootDir, 'stub', preamble, postamble),
    );

    // 4. Write routes.generated.ts for the Litro client bootstrap
    try {
      const clientContent = generateClientRoutes(routes, rootDir);
      await writeClientRoutes(rootDir, clientContent);
      nitro.logger.info('[litro] Wrote routes.generated.ts');
    } catch (err) {
      // Non-fatal: the client routes file is a build artifact consumed by Vite.
      // If Vite hasn't run yet there's no dist/client/ — that's okay in dev.
      nitro.logger.warn(
        `[litro] Could not write dist/client/routes.generated.ts: ${(err as Error).message}`
      );
    }

    // 5. Add all static (non-dynamic, non-catch-all) routes to prerender.routes.
    //    Dynamic routes require explicit listing via the page's generateRoutes()
    //    export — that is handled by the SSG plugin.
    const staticRoutes = routes
      .filter(r => !r.isDynamic && !r.isCatchAll)
      .map(r => r.path);

    if (staticRoutes.length > 0) {
      const existing = nitro.options.prerender?.routes ?? [];
      // Deduplicate — other plugins (or config) may have already added some routes
      const merged = Array.from(new Set([...existing, ...staticRoutes]));
      if (!nitro.options.prerender) {
        (nitro.options as any).prerender = {};
      }
      nitro.options.prerender.routes = merged;
    }
  }

  // Run the scan immediately — this function is called from build:before, so
  // the manifest will be ready before rollup processes the server routes.
  await runScan();

  // Re-scan on dev file changes (Nitro 2.x hook name: 'dev:reload').
  nitro.hooks.hook('dev:reload', async () => {
    nitro.logger.info('[litro] Dev reload — rescanning pages...');
    await runScan();
  });
}
