import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

/**
 * <sl-tab-item label="Tab Label">
 *   A single tab panel managed by a parent <sl-tabs> element.
 *   Hidden automatically when not selected.
 * </sl-tab-item>
 */
@customElement('sl-tab-item')
export class SlTabItem extends LitElement {
  static override properties = {
    label: { type: String },
    selected: { type: Boolean, reflect: true },
  };

  static override styles = css`
    :host {
      display: block;
    }

    :host(:not([selected])) {
      display: none;
    }
  `;

  label = '';
  selected = false;

  override render() {
    return html`<slot></slot>`;
  }
}

export default SlTabItem;
