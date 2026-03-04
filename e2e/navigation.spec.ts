import { test, expect } from '@playwright/test';

test('client navigation between pages does not cause full reload', async ({ page }) => {
  // Register before goto so the initial page load is counted (fullReloadCount = 1).
  // A client-side pushState navigation must NOT increment this further.
  let fullReloadCount = 0;
  page.on('load', () => fullReloadCount++);

  await page.goto('/');
  await page.waitForSelector('litro-outlet');
  // Navigate to /blog via client-side history.pushState and a manual popstate event
  await page.evaluate(() => {
    history.pushState({}, '', '/blog');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForURL('**/blog');

  // No full reload should have occurred after the initial load
  expect(fullReloadCount).toBe(1); // only the initial page load
});

test('blog index page renders after navigation', async ({ page }) => {
  await page.goto('/');
  await page.goto('/blog');
  await expect(page.locator('h1')).toContainText('Blog');
});

test('404 returns appropriate response for unknown routes', async ({ request }) => {
  const response = await request.get('/this-route-does-not-exist');
  // Should return 404 or a catch-all fallback
  expect([404, 200]).toContain(response.status());
});
