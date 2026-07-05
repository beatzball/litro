import { test, expect } from '@playwright/test';
import { hashActionId } from '../../packages/framework/dist/actions/hash.js';
import { serializeValue } from '../../packages/framework/dist/actions/serialize.js';

const ECHO_UPPER_ID = hashActionId('actions/demo.server', 'echoUpper');

test('actions endpoint works under the Elena adapter', async ({ request }) => {
  const res = await request.post(`/__litro/action/${ECHO_UPPER_ID}`, {
    headers: { 'content-type': 'application/json', 'x-litro-action': '1' },
    data: serializeValue([{ text: 'elena smoke' }]),
  });
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('ELENA SMOKE');
});

test('CSRF gate active under the Elena adapter', async ({ request }) => {
  const res = await request.post(`/__litro/action/${ECHO_UPPER_ID}`, {
    headers: { 'content-type': 'application/json' },
    data: serializeValue([{ text: 'x' }]),
  });
  expect(res.status()).toBe(403);
});
