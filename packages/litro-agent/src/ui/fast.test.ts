import { describe, it, expect } from 'vitest';
import '@microsoft/fast-ssr/install-dom-shim.js';
import fastSSR from '@microsoft/fast-ssr';

const { templateRenderer } = fastSSR({ renderMode: 'async' });
(globalThis as Record<string, unknown>).__litro_fast_template_renderer__ = templateRenderer;

const { FASTElement, customElement, html: fastHtml } = await import('@microsoft/fast-element');
@customElement({ name: 'spike-card', template: fastHtml`<p>fast-card-content</p>` })
class SpikeCard extends FASTElement {}
void SpikeCard;

@customElement({ name: 'light-note', template: fastHtml`<p>light-note-content</p>`, shadowOptions: null })
class LightNote extends FASTElement {}
void LightNote;

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

  it('renders a registered light-DOM element (shadowOptions: null) without a false-positive guard trip', async () => {
    const r = await uiFast('<light-note></light-note>');
    expect(r.html).toContain('light-note-content');
    expect(r.html).not.toContain('shadowrootmode');
  });

  it('throws naming the specific unregistered tag when nested among registered tags', async () => {
    await expect(
      uiFast('<div><spike-card></spike-card><nope-widget></nope-widget></div>'),
    ).rejects.toThrow(/not registered/);
    await expect(
      uiFast('<div><spike-card></spike-card><nope-widget></nope-widget></div>'),
    ).rejects.toThrow(/nope-widget/);
  });

  it('renders plain HTML with no custom elements without tripping the guard', async () => {
    const r = await uiFast('<p>hi</p>');
    expect(r.html).toContain('hi');
  });
});
