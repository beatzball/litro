import { describe, it, expect } from 'vitest';
import { litroShellScriptsPlugin } from '../shell-scripts.js';
import { SHELL_SCRIPTS } from '../../runtime/shell-scripts.js';

describe('litroShellScriptsPlugin', () => {
  it('runs in builds only', () => {
    expect(litroShellScriptsPlugin().apply).toBe('build');
  });

  it('emits every shell script under assets/ with its source', () => {
    const emitted: Array<{ type: string; fileName: string; source: string }> = [];
    const plugin = litroShellScriptsPlugin();
    const hook = plugin.generateBundle as (this: unknown) => void;
    hook.call({ emitFile: (f: (typeof emitted)[number]) => emitted.push(f) });
    expect(emitted).toEqual(
      SHELL_SCRIPTS.map(s => ({ type: 'asset', fileName: `assets/${s.fileName}`, source: s.source })),
    );
  });
});

describe('assertShellScriptName', async () => {
  const { assertShellScriptName } = await import('../shell-scripts.js');

  it('accepts every shipped script', () => {
    for (const s of SHELL_SCRIPTS) expect(() => assertShellScriptName(s)).not.toThrow();
  });

  it('fails when a source changed under its old name, and names the new one', () => {
    const [first] = SHELL_SCRIPTS;
    const changed = { ...first, source: first.source + ';' };
    expect(() => assertShellScriptName(changed)).toThrow(/Rename it to litro-dsd-polyfill-[0-9a-f]{8}\.js/);
  });
});
