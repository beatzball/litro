import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

  it.each(['../escape.ts', 'a/../b.ts', 'a/./b.ts'])(
    'refuses %s, which would write outside the output directory',
    (input) => {
      // The ONLY thing an output path refuses: `.` and `..` are resolved by the
      // filesystem, so `../x` escapes the out dir. No explicit uri makes that
      // safe, which is why this one is not recoverable.
      expect(() => outputPathFromFile(input)).toThrow(/outside the output directory/);
    },
  );

  it.each(['weather#card.ts', 'weather?card.ts', 'a/b#c/d.ts'])(
    'refuses %s, which the module loader cannot address',
    (input) => {
      // Vite resolves a module by a URL-shaped id, so `#` opens a fragment and
      // `?` a query: the file is looked up under a shorter name and reported
      // as missing when it plainly exists. NOT excusable by setting `uri` —
      // the docs used to promise it was, and it never was.
      expect(() => outputPathFromFile(input)).toThrow(/module loader reads as part of a url/);
    },
  );

  it.each([
    ['weather\u0001card.ts', 'a C0 control character'],
    ['weather\u2028card.ts', 'U+2028, a line separator above the C0 range'],
    ['weather\u2029card.ts', 'U+2029, a paragraph separator'],
  ])('refuses %s (%s)', (input) => {
    expect(() => outputPathFromFile(input)).toThrow(/module loader/);
  });

  it('does NOT refuse DEL, which the loader handles fine', () => {
    // U+007F is a control character by Unicode category but sits above the C0
    // range, and Vite loads it without complaint. Refusing it would be a rule
    // with no failure behind it.
    expect(outputPathFromFile('weather\u007Fcard.ts')).toBe('weather\u007Fcard');
  });

  it('says plainly that an explicit uri does not help for a loader character', () => {
    // Every other refusal points at "or set uri". This one must not, because
    // that advice does nothing — the failure is before an address is consulted.
    expect(() => outputPathFromFile('weather#card.ts')).toThrow(/Setting "uri" does not/);
  });

  it('refuses a path with no name left after the extension', () => {
    // uriFromFile has the same guard; they must not disagree on emptiness, or
    // an empty stem would reach join(outDir, '.html').
    expect(() => outputPathFromFile('.ts')).toThrow(/no name to build an output file/);
    expect(() => uriFromFile('.ts', 'playground')).toThrow(/no name to build a uri/);
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

    it('does NOT reject them for the OUTPUT PATH, so an explicit uri can rescue', () => {
      // "big card.html" is a perfectly legal filename. Refusing it here would
      // refuse an app that names its own uri and never needed one derived —
      // an error naming a remedy the author had already applied.
      expect(outputPathFromFile('big card.ts')).toBe('big card');
      expect(outputPathFromFile('café.ts')).toBe('café');
      expect(outputPathFromFile('[slug].ts')).toBe('[slug]');
    });
  });
});

/**
 * Drives the REAL command against a throwaway project.
 *
 * Everything asserted here is refused in the pre-flight, which returns before
 * Vite is ever created — so these need no module resolution and stay fast. That
 * is also the point: the pre-flight is CLI code, and pure-function tests cannot
 * reach it. The manifest guard was reverted to its broken form and 62 tests
 * stayed green, twice over three rounds.
 */
