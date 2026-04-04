import { describe, it, expect } from 'vitest';
import { truncate, defaultOgTemplate } from '../og-template.js';

describe('truncate', () => {
  it('returns original string when under max length', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates and adds "..." when over max length', () => {
    expect(truncate('hello world', 5)).toBe('hello...');
  });

  it('returns original when exactly at max length', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });
});

describe('defaultOgTemplate', () => {
  const baseInput = { title: 'Test Page', siteName: 'Litro' };

  function root(overrides = {}) {
    return defaultOgTemplate({ ...baseInput, ...overrides }) as any;
  }

  it('returns a valid root node with correct dimensions and background', () => {
    const r = root();
    expect(r.type).toBe('div');
    expect(r.props.style.width).toBe(1200);
    expect(r.props.style.height).toBe(630);
    expect(r.props.style.backgroundColor).toBe('#0d0e11');
  });

  it('root has 3 children (top row, center, bottom row)', () => {
    const r = root();
    expect(r.props.children).toHaveLength(3);
  });

  it('site name appears in top row', () => {
    const r = root();
    const topRow = r.props.children[0];
    const siteNameNode = topRow.props.children[0];
    expect(siteNameNode.props.children).toBe('Litro');
  });

  it('title appears in center section', () => {
    const r = root();
    const center = r.props.children[1];
    const titleNode = center.props.children[0];
    expect(titleNode.props.children).toBe('Test Page');
  });

  it('description appears when provided', () => {
    const r = root({ description: 'A short description' });
    const center = r.props.children[1];
    expect(center.props.children).toHaveLength(2);
    expect(center.props.children[1].props.children).toBe('A short description');
  });

  it('description is absent when not provided', () => {
    const r = root();
    const center = r.props.children[1];
    expect(center.props.children).toHaveLength(1);
  });

  it('long title (>60 chars) uses smaller font size 40', () => {
    const longTitle = 'A'.repeat(61);
    const r = root({ title: longTitle });
    const center = r.props.children[1];
    const titleNode = center.props.children[0];
    expect(titleNode.props.style.fontSize).toBe(40);
  });

  it('short title (<=60 chars) uses font size 48', () => {
    const r = root({ title: 'Short title' });
    const center = r.props.children[1];
    const titleNode = center.props.children[0];
    expect(titleNode.props.style.fontSize).toBe(48);
  });

  it('title is truncated at 80 chars', () => {
    const longTitle = 'A'.repeat(100);
    const r = root({ title: longTitle });
    const center = r.props.children[1];
    const titleNode = center.props.children[0];
    expect(titleNode.props.children).toBe('A'.repeat(80) + '...');
  });

  it('description is truncated at 120 chars', () => {
    const longDesc = 'B'.repeat(150);
    const r = root({ description: longDesc });
    const center = r.props.children[1];
    const descNode = center.props.children[1];
    expect(descNode.props.children).toBe('B'.repeat(120) + '...');
  });

  it('type badge appears when type is "article"', () => {
    const r = root({ type: 'article' });
    const bottomRow = r.props.children[2];
    expect(bottomRow.props.children).toHaveLength(2);
    const badge = bottomRow.props.children[1];
    expect(badge.props.children).toBe('article');
  });

  it('type badge does NOT appear when type is "website"', () => {
    const r = root({ type: 'website' });
    const bottomRow = r.props.children[2];
    expect(bottomRow.props.children).toHaveLength(1);
  });

  it('type badge does NOT appear when type is undefined', () => {
    const r = root();
    const bottomRow = r.props.children[2];
    expect(bottomRow.props.children).toHaveLength(1);
  });

  it('custom accentColor is applied to the gradient bar', () => {
    const r = root({ accentColor: '#ff0000' });
    const bottomRow = r.props.children[2];
    const gradientBar = bottomRow.props.children[0];
    expect(gradientBar.props.style.background).toContain('#ff0000');
  });

  it('default accentColor is #ea580c when not provided', () => {
    const r = root();
    const bottomRow = r.props.children[2];
    const gradientBar = bottomRow.props.children[0];
    expect(gradientBar.props.style.background).toContain('#ea580c');
  });
});
