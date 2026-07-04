import { test, expect } from '@playwright/test';

// Structural externalization guarantee: no JS the browser loads on the
// actions page may contain server module code. In dev, Vite serves the
// transformed (stubbed) module; in preview, the built bundle. Either way the
// canary string must never reach the client.
test('no server-module code reaches the browser on the actions page', async ({ page }) => {
  const bodies: string[] = [];
  page.on('response', async (response) => {
    const ct = response.headers()['content-type'] ?? '';
    if (ct.includes('javascript')) {
      bodies.push(await response.text().catch(() => ''));
    }
  });
  await page.goto('/actions');
  await page.waitForSelector('page-actions:not([hidden])');
  await page.locator('#rpc-button').click();
  await expect(page.locator('#rpc-result')).toContainText('LITRO ACTIONS');
  const leaked = bodies.filter((b) => b.includes('LITRO_CANARY'));
  expect(leaked).toHaveLength(0);
});
