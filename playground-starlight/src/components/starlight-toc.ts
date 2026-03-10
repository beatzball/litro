import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { TocEntry } from '../extract-headings.js';

/**
 * <starlight-toc .entries=${toc}>
 *   Renders the table of contents as anchor links.
 *   Active section highlighting is handled by CSS :target pseudo-class.
 */
@customElement('starlight-toc')
export class StarlightToc extends LitElement {
  static override properties = {
    entries: { type: Array },
  };

  static override styles = css`
    :host {
      display: block;
    }

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

    ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    li {
      margin: 0;
    }

    a {
      display: block;
      padding: 0.2rem 0;
      font-size: var(--sl-text-sm, 0.875rem);
      color: var(--sl-color-gray-4, #757575);
      text-decoration: none;
      transition: color 0.15s;
      border-left: 2px solid transparent;
    }

    a:hover {
      color: var(--sl-color-text, #23262f);
    }

    /* Depth indentation */
    .depth-2 a { padding-left: 0.75rem; }
    .depth-3 a { padding-left: 1.5rem; }
    .depth-4 a { padding-left: 2.25rem; }

    /* Active via :target — the heading's id matches the URL hash */
    li:has(a:target) a,
    li a:target {
      color: var(--sl-color-accent, #7c3aed);
      border-left-color: var(--sl-color-accent, #7c3aed);
    }
  `;

  entries: TocEntry[] = [];

  override render() {
    if (!this.entries.length) return html``;
    return html`
      <nav aria-label="On this page">
        <h2>On this page</h2>
        <ul>
          ${this.entries.map(entry => html`
            <li class="depth-${entry.depth}">
              <a href="#${entry.slug}">${entry.text}</a>
            </li>
          `)}
        </ul>
      </nav>
    `;
  }
}

export default StarlightToc;
