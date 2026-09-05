import { describe, it, expect } from 'vitest';
import { html } from 'lit';
import {
  defineMcpApp,
  buildMcpAppDocument,
  MCP_APP_MIME_TYPE,
  MCP_APPS_SPEC_VERSION,
} from './index.js';

const shell = html`<weather-card></weather-card>`;

describe('defineMcpApp', () => {
  it('accepts a ui:// uri and a shell', () => {
    expect(() => defineMcpApp({ uri: 'ui://weather/card', shell })).not.toThrow();
  });

  it.each([
    ['http://weather/card', 'wrong scheme'],
    ['ui://', 'nothing after the scheme'],
    ['weather/card', 'no scheme'],
  ])('rejects %s (%s)', (uri) => {
    expect(() => defineMcpApp({ uri, shell })).toThrow(/must start with "ui:\/\/"/);
  });

  it('rejects a missing shell', () => {
    expect(() => defineMcpApp({ uri: 'ui://a/b', shell: undefined })).toThrow(/"shell" is required/);
  });

  it('rejects a function for apply, because its closure would be silently dropped', () => {
    const fn = ((el: unknown, data: unknown) => Object.assign(el as object, data as object)) as unknown;
    expect(() => defineMcpApp({ uri: 'ui://a/b', shell, apply: fn as string })).toThrow(
      /must be browser SOURCE as a string/,
    );
  });
});

describe('buildMcpAppDocument', () => {
  it('emits one complete HTML5 document carrying the shell and the bridge', async () => {
    const { html: doc } = await buildMcpAppDocument(
      defineMcpApp({ uri: 'ui://weather/card', shell, title: 'Weather' }),
    );

    expect(doc.startsWith('<!doctype html>')).toBe(true);
    expect(doc.match(/<html>/g)).toHaveLength(1);
    expect(doc).toContain('<title>Weather</title>');
    expect(doc).toContain('weather-card');
    // The bridge is present and is what performs the handshake.
    expect(doc).toContain("request('ui/initialize'");
    expect(doc).toContain('ui/notifications/tool-result');
  });

  it('renders the shell with no data, because a ui:// resource is a cached template', async () => {
    const { html: doc } = await buildMcpAppDocument(
      defineMcpApp({ uri: 'ui://weather/card', shell: html`<weather-card></weather-card>` }),
    );
    // Nothing tool-specific may be baked in: the host caches this across calls.
    expect(doc).not.toContain('tempC');
  });

  it('builds a descriptor with the exact spec mime type and nested _meta.ui only', async () => {
    const { descriptor } = await buildMcpAppDocument(
      defineMcpApp({
        uri: 'ui://weather/card',
        shell,
        csp: { connectDomains: ['https://api.example.com'] },
        prefersBorder: true,
      }),
    );

    expect(descriptor.uri).toBe('ui://weather/card');
    expect(descriptor.mimeType).toBe('text/html;profile=mcp-app');
    expect(descriptor.mimeType).toBe(MCP_APP_MIME_TYPE);
    expect(descriptor._meta.ui.csp).toEqual({ connectDomains: ['https://api.example.com'] });
    expect(descriptor._meta.ui.prefersBorder).toBe(true);
    // The flat form is deprecated and removed before GA — never emit it.
    expect(JSON.stringify(descriptor)).not.toContain('ui/resourceUri');
  });

  it('leaves _meta.ui empty when nothing is declared', async () => {
    const { descriptor } = await buildMcpAppDocument(defineMcpApp({ uri: 'ui://a/b', shell }));
    expect(descriptor._meta.ui).toEqual({});
  });

  it('pins the spec version it emits for', () => {
    expect(MCP_APPS_SPEC_VERSION).toBe('2026-01-26');
  });

  it('escapes the title so it cannot break out of the tag', async () => {
    const { html: doc } = await buildMcpAppDocument(
      defineMcpApp({ uri: 'ui://a/b', shell, title: '</title><script>x()</script>' }),
    );
    expect(doc).not.toContain('<title></title>');
    expect(doc).toContain('&lt;/title&gt;');
  });

  it('neutralises a closing script tag inside inlined runtime source', async () => {
    const { html: doc } = await buildMcpAppDocument(
      defineMcpApp({ uri: 'ui://a/b', shell, runtime: 'var s = "</script><b>escaped</b>";' }),
    );
    // The text survives, but inside the JS string where it belongs — what must
    // not survive is a real closing tag that would end the script element early.
    expect(doc).toContain('<\\/script><b>escaped</b>');
    expect(doc).not.toContain('</script><b>escaped</b>');
  });

  it('installs a custom apply as window.litroMcpApply', async () => {
    const { html: doc } = await buildMcpAppDocument(
      defineMcpApp({ uri: 'ui://a/b', shell, apply: 'function (el, d) { el.value = d.value; }' }),
    );
    expect(doc).toContain('window.litroMcpApply = function (el, d)');
  });
});

describe('self-containment', () => {
  it('refuses a document that loads a stylesheet from outside', async () => {
    await expect(
      buildMcpAppDocument(
        defineMcpApp({
          uri: 'ui://a/b',
          shell: html`<link rel="stylesheet" href="https://cdn.example.com/x.css" />`,
        }),
      ),
    ).rejects.toThrow(/loads 1 resource\(s\) from outside/);
  });

  // The unit-level rules live in external-urls.test.ts, which carries the full
  // set of evasions review found. What is pinned HERE is that the assertion is
  // actually wired into buildMcpAppDocument and reports every offender.
  it('names every offender in the error, not just the first', async () => {
    await expect(
      buildMcpAppDocument(
        defineMcpApp({
          uri: 'ui://a/b',
          shell: html`<link rel="stylesheet" href="https://a.test/1.css" />`,
          styles: 'a { background: url(https://b.test/2.png) }',
        }),
      ),
    ).rejects.toThrow(/loads 2 resource\(s\) from outside/);
  });
});
