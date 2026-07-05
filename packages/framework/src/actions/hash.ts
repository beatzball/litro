/**
 * Action ID hashing — the wire contract between the Vite client stub
 * generator and the Nitro server registry.
 *
 * Both sides independently compute:
 *   id = sha256(relPath + '#' + exportName).slice(0, 12)
 *
 * relPath is the module path relative to the project root, posix-normalized,
 * with the source extension stripped (so `.ts` source and `.js` import
 * specifiers hash identically). Changing this function changes every action
 * URL in every deployed app — treat it as frozen once shipped.
 */
import { createHash } from 'node:crypto';
import { relative } from 'pathe';

export function normalizeActionPath(rootDir: string, absPath: string): string {
  const clean = absPath.replace(/[?#].*$/, '');
  return relative(rootDir, clean)
    .replace(/\\/g, '/')
    .replace(/\.(ts|tsx|js|mjs)$/, '');
}

export function hashActionId(relPath: string, exportName: string): string {
  return createHash('sha256')
    .update(`${relPath}#${exportName}`)
    .digest('hex')
    .slice(0, 12);
}
