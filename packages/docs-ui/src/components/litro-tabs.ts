import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { LitroTabItem } from './litro-tab-item.js';

/**
 * <litro-tabs>
 *   <litro-tab-item label="First">Content A</litro-tab-item>
 *   <litro-tab-item label="Second">Content B</litro-tab-item>
 * </litro-tabs>
 *
 * Reads slotted <litro-tab-item> elements via the slotchange event.
 * Renders a tab bar in Shadow DOM; clicking selects the tab.
 *
 * Implements the WAI-ARIA Tabs Pattern with automatic activation:
 * - Arrow keys move focus and activate tabs
 * - Home/End jump to first/last tab
 * - Roving tabindex on tab buttons
 * - aria-controls / aria-labelledby link tabs to panels
 */
@customElement('litro-tabs')
export class LitroTabs extends LitElement {
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

    .tab-btn:focus-visible {
      outline: 2px solid var(--sl-color-accent, #7c3aed);
      outline-offset: -2px;
    }

    .tab-content {
      padding-top: 1rem;
    }
  `;

  _labels: string[] = [];
  _selectedIndex = 0;
  private _uid = Math.random().toString(36).slice(2, 8);

  private _tabId(i: number): string {
    return `litro-tab-${this._uid}-${i}`;
  }

  private _panelId(i: number): string {
    return `litro-panel-${this._uid}-${i}`;
  }

  private _items(): LitroTabItem[] {
    const slot = this.shadowRoot?.querySelector('slot');
    if (!slot) return [];
    return slot.assignedElements().filter(
      (el): el is LitroTabItem => el.tagName.toLowerCase() === 'litro-tab-item',
    );
  }

  private _onSlotChange() {
    const items = this._items();
    this._labels = items.map((item) => item.label || `Tab ${items.indexOf(item) + 1}`);
    this._selectIndex(this._selectedIndex < items.length ? this._selectedIndex : 0, items);
  }

  private _selectIndex(index: number, items?: LitroTabItem[]) {
    const all = items ?? this._items();
    this._selectedIndex = index;
    all.forEach((item, i) => {
      item.selected = i === index;
      item.setAttribute('role', 'tabpanel');
      item.setAttribute('id', this._panelId(i));
      item.setAttribute('aria-labelledby', this._tabId(i));
      item.setAttribute('tabindex', '0');
    });
  }

  private _onTabKeydown(e: KeyboardEvent) {
    const count = this._labels.length;
    if (count === 0) return;

    let newIndex = this._selectedIndex;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      newIndex = (this._selectedIndex + 1) % count;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      newIndex = this._selectedIndex <= 0 ? count - 1 : this._selectedIndex - 1;
    } else if (e.key === 'Home') {
      e.preventDefault();
      newIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      newIndex = count - 1;
    } else {
      return;
    }

    this._selectIndex(newIndex);
    // Focus the newly selected tab button.
    requestAnimationFrame(() => {
      const btn = this.shadowRoot?.querySelector(`#${this._tabId(newIndex)}`) as HTMLElement | null;
      btn?.focus();
    });
  }

  override render() {
    return html`
      <div class="tab-bar" role="tablist">
        ${this._labels.map((label, i) => html`
          <button
            class="tab-btn"
            role="tab"
            id="${this._tabId(i)}"
            aria-selected="${this._selectedIndex === i ? 'true' : 'false'}"
            aria-controls="${this._panelId(i)}"
            tabindex="${this._selectedIndex === i ? '0' : '-1'}"
            @click=${() => this._selectIndex(i)}
            @keydown=${(e: KeyboardEvent) => this._onTabKeydown(e)}
          >${label}</button>
        `)}
      </div>
      <div class="tab-content">
        <slot @slotchange=${this._onSlotChange}></slot>
      </div>
    `;
  }
}

export default LitroTabs;
