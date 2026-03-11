import { test, expect } from '@playwright/test';

test('docs page contains TOC list', async ({ page }) => {
  await page.goto('/docs/getting-started');
  await page.waitForSelector('starlight-toc');
  const items = page.locator('starlight-toc li');
  await expect(items.first()).toBeVisible();
});

test('TOC hash link does not trigger full page reload', async ({ page }) => {
  let loadCount = 0;
  page.on('load', () => loadCount++);

  await page.goto('/docs/getting-started');
  await page.waitForSelector('starlight-toc');

  // Click the first TOC anchor (a fragment link)
  const tocLink = page.locator('starlight-toc a').first();
  await tocLink.click();

  // Hash navigation must not cause a full page reload
  expect(loadCount).toBe(1);
});
