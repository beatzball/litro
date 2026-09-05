/**
 * The self-containment check, against the ways review got past it.
 *
 * A false NEGATIVE here is the worst outcome the packager has: the document
 * ships, the host blocks the fetch under `default-src 'none'`, and there is no
 * console and no host error — just a card that renders wrong. Every case below
 * is one a reviewer actually ran and got the wrong answer from.
 */
import { describe, it, expect } from 'vitest';
import { findExternalRefs, decodeEntities, assertSelfContained } from './external-urls.js';

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

  it('@import with an UNQUOTED url, which used to pass', () => {
    // The regex only captured quoted forms. CSS allows both, so a document with
    // this packed clean and then failed silently inside the host.
    expect(findExternalRefs('@import url(https://cdn.example.com/style.css);')).toHaveLength(1);
    expect(findExternalRefs('@import https://cdn.example.com/style.css;')).toHaveLength(1);
  });

  it('@import with quotes, and reports it once rather than twice', () => {
    // `@import url("x")` matches both the url() rule and the @import rule.
    expect(findExternalRefs('@import url("https://x.test/a.css");')).toHaveLength(1);
  });

  it('srcset, where every candidate is a real fetch', () => {
    // Never scanned before: only `src` and `<link href>` were. A responsive
    // image pointing at the network sailed straight through.
    const refs = findExternalRefs(
      '<img src="a.png" srcset="https://evil.test/x.png 1x, https://evil.test/y.png 2x">',
    );
    expect(refs).toHaveLength(2);
    expect(refs.every((r) => r.kind === 'srcset')).toBe(true);
  });

  it('an HTML-entity-encoded scheme, which the browser decodes before fetching', () => {
    // `&#104;` is `h`. The check matched only the literal text `http`, so this
    // read as a relative path and passed.
    expect(findExternalRefs('<img src="&#104;ttps://evil.test/a.png">')).toHaveLength(1);
    expect(findExternalRefs('<img src="&#x68;ttps://evil.test/a.png">')).toHaveLength(1);
  });

  it('object data and video poster', () => {
    expect(findExternalRefs('<object data="https://x.test/a.swf"></object>')).toHaveLength(1);
    expect(findExternalRefs('<video poster="https://x.test/p.jpg"></video>')).toHaveLength(1);
  });

  it('iframe, embed, video, audio, source and track, all via the generic src rule', () => {
    for (const tag of ['iframe', 'embed', 'video', 'audio', 'source', 'track']) {
      expect(findExternalRefs(`<${tag} src="https://x.test/a">`)).toHaveLength(1);
    }
  });

  it('a css url()', () => {
    expect(findExternalRefs('a { background: url(https://x.test/a.png) }')).toHaveLength(1);
  });
});

describe('what must NOT be caught', () => {
  it('an anchor href — a link is a navigation, not a subresource load', () => {
    expect(findExternalRefs('<a href="https://example.com">docs</a>')).toEqual([]);
  });

  it('data: URIs, which is how images are meant to travel', () => {
    expect(findExternalRefs('<img src="data:image/png;base64,iVBORw0KGgo=">')).toEqual([]);
    expect(findExternalRefs('a { background: url(data:image/gif;base64,R0lGOD) }')).toEqual([]);
  });

  it('a relative src', () => {
    expect(findExternalRefs('<img src="./local.png">')).toEqual([]);
  });

  it('a URL inside a script body, which is text and not a load', () => {
    // This used to FAIL THE BUILD: the check ran over the whole document as raw
    // text, so a JS variable named `src` killed the pack with a misleading
    // error. `runtime` and `apply` are exactly where that happens.
    expect(
      findExternalRefs('<script>var src = "https://api.example.com/data"; fetch(src);</script>'),
    ).toEqual([]);
    expect(findExternalRefs('<script>var o = { src: "https://a.test/x" };</script>')).toEqual([]);
  });

  it('but still catches a src attribute ON the script tag itself', () => {
    expect(
      findExternalRefs('<script src="https://cdn.test/a.js">var x = 1;</script>'),
    ).toHaveLength(1);
  });

  it('and still catches a url() inside a style block, which IS a load', () => {
    expect(findExternalRefs('<style>a { background: url(https://x.test/a.png) }</style>')).toHaveLength(1);
  });
});

describe('decodeEntities', () => {
  it.each([
    ['&#104;ttp', 'http'],
    ['&#x68;ttp', 'http'],
    ['&amp;', '&'],
    ['&colon;', ':'],
    ['plain', 'plain'],
    ['&notanentity;', '&notanentity;'],
  ])('%s -> %s', (input, expected) => {
    expect(decodeEntities(input)).toBe(expected);
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
