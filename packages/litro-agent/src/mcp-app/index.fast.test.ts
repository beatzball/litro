/**
 * The packager under `LITRO_ADAPTER=fast`.
 *
 * Its own file, not a case in `index.test.ts`, because the FAST DOM shim
 * installs globals the moment it is imported. vitest isolates test files from
 * each other, so keeping it separate is what stops that leaking into the Lit
 * tests — the same reason `ui/fast.test.ts` stands apart from `ui/lit.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import '@microsoft/fast-ssr/install-dom-shim.js';
import fastSSR from '@microsoft/fast-ssr';

const { templateRenderer } = fastSSR({ renderMode: 'async' });
(globalThis as Record<string, unknown>).__litro_fast_template_renderer__ = templateRenderer;

const { FASTElement, customElement, html: fastHtml } = await import('@microsoft/fast-element');

@customElement({ name: 'forecast-card', template: fastHtml`<p>Loading the forecast…</p>` })
class ForecastCard extends FASTElement {}
void ForecastCard;

// `ui()` reads LITRO_ADAPTER at call time, so this is enough to route the
// packager through uiFast — no module reset needed.
process.env.LITRO_ADAPTER = 'fast';

const { defineMcpApp, buildMcpAppDocument, MCP_APP_MIME_TYPE } = await import('./index.js');
const { findExternalRefs } = await import('./external-urls.js');

describe('buildMcpAppDocument with the FAST adapter', () => {
  it('packages a FAST shell into the same self-contained document', async () => {
    const { html: doc } = await buildMcpAppDocument(
      defineMcpApp({
        uri: 'ui://weather/forecast',
        title: 'Forecast',
        shell: '<forecast-card></forecast-card>',
      }),
    );

    expect(doc.startsWith('<!doctype html>')).toBe(true);
    expect(doc.match(/<html>/g)).toHaveLength(1);
    expect(doc).toContain('<title>Forecast</title>');
    // Rendered by FAST, not Lit: declarative shadow DOM, no lit-part markers.
    expect(doc).toContain('shadowrootmode');
    expect(doc).toContain('Loading the forecast');
    expect(doc).not.toContain('lit-part');
    // Same bridge, whichever adapter drew the shell.
    expect(doc).toContain("request('ui/initialize'");
  });

  it('produces a descriptor identical in shape to the Lit one', async () => {
    const { descriptor } = await buildMcpAppDocument(
      defineMcpApp({
        uri: 'ui://weather/forecast',
        shell: '<forecast-card></forecast-card>',
        prefersBorder: true,
      }),
    );

    expect(descriptor).toEqual({
      uri: 'ui://weather/forecast',
      mimeType: MCP_APP_MIME_TYPE,
      _meta: { ui: { prefersBorder: true } },
    });
  });

  it('renders the shell data-free, same as Lit', async () => {
    const { html: doc } = await buildMcpAppDocument(
      defineMcpApp({ uri: 'ui://a/b', shell: '<forecast-card></forecast-card>' }),
    );
    expect(doc).not.toContain('tempC');
  });

  it('still refuses a document that loads from outside', async () => {
    await expect(
      buildMcpAppDocument(
        defineMcpApp({
          uri: 'ui://a/b',
          shell: '<forecast-card></forecast-card>',
          styles: '@import "https://cdn.example.com/x.css";',
        }),
      ),
    ).rejects.toThrow(/loads 1 resource\(s\) from outside/);
  });

  it('surfaces uiFast’s unregistered-tag error rather than packing an empty shell', async () => {
    // A silent no-op render is the worst outcome here: the document would pack
    // and ship, and the view would be blank in the host with nothing to see.
    await expect(
      buildMcpAppDocument(defineMcpApp({ uri: 'ui://a/b', shell: '<never-registered></never-registered>' })),
    ).rejects.toThrow(/not registered/);
  });

  it('emits nothing external from FAST’s own DSD output', async () => {
    const { html: doc } = await buildMcpAppDocument(
      defineMcpApp({ uri: 'ui://a/b', shell: '<forecast-card></forecast-card>' }),
    );
    expect(findExternalRefs(doc)).toEqual([]);
  });
});
