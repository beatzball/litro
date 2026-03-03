/**
 * LitroLink — <litro-link>
 *
 * A progressive-enhancement wrapper around a standard `<a>` element that
 * intercepts clicks for client-side navigation via LitroRouter.
 *
 * Design decisions:
 *
 * 1. WRAPS <a> — graceful degradation
 *    The inner <a href="..."> is always present in the rendered HTML. If
 *    JavaScript is disabled or the component fails to upgrade, the browser
 *    follows the href as a normal full-page navigation. This is the
 *    correct progressive enhancement approach for links.
 *
 * 2. SHADOW DOM (default)
 *    Unlike LitroOutlet, LitroLink keeps the default shadow DOM. The <a>
 *    element is internal implementation detail; consumers style it via
 *    CSS custom properties or ::slotted() if needed.
 *
 * 3. INTERCEPT ONLY SAME-ORIGIN, LEFT-CLICK, NO MODIFIER
 *    Modifier keys (Cmd/Ctrl, Shift, Alt) signal the user wants a new tab,
 *    window, or browser-specific behavior. We honour those and fall through
 *    to the default browser handling. Only internal paths (starting with '/')
 *    are intercepted; external URLs are left to the browser.
 *
 * 4. event.composedPath() FOR SHADOW DOM TRAVERSAL
 *    When a click originates inside a shadow root, event.target is the shadow
 *    host rather than the actual clicked element. composedPath() returns the
 *    full path from the event target through all shadow boundaries, so we can
 *    still identify the inner <a> and extract its href.
 *
 * 5. litro-router IS CLIENT-ONLY
 *    This module must NEVER be imported in server-side code paths. LitroRouter
 *    accesses window, history, and document at runtime and will crash Node.js.
 */

import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
// litro-router is dynamically imported inside handleClick() so it is never
// evaluated in Node.js (window does not exist server-side).

@customElement('litro-link')
export class LitroLink extends LitElement {
  /** The destination path. Should be an absolute path starting with '/'. */
  @property() href = '';

  /**
   * The anchor target attribute (_blank, _self, etc.).
   * If set, the click is NOT intercepted — the browser handles it natively.
   */
  @property() target = '';

  /**
   * The anchor rel attribute. Passed through to the inner <a> element.
   * Useful for 'noopener noreferrer' when target='_blank'.
   */
  @property() rel = '';

  private handleClick(e: MouseEvent): void {
    // Do not intercept if:
    //   - target is set (user wants a specific frame/tab)
    //   - modifier keys are held (user wants a new tab / OS-level action)
    //   - href is not a same-origin path (external URL)
    if (this.target) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!this.href.startsWith('/')) return;

    // preventDefault() must be called synchronously before the async import.
    e.preventDefault();
    // litro-router is loaded lazily — safe because handleClick() only fires
    // in the browser where window exists.
    void import('./litro-router.js').then(({ LitroRouter }) => LitroRouter.go(this.href));
  }

  override render() {
    return html`<a
      href=${this.href}
      target=${this.target}
      rel=${this.rel}
      @click=${this.handleClick}
    ><slot></slot></a>`;
  }
}
