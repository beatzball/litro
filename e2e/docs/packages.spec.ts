import { test, expect } from '@playwright/test';

const PACKAGE_ROUTES = [
  { slug: 'litro',        name: '@beatzball/litro' },
  { slug: 'litro-router', name: '@beatzball/litro-router' },
  { slug: 'create-litro', name: '@beatzball/create-litro' },
] as const;

// ---------------------------------------------------------------------------
// All 3 package routes return 200
// ---------------------------------------------------------------------------

test('all package routes return 200', async ({ request }) => {
  for (const { slug } of PACKAGE_ROUTES) {
    const res = await request.get(`/docs/packages/${slug}`);
    expect(res.status(), `Expected 200 for /docs/packages/${slug}`).toBe(200);
  }
});

// ---------------------------------------------------------------------------
// @beatzball/litro page — representative full-page check
// ---------------------------------------------------------------------------

test('litro package page renders the custom element', async ({ page }) => {
  await page.goto('/docs/packages/litro');
  await page.waitForSelector('page-docs-packages-pkg');
  await expect(page.locator('page-docs-packages-pkg')).toBeVisible();
});

test('litro package page renders package name in h1', async ({ page }) => {
  await page.goto('/docs/packages/litro');
  await page.waitForSelector('page-docs-packages-pkg');
  await expect(page.locator('page-docs-packages-pkg h1')).toContainText('@beatzball/litro');
});

test('litro package page shows version badge', async ({ page }) => {
  await page.goto('/docs/packages/litro');
  await page.waitForSelector('page-docs-packages-pkg');
  const badge = page.locator('page-docs-packages-pkg .pkg-version');
  await expect(badge).toBeVisible();
  // Badge should contain a semver-style version
  await expect(badge).toContainText(/v\d+\.\d+/);
});

test('litro package page shows GitHub and npm icon links', async ({ page }) => {
  await page.goto('/docs/packages/litro');
  await page.waitForSelector('page-docs-packages-pkg');
  // Both icon links are inside .pkg-meta
  const githubLink = page.locator('page-docs-packages-pkg .pkg-meta a[title="GitHub source"]');
  const npmLink    = page.locator('page-docs-packages-pkg .pkg-meta a[title="View on npm"]');
  await expect(githubLink).toBeVisible();
  await expect(npmLink).toBeVisible();
  await expect(githubLink).toHaveAttribute('href', /github\.com/);
  await expect(npmLink).toHaveAttribute('href', /npmjs\.com/);
});

test('litro package page shows combined install block', async ({ page }) => {
  await page.goto('/docs/packages/litro');
  await page.waitForSelector('page-docs-packages-pkg');
  const installPre = page.locator('page-docs-packages-pkg .pkg-install pre');
  await expect(installPre).toBeVisible();
  const text = await installPre.textContent();
  expect(text).toContain('npm install @beatzball/litro');
  expect(text).toContain('pnpm add @beatzball/litro');
});

test('litro package page shows Changelog section heading', async ({ page }) => {
  await page.goto('/docs/packages/litro');
  await page.waitForSelector('page-docs-packages-pkg');
  await expect(page.locator('page-docs-packages-pkg .section-heading')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Sidebar — Packages group and active state
// ---------------------------------------------------------------------------

test('sidebar shows Packages group', async ({ page }) => {
  await page.goto('/docs/packages/litro');
  await page.waitForSelector('page-docs-packages-pkg');
  // starlight-sidebar is inside starlight-page inside page-docs-packages-pkg
  const sidebar = page.locator('starlight-sidebar');
  await expect(sidebar).toBeVisible();
  const text = await sidebar.evaluate((el) => el.shadowRoot?.textContent ?? '');
  expect(text).toContain('Packages');
});

test('sidebar highlights the active package item', async ({ page }) => {
  await page.goto('/docs/packages/litro');
  await page.waitForSelector('page-docs-packages-pkg');
  // The active link should have aria-current="page"
  const activeLink = await page.locator('starlight-sidebar').evaluate((el) => {
    const link = el.shadowRoot?.querySelector('a[aria-current="page"]');
    return link?.textContent?.trim() ?? null;
  });
  expect(activeLink).toContain('@beatzball/litro');
});

// ---------------------------------------------------------------------------
// litro-router and create-litro pages — smoke checks
// ---------------------------------------------------------------------------

test('litro-router package page renders', async ({ page }) => {
  await page.goto('/docs/packages/litro-router');
  await page.waitForSelector('page-docs-packages-pkg');
  await expect(page.locator('page-docs-packages-pkg h1')).toContainText('@beatzball/litro-router');
});

test('create-litro package page renders', async ({ page }) => {
  await page.goto('/docs/packages/create-litro');
  await page.waitForSelector('page-docs-packages-pkg');
  await expect(page.locator('page-docs-packages-pkg h1')).toContainText('@beatzball/create-litro');
});
