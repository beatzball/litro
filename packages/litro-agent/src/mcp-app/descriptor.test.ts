import { describe, it, expect } from 'vitest';
import { html } from 'lit';
import { defineMcpApp, buildMcpAppDocument, nameFromUri } from './index.js';

const shell = html`<weather-card></weather-card>`;

describe('nameFromUri', () => {
  it.each([
    ['ui://playground/weather-card', 'weather-card'],
    ['ui://weather', 'weather'],
    ['ui://a/b/c', 'c'],
    ['ui://a/b/', 'b'],
    ['ui://a/b?x=1', 'b'],
  ])('%s -> %s', (uri, expected) => {
    expect(nameFromUri(uri)).toBe(expected);
  });
});

describe('the descriptor is a valid MCP Resource', () => {
  // The base MCP `Resource` type requires `uri` AND `name`; only title,
  // description, mimeType and size are optional. The docs tell a server to load
  // <name>.json and forward it verbatim into resources/list, so a descriptor
  // without `name` produces a schema-invalid response. The original tests
  // asserted on uri, mimeType and _meta.ui only, and so never noticed.
  it('always carries a name, derived from the uri by default', async () => {
    const { descriptor } = await buildMcpAppDocument(
      defineMcpApp({ uri: 'ui://playground/weather-card', shell }),
    );

    expect(descriptor.name).toBe('weather-card');
    expect(descriptor).toEqual({
      uri: 'ui://playground/weather-card',
      name: 'weather-card',
      mimeType: 'text/html;profile=mcp-app',
      _meta: { ui: {} },
    });
  });

  it('honours an explicit name', async () => {
    const { descriptor } = await buildMcpAppDocument(
      defineMcpApp({ uri: 'ui://playground/weather-card', shell, name: 'Weather forecast' }),
    );
    expect(descriptor.name).toBe('Weather forecast');
  });
});

describe('the document carries the app metadata the bridge needs', () => {
  it('writes name, version and display modes ahead of the bridge', async () => {
    const { html: doc } = await buildMcpAppDocument(
      defineMcpApp({
        uri: 'ui://playground/weather-card',
        shell,
        version: '2.1.0',
        displayModes: ['inline', 'fullscreen'],
      }),
    );

    expect(doc).toContain('window.__litroMcpApp = ');
    expect(doc).toContain('"name":"weather-card"');
    expect(doc).toContain('"version":"2.1.0"');
    expect(doc).toContain('"displayModes":["inline","fullscreen"]');

    // Order matters: the bridge reads the global at evaluation time.
    expect(doc.indexOf('window.__litroMcpApp')).toBeLessThan(doc.indexOf("request('ui/initialize'"));
  });

  it('defaults version and display modes', async () => {
    const { html: doc } = await buildMcpAppDocument(defineMcpApp({ uri: 'ui://a/b', shell }));
    expect(doc).toContain('"version":"0.0.0"');
    expect(doc).toContain('"displayModes":["inline"]');
  });
});
