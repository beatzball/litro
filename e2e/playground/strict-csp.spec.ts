import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Issue 290 — a Litro app runs under a strict script policy.
 *
 * The playground passes `inlineScripts: false` to `createPageHandler()` and
 * lists `litroShellScriptsPlugin()` in vite.config.ts, so a production build
 * writes the DSD polyfill and the skip-link script as `<script src>` files
 * under `/_litro/assets/`. This spec serves each page with
 *
 *   default-src 'none'; script-src 'self'; ...
 *
 * and no `'unsafe-inline'` for scripts, and fails on any violation report.
 * `style-src` keeps `'unsafe-inline'`: Lit SSR writes a `<style>` into each
 * shadow root, which is out of scope here.
 *
 * Production only. Under `litro dev` the framework's scripts stay inline.
 */

const POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

/** A skip link whose target does not exist, so the script must hide it. */
const MISSING_TARGET_LINK = '<a class="skip-link" href="#no-such-target">Skip to nowhere</a>';

interface Violation {
  directive: string;
  blockedURI: string;
  sample: string;
}

/**
 * Adds the policy to every document response. `extraSkipLink` also adds a
 * skip link with a missing target, to observe the script's DOMContentLoaded
 * work.
 */
async function serveWithPolicy(page: Page, options: { extraSkipLink?: boolean } = {}) {
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    let body = await response.text();
    if (options.extraSkipLink) {
      body = body.replace('</nav>', `${MISSING_TARGET_LINK}\n</nav>`);
    }
    await route.fulfill({
      response,
      body,
      headers: { ...response.headers(), 'content-security-policy': POLICY },
    });
  });
}

/** Records every CSP violation and console error the page reports. */
async function watch(page: Page) {
  const violations: Violation[] = [];
  const errors: string[] = [];
  await page.exposeFunction('__reportViolation', (v: Violation) => violations.push(v));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __reportViolation: (v: unknown) => void }).__reportViolation({
        directive: e.violatedDirective,
        blockedURI: e.blockedURI,
        sample: e.sample,
      });
    });
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return { violations, errors };
}

async function shellScripts(page: Page): Promise<string[]> {
  return page.$$eval('script', (els) =>
    els.map((s) => s.outerHTML.replace(/>[\s\S]*<\/script>$/, '>')),
  );
}

