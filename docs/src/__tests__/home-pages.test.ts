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
  'litro-card',
  'litro-card-grid',
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
 * `<litro-link>` is registered by importing its MODULE, never by importing the
 * runtime barrel.
 *
 * The barrel re-exports `LitroLink` as a name. Rollup, which builds the Nitro
 * server bundle, sees that nothing on the page uses that name, drops the
 * re-export, and then never imports the module at all — so the element is not
 * defined on the server, Lit SSR prints a bare `<litro-link>` with no shadow
 * root, and the anchor it would have built in the browser is missing. With
 * JavaScript turned off the page's calls to action are then not links.
 *
 * The module's own path is in the framework's `sideEffects`, so importing the
 * module survives where importing the barrel does not (BUILD-001).
 *
 * `litro dev` cannot show this: it serves live source and never runs Rollup.
 */
describe('the server-rendered home page registers litro-link on the server', () => {
  it('imports the module, not just the barrel', () => {
    expect(ssrPage).toContain(`import "@beatzball/litro/runtime/LitroLink.js"`);
  });

  it('is the only one of the two that needs it', () => {
    // The static site uses plain anchors (CONTENT-007), so it has no
    // litro-link to register and must not carry a pointless import.
    expect(staticPage).not.toContain('runtime/LitroLink.js');
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

    it(`${label} dresses litro-card with --sl-* tokens instead`, () => {
      expect(get()).toMatch(/litro-card \{[^}]*--sl-color-bg:/);
    });
  }
});
