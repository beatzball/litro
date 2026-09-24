import { describe, it, expect } from 'vitest';
import { buildDocsIndexGroups } from '../docs-index.js';

const SIDEBAR = [
  {
    label: 'Getting Started',
    items: [
      { label: 'Introduction', slug: 'introduction' },
      { label: 'Configuration', slug: 'configuration' },
    ],
  },
  {
    label: 'Packages',
    items: [{ label: '@beatzball/litro', slug: 'packages/litro' }],
  },
];

const POSTS = [
  { url: '/content/docs/introduction', description: 'What Litro is.' },
  { url: '/content/docs/configuration', description: '   ' },
  { url: '/content/blog/welcome', description: 'A blog post, not a doc.' },
];

describe('buildDocsIndexGroups', () => {
  it('keeps the sidebar grouping and order', () => {
    const groups = buildDocsIndexGroups(SIDEBAR, POSTS);
    expect(groups.map(g => g.label)).toEqual(['Getting Started', 'Packages']);
    expect(groups[0].items.map(i => i.label)).toEqual(['Introduction', 'Configuration']);
  });

  it('builds an href under /docs for every entry', () => {
    const groups = buildDocsIndexGroups(SIDEBAR, POSTS);
    expect(groups[0].items[0].href).toBe('/docs/introduction');
    expect(groups[1].items[0].href).toBe('/docs/packages/litro');
  });

  it('honors a custom base path', () => {
    const groups = buildDocsIndexGroups(SIDEBAR, POSTS, '/guide');
    expect(groups[0].items[0].href).toBe('/guide/introduction');
  });

  it("takes each entry's description from the matching docs post", () => {
    const groups = buildDocsIndexGroups(SIDEBAR, POSTS);
    expect(groups[0].items[0].description).toBe('What Litro is.');
  });

  it('gives a null description to a whitespace-only one', () => {
    const groups = buildDocsIndexGroups(SIDEBAR, POSTS);
    expect(groups[0].items[1].description).toBeNull();
  });

  it('keeps an entry that has no content file, with a null description', () => {
    const groups = buildDocsIndexGroups(SIDEBAR, POSTS);
    expect(groups[1].items[0]).toEqual({
      label: '@beatzball/litro',
      href: '/docs/packages/litro',
      description: null,
    });
  });

  it('ignores posts outside the docs collection', () => {
    const groups = buildDocsIndexGroups(
      [{ label: 'Blog', items: [{ label: 'Welcome', slug: 'welcome' }] }],
      POSTS,
    );
    expect(groups[0].items[0].description).toBeNull();
  });

  it('drops an empty group', () => {
    const groups = buildDocsIndexGroups([{ label: 'Empty', items: [] }], POSTS);
    expect(groups).toEqual([]);
  });
});
