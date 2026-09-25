import { FASTElement, attr, html, css } from '@microsoft/fast-element';
import { pageReset } from '@beatzball/litro/adapter/fast/page-reset';

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

const styles = [pageReset, css`
  :host {
    display: block;
  }

  :host(:not([selected])) {
    display: none;
  }
`];

LitroTabItem.define({ name: 'litro-tab-item', template, styles });

export default LitroTabItem;
