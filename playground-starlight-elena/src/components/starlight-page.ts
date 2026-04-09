import { Elena, html, unsafeHTML } from '@elenajs/core';
import type { NavItem } from './starlight-header.js';
import type { SidebarGroup } from './starlight-sidebar.js';
import type { TocEntry } from '../extract-headings.js';

// Side-effect imports — registers child custom elements
import './starlight-header.js';
import './starlight-sidebar.js';
import './starlight-toc.js';

/**
 * <starlight-page siteTitle="My Docs" pageTitle="Getting Started" ...>
 *   Three-column grid layout: sidebar | content | TOC.
 *   Light DOM — children render in place, no slots needed.
 * </starlight-page>
 */
export class StarlightPage extends Elena(HTMLElement) {
  static tagName = 'starlight-page';
  static props = ['siteTitle', 'pageTitle', 'nav', 'sidebar', 'toc', 'currentSlug', 'currentPath', 'noSidebar', '_navOpen'];

  siteTitle = '';
  pageTitle = '';
  nav: NavItem[] = [];
  sidebar: SidebarGroup[] = [];
  toc: TocEntry[] = [];
  currentSlug = '';
  currentPath = '';
  noSidebar = false;
  _navOpen = false;

  handleNavToggle() {
    this._navOpen = !this._navOpen;
  }

  closeNav() {
    this._navOpen = false;
  }

  render() {
    // Header — pass properties as attributes for Elena light DOM rendering
    const headerEl = document.createElement('starlight-header') as any;
    headerEl.siteTitle = this.siteTitle;
    headerEl.nav = this.nav;
    headerEl.currentPath = this.currentPath;
    headerEl.navOpen = this._navOpen;
    headerEl.hasSidebar = !this.noSidebar;

    const backdrop = !this.noSidebar && this._navOpen
      ? '<div class="nav-backdrop" data-action="close-nav"></div>'
      : '';

    const sidebarHtml = !this.noSidebar
      ? `<aside class="sidebar-wrap${this._navOpen ? ' nav-open' : ''}">
          <starlight-sidebar></starlight-sidebar>
        </aside>`
      : '';

    const titleHtml = this.pageTitle
      ? `<h1 class="page-title">${this.pageTitle}</h1>`
      : '';

    const tocHtml = !this.noSidebar
      ? `<aside class="toc-wrap"><starlight-toc></starlight-toc></aside>`
      : '';

    const bodyClass = this.noSidebar ? 'body no-sidebar' : 'body';

    return html`
      <style>
        @scope (starlight-page) {
          :scope { display: block; }
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
            .toc-wrap { display: none; }
          }
        }
      </style>
      <div class="page-wrap">
        <starlight-header></starlight-header>
        ${unsafeHTML(backdrop)}
        <div class="${bodyClass}">
          ${unsafeHTML(sidebarHtml)}
          <main class="content-wrap">
            <div class="content-inner">
              ${unsafeHTML(titleHtml)}
              <div class="content-body">${unsafeHTML(this.innerHTML)}</div>
            </div>
          </main>
          ${unsafeHTML(tocHtml)}
        </div>
      </div>
    `;
  }
}

StarlightPage.define();

export default StarlightPage;
