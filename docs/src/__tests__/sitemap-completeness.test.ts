/**
 * Guard: every docs page that exists must be listed in BOTH sitemaps
 * (docs/ and docs-ssr/).
 *
 * The page set is taken from the real sources the page routes build from:
 * the Markdown files under packages/docs-content/content/docs/ (what
 * pages/docs/[...slug].ts renders) and ALL_PACKAGE_SLUGS (what
 * pages/docs/packages/[pkg].ts renders). The sidebar in each app's
 * starlight.config.js is checked too, so a nav link cannot point at a page
 * the sitemap leaves out.
 *
 * getPosts is mocked to return one post per real content file, so the
 * handlers see the same docs pages the build would.
 *
 * Run with: pnpm test:docs
 */

import { describe, it, expect, vi } from 'vitest';
import { readdirSync } from 'node:fs';
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
import docsHandler from '../../server/routes/sitemap.xml.js';
import docsSsrHandler from '../../../docs-ssr/server/routes/sitemap.xml.js';
import { siteConfig as docsSiteConfig } from '../../server/starlight.config.js';
import { siteConfig as docsSsrSiteConfig } from '../../../docs-ssr/server/starlight.config.js';

const CONTENT_DIR = fileURLToPath(
  new URL('../../../packages/docs-content/content', import.meta.url),
);
const DOCS_DIR = join(CONTENT_DIR, 'docs');

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

const docPosts: Post[] = markdownFiles(DOCS_DIR).map((file) => ({
  url: contentUrl(file),
  slug: contentUrl(file).split('/').pop()!,
  title: 'Doc',
  date: undefined as unknown as Date,
  description: '',
  tags: [],
  draft: false,
  body: '',
  rawBody: '',
  frontmatter: {},
}));

const docsPagePaths = [
  ...docPosts.map((p) => '/docs' + p.url.slice('/content/docs'.length)),
  ...ALL_PACKAGE_SLUGS.map((s) => `/docs/packages/${s}`),
];

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

describe.each(apps)('$name sitemap.xml — completeness', ({ handler, siteConfig }) => {
  async function sitemapPaths(): Promise<Set<string>> {
    vi.mocked(getPosts).mockResolvedValue(docPosts);
    return locs(await (handler as (event: unknown) => Promise<string>)({}));
  }

  it('finds the docs pages to check (sanity)', () => {
    expect(docPosts.length).toBeGreaterThan(20);
    expect(ALL_PACKAGE_SLUGS.length).toBeGreaterThan(0);
  });

  it('lists every docs page that exists', async () => {
    const listed = await sitemapPaths();
    const missing = docsPagePaths.filter((path) => !listed.has(path));
    expect(missing).toEqual([]);
  });

  it('lists every page the docs sidebar links to', async () => {
    const listed = await sitemapPaths();
    const missing = sidebarPaths(siteConfig).filter((path) => !listed.has(path));
    expect(missing).toEqual([]);
  });

  it('lists every page the header navigation links to', async () => {
    const listed = await sitemapPaths();
    const missing = navPaths(siteConfig).filter((path) => !listed.has(path));
    expect(missing).toEqual([]);
  });

  it('lists no docs page twice', async () => {
    vi.mocked(getPosts).mockResolvedValue(docPosts);
    const xml = await (handler as (event: unknown) => Promise<string>)({});
    const all = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
    expect(all.length).toBe(new Set(all).size);
  });
});
