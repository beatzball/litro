import { describe, it, expect, vi } from 'vitest';
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

  it('accepts any non-empty string for domain, because its format belongs to the host', () => {
    // No hostname rule is applied: the spec leaves format and validation to
    // each host, so a check here would refuse values some host accepts.
    expect(() => defineMcpApp({ uri: 'ui://a/b', shell, domain: 'a904794854a047f6.example.com' })).not.toThrow();
  });

  it.each<[unknown, string]>([
    ['', 'empty'],
    [42, 'a number'],
    [null, 'null'],
  ])('rejects %j for domain (%s)', (domain) => {
    expect(() => defineMcpApp({ uri: 'ui://a/b', shell, domain: domain as string })).toThrow(
      /"domain" must be a non-empty string/,
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

  it('writes domain to _meta.ui.domain, next to csp', async () => {
    const { descriptor } = await buildMcpAppDocument(
      defineMcpApp({ uri: 'ui://weather/card', shell, domain: 'weather-card.example.com' }),
    );
    expect(descriptor._meta.ui.domain).toBe('weather-card.example.com');
  });

  it('omits domain when it is not set, so the host keeps its default origin', async () => {
    const { descriptor } = await buildMcpAppDocument(defineMcpApp({ uri: 'ui://a/b', shell }));
    expect('domain' in descriptor._meta.ui).toBe(false);
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

describe('runtime and apply are strings, so this is the only check they get', () => {
  it('refuses a runtime that does not parse', async () => {
    // Nothing type-checks or lints a string. In a host a SyntaxError kills the
    // whole script tag at load, and the view simply never fills — no error
    // anyone sees, and a build that reported success.
    await expect(
      buildMcpAppDocument(defineMcpApp({ uri: 'ui://a/b', shell, runtime: 'function ( {' })),
    ).rejects.toThrow(/"runtime" is not valid JavaScript/);
  });

  it('refuses an apply that does not parse', async () => {
    await expect(
      buildMcpAppDocument(defineMcpApp({ uri: 'ui://a/b', shell, apply: 'function (el, {' })),
    ).rejects.toThrow(/"apply" is not valid JavaScript/);
  });

  it('accepts a bare function expression for apply, which is how it is inlined', async () => {
    // `apply` becomes the right-hand side of an assignment, so it must parse as
    // an EXPRESSION — a bare `function (…) {}` is a declaration on its own and
    // would be rejected without the parenthesis wrap.
    await expect(
      buildMcpAppDocument(
        defineMcpApp({ uri: 'ui://a/b', shell, apply: 'function (el, data) { el.x = data; }' }),
      ),
    ).resolves.toBeTruthy();
  });

  it('accepts an apply that ends in a line comment', async () => {
    // The parenthesis wrap used to put its closing paren INSIDE the comment,
    // so a perfectly valid apply was refused. The real inline form — an
    // assignment terminated by a semicolon on the next line — never had the
    // problem, which is how it went unnoticed.
    await expect(
      buildMcpAppDocument(
        defineMcpApp({ uri: 'ui://a/b', shell, apply: '(el, d) => { el.x = d; } // set it' }),
      ),
    ).resolves.toBeTruthy();
  });

  it('accepts an arrow function for apply too', async () => {
    await expect(
      buildMcpAppDocument(defineMcpApp({ uri: 'ui://a/b', shell, apply: '(el, d) => { el.x = d; }' })),
    ).resolves.toBeTruthy();
  });

  it('does not RUN the source, only parses it', async () => {
    // A parse must not execute author code at build time. `throw` at top level
    // parses fine and would be loud if it ran.
    await expect(
      buildMcpAppDocument(
        defineMcpApp({ uri: 'ui://a/b', shell, runtime: 'throw new Error("author code ran");' }),
      ),
    ).resolves.toBeTruthy();
  });
});

describe('replacing the fill step from runtime says so', () => {
  // The bridge's default fill refuses innerHTML, srcdoc and on* in a tool
  // result. It only runs if nobody replaced it — and `runtime` is inlined
  // BEFORE the bridge, so this silently removes that protection. A custom
  // `apply` does the same thing but declares itself by existing; this route
  // does not, which is why it is called out.
  const build = (runtime: string) =>
    buildMcpAppDocument(defineMcpApp({ uri: 'ui://a/b', shell, runtime }));

  it.each([
    // In a browser `window`, `globalThis` and `self` are the same object, and
    // the property can be reached by dot, by bracket, or through a local alias.
    // A review found the first version knew only the `window.` spelling, so the
    // deny list could be replaced in silence three other ways.
    'window.litroMcpApply = function (el, d) {};',
    'globalThis.litroMcpApply = function (el, d) {};',
    'self.litroMcpApply = function (el, d) {};',
    "window['litroMcpApply'] = function (el, d) {};",
    'var w = window; w.litroMcpApply = function (el, d) {};',
    'window.litroMcpApply ??= function (el, d) {};',
    'litroMcpApply = function (el, d) {};',
    'window.litroMcpApply=function(){}',
  ])('warns for %s', async (runtime) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await build(runtime);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/REPLACES the bridge/));
    warn.mockRestore();
  });

  it('warns rather than refusing, because it is a legitimate thing to do', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(build('window.litroMcpApply = function (el, d) {};')).resolves.toBeTruthy();
    warn.mockRestore();
  });

  it('stays quiet when the runtime only READS it, or names something else', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await build('if (window.litroMcpApply) { window.litroMcpApply(document.body, {}); }');
    await build("if (window['litroMcpApply']) {}");
    await build('var myLitroMcpApply = 1;');
    await build('window.litroMcpApply === undefined;');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('stays quiet for a COMMENT about the assignment', async () => {
    // A warning that fires on a note about the thing weakens the one that fires
    // on the thing. Comments are stripped before matching; a string literal
    // that mentions the name still warns, and the docs say so.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await build('// window.litroMcpApply = fn\nvar a = 1;');
    await build('/* window.litroMcpApply = fn */ var a = 1;');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
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
