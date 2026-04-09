import { FASTElement, Observable, html, css, repeat, when } from '@microsoft/fast-element';

export interface NavItem {
  label: string;
  href: string;
}

const hamburgerSvg = html`
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
`;

const closeSvg = html`
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
`;

/**
 * <starlight-header siteTitle="My Docs" .nav=${nav} currentPath="/docs/getting-started">
 *   Top navigation bar with site title, nav links, and dark/light theme toggle.
 */
export class StarlightHeader extends FASTElement {
  siteTitle = '';
  nav: NavItem[] = [];
  currentPath = '';
  navOpen = false;
  hasSidebar = false;
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
  }

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
}
Observable.defineProperty(StarlightHeader.prototype, 'siteTitle');
Observable.defineProperty(StarlightHeader.prototype, 'nav');
Observable.defineProperty(StarlightHeader.prototype, 'currentPath');
Observable.defineProperty(StarlightHeader.prototype, 'navOpen');
Observable.defineProperty(StarlightHeader.prototype, 'hasSidebar');
Observable.defineProperty(StarlightHeader.prototype, '_theme');

const template = html<StarlightHeader>`
  <header>
    ${when(x => x.hasSidebar, html<StarlightHeader>`
      <button
        class="menu-btn"
        aria-label="${x => x.navOpen ? 'Close navigation' : 'Open navigation'}"
        aria-expanded="${x => x.navOpen}"
        @click="${x => x.toggleNav()}"
      >
        ${x => x.navOpen ? closeSvg : hamburgerSvg}
      </button>
    `)}
    <a class="site-title" href="/">${x => x.siteTitle}</a>
    <nav aria-label="Main navigation">
      ${repeat(x => x.nav, html<NavItem, StarlightHeader>`
        <a
          href="${x => x.href}"
          aria-current="${(x, c) => c.parent.currentPath.startsWith(x.href) ? 'page' : 'false'}"
        >${x => x.label}</a>
      `)}
    </nav>
    <button
      class="theme-toggle"
      aria-label="${x => x._theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}"
      @click="${x => x.toggleTheme()}"
    >
      ${x => x._theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}
    </button>
  </header>
`;

const styles = css`
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

  @media (max-width: 72rem) {
    .menu-btn { display: flex; }
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
`;

StarlightHeader.define({ name: 'starlight-header', template, styles });

export default StarlightHeader;
