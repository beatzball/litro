/**
 * Unit tests for path-to-route conversion utilities.
 *
 * Run with: pnpm --filter litro test
 *           or: npx vitest run
 */

import { describe, it, expect } from 'vitest';
import { fileToRoute, fileToComponentTag, compareRoutes } from '../path-to-route.js';
import type { LitroRoute } from '../../types/route.js';

const PAGES_DIR = '/app/pages';

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

  it('rejects any other stray bracket (pages/a[b]c[d].ts)', () => {
    expect(() => fileToRoute(p('a[b]c[d].ts'), PAGES_DIR)).toThrow(
      /pages\/a\[b\]c\[d\]\.ts.*not a route segment Litro understands/,
    );
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
