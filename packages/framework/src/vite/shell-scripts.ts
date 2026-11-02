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
 * The plugin checks each name against its source and fails the build when
 * they disagree. The runtime cannot (the shell must not need `node:crypto`
 * on an edge runtime), and a stale name behind an immutable URL keeps old
 * code in browsers for a year. This runs in every build of every app,
 * including one that installs the published package.
 *
 * Build only. Under `litro dev` the page handler keeps the scripts inline.
 */

import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';
import { SHELL_SCRIPTS, SHELL_SCRIPTS_DIR } from '../runtime/shell-scripts.js';
import type { ShellScript } from '../runtime/shell-scripts.js';

/**
 * Throws when a script's file name does not end in the first 8 hex of the
 * SHA-256 of its source. Exported for tests.
 */
export function assertShellScriptName(script: ShellScript): void {
  const hash = createHash('sha256').update(script.source).digest('hex').slice(0, 8);
  const match = script.fileName.match(/^(litro-[a-z-]+)-([0-9a-f]{8})\.js$/);
  if (match?.[2] === hash) return;
  const expected = `${match?.[1] ?? 'litro-<name>'}-${hash}.js`;
  throw new Error(
    `[litro] The source of shell script ${script.fileName} changed, but its file name did not. ` +
      `The file is served immutable, so browsers would keep the old code. Rename it to ` +
      `${expected} in packages/framework/src/runtime/shell-scripts.ts.`,
  );
}

export function litroShellScriptsPlugin(): Plugin {
  return {
    name: 'litro:shell-scripts',
    apply: 'build',

    generateBundle() {
      for (const script of SHELL_SCRIPTS) {
        assertShellScriptName(script);
        // Always `assets/`, whatever `build.assetsDir` says, on purpose: the
        // page shell writes `/_litro/assets/<fileName>`, and every recipe's
        // immutable rule names `/_litro/assets/**`. An explicit `fileName`
        // is not touched by `assetFileNames` either.
        this.emitFile({
          type: 'asset',
          fileName: `${SHELL_SCRIPTS_DIR}/${script.fileName}`,
          source: script.source,
        });
      }
    },
  };
}
