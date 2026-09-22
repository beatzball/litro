/**
 * The supernova landing page's hero video.
 *
 * WHY THESE TESTS RENDER ON THE SERVER
 *
 * The landing page's promise is that it reads with JavaScript turned off, so
 * the poster, the accessible name and the caption have to be in the HTML the
 * SERVER sends. A component can be imported, registered, compiled and placed
 * in the markup and still reach a reader as an empty tag — the server build
 * drops a module nothing uses, and then Lit SSR has no class to expand. That
 * failure builds green, so the checks below read rendered output.
 *
 * WHY THE COMPONENT IS LOADED AT RUN TIME
 *
 * `@lit-labs/ssr` installs the DOM shim that gives Node a `customElements`
 * registry, and the component calls `customElements.define()` while it loads,
 * so it must load after the shim. A static import would be hoisted above the
 * first line of this file; an import inside `beforeAll` cannot be.
 *
 * The other reason is tsc. A recipe's `template/` is excluded from this
 * package's tsconfig on purpose — those files are scaffolding output, compiled
 * by the scaffolded app against its own dependencies, not by us. A static
 * import of one fails the package build with TS6307 even though vitest is
 * happy, because vitest does not type-check (TEST-003).
 */
import { render } from '@lit-labs/ssr';
import type { RenderResult } from '@lit-labs/ssr';
import { html } from 'lit';
import type { TemplateResult } from 'lit';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { scaffold } from './scaffold.js';

const COMPONENT = new URL(
  '../recipes/supernova/template/src/components/litro-hero-video.ts',
  import.meta.url,
);

/** One encoding of the clip, as the component's `sources` list holds it. */
interface HeroVideoSource {
  src: string;
  type?: string;
}

/**
 * The parts of the element these tests drive. Typed here rather than imported,
 * because the module is loaded by path (see the note above), and typed loosely
 * on purpose: `renderRoot` takes a stand-in with one method on it, so the
 * playback rules can be tested without a video decoder.
 */
interface HeroVideoElement {
  poster: string;
  label: string;
  sources: HeroVideoSource[];
  _playing: boolean;
  _trouble: boolean;
  renderRoot: unknown;
  play(): Promise<boolean>;
  pause(): void;
  toggle(): void;
  firstUpdated(): void;
  /** Private on the class; these tests drive them as the events would. */
  _onTrouble(): void;
  _onSourceError(event: { target: unknown }): void;
}

let LitroHeroVideo: new () => HeroVideoElement;

beforeAll(async () => {
  const mod = (await import(COMPONENT.href)) as Record<string, unknown>;
  LitroHeroVideo = mod.LitroHeroVideo as new () => HeroVideoElement;
});

/** Flatten Lit SSR's chunk iterable into one string of HTML. */
async function collect(result: RenderResult): Promise<string> {
  let out = '';
  for (const chunk of result) {
    out += typeof chunk === 'string' ? chunk : await collect(await chunk);
  }
  return out;
}

/** Render a template the way the Nitro page handler does, and return the HTML. */
async function renderToString(template: TemplateResult): Promise<string> {
  return collect(render(template));
}

/**
 * Lit SSR writes `<!--lit-part-->` markers between static text and a binding,
 * which splits a sentence in two. Strip the comments so an assertion tests the
 * rendered TEXT and not one framework's marker style.
 */
async function renderText(template: TemplateResult): Promise<string> {
  return (await renderToString(template)).replace(/<!--.*?-->/gs, '');
}

/**
 * A stand-in for the video element.
 *
 * It records what was asked of it, which is the only way to test the loading
 * and motion rules in Node: there is no decoder, and a real `play()` would
 * need a real file — and this recipe ships no media.
 */
function fakeVideo(
  options: {
    /** Reject `play()`, the way a playback policy does. */
    refuse?: boolean;
    /** Never settle `play()`, the way a clip that 404s does. */
    hang?: boolean;
    /** `HTMLMediaElement.networkState`. Defaults to NETWORK_EMPTY. */
    networkState?: number;
    /** `HTMLMediaElement.readyState`. Defaults to HAVE_NOTHING. */
    readyState?: number;
    /** A `MediaError`, which a bare failing `src` produces. */
    error?: unknown;
  } = {},
) {
  const video = {
    // The element's own constants, read by name in the component rather than
    // as bare numbers.
    NETWORK_EMPTY: 0,
    NETWORK_IDLE: 1,
    NETWORK_LOADING: 2,
    NETWORK_NO_SOURCE: 3,
    HAVE_NOTHING: 0,
    HAVE_METADATA: 1,

    muted: false,
    paused: true,
    plays: 0,
    pauses: 0,
    networkState: options.networkState ?? 0,
    readyState: options.readyState ?? 0,
    error: options.error ?? null,
    play() {
      video.plays += 1;
      if (options.refuse) return Promise.reject(new Error('refused'));
      video.paused = false;
      if (options.hang) return new Promise<void>(() => {});
      return Promise.resolve();
    },
    pause() {
      video.pauses += 1;
      video.paused = true;
    },
  };
  return video;
}

