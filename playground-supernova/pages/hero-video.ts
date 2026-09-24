import { html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';

// Register the component used in render().
import '../src/components/litro-hero-video.js';

import type { HeroVideoSource } from '../src/components/litro-hero-video.js';

/**
 * A harness page for `<litro-hero-video>`.
 *
 * WHY THIS PAGE EXISTS. The landing page at `/` ships no clip, so it carries
 * the video section commented out with a note on what to drop in. That leaves
 * the component with nowhere to be exercised in a browser, and the parts worth
 * checking — a poster that loads no video, a button whose word follows the
 * video, and the reduced motion rule — only exist in a browser. So the e2e
 * spec gets a page of its own instead of an edit to the landing page.
 *
 * It renders the component twice, because the two states it can be in are
 * different components as far as a reader is concerned: with sources it offers
 * a button, and with none it is a poster and nothing else.
 *
 * THE CLIP IS NOT REAL. No media ships with the recipe, so `/demo/clip.webm`
 * is a URL with no file behind it. The spec replaces `HTMLMediaElement.play`
 * before the page loads, which is what lets it test WHEN playback is asked for
 * without shipping a video to decode.
 */

/** The made-up encodings of a clip that does not exist. */
const SOURCES: HeroVideoSource[] = [
  { src: '/demo/clip.webm', type: 'video/webm' },
  { src: '/demo/clip.mp4', type: 'video/mp4' },
];

export const routeMeta = {
  title: 'Hero video — playground-supernova',
};

@customElement('page-hero-video')
export class HeroVideoHarnessPage extends LitroPage {
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

    /* The component reads these and defines no colors of its own, the same
       way it does on the landing page. */
    :host {
      display: block;
      --nova-bg: #08090f;
      --nova-surface: #12141f;
      --nova-border: #262a3d;
      --nova-text: #e9ecfa;
      --nova-text-dim: #979db8;
      --nova-accent: #7c3aed;
      --nova-radius: 0.375rem;

      min-height: 100vh;
      padding: 2rem 1.5rem;
      background: var(--nova-bg);
      color: var(--nova-text);
    }

    main {
      max-width: 48rem;
      margin: 0 auto;
      display: grid;
      gap: 3rem;
    }

    h2 {
      font-size: 1rem;
      color: var(--nova-text-dim);
      margin: 0 0 0.75rem;
    }
  `;

  /**
   * This page has no server data, and in a STATIC build that is a trap.
   *
   * `LitroPage` reads `__litro_data__` out of the HTML on first load, and a
   * page with no `definePageData` export has no such script — so it falls
   * through to the default `fetchData()`, which re-requests the same URL with
   * `Accept: application/json`. A static host has no handler to negotiate
   * with, so it answers with the HTML again, `res.json()` rejects, and the
   * router never marks the outlet settled. `litro dev` hides it: there the
   * server does negotiate and answers with JSON.
   *
   * Saying so here is one line. The page needs no data, so there is nothing
   * to fetch.
   */
  override async fetchData(): Promise<unknown> {
    return null;
  }

  override render() {
    return html`
      <main>
        <h1>Hero video</h1>

        <section>
          <h2>With sources</h2>
          <litro-hero-video
            id="with-sources"
            poster="/demo/poster.jpg"
            label="What the tool does, in 15 seconds"
            .sources="${SOURCES}"
          >
            <span slot="caption">A short caption under the recording.</span>
          </litro-hero-video>
        </section>

        <section>
          <h2>With no sources</h2>
          <litro-hero-video
            id="no-sources"
            poster="/demo/poster.jpg"
            label="Nothing recorded yet"
          >
            <span slot="caption">The poster, and no button to press.</span>
          </litro-hero-video>
        </section>
      </main>
    `;
  }
}

export default HeroVideoHarnessPage;
