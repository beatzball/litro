/**
 * The one definition of Litro's shadow-root box model.
 *
 * WHY THIS EXISTS
 *
 * A document stylesheet does not cross a shadow boundary. Every recipe ships
 * `*, *::before, *::after { box-sizing: border-box }` in its global stylesheet,
 * and none of it reaches a page component's shadow root. So `<main>`, sized
 * `width: 100%` with `padding: 4rem 1.5rem 3rem`, computed as `content-box`:
 * the width resolved to the whole viewport and the gutters were added on top.
 * A stock starlight site measured 438px on a 390px screen — on the home page
 * and on every blog page, in Lit and in FAST. Above ~900px `max-width: 56rem`
 * caps the element first, which is why no desktop ever showed it.
 *
 * A page host with no `display` is the same mistake one level up: it computes
 * as `inline`, so a block layout is being sized by an inline box.
 *
 * WHY IT IS A STRING
 *
 * Lit and FAST have different style objects and neither can consume the
 * other's. FAST's `ComposableStyles` accepts a plain string and Lit wraps one
 * with `unsafeCSS`, so the TEXT is the thing both adapters share. Keeping it
 * here means the rule — and the reason for it — is written down once.
 *
 * Elena is not in this file on purpose. It server-renders light DOM, so the
 * document stylesheet already reaches its content and repeating the reset
 * there would be dead CSS. See `.agents/rules/adapters-ssr.md` (SSR-008).
 */
export const pageResetCss = `
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  :host {
    display: block;
  }
`;
