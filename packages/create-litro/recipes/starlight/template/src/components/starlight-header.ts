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
    }

    header {
      position: sticky;
      top: 0;
      z-index: 100;
      height: var(--sl-nav-height, 3.5rem);
      background-color: var(--sl-color-bg-nav, #fff);
      border-bottom: 1px solid var(--sl-color-border, #e8e8e8);
      display: flex;
      align-items: center;
      padding: 0 var(--sl-content-pad-x, 1.5rem);
      gap: 1.5rem;
    }

    .site-title {
      font-size: var(--sl-text-lg, 1.125rem);
      font-weight: 700;
      color: var(--sl-color-text, #23262f);
      text-decoration: none;
      white-space: nowrap;
    }

    .site-title:hover { opacity: 0.85; }

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

    .theme-toggle {
      margin-left: auto;
      appearance: none;
      background: none;
      border: 1px solid var(--sl-color-border, #e8e8e8);
      border-radius: var(--sl-border-radius, 0.375rem);
      width: 2.25rem;
      height: 2.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 1rem;
      color: var(--sl-color-text, #23262f);
      transition: background-color 0.15s;
      flex-shrink: 0;
    }

    .theme-toggle:hover {
      background-color: var(--sl-color-gray-2, #e8e8e8);
    }
  `;

  siteTitle = '';
  nav: NavItem[] = [];
  currentPath = '';

  _theme = 'light';

  override firstUpdated() {
    const stored = (typeof localStorage !== 'undefined'
      ? localStorage.getItem('sl-theme')
      : null) ?? 'light';
    this._theme = stored;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', stored);
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
    const icon = this._theme === 'dark' ? '☀️' : '🌙';
    const label = this._theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

    return html`
      <header>
        <a class="site-title" href="/">${this.siteTitle}</a>
        <nav aria-label="Main navigation">
          ${this.nav.map(item => html`
            <a
              href="${item.href}"
              aria-current="${this.currentPath.startsWith(item.href) ? 'page' : 'false'}"
            >${item.label}</a>
          `)}
        </nav>
        <button
          class="theme-toggle"
          aria-label="${label}"
          @click="${this._toggleTheme}"
        >${icon}</button>
      </header>
    `;
  }
}

export default StarlightHeader;
