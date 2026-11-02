/**
 * litroEntryPlugin — keeps the client entry (`app.js`) free of shared code.
 *
 * Why
 * ───
 * The page shell loads the entry as `/_litro/app.js?v=<content hash>` (see
 * `runtime/app-entry.ts`), so a deploy changes the URL and a browser that kept
 * the old entry fetches the new one. A module loaded under a second URL is a
 * second module instance, though. Left to itself, the bundler puts the
 * modules the entry imports statically (lit-html and the hydration support for
 * Lit, the whole runtime for FAST and Elena, and Vite's preload helper) INTO
 * `app.js`, and every other chunk that needs them then imports `../app.js` by
 * its bare name. With a versioned entry URL that is a second copy of the
 * runtime in the page.
 *
 * What it does
 * ────────────
 * It adds one code-splitting group, `boot`, that captures every module the
 * entry imports statically, but not the entry module itself. The entry chunk
 * then holds only its own body and an `import` of the hashed `boot` chunk, and
 * every other chunk imports `boot`, never `app.js`.
 *
 * Why this does not break hydration (BUILD-009)
 * ─────────────────────────────────────────────
 * The group holds exactly the modules that were already in `app.js`, in the
 * same evaluation order, and nothing else. A Lit entry reaches `lit-element`
 * only through its `void import('./app-main.js')`, which is a dynamic import,
 * so `lit-element` is not in the entry's static graph and cannot join the
 * group. That holds for the BOOTSTRAP entry's graph only: in a build with
 * more entries, another entry may import `lit-element` statically, so only
 * the bootstrap's graph is collected, and a build whose bootstrap cannot be
 * identified fails rather than guess (see `findBootstrapEntry`). `scripts/verify-scaffolded-apps.mjs` (HYDRATE-ORDER) checks the
 * emitted bundle.
 *
 * The set is computed in `buildEnd`, after the module graph is complete and
 * before chunking calls the group's `test` function.
 */

import type { Plugin } from 'vite';

/** Name of the chunk that holds the entry's static dependencies. */
export const LITRO_BOOT_CHUNK = 'boot';

interface ModuleGraphReader {
  getModuleIds(): IterableIterator<string>;
  getModuleInfo(id: string): { isEntry: boolean; importedIds: readonly string[] } | null;
}

/** A module id that names the client bootstrap: `app.ts`, `app.js`, ... */
const BOOTSTRAP_ID = /(?:^|[\\/])app\.(?:ts|js|mts|mjs|tsx|jsx)$/;

/**
 * Picks the client bootstrap among the build's entries. One entry is the
 * bootstrap whatever its name. With several, exactly one must be `app.*`.
 * Throws otherwise: guessing would put another entry's dependencies into the
 * boot chunk, and when that entry imports `lit-element` the hydration hook
 * would be read before it is set (BUILD-009). Exported for tests.
 */
export function findBootstrapEntry(entries: readonly string[]): string {
  if (entries.length === 1) return entries[0];
  const apps = entries.filter(id => BOOTSTRAP_ID.test(id));
  if (apps.length === 1) return apps[0];
  throw new Error(
    `[litro] litroEntryPlugin() cannot tell which of these ${entries.length} entries is ` +
      `the client bootstrap: ${entries.join(', ')}. It needs a single entry, or ` +
      `exactly one entry named app.ts (or app.js). Rename the bootstrap, or ` +
      `remove litroEntryPlugin() from this build.`,
  );
}

/**
 * Returns every module reachable from the client bootstrap entry through
 * STATIC imports only, without the entry itself. Other entries are ignored:
 * their dependencies are not the bootstrap's, and putting them in the boot
 * chunk could evaluate `lit-element` before the hydration support. Exported
 * for tests.
 */
export function collectEntryStaticDeps(graph: ModuleGraphReader): Set<string> {
  const entries: string[] = [];
  for (const id of graph.getModuleIds()) {
    if (graph.getModuleInfo(id)?.isEntry) entries.push(id);
  }
  if (entries.length === 0) return new Set();
  const bootstrap = findBootstrapEntry(entries);
  const seen = new Set<string>();
  const stack = [bootstrap];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const dep of graph.getModuleInfo(id)?.importedIds ?? []) {
      if (seen.has(dep)) continue;
      seen.add(dep);
      stack.push(dep);
    }
  }
  seen.delete(bootstrap);
  return seen;
}

/**
 * Adds the `boot` group to the client build's output options. Exported for
 * tests. Leaves the options alone when code splitting is turned off.
 */
export function withBootGroup<T extends { codeSplitting?: unknown }>(
  options: T,
  test: (id: string) => boolean,
): T | null {
  const current = options.codeSplitting;
  if (current === false) return null;
  const base = (current && typeof current === 'object' ? current : {}) as {
    groups?: unknown[];
  };
  return {
    ...options,
    codeSplitting: {
      ...base,
      // Highest priority, so no group the app declares can take one of these
      // modules back into a chunk that imports the entry.
      groups: [
        { name: LITRO_BOOT_CHUNK, test, priority: Number.MAX_SAFE_INTEGER },
        ...(base.groups ?? []),
      ],
    },
  };
}

export function litroEntryPlugin(): Plugin {
  let staticDeps = new Set<string>();

  return {
    name: 'litro:entry',
    apply: 'build',

    buildEnd() {
      staticDeps = collectEntryStaticDeps(this as unknown as ModuleGraphReader);
    },

    outputOptions(options) {
      return withBootGroup(options as { codeSplitting?: unknown }, (id) => staticDeps.has(id)) as
        | typeof options
        | null;
    },
  };
}
