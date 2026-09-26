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

/**
 * <litro-link> builds its <a href> in render(). If the element is not in the
 * server's custom element registry the SSR output is a bare tag with no
 * anchor, so with JavaScript off the link is unclickable text. Every adapter
 * registers it from the manifest preamble, which is the one place guaranteed
 * to reach the server bundle ahead of the pages.
 *
 * The namespace binding matters as much as the import: Rollup deletes a bare
 * side-effect import it cannot prove is used (BUILD-002).
 */
describe('elenaAdapter — <litro-link> on the server', () => {
  it('imports the link element in the manifest preamble', () => {
    const preamble = elenaAdapter.manifestPreamble!();

    expect(preamble).toContain(
      "import * as _litroLink from '@beatzball/litro/adapter/elena/runtime/LitroLink.js'",
    );
    expect(preamble).toContain('globalThis.__litro_link__ = _litroLink;');
  });
});
