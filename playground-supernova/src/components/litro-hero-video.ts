import { LitElement, html, css, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { pageReset } from '@beatzball/litro/runtime/page-reset.js';

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
 * NOTHING IS FETCHED BY THE MARKUP ITSELF. There is no `autoplay` attribute
 * and `preload` is `none`, so a reader who asked for less motion, or who has
 * JavaScript off, downloads no video at all — they get the poster. When motion
 * IS welcome the script starts the clip, which of course fetches it; that is
 * the behavior the page wants, and it is the only path that costs a download.
 *
 * PLAYBACK IS STARTED BY SCRIPT, AND ONLY WHEN MOTION IS WELCOME. The
 * component asks `prefers-reduced-motion` once the page is live, then starts
 * the clip muted and looping, the way a silent product recording is expected
 * to behave. When less motion is asked for it stays on the poster, and
 * pressing the button still plays it — a direct request is not motion the page
 * decided to make.
 *
 * IT STARTS ONCE, NOT TWICE. On a first load the server's copy of this element
 * hydrates and then the router throws it away and mounts a fresh one, so an
 * autostart in `firstUpdated()` fetched the clip twice and dropped the first
 * copy. `_autostartWhenLive()` waits for the router to mark the outlet
 * settled, which happens after that swap, so only the surviving element ever
 * asks for the clip. Outside a Litro app there is no outlet and it starts
 * straight away.
 *
 * THE BUTTON SAYS WHICH ACTION IT PERFORMS, not which state the video is in:
 * "Play" while it is paused, "Pause" while it is running. It follows the video
 * rather than leading it, so a clip paused by the browser, by a keystroke on
 * the native controls or by a script still leaves the right word on screen —
 * including when the clip cannot be played at all. See `_onTrouble()`.
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
    _trouble: { state: true },
  };

  static override styles = [
    pageReset,
    css`
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

    .announce {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
  ];

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

  /** Whether the browser has given up on the clip. Announced, not drawn. */
  _trouble = false;

  /** Resolves `play()` when the element reports it cannot play (see below). */
  private _giveUp: (() => void) | undefined;

  /** Watches the router outlet for the settle that means this copy is live. */
  private _settleWatch: MutationObserver | undefined;

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
   * Returns whether playback actually began, which is not the same as whether
   * the promise resolved. `HTMLMediaElement.play()` rejects for a policy the
   * page cannot see, but when every `<source>` fails to load Chromium fires
   * `play` and then `waiting` and leaves the promise PENDING for good — so
   * waiting on it alone would hang and would report success. The race below
   * settles on whichever comes first: the promise, or the element's own report
   * that it has nothing left to play (`_onTrouble`).
   */
  async play(): Promise<boolean> {
    const video = this._video;
    if (!video || this.sources.length === 0) return false;

    this._trouble = false;
    video.muted = true;

    const asked = Promise.resolve(video.play()).then(
      () => true,
      () => false,
    );
    const gaveUp = new Promise<boolean>((resolve) => {
      this._giveUp = () => resolve(false);
    });

    try {
      return await Promise.race([asked, gaveUp]);
    } finally {
      this._giveUp = undefined;
    }
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

  /** Whether playback has been asked for and not yet given up on. */
  private get _tryingToPlay(): boolean {
    return this._playing || this._giveUp !== undefined;
  }

  /**
   * Stop claiming to play something that is not playing.
   *
   * WHY THIS EXISTS AT ALL. With `<source>` children that all fail — a clip
   * that 404s, a format the browser will not take — the media resource
   * selection algorithm runs out of candidates and then WAITS for somebody to
   * add another source. It never rejects `play()`, never resolves it, and
   * never fires `error` on the video. `paused` stays false. Left alone, the
   * button reads "Pause" over a poster that will never move, which is the one
   * thing this component must not do.
   */
  private _giveUpOnClip(): void {
    const video = this._video;
    this._trouble = true;
    this._playing = false;
    this._giveUp?.();
    // `paused` is still false, so put the element back where the button now
    // says it is. A press then retries rather than appearing to do nothing.
    video?.pause();
  }

  /**
   * A `<source>` that could not be loaded.
   *
   * THIS IS THE SIGNAL THAT ACTUALLY ARRIVES. The algorithm fires `error` at
   * each candidate it gives up on, and an error at the LAST one means there is
   * nothing left to try. `networkState` is not consulted here on purpose: it
   * is still `NETWORK_LOADING` when this fires and only becomes
   * `NETWORK_NO_SOURCE` afterwards, with no further event to notice it by —
   * which is why reading the state alone left the button saying "Pause".
   *
   * An error on any EARLIER candidate is ordinary fallback: that is what a
   * list of encodings is for, and the next one may well play.
   */
  private _onSourceError(event: Event): void {
    if (!this._tryingToPlay) return;
    const candidates = this.renderRoot?.querySelectorAll?.('source');
    if (!candidates || candidates.length === 0) return;
    if (event.target !== candidates[candidates.length - 1]) return;
    this._giveUpOnClip();
  }

  /**
   * The video's own complaints: `error` (the whole element failed, which is
   * what a bare `src` does), `stalled` and `waiting` (it wants data and has
   * none), and `emptied` (it lost what it had).
   *
   * A second net behind `_onSourceError`, and the state is what decides rather
   * than the event name — `waiting` and `stalled` fire on a healthy clip over
   * a slow link too. No candidates left AND not one frame decoded means it is
   * not going to play.
   *
   * It only judges once playback has been asked for, because with
   * `preload="none"` an idle element legitimately sits at `NETWORK_EMPTY` with
   * `readyState` 0 from the moment it renders.
   */
  private _onTrouble(): void {
    const video = this._video;
    if (!video || !this._tryingToPlay) return;

    const noCandidates =
      video.networkState === video.NETWORK_NO_SOURCE ||
      video.networkState === video.NETWORK_EMPTY;
    const noFrames = video.readyState === video.HAVE_NOTHING;

    if (!video.error && !(noCandidates && noFrames)) return;

    this._giveUpOnClip();
  }

  /**
   * Find the router outlet, if this is a Litro page.
   *
   * `closest()` cannot be used: this element lives in the page component's
   * shadow DOM and `closest()` does not cross a shadow boundary. A Litro app
   * has one outlet, so ask the document.
   */
  private _outlet(): Element | null {
    return globalThis.document?.querySelector?.('litro-outlet') ?? null;
  }

  /**
   * Autostart, but only from the copy of this element that the reader keeps.
   *
   * On a first load the server's HTML hydrates and THEN the router builds a
   * fresh page element, renders it hidden and swaps it in, dropping the
   * hydrated one. Both copies run `firstUpdated()`, so an autostart there
   * fetched the clip twice and threw the first copy away — on a real
   * recording, the heaviest file on the page, downloaded twice.
   *
   * `data-litro-settled` on the outlet is the router's own signal that the
   * swap is done (the same one every e2e spec waits for). The dropped copy is
   * already gone by then, and on a later client navigation the attribute is
   * still there from the first load, so a fresh element starts at once.
   */
  private _autostartWhenLive(): void {
    const outlet = this._outlet();
    if (!outlet || outlet.hasAttribute('data-litro-settled')) {
      this._autostart();
      return;
    }

    const watch = new MutationObserver(() => {
      if (!outlet.hasAttribute('data-litro-settled')) return;
      watch.disconnect();
      this._settleWatch = undefined;
      // The copy the router dropped is off the page by now, and it must not
      // fetch a clip nobody will see.
      if (this.isConnected) this._autostart();
    });
    watch.observe(outlet, {
      attributes: true,
      attributeFilter: ['data-litro-settled'],
    });
    this._settleWatch = watch;
  }

  /**
   * Nothing starts by itself unless the reader welcomes motion. A press of the
   * button is a different matter and is always honored.
   */
  private _autostart(): void {
    if (this._motionAllowed()) void this.play();
  }

  override firstUpdated(): void {
    this._autostartWhenLive();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._settleWatch?.disconnect();
    this._settleWatch = undefined;
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
            @error="${this._onTrouble}"
            @stalled="${this._onTrouble}"
            @waiting="${this._onTrouble}"
            @emptied="${this._onTrouble}"
          >
            ${sources.map(
              (source) =>
                html`<source
                  src="${source.src}"
                  type="${source.type || nothing}"
                  @error="${this._onSourceError}"
                />`,
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
        <span class="announce" role="status" aria-live="polite"
          >${this._trouble ? 'The recording could not be played.' : ''}</span
        >
      </figure>
    `;
  }
}

export default LitroHeroVideo;
