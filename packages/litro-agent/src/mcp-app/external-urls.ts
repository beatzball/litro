/**
 * The self-containment check for an MCP App document.
 *
 * The spec requires one complete HTML5 document with no external URL for its
 * content, and the host's default CSP is `default-src 'none'` — so anything the
 * page tries to fetch fails SILENTLY inside the iframe. There is no console the
 * author will see and no error the host reports. A missing stylesheet just
 * renders as an unstyled card.
 *
 * That silence is why this is an assertion at pack time and not a warning, and
 * it is also why a FALSE NEGATIVE is the worst outcome available here: a
 * document that should have failed the build instead ships and quietly renders
 * wrong.
 *
 * WHY THIS PARSES INSTEAD OF MATCHING
 *
 * The first two versions scanned the raw text with regexes, and review got past
 * them nine ways. Each fix was another alternation, and the last one — blanking
 * `<script>` bodies so a JS variable named `src` would stop failing the build —
 * opened a worse hole than it closed: a literal `<script>` inside an HTML
 * comment or an attribute value began a blanking region that swallowed every
 * real load until the next `</script>`.
 *
 * That was a regex being asked to do a parser's job. `parse5` implements the
 * HTML spec's own parsing, so comments, attribute values containing `>`,
 * entity-encoded schemes, raw-text elements and namespaces are all settled at
 * once — and a script body is simply not an attribute, so the false positive
 * that started the whole detour cannot occur.
 */
import { parse } from 'parse5';
import { AgentError } from '../errors.js';

/** An external reference found in a document, with enough context to fix it. */
export interface ExternalRef {
  kind:
    | 'src'
    | 'srcset'
    | 'link-href'
    | 'object-data'
    | 'poster'
    | 'base-href'
    | 'svg-href'
    | 'css-url'
    | 'css-import';
  url: string;
}

/**
 * A base that is itself a "special" scheme, so the WHATWG parser applies the
 * http/https rules — backslash-as-separator among them — when resolving against
 * it. `.invalid` is reserved by RFC 2606 and can never be a real host.
 */
const SELF_BASE = 'https://mcp-app.invalid/';
const SELF_HOST = 'mcp-app.invalid';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface Attr {
  name: string;
  value: string;
  prefix?: string;
}

interface Node {
  nodeName: string;
  tagName?: string;
  namespaceURI?: string;
  attrs?: Attr[];
  childNodes?: Node[];
  content?: Node;
  value?: string;
}

/**
 * Resolves a URL the way a browser does, then asks whether it left the document.
 *
 * This does NOT pattern-match, and the reason is that every pattern tried so far
 * has been wrong. A prefix test for `http://` or `//` misses, at minimum:
 *
 *   - `https:\\evil.test\a.png` — for special schemes the WHATWG parser treats
 *     a backslash exactly as a slash, so this fetches from evil.test
 *   - `\u0000https://evil.test/a.png` — the parser strips leading and trailing
 *     C0 controls, not merely tab/newline/return
 *
 * Both were demonstrated against the previous version. `new URL()` is the same
 * algorithm the browser runs, so it settles the whole class rather than two more
 * members of it.
 *
 * Anything that is not http(s) after resolution — `data:`, `blob:`, a fragment —
 * loads nothing from the network and is not our business.
 */
function isExternal(url: string): boolean {
  try {
    const resolved = new URL(url, SELF_BASE);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return false;
    return resolved.host !== SELF_HOST;
  } catch {
    // Unparseable is unfetchable.
    return false;
  }
}

/** What the browser will actually request, for the error message. */
function normalise(url: string): string {
  try {
    return new URL(url, SELF_BASE).href;
  } catch {
    return url.trim();
  }
}

function attrOf(node: Node, name: string): string | undefined {
  return node.attrs?.find((a) => a.name === name)?.value;
}

/** Every URL in a `srcset` / `imagesrcset` list, without its descriptor. */
function srcsetUrls(value: string): string[] {
  return value
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/)[0] ?? '')
    .filter(Boolean);
}

/**
 * Resolves CSS escapes, which a real tokenizer does before it fetches.
 *
 * `url(\68 ttps://evil.test/a.png)` reads as `url(https://evil.test/a.png)` to a
 * browser: `\68` is the escape for U+0068 `h`, and one trailing whitespace
 * terminates it. Confirmed against `css-tree`, which produces the decoded URL.
 * Testing the raw text read it as relative and let it through.
 */
export function decodeCssEscapes(css: string): string {
  return css.replace(
    /\\(?:([0-9a-fA-F]{1,6})[ \t\n\r\f]?|([\s\S]))/g,
    (match, hex: string | undefined, chr: string | undefined) => {
      if (hex !== undefined) {
        const code = Number.parseInt(hex, 16);
        // Zero and lone surrogates become U+FFFD, per the CSS tokenizer.
        if (!Number.isFinite(code) || code === 0 || (code >= 0xd800 && code <= 0xdfff) || code > 0x10ffff) {
          return '�';
        }
        return String.fromCodePoint(code);
      }
      return chr ?? match;
    },
  );
}

