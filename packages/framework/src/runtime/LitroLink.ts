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
 * 4. CLICK HANDLER ON THE HOST ELEMENT (not on the inner <a>)
 *    The click handler is attached to <litro-link> itself in connectedCallback,
 *    not via @click on the shadow <a>. This is critical for two reasons:
 *
 *    a) defer-hydration: @lit-labs/ssr adds defer-hydration to custom elements
 *       inside shadow DOM. This blocks Lit's update cycle, so a @click binding
 *       on the shadow <a> is never attached until the parent hydrates and removes
 *       defer-hydration. By registering on the host in connectedCallback (which
 *       runs before super.connectedCallback()'s defer-hydration check), the
 *       handler is active immediately — even for SSR'd elements on first load.
 *
 *    b) cross-shadow-DOM reliability: click events on slotted content propagate
 *       to the host element in all browsers. Relying on the shadow <a>'s @click
 *       requires correct composed-path event propagation through nested shadow
 *       roots, which can be inconsistent. The host listener is simpler and
 *       more reliable.
 *
 *    The shadow <a> is kept WITHOUT a @click binding — it exists purely for
 *    progressive enhancement (no-JS navigation) and semantics (cursor, a11y).
 *
 * 5. litro-router IS CLIENT-ONLY
 *    This module must NEVER be imported in server-side code paths. LitroRouter
 *    accesses window, history, and document at runtime and will crash Node.js.
 */

import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
// litro-router is dynamically imported inside _clickHandler() so it is never
// evaluated in Node.js (window does not exist server-side).

@customElement('litro-link')
export class LitroLink extends LitElement {
  /**
   * Declare reactive properties via static class field rather than @property()
   * decorators. esbuild 0.21+ (Vite 5) uses the TC39 Stage 3 decorator
   * transform. In that mode @property() on a plain field is silently dropped
   * (only `accessor` fields are supported), and @property() accessor crashes
   * at instantiation with "Cannot read properties of undefined (reading 'has')"
   * because Lit's init function fires before elementProperties is populated.
   *
   * static override properties is read by Lit in finalize(), which is called
   * from the observedAttributes getter when customElements.define() runs in
   * the browser — before any instances are created — so attributeChangedCallback
   * correctly fires for href/target/rel during element upgrade.
   */
  static override properties = {
    href: { type: String },
    target: { type: String },
    rel: { type: String },
  };

  href = '';
  target = '';
  rel = '';

  /**
   * Bound click handler stored as a field so the same function reference can
   * be used in both addEventListener and removeEventListener.
   *
   * Arrow function captures `this` (the LitroLink instance) so property
   * access (this.href, this.target, etc.) works correctly regardless of how
   * the browser invokes the listener.
   */
  private _clickHandler = (e: MouseEvent): void => {
    // Do not intercept if:
    //   - target is set (user wants a specific frame/tab)
    //   - modifier keys are held (user wants a new tab / OS-level action)
    //   - href is not a same-origin path (external URL)
    if (this.target) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!this.href.startsWith('/')) return;

    // preventDefault() must be called synchronously before the async import.
    e.preventDefault();
    // litro-router is loaded lazily — safe because _clickHandler only fires
    // in the browser where window exists.
    void import('@beatzball/litro-router').then(({ LitroRouter }) => LitroRouter.go(this.href));
  };

  /**
   * Attach the click listener to the host element using CAPTURE phase.
   *
   * WHY CAPTURE (not bubble):
   *   For slotted content, the composed event path in bubble phase is:
   *     text-node → <slot> → <a> → shadow-root → <litro-link>
   *   Browsers commit the <a> default navigation when the event reaches <a>
   *   in the bubble phase — before it ever reaches <litro-link>. A bubble
   *   listener on the host is therefore always too late to call preventDefault.
   *
   *   In capture phase, the traversal goes DOWN from the root:
   *     window → … → <litro-link> → shadow-root → <a> → <slot> → text-node
   *   Our listener fires at <litro-link> BEFORE the event enters the shadow
   *   DOM, so preventDefault() is guaranteed to block the <a> navigation.
   *
   * WHY connectedCallback (before super):
   *   @lit-labs/ssr-client patches LitElement.prototype.connectedCallback to
   *   skip Lit's update cycle when defer-hydration is present. Registering the
   *   listener here (in LitroLink's own override, before super) ensures it is
   *   active immediately — even for SSR'd elements on first load.
   */
  override connectedCallback(): void {
    this.addEventListener('click', this._clickHandler, true);
    super.connectedCallback();
  }

  override disconnectedCallback(): void {
    this.removeEventListener('click', this._clickHandler, true);
    super.disconnectedCallback();
  }

  override render() {
    // No @click here — interception is handled by the host listener above.
    // The <a> element exists for progressive enhancement (no-JS navigation)
    // and correct semantics/accessibility (pointer cursor, keyboard focus).
    return html`<a
      href=${this.href}
      target=${this.target}
      rel=${this.rel}
    ><slot></slot></a>`;
  }
}
