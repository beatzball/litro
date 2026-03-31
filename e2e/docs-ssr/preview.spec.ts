import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Preview mode activation via query param
// ---------------------------------------------------------------------------

test('?preview=1 sets the preview cookie', async ({ request }) => {
  const res = await request.get('/blog?preview=1');
  expect(res.status()).toBe(200);
  const setCookie = res.headers()['set-cookie'] ?? '';
  expect(setCookie).toContain('__litro_preview=1');
});

test('?preview=0 clears the preview cookie', async ({ context }) => {
  // First activate preview
  await context.addCookies([
    { name: '__litro_preview', value: '1', domain: 'localhost', path: '/' },
  ]);
  const page = await context.newPage();
  await page.goto('/blog?preview=0');
  const cookies = await context.cookies();
  const previewCookie = cookies.find(c => c.name === '__litro_preview');
  // Cookie should be cleared (either absent or expired)
  expect(!previewCookie || previewCookie.value === '' || previewCookie.expires < Date.now() / 1000).toBe(true);
});

// ---------------------------------------------------------------------------
// Preview banner visibility
// ---------------------------------------------------------------------------

test('preview banner appears when preview=1', async ({ page }) => {
  await page.goto('/blog?preview=1');
  await page.waitForSelector('page-blog');
  // The banner is inside the page component's shadow DOM
  const banner = page.locator('preview-banner');
  await expect(banner).toBeVisible();
});

test('preview banner does not appear without preview', async ({ page }) => {
  await page.goto('/blog');
  await page.waitForSelector('page-blog');
  const banner = page.locator('preview-banner');
  await expect(banner).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Blog page respects preview mode
// ---------------------------------------------------------------------------

test('blog index returns 200 in preview mode', async ({ request }) => {
  const res = await request.get('/blog?preview=1');
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain('preview-banner');
});

// ---------------------------------------------------------------------------
// Docs page respects preview mode
// ---------------------------------------------------------------------------

test('docs page returns 200 in preview mode', async ({ request }) => {
  const res = await request.get('/docs/introduction?preview=1');
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain('preview-banner');
});
