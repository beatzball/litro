import { test, expect } from '@playwright/test';
import { hashActionId } from '../../packages/framework/dist/actions/hash.js';
import { serializeValue } from '../../packages/framework/dist/actions/serialize.js';

const ECHO_UPPER_ID = hashActionId('actions/demo.server', 'echoUpper');

test('SSR page contains data fetched via in-process action call', async ({ request }) => {
  const response = await request.get('/actions');
  const body = await response.text();
  expect(body).toContain('__litro_data__');
  expect(body).toContain('serverNowIso');
});

test('button click performs typed RPC and revives Date', async ({ page }) => {
  await page.goto('/actions');
  await page.waitForSelector('page-actions:not([hidden])');
  // Wait for the router's authoritative "swap complete" marker: until the
  // initial SSR->client swap finishes, the visible element is the SSR'd shell
  // whose button has no live handler, so a click lands on it and is dropped.
  await page.waitForSelector('litro-outlet[data-litro-settled]');
  await page.locator('#rpc-button').click();
  await expect(page.locator('#rpc-result')).toContainText('LITRO ACTIONS @ 20');
  await expect(page.locator('#rpc-result')).not.toContainText('NOT-A-DATE');
});

test('endpoint rejects requests missing the CSRF header', async ({ request }) => {
  const res = await request.post(`/__litro/action/${ECHO_UPPER_ID}`, {
    headers: { 'content-type': 'application/json' },
    data: serializeValue([{ text: 'x' }]),
  });
  expect(res.status()).toBe(403);
});

test('endpoint 404s unknown action ids', async ({ request }) => {
  const res = await request.post('/__litro/action/000000000000', {
    headers: { 'content-type': 'application/json', 'x-litro-action': '1' },
    data: serializeValue([]),
  });
  expect(res.status()).toBe(404);
});

test('defineAction validation failure returns 400 with issues', async ({ request }) => {
  const res = await request.post(`/__litro/action/${ECHO_UPPER_ID}`, {
    headers: { 'content-type': 'application/json', 'x-litro-action': '1' },
    data: serializeValue([{ text: 123 }]),
  });
  expect(res.status()).toBe(400);
  const payload = (await res.json()) as { issues?: Array<{ message: string }> };
  expect(payload.issues?.[0]?.message).toBe('expected { text: string }');
});

test('direct valid RPC round-trips through the endpoint', async ({ request }) => {
  const res = await request.post(`/__litro/action/${ECHO_UPPER_ID}`, {
    headers: { 'content-type': 'application/json', 'x-litro-action': '1' },
    data: serializeValue([{ text: 'curl style' }]),
  });
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('CURL STYLE');
});
