/**
 * shell-scripts.ts — does the client build hold the page shell's script files?
 *
 * `litroShellScriptsPlugin()` (vite/shell-scripts.ts) emits them during
 * `vite build`, which `litro build` runs before `nitro build`. The pages
 * plugin calls this from `build:before` and, when every file is there, the
 * generated page manifest sets `globalThis[LITRO_SHELL_SCRIPTS_GLOBAL]`.
 * `createPageHandler({ inlineScripts: false })` reads that flag: without it,
 * a `<script src>` would name a file that is not served, so the handler keeps
 * the scripts inline and says why (runtime/create-page-handler.ts).
 */

import { existsSync } from 'node:fs';
import { join } from 'pathe';
import {
  LITRO_SHELL_SCRIPTS_GLOBAL,
  SHELL_SCRIPTS,
  SHELL_SCRIPTS_DIR,
} from '../runtime/shell-scripts.js';

/** File names from `SHELL_SCRIPTS` that are not in `<clientDir>/assets/`. */
export function missingShellScriptFiles(clientDir: string): string[] {
  return SHELL_SCRIPTS.map(s => s.fileName).filter(
    name => !existsSync(join(clientDir, SHELL_SCRIPTS_DIR, name)),
  );
}

/**
 * The page manifest statement that marks the files present, or '' when any
 * is missing.
 */
export function shellScriptsStatement(clientDir: string): string {
  if (missingShellScriptFiles(clientDir).length > 0) return '';
  return `\nglobalThis[${JSON.stringify(LITRO_SHELL_SCRIPTS_GLOBAL)}] = true;\n`;
}
