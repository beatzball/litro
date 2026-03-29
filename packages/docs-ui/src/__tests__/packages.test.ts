import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../packages.js';

// ---------------------------------------------------------------------------
// renderMarkdown — markdown-to-HTML conversion used for README + CHANGELOG
// ---------------------------------------------------------------------------

describe('renderMarkdown', () => {
  it('converts a paragraph to <p>', async () => {
    const html = await renderMarkdown('Hello world.');
    expect(html).toContain('<p>Hello world.</p>');
  });

  it('converts ## heading to <h2>', async () => {
    const html = await renderMarkdown('## Installation');
    expect(html).toContain('<h2>Installation</h2>');
  });

  it('converts **bold** to <strong>', async () => {
    const html = await renderMarkdown('**bold text**');
    expect(html).toContain('<strong>bold text</strong>');
  });

  it('converts `inline code` to <code>', async () => {
    const html = await renderMarkdown('Use `npm install` to install.');
    expect(html).toContain('<code>npm install</code>');
  });

  it('converts fenced code block to <pre><code>', async () => {
    const md = '```ts\nconst x = 1;\n```';
    const html = await renderMarkdown(md);
    expect(html).toContain('<pre>');
    expect(html).toContain('<code');
  });

  it('converts unordered list to <ul><li>', async () => {
    const md = '- Alpha\n- Beta\n- Gamma';
    const html = await renderMarkdown(md);
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>Alpha</li>');
    expect(html).toContain('<li>Beta</li>');
  });

  it('converts GFM table to <table>', async () => {
    const md = '| Name | Version |\n|------|--------|\n| litro | 0.2.0 |';
    const html = await renderMarkdown(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<td>litro</td>');
  });

  it('converts [link](url) to <a>', async () => {
    const md = '[Lit](https://lit.dev)';
    const html = await renderMarkdown(md);
    expect(html).toContain('<a href="https://lit.dev">Lit</a>');
  });

  it('returns empty string for empty input', async () => {
    const html = await renderMarkdown('');
    expect(html.trim()).toBe('');
  });

  it('handles multiple sections', async () => {
    const md = '## Alpha\n\nParagraph one.\n\n## Beta\n\nParagraph two.';
    const html = await renderMarkdown(md);
    expect(html).toContain('<h2>Alpha</h2>');
    expect(html).toContain('<h2>Beta</h2>');
    expect(html).toContain('<p>Paragraph one.</p>');
  });
});
