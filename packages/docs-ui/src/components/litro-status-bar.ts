import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

// The tabs are drawn with state badges, so the badge has to be registered
// before this element renders.
import './litro-state-badge.js';
import { DEFAULT_GLYPHS } from './litro-state-badge.js';
import type { BadgeState, GlyphSet } from './litro-state-badge.js';

/** One tab in the bar: a name, the state it ends on, and how it gets there. */
export interface StatusTab {
  /** The tab's name, shown after the badge. */
  name: string;
  /** The state the tab settles on. */
  state: BadgeState;
  /** The state it starts in. Unset means the badge does not animate. */
  from?: BadgeState;
  /** How many seconds it waits before it settles. */
  delay?: number;
  /** The tab a reader is "on". One tab at most. */
  current?: boolean;
}

/**
 * <litro-status-bar siteTitle="my-product" .tabs="${TABS}"
 *                   tabsLabel="Four tasks: build is done, …">
 *   <svg slot="mark">…your logo…</svg>
 *   <a slot="nav" href="/docs/getting-started">Docs</a>
 * </litro-status-bar>
 *
 * The sticky top bar, drawn like a terminal status line: the project's mark
 * and name as one link home, a row of tabs each showing a `litro-state-badge`,
 * and the site's navigation on the right.
 *
 * THIS REPLACES THE DOCS HEADER ON THE LANDING PAGE ONLY. The docs pages keep
 * `starlight-header` and its light and dark toggle. Give this bar the SAME
 * title and the SAME links the docs header shows, from the same place —
 * `server/starlight.config.js` — so a reader moving between the two halves of
 * the site still sees one site.
 *
 * THE NAVIGATION IS A SLOT, not a property. The page writes the links, so it
 * decides what an entry is: a plain link, a button, an external link with an
 * icon. Slotted content keeps the PAGE's styles rather than this component's,
 * with one exception: the size, spacing and color of anything in the nav slot
 * are the bar's business and are set here with `::slotted([slot='nav'])`. The
 * rule matches on the slot name, not on `a`, so a routing link element or a
 * button — a search trigger, say — is dressed the same as a plain anchor.
 *
 * THE TABS ARE A PICTURE, and they are marked as one: a plain div with
 * `role="img"` and the sentence you pass as `tabsLabel`, and every tab inside
 * it hidden from assistive tech. A screen reader gets one description instead of reading five glyphs
 * that mean nothing on their own. Pass a `tabsLabel` that says what the row
 * shows. Leave `tabs` empty and the row is not rendered at all.
 *
 * MOTION IS CSS ONLY and comes from the badges, so the bar settles with
 * JavaScript turned off and stands still under `prefers-reduced-motion`.
 *
 * COLORS come from the landing page's token block. This component defines
 * none of its own. Used outside that page, define the `--nova-*` tokens it
 * reads on any ancestor: `--nova-bg`, `--nova-surface`, `--nova-border`,
 * `--nova-text`, `--nova-text-dim`, `--nova-accent`, `--nova-radius`,
 * `--nova-font-mono`, and the five state tokens the badge reads.
 */
@customElement('litro-status-bar')
export class LitroStatusBar extends LitElement {
  static override properties = {
    siteTitle: { type: String },
    homeHref: { type: String },
    tabs: { type: Array },
    tabsLabel: { type: String },
    glyphs: { type: Object },
  };

