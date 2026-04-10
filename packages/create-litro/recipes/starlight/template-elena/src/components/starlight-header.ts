import { Elena, html, unsafeHTML } from '@elenajs/core';

export interface NavItem {
  label: string;
  href: string;
}

/**
 * <starlight-header sitetitle="My Docs" .nav=${nav} currentpath="/docs/getting-started">
 *   Top navigation bar with site title, nav links, and dark/light theme toggle.
 *   Light DOM — styles scoped via @scope.
 * </starlight-header>
 */
export class StarlightHeader extends Elena(HTMLElement) {
  static tagName = 'starlight-header';
  static props = ['sitetitle', 'nav', 'currentpath', 'navopen', 'hassidebar', '_theme'];

  sitetitle = '';
  nav: NavItem[] = [];
  currentpath = '';
  navopen = false;
  hassidebar = false;
  _theme = 'light';

  private _initialized = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this._initialized && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('sl-theme') ?? 'light';
      this._theme = stored;
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', stored);
      }
      this._initialized = true;
    }
    // Elena renders plain HTML — wire up click events via delegation
    this.addEventListener('click', this._handleClick);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('click', this._handleClick);
  }

  private _handleClick = (e: Event) => {
    const btn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    if (action === 'toggle-theme') this.toggleTheme();
    else if (action === 'toggle-nav') this.toggleNav();
  };

  toggleTheme() {
    const next = this._theme === 'light' ? 'dark' : 'light';
    this._theme = next;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sl-theme', next);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', next);
    }
  }

  toggleNav() {
    this.dispatchEvent(
      new CustomEvent('sl-nav-toggle', { bubbles: true, composed: true }),
    );
  }

  render() {
    const menuBtnClass = this.hassidebar
      ? `menu-btn${this.navopen ? ' nav-open' : ''}`
      : 'menu-btn menu-btn-hidden';

    const navLinks = (this.nav || []).map(item => {
      const current = this.currentpath.startsWith(item.href) ? 'page' : 'false';
      return `<a href="${item.href}" aria-current="${current}">${item.label}</a>`;
    }).join('');

    const themeLabel = this._theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    const themeIcon = this._theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';

    return html`
      <style>
        @scope (starlight-header) {
          :scope {
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
            gap: 1rem;
          }
          .menu-btn {
            display: none;
            appearance: none;
            background: none;
            border: 1px solid var(--sl-color-border, #e8e8e8);
            border-radius: var(--sl-border-radius, 0.375rem);
            width: 2.25rem;
            height: 2.25rem;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: var(--sl-color-text, #23262f);
            transition: background-color 0.15s;
            flex-shrink: 0;
            padding: 0;
          }
          .menu-btn:hover { background-color: var(--sl-color-gray-2, #e8e8e8); }
          .menu-btn svg { width: 1.1rem; height: 1.1rem; }
          .menu-btn-hidden { display: none !important; }
          .menu-btn .icon-close { display: none; }
          .menu-btn.nav-open .icon-hamburger { display: none; }
          .menu-btn.nav-open .icon-close { display: block; }
          @media (max-width: 72rem) {
            .menu-btn:not(.menu-btn-hidden) { display: flex; }
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
          .theme-toggle:hover { background-color: var(--sl-color-gray-2, #e8e8e8); }
        }
      </style>
      <header>
        <button class="${menuBtnClass}" aria-label="${this.navopen ? 'Close navigation' : 'Open navigation'}" aria-expanded="${this.navopen}" data-action="toggle-nav">
          <svg class="icon-hamburger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
          <svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <a class="site-title" href="/">${this.sitetitle}</a>
        <nav aria-label="Main navigation">${unsafeHTML(navLinks)}</nav>
        <button class="theme-toggle" aria-label="${themeLabel}" data-action="toggle-theme">${themeIcon}</button>
      </header>
    `;
  }
}

StarlightHeader.define();

export default StarlightHeader;
