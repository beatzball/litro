import { describe, it, expect } from 'vitest';
import { parseOgPath, matchRoute } from '../og-handler.js';
import type { LitroRoute } from '../../types/route.js';

describe('parseOgPath', () => {
  it('strips /__og prefix and .png suffix from blog paths', () => {
    expect(parseOgPath('/__og/blog/my-post.png')).toBe('/blog/my-post');
  });

  it('converts /__og/index.png to /', () => {
    expect(parseOgPath('/__og/index.png')).toBe('/');
  });

  it('strips /__og prefix and .png suffix from simple paths', () => {
    expect(parseOgPath('/__og/about.png')).toBe('/about');
  });

  it('handles nested paths', () => {
    expect(parseOgPath('/__og/docs/getting-started.png')).toBe('/docs/getting-started');
  });

  it('handles multi-segment paths', () => {
    expect(parseOgPath('/__og/compare/nextjs.png')).toBe('/compare/nextjs');
  });
});

describe('matchRoute', () => {
  const routes: LitroRoute[] = [
    { path: '/', filePath: '/pages/index.ts', componentTag: 'page-home', isDynamic: false, isCatchAll: false },
    { path: '/about', filePath: '/pages/about.ts', componentTag: 'page-about', isDynamic: false, isCatchAll: false },
    { path: '/blog/:slug', filePath: '/pages/blog/[slug].ts', componentTag: 'page-blog-slug', isDynamic: true, isCatchAll: false },
    { path: '/:all(.*)*', filePath: '/pages/[...all].ts', componentTag: 'page-all', isDynamic: true, isCatchAll: true },
  ];

  it('matches the home route with empty params', () => {
    const result = matchRoute('/', routes);
    expect(result).toBeDefined();
    expect(result!.route.path).toBe('/');
    expect(result!.params).toEqual({});
  });

  it('matches a static route', () => {
    const result = matchRoute('/about', routes);
    expect(result).toBeDefined();
    expect(result!.route.path).toBe('/about');
    expect(result!.params).toEqual({});
  });

  it('matches a dynamic route and extracts params', () => {
    const result = matchRoute('/blog/my-post', routes);
    expect(result).toBeDefined();
    expect(result!.route.path).toBe('/blog/:slug');
    expect(result!.params).toEqual({ slug: 'my-post' });
  });

  it('matches catch-all route for deep paths', () => {
    const result = matchRoute('/random/deep/path', routes);
    expect(result).toBeDefined();
    expect(result!.route.path).toBe('/:all(.*)*');
    expect(result!.params).toEqual({ all: 'random/deep/path' });
  });

  describe('literal runs are escaped (issue 234)', () => {
    // A bracket left in a route path, as the pre-fix scanner produced for
    // `pages/@[handle]/[statusId].ts`, used to become a character class, so
    // six one-letter handles matched and the real path did not.
    const bracketLiteral: LitroRoute = {
      path: '/@[handle]/:statusId',
      filePath: '/pages/@[handle]/[statusId].ts',
      componentTag: 'page-handle-statusid',
      isDynamic: true,
      isCatchAll: false,
    };
    const dottedLiteral: LitroRoute = {
      path: '/v1.0/:id',
      filePath: '/pages/v1.0/[id].ts',
      componentTag: 'page-v1-0-id',
      isDynamic: true,
      isCatchAll: false,
    };
    const prefixed: LitroRoute = {
      path: '/@:handle',
      filePath: '/pages/@[handle].ts',
      componentTag: 'page-handle',
      isDynamic: true,
      isCatchAll: false,
    };
    const prefixedTwo: LitroRoute = {
      path: '/@:handle/:statusId',
      filePath: '/pages/@[handle]/[statusId].ts',
      componentTag: 'page-handle-statusid',
      isDynamic: true,
      isCatchAll: false,
    };
    const optional: LitroRoute = {
      path: '/:lang?',
      filePath: '/pages/[[lang]]/index.ts',
      componentTag: 'page-lang',
      isDynamic: true,
      isCatchAll: false,
    };

    it('a bracket in a literal run matches itself, not a character class', () => {
      expect(matchRoute('/@[handle]/123', [bracketLiteral])?.params).toEqual({ statusId: '123' });
      expect(matchRoute('/@h/123', [bracketLiteral])).toBeUndefined();
      expect(matchRoute('/@a/999', [bracketLiteral])).toBeUndefined();
    });

    it('a dot in a literal run matches only a dot', () => {
      expect(matchRoute('/v1.0/5', [dottedLiteral])?.params).toEqual({ id: '5' });
      expect(matchRoute('/v1x0/5', [dottedLiteral])).toBeUndefined();
    });

    it('a prefixed param still matches and captures the whole segment', () => {
      expect(matchRoute('/@alice@example.social', [prefixed])?.params).toEqual({
        handle: 'alice@example.social',
      });
      expect(matchRoute('/alice', [prefixed])).toBeUndefined();
    });

    it('two segments with a prefixed first param capture both', () => {
      expect(matchRoute('/@alice@example.social/12345', [prefixedTwo])?.params).toEqual({
        handle: 'alice@example.social',
        statusId: '12345',
      });
    });

    it('optional and catch-all params still work after the split', () => {
      expect(matchRoute('/', [optional])?.route.path).toBe('/:lang?');
      expect(matchRoute('/en', [optional])?.params).toEqual({ lang: 'en' });
      expect(matchRoute('/a/b/c', routes)?.params).toEqual({ all: 'a/b/c' });
    });
  });

  it('returns undefined when no routes match (without catch-all)', () => {
    const routesNoCatchAll: LitroRoute[] = [
      { path: '/', filePath: '/pages/index.ts', componentTag: 'page-home', isDynamic: false, isCatchAll: false },
      { path: '/about', filePath: '/pages/about.ts', componentTag: 'page-about', isDynamic: false, isCatchAll: false },
    ];
    const result = matchRoute('/nonexistent', routesNoCatchAll);
    expect(result).toBeUndefined();
  });

  it('returns undefined when routes array is empty', () => {
    const result = matchRoute('/anything', []);
    expect(result).toBeUndefined();
  });
});
