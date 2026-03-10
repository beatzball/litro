import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

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
 *   The active item (matching currentSlug) is highlighted with aria-current.
 */
@customElement('starlight-sidebar')
export class StarlightSidebar extends LitElement {
  static override properties = {
    groups: { type: Array },
    currentSlug: { type: String },
  };

  static override styles = css`
    :host {
      display: block;
    }

    nav {
      padding: 1rem 0;
    }

    .group {
      margin-bottom: 1.5rem;
    }

    .group-label {
      font-size: var(--sl-text-xs, 0.75rem);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--sl-color-gray-4, #757575);
      padding: 0 1rem;
      margin: 0 0 0.5rem;
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

  groups: SidebarGroup[] = [];
  currentSlug = '';

  override render() {
    return html`
      <nav aria-label="Site navigation">
        ${this.groups.map(group => html`
          <div class="group">
            <p class="group-label">${group.label}</p>
            <ul>
              ${group.items.map(item => html`
                <li>
                  <a
                    href="/docs/${item.slug}"
                    aria-current="${this.currentSlug === item.slug ? 'page' : 'false'}"
                  >
                    <span>${item.label}</span>
                    ${item.badge ? html`<span class="badge">${item.badge.text}</span>` : ''}
                  </a>
                </li>
              `)}
            </ul>
          </div>
        `)}
      </nav>
    `;
  }
}

export default StarlightSidebar;
