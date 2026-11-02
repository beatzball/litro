import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { missingShellScriptFiles, shellScriptsStatement } from '../shell-scripts.js';
import { SHELL_SCRIPTS, LITRO_SHELL_SCRIPTS_GLOBAL } from '../../runtime/shell-scripts.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'litro-shell-scripts-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function writeAll(skip?: string) {
  mkdirSync(join(dir, 'assets'), { recursive: true });
  for (const s of SHELL_SCRIPTS) {
    if (s.fileName !== skip) writeFileSync(join(dir, 'assets', s.fileName), s.source);
  }
}

describe('shellScriptsStatement', () => {
  it('marks the files present when every one is in assets/', () => {
    writeAll();
    expect(missingShellScriptFiles(dir)).toEqual([]);
    const statement = shellScriptsStatement(dir);
    expect(statement).toContain(`globalThis["${LITRO_SHELL_SCRIPTS_GLOBAL}"] = true;`);
  });

  it('says nothing when a file is missing', () => {
    writeAll(SHELL_SCRIPTS[0].fileName);
    expect(missingShellScriptFiles(dir)).toEqual([SHELL_SCRIPTS[0].fileName]);
    expect(shellScriptsStatement(dir)).toBe('');
  });

  it('says nothing for an empty client directory', () => {
    expect(shellScriptsStatement(dir)).toBe('');
  });
});
