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
 * it is also why a FALSE NEGATIVE here is the worst outcome available: a
 * document that should have failed the build instead ships and quietly renders
 * wrong. Review found several, and each one has a case below.
 */
import { AgentError } from '../errors.js';

/** An external reference found in a document, with enough context to fix it. */
export interface ExternalRef {
  kind: 'src' | 'srcset' | 'link-href' | 'object-data' | 'poster' | 'css-url' | 'css-import';
  url: string;
}

/** Absolute http(s) or protocol-relative. `data:` and `blob:` are inline. */
const EXTERNAL = /^\s*(?:https?:)?\/\//i;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  sol: '/',
  colon: ':',
  Tab: '\t',
  NewLine: '\n',
};

/**
 * Decodes the HTML entities a browser would resolve before it fetches.
 *
 * Without this the check matches only the literal text `http://`, so
 * `src="&#104;ttps://evil.test/a.png"` reads as relative and passes — while the
 * browser decodes it and fetches. It does not take malice to hit: a templating
 * step or a copy-paste out of a CMS produces the same bytes.
 */
export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);?/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

function isExternal(raw: string): boolean {
  return EXTERNAL.test(decodeEntities(raw));
}

/**
 * Blanks out `<script>` bodies before scanning, keeping the tags so offsets and
 * any attributes on them are still seen.
 *
 * Script bodies are the one place a URL is text rather than a load. Scanning
 * them produced a false BUILD FAILURE on
 * `<script>var src = "https://api.example.com";</script>` — a variable named
 * `src`, which is ordinary in the `runtime` and `apply` sources this packager
 * inlines. `<style>` bodies are deliberately NOT blanked: a `url()` in there is
 * a real load.
 */
function blankScriptBodies(html: string): string {
  return html.replace(
    /(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)/gi,
    (_m, open: string, body: string, close: string) => open + ' '.repeat(body.length) + close,
  );
}

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : undefined;
}

/**
 * Finds every reference that would leave the document.
 *
 * Deliberately NOT flagged: `href` on an anchor. A link is a navigation, not a
 * subresource load — the default CSP does not block it, and `<a href="https://...">`
 * is legitimate inside a view. Only `<link>` loads a subresource through `href`.
 */
export function findExternalRefs(html: string): ExternalRef[] {
  const found: ExternalRef[] = [];
  const scanned = blankScriptBodies(html);

  // `src` is not tag-specific on purpose: it covers img, iframe, embed, video,
  // audio, source, track and script alike.
  for (const m of scanned.matchAll(/\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const url = m[1] ?? m[2] ?? m[3] ?? '';
    if (isExternal(url)) found.push({ kind: 'src', url: url.trim() });
  }

  // srcset is a comma-separated list of "url descriptor" pairs, and every URL in
  // it is a candidate fetch. Missing this let a responsive image reach the network.
  for (const m of scanned.matchAll(/\ssrcset\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const list = m[1] ?? m[2] ?? '';
    for (const candidate of list.split(',')) {
      const url = candidate.trim().split(/\s+/)[0] ?? '';
      if (url && isExternal(url)) found.push({ kind: 'srcset', url });
    }
  }

  for (const tag of scanned.matchAll(/<link\b[^>]*>/gi)) {
    const url = attr(tag[0], 'href');
    if (url !== undefined && isExternal(url)) found.push({ kind: 'link-href', url: url.trim() });
  }

  for (const tag of scanned.matchAll(/<object\b[^>]*>/gi)) {
    const url = attr(tag[0], 'data');
    if (url !== undefined && isExternal(url)) found.push({ kind: 'object-data', url: url.trim() });
  }

  for (const tag of scanned.matchAll(/<video\b[^>]*>/gi)) {
    const url = attr(tag[0], 'poster');
    if (url !== undefined && isExternal(url)) found.push({ kind: 'poster', url: url.trim() });
  }

  for (const m of scanned.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) {
    const url = m[1] ?? m[2] ?? m[3] ?? '';
    if (isExternal(url)) found.push({ kind: 'css-url', url: url.trim() });
  }

  // The third alternative is the unquoted form. CSS allows `@import url(x);` and
  // bare `@import x;`, and without it such a document packed clean and then
  // failed silently in the host.
  for (const m of scanned.matchAll(
    /@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)'|([^;\s)]+))/gi,
  )) {
    const url = m[1] ?? m[2] ?? m[3] ?? '';
    if (isExternal(url)) found.push({ kind: 'css-import', url: url.trim() });
  }

  return dedupe(found);
}

/** `@import url(x)` matches both the url() and the @import rule; report it once. */
function dedupe(refs: ExternalRef[]): ExternalRef[] {
  // `@import url(x)` matches the url() scan as well, and that scan runs
  // FIRST — so arrival order cannot decide which half of the pair to drop.
  // The set of imported URLs is therefore built up front.
  const importedUrls = new Set(refs.filter((r) => r.kind === 'css-import').map((r) => r.url));
  const seen = new Set<string>();

  return refs.filter((r) => {
    if (r.kind === 'css-url' && importedUrls.has(r.url)) return false;
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
