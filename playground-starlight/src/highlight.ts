import hljs from 'highlight.js';

const NAMED_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function decodeEntities(str: string): string {
  return str.replace(/&#x[0-9a-fA-F]+;|&#[0-9]+;|&amp;|&lt;|&gt;|&quot;|&#39;/g, m => {
    if (m.startsWith('&#x')) return String.fromCodePoint(parseInt(m.slice(3, -1), 16));
    if (m.startsWith('&#'))  return String.fromCodePoint(parseInt(m.slice(2, -1), 10));
    return NAMED_ENTITY_MAP[m]!;
  });
}

/**
 * Post-processes an HTML string, replacing every
 * <pre><code class="language-*">…</code></pre>
 * with a syntax-highlighted version produced by highlight.js.
 *
 * Must be called server-side only (SSG build time).
 */
export function applyHighlighting(html: string): string {
  return html.replace(
    /<pre><code class="language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g,
    (_match, lang: string, encoded: string) => {
      const code = decodeEntities(encoded);
      let highlighted: string;
      try {
        highlighted = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      } catch {
        highlighted = hljs.highlightAuto(code).value;
      }
      return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
    },
  );
}
