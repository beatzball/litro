/**
 * Unit tests for docs/server/routes/blog/rss.xml.ts
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
import handler from '../../server/routes/blog/rss.xml.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockEvent = {};

function makePost(overrides: Partial<Post> & { url: string; title: string }): Post {
  return {
    slug: overrides.url.split('/').pop() ?? 'slug',
    title: overrides.title,
    date: new Date('2026-01-01'),
    description: 'Default description.',
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

// Sample posts for ordering / multi-post tests (dates intentionally out of order).
const samplePosts: Post[] = [
  makePost({ url: '/content/blog/post-a', title: 'Post A', date: new Date('2026-03-01'), description: 'Desc A' }),
  makePost({ url: '/content/blog/post-b', title: 'Post B', date: new Date('2026-01-15'), description: 'Desc B' }),
  makePost({ url: '/content/blog/post-c', title: 'Post C', date: new Date('2026-02-10'), description: 'Desc C' }),
];

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

describe('rss.xml — response headers', () => {
  it('sets content-type to application/rss+xml; charset=utf-8', async () => {
    await getXml();
    expect(setResponseHeader).toHaveBeenCalledWith(
      mockEvent,
      'content-type',
      'application/rss+xml; charset=utf-8',
    );
  });
});

// ---------------------------------------------------------------------------
// RSS structure
// ---------------------------------------------------------------------------

describe('rss.xml — RSS structure', () => {
  it('starts with an XML declaration', async () => {
    const xml = await getXml();
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  });

  it('contains <rss version="2.0">', async () => {
    const xml = await getXml();
    expect(xml).toContain('<rss version="2.0"');
  });

  it('closes with </rss>', async () => {
    const xml = await getXml();
    expect(xml.trimEnd().endsWith('</rss>')).toBe(true);
  });

  it('includes atom namespace declaration', async () => {
    const xml = await getXml();
    expect(xml).toContain('xmlns:atom=');
  });
});

// ---------------------------------------------------------------------------
// Channel metadata
// ---------------------------------------------------------------------------

describe('rss.xml — channel metadata', () => {
  it('sets channel <title> to "Litro Blog"', async () => {
    const xml = await getXml();
    expect(xml).toContain('<title>Litro Blog</title>');
  });

  it('sets channel <link> to the blog URL', async () => {
    const xml = await getXml();
    expect(xml).toContain('<link>https://litro.dev/blog</link>');
  });

  it('includes a channel <description>', async () => {
    const xml = await getXml();
    expect(xml).toContain('<description>');
  });

  it('sets <language> to "en"', async () => {
    const xml = await getXml();
    expect(xml).toContain('<language>en</language>');
  });

  it('includes <lastBuildDate>', async () => {
    const xml = await getXml();
    expect(xml).toContain('<lastBuildDate>');
  });

  it('includes <atom:link> self-reference pointing to the RSS URL', async () => {
    const xml = await getXml();
    expect(xml).toContain('href="https://litro.dev/blog/rss.xml"');
    expect(xml).toContain('rel="self"');
  });
});

// ---------------------------------------------------------------------------
// Post items
// ---------------------------------------------------------------------------

describe('rss.xml — post items', () => {
  it('generates one <item> per blog post', async () => {
    vi.mocked(getPosts).mockResolvedValue(samplePosts);
    const xml = await getXml();
    expect(xml.match(/<item>/g)).toHaveLength(3);
  });

  it('each item has a <title>', async () => {
    vi.mocked(getPosts).mockResolvedValue([samplePosts[0]]);
    const xml = await getXml();
    expect(xml).toContain('<title>Post A</title>');
  });

  it('each item has a <link> to the blog post URL', async () => {
    vi.mocked(getPosts).mockResolvedValue([samplePosts[0]]);
    const xml = await getXml();
    expect(xml).toContain('<link>https://litro.dev/blog/post-a</link>');
  });

  it('each item has a <guid isPermaLink="true"> matching the link', async () => {
    vi.mocked(getPosts).mockResolvedValue([samplePosts[0]]);
    const xml = await getXml();
    expect(xml).toContain(
      '<guid isPermaLink="true">https://litro.dev/blog/post-a</guid>',
    );
  });

  it('each item has a <pubDate>', async () => {
    vi.mocked(getPosts).mockResolvedValue([samplePosts[0]]);
    const xml = await getXml();
    expect(xml).toContain('<pubDate>');
  });

  it('each item has a <description>', async () => {
    vi.mocked(getPosts).mockResolvedValue([samplePosts[0]]);
    const xml = await getXml();
    expect(xml).toContain('<description>Desc A</description>');
  });

  it('strips /content/blog/ prefix for the post URL slug', async () => {
    vi.mocked(getPosts).mockResolvedValue([samplePosts[0]]);
    const xml = await getXml();
    expect(xml).toContain('blog/post-a');
    expect(xml).not.toContain('/content/blog/post-a');
  });
});

// ---------------------------------------------------------------------------
// Sort order
// ---------------------------------------------------------------------------

describe('rss.xml — sort order', () => {
  it('posts are sorted newest-first', async () => {
    vi.mocked(getPosts).mockResolvedValue(samplePosts);
    const xml = await getXml();
    // post-a (Mar 1) > post-c (Feb 10) > post-b (Jan 15)
    const posA = xml.indexOf('blog/post-a');
    const posC = xml.indexOf('blog/post-c');
    const posB = xml.indexOf('blog/post-b');
    expect(posA).toBeLessThan(posC);
    expect(posC).toBeLessThan(posB);
  });

  it('lastBuildDate matches the most recent post date', async () => {
    vi.mocked(getPosts).mockResolvedValue(samplePosts);
    const xml = await getXml();
    const match = xml.match(/<lastBuildDate>(.+?)<\/lastBuildDate>/);
    expect(match).not.toBeNull();
    // Most recent post is post-a: 2026-03-01
    expect(new Date(match![1]).getTime()).toBe(new Date('2026-03-01').getTime());
  });

  it('lastBuildDate is still a valid date when there are no posts', async () => {
    vi.mocked(getPosts).mockResolvedValue([]);
    const xml = await getXml();
    const match = xml.match(/<lastBuildDate>(.+?)<\/lastBuildDate>/);
    expect(match).not.toBeNull();
    expect(isNaN(new Date(match![1]).getTime())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// XML escaping
// ---------------------------------------------------------------------------

describe('rss.xml — XML escaping in titles', () => {
  it('escapes & as &amp; in post title', async () => {
    vi.mocked(getPosts).mockResolvedValue([
      makePost({ url: '/content/blog/t', title: 'Lit & Web Components' }),
    ]);
    const xml = await getXml();
    expect(xml).toContain('<title>Lit &amp; Web Components</title>');
    expect(xml).not.toContain('<title>Lit & Web Components</title>');
  });

  it('escapes < and > as &lt; / &gt; in post title', async () => {
    vi.mocked(getPosts).mockResolvedValue([
      makePost({ url: '/content/blog/t', title: '<Lit>' }),
    ]);
    const xml = await getXml();
    expect(xml).toContain('<title>&lt;Lit&gt;</title>');
  });
});

describe('rss.xml — XML escaping in descriptions', () => {
  it('escapes & in description', async () => {
    vi.mocked(getPosts).mockResolvedValue([
      makePost({ url: '/content/blog/t', title: 'T', description: 'A & B' }),
    ]);
    const xml = await getXml();
    expect(xml).toContain('<description>A &amp; B</description>');
  });

  it('escapes < and > in description', async () => {
    vi.mocked(getPosts).mockResolvedValue([
      makePost({ url: '/content/blog/t', title: 'T', description: '<b>bold</b>' }),
    ]);
    const xml = await getXml();
    expect(xml).toContain('<description>&lt;b&gt;bold&lt;/b&gt;</description>');
  });

  it('escapes " as &quot; in description', async () => {
    vi.mocked(getPosts).mockResolvedValue([
      makePost({ url: '/content/blog/t', title: 'T', description: 'Say "hello"' }),
    ]);
    const xml = await getXml();
    expect(xml).toContain('&quot;hello&quot;');
  });

  it("escapes ' as &apos; in description", async () => {
    vi.mocked(getPosts).mockResolvedValue([
      makePost({ url: '/content/blog/t', title: 'T', description: "it's fine" }),
    ]);
    const xml = await getXml();
    expect(xml).toContain('it&apos;s fine');
  });
});

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

describe('rss.xml — non-blog post filtering', () => {
  it('excludes posts that do not start with /content/blog/', async () => {
    vi.mocked(getPosts).mockResolvedValue([
      makePost({ url: '/content/blog/real', title: 'Real Post' }),
      makePost({ url: '/content/docs/page', title: 'Doc Page' }),
    ]);
    const xml = await getXml();
    expect(xml).toContain('blog/real');
    expect(xml).not.toContain('/docs/page');
    expect(xml.match(/<item>/g)).toHaveLength(1);
  });
});
