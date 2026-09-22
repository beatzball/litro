import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

/**
 * <litro-feature-row heading="Name the first thing it does" .commands="${[...]}">
 *   <p>One short paragraph.</p>
 *   <div slot="figure">…a picture…</div>
 * </litro-feature-row>
 *
 * One row of the "what it does" section: a heading, whatever you slot in as
 * the text, an optional row of command chips, and an optional picture.
 *
 * Rows alternate sides on a wide screen. That is done with `:nth-of-type`, so
 * it needs no property and no JavaScript: put the rows next to each other and
 * the second, fourth and sixth put their picture on the left. Below 48rem
 * every row stacks, picture last.
 *
 * A row with nothing in its `figure` slot does not leave half the width empty:
 * the picture's grid track is sized `auto`, so with nothing in it the track
 * collapses. That needs no property and no JavaScript either.
 *
 * SLOTTED CONTENT IS STYLED BY THE PAGE, NOT BY THIS COMPONENT. Shadow DOM
 * styles do not reach into a slot, so the paragraph you pass in and the
 * picture you pass into `figure` keep the page's own rules. That is on
 * purpose: the picture is yours. The one exception is how wide the picture
 * is allowed to grow, which is the row's business and is set with
 * `::slotted()`.
 *
 * COLORS come from the landing page's token block. This component defines
 * none of its own. Used outside that page, define the `--nova-*` tokens it
 * reads on any ancestor: `--nova-surface`, `--nova-border`, `--nova-text`,
 * `--nova-radius`, `--nova-font-mono`.
 */
@customElement('litro-feature-row')
export class LitroFeatureRow extends LitElement {
  static override properties = {
    heading: { type: String },
    commands: { type: Array },
  };

  static override styles = css`
    :host {
      display: block;
    }

    /* The figure slot is a DIRECT child of the row, with no wrapper around it.
       A slot is display: contents, so with nothing assigned to it there is no
       box at all — no empty column, and no gap beside one. That is why a row
       with no picture lays out correctly with no property and no JavaScript. */
    .row {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .text {
      /* A readable line length, whether or not a picture sits beside it. */
      max-width: 44rem;
      min-width: 0;
    }

    @media (min-width: 48rem) {
      .row {
        flex-direction: row;
        align-items: center;
        gap: 3rem;
      }

      /* Even rows put the picture on the left. Source order does not change,
         so a screen reader and a keyboard still meet the heading first.
         flex-end keeps the text against the left edge on a row that has no
         picture, where reversing would otherwise push it to the right. */
      :host(:nth-of-type(even)) .row {
        flex-direction: row-reverse;
        justify-content: flex-end;
      }
    }

    ::slotted([slot='figure']) {
      flex: 1 1 0;
      min-width: 0;
    }

    h2 {
      font-size: 1.5rem;
      font-weight: 700;
      line-height: 1.25;
      color: var(--nova-text);
      margin: 0 0 0.6rem;
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin: 1rem 0 0;
      padding: 0;
      list-style: none;
    }

    .chips li {
      padding: 0.25rem 0.6rem;
      border: 1px solid var(--nova-border);
      border-radius: var(--nova-radius);
      background: var(--nova-surface);
      font-family: var(--nova-font-mono);
      font-size: 0.8rem;
      color: var(--nova-text);
    }

  `;

  /** The row's heading. Rendered as an `h2`. */
  heading = '';

  /** Commands shown as chips under the text. Leave empty for none. */
  commands: string[] = [];

  override render() {
    const commands = this.commands ?? [];
    return html`
      <div class="row">
        <div class="text">
          <h2>${this.heading}</h2>
          <slot></slot>
          ${commands.length > 0
            ? html`
                <ul class="chips">
                  ${commands.map((command) => html`<li>${command}</li>`)}
                </ul>
              `
            : ''}
        </div>
        <slot name="figure"></slot>
      </div>
    `;
  }
}

export default LitroFeatureRow;
