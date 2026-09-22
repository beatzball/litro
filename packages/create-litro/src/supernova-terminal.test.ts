/**
 * The supernova landing page's terminal parts.
 *
 * WHY THESE TESTS RENDER ON THE SERVER
 *
 * The same reason as `supernova-components.test.ts`, and it is the point of
 * the whole recipe: the landing page must read with JavaScript turned off, so
 * the only thing worth asserting is the HTML the SERVER sends. A component can
 * be imported, registered, compiled and placed in the markup and still reach a
 * reader as an empty tag — the server build drops a module nothing appears to
 * use, and Lit SSR then has no class to expand. That failure builds green.
 *
 * WHY THE COMPONENTS ARE LOADED AT RUN TIME
 *
 * `@lit-labs/ssr` installs the DOM shim that gives Node a `customElements`
 * registry, and a component module calls `customElements.define()` while it
 * loads, so it has to load after the shim. A static import would be hoisted
 * above the first line of this file; an import inside `beforeAll` cannot be.
 * A recipe's `template/` is also excluded from this package's tsconfig, so a
 * static import of one fails the package build with TS6307 (TEST-003).
 */
import { render } from '@lit-labs/ssr';
import type { RenderResult } from '@lit-labs/ssr';
import { html } from 'lit';
import type { TemplateResult } from 'lit';
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { scaffold, loadRecipe } from './scaffold.js';
import { applyRecipeOptions } from './recipe-options.js';

const COMPONENTS = new URL(
  '../recipes/supernova/template/src/components/',
  import.meta.url,
);

/** The three terminal parts this phase adds. */
const COMPONENT_FILES = [
  'litro-state-badge',
  'litro-status-bar',
  'litro-term-window',
];

/** The five states, and the glyph the default set draws for each. */
const DEFAULT_GLYPH: Record<string, string> = {
  error: '[x]',
  blocked: '[!]',
  working: '[~]',
  done: '[+]',
  idle: '[.]',
};

