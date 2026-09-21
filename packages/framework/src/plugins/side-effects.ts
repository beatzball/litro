/**
 * side-effects.ts — keep the project's own modules side-effectful in the
 * Nitro server bundle.
 *
 * The problem this solves
 * ----------------------
 * A page registers the elements it renders with bare side-effect imports:
 *
 *   import '../src/components/litro-card.js';
 *
 * Nitro builds the server bundle with Rollup and sets
 * `treeshake.moduleSideEffects` to a function that answers `false` for every
 * module except Nitro's own runtime and the ids listed in
 * `nitro.options.moduleSideEffects`. A project file therefore counts as
 * side-effect free, so Rollup deletes the import. `customElements.define()`
 * never runs on the server, and `@lit-labs/ssr` prints the bare tag with no
 * shadow root. Nothing warns, and the build exits 0.
 *
 * A value returned from a plugin's `resolveId` wins over the `treeshake`
 * option, so marking the project's own files is enough. Dependencies keep
 * Nitro's behavior: `@rollup/plugin-node-resolve` already honors a package's
 * `"sideEffects"` field the same way (see BUILD-001).
 */

import { normalize } from 'pathe';
import type { Nitro } from 'nitropack';

/** Minimal shape of the Rollup plugin this module contributes. Typed locally
 *  so the framework does not take a direct dependency on Rollup's types. */
interface ResolveResult {
  id: string;
  external?: boolean | string;
  [key: string]: unknown;
}
interface ResolveContext {
  resolve(
    source: string,
    importer: string | undefined,
    options: Record<string, unknown>,
  ): Promise<ResolveResult | null>;
}

/** Trailing-slash form of a directory, in POSIX separators. */
function asDirPrefix(dir: string): string {
  const norm = normalize(dir);
  return norm.endsWith('/') ? norm : `${norm}/`;
}

/**
 * True when `id` is a source file belonging to the app being built.
 *
 * Virtual modules (Rollup marks them with a leading NUL, Vite with a leading
 * `\0` or a `virtual:` prefix) and anything inside a `node_modules/` directory
 * are excluded — a dependency's side effects stay under its own package's
 * control.
 */
export function isProjectModule(id: string, rootDir: string): boolean {
  if (!id) return false;
  if (id.startsWith('\0') || id.startsWith('virtual:')) return false;
  const norm = normalize(id.split('?')[0]!);
  if (!norm.startsWith(asDirPrefix(rootDir))) return false;
  if (norm.includes('/node_modules/')) return false;
  return true;
}

/**
 * A Rollup plugin that answers `moduleSideEffects: true` for the app's own
 * source files and leaves every other id alone.
 */
export function projectSideEffectsPlugin(rootDir: string): Record<string, unknown> {
  return {
    name: 'litro:project-side-effects',
    async resolveId(
      this: ResolveContext,
      source: string,
      importer: string | undefined,
      options: Record<string, unknown>,
    ): Promise<ResolveResult | null> {
      // `this.resolve` skips this plugin by default, so asking the rest of the
      // chain for the real id cannot recurse.
      const resolved = await this.resolve(source, importer, options);
      if (!resolved || resolved.external) return resolved;
      if (!isProjectModule(resolved.id, rootDir)) return resolved;
      return { ...resolved, moduleSideEffects: true };
    },
  };
}

/**
 * Registers the plugin on the Nitro build.
 *
 * Call it from `build:before`. Nitro composes its Rollup config after that
 * hook and fires `rollup:before` with the finished config, which is where the
 * plugin is appended. Registering twice is a no-op, so a dev reload that runs
 * the page scan again does not stack copies.
 */
export default function sideEffectsPlugin(nitro: Nitro): void {
  const flags = nitro as unknown as Record<string, unknown>;
  if (flags.__litroSideEffectsHooked) return;
  flags.__litroSideEffectsHooked = true;

  const rootDir = nitro.options.rootDir;

  nitro.hooks.hook('rollup:before', (_nitro: unknown, rollupConfig: unknown) => {
    const config = rollupConfig as { plugins?: unknown[] } | undefined;
    if (!config) return;
    config.plugins ??= [];
    config.plugins.push(projectSideEffectsPlugin(rootDir));
  });
}
