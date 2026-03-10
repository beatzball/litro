import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { SlTabItem } from './sl-tab-item.js';

/**
 * <sl-tabs>
 *   <sl-tab-item label="First">Content A</sl-tab-item>
 *   <sl-tab-item label="Second">Content B</sl-tab-item>
 * </sl-tabs>
 *
 * Reads slotted <sl-tab-item> elements via the slotchange event.
 * Renders a tab bar in Shadow DOM; clicking selects the tab.
 */
@customElement('sl-tabs')
export class SlTabs extends LitElement {
  static override properties = {
    _labels: { type: Array, state: true },
    _selectedIndex: { type: Number, state: true },
  };

  static override styles = css`
    :host {
      display: block;
      margin: 1.5rem 0;
    }

    .tab-bar {
      display: flex;
      gap: 0;
      border-bottom: 2px solid var(--sl-color-border, #e8e8e8);
      overflow-x: auto;
    }

    .tab-btn {
      appearance: none;
      background: none;
      border: none;
      padding: 0.5rem 1rem;
      font: inherit;
      font-size: var(--sl-text-sm, 0.875rem);
      font-weight: 500;
      cursor: pointer;
      color: var(--sl-color-gray-4, #757575);
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      white-space: nowrap;
      transition: color 0.15s, border-color 0.15s;
    }

    .tab-btn:hover {
      color: var(--sl-color-text, #23262f);
    }

    .tab-btn[aria-selected='true'] {
      color: var(--sl-color-accent, #7c3aed);
      border-bottom-color: var(--sl-color-accent, #7c3aed);
    }

    .tab-content {
      padding-top: 1rem;
    }
  `;

  _labels: string[] = [];
  _selectedIndex = 0;

  private _items(): SlTabItem[] {
    const slot = this.shadowRoot?.querySelector('slot');
    if (!slot) return [];
    return slot.assignedElements().filter(
      (el): el is SlTabItem => el.tagName.toLowerCase() === 'sl-tab-item',
    );
  }

  private _onSlotChange() {
    const items = this._items();
    this._labels = items.map((item) => item.label || `Tab ${items.indexOf(item) + 1}`);
    this._selectIndex(this._selectedIndex < items.length ? this._selectedIndex : 0, items);
  }

  private _selectIndex(index: number, items?: SlTabItem[]) {
    const all = items ?? this._items();
    this._selectedIndex = index;
    all.forEach((item, i) => {
      item.selected = i === index;
    });
  }

  override render() {
    return html`
      <div class="tab-bar" role="tablist">
        ${this._labels.map((label, i) => html`
          <button
            class="tab-btn"
            role="tab"
            aria-selected="${this._selectedIndex === i ? 'true' : 'false'}"
            @click=${() => this._selectIndex(i)}
          >${label}</button>
        `)}
      </div>
      <div class="tab-content">
        <slot @slotchange=${this._onSlotChange}></slot>
      </div>
    `;
  }
}

export default SlTabs;