/**
 * Build an element whose `_video` lookup finds the stand-in.
 *
 * `candidates` stands in for the rendered `<source>` elements, which is what
 * the component compares an `error` event's target against.
 */
function elementWith(
  video: ReturnType<typeof fakeVideo>,
  candidates: unknown[] = [],
): HeroVideoElement {
  const element = new LitroHeroVideo();
  element.renderRoot = {
    querySelector: () => video,
    querySelectorAll: () => candidates,
  };
  return element;
}

/** Answer `prefers-reduced-motion` the way a browser would. */
function stubReducedMotion(reduce: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// What the server sends
// ---------------------------------------------------------------------------

describe('litro-hero-video renders on the server', () => {
  it('puts the poster, the accessible name and the caption in the HTML', async () => {
    const out = await renderText(
      html`<litro-hero-video
        poster="/demo/poster.jpg"
        label="What the tool does, in 15 seconds"
        .sources="${[{ src: '/demo/clip.webm', type: 'video/webm' }]}"
      >
        <span slot="caption">A short caption.</span>
      </litro-hero-video>`,
    );

    // A shadow root at all: without one the element reached the reader empty.
    expect(out).toContain('<template shadowroot');
    expect(out).toContain('poster="/demo/poster.jpg"');
    expect(out).toContain('<slot name="caption">');
    // Slotted content is light DOM, so it is in the HTML either way.
    expect(out).toContain('A short caption.');
    expect(out).toContain('src="/demo/clip.webm"');
    expect(out).toContain('type="video/webm"');
  });

  /**
   * A hero clip is the heaviest thing on a landing page, and most readers
   * scroll past it. Both halves of this matter: an autostart attribute would
   * fetch and run it for everybody, and any `preload` but `none` would fetch
   * it for everybody even while it sits still.
   */
  it('asks for no video up front: no autostart attribute, preload none', async () => {
    const out = await renderToString(
      html`<litro-hero-video
        poster="/demo/poster.jpg"
        label="What the tool does, in 15 seconds"
        .sources="${[{ src: '/demo/clip.webm', type: 'video/webm' }]}"
      ></litro-hero-video>`,
    );

    expect(out).toContain('preload="none"');
    expect(out).not.toContain('autoplay');
    expect(out).not.toContain('preload="auto"');
    expect(out).not.toContain('preload="metadata"');
  });

  /** The name a screen reader announces is the sentence the page wrote. */
  it('takes its accessible name from the label', async () => {
    const out = await renderToString(
      html`<litro-hero-video
        poster="/demo/poster.jpg"
        label="What the tool does, in 15 seconds"
      ></litro-hero-video>`,
    );

    expect(out).toContain('aria-label="What the tool does, in 15 seconds"');
  });

  /**
   * The recipe ships no clip, so this is the state the page is really in when
   * a user first scaffolds it: a poster and nothing to play. It must render,
   * and it must not offer a button that could do nothing.
   */
  it('shows the poster and no button when there are no sources', async () => {
    const out = await renderToString(
      html`<litro-hero-video
        poster="/demo/poster.jpg"
        label="What the tool does, in 15 seconds"
      ></litro-hero-video>`,
    );

    expect(out).toContain('<template shadowroot');
    expect(out).toContain('poster="/demo/poster.jpg"');
    expect(out).not.toContain('<button');
    expect(out).not.toContain('<source');
  });

  it('does not throw when rendered with no sources and no poster', async () => {
    await expect(
      renderToString(html`<litro-hero-video></litro-hero-video>`),
    ).resolves.toContain('<template shadowroot');
  });

  it('asks for no image or font of its own', async () => {
    const out = await renderToString(
      html`<litro-hero-video label="A recording"></litro-hero-video>`,
    );

    expect(out).not.toContain('<img');
    expect(out).not.toContain('url(');
    expect(out).not.toContain('@font-face');
  });
});

// ---------------------------------------------------------------------------
// The button says which action it performs
// ---------------------------------------------------------------------------

describe('the play/pause button names the action, not the state', () => {
  const sources = [{ src: '/demo/clip.webm', type: 'video/webm' }];

  it('says Play while the clip is paused', async () => {
    const out = await renderText(
      html`<litro-hero-video
        label="A recording"
        .sources="${sources}"
        ._playing="${false}"
      ></litro-hero-video>`,
    );

    expect(out).toContain('>Play<');
    expect(out).not.toContain('>Pause<');
  });

  it('says Pause while the clip is running', async () => {
    const out = await renderText(
      html`<litro-hero-video
        label="A recording"
        .sources="${sources}"
        ._playing="${true}"
      ></litro-hero-video>`,
    );

    expect(out).toContain('>Pause<');
    expect(out).not.toContain('>Play<');
  });
});

// ---------------------------------------------------------------------------
// Playback, and the reduced motion rule
// ---------------------------------------------------------------------------

describe('litro-hero-video plays only when it should', () => {
  const sources = [{ src: '/demo/clip.webm', type: 'video/webm' }];

  it('starts muted when the reader welcomes motion', () => {
    stubReducedMotion(false);
    const video = fakeVideo();
    const element = elementWith(video);
    element.sources = sources;

    element.firstUpdated();

    expect(video.plays).toBe(1);
    // Muted, because a landing page that makes noise by itself is a bug.
    expect(video.muted).toBe(true);
  });

  /**
   * `prefers-reduced-motion: reduce` is a reader telling the page to hold
   * still. A clip starting by itself is exactly the motion they asked it not
   * to make, so the poster stays.
   */
  it('stays on the poster when less motion is asked for', () => {
    stubReducedMotion(true);
    const video = fakeVideo();
    const element = elementWith(video);
    element.sources = sources;

    element.firstUpdated();

    expect(video.plays).toBe(0);
    expect(video.paused).toBe(true);
  });

  /** A press of the button is a request, not motion the page decided on. */
  it('plays on a button press even when less motion is asked for', async () => {
    stubReducedMotion(true);
    const video = fakeVideo();
    const element = elementWith(video);
    element.sources = sources;

    expect(await element.play()).toBe(true);
    expect(video.plays).toBe(1);
  });

  it('refuses to play, and does not throw, when there are no sources', async () => {
    const video = fakeVideo();
    const element = elementWith(video);

    expect(await element.play()).toBe(false);
    expect(video.plays).toBe(0);
  });

  it('does not throw when toggled with nothing rendered yet', () => {
    const element = new LitroHeroVideo();
    expect(() => element.toggle()).not.toThrow();
  });

  /**
   * A browser can refuse outright: a playback policy the page cannot see.
   * That one rejects the promise.
   */
  it('reports a refusal rather than claiming it is playing', async () => {
    const video = fakeVideo({ refuse: true });
    const element = elementWith(video);
    element.sources = sources;

    expect(await element.play()).toBe(false);
  });

  it('pauses the clip when it is running', () => {
    const video = fakeVideo();
    const element = elementWith(video);
    element.sources = sources;
    element._playing = true;

    element.toggle();

    expect(video.pauses).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// When the clip cannot be played at all
// ---------------------------------------------------------------------------

/**
 * The failure that does NOT reject.
 *
 * With `<source>` children that all fail — a 404, or a format the browser will
 * not take — the media resource selection algorithm runs out of candidates,
 * fires `error` at the last `<source>` (which neither bubbles nor becomes an
 * error on the video), sets `networkState` to `NETWORK_NO_SOURCE`, and then
 * waits for somebody to add another source. `play()` is never rejected and
 * never resolved, and `paused` stays false. Left alone the button reads
 * "Pause" over a poster that will never move, which is the one thing this
 * component is not allowed to do.
 */
describe('litro-hero-video tells the truth when the clip will not play', () => {
  const sources = [{ src: '/demo/clip.webm', type: 'video/webm' }];

  /** An element mid-playback whose video has run out of candidates. */
  function stuckElement() {
    const video = fakeVideo({
      hang: true,
      networkState: 3, // NETWORK_NO_SOURCE
      readyState: 0, // HAVE_NOTHING
    });
    const element = elementWith(video);
    element.sources = sources;
    return { video, element };
  }

  it('puts the button back to Play when the video runs out of sources', () => {
    const { video, element } = stuckElement();
    // The `play` event fired, so the component believes it is playing.
    element._playing = true;

    element._onTrouble();

    expect(element._playing).toBe(false);
    expect(element._trouble).toBe(true);
    // `paused` was still false, so the element is put back where the button
    // now says it is. A press then retries instead of appearing to do nothing.
    expect(video.pauses).toBe(1);
  });

  it('settles play() as a failure instead of hanging for good', async () => {
    const { element } = stuckElement();

    const result = element.play();
    element._playing = true;
    element._onTrouble();

    expect(await result).toBe(false);
  });

  it('treats an error on the video itself as a failure', () => {
    const video = fakeVideo({
      hang: true,
      networkState: 2, // NETWORK_LOADING — but the element reported an error
      readyState: 1, // HAVE_METADATA
      error: { code: 4 },
    });
    const element = elementWith(video);
    element.sources = sources;
    element._playing = true;

    element._onTrouble();

    expect(element._playing).toBe(false);
    expect(element._trouble).toBe(true);
  });

  /**
   * `waiting` and `stalled` also fire on a healthy clip over a slow link. The
   * state is what decides, not the event: a clip that is still loading has
   * candidates left, so it is not a failure.
   */
  it('leaves a healthy clip alone while it is still loading', () => {
    const video = fakeVideo({
      hang: true,
      networkState: 2, // NETWORK_LOADING
      readyState: 0, // HAVE_NOTHING — nothing decoded yet
    });
    const element = elementWith(video);
    element.sources = sources;
    element._playing = true;

    element._onTrouble();

    expect(element._playing).toBe(true);
    expect(element._trouble).toBe(false);
    expect(video.pauses).toBe(0);
  });

  /**
   * With `preload="none"` an idle element legitimately sits at NETWORK_EMPTY
   * with nothing decoded from the moment it renders. Judging that as a
   * failure would announce one before anybody pressed anything.
   */
  /**
   * The signal that actually arrives in Chromium, and the one the first
   * attempt at this missed: `error` on the last `<source>`. `networkState` is
   * still NETWORK_LOADING when it fires and only becomes NETWORK_NO_SOURCE
   * afterwards, with no further event to notice it by.
   */
  it('gives up when the last candidate fails to load', () => {
    const video = fakeVideo({ hang: true, networkState: 2, readyState: 0 });
    const first = { name: 'webm' };
    const last = { name: 'mp4' };
    const element = elementWith(video, [first, last]);
    element.sources = sources;
    element._playing = true;

    element._onSourceError({ target: last });

    expect(element._playing).toBe(false);
    expect(element._trouble).toBe(true);
    expect(video.pauses).toBe(1);
  });

  /**
   * An error on an earlier candidate is ordinary fallback — that is what a
   * list of encodings is for, and the next one may well play.
   */
  it('keeps waiting when an earlier candidate fails and another remains', () => {
    const video = fakeVideo({ hang: true, networkState: 2, readyState: 0 });
    const first = { name: 'webm' };
    const last = { name: 'mp4' };
    const element = elementWith(video, [first, last]);
    element.sources = sources;
    element._playing = true;

    element._onSourceError({ target: first });

    expect(element._playing).toBe(true);
    expect(element._trouble).toBe(false);
    expect(video.pauses).toBe(0);
  });

  it('says nothing about an idle element that was never played', () => {
    const video = fakeVideo({ networkState: 0, readyState: 0 });
    const element = elementWith(video);
    element.sources = sources;

    element._onTrouble();

    expect(element._trouble).toBe(false);
    expect(video.pauses).toBe(0);
  });
});


// ---------------------------------------------------------------------------
// The file a user actually gets
// ---------------------------------------------------------------------------

describe('litro-hero-video reaches a scaffolded app', () => {
  it('is copied into a scaffolded supernova site', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'litro-hero-video-test-'));
    try {
      const targetDir = join(dir, 'my-product');
      await scaffold('supernova', { projectName: 'my-product', mode: 'ssg' }, targetDir);

      expect(
        existsSync(join(targetDir, 'src/components/litro-hero-video.ts')),
      ).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  /**
   * `playground-supernova` is the recipe run as a dev app, and its copy of
   * each component is a copy, not a link. The e2e suite drives the playground
   * copy, so a fix made in one place and not the other would leave the recipe
   * shipping the broken version with a green suite behind it.
   */
  it('is byte for byte the same as the playground copy', async () => {
    const recipe = await readFile(
      new URL(
        '../recipes/supernova/template/src/components/litro-hero-video.ts',
        import.meta.url,
      ),
      'utf-8',
    );
    const playground = await readFile(
      new URL(
        '../../../playground-supernova/src/components/litro-hero-video.ts',
        import.meta.url,
      ),
      'utf-8',
    );

    expect(playground).toBe(recipe);
  });
});
