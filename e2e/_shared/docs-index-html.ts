/**
 * Reading the docs index out of a server-rendered page, without the two things
 * that make a naive check pass on an empty page.
 *
 * 1. The sidebar is server-rendered on /docs as well, and it emits its own
 *    plain `<a href="/docs/<slug>">` for every entry. So a link or a label
 *    found anywhere in the body proves nothing about the index's group list.
 * 2. `<script type="application/json" id="__litro_data__">` is text too, and
 *    it carries `sidebar` and `groups` verbatim. Strip the tags off a whole
 *    page and every label is still there, rendered or not.
 *
 * Assert on what only the index list produces: its own
 * `<section class="doc-group">` blocks.
 */

/** Drop the serialized page data, which repeats every label as JSON text. */
export function stripPageData(html: string): string {
  return html.replace(
    /<script\b[^>]*\bid="__litro_data__"[^>]*>[\s\S]*?<\/script>/g,
    ' ',
  );
}

/**
 * The inner HTML of each `<section class="doc-group">` the index rendered.
 *
 * Empty when the page rendered no groups — and also when the page element was
 * printed unexpanded, which is what a tree-shaken registration looks like.
 */
export function docGroupSections(html: string): string[] {
  const parts = stripPageData(html).split('<section class="doc-group">');
  return parts.slice(1).map((part) => part.split('</section>')[0] ?? '');
}

/** The visible text of the index's group list, tags and comments removed. */
export function docGroupText(html: string): string {
  return docGroupSections(html)
    .join(' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]*>/g, ' ');
}
