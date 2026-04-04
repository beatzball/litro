import { describe, it, expect, vi } from 'vitest';
import ogPlugin, { ogPrerenderHook } from '../og.js';

describe('ogPrerenderHook', () => {
  it('does nothing when routes set is empty', () => {
    const hook = ogPrerenderHook();
    const routes = new Set<string>();
    hook(routes);
    expect([...routes]).toEqual([]);
  });

  it('pushes /__og/index.png for root / route', () => {
    const hook = ogPrerenderHook();
    const routes = new Set(['/']);
    hook(routes);
    expect(routes.has('/__og/index.png')).toBe(true);
  });

  it('pushes /__og/about.png for /about route', () => {
    const hook = ogPrerenderHook();
    const routes = new Set(['/about']);
    hook(routes);
    expect(routes.has('/__og/about.png')).toBe(true);
  });

  it('handles multiple routes correctly', () => {
    const hook = ogPrerenderHook();
    const routes = new Set(['/', '/about', '/blog/post']);
    hook(routes);
    expect(routes.has('/__og/index.png')).toBe(true);
    expect(routes.has('/__og/about.png')).toBe(true);
    expect(routes.has('/__og/blog/post.png')).toBe(true);
  });

  it('skips routes ending in .xml, .json, .txt, .rss', () => {
    const hook = ogPrerenderHook();
    const routes = new Set(['/sitemap.xml', '/feed.json', '/robots.txt', '/blog/rss.rss', '/about']);
    hook(routes);
    expect(routes.has('/__og/sitemap.xml.png')).toBe(false);
    expect(routes.has('/__og/feed.json.png')).toBe(false);
    expect(routes.has('/__og/robots.txt.png')).toBe(false);
    expect(routes.has('/__og/blog/rss.rss.png')).toBe(false);
    expect(routes.has('/__og/about.png')).toBe(true);
  });

  it('does not duplicate existing OG routes', () => {
    const hook = ogPrerenderHook();
    const routes = new Set(['/about', '/__og/about.png']);
    hook(routes);
    expect([...routes].filter(r => r === '/__og/about.png').length).toBe(1);
  });

  it('logs the count of registered routes', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const hook = ogPrerenderHook();
    const routes = new Set(['/', '/about', '/blog']);
    hook(routes);
    expect(spy).toHaveBeenCalledWith('[litro:og] Registered 3 OG image prerender routes');
    spy.mockRestore();
  });
});

describe('ogPlugin (build:before)', () => {
  it('stores config on __litroOgConfig with defaults', async () => {
    const nitro = { options: {} } as any;
    await ogPlugin(nitro);
    expect(nitro.options.__litroOgConfig).toEqual({
      siteName: 'Litro',
      accentColor: '#ea580c',
      logoSvg: undefined,
    });
  });

  it('stores config with custom values when provided', async () => {
    const nitro = { options: {} } as any;
    await ogPlugin(nitro, {
      siteName: 'My Site',
      accentColor: '#ff0000',
      logoSvg: '<svg></svg>',
    });
    expect(nitro.options.__litroOgConfig).toEqual({
      siteName: 'My Site',
      accentColor: '#ff0000',
      logoSvg: '<svg></svg>',
    });
  });
});
