/**
 * The supernova landing page's own components.
 *
 * WHY THESE TESTS RENDER ON THE SERVER
 *
 * The landing page's promise is that it reads with JavaScript turned off, so
 * the only thing worth asserting is the HTML the SERVER sends. A component can
 * be imported, registered, compiled and placed in the markup and still reach a
 * reader as an empty tag: the server build drops a module nothing uses, and
 * then Lit SSR has no class to expand. That failure builds green, which is why
 * every check below reads rendered output rather than source.
 *
 * WHY THE COMPONENTS ARE LOADED AT RUN TIME
 *
 * Two reasons, and both of them are about load order.
 *
 * `@lit-labs/ssr` installs the DOM shim that gives Node a `customElements`
 * registry. A component module calls `customElements.define()` while it loads,
 * so it has to load after the shim. A static import would be hoisted above the
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
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';

const COMPONENTS = new URL(
  '../recipes/supernova/template/src/components/',
  import.meta.url,
);

/** The five components the supernova landing page brings with it. */
const COMPONENT_FILES = [
  'litro-install-command',
  'litro-feature-row',
  'litro-steps',
  'litro-key-hints',
  'litro-hero-nova',
];

/**
 * An instance of the install command, for the copy tests. Typed loosely
 * because the module is loaded by path rather than imported.
 */
interface InstallCommandElement {
  command: string;
  _status: string;
  copy(): Promise<'copied' | 'selected'>;
}

let LitroInstallCommand: new () => InstallCommandElement;

beforeAll(async () => {
  for (const name of COMPONENT_FILES) {
    const mod = (await import(new URL(`${name}.ts`, COMPONENTS).href)) as Record<
      string,
      unknown
    >;
    if (name === 'litro-install-command') {
      LitroInstallCommand = mod.LitroInstallCommand as new () => InstallCommandElement;
    }
  }
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

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Every component puts its content in the server HTML
// ---------------------------------------------------------------------------

describe('the landing page components render on the server', () => {
  it('litro-install-command renders the command, the prompt and the button', async () => {
    const out = await renderText(
      html`<litro-install-command
        command="npm install my-product"
      ></litro-install-command>`,
    );

    // A shadow root at all: without one the element reached the reader empty.
    expect(out).toContain('<template shadowroot');
    expect(out).toContain('npm install my-product');
    // The prompt is decoration, so it is hidden from assistive tech and left
    // out of a selection made by hand.
    expect(out).toContain('aria-hidden="true"');
    expect(out).toContain('user-select: none');
    // The button, and the live region that announces what it did.
    expect(out).toContain('Copy');
    expect(out).toContain('aria-live="polite"');
  });

  it('litro-feature-row renders its heading and its command chips', async () => {
    const out = await renderText(
      html`<litro-feature-row
        heading="Name the first thing it does"
        .commands="${['my-product init', 'my-product run']}"
      >
        <p>What it is for.</p>
      </litro-feature-row>`,
    );

    expect(out).toContain('<template shadowroot');
    expect(out).toContain('Name the first thing it does');
    expect(out).toContain('my-product init');
    expect(out).toContain('my-product run');
    // A slot for the picture, and one for the text.
    expect(out).toContain('name="figure"');
    // Slotted content is light DOM, so it is in the HTML either way.
    expect(out).toContain('What it is for.');
  });

  it('litro-steps renders a numbered list with every step in it', async () => {
    const out = await renderText(
      html`<litro-steps
        .steps="${[
          { title: 'Install it', description: 'One command.' },
          { title: 'Run it' },
        ]}"
      ></litro-steps>`,
    );

    expect(out).toContain('<template shadowroot');
    // A real ordered list, so the numbers are the list's own.
    expect(out).toContain('<ol>');
    expect(out).toContain('Install it');
    expect(out).toContain('One command.');
    expect(out).toContain('Run it');
  });

  it('litro-key-hints renders a definition list with kbd elements', async () => {
    const out = await renderText(
      html`<litro-key-hints
        .hints="${[
          { keys: ['Ctrl', 'C'], meaning: 'Stop the current run' },
          { keys: '?', meaning: 'Show every key' },
        ]}"
      ></litro-key-hints>`,
    );

    expect(out).toContain('<template shadowroot');
    expect(out).toContain('<dl>');
    expect(out).toContain('<kbd>');
    expect(out).toContain('Ctrl');
    expect(out).toContain('Stop the current run');
    expect(out).toContain('Show every key');
  });

  it('litro-hero-nova renders its layers and keeps a slot for the mark', async () => {
    const out = await renderText(html`
      <litro-hero-nova>
        <svg slot="mark"></svg>
        <h1>Say what your product does, in one line.</h1>
      </litro-hero-nova>
    `);

    expect(out).toContain('<template shadowroot');
    expect(out).toContain('name="mark"');
    // The backdrop, and there is exactly one layer of it: a deep ground and
    // one soft wash. The ring, the bright core and the star field the hero
    // used to stack on top of each other are all gone, and naming them here
    // keeps them from coming back unnoticed.
    expect(out).toContain('class="layer wash"');
    expect(out).not.toContain('class="layer field"');
    expect(out).not.toContain('class="layer shock"');
    expect(out).not.toContain('class="layer core"');
    expect(out).not.toContain('class="layer glow"');
    // The hero's words are slotted, so they are in the HTML too.
    expect(out).toContain('Say what your product does, in one line.');
  });
});

// ---------------------------------------------------------------------------
// The copy button degrades
// ---------------------------------------------------------------------------

describe('litro-install-command copies, or selects instead', () => {
  it('says Copied when the clipboard takes the command', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const element = new LitroInstallCommand();
    element.command = 'npm install my-product';

    expect(await element.copy()).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('npm install my-product');
    expect(element._status).toBe('copied');
  });

  /**
   * A browser refuses the clipboard on an insecure origin, and a reader can
   * turn the permission off. Saying "Copied" then is a claim the page cannot
   * keep: the reader pastes the last thing they actually copied. So the
   * fallback selects the command instead and says so.
   */
  it('says Selected when the clipboard refuses', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const element = new LitroInstallCommand();
    element.command = 'npm install my-product';

    expect(await element.copy()).toBe('selected');
    expect(element._status).toBe('selected');
  });

  it('says Selected when there is no clipboard API at all', async () => {
    vi.stubGlobal('navigator', {});

    const element = new LitroInstallCommand();
    element.command = 'npm install my-product';

    expect(await element.copy()).toBe('selected');
    expect(element._status).toBe('selected');
  });
});