test.describe('strict CSP (production build, inlineScripts: false)', () => {
  test.beforeEach(async ({ request }) => {
    const html = await (await request.get('/')).text();
    test.skip(/src="\/app\.ts"/.test(html), 'litro dev keeps the framework scripts inline');
  });

  test('the shell writes no inline script', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const tags = html.match(/<script\b[^>]*>/g) ?? [];
    const inline = tags.filter(
      (t) => !/\ssrc=/.test(t) && !/type="application\/(ld\+)?json"/.test(t),
    );
    expect(inline).toEqual([]);

    // The DSD polyfill is a synchronous classic script in <head>, ahead of
    // every declarative shadow root; the skip-link script is deferred.
    const dsd = html.match(/<script src="(\/_litro\/assets\/litro-dsd-polyfill-[0-9a-f]{8}\.js)"><\/script>/);
    expect(dsd, 'DSD polyfill <script src> with no defer, async or type').not.toBeNull();
    expect(html.indexOf(dsd![0])).toBeLessThan(html.indexOf('</head>'));
    expect(html.indexOf(dsd![0])).toBeLessThan(html.indexOf('shadowrootmode'));
    expect(html).toMatch(/<script src="\/_litro\/assets\/litro-skip-links-[0-9a-f]{8}\.js" defer><\/script>/);
  });

  test('the script files are served immutable', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const srcs = [...html.matchAll(/src="(\/_litro\/assets\/litro-[^"]+)"/g)].map((m) => m[1]);
    expect(srcs).toHaveLength(2);
    for (const src of srcs) {
      const res = await request.get(src);
      expect(res.status(), src).toBe(200);
      expect(res.headers()['content-type'], src).toContain('javascript');
      expect(res.headers()['cache-control'], src).toBe('public, max-age=31536000, immutable');
    }
  });

  for (const path of ['/', '/blog', '/blog/hello-world', '/actions', '/forms']) {
    test(`${path} hydrates with no violation and no console error`, async ({ page }) => {
      await serveWithPolicy(page);
      const { violations, errors } = await watch(page);
      const res = await page.goto(path);
      expect(res?.headers()['content-security-policy']).toBe(POLICY);
      // TEST-001: the router marks the outlet settled after the client swap,
      // which needs app.js and the page's chunks to have run.
      await page.waitForSelector('litro-outlet[data-litro-settled]');
      expect(violations).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  test('client navigation works under the policy', async ({ page }) => {
    await serveWithPolicy(page);
    const { violations, errors } = await watch(page);
    let loads = 0;
    page.on('load', () => loads++);
    await page.goto('/blog');
    await page.waitForSelector('litro-outlet[data-litro-settled]');
    await page.click('litro-link[href="/blog/hello-world"]');
    await page.waitForURL('**/blog/hello-world');
    await expect(page.locator('page-blog-slug')).toBeVisible();
    expect(loads).toBe(1);
    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('the deferred skip-link script runs its DOMContentLoaded work and its click handler', async ({ page }) => {
    await serveWithPolicy(page, { extraSkipLink: true });
    const { violations } = await watch(page);
    await page.goto('/');
    await page.waitForSelector('litro-outlet[data-litro-settled]');

    // DOMContentLoaded work: a link whose target is missing is hidden. Without
    // the script (blocked, or run after the event) it would stay visible.
    await expect(page.locator('.skip-link[href="#no-such-target"]')).toHaveAttribute('hidden', '');
    await expect(page.locator('.skip-link[href="#_litro_main"]')).not.toHaveAttribute('hidden', '');

    // Click handler: it prevents the default fragment navigation and focuses
    // the target itself, so the URL keeps no hash.
    const skip = page.locator('.skip-link[href="#_litro_main"]');
    await skip.focus();
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#_litro_main')).toBeFocused();
    expect(new URL(page.url()).hash).toBe('');
    expect(violations).toEqual([]);
  });

  test('the DSD polyfill runs before the parser reaches the body', async ({ page }) => {
    // Chromium supports declarative shadow DOM natively, so the parser
    // consumes every server-rendered template before the polyfill could see
    // it. With the native feature hidden from the polyfill's check, this test
    // shows WHEN it runs (its observer is installed while document.body does
    // not exist yet, so before the first <template shadowrootmode> is parsed)
    // and THAT it works. It is not a run on a browser without native support.
    await serveWithPolicy(page);
    const { violations } = await watch(page);
    await page.addInitScript(() => {
      const w = window as unknown as { __dsdObserveAt?: string };
      delete (HTMLTemplateElement.prototype as unknown as Record<string, unknown>).shadowRootMode;
      const observe = MutationObserver.prototype.observe;
      MutationObserver.prototype.observe = function (target, opts) {
        if (w.__dsdObserveAt === undefined && target === document.documentElement && opts?.subtree) {
          w.__dsdObserveAt = document.body === null ? 'before-body' : 'after-body';
        }
        return observe.call(this, target, opts);
      };
    });
    await page.goto('/');
    expect(await page.evaluate(() => (window as unknown as { __dsdObserveAt?: string }).__dsdObserveAt)).toBe(
      'before-body',
    );

    // And it works: a declarative template that the native parser did not
    // handle (innerHTML never does) is promoted to a real shadow root by the
    // polyfill loaded from the file.
    const upgraded = await page.evaluate(async () => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      host.innerHTML = '<template shadowrootmode="open"><b id="dsd-probe">x</b></template>';
      await new Promise((r) => setTimeout(r, 50));
      return {
        shadow: host.shadowRoot?.getElementById('dsd-probe')?.textContent ?? null,
        templateLeft: host.querySelector('template') !== null,
      };
    });
    expect(upgraded).toEqual({ shadow: 'x', templateLeft: false });
    expect(violations).toEqual([]);
  });
});
