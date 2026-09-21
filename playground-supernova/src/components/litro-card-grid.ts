import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

/**
 * <litro-card-grid>
 *   Responsive auto-fit grid for <litro-card> elements.
 *   Single slot — place <litro-card> elements directly inside.
 * </litro-card-grid>
 */
@customElement('litro-card-grid')
export class LitroCardGrid extends LitElement {
  static override styles = css`
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

  override render() {
    return html`
      <div class="grid">
        <slot></slot>
      </div>
    `;
  }
}

export default LitroCardGrid;
