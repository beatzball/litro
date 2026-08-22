import { describe, it, expect } from 'vitest';
import {
  existingGroups,
  parseFrontmatter,
  buildSidebar,
  renderSidebar,
  replaceSidebarBlock,
  findProblems,
  type DocsPage,
} from './docs.js';

function page(over: Partial<DocsPage> = {}): DocsPage {
  return {
    slug: 'a',
    relPath: 'content/docs/a.md',
    title: 'A',
    description: 'desc',
    label: 'A',
    group: 'Documentation',
    order: null,
    ...over,
  };
}

describe('parseFrontmatter', () => {
  it('reads flat fields and strips quotes', () => {
    const fm = parseFrontmatter(`---\ntitle: "Getting Started"\ndescription: 'One line.'\n---\n\n## Body`);
    expect(fm.title).toBe('Getting Started');
    expect(fm.description).toBe('One line.');
  });

  it('reads the nested sidebar map as dotted keys', () => {
    const fm = parseFrontmatter(`---\ntitle: T\nsidebar:\n  order: 3\n  group: Guides\n---\n`);
    expect(fm['sidebar.order']).toBe('3');
    expect(fm['sidebar.group']).toBe('Guides');
  });

  it('returns nothing when there is no frontmatter', () => {
    expect(parseFrontmatter('# Just a heading\n')).toEqual({});
  });

  it('does not treat a --- inside the body as a frontmatter fence', () => {
    // A horizontal rule after the real block must not extend it.
    const fm = parseFrontmatter(`---\ntitle: T\n---\n\n## Body\n\n---\n\nmore`);
    expect(fm.title).toBe('T');
    expect(Object.keys(fm)).toEqual(['title']);
  });
});

describe('buildSidebar', () => {
  it('orders pages within a group by sidebar.order', () => {
    const groups = buildSidebar([
      page({ slug: 'c', title: 'C', order: 3 }),
      page({ slug: 'a', title: 'A', order: 1 }),
      page({ slug: 'b', title: 'B', order: 2 }),
    ]);
    expect(groups[0].items.map((i) => i.slug)).toEqual(['a', 'b', 'c']);
  });

  it('keeps unordered pages, sorting them last by title', () => {
    // A page that forgets `order` must stay reachable, not vanish.
    const groups = buildSidebar([
      page({ slug: 'zebra', title: 'Zebra', order: null }),
      page({ slug: 'apple', title: 'Apple', order: null }),
      page({ slug: 'first', title: 'First', order: 1 }),
    ]);
    expect(groups[0].items.map((i) => i.slug)).toEqual(['first', 'apple', 'zebra']);
  });

  it('orders groups by their lowest-ordered page', () => {
    const groups = buildSidebar([
      page({ slug: 'g2', title: 'G2', group: 'Second', order: 10 }),
      page({ slug: 'g1', title: 'G1', group: 'First', order: 1 }),
    ]);
    expect(groups.map((g) => g.label)).toEqual(['First', 'Second']);
  });

  it('falls back to the slug when a title is empty', () => {
    const groups = buildSidebar([page({ slug: 'no-title', title: '', label: '' })]);
    expect(groups[0].items[0].label).toBe('no-title');
  });

  it('uses sidebar.label to override the sidebar text without changing the title', () => {
    const groups = buildSidebar([page({ slug: 'x', title: 'A Very Long Page Title', label: 'Short' })]);
    expect(groups[0].items[0].label).toBe('Short');
  });
});

