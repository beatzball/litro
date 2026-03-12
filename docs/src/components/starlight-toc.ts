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

    /* Active via [aria-current] set by the click handler */
    li a[aria-current='true'] {
      color: var(--sl-color-accent, #7c3aed);
      border-left-color: var(--sl-color-accent, #7c3aed);
    }
  `;

  entries: TocEntry[] = [];

  /**
   * Click handler for TOC anchor links.
   *
   * Heading elements rendered via unsafeHTML live inside shadow roots that
   * native fragment navigation and document.getElementById() cannot reach.
   * Instead of relying on the browser's default hash navigation (which also
   * fires popstate and re-renders the page component with no data), we:
   *   1. Prevent the default navigation.
   *   2. Walk the shadow tree to find the target element.
   *   3. Scroll to it smoothly.
   *   4. Update the URL hash via pushState (does not fire popstate).
   */
  private _handleClick(e: MouseEvent, slug: string) {
    e.preventDefault();
    const target = this._findDeep(document, slug);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
    history.pushState(null, '', `#${slug}`);
  }

  /** Recursively searches shadow roots for an element matching the CSS id selector. */
  private _findDeep(root: Document | ShadowRoot | Element, id: string): Element | null {
    const sel = `#${CSS.escape(id)}`;
    const direct = root.querySelector(sel);
    if (direct) return direct;
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) {
        const found = this._findDeep(el.shadowRoot, id);
        if (found) return found;
      }
    }
    return null;
  }

  override render() {
    if (!this.entries.length) return html``;
    const currentHash = typeof location !== 'undefined' ? location.hash : '';
    return html`
      <nav aria-label="On this page">
        <h2>On this page</h2>
        <ul>
          ${this.entries.map(entry => html`
            <li class="depth-${entry.depth}">
              <a
                href="#${entry.slug}"
                aria-current="${currentHash === '#' + entry.slug ? 'true' : 'false'}"
                @click=${(e: MouseEvent) => this._handleClick(e, entry.slug)}
              >${entry.text}</a>
            </li>
          `)}
        </ul>
      </nav>
    `;
  }
}

export default StarlightToc;
