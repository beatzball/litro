/**
 * Sitemap derivation, shared by docs/ and docs-ssr/.
 *
 * Nothing here is a hand-written list of pages. Every URL comes from the same
 * source the page itself comes from:
 *
 *   - static pages   -> the page files, via the #litro/page-manifest routes
 *   - docs pages     -> the Markdown files under content/docs/
 *   - package pages  -> ALL_PACKAGE_SLUGS
 *   - compare pages  -> the Markdown files under content/compare/
 *   - blog posts     -> the Markdown files under content/blog/
 *   - blog tag pages -> the tags on those blog posts
 *
 * A dynamic family is only emitted when the page file that serves it exists in
 * the route list, so the two apps stay honest about what each actually serves.
 *
 * This module must stay browser-safe: no node:fs, no Markdown toolchain.
 */

/** One entry of the #litro/page-manifest route list. */
export interface SitemapRoute {
  path: string;
  isDynamic: boolean;
}

/** The part of a content Post this module reads. */
export interface SitemapPost {
  url: string;
  date?: Date | string;
  tags?: readonly string[];
}

export interface SitemapSources {
  /** Origin with no trailing slash, e.g. 'https://litro.dev'. */
  siteUrl: string;
  /** Page routes from #litro/page-manifest. */
  routes: readonly SitemapRoute[];
  /** Every post the content layer returns (docs, blog and compare). */
  posts: readonly SitemapPost[];
  /** Package slugs backing /docs/packages/:pkg. */
  packageSlugs: readonly string[];
}

export interface SitemapEntry {
  path: string;
  changefreq: string;
  priority: string;
  lastmod?: string;
}

/**
 * Static pages that exist but must not be advertised to search engines.
 *
 * This is a policy list, not a copy of a page list: a page not named here is
 * included automatically, so adding a page can never leave it out.
 *
 *   /search  a results page has no content of its own (docs-ssr only).
 */
const EXCLUDED_ROUTES = new Set(['/search']);

/** Route paths of the dynamic pages whose URLs this module expands. */
const DOCS_ROUTE = '/docs/:slug(.*)*';
const PACKAGE_ROUTE = '/docs/packages/:pkg';
const COMPARE_ROUTE = '/compare/:slug(.*)*';
const BLOG_POST_ROUTE = '/blog/:slug';
const BLOG_TAG_ROUTE = '/blog/tags/:tag';

/**
 * Priority by shape of the path, never by naming individual pages.
 * A new top-level page gets 0.9 without anyone editing this function.
 */
function priorityFor(path: string): string {
  if (path === '/') return '1.0';
  if (path.startsWith('/blog/tags/')) return '0.4';
  if (path.startsWith('/blog/')) return '0.7';
  if (path === '/blog') return '0.8';
  if (path.startsWith('/docs/packages/') || path === '/docs/contributing') return '0.6';
  if (path.startsWith('/docs/')) return '0.8';
  return '0.9';
}

function lastmodFor(post: SitemapPost): string | undefined {
  if (!post.date) return undefined;
  const date = post.date instanceof Date ? post.date : new Date(post.date);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

/** Posts of one content collection, mapped onto their public route prefix. */
function sectionPaths(
  posts: readonly SitemapPost[],
  contentPrefix: string,
  routePrefix: string,
): SitemapPost[] {
  return posts.filter(p => p.url.startsWith(contentPrefix)).map(p => ({
    ...p,
    url: routePrefix + p.url.slice(contentPrefix.length - 1),
  }));
}

/** Every distinct tag across the given posts, sorted. */
export function blogTags(posts: readonly SitemapPost[]): string[] {
  return [...new Set(posts.flatMap(p => p.tags ?? []))].sort();
}

/** The full set of sitemap entries, deduplicated and sorted by path. */
export function sitemapEntries(sources: SitemapSources): SitemapEntry[] {
  const { routes, posts, packageSlugs } = sources;
  const serves = (path: string): boolean => routes.some(r => r.path === path);

  const entries = new Map<string, SitemapEntry>();
  const add = (path: string, lastmod?: string): void => {
    if (entries.has(path)) return;
    entries.set(path, {
      path,
      changefreq: path === '/' ? 'weekly' : 'monthly',
      priority: priorityFor(path),
      ...(lastmod ? { lastmod } : {}),
    });
  };

  // Every page file that resolves to one fixed URL is a page to list.
  for (const route of routes) {
    if (route.isDynamic) continue;
    if (EXCLUDED_ROUTES.has(route.path)) continue;
    add(route.path);
  }

  if (serves(DOCS_ROUTE)) {
    for (const p of sectionPaths(posts, '/content/docs/', '/docs')) add(p.url);
  }
  if (serves(PACKAGE_ROUTE)) {
    for (const slug of packageSlugs) add(`/docs/packages/${slug}`);
  }
  if (serves(COMPARE_ROUTE)) {
    for (const p of sectionPaths(posts, '/content/compare/', '/compare')) add(p.url);
  }

  const blogPosts = posts.filter(p => p.url.startsWith('/content/blog/'));
  if (serves(BLOG_POST_ROUTE)) {
    for (const p of sectionPaths(blogPosts, '/content/blog/', '/blog')) {
      add(p.url, lastmodFor(p));
    }
  }
  if (serves(BLOG_TAG_ROUTE)) {
    for (const tag of blogTags(blogPosts)) add(`/blog/tags/${encodeURIComponent(tag)}`);
  }

  // '/' first, then alphabetical — a stable order makes diffs readable.
  return [...entries.values()].sort((a, b) =>
    a.path === '/' ? -1 : b.path === '/' ? 1 : a.path.localeCompare(b.path),
  );
}

/** The sitemap document for the given sources. */
export function renderSitemapXml(sources: SitemapSources): string {
  const siteUrl = sources.siteUrl.replace(/\/$/, '');
  const urls = sitemapEntries(sources).map(entry => `
  <url>
    <loc>${siteUrl}${entry.path}</loc>${entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : ''}
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}
</urlset>`;
}
