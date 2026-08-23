import { FASTElement, Observable, html, css, when } from '@microsoft/fast-element';
import type { NavItem } from './starlight-header.js';
import type { SidebarGroup } from './starlight-sidebar.js';
import type { TocEntry } from '../extract-headings.js';

// Side-effect imports — registers child custom elements
import './starlight-header.js';
import './starlight-sidebar.js';
import './starlight-toc.js';
import './litro-footer.js';

/**
 * <starlight-page
 *   siteTitle="My Docs"
 *   pageTitle="Getting Started"
 *   :nav=${nav}
 *   :sidebar=${sidebar}
 *   :toc=${toc}
 *   currentSlug="getting-started"
 *   currentPath="/docs/getting-started"
 * >
 *   <div slot="content">...rendered HTML...</div>
 * </starlight-page>
 *
 * Three-column grid layout: sidebar | content | TOC.
 */
export class StarlightPage extends FASTElement {
  siteTitle = '';
  pageTitle = '';
  nav: NavItem[] = [];
  sidebar: SidebarGroup[] = [];
  toc: TocEntry[] = [];
  currentSlug = '';
  currentPath = '';
  noSidebar = false;
  _navOpen = false;

  currentPathChanged() {
    if (this._navOpen) {
      this._navOpen = false;
    }
  }

  handleNavToggle() {
    this._navOpen = !this._navOpen;
  }

  closeNav() {
    this._navOpen = false;
  }
}
Observable.defineProperty(StarlightPage.prototype, 'siteTitle');
Observable.defineProperty(StarlightPage.prototype, 'pageTitle');
Observable.defineProperty(StarlightPage.prototype, 'nav');
Observable.defineProperty(StarlightPage.prototype, 'sidebar');
Observable.defineProperty(StarlightPage.prototype, 'toc');
Observable.defineProperty(StarlightPage.prototype, 'currentSlug');
Observable.defineProperty(StarlightPage.prototype, 'currentPath');
Observable.defineProperty(StarlightPage.prototype, 'noSidebar');
Observable.defineProperty(StarlightPage.prototype, '_navOpen');

const template = html<StarlightPage>`
  <div class="page-wrap">
    <starlight-header
      :siteTitle="${x => x.siteTitle}"
      :nav="${x => x.nav}"
      :currentPath="${x => x.currentPath}"
      :navOpen="${x => x._navOpen}"
      :hasSidebar="${x => !x.noSidebar}"
      @sl-nav-toggle="${x => x.handleNavToggle()}"
    ></starlight-header>
    ${when(x => !x.noSidebar && x._navOpen, html<StarlightPage>`
      <div class="nav-backdrop" @click="${x => x.closeNav()}"></div>
    `)}
    <div class="${x => 'body' + (x.noSidebar ? ' no-sidebar' : '')}">
      ${when(x => !x.noSidebar, html<StarlightPage>`
        <aside class="${x => 'sidebar-wrap' + (x._navOpen ? ' nav-open' : '')}">
          <starlight-sidebar
            :groups="${x => x.sidebar}"
            :currentSlug="${x => x.currentSlug}"
          ></starlight-sidebar>
        </aside>
      `)}
      <main class="content-wrap">
        <div class="content-inner">
          ${when(x => x.pageTitle, html<StarlightPage>`<h1 class="page-title">${x => x.pageTitle}</h1>`)}
          <slot name="content"></slot>
        </div>
      </main>
      ${when(x => !x.noSidebar, html<StarlightPage>`
        <aside class="toc-wrap">
          <starlight-toc :entries="${x => x.toc}"></starlight-toc>
        </aside>
      `)}
    </div>
    <!-- Credit line. Delete this element if you would rather not carry it.
         A property binding, not a plain attribute: fast-ssr does not map
         attributes onto properties, so recipe="..." renders as empty. -->
    <litro-footer :recipe="${() => '{{recipe}}'}"></litro-footer>
  </div>
`;

const styles = css`
  :host { display: block; }

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
`;

StarlightPage.define({ name: 'starlight-page', template, styles });

export default StarlightPage;
