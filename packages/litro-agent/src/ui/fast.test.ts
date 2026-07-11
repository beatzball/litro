import { describe, it, expect } from 'vitest';
import '@microsoft/fast-ssr/install-dom-shim.js';
import fastSSR from '@microsoft/fast-ssr';

const { templateRenderer } = fastSSR({ renderMode: 'async' });
(globalThis as Record<string, unknown>).__litro_fast_template_renderer__ = templateRenderer;

const { FASTElement, customElement, html: fastHtml } = await import('@microsoft/fast-element');
@customElement({ name: 'spike-card', template: fastHtml`<p>fast-card-content</p>` })
class SpikeCard extends FASTElement {}
void SpikeCard;

const { uiFast } = await import('./fast.js');

describe('uiFast', () => {
  it('renders a tag string to DSD via the shared templateRenderer', async () => {
    const r = await uiFast('<spike-card></spike-card>', { data: { ok: true } });
    expect(r.html).toContain('shadowrootmode');
    expect(r.html).toContain('fast-card-content');
    expect(r.data).toEqual({ ok: true });
  });

  it('throws AgentError when the tag is not registered on the server', async () => {
    await expect(uiFast('<unregistered-tag></unregistered-tag>')).rejects.toThrow(/not registered/);
  });
});
