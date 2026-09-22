import { LitElement, html, css, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';

/** One encoding of the recording. Give the browser the formats you have. */
export interface HeroVideoSource {
  /** The URL of the file. */
  src: string;
  /** Its MIME type, such as `video/webm`. */
  type?: string;
}

/**
 * <litro-hero-video
 *   poster="/demo/poster.jpg"
 *   label="What the tool does, in 15 seconds"
 * >
 *   <span slot="caption">A short caption.</span>
 * </litro-hero-video>
 *
 * A short recording of the product, with a poster, one play/pause button and a
 * caption. The `sources` list is a property rather than an attribute, so set
 * it from the page:
 *
 *     <litro-hero-video
 *       poster="/demo/poster.jpg"
 *       label="What the tool does, in 15 seconds"
 *       .sources="${[{ src: '/demo/clip.webm', type: 'video/webm' }]}"
 *     ></litro-hero-video>
 *
 * IT DOWNLOADS NOTHING UNTIL IT IS ASKED TO. `preload="none"` and no autostart
 * attribute, so a reader who never presses play pays for no video at all. A
 * hero clip is the heaviest thing on a landing page, and most readers scroll
 * past it.
 *
 * PLAYBACK IS STARTED BY SCRIPT, AND ONLY WHEN MOTION IS WELCOME. On first
 * paint the component asks `prefers-reduced-motion`. When motion is allowed it
 * starts the clip, muted and looping, the way a silent product recording is
 * expected to behave. When less motion is asked for it stays on the poster,
 * and pressing the button still plays it — a direct request is not motion the
 * page decided to make.
 *
 * THE BUTTON SAYS WHICH ACTION IT PERFORMS, not which state the video is in:
 * "Play" while it is paused, "Pause" while it is running. It follows the video
 * rather than leading it, so a clip paused by the browser, by a keystroke on
 * the native controls or by a script still leaves the right word on screen.
 *
 * WITH JAVASCRIPT OFF the poster is all there is, and the button is hidden
 * because it could do nothing. With no `sources` the same is true: the poster
 * shows and there is no button. Rendering without sources is not an error —
 * it is how the page looks before you have recorded anything.
 *
 * COLORS come from the landing page's token block. This component defines
 * none of its own. Used outside that page, define the `--nova-*` tokens it
 * reads on any ancestor: `--nova-surface`, `--nova-border`, `--nova-text`,
 * `--nova-text-dim`, `--nova-accent`, `--nova-radius`.
 */
@customElement('litro-hero-video')
export class LitroHeroVideo extends LitElement {
  static override properties = {
    poster: { type: String },
    label: { type: String },
    sources: { attribute: false },
    _playing: { state: true },
  };

  static override styles = css`
    :host {
      display: block;
    }

    figure {
      margin: 0;
    }

    .frame {
      position: relative;
      overflow: hidden;
      border: 1px solid var(--nova-border);
      border-radius: var(--nova-radius);
      background: var(--nova-surface);
      /* The poster decides the height before the video has any metadata, so
         the page does not jump when playback starts. */
      aspect-ratio: 16 / 9;
    }

    video {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      background: var(--nova-surface);
    }

    .controls {
      position: absolute;
      inset: auto auto 0.75rem 0.75rem;
    }

    .toggle {
      padding: 0.4rem 0.9rem;
      border: 1px solid var(--nova-border);
      border-radius: var(--nova-radius);
      background: var(--nova-surface);
      color: var(--nova-text);
      font: inherit;
      font-size: 0.85rem;
      cursor: pointer;
    }

    .toggle:hover {
      border-color: var(--nova-accent);
    }

    .toggle:focus-visible {
      outline: 2px solid var(--nova-accent);
      outline-offset: 2px;
    }

    /* The button needs JavaScript to do anything, so it is not offered
       without it. The poster stays, and that is the whole picture. */
    @media (scripting: none) {
      .controls {
        display: none;
      }
    }

    figcaption {
      margin-top: 0.75rem;
      color: var(--nova-text-dim);
      font-size: 0.9rem;
    }
  `;

  /** The image shown before the clip runs. */
  poster = '';

  /**
   * A sentence describing the recording for a reader who cannot see it. It
   * becomes the video's accessible name, so write what happens in the clip,
   * not "product video".
   */
  label = '';

  /** The encodings of the clip. With none, only the poster is shown. */
  sources: HeroVideoSource[] = [];

  /** Whether the clip is running. Kept in step with the video itself. */
  _playing = false;

  /** The video, once it has been rendered. */
  private get _video(): HTMLVideoElement | null {
    return this.renderRoot?.querySelector('video') ?? null;
  }

  /**
   * Whether the reader welcomes motion.
   *
   * Guarded because there is no `matchMedia` on the server, and returning
   * true there would be the wrong default anyway: the server never plays
   * anything.
   */
  private _motionAllowed(): boolean {
    const query = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return false;
    return !query.matches;
  }

  /**
   * Start the clip, muted and looping.
   *
   * Returns whether playback was requested, so a test can prove the reduced
   * motion rule without a real video decoder behind it.
   */
  async play(): Promise<boolean> {
    const video = this._video;
    if (!video || this.sources.length === 0) return false;
    video.muted = true;
    try {
      await video.play();
    } catch {
      // A browser may still refuse: no decoder for the format, a missing
      // file, or a policy this page cannot see. The poster stays and the
      // button says "Play", which is the truth.
      return false;
    }
    return true;
  }

  /** Stop the clip and leave it where it is. */
  pause(): void {
    this._video?.pause();
  }

  /** The button's one job: whichever of the two the video is not doing. */
  toggle(): void {
    if (this._playing) {
      this.pause();
    } else {
      void this.play();
    }
  }

  private _onToggle(): void {
    this.toggle();
  }

  /** Follow the video, so the button's word is right however it changed. */
  private _onPlay(): void {
    this._playing = true;
  }

  private _onPause(): void {
    this._playing = false;
  }

  override firstUpdated(): void {
    // Nothing starts by itself unless the reader welcomes motion. A press of
    // the button is a different matter and is always honored.
    if (this._motionAllowed()) void this.play();
  }

  override render() {
    const sources = this.sources ?? [];

    return html`
      <figure>
        <div class="frame">
          <video
            preload="none"
            loop
            muted
            playsinline
            poster="${this.poster || nothing}"
            aria-label="${this.label || nothing}"
            @play="${this._onPlay}"
            @pause="${this._onPause}"
          >
            ${sources.map(
              (source) =>
                html`<source src="${source.src}" type="${source.type || nothing}" />`,
            )}
          </video>
          ${sources.length === 0
            ? ''
            : html`
                <div class="controls">
                  <button
                    type="button"
                    class="toggle"
                    @click="${this._onToggle}"
                  >${this._playing ? 'Pause' : 'Play'}</button>
                </div>
              `}
        </div>
        <figcaption><slot name="caption"></slot></figcaption>
      </figure>
    `;
  }
}

export default LitroHeroVideo;