/** `url(...)` and `@import` inside a CSS string. */
function cssRefs(css: string): ExternalRef[] {
  const found: ExternalRef[] = [];
  const imported = new Set<string>();

  const consider = (raw: string, kind: ExternalRef['kind']): void => {
    const url = decodeCssEscapes(raw);
    if (!isExternal(url)) return;
    const href = normalise(url);
    if (kind === 'css-url' && imported.has(href)) return;
    if (kind === 'css-import') imported.add(href);
    found.push({ kind, url: href });
  };

  // `\s*` before a quote, not `\s+`: a quote always begins a new token in CSS,
  // so `@import"x";` is valid and identical to `@import "x";` — verified with
  // css-tree. Demanding whitespace let that form through untouched. The bare
  // unquoted form below does still need a separator.
  for (const m of css.matchAll(/@import\s*(?:url\(\s*)?(?:"([^"]*)"|'([^']*)')/gi)) {
    consider(m[1] ?? m[2] ?? '', 'css-import');
  }
  for (const m of css.matchAll(/@import\s+(?!["'])(?:url\(\s*)?([^;\s)]+)/gi)) {
    consider(m[1] ?? '', 'css-import');
  }

  // `image-set()` is a comma-separated list of `url()`s, so this sweep already
  // covers its members. Named here so it does not read as an oversight.
  for (const m of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) {
    consider(m[1] ?? m[2] ?? m[3] ?? '', 'css-url');
  }

  return found;
}

function walk(node: Node, found: ExternalRef[]): void {
  const tag = node.tagName;

  if (tag) {
    const push = (kind: ExternalRef['kind'], value: string | undefined) => {
      if (value !== undefined && isExternal(value)) found.push({ kind, url: normalise(value) });
    };

    // `src` is not tag-specific on purpose: img, iframe, embed, video, audio,
    // source, track and script all load through it.
    push('src', attrOf(node, 'src'));
    if (tag === 'object') push('object-data', attrOf(node, 'data'));
    push('poster', attrOf(node, 'poster'));
    if (tag === 'link') push('link-href', attrOf(node, 'href'));

    // `<base href>` rewrites how every relative URL in the document resolves,
    // so one external base quietly sends the whole page off-origin while no
    // other attribute in the document looks wrong.
    if (tag === 'base') push('base-href', attrOf(node, 'href'));

    for (const list of ['srcset', 'imagesrcset']) {
      const value = attrOf(node, list);
      if (value) for (const url of srcsetUrls(value)) push('srcset', url);
    }

    // `srcdoc` is a whole nested HTML document. The browser parses it and
    // renders it in its own browsing context, so every load inside it is real
    // — but it arrives here as one opaque attribute string, which is exactly
    // why none of the attribute checks above could ever see it.
    const srcdoc = attrOf(node, 'srcdoc');
    if (srcdoc) walk(parse(srcdoc) as unknown as Node, found);

    // SVG loads through `href` and the legacy `xlink:href` on <image> and <use>.
    // An <a> is a navigation there too, so it stays exempt.
    if (node.namespaceURI === SVG_NS && tag !== 'a') {
      push('svg-href', attrOf(node, 'href'));
      push('svg-href', node.attrs?.find((a) => a.prefix === 'xlink' && a.name === 'href')?.value);
    }

    const styleAttr = attrOf(node, 'style');
    if (styleAttr) found.push(...cssRefs(styleAttr));

    if (tag === 'style') {
      for (const child of node.childNodes ?? []) {
        if (child.nodeName === '#text' && child.value) found.push(...cssRefs(child.value));
      }
    }

    // A `<script>` body is code, not markup — its text is never fetched, so a
    // variable holding a URL is not a load. The old text scan could not tell,
    // and failed builds on `var src = "https://…"` in the very `runtime` and
    // `apply` sources this packager inlines.
    if (tag === 'script') return;

    // <template> content hangs off `content`, not `childNodes`.
    if (node.content) walk(node.content, found);
  }

  for (const child of node.childNodes ?? []) walk(child, found);
}

/**
 * Finds every reference that would leave the document.
 *
 * Deliberately NOT flagged: `href` on an anchor. A link is a navigation, not a
 * subresource load — the default CSP does not block it, and
 * `<a href="https://...">` is legitimate inside a view.
 */
export function findExternalRefs(html: string): ExternalRef[] {
  const found: ExternalRef[] = [];
  walk(parse(html) as unknown as Node, found);

  const seen = new Set<string>();
  return found.filter((r) => {
    const key = `${r.kind} ${r.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Throws unless `html` loads nothing from outside itself. */
export function assertSelfContained(html: string, uri: string): void {
  const refs = findExternalRefs(html);
  if (refs.length === 0) return;

  const list = refs.map((r) => `  ${r.kind}: ${r.url}`).join('\n');
  throw new AgentError(
    `The MCP App "${uri}" loads ${refs.length} resource(s) from outside the document:\n${list}\n` +
      'An MCP App must be one self-contained HTML5 document. The host serves it under ' +
      "`default-src 'none'`, so these fail silently in the iframe — no error, just missing " +
      'content. Inline the CSS and JS, and embed images as data: URIs.',
    { status: 500 },
  );
}
