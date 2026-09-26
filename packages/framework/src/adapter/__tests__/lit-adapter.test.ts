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
describe('litAdapter — <litro-link> on the server', () => {
  it('imports the link element in the manifest preamble', () => {
    const preamble = litAdapter.manifestPreamble!();

    expect(preamble).toContain(
      "import * as _litroLink from '@beatzball/litro/runtime/LitroLink.js'",
    );
    expect(preamble).toContain('globalThis.__litro_link__ = _litroLink;');
  });
});
