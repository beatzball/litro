import { describe, it, expect } from 'vitest';
import { html } from 'lit';
import { uiLit } from './lit.js';

describe('uiLit', () => {
  it('renders a template to a string and carries data/hydrate through', async () => {
    const r = await uiLit(html`<span>${'weather'}</span>`, { data: { t: 21 }, hydrate: { props: { t: 21 } } });
    expect(r.type).toBe('ui');
    expect(r.html).toContain('weather');
    expect(r.data).toEqual({ t: 21 });
    expect(r.hydrate?.props).toEqual({ t: 21 });
  });

  it('escapes interpolated strings (no unsafe HTML injection)', async () => {
    const r = await uiLit(html`<span>${'<img src=x onerror=1>'}</span>`);
    expect(r.html).not.toContain('<img');
  });
});
