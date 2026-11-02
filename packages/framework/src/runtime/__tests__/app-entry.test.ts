import { describe, it, expect, afterEach } from 'vitest';
import { appEntryUrl, getAppVersion, LITRO_APP_VERSION_GLOBAL } from '../app-entry.js';

const g = globalThis as Record<string, unknown>;

describe('appEntryUrl', () => {
  afterEach(() => {
    delete g[LITRO_APP_VERSION_GLOBAL];
  });

  it('is the bare entry when no version is known', () => {
    expect(appEntryUrl({ basePath: '', isDev: false, liveEntry: false })).toBe('/_litro/app.js');
  });

  it('carries the version the page manifest assigned', () => {
    g[LITRO_APP_VERSION_GLOBAL] = '1ee500dabf80';
    expect(getAppVersion()).toBe('1ee500dabf80');
    expect(appEntryUrl({ basePath: '', isDev: false, liveEntry: false })).toBe('/_litro/app.js?v=1ee500dabf80');
  });

  it('prefixes the base path', () => {
    expect(appEntryUrl({ basePath: '/litro', isDev: false, liveEntry: false, version: 'abc' })).toBe(
      '/litro/_litro/app.js?v=abc',
    );
  });

  it('uses an explicit override as given', () => {
    g[LITRO_APP_VERSION_GLOBAL] = 'abc';
    expect(
      appEntryUrl({ basePath: '', isDev: false, liveEntry: false, override: 'https://cdn.example/app.js' }),
    ).toBe('https://cdn.example/app.js');
  });

  it('ignores the version and the override for the dev live entry', () => {
    g[LITRO_APP_VERSION_GLOBAL] = 'abc';
    expect(appEntryUrl({ basePath: '/b', isDev: true, liveEntry: true, override: '/x.js' })).toBe('/b/app.ts');
  });

  it('ignores a version that is not a non-empty string', () => {
    g[LITRO_APP_VERSION_GLOBAL] = 42;
    expect(appEntryUrl({ basePath: '', isDev: false, liveEntry: false })).toBe('/_litro/app.js');
    g[LITRO_APP_VERSION_GLOBAL] = '';
    expect(appEntryUrl({ basePath: '', isDev: false, liveEntry: false })).toBe('/_litro/app.js');
  });

  it('passes the version to a function override', () => {
    g[LITRO_APP_VERSION_GLOBAL] = 'abc';
    expect(
      appEntryUrl({ basePath: '', isDev: false, liveEntry: false, override: (v) => `https://cdn.example/app.js?v=${v}` }),
    ).toBe('https://cdn.example/app.js?v=abc');
  });

  it('uses the bare entry under litro dev with the older middleware, ignoring the override', () => {
    g[LITRO_APP_VERSION_GLOBAL] = 'abc';
    expect(appEntryUrl({ basePath: '/b', isDev: true, liveEntry: false, override: '/x.js' })).toBe(
      '/b/_litro/app.js',
    );
  });
});
