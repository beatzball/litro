import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appSetsInlineScriptsFalse,
  missingShellScriptFiles,
  shellScriptFilesIn,
  shellScriptsStatement,
} from '../shell-scripts.js';
import {
  DEV_CONTENT_RELOAD_SCRIPT,
  DSD_POLYFILL,
  LITRO_SHELL_SCRIPTS_GLOBAL,
  SKIP_LINK_SCRIPT,
} from '../../runtime/shell-scripts.js';
import type { ShellScript } from '../../runtime/shell-scripts.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'litro-shell-scripts-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function write(scripts: ShellScript[]) {
  mkdirSync(join(dir, 'assets'), { recursive: true });
  for (const s of scripts) writeFileSync(join(dir, 'assets', s.fileName), s.source);
}

describe('shellScriptsStatement', () => {
  it('marks the files present when both production files are in assets/', () => {
    write([DSD_POLYFILL, SKIP_LINK_SCRIPT]);
    expect(missingShellScriptFiles(dir)).toEqual([]);
    expect(shellScriptFilesIn(dir)).toBe('all');
    expect(shellScriptsStatement(dir)).toContain(`globalThis["${LITRO_SHELL_SCRIPTS_GLOBAL}"] = true;`);
  });

  it('does not need the dev-only reload file', () => {
    write([DSD_POLYFILL, SKIP_LINK_SCRIPT]);
    expect(shellScriptFilesIn(dir)).toBe('all');
  });

  it('reports a partial build as false', () => {
    write([SKIP_LINK_SCRIPT, DEV_CONTENT_RELOAD_SCRIPT]);
    expect(missingShellScriptFiles(dir)).toEqual([DSD_POLYFILL.fileName]);
    expect(shellScriptFilesIn(dir)).toBe('partial');
    expect(shellScriptsStatement(dir)).toContain(`globalThis["${LITRO_SHELL_SCRIPTS_GLOBAL}"] = false;`);
  });

  it('says nothing for an empty client directory', () => {
    expect(shellScriptFilesIn(dir)).toBe('none');
    expect(shellScriptsStatement(dir)).toBe('');
  });
});

describe('appSetsInlineScriptsFalse', () => {
  it('finds the option in a route file', async () => {
    mkdirSync(join(dir, 'routes'), { recursive: true });
    writeFileSync(join(dir, 'routes', '[...].ts'), 'createPageHandler({ route, inlineScripts: false });');
    expect(await appSetsInlineScriptsFalse(dir)).toBe(true);
  });

  it('is false without it, and for a missing directory', async () => {
    writeFileSync(join(dir, 'a.ts'), 'createPageHandler({ route });');
    expect(await appSetsInlineScriptsFalse(dir)).toBe(false);
    expect(await appSetsInlineScriptsFalse(join(dir, 'nope'))).toBe(false);
  });
});
