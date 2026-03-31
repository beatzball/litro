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

// ---------------------------------------------------------------------------
// Draft filtering — "Draft Test Post" (draft: true) must be hidden
// without preview mode and visible with it.
// ---------------------------------------------------------------------------

const DRAFT_TITLE = 'Draft Test Post';

test('blog index hides draft posts by default', async ({ request }) => {
  const res = await request.get('/blog', {
    headers: { Accept: 'application/json' },
  });
  const data = await res.json();
  const titles = data.posts.map((p: { title: string }) => p.title);
  expect(titles).not.toContain(DRAFT_TITLE);
});

test('blog index shows draft posts in preview mode', async ({ request }) => {
  const res = await request.get('/blog?preview=1', {
    headers: { Accept: 'application/json' },
  });
  const data = await res.json();
  const titles = data.posts.map((p: { title: string }) => p.title);
  expect(titles).toContain(DRAFT_TITLE);
});

test('search API hides draft posts by default', async ({ request }) => {
  const res = await request.get('/api/search?q=Draft+Test+Post');
  const data = await res.json();
  const titles = data.results.map((r: { title: string }) => r.title);
  expect(titles).not.toContain(DRAFT_TITLE);
});

test('search API shows draft posts in preview mode', async ({ context }) => {
  // Activate preview via cookie (search API reads cookie, not query param)
  await context.addCookies([
    { name: '__litro_preview', value: '1', domain: 'localhost', path: '/' },
  ]);
  const res = await context.request.get('/api/search?q=Draft+Test+Post');
  const data = await res.json();
  const titles = data.results.map((r: { title: string }) => r.title);
  expect(titles).toContain(DRAFT_TITLE);
});

test('tag page hides draft posts by default', async ({ request }) => {
  const res = await request.get('/blog/tags/testing', {
    headers: { Accept: 'application/json' },
  });
  const data = await res.json();
  const titles = (data.posts ?? []).map((p: { title: string }) => p.title);
  expect(titles).not.toContain(DRAFT_TITLE);
});

test('tag page shows draft posts in preview mode', async ({ request }) => {
  const res = await request.get('/blog/tags/testing?preview=1', {
    headers: { Accept: 'application/json' },
  });
  const data = await res.json();
  const titles = (data.posts ?? []).map((p: { title: string }) => p.title);
  expect(titles).toContain(DRAFT_TITLE);
});

test('search results page hides draft posts by default', async ({ request }) => {
  const res = await request.get('/search?q=Draft+Test+Post', {
    headers: { Accept: 'application/json' },
  });
  const data = await res.json();
  const titles = (data.results ?? []).map((r: { title: string }) => r.title);
  expect(titles).not.toContain(DRAFT_TITLE);
});

test('search results page shows draft posts in preview mode', async ({ request }) => {
  const res = await request.get('/search?q=Draft+Test+Post&preview=1', {
    headers: { Accept: 'application/json' },
  });
  const data = await res.json();
  const titles = (data.results ?? []).map((r: { title: string }) => r.title);
  expect(titles).toContain(DRAFT_TITLE);
});
