import { Elena, html, unsafeHTML } from '@elenajs/core';

/**
 * <litro-card-grid>
 *   Responsive auto-fit grid for <litro-card> elements.
 *   Children render in light DOM — no slots needed.
 * </litro-card-grid>
 */
export class LitroCardGrid extends Elena(HTMLElement) {
  static tagName = 'litro-card-grid';

  render() {
    return html`
      <style>
        @scope (litro-card-grid) {
          :scope {
            display: block;
            counter-reset: card;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
            gap: 1.25rem;
          }
        }
      </style>
      <div class="grid">${unsafeHTML(this.innerHTML)}</div>
    `;
  }
}

LitroCardGrid.define();

export default LitroCardGrid;
