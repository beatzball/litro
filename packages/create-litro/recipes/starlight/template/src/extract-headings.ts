export interface TocEntry {
  depth: number;
  text: string;
  slug: string;
}

/**
 * Extracts h2–h4 headings from raw Markdown source.
 * Returns an array of TocEntry objects suitable for rendering a table of contents.
 */
export function extractHeadings(rawMarkdown: string): TocEntry[] {
  const headings: TocEntry[] = [];
  const lines = rawMarkdown.split('\n');

  for (const line of lines) {
    const match = line.match(/^(#{2,4})\s+(.+)$/);
    if (!match) continue;

    const depth = match[1].length;
    const text = match[2].trim().replace(/\s*\{[^}]*\}\s*$/, ''); // strip {#custom-id} syntax
    const slug = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    headings.push({ depth, text, slug });
  }

  return headings;
}

/**
 * Post-processes rendered HTML to inject `id` attributes on h2–h4 elements,
 * matching the slugs produced by `extractHeadings()`.
 * Enables anchor-link navigation from the table of contents.
 */
export function addHeadingIds(html: string): string {
  const counters: Record<string, number> = {};

  return html.replace(
    /<(h[2-4])([^>]*)>([\s\S]*?)<\/h[2-4]>/gi,
    (_match, tag: string, attrs: string, content: string) => {
      // Strip HTML tags from content to get plain text
      const text = content.replace(/<[^>]+>/g, '').trim().replace(/\s*\{[^}]*\}\s*$/, '');
      let slug = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

      // Deduplicate: if the same slug appears twice, append -2, -3, etc.
      counters[slug] = (counters[slug] ?? 0) + 1;
      if (counters[slug] > 1) {
        slug = `${slug}-${counters[slug]}`;
      }

      // Avoid double-injecting if an id already exists
      if (/\bid=/.test(attrs)) {
        return `<${tag}${attrs}>${content}</${tag}>`;
      }

      return `<${tag}${attrs} id="${slug}">${content}</${tag}>`;
    },
  );
}
