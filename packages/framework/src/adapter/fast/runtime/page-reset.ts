/**
 * `pageReset` — the shadow-root box model, as a FAST stylesheet.
 *
 * The rule itself, and why it exists, is in
 * `packages/framework/src/runtime/page-reset-css.ts`. This file only wraps
 * that text in the style object FAST understands. It deliberately imports no
 * Lit: the two adapters share the TEXT, never each other's style objects.
 *
 * `LitroPage.define()` injects this into every page it defines, so a FAST page
 * gets it for free. Import it directly for a component that does not extend
 * `LitroPage`, and put it first in the array so the component's own rules win:
 *
 *     MyComponent.define({ name: 'my-el', template, styles: [pageReset, styles] });
 */
import { css, type ElementStyles } from '@microsoft/fast-element';
import { pageResetCss } from '../../../runtime/page-reset-css.js';

export const pageReset: ElementStyles = css`
  ${pageResetCss}
`;
