import { describe, it, expect } from 'vitest';
import { fastAdapter } from '../fast/index.js';

describe('fastAdapter', () => {
  it('has name "fast"', () => {
    expect(fastAdapter.name).toBe('fast');
  });

  it('needs DSD polyfill', () => {
    expect(fastAdapter.needsDSDPolyfill).toBe(true);
  });

  it('returns empty string for head scripts', () => {
    expect(fastAdapter.getHeadScripts({ isDev: false, basePath: '' })).toBe('');
  });

  it('points to FAST client entry module', () => {
    expect(fastAdapter.clientEntryModule).toBe(
      '../adapter/fast/runtime/client.js',
    );
  });

  it('returns empty vite plugins array', () => {
    expect(fastAdapter.vitePlugins()).toEqual([]);
  });

  it('returns empty nitro config (FAST packages kept external)', () => {
    const config = fastAdapter.nitroConfig();
    expect(config.externals).toBeUndefined();
  });
});
