import { Elena, html, unsafeHTML } from '@elenajs/core';

export interface NavItem {
  label: string;
  href: string;
}

/**
 * A real browser, not a server DOM shim.
 *
 * `typeof document !== 'undefined'` is NOT enough. A server-side DOM shim can
 * define `document` and still leave `documentElement` undefined, which is how
 * the FAST copy of this header threw
 * "Cannot read properties of undefined (reading 'getAttribute')" during SSR
 * and took down every page that carried it. Elena's SSR runs only
 * willUpdate() and render() (see `.agents/rules/adapters-ssr.md`, SSR-002),
 * so this copy never reached the bug — but the three adapter copies are read
 * against each other, and the shape has to be the same in all of them.
 *
 * Guard on the thing you are about to touch, not on a global a shim provides.
 */
function themeRoot(): HTMLElement | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.documentElement ?? undefined;
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

  /**
   * Keep the toggle's icon on the theme the page is actually showing.
   *
   * THIS READS, IT DOES NOT DECIDE. The head script in route-meta.ts sets
   * data-theme before the first paint, from the reader's stored choice or,
   * when they have made none, from the system. This used to resolve it a
   * second time and fall back to 'light' with no look at
   * prefers-color-scheme, so on a dark system every page carrying the header
   * flipped to light right after it loaded.
   */
  private _readTheme = (): void => {
    if (!themeRoot()) return;
    this._theme =
      document.documentElement.getAttribute('data-theme') === 'dark'
        ? 'dark'
        : 'light';
  };

  private _systemTheme?: MediaQueryList;

  override connectedCallback(): void {
    super.connectedCallback();
    // With no documentElement there is no theme to read and no system
    // preference worth listening to. A server DOM shim reaches here.
    if (themeRoot()) {
      this._readTheme();
      // The head script follows the system while the reader has stored no
      // choice, so the icon has to follow it too. The head script's own
      // listener was registered first, in <head>, so by the time this one
      // runs data-theme is already up to date.
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        this._systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
        this._systemTheme.addEventListener('change', this._readTheme);
      }
    }
    // Elena renders plain HTML — wire up click events via delegation
    this.addEventListener('click', this._handleClick);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._systemTheme?.removeEventListener('change', this._readTheme);
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
    // Writing the choice is what stops the head script's system listener
    // from overriding it later.
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('sl-theme', next);
      } catch {
        // Site data blocked. The choice holds for this page either way.
      }
    }
    if (themeRoot()) {
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
          /* THE BRAND FACE. --sl-font-brand is what the wordmark and the navigation
       are set in, and it falls back to the body sans, so a site that never
       sets it looks exactly as it did. A site that wants the terminal
       character in its header sets it once, to the mono, and both the name
       and the links follow.

       It is a token rather than a fork of this component because that is the
       whole of the difference: two declarations, not a second header. */
    .site-title {
            font-family: var(--sl-font-brand, var(--sl-font-sans));
            font-size: var(--sl-text-lg, 1.125rem);
            font-weight: 700;
            color: var(--sl-color-text, #23262f);
            text-decoration: none;
            white-space: nowrap;
            /* A flex item will not shrink below its own text, so a long site name
               pushes the theme toggle past the right edge of a 320px screen. These
               three let the row give way and end the name in an ellipsis instead. */
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .site-title:hover { opacity: 0.85; }
          nav {
            display: flex;
            align-items: center;
            gap: 0.25rem;
            flex: 1;
            /* min-width: 0, or a flex item refuses to shrink below its content and
               the whole header grows past a phone's screen. On the docs pages the
               nav is hidden behind the hamburger below 72rem and this never showed;
               the landing page has no sidebar, so it keeps its links and needs the
               row to be able to give way. */
            min-width: 0;
          }

          /* A phone cannot fit four links, a search control and two icon buttons.
             The links SCROLL rather than disappear: dropping one would take a
             destination away from exactly the reader with the least room to go
             looking for it. The bar is hidden because a scrollbar inside a header
             is noise, and the links are still reachable by keyboard and by swipe. */
          @media (max-width: 48rem) {
            nav {
              overflow-x: auto;
              scrollbar-width: none;
              -ms-overflow-style: none;
            }

            nav::-webkit-scrollbar {
              display: none;
            }

            nav a {
              flex-shrink: 0;
            }
          }
          nav a {
            font-family: var(--sl-font-brand, var(--sl-font-sans));
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
