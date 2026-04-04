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
