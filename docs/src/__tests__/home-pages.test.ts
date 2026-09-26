/**
 * The two home pages, pinned where only a production build would otherwise
 * tell you something broke.
 *
 * Every rule below has cost a working page at least once, and none of them
 * shows up in `litro dev`, in a unit render, or in the e2e suites — those all
 * run against live source, where nothing is tree-shaken and every module is
 * evaluated. These read the SOURCE instead, because the mistake is in the
 * source and the symptom is three build steps away.
 */
import { readFile } from 'node:fs/promises';
import { describe, it, expect, beforeAll } from 'vitest';

const STATIC_PAGE = new URL('../../pages/index.ts', import.meta.url);
const SSR_PAGE = new URL('../../../docs-ssr/pages/index.ts', import.meta.url);

/** The components the rebuilt page places, and therefore must register. */
const COMPONENTS = [
  'litro-status-line',
  'starlight-header',
  'litro-hero-nova',
  'litro-install-command',
  'litro-feature-row',
  'litro-steps',
  'litro-term-window',
  'litro-pane',
  'litro-pane-grid',
  'litro-site-footer',
];

let staticPage = '';
let ssrPage = '';

beforeAll(async () => {
  staticPage = await readFile(STATIC_PAGE, 'utf-8');
  ssrPage = await readFile(SSR_PAGE, 'utf-8');
});

describe('both home pages register every component they place', () => {
  for (const tag of COMPONENTS) {
    it(`imports ${tag}`, () => {
      const importLine = `@beatzball/litro-docs-ui/src/components/${tag}.js`;
      expect(staticPage, 'the static site').toContain(importLine);
      expect(ssrPage, 'the server-rendered site').toContain(importLine);
    });
  }
});

/**
 * `<litro-link>` is registered by the FRAMEWORK, not by this page.
 *
 * This page used to carry `import "@beatzball/litro/runtime/LitroLink.js"`
 * for the side effect, and that one line was the only reason any link on the
 * site worked: the Nitro server is a single bundle, so importing the element
 * once registered it for every other page too. Removing it took all 96 links
 * on the site down at once, and nothing reported it.
 *
 * The Lit adapter's `manifestPreamble()` now does the import, so every Litro
 * app gets a server-rendered anchor without knowing to ask. This page is back
 * to being an ordinary consumer, and `scripts/check-ssr-links.mjs` is what
 * watches the result — see BUILD-008.
 */
describe('the home pages leave litro-link registration to the framework', () => {
  it('the server-rendered page carries no side-effect import of its own', () => {
    expect(ssrPage).not.toContain('runtime/LitroLink.js');
  });

  it('only the server-rendered page places the element', () => {
    // The static site uses plain anchors (CONTENT-007), so it has no
    // litro-link at all.
    expect(ssrPage).toContain('</litro-link');
    // A closing tag, not an opening one: the file's own doc comment names the
    // element when it explains the difference between the two sites.
    expect(staticPage).not.toContain('</litro-link');
  });
});

/**
 * The landing page is dark whichever theme the reader chose; the docs pages
 * follow the choice. They are kept from fighting by one rule: the page may set
 * a `--sl-*` token ON a docs component, to dress that one element for a dark
 * page, but never on `:host`, because the docs pages read those tokens too and
 * a page-level redefinition would leak out through the shell.
 */
describe('the home pages do not redefine the docs tokens globally', () => {
  for (const [label, get] of [
    ['the static site', () => staticPage],
    ['the server-rendered site', () => ssrPage],
  ] as const) {
    it(`${label} sets no --sl-* token in its :host block`, () => {
      const source = get();
      const start = source.indexOf(':host {');
      expect(start, 'a :host block').toBeGreaterThan(-1);
      const end = source.indexOf('}', start);
      const hostBlock = source.slice(start, end);
      expect(hostBlock).not.toMatch(/--sl-[a-z-]+\s*:/);
    });

    /**
     * The page dresses the one docs component it still places — the header —
     * on the element rather than at :host. The feature block used to be
     * litro-card and was dressed the same way; it is panes now, which read
     * the --nova-* tokens directly and need no dressing at all.
     */
    it(`${label} dresses starlight-header with --sl-* tokens instead`, () => {
      expect(get()).toMatch(/starlight-header \{[^}]*--sl-color-bg:/);
    });
  }
});
