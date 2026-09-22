import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

/**
 * <litro-hero-nova>
 *   <svg slot="mark">…your logo…</svg>
 *   <h1>Say what your product does, in one line.</h1>
 * </litro-hero-nova>
 *
 * The hero backdrop: a dark ground, a sparse star field, and one soft wash of
 * light. Whatever you slot in sits on top of it.
 *
 * THE MARK IS THE ONLY THING TO LOOK AT. Everything behind it is dim and has
 * no edge: the wash fades out long before it reaches a border, so there is
 * nothing for the eye to catch on. An earlier version of this component drew
 * a shockwave ring and a bright core around the same point, which put the
 * project's logo in the middle of a target and pulled attention off both the
 * logo and the words. It is gone. If you want a brighter hero, raise the
 * accent tokens rather than adding a shape.
 *
 * ALL OF IT IS CSS. There is no image file, no `<img>` and no `url()`, so the
 * hero costs no extra request and any project can retint it by changing the
 * accent tokens. Two layers make it: a star field of tiny radial gradients,
 * and one wide, low ellipse of accent light near the top.
 *
 * NOTHING MOVES. There is no animation, so there is no
 * `prefers-reduced-motion` rule to write — a reader who asks for less motion
 * already gets what everybody gets. Add one again if you ever add a moving
 * part.
 *
 * THE `mark` SLOT is where a project puts its own logo. It is drawn faded and
 * centered, behind the content. Leave it empty and the wash and the stars
 * still work.
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
       Each gradient is one star. They are small, sparse and dim on purpose:
       a star field is texture, and texture that can be counted is no longer
       texture. Two of them take an accent color so the field is not flatly
       white. */
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
      opacity: 0.4;
    }

    /* ── The wash ──────────────────────────────────────────────────────
       One gradient, and the shape of it is the whole point. It is an ellipse
       far wider than it is tall, so it never comes to a circle inside the
       frame, and its three stops are far apart and low in contrast, so there
       is no ring and no bright center — only the ground getting a little
       warmer where the mark sits. The last stop reaches transparent well
       inside the box, so the wash never meets an edge either.

       Wide and shallow is what keeps it a wash. A rounder ellipse, or a stop
       that jumps, and the light closes into a halo around the mark — which is
       the thing this component used to do wrong. */
    .wash {
      background-image: radial-gradient(
        ellipse 78% 46% at 50% 26%,
        color-mix(in srgb, var(--nova-accent) 17%, transparent) 0%,
        color-mix(in srgb, var(--nova-accent-2) 7%, transparent) 48%,
        transparent 80%
      );
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
      <div class="layer wash" aria-hidden="true"></div>
      <div class="mark" aria-hidden="true"><slot name="mark"></slot></div>
      <div class="content"><slot></slot></div>
    `;
  }
}

export default LitroHeroNova;
