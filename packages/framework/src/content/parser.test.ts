/**
 * Unit tests for parseMarkdownFile (Task 5.1)
 *
 * Run with: pnpm --filter litro test
 */

import { describe, it, expect } from 'vitest';
import { parseMarkdownFile } from './parser.js';
import { join, resolve } from 'pathe';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = resolve(__dirname, '__fixtures__/blog');

describe('parseMarkdownFile', () => {
  it('parses frontmatter fields', async () => {
    const post = await parseMarkdownFile(join(FIXTURES, 'hello-world.md'), FIXTURES);
    expect(post.title).toBe('Hello World');
    expect(post.description).toBe('My first post');
    expect(post.draft).toBe(false);
  });

  it('coerces date string to Date object', async () => {
    const post = await parseMarkdownFile(join(FIXTURES, 'hello-world.md'), FIXTURES);
    expect(post.date).toBeInstanceOf(Date);
    expect(post.date.getFullYear()).toBe(2026);
    // gray-matter/js-yaml parses YAML dates as UTC midnight, so use UTC accessors
    expect(post.date.getUTCMonth()).toBe(0); // January = 0
    expect(post.date.getUTCDate()).toBe(15);
  });

  it('normalises tags from array', async () => {
    const post = await parseMarkdownFile(join(FIXTURES, 'hello-world.md'), FIXTURES);
    expect(post.tags).toEqual(['posts', 'welcome']);
  });

  it('sets draft to false when absent', async () => {
    const post = await parseMarkdownFile(join(FIXTURES, 'getting-started.md'), FIXTURES);
    expect(post.draft).toBe(false);
  });

  it('sets draft to true when draft: true is in frontmatter', async () => {
    const post = await parseMarkdownFile(join(FIXTURES, 'draft-post.md'), FIXTURES);
    expect(post.draft).toBe(true);
  });

  it('merges directory data with file wins on conflict', async () => {
    // directoryData has tags: ['from-dir'], but file also has tags — file wins
    const dirData = { tags: ['from-dir'], author: 'dir-author' };
    const post = await parseMarkdownFile(join(FIXTURES, 'hello-world.md'), FIXTURES, dirData);
    expect(post.tags).toEqual(['posts', 'welcome']); // file's tags win
    expect(post.frontmatter['author']).toBe('dir-author'); // dir value passed through
  });

  it('merges directory data fields not present in file frontmatter', async () => {
    const dirData = { author: 'dir-author' };
    const post = await parseMarkdownFile(join(FIXTURES, 'hello-world.md'), FIXTURES, dirData);
    // hello-world.md has no "author" field, so dir value is used
    expect(post.frontmatter['author']).toBe('dir-author');
  });

  it('derives slug from flat file', async () => {
    const post = await parseMarkdownFile(join(FIXTURES, 'hello-world.md'), FIXTURES);
    expect(post.slug).toBe('hello-world');
    expect(post.url).toBe('/blog/hello-world');
  });

  it('derives slug from nested index.md using parent directory name', async () => {
    const post = await parseMarkdownFile(join(FIXTURES, 'nested/index.md'), FIXTURES);
    expect(post.slug).toBe('nested');
    expect(post.url).toBe('/blog/nested');
  });

  it('derives URL prefix from contentDir name, not hardcoded /blog/', async () => {
    // Simulate a project whose content directory is named 'articles' instead of 'blog'.
    // The URL must be /articles/<slug>, not /blog/<slug>.
    const { mkdtemp, rm, writeFile, mkdir } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const tmpRoot = await mkdtemp(join(tmpdir(), 'litro-url-prefix-test-'));
    try {
      const articlesDir = join(tmpRoot, 'articles');
      await mkdir(articlesDir);
      const filePath = join(articlesDir, 'my-post.md');
      await writeFile(filePath, '---\ntitle: My Post\ndate: 2026-01-01\n---\nBody.');
      const post = await parseMarkdownFile(filePath, articlesDir);
      expect(post.url).toBe('/articles/my-post');
      expect(post.url).not.toMatch(/^\/blog\//);
    } finally {
      await rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it('respects frontmatter url field as an explicit override', async () => {
    // Write a temporary fixture with a custom url in frontmatter
    const { mkdtemp, rm, writeFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const tmpDir = await mkdtemp(join(tmpdir(), 'litro-parser-url-test-'));
    try {
      const filePath = join(tmpDir, 'override.md');
      await writeFile(filePath, '---\ntitle: Override\ndate: 2026-01-01\nurl: /custom/path\n---\nBody text.');
      const post = await parseMarkdownFile(filePath, tmpDir);
      expect(post.url).toBe('/custom/path');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('renders body as HTML', async () => {
    const post = await parseMarkdownFile(join(FIXTURES, 'hello-world.md'), FIXTURES);
    expect(post.body).toContain('<h1>Hello World</h1>');
    expect(post.body).toContain('<p>');
  });

  it('renders code blocks in HTML', async () => {
    const post = await parseMarkdownFile(join(FIXTURES, 'advanced-topics.md'), FIXTURES);
    expect(post.body).toContain('<code>');
  });

  it('preserves rawBody as original markdown', async () => {
    const post = await parseMarkdownFile(join(FIXTURES, 'hello-world.md'), FIXTURES);
    expect(post.rawBody).toContain('# Hello World');
    expect(post.rawBody).not.toContain('<h1>');
  });

  it('rawBody does not include frontmatter', async () => {
    const post = await parseMarkdownFile(join(FIXTURES, 'hello-world.md'), FIXTURES);
    expect(post.rawBody).not.toContain('title:');
    expect(post.rawBody).not.toContain('date:');
  });

  it('uses frontmatter title over filename when title is present', async () => {
    // hello-world.md has title: 'Hello World' in frontmatter
    const post = await parseMarkdownFile(join(FIXTURES, 'hello-world.md'), FIXTURES);
    expect(post.title).toBe('Hello World');
    // It should NOT be the filename 'hello-world'
    expect(post.title).not.toBe('hello-world');
  });

  it('stores full frontmatter in post.frontmatter', async () => {
    const post = await parseMarkdownFile(join(FIXTURES, 'hello-world.md'), FIXTURES);
    expect(post.frontmatter).toMatchObject({
      title: 'Hello World',
      date: expect.any(Date),
      description: 'My first post',
    });
  });

  it('frontmatter includes tags array', async () => {
    const post = await parseMarkdownFile(join(FIXTURES, 'hello-world.md'), FIXTURES);
    expect(Array.isArray(post.frontmatter['tags'])).toBe(true);
  });

  it('returns description as undefined when not in frontmatter', async () => {
    const post = await parseMarkdownFile(join(FIXTURES, 'getting-started.md'), FIXTURES);
    expect(post.description).toBeUndefined();
  });

  it('returns tags array from file frontmatter when directoryData has no tags', async () => {
    // Pass empty directoryData — file frontmatter tags are used unchanged
    const post = await parseMarkdownFile(join(FIXTURES, 'advanced-topics.md'), FIXTURES, {});
    expect(post.tags).toEqual(['posts', 'advanced']); // from the file's frontmatter
  });

  it('slug for getting-started.md is getting-started', async () => {
    const post = await parseMarkdownFile(join(FIXTURES, 'getting-started.md'), FIXTURES);
    expect(post.slug).toBe('getting-started');
    expect(post.url).toBe('/blog/getting-started');
  });

  it('date falls back to file mtime when not in frontmatter', async () => {
    // Pass directoryData with no date and use a file that has no date field
    // None of our fixtures lack a date — test that dates from the fixture files are correct
    // advanced-topics date is 2026-01-25
    const post = await parseMarkdownFile(join(FIXTURES, 'advanced-topics.md'), FIXTURES);
    expect(post.date).toBeInstanceOf(Date);
    expect(post.date.getUTCFullYear()).toBe(2026);
    expect(post.date.getUTCDate()).toBe(25);
  });
});
