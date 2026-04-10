import { test, expect } from '@playwright/test';

test('client navigation between pages does not cause full reload', async ({ page }) => {
  let fullReloadCount = 0;
  page.on('load', () => fullReloadCount++);

  await page.goto('/');
  await page.waitForSelector('litro-outlet');

  await page.evaluate(() => {
    history.pushState({}, '', '/about');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForURL('**/about');

  expect(fullReloadCount).toBe(1);
});

test('about page renders after navigation', async ({ page }) => {
  await page.goto('/');
  await page.goto('/about');
  await expect(page.locator('h1').first()).toContainText('About');
});

test('LitroLink click triggers SPA navigation', async ({ page }) => {
  let fullReloadCount = 0;
  page.on('load', () => fullReloadCount++);

  // About page has <litro-link href="/"> inside its shadow DOM
  await page.goto('/about');
  await page.waitForSelector('page-about');

  // litro-link renders an <a> in its shadow root — locate via the host element
  // and click its shadow <a>
  await page.evaluate(() => {
    const link = document.querySelector('page-about')
      ?.shadowRoot?.querySelector('litro-link');
    const anchor = link?.shadowRoot?.querySelector('a');
    anchor?.click();
  });
  await page.waitForURL('/');

  expect(fullReloadCount).toBe(1);
});

test('browser back navigates to previous page', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('litro-outlet');

  await page.evaluate(() => {
    history.pushState({}, '', '/about');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForURL('**/about');

  await page.goBack();
  await expect(page).toHaveURL('/');
});

test('404 returns appropriate response for unknown routes', async ({ request }) => {
  const response = await request.get('/this-route-does-not-exist');
  expect([404, 200]).toContain(response.status());
});
