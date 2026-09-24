import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

import { DEFAULT_GLYPHS } from './litro-state-badge.js';
import type { BadgeState, GlyphSet } from './litro-state-badge.js';

/**
 * <litro-pane name="pages/" state="done" meta="routing" span="2">
 *   <p>A file is a route.</p>
 * </litro-pane>
 *
 * One cell of a feature block, drawn as a terminal pane: a title strip on the
 * raised surface with a state glyph, a name in the mono, and an optional note
 * pushed to the right; then the body, whatever the page slots in.
 *
 * IT IS NOT A CARD, AND THAT IS THE POINT. It has square corners, no shadow,
 * and no border of its own — the grid draws the hairlines between panes so
 * neighbors SHARE one rule instead of each carrying its own. A block of these
 * reads as one object with divisions, the way a tiling window manager lays out
 * panes, rather than as a scatter of floating boxes. The references this page
 * is measured against both do exactly this, and neither uses a card kit.
 *
 * THE GLYPH SAYS SOMETHING TRUE OR IT IS NOT THERE. `[+]` for a thing that
 * ships today, `[~]` for one that is still moving, from the same set the
 * status line and the terminal windows use. Leave `state` unset and no glyph
 * is drawn. Do not reach for a decorative icon instead: a scaffolded page has
 * nothing true to say with one, so it says it in words.
 *
 * THE `icon` SLOT is for a real mark — a dependency's logo, a language's
 * mark — where a project has one and it carries information. It is drawn small,
 * before the name. Slot nothing and nothing is drawn; there is no placeholder.
 *
 * `span` is how many of the grid's six columns the pane takes: 3 for a half,
 * 2 for a third. See litro-pane-grid.
 *
 * COLORS come from the landing page's token block. This component defines none
 * of its own. Used outside that page, define the `--nova-*` tokens it reads on
 * any ancestor: `--nova-bg`, `--nova-surface`, `--nova-border`, `--nova-text`,
 * `--nova-text-dim`, `--nova-accent`, `--nova-font-mono`, and the five state
 * colors the glyph takes.
 */
@customElement('litro-pane')
export class LitroPane extends LitElement {
  static override properties = {
    name: { type: String },
    state: { type: String },
    meta: { type: String },
    span: { type: Number, reflect: true },
    current: { type: Boolean, reflect: true },
    href: { type: String },
    glyphs: { type: Object },
  };

  static override styles = css`
    /* A document stylesheet stops at this shadow boundary, so the box-sizing
       reset has to be repeated inside it. Without it a padded full-width box
       measures its width PLUS its gutters, and a phone scrolls sideways by
       exactly the gutter.
       See .agents/rules/adapters-ssr.md (SSR-008). */
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    :host {
      /* The span is a REFLECTED attribute and the rules below are plain
         selectors, so the width is decided by CSS alone. Writing it as an
         inline style from a lifecycle method looked simpler and was wrong:
         Lit SSR runs willUpdate() on the server, where the element has no
         real style object, so the whole render threw and the page streamed
         out half-finished. Nothing here touches the DOM. */
      grid-column: span 3;
      display: flex;
      flex-direction: column;
      /* The pane paints the ground; the grid's 1px gaps show through as the
         hairlines between panes. */
      background: var(--nova-bg);
      min-width: 0;
    }

    :host([span='1']) {
      grid-column: span 1;
    }
    :host([span='2']) {
      grid-column: span 2;
    }
    :host([span='4']) {
      grid-column: span 4;
    }
    :host([span='5']) {
      grid-column: span 5;
    }
    :host([span='6']) {
      grid-column: span 6;
    }

    .strip {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.55rem 1rem;
      background: var(--nova-surface);
      border-bottom: 1px solid var(--nova-border);
      font-family: var(--nova-font-mono);
      font-size: 0.8125rem;
      line-height: 1.4;
      min-width: 0;
    }

    /* The one loud note in the block, and only where a page asks for it. It is
       the same move the status line's mode segment makes, so the two read as
       the same idea rather than as two different highlights. */
    :host([current]) .strip {
      background: var(--nova-accent-high, var(--nova-accent));
      border-bottom-color: var(--nova-accent-high, var(--nova-accent));
      color: #fff;
    }

    .name {
      font-weight: 700;
      color: var(--nova-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :host([current]) .name,
    :host([current]) .meta,
    :host([current]) .glyph {
      color: #fff;
    }

    /* The note gives way before the name does. A name cut to "Web Com…" is a
       pane a reader cannot identify; a note cut short is a note. */
    .meta {
      margin-left: auto;
      color: var(--nova-text-dim);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    .glyph {
      font-weight: 700;
      flex-shrink: 0;
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

    /* A slot with nothing assigned has no box, so a pane with no icon has no
       gap where one would have been. */
    ::slotted([slot='icon']) {
      display: block;
      width: 1.1rem;
      height: 1.1rem;
      object-fit: contain;
      flex-shrink: 0;
    }

    .body {
      flex: 1;
      padding: 1rem;
      color: var(--nova-text-dim);
      font-size: 0.9375rem;
      line-height: 1.65;
    }

    /* A whole pane can be a link. The strip and the body both belong to it, so
       the anchor wraps the lot rather than sitting inside the body. */
    a.pane-link {
      display: flex;
      flex-direction: column;
      flex: 1;
      color: inherit;
      text-decoration: none;
    }

    a.pane-link:hover .name {
      color: var(--nova-accent);
    }

    a.pane-link:focus-visible {
      outline: 2px solid var(--nova-accent);
      outline-offset: -2px;
    }
  `;

  /** The pane's name, in the strip. */
  name = '';

  /** A state glyph before the name. Unset means no glyph. */
  state: BadgeState | '' = '';

  /** A short note at the right end of the strip: a version, a tag. */
  meta = '';

  /** How many of the grid's six columns this pane takes. */
  span = 3;

  /** Draws the strip in the accent. One pane at most. */
  current = false;

  /** Makes the whole pane a link. */
  href = '';

  /** The badge glyph set, so a project can use its own. */
  glyphs: GlyphSet = DEFAULT_GLYPHS;

  override render() {
    const glyphs = this.glyphs ?? DEFAULT_GLYPHS;

    const inner = html`
      <div class="strip">
        ${this.state
          ? html`<span class="glyph" data-state="${this.state}" aria-hidden="true"
              >${glyphs[this.state as BadgeState]}</span
            >`
          : ''}
        <slot name="icon"></slot>
        <span class="name">${this.name}</span>
        ${this.meta ? html`<span class="meta">${this.meta}</span>` : ''}
      </div>
      <div class="body"><slot></slot></div>
    `;

    return this.href
      ? html`<a class="pane-link" href="${this.href}">${inner}</a>`
      : inner;
  }
}

export default LitroPane;
