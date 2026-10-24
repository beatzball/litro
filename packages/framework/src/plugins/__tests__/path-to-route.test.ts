/**
 * Unit tests for path-to-route conversion utilities.
 *
 * Run with: pnpm --filter litro test
 *           or: npx vitest run
 */

import { describe, it, expect } from 'vitest';
import { fileToRoute, fileToComponentTag, compareRoutes } from '../path-to-route.js';
import { matchRoute } from '../../runtime/og-handler.js';
import type { LitroRoute } from '../../types/route.js';

const PAGES_DIR = '/app/pages';

// Native in Node 24 (CI) and in every browser the router targets. The
// framework's lib settings do not type it, so declare the part these tests use.
declare const URLPattern: new (init: { pathname: string }) => {
  exec(input: string): { pathname: { groups: Record<string, string | undefined> } } | null;
  test(input: { pathname: string }): boolean;
};

// Helper to build an absolute path from a relative pages path
const p = (rel: string) => `${PAGES_DIR}/${rel}`;

// ---------------------------------------------------------------------------
// fileToRoute — static routes
// ---------------------------------------------------------------------------

describe('fileToRoute — static routes', () => {
  it('converts pages/index.ts to /', () => {
    const route = fileToRoute(p('index.ts'), PAGES_DIR);
    expect(route.path).toBe('/');
    expect(route.isDynamic).toBe(false);
    expect(route.isCatchAll).toBe(false);
    expect(route.filePath).toBe(p('index.ts'));
  });

  it('converts pages/about.ts to /about', () => {
    const route = fileToRoute(p('about.ts'), PAGES_DIR);
    expect(route.path).toBe('/about');
    expect(route.isDynamic).toBe(false);
    expect(route.isCatchAll).toBe(false);
  });

  it('converts pages/blog/index.ts to /blog', () => {
    const route = fileToRoute(p('blog/index.ts'), PAGES_DIR);
    expect(route.path).toBe('/blog');
    expect(route.isDynamic).toBe(false);
    expect(route.isCatchAll).toBe(false);
  });

  it('converts pages/blog/posts.ts to /blog/posts', () => {
    const route = fileToRoute(p('blog/posts.ts'), PAGES_DIR);
    expect(route.path).toBe('/blog/posts');
    expect(route.isDynamic).toBe(false);
  });

  it('supports .tsx extension', () => {
    const route = fileToRoute(p('about.tsx'), PAGES_DIR);
    expect(route.path).toBe('/about');
  });
});

// ---------------------------------------------------------------------------
// fileToRoute — dynamic routes
// ---------------------------------------------------------------------------

