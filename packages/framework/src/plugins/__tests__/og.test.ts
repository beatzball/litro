import { describe, it, expect, vi } from 'vitest';
import ogPlugin from '../og.js';

function createMockNitro(routes: string[] = []): { options: { prerender: { routes: string[] } }; logger: { info: ReturnType<typeof vi.fn> } } {
  return {
    options: { prerender: { routes } },
    logger: { info: vi.fn() },
  };
}

describe('ogPlugin', () => {
  it('returns early when prerender.routes is empty', async () => {
    const nitro = createMockNitro([]);
    await ogPlugin(nitro as any);
    expect(nitro.options.prerender.routes).toEqual([]);
    expect(nitro.logger.info).not.toHaveBeenCalled();
  });

  it('pushes /__og/index.png for root / route', async () => {
    const nitro = createMockNitro(['/']);
    await ogPlugin(nitro as any);
    expect(nitro.options.prerender.routes).toContain('/__og/index.png');
  });

  it('pushes /__og/about.png for /about route', async () => {
    const nitro = createMockNitro(['/about']);
    await ogPlugin(nitro as any);
    expect(nitro.options.prerender.routes).toContain('/__og/about.png');
  });

  it('handles multiple routes correctly', async () => {
    const nitro = createMockNitro(['/', '/about', '/blog/post']);
    await ogPlugin(nitro as any);
    expect(nitro.options.prerender.routes).toContain('/__og/index.png');
    expect(nitro.options.prerender.routes).toContain('/__og/about.png');
    expect(nitro.options.prerender.routes).toContain('/__og/blog/post.png');
  });

  it('skips routes ending in .xml, .json, .txt, .rss', async () => {
    const nitro = createMockNitro(['/sitemap.xml', '/feed.json', '/robots.txt', '/blog/rss.rss', '/about']);
    await ogPlugin(nitro as any);
    expect(nitro.options.prerender.routes).not.toContain('/__og/sitemap.xml.png');
    expect(nitro.options.prerender.routes).not.toContain('/__og/feed.json.png');
    expect(nitro.options.prerender.routes).not.toContain('/__og/robots.txt.png');
    expect(nitro.options.prerender.routes).not.toContain('/__og/blog/rss.rss.png');
    expect(nitro.options.prerender.routes).toContain('/__og/about.png');
  });

  it('does not duplicate existing OG routes', async () => {
    const nitro = createMockNitro(['/about', '/__og/about.png']);
    await ogPlugin(nitro as any);
    const ogCount = nitro.options.prerender.routes.filter(r => r === '/__og/about.png').length;
    expect(ogCount).toBe(1);
  });

  it('stores config on __litroOgConfig with defaults', async () => {
    const nitro = createMockNitro(['/']);
    await ogPlugin(nitro as any);
    const config = (nitro.options as Record<string, unknown>).__litroOgConfig;
    expect(config).toEqual({
      siteName: 'Litro',
      accentColor: '#ea580c',
      logoSvg: undefined,
    });
  });

  it('stores config with custom values when provided', async () => {
    const nitro = createMockNitro(['/']);
    await ogPlugin(nitro as any, {
      siteName: 'My Site',
      accentColor: '#ff0000',
      logoSvg: '<svg></svg>',
    });
    const config = (nitro.options as Record<string, unknown>).__litroOgConfig;
    expect(config).toEqual({
      siteName: 'My Site',
      accentColor: '#ff0000',
      logoSvg: '<svg></svg>',
    });
  });

  it('logs the count of registered routes', async () => {
    const nitro = createMockNitro(['/', '/about', '/blog']);
    await ogPlugin(nitro as any);
    expect(nitro.logger.info).toHaveBeenCalledWith('[litro:og] Registered 3 OG image prerender routes');
  });
});
