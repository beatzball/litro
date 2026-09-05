/**
 * The self-containment check, against every way review got past it.
 *
 * A false NEGATIVE here is the worst outcome the packager has: the document
 * ships, the host blocks the fetch under `default-src 'none'`, and there is no
 * console and no host error — just a card that renders wrong. Two regex
 * versions of this check leaked nine ways between them. Each case below is one
 * a reviewer actually ran and got the wrong answer from.
 */
import { describe, it, expect } from 'vitest';
import { findExternalRefs, assertSelfContained, decodeCssEscapes } from './external-urls.js';

describe('what must be caught', () => {
  it('an external script src', () => {
    expect(findExternalRefs('<script src="https://cdn.example.com/lit.js"></script>')).toEqual([
      { kind: 'src', url: 'https://cdn.example.com/lit.js' },
    ]);
  });

  it('a protocol-relative url', () => {
    expect(findExternalRefs('<img src="//cdn.example.com/a.png">')).toHaveLength(1);
  });

  it('an external stylesheet link', () => {
    expect(findExternalRefs('<link rel="stylesheet" href="https://x.test/a.css">')).toHaveLength(1);
  });

  it('@import, quoted and unquoted, reported once each', () => {
    expect(findExternalRefs('<style>@import url(https://x.test/a.css);</style>')).toHaveLength(1);
    expect(findExternalRefs('<style>@import "https://x.test/b.css";</style>')).toHaveLength(1);
    expect(findExternalRefs('<style>@import url("https://x.test/c.css");</style>')).toHaveLength(1);
  });

  it('srcset and imagesrcset, every candidate in the list', () => {
    const refs = findExternalRefs(
      '<img src="a.png" srcset="https://evil.test/x.png 1x, https://evil.test/y.png 2x">',
    );
    expect(refs).toHaveLength(2);
    expect(findExternalRefs('<link imagesrcset="https://evil.test/z.png 1x">')).toHaveLength(1);
  });

  it('an entity-encoded scheme, which the browser decodes before fetching', () => {
    expect(findExternalRefs('<img src="&#104;ttps://evil.test/a.png">')).toHaveLength(1);
    expect(findExternalRefs('<img src="&#x68;ttps://evil.test/a.png">')).toHaveLength(1);
  });

  it('a scheme broken up by a tab or newline, which the browser strips', () => {
    expect(findExternalRefs('<img src="h&#9;ttps://evil.test/a.png">')).toHaveLength(1);
    expect(findExternalRefs('<img src="https:&#10;//evil.test/a.png">')).toHaveLength(1);
  });

  it('<base href>, which silently redirects every relative URL in the document', () => {
    expect(findExternalRefs('<base href="https://evil.test/">')).toEqual([
      { kind: 'base-href', url: 'https://evil.test/' },
    ]);
  });

  it('SVG href and the legacy xlink:href', () => {
    expect(
      findExternalRefs('<svg><image href="https://evil.test/a.png"></image></svg>'),
    ).toHaveLength(1);
    expect(
      findExternalRefs('<svg><use xlink:href="https://evil.test/a.svg#i"></use></svg>'),
    ).toHaveLength(1);
  });

  it('object data and video poster', () => {
    expect(findExternalRefs('<object data="https://x.test/a.swf"></object>')).toHaveLength(1);
    expect(findExternalRefs('<video poster="https://x.test/p.jpg"></video>')).toHaveLength(1);
  });

  it('iframe, embed, video, audio, source and track, via the generic src rule', () => {
    for (const tag of ['iframe', 'embed', 'video', 'audio', 'source', 'track']) {
      expect(findExternalRefs(`<${tag} src="https://x.test/a">`)).toHaveLength(1);
    }
  });

  it('a url() in a style attribute as well as a style block', () => {
    expect(findExternalRefs('<div style="background: url(https://x.test/a.png)"></div>')).toHaveLength(1);
    expect(findExternalRefs('<style>a { background: url(https://x.test/b.png) }</style>')).toHaveLength(1);
  });

  it('a load inside a <template>, whose content is off to the side of childNodes', () => {
    expect(findExternalRefs('<template><img src="https://x.test/a.png"></template>')).toHaveLength(1);
  });
});

