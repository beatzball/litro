/**
 * Is every part of the page inside a landmark?
 *
 * WHY THIS EXISTS
 *
 * Issue 185: `buildShell` wrote the skip links as bare anchors at the top of
 * `<body>`, before the outlet, so no landmark contained them. axe-core
 * reported `region` — "All page content should be contained by landmarks" —
 * on every page a Litro app served:
 *
 *   [moderate] region — All page content should be contained by landmarks
 *     target: ["a[href$=\"#_litro_main\"]"]
 *
 * The reader who navigates by landmark is the reader most likely to want a
 * skip link, so this one mattered more than its "moderate" label suggests.
 *
 * WHY A BROWSER AND NOT A GREP
 *
 * `region` is a computed result, not a string. It depends on what the page
 * ends up rendering, including inside shadow roots, and axe resolves those
 * itself. A search of the shell source cannot see a page component that
 * forgets its `<main>`.
 *
 * WHY TWO WIDTHS
 *
 * Landmarks come and go with a media query. A sidebar `<nav>` that a docs
 * theme hides below its breakpoint changes which elements sit outside a
 * landmark, so a phone and a desktop are two different results.
 */
import { expect, type Page, type TestType } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

/** A phone and a desktop. Landmarks appear and disappear between the two. */
export const LANDMARK_WIDTHS = [375, 1280] as const;

const require = createRequire(import.meta.url);

/** axe's bundle, read once per worker and injected into each page. */
let axeSource: string | undefined;
function getAxeSource(): string {
  axeSource ??= readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  return axeSource;
}

interface AxeNode {
  target: string[];
  html: string;
}

interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  nodes: AxeNode[];
}

/** Run axe against the page as it stands and return its violations. */
export async function runAxe(page: Page, rules?: string[]): Promise<AxeViolation[]> {
  await page.addScriptTag({ content: getAxeSource() });

  return page.evaluate(async (only) => {
    const options = only
      ? { runOnly: { type: 'rule' as const, values: only } }
      : {};
    // @ts-expect-error — axe is injected into the page, not imported here.
    const results = await window.axe.run(document, options);
    return results.violations.map((v: AxeViolation) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => ({ target: n.target, html: n.html })),
    }));
  }, rules ?? null);
}

/** Turn violations into something a failure message can be read from. */
function describe(violations: AxeViolation[]): string {
  return violations
    .map(
      (v) =>
        `[${v.impact ?? 'unknown'}] ${v.id} — ${v.help}\n` +
        v.nodes
          .map((n) => `    target: ${JSON.stringify(n.target)}\n    html:   ${n.html}`)
          .join('\n'),
    )
    .join('\n');
}

/**
 * Assert that `paths` leave no content outside a landmark, at a phone width
 * and a desktop width.
 *
 * Only the `region` rule runs. This is a regression guard for issue 185, not
 * a full accessibility audit — a wider scan would fail on unrelated findings
 * and stop reporting the one thing it was added to watch.
 */
export function testAllContentInLandmarks(
  test: TestType<object, object>,
  paths: readonly string[],
): void {
  test.describe('landmarks (axe-core `region`)', () => {
    for (const path of paths) {
      for (const width of LANDMARK_WIDTHS) {
        test(`${path} leaves no content outside a landmark at ${width}px`, async ({
          page,
        }) => {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(path);
          // The page element is hidden until the router has rendered it, so
          // a scan run before that sees the empty shell and passes for the
          // wrong reason.
          await page.waitForSelector('[id^="page-"], page-home, main', {
            state: 'attached',
          });
          await page.waitForLoadState('networkidle');

          const violations = await runAxe(page, ['region']);

          expect(
            violations,
            violations.length
              ? `${path} at ${width}px:\n${describe(violations)}`
              : '',
          ).toEqual([]);
        });
      }
    }
  });
}
