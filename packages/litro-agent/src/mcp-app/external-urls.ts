/**
 * The self-containment check for an MCP App document.
 *
 * The spec requires one complete HTML5 document with no external URL for its
 * content, and the host's default CSP is `default-src 'none'` — so anything the
 * page tries to fetch fails SILENTLY inside the iframe. There is no console the
 * author will see and no error the host reports. A missing stylesheet just
 * renders as an unstyled card.
 *
 * That silence is why this is an assertion at pack time and not a warning.
 */
import { AgentError } from '../errors.js';

/** An external reference found in a document, with enough context to fix it. */
export interface ExternalRef {
  kind: 'src' | 'link-href' | 'css-url' | 'css-import';
  url: string;
}

/** Absolute http(s) or protocol-relative. `data:` and `blob:` are inline. */
const EXTERNAL = /^\s*(?:https?:)?\/\//i;

/**
 * Finds every reference that would leave the document.
 *
 * Deliberately NOT flagged: `href` on an anchor. A link is a navigation, not a
 * subresource load — the default CSP does not block it, and `<a href="https://...">`
 * is legitimate inside a view. Only `<link>` loads a subresource through `href`,
 * so `href` is checked there and nowhere else.
 */
export function findExternalRefs(html: string): ExternalRef[] {
  const found: ExternalRef[] = [];

  for (const m of html.matchAll(/\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const url = m[1] ?? m[2] ?? m[3] ?? '';
    if (EXTERNAL.test(url)) found.push({ kind: 'src', url: url.trim() });
  }

  for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
    const attr = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag[0]);
    if (!attr) continue;
    const url = attr[1] ?? attr[2] ?? attr[3] ?? '';
    if (EXTERNAL.test(url)) found.push({ kind: 'link-href', url: url.trim() });
  }

  for (const m of html.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) {
    const url = m[1] ?? m[2] ?? m[3] ?? '';
    if (EXTERNAL.test(url)) found.push({ kind: 'css-url', url: url.trim() });
  }

  for (const m of html.matchAll(/@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)')/gi)) {
    const url = m[1] ?? m[2] ?? '';
    if (EXTERNAL.test(url)) found.push({ kind: 'css-import', url: url.trim() });
  }

  return found;
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
      'content. Inline the CSS and JS, and embed images and fonts as data: URIs.',
    { status: 500 },
  );
}
