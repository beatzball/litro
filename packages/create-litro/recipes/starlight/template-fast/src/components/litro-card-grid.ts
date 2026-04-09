import { FASTElement, html, css } from '@microsoft/fast-element';

/**
 * <litro-card-grid>
 *   Responsive auto-fit grid for <litro-card> elements.
 *   Single slot — place <litro-card> elements directly inside.
 * </litro-card-grid>
 */
export class LitroCardGrid extends FASTElement {}

const template = html<LitroCardGrid>`
  <div class="grid">
    <slot></slot>
  </div>
`;

const styles = css`
  :host {
    display: block;
    counter-reset: card;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 1.25rem;
  }
`;

LitroCardGrid.define({ name: 'litro-card-grid', template, styles });

export default LitroCardGrid;
