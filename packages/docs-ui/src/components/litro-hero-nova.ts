import { LitElement, html, css, svg } from 'lit';
import { customElement } from 'lit/decorators.js';

/**
 * THE RECIPE'S OWN MARK, drawn only when a project slots none of its own.
 *
 * Nine tapered shards thrown from a root that sits off the right edge of the
 * box, spread over about 150 degrees, so the host's crop cuts the root away
 * and a reader sees the spray rather than the point it came from. Every shard
 * ends on TWO corners rather than one flat cut; that ragged end is what keeps
 * the drawing from reading as a starburst. Four knots sit out beyond them.
 *
 * The `opacity` on each path is RELATIVE shading inside the drawing, not how
 * solid the mark is on the page — that is the hero's own
 * `--nova-mark-opacity`, applied to the whole box. Alternate shards are drawn
 * lighter, so the mass has depth instead of reading as one flat silhouette.
 *
 * COLOR COMES FROM THE TOKENS. Most of it is `currentColor`, which the rule
 * for `.ejecta` sets to `--nova-text`; two shards carry `--nova-accent`. A
 * project that changes its accent recolors the mark with it and touches
 * nothing here.
 */
const EJECTA = svg`
  <svg class="ejecta" viewBox="0 0 480 480" fill="none" aria-hidden="true">
    <path d="M 485.2 265.8 L 394.4 529.0 L 443.1 486.9 L 540.8 288.3 Z" fill="currentColor" opacity="0.95" />
    <path d="M 485.1 254.2 L 221.4 541.7 L 272.1 518.9 L 515.3 283.4 Z" fill="currentColor" opacity="0.6" />
    <path d="M 476.5 229.7 L 194.1 404.9 L 229.7 423.2 L 509.5 289.1 Z" fill="currentColor" opacity="0.95" />
    <path class="accent" d="M 483.9 224.8 L 67.6 325.1 L 141.2 333.5 L 493.9 271.8 Z" opacity="0.6" />
    <path d="M 491.7 203.0 L 124.0 180.3 L 157.2 216.3 L 484.8 268.6 Z" fill="currentColor" opacity="0.95" />
    <path d="M 498.6 206.9 L 228.1 102.0 L 275.5 142.3 L 483.8 241.9 Z" fill="currentColor" opacity="0.6" />
    <path class="accent" d="M 515.2 192.3 L 187.8 -54.9 L 211.9 1.2 L 478.7 237.4 Z" opacity="0.95" />
    <path d="M 527.9 193.9 L 360.4 -74.3 L 351.5 -44.5 L 488.1 216.9 Z" fill="currentColor" opacity="0.6" />
    <path d="M 550.0 194.4 L 481.4 -56.8 L 461.0 -6.5 L 489.4 207.3 Z" fill="currentColor" opacity="0.95" />
    <circle cx="74" cy="148" r="17" fill="currentColor" opacity="0.75" />
    <circle cx="36" cy="276" r="12" fill="currentColor" opacity="0.75" />
    <circle cx="118" cy="404" r="20" fill="currentColor" opacity="0.75" />
    <circle cx="196" cy="62" r="11" fill="currentColor" opacity="0.75" />
  </svg>
`;

/**
 * <litro-hero-nova>
 *   <svg slot="mark">…your logo…</svg>
 *   <section>
 *     <h1>Say what your product does, in one line.</h1>
 *   </section>
 * </litro-hero-nova>
 *
 * The hero: one screen-high pane on a deep, tinted ground, with the project's
 * mark cropped by the right edge and a soft wash of light behind it. Whatever
 * you slot in is laid over the top, and the page decides its own column — this
 * component only supplies the ground, the light, the mark and the height.
 *
 * THREE THINGS, AND NO FOURTH. Ground, wash, mark. An earlier version added a
 * star field over the ground; at the opacity that kept it from being noise it
 * was doing nothing, and at any higher one it made the ground look dusty
 * behind the type. It is gone, and the hero is better for it.
 *
 * THE MARK IS A CROP, NOT A BADGE. Its box is far wider than the space left
 * for it and it hangs off the right edge, so the host's `overflow: hidden`
 * cuts it. A reader sees part of a very large mark, the way a poster shows
 * part of a photograph — atmosphere, not a logo floating in the middle. Give
 * it your real mark at any size; the width below is what decides how much of
 * it shows.
 *
 * A DEFAULT MARK, AND YOURS REPLACES IT. With nothing in the `mark` slot the
 * slot draws its own fallback: the ejecta, below. Slot anything with
 * `slot="mark"` and the browser drops that fallback, so a project's own logo
 * is never laid over the recipe's. There is no attribute to set and no flag
 * to unset — a slotted mark wins by construction, in the server-rendered HTML
 * as much as in the browser. The wash is anchored where the mark comes in, so
 * the light has a reason to be there either way.
 *
 * NO IMAGE FILE. There is no `<img>` and no `url()` in this component, so the
 * hero costs no extra request and any project can retint it from the token
 * block alone.
 *
 * NOTHING MOVES. There is no animation, so there is no
 * `prefers-reduced-motion` rule to write — a reader who asks for less motion
 * already gets what everybody gets. Write one again if you add a moving part.
 *
 * COLORS AND HEIGHT come from the landing page's token block. This component
 * defines none of its own. Used outside that page, define the `--nova-*`
 * tokens it reads on any ancestor: `--nova-bg`, `--nova-border`,
 * `--nova-text`, `--nova-accent`, `--nova-accent-2`, and optionally
 * `--nova-hero-min` (how tall the pane is before its content makes it
 * taller), `--nova-mark-size`
 * and `--nova-mark-size-narrow` (how wide the mark is drawn, on a wide screen
 * and on a phone) and `--nova-mark-opacity` (how solid it is, which wants a
 * different value on a light ground than on a dark one).
 */
