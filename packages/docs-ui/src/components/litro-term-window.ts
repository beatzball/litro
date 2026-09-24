import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

// The rows are drawn with state badges, so the badge has to be registered
// before this element renders.
import './litro-state-badge.js';
import { DEFAULT_GLYPHS } from './litro-state-badge.js';
import type { BadgeState, GlyphSet } from './litro-state-badge.js';

/** One line of the picture: a state, how long it has been that way, a name. */
export interface TermRow {
  /** The state, drawn as a badge and named beside it. */
  state: BadgeState;
  /** How long, e.g. "4m". Any short string will do. */
  age: string;
  /** What the row is about, e.g. a task or a machine. */
  name: string;
  /** The one row worth looking at. Highlighted, with a colored edge. */
  hot?: boolean;
}

/**
 * <litro-term-window
 *   label="Three tasks listed by state. deploy is blocked, test is working, build is done."
 *   .rows="${ROWS}"
 * ></litro-term-window>
 *
 * <litro-term-window label="A shell session: the build runs and passes.">
 *   <pre>$ my-product build
 * ok</pre>
 * </litro-term-window>
 *
 * A small terminal picture, in one of two shapes. Set `rows` and it draws a
 * list of state, age and name. Set nothing and it draws whatever you slot in,
 * which is how a shell transcript goes in: a `<pre>` with the session in it.
 *
 * IT IS A PICTURE, AND IT IS READ AS ONE. The window carries a single
 * `role="img"` and the sentence you pass as `label`, and everything inside is
 * hidden from assistive tech. So a screen reader hears one sentence rather
 * than a column of glyphs, ages and names that mean nothing read aloud in
 * order. WRITE A REAL SENTENCE: it is the only thing a reader who cannot see
 * the picture gets. An empty `label` hides the picture from assistive tech
 * altogether, which is right only if it says nothing the page has not already
 * said in words.
 *
 * IT IS ALSO A TAB STOP, because a long transcript line makes the window
 * scroll sideways and a reader with a keyboard and no pointer has no other way
 * to reach the end of the line.
 *
 * NOTHING HERE MOVES on its own. A row's badge settles only if you give it a
 * `from` state, which these rows do not.
 *
 * COLORS come from the landing page's token block. This component defines
 * none of its own. Used outside that page, define the `--nova-*` tokens it
 * reads on any ancestor: `--nova-surface`, `--nova-border`, `--nova-text`,
 * `--nova-text-dim`, `--nova-blocked`, `--nova-radius`, `--nova-font-mono`,
 * and the state tokens the badge reads.
 */
@customElement('litro-term-window')
export class LitroTermWindow extends LitElement {
  static override properties = {
    label: { type: String },
    rows: { type: Array },
    glyphs: { type: Object },
  };

  static override styles = css`
    :host {
      display: block;
      /* min-width: 0, and the window does not fit on a phone without it. As a
         grid or flex item its automatic minimum size is its CONTENT's width —
         the widest transcript line plus the padding — so a wide transcript
         refuses to shrink, pushes its track past the screen, and the whole
         page scrolls sideways. WCAG 1.4.10 measures that at 320px. With this,
         the transcript scrolls inside .term instead. */
      min-width: 0;
    }

    .term {
      padding: 1rem 1.1rem;
      color: var(--nova-text-dim);
      background: var(--nova-surface);
      border: 1px solid var(--nova-border);
      border-radius: var(--nova-radius);
      font-family: var(--nova-font-mono);
      font-size: 0.8125rem;
      line-height: 1.7;
      overflow-x: auto;
    }

    /* The window scrolls sideways once a line is longer than it is, and a
       region that scrolls has to be reachable without a pointer, so it is a
       tab stop (WCAG 2.1.1; axe calls the failure
       scrollable-region-focusable). The label property is what a reader
       hears there, the same sentence the picture already carries. The ring is
       focus-visible only, so a mouse press shows nothing. */
    .term:focus-visible {
      outline: 2px solid var(--nova-accent, currentColor);
      outline-offset: 2px;
    }

    .row {
      display: grid;
      grid-template-columns: 8.5rem 3rem 1fr;
      align-items: center;
      padding: 0.15rem 0.5rem;
      margin: 0 -0.5rem;
      border-left: 2px solid transparent;
    }

    /* The row the picture is about. A border and a background, not color
       alone, so it still reads as the odd one out in grayscale. */
    .row.hot {
      color: var(--nova-text);
      background: var(--nova-border);
      border-left-color: var(--nova-blocked);
    }

    .name {
      color: var(--nova-text);
    }

    /* A slotted transcript keeps the PAGE's styles, so only the things the
       window itself is responsible for are set here: the margin it must not
       carry, and how long lines behave. */
    ::slotted(pre) {
      margin: 0;
      font-family: var(--nova-font-mono);
      font-size: 0.8125rem;
      line-height: 1.7;
      white-space: pre;
    }

    @media (max-width: 36rem) {
      .row {
        grid-template-columns: 7rem 2.5rem 1fr;
      }
    }
  `;

  /** The sentence a screen reader gets instead of the picture. */
  label = '';

  /** The rows to draw. Empty means the slotted content is drawn instead. */
  rows: TermRow[] = [];

  /** The badge glyph set, passed on to every row. */
  glyphs: GlyphSet = DEFAULT_GLYPHS;

  override render() {
    const rows = this.rows ?? [];

    return html`
      <div class="term" role="img" aria-label="${this.label}" tabindex="0">
        <div aria-hidden="true">
          ${rows.length > 0
            ? rows.map(
                (row) => html`
                  <div class="row ${row.hot ? 'hot' : ''}">
                    <litro-state-badge
                      state="${row.state}"
                      label="${row.state}"
                      .glyphs="${this.glyphs ?? DEFAULT_GLYPHS}"
                    ></litro-state-badge>
                    <span>${row.age}</span>
                    <span class="name">${row.name}</span>
                  </div>
                `,
              )
            : html`<slot></slot>`}
        </div>
      </div>
    `;
  }
}

export default LitroTermWindow;
