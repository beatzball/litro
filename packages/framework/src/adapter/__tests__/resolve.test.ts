import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveAdapter } from '../resolve.js';

describe('resolveAdapter', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to lit adapter', async () => {
    const adapter = await resolveAdapter();
    expect(adapter.name).toBe('lit');
  });

  it('resolves lit adapter explicitly', async () => {
    const adapter = await resolveAdapter('lit');
    expect(adapter.name).toBe('lit');
    expect(adapter.needsDSDPolyfill).toBe(true);
  });

  it('resolves fast adapter', async () => {
    const adapter = await resolveAdapter('fast');
    expect(adapter.name).toBe('fast');
    expect(adapter.needsDSDPolyfill).toBe(true);
  });

  it('reads LITRO_ADAPTER env var when no argument given', async () => {
    vi.stubEnv('LITRO_ADAPTER', 'fast');
    const adapter = await resolveAdapter();
    expect(adapter.name).toBe('fast');
  });

  it('explicit argument takes precedence over env var', async () => {
    vi.stubEnv('LITRO_ADAPTER', 'fast');
    const adapter = await resolveAdapter('lit');
    expect(adapter.name).toBe('lit');
  });

  it('throws on unknown adapter name', async () => {
    await expect(resolveAdapter('unknown')).rejects.toThrow(
      'Unknown adapter "unknown"',
    );
  });
});
