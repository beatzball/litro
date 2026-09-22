/**
 * How a starlight page decides which theme to open in.
 *
 * WHY THESE TESTS READ SOURCE RATHER THAN A RENDERED PAGE
 *
 * The failure they exist for is a race, and it only happens in a browser: the
 * head script sets `data-theme` correctly before the first paint, and then a
 * component resolves the theme a SECOND time and writes a different answer
 * over it. The browser half is covered by `e2e/playground-supernova/theme.spec.ts`,
 * which emulates a dark system and asserts the color a reader actually sees.
 *
 * What an e2e run cannot do is stop the same mistake being reintroduced in one
 * of the five other copies of these files, or in an adapter overlay whose
 * playground nobody drives with a dark preference. That is what these are for:
 * they hold the SHAPE of the fix in every copy.
 */
import { readFile } from 'node:fs/promises';
import { describe, it, expect } from 'vitest';

const HEADERS = [
  '../recipes/starlight/template/src/components/starlight-header.ts',
  '../recipes/starlight/template-fast/src/components/starlight-header.ts',
  '../recipes/starlight/template-elena/src/components/starlight-header.ts',
  '../../docs-ui/src/components/starlight-header.ts',
  '../../../playground-starlight/src/components/starlight-header.ts',
  '../../../playground-starlight-fast/src/components/starlight-header.ts',
  '../../../playground-starlight-elena/src/components/starlight-header.ts',
  '../../../playground-supernova/src/components/starlight-header.ts',
] as const;

const HEADS = [
  '../recipes/starlight/template/src/route-meta.ts',
  '../../docs-ui/src/route-meta.ts',
  '../../../playground-starlight/src/route-meta.ts',
  '../../../playground-starlight-fast/src/route-meta.ts',
  '../../../playground-starlight-elena/src/route-meta.ts',
  '../../../playground-supernova/src/route-meta.ts',
] as const;

const STYLESHEETS = [
  '../recipes/starlight/template/public/styles/starlight.css',
  '../../../docs/public/styles/starlight.css',
  '../../../playground-starlight/public/styles/starlight.css',
  '../../../playground-starlight-fast/public/styles/starlight.css',
  '../../../playground-starlight-elena/public/styles/starlight.css',
  '../../../playground-supernova/public/styles/starlight.css',
] as const;

const read = (rel: string) => readFile(new URL(rel, import.meta.url), 'utf-8');

/** Strip comments, so a rule quoted in prose is not mistaken for code. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

// ---------------------------------------------------------------------------
// The head script is the only thing that decides
// ---------------------------------------------------------------------------

describe('the head script decides the theme', () => {
  for (const file of HEADS) {
    describe(file, () => {
      it('reads the system preference, not only the stored value', async () => {
        const source = code(await read(file));
        expect(source).toContain('prefers-color-scheme: dark');
        expect(source).toContain('data-theme');
      });

      /**
       * `localStorage.getItem` THROWS rather than returning null in a browser
       * with site data blocked. An unguarded read there takes the whole script
       * down, `data-theme` is never set, and every reader in that state gets
       * the light default whatever their system says.
       */
      it('guards every storage read', async () => {
        const source = code(await read(file));
        expect(source).toMatch(/try\s*\{\s*return localStorage\.getItem/);
      });

      /**
       * A reader who has chosen nothing follows the system, and keeps
       * following it if they change it while the page is open. A reader who
       * HAS chosen is left alone — which is what the guard inside the listener
       * is for.
       */
      it('follows a later system change only while nothing is stored', async () => {
        const source = code(await read(file));
        expect(source).toContain('addEventListener("change"');
        expect(source).toMatch(/if\(!g\(\)\)/);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Nothing else decides
// ---------------------------------------------------------------------------

/**
 * THE BUG THIS PINS. `starlight-header` used to resolve the theme again in its
 * first update, falling back to 'light' with no look at the system. It answered
 * a moment after the head script and overwrote a correct value, so on a dark
 * system every page carrying the header flipped to light right after it loaded
 * — while the supernova landing page, which has `litro-status-bar` instead,
 * stayed dark.
 *
 * The header reads `data-theme`; it does not work the theme out a second time.
 */
describe('the header reads the theme rather than deciding it', () => {
  for (const file of HEADERS) {
    describe(file, () => {
      it('reads data-theme from the document', async () => {
        const source = code(await read(file));
        expect(source).toMatch(
          /documentElement\.getAttribute\(\s*['"]data-theme['"]\s*\)/,
        );
      });

      it('never falls back to a hard-coded light default', async () => {
        const source = code(await read(file));
        expect(source).not.toMatch(/\?\?\s*['"]light['"]/);
      });

      /** The toggle is the one place a theme is chosen, and it stores it. */
      it('stores the reader choice when the toggle is used', async () => {
        const source = code(await read(file));
        expect(source).toMatch(/localStorage\.setItem\(\s*['"]sl-theme['"]/);
      });

      it('stops listening to the system when it is taken off the page', async () => {
        const source = code(await read(file));
        expect(source).toContain('disconnectedCallback');
        expect(source).toMatch(/removeEventListener\(\s*['"]change['"]/);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// The stylesheet carries it when there is no JavaScript at all
// ---------------------------------------------------------------------------

/** The declarations inside the first rule whose selector matches. */
function block(css: string, selector: string): string[] {
  const at = css.indexOf(selector);
  if (at === -1) return [];
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  return css
    .slice(open + 1, close)
    .split(';')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

describe('the stylesheet follows a dark system with no JavaScript', () => {
  for (const file of STYLESHEETS) {
    describe(file, () => {
      it('has a prefers-color-scheme branch', async () => {
        const css = await read(file);
        expect(css).toContain('@media (prefers-color-scheme: dark)');
      });

      /**
       * The guard is the whole trick. Without it a reader who chose light on a
       * dark system would be dragged back to dark by the media query; with it,
       * the moment the head script writes `data-theme="light"` the block stops
       * matching.
       */
      it('lets an explicit light choice win over the system', async () => {
        const css = await read(file);
        expect(css).toContain(':root:not([data-theme="light"])');
      });

      /**
       * CSS cannot give one declaration block two conditions, so the dark
       * palette is written twice and the two copies must stay in step. This is
       * the check the comment beside them points at.
       */
      it('keeps the two dark blocks identical', async () => {
        const css = await read(file);
        const attribute = block(css, '[data-theme="dark"] {');
        const media = block(css, ':root:not([data-theme="light"]) {');

        expect(attribute.length).toBeGreaterThan(5);
        // The media copy is indented one level deeper, so compare the text.
        expect(media.map((d) => d.replace(/\s+/g, ' '))).toEqual(
          attribute.map((d) => d.replace(/\s+/g, ' ')),
        );
      });

      /** Form controls and scrollbars follow the theme too. */
      it('declares a color-scheme for both themes', async () => {
        const css = await read(file);
        expect(css).toMatch(/color-scheme:\s*light/);
        expect(css).toMatch(/color-scheme:\s*dark/);
      });
    });
  }
});
