import { test, expect } from '@playwright/test';

test('docs page contains TOC list', async ({ page }) => {
  await page.goto('/docs/getting-started');
  await page.waitForSelector('page-docs-slug');
  // Elena light DOM — TOC rendered as <starlight-toc> child component
  const items = page.locator('page-docs-slug starlight-toc li');
  await expect(items.first()).toBeVisible();
});

test('TOC aside has sticky positioning', async ({ page }) => {
  await page.goto('/docs/getting-started');
  await page.waitForSelector('page-docs-slug');
  // Elena light DOM — .toc-wrap wraps the <starlight-toc> component
  const position = await page.locator('page-docs-slug .toc-wrap').evaluate((el) => {
    return getComputedStyle(el).position;
  });
  expect(position).toBe('sticky');
});

test('header has sticky positioning', async ({ page }) => {
  await page.goto('/docs/getting-started');
  await page.waitForSelector('page-docs-slug');
  // Elena light DOM — header is a <starlight-header> child component
  const position = await page.locator('page-docs-slug starlight-header').evaluate((el) => {
    return getComputedStyle(el).position;
  });
  expect(position).toBe('sticky');
});

test('TOC hash link does not trigger full page reload', async ({ page }) => {
  let loadCount = 0;
  page.on('load', () => loadCount++);

  await page.goto('/docs/getting-started');
  await page.waitForSelector('page-docs-slug');

  const tocLink = page.locator('page-docs-slug starlight-toc a').first();
  await tocLink.click();

  expect(loadCount).toBe(1);
});
