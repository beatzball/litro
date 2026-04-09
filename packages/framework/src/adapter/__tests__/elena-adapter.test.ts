import { describe, it, expect } from 'vitest';
import { elenaAdapter } from '../elena/index.js';

describe('elenaAdapter', () => {
  it('has name "elena"', () => {
    expect(elenaAdapter.name).toBe('elena');
  });

  it('does NOT need DSD polyfill (light DOM)', () => {
    expect(elenaAdapter.needsDSDPolyfill).toBe(false);
  });

  it('returns empty string for head scripts', () => {
    expect(elenaAdapter.getHeadScripts({ isDev: false, basePath: '' })).toBe('');
  });

  it('points to Elena client entry module', () => {
    expect(elenaAdapter.clientEntryModule).toBe(
      '../adapter/elena/runtime/client.js',
    );
  });

  it('returns empty vite plugins array', () => {
    expect(elenaAdapter.vitePlugins()).toEqual([]);
  });

  it('returns empty nitro config (no special requirements)', () => {
    const config = elenaAdapter.nitroConfig();
    expect(config.externals).toBeUndefined();
    expect(config.esbuild).toBeUndefined();
  });

  it('provides a manifest preamble with @elenajs/ssr import', () => {
    const preamble = elenaAdapter.manifestPreamble!();
    // Direct @elenajs/ssr import ensures HTMLElement shim is installed
    // before any page module evaluates @elenajs/core.
    expect(preamble).toContain("import * as _elenaSsr from '@elenajs/ssr'");
    expect(preamble).toContain('__litro_elena_ssr__');
    expect(preamble).toContain('__litro_elena_register__');
    expect(preamble).toContain("process.env.LITRO_ADAPTER = 'elena'");
  });

  it('provides a manifest postamble that registers page components', () => {
    const postamble = elenaAdapter.manifestPostamble!(['_page0', '_page1']);
    // Postamble calls register() on each page module's default export
    expect(postamble).toContain('_elenaSsr.register(_page0.default)');
    expect(postamble).toContain('_elenaSsr.register(_page1.default)');
  });
});