describe('fileToRoute — dynamic routes', () => {
  it('converts pages/blog/[slug].ts to /blog/:slug', () => {
    const route = fileToRoute(p('blog/[slug].ts'), PAGES_DIR);
    expect(route.path).toBe('/blog/:slug');
    expect(route.isDynamic).toBe(true);
    expect(route.isCatchAll).toBe(false);
  });

  it('converts pages/users/[id]/posts.ts to /users/:id/posts', () => {
    const route = fileToRoute(p('users/[id]/posts.ts'), PAGES_DIR);
    expect(route.path).toBe('/users/:id/posts');
    expect(route.isDynamic).toBe(true);
    expect(route.isCatchAll).toBe(false);
  });

  it('converts nested dynamic pages/blog/posts/[id].ts to /blog/posts/:id', () => {
    const route = fileToRoute(p('blog/posts/[id].ts'), PAGES_DIR);
    expect(route.path).toBe('/blog/posts/:id');
    expect(route.isDynamic).toBe(true);
    expect(route.isCatchAll).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// fileToRoute — prefixed dynamic routes (issue 234)
// ---------------------------------------------------------------------------

describe('fileToRoute — prefixed dynamic routes', () => {
  it('converts pages/@[handle].ts to /@:handle and marks it dynamic', () => {
    const route = fileToRoute(p('@[handle].ts'), PAGES_DIR);
    expect(route.path).toBe('/@:handle');
    expect(route.isDynamic).toBe(true);
    expect(route.isCatchAll).toBe(false);
  });

  it('converts pages/@[handle]/[statusId].ts to /@:handle/:statusId', () => {
    const route = fileToRoute(p('@[handle]/[statusId].ts'), PAGES_DIR);
    expect(route.path).toBe('/@:handle/:statusId');
    expect(route.isDynamic).toBe(true);
    expect(route.isCatchAll).toBe(false);
  });

  it('keeps a multi-character prefix: pages/users/u-[id]/posts.ts → /users/u-:id/posts', () => {
    const route = fileToRoute(p('users/u-[id]/posts.ts'), PAGES_DIR);
    expect(route.path).toBe('/users/u-:id/posts');
    expect(route.isDynamic).toBe(true);
  });

  it('a prefixed segment is dynamic even though the segment does not start with a colon', () => {
    // The old check was `transformed.startsWith(':')`, which `@:handle` fails.
    // A false here would leave the route in the static tier: the server would
    // compare the literal '/@:handle' and never match a real handle.
    const route = fileToRoute(p('@[handle].ts'), PAGES_DIR);
    expect(route.isDynamic).toBe(true);
  });

  it('a static segment that contains a colon stays static', () => {
    // The suggested replacement `/:[A-Za-z_]/.test(transformed)` would call
    // `/foo:bar` dynamic and the server would turn `:bar` into a param.
    // Nothing in the file name asked for a param, so the flag must stay false.
    const route = fileToRoute(p('foo:bar.ts'), PAGES_DIR);
    expect(route.path).toBe('/foo:bar');
    expect(route.isDynamic).toBe(false);
    expect(route.isCatchAll).toBe(false);
  });

  it('a catch-all is both dynamic and catch-all under the kind-based check', () => {
    const route = fileToRoute(p('[...all].ts'), PAGES_DIR);
    expect(route.path).toBe('/:all(.*)*');
    expect(route.isDynamic).toBe(true);
    expect(route.isCatchAll).toBe(true);
  });

  it('catch-all and optional win over the prefixed dynamic branch because branch order is load-bearing', () => {
    // The prefixed dynamic regex `^([^\[\]]*)\[([^\[\]]+)\]$` also matches
    // `[...all]` (prefix '', param '...all'). If that branch ran first the
    // catch-all would scan as the useless param `:...all`. These two
    // assertions fail the moment someone reorders the branches in
    // transformSegment().
    expect(fileToRoute(p('[...all].ts'), PAGES_DIR).path).toBe('/:all(.*)*');
    expect(fileToRoute(p('[...all].ts'), PAGES_DIR).path).not.toContain(':...');
    expect(fileToRoute(p('[[lang]]/index.ts'), PAGES_DIR).path).toBe('/:lang?');
  });
});

// ---------------------------------------------------------------------------
// fileToRoute — rejected bracket forms (issue 234)
// ---------------------------------------------------------------------------

describe('fileToRoute — rejected bracket forms', () => {
  it('rejects a prefixed catch-all (pages/@[...all].ts) and names the file', () => {
    // Without the guard this falls into the prefixed dynamic branch and yields
    // `@:...all`, which no matcher accepts. Before the prefix fix it was at
    // least an inert static path, so silently scanning it would be a regression.
    expect(() => fileToRoute(p('@[...all].ts'), PAGES_DIR)).toThrow(
      /pages\/@\[\.\.\.all\]\.ts.*catch-all segment cannot carry a prefix.*\[\.\.\.all\]\.ts/,
    );
  });

  it('rejects a prefixed optional (pages/@[[lang]].ts) and names the file', () => {
    expect(() => fileToRoute(p('@[[lang]].ts'), PAGES_DIR)).toThrow(
      /pages\/@\[\[lang\]\]\.ts.*optional segment cannot carry a prefix.*\[\[lang\]\]\.ts/,
    );
  });

  it('rejects a suffix after the bracket (pages/[id]x.ts) and points at the prefix form', () => {
    expect(() => fileToRoute(p('[id]x.ts'), PAGES_DIR)).toThrow(
      /pages\/\[id\]x\.ts.*suffix after the bracket.*not supported/,
    );
  });

  it('rejects a dotted suffix (pages/[id].html.ts)', () => {
    expect(() => fileToRoute(p('[id].html.ts'), PAGES_DIR)).toThrow(
      /pages\/\[id\]\.html\.ts.*suffix after the bracket/,
    );
  });

  it('rejects a nested rejected segment and names the whole relative path', () => {
    expect(() => fileToRoute(p('blog/@[...rest].ts'), PAGES_DIR)).toThrow(
      /pages\/blog\/@\[\.\.\.rest\]\.ts/,
    );
  });

  it('names a .tsx page by its real extension', () => {
    expect(() => fileToRoute(p('@[...all].tsx'), PAGES_DIR)).toThrow(
      /pages\/@\[\.\.\.all\]\.tsx: .*name the file \[\.\.\.all\]\.tsx\./,
    );
    expect(() => fileToRoute(p('[id].html.tsx'), PAGES_DIR)).toThrow(
      /pages\/\[id\]\.html\.tsx: .*rename the file to \[id\]\.tsx/,
    );
  });

  it('tells the author of a colocated non-page file how to keep it in pages/', () => {
    // pages/[id].stories.ts is not a page. The suffix error alone would blame
    // the wrong thing, so the message also names the two ways out.
    expect(() => fileToRoute(p('[id].stories.ts'), PAGES_DIR)).toThrow(
      /pages\/\[id\]\.stories\.ts: .*If this file is not a page .*move it out of pages\/ or start its name with "-"/,
    );
  });

  it('rejects any other stray bracket (pages/a[b]c[d].ts)', () => {
    expect(() => fileToRoute(p('a[b]c[d].ts'), PAGES_DIR)).toThrow(
      /pages\/a\[b\]c\[d\]\.ts.*not a route segment Litro understands/,
    );
  });
});

// ---------------------------------------------------------------------------
// fileToRoute — prefix characters (issue 234)
// ---------------------------------------------------------------------------

const PREFIX_ALLOWED = /^[A-Za-z0-9_~@!&',;=-]$/;

// Every printable ASCII character, plus three non-ASCII ones. '/' and '\\'
// split a path into segments, and '[' and ']' make a different bracket shape,
// so none of those four can be tested as a one-character prefix.
const PREFIX_CANDIDATES = [
  ...Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCharCode(0x20 + i)),
  'é',
  'ü',
  '中',
].filter(c => !['/', '\\', '[', ']'].includes(c));

const REJECTED_PREFIX_CHARS = PREFIX_CANDIDATES.filter(c => !PREFIX_ALLOWED.test(c));

describe('fileToRoute — prefix characters', () => {
  it.each(REJECTED_PREFIX_CHARS.map(c => [JSON.stringify(c), c]))(
    'rejects a prefix containing %s and names the file and the character',
    (_label, c) => {
      const file = `x${c}[id].ts`;
      let message = '';
      try {
        fileToRoute(p(file), PAGES_DIR);
      } catch (err) {
        message = (err as Error).message;
      }
      expect(message).toContain(`pages/${file}: the prefix "x${c}" before [id] contains`);
      expect(message).toContain(JSON.stringify(c));
      expect(message).toContain('Rename the file, for example to [id].ts.');
    },
  );

  it('accepts every allowed character as a prefix', () => {
    const allowed = PREFIX_CANDIDATES.filter(c => PREFIX_ALLOWED.test(c));
    expect(allowed.join('')).toBe(
      "!&',-0123456789;=@ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz~",
    );
    for (const c of allowed) {
      expect(fileToRoute(p(`x${c}[id].ts`), PAGES_DIR).path).toBe(`/x${c}:id`);
    }
  });

  it('every prefix the scanner accepts matches the same URL in URLPattern and in the server matcher', () => {
    // This is the guard on SAFE_PREFIX. If someone adds a character to it,
    // this loop builds the route, runs the real request URL through native
    // URLPattern and through the server builder (og-handler uses the same
    // builder as every server/routes/[...].ts), and checks that both capture
    // the param and both refuse a decoy URL.
    let checked = 0;
    for (const c of PREFIX_CANDIDATES) {
      let route: LitroRoute;
      try {
        route = fileToRoute(p(`x${c}[id].ts`), PAGES_DIR);
      } catch {
        continue; // rejected at scan time, which is the safe outcome
      }
      checked++;
      const url = new URL(`http://localhost/x${c}42`);
      const decoy = new URL('http://localhost/xQ42');

      const pattern = new URLPattern({ pathname: route.path });
      expect(pattern.exec(url.href)?.pathname.groups.id, `URLPattern, prefix ${c}`).toBe('42');
      expect(matchRoute(url.pathname, [route])?.params, `server, prefix ${c}`).toEqual({ id: '42' });
      if (c !== 'Q') {
        expect(pattern.exec(decoy.href), `URLPattern decoy, prefix ${c}`).toBeNull();
        expect(matchRoute(decoy.pathname, [route]), `server decoy, prefix ${c}`).toBeUndefined();
      }
    }
    expect(checked).toBeGreaterThan(60);
  });
});

// ---------------------------------------------------------------------------
// fileToRoute — catch-all routes
// ---------------------------------------------------------------------------

describe('fileToRoute — catch-all routes', () => {
  it('converts pages/[...all].ts to /:all(.*)*', () => {
    const route = fileToRoute(p('[...all].ts'), PAGES_DIR);
    expect(route.path).toBe('/:all(.*)*');
    expect(route.isDynamic).toBe(true);
    expect(route.isCatchAll).toBe(true);
  });

  it('marks [...param] routes as isCatchAll', () => {
    const route = fileToRoute(p('[...all].ts'), PAGES_DIR);
    expect(route.isCatchAll).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// fileToRoute — optional params
// ---------------------------------------------------------------------------

describe('fileToRoute — optional params', () => {
  it('converts pages/[[lang]]/index.ts to /:lang?', () => {
    const route = fileToRoute(p('[[lang]]/index.ts'), PAGES_DIR);
    expect(route.path).toBe('/:lang?');
    expect(route.isDynamic).toBe(true);
    expect(route.isCatchAll).toBe(false);
  });

  it('marks optional param routes as isDynamic', () => {
    const route = fileToRoute(p('[[lang]]/index.ts'), PAGES_DIR);
    expect(route.isDynamic).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// fileToComponentTag
// ---------------------------------------------------------------------------

describe('fileToComponentTag', () => {
  it('pages/index.ts → page-home', () => {
    expect(fileToComponentTag(p('index.ts'), PAGES_DIR)).toBe('page-home');
  });

  it('pages/about.ts → page-about', () => {
    expect(fileToComponentTag(p('about.ts'), PAGES_DIR)).toBe('page-about');
  });

  it('pages/blog/index.ts → page-blog', () => {
    expect(fileToComponentTag(p('blog/index.ts'), PAGES_DIR)).toBe('page-blog');
  });

  it('pages/blog/[slug].ts → page-blog-slug', () => {
    expect(fileToComponentTag(p('blog/[slug].ts'), PAGES_DIR)).toBe('page-blog-slug');
  });

  it('pages/[...all].ts → page-all', () => {
    expect(fileToComponentTag(p('[...all].ts'), PAGES_DIR)).toBe('page-all');
  });

  it('pages/[[lang]]/index.ts → page-lang', () => {
    expect(fileToComponentTag(p('[[lang]]/index.ts'), PAGES_DIR)).toBe('page-lang');
  });

  it('pages/@[handle].ts → page-handle (no leading hyphen from the @)', () => {
    // '@' is not alphanumeric, so it becomes a hyphen; the leading hyphen is
    // then stripped. A tag like 'page--handle' would be invalid.
    expect(fileToComponentTag(p('@[handle].ts'), PAGES_DIR)).toBe('page-handle');
  });

  it('pages/@[handle]/[statusId].ts → page-handle-statusid', () => {
    expect(fileToComponentTag(p('@[handle]/[statusId].ts'), PAGES_DIR)).toBe(
      'page-handle-statusid',
    );
  });

  it('always produces a hyphenated tag', () => {
    const tags = [
      fileToComponentTag(p('index.ts'), PAGES_DIR),
      fileToComponentTag(p('about.ts'), PAGES_DIR),
      fileToComponentTag(p('blog/[slug].ts'), PAGES_DIR),
      fileToComponentTag(p('@[handle].ts'), PAGES_DIR),
      fileToComponentTag(p('@[handle]/[statusId].ts'), PAGES_DIR),
    ];
    for (const tag of tags) {
      expect(tag).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/);
    }
  });
});

// ---------------------------------------------------------------------------
// compareRoutes — sorting
// ---------------------------------------------------------------------------

describe('compareRoutes — sorting', () => {
  const staticAbout: LitroRoute = {
    path: '/about',
    filePath: p('about.ts'),
    componentTag: 'page-about',
    isDynamic: false,
    isCatchAll: false,
  };

  const staticBlog: LitroRoute = {
    path: '/blog',
    filePath: p('blog/index.ts'),
    componentTag: 'page-blog',
    isDynamic: false,
    isCatchAll: false,
  };

  const dynamic: LitroRoute = {
    path: '/blog/:slug',
    filePath: p('blog/[slug].ts'),
    componentTag: 'page-blog-slug',
    isDynamic: true,
    isCatchAll: false,
  };

  const catchAll: LitroRoute = {
    path: '/:all(.*)*',
    filePath: p('[...all].ts'),
    componentTag: 'page-all',
    isDynamic: true,
    isCatchAll: true,
  };

  it('a prefixed route sorts before a bare param sibling, so /@alice is not swallowed by /:slug', () => {
    // ':' is 0x3A and '@' is 0x40, so a plain string compare puts /:slug
    // first. Both matchers take the first route that matches, so the
    // Mastodon URL would render the [slug] page with no error.
    const routes = [
      'index.ts',
      '[slug].ts',
      '[slug]/[id].ts',
      '@[handle].ts',
      '@[handle]/[statusId].ts',
    ]
      .map(rel => fileToRoute(p(rel), PAGES_DIR))
      .sort(compareRoutes);

    // Literal text: '/@/' 3, '//' 2, '/@' 2, '/' 1. The tie between
    // /:slug/:id and /@:handle falls back to the string compare; they match
    // different segment counts, so their relative order changes nothing.
    expect(routes.map(r => r.path)).toEqual([
      '/',
      '/@:handle/:statusId',
      '/:slug/:id',
      '/@:handle',
      '/:slug',
    ]);

    // The same first-match loop the server catch-all route runs.
    expect(matchRoute('/@alice@example.social', routes)?.route.path).toBe('/@:handle');
    expect(matchRoute('/@alice@example.social/12345', routes)).toEqual({
      route: expect.objectContaining({ path: '/@:handle/:statusId' }),
      params: { handle: 'alice@example.social', statusId: '12345' },
    });
    expect(matchRoute('/some-slug', routes)?.route.path).toBe('/:slug');
    expect(matchRoute('/some-slug/7', routes)?.params).toEqual({ slug: 'some-slug', id: '7' });

    // And the client router: the first URLPattern that matches wins.
    const firstClientMatch = (pathname: string) =>
      routes.find(r => new URLPattern({ pathname: r.path }).test({ pathname }))?.path;
    expect(firstClientMatch('/@alice@example.social')).toBe('/@:handle');
    expect(firstClientMatch('/@alice@example.social/12345')).toBe('/@:handle/:statusId');
    expect(firstClientMatch('/some-slug')).toBe('/:slug');
  });

  it('a prefix on a later segment also sorts before the bare param', () => {
    const routes = ['[org]/[repo].ts', '[org]/@[user].ts']
      .map(rel => fileToRoute(p(rel), PAGES_DIR))
      .sort(compareRoutes);
    expect(routes.map(r => r.path)).toEqual(['/:org/@:user', '/:org/:repo']);
    expect(matchRoute('/acme/@alice', routes)?.params).toEqual({ org: 'acme', user: 'alice' });
    expect(matchRoute('/acme/widgets', routes)?.params).toEqual({ org: 'acme', repo: 'widgets' });
  });

  it('a longer prefix sorts before a shorter one', () => {
    const routes = ['@[handle].ts', '@@[handle].ts']
      .map(rel => fileToRoute(p(rel), PAGES_DIR))
      .sort(compareRoutes);
    expect(routes.map(r => r.path)).toEqual(['/@@:handle', '/@:handle']);
  });

  it('a prefixed dynamic route sorts in the dynamic tier, after static and before catch-all', () => {
    const prefixed = fileToRoute(p('@[handle].ts'), PAGES_DIR);
    expect(compareRoutes(staticAbout, prefixed)).toBeLessThan(0);
    expect(compareRoutes(prefixed, catchAll)).toBeLessThan(0);
  });

  it('static comes before dynamic', () => {
    expect(compareRoutes(staticAbout, dynamic)).toBeLessThan(0);
  });

  it('dynamic comes before catch-all', () => {
    expect(compareRoutes(dynamic, catchAll)).toBeLessThan(0);
  });

  it('static comes before catch-all', () => {
    expect(compareRoutes(staticAbout, catchAll)).toBeLessThan(0);
  });

  it('two static routes are sorted lexicographically', () => {
    expect(compareRoutes(staticAbout, staticBlog)).toBeLessThan(0);
    expect(compareRoutes(staticBlog, staticAbout)).toBeGreaterThan(0);
  });

  it('sorting an array puts static first, catch-all last', () => {
    const routes = [catchAll, dynamic, staticBlog, staticAbout];
    const sorted = [...routes].sort(compareRoutes);
    expect(sorted[0].isCatchAll).toBe(false);
    expect(sorted[0].isDynamic).toBe(false);
    expect(sorted[sorted.length - 1].isCatchAll).toBe(true);
  });
});
