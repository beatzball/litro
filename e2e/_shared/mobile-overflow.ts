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
 * A search for the CSS text would have passed on the broken build.
 *
 * A failure names the elements that stick out, in the shadow root they live
 * in, because "the page is 48px too wide" on its own starts another bisect.
 *
 * WHY THE ASSERTION IS THE CULPRIT LIST AND NOT scrollWidth
 *
 * `documentElement.scrollWidth` is a proxy, and the two platforms do not agree
 * on it. On a docs page where every wide element sits inside
 * `pre { overflow-x: auto }` or the header's scrolling `nav`, Linux reported
 * 15px over a 320px viewport while macOS reported none — with no element
 * outside a scroll container on either. Driving `scrollLeft` instead is no
 * better: these sites set `scroll-behavior: smooth`, so the value read back is
 * still the old one.
 *
 * So assert the thing the issue is actually about: no element may be laid out
 * past the right edge of the screen with nothing to scroll it. That is
 * `<main>` at 438px on a 390px viewport, and it is not a code block that
 * scrolls inside its own box. It answers the same on every platform.
 */
import { expect, type Page } from '@playwright/test';

/** The narrowest phones still in use, and the two most common sizes. */
export const PHONE_WIDTHS = [320, 360, 390] as const;

interface Overflow {
  viewport: number;
  scrollWidth: number;
  culprits: string[];
  /** Numbers that tell a real overflow apart from a platform scrollbar. */
  metrics: string;
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

    // A code block inside `pre { overflow-x: auto }` is WIDER than the screen
    // and scrolls by itself — that is the design, not a bug. Only an element
    // that sticks out with no scrollable box between it and the document can
    // take the page sideways, so walk up and check.
    const scrollsItself = (el: Element): boolean => {
      let node: Node | null = el.parentNode;
      while (node && node !== document.documentElement) {
        if (node instanceof Element) {
          const overflowX = getComputedStyle(node).overflowX;
          if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden') {
            return true;
          }
        }
        // Step out of a shadow root through its host, not into nothing.
        node = node.parentNode ?? (node as ShadowRoot).host ?? null;
      }
      return false;
    };

    const culprits = found
      .filter(({ el }) => {
        const box = el.getBoundingClientRect();
        // The right edge, not the width: an element narrower than the screen
        // still scrolls the page when it is pushed past the edge.
        return box.right > viewport + 0.5 && box.width > 0 && !scrollsItself(el);
      })
      .map(({ el, host }) => {
        const cls =
          typeof el.className === 'string' && el.className.trim()
            ? `.${el.className.trim().split(/\s+/).join('.')}`
            : '';
        const box = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return (
          `${el.tagName.toLowerCase()}${cls} inside <${host}> ` +
          `is ${Math.round(box.width)}px wide and ends at ` +
          `${Math.round(box.right)}px (box-sizing: ${style.boxSizing})`
        );
      });

    // When nothing sticks out and the page still scrolls, the difference is
    // almost always the platform's own scrollbar, so print the numbers that
    // separate the two rather than leaving the next reader to guess.
    const clipper = (el: Element): string => {
      let node: Node | null = el.parentNode;
      while (node && node !== document.documentElement) {
        if (node instanceof Element) {
          const overflowX = getComputedStyle(node).overflowX;
          if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden') {
            return `${node.tagName.toLowerCase()}[${overflowX}]`;
          }
        }
        node = node.parentNode ?? (node as ShadowRoot).host ?? null;
      }
      return 'none';
    };

    const widest = found
      .map(({ el, host }) => ({ el, host, right: el.getBoundingClientRect().right }))
      .filter(({ right }) => right > viewport + 0.5)
      .sort((a, b) => b.right - a.right)
      .slice(0, 10)
      .map(
        ({ el, host, right }) =>
          `${el.tagName.toLowerCase()}@${host}=${Math.round(right)}(clip:${clipper(el)})`,
      )
      .join(' ');

    return {
      viewport,
      scrollWidth: document.documentElement.scrollWidth,
      culprits: culprits.slice(0, 8),
      metrics:
        `innerWidth=${window.innerWidth} ` +
        `documentElement.clientWidth=${document.documentElement.clientWidth} ` +
        `documentElement.scrollWidth=${document.documentElement.scrollWidth} ` +
        `body.clientWidth=${document.body.clientWidth} ` +
        `body.scrollWidth=${document.body.scrollWidth} ` +
        `dpr=${window.devicePixelRatio}\n  past the right edge: ${widest || 'nothing'}`,
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
        const { viewport, culprits, metrics } = await measureOverflow(page, path, width);
        expect(
          culprits,
          `${path} has ${culprits.length} element(s) laid out past the right ` +
            `edge of a ${width}px screen with nothing to scroll them:\n  ` +
            `${culprits.join('\n  ')}\n` +
            `A "box-sizing: content-box" above means the shadow root is missing ` +
            `the reset — see .agents/rules/adapters-ssr.md (SSR-008).\n` +
            metrics,
        ).toEqual([]);
      });
    }
  }
}
