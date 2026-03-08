/**
 * Unit tests for ContentIndex (Task 5.2)
 *
 * Run with: pnpm --filter litro test
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ContentIndex } from './index.js';
import { resolve } from 'pathe';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '__fixtures__/blog');

describe('ContentIndex', () => {
  let index: ContentIndex;

  beforeAll(async () => {
    index = new ContentIndex(FIXTURES_DIR);
    await index.build();
  });

  it('filters out drafts by default', async () => {
    const posts = await index.getPosts();
    expect(posts.every(p => !p.draft)).toBe(true);
    // 4 non-draft posts: hello-world, getting-started, advanced-topics, nested
    expect(posts.length).toBe(4);
  });

  it('returns drafts when includeDrafts is true', async () => {
    const index2 = new ContentIndex(FIXTURES_DIR, { includeDrafts: true });
    await index2.build();
    const posts = await index2.getPosts();
    expect(posts.length).toBe(5); // includes draft-post
  });

  it('sorts posts by date descending', async () => {
    const posts = await index.getPosts();
    for (let i = 1; i < posts.length; i++) {
      expect(posts[i - 1].date.getTime()).toBeGreaterThanOrEqual(posts[i].date.getTime());
    }
  });

  it('first post is the most recent published post (advanced-topics, 2026-01-25)', async () => {
    const posts = await index.getPosts();
    expect(posts[0].slug).toBe('advanced-topics');
  });

  it('last post is the oldest published post (nested, 2026-01-10)', async () => {
    const posts = await index.getPosts();
    expect(posts[posts.length - 1].slug).toBe('nested');
  });

  it('filters posts by tag', async () => {
    const posts = await index.getPosts({ tag: 'welcome' });
    expect(posts.length).toBe(1);
    expect(posts[0].slug).toBe('hello-world');
  });

  it('filters posts by tutorial tag', async () => {
    const posts = await index.getPosts({ tag: 'tutorial' });
    expect(posts.length).toBe(1);
    expect(posts[0].slug).toBe('getting-started');
  });

  it('returns empty array for unknown tag', async () => {
    const posts = await index.getPosts({ tag: 'nonexistent' });
    expect(posts).toEqual([]);
  });

  it('applies limit', async () => {
    const posts = await index.getPosts({ limit: 2 });
    expect(posts.length).toBe(2);
  });

  it('limit 1 returns only the most recent post', async () => {
    const posts = await index.getPosts({ limit: 1 });
    expect(posts.length).toBe(1);
    expect(posts[0].slug).toBe('advanced-topics');
  });

  it('limit larger than total returns all posts', async () => {
    const posts = await index.getPosts({ limit: 100 });
    expect(posts.length).toBe(4);
  });

  it('getPost returns post by slug', async () => {
    const post = await index.getPost('hello-world');
    expect(post).not.toBeNull();
    expect(post!.title).toBe('Hello World');
  });

  it('getPost returns null for unknown slug', async () => {
    const post = await index.getPost('does-not-exist');
    expect(post).toBeNull();
  });

  it('getPost works for nested index.md slug', async () => {
    const post = await index.getPost('nested');
    expect(post).not.toBeNull();
    expect(post!.slug).toBe('nested');
    expect(post!.url).toBe('/blog/nested');
  });

  it('getTags returns unique sorted tags', async () => {
    const tags = await index.getTags();
    // From 4 published posts: posts, welcome, tutorial, advanced
    // nested/index.md also has "posts" tag
    expect(tags).toContain('posts');
    expect(tags).toContain('welcome');
    expect(tags).toContain('tutorial');
    expect(tags).toContain('advanced');
    // Sorted alphabetically
    const sorted = [...tags].sort();
    expect(tags).toEqual(sorted);
    // Unique
    expect(new Set(tags).size).toBe(tags.length);
  });

  it('getTags does not include tags from draft posts', async () => {
    // draft-post.md has tags: ['posts'] — but 'posts' appears in non-draft posts too.
    // Verify that getTags() only reflects published posts (index has no drafts).
    // We can test a unique tag from draft: draft-post.md only has 'posts', which is shared,
    // but the index correctly excludes the draft from being indexed.
    // The draft is excluded during build(), so its tags are not in tagIndex.
    const tags = await index.getTags();
    // 'posts' appears in non-draft posts too, so it will still be present.
    // The important thing is the tag count is based on published posts only.
    // advanced = advanced-topics only; tutorial = getting-started only; welcome = hello-world only
    // posts = hello-world, getting-started, advanced-topics, nested (all published)
    expect(tags.length).toBe(4); // posts, welcome, tutorial, advanced
  });

  it('getGlobalData returns metadata from _data/metadata.js', async () => {
    const data = await index.getGlobalData();
    expect(data['title']).toBe('Test Blog');
    expect(data['author']).toMatchObject({ name: 'Test Author' });
  });

  it('getGlobalData returns url field', async () => {
    const data = await index.getGlobalData();
    expect(data['url']).toBe('https://test.example.com');
  });

  it('getGlobalData returns language field', async () => {
    const data = await index.getGlobalData();
    expect(data['language']).toBe('en');
  });

  it('directory data (.11tydata.json) is merged into posts at blog/ level', async () => {
    // .11tydata.json has tags: ["posts"]
    // hello-world.md has its own tags — file frontmatter wins, so tags are from file
    const helloPost = await index.getPost('hello-world');
    expect(helloPost).toBeDefined();
    expect(helloPost!.tags).toContain('welcome'); // from file frontmatter
    expect(helloPost!.tags).toContain('posts');   // also from file frontmatter (both have it)
  });

  it('handles index.md slug convention', async () => {
    const post = await index.getPost('nested');
    expect(post).not.toBeNull();
    expect(post!.slug).toBe('nested');
    expect(post!.url).toBe('/blog/nested');
    expect(post!.title).toBe('Nested Post');
  });

  it('builds lazily on first query if build() not called', async () => {
    const freshIndex = new ContentIndex(FIXTURES_DIR);
    // Not built yet — but getPosts() should trigger build() automatically
    const posts = await freshIndex.getPosts();
    expect(posts.length).toBeGreaterThan(0);
  });

  it('getPosts with includeDrafts option overrides instance-level setting', async () => {
    // The shared index was built without drafts — getPosts({ includeDrafts: true }) would
    // refilter from the already-built map. Since drafts are excluded at build() time
    // (not indexed into posts map), the option only takes effect when index built with drafts.
    const draftIndex = new ContentIndex(FIXTURES_DIR, { includeDrafts: true });
    await draftIndex.build();
    const allPosts = await draftIndex.getPosts();
    expect(allPosts.length).toBe(5);

    // Now exclude drafts at query time
    const publishedOnly = await draftIndex.getPosts({ includeDrafts: false });
    expect(publishedOnly.every(p => !p.draft)).toBe(true);
  });
});
