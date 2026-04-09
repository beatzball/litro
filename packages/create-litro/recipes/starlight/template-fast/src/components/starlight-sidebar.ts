import { FASTElement, Observable, html, css, repeat } from '@microsoft/fast-element';

export interface SidebarItem {
  label: string;
  slug: string;
  badge?: { text: string; variant?: string };
}

export interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

/**
 * <starlight-sidebar .groups=${sidebar} currentSlug="getting-started">
 *   Renders grouped navigation links for the docs sidebar.
 */
export class StarlightSidebar extends FASTElement {
  groups: SidebarGroup[] = [];
  currentSlug = '';
}
Observable.defineProperty(StarlightSidebar.prototype, 'groups');
Observable.defineProperty(StarlightSidebar.prototype, 'currentSlug');

const template = html<StarlightSidebar>`
  <nav aria-label="Site navigation">
    ${repeat(x => x.groups, html<SidebarGroup, StarlightSidebar>`
      <div class="group">
        <p class="group-label">${x => x.label}</p>
        <ul>
          ${repeat(x => x.items, html<SidebarItem, StarlightSidebar>`
            <li>
              <a
                href="/docs/${x => x.slug}"
                aria-current="${(x, c) => c.parentContext.parent.currentSlug === x.slug ? 'page' : 'false'}"
              >
                <span>${x => x.label}</span>
                ${(x) => x.badge ? html`<span class="badge">${x.badge.text}</span>` : ''}
              </a>
            </li>
          `)}
        </ul>
      </div>
    `)}
  </nav>
`;

const styles = css`
  :host { display: block; }
  nav { padding: 1rem 0; }
  .group { margin-bottom: 1.5rem; }

  .group-label {
    font-size: var(--sl-text-xs, 0.75rem);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--sl-color-gray-4, #757575);
    padding: 0 1rem;
    margin: 0 0 0.5rem;
  }

  ul { list-style: none; padding: 0; margin: 0; }
  li { margin: 0; }

  a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.35rem 1rem;
    font-size: var(--sl-text-sm, 0.875rem);
    color: var(--sl-color-gray-5, #4b4b4b);
    text-decoration: none;
    border-left: 2px solid transparent;
    transition: color 0.15s, background-color 0.15s;
  }

  a:hover {
    color: var(--sl-color-text, #23262f);
    background-color: var(--sl-color-gray-2, #e8e8e8);
  }

  a[aria-current='page'] {
    color: var(--sl-color-accent, #7c3aed);
    border-left-color: var(--sl-color-accent, #7c3aed);
    background-color: var(--sl-color-accent-low, #ede9fe);
    font-weight: 600;
  }

  .badge {
    display: inline-block;
    padding: 0.1em 0.45em;
    font-size: var(--sl-text-xs, 0.75rem);
    font-weight: 600;
    border-radius: 9999px;
    background-color: var(--sl-color-accent-low, #ede9fe);
    color: var(--sl-color-accent-high, #5b21b6);
    margin-left: 0.5rem;
  }
`;

StarlightSidebar.define({ name: 'starlight-sidebar', template, styles });

export default StarlightSidebar;
