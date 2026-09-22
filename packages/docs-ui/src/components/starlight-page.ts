import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { NavItem } from './starlight-header.js';
import type { SidebarGroup } from './starlight-sidebar.js';
import type { TocEntry } from '../extract-headings.js';

// Side-effect imports — registers child custom elements
import './starlight-header.js';
import './starlight-sidebar.js';
import './starlight-toc.js';
import './litro-status-line.js';
import type { StatusCell } from './litro-status-line.js';

/**
 * <starlight-page
 *   siteTitle="My Docs"
 *   pageTitle="Getting Started"
 *   .nav=${nav}
 *   .sidebar=${sidebar}
 *   .toc=${toc}
 *   currentSlug="getting-started"
 *   currentPath="/docs/getting-started"
 * >
 *   <div slot="content">…rendered HTML…</div>
 * </starlight-page>
 *
 * Three-column grid layout: sidebar | content | TOC.
 * Responsive: single column below 768px, sidebar/TOC collapsed.
 */
@customElement('starlight-page')
export class StarlightPage extends LitElement {
  static override properties = {
    siteTitle:   { type: String },
    pageTitle:   { type: String },
    nav:         { type: Array },
    sidebar:     { type: Array },
    toc:         { type: Array },
    currentSlug: { type: String },
    currentPath: { type: String },
    noSidebar:   { type: Boolean },
    spaNav:      { type: Boolean },
    status:      { type: Array },
    _navOpen:    { state: true },
    _isDrawerMode: { state: true },
  };

