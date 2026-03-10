import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

/**
 * <sl-card-grid>
 *   Responsive auto-fit grid for <sl-card> elements.
 *   Single slot — place <sl-card> elements directly inside.
 * </sl-card-grid>
 */
@customElement('sl-card-grid')
export class SlCardGrid extends LitElement {
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

export default SlCardGrid;
