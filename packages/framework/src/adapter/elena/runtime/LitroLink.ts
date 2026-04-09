/**
 * LitroLink (Elena) — <litro-link>
 *
 * Elena implementation of the SPA navigation link. Mirrors the Lit/FAST
 * version's behavior:
 *
 * 1. Light DOM with an inner <a> for progressive enhancement
 * 2. Capture-phase click handler on the host element
 * 3. Intercepts same-origin, modifier-free left clicks on internal paths
 * 4. Dynamic import of litro-router (client-only)
 *
 * Elena uses static props for reactive attributes and render() for the
 * inner <a> element. Since Elena renders to light DOM, the <a> is directly
 * in the document tree — no shadow root.
 */

import { Elena, html } from '@elenajs/core';

export class LitroLink extends Elena(HTMLElement) {
  static tagName = 'litro-link';
  static props = ['href', 'target', 'rel'];

  href = '';
  target = '';
  rel = '';

  private _clickHandler = (e: MouseEvent): void => {
    if (this.target) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!this.href.startsWith('/')) return;

    e.preventDefault();
    void import('@beatzball/litro-router').then(({ LitroRouter }) =>
      LitroRouter.go(this.href),
    );
  };

  override connectedCallback(): void {
    // Register capture-phase click handler BEFORE super.connectedCallback()
    // so it is active immediately on SSR'd elements (before Elena's
    // hydration logic runs).
    this.addEventListener('click', this._clickHandler, true);

    if (typeof super.connectedCallback === 'function') {
      super.connectedCallback();
    }
  }

  override disconnectedCallback(): void {
    this.removeEventListener('click', this._clickHandler, true);
    if (typeof super.disconnectedCallback === 'function') {
      super.disconnectedCallback();
    }
  }

  render() {
    // Elena is light DOM — <slot> has no meaning without shadow DOM.
    // Use this.text (Elena's built-in property that captures the element's
    // text content before hydration) to render the link text.
    return html`<a
      href="${this.href}"
      target="${this.target}"
      rel="${this.rel}"
    >${this.text}</a>`;
  }
}

LitroLink.define();