  static override styles = css`
    /* THE LINE IS DARK CHROME ON A LIGHT PAGE, on purpose: a status line is
       the same object on both halves of the site, so it does not change color
       with the document. The docs pages define no --nova-* tokens, so the set
       the line reads is given to it here, on the element itself. A landing
       page that already has a token block overrides these from above. */
    litro-status-line {
      --nova-bg: #0d0e1a;
      --nova-surface: #171a2b;
      --nova-border: #2a2e45;
      --nova-text: #e9ecfa;
      --nova-text-dim: #9aa1bd;
      /* The mode segment puts WHITE text on this color, and the site accent
         is picked to sit on a page background rather than under white text —
         at 0.75rem it needs 4.5:1 and most accents give about 3.5:1. Mixing
         it most of the way toward black keeps the site's hue and clears the
         ratio for any accent a project is likely to choose.

         It is fixed rather than theme-dependent because the line is fixed
         dark chrome: it does not change with the document, so neither can
         the color underneath its text. */
      --nova-accent: color-mix(in srgb, var(--sl-color-accent, #7c3aed) 72%, #000);
      --nova-gutter: 1.5rem;
      --nova-font-mono: var(--sl-font-mono, ui-monospace, monospace);
      --nova-error: #f87171;
      --nova-blocked: #fbbf24;
      --nova-working: #38bdf8;
      --nova-done: #4ade80;
      --nova-idle: #64748b;
    }

    :host {
      display: block;
    }

    /* The status line at the foot is FIXED, so it is out of the flow and the
       page has to leave room for it by hand. Without this the last line of a
       document, and the bottom of the sidebar's own scroll, sit under it.

       It is subtracted from min-height too, so a short page still fills the
       screen exactly once rather than overflowing by the height of the line. */
    .page-wrap {
      --status-height: var(--nova-status-height, 1.75rem);
      min-height: calc(100vh - var(--status-height));
      min-height: calc(100svh - var(--status-height));
      padding-bottom: var(--status-height);
      display: flex;
      flex-direction: column;
    }

    .body {
      display: grid;
      grid-template-columns: var(--sl-sidebar-width, 16rem) 1fr var(--sl-toc-width, 14rem);
      grid-template-areas: 'sidebar content toc';
      flex: 1;
      max-width: 90rem;
      margin: 0 auto;
      width: 100%;
    }

    .body.no-sidebar {
      grid-template-columns: 1fr;
      grid-template-areas: 'content';
    }

    .sidebar-wrap {
      grid-area: sidebar;
      border-right: 1px solid var(--sl-color-border, #e8e8e8);
      background-color: var(--sl-color-bg-sidebar, #f6f6f6);
      position: sticky;
      top: var(--sl-nav-height, 3.5rem);
      height: calc(100vh - var(--sl-nav-height, 3.5rem));
      overflow-y: auto;
    }

    .content-wrap {
      grid-area: content;
      padding: var(--sl-content-pad-y, 2rem) var(--sl-content-pad-x, 1.5rem);
      min-width: 0;
    }

    .content-inner {
      max-width: var(--sl-content-width, 48rem);
    }

    .toc-wrap {
      grid-area: toc;
      border-left: 1px solid var(--sl-color-border, #e8e8e8);
      position: sticky;
      top: var(--sl-nav-height, 3.5rem);
      height: calc(100vh - var(--sl-nav-height, 3.5rem));
      overflow-y: auto;
      padding: var(--sl-content-pad-y, 2rem) 0 var(--sl-content-pad-y, 2rem) var(--sl-content-pad-x, 1.5rem);
    }

    .page-title {
      font-size: var(--sl-text-4xl, 2.25rem);
      font-weight: 700;
      color: var(--sl-color-text, #23262f);
      margin: 0 0 1.5rem;
      line-height: 1.15;
    }

    .nav-backdrop {
      position: fixed;
      inset: 0;
      top: var(--sl-nav-height, 3.5rem);
      background: rgba(0, 0, 0, 0.4);
      z-index: 49;
    }

    .nav-backdrop[hidden] {
      display: none;
    }

    .sidebar-wrap[hidden] {
      display: none;
    }

    .toc-wrap[hidden] {
      display: none;
    }

    .page-title[hidden] {
      display: none;
    }

    /* Responsive: hide sidebar and TOC on narrow screens */
    @media (max-width: 72rem) {
      .body {
        grid-template-columns: 1fr var(--sl-toc-width, 14rem);
        grid-template-areas: 'content toc';
      }

      .sidebar-wrap {
        grid-area: unset;
        position: fixed;
        top: var(--sl-nav-height, 3.5rem);
        left: 0;
        z-index: 50;
        height: calc(100vh - var(--sl-nav-height, 3.5rem));
        width: var(--sl-sidebar-width, 16rem);
        transform: translateX(-100%);
        transition: transform 0.2s ease;
        box-shadow: 2px 0 16px rgba(0, 0, 0, 0.12);
      }

      .sidebar-wrap.nav-open {
        transform: translateX(0);
      }
    }

    @media (max-width: 48rem) {
      .body {
        grid-template-columns: 1fr;
        grid-template-areas: 'content';
      }

      .toc-wrap {
        display: none;
      }
    }

    /* No-JS: sidebar is always visible — no drawer toggle needed */
    @media (scripting: none) and (max-width: 72rem) {
      .body {
        grid-template-columns: var(--sl-sidebar-width, 16rem) 1fr;
        grid-template-areas: 'sidebar content';
      }

      .sidebar-wrap {
        position: sticky;
        top: var(--sl-nav-height, 3.5rem);
        height: calc(100vh - var(--sl-nav-height, 3.5rem));
        overflow-y: auto;
        transform: none;
        grid-area: sidebar;
        width: auto;
        box-shadow: none;
      }
    }

    @media (scripting: none) and (max-width: 48rem) {
      .body {
        grid-template-columns: 1fr;
        grid-template-areas: 'sidebar' 'content';
      }

      .sidebar-wrap {
        position: static;
        height: auto;
        overflow-y: visible;
        top: auto;
      }
    }
  `;

  siteTitle = '';
  pageTitle = '';
  nav: NavItem[] = [];
  sidebar: SidebarGroup[] = [];
  toc: TocEntry[] = [];
  currentSlug = '';
  currentPath = '';
  noSidebar = false;
  spaNav = false;
  _navOpen = false;
  _isDrawerMode = false;
  private _drawerMql: MediaQueryList | null = null;
  private _drawerMqlHandler = (e: MediaQueryListEvent) => {
    this._isDrawerMode = e.matches;
  };

