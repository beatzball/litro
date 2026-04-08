/**
 * adapter/resolve.ts — Adapter resolution
 *
 * Reads the adapter name from config (or environment) and returns the
 * concrete FrameworkAdapter instance. Defaults to 'lit' when no adapter
 * is specified, ensuring backward compatibility with existing projects.
 *
 * Resolution order:
 *   1. Explicit `adapter` argument (passed by CLI or build pipeline)
 *   2. LITRO_ADAPTER environment variable
 *   3. Default: 'lit'
 */

import type { FrameworkAdapter, AdapterName } from './types.js';

/**
 * Resolves and returns the FrameworkAdapter for the given adapter name.
 *
 * Each adapter is loaded lazily via dynamic import so that unused adapters
 * (and their framework dependencies) are never pulled into the module graph.
 *
 * @param name - Adapter name. Defaults to 'lit'.
 * @returns The resolved FrameworkAdapter instance.
 * @throws If the adapter name is not recognised.
 */
export async function resolveAdapter(
  name?: AdapterName | string,
): Promise<FrameworkAdapter> {
  const resolved = name ?? process.env.LITRO_ADAPTER ?? 'lit';

  switch (resolved) {
    case 'lit': {
      const { litAdapter } = await import('./lit/index.js');
      return litAdapter;
    }
    // Future adapters:
    // case 'fast': {
    //   const { fastAdapter } = await import('./fast/index.js');
    //   return fastAdapter;
    // }
    // case 'elena': {
    //   const { elenaAdapter } = await import('./elena/index.js');
    //   return elenaAdapter;
    // }
    default:
      throw new Error(
        `[litro] Unknown adapter "${resolved}". ` +
        `Supported adapters: lit, fast, elena.`,
      );
  }
}
