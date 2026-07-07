import { test, expect } from '@playwright/test';
import { hashActionId } from '../../packages/framework/dist/actions/hash.js';
import { serializeValue } from '../../packages/framework/dist/actions/serialize.js';

const COUNTDOWN_ID = hashActionId('actions/forms.server', 'countdown');

test.describe('server actions — streaming', () => {
  test('raw NDJSON: countdown streams value lines and a done line', async ({ request }) => {
    const res = await request.post(`/__litro/action/${COUNTDOWN_ID}`, {
      headers: { 'content-type': 'application/json', 'x-litro-action': '1' },
      data: serializeValue([{ from: 3 }]),
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/x-ndjson');
    const lines = (await res.text()).split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(4);
    expect(JSON.parse(lines[3])).toEqual({ done: true });
    expect(lines[0]).toContain('"n"');
  });

  test('browser: for-await over the stream yields 3 chunks with a revived Date', async ({ page }) => {
    await page.goto('/forms');
    // The router's initial resolve briefly mounts a second (hidden) page-forms
    // alongside the SSR'd one (see LitroOutlet.ts / litro-router's _resolve());
    // wait for the atomic swap to settle before interacting, matching the
    // convention in server-actions.spec.ts.
    await page.waitForSelector('page-forms:not([hidden])');
    await page.locator('#stream-button').click();
    await expect(page.locator('#stream-lines li')).toHaveCount(4);
    await expect(page.locator('#stream-lines li').first()).toContainText('3 @ 20');
    await expect(page.locator('#stream-lines li').last()).toHaveText('done');
  });

  test('mid-stream error surfaces as a LitroActionError message', async ({ page }) => {
    await page.goto('/forms');
    await page.waitForSelector('page-forms:not([hidden])');
    await page.locator('#stream-fail-button').click();
    await expect(page.locator('#stream-error')).toHaveText('stream blew up');
  });
});