  static override styles = css`
    :host {
      display: block;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    /* Powerline segments. Every segment ends in the same arrow, and each one
       after the first slides left UNDER the arrow before it, so the notch
       shows the next segment's color instead of a square edge. That is the
       shape a terminal status line has. */
    header {
      --arrow: 0.75rem;
      display: flex;
      align-items: stretch;
      height: 2.25rem;
      font-family: var(--nova-font-mono);
      font-size: 0.8125rem;
      background: var(--nova-bg);
      border-bottom: 1px solid var(--nova-border);
    }

    .seg {
      position: relative;
      display: flex;
      align-items: center;
      clip-path: polygon(
        0 0,
        calc(100% - var(--arrow)) 0,
        100% 50%,
        calc(100% - var(--arrow)) 100%,
        0 100%
      );
    }

    /* The mark and the name are one link, in two segments. */
    .home {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: stretch;
      min-width: 0;
      text-decoration: none;
    }

    .seg-mark {
      z-index: 2;
      padding: 0 calc(0.55rem + var(--arrow)) 0 var(--nova-gutter);
      color: var(--nova-text);
      background: var(--nova-bg);
    }

    ::slotted([slot='mark']) {
      display: block;
      width: 1.25rem;
      height: 1.25rem;
    }

    .seg-name {
      z-index: 1;
      margin-left: calc(-1 * var(--arrow));
      padding: 0 calc(0.75rem + var(--arrow)) 0 calc(0.6rem + var(--arrow));
      color: var(--nova-text);
      font-weight: 700;
      background: var(--nova-accent);
      /* A long name must not wrap: the bar is one line high, and a second
         line pushes the segment out of it. min-width: 0 lets the segment
         shrink below the name's own width, so on a narrow screen the name
         is shortened instead and the bar stays a status line. */
      white-space: nowrap;
      min-width: 0;
      overflow: hidden;
    }

    /* The name is in a span of its own so that the cut reads as a cut.
       text-overflow needs a block container, and .seg-name is a flex box, so
       on the segment itself the name would end mid-letter. */
    .seg-name .name {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* The segments paint over an outline on the link, so a focus ring would
       show only as a sliver inside the arrow's notch. The name segment
       inverts instead: unmistakable, and the powerline shape survives. */
    .home:focus-visible {
      outline: none;
    }

    .home:focus-visible .seg-name {
      color: var(--nova-bg);
      background: var(--nova-text);
      text-decoration: underline;
      text-decoration-thickness: 2px;
      text-underline-offset: 0.2em;
    }

    /* A div and spans, not an ol and lis. The row is a picture: it carries
       role="img", which ARIA in HTML does not allow on a list, and which
       makes everything inside it presentational anyway. Plain elements need
       no list reset either. */
    .tabs {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: stretch;
      min-width: 0;
      /* Tucks the first tab under the name segment's arrow. */
      margin: 0 0 0 calc(-1 * var(--arrow));
      overflow: hidden;
    }

    .tab {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0 0.75rem;
      color: var(--nova-text-dim);
      white-space: nowrap;
    }

    /* The first tab sits partly under the arrow before it, so it gets that
       much more room on its left. */
    .tab:first-child {
      padding-left: calc(0.75rem + var(--arrow));
    }

    .tab.current {
      padding-right: calc(0.75rem + var(--arrow));
      color: var(--nova-text);
      background: var(--nova-surface);
      clip-path: polygon(
        0 0,
        calc(100% - var(--arrow)) 0,
        100% 50%,
        calc(100% - var(--arrow)) 100%,
        0 100%
      );
    }

    /* The links are what a reader came for, so they keep their width and the
       name gives way instead. */
    nav {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      flex-shrink: 0;
      margin-left: auto;
      padding: 0 var(--nova-gutter) 0 1rem;
    }

    /* A slot is display: contents, so the slotted elements themselves are the
       flex items. ::slotted reaches a direct child, and the selector matches
       on the slot name rather than on the tag, because a page may hand the
       bar something other than a plain anchor — a routing link element, or a
       button that opens a search dialog. Anything in the nav is sized and
       colored the same way. */
    ::slotted([slot='nav']) {
      padding: 0.25rem 0.6rem;
      color: var(--nova-text-dim);
      text-decoration: none;
      border-radius: var(--nova-radius);
      white-space: nowrap;
      font: inherit;
      background: none;
      border: 0;
      cursor: pointer;
    }

    ::slotted([slot='nav']:hover) {
      color: var(--nova-text);
      background: var(--nova-surface);
    }

    ::slotted([slot='nav']:focus-visible) {
      outline: 2px solid var(--nova-accent);
      outline-offset: 2px;
    }

    /* A narrow screen drops the decoration before it drops anything a reader
       came for. The tabs are a picture, so they go first; the links stay. */
    @media (max-width: 52rem) {
      .tab:nth-child(n + 3) {
        display: none;
      }
    }

    @media (max-width: 36rem) {
      .tabs {
        display: none;
      }
    }

    /* Narrower still, and the navigation needs every pixel the bar has. The
       name segment can shrink to nothing (see min-width above), and an arrow
       with no word in it reads as a bug rather than as a name that was cut.
       So below this the name goes and the mark carries the home link on its
       own — it is the same link, and it was never the thing being cut. */
    @media (max-width: 30rem) {
      .seg-name {
        display: none;
      }

      .seg-mark {
        padding-right: var(--nova-gutter);
      }
    }
  `;

  /** The site's name, shown in the second segment. */
  siteTitle = '';

  /** Where the mark and the name link to. */
  homeHref = '/';

  /** The tabs, left to right. Empty means no tab row is rendered. */
  tabs: StatusTab[] = [];

  /** One sentence saying what the whole tab row shows. */
  tabsLabel = '';

  /** The badge glyph set, passed on to every tab. */
  glyphs: GlyphSet = DEFAULT_GLYPHS;

  override render() {
    const tabs = this.tabs ?? [];

    return html`
      <header>
        <a class="home" href="${this.homeHref}">
          <span class="seg seg-mark"><slot name="mark"></slot></span>
          <span class="seg seg-name"><span class="name">${this.siteTitle}</span></span>
        </a>
        ${tabs.length > 0
          ? html`
              <div class="tabs" role="img" aria-label="${this.tabsLabel}">
                ${tabs.map(
                  (tab) => html`
                    <span class="tab ${tab.current ? 'current' : ''}" aria-hidden="true">
                      <litro-state-badge
                        state="${tab.state}"
                        from="${tab.from ?? ''}"
                        delay="${tab.delay ?? 0}"
                        .glyphs="${this.glyphs ?? DEFAULT_GLYPHS}"
                      ></litro-state-badge>
                      <span>${tab.name}</span>
                    </span>
                  `,
                )}
              </div>
            `
          : ''}
        <nav aria-label="Main navigation"><slot name="nav"></slot></nav>
      </header>
    `;
  }
}

export default LitroStatusBar;
