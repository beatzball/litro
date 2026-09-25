import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { pageReset } from '@beatzball/litro/runtime/page-reset.js';

/** The five states a badge can show, in order of how much they want you. */
export type BadgeState = 'error' | 'blocked' | 'working' | 'done' | 'idle';

/** One piece of text per state. Replace it with your own set. */
export type GlyphSet = Record<BadgeState, string>;

/**
 * The glyph set the badge uses when a page sets none.
 *
 * Plain ASCII on purpose: it renders in any font, on any terminal and on any
 * machine, with no web font to download and nothing to fall back to. Swap in
 * emoji, Nerd Font icons or single letters by setting the `glyphs` property.
 */
export const DEFAULT_GLYPHS: GlyphSet = {
  error: '[x]',
  blocked: '[!]',
  working: '[~]',
  done: '[+]',
  idle: '[.]',
};

/**
 * <litro-state-badge state="done"></litro-state-badge>
 * <litro-state-badge state="done" from="working" delay="1.6" label="done">
 * </litro-state-badge>
 *
 * One state, drawn as a glyph and a color.
 *
 * THE GLYPH SET IS A PROPERTY. `glyphs` takes one string per state, so a
 * project uses its own text without editing this file. Leave it unset and
 * `DEFAULT_GLYPHS` above applies.
 *
 * THE SETTLE ANIMATION IS CSS ONLY. Set `from` to the state the badge starts
 * in and `delay` to how many seconds it waits, and the badge fades from one
 * glyph to the other on its own. No script runs, so it works with JavaScript
 * turned off, and `prefers-reduced-motion` stops it: a reader who asks for
 * less motion sees the settled state from the first frame, never the first
 * one. Leave `from` unset and the badge simply shows `state`.
 *
 * Both glyphs sit in one grid cell, so the swap never moves the text beside
 * it.
 *
 * COLORS come from the landing page's token block. This component defines
 * none of its own. Used outside that page, define the `--nova-*` tokens it
 * reads on any ancestor: `--nova-error`, `--nova-blocked`, `--nova-working`,
 * `--nova-done`, `--nova-idle`, `--nova-font-mono`.
 */
@customElement('litro-state-badge')
export class LitroStateBadge extends LitElement {
  static override properties = {
    state: { type: String },
    from: { type: String },
    delay: { type: Number },
    label: { type: String },
    glyphs: { type: Object },
  };

  static override styles = [
    pageReset,
    css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-family: var(--nova-font-mono);
      white-space: nowrap;
    }

    /* Both glyphs occupy the same grid cell, so a crossfade never changes the
       badge's width and nothing beside it shifts. */
    .glyph {
      display: inline-grid;
      font-weight: 700;
    }

    .glyph > span {
      grid-area: 1 / 1;
    }

    /* One class per state, and each one reads a token. A component that
       hard-coded these would stop following the page's theme. */
    .error {
      color: var(--nova-error);
    }
    .blocked {
      color: var(--nova-blocked);
    }
    .working {
      color: var(--nova-working);
    }
    .done {
      color: var(--nova-done);
    }
    .idle {
      color: var(--nova-idle);
    }

    /* The settle. The animation-fill-mode both holds the first frame until
       the delay is up, so the badge shows the starting glyph from the moment
       the HTML arrives. */
    .from {
      animation: badge-out 0.2s ease-in var(--at, 0s) both;
    }

    .to {
      animation: badge-in 0.25s ease-out var(--at, 0s) both;
    }

    @keyframes badge-out {
      from {
        opacity: 1;
      }
      to {
        opacity: 0;
      }
    }

    @keyframes badge-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    /* Less motion: the badge is already settled. The starting glyph is taken
       out of the layout rather than left at zero opacity, so a reader using
       Find in page does not match text nobody can see. */
    @media (prefers-reduced-motion: reduce) {
      .from {
        display: none;
      }
      .to {
        animation: none;
      }
    }
  `,
  ];

  /** The state the badge ends on. */
  state: BadgeState = 'idle';

  /** The state it starts in, if it should settle. Unset means no animation. */
  from: BadgeState | '' = '';

  /** How many seconds the badge waits before it settles. */
  delay = 0;

  /** Optional text beside the glyph, usually the state's own name. */
  label = '';

  /** One string per state. Unset means `DEFAULT_GLYPHS`. */
  glyphs: GlyphSet = DEFAULT_GLYPHS;

  override render() {
    const glyphs = this.glyphs ?? DEFAULT_GLYPHS;
    const settles = this.from !== '' && this.from !== this.state;

    return html`
      <span class="glyph" style="--at: ${this.delay}s">
        ${settles
          ? html`<span class="from ${this.from}">${glyphs[this.from as BadgeState]}</span
              ><span class="to ${this.state}">${glyphs[this.state]}</span>`
          : html`<span class="${this.state}">${glyphs[this.state]}</span>`}
      </span>
      ${this.label
        ? html`<span class="label ${this.state}">${this.label}</span>`
        : ''}
    `;
  }
}

export default LitroStateBadge;
