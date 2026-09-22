import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

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
 * AN EMPTY HERO IS A FINISHED HERO. Nothing is painted behind the `mark` slot,
 * so a page that slots no mark gets no ghost shape, no circle and no smudge —
 * just the ground and the wash, which still read as composed. The wash sits
 * where the mark would come in, so the light has a reason to be there either
 * way.
 *
 * ALL OF IT IS CSS. There is no image file, no `<img>` and no `url()` in this
 * component, so the hero costs no extra request and any project can retint it
 * from the token block alone.
 *
 * NOTHING MOVES. There is no animation, so there is no
 * `prefers-reduced-motion` rule to write — a reader who asks for less motion
 * already gets what everybody gets. Write one again if you add a moving part.
 *
 * COLORS AND HEIGHT come from the landing page's token block. This component
 * defines none of its own. Used outside that page, define the `--nova-*`
 * tokens it reads on any ancestor: `--nova-bg`, `--nova-border`,
 * `--nova-accent`, `--nova-accent-2`, and optionally
 * `--nova-hero-min`, which is how tall the pane is before its content makes it
 * taller.
 */
@customElement('litro-hero-nova')
export class LitroHeroNova extends LitElement {
  static override styles = css`
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

    /* ── The project's own mark ────────────────────────────────────────
       No background, no border, no size of its own: this box is exactly its
       slotted content, so with nothing slotted there is nothing here at all.
       line-height: 0 keeps an empty box from claiming a text line. */
    .mark {
      position: absolute;
      top: 50%;
      right: 0;
      transform: translate(26%, -50%);
      z-index: 1;
      line-height: 0;
      /* Low enough that the mark is ground rather than figure. A logo at a
         readable opacity here would be a second thing to look at, right where
         the eye leaves the headline. */
      opacity: 0.11;
      pointer-events: none;
    }

    ::slotted([slot='mark']) {
      display: block;
      width: clamp(17rem, 42vw, 36rem);
      height: auto;
    }

    /* A phone has no room beside the words, so the mark drops behind them,
       smaller and fainter, and stops competing with the headline. */
    @media (max-width: 52rem) {
      .mark {
        top: auto;
        bottom: 0;
        transform: translate(22%, 18%);
        opacity: 0.08;
      }

      ::slotted([slot='mark']) {
        width: clamp(13rem, 62vw, 22rem);
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
      <div class="mark" aria-hidden="true"><slot name="mark"></slot></div>
      <div class="content"><slot></slot></div>
    `;
  }
}

export default LitroHeroNova;
