import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

/**
 * <litro-hero-nova>
 *   <svg slot="mark">…your logo…</svg>
 *   <h1>Say what your product does, in one line.</h1>
 * </litro-hero-nova>
 *
 * The hero backdrop: a star going off, over a star field. Whatever you slot in
 * sits on top of it.
 *
 * ALL OF IT IS CSS. There is no image file, no `<img>` and no `url()`, so the
 * hero costs no extra request and any project can retint it by changing the
 * accent tokens. Four stacked layers make the star: a wide falloff into the
 * dark, a shockwave ring spreading outward, a hot inner glow, and a small
 * bright core. The star field behind them is one element with a handful of
 * tiny radial gradients in its background.
 *
 * THE PULSE IS OPTIONAL. Only the shockwave moves, and `prefers-reduced-motion`
 * stops it. Nothing else on the component animates, so a reader who asks for
 * less motion still sees the whole picture, held still.
 *
 * THE `mark` SLOT is where a project puts its own logo. It is drawn faded and
 * centered, behind the content and in front of the star. Leave it empty and
 * the star still works.
 *
 * COLORS come from the landing page's token block. This component defines
 * none of its own. Used outside that page, define the `--nova-*` tokens it
 * reads on any ancestor: `--nova-bg`, `--nova-accent`, `--nova-accent-2`,
 * `--nova-text-dim`.
 */
@customElement('litro-hero-nova')
export class LitroHeroNova extends LitElement {
  static override styles = css`
    :host {
      display: block;
      position: relative;
      isolation: isolate;
      overflow: hidden;
      background: var(--nova-bg);
    }

    /* Every backdrop layer fills the host and is ignored by a pointer. */
    .layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 0;
    }

    /* ── The star field ────────────────────────────────────────────────
       Each gradient is one star. A few of them take an accent color so
       the field is not flatly white. */
    .field {
      background-image:
        radial-gradient(1.5px 1.5px at 12% 18%, var(--nova-text-dim), transparent 100%),
        radial-gradient(1px 1px at 28% 62%, var(--nova-text-dim), transparent 100%),
        radial-gradient(1.5px 1.5px at 41% 12%, var(--nova-accent-2), transparent 100%),
        radial-gradient(1px 1px at 55% 78%, var(--nova-text-dim), transparent 100%),
        radial-gradient(1.5px 1.5px at 67% 31%, var(--nova-text-dim), transparent 100%),
        radial-gradient(1px 1px at 74% 88%, var(--nova-accent), transparent 100%),
        radial-gradient(1.5px 1.5px at 83% 54%, var(--nova-text-dim), transparent 100%),
        radial-gradient(1px 1px at 91% 22%, var(--nova-text-dim), transparent 100%),
        radial-gradient(1px 1px at 19% 87%, var(--nova-accent-2), transparent 100%),
        radial-gradient(1.5px 1.5px at 47% 44%, var(--nova-text-dim), transparent 100%);
      opacity: 0.55;
    }

    /* ── Light falling off into the dark ──────────────────────────────── */
    .falloff {
      background-image: radial-gradient(
        circle at 50% 42%,
        color-mix(in srgb, var(--nova-accent) 28%, transparent) 0%,
        color-mix(in srgb, var(--nova-accent) 8%, transparent) 34%,
        transparent 68%
      );
    }

    /* ── The shockwave ring ───────────────────────────────────────────── */
    .shock {
      background-image: radial-gradient(
        circle at 50% 42%,
        transparent 0%,
        transparent 20%,
        color-mix(in srgb, var(--nova-accent-2) 45%, transparent) 23%,
        transparent 27%,
        transparent 100%
      );
      animation: nova-pulse 6s ease-out infinite;
      transform-origin: 50% 42%;
    }

    /* ── The hot inner glow ───────────────────────────────────────────── */
    .glow {
      background-image: radial-gradient(
        circle at 50% 42%,
        color-mix(in srgb, var(--nova-accent-2) 70%, transparent) 0%,
        color-mix(in srgb, var(--nova-accent) 45%, transparent) 5%,
        transparent 16%
      );
    }

    /* ── The core ─────────────────────────────────────────────────────── */
    .core {
      background-image: radial-gradient(
        circle at 50% 42%,
        color-mix(in srgb, var(--nova-accent-2) 95%, transparent) 0%,
        color-mix(in srgb, var(--nova-accent-2) 35%, transparent) 2%,
        transparent 5%
      );
    }

    @keyframes nova-pulse {
      0% {
        transform: scale(0.82);
        opacity: 0.15;
      }
      35% {
        opacity: 0.85;
      }
      100% {
        transform: scale(1.5);
        opacity: 0;
      }
    }

    /* A reader who asks for less motion gets the ring standing still. */
    @media (prefers-reduced-motion: reduce) {
      .shock {
        animation: none;
        opacity: 0.6;
      }
    }

    /* ── The project's own mark ───────────────────────────────────────── */
    .mark {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      pointer-events: none;
      opacity: 0.12;
      z-index: 1;
    }

    ::slotted([slot='mark']) {
      width: clamp(8rem, 26vw, 18rem);
      height: auto;
    }

    /* ── Whatever the page puts in the hero ───────────────────────────── */
    .content {
      position: relative;
      z-index: 2;
    }
  `;

  override render() {
    return html`
      <div class="layer field" aria-hidden="true"></div>
      <div class="layer falloff" aria-hidden="true"></div>
      <div class="layer shock" aria-hidden="true"></div>
      <div class="layer glow" aria-hidden="true"></div>
      <div class="layer core" aria-hidden="true"></div>
      <div class="mark" aria-hidden="true"><slot name="mark"></slot></div>
      <div class="content"><slot></slot></div>
    `;
  }
}

export default LitroHeroNova;
