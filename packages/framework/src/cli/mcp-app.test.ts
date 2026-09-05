import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  appNameFromFile,
  assertUniqueUris,
  mcpAppCommand,
  packageAuthority,
  uriFromFile,
} from './mcp-app.js';

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

describe('uriFromFile', () => {
  it.each([
    ['weather/card.ts', 'ui://weather/card'],
    ['a/b/c.tsx', 'ui://a/b/c'],
    ['weather\\card.ts', 'ui://weather/card'],
  ])('%s -> %s', (input, expected) => {
    expect(uriFromFile(input, 'playground')).toBe(expected);
  });

  it('takes the first segment from the package name for a flat file', () => {
    // A single segment would give host "weather-card" and an EMPTY path — a
    // different shape from every nested file, which a host that groups by
    // authority treats differently.
    expect(uriFromFile('weather-card.ts', 'playground')).toBe('ui://playground/weather-card');
  });

  it('does NOT prefix the package name when the file already has a folder', () => {
    // The folder is the authority. Prefixing as well would bury the path the
    // author wrote one level down and make the address unreadable from the tree.
    expect(uriFromFile('weather/card.ts', 'playground')).toBe('ui://weather/card');
  });

  it('does not treat index.ts as the folder root, the way pages/ does', () => {
    // Collapsing it to `ui://weather` would leave a host with no path — the
    // one shape the package-name rule above exists to avoid.
    expect(uriFromFile('weather/index.ts', 'playground')).toBe('ui://weather/index');
  });

  it('says what to do when a flat file has no package name to borrow', () => {
    expect(() => uriFromFile('weather-card.ts', undefined)).toThrow(/Give it a folder/);
  });

  it.each(['[slug].ts', 'blog/[slug].ts', '[...all].ts', '[[opt]]/card.ts'])(
    'refuses the dynamic segment in %s',
    (input) => {
      // Every other filesystem-routed directory in Litro supports these. A
      // ui:// resource is a static template the host caches by address, so
      // there is no request to fill a parameter from — and a literal "[slug]"
      // in a protocol-visible address is a typo that would otherwise ship.
      expect(() => uriFromFile(input, 'playground')).toThrow(/dynamic segment/);
    },
  );

  it('agrees with appNameFromFile, which names the same file on disk', () => {
    // The manifest pairs the two. Derived apart, they drift on the next edit
    // to either, and the descriptor then points at a file that is not there.
    for (const rel of ['weather/card.ts', 'a/b/c.tsx']) {
      const fromUri = uriFromFile(rel, 'playground').replace('ui://', '').split('/').join('-');
      expect(fromUri).toBe(appNameFromFile(rel));
    }
  });
});

describe('packageAuthority', () => {
  it.each([
    ['playground', 'playground'],
    ['@beatzball/playground', 'playground'],
    ['litro-docs', 'litro-docs'],
  ])('%s -> %s', (input, expected) => {
    expect(packageAuthority(input)).toBe(expected);
  });

  it.each([undefined, '', '@scope/', 'Has Spaces', 'UPPER', '_leading'])(
    'gives up on %s rather than emitting a broken authority',
    (input) => {
      expect(packageAuthority(input)).toBeUndefined();
    },
  );
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
