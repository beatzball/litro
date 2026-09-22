/**
 * Builds the data behind the `/docs` landing page.
 *
 * The page exists so that `/docs` — the path a reader types, or trims a URL
 * back to — answers with something instead of a 404. It lists every entry in
 * the sidebar, grouped exactly as the sidebar groups it, and adds each doc's
 * frontmatter `description` where the content layer has one.
 *
 * This is a pure function: it takes the sidebar config and the content posts
 * and returns plain data. Nothing here touches Lit, the DOM or the file
 * system, so it runs on the server, in the browser and under vitest alike.
 */

/** One sidebar entry, as `starlight.config.js` declares it. */
export interface DocsSidebarItem {
  label: string;
  slug: string;
}

/** One sidebar group, as `starlight.config.js` declares it. */
export interface DocsSidebarGroup {
  label: string;
  items: DocsSidebarItem[];
}

/** The subset of a content `Post` this builder reads. */
export interface DocsIndexPost {
  url: string;
  description?: string;
}

/** One link on the `/docs` landing page. */
export interface DocsIndexItem {
  label: string;
  href: string;
  description: string | null;
}

/** One section on the `/docs` landing page. */
export interface DocsIndexGroup {
  label: string;
  items: DocsIndexItem[];
}

/**
 * Maps the sidebar onto link groups for the `/docs` landing page.
 *
 * @param sidebar   Sidebar groups from the site config.
 * @param posts     Every content post. Docs posts are matched by their
 *                  `/content/docs/<slug>` URL; anything else is ignored.
 * @param basePath  Route prefix the docs pages live under. Defaults to `/docs`.
 *
 * A sidebar entry with no matching content file — the package reference pages
 * are rendered from code, not Markdown — keeps its link and gets a `null`
 * description. Empty groups are dropped.
 */
export function buildDocsIndexGroups(
  sidebar: readonly DocsSidebarGroup[],
  posts: readonly DocsIndexPost[],
  basePath = '/docs',
): DocsIndexGroup[] {
  const contentPrefix = '/content/docs/';
  const descriptions = new Map<string, string>();
  for (const post of posts) {
    if (!post.url.startsWith(contentPrefix)) continue;
    const description = post.description?.trim();
    if (description) descriptions.set(post.url.slice(contentPrefix.length), description);
  }

  return sidebar
    .map(group => ({
      label: group.label,
      items: group.items.map(item => ({
        label: item.label,
        href: `${basePath}/${item.slug}`,
        description: descriptions.get(item.slug) ?? null,
      })),
    }))
    .filter(group => group.items.length > 0);
}
