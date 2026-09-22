import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

import { DEFAULT_GLYPHS } from './litro-state-badge.js';
import type { BadgeState, GlyphSet } from './litro-state-badge.js';

/** One cell in the line. Everything in it has to be true. */
export interface StatusCell {
  /** The dim word in front of the value, if the value needs naming. */
  label?: string;
  /** The part that matters. Rendered bright. */
  value?: string;
  /** Dim text after the value — a path under a section, a unit after a number. */
  trailing?: string;
  /** A state glyph before the text, from the same set the badges use. */
  state?: BadgeState;
  /** Makes the whole cell a link. */
  href?: string;
  /** Pushes this cell, and everything after it, to the right end. */
  right?: boolean;
  /**
   * Dropped on a narrow screen. Mark everything but where-you-are and the
   * one action optional: a phone has room for about three cells.
   */
  optional?: boolean;
}

/**
 * <litro-status-line
 *   siteTitle="my-product"
 *   .cells="${CELLS}"
 *   label="Project status: version 1.2.0, and a link to the repository."
 * ></litro-status-line>
 *
 * The status line at the foot of the window, drawn the way vim, tmux and every
 * editor draw one: a colored mode segment, then cells divided by hairlines.
 *
 * IT REPLACED litro-status-bar, which was the same picture in the wrong place.
 * At the top of the page that bar had to compete with the site's real header,
 * and it had nothing true to say, so it showed a row of invented tabs settling
 * from working to done. At the foot it has a page to describe, so it can stop
 * pretending.
 *
 * EVERY CELL STATES A FACT, and a fact the page can prove: a version read from
 * a manifest, the path a reader is on, a link the site's config already has.
 * Nothing here is a task, a state or a progress indicator, because this
 * component cannot know one. If you have nothing true to put in a cell, leave
 * the cell out. If you have nothing true at all, pass no cells and the line
 * renders nothing rather than an empty bar.
 *
 * THE LINE STAYS DARK on a light page, on purpose. A status line is chrome,
 * not content, and keeping it the same color on both halves of a site is what
 * makes a reader recognize it as the same object.
 *
 * IT IS FIXED TO THE FOOT of the viewport, so the page under it needs
 * `padding-bottom: var(--nova-status-height, 1.75rem)` or its last line hides
 * behind it.
 *
 * NOTHING MOVES and nothing needs JavaScript: it is text and hairlines, and
 * the server renders all of it.
 *
 * COLORS come from the landing page's token block. This component defines none
 * of its own. Used outside that page, define the `--nova-*` tokens it reads on
 * any ancestor: `--nova-bg`, `--nova-surface`, `--nova-border`, `--nova-text`,
 * `--nova-text-dim`, `--nova-accent`, `--nova-gutter`, `--nova-font-mono`, and
 * the five state colors the glyphs take.
 */
@customElement('litro-status-line')
export class LitroStatusLine extends LitElement {
  static override properties = {
    siteTitle: { type: String },
    homeHref: { type: String },
    cells: { type: Array },
    label: { type: String },
    glyphs: { type: Object },
  };