  override connectedCallback() {
    super.connectedCallback();
    if (typeof window !== 'undefined') {
      this._drawerMql = window.matchMedia('(max-width: 72rem)');
      this._isDrawerMode = this._drawerMql.matches;
      this._drawerMql.addEventListener('change', this._drawerMqlHandler);
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._drawerMql?.removeEventListener('change', this._drawerMqlHandler);
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has('currentPath') && this._navOpen) {
      this._navOpen = false;
    }
  }

  private _handleNavToggle() {
    this._navOpen = !this._navOpen;
  }

  private _closeNav() {
    this._navOpen = false;
  }

  /**
   * Extra cells for the status line at the foot, after the two this component
   * builds itself. A page passes what only it knows — the link that edits it,
   * the version it documents — and passes nothing when it has nothing.
   */
  status: StatusCell[] = [];

  /**
   * The cells the line shows: where the reader is, then whatever the page
   * added.
   *
   * WHERE YOU ARE comes from `currentPath`, which every page already passes to
   * position the navigation, so no page has to be told twice. The first
   * segment is the section — docs, blog, compare — and the rest is the path
   * inside it. On a page with no path there is no section to name, so the
   * cell is left out; with nothing else to show either, `litro-status-line`
   * renders nothing rather than an empty bar.
   *
   * Nothing here is invented: every cell is either the path in the address
   * bar or something the page handed over.
   */
  private get _cells(): StatusCell[] {
    const path = (this.currentPath ?? '').replace(/^\/+|\/+$/g, '');
    const cells: StatusCell[] = [];
    if (path) {
      const [section, ...rest] = path.split('/');
      cells.push({
        state: 'working',
        value: section,
        trailing: rest.length > 0 ? `/${rest.join('/')}` : undefined,
      });
    }
    return [...cells, ...(this.status ?? [])];
  }

  override render() {
    const hasSidebar = !this.noSidebar;
    const cells = this._cells;
    return html`
      <div class="page-wrap">
        <starlight-header
          siteTitle="${this.siteTitle}"
          .nav="${this.nav}"
          currentPath="${this.currentPath}"
          .navOpen="${this._navOpen}"
          .hasSidebar="${hasSidebar}"
          .spaNav="${this.spaNav}"
          @sl-nav-toggle="${this._handleNavToggle}"
        ></starlight-header>
        <div
          class="nav-backdrop"
          ?hidden="${!(hasSidebar && this._navOpen)}"
          @click="${this._closeNav}"
        ></div>
        <div class="body${this.noSidebar ? ' no-sidebar' : ''}">
          <aside
            class="sidebar-wrap${this._navOpen ? ' nav-open' : ''}"
            ?hidden="${!hasSidebar}"
            ?inert="${this._isDrawerMode && !this._navOpen}"
          >
            <starlight-sidebar
              .groups="${this.sidebar}"
              currentSlug="${this.currentSlug}"
              .spaNav="${this.spaNav}"
            ></starlight-sidebar>
          </aside>
          <main class="content-wrap">
            <div class="content-inner">
              <h1 class="page-title" ?hidden="${!this.pageTitle}">${this.pageTitle}</h1>
              <slot name="content"></slot>
            </div>
          </main>
          <aside class="toc-wrap" ?hidden="${!hasSidebar}">
            <starlight-toc .entries="${this.toc}"></starlight-toc>
          </aside>
        </div>
      </div>
      <!-- The status line is fixed to the foot of the window, so it sits
           OUTSIDE .page-wrap: inside it, the sidebar's own scrolling and the
           sticky header would both have to reason about it. The padding that
           keeps the last line of content clear of it is on .page-wrap. -->
      <litro-status-line
        siteTitle="${this.siteTitle}"
        .cells="${cells}"
        label="Page status"
      ></litro-status-line>
    `;
  }
}

export default StarlightPage;
