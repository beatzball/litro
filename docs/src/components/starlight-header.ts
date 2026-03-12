import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

export interface NavItem {
  label: string;
  href: string;
}

/**
 * <starlight-header siteTitle="My Docs" .nav=${nav} currentPath="/docs/getting-started">
 *   Top navigation bar with site title, nav links, and dark/light theme toggle.
 */
@customElement('starlight-header')
export class StarlightHeader extends LitElement {
  static override properties = {
    siteTitle: { type: String },
    nav: { type: Array },
    currentPath: { type: String },
    _theme: { type: String, state: true },
  };

  static override styles = css`
    :host {
      display: block;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    header {
      height: var(--sl-nav-height, 3.5rem);
      background-color: var(--sl-color-bg-nav, #fff);
      border-bottom: 1px solid var(--sl-color-border, #e8e8e8);
      display: flex;
      align-items: center;
      padding: 0 var(--sl-content-pad-x, 1.5rem);
      gap: 1.5rem;
    }

    .site-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: var(--sl-text-lg, 1.125rem);
      font-weight: 700;
      color: var(--sl-color-text, #23262f);
      text-decoration: none;
      white-space: nowrap;
    }

    .site-title:hover { opacity: 0.85; }

    .site-logo {
      width: 1.75rem;
      height: 1.75rem;
      object-fit: contain;
      flex-shrink: 0;
    }

    nav {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      flex: 1;
    }

    nav a {
      padding: 0.35rem 0.75rem;
      font-size: var(--sl-text-sm, 0.875rem);
      font-weight: 500;
      color: var(--sl-color-gray-5, #4b4b4b);
      text-decoration: none;
      border-radius: var(--sl-border-radius, 0.375rem);
      transition: color 0.15s, background-color 0.15s;
    }

    nav a:hover {
      color: var(--sl-color-text, #23262f);
      background-color: var(--sl-color-gray-2, #e8e8e8);
    }

    nav a[aria-current='page'] {
      color: var(--sl-color-accent, #7c3aed);
      background-color: var(--sl-color-accent-low, #ede9fe);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      margin-left: auto;
    }

    .github-link {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: var(--sl-border-radius, 0.375rem);
      color: var(--sl-color-gray-5, #4b4b4b);
      text-decoration: none;
      transition: color 0.15s, background-color 0.15s;
    }

    .github-link:hover {
      color: var(--sl-color-text, #23262f);
      background-color: var(--sl-color-gray-2, #e8e8e8);
    }

    .github-link svg {
      width: 1.2rem;
      height: 1.2rem;
      fill: currentColor;
    }

    sl-icon-button {
      font-size: 1.1rem;
      color: var(--sl-color-text, #23262f);
    }
  `;

  siteTitle = '';
  nav: NavItem[] = [];
  currentPath = '';

  _theme = 'light';

  override firstUpdated() {
    const stored = typeof localStorage !== 'undefined'
      ? localStorage.getItem('sl-theme')
      : null;
    const resolved = stored ?? (
      typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    );
    this._theme = resolved;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', resolved);
    }
  }

  private _toggleTheme() {
    const next = this._theme === 'light' ? 'dark' : 'light';
    this._theme = next;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sl-theme', next);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', next);
    }
  }

  override render() {
    const icon = this._theme === 'dark' ? 'sun' : 'moon';
    const label = this._theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

    const regularNav = this.nav.filter(item => !item.href.includes('github.com'));
    const githubItem = this.nav.find(item => item.href.includes('github.com'));

    return html`
      <header>
        <a class="site-title" href="/">
          <img class="site-logo" src="/logo.png" alt="" aria-hidden="true" />
          ${this.siteTitle}
        </a>
        <nav aria-label="Main navigation">
          ${regularNav.map(item => html`
            <a
              href="${item.href}"
              aria-current="${this.currentPath.startsWith(item.href) ? 'page' : 'false'}"
            >${item.label}</a>
          `)}
        </nav>
        <div class="header-actions">
          ${githubItem ? html`
            <a class="github-link" href="${githubItem.href}" target="_blank" rel="noopener" aria-label="GitHub">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
            </a>
          ` : ''}
          <sl-icon-button
            name="${icon}"
            label="${label}"
            @click="${this._toggleTheme}"
          ></sl-icon-button>
        </div>
      </header>
    `;
  }
}

export default StarlightHeader;
