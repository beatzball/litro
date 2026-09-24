import { css } from 'lit';

/**
 * The status line's dark palette, in ONE place.
 *
 * WHY THIS FILE EXISTS
 *
 * `litro-status-line` is chrome, not content. It stays the same dark object on
 * every page of the site and in both themes, because that is what makes a
 * reader recognize it as one thing rather than a strip that changes with the
 * document. The docs pages define no `--nova-*` tokens at all, so the set the
 * line reads has to be given to it ON the element.
 *
 * Three pages had to do that, and each had typed the set out by hand: the
 * static home page, its server-rendered twin, and `starlight-page`, which is
 * every docs page's shell. They then drifted — the home page mixed the accent
 * 62% toward black and `starlight-page` 72%, so clicking from the home page
 * into the docs changed the color of the mode segment. Exactly the thing the
 * comment above each block said must not happen.
 *
 * So it is written once, here, and the three import it. The 62% is the value
 * the page's design was reviewed against, and it is the one kept.
 *
 * THE FOURTH COPY is `--brand-*` in each site's public/styles/starlight.css,
 * which is a plain stylesheet and cannot import a module. The landing page's
 * own token block reads those, so the two sets have to agree. They are pinned
 * against each other by `src/__tests__/status-line-chrome.test.ts`.
 *
 * ADD NOTHING PAGE-SPECIFIC HERE. A page that also needs, say, a gutter or a
 * font stack on the line adds its own `litro-status-line` rule after this one;
 * see `starlight-page.ts`.
 */
export const statusLineChrome = css`
  litro-status-line {
    --nova-bg: #0d0e1a;
    --nova-surface: #171a2b;
    --nova-border: #2a2e45;
    --nova-text: #e9ecfa;
    --nova-text-dim: #9aa1bd;
    /* The mode segment puts WHITE text on this color, and the site accent is
       picked to sit on a page background rather than under white text — at
       0.75rem it needs 4.5:1 and most accents give about 3.5:1. Mixing it most
       of the way toward black keeps the site's hue and clears the ratio for
       any accent a project is likely to choose.

       It is fixed rather than theme-dependent because the line is fixed dark
       chrome: it does not change with the document, so neither can the color
       underneath its text.

       The fallback is for a page that loads without the site stylesheet. */
    --nova-accent: color-mix(in srgb, var(--sl-color-accent, #7c3aed) 62%, #000);
    --nova-error: #f87171;
    --nova-blocked: #fbbf24;
    --nova-working: #38bdf8;
    --nova-done: #4ade80;
    --nova-idle: #64748b;
  }
`;

export default statusLineChrome;
