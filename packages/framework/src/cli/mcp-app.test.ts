import { describe, it, expect, vi, afterEach } from 'vitest';
import { appNameFromFile, assertUniqueUris, mcpAppCommand } from './mcp-app.js';

describe('appNameFromFile', () => {
  it.each([
    ['weather-card.ts', 'weather-card'],
    ['weather/card.ts', 'weather-card'],
    ['a/b/c.tsx', 'a-b-c'],
    ['card.mts', 'card'],
    ['weather\\card.ts', 'weather-card'],
  ])('%s -> %s', (input, expected) => {
    expect(appNameFromFile(input)).toBe(expected);
  });

  it('keeps a dot inside the stem, which is not the extension', () => {
    expect(appNameFromFile('weather.v2.ts')).toBe('weather.v2');
  });
});

describe('assertUniqueUris', () => {
  it('passes when every app has its own address', () => {
    expect(() =>
      assertUniqueUris([
        { name: 'a', uri: 'ui://x/a' },
        { name: 'b', uri: 'ui://x/b' },
      ]),
    ).not.toThrow();
  });

  it('refuses a duplicate uri, naming both apps', () => {
    // A host caches templates by uri, so a collision does not merge or warn —
    // one app quietly serves the other's markup. The build is the only place
    // this can be seen.
    expect(() =>
      assertUniqueUris([
        { name: 'weather-card', uri: 'ui://x/a' },
        { name: 'weather-refresh', uri: 'ui://x/a' },
      ]),
    ).toThrow(/weather-card and weather-refresh/);
  });
});

describe('mcpAppCommand', () => {
  afterEach(() => vi.restoreAllMocks());

  it('exits 2 with usage when the subcommand is missing or unknown', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await mcpAppCommand([], process.cwd())).toBe(2);
    expect(await mcpAppCommand(['publish'], process.cwd())).toBe(2);
    expect(err.mock.calls[0][0]).toMatch(/usage: litro mcp-app build/);
  });

  it('exits 1 when the source directory holds no apps', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    const code = await mcpAppCommand(['build', '--dir', 'does-not-exist'], process.cwd());

    expect(code).toBe(1);
    expect(err.mock.calls[0][0]).toMatch(/no app files found/);
  });
});
