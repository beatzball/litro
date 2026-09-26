/**
 * Reading what the packer wrote — including the three ways a manifest can be
 * broken, which are failures, and the one way it can be absent, which is not.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { loadPackedApps, resolveApp } from './apps.js';
import { fixtureApps } from './fixtures.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'litro-apps-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function good(): Promise<void> {
  await writeFile(
    join(dir, 'manifest.json'),
    JSON.stringify([{ name: 'weather/card', uri: 'ui://x/weather/card', html: 'weather/card.html', descriptor: 'weather/card.json' }]),
  );
  await mkdir(join(dir, 'weather'), { recursive: true });
  await writeFile(join(dir, 'weather', 'card.html'), 'PACKED-BYTES\n');
  await writeFile(
    join(dir, 'weather', 'card.json'),
    JSON.stringify({ uri: 'ui://x/weather/card', name: 'card', mimeType: 'text/html;profile=mcp-app', _meta: { ui: { prefersBorder: true } } }),
  );
}

describe('loadPackedApps', () => {
  it('loads a nested app and hands back its bytes untouched', async () => {
    await good();
    const { apps, missing } = await loadPackedApps(dir);
    expect(missing).toBe(false);
    expect(apps).toEqual([
      {
        name: 'weather/card',
        html: 'PACKED-BYTES\n',
        descriptor: {
          uri: 'ui://x/weather/card',
          name: 'card',
          mimeType: 'text/html;profile=mcp-app',
          _meta: { ui: { prefersBorder: true } },
        },
      },
    ]);
  });

  it('reports a missing manifest rather than throwing — a project may have no apps', async () => {
    const { apps, missing, manifestPath } = await loadPackedApps(dir);
    expect(missing).toBe(true);
    expect(apps).toEqual([]);
    expect(manifestPath).toBe(join(dir, 'manifest.json'));
  });

  it('refuses a manifest that is not valid JSON', async () => {
    await writeFile(join(dir, 'manifest.json'), '{ not json');
    await expect(loadPackedApps(dir)).rejects.toThrow(/is not valid JSON[\s\S]*litro mcp-app build/);
  });

  it('refuses a manifest that is not an array', async () => {
    await writeFile(join(dir, 'manifest.json'), '{"apps":[]}');
    await expect(loadPackedApps(dir)).rejects.toThrow(/should be an array of app entries/);
  });

  it('refuses a manifest whose document is missing — half a set is not a set', async () => {
    await good();
    await rm(join(dir, 'weather', 'card.html'));
    await expect(loadPackedApps(dir)).rejects.toThrow(/lists app "weather\/card" but .*card\.html is missing/);
  });

  it('refuses a manifest whose descriptor is missing', async () => {
    await good();
    await rm(join(dir, 'weather', 'card.json'));
    await expect(loadPackedApps(dir)).rejects.toThrow(/card\.json is missing or unreadable/);
  });
});

describe('resolveApp', () => {
  const apps = fixtureApps();

  it('matches a manifest entry name', () => {
    expect(resolveApp(apps, 'weather-card')?.descriptor.uri).toBe('ui://fixture/weather-card');
  });

  it('matches a literal ui:// address', () => {
    expect(resolveApp(apps, 'ui://fixture/weather-card')?.name).toBe('weather-card');
  });

  it('does not match a name against an address, or the other way round', () => {
    expect(resolveApp(apps, 'ui://fixture/nope')).toBeUndefined();
    expect(resolveApp(apps, 'nope')).toBeUndefined();
  });
});
