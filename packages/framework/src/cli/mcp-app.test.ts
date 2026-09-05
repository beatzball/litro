import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  appSegmentsFromFile,
  assertUniqueUris,
  mcpAppCommand,
  outputPathFromFile,
  packageAuthority,
  uriFromFile,
} from './mcp-app.js';

describe('outputPathFromFile', () => {
  it.each([
    ['weather-card.ts', 'weather-card'],
    ['weather/card.ts', 'weather/card'],
    ['a/b/c.tsx', 'a/b/c'],
    ['card.mts', 'card'],
    ['weather\\card.ts', 'weather/card'],
  ])('%s -> %s', (input, expected) => {
    expect(outputPathFromFile(input)).toBe(expected);
  });

  it('keeps a dot inside the stem, which is not the extension', () => {
    expect(outputPathFromFile('weather.v2.ts')).toBe('weather.v2');
  });

  it('mirrors the uri path, so two files can never claim one output file', () => {
    // The old scheme flattened with "-", which let `weather/card.ts` and
    // `weather-card.ts` — two DIFFERENT addresses — both claim
    // `weather-card.html`, and the build had to detect the clash. Mirroring
    // makes the clash unrepresentable.
    for (const rel of ['weather-card.ts', 'weather/card.ts', 'a/b/c.tsx']) {
      const uriPath = uriFromFile(rel, 'playground').replace('ui://playground/', '');
      expect(outputPathFromFile(rel)).toBe(uriPath);
    }
    expect(outputPathFromFile('weather/card.ts')).not.toBe(outputPathFromFile('weather-card.ts'));
  });
});

describe('uriFromFile', () => {
  it.each([
    ['weather-card.ts', 'ui://playground/weather-card'],
    ['weather/card.ts', 'ui://playground/weather/card'],
    ['a/b/c.tsx', 'ui://playground/a/b/c'],
    ['weather\\card.ts', 'ui://playground/weather/card'],
  ])('%s -> %s', (input, expected) => {
    expect(uriFromFile(input, 'playground')).toBe(expected);
  });

  it('puts the package name in front of a nested path too, not only a flat file', () => {
    // The authority is the PACKAGE, uniformly. Letting the first folder be the
    // authority instead would give a flat file host "weather-card" and an EMPTY
    // path — a different shape from every nested file, which a host that groups
    // by authority treats differently.
    expect(uriFromFile('weather/card.ts', 'playground')).toBe('ui://playground/weather/card');
    expect(uriFromFile('weather-card.ts', 'playground')).toBe('ui://playground/weather-card');
  });

  it('moves every address together when the package is renamed', () => {
    for (const rel of ['weather-card.ts', 'weather/card.ts', 'a/b/c.tsx']) {
      expect(uriFromFile(rel, 'renamed')).toBe(
        uriFromFile(rel, 'playground').replace('playground', 'renamed'),
      );
    }
  });

  it('does not treat index.ts as the folder root, the way pages/ does', () => {
    expect(uriFromFile('weather/index.ts', 'playground')).toBe('ui://playground/weather/index');
  });

  it('says what to do when there is no package name to take an authority from', () => {
    expect(() => uriFromFile('weather/card.ts', undefined)).toThrow(/no usable "name"/);
    expect(() => uriFromFile('weather-card.ts', undefined)).toThrow(/set "uri" in defineMcpApp/);
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

  describe('characters a uri parser would rewrite or read as syntax', () => {
    // Each of these built successfully before, and shipped a descriptor whose
    // uri a host resolves to a DIFFERENT string than the manifest contains.
    it.each([
      ['big card.ts', 'a space becomes %20'],
      ['weird?name.ts', '? opens a query, truncating the path'],
      ['weird#name.ts', '# opens a fragment, truncating the path'],
      ['café.ts', 'non-ascii is percent-encoded'],
      ['a/b c/d.ts', 'a space in a middle segment'],
    ])('refuses %s (%s)', (input) => {
      expect(() => uriFromFile(input, 'playground')).toThrow(/rewrites or reads as syntax/);
    });

    it('refuses a literal % , which is what makes an encoded twin possible', () => {
      // THE COLLISION THIS CLOSES: `big card.ts` and `big%20card.ts` produced
      // two different raw strings that a parser resolves to ONE address, and
      // neither the output-path check nor the uri check could see it.
      expect(() => uriFromFile('big%20card.ts', 'playground')).toThrow(/rewrites or reads as syntax/);
      expect(() => uriFromFile('big card.ts', 'playground')).toThrow(/rewrites or reads as syntax/);
    });

    it.each(['../escape.ts', 'a/./b.ts', 'a/../b.ts'])('refuses the dot segment in %s', (input) => {
      // RFC 3986 normalisation REMOVES these, so `a/./b` and `a/b` are one
      // resource to a host and two entries to us.
      expect(() => uriFromFile(input, 'playground')).toThrow(/parser removes those/);
    });

    it('still accepts the unreserved set, which ordinary filenames use', () => {
      expect(uriFromFile('weather_card-v2.x~1.ts', 'playground')).toBe(
        'ui://playground/weather_card-v2.x~1',
      );
    });

    it('rejects the same characters for the OUTPUT PATH, not only the uri', () => {
      // Both derivations share one validator, so a file cannot be rejected as
      // an address yet accepted as a filename.
      expect(() => outputPathFromFile('big card.ts')).toThrow(/rewrites or reads as syntax/);
    });
  });
});

describe('appSegmentsFromFile', () => {
  it('drops empty segments from a doubled separator', () => {
    expect(appSegmentsFromFile('a//b.ts')).toEqual(['a', 'b']);
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
    ).toThrow(/weather-card, weather-refresh/);
  });

  it('compares what a parser resolves to, not the raw string', () => {
    // Two strings, one address: a parser rewrites the space to %20. Neither of
    // these can be DERIVED any more — the segment check refuses both — but an
    // app may still write its own uri, and comparing raw text is how two apps
    // end up sharing a host's cache key.
    expect(() =>
      assertUniqueUris([
        { name: 'a', uri: 'ui://x/big card' },
        { name: 'b', uri: 'ui://x/big%20card' },
      ]),
    ).toThrow(/resolve to the uri/);
  });

  it('reports EVERY clash, not just the first', () => {
    // A project that fixes one clash only to meet the next on the following
    // run learns the shape of its directory one build at a time.
    expect(() =>
      assertUniqueUris([
        { name: 'a1', uri: 'ui://x/a' },
        { name: 'a2', uri: 'ui://x/a' },
        { name: 'b1', uri: 'ui://x/b' },
        { name: 'b2', uri: 'ui://x/b' },
      ]),
    ).toThrow(/2 address clashes/);
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