function buildWith(files: Record<string, string>): Promise<{ code: number; errors: string }> {
  const root = mkdtempSync(join(tmpdir(), 'litro-mcp-app-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'fixture' }));
  for (const [rel, body] of Object.entries(files)) {
    const full = join(root, 'mcp-apps', rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body);
  }
  const errors: string[] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((...a) => {
    errors.push(a.join(' '));
  });
  return mcpAppCommand(['build'], root)
    .then((code) => ({ code, errors: errors.join('\n') }))
    .finally(() => {
      spy.mockRestore();
      rmSync(root, { recursive: true, force: true });
    });
}

describe('the reserved manifest stem', () => {
  const APP = 'export default {};';

  it('refuses a top-level manifest.ts through the real command', async () => {
    const { code, errors } = await buildWith({ 'manifest.ts': APP });
    expect(code).toBe(1);
    expect(errors).toMatch(/index listing every app/);
  });

  it('refuses Manifest.ts, because the filesystem does not distinguish one', async () => {
    // On APFS and NTFS `Manifest.json` IS `manifest.json`, so a case-sensitive
    // check let one capital letter reproduce the whole clobber. Shipped broken
    // once, fixed, and the suite never noticed either time.
    const { code, errors } = await buildWith({ 'Manifest.ts': APP });
    expect(code).toBe(1);
    expect(errors).toMatch(/index listing every app/);
  });

  it('refuses manifeſt.ts, which toLowerCase() alone does not fold', async () => {
    // U+017F LONG S folds to "s" under the full Unicode rules APFS uses, but is
    // ALREADY lowercase — so `toLowerCase()` leaves it and the filesystem still
    // collides it. Verified against the real filesystem: writing `manifeſt.json`
    // overwrites `manifest.json`.
    const { code, errors } = await buildWith({ 'manife\u017Ft.ts': APP });
    expect(code).toBe(1);
    expect(errors).toMatch(/index listing every app/);
  });

  it('leaves a NESTED manifest.ts alone, which collides with nothing', async () => {
    // Not refused by the pre-flight, so this one gets as far as loading the
    // module — which fails for a fixture with no defineMcpApp(). Reaching that
    // failure is the assertion: the manifest guard did not fire.
    const { errors } = await buildWith({ 'sub/manifest.ts': APP });
    expect(errors).not.toMatch(/index listing every app/);
  });
});

describe('the reserved manifest stem, as a derivation', () => {
  // `manifest.json` is the index listing every app. An app packing to that stem
  // writes its descriptor there and has the index overwrite it, leaving the
  // manifest entry pointing `descriptor` at the array itself — exit 0, silent.
  //
  // The CLI does the refusing, so these pin the two derivations it compares.
  it('is what a top-level manifest.ts packs to', () => {
    expect(outputPathFromFile('manifest.ts')).toBe('manifest');
  });

  it('catches a capital, because the filesystem does not distinguish one', () => {
    // On APFS and NTFS `Manifest.json` IS `manifest.json`. A case-sensitive
    // check let one capital letter reproduce the whole bug.
    expect(outputPathFromFile('Manifest.ts').toLowerCase()).toBe('manifest');
    expect(outputPathFromFile('MANIFEST.ts').toLowerCase()).toBe('manifest');
  });

  it('does not reach a nested one, which collides with nothing', () => {
    expect(outputPathFromFile('sub/manifest.ts')).toBe('sub/manifest');
    expect(outputPathFromFile('sub/manifest.ts').toLowerCase()).not.toBe('manifest');
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
    ).toThrow(/weather-card and weather-refresh/);
  });

  it('folds authority case, which a ui:// parser does not', () => {
    // `ui:` is not a WHATWG "special" scheme, so `new URL()` leaves the host's
    // case alone — but RFC 3986 makes it case-insensitive. Only reachable via a
    // hand-written uri; a derived authority is lowercase by construction.
    expect(() =>
      assertUniqueUris([
        { name: 'a', uri: 'ui://PKG/card' },
        { name: 'b', uri: 'ui://pkg/card' },
      ]),
    ).toThrow(/resolve to the uri/);
  });

  it('folds percent-triplet case, the example the old comment got wrong', () => {
    expect(() =>
      assertUniqueUris([
        { name: 'a', uri: 'ui://pkg/a%2Fb' },
        { name: 'b', uri: 'ui://pkg/a%2fb' },
      ]),
    ).toThrow(/resolve to the uri/);
  });

  it('reads as a list at three, not a chain of "and"', () => {
    expect(() =>
      assertUniqueUris([
        { name: 'a', uri: 'ui://x/a' },
        { name: 'b', uri: 'ui://x/a' },
        { name: 'c', uri: 'ui://x/a' },
      ]),
    ).toThrow(/a, b and c all resolve/);
  });

  it('names both apps with "and", not "all", when there are two', () => {
    expect(() =>
      assertUniqueUris([
        { name: 'a', uri: 'ui://x/a' },
        { name: 'b', uri: 'ui://x/a' },
      ]),
    ).toThrow(/a and b resolve to/);
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