describe('what the regex versions missed and a parser does not', () => {
  it('a load after a <script> mentioned inside an HTML comment', () => {
    // The script-body BLANKING regex began a region at the literal `<script>`
    // in the comment and ran to the next real `</script>`, swallowing the image.
    // Commenting out a script block is an ordinary edit to a shell.
    expect(
      findExternalRefs(
        '<!-- <script> -->\n<img src="https://evil.test/a.png">\n<script>var x = 1;</script>',
      ),
    ).toHaveLength(1);
  });

  it('a load after a <script> appearing inside an attribute value', () => {
    expect(
      findExternalRefs(
        '<div title="<script>"></div>\n<img src="https://evil.test/a.png">\n<script>var x = 1;</script>',
      ),
    ).toHaveLength(1);
  });

  it('a link whose earlier attribute value contains a >', () => {
    // `<link\b[^>]*>` truncated at the `>` inside the title and never saw href.
    expect(
      findExternalRefs('<link title="a > b" rel="stylesheet" href="https://x.test/a.css">'),
    ).toHaveLength(1);
  });
});

describe('what must NOT be caught', () => {
  it('an anchor href — a link is a navigation, not a subresource load', () => {
    expect(findExternalRefs('<a href="https://example.com">docs</a>')).toEqual([]);
  });

  it('an SVG anchor, for the same reason', () => {
    expect(findExternalRefs('<svg><a href="https://example.com"></a></svg>')).toEqual([]);
  });

  it('data: URIs, which is how images are meant to travel', () => {
    expect(findExternalRefs('<img src="data:image/png;base64,iVBORw0KGgo=">')).toEqual([]);
    expect(findExternalRefs('<style>a{background:url(data:image/gif;base64,R0lGOD)}</style>')).toEqual([]);
  });

  it('a relative src', () => {
    expect(findExternalRefs('<img src="./local.png">')).toEqual([]);
  });

  it('a URL inside a script body, which is text and not a load', () => {
    // This used to FAIL THE BUILD: a JS variable named `src`, which is ordinary
    // in the `runtime` and `apply` sources this packager inlines.
    expect(
      findExternalRefs('<script>var src = "https://api.example.com/data"; fetch(src);</script>'),
    ).toEqual([]);
    expect(findExternalRefs('<script>var o = { src: "https://a.test/x" };</script>')).toEqual([]);
    expect(
      findExternalRefs('<script>var s = "<img src=\\"https://a.test/x\\">";</script>'),
    ).toEqual([]);
  });

  it('but still catches a src attribute ON the script tag itself', () => {
    expect(findExternalRefs('<script src="https://cdn.test/a.js">var x = 1;</script>')).toHaveLength(1);
  });
});

describe('assertSelfContained', () => {
  it('names every offender, not just the first', () => {
    expect(() =>
      assertSelfContained(
        '<link href="https://a.test/1.css"><img srcset="https://b.test/2.png 1x">',
        'ui://a/b',
      ),
    ).toThrow(/loads 2 resource\(s\) from outside/);
  });

  it('passes a document that loads nothing', () => {
    expect(() => assertSelfContained('<p>hello</p>', 'ui://a/b')).not.toThrow();
  });
});

