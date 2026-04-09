import { Elena, html, unsafeHTML } from '@elenajs/core';
import type { TocEntry } from '../extract-headings.js';

/**
 * <starlight-toc .entries=${toc}>
 *   Renders the table of contents as anchor links.
 *   Light DOM — no shadow root traversal needed for scroll targets.
 * </starlight-toc>
 */
export class StarlightToc extends Elena(HTMLElement) {
  static tagName = 'starlight-toc';
  static props = ['entries'];

  entries: TocEntry[] = [];

  handleClick(e: MouseEvent, slug: string) {
    e.preventDefault();
    // Light DOM — headings are directly queryable in the document
    const sel = `#${CSS.escape(slug)}`;
    const target = document.querySelector(sel);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
    history.pushState(null, '', `#${slug}`);
  }

  render() {
    if (!this.entries || this.entries.length === 0) return html``;

    const items = this.entries.map(entry =>
      `<li class="depth-${entry.depth}">
        <a href="#${entry.slug}" data-slug="${entry.slug}">${entry.text}</a>
      </li>`
    ).join('');

    return html`
      <style>
        @scope (starlight-toc) {
          :scope { display: block; }
          nav {
            position: sticky;
            top: calc(var(--sl-nav-height, 3.5rem) + 1rem);
            max-height: calc(100vh - var(--sl-nav-height, 3.5rem) - 2rem);
            overflow-y: auto;
            padding: 0 0.5rem;
          }
          h2 {
            font-size: var(--sl-text-xs, 0.75rem);
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--sl-color-gray-4, #757575);
            margin: 0 0 0.75rem;
            padding: 0;
            border: none;
          }
          ul { list-style: none; padding: 0; margin: 0; }
          li { margin: 0; }
          a {
            display: block;
            padding: 0.2rem 0;
            font-size: var(--sl-text-sm, 0.875rem);
            color: var(--sl-color-gray-4, #757575);
            text-decoration: none;
            transition: color 0.15s;
            border-left: 2px solid transparent;
          }
          a:hover { color: var(--sl-color-text, #23262f); }
          .depth-2 a { padding-left: 0.75rem; }
          .depth-3 a { padding-left: 1.5rem; }
          .depth-4 a { padding-left: 2.25rem; }
          li a[aria-current='true'] {
            color: var(--sl-color-accent, #7c3aed);
            border-left-color: var(--sl-color-accent, #7c3aed);
          }
        }
      </style>
      <nav aria-label="On this page">
        <h2>On this page</h2>
        <ul>${unsafeHTML(items)}</ul>
      </nav>
    `;
  }
}

StarlightToc.define();

export default StarlightToc;
