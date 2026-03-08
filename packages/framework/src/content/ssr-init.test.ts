/**
 * Unit tests for SSR startup initialization (Task 4.2)
 *
 * Verifies that ContentIndex can be eagerly initialized before any HTTP request
 * and that the build() method is idempotent.
 *
 * Run with: pnpm --filter litro test
 */

import { describe, it, expect } from 'vitest';
import { ContentIndex } from './index.js';
import { resolve } from 'pathe';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '__fixtures__/blog');

describe('SSR startup initialization', () => {
  it('getPosts returns all published posts before any HTTP request', async () => {
    const index = new ContentIndex(FIXTURES_DIR);
    // Simulate eager SSR startup: build() called at startup before any request
    await index.build();
    // Verify data is available immediately
    const posts = await index.getPosts();
    // 4 published posts: hello-world, getting-started, advanced-topics, nested
    expect(posts.length).toBe(4);
    expect(posts.every(p => !p.draft)).toBe(true);
  });

  it('build() is idempotent when called multiple times', async () => {
    const index = new ContentIndex(FIXTURES_DIR);
    await index.build();
    const posts1 = await index.getPosts();

    // Rebuild — should produce identical results
    await index.build();
    const posts2 = await index.getPosts();

    expect(posts1.length).toBe(posts2.length);
    // Same slugs in same order
    const slugs1 = posts1.map(p => p.slug);
    const slugs2 = posts2.map(p => p.slug);
    expect(slugs1).toEqual(slugs2);
  });

  it('build() resets and repopulates the tag index', async () => {
    const index = new ContentIndex(FIXTURES_DIR);
    await index.build();
    const tags1 = await index.getTags();

    // Rebuild
    await index.build();
    const tags2 = await index.getTags();

    expect(tags1).toEqual(tags2);
  });

  it('getPost is available immediately after build()', async () => {
    const index = new ContentIndex(FIXTURES_DIR);
    await index.build();

    // All slugs should be findable without any additional async work
    const helloWorld = await index.getPost('hello-world');
    const gettingStarted = await index.getPost('getting-started');
    const advancedTopics = await index.getPost('advanced-topics');
    const nested = await index.getPost('nested');

    expect(helloWorld).not.toBeNull();
    expect(gettingStarted).not.toBeNull();
    expect(advancedTopics).not.toBeNull();
    expect(nested).not.toBeNull();
  });

  it('getTags is available immediately after build()', async () => {
    const index = new ContentIndex(FIXTURES_DIR);
    await index.build();

    const tags = await index.getTags();
    expect(tags.length).toBeGreaterThan(0);
    expect(tags).toContain('posts');
  });

  it('getGlobalData is available immediately after build()', async () => {
    const index = new ContentIndex(FIXTURES_DIR);
    await index.build();

    const data = await index.getGlobalData();
    expect(data['title']).toBe('Test Blog');
  });

  it('concurrent build() calls share the same promise (no duplicate I/O)', async () => {
    const index = new ContentIndex(FIXTURES_DIR);
    // Fire multiple concurrent calls — all must await the same underlying build
    const [p1, p2, p3] = [index.build(), index.build(), index.build()];
    expect(p1).toBe(p2);
    expect(p2).toBe(p3);
    await p1;
    // Data must still be correct after all callers resolve
    const posts = await index.getPosts();
    expect(posts.length).toBe(4);
  });

  it('multiple ContentIndex instances over the same dir are independent', async () => {
    const index1 = new ContentIndex(FIXTURES_DIR);
    const index2 = new ContentIndex(FIXTURES_DIR, { includeDrafts: true });

    await Promise.all([index1.build(), index2.build()]);

    const posts1 = await index1.getPosts();
    const posts2 = await index2.getPosts();

    expect(posts1.length).toBe(4); // no drafts
    expect(posts2.length).toBe(5); // includes drafts
  });
});
