import { Elena, html, unsafeHTML } from '@elenajs/core';
import type { LitroTabItem } from './litro-tab-item.js';

/**
 * <litro-tabs>
 *   <litro-tab-item label="First">Content A</litro-tab-item>
 *   <litro-tab-item label="Second">Content B</litro-tab-item>
 * </litro-tabs>
 *
 * Light DOM tabs — discovers children via querySelectorAll.
 */
export class LitroTabs extends Elena(HTMLElement) {
  static tagName = 'litro-tabs';
  static props = ['_labels', '_selectedIndex'];

  _labels: string[] = [];
  _selectedIndex = 0;

  private _items(): LitroTabItem[] {
    return Array.from(this.querySelectorAll('litro-tab-item')) as LitroTabItem[];
  }

  override connectedCallback() {
    super.connectedCallback();
    this._syncItems();
  }

  private _syncItems() {
    const items = this._items();
    this._labels = items.map((item, i) => item.label || `Tab ${i + 1}`);
    this._selectIndex(this._selectedIndex < items.length ? this._selectedIndex : 0, items);
  }

  private _selectIndex(index: number, items?: LitroTabItem[]) {
    const all = items ?? this._items();
    this._selectedIndex = index;
    all.forEach((item, i) => {
      if (i === index) {
        item.setAttribute('selected', '');
        item.selected = true;
      } else {
        item.removeAttribute('selected');
        item.selected = false;
      }
    });
  }

  _handleTabClick(index: number) {
    this._selectIndex(index);
  }

  render() {
    const tabButtons = this._labels.map((label, i) =>
      `<button class="tab-btn" role="tab" aria-selected="${this._selectedIndex === i ? 'true' : 'false'}" data-index="${i}">${label}</button>`
    ).join('');

    return html`
      <style>
        @scope (litro-tabs) {
          :scope { display: block; margin: 1.5rem 0; }
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
          .tab-btn:hover { color: var(--sl-color-text, #23262f); }
          .tab-btn[aria-selected='true'] {
            color: var(--sl-color-accent, #7c3aed);
            border-bottom-color: var(--sl-color-accent, #7c3aed);
          }
          .tab-content { padding-top: 1rem; }
        }
      </style>
      <div class="tab-bar" role="tablist">${unsafeHTML(tabButtons)}</div>
      <div class="tab-content">${unsafeHTML(this.innerHTML)}</div>
    `;
  }
}

LitroTabs.define();

export default LitroTabs;
