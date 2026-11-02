/**
 * shell-scripts.ts — does the client build hold the page shell's script files?
 *
 * `litroShellScriptsPlugin()` (vite/shell-scripts.ts) emits them during
 * `vite build`, which `litro build` runs before `nitro build`. The pages
 * plugin calls this from `build:before` and writes the result into the
 * generated page manifest as `globalThis[LITRO_SHELL_SCRIPTS_GLOBAL]`.
 * `createPageHandler({ inlineScripts: false })` reads it: without the files,
 * a `<script src>` would name a file that is not served, so the handler keeps
 * the scripts inline and says why (runtime/create-page-handler.ts).
 *
 * Only the files a production page loads count (`PRODUCTION_SHELL_SCRIPTS`).
 */

import { existsSync, readFileSync } from 'node:fs';
import fastGlob from 'fast-glob';
import { join } from 'pathe';
import {
  LITRO_SHELL_SCRIPTS_GLOBAL,
  PRODUCTION_SHELL_SCRIPTS,
  SHELL_SCRIPTS_DIR,
} from '../runtime/shell-scripts.js';
import type { ShellScriptFiles } from '../runtime/shell-scripts.js';

/** File names from `PRODUCTION_SHELL_SCRIPTS` that are not in `<clientDir>/assets/`. */
export function missingShellScriptFiles(clientDir: string): string[] {
  return PRODUCTION_SHELL_SCRIPTS.map(s => s.fileName).filter(
    name => !existsSync(join(clientDir, SHELL_SCRIPTS_DIR, name)),
  );
}

/** Every production file, only some, or none. */
export function shellScriptFilesIn(clientDir: string): ShellScriptFiles {
  const missing = missingShellScriptFiles(clientDir).length;
  if (missing === 0) return 'all';
  return missing === PRODUCTION_SHELL_SCRIPTS.length ? 'none' : 'partial';
}

/** The page manifest statement for what the build found. '' for none. */
export function shellScriptsStatement(clientDir: string): string {
  const found = shellScriptFilesIn(clientDir);
  if (found === 'none') return '';
  return `\nglobalThis[${JSON.stringify(LITRO_SHELL_SCRIPTS_GLOBAL)}] = ${found === 'all'};\n`;
}

/**
 * True when a file in the app's server directory sets `inlineScripts: false`.
 * A text search, used only to decide whether a build with no script files
 * deserves a warning: the option itself is read at request time.
 */
export async function appSetsInlineScriptsFalse(serverDir: string): Promise<boolean> {
  const files = await fastGlob('**/*.{ts,mts,js,mjs}', {
    cwd: serverDir,
    ignore: ['**/node_modules/**'],
    absolute: true,
  }).catch(() => [] as string[]);
  return files.some(f => {
    try {
      return /\binlineScripts\s*:\s*false\b/.test(readFileSync(f, 'utf-8'));
    } catch {
      return false;
    }
  });
}
