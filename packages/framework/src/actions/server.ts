/**
 * @beatzball/litro/actions/server — SERVER-ONLY action utilities.
 * Touches node:crypto (Task 7 adds cookie/CSRF helpers here). Page modules
 * may import it (the fetcher runs server-side); the Vite actions plugin
 * replaces this module with throwing stubs in client builds.
 */
import { hashActionId } from './hash.js';
import { ACTION_ID } from './client.js';
import type { ActionModuleEntry } from './handler.js';

/** Called at Nitro boot by the generated server/plugins/litro-actions.ts:
 *  stamps every scanned function export with its wire id so actionUrl()
 *  resolves during SSR. Mirrors the handler registry's enumeration exactly. */
export function stampActionIds(entries: ActionModuleEntry[]): void {
  for (const { relPath, module } of entries) {
    for (const exportName of Object.keys(module)) {
      const value = module[exportName];
      if (typeof value !== 'function') continue;
      if ((value as unknown as Record<symbol, unknown>)[ACTION_ID] !== undefined) continue;
      Object.defineProperty(value, ACTION_ID, {
        value: hashActionId(relPath, exportName),
        enumerable: false,
      });
    }
  }
}
