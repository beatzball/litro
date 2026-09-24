/**
 * The status line's dark palette has one more copy than a module can reach.
 *
 * `status-line-chrome.ts` is now the one place the three TypeScript copies come
 * from — both home pages and `starlight-page` import it, so they cannot drift.
 * The fourth copy is `--brand-*` in each site's public/styles/starlight.css,
 * which is a plain stylesheet: it cannot import a module, and the landing
 * page's own token block reads it, so the same colors have to be written there
 * too.
 *
 * That leaves exactly one pair that can still disagree, and this is what stops
 * it: the values in the stylesheet's DARK block and the values in the shared
 * module are compared name by name.
 */
import { readFile } from 'node:fs/promises';
import { describe, it, expect, beforeAll } from 'vitest';

const CHROME = new URL('../status-line-chrome.ts', import.meta.url);
const STYLESHEET = new URL(
  '../../../../docs/public/styles/starlight.css',
  import.meta.url,
);

/**
 * `--nova-<a>` on the status line and `--brand-<b>` in the stylesheet are the
 * same color under two names. The accent is the odd pair: the line's
 * `--nova-accent` carries white text, so it is the stylesheet's
 * `--brand-accent-high`, not its `--brand-accent`.
 */
const PAIRS: ReadonlyArray<readonly [nova: string, brand: string]> = [
  ['bg', 'bg'],
  ['surface', 'surface'],
  ['border', 'border'],
  ['text', 'text'],
  ['text-dim', 'text-dim'],
  ['error', 'error'],
  ['blocked', 'blocked'],
  ['working', 'working'],
  ['done', 'done'],
  ['idle', 'idle'],
  ['accent', 'accent-high'],
];

/** Read one custom property's value out of a block of CSS text. */
function readToken(source: string, name: string): string | undefined {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(source);
  return match?.[1].trim();
}

let chrome = '';
/** The stylesheet's dark values — the second of its two --brand-* blocks. */
let dark = '';

beforeAll(async () => {
  chrome = await readFile(CHROME, 'utf-8');
  const sheet = await readFile(STYLESHEET, 'utf-8');

  // The dark set is the one inside the prefers-color-scheme block, which is
  // the LAST place --brand-bg is declared. Slice from there to the end of
  // that rule.
  const start = sheet.lastIndexOf('--brand-bg:');
  expect(start, 'a dark --brand-* block').toBeGreaterThan(-1);
  const end = sheet.indexOf('}', start);
  dark = sheet.slice(start, end);
});

describe('the shared status-line palette matches the stylesheet it shadows', () => {
  for (const [nova, brand] of PAIRS) {
    it(`--nova-${nova} is the stylesheet's --brand-${brand}`, () => {
      const shared = readToken(chrome, `nova-${nova}`);
      const sheet = readToken(dark, `brand-${brand}`);
      expect(shared, `--nova-${nova} in status-line-chrome.ts`).toBeDefined();
      expect(sheet, `--brand-${brand} in the dark block`).toBeDefined();

      // The accent is a color-mix over --sl-color-accent in both files. The
      // shared copy carries a fallback for a page that loads without the
      // stylesheet, which the stylesheet itself has no need of, so the
      // comparison is made without it.
      const normalize = (value: string) =>
        value.replace('var(--sl-color-accent, #7c3aed)', 'var(--sl-color-accent)');

      expect(normalize(shared as string)).toBe(normalize(sheet as string));
    });
  }
});
