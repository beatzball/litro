import { Elena, html, unsafeHTML } from '@elenajs/core';

/**
 * <litro-tab-item label="Tab Label">
 *   A single tab panel managed by a parent <litro-tabs> element.
 *   Hidden automatically when not selected (via attribute).
 * </litro-tab-item>
 */
export class LitroTabItem extends Elena(HTMLElement) {
  static tagName = 'litro-tab-item';
  static props = ['label', 'selected'];

  label = '';
  selected = false;

  render() {
    return html`
      <style>
        @scope (litro-tab-item) {
          :scope { display: block; }
          :scope:not([selected]) { display: none; }
        }
      </style>
      ${unsafeHTML(this.innerHTML)}
    `;
  }
}

LitroTabItem.define();

export default LitroTabItem;
