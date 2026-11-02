import { test, expect } from '@playwright/test';

/**
 * Regression for issue 253 — the client entry must not be cached forever.
 *
 * `/_litro/app.js` has the same name in every build. It used to be served
 * `immutable`, so after a deploy a browser kept the old entry, which asked for
 * chunks the new build no longer had, and client-side navigation did nothing.
 *
 * A production build now loads the entry as `/_litro/app.js?v=<content hash>`,
 * serves it `no-cache`, keeps `immutable` for the hashed chunks only, and no
 * chunk imports the entry by name (which would load a second copy).
 *
 * These assertions need a production build, so they skip under `litro dev`,
 * where the shell loads the live `/app.ts` source instead.
 */

function entrySrc(html: string): string {
  const match = html.match(/<script type="module" src="([^"]+)"><\/script>/);
  if (!match) throw new Error('no module entry <script> found in shell');
  return match[1];
}

test.describe('client entry caching (production build)', () => {
  test.beforeEach(async ({ request }) => {
    const src = entrySrc(await (await request.get('/')).text());
    test.skip(/\/app\.ts(\?.*)?$/.test(src), 'litro dev serves the live entry');
  });

  test('the shell loads a versioned entry, served no-cache', async ({ request }) => {
    const src = entrySrc(await (await request.get('/')).text());
    expect(src).toMatch(/^\/_litro\/app\.js\?v=[0-9a-f]{12}$/);

    const res = await request.get(src);
    expect(res.status()).toBe(200);
    expect(res.headers()['cache-control']).toBe('no-cache');
  });

  test('hashed chunks stay immutable, and none of them imports the entry', async ({ request }) => {
    const src = entrySrc(await (await request.get('/')).text());
    const entry = await (await request.get(src)).text();

    const chunks = [...entry.matchAll(/["'`]\.\/(assets\/[^"'`]+\.js)["'`]/g)].map((m) => m[1]);
    expect(chunks.length, 'the entry should import at least one hashed chunk').toBeGreaterThan(0);

    for (const chunk of new Set(chunks)) {
      const res = await request.get(`/_litro/${chunk}`);
      expect(res.status(), chunk).toBe(200);
      expect(res.headers()['cache-control'], chunk).toBe('public, max-age=31536000, immutable');
      expect(await res.text(), `${chunk} must not import the entry`).not.toMatch(
        /["'`](?:\.\.?\/)+app\.js["'`]/,
      );
    }
  });

  test('the browser loads the entry once, and client navigation works', async ({ page }) => {
    const entryRequests: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.pathname === '/_litro/app.js') entryRequests.push(url.pathname + url.search);
    });
    let loads = 0;
    page.on('load', () => loads++);

    await page.goto('/blog');
    await page.waitForSelector('page-blog:not([hidden])');
    await page.click('litro-link[href="/blog/hello-world"]');
    await page.waitForURL('**/blog/hello-world');
    await expect(page.locator('page-blog-slug')).toBeVisible();

    expect(loads).toBe(1);
    // One request, for the versioned URL. A bare `/_litro/app.js` here would
    // be a chunk importing the entry by name: a second copy of the runtime.
    expect(entryRequests).toHaveLength(1);
    expect(entryRequests[0]).toMatch(/^\/_litro\/app\.js\?v=[0-9a-f]{12}$/);
  });
});
