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

  it('provides a manifest preamble with ssr-shim import', () => {
    const preamble = elenaAdapter.manifestPreamble!();
    // Imports the SSR shim module which provides HTMLElement and
    // customElements globals for Node.js before page modules evaluate.
    expect(preamble).toContain("import * as _elenaShim from '@beatzball/litro/adapter/elena/ssr-shim'");
    expect(preamble).toContain('__litro_elena_shim__');
    expect(preamble).toContain("process.env.LITRO_ADAPTER = 'elena'");
  });

  it('provides an empty manifest postamble (no registration needed)', () => {
    const postamble = elenaAdapter.manifestPostamble!(['_page0', '_page1']);
    // No @elenajs/ssr registration needed — the adapter renders components
    // directly using the customElements shim registry.
    expect(postamble).toBe('');
  });
});
