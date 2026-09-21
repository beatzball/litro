import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { NavItem } from './starlight-header.js';
import type { SidebarGroup } from './starlight-sidebar.js';
import type { TocEntry } from '../extract-headings.js';

// Side-effect imports — registers child custom elements
import './starlight-header.js';
import './starlight-sidebar.js';
import './starlight-toc.js';

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
    _navOpen:    { state: true },
  };

  static override styles = css`
    :host {
      display: block;
    }

    .page-wrap {
      min-height: 100vh;
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
  `;

  siteTitle = '';
  pageTitle = '';
  nav: NavItem[] = [];
  sidebar: SidebarGroup[] = [];
  toc: TocEntry[] = [];
  currentSlug = '';
  currentPath = '';
  noSidebar = false;
  _navOpen = false;

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

  override render() {
    const hasSidebar = !this.noSidebar;
    return html`
      <div class="page-wrap">
        <starlight-header
          siteTitle="${this.siteTitle}"
          .nav="${this.nav}"
          currentPath="${this.currentPath}"
          .navOpen="${this._navOpen}"
          .hasSidebar="${hasSidebar}"
          @sl-nav-toggle="${this._handleNavToggle}"
        ></starlight-header>
        ${hasSidebar && this._navOpen ? html`
          <div class="nav-backdrop" @click="${this._closeNav}"></div>
        ` : ''}
        <div class="body${this.noSidebar ? ' no-sidebar' : ''}">
          ${hasSidebar ? html`
            <aside class="sidebar-wrap${this._navOpen ? ' nav-open' : ''}">
              <starlight-sidebar
                .groups="${this.sidebar}"
                currentSlug="${this.currentSlug}"
              ></starlight-sidebar>
            </aside>
          ` : ''}
          <main class="content-wrap">
            <div class="content-inner">
              ${this.pageTitle ? html`<h1 class="page-title">${this.pageTitle}</h1>` : ''}
              <slot name="content"></slot>
            </div>
          </main>
          ${hasSidebar ? html`
            <aside class="toc-wrap">
              <starlight-toc .entries="${this.toc}"></starlight-toc>
            </aside>
          ` : ''}
        </div>
      </div>
    `;
  }
}

export default StarlightPage;