  static override styles = css`
    :host {
      /* Fixed, because a status line that scrolls away is a footer. The page
         above it carries the matching padding-bottom. */
      position: fixed;
      inset: auto 0 0 0;
      z-index: 50;
      display: block;
    }

    /* Nothing to say, nothing drawn. An empty bar is worse than no bar: it
       takes the same room and tells the reader nothing. */
    :host([hidden]) {
      display: none;
    }

    .line {
      --arrow: 0.6rem;
      display: flex;
      align-items: stretch;
      /* border-box, because a shadow root does not inherit the page's reset.
         With the default content-box the hairline on top is ADDED to the
         height, the line is a pixel taller than the padding a page leaves for
         it, and the last line of that page ends up under it. */
      box-sizing: border-box;
      height: var(--nova-status-height, 1.75rem);
      font-family: var(--nova-font-mono);
      font-size: 0.75rem;
      line-height: 1;
      color: var(--nova-text-dim);
      background: var(--nova-bg);
      border-top: 1px solid var(--nova-border);
      /* The line is one row and never wraps. On a phone the optional cells
         are dropped instead, which is the only honest way to make a status
         line narrower. */
      overflow: hidden;
    }

    .cell {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0 0.8rem;
      white-space: nowrap;
      min-width: 0;
    }

    .cell + .cell {
      border-left: 1px solid var(--nova-border);
    }

    /* The mode segment: the project's name, in the accent, with the powerline
       arrow the status bar used to draw at the top of the page. */
    .mode {
      padding: 0 calc(0.6rem + var(--arrow)) 0 var(--nova-gutter);
      font-weight: 700;
      color: #fff;
      background: var(--nova-accent);
      text-decoration: none;
      clip-path: polygon(
        0 0,
        calc(100% - var(--arrow)) 0,
        100% 50%,
        calc(100% - var(--arrow)) 100%,
        0 100%
      );
    }

    .mode + .cell {
      border-left: 0;
      padding-left: 0.5rem;
    }

    /* The first cell after the mode may have to give way; the mode and the
       cells at the right end never do. */
    .cell.flexible {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
      line-height: var(--nova-status-height, 1.75rem);
    }

    .right {
      margin-left: auto;
    }

    b {
      color: var(--nova-text);
      font-weight: 600;
    }

    a {
      color: var(--nova-text-dim);
      text-decoration: none;
    }

    a:hover,
    a:focus-visible {
      color: var(--nova-text);
      text-decoration: underline;
    }

    a:focus-visible,
    .mode:focus-visible {
      outline: 2px solid var(--nova-accent);
      outline-offset: -2px;
    }

    .mode:hover {
      filter: brightness(1.1);
    }

    /* The glyph set, one per state, from litro-state-badge. */
    .glyph {
      font-weight: 700;
    }

    .glyph[data-state='error'] {
      color: var(--nova-error);
    }
    .glyph[data-state='blocked'] {
      color: var(--nova-blocked);
    }
    .glyph[data-state='working'] {
      color: var(--nova-working);
    }
    .glyph[data-state='done'] {
      color: var(--nova-done);
    }
    .glyph[data-state='idle'] {
      color: var(--nova-idle);
    }

    /* A phone has room for the mode, where you are, and one action. */
    @media (max-width: 52rem) {
      .cell.optional {
        display: none;
      }
    }

    @media (max-width: 30rem) {
      .mode {
        padding-left: 0.75rem;
      }

      .cell {
        padding: 0 0.6rem;
      }

      /* The last thing to go is the path under the section. The section name
         still says where the reader is, and the cell at the right end — the
         one thing on the line to click — stays whole rather than being cut
         mid-word, which is what a row that merely overflows would do. */
      .trail {
        display: none;
      }
    }
  `;

  /** The project's name, shown in the mode segment. */
  siteTitle = '';

  /** Where the mode segment links to. */
  homeHref = '/';

  /** The cells, left to right. Empty means the line is not rendered. */
  cells: StatusCell[] = [];

  /**
   * What the line is, in a few words. It names the landmark, so a reader
   * arriving at it knows what they have reached before they hear the cells.
   */
  label = '';

  /** The badge glyph set, so a project can use its own. */
  glyphs: GlyphSet = DEFAULT_GLYPHS;

  override render() {
    const cells = this.cells ?? [];
    if (cells.length === 0) return null;

    const glyphs = this.glyphs ?? DEFAULT_GLYPHS;

    return html`
      <!-- An aside, so the line sits inside a landmark rather than leaving
           content outside one — and an aside rather than a footer, because a
           page may already have a footer and two contentinfo landmarks is a
           violation in itself. A status line is complementary to the page it
           describes, which is what an aside is for.

           The label property names the landmark, so a reader can tell what
           they have reached before they hear the cells, and so this landmark
           is distinguishable from any other aside on the page. The glyphs are
           the only thing hidden, because a bracket and a plus sign read aloud
           say nothing. -->
      <aside class="line" aria-label="${this.label || 'Status'}">
        ${this.siteTitle
          ? html`<a class="cell mode" href="${this.homeHref}"
              >${this.siteTitle}</a
            >`
          : ''}
        ${cells.map((cell) => {
          const body = html`${cell.state
            ? html`<span class="glyph" data-state="${cell.state}" aria-hidden="true"
                >${glyphs[cell.state]}</span
              >`
            : ''}${cell.label ? html`<span>${cell.label}</span>` : ''}${cell.value
            ? html`<b>${cell.value}</b>`
            : ''}${cell.trailing
            ? html`<span class="trail">${cell.trailing}</span>`
            : ''}`;

          const classes = [
            'cell',
            cell.right ? 'right' : '',
            cell.optional ? 'optional' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return cell.href
            ? html`<span class="${classes}"
                ><a href="${cell.href}">${body}</a></span
              >`
            : html`<span class="${classes}">${body}</span>`;
        })}
      </aside>
    `;
  }
}

export default LitroStatusLine;
