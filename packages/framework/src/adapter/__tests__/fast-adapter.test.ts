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
describe('fastAdapter — <litro-link> on the server', () => {
  it('imports the link element in the manifest preamble', () => {
    const preamble = fastAdapter.manifestPreamble!();

    expect(preamble).toContain(
      "import * as _litroLink from '@beatzball/litro/adapter/fast/runtime/LitroLink.js'",
    );
    expect(preamble).toContain('globalThis.__litro_link__ = _litroLink;');
  });
});
