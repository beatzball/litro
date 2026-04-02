import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

export interface NavItem {
  label: string;
  href: string;
}

/**
 * <starlight-header siteTitle="My Docs" .nav=${nav} currentPath="/docs/getting-started">
 *   Top navigation bar with site title, nav links, and dark/light theme toggle.
 */
@customElement("starlight-header")
export class StarlightHeader extends LitElement {
  static override properties = {
    siteTitle: { type: String },
    nav: { type: Array },
    currentPath: { type: String },
    navOpen: { type: Boolean },
    hasSidebar: { type: Boolean },
    spaNav: { type: Boolean },
    _theme: { type: String, state: true },
    _isMac: { type: Boolean, state: true },
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
      gap: 1rem;
    }

    .menu-btn {
      display: none;
      appearance: none;
      background: none;
      border: 1px solid var(--sl-color-border, #e8e8e8);
      border-radius: var(--sl-border-radius, 0.375rem);
      min-width: 2.75rem;
      min-height: 2.75rem;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--sl-color-text, #23262f);
      transition: background-color 0.15s;
      flex-shrink: 0;
      padding: 0;
    }

    .menu-btn:hover {
      background-color: var(--sl-color-gray-2, #e8e8e8);
    }

    .menu-btn svg {
      width: 1.1rem;
      height: 1.1rem;
    }

    @media (max-width: 72rem) {
      .menu-btn {
        display: flex;
      }
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

    .site-title:hover {
      opacity: 0.85;
    }

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
      transition:
        color 0.15s,
        background-color 0.15s;
    }

    nav a:hover {
      color: var(--sl-color-text, #23262f);
      background-color: var(--sl-color-gray-2, #e8e8e8);
    }

    nav a[aria-current="page"] {
      color: var(--sl-color-accent, #7c3aed);
      background-color: var(--sl-color-accent-low, #ede9fe);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      margin-left: auto;
    }

    .search-pill {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-height: 2.75rem;
      padding: 0 0.75rem;
      border: 1px solid var(--sl-color-border, #e8e8e8);
      border-radius: 9999px;
      background: var(--sl-color-bg, #fff);
      color: var(--sl-color-gray-4, #888);
      cursor: pointer;
      font-size: var(--sl-text-sm, 0.875rem);
      transition: border-color 0.15s;
      white-space: nowrap;
      appearance: none;
      font-family: inherit;
    }

    .search-pill:hover {
      border-color: var(--sl-color-accent, #ea580c);
    }

    .search-pill-icon {
      width: 0.9rem;
      height: 0.9rem;
      flex-shrink: 0;
    }

    .search-pill-text {
      flex: 1;
    }

    .search-pill-kbd {
      font-family: inherit;
      font-size: 0.65rem;
      background: var(--sl-color-gray-2, #e8e8e8);
      border: 1px solid var(--sl-color-border, #e8e8e8);
      border-radius: 3px;
      padding: 0.1em 0.35em;
      margin-left: auto;
      line-height: 1.6;
    }

    @media (max-width: 48rem) {
      .search-pill-text,
      .search-pill-kbd {
        display: none;
      }
      .search-pill {
        padding: 0 0.5rem;
        gap: 0;
      }
    }

    /* No-JS fallback: show form, hide pill */
    .search-form {
      display: none;
      align-items: center;
    }

    .search-input {
      width: 14rem;
      height: 2rem;
      padding: 0 0.5rem;
      font-size: var(--sl-text-sm, 0.875rem);
      border: 1px solid var(--sl-color-border, #e8e8e8);
      border-radius: var(--sl-border-radius, 0.375rem);
      background: var(--sl-color-bg, #fff);
      color: var(--sl-color-text, #23262f);
      outline: none;
    }

    .search-input:focus-visible {
      border-color: var(--sl-color-accent, #ea580c);
      box-shadow: 0 0 0 1px var(--sl-color-accent, #ea580c);
    }

    @media (scripting: none) {
      .search-pill {
        display: none;
      }
      .search-form {
        display: flex;
      }
    }

    .github-link {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 2.75rem;
      min-height: 2.75rem;
      border-radius: var(--sl-border-radius, 0.375rem);
      color: var(--sl-color-gray-5, #4b4b4b);
      text-decoration: none;
      transition:
        color 0.15s,
        background-color 0.15s;
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

    @media (scripting: enabled) {
      sl-icon-button:not(:defined) {
        visibility: hidden;
      }
    }

    .menu-btn[hidden] {
      display: none;
    }

    .search-pill[hidden] {
      display: none;
    }

    .search-form[hidden] {
      display: none;
    }

    .github-link[hidden] {
      display: none;
    }

    .hamburger-icon[hidden],
    .close-icon[hidden] {
      display: none;
    }

    @media (scripting: none) {
      .menu-btn {
        display: none;
      }
      sl-icon-button {
        display: none;
      }
    }
  `;

  siteTitle = "";
  nav: NavItem[] = [];
  currentPath = "";
  navOpen = false;
  hasSidebar = false;
  spaNav = false;

  _theme = "light";
  _isMac = true;

  override connectedCallback() {
    super.connectedCallback();
    if (typeof navigator !== 'undefined') {
      this._isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform ?? '');
    }
  }

  override firstUpdated() {
    const stored =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("sl-theme")
        : null;
    const resolved =
      stored ??
      (typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    this._theme = resolved;
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", resolved);
    }
  }

  private _toggleTheme() {
    const next = this._theme === "light" ? "dark" : "light";
    this._theme = next;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("sl-theme", next);
    }
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", next);
    }
  }

  private _toggleNav() {
    this.dispatchEvent(
      new CustomEvent("sl-nav-toggle", { bubbles: true, composed: true }),
    );
  }

  private _openSearch() {
    this.dispatchEvent(
      new CustomEvent('sl-search-open', { bubbles: true, composed: true }),
    );
  }

  // SPA navigation: intercept clicks on nav <a> when spaNav=true.
  // Dynamic import keeps litro-router out of the server bundle.
  private _navClick(e: MouseEvent, href: string): void {
    if (!this.spaNav) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!href.startsWith('/')) return;
    e.preventDefault();
    void import('@beatzball/litro-router').then(({ LitroRouter }) => LitroRouter.go(href));
  }

  override render() {
    const icon = this._theme === "dark" ? "sun" : "moon";
    const label =
      this._theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

    const regularNav = this.nav.filter(
      (item) => !item.href.includes("github.com"),
    );
    const githubItem = this.nav.find((item) =>
      item.href.includes("github.com"),
    );

    return html`
      <header>
        <button
          class="menu-btn"
          ?hidden="${!this.hasSidebar}"
          aria-label="${this.navOpen
            ? "Close navigation"
            : "Open navigation"}"
          aria-expanded="${this.navOpen}"
          @click="${this._toggleNav}"
        >
          <svg
            class="close-icon"
            ?hidden="${!this.navOpen}"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          <svg
            class="hamburger-icon"
            ?hidden="${this.navOpen}"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <a class="site-title" href="/">
          <img class="site-logo" src="/logo.png" alt="" aria-hidden="true" />
          ${this.siteTitle}
        </a>
        <nav aria-label="Main navigation">
          ${regularNav.map(
            (item) => html`<a
                href="${item.href}"
                aria-current="${this.currentPath.startsWith(item.href)
                  ? "page"
                  : "false"}"
                @click="${(e: MouseEvent) => this._navClick(e, item.href)}"
              >${item.label}</a>`,
          )}
        </nav>
        <div class="header-actions">
          <button
            id="_litro_search"
            class="search-pill"
            ?hidden="${!this.spaNav}"
            @click="${this._openSearch}"
            aria-label="Search documentation"
          >
            <svg class="search-pill-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
            </svg>
            <span class="search-pill-text">Search...</span>
            <kbd class="search-pill-kbd">${this._isMac ? '\u2318K' : 'Ctrl+K'}</kbd>
          </button>
          <form class="search-form" ?hidden="${!this.spaNav}" action="/search" method="get">
            <input class="search-input" type="search" name="q" placeholder="Search..." aria-label="Search documentation" />
          </form>
          <a
            class="github-link"
            ?hidden="${!githubItem}"
            href="${githubItem?.href ?? ''}"
            target="_blank"
            rel="noopener"
            aria-label="GitHub (opens in new tab)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"
              />
            </svg>
          </a>
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
