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
  renderRoot: unknown;
  play(): Promise<boolean>;
  pause(): void;
  toggle(): void;
  firstUpdated(): void;
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
function fakeVideo(options: { refuse?: boolean } = {}) {
  const video = {
    muted: false,
    paused: true,
    plays: 0,
    pauses: 0,
    async play() {
      video.plays += 1;
      if (options.refuse) throw new Error('refused');
      video.paused = false;
    },
    pause() {
      video.pauses += 1;
      video.paused = true;
    },
  };
  return video;
}

/** Build an element whose `_video` lookup finds the stand-in. */
function elementWith(video: ReturnType<typeof fakeVideo>): HeroVideoElement {
  const element = new LitroHeroVideo();
  element.renderRoot = { querySelector: () => video };
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
   * A browser can still refuse: no decoder for the format, a missing file, or
   * a policy the page cannot see. Saying so is better than leaving "Pause" on
   * a button over a still poster.
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