beforeAll(async () => {
  for (const name of COMPONENT_FILES) {
    await import(new URL(`${name}.ts`, COMPONENTS).href);
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

async function withTmpDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'litro-supernova-terminal-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// litro-state-badge
// ---------------------------------------------------------------------------

describe('litro-state-badge renders one state on the server', () => {
  it('draws every state with its own glyph and its own color class', async () => {
    for (const [state, glyph] of Object.entries(DEFAULT_GLYPH)) {
      const out = await renderText(
        html`<litro-state-badge state="${state}"></litro-state-badge>`,
      );

      // A shadow root at all: without one the element reached the reader empty.
      expect(out, state).toContain('<template shadowroot');
      expect(out, state).toContain(glyph);
      // The class is how the badge picks up --nova-<state>. A badge with no
      // state class would render in the surrounding text color and the five
      // states would be one color.
      expect(out, state).toContain(`class="${state}"`);
    }
  });

  it('draws the state name beside the glyph when one is asked for', async () => {
    const out = await renderText(
      html`<litro-state-badge state="blocked" label="blocked"></litro-state-badge>`,
    );

    expect(out).toContain('[!]');
    expect(out).toContain('class="label blocked"');
  });

  it('takes a glyph set of its own, so a project is not stuck with ASCII', async () => {
    const out = await renderText(
      html`<litro-state-badge
        state="done"
        .glyphs="${{
          error: 'ERR',
          blocked: 'WAIT',
          working: 'RUN',
          done: 'OK',
          idle: 'ZZZ',
        }}"
      ></litro-state-badge>`,
    );

    expect(out).toContain('OK');
    expect(out).not.toContain('[+]');
  });

  /**
   * The settle is the one moving part the status bar has, and it is CSS, so
   * it has to be whole in the server HTML: both glyphs, both animation
   * classes, and the delay. Nothing here waits for a script.
   */
  it('renders both glyphs and the delay when it settles from another state', async () => {
    const out = await renderText(
      html`<litro-state-badge
        state="done"
        from="working"
        delay="1.6"
      ></litro-state-badge>`,
    );

    expect(out).toContain('[~]'); // the state it starts in
    expect(out).toContain('[+]'); // the state it settles on
    expect(out).toContain('class="from working"');
    expect(out).toContain('class="to done"');
    // The delay rides on the element as a custom property, so each tab in a
    // row settles at its own moment with one shared animation.
    expect(out).toContain('--at: 1.6s');
  });

  it('renders one glyph and no animation classes when it does not settle', async () => {
    const out = await renderText(
      html`<litro-state-badge state="working"></litro-state-badge>`,
    );

    expect(out).not.toContain('class="from');
    expect(out).not.toContain('class="to ');
  });

  /**
   * `prefers-reduced-motion` has to stop the settle, and it has to stop it in
   * CSS: a media query cannot be evaluated on the server, so the rule must
   * ship inside the component's styles rather than be applied by a script.
   */
  it('ships the reduced-motion rule in its styles', async () => {
    const out = await renderToString(
      html`<litro-state-badge state="done" from="working"></litro-state-badge>`,
    );

    expect(out).toContain('prefers-reduced-motion');
  });
});

// ---------------------------------------------------------------------------
// litro-status-bar
// ---------------------------------------------------------------------------

/** The navigation the docs header shows, as `server/starlight.config.js` has it. */
const NAV = [
  { label: 'Docs', href: '/docs/getting-started' },
  { label: 'Blog', href: '/blog' },
];

function statusBar(nav: Array<{ label: string; href: string }>): TemplateResult {
  return html`
    <litro-status-bar
      siteTitle="my-product"
      tabsLabel="Two tasks: build is done, test is working."
      .tabs="${[
        { name: 'build', state: 'done', from: 'working', delay: 1.6, current: true },
        { name: 'test', state: 'working' },
      ]}"
    >
      <svg slot="mark"></svg>
      ${nav.map((item) => html`<a slot="nav" href="${item.href}">${item.label}</a>`)}
    </litro-status-bar>
  `;
}

describe('litro-status-bar carries the site title and the navigation', () => {
  it('renders the title as a link home, with a slot for the mark', async () => {
    const out = await renderText(statusBar(NAV));

    expect(out).toContain('<template shadowroot');
    expect(out).toContain('my-product');
    expect(out).toContain('href="/"');
    expect(out).toContain('name="mark"');
  });

  /**
   * The bar replaces the docs header on the landing page, so a reader must
   * find the same links in it. They are slotted, which means they are light
   * DOM and are in the server HTML whether or not the element expanded.
   */
  it('renders every navigation link the docs header shows', async () => {
    const out = await renderText(statusBar(NAV));

    expect(out).toContain('name="nav"');
    for (const item of NAV) {
      expect(out).toContain(`href="${item.href}"`);
      expect(out).toContain(item.label);
    }
  });

  it('renders a tab per entry, each with its state badge', async () => {
    const out = await renderText(statusBar(NAV));

    expect(out).toContain('build');
    expect(out).toContain('test');
    // The badges really expanded inside the bar's shadow root, rather than
    // sitting there as bare tags.
    expect(out).toContain('[+]'); // build, settled on done
    expect(out).toContain('[~]'); // test, working
    // The row is one picture, described once, with its parts hidden.
    expect(out).toContain('role="img"');
    expect(out).toContain('Two tasks: build is done, test is working.');
    expect(out).toContain('aria-hidden="true"');
  });

  it('renders no tab row at all when it is given no tabs', async () => {
    const out = await renderText(
      html`<litro-status-bar siteTitle="my-product"></litro-status-bar>`,
    );

    expect(out).toContain('my-product');
    expect(out).not.toContain('class="tabs"');
  });
});

// ---------------------------------------------------------------------------
// litro-term-window
// ---------------------------------------------------------------------------

describe('litro-term-window draws a terminal picture', () => {
  it('renders a row per entry, as one labeled picture', async () => {
    const label =
      'Three tasks listed by state. deploy is blocked, test is working, build is done.';
    const out = await renderText(
      html`<litro-term-window
        label="${label}"
        .rows="${[
          { state: 'blocked', age: '4m', name: 'deploy', hot: true },
          { state: 'working', age: '5m', name: 'test' },
          { state: 'done', age: '1m', name: 'build' },
        ]}"
      ></litro-term-window>`,
    );

    expect(out).toContain('<template shadowroot');
    // One role="img", carrying the sentence a screen reader gets.
    expect(out).toContain('role="img"');
    expect(out).toContain(label);
    // ...and the parts inside it are hidden, so they are not read one by one.
    expect(out).toContain('aria-hidden="true"');

    // Every row reached the HTML, badge and all.
    expect(out).toContain('deploy');
    expect(out).toContain('test');
    expect(out).toContain('build');
    expect(out).toContain('4m');
    expect(out).toContain('[!]');
    expect(out).toContain('[~]');
    expect(out).toContain('[+]');
    // The one row the picture is about is marked, not just colored.
    expect(out).toContain('class="row hot"');
  });

  it('renders slotted content instead when it is given no rows', async () => {
    const out = await renderText(
      html`<litro-term-window label="A shell session: the build passes.">
        <pre>$ my-product build
done in 1.4s</pre>
      </litro-term-window>`,
    );

    expect(out).toContain('<template shadowroot');
    expect(out).toContain('$ my-product build');
    expect(out).toContain('done in 1.4s');
    // The slot the transcript went into, and no row markup beside it.
    expect(out).toContain('<slot>');
    expect(out).not.toContain('class="row');
  });

  it('asks for no image', async () => {
    const out = await renderToString(
      html`<litro-term-window
        label="One task, working."
        .rows="${[{ state: 'working', age: '5m', name: 'test' }]}"
      ></litro-term-window>`,
    );

    expect(out).not.toContain('<img');
    expect(out).not.toContain('url(');
  });
});

// ---------------------------------------------------------------------------
// The bar's links come from the site navigation, so --no-blog reaches them
// ---------------------------------------------------------------------------

/**
 * The landing page's Blog BUTTON is deleted by name (see `src/blog.ts`), but
 * the status bar's Blog LINK is not: the bar renders whatever is in
 * `server/starlight.config.js`, and `--no-blog` takes the entry out of that
 * file. This is the test that keeps the two facts joined — if the page ever
 * stopped rendering the bar's links from the navigation, a scaffold without a
 * blog would ship a dead link in the header of its landing page.
 */
describe('a --no-blog scaffold has no Blog link in the status bar', () => {
  async function scaffoldWithoutBlog(dir: string): Promise<string> {
    const targetDir = join(dir, 'my-product');
    await scaffold(
      'supernova',
      { projectName: 'my-product', mode: 'ssg', recipeOptions: { blog: false } },
      targetDir,
    );
    const recipe = await loadRecipe('supernova');
    await applyRecipeOptions(recipe!, { blog: false }, targetDir);
    return targetDir;
  }

  it('renders the bar from the navigation, not from links written by hand', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = await scaffoldWithoutBlog(dir);
      const home = await readFile(join(targetDir, 'pages/index.ts'), 'utf-8');

      // The links in the bar's nav slot are mapped from the page's `nav`
      // data, which pageData reads from server/starlight.config.js.
      expect(home).toContain('<litro-status-bar');
      expect(home).toContain('slot="nav"');
      expect(home).toMatch(/nav\.map\(/);
      // ...and the docs header it replaced is gone from this page.
      expect(home).not.toContain('<starlight-header');
    });
  });

  it('renders Docs and no Blog once the entry is gone from the navigation', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = await scaffoldWithoutBlog(dir);

      // The real config the scaffolded site ships, after the blog was removed.
      const configUrl = pathToFileURL(
        join(targetDir, 'server/starlight.config.js'),
      ).href;
      const { siteConfig } = (await import(configUrl)) as {
        siteConfig: { nav: Array<{ label: string; href: string }> };
      };
      expect(siteConfig.nav.some((item) => item.href.startsWith('/blog'))).toBe(false);

      const out = await renderText(statusBar(siteConfig.nav));
      expect(out).toContain('href="/docs/getting-started"');
      expect(out).toContain('Docs');
      expect(out).not.toContain('/blog');
      expect(out).not.toContain('Blog');
    });
  });
});
