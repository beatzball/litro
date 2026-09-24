import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

/**
 * <litro-pane-grid>
 *   <litro-pane name="pages/" span="2">…</litro-pane>
 *   <litro-pane name="server/api/" span="2">…</litro-pane>
 *   <litro-pane name="LitroRouter" span="2">…</litro-pane>
 * </litro-pane-grid>
 *
 * The frame a block of `litro-pane` elements sits in: six columns, so a row is
 * either two halves (span 3) or three thirds (span 2), and any mix that adds
 * up to six.
 *
 * THE HAIRLINES ARE THE GAPS. The grid has a 1px gap filled with the border
 * color and the panes paint the ground, so what shows between two panes is one
 * rule that both of them share — not two borders sitting side by side, and not
 * a shadow. That is the whole difference between this and a card grid: cards
 * float, panes divide.
 *
 * It follows that a pane must NOT set a border of its own. If a pane looks
 * doubly ruled, that is why.
 *
 * ON A PHONE every pane takes the full width, because a third of 390px is not
 * a column, it is a word per line.
 *
 * COLORS come from the landing page's token block. This component defines none
 * of its own: it reads `--nova-border` for the rules and nothing else.
 */
@customElement('litro-pane-grid')
export class LitroPaneGrid extends LitElement {
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
      display: block;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      /* The gap IS the hairline: it shows the background through, so two
         neighbors share one rule. The same color on the outside closes the
         block off, which is why this is a border and not padding. */
      gap: 1px;
      background: var(--nova-border);
      border: 1px solid var(--nova-border);
    }

    @media (max-width: 52rem) {
      .grid {
        grid-template-columns: 1fr;
      }

      /* A third of a phone is not a column. Every pane takes the full width,
         and the span each one asked for is ignored. */
      ::slotted(litro-pane) {
        grid-column: span 1 !important;
      }
    }
  `;

  override render() {
    return html`<div class="grid"><slot></slot></div>`;
  }
}

export default LitroPaneGrid;