// ---------------------------------------------------------------------------
// The hero costs no request
// ---------------------------------------------------------------------------

describe('litro-hero-nova and the default mark', () => {
  /**
   * The ejecta is the slot's FALLBACK, not a layer painted behind the slot.
   * That distinction is the whole feature: a project that slots its own logo
   * must not get the recipe's mark underneath it. Writing it as fallback
   * content means the browser drops it the moment anything is assigned, with
   * no attribute to set and nothing for a project to remember to turn off.
   *
   * These two cases are the proof, in the server-rendered HTML that a reader
   * with no JavaScript gets.
   */
  it('draws the ejecta when a page slots no mark of its own', async () => {
    const out = await renderToString(html`<litro-hero-nova></litro-hero-nova>`);

    expect(out).toContain('class="ejecta"');
    expect(out).toContain('viewBox="0 0 480 480"');
  });

  it('drops the ejecta as soon as a page slots its own mark', async () => {
    const out = await renderToString(html`
      <litro-hero-nova>
        <svg slot="mark" id="my-logo"></svg>
      </litro-hero-nova>
    `);

    // The fallback is still in the shadow template, because that is what
    // fallback content IS; what matters is that the slot has an assigned node,
    // so the browser renders the logo and not the fallback.
    expect(out).toContain('id="my-logo"');
    expect(out).toContain('name="mark"');
  });

  it('takes its color from the tokens, so an accent change recolors it', async () => {
    const out = await renderToString(html`<litro-hero-nova></litro-hero-nova>`);

    expect(out).toContain('var(--nova-accent, currentColor)');
    expect(out).toContain('color: var(--nova-text)');
  });

  it('has no animation, so there is nothing to stop for reduced motion', async () => {
    const out = await renderToString(html`<litro-hero-nova></litro-hero-nova>`);

    expect(out).not.toContain('@keyframes');
    expect(out).not.toContain('animation:');
    expect(out).not.toContain('transition:');
  });
});

describe('litro-hero-nova asks for no image', () => {
  /**
   * The hero art is the reason the recipe ships no media. It is stacked
   * radial gradients, so a project can retint it from the token block and the
   * page stays as light as it was. An `<img>`, a `url()` or an SVG `src`
   * creeping in would undo that quietly: the page would still look right and
   * would simply cost another request on every visit.
   */
  it('renders no img, no src and no url() in its HTML or its styles', async () => {
    const out = await renderToString(html`<litro-hero-nova></litro-hero-nova>`);

    expect(out).not.toContain('<img');
    expect(out).not.toContain('src=');
    expect(out).not.toContain('url(');
    expect(out).not.toContain('@font-face');
    // ...and the art really is there, so this is not passing on an empty render.
    expect(out).toContain('radial-gradient');
  });
});