describe('the five bypasses an adversarial pass demonstrated', () => {
  // Each of these returned [] against the previous version while a browser
  // would fetch. They were confirmed by running the function and cross-checking
  // the URL with Node's WHATWG parser or the CSS with css-tree.

  it('1. a backslashed scheme, which WHATWG resolves exactly like slashes', () => {
    // new URL('https:\\\\evil.test\\a.png').href === 'https://evil.test/a.png'
    expect(findExternalRefs('<img src="https:\\\\evil.test\\a.png">')).toHaveLength(1);
    expect(findExternalRefs('<img src="\\\\\\\\evil.test\\a.png">')).toHaveLength(1);
  });

  it('2. a leading C0 control other than tab, newline or return', () => {
    // The URL parser strips ANY leading C0 control, not just those three.
    for (const control of ['\u0001', '\u0008', '\u000b', '\u000c', '\u001f']) {
      expect(findExternalRefs(`<img src="${control}https://evil.test/a.png">`)).toHaveLength(1);
    }
  });

  it('2b. …but NOT U+0000, which the HTML tokenizer replaces before the URL parser sees it', () => {
    // The report that started this led with U+0000, tested against `new URL()`
    // in isolation. Inside a document it is not a bypass: parse5 replaces NUL in
    // an attribute value with U+FFFD, exactly as the HTML spec requires and as a
    // browser does, so the value really is relative and nothing is fetched.
    expect(findExternalRefs('<img src="\u0000https://evil.test/a.png">')).toEqual([]);
  });

  it('3. a CSS hex escape standing in for the scheme', () => {
    // \\68 is U+0068 'h'; one trailing space ends the escape.
    expect(
      findExternalRefs('<style>a{background:url(\\68 ttps://evil.test/a.png)}</style>'),
    ).toHaveLength(1);
    expect(
      findExternalRefs('<style>a{background:url("\\68 ttps://evil.test/b.png")}</style>'),
    ).toHaveLength(1);
  });

  it('4. @import with no whitespace before the string', () => {
    // A quote always begins a new token in CSS, so this is valid and identical
    // to `@import "…"`.
    expect(findExternalRefs('<style>@import"https://evil.test/a.css";</style>')).toHaveLength(1);
    expect(findExternalRefs("<style>@import'https://evil.test/b.css';</style>")).toHaveLength(1);
  });

  it('5. a load inside an <iframe srcdoc>, which is a whole nested document', () => {
    expect(
      findExternalRefs('<iframe srcdoc="&lt;img src=&quot;https://evil.test/a.png&quot;&gt;"></iframe>'),
    ).toHaveLength(1);
    // And nested one level deeper, since srcdoc can carry another srcdoc.
    expect(
      findExternalRefs(
        '<iframe srcdoc="&lt;style&gt;@import&quot;https://evil.test/b.css&quot;;&lt;/style&gt;"></iframe>',
      ),
    ).toHaveLength(1);
  });
});

describe('URL resolution, now done by the same parser the browser uses', () => {
  it.each([
    ['./local.png', 'relative'],
    ['/absolute/path.png', 'root-relative'],
    ['#fragment', 'fragment only'],
    ['data:image/png;base64,iVBORw0KGgo=', 'data'],
    ['blob:https://mcp-app.invalid/abc', 'blob'],
  ])('treats %s (%s) as internal', (url) => {
    expect(findExternalRefs(`<img src="${url}">`)).toEqual([]);
  });

  it.each([
    'https://evil.test/a.png',
    'http://evil.test/a.png',
    '//evil.test/a.png',
    'HTTPS://EVIL.TEST/a.png',
    '  https://evil.test/a.png  ',
  ])('treats %s as external', (url) => {
    expect(findExternalRefs(`<img src="${url}">`)).toHaveLength(1);
  });

  it('reports the resolved URL, which is what the browser would actually request', () => {
    const [ref] = findExternalRefs('<img src="https:\\\\evil.test\\a.png">');
    expect(ref.url).toBe('https://evil.test/a.png');
  });

  it('does not choke on an unparseable value', () => {
    expect(() => findExternalRefs('<img src="ht~tp://[[[">')).not.toThrow();
  });
});

describe('decodeCssEscapes', () => {
  it.each([
    ['\\68 ttp', 'http'],
    ['\\000068ttp', 'http'],
    // CSS consumes up to six hex digits; `t` is not one, so this is h + "ttp".
    ['\\68ttp', 'http'],
    ['plain', 'plain'],
    ['\\\\', '\\'],
  ])('%s -> %s', (input, expected) => {
    expect(decodeCssEscapes(input)).toBe(expected);
  });

  it('maps a null escape to the replacement character, as the tokenizer does', () => {
    expect(decodeCssEscapes('\\0')).toBe('\uFFFD');
  });
});
