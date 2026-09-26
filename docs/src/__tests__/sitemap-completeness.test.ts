/**
 * Guard: every page that exists must be listed in BOTH sitemaps
 * (docs/ and docs-ssr/).
 *
 * Nothing here is a written-out list of URLs. Each expectation is rebuilt from
 * the source that creates the page:
 *
 *   - static pages   the page files under docs/pages/ and docs-ssr/pages/
 *   - docs pages     the Markdown files under content/docs/
 *   - package pages  ALL_PACKAGE_SLUGS
 *   - compare pages  the Markdown files under content/compare/
 *   - blog posts     the Markdown files under content/blog/
 *   - tag pages      the tags in those blog posts' front matter
 *
 * So adding a page, a doc or a tag makes this test fail until the sitemap
 * carries it. The sidebar and header links in each app's starlight.config.js
 * are checked too, so a nav link cannot point at a page the sitemap omits.
 *
 * getPosts is mocked to return one post per real content file, so the handlers
 * see the same pages the build would.
 *
 * Run with: pnpm test:docs
 */

import { describe, it, expect, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Post } from '@beatzball/litro/content';

vi.mock('litro:content', () => ({
  getPosts: vi.fn(),
}));

vi.mock('h3', () => ({
  defineEventHandler: (fn: Function) => fn,
  setResponseHeader: vi.fn(),
}));

import { getPosts } from 'litro:content';
import { ALL_PACKAGE_SLUGS } from '@beatzball/litro-docs-ui/src/packages.js';
import { blogTags } from '@beatzball/litro-docs-ui/src/sitemap.js';
import docsHandler from '../../server/routes/sitemap.xml.js';
import docsSsrHandler from '../../../docs-ssr/server/routes/sitemap.xml.js';
import { siteConfig as docsSiteConfig } from '../../server/starlight.config.js';
import { siteConfig as docsSsrSiteConfig } from '../../../docs-ssr/server/starlight.config.js';
import { scanRoutes } from './fixtures/scan-pages.js';

const CONTENT_DIR = fileURLToPath(
  new URL('../../../packages/docs-content/content', import.meta.url),
);

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

// '/content/docs/core-concepts/routing' for .../content/docs/core-concepts/routing.md
function contentUrl(file: string): string {
  return '/content/' + relative(CONTENT_DIR, file).split(sep).join('/').replace(/\.md$/, '');
}

/** The front matter block of a Markdown file, or '' when there is none. */
function frontMatter(file: string): string {
  return readFileSync(file, 'utf-8').match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
}

