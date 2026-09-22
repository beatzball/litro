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
  'litro-status-line',
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

/**
 * starlight-header is not one of supernova's own files — the recipe inherits
 * it from starlight, which is the point of the assertion that uses it: the
 * landing page carries the SAME header the docs pages do.
 */
const STARLIGHT_HEADER = new URL(
  '../recipes/starlight/template/src/components/starlight-header.ts',
  import.meta.url,
);

beforeAll(async () => {
  for (const name of COMPONENT_FILES) {
    await import(new URL(`${name}.ts`, COMPONENTS).href);
  }
  await import(STARLIGHT_HEADER.href);
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
// litro-status-line
// ---------------------------------------------------------------------------

/**
 * The cells a landing page shows. Every one is a fact the page can prove —
 * that is the whole point of the component, and what the tab row it replaced
 * could never be.
 */
const CELLS = [
  { state: 'done' as const, value: 'v1.2.0' },
  { state: 'working' as const, value: 'docs', trailing: '/getting-started' },
  { label: 'node', value: '20.19+', optional: true },
  { value: 'github', href: 'https://example.com/repo', right: true },
];

function statusLine(cells: unknown[]): TemplateResult {
  return html`
    <litro-status-line
      siteTitle="my-product"
      label="Project status"
      .cells="${cells}"
    ></litro-status-line>
  `;
}

describe('litro-status-line states facts, and nothing else', () => {
  it('renders the project name as a link home', async () => {
    const out = await renderText(statusLine(CELLS));

    expect(out).toContain('<template shadowroot');
    expect(out).toContain('my-product');
    expect(out).toContain('href="/"');
  });

  it('renders every cell, with its glyph, value and trailing text', async () => {
    const out = await renderText(statusLine(CELLS));

    expect(out).toContain('v1.2.0');
    expect(out).toContain('docs');
    expect(out).toContain('/getting-started');
    expect(out).toContain('node');
    expect(out).toContain('20.19+');
    // The glyphs come from litro-state-badge's set, so the line and the
    // badges speak the same grammar.
    expect(out).toContain('[+]');
    expect(out).toContain('[~]');
  });

  it('makes a cell with an href a link, and leaves the rest as text', async () => {
    const out = await renderToString(statusLine(CELLS));

    expect(out).toContain('href="https://example.com/repo"');
    // Nothing that does not link is styled as though it does.
    expect(out.match(/<a /g) ?? []).toHaveLength(2); // the name, and github
  });

  /**
   * A status line is read as live state, so an empty one is worse than none:
   * it takes a row of every viewport and says nothing. With no cells the
   * component renders nothing at all.
   */
  it('renders nothing when it is given no cells', async () => {
    const out = await renderToString(
      html`<litro-status-line siteTitle="my-product"></litro-status-line>`,
    );

    // The host tag and its attributes are still in the HTML — that is the
    // element the page wrote. What must not be there is the line itself.
    expect(out).not.toContain('<aside');
    expect(out).not.toContain('class="line"');
    expect(out).not.toContain('class="cell');
  });

  /**
   * The line is inside a landmark, so a page does not leave content sitting
   * outside one — which is what axe-core's `region` rule reports.
   */
  it('is a landmark with a name of its own', async () => {
    const out = await renderToString(statusLine(CELLS));

    expect(out).toContain('<aside class="line"');
    expect(out).toContain('aria-label="Project status"');
  });

  /**
   * The glyphs are the one thing hidden: a bracket and a plus sign read aloud
   * say nothing, while the words beside them are the fact.
   */
  it('hides the glyphs from assistive tech and leaves the words', async () => {
    const out = await renderToString(statusLine(CELLS));

    expect(out).toMatch(/<span class="glyph" data-state="done" aria-hidden="true"/);
  });

  /**
   * A phone has room for the project's name, where you are, and one thing to
   * click. Everything else is marked optional and dropped by a media query
   * rather than wrapped onto a second row, because a status line is one row.
   */
  it('marks optional cells so a narrow screen can drop them', async () => {
    const out = await renderToString(statusLine(CELLS));

    expect(out).toContain('optional');
    expect(out).toContain('@media (max-width: 52rem)');
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
describe('a --no-blog scaffold has no Blog link in the header', () => {
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

  it('takes the header links from the navigation, not from links written by hand', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = await scaffoldWithoutBlog(dir);
      const home = await readFile(join(targetDir, 'pages/index.ts'), 'utf-8');

      // The landing page carries the SAME header the docs pages do, and hands
      // it the nav data pageData read from server/starlight.config.js. So a
      // link removed from the config is removed from every page at once, and
      // this page writes no link of its own.
      expect(home).toContain('<starlight-header');
      expect(home).toMatch(/\.nav="\$\{nav\}"/);
      // The terminal bar that used to be here is gone; the terminal character
      // is in the status line at the foot instead.
      expect(home).not.toContain('<litro-status-bar');
      expect(home).toContain('<litro-status-line');
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

      const out = await renderText(
        html`<starlight-header
          siteTitle="my-product"
          .nav="${siteConfig.nav}"
          currentPath="/"
        ></starlight-header>`,
      );
      expect(out).toContain('href="/docs/getting-started"');
      expect(out).toContain('Docs');
      expect(out).not.toContain('/blog');
      expect(out).not.toContain('Blog');
    });
  });
});
