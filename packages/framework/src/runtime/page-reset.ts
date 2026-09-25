/**
 * `pageReset` — the shadow-root box model, as a Lit stylesheet.
 *
 * `LitroPage` already carries this, so a page that extends it inherits the
 * reset and needs no styles of its own. Import it directly when you cannot
 * extend `LitroPage`: a shared component that extends `LitElement`, or a page
 * that declares `static override styles` and must COMPOSE rather than replace.
 *
 *     static override styles = [pageReset, css`...`];
 *
 * A subclass's `static styles` replaces the parent's, so a page that declares
 * its own without composing silently loses the reset. See
 * `.agents/rules/adapters-ssr.md` (SSR-008).
 *
 * The rule itself, and why it exists, lives in `page-reset-css.ts`.
 */
import { css, unsafeCSS, type CSSResult } from 'lit';
import { pageResetCss } from './page-reset-css.js';

export const pageReset: CSSResult = css`
  ${unsafeCSS(pageResetCss)}
`;
