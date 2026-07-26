import { test, expect } from '@playwright/test';

// Structural externalization guarantee: no JS the browser loads on the
// actions page may contain server module code. In dev, Vite serves the
// transformed (stubbed) module; in preview, the built bundle. Either way the
// canary string must never reach the client.
test('no server-module code reaches the browser on the actions page', async ({ page }) => {
  const bodyPromises: Promise<string>[] = [];
  page.on('response', (response) => {
    const ct = response.headers()['content-type'] ?? '';
    if (ct.includes('javascript')) {
      bodyPromises.push(response.text().catch(() => ''));
    }
  });
  await page.goto('/actions');
  await page.waitForSelector('page-actions:not([hidden])');
  // Router "swap complete" marker — before it, clicks can land on the dead
  // SSR'd shell. Same convention as server-actions.spec.ts.
  await page.waitForSelector('litro-outlet[data-litro-settled]');
  await page.locator('#rpc-button').click();
  await expect(page.locator('#rpc-result')).toContainText('LITRO ACTIONS');
  // Await every captured body before asserting — pushing resolved strings
  // from an async listener races the assertion and could false-pass.
  const bodies = await Promise.all(bodyPromises);
  expect(bodies.length).toBeGreaterThan(0);
  const leaked = bodies.filter((b) => b.includes('LITRO_CANARY'));
  expect(leaked).toHaveLength(0);
});
