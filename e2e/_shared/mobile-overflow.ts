/**
 * Does a page fit on a phone?
 *
 * WHY A BROWSER AND NOT A GREP
 *
 * Issue 137 was a stylesheet that existed, was correct, was linked from the
 * page — and never applied, because it was a document stylesheet aimed at
 * elements inside a shadow root. Every static check passed. The recipe shipped
 * `box-sizing: border-box` and the home page still measured 438px on a 390px
 * screen, because `<main>` lived in `page-home`'s shadow root and the reset
 * stopped at the boundary.
 *
 * So the check has to be a real layout in a real browser at a real viewport.
 * A search for the CSS text would have passed on the broken build; only
 * `document.documentElement.scrollWidth` can tell.
 *
 * A failure names the elements that stick out, in the shadow root they live
 * in, because "the page is 48px too wide" on its own starts another bisect.
 */
import { expect, type Page } from '@playwright/test';

/** The narrowest phones still in use, and the two most common sizes. */
export const PHONE_WIDTHS = [320, 360, 390] as const;

interface Overflow {
  viewport: number;
  scrollWidth: number;
  culprits: string[];
}

/** Load `path` at `width` and report anything wider than the viewport. */
export async function measureOverflow(
  page: Page,
  path: string,
  width: number,
): Promise<Overflow> {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(path);
  // The page element is hidden until the router has rendered it, so a
  // measurement taken before that reads the empty shell.
  await page.waitForSelector('[id^="page-"], page-home, main', { state: 'attached' });
  await page.waitForLoadState('networkidle');

  return page.evaluate(() => {
    // Shadow roots do not appear in document.querySelectorAll, and the bug
    // this guards against lives inside one. Walk into every root.
    const found: Array<{ el: Element; host: string }> = [];
    const walk = (root: ParentNode, host: string) => {
      for (const el of root.querySelectorAll('*')) {
        found.push({ el, host });
        if (el.shadowRoot) walk(el.shadowRoot, el.tagName.toLowerCase());
      }
    };
    walk(document, 'document');

    const viewport = document.documentElement.clientWidth;
    const culprits = found
      .filter(({ el }) => {
        const box = el.getBoundingClientRect();
        // An element parked off-screen on purpose (a closed drawer, a decorative
        // mark inside an overflow:hidden box) does not scroll the page, so only
        // count what is actually laid out wider than the screen.
        return box.width > viewport + 0.5 && box.left >= -0.5;
      })
      .map(({ el, host }) => {
        const cls =
          typeof el.className === 'string' && el.className.trim()
            ? `.${el.className.trim().split(/\s+/).join('.')}`
            : '';
        const style = getComputedStyle(el);
        return (
          `${el.tagName.toLowerCase()}${cls} inside <${host}> ` +
          `is ${Math.round(el.getBoundingClientRect().width)}px ` +
          `(box-sizing: ${style.boxSizing})`
        );
      });

    return {
      viewport,
      scrollWidth: document.documentElement.scrollWidth,
      culprits: culprits.slice(0, 8),
    };
  });
}

/** Assert `path` does not scroll sideways at every phone width. */
export function testNoSideScroll(
  test: (name: string, fn: (args: { page: Page }) => Promise<void>) => void,
  paths: readonly string[],
): void {
  for (const path of paths) {
    for (const width of PHONE_WIDTHS) {
      test(`${path} does not scroll sideways at ${width}px`, async ({ page }) => {
        const { viewport, scrollWidth, culprits } = await measureOverflow(page, path, width);
        expect(
          scrollWidth,
          culprits.length > 0
            ? `${path} is ${scrollWidth - viewport}px wider than a ${width}px screen.\n` +
              `Wider than the viewport:\n  ${culprits.join('\n  ')}\n` +
              `A "box-sizing: content-box" above means the shadow root is missing ` +
              `the reset — see .agents/rules/adapters-ssr.md (SSR-008).`
            : `${path} is ${scrollWidth - viewport}px wider than a ${width}px screen.`,
        ).toBeLessThanOrEqual(viewport);
      });
    }
  }
}
