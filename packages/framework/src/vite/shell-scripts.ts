/**
 * litroShellScriptsPlugin — writes the page shell's scripts into the client
 * build as files, so a page can load them with `<script src>` (issue 290).
 *
 * `createPageHandler({ inlineScripts: false })` writes `<script src>` for the
 * DSD polyfill and the skip-link script instead of inline source. Those files
 * have to exist under `/_litro/assets/`, which maps to `dist/client/assets/`.
 * This plugin emits them there, one per entry in `SHELL_SCRIPTS`
 * (runtime/shell-scripts.ts), under the content-hashed name the shell writes.
 *
 * Why `assets/`: `/_litro/assets/**` is already served `immutable` by every
 * recipe's route rules (BUILD-010). Each name carries the hash of its source,
 * so a framework upgrade that changes a script also changes its URL. No route
 * rule had to change.
 *
 * Build only. Under `litro dev` the page handler keeps the scripts inline.
 */

import type { Plugin } from 'vite';
import { SHELL_SCRIPTS, SHELL_SCRIPTS_DIR } from '../runtime/shell-scripts.js';

export function litroShellScriptsPlugin(): Plugin {
  return {
    name: 'litro:shell-scripts',
    apply: 'build',

    generateBundle() {
      for (const script of SHELL_SCRIPTS) {
        this.emitFile({
          type: 'asset',
          fileName: `${SHELL_SCRIPTS_DIR}/${script.fileName}`,
          source: script.source,
        });
      }
    },
  };
}