/** `tags: [a, b]` and the block list form, which the content files both use. */
function frontMatterTags(fm: string): string[] {
  const inline = fm.match(/^tags:[ \t]*\[(.*)\]/m);
  if (inline) {
    return inline[1]
      .split(',')
      .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }
  const block = fm.match(/^tags:[ \t]*\r?\n((?:[ \t]*-[ \t]*.*\r?\n?)+)/m);
  if (!block) return [];
  return block[1]
    .split('\n')
    .map((line) => line.replace(/^[ \t]*-[ \t]*/, '').trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

function postFor(file: string): Post {
  const fm = frontMatter(file);
  return {
    url: contentUrl(file),
    slug: contentUrl(file).split('/').pop()!,
    title: 'Doc',
    date: undefined as unknown as Date,
    description: '',
    tags: frontMatterTags(fm),
    draft: /^draft:[ \t]*true\b/m.test(fm),
    body: '',
    rawBody: '',
    frontmatter: {},
  };
}

// getPosts() hides drafts, so the fixture does too.
const allPosts: Post[] = markdownFiles(CONTENT_DIR)
  .map(postFor)
  .filter((p) => !p.draft);

const under = (prefix: string): Post[] => allPosts.filter((p) => p.url.startsWith(prefix));

/** Every URL that must appear, derived from the sources above. */
const expectedPaths = [
  ...under('/content/docs/').map((p) => '/docs' + p.url.slice('/content/docs'.length)),
  ...ALL_PACKAGE_SLUGS.map((s) => `/docs/packages/${s}`),
  ...under('/content/compare/').map((p) => '/compare' + p.url.slice('/content/compare'.length)),
  ...under('/content/blog/').map((p) => '/blog' + p.url.slice('/content/blog'.length)),
  ...blogTags(under('/content/blog/')).map((t) => `/blog/tags/${encodeURIComponent(t)}`),
];

/** Static page files must be listed too — /search is deliberately excluded. */
function staticPagePaths(app: string): string[] {
  return scanRoutes(app)
    .filter((r) => !r.isDynamic)
    .map((r) => r.path)
    .filter((p) => p !== '/search');
}

function locs(xml: string): Set<string> {
  return new Set([...xml.matchAll(/<loc>https:\/\/litro\.dev([^<]*)<\/loc>/g)].map((m) => m[1]));
}

function sidebarPaths(config: { sidebar: Array<{ items: Array<{ slug: string }> }> }): string[] {
  return config.sidebar.flatMap((group) => group.items.map((item) => `/docs/${item.slug}`));
}

// Internal header links only — an external one (GitHub) is not ours to list.
function navPaths(config: { nav: Array<{ href: string }> }): string[] {
  return config.nav.map((item) => item.href).filter((href) => href.startsWith('/'));
}

const apps = [
  { name: 'docs', handler: docsHandler, siteConfig: docsSiteConfig },
  { name: 'docs-ssr', handler: docsSsrHandler, siteConfig: docsSsrSiteConfig },
];

// The manifest double scans docs/pages/. That is only valid while docs-ssr
// serves the same pages, so prove it rather than assume it.
describe('the two apps serve the same pages', () => {
  it('differs only by docs-ssr/pages/search.ts (CONTENT-007 item 4)', () => {
    const docsPaths = scanRoutes('docs').map((r) => r.path).sort();
    const ssrPaths = scanRoutes('docs-ssr').map((r) => r.path).sort();
    expect(ssrPaths.filter((p) => p !== '/search')).toEqual(docsPaths);
  });
});

describe.each(apps)('$name sitemap.xml — completeness', ({ name, handler, siteConfig }) => {
  async function sitemapPaths(): Promise<Set<string>> {
    vi.mocked(getPosts).mockResolvedValue(allPosts);
    return locs(await (handler as (event: unknown) => Promise<string>)({}));
  }

  it('finds the pages to check (sanity)', () => {
    expect(under('/content/docs/').length).toBeGreaterThan(20);
    expect(under('/content/blog/').length).toBeGreaterThan(5);
    expect(under('/content/compare/').length).toBeGreaterThan(0);
    expect(ALL_PACKAGE_SLUGS.length).toBeGreaterThan(0);
    expect(blogTags(under('/content/blog/')).length).toBeGreaterThan(20);
    expect(staticPagePaths(name).length).toBeGreaterThan(5);
  });

  it('lists every content-backed page that exists', async () => {
    const listed = await sitemapPaths();
    expect(expectedPaths.filter((path) => !listed.has(path))).toEqual([]);
  });

  it('lists every static page file in pages/', async () => {
    const listed = await sitemapPaths();
    expect(staticPagePaths(name).filter((path) => !listed.has(path))).toEqual([]);
  });

  it('lists every blog tag page the blog links to', async () => {
    const listed = await sitemapPaths();
    const tagPaths = blogTags(under('/content/blog/')).map((t) => `/blog/tags/${t}`);
    expect(tagPaths.filter((path) => !listed.has(path))).toEqual([]);
  });

  it('lists every page the docs sidebar links to', async () => {
    const listed = await sitemapPaths();
    expect(sidebarPaths(siteConfig).filter((path) => !listed.has(path))).toEqual([]);
  });

  it('lists every page the header navigation links to', async () => {
    const listed = await sitemapPaths();
    expect(navPaths(siteConfig).filter((path) => !listed.has(path))).toEqual([]);
  });

  it('does not list the search page, which has no content of its own', async () => {
    const listed = await sitemapPaths();
    expect(listed.has('/search')).toBe(false);
  });

  it('lists no page twice', async () => {
    vi.mocked(getPosts).mockResolvedValue(allPosts);
    const xml = await (handler as (event: unknown) => Promise<string>)({});
    const all = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
    expect(all.length).toBe(new Set(all).size);
  });
});
