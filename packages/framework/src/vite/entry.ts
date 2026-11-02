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
 * group. `scripts/verify-scaffolded-apps.mjs` (HYDRATE-ORDER) checks the
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

/**
 * Returns every module reachable from an entry through STATIC imports only,
 * without the entry modules themselves. Exported for tests.
 */
export function collectEntryStaticDeps(graph: ModuleGraphReader): Set<string> {
  const entries: string[] = [];
  for (const id of graph.getModuleIds()) {
    if (graph.getModuleInfo(id)?.isEntry) entries.push(id);
  }
  const seen = new Set<string>();
  const stack = [...entries];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const dep of graph.getModuleInfo(id)?.importedIds ?? []) {
      if (seen.has(dep)) continue;
      seen.add(dep);
      stack.push(dep);
    }
  }
  for (const entry of entries) seen.delete(entry);
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
