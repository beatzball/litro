import { describe, it, expect, vi, afterEach } from 'vitest';

describe('ui() resolver', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('isUIResult: recognizes a well-formed UIResult and rejects everything else', async () => {
    const { isUIResult } = await import('./index.js');
    expect(isUIResult({ type: 'ui', html: '<p></p>' })).toBe(true);
    expect(isUIResult({ type: 'ui', html: 5 })).toBe(false);
    expect(isUIResult({ type: 'other', html: '' })).toBe(false);
    expect(isUIResult(null)).toBe(false);
    expect(isUIResult('nope')).toBe(false);
  });

  it('defaults to the lit renderer when LITRO_ADAPTER is unset', async () => {
    vi.stubEnv('LITRO_ADAPTER', undefined as unknown as string);
    delete (process.env as Record<string, unknown>).LITRO_ADAPTER;
    vi.resetModules();
    const { ui } = await import('./index.js');
    const { html } = await import('lit');
    const r = await ui(html`<span>${'weather'}</span>`, { data: { t: 21 } });
    expect(r.type).toBe('ui');
    expect(r.html).toContain('weather');
    expect(r.data).toEqual({ t: 21 });
  });

  it('rejects with a "deferred" AgentError when LITRO_ADAPTER=elena', async () => {
    vi.stubEnv('LITRO_ADAPTER', 'elena');
    vi.resetModules();
    const { ui } = await import('./index.js');
    await expect(ui('<x-y></x-y>')).rejects.toThrow(/deferred/);
  });
});