describe('replaceSidebarBlock', () => {
  const config = `export const siteConfig = {
  title: 'x',
  sidebar: [
    {
      label: 'Old',
      items: [
        { label: 'One', slug: 'one' },
      ],
    },
  ],
};
`;

  it('replaces the sidebar and leaves the rest untouched', () => {
    const out = replaceSidebarBlock(config, renderSidebar(buildSidebar([page()])))!;
    expect(out).toContain("title: 'x'");
    expect(out).not.toContain("label: 'Old'");
    expect(out).toContain("slug: 'a'");
    expect(out.trimEnd().endsWith('};')).toBe(true);
  });

  it('produces a config that still parses as one object', () => {
    const out = replaceSidebarBlock(config, renderSidebar(buildSidebar([page()])))!;
    // Balanced braces and exactly one sidebar key -- a second one would lose
    // silently to the first at runtime.
    expect(out.split('{').length).toBe(out.split('}').length);
    expect(out.match(/sidebar: \[/g)).toHaveLength(1);
  });

  it('returns null when there is no sidebar block, rather than appending one', () => {
    expect(replaceSidebarBlock('export const siteConfig = { title: 1 };', '  sidebar: [],')).toBeNull();
  });

  it('is not confused by a bracket inside a label', () => {
    const tricky = `export const siteConfig = {
  sidebar: [
    { label: 'Arrays [and] things', items: [{ label: 'x', slug: 'x' }] },
  ],
  nav: [],
};
`;
    const out = replaceSidebarBlock(tricky, '  sidebar: [],')!;
    expect(out).toContain('nav: []');
    expect(out).not.toContain('Arrays [and] things');
  });
});

describe('findProblems', () => {
  const src = (body: string) => new Map([['content/docs/a.md', body]]);

  it('is quiet on a well-formed page', () => {
    expect(findProblems([page()], src('---\ntitle: A\n---\n\n## Body'))).toEqual([]);
  });

  it('reports a missing title and description', () => {
    const found = findProblems([page({ title: '', description: '' })], src('---\n---\n'));
    expect(found.map((p) => p.kind).sort()).toEqual(['missing description', 'missing title']);
  });

  it('reports a body that opens with its own h1', () => {
    const found = findProblems([page()], src('---\ntitle: A\n---\n\n# Duplicate\n'));
    expect(found.map((p) => p.kind)).toContain('duplicate h1');
  });

  it('does not mistake a deep heading for an h1', () => {
    const found = findProblems([page()], src('---\ntitle: A\n---\n\n## Fine\n### Also fine\n'));
    expect(found).toEqual([]);
  });

  it('reports colliding slugs once, naming every file involved', () => {
    const found = findProblems(
      [
        page({ slug: 'dup', relPath: 'content/docs/dup.md' }),
        page({ slug: 'dup', relPath: 'content/blog/dup.md' }),
      ],
      new Map([
        ['content/docs/dup.md', '---\ntitle: A\n---\n'],
        ['content/blog/dup.md', '---\ntitle: A\n---\n'],
      ]),
    );
    const dupes = found.filter((p) => p.kind === 'duplicate slug');
    expect(dupes).toHaveLength(1);
    expect(dupes[0].relPath).toBe('content/blog/dup.md, content/docs/dup.md');
  });
});

describe('existingGroups', () => {
  const grouped = `export const siteConfig = {
  nav: [],
  sidebar: [
    {
      label: 'Start Here',
      items: [
        { label: 'Getting Started', slug: 'getting-started' },
        { label: 'Setup',           slug: 'setup' },
      ],
    },
    {
      label: 'Reference',
      items: [
        { label: 'How It Works', slug: 'how-it-works' },
      ],
    },
  ],
};
`;

  it('reads each group and the slugs it owns', () => {
    const groups = existingGroups(grouped);
    expect([...groups.keys()]).toEqual(['Start Here', 'Reference']);
    expect(groups.get('Start Here')).toEqual(['getting-started', 'setup']);
    expect(groups.get('Reference')).toEqual(['how-it-works']);
  });

  it('returns nothing when there is no sidebar block', () => {
    expect(existingGroups('export const siteConfig = { title: 1 };').size).toBe(0);
  });

  it('does not pick up slugs from nav or other keys', () => {
    // Only the sidebar block counts -- a nav link is not a sidebar entry.
    const withNav = grouped.replace("nav: [],", "nav: [{ label: 'Docs', slug: 'not-a-sidebar-entry' }],");
    const all = [...existingGroups(withNav).values()].flat();
    expect(all).not.toContain('not-a-sidebar-entry');
  });
});

describe('sync round-trip', () => {
  it('a rebuilt sidebar still contains every page exactly once', () => {
    const pages = [
      page({ slug: 'a', title: 'A', group: 'One', order: 1 }),
      page({ slug: 'b', title: 'B', group: 'Two', order: 2 }),
      page({ slug: 'c', title: 'C', group: 'One', order: 3 }),
    ];
    const config = `export const siteConfig = {\n  sidebar: [\n  ],\n};\n`;
    const out = replaceSidebarBlock(config, renderSidebar(buildSidebar(pages)))!;
    const slugs = [...out.matchAll(/slug: '([^']+)'/g)].map((m) => m[1]).sort();
    expect(slugs).toEqual(['a', 'b', 'c']);
    // and the groups survive the round trip
    expect([...existingGroups(out).keys()]).toEqual(['One', 'Two']);
  });
});
