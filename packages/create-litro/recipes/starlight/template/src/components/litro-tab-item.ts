import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

/**
 * <litro-tab-item label="Tab Label">
 *   A single tab panel managed by a parent <litro-tabs> element.
 *   Hidden automatically when not selected.
 * </litro-tab-item>
 */
@customElement('litro-tab-item')
export class LitroTabItem extends LitElement {
  static override properties = {
    label: { type: String },
    selected: { type: Boolean, reflect: true },
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

export default LitroTabItem;
