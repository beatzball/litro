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

  it('accepts an app with NO uri, because the packer supplies one', () => {
    // A widening, and the reason this is decidable only at build time: an
    // absent uri here is not yet a missing address.
    expect(() => defineMcpApp({ shell })).not.toThrow();
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

describe('where the uri comes from', () => {
  it('uses the build-time uri when the app declares none', async () => {
    const { descriptor } = await buildMcpAppDocument(defineMcpApp({ shell }), {
      uri: 'ui://playground/weather-card',
    });

    expect(descriptor.uri).toBe('ui://playground/weather-card');
    expect(descriptor.name).toBe('weather-card');
  });

  it("keeps the app's own uri when it has one", async () => {
    // A FALLBACK, not an override — which is what makes this change cost an
    // existing project no edits: every declared address survives untouched.
    const { descriptor } = await buildMcpAppDocument(
      defineMcpApp({ uri: 'ui://mine/card', shell }),
      { uri: 'ui://derived/elsewhere' },
    );

    expect(descriptor.uri).toBe('ui://mine/card');
  });

  it('titles the document with the resolved uri when there is no title', async () => {
    const { html: doc } = await buildMcpAppDocument(defineMcpApp({ shell }), {
      uri: 'ui://playground/weather-card',
    });

    expect(doc).toContain('<title>ui://playground/weather-card</title>');
  });

  it('refuses to build an app with no uri from either side', async () => {
    await expect(buildMcpAppDocument(defineMcpApp({ shell }))).rejects.toThrow(
      /has no "uri" and none was supplied/,
    );
  });

  it('validates a build-time uri to the same standard as a declared one', async () => {
    // The check moved out of defineMcpApp, so it has to still be somewhere.
    await expect(
      buildMcpAppDocument(defineMcpApp({ shell }), { uri: 'http://weather/card' }),
    ).rejects.toThrow(/must start with "ui:\/\//);
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

describe('escaping into inline scripts', () => {
  // `</script` alone is not enough. Inside a script element `<!--` moves the
  // HTML tokenizer into "script data escaped" state, and a following `<script`
  // moves it into "script data double escaped", where `</script>` NO LONGER
  // CLOSES THE ELEMENT. Source carrying both would swallow the rest of the
  // document and the build would report success while shipping a dead file.
  it.each(['runtime', 'apply'] as const)(
    'REFUSES %s containing <!-- or <script rather than rewriting it',
    async (key) => {
      // Rewriting was the first attempt and it corrupts author code: `\\/` is the
      // right escape for `/` in a string AND a regex, but `\\s` is not — a
      // rewritten `/<script/` becomes `/<\\script/`, which matches "< cript".
      // `/<\\!--/u` is a SyntaxError outright. Refusing is the honest option.
      await expect(
        buildMcpAppDocument(defineMcpApp({ uri: 'ui://a/b', shell, [key]: 'var s = "<!-- x";' })),
      ).rejects.toThrow(/cannot be inlined safely/);

      await expect(
        buildMcpAppDocument(defineMcpApp({ uri: 'ui://a/b', shell, [key]: 'var re = /<script/;' })),
      ).rejects.toThrow(/cannot be inlined safely/);
    },
  );

  it('names the offending config key and both sequences', async () => {
    await expect(
      buildMcpAppDocument(
        defineMcpApp({ uri: 'ui://a/b', shell, runtime: 'var s = "<!-- <script>";' }),
      ),
    ).rejects.toThrow(/"runtime" contains <!-- and <script/);
  });

  it('still rewrites </script, where the escape is correct in both contexts', async () => {
    const { html: doc } = await buildMcpAppDocument(
      defineMcpApp({ uri: 'ui://a/b', shell, runtime: 'var s = "</script>";' }),
    );
    expect(doc).toContain('<\\/script>');
    expect(doc.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('escapes < as \\u003c in the app metadata JSON, needing no assumption', async () => {
    // Unlike the source case, JSON can always be escaped safely: \\u003c is
    // valid JSON anywhere, so no <!--, <script or </script sequence can reach
    // the tokenizer at all.
    const { html: doc } = await buildMcpAppDocument(
      defineMcpApp({ uri: 'ui://a/b', shell, name: '</script><!-- <script>' }),
    );

    expect(doc).toContain('\\u003c/script');
    expect(doc).not.toContain('window.__litroMcpApp = {"name":"</script>');
    expect(doc.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('still lets ordinary source through unchanged', async () => {
    const { html: doc } = await buildMcpAppDocument(
      defineMcpApp({ uri: 'ui://a/b', shell, runtime: 'var a = 1 < 2;' }),
    );
    expect(doc).toContain('var a = 1 < 2;');
  });
});
