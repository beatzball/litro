import { FASTElement, Observable, html, css, repeat, when } from '@microsoft/fast-element';
import type { TocEntry } from '../extract-headings.js';

/**
 * <starlight-toc .entries=${toc}>
 *   Renders the table of contents as anchor links.
 */
export class StarlightToc extends FASTElement {
  entries: TocEntry[] = [];

  handleClick(e: MouseEvent, slug: string) {
    e.preventDefault();
    const target = this._findDeep(document, slug);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
    history.pushState(null, '', `#${slug}`);
  }

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
}
Observable.defineProperty(StarlightToc.prototype, 'entries');

const template = html<StarlightToc>`
  ${when(x => x.entries.length > 0, html<StarlightToc>`
    <nav aria-label="On this page">
      <h2>On this page</h2>
      <ul>
        ${repeat(x => x.entries, html<TocEntry, StarlightToc>`
          <li class="depth-${x => x.depth}">
            <a
              href="#${x => x.slug}"
              aria-current="${x => typeof location !== 'undefined' && location.hash === '#' + x.slug ? 'true' : 'false'}"
              @click="${(x, c) => c.parent.handleClick(c.event as MouseEvent, x.slug)}"
            >${x => x.text}</a>
          </li>
        `)}
      </ul>
    </nav>
  `)}
`;

const styles = css`
  :host { display: block; }

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
`;

StarlightToc.define({ name: 'starlight-toc', template, styles });

export default StarlightToc;
