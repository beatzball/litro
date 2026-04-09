import { FASTElement, Observable, html, css, repeat } from '@microsoft/fast-element';
import type { LitroTabItem } from './litro-tab-item.js';

/**
 * <litro-tabs>
 *   <litro-tab-item label="First">Content A</litro-tab-item>
 *   <litro-tab-item label="Second">Content B</litro-tab-item>
 * </litro-tabs>
 */
export class LitroTabs extends FASTElement {
  labels: string[] = [];
  selectedIndex = 0;

  private _items(): LitroTabItem[] {
    const slot = this.shadowRoot?.querySelector('slot');
    if (!slot) return [];
    return slot.assignedElements().filter(
      (el): el is LitroTabItem => el.tagName.toLowerCase() === 'litro-tab-item',
    );
  }

  handleSlotChange() {
    const items = this._items();
    this.labels = items.map((item, i) => item.label || `Tab ${i + 1}`);
    this.selectIndex(this.selectedIndex < items.length ? this.selectedIndex : 0, items);
  }

  selectIndex(index: number, items?: LitroTabItem[]) {
    const all = items ?? this._items();
    this.selectedIndex = index;
    all.forEach((item, i) => {
      item.selected = i === index;
    });
  }
}
Observable.defineProperty(LitroTabs.prototype, 'labels');
Observable.defineProperty(LitroTabs.prototype, 'selectedIndex');

const template = html<LitroTabs>`
  <div class="tab-bar" role="tablist">
    ${repeat(x => x.labels, html<string, LitroTabs>`
      <button
        class="tab-btn"
        role="tab"
        aria-selected="${(_, c) => c.parent.selectedIndex === c.index ? 'true' : 'false'}"
        @click="${(_, c) => c.parent.selectIndex(c.index)}"
      >${x => x}</button>
    `)}
  </div>
  <div class="tab-content">
    <slot @slotchange="${x => x.handleSlotChange()}"></slot>
  </div>
`;

const styles = css`
  :host { display: block; margin: 1.5rem 0; }

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
`;

LitroTabs.define({ name: 'litro-tabs', template, styles });

export default LitroTabs;
