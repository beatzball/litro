/**
 * Unit tests for docs/server/routes/sitemap.xml.ts
 *
 * The handler is a plain async function (defineEventHandler is mocked as a
 * passthrough). litro:content is mocked so no real file system is needed.
 *
 * Run with: pnpm test:docs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Post } from '@beatzball/litro/content';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('litro:content', () => ({
  getPosts: vi.fn(),
}));

vi.mock('h3', () => ({
  defineEventHandler: (fn: Function) => fn,
  setResponseHeader: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { getPosts } from 'litro:content';
import { setResponseHeader } from 'h3';
import handler from '../../server/routes/sitemap.xml.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockEvent = {};

function makePost(overrides: Partial<Post> & { url: string }): Post {
  return {
    slug: overrides.url.split('/').pop() ?? 'slug',
    title: 'Test Post',
    date: new Date('2026-01-01'),
    description: 'A test post.',
    tags: [],
    draft: false,
    body: '',
    rawBody: '',
    frontmatter: {},
    ...overrides,
  };
}

async function getXml(): Promise<string> {
  return (handler as (event: unknown) => Promise<string>)(mockEvent);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.mocked(getPosts).mockResolvedValue([]);
  vi.mocked(setResponseHeader).mockReset();
});

// ---------------------------------------------------------------------------
// Response headers
// ---------------------------------------------------------------------------

describe('sitemap.xml — response headers', () => {
  it('sets content-type to application/xml; charset=utf-8', async () => {
    await getXml();
    expect(setResponseHeader).toHaveBeenCalledWith(
      mockEvent,
      'content-type',
      'application/xml; charset=utf-8',
    );
  });
});

// ---------------------------------------------------------------------------
// XML structure
// ---------------------------------------------------------------------------

describe('sitemap.xml — XML structure', () => {
  it('starts with an XML declaration', async () => {
    const xml = await getXml();
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  });

  it('wraps entries in <urlset> with the sitemap namespace', async () => {
    const xml = await getXml();
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('</urlset>');
  });
});

// ---------------------------------------------------------------------------
// Static routes
// ---------------------------------------------------------------------------

describe('sitemap.xml — static routes', () => {
  it('includes the homepage', async () => {
    const xml = await getXml();
    expect(xml).toContain('<loc>https://litro.dev/</loc>');
  });

  it('includes the /blog route', async () => {
    const xml = await getXml();
    expect(xml).toContain('<loc>https://litro.dev/blog</loc>');
  });

  it('includes /docs/introduction', async () => {
    const xml = await getXml();
    expect(xml).toContain('<loc>https://litro.dev/docs/introduction</loc>');
  });

  it('gives the homepage priority 1.0', async () => {
    const xml = await getXml();
    // Find the homepage entry and check its priority
    const homepageEntry = xml.slice(xml.indexOf('<loc>https://litro.dev/</loc>'));
    const priorityMatch = homepageEntry.match(/<priority>([^<]+)<\/priority>/);
    expect(priorityMatch?.[1]).toBe('1.0');
  });

  it('gives the homepage changefreq "weekly"', async () => {
    const xml = await getXml();
    const homepageEntry = xml.slice(xml.indexOf('<loc>https://litro.dev/</loc>'));
    expect(homepageEntry).toContain('<changefreq>weekly</changefreq>');
  });
});

// ---------------------------------------------------------------------------
// Blog post entries
// ---------------------------------------------------------------------------

describe('sitemap.xml — blog post entries', () => {
  it('includes <loc> for each blog post', async () => {
    vi.mocked(getPosts).mockResolvedValue([
      makePost({ url: '/content/blog/hello-world' }),
    ]);
    const xml = await getXml();
    expect(xml).toContain('<loc>https://litro.dev/blog/hello-world</loc>');
  });

  it('strips the /content/blog/ prefix to derive the blog slug', async () => {
    vi.mocked(getPosts).mockResolvedValue([
      makePost({ url: '/content/blog/shadow-dom-seo' }),
    ]);
    const xml = await getXml();
    expect(xml).toContain('/blog/shadow-dom-seo');
    expect(xml).not.toContain('/content/blog/shadow-dom-seo');
  });

  it('includes <lastmod> formatted as YYYY-MM-DD', async () => {
    vi.mocked(getPosts).mockResolvedValue([
      makePost({ url: '/content/blog/dated-post', date: new Date('2026-03-15') }),
    ]);
    const xml = await getXml();
    expect(xml).toContain('<lastmod>2026-03-15</lastmod>');
  });

  it('gives blog posts priority 0.7', async () => {
    vi.mocked(getPosts).mockResolvedValue([
      makePost({ url: '/content/blog/post' }),
    ]);
    const xml = await getXml();
    const postEntry = xml.slice(xml.indexOf('/blog/post'));
    expect(postEntry).toContain('<priority>0.7</priority>');
  });

  it('gives blog posts changefreq "monthly"', async () => {
    vi.mocked(getPosts).mockResolvedValue([
      makePost({ url: '/content/blog/post' }),
    ]);
    const xml = await getXml();
    const postEntry = xml.slice(xml.indexOf('/blog/post'));
    expect(postEntry).toContain('<changefreq>monthly</changefreq>');
  });

  it('includes multiple blog posts', async () => {
    vi.mocked(getPosts).mockResolvedValue([
      makePost({ url: '/content/blog/post-one' }),
      makePost({ url: '/content/blog/post-two' }),
      makePost({ url: '/content/blog/post-three' }),
    ]);
    const xml = await getXml();
    expect(xml).toContain('/blog/post-one');
    expect(xml).toContain('/blog/post-two');
    expect(xml).toContain('/blog/post-three');
  });
});

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

describe('sitemap.xml — non-blog post filtering', () => {
  it('excludes posts that do not start with /content/blog/', async () => {
    vi.mocked(getPosts).mockResolvedValue([
      makePost({ url: '/content/blog/real-post' }),
      makePost({ url: '/content/docs/some-page', title: 'Doc Page' }),
    ]);
    const xml = await getXml();
    expect(xml).toContain('/blog/real-post');
    expect(xml).not.toContain('/content/docs/some-page');
    expect(xml).not.toContain('some-page');
  });
});
