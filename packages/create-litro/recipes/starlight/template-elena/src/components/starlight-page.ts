import { Elena, html, unsafeHTML } from '@elenajs/core';
import type { NavItem } from './starlight-header.js';
import type { SidebarGroup } from './starlight-sidebar.js';
import type { TocEntry } from '../extract-headings.js';

// Side-effect imports — registers child custom elements
import './starlight-header.js';
import './starlight-sidebar.js';
import './starlight-toc.js';
import './litro-footer.js';

/**
 * <starlight-page sitetitle="My Docs" pagetitle="Getting Started" ...>
 *   <div>...page content...</div>
 * </starlight-page>
 *
 * Central layout component — three-column grid: sidebar | content | TOC.
 * Owns the header, sidebar drawer toggle, and backdrop.
 * Light DOM — children render in place, no slots needed.
 *
 * Nav toggle is handled imperatively (class toggles + DOM insert/remove)
 * to avoid Elena re-rendering the entire tree and destroying child
 * component state/focus.
 */
export class StarlightPage extends Elena(HTMLElement) {
  static tagName = 'starlight-page';
  // _navopen is NOT a prop — toggling it must not trigger a re-render
  static props = ['sitetitle', 'pagetitle', 'nav', 'sidebar', 'toc', 'currentslug', 'currentpath', 'nosidebar'];

  sitetitle = '';
  pagetitle = '';
  nav: NavItem[] = [];
  sidebar: SidebarGroup[] = [];
  toc: TocEntry[] = [];
  currentslug = '';
  currentpath = '';
  nosidebar = false;

  private _navOpen = false;

  /** Original innerHTML captured before first render — preserved across re-renders. */
  private _contentHtml = '';

  override connectedCallback(): void {
    // Capture the original content before Elena's first render replaces innerHTML
    if (!this._contentHtml) {
      this._contentHtml = this.innerHTML;
    }
    super.connectedCallback();
    this.addEventListener('sl-nav-toggle', this._onNavToggle);
    this.addEventListener('click', this._onBackdropClick);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('sl-nav-toggle', this._onNavToggle);
    this.removeEventListener('click', this._onBackdropClick);
  }

  /** Toggle nav imperatively — no re-render, just class/DOM manipulation. */
  private _setNavOpen(open: boolean) {
    this._navOpen = open;
    const sidebar = this.querySelector('.sidebar-wrap') as HTMLElement | null;
    const header = this.querySelector('starlight-header') as any;
    if (sidebar) sidebar.classList.toggle('nav-open', open);
    if (header) header.navopen = open;

    // Manage backdrop
    let backdrop = this.querySelector('.nav-backdrop') as HTMLElement | null;
    if (open && !backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'nav-backdrop';
      backdrop.setAttribute('data-action', 'close-nav');
      // Insert after the header
      const headerEl = this.querySelector('starlight-header');
      headerEl?.after(backdrop);
    } else if (!open && backdrop) {
      backdrop.remove();
    }
  }

  private _onNavToggle = () => {
    this._setNavOpen(!this._navOpen);
  };

  private _onBackdropClick = (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-action="close-nav"]')) {
      this._setNavOpen(false);
    }
  };

  override updated(): void {
    // Elena light DOM — pass properties to child components imperatively
    const header = this.querySelector('starlight-header') as any;
    if (header) {
      header.sitetitle = this.sitetitle;
      header.nav = this.nav;
      header.currentpath = this.currentpath;
      header.navopen = this._navOpen;
      header.hassidebar = !this.nosidebar;
    }
    const sidebar = this.querySelector('starlight-sidebar') as any;
    if (sidebar) {
      sidebar.groups = this.sidebar;
      sidebar.currentslug = this.currentslug;
    }
    const toc = this.querySelector('starlight-toc') as any;
    if (toc) {
      toc.entries = this.toc;
    }
  }

  render() {
    // During SSR, connectedCallback() never runs so _contentHtml is empty.
    // Fall back to this.innerHTML which the SSR adapter sets from children.
    const contentHtml = this._contentHtml || this.innerHTML || '';

    // Serialize props as JSON for child component attributes.
    // Elena's html tag handles attribute escaping (" → &quot;).
    const navJson = JSON.stringify(this.nav || []);
    const sidebarJson = JSON.stringify(this.sidebar || []);
    const tocJson = JSON.stringify(this.toc || []);

    const sidebarHtml = !this.nosidebar
      ? `<aside class="sidebar-wrap">
          <starlight-sidebar groups="${sidebarJson.replace(/"/g, '&quot;')}" currentslug="${this.currentslug}"></starlight-sidebar>
        </aside>`
      : '';

    const titleHtml = this.pagetitle
      ? `<h1 class="page-title">${this.pagetitle}</h1>`
      : '';

    const tocHtml = !this.nosidebar
      ? `<aside class="toc-wrap"><starlight-toc entries="${tocJson.replace(/"/g, '&quot;')}"></starlight-toc></aside>`
      : '';

    const bodyClass = this.nosidebar ? 'body no-sidebar' : 'body';

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
          .body.no-sidebar .content-wrap {
            max-width: 56rem;
            margin: 0 auto;
            width: 100%;
          }
          .body.no-sidebar .content-inner {
            max-width: none;
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
        <starlight-header sitetitle="${this.sitetitle}" nav="${navJson}" currentpath="${this.currentpath}" hassidebar="${!this.nosidebar}"></starlight-header>
        <div class="${bodyClass}">
          ${unsafeHTML(sidebarHtml)}
          <main class="content-wrap">
            <div class="content-inner">
              ${unsafeHTML(titleHtml)}
              <div class="content-body">${unsafeHTML(contentHtml)}</div>
            </div>
          </main>
          ${unsafeHTML(tocHtml)}
        </div>
        <!-- Credit line. Delete this element if you would rather not carry it. -->
        <litro-footer recipe="{{recipe}}"></litro-footer>
      </div>
    `;
  }
}

StarlightPage.define();

export default StarlightPage;