@customElement('litro-hero-nova')
export class LitroHeroNova extends LitElement {
  static override styles = css`
    /* A document stylesheet stops at this shadow boundary, so the box-sizing
       reset has to be repeated inside it. Without it a padded full-width box
       measures its width PLUS its gutters, and a phone scrolls sideways by
       exactly the gutter.
       See .agents/rules/adapters-ssr.md (SSR-008). */
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    :host {
      /* One composition, one screen. The content is centered in whatever
         height is left, so a short hero does not leave a dead band above the
         next section and a long one simply grows.

         svh, not vh: on a phone, vh is the height the viewport has with the
         browser's own chrome HIDDEN, so a 100vh hero is always taller than
         what a reader can actually see and the first scroll goes nowhere.
         The vh line above is the fallback for a browser with no svh. */
      display: grid;
      /* minmax(0, 1fr), not the implicit auto column. A grid item's
         automatic minimum size is its CONTENT's minimum, so an auto column
         grows to whatever the widest unbreakable thing inside the hero needs
         — a long command, a button — and on a phone the column ends up wider
         than the pane. The host clips rather than scrolls, so the symptom is
         a hero whose left gutter has walked off the screen. Zero as the
         minimum lets the column be as narrow as the pane. */
      grid-template-columns: minmax(0, 1fr);
      align-content: center;
      min-height: var(--nova-hero-min, calc(100vh - 3rem));
      min-height: var(--nova-hero-min, calc(100svh - 3rem));

      position: relative;
      isolation: isolate;
      /* This is what crops the mark. */
      overflow: hidden;
      background: var(--nova-bg);
      /* The pane ends on a rule, the way the status bar above it begins on
         one, so the hero reads as one pane and not as a page that ran out. */
      border-bottom: 1px solid var(--nova-border);
    }

    /* Every backdrop layer fills the host and is ignored by a pointer. */
    .layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 0;
    }

    /* ── The wash ──────────────────────────────────────────────────────
       One gradient, anchored where the mark comes in. It is an ellipse far
       wider than it is tall, with three far-apart, low-contrast stops that
       reach transparent well inside the box, so it never comes to a circle
       and never meets an edge. Wide, shallow and off-center is what keeps it
       a wash: rounder, or centered, and it closes into a halo around whatever
       is in front of it. */
    .wash {
      background-image: radial-gradient(
        ellipse 62% 78% at 84% 46%,
        color-mix(in srgb, var(--nova-accent) 15%, transparent) 0%,
        color-mix(in srgb, var(--nova-accent-2) 7%, transparent) 44%,
        transparent 76%
      );
    }

    /* ── The mark: the project's, or the recipe's ──────────────────────
       No background, no border and no size of its own: this box is exactly
       the drawing inside it, whether that is a slotted logo or the fallback
       ejecta. line-height: 0 keeps it from claiming a text line. */
    .mark {
      position: absolute;
      top: 50%;
      right: 0;
      transform: translate(26%, -50%);
      z-index: 1;
      line-height: 0;
      /* Low enough that the mark is ground rather than figure. A logo at a
         readable opacity here would be a second thing to look at, right where
         the eye leaves the headline.

         It is a token because a light ground shows far less of a faint shape
         than a dark one: the same value that is right on near-black is nearly
         invisible on off-white. */
      opacity: var(--nova-mark-opacity, 0.11);
      pointer-events: none;
    }

    /* HOW BIG THE MARK IS, and it is a token rather than an attribute so a
       site can set it in the same block it sets its colors in — the whole
       landing page is themed from one place, and the mark's size is part of
       that. A mark that holds this side of the pane wants to be far wider
       than the room left for it: most of the width below is off the edge. */
    ::slotted([slot='mark']),
    .ejecta {
      display: block;
      width: var(--nova-mark-size, clamp(17rem, 42vw, 36rem));
      height: auto;
    }

    /* The fallback is drawn IN the shadow root rather than slotted into it,
       so it takes its color by inheritance from here and not from the page.
       Naming the token keeps it right wherever the hero is used. */
    .ejecta {
      color: var(--nova-text);
    }

    /* Two of the nine shards take the accent. A project that sets its own
       accent recolors the mark with it and changes nothing else. */
    .ejecta .accent {
      fill: var(--nova-accent, currentColor);
    }

    /* A phone has no room beside the words, so the mark drops behind them,
       smaller and fainter, and stops competing with the headline. */
    @media (max-width: 52rem) {
      .mark {
        top: auto;
        bottom: 0;
        transform: translate(22%, 18%);
        opacity: calc(var(--nova-mark-opacity, 0.11) * 0.75);
      }

      ::slotted([slot='mark']),
      .ejecta {
        width: var(--nova-mark-size-narrow, clamp(13rem, 62vw, 22rem));
      }
    }

    /* ── Whatever the page puts in the hero ───────────────────────────── */
    .content {
      position: relative;
      z-index: 2;
    }
  `;

  override render() {
    return html`
      <div class="layer wash" aria-hidden="true"></div>
      <div class="mark" aria-hidden="true">
        <slot name="mark">${EJECTA}</slot>
      </div>
      <div class="content"><slot></slot></div>
    `;
  }
}

export default LitroHeroNova;
