import { describe, it, expect } from 'vitest';
import { litAdapter } from '../lit/index.js';

describe('litAdapter', () => {
  it('has name "lit"', () => {
    expect(litAdapter.name).toBe('lit');
  });

  it('needs DSD polyfill', () => {
    expect(litAdapter.needsDSDPolyfill).toBe(true);
  });

  it('returns empty string for head scripts', () => {
    expect(litAdapter.getHeadScripts({ isDev: false, basePath: '' })).toBe('');
  });

  it('returns empty vite plugins array', () => {
    expect(litAdapter.vitePlugins()).toEqual([]);
  });

  it('returns nitro config with Lit externals and esbuild options', () => {
    const config = litAdapter.nitroConfig();
    expect(config.externals?.inline).toContain('@lit-labs/ssr');
    expect(config.externals?.inline).toContain('@lit-labs/ssr-client');
    expect(config.esbuild?.options?.tsconfigRaw).toBeDefined();
  });
});
