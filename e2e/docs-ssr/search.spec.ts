import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Search API endpoint
// ---------------------------------------------------------------------------

test('GET /api/search returns results for known term', async ({ request }) => {
  const res = await request.get('/api/search?q=router');
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data).toHaveProperty('query', 'router');
  expect(data.results.length).toBeGreaterThan(0);
  expect(data.results[0]).toHaveProperty('title');
  expect(data.results[0]).toHaveProperty('url');
  expect(data.results[0]).toHaveProperty('snippet');
  expect(data.results[0]).toHaveProperty('type');
});

test('GET /api/search returns empty for gibberish', async ({ request }) => {
  const res = await request.get('/api/search?q=zzxxyy12345noresult');
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.results).toHaveLength(0);
});

test('GET /api/search returns empty for empty query', async ({ request }) => {
  const res = await request.get('/api/search?q=');
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.results).toHaveLength(0);
});

test('GET /api/search respects type=blog filter', async ({ request }) => {
  const res = await request.get('/api/search?q=litro&type=blog');
  expect(res.status()).toBe(200);
  const data = await res.json();
  for (const result of data.results) {
    expect(result.type).toBe('blog');
  }
});

test('GET /api/search respects limit parameter', async ({ request }) => {
  const res = await request.get('/api/search?q=litro&limit=2');
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.results.length).toBeLessThanOrEqual(2);
});

// ---------------------------------------------------------------------------
// Search results page (fallback)
// ---------------------------------------------------------------------------

test('search page renders results for query', async ({ page }) => {
  await page.goto('/search?q=router');
  await page.waitForSelector('page-search');
  // Content is inside shadow DOM — evaluate to get shadow root text
  const text = await page.locator('page-search').first().evaluate(
    (el) => el.shadowRoot?.textContent ?? '',
  );
  expect(text).toContain('result');
});

test('search page renders empty state', async ({ page }) => {
  await page.goto('/search?q=zzxxyy12345noresult');
  await page.waitForSelector('page-search');
  const text = await page.locator('page-search').first().evaluate(
    (el) => el.shadowRoot?.textContent ?? '',
  );
  expect(text).toContain('No results found');
});

test('search page returns 200', async ({ request }) => {
  const res = await request.get('/search?q=ssr');
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain('page-search');
});

// ---------------------------------------------------------------------------
// Header search pill
// ---------------------------------------------------------------------------

test('header contains a search pill button', async ({ page }) => {
  await page.goto('/');
  // After hydration, spaNav property is set and the pill becomes visible.
  // Use first() since SSR + hydration may produce two header elements briefly.
  const pill = page.locator('starlight-header').first().locator('.search-pill');
  await expect(pill).toBeVisible({ timeout: 5000 });
});

// ---------------------------------------------------------------------------
// Search modal — open/close
// ---------------------------------------------------------------------------

test('Cmd+K opens search modal', async ({ page }) => {
  await page.goto('/');
  // Wait for the modal to be appended to body by app.ts
  await page.waitForSelector('search-modal', { state: 'attached' });
  await page.keyboard.press('Meta+k');
  const modal = page.locator('search-modal');
  await expect(modal).toHaveAttribute('open', '');
});

test('Escape closes search modal', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('search-modal', { state: 'attached' });
  await page.keyboard.press('Meta+k');
  await expect(page.locator('search-modal')).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(page.locator('search-modal')).not.toHaveAttribute('open', '');
});

test('header pill click opens search modal', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('search-modal', { state: 'attached' });
  const pill = page.locator('starlight-header').locator('.search-pill');
  await pill.click();
  await expect(page.locator('search-modal')).toHaveAttribute('open', '');
});

test('/ shortcut opens modal when not in an input', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('search-modal', { state: 'attached' });
  await page.keyboard.press('/');
  await expect(page.locator('search-modal')).toHaveAttribute('open', '');
});

// ---------------------------------------------------------------------------
// Search modal — autosuggest
// ---------------------------------------------------------------------------

test('typing in modal shows autosuggest results', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('search-modal', { state: 'attached' });
  await page.keyboard.press('Meta+k');
  // Wait for the modal's shadow DOM to render and input to be available
  const input = page.locator('search-modal').locator('input[type="search"]');
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill('router');
  // Wait for debounced results to appear
  const results = page.locator('search-modal').locator('[role="option"]');
  await expect(results.first()).toBeVisible({ timeout: 5000 });
});

test('arrow keys navigate results in modal', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('search-modal', { state: 'attached' });
  await page.keyboard.press('Meta+k');
  const input = page.locator('search-modal').locator('input[type="search"]');
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill('litro');
  // Wait for results
  const results = page.locator('search-modal').locator('[role="option"]');
  await expect(results.first()).toBeVisible({ timeout: 5000 });
  // Press ArrowDown — first result should become active
  await page.keyboard.press('ArrowDown');
  await expect(results.first()).toHaveAttribute('aria-selected', 'true');
});

test('Enter on result navigates away', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('search-modal', { state: 'attached' });
  await page.keyboard.press('Meta+k');
  const input = page.locator('search-modal').locator('input[type="search"]');
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill('router');
  const results = page.locator('search-modal').locator('[role="option"]');
  await expect(results.first()).toBeVisible({ timeout: 5000 });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  // Modal should close
  await expect(page.locator('search-modal')).not.toHaveAttribute('open', '');
  // URL should have changed from / (wait for SPA navigation to complete)
  await page.waitForURL((url) => url.pathname !== '/', { timeout: 5000 });
});

// ---------------------------------------------------------------------------
// Search modal — accessibility
// ---------------------------------------------------------------------------

test('search modal has correct ARIA attributes', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('search-modal', { state: 'attached' });
  await page.keyboard.press('Meta+k');
  const dialog = page.locator('search-modal').locator('[role="dialog"]');
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog).toHaveAttribute('aria-label', 'Search documentation');
  const listbox = page.locator('search-modal').locator('[role="listbox"]');
  await expect(listbox).toBeVisible();
});
