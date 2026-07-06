import { describe, it, expect } from 'vitest';
import { stampActionIds } from '../server.js';
import { ACTION_ID, actionUrl } from '../client.js';
import { hashActionId } from '../hash.js';
import type { ActionModuleEntry } from '../handler.js';

describe('stampActionIds', () => {
  it('stamps every function export with hashActionId(relPath, exportName)', () => {
    const fn = async () => 'x';
    const other = async () => 'y';
    const entries: ActionModuleEntry[] = [
      { relPath: 'actions/demo.server', module: { fn, other, notAFn: 42 } },
    ];
    stampActionIds(entries);
    expect((fn as unknown as Record<symbol, unknown>)[ACTION_ID]).toBe(
      hashActionId('actions/demo.server', 'fn'),
    );
    expect(actionUrl(other)).toBe(
      `/__litro/action/${hashActionId('actions/demo.server', 'other')}`,
    );
  });

  it('is idempotent and skips already-stamped functions', () => {
    const fn = async () => 'x';
    const entries: ActionModuleEntry[] = [{ relPath: 'a.server', module: { fn } }];
    stampActionIds(entries);
    expect(() => stampActionIds(entries)).not.toThrow();
  });
});
