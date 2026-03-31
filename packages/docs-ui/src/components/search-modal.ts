import { LitElement, html, css, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';

export interface SearchModalResult {
  title: string;
  url: string;
  description: string;
  type: 'blog' | 'docs' | 'compare' | 'page';
}

/**
 * <search-modal>
 *   Pure UI component — search dialog with keyboard navigation and focus trap.
 *   Does NOT fetch data or navigate. Dispatches events for the consumer to handle.
 *
 *   Events:
 *     search-input  — { query: string }  — user typed in the input
 *     search-select — { url: string }    — user chose a result (click or Enter)
 *     search-close  — (no detail)        — user wants to close the modal
 */
@customElement('search-modal')
export class SearchModal extends LitElement {
  static override properties = {
    open: { type: Boolean, reflect: true },
    results: { type: Array },
    loading: { type: Boolean },
    query: { type: String },
    _activeIndex: { type: Number, state: true },
    _announceText: { type: String, state: true },
  };

  static override styles = css`
    :host(:not([open])) {
      display: none;
    }

    :host([open]) {
      display: block;
    }

    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 300;
      background: rgba(0, 0, 0, 0.5);
    }

    .modal {
      position: fixed;
      top: 15vh;
      left: 50%;
      transform: translateX(-50%);
      z-index: 301;
      width: min(90vw, 36rem);
      max-height: 70vh;
      border-radius: 0.75rem;
      background: var(--sl-color-bg, #fff);
      border: 1px solid var(--sl-color-border, #e8e8e8);
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    @media (max-width: 32rem) {
      .modal {
        top: 0;
        left: 0;
        transform: none;
        width: 100vw;
        max-height: 100vh;
        border-radius: 0;
      }
    }

    .search-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--sl-color-border, #e8e8e8);
    }

    .search-icon {
      width: 1.1rem;
      height: 1.1rem;
      flex-shrink: 0;
      color: var(--sl-color-gray-4, #888);
    }

    .search-input {
      flex: 1;
      border: none;
      outline: none;
      font-size: var(--sl-text-base, 1rem);
      background: transparent;
      color: var(--sl-color-text, #23262f);
      min-width: 0;
    }

    .search-input::placeholder {
      color: var(--sl-color-gray-4, #888);
    }

    .esc-hint {
      font-size: 0.65rem;
      font-family: inherit;
      background: var(--sl-color-gray-2, #e8e8e8);
      color: var(--sl-color-gray-5, #4b4b4b);
      border: 1px solid var(--sl-color-border, #e8e8e8);
      border-radius: 3px;
      padding: 0.15em 0.4em;
      flex-shrink: 0;
    }

    .results-list {
      list-style: none;
      margin: 0;
      padding: 0;
      overflow-y: auto;
      flex: 1;
      transition: opacity 0.15s;
    }

    .results-list.loading {
      opacity: 0.6;
    }

    .result-item {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      padding: 0.6rem 1rem;
      cursor: pointer;
      border-bottom: 1px solid var(--sl-color-gray-1, #f6f6f6);
      transition: background-color 0.1s;
    }

    .result-item:hover,
    .result-item.active {
      background: var(--sl-color-accent-low, #fff7ed);
    }

    .result-top {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .result-title {
      font-size: var(--sl-text-sm, 0.875rem);
      font-weight: 600;
      color: var(--sl-color-text, #23262f);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      min-width: 0;
    }

    .result-badge {
      font-size: 0.6rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 0.1em 0.45em;
      border-radius: 9999px;
      flex-shrink: 0;
    }

    .badge-blog {
      background: var(--sl-color-accent-low, #fff7ed);
      color: var(--sl-color-accent-high, #9a3412);
    }

    .badge-docs {
      background: var(--sl-color-note-bg, #eff6ff);
      color: var(--sl-color-note, #0284c7);
    }

    .badge-compare,
    .badge-page {
      background: var(--sl-color-gray-2, #e8e8e8);
      color: var(--sl-color-gray-5, #4b4b4b);
    }

    .result-desc {
      font-size: var(--sl-text-xs, 0.75rem);
      color: var(--sl-color-gray-4, #888);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .empty-state {
      padding: 2rem 1rem;
      text-align: center;
      color: var(--sl-color-gray-4, #888);
      font-size: var(--sl-text-sm, 0.875rem);
    }

    .loading-state {
      padding: 2rem 1rem;
      text-align: center;
      color: var(--sl-color-gray-4, #888);
      font-size: var(--sl-text-sm, 0.875rem);
    }

    .search-footer {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 1rem;
      border-top: 1px solid var(--sl-color-border, #e8e8e8);
      font-size: var(--sl-text-xs, 0.75rem);
      color: var(--sl-color-gray-4, #888);
      gap: 1rem;
    }

    .footer-key {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }

    .footer-key kbd {
      font-family: inherit;
      font-size: 0.65rem;
      background: var(--sl-color-gray-2, #e8e8e8);
      border: 1px solid var(--sl-color-border, #e8e8e8);
      border-radius: 3px;
      padding: 0 0.3em;
      line-height: 1.6;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `;

  open = false;
  results: SearchModalResult[] = [];
  loading = false;
  query = '';
  _activeIndex = -1;
  _announceText = '';
  _previousFocus: Element | null = null;
  _prevOpen = false;

  override updated(changed: Map<string, unknown>) {
    // Focus input when modal opens
    if (this.open && !this._prevOpen) {
      this._previousFocus = document.activeElement;
      requestAnimationFrame(() => {
        const input = this.renderRoot.querySelector('.search-input') as HTMLInputElement | null;
        input?.focus();
      });
    }
    // Restore focus when modal closes
    if (!this.open && this._prevOpen) {
      if (this._previousFocus && 'focus' in this._previousFocus) {
        (this._previousFocus as HTMLElement).focus();
      }
      this._activeIndex = -1;
    }
    this._prevOpen = this.open;

    // Announce result count
    if (changed.has('results') || changed.has('loading')) {
      if (!this.loading && this.query.length >= 2) {
        const count = this.results.length;
        this._announceText = count === 0
          ? 'No results found'
          : `${count} result${count !== 1 ? 's' : ''} found`;
      }
    }
  }

  private _onInput(e: InputEvent) {
    const value = (e.target as HTMLInputElement).value;
    this._activeIndex = -1;
    this.dispatchEvent(new CustomEvent('search-input', {
      detail: { query: value },
      bubbles: true,
      composed: true,
    }));
  }

  private _onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.results.length > 0) {
        this._activeIndex = (this._activeIndex + 1) % this.results.length;
        this._scrollActiveIntoView();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.results.length > 0) {
        this._activeIndex = this._activeIndex <= 0
          ? this.results.length - 1
          : this._activeIndex - 1;
        this._scrollActiveIntoView();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this._activeIndex >= 0 && this._activeIndex < this.results.length) {
        this._selectResult(this.results[this._activeIndex].url);
      } else if (this.query.trim().length > 0) {
        // No active result — fall back to full search page
        this._selectResult(`/search?q=${encodeURIComponent(this.query.trim())}`);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this._close();
    } else if (e.key === 'Tab') {
      // Trap focus inside the modal — only the input is tabbable
      e.preventDefault();
    }
  }

  private _scrollActiveIntoView() {
    requestAnimationFrame(() => {
      const item = this.renderRoot.querySelector(`.result-item[data-index="${this._activeIndex}"]`);
      item?.scrollIntoView({ block: 'nearest' });
    });
  }

  private _selectResult(url: string) {
    this.dispatchEvent(new CustomEvent('search-select', {
      detail: { url },
      bubbles: true,
      composed: true,
    }));
  }

  private _close() {
    this.dispatchEvent(new CustomEvent('search-close', {
      bubbles: true,
      composed: true,
    }));
  }

  private _onBackdropClick(e: MouseEvent) {
    // Only close if clicking the backdrop itself, not the modal
    if (e.target === e.currentTarget) {
      this._close();
    }
  }

  override render() {
    if (!this.open) return nothing;

    const activeId = this._activeIndex >= 0 ? `search-result-${this._activeIndex}` : undefined;

    return html`
      <div class="backdrop" @click="${this._onBackdropClick}">
        <div class="modal" role="dialog" aria-modal="true" aria-label="Search documentation">
          <div class="search-header">
            <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
            </svg>
            <input
              class="search-input"
              type="search"
              placeholder="Search documentation..."
              .value="${this.query}"
              @input="${this._onInput}"
              @keydown="${this._onKeydown}"
              aria-label="Search"
              aria-controls="search-results"
              aria-activedescendant="${activeId ?? nothing}"
              autocomplete="off"
            />
            <kbd class="esc-hint">Esc</kbd>
          </div>

          <ul id="search-results" class="results-list ${this.loading ? 'loading' : ''}" role="listbox" aria-label="Search results">
            ${this.query.length < 2 && this.results.length === 0 ? html`
              <li class="empty-state" role="presentation">Type at least 2 characters to search</li>
            ` : this.loading && this.results.length === 0 ? html`
              <li class="loading-state" role="presentation">Searching...</li>
            ` : !this.loading && this.results.length === 0 && this.query.length >= 2 ? html`
              <li class="empty-state" role="presentation">No results for "${this.query}"</li>
            ` : this.results.map((r, i) => html`
              <li
                id="search-result-${i}"
                class="result-item ${i === this._activeIndex ? 'active' : ''}"
                role="option"
                aria-selected="${i === this._activeIndex}"
                data-index="${i}"
                @click="${() => this._selectResult(r.url)}"
                @mouseenter="${() => { this._activeIndex = i; }}"
              >
                <div class="result-top">
                  <span class="result-title">${r.title}</span>
                  <span class="result-badge badge-${r.type}">${r.type}</span>
                </div>
                ${r.description ? html`
                  <span class="result-desc">${r.description}</span>
                ` : nothing}
              </li>
            `)}
          </ul>

          <div class="search-footer">
            <span class="footer-key"><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
            <span class="footer-key"><kbd>↵</kbd> select</span>
            <span class="footer-key"><kbd>esc</kbd> close</span>
          </div>

          <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
            ${this._announceText}
          </div>
        </div>
      </div>
    `;
  }
}

export default SearchModal;
