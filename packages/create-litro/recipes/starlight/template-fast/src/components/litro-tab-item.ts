import { FASTElement, attr, html, css } from '@microsoft/fast-element';

/**
 * <litro-tab-item label="Tab Label">
 *   A single tab panel managed by a parent <litro-tabs> element.
 *   Hidden automatically when not selected.
 * </litro-tab-item>
 */
export class LitroTabItem extends FASTElement {
  @attr label = '';
  @attr({ mode: 'boolean' }) selected = false;
}

const template = html<LitroTabItem>`<slot></slot>`;

const styles = css`
  :host {
    display: block;
  }

  :host(:not([selected])) {
    display: none;
  }
`;

LitroTabItem.define({ name: 'litro-tab-item', template, styles });

export default LitroTabItem;
