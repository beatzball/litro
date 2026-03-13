import { describe, it, expect } from 'vitest';
import { extractHeadings, addHeadingIds } from '../extract-headings.js';

// ---------------------------------------------------------------------------
// extractHeadings
// ---------------------------------------------------------------------------

describe('extractHeadings', () => {
  it('extracts h2 headings', () => {
    const md = '## Installation\n\nSome text.';
    const toc = extractHeadings(md);
    expect(toc).toHaveLength(1);
    expect(toc[0]).toEqual({ depth: 2, text: 'Installation', slug: 'installation' });
  });

  it('extracts h3 and h4 headings', () => {
    const md = '### Config\n\n#### Advanced';
    const toc = extractHeadings(md);
    expect(toc).toHaveLength(2);
    expect(toc[0]).toMatchObject({ depth: 3, text: 'Config' });
    expect(toc[1]).toMatchObject({ depth: 4, text: 'Advanced' });
  });

  it('ignores h1 headings', () => {
    const md = '# Title\n\n## Section';
    const toc = extractHeadings(md);
    expect(toc).toHaveLength(1);
    expect(toc[0].depth).toBe(2);
  });

  it('ignores h5 and h6 headings', () => {
    const md = '##### Too deep\n\n###### Also too deep';
    expect(extractHeadings(md)).toHaveLength(0);
  });

  it('slugifies heading text to lowercase-hyphen form', () => {
    const md = '## Quick Start Guide';
    const [entry] = extractHeadings(md);
    expect(entry.slug).toBe('quick-start-guide');
  });

  it('strips {#custom-id} suffixes from heading text and slug', () => {
    const md = '## Overview {#overview-anchor}';
    const [entry] = extractHeadings(md);
    expect(entry.text).toBe('Overview');
    expect(entry.slug).toBe('overview');
  });

  it('strips special characters from slug', () => {
    const md = '## v0.2.0 — What\'s New?';
    const [entry] = extractHeadings(md);
    expect(entry.slug).not.toMatch(/[.'"—?]/);
    expect(entry.slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('returns empty array for markdown with no qualifying headings', () => {
    const md = 'Just a paragraph.\n\nAnother one.';
    expect(extractHeadings(md)).toHaveLength(0);
  });

  it('extracts headings from multiple sections', () => {
    const md = '## Alpha\n\n### Beta\n\n## Gamma\n\n#### Delta';
    const toc = extractHeadings(md);
    expect(toc).toHaveLength(4);
    expect(toc.map(e => e.text)).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
  });
});

// ---------------------------------------------------------------------------
// addHeadingIds
// ---------------------------------------------------------------------------

describe('addHeadingIds', () => {
  it('adds id attributes to h2 elements', () => {
    const html = '<h2>Installation</h2>';
    expect(addHeadingIds(html)).toBe('<h2 id="installation">Installation</h2>');
  });

  it('adds id attributes to h3 and h4 elements', () => {
    const html = '<h3>Config</h3><h4>Advanced</h4>';
    const out = addHeadingIds(html);
    expect(out).toContain('<h3 id="config">');
    expect(out).toContain('<h4 id="advanced">');
  });

  it('does not modify h1 elements', () => {
    const html = '<h1>Title</h1><h2>Section</h2>';
    const out = addHeadingIds(html);
    expect(out).toContain('<h1>Title</h1>');
    expect(out).toContain('<h2 id="section">');
  });

  it('deduplicates identical slugs with a counter suffix', () => {
    const html = '<h2>Features</h2><h2>Features</h2><h2>Features</h2>';
    const out = addHeadingIds(html);
    expect(out).toContain('id="features"');
    expect(out).toContain('id="features-2"');
    expect(out).toContain('id="features-3"');
  });

  it('does not add id when one is already present', () => {
    const html = '<h2 id="existing">Section</h2>';
    expect(addHeadingIds(html)).toBe('<h2 id="existing">Section</h2>');
  });

  it('strips inline HTML tags before computing the slug', () => {
    const html = '<h2><code>useState</code></h2>';
    const out = addHeadingIds(html);
    expect(out).toContain('id="usestate"');
  });

  it('returns unchanged HTML when there are no heading elements', () => {
    const html = '<p>Just text.</p>';
    expect(addHeadingIds(html)).toBe(html);
  });
});
