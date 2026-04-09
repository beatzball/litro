/**
 * LitroLink (FAST) — <litro-link>
 *
 * FAST Element implementation of the SPA navigation link. Mirrors the Lit
 * version's behavior:
 *
 * 1. Shadow DOM with an inner <a> for progressive enhancement
 * 2. Capture-phase click handler on the host element
 * 3. Intercepts same-origin, modifier-free left clicks on internal paths
 * 4. Dynamic import of litro-router (client-only)
 *
 * FAST uses `@attr` for string attributes and `html` tagged templates with
 * arrow function bindings.
 */

import { FASTElement, attr, html, css } from '@microsoft/fast-element';

const template = html<LitroLink>`<a
  href="${x => x.href}"
  target="${x => x.target}"
  rel="${x => x.rel}"
><slot></slot></a>`;

const styles = css`
  :host {
    display: inline;
    cursor: pointer;
  }
  a {
    color: inherit;
    text-decoration: inherit;
    font: inherit;
    cursor: inherit;
  }
`;

export class LitroLink extends FASTElement {
  @attr href: string = '';
  @attr target: string = '';
  @attr rel: string = '';

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
    this.addEventListener('click', this._clickHandler, true);
    super.connectedCallback();
  }

  override disconnectedCallback(): void {
    this.removeEventListener('click', this._clickHandler, true);
    super.disconnectedCallback();
  }
}

LitroLink.define({
  name: 'litro-link',
  template,
  styles,
});
